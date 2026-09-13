import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9227;

async function run() {
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${EDGE_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_inspect2',
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

    // Click Top 50 card
    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.group'));
        const top50 = cards.find(c => c.innerText.includes('Top 50'));
        if (top50) top50.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Click songRows[1] (Hukum)
    const clickTrack1 = await evalJs(`
      (() => {
        const modal = document.querySelector('div.fixed.inset-0.z-50');
        const songRows = modal ? Array.from(modal.querySelectorAll('div.group')).filter(r => r.querySelector('h4')) : [];
        if (songRows[0]) {
          songRows[0].click();
          return { clicked: true, title: songRows[0].querySelector('h4')?.innerText };
        }
        return { clicked: false };
      })()
    `);
    console.log('Click track 1:', clickTrack1);
    await new Promise((r) => setTimeout(r, 1500));

    // Close modal
    await evalJs(`
      (() => {
        const closeBtn = document.querySelector('div.fixed.inset-0.z-50 button[title*="Close"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Open Queue drawer
    await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-0.left-0.right-0.h-20');
        const qBtn = bp ? Array.from(bp.querySelectorAll('button')).find(b => b.title && b.title.toLowerCase().includes('queue')) : null;
        if (qBtn) qBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    const queueDrawerInspection = await evalJs(`
      (() => {
        const drawer = document.querySelector('div.fixed.right-0.z-50');
        const items = drawer ? Array.from(drawer.querySelectorAll('div.group')) : [];
        return {
          drawerFound: !!drawer,
          itemsCount: items.length,
          itemTitles: items.slice(0, 5).map(it => it.querySelector('h5')?.innerText)
        };
      })()
    `);
    console.log('Queue drawer inspection:', queueDrawerInspection);

    // Click 3rd item in queue drawer ("Naa Ready")
    const clickQItem = await evalJs(`
      (() => {
        const drawer = document.querySelector('div.fixed.right-0.z-50');
        const items = drawer ? Array.from(drawer.querySelectorAll('div.group')) : [];
        if (items[2]) {
          const title = items[2].querySelector('h5')?.innerText;
          items[2].click();
          return { clicked: true, title };
        }
        return { clicked: false };
      })()
    `);
    console.log('Click queue item 2:', clickQItem);
    await new Promise((r) => setTimeout(r, 1500));

    const bpStateAfter = await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-0.left-0.right-0.h-20');
        return {
          title: bp?.querySelector('h4')?.innerText
        };
      })()
    `);
    console.log('BP state after clicking queue item:', bpStateAfter);

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
