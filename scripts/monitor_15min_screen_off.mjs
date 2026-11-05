import { execSync } from 'child_process';
import * as fs from 'fs';

function adb(cmd) {
  try {
    return execSync(`adb ${cmd}`, { encoding: 'utf-8', timeout: 15000 }).trim();
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

function getMediaSessionState() {
  const out = adb('shell dumpsys media_session');
  const auraSessionMatch = out.match(/AuraAudioService[\s\S]*?PlaybackState \{([^}]+)\}[\s\S]*?metadata: ([^\r\n]+)/);
  if (auraSessionMatch) {
    const stateStr = auraSessionMatch[1];
    const metaStr = auraSessionMatch[2];
    const posMatch = stateStr.match(/position=(\d+)/);
    const stateMatch = stateStr.match(/state=([A-Z_]+)\((\d+)\)/);
    return {
      rawState: stateStr,
      stateName: stateMatch ? stateMatch[1] : 'UNKNOWN',
      stateCode: stateMatch ? stateMatch[2] : '-1',
      positionMs: posMatch ? parseInt(posMatch[1], 10) : 0,
      metadata: metaStr
    };
  }
  return null;
}

function getWakefulness() {
  const out = adb('shell "dumpsys power | grep mWakefulness="');
  return out.replace(/\s+/g, ' ');
}

async function run() {
  console.log('=== STARTING 15-MINUTE SCREEN-OFF PLAYBACK VALIDATION ===');
  console.log('Start Time:', new Date().toISOString());

  // 1. First ensure queue has 6 full-length tracks (25 min total)
  console.log('\n--- Ensuring Queue has 6 Full-Length Tracks ---');
  try {
    const listRes = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
    const page = listRes.find(t => t.type === 'page');
    if (page) {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise(r => ws.onopen = r);
      let id = 1;
      const send = (method, params = {}) => new Promise(res => {
        const msgId = id++;
        const handler = (e) => {
          const d = JSON.parse(e.data);
          if (d.id === msgId) {
            ws.removeEventListener('message', handler);
            res(d);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });

      await send('Runtime.evaluate', {
        expression: `(() => {
          const player = window.__playerStore.getState();
          const queueTracks = [
            {
              id: 'jio_1',
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
              id: 'jio_2',
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
              id: 'jio_3',
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
              id: 'jio_4',
              title: 'Illuminati',
              artist: 'Sushin Shyam, Dabzee • Aavesham',
              album: 'Aavesham',
              duration: 194,
              artwork: 'https://c.saavncdn.com/202/Aavesham-Original-Motion-Picture-Soundtrack-Malayalam-2024-20250910150630-500x500.jpg',
              filePath: 'https://aac.saavncdn.com/202/ba6006006a2f40e6b20b5ced32cc2885_320.mp4',
              path: 'https://aac.saavncdn.com/202/ba6006006a2f40e6b20b5ced32cc2885_320.mp4',
              isOnline: true,
              isDirectAudioStream: true
            },
            {
              id: 'jio_5',
              title: 'Manasilaayo',
              artist: 'Anirudh, Malaysia Vasudevan • Vettaiyan',
              album: 'Vettaiyan',
              duration: 255,
              artwork: 'https://c.saavncdn.com/803/Vettaiyan-Original-Motion-Picture-Soundtrack-Tamil-2024-20241014154253-500x500.jpg',
              filePath: 'https://aac.saavncdn.com/803/54aa7ee23bad8894b04c1250a64a2f0a_320.mp4',
              path: 'https://aac.saavncdn.com/803/54aa7ee23bad8894b04c1250a64a2f0a_320.mp4',
              isOnline: true,
              isDirectAudioStream: true
            },
            {
              id: 'jio_6',
              title: 'Vaseegara',
              artist: 'Bombay Jayashri, Harris Jayaraj • Minnale',
              album: 'Minnale',
              duration: 301,
              artwork: 'https://c.saavncdn.com/450/2-In-1-Hits-Of-Maddy-Tamil-2001-20190515150512-500x500.jpg',
              filePath: 'https://aac.saavncdn.com/450/4f7b9da8e887586e60b11afb602befac_320.mp4',
              path: 'https://aac.saavncdn.com/450/4f7b9da8e887586e60b11afb602befac_320.mp4',
              isOnline: true,
              isDirectAudioStream: true
            }
          ];
          player.playSong(queueTracks[0], queueTracks, 0);
          return { queueLength: queueTracks.length, playing: queueTracks[0].title };
        })()`,
        returnByValue: true
      });
      ws.close();
    }
  } catch (e) {
    console.log('Notice configuring queue via CDP:', e.message);
  }

  // 2. Wait 3 seconds, then lock the screen
  await new Promise(r => setTimeout(r, 3000));
  let wake = getWakefulness();
  if (!wake.includes('Asleep')) {
    console.log('Locking screen with Keyevent 26...');
    adb('shell input keyevent 26');
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('Confirmed Screen Wakefulness:', getWakefulness());

  // Clear previous logcat buffer for clean monitoring
  adb('logcat -c');

  const startTime = Date.now();
  const samples = [];
  const TOTAL_DURATION_MS = 15 * 60 * 1000 + 30 * 1000; // 15m 30s
  const INTERVAL_MS = 60 * 1000; // 60s sample interval

  console.log(`\nMonitoring for ${TOTAL_DURATION_MS / 1000}s (~15.5 minutes) with samples every 60s...`);

  let lastTrack = '';
  let lastPos = 0;
  let sampleCount = 0;

  while (Date.now() - startTime < TOTAL_DURATION_MS) {
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const session = getMediaSessionState();
    const wakeState = getWakefulness();

    let posDelta = 0;
    if (session) {
      if (session.metadata === lastTrack) {
        posDelta = session.positionMs - lastPos;
      } else {
        // Track changed!
        posDelta = session.positionMs; // New track started
      }
      lastTrack = session.metadata;
      lastPos = session.positionMs;
    }

    const sample = {
      sampleIndex: ++sampleCount,
      elapsedSec,
      wakeState,
      stateName: session?.stateName || 'NO_SESSION',
      positionMs: session?.positionMs || 0,
      posDelta,
      metadata: session?.metadata || 'NONE'
    };
    samples.push(sample);

    console.log(`[T+${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s] State: ${sample.stateName} | Pos: ${(sample.positionMs / 1000).toFixed(1)}s | Delta: ${(sample.posDelta / 1000).toFixed(1)}s | Track: ${sample.metadata.slice(0, 45)}...`);

    // Safety check: if audio stopped unexpectedly, log immediately
    if (sample.stateName !== 'PLAYING') {
      console.warn(`[WARNING] Non-playing state detected at T+${elapsedSec}s: ${sample.stateName}`);
    }

    // Sleep 60 seconds until next sample
    const remainingTime = TOTAL_DURATION_MS - (Date.now() - startTime);
    if (remainingTime <= 0) break;
    const sleepTime = Math.min(INTERVAL_MS, remainingTime);
    await new Promise(r => setTimeout(r, sleepTime));
  }

  // 15-Minute Test Completed!
  const totalElapsed = (Date.now() - startTime) / 1000;
  console.log('\n=== 15-MINUTE MONITORING COMPLETED ===');
  console.log(`Total Elapsed Time: ${(totalElapsed / 60).toFixed(2)} minutes (${totalElapsed.toFixed(0)} seconds)`);

  // Final State Inspection
  const finalSession = getMediaSessionState();
  const finalWake = getWakefulness();
  console.log('Final Wakefulness:', finalWake);
  console.log('Final State:', finalSession?.stateName, 'Position:', (finalSession?.positionMs / 1000).toFixed(1) + 's');
  console.log('Final Metadata:', finalSession?.metadata);

  // Capture Logcat errors
  console.log('\n--- Checking Logcat for Errors ---');
  const logcatErrors = adb('logcat -d -s AuraAudioService:W,AuraAudioService:E,AndroidRuntime:E,ExoPlayer:E,ExoPlayerImpl:E');
  console.log('Logcat Summary:\n', logcatErrors.slice(0, 1500) || '(No error logs found)');

  // Save report artifact
  const report = {
    test: 'P0-B 15-Minute Uninterrupted Screen-Off Playback',
    startTime: new Date(startTime).toISOString(),
    endTime: new Date().toISOString(),
    totalElapsedSeconds: totalElapsed,
    samples,
    logcatErrors
  };
  fs.writeFileSync('scripts/15min_validation_report.json', JSON.stringify(report, null, 2));
  console.log('\nFull report saved to scripts/15min_validation_report.json');
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
