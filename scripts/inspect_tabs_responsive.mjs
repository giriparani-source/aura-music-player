import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9299;

async function run() {
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${EDGE_PORT}`,
    '--headless=new',
    '--disable-gpu',
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

    await send('Page.navigate', { url: 'http://localhost:3000' });
    await new Promise((r) => setTimeout(r, 3000));

    // 1. Play a song from home/playlist
    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.group'));
        const top50 = cards.find(c => c.innerText.includes('Top 50'));
        if (top50) top50.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    await evalJs(`
      (() => {
        const modal = document.querySelector('div.fixed.inset-0.z-50');
        const songRows = modal ? Array.from(modal.querySelectorAll('div.group')).filter(r => r.querySelector('h4')) : [];
        if (songRows[0]) songRows[0].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    // 2. Open NowPlayingModal with equalizer tab
    await evalJs(`
      (() => {
        const eqBtn = document.querySelector('button[title*="Equalizer"]');
        if (eqBtn) eqBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    const widths = [1280, 1024, 768, 600, 375, 320];
    for (const w of widths) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 1,
        mobile: w < 768
      });
      await new Promise((r) => setTimeout(r, 500));

      const report = await evalJs(`
        (() => {
          const bodyOverflow = document.body.scrollWidth > window.innerWidth;
          const buttons = Array.from(document.querySelectorAll('button'));
          const tabButtons = buttons.filter(b => ['Artwork', 'Visualizer', 'Lyrics', 'Equalizer & 3D', 'AI Insights'].some(t => b.textContent.includes(t)));
          const eqTab = buttons.find(b => b.textContent.includes('Equalizer & 3D'));
          const tabContainer = eqTab ? eqTab.parentElement : null;
          
          return {
            width: window.innerWidth,
            bodyScrollWidth: document.body.scrollWidth,
            bodyHasOverflow: bodyOverflow,
            foundTabsCount: tabButtons.length,
            tabLabels: tabButtons.map(b => b.textContent.trim()),
            eqTabVisible: !!eqTab,
            eqTabRect: eqTab ? eqTab.getBoundingClientRect() : null,
            containerScrollWidth: tabContainer ? tabContainer.scrollWidth : null,
            containerClientWidth: tabContainer ? tabContainer.clientWidth : null,
            containerOverflows: tabContainer ? tabContainer.scrollWidth > tabContainer.clientWidth : null
          };
        })()
      `);
      console.log('[WIDTH ' + w + 'px]', JSON.stringify(report, null, 2));
    }

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
