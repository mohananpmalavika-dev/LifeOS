import Database from 'better-sqlite3';

export interface PersonalizationProfile {
  departureBufferOffsetMin: number;
  categorySensitivity: Record<string, number>;
  totalFeedbackCount: number;
  positiveFeedbackCount: number;
  lastUpdated: string;
}

export interface FeedbackRecord {
  id: string;
  interventionId: string;
  category: string;
  useful: boolean;
  reason?: string;
  impactDescription: string;
  timestamp: string;
}

export class PersonalizationEngine {
  private db: Database.Database;
  private profile: PersonalizationProfile;

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeTables();
    this.profile = this.loadProfile();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_personalization_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        departure_buffer_offset_min INTEGER DEFAULT 0,
        category_sensitivity_json TEXT DEFAULT '{}',
        total_feedback_count INTEGER DEFAULT 0,
        positive_feedback_count INTEGER DEFAULT 0,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS feedback_events (
        id TEXT PRIMARY KEY,
        intervention_id TEXT NOT NULL,
        category TEXT NOT NULL,
        useful INTEGER NOT NULL,
        reason TEXT,
        impact_description TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private loadProfile(): PersonalizationProfile {
    try {
      const row = this.db.prepare('SELECT * FROM user_personalization_profile WHERE id = 1').get() as any;
      if (row) {
        let categorySensitivity: Record<string, number> = {};
        try {
          categorySensitivity = JSON.parse(row.category_sensitivity_json || '{}');
        } catch {}

        return {
          departureBufferOffsetMin: row.departure_buffer_offset_min || 0,
          categorySensitivity,
          totalFeedbackCount: row.total_feedback_count || 0,
          positiveFeedbackCount: row.positive_feedback_count || 0,
          lastUpdated: row.last_updated || new Date().toISOString(),
        };
      }
    } catch (e) {
      console.error('Error loading personalization profile:', e);
    }

    const defaultProfile: PersonalizationProfile = {
      departureBufferOffsetMin: 0,
      categorySensitivity: {
        COMMUTE: 1.0,
        HEALTHCARE: 1.1,
        FINANCIAL: 1.0,
        SHOPPING: 0.8,
        MEETING: 1.0,
      },
      totalFeedbackCount: 0,
      positiveFeedbackCount: 0,
      lastUpdated: new Date().toISOString(),
    };

    this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  private saveProfile(profile: PersonalizationProfile): void {
    this.profile = profile;
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO user_personalization_profile (
          id, departure_buffer_offset_min, category_sensitivity_json,
          total_feedback_count, positive_feedback_count, last_updated
        ) VALUES (1, ?, ?, ?, ?, datetime('now'))
      `).run(
        profile.departureBufferOffsetMin,
        JSON.stringify(profile.categorySensitivity),
        profile.totalFeedbackCount,
        profile.positiveFeedbackCount
      );
    } catch (e) {
      console.error('Error saving personalization profile:', e);
    }
  }

  recordFeedback(params: {
    interventionId: string;
    category?: string;
    useful: boolean;
    reason?: string;
  }): { success: boolean; impactDescription: string; currentBufferOffset: number } {
    const { interventionId, useful, reason } = params;
    const category = (params.category || 'GENERAL').toUpperCase();
    let impactDescription = '';

    const currentProfile = { ...this.profile };
    currentProfile.totalFeedbackCount += 1;
    if (useful) currentProfile.positiveFeedbackCount += 1;

    if (category.includes('COMMUTE') || category.includes('TRAVEL') || reason?.toLowerCase().includes('early') || reason?.toLowerCase().includes('late')) {
      if (!useful && reason?.toLowerCase().includes('early')) {
        currentProfile.departureBufferOffsetMin = Math.max(-15, currentProfile.departureBufferOffsetMin - 5);
        impactDescription = `Learned: Reduced departure buffer by 5 min (offset: ${currentProfile.departureBufferOffsetMin}m).`;
      } else if (!useful && reason?.toLowerCase().includes('late')) {
        currentProfile.departureBufferOffsetMin = Math.min(25, currentProfile.departureBufferOffsetMin + 5);
        impactDescription = `Learned: Increased departure buffer by 5 min (offset: +${currentProfile.departureBufferOffsetMin}m).`;
      } else if (useful) {
        impactDescription = `Reinforced departure timing accuracy for future commitments.`;
      } else {
        impactDescription = `Recorded feedback for travel intelligence tuning.`;
      }
    } else {
      const currentSens = currentProfile.categorySensitivity[category] || 1.0;
      if (!useful) {
        const newSens = Math.max(0.4, Number((currentSens - 0.15).toFixed(2)));
        currentProfile.categorySensitivity[category] = newSens;
        impactDescription = `Learned: Raised threshold for ${category} alerts (sensitivity adjusted to ${newSens}).`;
      } else {
        const newSens = Math.min(1.5, Number((currentSens + 0.1).toFixed(2)));
        currentProfile.categorySensitivity[category] = newSens;
        impactDescription = `Reinforced priority for ${category} insights (sensitivity adjusted to ${newSens}).`;
      }
    }

    this.saveProfile(currentProfile);

    try {
      const id = `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      this.db.prepare(`
        INSERT INTO feedback_events (id, intervention_id, category, useful, reason, impact_description, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, interventionId, category, useful ? 1 : 0, reason || null, impactDescription);
    } catch (e) {
      console.error('Error logging feedback event:', e);
    }

    return {
      success: true,
      impactDescription,
      currentBufferOffset: currentProfile.departureBufferOffsetMin,
    };
  }

  getProfile(): PersonalizationProfile {
    return this.profile;
  }

  getDepartureBufferOffset(): number {
    return this.profile.departureBufferOffsetMin;
  }

  getRecentFeedbackEvents(limit = 10): FeedbackRecord[] {
    try {
      const rows = this.db.prepare(`
        SELECT id, intervention_id as interventionId, category, useful, reason, impact_description as impactDescription, timestamp
        FROM feedback_events
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(limit) as any[];

      return rows.map(r => ({
        ...r,
        useful: r.useful === 1,
      }));
    } catch {
      return [];
    }
  }
}
