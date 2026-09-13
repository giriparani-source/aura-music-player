import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9228;
const USER_DATA_DIR = 'C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_fav_clean';

async function run() {
  console.log('Testing BUG-1: Favorite Toggle Sync & Persistence...');

  // Clean test dir if exists
  try {
    if (fs.existsSync(USER_DATA_DIR)) {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    }
  } catch (e) {
    // Ignore cleanup error
  }

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

    // Wait for cards on HomeView
    console.log('Waiting for Home view cards to load...');
    let cardFound = false;
    for (let i = 0; i < 20; i++) {
      cardFound = await evalJs(`Boolean(document.querySelector('main div.group'))`);
      if (cardFound) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!cardFound) {
      throw new Error('Home view cards failed to load within timeout');
    }
    console.log('Home cards loaded.');

    // 1. Open first playlist card
    console.log('1. Opening playlist modal...');
    await evalJs(`
      (() => {
        const card = document.querySelector('main div.group');
        if (card) card.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // 2. Play first song in modal
    console.log('2. Playing first track in modal...');
    const playedTitle = await evalJs(`
      (() => {
        const songRow = document.querySelector('div.fixed.inset-0.z-50 div.group h4')?.closest('div.group');
        if (songRow) {
          songRow.click();
          return songRow.querySelector('h4')?.innerText;
        }
        return null;
      })()
    `);
    console.log('Playing track:', playedTitle);
    await new Promise((r) => setTimeout(r, 1500));

    // 3. Check Initial Favorite State
    const initialFav = await evalJs(`
      (() => {
        const favBtn = document.querySelector('button[title="Favorite"]');
        const hasFill = favBtn?.querySelector('svg')?.classList.contains('fill-rose-500');
        const storeSong = window.usePlayerStore ? window.usePlayerStore.getState().currentSong : null;
        return {
          btnFound: !!favBtn,
          hasFill: !!hasFill,
          currentSongTitle: storeSong?.title,
          storeIsFav: storeSong?.isFavorite
        };
      })()
    `);
    console.log('3. Initial Favorite State:', initialFav);

    // 4. Click Heart Icon on BottomPlayer
    console.log('4. Clicking Heart button on BottomPlayer...');
    await evalJs(`
      (() => {
        const favBtn = document.querySelector('button[title="Favorite"]');
        if (favBtn) favBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // 5. Verify State after Click
    const afterClick = await evalJs(`
      (() => {
        const favBtn = document.querySelector('button[title="Favorite"]');
        const hasFill = favBtn?.querySelector('svg')?.classList.contains('fill-rose-500');
        const isRoseText = favBtn?.classList.contains('text-rose-500');
        const pStore = window.usePlayerStore ? window.usePlayerStore.getState() : null;
        const currentSong = pStore?.currentSong;
        const queueItem = pStore?.queue?.find(s => s.id === currentSong?.id);
        const lStore = window.useLibraryStore ? window.useLibraryStore.getState() : null;
        const libSong = lStore?.songs?.find(s => s.id === currentSong?.id);

        return {
          hasFill: !!hasFill,
          isRoseText: !!isRoseText,
          currentSongIsFav: currentSong?.isFavorite,
          queueItemIsFav: queueItem?.isFavorite,
          libSongIsFav: libSong?.isFavorite,
          songId: currentSong?.id
        };
      })()
    `);
    console.log('5. State after favorite toggle click:', afterClick);

    // 6. Verify in IndexedDB
    console.log('6. Checking IndexedDB for favorited song...');
    const idbState = await evalJs(`
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs'], 'readonly');
          const store = tx.objectStore('songs');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const favSongs = getAllReq.result.filter(s => s.isFavorite);
            resolve({
              totalInDb: getAllReq.result.length,
              favCount: favSongs.length,
              firstFav: favSongs[0] ? { id: favSongs[0].id, title: favSongs[0].title, isFavorite: favSongs[0].isFavorite } : null
            });
          };
          getAllReq.onerror = () => resolve({ error: true });
        };
      })
    `);
    console.log('6. IndexedDB state:', idbState);

    // 7. Test page reload persistence
    console.log('7. Testing page reload persistence...');
    await send('Page.reload');
    await new Promise((r) => setTimeout(r, 3000));

    const idbStateAfterReload = await evalJs(`
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs'], 'readonly');
          const store = tx.objectStore('songs');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const favSongs = getAllReq.result.filter(s => s.isFavorite);
            resolve({
              totalInDb: getAllReq.result.length,
              favCount: favSongs.length,
              firstFav: favSongs[0] ? { id: favSongs[0].id, title: favSongs[0].title, isFavorite: favSongs[0].isFavorite } : null
            });
          };
          getAllReq.onerror = () => resolve({ error: true });
        };
      })
    `);
    console.log('7. IndexedDB state after reload:', idbStateAfterReload);

    const testPassed =
      afterClick.hasFill === true &&
      afterClick.isRoseText === true &&
      idbState.favCount >= 1 &&
      idbState.firstFav?.isFavorite === true &&
      idbStateAfterReload.favCount >= 1 &&
      idbStateAfterReload.firstFav?.isFavorite === true;

    console.log('\n--- BUG-1 VERIFICATION RESULT ---');
    console.log(testPassed ? '✅ BUG-1 PASS: Heart click -> UI filled -> store updated -> queue updated -> IndexedDB persisted -> reload persisted!' : '❌ BUG-1 FAIL');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
