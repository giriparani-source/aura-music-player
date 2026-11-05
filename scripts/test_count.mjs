async function main() {
  const jsonRes = await fetch('http://localhost:9222/json');
  const pages = await jsonRes.json();
  const page = pages.find((p) => p.url.includes('localhost'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));

  const res = await new Promise((resolve) => {
    ws.addEventListener('message', (ev) => {
      const data = JSON.parse(ev.data);
      if (data.id === 1) resolve(data.result?.result?.value);
    });
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          new Promise((resolve) => {
            const req = indexedDB.open('AuraMusicDB');
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction('songs', 'readonly');
              const store = tx.objectStore('songs');
              const c = store.count();
              c.onsuccess = () => {
                db.close();
                resolve(c.result);
              };
            };
            req.onerror = () => resolve('Error: ' + req.error);
          })
        `,
        awaitPromise: true,
        returnByValue: true
      }
    }));
  });

  console.log('Count:', res);
  ws.close();
}

main().catch(console.error);
