/**
 * api/playlist/spotify.js
 * Vercel Serverless Function to extract full tracks from Spotify playlist / album embed.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const id = req.query.id;
    const type = req.query.type || 'playlist';

    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing playlist or album id' });
    }

    const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: `Spotify embed returned ${response.status}` });
    }

    const html = await response.text();
    const nextDataMatch = html.match(/__NEXT_DATA__.*?>(.*?)<\/script>/s);

    if (!nextDataMatch) {
      return res.status(404).json({ success: false, error: 'Could not parse playlist tracks from embed' });
    }

    const parsed = JSON.parse(nextDataMatch[1]);
    const entity = parsed?.props?.pageProps?.state?.data?.entity;

    if (!entity) {
      return res.status(404).json({ success: false, error: 'No entity found in Spotify data' });
    }

    const title = entity.name || entity.title || 'Spotify Playlist';
    const coverArt = entity.coverArt?.sources?.[0]?.url || '';
    const rawTrackList = entity.trackList || [];

    const tracks = rawTrackList.map((t) => ({
      title: t.title || t.name,
      artist: t.subtitle || t.artist || '',
      duration: t.duration ? Math.round(t.duration / 1000) : undefined,
      artwork: coverArt
    }));

    return res.status(200).json({
      success: true,
      title,
      coverArt,
      tracks
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
}
