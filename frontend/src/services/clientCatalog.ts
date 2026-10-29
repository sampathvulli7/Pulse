import { Track } from '../types/audio';

const AUDIUS_ENDPOINTS = [
  'https://discoveryprovider.audius.co',
  'https://audius-metadata-5.figment.io',
  'https://discoveryprovider2.audius.co',
];

export async function searchClientGlobal(query: string): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&entity=song&limit=30`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((t: any) => {
      const highResArtwork = (t.artworkUrl100 || '').replace('100x100bb.jpg', '600x600bb.jpg');
      return {
        id: `trk-global-${t.trackId}`,
        title: t.trackName,
        artist: t.artistName,
        album: t.collectionName || 'Single',
        durationSeconds: Math.round((t.trackTimeMillis || 180000) / 1000),
        coverArtUrl: highResArtwork || t.artworkUrl100 || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
        genre: t.primaryGenreName || 'Pop',
        sourceType: 'youtube' as const,
        sourceUrl: `/api/stream/trk-global-${t.trackId}?title=${encodeURIComponent(t.trackName)}&artist=${encodeURIComponent(t.artistName)}`,
        bitrate: 320,
        bpm: 120,
        energy: 0.7,
      };
    });
  } catch (err) {
    console.warn('[ClientCatalog] iTunes direct search notice:', err);
    return [];
  }
}

export async function searchClientAudius(query: string): Promise<Track[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  for (const host of AUDIUS_ENDPOINTS) {
    try {
      const url = `${host}/v1/tracks/search?query=${encodeURIComponent(trimmed)}&app_name=PULSE_MOBILE`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) continue;
      const data = await res.json();
      return (data.data || []).map((t: any) => ({
        id: `trk-audius-${t.id}`,
        title: t.title,
        artist: t.user?.name || 'Audius Creator',
        album: 'Audius Original',
        durationSeconds: t.duration || 180,
        coverArtUrl: t.artwork?.['480x480'] || t.artwork?.['150x150'] || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
        genre: t.genre || 'Electronic',
        sourceType: 'stream' as const,
        sourceUrl: `${host}/v1/tracks/${t.id}/stream?app_name=PULSE_MOBILE`,
        bitrate: 320,
        bpm: 124,
        energy: 0.8,
      }));
    } catch (e) {
      // Try next mirror
    }
  }

  return [];
}

export async function fetchClientLyrics(title: string, artist: string, duration?: number) {
  try {
    const cleanTitle = title
      .replace(/\s*-\s*(Remaster(ed)?|Live|Deluxe|Single|From\s.*).*/i, '')
      .replace(/\s*\((Remaster(ed)?|Live|Deluxe|feat\..*|ft\..*)\)/i, '')
      .trim();

    const params = new URLSearchParams({
      track_name: cleanTitle || title,
      artist_name: artist,
    });
    if (duration) params.append('duration', duration.toString());

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: {
        'User-Agent': 'PulseMobile/1.0 (https://github.com/sampathvulli7/Pulse)',
      },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        syncedLyrics: data.syncedLyrics || '',
        plainLyrics: data.plainLyrics || '',
        instrumental: !!data.instrumental,
      };
    }
  } catch (e) {
    console.warn('[ClientCatalog] Direct lyrics fetch failed:', e);
  }

  return null;
}

