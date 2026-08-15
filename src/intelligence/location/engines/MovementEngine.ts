/**
 * Movement Engine
 * 
 * Analyzes movement patterns to determine:
 * - Movement state (stationary, walking, driving, etc.)
 * - Travel mode (car, bus, train, etc.)
 * - Speed and heading
 * 
 * Combines GPS, activity recognition, and historical patterns.
 */

import {
  MovementType,
  TravelMode,
  MovementState,
  GeoPosition,
  ActivitySignal,
} from '../types.js';
import { LocationCollector } from '../collectors/LocationCollector.js';

export interface MovementAnalysis {
  movementState: MovementState;
  travelMode: TravelMode;
  isMoving: boolean;
}

export class MovementEngine {
  private recentPositions: GeoPosition[] = [];
  private recentActivities: ActivitySignal[] = [];
  private maxHistorySize = 10;
  
  // Known device identifiers for travel mode inference
  private knownCarBluetoothDevices: Set<string> = new Set();
  
  /**
   * Analyze current movement
   */
  analyzeMovement(
    currentPosition: GeoPosition,
    activitySignal?: ActivitySignal
  ): MovementAnalysis {
    // Add to history
    this.addPosition(currentPosition);
    if (activitySignal) {
      this.addActivity(activitySignal);
    }
    
    // Calculate speed from position history
    const calculatedSpeed = this.calculateCurrentSpeed();
    const speed = currentPosition.speed || calculatedSpeed;
    
    // Get activity from signal or infer from speed
    const activity = activitySignal 
      ? activitySignal.activity 
      : this.inferActivityFromSpeed(speed);
    
    // Determine movement state
    const movementState = this.determineMovementState(
      activity,
      speed,
      currentPosition.heading,
      activitySignal?.confidence || 0.5
    );
    
    // Infer travel mode
    const travelMode = this.inferTravelMode(movementState, speed, currentPosition);
    
    return {
      movementState,
      travelMode,
      isMoving: movementState.state !== MovementType.STATIONARY,
    };
  }
  
  /**
   * Determine movement state from signals
   */
  private determineMovementState(
    activity: MovementType,
    speed: number,
    heading?: number,
    activityConfidence = 0.5
  ): MovementState {
    // Cross-validate activity with speed
    let finalActivity = activity;
    let confidence = activityConfidence;
    
    // Speed-based validation
    if (activity === MovementType.STATIONARY && speed > 3) {
      // Activity says stationary but speed indicates movement
      finalActivity = this.inferActivityFromSpeed(speed);
      confidence = 0.6;
    } else if (activity === MovementType.WALKING && speed > 10) {
      // Activity says walking but speed too high
      finalActivity = MovementType.CYCLING;
      confidence = 0.7;
    } else if (activity === MovementType.IN_VEHICLE && speed < 5) {
      // Activity says vehicle but speed too low
      finalActivity = MovementType.STATIONARY;
      confidence = 0.6;
    }
    
    return {
      state: finalActivity,
      speedKmh: speed,
      heading,
      confidence,
      timestamp: new Date(),
    };
  }
  
  /**
   * Infer travel mode from movement state and context
   */
  private inferTravelMode(
    movementState: MovementState,
    speed: number,
    position: GeoPosition
  ): TravelMode {
    const { state } = movementState;
    
    // Direct mappings
    if (state === MovementType.WALKING) {
      return TravelMode.WALKING;
    }
    if (state === MovementType.RUNNING) {
      return TravelMode.RUNNING;
    }
    if (state === MovementType.CYCLING) {
      return TravelMode.CYCLING;
    }
    
    // Stationary has no travel mode
    if (state === MovementType.STATIONARY) {
      return TravelMode.UNKNOWN;
    }
    
    // IN_VEHICLE requires more analysis
    if (state === MovementType.IN_VEHICLE || state === MovementType.DRIVING) {
      return this.inferVehicleType(speed, position);
    }
    
    return TravelMode.UNKNOWN;
  }
  
