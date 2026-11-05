import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { androidMediaBridge, dispatchMediaAction, registerMediaActionHandler } from '../androidMediaBridge';
import { audioService } from '../audioService';
import { Song } from '../../types/music';
import { Capacitor, registerPlugin } from '@capacitor/core';

// Mock Capacitor
vi.mock('@capacitor/core', () => {
  const mockAuraMedia = {
    playNativeTrack: vi.fn().mockResolvedValue(undefined),
    pauseNative: vi.fn().mockResolvedValue(undefined),
    resumeNative: vi.fn().mockResolvedValue(undefined),
    seekNative: vi.fn().mockResolvedValue(undefined),
    stopNative: vi.fn().mockResolvedValue(undefined),
    isOfflineTrackSaved: vi.fn().mockResolvedValue({ saved: false, filePath: '', uri: '' }),
    getOfflineServerPort: vi.fn().mockResolvedValue({ port: 28753 }),
    updateTrack: vi.fn().mockResolvedValue(undefined),
    updatePlaybackState: vi.fn().mockResolvedValue(undefined),
    stopService: vi.fn().mockResolvedValue(undefined),
    minimizeApp: vi.fn().mockResolvedValue(undefined),
    scanDeviceAudio: vi.fn().mockResolvedValue({ total: 0, tracks: [] }),
    addListener: vi.fn(),
  };

  return {
    Capacitor: {
      isNativePlatform: vi.fn().mockReturnValue(true),
      convertFileSrc: vi.fn((path: string) => `https://localhost/_capacitor_file_${path}`),
    },
    registerPlugin: vi.fn().mockReturnValue(mockAuraMedia),
  };
});

/**
 * Native Queue Transition Lifecycle Simulator
 * Accurately models the exact transition lock logic implemented in AuraAudioService.java
 */
class AuraAudioServiceLockSimulator {
  public isQueueTransitioning = false;
  public isPlaying = false;
  public isWakeLockHeld = false;
  public isWifiLockHeld = false;
  public nextDispatchCount = 0;
  public pauseDispatchCount = 0;
  public errorDispatchCount = 0;
  private timeoutId: any = null;
  public static readonly QUEUE_TRANSITION_TIMEOUT_MS = 25000;

  public acquireLocks() {
    this.isWakeLockHeld = true;
    this.isWifiLockHeld = true;
  }

  public releaseLocks() {
    this.isWakeLockHeld = false;
    this.isWifiLockHeld = false;
  }

  public startQueueTransition() {
    if (this.isQueueTransitioning) {
      return; // Prevent duplicate transition starts
    }
    this.isQueueTransitioning = true;
    this.acquireLocks(); // Retain locks during transition
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      if (this.isQueueTransitioning) {
        this.isQueueTransitioning = false;
        this.releaseLocks();
      }
    }, AuraAudioServiceLockSimulator.QUEUE_TRANSITION_TIMEOUT_MS);
  }

  public cancelQueueTransition() {
    this.isQueueTransitioning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  public onPlaybackStateEnded() {
    if (this.isQueueTransitioning) {
      return; // Duplicate STATE_ENDED ignored
    }
    this.isPlaying = false;
    this.startQueueTransition();
    this.nextDispatchCount++;
    dispatchMediaAction('next');
  }

  public onIsPlayingChanged(isPlayingNow: boolean) {
    this.isPlaying = isPlayingNow;
    if (isPlayingNow) {
      this.cancelQueueTransition();
      this.acquireLocks();
    } else {
      if (!this.isQueueTransitioning) {
        this.releaseLocks();
      }
    }
  }

  public handlePlayNative() {
    this.cancelQueueTransition();
    this.onIsPlayingChanged(true);
  }

  public explicitPause() {
    this.cancelQueueTransition();
    this.isPlaying = false;
    this.releaseLocks();
    this.pauseDispatchCount++;
    dispatchMediaAction('pause');
  }

  public onPlayerError() {
    this.cancelQueueTransition();
    this.isPlaying = false;
    this.releaseLocks();
    this.errorDispatchCount++;
    dispatchMediaAction('playbackError');
  }

  public onDestroy() {
    this.cancelQueueTransition();
    this.isPlaying = false;
    this.releaseLocks();
  }
}

