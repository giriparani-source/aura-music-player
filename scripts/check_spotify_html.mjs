async function checkSpotify() {
  const url = 'https://open.spotify.com/playlist/796bkCyjh8Bk2w9QDICrJv?si=2JueO5qHSIyU0mBzGN_fIA&utm_source=copy-link';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  const html = await res.text();
  console.log('HTML length:', html.length);

  // Check for schema.org or JSON-LD
  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (jsonLd) {
    console.log('JSON-LD found! Parsing...');
    try {
      const data = JSON.parse(jsonLd[1]);
      console.log('JSON-LD @type:', data['@type']);
      console.log('JSON-LD name:', data.name);
      console.log('JSON-LD track count:', data.track?.numberOfItems || data.track?.itemListElement?.length || (Array.isArray(data.track) ? data.track.length : 'N/A'));
      if (data.track?.itemListElement) {
        console.log('itemListElement sample:', data.track.itemListElement[0]);
      }
    } catch (e) {
      console.log('JSON-LD error:', e.message);
    }
  }

  // Check for track links
  const trackLinks = new Set();
  const trackMatches = html.match(/\/track\/[a-zA-Z0-9]+/g) || [];
  trackMatches.forEach(t => trackLinks.add(t));
  console.log('Unique track links in HTML:', trackLinks.size, 'total matches:', trackMatches.length);

  // Check all script tags with JSON
  const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  console.log('Total script tags:', scriptTags.length);
  for (let i = 0; i < scriptTags.length; i++) {
    const s = scriptTags[i];
    if (s.includes('initial-state') || s.includes('trackList') || s.includes('itemListElement') || s.includes('items')) {
      console.log(`Script ${i} matches keywords, length: ${s.length}, preview: ${s.substring(0, 150)}...`);
    }
  }
}
checkSpotify();
