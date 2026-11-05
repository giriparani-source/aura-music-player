async function runYtImport() {
  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const callbacks = new Map();
  const logs = [];

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data);
      callbacks.delete(data.id);
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      const text = data.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      logs.push(`[${data.params.type}] ${text}`);
      console.log(`[Device Console ${data.params.type}]`, text);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => callbacks.delete(id) && reject(new Error(`timeout ${method}`)), 120000);
      callbacks.set(id, (val) => { clearTimeout(timer); resolve(val); });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.result?.exceptionDetails) {
      throw new Error(JSON.stringify(res.result.exceptionDetails));
    }
    return res.result?.result?.value;
  }

  // Enable console logging
  await send('Runtime.enable');

  const ytUrl = 'https://music.youtube.com/playlist?list=PLNf1vclGjpRE&si=4EISxf4mp374ccEc';
  console.log('Testing YouTube Music import on device with URL:', ytUrl);

  // Set the textarea value and trigger React's synthetic change event
  const inputSet = await evaluate(`
    (() => {
      const textarea = document.querySelector('textarea');
      if (!textarea) return { error: 'No textarea found' };
      
      // Use native setter to trigger React onChange
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeSetter.call(textarea, ${JSON.stringify(ytUrl)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, value: textarea.value };
    })()
  `);
  console.log('Input set result:', inputSet);

  await new Promise(r => setTimeout(r, 1000));

  // Find and click the "Import Playlist" button inside the modal
  const clickRes = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      // Find button in footer with "Import Playlist"
      const btn = buttons.find(b => {
        const txt = b.textContent?.trim();
        return txt === 'Import Playlist' && b.closest('.bg-\\[\\#11131a\\]');
      }) || buttons.find(b => b.textContent?.includes('Import Playlist') && b.className.includes('from-cyan-500'));
      
      if (!btn) return { error: 'Button not found', buttons: buttons.map(b => b.textContent?.trim()) };
      if (btn.disabled) return { error: 'Button is disabled', text: btn.textContent };
      btn.click();
      return { clicked: true, text: btn.textContent?.trim() };
    })()
  `);
  console.log('Click Import button result:', clickRes);

  if (!clickRes.clicked) {
    console.error('Failed to click import button!');
    ws.close();
    return;
  }

  console.log('Waiting for import process to complete (polling progress)...');
  let startTime = Date.now();
  let completed = false;
  let lastStatus = '';

  while (Date.now() - startTime < 180000) { // 3 minutes max
    await new Promise(r => setTimeout(r, 2000));
    const state = await evaluate(`
      (() => {
        const errorEl = document.querySelector('.bg-rose-500\\/10');
        const progressStatus = document.querySelector('.animate-spin')?.parentElement?.textContent || 
                               document.querySelector('.text-cyan-400.font-semibold')?.textContent;
        const percentEl = document.querySelector('.font-mono.text-\\[11px\\]')?.textContent;
        const resultCard = document.querySelector('.text-cyan-400.uppercase')?.textContent;
        const previewSongs = Array.from(document.querySelectorAll('.max-h-48 p.text-white')).map(p => p.textContent);
        
        return {
          error: errorEl ? errorEl.textContent?.trim() : null,
          progressStatus,
          percent: percentEl,
          isResultReady: !!resultCard,
          resultReadyText: resultCard,
          previewSongsCount: previewSongs.length
        };
      })()
    `);

    if (state.error) {
      console.error('Import ERROR on device:', state.error);
      break;
    }

    if (state.progressStatus && state.progressStatus !== lastStatus) {
      lastStatus = state.progressStatus;
      console.log(`[Progress ${state.percent || '?'}]`, state.progressStatus);
    }

    if (state.isResultReady) {
      console.log('IMPORT COMPLETED! Result ready on screen.');
      completed = true;
      break;
    }
  }

  // Get full details of result
  const finalDetails = await evaluate(`
    (() => {
      const titleInput = document.querySelector('input.font-bold.text-base');
      const subtitle = document.querySelector('.text-xs.text-neutral-400.mt-0\\.5');
      const songElements = Array.from(document.querySelectorAll('.max-h-48 .rounded-lg'));
      const songs = songElements.map(el => {
        const title = el.querySelector('p.text-white')?.textContent?.trim();
        const artist = el.querySelector('p.text-neutral-400')?.textContent?.trim();
        const badge = el.querySelector('span.rounded')?.textContent?.trim();
        return { title, artist, badge };
      });

      return {
        title: titleInput ? titleInput.value : null,
        subtitle: subtitle ? subtitle.textContent?.trim() : null,
        songsCount: songs.length,
        songs: songs
      };
    })()
  `);

  console.log('\n--- Final Import Summary ---');
  console.log('Title:', finalDetails.title);
  console.log('Subtitle:', finalDetails.subtitle);
  console.log('Songs Count in preview:', finalDetails.songsCount);

  ws.close();
}

runYtImport().catch(console.error);
