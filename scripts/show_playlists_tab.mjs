import { execSync } from 'child_process';

async function showPlaylists() {
  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page');
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
    return new Promise((resolve, reject) => {
      const id = msgId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return res.result?.result?.value;
  }

  await evaluate(`
    (() => {
      window.location.hash = '#/library';
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));

  await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const plBtn = buttons.find(b => b.textContent && b.textContent.includes('Playlists'));
      if (plBtn) plBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1200));

  try {
    execSync('adb exec-out screencap -p > screenshot_playlists_tab.png');
  } catch {}

  console.log('Playlists tab screenshot captured to screenshot_playlists_tab.png');
  ws.close();
}
showPlaylists().catch(console.error);
