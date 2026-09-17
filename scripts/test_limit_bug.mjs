import { searchJioSaavn } from '../src/services/jiosaavnService.js';

async function testLimits() {
  console.log('Testing limits on JioSaavn...');
  for (const lim of [10, 20, 30, 40, 50, undefined]) {
    try {
      const res = await searchJioSaavn(`Vidyasagar ${lim || 'none'}`, lim);
      console.log(`Limit ${lim}: returned ${res.length} songs`);
    } catch (e) {
      console.log(`Limit ${lim}: ERROR ${e.message}`);
    }
  }
}

testLimits().catch(console.error);
