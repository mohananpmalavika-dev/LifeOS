/**
 * Routine Engine
 * 
 * Learns user routines from historical location data.
 * Predicts likely destinations based on time, day, and patterns.
 */

import {
  RoutinePattern,
  RoutineType,
  DayPattern,
  TimeWindow,
  PlaceTransition,
  TravelMode,
  LocationConfig,
  DEFAULT_LOCATION_CONFIG,
} from '../types.js';

export interface RoutinePrediction {
  pattern: RoutinePattern;
  probability: number;
  nextPlace?: string;
  expectedTime?: Date;
}

export class RoutineEngine {
  private config: LocationConfig;
  private routines: Map<string, RoutinePattern> = new Map();
  
  constructor(config: Partial<LocationConfig> = {}) {
    this.config = { ...DEFAULT_LOCATION_CONFIG, ...config };
  }
  
  /**
   * Learn routines from historical transitions
   */
  learnFromTransitions(transitions: PlaceTransition[]): void {
    // Group transitions by pattern
    const patterns = this.groupTransitionsByPattern(transitions);
    
    // Create routine patterns
    for (const [key, group] of patterns.entries()) {
      if (group.length >= this.config.minimumOccurrencesForRoutine) {
        const pattern = this.createRoutinePattern(key, group);
        if (pattern) {
          this.routines.set(pattern.patternId, pattern);
        }
      }
    }
  }
  
  /**
   * Group transitions by pattern (from-to, day, time)
   */
  private groupTransitionsByPattern(
    transitions: PlaceTransition[]
  ): Map<string, PlaceTransition[]> {
    const patterns = new Map<string, PlaceTransition[]>();
    
    for (const transition of transitions) {
      const key = this.getPatternKey(transition);
      
      if (!patterns.has(key)) {
        patterns.set(key, []);
      }
      patterns.get(key)!.push(transition);
    }
    
    return patterns;
  }
  
  /**
   * Generate pattern key for grouping
   */
  private getPatternKey(transition: PlaceTransition): string {
    const hour = transition.departureTime.getHours();
    const day = transition.departureTime.getDay();
    const isWeekday = day >= 1 && day <= 5;
    
    // Round hour to nearest time block
    const timeBlock = Math.floor(hour / 2) * 2;
    
    return `${transition.fromPlaceId || 'unknown'}_${transition.toPlaceId || 'unknown'}_${isWeekday ? 'weekday' : 'weekend'}_${timeBlock}`;
  }
  
  /**
   * Create routine pattern from grouped transitions
   */
  private createRoutinePattern(
    key: string,
    transitions: PlaceTransition[]
  ): RoutinePattern | null {
    if (transitions.length === 0) return null;
    
    // Extract pattern components
    const [fromPlace, toPlace, dayType, timeBlock] = key.split('_');
    const isWeekday = dayType === 'weekday';
    
    // Calculate time window
    const timeWindow = this.calculateTimeWindow(transitions);
    if (!timeWindow) return null;
    
    // Calculate day pattern
    const dayPattern = this.calculateDayPattern(transitions, isWeekday);
    
    // Calculate typical duration and travel mode
    const avgDuration = this.calculateAverage(transitions.map(t => t.durationMinutes));
    const typicalTravelMode = this.findMostCommon(
      transitions.map(t => t.travelMode).filter(Boolean) as TravelMode[]
    );
    
    // Determine routine type
    const routineType = this.inferRoutineType(
      fromPlace,
      toPlace,
      timeWindow,
      isWeekday
    );
    
    // Calculate probability based on consistency
    const probability = this.calculateRoutineProbability(transitions);
    
    return {
      patternId: `routine_${key}`,
      name: this.generateRoutineName(routineType, fromPlace, toPlace),
      type: routineType,
      dayPattern,
      timeWindow,
      fromPlace: fromPlace !== 'unknown' ? fromPlace : undefined,
      toPlace: toPlace !== 'unknown' ? toPlace : undefined,
      typicalDuration: avgDuration,
      typicalTravelMode,
      occurrences: transitions.length,
      lastOccurrence: transitions[transitions.length - 1].departureTime,
      probability,
    };
  }
  
