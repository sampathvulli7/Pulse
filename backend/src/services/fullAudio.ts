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
 * Auto-detects the best yt-dlp executable across Docker, Linux, macOS, and Windows.
 */
function getYtDlpRunner(): { cmd: string; prefixArgs: string[] } {
  if (fs.existsSync('/usr/local/bin/yt-dlp')) {
    return { cmd: '/usr/local/bin/yt-dlp', prefixArgs: [] };
  }
  try {
    const which = require('child_process').execSync('which yt-dlp', { stdio: 'pipe' }).toString().trim();
    if (which && fs.existsSync(which)) {
      return { cmd: which, prefixArgs: [] };
    }
  } catch (e) {}

  return { cmd: 'python3', prefixArgs: ['-m', 'yt_dlp'] };
}

/**
 * Returns the cached audio file path on disk if it exists and has content (>50KB).
 * Checks all common lossless and modern streaming formats (.m4a, .mp3, .webm, .opus, .wav, .flac).
 */
export function getCachedAudioPath(trackId: string): string | null {
  const extensions = ['.m4a', '.mp3', '.webm', '.opus', '.wav', '.flac'];
  for (const ext of extensions) {
    const filePath = path.join(CACHE_DIR, `${trackId}${ext}`);
    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > 50000) {
          return filePath;
        }
      } catch (e) {}
    }
  }

  return null;
}

/**
 * Resolves a direct Google Video stream URL using yt-dlp in ~2-3 seconds.
 * Allows instant playback of full-length songs before disk caching finishes.
 */
export async function getDirectAudioStreamUrl(track: {
  id: string;
  title: string;
  artist: string;
  youtubeVideoId?: string | null;
}): Promise<string | null> {
  const cleanArtist = track.artist.replace(/[^\w\s-]/g, ' ').trim();
  const cleanTitle = track.title.replace(/[^\w\s-]/g, ' ').trim();
  const queries: string[] = [];

  if (track.youtubeVideoId && /^[a-zA-Z0-9_-]{11}$/.test(track.youtubeVideoId)) {
    queries.push(`https://www.youtube.com/watch?v=${track.youtubeVideoId}`);
  }
  queries.push(`ytsearch1:${cleanArtist} ${cleanTitle} official audio`);
  queries.push(`ytsearch1:${cleanArtist} ${cleanTitle} audio`);

  const runner = getYtDlpRunner();

  for (const q of queries) {
    const url = await new Promise<string | null>((resolve) => {
      const child = spawn(
        runner.cmd,
        [...runner.prefixArgs, '-f', 'ba[ext=m4a]/ba/bestaudio', '-g', '--no-warnings', q],
        { timeout: 8000 }
      );

      let stdout = '';
      child.stdout.on('data', (d) => {
        stdout += d.toString();
      });
      child.on('close', (code) => {
        const first = stdout.trim().split('\n')[0];
        if (code === 0 && first && first.startsWith('http')) {
          resolve(first);
        } else {
          resolve(null);
        }
      });
      child.on('error', () => resolve(null));
    });

    if (url) return url;
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

    const cleanArtist = track.artist.replace(/[^\w\s-]/g, ' ').trim();
    const cleanTitle = track.title.replace(/[^\w\s-]/g, ' ').trim();

    const queries: string[] = [];
    if (track.youtubeVideoId && /^[a-zA-Z0-9_-]{11}$/.test(track.youtubeVideoId)) {
      queries.push(`https://www.youtube.com/watch?v=${track.youtubeVideoId}`);
    }
    queries.push(`ytsearch1:${cleanArtist} ${cleanTitle} official audio`);
    queries.push(`ytsearch1:${cleanArtist} ${cleanTitle} audio`);

    const runner = getYtDlpRunner();

    for (const targetQuery of queries) {
      console.log(`[FullAudio] Fetching full audio for "${track.title}" - "${track.artist}" (Query: ${targetQuery})...`);

      const success = await new Promise<boolean>((resolve) => {
        const args = [
          ...runner.prefixArgs,
          '-f', 'ba[ext=m4a]/ba/bestaudio',
          '--extract-audio',
          '--audio-format', 'm4a',
          '--no-playlist',
          '--no-part',
          '--no-warnings',
          '--force-overwrites',
          '-o', `${targetBase}.%(ext)s`,
          targetQuery,
        ];

        const child = spawn(runner.cmd, args, {
          timeout: 30000,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        child.on('close', (code) => {
          const cached = getCachedAudioPath(track.id);
          if (code === 0 || cached) {
            return resolve(true);
          }
          resolve(false);
        });

        child.on('error', () => resolve(false));
      });

      const cachedPath = getCachedAudioPath(track.id);
      if (cachedPath && fs.existsSync(cachedPath)) {
        inFlightDownloads.delete(track.id);
        const stat = fs.statSync(cachedPath);
        console.log(`[FullAudio] Successfully cached full track "${track.title}" (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

        try {
          db.prepare(`
            UPDATE tracks
            SET local_path = ?, source_type = 'local', source_url = ?
            WHERE id = ?
          `).run(cachedPath, `/api/stream/${track.id}`, track.id);
        } catch (dbErr) {
          console.warn('[FullAudio] DB update error:', dbErr);
        }

        return cachedPath;
      }
    }

    inFlightDownloads.delete(track.id);
    return null;
  })();

  inFlightDownloads.set(track.id, downloadPromise);
  return downloadPromise;
}
