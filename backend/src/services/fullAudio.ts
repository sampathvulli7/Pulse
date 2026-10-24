import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { db } from '../db/database';

const execAsync = promisify(exec);

// Persistent cache directory for full-length audio tracks
const CACHE_DIR = path.resolve(__dirname, '../../cache/audio');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-flight download promises map to prevent redundant duplicate downloads
const inFlightDownloads = new Map<string, Promise<string | null>>();

/**
 * Returns the cached audio file path on disk if it exists and has content (>50KB).
 */
export function getCachedAudioPath(trackId: string): string | null {
  const m4aPath = path.join(CACHE_DIR, `${trackId}.m4a`);
  if (fs.existsSync(m4aPath)) {
    try {
      const stat = fs.statSync(m4aPath);
      if (stat.size > 50000) {
        return m4aPath;
      }
    } catch (e) {}
  }

  const mp3Path = path.join(CACHE_DIR, `${trackId}.mp3`);
  if (fs.existsSync(mp3Path)) {
    try {
      const stat = fs.statSync(mp3Path);
      if (stat.size > 50000) {
        return mp3Path;
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Ensures a track has full-length audio cached on disk.
 * Downloads the full studio-quality audio (M4A / AAC) via yt-dlp.
 */
export async function ensureFullAudio(track: {
  id: string;
  title: string;
  artist: string;
  youtubeVideoId?: string | null;
}): Promise<string | null> {
  const existing = getCachedAudioPath(track.id);
  if (existing) {
    return existing;
  }

  // Deduplicate if already downloading
  if (inFlightDownloads.has(track.id)) {
    return inFlightDownloads.get(track.id)!;
  }

  const downloadPromise = (async () => {
    const targetBase = path.join(CACHE_DIR, track.id);
    const targetM4a = `${targetBase}.m4a`;

    // Query: prefer explicit YouTube video ID if known, otherwise search artist + title
    let targetQuery: string;
    if (track.youtubeVideoId && /^[a-zA-Z0-9_-]{11}$/.test(track.youtubeVideoId)) {
      targetQuery = `https://www.youtube.com/watch?v=${track.youtubeVideoId}`;
    } else {
      const cleanArtist = track.artist.replace(/[^\w\s-]/g, ' ').trim();
      const cleanTitle = track.title.replace(/[^\w\s-]/g, ' ').trim();
      targetQuery = `ytsearch1:${cleanArtist} ${cleanTitle} official audio`;
    }

    console.log(`[FullAudio] Fetching full audio for "${track.title}" - "${track.artist}" (Query: ${targetQuery})...`);

    return new Promise<string | null>((resolve) => {
      const args = [
        '-m', 'yt_dlp',
        '-f', 'ba[ext=m4a]/ba',
        '--extract-audio',
        '--audio-format', 'm4a',
        '--no-playlist',
        '--no-warnings',
        '-o', `${targetBase}.%(ext)s`,
        targetQuery,
      ];

      const child = spawn('python3', args, {
        timeout: 25000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('close', (code) => {
        inFlightDownloads.delete(track.id);

        if (code === 0 && fs.existsSync(targetM4a)) {
          try {
            const stat = fs.statSync(targetM4a);
            if (stat.size > 50000) {
              console.log(`[FullAudio] Successfully cached full track "${track.title}" (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
              
              // Update database record to point to local file
              try {
                db.prepare(`
                  UPDATE tracks
                  SET local_path = ?, source_type = 'local', source_url = ?
                  WHERE id = ?
                `).run(targetM4a, `/api/stream/${track.id}`, track.id);
              } catch (dbErr) {
                console.warn('[FullAudio] DB update error:', dbErr);
              }

              return resolve(targetM4a);
            }
          } catch (e) {}
        }

        console.warn(`[FullAudio] Download failed or file empty for "${track.title}" (code: ${code}):`, stderr.slice(0, 300));
        resolve(null);
      });

      child.on('error', (err) => {
        inFlightDownloads.delete(track.id);
        console.warn(`[FullAudio] Process error for "${track.title}":`, err.message);
        resolve(null);
      });
    });
  })();

  inFlightDownloads.set(track.id, downloadPromise);
  return downloadPromise;
}
