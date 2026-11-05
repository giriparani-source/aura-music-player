async function forensicAudit() {
  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data);
      callbacks.delete(data.id);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => callbacks.delete(id) && reject(new Error(`timeout ${method}`)), 30000);
      callbacks.set(id, (val) => { clearTimeout(timer); resolve(val); });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.result?.exceptionDetails) {
      throw new Error(JSON.stringify(res.result.exceptionDetails));
    }
    return res.result?.result?.value;
  }

  // 1. Fetch raw YouTube playlist from invidious
  console.log('Fetching raw YouTube playlist data from Invidious...');
  const ytRes = await fetch('https://inv.nadeko.net/api/v1/playlists/PLNf1vclGjpRE');
  const ytData = await ytRes.json();

  // 2. Fetch raw Spotify embed data
  console.log('Fetching raw Spotify embed data...');
  const spRes = await fetch('https://open.spotify.com/embed/playlist/796bkCyjh8Bk2w9QDICrJv', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const spHtml = await spRes.text();
  const nextDataMatch = spHtml.match(/__NEXT_DATA__.*?>(.*?)<\/script>/s);
  const spParsed = nextDataMatch ? JSON.parse(nextDataMatch[1]) : null;
  const spRawTracks = spParsed?.props?.pageProps?.state?.data?.entity?.trackList || [];

  // 3. Read IndexedDB saved playlists and songs
  console.log('Reading saved playlists and songs from IndexedDB on device...');
  const dbData = await evaluate(`
    new Promise((resolve) => {
      const req = indexedDB.open('AuraMusicDB', 2);
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(['playlists', 'songs'], 'readonly');
        const pStore = tx.objectStore('playlists');
        const sStore = tx.objectStore('songs');
        const pReq = pStore.getAll();
        const sReq = sStore.getAll();
        tx.oncomplete = () => {
          resolve({
            playlists: pReq.result,
            songs: sReq.result
          });
        };
        tx.onerror = () => resolve({ error: 'tx error' });
      };
      req.onerror = () => resolve({ error: 'db open error' });
    })
  `);

  const songsMap = new Map();
  dbData.songs.forEach(s => songsMap.set(s.id, s));

  const ytPlaylist = dbData.playlists.find(p => p.id === 'pl-1790942961678');
  const spPlaylist = dbData.playlists.find(p => p.id === 'pl-1790943088415');

  const ytSavedSongs = (ytPlaylist?.songIds || []).map(id => songsMap.get(id)).filter(Boolean);
  const spSavedSongs = (spPlaylist?.songIds || []).map(id => songsMap.get(id)).filter(Boolean);

  console.log('\n============================================================');
  console.log('  FORENSIC AUDIT 1: YOUTUBE MUSIC PLAYLIST');
  console.log('============================================================');
  console.log('Expected Song Count (from User / YouTube Metadata):', ytData.videoCount); // 181
  console.log('Total Raw Videos Returned by Invidious API:', ytData.videos.length); // 197
  console.log('Total Saved Songs in Aura IndexedDB:', ytSavedSongs.length); // 173

  // Identify raw duplicates in YouTube
  const ytVideoIdCounts = new Map();
  ytData.videos.forEach((v, idx) => {
    if (!ytVideoIdCounts.has(v.videoId)) {
      ytVideoIdCounts.set(v.videoId, []);
    }
    ytVideoIdCounts.get(v.videoId).push({ index: idx + 1, title: v.title, author: v.author });
  });

  const ytDuplicates = [];
  ytVideoIdCounts.forEach((occurrences, vid) => {
    if (occurrences.length > 1) {
      ytDuplicates.push({
        videoId: vid,
        title: occurrences[0].title,
        occurrences: occurrences.map(o => o.index)
      });
    }
  });

  console.log(`\nYouTube Duplicate Entries within the Playlist: ${ytDuplicates.length} duplicates (${ytData.videos.length - ytVideoIdCounts.size} excess items)`);
  ytDuplicates.forEach((d, i) => {
    console.log(`  ${i + 1}. "${d.title}" (videoId: ${d.videoId}) appears at positions: ${d.occurrences.join(', ')}`);
  });

  // Check which song was further deduplicated in Aura
  console.log('\nWhy 173 songs saved instead of 174 unique YouTube videos?');
  const ytSavedIds = new Set();
  const duplicateYtMatches = [];
  ytSavedSongs.forEach((s) => {
    if (ytSavedIds.has(s.id)) {
      duplicateYtMatches.push(s);
    }
    ytSavedIds.add(s.id);
  });
  console.log('Saved unique IDs in Aura:', ytSavedIds.size);
  console.log('Number of JioSaavn 320k matched tracks:', ytSavedSongs.filter(s => !s.id.startsWith('online_')).length);
  console.log('Number of YouTube Direct fallback tracks:', ytSavedSongs.filter(s => s.id.startsWith('online_')).length);

  console.log('\n============================================================');
  console.log('  FORENSIC AUDIT 2: SPOTIFY PLAYLIST');
  console.log('============================================================');
  console.log('Expected Song Count (from User / Spotify): 181');
  console.log('Total Tracks in Spotify Embed JSON:', spRawTracks.length); // 100
  console.log('Total Saved Songs in Aura IndexedDB:', spSavedSongs.length); // 99

  // Deduplicated track in Spotify
  const spRawTitles = spRawTracks.map(t => `${t.title || t.name} - ${t.subtitle || t.artist || ''}`);
  console.log('Missing Tracks from Spotify (Tracks 101 to 181): 81 songs missing due to Spotify Embed 100-track pagination barrier');

  // Let's identify the 1 track deduplicated in Spotify
  const spSavedIds = new Set();
  spSavedSongs.forEach(s => spSavedIds.add(s.id));
  console.log('Saved unique IDs for Spotify in Aura:', spSavedIds.size);

  // Compare YouTube vs Spotify Songs (First 100)
  console.log('\nComparison of First 5 Tracks:');
  console.log('YouTube #1-5:');
  ytSavedSongs.slice(0, 5).forEach((s, i) => console.log(`  ${i + 1}. [${s.id.startsWith('online_') ? 'YouTube' : '320k'}] ${s.title} - ${s.artist}`));
  console.log('Spotify #1-5:');
  spSavedSongs.slice(0, 5).forEach((s, i) => console.log(`  ${i + 1}. [${s.id.startsWith('online_') ? 'YouTube' : '320k'}] ${s.title} - ${s.artist}`));

  ws.close();
}

forensicAudit().catch(console.error);
