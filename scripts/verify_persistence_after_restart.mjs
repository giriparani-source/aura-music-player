import { execSync } from 'child_process';

async function verifyPersistence() {
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
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => callbacks.delete(id) && reject(new Error(`timeout ${method}`)), 10000);
      callbacks.set(id, (val) => { clearTimeout(timer); resolve(val); });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.result?.exceptionDetails) {
      throw new Error(JSON.stringify(res.result.exceptionDetails));
    }
    return res.result?.result?.value;
  }

  // Wait 2 seconds for app hydration
  await new Promise(r => setTimeout(r, 2000));

  const dbData = await evaluate(`
    new Promise((resolve) => {
      const req = indexedDB.open('AuraMusicDB', 2);
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(['playlists', 'songs'], 'readonly');
        const pStore = tx.objectStore('playlists');
        const sStore = tx.objectStore('songs');
        const pReq = pStore.getAll();
        const sReq = sStore.getAll();
        
        tx.oncomplete = () => {
          resolve({
            playlists: pReq.result,
            songsCount: sReq.result?.length || 0
          });
        };
        tx.onerror = () => resolve({ error: 'tx error' });
      };
      req.onerror = () => resolve({ error: 'db open error' });
    })
  `);

  console.log('--- RESTART PERSISTENCE VERIFICATION ---');
  console.log('Total Songs in DB after restart:', dbData.songsCount);
  console.log('Total Playlists in DB after restart:', dbData.playlists?.length);

  const favPlaylist = dbData.playlists?.find(p => p.name === 'Favorite Songs');
  if (favPlaylist) {
    console.log('✅ "Favorite Songs" PERSISTED ACROSS APP RESTART!');
    console.log(' - Playlist ID:', favPlaylist.id);
    console.log(' - Song count:', favPlaylist.songIds?.length);
    console.log(' - Created At:', new Date(favPlaylist.createdAt).toISOString());
  } else {
    console.error('❌ "Favorite Songs" NOT FOUND IN DB AFTER RESTART!');
  }

  // Navigate to Library -> Playlists tab to view it in UI
  await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const libBtn = buttons.find(b => b.textContent && b.textContent.includes('Library'));
      if (libBtn) libBtn.click();
    })()
  `);

  await new Promise(r => setTimeout(r, 1500));

  try {
    execSync('adb exec-out screencap -p > screenshot_restarted_library.png');
  } catch {}

  ws.close();
}

verifyPersistence().catch(console.error);
