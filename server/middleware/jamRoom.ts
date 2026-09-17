/**
 * server/middleware/jamRoom.ts
 * WebRTC Social Jam (Listen Together) backend with room management and signaling.
 * Extracted from vite.config.ts lines 371-573.
 * Preserves exact route paths, JSON body parsing, room lifecycle, and response format.
 */

import { jamRooms, type JamRoomData, type JamParticipant, type JamSignal } from '../helpers/caches.ts';

/**
 * Start the periodic cleanup interval for abandoned Jam rooms (>2 hours inactive).
 * Call once during server setup.
 */
export function startJamRoomCleanup() {
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of jamRooms.entries()) {
      if (now - room.updatedAt > 2 * 60 * 60 * 1000) {
        jamRooms.delete(code);
      }
    }
  }, 15 * 60 * 1000);
}

export function jamRoomHandler(req: any, res: any, next: any) {
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
      const existingIdx = room.participants.findIndex((p: JamParticipant) => p.id === participantId);
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
        const p = room.participants.find((x: JamParticipant) => x.id === data.participantId);
        if (p) {
          p.lastSeen = Date.now();
        }
      }

      room.participants = room.participants.filter((p: JamParticipant) => Date.now() - p.lastSeen < 30000);
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
      const mySignals = room.signals.filter((s: JamSignal) => s.targetId === targetId);
      room.signals = room.signals.filter((s: JamSignal) => s.targetId !== targetId);
      res.end(JSON.stringify({ signals: mySignals }));
      return;
    }
  }

  next();
}
