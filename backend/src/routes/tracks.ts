import { Router, Request, Response } from 'express';
import { db } from '../db/database';

export const trackRouter = Router();

// GET /api/tracks
trackRouter.get('/', (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim().toLowerCase();
  const genre = (req.query.genre as string || '').trim();
  const artist = (req.query.artist as string || '').trim();
  const source = (req.query.source as string || '').trim();
  const limit = Math.min(Number(req.query.limit) || 200, 2000);
  const offset = Number(req.query.offset) || 0;

  let query = 'SELECT * FROM tracks WHERE 1=1';
  const params: any[] = [];

  if (q) {
    query += ' AND (LOWER(title) LIKE ? OR LOWER(artist) LIKE ? OR LOWER(album) LIKE ?)';
    const searchPattern = `%${q}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (genre) {
    query += ' AND LOWER(genre) = LOWER(?)';
    params.push(genre);
  }

  if (artist) {
    query += ' AND LOWER(artist) LIKE LOWER(?)';
    params.push(`%${artist}%`);
  }

  if (source) {
    query += ' AND source_type = ?';
    params.push(source);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const total = (db.prepare(countQuery).get(...params) as any).count;

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rawTracks = db.prepare(query).all(...params) as any[];

  const tracks = rawTracks.map((t: any) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    durationSeconds: t.duration_seconds ?? 0,
    sourceType: t.source_type,
    sourceUrl: t.source_url,
    localPath: t.local_path,
    youtubeVideoId: t.youtube_video_id,
    coverArtUrl: t.cover_art_url,
    bpm: t.bpm,
    energy: t.energy,
    keySignature: t.key_signature,
    genre: t.genre,
    isrc: t.isrc,
    bitrate: t.bitrate || (t.source_type === 'local' ? 9216 : 320),
    sampleRate: t.sample_rate || (t.source_type === 'local' ? (t.id === 'trk-local-01' ? 192000 : 48000) : 44100),
    bitDepth: t.bit_depth || (t.source_type === 'local' ? 24 : 16),
    codec: t.codec || (t.source_type === 'local' ? 'ALAC' : 'AAC'),
    isLossless: Boolean(t.source_type === 'local' || t.id.includes('local') || (t.bitrate && t.bitrate >= 1411)),
    isHiRes: Boolean((t.sample_rate && t.sample_rate > 48000) || t.id === 'trk-local-01'),
    isSpatialAvailable: true,
    playCount: t.play_count,
    skipCount: t.skip_count,
    isFavorite: Boolean(t.is_favorite),
    lastPlayedAt: t.last_played_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));

  res.json({ tracks, total });
});

// GET /api/tracks/:id
trackRouter.get('/:id', (req: Request, res: Response) => {
  const t = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id) as any;
  if (!t) {
    return res.status(404).json({ error: 'Track not found' });
  }
  res.json({
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    durationSeconds: t.duration_seconds ?? 0,
    sourceType: t.source_type,
    sourceUrl: t.source_url,
    localPath: t.local_path,
    youtubeVideoId: t.youtube_video_id,
    coverArtUrl: t.cover_art_url,
    bpm: t.bpm,
    energy: t.energy,
    keySignature: t.key_signature,
    genre: t.genre,
    isrc: t.isrc,
    bitrate: t.bitrate || (t.source_type === 'local' ? 9216 : 320),
    sampleRate: t.sample_rate || (t.source_type === 'local' ? (t.id === 'trk-local-01' ? 192000 : 48000) : 44100),
    bitDepth: t.bit_depth || (t.source_type === 'local' ? 24 : 16),
    codec: t.codec || (t.source_type === 'local' ? 'ALAC' : 'AAC'),
    isLossless: Boolean(t.source_type === 'local' || t.id.includes('local') || (t.bitrate && t.bitrate >= 1411)),
    isHiRes: Boolean((t.sample_rate && t.sample_rate > 48000) || t.id === 'trk-local-01'),
    isSpatialAvailable: true,
    playCount: t.play_count,
    skipCount: t.skip_count,
    isFavorite: Boolean(t.is_favorite),
    lastPlayedAt: t.last_played_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  });
});

// POST /api/tracks
trackRouter.post('/', (req: Request, res: Response) => {
  const {
    id = `trk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    artist,
    album,
    duration_seconds = 0,
    source_type,
    source_url,
    local_path,
    youtube_video_id,
    cover_art_url,
    bpm,
    energy,
    key_signature,
    genre,
    isrc,
    bitrate = 320,
  } = req.body;

  if (!title || !artist || !source_type) {
    return res.status(400).json({ error: 'Missing required fields: title, artist, source_type' });
  }

  db.prepare(`
    INSERT INTO tracks (
      id, title, artist, album, duration_seconds, source_type, source_url, local_path,
      youtube_video_id, cover_art_url, bpm, energy, key_signature, genre, isrc, bitrate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, title, artist, album || null, duration_seconds, source_type, source_url || null,
    local_path || null, youtube_video_id || null, cover_art_url || null, bpm || null,
    energy || null, key_signature || null, genre || null, isrc || null, bitrate
  );

  const created = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
  res.status(201).json(created);
});

// POST /api/tracks/:id/telemetry
trackRouter.post('/:id/telemetry', (req: Request, res: Response) => {
  const { id } = req.params;
  const { durationPlayed = 0, completed = false, contextType = 'manual', contextId } = req.body;

  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as any;
  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }

  if (completed) {
    db.prepare(`
      UPDATE tracks SET
        play_count = play_count + 1,
        last_played_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
  } else if (durationPlayed < 10) {
    db.prepare('UPDATE tracks SET skip_count = skip_count + 1 WHERE id = ?').run(id);
  }

  // Insert history record
  const histId = `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  db.prepare(`
    INSERT INTO play_history (id, track_id, duration_played_seconds, completed, context_type, context_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(histId, id, durationPlayed, completed ? 1 : 0, contextType, contextId || null);

  const updated = db.prepare('SELECT play_count, skip_count, last_played_at FROM tracks WHERE id = ?').get(id);
  res.json({ success: true, telemetry: updated });
});

// DELETE /api/tracks/:id
trackRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM tracks WHERE id = ?').run(id);
  res.json({ success: true });
});

// POST /api/tracks/:id/toggle-like
trackRouter.post('/:id/toggle-like', (req: Request, res: Response) => {
  const { id } = req.params;
  const track = db.prepare('SELECT is_favorite FROM tracks WHERE id = ?').get(id) as any;
  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }
  const nextFav = track.is_favorite ? 0 : 1;
  db.prepare('UPDATE tracks SET is_favorite = ? WHERE id = ?').run(nextFav, id);
  res.json({ success: true, isFavorite: nextFav === 1 });
});