  /**
   * Infer specific vehicle type
   */
  private inferVehicleType(speed: number, position: GeoPosition): TravelMode {
    // Check for known car Bluetooth
    // (This would be populated from Bluetooth signals in real implementation)
    if (this.knownCarBluetoothDevices.size > 0) {
      return TravelMode.CAR;
    }
    
    // Speed-based inference
    if (speed > 80) {
      // High speed suggests highway - likely car or bus
      return TravelMode.CAR;
    } else if (speed > 50) {
      // Medium-high speed
      return TravelMode.CAR;
    } else if (speed > 20) {
      // Could be car in city or bus
      // Check for frequent stops (would need history)
      const hasFrequentStops = this.detectFrequentStops();
      return hasFrequentStops ? TravelMode.BUS : TravelMode.CAR;
    }
    
    return TravelMode.CAR; // Default assumption
  }
  
  /**
   * Calculate current speed from position history
   */
  private calculateCurrentSpeed(): number {
    if (this.recentPositions.length < 2) {
      return 0;
    }
    
    // Calculate speed from last two positions
    const latest = this.recentPositions[this.recentPositions.length - 1];
    const previous = this.recentPositions[this.recentPositions.length - 2];
    
    return LocationCollector.calculateSpeed(previous, latest);
  }
  
  /**
   * Infer activity from speed
   */
  private inferActivityFromSpeed(speedKmh: number): MovementType {
    if (speedKmh < 1) {
      return MovementType.STATIONARY;
    } else if (speedKmh < 5) {
      return MovementType.WALKING;
    } else if (speedKmh < 12) {
      return MovementType.RUNNING;
    } else if (speedKmh < 25) {
      return MovementType.CYCLING;
    } else {
      return MovementType.IN_VEHICLE;
    }
  }
  
  /**
   * Detect frequent stops (for bus vs car inference)
   */
  private detectFrequentStops(): boolean {
    if (this.recentPositions.length < 5) {
      return false;
    }
    
    // Count number of times speed dropped below threshold
    let stopCount = 0;
    for (let i = 1; i < this.recentPositions.length; i++) {
      const speed = LocationCollector.calculateSpeed(
        this.recentPositions[i - 1],
        this.recentPositions[i]
      );
      if (speed < 5) {
        stopCount++;
      }
    }
    
    return stopCount >= 2;
  }
  
  /**
   * Get average speed over recent history
   */
  getAverageSpeed(): number {
    if (this.recentPositions.length < 2) {
      return 0;
    }
    
    let totalSpeed = 0;
    let count = 0;
    
    for (let i = 1; i < this.recentPositions.length; i++) {
      const speed = LocationCollector.calculateSpeed(
        this.recentPositions[i - 1],
        this.recentPositions[i]
      );
      totalSpeed += speed;
      count++;
    }
    
    return totalSpeed / count;
  }
  
  /**
   * Check if movement is consistent (for state stability)
   */
  isMovementConsistent(): boolean {
    if (this.recentPositions.length < 3) {
      return false;
    }
    
    const speeds: number[] = [];
    for (let i = 1; i < this.recentPositions.length; i++) {
      speeds.push(
        LocationCollector.calculateSpeed(
          this.recentPositions[i - 1],
          this.recentPositions[i]
        )
      );
    }
    
    // Check if speeds are similar (low variance)
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((sum, speed) => {
      return sum + Math.pow(speed - avgSpeed, 2);
    }, 0) / speeds.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Consider consistent if standard deviation is less than 30% of average
    return stdDev < avgSpeed * 0.3;
  }
  
  /**
   * Add position to history
   */
  private addPosition(position: GeoPosition): void {
    this.recentPositions.push(position);
    if (this.recentPositions.length > this.maxHistorySize) {
      this.recentPositions.shift();
    }
  }
  
  /**
   * Add activity to history
   */
  private addActivity(activity: ActivitySignal): void {
    this.recentActivities.push(activity);
    if (this.recentActivities.length > this.maxHistorySize) {
      this.recentActivities.shift();
    }
  }
  
  /**
   * Register known car Bluetooth device
   */
  addKnownCarDevice(deviceId: string): void {
    this.knownCarBluetoothDevices.add(deviceId);
  }
  
  /**
   * Clear history
   */
  clearHistory(): void {
    this.recentPositions = [];
    this.recentActivities = [];
  }
}
