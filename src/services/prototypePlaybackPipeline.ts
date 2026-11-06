/**
 * src/services/prototypePlaybackPipeline.ts
 *
 * Minimal Prototype for YouTube Background-Playback Architecture:
 * Spotify / YouTube Music playlist
 *   → identify song (title + artist)
 *   → Saavn match
 *   → if matched: Native ExoPlayer → background playback
 *   → if unmatched: server-side yt-dlp resolver → audio stream → Native ExoPlayer
 *   → if resolver fails: YouTube IFrame foreground fallback.
 *
 * INVARIANTS:
 * - NO visibilityState spoofing
 * - NO forced playVideo loops
 * - NO silent-audio hacks
 * - Isolated from production playback until device validation is complete
 */

import { Capacitor } from '@capacitor/core';
import { Song } from '../types/music';
import { searchJioSaavn } from './jiosaavnService';
import { androidMediaBridge, registerMediaActionHandler } from './androidMediaBridge';
import { cloudPlayerService } from './cloudPlayerService';
import { buildApiUrl } from '../utils/apiConfig';

export type ResolutionTier = 'SAAVN_NATIVE' | 'YTDLP_NATIVE' | 'IFRAME_FALLBACK';

export interface PrototypeTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  coverArt?: string;
  videoId?: string;
  platform?: 'spotify' | 'youtube' | 'custom';
  resolutionTier?: ResolutionTier;
  streamUrl?: string;
  status: 'PENDING' | 'RESOLVING' | 'PLAYING' | 'PAUSED' | 'FAILED' | 'FALLBACK';
  errorReason?: string;
  confidence?: number;
}

export interface PrototypeMetrics {
  totalProcessed: number;
  saavnMatchedCount: number;
  ytdlpResolvedCount: number;
  iframeFallbackCount: number;
  resolverSuccessRate: number; // percentage of audio that plays natively in ExoPlayer
  activePlayer: 'EXOPLAYER_NATIVE' | 'YOUTUBE_IFRAME' | 'NONE';
  isPlaying: boolean;
  screenOffDurationSec: number;
  isScreenLocked: boolean;
  lastMediaAction?: string;
  mediaActionCount: number;
}

export type PrototypeStateListener = (
  tracks: PrototypeTrack[],
  currentIndex: number,
  metrics: PrototypeMetrics,
  logs: string[]
) => void;

class PrototypePlaybackPipeline {
  private tracks: PrototypeTrack[] = [];
  private currentIndex: number = -1;
  private listeners: Set<PrototypeStateListener> = new Set();
  private logs: string[] = [];

  // Metrics
  private metrics: PrototypeMetrics = {
    totalProcessed: 0,
    saavnMatchedCount: 0,
    ytdlpResolvedCount: 0,
    iframeFallbackCount: 0,
    resolverSuccessRate: 0,
    activePlayer: 'NONE',
    isPlaying: false,
    screenOffDurationSec: 0,
    isScreenLocked: false,
    mediaActionCount: 0
  };

  // Screen-off background tracker
  private screenOffTimer: any = null;
  private screenOffStartTime: number = 0;
  private isInitialized: boolean = false;
  private customServerBaseUrl: string = '';

  constructor() {
    this.init();
  }

  public setServerBaseUrl(url: string) {
    this.customServerBaseUrl = url.trim().replace(/\/+$/, '');
    this.log(`[Config] Server Base URL set to: ${this.customServerBaseUrl || 'Default buildApiUrl'}`);
  }

  public getServerBaseUrl(): string {
    return this.customServerBaseUrl;
  }

  private init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Setup mediaAction listener for lock-screen & Bluetooth controls
    registerMediaActionHandler((action: string, position?: number) => {
      this.handleMediaAction(action, position);
    });

