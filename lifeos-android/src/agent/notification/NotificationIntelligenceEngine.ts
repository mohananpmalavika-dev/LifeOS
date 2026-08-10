/**
 * Notification Intelligence Engine
 * 
 * Orchestrates the complete notification processing pipeline:
 * Raw → Normalize → Classify → Extract → Filter → Build → Queue
 * 
 * This is the core intelligence layer that runs ON-DEVICE.
 */

import { NotificationNormalizer, RawNotification, NormalizedNotification } from './NotificationNormalizer';
import { NotificationClassifier, NotificationRelevance } from './NotificationClassifier';
import { NotificationEntityExtractor, StructuredNotificationData } from './NotificationEntityExtractor';
import { PrivacyFilter, PrivacyClassification } from '../../local/PrivacyFilter';
import { NotificationEventBuilder, NotificationEventContext, StructuredLifeEvent } from './NotificationEventBuilder';
import { LifeEvent } from '../../core/LifeEvent';

export interface ProcessingResult {
  shouldSync: boolean;
  event?: LifeEvent;
  structuredEvent?: StructuredLifeEvent;
  reason: string;
  processingTime: number;
}

export interface ProcessingStats {
  totalProcessed: number;
  relevant: number;
  irrelevant: number;
  sensitive: number;
  synced: number;
  localOnly: number;
  discarded: number;
  averageProcessingTime: number;
}

export class NotificationIntelligenceEngine {
  private context: NotificationEventContext;
  private stats: ProcessingStats;
  private processingHistory: Map<string, ProcessingResult>;

  constructor(context: NotificationEventContext) {
    this.context = context;
    this.stats = {
      totalProcessed: 0,
      relevant: 0,
      irrelevant: 0,
      sensitive: 0,
      synced: 0,
      localOnly: 0,
      discarded: 0,
      averageProcessingTime: 0,
    };
    this.processingHistory = new Map();
  }

  /**
   * Process a raw notification through the complete pipeline
   */
  async process(raw: RawNotification): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      console.log(`📱 Processing notification: ${raw.packageName}`);

      // Stage 1: Normalize
      const normalized = this.normalize(raw);
      console.log(`✓ Normalized: "${normalized.title}"`);

      // Stage 2: Privacy classification (early filter)
      const privacyClassification = this.classifyPrivacy(normalized);
      
      // Check if should be discarded immediately (OTP, system, etc.)
      if (privacyClassification.localOnly && 
          privacyClassification.sensitivity === 'CRITICAL') {
        console.log(`🔒 Discarded: ${privacyClassification.reason}`);
        return this.buildResult(false, null, null, privacyClassification.reason, startTime);
      }

      // Stage 3: Relevance classification
      const classification = NotificationClassifier.classify(normalized);
      console.log(`✓ Classified: ${classification.category}/${classification.intent} (confidence: ${classification.confidence.toFixed(2)})`);

      // Check relevance
      if (classification.relevance === NotificationRelevance.IRRELEVANT) {
        console.log(`⊘ Irrelevant: ${classification.reasons.join(', ')}`);
        this.stats.irrelevant++;
        return this.buildResult(false, null, null, 'Classified as irrelevant', startTime);
      }

      // Stage 4: Entity extraction
      const extractedData = NotificationEntityExtractor.extract(
        normalized,
        classification.category,
        classification.intent
      );
      console.log(`✓ Extracted ${extractedData.entities.length} entities`);

      // Stage 5: Validate extraction quality
      const validation = NotificationEntityExtractor.validate(
        extractedData,
        classification.intent
      );
      
      if (!validation.valid && classification.confidence < 0.7) {
        console.log(`⚠ Low confidence extraction: missing ${validation.missingFields.join(', ')}`);
        // Still process but mark confidence lower
        classification.confidence *= 0.8;
      }

      // Stage 6: Build LifeEvent
      const event = NotificationEventBuilder.buildEvent(
        normalized,
        classification,
        extractedData,
        this.context
      );
      console.log(`✓ Built event: ${event.eventId}`);

      // Stage 7: Build structured event for context graph
      const structuredEvent = NotificationEventBuilder.buildStructuredEvent(
        event,
        extractedData
      );

      // Stage 8: Determine sync policy
      const shouldSync = this.shouldSyncToServer(
        classification,
        privacyClassification,
        event
      );

      if (shouldSync) {
        console.log(`☁️ Will sync to server`);
        this.stats.synced++;
      } else {
        console.log(`📱 Local-only event`);
        this.stats.localOnly++;
      }

