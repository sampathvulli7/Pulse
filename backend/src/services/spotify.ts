import crypto from 'crypto';
import { db } from '../db/database';
import { seedDemoData } from '../db/seed';
import { fetchFullSpotifyPlaylistGraphQL } from './spotifyScraper';

export function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function getSpotifyAuthUrl(clientId: string, redirectUri: string, challenge: string) {
  const scopes = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: scopes,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string
) {
  const params = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Spotify token exchange failed: ${errorBody}`);
  }

  return response.json();
}

export async function resolveYouTubeAudioId(artist: string, title: string): Promise<string> {
  try {
    const q = encodeURIComponent(`${artist} ${title} audio`);
    const res = await fetch(`https://www.youtube.com/results?search_query=${q}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (err) {
    console.warn('YouTube audio resolver fallback:', err);
  }
  return 'i2bhnV4zQ-A'; // Fallback audio
}

export async function searchAudiusTracks(query: string) {
  try {
    const res = await fetch(`https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=pulse`);
    if (!res.ok) return [];
    const json = await res.json() as any;
    const items = json.data || [];
    return items.map((t: any) => {
      const trackId = t.track_id || t.id;
      const rawArtwork = t.artwork?.['480x480'] || t.artwork?.['150x150'] || t.artwork?.['1000x1000'];
      const artwork = rawArtwork
        ? `/api/image/proxy?url=${encodeURIComponent(rawArtwork)}`
        : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80';
      const streamUrl = `https://discoveryprovider.audius.co/v1/tracks/${trackId}/stream?app_name=pulse`;
      return {
        id: `trk-audius-${trackId}`,
        title: t.title || 'Untitled',
        artist: t.user?.name || 'Audius Creator',
        album: t.description ? t.description.slice(0, 40) : 'Audius Release',
        durationSeconds: Math.round(t.duration || 180),
        coverArtUrl: artwork,
        previewUrl: streamUrl,
        sourceUrl: streamUrl,
        sourceType: 'stream',
        genre: t.genre || 'Electronic',
        bpm: t.bpm || 120,
        platform: 'audius',
        platformBadge: 'Audius 320k (Full Track)',
      };
    });
  } catch (err) {
    console.warn('[Audius] Search failed:', err);
    return [];
  }
}

export async function searchGlobalTracks(query: string) {
  try {
    const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25`);
    if (!itunesRes.ok) return [];
    const data = await itunesRes.json() as any;
    return (data.results || []).map((t: any) => {
      const highResArtwork = (t.artworkUrl100 || '').replace('100x100bb.jpg', '600x600bb.jpg');
      const proxiedUrl = t.previewUrl ? `/api/stream/proxy?url=${encodeURIComponent(t.previewUrl)}` : undefined;
      return {
        id: `trk-global-${t.trackId}`,
        title: t.trackName,
        artist: t.artistName,
        album: t.collectionName || 'Single',
        durationSeconds: Math.round((t.trackTimeMillis || 180000) / 1000),
        coverArtUrl: highResArtwork || t.artworkUrl100 || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
        previewUrl: t.previewUrl,
        sourceUrl: proxiedUrl,
        genre: t.primaryGenreName || 'Pop',
        isrc: t.isrc,
        sourceType: 'stream',
        platform: 'global',
        platformBadge: 'Studio Master 256k',
      };
    });
  } catch (err) {
    console.warn('[Global/iTunes] Search failed:', err);
    return [];
  }
}

export async function searchArchiveTracks(query: string) {
  try {
    const archiveUrl = `https://archive.org/advancedsearch.php?q=mediatype:audio+AND+(${encodeURIComponent(query)})&fl[]=identifier,title,creator,description,year&rows=10&output=json`;
    const res = await fetch(archiveUrl);
    if (!res.ok) return [];
    const data = await res.json() as any;
    const docs = data.response?.docs || [];
    return docs.map((d: any) => {
      const streamUrl = `/api/stream/proxy?url=${encodeURIComponent(`https://archive.org/download/${d.identifier}`)}`;
      return {
        id: `trk-archive-${d.identifier}`,
        title: d.title || 'Archive Recording',
        artist: d.creator || 'Internet Archive',
        album: d.description ? d.description.slice(0, 40) : 'Public Domain Collection',
        durationSeconds: 240,
        coverArtUrl: `https://archive.org/services/img/${d.identifier}`,
        previewUrl: streamUrl,
        sourceUrl: streamUrl,
        sourceType: 'stream',
        genre: 'Archive / Historic',
        platform: 'archive',
        platformBadge: 'Public Domain / Live',
      };
    });
  } catch (err) {
    console.warn('[InternetArchive] Search failed:', err);
    return [];
  }
}

