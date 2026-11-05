import { execSync } from 'child_process';

async function main() {
  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page');
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
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => callbacks.delete(id) && reject(new Error(`timeout ${method}`)), 30000);
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

  function getScreenState() {
    try {
      const out = execSync('adb shell dumpsys power', { encoding: 'utf-8' });
      const match = out.match(/mWakefulness=([a-zA-Z]+)/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  function turnScreenOff() {
    const state = getScreenState();
    console.log('Current Screen State before turning off:', state);
    if (state === 'Awake') {
      console.log('Action: Sending KEYEVENT_POWER (26) to turn screen OFF...');
      execSync('adb shell input keyevent 26');
      const newState = getScreenState();
      console.log('Screen state after keyevent 26:', newState);
    }
  }

  function turnScreenOn() {
    const state = getScreenState();
    console.log('Current Screen State before turning on:', state);
    if (state !== 'Awake') {
      console.log('Action: Turning screen ON...');
      execSync('adb shell input keyevent 224');
      execSync('adb shell wm dismiss-keyguard');
    }
  }

  function getMediaSessionState() {
    try {
      const out = execSync('adb shell dumpsys media_session', { encoding: 'utf-8' });
      const lines = out.split('\n');
      const serviceLine = lines.find(l => l.includes('AuraAudioService'));
      const stateLine = lines.find(l => l.includes('PlaybackState {state='));
      const metaLine = lines.find(l => l.includes('description='));
      return {
        service: serviceLine ? serviceLine.trim() : 'Not in session stack',
        state: stateLine ? stateLine.trim() : 'Unknown state',
        metadata: metaLine ? metaLine.trim() : 'No metadata'
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  function isAudioPlayingOS() {
    try {
      const out = execSync('adb shell dumpsys audio', { encoding: 'utf-8' });
      const activeStreams = out.includes('STREAM_MUSIC') || out.includes('state:started') || out.includes('PIID:');
      const playingLine = out.split('\n').find(l => l.includes('player PIID') && l.includes('state:started'));
      return { active: !!playingLine, line: playingLine ? playingLine.trim() : 'No active PIID player' };
    } catch (e) {
      return { active: false, error: e.message };
    }
  }

  // Wake screen initially
  turnScreenOn();
  await new Promise(r => setTimeout(r, 1000));

  console.log('Navigating to Favorite Songs playlist in UI...');
  await evaluate(`
    (() => {
      window.location.hash = '#/library';
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));

  await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const plBtn = buttons.find(b => b.textContent && b.textContent.includes('Playlists'));
      if (plBtn) plBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));

  await evaluate(`
    (() => {
      const cards = Array.from(document.querySelectorAll('div, button'));
      const favCard = cards.find(c => c.textContent && c.textContent.includes('Favorite Songs') && (c.className.includes('rounded') || c.className.includes('cursor-pointer')));
      if (favCard) favCard.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1500));

  const scenarios = [
    {
      name: 'Nenjukkule (YouTube Source)',
      searchTerm: 'Nenjukkule',
      sourceType: 'YouTube IFrame'
    },
    {
      name: 'Amizhdhe Nee (JioSaavn 320k Source)',
      searchTerm: 'Amizhdhe Nee',
      sourceType: 'JioSaavn 320k Stream'
    }
  ];

  const report = [];

  for (const sc of scenarios) {
    console.log('\n============================================================');
    console.log(`  STARTING TEST: ${sc.name} [${sc.sourceType}]`);
    console.log('============================================================');

    turnScreenOn();
    await new Promise(r => setTimeout(r, 1500));

    // Click the song
    const clickSong = await evaluate(`
      (() => {
        const elements = Array.from(document.querySelectorAll('div, p, span'));
        const target = elements.find(el => el.textContent && el.textContent.includes(${JSON.stringify(sc.searchTerm)}) && (el.closest('.cursor-pointer') || el.closest('[role="button"]')));
        const clickable = target ? (target.closest('.cursor-pointer') || target.closest('[role="button"]') || target) : null;
        if (clickable) {
          clickable.click();
          return { clicked: true, text: clickable.textContent.trim().substring(0, 60) };
        }
        return { clicked: false };
      })()
    `);
    console.log('Click song result:', clickSong);

    // Wait 5s for playback to start
    await new Promise(r => setTimeout(r, 5000));

    const engineOn = await evaluate(`
      (() => {
        const audio = document.querySelector('audio');
        const iframe = document.querySelector('iframe');
        return {
          html5Playing: audio ? !audio.paused : false,
          html5Time: audio ? audio.currentTime : 0,
          html5Src: audio ? audio.src : '',
          iframePresent: !!iframe,
          iframeSrc: iframe ? iframe.src : ''
        };
      })()
    `);

    const msOn = getMediaSessionState();
    const osAudioOn = isAudioPlayingOS();
    console.log('\n--- [1] SCREEN ON STATE ---');
    console.log('Player Engine:', engineOn.iframePresent ? 'YouTube IFrame Player' : (engineOn.html5Playing ? 'HTML5 Audio' : 'Unknown'));
    console.log('HTML5 Audio:', engineOn.html5Playing ? `PLAYING (pos: ${engineOn.html5Time.toFixed(1)}s)` : 'PAUSED/STOPPED');
    console.log('IFrame Present:', engineOn.iframePresent);
    console.log('MediaSession:', msOn.state, '|', msOn.metadata);
    console.log('OS Audio Hardware:', osAudioOn.line);

    // NOW LOCK PHONE SCREEN
    console.log('\n>>> [2] TURNING SCREEN OFF (Locking phone)...');
    turnScreenOff();
    await new Promise(r => setTimeout(r, 2000));
    console.log('Screen Wakefulness confirmed:', getScreenState());

    // 30 SECONDS CHECK
    console.log('\nWaiting 30 seconds with screen OFF...');
    await new Promise(r => setTimeout(r, 30000));

    const ms30s = getMediaSessionState();
    const osAudio30s = isAudioPlayingOS();
    console.log('--- [3] 30 SECONDS SCREEN OFF MEASUREMENTS ---');
    console.log('MediaSession:', ms30s.state, '|', ms30s.metadata);
    console.log('OS Audio Hardware:', osAudio30s.line);

    // 2 MINUTES CHECK (wait another 90s)
    console.log('\nWaiting another 90 seconds (Total 2 minutes screen off)...');
    await new Promise(r => setTimeout(r, 90000));

    const ms2m = getMediaSessionState();
    const osAudio2m = isAudioPlayingOS();
    console.log('--- [4] 2 MINUTES SCREEN OFF MEASUREMENTS ---');
    console.log('MediaSession:', ms2m.state, '|', ms2m.metadata);
    console.log('OS Audio Hardware:', osAudio2m.line);

    // Turn screen back ON
    console.log('\n>>> [5] TURNING SCREEN BACK ON...');
    turnScreenOn();
    await new Promise(r => setTimeout(r, 2000));

    const engineAfter = await evaluate(`
      (() => {
        const audio = document.querySelector('audio');
        const iframe = document.querySelector('iframe');
        return {
          html5Playing: audio ? !audio.paused : false,
          html5Time: audio ? audio.currentTime : 0
        };
      })()
    `);
    console.log('Engine after screen ON:', engineAfter);

    report.push({
      track: sc.name,
      sourceType: sc.sourceType,
      engine: engineOn.iframePresent ? 'YouTube IFrame (WebView)' : 'HTML5 Audio Element',
      screenOnState: { ms: msOn.state, os: osAudioOn.line },
      screenOff30s: { ms: ms30s.state, os: osAudio30s.line },
      screenOff2m: { ms: ms2m.state, os: osAudio2m.line },
      resumedAfter: engineAfter
    });
  }

  console.log('\n============================================================');
  console.log('  FINAL BACKGROUND PLAYBACK MATRIX REPORT');
  console.log('============================================================');
  console.dir(report, { depth: null });

  ws.close();
}

main().catch(console.error);
