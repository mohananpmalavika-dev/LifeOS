/**
 * Location Collector
 * 
 * Monitors user location and detects place transitions (HOME, WORK, etc.).
 * Uses smart sampling to preserve battery and privacy.
 */

import * as Location from 'expo-location';
import { BaseCollector, CollectorStatus } from '../BaseCollector';
import { EventFactory } from '../../core/EventFactory';
import { PlaceType, LifeEvent } from '../../core/LifeEvent';

export interface LocationCollectorConfig {
  enabled: boolean;
  accuracyLevel?: Location.Accuracy;
  distanceInterval?: number;      // Meters between updates
  timeInterval?: number;          // Milliseconds between updates
  enablePlaceDetection?: boolean;
  knownPlaces?: KnownPlace[];
}

export interface KnownPlace {
  id: string;
  type: PlaceType;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export class LocationCollector extends BaseCollector {
  private locationConfig: LocationCollectorConfig;
  private locationSubscription: any = null;
  private currentPlace: KnownPlace | null = null;
  private lastLocation: Location.LocationObject | null = null;

  constructor(config: LocationCollectorConfig) {
    super({
      enabled: config.enabled,
      permissions: ['location'],
    });
    this.locationConfig = {
      accuracyLevel: Location.Accuracy.Balanced,
      distanceInterval: 50,         // Update every 50 meters
      timeInterval: 60000,          // Or every minute
      enablePlaceDetection: true,
      knownPlaces: [],
      ...config,
    };
  }

  getName(): string {
    return 'LocationCollector';
  }

  async checkPermissions(): Promise<boolean> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  }

  async requestPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  async start(): Promise<void> {
    try {
      this.status = CollectorStatus.STARTING;
      this.log('Starting location collector');

      // Check permissions
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Location permissions not granted');
        }
      }

