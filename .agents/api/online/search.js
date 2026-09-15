import https from 'https';

// In-memory cache across warm serverless invocations
const searchCache = new Map();

function searchYouTubeHtml(query) {
  return new Promise((resolve) => {
    // If not already specifying language, append 'Tamil song' to ensure Kollywood/Tamil results take priority
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
          const match = data.match(/var ytInitialData = ({.*?});<\/script>/s) || data.match(/ytInitialData\s*=\s*({.+?});/s);
          if (!match) {
            return resolve([]);
          }

          const json = JSON.parse(match[1]);
          const contents = json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
          const results = [];

          for (const item of contents) {
            const v = item.videoRenderer;
            if (v && v.videoId) {
              const durationText = v.lengthText?.simpleText || '3:30';
              const parts = durationText.split(':').map(Number);
              let durationSec = 210;
              if (parts.length === 2) {
                durationSec = parts[0] * 60 + parts[1];
              } else if (parts.length === 3) {
                durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
              }

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
        } catch (parseErr) {
          resolve([]);
        }
      });
    });

    req.on('error', () => resolve([]));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve([]);
    });
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

  const cacheKey = q.trim().toLowerCase();
  if (searchCache.has(cacheKey)) {
    return res.status(200).json({ results: searchCache.get(cacheKey) });
  }

  try {
    const results = await searchYouTubeHtml(q.trim());
    if (results.length > 0) {
      searchCache.set(cacheKey, results);
      if (searchCache.size > 200) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
      }
    }
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Search failed', results: [] });
  }
}
