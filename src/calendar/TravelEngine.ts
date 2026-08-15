/**
 * Travel Engine
 * 
 * Estimates travel time between locations with buffers, historical patterns, and mode inference
 */

import { ResolvedPlace, TravelRequirement, TransportMode, TravelHistory, TravelObservation } from './types.js';
import { PlaceResolver } from './PlaceResolver.js';
import Database from 'better-sqlite3';

interface RouteEstimate {
  distanceKm: number;
  durationMin: number;
  mode: TransportMode;
}

export class TravelEngine {
  constructor(
    private db: Database.Database,
    private placeResolver: PlaceResolver
  ) {}
  
  /**
   * Calculate travel requirement between two places
   */
  async calculateTravelRequirement(
    origin: ResolvedPlace | null | undefined,
    destination: ResolvedPlace,
    departureTime: string,
    userPreferredMode?: TransportMode
  ): Promise<TravelRequirement | null> {
    // If no origin, assume user needs to travel from current/home location
    if (!origin) {
      origin = (await this.inferOrigin(departureTime)) ?? undefined;
    }
    
    if (!origin) {
      return null;
    }
    
    // Check if same location
    if (origin.placeId === destination.placeId) {
      return null; // No travel required
    }
    
    // Calculate straight-line distance
    const distanceKm = this.calculateDistance(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    );
    
    // Infer transport mode
    const mode = userPreferredMode || this.inferTransportMode(
      origin,
      destination,
      distanceKm,
      departureTime
    );
    
    // Get historical travel time if available
    const historicalData = this.getHistoricalTravelTime(
      origin.placeId,
      destination.placeId,
      mode,
      departureTime
    );
    
    // Estimate travel duration
    let estimatedDurationMin: number;
    let confidence: number;
    
    if (historicalData) {
      // Use historical data
      estimatedDurationMin = this.calculateContextualDuration(
        historicalData,
        departureTime
      );
      confidence = 0.85;
    } else {
      // Use heuristic estimation
      estimatedDurationMin = this.estimateDuration(distanceKm, mode);
      confidence = 0.65;
    }
    
    // Get place-specific access time and buffer
    const destProfile = this.placeResolver.getPreparationProfile(destination.placeType);
    const accessTimeMin = destProfile.accessTimeMin;
    const bufferMin = destProfile.arrivalBufferMin;
    
    // Calculate total required time
    const requiredDurationMin = estimatedDurationMin + accessTimeMin + bufferMin;
    
    // Calculate required departure time
    const arrivalTime = new Date(departureTime);
    const requiredDepartureTime = new Date(
      arrivalTime.getTime() - requiredDurationMin * 60 * 1000
    );
    
    return {
      required: true,
      origin,
      destination,
      mode,
      modeConfidence: this.getModConfidence(mode, distanceKm),
      
      distanceKm,
      estimatedDurationMin,
      historicalDurationMin: historicalData?.averageDurationMin,
      
      bufferMin,
      accessTimeMin,
      
      requiredDurationMin,
      requiredDepartureTime: requiredDepartureTime.toISOString(),
      
      confidence
    };
  }
  
  /**
   * Infer origin location (home or current location)
   */
  private async inferOrigin(departureTime: string): Promise<ResolvedPlace | null> {
    try {
      // Try to get user's typical location at this time
      const hour = new Date(departureTime).getHours();
      
      // Morning hours: likely at home
      if (hour >= 6 && hour <= 9) {
        const home = await this.findSemanticPlace('Home');
        if (home) return home;
      }
      
      // Work hours: likely at office
      if (hour >= 9 && hour <= 17) {
        const office = await this.findSemanticPlace('Office');
        if (office) return office;
      }
      
      // Evening: likely at home
      if (hour >= 17) {
        const home = await this.findSemanticPlace('Home');
        if (home) return home;
      }
      
      // Default: try home
      return await this.findSemanticPlace('Home');
    } catch (error) {
      console.error('Error inferring origin:', error);
      return null;
    }
  }
  
  /**
   * Find place by semantic label
   */
  private async findSemanticPlace(label: string): Promise<ResolvedPlace | null> {
    try {
      const result = this.db.prepare(`
        SELECT 
          e.entity_id as placeId,
          e.name,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'address' THEN ea.value END) as address,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'latitude' THEN ea.value END) AS REAL) as latitude,
          CAST(GROUP_CONCAT(CASE WHEN ea.attribute_type = 'longitude' THEN ea.value END) AS REAL) as longitude,
          GROUP_CONCAT(CASE WHEN ea.attribute_type = 'placeType' THEN ea.value END) as placeType
        FROM entities e
        LEFT JOIN entity_attributes ea ON e.entity_id = ea.entity_id
        WHERE e.entity_type = 'PLACE'
        AND e.entity_id IN (
          SELECT entity_id FROM entity_attributes 
          WHERE attribute_type = 'semanticLabel' 
          AND LOWER(value) = LOWER(?)
        )
        GROUP BY e.entity_id
        LIMIT 1
      `).get(label) as any;
      
      if (!result) return null;
      
      return {
        placeId: result.placeId,
        name: result.name,
        address: result.address,
        latitude: result.latitude || 0,
        longitude: result.longitude || 0,
        placeType: result.placeType || 'UNKNOWN',
        semanticLabel: label,
        confidence: 0.9
      };
    } catch (error) {
      console.error('Error finding semantic place:', error);
      return null;
    }
  }
  
