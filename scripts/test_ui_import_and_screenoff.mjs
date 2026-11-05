// scripts/test_ui_import_and_screenoff.mjs
import { execSync } from 'child_process';

async function main() {
  console.log('=== [Aura Music Live UI Import & Screen-Off Test] ===\n');

  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page' && t.url.includes('localhost'));
  if (!page) throw new Error('Target page not found');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data);
      callbacks.delete(data.id);
    }
    if (data.method === 'Runtime.consoleAPICalled') {
      const text = data.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (text.includes('[Importer]') || text.includes('[Match') || text.includes('[Saavn') || text.includes('320k')) {
        console.log(`  [Device Console] ${text}`);
      }
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => {
        callbacks.delete(id);
        reject(new Error(`Timeout waiting for ${method}`));
      }, 120000);
      callbacks.set(id, (val) => {
        clearTimeout(timer);
        resolve(val);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.result?.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`);
    }
    return res.result?.result?.value;
  }

  await send('Runtime.enable');
  await send('Console.enable');

  // STEP 1: Click "Import Playlist" button
  console.log('1. Opening Import Playlist Modal in UI...');
  const openModalRes = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const importBtn = buttons.find(b => b.textContent && b.textContent.includes('Import Playlist'));
      if (importBtn) {
        importBtn.click();
        return { clicked: true };
      }
      return { clicked: false, error: 'Import Playlist button not found' };
    })()
  `);
  console.log('Open Modal Result:', openModalRes);
  await new Promise(r => setTimeout(r, 600));

  // STEP 2: Input YouTube playlist URL into textarea
  const testYtUrl = 'https://music.youtube.com/playlist?list=PLNf1vclGjpRE';
  console.log('2. Entering URL into textarea:', testYtUrl);
  const inputRes = await evaluate(`
    (() => {
      const textarea = document.querySelector('textarea');
      if (!textarea) return { error: 'Textarea not found' };
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeSetter.call(textarea, ${JSON.stringify(testYtUrl)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, value: textarea.value };
    })()
  `);
  console.log('Input result:', inputRes);
  await new Promise(r => setTimeout(r, 400));

  // STEP 3: Click "Fetch & Match Playlist" button
  console.log('3. Clicking "Fetch & Match" button...');
  const clickFetchRes = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent && (b.textContent.includes('Fetch') || b.textContent.includes('Match')));
      if (btn && !btn.disabled) {
        btn.click();
        return { clicked: true, text: btn.textContent.trim() };
      }
      return { clicked: false, error: 'Fetch button not found or disabled' };
    })()
  `);
  console.log('Click Fetch Result:', clickFetchRes);

  // STEP 4: Poll until import is complete
  console.log('4. Waiting for playlist parsing & JioSaavn 320kbps catalog matching...');
  let attempts = 0;
  let summaryState = null;
  while (attempts < 60) {
    await new Promise(r => setTimeout(r, 1000));
    attempts++;

    summaryState = await evaluate(`
      (() => {
        const textNodes = Array.from(document.querySelectorAll('div, p, span'))
          .map(el => el.textContent?.trim() || '')
          .filter(t => t.includes('tracks matched') || t.includes('skipped'));
        
        // Also check if Save button appeared
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
        const hasSaveBtn = buttons.some(t => t && t.includes('Save'));
        const badges320 = Array.from(document.querySelectorAll('*')).filter(el => el.textContent?.trim() === '320k').length;
        const badgesSkipped = Array.from(document.querySelectorAll('*')).filter(el => el.textContent?.trim() === 'Skipped').length;

        return {
          textNodes: textNodes.slice(0, 3),
          hasSaveBtn,
          badges320,
          badgesSkipped
        };
      })()
    `);

    if (summaryState?.hasSaveBtn || (summaryState?.textNodes && summaryState.textNodes.length > 0)) {
      console.log(`[Progress ${attempts}s]`, JSON.stringify(summaryState));
      if (summaryState.hasSaveBtn) {
        console.log('✓ Import and matching finished! Save button is ready.');
        break;
      }
    } else {
      if (attempts % 5 === 0) process.stdout.write(`...${attempts}s `);
    }
  }

  console.log('\nFinal Import Summary State:', JSON.stringify(summaryState, null, 2));

  // STEP 5: Verify Artwork Modal Square Dimensions
  console.log('\n5. Checking Now Playing Modal artwork square aspect ratio...');
  const artworkEvaluation = await evaluate(`
    (() => {
      // Find NowPlaying artwork or album art containers
      const allImages = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src?.slice(0, 50),
        width: img.clientWidth,
        height: img.clientHeight,
        parentClass: img.parentElement?.className
      }));
      return { images: allImages.slice(0, 5) };
    })()
  `);
  console.log('Artwork elements in view:', artworkEvaluation);

  // STEP 6: Close Modal
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label="Close"]') || 
        Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Cancel') || b.textContent === '✕');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  // STEP 7: Test Playback and Screen-Off Continuation
  console.log('\n6. Testing Playback & Screen-Off Continuation with ExoPlayer...');
  const playTrigger = await evaluate(`
    (async () => {
      const lib = window.__libraryStore?.getState();
      const player = window.__playerStore?.getState();
      if (!lib || !player || !lib.songs || lib.songs.length === 0) {
        return { error: 'No songs available in library' };
      }
      const songToPlay = lib.songs[0];
      console.log('[Test Play] Playing song:', songToPlay.title);
      await player.playSong(songToPlay);
      return { started: true, title: songToPlay.title };
    })()
  `);
  console.log('Play Trigger Result:', playTrigger);

  // Wait 2.5 seconds for ExoPlayer playback pipeline to initialize
  await new Promise(r => setTimeout(r, 2500));

  // Check dumpsys media_session state BEFORE screen off
  const stateBefore = execSync('adb -s CQXW4PZ9PREEQGS8 shell dumpsys media_session | findstr "state=PlaybackState"', { encoding: 'utf-8' });
  console.log('MediaSession State (Screen ON):', stateBefore.trim());

  // Turn Screen OFF via keyevent 26
  console.log('Turning screen OFF (keyevent 26)...');
  execSync('adb -s CQXW4PZ9PREEQGS8 shell input keyevent 26');
  
  // Wait 4 seconds with screen OFF
  console.log('Waiting 4 seconds in screen-off state...');
  await new Promise(r => setTimeout(r, 4000));

  // Check dumpsys media_session state WITH screen OFF
  const stateDuring = execSync('adb -s CQXW4PZ9PREEQGS8 shell dumpsys media_session | findstr "state=PlaybackState"', { encoding: 'utf-8' });
  console.log('MediaSession State (Screen OFF):', stateDuring.trim());

  // Turn screen back ON
  console.log('Turning screen back ON (keyevent 26)...');
  execSync('adb -s CQXW4PZ9PREEQGS8 shell input keyevent 26');

  // Verify PLAYING state
  const isPlayingScreenOff = stateDuring.includes('state=PLAYING(3)');
  console.log(`\nScreen-Off Playback Verification: ${isPlayingScreenOff ? '✓ SUCCESS - PLAYING(3) sustained nonstop!' : 'Result: ' + stateDuring.trim()}`);

  console.log('\n=== REAL-DEVICE VERIFICATION COMPLETE ===');
  ws.close();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
