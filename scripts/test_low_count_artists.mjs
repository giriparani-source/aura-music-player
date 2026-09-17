import { TAMIL_ARTISTS } from '../src/services/tamilArtistsData.js';
import { artistPlaylistService } from '../src/services/artistPlaylistService.js';
import { searchJioSaavn, PRESET_SAAVN_320K_HITS } from '../src/services/jiosaavnService.js';
import { INBUILT_PLAYLISTS } from '../src/services/inbuiltPlaylistsService.js';

const targetArtistIds = [
  'vidyasagar',
  'dhee',
  'anuradha_sriram',
  'karthik_raja',
  'swarnalatha',
  'deva',
  'vivek_mervin',
  'p_unnikrishnan',
  'sam_cs'
];

async function testArtists() {
  console.log('Testing Low Count Artists Analysis...\n');

  for (const id of targetArtistIds) {
    const artist = TAMIL_ARTISTS.find(a => a.id === id);
    if (!artist) continue;

    console.log('='.repeat(60));
    console.log(`ARTIST: ${artist.name} (ID: ${artist.id}, Cat: ${artist.category})`);
    console.log(`Aliases:`, artistPlaylistService.getArtistAliases(artist));

    // 1. Curated check
    const allInbuilt = [...INBUILT_PLAYLISTS.flatMap(p => p.tracks), ...PRESET_SAAVN_320K_HITS];
    const curatedMatches = allInbuilt.filter(t => artistPlaylistService.matchTrackToArtist(t, artist));
    console.log(`Curated matches: ${curatedMatches.length}`);

    // Check all curated tracks to see if any contain artist name in text but didn't match
    const normName = artist.name.toLowerCase();
    const missedCurated = allInbuilt.filter(t => {
      const art = (t.artist || '').toLowerCase();
      const title = (t.title || '').toLowerCase();
      const couldBe = art.includes(normName) || title.includes(normName);
      const isMatched = artistPlaylistService.matchTrackToArtist(t, artist);
      return couldBe && !isMatched;
    });
    console.log(`Potentially missed curated: ${missedCurated.length}`);
    if (missedCurated.length > 0) {
      console.log('Sample missed curated:', missedCurated.slice(0, 3).map(t => ({ title: t.title, artist: t.artist })));
    }

    // 2. JioSaavn raw query
    const cleanQuery = artist.name.replace(/\./g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`Querying JioSaavn with "${cleanQuery}"...`);
    try {
      const results = await searchJioSaavn(cleanQuery, 30);
      console.log(`JioSaavn returned ${results?.length || 0} raw tracks`);

      if (results && results.length > 0) {
        const matched = results.filter(t => artistPlaylistService.matchTrackToArtist(t, artist));
        console.log(`Matched by service: ${matched.length}/${results.length}`);

        // Show rejected sample
        const rejected = results.filter(t => !artistPlaylistService.matchTrackToArtist(t, artist));
        if (rejected.length > 0) {
          console.log('Sample rejected results:');
          for (const r of rejected.slice(0, 5)) {
            console.log(`  - Title: "${r.title}", Artist: "${r.artist}"`);
          }
        }
      }
    } catch (e) {
      console.log(`JioSaavn ERROR: ${e.message}`);
    }

    // Try query variant e.g. with "Tamil"
    try {
      const variantResults = await searchJioSaavn(`${cleanQuery} Tamil`, 30);
      console.log(`JioSaavn variant "${cleanQuery} Tamil" returned ${variantResults?.length || 0} raw tracks`);
      if (variantResults && variantResults.length > 0) {
        const matchedV = variantResults.filter(t => artistPlaylistService.matchTrackToArtist(t, artist));
        console.log(`Matched variant by service: ${matchedV.length}/${variantResults.length}`);
      }
    } catch (e) {
      console.log(`JioSaavn variant ERROR: ${e.message}`);
    }

    console.log('');
  }
}

testArtists().catch(console.error);
