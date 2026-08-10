/**
 * Activity Collector
 * 
 * Monitors user physical activity (walking, driving, still, etc.).
 * Uses device sensors to classify activity type.
 */

import { DeviceMotion } from 'expo-sensors';
import { BaseCollector, CollectorStatus } from '../BaseCollector';
import { EventFactory } from '../../core/EventFactory';
import { ActivityType, LifeEvent } from '../../core/LifeEvent';

export interface ActivityCollectorConfig {
  enabled: boolean;
  samplingIntervalMs?: number;
  detectionWindowMs?: number;     // Time window for activity detection
  confidenceThreshold?: number;   // Minimum confidence to report activity
}

interface ActivitySample {
  acceleration: number;
  timestamp: number;
}

export class ActivityCollector extends BaseCollector {
  private activityConfig: ActivityCollectorConfig;
  private motionSubscription: any = null;
  private samples: ActivitySample[] = [];
  private currentActivity: ActivityType = ActivityType.UNKNOWN;
  private detectionInterval: NodeJS.Timeout | null = null;

  constructor(config: ActivityCollectorConfig) {
    super({
      enabled: config.enabled,
      permissions: ['motion'],
    });
    this.activityConfig = {
      samplingIntervalMs: 1000,      // Sample every second
      detectionWindowMs: 10000,      // Analyze 10 seconds of data
      confidenceThreshold: 0.6,      // 60% confidence minimum
      ...config,
    };
  }

  getName(): string {
    return 'ActivityCollector';
  }

  async checkPermissions(): Promise<boolean> {
    // Motion sensors don't require explicit permissions on most platforms
    const available = await DeviceMotion.isAvailableAsync();
    return available;
  }

  async requestPermissions(): Promise<boolean> {
    // No permission request needed for motion sensors
    return true;
  }

  async start(): Promise<void> {
    try {
      this.status = CollectorStatus.STARTING;
      this.log('Starting activity collector');

      // Check if motion sensors are available
      const available = await DeviceMotion.isAvailableAsync();
      if (!available) {
        throw new Error('Motion sensors not available on this device');
      }

      // Set update interval
      DeviceMotion.setUpdateInterval(this.activityConfig.samplingIntervalMs || 1000);

      // Subscribe to motion updates
      this.motionSubscription = DeviceMotion.addListener(
        this.handleMotionUpdate.bind(this)
      );

      // Start activity detection
      const detectionInterval = Math.max(
        this.activityConfig.detectionWindowMs || 10000,
        5000
      );
      this.detectionInterval = setInterval(() => {
        this.detectActivity();
      }, detectionInterval);

      this.status = CollectorStatus.RUNNING;
      this.log('Activity collector started');

    } catch (error: any) {
      this.status = CollectorStatus.ERROR;
      this.emitError(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.log('Stopping activity collector');

      if (this.motionSubscription) {
        this.motionSubscription.remove();
        this.motionSubscription = null;
      }

      if (this.detectionInterval) {
        clearInterval(this.detectionInterval);
        this.detectionInterval = null;
      }

      this.samples = [];
      this.status = CollectorStatus.STOPPED;
      this.log('Activity collector stopped');

    } catch (error: any) {
      this.emitError(error);
      throw error;
    }
  }

  /**
   * Handle motion sensor update
   */
  private handleMotionUpdate(data: DeviceMotion.DeviceMotionMeasurement) {
    try {
      // Calculate total acceleration magnitude
      const acc = data.acceleration;
      if (!acc) return;

      const magnitude = Math.sqrt(
        acc.x * acc.x + acc.y * acc.y + acc.z * acc.z
      );

      // Store sample
      this.samples.push({
        acceleration: magnitude,
        timestamp: Date.now(),
      });

      // Keep only recent samples
      const windowMs = this.activityConfig.detectionWindowMs || 10000;
      const cutoff = Date.now() - windowMs;
      this.samples = this.samples.filter(s => s.timestamp > cutoff);

    } catch (error: any) {
      this.log('Error processing motion update:', error);
    }
  }

  /**
   * Detect current activity from samples
   */
  private detectActivity() {
    try {
      if (this.samples.length < 5) {
        // Not enough samples
        return;
      }

      // Calculate statistics
      const accelerations = this.samples.map(s => s.acceleration);
      const mean = this.calculateMean(accelerations);
      const variance = this.calculateVariance(accelerations, mean);
      const stdDev = Math.sqrt(variance);

      // Classify activity based on acceleration patterns
      const { activity, confidence } = this.classifyActivity(mean, stdDev);

      // Check confidence threshold
      if (confidence < (this.activityConfig.confidenceThreshold || 0.6)) {
        return;
      }

      // Check if activity changed
      if (activity !== this.currentActivity) {
        const previousActivity = this.currentActivity;
        this.currentActivity = activity;

        // Create activity change event
        const event = EventFactory.createActivityEvent(
          activity,
          confidence,
          previousActivity !== ActivityType.UNKNOWN ? previousActivity : undefined
        );

        event.metadata = {
          ...event.metadata,
          accelerationMean: mean.toFixed(3),
          accelerationStdDev: stdDev.toFixed(3),
          sampleCount: this.samples.length,
        };

        this.log(`Activity changed: ${previousActivity} → ${activity} (${(confidence * 100).toFixed(0)}%)`);
        this.emitEvent(event);
      }

    } catch (error: any) {
      this.log('Error detecting activity:', error);
      this.emitError(error);
    }
  }

  /**
   * Classify activity based on acceleration patterns
   */
  private classifyActivity(
    mean: number,
    stdDev: number
  ): { activity: ActivityType; confidence: number } {
    // Simple heuristic-based classification
    // In production, use machine learning models

    // STILL: low mean, low variance
    if (mean < 0.5 && stdDev < 0.3) {
      return { activity: ActivityType.STILL, confidence: 0.9 };
    }

    // WALKING: moderate mean, moderate variance
    if (mean >= 0.5 && mean < 2.0 && stdDev >= 0.3 && stdDev < 1.0) {
      return { activity: ActivityType.WALKING, confidence: 0.75 };
    }

    // RUNNING: high mean, high variance
    if (mean >= 2.0 && stdDev >= 1.0) {
      return { activity: ActivityType.RUNNING, confidence: 0.7 };
    }

    // IN_VEHICLE: low mean, very low variance (smooth movement)
    if (mean >= 0.2 && mean < 1.0 && stdDev < 0.2) {
      return { activity: ActivityType.IN_VEHICLE, confidence: 0.65 };
    }

    // Default: unknown
    return { activity: ActivityType.UNKNOWN, confidence: 0.3 };
  }

  /**
   * Calculate mean of array
   */
  private calculateMean(values: number[]): number {
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Calculate variance of array
   */
  private calculateVariance(values: number[], mean: number): number {
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return this.calculateMean(squaredDiffs);
  }

  /**
   * Get current activity
   */
  getCurrentActivity(): ActivityType {
    return this.currentActivity;
  }

  /**
   * Reset activity state
   */
  reset() {
    this.samples = [];
    this.currentActivity = ActivityType.UNKNOWN;
    this.log('Activity state reset');
  }
}
