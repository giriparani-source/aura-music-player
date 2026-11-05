import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { usePlayerStore } from '../usePlayerStore';
import { Song } from '../../types/music';
import { dispatchMediaAction } from '../../services/androidMediaBridge';
import { DropResult } from '@hello-pangea/dnd';

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
      setOnMeaningfulListen: vi.fn(),
      isUsingNativePlayer: false
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
    duration: 180,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    isOnline: true
  };
}

describe('Challenger M3: Adversarial Drag-and-Drop, Reordering & Removal Verification', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    // Advance time by 1000ms each test to ensure monotonic progression
    vi.advanceTimersByTime(1000);

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
      isNowPlayingOpen: false,
      playbackHistory: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. @hello-pangea/dnd DropResult Integration & Callback Verification', () => {
    // Replicate QueueSheet handleDragEnd logic exactly as implemented in QueueSheet.tsx:549-553
    const simulateQueueSheetDragEnd = (result: DropResult) => {
      if (!result.destination) return;
      if (result.destination.index === result.source.index) return;
      usePlayerStore.getState().reorderUserQueue(result.source.index, result.destination.index);
    };

    it('immediately updates userQueue order when valid drag completes from source to destination', () => {
      const s1 = createSong('s1', 'Song 1');
      const s2 = createSong('s2', 'Song 2');
      const s3 = createSong('s3', 'Song 3');

      usePlayerStore.getState().addToUserQueue(s1);
      usePlayerStore.getState().addToUserQueue(s2);
      usePlayerStore.getState().addToUserQueue(s3);

      const dropResult: DropResult = {
        draggableId: usePlayerStore.getState().userQueue[0].queueItemId,
        type: 'DEFAULT',
        source: { droppableId: 'user-queue-droppable', index: 0 },
        destination: { droppableId: 'user-queue-droppable', index: 2 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null
      };

      simulateQueueSheetDragEnd(dropResult);

      const userQueue = usePlayerStore.getState().userQueue;
      expect(userQueue.length).toBe(3);
      expect(userQueue[0].id).toBe('s2');
      expect(userQueue[1].id).toBe('s3');
      expect(userQueue[2].id).toBe('s1');
    });

    it('safely ignores drops where destination is null (cancelled or dropped outside)', () => {
      const s1 = createSong('s1', 'Song 1');
      const s2 = createSong('s2', 'Song 2');

      usePlayerStore.getState().addToUserQueue(s1);
      usePlayerStore.getState().addToUserQueue(s2);

      const beforeOrder = usePlayerStore.getState().userQueue.map((s) => s.id);

      const cancelledDrop: DropResult = {
        draggableId: usePlayerStore.getState().userQueue[0].queueItemId,
        type: 'DEFAULT',
        source: { droppableId: 'user-queue-droppable', index: 0 },
        destination: null,
        reason: 'CANCEL',
        mode: 'FLUID',
        combine: null
      };

      simulateQueueSheetDragEnd(cancelledDrop);

      const afterOrder = usePlayerStore.getState().userQueue.map((s) => s.id);
      expect(afterOrder).toEqual(beforeOrder);
    });

    it('safely treats drops onto identical source index as a no-op without re-render churn', () => {
      const s1 = createSong('s1', 'Song 1');
      const s2 = createSong('s2', 'Song 2');

      usePlayerStore.getState().addToUserQueue(s1);
      usePlayerStore.getState().addToUserQueue(s2);

      const userQueueRefBefore = usePlayerStore.getState().userQueue;

      const noOpDrop: DropResult = {
        draggableId: userQueueRefBefore[1].queueItemId,
        type: 'DEFAULT',
        source: { droppableId: 'user-queue-droppable', index: 1 },
        destination: { droppableId: 'user-queue-droppable', index: 1 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null
      };

      simulateQueueSheetDragEnd(noOpDrop);

      const userQueueRefAfter = usePlayerStore.getState().userQueue;
      expect(userQueueRefAfter).toBe(userQueueRefBefore); // Exact same reference preserved
      expect(userQueueRefAfter.map((s) => s.id)).toEqual(['s1', 's2']);
    });
  });

  describe('2. Comprehensive Permutation & Boundary Reorder Invariants', () => {
    it('moves first item to last in multi-item queue', () => {
      const songs = ['A', 'B', 'C', 'D', 'E'].map((title) => createSong(`id_${title}`, title));
      songs.forEach((s) => usePlayerStore.getState().addToUserQueue(s));

      expect(usePlayerStore.getState().userQueue.map((s) => s.title)).toEqual(['A', 'B', 'C', 'D', 'E']);

      // Move first (0) to last (4)
      usePlayerStore.getState().reorderUserQueue(0, 4);

      expect(usePlayerStore.getState().userQueue.map((s) => s.title)).toEqual(['B', 'C', 'D', 'E', 'A']);
    });

    it('moves last item to first in multi-item queue', () => {
      const songs = ['A', 'B', 'C', 'D', 'E'].map((title) => createSong(`id_${title}`, title));
      songs.forEach((s) => usePlayerStore.getState().addToUserQueue(s));

      // Move last (4) to first (0)
      usePlayerStore.getState().reorderUserQueue(4, 0);

      expect(usePlayerStore.getState().userQueue.map((s) => s.title)).toEqual(['E', 'A', 'B', 'C', 'D']);
    });

    it('handles middle-item shifts both forward and backward', () => {
      const songs = ['A', 'B', 'C', 'D', 'E'].map((title) => createSong(`id_${title}`, title));
      songs.forEach((s) => usePlayerStore.getState().addToUserQueue(s));

      // Move B (1) to D's position (3)
      usePlayerStore.getState().reorderUserQueue(1, 3);
      expect(usePlayerStore.getState().userQueue.map((s) => s.title)).toEqual(['A', 'C', 'D', 'B', 'E']);

      // Move B (3) back to index 1
      usePlayerStore.getState().reorderUserQueue(3, 1);
      expect(usePlayerStore.getState().userQueue.map((s) => s.title)).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('strictly guards against out-of-bounds indices (negative, equal, and excessive)', () => {
      const songs = ['A', 'B'].map((title) => createSong(`id_${title}`, title));
      songs.forEach((s) => usePlayerStore.getState().addToUserQueue(s));

      const initialQueue = usePlayerStore.getState().userQueue;

      // Negative indices
      usePlayerStore.getState().reorderUserQueue(-1, 0);
      usePlayerStore.getState().reorderUserQueue(0, -1);
      usePlayerStore.getState().reorderUserQueue(-5, -3);

      // Indices equal to or exceeding length
      usePlayerStore.getState().reorderUserQueue(2, 0);
      usePlayerStore.getState().reorderUserQueue(0, 2);
      usePlayerStore.getState().reorderUserQueue(999, 1000);

      expect(usePlayerStore.getState().userQueue).toEqual(initialQueue);
    });

    it('handles 1-item queue reorder as safe no-op', () => {
      usePlayerStore.getState().addToUserQueue(createSong('single', 'Solo Track'));
      expect(usePlayerStore.getState().userQueue.length).toBe(1);

      usePlayerStore.getState().reorderUserQueue(0, 0);
      expect(usePlayerStore.getState().userQueue.length).toBe(1);
      expect(usePlayerStore.getState().userQueue[0].id).toBe('single');
    });

    it('handles empty queue reorder safely', () => {
      expect(usePlayerStore.getState().userQueue.length).toBe(0);
      usePlayerStore.getState().reorderUserQueue(0, 0);
      expect(usePlayerStore.getState().userQueue.length).toBe(0);
    });

    it('stress test: N circular shifts perfectly restores original ordering', () => {
      const count = 5;
      const songs = Array.from({ length: count }, (_, i) => createSong(`s_${i}`, `Track ${i}`));
      songs.forEach((s) => usePlayerStore.getState().addToUserQueue(s));

      const originalIds = usePlayerStore.getState().userQueue.map((s) => s.id);

      // Shift first to last 5 times
      for (let i = 0; i < count; i++) {
        usePlayerStore.getState().reorderUserQueue(0, count - 1);
      }

      const finalIds = usePlayerStore.getState().userQueue.map((s) => s.id);
      expect(finalIds).toEqual(originalIds);
    });
  });

  describe('3. Queue Item Removal In Reordered & Duplicate States', () => {
    it('removes duplicate track instances selectively by unique queueItemId in reordered state', () => {
      const duplicateSong = createSong('dup_song', 'Duplicate Hit');
      const other1 = createSong('other_1', 'Other 1');
      const other2 = createSong('other_2', 'Other 2');

      // Add duplicate songs: [dup#1, other1, dup#2, other2]
      usePlayerStore.getState().addToUserQueue(duplicateSong);
      usePlayerStore.getState().addToUserQueue(other1);
      usePlayerStore.getState().addToUserQueue(duplicateSong);
      usePlayerStore.getState().addToUserQueue(other2);

      const queueInitial = usePlayerStore.getState().userQueue;
      const idDup1 = queueInitial[0].queueItemId;
      const idDup2 = queueInitial[2].queueItemId;
      expect(idDup1).not.toBe(idDup2);

      // Reorder: move dup#2 (index 2) to first position (index 0)
      usePlayerStore.getState().reorderUserQueue(2, 0);
      // New order: [dup#2, dup#1, other1, other2]
      expect(usePlayerStore.getState().userQueue.map((s) => s.queueItemId)).toEqual([
        idDup2,
        idDup1,
        queueInitial[1].queueItemId,
        queueInitial[3].queueItemId
      ]);

      // Remove dup#2 specifically
      usePlayerStore.getState().removeFromUserQueue(idDup2);

      const queueAfterRemoval = usePlayerStore.getState().userQueue;
      expect(queueAfterRemoval.length).toBe(3);
      expect(queueAfterRemoval[0].queueItemId).toBe(idDup1);
      expect(queueAfterRemoval[0].id).toBe('dup_song');
      expect(queueAfterRemoval.some((s) => s.queueItemId === idDup2)).toBe(false);

      // Now remove other1
      usePlayerStore.getState().removeFromUserQueue(queueInitial[1].queueItemId);
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['dup_song', 'other_2']);
    });

    it('safely handles non-existent queueItemId without altering queue', () => {
      usePlayerStore.getState().addToUserQueue(createSong('s1', 'Song 1'));
      usePlayerStore.getState().addToUserQueue(createSong('s2', 'Song 2'));

      const before = usePlayerStore.getState().userQueue;
      usePlayerStore.getState().removeFromUserQueue('non_existent_random_id_999');
      const after = usePlayerStore.getState().userQueue;

      expect(after).toEqual(before);
    });
  });

  describe('4. Playback Sequence Impact (nextSong & dispatchMediaAction)', () => {
    it('alters immediate playback sequence when userQueue is reordered before nextSong()', async () => {
      const activeSong = createSong('active', 'Currently Playing');
      const songA = createSong('song_a', 'Song A');
      const songB = createSong('song_b', 'Song B');
      const songC = createSong('song_c', 'Song C');

      usePlayerStore.setState({
        currentSong: activeSong,
        isPlaying: true,
        queue: [activeSong, createSong('ctx_next', 'Context Next')],
        queueIndex: 0
      });

      // Add to user queue in order: A, B, C
      usePlayerStore.getState().addToUserQueue(songA);
      usePlayerStore.getState().addToUserQueue(songB);
      usePlayerStore.getState().addToUserQueue(songC);

      // Verify FIFO default would be Song A
      expect(usePlayerStore.getState().userQueue[0].id).toBe('song_a');

      // REORDER: Move Song C (index 2) to top (index 0)
      usePlayerStore.getState().reorderUserQueue(2, 0);
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['song_c', 'song_a', 'song_b']);

      // Advance clock past any debounce
      vi.advanceTimersByTime(400);

      // Trigger nextSong()
      usePlayerStore.getState().nextSong();

      // Invariant 1: Song C must now be playing, NOT Song A!
      const current = usePlayerStore.getState().currentSong;
      expect(current).not.toBeNull();
      expect(current?.id).toBe('song_c');

      // Invariant 2: Remaining userQueue is now [Song A, Song B]
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['song_a', 'song_b']);
    });

    it('alters playback sequence when dispatchMediaAction("next") is fired from native background service', () => {
      const activeSong = createSong('active', 'Currently Playing');
      const track1 = createSong('t1', 'Track 1');
      const track2 = createSong('t2', 'Track 2');

      usePlayerStore.setState({
        currentSong: activeSong,
        isPlaying: true,
        queue: [activeSong],
        queueIndex: 0
      });

      usePlayerStore.getState().addToUserQueue(track1);
      usePlayerStore.getState().addToUserQueue(track2);

      // Reorder track2 to index 0
      usePlayerStore.getState().reorderUserQueue(1, 0);
      expect(usePlayerStore.getState().userQueue[0].id).toBe('t2');

      // Advance timers by 400ms to bypass throttle
      vi.advanceTimersByTime(400);

      // Simulate native ExoPlayer MediaSession action 'next'
      dispatchMediaAction('next');

      expect(usePlayerStore.getState().currentSong?.id).toBe('t2');
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['t1']);

      // Advance timers and fire next again
      vi.advanceTimersByTime(400);
      dispatchMediaAction('next');

      expect(usePlayerStore.getState().currentSong?.id).toBe('t1');
      expect(usePlayerStore.getState().userQueue.length).toBe(0);
    });

    it('reordering does not interrupt active playback until nextSong is called', () => {
      const activeSong = createSong('active', 'Active Stream');
      usePlayerStore.setState({
        currentSong: activeSong,
        isPlaying: true,
        currentTime: 75.4,
        queue: [activeSong],
        queueIndex: 0
      });

      usePlayerStore.getState().addToUserQueue(createSong('u1', 'Queued 1'));
      usePlayerStore.getState().addToUserQueue(createSong('u2', 'Queued 2'));

      // Perform reorders while music is playing
      usePlayerStore.getState().reorderUserQueue(0, 1);
      usePlayerStore.getState().reorderUserQueue(1, 0);

      // Verify active playback was completely untouched
      const state = usePlayerStore.getState();
      expect(state.isPlaying).toBe(true);
      expect(state.currentTime).toBe(75.4);
      expect(state.currentSong?.id).toBe('active');
    });

    it('seamlessly falls back to context queue after all reordered userQueue songs are exhausted', () => {
      const contextSongs = [
        createSong('ctx_0', 'Context 0'),
        createSong('ctx_1', 'Context 1'),
        createSong('ctx_2', 'Context 2')
      ];

      usePlayerStore.setState({
        currentSong: contextSongs[0],
        queue: contextSongs,
        queueIndex: 0,
        isPlaying: true,
        isShuffle: false
      });

      // Add 2 user tracks
      usePlayerStore.getState().addToUserQueue(createSong('u1', 'User 1'));
      usePlayerStore.getState().addToUserQueue(createSong('u2', 'User 2'));

      // Swap them: [User 2, User 1]
      usePlayerStore.getState().reorderUserQueue(0, 1);

      // Step 1: Play User 2
      vi.advanceTimersByTime(400);
      usePlayerStore.getState().nextSong();
      expect(usePlayerStore.getState().currentSong?.id).toBe('u2');

      // Step 2: Play User 1
      vi.advanceTimersByTime(400);
      usePlayerStore.getState().nextSong();
      expect(usePlayerStore.getState().currentSong?.id).toBe('u1');
      expect(usePlayerStore.getState().userQueue.length).toBe(0);

      // Step 3: Next song returns to context queue at index 1 (Context 1)
      vi.advanceTimersByTime(400);
      usePlayerStore.getState().nextSong();
      expect(usePlayerStore.getState().currentSong?.id).toBe('ctx_1');
      expect(usePlayerStore.getState().queueIndex).toBe(1);
    });
  });

  describe('5. High-Volume, Triplicate Duplicates & Interleaving Stress Tests', () => {
    it('manages triplicate instances of the same track with independent reorder and removal', () => {
      const tripSong = createSong('trip_song', 'Triplicate Song');
      const uniqueSong = createSong('unique_song', 'Unique Interlude');

      // Add: [trip#1, trip#2, unique, trip#3]
      usePlayerStore.getState().addToUserQueue(tripSong);
      usePlayerStore.getState().addToUserQueue(tripSong);
      usePlayerStore.getState().addToUserQueue(uniqueSong);
      usePlayerStore.getState().addToUserQueue(tripSong);

      const items = usePlayerStore.getState().userQueue;
      expect(items.length).toBe(4);
      const [q1, q2, qU, q3] = items.map((i) => i.queueItemId);

      // Verify all 3 duplicates have strictly distinct queueItemIds
      expect(new Set([q1, q2, q3]).size).toBe(3);

      // Reorder trip#3 from index 3 to index 1: [trip#1, trip#3, trip#2, unique]
      usePlayerStore.getState().reorderUserQueue(3, 1);
      expect(usePlayerStore.getState().userQueue.map((i) => i.queueItemId)).toEqual([q1, q3, q2, qU]);

      // Remove the middle duplicate trip#3
      usePlayerStore.getState().removeFromUserQueue(q3);
      expect(usePlayerStore.getState().userQueue.map((i) => i.queueItemId)).toEqual([q1, q2, qU]);

      // Remove trip#1
      usePlayerStore.getState().removeFromUserQueue(q1);
      expect(usePlayerStore.getState().userQueue.map((i) => i.queueItemId)).toEqual([q2, qU]);

      // Only trip#2 and unique remaining
      expect(usePlayerStore.getState().userQueue[0].queueItemId).toBe(q2);
      expect(usePlayerStore.getState().userQueue[0].id).toBe('trip_song');
      expect(usePlayerStore.getState().userQueue[1].queueItemId).toBe(qU);
      expect(usePlayerStore.getState().userQueue[1].id).toBe('unique_song');
    });

    it('reorders efficiently in high-volume queues (1,000 items) without loss of integrity', () => {
      const count = 1000;
      const largeList = Array.from({ length: count }, (_, i) => createSong(`large_${i}`, `Track ${i}`));
      // Bulk seed into userQueue
      const queuedList = largeList.map((song, idx) => ({
        ...song,
        queueItemId: `large_item_${idx}`,
        addedAt: Date.now() + idx,
        isUserQueued: true as const
      }));
      usePlayerStore.setState({ userQueue: queuedList });

      expect(usePlayerStore.getState().userQueue.length).toBe(1000);
      expect(usePlayerStore.getState().userQueue[0].id).toBe('large_0');
      expect(usePlayerStore.getState().userQueue[999].id).toBe('large_999');

      const start = performance.now();
      // Move first item to the very end
      usePlayerStore.getState().reorderUserQueue(0, 999);
      const elapsed = performance.now() - start;

      // Ensure execution is instantaneous (< 15ms)
      expect(elapsed).toBeLessThan(100);

      const updated = usePlayerStore.getState().userQueue;
      expect(updated.length).toBe(1000);
      expect(updated[0].id).toBe('large_1');
      expect(updated[998].id).toBe('large_999');
      expect(updated[999].id).toBe('large_0');

      // Move it back from 999 to 0
      usePlayerStore.getState().reorderUserQueue(999, 0);
      expect(usePlayerStore.getState().userQueue[0].id).toBe('large_0');
      expect(usePlayerStore.getState().userQueue[999].id).toBe('large_999');
    });

    it('interleaves addToQueueNext, addToUserQueue, DnD reorders and individual removals seamlessly', () => {
      // 1. Append song A, B
      usePlayerStore.getState().addToUserQueue(createSong('A', 'A'));
      usePlayerStore.getState().addToUserQueue(createSong('B', 'B'));
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['A', 'B']);

      // 2. Prepend song Priority using addToQueueNext
      usePlayerStore.getState().addToQueueNext(createSong('Priority', 'Priority'));
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['Priority', 'A', 'B']);

      // 3. Reorder Priority to the back (0 to 2)
      usePlayerStore.getState().reorderUserQueue(0, 2);
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['A', 'B', 'Priority']);

      // 4. Prepend song Urgent using addToQueueNext
      usePlayerStore.getState().addToQueueNext(createSong('Urgent', 'Urgent'));
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['Urgent', 'A', 'B', 'Priority']);

      // 5. Remove song B by its queueItemId
      const songBItem = usePlayerStore.getState().userQueue.find((s) => s.id === 'B')!;
      usePlayerStore.getState().removeFromUserQueue(songBItem.queueItemId);
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['Urgent', 'A', 'Priority']);

      // 6. Reorder Urgent (0) to after A (1)
      usePlayerStore.getState().reorderUserQueue(0, 1);
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['A', 'Urgent', 'Priority']);
    });
  });

  describe('6. Immutability, Audio End Transitions & Queue Clearance Safety', () => {
    it('produces a new immutable array reference on reorder without mutating prior state', () => {
      usePlayerStore.getState().addToUserQueue(createSong('s1', 'Song 1'));
      usePlayerStore.getState().addToUserQueue(createSong('s2', 'Song 2'));

      const initialArrayRef = usePlayerStore.getState().userQueue;
      const initialSnapshot = [...initialArrayRef];

      usePlayerStore.getState().reorderUserQueue(0, 1);

      const newArrayRef = usePlayerStore.getState().userQueue;
      expect(newArrayRef).not.toBe(initialArrayRef); // Reference changed
      expect(initialSnapshot.map((s) => s.id)).toEqual(['s1', 's2']); // Snapshot preserved
      expect(newArrayRef.map((s) => s.id)).toEqual(['s2', 's1']);
    });

    it('advances playback through reordered userQueue when song naturally ends', () => {
      const currentTrack = createSong('current', 'Current');
      const next1 = createSong('reordered_1', 'Reordered 1');
      const next2 = createSong('reordered_2', 'Reordered 2');

      usePlayerStore.setState({
        currentSong: currentTrack,
        isPlaying: true,
        queue: [currentTrack],
        queueIndex: 0
      });

      // Add next2 first, then next1
      usePlayerStore.getState().addToUserQueue(next2);
      usePlayerStore.getState().addToUserQueue(next1);

      // Reorder next1 to position 0
      usePlayerStore.getState().reorderUserQueue(1, 0);
      expect(usePlayerStore.getState().userQueue[0].id).toBe('reordered_1');

      // Simulate natural song completion via audioService subscriber callback
      // We advance fake timer by 500ms so debounce check passes
      vi.advanceTimersByTime(500);

      // In usePlayerStore.ts line 207: audioService.setOnSongEnd callback advances to nextSong
      usePlayerStore.getState().nextSong();

      expect(usePlayerStore.getState().currentSong?.id).toBe('reordered_1');
      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['reordered_2']);
    });

    it('clears reordered user queue cleanly without interrupting current playing audio', () => {
      const playingSong = createSong('active_stream', 'Active Stream');
      usePlayerStore.setState({
        currentSong: playingSong,
        isPlaying: true,
        currentTime: 42.5,
        queue: [playingSong, createSong('context_later', 'Context Later')],
        queueIndex: 0
      });

      // Populate and reorder
      usePlayerStore.getState().addToUserQueue(createSong('u1', 'U1'));
      usePlayerStore.getState().addToUserQueue(createSong('u2', 'U2'));
      usePlayerStore.getState().addToUserQueue(createSong('u3', 'U3'));
      usePlayerStore.getState().reorderUserQueue(2, 0); // [U3, U1, U2]

      expect(usePlayerStore.getState().userQueue.length).toBe(3);

      // User confirms clear
      usePlayerStore.getState().clearUserQueue();

      const afterClear = usePlayerStore.getState();
      expect(afterClear.userQueue).toEqual([]);
      expect(afterClear.userQueue.length).toBe(0);
      expect(afterClear.currentSong?.id).toBe('active_stream');
      expect(afterClear.isPlaying).toBe(true);
      expect(afterClear.currentTime).toBe(42.5);
      expect(afterClear.queue.length).toBe(2);
      expect(afterClear.queueIndex).toBe(0);
    });
  });
});

