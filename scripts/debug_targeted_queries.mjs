import { searchJioSaavn } from '../src/services/jiosaavnService.js';
import { artistPlaylistService } from '../src/services/artistPlaylistService.js';
import { TAMIL_ARTISTS } from '../src/services/tamilArtistsData.js';

async function testTargeted() {
  const dhee = TAMIL_ARTISTS.find(a => a.id === 'dhee');
  const queries = [
    'Dhee singer',
    'Dhee songs Tamil',
    'Dhee Tamil hit songs',
    'Dhee Enjoy Enjaami',
    'Dhee Rowdy Baby',
    'Dhee Kaattu Payale',
    'Dhee Soorarai Pottru',
    'Dhee Irudhi Suttru'
  ];

  console.log('--- Testing Dhee Queries on JioSaavn ---');
  for (const q of queries) {
    try {
      const res = await searchJioSaavn(q, 20);
      const matches = res.filter(t => artistPlaylistService.matchTrackToArtist(t, dhee));
      console.log(`Query "${q}": ${res.length} raw -> ${matches.length} matched`);
      if (matches.length > 0) {
        for (const m of matches) {
          console.log(`   + "${m.title}" by "${m.artist}"`);
        }
      }
    } catch (e) {
      console.log(`Query "${q}" error: ${e.message}`);
    }
  }
}

testTargeted().catch(console.error);
