// Using native global WebSocket in Node 22+

async function main() {
  const jsonRes = await fetch('http://localhost:9222/json');
  const pages = await jsonRes.json();
  const page = pages.find((p) => p.url.includes('localhost'));
  if (!page) {
    console.error('No page found');
    return;
  }

  console.log('Connecting to:', page.webSocketDebuggerUrl);
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

  ws.addEventListener('open', async () => {
    console.log('Connected to CDP');
    await send('Runtime.enable');
    await send('Console.enable');

    // 1. Evaluate Capacitor and AndroidMediaBridge status
    const evalRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const isCapNative = window.Capacitor ? window.Capacitor.isNativePlatform() : false;
          const plugins = window.Capacitor ? Object.keys(window.Capacitor.Plugins || {}) : [];
          return { isCapNative, plugins, url: window.location.href };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Platform Info:', JSON.stringify(evalRes, null, 2));

    // 2. Trigger scanDeviceAudio directly via Capacitor plugin to inspect raw response
    const scanRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AuraMedia) {
              const res = await window.Capacitor.Plugins.AuraMedia.scanDeviceAudio();
              return { success: true, count: res ? res.total : 0, firstTrack: res && res.tracks ? res.tracks[0] : null };
            } else {
              return { success: false, error: 'AuraMedia plugin not found on window.Capacitor.Plugins' };
            }
          } catch (e) {
            return { success: false, error: e.message || String(e) };
          }
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Direct Scan Result:', JSON.stringify(scanRes, null, 2));

    // 3. Inspect IndexedDB songs store count
    const idbRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          return new Promise((resolve) => {
            const req = indexedDB.open('aura_music_db');
            req.onsuccess = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains('songs')) {
                resolve({ exists: false });
                return;
              }
              const tx = db.transaction('songs', 'readonly');
              const store = tx.objectStore('songs');
              const countReq = store.count();
              countReq.onsuccess = () => resolve({ count: countReq.result });
              countReq.onerror = () => resolve({ error: 'failed' });
            };
            req.onerror = () => resolve({ error: 'open failed' });
          });
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('IndexedDB Songs count:', JSON.stringify(idbRes, null, 2));

    ws.close();
    process.exit(0);
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      const val = msg.result?.result?.value !== undefined ? msg.result.result.value : msg.result;
      resolve(val);
    }
  });
}

main().catch(console.error);
