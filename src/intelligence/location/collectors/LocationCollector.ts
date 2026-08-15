/**
 * Location Collector
 * 
 * Collects GPS/GNSS position signals and normalizes them.
 * Does NOT continuously poll - controlled by LocationPolicyEngine.
 */

import { GeoPosition, LocationSignal, PositionSignal } from '../types.js';

export interface LocationCollectorConfig {
  accuracyMeters: number;
  timeoutMs: number;
  maximumAge: number;
}

export class LocationCollector {
  private config: LocationCollectorConfig;
  private currentPosition?: GeoPosition;
  
  constructor(config: LocationCollectorConfig) {
    this.config = config;
  }
  
  /**
   * Get current position
   * Returns cached if within maximumAge
   */
  async getCurrentPosition(): Promise<GeoPosition | null> {
    // Check cache
    if (this.currentPosition && this.isPositionFresh(this.currentPosition)) {
      return this.currentPosition;
    }
    
    // Browser geolocation API
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const position = await this.getPositionFromBrowser();
        this.currentPosition = position;
        return position;
      } catch (error) {
        console.error('Failed to get position:', error);
        return null;
      }
    }
    
    return null;
  }
  
  /**
   * Get position as normalized signal
   */
  async getSignal(): Promise<PositionSignal | null> {
    const position = await this.getCurrentPosition();
    if (!position) {
      return null;
    }
    
    return {
      type: 'POSITION',
      position,
    };
  }
  
  /**
   * Start watching position (continuous updates)
   */
  watchPosition(callback: (signal: PositionSignal) => void): () => void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return () => {};
    }
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const geoPosition = this.normalizePosition(position);
        this.currentPosition = geoPosition;
        
        callback({
          type: 'POSITION',
          position: geoPosition,
        });
      },
      (error) => {
        console.error('Position watch error:', error);
      },
      {
        enableHighAccuracy: this.config.accuracyMeters < 50,
        timeout: this.config.timeoutMs,
        maximumAge: this.config.maximumAge,
      }
    );
    
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }
  
  /**
   * Check if position is still fresh
   */
  private isPositionFresh(position: GeoPosition): boolean {
    const age = Date.now() - position.timestamp.getTime();
    return age < this.config.maximumAge;
  }
  
  /**
   * Get position from browser API
   */
  private getPositionFromBrowser(): Promise<GeoPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(this.normalizePosition(position));
        },
        reject,
        {
          enableHighAccuracy: this.config.accuracyMeters < 50,
          timeout: this.config.timeoutMs,
          maximumAge: this.config.maximumAge,
        }
      );
    });
  }
  
  /**
   * Normalize browser GeolocationPosition to our format
   */
  private normalizePosition(position: GeolocationPosition): GeoPosition {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
      timestamp: new Date(position.timestamp),
      altitude: position.coords.altitude || undefined,
      altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
      heading: position.coords.heading || undefined,
      speed: position.coords.speed || undefined,
    };
  }
  
  /**
   * Calculate distance between two positions (Haversine formula)
   */
  static calculateDistance(pos1: { latitude: number; longitude: number }, 
                          pos2: { latitude: number; longitude: number }): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = pos1.latitude * Math.PI / 180;
    const φ2 = pos2.latitude * Math.PI / 180;
    const Δφ = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const Δλ = (pos2.longitude - pos1.longitude) * Math.PI / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in meters
  }
  
  /**
   * Calculate bearing between two positions
   */
  static calculateBearing(pos1: { latitude: number; longitude: number }, 
                         pos2: { latitude: number; longitude: number }): number {
    const φ1 = pos1.latitude * Math.PI / 180;
    const φ2 = pos2.latitude * Math.PI / 180;
    const Δλ = (pos2.longitude - pos1.longitude) * Math.PI / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    
    return (θ * 180 / Math.PI + 360) % 360; // Bearing in degrees
  }
  
  /**
   * Calculate speed from two positions
   */
  static calculateSpeed(pos1: GeoPosition, pos2: GeoPosition): number {
    const distance = LocationCollector.calculateDistance(pos1, pos2);
    const timeDiff = (pos2.timestamp.getTime() - pos1.timestamp.getTime()) / 1000; // seconds
    
    if (timeDiff === 0) {
      return 0;
    }
    
    return (distance / timeDiff) * 3.6; // Convert m/s to km/h
  }
}
