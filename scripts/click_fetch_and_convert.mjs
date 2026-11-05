import { execSync } from 'child_process';

async function main() {
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
      if (text.includes('[Importer]') || text.includes('Error') || text.includes('error') || text.includes('Import')) {
        console.log(`[Console ${data.params.type}]`, text);
      }
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => callbacks.delete(id) && reject(new Error(`timeout ${method}`)), 120000);
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

  console.log('Clicking "Fetch & Convert Playlist" button...');
  const clickRes = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes('Fetch & Convert Playlist'));
      if (btn && !btn.disabled) {
        btn.click();
        return { clicked: true, text: btn.textContent.trim() };
      }
      return { clicked: false, error: 'Button not found or disabled' };
    })()
  `);
  console.log('Click result:', clickRes);

  if (!clickRes.clicked) {
    console.error('Cannot proceed without click!');
    ws.close();
    return;
  }

  // Poll loop
  let lastProgress = '';
  let startTime = Date.now();
  let result = null;

  while (Date.now() - startTime < 180000) { // 3 minutes timeout
    await new Promise(r => setTimeout(r, 2000));

    const poll = await evaluate(`
      (() => {
        const errorEl = document.querySelector('[class*="bg-rose-500"]');
        const progressEl = document.querySelector('.animate-spin')?.parentElement;
        const percentEl = document.querySelector('.font-mono.text-\\\\[11px\\\\]') ||
                          document.querySelector('.font-mono');
        const readyEl = document.querySelector('.text-cyan-400.uppercase') ||
                        document.querySelector('[class*="Ready to Save"]');
        const titleInput = document.querySelector('input.font-bold.text-base');
        const subtitleEl = document.querySelector('.text-xs.text-neutral-400.mt-0\\\\.5');

        return {
          hasError: !!errorEl,
          errorMessage: errorEl ? errorEl.textContent.trim() : null,
          progressText: progressEl ? progressEl.textContent.trim() : null,
          percent: percentEl ? percentEl.textContent.trim() : null,
          isReady: !!titleInput || (readyEl && readyEl.textContent.includes('READY')),
          readyTitle: titleInput ? titleInput.value : null,
          readySubtitle: subtitleEl ? subtitleEl.textContent.trim() : null
        };
      })()
    `);

    if (poll.hasError) {
      console.error('\n>>> ERROR OCCURRED ON DEVICE:', poll.errorMessage);
      try {
        execSync('adb exec-out screencap -p > screenshot_import_error.png');
      } catch {}
      break;
    }

    if (poll.progressText && poll.progressText !== lastProgress) {
      lastProgress = poll.progressText;
      console.log(`[Device Progress] ${poll.progressText} (${poll.percent || ''})`);
    }

    if (poll.isReady) {
      console.log('\n>>> IMPORT COMPLETED AND READY TO SAVE!');
      console.log('Detected Title:', poll.readyTitle);
      console.log('Subtitle:', poll.readySubtitle);
      result = poll;
      try {
        execSync('adb exec-out screencap -p > screenshot_yt_import_ready.png');
      } catch {}
      break;
    }
  }

  if (result && result.isReady) {
    // Inspect all preview tracks
    const allPreviewTracks = await evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('.max-h-48 > div')).filter(r => r.querySelector('p.text-white'));
        return rows.map((r, i) => {
          const title = r.querySelector('p.text-white')?.textContent.trim();
          const artist = r.querySelector('p.text-neutral-400')?.textContent.trim();
          const badge = r.querySelector('span.rounded')?.textContent.trim();
          return { index: i + 1, title, artist, badge };
        });
      })()
    `);

    console.log(`\nTotal Preview Tracks on Device: ${allPreviewTracks?.length || 0}`);
    console.log('Sample Tracks:');
    allPreviewTracks?.slice(0, 10).forEach(t => console.log(`  ${t.index}. [${t.badge}] ${t.title} - ${t.artist}`));

    // Now click "Save to Library" button!
    console.log('\nClicking "Save to Library" button...');
    const saveClick = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => b.textContent && (b.textContent.includes('Save to Library') || b.textContent.includes('Saved')));
        if (saveBtn) {
          saveBtn.click();
          return { clicked: true, text: saveBtn.textContent.trim() };
        }
        return { clicked: false, buttons: buttons.map(b => b.textContent.trim()) };
      })()
    `);
    console.log('Save button click result:', saveClick);

    // Wait 3 seconds for save and navigation
    await new Promise(r => setTimeout(r, 3000));
    try {
      execSync('adb exec-out screencap -p > screenshot_yt_saved_library.png');
    } catch {}

    // Verify IndexedDB
    const dbCheck = await evaluate(`
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('playlists', 'readonly');
          const store = tx.objectStore('playlists');
          const getAll = store.getAll();
          getAll.onsuccess = () => resolve(getAll.result);
          getAll.onerror = () => resolve([]);
        };
        req.onerror = () => resolve([]);
      })
    `);

    console.log('\n--- IndexedDB Playlists After Save ---');
    console.log(`Total Playlists: ${dbCheck?.length || 0}`);
    dbCheck?.forEach(p => {
      console.log(` • ID: "${p.id}", Name: "${p.name}", Songs Count: ${p.songIds?.length || 0}, isSmart: ${!!p.isSmart}`);
    });
  }

  ws.close();
}

main().catch(console.error);
