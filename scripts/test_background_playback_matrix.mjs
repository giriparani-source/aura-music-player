import { execSync } from 'child_process';

async function testMatrix() {
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

  // Helper to get screen power state
  function getScreenState() {
    const out = execSync('adb shell dumpsys power | grep "mWakefulness="', { encoding: 'utf-8' });
    return out.trim();
  }

  function turnScreenOff() {
    const state = getScreenState();
    if (state.includes('Awake')) {
      console.log('Turning screen OFF (sending KEYEVENT_POWER)...');
      execSync('adb shell input keyevent 26');
    }
  }

  function turnScreenOn() {
    const state = getScreenState();
    if (!state.includes('Awake')) {
      console.log('Turning screen ON...');
      execSync('adb shell input keyevent 224'); // WAKEUP
      execSync('adb shell wm dismiss-keyguard');
    }
  }

  function getMediaSessionDumpsys() {
    try {
      const out = execSync('adb shell dumpsys media_session | grep -A 8 "AuraAudioService"', { encoding: 'utf-8' });
      return out.trim();
    } catch {
      return 'No active AuraAudioService media session';
    }
  }

  // Ensure screen is on initially
  turnScreenOn();
  await new Promise(r => setTimeout(r, 1000));

  // Find candidate tracks from database:
  // 1. YouTube track
  // 2. JioSaavn track
  // 3. Local device track
  const tracksToTest = await evaluate(`
    new Promise((resolve) => {
      const req = indexedDB.open('AuraMusicDB', 2);
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('songs', 'readonly');
        const store = tx.objectStore('songs');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const songs = getAll.result || [];
          const ytTrack = songs.find(s => s.id && s.id.startsWith('online_'));
          const saavnTrack = songs.find(s => s.isSaavn || (s.filePath && s.filePath.includes('saavncdn.com')));
          const localTrack = songs.find(s => s.id && s.id.startsWith('device_'));
          resolve({ ytTrack, saavnTrack, localTrack });
        };
      };
    })
  `);

  console.log('\n============================================================');
  console.log('  TEST CANDIDATE TRACKS IDENTIFIED');
  console.log('============================================================');
  console.log('1. YouTube Track:', tracksToTest.ytTrack?.title, `(ID: ${tracksToTest.ytTrack?.id})`);
  console.log('2. JioSaavn Track:', tracksToTest.saavnTrack?.title, `(ID: ${tracksToTest.saavnTrack?.id})`);
  console.log('3. Local Track:', tracksToTest.localTrack?.title, `(ID: ${tracksToTest.localTrack?.id})`);

  const results = [];

  async function testSingleTrack(track, label, expectedSource) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`  TESTING [${label}]: "${track.title}"`);
    console.log(`------------------------------------------------------------`);

    turnScreenOn();
    await new Promise(r => setTimeout(r, 1000));

    // Clear logcat buffer before test
    execSync('adb logcat -c');

    // Trigger playback through app's playerStore
    console.log('Triggering playback in app...');
    const playResult = await evaluate(`
      (() => {
        // Access usePlayerStore from window or trigger via DOM click
        const songToPlay = ${JSON.stringify(track)};
        if (window.__AURA_PLAYER_STORE__) {
          window.__AURA_PLAYER_STORE__.getState().playSong(songToPlay);
          return { method: 'windowStore' };
        }
        // If not on window, navigate to library and click song row
        return { method: 'needDirectCall', song: songToPlay };
      })()
    `);

    // Let's call audioService.playSong directly if window.__AURA_PLAYER_STORE__ isn't global
    if (playResult.method === 'needDirectCall') {
      // Find row in DOM or evaluate import of audioService
      await evaluate(`
        (() => {
          // Play song via DOM SongRow or audio element
          const rows = Array.from(document.querySelectorAll('.virtual-song-row, [role="button"], div.cursor-pointer'));
          const target = rows.find(r => r.textContent && r.textContent.includes(${JSON.stringify(track.title)}));
          if (target) {
            target.click();
            return { clicked: true };
          }
          return { clicked: false };
        })()
      `);
    }

    // Wait 3 seconds for playback to begin
    await new Promise(r => setTimeout(r, 4000));

    // Check playback state Screen ON
    const screenOnState = await evaluate(`
      (() => {
        const audio = document.querySelector('audio');
        const iframe = document.querySelector('iframe#youtube-player') || document.querySelector('iframe');
        const playBtn = document.querySelector('button[title*="Pause"]') || document.querySelector('button[title*="Play"]');
        return {
          html5Playing: audio ? !audio.paused : false,
          html5CurrentTime: audio ? audio.currentTime : 0,
          html5Src: audio ? audio.src : '',
          hasIframe: !!iframe,
          iframeSrc: iframe ? iframe.src : '',
          uiPlayBtnTitle: playBtn ? playBtn.getAttribute('title') : ''
        };
      })()
    `);

    // Check native player via logcat / dumpsys
    const mediaSessionOn = getMediaSessionDumpsys();
    console.log('Screen ON State:');
    console.log(' - HTML5 audio playing:', screenOnState.html5Playing, 'currentTime:', screenOnState.html5CurrentTime);
    console.log(' - IFrame present:', screenOnState.hasIframe, 'src:', screenOnState.iframeSrc ? screenOnState.iframeSrc.substring(0, 60) : 'none');
    console.log(' - MediaSession status:', mediaSessionOn.split('\n')[0] || 'none');

    // Record position before turning screen off
    const pos1 = screenOnState.html5CurrentTime;

    // NOW TURN SCREEN OFF
    console.log('\n>>> TURNING SCREEN OFF (Simulating user locking phone)...');
    turnScreenOff();
    await new Promise(r => setTimeout(r, 2000));
    console.log('Current Wakefulness:', getScreenState());

    // Wait 30 seconds
    console.log('Waiting 30 seconds in SCREEN-OFF state...');
    await new Promise(r => setTimeout(r, 30000));

    // Check position after 30 seconds via CDP / evaluate
    let state30s = {};
    try {
      state30s = await evaluate(`
        (() => {
          const audio = document.querySelector('audio');
          return {
            html5Playing: audio ? !audio.paused : false,
            currentTime: audio ? audio.currentTime : 0
          };
        })()
      `);
    } catch (e) {
      state30s = { error: e.message };
    }
    const mediaSession30s = getMediaSessionDumpsys();
    console.log(`[Screen OFF 30s] Position: ${state30s.currentTime} (advancement: ${(state30s.currentTime - pos1).toFixed(1)}s)`);
    console.log(`[Screen OFF 30s] MediaSession: ${mediaSession30s.split('\n')[0] || 'none'}`);

    // Wait another 90 seconds (Total 2 minutes)
    console.log('Waiting another 90 seconds (Total 2 minutes in SCREEN-OFF)...');
    await new Promise(r => setTimeout(r, 90000));

    let state2m = {};
    try {
      state2m = await evaluate(`
        (() => {
          const audio = document.querySelector('audio');
          return {
            html5Playing: audio ? !audio.paused : false,
            currentTime: audio ? audio.currentTime : 0
          };
        })()
      `);
    } catch (e) {
      state2m = { error: e.message };
    }
    const mediaSession2m = getMediaSessionDumpsys();
    console.log(`[Screen OFF 2m] Position: ${state2m.currentTime} (advancement: ${(state2m.currentTime - pos1).toFixed(1)}s)`);

    // Capture logcat errors during screen off
    let logcatSnip = '';
    try {
      logcatSnip = execSync('adb logcat -d -t 100 | grep -E "AuraAudioService|ExoPlayer|Chromium|AudioService|MediaPlayer"', { encoding: 'utf-8' });
    } catch {
      logcatSnip = 'No logs';
    }

    turnScreenOn();
    await new Promise(r => setTimeout(r, 2000));

    const result = {
      title: track.title,
      label,
      expectedSource,
      screenOnState,
      state30s,
      state2m,
      mediaSession30s,
      mediaSession2m,
      logcatSnip: logcatSnip.split('\n').slice(-15).join('\n')
    };
    results.push(result);
  }

  // Run tests
  if (tracksToTest.ytTrack) {
    await testSingleTrack(tracksToTest.ytTrack, 'YouTube Stream', 'YouTube Cloud Player');
  }
  if (tracksToTest.saavnTrack) {
    await testSingleTrack(tracksToTest.saavnTrack, 'JioSaavn Stream', 'JioSaavn 320k Stream');
  }
  if (tracksToTest.localTrack) {
    await testSingleTrack(tracksToTest.localTrack, 'Local Device Track', 'Native ExoPlayer');
  }

  console.log('\n============================================================');
  console.log('  ALL PLAYBACK MATRIX TESTS COMPLETED');
  console.log('============================================================');

  ws.close();
}

testMatrix().catch(console.error);
