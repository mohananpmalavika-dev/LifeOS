/**
 * Base Collector Interface
 * 
 * All collectors (notification, calendar, location, activity) extend this base.
 */

import { LifeEvent } from '../core/LifeEvent';

export enum CollectorStatus {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}

export interface CollectorConfig {
  enabled: boolean;
  samplingIntervalMs?: number;
  batchEvents?: boolean;
  permissions?: string[];
}

export abstract class BaseCollector {
  protected status: CollectorStatus = CollectorStatus.STOPPED;
  protected config: CollectorConfig;
  protected eventCallback?: (event: LifeEvent) => void;
  protected errorCallback?: (error: Error) => void;

  constructor(config: CollectorConfig) {
    this.config = config;
  }

  /**
   * Start the collector
   */
  abstract start(): Promise<void>;

  /**
   * Stop the collector
   */
  abstract stop(): Promise<void>;

  /**
   * Check if collector has required permissions
   */
  abstract checkPermissions(): Promise<boolean>;

  /**
   * Request required permissions
   */
  abstract requestPermissions(): Promise<boolean>;

  /**
   * Get collector name
   */
  abstract getName(): string;

  /**
   * Set event callback
   */
  onEvent(callback: (event: LifeEvent) => void) {
    this.eventCallback = callback;
  }

  /**
   * Set error callback
   */
  onError(callback: (error: Error) => void) {
    this.errorCallback = callback;
  }

  /**
   * Get current status
   */
  getStatus(): CollectorStatus {
    return this.status;
  }

  /**
   * Check if collector is running
   */
  isRunning(): boolean {
    return this.status === CollectorStatus.RUNNING;
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<CollectorConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Emit event to callback
   */
  protected emitEvent(event: LifeEvent) {
    if (this.eventCallback) {
      this.eventCallback(event);
    }
  }

  /**
   * Emit error to callback
   */
  protected emitError(error: Error) {
    if (this.errorCallback) {
      this.errorCallback(error);
    } else {
      console.error(`[${this.getName()}] Error:`, error);
    }
  }

  /**
   * Log collector activity
   */
  protected log(message: string, ...args: any[]) {
    console.log(`[${this.getName()}] ${message}`, ...args);
  }
}
