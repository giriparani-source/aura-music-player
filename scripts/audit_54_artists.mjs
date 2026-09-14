/**
 * scripts/audit_54_artists.mjs
 * Audits all 54 artists from tamilArtistsData.ts using artistPlaylistService.
 * Validates usability, counts real tracks, breaks down sources, and ensures ZERO fake/placeholder tracks.
 */

import { TAMIL_ARTISTS } from '../src/services/tamilArtistsData.js';
import { artistPlaylistService } from '../src/services/artistPlaylistService.js';

async function runAudit() {
  console.log('='.repeat(80));
  console.log('AURA MUSIC PLAYER — 54 TAMIL ARTISTS PLAYLIST DATA QUALITY AUDIT');
  console.log('='.repeat(80));
  console.log(`Auditing all ${TAMIL_ARTISTS.length} registered artists...\n`);

  const results = [];
  let totalTracksAcrossAll = 0;
  let fakeOrPlaceholderFound = 0;

  for (let i = 0; i < TAMIL_ARTISTS.length; i++) {
    const artist = TAMIL_ARTISTS[i];
    process.stdout.write(`[${i + 1}/${TAMIL_ARTISTS.length}] Querying ${artist.name}... `);

    try {
      await new Promise((r) => setTimeout(r, 150));
      const playlist = await artistPlaylistService.getArtistPlaylist(artist, []);
      const tracks = playlist.tracks;

      // Usability and placeholder verification
      let artistFakes = 0;
      for (const t of tracks) {
        if (!artistPlaylistService.isUsableTrack(t)) {
          artistFakes++;
        }
        const lower = (t.title + ' ' + t.id).toLowerCase();
        if (
          lower.includes('fake') ||
          lower.includes('dummy') ||
          lower.includes('placeholder')
        ) {
          artistFakes++;
        }
      }

      fakeOrPlaceholderFound += artistFakes;
      totalTracksAcrossAll += tracks.length;

      const breakdown = playlist.sourceBreakdown;
      const sourcesList = [];
      if (breakdown.local > 0) sourcesList.push(`Local(${breakdown.local})`);
      if (breakdown.curated > 0) sourcesList.push(`Curated(${breakdown.curated})`);
      if (breakdown.online > 0) sourcesList.push(`Online(${breakdown.online})`);
      if (sourcesList.length === 0) sourcesList.push('None');

      results.push({
        num: i + 1,
        id: artist.id,
        name: artist.name,
        category: artist.category,
        trackCount: tracks.length,
        sources: sourcesList.join(' + '),
        fakeCount: artistFakes,
        has40Plus: tracks.length >= 40
      });

      console.log(`-> ${tracks.length} tracks [${sourcesList.join(' + ')}]`);
    } catch (err) {
      console.log(`-> ERROR: ${err.message}`);
      results.push({
        num: i + 1,
        id: artist.id,
        name: artist.name,
        category: artist.category,
        trackCount: 0,
        sources: 'Error',
        fakeCount: 0,
        has40Plus: false,
        error: err.message
      });
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('COMPLETE 54-ARTIST TRACK AUDIT REPORT');
  console.log('='.repeat(80));
  console.log(
    '#'.padEnd(4) +
    'Artist Name'.padEnd(28) +
    'Category'.padEnd(16) +
    'Tracks'.padEnd(8) +
    'Sources'
  );
  console.log('-'.repeat(80));

  for (const r of results) {
    console.log(
      String(r.num).padEnd(4) +
      r.name.padEnd(28) +
      r.category.padEnd(16) +
      String(r.trackCount).padEnd(8) +
      r.sources
    );
  }

  console.log('-'.repeat(80));
  console.log(`Total Artists Audited:     ${results.length}`);
  console.log(`Total Usable Real Tracks:  ${totalTracksAcrossAll}`);
  console.log(`Average Tracks per Artist: ${Math.round(totalTracksAcrossAll / results.length)}`);
  console.log(`Artists with 40+ Tracks:   ${results.filter(r => r.has40Plus).length}/${results.length}`);
  console.log(`Fake/Placeholder Tracks:   ${fakeOrPlaceholderFound} (Strict Zero Tolerance)`);
  fs.writeFileSync(path.join(__dirname, 'artist_audit_results.json'), JSON.stringify(results, null, 2));
  return results;
}

runAudit().catch(console.error);
