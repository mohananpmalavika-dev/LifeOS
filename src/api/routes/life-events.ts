/**
 * Life Events Ingestion API
 * 
 * Receives events from Android/iOS devices and feeds them into the LifeOS Core.
 */

import { Router } from 'express';
import { nanoid } from 'nanoid';
import type { 
  LifeEvent, 
  LifeEventBatch,
  ApiResponse,
  SyncStatus 
} from '../../types/life-event.js';
import { devices } from './devices.js';
import { EventProcessor } from '../services/event-processor.js';
import Database from 'better-sqlite3';
import path from 'path';
import { CalendarIntelligenceService } from '../../calendar/CalendarIntelligenceService.js';
import { CalendarContextBridge } from '../../calendar/CalendarContextBridge.js';

// Initialize database and calendar services
const dbPath = process.env.DB_PATH || path.join(process.cwd(), "lifeos.db");
const db = new Database(dbPath);
const calendarService = new CalendarIntelligenceService(db);
const calendarBridge = new CalendarContextBridge(db, calendarService);

const router = Router();

// Event storage (replace with proper database)
const events = new Map<string, LifeEvent>();
const eventsByUser = new Map<string, Set<string>>();
const eventsByDevice = new Map<string, Set<string>>();
const pendingSync = new Map<string, Set<string>>();
const syncStats = new Map<string, SyncStatus>();

/**
 * POST /api/v1/context/events
 * Ingest a single event
 */