  /**
   * Calculate time window from transitions
   */
  private calculateTimeWindow(transitions: PlaceTransition[]): TimeWindow | null {
    const hours = transitions.map(t => t.departureTime.getHours());
    const minutes = transitions.map(t => t.departureTime.getMinutes());
    
    const avgHour = Math.round(this.calculateAverage(hours));
    const avgMinute = Math.round(this.calculateAverage(minutes));
    
    // Calculate flexibility (standard deviation)
    const hourVariance = this.calculateVariance(hours);
    const flexibilityMinutes = Math.sqrt(hourVariance) * 60 + 
                               this.config.routineTimeFlexibilityMinutes;
    
    return {
      startHour: avgHour,
      startMinute: avgMinute,
      endHour: avgHour,
      endMinute: avgMinute,
      flexibilityMinutes: Math.min(flexibilityMinutes, 180), // Max 3 hours flexibility
    };
  }
  
  /**
   * Calculate day pattern from transitions
   */
  private calculateDayPattern(
    transitions: PlaceTransition[],
    isWeekday: boolean
  ): DayPattern {
    const dayFrequency = new Array(7).fill(0);
    
    for (const transition of transitions) {
      const day = transition.departureTime.getDay();
      dayFrequency[day]++;
    }
    
    // Get days with significant frequency
    const threshold = transitions.length * 0.2;
    const significantDays = dayFrequency
      .map((count, day) => ({ day, count }))
      .filter(d => d.count >= threshold)
      .map(d => d.day);
    
    return {
      daysOfWeek: significantDays.length > 0 ? significantDays : (isWeekday ? [1, 2, 3, 4, 5] : [0, 6]),
      excludeHolidays: isWeekday,
    };
  }
  
  /**
   * Infer routine type
   */
  private inferRoutineType(
    fromPlace: string,
    toPlace: string,
    timeWindow: TimeWindow,
    isWeekday: boolean
  ): RoutineType {
    const hour = timeWindow.startHour;
    
    // Morning routines
    if (hour >= 6 && hour < 10) {
      if (isWeekday && toPlace.includes('work')) {
        return RoutineType.WORKDAY_COMMUTE;
      }
      return RoutineType.MORNING_ROUTINE;
    }
    
    // Evening routines
    if (hour >= 17 && hour < 21) {
      if (isWeekday && fromPlace.includes('work')) {
        return RoutineType.WORKDAY_COMMUTE;
      }
      return RoutineType.EVENING_ROUTINE;
    }
    
    // Weekend activities
    if (!isWeekday) {
      return RoutineType.WEEKEND_ACTIVITY;
    }
    
    // Weekly appointments
    if (hour >= 10 && hour < 17) {
      return RoutineType.WEEKLY_APPOINTMENT;
    }
    
    return RoutineType.CUSTOM;
  }
  
  /**
   * Generate human-readable routine name
   */
  private generateRoutineName(
    type: RoutineType,
    fromPlace: string,
    toPlace: string
  ): string {
    switch (type) {
      case RoutineType.WORKDAY_COMMUTE:
        return fromPlace.includes('home') ? 'Morning Commute' : 'Evening Commute';
      case RoutineType.MORNING_ROUTINE:
        return 'Morning Routine';
      case RoutineType.EVENING_ROUTINE:
        return 'Evening Routine';
      case RoutineType.WEEKEND_ACTIVITY:
        return 'Weekend Activity';
      case RoutineType.WEEKLY_APPOINTMENT:
        return 'Weekly Appointment';
      default:
        return `${fromPlace} → ${toPlace}`;
    }
  }
  
