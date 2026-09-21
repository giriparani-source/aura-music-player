/**
 * server/middleware/onlineSearch.ts
 * Resilient 4-tier Online Search Engine:
 * Tier 1: YouTube InnerTube API (Direct JSON, zero HTML scraping, immune to YouTube layout changes)
 * Tier 2: Enhanced Multi-Regex HTML Parser (with accurate duration parsing)
 * Tier 3: JioSaavn Search API (320kbps Studio Master fallback)
 * Tier 4: Python yt-dlp (local CLI fallback)
 */

import https from 'node:https';
import { searchCache, setBoundedSearchCache } from '../helpers/caches.ts';
import { runPythonCommand, isPythonAvailable } from '../helpers/pythonRunner.ts';

/**
 * Parses duration text ("3:45", "1:15:30") or seconds string into total integer seconds.
 */
function parseDurationSeconds(durationText?: string, lengthSeconds?: string): number {
  if (lengthSeconds && !isNaN(Number(lengthSeconds))) {
    return Number(lengthSeconds);
  }
  if (!durationText) return 210;
  const parts = durationText.trim().split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 210;
}

/**
 * Tier 1: YouTube InnerTube JSON API
 * Directly queries the official Web Client v1 API without HTML scraping.
 */
async function searchInnerTube(query: string): Promise<any[]> {
  const payload = JSON.stringify({
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240101.00.00',
        hl: 'en',
        gl: 'IN'
      }
    },
    query
  });

  return new Promise((resolve) => {
    const req = https.request(
      'https://www.youtube.com/youtubei/v1/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': '2.20240101.00.00'
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const sectionContents =
              data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
                ?.contents || [];

            const list: any[] = [];
            for (const section of sectionContents) {
              const items = section?.itemSectionRenderer?.contents || [];
              for (const item of items) {
                const v = item.videoRenderer;
                if (v && v.videoId) {
                  const durationSec = parseDurationSeconds(
                    v.lengthText?.simpleText,
                    v.lengthSeconds
                  );
                  list.push({
                    id: `online_${v.videoId}`,
                    sourceId: v.videoId,
                    title: v.title?.runs?.[0]?.text || 'Kollywood Hit',
                    artist: v.ownerText?.runs?.[0]?.text || 'Tamil Artist',
                    album: 'YouTube Music Stream',
                    path: `https://www.youtube.com/watch?v=${v.videoId}`,
                    filePath: `https://www.youtube.com/watch?v=${v.videoId}`,
                    fileName: `${(v.title?.runs?.[0]?.text || 'song').replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
                    duration: durationSec,
                    coverArt:
                      v.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
                      `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                    artwork:
                      v.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
                      `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
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
            }
            resolve(list.slice(0, 15));
          } catch {
            resolve([]);
          }
        });
      }
    );

    req.on('error', () => resolve([]));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve([]);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Tier 2: Enhanced Multi-Regex HTML Parser
 */
async function searchYouTubeHtml(searchQuery: string): Promise<any[]> {
  const ytUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(searchQuery);

  return new Promise((resolve) => {
    const client = https.get(
      ytUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      },
      (yRes) => {
        let body = '';
        yRes.on('data', (c: any) => {
          body += c;
        });
        yRes.on('end', () => {
          try {
            const match =
              body.match(/var ytInitialData = ({.*?});<\/script>/s) ||
              body.match(/ytInitialData\s*=\s*({.+?});/s) ||
              body.match(/window\["ytInitialData"\]\s*=\s*({.+?});/s);

            if (!match) return resolve([]);
            const json = JSON.parse(match[1]);
            const contents =
              json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
                ?.contents?.[0]?.itemSectionRenderer?.contents || [];

            const list: any[] = [];
            for (const item of contents) {
              const v = item.videoRenderer;
              if (v && v.videoId) {
                const durationSec = parseDurationSeconds(v.lengthText?.simpleText, v.lengthSeconds);
                list.push({
                  id: `online_${v.videoId}`,
                  sourceId: v.videoId,
                  title: v.title?.runs?.[0]?.text || 'Kollywood Hit',
                  artist: v.ownerText?.runs?.[0]?.text || 'Tamil Artist',
                  album: 'YouTube Music Stream',
                  path: `https://www.youtube.com/watch?v=${v.videoId}`,
                  filePath: `https://www.youtube.com/watch?v=${v.videoId}`,
                  fileName: `${(v.title?.runs?.[0]?.text || 'song').replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
                  duration: durationSec,
                  coverArt:
                    v.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
                    `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                  artwork:
                    v.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
                    `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
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
      }
    );

    client.on('error', () => resolve([]));
    client.setTimeout(6000, () => {
      client.destroy();
      resolve([]);
    });
  });
}

/**
 * Tier 3: JioSaavn Search API Fallback
 */
async function searchJioSaavnFallback(query: string): Promise<any[]> {
  const saavnUrl = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_marker=0&query=${encodeURIComponent(
    query
  )}&ctx=web6dot0`;

  return new Promise((resolve) => {
    https
      .get(
        saavnUrl,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        },
        (res) => {
          let body = '';
          res.on('data', (c) => {
            body += c;
          });
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              const songs = json?.songs?.data || [];
              const list = songs.map((s: any) => ({
                id: `saavn_${s.id}`,
                sourceId: s.id,
                title: s.title?.replace(/&quot;/g, '"')?.replace(/&#039;/g, "'") || 'Song',
                artist: s.music || s.more_info?.primary_artists || 'JioSaavn Artist',
                album: s.album || 'Studio Master 320k',
                path: s.url || '',
                filePath: s.url || '',
                fileName: `${s.title}.m4a`,
                duration: Number(s.more_info?.duration) || 210,
                coverArt: s.image?.replace('150x150', '500x500') || s.image,
                artwork: s.image?.replace('150x150', '500x500') || s.image,
                isOnline: true,
                isSaavn: true,
                format: '320k AAC',
                bitrate: 320,
                fileSize: 0,
                playCount: 0,
                dateAdded: Date.now(),
                isFavorite: false
              }));
              resolve(list.slice(0, 15));
            } catch {
              resolve([]);
            }
          });
        }
      )
      .on('error', () => resolve([]));
  });
}

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

      const cleanQ = q.trim();
      const cacheKey = cleanQ.toLowerCase();
      if (searchCache.has(cacheKey)) {
        const cached = searchCache.get(cacheKey);
        searchCache.delete(cacheKey);
        searchCache.set(cacheKey, cached);
        res.end(JSON.stringify({ results: cached }));
        return;
      }

      let formatted: any[] = [];

      // Tier 1: YouTube InnerTube JSON API (robust, direct JSON, immune to HTML layout changes)
      try {
        const innerTubeResults = await searchInnerTube(cleanQ);
        if (innerTubeResults && innerTubeResults.length > 0) {
          formatted = innerTubeResults;
        }
      } catch (innerErr) {
        console.warn('[OnlineSearch] InnerTube search notice:', innerErr);
      }

      // Tier 2: Enhanced Multi-Regex HTML Scraping
      if (formatted.length === 0) {
        try {
          const htmlResults = await searchYouTubeHtml(cleanQ);
          if (htmlResults && htmlResults.length > 0) {
            formatted = htmlResults;
          }
        } catch (htmlErr) {
          console.warn('[OnlineSearch] HTML scraping notice:', htmlErr);
        }
      }

      // Tier 3: JioSaavn Search API Fallback
      if (formatted.length === 0) {
        try {
          const saavnResults = await searchJioSaavnFallback(cleanQ);
          if (saavnResults && saavnResults.length > 0) {
            formatted = saavnResults;
          }
        } catch (saavnErr) {
          console.warn('[OnlineSearch] JioSaavn fallback notice:', saavnErr);
        }
      }

      // Tier 4: Python yt-dlp fallback (local CLI)
      if (formatted.length === 0 && isPythonAvailable()) {
        try {
          const data = await runPythonCommand(['search', cleanQ, '12']).catch(() => ({ results: [] }));
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
        } catch {}
      }

      setBoundedSearchCache(cacheKey, formatted);
      res.end(JSON.stringify({ results: formatted }));
    } catch (err: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || 'Search failed', results: [] }));
    }
  })();
}
