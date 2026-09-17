import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9232;

async function run() {
  console.log('Testing BUG-3: Modal Stacking & Z-Index Layering...');
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${EDGE_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_modal_test',
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

    // 1. Open InbuiltPlaylistModal
    console.log('1. Opening Inbuilt Playlist Modal (Top 50)...');
    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.group'));
        const top50 = cards.find(c => c.innerText.includes('Top 50'));
        if (top50) top50.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    const step1 = await evalJs(`
      (() => {
        const modal = document.querySelector('div.fixed.inset-0.z-50');
        return {
          playlistModalOpen: !!modal,
          title: modal?.querySelector('h1')?.innerText
        };
      })()
    `);
    console.log('Step 1:', step1);

    // 2. Play a song inside InbuiltPlaylistModal
    console.log('2. Playing a track in playlist modal...');
    await evalJs(`
      (() => {
        const modal = document.querySelector('div.fixed.inset-0.z-50');
        const songRows = modal ? Array.from(modal.querySelectorAll('div.group')).filter(r => r.querySelector('h4')) : [];
        if (songRows[0]) songRows[0].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    // 3. Open NowPlayingModal while InbuiltPlaylistModal is open
    console.log('3. Opening NowPlayingModal via BottomPlayer title click...');
    const openedNP = await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-16, div.fixed.bottom-0');
        const h4 = bp?.querySelector('h4');
        if (h4) {
          h4.click();
          return true;
        }
        return false;
      })()
    `);
    console.log('BottomPlayer title clicked:', openedNP);
    await new Promise((r) => setTimeout(r, 1000));

    // 4. Verify z-index hierarchy
    const step4 = await evalJs(`
      (() => {
        const modals = Array.from(document.querySelectorAll('div.fixed.inset-0'));
        const nowPlayingModal = modals.find(m => m.className.includes('z-[60]'));
        const playlistModal = modals.find(m => m.className.includes('z-50'));
        return {
          nowPlayingOnTop: !!nowPlayingModal,
          playlistModalUnderneath: !!playlistModal,
          nowPlayingZ: nowPlayingModal ? window.getComputedStyle(nowPlayingModal).zIndex : null,
          playlistZ: playlistModal ? window.getComputedStyle(playlistModal).zIndex : null
        };
      })()
    `);
    console.log('Step 4 (Z-Index verification):', step4);

    // 5. Close NowPlayingModal via Close button
    console.log('5. Closing NowPlayingModal...');
    await evalJs(`
      (() => {
        const modals = Array.from(document.querySelectorAll('div.fixed.inset-0'));
        const npModal = modals.find(m => m.className.includes('z-[60]'));
        const closeBtn = npModal?.querySelector('button[title*="Close"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // 6. Verify NowPlayingModal is closed and InbuiltPlaylistModal is restored
    const step6 = await evalJs(`
      (() => {
        const modals = Array.from(document.querySelectorAll('div.fixed.inset-0'));
        const nowPlayingModal = modals.find(m => m.className.includes('z-[60]'));
        const playlistModal = modals.find(m => m.className.includes('z-50'));
        return {
          nowPlayingClosed: !nowPlayingModal,
          playlistModalStillOpen: !!playlistModal
        };
      })()
    `);
    console.log('Step 6 (After closing NowPlayingModal):', step6);

    // 7. Close InbuiltPlaylistModal
    console.log('7. Closing InbuiltPlaylistModal...');
    await evalJs(`
      (() => {
        const plModal = document.querySelector('div.fixed.inset-0.z-50');
        const closeBtn = plModal?.querySelector('button[title*="Close"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    const step7 = await evalJs(`
      (() => {
        const nowPlayingModal = document.querySelector('div.fixed.inset-0.z-\\\\[60\\\\]');
        const playlistModal = document.querySelector('div.fixed.inset-0.z-50');
        return {
          allModalsClosed: !nowPlayingModal && !playlistModal
        };
      })()
    `);
    console.log('Step 7 (Final state):', step7);

    const testPassed = step4.nowPlayingOnTop && step4.playlistModalUnderneath && step6.nowPlayingClosed && step6.playlistModalStillOpen && step7.allModalsClosed;
    console.log('\n--- BUG-3 VERIFICATION RESULT ---');
    console.log(testPassed ? '✅ BUG-3 PASS: Modal z-index layering and stacked open/close verified!' : '❌ BUG-3 FAIL');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
