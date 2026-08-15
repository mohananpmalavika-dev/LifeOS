/**
 * Schedule Analyzer
 * 
 * Builds schedule graphs and calculates daily feasibility scores
 */

import { 
  EnrichedCalendarEvent, 
  ScheduleFeasibility, 
  ScheduleWarning, 
  ScheduleConflict,
  ConflictSeverity,
  ScheduleWindow
} from './types.js';
import { ConflictEngine } from './ConflictEngine.js';

export class ScheduleAnalyzer {
  constructor(private conflictEngine: ConflictEngine) {}
  
  /**
   * Analyze daily schedule feasibility
   */
  analyzeDailySchedule(date: string, events: EnrichedCalendarEvent[]): ScheduleFeasibility {
    // Filter events for the specific date
    const dateEvents = this.filterEventsForDate(date, events);
    
    if (dateEvents.length === 0) {
      return {
        date,
        score: 1.0,
        events: [],
        conflicts: [],
        warnings: [],
        analysis: {
          totalEvents: 0,
          totalConflicts: 0,
          totalTravelTimeMin: 0,
          totalPreparationMin: 0,
          availableBufferMin: 0
        }
      };
    }
    
    // Detect conflicts
    const conflicts = this.conflictEngine.detectConflicts(dateEvents);
    
    // Generate warnings
    const warnings = this.generateWarnings(dateEvents, conflicts);
    
    // Calculate metrics
    const analysis = this.calculateScheduleMetrics(dateEvents, conflicts);
    
    // Calculate feasibility score
    const score = this.calculateFeasibilityScore(dateEvents, conflicts, warnings);
    
    return {
      date,
      score,
      events: dateEvents.map(e => e.event.id),
      conflicts,
      warnings,
      analysis
    };
  }
  
  /**
   * Filter events for a specific date
   */
  private filterEventsForDate(date: string, events: EnrichedCalendarEvent[]): EnrichedCalendarEvent[] {
    const targetDate = new Date(date);
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
    
    return events.filter(event => {
      const eventStart = new Date(event.event.startTime);
      const eventEnd = new Date(event.event.endTime);
      
      // Include events that start or end on this day, or span this day
      return (
        (eventStart >= dayStart && eventStart <= dayEnd) ||
        (eventEnd >= dayStart && eventEnd <= dayEnd) ||
        (eventStart < dayStart && eventEnd > dayEnd)
      );
    });
  }
  
  /**
   * Generate schedule warnings
   */
  private generateWarnings(events: EnrichedCalendarEvent[], conflicts: ScheduleConflict[]): ScheduleWarning[] {
    const warnings: ScheduleWarning[] = [];
    
    // Sort events by start time
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime()
    );
    
    // Check for tight transitions
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const event1 = sortedEvents[i];
      const event2 = sortedEvents[i + 1];
      
      const end1 = new Date(event1.event.endTime);
      const start2 = new Date(event2.event.startTime);
      const gapMin = (start2.getTime() - end1.getTime()) / 60000;
      
      // Check if transition is tight (less than 15 minutes)
      if (gapMin < 15 && gapMin > 0) {
        warnings.push({
          type: 'TIGHT_TRANSITION',
          severity: gapMin < 5 ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM,
          description: `Only ${Math.round(gapMin)} minutes between events`,
          eventIds: [event1.event.id, event2.event.id]
        });
      }
      
