/**
 * Calendar Context Bridge
 * 
 * Integrates Calendar Intelligence with LifeOS Context Fusion
 * Converts calendar events into LifeEvents for unified processing
 */

import Database from 'better-sqlite3';
import { EnrichedCalendarEvent, LifeCalendarEvent } from './types';
import { CalendarIntelligenceService } from './CalendarIntelligenceService';

interface LifeEvent {
  event_id: string;
  device_id: string;
  event_type: string;
  timestamp: string;
  metadata: string;
  created_at: string;
}

export class CalendarContextBridge {
  constructor(
    private db: Database.Database,
    private calendarService: CalendarIntelligenceService
  ) {}
  
  /**
   * Convert calendar event to LifeEvent
   */
  async calendarEventToLifeEvent(
    event: LifeCalendarEvent,
    deviceId: string = 'system'
  ): Promise<LifeEvent> {
    // Enrich the calendar event
    const enriched = await this.calendarService.enrichEvent(event);
    
    // Build metadata
    const metadata = {
      source: 'CALENDAR',
      calendarSource: event.source,
      
      // Event details
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      timezone: event.timezone,
      
      // Enrichment data
      eventType: enriched.eventType,
      eventTypeConfidence: enriched.eventTypeConfidence,
      
      // Resolved entities
      people: enriched.people.map(p => ({
        personId: p.personId,
        name: p.name,
        confidence: p.confidence
      })),
      
      place: enriched.place ? {
        placeId: enriched.place.placeId,
        name: enriched.place.name,
        placeType: enriched.place.placeType,
        latitude: enriched.place.latitude,
        longitude: enriched.place.longitude,
        confidence: enriched.place.confidence
      } : null,
      
      // Intelligence
      travel: enriched.travelRequirement ? {
        required: enriched.travelRequirement.required,
        mode: enriched.travelRequirement.mode,
        durationMin: enriched.travelRequirement.estimatedDurationMin,
        distanceKm: enriched.travelRequirement.distanceKm,
        departureTime: enriched.travelRequirement.requiredDepartureTime
      } : null,
      
      preparation: enriched.preparation ? {
        required: enriched.preparation.required,
        estimatedMinutes: enriched.preparation.estimatedMinutes,
        itemCount: enriched.preparation.items.length
      } : null,
      
      documents: enriched.requiredDocuments
        .filter(d => d.required)
        .map(d => ({
          type: d.type,
          available: d.available
        })),
      
      // Scoring
      importance: enriched.importance.score,
      flexibility: enriched.flexibility.score,
      
      // Conflicts
      conflictCount: enriched.conflicts.length,
      hasConflicts: enriched.conflicts.length > 0,
      conflicts: enriched.conflicts.map(c => ({
        type: c.type,
        severity: c.severity,
        description: c.description
      }))
    };
    
    return {
      event_id: `calendar_${event.id}`,
      device_id: deviceId,
      event_type: 'CALENDAR_EVENT',
      timestamp: event.startTime,
      metadata: JSON.stringify(metadata),
      created_at: new Date().toISOString()
    };
  }
  