      // Update stats
      this.stats.totalProcessed++;
      if (classification.relevance === NotificationRelevance.RELEVANT) {
        this.stats.relevant++;
      }
      if (classification.relevance === NotificationRelevance.SENSITIVE) {
        this.stats.sensitive++;
      }

      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);

      console.log(`✓ Processing complete in ${processingTime}ms`);

      const result = this.buildResult(
        shouldSync,
        event,
        structuredEvent,
        shouldSync ? 'Event ready for sync' : 'Event stored locally',
        startTime
      );

      // Store in history for debugging
      this.processingHistory.set(event.eventId, result);

      return result;

    } catch (error: any) {
      console.error('❌ Processing error:', error);
      const processingTime = Date.now() - startTime;
      return this.buildResult(false, null, null, `Error: ${error.message}`, startTime);
    }
  }

  /**
   * Stage 1: Normalize raw notification
   */
  private normalize(raw: RawNotification): NormalizedNotification {
    return NotificationNormalizer.normalize(raw);
  }

  /**
   * Stage 2: Privacy classification
   */
  private classifyPrivacy(normalized: NormalizedNotification): PrivacyClassification {
    return PrivacyFilter.classifyNotification(
      normalized.sourceApp,
      normalized.appName,
      normalized.title,
      normalized.body
    );
  }

  /**
   * Determine if event should sync to server
   */
  private shouldSyncToServer(
    classification: any,
    privacyClassification: PrivacyClassification,
    event: LifeEvent
  ): boolean {
    // Never sync critical/sensitive data
    if (privacyClassification.localOnly) {
      return false;
    }

    // Never sync OTPs or authentication
    if (privacyClassification.category === 'AUTHENTICATION') {
      return false;
    }

    // Only sync relevant events
    if (classification.relevance !== NotificationRelevance.RELEVANT) {
      return false;
    }

    // Only sync if confidence is high enough
    if (classification.confidence < 0.6) {
      return false;
    }

    // Sync if it's a meaningful life event
    if (classification.category === 'FINANCE' ||
        classification.category === 'HEALTH' ||
        classification.category === 'TRAVEL' ||
        classification.category === 'WORK' ||
        classification.category === 'EDUCATION') {
      return true;
    }

    // For other categories, sync only if high confidence and high priority
    return classification.confidence >= 0.75 && classification.priority >= 0.6;
  }

  /**
   * Build processing result
   */
  private buildResult(
    shouldSync: boolean,
    event: LifeEvent | null,
    structuredEvent: StructuredLifeEvent | null,
    reason: string,
    startTime: number
  ): ProcessingResult {
    return {
      shouldSync,
      event: event || undefined,
      structuredEvent: structuredEvent || undefined,
      reason,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(newTime: number): void {
    const total = this.stats.averageProcessingTime * (this.stats.totalProcessed - 1);
    this.stats.averageProcessingTime = (total + newTime) / this.stats.totalProcessed;
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Get processing efficiency ratio
   */
  getEfficiencyRatio(): {
    filterRate: number; // % of notifications filtered out
    syncRate: number;   // % of processed that are synced
    relevanceRate: number; // % that are relevant
  } {
    const total = this.stats.totalProcessed || 1;
    
    return {
      filterRate: ((this.stats.irrelevant + this.stats.discarded) / total) * 100,
      syncRate: (this.stats.synced / total) * 100,
      relevanceRate: (this.stats.relevant / total) * 100,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      relevant: 0,
      irrelevant: 0,
      sensitive: 0,
      synced: 0,
      localOnly: 0,
      discarded: 0,
      averageProcessingTime: 0,
    };
  }

  /**
   * Get processing history
   */
  getHistory(limit: number = 50): ProcessingResult[] {
    return Array.from(this.processingHistory.values())
      .slice(-limit)
      .reverse();
  }

  /**
   * Clear processing history
   */
  clearHistory(): void {
    this.processingHistory.clear();
  }

  /**
   * Diagnostic: Process notification with full logging
   */
  async processDiagnostic(raw: RawNotification): Promise<{
    result: ProcessingResult;
    pipeline: {
      normalized: NormalizedNotification;
      privacyClassification: PrivacyClassification;
      classification: any;
      extractedData: StructuredNotificationData;
      event?: LifeEvent;
    };
  }> {
    const normalized = this.normalize(raw);
    const privacyClassification = this.classifyPrivacy(normalized);
    const classification = NotificationClassifier.classify(normalized);
    const extractedData = NotificationEntityExtractor.extract(
      normalized,
      classification.category,
      classification.intent
    );

    let event: LifeEvent | undefined;
    if (classification.relevance === NotificationRelevance.RELEVANT) {
      event = NotificationEventBuilder.buildEvent(
        normalized,
        classification,
        extractedData,
        this.context
      );
    }

    const result = await this.process(raw);

    return {
      result,
      pipeline: {
        normalized,
        privacyClassification,
        classification,
        extractedData,
        event,
      },
    };
  }
}
