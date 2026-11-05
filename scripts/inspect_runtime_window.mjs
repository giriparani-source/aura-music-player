// scripts/inspect_runtime_window.mjs
async function inspect() {
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
        const keys = Object.keys(window);
        const stores = {
          hasCapacitor: !!window.Capacitor,
          plugins: window.Capacitor ? Object.keys(window.Capacitor.Plugins || {}) : [],
          customKeys: keys.filter(k => !k.startsWith('webkit') && !k.startsWith('on') && !['window','self','document','name','location','customElements','history','locationbar','menubar','personalbar','scrollbars','statusbar','toolbar','status','closed','frames','length','top','opener','parent','frameElement','navigator','origin','external','screen','innerWidth','innerHeight','scrollX','pageXOffset','scrollY','pageYOffset','visualViewport','screenX','screenY','outerWidth','outerHeight','devicePixelRatio','clientInformation','screenLeft','screenTop','styleMedia','isSecureContext','crossOriginIsolated','performance'].includes(k))
        };
        return stores;
      })()
    `,
    returnByValue: true
  });
  console.log('Runtime window probe:', JSON.stringify(res.result?.result?.value, null, 2));
  ws.close();
}
inspect().catch(console.error);
