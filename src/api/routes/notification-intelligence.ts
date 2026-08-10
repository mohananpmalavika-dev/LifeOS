/**
 * Notification Intelligence API Routes
 * 
 * Receives intelligently processed notification events from edge devices.
 * These are NOT raw notifications - they are structured, classified events.
 */

import express from 'express';
import type { LifeEvent, LifeEventBatch } from '../../types/life-event.js';
import { lifeosService } from '../services/lifeos-service.js';
import { NotificationIntelligenceService } from '../services/notification-intelligence-service.js';

export const notificationIntelligenceRoutes = express.Router();

const intelligenceService = new NotificationIntelligenceService();

/**
 * POST /api/notification-intelligence/event
 * Submit a single intelligently processed notification event
 */
notificationIntelligenceRoutes.post('/event', async (req, res) => {
  try {
    const event: LifeEvent = req.body;

    // Validate event structure
    if (!event.eventId || !event.userId || !event.type || !event.timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        timestamp: new Date().toISOString(),
      });
    }

    // Verify this is an intelligently processed event
    if (!event.metadata?.notificationCategory || !event.metadata?.notificationIntent) {
      return res.status(400).json({
        success: false,
        error: 'Event missing intelligence metadata. Submit raw notifications via /api/events',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`📱 Received intelligent notification: ${event.metadata.notificationIntent} from ${event.metadata.sourceAppName}`);

    // Process through intelligence service
    const result = await intelligenceService.processIntelligentEvent(event);

    res.json({
      success: true,
      data: {
        eventId: result.eventId,
        entityId: result.entityId,
        wasLinked: result.linkedToExisting,
        taskCreated: result.taskCreated,
        graphUpdated: result.graphUpdated,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error processing intelligent notification:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/notification-intelligence/batch
 * Submit a batch of intelligently processed notification events
 */
notificationIntelligenceRoutes.post('/batch', async (req, res) => {
  try {
    const batch: LifeEventBatch = req.body;

    // Validate batch
    if (!batch.deviceId || !batch.userId || !batch.events || !Array.isArray(batch.events)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch structure',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`📦 Received batch of ${batch.events.length} intelligent notifications from device ${batch.deviceId}`);

    // Process batch
    const results = await intelligenceService.processBatch(batch.events);

    res.json({
      success: true,
      data: {
        batchId: batch.batchId,
        processed: results.processed,
        linked: results.linked,
        tasksCreated: results.tasksCreated,
        graphUpdates: results.graphUpdates,
        errors: results.errors,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error processing batch:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/notification-intelligence/entity/:entityId
 * Get entity details built from notifications
 */
notificationIntelligenceRoutes.get('/entity/:entityId', async (req, res) => {
  try {
    const { entityId } = req.params;
    
    const entity = await intelligenceService.getEntity(entityId);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: entity,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/notification-intelligence/stats/:deviceId
 * Get notification intelligence statistics for a device
 */
notificationIntelligenceRoutes.get('/stats/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const stats = await intelligenceService.getDeviceStats(deviceId);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/notification-intelligence/entity-resolution
 * Manually trigger entity resolution for debugging
 */
notificationIntelligenceRoutes.post('/entity-resolution', async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: 'Missing eventId',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await intelligenceService.resolveEntity(eventId);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
