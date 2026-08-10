/**
 * Location Policy Engine
 * 
 * Dynamically controls location sampling based on context.
 * Balances battery efficiency with context accuracy.
 */

import {
  LocationContext,
  LocationPolicy,
  LocationSamplingPolicy,
  PrivacyMode,
  LocationState,
  MovementType,
  LocationConfig,
  DEFAULT_LOCATION_CONFIG,
} from './types';

export class LocationPolicyEngine {
  private config: LocationConfig;
  private currentPolicy: LocationPolicy;
  
  constructor(config: Partial<LocationConfig> = {}) {
    this.config = { ...DEFAULT_LOCATION_CONFIG, ...config };
    
    // Initialize with low-power policy
    this.currentPolicy = this.createPolicy(LocationSamplingPolicy.LOW_POWER);
  }
  
  /**
   * Update policy based on context
   */
  updatePolicy(context: LocationContext): void {
    const newSamplingPolicy = this.determineSamplingPolicy(context);
    
    if (newSamplingPolicy !== this.currentPolicy.samplingPolicy) {
      this.currentPolicy = this.createPolicy(newSamplingPolicy);
    }
  }
  
  /**
   * Determine appropriate sampling policy
   */
  private determineSamplingPolicy(context: LocationContext): LocationSamplingPolicy {
    // High accuracy when approaching destination
    if (context.locationState === LocationState.APPROACHING_DESTINATION) {
      return LocationSamplingPolicy.HIGH_ACCURACY;
    }
    
    // High accuracy when arrival/departure probability is high
    if (context.arrivalProbability > 0.8 || context.departureProbability > 0.8) {
      return LocationSamplingPolicy.HIGH_ACCURACY;
    }
    
    // Normal when traveling
    if (context.locationState === LocationState.TRAVELING) {
      return LocationSamplingPolicy.NORMAL;
    }
    
    // Normal when movement detected
    if (context.movementState.state !== MovementType.STATIONARY) {
      return LocationSamplingPolicy.NORMAL;
    }
    
    // Low power when stationary at known place
    if (context.currentPlace && context.locationState === LocationState.DWELLING) {
      return LocationSamplingPolicy.GEOFENCE_ONLY;
    }
    
    // Low power when stationary at place
    if (context.currentPlace && context.movementState.state === MovementType.STATIONARY) {
      return LocationSamplingPolicy.LOW_POWER;
    }
    
    // Default to normal
    return LocationSamplingPolicy.NORMAL;
  }
  
  /**
   * Create policy for sampling level
   */
  private createPolicy(samplingPolicy: LocationSamplingPolicy): LocationPolicy {
    let intervalSeconds: number;
    let accuracyMeters: number;
    
    switch (samplingPolicy) {
      case LocationSamplingPolicy.GEOFENCE_ONLY:
        intervalSeconds = 300; // 5 minutes (just for geofence checks)
        accuracyMeters = 100;
        break;
        
      case LocationSamplingPolicy.LOW_POWER:
        intervalSeconds = 120; // 2 minutes
        accuracyMeters = 100;
        break;
        
      case LocationSamplingPolicy.NORMAL:
        intervalSeconds = 30; // 30 seconds
        accuracyMeters = 50;
        break;
        
      case LocationSamplingPolicy.HIGH_ACCURACY:
        intervalSeconds = 10; // 10 seconds
        accuracyMeters = 20;
        break;
    }
    
    return {
      samplingPolicy,
      intervalSeconds,
      accuracyMeters,
      privacyMode: this.config.defaultPrivacyMode,
      rawLocationRetention: this.config.rawLocationRetentionDays,
      shareRawLocation: this.config.defaultPrivacyMode !== PrivacyMode.PRIVATE,
    };
  }
  
  /**
   * Get current policy
   */
  getCurrentPolicy(): LocationPolicy {
    return this.currentPolicy;
  }
  
  /**
   * Set privacy mode
   */
  setPrivacyMode(mode: PrivacyMode): void {
    this.currentPolicy.privacyMode = mode;
    this.currentPolicy.shareRawLocation = mode !== PrivacyMode.PRIVATE;
    
    // Adjust retention based on mode
    switch (mode) {
      case PrivacyMode.PRIVATE:
        this.currentPolicy.rawLocationRetention = 1; // 1 day
        break;
      case PrivacyMode.BALANCED:
        this.currentPolicy.rawLocationRetention = 7; // 7 days
        break;
      case PrivacyMode.ADVANCED:
        this.currentPolicy.rawLocationRetention = 30; // 30 days
        break;
    }
  }
  
  /**
   * Should collect raw GPS based on policy
   */
  shouldCollectRawGPS(): boolean {
    return this.currentPolicy.samplingPolicy !== LocationSamplingPolicy.GEOFENCE_ONLY;
  }
  
  /**
   * Should share with server based on privacy mode
   */
  shouldShareWithServer(): boolean {
    return this.currentPolicy.shareRawLocation;
  }
  
  /**
   * Get recommended accuracy
   */
  getRecommendedAccuracy(): number {
    return this.currentPolicy.accuracyMeters;
  }
  
  /**
   * Get recommended interval
   */
  getRecommendedInterval(): number {
    return this.currentPolicy.intervalSeconds;
  }
}
