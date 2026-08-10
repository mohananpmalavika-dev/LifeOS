import express from "express";
import { lifeosService } from "../services/lifeos-service.js";

export const timelineRoutes = express.Router();

/**
 * GET /api/timeline
 * Get timeline events with optional filtering
 */
timelineRoutes.get("/", (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;

    const timeline = lifeosService.getTimeline({
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      count: timeline.length,
      data: timeline,
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
 * GET /api/timeline/today
 * Get today's timeline events
 */
timelineRoutes.get("/today", (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeline = lifeosService.getTimeline({
      startDate: today.toISOString(),
      endDate: tomorrow.toISOString(),
    });

    res.json({
      success: true,
      count: timeline.length,
      data: timeline,
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
 * GET /api/timeline/week
 * Get this week's timeline events
 */
timelineRoutes.get("/week", (req, res) => {
  try {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const timeline = lifeosService.getTimeline({
      startDate: startOfWeek.toISOString(),
      endDate: endOfWeek.toISOString(),
    });

    res.json({
      success: true,
      count: timeline.length,
      data: timeline,
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
