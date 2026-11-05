import { execSync } from 'child_process';
import * as fs from 'fs';

function adb(cmd) {
  try {
    return execSync(`adb ${cmd}`, { encoding: 'utf-8', timeout: 15000 }).trim();
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

function getMediaSession() {
  const out = adb('shell dumpsys media_session');
  const posMatch = out.match(/state=([A-Z_]+)\((\d+)\),\s*position=(\d+)/);
  const descMatch = out.match(/description=([^\r\n]+)/);
  return {
    state: posMatch ? `${posMatch[1]}(${posMatch[2]})` : 'UNKNOWN',
    positionMs: posMatch ? parseInt(posMatch[3], 10) : 0,
    track: descMatch ? descMatch[1] : 'UNKNOWN'
  };
}

function getWakefulness() {
  return adb('shell "dumpsys power | grep mWakefulness="').replace(/\s+/g, ' ');
}

function ensureScreenAwake() {
  adb('shell input keyevent 224'); // KEYCODE_WAKEUP
}

function ensureScreenLocked() {
  const wake = getWakefulness();
  if (wake.includes('Awake')) {
    adb('shell input keyevent 26'); // KEYCODE_POWER
  }
}

async function run() {
  console.log('=== P0-B PHYSICAL DEVICE VALIDATION: SCREEN-OFF QUEUE PROGRESSION ===');

  // Wake screen first to ensure clean CDP attachment
  ensureScreenAwake();
  await new Promise(r => setTimeout(r, 1000));

  // Connect to CDP
  const listRes = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const callbacks = new Map();
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data);
      callbacks.delete(data.id);
    }
  };

  function send(method, params = {}) {
    return new Promise(resolve => {
      const id = msgId++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // --- Step 1: Verify Local Playback First ---
  console.log('\n--- 1. Testing Local Playback ---');
  const localTestRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const lib = window.__libraryStore.getState();
      const localTrack = lib.songs.find(s => s.filePath && s.filePath.startsWith('content://'));
      if (localTrack) {
        window.__playerStore.getState().playSong(localTrack, [localTrack], 0);
        return { started: localTrack.title, uri: localTrack.filePath };
      }
      return { error: 'No local track found' };
    })()`,
    returnByValue: true
  });
  console.log('Local Track Play Request:', localTestRes.result?.result?.value);
  await new Promise(r => setTimeout(r, 4000));
  let session = getMediaSession();
  console.log(`Local Playback Status: State=${session.state}, Pos=${(session.positionMs/1000).toFixed(1)}s, Track=${session.track}`);
  if (!session.state.includes('PLAYING')) {
    throw new Error('Local playback failed to enter PLAYING state!');
  }

  // --- Step 2: Set up 4-Track Sequential Online Queue for 3 Transitions ---
  console.log('\n--- 2. Setting up 4-Track Sequential Online Queue ---');
  const queueSetupRes = await send('Runtime.evaluate', {
    expression: `(() => {
      try {
        window.__playerStore.setState({
          isShuffle: false,
          shuffleMode: 'off',
          isFairShuffle: false,
          repeatMode: 'off',
          isAuraFlow: false
        });
        const player = window.__playerStore.getState();
        const tracks = [
          {
            id: 'q_test_1',
            title: 'Hukum - Thalaivar Alappara',
            artist: 'Anirudh Ravichander • Jailer',
            album: 'Jailer',
            duration: 236,
            artwork: 'https://c.saavncdn.com/187/Jailer-Tamil-2023-20230728081443-500x500.jpg',
            filePath: 'https://aac.saavncdn.com/187/0c4d0aee91a3ac81d4b645ec448a2960_320.mp4',
            path: 'https://aac.saavncdn.com/187/0c4d0aee91a3ac81d4b645ec448a2960_320.mp4',
            isOnline: true,
            isDirectAudioStream: true
          },
          {
            id: 'q_test_2',
            title: 'Arabic Kuthu - Halamithi Habibo',
            artist: 'Anirudh Ravichander, Jonita Gandhi • Beast',
            album: 'Beast',
            duration: 280,
            artwork: 'https://c.saavncdn.com/510/Beast-Tamil-2022-20220504184736-500x500.jpg',
            filePath: 'https://aac.saavncdn.com/510/9d96fc7ddd4ffadb745f25aed86f7a4e_320.mp4',
            path: 'https://aac.saavncdn.com/510/9d96fc7ddd4ffadb745f25aed86f7a4e_320.mp4',
            isOnline: true,
            isDirectAudioStream: true
          },
          {
            id: 'q_test_3',
            title: 'Naa Ready',
            artist: 'Thalapathy Vijay, Anirudh • Leo',
            album: 'Leo',
            duration: 248,
            artwork: 'https://c.saavncdn.com/415/Leo-Original-Motion-Picture-Soundtrack-English-2023-20231019170311-500x500.jpg',
            filePath: 'https://aac.saavncdn.com/415/3789bee89b94522160f1e50b2266d2c4_320.mp4',
            path: 'https://aac.saavncdn.com/415/3789bee89b94522160f1e50b2266d2c4_320.mp4',
            isOnline: true,
            isDirectAudioStream: true
          },
          {
            id: 'q_test_4',
            title: 'Illuminati',
            artist: 'Sushin Shyam, Dabzee • Aavesham',
            album: 'Aavesham',
            duration: 194,
            artwork: 'https://c.saavncdn.com/202/Aavesham-Original-Motion-Picture-Soundtrack-Malayalam-2024-20250910150630-500x500.jpg',
            filePath: 'https://aac.saavncdn.com/202/ba6006006a2f40e6b20b5ced32cc2885_320.mp4',
            path: 'https://aac.saavncdn.com/202/ba6006006a2f40e6b20b5ced32cc2885_320.mp4',
            isOnline: true,
            isDirectAudioStream: true
          }
        ];
        player.playSong(tracks[0], tracks, 0);
        return {
          started: tracks[0].title,
          isShuffle: player.isShuffle,
          repeatMode: player.repeatMode,
          queueLength: player.queue.length
        };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()`,
    returnByValue: true
  });
  console.log('Online Track 0 Play Request:', queueSetupRes.result?.result?.value);
  await new Promise(r => setTimeout(r, 4000));
  let sInit = getMediaSession();
  if (!sInit.state.includes('PLAYING')) {
    adb('shell cmd media_session dispatch play');
    await new Promise(r => setTimeout(r, 2000));
  }
  session = getMediaSession();
  console.log(`Online Playback (Screen ON): State=${session.state}, Pos=${(session.positionMs/1000).toFixed(1)}s, Track=${session.track}`);

  // --- Step 3: Lock the Physical Device ---
  console.log('\n--- 3. Locking Physical Device ---');
  ensureScreenLocked();
  await new Promise(r => setTimeout(r, 1500));
  console.log('Device Wakefulness:', getWakefulness());

  // Clear logcat buffer for clean trace
  adb('logcat -c');

  const transitionResults = [];

  // Helper function to test a natural track transition with screen OFF
  async function testNaturalTransition(transitionIndex, currentTrackDuration, seekOffsetSec, expectedNextTrackTitle) {
    console.log(`\n======================================================`);
    console.log(`Testing Natural Transition ${transitionIndex} -> ${expectedNextTrackTitle} with Screen OFF`);
    console.log(`======================================================`);

    const seekPos = currentTrackDuration - seekOffsetSec;
    console.log(`Seeking current track to ${seekPos}s (${seekOffsetSec}s before natural end) via CDP...`);
    
    // Seek via CDP store
    await send('Runtime.evaluate', {
      expression: `(() => {
        const player = window.__playerStore.getState();
        player.seek(${seekPos});
        if (!player.isPlaying) {
          player.togglePlay();
        }
        return { seeked: ${seekPos} };
      })()`,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1000));

    let s0 = getMediaSession();
    if (!s0.state.includes('PLAYING')) {
      adb('shell cmd media_session dispatch play');
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log('Screen Wakefulness before track end:', getWakefulness());
    console.log(`Waiting up to ${seekOffsetSec + 10}s for natural track completion (STATE_ENDED) and automatic progression...`);

    // Monitor second-by-second across the transition boundary
    for (let i = 0; i < seekOffsetSec + 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const s = getMediaSession();
      console.log(`  [T+${i}s] State=${s.state} | Pos=${(s.positionMs/1000).toFixed(1)}s | Track=${s.track.slice(0, 35)}...`);
      if (s.track.includes(expectedNextTrackTitle) && s.state.includes('PLAYING')) {
        console.log(`  -> Auto-transition to ${expectedNextTrackTitle} confirmed at T+${i}s!`);
        break;
      }
    }

    // Give 2s for audio pipeline to stabilize
    await new Promise(r => setTimeout(r, 2000));
    const finalSession = getMediaSession();
    const finalWake = getWakefulness();
    console.log(`\nTransition ${transitionIndex} Result:`);
    console.log(`  Expected Track Substring: ${expectedNextTrackTitle}`);
    console.log(`  Actual Track: ${finalSession.track}`);
    console.log(`  Actual State: ${finalSession.state}`);
    console.log(`  Screen Wakefulness: ${finalWake}`);

    const isMatch = finalSession.track.includes(expectedNextTrackTitle);
    const isPlaying = finalSession.state.includes('PLAYING');
    const isScreenOff = finalWake.includes('Asleep');

    const result = {
      transitionIndex,
      expectedNextTrackTitle,
      actualTrack: finalSession.track,
      state: finalSession.state,
      isScreenOff,
      success: isMatch && isPlaying && isScreenOff
    };
    transitionResults.push(result);

    if (!result.success) {
      console.error(`FAILED Transition ${transitionIndex}!`);
    } else {
      console.log(`>>> TRANSITION ${transitionIndex} PASSED! Automatically progressed to ${expectedNextTrackTitle} with screen OFF!`);
    }
    return result;
  }

  // --- Run Transition 1: Track 0 (Hukum 236s) -> Track 1 (Arabic Kuthu) ---
  const t1 = await testNaturalTransition(1, 236, 4, 'Arabic Kuthu');
  if (!t1.success) {
    console.error('Halting due to Transition 1 failure.');
  } else {
    // Let Arabic Kuthu play for 5 seconds with screen OFF
    console.log('Playing Arabic Kuthu continuously with screen OFF for 5s...');
    await new Promise(r => setTimeout(r, 5000));

    // --- Run Transition 2: Track 1 (Arabic Kuthu 280s) -> Track 2 (Naa Ready) ---
    const t2 = await testNaturalTransition(2, 280, 4, 'Naa Ready');
    if (!t2.success) {
      console.error('Halting due to Transition 2 failure.');
    } else {
      // Let Naa Ready play for 5 seconds with screen OFF
      console.log('Playing Naa Ready continuously with screen OFF for 5s...');
      await new Promise(r => setTimeout(r, 5000));

      // --- Run Transition 3: Track 2 (Naa Ready 248s) -> Track 3 (Illuminati) ---
      const t3 = await testNaturalTransition(3, 248, 4, 'Illuminati');
      if (t3.success) {
        console.log('\n>>> ALL 3 CONSECUTIVE SCREEN-OFF TRACK TRANSITIONS PASSED! <<<');
      }
    }
  }

  // --- Step 4: Verify Explicit Pause Stays Paused with Screen OFF ---
  console.log('\n--- 4. Testing Explicit Pause Behavior with Screen OFF ---');
  console.log('Dispatching explicit PAUSE via lock-screen media session...');
  adb('shell cmd media_session dispatch pause');
  await new Promise(r => setTimeout(r, 2000));
  let pauseSession = getMediaSession();
  console.log(`Initial Pause State: ${pauseSession.state}, Pos: ${(pauseSession.positionMs/1000).toFixed(1)}s`);

  console.log('Waiting 10s with screen OFF to verify explicit pause does NOT trigger next or resume...');
  await new Promise(r => setTimeout(r, 10000));
  let checkSession = getMediaSession();
  console.log(`After 10s Pause Check: State=${checkSession.state}, Pos=${(checkSession.positionMs/1000).toFixed(1)}s, Track=${checkSession.track}`);
  const explicitPausePassed = checkSession.state.includes('PAUSED') && Math.abs(checkSession.positionMs - pauseSession.positionMs) < 1000;
  console.log('Explicit Pause Safety Test Passed:', explicitPausePassed);

  // Capture Logcat
  console.log('\n--- 5. Capturing Logcat Diagnostics ---');
  const serviceLogs = adb('shell "logcat -d | grep AuraAudioService | tail -n 40"');
  console.log('AuraAudioService Transition Logs:\n', serviceLogs);

  const errorLogs = adb('shell "logcat -d -s AuraAudioService:E,AndroidRuntime:E,ExoPlayer:E | tail -n 20"');
  console.log('Logcat Errors (if any):\n', errorLogs || '(None)');

  ws.close();

  // Save report
  fs.writeFileSync('scripts/screen_off_transition_results.json', JSON.stringify({
    transitionResults,
    explicitPausePassed,
    serviceLogs,
    errorLogs
  }, null, 2));

  console.log('\n=== PHYSICAL VALIDATION SUITE COMPLETE ===');
}

run().catch(err => {
  console.error('Suite error:', err);
  process.exit(1);
});
