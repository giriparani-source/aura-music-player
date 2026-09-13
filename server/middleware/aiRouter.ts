/**
 * server/middleware/aiRouter.ts
 * AI DJ, Insights, and Chat unified router.
 * Extracted from vite.config.ts lines 305-369.
 * Preserves exact route paths, query params, POST body parsing, and response format.
 */

import { runAiCommand, isPythonAvailable } from '../helpers/pythonRunner.ts';

export function aiRouterHandler(req: any, res: any, next: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  const parsedUrl = new URL(req.url, 'http://localhost:3000/api/ai');
  const pathname = parsedUrl.pathname.replace(/^\/api\/ai/, '') || '/';

  if (!isPythonAvailable()) {
    // Return a graceful fallback when Python is unavailable
    if (pathname === '/dj' || pathname === '/dj/') {
      res.end(JSON.stringify({
        title: 'AI DJ Offline ✨',
        intro: 'Python AI engine is not available. Try the built-in mood playlists instead!',
        vibe: 'Offline',
        suggested_eq: 'flat',
        tracks: []
      }));
      return;
    }
    if (pathname === '/insights' || pathname === '/insights/') {
      res.end(JSON.stringify({
        theme: 'AI insights require the Python engine.',
        emotion: 'N/A',
        story: 'The AI engine is currently unavailable.',
        lines: [],
        composer_notes: '',
        recommended_eq: 'flat'
      }));
      return;
    }
    if (pathname === '/chat' || pathname === '/chat/') {
      res.end(JSON.stringify({
        reply: 'AI assistant is currently offline. Python engine is not available on this server.',
        action: null
      }));
      return;
    }
    next();
    return;
  }

  if (pathname === '/dj' || pathname === '/dj/') {
    (async () => {
      try {
        const q = parsedUrl.searchParams.get('q') || 'late night drive';
        const data = await runAiCommand(['dj', q]);
        res.end(JSON.stringify(data));
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  if (pathname === '/insights' || pathname === '/insights/') {
    (async () => {
      try {
        const title = parsedUrl.searchParams.get('title') || '';
        const artist = parsedUrl.searchParams.get('artist') || '';
        const data = await runAiCommand(['insights', title, artist]);
        res.end(JSON.stringify(data));
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  if (pathname === '/chat' || pathname === '/chat/') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const msg = parsed.message || 'hi';
          const currentSong = JSON.stringify(parsed.currentSong || {});
          const data = await runAiCommand(['chat', msg, currentSong]);
          res.end(JSON.stringify(data));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else {
      (async () => {
        try {
          const msg = parsedUrl.searchParams.get('message') || 'hi';
          const data = await runAiCommand(['chat', msg, '{}']);
          res.end(JSON.stringify(data));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      })();
    }
    return;
  }

  next();
}
