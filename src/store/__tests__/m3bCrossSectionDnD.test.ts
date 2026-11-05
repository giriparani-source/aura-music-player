import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../usePlayerStore';
import { Song } from '../../types/music';
import { audioService } from '../../services/audioService';
import { DropResult } from '@hello-pangea/dnd';

// Polyfill localStorage for node environment if not present
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] || null,
    length: 0
  } as Storage;
}

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

function createSong(id: string, title: string, artist = 'Aura Artist'): Song {
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

describe('Milestone 3B: Cross-Section Drag-and-Drop & Store Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 180,
      queue: [],
      queueIndex: -1,
      userQueue: [],
      isShuffle: false,
      shuffleMode: 'off',
      isFairShuffle: false,
      shuffledQueueOrder: [],
      repeatMode: 'off'
    });
  });

  describe('Suite 1: Reordering within User Queue', () => {
    it('reorders user-queued songs via reorderUserQueue and preserves state invariants', () => {
      const s1 = createSong('s1', 'Track 1');
      const s2 = createSong('s2', 'Track 2');
      const s3 = createSong('s3', 'Track 3');

      const store = usePlayerStore.getState();
      store.addToUserQueue(s1);
      store.addToUserQueue(s2);
      store.addToUserQueue(s3);

      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['s1', 's2', 's3']);

      // Move Track 3 from index 2 to index 0
      usePlayerStore.getState().reorderUserQueue(2, 0);

      const stateAfter = usePlayerStore.getState();
      expect(stateAfter.userQueue.map((s) => s.id)).toEqual(['s3', 's1', 's2']);
      expect(stateAfter.userQueue[0].isUserQueued).toBe(true);
      expect(stateAfter.userQueue[0].queueItemId).toBeDefined();
    });

    it('delegates moveQueueItem(user-queue -> user-queue) to reorderUserQueue', () => {
      const s1 = createSong('s1', 'Alpha');
      const s2 = createSong('s2', 'Beta');
      const s3 = createSong('s3', 'Gamma');

      usePlayerStore.getState().addToUserQueue(s1);
      usePlayerStore.getState().addToUserQueue(s2);
      usePlayerStore.getState().addToUserQueue(s3);

      // Move index 0 to index 2
      usePlayerStore.getState().moveQueueItem(
        { droppableId: 'user-queue', index: 0 },
        { droppableId: 'user-queue', index: 2 }
      );

      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['s2', 's3', 's1']);
    });

    it('supports backward-compatible user-queue-droppable droppableId', () => {
      const s1 = createSong('s1', 'Alpha');
      const s2 = createSong('s2', 'Beta');

      usePlayerStore.getState().addToUserQueue(s1);
      usePlayerStore.getState().addToUserQueue(s2);

      usePlayerStore.getState().moveQueueItem(
        { droppableId: 'user-queue-droppable', index: 0 },
        { droppableId: 'user-queue-droppable', index: 1 }
      );

      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['s2', 's1']);
    });
  });

  describe('Suite 2: Reordering within Context Queue (Sequential Mode)', () => {
    it('reorders upcoming context songs without affecting currently playing song or queueIndex', () => {
      const current = createSong('c0', 'Playing Track');
      const up1 = createSong('u1', 'Upcoming 1');
      const up2 = createSong('u2', 'Upcoming 2');
      const up3 = createSong('u3', 'Upcoming 3');

      usePlayerStore.setState({
        currentSong: current,
        isPlaying: true,
        queue: [current, up1, up2, up3],
        queueIndex: 0,
        isShuffle: false
      });

      // Move Upcoming 3 (offset 2) to Upcoming 1 position (offset 0)
      usePlayerStore.getState().reorderContextQueue(2, 0);

      const state = usePlayerStore.getState();
      expect(state.currentSong?.id).toBe('c0');
      expect(state.queueIndex).toBe(0);
      expect(state.queue[state.queueIndex].id).toBe('c0');
      expect(state.queue.map((s) => s.id)).toEqual(['c0', 'u3', 'u1', 'u2']);
    });

    it('delegates moveQueueItem(context-queue -> context-queue) to reorderContextQueue', () => {
      const c0 = createSong('c0', 'Now Playing');
      const u1 = createSong('u1', 'First Up');
      const u2 = createSong('u2', 'Second Up');
      const u3 = createSong('u3', 'Third Up');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, u1, u2, u3],
        queueIndex: 0,
        isShuffle: false
      });

      usePlayerStore.getState().moveQueueItem(
        { droppableId: 'context-queue', index: 0 },
        { droppableId: 'context-queue', index: 2 }
      );

      const state = usePlayerStore.getState();
      expect(state.queue.map((s) => s.id)).toEqual(['c0', 'u2', 'u3', 'u1']);
      expect(state.currentSong?.id).toBe('c0');
      expect(state.queueIndex).toBe(0);
    });

    it('ignores invalid offsets or no-op movements gracefully', () => {
      const c0 = createSong('c0', 'Playing');
      const u1 = createSong('u1', 'Upcoming');

      usePlayerStore.setState({
        currentSong: c0,
        queue: [c0, u1],
        queueIndex: 0,
        isShuffle: false
      });

      // Out of bounds
      usePlayerStore.getState().reorderContextQueue(-1, 0);
      usePlayerStore.getState().reorderContextQueue(0, 5);
      usePlayerStore.getState().reorderContextQueue(0, 0); // Same index

      expect(usePlayerStore.getState().queue.map((s) => s.id)).toEqual(['c0', 'u1']);
    });
  });

  describe('Suite 3: Reordering within Context Queue (Shuffle Mode)', () => {
    it('reorders shuffledQueueOrder while leaving the original queue array unmodified', () => {
      const c0 = createSong('c0', 'Track 0');
      const c1 = createSong('c1', 'Track 1');
      const c2 = createSong('c2', 'Track 2');
      const c3 = createSong('c3', 'Track 3');

      // queue: [c0, c1, c2, c3]
      // shuffledQueueOrder: [0, 2, 3, 1] (Playing c0 at index 0; upcoming are c2, c3, c1)
      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, c1, c2, c3],
        queueIndex: 0,
        isShuffle: true,
        shuffledQueueOrder: [0, 2, 3, 1]
      });

      // Upcoming tracks are:
      // offset 0 -> queue[2] (c2)
      // offset 1 -> queue[3] (c3)
      // offset 2 -> queue[1] (c1)

      // Move offset 2 (c1) to offset 0 (before c2)
      usePlayerStore.getState().reorderContextQueue(2, 0);

      const state = usePlayerStore.getState();
      // Original queue is completely unchanged
      expect(state.queue.map((s) => s.id)).toEqual(['c0', 'c1', 'c2', 'c3']);
      // Shuffled order updated: [0, 1, 2, 3]
      expect(state.shuffledQueueOrder).toEqual([0, 1, 2, 3]);
      expect(state.currentSong?.id).toBe('c0');
      expect(state.queueIndex).toBe(0);
    });

    it('preserves shuffledQueueOrder.length === queue.length invariant in shuffle reordering', () => {
      const songs = Array.from({ length: 6 }, (_, i) => createSong(`s${i}`, `Song ${i}`));
      usePlayerStore.setState({
        currentSong: songs[2],
        isPlaying: true,
        queue: songs,
        queueIndex: 2,
        isShuffle: true,
        shuffledQueueOrder: [2, 0, 5, 1, 4, 3]
      });

      // Reorder upcoming: offset 3 (song s4 at index 4) to offset 0 (before s0)
      usePlayerStore.getState().reorderContextQueue(3, 0);

      const state = usePlayerStore.getState();
      expect(state.shuffledQueueOrder.length).toBe(state.queue.length);
      expect(state.shuffledQueueOrder[0]).toBe(2); // Current song still at position 0 in shuffle
      expect(state.shuffledQueueOrder[1]).toBe(4); // s4 moved to next
      expect(state.currentSong?.id).toBe('s2');
    });
  });

  describe('Suite 4: Cross-Dragging: Context Queue to User Queue', () => {
    it('drags an upcoming context song into an EMPTY user queue', () => {
      const c0 = createSong('c0', 'Playing Song');
      const u1 = createSong('u1', 'Upcoming 1');
      const u2 = createSong('u2', 'Upcoming 2');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, u1, u2],
        queueIndex: 0,
        userQueue: [],
        isShuffle: false
      });

      // Drag upcoming context track 0 (u1) into user queue at index 0
      usePlayerStore.getState().moveQueueItem(
        { droppableId: 'context-queue', index: 0 },
        { droppableId: 'user-queue', index: 0 }
      );

      const state = usePlayerStore.getState();
      // u1 is now in userQueue with metadata
      expect(state.userQueue.length).toBe(1);
      expect(state.userQueue[0].id).toBe('u1');
      expect(state.userQueue[0].isUserQueued).toBe(true);
      expect(state.userQueue[0].queueItemId).toBeDefined();

      // u1 was removed from context queue
      expect(state.queue.map((s) => s.id)).toEqual(['c0', 'u2']);
      expect(state.currentSong?.id).toBe('c0');
      expect(state.queueIndex).toBe(0);
      expect(state.queue[state.queueIndex].id).toBe('c0');
    });

    it('drags an upcoming context song into a POPULATED user queue at specific index', () => {
      const c0 = createSong('c0', 'Playing');
      const u1 = createSong('u1', 'Context Upcoming 1');
      const u2 = createSong('u2', 'Context Upcoming 2');

      const q1 = createSong('q1', 'Already Queued 1');
      const q2 = createSong('q2', 'Already Queued 2');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, u1, u2],
        queueIndex: 0,
        isShuffle: false
      });
      usePlayerStore.getState().addToUserQueue(q1);
      usePlayerStore.getState().addToUserQueue(q2);

      expect(usePlayerStore.getState().userQueue.map((s) => s.id)).toEqual(['q1', 'q2']);

      // Drag Context Upcoming 2 (u2, offset 1) into userQueue between q1 and q2 (index 1)
      usePlayerStore.getState().moveQueueItem(
        { droppableId: 'context-queue', index: 1 },
        { droppableId: 'user-queue', index: 1 }
      );

      const state = usePlayerStore.getState();
      expect(state.userQueue.map((s) => s.id)).toEqual(['q1', 'u2', 'q2']);
      expect(state.queue.map((s) => s.id)).toEqual(['c0', 'u1']);
    });

    it('adjusts queueIndex correctly when context track with index < queueIndex is moved in shuffle mode', () => {
      // In shuffle mode: queue has tracks [A, B, C, D]
      // c is playing at queueIndex 2.
      // shuffledQueueOrder: [2 (C), 0 (A), 1 (B), 3 (D)]
      const a = createSong('a', 'Song A');
      const b = createSong('b', 'Song B');
      const c = createSong('c', 'Song C');
      const d = createSong('d', 'Song D');

      usePlayerStore.setState({
        currentSong: c,
        isPlaying: true,
        queue: [a, b, c, d],
        queueIndex: 2, // C is at index 2
        isShuffle: true,
        shuffledQueueOrder: [2, 0, 1, 3],
        userQueue: []
      });

      // Upcoming track at offset 0 in shuffle is Song A (index 0 in queue array)
      // Moving Song A removes queue[0]. Since 0 < queueIndex (2), queueIndex MUST shift to 1
      // so queue[queueIndex] remains Song C!
      usePlayerStore.getState().moveContextToUserQueue(0, 0);

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(1);
      expect(state.userQueue[0].id).toBe('a');
      expect(state.queue.map((s) => s.id)).toEqual(['b', 'c', 'd']);
      // Crucial: queueIndex shifted from 2 to 1!
      expect(state.queueIndex).toBe(1);
      expect(state.queue[state.queueIndex].id).toBe('c');
      expect(state.currentSong?.id).toBe('c');

      // Shuffled order remapped and length preserved
      expect(state.shuffledQueueOrder.length).toBe(state.queue.length);
      expect(state.shuffledQueueOrder.includes(state.queueIndex)).toBe(true);
      expect(state.shuffledQueueOrder[0]).toBe(1); // C is now index 1
    });
  });

  describe('Suite 5: Cross-Dragging: User Queue to Context Queue', () => {
    it('demotes a user-queued song into upcoming context queue (sequential mode)', () => {
      const c0 = createSong('c0', 'Now Playing');
      const u1 = createSong('u1', 'Upcoming 1');
      const u2 = createSong('u2', 'Upcoming 2');
      const q1 = createSong('q1', 'User Queued Song');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, u1, u2],
        queueIndex: 0,
        isShuffle: false
      });
      usePlayerStore.getState().addToUserQueue(q1);

      expect(usePlayerStore.getState().userQueue.length).toBe(1);

      // Move q1 (index 0 of user-queue) to context-queue at destination offset 1 (between u1 and u2)
      usePlayerStore.getState().moveQueueItem(
        { droppableId: 'user-queue', index: 0 },
        { droppableId: 'context-queue', index: 1 }
      );

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(0);
      expect(state.queue.map((s) => s.id)).toEqual(['c0', 'u1', 'q1', 'u2']);
      expect(state.currentSong?.id).toBe('c0');
      expect(state.queueIndex).toBe(0);
      expect(state.queue[state.queueIndex].id).toBe('c0');
    });

    it('demotes a user-queued song into upcoming context queue in shuffle mode', () => {
      const c0 = createSong('c0', 'Track 0');
      const c1 = createSong('c1', 'Track 1');
      const c2 = createSong('c2', 'Track 2');
      const q1 = createSong('q1', 'Queued Track');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, c1, c2],
        queueIndex: 0,
        isShuffle: true,
        shuffledQueueOrder: [0, 2, 1]
      });
      usePlayerStore.getState().addToUserQueue(q1);

      // In shuffle mode: upcoming order is c2, c1
      // Demote q1 to destination offset 0 (to play next in shuffle!)
      usePlayerStore.getState().moveUserToContextQueue(0, 0);

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(0);
      expect(state.queue.some((s) => s.id === 'q1')).toBe(true);
      expect(state.shuffledQueueOrder.length).toBe(state.queue.length);

      // In shuffledQueueOrder, position 0 is c0 (current), position 1 is now q1!
      const currentPos = state.shuffledQueueOrder.indexOf(state.queueIndex);
      const nextShuffleIndex = state.shuffledQueueOrder[currentPos + 1];
      expect(state.queue[nextShuffleIndex].id).toBe('q1');
    });

    it('demotes a user-queued song into upcoming context queue in shuffle mode when queueIndex is near end of playlist (queueIndex + 1 + destOffset >= queue.length)', () => {
      // 10-song playlist, currently playing track 8 (near the end of queue)
      const songs = Array.from({ length: 10 }, (_, i) => createSong(`c${i}`, `Context Song ${i}`));
      const userTrack = createSong('u1', 'User Queued Song');

      // Shuffled order: track 8 is playing first, followed by remaining 9 tracks
      // currentPos = 0, upcomingCount = 9
      const shuffleOrder = [8, 0, 1, 2, 3, 4, 5, 6, 7, 9];

      usePlayerStore.setState({
        currentSong: songs[8],
        isPlaying: true,
        queue: [...songs],
        queueIndex: 8,
        isShuffle: true,
        isFairShuffle: false,
        shuffleMode: 'fair',
        shuffledQueueOrder: [...shuffleOrder],
        userQueue: []
      });
      usePlayerStore.getState().addToUserQueue(userTrack);
      expect(usePlayerStore.getState().userQueue.length).toBe(1);

      // Move userTrack into upcoming context at destinationOffset = 3
      // Buggy code computed absInsert = (8 + 1) + 3 = 12 (> queue.length 10)
      usePlayerStore.getState().moveUserToContextQueue(0, 3);

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(0);
      expect(state.queue.length).toBe(11);
      expect(state.shuffledQueueOrder.length).toBe(11);

      // Invariant: currentSong remains undisturbed at queueIndex 8
      expect(state.queueIndex).toBe(8);
      expect(state.queue[state.queueIndex].id).toBe('c8');
      expect(state.currentSong?.id).toBe('c8');

      // Invariant: all indices in shuffledQueueOrder must be strictly valid in queue
      for (const idx of state.shuffledQueueOrder) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(state.queue.length);
        expect(state.queue[idx]).toBeDefined();
      }

      // Invariant: strictly unique indices 0..10
      const sorted = [...state.shuffledQueueOrder].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: 11 }, (_, i) => i));

      // Invariant: inserted song is at position upcomingStart + 3 = 4 in shuffledQueueOrder
      const insertedQueueIdx = state.shuffledQueueOrder[4];
      expect(state.queue[insertedQueueIdx].id).toBe('u1');
    });
  });

  describe('Suite 6: Playback Progression via nextSong() Immediate Synchronization', () => {
    it('immediately plays a reordered context song when nextSong() is triggered', () => {
      const c0 = createSong('c0', 'Track 0');
      const c1 = createSong('c1', 'Track 1');
      const c2 = createSong('c2', 'Track 2');
      const c3 = createSong('c3', 'Track 3');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, c1, c2, c3],
        queueIndex: 0,
        userQueue: [],
        isShuffle: false
      });

      // Default next track would be c1.
      // Move c3 (offset 2) to offset 0:
      usePlayerStore.getState().reorderContextQueue(2, 0);
      expect(usePlayerStore.getState().queue.map((s) => s.id)).toEqual(['c0', 'c3', 'c1', 'c2']);

      // Advance track
      usePlayerStore.getState().nextSong();

      expect(audioService.playSong).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c3' })
      );
      expect(usePlayerStore.getState().currentSong?.id).toBe('c3');
    });

    it('promotes context track to user queue so it plays before all context tracks', () => {
      const c0 = createSong('c0', 'Track 0');
      const c1 = createSong('c1', 'Track 1');
      const c2 = createSong('c2', 'Track 2');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, c1, c2],
        queueIndex: 0,
        userQueue: [],
        isShuffle: false
      });

      // Drag context track c2 into userQueue
      usePlayerStore.getState().moveContextToUserQueue(1, 0);

      // Verify nextSong() plays user-queued c2 first
      usePlayerStore.getState().nextSong();

      expect(audioService.playSong).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c2' })
      );
      expect(usePlayerStore.getState().currentSong?.id).toBe('c2');
      expect(usePlayerStore.getState().userQueue.length).toBe(0);

      // Then nextSong() advances into remaining context queue (c1)
      usePlayerStore.getState().nextSong();
      expect(audioService.playSong).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c1' })
      );
      expect(usePlayerStore.getState().currentSong?.id).toBe('c1');
    });

    it('immediately reflects new sequence in shuffle mode on nextSong()', () => {
      const c0 = createSong('c0', 'Track 0');
      const c1 = createSong('c1', 'Track 1');
      const c2 = createSong('c2', 'Track 2');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, c1, c2],
        queueIndex: 0,
        isShuffle: true,
        shuffledQueueOrder: [0, 1, 2] // Next would be c1
      });

      // Swap upcoming: move offset 1 (c2) to offset 0 (c2 now next)
      usePlayerStore.getState().reorderContextQueue(1, 0);
      expect(usePlayerStore.getState().shuffledQueueOrder).toEqual([0, 2, 1]);

      usePlayerStore.getState().nextSong();

      expect(audioService.playSong).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c2' })
      );
      expect(usePlayerStore.getState().currentSong?.id).toBe('c2');
    });

    it('advances playback seamlessly via nextSong() to a cross-dropped song in shuffle mode when queueIndex was near playlist end', () => {
      const songs = Array.from({ length: 6 }, (_, i) => createSong(`c${i}`, `Context Song ${i}`));
      const userTrack = createSong('u1', 'Demoted Song');

      // queueIndex = 4 (c4), order = [4, 1, 0, 5, 2, 3]
      // upcoming tracks: c1 (offset 0), c0 (offset 1), c5 (offset 2), c2 (offset 3), c3 (offset 4)
      usePlayerStore.setState({
        currentSong: songs[4],
        isPlaying: true,
        queue: [...songs],
        queueIndex: 4,
        isShuffle: true,
        isFairShuffle: false,
        shuffleMode: 'fair',
        shuffledQueueOrder: [4, 1, 0, 5, 2, 3],
        userQueue: []
      });
      usePlayerStore.getState().addToUserQueue(userTrack);

      // Demote userTrack to upcoming offset 2 (between c0 and c5)
      usePlayerStore.getState().moveUserToContextQueue(0, 2);

      // Advance 1: should play c1
      usePlayerStore.getState().nextSong();
      expect(usePlayerStore.getState().currentSong?.id).toBe('c1');

      // Advance 2: should play c0
      usePlayerStore.getState().nextSong();
      expect(usePlayerStore.getState().currentSong?.id).toBe('c0');

      // Advance 3: should play demoted song u1 without stalls or undefined reads!
      usePlayerStore.getState().nextSong();
      expect(usePlayerStore.getState().currentSong?.id).toBe('u1');
    });
  });

  describe('Suite 7: Active Playback Invariants & Safety Guarantees', () => {
    it('ensures currentSong is never stopped or interrupted during reorders', () => {
      const c0 = createSong('c0', 'Playing Track');
      const u1 = createSong('u1', 'Upcoming 1');
      const u2 = createSong('u2', 'Upcoming 2');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, u1, u2],
        queueIndex: 0,
        userQueue: []
      });

      // Reorder context
      usePlayerStore.getState().reorderContextQueue(1, 0);
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(audioService.pause).not.toHaveBeenCalled();

      // Move to user queue
      usePlayerStore.getState().moveContextToUserQueue(0, 0);
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(audioService.pause).not.toHaveBeenCalled();

      // Move back to context
      usePlayerStore.getState().moveUserToContextQueue(0, 0);
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(audioService.pause).not.toHaveBeenCalled();
    });

    it('ensures queue[queueIndex] remains strictly equal to currentSong', () => {
      const s0 = createSong('s0', 'Song 0');
      const s1 = createSong('s1', 'Song 1');
      const s2 = createSong('s2', 'Song 2');
      const s3 = createSong('s3', 'Song 3');

      usePlayerStore.setState({
        currentSong: s1,
        isPlaying: true,
        queue: [s0, s1, s2, s3],
        queueIndex: 1
      });

      // Sequential reorder upcoming (s3 to s2)
      usePlayerStore.getState().reorderContextQueue(1, 0);
      let state = usePlayerStore.getState();
      expect(state.queue[state.queueIndex].id).toBe(state.currentSong?.id);

      // Move s3 to user queue
      usePlayerStore.getState().moveContextToUserQueue(0, 0);
      state = usePlayerStore.getState();
      expect(state.queue[state.queueIndex].id).toBe(state.currentSong?.id);

      // Move s3 back to context
      usePlayerStore.getState().moveUserToContextQueue(0, 0);
      state = usePlayerStore.getState();
      expect(state.queue[state.queueIndex].id).toBe(state.currentSong?.id);
    });

    it('clearing user queue leaves currentSong and context queue intact after cross-moves', () => {
      const c0 = createSong('c0', 'Playing');
      const c1 = createSong('c1', 'Context Track');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, c1],
        queueIndex: 0,
        userQueue: []
      });

      // Move c1 to userQueue
      usePlayerStore.getState().moveContextToUserQueue(0, 0);
      expect(usePlayerStore.getState().userQueue.length).toBe(1);

      // User clears userQueue
      usePlayerStore.getState().clearUserQueue();

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(0);
      expect(state.currentSong?.id).toBe('c0');
      expect(state.isPlaying).toBe(true);
      expect(state.queue.length).toBe(1);
    });
  });

  describe('Suite 8: UI Component Drag-and-Drop Contracts & DropResult Verification', () => {
    // Replicate QueueSheet handleDragEnd logic exactly as implemented in QueueSheet.tsx:613-622
    const simulateQueueSheetDragEnd = (result: DropResult) => {
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

    it('processes DropResult moving context song into user queue', () => {
      const c0 = createSong('c0', 'Playing Track');
      const u1 = createSong('u1', 'Upcoming 1');
      const u2 = createSong('u2', 'Upcoming 2');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, u1, u2],
        queueIndex: 0,
        userQueue: [],
        isShuffle: false
      });

      const dropResult: DropResult = {
        draggableId: 'ctx-1-u1',
        type: 'DEFAULT',
        source: { droppableId: 'context-queue', index: 0 },
        destination: { droppableId: 'user-queue', index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null
      };

      simulateQueueSheetDragEnd(dropResult);

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(1);
      expect(state.userQueue[0].id).toBe('u1');
      expect(state.queue.map((s) => s.id)).toEqual(['c0', 'u2']);
    });

    it('processes DropResult moving user-queued song into context queue', () => {
      const c0 = createSong('c0', 'Playing Track');
      const u1 = createSong('u1', 'Upcoming 1');
      const q1 = createSong('q1', 'Queued 1');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, u1],
        queueIndex: 0,
        userQueue: [],
        isShuffle: false
      });
      usePlayerStore.getState().addToUserQueue(q1);

      const dropResult: DropResult = {
        draggableId: usePlayerStore.getState().userQueue[0].queueItemId,
        type: 'DEFAULT',
        source: { droppableId: 'user-queue', index: 0 },
        destination: { droppableId: 'context-queue', index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null
      };

      simulateQueueSheetDragEnd(dropResult);

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(0);
      expect(state.queue.map((s) => s.id)).toEqual(['c0', 'q1', 'u1']);
    });

    it('ignores cancelled or no-op DropResult events without state changes', () => {
      const c0 = createSong('c0', 'Track 0');
      const u1 = createSong('u1', 'Track 1');

      usePlayerStore.setState({
        currentSong: c0,
        isPlaying: true,
        queue: [c0, u1],
        queueIndex: 0,
        userQueue: []
      });

      // Cancelled drop (destination: null)
      simulateQueueSheetDragEnd({
        draggableId: 'ctx-1-u1',
        type: 'DEFAULT',
        source: { droppableId: 'context-queue', index: 0 },
        destination: null,
        reason: 'CANCEL',
        mode: 'FLUID',
        combine: null
      });

      expect(usePlayerStore.getState().queue.map((s) => s.id)).toEqual(['c0', 'u1']);

      // Dropped on same index
      simulateQueueSheetDragEnd({
        draggableId: 'ctx-1-u1',
        type: 'DEFAULT',
        source: { droppableId: 'context-queue', index: 0 },
        destination: { droppableId: 'context-queue', index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null
      });

      expect(usePlayerStore.getState().queue.map((s) => s.id)).toEqual(['c0', 'u1']);
    });

    it('handles cross-droppable moveQueueItem from user-queue to context-queue in shuffle mode with high queueIndex', () => {
      const songs = Array.from({ length: 8 }, (_, i) => createSong(`c${i}`, `Song ${i}`));
      const userTrack = createSong('u_cross', 'Cross DnD Item');

      // queueIndex = 7 (last item in queue array), order = [7, 2, 4, 1, 0, 6, 3, 5]
      usePlayerStore.setState({
        currentSong: songs[7],
        isPlaying: true,
        queue: [...songs],
        queueIndex: 7,
        isShuffle: true,
        isFairShuffle: false,
        shuffleMode: 'fair',
        shuffledQueueOrder: [7, 2, 4, 1, 0, 6, 3, 5],
        userQueue: []
      });
      usePlayerStore.getState().addToUserQueue(userTrack);

      // User drags item from user-queue to context-queue at destination offset 1
      usePlayerStore.getState().moveQueueItem(
        { droppableId: 'user-queue', index: 0 },
        { droppableId: 'context-queue', index: 1 }
      );

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(0);
      expect(state.queue.length).toBe(9);
      expect(state.shuffledQueueOrder.length).toBe(9);
      expect(state.currentSong?.id).toBe('c7');

      // Position 2 in shuffledQueueOrder must be the moved song
      const targetQueueIndex = state.shuffledQueueOrder[2];
      expect(state.queue[targetQueueIndex].id).toBe('u_cross');
    });

    it('verifies QueueSheet.tsx static structural implementation adheres to all UX and DnD constraints', () => {
      const queueSheetPath = path.resolve(__dirname, '../../components/player/QueueSheet.tsx');
      const fileContent = fs.readFileSync(queueSheetPath, 'utf-8');

      // 1. DragDropContext wraps both sections
      expect(fileContent).toContain('<DragDropContext onDragEnd={handleDragEnd}>');
      expect(fileContent).toContain('moveQueueItem(source, destination)');

      // 2. Empty userQueue dashed drop target exists
      expect(fileContent).toContain('border-dashed');
      expect(fileContent).toContain('min-h-[50px]');
      expect(fileContent).toContain('droppableId="user-queue"');

      // 3. ContextQueue section contains Droppable and Draggable
      expect(fileContent).toContain('droppableId="context-queue"');
      expect(fileContent).toContain('key={`ctx-${contextIndex}-${song.id}`}');
      expect(fileContent).toContain('draggableId={`ctx-${contextIndex}-${song.id}`}');

      // 4. Drag handle button on context items has touch-none, cursor-grab and stopPropagation
      expect(fileContent).toContain('onClick={(e) => e.stopPropagation()}');
      expect(fileContent).toContain('touch-none');
      expect(fileContent).toContain('cursor-grab active:cursor-grabbing');
      expect(fileContent).toContain('aria-label={`Drag to reorder ${song.title}`}');

      // 5. Desktop hover play overlay on artwork
      expect(fileContent).toContain('group-hover:opacity-100 transition-opacity rounded pointer-events-none');
      expect(fileContent).toContain('<Play size={14} className="text-white fill-white" />');
    });
  });
});