  /**
   * Calculate straight-line distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }
  
  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Infer transport mode based on distance and context
   */
  private inferTransportMode(
    origin: ResolvedPlace,
    destination: ResolvedPlace,
    distanceKm: number,
    departureTime: string
  ): TransportMode {
    // Check historical mode preference for this route
    const historicalMode = this.getHistoricalMode(origin.placeId, destination.placeId);
    if (historicalMode) {
      return historicalMode;
    }
    
    // Distance-based heuristics
    if (distanceKm < 1) {
      return TransportMode.WALK;
    }
    
    if (distanceKm < 5) {
      // Short distance: could be walk, bike, or car
      // Check time of day and place types
      const hour = new Date(departureTime).getHours();
      
      // Rush hour: likely driving
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        return TransportMode.CAR;
      }
      
      return TransportMode.CAR;
    }
    
    if (distanceKm < 15) {
      // Medium distance: car or bus
      return TransportMode.CAR;
    }
    
    if (distanceKm < 100) {
      // Long distance: car or train
      return TransportMode.CAR;
    }
    
    // Very long distance: likely flight
    return TransportMode.FLIGHT;
  }
  
  /**
   * Get historical mode for route
   */
  private getHistoricalMode(originId: string, destinationId: string): TransportMode | null {
    try {
      const result = this.db.prepare(`
        SELECT mode, COUNT(*) as count
        FROM travel_history
        WHERE origin_place_id = ? AND destination_place_id = ?
        GROUP BY mode
        ORDER BY count DESC
        LIMIT 1
      `).get(originId, destinationId) as { mode: string; count: number } | undefined;
      
      return result?.mode as TransportMode || null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get mode confidence
   */
  private getModConfidence(mode: TransportMode, distanceKm: number): number {
    // High confidence for obvious cases
    if (mode === TransportMode.WALK && distanceKm < 1) return 0.9;
    if (mode === TransportMode.FLIGHT && distanceKm > 500) return 0.95;
    
    // Medium confidence for typical cases
    if (mode === TransportMode.CAR && distanceKm > 5 && distanceKm < 50) return 0.8;
    
    // Lower confidence for ambiguous cases
    return 0.65;
  }
  
  /**
   * Estimate duration based on distance and mode
   */
  private estimateDuration(distanceKm: number, mode: TransportMode): number {
    const speeds: Record<TransportMode, number> = {
      [TransportMode.WALK]: 5, // 5 km/h
      [TransportMode.BIKE]: 15, // 15 km/h
      [TransportMode.BUS]: 25, // 25 km/h (including stops)
      [TransportMode.CAR]: 40, // 40 km/h (urban average)
      [TransportMode.TRAIN]: 80, // 80 km/h
      [TransportMode.FLIGHT]: 600, // 600 km/h
      [TransportMode.UNKNOWN]: 30
    };
    
    const speed = speeds[mode];
    const baseTime = (distanceKm / speed) * 60; // Convert to minutes
    
    // Add mode-specific overhead
    const overhead: Record<TransportMode, number> = {
      [TransportMode.WALK]: 0,
      [TransportMode.BIKE]: 2,
      [TransportMode.BUS]: 10, // Waiting time
      [TransportMode.CAR]: 5, // Parking, traffic
      [TransportMode.TRAIN]: 20, // Waiting, boarding
      [TransportMode.FLIGHT]: 120, // Check-in, security, boarding
      [TransportMode.UNKNOWN]: 5
    };
    
    return Math.round(baseTime + overhead[mode]);
  }
  
  /**
   * Get historical travel time data
   */
  private getHistoricalTravelTime(
    originId: string,
    destinationId: string,
    mode: TransportMode,
    departureTime: string
  ): TravelHistory | null {
    try {
      const observations = this.db.prepare(`
        SELECT 
          timestamp,
          duration_minutes as durationMin,
          CAST(strftime('%w', timestamp) AS INTEGER) as dayOfWeek,
          CAST(strftime('%H', timestamp) AS INTEGER) as hourOfDay,
          conditions
        FROM travel_history
        WHERE origin_place_id = ?
        AND destination_place_id = ?
        AND mode = ?
        ORDER BY timestamp DESC
        LIMIT 50
      `).all(originId, destinationId, mode) as TravelObservation[];
      
      if (observations.length === 0) return null;
      
      const durations = observations.map(o => o.durationMin);
      
      return {
        routeId: `${originId}_${destinationId}_${mode}`,
        origin: {} as ResolvedPlace, // Not needed for calculation
        destination: {} as ResolvedPlace,
        mode,
        observations,
        averageDurationMin: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        medianDurationMin: this.median(durations),
        minDurationMin: Math.min(...durations),
        maxDurationMin: Math.max(...durations)
      };
    } catch (error) {
      console.error('Error getting historical travel time:', error);
      return null;
    }
  }
  
  /**
   * Calculate contextual duration based on historical data and departure time
   */
  private calculateContextualDuration(history: TravelHistory, departureTime: string): number {
    const departureDate = new Date(departureTime);
    const dayOfWeek = departureDate.getDay();
    const hourOfDay = departureDate.getHours();
    
    // Filter observations for similar time context
    const similarObservations = history.observations.filter(obs => {
      const timeDiff = Math.abs(obs.hourOfDay - hourOfDay);
      const dayMatch = obs.dayOfWeek === dayOfWeek;
      
      // Same day and within 2 hours
      return dayMatch && timeDiff <= 2;
    });
    
    if (similarObservations.length >= 3) {
      // Use contextual average
      const contextualAvg = similarObservations.reduce((sum, obs) => sum + obs.durationMin, 0) / similarObservations.length;
      return Math.round(contextualAvg);
    }
    
    // Fall back to overall average with time-of-day adjustment
    let baseDuration = history.averageDurationMin;
    
    // Rush hour adjustment
    if ((hourOfDay >= 7 && hourOfDay <= 9) || (hourOfDay >= 17 && hourOfDay <= 19)) {
      baseDuration *= 1.3; // 30% longer during rush hour
    }
    
    // Weekend adjustment
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseDuration *= 0.9; // 10% faster on weekends
    }
    
    return Math.round(baseDuration);
  }
  
  /**
   * Calculate median of array
   */
  private median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    
    return sorted[mid];
  }
  
  /**
   * Record actual travel time for learning
   */
  recordTravelTime(
    originId: string,
    destinationId: string,
    mode: TransportMode,
    durationMin: number,
    timestamp: string,
    conditions?: string
  ): void {
    try {
      const date = new Date(timestamp);
      
      this.db.prepare(`
        INSERT INTO travel_history (
          origin_place_id,
          destination_place_id,
          mode,
          duration_minutes,
          timestamp,
          day_of_week,
          hour_of_day,
          conditions,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        originId,
        destinationId,
        mode,
        durationMin,
        timestamp,
        date.getDay(),
        date.getHours(),
        conditions || null
      );
    } catch (error) {
      console.error('Error recording travel time:', error);
    }
  }
  
  /**
   * Get travel statistics for route
   */
  getTravelStatistics(originId: string, destinationId: string, mode: TransportMode): {
    totalTrips: number;
    averageDuration: number;
    reliability: number; // 0-1, based on variance
  } | null {
    try {
      const history = this.getHistoricalTravelTime(originId, destinationId, mode, new Date().toISOString());
      
      if (!history || history.observations.length === 0) {
        return null;
      }
      
      // Calculate variance for reliability score
      const durations = history.observations.map(o => o.durationMin);
      const mean = history.averageDurationMin;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);
      
      // Reliability: high when standard deviation is low relative to mean
      const coefficientOfVariation = stdDev / mean;
      const reliability = Math.max(0, Math.min(1, 1 - coefficientOfVariation));
      
      return {
        totalTrips: history.observations.length,
        averageDuration: history.averageDurationMin,
        reliability
      };
    } catch (error) {
      console.error('Error getting travel statistics:', error);
      return null;
    }
  }
  
  /**
   * Predict travel time with confidence interval
   */
  predictTravelTime(
    originId: string,
    destinationId: string,
    mode: TransportMode,
    departureTime: string
  ): {
    estimatedMin: number;
    minMin: number;
    maxMin: number;
    confidence: number;
  } | null {
    const history = this.getHistoricalTravelTime(originId, destinationId, mode, departureTime);
    
    if (!history) {
      return null;
    }
    
    const estimated = this.calculateContextualDuration(history, departureTime);
    
    // Calculate confidence interval based on historical variance
    const durations = history.observations.map(o => o.durationMin);
    const stdDev = Math.sqrt(
      durations.reduce((sum, d) => sum + Math.pow(d - estimated, 2), 0) / durations.length
    );
    
    return {
      estimatedMin: estimated,
      minMin: Math.max(history.minDurationMin, Math.round(estimated - stdDev)),
      maxMin: Math.min(history.maxDurationMin, Math.round(estimated + stdDev)),
      confidence: Math.min(0.95, history.observations.length / 20) // More data = higher confidence
    };
  }
  
  /**
   * Check if travel is feasible within time window
   */
  isTravelFeasible(
    travelRequirement: TravelRequirement,
    availableTimeMin: number
  ): {
    feasible: boolean;
    shortfallMin?: number;
    bufferMin?: number;
  } {
    const required = travelRequirement.requiredDurationMin;
    
    if (availableTimeMin >= required) {
      return {
        feasible: true,
        bufferMin: availableTimeMin - required
      };
    }
    
    return {
      feasible: false,
      shortfallMin: required - availableTimeMin
    };
  }
}
