import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './db/database';
import { seedDemoData } from './db/seed';
import { trackRouter } from './routes/tracks';
import { playlistRouter } from './routes/playlists';
import { snapshotRouter } from './routes/snapshots';
import { presetRouter } from './routes/presets';
import { handleAudioStream, handleStreamProxy, handleImageProxy } from './routes/stream';
import { handleLyrics } from './routes/lyrics';
import { scanDirectory } from './services/scanner';
import { ensureFullAudio } from './services/fullAudio';
import {
  generatePKCE,
  getSpotifyAuthUrl,
  exchangeSpotifyCode,
  importSpotifyPlaylist,
  searchSpotifyTracks,
  resolveYouTubeAudioId,
} from './services/spotify';
import { db } from './db/database';

import { recommendationRouter } from './routes/recommendations';
import { mixRouter } from './routes/mixes';
import { userStatsRouter } from './routes/userStats';
import { cacheRouter } from './routes/cache';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Initialize SQLite database and demo seed
initDatabase();
seedDemoData();

// Routes
app.use('/api/tracks', trackRouter);
app.use('/api/playlists', playlistRouter);
app.use('/api/queue-snapshots', snapshotRouter);
app.use('/api/eq-presets', presetRouter);
app.use('/api/mixes', mixRouter);
app.use('/api/cache', cacheRouter);
app.use('/api', recommendationRouter);
app.use('/api', userStatsRouter);

// Audio & Image Streaming (HTTP 206 Partial Content + Full CORS + Image Fallback)
app.get('/api/stream/proxy', handleStreamProxy);
app.get('/api/stream/:id', handleAudioStream);
app.get('/api/image/proxy', handleImageProxy);

// Lyrics (LRCLIB Proxy)
app.get('/api/lyrics', handleLyrics);

// Local Library Scanner
app.post('/api/library/scan', async (req, res) => {
  try {
    const targetDir = req.body.directoryPath || path.resolve(__dirname, '../audio_library');
    const result = await scanDirectory(targetDir);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Spotify PKCE & Seed
app.post('/api/spotify/seed-demo', (req, res) => {
  const result = seedDemoData();
  res.json({ success: true, ...result });
});

app.get('/api/spotify/auth-url', (req, res) => {
  const clientId = (req.query.clientId as string) || 'demo-client-id';
  const redirectUri = (req.query.redirectUri as string) || 'http://localhost:5173/callback';
  const { verifier, challenge } = generatePKCE();
  const url = getSpotifyAuthUrl(clientId, redirectUri, challenge);
  res.json({ url, codeVerifier: verifier });
});

app.post('/api/spotify/callback', async (req, res) => {
  try {
    const { code, codeVerifier, clientId, redirectUri } = req.body;
    const tokens = await exchangeSpotifyCode(code, codeVerifier, clientId, redirectUri);
    res.json(tokens);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/spotify/import-playlist', async (req, res) => {
  try {
    const { playlistId, url, accessToken } = req.body;
    const target = url || playlistId;
    if (!target) {
      return res.status(400).json({ error: 'playlistId or url is required' });
    }
    const result = await importSpotifyPlaylist(target, accessToken);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Multi-Source Search & Instant Track Resolution (Audius, Global, Spotify, Archive)
app.get('/api/spotify/search', async (req, res) => {
  try {
    const q = req.query.q as string;
    const source = (req.query.source as string) || 'all';
    if (!q) {
      return res.status(400).json({ error: 'Search query parameter q is required' });
    }
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const results = await searchSpotifyTracks(q, accessToken, source);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/spotify/resolve-track', async (req, res) => {
  try {
    const { title, artist, album, durationSeconds = 180, coverArtUrl, genre = 'Pop', previewUrl, sourceUrl, isrc } = req.body;
    if (!title || !artist) {
      return res.status(400).json({ error: 'title and artist are required' });
    }

    // Check if track already exists in database (deduplicate)
    const existing = db.prepare(`
      SELECT * FROM tracks 
      WHERE LOWER(title) = LOWER(?) AND LOWER(artist) = LOWER(?)
      LIMIT 1
    `).get(title.trim(), artist.trim()) as any;

    if (existing) {
      return res.status(200).json({
        id: existing.id,
        title: existing.title,
        artist: existing.artist,
        album: existing.album,
        durationSeconds: existing.duration_seconds,
        sourceType: existing.source_type,
        sourceUrl: existing.source_url,
        youtubeVideoId: existing.youtube_video_id,
        coverArtUrl: existing.cover_art_url,
        bpm: existing.bpm,
        energy: existing.energy,
        genre: existing.genre,
      });
    }

    const trackId = `trk-resolved-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Resolve official YouTube audio ID
    let youtubeVideoId: string | null = null;
    try {
      youtubeVideoId = await resolveYouTubeAudioId(artist, title);
    } catch (e) {
      console.warn('YouTube fallback resolve warning:', e);
    }

    // Determine audio stream source:
    // If it's a full-length Audius stream, use it directly.
    // Otherwise, route through Pulse Full-Audio Stream Engine (/api/stream/:trackId)
    // which serves full-length studio M4A with 0ms lag & HTTP 206!
    let resolvedSourceUrl = `/api/stream/${trackId}`;
    let sourceType: 'stream' | 'local' | 'youtube' = 'local';

    if (sourceUrl && sourceUrl.includes('discoveryprovider.audius.co')) {
      resolvedSourceUrl = sourceUrl;
      sourceType = 'stream';
    } else {
      // Trigger instant background pre-cache of the full-length track
      ensureFullAudio({
        id: trackId,
        title,
        artist,
        youtubeVideoId,
      }).catch((e) => console.warn('[Resolve] Background pre-cache notice:', e.message));
    }

    const bpm = 110 + Math.floor(Math.random() * 28);
    const energy = 0.5 + Math.random() * 0.4;

    db.prepare(`
      INSERT OR REPLACE INTO tracks (
        id, title, artist, album, duration_seconds, source_type,
        source_url, youtube_video_id, cover_art_url, bpm, energy, genre, isrc, bitrate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 320)
    `).run(
      trackId,
      title,
      artist,
      album || null,
      durationSeconds,
      sourceType,
      resolvedSourceUrl,
      youtubeVideoId,
      coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
      bpm,
      energy,
      genre,
      isrc || null
    );

    const created = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as any;
    res.status(201).json({
      id: created.id,
      title: created.title,
      artist: created.artist,
      album: created.album,
      durationSeconds: created.duration_seconds,
      sourceType: created.source_type,
      sourceUrl: created.source_url,
      youtubeVideoId: created.youtube_video_id,
      coverArtUrl: created.cover_art_url,
      bpm: created.bpm,
      energy: created.energy,
      genre: created.genre,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: "Sampath's Studio API", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Only listen if not imported in tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Pulse Backend] Server running on http://localhost:${PORT}`);
  });
}

export default app;
