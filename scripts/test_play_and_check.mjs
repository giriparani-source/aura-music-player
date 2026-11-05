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
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map((a) => a.value || a.description).join(' '));
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

  console.log('Evaluating Play All...');
  const playRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const playAllBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Play All'));
          if (playAllBtn) {
            playAllBtn.click();
            return { clicked: true, text: playAllBtn.textContent };
          }
          // Alternative: click first song row
          const songRow = document.querySelector('[data-song-id]') || document.querySelector('.cursor-pointer');
          if (songRow) {
            songRow.click();
            return { clickedSongRow: true };
          }
          return { notFound: true };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Play Result:', playRes);

  await new Promise((r) => setTimeout(r, 2000));

  // Check player state
  const stateRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Query usePlayerStore state if accessible or DOM elements
        const currentTitle = document.querySelector('.bottom-player, [data-testid="bottom-player"]')?.textContent;
        return {
          hasBottomPlayer: Boolean(document.querySelector('footer') || document.querySelector('.fixed.bottom-0')),
          titleSnippet: document.body.innerText.substring(0, 300)
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Player State:', stateRes);

  ws.close();
  process.exit(0);
}

main().catch(console.error);
