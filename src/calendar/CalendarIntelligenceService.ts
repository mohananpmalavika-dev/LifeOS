/**
 * Calendar Intelligence Service
 * 
 * Main orchestrator for calendar intelligence features
 */

import Database from 'better-sqlite3';
import { 
  LifeCalendarEvent, 
  EnrichedCalendarEvent,
  ScheduleFeasibility,
  ImportanceScore,
  FlexibilityScore
} from './types';
import { EventClassifier } from './EventClassifier';
import { PersonResolver } from './PersonResolver';
import { PlaceResolver } from './PlaceResolver';
import { TravelEngine } from './TravelEngine';
import { ConflictEngine } from './ConflictEngine';
import { PreparationEngine } from './PreparationEngine';
import { DocumentEngine } from './DocumentEngine';
import { ScheduleAnalyzer } from './ScheduleAnalyzer';

export class CalendarIntelligenceService {
  private eventClassifier: EventClassifier;
  private personResolver: PersonResolver;
  private placeResolver: PlaceResolver;
  private travelEngine: TravelEngine;
  private conflictEngine: ConflictEngine;
  private preparationEngine: PreparationEngine;
  private documentEngine: DocumentEngine;
  private scheduleAnalyzer: ScheduleAnalyzer;
  
  constructor(private db: Database.Database) {
    this.eventClassifier = new EventClassifier();
    this.personResolver = new PersonResolver(db);
    this.placeResolver = new PlaceResolver(db);
    this.travelEngine = new TravelEngine(db, this.placeResolver);
    this.conflictEngine = new ConflictEngine(this.travelEngine);
    this.preparationEngine = new PreparationEngine(db, this.eventClassifier);
    this.documentEngine = new DocumentEngine(db, this.eventClassifier);
    this.scheduleAnalyzer = new ScheduleAnalyzer(this.conflictEngine);
  }
  
  /**
   * Enrich a calendar event with intelligence
   */
  async enrichEvent(event: LifeCalendarEvent): Promise<EnrichedCalendarEvent> {
    // Classify event type
    const classification = this.eventClassifier.classify(event);
    
    // Resolve people
    const people = await this.personResolver.resolveMultiple([
      ...(event.organizer ? [event.organizer] : []),
      ...event.attendees
    ]);
    
    // Resolve place
    let place = null;
    if (event.location) {
      place = await this.placeResolver.resolve(event.location);
    }
    
    // Calculate importance and flexibility
    const importance = this.calculateImportance(event, classification.type, people);
    const flexibility = this.calculateFlexibility(event, classification.type);
    
    // Build initial enriched event
    const enrichedEvent: EnrichedCalendarEvent = {
      event,
      eventType: classification.type,
      eventTypeConfidence: classification.confidence,
      people,
      place: place || undefined,
      requiredDocuments: [],
      conflicts: [],
      importance,
      flexibility,
      enrichedAt: new Date().toISOString(),
      enrichmentVersion: '1.0'
    };
    
    // Calculate travel requirements
    if (place) {
      const travelRequirement = await this.travelEngine.calculateTravelRequirement(
        undefined, // Will infer origin
        place,
        event.startTime,
        undefined
      );
      
      if (travelRequirement) {
        enrichedEvent.travelRequirement = travelRequirement;
      }
    }
    
    // Analyze document requirements
    enrichedEvent.requiredDocuments = this.documentEngine.analyzeDocumentRequirements(enrichedEvent);
    
    // Generate preparation plan
    enrichedEvent.preparation = this.preparationEngine.generatePreparationPlan(enrichedEvent);
    
    return enrichedEvent;
  }
  
  /**
   * Enrich multiple events
   */
  async enrichEvents(events: LifeCalendarEvent[]): Promise<EnrichedCalendarEvent[]> {
    const enriched: EnrichedCalendarEvent[] = [];
    
    for (const event of events) {
      const enrichedEvent = await this.enrichEvent(event);
      enriched.push(enrichedEvent);
    }
    
    // Detect conflicts across all events
    const conflicts = this.conflictEngine.detectConflicts(enriched);
    
    // Assign conflicts to events
    for (const enrichedEvent of enriched) {
      enrichedEvent.conflicts = conflicts.filter(
        c => c.event1Id === enrichedEvent.event.id || c.event2Id === enrichedEvent.event.id
      );
    }
    
    return enriched;
  }
  
