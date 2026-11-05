import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePlayerStore } from '../usePlayerStore';
import { useLibraryStore } from '../useLibraryStore';
import { Song } from '../../types/music';
import {
  pushBackButtonHandler,
  registerBackButtonHandler,
  BackButtonCallback
} from '../../services/androidMediaBridge';

// Mock audioService
vi.mock('../../services/audioService', () => ({
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
    setOnMeaningfulListen: vi.fn(),
    isUsingNativePlayer: false
  }
}));

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

function createTestSong(id: string, title: string): Song {
  return {
    id,
    title,
    artist: 'Challenger Artist',
    album: 'Challenger Album',
    path: `https://test.stream/${id}.mp3`,
    filePath: `https://test.stream/${id}.mp3`,
    fileName: `${title}.mp3`,
    format: 'mp3',
    fileSize: 3200000,
    duration: 180,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    isOnline: true
  };
}

/**
 * W3C Level 3 DOM KeyboardEvent mock supporting key, code, and propagation control.
 */
class MockKeyboardEvent {
  public type: string;
  public key: string;
  public code: string;
  public bubbles: boolean;
  public cancelable: boolean;
  public defaultPrevented: boolean = false;
  public propagationStopped: boolean = false;
  public immediatePropagationStopped: boolean = false;

  constructor(
    type: string,
    eventInitDict?: { key?: string; code?: string; bubbles?: boolean; cancelable?: boolean }
  ) {
    this.type = type;
    this.key = eventInitDict?.key || '';
    // Standard browsers default code to key if Escape is pressed, or preserve explicit code
    this.code = eventInitDict?.code !== undefined ? eventInitDict.code : (eventInitDict?.key === 'Escape' ? 'Escape' : '');
    this.bubbles = eventInitDict?.bubbles ?? true;
    this.cancelable = eventInitDict?.cancelable ?? true;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.immediatePropagationStopped = true;
    this.propagationStopped = true;
  }
}

/**
 * W3C Level 3 EventTarget simulating window DOM event dispatch:
 * 1. Capture phase: executes all listeners registered with { capture: true } in registration order.
 * 2. If stopImmediatePropagation() is called, halts immediately.
 * 3. Bubble phase: executes all listeners registered with { capture: false } in registration order,
 *    unless stopPropagation() was called.
 */
class MockDOMWindow {
  private captureListeners = new Map<string, Array<(e: any) => void>>();
  private bubbleListeners = new Map<string, Array<(e: any) => void>>();

  addEventListener(
    type: string,
    listener: (e: any) => void,
    options?: boolean | { capture?: boolean }
  ) {
    const isCapture = typeof options === 'boolean' ? options : !!(options && options.capture);
    const store = isCapture ? this.captureListeners : this.bubbleListeners;
    if (!store.has(type)) store.set(type, []);
    store.get(type)!.push(listener);
  }

  removeEventListener(
    type: string,
    listener: (e: any) => void,
    options?: boolean | { capture?: boolean }
  ) {
    const isCapture = typeof options === 'boolean' ? options : !!(options && options.capture);
    const store = isCapture ? this.captureListeners : this.bubbleListeners;
    if (!store.has(type)) return;
    store.set(type, store.get(type)!.filter((l) => l !== listener));
  }

  dispatchEvent(event: MockKeyboardEvent): boolean {
    // 1. Capture phase
    const captureList = [...(this.captureListeners.get(event.type) || [])];
    for (const listener of captureList) {
      if (event.immediatePropagationStopped) break;
      listener(event);
    }

    if (event.propagationStopped || event.immediatePropagationStopped) {
      return !event.defaultPrevented;
    }

    // 2. Bubble phase
    const bubbleList = [...(this.bubbleListeners.get(event.type) || [])];
    for (const listener of bubbleList) {
      if (event.immediatePropagationStopped) break;
      listener(event);
    }

    return !event.defaultPrevented;
  }

  getListenerCounts(type: string): { capture: number; bubble: number } {
    return {
      capture: (this.captureListeners.get(type) || []).length,
      bubble: (this.bubbleListeners.get(type) || []).length
    };
  }

