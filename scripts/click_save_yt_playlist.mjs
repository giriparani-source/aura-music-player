import { execSync } from 'child_process';

async function savePlaylist() {
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
      const timer = setTimeout(() => callbacks.delete(id) && reject(new Error(`timeout ${method}`)), 30000);
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

  console.log('Clicking "Save to My Library" on phone...');
  const click = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes('Save to My Library'));
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.textContent.trim() };
      }
      return { clicked: false, buttons: buttons.map(b => b.textContent.trim()) };
    })()
  `);
  console.log('Save button click:', click);

  // Wait 3 seconds for IndexedDB write and navigation
  await new Promise(r => setTimeout(r, 3000));

  try {
    execSync('adb exec-out screencap -p > screenshot_yt_saved_page.png');
  } catch {}

  // Check IndexedDB
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

  console.log('\n--- Database State After YouTube Import Save ---');
  console.log('Total Songs in IndexedDB:', dbData.songsCount);
  console.log('Total Playlists in IndexedDB:', dbData.playlists?.length);
  dbData.playlists?.forEach(p => {
    console.log(` - ID: "${p.id}", Name: "${p.name}", Songs: ${p.songIds?.length || 0}, isSmart: ${!!p.isSmart}`);
  });

  const ytPlaylist = dbData.playlists?.find(p => p.name === 'Favorite Songs');
  if (ytPlaylist) {
    console.log('\nImported YouTube Playlist Details:');
    console.log(' - Name:', ytPlaylist.name);
    console.log(' - Total Song IDs:', ytPlaylist.songIds?.length);
    console.log(' - Description:', ytPlaylist.description);
    console.log(' - CoverArt present:', !!ytPlaylist.coverArt);
  }

  ws.close();
}

savePlaylist().catch(console.error);
