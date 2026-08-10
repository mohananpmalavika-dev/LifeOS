import express from "express";
import { lifeosService } from "../services/lifeos-service.js";
import type { SensorState } from "../../types.js";

export const stateRoutes = express.Router();

/**
 * GET /api/state
 * Get current sensor state
 */
stateRoutes.get("/", (req, res) => {
  try {
    const state = lifeosService.getSensorState();

    res.json({
      success: true,
      data: state,
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
 * PUT /api/state
 * Update sensor state
 */
stateRoutes.put("/", (req, res) => {
  try {
    const updates: Partial<SensorState> = req.body;

    lifeosService.updateSensorState(updates);
    const updatedState = lifeosService.getSensorState();

    res.json({
      success: true,
      data: updatedState,
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
 * PATCH /api/state
 * Partially update sensor state
 */
stateRoutes.patch("/", (req, res) => {
  try {
    const updates: Partial<SensorState> = req.body;

    lifeosService.updateSensorState(updates);
    const updatedState = lifeosService.getSensorState();

    res.json({
      success: true,
      data: updatedState,
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
