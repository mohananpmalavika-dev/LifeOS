/**
 * Conflict Detection Engine
 * 
 * Detects multiple types of conflicts between calendar events:
 * - Temporal overlaps
 * - Travel conflicts
 * - Preparation conflicts
 * - Resource conflicts
 * - Person conflicts
 */

import { 
  EnrichedCalendarEvent, 
  ScheduleConflict, 
  ConflictType, 
  ConflictSeverity,
  ConflictResolution,
  ScheduleWindow
} from './types.js';
import { TravelEngine } from './TravelEngine.js';

export class ConflictEngine {
  constructor(private travelEngine: TravelEngine) {}
  
  /**
   * Detect all conflicts between events
   */
  detectConflicts(events: EnrichedCalendarEvent[]): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = [];
    
    // Sort events by start time
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime()
    );
    
    // Check each pair of events
    for (let i = 0; i < sortedEvents.length; i++) {
      for (let j = i + 1; j < sortedEvents.length; j++) {
        const event1 = sortedEvents[i];
        const event2 = sortedEvents[j];
        
        // Build schedule windows
        const window1 = this.buildScheduleWindow(event1);
        const window2 = this.buildScheduleWindow(event2);
        
        // Check for temporal conflict
        const temporalConflict = this.checkTemporalConflict(window1, window2, event1, event2);
        if (temporalConflict) conflicts.push(temporalConflict);
        
        // Check for travel conflict
        const travelConflict = this.checkTravelConflict(event1, event2, window1, window2);
        if (travelConflict) conflicts.push(travelConflict);
        
        // Check for preparation conflict
        const prepConflict = this.checkPreparationConflict(event1, event2, window1, window2);
        if (prepConflict) conflicts.push(prepConflict);
        
        // Check for person conflict
        const personConflict = this.checkPersonConflict(event1, event2);
        if (personConflict) conflicts.push(personConflict);
        
        // Only check nearby events for resource conflicts
        if (j === i + 1) {
          const resourceConflict = this.checkResourceConflict(event1, event2);
          if (resourceConflict) conflicts.push(resourceConflict);
        }
      }
    }
    
    return conflicts;
  }
  
  /**
   * Build schedule window including preparation and travel time
   */
  private buildScheduleWindow(event: EnrichedCalendarEvent): ScheduleWindow {
    const eventStart = new Date(event.event.startTime);
    const eventEnd = new Date(event.event.endTime);
    
    let windowStart = eventStart;
    let windowEnd = eventEnd;
    
    let preparationStart: Date | undefined;
    let travelStart: Date | undefined;
    let travelEnd: Date | undefined;
    
    // Add preparation time before event
    if (event.preparation?.required && event.preparation.estimatedMinutes > 0) {
      preparationStart = new Date(eventStart.getTime() - event.preparation.estimatedMinutes * 60000);
      windowStart = preparationStart;
    }
    
    // Add travel time before event
    if (event.travelRequirement?.required) {
      const departureTime = new Date(event.travelRequirement.requiredDepartureTime);
      travelStart = departureTime;
      
      if (!preparationStart || departureTime < preparationStart) {
        windowStart = departureTime;
      }
    }
    
    // Add travel time after event (if applicable)
    if (event.travelRequirement?.required) {
      travelEnd = new Date(eventEnd.getTime() + event.travelRequirement.estimatedDurationMin * 60000);
      windowEnd = travelEnd;
    }
    
    return {
      eventId: event.event.id,
      eventStart: eventStart.toISOString(),
      eventEnd: eventEnd.toISOString(),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      preparationStart: preparationStart?.toISOString(),
      travelStart: travelStart?.toISOString(),
      eventActualStart: eventStart.toISOString(),
      eventActualEnd: eventEnd.toISOString(),
      travelEnd: travelEnd?.toISOString()
    };
  }
  
  /**
   * Check for temporal overlap
   */
  private checkTemporalConflict(
    window1: ScheduleWindow,
    window2: ScheduleWindow,
    event1: EnrichedCalendarEvent,
    event2: EnrichedCalendarEvent
  ): ScheduleConflict | null {
    const start1 = new Date(window1.eventStart);
    const end1 = new Date(window1.eventEnd);
    const start2 = new Date(window2.eventStart);
    const end2 = new Date(window2.eventEnd);
    
    // Check if events overlap
    const hasOverlap = start1 < end2 && start2 < end1;
    
    if (!hasOverlap) return null;
    
    // Calculate overlap duration
    const overlapStart = start1 > start2 ? start1 : start2;
    const overlapEnd = end1 < end2 ? end1 : end2;
    const overlapMin = (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
    
    // Determine severity based on overlap percentage
    const duration1 = (end1.getTime() - start1.getTime()) / 60000;
    const duration2 = (end2.getTime() - start2.getTime()) / 60000;
    const overlapPercent = overlapMin / Math.min(duration1, duration2);
    
    let severity: ConflictSeverity;
    if (overlapPercent > 0.75) severity = ConflictSeverity.CRITICAL;
    else if (overlapPercent > 0.5) severity = ConflictSeverity.HIGH;
    else if (overlapPercent > 0.25) severity = ConflictSeverity.MEDIUM;
    else severity = ConflictSeverity.LOW;
    
    const resolutions = this.generateTemporalResolutions(event1, event2);
    
    return {
      conflictId: `temporal_${event1.event.id}_${event2.event.id}`,
      type: ConflictType.TEMPORAL_CONFLICT,
      severity,
      confidence: 1.0,
      event1Id: event1.event.id,
      event2Id: event2.event.id,
      description: `Events overlap by ${Math.round(overlapMin)} minutes`,
      reason: `"${event1.event.title}" and "${event2.event.title}" are scheduled at overlapping times`,
      resolutionOptions: resolutions
    };
  }
  
  /**
   * Check for travel conflict
   */
  private checkTravelConflict(
    event1: EnrichedCalendarEvent,
    event2: EnrichedCalendarEvent,
    window1: ScheduleWindow,
    window2: ScheduleWindow
  ): ScheduleConflict | null {
    // Only check consecutive events
    const end1 = new Date(window1.eventEnd);
    const start2 = new Date(window2.eventStart);
    
    // If events don't need travel or are far apart, no conflict
    const gapMin = (start2.getTime() - end1.getTime()) / 60000;
    if (gapMin > 240) return null; // 4 hours gap is sufficient
    
    // Check if both events have locations
    if (!event1.place || !event2.place) return null;
    
    // Check if same location
    if (event1.place.placeId === event2.place.placeId) return null;
    
    // Calculate required travel time
    const travelRequirement = event2.travelRequirement;
    if (!travelRequirement) return null;
    
    // Check feasibility
    const feasibility = this.travelEngine.isTravelFeasible(
      travelRequirement,
      gapMin
    );
    
    if (feasibility.feasible) {
      // Check if buffer is sufficient
      if (feasibility.bufferMin && feasibility.bufferMin < 10) {
        // Tight but feasible
        const resolutions = this.generateTravelResolutions(event1, event2, travelRequirement);
        
        return {
          conflictId: `travel_tight_${event1.event.id}_${event2.event.id}`,
          type: ConflictType.TRAVEL_CONFLICT,
          severity: ConflictSeverity.MEDIUM,
          confidence: travelRequirement.confidence,
          event1Id: event1.event.id,
          event2Id: event2.event.id,
          description: `Tight transition with only ${Math.round(feasibility.bufferMin)} minutes buffer`,
          reason: `Travel from ${event1.place.name} to ${event2.place.name} requires ${travelRequirement.requiredDurationMin} minutes, leaving minimal buffer`,
          resolutionOptions: resolutions
        };
      }
      
      return null;
    }
    
    // Travel not feasible
    const resolutions = this.generateTravelResolutions(event1, event2, travelRequirement);
    
    return {
      conflictId: `travel_${event1.event.id}_${event2.event.id}`,
      type: ConflictType.TRAVEL_CONFLICT,
      severity: ConflictSeverity.HIGH,
      confidence: travelRequirement.confidence,
      event1Id: event1.event.id,
      event2Id: event2.event.id,
      description: `Insufficient time for travel between events`,
      reason: `Travel from ${event1.place.name} to ${event2.place.name} requires ${travelRequirement.requiredDurationMin} minutes, but only ${Math.round(gapMin)} minutes available (${Math.round(feasibility.shortfallMin!)} minutes short)`,
      resolutionOptions: resolutions
    };
  }
  
  /**
   * Check for preparation conflict
   */
  private checkPreparationConflict(
    event1: EnrichedCalendarEvent,
    event2: EnrichedCalendarEvent,
    window1: ScheduleWindow,
    window2: ScheduleWindow
  ): ScheduleConflict | null {
    // Check if second event needs preparation
    if (!event2.preparation?.required) return null;
    
    const end1 = new Date(window1.windowEnd);
    const prepStart2 = window2.preparationStart ? new Date(window2.preparationStart) : new Date(window2.eventStart);
    
    // Check if preparation time overlaps with previous event's window
    if (end1 <= prepStart2) return null;
    
    const overlapMin = (end1.getTime() - prepStart2.getTime()) / 60000;
    
    if (overlapMin <= 0) return null;
    
    const resolutions = this.generatePreparationResolutions(event1, event2);
    
    return {
      conflictId: `preparation_${event1.event.id}_${event2.event.id}`,
      type: ConflictType.PREPARATION_CONFLICT,
      severity: overlapMin > 30 ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM,
      confidence: 0.75,
      event1Id: event1.event.id,
      event2Id: event2.event.id,
      description: `Insufficient time for event preparation`,
      reason: `"${event2.event.title}" requires ${event2.preparation.estimatedMinutes} minutes of preparation, but schedule allows insufficient time`,
      resolutionOptions: resolutions
    };
  }
  
  /**
   * Check for person conflict (same person in multiple places)
   */
  private checkPersonConflict(
    event1: EnrichedCalendarEvent,
    event2: EnrichedCalendarEvent
  ): ScheduleConflict | null {
    // Check if same person is organizer/attendee in both events
    const people1 = new Set([
      ...(event1.event.organizer ? [event1.event.organizer.email || event1.event.organizer.name] : []),
      ...event1.event.attendees.map(a => a.email || a.name)
    ].filter(Boolean));
    
    const people2 = new Set([
      ...(event2.event.organizer ? [event2.event.organizer.email || event2.event.organizer.name] : []),
      ...event2.event.attendees.map(a => a.email || a.name)
    ].filter(Boolean));
    
    const commonPeople = [...people1].filter(p => people2.has(p));
    
    if (commonPeople.length === 0) return null;
    
    // Check if events overlap or are very close
    const start1 = new Date(event1.event.startTime);
    const end1 = new Date(event1.event.endTime);
    const start2 = new Date(event2.event.startTime);
    const end2 = new Date(event2.event.endTime);
    
    const hasOverlap = start1 < end2 && start2 < end1;
    const gapMin = (start2.getTime() - end1.getTime()) / 60000;
    
    if (!hasOverlap && gapMin > 60) return null;
    
    return {
      conflictId: `person_${event1.event.id}_${event2.event.id}`,
      type: ConflictType.PERSON_CONFLICT,
      severity: hasOverlap ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM,
      confidence: 0.85,
      event1Id: event1.event.id,
      event2Id: event2.event.id,
      description: `Same person scheduled for multiple events`,
      reason: `${commonPeople.length} person(s) are attending both "${event1.event.title}" and "${event2.event.title}"`,
      resolutionOptions: []
    };
  }
  
  /**
   * Check for resource conflict
   */
  private checkResourceConflict(
    event1: EnrichedCalendarEvent,
    event2: EnrichedCalendarEvent
  ): ScheduleConflict | null {
    // Check for required documents that might conflict
    const docs1 = new Set(event1.requiredDocuments.filter(d => d.required).map(d => d.type));
    const docs2 = new Set(event2.requiredDocuments.filter(d => d.required).map(d => d.type));
    
    // Check if same physical document needed at overlapping times
    const commonDocs = [...docs1].filter(d => docs2.has(d));
    
    if (commonDocs.length === 0) return null;
    
    // Check if events are close enough that this matters
    const end1 = new Date(event1.event.endTime);
    const start2 = new Date(event2.event.startTime);
    const gapMin = (start2.getTime() - end1.getTime()) / 60000;
    
    // If gap is large enough to retrieve document, no conflict
    if (gapMin > 120) return null;
    
    return {
      conflictId: `resource_${event1.event.id}_${event2.event.id}`,
      type: ConflictType.RESOURCE_CONFLICT,
      severity: ConflictSeverity.MEDIUM,
      confidence: 0.70,
      event1Id: event1.event.id,
      event2Id: event2.event.id,
      description: `Same resources required for both events`,
      reason: `Both events require: ${commonDocs.join(', ')}`,
      resolutionOptions: []
    };
  }
  
  /**
   * Generate temporal conflict resolutions
   */
  private generateTemporalResolutions(
    event1: EnrichedCalendarEvent,
    event2: EnrichedCalendarEvent
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];
    
    // Option 1: Move second event later
    if (event2.flexibility.score > 0.5) {
      resolutions.push({
        resolutionId: `move_event2_${event2.event.id}`,
        type: 'MOVE_EVENT',
        description: `Reschedule "${event2.event.title}" to a later time`,
        feasibility: event2.flexibility.score,
        impact: 0.3
      });
    }
    
    // Option 2: Move first event earlier
    if (event1.flexibility.score > 0.5) {
      resolutions.push({
        resolutionId: `move_event1_${event1.event.id}`,
        type: 'MOVE_EVENT',
        description: `Reschedule "${event1.event.title}" to an earlier time`,
        feasibility: event1.flexibility.score,
        impact: 0.4
      });
    }
    
    // Option 3: Cancel less important event
    if (event1.importance.score < event2.importance.score) {
      resolutions.push({
        resolutionId: `cancel_event1_${event1.event.id}`,
        type: 'CANCEL_EVENT',
        description: `Cancel "${event1.event.title}"`,
        feasibility: event1.flexibility.score * 0.5,
        impact: 0.8
      });
    } else {
      resolutions.push({
        resolutionId: `cancel_event2_${event2.event.id}`,
        type: 'CANCEL_EVENT',
        description: `Cancel "${event2.event.title}"`,
        feasibility: event2.flexibility.score * 0.5,
        impact: 0.8
      });
    }
    
    return resolutions;
  }
  
  /**
   * Generate travel conflict resolutions
   */
  private generateTravelResolutions(
    event1: EnrichedCalendarEvent,
    event2: EnrichedCalendarEvent,
    travelReq: any
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];
    
    // Option 1: Adjust second event start time
    if (event2.flexibility.score > 0.4) {
      resolutions.push({
        resolutionId: `adjust_event2_${event2.event.id}`,
        type: 'ADJUST_TIME',
        description: `Start "${event2.event.title}" ${Math.ceil(travelReq.requiredDurationMin / 15) * 15} minutes later`,
        feasibility: event2.flexibility.score,
        impact: 0.3
      });
    }
    
    // Option 2: End first event earlier
    if (event1.flexibility.score > 0.4) {
      resolutions.push({
        resolutionId: `adjust_event1_${event1.event.id}`,
        type: 'ADJUST_TIME',
        description: `End "${event1.event.title}" 15-30 minutes earlier`,
        feasibility: event1.flexibility.score,
        impact: 0.4
      });
    }
    
    // Option 3: Attend second event remotely
    if (event2.eventType && ['WORK_MEETING', 'PERSONAL_MEETING'].includes(event2.eventType)) {
      resolutions.push({
        resolutionId: `remote_event2_${event2.event.id}`,
        type: 'REMOTE_ATTEND',
        description: `Attend "${event2.event.title}" remotely`,
        feasibility: 0.7,
        impact: 0.2
      });
    }
    
    // Option 4: Notify organizer of conflict
    if (event2.event.organizer) {
      resolutions.push({
        resolutionId: `notify_organizer_${event2.event.id}`,
        type: 'NOTIFY_ORGANIZER',
        description: `Inform organizer of "${event2.event.title}" about travel conflict`,
        feasibility: 0.9,
        impact: 0.1
      });
    }
    
    return resolutions;
  }
  
  /**
   * Generate preparation conflict resolutions
   */
  private generatePreparationResolutions(
    event1: EnrichedCalendarEvent,
    event2: EnrichedCalendarEvent
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];
    
    // Move second event later
    if (event2.flexibility.score > 0.5) {
      resolutions.push({
        resolutionId: `move_event2_prep_${event2.event.id}`,
        type: 'MOVE_EVENT',
        description: `Reschedule "${event2.event.title}" to allow preparation time`,
        feasibility: event2.flexibility.score,
        impact: 0.4
      });
    }
    
    // Shorten first event
    if (event1.flexibility.score > 0.5) {
      resolutions.push({
        resolutionId: `shorten_event1_${event1.event.id}`,
        type: 'ADJUST_TIME',
        description: `Shorten "${event1.event.title}" to allow more preparation time`,
        feasibility: event1.flexibility.score * 0.7,
        impact: 0.5
      });
    }
    
    return resolutions;
  }
  
  /**
   * Get conflict severity score (0-1)
   */
  getSeverityScore(severity: ConflictSeverity): number {
    const scores = {
      [ConflictSeverity.LOW]: 0.25,
      [ConflictSeverity.MEDIUM]: 0.5,
      [ConflictSeverity.HIGH]: 0.75,
      [ConflictSeverity.CRITICAL]: 1.0
    };
    return scores[severity];
  }
  
  /**
   * Prioritize conflicts by severity and confidence
   */
  prioritizeConflicts(conflicts: ScheduleConflict[]): ScheduleConflict[] {
    return conflicts.sort((a, b) => {
      const scoreA = this.getSeverityScore(a.severity) * a.confidence;
      const scoreB = this.getSeverityScore(b.severity) * b.confidence;
      return scoreB - scoreA;
    });
  }
}
