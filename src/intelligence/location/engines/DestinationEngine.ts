/**
 * Destination Engine
 * 
 * Predicts where the user is going based on:
 * - Calendar appointments
 * - Learned routines
 * - Current heading
 * - Recent behavior
 * - Known places
 */

import {
  PlaceContext,
  DestinationCandidate,
  DestinationSource,
  GeoPosition,
  RoutinePattern,
  LearnedPlace,
  LocationConfig,
  DEFAULT_LOCATION_CONFIG,
} from '../types.js';
import { LocationCollector } from '../collectors/LocationCollector.js';

export interface CalendarDestination {
  placeId?: string;
  placeName?: string;
  location?: { latitude: number; longitude: number };
  startTime: Date;
  title: string;
}

export class DestinationEngine {
  private config: LocationConfig;
  
  constructor(config: Partial<LocationConfig> = {}) {
    this.config = { ...DEFAULT_LOCATION_CONFIG, ...config };
  }
  
  /**
   * Predict destination candidates
   */
  predictDestination(
    currentPosition: GeoPosition,
    currentPlace: string | undefined,
    upcomingCalendarEvents: CalendarDestination[],
    predictedRoutine: RoutinePattern | null,
    knownPlaces: LearnedPlace[]
  ): DestinationCandidate[] {
    const candidates: DestinationCandidate[] = [];
    
    // 1. Calendar-based destinations
    const calendarCandidates = this.getCalendarCandidates(
      currentPosition,
      upcomingCalendarEvents,
      knownPlaces
    );
    candidates.push(...calendarCandidates);
    
    // 2. Routine-based destinations
    if (predictedRoutine && predictedRoutine.toPlace) {
      const routineCandidate = this.getRoutineCandidate(
        predictedRoutine,
        knownPlaces,
        currentPosition
      );
      if (routineCandidate) {
        candidates.push(routineCandidate);
      }
    }
    
    // 3. Heading-based destinations
    const headingCandidates = this.getHeadingCandidates(
      currentPosition,
      knownPlaces
    );
    candidates.push(...headingCandidates);
    
    // Merge and rank candidates
    const merged = this.mergeCandidates(candidates);
    
    // Filter by threshold
    return merged
      .filter(c => c.probability >= this.config.destinationPredictionThreshold)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5); // Top 5 candidates
  }
  
  /**
   * Get calendar-based destination candidates
   */
  private getCalendarCandidates(
    currentPosition: GeoPosition,
    calendarEvents: CalendarDestination[],
    knownPlaces: LearnedPlace[]
  ): DestinationCandidate[] {
    const candidates: DestinationCandidate[] = [];
    const now = new Date();
    
    for (const event of calendarEvents) {
      // Only consider upcoming events (within next 2 hours)
      const timeUntilEvent = event.startTime.getTime() - now.getTime();
      if (timeUntilEvent < 0 || timeUntilEvent > 2 * 60 * 60 * 1000) {
        continue;
      }
      
      // Try to match with known place
      let place: PlaceContext | null = null;
      
      if (event.placeId) {
        const knownPlace = knownPlaces.find(p => p.id === event.placeId);
        if (knownPlace) {
          place = {
            placeId: knownPlace.id,
            name: knownPlace.name,
            type: knownPlace.semanticType!,
            latitude: knownPlace.center.latitude,
            longitude: knownPlace.center.longitude,
            confidence: knownPlace.confidence,
          };
        }
      } else if (event.location) {
        // Create temporary place context
        place = {
          placeId: `calendar_${event.title}`,
          name: event.placeName,
          type: 'UNKNOWN' as any,
          latitude: event.location.latitude,
          longitude: event.location.longitude,
          confidence: 0.7,
        };
      }
      
      if (place) {
        // Calculate probability based on time until event
        const timeScore = this.calculateTimeScore(timeUntilEvent);
        
        // Check if heading toward place
        const headingScore = this.calculateHeadingScore(currentPosition, place);
        
        const probability = Math.min(0.95, timeScore * 0.7 + headingScore * 0.3);
        
        candidates.push({
          place,
          probability,
          reason: `Calendar appointment: ${event.title}`,
          sources: [DestinationSource.CALENDAR],
        });
      }
    }
    
    return candidates;
  }
  
  /**
   * Get routine-based destination candidate
   */
  private getRoutineCandidate(
    routine: RoutinePattern,
    knownPlaces: LearnedPlace[],
    currentPosition: GeoPosition
  ): DestinationCandidate | null {
    const place = knownPlaces.find(p => p.id === routine.toPlace);
    if (!place) return null;
    
    const placeContext: PlaceContext = {
      placeId: place.id,
      name: place.name,
      type: place.semanticType!,
      latitude: place.center.latitude,
      longitude: place.center.longitude,
      confidence: place.confidence,
    };
    
    // Check heading
    const headingScore = this.calculateHeadingScore(currentPosition, placeContext);
    
    // Combine routine probability with heading
    const probability = routine.probability * 0.7 + headingScore * 0.3;
    
    return {
      place: placeContext,
      probability,
      reason: `Routine pattern: ${routine.name}`,
      sources: [DestinationSource.ROUTINE],
    };
  }
  
  /**
   * Get heading-based destination candidates
   */
  private getHeadingCandidates(
    currentPosition: GeoPosition,
    knownPlaces: LearnedPlace[]
  ): DestinationCandidate[] {
    if (!currentPosition.heading) {
      return [];
    }
    
    const candidates: DestinationCandidate[] = [];
    
    for (const place of knownPlaces) {
      const bearing = LocationCollector.calculateBearing(currentPosition, place.center);
      const distance = LocationCollector.calculateDistance(currentPosition, place.center);
      
      // Check if heading is roughly toward place (within 45 degrees)
      const headingDiff = Math.abs(currentPosition.heading - bearing);
      const normalizedDiff = Math.min(headingDiff, 360 - headingDiff);
      
      if (normalizedDiff <= 45 && distance >= 500 && distance <= 50000) {
        const alignmentScore = 1 - (normalizedDiff / 45);
        const distanceScore = this.calculateDistanceScore(distance);
        
        const probability = alignmentScore * 0.6 + distanceScore * 0.4;
        
        if (probability >= 0.5) {
          candidates.push({
            place: {
              placeId: place.id,
              name: place.name,
              type: place.semanticType!,
              latitude: place.center.latitude,
              longitude: place.center.longitude,
              confidence: place.confidence,
            },
            probability: probability * 0.7, // Reduce as this is less certain
            reason: `Heading toward place`,
            sources: [DestinationSource.HEADING],
          });
        }
      }
    }
    
    return candidates;
  }
  
  /**
   * Calculate time score (closer event = higher score)
   */
  private calculateTimeScore(timeUntilMs: number): number {
    const minutes = timeUntilMs / (60 * 1000);
    
    if (minutes <= 15) {
      return 0.95;
    } else if (minutes <= 30) {
      return 0.85;
    } else if (minutes <= 60) {
      return 0.75;
    } else {
      return 0.6;
    }
  }
  
  /**
   * Calculate heading score (alignment with direction to place)
   */
  private calculateHeadingScore(
    position: GeoPosition,
    place: PlaceContext
  ): number {
    if (!position.heading) {
      return 0.5; // Neutral if no heading
    }
    
    const bearing = LocationCollector.calculateBearing(position, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
    
    const headingDiff = Math.abs(position.heading - bearing);
    const normalizedDiff = Math.min(headingDiff, 360 - headingDiff);
    
    // Score from 0 to 1 based on alignment
    return Math.max(0, 1 - (normalizedDiff / 90));
  }
  
  /**
   * Calculate distance score (reasonable travel distance = higher score)
   */
  private calculateDistanceScore(distanceMeters: number): number {
    if (distanceMeters < 500) {
      return 0.3; // Too close
    } else if (distanceMeters <= 5000) {
      return 1.0; // Good range
    } else if (distanceMeters <= 20000) {
      return 0.8; // Reasonable
    } else {
      return 0.5; // Far
    }
  }
  
  /**
   * Merge candidates with same place
   */
  private mergeCandidates(candidates: DestinationCandidate[]): DestinationCandidate[] {
    const merged = new Map<string, DestinationCandidate>();
    
    for (const candidate of candidates) {
      const existing = merged.get(candidate.place.placeId);
      
      if (existing) {
        // Merge: combine probabilities and sources
        const combinedProbability = Math.min(
          0.99,
          existing.probability + candidate.probability * (1 - existing.probability)
        );
        
        existing.probability = combinedProbability;
        existing.sources.push(...candidate.sources);
        existing.reason += ` + ${candidate.reason}`;
      } else {
        merged.set(candidate.place.placeId, { ...candidate });
      }
    }
    
    return Array.from(merged.values());
  }
  
  /**
   * Check if approaching destination
   */
  isApproachingDestination(
    currentPosition: GeoPosition,
    destination: PlaceContext
  ): boolean {
    const distance = LocationCollector.calculateDistance(currentPosition, {
      latitude: destination.latitude,
      longitude: destination.longitude,
    });
    
    return distance <= this.config.approachingDistanceMeters;
  }
  
  /**
   * Calculate ETA to destination
   */
  calculateETA(
    currentPosition: GeoPosition,
    destination: PlaceContext,
    currentSpeed: number
  ): Date | null {
    if (currentSpeed < 1) {
      return null; // Not moving
    }
    
    const distance = LocationCollector.calculateDistance(currentPosition, {
      latitude: destination.latitude,
      longitude: destination.longitude,
    });
    
    // ETA in hours
    const etaHours = distance / 1000 / currentSpeed;
    
    const eta = new Date();
    eta.setTime(eta.getTime() + etaHours * 60 * 60 * 1000);
    
    return eta;
  }
}
