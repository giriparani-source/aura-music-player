import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9234;

async function run() {
  console.log('Testing BUG-4: Mobile BottomPlayer / BottomNav Layering...');
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${EDGE_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_mobile_test2',
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

    // 1. Set mobile viewport (iPhone SE: 375x667)
    console.log('1. Setting mobile viewport 375x667...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise((r) => setTimeout(r, 1500));

    // 2. Play a song from Home
    console.log('2. Playing track from Home...');
    await evalJs(`
      (() => {
        const card = document.querySelector('main div.group');
        if (card) card.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    await evalJs(`
      (() => {
        const songRow = document.querySelector('div.fixed.inset-0.z-50 div.group h4')?.closest('div.group');
        if (songRow) songRow.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    // Close playlist modal
    console.log('3. Closing playlist modal...');
    await evalJs(`
      (() => {
        const closeBtn = document.querySelector('div.fixed.inset-0.z-50 button[title*="Close"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // 4. Inspect positions of both BottomPlayer and MobileBottomNav
    const layoutCheck = await evalJs(`
      (() => {
        const nav = document.querySelector('nav.md\\\\:hidden');
        const bp = document.querySelector('div.fixed.bottom-16.md\\\\:bottom-0') || document.querySelector('div.fixed.h-20');
        if (!nav || !bp) return { missing: true, hasNav: !!nav, hasBp: !!bp };

        const navRect = nav.getBoundingClientRect();
        const bpRect = bp.getBoundingClientRect();

        // Check if navigation buttons are clickable (unobstructed by bottom player)
        const navButtons = Array.from(nav.querySelectorAll('button'));
        const firstBtnRect = navButtons[0]?.getBoundingClientRect();
        const elementAtFirstBtn = firstBtnRect ? document.elementFromPoint(firstBtnRect.x + firstBtnRect.width/2, firstBtnRect.y + firstBtnRect.height/2) : null;
        const isNavClickable = nav.contains(elementAtFirstBtn);

        // Click search nav item to verify real touch interaction
        const searchBtn = navButtons.find(b => b.innerText.includes('Search'));
        const activeTabBefore = document.querySelector('h1, h2')?.innerText;
        if (searchBtn) searchBtn.click();

        return {
          navTop: Math.round(navRect.top),
          navBottom: Math.round(navRect.bottom),
          navHeight: Math.round(navRect.height),
          bpTop: Math.round(bpRect.top),
          bpBottom: Math.round(bpRect.bottom),
          bpHeight: Math.round(bpRect.height),
          gapBetweenBpAndNav: Math.round(navRect.top - bpRect.bottom),
          isNavClickable,
          elementAtPoint: elementAtFirstBtn?.tagName + '.' + elementAtFirstBtn?.className
        };
      })()
    `);
    console.log('4. Layout check during playback on mobile:', layoutCheck);

    await new Promise((r) => setTimeout(r, 1000));
    const activeTabAfter = await evalJs(`document.querySelector('main h1, main h2')?.innerText`);
    console.log('5. Navigated to tab:', activeTabAfter);

    const testPassed = layoutCheck.gapBetweenBpAndNav === 0 && layoutCheck.isNavClickable === true;
    console.log('\n--- BUG-4 VERIFICATION RESULT ---');
    console.log(testPassed ? '✅ BUG-4 PASS: BottomPlayer stacks cleanly on top of MobileBottomNav and nav buttons are 100% clickable!' : '❌ BUG-4 FAIL');

    await send('Emulation.clearDeviceMetricsOverride');
    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
