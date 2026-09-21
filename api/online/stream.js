import https from 'https';
import http from 'http';

// In-memory cache for audio streams across warm serverless invocations
const streamCache = new Map();

// Known resilient Piped & Invidious public streaming instances
const AUDIO_RESOLVER_MIRRORS = [
  'https://api.piped.private.coffee/streams/',
  'https://pipedapi.kavin.rocks/streams/',
  'https://piped-api.lunar.icu/streams/',
  'https://api.piped.projectsegfau.lt/streams/'
];

async function fetchDirectAudioUrl(videoId) {
  // Check cache (valid for 3 hours)
  const cached = streamCache.get(videoId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  for (const mirror of AUDIO_RESOLVER_MIRRORS) {
    try {
      const endpoint = `${mirror}${encodeURIComponent(videoId)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const audioStreams = data.audioStreams || [];
        // Prefer m4a / AAC, otherwise highest quality opus/webm
        const m4a = audioStreams.find(s => s.format === 'M4A' || s.mimeType?.includes('audio/mp4'));
        const best = m4a || audioStreams[0];

        if (best && best.url) {
          streamCache.set(videoId, {
            url: best.url,
            expiresAt: Date.now() + 3 * 3600 * 1000
          });
          return best.url;
        }
      }
    } catch (mirrorErr) {
      console.warn(`[StreamAPI] Mirror ${mirror} failed:`, mirrorErr);
    }
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.setHeader('Accept-Ranges', 'bytes');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id, json } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' });
  }

  const videoId = String(id).trim();
  const directAudioUrl = await fetchDirectAudioUrl(videoId);

  if (!directAudioUrl) {
    return res.status(502).json({
      error: 'Audio stream extraction currently unavailable for this video',
      videoId
    });
  }

  // If client requested JSON format
  if (json === '1' || json === 'true') {
    return res.status(200).json({
      id: videoId,
      streamUrl: directAudioUrl
    });
  }

  // Stream proxy with Range support
  try {
    const targetUrl = new URL(directAudioUrl);
    const client = targetUrl.protocol === 'https:' ? https : http;

    const proxyHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };
    if (req.headers.range) {
      proxyHeaders['Range'] = req.headers.range;
    }

    const proxyReq = client.request(targetUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: proxyHeaders
    }, (proxyRes) => {
      res.statusCode = proxyRes.statusCode || 200;
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mp4');

      if (proxyRes.headers['content-range']) {
        res.setHeader('Content-Range', proxyRes.headers['content-range']);
      }
      if (proxyRes.headers['content-length']) {
        res.setHeader('Content-Length', proxyRes.headers['content-length']);
      }

      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(502).json({ error: 'Proxy streaming failed: ' + err.message });
      }
    });

    req.on('close', () => {
      proxyReq.destroy();
    });

    proxyReq.end();
  } catch (streamErr) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream setup error: ' + streamErr.message });
    }
  }
}
