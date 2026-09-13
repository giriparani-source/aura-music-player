/**
 * server/middleware/localAudio.ts
 * Local library audio file server with byte-range support and MIME detection.
 * Extracted from vite.config.ts lines 576-654.
 * Preserves exact byte-range headers, CORS, MIME types, and fallback search behavior.
 *
 * Reads MUSIC_DIR from process.env (server-only, not VITE_ prefixed).
 * Falls back to './songs' if not set.
 */

import fs from 'node:fs';
import path from 'node:path';

function getSongsBaseDir(): string {
  return process.env.MUSIC_DIR || './songs';
}

export function localAudioHandler(req: any, res: any) {
  try {
    const url = new URL(req.url, 'http://localhost:3000');
    const relPath = url.searchParams.get('path');
    if (!relPath) {
      res.statusCode = 400;
      res.end('Missing path parameter');
      return;
    }

    const songsBaseDir = getSongsBaseDir();

    // Clean normalized path
    const decodedRelPath = decodeURIComponent(relPath).replace(/^[\\/]+/, '');
    let fullPath = path.join(songsBaseDir, decodedRelPath);

    // If file not found directly, search case-insensitively or by filename
    if (!fs.existsSync(fullPath)) {
      const fileName = path.basename(decodedRelPath);
      if (fs.existsSync(songsBaseDir)) {
        const subdirs = fs.readdirSync(songsBaseDir);
        for (const dir of subdirs) {
          const candidate = path.join(songsBaseDir, dir, fileName);
          if (fs.existsSync(candidate)) {
            fullPath = candidate;
            break;
          }
        }
      }
    }

    if (!fs.existsSync(fullPath)) {
      res.statusCode = 404;
      res.end('Audio file not found');
      return;
    }

    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // MIME type
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.opus': 'audio/opus',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac'
    };
    const contentType = mimeTypes[ext] || 'audio/mpeg';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);

      const stream = fs.createReadStream(fullPath, { start, end });
      stream.pipe(res);
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Length', fileSize);
      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    }
  } catch (err: any) {
    res.statusCode = 500;
    res.end(err.message || 'Internal error');
  }
}
