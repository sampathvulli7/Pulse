import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { calculateAudioFeatures, generateSongRadio, getRecommendations } from '../services/recommendations';

export const recommendationRouter = Router();

// GET /api/tracks/:id/audio-features
recommendationRouter.get('/tracks/:id/audio-features', (req: Request, res: Response) => {
  const { id } = req.params;
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as any;
  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }

  const features = calculateAudioFeatures(track);
  res.json(features);
});

// GET /api/tracks/:id/radio
recommendationRouter.get('/tracks/:id/radio', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const radio = generateSongRadio(id, limit);
    res.json(radio);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/recommendations
recommendationRouter.get('/recommendations', (req: Request, res: Response) => {
  try {
    const seedGenres = req.query.seed_genres ? (req.query.seed_genres as string).split(',') : [];
    const seedArtists = req.query.seed_artists ? (req.query.seed_artists as string).split(',') : [];
    const targetBpm = req.query.target_bpm ? Number(req.query.target_bpm) : undefined;
    const targetEnergy = req.query.target_energy ? Number(req.query.target_energy) : undefined;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const tracks = getRecommendations({
      seedGenres,
      seedArtists,
      targetBpm,
      targetEnergy,
      limit,
    });

    res.json({ tracks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/playlists/:id/enhance
recommendationRouter.get('/playlists/:id/enhance', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id) as any;
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const playlistTracks = db.prepare(`
      SELECT t.* FROM tracks t
      JOIN playlist_tracks pt ON pt.track_id = t.id
      WHERE pt.playlist_id = ?
    `).all(id) as any[];

    if (playlistTracks.length === 0) {
      // Empty playlist: return top popular tracks
      const recs = db.prepare('SELECT * FROM tracks ORDER BY play_count DESC, RANDOM() LIMIT 15').all() as any[];
      return res.json({ recommendations: recs });
    }

    // Extract common genres and average BPM
    const genres = playlistTracks.map((t) => t.genre).filter(Boolean);
    const avgBpm = Math.round(
      playlistTracks.reduce((acc, t) => acc + (t.bpm || 120), 0) / playlistTracks.length
    );

    const existingIds = new Set(playlistTracks.map((t) => t.id));
    const allCandidates = getRecommendations({
      seedGenres: Array.from(new Set(genres)) as string[],
      targetBpm: avgBpm,
      limit: 30,
    });

    const recommendations = allCandidates.filter((t) => !existingIds.has(t.id)).slice(0, 15);
    res.json({ recommendations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
