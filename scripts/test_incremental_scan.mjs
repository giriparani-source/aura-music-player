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

  const logs = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
      logs.push(text);
      console.log('[DEVICE LOG]', text);
    }
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      const val = msg.result?.result?.value !== undefined ? msg.result.result.value : msg.result;
      resolve(val);
    }
  });

  await new Promise((res) => ws.addEventListener('open', res));
  await send('Runtime.enable');

  console.log('1. Checking DB count before rescan...');
  const beforeRes = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('songs', 'readonly');
          const store = tx.objectStore('songs');
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            resolve({ count: allReq.result.length });
          };
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Before Rescan DB Count:', beforeRes);

  console.log('2. Clicking "Rescan Phone Audio" button in DOM...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const rescanBtn = buttons.find(b => b.textContent && b.textContent.includes('Rescan Phone Audio'));
        if (rescanBtn) {
          rescanBtn.click();
          return { clicked: true, text: rescanBtn.textContent };
        }
        return { clicked: false, availableButtons: buttons.map(b => b.textContent.trim()).filter(Boolean) };
      })()
    `,
    returnByValue: true
  });
  console.log('Click result:', clickRes);

  // Wait 4 seconds for scan and sync to complete
  await new Promise((r) => setTimeout(r, 4000));

  console.log('3. Checking DB count and newly added tracks after rescan...');
  const afterRes = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('songs', 'readonly');
          const store = tx.objectStore('songs');
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const songs = allReq.result;
            const newTracks = songs.filter(s => s.title.includes('Test Incremental'));
            resolve({
              totalCount: songs.length,
              newTracksFound: newTracks.map(t => ({ id: t.id, title: t.title, artist: t.artist, album: t.album, format: t.format, duration: t.duration }))
            });
          };
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('After Rescan DB Result:', JSON.stringify(afterRes, null, 2));

  ws.close();
  process.exit(0);
}

main().catch(console.error);
