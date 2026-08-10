import express from "express";
import { lifeosService } from "../services/lifeos-service.js";

export const tasksRoutes = express.Router();

/**
 * GET /api/tasks
 * Get all derived tasks
 */
tasksRoutes.get("/", (req, res) => {
  try {
    const tasks = lifeosService.deriveTasks();

    // Optional priority filter
    const { priority } = req.query;
    const filteredTasks = priority
      ? tasks.filter((t) => t.priority === priority)
      : tasks;

    res.json({
      success: true,
      count: filteredTasks.length,
      data: filteredTasks,
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
 * GET /api/tasks/high-priority
 * Get high-priority tasks
 */
tasksRoutes.get("/high-priority", (req, res) => {
  try {
    const tasks = lifeosService.deriveTasks();
    const highPriorityTasks = tasks.filter((t) => t.priority === "high");

    res.json({
      success: true,
      count: highPriorityTasks.length,
      data: highPriorityTasks,
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
