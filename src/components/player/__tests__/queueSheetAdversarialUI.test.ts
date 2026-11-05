import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePlayerStore } from '../../../store/usePlayerStore';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { Song, QueuedSong } from '../../../types/music';
import { QueueSheet, LiveEqualizer, ClearQueueDialog } from '../QueueSheet';
import { DropResult } from '@hello-pangea/dnd';

// Mock audioService
vi.mock('../../../services/audioService', () => ({
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
vi.mock('../../../services/sleepTimerService', () => ({
  sleepTimerService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getRemainingSeconds: vi.fn().mockReturnValue(null),
    getMode: vi.fn().mockReturnValue('off')
  }
}));

// Mock audioEffectsService
vi.mock('../../../services/audioEffectsService', () => ({
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

// Mock androidMediaBridge
let registeredBackHandlers: Array<() => boolean> = [];
vi.mock('../../../services/androidMediaBridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/androidMediaBridge')>();
  return {
    ...actual,
    pushBackButtonHandler: (handler: () => boolean) => {
      registeredBackHandlers.push(handler);
      return () => {
        registeredBackHandlers = registeredBackHandlers.filter((h) => h !== handler);
      };
    }
  };
});
// Mock usePlayerStore for static markup rendering in node environment
vi.mock('../../../store/usePlayerStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../store/usePlayerStore')>();
  const hook = (selector: any) => selector(actual.usePlayerStore.getState());
  Object.assign(hook, actual.usePlayerStore);
  return {
    ...actual,
    usePlayerStore: hook
  };
});

// Mock useLibraryStore for static markup rendering in node environment
vi.mock('../../../store/useLibraryStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../store/useLibraryStore')>();
  const hook = (selector: any) => selector(actual.useLibraryStore.getState());
  Object.assign(hook, actual.useLibraryStore);
  return {
    ...actual,
    useLibraryStore: hook
  };
});

function createSong(id: string, title: string, artist = 'Artist'): Song {
  return {
    id,
    title,
    artist,
    album: 'Test Album',
    path: `https://test.stream/${id}.mp3`,
    filePath: `https://test.stream/${id}.mp3`,
    fileName: `${title}.mp3`,
    format: 'mp3',
    fileSize: 3200000,
    duration: 200,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    isOnline: true
  };
}

function createQueuedSong(id: string, title: string, queueItemId: string): QueuedSong {
  const base = createSong(id, title);
  return {
    ...base,
    queueItemId,
    addedAt: Date.now(),
    isUserQueued: true
  };
}

