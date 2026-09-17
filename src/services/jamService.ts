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
  // OpenRelay TURN Servers (Bypasses strict symmetric NAT, college Wi-Fi & UDP blocking)
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

  // WebRTC PeerJS State
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null; // For listeners
  private peerConnections: Map<string, DataConnection> = new Map(); // For host

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
    return `aurajam-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }

  public async createRoom(hostName: string = 'Aura Host'): Promise<string> {
    this.leaveRoom();
    this.myName = hostName.trim() || 'Aura Host';

    // Generate random 4-letter code, e.g. JAM-W623
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
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
          this.error = null;

          this.startHostSyncLoop();
          this.notify();
          resolve(code);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingPeerConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          console.warn('PeerJS Host notice:', err);
          if (!this.isInRoom) {
            // If Peer ID already taken, retry with fresh code
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
      if (data && data.type === 'JOIN') {
        const existing = this.participants.find((p) => p.id === data.participantId);
        if (!existing) {
          this.participants.push({
            id: data.participantId,
            name: data.participantName || 'Friend',
            isHost: false
          });
          this.notify();
        }
      } else if (data && data.type === 'REACTION') {
        this.handleIncomingReaction(data.reaction);
        // Relay reaction to all other connected peers
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
    const cleanCode = code.trim().toUpperCase();
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
            this.error = 'Connection timed out. Host offline-a irukalam or network firewall block pannalam.';
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

            this.notify();
            resolve(true);
          });

          conn.on('data', (data: any) => {
            if (data.type === 'INIT' || data.type === 'SYNC') {
              this.applyIncomingPlaybackSync(data);
            } else if (data.type === 'REACTION') {
              this.handleIncomingReaction(data.reaction);
            }
          });

          conn.on('close', () => {
            this.leaveRoom();
          });

          conn.on('error', (err) => {
            if (isSettled) return;
            isSettled = true;
            clearTimeout(connectionTimeout);
            console.error('Peer connection error:', err);
            this.error = 'Could not connect to host. Room code check pannunga nanba.';
            this.notify();
            resolve(false);
          });
        });

        this.peer.on('error', (err) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(connectionTimeout);
          console.error('Peer listener error:', err);
          this.error = 'WebRTC Peer error. Please retry.';
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

  private startHostSyncLoop() {
    this.stopSyncLoop();
    this.syncInterval = setInterval(() => {
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

      // 1. Broadcast to WebRTC peers across internet
      this.broadcastToPeers(payload);

      // 2. Broadcast to local tabs on same machine
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'SYNC',
          payload
        });
      }
    }, 1200);
  }

  private stopSyncLoop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private applyIncomingPlaybackSync(data: any) {
    if (this.isHost || !data) return;

    const { currentSong, currentTime, isPlaying, timestamp } = data;
    const now = Date.now();
    const networkLatencySec = Math.max(0, (now - (timestamp || now)) / 1000);
    const expectedTime = isPlaying ? currentTime + networkLatencySec : currentTime;

    const mySong = audioService.getCurrentSong();
    const myTime = audioService.getCurrentPlaybackTime();
    const drift = Math.abs(myTime - expectedTime);
    this.driftMs = Math.round(drift * 1000);

    // Song difference check
    if (currentSong && (!mySong || mySong.id !== currentSong.id)) {
      audioService.playSong(currentSong);
      
      let synced = false;
      const onReadyToSync = () => {
        if (synced) return;
        synced = true;
        audioService.seek(expectedTime);
        if (isPlaying) {
          audioService.play();
        } else {
          audioService.pause();
        }
      };

      const audioEl = audioService.getAudioElement();
      if (audioEl) {
        audioEl.addEventListener('loadedmetadata', onReadyToSync, { once: true });
        audioEl.addEventListener('canplay', onReadyToSync, { once: true });
      }
      const unsubCloud = cloudPlayerService.onPlay(() => {
        onReadyToSync();
        unsubCloud();
      });
      setTimeout(onReadyToSync, 800);
    } else {
      // Drift compensation: only seek if drift > 1.2s to prevent audio stutter
      if (drift > 1.2) {
        audioService.seek(expectedTime);
      }

      const currentlyPlaying = audioService.isCurrentlyPlaying();
      if (isPlaying && !currentlyPlaying) {
        audioService.play();
      } else if (!isPlaying && currentlyPlaying) {
        audioService.pause();
      }
    }

    this.notify();
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

    // If host, send to all peers; if listener, send to host
    if (this.isHost) {
      this.broadcastToPeers(payload);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(payload);
    }

    // Also broadcast to local tabs
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

    // Auto cleanup old reactions after 4 seconds
    setTimeout(() => {
      this.reactions = this.reactions.filter((r) => r.id !== reaction.id);
      this.notify();
    }, 4000);
  }

  public leaveRoom() {
    this.stopSyncLoop();

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
    this.error = null;
    this.notify();
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
}

export const jamService = new JamService();
