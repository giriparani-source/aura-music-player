import { cloudPlayerService } from './cloudPlayerService';

/**
 * Base64 1-sec silent WAV audio buffer.
 * Keeps Chromium WebView, OS audio HAL, and CPU awake during background and screen-off playback.
 */
export const SILENT_AUDIO_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/**
 * AudioWatchdog manages:
 * 1. The silent audio anchor loop on the HTML5 audio element to prevent OS audio sleep.
 * 2. The 15-second background watchdog interval detecting stalled cloud/iframe playback.
 * 3. Buffer timeout detection for YouTube cloud fallback.
 */
export class AudioWatchdog {
  private playbackWatchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastWatchdogCloudTime: number = -1;
  private cloudWatchdogTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Starts playing the silent audio loop on the provided HTMLAudioElement.
   * This anchors the mobile/desktop browser's audio pipeline so background playback isn't suspended.
   */
  public startSilentAudioAnchor(audio: HTMLAudioElement): void {
    try {
      if (audio.src !== SILENT_AUDIO_DATA_URI) {
        audio.src = SILENT_AUDIO_DATA_URI;
        audio.loop = true;
      }
      audio.play().catch(() => {});
    } catch {}
  }

  /**
   * Pauses the silent audio loop when playback is paused or completed.
   */
  public pauseSilentAudioAnchor(audio: HTMLAudioElement): void {
    try {
      if (audio.src === SILENT_AUDIO_DATA_URI) {
        audio.pause();
      }
    } catch {}
  }

  /**
   * JS-level playback watchdog — fires every 15s to detect and recover stalled cloud playback.
   * Works alongside the Java heartbeat in AuraAudioService.java for rock-solid background playback.
   */
  public startPlaybackWatchdog(
    isUsingCloud: () => boolean,
    isUserPaused: () => boolean,
    isCloudPlaying: () => boolean,
    onStallRecovery: () => void
  ): void {
    this.stopPlaybackWatchdog();
    this.lastWatchdogCloudTime = -1;
    this.playbackWatchdogTimer = setInterval(() => {
      if (!isUsingCloud() || isUserPaused()) return;
      const currentTime = cloudPlayerService.getCurrentTime();
      if (
        this.lastWatchdogCloudTime >= 0 &&
        currentTime === this.lastWatchdogCloudTime &&
        isCloudPlaying()
      ) {
        console.warn(
          '[AudioWatchdog] Cloud player stalled at',
          currentTime,
          's — forcing recovery'
        );
        onStallRecovery();
      }
      this.lastWatchdogCloudTime = currentTime;
    }, 15_000);
  }

  public stopPlaybackWatchdog(): void {
    if (this.playbackWatchdogTimer !== null) {
      clearInterval(this.playbackWatchdogTimer);
      this.playbackWatchdogTimer = null;
    }
    this.lastWatchdogCloudTime = -1;
  }

  /**
   * Arm a timeout (default 8000ms) to detect buffering failures or embed restrictions
   * on YouTube cloud playback.
   */
  public armCloudWatchdog(
    timeoutMs: number,
    checkCondition: () => boolean,
    onTimeout: () => void
  ): void {
    this.clearCloudWatchdog();
    this.cloudWatchdogTimeout = setTimeout(() => {
      if (checkCondition()) {
        onTimeout();
      }
    }, timeoutMs);
  }

  public clearCloudWatchdog(): void {
    if (this.cloudWatchdogTimeout !== null) {
      clearTimeout(this.cloudWatchdogTimeout);
      this.cloudWatchdogTimeout = null;
    }
  }
}

export const audioWatchdog = new AudioWatchdog();
