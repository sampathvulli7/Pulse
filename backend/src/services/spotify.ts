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

export async function importSpotifyPlaylist(urlOrId: string, accessToken?: string) {
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

  // Attempt 1: If access token provided, try official Spotify Web API (paginating all pages)
  if (accessToken) {
    try {
      let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}`;
      let isFirstPage = true;

      while (nextUrl && trackItems.length < 2500) {
        const response = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) break;
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
            id: `trk-spot-${t.id}`,
            title: t.name,
            artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
            album: t.album?.name,
            durationSeconds: Math.round((t.duration_ms || 180000) / 1000),
            coverArtUrl: t.album?.images?.[0]?.url || playlistCover,
            isrc: t.external_ids?.isrc || null,
          });
        }

        nextUrl = data.tracks?.next || data.next || null;
      }
    } catch (e) {
      console.warn('[Spotify] Official API playlist fetch fallback:', e);
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

export function seedDemoDataHandler() {
  return seedDemoData();
}
