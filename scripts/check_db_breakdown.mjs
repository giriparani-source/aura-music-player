async function check() {
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
  const res = await send('Runtime.evaluate', {
    expression: `
      new Promise(resolve => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = e => {
          const db = e.target.result;
          const tx = db.transaction('songs', 'readonly');
          const store = tx.objectStore('songs');
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            const songs = getAll.result;
            const local = songs.filter(s => s.filePath && !s.isOnline);
            const online = songs.filter(s => s.isOnline || !s.filePath);
            resolve({ total: songs.length, local: local.length, online: online.length });
          };
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Database Breakdown:', res.result?.result?.value);
  ws.close();
}
check().catch(console.error);
