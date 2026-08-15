import Database from 'better-sqlite3';
import { LifeEvent } from '../../types/life-event.js';

export interface DeviceStateData {
  deviceId: string;
  batteryLevel: number;
  isCharging: boolean;
  isOnline: boolean;
  networkType?: string; // 'WIFI' | 'CELLULAR' | 'NONE'
  observedAt: string;
}

export class DeviceStateManager {
  constructor(private db: Database.Database) {
    this.initializeTables();
  }

  private initializeTables(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS device_state (
          device_id TEXT PRIMARY KEY,
          battery_level INTEGER NOT NULL,
          is_charging INTEGER NOT NULL,
          is_online INTEGER NOT NULL,
          network_type TEXT,
          observed_at TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {
      console.error('Error initializing device_state table:', e);
    }
  }

  recordState(state: DeviceStateData): void {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO device_state (
          device_id, battery_level, is_charging, is_online, network_type, observed_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        state.deviceId,
        state.batteryLevel,
        state.isCharging ? 1 : 0,
        state.isOnline ? 1 : 0,
        state.networkType || 'UNKNOWN',
        state.observedAt
      );
    } catch (e) {
      console.error('Error recording device state:', e);
    }
  }

  getLatestState(deviceId = 'primary_device'): DeviceStateData | null {
    try {
      const row = this.db.prepare(`
        SELECT device_id as deviceId, battery_level as batteryLevel, is_charging as isCharging, is_online as isOnline, network_type as networkType, observed_at as observedAt
        FROM device_state
        WHERE device_id = ? OR device_id = 'primary_device'
        ORDER BY observed_at DESC
        LIMIT 1
      `).get(deviceId) as any;

      if (!row) return null;

      return {
        deviceId: row.deviceId,
        batteryLevel: row.batteryLevel,
        isCharging: Boolean(row.isCharging),
        isOnline: Boolean(row.isOnline),
        networkType: row.networkType,
        observedAt: row.observedAt
      };
    } catch {
      return null;
    }
  }
}
