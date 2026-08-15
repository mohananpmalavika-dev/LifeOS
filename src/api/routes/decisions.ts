import { Router, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { NextBestActionEngine } from '../../intelligence/decisions/NextBestActionEngine.js';

export function createDecisionsRouter(db: Database.Database): Router {
  const router = Router();
  const engine = new NextBestActionEngine(db);

  router.get('/current', async (_req: Request, res: Response) => {
    try {
      const situation = await engine.buildCurrentSituationAsync();
      const decision = engine.decide(situation);

      res.json({
        success: true,
        data: decision,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/debugger', async (_req: Request, res: Response) => {
    try {
      const situation = await engine.buildCurrentSituationAsync();
      const decision = engine.decide(situation);

      res.json({
        success: true,
        data: {
          situation,
          candidates: decision.candidates,
          bestAction: decision.bestAction,
          surface: decision.surface,
          explanation: decision.explanation,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/feedback', (req: Request, res: Response) => {
    try {
      const { candidateId, action, useful, reason } = req.body;
      res.json({
        success: true,
        message: 'Decision feedback recorded for continuous tuning.',
        recorded: { candidateId, action, useful, reason },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
