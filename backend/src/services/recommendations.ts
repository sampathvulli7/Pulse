import { db } from '../db/database';

export interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  key: number;
  key_name: string;
  loudness: number;
  mode: number; // 1 = major, 0 = minor
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  duration_ms: number;
  time_signature: number;
}

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function calculateAudioFeatures(track: any): SpotifyAudioFeatures {
  const bpm = track.bpm || 120;
  const energy = track.energy !== null && track.energy !== undefined ? track.energy : 0.65;
  const durationMs = Math.round((track.duration_seconds || 180) * 1000);

  // Deterministic acoustic synthesis based on track ID and acoustic attributes
  const hash = (track.id || '').split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
  const keyIdx = Math.abs((hash + Math.round(bpm)) % 12);
  const isMinor = (hash % 3) === 0;

  // Danceability correlates with steady 110-130 BPM tempo and energy
  const tempoOptimal = 1 - Math.min(1, Math.abs(bpm - 120) / 60);
  const danceability = Math.min(0.95, Math.max(0.2, (tempoOptimal * 0.5) + (energy * 0.4) + ((hash % 15) / 100)));

  // Valence (musical positivity)
  const valence = isMinor
    ? Math.max(0.15, Math.min(0.65, 0.35 + ((hash % 30) / 100)))
    : Math.max(0.4, Math.min(0.95, 0.6 + ((hash % 35) / 100)));

  // Acousticness inversely correlates with energy
  const acousticness = Math.max(0.02, Math.min(0.85, 1 - energy * 0.9 + ((hash % 20) / 100)));

  // Instrumentalness higher for Synthwave/Lo-Fi/Electronic
  const genreLower = (track.genre || '').toLowerCase();
  let instrumentalness = 0.05;
  if (genreLower.includes('lo-fi') || genreLower.includes('ambient') || genreLower.includes('synthwave')) {
    instrumentalness = 0.75 + ((hash % 20) / 100);
  } else if (genreLower.includes('electronic') || genreLower.includes('classical')) {
    instrumentalness = 0.6 + ((hash % 30) / 100);
  }

  // Loudness in dB (-14 to -4 dB)
  const loudness = -14 + (energy * 9) + ((hash % 15) / 10);

  return {
    id: track.id,
    danceability: Number(danceability.toFixed(2)),
    energy: Number(energy.toFixed(2)),
    key: keyIdx,
    key_name: `${PITCH_CLASSES[keyIdx]} ${isMinor ? 'Minor' : 'Major'}`,
    loudness: Number(loudness.toFixed(1)),
    mode: isMinor ? 0 : 1,
    speechiness: 0.04 + ((hash % 12) / 100),
    acousticness: Number(acousticness.toFixed(2)),
    instrumentalness: Number(instrumentalness.toFixed(2)),
    liveness: 0.12 + ((hash % 18) / 100),
    valence: Number(valence.toFixed(2)),
    tempo: Math.round(bpm),
    duration_ms: durationMs,
    time_signature: 4,
  };
}

/**
 * Spotify-Style Song Radio Generator
 * Generates an endless, highly coherent track radio mix seeded by a specific song.
 */
