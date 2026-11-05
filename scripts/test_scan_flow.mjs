async function main() {
  const jsonRes = await fetch('http://localhost:9222/json');
  const pages = await jsonRes.json();
  const page = pages.find((p) => p.url.includes('localhost'));
  if (!page) throw new Error('No webview found');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      const val = msg.result?.result?.value !== undefined ? msg.result.result.value : msg.result;
      resolve(val);
    }
  });

  await new Promise((res) => ws.addEventListener('open', res));
  console.log('Connected to CDP');

  // Trigger click on 'Rescan Phone Audio' button
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Rescan Phone Audio'));
        if (!btn) return { found: false };
        btn.click();
        return { found: true };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Button click triggered:', clickRes);

  // Poll until isScanning is false or scan message appears
  let summary = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const status = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const banner = document.querySelector('.bg-emerald-500\\\\/10, .bg-neutral-800');
          const bannerText = banner ? banner.textContent : null;
          const songsCountEl = document.querySelector('h1 + span');
          
          return new Promise((resolve) => {
            const req = indexedDB.open('aura_music_db');
            req.onsuccess = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains('songs')) {
                resolve({ count: 0, bannerText });
                return;
              }
              const tx = db.transaction('songs', 'readonly');
              const store = tx.objectStore('songs');
              const countReq = store.count();
              countReq.onsuccess = () => resolve({ count: countReq.result, bannerText });
              countReq.onerror = () => resolve({ count: -1, bannerText });
            };
            req.onerror = () => resolve({ count: -1, bannerText });
          });
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log(`Poll ${i}:`, status);
    if (status && status.count > 0) {
      summary = status;
      break;
    }
  }

  console.log('Final Scan Status:', summary);
  ws.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
