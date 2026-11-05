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

  console.log('--- Step 1: Verify Header count matches Songs tab count ---');
  const countsCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const headerP = Array.from(document.querySelectorAll('p')).find(p => p.textContent.includes('tracks indexed'));
        const headerMatch = headerP ? headerP.textContent.match(/(\\d+)\\s+tracks indexed/) : null;
        const headerCount = headerMatch ? parseInt(headerMatch[1], 10) : null;

        const songTabSpan = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Songs'));
        const tabMatch = songTabSpan ? songTabSpan.textContent.match(/Songs\\s*(\\d+)/) : null;
        const tabCount = tabMatch ? parseInt(tabMatch[1], 10) : null;

        return {
          headerText: headerP ? headerP.textContent.trim() : null,
          headerCount,
          tabText: songTabSpan ? songTabSpan.textContent.trim() : null,
          tabCount,
          isExactMatch: headerCount === tabCount
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Count Check:', countsCheck);

  console.log('--- Step 2: Test "On Device" Filter ---');
  const onDeviceTest = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const onDevBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('On Device'));
        if (!onDevBtn) return { error: 'On Device button not found' };
        onDevBtn.click();
        return {
          clicked: true,
          buttonText: onDevBtn.textContent.trim()
        };
      })()
    `,
    returnByValue: true
  });
  console.log('On Device Click:', onDeviceTest);
  await new Promise(r => setTimeout(r, 600));

  const onDeviceShowing = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const showingEl = Array.from(document.querySelectorAll('*')).find(el => el.textContent && el.textContent.startsWith('Showing '));
        return showingEl ? showingEl.textContent.trim() : null;
      })()
    `,
    returnByValue: true
  });
  console.log('On Device Result:', onDeviceShowing);

  console.log('--- Step 3: Test "Downloaded" Filter ---');
  // Mark one song as downloaded via library store
  const markDownloaded = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const state = window.useLibraryStore ? window.useLibraryStore.getState() : null;
        // If not on window, find the first song id from IndexedDB or state
        const firstSong = document.querySelector('[data-song-id]') || { id: 'device_1000065012' };
        return { hasStore: Boolean(window.useLibraryStore) };
      })()
    `,
    returnByValue: true
  });
  console.log('Mark Downloaded Check:', markDownloaded);

  // Let's inspect useLibraryStore exposure
  const storeInspect = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Find zustand stores in webpack / module scope or window
        // Let's set 1 song as isDownloaded in IndexedDB temporarily
        return new Promise((resolve) => {
          const req = indexedDB.open('AuraMusicDB', 2);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('songs', 'readwrite');
            const store = tx.objectStore('songs');
            const getReq = store.get('device_1000065012');
            getReq.onsuccess = () => {
              if (getReq.result) {
                const updated = { ...getReq.result, isDownloaded: true, downloadedAt: Date.now() };
                store.put(updated);
                resolve({ markedId: 'device_1000065012', success: true });
              } else {
                resolve({ error: 'Song not found' });
              }
            };
          };
        });
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('DB markDownloaded result:', storeInspect);

  // Reload library state
  await send('Runtime.evaluate', {
    expression: `
      window.location.reload();
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  // Navigate to library again
  await send('Runtime.evaluate', {
    expression: `window.location.hash = '#/library';`
  });
  await new Promise(r => setTimeout(r, 1000));

  const downloadedCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
        const dlBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Downloaded'));
        if (dlBtn) {
          dlBtn.click();
        }
        const showingEl = Array.from(document.querySelectorAll('*')).find(el => el.textContent && el.textContent.startsWith('Showing '));
        return {
          buttons,
          hasDownloadedBtn: Boolean(dlBtn),
          showingAfterDlClick: showingEl ? showingEl.textContent.trim() : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Downloaded Filter Inspection:', downloadedCheck);

  // Revert the song back to not isDownloaded
  await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('songs', 'readwrite');
          const store = tx.objectStore('songs');
          const getReq = store.get('device_1000065012');
          getReq.onsuccess = () => {
            if (getReq.result) {
              const updated = { ...getReq.result, isDownloaded: false, downloadedAt: undefined };
              store.put(updated);
              resolve({ reverted: true });
            }
          };
        };
      });
    `,
    awaitPromise: true
  });

  // Reload window to clean state
  await send('Runtime.evaluate', { expression: `window.location.reload();` });
  await new Promise(r => setTimeout(r, 2000));
  await send('Runtime.evaluate', { expression: `window.location.hash = '#/library';` });

  ws.close();
  process.exit(0);
}

main().catch(console.error);
