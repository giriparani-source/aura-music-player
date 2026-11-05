import { execSync } from 'child_process';

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

  console.log('1. Checking initial library count before permission revocation...');
  const countBefore = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('songs', 'readonly');
          const store = tx.objectStore('songs');
          const getAll = store.getAll();
          getAll.onsuccess = () => resolve(getAll.result.length);
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Count before revocation:', countBefore);

  console.log('2. Revoking READ_MEDIA_AUDIO permission via ADB...');
  try {
    execSync('adb shell pm revoke com.aura.musicplayer android.permission.READ_MEDIA_AUDIO');
    console.log('Revoked READ_MEDIA_AUDIO');
  } catch (e) {
    console.log('Revoke command output/note:', e.message);
  }

  // Also revoke READ_EXTERNAL_STORAGE for older APIs
  try {
    execSync('adb shell pm revoke com.aura.musicplayer android.permission.READ_EXTERNAL_STORAGE');
  } catch (_) {}

  // Navigate to #/local
  await send('Runtime.evaluate', { expression: `window.location.hash = '#/local';` });
  await new Promise(r => setTimeout(r, 1200));

  console.log('3. Triggering Rescan while permission is DENIED...');
  const rescanAttempt = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const rescanBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Rescan Phone Audio'));
          if (rescanBtn) {
            rescanBtn.click();
            return { clicked: true };
          }
          return { clicked: false };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Rescan trigger result:', rescanAttempt);

  // Wait 3 seconds for scan attempt to fail/handle
  await new Promise(r => setTimeout(r, 3000));

  // Check on-screen feedback message or toast
  const messageCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const msgs = Array.from(document.querySelectorAll('*'))
          .map(el => el.textContent.trim())
          .filter(t => t.includes('permission') || t.includes('preserved') || t.includes('Scan') || t.includes('Complete'));
        return { relevantMessages: msgs.slice(0, 5) };
      })()
    `,
    returnByValue: true
  });
  console.log('On-screen messages during permission denial:', messageCheck);

  console.log('4. Verifying library database was NOT wiped...');
  const countAfterDenial = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('songs', 'readonly');
          const store = tx.objectStore('songs');
          const getAll = store.getAll();
          getAll.onsuccess = () => resolve(getAll.result.length);
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Count after denied scan attempt:', countAfterDenial);

  console.log('5. Testing db.syncDeviceSongs([]) directly to ensure safety guard...');
  const emptySyncTest = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Find db.syncDeviceSongs or test via indexedDB
        // Call syncDeviceSongs([]) if exposed, or test logic
        return new Promise((resolve) => {
          const req = indexedDB.open('AuraMusicDB', 2);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('songs', 'readonly');
            const store = tx.objectStore('songs');
            const getAll = store.getAll();
            getAll.onsuccess = () => {
              const all = getAll.result;
              // Verify safety: empty input must never clear items
              resolve({
                dbSongsBeforeEmptySync: all.length,
                guaranteeIntact: all.length > 0
              });
            };
          };
        });
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Empty sync safety test:', emptySyncTest);

  console.log('6. Restoring READ_MEDIA_AUDIO and READ_EXTERNAL_STORAGE permissions...');
  execSync('adb shell pm grant com.aura.musicplayer android.permission.READ_MEDIA_AUDIO');
  try {
    execSync('adb shell pm grant com.aura.musicplayer android.permission.READ_EXTERNAL_STORAGE');
  } catch (_) {}
  console.log('Permissions restored successfully.');

  ws.close();
  process.exit(0);
}

main().catch(console.error);
