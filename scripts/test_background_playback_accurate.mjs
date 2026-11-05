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

  const positions = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
      if (text.includes('position')) {
        positions.push(text);
      }
    }
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      const val = msg.result?.result?.value !== undefined ? msg.result.result.value : msg.result;
      resolve(val);
    }
  });

  await new Promise((res) => ws.addEventListener('open', res));
  await send('Runtime.enable');

  console.log('1. Starting local track playback via AuraMedia.playNativeTrack...');
  // Clear logcat buffer first
  execSync('adb logcat -c');

  const startPlayRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const res = await window.Capacitor.Plugins.AuraMedia.playNativeTrack({
            path: 'content://media/external/audio/media/1000065012',
            title: 'Test Incremental Track 1',
            artist: 'Aura QA Tester',
            album: 'Aura Test Suite',
            duration: 47,
            id: 'device_1000065012'
          });
          return { success: true, res };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Start play result:', startPlayRes);

  // Let it play for 2 seconds to establish playback
  await new Promise(r => setTimeout(r, 2000));

  // Check initial logcat
  const initialLogs = execSync('adb logcat -d -s AuraAudioService:D AuraMedia:D').toString();
  console.log('Initial playback logs:\n' + initialLogs.slice(-600));

  console.log('2. Locking screen (power button)...');
  execSync('adb shell input keyevent 26');

  // Verify display state
  const screenState = execSync('adb shell "dumpsys display | grep -E \'mScreenState|mDisplayState\'"').toString();
  console.log('Screen State:\n' + screenState.trim());

  console.log('3. Waiting 6 seconds while screen is OFF...');
  await new Promise(r => setTimeout(r, 6000));

  // Read logcat accumulated while locked
  const lockedLogs = execSync('adb logcat -d -s AuraAudioService:D AuraMedia:D').toString();
  console.log('Logs recorded during screen-off:\n' + lockedLogs.slice(-1200));

  console.log('4. Waking and unlocking screen...');
  execSync('adb shell input keyevent 224');
  execSync('adb shell wm dismiss-keyguard');
  await new Promise(r => setTimeout(r, 1000));

  // Read foreground service status from Android OS
  const serviceDump = execSync('adb shell "dumpsys activity services AuraAudioService | grep -E \'isForeground|app=ProcessRecord\'"').toString();
  console.log('Foreground Service Dump:\n' + serviceDump.trim());

  ws.close();
  process.exit(0);
}

main().catch(console.error);
