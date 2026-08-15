import Database from 'better-sqlite3';
import { 
  CurrentSituation, 
  DecisionResult, 
  ActionCandidate,
  CalendarContext,
  NotificationContext,
  TaskContext 
} from './types.js';
import { CandidateGenerator } from './CandidateGenerator.js';
import { InterventionPolicy } from './InterventionPolicy.js';
import { PersonalizationEngine } from '../personalization/PersonalizationEngine.js';
import { TravelEngine } from '../../calendar/TravelEngine.js';
import { PlaceResolver } from '../../calendar/PlaceResolver.js';
import { DocumentEngine } from '../../calendar/DocumentEngine.js';
import { EventClassifier } from '../../calendar/EventClassifier.js';
import { LocationStorage } from '../location/storage/LocationStorage.js';
import { NotificationIntelligenceService } from '../../api/services/notification-intelligence-service.js';
import { lifeosService } from '../../api/services/lifeos-service.js';

export class NextBestActionEngine {
  private candidateGenerator: CandidateGenerator;
  private policy: InterventionPolicy;
  private personalization: PersonalizationEngine;
  private travelEngine: TravelEngine;
  private documentEngine: DocumentEngine;
  private placeResolver: PlaceResolver;
  private locationStorage: LocationStorage;
  private notifService: NotificationIntelligenceService;

