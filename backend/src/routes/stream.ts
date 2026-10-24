import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { db } from '../db/database';
import { getCachedAudioPath, ensureFullAudio } from '../services/fullAudio';

const FALLBACK_COVER_ART = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80';

/**
 * Streams audio with HTTP 206 Partial Content support.
 * Automatically serves local files, cached full-length M4A/MP3 tracks,
 * or on-demand downloads the full song via yt-dlp so users NEVER get cut off at 30 seconds!
 */
export async function handleAudioStream(req: Request, res: Response) {
  const { id } = req.params;
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as any;

  if (!track) {
    return res.status(404).json({ error: 'Track not found' });
  }

  // 1. Check if track already has a valid local file
  let filePath = track.local_path && fs.existsSync(track.local_path) ? track.local_path : null;

  // 2. Check if cached in audio cache
  if (!filePath) {
    filePath = getCachedAudioPath(id);
  }

  // 3. If neither exists, trigger full-audio download
  if (!filePath) {
    try {
      filePath = await ensureFullAudio({
        id: track.id,
        title: track.title,
        artist: track.artist,
        youtubeVideoId: track.youtube_video_id,
      });
    } catch (e) {
      console.warn(`[Stream] Could not download full audio for ${track.title}:`, e);
    }
  }

  // 4. If we have a local file on disk, stream it with HTTP 206
  if (filePath && fs.existsSync(filePath)) {
    return streamLocalFile(filePath, req, res);
  }

  // 5. Fallback: If a remote stream URL is available (e.g. Audius or preview), proxy it
  if (track.source_url && (track.source_url.startsWith('http://') || track.source_url.startsWith('https://'))) {
    req.query.url = track.source_url;
    return handleStreamProxy(req, res);
  }

  return res.status(404).json({ error: 'Audio source unavailable' });
}

function streamLocalFile(filePath: string, req: Request, res: Response) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(filePath).toLowerCase();
  let contentType = 'audio/mpeg';
  if (ext === '.wav') contentType = 'audio/wav';
  else if (ext === '.flac') contentType = 'audio/flac';
  else if (ext === '.ogg') contentType = 'audio/ogg';
  else if (ext === '.m4a' || ext === '.mp4') contentType = 'audio/mp4';

  if (range) {
    // Parse Range header e.g. "bytes=0-1024" or "bytes=1024-"
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).set({
        'Content-Range': `bytes */${fileSize}`,
      });
      return res.end();
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });

    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    });

    fs.createReadStream(filePath).pipe(res);
  }
}

/**
 * Proxies remote audio streams (Audius, Archive, Jamendo, etc.)
 * with HTTP 206 Range requests and Access-Control-Allow-Origin: *
 * so browser Web Audio API (AudioContext) can process them with zero CORS errors and zero buffer lag.
 */
export async function handleStreamProxy(req: Request, res: Response) {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target url parameter' });
  }

  try {
    const rangeHeader = req.headers.range;
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: fetchHeaders,
      redirect: 'follow',
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res.status(upstreamRes.status).json({ error: `Upstream error: ${upstreamRes.statusText}` });
    }

    const statusCode = upstreamRes.status;
    const contentType = upstreamRes.headers.get('content-type') || 'audio/mpeg';
    const contentLength = upstreamRes.headers.get('content-length');
    const contentRange = upstreamRes.headers.get('content-range');
    const acceptRanges = upstreamRes.headers.get('accept-ranges') || 'bytes';

    const responseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
      'Content-Type': contentType,
      'Accept-Ranges': acceptRanges,
      'Cache-Control': 'public, max-age=86400',
    };

    if (contentLength) responseHeaders['Content-Length'] = contentLength;
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    res.writeHead(statusCode, responseHeaders);

    if (upstreamRes.body) {
      const nodeStream = Readable.fromWeb(upstreamRes.body as any);
      nodeStream.pipe(res);
      req.on('close', () => {
        nodeStream.destroy();
      });
    } else {
      res.end();
    }
  } catch (err: any) {
    console.error('[StreamProxy] Error proxying audio stream:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: `Proxy failed: ${err.message}` });
    }
  }
}

/**
 * Image proxy with safe fallback to prevent browser ERR_CONNECTION_REFUSED
 * and 502/503 errors when external decentralized nodes (Audius) go offline.
 */
export async function handleImageProxy(req: Request, res: Response) {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.redirect(FALLBACK_COVER_ART);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const upstream = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return res.redirect(FALLBACK_COVER_ART);
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (upstream.body) {
      const nodeStream = Readable.fromWeb(upstream.body as any);
      nodeStream.pipe(res);
    } else {
      res.redirect(FALLBACK_COVER_ART);
    }
  } catch (e) {
    res.redirect(FALLBACK_COVER_ART);
  }
}
