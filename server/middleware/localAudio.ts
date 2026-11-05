/**
 * server/middleware/localAudio.ts
 *
 * Cloud library audio streaming server middleware with byte-range support.
 * Pure Cloud Architecture: Serves audio strictly from cloud storage (Cloudflare R2 / AWS S3).
 * Local ./songs disk fallback has been completely purged.
 */

import { isCloudStorageConfigured, getStorageProvider, streamCloudAudio } from '../helpers/cloudStorage.ts';

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

    // Cloud Storage Streaming (R2 / S3)
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
        console.warn(`[cloudAudio] Cloud streaming error for ${decodedRelPath}:`, cloudErr.message);
      }
    }

    // Pure cloud architecture: No local filesystem fallback
    res.statusCode = 404;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Audio stream unavailable without cloud storage credentials.',
      path: decodedRelPath
    }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(err.message || 'Internal error');
  }
}
