import { Router, Request, Response } from 'express';
import { db } from '../db/database';

export const userStatsRouter = Router();

// GET /api/me/recently-played
userStatsRouter.get('/me/recently-played', (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 30, 50);

  const history = db.prepare(`
    SELECT ph.id as history_id, ph.played_at, ph.duration_played_seconds, t.*
    FROM play_history ph
    JOIN tracks t ON t.id = ph.track_id
    ORDER BY ph.played_at DESC
    LIMIT ?
  `).all(limit) as any[];

  // Fallback to tracks ordered by last_played_at if history is empty
  let tracks = history;
  if (tracks.length === 0) {
    tracks = db.prepare(`
      SELECT NULL as history_id, last_played_at as played_at, 180 as duration_played_seconds, *
      FROM tracks
      WHERE last_played_at IS NOT NULL
      ORDER BY last_played_at DESC
      LIMIT ?
    `).all(limit) as any[];
  }

  res.json({
    tracks: tracks.map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationSeconds: t.duration_seconds ?? 0,
      sourceType: t.source_type,
      sourceUrl: t.source_url,
      coverArtUrl: t.cover_art_url,
      playedAt: t.played_at,
      bpm: t.bpm,
      energy: t.energy,
      genre: t.genre,
      isFavorite: Boolean(t.is_favorite),
    })),
  });
});

// GET /api/me/top-tracks
userStatsRouter.get('/me/top-tracks', (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  const top = db.prepare(`
    SELECT * FROM tracks
    ORDER BY play_count DESC, duration_seconds DESC
    LIMIT ?
  `).all(limit) as any[];

  res.json({
    tracks: top.map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationSeconds: t.duration_seconds ?? 0,
      sourceType: t.source_type,
      sourceUrl: t.source_url,
      coverArtUrl: t.cover_art_url,
      playCount: t.play_count,
      bpm: t.bpm,
      energy: t.energy,
      genre: t.genre,
      isFavorite: Boolean(t.is_favorite),
    })),
  });
});

// GET /api/me/top-artists
userStatsRouter.get('/me/top-artists', (req: Request, res: Response) => {
  const artists = db.prepare(`
    SELECT artist, COUNT(*) as track_count, SUM(play_count) as total_plays
    FROM tracks
    GROUP BY artist
    ORDER BY total_plays DESC, track_count DESC
    LIMIT 20
  `).all() as any[];

  res.json({ artists });
});

// GET /api/me/stats
userStatsRouter.get('/me/stats', (req: Request, res: Response) => {
  const totalTracks = (db.prepare('SELECT COUNT(*) as count FROM tracks').get() as any).count;
  const totalPlaylists = (db.prepare('SELECT COUNT(*) as count FROM playlists').get() as any).count;
  const totalFavorites = (db.prepare('SELECT COUNT(*) as count FROM tracks WHERE is_favorite = 1').get() as any).count;

  const playStats = db.prepare(`
    SELECT 
      SUM(play_count) as total_plays,
      SUM(duration_seconds * play_count) as total_seconds_listened
    FROM tracks
  `).get() as any;

  const totalMinutes = Math.round((playStats.total_seconds_listened || 0) / 60);

  const topGenres = db.prepare(`
    SELECT genre, COUNT(*) as count
    FROM tracks
    WHERE genre IS NOT NULL AND TRIM(genre) != ''
    GROUP BY genre
    ORDER BY count DESC
    LIMIT 5
  `).all() as any[];

  res.json({
    totalTracks,
    totalPlaylists,
    totalFavorites,
    totalPlays: playStats.total_plays || 0,
    totalMinutesListened: totalMinutes,
    topGenres,
  });
});

// GET /api/search/suggestions?q=...
userStatsRouter.get('/search/suggestions', (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  if (!q) {
    return res.json({ topResult: null, songs: [], artists: [], playlists: [] });
  }

  const searchPattern = `%${q}%`;

  // Search songs
  const songs = db.prepare(`
    SELECT * FROM tracks
    WHERE LOWER(title) LIKE ? OR LOWER(artist) LIKE ?
    ORDER BY play_count DESC
    LIMIT 5
  `).all(searchPattern, searchPattern) as any[];

  // Search artists
  const artists = db.prepare(`
    SELECT artist, COUNT(*) as track_count
    FROM tracks
    WHERE LOWER(artist) LIKE ?
    GROUP BY artist
    LIMIT 3
  `).all(searchPattern) as any[];

  // Search playlists
  const playlists = db.prepare(`
    SELECT * FROM playlists
    WHERE LOWER(name) LIKE ?
    LIMIT 3
  `).all(searchPattern) as any[];

  const topResult = songs[0]
    ? {
        type: 'track',
        id: songs[0].id,
        title: songs[0].title,
        subtitle: songs[0].artist,
        coverArtUrl: songs[0].cover_art_url,
      }
    : null;

  res.json({
    topResult,
    songs: songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      coverArtUrl: s.cover_art_url,
      durationSeconds: s.duration_seconds,
    })),
    artists,
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      coverUrl: p.cover_url,
      isSmart: Boolean(p.is_smart),
    })),
  });
});
