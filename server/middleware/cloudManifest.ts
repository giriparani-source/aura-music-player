/**
 * server/middleware/cloudManifest.ts
 *
 * Exposes GET /api/library/cloud-songs
 * Serves the pre-computed cloud music catalog containing production-safe metadata
 * for all migrated tracks without exposing private bucket credentials.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedManifest: any[] | null = null;

function loadManifest(): any[] {
  if (cachedManifest) return cachedManifest;

  const manifestPath = path.resolve(__dirname, '..', 'data', 'cloud_manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      cachedManifest = JSON.parse(raw);
      return cachedManifest || [];
    } catch (err: any) {
      console.error('[cloudManifest] Failed to parse cloud_manifest.json:', err.message);
      return [];
    }
  }

  return [];
}

export function cloudManifestHandler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const tracks = loadManifest();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.statusCode = 200;
    res.end(JSON.stringify({ total: tracks.length, tracks }));
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || 'Failed to load cloud manifest', tracks: [] }));
  }
}
