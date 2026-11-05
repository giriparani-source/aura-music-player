async function triggerAndWatch() {
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
    if (data.method === 'Runtime.consoleAPICalled') {
      const text = data.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      // Filter out noisy periodic listeners
      if (!text.includes('AuraMedia.addListener') && !text.includes('position')) {
        console.log(`[Device Console ${data.params.type}]`, text);
      }
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => callbacks.delete(id) && reject(new Error(`timeout ${method}`)), 60000);
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

  await send('Runtime.enable');

  console.log('Clicking Import Playlist button on device...');
  const clickRes = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const importBtn = buttons.find(b => b.textContent && b.textContent.includes('Import Playlist') && b.className.includes('from-cyan-500'));
      if (importBtn && !importBtn.disabled) {
        importBtn.click();
        return { clicked: true };
      }
      return { clicked: false, disabled: importBtn?.disabled };
    })()
  `);
  console.log('Click result:', clickRes);

  let lastStatus = '';
  let pollCount = 0;
  while (pollCount < 90) { // Poll up to 180 seconds
    await new Promise(r => setTimeout(r, 2000));
    pollCount++;

    const poll = await evaluate(`
      (() => {
        const errorEl = document.querySelector('.bg-rose-500\\/10');
        const progressEl = document.querySelector('.animate-spin')?.parentElement;
        const percentEl = document.querySelector('.font-mono.text-\\[11px\\]');
        const readyEl = document.querySelector('.text-cyan-400.uppercase');
        const titleEl = document.querySelector('input.font-bold.text-base');
        const subtitleEl = document.querySelector('.text-xs.text-neutral-400.mt-0\\.5');

        return {
          error: errorEl ? errorEl.textContent.trim() : null,
          progressText: progressEl ? progressEl.textContent.trim() : null,
          percent: percentEl ? percentEl.textContent.trim() : null,
          isReady: !!readyEl,
          readyTitle: titleEl ? titleEl.value : null,
          readySubtitle: subtitleEl ? subtitleEl.textContent.trim() : null
        };
      })()
    `);

    if (poll.error) {
      console.error('\n>>> IMPORT FAILED WITH ERROR ON DEVICE:', poll.error);
      break;
    }

    if (poll.progressText && poll.progressText !== lastStatus) {
      lastStatus = poll.progressText;
      console.log(`[Status ${poll.percent || ''}] ${poll.progressText}`);
    }

    if (poll.isReady) {
      console.log('\n>>> IMPORT COMPLETED SUCCESSFULLY ON SCREEN!');
      console.log('Playlist Title:', poll.readyTitle);
      console.log('Summary:', poll.readySubtitle);
      break;
    }
  }

  // Get full extracted and matched songs from the preview list
  const preview = await evaluate(`
    (() => {
      const rows = Array.from(document.querySelectorAll('.max-h-48 > div.flex.items-center.justify-between'));
      return rows.map((r, i) => {
        const title = r.querySelector('p.text-white')?.textContent.trim();
        const artist = r.querySelector('p.text-neutral-400')?.textContent.trim();
        const badge = r.querySelector('span.rounded')?.textContent.trim();
        return { index: i + 1, title, artist, badge };
      });
    })()
  `);

  console.log(`\nExtracted/Matched Preview Songs Count: ${preview?.length || 0}`);
  if (preview && preview.length > 0) {
    console.log('First 5 songs:', preview.slice(0, 5));
    console.log('Last 5 songs:', preview.slice(-5));
  }

  ws.close();
}

triggerAndWatch().catch(console.error);