  reset() {
    this.captureListeners.clear();
    this.bubbleListeners.clear();
  }
}

interface MockActiveElement {
  tagName: string;
}

interface MockDocument {
  activeElement: MockActiveElement | null;
}

describe('Milestone 3 Remediation Challenger: Keyboard Hierarchy & DOM Event Propagation Suite', () => {
  let mockWindow: MockDOMWindow;
  let mockDocument: MockDocument;
  let originalWindow: any;
  let originalDocument: any;
  let originalKeyboardEvent: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWindow = new MockDOMWindow();
    mockDocument = { activeElement: null };

    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    originalKeyboardEvent = (globalThis as any).KeyboardEvent;

    (globalThis as any).window = mockWindow;
    (globalThis as any).document = mockDocument;
    (globalThis as any).KeyboardEvent = MockKeyboardEvent;

    usePlayerStore.setState({
      currentSong: createTestSong('active_song', 'Active Track'),
      isPlaying: true,
      currentTime: 10,
      duration: 180,
      queue: [createTestSong('active_song', 'Active Track'), createTestSong('next_song', 'Next Track')],
      queueIndex: 0,
      userQueue: [createTestSong('u1', 'User Track 1') as any],
      isQueueOpen: false,
      isNowPlayingOpen: false,
      activeModalTab: 'artwork'
    });

    useLibraryStore.setState({
      activePlaylistId: null,
      playlists: [],
      activeTab: 'home',
      searchQuery: ''
    });
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).KeyboardEvent = originalKeyboardEvent;
  });

  /**
   * Helper simulating MainLayout.tsx keyboard listener lifecycle (lines 250-301)
   */
  function mountMainLayoutKeyboardListener() {
    const handleKeyDown = (e: any) => {
      if (
        mockDocument.activeElement?.tagName === 'INPUT' ||
        mockDocument.activeElement?.tagName === 'TEXTAREA' ||
        mockDocument.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      const curTime = usePlayerStore.getState().currentTime || 0;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          usePlayerStore.getState().togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          usePlayerStore.getState().seek(curTime + 5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          usePlayerStore.getState().seek(Math.max(0, curTime - 5));
          break;
        case 'KeyN':
          e.preventDefault();
          usePlayerStore.getState().nextSong();
          break;
        case 'KeyP':
          e.preventDefault();
          usePlayerStore.getState().previousSong();
          break;
        case 'Escape':
          const state = usePlayerStore.getState();
          if (state.isQueueOpen) {
            state.setQueueOpen(false);
          } else if (state.isNowPlayingOpen) {
            state.setNowPlayingOpen(false);
          }
          break;
      }
    };

    mockWindow.addEventListener('keydown', handleKeyDown);
    return () => mockWindow.removeEventListener('keydown', handleKeyDown);
  }

  /**
   * Helper simulating ClearQueueDialog lifecycle (QueueSheet.tsx:97-121)
   */
  function mountClearQueueDialog(isOpen: boolean, onClose: () => void) {
    if (!isOpen) return () => {};

    const unregisterBack = pushBackButtonHandler(() => {
      onClose();
      return true;
    });

    const handleKeyDown = (e: any) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    // Registered with capture phase (true)
    mockWindow.addEventListener('keydown', handleKeyDown, true);

    return () => {
      unregisterBack();
      mockWindow.removeEventListener('keydown', handleKeyDown, true);
    };
  }

  // ==========================================================================
  // Section 1: The 3-Tier Escape Hierarchy Verification
  // ==========================================================================
  describe('1. The 3-Tier Escape Hierarchy (ClearQueueDialog -> QueueSheet -> NowPlayingModal)', () => {
    it('executes strict LIFO Escape cascade across all 3 layers without closing lower tiers prematurely', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      // Open all 3 modal tiers:
      // NowPlayingModal (z-[60]) + QueueSheet (z-[70]) + ClearQueueDialog (z-[80])
      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      let isClearDialogOpen = true;
      let unmountDialog = mountClearQueueDialog(isClearDialogOpen, () => {
        isClearDialogOpen = false;
      });

      // ----------------------------------------------------------------------
      // Condition A: 1st Escape Key Press
      // ----------------------------------------------------------------------
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));

      // Clean up unmounted dialog listener as React does on re-render
      unmountDialog();

      // VERIFY: ONLY ClearQueueDialog closed!
      expect(isClearDialogOpen).toBe(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      // ----------------------------------------------------------------------
      // Condition B: 2nd Escape Key Press
      // ----------------------------------------------------------------------
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));

      // VERIFY: QueueSheet closed, NowPlayingModal remains open!
      expect(isClearDialogOpen).toBe(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      // ----------------------------------------------------------------------
      // Condition C: 3rd Escape Key Press
      // ----------------------------------------------------------------------
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));

      // VERIFY: NowPlayingModal closed!
      expect(isClearDialogOpen).toBe(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);

      // ----------------------------------------------------------------------
      // Condition D: 4th Subsequent Escape Key Press (Idempotence & Safety)
      // ----------------------------------------------------------------------
      expect(() => {
        mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      }).not.toThrow();

      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);

      unmountMain();
    });

    it('verifies 2-tier Escape cascade when ClearQueueDialog is not active (QueueSheet -> NowPlayingModal)', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      // 1st Escape closes QueueSheet
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      // 2nd Escape closes NowPlayingModal
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);

      unmountMain();
    });

    it('verifies 1-tier Escape cascade when only NowPlayingModal is open', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: false
      });

      // Escape closes NowPlayingModal
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);

      unmountMain();
    });
  });

  // ==========================================================================
  // Section 2: Form Input Focus Safety
  // ==========================================================================
  describe('2. Form Input Focus Safety (INPUT, TEXTAREA, SELECT)', () => {
    it('does NOT dismiss QueueSheet or NowPlayingModal when Escape is pressed while focused on <input>', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      // User is typing in search input or playlist rename input
      mockDocument.activeElement = { tagName: 'INPUT' };

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));

      // VERIFY: Both remain open!
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      unmountMain();
    });

    it('does NOT dismiss QueueSheet or NowPlayingModal when Escape is pressed while focused on <textarea>', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      // User is editing synced lyrics in LyricsView textarea
      mockDocument.activeElement = { tagName: 'TEXTAREA' };

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));

      // VERIFY: Both remain open!
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      unmountMain();
    });

    it('does NOT dismiss QueueSheet or NowPlayingModal when Escape is pressed while focused on <select>', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      // User is selecting an audio preset or format dropdown
      mockDocument.activeElement = { tagName: 'SELECT' };

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));

      // VERIFY: Both remain open!
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      unmountMain();
    });

    it('DOES dismiss modals normally when activeElement is non-form tag (BUTTON, DIV, or null)', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      // Focused on a generic button or null
      mockDocument.activeElement = { tagName: 'BUTTON' };

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      mockDocument.activeElement = null;
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);

      unmountMain();
    });
  });

  // ==========================================================================
  // Section 3: Capture vs Bubble DOM Event Propagation Verification
  // ==========================================================================
  describe('3. Capture vs Bubble DOM Event Propagation Verification', () => {
    it('verifies that ClearQueueDialog capture listener prevents background bubble listeners from receiving Escape', () => {
      const bubbleCalls: string[] = [];

      // Register multiple background bubble listeners on window
      mockWindow.addEventListener('keydown', () => bubbleCalls.push('bubble_main_layout'));
      mockWindow.addEventListener('keydown', () => bubbleCalls.push('bubble_analytics'));
      mockWindow.addEventListener('keydown', () => bubbleCalls.push('bubble_custom'));

      // Register ClearQueueDialog in capture phase
      let dialogClosed = false;
      const unmountDialog = mountClearQueueDialog(true, () => {
        dialogClosed = true;
      });

      // Dispatch Escape
      const event = new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' });
      mockWindow.dispatchEvent(event);

      // VERIFY:
      // 1. Dialog closed
      expect(dialogClosed).toBe(true);
      // 2. Event flags set
      expect(event.defaultPrevented).toBe(true);
      expect(event.propagationStopped).toBe(true);
      expect(event.immediatePropagationStopped).toBe(true);
      // 3. ZERO bubble listeners were invoked!
      expect(bubbleCalls).toEqual([]);

      unmountDialog();

      // Now dispatch Escape again: bubble listeners MUST receive it
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      expect(bubbleCalls).toEqual(['bubble_main_layout', 'bubble_analytics', 'bubble_custom']);
    });

    it('verifies order of execution: capture listeners ALWAYS precede bubble listeners', () => {
      const executionOrder: string[] = [];

      mockWindow.addEventListener('keydown', () => executionOrder.push('bubble_1'));
      mockWindow.addEventListener('keydown', () => executionOrder.push('capture_1'), true);
      mockWindow.addEventListener('keydown', () => executionOrder.push('bubble_2'));
      mockWindow.addEventListener('keydown', () => executionOrder.push('capture_2'), true);

      // Dispatch non-stopped event
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Enter', code: 'Enter' }));

      // Capture phase runs first in registration order, then bubble phase
      expect(executionOrder).toEqual(['capture_1', 'capture_2', 'bubble_1', 'bubble_2']);
    });
  });

  // ==========================================================================
  // Section 4: Android Hardware Back Button LIFO Cascade
  // ==========================================================================
  describe('4. Android Hardware Back Button LIFO Cascade', () => {
    it('dismisses ClearQueueDialog first without popping QueueSheet or NowPlayingModal', () => {
      // Setup MainLayout back button handler
      registerBackButtonHandler(() => {
        const state = usePlayerStore.getState();
        if (state.isQueueOpen) {
          state.setQueueOpen(false);
          return true;
        }
        if (state.isNowPlayingOpen) {
          state.setNowPlayingOpen(false);
          return true;
        }
        return false;
      });

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      let isDialogActive = true;
      let dialogCallback: BackButtonCallback | null = () => {
        isDialogActive = false;
        return true;
      };
      const unregisterDialogBack = pushBackButtonHandler(dialogCallback);

      // Simulation of Android native App.addListener('backButton'):
      const triggerAndroidBackButton = (): boolean => {
        // Step 1: Check LIFO stack
        if (dialogCallback) {
          const handled = dialogCallback();
          if (handled) {
            // Dialog closes and cleans up its back listener
            unregisterDialogBack();
            dialogCallback = null;
            return true;
          }
        }
        // Step 2: Fall back to central registerBackButtonHandler
        const state = usePlayerStore.getState();
        if (state.isQueueOpen) {
          state.setQueueOpen(false);
          return true;
        }
        if (state.isNowPlayingOpen) {
          state.setNowPlayingOpen(false);
          return true;
        }
        return false;
      };

      // 1st Back button: closes dialog only
      const handled1 = triggerAndroidBackButton();
      expect(handled1).toBe(true);
      expect(isDialogActive).toBe(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      // 2nd Back button: closes QueueSheet
      const handled2 = triggerAndroidBackButton();
      expect(handled2).toBe(true);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      // 3rd Back button: closes NowPlayingModal
      const handled3 = triggerAndroidBackButton();
      expect(handled3).toBe(true);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);
    });
  });

  // ==========================================================================
  // Section 5: Adversarial Stress & Edge Cases
  // ==========================================================================
  describe('5. Adversarial Stress & Edge Cases', () => {
    it('ADVERSARIAL: demonstrates catastrophic failure if NowPlayingModal had duplicate uncoordinated window listener', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      // Simulate pre-remediation bug: uncoordinated listener directly inside NowPlayingModal
      const defectiveNowPlayingListener = (e: any) => {
        if (e.key === 'Escape') {
          usePlayerStore.getState().setNowPlayingOpen(false);
        }
      };
      mockWindow.addEventListener('keydown', defectiveNowPlayingListener);

      // Dispatch single Escape
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));

      // PROOF OF PRE-REMEDIATION DEFECT:
      // Both modals collapsed simultaneously on 1 keypress!
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);

      mockWindow.removeEventListener('keydown', defectiveNowPlayingListener);
      unmountMain();
    });

    it('stress-tests rapid-fire burst of 10 Escape key presses', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      let isDialogActive = true;
      const unmountDialog = mountClearQueueDialog(isDialogActive, () => {
        isDialogActive = false;
      });

      // Rapidly dispatch 10 Escape key events
      for (let i = 0; i < 10; i++) {
        mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
        if (!isDialogActive) {
          unmountDialog();
        }
      }

      // After 10 rapid presses, all modals should be cleanly closed with no exceptions or invalid state
      expect(isDialogActive).toBe(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);

      unmountMain();
    });

    it('ignores non-Escape keyboard navigation events for modal dismissal', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true,
        isPlaying: false,
        currentTime: 20
      });

      let isDialogActive = true;
      const unmountDialog = mountClearQueueDialog(isDialogActive, () => {
        isDialogActive = false;
      });

      const nonEscapeKeys = [
        { key: ' ', code: 'Space' },
        { key: 'ArrowRight', code: 'ArrowRight' },
        { key: 'ArrowLeft', code: 'ArrowLeft' },
        { key: 'n', code: 'KeyN' },
        { key: 'p', code: 'KeyP' },
        { key: 'Tab', code: 'Tab' },
        { key: 'Enter', code: 'Enter' }
      ];

      for (const key of nonEscapeKeys) {
        mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', key));
        // Must NOT dismiss any layer
        expect(isDialogActive).toBe(true);
        expect(usePlayerStore.getState().isQueueOpen).toBe(true);
        expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);
      }

      unmountDialog();
      unmountMain();
    });

    it('handles repetitive dialog open-close cycles without event listener accumulation or memory leak', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      expect(mockWindow.getListenerCounts('keydown')).toEqual({ capture: 0, bubble: 1 });

      // Open and close ClearQueueDialog 5 consecutive times
      for (let i = 0; i < 5; i++) {
        let closed = false;
        const unmount = mountClearQueueDialog(true, () => {
          closed = true;
        });

        expect(mockWindow.getListenerCounts('keydown')).toEqual({ capture: 1, bubble: 1 });

        // Dismiss via Escape
        mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
        expect(closed).toBe(true);

        unmount();

        // Capture listener MUST be cleanly removed
        expect(mockWindow.getListenerCounts('keydown')).toEqual({ capture: 0, bubble: 1 });
      }

      unmountMain();
      expect(mockWindow.getListenerCounts('keydown')).toEqual({ capture: 0, bubble: 0 });
    });

    it('ADVERSARIAL: probes e.key vs e.code discrepancy between ClearQueueDialog and MainLayout', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      let isDialogActive = true;
      const unmountDialog = mountClearQueueDialog(isDialogActive, () => {
        isDialogActive = false;
      });

      // Construct an event where key is 'Escape', but code is '' (e.g. some virtual/mobile keyboards or custom dispatch)
      const keyOnlyEvent = new MockKeyboardEvent('keydown', { key: 'Escape', code: '' });

      // 1. ClearQueueDialog checks `e.key === 'Escape'` -> successfully catches and closes
      mockWindow.dispatchEvent(keyOnlyEvent);
      expect(isDialogActive).toBe(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
      unmountDialog();

      // 2. MainLayout checks `switch (e.code)` -> with code === '', it does NOT match 'Escape'
      mockWindow.dispatchEvent(keyOnlyEvent);
      // Demonstrates that MainLayout's switch specifically relies on e.code === 'Escape'
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);

      // 3. When code === 'Escape' is provided, MainLayout successfully closes QueueSheet
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);

      unmountMain();
    });

    it('restores modal dismissal immediately once focus is blurred away from form inputs', () => {
      const unmountMain = mountMainLayoutKeyboardListener();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      // 1. Focused on input -> Escape blocked
      mockDocument.activeElement = { tagName: 'INPUT' };
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      // 2. User blurs input -> activeElement becomes null or body
      mockDocument.activeElement = null;
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      // Dismisses QueueSheet
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      // Next Escape dismisses NowPlayingModal
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);

      unmountMain();
    });

    it('NowPlayingModal trigger opens QueueSheet without closing NowPlayingModal', () => {
      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: false
      });

      // User taps Queue icon inside NowPlayingModal:
      usePlayerStore.getState().setQueueOpen(true);

      // Invariant: Both must be open simultaneously
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
    });
  });
});
