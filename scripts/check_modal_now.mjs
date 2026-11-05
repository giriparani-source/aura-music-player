// scripts/check_modal_now.mjs
async function check() {
  const listRes = await fetch('http://localhost:9222/json/list').then(r => r.json());
  const page = listRes.find(t => t.type === 'page' && t.url.includes('localhost'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const callbacks = new Map();
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.id && callbacks.has(d.id)) { callbacks.get(d.id)(d); callbacks.delete(d.id); }
  };
  function send(method, params = {}) {
    return new Promise((res) => { const msgId = id++; callbacks.set(msgId, res); ws.send(JSON.stringify({ id: msgId, method, params })); });
  }
  await send('Runtime.enable');
  const res = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
        const summary = Array.from(document.querySelectorAll('*'))
          .map(el => el.textContent?.trim())
          .filter(t => t && (t.includes('tracks matched') || t.includes('Importing') || t.includes('Matching') || t.includes('skipped')));
        const badges320 = Array.from(document.querySelectorAll('*')).filter(el => el.textContent?.trim() === '320k').length;
        const badgesSkipped = Array.from(document.querySelectorAll('*')).filter(el => el.textContent?.trim() === 'Skipped').length;
        return {
          buttons: buttons.filter(Boolean),
          summary: summary.slice(0, 5),
          badges320,
          badgesSkipped
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Current Modal State:', JSON.stringify(res.result?.result?.value, null, 2));
  ws.close();
}
check().catch(console.error);
