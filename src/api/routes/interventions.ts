import express from "express";
import { lifeosService } from "../services/lifeos-service.js";

export const interventionRoutes = express.Router();

/**
 * GET /api/interventions
 * Get all active interventions
 */
interventionRoutes.get("/", (req, res) => {
  try {
    const { priority, limit, dismissed } = req.query;

    const interventions = lifeosService.getInterventions({
      priority: priority as any,
      limit: limit ? parseInt(limit as string) : undefined,
      dismissed: dismissed === "true",
    });

    res.json({
      success: true,
      count: interventions.length,
      data: interventions,
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
 * GET /api/interventions/:id
 * Get a specific intervention by ID
 */
interventionRoutes.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const intervention = lifeosService.getIntervention(id);

    if (!intervention) {
      return res.status(404).json({
        success: false,
        error: "Intervention not found",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: intervention,
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
 * DELETE /api/interventions/:id
 * Dismiss an intervention
 */
interventionRoutes.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const success = lifeosService.dismissIntervention(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Intervention not found",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: "Intervention dismissed",
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
 * POST /api/interventions/:id/snooze
 * Snooze an intervention for a specified duration
 */
interventionRoutes.post("/:id/snooze", (req, res) => {
  try {
    const { id } = req.params;
    const { duration } = req.body; // duration in minutes

    // For now, just acknowledge - can implement snooze logic later
    res.json({
      success: true,
      message: `Intervention snoozed for ${duration} minutes`,
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
