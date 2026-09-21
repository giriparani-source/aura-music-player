/**
 * server/middleware/onlineStream.ts
 * Stream URL extraction via Python yt-dlp with pure Node.js multi-mirror fallback
 * and HTTPS/HTTP proxy with byte-range support.
 *
 * Tier 1: Local Python yt-dlp CLI (fast, native extraction if Python is installed)
 * Tier 2: Pure Node.js Multi-Mirror Resolver (Piped / Invidious stream APIs)
 *
 * Decouples YouTube audio streaming from Python so the app streams seamlessly
 * on systems with or without Python installed.
 */

import https from 'node:https';
import http from 'node:http';
import { streamUrlCache } from '../helpers/caches.ts';
import { runPythonCommand, isPythonAvailable } from '../helpers/pythonRunner.ts';

// Resilient Piped & Invidious public streaming instances for Node.js fallback
const STREAM_RESOLVER_MIRRORS = [
  'https://api.piped.private.coffee/streams/',
  'https://pipedapi.kavin.rocks/streams/',
  'https://piped-api.lunar.icu/streams/',
  'https://api.piped.projectsegfau.lt/streams/',
  'https://inv.nadeko.net/api/v1/videos/',
  'https://invidious.nerdvpn.de/api/v1/videos/'
];

/**
 * Pure Node.js fallback to extract direct audio stream URL without Python.
 */
async function fetchDirectAudioUrl(videoId: string): Promise<string | null> {
  for (const mirror of STREAM_RESOLVER_MIRRORS) {
    try {
      const endpoint = `${mirror}${encodeURIComponent(videoId)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data: any = await res.json();
        // Check Piped audioStreams structure
        if (Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
          const m4a = data.audioStreams.find(
            (s: any) => s.format === 'M4A' || s.mimeType?.includes('audio/mp4')
          );
          const best = m4a || data.audioStreams[0];
          if (best?.url) {
            return best.url;
          }
        }
        // Check Invidious formatStreams / adaptiveFormats structure
        if (Array.isArray(data.adaptiveFormats)) {
          const audioFormats = data.adaptiveFormats.filter((f: any) =>
            f.type?.includes('audio/')
          );
          if (audioFormats.length > 0) {
            const m4a = audioFormats.find((f: any) => f.type?.includes('audio/mp4'));
            const chosen = m4a || audioFormats[0];
            if (chosen?.url) {
              return chosen.url;
            }
          }
        }
      }
    } catch (mirrorErr) {
      console.warn(`[OnlineStream] Mirror ${mirror} fallback notice:`, mirrorErr);
    }
  }

  return null;
}

export async function onlineStreamHandler(req: any, res: any) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://localhost:3000');
    const id = url.searchParams.get('id');
    const returnJson = url.searchParams.get('json') === '1' || url.searchParams.get('json') === 'true';

    if (!id) {
      res.statusCode = 400;
      res.end('Missing id parameter');
      return;
    }

    const cleanId = id.trim();

    // 1. Check in-memory stream URL cache
    let streamUrlObj = streamUrlCache.get(cleanId);
    let resolvedUrl = streamUrlObj && Date.now() < streamUrlObj.expiresAt ? streamUrlObj.url : null;

    // 2. Tier 1: If Python is available, try yt-dlp first
    if (!resolvedUrl && isPythonAvailable()) {
      try {
        const data = await runPythonCommand(['get_url', cleanId]);
        if (data && data.streamUrl && !data.error) {
          resolvedUrl = data.streamUrl;
        }
      } catch (pyErr) {
        console.warn('[OnlineStream] Python yt-dlp notice, falling back to Node resolver:', pyErr);
      }
    }

    // 3. Tier 2: Pure Node.js fallback (immune to Python requirement)
    if (!resolvedUrl) {
      resolvedUrl = await fetchDirectAudioUrl(cleanId);
    }

    if (!resolvedUrl) {
      res.statusCode = 502;
      res.end('Failed to extract audio stream URL via Python and Node fallbacks');
      return;
    }

    // Cache the resolved URL (valid for 4 hours)
    streamUrlCache.set(cleanId, {
      url: resolvedUrl,
      expiresAt: Date.now() + 4 * 3600 * 1000
    });

    // If client requested JSON metadata instead of proxy piping
    if (returnJson) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({ id: cleanId, streamUrl: resolvedUrl }));
      return;
    }

    // 4. Stream Proxy with HTTP Range request support
    const targetUrl = new URL(resolvedUrl);
    const client = targetUrl.protocol === 'http:' ? http : https;
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const proxyReq = client.request(
      targetUrl,
      {
        headers,
        method: req.method === 'HEAD' ? 'HEAD' : 'GET'
      },
      (proxyRes) => {
        res.statusCode = proxyRes.statusCode || 200;
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mp4');

        if (proxyRes.headers['content-range']) {
          res.setHeader('Content-Range', proxyRes.headers['content-range']);
        }
        if (proxyRes.headers['content-length']) {
          res.setHeader('Content-Length', proxyRes.headers['content-length']);
        }

        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end('Proxy streaming error: ' + err.message);
      }
    });

    req.on('close', () => {
      proxyReq.destroy();
    });

    proxyReq.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(err.message || 'Stream error');
    }
  }
}
