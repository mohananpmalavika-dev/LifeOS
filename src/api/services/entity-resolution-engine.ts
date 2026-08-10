/**
 * Entity Resolution Engine
 * 
 * Resolves notification events to existing entities in the knowledge graph.
 * Prevents duplicate entities (e.g., 3 separate "Electricity Bill" entities).
 * 
 * Resolution considers:
 * - Entity type (BILL, APPOINTMENT, etc.)
 * - Merchant/provider name
 * - Amount (for bills/transactions)
 * - Date proximity
 * - Source app
 * - Semantic similarity
 */

import type { LifeEvent } from '../../types/life-event.js';

export interface EntityMatch {
  entityId: string;
  matchScore: number;
  matchReasons: string[];
}

export interface NotificationEntity {
  entityId: string;
  type: string;
  category: string;
  name?: string;
  organization?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
  status: string;
  relatedEvents: string[];
  linkedTasks: string[];
  firstSeen: string;
  lastUpdated: string;
  updateCount: number;
  confidence: number;
  metadata: Record<string, any>;
}

export class EntityResolutionEngine {
  private entities: Map<string, NotificationEntity>;
  private readonly MATCH_THRESHOLD = 0.75;
  private readonly TIME_WINDOW_DAYS = 30;

  constructor() {
    this.entities = new Map();
  }

  /**
   * Find matching entity for an event
   * Returns null if no match found (should create new entity)
   */
  async findMatchingEntity(event: LifeEvent): Promise<NotificationEntity | null> {
    const intent = event.metadata?.notificationIntent;
    const category = event.metadata?.notificationCategory;

    console.log(`  🔍 Searching for matching entity (intent: ${intent}, category: ${category})`);

    // Get all candidates of same type
    const candidates = this.getCandidates(event);

    if (candidates.length === 0) {
      console.log(`  ✗ No candidates found`);
      return null;
    }

    console.log(`  Found ${candidates.length} candidates`);

    // Score each candidate
    const matches: EntityMatch[] = [];
    for (const candidate of candidates) {
      const match = this.scoreMatch(event, candidate);
      if (match.matchScore >= this.MATCH_THRESHOLD) {
        matches.push(match);
      }
    }

    if (matches.length === 0) {
      console.log(`  ✗ No matches above threshold (${this.MATCH_THRESHOLD})`);
      return null;
    }

    // Sort by score and take best match
    matches.sort((a, b) => b.matchScore - a.matchScore);
    const bestMatch = matches[0];

    console.log(`  ✓ Matched entity ${bestMatch.entityId} (score: ${bestMatch.matchScore.toFixed(2)})`);
    console.log(`    Reasons: ${bestMatch.matchReasons.join(', ')}`);

    return this.entities.get(bestMatch.entityId) || null;
  }

  /**
   * Get candidate entities for matching
   */
  private getCandidates(event: LifeEvent): NotificationEntity[] {
    const intent = event.metadata?.notificationIntent;
    const category = event.metadata?.notificationCategory;
    const eventTime = new Date(event.timestamp);
    const windowStart = new Date(eventTime);
    windowStart.setDate(windowStart.getDate() - this.TIME_WINDOW_DAYS);

    const candidates: NotificationEntity[] = [];

    for (const entity of this.entities.values()) {
      // Must be same category
      if (entity.category !== category) {
        continue;
      }

      // Must be within time window
      const entityTime = new Date(entity.lastUpdated);
      if (entityTime < windowStart) {
        continue;
      }

      // Must be pending/active (not completed)
      if (entity.status === 'PAID' || entity.status === 'COMPLETED') {
        continue;
      }

      candidates.push(entity);
    }

    return candidates;
  }

