/**
 * Life Context API
 * 
 * Exposes fused life contexts derived from multiple event sources
 */

import { Router } from 'express';
import type { ApiResponse } from '../../types/life-event.js';
import { ContextFusionEngine, type FusedContext } from '../services/context-fusion.js';
import { eventsByUser, events } from './life-events.js';

const router = Router();

/**
 * GET /api/v1/life-context/current
 * Get current life context for a user
 */
router.get('/current', async (req, res) => {
  try {
    const { userId } = req.query;

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

    // Get recent events for user (last 2 hours)
    const userEventIds = eventsByUser.get(userId) || new Set();
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const recentEvents = Array.from(userEventIds)
      .map(id => events.get(id))
      .filter(e => e && new Date(e.timestamp) >= twoHoursAgo)
      .filter(Boolean) as any[];

    if (recentEvents.length === 0) {
      return res.json({
        success: true,
        data: {
          context: null,
          message: 'No recent events available for context fusion',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Fuse context
    const context = await ContextFusionEngine.getCurrentContext(userId, recentEvents);

    res.json({
      success: true,
      data: {
        context,
        eventsAnalyzed: recentEvents.length,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Context fusion error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_FUSION_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * GET /api/v1/life-context/analyze
 * Analyze all recent contexts (multiple contexts may be active)
 */
router.get('/analyze', async (req, res) => {
  try {
    const { userId, timeWindowMinutes = '60' } = req.query;

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

    const windowMinutes = parseInt(timeWindowMinutes as string, 10);
    
    // Get recent events for user
    const userEventIds = eventsByUser.get(userId) || new Set();
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

    const recentEvents = Array.from(userEventIds)
      .map(id => events.get(id))
      .filter(e => e && new Date(e.timestamp) >= windowStart)
      .filter(Boolean) as any[];

    if (recentEvents.length === 0) {
      return res.json({
        success: true,
        data: {
          contexts: [],
          message: 'No recent events available for context fusion',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Fuse all contexts
    const contexts = await ContextFusionEngine.fuseContext(recentEvents, windowMinutes);

    // Sort by confidence
    contexts.sort((a, b) => b.confidence - a.confidence);

    res.json({
      success: true,
      data: {
        contexts,
        eventsAnalyzed: recentEvents.length,
        timeWindowMinutes: windowMinutes,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Context analysis error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_ANALYSIS_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

/**
 * GET /api/v1/life-context/timeline
 * Get historical context timeline
 */
router.get('/timeline', async (req, res) => {
  try {
    const { userId, startTime, endTime } = req.query;

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

    // Get events within time range
    const userEventIds = eventsByUser.get(userId) || new Set();
    let userEvents = Array.from(userEventIds)
      .map(id => events.get(id))
      .filter(Boolean) as any[];

    if (startTime && typeof startTime === 'string') {
      userEvents = userEvents.filter(e => e.timestamp >= startTime);
    }

    if (endTime && typeof endTime === 'string') {
      userEvents = userEvents.filter(e => e.timestamp <= endTime);
    }

    // Sort by timestamp
    userEvents.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (userEvents.length === 0) {
      return res.json({
        success: true,
        data: {
          timeline: [],
          message: 'No events in specified time range',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }

    // Build context timeline by analyzing sliding windows
    const timeline: Array<{
      timestamp: string;
      context: FusedContext;
    }> = [];

    // Analyze in 30-minute intervals
    const intervalMinutes = 30;
    const start = new Date(userEvents[0].timestamp);
    const end = new Date(userEvents[userEvents.length - 1].timestamp);
    
    let currentTime = start;
    while (currentTime <= end) {
      const windowStart = currentTime;
      const windowEnd = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000);
      
      const windowEvents = userEvents.filter(e => {
        const eventTime = new Date(e.timestamp);
        return eventTime >= windowStart && eventTime < windowEnd;
      });

      if (windowEvents.length > 0) {
        const contexts = await ContextFusionEngine.fuseContext(windowEvents, intervalMinutes);
        if (contexts.length > 0) {
          // Get highest confidence context
          contexts.sort((a, b) => b.confidence - a.confidence);
          timeline.push({
            timestamp: currentTime.toISOString(),
            context: contexts[0],
          });
        }
      }

      currentTime = windowEnd;
    }

    res.json({
      success: true,
      data: {
        timeline,
        eventsAnalyzed: userEvents.length,
        timeRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);

  } catch (error: any) {
    console.error('Context timeline error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTEXT_TIMELINE_FAILED',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    } as ApiResponse);
  }
});

export { router as lifeContextRouter };
