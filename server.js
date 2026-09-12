/**
 * Aura Music Player - Production Node.js Server
 * For Render.com / Railway / VPS deployments.
 * Serves static dist/ files and provides /api/online and /api/jam endpoints.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-Memory Caches
const searchCache = new Map();
const streamUrlCache = new Map();
const jamRooms = new Map();

function runPythonCommand(args) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'server', 'online_stream.py');
    const proc = spawn('python3', [pythonScript, ...args]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr || `Process exited with code ${code}`));
        return;
      }
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch (err) {
        reject(new Error(`Failed to parse JSON: ${stdout.slice(0, 100)}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// 1. Online Search Endpoint
app.get('/api/online/search', async (req, res) => {
  const q = req.query.q;
  if (!q || !q.trim()) {
    return res.json({ results: [] });
  }

  const cacheKey = q.trim().toLowerCase();
  if (searchCache.has(cacheKey)) {
    return res.json({ results: searchCache.get(cacheKey) });
  }

  try {
    const data = await runPythonCommand(['search', q.trim(), '12']);
    if (data.error) {
      return res.status(500).json({ error: data.error, results: [] });
    }

    const rawList = data.results || [];
    const formatted = rawList.map((item) => ({
      id: `online_${item.id}`,
      sourceId: item.id,
      title: item.title,
      artist: item.artist || 'Online Artist',
      album: 'Cloud Stream',
      path: `/api/online/stream?id=${item.id}`,
      filePath: `/api/online/stream?id=${item.id}`,
      fileName: `${item.title}.webm`,
      duration: item.duration || 180,
      coverArt: item.thumbnail,
      artwork: item.thumbnail,
      isOnline: true,
      format: 'STREAM',
      bitrate: 160,
      fileSize: 0,
      playCount: 0,
      dateAdded: Date.now(),
      isFavorite: false
    }));

    searchCache.set(cacheKey, formatted);
    res.json({ results: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Search failed', results: [] });
  }
});

// 2. Online Stream Proxy
app.get('/api/online/stream', async (req, res) => {
  const id = req.query.id;
  if (!id) {
    return res.status(400).send('Missing id parameter');
  }

  try {
    let streamUrlObj = streamUrlCache.get(id);
    if (!streamUrlObj || Date.now() > streamUrlObj.expiresAt) {
      const data = await runPythonCommand(['get_url', id]);
      if (data.error || !data.streamUrl) {
        return res.status(502).send(data.error || 'Failed to extract stream URL');
      }
      streamUrlObj = {
        url: data.streamUrl,
        expiresAt: Date.now() + 4 * 3600 * 1000
      };
      streamUrlCache.set(id, streamUrlObj);
    }

    const parsed = new URL(streamUrlObj.url);
    const proxyReq = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Range: req.headers.range || 'bytes=0-'
        }
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      res.status(502).end('Stream pipe error');
    });

    proxyReq.end();
  } catch (err) {
    res.status(500).end('Streaming exception');
  }
});

// Serve Static Frontend Bundle
app.use(express.static(path.join(__dirname, 'dist')));

// SPA Fallback for Deep Links
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aura Music Server running on http://0.0.0.0:${PORT}`);
});