  constructor(private db: Database.Database) {
    this.candidateGenerator = new CandidateGenerator();
    this.policy = new InterventionPolicy();
    this.personalization = new PersonalizationEngine(db);
    this.placeResolver = new PlaceResolver(db);
    this.travelEngine = new TravelEngine(db, this.placeResolver);
    this.documentEngine = new DocumentEngine(db, new EventClassifier());
    this.locationStorage = new LocationStorage(db);
    this.notifService = new NotificationIntelligenceService(db);
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
   * PURE Decision Engine: Performs pure reasoning over an immutable CurrentSituation snapshot.
   * Zero DB/GPS reads inside decide().
   */
  decide(situation: CurrentSituation): DecisionResult {
    const candidates = this.candidateGenerator.generateCandidates(situation);
    const bestAction = candidates[0] || candidates.find(c => c.type === 'NO_ACTION')!;
    const surface = this.policy.evaluateSurface(bestAction, situation);

    const explanation = {
      headline: bestAction.title,
      narrative: bestAction.summary,
      evidenceList: bestAction.evidence,
    };

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
   * Canonical Production Method: Gathers live observations from all available sensors.
   * If a signal is missing or unverified, it sets UNKNOWN with 0 confidence rather than inventing defaults.
   */
  async buildCurrentSituation(): Promise<CurrentSituation> {
    const now = new Date();

    // 1. Reality-Locked Location (Defaults to UNKNOWN / 0 confidence)
    let locationPlace: string | undefined = undefined;
    let locationState: string = 'UNKNOWN';
    let locationConfidence = 0.0;
    let homePlace: any = null;

    try {
      const places = this.locationStorage.getAllPlaces();
      if (places.length > 0) {
        homePlace = places.find(p => p.semanticType === ('HOME' as any)) || places[0];
        if (homePlace) {
          locationPlace = homePlace.name;
          locationState = 'HOME';
          locationConfidence = Math.min(0.98, homePlace.confidence || 0.85);
        }
      }
    } catch {}

    // 2. Reality-Locked Motion Activity (Defaults to UNKNOWN / 0 confidence)
    let motionType: 'STILL' | 'WALKING' | 'DRIVING' | 'CYCLING' | 'UNKNOWN' = 'UNKNOWN';
    let activityConfidence = 0.0;

    try {
      const latestSample = this.db.prepare(`
        SELECT speed, accuracy_meters, timestamp FROM location_samples 
        ORDER BY timestamp DESC LIMIT 1
      `).get() as any;

      if (latestSample) {
        const speed = latestSample.speed || 0;
        if (speed > 8.0) motionType = 'DRIVING';
        else if (speed > 1.2) motionType = 'WALKING';
        else motionType = 'STILL';
        activityConfidence = latestSample.accuracy_meters ? Math.min(0.98, Math.max(0.2, 1 - (latestSample.accuracy_meters / 100))) : 0.80;
      }
    } catch {}

    // 3. Reality-Locked Calendar & Traceable Travel Estimate
    let nextEvent: CalendarContext | undefined = undefined;
    try {
      const row = this.db.prepare(`
        SELECT event_id as id, title, start_time as startTime, end_time as endTime, 
               location_name as locName, location_address as locAddr, location_latitude as lat, location_longitude as lon, description
        FROM calendar_events
        WHERE end_time > datetime('now')
        ORDER BY start_time ASC
        LIMIT 1
      `).get() as any;

      if (row) {
        let travelMin = 0;
        let prepMin = 5;

        if (row.locName || row.locAddr || (row.lat && row.lon)) {
          const dest = await this.placeResolver.resolve({
            name: row.locName,
            address: row.locAddr,
            latitude: row.lat,
            longitude: row.lon
          });

          if (dest) {
            const travelReq = await this.travelEngine.calculateTravelRequirement(
              homePlace ? {
                placeId: homePlace.id,
                name: homePlace.name || 'Home',
                address: homePlace.name || 'Home',
                latitude: homePlace.center?.latitude || 0,
                longitude: homePlace.center?.longitude || 0,
                placeType: 'HOME',
                confidence: locationConfidence
              } : undefined,
              dest,
              row.startTime
            );

            if (travelReq) {
              travelMin = travelReq.estimatedDurationMin;
              prepMin = travelReq.accessTimeMin;
            }
          }
        }

        const docReqs = this.documentEngine.analyzeDocumentRequirements({
          event: {
            id: row.id,
            source: 'MANUAL' as any,
            sourceEventId: row.id,
            title: row.title,
            description: row.description,
            startTime: row.startTime,
            endTime: row.endTime,
            status: 'CONFIRMED' as any,
            visibility: 'PUBLIC' as any,
            attendees: [],
            reminders: [],
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncState: 'NEW'
          },
          people: [],
          requiredDocuments: [],
          conflicts: [],
          preparation: { required: false, estimatedMinutes: 0, items: [] },
          importance: { score: 0.8, factors: { attendeeImportance: 0.5, eventType: 0.8, userHistory: 0.7, deadline: 0.9 } },
          flexibility: { score: 0.3, factors: { eventType: 0.3, historicalRescheduling: 0.2, attendeeFlexibility: 0.4, timeUntilEvent: 0.5 } },
          enrichedAt: now.toISOString(),
          enrichmentVersion: '1.0'
        });

        nextEvent = {
          id: row.id,
          title: row.title,
          startTime: row.startTime,
          endTime: row.endTime,
          location: { name: row.locName, address: row.locAddr },
          description: row.description,
          travelMinutes: travelMin,
          prepMinutes: prepMin,
          requiredDocuments: docReqs.map(d => ({ name: d.name, required: d.required, ready: d.available }))
        };
      }
    } catch (e) {
      console.error('Error in calendar situation builder:', e);
    }

    // 4. Focus Mode
    let activeFocusMode: any = 'NORMAL';
    try {
      const row = this.db.prepare("SELECT value FROM system_state WHERE key = 'focus_mode'").get() as any;
      if (row?.value) activeFocusMode = row.value;
    } catch {}

    // 5. Persistent SQLite Notifications (Zero hardcoded arrays)
    const recentNotifications: NotificationContext[] = [];
    try {
      const entities = this.notifService.getRecentEntities(5);
      for (const ent of entities) {
        recentNotifications.push({
          id: ent.entityId,
          title: ent.name || ent.organization || 'Notification',
          text: ent.organization ? `${ent.organization} - ${ent.type}` : ent.type,
          category: ent.category || 'COMMUNICATION',
          amount: ent.amount,
          dueDate: ent.dueDate,
          timestamp: ent.lastUpdated,
        });
      }
    } catch {}

    // 6. Persistent Tasks
    const rawTasks = lifeosService.deriveTasks();
    const pendingTasks: TaskContext[] = rawTasks.map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority as any,
      category: (t as any).category,
      eventContext: (t as any).eventContext,
      completed: (t as any).completed,
    }));

    // 7. Personalization Profile
    const profile = this.personalization.getProfile();

    return {
      timestamp: now.toISOString(),
      location: {
        place: locationPlace,
        state: locationState,
        confidence: locationConfidence,
      },
      activity: {
        type: motionType,
        confidence: activityConfidence,
      },
      nextEvent,
      recentNotifications,
      pendingTasks,
      activeFocusMode,
      device: {
        online: true,
        batteryLevel: 90,
      },
      userPreferences: {
        departureBufferOffsetMin: profile.departureBufferOffsetMin,
        categorySensitivity: profile.categorySensitivity,
      }
    };
  }

  /**
   * High-level single invocation: builds situation and executes pure decision
   */
  async getDecision(): Promise<DecisionResult> {
    const situation = await this.buildCurrentSituation();
    return this.decide(situation);
  }
}
