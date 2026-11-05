// scripts/verify_artwork_modal.mjs
import { execSync } from 'child_process';

async function main() {
  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page' && t.url.includes('localhost'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const callbacks = new Map();
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.id && callbacks.has(d.id)) { callbacks.get(d.id)(d); callbacks.delete(d.id); }
  };
  function send(method, params = {}) {
    return new Promise((res) => { const msgId = id++; callbacks.set(msgId, res); ws.send(JSON.stringify({ id: msgId, method, params })); });
  }
  await send('Runtime.enable');

  // Open Now Playing modal by setting isNowPlayingOpen = true in player store
  console.log('1. Opening Now Playing Modal...');
  await send('Runtime.evaluate', {
    expression: 'window.__playerStore.setState({ isNowPlayingOpen: true })'
  });
  await new Promise(r => setTimeout(r, 800));

  // Inspect artwork dimensions & styling
  const artwork = await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Look for the main artwork container inside the modal
        const modal = document.querySelector('[role="dialog"]') || document.body;
        const squareContainers = Array.from(document.querySelectorAll('.aspect-square'));
        const images = squareContainers.map(c => {
          const img = c.querySelector('img');
          const rect = c.getBoundingClientRect();
          return {
            containerClass: c.className,
            containerWidth: Math.round(rect.width),
            containerHeight: Math.round(rect.height),
            aspectRatio: (rect.width / (rect.height || 1)).toFixed(2),
            isPerfectSquare: Math.abs(rect.width - rect.height) <= 1,
            imgSrc: img?.src?.slice(0, 50)
          };
        });
        return {
          containersFound: squareContainers.length,
          largestSquare: images.sort((a, b) => b.containerWidth - a.containerWidth)[0]
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Now Playing Artwork Inspection:', JSON.stringify(artwork.result?.result?.value, null, 2));

  // Capture screenshot via adb
  console.log('2. Capturing screenshot on device...');
  execSync('adb -s CQXW4PZ9PREEQGS8 shell screencap -p /sdcard/nowplaying_artwork_v125.png');
  execSync('adb -s CQXW4PZ9PREEQGS8 pull /sdcard/nowplaying_artwork_v125.png "d:\\music player\\nowplaying_artwork_v125.png"');
  console.log('✓ Screenshot saved to d:\\music player\\nowplaying_artwork_v125.png');

  ws.close();
}
main().catch(console.error);
