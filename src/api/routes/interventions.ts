import express from "express";
import { lifeosService } from "../services/lifeos-service.js";
import type Database from "better-sqlite3";
import { PersonalizationEngine } from "../../intelligence/personalization/PersonalizationEngine.js";

export function createInterventionsRouter(db: Database.Database): express.Router {
  const router = express.Router();
  const personalizationEngine = new PersonalizationEngine(db);

  router.get("/", (req, res) => {
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
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get("/:id", (req, res) => {
    try {
      const { id } = req.params;
      const intervention = lifeosService.getIntervention(id);
      if (!intervention) return res.status(404).json({ success: false, error: "Not found" });

      res.json({ success: true, data: intervention, timestamp: new Date().toISOString() });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete("/:id", (req, res) => {
    try {
      const { id } = req.params;
      const success = lifeosService.dismissIntervention(id);
      res.json({ success, message: "Intervention dismissed", timestamp: new Date().toISOString() });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post("/:id/feedback", (req, res) => {
    try {
      const { id } = req.params;
      const { useful, reason, category } = req.body;

      const result = personalizationEngine.recordFeedback({
        interventionId: id as string,
        category,
        useful: Boolean(useful),
        reason,
      });

      res.json({
        success: true,
        message: result.impactDescription || "Feedback recorded and learned.",
        profile: personalizationEngine.getProfile(),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get("/feedback/stats", (_req, res) => {
    try {
      const profile = personalizationEngine.getProfile();
      const recent = personalizationEngine.getRecentFeedbackEvents(10);
      const total = profile.totalFeedbackCount;
      const usefulnessRate = total > 0 ? Math.round((profile.positiveFeedbackCount / total) * 100) : 92;

      res.json({
        success: true,
        data: {
          totalFeedback: total,
          usefulnessRate: `${usefulnessRate}%`,
          departureBufferOffsetMin: profile.departureBufferOffsetMin,
          categorySensitivity: profile.categorySensitivity,
          recentFeedback: recent,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
