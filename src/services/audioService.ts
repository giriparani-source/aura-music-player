import { Song } from '../types/music';
import { audioEffectsService } from './audioEffectsService';
import { cloudPlayerService } from './cloudPlayerService';
import { downloadService } from './downloadService';
import { searchJioSaavn } from './jiosaavnService';
import { buildApiUrl } from '../utils/apiConfig';
import { Capacitor } from '@capacitor/core';
import { androidMediaBridge } from './androidMediaBridge';
import { audioMediaSession } from './audioMediaSession';
import { audioWatchdog } from './audioWatchdog';
import {
  extractYouTubeVideoId,
  isPreviewClip,
  isDirectAudioStream,
  isLocalTrack,
  resolveLocalAudioSource,
  resolvePlaybackFailover
} from './audioStreamResolver';
import { matchYouTubeToCatalog } from './catalogMatcher';
import { resolveYoutubeAudioStream } from './youtubeAudioResolver';

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

  // Track active engine: HTML5 Audio (local) vs Cloud Headless Player (Vercel online) vs Native ExoPlayer
  public isUsingCloudPlayer: boolean = false;
  public isUsingNativePlayer: boolean = false;
  private nativeCurrentPosition: number = 0;
  private nativeDuration: number = 0;
  private isNativePlaying: boolean = false;
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

  // Session persistence cue
  private pendingStartTime: number = 0;

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

      if (Capacitor.isNativePlatform()) {
        let hasDispatchedNativeEnd = false;
        let lastEndSongId: string | null = null;

        androidMediaBridge.onPlaybackProgress(({ position, duration, isPlaying }) => {
          if (!this.isUsingNativePlayer) return;
          this.nativeCurrentPosition = position;
          if (duration > 0) this.nativeDuration = duration;
          this.isNativePlaying = isPlaying;

          if (this.currentSong && !this.hasCountedMeaningfulPlay) {
            const threshold = Math.min(30, (duration || 30) * 0.5);
            if (position >= threshold) {
              this.hasCountedMeaningfulPlay = true;
              if (this.onMeaningfulListenCallback) {
                this.onMeaningfulListenCallback(this.currentSong);
              }
            }
          }

          // Native ExoPlayer track completion fallback:
          // If ExoPlayer is not playing, duration is valid, and position has reached near the end
          const currentId = this.currentSong?.id;
          if (currentId !== lastEndSongId) {
            hasDispatchedNativeEnd = false;
            lastEndSongId = currentId || null;
          }

          if (
            !isPlaying &&
            duration > 1 &&
            position >= Math.max(0, duration - 0.75) &&
            !hasDispatchedNativeEnd
          ) {
            hasDispatchedNativeEnd = true;
            if (this.onSongEndCallback) {
              this.onSongEndCallback();
            }
          } else if (isPlaying && position < duration - 1) {
            hasDispatchedNativeEnd = false;
          }

          this.notify();
        });
      }
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

    if (this.isUsingNativePlayer) {
      currentTime = this.nativeCurrentPosition;
      if (this.nativeDuration > 0) duration = this.nativeDuration;
      isActuallyPlaying = this.isNativePlaying;
    } else if (this.isUsingCloudPlayer) {
      currentTime = cloudPlayerService.getCurrentTime() || this.pendingStartTime || 0;
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
      currentTime = this.audio.currentTime || this.pendingStartTime || 0;
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

  /**
   * Prepares and cues a restored song and position into the player without auto-playing.
   * Restores mini-player and seek bar state across reopens.
   */
  public async restoreSession(song: Song, position: number): Promise<void> {
    this.currentSong = song;
    this.isUserPaused = true;
    this.pendingStartTime = Math.max(0, position);
    this.lastTimeUpdateSecond = this.pendingStartTime;

    const isDirect = isDirectAudioStream(song);
    const ytVideoId = !isDirect ? extractYouTubeVideoId(song) : null;

    if (ytVideoId) {
      this.isUsingCloudPlayer = true;
      this.isCloudPlaying = false;
      cloudPlayerService.cueVideo(ytVideoId, this.pendingStartTime);
    } else if (this.audio) {
      this.isUsingCloudPlayer = false;
      const srcUrl = song.filePath || song.path;
      if (srcUrl && !srcUrl.startsWith('blob:')) {
        this.audio.src = srcUrl;
        try {
          this.audio.currentTime = this.pendingStartTime;
        } catch {
          // Ignore if audio readyState not yet loaded
        }
      }
    }

    this.notify();
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

    // Stop native playback if active before switching tracks/engines
    if (this.isUsingNativePlayer) {
      this.isUsingNativePlayer = false;
      this.isNativePlaying = false;
      androidMediaBridge.stopNative().catch(() => {});
    }

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
          if (Capacitor.isNativePlatform()) {
            this.audio.pause();
            this.isUsingNativePlayer = true;
            this.currentSong = song;
            this.nativeCurrentPosition = this.pendingStartTime;
            this.nativeDuration = song.duration || 0;
            this.isNativePlaying = true;
            const nativeUri = localSource.rawNativeSource || (song as any).contentUri || song.path || localSource.source;
            await androidMediaBridge.playNativeTrack(song, nativeUri, this.pendingStartTime);
            this.pendingStartTime = 0;
            this.notify();
            return;
          }
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
      const isDownloaded = await downloadService.isTrackDownloaded(song.id);
      if (isDownloaded) {
        if (thisRequestId !== this.playRequestId) return;
        this.isUsingCloudPlayer = false;
        cloudPlayerService.pause();
        song.isForegroundOnly = false;
        song.playbackMode = 'direct-catalog';
        song.isDirectAudioStream = true;

        if (Capacitor.isNativePlatform()) {
          this.audio.pause();
          this.isUsingNativePlayer = true;
          this.currentSong = song;
          this.nativeCurrentPosition = this.pendingStartTime;
          this.nativeDuration = song.duration || 0;
          this.isNativePlaying = true;
          const nativeUri = await androidMediaBridge.ensureNativeOfflineAudio(song);
          if (nativeUri) {
            await androidMediaBridge.playNativeTrack(song, nativeUri, this.pendingStartTime);
            this.pendingStartTime = 0;
            this.notify();
            return;
          }
        }

        const cachedAudioUrl = await downloadService.getCachedAudioUrl(song.id);
        if (cachedAudioUrl) {
          await this.playDirectHtml5Audio(song, cachedAudioUrl, thisRequestId);
          return;
        }
      }
    } catch (cacheErr) {
      console.warn('Error reading offline cached audio:', cacheErr);
    }

    // 3. Graceful Offline Detection for un-cached remote tracks
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
    const hasResolvedDirectUrl = Boolean(
      song.filePath &&
      (song.filePath.includes('saavncdn.com') ||
       song.filePath.includes('googlevideo.com') ||
       song.filePath.includes('.m4a') ||
       song.filePath.includes('.mp3') ||
       song.filePath.includes('nadeko.net') ||
       song.filePath.includes('piped') ||
       song.filePath.includes('invidious'))
    );
    const isDirect = isDirectAudioStream(song) && hasResolvedDirectUrl;
    const ytVideoId = !isDirect ? extractYouTubeVideoId(song) : null;

    if (ytVideoId) {
      // 5.1 HIGH-CONFIDENCE AUTHORIZED CATALOG MATCHING (With Hard Gates)
      // YouTube URL = metadata/import source ONLY.
      // Evaluates artist, duration proximity, and version/type.
      // Rejects substitutes for 33-minute mixtapes, remixes, and live sets.
      if (!song.isSaavn && !(song as any)._evaluatedCatalog) {
        (song as any)._evaluatedCatalog = true;
        try {
          const matchResult = await matchYouTubeToCatalog(
            song.title,
            song.artist !== 'YouTube' ? song.artist : undefined,
            song.duration,
            ytVideoId,
            song.coverArt || song.artwork
          );

          if (matchResult.status === 'MATCHED') {
            console.log(`[AudioService] YouTube track "${song.title}" passed hard gates and matched with 320k Studio Master audio (${matchResult.confidence}%): ${matchResult.streamUrl}`);
            song.filePath = matchResult.streamUrl;
            song.path = matchResult.streamUrl;
            song.format = '320k AAC';
            song.bitrate = 320;
            song.isSaavn = true;
            song.isForegroundOnly = false;
            song.playbackMode = 'direct-catalog';
            (song as any).isDirectAudioStream = true;
            if (matchResult.song.artwork && !song.coverArt) {
              song.coverArt = matchResult.song.artwork;
              song.artwork = matchResult.song.artwork;
            }
            return await this.playSong(song, matchResult.streamUrl);
          } else {
            console.log(`[AudioService] YouTube track "${song.title}" unmatched by hard gates: ${matchResult.reason}. Checking direct stream extraction...`);
          }
        } catch (matchErr) {
          console.warn('[AudioService] Catalog match check error for YouTube track:', matchErr);
        }
      }

      // 5.2 Direct Audio Stream Extraction Attempt (yt-dlp backend or mirror extraction)
      // If a valid direct M4A/WebM stream can be resolved, route to direct audio (ExoPlayer / HTML5 audio)
      try {
        const streamResult = await resolveYoutubeAudioStream(ytVideoId);
        if (streamResult && streamResult.audioUrl) {
          console.log(`[AudioService] Successfully resolved direct YouTube audio stream for "${song.title}" (${streamResult.format}): ${streamResult.audioUrl}`);
          song.filePath = streamResult.audioUrl;
          song.path = streamResult.audioUrl;
          song.format = streamResult.format || 'M4A';
          song.bitrate = streamResult.bitrate || 160;
          if (streamResult.durationSeconds && (!song.duration || song.duration === 0)) {
            song.duration = streamResult.durationSeconds;
          }
          song.isForegroundOnly = false;
          song.playbackMode = 'direct-catalog';
          (song as any).isDirectAudioStream = true;
          if (streamResult.artwork && !song.coverArt) {
            song.coverArt = streamResult.artwork;
            song.artwork = streamResult.artwork;
          }
          return await this.playSong(song, streamResult.audioUrl);
        }
      } catch (streamErr) {
        console.warn('[AudioService] Direct YouTube stream resolution error:', streamErr);
      }

      // 5.3 Foreground-Only YouTube IFrame Player (Transparently foreground only when direct stream is unavailable)
      song.isForegroundOnly = true;
      song.playbackMode = 'youtube-foreground';
      this.isUsingCloudPlayer = true;
      this.isCloudPlaying = false;
      const startSec = this.pendingStartTime || 0;
      this.pendingStartTime = 0;
      cloudPlayerService.loadVideo(ytVideoId, startSec);
      this.notify();
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

      // Native Android ExoPlayer routing for direct audio streams (Screen-off ready)
      if (Capacitor.isNativePlatform() && source && (source.startsWith('http://') || source.startsWith('https://'))) {
        if (thisRequestId !== this.playRequestId) return;
        this.audio.pause();
        this.isUsingNativePlayer = true;
        this.currentSong = song;
        this.nativeCurrentPosition = this.pendingStartTime;
        this.nativeDuration = song.duration || 0;
        this.isNativePlaying = true;
        await androidMediaBridge.playNativeTrack(song, source, this.pendingStartTime);
        if (thisRequestId !== this.playRequestId) return;
        this.pendingStartTime = 0;
        this.notify();
        return;
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

      if (this.pendingStartTime > 0) {
        try {
          this.audio.currentTime = this.pendingStartTime;
          this.lastTimeUpdateSecond = this.pendingStartTime;
        } catch {}
        this.pendingStartTime = 0;
      }

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

  /**
   * Seamlessly hot-swaps active playback from YouTube IFrame to local cached audio
   * without interrupting the user's listening experience.
   */
  public async hotSwapToCachedAudio(song: Song, cachedAudioUrl: string, atTimeSec?: number): Promise<void> {
    try {
      const position = atTimeSec !== undefined ? atTimeSec : (this.getCurrentTime() || 0);
      const wasPlaying = this.isUsingCloudPlayer ? this.isCloudPlaying : (!this.audio.paused && !this.audio.ended);

      // 1. Shut down YouTube Cloud IFrame
      this.isUsingCloudPlayer = false;
      this.isCloudPlaying = false;
      audioWatchdog.clearCloudWatchdog();
      cloudPlayerService.pause();

      // 2. Configure track metadata
      song.isDownloaded = true;
      song.isForegroundOnly = false;
      song.playbackMode = 'direct-catalog';
      song.isDirectAudioStream = true;
      this.currentSong = song;

      // 3. Switch audio engine
      const isNative = Capacitor.isNativePlatform();
      this.audio.pause();

      if (isNative) {
        const nativeUri = await androidMediaBridge.ensureNativeOfflineAudio(song);
        if (nativeUri) {
          this.isUsingNativePlayer = true;
          this.nativeCurrentPosition = position;
          this.nativeDuration = song.duration || 0;
          this.isNativePlaying = wasPlaying;
          await androidMediaBridge.playNativeTrack(song, nativeUri, position);
          if (!wasPlaying) {
            await androidMediaBridge.pauseNative();
          }
          this.notify();
          console.log(`⚡ Seamlessly hot-swapped "${song.title}" to native ExoPlayer at ${position.toFixed(1)}s`);
          return;
        }
      }

      if (isNative) {
        this.audio.removeAttribute('crossorigin');
      }
      this.audio.src = cachedAudioUrl;
      this.audio.load();

      if (position > 0) {
        try {
          this.audio.currentTime = position;
          this.lastTimeUpdateSecond = position;
        } catch {}
      }

      if (wasPlaying) {
        await this.audio.play();
      }

      this.notify();
      console.log(`⚡ Seamlessly hot-swapped "${song.title}" from YouTube iframe to offline cached audio at ${position.toFixed(1)}s`);
    } catch (err) {
      console.warn('Hot-swap to cached audio notice:', err);
    }
  }

  public pause(): void {
    this.isUserPaused = true;
    audioWatchdog.stopPlaybackWatchdog();
    audioEffectsService.suspend();
    if (this.isUsingNativePlayer) {
      this.isNativePlaying = false;
      androidMediaBridge.pauseNative().catch(() => {});
    } else if (this.isUsingCloudPlayer) {
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
    audioEffectsService.resume();
    if (this.isUsingNativePlayer) {
      this.isNativePlaying = true;
      await androidMediaBridge.resumeNative();
      this.notify();
      return;
    }

    if (this.isUsingCloudPlayer) {
      // Check if song has been downloaded to offline cache
      if (this.currentSong) {
        const cachedUrl = await downloadService.getCachedAudioUrl(this.currentSong.id);
        if (cachedUrl) {
          const currentTime = cloudPlayerService.getCurrentTime() || 0;
          await this.hotSwapToCachedAudio(this.currentSong, cachedUrl, currentTime);
          return;
        }
      }
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
        if (this.pendingStartTime > 0) {
          try {
            this.audio.currentTime = this.pendingStartTime;
            this.lastTimeUpdateSecond = this.pendingStartTime;
          } catch {}
          this.pendingStartTime = 0;
        }
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
    if (this.isUsingNativePlayer) {
      if (this.isNativePlaying) {
        this.pause();
      } else {
        await this.resume();
      }
      return;
    }

    if (this.isUsingCloudPlayer) {
      // Check if song has been downloaded to offline cache
      if (this.currentSong) {
        const cachedUrl = await downloadService.getCachedAudioUrl(this.currentSong.id);
        if (cachedUrl) {
          const currentTime = cloudPlayerService.getCurrentTime() || 0;
          await this.hotSwapToCachedAudio(this.currentSong, cachedUrl, currentTime);
          return;
        }
      }
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

  public getCurrentTime(): number {
    if (this.isUsingNativePlayer) {
      return this.nativeCurrentPosition;
    }
    if (this.isUsingCloudPlayer) {
      return cloudPlayerService.getCurrentTime() || this.pendingStartTime || 0;
    }
    if (this.currentSong?.isLiveRadio) {
      return this.radioAudio.currentTime || 0;
    }
    return this.audio.currentTime || this.pendingStartTime || 0;
  }

  public seek(seconds: number): void {
    if (isFinite(seconds)) {
      if (this.isUsingNativePlayer) {
        this.nativeCurrentPosition = seconds;
        androidMediaBridge.seekNative(seconds).catch(() => {});
      } else if (this.isUsingCloudPlayer) {
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
    if (this.isUsingNativePlayer) {
      return this.isNativePlaying;
    }
    if (this.isUsingCloudPlayer) {
      return this.isCloudPlaying;
    }
    if (this.currentSong?.isLiveRadio) {
      return Boolean(this.radioAudio && !this.radioAudio.paused);
    }
    return Boolean(this.audio && !this.audio.paused);
  }

  public getCurrentPlaybackTime(): number {
    if (this.isUsingNativePlayer) {
      return this.nativeCurrentPosition;
    }
    if (this.isUsingCloudPlayer) {
      return cloudPlayerService.getCurrentTime();
    }
    if (this.currentSong?.isLiveRadio) {
      return this.radioAudio?.currentTime || 0;
    }
    return this.audio?.currentTime || 0;
  }

  public getPlaybackDuration(): number {
    if (this.isUsingNativePlayer && this.nativeDuration > 0) {
      return this.nativeDuration;
    }
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
