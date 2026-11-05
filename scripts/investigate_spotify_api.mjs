async function testSpotifyToken() {
  console.log('Testing anonymous Spotify token retrieval...');
  try {
    const res = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    console.log('Token endpoint status:', res.status);
    const data = await res.json();
    console.log('Token received:', !!data.accessToken, 'isAnonymous:', data.isAnonymous);
    
    if (data.accessToken) {
      const playlistId = '796bkCyjh8Bk2w9QDICrJv';
      const plRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,tracks.total`, {
        headers: { 'Authorization': `Bearer ${data.accessToken}` }
      });
      console.log('Playlist metadata status:', plRes.status);
      const plData = await plRes.json();
      console.log('Spotify Playlist Name:', plData.name);
      console.log('Spotify Playlist tracks.total:', plData.tracks?.total);

      // Fetch page 1 (0..100)
      const page1 = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&offset=0`, {
        headers: { 'Authorization': `Bearer ${data.accessToken}` }
      }).then(r => r.json());
      console.log('Page 1 items count:', page1.items?.length);

      // Fetch page 2 (100..181)
      const page2 = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&offset=100`, {
        headers: { 'Authorization': `Bearer ${data.accessToken}` }
      }).then(r => r.json());
      console.log('Page 2 items count:', page2.items?.length);
      const totalItems = (page1.items?.length || 0) + (page2.items?.length || 0);
      console.log('Total Spotify items fetched across pages 1 and 2:', totalItems);

      // Analyze tracks 101 to 181
      console.log('\nSample tracks from Page 2 (Tracks 101-110):');
      page2.items?.slice(0, 10).forEach((item, idx) => {
        const t = item.track;
        const artists = t?.artists?.map(a => a.name).join(', ') || 'Unknown';
        console.log(`  ${101 + idx}. "${t?.name}" by ${artists} (ID: ${t?.id})`);
      });

      // Check duplicates in Spotify playlist
      const allTracks = [...(page1.items || []), ...(page2.items || [])];
      const idMap = new Map();
      allTracks.forEach((item, idx) => {
        const id = item.track?.id;
        if (!id) return;
        if (!idMap.has(id)) idMap.set(id, []);
        idMap.get(id).push(idx + 1);
      });

      const spDuplicates = [];
      idMap.forEach((positions, id) => {
        if (positions.length > 1) {
          const t = allTracks[positions[0] - 1]?.track;
          spDuplicates.push({
            id,
            name: t?.name,
            artist: t?.artists?.[0]?.name,
            positions
          });
        }
      });

      console.log(`\nSpotify Duplicates in Playlist: ${spDuplicates.length} songs appear multiple times!`);
      spDuplicates.forEach(d => {
        console.log(`  • "${d.name}" by ${d.artist} (ID: ${d.id}) at positions: ${d.positions.join(', ')}`);
      });

      return {
        totalTracks: plData.tracks?.total,
        fetchedTracks: totalItems,
        duplicates: spDuplicates,
        allTracks
      };
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

testSpotifyToken();
