import { registerPlugin, Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Song } from '../types/music';

export interface AuraMediaPluginInterface {
  updateTrack(options: {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    artwork: string;
    isPlaying: boolean;
    position: number;
  }): Promise<void>;

  updatePlaybackState(options: {
    isPlaying: boolean;
    position: number;
    duration: number;
  }): Promise<void>;

  playNativeTrack(options: {
    id: string;
    title: string;
    artist: string;
    album: string;
    artwork: string;
    uri: string;
    duration: number;
    position?: number;
  }): Promise<void>;

  pauseNative(): Promise<void>;
  resumeNative(): Promise<void>;
  seekNative(options: { position: number }): Promise<void>;
  stopNative(): Promise<void>;

  isOfflineTrackSaved(options: { id: string }): Promise<{ saved: boolean; filePath: string; uri: string }>;
  getOfflineServerPort(): Promise<{ port: number }>;

  stopService(): Promise<void>;
  minimizeApp(): Promise<void>;
  scanDeviceAudio(): Promise<{ total: number; tracks: any[] }>;
}

export type MediaActionCallback = (action: string, position?: number) => void;
export type NativeProgressCallback = (data: { position: number; duration: number; isPlaying: boolean }) => void;
export type BackButtonCallback = () => boolean; // return true if handled by UI

const mediaActionListeners: Set<MediaActionCallback> = new Set();
let backButtonHandler: BackButtonCallback | null = null;
const backButtonStack: BackButtonCallback[] = [];

export function registerMediaActionHandler(cb: MediaActionCallback): () => void {
  mediaActionListeners.add(cb);
  return () => {
    mediaActionListeners.delete(cb);
  };
}

export function dispatchMediaAction(action: string, position?: number) {
  mediaActionListeners.forEach((listener) => {
    try {
      listener(action, position);
    } catch (e) {
      console.warn('Error in mediaAction listener:', e);
    }
  });
}

export function registerBackButtonHandler(cb: BackButtonCallback) {
  backButtonHandler = cb;
}

export function pushBackButtonHandler(cb: BackButtonCallback): () => void {
  backButtonStack.push(cb);
  return () => {
    const idx = backButtonStack.lastIndexOf(cb);
    if (idx !== -1) {
      backButtonStack.splice(idx, 1);
    }
  };
}

const AuraMedia = registerPlugin<AuraMediaPluginInterface>('AuraMedia');

class AndroidMediaBridge {
  private isInitialized = false;
  private isNative = false;
  private lastSongKey: string | null = null;
  private progressListeners: Set<NativeProgressCallback> = new Set();

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;
    this.isNative = Capacitor.isNativePlatform();

