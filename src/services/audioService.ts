import { Song } from '../types/music';
import { getRegisteredFile } from './scannerService';
import { audioEffectsService } from './audioEffectsService';
import { cloudPlayerService } from './cloudPlayerService';

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

  // Track active engine: HTML5 Audio (local) vs Cloud Headless Player (Vercel online)
  private isUsingCloudPlayer: boolean = false;
  private isCloudPlaying: boolean = false;

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
    this.setupCloudListeners();
  }

  private setupListeners() {
    this.audio.addEventListener('play', () => {
      if (!this.isUsingCloudPlayer) this.notify();
    });

    this.audio.addEventListener('playing', () => {
      if (!this.isUsingCloudPlayer) this.notify();
    });

    this.audio.addEventListener('pause', () => {
      if (!this.isUsingCloudPlayer) this.notify();
    });

    this.audio.addEventListener('timeupdate', () => {
      if (this.isUsingCloudPlayer) return;

      const current = this.audio.currentTime || 0;
      const duration = this.audio.duration || (this.currentSong ? this.currentSong.duration : 0);

      // Track meaningful listen seconds
      if (!this.audio.paused && this.currentSong && !this.hasCountedMeaningfulPlay) {
        const delta = current - this.lastTimeUpdateSecond;
        if (delta > 0 && delta < 2) {
          this.accumulatedListenSeconds += delta;
        }
        this.lastTimeUpdateSecond = current;

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

    this.audio.addEventListener('durationchange', () => {
      if (!this.isUsingCloudPlayer) this.notify();
    });
    this.audio.addEventListener('volumechange', () => this.notify());

    this.audio.addEventListener('ended', () => {
      if (this.isUsingCloudPlayer) return;
      this.isFadingOut = false;
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
      if (this.isUsingCloudPlayer) return;
      if (this.audio.error && this.audio.error.code === MediaError.MEDIA_ERR_ABORTED) {
        return;
      }
      console.warn('Audio playback notice:', e);
    });
  }

  private setupCloudListeners() {
    cloudPlayerService.onPlay(() => {
      if (this.isUsingCloudPlayer) {
        this.isCloudPlaying = true;
        this.notify();
      }
    });

    cloudPlayerService.onPause(() => {
      if (this.isUsingCloudPlayer) {
        this.isCloudPlaying = false;
        this.notify();
      }
    });

    cloudPlayerService.onEnded(() => {
      if (this.isUsingCloudPlayer) {
        this.isCloudPlaying = false;
        this.notify();
        if (this.onSongEndCallback) {
          this.onSongEndCallback();
        }
      }
    });

    cloudPlayerService.onTimeUpdate((current, duration) => {
      if (this.isUsingCloudPlayer) {
        this.notify();
      }
    });

    cloudPlayerService.onError((err) => {
      if (this.isUsingCloudPlayer) {
        console.warn('Cloud player error:', err);
        this.notify(err);
      }
    });
  }

  private notify(errorMessage: string | null = null) {
    let isActuallyPlaying = false;
    let currentTime = 0;
    let duration = (this.currentSong ? this.currentSong.duration : 0) || 0;

    if (this.isUsingCloudPlayer) {
      currentTime = cloudPlayerService.getCurrentTime();
      const cloudDur = cloudPlayerService.getDuration();
      if (cloudDur > 0) duration = cloudDur;
      isActuallyPlaying = this.isCloudPlaying;
    } else {
      isActuallyPlaying =
        !this.audio.paused && !this.audio.ended && this.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      currentTime = this.audio.currentTime || 0;
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        duration = this.audio.duration;
      }
    }

    const state: AudioServiceState = {
      currentSong: this.currentSong,
      isPlaying: isActuallyPlaying,
      currentTime,
      duration,
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
        artist: this.currentSong.artist !== 'Not set' ? this.currentSong.artist : 'Aura Music',
        album: this.currentSong.album !== 'Not set' ? this.currentSong.album : 'Aura Collection',
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

  private extractYouTubeVideoId(song: Song): string | null {
    if (song.sourceId && song.sourceId.length >= 8) {
      return song.sourceId;
    }
    if (song.id && song.id.startsWith('online_')) {
      return song.id.replace('online_', '');
    }
    if (song.id && song.id.startsWith('cloud_')) {
      return song.id.replace('cloud_', '');
    }
    const pathStr = song.filePath || song.path || '';
    const match = pathStr.match(/[?&]id=([^&]+)/) || pathStr.match(/v=([^&]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  }

  public async playSong(song: Song, audioSourceUrl?: string): Promise<void> {
    const thisRequestId = ++this.playRequestId;

    this.accumulatedListenSeconds = 0;
    this.hasCountedMeaningfulPlay = false;
    this.lastTimeUpdateSecond = 0;
    this.currentSong = song;

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    // Check if track is a direct audio stream (JioSaavn 320k master or Live FM Radio)
    const isDirectAudioStream = Boolean(
      song.isSaavn ||
      song.isLiveRadio ||
      (song.filePath && (
        song.filePath.includes('saavncdn.com') ||
        song.filePath.includes('listenon.in') ||
        song.filePath.includes('stream.zeno.fm') ||
        song.filePath.includes('ilovemusic.de') ||
        song.filePath.includes('dancewave.online') ||
        song.filePath.includes('bbcmedia.co.uk') ||
        song.filePath.includes('torontocast.com')
      ))
    );

    // YouTube track check
    const ytVideoId = !isDirectAudioStream ? this.extractYouTubeVideoId(song) : null;

    if (ytVideoId) {
      this.isUsingCloudPlayer = true;
      this.audio.pause();
      cloudPlayerService.loadVideo(ytVideoId, 0);
      this.isCloudPlaying = true;
      this.notify();
      return;
    }

    // Local track OR Direct Audio Stream (JioSaavn 320k / Live Radio):
    // Runs through HTML5 Audio Element & Full Web Audio DSP chain (10-Band EQ, 3D Reverb, Visualizer)
    this.isUsingCloudPlayer = false;
    cloudPlayerService.pause();

    try {
      let source = audioSourceUrl;
      if (!source) {
        if (isDirectAudioStream) {
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

      if (this.playRequestId !== thisRequestId) {
        return;
      }

      this.isFadingOut = false;

      try {
        audioEffectsService.init(this.audio);
        await audioEffectsService.resumeContext();
      } catch (effectErr) {
        console.warn('Audio effects notice:', effectErr);
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
      if (err.name === 'AbortError') return;
      console.warn('Audio playback note:', err);
      this.notify('Cannot play audio file. Please re-select the folder.');
    }
  }

  public pause(): void {
    if (this.isUsingCloudPlayer) {
      cloudPlayerService.pause();
      this.isCloudPlaying = false;
    } else {
      this.audio.pause();
    }
    this.notify();
  }

  public async resume(): Promise<void> {
    if (this.isUsingCloudPlayer) {
      cloudPlayerService.play();
      this.isCloudPlaying = true;
      this.notify();
      return;
    }

    if (this.currentSong) {
      if (!this.audio.src || this.audio.src === window.location.href || this.audio.readyState === 0) {
        await this.playSong(this.currentSong);
        return;
      }

      try {
        try {
          audioEffectsService.init(this.audio);
          await audioEffectsService.resumeContext();
        } catch (effectsErr) {
          console.warn('Effects resume notice:', effectsErr);
        }
        await this.audio.play();
        this.notify();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          await this.playSong(this.currentSong);
        }
      }
    }
  }

  public async play(): Promise<void> {
    return this.resume();
  }

  public async togglePlay(fallbackSong?: Song | null): Promise<void> {
    if (this.isUsingCloudPlayer) {
      if (this.isCloudPlaying) {
        this.pause();
      } else {
        await this.resume();
      }
      return;
    }

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
      if (this.isUsingCloudPlayer) {
        cloudPlayerService.seek(seconds);
      } else {
        this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || seconds));
        this.lastTimeUpdateSecond = this.audio.currentTime;
        if (this.isFadingOut) {
          this.isFadingOut = false;
          audioEffectsService.fadeCross(1, 0.2);
        }
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
    cloudPlayerService.setVolume(clamped);
    if (clamped > 0 && this.isMuted) {
      this.isMuted = false;
    }
    this.notify();
  }

  public toggleMute(): void {
    if (this.isMuted) {
      this.audio.volume = this.previousVolume || 0.8;
      this.isMuted = false;
      cloudPlayerService.setMuted(false);
    } else {
      this.previousVolume = this.audio.volume;
      this.audio.volume = 0;
      this.isMuted = true;
      cloudPlayerService.setMuted(true);
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

  public isUsingCloud(): boolean {
    return this.isUsingCloudPlayer;
  }
}

export const audioService = new AudioService();
