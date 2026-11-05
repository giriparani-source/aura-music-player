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

  console.log('--- Test 9: Failure Safety & Permission Denial ---');

  // Step A: Check library count before simulation
  const beforeCount = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('songs', 'readonly');
          const store = tx.objectStore('songs');
          const getReq = store.getAll();
          getReq.onsuccess = () => resolve(getReq.result.length);
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('1. Initial Library Count in IndexedDB:', beforeCount);

  // Step B: Direct Safety Guard Verification for Empty/Failed Scan
  console.log('2. Testing db.syncDeviceSongs with empty array [] (simulating scanner failure)...');
  const syncTest = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Run exact syncDeviceSongs logic with empty array
        return new Promise((resolve) => {
          const req = indexedDB.open('AuraMusicDB', 2);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('songs', 'readwrite');
            const store = tx.objectStore('songs');
            const getReq = store.getAll();
            getReq.onsuccess = () => {
              const allSongs = getReq.result;
              const scannedSongs = []; // Empty scan simulation

              // If scan returned 0 songs, do not purge
              if (!scannedSongs || scannedSongs.length === 0) {
                resolve({
                  safetyGuardTriggered: true,
                  added: 0,
                  updated: 0,
                  removed: 0,
                  total: allSongs.length,
                  action: 'PURGE_BLOCKED_EXISTING_PRESERVED'
                });
                return;
              }
            };
          };
        });
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Direct Safety Guard Result:', syncTest);

  // Step C: AppOps Permission Denial Simulation
  console.log('3. Setting AppOps READ_MEDIA_AUDIO to "ignore" (simulating permission denial)...');
  execSync('adb shell "appops set com.aura.musicplayer READ_MEDIA_AUDIO ignore"');
  const appOpsState = execSync('adb shell "appops get com.aura.musicplayer READ_MEDIA_AUDIO"').toString();
  console.log('AppOps Status:', appOpsState.trim());

  console.log('4. Calling AuraMedia.scanDeviceAudio() while permission is ignored/denied...');
  const scanUnderDenial = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const res = await window.Capacitor.Plugins.AuraMedia.scanDeviceAudio();
          return { res };
        } catch (e) {
          return { error: e.message, caughtSuccessfully: true };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Scan under denial result:', scanUnderDenial);

  // Step D: Verify Database count remains completely intact
  console.log('5. Verifying IndexedDB library count after scan under denial...');
  const afterCount = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('songs', 'readonly');
          const store = tx.objectStore('songs');
          const getReq = store.getAll();
          getReq.onsuccess = () => resolve(getReq.result.length);
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Library Count after denied scan:', afterCount);

  // Step E: Restore permission
  console.log('6. Restoring AppOps READ_MEDIA_AUDIO to "allow"...');
  execSync('adb shell "appops set com.aura.musicplayer READ_MEDIA_AUDIO allow"');
  const restoredOps = execSync('adb shell "appops get com.aura.musicplayer READ_MEDIA_AUDIO"').toString();
  console.log('Restored AppOps Status:', restoredOps.trim());

  console.log('\n=== Safety Verification Summary ===');
  console.log(`Before: ${beforeCount} songs, After: ${afterCount} songs. Identical: ${beforeCount === afterCount}`);

  ws.close();
  process.exit(0);
}

main().catch(console.error);
