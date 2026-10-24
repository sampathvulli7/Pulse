import { db } from '../db/database';

export interface DailyMix {
  id: string;
  name: string;
  subtitle: string;
  genre: string;
  coverUrl: string;
  trackCount: number;
  tracks: any[];
}

export function generateDailyMixes(): DailyMix[] {
  // Query distinct genres with at least 3 tracks
  const genres = db.prepare(`
    SELECT genre, COUNT(*) as count
    FROM tracks
    WHERE genre IS NOT NULL AND TRIM(genre) != ''
    GROUP BY genre
    HAVING count >= 3
    ORDER BY count DESC
    LIMIT 6
  `).all() as { genre: string; count: number }[];

  const mixes: DailyMix[] = [];

  for (let i = 0; i < genres.length; i++) {
    const g = genres[i];
    const mixIndex = i + 1;

    // Fetch tracks for this genre
    const tracks = db.prepare(`
      SELECT * FROM tracks
      WHERE LOWER(genre) = LOWER(?)
      ORDER BY play_count DESC, RANDOM()
      LIMIT 30
    `).all(g.genre) as any[];

    if (tracks.length === 0) continue;

    // Extract top 3 unique artists for the subtitle
    const topArtists = Array.from(new Set(tracks.map((t) => t.artist))).slice(0, 3);
    const subtitle = `${topArtists.join(', ')} and more`;
    const coverUrl = tracks[0]?.cover_art_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80';

    mixes.push({
      id: `daily-mix-${mixIndex}`,
      name: `Daily Mix ${mixIndex}`,
      subtitle,
      genre: g.genre,
      coverUrl,
      trackCount: tracks.length,
      tracks: tracks.map((t: any) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        durationSeconds: t.duration_seconds ?? 0,
        sourceType: t.source_type,
        sourceUrl: t.source_url,
        coverArtUrl: t.cover_art_url,
        bpm: t.bpm,
        energy: t.energy,
        genre: t.genre,
        isFavorite: Boolean(t.is_favorite),
      })),
    });
  }

  return mixes;
}
