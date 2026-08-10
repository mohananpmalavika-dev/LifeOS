import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { interventionRoutes } from "./routes/interventions.js";
import { timelineRoutes } from "./routes/timeline.js";
import { contextRoutes } from "./routes/context.js";
import { tasksRoutes } from "./routes/tasks.js";
import { entitiesRoutes } from "./routes/entities.js";
import { insightsRoutes } from "./routes/insights.js";
import { eventsRoutes } from "./routes/events.js";
import { stateRoutes } from "./routes/state.js";
import { devicesRouter } from "./routes/devices.js";
import { lifeEventsRouter } from "./routes/life-events.js";
import { lifeContextRouter } from "./routes/life-context.js";
import { notificationIntelligenceRoutes } from "./routes/notification-intelligence.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    service: "LifeOS API"
  });
});

// API Routes
app.use("/api/interventions", interventionRoutes);
app.use("/api/timeline", timelineRoutes);
app.use("/api/context", contextRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/entities", entitiesRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/state", stateRoutes);

// Android Passive Agent API (v0.3)
app.use("/api/v1/devices", devicesRouter);
app.use("/api/v1/context", lifeEventsRouter);
app.use("/api/v1/life-context", lifeContextRouter);
app.use("/api/notification-intelligence", notificationIntelligenceRoutes);

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ 
    error: "Route not found",
    timestamp: new Date().toISOString(),
  });
});

export function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 LifeOS API Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  });
}

export default app;
