async function main() {
  const jsonRes = await fetch('http://localhost:9222/json');
  const pages = await jsonRes.json();
  const page = pages.find((p) => p.url.includes('localhost'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      const val = msg.result?.result?.value !== undefined ? msg.result.result.value : msg.result;
      resolve(val);
    }
  });

  await new Promise((res) => ws.addEventListener('open', res));
  await send('Runtime.enable');

  const result = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        
        // Find filter buttons
        const allBtn = buttons.find(b => b.textContent.includes('All ('));
        const onDeviceBtn = buttons.find(b => b.textContent.includes('On Device'));
        const downloadedBtn = buttons.find(b => b.textContent.includes('Downloaded'));

        // Test clicking On Device
        if (onDeviceBtn) onDeviceBtn.click();
        const onDeviceText = document.body.innerText.match(/Showing (\\d+) of (\\d+)/);

        // Test clicking Downloaded if present
        let downloadedText = null;
        if (downloadedBtn) {
          downloadedBtn.click();
          downloadedText = document.body.innerText.match(/Showing (\\d+) of (\\d+)/) || 'empty state';
        }

        // Click All back
        if (allBtn) allBtn.click();
        const allText = document.body.innerText.match(/Showing (\\d+) of (\\d+)/);

        return {
          onDeviceFilter: onDeviceText ? onDeviceText[0] : null,
          downloadedFilter: downloadedText ? (downloadedText[0] || downloadedText) : null,
          allFilter: allText ? allText[0] : null
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Filter test result:', JSON.stringify(result, null, 2));

  ws.close();
  process.exit(0);
}

main().catch(console.error);