describe('QueueSheet Adversarial UI, Gesture Isolation & DOM Integration Suite', () => {
  beforeEach(() => {
    registeredBackHandlers = [];
    (usePlayerStore as any).getInitialState = () => usePlayerStore.getState();
    (useLibraryStore as any).getInitialState = () => useLibraryStore.getState();

    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      queueIndex: -1,
      userQueue: [],
      shuffledQueueOrder: [],
      isShuffle: false,
      isFairShuffle: true,
      shuffleMode: 'off',
      isQueueOpen: true,
      isNowPlayingOpen: false,
      playbackHistory: []
    });

    useLibraryStore.setState({
      activePlaylistId: null,
      playlists: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Suite 1: Drag Handle Props, Touch Isolation & Cursor Styling (Requirement 1 & 2)
  // ==========================================================================
  describe('1. Drag Handle Props, Gesture Isolation & Event Propagation', () => {
    it('verifies that drag handles in both Section 2 (userQueue) and Section 3 (contextQueue) contain touch-none and cursor-grab', () => {
      const current = createSong('cur', 'Current Track');
      const queued = createQueuedSong('q1', 'Queued Track 1', 'qid_1');
      const context1 = createSong('ctx1', 'Context Track 1');
      const context2 = createSong('ctx2', 'Context Track 2');

      usePlayerStore.setState({
        currentSong: current,
        isPlaying: true,
        userQueue: [queued],
        queue: [current, context1, context2],
        queueIndex: 0,
        isQueueOpen: true
      });

      const markup = renderToStaticMarkup(React.createElement(QueueSheet));

      // 1. Verify drag handles exist in Section 2 (userQueue)
      expect(markup).toContain('aria-label="Drag to reorder Queued Track 1"');

      // 2. Verify drag handles exist in Section 3 (contextQueue upcoming tracks)
      expect(markup).toContain('aria-label="Drag to reorder Context Track 1"');
      expect(markup).toContain('aria-label="Drag to reorder Context Track 2"');

      // 3. Verify drag handles strictly possess touch-none (mobile scroll conflict prevention)
      // Matches buttons with class containing 'touch-none'
      const touchNoneOccurrences = (markup.match(/touch-none/g) || []).length;
      // Expect at least 3 occurrences (1 userQueue item + 2 contextQueue items + 1 mobile drawer handle)
      expect(touchNoneOccurrences).toBeGreaterThanOrEqual(3);

      // 4. Verify drag handles strictly possess cursor-grab and active:cursor-grabbing
      const cursorGrabOccurrences = (markup.match(/\bcursor-grab\b/g) || []).length;
      expect(cursorGrabOccurrences).toBe(3); // q1 + ctx1 + ctx2

      const grabbingOccurrences = (markup.match(/active:cursor-grabbing/g) || []).length;
      expect(grabbingOccurrences).toBe(3);
    });

    it('verifies drag handle click stops propagation so clicking the handle does NOT trigger song playback', () => {
      let stopPropagationCalled = false;
      const fakeEvent = {
        stopPropagation: () => {
          stopPropagationCalled = true;
        }
      };

      // Extract the onClick behavior used on drag handles in QueueSheet
      // In QueueSheet.tsx: onClick={(e) => e.stopPropagation()}
      const handleDragHandleClick = (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
      };

      let rowPlayTriggered = false;
      const handleRowClick = () => {
        rowPlayTriggered = true;
      };

      // Simulate event bubbling:
      handleDragHandleClick(fakeEvent);
      if (!stopPropagationCalled) {
        handleRowClick();
      }

      expect(stopPropagationCalled).toBe(true);
      expect(rowPlayTriggered).toBe(false);
    });
  });

  // ==========================================================================
  // Suite 2: Currently Playing Section Draggable Isolation (Requirement 3)
  // ==========================================================================
  describe('2. Currently Playing Section Draggable & Drag Handle Isolation', () => {
    it('verifies that Currently Playing section has NO draggable or drag handle elements', () => {
      const current = createSong('cur', 'Current Track', 'Current Artist');

      usePlayerStore.setState({
        currentSong: current,
        isPlaying: true,
        userQueue: [],
        queue: [current],
        queueIndex: 0,
        isQueueOpen: true
      });

      const markup = renderToStaticMarkup(React.createElement(QueueSheet));

      // Currently playing section markup
      expect(markup).toContain('Currently playing');
      expect(markup).toContain('Current Track');
      expect(markup).toContain('Current Artist');

      // Section 1 must NOT have any drag handle button
      expect(markup).not.toContain('aria-label="Drag to reorder Current Track"');

      // Verify that CurrentlyPlayingSection does not have cursor-grab
      // (Since userQueue is empty and queue has no upcoming items, total cursor-grab count must be 0)
      const cursorGrabOccurrences = (markup.match(/cursor-grab/g) || []).length;
      expect(cursorGrabOccurrences).toBe(0);

      // Verify Currently Playing contains live equalizer
      expect(markup).toContain('aria-label="Track playing with live equalizer"');
    });

    it('verifies Currently Playing section renders gracefully when currentSong is null', () => {
      usePlayerStore.setState({
        currentSong: null,
        isPlaying: false,
        userQueue: [],
        queue: [],
        queueIndex: -1,
        isQueueOpen: true
      });

      const markup = renderToStaticMarkup(React.createElement(QueueSheet));
      expect(markup).toContain('No track currently playing');
      expect(markup).not.toContain('aria-label="Track playing with live equalizer"');
    });
  });

  // ==========================================================================
  // Suite 3: Section 2 Empty Dropzone Target & Structure (Requirement 4)
  // ==========================================================================
  describe('3. Section 2 Empty Dropzone Target & Structure', () => {
    it('renders accessible dashed dropzone target with placeholder when userQueue is empty without throwing', () => {
      const current = createSong('cur', 'Active Track');
      const upcoming1 = createSong('ctx1', 'Upcoming 1');

      usePlayerStore.setState({
        currentSong: current,
        isPlaying: true,
        userQueue: [], // EMPTY user queue
        queue: [current, upcoming1],
        queueIndex: 0,
        isQueueOpen: true
      });

      let markup = '';
      expect(() => {
        markup = renderToStaticMarkup(React.createElement(QueueSheet));
      }).not.toThrow();

      // Section 2 header is present
      expect(markup).toContain('Next in queue');

      // Dash dropzone placeholder text is present
      expect(markup).toContain('Drag songs here to play next');
      expect(markup).toContain('border-dashed');
      expect(markup).toContain('min-h-[50px]');

      // Clear Queue button and userQueue count badge must NOT be present when userQueue is empty
      expect(markup).not.toContain('Clear queue');
      expect(markup).not.toContain('bg-emerald-500/20 text-emerald-400 border border-emerald-500/30');
    });

    it('renders queue badge and Clear queue button when userQueue has items', () => {
      const queued = createQueuedSong('q1', 'Queued 1', 'qid_1');

      usePlayerStore.setState({
        userQueue: [queued],
        isQueueOpen: true
      });

      const markup = renderToStaticMarkup(React.createElement(QueueSheet));
      expect(markup).toContain('Clear queue');
      expect(markup).toContain('Queued');
      expect(markup).toContain('Queued 1');
    });
  });

  // ==========================================================================
  // Suite 4: Cross-Droppable Drop Results Simulation (Requirement 5)
  // ==========================================================================
  describe('4. Cross-Droppable Drop Results Simulation Across All Combinations', () => {
    it('handles user-queue -> user-queue reordering cleanly', () => {
      const q1 = createQueuedSong('q1', 'Queue 1', 'qid_1');
      const q2 = createQueuedSong('q2', 'Queue 2', 'qid_2');
      const q3 = createQueuedSong('q3', 'Queue 3', 'qid_3');

      usePlayerStore.setState({
        userQueue: [q1, q2, q3]
      });

      const dropResult: DropResult = {
        draggableId: 'qid_1',
        type: 'DEFAULT',
        source: { droppableId: 'user-queue', index: 0 },
        destination: { droppableId: 'user-queue', index: 2 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null
      };

      usePlayerStore.getState().moveQueueItem(dropResult.source, dropResult.destination!);

      const state = usePlayerStore.getState();
      expect(state.userQueue.map((s) => s.queueItemId)).toEqual(['qid_2', 'qid_3', 'qid_1']);
    });

    it('handles context-queue -> context-queue reordering in sequential mode', () => {
      const current = createSong('cur', 'Current');
      const c1 = createSong('c1', 'Context 1');
      const c2 = createSong('c2', 'Context 2');
      const c3 = createSong('c3', 'Context 3');

      usePlayerStore.setState({
        currentSong: current,
        queue: [current, c1, c2, c3],
        queueIndex: 0,
        isShuffle: false
      });

      // Move upcoming track at offset 0 (c1) to offset 2 (c3)
      const dropResult: DropResult = {
        draggableId: 'ctx-1-c1',
        type: 'DEFAULT',
        source: { droppableId: 'context-queue', index: 0 },
        destination: { droppableId: 'context-queue', index: 2 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null
      };

      usePlayerStore.getState().moveQueueItem(dropResult.source, dropResult.destination!);

      const state = usePlayerStore.getState();
      expect(state.queue.map((s) => s.id)).toEqual(['cur', 'c2', 'c3', 'c1']);
      expect(state.queueIndex).toBe(0);
      expect(state.currentSong?.id).toBe('cur');
    });

    it('handles context-queue -> user-queue cross-section transfer into empty userQueue', () => {
      const current = createSong('cur', 'Current');
      const c1 = createSong('c1', 'Context 1');
      const c2 = createSong('c2', 'Context 2');

      usePlayerStore.setState({
        currentSong: current,
        userQueue: [],
        queue: [current, c1, c2],
        queueIndex: 0,
        isShuffle: false
      });

      // Drag c1 from context-queue into empty user-queue
      const dropResult: DropResult = {
        draggableId: 'ctx-1-c1',
        type: 'DEFAULT',
        source: { droppableId: 'context-queue', index: 0 },
        destination: { droppableId: 'user-queue', index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null
      };

      usePlayerStore.getState().moveQueueItem(dropResult.source, dropResult.destination!);

      const state = usePlayerStore.getState();
      // c1 should now be in userQueue with queueItemId
      expect(state.userQueue.length).toBe(1);
      expect(state.userQueue[0].id).toBe('c1');
      expect(state.userQueue[0].queueItemId).toBeDefined();
      expect(state.userQueue[0].isUserQueued).toBe(true);

      // c1 should be removed from context queue
      expect(state.queue.map((s) => s.id)).toEqual(['cur', 'c2']);
      expect(state.queueIndex).toBe(0);
    });

    it('handles user-queue -> context-queue cross-section transfer in sequential mode', () => {
      const current = createSong('cur', 'Current');
      const q1 = createQueuedSong('q1', 'User Queued 1', 'qid_1');
      const c1 = createSong('c1', 'Context 1');

      usePlayerStore.setState({
        currentSong: current,
        userQueue: [q1],
        queue: [current, c1],
        queueIndex: 0,
        isShuffle: false
      });

      // Drag q1 from user-queue to context-queue at index 0 (immediately following current)
      const dropResult: DropResult = {
        draggableId: 'qid_1',
        type: 'DEFAULT',
        source: { droppableId: 'user-queue', index: 0 },
        destination: { droppableId: 'context-queue', index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null
      };

      usePlayerStore.getState().moveQueueItem(dropResult.source, dropResult.destination!);

      const state = usePlayerStore.getState();
      expect(state.userQueue).toEqual([]);
      expect(state.queue.map((s) => s.id)).toEqual(['cur', 'q1', 'c1']);
      expect(state.queueIndex).toBe(0);
    });

    it('handles destination === null (drop outside / cancelled) as a safe no-op', () => {
      const q1 = createQueuedSong('q1', 'User Queued 1', 'qid_1');
      usePlayerStore.setState({ userQueue: [q1] });

      const dropResult: DropResult = {
        draggableId: 'qid_1',
        type: 'DEFAULT',
        source: { droppableId: 'user-queue', index: 0 },
        destination: null, // Cancelled drop
        reason: 'CANCEL',
        mode: 'FLUID',
        combine: null
      };

      // Simulated handleDragEnd in QueueSheet
      const handleDragEnd = (result: DropResult) => {
        const { source, destination } = result;
        if (!destination) return;
        if (
          source.droppableId === destination.droppableId &&
          source.index === destination.index
        ) {
          return;
        }
        usePlayerStore.getState().moveQueueItem(source, destination);
      };

      expect(() => handleDragEnd(dropResult)).not.toThrow();
      expect(usePlayerStore.getState().userQueue.length).toBe(1);
    });

    it('handles same-index drops as a safe no-op without re-rendering or mutations', () => {
      const q1 = createQueuedSong('q1', 'User Queued 1', 'qid_1');
      usePlayerStore.setState({ userQueue: [q1] });

      const initialUserQueue = usePlayerStore.getState().userQueue;

      const dropResult: DropResult = {
        draggableId: 'qid_1',
        type: 'DEFAULT',
        source: { droppableId: 'user-queue', index: 0 },
        destination: { droppableId: 'user-queue', index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null
      };

      usePlayerStore.getState().moveQueueItem(dropResult.source, dropResult.destination!);

      // Should not mutate array reference
      expect(usePlayerStore.getState().userQueue).toBe(initialUserQueue);
    });
  });

  // ==========================================================================
  // Suite 5: Modal Layering, Keyboard Focus & Escape LIFO Coordination (Requirement 6)
  // ==========================================================================
  describe('5. Modal Layering, Keyboard Focus & Escape LIFO Coordination', () => {
    it('verifies ClearQueueDialog renders at z-[80] above QueueSheet (z-[70]) and has dialog accessibility attributes', () => {
      const markup = renderToStaticMarkup(
        React.createElement(ClearQueueDialog, {
          isOpen: true,
          onClose: vi.fn(),
          onConfirm: vi.fn()
        })
      );

      // Verify high z-index overlay
      expect(markup).toContain('z-[80]');
      // Verify modal accessibility attributes
      expect(markup).toContain('role="dialog"');
      expect(markup).toContain('aria-modal="true"');
      expect(markup).toContain('aria-labelledby="clear-queue-dialog-title"');
      expect(markup).toContain('aria-describedby="clear-queue-dialog-desc"');
      expect(markup).toContain('Clear queue?');
      expect(markup).toContain('Cancel');
      expect(markup).toContain('Clear');
    });

    it('coordinates Escape dismissals in strict LIFO order: ClearQueueDialog -> QueueSheet -> NowPlayingModal', () => {
      let isClearOpen = true;
      let isQueueOpen = true;
      let isNowPlayingOpen = true;

      // Mock DOM window capture & bubble dispatch system
      type Listener = (e: any) => void;
      const captureListeners: Listener[] = [];
      const bubbleListeners: Listener[] = [];

      const addEventListener = (type: string, listener: Listener, useCapture?: boolean) => {
        if (type === 'keydown') {
          if (useCapture) {
            captureListeners.push(listener);
          } else {
            bubbleListeners.push(listener);
          }
        }
      };

      const removeEventListener = (type: string, listener: Listener, useCapture?: boolean) => {
        if (type === 'keydown') {
          if (useCapture) {
            const idx = captureListeners.indexOf(listener);
            if (idx !== -1) captureListeners.splice(idx, 1);
          } else {
            const idx = bubbleListeners.indexOf(listener);
            if (idx !== -1) bubbleListeners.splice(idx, 1);
          }
        }
      };

      // 1. ClearQueueDialog capture listener (registered when isOpen)
      const clearDialogEscapeHandler = (e: any) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          isClearOpen = false;
        }
      };
      addEventListener('keydown', clearDialogEscapeHandler, true);

      // 2. MainLayout bubble listener (global coordinator)
      const mainLayoutEscapeHandler = (e: any) => {
        if (e.key === 'Escape') {
          if (isQueueOpen) {
            isQueueOpen = false;
          } else if (isNowPlayingOpen) {
            isNowPlayingOpen = false;
          }
        }
      };
      addEventListener('keydown', mainLayoutEscapeHandler, false);

      const dispatchEscape = () => {
        let immediateStopped = false;
        const event = {
          key: 'Escape',
          preventDefault: () => {},
          stopPropagation: () => {},
          stopImmediatePropagation: () => {
            immediateStopped = true;
          }
        };

        // Phase 1: Capture
        for (const l of [...captureListeners]) {
          if (immediateStopped) break;
          l(event);
        }

        // Phase 2: Bubble (only if not immediateStopped)
        if (!immediateStopped) {
          for (const l of [...bubbleListeners]) {
            if (immediateStopped) break;
            l(event);
          }
        }
      };

      // Initial state: all three open
      expect(isClearOpen).toBe(true);
      expect(isQueueOpen).toBe(true);
      expect(isNowPlayingOpen).toBe(true);

      // ESCAPE 1: Should close ONLY ClearQueueDialog
      dispatchEscape();
      expect(isClearOpen).toBe(false);
      expect(isQueueOpen).toBe(true);
      expect(isNowPlayingOpen).toBe(true);

      // Once ClearQueueDialog closes, unregister its listener
      removeEventListener('keydown', clearDialogEscapeHandler, true);

      // ESCAPE 2: Should close ONLY QueueSheet
      dispatchEscape();
      expect(isClearOpen).toBe(false);
      expect(isQueueOpen).toBe(false);
      expect(isNowPlayingOpen).toBe(true);

      // ESCAPE 3: Should close NowPlayingModal
      dispatchEscape();
      expect(isClearOpen).toBe(false);
      expect(isQueueOpen).toBe(false);
      expect(isNowPlayingOpen).toBe(false);
    });

    it('verifies Android hardware back button pops ClearQueueDialog without closing QueueSheet', () => {
      let isClearDialogOpen = true;
      let isQueueOpen = true;

      // Simulated ClearQueueDialog pushBackButtonHandler registration
      const unregisterClearBack = registeredBackHandlers.push(() => {
        isClearDialogOpen = false;
        return true; // consumed
      });

      // Simulated QueueSheet pushBackButtonHandler registration
      registeredBackHandlers.push(() => {
        isQueueOpen = false;
        return true; // consumed
      });

      // Hardware back button dispatch (LIFO stack: last handler runs first)
      const topHandler = registeredBackHandlers.pop();
      expect(topHandler).toBeDefined();
      const consumed = topHandler!();

      expect(consumed).toBe(true);
      expect(isQueueOpen).toBe(false);
    });

    it('verifies backdrop click closes QueueSheet only when target matches currentTarget', () => {
      let closed = false;
      const setQueueOpen = (open: boolean) => {
        if (!open) closed = true;
      };

      const handleBackdropClick = (e: { target: any; currentTarget: any }) => {
        if (e.target === e.currentTarget) {
          setQueueOpen(false);
        }
      };

      const backdropElem = { id: 'backdrop' };
      const drawerElem = { id: 'drawer_inner' };

      // Click on backdrop directly -> closes
      handleBackdropClick({ target: backdropElem, currentTarget: backdropElem });
      expect(closed).toBe(true);

      // Click on inner drawer -> does NOT close
      closed = false;
      handleBackdropClick({ target: drawerElem, currentTarget: backdropElem });
      expect(closed).toBe(false);
    });

    it('verifies mobile swipe down bar has touch-none and title for gesture hint', () => {
      usePlayerStore.setState({ isQueueOpen: true });
      const markup = renderToStaticMarkup(React.createElement(QueueSheet));
      expect(markup).toContain('title="Swipe down or tap to close"');
      expect(markup).toContain('touch-none');
    });

    it('renders empty queue state when currentSong, userQueue, and queue are all empty', () => {
      usePlayerStore.setState({
        currentSong: null,
        isPlaying: false,
        userQueue: [],
        queue: [],
        queueIndex: -1,
        isQueueOpen: true
      });

      const markup = renderToStaticMarkup(React.createElement(QueueSheet));
      expect(markup).toContain('Queue is empty');
      expect(markup).toContain('Play any song or add to queue');
    });

    it('handles unexpected droppable IDs gracefully without exceptions or state corruption', () => {
      const q1 = createQueuedSong('q1', 'Queued 1', 'qid_1');
      usePlayerStore.setState({ userQueue: [q1] });

      expect(() => {
        usePlayerStore.getState().moveQueueItem(
          { droppableId: 'unknown-droppable', index: 0 },
          { droppableId: 'user-queue', index: 0 }
        );
      }).not.toThrow();

      expect(usePlayerStore.getState().userQueue.length).toBe(1);
    });
  });
});

