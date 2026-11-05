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

  console.log('1. Clicking Play in Mini Player...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Mini player play/pause button
        const buttons = Array.from(document.querySelectorAll('button'));
        const playBtn = buttons.find(b => b.querySelector('svg.lucide-play') || b.className.includes('rounded-full bg-white'));
        if (playBtn) {
          playBtn.click();
          return { clicked: true, className: playBtn.className };
        }
        return { clicked: false, buttons: buttons.map(b => b.className).slice(0, 10) };
      })()
    `,
    returnByValue: true
  });
  console.log('Click result:', clickRes);

  // Wait 2 seconds for audio pipeline to engage
  await new Promise(r => setTimeout(r, 2000));

  // Check state before sleep
  const stateBefore = execSync('adb shell "dumpsys media_session | grep -A 3 -i \'state=PlaybackState\'"').toString();
  console.log('State Before Sleep:\n' + stateBefore.trim());

  console.log('2. Locking screen (power button)...');
  execSync('adb shell input keyevent 26');

  console.log('3. Waiting 5 seconds while locked...');
  await new Promise(r => setTimeout(r, 5000));

  // Check state during lock
  const stateDuring = execSync('adb shell "dumpsys media_session | grep -A 3 -i \'state=PlaybackState\'"').toString();
  console.log('State During Lock:\n' + stateDuring.trim());

  console.log('4. Waking phone screen...');
  execSync('adb shell input keyevent 26');
  execSync('adb shell wm dismiss-keyguard');

  ws.close();
  process.exit(0);
}

main().catch(console.error);
