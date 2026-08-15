/**
 * Place Engine
 * 
 * Answers: "What real-world place does this coordinate represent for this user?"
 * 
 * Features:
 * - Place clustering and identification
 * - Automatic home/work detection
 * - Place learning from visits
 * - Geofence management
 */

import { 
  GeoPoint, 
  GeoPosition, 
  LearnedPlace, 
  PlaceContext, 
  PlaceType,
  TimeDistribution,
  DayDistribution,
  LocationConfig,
  DEFAULT_LOCATION_CONFIG,
} from '../types.js';
import { LocationCollector } from '../collectors/LocationCollector.js';

export class PlaceEngine {
  private config: LocationConfig;
  private places: Map<string, LearnedPlace> = new Map();
  private geofences: Map<string, { center: GeoPoint; radius: number }> = new Map();
  
  constructor(config: Partial<LocationConfig> = {}) {
    this.config = { ...DEFAULT_LOCATION_CONFIG, ...config };
  }
  
  /**
   * Identify place at given position
   */
  async identifyPlace(position: GeoPosition): Promise<PlaceContext | null> {
    // Check if position falls within any known place
    for (const place of this.places.values()) {
      const distance = LocationCollector.calculateDistance(position, place.center);
      
      if (distance <= place.radiusMeters) {
        return {
          placeId: place.id,
          name: place.name,
          type: place.semanticType || PlaceType.UNKNOWN,
          latitude: place.center.latitude,
          longitude: place.center.longitude,
          confidence: this.calculatePlaceConfidence(place, distance),
        };
      }
    }
    
    return null;
  }
  
  /**
   * Find or create place for position
   */
  async findOrCreatePlace(position: GeoPosition): Promise<string> {
    // Try to find existing place
    const existingPlace = await this.identifyPlace(position);
    if (existingPlace) {
      return existingPlace.placeId;
    }
    
    // Check if we should cluster with nearby places
    const nearbyPlace = this.findNearbyPlace(position, this.config.placeClusteringRadiusMeters);
    if (nearbyPlace) {
      // Expand existing place to include this position
      this.expandPlace(nearbyPlace.id, position);
      return nearbyPlace.id;
    }
    
    // Create new place
    return this.createPlace(position);
  }
  
