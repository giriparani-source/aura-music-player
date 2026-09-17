import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PORT = 9231;

async function run() {
  console.log('Testing BUG-2: Empty Search State with main input selector...');
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${EDGE_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\585562f6-67db-499a-bc1b-a7f0514cbd77\\scratch\\edge_search_test3',
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
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
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

    await new Promise((r) => setTimeout(r, 2000));

    // Navigate to Search tab
    await evalJs(`
      (() => {
        const navBtns = Array.from(document.querySelectorAll('nav button, aside button'));
        const searchBtn = navBtns.find(b => b.innerText.includes('Search'));
        if (searchBtn) searchBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1000));

    // Test 1: Nonsense Query using main input
    console.log('1. Searching for nonsense query in main input...');
    const inputFound = await evalJs(`
      (() => {
        const input = document.querySelector('main input[type="text"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'ZZZXYZAuraNonExistentSong12345');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return { found: true, val: input.value };
        }
        return { found: false };
      })()
    `);
    console.log('Input found:', inputFound);

    // Wait 1.5s for 400ms debounce and fetch
    await new Promise((r) => setTimeout(r, 2500));

    const searchState1 = await evalJs(`
      (() => {
        const main = document.querySelector('main');
        const songCards = main ? Array.from(main.querySelectorAll('div.space-y-1 div.group, div.grid div.group')) : [];
        const hasEmptyNotice = main ? main.innerText.includes('No streaming songs found for "ZZZXYZAuraNonExistentSong12345"') : false;
        const hasFeaturedFallback = main ? main.innerText.includes('Hukum - Thalaivar Alappara') : false;
        return {
          songCardsCount: songCards.length,
          hasEmptyNotice,
          hasFeaturedFallback
        };
      })()
    `);
    console.log('Nonsense Query Result:', searchState1);

    // Test 2: Valid Query ("Halamithi Habibo")
    console.log('2. Searching for valid query "Halamithi Habibo"...');
    await evalJs(`
      (() => {
        const input = document.querySelector('main input[type="text"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'Halamithi Habibo');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 2500));

    const searchState2 = await evalJs(`
      (() => {
        const main = document.querySelector('main');
        const songCards = main ? Array.from(main.querySelectorAll('div.space-y-1 div.group, div.grid div.group')) : [];
        return {
          songCardsCount: songCards.length,
          firstTitle: songCards[0]?.querySelector('h4')?.innerText
        };
      })()
    `);
    console.log('Valid Query Result:', searchState2);

    const testPassed = searchState1.hasEmptyNotice === true && searchState1.hasFeaturedFallback === false && searchState1.songCardsCount === 0 && searchState2.songCardsCount > 0;
    console.log('\n--- BUG-2 VERIFICATION RESULT ---');
    console.log(testPassed ? '✅ BUG-2 PASS: Empty search renders genuine empty state without fallback!' : '❌ BUG-2 FAIL');

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

run().catch(console.error);
