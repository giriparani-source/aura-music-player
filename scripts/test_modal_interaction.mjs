async function testModal() {
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
      const timer = setTimeout(() => callbacks.delete(id) && reject(new Error('timeout')), 15000);
      callbacks.set(id, (val) => { clearTimeout(timer); resolve(val); });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return res.result?.result?.value;
  }

  console.log('Finding Import Playlist button...');
  const res = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const importBtn = buttons.find(b => b.textContent && b.textContent.includes('Import Playlist'));
      if (importBtn) {
        importBtn.click();
        return { found: true, text: importBtn.textContent };
      }
      return { found: false, buttonCount: buttons.length, sampleButtons: buttons.slice(0, 10).map(b => b.textContent.trim()) };
    })()
  `);
  console.log('Click result:', res);

  // Wait 1 second
  await new Promise(r => setTimeout(r, 1000));

  // Check if modal is visible
  const modalInfo = await evaluate(`
    (() => {
      const input = document.querySelector('input[placeholder*="Spotify"]') ||
                    document.querySelector('input[placeholder*="playlist"]') ||
                    document.querySelector('textarea') ||
                    document.querySelector('input[type="text"]');
      const modalHeader = document.querySelector('h3');
      return {
        hasInput: !!input,
        inputPlaceholder: input?.placeholder,
        modalHeaderText: modalHeader?.textContent
      };
    })()
  `);
  console.log('Modal info:', modalInfo);

  ws.close();
}

testModal().catch(console.error);
