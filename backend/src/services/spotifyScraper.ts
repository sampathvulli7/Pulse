import fs from 'fs';
import puppeteer from 'puppeteer-core';

interface ScrapedTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSeconds: number;
  coverArtUrl: string;
  bpm: number;
  genre: string;
  isrc?: string | null;
}

interface ScrapedPlaylistResult {
  name: string;
  description: string;
  coverUrl: string;
  totalCount: number;
  tracks: ScrapedTrack[];
}

let cachedBearerToken: string | null = null;
let tokenExpiryTimestamp: number = 0;

/**
 * Locate Chrome/Chromium binary across Mac, Linux, and Windows platforms
 */
export function getChromeExecutablePath(): string | null {
  const customPath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const commonPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Capture an anonymous web player bearer token from Spotify
 */
export async function getAnonymousSpotifyToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && cachedBearerToken && Date.now() < tokenExpiryTimestamp) {
    return cachedBearerToken;
  }

  const executablePath = getChromeExecutablePath();
  if (!executablePath) {
    console.warn('[SpotifyScraper] No Chrome/Chromium executable found on host.');
    return null;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    });

    const page = await browser.newPage();
    let capturedToken: string | null = null;

    page.on('request', (req) => {
      const auth = req.headers()['authorization'];
      if (auth && auth.startsWith('Bearer ') && !capturedToken) {
        capturedToken = auth;
      }
    });

    await page.goto('https://open.spotify.com/', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    if (capturedToken) {
      cachedBearerToken = capturedToken;
      // Cache for 45 minutes
      tokenExpiryTimestamp = Date.now() + 45 * 60 * 1000;
      console.log('[SpotifyScraper] Successfully refreshed anonymous Spotify Web Player token');
      return capturedToken;
    }
  } catch (err) {
    console.warn('[SpotifyScraper] Error obtaining anonymous token via Puppeteer:', err);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  return null;
}

const SPOTIFY_PLAYLIST_SHA256 = '21ea11a6ac75a5f3e01fd365d29c18e0a4a8b7dc09f89bbb5d73910190c6acaf';

/**
 * Fully paginate and fetch ALL tracks for a Spotify playlist using Spotify Pathfinder GraphQL API
 */
export async function fetchFullSpotifyPlaylistGraphQL(playlistId: string): Promise<ScrapedPlaylistResult | null> {
  let token = await getAnonymousSpotifyToken();
  if (!token) {
    return null;
  }

  const cleanId = playlistId.replace('spotify:playlist:', '').trim();
  const uri = `spotify:playlist:${cleanId}`;

  let offset = 0;
  const limit = 100;
  const allTracks: ScrapedTrack[] = [];
  let playlistName = 'Imported Spotify Playlist';
  let playlistDescription = 'Imported from Spotify';
  let playlistCover = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80';
  let reportedTotalCount = 0;

  for (let page = 0; page < 100; page++) {
    const payload = {
      variables: {
        uri,
        offset,
        limit,
        enableWatchFeedEntrypoint: false,
        includeEpisodeContentRatingsV2: true,
      },
      operationName: 'fetchPlaylist',
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: SPOTIFY_PLAYLIST_SHA256,
        },
      },
    };

    let res = await fetch('https://api-partner.spotify.com/pathfinder/v2/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401 || res.status === 403) {
      console.log('[SpotifyScraper] Token expired, acquiring fresh token...');
      token = await getAnonymousSpotifyToken(true);
      if (!token) break;

      res = await fetch('https://api-partner.spotify.com/pathfinder/v2/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      console.warn(`[SpotifyScraper] GraphQL query error (${res.status}):`, await res.text().catch(() => ''));
      break;
    }

    const json = (await res.json()) as any;
    const pl = json.data?.playlistV2;
    if (!pl) {
      break;
    }

    if (pl.name) playlistName = pl.name;
    if (pl.description) playlistDescription = pl.description;

    const coverSources = pl.images?.items?.[0]?.sources;
    if (coverSources && coverSources.length > 0) {
      playlistCover = coverSources[coverSources.length - 1]?.url || coverSources[0]?.url || playlistCover;
    }

    const items = pl.content?.items || [];
    reportedTotalCount = pl.content?.totalCount || 0;

    for (const item of items) {
      const data = item.itemV2?.data || item.item?.data;
      if (!data) continue;

      const title = data.name || 'Untitled';
      const artists =
        data.artists?.items?.map((a: any) => a.profile?.name || a.name).join(', ') || 'Unknown Artist';
      const album = data.albumOfTrack?.name || playlistName;
      const durationSeconds = Math.round((data.trackDuration?.totalMilliseconds || 180000) / 1000);

      const trackCoverSources = data.albumOfTrack?.coverArt?.sources || [];
      const trackCover =
        trackCoverSources[trackCoverSources.length - 1]?.url ||
        trackCoverSources[0]?.url ||
        playlistCover;

      const trackUri = data.uri || '';
      const trackId = trackUri.startsWith('spotify:track:')
        ? `trk-spot-${trackUri.split(':')[2]}`
        : `trk-spot-${allTracks.length}-${Date.now()}`;

      const bpm = data.playlistAudioAttributes?.bpm ? Math.round(data.playlistAudioAttributes.bpm) : 120;
      const isrc = data.externalIds?.isrc || null;

      allTracks.push({
        id: trackId,
        title,
        artist: artists,
        album,
        durationSeconds,
        coverArtUrl: trackCover,
        bpm,
        genre: 'Pop',
        isrc,
      });
    }

    console.log(`[SpotifyScraper] Page ${page + 1}: fetched ${items.length} tracks (Total: ${allTracks.length}/${reportedTotalCount})`);

    if (items.length === 0 || (reportedTotalCount > 0 && allTracks.length >= reportedTotalCount)) {
      break;
    }

    offset += items.length;
  }

  if (allTracks.length === 0) {
    return null;
  }

  return {
    name: playlistName,
    description: playlistDescription,
    coverUrl: playlistCover,
    totalCount: reportedTotalCount || allTracks.length,
    tracks: allTracks,
  };
}
