import { Request, Response } from 'express';

// In-memory lyrics cache
const lyricsCache = new Map<string, any>();

export interface ParsedLyricLine {
  timeMs: number;
  text: string;
}

/**
 * Parses raw LRC format into timestamped line objects.
 * Handles centiseconds, milliseconds, multiple timestamps, offsets, and interludes.
 */
export function parseLrc(lrcText: string): ParsedLyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split(/\r?\n/);
  const parsed: ParsedLyricLine[] = [];
  let globalOffsetMs = 0;

  for (const line of lines) {
    const offsetMatch = line.match(/^\[offset:\s*([+-]?\d+)\]/i);
    if (offsetMatch) {
      globalOffsetMs = parseInt(offsetMatch[1], 10) || 0;
      break;
    }
  }

  const timeRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const line of lines) {
    if (/^\[(ti|ar|al|au|length|by|offset|re|ve):/i.test(line)) continue;

    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      let ms = 0;
      if (match[3]) {
        if (match[3].length === 1) ms = parseInt(match[3], 10) * 100;
        else if (match[3].length === 2) ms = parseInt(match[3], 10) * 10;
        else ms = parseInt(match[3].slice(0, 3), 10);
      }
      timestamps.push(min * 60000 + sec * 1000 + ms + globalOffsetMs);
    }

    if (timestamps.length === 0) continue;

    const text = line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim();
    for (const timeMs of timestamps) {
      parsed.push({
        timeMs: Math.max(0, timeMs),
        text: text || '♪',
      });
    }
  }

  parsed.sort((a, b) => a.timeMs - b.timeMs);
  return parsed;
}

