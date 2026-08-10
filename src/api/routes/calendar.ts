/**
 * Calendar Intelligence API Routes
 */

import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { CalendarIntelligenceService } from '../../calendar/CalendarIntelligenceService';
import { LifeCalendarEvent } from '../../calendar/types';

export function createCalendarRoutes(db: Database.Database): Router {
  const router = Router();
  const calendarService = new CalendarIntelligenceService(db);
  
  /**
   * POST /api/calendar/events
   * Create or update calendar event
   */
  router.post('/events', async (req: Request, res: Response) => {
    try {
      const event: LifeCalendarEvent = req.body;
      
      // Validate required fields
      if (!event.id || !event.startTime || !event.endTime) {
        return res.status(400).json({
          error: 'Missing required fields: id, startTime, endTime'
        });
      }
      
      // Store event
      await calendarService.storeEvent(event);
      
      // Enrich event
      const enrichedEvent = await calendarService.enrichEvent(event);
      
      res.json({
        success: true,
        event: enrichedEvent
      });
    } catch (error) {
      console.error('Error creating calendar event:', error);
      res.status(500).json({
        error: 'Failed to create calendar event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * GET /api/calendar/events/:eventId
   * Get enriched calendar event
   */
  router.get('/events/:eventId', async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      
      const enrichedEvent = await calendarService.getEnrichedEvent(eventId);
      
      if (!enrichedEvent) {
        return res.status(404).json({
          error: 'Event not found'
        });
      }
      
      res.json({
        success: true,
        event: enrichedEvent
      });
    } catch (error) {
      console.error('Error getting calendar event:', error);
      res.status(500).json({
        error: 'Failed to get calendar event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * DELETE /api/calendar/events/:eventId
   * Delete calendar event
   */
  router.delete('/events/:eventId', async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      
      await calendarService.deleteEvent(eventId);
      
      res.json({
        success: true,
        message: 'Event deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      res.status(500).json({
        error: 'Failed to delete calendar event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * GET /api/calendar/schedule
   * Get schedule analysis for date range
   */
  router.get('/schedule', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required parameters: startDate, endDate'
        });
      }
      
      const analysis = await calendarService.analyzeSchedule(
        startDate as string,
        endDate as string
      );
      
      res.json({
        success: true,
        analysis
      });
    } catch (error) {
      console.error('Error analyzing schedule:', error);
      res.status(500).json({
        error: 'Failed to analyze schedule',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * GET /api/calendar/conflicts
   * Get conflicts for date range
   */
  router.get('/conflicts', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required parameters: startDate, endDate'
        });
      }
      
      const analysis = await calendarService.analyzeSchedule(
        startDate as string,
        endDate as string
      );
      
      // Extract all conflicts
      const allConflicts = analysis.dailyAnalysis.flatMap(day => day.conflicts);
      
      res.json({
        success: true,
        conflicts: allConflicts,
        summary: {
          total: allConflicts.length,
          byType: this.groupBy(allConflicts, 'type'),
          bySeverity: this.groupBy(allConflicts, 'severity')
        }
      });
    } catch (error) {
      console.error('Error getting conflicts:', error);
      res.status(500).json({
        error: 'Failed to get conflicts',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * GET /api/calendar/feasibility/:date
   * Get feasibility score for specific date
   */
  router.get('/feasibility/:date', async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      
      const analysis = await calendarService.analyzeSchedule(date, date);
      
      const dayAnalysis = analysis.dailyAnalysis[0];
      
      if (!dayAnalysis) {
        return res.status(404).json({
          error: 'No data for specified date'
        });
      }
      
      res.json({
        success: true,
        feasibility: dayAnalysis
      });
    } catch (error) {
      console.error('Error getting feasibility:', error);
      res.status(500).json({
        error: 'Failed to get feasibility',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * POST /api/calendar/sync
   * Bulk sync calendar events
   */
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      const { events } = req.body;
      
      if (!Array.isArray(events)) {
        return res.status(400).json({
          error: 'Events must be an array'
        });
      }
      
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      };
      
      for (const event of events) {
        try {
          await calendarService.storeEvent(event);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      res.json({
        success: true,
        results
      });
    } catch (error) {
      console.error('Error syncing calendar events:', error);
      res.status(500).json({
        error: 'Failed to sync calendar events',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * Helper: Group array by property
   */
  function groupBy(array: any[], property: string): Record<string, number> {
    return array.reduce((acc, item) => {
      const key = item[property];
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }
  
  return router;
}
