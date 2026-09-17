import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9249;

async function run() {
  console.log('Testing SongRow Heart click on unplayed search result...');
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${EDGE_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_songrow_fav',
    'http://localhost:3000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const listRes = await fetch(`http://127.0.0.1:${EDGE_PORT}/json/list`).then(r => r.json());
    const page = listRes.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.onopen = resolve);

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

    async function evalJs(expression) {
      const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      return res.result?.result?.value;
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    await new Promise((r) => setTimeout(r, 2000));

    // Navigate to Search
    await evalJs(`
      (() => {
        const searchBtn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.innerText.includes('Search'));
        if (searchBtn) searchBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Search for "Hukum"
    await evalJs(`
      (() => {
        const input = document.querySelector('main input[type="text"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'Hukum');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 2500));

    // Find the 2nd song row (index 1) in search results - UNPLAYED!
    const rowInfo = await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('main div.space-y-1 div.group'));
        if (rows[1]) {
          const title = rows[1].querySelector('h4, h5')?.innerText;
          const favBtn = rows[1].querySelector('button[title*="Favour"]');
          const hasFillBefore = favBtn?.querySelector('svg')?.classList.contains('fill-rose-500');
          // Click the favorite button on this row WITHOUT playing it!
          if (favBtn) favBtn.click();
          return { found: true, title, hasFavBtn: !!favBtn, hasFillBefore };
        }
        return { found: false };
      })()
    `);
    console.log('Row info & clicked heart:', rowInfo);
    await new Promise((r) => setTimeout(r, 1000));

    // Check if the heart filled on row 1
    const checkRowAfter = await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('main div.space-y-1 div.group'));
        if (rows[1]) {
          const favBtn = rows[1].querySelector('button[title*="Favour"]');
          const hasFillAfter = favBtn?.querySelector('svg')?.classList.contains('fill-rose-500');
          return { hasFillAfter, btnTitle: favBtn?.getAttribute('title') };
        }
        return { notFound: true };
      })()
    `);
    console.log('Row heart state after click:', checkRowAfter);

    // Check IndexedDB
    const checkIdb = await evalJs(`
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs'], 'readonly');
          const store = tx.objectStore('songs');
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            const favs = getAll.result.filter(s => s.isFavorite);
            resolve({ totalInDb: getAll.result.length, favCount: favs.length, favSongs: favs.map(f => f.title) });
          };
          getAll.onerror = () => resolve({ error: true });
        };
      })
    `);
    console.log('IndexedDB state:', checkIdb);

    const isBugPresent = !checkRowAfter.hasFillAfter && checkIdb.favCount === 0;
    console.log('\nResult: Is Unplayed SongRow Favorite Bug Confirmed?', isBugPresent ? 'YES (BUG CONFIRMED)' : 'NO (PASSED)');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
