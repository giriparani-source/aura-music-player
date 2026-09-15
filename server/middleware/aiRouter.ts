/**
 * server/middleware/aiRouter.ts
 * AI DJ, Insights, and Chat unified router.
 * Extracted from vite.config.ts lines 305-369.
 * Preserves exact route paths, query params, POST body parsing, and response format.
 */

import { runAiCommand, isPythonAvailable } from '../helpers/pythonRunner.ts';
import { generateDjMix, getSongInsights, processChat } from '../helpers/aiEngineNative.ts';

export function aiRouterHandler(req: any, res: any, next: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  const parsedUrl = new URL(req.url, 'http://localhost:3000/api/ai');
  const pathname = parsedUrl.pathname.replace(/^\/api\/ai/, '') || '/';

  // 1. AI DJ Endpoint
  if (pathname === '/dj' || pathname === '/dj/') {
    (async () => {
      const q = parsedUrl.searchParams.get('q') || 'late night drive';
      try {
        if (isPythonAvailable()) {
          const data = await runAiCommand(['dj', q]);
          res.end(JSON.stringify(data));
          return;
        }
      } catch (pythonErr) {
        console.warn('[Aura AI] Python DJ failed, falling back to Native TS Engine:', pythonErr);
      }
      // Pure Node.js / Serverless Native Fallback
      const nativeData = generateDjMix(q);
      res.end(JSON.stringify(nativeData));
    })();
    return;
  }

  // 2. AI Insights Endpoint
  if (pathname === '/insights' || pathname === '/insights/') {
    (async () => {
      const title = parsedUrl.searchParams.get('title') || '';
      const artist = parsedUrl.searchParams.get('artist') || '';
      try {
        if (isPythonAvailable()) {
          const data = await runAiCommand(['insights', title, artist]);
          res.end(JSON.stringify(data));
          return;
        }
      } catch (pythonErr) {
        console.warn('[Aura AI] Python Insights failed, falling back to Native TS Engine:', pythonErr);
      }
      // Pure Node.js / Serverless Native Fallback
      const nativeData = getSongInsights(title, artist);
      res.end(JSON.stringify(nativeData));
    })();
    return;
  }

  // 3. AI Chat Assistant Endpoint
  if (pathname === '/chat' || pathname === '/chat/') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const msg = parsed.message || 'hi';
          const currentSong = parsed.currentSong || {};

          try {
            if (isPythonAvailable()) {
              const data = await runAiCommand(['chat', msg, JSON.stringify(currentSong)]);
              res.end(JSON.stringify(data));
              return;
            }
          } catch (pythonErr) {
            console.warn('[Aura AI] Python Chat failed, falling back to Native TS Engine:', pythonErr);
          }

          // Pure Node.js / Serverless Native Fallback
          const nativeData = processChat(msg, currentSong);
          res.end(JSON.stringify(nativeData));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else {
      (async () => {
        const msg = parsedUrl.searchParams.get('message') || 'hi';
        try {
          if (isPythonAvailable()) {
            const data = await runAiCommand(['chat', msg, '{}']);
            res.end(JSON.stringify(data));
            return;
          }
        } catch (pythonErr) {
          console.warn('[Aura AI] Python Chat failed, falling back to Native TS Engine:', pythonErr);
        }

        const nativeData = processChat(msg, {});
        res.end(JSON.stringify(nativeData));
      })();
    }
    return;
  }

  next();
}