  /**
   * Score how well an event matches an entity
   */
  private scoreMatch(event: LifeEvent, entity: NotificationEntity): EntityMatch {
    let score = 0;
    const reasons: string[] = [];
    const maxScore = 10;

    // 1. Organization/provider match (3 points)
    if (event.metadata?.organization && entity.organization) {
      const similarity = this.stringSimilarity(
        event.metadata.organization.toLowerCase(),
        entity.organization.toLowerCase()
      );

      if (similarity > 0.8) {
        score += 3;
        reasons.push('organization match');
      } else if (similarity > 0.5) {
        score += 1.5;
        reasons.push('partial organization match');
      }
    }

    // 2. Amount match (2 points)
    if (event.metadata?.amount && entity.amount) {
      if (Math.abs(event.metadata.amount - entity.amount) < 1) {
        score += 2;
        reasons.push('exact amount match');
      } else if (Math.abs(event.metadata.amount - entity.amount) < entity.amount * 0.05) {
        score += 1;
        reasons.push('close amount match');
      }
    }

    // 3. Date proximity (2 points)
    if (event.metadata?.dueDate && entity.dueDate) {
      const daysDiff = this.daysDifference(
        event.metadata.dueDate,
        entity.dueDate
      );

      if (daysDiff === 0) {
        score += 2;
        reasons.push('same due date');
      } else if (daysDiff <= 3) {
        score += 1;
        reasons.push('close due date');
      }
    }

    // 4. Source app match (1 point)
    if (event.metadata?.sourcePackage && 
        entity.metadata?.sourcePackage === event.metadata.sourcePackage) {
      score += 1;
      reasons.push('same app');
    }

    // 5. Intent progression (2 points)
    // e.g., BILL_DUE → REMINDER → PAYMENT is a natural progression
    if (this.isIntentProgression(entity.metadata?.notificationIntent, event.metadata?.notificationIntent)) {
      score += 2;
      reasons.push('intent progression');
    }

    // Normalize score to 0-1
    const normalizedScore = score / maxScore;

    return {
      entityId: entity.entityId,
      matchScore: normalizedScore,
      matchReasons: reasons,
    };
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   */
  private stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Simple similarity based on common words
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    
    let common = 0;
    for (const word of words1) {
      if (words2.has(word)) common++;
    }

    const similarity = (2 * common) / (words1.size + words2.size);
    return similarity;
  }

  /**
   * Calculate days difference between two dates
   */
  private daysDifference(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if intents represent a natural progression
   */
  private isIntentProgression(previousIntent?: string, currentIntent?: string): boolean {
    if (!previousIntent || !currentIntent) return false;

    const progressions: Record<string, string[]> = {
      'BILL_DUE': ['REMINDER', 'PAYMENT'],
      'REMINDER': ['PAYMENT'],
      'APPOINTMENT': ['REMINDER', 'CONFIRMATION'],
      'DELIVERY': ['UPDATE', 'DELIVERED'],
      'ORDER': ['SHIPPED', 'DELIVERY', 'DELIVERED'],
    };

    const validNext = progressions[previousIntent] || [];
    return validNext.includes(currentIntent);
  }

  /**
   * Register a new entity
   */
  registerEntity(entity: NotificationEntity): void {
    this.entities.set(entity.entityId, entity);
  }

  /**
   * Update an existing entity
   */
  updateEntity(entityId: string, updates: Partial<NotificationEntity>): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      Object.assign(entity, updates);
    }
  }

  /**
   * Get all entities
   */
  getAllEntities(): NotificationEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get entities by category
   */
  getEntitiesByCategory(category: string): NotificationEntity[] {
    return Array.from(this.entities.values())
      .filter(e => e.category === category);
  }

  /**
   * Get entities by status
   */
  getEntitiesByStatus(status: string): NotificationEntity[] {
    return Array.from(this.entities.values())
      .filter(e => e.status === status);
  }

  /**
   * Clean up old completed entities
   */
  cleanupOldEntities(daysOld: number = 90): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    let removed = 0;
    for (const [entityId, entity] of this.entities.entries()) {
      if (entity.status === 'COMPLETED' || entity.status === 'PAID') {
        const lastUpdated = new Date(entity.lastUpdated);
        if (lastUpdated < cutoff) {
          this.entities.delete(entityId);
          removed++;
        }
      }
    }

    console.log(`🧹 Cleaned up ${removed} old entities`);
    return removed;
  }

  /**
   * Get entity resolution statistics
   */
  getStats(): {
    totalEntities: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    averageEventsPerEntity: number;
  } {
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalEvents = 0;

    for (const entity of this.entities.values()) {
      byCategory[entity.category] = (byCategory[entity.category] || 0) + 1;
      byStatus[entity.status] = (byStatus[entity.status] || 0) + 1;
      totalEvents += entity.relatedEvents.length;
    }

    return {
      totalEntities: this.entities.size,
      byCategory,
      byStatus,
      averageEventsPerEntity: this.entities.size > 0 ? totalEvents / this.entities.size : 0,
    };
  }
}
