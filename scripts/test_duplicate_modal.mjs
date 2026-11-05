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

  console.log('1. Navigating to Device view (#/local)...');
  await send('Runtime.evaluate', {
    expression: `window.location.hash = '#/local';`
  });
  await new Promise(r => setTimeout(r, 1000));

  console.log('2. Clicking "Find Duplicates" button...');
  const openResult = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const dupBtn = buttons.find(b => b.textContent && b.textContent.includes('Find Duplicates'));
        if (dupBtn) {
          dupBtn.click();
          return { clicked: true };
        }
        return { clicked: false, availableButtons: buttons.map(b => b.textContent.trim()).filter(Boolean) };
      })()
    `,
    returnByValue: true
  });
  console.log('Open Result:', openResult);
  await new Promise(r => setTimeout(r, 1200));

  console.log('3. Inspecting Duplicate Modal default selections...');
  const modalInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.querySelector('div[class*="fixed"]');
        if (!modal) return { modalFound: false };

        const titleEl = document.querySelector('h2');
        const modalTitle = titleEl ? titleEl.textContent : '';

        // Check selected checkboxes inside modal
        // Lucide CheckSquare vs Square
        const checkSquares = modal.querySelectorAll('svg[class*="lucide-check-square"]');
        const squares = modal.querySelectorAll('svg[class*="lucide-square"]');

        // Check action buttons at the bottom of modal
        const buttons = Array.from(modal.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean);

        // Find any remove/delete button text to see if anything is selected
        const deleteBtn = buttons.find(b => b.includes('Remove') || b.includes('Delete'));

        return {
          modalFound: true,
          modalTitle,
          totalUncheckedBoxes: squares.length,
          totalCheckedBoxes: checkSquares.length,
          isSelectedByDefault: checkSquares.length > 0,
          modalButtons: buttons,
          deleteBtnText: deleteBtn || null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Modal Default Selection Inspection:', JSON.stringify(modalInfo, null, 2));

  ws.close();
  process.exit(0);
}

main().catch(console.error);
