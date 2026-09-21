import { Song } from '../types/music';
import { audioEffectsService } from './audioEffectsService';
import { cloudPlayerService } from './cloudPlayerService';
import { downloadService } from './downloadService';
import { searchJioSaavn } from './jiosaavnService';
import { buildApiUrl } from '../utils/apiConfig';
import { Capacitor } from '@capacitor/core';
import { audioMediaSession } from './audioMediaSession';
import { audioWatchdog } from './audioWatchdog';
import {
  extractYouTubeVideoId,
  isPreviewClip,
  isDirectAudioStream,
  isLocalTrack,
  resolveLocalAudioSource,
  tryResolveFastPathYoutubeStream,
  resolvePlaybackFailover
} from './audioStreamResolver';

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

export class AudioService {
  public audio: HTMLAudioElement;
  public radioAudio: HTMLAudioElement;
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
  private isUserPaused: boolean = false;
  private isFallingBack: boolean = false;

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
    if (typeof Audio !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.preservesPitch = true;
      (this.audio as any).mozPreservesPitch = true;
      (this.audio as any).webkitPreservesPitch = true;
      (this.audio as any).playsInline = true;
      (this.audio as any).webkitPlaysInline = true;
      if (!Capacitor.isNativePlatform()) {
        this.audio.crossOrigin = 'anonymous';
      }
      this.audio.volume = 0.8;

      this.radioAudio = new Audio();
      this.radioAudio.preload = 'auto';
      (this.radioAudio as any).playsInline = true;
      (this.radioAudio as any).webkitPlaysInline = true;
      this.radioAudio.volume = 0.8;

      if (typeof window !== 'undefined') {
        (window as any).__auraAudio = this.audio;
        (window as any).__auraRadioAudio = this.radioAudio;
      }
      this.setupListeners();
      this.setupRadioListeners();
      this.setupCloudListeners();
    } else {
      this.audio = {
        preload: 'auto',
        crossOrigin: 'anonymous',
        volume: 0.8,
        currentTime: 0,
        duration: 0,
        paused: true,
        src: '',
        addEventListener: () => {},
        removeEventListener: () => {},
        pause: () => {},
        play: () => Promise.resolve(),
        load: () => {}
      } as any;
      this.radioAudio = { ...this.audio } as any;
    }
  }

  private setupRadioListeners() {
    this.radioAudio.addEventListener('play', () => {
      if (this.currentSong?.isLiveRadio) this.notify();
    });

    this.radioAudio.addEventListener('playing', () => {
      if (this.currentSong?.isLiveRadio) this.notify();
    });

    this.radioAudio.addEventListener('pause', () => {
      if (this.currentSong?.isLiveRadio) this.notify();
    });

    this.radioAudio.addEventListener('waiting', () => {
      if (this.currentSong?.isLiveRadio) this.notify();
    });

    this.radioAudio.addEventListener('volumechange', () => {
      if (this.currentSong?.isLiveRadio) this.notify();
    });

    this.radioAudio.addEventListener('error', (e) => {
      if (!this.currentSong?.isLiveRadio) return;
      if (this.radioAudio.error && this.radioAudio.error.code === MediaError.MEDIA_ERR_ABORTED) {
        return;
      }
      const errorTimeSong = this.currentSong;
      const errorTimeRequestId = this.playRequestId;
      console.warn('Radio stream playback notice:', e);
      if (errorTimeSong && !this.isFallingBack && errorTimeRequestId === this.playRequestId) {
        this.handlePlaybackFailure(errorTimeSong);
      }
    });
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
        if (!Capacitor.isNativePlatform() && timeLeft <= this.crossfadeSeconds && timeLeft > 0.4) {
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
      const errorTimeSong = this.currentSong;
      const errorTimeRequestId = this.playRequestId;
      console.warn('Audio playback notice:', e);
      if (errorTimeSong && !this.isFallingBack && errorTimeRequestId === this.playRequestId) {
        this.handlePlaybackFailure(errorTimeSong);
      }
    });
  }

  private setupCloudListeners() {
    cloudPlayerService.onPlay(() => {
      if (this.isUsingCloudPlayer) {
        this.isCloudPlaying = true;
        audioWatchdog.clearCloudWatchdog();
        this.notify();
      }
    });

    cloudPlayerService.onPause(() => {
      if (this.isUsingCloudPlayer) {
        if (!this.isUserPaused && this.currentSong) {
          console.log('[AudioService] Background cloud pause intercepted. Restoring playback immediately...');
          cloudPlayerService.play();
          audioWatchdog.startSilentAudioAnchor(this.audio);
          return;
        }
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

    cloudPlayerService.onTimeUpdate(() => {
      if (this.isUsingCloudPlayer) {
        this.notify();
      }
    });

    cloudPlayerService.onError((err) => {
      if (this.isUsingCloudPlayer && this.currentSong) {
        console.warn('YouTube playback error, switching to Studio Master audio stream:', err);
        this.handlePlaybackFailure(this.currentSong);
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
    } else if (this.currentSong?.isLiveRadio) {
      isActuallyPlaying = !this.radioAudio.paused && !this.radioAudio.ended;
      currentTime = this.radioAudio.currentTime || 0;
      duration = 0;
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
    audioMediaSession.update(this.currentSong, isActuallyPlaying);
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

    this.isUserPaused = false;
    this.accumulatedListenSeconds = 0;
    this.hasCountedMeaningfulPlay = false;
    this.lastTimeUpdateSecond = 0;
    this.currentSong = song;

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    downloadService.revokeCachedAudioUrl();

    // 0. Live Radio Direct Playback Path
    if (song.isLiveRadio) {
      this.isUsingCloudPlayer = false;
      cloudPlayerService.pause();
      this.audio.pause();

      let targetUrl = audioSourceUrl || song.filePath || song.path || '';
      if (targetUrl.startsWith('http://') && typeof window !== 'undefined' && window.location.protocol === 'https:') {
        targetUrl = buildApiUrl(`/api/radio/stream?url=${encodeURIComponent(targetUrl)}`);
      }

      await this.playRadioStream(song, targetUrl, thisRequestId);
      return;
    }

    // Stop live radio when standard track is played
    if (this.radioAudio && !this.radioAudio.paused) {
      this.radioAudio.pause();
      this.radioAudio.src = '';
    }

    // 1. Local Track Playback Path
    if (isLocalTrack(song)) {
      this.isUsingCloudPlayer = false;
      cloudPlayerService.pause();
      try {
        const localSource = resolveLocalAudioSource(song, audioSourceUrl);
        if (localSource) {
          if (localSource.isObjectUrl) {
            this.currentObjectUrl = localSource.source;
          }
          await this.playDirectHtml5Audio(song, localSource.source, thisRequestId);
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || thisRequestId !== this.playRequestId) return;
        console.warn('Local audio playback error:', err);
        this.notify('Cannot play local audio file.');
        return;
      }
    }

    // 2. Remote/Online Track: Check Offline Cache Storage First
    try {
      const cachedAudioUrl = await downloadService.getCachedAudioUrl(song.id);
      if (cachedAudioUrl) {
        if (thisRequestId !== this.playRequestId) {
          downloadService.revokeCachedAudioUrl(song.id);
          return;
        }
        this.isUsingCloudPlayer = false;
        cloudPlayerService.pause();
        await this.playDirectHtml5Audio(song, cachedAudioUrl, thisRequestId);
        return;
      }
    } catch (cacheErr) {
      console.warn('Error reading offline cached audio:', cacheErr);
    }

    // 3. Graceful Offline Detection for un-cached remote tracks
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notify('You are offline. Only downloaded tracks can be played.');
      return;
    }

    // 4. Preview clip check (e.g. 30s iTunes sample)
    if (isPreviewClip(song)) {
      console.log(`[AudioService] Track "${song.title}" is a 30s preview clip. Resolving full song stream...`);
      await this.handlePlaybackFailure(song);
      return;
    }

    // 5. Standard Online Track Playback (JioSaavn / Direct Stream / YouTube Cloud)
    const isDirect = isDirectAudioStream(song);
    const ytVideoId = !isDirect ? extractYouTubeVideoId(song) : null;

    if (ytVideoId) {
      // 5.1 FAST PATH: Attempt Direct M4A Audio Stream Resolution
      const fastPath = await tryResolveFastPathYoutubeStream(ytVideoId);
      if (fastPath && fastPath.audioUrl) {
        console.log(`[AudioService] Successfully resolved direct M4A audio stream for YouTube track "${song.title}" (${fastPath.format}, ${fastPath.bitrate}kbps)`);
        song.filePath = fastPath.audioUrl;
        song.path = fastPath.audioUrl;
        song.format = fastPath.format || 'M4A';
        song.isSaavn = true;
        (song as any).isDirectAudioStream = true;

        return await this.playSong(song, audioSourceUrl);
      }

      // 5.2 BACKEND STREAM PROXY ATTEMPT: Stream direct audio via /api/online/stream
      if (!(song as any)._triedDirectStream) {
        (song as any)._triedDirectStream = true;
        try {
          const proxyUrl = buildApiUrl(`/api/online/stream?id=${encodeURIComponent(ytVideoId)}`);
          console.log(`[AudioService] Connecting direct audio stream for YouTube track "${song.title}" via ${proxyUrl}`);
          song.filePath = proxyUrl;
          song.path = proxyUrl;
          song.format = 'M4A';
          song.isSaavn = true;
          (song as any).isDirectAudioStream = true;
          return await this.playSong(song, proxyUrl);
        } catch (proxyErr) {
          console.warn(`[AudioService] Direct stream proxy attempt failed for ${ytVideoId}:`, proxyErr);
        }
      }

      // 5.3 Headless Cloud Player with Silent Audio Anchor & Background Watchdog
      this.isUsingCloudPlayer = true;
      audioWatchdog.startSilentAudioAnchor(this.audio);
      this.isCloudPlaying = false;
      cloudPlayerService.loadVideo(ytVideoId, 0);
      this.notify();

      audioWatchdog.startPlaybackWatchdog(
        () => this.isUsingCloudPlayer,
        () => this.isUserPaused,
        () => this.isCloudPlaying,
        () => {
          cloudPlayerService.play();
          audioWatchdog.startSilentAudioAnchor(this.audio);
        }
      );

      audioWatchdog.armCloudWatchdog(
        8000,
        () => this.isUsingCloudPlayer && !this.isCloudPlaying && this.currentSong?.id === song.id,
        () => {
          console.warn('YouTube stream watchdog triggered: buffering timeout or embed restriction. Switching to Studio Master audio.');
          this.handlePlaybackFailure(song);
        }
      );
      return;
    }

    // 6. Direct Audio Stream (JioSaavn 320k / Live Radio)
    this.isUsingCloudPlayer = false;
    cloudPlayerService.pause();

    try {
      let source = audioSourceUrl;
      if (!source) {
        if (isDirect && song.filePath) {
          source = song.filePath;
        } else if (song.filePath && (song.filePath.startsWith('http://') || song.filePath.startsWith('https://') || song.filePath.startsWith('/api/'))) {
          source = song.filePath;
        } else if (song.path && (song.path.startsWith('http://') || song.path.startsWith('https://') || song.path.startsWith('/api/'))) {
          source = song.path;
        } else if (song.title) {
          const searchResults = await searchJioSaavn(song.title);
          if (thisRequestId !== this.playRequestId) return;
          if (searchResults.length > 0 && searchResults[0].filePath) {
            source = searchResults[0].filePath;
            song.filePath = source;
            song.path = source;
            song.isSaavn = true;
          } else {
            source = song.filePath;
          }
        }
      }

      await this.playDirectHtml5Audio(song, source, thisRequestId);
    } catch (err: any) {
      if (err.name === 'AbortError' || thisRequestId !== this.playRequestId) return;
      console.warn('Audio playback note:', err);
      this.notify('Cannot play audio stream. Please check connection.');
    }
  }

  private async playRadioStream(song: Song, sourceUrl: string, requestId?: number) {
    if (!sourceUrl) {
      this.notify('Cannot play radio stream. Stream URL not found.');
      return;
    }
    if (requestId !== undefined && requestId !== this.playRequestId) return;

    this.isUsingCloudPlayer = false;
    cloudPlayerService.pause();
    this.audio.pause();

    try {
      this.radioAudio.pause();
      this.radioAudio.src = sourceUrl;
      this.radioAudio.volume = this.audio.volume;
      this.radioAudio.load();

      await this.radioAudio.play();
      if (requestId !== undefined && requestId !== this.playRequestId) return;

      this.notify();
    } catch (err: any) {
      if (err.name === 'AbortError' || (requestId !== undefined && requestId !== this.playRequestId)) {
        return;
      }
      console.warn('Direct live radio playback notice:', err);

      const rawUrl = song.filePath || song.path;
      if (rawUrl && !sourceUrl.includes('/api/radio/stream') && typeof window !== 'undefined') {
        const proxyUrl = buildApiUrl(`/api/radio/stream?url=${encodeURIComponent(rawUrl)}`);
        try {
          console.log('⚡ Attempting radio stream via low-latency proxy:', proxyUrl);
          this.radioAudio.pause();
          this.radioAudio.src = proxyUrl;
          this.radioAudio.volume = this.audio.volume;
          this.radioAudio.load();
          await this.radioAudio.play();
          if (requestId !== undefined && requestId !== this.playRequestId) return;
          this.notify();
          return;
        } catch (proxyErr) {
          console.warn('Proxy radio stream playback failed too:', proxyErr);
        }
      }

      if (song && !this.isFallingBack) {
        await this.handlePlaybackFailure(song);
      }
    }
  }

  private async playDirectHtml5Audio(song: Song, sourceUrl?: string, requestId?: number) {
    if (!sourceUrl) {
      this.notify('Cannot play audio file. File not found.');
      return;
    }
    if (requestId !== undefined && requestId !== this.playRequestId) return;

    this.isUsingCloudPlayer = false;
    cloudPlayerService.pause();

    const isNative = Capacitor.isNativePlatform();

    try {
      this.audio.pause();
      if (isNative) {
        this.audio.removeAttribute('crossorigin');
      }
      this.audio.src = sourceUrl;
      this.audio.load();

      this.isFadingOut = false;

      if (!isNative) {
        try {
          audioEffectsService.init(this.audio);
          await audioEffectsService.resumeContext();
        } catch (effectErr) {
          console.warn('Audio effects notice:', effectErr);
        }

        if (this.crossfadeSeconds > 0) {
          audioEffectsService.fadeCross(0, 0.01);
        }
      }

      await this.audio.play();

      if (requestId !== undefined && requestId !== this.playRequestId) return;

      if (!isNative) {
        if (this.crossfadeSeconds > 0) {
          audioEffectsService.fadeCross(1, Math.min(1.5, this.crossfadeSeconds));
        } else {
          audioEffectsService.fadeCross(1, 0.05);
        }
      }

      this.notify();
    } catch (err: any) {
      if (err.name === 'AbortError' || (requestId !== undefined && requestId !== this.playRequestId)) {
        return;
      }
      console.warn('Direct audio playback error:', err);

      if (this.audio.hasAttribute('crossorigin')) {
        try {
          console.log('⚡ Retrying direct audio without CORS restrictions...');
          this.audio.removeAttribute('crossorigin');
          this.audio.src = sourceUrl;
          this.audio.load();
          await this.audio.play();
          if (requestId !== undefined && requestId !== this.playRequestId) return;
          this.notify();
          return;
        } catch (retryErr) {
          console.warn('Direct audio retry without CORS also failed:', retryErr);
        }
      }

      if (song && !this.isFallingBack) {
        await this.handlePlaybackFailure(song);
      }
    }
  }

  private async handlePlaybackFailure(song: Song) {
    if (this.isFallingBack) return;
    this.isFallingBack = true;
    audioWatchdog.clearCloudWatchdog();

    try {
      const result = await resolvePlaybackFailover(song);
      switch (result.type) {
        case 'radio':
          song.filePath = result.url;
          song.path = result.url;
          await this.playRadioStream(song, result.url, this.playRequestId);
          break;
        case 'cloud':
          this.isUsingCloudPlayer = true;
          audioWatchdog.startSilentAudioAnchor(this.audio);
          this.isCloudPlaying = false;
          this.audio.pause();
          cloudPlayerService.loadVideo(result.videoId, 0);
          this.notify();
          break;
        case 'direct':
          Object.assign(song, result.songUpdates);
          await this.playDirectHtml5Audio(song, result.url, this.playRequestId);
          break;
        case 'failed':
          this.notify(result.message);
          break;
      }
    } catch (err) {
      console.warn('Playback failure recovery error:', err);
    } finally {
      this.isFallingBack = false;
    }
  }

  public pause(): void {
    this.isUserPaused = true;
    audioWatchdog.stopPlaybackWatchdog();
    if (this.isUsingCloudPlayer) {
      cloudPlayerService.pause();
      this.isCloudPlaying = false;
      audioWatchdog.pauseSilentAudioAnchor(this.audio);
    } else if (this.currentSong?.isLiveRadio) {
      this.radioAudio.pause();
    } else {
      this.audio.pause();
    }
    this.notify();
  }

  public async resume(): Promise<void> {
    this.isUserPaused = false;
    if (this.isUsingCloudPlayer) {
      audioWatchdog.startSilentAudioAnchor(this.audio);
      cloudPlayerService.play();
      this.isCloudPlaying = true;
      this.notify();
      return;
    }

    if (this.currentSong?.isLiveRadio) {
      try {
        await this.radioAudio.play();
        this.notify();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          await this.playSong(this.currentSong);
        }
      }
      return;
    }

    if (this.currentSong) {
      if (!this.audio.src || this.audio.src === window.location.href || this.audio.readyState === 0) {
        await this.playSong(this.currentSong);
        return;
      }

      try {
        if (!Capacitor.isNativePlatform()) {
          try {
            audioEffectsService.init(this.audio);
            await audioEffectsService.resumeContext();
          } catch (effectsErr) {
            console.warn('Effects resume notice:', effectsErr);
          }
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

    if (this.currentSong?.isLiveRadio) {
      if (this.radioAudio.paused) {
        await this.resume();
      } else {
        this.pause();
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
          if (!Capacitor.isNativePlatform()) {
            audioEffectsService.fadeCross(1, 0.2);
          }
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
    if (this.radioAudio) this.radioAudio.volume = clamped;
    cloudPlayerService.setVolume(clamped);
    if (clamped > 0 && this.isMuted) {
      this.isMuted = false;
    }
    this.notify();
  }

  public getVolume(): number {
    return this.audio.volume;
  }

  public toggleMute(): void {
    if (this.isMuted) {
      this.audio.volume = this.previousVolume || 0.8;
      if (this.radioAudio) this.radioAudio.volume = this.previousVolume || 0.8;
      this.isMuted = false;
      cloudPlayerService.setMuted(false);
    } else {
      this.previousVolume = this.audio.volume;
      this.audio.volume = 0;
      if (this.radioAudio) this.radioAudio.volume = 0;
      this.isMuted = true;
      cloudPlayerService.setMuted(true);
    }
    this.notify();
  }

  public setPlaybackRate(rate: number): void {
    if (this.audio) {
      const clamped = Math.max(0.5, Math.min(2.0, rate));
      this.audio.playbackRate = clamped;
      this.audio.preservesPitch = true;
      (this.audio as any).mozPreservesPitch = true;
      (this.audio as any).webkitPreservesPitch = true;
    }
    this.notify();
  }

  public getPlaybackRate(): number {
    return this.audio ? this.audio.playbackRate : 1.0;
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

  public isCurrentlyPlaying(): boolean {
    if (this.isUsingCloudPlayer) {
      return this.isCloudPlaying;
    }
    if (this.currentSong?.isLiveRadio) {
      return Boolean(this.radioAudio && !this.radioAudio.paused);
    }
    return Boolean(this.audio && !this.audio.paused);
  }

  public getCurrentPlaybackTime(): number {
    if (this.isUsingCloudPlayer) {
      return cloudPlayerService.getCurrentTime();
    }
    if (this.currentSong?.isLiveRadio) {
      return this.radioAudio?.currentTime || 0;
    }
    return this.audio?.currentTime || 0;
  }

  public getPlaybackDuration(): number {
    if (this.isUsingCloudPlayer) {
      return cloudPlayerService.getDuration() || this.currentSong?.duration || 0;
    }
    if (this.currentSong?.isLiveRadio) {
      return 0;
    }
    return this.audio?.duration || this.currentSong?.duration || 0;
  }
}

export const audioService = new AudioService();
