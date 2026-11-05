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

  const events = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
      if (text.includes('MEDIA_ACTION_TEST')) {
        events.push(text);
        console.log('[DEVICE]', text);
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

  console.log('1. Registering test mediaAction listener in WebView...');
  await send('Runtime.evaluate', {
    expression: `
      window.Capacitor.Plugins.AuraMedia.addListener('mediaAction', (data) => {
        console.log('MEDIA_ACTION_TEST:', JSON.stringify(data), 'timestamp:', Date.now());
      });
    `
  });

  console.log('2. Locking screen (sleep keyevent 223)...');
  execSync('adb shell input keyevent 223');

  console.log('3. Triggering ACTION_NEXT intent via ADB while phone is asleep...');
  execSync('adb shell am start-foreground-service -a com.aura.musicplayer.ACTION_NEXT com.aura.musicplayer/.AuraAudioService');

  console.log('4. Waiting 4 seconds while phone remains asleep...');
  await new Promise(r => setTimeout(r, 4000));

  console.log('5. Waking phone screen...');
  execSync('adb shell input keyevent 224');
  execSync('adb shell wm dismiss-keyguard');
  await new Promise(r => setTimeout(r, 1000));

  console.log('Events captured:', events);
  ws.close();
  process.exit(0);
}

main().catch(console.error);
