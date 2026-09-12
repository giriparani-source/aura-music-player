import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawn } from 'node:child_process';

const searchCache = new Map<string, any>();
const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();

interface JamRoomData {
  code: string;
  hostId: string;
  hostName: string;
  currentSong: any | null;
  currentTime: number;
  isPlaying: boolean;
  hostTimestamp: number;
  participants: { id: string; name: string; isHost: boolean; lastSeen: number }[];
  reactions: { id: string; emoji: string; user: string; timestamp: number }[];
  signals: { senderId: string; targetId: string; data: any; timestamp: number }[];
  updatedAt: number;
}
const jamRooms = new Map<string, JamRoomData>();

function runPythonCommand(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'server', 'online_stream.py');
    const proc = spawn('python', [pythonScript, ...args]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString('utf-8');
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString('utf-8');
    });

    proc.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr || `Process exited with code ${code}`));
        return;
      }
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch (err) {
        reject(new Error(`Failed to parse JSON: ${stdout.slice(0, 100)}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function runAiCommand(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'server', 'ai_engine.py');
    const proc = spawn('python', [pythonScript, ...args]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`AI Script failed with code ${code}: ${stderr}`));
        return;
      }
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch (err) {
        reject(new Error(`Failed to parse JSON: ${stdout.slice(0, 100)}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function localMusicServerPlugin() {
  const songsBaseDir = 'G:\\My Drive\\songs 1';

  return {
    name: 'local-music-server',
    configureServer(server: any) {
      // 1. Online Search Endpoint
      server.middlewares.use('/api/online/search', async (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Content-Type', 'application/json');

        try {
          const url = new URL(req.url, 'http://localhost:3000');
          const q = url.searchParams.get('q');
          if (!q || !q.trim()) {
            res.end(JSON.stringify({ results: [] }));
            return;
          }

          const cacheKey = q.trim().toLowerCase();
          if (searchCache.has(cacheKey)) {
            res.end(JSON.stringify({ results: searchCache.get(cacheKey) }));
            return;
          }

          const data = await runPythonCommand(['search', q.trim(), '12']);
          if (data.error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: data.error, results: [] }));
            return;
          }

          const rawList = data.results || [];
          const formatted = rawList.map((item: any) => ({
            id: `online_${item.id}`,
            sourceId: item.id,
            title: item.title,
            artist: item.artist || 'Online Artist',
            album: 'Cloud Stream',
            path: `/api/online/stream?id=${item.id}`,
            filePath: `/api/online/stream?id=${item.id}`,
            fileName: `${item.title}.webm`,
            duration: item.duration || 180,
            coverArt: item.thumbnail,
            artwork: item.thumbnail,
            isOnline: true,
            format: 'STREAM',
            bitrate: 160,
            fileSize: 0,
            playCount: 0,
            dateAdded: Date.now(),
            isFavorite: false
          }));

          searchCache.set(cacheKey, formatted);
          res.end(JSON.stringify({ results: formatted }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || 'Search failed', results: [] }));
        }
      });

      // 2. Online Stream Proxy Endpoint
      server.middlewares.use('/api/online/stream', async (req: any, res: any) => {
        try {
          const url = new URL(req.url, 'http://localhost:3000');
          const id = url.searchParams.get('id');
          if (!id) {
            res.statusCode = 400;
            res.end('Missing id parameter');
            return;
          }

          // Check stream URL cache
          let streamUrlObj = streamUrlCache.get(id);
          if (!streamUrlObj || Date.now() > streamUrlObj.expiresAt) {
            const data = await runPythonCommand(['get_url', id]);
            if (data.error || !data.streamUrl) {
              res.statusCode = 502;
              res.end(data.error || 'Failed to extract stream URL');
              return;
            }
            streamUrlObj = {
              url: data.streamUrl,
              expiresAt: Date.now() + 4 * 3600 * 1000 // 4 hours validity
            };
            streamUrlCache.set(id, streamUrlObj);
          }

          const targetUrl = new URL(streamUrlObj.url);
          const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          };
          if (req.headers.range) {
            headers['Range'] = req.headers.range;
          }

          const proxyReq = https.request(
            targetUrl,
            {
              headers,
              method: 'GET'
            },
            (proxyRes) => {
              res.statusCode = proxyRes.statusCode || 200;
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Headers', '*');
              res.setHeader('Accept-Ranges', 'bytes');
              res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/webm');

              if (proxyRes.headers['content-range']) {
                res.setHeader('Content-Range', proxyRes.headers['content-range']);
              }
              if (proxyRes.headers['content-length']) {
                res.setHeader('Content-Length', proxyRes.headers['content-length']);
              }

              proxyRes.pipe(res);
            }
          );

          proxyReq.on('error', (err) => {
            if (!res.headersSent) {
              res.statusCode = 502;
              res.end('Proxy streaming error: ' + err.message);
            }
          });

          req.on('close', () => {
            proxyReq.destroy();
          });

          proxyReq.end();
        } catch (err: any) {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(err.message || 'Stream error');
          }
        }
      });

      // AI Unified Router
      server.middlewares.use('/api/ai', async (req: any, res: any, next: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Content-Type', 'application/json');

        const parsedUrl = new URL(req.url, 'http://localhost:3000/api/ai');
        const pathname = parsedUrl.pathname.replace(/^\/api\/ai/, '') || '/';

        if (pathname === '/dj' || pathname === '/dj/') {
          try {
            const q = parsedUrl.searchParams.get('q') || 'late night drive';
            const data = await runAiCommand(['dj', q]);
            res.end(JSON.stringify(data));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (pathname === '/insights' || pathname === '/insights/') {
          try {
            const title = parsedUrl.searchParams.get('title') || '';
            const artist = parsedUrl.searchParams.get('artist') || '';
            const data = await runAiCommand(['insights', title, artist]);
            res.end(JSON.stringify(data));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
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
            try {
              const msg = parsedUrl.searchParams.get('message') || 'hi';
              const data = await runAiCommand(['chat', msg, '{}']);
              res.end(JSON.stringify(data));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          }
          return;
        }

        next();
      });

      // --- WebRTC Social Jam (Listen Together) Backend ---
      // Periodic cleanup of abandoned rooms (> 2 hours inactive)
      setInterval(() => {
        const now = Date.now();
        for (const [code, room] of jamRooms.entries()) {
          if (now - room.updatedAt > 2 * 60 * 60 * 1000) {
            jamRooms.delete(code);
          }
        }
      }, 15 * 60 * 1000);

      server.middlewares.use('/api/jam', (req: any, res: any, next: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        const parsedUrl = new URL(req.url, 'http://localhost:3000/api/jam');
        const pathname = parsedUrl.pathname.replace(/^\/api\/jam/, '') || '/';

        const readJson = (callback: (data: any) => void) => {
          let body = '';
          req.on('data', (c: any) => { body += c; });
          req.on('end', () => {
            try {
              callback(JSON.parse(body || '{}'));
            } catch {
              callback({});
            }
          });
        };

        // 1. Create Room
        if (pathname === '/create') {
          readJson((data) => {
            const hostId = data.hostId || `host_${Math.random().toString(36).slice(2, 8)}`;
            const hostName = data.hostName || 'Aura Host';
            const roomCode = 'JAM-' + Math.floor(1000 + Math.random() * 9000);
            const newRoom: JamRoomData = {
              code: roomCode,
              hostId,
              hostName,
              currentSong: data.currentSong || null,
              currentTime: typeof data.currentTime === 'number' ? data.currentTime : 0,
              isPlaying: !!data.isPlaying,
              hostTimestamp: Date.now(),
              participants: [{ id: hostId, name: hostName, isHost: true, lastSeen: Date.now() }],
              reactions: [],
              signals: [],
              updatedAt: Date.now()
            };
            jamRooms.set(roomCode, newRoom);
            res.end(JSON.stringify({ success: true, roomCode, hostId, room: newRoom }));
          });
          return;
        }

        // 2. Join Room
        if (pathname === '/join') {
          readJson((data) => {
            const code = ((data.roomCode || data.code || parsedUrl.searchParams.get('room') || '') as string).toUpperCase().trim();
            const room = jamRooms.get(code);
            if (!room) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Jam room not found or expired' }));
              return;
            }
            const participantId = data.participantId || `peer_${Math.random().toString(36).slice(2, 8)}`;
            const participantName = data.participantName || 'Music Fan';
            const existingIdx = room.participants.findIndex(p => p.id === participantId);
            if (existingIdx !== -1) {
              room.participants[existingIdx].lastSeen = Date.now();
              room.participants[existingIdx].name = participantName;
            } else {
              room.participants.push({
                id: participantId,
                name: participantName,
                isHost: false,
                lastSeen: Date.now()
              });
            }
            room.updatedAt = Date.now();
            res.end(JSON.stringify({ success: true, participantId, room }));
          });
          return;
        }

        // 3. Host / Peer Sync State
        if (pathname === '/sync') {
          readJson((data) => {
            const code = ((data.roomCode || data.code || parsedUrl.searchParams.get('room') || '') as string).toUpperCase().trim();
            const room = jamRooms.get(code);
            if (!room) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Room not found' }));
              return;
            }

            if (data.isHost) {
              if (data.currentSong !== undefined) room.currentSong = data.currentSong;
              if (data.currentTime !== undefined) room.currentTime = data.currentTime;
              if (data.isPlaying !== undefined) room.isPlaying = data.isPlaying;
              room.hostTimestamp = Date.now();
            }

            if (data.participantId) {
              const p = room.participants.find(x => x.id === data.participantId);
              if (p) {
                p.lastSeen = Date.now();
              }
            }

            room.participants = room.participants.filter(p => Date.now() - p.lastSeen < 30000);
            room.updatedAt = Date.now();

            res.end(JSON.stringify({ success: true, room, serverTime: Date.now() }));
          });
          return;
        }

        // 4. Get Room State
        if (pathname === '/state') {
          const code = (parsedUrl.searchParams.get('room') || '').toUpperCase().trim();
          const room = jamRooms.get(code);
          if (!room) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Room not found' }));
            return;
          }
          res.end(JSON.stringify({ success: true, room, serverTime: Date.now() }));
          return;
        }

        // 5. Send Floating Reaction
        if (pathname === '/reaction') {
          readJson((data) => {
            const code = ((data.roomCode || data.code || parsedUrl.searchParams.get('room') || '') as string).toUpperCase().trim();
            const room = jamRooms.get(code);
            if (!room) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Room not found' }));
              return;
            }
            const reaction = {
              id: `rx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              emoji: data.emoji || '🔥',
              user: data.user || 'Friend',
              timestamp: Date.now()
            };
            room.reactions.push(reaction);
            if (room.reactions.length > 30) room.reactions.shift();
            room.updatedAt = Date.now();
            res.end(JSON.stringify({ success: true, reaction, reactions: room.reactions }));
          });
          return;
        }

        // 6. WebRTC Signaling Relay
        if (pathname === '/signal') {
          if (req.method === 'POST') {
            readJson((data) => {
              const code = ((data.roomCode || data.code || parsedUrl.searchParams.get('room') || '') as string).toUpperCase().trim();
              const room = jamRooms.get(code);
              if (!room) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Room not found' }));
                return;
              }
              const signalItem = {
                senderId: data.senderId,
                targetId: data.targetId,
                data: data.data,
                timestamp: Date.now()
              };
              room.signals.push(signalItem);
              if (room.signals.length > 50) room.signals.shift();
              res.end(JSON.stringify({ success: true }));
            });
            return;
          } else {
            const code = (parsedUrl.searchParams.get('room') || '').toUpperCase().trim();
            const targetId = parsedUrl.searchParams.get('targetId') || '';
            const room = jamRooms.get(code);
            if (!room) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Room not found' }));
              return;
            }
            const mySignals = room.signals.filter(s => s.targetId === targetId);
            room.signals = room.signals.filter(s => s.targetId !== targetId);
            res.end(JSON.stringify({ signals: mySignals }));
            return;
          }
        }

        next();
      });

      // 3. Local Library Audio Endpoint
      server.middlewares.use('/api/audio', (req: any, res: any) => {
        try {
          const url = new URL(req.url, 'http://localhost:3000');
          const relPath = url.searchParams.get('path');
          if (!relPath) {
            res.statusCode = 400;
            res.end('Missing path parameter');
            return;
          }

          // Clean normalized path
          const decodedRelPath = decodeURIComponent(relPath).replace(/^[\\\/]+/, '');
          let fullPath = path.join(songsBaseDir, decodedRelPath);

          // If file not found directly, search case-insensitively or by filename
          if (!fs.existsSync(fullPath)) {
            const fileName = path.basename(decodedRelPath);
            if (fs.existsSync(songsBaseDir)) {
              const subdirs = fs.readdirSync(songsBaseDir);
              for (const dir of subdirs) {
                const candidate = path.join(songsBaseDir, dir, fileName);
                if (fs.existsSync(candidate)) {
                  fullPath = candidate;
                  break;
                }
              }
            }
          }

          if (!fs.existsSync(fullPath)) {
            res.statusCode = 404;
            res.end('Audio file not found');
            return;
          }

          const stat = fs.statSync(fullPath);
          const fileSize = stat.size;
          const range = req.headers.range;

          // MIME type
          const ext = path.extname(fullPath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.opus': 'audio/opus',
            '.m4a': 'audio/mp4',
            '.flac': 'audio/flac'
          };
          const contentType = mimeTypes[ext] || 'audio/mpeg';

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Type', contentType);

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', chunkSize);

            const stream = fs.createReadStream(fullPath, { start, end });
            stream.pipe(res);
          } else {
            res.statusCode = 200;
            res.setHeader('Content-Length', fileSize);
            const stream = fs.createReadStream(fullPath);
            stream.pipe(res);
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(err.message || 'Internal error');
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), localMusicServerPlugin()],
  server: {
    port: 3000,
    open: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('zustand')) {
              return 'vendor';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('peerjs')) {
              return 'peerjs';
            }
            if (id.includes('idb')) {
              return 'idb';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});