  /**
   * Calculate event importance score
   */
  private calculateImportance(
    event: LifeCalendarEvent,
    eventType: any,
    people: any[]
  ): ImportanceScore {
    const profile = this.eventClassifier.getProfile(eventType);
    
    // Base importance from event type
    let attendeeImportance = 0.5;
    
    // Check if important people are attending
    if (people.length > 0) {
      const maxPersonImportance = Math.max(...people.map(p => {
        // Higher importance for people with more interactions
        const history = this.personResolver.getInteractionHistory(p.personId);
        return Math.min(1, history.totalInteractions / 50);
      }));
      
      attendeeImportance = maxPersonImportance;
    }
    
    // Event type importance
    const eventTypeImportance = profile.defaultImportance;
    
    // User history importance (to be learned)
    const userHistoryImportance = 0.5;
    
    // Deadline importance (closer events are more important)
    const eventStart = new Date(event.startTime);
    const now = new Date();
    const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    let deadlineImportance = 0.5;
    if (hoursUntilEvent <= 24) {
      deadlineImportance = 0.9;
    } else if (hoursUntilEvent <= 72) {
      deadlineImportance = 0.7;
    }
    
    // Weighted average
    const score = (
      attendeeImportance * 0.3 +
      eventTypeImportance * 0.3 +
      userHistoryImportance * 0.2 +
      deadlineImportance * 0.2
    );
    
    return {
      score,
      factors: {
        attendeeImportance,
        eventType: eventTypeImportance,
        userHistory: userHistoryImportance,
        deadline: deadlineImportance
      }
    };
  }
  
  /**
   * Calculate event flexibility score
   */
  private calculateFlexibility(event: LifeCalendarEvent, eventType: any): FlexibilityScore {
    const profile = this.eventClassifier.getProfile(eventType);
    
    // Base flexibility from event type
    const eventTypeFlexibility = profile.defaultFlexibility;
    
    // Historical rescheduling (to be learned)
    const historicalRescheduling = 0.5;
    
    // Attendee flexibility
    let attendeeFlexibility = 0.7;
    if (event.attendees.length > 5) {
      attendeeFlexibility = 0.3; // Hard to reschedule with many people
    }
    
    // Time until event
    const eventStart = new Date(event.startTime);
    const now = new Date();
    const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    let timeFlexibility = 0.5;
    if (hoursUntilEvent > 168) { // More than a week
      timeFlexibility = 0.9;
    } else if (hoursUntilEvent > 48) {
      timeFlexibility = 0.7;
    } else if (hoursUntilEvent < 6) {
      timeFlexibility = 0.1;
    }
    
    // Weighted average
    const score = (
      eventTypeFlexibility * 0.4 +
      historicalRescheduling * 0.2 +
      attendeeFlexibility * 0.2 +
      timeFlexibility * 0.2
    );
    
    return {
      score,
      factors: {
        eventType: eventTypeFlexibility,
        historicalRescheduling,
        attendeeFlexibility,
        timeUntilEvent: timeFlexibility
      }
    };
  }
  
