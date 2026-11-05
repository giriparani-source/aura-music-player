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

  console.log('1. Ensuring Duplicate Modal is open...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        let modal = document.querySelector('div[class*="fixed"]');
        if (!modal) {
          const dupBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Find Duplicates'));
          if (dupBtn) dupBtn.click();
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  console.log('2. Clicking checkbox for duplicate item (second copy in Pirai Thedum group)...');
  const checkResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.querySelector('div[class*="fixed"]');
        if (!modal) return { error: 'Modal not found' };

        // Find all square icons in modal
        const squares = Array.from(modal.querySelectorAll('svg[class*="lucide-square"]'));
        if (squares.length < 2) return { error: 'Less than 2 checkboxes found', count: squares.length };

        // The second square is the duplicate copy (Quick Share)
        const targetBtn = squares[1].closest('button');
        if (targetBtn) {
          targetBtn.click();
          return { clicked: true };
        }
        return { error: 'Button for square not found' };
      })()
    `,
    returnByValue: true
  });
  console.log('Check result:', checkResult);
  await new Promise(r => setTimeout(r, 600));

  console.log('3. Clicking "Remove 1 Selected from Library" to trigger confirmation dialog...');
  const triggerConfirm = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.querySelector('div[class*="fixed"]');
        const removeBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Remove 1 Selected'));
        if (removeBtn) {
          removeBtn.click();
          return { clicked: true, text: removeBtn.textContent.trim() };
        }
        return { error: 'Remove button not found' };
      })()
    `,
    returnByValue: true
  });
  console.log('Trigger confirm result:', triggerConfirm);
  await new Promise(r => setTimeout(r, 600));

  console.log('4. Inspecting confirmation dialog content...');
  const confirmDialogInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const confirmH3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Confirm Removal'));
        const policyEl = document.querySelector('p[class*="text-emerald-400"]');
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Confirm & Unindex'));

        return {
          hasConfirmTitle: Boolean(confirmH3),
          policyText: policyEl ? policyEl.textContent.trim() : null,
          confirmBtnText: confirmBtn ? confirmBtn.textContent.trim() : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Confirmation Dialog Info:', confirmDialogInfo);

  console.log('5. Clicking "Confirm & Unindex"...');
  const executeResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Confirm & Unindex'));
        if (confirmBtn) {
          confirmBtn.click();
          return { clicked: true };
        }
        return { error: 'Confirm button not found' };
      })()
    `,
    returnByValue: true
  });
  console.log('Execute Result:', executeResult);
  await new Promise(r => setTimeout(r, 1500));

  console.log('6. Checking DB state after unindexing...');
  const dbCheck = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('songs', 'readonly');
          const store = tx.objectStore('songs');
          const allReq = store.getAll();
          allReq.onsuccess = () => {
            const songs = allReq.result;
            const removedSong = songs.find(s => s.id === 'device_1000050465');
            const remainingOriginal = songs.find(s => s.id === 'device_1000013699');
            resolve({
              totalCountInDb: songs.length,
              removedSongFoundInDb: Boolean(removedSong),
              remainingOriginalFoundInDb: Boolean(remainingOriginal)
            });
          };
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('DB Check Result:', JSON.stringify(dbCheck, null, 2));

  ws.close();
  process.exit(0);
}

main().catch(console.error);
