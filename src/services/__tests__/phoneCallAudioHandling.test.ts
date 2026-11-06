import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { androidMediaBridge, dispatchMediaAction } from '../androidMediaBridge';
import { usePlayerStore } from '../../store/usePlayerStore';
import { audioService } from '../audioService';
import { Song } from '../../types/music';

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
 * Exact Native Android Audio Service Simulator
 * Faithfully mirrors AuraAudioService.java lifecycle, AudioManager focus changes,
 * WakeLock / WifiLock bounds, and long phone call recovery logic.
 */
class AuraAudioServicePhoneCallSimulator {
  public isPlaying = false;
  public isNativePlayerActive = false;
  public isWakeLockHeld = false;
  public isWifiLockHeld = false;
  public isQueueTransitioning = false;

  // Phone Call & Audio Focus State
  public wasPlayingBeforeCall = false;
  public isPausedByCall = false;
  public savedPositionBeforeCall = -1;
  public currentPositionMs = 0;
  public trackDurationMs = 240000; // 4 minutes
  public callStartTimeMs = 0;
  public exoPlayerState: 'IDLE' | 'BUFFERING' | 'READY' | 'ENDED' = 'READY';

  public playNativeTrack(trackDurationMs: number, startPositionMs = 0) {
    this.isQueueTransitioning = false;
    this.wasPlayingBeforeCall = false;
    this.isPausedByCall = false;
    this.savedPositionBeforeCall = -1;
    this.trackDurationMs = trackDurationMs;
    this.currentPositionMs = startPositionMs;
    this.isPlaying = true;
    this.isNativePlayerActive = true;
    this.exoPlayerState = 'READY';
    this.acquireLocks();
  }

  public acquireLocks() {
    this.isWakeLockHeld = true;
    this.isWifiLockHeld = true;
  }

  public releaseLocks() {
    this.isWakeLockHeld = false;
    this.isWifiLockHeld = false;
  }

  public startQueueTransition() {
    if (this.isQueueTransitioning) return;
    this.isQueueTransitioning = true;
    this.acquireLocks();
  }

  public cancelQueueTransition() {
    this.isQueueTransitioning = false;
  }

  // User manually pauses via UI, notification, or headset
  public userManualPause() {
    this.cancelQueueTransition();
    this.wasPlayingBeforeCall = false;
    this.isPausedByCall = false;
    this.isPlaying = false;
    this.releaseLocks();
    dispatchMediaAction('pause');
  }

  // User manually plays via UI, notification, or headset
  public userManualPlay() {
    this.cancelQueueTransition();
    this.wasPlayingBeforeCall = false;
    this.isPausedByCall = false;
    this.isPlaying = true;
    this.acquireLocks();
    dispatchMediaAction('play');
  }

  // Incoming or Outgoing Call: Transient Audio Focus Loss
  public onAudioFocusLossTransient() {
    if (this.currentPositionMs > 0) {
      this.savedPositionBeforeCall = this.currentPositionMs;
    }

    if (this.isPlaying) {
      this.wasPlayingBeforeCall = true;
      this.isPausedByCall = true;
      this.callStartTimeMs = Date.now();
      this.isPlaying = false;
      // Note: Locks are kept during call interruption to prevent OS service kill
      dispatchMediaAction('call_pause', this.savedPositionBeforeCall / 1000.0);
    } else {
      // User was already paused manually: Requirement 5
      this.wasPlayingBeforeCall = false;
      this.isPausedByCall = false;
    }
  }

  // Call Ends: Audio Focus Gained
  public onAudioFocusGain(callDurationSeconds = 10) {
    if (this.isPausedByCall && this.wasPlayingBeforeCall) {
      const resumePos = this.savedPositionBeforeCall;
      this.isPausedByCall = false;
      this.wasPlayingBeforeCall = false;

      // Simulate socket timeout if call was long (e.g. >= 60s)
      if (callDurationSeconds >= 60) {
        this.exoPlayerState = 'IDLE'; // Socket dropped during 1-hour call
      }

      this.resumePlaybackAfterCall(resumePos);
    } else {
      // Ignored: was paused before or during call
      this.isPausedByCall = false;
      this.wasPlayingBeforeCall = false;
    }
  }

