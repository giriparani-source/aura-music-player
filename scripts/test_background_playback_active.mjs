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

  console.log('1. Starting native ExoPlayer playback with valid uri...');
  const playRes = await send('Runtime.evaluate', {
    expression: `
      window.Capacitor.Plugins.AuraMedia.playNativeTrack({
        id: 'device_1000065012',
        title: 'Test Incremental Track 1',
        artist: 'Aura QA Tester',
        album: 'Aura Test Suite',
        artwork: '',
        uri: 'content://media/external/audio/media/1000065012',
        duration: 47,
        position: 0
      });
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('playNativeTrack result:', playRes);

  await new Promise(r => setTimeout(r, 2000));

  // Check state before sleep
  const stateBefore = execSync('adb shell "dumpsys media_session | grep -A 2 -i \'state=PlaybackState\'"').toString();
  console.log('State Before Sleep:\n' + stateBefore.trim());

  console.log('2. Locking screen (sleeping phone)...');
  execSync('adb shell input keyevent 223');
  const wakeState = execSync('adb shell "dumpsys power | grep -i mWakefulness"').toString();
  console.log('Wakefulness:', wakeState.trim());

  console.log('3. Waiting 6 seconds while screen is locked/sleeping...');
  await new Promise(r => setTimeout(r, 6000));

  // Check media session while asleep
  const stateDuringSleep = execSync('adb shell "dumpsys media_session | grep -A 2 -i \'state=PlaybackState\'"').toString();
  console.log('State During Sleep:\n' + stateDuringSleep.trim());

  console.log('4. Waking phone...');
  execSync('adb shell input keyevent 224');
  execSync('adb shell wm dismiss-keyguard');
  await new Promise(r => setTimeout(r, 1000));

  const stateAfterWake = execSync('adb shell "dumpsys media_session | grep -A 2 -i \'state=PlaybackState\'"').toString();
  console.log('State After Wake:\n' + stateAfterWake.trim());

  ws.close();
  process.exit(0);
}

main().catch(console.error);