      // Check if travel is risky
      if (event2.travelRequirement?.required) {
        const requiredTime = event2.travelRequirement.requiredDurationMin;
        
        if (gapMin < requiredTime * 1.2) { // Less than 20% buffer
          warnings.push({
            type: 'TRAVEL_RISK',
            severity: gapMin < requiredTime ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM,
            description: `Tight travel window: ${Math.round(gapMin)} min available, ${requiredTime} min needed`,
            eventIds: [event1.event.id, event2.event.id]
          });
        }
      }
    }
    
    // Check for missing preparation
    for (const event of sortedEvents) {
      if (event.preparation?.required) {
        const incompleteTasks = event.preparation.items.filter(item => !item.completed);
        
        if (incompleteTasks.length > 0) {
          const eventStart = new Date(event.event.startTime);
          const now = new Date();
          const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);
          
          if (hoursUntilEvent <= 24 && hoursUntilEvent > 0) {
            warnings.push({
              type: 'MISSING_PREPARATION',
              severity: hoursUntilEvent < 6 ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM,
              description: `${incompleteTasks.length} preparation task(s) incomplete`,
              eventIds: [event.event.id]
            });
          }
        }
      }
    }
    
    // Check for insufficient buffer
    const totalEventTime = sortedEvents.reduce((sum, event) => {
      const start = new Date(event.event.startTime);
      const end = new Date(event.event.endTime);
      return sum + (end.getTime() - start.getTime()) / 60000;
    }, 0);
    
    const totalTravelTime = sortedEvents.reduce((sum, event) => {
      return sum + (event.travelRequirement?.requiredDurationMin || 0);
    }, 0);
    
    const totalScheduledTime = totalEventTime + totalTravelTime;
    
    // Assuming 14-hour active day (7 AM - 9 PM)
    const availableTime = 14 * 60;
    const bufferTime = availableTime - totalScheduledTime;
    
    if (bufferTime < 60 && sortedEvents.length > 2) {
      warnings.push({
        type: 'INSUFFICIENT_BUFFER',
        severity: bufferTime < 30 ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM,
        description: `Only ${Math.round(bufferTime)} minutes of buffer time in schedule`,
        eventIds: sortedEvents.map(e => e.event.id)
      });
    }
    
    return warnings;
  }
  
  /**
   * Calculate schedule metrics
   */
  private calculateScheduleMetrics(events: EnrichedCalendarEvent[], conflicts: ScheduleConflict[]): {
    totalEvents: number;
    totalConflicts: number;
    totalTravelTimeMin: number;
    totalPreparationMin: number;
    availableBufferMin: number;
  } {
    const totalEvents = events.length;
    const totalConflicts = conflicts.length;
    
    const totalTravelTimeMin = events.reduce((sum, event) => {
      return sum + (event.travelRequirement?.estimatedDurationMin || 0);
    }, 0);
    
    const totalPreparationMin = events.reduce((sum, event) => {
      return sum + (event.preparation?.estimatedMinutes || 0);
    }, 0);
    
    // Calculate total scheduled time
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime()
    );
    
    let totalScheduledMin = 0;
    
    for (const event of sortedEvents) {
      const start = new Date(event.event.startTime);
      const end = new Date(event.event.endTime);
      totalScheduledMin += (end.getTime() - start.getTime()) / 60000;
    }
    
    // Calculate available buffer time
    const availableTime = 14 * 60; // 14-hour day
    const usedTime = totalScheduledMin + totalTravelTimeMin;
    const availableBufferMin = Math.max(0, availableTime - usedTime);
    
    return {
      totalEvents,
      totalConflicts,
      totalTravelTimeMin,
      totalPreparationMin,
      availableBufferMin
    };
  }
  
  /**
   * Calculate feasibility score (0-1)
   */
  private calculateFeasibilityScore(
    events: EnrichedCalendarEvent[],
    conflicts: ScheduleConflict[],
    warnings: ScheduleWarning[]
  ): number {
    if (events.length === 0) return 1.0;
    
    let score = 1.0;
    
    // Deduct points for conflicts
    for (const conflict of conflicts) {
      const severityPenalty: Record<ConflictSeverity, number> = {
        [ConflictSeverity.LOW]: 0.05,
        [ConflictSeverity.MEDIUM]: 0.10,
        [ConflictSeverity.HIGH]: 0.20,
        [ConflictSeverity.CRITICAL]: 0.30
      };
      
      score -= severityPenalty[conflict.severity] * conflict.confidence;
    }
    
    // Deduct points for warnings
    for (const warning of warnings) {
      const warningSeverityPenalty: Record<ConflictSeverity, number> = {
        [ConflictSeverity.LOW]: 0.02,
        [ConflictSeverity.MEDIUM]: 0.05,
        [ConflictSeverity.HIGH]: 0.10,
        [ConflictSeverity.CRITICAL]: 0.15
      };
      
      score -= warningSeverityPenalty[warning.severity];
    }
    
    // Deduct points for schedule density
    const sortedEvents = [...events].sort((a, b) => 
      new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime()
    );
    
    if (sortedEvents.length > 0) {
      const firstStart = new Date(sortedEvents[0].event.startTime);
      const lastEnd = new Date(sortedEvents[sortedEvents.length - 1].event.endTime);
      const spanHours = (lastEnd.getTime() - firstStart.getTime()) / (1000 * 60 * 60);
      
      if (spanHours > 12) {
        score -= 0.05; // Long day penalty
      }
      
      if (events.length > 6) {
        score -= (events.length - 6) * 0.02; // Many events penalty
      }
    }
    
    // Deduct points for missing preparation
    const unpreparedEvents = events.filter(e => 
      e.preparation?.required && 
      e.preparation.items.some(item => !item.completed)
    );
    
    score -= unpreparedEvents.length * 0.05;
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Get schedule feasibility rating
   */
  getFeasibilityRating(score: number): string {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.75) return 'Good';
    if (score >= 0.6) return 'Fair';
    if (score >= 0.4) return 'Poor';
    return 'Critical';
  }
  
  /**
   * Analyze weekly schedule
   */
  analyzeWeeklySchedule(startDate: string, events: EnrichedCalendarEvent[]): {
    days: ScheduleFeasibility[];
    averageScore: number;
    busiestDay: string;
    mostRelaxedDay: string;
  } {
    const days: ScheduleFeasibility[] = [];
    const start = new Date(startDate);
    
    // Analyze each day of the week
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayAnalysis = this.analyzeDailySchedule(dateStr, events);
      days.push(dayAnalysis);
    }
    
    // Calculate average score
    const averageScore = days.reduce((sum, day) => sum + day.score, 0) / days.length;
    
    // Find busiest and most relaxed days
    const sortedByScore = [...days].sort((a, b) => a.score - b.score);
    const busiestDay = sortedByScore[0]?.date || startDate;
    const mostRelaxedDay = sortedByScore[sortedByScore.length - 1]?.date || startDate;
    
    return {
      days,
      averageScore,
      busiestDay,
      mostRelaxedDay
    };
  }
  
  /**
   * Find optimal meeting time
   */
  findOptimalMeetingTime(
    date: string,
    durationMin: number,
    events: EnrichedCalendarEvent[]
  ): { startTime: string; endTime: string; score: number }[] {
    const options: { startTime: string; endTime: string; score: number }[] = [];
    
    const targetDate = new Date(date);
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 9, 0, 0);
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 17, 0, 0);
    
    const dateEvents = this.filterEventsForDate(date, events);
    
    // Sort events by start time
    const sortedEvents = [...dateEvents].sort((a, b) => 
      new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime()
    );
    
    // Check gaps between events
    let currentTime = dayStart;
    
    for (const event of sortedEvents) {
      const eventStart = new Date(event.event.startTime);
      const eventEnd = new Date(event.event.endTime);
      
      // Check if there's a gap before this event
      const gapMin = (eventStart.getTime() - currentTime.getTime()) / 60000;
      
      if (gapMin >= durationMin + 30) { // Duration + 30 min buffer
        const score = this.scoreMeetingTime(currentTime, durationMin, dateEvents);
        
        const endTime = new Date(currentTime.getTime() + durationMin * 60000);
        
        options.push({
          startTime: currentTime.toISOString(),
          endTime: endTime.toISOString(),
          score
        });
      }
      
      currentTime = eventEnd > currentTime ? eventEnd : currentTime;
    }
    
    // Check gap after last event
    if (currentTime < dayEnd) {
      const gapMin = (dayEnd.getTime() - currentTime.getTime()) / 60000;
      
      if (gapMin >= durationMin) {
        const score = this.scoreMeetingTime(currentTime, durationMin, dateEvents);
        
        const endTime = new Date(currentTime.getTime() + durationMin * 60000);
        
        options.push({
          startTime: currentTime.toISOString(),
          endTime: endTime.toISOString(),
          score
        });
      }
    }
    
    // Sort by score (highest first)
    return options.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Score a potential meeting time
   */
  private scoreMeetingTime(startTime: Date, durationMin: number, existingEvents: EnrichedCalendarEvent[]): number {
    let score = 1.0;
    
    const endTime = new Date(startTime.getTime() + durationMin * 60000);
    const hour = startTime.getHours();
    
    // Prefer mid-morning or mid-afternoon
    if (hour >= 10 && hour <= 11) {
      score += 0.2; // Good morning time
    } else if (hour >= 14 && hour <= 15) {
      score += 0.15; // Good afternoon time
    } else if (hour < 9 || hour > 16) {
      score -= 0.2; // Early or late
    }
    
    // Check proximity to other events
    for (const event of existingEvents) {
      const eventStart = new Date(event.event.startTime);
      const eventEnd = new Date(event.event.endTime);
      
      const minsBefore = (startTime.getTime() - eventEnd.getTime()) / 60000;
      const minsAfter = (eventStart.getTime() - endTime.getTime()) / 60000;
      
      if (minsBefore > 0 && minsBefore < 60) {
        score -= 0.1; // Too close after another event
      }
      
      if (minsAfter > 0 && minsAfter < 60) {
        score -= 0.1; // Too close before another event
      }
    }
    
    return Math.max(0, Math.min(1, score));
  }
}
