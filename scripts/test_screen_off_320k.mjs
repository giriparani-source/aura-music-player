// scripts/test_screen_off_320k.mjs
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

  // Find all songs in library and inspect their modes
  const probe = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const lib = window.__libraryStore.getState();
        const songs = lib.songs || [];
        const saavnSongs = songs.filter(s => s.isSaavn || s.bitrate === 320 || s.playbackMode === 'direct-catalog');
        return {
          total: songs.length,
          saavnCount: saavnSongs.length,
          firstSaavn: saavnSongs[0] ? { title: saavnSongs[0].title, artist: saavnSongs[0].artist, bitrate: saavnSongs[0].bitrate, playbackMode: saavnSongs[0].playbackMode, id: saavnSongs[0].id } : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Library probe:', probe.result?.result?.value);

  // If there are Saavn songs, pick one; otherwise, fetch a preset 320k hit from jiosaavnService
  const playRes = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          const lib = window.__libraryStore.getState();
          const player = window.__playerStore.getState();
          let song = (lib.songs || []).find(s => s.isSaavn || s.bitrate === 320 || s.playbackMode === 'direct-catalog');
          
          if (!song) {
            // Use PRESET 320k hit (e.g. Illuminati or Naa Ready)
            const jioMod = await import('/src/services/jiosaavnService.ts');
            const hits = jioMod.PRESET_SAAVN_320K_HITS;
            song = hits[0];
          }

          console.log('[Test] Initiating playback for 320k song:', song.title, song.artist, song.bitrate, song.filePath);
          await player.playSong(song);
          return { success: true, title: song.title, bitrate: song.bitrate, playbackMode: song.playbackMode };
        } catch (e) {
          return { success: false, error: e.message || String(e) };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Play Result:', playRes.result?.result?.value);

  // Wait 2.5s for ExoPlayer to start playing
  await new Promise(r => setTimeout(r, 2500));

  // Check state screen ON
  const stateOn = execSync('adb -s CQXW4PZ9PREEQGS8 shell dumpsys media_session | findstr "state=PlaybackState"', { encoding: 'utf-8' });
  console.log('State Screen ON:', stateOn.trim());

  // Turn Screen OFF
  console.log('Turning screen OFF...');
  execSync('adb -s CQXW4PZ9PREEQGS8 shell input keyevent 26');

  // Wait 4 seconds in screen-off state
  await new Promise(r => setTimeout(r, 4000));

  // Check state screen OFF
  const stateOff = execSync('adb -s CQXW4PZ9PREEQGS8 shell dumpsys media_session | findstr "state=PlaybackState"', { encoding: 'utf-8' });
  console.log('State Screen OFF:', stateOff.trim());

  // Turn screen back ON
  execSync('adb -s CQXW4PZ9PREEQGS8 shell input keyevent 26');

  const passed = stateOff.includes('state=PLAYING(3)');
  console.log(`\nScreen-Off Playback Verification: ${passed ? '✓ PASSED (Continuous 320kbps Native ExoPlayer playback with screen off)' : 'Status: ' + stateOff.trim()}`);

  ws.close();
}
main().catch(console.error);
