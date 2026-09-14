import fs from 'node:fs';
import path from 'node:path';

let cachedTracks = null;

function getManifestTracks() {
  if (cachedTracks && cachedTracks.length > 0) {
    return cachedTracks;
  }

  const searchPaths = [
    path.join(process.cwd(), 'api', 'data', 'cloud_manifest.json'),
    path.join(process.cwd(), 'server', 'data', 'cloud_manifest.json'),
    path.resolve('api/data/cloud_manifest.json'),
    path.resolve('server/data/cloud_manifest.json')
  ];

  for (const p of searchPaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cachedTracks = parsed;
          return cachedTracks;
        }
      }
    } catch {
      // Continue trying other paths
    }
  }

  return [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const tracks = getManifestTracks();
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    return res.status(200).json({ total: tracks.length, tracks });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load cloud manifest', tracks: [] });
  }
}
