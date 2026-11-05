async function testLocalPlay() {
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

  const localPlayRes = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        try {
          const req = indexedDB.open('AuraMusicDB', 2);
          req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('songs', 'readonly');
            const sStore = tx.objectStore('songs');
            const getAll = sStore.getAll();
            getAll.onsuccess = async () => {
              const songs = getAll.result;
              const localSong = songs.find(s => s.filePath && !s.isOnline);
              if (!localSong) {
                resolve({ success: false, reason: 'No local song found' });
                return;
              }

              if (window.Capacitor?.Plugins?.AuraMedia) {
                const plugin = window.Capacitor.Plugins.AuraMedia;
                try {
                  await plugin.playNativeTrack({
                    id: localSong.id,
                    uri: localSong.filePath.startsWith('file://') ? localSong.filePath : 'file://' + localSong.filePath,
                    title: localSong.title,
                    artist: localSong.artist,
                    album: localSong.album || 'Local Music',
                    artwork: localSong.coverArt || '',
                    duration: localSong.duration || 180
                  });

                  await new Promise(r => setTimeout(r, 1000));
                  await plugin.pauseNative();

                  resolve({
                    success: true,
                    trackTitle: localSong.title,
                    isNative: true,
                    playedLocal: true
                  });
                } catch (playErr) {
                  resolve({ success: false, error: playErr.message });
                }
              } else {
                resolve({ success: false, reason: 'AuraMedia plugin not found' });
              }
            };
            getAll.onerror = (err) => resolve({ success: false, error: 'getAll failed' });
          };
          req.onerror = (err) => resolve({ success: false, error: 'db open failed' });
        } catch (err) {
          resolve({ success: false, error: err.message });
        }
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Full CDP response:', JSON.stringify(localPlayRes, null, 2));
  ws.close();
}

testLocalPlay().catch(console.error);
