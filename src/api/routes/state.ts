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

let currentFocusMode = "NORMAL"; // 'NORMAL' | 'WORK' | 'DRIVING' | 'SLEEP' | 'MEETING' | 'TRAVEL'

/**
 * GET /api/state/focus-mode
 */
stateRoutes.get("/focus-mode", (_req, res) => {
  res.json({
    success: true,
    mode: currentFocusMode,
    description: getFocusModeDescription(currentFocusMode),
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/state/focus-mode
 */
stateRoutes.post("/focus-mode", (req, res) => {
  try {
    const { mode } = req.body;
    if (mode) {
      currentFocusMode = mode.toUpperCase();
      // Update sensor focus state accordingly
      if (currentFocusMode === "WORK" || currentFocusMode === "MEETING") {
        lifeosService.updateSensorState({ focusState: "focused" });
      } else if (currentFocusMode === "DRIVING" || currentFocusMode === "TRAVEL") {
        lifeosService.updateSensorState({ motionState: "driving" });
      } else {
        lifeosService.updateSensorState({ focusState: "idle" });
      }
    }

    res.json({
      success: true,
      mode: currentFocusMode,
      description: getFocusModeDescription(currentFocusMode),
      message: `Focus mode set to ${currentFocusMode}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function getFocusModeDescription(mode: string): string {
  switch (mode) {
    case "WORK": return "Prioritizing meetings & deadlines; suppressing personal alerts.";
    case "DRIVING": return "Hands-free mode: only critical navigation & urgent calls allowed.";
    case "SLEEP": return "Quiet hours: all interruptions silenced except emergencies.";
    case "MEETING": return "Meeting in progress: urgent alerts only.";
    case "TRAVEL": return "Prioritizing flights, departure countdowns & tickets.";
    default: return "Balanced intelligence: delivers timely and useful suggestions.";
  }
}

