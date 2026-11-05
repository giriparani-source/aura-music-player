import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePlayerStore } from '../usePlayerStore';
import { Song } from '../../types/music';

// Mock audioService
vi.mock('../../services/audioService', () => {
  return {
    audioService: {
      playSong: vi.fn().mockResolvedValue(undefined),
      togglePlay: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn(),
      setLoop: vi.fn(),
      getCrossfadeSeconds: vi.fn().mockReturnValue(0),
      subscribe: vi.fn().mockReturnValue(() => {}),
      setOnSongEnd: vi.fn(),
      setOnMeaningfulListen: vi.fn()
    }
  };
});

// Mock sleepTimerService
vi.mock('../../services/sleepTimerService', () => ({
  sleepTimerService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getRemainingSeconds: vi.fn().mockReturnValue(null),
    getMode: vi.fn().mockReturnValue('off')
  }
}));

// Mock audioEffectsService
vi.mock('../../services/audioEffectsService', () => ({
  audioEffectsService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    isKaraokeEnabled: vi.fn().mockReturnValue(false),
    getKaraokeDepth: vi.fn().mockReturnValue(0),
    getSpatialPreset: vi.fn().mockReturnValue('off'),
    getSpatialMix: vi.fn().mockReturnValue(0),
    isLimiterEnabled: vi.fn().mockReturnValue(false),
    getBassExciterLevel: vi.fn().mockReturnValue('off'),
    isSubsonicFilterActive: vi.fn().mockReturnValue(false)
  }
}));

function createTestSong(id: string, title: string, artist = 'Test Artist'): Song {
  return {
    id,
    title,
    artist,
    album: 'Test Album',
    path: `https://test.stream/${id}.mp3`,
    filePath: `https://test.stream/${id}.mp3`,
    fileName: `${title}.mp3`,
    format: 'mp3',
    fileSize: 3000000,
    duration: 210,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    isOnline: true
  };
}

/**
 * High-fidelity gesture simulation reproducing SongRow.tsx gesture engine verbatim.
 * Reflects state, refs, touch & mouse handlers, threshold logic, and suppression timers.
 */
class SongRowGestureHarness {
  // State
  translateX = 0;
  isTransitioning = false;

  // Refs
  startX = 0;
  startY = 0;
  directionLock: 'none' | 'horizontal' | 'vertical' = 'none';
  ignoreClick = false;
  hasSwiped = false;
  isPointerDown = false;

  // Props / Store callbacks
  song: Song;
  isSelectMode: boolean;
  isUnavailable: boolean;
  onToggleSelect?: (id: string) => void;
  playSongMock = vi.fn();
  togglePlayMock = vi.fn();
  vibrateMock = vi.fn();

  // Active timers
  private timers: NodeJS.Timeout[] = [];

  constructor(song: Song, options: { isSelectMode?: boolean; isUnavailable?: boolean } = {}) {
    this.song = song;
    this.isSelectMode = options.isSelectMode ?? false;
    this.isUnavailable = options.isUnavailable ?? false;

    // Attach mock navigator.vibrate if available
    if (typeof globalThis !== 'undefined') {
      try {
        Object.defineProperty(globalThis.navigator, 'vibrate', {
          value: this.vibrateMock,
          configurable: true,
          writable: true
        });
      } catch (_) {}
    }
  }

  // Row recycling simulation
  recycleWith(newSong: Song) {
    this.song = newSong;
    this.translateX = 0;
    this.isTransitioning = false;
    this.directionLock = 'none';
  }

  // Touch Handlers
  touchStart(clientX: number, clientY: number) {
    if (this.isSelectMode || this.isUnavailable) return;
    this.startX = clientX;
    this.startY = clientY;
    this.directionLock = 'none';
    this.hasSwiped = false;
    this.isTransitioning = false;
  }

  touchMove(clientX: number, clientY: number) {
    if (this.isSelectMode || this.isUnavailable) return;
    const dx = clientX - this.startX;
    const dy = clientY - this.startY;

    if (this.directionLock === 'none') {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        this.directionLock = 'vertical';
        return;
      } else if (dx > 0) {
        this.directionLock = 'horizontal';
      } else {
        this.directionLock = 'vertical';
        return;
      }
    }

