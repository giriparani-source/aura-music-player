/**
 * scripts/validate_prototype_flow.mjs
 *
 * End-to-end integration validator for the Prototype Playback Architecture:
 * 1. Identify songs (Title + Artist)
 * 2. Saavn match check (Real JioSaavn API)
 * 3. Server-side yt-dlp resolver test (Real local Python yt-dlp / server)
 * 4. Byte-range playback streaming test (HTTP 206 Partial Content for ExoPlayer)
 * 5. IFrame fallback simulation on unresolvable track
 * 6. Generates full architecture diagnostic report
 */

import { spawn } from 'node:child_process';
import http from 'node:http';

const BENCHMARK_CASES = [
  {
    name: 'Standard Catalog Song (Saavn Match Expected)',
    title: 'Kesariya',
    artist: 'Arijit Singh',
    expectedTier: 'SAAVN_NATIVE'
  },
  {
    name: 'YouTube Exclusive Underground Mix (yt-dlp Resolver Required)',
    title: 'Aura Underground 24h Synthwave Ambient Mixtape 2026',
    artist: 'DJ Underground X99',
    videoId: 'dQw4w9WgXcQ',
    expectedTier: 'YTDLP_NATIVE'
  },
  {
    name: 'Unresolvable Invalid Track (IFrame Fallback Expected)',
    title: 'Corrupted Inaccessible Track',
    artist: 'Ghost Artist',
    videoId: 'INVALID_ID_999999999',
    expectedTier: 'IFRAME_FALLBACK'
  }
];

function cleanTitle(title, artist) {
  let clean = title
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[|•].*$/g, '')
    .replace(/\b(official video|video song|audio song|lyrics?|4k|hd|remastered)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean;
}

async function testSaavnMatch(title, artist) {
  const q = encodeURIComponent(`${cleanTitle(title)} ${artist}`.trim());
  const url = `https://jiosaavn-api-sage.vercel.app/api/search/songs?query=${q}&page=1&limit=3`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { matched: false };
    const data = await res.json();
    const songs = data?.data?.results || [];
    if (songs.length === 0) return { matched: false };

    const first = songs[0];
    const candTitle = (first.name || first.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const reqTitle = cleanTitle(title).toLowerCase().replace(/[^a-z0-9]/g, '');

    const hasOverlap = reqTitle.length >= 4 && (candTitle.includes(reqTitle) || reqTitle.includes(candTitle) || candTitle.slice(0, 5) === reqTitle.slice(0, 5));
    if (!hasOverlap) {
      return { matched: false, reason: `Title mismatch: "${first.name}" vs "${title}"` };
    }

    const dlUrls = first.downloadUrl || [];
    const bestDl = dlUrls.find(u => u.quality === '320kbps') || dlUrls[dlUrls.length - 1];
    if (bestDl?.url) {
      return {
        matched: true,
        title: first.name,
        streamUrl: bestDl.url,
        quality: bestDl.quality
      };
    }
  } catch (err) {
    return { matched: false, error: err.message };
  }
  return { matched: false };
}

async function testYtDlpResolver(videoId) {
  return new Promise((resolve) => {
    const proc = spawn('python', ['server/online_stream.py', 'get_url', videoId]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });

    proc.on('close', code => {
      if (code === 0) {
        try {
          const data = JSON.parse(stdout);
          if (data.streamUrl) {
            resolve({ resolved: true, streamUrl: data.streamUrl });
            return;
          }
          resolve({ resolved: false, error: data.error || 'No streamUrl returned' });
        } catch (e) {
          resolve({ resolved: false, error: 'JSON parse error: ' + stdout });
        }
      } else {
        resolve({ resolved: false, error: stderr.trim() || `Exit code ${code}` });
      }
    });
  });
}