  public resumePlaybackAfterCall(targetPositionMs: number) {
    this.acquireLocks();

    // Re-prepare if in IDLE state after long call
    if (this.exoPlayerState === 'IDLE') {
      this.exoPlayerState = 'READY';
    }

    this.currentPositionMs = targetPositionMs;
    this.isPlaying = true;
    dispatchMediaAction('call_resume', targetPositionMs / 1000.0);
  }

  // ExoPlayer State Ended Guard
  public onPlaybackStateEnded() {
    if (this.isQueueTransitioning) return;

    // GUARD 1: If paused by call, ignore premature EOF / socket drops
    if (this.isPausedByCall || this.wasPlayingBeforeCall) {
      return;
    }

    // GUARD 2: Premature EOF check (e.g. at 65s of a 240s song)
    if (this.trackDurationMs > 5000 && this.currentPositionMs < (this.trackDurationMs - 2500)) {
      this.resumePlaybackAfterCall(this.currentPositionMs > 0 ? this.currentPositionMs : this.savedPositionBeforeCall);
      return;
    }

    // Natural end of track -> advance queue
    this.isPlaying = false;
    this.startQueueTransition();
    dispatchMediaAction('next');
  }

  public stopNative() {
    this.isNativePlayerActive = false;
    if (!this.isQueueTransitioning) {
      this.releaseLocks();
    }
  }
}