  /**
   * Analyze schedule for a date range
   */
  async analyzeSchedule(startDate: string, endDate: string): Promise<{
    events: EnrichedCalendarEvent[];
    dailyAnalysis: ScheduleFeasibility[];
    summary: {
      averageFeasibility: number;
      totalConflicts: number;
      totalWarnings: number;
      busiestDay: string;
      mostRelaxedDay: string;
    };
  }> {
    // Get events in date range
    const events = this.getEventsInRange(startDate, endDate);
    
    // Enrich events
    const enrichedEvents = await this.enrichEvents(events);
    
    // Analyze each day
    const dailyAnalysis: ScheduleFeasibility[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const dayAnalysis = this.scheduleAnalyzer.analyzeDailySchedule(dateStr, enrichedEvents);
      dailyAnalysis.push(dayAnalysis);
    }
    
    // Calculate summary
    const totalConflicts = dailyAnalysis.reduce((sum, day) => sum + day.conflicts.length, 0);
    const totalWarnings = dailyAnalysis.reduce((sum, day) => sum + day.warnings.length, 0);
    const averageFeasibility = dailyAnalysis.reduce((sum, day) => sum + day.score, 0) / dailyAnalysis.length;
    
    const sortedByScore = [...dailyAnalysis].sort((a, b) => a.score - b.score);
    const busiestDay = sortedByScore[0]?.date || startDate;
    const mostRelaxedDay = sortedByScore[sortedByScore.length - 1]?.date || startDate;
    
    return {
      events: enrichedEvents,
      dailyAnalysis,
      summary: {
        averageFeasibility,
        totalConflicts,
        totalWarnings,
        busiestDay,
        mostRelaxedDay
      }
    };
  }
  
  /**
   * Get events in date range from database
   */
  private getEventsInRange(startDate: string, endDate: string): LifeCalendarEvent[] {
    try {
      const results = this.db.prepare(`
        SELECT 
          event_id as id,
          source,
          source_event_id as sourceEventId,
          title,
          description,
          start_time as startTime,
          end_time as endTime,
          timezone,
          location_name,
          location_address,
          location_latitude,
          location_longitude,
          organizer_name,
          organizer_email,
          status,
          visibility,
          created_at as createdAt,
          updated_at as updatedAt,
          sync_state as syncState
        FROM calendar_events
        WHERE start_time >= ? AND start_time <= ?
        ORDER BY start_time ASC
      `).all(startDate, endDate) as any[];
      
      return results.map(row => this.mapRowToEvent(row));
    } catch (error) {
      console.error('Error getting events in range:', error);
      return [];
    }
  }
  
  /**
   * Map database row to LifeCalendarEvent
   */
  private mapRowToEvent(row: any): LifeCalendarEvent {
    return {
      id: row.id,
      source: row.source,
      sourceEventId: row.sourceEventId,
      title: row.title,
      description: row.description,
      startTime: row.startTime,
      endTime: row.endTime,
      timezone: row.timezone,
      location: row.location_name ? {
        name: row.location_name,
        address: row.location_address,
        latitude: row.location_latitude,
        longitude: row.location_longitude
      } : undefined,
      organizer: row.organizer_name ? {
        name: row.organizer_name,
        email: row.organizer_email
      } : undefined,
      attendees: [], // Would need to join with attendees table
      status: row.status,
      visibility: row.visibility,
      reminders: [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      syncState: row.syncState
    };
  }
  
  /**
   * Store calendar event
   */
  async storeEvent(event: LifeCalendarEvent): Promise<void> {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO calendar_events (
          event_id, source, source_event_id,
          title, description,
          start_time, end_time, timezone,
          location_name, location_address, location_latitude, location_longitude,
          organizer_name, organizer_email,
          status, visibility,
          created_at, updated_at, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.id,
        event.source,
        event.sourceEventId,
        event.title,
        event.description,
        event.startTime,
        event.endTime,
        event.timezone,
        event.location?.name,
        event.location?.address,
        event.location?.latitude,
        event.location?.longitude,
        event.organizer?.name,
        event.organizer?.email,
        event.status,
        event.visibility,
        event.createdAt,
        event.updatedAt,
        event.syncState
      );
    } catch (error) {
      console.error('Error storing calendar event:', error);
      throw error;
    }
  }
  
  /**
   * Delete calendar event
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      this.db.prepare(`
        DELETE FROM calendar_events WHERE event_id = ?
      `).run(eventId);
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw error;
    }
  }
  
  /**
   * Get enriched event by ID
   */
  async getEnrichedEvent(eventId: string): Promise<EnrichedCalendarEvent | null> {
    try {
      const row = this.db.prepare(`
        SELECT * FROM calendar_events WHERE event_id = ?
      `).get(eventId) as any;
      
      if (!row) return null;
      
      const event = this.mapRowToEvent(row);
      return await this.enrichEvent(event);
    } catch (error) {
      console.error('Error getting enriched event:', error);
      return null;
    }
  }
}
