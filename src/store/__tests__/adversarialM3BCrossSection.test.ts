import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../usePlayerStore';
import { Song, QueuedSong } from '../../types/music';

// Polyfill localStorage
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

function createSong(id: string, title: string, artist = 'Aura Artist'): Song {
  return {
    id,
    title,
    artist,
    album: 'Adversarial Test Album',
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

describe('Milestone 3B Empirical Adversarial Test Suite', () => {
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

  describe('1. Rapid Cross-Section Transfers', () => {
    it('moves all upcoming context songs into userQueue one by one, then back in sequential mode', () => {
      const songs = Array.from({ length: 6 }, (_, i) => createSong(`s${i}`, `Song ${i}`));
      usePlayerStore.setState({
        queue: songs,
        queueIndex: 0,
        currentSong: songs[0],
        userQueue: []
      });

      // Initially 5 upcoming songs in context: s1, s2, s3, s4, s5
      for (let i = 0; i < 5; i++) {
        // Always move contextOffset 0 to end of userQueue
        usePlayerStore.getState().moveContextToUserQueue(0, usePlayerStore.getState().userQueue.length);
      }

      let state = usePlayerStore.getState();
      expect(state.queue.length).toBe(1); // Only currentSong left
      expect(state.queue[0].id).toBe('s0');
      expect(state.queueIndex).toBe(0);
      expect(state.currentSong?.id).toBe('s0');
      expect(state.userQueue.length).toBe(5);
      expect(state.userQueue.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);

      // Now move them all back from userQueue to contextQueue one by one
      for (let i = 0; i < 5; i++) {
        // Move sourceIndex 0 to end of upcoming context
        const upcomingCount = usePlayerStore.getState().queue.length - 1 - usePlayerStore.getState().queueIndex;
        usePlayerStore.getState().moveUserToContextQueue(0, upcomingCount);
      }

      state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(0);
      expect(state.queue.length).toBe(6);
      expect(state.queueIndex).toBe(0);
      expect(state.currentSong?.id).toBe('s0');
      expect(state.queue.map((s) => s.id)).toEqual(['s0', 's1', 's2', 's3', 's4', 's5']);
    });

    it('moves all upcoming context songs into userQueue one by one in shuffle mode and preserves all invariants', () => {
      const songs = Array.from({ length: 6 }, (_, i) => createSong(`s${i}`, `Song ${i}`));
      // Let's set a known shuffle order: s2 is currently playing, others are upcoming
      // queueIndex = 2 (s2)
      // order: [2, 4, 1, 5, 0, 3] -> 5 upcoming songs
      usePlayerStore.setState({
        queue: [...songs],
        queueIndex: 2,
        currentSong: songs[2],
        isShuffle: true,
        isFairShuffle: false,
        shuffleMode: 'fair',
        shuffledQueueOrder: [2, 4, 1, 5, 0, 3],
        userQueue: []
      });

      // Move 5 upcoming context songs to userQueue one by one
      for (let i = 0; i < 5; i++) {
        usePlayerStore.getState().moveContextToUserQueue(0, usePlayerStore.getState().userQueue.length);

        const st = usePlayerStore.getState();
        // Invariant checks on EVERY transfer:
        expect(st.currentSong?.id).toBe('s2');
        expect(st.queue[st.queueIndex].id).toBe('s2');
        expect(st.shuffledQueueOrder.length).toBe(st.queue.length);
        expect(new Set(st.shuffledQueueOrder).size).toBe(st.queue.length);
        for (const idx of st.shuffledQueueOrder) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(st.queue.length);
        }
      }

      const finalState = usePlayerStore.getState();
      expect(finalState.queue.length).toBe(1);
      expect(finalState.queue[0].id).toBe('s2');
      expect(finalState.queueIndex).toBe(0);
      expect(finalState.userQueue.length).toBe(5);
      expect(finalState.userQueue.map((s) => s.id)).toEqual(['s4', 's1', 's5', 's0', 's3']);
    });
  });

  describe('2. Edge Cases: Moving into Empty/Non-empty UserQueue with Various Indices', () => {
    it('moves context song into empty userQueue at index 0', () => {
      const songs = [createSong('s0', 'S0'), createSong('s1', 'S1')];
      usePlayerStore.setState({
        queue: songs,
        queueIndex: 0,
        currentSong: songs[0],
        userQueue: []
      });

      usePlayerStore.getState().moveContextToUserQueue(0, 0);

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(1);
      expect(state.userQueue[0].id).toBe('s1');
      expect(state.userQueue[0].isUserQueued).toBe(true);
      expect(state.userQueue[0].queueItemId).toBeDefined();
      expect(state.queue.length).toBe(1);
      expect(state.queue[0].id).toBe('s0');
    });

    it('moves context song into empty userQueue with out-of-bounds negative destination index (-5)', () => {
      const songs = [createSong('s0', 'S0'), createSong('s1', 'S1')];
      usePlayerStore.setState({
        queue: songs,
        queueIndex: 0,
        currentSong: songs[0],
        userQueue: []
      });

      // -5 should clamp to 0
      usePlayerStore.getState().moveContextToUserQueue(0, -5);

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(1);
      expect(state.userQueue[0].id).toBe('s1');
    });

    it('moves context song into empty userQueue with out-of-bounds large destination index (100)', () => {
      const songs = [createSong('s0', 'S0'), createSong('s1', 'S1')];
      usePlayerStore.setState({
        queue: songs,
        queueIndex: 0,
        currentSong: songs[0],
        userQueue: []
      });

      // 100 should clamp to userQueue.length (0)
      usePlayerStore.getState().moveContextToUserQueue(0, 100);

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(1);
      expect(state.userQueue[0].id).toBe('s1');
    });

    it('moves user song into contextQueue with out-of-bounds destinationOffset (-10 and 9999)', () => {
      const s0 = createSong('s0', 'S0');
      const u0 = { ...createSong('u0', 'U0'), queueItemId: 'u-1', addedAt: Date.now(), isUserQueued: true as const };
      const u1 = { ...createSong('u1', 'U1'), queueItemId: 'u-2', addedAt: Date.now(), isUserQueued: true as const };

      usePlayerStore.setState({
        queue: [s0],
        queueIndex: 0,
        currentSong: s0,
        userQueue: [u0, u1]
      });

      // Move with destinationOffset = -10 (should clamp to 0)
      usePlayerStore.getState().moveUserToContextQueue(0, -10);
      let state = usePlayerStore.getState();
      expect(state.queue.length).toBe(2);
      expect(state.queue[1].id).toBe('u0');

      // Move with destinationOffset = 9999 (should clamp to upcomingCount which is 1)
      usePlayerStore.getState().moveUserToContextQueue(0, 9999);
      state = usePlayerStore.getState();
      expect(state.queue.length).toBe(3);
      expect(state.queue[2].id).toBe('u1');
    });
  });

  describe('3. Edge Cases: Moving the Very Last Song', () => {
    it('moves the very last upcoming song of contextQueue to userQueue in sequential mode', () => {
      const songs = [createSong('s0', 'S0'), createSong('s1', 'S1'), createSong('s2', 'S2')];
      usePlayerStore.setState({
        queue: songs,
        queueIndex: 0,
        currentSong: songs[0],
        userQueue: []
      });

      // upcomingCount is 2 (s1 at offset 0, s2 at offset 1). Last song is offset 1.
      usePlayerStore.getState().moveContextToUserQueue(1, 0);

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(1);
      expect(state.userQueue[0].id).toBe('s2');
      expect(state.queue.map((s) => s.id)).toEqual(['s0', 's1']);
      expect(state.queueIndex).toBe(0);
      expect(state.currentSong?.id).toBe('s0');
    });

    it('moves the very last upcoming song of contextQueue to userQueue in shuffle mode', () => {
      const songs = [createSong('s0', 'S0'), createSong('s1', 'S1'), createSong('s2', 'S2')];
      // Shuffle order: [0, 2, 1] -> upcoming: s2 (offset 0), s1 (offset 1)
      usePlayerStore.setState({
        queue: songs,
        queueIndex: 0,
        currentSong: songs[0],
        isShuffle: true,
        isFairShuffle: false,
        shuffleMode: 'fair',
        shuffledQueueOrder: [0, 2, 1],
        userQueue: []
      });

      // Move offset 1 (s1, the last upcoming in shuffle) to userQueue
      usePlayerStore.getState().moveContextToUserQueue(1, 0);

      const state = usePlayerStore.getState();
      expect(state.userQueue.length).toBe(1);
      expect(state.userQueue[0].id).toBe('s1');
      expect(state.queue.map((s) => s.id)).toEqual(['s0', 's2']);
      expect(state.shuffledQueueOrder).toEqual([0, 1]); // s2 is now at queue index 1
      expect(state.queue[state.shuffledQueueOrder[1]].id).toBe('s2');
    });
  });

  describe('4. Shuffle Mode Stress Test: Long Playlist & State Invariants', () => {
    it('CRITICAL: moveUserToContextQueue in shuffle mode when queueIndex + 1 + destOffset >= queue.length', () => {
      const songs = Array.from({ length: 10 }, (_, i) => createSong(`s${i}`, `Song ${i}`));
      // Let currentSong be s8 (queueIndex = 8).
      // Shuffled order: [8, 0, 1, 2, 3, 4, 5, 6, 7, 9] (currentPos = 0, upcomingCount = 9)
      usePlayerStore.setState({
        queue: [...songs],
        queueIndex: 8,
        currentSong: songs[8],
        isShuffle: true,
        isFairShuffle: false,
        shuffleMode: 'fair',
        shuffledQueueOrder: [8, 0, 1, 2, 3, 4, 5, 6, 7, 9],
        userQueue: [
          {
            ...createSong('u0', 'User Song 0'),
            queueItemId: 'u-item-0',
            addedAt: Date.now(),
            isUserQueued: true
          }
        ]
      });

      // Move user queue item to upcoming context queue at destinationOffset 3
      // Here queueIndex + 1 + 3 = 12, but queue.length is 10!
      usePlayerStore.getState().moveUserToContextQueue(0, 3);

      const state = usePlayerStore.getState();

      // INVARIANT 1: queue length must be 11
      expect(state.queue.length).toBe(11);

      // INVARIANT 2: shuffledQueueOrder length must be 11
      expect(state.shuffledQueueOrder.length).toBe(11);

      // INVARIANT 3: Every index in shuffledQueueOrder must be a valid index in queue
      for (const idx of state.shuffledQueueOrder) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(state.queue.length);
        expect(state.queue[idx]).toBeDefined();
      }

      // INVARIANT 4: All indices from 0 to queue.length - 1 must be present exactly once
      const sortedIndices = [...state.shuffledQueueOrder].sort((a, b) => a - b);
      expect(sortedIndices).toEqual(Array.from({ length: 11 }, (_, i) => i));

      // INVARIANT 5: queue[queueIndex] must equal currentSong
      expect(state.queue[state.queueIndex].id).toBe('s8');
      expect(state.currentSong?.id).toBe('s8');

      // INVARIANT 6: nextSong() does not throw or play undefined
      // INVARIANT 3 is failing, but let's also see what happens when playback reaches the corrupted index
    });

    it('DEMONSTRATES PLAYBACK CORRUPTION: calling nextSong() advances into out-of-bounds index', () => {
      const songs = Array.from({ length: 10 }, (_, i) => createSong(`s${i}`, `Song ${i}`));
      usePlayerStore.setState({
        queue: [...songs],
        queueIndex: 8,
        currentSong: songs[8],
        isShuffle: true,
        isFairShuffle: false,
        shuffleMode: 'fair',
        shuffledQueueOrder: [8, 0, 1, 2, 3, 4, 5, 6, 7, 9],
        userQueue: [
          {
            ...createSong('u0', 'User Song 0'),
            queueItemId: 'u-item-0',
            addedAt: Date.now(),
            isUserQueued: true
          }
        ]
      });

      // Move user queue item to upcoming context queue at destinationOffset 3
      usePlayerStore.getState().moveUserToContextQueue(0, 3);

      const state = usePlayerStore.getState();
      console.log('Shuffled order after move:', state.shuffledQueueOrder);
      // Calls 1, 2, 3:
      usePlayerStore.getState().nextSong(); // song 0
      usePlayerStore.getState().nextSong(); // song 1
      usePlayerStore.getState().nextSong(); // song 2

      // Call 4: should play the inserted song u0, but order has index 12 where queue only has length 11!
      // This will attempt to play queue[12] which is undefined!
      usePlayerStore.getState().nextSong();
      const afterState = usePlayerStore.getState();
      console.log('Current song after Call 4:', afterState.currentSong);
      expect(afterState.currentSong).toBeDefined();
      expect(afterState.currentSong?.id).toBe('u0');
    });

    it('stress tests 50 randomized cross-section transfers with invariant verification', () => {
      const songCount = 20;
      const songs = Array.from({ length: songCount }, (_, i) => createSong(`s${i}`, `Song ${i}`));
      // Shuffled order: random permutation with songs[5] as first played
      const order = [5, ...Array.from({ length: songCount }, (_, i) => i).filter((i) => i !== 5)];

      usePlayerStore.setState({
        queue: [...songs],
        queueIndex: 5,
        currentSong: songs[5],
        isShuffle: true,
        isFairShuffle: false,
        shuffleMode: 'fair',
        shuffledQueueOrder: [...order],
        userQueue: []
      });

      // Perform 50 mixed transfers
      for (let step = 0; step < 50; step++) {
        const state = usePlayerStore.getState();
        const currentPos = state.shuffledQueueOrder.indexOf(state.queueIndex);
        const upcomingCount = currentPos !== -1 ? state.shuffledQueueOrder.length - 1 - currentPos : 0;

        // If context has upcoming songs and (random choice or userQueue empty), move context -> user
        if (upcomingCount > 0 && (state.userQueue.length === 0 || Math.random() > 0.5)) {
          const contextOffset = Math.floor(Math.random() * upcomingCount);
          const destIndex = Math.floor(Math.random() * (state.userQueue.length + 1));
          state.moveContextToUserQueue(contextOffset, destIndex);
        } else if (state.userQueue.length > 0) {
          // Move user -> context
          const sourceIndex = Math.floor(Math.random() * state.userQueue.length);
          const destOffset = Math.floor(Math.random() * (upcomingCount + 1));
          state.moveUserToContextQueue(sourceIndex, destOffset);
        }

        // Verify invariants after every single operation:
        const st = usePlayerStore.getState();
        expect(st.currentSong?.id).toBe('s5');
        expect(st.queue[st.queueIndex].id).toBe('s5');
        expect(st.shuffledQueueOrder.length).toBe(st.queue.length);

        const currentPosNow = st.shuffledQueueOrder.indexOf(st.queueIndex);
        expect(currentPosNow).toBeGreaterThanOrEqual(0);

        for (const idx of st.shuffledQueueOrder) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(st.queue.length);
          expect(st.queue[idx]).toBeDefined();
        }

        const sortedOrder = [...st.shuffledQueueOrder].sort((a, b) => a - b);
        expect(sortedOrder).toEqual(Array.from({ length: st.queue.length }, (_, i) => i));
      }
    });
  });

  describe('5. Repeat-One and Repeat-All Modes', () => {
    it('repeat-one replays currentSong and does not consume userQueue or contextQueue after cross-reordering', () => {
      const s0 = createSong('s0', 'Song 0');
      const s1 = createSong('s1', 'Song 1');
      const u0 = { ...createSong('u0', 'User Song 0'), queueItemId: 'u0', addedAt: Date.now(), isUserQueued: true as const };

      usePlayerStore.setState({
        queue: [s0, s1],
        queueIndex: 0,
        currentSong: s0,
        repeatMode: 'one',
        userQueue: [u0]
      });

      // Move upcoming context track to user queue
      usePlayerStore.getState().moveContextToUserQueue(0, 0);

      // Now userQueue has [s1, u0]
      expect(usePlayerStore.getState().userQueue.length).toBe(2);

      // nextSong() with repeatMode === 'one'
      usePlayerStore.getState().nextSong();

      // currentSong must still be s0
      expect(usePlayerStore.getState().currentSong?.id).toBe('s0');
      // userQueue must NOT be consumed
      expect(usePlayerStore.getState().userQueue.length).toBe(2);
    });

    it('repeat-all wraps around after cross-section modifications', () => {
      const s0 = createSong('s0', 'Song 0');
      const s1 = createSong('s1', 'Song 1');

      usePlayerStore.setState({
        queue: [s0, s1],
        queueIndex: 0,
        currentSong: s0,
        repeatMode: 'all',
        userQueue: []
      });

      // Advance to s1
      usePlayerStore.getState().nextSong();
      expect(usePlayerStore.getState().currentSong?.id).toBe('s1');

      // Advance at end of queue with repeatMode === 'all'
      usePlayerStore.getState().nextSong();
      expect(usePlayerStore.getState().currentSong?.id).toBe('s0');
      expect(usePlayerStore.getState().queueIndex).toBe(0);
    });
  });

  describe('6. Empty Playlist & Single Item Boundaries', () => {
    it('handles queue.length === 0 gracefully without exceptions', () => {
      usePlayerStore.setState({
        queue: [],
        queueIndex: -1,
        currentSong: null,
        userQueue: []
      });

      const store = usePlayerStore.getState();
      expect(() => store.reorderContextQueue(0, 1)).not.toThrow();
      expect(() => store.moveContextToUserQueue(0, 0)).not.toThrow();
      expect(() => store.moveUserToContextQueue(0, 0)).not.toThrow();
      expect(() =>
        store.moveQueueItem(
          { droppableId: 'context-queue', index: 0 },
          { droppableId: 'user-queue', index: 0 }
        )
      ).not.toThrow();
    });

    it('handles queue.length === 1 (0 upcoming songs) safely', () => {
      const s0 = createSong('s0', 'Only Song');
      usePlayerStore.setState({
        queue: [s0],
        queueIndex: 0,
        currentSong: s0,
        userQueue: []
      });

      const store = usePlayerStore.getState();
      // Reordering with 0 upcoming tracks should be no-op
      expect(() => store.reorderContextQueue(0, 0)).not.toThrow();
      expect(usePlayerStore.getState().queue.length).toBe(1);

      // Moving context to user with 0 upcoming tracks should be no-op
      expect(() => store.moveContextToUserQueue(0, 0)).not.toThrow();
      expect(usePlayerStore.getState().queue.length).toBe(1);
      expect(usePlayerStore.getState().userQueue.length).toBe(0);

      // Moving from user to context should append after currentSong
      const u0 = { ...createSong('u0', 'U0'), queueItemId: 'u0', addedAt: Date.now(), isUserQueued: true as const };
      usePlayerStore.setState({ userQueue: [u0] });

      store.moveUserToContextQueue(0, 0);
      const state = usePlayerStore.getState();
      expect(state.queue.length).toBe(2);
      expect(state.queue[0].id).toBe('s0');
      expect(state.queue[1].id).toBe('u0');
      expect(state.queueIndex).toBe(0);
      expect(state.currentSong?.id).toBe('s0');
      expect(state.userQueue.length).toBe(0);
    });

    it('handles invalid / out-of-bounds source indices in moveUserToContextQueue and moveContextToUserQueue', () => {
      const s0 = createSong('s0', 'Song 0');
      usePlayerStore.setState({
        queue: [s0],
        queueIndex: 0,
        currentSong: s0,
        userQueue: []
      });

      const store = usePlayerStore.getState();
      expect(() => store.moveUserToContextQueue(-1, 0)).not.toThrow();
      expect(() => store.moveUserToContextQueue(5, 0)).not.toThrow();
      expect(() => store.moveContextToUserQueue(-1, 0)).not.toThrow();
      expect(() => store.moveContextToUserQueue(5, 0)).not.toThrow();
    });
  });
});
