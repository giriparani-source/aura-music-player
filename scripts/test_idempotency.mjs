async function main() {
  const jsonRes = await fetch('http://localhost:9222/json');
  const pages = await jsonRes.json();
  const page = pages.find((p) => p.url.includes('localhost'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      const val = msg.result?.result?.value !== undefined ? msg.result.result.value : msg.result;
      resolve(val);
    }
  });

  await new Promise((res) => ws.addEventListener('open', res));
  await send('Runtime.enable');

  console.log('Clicking Rescan Phone Audio button in UI...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Rescan Phone Audio'));
        if (!btn) return { found: false };
        btn.click();
        return { found: true };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Click result:', clickRes);

  let banner = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const res = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent && (e.textContent.includes('Scan complete') || e.textContent.includes('Sync complete')));
          return el ? el.textContent.trim() : null;
        })()
      `,
      returnByValue: true
    });
    if (res) {
      banner = res;
      break;
    }
  }

  console.log('Idempotent Scan Banner Output:', banner);
  ws.close();
  process.exit(0);
}

main().catch(console.error);
