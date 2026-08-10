/**
 * Local Event Pipeline
 * 
 * Coordinates all collectors and manages the event flow:
 * Collector → Local DB → Sync Queue → Backend
 */

import { LifeEvent } from '../core/LifeEvent';
import { EventDatabase } from '../storage/EventDatabase';
import { SyncManager, SyncConfig } from '../sync/SyncManager';
import { BaseCollector } from '../agent/BaseCollector';
import { NotificationCollector } from '../agent/notification/NotificationCollector';
import { CalendarCollector } from '../agent/calendar/CalendarCollector';
import { LocationCollector } from '../agent/location/LocationCollector';
import { ActivityCollector } from '../agent/activity/ActivityCollector';

export interface PipelineConfig {
  userId: string;
  deviceId: string;
  apiBaseUrl: string;
  
  collectors: {
    notification: any;
    calendar: any;
    location: any;
    activity: any;
  };
  
  sync: {
    enabled: boolean;
    batchSize: number;
    syncIntervalMs: number;
    retryAttempts: number;
    wifiOnly: boolean;
  };
}

export class EventPipeline {
  private config: PipelineConfig;
  private db: EventDatabase;
  private syncManager: SyncManager;
  
  private collectors: Map<string, BaseCollector> = new Map();
  private eventCount: number = 0;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.db = EventDatabase.getInstance();
    
    // Initialize sync manager
    const syncConfig: SyncConfig = {
      apiBaseUrl: config.apiBaseUrl,
      deviceId: config.deviceId,
      userId: config.userId,
      ...config.sync,
    };
    this.syncManager = new SyncManager(syncConfig);
    
    // Initialize collectors
    this.initializeCollectors();
  }

  /**
   * Initialize all collectors
   */
  private initializeCollectors() {
    // Notification collector
    if (this.config.collectors.notification.enabled) {
      const notificationCollector = new NotificationCollector(
        this.config.collectors.notification
      );
      notificationCollector.onEvent(this.handleEvent.bind(this));
      notificationCollector.onError(this.handleError.bind(this));
      this.collectors.set('notification', notificationCollector);
    }

    // Calendar collector
    if (this.config.collectors.calendar.enabled) {
      const calendarCollector = new CalendarCollector(
        this.config.collectors.calendar
      );
      calendarCollector.onEvent(this.handleEvent.bind(this));
      calendarCollector.onError(this.handleError.bind(this));
      this.collectors.set('calendar', calendarCollector);
    }

    // Location collector
    if (this.config.collectors.location.enabled) {
      const locationCollector = new LocationCollector(
        this.config.collectors.location
      );
      locationCollector.onEvent(this.handleEvent.bind(this));
      locationCollector.onError(this.handleError.bind(this));
      this.collectors.set('location', locationCollector);
    }

    // Activity collector
    if (this.config.collectors.activity.enabled) {
      const activityCollector = new ActivityCollector(
        this.config.collectors.activity
      );
      activityCollector.onEvent(this.handleEvent.bind(this));
      activityCollector.onError(this.handleError.bind(this));
      this.collectors.set('activity', activityCollector);
    }

    console.log(`[EventPipeline] Initialized ${this.collectors.size} collectors`);
  }

  /**
   * Start the entire pipeline
   */
  async start(): Promise<void> {
    try {
      console.log('[EventPipeline] Starting pipeline');

      // Start all collectors
      const startPromises = Array.from(this.collectors.values()).map(collector =>
        collector.start().catch(error => {
          console.error(`[EventPipeline] Failed to start ${collector.getName()}:`, error);
        })
      );

      await Promise.all(startPromises);

      // Start sync manager
      if (this.config.sync.enabled) {
        this.syncManager.start();
      }

      console.log('[EventPipeline] Pipeline started successfully');

    } catch (error) {
      console.error('[EventPipeline] Error starting pipeline:', error);
      throw error;
    }
  }

  /**
   * Stop the entire pipeline
   */
  async stop(): Promise<void> {
    try {
      console.log('[EventPipeline] Stopping pipeline');

      // Stop all collectors
      const stopPromises = Array.from(this.collectors.values()).map(collector =>
        collector.stop().catch(error => {
          console.error(`[EventPipeline] Failed to stop ${collector.getName()}:`, error);
        })
      );

      await Promise.all(stopPromises);

      // Stop sync manager
      this.syncManager.stop();

      console.log('[EventPipeline] Pipeline stopped');

    } catch (error) {
      console.error('[EventPipeline] Error stopping pipeline:', error);
      throw error;
    }
  }

  /**
   * Handle event from collectors
   */
  private async handleEvent(event: LifeEvent) {
    try {
      this.eventCount++;
      
      console.log(
        `[EventPipeline] Event received (${this.eventCount}): ${event.type} from ${event.source.collector}`
      );

      // Store in local database
      await this.db.storeEvent(event);

      // Trigger sync if needed (sync manager handles batching)
      // The sync manager will automatically pick up pending events

    } catch (error) {
      console.error('[EventPipeline] Error handling event:', error);
    }
  }

  /**
   * Handle error from collectors
   */
  private handleError(error: Error) {
    console.error('[EventPipeline] Collector error:', error);
    // Could implement error reporting here
  }

  /**
   * Get pipeline statistics
   */
  async getStats() {
    const dbStats = await this.db.getSyncStats();
    const syncStats = await this.syncManager.getStats();

    const collectorStats = Array.from(this.collectors.entries()).map(
      ([name, collector]) => ({
        name,
        status: collector.getStatus(),
        isRunning: collector.isRunning(),
      })
    );

    return {
      collectors: collectorStats,
      events: {
        collected: this.eventCount,
        ...dbStats,
      },
      sync: syncStats,
    };
  }

  /**
   * Get a specific collector
   */
  getCollector(name: string): BaseCollector | undefined {
    return this.collectors.get(name);
  }

  /**
   * Trigger immediate sync
   */
  async syncNow() {
    return this.syncManager.syncNow();
  }

  /**
   * Update sync configuration
   */
  updateSyncConfig(config: Partial<SyncConfig>) {
    this.syncManager.updateConfig(config);
  }
}