    // 2. Track screen off / background transitions for continuity measurement
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.metrics.isScreenLocked = true;
        this.screenOffStartTime = Date.now();
        this.log(`[Screen-Off] Screen turned OFF / App minimized. Monitoring ExoPlayer continuity...`);
        this.startScreenOffTicker();
      } else {
        this.metrics.isScreenLocked = false;
        if (this.screenOffStartTime > 0) {
          const elapsed = Math.round((Date.now() - this.screenOffStartTime) / 1000);
          this.log(`[Screen-On] Screen turned ON. Background continuous duration: ${elapsed}s (IsPlaying: ${this.metrics.isPlaying})`);
        }
        this.stopScreenOffTicker();
      }
      this.notify();
    });

    // 3. Listen to ExoPlayer progress updates
    androidMediaBridge.onPlaybackProgress(({ position, duration, isPlaying }) => {
      if (this.metrics.activePlayer === 'EXOPLAYER_NATIVE') {
        this.metrics.isPlaying = isPlaying;
        if (isPlaying && this.currentIndex >= 0 && this.tracks[this.currentIndex]) {
          this.tracks[this.currentIndex].status = 'PLAYING';
        }
        this.notify();
      }
    });
  }

  private startScreenOffTicker() {
    if (this.screenOffTimer) clearInterval(this.screenOffTimer);
    this.screenOffTimer = setInterval(() => {
      if (this.screenOffStartTime > 0) {
        this.metrics.screenOffDurationSec = Math.round((Date.now() - this.screenOffStartTime) / 1000);
        this.notify();
      }
    }, 1000);
  }

  private stopScreenOffTicker() {
    if (this.screenOffTimer) {
      clearInterval(this.screenOffTimer);
      this.screenOffTimer = null;
    }
  }

  public log(msg: string) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${msg}`;
    console.log(entry);
    this.logs.unshift(entry);
    if (this.logs.length > 100) this.logs.pop();
    this.notify();
  }

  public subscribe(cb: PrototypeStateListener): () => void {
    this.listeners.add(cb);
    cb(this.tracks, this.currentIndex, this.metrics, this.logs);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb([...this.tracks], this.currentIndex, { ...this.metrics }, [...this.logs]);
      } catch (e) {
        console.warn('Error in prototype state listener:', e);
      }
    });
  }

  /**
   * Load tracks into the prototype queue
   */
  public loadTracks(tracks: PrototypeTrack[]) {
    this.tracks = tracks.map((t) => ({ ...t, status: 'PENDING' }));
    this.currentIndex = 0;
    this.metrics.totalProcessed = tracks.length;
    this.metrics.saavnMatchedCount = 0;
    this.metrics.ytdlpResolvedCount = 0;
    this.metrics.iframeFallbackCount = 0;
    this.metrics.resolverSuccessRate = 0;
    this.metrics.activePlayer = 'NONE';
    this.metrics.isPlaying = false;
    this.log(`Loaded ${tracks.length} tracks into Prototype Queue.`);
    this.notify();
  }

  /**
   * Build URL for backend stream resolver
   */
  private getStreamApiUrl(videoId: string, jsonMode: boolean = false): string {
    const query = `id=${encodeURIComponent(videoId)}${jsonMode ? '&json=1' : ''}`;
    if (this.customServerBaseUrl) {
      return `${this.customServerBaseUrl}/api/online/stream?${query}`;
    }
    return buildApiUrl(`/api/online/stream?${query}`);
  }

  /**
   * Step 1: Identify and clean song metadata
   */
  public identifyTrack(track: PrototypeTrack): { cleanTitle: string; cleanArtist: string } {
    let cleanTitle = track.title
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/[|•].*$/g, '')
      .replace(/\b(official video|video song|audio song|lyrics?|4k|hd|remastered)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    let cleanArtist = track.artist
      .replace(/ - Topic$/i, '')
      .replace(/VEVO$/i, '')
      .replace(/Official$/i, '')
      .trim();

    if (cleanArtist === 'YouTube' || !cleanArtist) {
      cleanArtist = '';
    }

    return { cleanTitle, cleanArtist };
  }

  /**
   * Step 2: Attempt Saavn Catalog Match
   */
  public async matchSaavn(track: PrototypeTrack): Promise<{ matched: boolean; streamUrl?: string; confidence?: number }> {
    const { cleanTitle, cleanArtist } = this.identifyTrack(track);
    const query = cleanArtist ? `${cleanTitle} ${cleanArtist}` : cleanTitle;

    this.log(`[Saavn Match] Searching Saavn catalog for: "${query}"...`);

    try {
      const results = await searchJioSaavn(query, 1, 3);
      if (!results || results.length === 0) {
        return { matched: false };
      }

      const best = results[0];
      if (!best.filePath || best.isPreview || best.id.startsWith('itunes_')) {
        return { matched: false };
      }

      // Title similarity check
      const tA = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      const tB = best.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const hasTitleOverlap = tA.includes(tB) || tB.includes(tA) || tA.slice(0, 5) === tB.slice(0, 5);

      if (!hasTitleOverlap) {
        this.log(`[Saavn Match] Candidate "${best.title}" did not match title "${cleanTitle}". Rejecting.`);
        return { matched: false };
      }

      const streamUrl = best.filePath;
      this.log(`[Saavn Match] MATCH FOUND: "${best.title}" by "${best.artist}" (Stream: ${streamUrl.substring(0, 45)}...)`);
      return { matched: true, streamUrl, confidence: 95 };
    } catch (err: any) {
      this.log(`[Saavn Match] Search error: ${err?.message || err}`);
      return { matched: false };
    }
  }

  /**
   * Step 3: Unmatched -> Server-side yt-dlp resolver
   */
  public async resolveYtDlp(videoId: string): Promise<{ resolved: boolean; streamUrl?: string; error?: string }> {
    if (!videoId) return { resolved: false, error: 'Missing video ID' };

    this.log(`[yt-dlp Resolver] Requesting direct stream from backend for video "${videoId}"...`);

    // First try requesting JSON with direct CDN URL
    try {
      const jsonEndpoint = this.getStreamApiUrl(videoId, true);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(jsonEndpoint, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data && data.streamUrl) {
          this.log(`[yt-dlp Resolver] DIRECT STREAM EXTRACTED: ${data.streamUrl.substring(0, 50)}...`);
          return { resolved: true, streamUrl: data.streamUrl };
        }
      }
    } catch (err: any) {
      this.log(`[yt-dlp Resolver] Direct JSON fetch notice: ${err?.message || err}. Trying proxied stream...`);
    }

    // Second: Use proxied endpoint which handles redirects and byte-ranges natively
    try {
      const proxyEndpoint = this.getStreamApiUrl(videoId, false);
      const headController = new AbortController();
      const headTimer = setTimeout(() => headController.abort(), 6000);

      const testRes = await fetch(proxyEndpoint, {
        method: 'HEAD',
        headers: { Range: 'bytes=0-1024' },
        signal: headController.signal
      });
      clearTimeout(headTimer);

      if (testRes.ok || testRes.status === 206 || testRes.status === 200) {
        this.log(`[yt-dlp Resolver] PROXY STREAM ACTIVE: ${proxyEndpoint}`);
        return { resolved: true, streamUrl: proxyEndpoint };
      }
    } catch (headErr: any) {
      this.log(`[yt-dlp Resolver] Proxy stream verification notice: ${headErr?.message || headErr}`);
    }

    return { resolved: false, error: 'All yt-dlp backend extraction tiers failed' };
  }

  /**
   * Resolve a track through the 3-Tier Architecture:
   * 1. Saavn Match
   * 2. yt-dlp Resolver
   * 3. IFrame Foreground Fallback
   */
  public async resolveTrack(track: PrototypeTrack): Promise<PrototypeTrack> {
    track.status = 'RESOLVING';
    this.notify();

    // TIER 1: Saavn Match
    const saavnRes = await this.matchSaavn(track);
    if (saavnRes.matched && saavnRes.streamUrl) {
      track.resolutionTier = 'SAAVN_NATIVE';
      track.streamUrl = saavnRes.streamUrl;
      track.confidence = saavnRes.confidence;
      this.metrics.saavnMatchedCount++;
      this.updateSuccessRate();
      return track;
    }

    // TIER 2: Unmatched -> server-side yt-dlp resolver
    if (track.videoId) {
      const ytdlpRes = await this.resolveYtDlp(track.videoId);
      if (ytdlpRes.resolved && ytdlpRes.streamUrl) {
        track.resolutionTier = 'YTDLP_NATIVE';
        track.streamUrl = ytdlpRes.streamUrl;
        track.confidence = 90;
        this.metrics.ytdlpResolvedCount++;
        this.updateSuccessRate();
        return track;
      }
      track.errorReason = ytdlpRes.error;
    }

    // TIER 3: Failure fallback -> YouTube IFrame Foreground
    track.resolutionTier = 'IFRAME_FALLBACK';
    track.streamUrl = undefined;
    this.metrics.iframeFallbackCount++;
    this.updateSuccessRate();
    this.log(`[Fallback] Routing track "${track.title}" to clean YouTube IFrame foreground fallback.`);
    return track;
  }

  private updateSuccessRate() {
    const total = this.metrics.saavnMatchedCount + this.metrics.ytdlpResolvedCount + this.metrics.iframeFallbackCount;
    if (total > 0) {
      const exoPlayerTotal = this.metrics.saavnMatchedCount + this.metrics.ytdlpResolvedCount;
      this.metrics.resolverSuccessRate = Math.round((exoPlayerTotal / total) * 100);
    }
  }

  /**
   * Execute Playback for current track
   */
  public async playTrackAtIndex(index: number) {
    if (index < 0 || index >= this.tracks.length) {
      this.log(`Invalid track index: ${index}`);
      return;
    }

    this.currentIndex = index;
    const track = this.tracks[index];
    this.log(`>>> Starting playback pipeline for [Track ${index + 1}/${this.tracks.length}]: "${track.title}"`);

    // 1. Resolve through the 3-Tier Architecture
    const resolved = await this.resolveTrack(track);

    // 2. Play based on resolution tier
    if (resolved.resolutionTier === 'SAAVN_NATIVE' || resolved.resolutionTier === 'YTDLP_NATIVE') {
      await this.playViaNativeExoPlayer(resolved);
    } else {
      await this.playViaIFrameFallback(resolved);
    }

    this.notify();
  }

  /**
   * Route stream to Native ExoPlayer
   */
  private async playViaNativeExoPlayer(track: PrototypeTrack) {
    if (!track.streamUrl) {
      track.status = 'FAILED';
      this.log(`[ExoPlayer Error] Missing stream URL for track "${track.title}"`);
      return;
    }

    this.metrics.activePlayer = 'EXOPLAYER_NATIVE';
    cloudPlayerService.pause();

    const mockSong: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || 'Prototype Collection',
      duration: track.duration,
      format: track.resolutionTier === 'SAAVN_NATIVE' ? '320k AAC' : 'M4A',
      bitrate: track.resolutionTier === 'SAAVN_NATIVE' ? 320 : 160,
      fileSize: 5000000,
      dateAdded: Date.now(),
      playCount: 0,
      isFavorite: false,
      artwork: track.coverArt || '',
      coverArt: track.coverArt || '',
      filePath: track.streamUrl,
      path: track.streamUrl,
      fileName: `${track.title}.m4a`,
      isOnline: true,
      isSaavn: track.resolutionTier === 'SAAVN_NATIVE',
      isForegroundOnly: false,
      playbackMode: 'direct-catalog'
    };

    if (Capacitor.isNativePlatform()) {
      this.log(`[ExoPlayer] Invoking Native ExoPlayer for "${track.title}" via AuraMedia bridge...`);
      try {
        await androidMediaBridge.playNativeTrack(mockSong, track.streamUrl, 0);
        track.status = 'PLAYING';
        this.metrics.isPlaying = true;
        this.log(`[ExoPlayer] Native ExoPlayer started successfully! WakeLock + Foreground Service active.`);
      } catch (err: any) {
        track.status = 'FAILED';
        track.errorReason = err?.message || 'Native ExoPlayer invocation failed';
        this.log(`[ExoPlayer Error] ${track.errorReason}`);
      }
    } else if (typeof Audio !== 'undefined') {
      // Web fallback for desktop browser dev testing
      this.log(`[Web Simulation] Playing stream in browser HTML5 audio: ${track.streamUrl.substring(0, 50)}...`);
      const audio = new Audio(track.streamUrl);
      audio.play().then(() => {
        track.status = 'PLAYING';
        this.metrics.isPlaying = true;
        this.notify();
      }).catch((e) => {
        track.status = 'FAILED';
        track.errorReason = e.message;
        this.notify();
      });
    } else {
      track.status = 'PLAYING';
      this.metrics.isPlaying = true;
      this.notify();
    }
  }

  /**
   * Route track to YouTube IFrame Foreground Fallback
   */
  private async playViaIFrameFallback(track: PrototypeTrack) {
    this.metrics.activePlayer = 'YOUTUBE_IFRAME';
    this.log(`[IFrame Fallback] Activating YouTube IFrame for video "${track.videoId}".`);

    if (track.videoId) {
      cloudPlayerService.loadVideo(track.videoId, 0);
      track.status = 'FALLBACK';
      this.metrics.isPlaying = true;
      this.log(`[IFrame Fallback] Video loaded in IFrame. Note: Playback is foreground-only.`);
    } else {
      track.status = 'FAILED';
      track.errorReason = 'No YouTube video ID available for fallback';
      this.log(`[IFrame Fallback Error] No videoId available.`);
    }
  }

  /**
   * Handle Lock-Screen & Bluetooth Media Actions
   */
  public handleMediaAction(action: string, position?: number) {
    if (this.metrics.activePlayer === 'NONE' || this.tracks.length === 0) {
      return;
    }
    this.metrics.lastMediaAction = action;
    this.metrics.mediaActionCount++;
    this.log(`[MediaAction] Received event from Bluetooth / Notification: "${action}" (pos: ${position ?? 'N/A'})`);

    switch (action) {
      case 'next':
        this.next();
        break;
      case 'previous':
      case 'prev':
        this.previous();
        break;
      case 'pause':
      case 'call_pause':
        this.pause();
        break;
      case 'play':
      case 'resume':
      case 'call_resume':
        this.resume();
        break;
      case 'seek':
        if (typeof position === 'number') {
          this.seek(position);
        }
        break;
    }
  }

  public next() {
    if (this.currentIndex + 1 < this.tracks.length) {
      this.playTrackAtIndex(this.currentIndex + 1);
    } else {
      this.log(`[Queue Ended] Reached end of prototype playlist.`);
      this.stop();
    }
  }

  public previous() {
    if (this.currentIndex > 0) {
      this.playTrackAtIndex(this.currentIndex - 1);
    }
  }

  public pause() {
    this.metrics.isPlaying = false;
    if (this.metrics.activePlayer === 'EXOPLAYER_NATIVE') {
      androidMediaBridge.pauseNative();
    } else if (this.metrics.activePlayer === 'YOUTUBE_IFRAME') {
      cloudPlayerService.pause();
    }
    if (this.currentIndex >= 0 && this.tracks[this.currentIndex]) {
      this.tracks[this.currentIndex].status = 'PAUSED';
    }
    this.log(`[Playback] Paused.`);
    this.notify();
  }

  public resume() {
    this.metrics.isPlaying = true;
    if (this.metrics.activePlayer === 'EXOPLAYER_NATIVE') {
      androidMediaBridge.resumeNative();
    } else if (this.metrics.activePlayer === 'YOUTUBE_IFRAME') {
      cloudPlayerService.play();
    }
    if (this.currentIndex >= 0 && this.tracks[this.currentIndex]) {
      this.tracks[this.currentIndex].status = 'PLAYING';
    }
    this.log(`[Playback] Resumed.`);
    this.notify();
  }

  public seek(seconds: number) {
    this.log(`[Playback] Seeking to ${seconds}s`);
    if (this.metrics.activePlayer === 'EXOPLAYER_NATIVE') {
      androidMediaBridge.seekNative(seconds);
    } else if (this.metrics.activePlayer === 'YOUTUBE_IFRAME') {
      cloudPlayerService.seek(seconds);
    }
  }

  public stop() {
    this.metrics.isPlaying = false;
    this.metrics.activePlayer = 'NONE';
    androidMediaBridge.stopNative();
    cloudPlayerService.pause();
    this.stopScreenOffTicker();
    this.log(`[Playback] Stopped.`);
    this.notify();
  }

  /**
   * Reset prototype state
   */
  public reset() {
    this.stop();
    this.tracks = [];
    this.currentIndex = -1;
    this.logs = [];
    this.metrics = {
      totalProcessed: 0,
      saavnMatchedCount: 0,
      ytdlpResolvedCount: 0,
      iframeFallbackCount: 0,
      resolverSuccessRate: 0,
      activePlayer: 'NONE',
      isPlaying: false,
      screenOffDurationSec: 0,
      isScreenLocked: false,
      mediaActionCount: 0
    };
    this.notify();
  }
}

export const prototypePipeline = new PrototypePlaybackPipeline();

/**
 * Standard 4-Track Benchmark Matrix for Real Android Device Validation
 */
export const PROTOTYPE_BENCHMARK_TRACKS: PrototypeTrack[] = [
  {
    id: 'bench_1_saavn',
    title: 'Kesariya',
    artist: 'Arijit Singh',
    album: 'Brahmastra',
    duration: 268,
    coverArt: 'https://c.saavncdn.com/191/Kesariya-From-Brahmastra-Hindi-2022-20220717092820-500x500.jpg',
    videoId: 'BddP6PYo2gs',
    platform: 'spotify',
    status: 'PENDING'
  },
  {
    id: 'bench_2_unmatched_yt',
    title: 'Lofi Hip Hop Study Beats - 24/7 Chill',
    artist: 'Lofi Girl',
    album: 'YouTube Stream',
    duration: 180,
    coverArt: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    videoId: 'jfKfPfyJRdk',
    platform: 'youtube',
    status: 'PENDING'
  },
  {
    id: 'bench_3_yt_direct',
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    album: 'Whenever You Need Somebody',
    duration: 213,
    coverArt: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    videoId: 'dQw4w9WgXcQ',
    platform: 'youtube',
    status: 'PENDING'
  },
  {
    id: 'bench_4_invalid_fallback',
    title: 'Non-Existent Unresolvable Track (Fallback Test)',
    artist: 'Unknown Artist',
    album: 'Test Album',
    duration: 120,
    videoId: 'INVALID_VIDEO_ID_99999',
    platform: 'custom',
    status: 'PENDING'
  }
];
