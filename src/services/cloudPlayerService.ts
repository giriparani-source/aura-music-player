/**
 * CloudPlayerService
 * Headless YouTube Web Player Engine for Aura Music Player.
 * Provides 100% resilient cloud streaming on Vercel & web environments
 * without requiring a backend server.
 */

type PlayerCallback = () => void;
type TimeUpdateCallback = (currentTime: number, duration: number) => void;
type ErrorCallback = (error: string) => void;

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

class CloudPlayerService {
  private player: any = null;
  private isReady: boolean = false;
  private isApiLoaded: boolean = false;
  private pendingVideoId: string | null = null;
  private pendingStartTime: number = 0;
  private timeUpdateInterval: any = null;
  private volume: number = 1;
  private isMuted: boolean = false;
  private currentVideoId: string | null = null;

  // Event callbacks
  private onPlayCallbacks: PlayerCallback[] = [];
  private onPauseCallbacks: PlayerCallback[] = [];
  private onEndCallbacks: PlayerCallback[] = [];
  private onTimeUpdateCallbacks: TimeUpdateCallback[] = [];
  private onErrorCallbacks: ErrorCallback[] = [];

  constructor() {
    this.initApi();
  }

  private initApi() {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      this.isApiLoaded = true;
      this.mountPlayer();
      return;
    }