  /**
   * Calculate routine probability (consistency measure)
   */
  private calculateRoutineProbability(transitions: PlaceTransition[]): number {
    // Base probability on number of occurrences
    const occurrenceScore = Math.min(1.0, transitions.length / 20);
    
    // Calculate time consistency
    const hours = transitions.map(t => t.departureTime.getHours());
    const timeVariance = this.calculateVariance(hours);
    const timeConsistency = Math.max(0, 1 - timeVariance / 4); // Normalize
    
    // Calculate day consistency
    const days = transitions.map(t => t.departureTime.getDay());
    const uniqueDays = new Set(days).size;
    const dayConsistency = uniqueDays <= 2 ? 1.0 : 0.7;
    
    // Combined probability
    return occurrenceScore * 0.4 + timeConsistency * 0.4 + dayConsistency * 0.2;
  }
  
  /**
   * Predict routine for current context
   */
  predictRoutine(
    currentPlace: string | undefined,
    currentTime: Date
  ): RoutinePrediction | null {
    let bestMatch: { pattern: RoutinePattern; score: number } | null = null;
    
    for (const pattern of this.routines.values()) {
      const score = this.scoreRoutineMatch(pattern, currentPlace, currentTime);
      
      if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { pattern, score };
      }
    }
    
    if (!bestMatch) {
      return null;
    }
    
    return {
      pattern: bestMatch.pattern,
      probability: bestMatch.score,
      nextPlace: bestMatch.pattern.toPlace,
      expectedTime: this.calculateExpectedTime(bestMatch.pattern, currentTime),
    };
  }
  
  /**
   * Score how well a routine matches current context
   */
  private scoreRoutineMatch(
    pattern: RoutinePattern,
    currentPlace: string | undefined,
    currentTime: Date
  ): number {
    let score = pattern.probability;
    
    // Check place match
    if (currentPlace && pattern.fromPlace === currentPlace) {
      score *= 1.5;
    } else if (currentPlace && pattern.fromPlace !== currentPlace) {
      score *= 0.3;
    }
    
    // Check day match
    const currentDay = currentTime.getDay();
    if (pattern.dayPattern.daysOfWeek.includes(currentDay)) {
      score *= 1.2;
    } else {
      score *= 0.2;
    }
    
    // Check time match
    const timeScore = this.scoreTimeMatch(pattern.timeWindow, currentTime);
    score *= timeScore;
    
    return Math.min(1.0, score);
  }
  
  /**
   * Score time match
   */
  private scoreTimeMatch(timeWindow: TimeWindow, currentTime: Date): number {
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    const windowTotalMinutes = timeWindow.startHour * 60 + timeWindow.startMinute;
    const diff = Math.abs(currentTotalMinutes - windowTotalMinutes);
    
    if (diff <= timeWindow.flexibilityMinutes) {
      return 1.0 - (diff / timeWindow.flexibilityMinutes) * 0.3;
    }
    
    return 0.3; // Low score if outside time window
  }
  
  /**
   * Calculate expected time for routine
   */
  private calculateExpectedTime(pattern: RoutinePattern, currentTime: Date): Date {
    const expected = new Date(currentTime);
    expected.setHours(pattern.timeWindow.startHour);
    expected.setMinutes(pattern.timeWindow.startMinute);
    expected.setSeconds(0);
    expected.setMilliseconds(0);
    
    return expected;
  }
  
  /**
   * Get all routines
   */
  getAllRoutines(): RoutinePattern[] {
    return Array.from(this.routines.values());
  }
  
  /**
   * Get routine by ID
   */
  getRoutine(patternId: string): RoutinePattern | null {
    return this.routines.get(patternId) || null;
  }
  
  /**
   * Helper: Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  /**
   * Helper: Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.calculateAverage(values);
    return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  }
  
  /**
   * Helper: Find most common value
   */
  private findMostCommon<T>(values: T[]): T | undefined {
    if (values.length === 0) return undefined;
    
    const frequency = new Map<T, number>();
    for (const value of values) {
      frequency.set(value, (frequency.get(value) || 0) + 1);
    }
    
    let maxCount = 0;
    let mostCommon: T | undefined;
    
    for (const [value, count] of frequency.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = value;
      }
    }
    
    return mostCommon;
  }
  
  /**
   * Load routines from storage
   */
  loadRoutines(routines: RoutinePattern[]): void {
    this.routines.clear();
    for (const routine of routines) {
      this.routines.set(routine.patternId, routine);
    }
  }
}
