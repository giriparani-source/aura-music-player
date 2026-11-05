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

  console.log('1. Navigating to Library view...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        window.location.hash = '#/library';
      })()
    `
  });

  await new Promise(r => setTimeout(r, 1000));

  console.log('2. Inspecting Library header and tabs...');
  const libInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const textNodes = Array.from(document.querySelectorAll('*'))
          .map(el => el.textContent.trim())
          .filter(t => t.includes('Song') || t.includes('Tracks') || t.includes('Library'));
        
        // Find filter chips/buttons
        const buttons = Array.from(document.querySelectorAll('button'))
          .map(b => b.textContent.trim())
          .filter(Boolean);

        // Find Songs count in header / tab
        const headerCountMatch = document.body.innerText.match(/(\\d+)\\s*(?:Songs|tracks)/i);
        
        return {
          currentHash: window.location.hash,
          buttons,
          headerCountMatch: headerCountMatch ? headerCountMatch[0] : null,
          bodySnippet: document.body.innerText.slice(0, 1000)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Library view info:', JSON.stringify(libInfo, null, 2));

  ws.close();
  process.exit(0);
}

main().catch(console.error);