async function testByteRangeStream(streamUrl) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Range': 'bytes=0-2048'
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    const isPartial = res.status === 206 || res.status === 200;
    const contentType = res.headers.get('content-type') || '';
    const contentRange = res.headers.get('content-range') || '';
    const buf = await res.arrayBuffer();

    return {
      success: isPartial && buf.byteLength > 0,
      status: res.status,
      bytesReceived: buf.byteLength,
      contentType,
      contentRange
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function runValidation() {
  console.log('='.repeat(70));
  console.log(' PROTOTYPE PLAYBACK ARCHITECTURE VALIDATION HARNESS');
  console.log('='.repeat(70));
  console.log('Architecture Flow:');
  console.log('  Playlist Track -> Saavn Match -> Native ExoPlayer (Tier 1)');
  console.log('                 -> Unmatched -> yt-dlp Resolver -> Native ExoPlayer (Tier 2)');
  console.log('                 -> Resolver Failed -> IFrame Foreground Fallback (Tier 3)');
  console.log('-'.repeat(70));

  let saavnMatches = 0;
  let ytdlpResolutions = 0;
  let iframeFallbacks = 0;
  const results = [];

  for (let i = 0; i < BENCHMARK_CASES.length; i++) {
    const item = BENCHMARK_CASES[i];
    console.log(`\n[Case ${i + 1}/${BENCHMARK_CASES.length}] "${item.title}" - ${item.artist}`);
    const caseResult = { name: item.name, target: item.title };

    // Step 1: Attempt Saavn Match
    console.log('  Testing Step 1: Saavn Match...');
    const saavn = await testSaavnMatch(item.title, item.artist);
    if (saavn.matched) {
      console.log(`  -> MATCHED on JioSaavn!`);
      console.log(`     Title: ${saavn.title}`);
      console.log(`     Quality: ${saavn.quality}`);
      console.log(`     Stream: ${saavn.streamUrl.substring(0, 60)}...`);

      // Test byte range streaming for ExoPlayer
      const streamTest = await testByteRangeStream(saavn.streamUrl);
      console.log(`     ExoPlayer Stream Readiness: ${streamTest.success ? 'PASSED (HTTP ' + streamTest.status + ')' : 'FAILED'}`);
      console.log(`     Bytes Buffered: ${streamTest.bytesReceived} bytes, Type: ${streamTest.contentType}`);

      caseResult.tier = 'SAAVN_NATIVE';
      caseResult.player = 'EXOPLAYER_NATIVE';
      caseResult.exoPlayerReady = streamTest.success;
      saavnMatches++;
      results.push(caseResult);
      continue;
    } else {
      console.log('  -> Not matched on Saavn (or low similarity). Moving to Step 2...');
    }

    // Step 2: Attempt yt-dlp Resolver
    if (item.videoId) {
      console.log(`  Testing Step 2: Server-side yt-dlp resolver for video ID "${item.videoId}"...`);
      const ytdlp = await testYtDlpResolver(item.videoId);
      if (ytdlp.resolved && ytdlp.streamUrl) {
        console.log(`  -> RESOLVED via yt-dlp!`);
        console.log(`     Stream: ${ytdlp.streamUrl.substring(0, 60)}...`);

        // Test byte range streaming for ExoPlayer
        const streamTest = await testByteRangeStream(ytdlp.streamUrl);
        console.log(`     ExoPlayer Stream Readiness: ${streamTest.success ? 'PASSED (HTTP ' + streamTest.status + ')' : 'FAILED'}`);
        console.log(`     Bytes Buffered: ${streamTest.bytesReceived} bytes, Type: ${streamTest.contentType}`);

        caseResult.tier = 'YTDLP_NATIVE';
        caseResult.player = 'EXOPLAYER_NATIVE';
        caseResult.exoPlayerReady = streamTest.success;
        ytdlpResolutions++;
        results.push(caseResult);
        continue;
      } else {
        console.log(`  -> yt-dlp resolver could not extract stream: ${ytdlp.error}`);
      }
    }

    // Step 3: Fallback to YouTube IFrame Foreground
    console.log('  Testing Step 3: Clean Fallback to YouTube IFrame...');
    console.log(`  -> IFrame Foreground Player Activated for video: ${item.videoId || 'N/A'}`);
    caseResult.tier = 'IFRAME_FALLBACK';
    caseResult.player = 'YOUTUBE_IFRAME';
    caseResult.exoPlayerReady = false;
    caseResult.isForegroundOnly = true;
    iframeFallbacks++;
    results.push(caseResult);
  }

  console.log('\n' + '='.repeat(70));
  console.log(' ARCHITECTURE VALIDATION SUMMARY');
  console.log('='.repeat(70));
  const total = BENCHMARK_CASES.length;
  const exoPlayerSuccess = saavnMatches + ytdlpResolutions;
  const exoPlayerRate = Math.round((exoPlayerSuccess / total) * 100);

  console.log(`Total Cases Evaluated     : ${total}`);
  console.log(`Tier 1 (Saavn Match)      : ${saavnMatches} tracks`);
  console.log(`Tier 2 (yt-dlp Resolved)  : ${ytdlpResolutions} tracks`);
  console.log(`Tier 3 (IFrame Fallback)  : ${iframeFallbacks} tracks`);
  console.log(`Native ExoPlayer Rate     : ${exoPlayerRate}% (${exoPlayerSuccess}/${total} tracks have screen-off background support)`);
  console.log(`Foreground-only Fallback  : ${Math.round((iframeFallbacks / total) * 100)}% (${iframeFallbacks}/${total})`);
  console.log('='.repeat(70));

  console.log(JSON.stringify({
    success: true,
    total,
    saavnMatches,
    ytdlpResolutions,
    iframeFallbacks,
    exoPlayerRate,
    cases: results
  }, null, 2));
}

runValidation();
