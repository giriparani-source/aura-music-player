async function testOnlinePlay() {
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

  const onlinePlayRes = await send('Runtime.evaluate', {
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
              const directSong = songs.find(s => s.playbackMode === 'direct-catalog' && s.filePath?.startsWith('http'));
              if (!directSong) {
                resolve({ success: false, reason: 'No direct-catalog song found' });
                return;
              }

              if (window.Capacitor?.Plugins?.AuraMedia) {
                const plugin = window.Capacitor.Plugins.AuraMedia;
                try {
                  await plugin.playNativeTrack({
                    id: directSong.id,
                    uri: directSong.filePath,
                    title: directSong.title,
                    artist: directSong.artist,
                    album: directSong.album || 'Online Stream',
                    artwork: directSong.coverArt || '',
                    duration: directSong.duration || 200
                  });

                  await new Promise(r => setTimeout(r, 1000));
                  await plugin.pauseNative();

                  resolve({
                    success: true,
                    trackTitle: directSong.title,
                    isNative: true,
                    playedOnline: true,
                    uri: directSong.filePath
                  });
                } catch (playErr) {
                  resolve({ success: false, error: playErr.message });
                }
              } else {
                resolve({ success: false, reason: 'AuraMedia plugin not found' });
              }
            };
            getAll.onerror = () => resolve({ success: false, error: 'getAll failed' });
          };
          req.onerror = () => resolve({ success: false, error: 'db open failed' });
        } catch (err) {
          resolve({ success: false, error: err.message });
        }
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Full Online CDP response:', JSON.stringify(onlinePlayRes, null, 2));
  ws.close();
}

testOnlinePlay().catch(console.error);
