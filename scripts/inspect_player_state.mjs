async function check() {
  const list = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.id === 1) {
      console.log('PLAYER STORE STATE:', JSON.stringify(data.result?.result?.value, null, 2));
      process.exit(0);
    }
  };

  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const p = window.__playerStore?.getState();
        return {
          currentSongTitle: p?.currentSong?.title,
          currentSongId: p?.currentSong?.id,
          isPlaying: p?.isPlaying,
          queueLength: p?.queue?.length,
          queueIndex: p?.queueIndex,
          queueTitles: p?.queue?.slice(0, 5).map(s => s.title),
          isShuffle: p?.isShuffle,
          repeatMode: p?.repeatMode
        };
      })()`,
      returnByValue: true
    }
  }));
}
check().catch(e => { console.error(e); process.exit(1); });
