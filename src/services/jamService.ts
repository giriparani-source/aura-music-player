import { Song } from '../types/music';
import { audioService } from './audioService';

export interface JamParticipant {
  id: string;
  name: string;
  isHost: boolean;
  lastSeen?: number;
}

export interface JamReaction {
  id: string;
  emoji: string;
  user: string;
  timestamp: number;
}

export interface JamRoomState {
  code: string;
  hostId: string;
  hostName: string;
  currentSong: Song | null;
  currentTime: number;
  isPlaying: boolean;
  hostTimestamp: number;
  participants: JamParticipant[];
  reactions: JamReaction[];
}

type JamEventListener = (state: {
  isInRoom: boolean;
  isHost: boolean;
  roomCode: string | null;
  participants: JamParticipant[];
  reactions: JamReaction[];
  driftMs: number;
  error: string | null;
}) => void;

class JamService {
  private isInRoom = false;
  private isHost = false;
  private roomCode: string | null = null;
  private myId = `user_${Math.random().toString(36).slice(2, 8)}`;
  private myName = 'Music Lover';
  private participants: JamParticipant[] = [];
  private reactions: JamReaction[] = [];
  private driftMs = 0;
  private error: string | null = null;

  private syncInterval: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<JamEventListener> = new Set();

  constructor() {
    this.setupBroadcastChannel();
  }

