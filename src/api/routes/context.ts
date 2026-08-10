import express from "express";
import { lifeosService } from "../services/lifeos-service.js";

export const contextRoutes = express.Router();

/**
 * GET /api/context/graph
 * Get the entire context graph
 */
contextRoutes.get("/graph", (req, res) => {
  try {
    const entities = lifeosService.getEntities();
    const relations = lifeosService.getRelations();

    res.json({
      success: true,
      data: {
        entities,
        relations,
        stats: {
          entityCount: entities.length,
          relationCount: relations.length,
        },
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
 * GET /api/context/graph/:entityId
 * Get a specific entity and its relationships
 */
contextRoutes.get("/graph/:entityId", (req, res) => {
  try {
    const { entityId } = req.params;
    const entity = lifeosService.getEntity(entityId);

    if (!entity) {
      return res.status(404).json({
        success: false,
        error: "Entity not found",
        timestamp: new Date().toISOString(),
      });
    }

    const relations = lifeosService.getRelations({
      sourceId: entityId,
    }).concat(
      lifeosService.getRelations({
        targetId: entityId,
      })
    );

    const relatedEntities = lifeosService.getRelatedEntities(entityId);

    res.json({
      success: true,
      data: {
        entity,
        relations,
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

/**
 * GET /api/context/relations
 * Get relations with optional filtering
 */
contextRoutes.get("/relations", (req, res) => {
  try {
    const { sourceId, targetId, type } = req.query;

    const relations = lifeosService.getRelations({
      sourceId: sourceId as string,
      targetId: targetId as string,
      type: type as string,
    });

    res.json({
      success: true,
      count: relations.length,
      data: relations,
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
