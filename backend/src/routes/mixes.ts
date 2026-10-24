import { Router, Request, Response } from 'express';
import { generateDailyMixes } from '../services/mixes';

export const mixRouter = Router();

// Cache mixes in memory for 10 minutes
let cachedMixes: any[] | null = null;
let lastGenerated = 0;

// GET /api/mixes
mixRouter.get('/', (req: Request, res: Response) => {
  const now = Date.now();
  if (!cachedMixes || now - lastGenerated > 10 * 60 * 1000) {
    cachedMixes = generateDailyMixes();
    lastGenerated = now;
  }
  res.json({ mixes: cachedMixes });
});

// GET /api/mixes/:id
mixRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const now = Date.now();
  if (!cachedMixes || now - lastGenerated > 10 * 60 * 1000) {
    cachedMixes = generateDailyMixes();
    lastGenerated = now;
  }

  const mix = cachedMixes.find((m) => m.id === id);
  if (!mix) {
    return res.status(404).json({ error: 'Daily mix not found' });
  }

  res.json(mix);
});

// POST /api/mixes/refresh
mixRouter.post('/refresh', (req: Request, res: Response) => {
  cachedMixes = generateDailyMixes();
  lastGenerated = Date.now();
  res.json({ success: true, count: cachedMixes.length });
});
