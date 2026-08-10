/**
 * Local Event Database
 * 
 * SQLite database for storing events before sync.
 * This ensures reliability even when offline.
 */

import * as SQLite from 'expo-sqlite';
import { LifeEvent } from '../core/LifeEvent';

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCING = 'SYNCING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
  RETRY = 'RETRY',
}

export interface StoredEvent {
  id: number;
  eventId: string;
  userId: string;
  deviceId: string;
  eventData: string; // JSON string
  syncStatus: SyncStatus;
  retryCount: number;
  createdAt: string;
  syncedAt?: string;
}

export class EventDatabase {
  private db: SQLite.WebSQLDatabase;
  private static instance: EventDatabase | null = null;

  private constructor() {
    this.db = SQLite.openDatabase('lifeos_events.db');
    this.initialize();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EventDatabase {
    if (!this.instance) {
      this.instance = new EventDatabase();
    }
    return this.instance;
  }

  /**
   * Initialize database schema
   */
  private initialize() {
    this.db.transaction(tx => {
      // Events table
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          eventId TEXT UNIQUE NOT NULL,
          userId TEXT NOT NULL,
          deviceId TEXT NOT NULL,
          eventData TEXT NOT NULL,
          syncStatus TEXT NOT NULL DEFAULT 'PENDING',
          retryCount INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL,
          syncedAt TEXT,
          INDEX idx_sync_status (syncStatus),
          INDEX idx_created_at (createdAt)
        );`
      );

      // Sync queue table (for batch operations)
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batchId TEXT UNIQUE NOT NULL,
          eventIds TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          createdAt TEXT NOT NULL,
          syncedAt TEXT
        );`
      );
    });
  }

  /**
   * Store a single event
   */
  async storeEvent(event: LifeEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO events (eventId, userId, deviceId, eventData, syncStatus, createdAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            event.eventId,
            event.userId,
            event.deviceId || '',
            JSON.stringify(event),
            SyncStatus.PENDING,
            event.createdAt || new Date().toISOString(),
          ],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Store multiple events
   */
  async storeEvents(events: LifeEvent[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        events.forEach(event => {
          tx.executeSql(
            `INSERT OR REPLACE INTO events (eventId, userId, deviceId, eventData, syncStatus, createdAt)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              event.eventId,
              event.userId,
              event.deviceId || '',
              JSON.stringify(event),
              SyncStatus.PENDING,
              event.createdAt || new Date().toISOString(),
            ]
          );
        });
      }, reject, resolve);
    });
  }

  /**
   * Get pending events (not yet synced)
   */
  async getPendingEvents(limit: number = 100): Promise<LifeEvent[]> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT eventData FROM events 
           WHERE syncStatus = ? 
           ORDER BY createdAt ASC 
           LIMIT ?`,
          [SyncStatus.PENDING, limit],
          (_, result) => {
            const events: LifeEvent[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              try {
                const event = JSON.parse(result.rows.item(i).eventData);
                events.push(event);
              } catch (e) {
                console.error('Failed to parse event:', e);
              }
            }
            resolve(events);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Mark events as synced
   */
  async markAsSynced(eventIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        const placeholders = eventIds.map(() => '?').join(',');
        tx.executeSql(
          `UPDATE events 
           SET syncStatus = ?, syncedAt = ? 
           WHERE eventId IN (${placeholders})`,
          [SyncStatus.SYNCED, new Date().toISOString(), ...eventIds],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Mark events as failed
   */
  async markAsFailed(eventIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        const placeholders = eventIds.map(() => '?').join(',');
        tx.executeSql(
          `UPDATE events 
           SET syncStatus = ?, retryCount = retryCount + 1 
           WHERE eventId IN (${placeholders})`,
          [SyncStatus.FAILED, ...eventIds],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    pending: number;
    synced: number;
    failed: number;
    total: number;
  }> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT 
            SUM(CASE WHEN syncStatus = 'PENDING' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN syncStatus = 'SYNCED' THEN 1 ELSE 0 END) as synced,
            SUM(CASE WHEN syncStatus = 'FAILED' THEN 1 ELSE 0 END) as failed,
            COUNT(*) as total
           FROM events`,
          [],
          (_, result) => {
            const row = result.rows.item(0);
            resolve({
              pending: row.pending || 0,
              synced: row.synced || 0,
              failed: row.failed || 0,
              total: row.total || 0,
            });
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Clean up old synced events
   */
  async cleanupOldEvents(daysToKeep: number = 7): Promise<number> {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffISO = cutoffDate.toISOString();

      this.db.transaction(tx => {
        tx.executeSql(
          `DELETE FROM events 
           WHERE syncStatus = ? AND syncedAt < ?`,
          [SyncStatus.SYNCED, cutoffISO],
          (_, result) => resolve(result.rowsAffected),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Get all events (for debugging)
   */
  async getAllEvents(): Promise<LifeEvent[]> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT eventData FROM events ORDER BY createdAt DESC LIMIT 1000`,
          [],
          (_, result) => {
            const events: LifeEvent[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              try {
                const event = JSON.parse(result.rows.item(i).eventData);
                events.push(event);
              } catch (e) {
                console.error('Failed to parse event:', e);
              }
            }
            resolve(events);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Clear all events (use with caution!)
   */
  async clearAllEvents(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM events',
          [],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }
}
