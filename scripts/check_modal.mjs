async function test() {
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
      const timer = setTimeout(() => callbacks.delete(id) && reject(new Error('timeout')), 10000);
      callbacks.set(id, (val) => { clearTimeout(timer); resolve(val); });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return res.result?.result?.value;
  }

  const check = await evaluate(`
    (() => {
      const textarea = document.querySelector('textarea');
      const buttons = Array.from(document.querySelectorAll('button'));
      const importBtn = buttons.find(b => b.textContent && b.textContent.includes('Import Playlist') && b.className.includes('from-cyan-500'));
      return {
        hasTextarea: !!textarea,
        textareaValue: textarea ? textarea.value : null,
        hasImportBtn: !!importBtn,
        importBtnDisabled: importBtn ? importBtn.disabled : null,
        importBtnText: importBtn ? importBtn.textContent.trim() : null
      };
    })()
  `);
  console.log('Current modal status:', check);
  ws.close();
}
test().catch(console.error);
