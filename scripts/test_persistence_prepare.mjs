async function main() {
  const jsonRes = await fetch('http://localhost:9222/json');
  const pages = await jsonRes.json();
  const page = pages.find((p) => p.url.includes('localhost'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      const val = msg.result?.result?.value !== undefined ? msg.result.result.value : msg.result;
      resolve(val);
    }
  });

  await new Promise((res) => ws.addEventListener('open', res));
  await send('Runtime.enable');

  console.log('1. Setting a song as favorite and preparing test playlist...');
  const prepResult = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = () => {
          const db = req.result;
          
          // Favorite a song
          const txSongs = db.transaction('songs', 'readwrite');
          const songStore = txSongs.objectStore('songs');
          const getSong = songStore.get('device_1000065012');
          
          getSong.onsuccess = () => {
            const song = getSong.result;
            if (song) {
              song.isFavorite = true;
              song.playCount = 5;
              songStore.put(song);
            }

            txSongs.oncomplete = () => {
              // Add a test playlist
              const txPlay = db.transaction('playlists', 'readwrite');
              const playStore = txPlay.objectStore('playlists');
              const testPlaylist = {
                id: 'playlist_persistence_test_1',
                name: 'Persistence Test Playlist',
                description: 'Verifying playlist survival across restarts',
                coverArt: '',
                songIds: ['device_1000065012', 'device_1000065013'],
                createdAt: Date.now(),
                updatedAt: Date.now()
              };
              playStore.put(testPlaylist);

              txPlay.oncomplete = () => {
                resolve({
                  favSongId: 'device_1000065012',
                  isFavorite: true,
                  playCount: 5,
                  testPlaylistId: testPlaylist.id
                });
              };
            };
          };
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Preparation Result:', JSON.stringify(prepResult, null, 2));

  ws.close();
  process.exit(0);
}

main().catch(console.error);
