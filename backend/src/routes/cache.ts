import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database';

export const cacheRouter = Router();

const CACHE_DIR = path.resolve(__dirname, '../../cache/audio');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * GET /api/cache/stats
 * Returns disk usage, file count, directory path, and cached track details.
 */
cacheRouter.get('/stats', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      return res.json({
        fileCount: 0,
        totalBytes: 0,
        totalSizeMB: '0.00 MB',
        cacheDir: CACHE_DIR,
        files: [],
      });
    }

    const fileNames = fs.readdirSync(CACHE_DIR);
    let totalBytes = 0;
    const files: any[] = [];

    for (const name of fileNames) {
      if (name.startsWith('.')) continue;
      const fullPath = path.join(CACHE_DIR, name);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          totalBytes += stat.size;
          const trackId = name.replace(/\.(m4a|mp3|temp\.m4a)$/, '');
          
          // Match with DB track if available
          let trackTitle = 'Unknown Track';
          let artistName = 'Unknown Artist';
          try {
            const track = db.prepare('SELECT title, artist FROM tracks WHERE id = ?').get(trackId) as any;
            if (track) {
              trackTitle = track.title;
              artistName = track.artist;
            }
          } catch (e) {}

          files.push({
            id: trackId,
            fileName: name,
            title: trackTitle,
            artist: artistName,
            sizeBytes: stat.size,
            sizeMB: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
            cachedAt: stat.mtime,
          });
        }
      } catch (e) {}
    }

    // Sort files by size descending
    files.sort((a, b) => b.sizeBytes - a.sizeBytes);

    const totalSizeMB = (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';

    res.json({
      fileCount: files.length,
      totalBytes,
      totalSizeMB,
      cacheDir: CACHE_DIR,
      files,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/cache/clear
 * Deletes all cached audio files on disk and resets DB pointers.
 */
cacheRouter.post('/clear', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      return res.json({ success: true, freedBytes: 0, freedMB: '0.00 MB', remainingCount: 0 });
    }

    const fileNames = fs.readdirSync(CACHE_DIR);
    let freedBytes = 0;
    let deletedCount = 0;

    for (const name of fileNames) {
      if (name.startsWith('.')) continue;
      const fullPath = path.join(CACHE_DIR, name);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          freedBytes += stat.size;
          fs.unlinkSync(fullPath);
          deletedCount++;
        }
      } catch (e) {}
    }

    // Reset local_path in SQLite database
    try {
      db.prepare(`
        UPDATE tracks
        SET local_path = NULL,
            source_type = CASE WHEN youtube_video_id IS NOT NULL THEN 'youtube' ELSE 'audius' END
        WHERE local_path LIKE '%cache/audio%'
      `).run();
    } catch (dbErr) {
      console.warn('[Cache] DB pointer reset notice:', dbErr);
    }

    const freedMB = (freedBytes / (1024 * 1024)).toFixed(2) + ' MB';

    res.json({
      success: true,
      deletedCount,
      freedBytes,
      freedMB,
      remainingCount: 0,
      cacheDir: CACHE_DIR,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/cache/tracks/:id
 * Deletes a single cached track file on disk and resets DB pointer.
 */
cacheRouter.delete('/tracks/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let deleted = false;
    let freedBytes = 0;

    const possibleFiles = [`${id}.m4a`, `${id}.mp3`, `${id}.temp.m4a`];
    for (const name of possibleFiles) {
      const fullPath = path.join(CACHE_DIR, name);
      if (fs.existsSync(fullPath)) {
        try {
          const stat = fs.statSync(fullPath);
          freedBytes += stat.size;
          fs.unlinkSync(fullPath);
          deleted = true;
        } catch (e) {}
      }
    }

    // Reset DB track
    try {
      db.prepare(`
        UPDATE tracks
        SET local_path = NULL,
            source_type = CASE WHEN youtube_video_id IS NOT NULL THEN 'youtube' ELSE 'audius' END
        WHERE id = ? AND local_path LIKE '%cache/audio%'
      `).run(id);
    } catch (e) {}

    res.json({
      success: deleted,
      trackId: id,
      freedBytes,
      freedMB: (freedBytes / (1024 * 1024)).toFixed(2) + ' MB',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