// Fallback studio-accurate synchronized lyrics for key demo tracks (used if LRCLIB is offline)
const DEMO_LRC: Record<string, string> = {
  'blinding lights': `[00:00.00] (Synth Arpeggio Intro)
[00:13.13] Yeah
[00:16.56] ♪
[00:27.16] I've been tryna call
[00:29.96] I've been on my own for long enough
[00:32.71] Maybe you can show me how to love, maybe
[00:38.29] I'm goin' through withdrawals
[00:41.23] You don't even have to do too much
[00:44.12] You can turn me on with just a touch, baby
[00:49.57] I look around and
[00:50.62] Sin City's cold and empty (oh)
[00:53.53] No one's around to judge me (oh)
[00:56.24] I can't see clearly when you're gone
[01:00.73] I said, "Ooh, I'm blinded by the lights
[01:06.69] No, I can't sleep until I feel your touch"
[01:11.79] I said, "Ooh, I'm drowning in the night
[01:17.89] Oh, when I'm like this, you're the one I trust"
[01:22.16] (Hey, hey, hey)
[01:25.44] ♪
[01:34.36] I'm running out of time
[01:37.03] 'Cause I can see the sun light up the sky
[01:40.04] So I hit the road in overdrive, baby, oh
[01:46.64] The city's cold and empty (oh)
[01:49.52] No one's around to judge me (oh)
[01:52.47] I can't see clearly when you're gone
[01:56.98] I said, "Ooh, I'm blinded by the lights
[02:02.70] No, I can't sleep until I feel your touch"
[02:07.94] I said, "Ooh, I'm drowning in the night
[02:14.00] Oh, when I'm like this, you're the one I trust"
[02:19.17] I'm just walking by to let you know (by to let you know)
[02:22.16] I could never say it on the phone (say it on the phone)
[02:25.37] Will never let you go this time (ooh)
[02:30.27] I said, "Ooh, I'm blinded by the lights
[02:36.33] No, I can't sleep until I feel your touch"
[02:40.50] (Hey, hey, hey)
[02:43.98] ♪
[02:51.73] (Hey, hey, hey)
[02:55.20] ♪
[03:03.90] I said, "Ooh, I'm blinded by the lights
[03:10.12] No, I can't sleep until I feel your touch"`,

  vampires: `[00:00.00] (Instrumental Saxophone Intro)
[00:25.17] Strangers in a dark room, laughing at jokes they didn't quite hear
[00:33.06] Frosted window panes and cheap champagne a face appears
[00:41.96] And anything could happen in these cathedrals we roam
[00:50.01] Where shadow people dance and trade their glance and walk home alone
[00:58.85] ♪
[01:32.04] She's staring out the window of the Roosevelt Hotel
[01:40.02] Watching midtown empty out and I kiss her farewell
[01:48.17] They say we come from nothing and to nothing we'll return
[01:56.91] And in between is gravity and bridges left to burn
[02:03.44] ♪`,

  everlong: `[00:00.00] (Drum and Guitar Intro)
[00:31.73] Hello
[00:34.43] I've waited here for you
[00:38.64] Everlong
[00:42.47] Tonight
[00:44.85] I throw myself into
[00:49.29] And out of the red, out of her head, she sang
[00:55.35] ♪
[01:03.68] Come down
[01:06.13] And waste away with me
[01:10.56] Down with me
[01:14.10] Slow how
[01:17.07] You wanted it to be
[01:21.08] I'm over my head, out of her head she sang
[01:28.91] And I wonder, when I sing along with you
[01:37.37] If everything could ever feel this real forever
[01:43.30] If anything could ever be this good again
[01:49.45] The only thing I'll ever ask of you
[01:52.54] You gotta promise not to stop when I say when
[01:57.35] She sang
[02:00.25] ♪
[02:09.07] Breathe out
[02:11.57] So I can breathe you in
[02:15.74] Hold you in
[02:19.78] And now
[02:22.27] I know you've always been there
[02:26.49] Out of your head, out of my head I sang
[02:31.86] ♪
[02:34.33] And I wonder, when I sing along with you
[02:42.64] If everything could ever feel this real forever
[02:48.78] If anything could ever be this good again
[02:54.86] The only thing I'll ever ask of you
[02:57.92] You gotta promise not to stop when I say when
[03:02.87] She sang`,

  sunset: `[00:00.00] (Synth Pulse Intro)
[00:19.58] I just feel like, I've been stuck here my whole life
[00:26.44] There must be something else out there, waiting, you know?
[00:31.59] Just for us
[00:35.74] We could run away
[00:39.18] Just leave, never look back
[00:46.11] I don't even care where we go
[00:48.56] Just far away from here
[00:51.85] I'll come with you
[00:53.06] (One, two, three, four)
[00:56.23] ♪
[01:10.92] Faked our deaths, lit a match
[01:15.25] Closed the door, waited for the flash
[01:19.23] Greyhound Station, we paid in cash
[01:23.32] Miss Lazarus, we're coming back
[01:28.44] They say it's darkest before the dawn
[01:32.80] We've been in this town for far too long
[01:37.00] They say it's darkest before the dawn
[01:40.71] We're moving on, we're moving on, we're moving on
[01:45.22] Sunset, no regrets
[01:49.23] First chance, last dance, stuck in the middle
[01:53.29] Even bad girls know good love
[01:57.98] You taste so sweet it hurts a little
[02:03.69] ♪
[02:18.37] Make our home, where we stand
[02:22.85] One suitcase and half a plan
[02:26.70] Follow the wolves and sing along
[02:31.23] Past the voices to the song
[02:36.25] They say it's darkest before the dawn
[02:40.27] We've been in this town for far too long
[02:44.69] They say it's darkest before the dawn
[02:48.38] We're moving on, we're moving on, we're moving on
[02:52.70] Sunsets, no regrets
[02:56.99] First chance, last dance, stuck in the middle
[03:00.46] Even bad girls know good love
[03:05.34] You taste so sweet it hurts a little`,
};

