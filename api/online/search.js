import https from 'https';

// In-memory cache across warm serverless invocations
const searchCache = new Map();

/**
 * Parses duration text ("3:45", "1:15:30") or seconds string into total integer seconds.
 */
function parseDurationSeconds(durationText, lengthSeconds) {
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
function searchInnerTube(query) {
  const cleanQ = query.trim();
  const lower = cleanQ.toLowerCase();
  const searchQuery = (lower.includes('tamil') || lower.includes('hindi') || lower.includes('telugu') || lower.includes('english') || lower.includes('song'))
    ? cleanQ
    : `${cleanQ} Tamil song`;

  const payload = JSON.stringify({
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240101.00.00',
        hl: 'en',
        gl: 'IN'
      }
    },
    query: searchQuery
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

            const list = [];
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
function searchYouTubeHtml(query) {
  return new Promise((resolve) => {
    const cleanQ = query.trim();
    const lower = cleanQ.toLowerCase();
    const searchQuery = (lower.includes('tamil') || lower.includes('hindi') || lower.includes('telugu') || lower.includes('english') || lower.includes('song'))
      ? cleanQ
      : `${cleanQ} Tamil song`;

    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(searchQuery);

    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const match =
            data.match(/var ytInitialData = ({.*?});<\/script>/s) ||
            data.match(/ytInitialData\s*=\s*({.+?});/s) ||
            data.match(/window\["ytInitialData"\]\s*=\s*({.+?});/s);

          if (!match) {
            return resolve([]);
          }

          const json = JSON.parse(match[1]);
          const contents = json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
          const results = [];

          for (const item of contents) {
            const v = item.videoRenderer;
            if (v && v.videoId) {
              const durationSec = parseDurationSeconds(v.lengthText?.simpleText, v.lengthSeconds);
              const title = v.title?.runs?.[0]?.text || 'Kollywood Hit';
              const artist = v.ownerText?.runs?.[0]?.text || 'Tamil Artist';
              const thumbnail = v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

              results.push({
                id: `online_${v.videoId}`,
                sourceId: v.videoId,
                title,
                artist,
                album: 'YouTube Music Stream',
                path: `https://www.youtube.com/watch?v=${v.videoId}`,
                filePath: `https://www.youtube.com/watch?v=${v.videoId}`,
                fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
                duration: durationSec,
                coverArt: thumbnail,
                artwork: thumbnail,
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

          resolve(results.slice(0, 15));
        } catch {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.setTimeout(6000, () => {
      req.destroy();
      resolve([]);
    });
  });
}

/**
 * Tier 3: JioSaavn Search API Fallback
 */
function searchJioSaavnFallback(query) {
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
              const list = songs.map((s) => ({
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const q = req.query.q || '';
  if (!q || !q.trim()) {
    return res.status(200).json({ results: [] });
  }

  const cleanQ = q.trim();
  const cacheKey = cleanQ.toLowerCase();
  if (searchCache.has(cacheKey)) {
    return res.status(200).json({ results: searchCache.get(cacheKey) });
  }

  try {
    let results = [];

    // Tier 1: YouTube InnerTube JSON API
    try {
      results = await searchInnerTube(cleanQ);
    } catch {}

    // Tier 2: Enhanced Multi-Regex HTML Scraping
    if (!results || results.length === 0) {
      try {
        results = await searchYouTubeHtml(cleanQ);
      } catch {}
    }

    // Tier 3: JioSaavn Search API Fallback
    if (!results || results.length === 0) {
      try {
        results = await searchJioSaavnFallback(cleanQ);
      } catch {}
    }

    if (results && results.length > 0) {
      searchCache.set(cacheKey, results);
      if (searchCache.size > 200) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ results: results || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Search failed', results: [] });
  }
}