      // Start location tracking
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: this.locationConfig.accuracyLevel || Location.Accuracy.Balanced,
          distanceInterval: this.locationConfig.distanceInterval,
          timeInterval: this.locationConfig.timeInterval,
        },
        this.handleLocationUpdate.bind(this)
      );

      this.status = CollectorStatus.RUNNING;
      this.log('Location collector started');

    } catch (error: any) {
      this.status = CollectorStatus.ERROR;
      this.emitError(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.log('Stopping location collector');

      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      this.status = CollectorStatus.STOPPED;
      this.log('Location collector stopped');

    } catch (error: any) {
      this.emitError(error);
      throw error;
    }
  }

  /**
   * Handle location update
   */
  private async handleLocationUpdate(location: Location.LocationObject) {
    try {
      const { latitude, longitude, accuracy, altitude, speed, heading } = location.coords;

      // Check if location has changed significantly
      if (this.lastLocation) {
        const distance = this.calculateDistance(
          this.lastLocation.coords.latitude,
          this.lastLocation.coords.longitude,
          latitude,
          longitude
        );

        // Skip if movement is too small (< 10 meters)
        if (distance < 10) {
          return;
        }
      }

      // Create location event
      const event = EventFactory.createLocationEvent(
        latitude,
        longitude,
        accuracy || undefined,
        altitude || undefined,
        speed || undefined,
        heading || undefined
      );

      // Add movement metadata
      if (this.lastLocation) {
        const distance = this.calculateDistance(
          this.lastLocation.coords.latitude,
          this.lastLocation.coords.longitude,
          latitude,
          longitude
        );
        const timeDiff = (location.timestamp - this.lastLocation.timestamp) / 1000; // seconds
        const velocity = distance / timeDiff; // m/s

        event.metadata = {
          ...event.metadata,
          distanceFromLast: Math.round(distance),
          velocityMps: velocity.toFixed(2),
          isMoving: velocity > 0.5, // > 0.5 m/s = moving
        };
      }

      this.lastLocation = location;
      this.emitEvent(event);

      // Check for place transitions
      if (this.locationConfig.enablePlaceDetection) {
        await this.checkPlaceTransition(latitude, longitude, accuracy || 100);
      }

    } catch (error: any) {
      this.log('Error processing location update:', error);
      this.emitError(error);
    }
  }

  /**
   * Check if user has entered or left a known place
   */
  private async checkPlaceTransition(
    latitude: number,
    longitude: number,
    accuracy: number
  ) {
    try {
      const knownPlaces = this.locationConfig.knownPlaces || [];
      
      // Find nearest place
      let nearestPlace: KnownPlace | null = null;
      let minDistance = Infinity;

      for (const place of knownPlaces) {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          place.latitude,
          place.longitude
        );

        if (distance < place.radiusMeters && distance < minDistance) {
          nearestPlace = place;
          minDistance = distance;
        }
      }

      // Check for place transition
      if (nearestPlace && !this.currentPlace) {
        // Arrival at a place
        const event = EventFactory.createPlaceTransitionEvent(
          undefined,
          nearestPlace.type,
          'ARRIVAL',
          { latitude, longitude, accuracy },
          this.calculatePlaceConfidence(minDistance, accuracy, nearestPlace.radiusMeters)
        );

        event.metadata = {
          ...event.metadata,
          placeName: nearestPlace.name,
          placeId: nearestPlace.id,
          distanceToCenter: Math.round(minDistance),
        };

        this.currentPlace = nearestPlace;
        this.log(`Arrived at ${nearestPlace.name}`);
        this.emitEvent(event);

      } else if (!nearestPlace && this.currentPlace) {
        // Departure from a place
        const event = EventFactory.createPlaceTransitionEvent(
          this.currentPlace.type,
          undefined,
          'DEPARTURE',
          { latitude, longitude, accuracy },
          0.8
        );

        event.metadata = {
          ...event.metadata,
          placeName: this.currentPlace.name,
          placeId: this.currentPlace.id,
        };

        this.log(`Departed from ${this.currentPlace.name}`);
        this.currentPlace = null;
        this.emitEvent(event);

      } else if (nearestPlace && this.currentPlace && nearestPlace.id !== this.currentPlace.id) {
        // Transition between places
        const event = EventFactory.createPlaceTransitionEvent(
          this.currentPlace.type,
          nearestPlace.type,
          'ARRIVAL',
          { latitude, longitude, accuracy },
          this.calculatePlaceConfidence(minDistance, accuracy, nearestPlace.radiusMeters)
        );

        event.metadata = {
          ...event.metadata,
          fromPlace: this.currentPlace.name,
          toPlace: nearestPlace.name,
          placeId: nearestPlace.id,
        };

        this.log(`Transitioned from ${this.currentPlace.name} to ${nearestPlace.name}`);
        this.currentPlace = nearestPlace;
        this.emitEvent(event);
      }

    } catch (error: any) {
      this.log('Error checking place transition:', error);
      this.emitError(error);
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Calculate confidence of place detection
   */
  private calculatePlaceConfidence(
    distanceToCenter: number,
    accuracy: number,
    placeRadius: number
  ): number {
    // Higher confidence if closer to center and higher GPS accuracy
    const distanceScore = 1 - distanceToCenter / placeRadius;
    const accuracyScore = Math.max(0, 1 - accuracy / 50); // 50m accuracy = 0 score
    
    return Math.max(0.5, (distanceScore + accuracyScore) / 2);
  }

  /**
   * Add a known place
   */
  addKnownPlace(place: KnownPlace) {
    if (!this.locationConfig.knownPlaces) {
      this.locationConfig.knownPlaces = [];
    }
    this.locationConfig.knownPlaces.push(place);
    this.log(`Added known place: ${place.name}`);
  }

  /**
   * Remove a known place
   */
  removeKnownPlace(placeId: string) {
    if (this.locationConfig.knownPlaces) {
      this.locationConfig.knownPlaces = this.locationConfig.knownPlaces.filter(
        p => p.id !== placeId
      );
      this.log(`Removed known place: ${placeId}`);
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return location;
    } catch (error: any) {
      this.log('Error getting current location:', error);
      return null;
    }
  }
}
