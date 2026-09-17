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

import { isCloudStorageConfigured, getStorageProvider, streamCloudAudio } from '../helpers/cloudStorage.ts';

function getSongsBaseDir(): string {
  return process.env.MUSIC_DIR || './songs';
}

export async function localAudioHandler(req: any, res: any) {
  try {
    const url = new URL(req.url, 'http://localhost:3000');
    const relPath = url.searchParams.get('path');
    if (!relPath) {
      res.statusCode = 400;
      res.end('Missing path parameter');
      return;
    }

    const decodedRelPath = decodeURIComponent(relPath).replace(/^[\\/]+/, '').replace(/\\/g, '/');

    // 1. Cloud Storage Streaming (R2 / S3) if enabled
    if (isCloudStorageConfigured() && getStorageProvider() !== 'local') {
      try {
        const cloudResult = await streamCloudAudio(decodedRelPath, req.headers.range);
        if (cloudResult) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', '*');
          for (const [key, value] of Object.entries(cloudResult.headers)) {
            res.setHeader(key, value);
          }
          res.statusCode = cloudResult.statusCode;
          cloudResult.stream.pipe(res);
          return;
        }
      } catch (cloudErr: any) {
        console.warn(`[localAudio] Cloud streaming error for ${decodedRelPath}, falling back to local if available:`, cloudErr.message);
      }
    }

    // 2. Local Filesystem Streaming Fallback
    const songsBaseDir = getSongsBaseDir();
    const resolvedBase = path.resolve(songsBaseDir);

    let fullPath = path.join(songsBaseDir, decodedRelPath);

    // Security: reject directory traversal attempts
    if (!path.resolve(fullPath).startsWith(resolvedBase)) {
      res.statusCode = 403;
      res.end('Access denied: path traversal forbidden');
      return;
    }

    // If file not found directly, search case-insensitively or by filename
    if (!fs.existsSync(fullPath)) {
      const fileName = path.basename(decodedRelPath);
      if (fs.existsSync(songsBaseDir)) {
        const subdirs = fs.readdirSync(songsBaseDir);
        for (const dir of subdirs) {
          const candidate = path.join(songsBaseDir, dir, fileName);
          if (fs.existsSync(candidate) && path.resolve(candidate).startsWith(resolvedBase)) {
            fullPath = candidate;
            break;
          }
        }
      }
    }

    if (!fs.existsSync(fullPath) || !path.resolve(fullPath).startsWith(resolvedBase)) {
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
