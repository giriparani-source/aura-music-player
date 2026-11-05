async function main() {
  const jsonRes = await fetch('http://localhost:9222/json');
  const pages = await jsonRes.json();
  const page = pages.find((p) => p.url.includes('localhost'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      const val = msg.result?.result?.value !== undefined ? msg.result.result.value : msg.result;
      resolve(val);
    }
  });

  await new Promise((res) => ws.addEventListener('open', res));
  await send('Runtime.enable');

  const evalRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const scan = await window.Capacitor.Plugins.AuraMedia.scanDeviceAudio();
          
          // Re-format tracks exactly as LocalMusicView does
          const formattedSongs = scan.tracks.map((t) => {
            let fileName = t.title;
            let format = 'mp3';
            if (t.rawFileSystemPath) {
              const lastSlash = Math.max(t.rawFileSystemPath.lastIndexOf('/'), t.rawFileSystemPath.lastIndexOf('\\\\'));
              fileName = lastSlash >= 0 ? t.rawFileSystemPath.substring(lastSlash + 1) : t.rawFileSystemPath;
              const dotIdx = fileName.lastIndexOf('.');
              if (dotIdx > 0) format = fileName.substring(dotIdx + 1).toLowerCase();
            }
            return {
              id: t.id,
              title: t.title,
              artist: t.artist,
              album: t.album,
              duration: t.duration,
              path: t.contentUri || t.path,
              filePath: t.contentUri || t.path,
              contentUri: t.contentUri || t.path,
              artwork: t.artwork || t.coverArt || '',
              coverArt: t.coverArt || t.artwork || '',
              folder: t.folder || 'Phone Audio',
              fileName,
              format,
              bitrate: 320,
              fileSize: t.fileSize || 0,
              dateAdded: t.dateAdded || Date.now(),
              lastModified: t.dateModified || undefined,
              playCount: 0,
              isFavorite: false,
              isOnline: false
            };
          });

          // Open DB directly to read syncDeviceSongs
          const req = indexedDB.open('AuraMusicDB', 2);
          return new Promise((resolve) => {
            req.onsuccess = async () => {
              const db = req.result;
              const tx = db.transaction('songs', 'readonly');
              const store = tx.objectStore('songs');
              const allReq = store.getAll();
              allReq.onsuccess = () => {
                const existing = allReq.result;
                
                // Compare exactly as db.syncDeviceSongs does
                let added = 0;
                let updated = 0;
                const existingById = new Map(existing.map(s => [s.id, s]));
                
                for (const scanned of formattedSongs) {
                  const match = existingById.get(scanned.id);
                  if (!match) {
                    added++;
                  } else {
                    const scannedMod = scanned.lastModified ? Math.floor(scanned.lastModified / 1000) : 0;
                    const existingMod = match.lastModified ? Math.floor(match.lastModified / 1000) : 0;
                    const isMod = (scannedMod > 0 && existingMod > 0 && scannedMod !== existingMod) ||
                                  (scanned.duration > 0 && Math.abs(scanned.duration - match.duration) > 2) ||
                                  (scanned.fileSize > 0 && scanned.fileSize !== match.fileSize) ||
                                  (scanned.title && scanned.title !== match.title);
                    if (isMod) updated++;
                  }
                }
                
                resolve({
                  totalInDb: existing.length,
                  scannedTotal: formattedSongs.length,
                  computedAdded: added,
                  computedUpdated: updated,
                  computedRemoved: 0
                });
              };
            };
          });
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Idempotency Comparison Result:', JSON.stringify(evalRes, null, 2));
  ws.close();
  process.exit(0);
}

main().catch(console.error);