router.post('/events', async (req, res) => {
  try {
    const event: LifeEvent = req.body;

    // Validation
    if (!event.userId || !event.type || !event.timestamp) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EVENT',
          message: 'Missing required fields: userId, type, timestamp',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Validate device if provided
    if (event.deviceId) {
      const device = devices.get(event.deviceId);
      if (!device) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: 'Device not registered',
          },
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }

      // Verify user matches
      if (device.userId !== event.userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'USER_MISMATCH',
            message: 'Device does not belong to user',
          },
          timestamp: new Date().toISOString(),
        } as ApiResponse);
      }
    }

    // Generate event ID if not provided
    if (!event.eventId) {
      event.eventId = `evt_${nanoid(16)}`;
    }

    // Process event through normalization and deduplication pipeline
    const result = EventProcessor.process(event);

    // If duplicate, return early with reference to original
    if (result.isDuplicate && result.duplicateOf) {
      console.log(`🔄 Duplicate event detected: ${event.eventId} -> ${result.duplicateOf}`);
      return res.json({
        success: true,
        data: {
          eventId: result.event.eventId,
          received: true,
          duplicate: true,
          duplicateOf: result.duplicateOf,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Use processed event
    const processedEvent = result.event;

    // Add system timestamps
    processedEvent.createdAt = new Date().toISOString();

    // Store event
    events.set(processedEvent.eventId, processedEvent);

    // Index by user
    if (!eventsByUser.has(processedEvent.userId)) {
      eventsByUser.set(processedEvent.userId, new Set());
    }
    eventsByUser.get(processedEvent.userId)!.add(processedEvent.eventId);

    // Index by device
    if (processedEvent.deviceId) {
      if (!eventsByDevice.has(processedEvent.deviceId)) {
        eventsByDevice.set(processedEvent.deviceId, new Set());
      }
      eventsByDevice.get(processedEvent.deviceId)!.add(processedEvent.eventId);
    }

    console.log(`📊 Event received: ${processedEvent.type} from ${processedEvent.deviceId || 'unknown'}`);

    res.json({
      success: true,
      data: {
        eventId: processedEvent.eventId,
        received: true,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Event ingestion error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INGESTION_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * POST /api/v1/context/events/batch
 * Ingest multiple events efficiently
 */
router.post('/events/batch', async (req, res) => {
  try {
    const batch: LifeEventBatch = req.body;

    // Validation
    if (!batch.userId || !batch.deviceId || !Array.isArray(batch.events)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BATCH',
          message: 'Missing required fields: userId, deviceId, events',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Validate device
    const device = devices.get(batch.deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'Device not registered',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Verify user matches
    if (device.userId !== batch.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_MISMATCH',
          message: 'Device does not belong to user',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    const processedEvents: string[] = [];
    const failedEvents: Array<{ index: number; reason: string }> = [];
    const duplicateEvents: Array<{ eventId: string; duplicateOf: string }> = [];

    // Process batch through pipeline
    const batchResult = EventProcessor.processBatch(batch.events);

    // Handle processed events
    for (const event of batchResult.processed) {
      try {
        // Ensure userId and deviceId match batch
        event.userId = batch.userId;
        event.deviceId = batch.deviceId;

        // Store event
        events.set(event.eventId, event);

        // Index by user
        if (!eventsByUser.has(event.userId)) {
          eventsByUser.set(event.userId, new Set());
        }
        eventsByUser.get(event.userId)!.add(event.eventId);

        // Index by device
        if (!eventsByDevice.has(event.deviceId)) {
          eventsByDevice.set(event.deviceId, new Set());
        }
        eventsByDevice.get(event.deviceId)!.add(event.eventId);

        processedEvents.push(event.eventId);

      } catch (error: any) {
        failedEvents.push({
          index: batch.events.indexOf(event),
          reason: error.message,
        });
      }
    }

    // Track duplicates
    duplicateEvents.push(...batchResult.duplicates);

    // Track errors
    failedEvents.push(...batchResult.errors);

    // Update sync stats
    const stats = syncStats.get(batch.deviceId) || {
      pendingEvents: 0,
      syncedEvents: 0,
      failedEvents: 0,
    };
    stats.lastSyncAt = new Date().toISOString();
    stats.syncedEvents += processedEvents.length;
    stats.failedEvents += failedEvents.length;
    syncStats.set(batch.deviceId, stats);

    console.log(`📊 Batch received: ${processedEvents.length} events from ${batch.deviceId}`);
    if (duplicateEvents.length > 0) {
      console.log(`🔄 ${duplicateEvents.length} duplicates detected in batch`);
    }
    if (failedEvents.length > 0) {
      console.warn(`⚠️  ${failedEvents.length} events failed in batch`);
    }

    res.json({
      success: true,
      data: {
        batchId: batch.batchId,
        processed: processedEvents.length,
        duplicates: duplicateEvents.length,
        failed: failedEvents.length,
        duplicateEvents: duplicateEvents.length > 0 ? duplicateEvents : undefined,
        failedEvents: failedEvents.length > 0 ? failedEvents : undefined,
        eventIds: processedEvents,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Batch ingestion error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_INGESTION_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * GET /api/v1/context/sync
 * Get sync status for a device
 */
router.get('/sync', async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing deviceId',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    const stats = syncStats.get(deviceId) || {
      pendingEvents: 0,
      syncedEvents: 0,
      failedEvents: 0,
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Sync status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYNC_STATUS_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * GET /api/v1/context/events
 * Query events for a user
 */
router.get('/events', async (req, res) => {
  try {
    const { userId, deviceId, type, startTime, endTime, limit = '100' } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing userId',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Get all events for user
    const userEventIds = eventsByUser.get(userId) || new Set();
    let userEvents = Array.from(userEventIds)
      .map(id => events.get(id))
      .filter(Boolean) as LifeEvent[];

    // Apply filters
    if (deviceId && typeof deviceId === 'string') {
      userEvents = userEvents.filter(e => e.deviceId === deviceId);
    }

    if (type && typeof type === 'string') {
      userEvents = userEvents.filter(e => e.type === type);
    }

    if (startTime && typeof startTime === 'string') {
      userEvents = userEvents.filter(e => e.timestamp >= startTime);
    }

    if (endTime && typeof endTime === 'string') {
      userEvents = userEvents.filter(e => e.timestamp <= endTime);
    }

    // Sort by timestamp descending
    userEvents.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply limit
    const limitNum = parseInt(limit as string, 10);
    userEvents = userEvents.slice(0, limitNum);

    res.json({
      success: true,
      data: {
        events: userEvents,
        count: userEvents.length,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Event query error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'QUERY_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * POST /api/v1/context/events/calendar-sync
 * Sync calendar events to context system
 */
router.post('/events/calendar-sync', async (req, res) => {
  try {
    const { events: calendarEvents, deviceId = 'system' } = req.body;

    if (!Array.isArray(calendarEvents)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'events must be an array',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Sync calendar events through the bridge
    const result = await calendarBridge.syncCalendarToContext(calendarEvents, deviceId);

    console.log(`📅 Calendar sync: ${result.synced} events synced, ${result.interventions} interventions generated`);

    res.json({
      success: true,
      data: {
        synced: result.synced,
        failed: result.failed,
        interventions: result.interventions,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Calendar sync error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CALENDAR_SYNC_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * GET /api/v1/context/calendar-context
 * Get enriched calendar context for time window
 */
router.get('/calendar-context', async (req, res) => {
  try {
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing startTime or endTime',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    const context = await calendarBridge.getCalendarContext(
      startTime as string,
      endTime as string
    );

    res.json({
      success: true,
      data: context,
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Calendar context error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_RETRIEVAL_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

export { router as lifeEventsRouter, events, eventsByUser };
