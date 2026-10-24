import { Router, Request, Response } from 'express';
import { db } from '../db/database';

export const presetRouter = Router();

// GET /api/eq-presets
presetRouter.get('/', (req: Request, res: Response) => {
  const presets = db.prepare('SELECT * FROM eq_presets ORDER BY is_default DESC, name ASC').all();
  const parsed = presets.map((p: any) => ({
    id: p.id,
    name: p.name,
    isDefault: !!p.is_default,
    preampGain: p.preamp_gain,
    bandGains: JSON.parse(p.band_gains_json || '[0,0,0,0,0,0,0,0,0,0]'),
  }));
  res.json(parsed);
});

// POST /api/eq-presets
presetRouter.post('/', (req: Request, res: Response) => {
  const {
    id = `preset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name,
    preampGain = 0,
    bandGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  } = req.body;

  if (!name || !Array.isArray(bandGains) || bandGains.length !== 10) {
    return res.status(400).json({ error: 'Name and 10 bandGains are required' });
  }

  db.prepare(`
    INSERT OR REPLACE INTO eq_presets (id, name, is_default, preamp_gain, band_gains_json)
    VALUES (?, ?, 0, ?, ?)
  `).run(id, name, preampGain, JSON.stringify(bandGains));

  const created = db.prepare('SELECT * FROM eq_presets WHERE id = ?').get(id) as any;
  res.status(201).json({
    id: created.id,
    name: created.name,
    isDefault: !!created.is_default,
    preampGain: created.preamp_gain,
    bandGains: JSON.parse(created.band_gains_json),
  });
});

// DELETE /api/eq-presets/:id
presetRouter.delete('/:id', (req: Request, res: Response) => {
  const preset = db.prepare('SELECT is_default FROM eq_presets WHERE id = ?').get(req.params.id) as any;
  if (preset && preset.is_default) {
    return res.status(400).json({ error: 'Cannot delete default preset' });
  }

  db.prepare('DELETE FROM eq_presets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