export async function searchSpotifyTracks(query: string, accessToken?: string, sourceFilter: string = 'all') {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // 1. Check if user pasted a Spotify Track URL
  if (trimmed.includes('spotify.com/track/') || trimmed.startsWith('spotify:track:')) {
    let spotifyUrl = trimmed;
    if (trimmed.startsWith('spotify:track:')) {
      const id = trimmed.split(':')[2];
      spotifyUrl = `https://open.spotify.com/track/${id}`;
    }

    try {
      const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json() as any;
        const titleParts = (oembedData.title || '').split(' - ');
        const title = titleParts[0] || 'Unknown Track';
        const artist = titleParts.slice(1).join(' - ') || 'Spotify Artist';

        return [
          {
            id: `spot-${Date.now()}`,
            title,
            artist,
            album: 'Spotify Single',
            durationSeconds: 210,
            coverArtUrl: oembedData.thumbnail_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
            genre: 'Spotify',
            sourceType: 'youtube',
            platform: 'spotify',
            platformBadge: 'Spotify Web Match',
          },
        ];
      }
    } catch (e) {
      console.warn('Spotify oEmbed lookup failed:', e);
    }
  }

  // 2. If user has active Spotify Access Token, search official Spotify API
  if (accessToken && (sourceFilter === 'all' || sourceFilter === 'spotify')) {
    try {
      const spRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(trimmed)}&type=track&limit=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (spRes.ok) {
        const data = await spRes.json() as any;
        return (data.tracks?.items || []).map((t: any) => ({
          id: `trk-spot-${t.id}`,
          title: t.name,
          artist: t.artists.map((a: any) => a.name).join(', '),
          album: t.album.name,
          durationSeconds: Math.round(t.duration_ms / 1000),
          coverArtUrl: t.album.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
          genre: 'Spotify',
          isrc: t.external_ids?.isrc,
          sourceType: 'youtube',
          platform: 'spotify',
          platformBadge: 'Spotify API',
        }));
      }
    } catch (e) {
      console.warn('Spotify API search failed, falling back to open catalog:', e);
    }
  }

  // 3. Multi-source parallel search across open platforms (NO API keys required!)
  if (sourceFilter === 'audius') {
    return searchAudiusTracks(trimmed);
  }
  if (sourceFilter === 'global') {
    return searchGlobalTracks(trimmed);
  }
  if (sourceFilter === 'archive') {
    return searchArchiveTracks(trimmed);
  }

  // 'all' filter: search Audius and Global/iTunes in parallel
  const [audiusResults, globalResults] = await Promise.all([
    searchAudiusTracks(trimmed),
    searchGlobalTracks(trimmed),
  ]);

  // Interleave or combine: prioritize high-quality results
  const combined: any[] = [];
  const maxLen = Math.max(audiusResults.length, globalResults.length);
  for (let i = 0; i < maxLen; i++) {
    if (globalResults[i]) combined.push(globalResults[i]);
    if (audiusResults[i]) combined.push(audiusResults[i]);
  }

  if (combined.length > 0) {
    return combined;
  }

  // 4. Fallback search against local SQLite library
  const localMatches = db.prepare(`
    SELECT * FROM tracks
    WHERE LOWER(title) LIKE ? OR LOWER(artist) LIKE ?
    LIMIT 10
  `).all(`%${trimmed.toLowerCase()}%`, `%${trimmed.toLowerCase()}%`) as any[];

  return localMatches.map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    durationSeconds: t.duration_seconds,
    coverArtUrl: t.cover_art_url,
    genre: t.genre,
    sourceType: t.source_type,
    sourceUrl: t.source_url || `/api/stream/${t.id}`,
    youtubeVideoId: t.youtube_video_id,
    platform: 'local',
    platformBadge: 'Local Library',
  }));
}

let cachedAppToken: string | null = null;
let cachedAppTokenExpiresAt: number = 0;

/**
 * Obtain an official Spotify Client Credentials app access token.
 * Enables full multi-page pagination (100 - 5,000+ tracks) for all public Spotify playlists.
 */
