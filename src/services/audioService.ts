import { Song } from '../types/music';
import { getRegisteredFile } from './scannerService';
import { audioEffectsService } from './audioEffectsService';

type AudioEventListener = (state: AudioServiceState) => void;

export interface AudioServiceState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  error: string | null;
}

class AudioService {
  private audio: HTMLAudioElement;
  private listeners: Set<AudioEventListener> = new Set();
  private currentSong: Song | null = null;
  private currentObjectUrl: string | null = null;
  private isMuted: boolean = false;
  private previousVolume: number = 0.8;
  private onSongEndCallback: (() => void) | null = null;
  private onMeaningfulListenCallback: ((song: Song) => void) | null = null;

  // Meaningful listen tracking
  private accumulatedListenSeconds: number = 0;
  private hasCountedMeaningfulPlay: boolean = false;
  private lastTimeUpdateSecond: number = 0;

  // Race condition guard
  private playRequestId: number = 0;

  // Smart Crossfade Engine
  private crossfadeSeconds: number = 3;
  private isFadingOut: boolean = false;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.audio.volume = 0.8;
    this.setupListeners();
  }

  private setupListeners() {
    this.audio.addEventListener('play', () => {
      this.notify();
    });

    this.audio.addEventListener('playing', () => {
      this.notify();
    });

    this.audio.addEventListener('pause', () => {
      this.notify();
    });

    this.audio.addEventListener('timeupdate', () => {
      const current = this.audio.currentTime || 0;
      const duration = this.audio.duration || (this.currentSong ? this.currentSong.duration : 0);

      // Track meaningful listen seconds (only while actively playing)
      if (!this.audio.paused && this.currentSong && !this.hasCountedMeaningfulPlay) {
        const delta = current - this.lastTimeUpdateSecond;
        if (delta > 0 && delta < 2) {
          this.accumulatedListenSeconds += delta;
        }
        this.lastTimeUpdateSecond = current;

        // Meaningful listen rule: >= 30 seconds OR >= 50% of track
        const threshold = Math.min(30, duration > 0 ? duration * 0.5 : 30);
        if (this.accumulatedListenSeconds >= threshold) {
          this.hasCountedMeaningfulPlay = true;
          if (this.onMeaningfulListenCallback) {
            this.onMeaningfulListenCallback(this.currentSong);
          }
        }
      } else {
        this.lastTimeUpdateSecond = current;
      }

      // Smart Crossfade Detection near end of song
      if (
        this.crossfadeSeconds > 0 &&
        duration > this.crossfadeSeconds * 2 &&
        !this.audio.paused &&
        !this.isFadingOut
      ) {
        const timeLeft = duration - current;
        if (timeLeft <= this.crossfadeSeconds && timeLeft > 0.4) {
          this.isFadingOut = true;
          audioEffectsService.fadeCross(0, this.crossfadeSeconds);
        }
      }

      this.notify();
    });

    this.audio.addEventListener('durationchange', () => this.notify());
    this.audio.addEventListener('volumechange', () => this.notify());

    this.audio.addEventListener('ended', () => {
      this.isFadingOut = false;
      // If song ended naturally, ensure meaningful play is recorded if not already
      if (this.currentSong && !this.hasCountedMeaningfulPlay && this.onMeaningfulListenCallback) {
        this.hasCountedMeaningfulPlay = true;
        this.onMeaningfulListenCallback(this.currentSong);
      }
      this.notify();
      if (this.onSongEndCallback) {
        this.onSongEndCallback();
      }
    });

    this.audio.addEventListener('error', (e) => {
      // Don't flag aborted loads caused by rapid song switches
      if (this.audio.error && this.audio.error.code === MediaError.MEDIA_ERR_ABORTED) {
        return;
      }
      console.warn('Audio playback error:', e);
      this.notify('Playback error encountered. File may be unavailable or unsupported.');
    });
  }

  private notify(errorMessage: string | null = null) {
    const isActuallyPlaying =
      !this.audio.paused && !this.audio.ended && this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    const state: AudioServiceState = {
      currentSong: this.currentSong,
      isPlaying: isActuallyPlaying,
      currentTime: this.audio.currentTime || 0,
      duration: this.audio.duration || (this.currentSong ? this.currentSong.duration : 0) || 0,
      volume: this.audio.volume,
      isMuted: this.isMuted,
      playbackRate: this.audio.playbackRate,
      error: errorMessage
    };

    this.listeners.forEach((listener) => listener(state));
    this.updateMediaSession();
  }

  private updateMediaSession() {
    if ('mediaSession' in navigator && this.currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentSong.title,
        artist: this.currentSong.artist !== 'Not set' ? this.currentSong.artist : 'Local Artist',
        album: this.currentSong.album !== 'Not set' ? this.currentSong.album : 'Local Collection',
        artwork: (this.currentSong.artwork || this.currentSong.coverArt)
          ? [{ src: (this.currentSong.artwork || this.currentSong.coverArt)!, sizes: '512x512', type: 'image/png' }]
          : []
      });
    }
  }

  public setOnSongEnd(callback: () => void) {
    this.onSongEndCallback = callback;
  }

  public setOnMeaningfulListen(callback: (song: Song) => void) {
    this.onMeaningfulListenCallback = callback;
  }

  public subscribe(listener: AudioEventListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  public async playSong(song: Song, audioSourceUrl?: string): Promise<void> {
    const thisRequestId = ++this.playRequestId;

    // Reset meaningful play tracking for the new song
    this.accumulatedListenSeconds = 0;
    this.hasCountedMeaningfulPlay = false;
    this.lastTimeUpdateSecond = 0;
    this.currentSong = song;

    // Clean up previous dynamic object URL to prevent memory leaks
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    try {
      // Determine source:
      // Priority 1: Passed explicit URL
      // Priority 2: In-memory active file registry
      // Priority 3: Local audio streaming API endpoint
      // Priority 4: Existing non-blob path
      let source = audioSourceUrl;
      if (!source) {
        if (song.isOnline || (song.filePath && song.filePath.startsWith('/api/online')) || (song.path && song.path.startsWith('/api/online'))) {
          source = song.filePath || song.path;
        } else {
          const registeredFile = getRegisteredFile(song.id);
          if (registeredFile) {
            source = URL.createObjectURL(registeredFile);
            this.currentObjectUrl = source;
          } else if (song.path) {
            source = `/api/audio?path=${encodeURIComponent(song.path)}`;
          } else if (song.filePath && !song.filePath.startsWith('blob:')) {
            source = song.filePath;
          } else if (song.fileName) {
            source = `/api/audio?path=${encodeURIComponent(song.fileName)}`;
          } else {
            source = song.filePath;
          }
        }
      }

      this.audio.pause();
      this.audio.src = source;
      this.audio.load();

      // Guard against race conditions if another song was requested while loading
      if (this.playRequestId !== thisRequestId) {
        return;
      }

      // Reset crossfade state
      this.isFadingOut = false;

      // Ensure audio effects (equalizer, spatial reverb & visualizer) are initialized and active
      try {
        audioEffectsService.init(this.audio);
        await audioEffectsService.resumeContext();
      } catch (effectErr) {
        console.warn('Audio effects initialization notice:', effectErr);
      }

      if (this.crossfadeSeconds > 0) {
        audioEffectsService.fadeCross(0, 0.01);
      }

      await this.audio.play();

      if (this.crossfadeSeconds > 0) {
        audioEffectsService.fadeCross(1, Math.min(1.5, this.crossfadeSeconds));
      } else {
        audioEffectsService.fadeCross(1, 0.05);
      }

      this.notify();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Ignored: User requested another track before play() finished loading
        return;
      }
      console.error('Failed to play audio:', err);
      this.notify('Cannot play this audio file. Please re-select the folder.');
    }
  }

  public pause(): void {
    this.audio.pause();
    this.notify();
  }

  public async resume(): Promise<void> {
    if (this.currentSong) {
      // If audio is not yet loaded or pointing to invalid source, re-run playSong
      if (!this.audio.src || this.audio.src === window.location.href || this.audio.readyState === 0) {
        await this.playSong(this.currentSong);
        return;
      }

      try {
        try {
          audioEffectsService.init(this.audio);
          await audioEffectsService.resumeContext();
        } catch (effectsErr) {
          console.warn('Audio effects resume notice:', effectsErr);
        }
        await this.audio.play();
        this.notify();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to resume playback, falling back to full reload:', err);
          await this.playSong(this.currentSong);
        }
      }
    }
  }

  public async togglePlay(fallbackSong?: Song | null): Promise<void> {
    if (this.audio.paused) {
      if (fallbackSong && !this.currentSong) {
        await this.playSong(fallbackSong);
        return;
      }
      await this.resume();
    } else {
      this.pause();
    }
  }

  public seek(seconds: number): void {
    if (isFinite(seconds)) {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || seconds));
      this.lastTimeUpdateSecond = this.audio.currentTime;
      if (this.isFadingOut) {
        this.isFadingOut = false;
        audioEffectsService.fadeCross(1, 0.2);
      }
      this.notify();
    }
  }

  public setCrossfadeSeconds(seconds: number): void {
    this.crossfadeSeconds = Math.max(0, Math.min(12, Math.round(seconds)));
  }

  public getCrossfadeSeconds(): number {
    return this.crossfadeSeconds;
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.audio.volume = clamped;
    if (clamped > 0 && this.isMuted) {
      this.isMuted = false;
    }
    this.notify();
  }

  public toggleMute(): void {
    if (this.isMuted) {
      this.audio.volume = this.previousVolume || 0.8;
      this.isMuted = false;
    } else {
      this.previousVolume = this.audio.volume;
      this.audio.volume = 0;
      this.isMuted = true;
    }
    this.notify();
  }

  public setPlaybackRate(rate: number): void {
    this.audio.playbackRate = rate;
    this.notify();
  }

  public setLoop(loop: boolean): void {
    this.audio.loop = loop;
  }

  public getCurrentSong(): Song | null {
    return this.currentSong;
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audio;
  }
}

export const audioService = new AudioService();