describe('Aura Music Player Android Background Playback & Phone Call Handling', () => {
  let sim: AuraAudioServicePhoneCallSimulator;

  const mockSong1: Song = {
    id: 'track-101',
    title: 'Enna Solla Pogirai',
    artist: 'Shankar Mahadevan, A. R. Rahman',
    album: 'Kandukondain Kandukondain',
    duration: 360,
    path: '/online/track-101.mp3',
    filePath: '/online/track-101.mp3',
    fileName: 'track-101.mp3',
    format: 'mp3',
    fileSize: 5000000,
    dateAdded: 1700000000,
    playCount: 1,
    isFavorite: false,
    isOnline: true,
  };

  const mockSong2: Song = {
    id: 'track-102',
    title: 'Sandai Kozhi',
    artist: 'A.R. Rahman, Madhushree',
    album: 'Aayutha Ezhuthu',
    duration: 296,
    path: '/online/track-102.mp3',
    filePath: '/online/track-102.mp3',
    fileName: 'track-102.mp3',
    format: 'mp3',
    fileSize: 4500000,
    dateAdded: 1700000000,
    playCount: 1,
    isFavorite: false,
    isOnline: true,
  };

  const mockSong3: Song = {
    id: 'track-103',
    title: 'Azhagana Rakshasiye',
    artist: 'Harini, S. P. Balasubrahmanyam',
    album: 'Mudhalvan',
    duration: 368,
    path: '/online/track-103.mp3',
    filePath: '/online/track-103.mp3',
    fileName: 'track-103.mp3',
    format: 'mp3',
    fileSize: 5200000,
    dateAdded: 1700000000,
    playCount: 1,
    isFavorite: false,
    isOnline: true,
  };

  beforeEach(() => {
    sim = new AuraAudioServicePhoneCallSimulator();
    androidMediaBridge.init();

    // Reset store state
    usePlayerStore.setState({
      currentSong: null,
      queue: [],
      userQueue: [],
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isShuffle: false,
      repeatMode: 'off',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Requirement 1: Screen-Off / Locked Continuous Playback & Queue Progression
  // =========================================================================
  describe('Requirement 1: Continuous Playback When Screen Is OFF or Locked', () => {
    it('keeps WakeLock and WifiLock held during screen-off queue transition without stall', () => {
      usePlayerStore.setState({
        currentSong: mockSong1,
        queue: [mockSong1, mockSong2, mockSong3],
        queueIndex: 0,
        isPlaying: true,
      });

      sim.playNativeTrack(360000, 359000); // 1s before end
      expect(sim.isPlaying).toBe(true);
      expect(sim.isWakeLockHeld).toBe(true);
      expect(sim.isWifiLockHeld).toBe(true);

      // Song 1 finishes naturally
      sim.currentPositionMs = 360000;
      sim.onPlaybackStateEnded();

      // Transition started: locks MUST be retained while fetching next track
      expect(sim.isQueueTransitioning).toBe(true);
      expect(sim.isWakeLockHeld).toBe(true);
      expect(sim.isWifiLockHeld).toBe(true);

      // Next track in queue is triggered
      expect(usePlayerStore.getState().currentSong?.id).toBe(mockSong2.id);

      // Native stop received during transition does NOT drop locks
      sim.stopNative();
      expect(sim.isWakeLockHeld).toBe(true);
      expect(sim.isWifiLockHeld).toBe(true);

      // Track 2 starts playing natively
      sim.playNativeTrack(296000, 0);
      expect(sim.isPlaying).toBe(true);
      expect(sim.isQueueTransitioning).toBe(false);
      expect(sim.isWakeLockHeld).toBe(true);
    });

    it('plays all queued songs continuously to the end of the queue', async () => {
      // Allow debounce window from previous test to elapse
      await new Promise((r) => setTimeout(r, 350));

      usePlayerStore.setState({
        currentSong: mockSong1,
        queue: [mockSong1, mockSong2, mockSong3],
        queueIndex: 0,
        isPlaying: true,
      });

      sim.playNativeTrack(360000, 360000);

      // End of song 1 -> advances to song 2
      sim.onPlaybackStateEnded();
      expect(usePlayerStore.getState().currentSong?.id).toBe(mockSong2.id);

      // Allow debounce window before song 2 completion
      await new Promise((r) => setTimeout(r, 350));

      // End of song 2 -> advances to song 3
      sim.playNativeTrack(296000, 296000);
      sim.onPlaybackStateEnded();
      expect(usePlayerStore.getState().currentSong?.id).toBe(mockSong3.id);
    });
  });

  // =========================================================================
  // Requirement 2: Automatic Pause on Incoming/Outgoing Phone Calls
  // =========================================================================
  describe('Requirement 2: Automatic Pause on Phone Call', () => {
    it('automatically pauses music immediately when incoming or outgoing call occurs', () => {
      usePlayerStore.setState({
        currentSong: mockSong1,
        isPlaying: true,
        currentTime: 78.5,
      });

      sim.playNativeTrack(360000, 78500); // 78.5s in
      expect(sim.isPlaying).toBe(true);

      // Incoming call arrives (AUDIOFOCUS_LOSS_TRANSIENT)
      sim.onAudioFocusLossTransient();

      expect(sim.isPlaying).toBe(false);
      expect(sim.isPausedByCall).toBe(true);
      expect(sim.wasPlayingBeforeCall).toBe(true);
      expect(sim.savedPositionBeforeCall).toBe(78500);

      // Store reflects paused state with exact timestamp preserved
      expect(usePlayerStore.getState().isPlaying).toBe(false);
      expect(usePlayerStore.getState().currentTime).toBe(78.5);
    });
  });

  // =========================================================================
  // Requirement 3: Resume From Exact Position Even If Call Lasted 1 Hour
  // =========================================================================
  describe('Requirement 3: Resume from Exact Position After 1-Hour Call', () => {
    it('resumes from exact millisecond position without restarting after a 1-hour phone call', () => {
      const exactPausePosMs = 143250; // 2 minutes 23.25 seconds
      usePlayerStore.setState({
        currentSong: mockSong1,
        isPlaying: true,
        currentTime: 143.25,
      });

      sim.playNativeTrack(360000, exactPausePosMs);

      // Call arrives
      sim.onAudioFocusLossTransient();
      expect(sim.isPausedByCall).toBe(true);
      expect(sim.savedPositionBeforeCall).toBe(exactPausePosMs);

      // Simulate 1 hour phone conversation (3600 seconds)
      const callDurationSec = 3600;

      // Call ends -> AUDIOFOCUS_GAIN
      sim.onAudioFocusGain(callDurationSec);

      // Must be playing again
      expect(sim.isPlaying).toBe(true);
      // Position MUST be the exact position, NOT 0:00!
      expect(sim.currentPositionMs).toBe(exactPausePosMs);
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(usePlayerStore.getState().currentTime).toBe(143.25);
    });
  });

  // =========================================================================
  // Requirement 4: Never Restart Song or Skip Tracks After a Call
  // =========================================================================
  describe('Requirement 4: Never Restart or Skip Tracks After Call', () => {
    it('does NOT skip track if socket dropped or premature EOF occurred during call', () => {
      usePlayerStore.setState({
        currentSong: mockSong1,
        queue: [mockSong1, mockSong2, mockSong3],
        isPlaying: true,
        currentTime: 65,
      });

      sim.playNativeTrack(360000, 65000);
      sim.onAudioFocusLossTransient();

      // ExoPlayer fires premature STATE_ENDED during call due to network socket drop
      sim.onPlaybackStateEnded();

      // Must NOT skip to track 2
      expect(usePlayerStore.getState().currentSong?.id).toBe(mockSong1.id);

      // Now call ends
      sim.onAudioFocusGain(1800); // 30 min call

      // Socket error re-triggers premature STATE_ENDED at 65s of 360s track
      sim.onPlaybackStateEnded();

      // Must NOT skip to track 2; song remains mockSong1 and position remains 65s!
      expect(usePlayerStore.getState().currentSong?.id).toBe(mockSong1.id);
      expect(sim.currentPositionMs).toBe(65000);
    });
  });

  // =========================================================================
  // Requirement 5: If Manually Paused Before Call, Do NOT Auto-Resume
  // =========================================================================
  describe('Requirement 5: Manual Pause Protection', () => {
    it('does NOT auto-resume when call ends if user manually paused BEFORE the call', () => {
      usePlayerStore.setState({
        currentSong: mockSong1,
        isPlaying: false, // User manually paused!
        currentTime: 50,
      });

      sim.playNativeTrack(360000, 50000);
      sim.userManualPause();
      expect(sim.isPlaying).toBe(false);
      expect(sim.wasPlayingBeforeCall).toBe(false);

      // Phone call occurs while music is already paused
      sim.onAudioFocusLossTransient();
      expect(sim.isPausedByCall).toBe(false);
      expect(sim.wasPlayingBeforeCall).toBe(false);

      // Call ends (AUDIOFOCUS_GAIN)
      sim.onAudioFocusGain(300);

      // Music MUST remain paused!
      expect(sim.isPlaying).toBe(false);
      expect(usePlayerStore.getState().isPlaying).toBe(false);
      expect(usePlayerStore.getState().currentTime).toBe(50);
    });

    it('does NOT auto-resume if user pressed pause DURING the call', () => {
      usePlayerStore.setState({
        currentSong: mockSong1,
        isPlaying: true,
        currentTime: 80,
      });

      sim.playNativeTrack(360000, 80000);

      // Call starts
      sim.onAudioFocusLossTransient();
      expect(sim.isPausedByCall).toBe(true);

      // While on call, user clicks Pause in notification or UI
      sim.userManualPause();
      expect(sim.isPausedByCall).toBe(false);
      expect(sim.wasPlayingBeforeCall).toBe(false);

      // Call ends
      sim.onAudioFocusGain(600);

      // Music MUST remain paused!
      expect(sim.isPlaying).toBe(false);
      expect(usePlayerStore.getState().isPlaying).toBe(false);
    });
  });

  // =========================================================================
  // Requirement 6: Preserve Queue, Shuffle, Repeat, Background & Lockscreen
  // =========================================================================
  describe('Requirement 6: Feature Preservation', () => {
    it('preserves entire queue, user queue priority, shuffle state, and repeat mode across call', () => {
      usePlayerStore.setState({
        currentSong: mockSong1,
        userQueue: [{ ...mockSong2, queueItemId: 'uq-test-2', addedAt: Date.now(), isUserQueued: true }],
        queue: [mockSong1, mockSong3],
        isShuffle: true,
        repeatMode: 'all',
        isPlaying: true,
        currentTime: 120,
      });

      sim.playNativeTrack(360000, 120000);

      // Call starts and ends
      sim.onAudioFocusLossTransient();
      sim.onAudioFocusGain(120);

      const state = usePlayerStore.getState();
      expect(state.currentSong?.id).toBe(mockSong1.id);
      expect(state.userQueue).toHaveLength(1);
      expect(state.userQueue[0].id).toBe(mockSong2.id);
      expect(state.queue).toHaveLength(2);
      expect(state.isShuffle).toBe(true);
      expect(state.repeatMode).toBe('all');
      expect(state.isPlaying).toBe(true);
      expect(state.currentTime).toBe(120);
    });

    it('handles call_recovery_reload without corrupting playback position', () => {
      usePlayerStore.setState({
        currentSong: mockSong1,
        isPlaying: false,
        currentTime: 210.5,
      });

      const seekSpy = vi.spyOn(audioService, 'seek');
      const resumeSpy = vi.spyOn(audioService, 'resume').mockImplementation(async () => {});

      dispatchMediaAction('call_recovery_reload', 210.5);

      expect(seekSpy).toHaveBeenCalledWith(210.5);
      expect(resumeSpy).toHaveBeenCalled();
    });
  });
});
