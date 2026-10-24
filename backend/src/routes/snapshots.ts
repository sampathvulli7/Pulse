import { Router, Request, Response } from 'express';
import { db } from '../db/database';

export const snapshotRouter = Router();

// GET /api/queue-snapshots
snapshotRouter.get('/', (req: Request, res: Response) => {
  const snapshots = db.prepare('SELECT * FROM queue_snapshots ORDER BY created_at DESC').all();
  const parsed = snapshots.map((s: any) => ({
    id: s.id,
    name: s.name,
    currentTrackId: s.current_track_id,
    currentPlaybackTime: s.current_playback_time,
    shuffleMode: s.shuffle_mode,
    createdAt: s.created_at,
    priorityQueue: JSON.parse(s.priority_queue_json || '[]'),
    contextQueue: JSON.parse(s.context_queue_json || '[]'),
  }));
  res.json(parsed);
});

// POST /api/queue-snapshots
snapshotRouter.post('/', (req: Request, res: Response) => {
  const {
    id = `snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name,
    priorityQueue = [],
    contextQueue = [],
    currentTrackId,
    currentPlaybackTime = 0,
    shuffleMode = 'off',
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Snapshot name is required' });
  }

  db.prepare(`
    INSERT INTO queue_snapshots (
      id, name, priority_queue_json, context_queue_json, current_track_id, current_playback_time, shuffle_mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    JSON.stringify(priorityQueue),
    JSON.stringify(contextQueue),
    currentTrackId || null,
    currentPlaybackTime,
    shuffleMode
  );

  const created = db.prepare('SELECT * FROM queue_snapshots WHERE id = ?').get(id) as any;
  res.status(201).json({
    ...created,
    priorityQueue,
    contextQueue,
  });
});

// DELETE /api/queue-snapshots/:id
snapshotRouter.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM queue_snapshots WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
