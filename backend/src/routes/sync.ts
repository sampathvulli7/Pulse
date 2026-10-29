import { Router, Request, Response } from 'express';
import { db } from '../db/database';

export const syncRouter = Router();

interface SyncItem {
  id: string;
  type: 'ADD_PLAYLIST' | 'UPDATE_PLAYLIST' | 'DELETE_PLAYLIST' | 'TOGGLE_LIKE' | 'ADD_TRACK';
  payload: any;
  timestamp: number;
}

syncRouter.post('/', (req: Request, res: Response) => {
  try {
    const { syncQueue = [], lastSyncTimestamp = 0 } = req.body;
    const processedSyncIds: string[] = [];

    // Process queued operations from mobile/offline client
    if (Array.isArray(syncQueue) && syncQueue.length > 0) {
      const transaction = db.transaction((items: SyncItem[]) => {
        for (const op of items) {
          try {
            if (op.type === 'ADD_PLAYLIST') {
              const pl = op.payload;
              db.prepare(`
                INSERT OR REPLACE INTO playlists (id, name, description, is_smart, cover_url)
                VALUES (?, ?, ?, ?, ?)
              `).run(pl.id, pl.name, pl.description || '', pl.isSmart ? 1 : 0, pl.coverUrl || '');

              if (Array.isArray(pl.tracks)) {
                pl.tracks.forEach((t: any, idx: number) => {
                  db.prepare(`
                    INSERT OR IGNORE INTO tracks (id, title, artist, album, duration_seconds, source_type, source_url, cover_art_url, bpm, energy, genre, bitrate)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 120, 0.7, 'Pop', 320)
                  `).run(t.id, t.title, t.artist, t.album || null, t.durationSeconds || 180, t.sourceType || 'local', t.sourceUrl || `/api/stream/${t.id}`, t.coverArtUrl || pl.coverUrl);

                  db.prepare(`
                    INSERT OR REPLACE INTO playlist_tracks (id, playlist_id, track_id, position)
                    VALUES (?, ?, ?, ?)
                  `).run(`pltr-${pl.id}-${t.id}`, pl.id, t.id, idx);
                });
              }
              processedSyncIds.push(op.id);
            } else if (op.type === 'DELETE_PLAYLIST') {
              const { id } = op.payload;
              db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(id);
              db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
              processedSyncIds.push(op.id);
            } else if (op.type === 'UPDATE_PLAYLIST') {
              const { playlistId, action, track, trackId } = op.payload;
              if (action === 'add' && track) {
                db.prepare(`
                  INSERT OR IGNORE INTO tracks (id, title, artist, album, duration_seconds, source_type, source_url, cover_art_url, bpm, energy, genre, bitrate)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 120, 0.7, 'Pop', 320)
                `).run(track.id, track.title, track.artist, track.album || null, track.durationSeconds || 180, track.sourceType || 'local', track.sourceUrl || `/api/stream/${track.id}`, track.coverArtUrl || '');

                const pos = (db.prepare('SELECT COUNT(*) as count FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as any)?.count || 0;
                db.prepare(`
                  INSERT OR REPLACE INTO playlist_tracks (id, playlist_id, track_id, position)
                  VALUES (?, ?, ?, ?)
                `).run(`pltr-${playlistId}-${track.id}`, playlistId, track.id, pos);
              } else if (action === 'remove' && trackId) {
                db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(playlistId, trackId);
              }
              processedSyncIds.push(op.id);
            } else if (op.type === 'TOGGLE_LIKE') {
              const { trackId, isFavorite } = op.payload;
              db.prepare('UPDATE tracks SET is_favorite = ? WHERE id = ?').run(isFavorite ? 1 : 0, trackId);
              processedSyncIds.push(op.id);
            }
          } catch (itemErr) {
            console.warn(`[Sync] Error processing op ${op.id}:`, itemErr);
          }
        }
      });

      transaction(syncQueue);
    }

    // Retrieve server state changes
    const rawPlaylists = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) as track_count
      FROM playlists p
      ORDER BY p.is_favorite DESC, p.created_at DESC
    `).all() as any[];

    const serverPlaylists = rawPlaylists.map((p) => {
      const tracks = db.prepare(`
        SELECT t.*, pt.position
        FROM playlist_tracks pt
        JOIN tracks t ON pt.track_id = t.id
        WHERE pt.playlist_id = ?
        ORDER BY pt.position ASC
      `).all(p.id) as any[];

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        isSmart: !!p.is_smart,
        coverUrl: p.cover_url,
        isFavorite: !!p.is_favorite,
        trackCount: tracks.length,
        tracks: tracks.map((t) => ({
          ...t,
          durationSeconds: t.duration_seconds ?? 0,
          sourceType: t.source_type,
          sourceUrl: t.source_url || `/api/stream/${t.id}`,
          coverArtUrl: t.cover_art_url,
          youtubeVideoId: t.youtube_video_id,
        })),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
    });

    const likedRows = db.prepare('SELECT id FROM tracks WHERE is_favorite = 1').all() as any[];
    const favoriteTrackIds = likedRows.map((r) => r.id);

    res.json({
      status: 'ok',
      processedSyncIds,
      serverPlaylists,
      favoriteTrackIds,
      syncTimestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('[Sync] Error syncing state:', err);
    res.status(500).json({ error: err.message });
  }
});
