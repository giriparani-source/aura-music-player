async function inspectSpotifyWeb() {
  const res = await fetch('https://open.spotify.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  console.log('Status:', res.status);
  const html = await res.text();
  const tokenMatch = html.match(/"accessToken":"([^"]+)"/) ||
                     html.match(/"token":"([^"]+)"/) ||
                     html.match(/accessToken\s*=\s*['"]([^'"]+)['"]/);
  console.log('Token in HTML:', !!tokenMatch);
  if (tokenMatch) {
    console.log('Token snippet:', tokenMatch[1].substring(0, 30));
  }

  // Check script tags for session or config
  const sessionMatch = html.match(/<script id="session"[^>]*>([\s\S]*?)<\/script>/i);
  if (sessionMatch) {
    console.log('Session script found! Content length:', sessionMatch[1].length);
    try {
      const sess = JSON.parse(sessionMatch[1]);
      console.log('Session parsed keys:', Object.keys(sess));
      console.log('accessToken:', !!sess.accessToken);
      if (sess.accessToken) {
        console.log('accessToken preview:', sess.accessToken.substring(0, 25) + '...');
        return sess.accessToken;
      }
    } catch (e) {
      console.log('Parse session error:', e.message);
    }
  }

  // Check for other scripts
  const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (let i = 0; i < scriptTags.length; i++) {
    const s = scriptTags[i];
    if (s.includes('accessToken')) {
      console.log(`Script ${i} contains accessToken! Preview: ${s.substring(0, 200)}`);
    }
  }
}

inspectSpotifyWeb().then(token => {
  if (token) {
    console.log('SUCCESS! Extracted Spotify token directly from open.spotify.com!');
  }
}).catch(console.error);
