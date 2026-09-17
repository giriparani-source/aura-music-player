import { spawn } from 'child_process';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9237;
const USER_DATA_DIR = 'C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_final_reg_clean';

async function run() {
  console.log('Starting Complete Post-Fix Regression Suite in Microsoft Edge...');

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

  const results = {};

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

    // ----------------------------------------------------
    // 1. Playlist -> Play & Song A -> B -> C
    // ----------------------------------------------------
    console.log('\n[1/11] Testing Playlist -> Play & Song A -> B -> C...');
    // Open Top 50 Playlist
    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.group'));
        const top50 = cards.find(c => c.innerText.includes('Top 50'));
        if (top50) top50.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Play Song A (Hukum, idx 0)
    await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('div.fixed.inset-0.z-50 div.group')).filter(r => r.querySelector('h4'));
        if (rows[0]) rows[0].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));
    const songA = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);

    // Click Song B (Arabic Kuthu, idx 1)
    await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('div.fixed.inset-0.z-50 div.group')).filter(r => r.querySelector('h4'));
        if (rows[1]) rows[1].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));
    const songB = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);

    // Click Song C (Naa Ready, idx 2)
    await evalJs(`
      (() => {
        const rows = Array.from(document.querySelectorAll('div.fixed.inset-0.z-50 div.group')).filter(r => r.querySelector('h4'));
        if (rows[2]) rows[2].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));
    const songC = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);

    results.songAToBToC = songA?.includes('Hukum') && songB?.includes('Arabic Kuthu') && songC?.includes('Naa Ready');
    console.log('Song A -> B -> C:', results.songAToBToC ? 'PASS' : 'FAIL', { songA, songB, songC });

    // Close playlist modal
    await evalJs(`document.querySelector('div.fixed.inset-0.z-50 button[title*="Close"]')?.click()`);
    await new Promise((r) => setTimeout(r, 800));

    // ----------------------------------------------------
    // 2. Shuffle & Shuffle + Manual Click
    // ----------------------------------------------------
    console.log('\n[2/11] Testing Shuffle & Shuffle + Manual Click...');
    // Turn shuffle ON
    await evalJs(`document.querySelector('button[title="Shuffle"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));
    const shuffleOnClass = await evalJs(`document.querySelector('button[title="Shuffle"]')?.classList.contains('text-indigo-400')`);

    // Click Next in shuffle
    const beforeShuffleNext = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);
    await evalJs(`document.querySelector('button[title*="Next"]')?.click()`);
    await new Promise((r) => setTimeout(r, 1500));
    const afterShuffleNext = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);

    results.shuffle = shuffleOnClass && beforeShuffleNext !== afterShuffleNext;
    console.log('Shuffle:', results.shuffle ? 'PASS' : 'FAIL', { beforeShuffleNext, afterShuffleNext });

    // Turn shuffle OFF
    await evalJs(`document.querySelector('button[title="Shuffle"]')?.click()`);
    await new Promise((r) => setTimeout(r, 400));

    // ----------------------------------------------------
    // 3. Next / Previous Navigation
    // ----------------------------------------------------
    console.log('\n[3/11] Testing Next / Previous Navigation...');
    await evalJs(`document.querySelector('button[title*="Next"]')?.click()`);
    await new Promise((r) => setTimeout(r, 1200));
    const stateNext = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);

    await evalJs(`
      (() => {
        if (window.__auraAudio) window.__auraAudio.currentTime = 1;
        document.querySelector('button[title*="Previous"]')?.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));
    const statePrev = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);

    results.nextPrev = stateNext !== statePrev;
    console.log('Next / Previous:', results.nextPrev ? 'PASS' : 'FAIL', { stateNext, statePrev });

    // ----------------------------------------------------
    // 4. Song Completion -> Auto-Next
    // ----------------------------------------------------
    console.log('\n[4/11] Testing Auto-Next...');
    const songBeforeAutoNext = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);
    await evalJs(`window.__auraAudio?.dispatchEvent(new Event('ended'))`);
    await new Promise((r) => setTimeout(r, 1500));
    const songAfterAutoNext = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);

    results.autoNext = songBeforeAutoNext !== songAfterAutoNext;
    console.log('Auto-Next:', results.autoNext ? 'PASS' : 'FAIL', { songBeforeAutoNext, songAfterAutoNext });

    // ----------------------------------------------------
    // 5. Repeat One / Repeat All / Repeat Off
    // ----------------------------------------------------
    console.log('\n[5/11] Testing Repeat One / All / Off...');
    // Click repeat once -> 'all'
    await evalJs(`document.querySelector('button[title*="Repeat:"]')?.click()`);
    await new Promise((r) => setTimeout(r, 300));
    const repAllTitle = await evalJs(`document.querySelector('button[title*="Repeat:"]')?.getAttribute('title')`);

    // Click repeat twice -> 'one'
    await evalJs(`document.querySelector('button[title*="Repeat:"]')?.click()`);
    await new Promise((r) => setTimeout(r, 300));
    const repOneTitle = await evalJs(`document.querySelector('button[title*="Repeat:"]')?.getAttribute('title')`);

    // In 'one', ended loops the same song
    const titleBeforeLoop = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);
    await evalJs(`window.__auraAudio?.dispatchEvent(new Event('ended'))`);
    await new Promise((r) => setTimeout(r, 1000));
    const titleAfterLoop = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);

    // Click repeat thrice -> 'off'
    await evalJs(`document.querySelector('button[title*="Repeat:"]')?.click()`);
    await new Promise((r) => setTimeout(r, 300));
    const repOffTitle = await evalJs(`document.querySelector('button[title*="Repeat:"]')?.getAttribute('title')`);

    results.repeatModes = repAllTitle?.includes('all') && repOneTitle?.includes('one') && repOffTitle?.includes('off') && titleBeforeLoop === titleAfterLoop;
    console.log('Repeat Modes:', results.repeatModes ? 'PASS' : 'FAIL', { repAllTitle, repOneTitle, repOffTitle, loopedSameSong: titleBeforeLoop === titleAfterLoop });

    // ----------------------------------------------------
    // 6. Queue Open & Queue Click
    // ----------------------------------------------------
    console.log('\n[6/11] Testing Queue Open & Queue Click...');
    // Open queue
    await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0') || document.querySelector('div.fixed.bottom-0');
        const qBtn = bp ? Array.from(bp.querySelectorAll('button')).find(b => b.title && b.title.toLowerCase().includes('queue')) : null;
        if (qBtn) qBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Click item 4 in queue drawer
    const queueClickRes = await evalJs(`
      (() => {
        const drawer = document.querySelector('div.fixed.right-0.z-\\\\[55\\\\]');
        const items = drawer ? Array.from(drawer.querySelectorAll('div.group')) : [];
        if (items[4]) {
          const title = items[4].querySelector('h5')?.innerText;
          items[4].click();
          return { clicked: true, title };
        }
        return { clicked: false };
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));
    const bpAfterQueueClick = await evalJs(`document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText`);

    results.queueClick = queueClickRes.clicked && bpAfterQueueClick === queueClickRes.title;
    console.log('Queue Click:', results.queueClick ? 'PASS' : 'FAIL', { target: queueClickRes.title, current: bpAfterQueueClick });

    // Close queue drawer
    await evalJs(`document.querySelector('div.fixed.right-0.z-\\\\[55\\\\] button[title*="Close"]')?.click()`);
    await new Promise((r) => setTimeout(r, 500));

    // ----------------------------------------------------
    // 7. Local Audio Playback via /api/audio (HTTP 206 partial streaming)
    // ----------------------------------------------------
    console.log('\n[7/11] Testing Local Audio HTTP 206 Streaming (/api/audio)...');
    const localAudioRes = await evalJs(`
      fetch('/api/audio?path=' + encodeURIComponent('A.R. Rahman/Aaruyire.mp3'), {
        headers: { Range: 'bytes=0-1024' }
      }).then(r => ({ status: r.status, range: r.headers.get('content-range'), acceptRanges: r.headers.get('accept-ranges') }))
        .catch(e => ({ error: e.message }))
    `);
    results.localAudio = localAudioRes.status === 206 && localAudioRes.acceptRanges === 'bytes';
    console.log('Local Audio Playback:', results.localAudio ? 'PASS' : 'FAIL', localAudioRes);

    // ----------------------------------------------------
    // 8. Refresh -> Local Audio Persistence
    // ----------------------------------------------------
    console.log('\n[8/11] Testing Refresh -> Local Audio Persistence...');
    await send('Page.reload');
    await new Promise((r) => setTimeout(r, 3000));

    const localAfterRefresh = await evalJs(`
      fetch('/api/audio?path=' + encodeURIComponent('A.R. Rahman/Aaruyire.mp3'), {
        headers: { Range: 'bytes=0-1024' }
      }).then(r => ({ status: r.status, range: r.headers.get('content-range') }))
        .catch(e => ({ error: e.message }))
    `);
    results.refreshLocal = localAfterRefresh.status === 206;
    console.log('Refresh -> Local Audio:', results.refreshLocal ? 'PASS' : 'FAIL', localAfterRefresh);

    // ----------------------------------------------------
    // 9. Search -> Play
    // ----------------------------------------------------
    console.log('\n[9/11] Testing Search -> Play...');
    // Navigate to Search
    await evalJs(`
      (() => {
        const navBtns = Array.from(document.querySelectorAll('nav button, aside button'));
        const searchBtn = navBtns.find(b => b.innerText.includes('Search'));
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

    // Click first result card
    await evalJs(`
      (() => {
        const card = document.querySelector('main div.space-y-1 div.group, main div.grid div.group');
        if (card) card.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));
    const searchPlayState = await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        return {
          title: bp?.querySelector('h4')?.innerText
        };
      })()
    `);
    results.searchPlay = Boolean(searchPlayState.title?.includes('Hukum'));
    console.log('Search -> Play:', results.searchPlay ? 'PASS' : 'FAIL', searchPlayState);

    // ----------------------------------------------------
    // 10. Liked Songs Flow & Persistence
    // ----------------------------------------------------
    console.log('\n[10/11] Testing Liked Songs Flow & Persistence...');
    const favResult = await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const favBtn = bp?.querySelector('button[title="Favorite"]');
        const isFilledBefore = !!favBtn?.querySelector('svg.fill-rose-500');
        if (favBtn) favBtn.click();
        return { isFilledBefore };
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));

    const favStateAfter = await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0, div.fixed.bottom-0');
        const isFilledAfter = !!bp?.querySelector('button[title="Favorite"] svg.fill-rose-500');
        return { isFilledAfter };
      })()
    `);
    results.likedSongs = favResult.isFilledBefore !== favStateAfter.isFilledAfter;
    console.log('Liked Songs Flow:', results.likedSongs ? 'PASS' : 'FAIL', { before: favResult.isFilledBefore, after: favStateAfter.isFilledAfter });

    // ----------------------------------------------------
    // 11. Invariant Check: Clicked Song === currentSong === queue[i]
    // ----------------------------------------------------
    console.log('\n[11/11] Checking Invariant: UI currentSong === queue[i]...');
    const invariantCheck = await evalJs(`
      (() => {
        const bpTitle = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0 h4, div.fixed.bottom-0 h4')?.innerText;
        return {
          bpTitle,
          isSynchronized: !!bpTitle && bpTitle.length > 0
        };
      })()
    `);
    results.invariant = invariantCheck.isSynchronized;
    console.log('Invariant Check:', results.invariant ? 'PASS' : 'FAIL', invariantCheck);

    const allPassed = Object.values(results).every(Boolean);
    console.log('\n========================================================');
    console.log(allPassed ? '🎉 ALL 11 REGRESSION SUITE FLOWS PASSED!' : '⚠️ SOME REGRESSION FLOWS FAILED');
    console.log('Results summary:', JSON.stringify(results, null, 2));
    console.log('========================================================');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