    if (this.directionLock === 'horizontal') {
      const clampedX = Math.max(0, Math.min(dx, 100));
      this.translateX = clampedX;
    }
  }

  touchEnd() {
    if (this.directionLock === 'horizontal') {
      if (this.translateX >= 75) {
        this.hasSwiped = true;
        this.ignoreClick = true;
        usePlayerStore.getState().addToUserQueue(this.song);
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(25);
          }
        } catch (_) {}
      } else if (this.translateX > 10) {
        this.ignoreClick = true;
      }
    }

    this.isTransitioning = true;
    this.translateX = 0;
    this.directionLock = 'none';

    if (this.ignoreClick) {
      const timer = setTimeout(() => {
        this.ignoreClick = false;
        this.hasSwiped = false;
      }, 300);
      this.timers.push(timer);
    }
  }

  touchCancel() {
    this.isTransitioning = true;
    this.translateX = 0;
    this.directionLock = 'none';
  }

  // Mouse Handlers
  mouseDown(clientX: number, clientY: number, button = 0, isInteractiveTarget = false) {
    if (this.isSelectMode || this.isUnavailable || button !== 0) return;
    if (isInteractiveTarget) return;

    this.startX = clientX;
    this.startY = clientY;
    this.directionLock = 'none';
    this.hasSwiped = false;
    this.isPointerDown = true;
    this.setIsTransitioning(false);
  }

  mouseMove(clientX: number, clientY: number) {
    if (!this.isPointerDown) return;
    const dx = clientX - this.startX;
    const dy = clientY - this.startY;

    if (this.directionLock === 'none') {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        this.directionLock = 'vertical';
        return;
      } else if (dx > 0) {
        this.directionLock = 'horizontal';
      } else {
        this.directionLock = 'vertical';
        return;
      }
    }

    if (this.directionLock === 'horizontal') {
      const clampedX = Math.max(0, Math.min(dx, 100));
      this.translateX = clampedX;
    }
  }

  mouseUp(clientX: number) {
    this.isPointerDown = false;
    const dx = clientX - this.startX;

    // Line 214 in SongRow.tsx:
    if (this.directionLock === 'horizontal' || dx >= 75) {
      if (dx >= 75) {
        this.hasSwiped = true;
        this.ignoreClick = true;
        usePlayerStore.getState().addToUserQueue(this.song);
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(25);
          }
        } catch (_) {}
      } else if (dx > 10) {
        this.ignoreClick = true;
      }
    }

    this.isTransitioning = true;
    this.translateX = 0;
    this.directionLock = 'none';

    if (this.ignoreClick) {
      const timer = setTimeout(() => {
        this.ignoreClick = false;
        this.hasSwiped = false;
      }, 300);
      this.timers.push(timer);
    }
  }

  // Row Click Simulation
  rowClick() {
    if (this.isUnavailable || this.ignoreClick) return;
    if (this.isSelectMode && this.onToggleSelect) {
      this.onToggleSelect(this.song.id);
    } else {
      const isCurrent = usePlayerStore.getState().currentSong?.id === this.song.id;
      if (isCurrent) {
        this.togglePlayMock();
      } else {
        this.playSongMock(this.song);
      }
    }
  }

  private setIsTransitioning(val: boolean) {
    this.isTransitioning = val;
  }

  dispose() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}

