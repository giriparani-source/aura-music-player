import { spawn } from 'child_process';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9252;
const USER_DATA_DIR = 'C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_p2_verify';

async function run() {
  console.log('Testing P2 Fix: SongRow Heart Toggle on Unplayed Search Result...');

  try {
    if (fs.existsSync(USER_DATA_DIR)) {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    }
  } catch (e) {}

  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${EDGE_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${USER_DATA_DIR}`,
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
    console.log('Searching for "Hukum"...');
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

    // =========================================================================
    // TEST 1: Song-a play pannama -> SongRow Heart click -> Filled & IndexedDB saved
    // =========================================================================
    console.log('\n[TEST 1] Clicking Heart on Unplayed Row 2...');
    const test1Click = await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('main div.space-y-1 div.group'));
        if (rows[1]) {
          const title = rows[1].querySelector('h4, h5')?.innerText;
          const favBtn = rows[1].querySelector('button[title*="Favour"]');
          if (favBtn) favBtn.click();
          return { clicked: true, title };
        }
        return { clicked: false };
      })()
    `);
    console.log('Clicked target:', test1Click);
    await new Promise((r) => setTimeout(r, 1200));

    // Verify UI state after click
    const test1Ui = await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('main div.space-y-1 div.group'));
        if (rows[1]) {
          const favBtn = rows[1].querySelector('button[title*="Favour"]');
          const hasFill = favBtn?.querySelector('svg')?.classList.contains('fill-rose-500');
          const isRoseText = favBtn?.classList.contains('text-rose-500');
          const btnTitle = favBtn?.getAttribute('title');
          return { hasFill, isRoseText, btnTitle };
        }
        return null;
      })()
    `);
    console.log('TEST 1 UI State:', test1Ui);

    // Verify IndexedDB
    const test1Idb = await evalJs(`
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs'], 'readonly');
          const store = tx.objectStore('songs');
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            const favs = getAll.result.filter(s => s.isFavorite);
            resolve({
              totalInDb: getAll.result.length,
              favCount: favs.length,
              favSong: favs[0] ? { id: favs[0].id, title: favs[0].title, isFavorite: favs[0].isFavorite } : null
            });
          };
          getAll.onerror = () => resolve({ error: true });
        };
      })
    `);
    console.log('TEST 1 IndexedDB State:', test1Idb);

    const test1Passed = test1Ui?.hasFill === true && test1Idb.favCount >= 1 && test1Idb.favSong?.isFavorite === true;
    console.log('TEST 1 Result:', test1Passed ? '✅ PASS' : '❌ FAIL');

    // =========================================================================
    // TEST 2: Same Heart again click -> Unfavorite & IndexedDB update
    // =========================================================================
    console.log('\n[TEST 2] Clicking Heart again to Unfavorite...');
    await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('main div.space-y-1 div.group'));
        if (rows[1]) {
          const favBtn = rows[1].querySelector('button[title*="Favour"]');
          if (favBtn) favBtn.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    const test2Ui = await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('main div.space-y-1 div.group'));
        if (rows[1]) {
          const favBtn = rows[1].querySelector('button[title*="Favour"]');
          const hasFill = favBtn?.querySelector('svg')?.classList.contains('fill-rose-500');
          return { hasFill, btnTitle: favBtn?.getAttribute('title') };
        }
        return null;
      })()
    `);
    console.log('TEST 2 UI State:', test2Ui);

    const test2Idb = await evalJs(`
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs'], 'readonly');
          const store = tx.objectStore('songs');
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            const favs = getAll.result.filter(s => s.isFavorite);
            resolve({
              favCount: favs.length,
              firstSongFavState: getAll.result[0] ? getAll.result[0].isFavorite : null
            });
          };
          getAll.onerror = () => resolve({ error: true });
        };
      })
    `);
    console.log('TEST 2 IndexedDB State:', test2Idb);

    const test2Passed = test2Ui?.hasFill === false && test2Idb.favCount === 0;
    console.log('TEST 2 Result:', test2Passed ? '✅ PASS' : '❌ FAIL');

    // Re-favorite to test TEST 3 (Persistence across refresh)
    console.log('\nRe-favoriting for Test 3...');
    await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('main div.space-y-1 div.group'));
        if (rows[1]) {
          const favBtn = rows[1].querySelector('button[title*="Favour"]');
          if (favBtn) favBtn.click();
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    // =========================================================================
    // TEST 3: Page refresh -> Favorite state persist
    // =========================================================================
    console.log('\n[TEST 3] Reloading page to test persistence...');
    await send('Page.reload');
    await new Promise((r) => setTimeout(r, 3000));

    const test3Idb = await evalJs(`
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs'], 'readonly');
          const store = tx.objectStore('songs');
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            const favs = getAll.result.filter(s => s.isFavorite);
            resolve({
              favCount: favs.length,
              favSong: favs[0] ? { id: favs[0].id, title: favs[0].title, isFavorite: favs[0].isFavorite } : null
            });
          };
          getAll.onerror = () => resolve({ error: true });
        };
      })
    `);
    console.log('TEST 3 IndexedDB State after Reload:', test3Idb);

    // Re-search and verify UI has filled heart
    await evalJs(`
      (() => {
        const searchBtn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.innerText.includes('Search'));
        if (searchBtn) searchBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

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

    const test3Ui = await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('main div.space-y-1 div.group'));
        if (rows[1]) {
          const favBtn = rows[1].querySelector('button[title*="Favour"]');
          return {
            hasFill: favBtn?.querySelector('svg')?.classList.contains('fill-rose-500'),
            btnTitle: favBtn?.getAttribute('title')
          };
        }
        return null;
      })()
    `);
    console.log('TEST 3 UI State after Reload and Re-search:', test3Ui);

    const test3Passed = test3Idb.favCount >= 1 && test3Idb.favSong?.isFavorite === true;
    console.log('TEST 3 Result:', test3Passed ? '✅ PASS' : '❌ FAIL');

    const allP2Passed = test1Passed && test2Passed && test3Passed;
    console.log('\n======================================================');
    console.log(allP2Passed ? '🎉 P2 FIX VERIFICATION: ALL 3 TESTS PASSED!' : '❌ P2 FIX VERIFICATION FAILED');
    console.log('======================================================');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