export async function handleLyrics(req: Request, res: Response) {
  const trackName = ((req.query.track_name as string) || '').trim();
  const artistName = ((req.query.artist_name as string) || '').trim();
  const duration = req.query.duration ? Number(req.query.duration) : undefined;

  if (!trackName) {
    return res.status(400).json({ error: 'track_name query parameter is required' });
  }

  const cacheKey = `${trackName.toLowerCase()}-${artistName.toLowerCase()}`;
  if (lyricsCache.has(cacheKey)) {
    return res.json(lyricsCache.get(cacheKey));
  }

  // Strip feature tags / remaster tags for high match rates
  const cleanTrack = trackName
    .replace(/\s*-\s*(Remaster(ed)?|Live|Deluxe|Mono|Stereo|Single|From\s.*|Soundtrack|Spider-Man:.*).*/i, '')
    .replace(/\s*\((Remaster(ed)?|Live|Deluxe|Mono|Stereo|Single|feat\..*|ft\..*)\)/i, '')
    .trim();

  // Headers required by LRCLIB API to prevent 503 / throttling
  const fetchHeaders = {
    'User-Agent': 'PulseMusicApp/1.0 (https://github.com/sampathvulli7/Pulse)',
    Accept: 'application/json',
  };

  // 1. Primary Query: Try LRCLIB /api/get with exact parameters
  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });
    if (duration) params.append('duration', duration.toString());

    let apiRes = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: fetchHeaders,
    });

    // If exact with duration failed, retry /api/get without duration and with clean title
    if (!apiRes.ok && (cleanTrack !== trackName || duration)) {
      const fallbackParams = new URLSearchParams({
        track_name: cleanTrack || trackName,
        artist_name: artistName,
      });
      apiRes = await fetch(`https://lrclib.net/api/get?${fallbackParams.toString()}`, {
        headers: fetchHeaders,
      });
    }

    if (apiRes.ok) {
      const result = (await apiRes.json()) as any;
      if (result && (result.syncedLyrics || result.plainLyrics)) {
        const syncedLyrics = result.syncedLyrics || '';
        const lyricsData = {
          syncedLyrics,
          plainLyrics: result.plainLyrics || '',
          instrumental: !!result.instrumental,
          parsedLines: parseLrc(syncedLyrics),
        };
        lyricsCache.set(cacheKey, lyricsData);
        return res.json(lyricsData);
      }
    }
  } catch (err) {
    // Continue to search attempt on network error
  }

  // 2. Secondary Query: Try LRCLIB /api/search for fuzzy catalog match
  try {
    const searchParams = new URLSearchParams({
      track_name: cleanTrack || trackName,
      artist_name: artistName,
    });
    const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`, {
      headers: fetchHeaders,
    });

    if (searchRes.ok) {
      const searchItems = (await searchRes.json()) as any[];
      if (Array.isArray(searchItems) && searchItems.length > 0) {
        // Find best match that actually has synchronized lyrics
        const bestSynced = searchItems.find((item) => item && item.syncedLyrics && item.syncedLyrics.trim().length > 0) || searchItems[0];
        if (bestSynced && (bestSynced.syncedLyrics || bestSynced.plainLyrics)) {
          const syncedLyrics = bestSynced.syncedLyrics || '';
          const lyricsData = {
            syncedLyrics,
            plainLyrics: bestSynced.plainLyrics || '',
            instrumental: !!bestSynced.instrumental,
            parsedLines: parseLrc(syncedLyrics),
          };
          lyricsCache.set(cacheKey, lyricsData);
          return res.json(lyricsData);
        }
      }
    }
  } catch (err) {
    // Continue to offline fallback
  }

  // 3. Offline / Hardcoded Accurate Fallback
  const lowerTrack = trackName.toLowerCase();
  for (const [key, lrc] of Object.entries(DEMO_LRC)) {
    if (lowerTrack.includes(key)) {
      const lyricsData = {
        syncedLyrics: lrc,
        plainLyrics: lrc.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]\s*/g, ''),
        instrumental: false,
        parsedLines: parseLrc(lrc),
      };
      lyricsCache.set(cacheKey, lyricsData);
      return res.json(lyricsData);
    }
  }

  // 4. Default Instrumental / Unmatched Graceful Response
  const fallbackLrc = `[00:00.00] ♪ ${trackName} — ${artistName} ♪\n[00:10.00] (Enjoy the uninterrupted music)\n[00:30.00] (Dynamic Web Audio EQ Active)`;
  const fallback = {
    syncedLyrics: fallbackLrc,
    plainLyrics: `♪ ${trackName} — ${artistName} ♪\nEnjoy the uninterrupted music\nDynamic Web Audio EQ Active`,
    instrumental: true,
    parsedLines: parseLrc(fallbackLrc),
  };
  lyricsCache.set(cacheKey, fallback);
  return res.json(fallback);
}
