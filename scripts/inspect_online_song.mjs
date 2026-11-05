async function inspect() {
  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (m, p = {}) => new Promise(res => {
    const i = id++;
    const handler = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === i) { ws.removeEventListener('message', handler); res(d); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
  });

  const songsSummary = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('songs', 'readonly');
          const sStore = tx.objectStore('songs');
          const getAll = sStore.getAll();
          getAll.onsuccess = () => {
            const songs = getAll.result;
            const modes = {};
            songs.forEach(s => {
              const m = s.playbackMode || 'none';
              modes[m] = (modes[m] || 0) + 1;
            });
            const jioSong = songs.find(s => s.playbackMode === 'direct-catalog' || s.source === 'jiosaavn' || (s.streamUrl && s.streamUrl.includes('saavn')));
            resolve({
              modes,
              sampleDirect: jioSong ? {
                id: jioSong.id,
                title: jioSong.title,
                playbackMode: jioSong.playbackMode,
                streamUrl: jioSong.streamUrl,
                filePath: jioSong.filePath
              } : null
            });
          };
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(songsSummary.result?.result?.value, null, 2));
  ws.close();
}

inspect().catch(console.error);
