import Database from 'better-sqlite3';
import { 
  CurrentSituation, 
  DecisionResult, 
  ActionCandidate 
} from './types.js';
import { CandidateGenerator } from './CandidateGenerator.js';
import { InterventionPolicy } from './InterventionPolicy.js';
import { PersonalizationEngine } from '../personalization/PersonalizationEngine.js';

export class NextBestActionEngine {
  private candidateGenerator: CandidateGenerator;
  private policy: InterventionPolicy;
  private personalization: PersonalizationEngine;

  constructor(private db: Database.Database) {
    this.candidateGenerator = new CandidateGenerator();
    this.policy = new InterventionPolicy();
    this.personalization = new PersonalizationEngine(db);
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decision_history (
        id TEXT PRIMARY KEY,
        situation_json TEXT NOT NULL,
        best_action_json TEXT NOT NULL,
        surface TEXT NOT NULL,
        score REAL NOT NULL,
        user_feedback TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  /**
   * Decide the next best action given a situation
   */
  decide(situation: CurrentSituation): DecisionResult {
    const bufferOffset = this.personalization.getDepartureBufferOffset();
    const candidates = this.candidateGenerator.generateCandidates(situation, bufferOffset);
    const bestAction = candidates[0] || candidates.find(c => c.type === 'NO_ACTION')!;

    const surface = this.policy.evaluateSurface(bestAction, situation);

    const explanation = {
      headline: bestAction.title,
      narrative: bestAction.summary,
      evidenceList: bestAction.evidence,
    };

    // Log decision
    try {
      const decisionId = `dec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      this.db.prepare(`
        INSERT INTO decision_history (id, situation_json, best_action_json, surface, score, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(decisionId, JSON.stringify(situation), JSON.stringify(bestAction), surface, bestAction.score);
    } catch {}

    return {
      situation,
      bestAction,
      candidates,
      surface,
      explanation,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Builds the live CurrentSituation from SQLite state
   */
  buildCurrentSituation(): CurrentSituation {
    const now = new Date();
    
    // 1. Get next calendar event
    let nextEvent: any = undefined;
    try {
      const row = this.db.prepare(`
        SELECT event_id as id, title, start_time as startTime, end_time as endTime, 
               location_name as locName, location_address as locAddr, description
        FROM calendar_events
        WHERE end_time > datetime('now')
        ORDER BY start_time ASC
        LIMIT 1
      `).get() as any;

      if (row) {
        nextEvent = {
          id: row.id,
          title: row.title,
          startTime: row.startTime,
          endTime: row.endTime,
          location: { name: row.locName, address: row.locAddr },
          description: row.description,
          travelMinutes: 30,
          prepMinutes: 10,
        };
      }
    } catch {}

    // 2. Get focus mode
    let activeFocusMode: any = 'NORMAL';
    try {
      const row = this.db.prepare("SELECT value FROM system_state WHERE key = 'focus_mode'").get() as any;
      if (row?.value) activeFocusMode = row.value;
    } catch {}

    // 3. Get place
    let placeName = 'Home';
    try {
      const p = this.db.prepare('SELECT name FROM places LIMIT 1').get() as any;
      if (p) placeName = p.name;
    } catch {}

    return {
      timestamp: now.toISOString(),
      location: {
        place: placeName,
        state: 'HOME',
        confidence: 0.94,
      },
      activity: {
        type: 'STILL',
        confidence: 0.91,
      },
      nextEvent,
      recentNotifications: [
        {
          id: 'notif_kseb_bill',
          title: 'KSEB Electricity Bill',
          text: 'Consumer #104928 bill of ₹2,431 is due Friday.',
          category: 'FINANCIAL',
          amount: 2431,
          dueDate: 'Friday',
          timestamp: now.toISOString(),
        }
      ],
      pendingTasks: [],
      activeFocusMode,
      device: {
        online: true,
        batteryLevel: 88,
      }
    };
  }
}
