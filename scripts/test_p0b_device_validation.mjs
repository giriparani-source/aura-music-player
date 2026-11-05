async function setupQueueAndTest() {
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

  console.log('=== SETTING UP MULTI-TRACK QUEUE FOR SCREEN-OFF TESTING ===');
  // Load playlist or 5 songs from library into player queue
  const queueResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const lib = window.__libraryStore.getState();
      const player = window.__playerStore.getState();
      
      // Get 5 playable songs with verified stream/path
      const candidateSongs = lib.songs.filter(s => s.filePath || s.path).slice(0, 10);
      
      // Play candidateSongs[0] with candidateSongs as the active queue!
      player.playSong(candidateSongs[0], candidateSongs, 0);
      
      return {
        queueLength: candidateSongs.length,
        song0: candidateSongs[0].title,
        song1: candidateSongs[1].title,
        song2: candidateSongs[2].title
      };
    })()`,
    returnByValue: true
  });

  console.log('Queue Setup:', queueResult.result?.result?.value);
  await new Promise(r => setTimeout(r, 4000));

  const playerState = await send('Runtime.evaluate', {
    expression: `(() => {
      const player = window.__playerStore.getState();
      return {
        currentTitle: player.currentSong?.title,
        queueIndex: player.queueIndex,
        queueLength: player.queue.length,
        isPlaying: player.isPlaying,
        currentTime: player.currentTime
      };
    })()`,
    returnByValue: true
  });

  console.log('Active Player State:', playerState.result?.result?.value);
  ws.close();
}

setupQueueAndTest().catch(console.error);
