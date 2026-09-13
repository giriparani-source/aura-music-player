/**
 * server/middleware/onlineStream.ts
 * Stream URL extraction via Python yt-dlp + HTTPS proxy with byte-range support.
 * Extracted from vite.config.ts lines 227-303.
 * Preserves exact proxy behavior, headers, caching, and error responses.
 */

import https from 'node:https';
import { streamUrlCache } from '../helpers/caches.ts';
import { runPythonCommand, isPythonAvailable } from '../helpers/pythonRunner.ts';

export async function onlineStreamHandler(req: any, res: any) {
  try {
    const url = new URL(req.url, 'http://localhost:3000');
    const id = url.searchParams.get('id');
    if (!id) {
      res.statusCode = 400;
      res.end('Missing id parameter');
      return;
    }

    if (!isPythonAvailable()) {
      res.statusCode = 503;
      res.end('Streaming requires Python + yt-dlp which is not available on this server');
      return;
    }

    // Check stream URL cache
    let streamUrlObj = streamUrlCache.get(id);
    if (!streamUrlObj || Date.now() > streamUrlObj.expiresAt) {
      const data = await runPythonCommand(['get_url', id]);
      if (data.error || !data.streamUrl) {
        res.statusCode = 502;
        res.end(data.error || 'Failed to extract stream URL');
        return;
      }
      streamUrlObj = {
        url: data.streamUrl,
        expiresAt: Date.now() + 4 * 3600 * 1000 // 4 hours validity
      };
      streamUrlCache.set(id, streamUrlObj);
    }

    const targetUrl = new URL(streamUrlObj.url);
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const proxyReq = https.request(
      targetUrl,
      {
        headers,
        method: 'GET'
      },
      (proxyRes) => {
        res.statusCode = proxyRes.statusCode || 200;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/webm');

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
