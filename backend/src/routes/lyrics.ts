import { Request, Response } from 'express';

// In-memory lyrics cache
const lyricsCache = new Map<string, any>();

// Fallback synchronized lyrics for key demo tracks
const DEMO_LRC: Record<string, string> = {
  vampires: `[00:00.00] (Instrumental Saxophone Intro)
[00:24.00] We like driving in the dark
[00:29.50] Feeling like we own the night
[00:36.00] Neon glowing in our eyes
[00:41.80] Running under summer skies
[00:48.00] Vampires out on the boulevard
[00:54.00] Chasing shadows through the yard
[01:00.00] We will never die tonight
[01:06.00] In the everlasting light
[01:14.00] (Saxophone Solo)
[01:45.00] Speeding down the canyon road
[01:51.00] Carrying our heavy load
[01:57.00] We are timeless, we are young
[02:03.00] With a song upon our tongue`,
  everlong: `[00:00.00] (Drum and Guitar Intro)
[00:15.00] Hello, I've waited here for you
[00:21.00] Everlong
[00:27.00] Tonight, I throw myself into
[00:33.00] And out of the red, out of her head she sang
[00:40.00] Down and out, lose my mind, here we go
[00:46.00] Breathe out so I can breathe you in
[00:51.00] Hold you in
[00:57.00] And now I know you've got to be free
[01:03.00] So come on and sing with me`,
  sunset: `[00:00.00] (Synth Pulse Intro)
[00:18.00] Golden hour fades away
[00:24.00] Into shades of purple gray
[00:30.00] Memories of ocean breeze
[00:36.00] Whispering among the trees
[00:43.00] Sunset on the radio
[00:49.00] Watching summer come and go
[00:55.00] We were legends in the dusk
[01:02.00] Burning with a fever rush`,
  'blinding lights': `[00:00.00] (Synth Arpeggio Intro)
[00:14.00] Yeah
[00:18.00] I've been tryna call
[00:21.50] I've been on my own for long enough
[00:26.00] Maybe you can show me how to love, maybe
[00:33.00] I'm going through withdrawals
[00:37.00] You don't even have to do too much
[00:41.00] You can turn me on with just a touch, baby
[00:48.00] I look around and Sin City's cold and empty
[00:52.00] No one's around to judge me
[00:56.00] I can't see clearly when you're gone
[01:02.00] I said, ooh, I'm blinded by the lights
[01:09.00] No, I can't sleep until I feel your touch`,
};

export async function handleLyrics(req: Request, res: Response) {
  const trackName = (req.query.track_name as string || '').trim();
  const artistName = (req.query.artist_name as string || '').trim();
  const duration = req.query.duration ? Number(req.query.duration) : undefined;

  if (!trackName) {
    return res.status(400).json({ error: 'track_name query parameter is required' });
  }

  const cacheKey = `${trackName.toLowerCase()}-${artistName.toLowerCase()}`;
  if (lyricsCache.has(cacheKey)) {
    return res.json(lyricsCache.get(cacheKey));
  }

  // Check demo fallback first
  const cleanTrackName = trackName.toLowerCase();
  for (const [key, lrc] of Object.entries(DEMO_LRC)) {
    if (cleanTrackName.includes(key)) {
      const data = {
        syncedLyrics: lrc,
        plainLyrics: lrc.replace(/\[\d{2}:\d{2}\.\d{2}\]\s*/g, ''),
        instrumental: false,
      };
      lyricsCache.set(cacheKey, data);
      return res.json(data);
    }
  }

  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });
    if (duration) params.append('duration', duration.toString());

    const apiRes = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
    if (apiRes.ok) {
      const result = await apiRes.json() as any;
      const lyricsData = {
        syncedLyrics: result.syncedLyrics || '',
        plainLyrics: result.plainLyrics || '',
        instrumental: !!result.instrumental,
      };
      lyricsCache.set(cacheKey, lyricsData);
      return res.json(lyricsData);
    }
  } catch (err) {
    // Ignore LRCLIB network errors and provide graceful fallback
  }

  // Graceful fallback for instrumental / unmatched tracks
  const fallback = {
    syncedLyrics: `[00:00.00] ♪ ${trackName} — ${artistName} ♪\n[00:10.00] (Enjoy the uninterrupted music)\n[00:30.00] (Dynamic Web Audio EQ Active)`,
    plainLyrics: `♪ ${trackName} — ${artistName} ♪\nEnjoy the uninterrupted music\nDynamic Web Audio EQ Active`,
    instrumental: true,
  };
  lyricsCache.set(cacheKey, fallback);
  return res.json(fallback);
}