    if (this.isNative) {
      this.setupNativeStatusBar();
      this.setupNativeMediaListener();
      this.setupNativeProgressListener();
      this.setupNativeBackButton();
      this.setupNativeLifecycleListeners();
    } else {
      this.setupWebMediaSessionHandlers();
    }
  }

  public isNativePlatform(): boolean {
    return this.isNative || Capacitor.isNativePlatform();
  }

  private async setupNativeStatusBar() {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0b0d13' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch {
      // Ignore if status bar plugin is unsupported
    }
  }

  private setupNativeMediaListener() {
    try {
      (AuraMedia as any).addListener?.('mediaAction', (data: { action: string; position?: number }) => {
        dispatchMediaAction(data.action, data.position);
      });
    } catch (err) {
      console.warn('Native mediaAction listener notice:', err);
    }
  }

  private setupNativeProgressListener() {
    try {
      (AuraMedia as any).addListener?.('nativePlaybackProgress', (data: { position: number; duration: number; isPlaying: boolean }) => {
        this.progressListeners.forEach((listener) => {
          try {
            listener(data);
          } catch (e) {
            console.warn('Error in nativePlaybackProgress listener:', e);
          }
        });
      });
    } catch (err) {
      console.warn('Native progress listener notice:', err);
    }
  }

  public onPlaybackProgress(cb: NativeProgressCallback): () => void {
    this.progressListeners.add(cb);
    return () => {
      this.progressListeners.delete(cb);
    };
  }

  private setupNativeBackButton() {
    try {
      App.addListener('backButton', () => {
        // 1. Process custom top-most modal/dialog callbacks in LIFO order
        for (let i = backButtonStack.length - 1; i >= 0; i--) {
          try {
            const handled = backButtonStack[i]();
            if (handled) return;
          } catch (e) {
            console.warn('Error in backButtonStack handler:', e);
          }
        }

        // 2. Check registered central hierarchy backButtonHandler
        if (backButtonHandler) {
          try {
            const handled = backButtonHandler();
            if (handled) return;
          } catch (e) {
            console.warn('Error in backButtonHandler:', e);
          }
        }

        // 3. On home screen with no modal open: minimize to background so playback continues!
        AuraMedia.minimizeApp().catch(() => {
          App.minimizeApp();
        });
      });
    } catch (err) {
      console.warn('Native backButton listener notice:', err);
    }
  }

  private setupNativeLifecycleListeners() {
    try {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          dispatchMediaAction('save_session');
        }
      });
      App.addListener('pause', () => {
        dispatchMediaAction('save_session');
      });
    } catch (err) {
      console.warn('Native lifecycle listener notice:', err);
    }
  }

  private setupWebMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        dispatchMediaAction('play');
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        dispatchMediaAction('pause');
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        dispatchMediaAction('next');
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        dispatchMediaAction('previous');
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          dispatchMediaAction('seek', details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        dispatchMediaAction('seekbackward', details.seekOffset || 10);
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        dispatchMediaAction('seekforward', details.seekOffset || 10);
      });
    } catch {
      // Some browsers throw on certain action handlers
    }
  }

  public syncTrackMetadata(song: Song | null, isPlaying: boolean, position: number, duration: number) {
    if (!song) {
      if (this.isNativePlatform()) {
        AuraMedia.stopService().catch(() => {});
      }
      this.lastSongKey = null;
      return;
    }

    const songKey = `${song.id}_${song.title}_${song.artist}_${isPlaying}_${Math.floor(position)}`;
    if (songKey === this.lastSongKey) return;
    this.lastSongKey = songKey;

    if (this.isNativePlatform()) {
      AuraMedia.updateTrack({
        id: song.id,
        title: song.title || 'Unknown Title',
        artist: song.artist && song.artist !== 'Not set' ? song.artist : 'Aura Music',
        album: song.album && song.album !== 'Not set' ? song.album : 'Aura Collection',
        duration: duration || song.duration || 0,
        artwork: song.coverArt || song.artwork || '',
        isPlaying,
        position
      }).catch((err) => {
        console.warn('Native updateTrack notice:', err);
      });
    }
  }

  public syncPlaybackState(isPlaying: boolean, position: number, duration: number) {
    if (this.isNativePlatform()) {
      AuraMedia.updatePlaybackState({
        isPlaying,
        position,
        duration
      }).catch(() => {});
    }
  }

  /**
   * Native ExoPlayer Playback Controller
   */
  public async playNativeTrack(song: Song, uri: string, positionSec = 0): Promise<void> {
    if (!this.isNativePlatform()) return;

    await AuraMedia.playNativeTrack({
      id: song.id,
      title: song.title || 'Unknown Title',
      artist: song.artist && song.artist !== 'Not set' ? song.artist : 'Aura Music',
      album: song.album && song.album !== 'Not set' ? song.album : 'Aura Collection',
      artwork: song.coverArt || song.artwork || '',
      uri,
      duration: song.duration || 0,
      position: positionSec
    });
  }

  public async pauseNative(): Promise<void> {
    if (this.isNativePlatform()) {
      await AuraMedia.pauseNative().catch(() => {});
    }
  }

  public async resumeNative(): Promise<void> {
    if (this.isNativePlatform()) {
      await AuraMedia.resumeNative().catch(() => {});
    }
  }

  public async seekNative(positionSec: number): Promise<void> {
    if (this.isNativePlatform()) {
      await AuraMedia.seekNative({ position: positionSec }).catch(() => {});
    }
  }

  public async stopNative(): Promise<void> {
    if (this.isNativePlatform()) {
      await AuraMedia.stopNative().catch(() => {});
    }
  }

  /**
   * Checks if an offline track is already written to native flash storage
   */
  public async isOfflineTrackSaved(songId: string): Promise<{ saved: boolean; uri: string }> {
    if (!this.isNativePlatform()) return { saved: false, uri: '' };
    try {
      const res = await AuraMedia.isOfflineTrackSaved({ id: songId });
      return { saved: Boolean(res.saved), uri: res.uri || '' };
    } catch {
      return { saved: false, uri: '' };
    }
  }

  /**
   * Streams a cached offline audio track from Cache Storage into native device flash storage.
   * Enables 100% reliable background and screen-off ExoPlayer playback on Android.
   */
  public async ensureNativeOfflineAudio(song: Song): Promise<string | null> {
    if (!this.isNativePlatform()) return null;

    try {
      // 1. Check if already cached on disk
      const existing = await this.isOfflineTrackSaved(song.id);
      if (existing.saved && existing.uri) {
        return existing.uri;
      }

      // 2. Fetch blob from browser Cache Storage
      if (typeof caches === 'undefined') return null;
      const cache = await caches.open('aura-offline-audio-v1');
      const cacheKey = `https://aura.local/offline-audio/${encodeURIComponent(song.id)}`;
      const match = await cache.match(cacheKey);
      if (!match) return null;

      const blob = await match.blob();
      if (!blob || blob.size === 0) return null;

      // 3. Obtain local server port
      const { port } = await AuraMedia.getOfflineServerPort();
      if (!port || port <= 0) return null;

      // 4. Stream blob to local loopback server
      const response = await fetch(`http://127.0.0.1:${port}/save-offline?id=${encodeURIComponent(song.id)}`, {
        method: 'POST',
        body: blob
      });

      if (response.ok) {
        const verify = await this.isOfflineTrackSaved(song.id);
        if (verify.saved && verify.uri) {
          return verify.uri;
        }
      }
    } catch (err) {
      console.warn('Failed to ensure native offline audio:', err);
    }
    return null;
  }

  public minimize() {
    if (this.isNative) {
      AuraMedia.minimizeApp().catch(() => {
        App.minimizeApp();
      });
    }
  }

  public async scanDeviceAudio(): Promise<{ total: number; tracks: any[] }> {
    if (this.isNative) {
      try {
        return await AuraMedia.scanDeviceAudio();
      } catch (err) {
        console.error('Failed to scan device audio via AuraMedia:', err);
        throw err;
      }
    }
    return { total: 0, tracks: [] };
  }
}

export const androidMediaBridge = new AndroidMediaBridge();
