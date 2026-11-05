// scripts/test_screen_off_verification.mjs
import { execSync } from 'child_process';

function getState() {
  const out = execSync('adb -s CQXW4PZ9PREEQGS8 shell dumpsys media_session | findstr "state=PlaybackState"', { encoding: 'utf-8' });
  return out.trim();
}

console.log('1. Checking current playback state (Screen ON)...');
const before = getState();
console.log('   Screen ON State:', before);

console.log('2. Turning screen OFF via keyevent 26...');
execSync('adb -s CQXW4PZ9PREEQGS8 shell input keyevent 26');

console.log('3. Waiting 6 seconds with screen OFF...');
const startTime = Date.now();
while (Date.now() - startTime < 6000) {
  // wait
}

console.log('4. Querying playback state while screen is OFF...');
const during = getState();
console.log('   Screen OFF State:', during);

console.log('5. Turning screen back ON...');
execSync('adb -s CQXW4PZ9PREEQGS8 shell input keyevent 26');

console.log('\n--- VERIFICATION RESULT ---');
const isPlaying = during.includes('state=PLAYING(3)');
if (isPlaying) {
  console.log('✓ SUCCESS: ExoPlayer continuous playback verified with screen off (PLAYING 3)!');
} else {
  console.log('❌ NOT PLAYING:', during);
  process.exit(1);
}
