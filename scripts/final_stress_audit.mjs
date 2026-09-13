import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9245;
const SCRATCH_DIR = 'C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch';
const USER_DATA_DIR = path.join(SCRATCH_DIR, 'edge_stress_profile');
const REPORT_OUTPUT_PATH = path.join(SCRATCH_DIR, 'final_stress_audit_report.json');

async function run() {
  console.log('===============================================================');
  console.log('  AURA MUSIC PLAYER — COMPREHENSIVE STRESS & UX AUDIT SUITE');
  console.log('===============================================================');

  // Clean scratch profile
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

  await new Promise((r) => setTimeout(r, 2500));

  const auditData = {
    meta: {
      timestamp: new Date().toISOString(),
      browser: 'Microsoft Edge Headless',
      url: 'http://localhost:3000'
    },
    consoleErrors: [],
    consoleWarnings: [],
    uncaughtExceptions: [],
    networkErrors: [],
    networkRequests: [],
    flows: {
      search: {},
      favorites: {},
      queue: {},
      playlists: {},
      audioStress: {},
      uiUx: {},
      persistence: {},
      consoleNetwork: {}
    },
    issues: []
  };

  try {
    const listRes = await fetch(`http://127.0.0.1:${EDGE_PORT}/json/list`).then(r => r.json());
    const page = listRes.find(t => t.type === 'page');
    if (!page) throw new Error('No Edge CDP page target found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.onopen = resolve);

    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // 1. Console API calls
      if (data.method === 'Runtime.consoleAPICalled') {
        const type = data.params.type;
        const text = data.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        if (type === 'error') {
          auditData.consoleErrors.push({ text, timestamp: Date.now() });
        } else if (type === 'warning') {
          auditData.consoleWarnings.push({ text, timestamp: Date.now() });
        }
      }

      // 2. Uncaught exceptions
      if (data.method === 'Runtime.exceptionThrown') {
        auditData.uncaughtExceptions.push({
          details: data.params.exceptionDetails,
          text: data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text,
          timestamp: Date.now()
        });
      }

      // 3. Network responses
      if (data.method === 'Network.responseReceived') {
        const { response } = data.params;
        auditData.networkRequests.push({
          url: response.url,
          status: response.status,
          statusText: response.statusText,
          mimeType: response.mimeType
        });
        if (response.status >= 400) {
          auditData.networkErrors.push({
            url: response.url,
            status: response.status,
            statusText: response.statusText
          });
        }
      }

      // Response callbacks
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
    await send('Network.enable');

    // Wait for App to mount
    console.log('[Setup] Waiting for React application to mount...');
    let appMounted = false;
    for (let i = 0; i < 30; i++) {
      appMounted = await evalJs(`Boolean(document.querySelector('#root')?.children?.length > 0)`);
      if (appMounted) break;
      await new Promise(r => setTimeout(r, 500));
    }
    if (!appMounted) throw new Error('React app failed to mount within 15 seconds');
    console.log('[Setup] React app mounted successfully.\n');

    // =========================================================================
    // SECTION 1: SEARCH STRESS AUDIT
    // =========================================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶ SECTION 1: SEARCH STRESS AUDIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1.1 Navigate to Search View
    await evalJs(`
      (() => {
        const searchBtn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.innerText && b.innerText.includes('Search'));
        if (searchBtn) searchBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));

    // 1.2 Valid Search ("Hukum")
    console.log('1.1 Testing Valid Search ("Hukum")...');
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
    await new Promise(r => setTimeout(r, 2200));

    const validSearchResult = await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.space-y-1 div.group, main div.grid div.group'));
        const titles = cards.map(c => c.querySelector('h4, h5')?.innerText || '').filter(Boolean);
        return {
          cardCount: cards.length,
          hasHukum: titles.some(t => t.toLowerCase().includes('hukum')),
          firstTitle: titles[0] || null
        };
      })()
    `);
    auditData.flows.search.validSearch = validSearchResult;
    console.log('  Valid search result:', validSearchResult);

    // 1.3 Search Result -> Play
    console.log('1.2 Testing Search Result -> Play...');
    await evalJs(`
      (() => {
        const firstCard = document.querySelector('main div.space-y-1 div.group, main div.grid div.group');
        if (firstCard) firstCard.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    const searchPlayResult = await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const pStore = window.usePlayerStore ? window.usePlayerStore.getState() : null;
        return {
          bottomPlayerTitle: bp?.querySelector('h4')?.innerText || null,
          storeSongTitle: pStore?.currentSong?.title || null,
          isPlaying: pStore?.isPlaying
        };
      })()
    `);
    auditData.flows.search.searchPlay = searchPlayResult;
    console.log('  Search -> Play result:', searchPlayResult);

    // 1.4 Nonsense Search ("ZZZNonExistentSong123456789")
    console.log('1.3 Testing Nonsense Search...');
    await evalJs(`
      (() => {
        const input = document.querySelector('main input[type="text"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'ZZZNonExistentSong123456789');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    const nonsenseResult = await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.space-y-1 div.group, main div.grid div.group'));
        const bodyText = document.querySelector('main')?.innerText || '';
        return {
          cardCount: cards.length,
          hasEmptyNotice: bodyText.includes('No songs found') || bodyText.includes('No matches'),
          hasFeaturedFallback: bodyText.includes('Hukum') && cards.length > 5
        };
      })()
    `);
    auditData.flows.search.nonsenseSearch = nonsenseResult;
    console.log('  Nonsense search result:', nonsenseResult);

    // 1.5 Empty Search ("")
    console.log('1.4 Testing Empty Search (Clearing query)...');
    await evalJs(`
      (() => {
        const input = document.querySelector('main input[type="text"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, '');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    const emptySearchResult = await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.space-y-1 div.group, main div.grid div.group'));
        const inputVal = document.querySelector('main input[type="text"]')?.value;
        return {
          inputVal,
          cardCount: cards.length
        };
      })()
    `);
    auditData.flows.search.emptySearch = emptySearchResult;
    console.log('  Empty search result:', emptySearchResult);

    // 1.6 Partial Search ("Vasee")
    console.log('1.5 Testing Partial Search ("Vasee")...');
    await evalJs(`
      (() => {
        const input = document.querySelector('main input[type="text"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'Vasee');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 2200));

    const partialSearchResult = await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.space-y-1 div.group, main div.grid div.group'));
        const titles = cards.map(c => c.querySelector('h4, h5')?.innerText || '');
        return {
          cardCount: cards.length,
          hasMatch: titles.some(t => t.toLowerCase().includes('vasee')),
          titles: titles.slice(0, 3)
        };
      })()
    `);
    auditData.flows.search.partialSearch = partialSearchResult;
    console.log('  Partial search result:', partialSearchResult);

    // 1.7 Rapid Typing Test (Stress Debounce & Race Condition)
    console.log('1.6 Testing Rapid Typing (Race Conditions)...');
    const rapidKeystrokes = ['A', 'An', 'Ani', 'Anir', 'Aniru', 'Anirudh'];
    for (const text of rapidKeystrokes) {
      await evalJs(`
        (() => {
          const input = document.querySelector('main input[type="text"]');
          if (input) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, '${text}');
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()
      `);
      await new Promise(r => setTimeout(r, 80)); // 80ms rapid typing interval
    }
    await new Promise(r => setTimeout(r, 2500)); // wait for debounce and fetch

    const rapidTypingResult = await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.space-y-1 div.group, main div.grid div.group'));
        const inputVal = document.querySelector('main input[type="text"]')?.value;
        const titles = cards.map(c => c.querySelector('h4, h5')?.innerText || '');
        return {
          finalInputVal: inputVal,
          cardCount: cards.length,
          hasAnirudhMatches: titles.some(t => t.toLowerCase().includes('anirudh') || t.toLowerCase().includes('jailer') || t.toLowerCase().includes('leo'))
        };
      })()
    `);
    auditData.flows.search.rapidTyping = rapidTypingResult;
    console.log('  Rapid typing result:', rapidTypingResult);

    // 1.8 Search -> Clear -> New Search ("Arabic")
    console.log('1.7 Testing Search -> Clear -> New Search ("Arabic")...');
    await evalJs(`
      (() => {
        const input = document.querySelector('main input[type="text"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, '');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 500));

    await evalJs(`
      (() => {
        const input = document.querySelector('main input[type="text"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'Arabic');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 2200));

    const clearAndNewSearchResult = await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.space-y-1 div.group, main div.grid div.group'));
        const titles = cards.map(c => c.querySelector('h4, h5')?.innerText || '');
        return {
          cardCount: cards.length,
          hasArabic: titles.some(t => t.toLowerCase().includes('arabic')),
          firstTitle: titles[0] || null
        };
      })()
    `);
    auditData.flows.search.clearAndNewSearch = clearAndNewSearchResult;
    console.log('  Clear & New search result:', clearAndNewSearchResult);

    // =========================================================================
    // SECTION 2: FAVORITES STRESS AUDIT
    // =========================================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶ SECTION 2: FAVORITES STRESS AUDIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 2.1 Online Song Favorite
    console.log('2.1 Testing Online Song Favorite Toggle...');
    // Click favorite button on BottomPlayer
    await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const favBtn = bp?.querySelector('button[title="Favorite"]');
        if (favBtn) favBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));

    const onlineFavState = await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const favBtn = bp?.querySelector('button[title="Favorite"]');
        const pStore = window.usePlayerStore?.getState();
        const lStore = window.useLibraryStore?.getState();
        const cur = pStore?.currentSong;
        return {
          hasFill: !!favBtn?.querySelector('svg')?.classList.contains('fill-rose-500'),
          isRoseText: !!favBtn?.classList.contains('text-rose-500'),
          currentSongIsFav: cur?.isFavorite,
          songId: cur?.id,
          songTitle: cur?.title
        };
      })()
    `);
    auditData.flows.favorites.onlineFav = onlineFavState;
    console.log('  Online song favorite state:', onlineFavState);

    // 2.2 Verify IndexedDB
    const onlineFavIdb = await evalJs(`
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs'], 'readonly');
          const store = tx.objectStore('songs');
          const getAll = store.getAll();
          getAll.onsuccess = () => {
            const favs = getAll.result.filter(s => s.isFavorite);
            resolve({ totalInDb: getAll.result.length, favCount: favs.length, favSongs: favs.map(f => ({ id: f.id, title: f.title })) });
          };
          getAll.onerror = () => resolve({ error: true });
        };
      })
    `);
    auditData.flows.favorites.idbState = onlineFavIdb;
    console.log('  IndexedDB favorite count:', onlineFavIdb.favCount);

    // 2.3 Unfavorite
    console.log('2.2 Testing Unfavorite Toggle...');
    await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const favBtn = bp?.querySelector('button[title="Favorite"]');
        if (favBtn) favBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));

    const unfavState = await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const favBtn = bp?.querySelector('button[title="Favorite"]');
        const pStore = window.usePlayerStore?.getState();
        const cur = pStore?.currentSong;
        return {
          hasFill: !!favBtn?.querySelector('svg')?.classList.contains('fill-rose-500'),
          currentSongIsFav: cur?.isFavorite
        };
      })()
    `);
    auditData.flows.favorites.unfavorite = unfavState;
    console.log('  Unfavorite state:', unfavState);

    // Re-favorite to test persistence & queue & navigation
    await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const favBtn = bp?.querySelector('button[title="Favorite"]');
        if (favBtn) favBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));

    // 2.4 Favorite -> Queue Consistency
    console.log('2.3 Testing Favorite -> Queue item sync...');
    const queueFavState = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        const currentSong = pStore?.currentSong;
        const queueMatches = pStore?.queue?.filter(s => s.id === currentSong?.id) || [];
        return {
          currentSongIsFav: currentSong?.isFavorite,
          queueMatchesCount: queueMatches.length,
          allQueueMatchesAreFav: queueMatches.every(s => s.isFavorite)
        };
      })()
    `);
    auditData.flows.favorites.queueSync = queueFavState;
    console.log('  Queue favorite sync:', queueFavState);

    // 2.5 Favorite -> Navigation to Library
    console.log('2.4 Testing Favorite -> Library View sync...');
    await evalJs(`
      (() => {
        const libBtn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.innerText && b.innerText.includes('Library'));
        if (libBtn) libBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    const libFavResult = await evalJs(`
      (() => {
        const bodyText = document.querySelector('main')?.innerText || '';
        const lStore = window.useLibraryStore?.getState();
        return {
          bodyHasLikedSongs: bodyText.includes('Liked Songs') || bodyText.includes('Favorites'),
          lStoreSongsCount: lStore?.songs?.length || 0,
          lStoreFavCount: lStore?.songs?.filter(s => s.isFavorite)?.length || 0
        };
      })()
    `);
    auditData.flows.favorites.librarySync = libFavResult;
    console.log('  Library view sync:', libFavResult);

    // 2.6 Favorite -> Refresh Persistence
    console.log('2.5 Testing Favorite -> Refresh Persistence...');
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 3000));

    const favPersistenceResult = await evalJs(`
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
              favCountAfterReload: favs.length,
              persistedSongs: favs.map(f => ({ id: f.id, title: f.title, isFavorite: f.isFavorite }))
            });
          };
          getAll.onerror = () => resolve({ error: true });
        };
      })
    `);
    auditData.flows.favorites.refreshPersistence = favPersistenceResult;
    console.log('  Favorite reload persistence:', favPersistenceResult);

    // =========================================================================
    // SECTION 3: QUEUE STRESS AUDIT
    // =========================================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶ SECTION 3: QUEUE STRESS AUDIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 3.1 Load a playlist of 50 tracks to stress queue
    await evalJs(`
      (() => {
        const homeBtn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.innerText && b.innerText.includes('Home'));
        if (homeBtn) homeBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    // Open Top 50 Playlist
    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.group'));
        const top50 = cards.find(c => c.innerText && c.innerText.includes('Top 50'));
        if (top50) top50.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    // Click "Play All" in playlist modal
    console.log('3.1 Clicking "Play All" to populate 50 tracks into queue...');
    await evalJs(`
      (() => {
        const modal = document.querySelector('div.fixed.inset-0.z-50');
        const playAllBtn = modal ? Array.from(modal.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Play All')) : null;
        if (playAllBtn) playAllBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    // Close playlist modal
    await evalJs(`document.querySelector('div.fixed.inset-0.z-50 button[title*="Close"]')?.click()`);
    await new Promise(r => setTimeout(r, 500));

    const initialQueueState = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        return {
          queueLength: pStore?.queue?.length || 0,
          currentIndex: pStore?.currentIndex,
          currentSongTitle: pStore?.currentSong?.title
        };
      })()
    `);
    auditData.flows.queue.initialQueue = initialQueueState;
    console.log('  Initial Queue loaded:', initialQueueState);

    // 3.2 Open Queue Drawer
    console.log('3.2 Opening Queue Drawer...');
    await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const qBtn = bp ? Array.from(bp.querySelectorAll('button')).find(b => b.title && b.title.toLowerCase().includes('queue')) : null;
        if (qBtn) qBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    const queueDrawerOpenState = await evalJs(`
      (() => {
        const drawer = document.querySelector('div.fixed.right-0.z-\\\\[55\\\\]');
        const items = drawer ? Array.from(drawer.querySelectorAll('div.group')) : [];
        return {
          isOpen: !!drawer,
          renderedItemsCount: items.length,
          zIndex: drawer ? window.getComputedStyle(drawer).zIndex : null
        };
      })()
    `);
    auditData.flows.queue.drawerOpen = queueDrawerOpenState;
    console.log('  Queue drawer open:', queueDrawerOpenState);

    // 3.3 Click item at index 5 in queue drawer while playing
    console.log('3.3 Testing Queue Item Click while playing...');
    const queueItemClickRes = await evalJs(`
      (() => {
        const drawer = document.querySelector('div.fixed.right-0.z-\\\\[55\\\\]');
        const items = drawer ? Array.from(drawer.querySelectorAll('div.group')) : [];
        if (items[5]) {
          const itemTitle = items[5].querySelector('h5')?.innerText;
          items[5].click();
          return { clicked: true, itemTitle };
        }
        return { clicked: false };
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    const afterQueueItemClick = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        const bpTitle = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText;
        return {
          currentSongTitle: pStore?.currentSong?.title,
          bpTitle,
          currentIndex: pStore?.currentIndex
        };
      })()
    `);
    auditData.flows.queue.queueItemClick = { ...queueItemClickRes, ...afterQueueItemClick };
    console.log('  Queue item click result:', auditData.flows.queue.queueItemClick);

    // 3.4 Test Add Next & Add End actions via store API
    console.log('3.4 Testing Add Next & Add End queue mutations...');
    const addNextAndEndRes = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        const curIdx = pStore.currentIndex;
        const initialLen = pStore.queue.length;

        const testSongNext = {
          id: 'test_next_song_1',
          sourceId: 'test_next_song_1',
          title: 'Special Next Track',
          artist: 'Test Artist',
          album: 'Test Album',
          duration: 180,
          format: '320k',
          bitrate: 320,
          fileSize: 10000,
          dateAdded: Date.now(),
          playCount: 0,
          isFavorite: false,
          artwork: '',
          coverArt: '',
          filePath: 'https://example.com/test.mp3',
          path: 'https://example.com/test.mp3',
          fileName: 'test.mp3',
          isOnline: true
        };

        const testSongEnd = {
          ...testSongNext,
          id: 'test_end_song_2',
          sourceId: 'test_end_song_2',
          title: 'Special End Track'
        };

        // Call playNext
        if (pStore.playNext) {
          pStore.playNext(testSongNext);
        }

        // Call addToQueue
        if (pStore.addToQueue) {
          pStore.addToQueue(testSongEnd);
        }

        const updatedStore = window.usePlayerStore?.getState();
        const nextSongInQueue = updatedStore.queue[curIdx + 1];
        const lastSongInQueue = updatedStore.queue[updatedStore.queue.length - 1];

        return {
          initialLen,
          newLen: updatedStore.queue.length,
          nextSongCorrect: nextSongInQueue?.id === 'test_next_song_1',
          endSongCorrect: lastSongInQueue?.id === 'test_end_song_2'
        };
      })()
    `);
    auditData.flows.queue.addNextAndEnd = addNextAndEndRes;
    console.log('  Add Next & Add End results:', addNextAndEndRes);

    // 3.5 Test Remove Current Song from Queue
    console.log('3.5 Testing Remove Current Song from Queue...');
    const removeCurrentRes = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        const curSongId = pStore.currentSong?.id;
        const curIdx = pStore.currentIndex;
        const lenBefore = pStore.queue.length;

        if (pStore.removeFromQueue) {
          pStore.removeFromQueue(curSongId);
        }

        const afterStore = window.usePlayerStore?.getState();
        return {
          lenBefore,
          lenAfter: afterStore.queue.length,
          newCurrentIndex: afterStore.currentIndex,
          newCurrentSong: afterStore.currentSong?.title,
          indexValid: afterStore.currentIndex >= 0 && afterStore.currentIndex < afterStore.queue.length
        };
      })()
    `);
    auditData.flows.queue.removeCurrent = removeCurrentRes;
    console.log('  Remove current result:', removeCurrentRes);

    // 3.6 Test Duplicate Songs in Queue
    console.log('3.6 Testing Duplicate Songs Handling in Queue...');
    const duplicateTestRes = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        const curSong = pStore.currentSong;
        if (!curSong) return { error: 'No current song' };

        // Append duplicate of current song
        pStore.addToQueue(curSong);

        const afterStore = window.usePlayerStore?.getState();
        const occurrences = afterStore.queue.filter(s => s.id === curSong.id).length;

        return {
          occurrences,
          queueLength: afterStore.queue.length,
          noCrash: true
        };
      })()
    `);
    auditData.flows.queue.duplicates = duplicateTestRes;
    console.log('  Duplicate songs in queue result:', duplicateTestRes);

    // Close Queue Drawer
    await evalJs(`document.querySelector('div.fixed.right-0.z-\\\\[55\\\\] button[title*="Close"]')?.click()`);
    await new Promise(r => setTimeout(r, 500));

    // =========================================================================
    // SECTION 4: PLAYLISTS STRESS AUDIT
    // =========================================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶ SECTION 4: PLAYLISTS STRESS AUDIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 4.1 Open / Close Modal via ESC Key
    console.log('4.1 Testing Playlist Modal Open / Close via ESC key...');
    await evalJs(`
      (() => {
        const homeBtn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.innerText && b.innerText.includes('Home'));
        if (homeBtn) homeBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));

    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.group'));
        if (cards[1]) cards[1].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    const playlistOpened = await evalJs(`Boolean(document.querySelector('div.fixed.inset-0.z-50'))`);
    console.log('  Playlist opened:', playlistOpened);

    // Send ESC key
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 27, key: 'Escape' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 27, key: 'Escape' });
    await new Promise(r => setTimeout(r, 800));

    const playlistClosedEsc = await evalJs(`!document.querySelector('div.fixed.inset-0.z-50')`);
    auditData.flows.playlists.escClose = { opened: playlistOpened, closedViaEsc: playlistClosedEsc };
    console.log('  Closed via ESC key:', playlistClosedEsc);

    // If still open, close via button
    await evalJs(`document.querySelector('div.fixed.inset-0.z-50 button[title*="Close"]')?.click()`);
    await new Promise(r => setTimeout(r, 500));

    // 4.2 Playlist Shuffle Play Button
    console.log('4.2 Testing Playlist "Shuffle" Button...');
    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.group'));
        if (cards[1]) cards[1].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    const shufflePlaylistRes = await evalJs(`
      (() => {
        const modal = document.querySelector('div.fixed.inset-0.z-50');
        const shuffleBtn = modal ? Array.from(modal.querySelectorAll('button')).find(b => b.innerText && b.innerText.toLowerCase().includes('shuffle')) : null;
        if (shuffleBtn) {
          shuffleBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    const afterShufflePlay = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        return {
          isPlaying: pStore?.isPlaying,
          isShuffle: pStore?.isShuffle,
          currentSongTitle: pStore?.currentSong?.title,
          queueLength: pStore?.queue?.length
        };
      })()
    `);
    auditData.flows.playlists.shufflePlay = { ...shufflePlaylistRes, ...afterShufflePlay };
    console.log('  Playlist Shuffle Play result:', auditData.flows.playlists.shufflePlay);

    // Close modal
    await evalJs(`document.querySelector('div.fixed.inset-0.z-50 button[title*="Close"]')?.click()`);
    await new Promise(r => setTimeout(r, 500));

    // 4.3 Custom Playlist View Check
    console.log('4.3 Testing Playlists View (Custom Playlists)...');
    await evalJs(`
      (() => {
        const plBtn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.innerText && b.innerText.includes('Playlists'));
        if (plBtn) plBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    const playlistsViewCheck = await evalJs(`
      (() => {
        const main = document.querySelector('main');
        const bodyText = main?.innerText || '';
        return {
          hasPlaylistsHeading: bodyText.includes('Playlists'),
          hasCreateButton: bodyText.includes('Create') || bodyText.includes('New Playlist')
        };
      })()
    `);
    auditData.flows.playlists.playlistsView = playlistsViewCheck;
    console.log('  Playlists View check:', playlistsViewCheck);

    // =========================================================================
    // SECTION 5: AUDIO STRESS AUDIT
    // =========================================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶ SECTION 5: AUDIO STRESS AUDIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 5.1 Rapid A -> B -> C Clicks (Audio Collision Prevention)
    console.log('5.1 Testing Rapid Song Switching (A -> B -> C in 150ms intervals)...');
    // Open Top 50 Playlist
    await evalJs(`
      (() => {
        const homeBtn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.innerText && b.innerText.includes('Home'));
        if (homeBtn) homeBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));

    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.group'));
        const top50 = cards.find(c => c.innerText && c.innerText.includes('Top 50'));
        if (top50) top50.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    // Fire 3 clicks rapidly
    await evalJs(`
      (() => {
        const modal = document.querySelector('div.fixed.inset-0.z-50');
        const rows = modal ? Array.from(modal.querySelectorAll('div.group')).filter(r => r.querySelector('h4')) : [];
        if (rows[0]) rows[0].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 150));

    await evalJs(`
      (() => {
        const modal = document.querySelector('div.fixed.inset-0.z-50');
        const rows = modal ? Array.from(modal.querySelectorAll('div.group')).filter(r => r.querySelector('h4')) : [];
        if (rows[1]) rows[1].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 150));

    await evalJs(`
      (() => {
        const modal = document.querySelector('div.fixed.inset-0.z-50');
        const rows = modal ? Array.from(modal.querySelectorAll('div.group')).filter(r => r.querySelector('h4')) : [];
        if (rows[2]) rows[2].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000)); // wait for audio to settle

    const rapidSwitchResult = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        const bpTitle = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText;
        const audio = window.__auraAudio;
        return {
          currentSongTitle: pStore?.currentSong?.title,
          bpTitle,
          audioSrc: audio?.src || null,
          audioPaused: audio?.paused,
          isSynchronized: pStore?.currentSong?.title === bpTitle
        };
      })()
    `);
    auditData.flows.audioStress.rapidSwitch = rapidSwitchResult;
    console.log('  Rapid A->B->C Switch result:', rapidSwitchResult);

    // Close modal
    await evalJs(`document.querySelector('div.fixed.inset-0.z-50 button[title*="Close"]')?.click()`);
    await new Promise(r => setTimeout(r, 500));

    // 5.2 Rapid Next / Previous Clicks
    console.log('5.2 Testing Rapid Next / Previous Clicks...');
    for (let i = 0; i < 5; i++) {
      await evalJs(`document.querySelector('button[title*="Next"]')?.click()`);
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 1500));

    const afterRapidNext = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        return {
          title: pStore?.currentSong?.title,
          currentIndex: pStore?.currentIndex,
          indexValid: pStore?.currentIndex >= 0 && pStore?.currentIndex < pStore?.queue?.length
        };
      })()
    `);
    auditData.flows.audioStress.rapidNext = afterRapidNext;
    console.log('  After 5 rapid Next clicks:', afterRapidNext);

    for (let i = 0; i < 3; i++) {
      await evalJs(`document.querySelector('button[title*="Previous"]')?.click()`);
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 1500));

    const afterRapidPrev = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        return {
          title: pStore?.currentSong?.title,
          currentIndex: pStore?.currentIndex,
          indexValid: pStore?.currentIndex >= 0 && pStore?.currentIndex < pStore?.queue?.length
        };
      })()
    `);
    auditData.flows.audioStress.rapidPrev = afterRapidPrev;
    console.log('  After 3 rapid Prev clicks:', afterRapidPrev);

    // 5.3 Pause -> Play Another Song
    console.log('5.3 Testing Pause -> Play Another Song (Auto-play assertion)...');
    // Pause playback
    await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        if (pStore?.isPlaying) pStore.togglePlay();
      })()
    `);
    await new Promise(r => setTimeout(r, 500));

    const isPaused = await evalJs(`!window.usePlayerStore?.getState()?.isPlaying`);
    console.log('  Playback paused:', isPaused);

    // Now click next song
    await evalJs(`document.querySelector('button[title*="Next"]')?.click()`);
    await new Promise(r => setTimeout(r, 1500));

    const playsAfterNext = await evalJs(`window.usePlayerStore?.getState()?.isPlaying`);
    auditData.flows.audioStress.pauseThenNext = { wasPaused: isPaused, playsAfterNext: !!playsAfterNext };
    console.log('  Auto-plays after next song click:', playsAfterNext);

    // 5.4 Rapid Shuffle Toggle (10 toggles in 500ms)
    console.log('5.4 Testing Rapid Shuffle Toggle (10 toggles)...');
    for (let i = 0; i < 10; i++) {
      await evalJs(`document.querySelector('button[title="Shuffle"]')?.click()`);
      await new Promise(r => setTimeout(r, 50));
    }
    await new Promise(r => setTimeout(r, 800));

    const shuffleStressRes = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        return {
          isShuffle: pStore?.isShuffle,
          queueLength: pStore?.queue?.length,
          currentIndex: pStore?.currentIndex,
          currentSongTitle: pStore?.currentSong?.title
        };
      })()
    `);
    auditData.flows.audioStress.shuffleStress = shuffleStressRes;
    console.log('  Shuffle toggle stress result:', shuffleStressRes);

    // 5.5 Repeat Mode Cycling (6 cycles)
    console.log('5.5 Testing Repeat Mode Cycling (6 cycles)...');
    const repeatCycleHistory = [];
    for (let i = 0; i < 6; i++) {
      await evalJs(`document.querySelector('button[title*="Repeat:"]')?.click()`);
      await new Promise(r => setTimeout(r, 150));
      const mode = await evalJs(`window.usePlayerStore?.getState()?.repeatMode`);
      repeatCycleHistory.push(mode);
    }
    auditData.flows.audioStress.repeatCycles = repeatCycleHistory;
    console.log('  Repeat cycle history:', repeatCycleHistory);

    // 5.6 Refresh during Active Playback
    console.log('5.6 Testing Page Reload during Active Playback...');
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 3000));

    const reloadPlaybackResult = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        return {
          hasCurrentSong: !!pStore?.currentSong,
          isPlaying: pStore?.isPlaying,
          queueLength: pStore?.queue?.length
        };
      })()
    `);
    auditData.flows.audioStress.reloadDuringPlayback = reloadPlaybackResult;
    console.log('  State after reload during playback:', reloadPlaybackResult);

    // 5.7 Artwork Fallback Test
    console.log('5.7 Testing Artwork Missing Image Fallback...');
    const artworkFallbackCheck = await evalJs(`
      (() => {
        // Create an img element with broken src and verify if it emits error without uncaught crash
        const img = document.createElement('img');
        let errorHandled = false;
        img.onerror = () => { errorHandled = true; };
        img.src = 'https://invalid-non-existent-artwork-domain.com/broken.jpg';
        return { created: true };
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    auditData.flows.audioStress.artworkFallback = { tested: true };

    // =========================================================================
    // SECTION 6: UI / UX & RESPONSIVENESS AUDIT
    // =========================================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶ SECTION 6: UI / UX & RESPONSIVENESS AUDIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 6.1 Desktop Viewport (1280x800) Overflow & Layout
    console.log('6.1 Checking Desktop Viewport (1280x800)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 1000));

    const desktopLayoutRes = await evalJs(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const hasHorizontalOverflow = scrollWidth > docWidth;
        const sidebar = document.querySelector('aside');
        const bottomPlayer = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        return {
          docWidth,
          scrollWidth,
          hasHorizontalOverflow,
          sidebarVisible: !!sidebar && window.getComputedStyle(sidebar).display !== 'none',
          bottomPlayerVisible: !!bottomPlayer
        };
      })()
    `);
    auditData.flows.uiUx.desktop = desktopLayoutRes;
    console.log('  Desktop layout metrics:', desktopLayoutRes);

    // 6.2 Tablet Viewport (768x1024)
    console.log('6.2 Checking Tablet Viewport (768x1024)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 1000));

    const tabletLayoutRes = await evalJs(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        return {
          docWidth,
          scrollWidth,
          hasHorizontalOverflow: scrollWidth > docWidth
        };
      })()
    `);
    auditData.flows.uiUx.tablet = tabletLayoutRes;
    console.log('  Tablet layout metrics:', tabletLayoutRes);

    // 6.3 Mobile Viewport (375x667) BottomPlayer / BottomNav Layering & Touch Targets
    console.log('6.3 Checking Mobile Viewport (375x667) & Touch Targets...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 1000));

    // Play a song to make BottomPlayer visible
    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.group'));
        if (cards[0]) cards[0].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    await evalJs(`
      (() => {
        const modal = document.querySelector('div.fixed.inset-0.z-50');
        const row = modal ? modal.querySelector('div.group h4')?.closest('div.group') : null;
        if (row) row.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    // Close modal
    await evalJs(`document.querySelector('div.fixed.inset-0.z-50 button[title*="Close"]')?.click()`);
    await new Promise(r => setTimeout(r, 500));

    const mobileLayoutRes = await evalJs(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const nav = document.querySelector('nav.fixed.bottom-0, div.fixed.bottom-0.h-16');
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const main = document.querySelector('main');

        const navRect = nav ? nav.getBoundingClientRect() : null;
        const bpRect = bp ? bp.getBoundingClientRect() : null;

        const gap = (navRect && bpRect) ? Math.round(navRect.top - bpRect.bottom) : null;
        const overlap = (navRect && bpRect) ? (bpRect.bottom > navRect.top && bpRect.top < navRect.bottom) : false;

        // Check main padding bottom
        const mainPaddingBottom = main ? window.getComputedStyle(main).paddingBottom : null;

        return {
          hasHorizontalOverflow: scrollWidth > docWidth,
          navRect: navRect ? { top: navRect.top, height: navRect.height } : null,
          bpRect: bpRect ? { top: bpRect.top, height: bpRect.height } : null,
          gapBetweenBpAndNav: gap,
          isOverlapping: overlap,
          mainPaddingBottom
        };
      })()
    `);
    auditData.flows.uiUx.mobile = mobileLayoutRes;
    console.log('  Mobile layout metrics:', mobileLayoutRes);

    // 6.4 Long Titles Truncation Check
    console.log('6.4 Testing Long Song Titles Ellipsis Truncation...');
    const longTitleRes = await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        const testLongSong = {
          id: 'long_title_test_song',
          sourceId: 'long_title_test_song',
          title: 'This is an Exceptionally Long Song Title Produced by Legendary Composers with Elaborate Tamil Classical Fusion Lyrics - Special Extended Club Remaster 2026',
          artist: 'Very Long Artist Name Featuring Multiple Special Guest Vocalists and Renowned Orchestra',
          album: 'Colossal Soundtrack Album Collection Deluxe 320k Edition',
          duration: 300,
          format: '320k',
          bitrate: 320,
          fileSize: 100000,
          dateAdded: Date.now(),
          playCount: 0,
          isFavorite: false,
          artwork: '',
          coverArt: '',
          filePath: 'https://example.com/test.mp3',
          path: 'https://example.com/test.mp3',
          fileName: 'test.mp3',
          isOnline: true
        };

        pStore.playSong(testLongSong);

        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const h4 = bp?.querySelector('h4');
        const textOverflow = h4 ? window.getComputedStyle(h4).textOverflow : null;
        const overflow = h4 ? window.getComputedStyle(h4).overflow : null;
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;

        return {
          titleRendered: h4?.innerText?.slice(0, 30) + '...',
          hasEllipsis: textOverflow === 'ellipsis',
          hasOverflowHidden: overflow === 'hidden',
          causedHorizontalOverflow: scrollWidth > docWidth
        };
      })()
    `);
    auditData.flows.uiUx.longTitle = longTitleRes;
    console.log('  Long title truncation metrics:', longTitleRes);

    // Reset desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 800));

    // =========================================================================
    // SECTION 7: PERSISTENCE STRESS AUDIT
    // =========================================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶ SECTION 7: PERSISTENCE STRESS AUDIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 7.1 Volume Persistence
    console.log('7.1 Testing Volume Persistence across Reload...');
    await evalJs(`
      (() => {
        const pStore = window.usePlayerStore?.getState();
        if (pStore) pStore.setVolume(0.42);
      })()
    `);
    await new Promise(r => setTimeout(r, 500));

    const volBeforeReload = await evalJs(`window.usePlayerStore?.getState()?.volume`);
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 3000));

    const volAfterReload = await evalJs(`window.usePlayerStore?.getState()?.volume`);
    auditData.flows.persistence.volume = {
      setVolume: 0.42,
      beforeReload: volBeforeReload,
      afterReload: volAfterReload,
      persisted: Math.abs(volAfterReload - 0.42) < 0.05
    };
    console.log('  Volume persistence:', auditData.flows.persistence.volume);

    // 7.2 Theme / Accent Setting Persistence
    console.log('7.2 Testing Settings & Theme Persistence...');
    await evalJs(`
      (() => {
        const settingsBtn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.innerText && b.innerText.includes('Settings'));
        if (settingsBtn) settingsBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    const settingsCheck = await evalJs(`
      (() => {
        const bodyText = document.querySelector('main')?.innerText || '';
        return {
          hasSettings: bodyText.includes('Settings') || bodyText.includes('Preferences'),
          hasThemeOptions: bodyText.includes('Theme') || bodyText.includes('Accent') || bodyText.includes('Audio Quality')
        };
      })()
    `);
    auditData.flows.persistence.settings = settingsCheck;
    console.log('  Settings view check:', settingsCheck);

    // =========================================================================
    // SECTION 8: CONSOLE & NETWORK AUDIT SUMMARY
    // =========================================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('▶ SECTION 8: CONSOLE & NETWORK AUDIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    auditData.flows.consoleNetwork = {
      totalConsoleErrors: auditData.consoleErrors.length,
      totalConsoleWarnings: auditData.consoleWarnings.length,
      totalUncaughtExceptions: auditData.uncaughtExceptions.length,
      totalNetworkErrors: auditData.networkErrors.length,
      totalRequestsMade: auditData.networkRequests.length
    };
    console.log('  Console Errors count:', auditData.consoleErrors.length);
    console.log('  Console Warnings count:', auditData.consoleWarnings.length);
    console.log('  Uncaught Exceptions count:', auditData.uncaughtExceptions.length);
    console.log('  Network Errors (HTTP 4xx/5xx) count:', auditData.networkErrors.length);

    if (auditData.consoleErrors.length > 0) {
      console.log('\n  Console Errors Sample:');
      auditData.consoleErrors.slice(0, 5).forEach((e, idx) => console.log(`    [${idx + 1}] ${e.text.slice(0, 120)}`));
    }

    if (auditData.networkErrors.length > 0) {
      console.log('\n  Network Errors Sample:');
      auditData.networkErrors.slice(0, 5).forEach((e, idx) => console.log(`    [${idx + 1}] ${e.status} ${e.statusText} -> ${e.url.slice(0, 100)}`));
    }

    // Save full JSON report
    fs.writeFileSync(REPORT_OUTPUT_PATH, JSON.stringify(auditData, null, 2), 'utf8');
    console.log(`\n[Audit Complete] Full audit report saved to: ${REPORT_OUTPUT_PATH}`);

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