export async function getSpotifyAppToken(
  customClientId?: string,
  customClientSecret?: string
): Promise<string | null> {
  const clientId = (customClientId || process.env.SPOTIFY_CLIENT_ID || '').trim();
  const clientSecret = (customClientSecret || process.env.SPOTIFY_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  // Use memory cached token if still valid (60s buffer)
  if (cachedAppToken && Date.now() < cachedAppTokenExpiresAt - 60000) {
    return cachedAppToken;
  }

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      console.warn(`[Spotify API] Client credentials auth failed (${res.status}):`, await res.text().catch(() => ''));
      return null;
    }

    const data = (await res.json()) as any;
    if (data.access_token) {
      cachedAppToken = data.access_token;
      cachedAppTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      console.log(`[Spotify API] Acquired fresh client_credentials app token (valid ${data.expires_in}s)`);
      return data.access_token;
    }
  } catch (err) {
    console.warn('[Spotify API] Error obtaining client credentials token:', err);
  }

  return null;
}

export async function importSpotifyPlaylist(
  urlOrId: string,
  accessToken?: string,
  customClientId?: string,
  customClientSecret?: string
) {
  // Extract pure Spotify playlist ID if a full URL was provided
  const match = urlOrId.match(/playlist\/([a-zA-Z0-9]+)/);
  const playlistId = match ? match[1] : urlOrId.trim();

  let playlistName = 'Imported Spotify Playlist';
  let playlistDescription = 'Imported from Spotify';
  let playlistCover = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80';
  let trackItems: Array<{
    id: string;
    title: string;
    artist: string;
    album?: string;
    durationSeconds: number;
    coverArtUrl?: string;
    isrc?: string | null;
    bpm?: number;
  }> = [];

  // Attempt 1: Official Spotify Web API with full pagination across all pages (up to 5,000 tracks)
  const effectiveToken = accessToken || (await getSpotifyAppToken(customClientId, customClientSecret));

  if (effectiveToken) {
    try {
      console.log(`[Spotify API] Paginating complete playlist ${playlistId} via official Web API...`);
      let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}`;
      let isFirstPage = true;
      let pageCount = 0;

      while (nextUrl && trackItems.length < 5000) {
        pageCount++;
        const response = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        if (!response.ok) {
          console.warn(`[Spotify API] Page ${pageCount} fetch failed (${response.status})`);
          break;
        }
        const data = (await response.json()) as any;
        if (isFirstPage) {
          playlistName = data.name || playlistName;
          playlistDescription = data.description || playlistDescription;
          playlistCover = data.images?.[0]?.url || playlistCover;
          isFirstPage = false;
        }

        const items = data.tracks?.items || data.items || [];
        for (const item of items) {
          if (!item.track) continue;
          const t = item.track;
          trackItems.push({
            id: `trk-spot-${t.id || Date.now() + Math.random().toString(36).substring(2, 6)}`,
            title: t.name || 'Untitled',
            artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
            album: t.album?.name,
            durationSeconds: Math.round((t.duration_ms || 180000) / 1000),
            coverArtUrl: t.album?.images?.[0]?.url || playlistCover,
            isrc: t.external_ids?.isrc || null,
          });
        }

        nextUrl = data.tracks?.next || data.next || null;
      }
      console.log(`[Spotify API] Successfully fetched ${trackItems.length} total tracks across ${pageCount} page(s) for "${playlistName}".`);
    } catch (e) {
      console.warn('[Spotify API] Official API playlist fetch fallback:', e);
    }
  }

  // Attempt 2: Full GraphQL Scraper (Zero Keys Required! Fetches all 385+ tracks without limits)
  if (trackItems.length === 0) {
    try {
      console.log(`[Spotify] Launching Full GraphQL Scraper for playlist ${playlistId}...`);
      const fullScrape = await fetchFullSpotifyPlaylistGraphQL(playlistId);
      if (fullScrape && fullScrape.tracks.length > 0) {
        playlistName = fullScrape.name;
        playlistDescription = fullScrape.description;
        playlistCover = fullScrape.coverUrl;
        trackItems = fullScrape.tracks;
        console.log(`[Spotify] Full GraphQL Scraper successfully extracted ${trackItems.length} tracks for "${playlistName}"`);
      }
    } catch (e) {
      console.warn('[Spotify] Full GraphQL scraper fallback:', e);
    }
  }

  // Attempt 3: Public embed scraper fallback (up to 100 tracks if Chrome/GraphQL unavailable)
  if (trackItems.length === 0) {
    try {
      const embedRes = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`);
      if (embedRes.ok) {
        const html = await embedRes.text();
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
        if (nextDataMatch) {
          const parsed = JSON.parse(nextDataMatch[1]);
          const entity = parsed.props?.pageProps?.state?.data?.entity;
          if (entity) {
            playlistName = entity.name || entity.title || playlistName;
            playlistDescription = entity.subtitle || 'Imported Spotify Public Playlist';
            playlistCover = entity.coverArt?.sources?.[0]?.url || playlistCover;

            const list = entity.trackList || [];
            for (const t of list) {
              const trkId = t.uri ? `trk-spot-${t.uri.split(':')[2]}` : `trk-spot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
              trackItems.push({
                id: trkId,
                title: t.title || 'Untitled',
                artist: t.subtitle || 'Spotify Artist',
                album: entity.name || 'Spotify Playlist',
                durationSeconds: Math.round((t.duration || 180000) / 1000),
                coverArtUrl: playlistCover,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Spotify] Public embed scraper failed:', e);
    }
  }

  if (trackItems.length === 0) {
    throw new Error('Could not find or import Spotify playlist. Please verify the URL or playlist privacy setting.');
  }

  const plId = `pl-spot-${playlistId}`;
  db.prepare(`
    INSERT OR REPLACE INTO playlists (id, name, description, is_smart, cover_url)
    VALUES (?, ?, ?, 0, ?)
  `).run(plId, playlistName, playlistDescription, playlistCover);

  // Clear existing playlist items to avoid duplicate / stale entries on re-import
  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(plId);

  const insertTrackStmt = db.prepare(`
    INSERT OR REPLACE INTO tracks (
      id, title, artist, album, duration_seconds, source_type,
      source_url, youtube_video_id, cover_art_url, bpm, energy, genre, isrc, bitrate
    ) VALUES (?, ?, ?, ?, ?, 'local', ?, null, ?, ?, 0.7, 'Pop', ?, 320)
  `);

  const linkStmt = db.prepare(`
    INSERT OR REPLACE INTO playlist_tracks (id, playlist_id, track_id, position)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction((tracks: typeof trackItems) => {
    tracks.forEach((t, idx) => {
      const streamUrl = `/api/stream/${t.id}`;
      insertTrackStmt.run(
        t.id,
        t.title,
        t.artist,
        t.album || null,
        t.durationSeconds,
        streamUrl,
        t.coverArtUrl || playlistCover,
        t.bpm || 120,
        t.isrc || null
      );

      linkStmt.run(`pltr-spot-${plId}-${idx}`, plId, t.id, idx);
    });
  });

  transaction(trackItems);

  return { playlistId: plId, name: playlistName, tracksImported: trackItems.length };
}

/**
 * Bulk import a list of Spotify track URLs, URIs, or plain text tracklines (e.g. from Cmd+A -> Cmd+C in Spotify).
 * Can effortlessly import hundreds or thousands of songs in a single action.
 */
export async function importTracklistText(
  rawText: string,
  customName?: string,
  accessToken?: string,
  customClientId?: string,
  customClientSecret?: string
) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('No tracks found in the provided text.');
  }

  const playlistName = customName?.trim() || `Imported Tracks (${new Date().toLocaleDateString()})`;
  const playlistDescription = `Imported tracklist containing ${lines.length} items`;
  let playlistCover = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80';

  const effectiveToken = accessToken || (await getSpotifyAppToken(customClientId, customClientSecret));

  // Identify Spotify track IDs or plain text song lines
  const spotifyTrackIds: string[] = [];
  const parsedLines: Array<{ raw: string; spotifyId?: string; title?: string; artist?: string }> = [];

  for (const line of lines) {
    const urlMatch = line.match(/(?:open\.spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]+)/);
    if (urlMatch) {
      spotifyTrackIds.push(urlMatch[1]);
      parsedLines.push({ raw: line, spotifyId: urlMatch[1] });
    } else {
      // Parse plain text e.g. "1. The Weeknd - Blinding Lights" or "Queen - Bohemian Rhapsody" or "Song by Artist"
      const cleanLine = line.replace(/^\d+[\.\)]\s*/, '').trim();
      let artist = 'Various Artists';
      let title = cleanLine;

      if (cleanLine.includes(' - ') || cleanLine.includes(' – ') || cleanLine.includes(' — ')) {
        const parts = cleanLine.split(/\s*[-–—]\s*/);
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }
      } else if (/\s+by\s+/i.test(cleanLine)) {
        const parts = cleanLine.split(/\s+by\s+/i);
        if (parts.length >= 2) {
          title = parts[0].trim();
          artist = parts[1].trim();
        }
      }

      parsedLines.push({ raw: line, title, artist });
    }
  }

  // If we have Spotify IDs and a token, fetch enriched metadata in batches of 50
  const spotifyMetadataMap = new Map<
    string,
    { title: string; artist: string; album: string; durationSeconds: number; coverArtUrl: string; isrc?: string }
  >();

  if (spotifyTrackIds.length > 0 && effectiveToken) {
    const batchSize = 50;
    for (let i = 0; i < spotifyTrackIds.length; i += batchSize) {
      const batchIds = spotifyTrackIds.slice(i, i + batchSize);
      try {
        const res = await fetch(`https://api.spotify.com/v1/tracks?ids=${batchIds.join(',')}`, {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          for (const t of data.tracks || []) {
            if (!t) continue;
            spotifyMetadataMap.set(t.id, {
              title: t.name,
              artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
              album: t.album?.name || 'Single',
              durationSeconds: Math.round((t.duration_ms || 180000) / 1000),
              coverArtUrl: t.album?.images?.[0]?.url || playlistCover,
              isrc: t.external_ids?.isrc,
            });
          }
        }
      } catch (err) {
        console.warn('[Spotify API] Bulk track lookup batch failed:', err);
      }
    }
  }

  const trackItems: Array<{
    id: string;
    title: string;
    artist: string;
    album?: string;
    durationSeconds: number;
    coverArtUrl: string;
    isrc?: string | null;
  }> = [];

  for (let idx = 0; idx < parsedLines.length; idx++) {
    const item = parsedLines[idx];
    if (item.spotifyId && spotifyMetadataMap.has(item.spotifyId)) {
      const meta = spotifyMetadataMap.get(item.spotifyId)!;
      trackItems.push({
        id: `trk-spot-${item.spotifyId}`,
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        durationSeconds: meta.durationSeconds,
        coverArtUrl: meta.coverArtUrl,
        isrc: meta.isrc || null,
      });
      if (idx === 0 && meta.coverArtUrl) {
        playlistCover = meta.coverArtUrl;
      }
    } else if (item.spotifyId) {
      trackItems.push({
        id: `trk-spot-${item.spotifyId}`,
        title: `Spotify Track ${item.spotifyId}`,
        artist: 'Spotify Artist',
        album: playlistName,
        durationSeconds: 180,
        coverArtUrl: playlistCover,
      });
    } else {
      trackItems.push({
        id: `trk-txt-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        title: item.title || 'Untitled',
        artist: item.artist || 'Unknown Artist',
        album: playlistName,
        durationSeconds: 200,
        coverArtUrl: playlistCover,
      });
    }
  }

  const plId = `pl-bulk-${Date.now()}`;
  db.prepare(`
    INSERT OR REPLACE INTO playlists (id, name, description, is_smart, cover_url)
    VALUES (?, ?, ?, 0, ?)
  `).run(plId, playlistName, playlistDescription, playlistCover);

  const insertTrackStmt = db.prepare(`
    INSERT OR REPLACE INTO tracks (
      id, title, artist, album, duration_seconds, source_type,
      source_url, youtube_video_id, cover_art_url, bpm, energy, genre, isrc, bitrate
    ) VALUES (?, ?, ?, ?, ?, 'local', ?, null, ?, 120, 0.7, 'Pop', ?, 320)
  `);

  const linkStmt = db.prepare(`
    INSERT OR REPLACE INTO playlist_tracks (id, playlist_id, track_id, position)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction((tracks: typeof trackItems) => {
    tracks.forEach((t, idx) => {
      const streamUrl = `/api/stream/${t.id}`;
      insertTrackStmt.run(
        t.id,
        t.title,
        t.artist,
        t.album || null,
        t.durationSeconds,
        streamUrl,
        t.coverArtUrl || playlistCover,
        t.isrc || null
      );
      linkStmt.run(`pltr-${plId}-${idx}`, plId, t.id, idx);
    });
  });

  transaction(trackItems);

  return { playlistId: plId, name: playlistName, tracksImported: trackItems.length };
}

export function seedDemoDataHandler() {
  return seedDemoData();
}

