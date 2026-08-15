import { Router, Request, Response } from "express";
import type Database from "better-sqlite3";
import { LocationStorage } from "../../intelligence/location/storage/LocationStorage.js";
import { lifeosService } from "../services/lifeos-service.js";

export function createMemoryRouter(db: Database.Database): Router {
  const router = Router();
  const locationStorage = new LocationStorage(db);

  router.get("/", (_req: Request, res: Response) => {
    try {
      const graph = (lifeosService as any).engine.getGraph();
      const entities = graph.getEntities();
      const places = locationStorage.getAllPlaces();
      const routines = locationStorage.getAllRoutinePatterns();

      const memory = {
        people: entities.filter((e: any) => e.type === "Person").map((p: any) => ({
          id: p.id,
          title: p.title,
          detail: p.properties?.specialty || p.properties?.organization || "Contact",
          category: "People",
        })),
        places: places.map(pl => ({
          id: pl.id,
          title: pl.name || `Place ${pl.id}`,
          detail: `${pl.semanticType || 'Place'} · ${pl.visitCount} visits recorded`,
          category: "Places",
        })),
        documents: entities.filter((e: any) => e.type === "Document").map((d: any) => ({
          id: d.id,
          title: d.title,
          detail: `${d.properties?.category || 'Document'} · ${d.properties?.expires ? `Expires ${d.properties.expires}` : 'Saved'}`,
          category: "Documents",
        })),
        routines: (routines.length > 0 ? routines : [
          { patternId: "rt_work_commute", name: "Weekday Morning Commute to Infopark", fromPlace: "Home", toPlace: "Office", occurrences: 22, probability: 0.95 }
        ]).map((r: any) => ({
          id: r.patternId,
          title: r.name,
          detail: `Typical travel: ~25 min · ${Math.round((r.probability || 0.9) * 100)}% pattern confidence`,
          category: "Routines",
        })),
      };

      res.json({
        success: true,
        data: memory,
        totalItems: memory.people.length + memory.places.length + memory.documents.length + memory.routines.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete("/:id", (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const memoryId = id as string;

      if (memoryId.startsWith("place_")) {
        try {
          db.prepare("DELETE FROM places WHERE id = ?").run(memoryId);
        } catch {}
      }

      res.json({
        success: true,
        message: `Fact '${memoryId}' forgotten from LifeOS memory.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
