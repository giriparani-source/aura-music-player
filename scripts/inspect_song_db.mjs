async function checkSong() {
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
    return new Promise((resolve) => {
      const id = msgId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  const res = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('songs', 'readonly');
          const store = tx.objectStore('songs');
          const getReq = store.getAll();
          getReq.onsuccess = () => {
            const matches = getReq.result.filter(s => s.title && s.title.includes('Amizhdhe Nee'));
            resolve(matches.map(m => ({
              id: m.id,
              title: m.title,
              artist: m.artist,
              isSaavn: m.isSaavn,
              isOnline: m.isOnline,
              isForegroundOnly: m.isForegroundOnly,
              playbackMode: m.playbackMode,
              filePath: m.filePath,
              path: m.path,
              format: m.format
            })));
          };
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Amizhdhe Nee records in DB:');
  console.dir(res.result?.result?.value, { depth: null });
  ws.close();
}
checkSong().catch(console.error);
