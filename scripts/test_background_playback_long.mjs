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

  console.log('1. Starting native ExoPlayer on Idhazhin Oram (204s)...');
  await send('Runtime.evaluate', {
    expression: `
      window.Capacitor.Plugins.AuraMedia.playNativeTrack({
        id: 'device_1000004542',
        title: 'Idhazhin Oram',
        artist: 'Anirudh',
        album: '3 (Original Motion Picture Soundtrack)',
        artwork: '',
        uri: 'content://media/external/audio/media/1000004542',
        duration: 204,
        position: 0
      });
    `
  });

  // Let it start playing
  await new Promise(r => setTimeout(r, 2500));

  const state1 = execSync('adb shell "dumpsys media_session | grep -A 2 -i \'state=PlaybackState\'"').toString();
  console.log('Playback State before lock:\n' + state1.trim());

  console.log('2. Locking screen (sleeping phone)...');
  execSync('adb shell input keyevent 223');

  console.log('3. Waiting 5 seconds with screen OFF...');
  await new Promise(r => setTimeout(r, 5000));

  const state2 = execSync('adb shell "dumpsys media_session | grep -A 2 -i \'state=PlaybackState\'"').toString();
  console.log('Playback State during screen-off:\n' + state2.trim());

  console.log('4. Waking phone screen...');
  execSync('adb shell input keyevent 224');
  execSync('adb shell wm dismiss-keyguard');

  ws.close();
  process.exit(0);
}

main().catch(console.error);
