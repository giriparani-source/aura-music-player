async function getModalState() {
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
      const timer = setTimeout(() => callbacks.delete(id) && reject(new Error(`timeout ${method}`)), 10000);
      callbacks.set(id, (val) => { clearTimeout(timer); resolve(val); });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.result?.exceptionDetails) {
      throw new Error(JSON.stringify(res.result.exceptionDetails));
    }
    return res.result?.result?.value;
  }

  const state = await evaluate(`
    (() => {
      // Find modal container
      const modal = document.querySelector('.max-w-lg');
      if (!modal) return { modalFound: false };

      const errorEl = modal.querySelector('[class*="bg-rose-500"]');
      const progressEl = modal.querySelector('[class*="text-cyan-400"][class*="font-semibold"]');
      const percentEl = modal.querySelector('.font-mono');
      const readyEl = modal.querySelector('[class*="uppercase"]');
      const titleInput = modal.querySelector('input');
      const subtitleEl = modal.querySelector('.text-xs.text-neutral-400');
      const previewRows = Array.from(modal.querySelectorAll('.max-h-48 > div')).map(row => {
        const title = row.querySelector('p.text-white')?.textContent.trim();
        const artist = row.querySelector('p.text-neutral-400')?.textContent.trim();
        const badge = row.querySelector('span.rounded')?.textContent.trim();
        return { title, artist, badge };
      }).filter(s => s.title);

      const buttons = Array.from(modal.querySelectorAll('button')).map(b => ({
        text: b.textContent.trim(),
        disabled: b.disabled,
        visible: b.offsetParent !== null
      }));

      return {
        modalFound: true,
        error: errorEl ? errorEl.textContent.trim() : null,
        progress: progressEl ? progressEl.textContent.trim() : null,
        percent: percentEl ? percentEl.textContent.trim() : null,
        isReady: !!readyEl,
        readyLabel: readyEl ? readyEl.textContent.trim() : null,
        title: titleInput ? titleInput.value : null,
        subtitle: subtitleEl ? subtitleEl.textContent.trim() : null,
        previewCount: previewRows.length,
        sampleSongs: previewRows.slice(0, 10),
        buttons
      };
    })()
  `);

  console.log('Live Modal State on Phone:');
  console.dir(state, { depth: null });

  ws.close();
}

getModalState().catch(console.error);
