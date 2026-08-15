/**
 * Activity Collector
 * 
 * Collects device activity/motion signals.
 * Uses device motion sensors to detect walking, running, driving, etc.
 */

import { MovementType, ActivitySignal } from '../types.js';

export interface ActivityReading {
  activity: MovementType;
  confidence: number;
  timestamp: Date;
}

export class ActivityCollector {
  private currentActivity?: ActivityReading;
  private motionListeners: Array<(signal: ActivitySignal) => void> = [];
  
  /**
   * Get current activity
   * Note: Browser API doesn't have native activity recognition
   * This is a simplified implementation - Android native would use Activity Recognition API
   */
  async getCurrentActivity(): Promise<ActivityReading | null> {
    // For web implementation, we'll infer from device motion if available
    // Real implementation would use Android Activity Recognition API
    
    if (this.currentActivity) {
      return this.currentActivity;
    }
    
    // Default to unknown
    return {
      activity: MovementType.UNKNOWN,
      confidence: 0.5,
      timestamp: new Date(),
    };
  }
  
  /**
   * Get activity as normalized signal
   */
  async getSignal(): Promise<ActivitySignal | null> {
    const activity = await this.getCurrentActivity();
    if (!activity) {
      return null;
    }
    
    return {
      type: 'ACTIVITY',
      activity: activity.activity,
      confidence: activity.confidence,
      timestamp: activity.timestamp,
    };
  }
  
  /**
   * Infer activity from speed
   * This is a fallback when native activity recognition isn't available
   */
  inferActivityFromSpeed(speedKmh: number): ActivityReading {
    let activity: MovementType;
    let confidence: number;
    
    if (speedKmh < 1) {
      activity = MovementType.STATIONARY;
      confidence = 0.9;
    } else if (speedKmh < 5) {
      activity = MovementType.WALKING;
      confidence = 0.7;
    } else if (speedKmh < 12) {
      activity = MovementType.RUNNING;
      confidence = 0.6;
    } else if (speedKmh < 25) {
      activity = MovementType.CYCLING;
      confidence = 0.6;
    } else {
      activity = MovementType.IN_VEHICLE;
      confidence = 0.8;
    }
    
    return {
      activity,
      confidence,
      timestamp: new Date(),
    };
  }
  
  /**
   * Infer activity from acceleration patterns
   * Uses device motion API if available
   */
  async inferActivityFromMotion(): Promise<ActivityReading | null> {
    // This would use DeviceMotion API or Android sensors
    // Simplified for web - real implementation would analyze acceleration patterns
    
    if (typeof DeviceMotionEvent === 'undefined') {
      return null;
    }
    
    // Real implementation would:
    // 1. Collect acceleration samples
    // 2. Analyze frequency and magnitude
    // 3. Classify into activity types
    // 4. Return with confidence
    
    return null;
  }
  
  /**
   * Start watching activity (continuous updates)
   */
  watchActivity(callback: (signal: ActivitySignal) => void): () => void {
    this.motionListeners.push(callback);
    
    // In a real implementation, this would start listening to device sensors
    // For now, return cleanup function
    return () => {
      this.motionListeners = this.motionListeners.filter(l => l !== callback);
    };
  }
  
  /**
   * Update activity reading
   */
  updateActivity(activity: ActivityReading): void {
    this.currentActivity = activity;
    
    const signal: ActivitySignal = {
      type: 'ACTIVITY',
      activity: activity.activity,
      confidence: activity.confidence,
      timestamp: activity.timestamp,
    };
    
    this.motionListeners.forEach(listener => listener(signal));
  }
}
