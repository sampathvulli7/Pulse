import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database';
import { getCachedAudioPath, ensureFullAudio } from '../services/fullAudio';

/**
 * GET /api/download/:id
 * Streams high-quality studio M4A/MP3 track as an attachment download with proper artist & title naming.
 */
export async function handleAudioDownload(req: Request, res: Response) {
  const { id } = req.params;
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as any;

  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }

  // 1. Check local library file
  let filePath = track.local_path && fs.existsSync(track.local_path) ? track.local_path : null;

  // 2. Check disk audio cache
  if (!filePath) {
    filePath = getCachedAudioPath(id);
  }

  // 3. Ensure full audio is fetched if not already cached
  if (!filePath) {
    try {
      filePath = await ensureFullAudio({
        id: track.id,
        title: track.title,
        artist: track.artist,
        youtubeVideoId: track.youtube_video_id,
      });
    } catch (e) {
      console.warn(`[Download] Could not fetch audio for ${track.title}:`, e);
    }
  }

  // 4. Serve file attachment
  if (filePath && fs.existsSync(filePath)) {
    const ext = path.extname(filePath) || '.m4a';
    const cleanTitle = (track.title || 'Track').replace(/[/\\?%*:|"<>]/g, '_');
    const cleanArtist = (track.artist || 'Artist').replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `${cleanArtist} - ${cleanTitle}${ext}`;

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Type': ext === '.mp3' ? 'audio/mpeg' : 'audio/mp4',
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => console.warn('[Download] ReadStream error:', err.message));
    res.on('close', () => {
      try { stream.destroy(); } catch (e) {}
    });
    return stream.pipe(res);
  }

  // 5. Remote source fallback redirect
  if (track.source_url && (track.source_url.startsWith('http://') || track.source_url.startsWith('https://'))) {
    return res.redirect(track.source_url);
  }

  return res.status(404).json({ error: 'Audio file unavailable for download' });
}