  /**
   * Store calendar event as LifeEvent
   */
  async storeCalendarAsLifeEvent(
    event: LifeCalendarEvent,
    deviceId: string = 'system'
  ): Promise<void> {
    const lifeEvent = await this.calendarEventToLifeEvent(event, deviceId);
    
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO life_events (
          event_id, device_id, event_type, timestamp, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        lifeEvent.event_id,
        lifeEvent.device_id,
        lifeEvent.event_type,
        lifeEvent.timestamp,
        lifeEvent.metadata,
        lifeEvent.created_at
      );
    } catch (error) {
      console.error('Error storing calendar as life event:', error);
      throw error;
    }
  }
  
  /**
   * Create context links for calendar event
   */
  async createCalendarContextLinks(enriched: EnrichedCalendarEvent): Promise<void> {
    const eventId = `calendar_${enriched.event.id}`;
    
    try {
      // Link to people
      for (const person of enriched.people) {
        this.db.prepare(`
          INSERT OR IGNORE INTO context_links (
            from_entity_id,
            to_entity_id,
            relationship_type,
            confidence,
            created_at
          ) VALUES (?, ?, ?, ?, datetime('now'))
        `).run(
          eventId,
          person.personId,
          'INVOLVES_PERSON',
          person.confidence
        );
      }
      
      // Link to place
      if (enriched.place) {
        this.db.prepare(`
          INSERT OR IGNORE INTO context_links (
            from_entity_id,
            to_entity_id,
            relationship_type,
            confidence,
            created_at
          ) VALUES (?, ?, ?, ?, datetime('now'))
        `).run(
          eventId,
          enriched.place.placeId,
          'OCCURS_AT',
          enriched.place.confidence
        );
      }
      
      // Link to organization if present
      if (enriched.organization) {
        this.db.prepare(`
          INSERT OR IGNORE INTO context_links (
            from_entity_id,
            to_entity_id,
            relationship_type,
            confidence,
            created_at
          ) VALUES (?, ?, ?, ?, datetime('now'))
        `).run(
          eventId,
          enriched.organization.organizationId,
          'ORGANIZED_BY',
          enriched.organization.confidence
        );
      }
      
      // Link to required documents
      for (const doc of enriched.requiredDocuments.filter(d => d.required && d.documentId)) {
        this.db.prepare(`
          INSERT OR IGNORE INTO context_links (
            from_entity_id,
            to_entity_id,
            relationship_type,
            confidence,
            created_at
          ) VALUES (?, ?, ?, ?, datetime('now'))
        `).run(
          eventId,
          doc.documentId,
          'REQUIRES_DOCUMENT',
          doc.confidence
        );
      }
    } catch (error) {
      console.error('Error creating calendar context links:', error);
      throw error;
    }
  }
  
  /**
   * Generate interventions for calendar conflicts
   */
  async generateCalendarInterventions(enriched: EnrichedCalendarEvent): Promise<void> {
    // Only generate interventions for upcoming events with conflicts
    const eventStart = new Date(enriched.event.startTime);
    const now = new Date();
    const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Don't generate interventions for past events or events too far in the future
    if (hoursUntilEvent < 0 || hoursUntilEvent > 168) { // 1 week
      return;
    }
    
    // Generate intervention for high-severity conflicts
    for (const conflict of enriched.conflicts) {
      if (conflict.severity === 'HIGH' || conflict.severity === 'CRITICAL') {
        await this.createIntervention({
          type: 'SCHEDULE_CONFLICT',
          priority: conflict.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          title: `Schedule Conflict: ${enriched.event.title}`,
          description: conflict.description,
          reason: conflict.reason,
          eventId: enriched.event.id,
          conflictId: conflict.conflictId,
          suggestedAction: this.generateConflictAction(conflict)
        });
      }
    }
    
    // Generate intervention for travel warnings
    if (enriched.travelRequirement?.required && hoursUntilEvent <= 2) {
      const departureTime = new Date(enriched.travelRequirement.requiredDepartureTime);
      const minutesUntilDeparture = (departureTime.getTime() - now.getTime()) / (1000 * 60);
      
      if (minutesUntilDeparture <= 30 && minutesUntilDeparture > 0) {
        await this.createIntervention({
          type: 'TRAVEL_REMINDER',
          priority: minutesUntilDeparture <= 15 ? 'HIGH' : 'MEDIUM',
          title: `Time to leave for ${enriched.event.title}`,
          description: `You should depart in ${Math.round(minutesUntilDeparture)} minutes`,
          reason: `Travel to ${enriched.place?.name} requires ${enriched.travelRequirement.estimatedDurationMin} minutes`,
          eventId: enriched.event.id,
          suggestedAction: `Leave by ${departureTime.toLocaleTimeString()}`
        });
      }
    }
    
    // Generate intervention for missing documents
    const missingDocs = enriched.requiredDocuments.filter(d => d.required && !d.available);
    if (missingDocs.length > 0 && hoursUntilEvent <= 24) {
      await this.createIntervention({
        type: 'MISSING_DOCUMENTS',
        priority: hoursUntilEvent <= 6 ? 'HIGH' : 'MEDIUM',
        title: `Documents needed for ${enriched.event.title}`,
        description: `${missingDocs.length} required document(s) not available`,
        reason: `Missing: ${missingDocs.map(d => d.name).join(', ')}`,
        eventId: enriched.event.id,
        suggestedAction: 'Gather required documents'
      });
    }
    
    // Generate intervention for incomplete preparation
    if (enriched.preparation?.required && hoursUntilEvent <= 12) {
      const incompleteTasks = enriched.preparation.items.filter(item => !item.completed);
      
      if (incompleteTasks.length > 0) {
        await this.createIntervention({
          type: 'PREPARATION_REQUIRED',
          priority: hoursUntilEvent <= 3 ? 'HIGH' : 'MEDIUM',
          title: `Preparation for ${enriched.event.title}`,
          description: `${incompleteTasks.length} preparation task(s) incomplete`,
          reason: incompleteTasks.map(t => t.description).join('; '),
          eventId: enriched.event.id,
          suggestedAction: 'Complete preparation tasks'
        });
      }
    }
  }
  
  /**
   * Create intervention
   */
  private async createIntervention(intervention: {
    type: string;
    priority: string;
    title: string;
    description: string;
    reason: string;
    eventId: string;
    conflictId?: string;
    suggestedAction: string;
  }): Promise<void> {
    try {
      const interventionId = `intervention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.db.prepare(`
        INSERT INTO interventions (
          intervention_id,
          type,
          priority,
          title,
          description,
          reason,
          suggested_action,
          status,
          metadata,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, datetime('now'))
      `).run(
        interventionId,
        intervention.type,
        intervention.priority,
        intervention.title,
        intervention.description,
        intervention.reason,
        intervention.suggestedAction,
        JSON.stringify({
          source: 'CALENDAR_INTELLIGENCE',
          eventId: intervention.eventId,
          conflictId: intervention.conflictId
        })
      );
    } catch (error) {
      console.error('Error creating intervention:', error);
    }
  }
  
  /**
   * Generate conflict action text
   */
  private generateConflictAction(conflict: any): string {
    switch (conflict.type) {
      case 'TRAVEL_CONFLICT':
        return 'Consider rescheduling one event or adjusting departure time';
      case 'TEMPORAL_CONFLICT':
        return 'Events overlap - reschedule or cancel one event';
      case 'PREPARATION_CONFLICT':
        return 'Allow more time for preparation or simplify requirements';
      case 'PERSON_CONFLICT':
        return 'Same person double-booked - resolve scheduling conflict';
      case 'RESOURCE_CONFLICT':
        return 'Required resources conflict - plan accordingly';
      default:
        return 'Review and resolve conflict';
    }
  }
  
  /**
   * Sync calendar events to context system
   */
  async syncCalendarToContext(events: LifeCalendarEvent[], deviceId: string = 'system'): Promise<{
    synced: number;
    failed: number;
    interventions: number;
  }> {
    let synced = 0;
    let failed = 0;
    let interventions = 0;
    
    for (const event of events) {
      try {
        // Store event
        await this.calendarService.storeEvent(event);
        
        // Convert to LifeEvent
        await this.storeCalendarAsLifeEvent(event, deviceId);
        
        // Enrich and create context links
        const enriched = await this.calendarService.enrichEvent(event);
        await this.createCalendarContextLinks(enriched);
        
        // Generate interventions if needed
        await this.generateCalendarInterventions(enriched);
        
        if (enriched.conflicts.length > 0) {
          interventions += enriched.conflicts.length;
        }
        
        synced++;
      } catch (error) {
        console.error(`Error syncing calendar event ${event.id}:`, error);
        failed++;
      }
    }
    
    return { synced, failed, interventions };
  }
  
  /**
   * Get calendar context for a specific time window
   */
  async getCalendarContext(startTime: string, endTime: string): Promise<{
    events: EnrichedCalendarEvent[];
    totalConflicts: number;
    totalTravelTimeMin: number;
    feasibilityScore: number;
  }> {
    const analysis = await this.calendarService.analyzeSchedule(
      startTime.split('T')[0],
      endTime.split('T')[0]
    );
    
    const totalConflicts = analysis.dailyAnalysis.reduce((sum, day) => sum + day.conflicts.length, 0);
    const totalTravelTimeMin = analysis.dailyAnalysis.reduce(
      (sum, day) => sum + day.analysis.totalTravelTimeMin,
      0
    );
    const avgFeasibility = analysis.summary.averageFeasibility;
    
    return {
      events: analysis.events,
      totalConflicts,
      totalTravelTimeMin,
      feasibilityScore: avgFeasibility
    };
  }
}
