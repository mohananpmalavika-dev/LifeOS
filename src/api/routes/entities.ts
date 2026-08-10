import express from "express";
import { lifeosService } from "../services/lifeos-service.js";

export const entitiesRoutes = express.Router();

/**
 * GET /api/entities
 * Get entities with optional filtering
 */
entitiesRoutes.get("/", (req, res) => {
  try {
    const { type, search, limit } = req.query;

    const entities = lifeosService.getEntities({
      type: type as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      count: entities.length,
      data: entities,
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
 * GET /api/entities/people
 * Get all people entities
 */
entitiesRoutes.get("/people", (req, res) => {
  try {
    const people = lifeosService.getEntities({ type: "Person" });

    res.json({
      success: true,
      count: people.length,
      data: people,
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
 * GET /api/entities/places
 * Get all place entities
 */
entitiesRoutes.get("/places", (req, res) => {
  try {
    const places = lifeosService.getEntities({ type: "Place" });

    res.json({
      success: true,
      count: places.length,
      data: places,
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
 * GET /api/entities/documents
 * Get all document entities
 */
entitiesRoutes.get("/documents", (req, res) => {
  try {
    const documents = lifeosService.getEntities({ type: "Document" });

    res.json({
      success: true,
      count: documents.length,
      data: documents,
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
 * GET /api/entities/events
 * Get all event entities
 */
entitiesRoutes.get("/events", (req, res) => {
  try {
    const events = lifeosService.getEntities({ type: "Event" });

    res.json({
      success: true,
      count: events.length,
      data: events,
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
 * GET /api/entities/:id
 * Get a specific entity by ID
 */
entitiesRoutes.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const entity = lifeosService.getEntity(id);

    if (!entity) {
      return res.status(404).json({
        success: false,
        error: "Entity not found",
        timestamp: new Date().toISOString(),
      });
    }

    const relatedEntities = lifeosService.getRelatedEntities(id);

    res.json({
      success: true,
      data: {
        entity,
        relatedEntities,
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
