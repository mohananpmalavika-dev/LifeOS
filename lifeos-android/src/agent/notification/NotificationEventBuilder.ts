/**
 * Notification Event Builder
 * 
 * Builds structured LifeEvents from processed notification data.
 * This is the final step before events enter the sync queue.
 */

import { v4 as uuidv4 } from 'uuid';
import type { LifeEvent, EventType, NotificationEventData } from '../../core/LifeEvent';
import type { NormalizedNotification } from './NotificationNormalizer';
import type { NotificationClassification } from './NotificationClassifier';
import type { StructuredNotificationData } from './NotificationEntityExtractor';

export interface NotificationEventContext {
  userId: string;
  deviceId: string;
  appVersion: string;
}

export class NotificationEventBuilder {
  /**
   * Build a LifeEvent from processed notification data
   */
  static buildEvent(
    raw: NormalizedNotification,
    classification: NotificationClassification,
    extractedData: StructuredNotificationData,
    context: NotificationEventContext
  ): LifeEvent {
    const eventId = this.generateEventId();
    const timestamp = raw.timestamp.toISOString();

    // Determine sensitivity based on classification
    const sensitivity = this.determineSensitivity(classification);

    // Build base event
    const event: LifeEvent = {
      eventId,
      userId: context.userId,
      deviceId: context.deviceId,
      type: this.mapIntentToEventType(classification.intent),
      timestamp,
      source: {
        type: 'ANDROID',
        collector: 'notification',
        deviceId: context.deviceId,
        platform: 'Android',
        appVersion: context.appVersion,
      },
      data: this.buildEventData(raw, extractedData),
      confidence: classification.confidence,
      privacy: {
        sensitivity,
        redacted: classification.category === 'SECURITY' || 
                  classification.category === 'FINANCE',
        encrypted: true,
      },
      metadata: {
        // Classification metadata
        notificationCategory: classification.category,
        notificationIntent: classification.intent,
        notificationAction: classification.action,
        notificationPriority: classification.priority,
        relevance: classification.relevance,
        classificationReasons: classification.reasons,
        
        // Extracted entity metadata
        hasAmountInfo: extractedData.hasAmountInfo,
        hasDateInfo: extractedData.hasDateInfo,
        hasActionInfo: extractedData.hasActionInfo,
        entityCount: extractedData.entities.length,
        
        // Source app
        sourcePackage: raw.sourceApp,
        sourceAppName: raw.appName,
      },
      createdAt: new Date().toISOString(),
    };

    // Add specific extracted fields to metadata for easy access
    if (extractedData.amount) {
      event.metadata!.amount = extractedData.amount.value;
      event.metadata!.currency = extractedData.amount.currency;
      event.metadata!.amountConfidence = extractedData.amount.confidence;
    }

    if (extractedData.dueDate) {
      event.metadata!.dueDate = extractedData.dueDate.value;
      event.metadata!.dueDateConfidence = extractedData.dueDate.confidence;
    }

    if (extractedData.organization) {
      event.metadata!.organization = extractedData.organization.name;
      event.metadata!.organizationConfidence = extractedData.organization.confidence;
    }

    if (extractedData.action) {
      event.metadata!.requiredAction = extractedData.action.type;
      event.metadata!.actionConfidence = extractedData.action.confidence;
    }

    // Mark if raw content was NOT uploaded (privacy indicator)
    event.privacy.localOnly = 
      classification.relevance === 'SENSITIVE' ||
      classification.category === 'SECURITY';

    return event;
  }

  /**
   * Generate unique event ID
   */
  private static generateEventId(): string {
    return `evt_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  }

  /**
   * Map notification intent to LifeEvent type
   */
  private static mapIntentToEventType(intent: string): EventType {
    const mapping: Record<string, EventType> = {
      'BILL_DUE': 'NOTIFICATION',
      'PAYMENT': 'NOTIFICATION',
      'DELIVERY': 'NOTIFICATION',
      'APPOINTMENT': 'CALENDAR_EVENT', // Could create calendar event
      'TRAVEL': 'NOTIFICATION',
      'MESSAGE': 'NOTIFICATION',
      'SECURITY_ALERT': 'NOTIFICATION',
      'PROMOTION': 'NOTIFICATION',
      'REMINDER': 'NOTIFICATION',
      'UPDATE': 'NOTIFICATION',
      'SOCIAL_INTERACTION': 'NOTIFICATION',
      'OTHER': 'NOTIFICATION',
    };

    return mapping[intent] || 'NOTIFICATION';
  }

  /**
   * Determine privacy sensitivity level
   */
  private static determineSensitivity(
    classification: NotificationClassification
  ): 'PUBLIC' | 'PRIVATE' | 'SENSITIVE' | 'CRITICAL' {
    // Security always critical
    if (classification.category === 'SECURITY') {
      return 'CRITICAL';
    }

    // Finance and health are sensitive
    if (classification.category === 'FINANCE' || 
        classification.category === 'HEALTH') {
      return 'SENSITIVE';
    }

    // Communication can be private
    if (classification.category === 'COMMUNICATION') {
      return 'PRIVATE';
    }

    // Everything else is private by default
    return 'PRIVATE';
  }

  /**
   * Build notification event data
   */
  private static buildEventData(
    raw: NormalizedNotification,
    extracted: StructuredNotificationData
  ): NotificationEventData {
    return {
      package: raw.sourceApp,
      appName: raw.appName,
      title: raw.title,
      text: raw.body,
      category: extracted.organization?.name,
      timestamp: raw.timestamp.toISOString(),
      priority: raw.priority,
    };
  }

  /**
   * Build a structured life event for context graph
   * This is what the backend reasoning engine will process
   */
  static buildStructuredEvent(
    event: LifeEvent,
    extractedData: StructuredNotificationData
  ): StructuredLifeEvent {
    return {
      eventId: event.eventId,
      type: event.metadata!.notificationIntent,
      category: event.metadata!.notificationCategory,
      timestamp: event.timestamp,
      
      // Structured entities
      entities: {
        organization: extractedData.organization?.name,
        amount: extractedData.amount ? {
          value: extractedData.amount.value,
          currency: extractedData.amount.currency,
        } : undefined,
        dueDate: extractedData.dueDate?.value,
        action: extractedData.action?.type,
      },
      
      // Confidence and priority
      confidence: event.confidence || 0.5,
      priority: event.metadata!.notificationPriority,
      
      // Privacy
      privacy: {
        rawContentUploaded: !event.privacy.localOnly,
        sensitivity: event.privacy.sensitivity,
      },
      
      // Source
      source: {
        type: 'NOTIFICATION',
        app: event.metadata!.sourceAppName,
        package: event.metadata!.sourcePackage,
      },
    };
  }
}

/**
 * Structured life event for context graph
 */
export interface StructuredLifeEvent {
  eventId: string;
  type: string;
  category: string;
  timestamp: string;
  
  entities: {
    organization?: string;
    amount?: {
      value: number;
      currency: string;
    };
    dueDate?: string;
    action?: string;
  };
  
  confidence: number;
  priority: number;
  
  privacy: {
    rawContentUploaded: boolean;
    sensitivity: string;
  };
  
  source: {
    type: string;
    app: string;
    package: string;
  };
}
