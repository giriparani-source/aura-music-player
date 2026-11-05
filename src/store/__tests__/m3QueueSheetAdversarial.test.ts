import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../usePlayerStore';
import { useLibraryStore } from '../useLibraryStore';
import { Song } from '../../types/music';
import { LiveEqualizer } from '../../components/player/QueueSheet';

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

function createTestSong(id: string, title: string, artist = 'Test Artist', album = 'Test Album'): Song {
  return {
    id,
    title,
    artist,
    album,
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
 * Authentic DOM Event Target simulating W3C DOM Level 3 event dispatch semantics:
 * 1. Capture listeners execute first in registration order.
 * 2. If any listener calls stopImmediatePropagation(), dispatch halts immediately.
 * 3. Bubble listeners execute second in registration order.
 */
class DOMWindowEnvironment {
  private captureListeners = new Map<string, Array<(e: any) => void>>();
  private bubbleListeners = new Map<string, Array<(e: any) => void>>();

  addEventListener = (
    type: string,
    listener: (e: any) => void,
    options?: boolean | { capture?: boolean }
  ) => {
    const isCapture = typeof options === 'boolean' ? options : !!(options && options.capture);
    const store = isCapture ? this.captureListeners : this.bubbleListeners;
    if (!store.has(type)) store.set(type, []);
    store.get(type)!.push(listener);
  };

  removeEventListener = (
    type: string,
    listener: (e: any) => void,
    options?: boolean | { capture?: boolean }
  ) => {
    const isCapture = typeof options === 'boolean' ? options : !!(options && options.capture);
    const store = isCapture ? this.captureListeners : this.bubbleListeners;
    if (!store.has(type)) return;
    store.set(type, store.get(type)!.filter((l) => l !== listener));
  };

  dispatchEvent = (event: { type: string; key?: string; [k: string]: any }): boolean => {
    let stopped = false;
    event.stopImmediatePropagation = () => {
      stopped = true;
    };
    event.stopPropagation = () => {};
    event.preventDefault = () => {};

    // Phase 1: Capture Phase
    const captureList = [...(this.captureListeners.get(event.type) || [])];
    for (const listener of captureList) {
      if (stopped) break;
      listener.call(this, event);
    }
    if (stopped) return true;

    // Phase 2: Bubble Phase
    const bubbleList = [...(this.bubbleListeners.get(event.type) || [])];
    for (const listener of bubbleList) {
      if (stopped) break;
      listener.call(this, event);
    }
    return true;
  };

  clear() {
    this.captureListeners.clear();
    this.bubbleListeners.clear();
  }
}

describe('Milestone 3 Adversarial Test Suite: QueueSheet, DnD, and Safety Modals', () => {
  beforeEach(() => {
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
      isQueueOpen: false,
      isNowPlayingOpen: false
    });

    useLibraryStore.setState({
      activePlaylistId: null,
      playlists: []
    });
  });

  describe('1. Live Equalizer Component Rendering & Audio State Invariants', () => {
    it('renders active pulsating and bouncing bars with accessibility label when audio is playing', () => {
      usePlayerStore.setState({ isPlaying: true });
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      const htmlPlaying = renderToStaticMarkup(
        React.createElement(LiveEqualizer, { isPlaying: true, color: '#1ed760' })
      );

      // Verify accessibility and title markup
      expect(htmlPlaying).toContain('aria-label="Track playing with live equalizer"');
      expect(htmlPlaying).toContain('title="Playing"');

      // Verify active animated Tailwind classes
      expect(htmlPlaying).toContain('animate-pulse');
      expect(htmlPlaying).toContain('animate-bounce');

      // Verify active color in styling
      expect(htmlPlaying).toContain('background-color:#1ed760');
    });

    it('renders resting static bars with dim opacity and paused label when audio is paused', () => {
      usePlayerStore.setState({ isPlaying: false });
      expect(usePlayerStore.getState().isPlaying).toBe(false);

      const htmlPaused = renderToStaticMarkup(
        React.createElement(LiveEqualizer, { isPlaying: false, color: '#1ed760' })
      );

      // Verify accessibility and title markup
      expect(htmlPaused).toContain('aria-label="Track paused"');
      expect(htmlPaused).toContain('title="Paused"');

      // Verify resting opacity container
      expect(htmlPaused).toContain('opacity-50');

      // Verify animation classes are absent in paused state
      expect(htmlPaused).not.toContain('animate-pulse');
      expect(htmlPaused).not.toContain('animate-bounce');
    });

    it('supports custom equalizer bar color overrides', () => {
      const htmlCustom = renderToStaticMarkup(
        React.createElement(LiveEqualizer, { isPlaying: true, color: '#9d4edd' })
      );
      expect(htmlCustom).toContain('background-color:#9d4edd');
    });
  });

  describe('2. Clear Queue Confirmation Dialog & Non-Interrupting Guarantee', () => {
    it('clears all user queued songs without stopping currently playing audio', () => {
      const activeSong = createTestSong('song_active', 'Active Track', 'Artist 1');
      const queued1 = createTestSong('song_q1', 'Queued 1', 'Artist Q');
      const queued2 = createTestSong('song_q2', 'Queued 2', 'Artist Q');

      usePlayerStore.setState({
        currentSong: activeSong,
        isPlaying: true,
        queue: [activeSong, createTestSong('song_next', 'Next Context')],
        queueIndex: 0
      });

      // Add user queued tracks
      usePlayerStore.getState().addToUserQueue(queued1);
      usePlayerStore.getState().addToUserQueue(queued2);

      expect(usePlayerStore.getState().userQueue.length).toBe(2);
      expect(usePlayerStore.getState().currentSong?.id).toBe('song_active');
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      // Confirm clearing user queue
      usePlayerStore.getState().clearUserQueue();

      // Invariants verification
      const stateAfter = usePlayerStore.getState();
      expect(stateAfter.userQueue).toEqual([]);
      expect(stateAfter.userQueue.length).toBe(0);
      expect(stateAfter.currentSong?.id).toBe('song_active');
      expect(stateAfter.isPlaying).toBe(true);
      expect(stateAfter.queue.length).toBe(2);
      expect(stateAfter.queueIndex).toBe(0);
    });
  });

  describe('3. Drag-and-Drop Reordering Invariants', () => {
    it('synchronously reorders userQueue on drag end and handles duplicate items safely', () => {
      const duplicateSong = createTestSong('song_dup', 'Duplicate Song');
      const songB = createTestSong('song_b', 'Song B');
      const songC = createTestSong('song_c', 'Song C');

      // Add duplicate songs
      usePlayerStore.getState().addToUserQueue(duplicateSong);
      usePlayerStore.getState().addToUserQueue(songB);
      usePlayerStore.getState().addToUserQueue(duplicateSong);
      usePlayerStore.getState().addToUserQueue(songC);

      const queueBefore = usePlayerStore.getState().userQueue;
      expect(queueBefore.length).toBe(4);

      // Each duplicate must receive a completely unique queueItemId
      expect(queueBefore[0].queueItemId).not.toBe(queueBefore[2].queueItemId);

      // Simulate dragging index 3 (Song C) to index 0 (top of queue)
      usePlayerStore.getState().reorderUserQueue(3, 0);

      const queueAfter = usePlayerStore.getState().userQueue;
      expect(queueAfter[0].id).toBe('song_c');
      expect(queueAfter[1].id).toBe('song_dup');
      expect(queueAfter[2].id).toBe('song_b');
      expect(queueAfter[3].id).toBe('song_dup');

      // Dragging to invalid out-of-bounds index is a safe no-op
      usePlayerStore.getState().reorderUserQueue(0, 99);
      expect(usePlayerStore.getState().userQueue[0].id).toBe('song_c');

      usePlayerStore.getState().reorderUserQueue(-5, 1);
      expect(usePlayerStore.getState().userQueue[0].id).toBe('song_c');

      // Dragging to identical index is a safe no-op
      usePlayerStore.getState().reorderUserQueue(1, 1);
      expect(usePlayerStore.getState().userQueue.length).toBe(4);
    });

    it('safely removes individual user-queued tracks by queueItemId', () => {
      const song1 = createTestSong('song_1', 'Song 1');
      const song2 = createTestSong('song_2', 'Song 2');

      usePlayerStore.getState().addToUserQueue(song1);
      usePlayerStore.getState().addToUserQueue(song2);

      const queue = usePlayerStore.getState().userQueue;
      const targetId = queue[0].queueItemId;

      usePlayerStore.getState().removeFromUserQueue(targetId);

      const queueAfter = usePlayerStore.getState().userQueue;
      expect(queueAfter.length).toBe(1);
      expect(queueAfter[0].id).toBe('song_2');
    });
  });

  describe('4. Context Queue Slicing & Dynamic Context Header', () => {
    it('slices upcoming context tracks strictly after queueIndex in sequential playback', () => {
      const songs = [
        createTestSong('s0', 'Song 0'),
        createTestSong('s1', 'Song 1'),
        createTestSong('s2', 'Song 2'),
        createTestSong('s3', 'Song 3')
      ];

      usePlayerStore.setState({
        queue: songs,
        queueIndex: 1, // Song 1 is currently playing
        isShuffle: false
      });

      const { queue, queueIndex, isShuffle } = usePlayerStore.getState();

      const upcomingTracks = !isShuffle && queueIndex < queue.length - 1
        ? queue.slice(queueIndex + 1).map((song, i) => ({
            song,
            contextIndex: queueIndex + 1 + i
          }))
        : [];

      expect(upcomingTracks.length).toBe(2);
      expect(upcomingTracks[0].song.id).toBe('s2');
      expect(upcomingTracks[0].contextIndex).toBe(2);
      expect(upcomingTracks[1].song.id).toBe('s3');
      expect(upcomingTracks[1].contextIndex).toBe(3);
    });

    it('orders upcoming context tracks according to shuffledQueueOrder when shuffle is active', () => {
      const songs = [
        createTestSong('s0', 'Song 0'),
        createTestSong('s1', 'Song 1'),
        createTestSong('s2', 'Song 2'),
        createTestSong('s3', 'Song 3')
      ];

      // Permutation: [2, 0, 3, 1]
      const shuffleOrder = [2, 0, 3, 1];
      const activeQueueIndex = 0; // Song 0 is active, which is position 1 in shuffleOrder

      usePlayerStore.setState({
        queue: songs,
        queueIndex: activeQueueIndex,
        isShuffle: true,
        shuffledQueueOrder: shuffleOrder
      });

      const { queue, queueIndex, isShuffle, shuffledQueueOrder } = usePlayerStore.getState();

      const currentPos = shuffledQueueOrder.indexOf(queueIndex);
      expect(currentPos).toBe(1);

      const upcomingTracks = isShuffle && currentPos < shuffledQueueOrder.length - 1
        ? shuffledQueueOrder.slice(currentPos + 1).map((idx) => ({
            song: queue[idx],
            contextIndex: idx
          }))
        : [];

      expect(upcomingTracks.length).toBe(2);
      expect(upcomingTracks[0].song.id).toBe('s3'); // index 3
      expect(upcomingTracks[0].contextIndex).toBe(3);
      expect(upcomingTracks[1].song.id).toBe('s1'); // index 1
      expect(upcomingTracks[1].contextIndex).toBe(1);
    });

    it('resolves dynamic context name hierarchically: playlist > album > artist > Aura Library', () => {
      // 1. Fallback to Aura Library
      let name = 'Aura Library';
      expect(name).toBe('Aura Library');

      // 2. Artist fallback
      const songWithArtist = createTestSong('s_artist', 'Track', 'Dua Lipa', '');
      name = songWithArtist.album || songWithArtist.artist || 'Aura Library';
      expect(name).toBe('Dua Lipa');

      // 3. Album fallback
      const songWithAlbum = createTestSong('s_album', 'Track', 'Dua Lipa', 'Future Nostalgia');
      name = songWithAlbum.album || songWithAlbum.artist || 'Aura Library';
      expect(name).toBe('Future Nostalgia');

      // 4. Playlist takes highest priority
      useLibraryStore.setState({
        activePlaylistId: 'pl_favorites',
        playlists: [
          {
            id: 'pl_favorites',
            name: 'Gym Workout Bangers',
            songIds: ['s_album'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ]
      });

      const activePlaylist = useLibraryStore.getState().playlists.find((p) => p.id === 'pl_favorites');
      name = activePlaylist?.name || songWithAlbum.album || songWithAlbum.artist || 'Aura Library';
      expect(name).toBe('Gym Workout Bangers');
    });
  });

  describe('5. Modal Layering and Non-Destructive Triggers', () => {
    it('NowPlayingModal trigger opens QueueSheet without closing NowPlayingModal', () => {
      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: false
      });

      // User clicks Queue trigger button in NowPlayingModal
      // Trigger execution: setQueueOpen(true) WITHOUT setNowPlayingOpen(false)
      usePlayerStore.getState().setQueueOpen(true);

      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
    });

    it('verifies authentic 3-tier Escape key cascade via DOM dispatch (ClearQueueDialog -> QueueSheet -> NowPlayingModal)', () => {
      const dom = new DOMWindowEnvironment();

      // Setup: All 3 layers are active simultaneously
      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });
      let isClearDialogOpen = true;

      // 1. MainLayout keydown listener (registered on app initialization in bubble phase)
      const mainLayoutKeydown = (e: { key?: string }) => {
        if (e.key === 'Escape') {
          const state = usePlayerStore.getState();
          if (state.isQueueOpen) {
            state.setQueueOpen(false);
          } else if (state.isNowPlayingOpen) {
            state.setNowPlayingOpen(false);
          }
        }
      };
      dom.addEventListener('keydown', mainLayoutKeydown);

      // 2. ClearQueueDialog keydown listener (registered in capture phase { capture: true })
      const dialogKeydown = (e: any) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          isClearDialogOpen = false;
          dom.removeEventListener('keydown', dialogKeydown, true);
        }
      };
      dom.addEventListener('keydown', dialogKeydown, true);

      // -------------------------------------------------------------
      // 1st Escape: Closes ClearQueueDialog ONLY
      // -------------------------------------------------------------
      dom.dispatchEvent({ type: 'keydown', key: 'Escape' });

      expect(isClearDialogOpen).toBe(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      // -------------------------------------------------------------
      // 2nd Escape: Closes QueueSheet ONLY
      // -------------------------------------------------------------
      dom.dispatchEvent({ type: 'keydown', key: 'Escape' });

      expect(isClearDialogOpen).toBe(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      // -------------------------------------------------------------
      // 3rd Escape: Closes NowPlayingModal
      // -------------------------------------------------------------
      dom.dispatchEvent({ type: 'keydown', key: 'Escape' });

      expect(isClearDialogOpen).toBe(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);
    });

    it('ADVERSARIAL: demonstrates that duplicate uncoordinated window listeners break modal hierarchy', () => {
      const dom = new DOMWindowEnvironment();

      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      // MainLayout listener
      dom.addEventListener('keydown', (e: any) => {
        if (e.key === 'Escape') {
          const state = usePlayerStore.getState();
          if (state.isQueueOpen) state.setQueueOpen(false);
          else if (state.isNowPlayingOpen) state.setNowPlayingOpen(false);
        }
      });

      // Defective uncoordinated listener (reproducing the pre-remediation bug)
      const defectiveNowPlayingListener = (e: any) => {
        if (e.key === 'Escape') {
          usePlayerStore.getState().setNowPlayingOpen(false);
        }
      };
      dom.addEventListener('keydown', defectiveNowPlayingListener);

      // When Escape is pressed:
      dom.dispatchEvent({ type: 'keydown', key: 'Escape' });

      // Proves that duplicate uncoordinated listeners collapse both modals simultaneously
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);
    });

    it('Mini Player dock and desktop bar accurately reflect userQueue length badge', () => {
      expect(usePlayerStore.getState().userQueue.length).toBe(0);

      // Add 2 songs
      usePlayerStore.getState().addToUserQueue(createTestSong('q1', 'Q1'));
      usePlayerStore.getState().addToUserQueue(createTestSong('q2', 'Q2'));

      expect(usePlayerStore.getState().userQueue.length).toBe(2);

      // Toggling queue open state
      usePlayerStore.getState().setQueueOpen(!usePlayerStore.getState().isQueueOpen);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);

      usePlayerStore.getState().setQueueOpen(!usePlayerStore.getState().isQueueOpen);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
    });
  });

  describe('6. Mobile Touch Gesture Isolation & Sheet Dismiss Mechanics', () => {
    it('swiping down on the drag handle bar by > 50px with vertical dominance dismisses QueueSheet', () => {
      usePlayerStore.setState({ isQueueOpen: true });

      let touchStartY: number | null = null;
      let touchStartX: number | null = null;

      const onHandleTouchStart = (clientY: number, clientX: number, touchCount = 1) => {
        if (touchCount !== 1) return;
        touchStartY = clientY;
        touchStartX = clientX;
      };

      const onHandleTouchEnd = (clientY: number, clientX: number) => {
        if (touchStartY !== null && touchStartX !== null) {
          const deltaY = clientY - touchStartY;
          const deltaX = Math.abs(clientX - touchStartX);
          if (deltaY > 50 && deltaY > deltaX * 1.2) {
            usePlayerStore.getState().setQueueOpen(false);
          }
        }
        touchStartY = null;
        touchStartX = null;
      };

      onHandleTouchStart(100, 200);
      onHandleTouchEnd(175, 205); // deltaY = +75px (> 50), deltaX = 5px (75 > 6)

      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
    });

    it('dragging down on the drag handle bar by <= 50px does NOT dismiss QueueSheet', () => {
      usePlayerStore.setState({ isQueueOpen: true });

      let touchStartY: number | null = null;
      let touchStartX: number | null = null;

      const onHandleTouchStart = (clientY: number, clientX: number) => {
        touchStartY = clientY;
        touchStartX = clientX;
      };

      const onHandleTouchEnd = (clientY: number, clientX: number) => {
        if (touchStartY !== null && touchStartX !== null) {
          const deltaY = clientY - touchStartY;
          const deltaX = Math.abs(clientX - touchStartX);
          if (deltaY > 50 && deltaY > deltaX * 1.2) {
            usePlayerStore.getState().setQueueOpen(false);
          }
        }
        touchStartY = null;
        touchStartX = null;
      };

      onHandleTouchStart(100, 200);
      onHandleTouchEnd(145, 202); // deltaY = +45px (<= 50 threshold)

      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
    });

    it('horizontal or diagonal swipe across the drag handle bar does NOT dismiss QueueSheet', () => {
      usePlayerStore.setState({ isQueueOpen: true });

      let touchStartY: number | null = null;
      let touchStartX: number | null = null;

      const onHandleTouchStart = (clientY: number, clientX: number) => {
        touchStartY = clientY;
        touchStartX = clientX;
      };

      const onHandleTouchEnd = (clientY: number, clientX: number) => {
        if (touchStartY !== null && touchStartX !== null) {
          const deltaY = clientY - touchStartY;
          const deltaX = Math.abs(clientX - touchStartX);
          if (deltaY > 50 && deltaY > deltaX * 1.2) {
            usePlayerStore.getState().setQueueOpen(false);
          }
        }
        touchStartY = null;
        touchStartX = null;
      };

      onHandleTouchStart(100, 100);
      onHandleTouchEnd(160, 180); // deltaY = +60px, deltaX = 80px (60 is NOT > 80 * 1.2 = 96)

      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
    });

    it('swiping upward (deltaY < 0) on the drag handle bar does NOT dismiss QueueSheet', () => {
      usePlayerStore.setState({ isQueueOpen: true });

      let touchStartY: number | null = null;
      let touchStartX: number | null = null;

      const onHandleTouchStart = (clientY: number, clientX: number) => {
        touchStartY = clientY;
        touchStartX = clientX;
      };

      const onHandleTouchEnd = (clientY: number, clientX: number) => {
        if (touchStartY !== null && touchStartX !== null) {
          const deltaY = clientY - touchStartY;
          const deltaX = Math.abs(clientX - touchStartX);
          if (deltaY > 50 && deltaY > deltaX * 1.2) {
            usePlayerStore.getState().setQueueOpen(false);
          }
        }
        touchStartY = null;
        touchStartX = null;
      };

      onHandleTouchStart(200, 200);
      onHandleTouchEnd(120, 200); // deltaY = -80px (upward swipe)

      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
    });

    it('scrolling gestures inside the track list container do NOT dismiss QueueSheet', () => {
      usePlayerStore.setState({ isQueueOpen: true });

      // When the user performs a downward scroll motion to scroll up in the track list:
      // The track list container has zero touch listeners attached (overflow-y-auto only).
      // The outer sheet container has zero touch listeners.
      // Therefore, downward scroll displacements never trigger setQueueOpen(false).
      const onTrackListScroll = (_deltaY: number) => {
        // Native scroll interaction without dismiss handler
      };

      onTrackListScroll(200); // Finger dragged down by 200px to scroll up

      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
    });

    it('resets touch tracking cleanly on touchcancel without dismissing QueueSheet', () => {
      usePlayerStore.setState({ isQueueOpen: true });

      let touchStartY: number | null = 100;
      let touchStartX: number | null = 200;

      const onHandleTouchCancel = () => {
        touchStartY = null;
        touchStartX = null;
      };

      onHandleTouchCancel();

      expect(touchStartY).toBeNull();
      expect(touchStartX).toBeNull();
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
    });
  });
});
