/**
 * server/middleware/radioStream.ts
 *
 * High-performance, low-latency live radio stream proxy.
 * Proxies Shoutcast, Icecast, AAC, and MP3 internet radio streams.
 * Adds Access-Control-Allow-Origin: * and handles HTTP/HTTPS mixed content seamlessly.
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

export async function radioStreamHandler(req: any, res: any) {
  try {
    const parsedUrl = new URL(req.url, 'http://localhost:3000');
    const targetStreamUrl = parsedUrl.searchParams.get('url');

    if (!targetStreamUrl) {
      res.statusCode = 400;
      res.end('Missing url parameter');
      return;
    }

    let target: URL;
    try {
      target = new URL(targetStreamUrl);
    } catch {
      res.statusCode = 400;
      res.end('Invalid url parameter');
      return;
    }

    const isHttps = target.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Icy-MetaData': '0'
      },
      timeout: 10000
    };

    const proxyReq = client.request(options, (proxyRes) => {
      // Handle redirects (e.g. 301, 302, 307)
      if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        let redirectLocation = proxyRes.headers.location;
        if (!redirectLocation.startsWith('http')) {
          redirectLocation = new URL(redirectLocation, targetStreamUrl).toString();
        }
        res.writeHead(302, { Location: `/api/radio/stream?url=${encodeURIComponent(redirectLocation)}` });
        res.end();
        return;
      }

      res.statusCode = proxyRes.statusCode || 200;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('Connection', 'keep-alive');

      proxyRes.pipe(res);

      req.on('close', () => {
        proxyRes.destroy();
        proxyReq.destroy();
      });
    });

    proxyReq.on('error', (err) => {
      console.warn('[radioStream] Proxy connection error:', err.message);
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end('Radio stream unavailable: ' + err.message);
      }
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.statusCode = 504;
        res.end('Radio stream gateway timeout');
      }
    });

    req.on('close', () => {
      proxyReq.destroy();
    });

    proxyReq.end();
  } catch (err: any) {
    console.error('[radioStream] Handler exception:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal radio streaming error: ' + err.message);
    }
  }
}
