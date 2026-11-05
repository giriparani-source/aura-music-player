import fs from 'fs';

async function restore() {
  const backupData = JSON.parse(fs.readFileSync('scripts/backup_auramusicdb.json', 'utf8'));
  console.log(`Loaded backup: ${backupData.songs.length} songs, ${backupData.playlists.length} playlists.`);

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

  // Inject backup data into IndexedDB
  const res = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve, reject) => {
        const backupSongs = ${JSON.stringify(backupData.songs)};
        const backupPlaylists = ${JSON.stringify(backupData.playlists)};

        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs', 'playlists'], 'readwrite');
          const songStore = tx.objectStore('songs');
          const plStore = tx.objectStore('playlists');

          // Clear any test clutter and restore pristine 738 songs & 7 playlists
          songStore.clear();
          plStore.clear();

          for (const s of backupSongs) {
            songStore.put(s);
          }
          for (const p of backupPlaylists) {
            plStore.put(p);
          }

          tx.oncomplete = () => {
            resolve({ restoredSongs: backupSongs.length, restoredPlaylists: backupPlaylists.length });
          };
          tx.onerror = (err) => reject(err);
        };
        req.onerror = (err) => reject(err);
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Restoration result:', res.result?.result?.value);
  ws.close();
}

restore().catch(console.error);