    // Prepare callback
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      this.isApiLoaded = true;
      this.mountPlayer();
    };

    // Inject YouTube IFrame API script
    if (!document.getElementById('yt-iframe-api-script')) {
      const script = document.createElement('script');
      script.id = 'yt-iframe-api-script';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  }

  private mountPlayer() {
    if (!window.YT || !window.YT.Player) return;

    // Create container with on-screen active viewport dimensions and full opacity
    // to prevent Chromium from categorizing the video as 'offscreen / hidden' and suspending playback
    let container = document.getElementById('aura-headless-cloud-player');
    if (!container) {
      container = document.createElement('div');
      container.id = 'aura-headless-cloud-player';
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.right = '0';
      container.style.width = '2px';
      container.style.height = '2px';
      container.style.opacity = '1';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '99999';
      container.style.overflow = 'hidden';
      document.body.appendChild(container);
    }

    try {
      this.player = new window.YT.Player('aura-headless-cloud-player', {
        height: '2',
        width: '2',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          origin: (typeof window !== 'undefined' && window.location.origin.includes('localhost'))
            ? 'https://aura-music-player-omega.vercel.app'
            : (typeof window !== 'undefined' ? window.location.origin : '')
        },
        events: {
          onReady: () => {
            this.isReady = true;
            this.player.setVolume(Math.round(this.volume * 100));
            if (this.isMuted) this.player.mute();

            if (this.pendingVideoId) {
              this.loadVideo(this.pendingVideoId, this.pendingStartTime);
              this.pendingVideoId = null;
            }
          },
          onStateChange: (event: any) => {
            this.handleStateChange(event.data);
          },
          onError: (event: any) => {
            console.error('Cloud player error code:', event.data);
            this.stopTimeTracking();
            this.onErrorCallbacks.forEach((cb) => cb(`Stream error code ${event.data}`));
          }
        }
      });
    } catch (err) {
      console.error('Failed to mount headless cloud player:', err);
    }
  }

  private handleStateChange(state: number) {
    // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
    if (state === 1) {
      // Playing - enforce maximum quality for highest Opus audio bitrate
      if (this.player && typeof this.player.setPlaybackQuality === 'function') {
        try {
          this.player.setPlaybackQuality('hd1080');
        } catch (_) {}
      }
      this.startTimeTracking();
      this.onPlayCallbacks.forEach((cb) => cb());
    } else if (state === 2) {
      // Paused
      this.stopTimeTracking();
      this.onPauseCallbacks.forEach((cb) => cb());
    } else if (state === 0) {
      // Ended
      this.stopTimeTracking();
      this.onEndCallbacks.forEach((cb) => cb());
    }
  }

  private startTimeTracking() {
    this.stopTimeTracking();
    this.timeUpdateInterval = setInterval(() => {
      if (this.player && typeof this.player.getCurrentTime === 'function') {
        const current = this.player.getCurrentTime() || 0;
        const duration = this.player.getDuration() || 0;
        this.onTimeUpdateCallbacks.forEach((cb) => cb(current, duration));
      }
    }, 250);
  }

  private stopTimeTracking() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  // Public Controls
  public loadVideo(videoId: string, startTime: number = 0) {
    this.currentVideoId = videoId;
    if (!this.isReady || !this.player) {
      this.pendingVideoId = videoId;
      this.pendingStartTime = startTime;
      return;
    }

    try {
      this.player.loadVideoById({
        videoId,
        startSeconds: startTime,
        suggestedQuality: 'hd1080'
      });
      if (typeof this.player.setPlaybackQuality === 'function') {
        try {
          this.player.setPlaybackQuality('hd1080');
        } catch (_) {}
      }
      this.player.playVideo();
    } catch (err) {
      console.error('Error loading cloud video:', err);
    }
  }

  public play() {
    if (this.player && typeof this.player.playVideo === 'function') {
      try {
        this.player.playVideo();
      } catch (err) {
        console.error(err);
      }
    }
  }

  public pause() {
    if (this.player && typeof this.player.pauseVideo === 'function') {
      try {
        this.player.pauseVideo();
      } catch (err) {
        console.error(err);
      }
    }
    this.stopTimeTracking();
  }

  public seek(seconds: number) {
    if (this.player && typeof this.player.seekTo === 'function') {
      try {
        this.player.seekTo(seconds, true);
      } catch (err) {
        console.error(err);
      }
    }
  }

  public setVolume(level: number) {
    this.volume = Math.max(0, Math.min(1, level));
    if (this.player && typeof this.player.setVolume === 'function') {
      this.player.setVolume(Math.round(this.volume * 100));
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.player) {
      if (muted && typeof this.player.mute === 'function') {
        this.player.mute();
      } else if (!muted && typeof this.player.unMute === 'function') {
        this.player.unMute();
      }
    }
  }

  public getCurrentTime(): number {
    if (this.player && typeof this.player.getCurrentTime === 'function') {
      return this.player.getCurrentTime() || 0;
    }
    return 0;
  }

  public getDuration(): number {
    if (this.player && typeof this.player.getDuration === 'function') {
      return this.player.getDuration() || 0;
    }
    return 0;
  }

  public getCurrentVideoId(): string | null {
    return this.currentVideoId;
  }

  // Event Listeners Registration (BUG-23 fix: returns unsubscribe cleanup callback)
  public onPlay(cb: PlayerCallback): () => void {
    this.onPlayCallbacks.push(cb);
    return () => {
      this.onPlayCallbacks = this.onPlayCallbacks.filter((c) => c !== cb);
    };
  }

  public onPause(cb: PlayerCallback): () => void {
    this.onPauseCallbacks.push(cb);
    return () => {
      this.onPauseCallbacks = this.onPauseCallbacks.filter((c) => c !== cb);
    };
  }

  public onEnded(cb: PlayerCallback): () => void {
    this.onEndCallbacks.push(cb);
    return () => {
      this.onEndCallbacks = this.onEndCallbacks.filter((c) => c !== cb);
    };
  }

  public onTimeUpdate(cb: TimeUpdateCallback): () => void {
    this.onTimeUpdateCallbacks.push(cb);
    return () => {
      this.onTimeUpdateCallbacks = this.onTimeUpdateCallbacks.filter((c) => c !== cb);
    };
  }

  public onError(cb: ErrorCallback): () => void {
    this.onErrorCallbacks.push(cb);
    return () => {
      this.onErrorCallbacks = this.onErrorCallbacks.filter((c) => c !== cb);
    };
  }
}

export const cloudPlayerService = new CloudPlayerService();
