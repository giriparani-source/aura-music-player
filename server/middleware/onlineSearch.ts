/**
 * server/middleware/onlineSearch.ts
 * YouTube HTML scraping (primary) + Python yt-dlp (fallback) search endpoint.
 * Extracted from vite.config.ts lines 102-224.
 * Preserves exact request/response format, caching, and CORS behavior.
 */

import https from 'node:https';
import { searchCache, setBoundedSearchCache } from '../helpers/caches.ts';
import { runPythonCommand, isPythonAvailable } from '../helpers/pythonRunner.ts';

export function onlineSearchHandler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  (async () => {
    try {
      const url = new URL(req.url, 'http://localhost:3000');
      const q = url.searchParams.get('q');
      if (!q || !q.trim()) {
        res.end(JSON.stringify({ results: [] }));
        return;
      }

      const cacheKey = q.trim().toLowerCase();
      if (searchCache.has(cacheKey)) {
        const cached = searchCache.get(cacheKey);
        searchCache.delete(cacheKey);
        searchCache.set(cacheKey, cached);
        res.end(JSON.stringify({ results: cached }));
        return;
      }

      // Try fast YouTube direct scraping first
      let formatted: any[] = [];
      try {
        const cleanQ = q.trim();
        const searchQuery = cleanQ;

        const ytUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(searchQuery);
        const directResults: any[] = await new Promise((resolve) => {
          const client = https.get(ytUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          }, (yRes) => {
            let body = '';
            yRes.on('data', (c: any) => { body += c; });
            yRes.on('end', () => {
              try {
                const match = body.match(/var ytInitialData = ({.*?});<\/script>/s) || body.match(/ytInitialData\s*=\s*({.+?});/s);
                if (!match) return resolve([]);
                const json = JSON.parse(match[1]);
                const contents = json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
                const list: any[] = [];
                for (const item of contents) {
                  const v = item.videoRenderer;
                  if (v && v.videoId) {
                    const durationText = v.lengthText?.simpleText || '3:30';
                    const parts = durationText.split(':').map(Number);
                    let durationSec = 210;
                    if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
                    list.push({
                      id: `online_${v.videoId}`,
                      sourceId: v.videoId,
                      title: v.title?.runs?.[0]?.text || 'Kollywood Hit',
                      artist: v.ownerText?.runs?.[0]?.text || 'Tamil Artist',
                      album: 'YouTube Music',
                      path: `https://www.youtube.com/watch?v=${v.videoId}`,
                      filePath: `https://www.youtube.com/watch?v=${v.videoId}`,
                      fileName: `${(v.title?.runs?.[0]?.text || 'song').replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
                      duration: durationSec,
                      coverArt: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                      artwork: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                      isOnline: true,
                      format: 'STREAM',
                      bitrate: 160,
                      fileSize: durationSec * 20000,
                      playCount: 0,
                      dateAdded: Date.now(),
                      isFavorite: false
                    });
                  }
                }
                resolve(list.slice(0, 15));
              } catch {
                resolve([]);
              }
            });
          });
          client.on('error', () => resolve([]));
          client.setTimeout(6000, () => {
            client.destroy();
            resolve([]);
          });
        });

        if (directResults.length > 0) {
          formatted = directResults;
        }
      } catch {
        // direct failed, fallback to python
      }

      if (formatted.length === 0 && isPythonAvailable()) {
        const data = await runPythonCommand(['search', q.trim(), '12']).catch(() => ({ results: [] }));
        const rawList = data.results || [];
        formatted = rawList.map((item: any) => ({
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
      }

      setBoundedSearchCache(cacheKey, formatted);
      res.end(JSON.stringify({ results: formatted }));
    } catch (err: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || 'Search failed', results: [] }));
    }
  })();
}
