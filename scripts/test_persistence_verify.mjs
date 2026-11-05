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

  console.log('1. Checking IndexedDB persistence after app restart...');
  const verifyResult = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = () => {
          const db = req.result;

          // 1. Check songs
          const txSongs = db.transaction('songs', 'readonly');
          const songStore = txSongs.objectStore('songs');
          const getAllSongs = songStore.getAll();

          getAllSongs.onsuccess = () => {
            const songs = getAllSongs.result;
            const favTrack = songs.find(s => s.id === 'device_1000065012');
            const unindexedTrack = songs.find(s => s.id === 'device_1000050465');

            // 2. Check playlists
            const txPlay = db.transaction('playlists', 'readonly');
            const playStore = txPlay.objectStore('playlists');
            const getAllPlaylists = playStore.getAll();

            getAllPlaylists.onsuccess = () => {
              const playlists = getAllPlaylists.result;
              const testPlaylist = playlists.find(p => p.id === 'playlist_persistence_test_1');

              // 3. Check settings
              const txSet = db.transaction('settings', 'readonly');
              const setStore = txSet.objectStore('settings');
              const getAllSettings = setStore.getAll();

              getAllSettings.onsuccess = () => {
                resolve({
                  totalSongsPersisted: songs.length,
                  favTrackFound: Boolean(favTrack),
                  favTrackIsFavorite: favTrack ? favTrack.isFavorite : false,
                  favTrackPlayCount: favTrack ? favTrack.playCount : 0,
                  unindexedTrackRemainsGone: !Boolean(unindexedTrack),
                  totalPlaylists: playlists.length,
                  testPlaylistFound: Boolean(testPlaylist),
                  testPlaylistSongIds: testPlaylist ? testPlaylist.songIds : [],
                  totalSettings: getAllSettings.result.length
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

  console.log('Persistence Verification Result:', JSON.stringify(verifyResult, null, 2));

  ws.close();
  process.exit(0);
}

main().catch(console.error);
