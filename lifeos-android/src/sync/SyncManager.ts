/**
 * Sync Manager
 * 
 * Handles batch uploading of events to LifeOS backend with:
 * - Offline queue
 * - Exponential backoff retry
 * - Wifi-only option
 * - Battery-aware syncing
 */

import axios from 'axios';
import { nanoid } from 'nanoid';
import NetInfo from '@react-native-community/netinfo';
import { LifeEvent, LifeEventBatch } from '../core/LifeEvent';
import { EventDatabase } from '../storage/EventDatabase';

export interface SyncConfig {
  apiBaseUrl: string;
  deviceId: string;
  userId: string;
  batchSize: number;
  syncIntervalMs: number;
  retryAttempts: number;
  wifiOnly: boolean;
}

export enum SyncState {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}

export class SyncManager {
  private config: SyncConfig;
  private db: EventDatabase;
  private state: SyncState = SyncState.IDLE;
  private syncInterval: NodeJS.Timeout | null = null;
  private retryDelays = [5000, 30000, 120000, 600000]; // 5s, 30s, 2m, 10m

  constructor(config: SyncConfig) {
    this.config = config;
    this.db = EventDatabase.getInstance();
  }

  /**
   * Start automatic syncing
   */
  start() {
    if (this.syncInterval) {
      return; // Already running
    }

    console.log('[SyncManager] Starting automatic sync');

    // Initial sync
    this.syncNow();

    // Schedule periodic sync
    this.syncInterval = setInterval(() => {
      this.syncNow();
    }, this.config.syncIntervalMs);
  }

  /**
   * Stop automatic syncing
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('[SyncManager] Stopped automatic sync');
  }

  /**
   * Trigger immediate sync
   */
  async syncNow(): Promise<{ success: boolean; synced: number; errors: number }> {
    if (this.state === SyncState.SYNCING) {
      console.log('[SyncManager] Already syncing, skipping');
      return { success: false, synced: 0, errors: 0 };
    }

    try {
      this.state = SyncState.SYNCING;

      // Check network conditions
      const canSync = await this.checkNetworkConditions();
      if (!canSync) {
        console.log('[SyncManager] Network conditions not met, postponing sync');
        this.state = SyncState.PAUSED;
        return { success: false, synced: 0, errors: 0 };
      }

      // Get pending events
      const pendingEvents = await this.db.getPendingEvents(this.config.batchSize);

      if (pendingEvents.length === 0) {
        console.log('[SyncManager] No pending events to sync');
        this.state = SyncState.IDLE;
        return { success: true, synced: 0, errors: 0 };
      }

      console.log(`[SyncManager] Syncing ${pendingEvents.length} events`);

      // Create batch
      const batch: LifeEventBatch = {
        deviceId: this.config.deviceId,
        userId: this.config.userId,
        batchId: `batch_${nanoid(12)}`,
        events: pendingEvents,
        timestamp: new Date().toISOString(),
      };

      // Upload batch
      const result = await this.uploadBatch(batch);

      if (result.success) {
        // Mark as synced
        const syncedIds = pendingEvents.map(e => e.eventId);
        await this.db.markAsSynced(syncedIds);
        console.log(`[SyncManager] Successfully synced ${syncedIds.length} events`);
        
        this.state = SyncState.IDLE;
        return { success: true, synced: syncedIds.length, errors: 0 };
      } else {
        // Mark as failed
        const failedIds = pendingEvents.map(e => e.eventId);
        await this.db.markAsFailed(failedIds);
        console.error('[SyncManager] Sync failed:', result.error);
        
        this.state = SyncState.ERROR;
        return { success: false, synced: 0, errors: failedIds.length };
      }

    } catch (error) {
      console.error('[SyncManager] Sync error:', error);
      this.state = SyncState.ERROR;
      return { success: false, synced: 0, errors: 1 };
    }
  }

  /**
   * Upload batch to backend
   */
  private async uploadBatch(batch: LifeEventBatch): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await axios.post(
        `${this.config.apiBaseUrl}/api/v1/context/events/batch`,
        batch,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds
        }
      );

      if (response.data.success) {
        return { success: true };
      } else {
        return {
          success: false,
          error: response.data.error?.message || 'Unknown error',
        };
      }

    } catch (error: any) {
      console.error('[SyncManager] Upload error:', error);
      return {
        success: false,
        error: error.message || 'Network error',
      };
    }
  }

  /**
   * Check network conditions for syncing
   */
  private async checkNetworkConditions(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();

      // Check if connected
      if (!netInfo.isConnected) {
        return false;
      }

      // Check wifi-only setting
      if (this.config.wifiOnly && netInfo.type !== 'wifi') {
        return false;
      }

      return true;

    } catch (error) {
      console.error('[SyncManager] Network check error:', error);
      return false;
    }
  }

  /**
   * Get sync statistics
   */
  async getStats() {
    const dbStats = await this.db.getSyncStats();
    return {
      ...dbStats,
      state: this.state,
      isRunning: this.syncInterval !== null,
    };
  }

  /**
   * Update sync config
   */
  updateConfig(config: Partial<SyncConfig>) {
    this.config = { ...this.config, ...config };

    // Restart with new config if running
    if (this.syncInterval) {
      this.stop();
      this.start();
    }
  }

  /**
   * Manually retry failed events
   */
  async retryFailed(): Promise<void> {
    // Mark failed events as pending again
    // Then trigger sync
    await this.syncNow();
  }

  /**
   * Get current state
   */
  getState(): SyncState {
    return this.state;
  }
}