  private setupBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('aura_social_jam_bus');
      this.broadcastChannel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'SYNC' && !this.isHost && this.isInRoom && payload.roomCode === this.roomCode) {
          this.applyIncomingPlaybackSync(payload);
        } else if (type === 'REACTION' && payload.roomCode === this.roomCode) {
          this.handleIncomingReaction(payload.reaction);
        }
      };
    }
  }

  public async createRoom(hostName: string = 'Aura Host'): Promise<string> {
    this.leaveRoom();
    this.myName = hostName.trim() || 'Aura Host';

    try {
      const resp = await fetch('/api/jam/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: this.myId,
          hostName: this.myName,
          currentSong: audioService.getCurrentSong(),
          currentTime: audioService.getAudioElement().currentTime || 0,
          isPlaying: !audioService.getAudioElement().paused
        })
      });

      const data = await resp.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create room');
      }

      this.isInRoom = true;
      this.isHost = true;
      this.roomCode = data.roomCode;
      this.participants = data.room.participants || [];
      this.error = null;

      this.startHostSyncLoop();
      this.notify();
      return data.roomCode;
    } catch (err: any) {
      this.error = err.message || 'Network error creating Jam room';
      this.notify();
      throw err;
    }
  }

  public async joinRoom(code: string, participantName: string = 'Friend'): Promise<boolean> {
    this.leaveRoom();
    const cleanCode = code.trim().toUpperCase();
    this.myName = participantName.trim() || 'Friend';

    try {
      const resp = await fetch('/api/jam/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: cleanCode,
          participantId: this.myId,
          participantName: this.myName
        })
      });

      const data = await resp.json();
      if (!data.success) {
        this.error = data.error || 'Cannot join room';
        this.notify();
        return false;
      }

      this.isInRoom = true;
      this.isHost = false;
      this.roomCode = cleanCode;
      this.participants = data.room.participants || [];
      this.error = null;

      // Apply initial host playback state
      this.applyIncomingPlaybackSync(data.room);

      this.startListenerSyncLoop();
      this.notify();
      return true;
    } catch (err: any) {
      this.error = err.message || 'Could not connect to Jam room';
      this.notify();
      return false;
    }
  }

  public leaveRoom() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isInRoom = false;
    this.isHost = false;
    this.roomCode = null;
    this.participants = [];
    this.reactions = [];
    this.driftMs = 0;
    this.error = null;
    this.notify();
  }

  private startHostSyncLoop() {
    if (this.syncInterval) clearInterval(this.syncInterval);

    this.syncInterval = setInterval(async () => {
      if (!this.isInRoom || !this.isHost || !this.roomCode) return;

      const audio = audioService.getAudioElement();
      const currentSong = audioService.getCurrentSong();
      const payload = {
        roomCode: this.roomCode,
        isHost: true,
        participantId: this.myId,
        currentSong,
        currentTime: audio.currentTime || 0,
        isPlaying: !audio.paused,
        hostTimestamp: Date.now()
      };

      // Broadcast to local tabs instantly
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'SYNC', payload });
      }

      // Sync with server
      try {
        const res = await fetch('/api/jam/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.room) {
          this.participants = data.room.participants || [];
          this.reactions = data.room.reactions || [];
          this.notify();
        }
      } catch {
        // Ignore periodic transient sync errors
      }
    }, 1200);
  }

  private startListenerSyncLoop() {
    if (this.syncInterval) clearInterval(this.syncInterval);

    this.syncInterval = setInterval(async () => {
      if (!this.isInRoom || this.isHost || !this.roomCode) return;

      try {
        const res = await fetch(`/api/jam/state?room=${encodeURIComponent(this.roomCode)}`);
        const data = await res.json();
        if (data.success && data.room) {
          this.applyIncomingPlaybackSync(data.room, data.serverTime);
          this.participants = data.room.participants || [];
          this.reactions = data.room.reactions || [];
          this.notify();
        } else {
          this.leaveRoom();
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 1800);
  }

  private applyIncomingPlaybackSync(room: any, serverTime: number = Date.now()) {
    if (!room) return;

    const audio = audioService.getAudioElement();
    const currentSong = audioService.getCurrentSong();

    // 1. Song match
    if (room.currentSong) {
      const isDifferentSong = !currentSong || currentSong.id !== room.currentSong.id;
      if (isDifferentSong) {
        audioService.playSong(room.currentSong).catch(() => {});
      }
    }

    // 2. Latency & timestamp drift compensation
    const latencySec = Math.max(0, (Date.now() - (room.hostTimestamp || serverTime)) / 1000);
    const targetTime = (room.currentTime || 0) + (room.isPlaying ? latencySec : 0);
    const timeDiff = Math.abs((audio.currentTime || 0) - targetTime);

    this.driftMs = Math.round(timeDiff * 1000);

    // Only seek if drift exceeds threshold (1.4s) to avoid jittering
    if (timeDiff > 1.4 && isFinite(targetTime)) {
      audioService.seek(targetTime);
    }

    // 3. Play / Pause synchronization
    if (room.isPlaying && audio.paused) {
      audioService.resume().catch(() => {});
    } else if (!room.isPlaying && !audio.paused) {
      audioService.pause();
    }
  }

  public async sendReaction(emoji: string) {
    if (!this.isInRoom || !this.roomCode) return;

    const reactionItem: JamReaction = {
      id: `rx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      user: this.myName,
      timestamp: Date.now()
    };

    this.handleIncomingReaction(reactionItem);

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'REACTION',
        payload: { roomCode: this.roomCode, reaction: reactionItem }
      });
    }

    try {
      await fetch('/api/jam/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.roomCode,
          emoji,
          user: this.myName
        })
      });
    } catch {
      // Ignore reaction error
    }
  }

  private handleIncomingReaction(rx: JamReaction) {
    this.reactions = [...this.reactions.slice(-25), rx];
    this.notify();
  }

  public getRoomCode(): string | null {
    return this.roomCode;
  }

  public isRoomHost(): boolean {
    return this.isHost;
  }

  public subscribe(listener: JamEventListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = {
      isInRoom: this.isInRoom,
      isHost: this.isHost,
      roomCode: this.roomCode,
      participants: this.participants,
      reactions: this.reactions,
      driftMs: this.driftMs,
      error: this.error
    };
    this.listeners.forEach((l) => l(state));
  }
}

export const jamService = new JamService();
