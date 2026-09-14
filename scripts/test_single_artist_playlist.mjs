import { TAMIL_ARTISTS } from '../src/services/tamilArtistsData.js';
import { artistPlaylistService } from '../src/services/artistPlaylistService.js';

const targetIds = [
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

async function run() {
  for (const id of targetIds) {
    const artist = TAMIL_ARTISTS.find(a => a.id === id);
    if (!artist) continue;
    const pl = await artistPlaylistService.getArtistPlaylist(artist);
    console.log(`${artist.name.padEnd(25)} -> Total: ${pl.tracks.length} (Local: ${pl.sourceBreakdown.local}, Curated: ${pl.sourceBreakdown.curated}, Online: ${pl.sourceBreakdown.online})`);
  }
}

run().catch(console.error);
