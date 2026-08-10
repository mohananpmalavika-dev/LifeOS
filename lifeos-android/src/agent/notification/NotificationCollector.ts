/**
 * Notification Collector (Enhanced)
 * 
 * Monitors Android notifications and processes them through the
 * Notification Intelligence Engine for local processing and extraction.
 */

import * as Notifications from 'expo-notifications';
import { BaseCollector, CollectorStatus } from '../BaseCollector';
import { LifeEvent } from '../../core/LifeEvent';
import { NotificationIntelligenceEngine, ProcessingResult } from './NotificationIntelligenceEngine';
import { RawNotification } from './NotificationNormalizer';
import { EventDatabase } from '../../storage/EventDatabase';

export interface NotificationCollectorConfig {
  enabled: boolean;
  userId: string;
  deviceId: string;
  appVersion: string;
  filterSystemNotifications?: boolean;
  enableDiagnostics?: boolean;
}

export class NotificationCollector extends BaseCollector {
  private notificationSubscription: any = null;
  private config: NotificationCollectorConfig;
  private intelligenceEngine: NotificationIntelligenceEngine;
  private database: EventDatabase;
  private processingQueue: RawNotification[] = [];

  constructor(config: NotificationCollectorConfig, database: EventDatabase) {
    super({
      enabled: config.enabled,
      permissions: ['notifications'],
    });
    this.config = config;
    this.database = database;
    
    // Initialize Notification Intelligence Engine
    this.intelligenceEngine = new NotificationIntelligenceEngine({
      userId: config.userId,
      deviceId: config.deviceId,
      appVersion: config.appVersion,
    });
  }

  getName(): string {
    return 'NotificationIntelligenceCollector';
  }

  async checkPermissions(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  async requestPermissions(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async start(): Promise<void> {
    try {
      this.status = CollectorStatus.STARTING;
      this.log('🚀 Starting Notification Intelligence Engine');

      // Check permissions
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Notification permissions not granted');
        }
      }

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Subscribe to notification events
      this.notificationSubscription = Notifications.addNotificationReceivedListener(
        this.handleNotification.bind(this)
      );

      this.status = CollectorStatus.RUNNING;
      this.log('✓ Notification Intelligence Engine running');

    } catch (error: any) {
      this.status = CollectorStatus.ERROR;
      this.emitError(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.log('Stopping Notification Intelligence Engine');

      if (this.notificationSubscription) {
        this.notificationSubscription.remove();
        this.notificationSubscription = null;
      }

      // Log final statistics
      const stats = this.intelligenceEngine.getStats();
      const efficiency = this.intelligenceEngine.getEfficiencyRatio();
      
      this.log('📊 Final Statistics:');
      this.log(`  Total processed: ${stats.totalProcessed}`);
      this.log(`  Relevant: ${stats.relevant} (${efficiency.relevanceRate.toFixed(1)}%)`);
      this.log(`  Synced: ${stats.synced} (${efficiency.syncRate.toFixed(1)}%)`);
      this.log(`  Filtered: ${stats.irrelevant + stats.discarded} (${efficiency.filterRate.toFixed(1)}%)`);
      this.log(`  Avg processing: ${stats.averageProcessingTime.toFixed(0)}ms`);

      this.status = CollectorStatus.STOPPED;
      this.log('✓ Notification Intelligence Engine stopped');

    } catch (error: any) {
      this.emitError(error);
      throw error;
    }
  }

  /**
   * Handle incoming notification through Intelligence Engine
   */
  private async handleNotification(notification: Notifications.Notification) {
    try {
      const request = notification.request;
      const content = request.content;

      // Extract raw notification data
      const raw: RawNotification = {
        id: request.identifier,
        packageName: content.data?.package || 'unknown',
        appName: content.data?.appName,
        title: content.title || undefined,
        text: content.body || undefined,
        subText: content.subtitle || undefined,
        timestamp: notification.date,
        category: content.categoryIdentifier,
        channelId: content.data?.channelId,
        priority: content.data?.priority,
      };

      // Filter system notifications if configured
      if (this.config.filterSystemNotifications) {
        if (raw.packageName.startsWith('android.') || 
            raw.packageName.startsWith('com.android.')) {
          this.log('⊘ Skipping system notification');
          return;
        }
      }

      // Process through Intelligence Engine
      const result = await this.intelligenceEngine.process(raw);

      // Store raw notification temporarily (will be cleaned up)
      await this.storeRawNotification(raw);

      // Handle processing result
      await this.handleProcessingResult(result);

    } catch (error: any) {
      this.log('❌ Error processing notification:', error);
      this.emitError(error);
    }
  }

  /**
   * Handle processing result
   */
  private async handleProcessingResult(result: ProcessingResult): Promise<void> {
    if (!result.event) {
      // Notification was filtered out
      this.log(`⊘ Filtered: ${result.reason}`);
      return;
    }

    // Store processed event locally
    await this.database.storeEvent(result.event);
    this.log(`💾 Stored event: ${result.event.eventId}`);

    // Emit event for potential immediate use
    this.emitEvent(result.event);

    // Queue for sync if appropriate
    if (result.shouldSync && result.structuredEvent) {
      await this.queueForSync(result.event, result.structuredEvent);
      this.log(`☁️ Queued for sync: ${result.event.eventId}`);
    } else {
      this.log(`📱 Local-only: ${result.event.eventId}`);
    }
  }

  /**
   * Store raw notification temporarily
   */
  private async storeRawNotification(raw: RawNotification): Promise<void> {
    try {
      await this.database.storeRawNotification(raw);
    } catch (error) {
      this.log('Warning: Failed to store raw notification', error);
    }
  }

  /**
   * Queue event for server sync
   */
  private async queueForSync(event: LifeEvent, structuredEvent: any): Promise<void> {
    try {
      await this.database.queueForSync(event.eventId, {
        event,
        structuredEvent,
        queuedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.log('Warning: Failed to queue for sync', error);
    }
  }

  /**
   * Get processing statistics
   */
  getStatistics() {
    return {
      stats: this.intelligenceEngine.getStats(),
      efficiency: this.intelligenceEngine.getEfficiencyRatio(),
    };
  }

  /**
   * Get recent processing history
   */
  getHistory(limit?: number) {
    return this.intelligenceEngine.getHistory(limit);
  }

  /**
   * Process notification with diagnostic logging
   */
  async processDiagnostic(raw: RawNotification) {
    if (!this.config.enableDiagnostics) {
      throw new Error('Diagnostics not enabled');
    }
    return this.intelligenceEngine.processDiagnostic(raw);
  }
}
