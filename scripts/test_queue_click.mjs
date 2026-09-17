import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9225;

async function run() {
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${EDGE_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_q_test',
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

    // Play top 50 playlist track 1
    console.log('Opening playlist modal...');
    await evalJs(`
      (() => {
        const cards = Array.from(document.querySelectorAll('main div.group'));
        const top50Card = cards.find(c => c.innerText.includes('Top 50'));
        if (top50Card) top50Card.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    console.log('Playing track 1...');
    await evalJs(`
      (() => {
        const rows = document.querySelectorAll('.fixed.inset-0 div.group.flex.items-center.justify-between');
        if (rows[0]) rows[0].click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    // Check bottom player
    const bpState = await evalJs(`
      (() => {
        const h4 = document.querySelector('div.fixed.bottom-0 h4');
        return h4 ? h4.innerText : 'none';
      })()
    `);
    console.log('Currently playing:', bpState);

    // Close playlist modal
    console.log('Closing playlist modal...');
    await evalJs(`
      (() => {
        const closeBtn = document.querySelector('.fixed.inset-0 button[title*="Close"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Open Queue Drawer
    console.log('Opening queue drawer...');
    await evalJs(`
      (() => {
        const bp = document.querySelector('div.fixed.bottom-0.left-0.right-0.h-20');
        const qBtn = bp ? Array.from(bp.querySelectorAll('button')).find(b => b.title && b.title.toLowerCase().includes('queue')) : null;
        if (qBtn) qBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Inspect queue items
    const qStatus = await evalJs(`
      (() => {
        const drawer = document.querySelector('div.fixed.right-0');
        const rows = drawer ? Array.from(drawer.querySelectorAll('div.group')) : [];
        return {
          drawerFound: !!drawer,
          rowCount: rows.length,
          rowTitles: rows.slice(0, 5).map(r => r.querySelector('h5')?.innerText)
        };
      })()
    `);
    console.log('Queue status:', qStatus);

    // Click 3rd row in queue drawer
    console.log('Clicking 3rd row in queue drawer...');
    const clickResult = await evalJs(`
      (() => {
        const drawer = document.querySelector('div.fixed.right-0');
        const rows = drawer ? Array.from(drawer.querySelectorAll('div.group')) : [];
        const target = rows[2];
        if (target) {
          const title = target.querySelector('h5')?.innerText;
          target.click();
          return { clicked: true, title };
        }
        return { clicked: false };
      })()
    `);
    console.log('Clicked target:', clickResult);
    await new Promise((r) => setTimeout(r, 1500));

    const finalState = await evalJs(`
      (() => {
        const h4 = document.querySelector('div.fixed.bottom-0.left-0.right-0.h-20 h4');
        return h4 ? h4.innerText : 'none';
      })()
    `);
    console.log('Now playing after queue click:', finalState);

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
