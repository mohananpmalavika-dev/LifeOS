import Database from 'better-sqlite3';
import path from 'path';
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
  private db: Database.Database;
  private readonly MATCH_THRESHOLD = 0.75;
  private readonly TIME_WINDOW_DAYS = 30;

  constructor(db?: Database.Database) {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'lifeos.db');
    this.db = db || new Database(dbPath);
  }

  /**
   * Find matching entity for an event from SQLite storage
   */
  async findMatchingEntity(event: LifeEvent): Promise<NotificationEntity | null> {
    const intent = event.metadata?.notificationIntent;
    const category = event.metadata?.notificationCategory;

    const candidates = this.getCandidates(event);
    if (candidates.length === 0) return null;

    const matches: EntityMatch[] = [];
    for (const candidate of candidates) {
      const match = this.scoreMatch(event, candidate);
      if (match.matchScore >= this.MATCH_THRESHOLD) {
        matches.push(match);
      }
    }

    if (matches.length === 0) return null;

    matches.sort((a, b) => b.matchScore - a.matchScore);
    const bestMatch = matches[0];

    const row = this.db.prepare(`
      SELECT id as entityId, type, category, name, organization, amount, currency, due_date as dueDate, status, confidence, first_seen as firstSeen, last_updated as lastUpdated, update_count as updateCount, metadata
      FROM notification_entities
      WHERE id = ?
    `).get(bestMatch.entityId) as any;

    if (!row) return null;
    return {
      ...row,
      relatedEvents: [],
      linkedTasks: [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }

  private getCandidates(event: LifeEvent): NotificationEntity[] {
    const category = event.metadata?.notificationCategory || 'COMMUNICATION';

    try {
      const rows = this.db.prepare(`
        SELECT id as entityId, type, category, name, organization, amount, currency, due_date as dueDate, status, confidence, first_seen as firstSeen, last_updated as lastUpdated, update_count as updateCount, metadata
        FROM notification_entities
        WHERE category = ? AND status NOT IN ('PAID', 'COMPLETED')
        ORDER BY last_updated DESC
        LIMIT 20
      `).all(category) as any[];

      return rows.map(r => ({
        ...r,
        relatedEvents: [],
        linkedTasks: [],
        metadata: r.metadata ? JSON.parse(r.metadata) : {}
      }));
    } catch {
      return [];
    }
  }

  private scoreMatch(event: LifeEvent, entity: NotificationEntity): EntityMatch {
    let score = 0;
    const reasons: string[] = [];

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
      }
    }

    // 3. Category match (2 points)
    if (event.metadata?.notificationCategory === entity.category) {
      score += 2;
      reasons.push('category match');
    }

    const normalizedScore = Math.min(1.0, score / 7);
    return {
      entityId: entity.entityId,
      matchScore: normalizedScore,
      matchReasons: reasons,
    };
  }

  private stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) return 0.85;
    return 0.0;
  }
}
