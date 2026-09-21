import { Peer, DataConnection } from 'peerjs';
import { Song } from '../types/music';
import { audioService } from './audioService';
import { cloudPlayerService } from './cloudPlayerService';

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

export type JamSyncStatus = 'idle' | 'syncing' | 'perfect' | 'steering' | 'buffering';

export interface JamStatePayload {
  isInRoom: boolean;
  isHost: boolean;
  roomCode: string | null;
  participants: JamParticipant[];
  reactions: JamReaction[];
  driftMs: number;
  syncStatus: JamSyncStatus;
  clockOffsetMs: number;
  error: string | null;
}

export const JAM_ICE_SERVERS: RTCIceServer[] = [
  // High Availability Google STUNs
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Cloudflare STUN
  { urls: 'stun:stun.cloudflare.com:3478' },
  // Metered STUN
  { urls: 'stun:stun.relay.metered.ca:80' },
  // OpenRelay TURN Servers (Bypasses symmetric NAT, carrier firewalls, college Wi-Fi & cellular barriers across cities)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelay',
    credential: 'openrelay'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelay',
    credential: 'openrelay'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelay',
    credential: 'openrelay'
  },
  {
    urls: 'turns:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelay',
    credential: 'openrelay'
  }
];

export const JAM_PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: JAM_ICE_SERVERS,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all' as RTCIceTransportPolicy
  }
};

type JamEventListener = (state: JamStatePayload) => void;

class JamService {
  private isInRoom = false;
  private isHost = false;
  private roomCode: string | null = null;
  private myId = `user_${Math.random().toString(36).slice(2, 8)}`;
  private myName = 'Music Lover';
  private participants: JamParticipant[] = [];
  private reactions: JamReaction[] = [];
  private driftMs = 0;
  private syncStatus: JamSyncStatus = 'idle';
  private error: string | null = null;

  // WebRTC PeerJS State
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null; // For listeners
  private peerConnections: Map<string, DataConnection> = new Map(); // For host

  // High-Precision Synchronization & NTP Clock Calibration Engine
  private clockOffsetMs = 0; // Host time minus listener time
  private isClockCalibrated = false;
  private calibrationSamples: Array<{ rttMs: number; offset: number }> = [];
  private clockPingInterval: any = null;
  private lastHardSeekTime = 0;
  private isBufferingNewSong = false;
  private unsubAudioService: (() => void) | null = null;

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

  private generatePeerId(code: string): string {
    const normalized = code
      .toLowerCase()
      .replace(/[\s-]/g, '')
      .replace(/^jam/i, '')
      .replace(/o/g, '0')
      .replace(/[il]/g, '1');
    return `aurajam-${normalized}`;
  }

