/**
 * server/helpers/caches.ts
 * Shared in-memory caches for the Aura dev/prod server.
 * Single source of truth — imported by all middleware handlers.
 */

export interface JamParticipant {
  id: string;
  name: string;
  isHost: boolean;
  lastSeen: number;
}

export interface JamReaction {
  id: string;
  emoji: string;
  user: string;
  timestamp: number;
}

export interface JamSignal {
  senderId: string;
  targetId: string;
  data: any;
  timestamp: number;
}

export interface JamRoomData {
  code: string;
  hostId: string;
  hostName: string;
  currentSong: any | null;
  currentTime: number;
  isPlaying: boolean;
  hostTimestamp: number;
  participants: JamParticipant[];
  reactions: JamReaction[];
  signals: JamSignal[];
  updatedAt: number;
}

export const searchCache = new Map<string, any>();
export const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();
export const jamRooms = new Map<string, JamRoomData>();

const MAX_SEARCH_CACHE_SIZE = 200;

export function setBoundedSearchCache(key: string, data: any): void {
  if (searchCache.has(key)) {
    searchCache.delete(key);
  } else if (searchCache.size >= MAX_SEARCH_CACHE_SIZE) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }
  searchCache.set(key, data);
}
