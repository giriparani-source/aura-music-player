import { execSync } from 'child_process';

async function testSpotifyImport() {
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
      if (!text.includes('AuraMedia.addListener') && !text.includes('position')) {
        console.log(`[Spotify Console ${data.params.type}]`, text);
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

  console.log('Navigating to Home and opening Import Modal...');
  await evaluate(`
    (() => {
      window.location.hash = '#/';
    })()
  `);
  await new Promise(r => setTimeout(r, 1200));

  // Click Import Playlist pill button
  const openModal = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const importBtn = buttons.find(b => b.textContent && b.textContent.includes('Import Playlist'));
      if (importBtn) {
        importBtn.click();
        return { clicked: true };
      }
      return { clicked: false, buttons: buttons.map(b => b.textContent.trim()) };
    })()
  `);
  console.log('Open modal result:', openModal);
  await new Promise(r => setTimeout(r, 1200));

  const spUrl = 'https://open.spotify.com/playlist/796bkCyjh8Bk2w9QDICrJv?si=2JueO5qHSIyU0mBzGN_fIA&utm_source=copy-link';
  console.log('Entering Spotify URL into modal textarea:', spUrl);

  const inputSet = await evaluate(`
    (() => {
      const textarea = document.querySelector('textarea');
      if (!textarea) return { error: 'No textarea' };
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeSetter.call(textarea, ${JSON.stringify(spUrl)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, value: textarea.value };
    })()
  `);
  console.log('Input set result:', inputSet);
  await new Promise(r => setTimeout(r, 1000));

  console.log('Clicking "Fetch & Convert Playlist"...');
  const clickFetch = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && b.textContent.includes('Fetch & Convert Playlist'));
      if (btn && !btn.disabled) {
        btn.click();
        return { clicked: true };
      }
      return { clicked: false, disabled: btn?.disabled };
    })()
  `);
  console.log('Click fetch result:', clickFetch);

  if (!clickFetch.clicked) {
    console.error('Could not click fetch button!');
    ws.close();
    return;
  }

  // Poll progress
  let startTime = Date.now();
  let lastProgress = '';
  let readyResult = null;

  while (Date.now() - startTime < 180000) {
    await new Promise(r => setTimeout(r, 2000));

    const poll = await evaluate(`
      (() => {
        const modal = document.querySelector('.max-w-lg');
        if (!modal) return { modalMissing: true };

        const errorEl = modal.querySelector('.text-rose-300');
        const progressEl = modal.querySelector('[class*="text-cyan-400"][class*="font-semibold"]');
        const percentEl = modal.querySelector('.font-mono');
        const titleInput = modal.querySelector('input.font-bold.text-base');
        const subtitleEl = modal.querySelector('.text-xs.text-neutral-400.mt-0\\\\.5');
        const readyBadge = modal.querySelector('[class*="uppercase"]');

        return {
          hasError: !!errorEl,
          errorMessage: errorEl ? errorEl.textContent.trim() : null,
          progressText: progressEl ? progressEl.textContent.trim() : null,
          percent: percentEl ? percentEl.textContent.trim() : null,
          isReady: !!titleInput || (readyBadge && readyBadge.textContent.includes('READY')),
          readyTitle: titleInput ? titleInput.value : null,
          readySubtitle: subtitleEl ? subtitleEl.textContent.trim() : null
        };
      })()
    `);

    if (poll.hasError) {
      console.error('\n>>> SPOTIFY IMPORT ERROR ON DEVICE:', poll.errorMessage);
      try {
        execSync('adb exec-out screencap -p > screenshot_sp_import_error.png');
      } catch {}
      break;
    }

    if (poll.progressText && poll.progressText !== lastProgress) {
      lastProgress = poll.progressText;
      console.log(`[Spotify Progress] ${poll.progressText} (${poll.percent || ''})`);
    }

    if (poll.isReady) {
      console.log('\n>>> SPOTIFY IMPORT COMPLETED!');
      console.log('Title:', poll.readyTitle);
      console.log('Subtitle:', poll.readySubtitle);
      readyResult = poll;
      try {
        execSync('adb exec-out screencap -p > screenshot_sp_import_ready.png');
      } catch {}
      break;
    }
  }

  if (readyResult && readyResult.isReady) {
    // Get preview tracks
    const previewTracks = await evaluate(`
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

    console.log(`\nTotal Spotify Tracks Imported: ${previewTracks?.length || 0}`);
    console.log('First 5 Tracks:', previewTracks?.slice(0, 5));
    console.log('Last 5 Tracks:', previewTracks?.slice(-5));

    // Save with distinct title to avoid collision with YouTube import
    await evaluate(`
      (() => {
        const titleInput = document.querySelector('input.font-bold.text-base');
        if (titleInput) {
          titleInput.value = 'Favorite Songs (Spotify Import)';
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);

    console.log('Clicking "Save to My Library"...');
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent && b.textContent.includes('Save to My Library'));
        if (btn) btn.click();
      })()
    `);

    await new Promise(r => setTimeout(r, 3000));
    try {
      execSync('adb exec-out screencap -p > screenshot_sp_saved_library.png');
    } catch {}

    const dbData = await evaluate(`
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

    console.log('\n--- IndexedDB Playlists After Spotify Save ---');
    dbData?.forEach(p => {
      console.log(` - ID: "${p.id}", Name: "${p.name}", Songs: ${p.songIds?.length || 0}`);
    });
  }

  ws.close();
}

testSpotifyImport().catch(console.error);
