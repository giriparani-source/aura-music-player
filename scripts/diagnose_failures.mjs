import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9224;

async function run() {
  console.log('Starting Edge for diagnostics on port ' + EDGE_PORT);
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${EDGE_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_diag_profile',
    'http://localhost:3000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const listRes = await fetch(`http://127.0.0.1:${EDGE_PORT}/json/list`).then(r => r.json());
    const page = listRes.find(t => t.type === 'page');
    if (!page) throw new Error('No page target found');

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
      const res = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      return res.result?.result?.value;
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    console.log('Connected to Edge. Waiting for page load...');
    await new Promise((r) => setTimeout(r, 2000));

    // Test 1: Flow 23 - Liked/Favorite toggle
    console.log('\n--- DIAGNOSTIC 1: Liked/Favorite ---');
    const diagFav = await evalJs(`
      (() => {
        const bp = document.querySelector('.fixed.bottom-0');
        const favBtn = bp ? bp.querySelector('button[title="Favorite"], button[title*="fav"], button[title*="Fav"]') : null;
        const allBpBtns = bp ? Array.from(bp.querySelectorAll('button')).map(b => ({ title: b.title, class: b.className })) : [];
        return { hasBp: !!bp, hasFavBtn: !!favBtn, allBpBtns };
      })()
    `);
    console.log('Diag Fav:', JSON.stringify(diagFav, null, 2));

    // Test 2: Flow 27 - Empty Search
    console.log('\n--- DIAGNOSTIC 2: Empty Search UI ---');
    await evalJs(`
      (() => {
        const navBtns = Array.from(document.querySelectorAll('nav button, aside button'));
        const searchBtn = navBtns.find(b => b.innerText.includes('Search'));
        if (searchBtn) searchBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    await evalJs(`
      (() => {
        const input = document.querySelector('input[type="text"]');
        if (input) {
          input.value = 'ZZZXYZAuraNonExistentSong12345';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    const diagSearchText = await evalJs(`
      (() => {
        const main = document.querySelector('main');
        return {
          mainText: main ? main.innerText.slice(0, 300) : null,
          cardsCount: document.querySelectorAll('main div.group').length
        };
      })()
    `);
    console.log('Search results:', diagSearchText);

    // Test 3: Flow 13 - Queue song click
    console.log('\n--- DIAGNOSTIC 3: Queue song click ---');
    await evalJs(`
      (() => {
        const homeBtn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.innerText.includes('Home'));
        if (homeBtn) homeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Click Top 50 playlist
    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('div.group.p-3.rounded-2xl'));
        if (cards.length > 0) cards[0].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Click track 1
    await evalJs(`document.querySelectorAll('.fixed.inset-0 div.group.flex.items-center.justify-between')[0]?.click()`);
    await new Promise((r) => setTimeout(r, 1500));

    // Close modal
    await evalJs(`
      (() => {
        const closeBtn = document.querySelector('.fixed.inset-0 button[title*="Close"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Open queue
    await evalJs(`
      (() => {
        const bp = document.querySelector('.fixed.bottom-0');
        const qBtn = bp ? Array.from(bp.querySelectorAll('button')).find(b => b.title && b.title.toLowerCase().includes('queue')) : null;
        if (qBtn) qBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 800));

    const queueDiag = await evalJs(`
      (() => {
        const drawer = document.querySelector('div.fixed.right-0');
        const items = drawer ? Array.from(drawer.querySelectorAll('div.group.flex.items-center.gap-3')) : [];
        return {
          hasDrawer: !!drawer,
          itemsCount: items.length,
          itemTitles: items.slice(0, 5).map(it => it.querySelector('h5')?.innerText)
        };
      })()
    `);
    console.log('Queue Diag:', queueDiag);

    // Click item 2 in queue drawer
    const clickRes = await evalJs(`
      (() => {
        const drawer = document.querySelector('div.fixed.right-0');
        const items = drawer ? Array.from(drawer.querySelectorAll('div.group.flex.items-center.gap-3')) : [];
        if (items[2]) {
          const titleBefore = items[2].querySelector('h5')?.innerText;
          items[2].click();
          return { clicked: true, titleBefore };
        }
        return { clicked: false };
      })()
    `);
    console.log('Clicked queue item:', clickRes);
    await new Promise((r) => setTimeout(r, 1500));

    const stateAfterQueueClick = await evalJs(`
      (() => {
        const bp = document.querySelector('.fixed.bottom-0');
        return {
          title: bp?.querySelector('h4')?.innerText
        };
      })()
    `);
    console.log('Player state after queue click:', stateAfterQueueClick);

    // Test 4: Flow 34 - Pause -> click another song
    console.log('\n--- DIAGNOSTIC 4: Pause -> click another song ---');
    await evalJs(`
      (() => {
        const bp = document.querySelector('.fixed.bottom-0');
        const ppBtn = bp ? bp.querySelector('button.p-2.5.rounded-full.bg-white') : null;
        if (ppBtn) ppBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Click another song in queue
    await evalJs(`
      (() => {
        const drawer = document.querySelector('div.fixed.right-0');
        const items = drawer ? Array.from(drawer.querySelectorAll('div.group.flex.items-center.gap-3')) : [];
        if (items[4]) items[4].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    const stateAfterPauseSongClick = await evalJs(`
      (() => {
        const bp = document.querySelector('.fixed.bottom-0');
        const isPaused = bp ? !bp.querySelector('button.p-2.5.rounded-full.bg-white svg.lucide-pause') : true;
        return {
          title: bp?.querySelector('h4')?.innerText,
          isPaused
        };
      })()
    `);
    console.log('State after clicking another song while paused:', stateAfterPauseSongClick);

    // Test 5: Flow 36 - Modal open -> close
    console.log('\n--- DIAGNOSTIC 5: Modal open -> close ---');
    await evalJs(`
      (() => {
        const bp = document.querySelector('.fixed.bottom-0');
        const titleH4 = bp?.querySelector('h4');
        if (titleH4) titleH4.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    const modalState = await evalJs(`
      (() => {
        const allModals = Array.from(document.querySelectorAll('div.fixed.inset-0'));
        return {
          modalsCount: allModals.length,
          classes: allModals.map(m => m.className)
        };
      })()
    `);
    console.log('Modal state after click:', modalState);

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