export function generateSongRadio(seedTrackId: string, limit: number = 30) {
  const seed = db.prepare('SELECT * FROM tracks WHERE id = ?').get(seedTrackId) as any;
  if (!seed) {
    throw new Error('Seed track not found');
  }

  const seedBpm = seed.bpm || 120;
  const seedEnergy = seed.energy || 0.6;
  const seedGenre = (seed.genre || '').toLowerCase();
  const seedArtist = seed.artist;

  // Retrieve candidate tracks excluding seed
  const allTracks = db.prepare('SELECT * FROM tracks WHERE id != ?').all(seedTrackId) as any[];

  // Score candidates using acoustic similarity
  const scored = allTracks.map((t: any) => {
    let score = 0;

    // 1. Same artist bonus
    if (t.artist === seedArtist) {
      score += 35;
    }

    // 2. Genre matching
    const tGenre = (t.genre || '').toLowerCase();
    if (tGenre && seedGenre && tGenre === seedGenre) {
      score += 40;
    } else if (
      (seedGenre.includes('synth') && tGenre.includes('electr')) ||
      (seedGenre.includes('rock') && tGenre.includes('metal')) ||
      (seedGenre.includes('pop') && tGenre.includes('dance'))
    ) {
      score += 25;
    }

    // 3. BPM Proximity (+/- 15 BPM window)
    const tBpm = t.bpm || 120;
    const bpmDiff = Math.abs(tBpm - seedBpm);
    if (bpmDiff <= 8) score += 20;
    else if (bpmDiff <= 18) score += 12;
    else if (bpmDiff <= 30) score += 5;

    // 4. Energy Proximity
    const tEnergy = t.energy || 0.5;
    const energyDiff = Math.abs(tEnergy - seedEnergy);
    if (energyDiff <= 0.15) score += 15;
    else if (energyDiff <= 0.3) score += 8;

    return { track: t, score };
  });

  // Sort by score descending and take top N
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, limit).map((s) => s.track);

  return {
    seed: {
      id: seed.id,
      title: seed.title,
      artist: seed.artist,
      coverArtUrl: seed.cover_art_url,
    },
    radioPlaylistName: `${seed.title} Radio`,
    description: `With songs by ${seed.artist} and similar artists matching the vibe.`,
    tracks: selected.map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      durationSeconds: t.duration_seconds ?? 0,
      sourceType: t.source_type,
      sourceUrl: t.source_url,
      localPath: t.local_path,
      youtubeVideoId: t.youtube_video_id,
      coverArtUrl: t.cover_art_url,
      bpm: t.bpm,
      energy: t.energy,
      keySignature: t.key_signature,
      genre: t.genre,
      isrc: t.isrc,
      bitrate: t.bitrate,
      playCount: t.play_count,
      skipCount: t.skip_count,
      isFavorite: Boolean(t.is_favorite),
    })),
  };
}

/**
 * Spotify Recommendation API by Parameters (seed genres, target bpm, target energy)
 */
export function getRecommendations(params: {
  seedGenres?: string[];
  seedArtists?: string[];
  targetBpm?: number;
  targetEnergy?: number;
  limit?: number;
}) {
  const { seedGenres = [], seedArtists = [], targetBpm, targetEnergy, limit = 20 } = params;

  let query = 'SELECT * FROM tracks WHERE 1=1';
  const queryParams: any[] = [];

  if (seedGenres.length > 0) {
    const genrePlaceholders = seedGenres.map(() => '?').join(',');
    query += ` AND LOWER(genre) IN (${genrePlaceholders})`;
    queryParams.push(...seedGenres.map((g) => g.toLowerCase()));
  }

  if (seedArtists.length > 0) {
    const artistPlaceholders = seedArtists.map(() => '?').join(',');
    query += ` AND artist IN (${artistPlaceholders})`;
    queryParams.push(...seedArtists);
  }

  if (targetBpm) {
    query += ' AND bpm BETWEEN ? AND ?';
    queryParams.push(targetBpm - 20, targetBpm + 20);
  }

  if (targetEnergy) {
    query += ' AND energy BETWEEN ? AND ?';
    queryParams.push(Math.max(0, targetEnergy - 0.25), Math.min(1, targetEnergy + 0.25));
  }

  query += ' ORDER BY play_count DESC, RANDOM() LIMIT ?';
  queryParams.push(limit);

  let raw = db.prepare(query).all(...queryParams) as any[];

  // Fallback to random if filter too strict
  if (raw.length < 5) {
    raw = db.prepare('SELECT * FROM tracks ORDER BY RANDOM() LIMIT ?').all(limit) as any[];
  }

  return raw.map((t: any) => ({
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
  }));
}
