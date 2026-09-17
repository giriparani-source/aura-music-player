/**
 * server/middleware/spotifyPlaylist.ts
 * Server endpoint to fetch Spotify playlist / album tracks by parsing open.spotify.com embed.
 * Provides CORS-friendly JSON response for web environments.
 */

export function spotifyPlaylistHandler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  (async () => {
    try {
      const url = new URL(req.url, 'http://localhost:3000');
      const id = url.searchParams.get('id');
      const type = url.searchParams.get('type') || 'playlist';

      if (!id) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Missing playlist or album id' }));
        return;
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
        res.statusCode = response.status;
        res.end(JSON.stringify({ success: false, error: `Spotify embed returned ${response.status}` }));
        return;
      }

      const html = await response.text();
      const nextDataMatch = html.match(/__NEXT_DATA__.*?>(.*?)<\/script>/s);

      if (!nextDataMatch) {
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, error: 'Could not parse playlist tracks from embed' }));
        return;
      }

      const parsed = JSON.parse(nextDataMatch[1]);
      const entity = parsed?.props?.pageProps?.state?.data?.entity;

      if (!entity) {
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, error: 'No entity found in Spotify data' }));
        return;
      }

      const title = entity.name || entity.title || 'Spotify Playlist';
      const coverArt = entity.coverArt?.sources?.[0]?.url || '';
      const rawTrackList = entity.trackList || [];

      const tracks = rawTrackList.map((t: any) => ({
        title: t.title || t.name,
        artist: t.subtitle || t.artist || '',
        duration: t.duration ? Math.round(t.duration / 1000) : undefined,
        artwork: coverArt
      }));

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          success: true,
          title,
          coverArt,
          tracks
        })
      );
    } catch (err: any) {
      console.warn('[Spotify Playlist Handler Error]:', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: err.message || 'Server error' }));
    }
  })();
}
