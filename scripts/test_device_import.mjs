async function main() {
  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page');
  if (!page) {
    console.error('No page found on device!');
    process.exit(1);
  }

  console.log('Connecting to device WebView:', page.title, page.url);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 1;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const parsed = JSON.parse(event.data);
    if (parsed.id && callbacks.has(parsed.id)) {
      callbacks.get(parsed.id)(parsed);
      callbacks.delete(parsed.id);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => {
        callbacks.delete(id);
        reject(new Error(`Timeout on ${method}`));
      }, 30000);
      callbacks.set(id, (val) => {
        clearTimeout(timer);
        resolve(val);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.result?.exceptionDetails) {
      throw new Error(JSON.stringify(res.result.exceptionDetails));
    }
    return res.result?.result?.value;
  }

  // Check current URL and DOM
  const url = await evaluate('window.location.href');
  console.log('Current URL on phone:', url);

  const title = await evaluate('document.title');
  console.log('Document Title:', title);

  // Check current playlists in IndexedDB
  const dbPlaylists = await evaluate(`
    new Promise((resolve) => {
      const req = indexedDB.open('AuraMusicDB', 2);
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('playlists')) {
          return resolve([]);
        }
        const tx = db.transaction('playlists', 'readonly');
        const store = tx.objectStore('playlists');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result);
        getAll.onerror = () => resolve([]);
      };
      req.onerror = () => resolve([]);
    })
  `);

  console.log('Current Playlists in IndexedDB count:', dbPlaylists?.length || 0);
  if (Array.isArray(dbPlaylists)) {
    dbPlaylists.forEach(p => console.log(' - Playlist:', p.name, 'songs:', p.songIds?.length));
  }

  ws.close();
}

main().catch(console.error);
