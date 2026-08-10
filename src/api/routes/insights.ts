import express from "express";
import { lifeosService } from "../services/lifeos-service.js";

export const insightsRoutes = express.Router();

/**
 * GET /api/insights
 * Get system insights and metrics
 */
insightsRoutes.get("/", (req, res) => {
  try {
    const insights = lifeosService.getInsights();

    res.json({
      success: true,
      data: insights,
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
 * GET /api/insights/metrics
 * Get only the metrics (accuracy, precision, recall, F1)
 */
insightsRoutes.get("/metrics", (req, res) => {
  try {
    const insights = lifeosService.getInsights();

    res.json({
      success: true,
      data: insights.metrics,
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
 * GET /api/insights/distributions
 * Get entity and relation type distributions
 */
insightsRoutes.get("/distributions", (req, res) => {
  try {
    const insights = lifeosService.getInsights();

    res.json({
      success: true,
      data: insights.distributions,
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
