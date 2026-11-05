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

  console.log('1. Starting local song playback...');
  const playRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Click play button on mini player or play first song
        const playBtn = document.querySelector('button[class*="rounded-full"][class*="bg-white"]');
        if (playBtn) {
          playBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `,
    returnByValue: true
  });
  console.log('Play button click:', playRes);
  await new Promise(r => setTimeout(r, 2000));

  console.log('2. Reading audio state before locking phone...');
  const beforeLock = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const status = await window.Capacitor.Plugins.AuraMedia.getPlaybackState();
          return { status };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Playback status before lock:', beforeLock);

  console.log('3. Locking phone screen (KEYCODE_POWER)...');
  execSync('adb shell input keyevent 26');

  // Verify display is OFF
  const displayState = execSync('adb shell dumpsys display | grep -E "mScreenState|mDisplayState"').toString();
  console.log('Display state after locking:\n' + displayState.trim());

  console.log('Waiting 5 seconds while phone is locked...');
  await new Promise(r => setTimeout(r, 5000));

  // Check Android MediaSession / AudioTrack dumpsys while locked
  const mediaSessionDump = execSync('adb shell dumpsys media_session | grep -E "state=PlaybackState|package=com.aura"').toString();
  console.log('Android MediaSession state while locked:\n' + mediaSessionDump.trim());

  console.log('4. Waking phone screen...');
  execSync('adb shell input keyevent 224');
  execSync('adb shell wm dismiss-keyguard');
  await new Promise(r => setTimeout(r, 1000));

  console.log('5. Reading audio state after waking phone...');
  const afterLock = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const status = await window.Capacitor.Plugins.AuraMedia.getPlaybackState();
          return { status };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Playback status after wake:', afterLock);

  ws.close();
  process.exit(0);
}

main().catch(console.error);
