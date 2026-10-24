import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { evaluateSmartPlaylistRules } from '../services/smartPlaylistEvaluator';

export const playlistRouter = Router();

// GET /api/playlists
playlistRouter.get('/', (req: Request, res: Response) => {
  const raw = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) as track_count
    FROM playlists p
    ORDER BY p.is_favorite DESC, p.created_at DESC
  `).all() as any[];

  const playlists = raw.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isSmart: !!p.is_smart,
    coverUrl: p.cover_url,
    isFavorite: !!p.is_favorite,
    trackCount: p.track_count,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));

  res.json(playlists);
});

// POST /api/playlists
playlistRouter.post('/', (req: Request, res: Response) => {
  const {
    id = `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name,
    description,
    is_smart = 0,
    cover_url = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
    rules = [],
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  db.prepare(`
    INSERT INTO playlists (id, name, description, is_smart, cover_url)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, description || null, is_smart ? 1 : 0, cover_url);

  if (is_smart && Array.isArray(rules)) {
    const ruleStmt = db.prepare(`
      INSERT INTO smart_playlist_rules (id, playlist_id, field, operator, value, logic_gate)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    rules.forEach((rule: any, idx: number) => {
      ruleStmt.run(
        `rule-${id}-${idx}`,
        id,
        rule.field,
        rule.operator,
        rule.value.toString(),
        rule.logic_gate || 'AND'
      );
    });
  }

  const created = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
  res.status(201).json(created);
});

// GET /api/playlists/:id
playlistRouter.get('/:id', (req: Request, res: Response) => {
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id) as any;
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  if (playlist.is_smart) {
    const rules = db.prepare('SELECT * FROM smart_playlist_rules WHERE playlist_id = ?').all(playlist.id);
    const rawTracks = evaluateSmartPlaylistRules(playlist.id) as any[];
    const tracks = rawTracks.map((t) => ({
      ...t,
      durationSeconds: t.duration_seconds ?? 0,
      sourceType: t.source_type,
      coverArtUrl: t.cover_art_url,
      youtubeVideoId: t.youtube_video_id,
    }));
    return res.json({ ...playlist, isSmart: true, rules, tracks, trackCount: tracks.length });
  }

  const rawTracks = db.prepare(`
    SELECT t.*, pt.position
    FROM playlist_tracks pt
    JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position ASC
  `).all(playlist.id) as any[];

  const tracks = rawTracks.map((t) => ({
    ...t,
    durationSeconds: t.duration_seconds ?? 0,
    sourceType: t.source_type,
    coverArtUrl: t.cover_art_url,
    youtubeVideoId: t.youtube_video_id,
  }));

  res.json({ ...playlist, isSmart: false, tracks, trackCount: tracks.length });
});

// GET /api/playlists/:id/smart-resolve
playlistRouter.get('/:id/smart-resolve', (req: Request, res: Response) => {
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id) as any;
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  const tracks = evaluateSmartPlaylistRules(playlist.id);
  res.json({ tracks, total: tracks.length });
});

// POST /api/playlists/:id/tracks
playlistRouter.post('/:id/tracks', (req: Request, res: Response) => {
  const { id } = req.params;
  const { trackId, position } = req.body;

  if (!trackId) {
    return res.status(400).json({ error: 'trackId is required' });
  }

  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id) as any;
  if (!playlist) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  let pos = position;
  if (pos === undefined) {
    const maxPos = db.prepare('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?').get(id) as any;
    pos = (maxPos?.maxPos ?? -1) + 1;
  }

  const linkId = `pltr-${id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT OR REPLACE INTO playlist_tracks (id, playlist_id, track_id, position)
    VALUES (?, ?, ?, ?)
  `).run(linkId, id, trackId, pos);

  const count = (db.prepare('SELECT COUNT(*) as c FROM playlist_tracks WHERE playlist_id = ?').get(id) as any).c;
  res.status(201).json({ success: true, track_count: count });
});

// DELETE /api/playlists/:id/tracks/:trackId
playlistRouter.delete('/:id/tracks/:trackId', (req: Request, res: Response) => {
  const { id, trackId } = req.params;
  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(id, trackId);
  res.json({ success: true });
});

// PUT /api/playlists/:id/reorder
playlistRouter.put('/:id/reorder', (req: Request, res: Response) => {
  const { id } = req.params;
  const { trackIds } = req.body;

  if (!Array.isArray(trackIds)) {
    return res.status(400).json({ error: 'trackIds array is required' });
  }

  const updateStmt = db.prepare('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?');
  const transaction = db.transaction((tracks: string[]) => {
    tracks.forEach((trackId, index) => {
      updateStmt.run(index, id, trackId);
    });
  });

  transaction(trackIds);
  res.json({ success: true });
});

// DELETE /api/playlists/:id
playlistRouter.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
