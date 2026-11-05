import { execSync } from 'child_process';
import * as fs from 'fs';

function adb(cmd) {
  return execSync(`adb ${cmd}`, { encoding: 'utf-8', timeout: 15000 }).trim();
}

function sampleSession() {
  const out = adb('shell dumpsys media_session');
  const posMatch = out.match(/state=([A-Z_]+)\((\d+)\),\s*position=(\d+)/);
  const descMatch = out.match(/description=([^\r\n]+)/);
  const wake = adb('shell "dumpsys power | grep mWakefulness="').replace(/\s+/g, ' ');
  return {
    state: posMatch ? `${posMatch[1]}(${posMatch[2]})` : 'UNKNOWN',
    positionSec: posMatch ? (parseInt(posMatch[3], 10) / 1000).toFixed(1) : '0',
    track: descMatch ? descMatch[1] : 'UNKNOWN',
    wakefulness: wake
  };
}

async function run() {
  console.log('=== CONTINUING SCREEN-OFF PLAYBACK VALIDATION (REMAINING 11 MINUTES) ===');
  const startTime = Date.now();
  const DURATION_MS = 11 * 60 * 1000; // 11 minutes
  const INTERVAL_MS = 60 * 1000;
  const samples = [];

  while (Date.now() - startTime < DURATION_MS) {
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    const s = sampleSession();
    samples.push({ elapsedSec, ...s });
    console.log(`[T+${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s] State: ${s.state} | Pos: ${s.positionSec}s | Wake: ${s.wakefulness} | Track: ${s.track.slice(0, 40)}...`);

    const remaining = DURATION_MS - (Date.now() - startTime);
    if (remaining <= 0) break;
    await new Promise(r => setTimeout(r, Math.min(INTERVAL_MS, remaining)));
  }

  const finalSample = sampleSession();
  console.log('\n=== 15-MINUTE VALIDATION FULLY COMPLETED ===');
  console.log('Final Sample:', JSON.stringify(finalSample, null, 2));

  // Check logcat errors
  const logcat = adb('shell "logcat -d -s AuraAudioService:E,AndroidRuntime:E,ExoPlayer:E | tail -n 30"');
  console.log('\nRecent Logcat Errors (if any):\n', logcat || '(None)');

  fs.writeFileSync('scripts/screen_off_final_summary.json', JSON.stringify({ samples, finalSample, logcat }, null, 2));
}

run().catch(err => {
  console.error('Error in monitor:', err);
  process.exit(1);
});
