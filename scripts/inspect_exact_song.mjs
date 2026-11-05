// scripts/inspect_exact_song.mjs
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
  const res = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const lib = window.__libraryStore.getState();
        const s = lib.songs.find(x => x.title.includes('Otha Sollaala')) || lib.songs[0];
        const player = window.__playerStore.getState();
        return {
          song: s,
          currentPlaying: player.currentSong,
          isPlaying: player.isPlaying
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Song Details:', JSON.stringify(res.result?.result?.value, null, 2));
  ws.close();
}
main().catch(console.error);