describe('P0-B Screen-Off Auto Queue Progression & Lock Lifecycle', () => {
  let sim: AuraAudioServiceLockSimulator;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (Capacitor.isNativePlatform as any).mockReturnValue(true);
    androidMediaBridge.init();
    sim = new AuraAudioServiceLockSimulator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('1. Natural track completion (STATE_ENDED) retains transition locks and emits next action', () => {
    // Initially playing
    sim.onIsPlayingChanged(true);
    expect(sim.isPlaying).toBe(true);
    expect(sim.isWakeLockHeld).toBe(true);
    expect(sim.isWifiLockHeld).toBe(true);

    // Track finishes naturally
    sim.onPlaybackStateEnded();

    // Player is no longer playing the old track, but locks MUST BE RETAINED for queue transition
    expect(sim.isPlaying).toBe(false);
    expect(sim.isQueueTransitioning).toBe(true);
    expect(sim.isWakeLockHeld).toBe(true);
    expect(sim.isWifiLockHeld).toBe(true);
    expect(sim.nextDispatchCount).toBe(1);

    // Simulated onIsPlayingChanged(false) arrives during transition
    sim.onIsPlayingChanged(false);
    // Locks must STILL be held!
    expect(sim.isWakeLockHeld).toBe(true);
    expect(sim.isWifiLockHeld).toBe(true);
  });

  it('2. Next track startup releases transition locks and hands over to active playback locks', () => {
    sim.onIsPlayingChanged(true);
    sim.onPlaybackStateEnded();
    expect(sim.isQueueTransitioning).toBe(true);

    // Next track starts via handlePlayNative
    sim.handlePlayNative();

    // Transition state should be cleared, active playback active, locks held
    expect(sim.isQueueTransitioning).toBe(false);
    expect(sim.isPlaying).toBe(true);
    expect(sim.isWakeLockHeld).toBe(true);
    expect(sim.isWifiLockHeld).toBe(true);
  });

  it('3. Explicit user pause cancels transition, releases all locks, and does not trigger next track', () => {
    sim.onIsPlayingChanged(true);

    // User explicitly pauses
    sim.explicitPause();

    expect(sim.isPlaying).toBe(false);
    expect(sim.isQueueTransitioning).toBe(false);
    expect(sim.isWakeLockHeld).toBe(false);
    expect(sim.isWifiLockHeld).toBe(false);
    expect(sim.pauseDispatchCount).toBe(1);
    expect(sim.nextDispatchCount).toBe(0);
  });

  it('4. Transition timeout cleanly releases locks if the next track is never dispatched', () => {
    sim.onIsPlayingChanged(true);
    sim.onPlaybackStateEnded();
    expect(sim.isQueueTransitioning).toBe(true);
    expect(sim.isWakeLockHeld).toBe(true);

    // Advance timer past the 25-second timeout window
    vi.advanceTimersByTime(26000);

    // Locks must be released to prevent battery drain
    expect(sim.isQueueTransitioning).toBe(false);
    expect(sim.isWakeLockHeld).toBe(false);
    expect(sim.isWifiLockHeld).toBe(false);
  });

  it('5. Playback error cleans up transition state and releases locks immediately', () => {
    sim.onIsPlayingChanged(true);
    sim.onPlaybackStateEnded();
    expect(sim.isQueueTransitioning).toBe(true);

    // Native playback error occurs
    sim.onPlayerError();

    expect(sim.isQueueTransitioning).toBe(false);
    expect(sim.isWakeLockHeld).toBe(false);
    expect(sim.isWifiLockHeld).toBe(false);
    expect(sim.errorDispatchCount).toBe(1);
  });

  it('6. Service destruction cleanly releases transition locks and timers', () => {
    sim.onIsPlayingChanged(true);
    sim.onPlaybackStateEnded();
    expect(sim.isQueueTransitioning).toBe(true);

    sim.onDestroy();

    expect(sim.isQueueTransitioning).toBe(false);
    expect(sim.isWakeLockHeld).toBe(false);
    expect(sim.isWifiLockHeld).toBe(false);
  });

  it('7. Duplicate STATE_ENDED events do not trigger duplicate next tracks', () => {
    sim.onIsPlayingChanged(true);

    // First STATE_ENDED
    sim.onPlaybackStateEnded();
    expect(sim.nextDispatchCount).toBe(1);

    // Duplicate STATE_ENDED while transition is active
    sim.onPlaybackStateEnded();
    expect(sim.nextDispatchCount).toBe(1); // Still 1, no duplicate next!
  });

  it('8. Existing local playback regression test: local file plays via native ExoPlayer', async () => {
    const localSong: Song = {
      id: 'local_1001',
      title: 'MassTamilan Local Song',
      artist: 'Anirudh',
      album: '3 (Original)',
      duration: 240,
      path: 'content://media/external/audio/media/1000004542',
      contentUri: 'content://media/external/audio/media/1000004542',
    } as unknown as Song;

    const playNativeSpy = vi.spyOn(androidMediaBridge, 'playNativeTrack').mockResolvedValue(undefined);
    await audioService.playSong(localSong);

    expect(audioService.isUsingNativePlayer).toBe(true);
    expect(playNativeSpy).toHaveBeenCalledWith(
      localSong,
      'content://media/external/audio/media/1000004542',
      0
    );
  });
});
