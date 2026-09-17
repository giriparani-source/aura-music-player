import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9299;

async function run() {
  console.log('Inspecting localhost:3000 for blank screen with persistent test profile...');
  const testUserDataDir = 'C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_sw_test_profile';
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${EDGE_PORT}`,
    `--user-data-dir=${testUserDataDir}`,
    '--headless=new',
    '--disable-gpu',
    'http://localhost:3000'
  ]);

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const listRes = await fetch(`http://127.0.0.1:${EDGE_PORT}/json/list`).then(r => r.json());
    const page = listRes.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.onopen = resolve);

    let msgId = 1;
    const callbacks = new Map();
    const requestMap = new Map();
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER CONSOLE]', data.params.type, data.params.args.map(a => a.value ?? a.description ?? ''));
      }
      if (data.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]', JSON.stringify(data.params.exceptionDetails, null, 2));
      }
      if (data.method === 'Network.requestWillBeSent') {
        requestMap.set(data.params.requestId, data.params.request.url);
      }
      if (data.method === 'Network.loadingFailed') {
        const failedUrl = requestMap.get(data.params.requestId) || 'unknown';
        console.error('[NETWORK FAILED]', failedUrl, data.params.errorText, data.params.canceled);
      }
      if (data.method === 'Network.responseReceived') {
        if (data.params.response.status >= 400) {
          console.error('[NETWORK HTTP ERROR]', data.params.response.status, data.params.response.url);
        }
      }
      if (data.id && callbacks.has(data.id)) {
        callbacks.get(data.id)(data);
        callbacks.delete(data.id);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evalJs(expression) {
      const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      return res.result?.result?.value;
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');
    await send('Network.enable');

    console.log('Navigating to http://localhost:3000...');
    await send('Page.navigate', { url: 'http://localhost:3000' });
    await new Promise((r) => setTimeout(r, 3000));

    console.log('Reloading to test ServiceWorker intercept...');
    await send('Page.reload', { ignoreCache: false });
    await new Promise((r) => setTimeout(r, 3000));

    const domInfo = await evalJs(`
      (() => {
        const root = document.getElementById('root');
        return {
          title: document.title,
          rootExists: !!root,
          rootChildrenCount: root ? root.children.length : 0,
          bodyHtml: document.body.innerHTML.slice(0, 500)
        };
      })()
    `);
    console.log('DOM Info:', domInfo);

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