describe('Milestone 2 Gesture Mechanics Adversarial Stress Test Harness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    usePlayerStore.setState({
      queue: [],
      queueIndex: -1,
      userQueue: [],
      currentSong: null,
      isPlaying: false,
      queueToast: null
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Gesture Direction Lock Logic', () => {
    it('locks vertical scrolling when dy > dx (e.g. dy = 10, dx = 5) and leaves horizontal swipe inactive', () => {
      const song = createTestSong('song-1', 'Vertical Scroll Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(105, 110); // dx = 5, dy = 10 -> |dy| > |dx|

      expect(harness.directionLock).toBe('vertical');
      expect(harness.translateX).toBe(0);

      // Subsequent movement further right does not break vertical lock
      harness.touchMove(140, 160); // dx = 40, dy = 60
      expect(harness.directionLock).toBe('vertical');
      expect(harness.translateX).toBe(0);

      harness.touchEnd();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);
      expect(harness.hasSwiped).toBe(false);
      harness.dispose();
    });

    it('locks vertical scrolling on exact 45-degree diagonal movements (|dy| == |dx| >= 6px)', () => {
      const song = createTestSong('song-2', 'Diagonal Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(50, 50);
      harness.touchMove(60, 60); // dx = 10, dy = 10 -> |dy| >= |dx|

      expect(harness.directionLock).toBe('vertical');
      expect(harness.translateX).toBe(0);

      harness.touchEnd();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);
      harness.dispose();
    });

    it('activates horizontal swipe when dx > dy (e.g. dx = 20, dy = 5)', () => {
      const song = createTestSong('song-3', 'Horizontal Swipe Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(120, 105); // dx = 20, dy = 5 -> |dx| > |dy| and dx > 0

      expect(harness.directionLock).toBe('horizontal');
      expect(harness.translateX).toBe(20);

      harness.dispose();
    });

    it('remains unlocked in neutral slop when movements are below 6px threshold', () => {
      const song = createTestSong('song-4', 'Jitter Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(104, 103); // dx = 4, dy = 3 -> < 6px

      expect(harness.directionLock).toBe('none');
      expect(harness.translateX).toBe(0);

      harness.touchMove(105, 105); // dx = 5, dy = 5 -> < 6px
      expect(harness.directionLock).toBe('none');
      expect(harness.translateX).toBe(0);

      harness.dispose();
    });
  });

  describe('2. Threshold Triggering & Clamping Logic', () => {
    it('triggers addToUserQueue when released past 75px threshold (e.g. dx = 80px)', () => {
      const song = createTestSong('song-5', 'Queue Me Song');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(180, 100); // dx = 80, dy = 0

      expect(harness.directionLock).toBe('horizontal');
      expect(harness.translateX).toBe(80);

      harness.touchEnd();

      // Verify song added to user queue
      const state = usePlayerStore.getState();
      expect(state.userQueue).toHaveLength(1);
      expect(state.userQueue[0].id).toBe('song-5');
      expect(state.userQueue[0].isUserQueued).toBe(true);
      expect(state.queueToast?.open).toBe(true);
      expect(state.queueToast?.songTitle).toBe('Queue Me Song');

      // Verify harness reset
      expect(harness.translateX).toBe(0);
      expect(harness.isTransitioning).toBe(true);
      expect(harness.hasSwiped).toBe(true);
      expect(harness.ignoreClick).toBe(true);

      harness.dispose();
    });

    it('does NOT trigger queueing when released below threshold (e.g. dx = 50px) and resets to 0', () => {
      const song = createTestSong('song-6', 'Abort Swipe Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(150, 100); // dx = 50, dy = 0

      expect(harness.translateX).toBe(50);
      harness.touchEnd();

      expect(usePlayerStore.getState().userQueue).toHaveLength(0);
      expect(harness.translateX).toBe(0);
      expect(harness.isTransitioning).toBe(true);
      expect(harness.hasSwiped).toBe(false);
      // Because dx was 50 (> 10), click is still suppressed to avoid accidental playback
      expect(harness.ignoreClick).toBe(true);

      harness.dispose();
    });

    it('strictly tests the 74px vs 75px exact threshold boundary', () => {
      const song74 = createTestSong('song-74', '74px Boundary');
      const harness74 = new SongRowGestureHarness(song74);

      harness74.touchStart(100, 100);
      harness74.touchMove(174, 100); // dx = 74
      expect(harness74.translateX).toBe(74);
      harness74.touchEnd();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);
      harness74.dispose();

      const song75 = createTestSong('song-75', '75px Boundary');
      const harness75 = new SongRowGestureHarness(song75);

      harness75.touchStart(100, 100);
      harness75.touchMove(175, 100); // dx = 75
      expect(harness75.translateX).toBe(75);
      harness75.touchEnd();
      expect(usePlayerStore.getState().userQueue).toHaveLength(1);
      expect(usePlayerStore.getState().userQueue[0].id).toBe('song-75');
      harness75.dispose();
    });

    it('clamps left swipe (dx = -50px) to 0 (no left swipe allowed)', () => {
      const song = createTestSong('song-7', 'Left Swipe Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(50, 100); // dx = -50, dy = 0

      // dx < 0 locks to vertical and never produces negative translateX
      expect(harness.directionLock).toBe('vertical');
      expect(harness.translateX).toBe(0);

      harness.touchEnd();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);
      harness.dispose();
    });

    it('clamps reversed right-to-left swipe at Math.max(0, dx)', () => {
      const song = createTestSong('song-8', 'Reversed Swipe Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(130, 100); // dx = 30 -> horizontal lock
      expect(harness.directionLock).toBe('horizontal');
      expect(harness.translateX).toBe(30);

      // Now user sweeps back to negative territory
      harness.touchMove(60, 100); // dx = -40
      expect(harness.translateX).toBe(0); // clamped to Math.max(0, -40)

      harness.touchEnd();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);
      harness.dispose();
    });

    it('clamps overswipe to maximum 100px displacement', () => {
      const song = createTestSong('song-9', 'Overswipe Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(350, 100); // dx = 250px!
      expect(harness.translateX).toBe(100); // Clamped at 100

      harness.touchEnd();
      expect(usePlayerStore.getState().userQueue).toHaveLength(1);
      harness.dispose();
    });
  });

  describe('3. Synthetic Click Suppression & Timers', () => {
    it('suppresses click playback immediately after successful swipe release', () => {
      const song = createTestSong('song-10', 'Suppressed Click Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(185, 100);
      harness.touchEnd();

      expect(harness.ignoreClick).toBe(true);

      // Browser fires synthetic click right after touchend
      harness.rowClick();

      // Playback was suppressed!
      expect(harness.playSongMock).not.toHaveBeenCalled();
      expect(harness.togglePlayMock).not.toHaveBeenCalled();

      // After 300ms, ignoreClick expires
      vi.advanceTimersByTime(300);
      expect(harness.ignoreClick).toBe(false);

      // Subsequent deliberate click now works
      harness.rowClick();
      expect(harness.playSongMock).toHaveBeenCalledWith(song);

      harness.dispose();
    });

    it('suppresses click playback after partial drag (> 10px) that was aborted', () => {
      const song = createTestSong('song-11', 'Aborted Drag Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(125, 100); // dx = 25
      harness.touchEnd();

      expect(harness.ignoreClick).toBe(true);

      harness.rowClick();
      expect(harness.playSongMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(harness.ignoreClick).toBe(false);
      harness.dispose();
    });

    it('does NOT suppress click playback on stationary tap without swipe (dx <= 10px)', () => {
      const song = createTestSong('song-12', 'Clean Tap Track');
      const harness = new SongRowGestureHarness(song);

      harness.touchStart(100, 100);
      harness.touchMove(102, 101); // dx = 2, dy = 1 (< 6px slop)
      harness.touchEnd();

      expect(harness.ignoreClick).toBe(false);

      harness.rowClick();
      expect(harness.playSongMock).toHaveBeenCalledWith(song);
      harness.dispose();
    });
  });

  describe('4. Mouse Drag Interaction & Edge Case Analysis', () => {
    it('handles mouse drag to queue when swiped horizontally past 75px', () => {
      const song = createTestSong('song-13', 'Mouse Drag Track');
      const harness = new SongRowGestureHarness(song);

      harness.mouseDown(100, 100, 0, false);
      harness.mouseMove(190, 100); // dx = 90
      expect(harness.directionLock).toBe('horizontal');
      expect(harness.translateX).toBe(90);

      harness.mouseUp(190);
      expect(usePlayerStore.getState().userQueue).toHaveLength(1);
      expect(harness.ignoreClick).toBe(true);

      harness.rowClick();
      expect(harness.playSongMock).not.toHaveBeenCalled();

      harness.dispose();
    });

    it('ignores mouse drag when right-clicked (button != 0)', () => {
      const song = createTestSong('song-14', 'Right Click Track');
      const harness = new SongRowGestureHarness(song);

      harness.mouseDown(100, 100, 2, false); // Right click
      expect(harness.isPointerDown).toBe(false);

      harness.mouseMove(190, 100);
      expect(harness.translateX).toBe(0);

      harness.dispose();
    });

    it('ignores mouse drag when mousedown originates on interactive element (button/menu)', () => {
      const song = createTestSong('song-15', 'Button Click Track');
      const harness = new SongRowGestureHarness(song);

      harness.mouseDown(100, 100, 0, true); // clicked on child button
      expect(harness.isPointerDown).toBe(false);

      harness.mouseMove(190, 100);
      expect(harness.translateX).toBe(0);

      harness.dispose();
    });

    /**
     * EMPIRICAL FINDING: SongRow.tsx line 214 discrepancy analysis:
     * `if (directionLockRef.current === 'horizontal' || dx >= 75)`
     * In mouse mode, if a user starts dragging vertically down (locking direction to 'vertical'),
     * but during the drag releases at dx >= 75:
     * Touch mode: DOES NOT queue (strict check `directionLockRef.current === 'horizontal'`).
     * Mouse mode: DOES queue because `dx >= 75` is true regardless of direction lock!
     */
    it('CHALLENGE: checks behavior when user drags vertically first then releases at dx >= 75 in mouse vs touch', () => {
      const touchSong = createTestSong('song-touch', 'Touch Diagonal Track');
      const touchHarness = new SongRowGestureHarness(touchSong);

      touchHarness.touchStart(100, 100);
      touchHarness.touchMove(105, 120); // dx = 5, dy = 20 -> locked to vertical
      expect(touchHarness.directionLock).toBe('vertical');
      touchHarness.touchMove(180, 200); // dx = 80, dy = 100 -> still locked vertical
      expect(touchHarness.translateX).toBe(0);
      touchHarness.touchEnd();

      // Touch strictly enforces horizontal lock: track is NOT queued
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);
      touchHarness.dispose();

      // Now mouse behavior:
      const mouseSong = createTestSong('song-mouse', 'Mouse Diagonal Track');
      const mouseHarness = new SongRowGestureHarness(mouseSong);

      mouseHarness.mouseDown(100, 100, 0, false);
      mouseHarness.mouseMove(105, 120); // dx = 5, dy = 20 -> locked to vertical
      expect(mouseHarness.directionLock).toBe('vertical');
      expect(mouseHarness.translateX).toBe(0); // Row did NOT visually move

      // At mouse up, dx is 80 (>= 75)
      mouseHarness.mouseUp(180);

      // In SongRow.tsx line 214, `|| dx >= 75` evaluates to true:
      const userQueue = usePlayerStore.getState().userQueue;
      // We observe that mouse mode enqueues due to the `|| dx >= 75` fallback!
      expect(userQueue).toHaveLength(1);
      expect(userQueue[0].id).toBe('song-mouse');

      mouseHarness.dispose();
    });
  });

  describe('5. Row Recycling & Disabled States', () => {
    it('resets displacement and direction lock when virtual row is recycled for a new song', () => {
      const songA = createTestSong('song-a', 'Original Track');
      const harness = new SongRowGestureHarness(songA);

      harness.touchStart(100, 100);
      harness.touchMove(140, 100); // dx = 40
      expect(harness.translateX).toBe(40);
      expect(harness.directionLock).toBe('horizontal');

      // Virtualizer recycles the component for songB without unmounting
      const songB = createTestSong('song-b', 'Recycled Track');
      harness.recycleWith(songB);

      expect(harness.translateX).toBe(0);
      expect(harness.directionLock).toBe('none');
      expect(harness.song.id).toBe('song-b');

      harness.dispose();
    });

    it('completely disables swipe gestures and click playback when isUnavailable is true', () => {
      const song = createTestSong('song-unavail', 'Unavailable Track');
      const harness = new SongRowGestureHarness(song, { isUnavailable: true });

      harness.touchStart(100, 100);
      harness.touchMove(190, 100);
      expect(harness.translateX).toBe(0);
      harness.touchEnd();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);

      harness.rowClick();
      expect(harness.playSongMock).not.toHaveBeenCalled();

      harness.dispose();
    });

    it('completely disables swipe gestures when isSelectMode is active', () => {
      const song = createTestSong('song-select', 'Select Mode Track');
      const harness = new SongRowGestureHarness(song, { isSelectMode: true });

      harness.touchStart(100, 100);
      harness.touchMove(190, 100);
      expect(harness.translateX).toBe(0);
      harness.touchEnd();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);

      harness.dispose();
    });
  });

  describe('6. 1,000 Fuzz Trajectories Stress Harness', () => {
    it('survives 1,000 random touch trajectories without state corruption', () => {
      const song = createTestSong('song-fuzz', 'Fuzz Track');
      const harness = new SongRowGestureHarness(song);

      let successfulQueues = 0;

      for (let i = 0; i < 1000; i++) {
        // Random start
        const startX = Math.floor(Math.random() * 500);
        const startY = Math.floor(Math.random() * 500);
        harness.touchStart(startX, startY);

        // Generate between 1 and 10 move points
        const numMoves = 1 + Math.floor(Math.random() * 10);
        let currentX = startX;
        let currentY = startY;

        for (let j = 0; j < numMoves; j++) {
          // Delta between -150 and +150
          const deltaX = Math.floor(Math.random() * 300) - 150;
          const deltaY = Math.floor(Math.random() * 300) - 150;
          currentX = startX + deltaX;
          currentY = startY + deltaY;
          harness.touchMove(currentX, currentY);

          // Clamping invariant: translateX must always be in [0, 100]
          expect(harness.translateX).toBeGreaterThanOrEqual(0);
          expect(harness.translateX).toBeLessThanOrEqual(100);
        }

        const wasHorizontal = harness.directionLock === 'horizontal';
        const finalTranslate = harness.translateX;

        harness.touchEnd();

        // Invariant: translateX must reset to 0 upon release
        expect(harness.translateX).toBe(0);
        expect(harness.directionLock).toBe('none');

        if (wasHorizontal && finalTranslate >= 75) {
          successfulQueues++;
        }
      }

      // Check userQueue length matches exactly the number of valid >=75 horizontal releases
      expect(usePlayerStore.getState().userQueue.length).toBe(successfulQueues);

      harness.dispose();
    });
  });
});