  /**
   * Create a new place
   */
  private createPlace(position: GeoPosition): string {
    const placeId = `place_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const place: LearnedPlace = {
      id: placeId,
      center: {
        latitude: position.latitude,
        longitude: position.longitude,
      },
      radiusMeters: Math.max(
        position.accuracyMeters * 1.5, 
        this.config.placeClusteringRadiusMeters
      ),
      visitCount: 1,
      totalDwellMinutes: 0,
      firstSeen: position.timestamp,
      lastSeen: position.timestamp,
      timeDistribution: this.createEmptyTimeDistribution(),
      dayDistribution: this.createEmptyDayDistribution(),
      confidence: 0.3, // Low confidence for new place
      isPrivate: false,
    };
    
    this.places.set(placeId, place);
    this.createGeofence(placeId, place.center, place.radiusMeters);
    
    return placeId;
  }
  
  /**
   * Find nearby place within radius
   */
  private findNearbyPlace(position: GeoPoint, radiusMeters: number): LearnedPlace | null {
    let closest: { place: LearnedPlace; distance: number } | null = null;
    
    for (const place of this.places.values()) {
      const distance = LocationCollector.calculateDistance(position, place.center);
      
      if (distance <= radiusMeters) {
        if (!closest || distance < closest.distance) {
          closest = { place, distance };
        }
      }
    }
    
    return closest?.place || null;
  }
  
  /**
   * Expand place to include new position
   */
  private expandPlace(placeId: string, position: GeoPosition): void {
    const place = this.places.get(placeId);
    if (!place) return;
    
    // Recalculate center (weighted average)
    const totalVisits = place.visitCount + 1;
    const newCenter = {
      latitude: (place.center.latitude * place.visitCount + position.latitude) / totalVisits,
      longitude: (place.center.longitude * place.visitCount + position.longitude) / totalVisits,
    };
    
    // Recalculate radius to include new position
    const distanceFromNew = LocationCollector.calculateDistance(newCenter, position);
    const newRadius = Math.max(place.radiusMeters, distanceFromNew + position.accuracyMeters);
    
    place.center = newCenter;
    place.radiusMeters = newRadius;
    place.visitCount = totalVisits;
    place.lastSeen = position.timestamp;
    
    // Update geofence
    this.updateGeofence(placeId, newCenter, newRadius);
  }
  
  /**
   * Record visit to place
   */
  recordVisit(placeId: string, timestamp: Date, durationMinutes: number): void {
    const place = this.places.get(placeId);
    if (!place) return;
    
    place.visitCount++;
    place.totalDwellMinutes += durationMinutes;
    place.lastSeen = timestamp;
    
    // Update distributions
    this.updateTimeDistribution(place.timeDistribution, timestamp);
    this.updateDayDistribution(place.dayDistribution, timestamp);
    
    // Increase confidence with more visits
    place.confidence = Math.min(0.99, place.confidence + 0.05);
    
    // Try to infer semantic type
    if (!place.semanticType && place.visitCount >= this.config.minimumVisitsForPlace) {
      place.semanticType = this.inferPlaceType(place);
    }
  }
  
  /**
   * Infer place type from visit patterns
   */
  private inferPlaceType(place: LearnedPlace): PlaceType {
    const { timeDistribution, dayDistribution, totalDwellMinutes, visitCount } = place;
    
    // Check for HOME pattern: overnight visits, high nighttime percentage
    const nighttimePercentage = timeDistribution.night / visitCount;
    const avgDwellHours = totalDwellMinutes / visitCount / 60;
    
    if (nighttimePercentage > 0.6 && avgDwellHours > 6) {
      return PlaceType.HOME;
    }
    
    // Check for WORK pattern: weekday daytime visits
    const weekdayPercentage = dayDistribution.weekday / visitCount;
    const daytimePercentage = (timeDistribution.morning + timeDistribution.afternoon) / visitCount;
    
    if (weekdayPercentage > 0.7 && daytimePercentage > 0.7 && avgDwellHours > 4) {
      return PlaceType.WORK;
    }
    
    // Check for GYM: short visits, consistent time
    if (avgDwellHours >= 1 && avgDwellHours <= 2) {
      const morningOrEvening = (timeDistribution.morning + timeDistribution.evening) / visitCount;
      if (morningOrEvening > 0.7) {
        return PlaceType.GYM;
      }
    }
    
    return PlaceType.UNKNOWN;
  }
  
  /**
   * Get place by ID
   */
  getPlace(placeId: string): LearnedPlace | null {
    return this.places.get(placeId) || null;
  }
  
  /**
   * Get all places
   */
  getAllPlaces(): LearnedPlace[] {
    return Array.from(this.places.values());
  }
  
  /**
   * Get places by type
   */
  getPlacesByType(type: PlaceType): LearnedPlace[] {
    return Array.from(this.places.values())
      .filter(place => place.semanticType === type);
  }
  
  /**
   * Get home place
   */
  getHome(): LearnedPlace | null {
    const homes = this.getPlacesByType(PlaceType.HOME);
    return homes.length > 0 ? homes[0] : null;
  }
  
  /**
   * Get work place
   */
  getWork(): LearnedPlace | null {
    const workPlaces = this.getPlacesByType(PlaceType.WORK);
    return workPlaces.length > 0 ? workPlaces[0] : null;
  }
  
  /**
   * Set place name
   */
  setPlaceName(placeId: string, name: string): void {
    const place = this.places.get(placeId);
    if (place) {
      place.name = name;
    }
  }
  
  /**
   * Set place type
   */
  setPlaceType(placeId: string, type: PlaceType): void {
    const place = this.places.get(placeId);
    if (place) {
      place.semanticType = type;
      place.confidence = Math.max(place.confidence, 0.9); // User confirmation increases confidence
    }
  }
  
  /**
   * Set place privacy
   */
  setPlacePrivacy(placeId: string, isPrivate: boolean): void {
    const place = this.places.get(placeId);
    if (place) {
      place.isPrivate = isPrivate;
    }
  }
  
  /**
   * Create geofence for place
   */
  private createGeofence(placeId: string, center: GeoPoint, radius: number): void {
    this.geofences.set(placeId, { 
      center, 
      radius: radius * this.config.geofenceRadiusMultiplier 
    });
  }
  
  /**
   * Update geofence
   */
  private updateGeofence(placeId: string, center: GeoPoint, radius: number): void {
    this.createGeofence(placeId, center, radius);
  }
  
  /**
   * Check if position is within geofence
   */
  isWithinGeofence(placeId: string, position: GeoPoint): boolean {
    const geofence = this.geofences.get(placeId);
    if (!geofence) return false;
    
    const distance = LocationCollector.calculateDistance(position, geofence.center);
    return distance <= geofence.radius;
  }
  
  /**
   * Calculate place confidence based on distance from center
   */
  private calculatePlaceConfidence(place: LearnedPlace, distance: number): number {
    // Confidence decreases with distance from center
    const distanceRatio = distance / place.radiusMeters;
    const distanceConfidence = Math.max(0, 1 - distanceRatio);
    
    // Combine with place's overall confidence
    return place.confidence * distanceConfidence;
  }
  
  /**
   * Create empty time distribution
   */
  private createEmptyTimeDistribution(): TimeDistribution {
    return {
      hourlyVisits: new Array(24).fill(0),
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
    };
  }
  
  /**
   * Create empty day distribution
   */
  private createEmptyDayDistribution(): DayDistribution {
    return {
      weeklyVisits: new Array(7).fill(0),
      weekday: 0,
      weekend: 0,
    };
  }
  
  /**
   * Update time distribution
   */
  private updateTimeDistribution(distribution: TimeDistribution, timestamp: Date): void {
    const hour = timestamp.getHours();
    distribution.hourlyVisits[hour]++;
    
    if (hour >= 6 && hour < 12) {
      distribution.morning++;
    } else if (hour >= 12 && hour < 18) {
      distribution.afternoon++;
    } else if (hour >= 18 && hour < 22) {
      distribution.evening++;
    } else {
      distribution.night++;
    }
  }
  
  /**
   * Update day distribution
   */
  private updateDayDistribution(distribution: DayDistribution, timestamp: Date): void {
    const day = timestamp.getDay(); // 0=Sunday
    distribution.weeklyVisits[day]++;
    
    if (day >= 1 && day <= 5) {
      distribution.weekday++;
    } else {
      distribution.weekend++;
    }
  }
  
  /**
   * Load places from storage
   */
  loadPlaces(places: LearnedPlace[]): void {
    this.places.clear();
    this.geofences.clear();
    
    for (const place of places) {
      this.places.set(place.id, place);
      this.createGeofence(place.id, place.center, place.radiusMeters);
    }
  }
}
