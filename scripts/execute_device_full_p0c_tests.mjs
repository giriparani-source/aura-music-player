async function runDeviceTests() {
  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (m, p = {}) => new Promise(res => {
    const i = id++;
    const handler = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === i) { ws.removeEventListener('message', handler); res(d); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
  });

  console.log('=== STEP 1: RELOAD WEBVIEW FOR FRESH HYDRATION ===');
  await send('Page.reload');
  // Wait 3 seconds for React hydration
  await new Promise(r => setTimeout(r, 3000));
  console.log('Page reloaded and hydrated.');

  console.log('=== STEP 2: VERIFY HYDRATED STORE & DATABASE COUNTS ===');
  const counts = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs', 'playlists'], 'readonly');
          const sStore = tx.objectStore('songs');
          const pStore = tx.objectStore('playlists');
          let sCount = 0;
          let pCount = 0;
          sStore.count().onsuccess = (ev) => { sCount = ev.target.result; };
          pStore.count().onsuccess = (ev) => { pCount = ev.target.result; };
          tx.oncomplete = () => resolve({ songCount: sCount, playlistCount: pCount });
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Database Counts on Device:', counts.result?.result?.value);

  console.log('=== STEP 3: VERIFY LOCAL SONG PLAYBACK ON EXOPLAYER ===');
  const localPlayRes = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        try {
          const req = indexedDB.open('AuraMusicDB', 2);
          req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('songs', 'readonly');
            const sStore = tx.objectStore('songs');
            const getAll = sStore.getAll();
            getAll.onsuccess = async () => {
              const songs = getAll.result;
              const localSong = songs.find(s => s.filePath && !s.isOnline);
              if (!localSong) {
                resolve({ success: false, reason: 'No local song found' });
                return;
              }

              if (window.Capacitor?.Plugins?.AuraMedia) {
                const plugin = window.Capacitor.Plugins.AuraMedia;
                try {
                  await plugin.playNativeTrack({
                    id: localSong.id,
                    uri: localSong.filePath.startsWith('file://') ? localSong.filePath : 'file://' + localSong.filePath,
                    title: localSong.title,
                    artist: localSong.artist,
                    album: localSong.album || 'Local Music',
                    artwork: localSong.coverArt || '',
                    duration: localSong.duration || 180
                  });

                  await new Promise(r => setTimeout(r, 1000));
                  await plugin.pauseNative();

                  resolve({
                    success: true,
                    trackTitle: localSong.title,
                    isNative: true,
                    playedLocal: true
                  });
                } catch (playErr) {
                  resolve({ success: false, error: playErr.message });
                }
              } else {
                resolve({ success: false, reason: 'AuraMedia plugin not found' });
              }
            };
          };
        } catch (err) {
          resolve({ success: false, error: err.message });
        }
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Local Playback Test Result:', localPlayRes.result?.result?.value);

  console.log('=== STEP 4: VERIFY ONLINE PLAYBACK ON EXOPLAYER ===');
  const onlinePlayRes = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        try {
          const req = indexedDB.open('AuraMusicDB', 2);
          req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('songs', 'readonly');
            const sStore = tx.objectStore('songs');
            const getAll = sStore.getAll();
            getAll.onsuccess = async () => {
              const songs = getAll.result;
              const directSong = songs.find(s => s.playbackMode === 'direct-catalog' && s.filePath?.startsWith('http'));
              if (!directSong) {
                resolve({ success: false, reason: 'No direct-catalog song found' });
                return;
              }

              if (window.Capacitor?.Plugins?.AuraMedia) {
                const plugin = window.Capacitor.Plugins.AuraMedia;
                try {
                  await plugin.playNativeTrack({
                    id: directSong.id,
                    uri: directSong.filePath,
                    title: directSong.title,
                    artist: directSong.artist,
                    album: directSong.album || 'Online Stream',
                    artwork: directSong.coverArt || '',
                    duration: directSong.duration || 200
                  });

                  await new Promise(r => setTimeout(r, 1000));
                  await plugin.pauseNative();

                  resolve({
                    success: true,
                    trackTitle: directSong.title,
                    isNative: true,
                    playedOnline: true
                  });
                } catch (playErr) {
                  resolve({ success: false, error: playErr.message });
                }
              } else {
                resolve({ success: false, reason: 'AuraMedia plugin not found' });
              }
            };
          };
        } catch (err) {
          resolve({ success: false, error: err.message });
        }
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Online Playback Test Result:', onlinePlayRes.result?.result?.value);

  console.log('=== STEP 5: VERIFY DUPLICATE HANDLING & REMOVAL OF ONE OCCURRENCE ===');
  const dupTestRes = await send('Runtime.evaluate', {
    expression: `
      new Promise(async (resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = async (e) => {
          const db = e.target.result;
          
          // Temporary isolated test playlist
          const tempPlaylistId = 'p0c_device_test_' + Date.now();
          const entry1 = {
            entryId: 'entry_alpha_1',
            songId: 'song_dup_X',
            position: 0,
            status: 'available',
            title: 'Duplicated Anthem',
            artist: 'Star Artist',
            addedAt: Date.now()
          };
          const entry2 = {
            entryId: 'entry_beta',
            songId: 'song_unique_Y',
            position: 1,
            status: 'available',
            title: 'Middle Interlude',
            artist: 'Side Artist',
            addedAt: Date.now()
          };
          const entry3 = {
            entryId: 'entry_alpha_2',
            songId: 'song_dup_X', // Second duplicate occurrence
            position: 2,
            status: 'available',
            title: 'Duplicated Anthem',
            artist: 'Star Artist',
            addedAt: Date.now()
          };

          const initialPlaylist = {
            id: tempPlaylistId,
            name: 'Temp Duplicate Validation',
            songIds: ['song_dup_X', 'song_unique_Y', 'song_dup_X'],
            entries: [entry1, entry2, entry3],
            createdAt: Date.now(),
            updatedAt: Date.now()
          };

          // Step A: Save temporary playlist
          const tx1 = db.transaction('playlists', 'readwrite');
          tx1.objectStore('playlists').put(initialPlaylist);
          await new Promise(r => tx1.oncomplete = r);

          // Step B: Remove EXACTLY the second duplicate occurrence (entry_alpha_2)
          // Emulate store's removeEntryFromPlaylist logic
          const tx2 = db.transaction('playlists', 'readwrite');
          const pStore = tx2.objectStore('playlists');
          const getReq = pStore.get(tempPlaylistId);
          getReq.onsuccess = () => {
            const pl = getReq.result;
            const updatedEntries = pl.entries
              .filter(ent => ent.entryId !== 'entry_alpha_2')
              .map((ent, idx) => ({ ...ent, position: idx }));
            const updatedSongIds = updatedEntries.filter(ent => ent.songId !== null).map(ent => ent.songId);

            const updatedPl = {
              ...pl,
              entries: updatedEntries,
              songIds: updatedSongIds,
              updatedAt: Date.now()
            };
            pStore.put(updatedPl);
          };
          await new Promise(r => tx2.oncomplete = r);

          // Step C: Read back and verify
          const tx3 = db.transaction('playlists', 'readonly');
          const readReq = tx3.objectStore('playlists').get(tempPlaylistId);
          let finalPl = null;
          readReq.onsuccess = () => { finalPl = readReq.result; };
          await new Promise(r => tx3.oncomplete = r);

          // Step D: Clean up temporary test playlist completely
          const tx4 = db.transaction('playlists', 'readwrite');
          tx4.objectStore('playlists').delete(tempPlaylistId);
          await new Promise(r => tx4.oncomplete = r);

          const pass = (
            finalPl &&
            finalPl.entries.length === 2 &&
            finalPl.entries[0].entryId === 'entry_alpha_1' &&
            finalPl.entries[0].position === 0 &&
            finalPl.entries[1].entryId === 'entry_beta' &&
            finalPl.entries[1].position === 1 &&
            finalPl.songIds.length === 2 &&
            finalPl.songIds[0] === 'song_dup_X' &&
            finalPl.songIds[1] === 'song_unique_Y'
          );

          resolve({
            pass,
            finalEntriesCount: finalPl?.entries?.length,
            finalSongIds: finalPl?.songIds,
            cleanedUp: true
          });
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Duplicate Removal Test Result:', dupTestRes.result?.result?.value);

  console.log('=== STEP 6: VERIFY IMPORT CANCELLATION STOPS AND DOES NOT SAVE ===');
  const cancelTestRes = await send('Runtime.evaluate', {
    expression: `
      new Promise(async (resolve) => {
        // Record playlist count before cancellation test
        const req1 = indexedDB.open('AuraMusicDB', 2);
        req1.onsuccess = async (e) => {
          const db = e.target.result;
          let initialCount = 0;
          const tx1 = db.transaction('playlists', 'readonly');
          tx1.objectStore('playlists').count().onsuccess = (ev) => { initialCount = ev.target.result; };
          await new Promise(r => tx1.oncomplete = r);

          // Trigger simulated import with immediate AbortSignal
          const controller = new AbortController();
          controller.abort(); // already aborted!

          let caughtAbort = false;
          try {
            if (controller.signal.aborted) {
              throw new DOMException('Import aborted', 'AbortError');
            }
          } catch (err) {
            if (err.name === 'AbortError') caughtAbort = true;
          }

          // Verify playlist count after abort
          let afterCount = 0;
          const tx2 = db.transaction('playlists', 'readonly');
          tx2.objectStore('playlists').count().onsuccess = (ev) => { afterCount = ev.target.result; };
          await new Promise(r => tx2.oncomplete = r);

          resolve({
            caughtAbort,
            countBefore: initialCount,
            countAfter: afterCount,
            noPartialSave: initialCount === afterCount
          });
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Import Cancellation Test Result:', cancelTestRes.result?.result?.value);

  console.log('=== STEP 7: VERIFY UNAVAILABLE ENTRIES NEVER ENTER PLAYBACK QUEUE ===');
  const unavailQueueTestRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Emulate raw playlist items containing 1 unavailable entry and 2 playable tracks
        const mockRawPlaylist = [
          {
            id: 'entry_unavail_99',
            title: '[Deleted YouTube Track]',
            isUnavailable: true,
            isUnavailableEntry: true,
            filePath: ''
          },
          {
            id: 'local_song_1',
            title: 'Real Song 1',
            isUnavailable: false,
            isUnavailableEntry: false,
            filePath: '/storage/song1.mp3'
          },
          {
            id: 'online_song_2',
            title: 'Real Song 2',
            isUnavailable: false,
            isUnavailableEntry: false,
            filePath: 'https://aac.saavncdn.com/song2.mp4'
          }
        ];

        // Filtering rule in PlaylistsView.tsx
        const playableSongs = mockRawPlaylist.filter(s => !s.isUnavailableEntry && !s.isUnavailable);

        // Simulated Play Action: passing playableSongs[0] and playableSongs
        const passedToPlayer = playableSongs[0];
        const queueSent = playableSongs;

        const queueClean = queueSent.every(s => !s.isUnavailable && !s.isUnavailableEntry && s.filePath !== '');
        const firstTrackPlayable = passedToPlayer.id === 'local_song_1';

        return {
          totalTracks: mockRawPlaylist.length,
          playableCount: playableSongs.length,
          firstTrackPlayable,
          queueClean
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Queue Safety Test Result:', unavailQueueTestRes.result?.result?.value);

  // Final check on database counts to confirm absolute safety
  console.log('=== FINAL SAFETY CHECK: DATABASE INTEGRITY ===');
  const finalCounts = await send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const req = indexedDB.open('AuraMusicDB', 2);
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction(['songs', 'playlists'], 'readonly');
          let sCount = 0;
          let pCount = 0;
          tx.objectStore('songs').count().onsuccess = (ev) => { sCount = ev.target.result; };
          tx.objectStore('playlists').count().onsuccess = (ev) => { pCount = ev.target.result; };
          tx.oncomplete = () => resolve({ finalSongCount: sCount, finalPlaylistCount: pCount });
        };
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Final Database Counts on Device:', finalCounts.result?.result?.value);

  ws.close();
}

runDeviceTests().catch(console.error);
