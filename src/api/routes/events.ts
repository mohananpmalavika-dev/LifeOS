import express from "express";
import { lifeosService } from "../services/lifeos-service.js";
import type { NormalizedEvent } from "../../types.js";

export const eventsRoutes = express.Router();

/**
 * POST /api/events
 * Submit a new event for processing
 */
eventsRoutes.post("/", async (req, res) => {
  try {
    const event: NormalizedEvent = req.body;

    // Validate required fields
    if (!event.id || !event.event || !event.source || !event.timestamp) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: id, event, source, timestamp",
        timestamp: new Date().toISOString(),
      });
    }

    // Process the event
    const result = await lifeosService.processEvent(event);

    res.json({
      success: true,
      data: {
        event: result.event,
        confidence: result.confidence,
        intervention: result.intervention,
      },
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
 * POST /api/events/publish
 * Publish an event to the event bus
 */
eventsRoutes.post("/publish", (req, res) => {
  try {
    const event: NormalizedEvent = req.body;

    // Validate required fields
    if (!event.id || !event.event || !event.source || !event.timestamp) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: id, event, source, timestamp",
        timestamp: new Date().toISOString(),
      });
    }

    // Publish to event bus (async processing)
    lifeosService.publishEvent(event);

    res.json({
      success: true,
      message: "Event published successfully",
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