  public async createRoom(hostName: string = 'Aura Host'): Promise<string> {
    this.leaveRoom();
    this.myName = hostName.trim() || 'Aura Host';

    const SAFE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let randomChars = '';
    for (let i = 0; i < 4; i++) {
      randomChars += SAFE_CHARS.charAt(Math.floor(Math.random() * SAFE_CHARS.length));
    }
    const code = `JAM-${randomChars}`;
    const peerId = this.generatePeerId(code);

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(peerId, JAM_PEER_CONFIG);

        this.peer.on('open', (_id) => {
          this.isInRoom = true;
          this.isHost = true;
          this.roomCode = code;
          this.participants = [{ id: this.myId, name: this.myName, isHost: true }];
          this.syncStatus = 'perfect';
          this.error = null;

          this.startHostSyncLoop();
          this.setupHostAudioListener();
          this.notify();
          resolve(code);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingPeerConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          console.warn('PeerJS Host notice:', err);
          if (!this.isInRoom) {
            this.createRoom(hostName).then(resolve).catch(reject);
          }
        });
      } catch (err: any) {
        this.error = err.message || 'WebRTC Initialization failed';
        this.notify();
        reject(err);
      }
    });
  }

  private handleIncomingPeerConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.peerConnections.set(conn.peer, conn);

      // Send initial state to newly joined listener
      const currentSong = audioService.getCurrentSong();
      conn.send({
        type: 'INIT',
        roomCode: this.roomCode,
        hostName: this.myName,
        currentSong,
        currentTime: audioService.getCurrentPlaybackTime(),
        isPlaying: audioService.isCurrentlyPlaying(),
        timestamp: Date.now()
      });
    });

    conn.on('data', (data: any) => {
      if (!data) return;

      if (data.type === 'JOIN') {
        const existing = this.participants.find((p) => p.id === data.participantId);
        if (!existing) {
          this.participants.push({
            id: data.participantId,
            name: data.participantName || 'Friend',
            isHost: false
          });
          this.notify();
        }
      } else if (data.type === 'CLOCK_PING') {
        // Immediately bounce back NTP pong to calibrate listener's clock offset
        conn.send({
          type: 'CLOCK_PONG',
          clientPingId: data.clientPingId,
          clientSendPerf: data.clientSendPerf,
          clientSendDate: data.clientSendDate,
          hostDate: Date.now()
        });
      } else if (data.type === 'REACTION') {
        this.handleIncomingReaction(data.reaction);
        this.broadcastToPeers(data);
      }
    });

    conn.on('close', () => {
      this.peerConnections.delete(conn.peer);
      this.participants = this.participants.filter((p) => p.id !== conn.peer);
      this.notify();
    });
  }

  public async joinRoom(code: string, participantName: string = 'Friend'): Promise<boolean> {
    this.leaveRoom();
    const rawChars = code.trim().toUpperCase().replace(/[\s-]/g, '').replace(/^JAM/i, '');
    const cleanCode = `JAM-${rawChars}`;
    this.myName = participantName.trim() || 'Friend';
    const targetPeerId = this.generatePeerId(cleanCode);

    return new Promise((resolve) => {
      let isSettled = false;
      try {
        const myPeerId = `listener-${Math.random().toString(36).substring(2, 8)}`;
        this.peer = new Peer(myPeerId, JAM_PEER_CONFIG);

        const connectionTimeout = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            this.error = `Room "${cleanCode}" connect timeout. Host room start panni app-ah open-la vachurukara nu check pannunga nanba.`;
            this.notify();
            resolve(false);
          }
        }, 12000);

        this.peer.on('open', () => {
          if (!this.peer) return;
          const conn = this.peer.connect(targetPeerId, {
            reliable: true
          });

          this.hostConnection = conn;

          conn.on('open', () => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(connectionTimeout);

            this.isInRoom = true;
            this.isHost = false;
            this.roomCode = cleanCode;
            this.syncStatus = 'syncing';
            this.error = null;

            // Send Join announcement
            conn.send({
              type: 'JOIN',
              participantId: this.myId,
              participantName: this.myName
            });

            this.participants = [
              { id: 'host', name: 'Party Host', isHost: true },
              { id: this.myId, name: this.myName, isHost: false }
            ];

            // Perform high-precision NTP clock calibration over WebRTC
            this.performClockCalibration();
            this.startRecurringClockSync();

            this.notify();
            resolve(true);
          });

          conn.on('data', (data: any) => {
            if (!data) return;

            if (data.type === 'CLOCK_PONG') {
              this.handleClockPong(data);
            } else if (data.type === 'INIT' || data.type === 'SYNC') {
              this.applyIncomingPlaybackSync(data);
            } else if (data.type === 'REACTION') {
              this.handleIncomingReaction(data.reaction);
            }
          });

          conn.on('close', () => {
            this.leaveRoom();
          });

          conn.on('error', (err: any) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(connectionTimeout);
            console.warn('Peer connection error:', err);
            this.error = `Host "${cleanCode}" kooda connect aagala. Host online-la irukara nu check pannunga nanba.`;
            this.notify();
            resolve(false);
          });
        });

        this.peer.on('error', (err: any) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(connectionTimeout);
          console.warn('Peer listener error:', err);
          const errType = (err?.type || '').toLowerCase();
          if (errType === 'peer-unavailable') {
            this.error = `Room "${cleanCode}" kedaikala nanba. Host room create panni online-la irukara nu check pannunga.`;
          } else if (errType.includes('network') || errType.includes('socket') || errType.includes('server')) {
            this.error = 'Signaling network error. Internet connection check pannitu retry pannunga.';
          } else {
            this.error = err.message || 'WebRTC Peer error. Please verify room code and retry.';
          }
          this.notify();
          resolve(false);
        });
      } catch (err: any) {
        this.error = err.message || 'Failed to join WebRTC room';
        this.notify();
        resolve(false);
      }
    });
  }

  /**
   * High-Precision NTP Clock Calibration
   * Exchanges ping/pong packets with the host to measure RTT and cancel out
   * system clock skew between two different mobile devices.
   */
  private performClockCalibration() {
    if (!this.hostConnection || !this.hostConnection.open) return;

    this.calibrationSamples = [];
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (this.hostConnection && this.hostConnection.open) {
          this.hostConnection.send({
            type: 'CLOCK_PING',
            clientPingId: i,
            clientSendPerf: performance.now(),
            clientSendDate: Date.now()
          });
        }
      }, i * 120);
    }
  }

  private handleClockPong(data: any) {
    const receivePerf = performance.now();
    const rttMs = Math.max(1, receivePerf - data.clientSendPerf);
    const oneWayMs = rttMs / 2;
    // Host clock offset relative to client clock
    const sampleOffset = data.hostDate - (data.clientSendDate + oneWayMs);

    this.calibrationSamples.push({ rttMs, offset: sampleOffset });

    // Pick best sample with lowest round-trip latency
    const bestSample = this.calibrationSamples.reduce((best, curr) =>
      curr.rttMs < best.rttMs ? curr : best
    );

    if (!this.isClockCalibrated) {
      this.clockOffsetMs = Math.round(bestSample.offset);
      this.isClockCalibrated = true;
    } else {
      // Gentle smoothing EWMA (0.85 old + 0.15 new)
      this.clockOffsetMs = Math.round(this.clockOffsetMs * 0.85 + bestSample.offset * 0.15);
    }
  }

  private startRecurringClockSync() {
    this.stopRecurringClockSync();
    this.clockPingInterval = setInterval(() => {
      if (!this.isHost && this.isInRoom && this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({
          type: 'CLOCK_PING',
          clientPingId: 99,
          clientSendPerf: performance.now(),
          clientSendDate: Date.now()
        });
      }
    }, 12000);
  }

  private stopRecurringClockSync() {
    if (this.clockPingInterval) {
      clearInterval(this.clockPingInterval);
      this.clockPingInterval = null;
    }
  }

  private broadcastToPeers(payload: any) {
    this.peerConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch (e) {
          console.warn('Error sending to peer:', e);
        }
      }
    });
  }

  /**
   * Broadcast immediate state update whenever the host pauses, plays, seeks, or changes track
   */
  private broadcastCurrentState() {
    if (!this.isHost || !this.isInRoom) return;

    const currentSong = audioService.getCurrentSong();
    const currentTime = audioService.getCurrentPlaybackTime();
    const isPlaying = audioService.isCurrentlyPlaying();

    const payload = {
      type: 'SYNC',
      roomCode: this.roomCode,
      currentSong,
      currentTime,
      isPlaying,
      timestamp: Date.now()
    };

    this.broadcastToPeers(payload);

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SYNC',
        payload
      });
    }
  }

  private setupHostAudioListener() {
    if (this.unsubAudioService) {
      this.unsubAudioService();
      this.unsubAudioService = null;
    }

    let lastSongId = audioService.getCurrentSong()?.id || null;
    let lastIsPlaying = audioService.isCurrentlyPlaying();
    let lastTime = audioService.getCurrentPlaybackTime();

    this.unsubAudioService = audioService.subscribe((state) => {
      if (!this.isHost || !this.isInRoom) return;

      const currentSongId = state.currentSong?.id || null;
      const isPlaying = state.isPlaying;
      const currentTime = state.currentTime;

      const songChanged = currentSongId !== lastSongId;
      const playStateChanged = isPlaying !== lastIsPlaying;
      const timeJumped = Math.abs(currentTime - lastTime) > 2.0;

      lastSongId = currentSongId;
      lastIsPlaying = isPlaying;
      lastTime = currentTime;

      if (songChanged || playStateChanged || timeJumped) {
        this.broadcastCurrentState();
      }
    });
  }

  private startHostSyncLoop() {
    this.stopSyncLoop();
    this.syncInterval = setInterval(() => {
      this.broadcastCurrentState();
    }, 1500);
  }

  private stopSyncLoop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Continuous, seamless 3-tier playback synchronization without audio break
   */
  private applyIncomingPlaybackSync(data: any) {
    if (this.isHost || !data) return;

    const { currentSong, currentTime, isPlaying, timestamp } = data;
    if (typeof currentTime !== 'number') return;

    const mySong = audioService.getCurrentSong();

    // 1. Song Change Check
    if (currentSong && (!mySong || mySong.id !== currentSong.id)) {
      this.handleTrackTransition(currentSong, currentTime, isPlaying);
      return;
    }

    // 2. Guard against interrupting initial track buffer
    if (this.isBufferingNewSong) {
      return;
    }

    // 3. NTP-Calibrated Expected Playback Position
    const listenerTimeNow = Date.now();
    // Translate host timestamp to listener's timeline: hostTime - clockOffsetMs
    const clientEquivalentTimestamp = (timestamp || listenerTimeNow) - this.clockOffsetMs;
    const elapsedSinceHostSendSec = Math.max(0, Math.min(5, (listenerTimeNow - clientEquivalentTimestamp) / 1000));
    const expectedHostPlaybackTime = isPlaying ? currentTime + elapsedSinceHostSendSec : currentTime;

    const myTime = audioService.getCurrentPlaybackTime();
    // trueDelta: positive = listener is ahead of host; negative = listener is behind host
    const trueDelta = myTime - expectedHostPlaybackTime;
    const driftAbs = Math.abs(trueDelta);
    this.driftMs = Math.round(driftAbs * 1000);

    // 4. Play / Pause state synchronization
    const currentlyPlaying = audioService.isCurrentlyPlaying();
    if (isPlaying && !currentlyPlaying) {
      audioService.play();
    } else if (!isPlaying && currentlyPlaying) {
      audioService.pause();
      audioService.setPlaybackRate(1.0);
      this.syncStatus = 'perfect';
      this.notify();
      return;
    }

    // If host is paused, keep playhead locked without playback rate modifications
    if (!isPlaying) {
      if (driftAbs > 0.4) {
        audioService.seek(expectedHostPlaybackTime);
      }
      audioService.setPlaybackRate(1.0);
      this.syncStatus = 'perfect';
      this.notify();
      return;
    }

    // 5. 3-Tier Drift Compensation (When Host is Playing)
    // Tier 1: Tight Lock (< 60ms) -> Imperceptible difference, standard 1.0x rate
    if (driftAbs < 0.06) {
      if (audioService.getPlaybackRate() !== 1.0) {
        audioService.setPlaybackRate(1.0);
      }
      this.syncStatus = 'perfect';
    }
    // Tier 2: Seamless Micro-Rate Steering (60ms to 1200ms) -> NEVER HARD SEEK! ZERO AUDIO BREAK!
    else if (driftAbs <= 1.2) {
      let targetRate = 1.0;
      if (trueDelta < -0.06) {
        // Listener is behind host -> gently accelerate to catch up
        targetRate = driftAbs > 0.3 ? 1.05 : 1.025;
      } else if (trueDelta > 0.06) {
        // Listener is ahead of host -> gently decelerate to let host catch up
        targetRate = driftAbs > 0.3 ? 0.95 : 0.975;
      }
      audioService.setPlaybackRate(targetRate);
      this.syncStatus = 'steering';
    }
    // Tier 3: Hard Jump (> 1.2s) -> Host scrubbed or significant network glitch
    else {
      const now = Date.now();
      if (now - this.lastHardSeekTime > 4000) {
        // Enforce 4s cooldown between hard seeks to prevent thrashing
        this.lastHardSeekTime = now;
        audioService.seek(expectedHostPlaybackTime);
        audioService.setPlaybackRate(1.0);
        this.syncStatus = 'syncing';
      } else {
        // In cooldown period: steer at max safe rate instead of repeated seeking
        const steerRate = trueDelta < 0 ? 1.06 : 0.94;
        audioService.setPlaybackRate(steerRate);
        this.syncStatus = 'steering';
      }
    }

    this.notify();
  }

  private handleTrackTransition(song: Song, targetTime: number, shouldPlay: boolean) {
    this.lastHardSeekTime = Date.now();
    this.isBufferingNewSong = true;
    this.syncStatus = 'buffering';
    this.notify();

    audioService.playSong(song);

    let hasSynced = false;
    const audioEl = audioService.getAudioElement();

    const applyInitialSync = () => {
      if (hasSynced) return;
      hasSynced = true;
      this.isBufferingNewSong = false;
      this.lastHardSeekTime = Date.now();

      if (targetTime > 0.5) {
        audioService.seek(targetTime);
      }
      if (shouldPlay) {
        audioService.play();
      } else {
        audioService.pause();
      }
      audioService.setPlaybackRate(1.0);
      this.syncStatus = 'perfect';
      this.notify();
    };

    if (audioEl) {
      audioEl.addEventListener('canplay', applyInitialSync, { once: true });
      audioEl.addEventListener('playing', applyInitialSync, { once: true });
    }

    const unsubCloud = cloudPlayerService.onPlay(() => {
      applyInitialSync();
      unsubCloud();
    });

    // Fallback in case media events are delayed
    setTimeout(() => {
      if (!hasSynced) {
        applyInitialSync();
      }
    }, 3500);
  }

  public sendReaction(emoji: string) {
    if (!this.isInRoom) return;

    const reaction: JamReaction = {
      id: `rx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      user: this.myName,
      timestamp: Date.now()
    };

    this.handleIncomingReaction(reaction);

    const payload = {
      type: 'REACTION',
      roomCode: this.roomCode,
      reaction
    };

    if (this.isHost) {
      this.broadcastToPeers(payload);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(payload);
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'REACTION',
        payload
      });
    }
  }

  private handleIncomingReaction(reaction: JamReaction) {
    this.reactions = [...this.reactions.slice(-15), reaction];
    this.notify();

    setTimeout(() => {
      this.reactions = this.reactions.filter((r) => r.id !== reaction.id);
      this.notify();
    }, 4000);
  }

  public leaveRoom() {
    this.stopSyncLoop();
    this.stopRecurringClockSync();

    if (this.unsubAudioService) {
      this.unsubAudioService();
      this.unsubAudioService = null;
    }

    audioService.setPlaybackRate(1.0);

    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }

    this.peerConnections.forEach((conn) => conn.close());
    this.peerConnections.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.isInRoom = false;
    this.isHost = false;
    this.roomCode = null;
    this.participants = [];
    this.reactions = [];
    this.driftMs = 0;
    this.clockOffsetMs = 0;
    this.isClockCalibrated = false;
    this.syncStatus = 'idle';
    this.error = null;
    this.notify();
  }

  public subscribe(listener: JamEventListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state: JamStatePayload = {
      isInRoom: this.isInRoom,
      isHost: this.isHost,
      roomCode: this.roomCode,
      participants: this.participants,
      reactions: this.reactions,
      driftMs: this.driftMs,
      syncStatus: this.syncStatus,
      clockOffsetMs: this.clockOffsetMs,
      error: this.error
    };
    this.listeners.forEach((l) => l(state));
  }

  // Getters
  public getRoomCode() {
    return this.roomCode;
  }
  public getIsHost() {
    return this.isHost;
  }
  public getIsInRoom() {
    return this.isInRoom;
  }
  public getParticipants() {
    return this.participants;
  }
  public getReactions() {
    return this.reactions;
  }
  public getSyncStatus() {
    return this.syncStatus;
  }
  public getClockOffsetMs() {
    return this.clockOffsetMs;
  }
}

export const jamService = new JamService();
