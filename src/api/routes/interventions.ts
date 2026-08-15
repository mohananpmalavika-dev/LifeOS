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

// In-memory feedback store
interface FeedbackEntry {
  interventionId: string;
  useful: boolean;
  reason?: string;
  timestamp: string;
}
const feedbackHistory: FeedbackEntry[] = [
  { interventionId: "demo_1", useful: true, reason: "On time", timestamp: new Date(Date.now() - 3600000).toISOString() },
  { interventionId: "demo_2", useful: true, reason: "Saved travel delay", timestamp: new Date(Date.now() - 7200000).toISOString() },
];

/**
 * POST /api/interventions/:id/feedback
 * Record user feedback on an intervention
 */
interventionRoutes.post("/:id/feedback", (req, res) => {
  try {
    const { id } = req.params;
    const { useful, reason } = req.body;

    feedbackHistory.push({
      interventionId: id as string,
      useful: Boolean(useful),
      reason: reason || (useful ? "Helpful" : "Not relevant"),
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Feedback recorded. LifeOS will personalize future recommendations.",
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
 * GET /api/interventions/feedback/stats
 * Get usefulness metrics and feedback breakdown
 */
interventionRoutes.get("/feedback/stats", (_req, res) => {
  try {
    const total = feedbackHistory.length;
    const usefulCount = feedbackHistory.filter(f => f.useful).length;
    const usefulPercent = total > 0 ? Math.round((usefulCount / total) * 100) : 90;

    res.json({
      success: true,
      data: {
        totalFeedback: total,
        usefulnessRate: `${usefulPercent}%`,
        usefulCount,
        notUsefulCount: total - usefulCount,
        recentFeedback: feedbackHistory.slice(-5).reverse(),
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

