import fs from 'fs';
import path from 'path';
import * as mm from 'music-metadata';
import { db } from '../db/database';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a']);

export async function scanDirectory(targetDir: string) {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Directory does not exist: ${targetDir}`);
  }

  let scanned = 0;
  let added = 0;
  let updated = 0;

  async function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) {
          scanned++;
          try {
            const metadata = await mm.parseFile(fullPath);
            const title = metadata.common.title || path.basename(entry.name, ext);
            const artist = metadata.common.artist || 'Unknown Artist';
            const album = metadata.common.album || 'Unknown Album';
            const duration = metadata.format.duration || 0;
            const bitrate = metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : 320;
            const genre = metadata.common.genre && metadata.common.genre.length > 0 ? metadata.common.genre[0] : 'Local';
            const bpm = metadata.common.bpm || (100 + Math.floor(Math.random() * 40));

            // Generate deterministic ID from path
            const trackId = `trk-local-${Buffer.from(fullPath).toString('base64url').slice(0, 16)}`;

            const existing = db.prepare('SELECT id FROM tracks WHERE id = ?').get(trackId);

            if (existing) {
              db.prepare(`
                UPDATE tracks SET
                  title = ?, artist = ?, album = ?, duration_seconds = ?,
                  genre = ?, bitrate = ?, bpm = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).run(title, artist, album, duration, genre, bitrate, bpm, trackId);
              updated++;
            } else {
              db.prepare(`
                INSERT INTO tracks (
                  id, title, artist, album, duration_seconds, source_type,
                  source_url, local_path, cover_art_url, bpm, energy, genre, bitrate
                ) VALUES (?, ?, ?, ?, ?, 'local', ?, ?, ?, ?, ?, ?, ?)
              `).run(
                trackId,
                title,
                artist,
                album,
                duration,
                `/api/stream/${trackId}`,
                fullPath,
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
                bpm,
                0.70,
                genre,
                bitrate
              );
              added++;
            }
          } catch (err) {
            console.warn(`Could not parse audio metadata for ${fullPath}:`, err);
          }
        }
      }
    }
  }

  await walk(targetDir);
  return { scanned, added, updated };
}
