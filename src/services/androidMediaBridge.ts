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

  stopService(): Promise<void>;
  minimizeApp(): Promise<void>;
  scanDeviceAudio(): Promise<{ total: number; tracks: any[] }>;
}

export type MediaActionCallback = (action: string, position?: number) => void;
export type BackButtonCallback = () => boolean; // return true if handled by UI

let mediaActionHandler: MediaActionCallback | null = null;
let backButtonHandler: BackButtonCallback | null = null;
const backButtonStack: BackButtonCallback[] = [];

export function registerMediaActionHandler(cb: MediaActionCallback) {
  mediaActionHandler = cb;
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

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;
    this.isNative = Capacitor.isNativePlatform();

    if (this.isNative) {
      this.setupNativeStatusBar();
      this.setupNativeMediaListener();
      this.setupNativeBackButton();
    } else {
      this.setupWebMediaSessionHandlers();
    }
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
        if (mediaActionHandler) {
          mediaActionHandler(data.action, data.position);
        }
      });
    } catch (err) {
      console.warn('Native mediaAction listener notice:', err);
    }
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

  private setupWebMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (mediaActionHandler) mediaActionHandler('play');
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (mediaActionHandler) mediaActionHandler('pause');
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (mediaActionHandler) mediaActionHandler('next');
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (mediaActionHandler) mediaActionHandler('previous');
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (mediaActionHandler && typeof details.seekTime === 'number') {
          mediaActionHandler('seek', details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        if (mediaActionHandler) {
          mediaActionHandler('seekbackward', details.seekOffset || 10);
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (mediaActionHandler) {
          mediaActionHandler('seekforward', details.seekOffset || 10);
        }
      });
    } catch {
      // Some browsers throw on certain action handlers
    }
  }

  public syncTrackMetadata(song: Song | null, isPlaying: boolean, position: number, duration: number) {
    if (!song) {
      if (this.isNative) {
        AuraMedia.stopService().catch(() => {});
      }
      this.lastSongKey = null;
      return;
    }

    const songKey = `${song.id}_${song.title}_${song.artist}_${isPlaying}_${Math.floor(position)}`;
    if (songKey === this.lastSongKey) return;
    this.lastSongKey = songKey;

    if (this.isNative) {
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
    if (this.isNative) {
      AuraMedia.updatePlaybackState({
        isPlaying,
        position,
        duration
      }).catch(() => {});
    }
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
