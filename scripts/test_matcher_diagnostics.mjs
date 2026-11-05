// scripts/test_matcher_diagnostics.mjs
import { matchYouTubeToCatalog, cleanTrackMetadata, evaluateHardGates } from '../src/services/catalogMatcher.ts';
import { jiosaavnService } from '../src/services/jiosaavnService.ts';

async function test() {
  const tracks = [
    { title: 'Melliname', artist: 'Harish Raghavendra - Topic', duration: 320 },
    { title: 'Inji Idupazhaga1', artist: 'Kamalhasan, Janaki - Topic', duration: 210 },
    { title: 'Nenjinile', artist: 'S. Janaki - Topic', duration: 350 },
    { title: 'Anbae Anbae', artist: 'Hariharan - Topic', duration: 315 },
    { title: 'Uyire Uyire', artist: 'Release - Topic', duration: 420 },
    { title: 'Usalampatti Penkutti', artist: 'Release - Topic', duration: 285 }
  ];

  for (const t of tracks) {
    console.log(`\n========================================`);
    console.log(`Testing: "${t.title}" by "${t.artist}"`);
    const cleanMeta = cleanTrackMetadata(t.title, t.artist, t.duration);
    console.log('Cleaned Meta:', cleanMeta);
    
    const res = await matchYouTubeToCatalog(t.title, t.artist, t.duration, 'test_id');
    console.log('Match Result:', res.status, res.status === 'MATCHED' ? res.song.title + ' [' + res.song.album + '] by ' + res.song.artist : res.reason);
  }
}
test().catch(console.error);
