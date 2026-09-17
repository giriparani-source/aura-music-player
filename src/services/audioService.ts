import { Song } from '../types/music';
import { getRegisteredFile } from './scannerService';
import { audioEffectsService } from './audioEffectsService';
import { cloudPlayerService } from './cloudPlayerService';
import { searchJioSaavn, PRESET_SAAVN_320K_HITS } from './jiosaavnService';
import { downloadService } from './downloadService';
import { buildApiUrl } from '../utils/apiConfig';
import { radioService } from './radioService';

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
  private radioAudio: HTMLAudioElement;
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
  private cloudWatchdogTimeout: any = null;

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
      this.audio.crossOrigin = 'anonymous';
      this.audio.volume = 0.8;

      this.radioAudio = new Audio();
      this.radioAudio.preload = 'auto';
      // Deliberately NO crossOrigin on radioAudio to allow direct hardware playback of any internet radio stream
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
      // BUG-02 fix: Guard against race condition — only fallback if this error
      // belongs to the currently-intended song (not a stale source switch)
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
        if (this.cloudWatchdogTimeout) {
          clearTimeout(this.cloudWatchdogTimeout);
          this.cloudWatchdogTimeout = null;
        }
        this.notify();
      }
    });

    cloudPlayerService.onPause(() => {
      if (this.isUsingCloudPlayer) {
        // If pause occurred without explicit user action (e.g. mobile OS screen-off or app minimization),
        // instantly recover and resume playback
        if (!this.isUserPaused && this.currentSong) {
          console.log('[AudioService] Background cloud pause intercepted. Restoring playback...');
          setTimeout(() => {
            if (!this.isUserPaused && this.isUsingCloudPlayer) {
              cloudPlayerService.play();
            }
          }, 150);
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

    cloudPlayerService.onTimeUpdate((_current, _duration) => {
      if (this.isUsingCloudPlayer) {
        this.notify();
      }
    });

    cloudPlayerService.onError((err) => {
      if (this.isUsingCloudPlayer && this.currentSong) {
        console.warn('YouTube playback error, switching to Studio Master audio stream:', err);
        this.fallbackToDirectAudio(this.currentSong);
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
    this.updateMediaSession(isActuallyPlaying);
  }

  private lastMediaSessionKey: string | null = null;

  private updateMediaSession(isActuallyPlaying: boolean) {
    if (!('mediaSession' in navigator)) return;

    try {
      const desiredState: MediaSessionPlaybackState = isActuallyPlaying ? 'playing' : 'paused';
      if (navigator.mediaSession.playbackState !== desiredState) {
        navigator.mediaSession.playbackState = desiredState;
      }

      if (!this.currentSong) {
        if (this.lastMediaSessionKey !== null) {
          navigator.mediaSession.metadata = null;
          this.lastMediaSessionKey = null;
        }
        return;
      }

      const songKey = `${this.currentSong.id}_${this.currentSong.title}_${this.currentSong.artist}_${this.currentSong.artwork || this.currentSong.coverArt}`;
      if (songKey !== this.lastMediaSessionKey) {
        this.lastMediaSessionKey = songKey;
        navigator.mediaSession.metadata = new MediaMetadata({
          title: this.currentSong.title,
          artist: this.currentSong.artist !== 'Not set' ? this.currentSong.artist : 'Aura Music',
          album: this.currentSong.album !== 'Not set' ? this.currentSong.album : 'Aura Collection',
          artwork: (this.currentSong.artwork || this.currentSong.coverArt)
            ? [{ src: (this.currentSong.artwork || this.currentSong.coverArt)!, sizes: '512x512', type: 'image/png' }]
            : []
        });
      }
    } catch {
      // Ignore mediaSession errors on platforms without SMTC
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
    if (song.isSaavn || song.filePath?.includes('saavncdn.com')) {
      return null;
    }
    if (song.sourceId && song.sourceId.length >= 8 && song.sourceId.length <= 15 && (song.id?.startsWith('online_') || song.id?.startsWith('cloud_') || song.isOnline)) {
      return song.sourceId;
    }
    if (song.id && song.id.startsWith('online_')) {
      return song.id.replace('online_', '');
    }
    if (song.id && song.id.startsWith('cloud_')) {
      return song.id.replace('cloud_', '');
    }
    const pathStr = song.filePath || song.path || '';
    const match = pathStr.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i);
    if (match && match[1]) {
      return match[1];
    }
    return null;
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

      // If stream is HTTP and page is on HTTPS, route through radio proxy to avoid mixed-content block
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

    // 1. Local Track Playback Path (preserved untouched)
    const registeredFile = getRegisteredFile(song.id);
    const isLocalFile = Boolean(
      registeredFile ||
      (!song.isOnline && !song.isSaavn && song.path && !song.path.startsWith('http://') && !song.path.startsWith('https://'))
    );

    if (isLocalFile) {
      this.isUsingCloudPlayer = false;
      cloudPlayerService.pause();
      try {
        let source = audioSourceUrl;
        if (!source) {
          if (registeredFile) {
            source = URL.createObjectURL(registeredFile);
            this.currentObjectUrl = source;
          } else if (song.filePath && (song.filePath.startsWith('/api/') || song.filePath.startsWith('blob:'))) {
            source = song.filePath;
          } else if (song.path && !song.path.startsWith('blob:')) {
            source = buildApiUrl(`/api/audio?path=${encodeURIComponent(song.path)}`);
          } else if (song.fileName) {
            source = buildApiUrl(`/api/audio?path=${encodeURIComponent(song.fileName)}`);
          }
        }
        if (source) {
          await this.playDirectHtml5Audio(song, source, thisRequestId);
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

    // 4. Standard Online Track Playback (JioSaavn / Direct Stream / YouTube Cloud)
    // Check if track is a preview clip (e.g. 30s iTunes sample) that should NOT be played as a full direct audio stream
    const isPreviewClip = Boolean(
      song.isPreview ||
      song.id?.startsWith('itunes_') ||
      (song.filePath && (song.filePath.includes('mzstatic.com') || song.filePath.includes('itunes.apple.com')))
    );

    // Check if track is a true direct audio stream (JioSaavn 320k master or Live FM Radio)
    const isDirectAudioStream = !isPreviewClip && Boolean(
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

    // If it was a preview clip, immediately resolve full track via YouTube or JioSaavn full search
    if (isPreviewClip) {
      console.log(`[AudioService] Track "${song.title}" is a 30s preview clip. Resolving full song stream...`);
      await this.handlePlaybackFailure(song);
      return;
    }

    // YouTube track check
    const ytVideoId = !isDirectAudioStream ? this.extractYouTubeVideoId(song) : null;

    if (ytVideoId) {
      this.isUsingCloudPlayer = true;
      this.audio.pause();
      // BUG-12 fix: isCloudPlaying should remain false until onPlay fires!
      this.isCloudPlaying = false;
      cloudPlayerService.loadVideo(ytVideoId, 0);
      this.notify();

      // Arm watchdog: Increase timeout to 8000ms to avoid false-positive aborts on slow mobile networks
      if (this.cloudWatchdogTimeout) clearTimeout(this.cloudWatchdogTimeout);
      this.cloudWatchdogTimeout = setTimeout(() => {
        if (this.isUsingCloudPlayer && !this.isCloudPlaying && this.currentSong?.id === song.id) {
          console.warn('YouTube stream watchdog triggered: buffering timeout or embed restriction. Switching to Studio Master audio.');
          this.fallbackToDirectAudio(song);
        }
      }, 8000);
      return;
    }

    // Direct Audio Stream (JioSaavn 320k / Live Radio):
    this.isUsingCloudPlayer = false;
    cloudPlayerService.pause();

    try {
      let source = audioSourceUrl;
      if (!source) {
        if (isDirectAudioStream && song.filePath) {
          source = song.filePath;
        } else if (song.filePath && (song.filePath.startsWith('http://') || song.filePath.startsWith('https://') || song.filePath.startsWith('/api/'))) {
          source = song.filePath;
        } else if (song.path && (song.path.startsWith('http://') || song.path.startsWith('https://') || song.path.startsWith('/api/'))) {
          source = song.path;
        } else if (song.title) {
          // Dynamically resolve audio stream for this specific song
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

      // If direct playback had an issue (e.g. Mixed Content or network restriction) and we haven't tried proxy yet:
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

    try {
      this.audio.pause();
      this.audio.src = sourceUrl;
      this.audio.load();

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

      if (requestId !== undefined && requestId !== this.playRequestId) return;

      if (this.crossfadeSeconds > 0) {
        audioEffectsService.fadeCross(1, Math.min(1.5, this.crossfadeSeconds));
      } else {
        audioEffectsService.fadeCross(1, 0.05);
      }

      this.notify();
    } catch (err: any) {
      if (err.name === 'AbortError' || (requestId !== undefined && requestId !== this.playRequestId)) {
        return;
      }
      console.warn('Direct audio playback error:', err);
      if (song && !this.isFallingBack) {
        await this.handlePlaybackFailure(song);
      }
    }
  }

  private async handlePlaybackFailure(song: Song) {
    if (this.isFallingBack) return;
    this.isFallingBack = true;
    if (this.cloudWatchdogTimeout) {
      clearTimeout(this.cloudWatchdogTimeout);
      this.cloudWatchdogTimeout = null;
    }

    try {
      // Live Radio Auto-Failover
      if (song.isLiveRadio) {
        const station = radioService.getStationByUrl(song.filePath || song.path);
        if (station && station.backupUrls && station.backupUrls.length > 0) {
          const nextUrl = station.backupUrls.find((u) => u !== song.filePath);
          if (nextUrl) {
            console.log(`⚡ Live Radio Auto-Failover: "${station.name}" switching to mirror stream:`, nextUrl);
            song.filePath = nextUrl;
            song.path = nextUrl;
            await this.playRadioStream(song, nextUrl, this.playRequestId);
            return;
          }
        }
        this.notify(`Live radio stream for "${song.title}" is currently offline. Retrying shortly.`);
        return;
      }

      const cleanTitle = song.title
        .replace(/\([^)]*\)/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/video song/gi, '')
        .replace(/lyric video/gi, '')
        .replace(/audio/gi, '')
        .trim();

      const lower = cleanTitle.toLowerCase();
      const preset = PRESET_SAAVN_320K_HITS.find((p) => {
        const pLower = p.title.toLowerCase().trim();
        return pLower === lower || (lower.length >= 4 && pLower.includes(lower));
      });

      let fallbackUrl = (preset?.filePath && preset.filePath !== song.filePath) ? preset.filePath : '';

      if (!fallbackUrl) {
        const results = await searchJioSaavn(cleanTitle);
        const validFullSaavn = results?.find(
          (r) => r.filePath && r.filePath !== song.filePath && !r.isPreview && !r.id.startsWith('itunes_')
        );
        if (validFullSaavn && validFullSaavn.filePath) {
          fallbackUrl = validFullSaavn.filePath;
          if (validFullSaavn.artwork && !song.coverArt) {
            song.coverArt = validFullSaavn.artwork;
            song.artwork = validFullSaavn.artwork;
          }
        }
      }

      if (fallbackUrl) {
        console.log('⚡ Switched to Ultra-HD 320k Studio Master audio:', song.title, '->', fallbackUrl);
        song.isSaavn = true;
        song.isPreview = false;
        song.format = '320k AAC';
        song.bitrate = 320;
        song.filePath = fallbackUrl;
        song.path = fallbackUrl;

        await this.playDirectHtml5Audio(song, fallbackUrl, this.playRequestId);
        return;
      }

      // If direct audio search didn't yield a stream, try YouTube online search
      try {
        const ytRes = await fetch(buildApiUrl(`/api/online/search?q=${encodeURIComponent(cleanTitle + ' ' + (song.artist || 'Tamil'))}`));
        if (ytRes.ok) {
          const ytData = await ytRes.json();
          const firstYt = ytData.results?.[0];
          if (firstYt?.sourceId) {
            console.log('⚡ Switched to YouTube Cloud Player stream:', song.title, '->', firstYt.sourceId);
            this.isUsingCloudPlayer = true;
            this.audio.pause();
            cloudPlayerService.loadVideo(firstYt.sourceId, 0);
            this.isCloudPlaying = true;
            this.notify();
            return;
          }
        }
      } catch {}

      console.warn('Audio stream unavailable for:', song.title);
      this.notify('Audio stream unavailable for this track.');
    } catch (err) {
      console.warn('Playback failure recovery error:', err);
    } finally {
      this.isFallingBack = false;
    }
  }

  private async fallbackToDirectAudio(song: Song) {
    await this.handlePlaybackFailure(song);
  }

  public pause(): void {
    this.isUserPaused = true;
    if (this.isUsingCloudPlayer) {
      cloudPlayerService.pause();
      this.isCloudPlaying = false;
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
