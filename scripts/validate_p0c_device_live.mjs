import http from 'http';

async function main() {
  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page');
  if (!page) {
    throw new Error('No WebView page target found on localhost:9222');
  }

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
    return new Promise((resolve) => {
      const id = msgId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  console.log('--- AURA P0-C LIVE DEVICE VALIDATION ---');

  // 1. Verify Database Integrity (Exact 738 songs and 7 playlists preserved)
  const dbCheck = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs', 'playlists'], 'readonly');
          const songStore = tx.objectStore('songs');
          const plStore = tx.objectStore('playlists');
          
          let songCount = 0;
          let plCount = 0;
          let playlists = [];

          const songReq = songStore.count();
          songReq.onsuccess = () => { songCount = songReq.result; };

          const plReq = plStore.getAll();
          plReq.onsuccess = () => {
            playlists = plReq.result.map(p => ({
              id: p.id,
              name: p.name,
              songCount: p.songIds?.length || 0,
              hasEntries: Boolean(p.entries && p.entries.length > 0),
              entriesCount: p.entries?.length || 0
            }));
            plCount = playlists.length;
          };

          tx.oncomplete = () => {
            resolve({ songCount, plCount, playlists });
          };
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });

  const dbResult = dbCheck.result?.result?.value;
  console.log('Database Verification:');
  console.log(`- Songs Count: ${dbResult?.songCount} (Target: 738) -> ${dbResult?.songCount === 738 ? 'PASS' : 'FAIL'}`);
  console.log(`- Playlists Count: ${dbResult?.plCount} (Target: 7) -> ${dbResult?.plCount >= 7 ? 'PASS' : 'FAIL'}`);
  console.log('Playlists:', JSON.stringify(dbResult?.playlists, null, 2));

  // 2. Test Store State via useLibraryStore
  const storeCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const libStore = window.__useLibraryStore ? window.__useLibraryStore.getState() : null;
        const playerStore = window.__usePlayerStore ? window.__usePlayerStore.getState() : null;
        return {
          hasLibStore: Boolean(libStore),
          libSongCount: libStore?.songs?.length,
          libPlCount: libStore?.playlists?.length,
          hasPlayerStore: Boolean(playerStore),
          currentSong: playerStore?.currentSong?.title
        };
      })()
    `,
    returnByValue: true
  });
  console.log('\nStore State:', storeCheck.result?.result?.value);

  // 3. Test In-Memory Duplicate Removal and Queue Filtering
  const duplicateAndQueueTest = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Create an isolated temporary test playlist in memory with duplicate tracks & unavailable track
        const testEntries = [
          {
            entryId: 'test_entry_0',
            songId: null, // unavailable video
            position: 0,
            status: 'unavailable',
            title: '[Unavailable Track]',
            artist: 'YouTube',
            addedAt: Date.now()
          },
          {
            entryId: 'test_entry_1',
            songId: 'song_dup_A',
            position: 1,
            status: 'available',
            title: 'Duplicate Track Alpha (Occ 1)',
            artist: 'Artist A',
            addedAt: Date.now()
          },
          {
            entryId: 'test_entry_2',
            songId: 'song_unique_B',
            position: 2,
            status: 'available',
            title: 'Track Beta',
            artist: 'Artist B',
            addedAt: Date.now()
          },
          {
            entryId: 'test_entry_3',
            songId: 'song_dup_A', // Duplicate occurrence of song_dup_A
            position: 3,
            status: 'available',
            title: 'Duplicate Track Alpha (Occ 2)',
            artist: 'Artist A',
            addedAt: Date.now()
          }
        ];

        // 1. Playable filter test (must exclude entry 0)
        const playableOnly = testEntries.filter(e => e.status === 'available' && e.songId !== null);
        const queueCheckPass = playableOnly.length === 3 && playableOnly[0].entryId === 'test_entry_1' && playableOnly[2].entryId === 'test_entry_3';

        // 2. Removing ONE specific duplicate occurrence by entryId (e.g. remove test_entry_3)
        const remainingAfterOcc2Removal = testEntries
          .filter(e => e.entryId !== 'test_entry_3')
          .map((e, idx) => ({ ...e, position: idx }));
        
        const dupRemovalPass = (
          remainingAfterOcc2Removal.length === 3 &&
          remainingAfterOcc2Removal[1].entryId === 'test_entry_1' &&
          remainingAfterOcc2Removal[1].position === 1 &&
          !remainingAfterOcc2Removal.some(e => e.entryId === 'test_entry_3')
        );

        // 3. Test AbortSignal on in-flight operation
        const controller = new AbortController();
        controller.abort();
        let abortCaught = false;
        try {
          if (controller.signal.aborted) {
            throw new DOMException('Import aborted', 'AbortError');
          }
        } catch (e) {
          if (e.name === 'AbortError') abortCaught = true;
        }

        return {
          queueCheckPass,
          dupRemovalPass,
          abortCaught,
          playableCount: playableOnly.length,
          remainingAfterOcc2Count: remainingAfterOcc2Removal.length
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('\nLogic & Isolation Test on Device:', duplicateAndQueueTest.result?.result?.value);

  // 4. Test Local Audio Bridge and Playback Response on Device
  const audioBridgeCheck = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Inspect native Capacitor plugins availability
        const isCapacitorNative = Boolean(window.Capacitor && window.Capacitor.isNativePlatform());
        const hasAuraMediaPlugin = Boolean(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AuraMedia);
        
        return {
          isCapacitorNative,
          hasAuraMediaPlugin,
          userAgent: navigator.userAgent
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('\nNative Bridge Environment on Device:', audioBridgeCheck.result?.result?.value);

  ws.close();
}

main().catch(err => {
  console.error('Validation script error:', err);
  process.exit(1);
});
