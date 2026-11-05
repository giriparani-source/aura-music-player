async function test() {
  const payload = {
    context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240101.01.00', hl: 'en', gl: 'IN' } },
    browseId: 'VLPLNf1vclGjpRE'
  };
  const res = await fetch('https://music.youtube.com/youtubei/v1/browse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  const str = JSON.stringify(data);
  const matches = [...str.matchAll(/"continuation":"([^"]+)"/g)].map(m => m[1]);
  console.log('Continuation tokens found:', matches.length);
  if (matches.length > 0) {
    console.log('Token snippet:', matches[0].substring(0, 50));
    
    // Now fetch page 2 using this continuation token
    const contRes = await fetch(`https://music.youtube.com/youtubei/v1/browse?continuation=${matches[0]}&ctoken=${matches[0]}&type=next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify(payload)
    });
    const contData = await contRes.json();
    console.log('Continuation response keys:', Object.keys(contData));
    const contStr = JSON.stringify(contData);
    const contVideoIds = [...contStr.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    console.log('Video IDs in continuation:', contVideoIds.length);
    
    const initialVideoIds = [...str.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    console.log('Video IDs in initial page:', initialVideoIds.length);
    console.log('Total Video IDs across both pages:', initialVideoIds.length + contVideoIds.length);
  }
}
test().catch(console.error);
