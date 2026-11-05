import { execSync } from 'child_process';

function adb(cmd) {
  return execSync(`adb ${cmd}`, { encoding: 'utf-8' }).trim();
}

function getMediaSessionState() {
  const out = adb('shell dumpsys media_session');
  const auraSessionMatch = out.match(/AuraAudioService[\s\S]*?PlaybackState \{([^}]+)\}[\s\S]*?metadata: ([^\r\n]+)/);
  if (auraSessionMatch) {
    return {
      stateLine: auraSessionMatch[1],
      metadata: auraSessionMatch[2]
    };
  }
  return null;
}

function getScreenState() {
  const out = adb('shell "dumpsys power | grep mWakefulness"');
  return out;
}

async function run() {
  console.log('=== P0-B LOCKSCREEN CONTROLS & AUTO QUEUE PROGRESSION TEST ===');
  
  // 1. Connect to CDP
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

  // 2. Set up 3 JioSaavn tracks in queue
  console.log('\n--- Step 1: Setting up 3 JioSaavn tracks in queue ---');
  const setupRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const player = window.__playerStore.getState();
      const testTracks = [
        {
          id: 'jio_test_1',
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
          id: 'jio_test_2',
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
          id: 'jio_test_3',
          title: 'Naa Ready',
          artist: 'Thalapathy Vijay, Anirudh • Leo',
          album: 'Leo',
          duration: 248,
          artwork: 'https://c.saavncdn.com/415/Leo-Original-Motion-Picture-Soundtrack-English-2023-20231019170311-500x500.jpg',
          filePath: 'https://aac.saavncdn.com/415/3789bee89b94522160f1e50b2266d2c4_320.mp4',
          path: 'https://aac.saavncdn.com/415/3789bee89b94522160f1e50b2266d2c4_320.mp4',
          isOnline: true,
          isDirectAudioStream: true
        }
      ];
      player.playSong(testTracks[0], testTracks, 0);
      return { started: testTracks[0].title };
    })()`,
    returnByValue: true
  });
  console.log('Started track:', setupRes.result?.result?.value);

  // Wait 4 seconds for native ExoPlayer to start playing
  await new Promise(r => setTimeout(r, 4000));
  let session = getMediaSessionState();
  console.log('Screen-ON MediaSession state:', session?.stateLine);
  console.log('Screen-ON Metadata:', session?.metadata);

  // 3. Lock the screen
  console.log('\n--- Step 2: Locking the screen (Keyevent 26) ---');
  adb('shell input keyevent 26');
  await new Promise(r => setTimeout(r, 1500));
  const wakefulness = getScreenState();
  console.log('Screen state:\n', wakefulness);

  await new Promise(r => setTimeout(r, 2000));
  session = getMediaSessionState();
  console.log('Screen-OFF MediaSession state:', session?.stateLine);
  console.log('Screen-OFF Metadata:', session?.metadata);

  // 4. Test Pause via Lock-Screen Controls
  console.log('\n--- Step 3: Dispatching PAUSE via lock-screen media session ---');
  adb('shell cmd media_session dispatch pause');
  await new Promise(r => setTimeout(r, 1500));
  session = getMediaSessionState();
  console.log('After PAUSE state:', session?.stateLine);

  // 5. Test Play/Resume via Lock-Screen Controls
  console.log('\n--- Step 4: Dispatching PLAY via lock-screen media session ---');
  adb('shell cmd media_session dispatch play');
  await new Promise(r => setTimeout(r, 2000));
  session = getMediaSessionState();
  console.log('After RESUME state:', session?.stateLine);

  // 6. Test NEXT via Lock-Screen Controls
  console.log('\n--- Step 5: Dispatching NEXT via lock-screen media session ---');
  adb('shell cmd media_session dispatch next');
  await new Promise(r => setTimeout(r, 3500));
  session = getMediaSessionState();
  console.log('After NEXT state:', session?.stateLine);
  console.log('After NEXT Metadata:', session?.metadata);

  // 7. Test PREVIOUS via Lock-Screen Controls
  console.log('\n--- Step 6: Dispatching PREVIOUS via lock-screen media session ---');
  adb('shell cmd media_session dispatch previous');
  await new Promise(r => setTimeout(r, 3500));
  session = getMediaSessionState();
  console.log('After PREVIOUS state:', session?.stateLine);
  console.log('After PREVIOUS Metadata:', session?.metadata);

  // 8. Test Automatic Queue Progression with Screen OFF
  console.log('\n--- Step 7: Testing Automatic Queue Progression with Screen OFF ---');
  console.log('Seeking Hukum to 234s (track duration is ~236s, 2s remaining)...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.__playerStore.getState().seek(234);
      return { seeked: 234 };
    })()`,
    returnByValue: true
  });

  console.log('Waiting 5s for track to end and automatic next to fire while screen is OFF...');
  await new Promise(r => setTimeout(r, 6000));

  session = getMediaSessionState();
  console.log('Auto Progression MediaSession state:', session?.stateLine);
  console.log('Auto Progression Metadata:', session?.metadata);

  // Check if position advances over the next 4 seconds
  const pos1Match = session?.stateLine?.match(/position=(\d+)/);
  const pos1 = pos1Match ? parseInt(pos1Match[1], 10) : 0;
  console.log(`Position 1 at T+0s: ${pos1}ms`);

  await new Promise(r => setTimeout(r, 4000));
  session = getMediaSessionState();
  const pos2Match = session?.stateLine?.match(/position=(\d+)/);
  const pos2 = pos2Match ? parseInt(pos2Match[1], 10) : 0;
  console.log(`Position 2 at T+4s: ${pos2}ms`);
  console.log(`Advancement: ${pos2 - pos1}ms`);

  ws.close();
  console.log('\n=== LOCKSCREEN CONTROLS & AUTO PROGRESSION TEST FINISHED ===');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
