import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePlayerStore } from '../usePlayerStore';
import { audioService } from '../../services/audioService';
import { Song } from '../../types/music';

// Mock audioService
vi.mock('../../services/audioService', () => {
  let endCb: (() => void) | null = null;
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
      setOnSongEnd: vi.fn().mockImplementation((cb) => {
        endCb = cb;
      }),
      setOnMeaningfulListen: vi.fn(),
      triggerSongEnd: () => {
        if (endCb) endCb();
      }
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
    duration: 200,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    isOnline: true
  };
}

describe('Adversarial Stress Test Harness: Milestone 1 User Queue Store Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.setState({
      queue: [],
      queueIndex: -1,
      userQueue: [],
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      repeatMode: 'off',
      isShuffle: false,
      shuffledQueueOrder: [],
      playbackHistory: []
    });
  });

  afterEach(() => {
    usePlayerStore.setState({
      queue: [],
      userQueue: [],
      currentSong: null,
      isPlaying: false
    });
  });

  describe('1. Duplicate Additions Stress', () => {
    it('adds the exact same song 5 times and produces 5 unique queueItemIds with valid metadata', () => {
      const duplicateSong = createTestSong('duplicate_track_1', 'Starboy', 'The Weeknd');

      for (let i = 0; i < 5; i++) {
        usePlayerStore.getState().addToUserQueue(duplicateSong);
      }

      const { userQueue } = usePlayerStore.getState();
      expect(userQueue).toHaveLength(5);

      const queueItemIds = userQueue.map((item) => item.queueItemId);
      const uniqueIds = new Set(queueItemIds);

      // Assert 5 unique queueItemIds
      expect(uniqueIds.size).toBe(5);

      // Assert queueItemId format and item properties
      queueItemIds.forEach((id) => {
        expect(typeof id).toBe('string');
        expect(id.startsWith('queue_')).toBe(true);
        expect(id.length).toBeGreaterThan(10);
      });

      userQueue.forEach((item) => {
        expect(item.id).toBe('duplicate_track_1');
        expect(item.title).toBe('Starboy');
        expect(item.artist).toBe('The Weeknd');
        expect(item.isUserQueued).toBe(true);
        expect(typeof item.addedAt).toBe('number');
        expect(item.addedAt).toBeGreaterThan(0);
      });
    });

    it('handles duplicate additions via addToQueueNext with distinct queueItemId prepended', () => {
      const duplicateSong = createTestSong('duplicate_track_2', 'Blinding Lights', 'The Weeknd');

      usePlayerStore.getState().addToUserQueue(duplicateSong);
      usePlayerStore.getState().addToQueueNext(duplicateSong);

      const { userQueue } = usePlayerStore.getState();
      expect(userQueue).toHaveLength(2);
      expect(userQueue[0].queueItemId).not.toBe(userQueue[1].queueItemId);
      expect(userQueue[0].isUserQueued).toBe(true);
      expect(userQueue[1].isUserQueued).toBe(true);
    });
  });

  describe('2. Selective Removal Stress', () => {
    it('removes item at index 2 by queueItemId and leaves the other 4 duplicates intact in order', () => {
      const duplicateSong = createTestSong('duplicate_track_sel', 'Save Your Tears', 'The Weeknd');

      for (let i = 0; i < 5; i++) {
        usePlayerStore.getState().addToUserQueue(duplicateSong);
      }

      const initialQueue = usePlayerStore.getState().userQueue;
      expect(initialQueue).toHaveLength(5);

      const targetItem = initialQueue[2];
      const targetId = targetItem.queueItemId;
      const expectedRemainingIds = [
        initialQueue[0].queueItemId,
        initialQueue[1].queueItemId,
        initialQueue[3].queueItemId,
        initialQueue[4].queueItemId
      ];

      // Remove specifically item at index 2
      usePlayerStore.getState().removeFromUserQueue(targetId);

      const afterRemovalQueue = usePlayerStore.getState().userQueue;
      expect(afterRemovalQueue).toHaveLength(4);

      // Verify targetId is completely absent
      const foundTarget = afterRemovalQueue.find((item) => item.queueItemId === targetId);
      expect(foundTarget).toBeUndefined();

      // Verify the other 4 items remain intact in exact order
      const actualRemainingIds = afterRemovalQueue.map((item) => item.queueItemId);
      expect(actualRemainingIds).toEqual(expectedRemainingIds);
    });

    it('safely handles removal requests with non-existent, empty, or malicious queueItemIds', () => {
      const song = createTestSong('song_safe_removal', 'Ordinary Life');
      usePlayerStore.getState().addToUserQueue(song);
      usePlayerStore.getState().addToUserQueue(song);

      expect(usePlayerStore.getState().userQueue).toHaveLength(2);

      // Non-existent ID
      expect(() => {
        usePlayerStore.getState().removeFromUserQueue('non_existent_id');
      }).not.toThrow();
      expect(usePlayerStore.getState().userQueue).toHaveLength(2);

      // Empty string ID
      expect(() => {
        usePlayerStore.getState().removeFromUserQueue('');
      }).not.toThrow();
      expect(usePlayerStore.getState().userQueue).toHaveLength(2);

      // Malicious / format-mimicking ID
      expect(() => {
        usePlayerStore.getState().removeFromUserQueue('queue_9999999999999_fake');
      }).not.toThrow();
      expect(usePlayerStore.getState().userQueue).toHaveLength(2);
    });
  });

  describe('3. Reorder Stress & Boundary Testing', () => {
    it('reorders item 0 to 4 and item 4 to 0 without array corruption', () => {
      const songs = [
        createTestSong('song_0', 'Track 0'),
        createTestSong('song_1', 'Track 1'),
        createTestSong('song_2', 'Track 2'),
        createTestSong('song_3', 'Track 3'),
        createTestSong('song_4', 'Track 4')
      ];

      songs.forEach((s) => usePlayerStore.getState().addToUserQueue(s));
      const initialQueue = usePlayerStore.getState().userQueue;
      const initialIds = initialQueue.map((item) => item.queueItemId);

      // Reorder item 0 to 4: [0, 1, 2, 3, 4] -> [1, 2, 3, 4, 0]
      usePlayerStore.getState().reorderUserQueue(0, 4);
      let currentQueue = usePlayerStore.getState().userQueue;
      expect(currentQueue).toHaveLength(5);
      expect(currentQueue.map((i) => i.queueItemId)).toEqual([
        initialIds[1],
        initialIds[2],
        initialIds[3],
        initialIds[4],
        initialIds[0]
      ]);

      // Reorder item 4 to 0: [1, 2, 3, 4, 0] -> [0, 1, 2, 3, 4]
      usePlayerStore.getState().reorderUserQueue(4, 0);
      currentQueue = usePlayerStore.getState().userQueue;
      expect(currentQueue).toHaveLength(5);
      expect(currentQueue.map((i) => i.queueItemId)).toEqual(initialIds);
    });

    it('safely rejects out-of-bounds and invalid reorder indices without exceptions or corruption', () => {
      const songs = [
        createTestSong('song_a', 'Track A'),
        createTestSong('song_b', 'Track B'),
        createTestSong('song_c', 'Track C')
      ];
      songs.forEach((s) => usePlayerStore.getState().addToUserQueue(s));

      const originalOrder = usePlayerStore.getState().userQueue.map((i) => i.queueItemId);

      // Negative source index
      expect(() => usePlayerStore.getState().reorderUserQueue(-1, 1)).not.toThrow();
      expect(usePlayerStore.getState().userQueue.map((i) => i.queueItemId)).toEqual(originalOrder);

      // Negative destination index
      expect(() => usePlayerStore.getState().reorderUserQueue(1, -1)).not.toThrow();
      expect(usePlayerStore.getState().userQueue.map((i) => i.queueItemId)).toEqual(originalOrder);

      // Source index beyond bounds
      expect(() => usePlayerStore.getState().reorderUserQueue(100, 0)).not.toThrow();
      expect(usePlayerStore.getState().userQueue.map((i) => i.queueItemId)).toEqual(originalOrder);

      // Destination index beyond bounds
      expect(() => usePlayerStore.getState().reorderUserQueue(0, 100)).not.toThrow();
      expect(usePlayerStore.getState().userQueue.map((i) => i.queueItemId)).toEqual(originalOrder);

      // Source equals destination (no-op)
      expect(() => usePlayerStore.getState().reorderUserQueue(1, 1)).not.toThrow();
      expect(usePlayerStore.getState().userQueue.map((i) => i.queueItemId)).toEqual(originalOrder);

      // Both indices out of bounds
      expect(() => usePlayerStore.getState().reorderUserQueue(-5, 50)).not.toThrow();
      expect(usePlayerStore.getState().userQueue.map((i) => i.queueItemId)).toEqual(originalOrder);
    });

    it('safely handles reordering a 1-item queue and an empty queue', () => {
      // 1-item queue
      const singleSong = createTestSong('single_1', 'Solo Track');
      usePlayerStore.getState().addToUserQueue(singleSong);
      expect(usePlayerStore.getState().userQueue).toHaveLength(1);

      expect(() => usePlayerStore.getState().reorderUserQueue(0, 0)).not.toThrow();
      expect(() => usePlayerStore.getState().reorderUserQueue(0, 1)).not.toThrow();
      expect(() => usePlayerStore.getState().reorderUserQueue(1, 0)).not.toThrow();
      expect(usePlayerStore.getState().userQueue).toHaveLength(1);

      // Empty queue
      usePlayerStore.getState().clearUserQueue();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);

      expect(() => usePlayerStore.getState().reorderUserQueue(0, 0)).not.toThrow();
      expect(() => usePlayerStore.getState().reorderUserQueue(0, 5)).not.toThrow();
      expect(() => usePlayerStore.getState().reorderUserQueue(-1, 0)).not.toThrow();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);
    });
  });

  describe('4. Non-Interrupting Clear Queue', () => {
    it('clears userQueue without interrupting active playing song or stopping audio', () => {
      const activeSong = createTestSong('active_song', 'Currently Playing Track');
      const queuedSongs = [
        createTestSong('q_song_1', 'Next 1'),
        createTestSong('q_song_2', 'Next 2'),
        createTestSong('q_song_3', 'Next 3')
      ];
      const contextPlaylist = [
        activeSong,
        createTestSong('c_song_2', 'Context 2'),
        createTestSong('c_song_3', 'Context 3')
      ];

      // Set playing state with active song and context queue
      usePlayerStore.setState({
        currentSong: activeSong,
        isPlaying: true,
        queue: contextPlaylist,
        queueIndex: 0
      });

      // Add 3 songs to user queue
      queuedSongs.forEach((s) => usePlayerStore.getState().addToUserQueue(s));
      expect(usePlayerStore.getState().userQueue).toHaveLength(3);

      // Clear queue via clearQueue()
      usePlayerStore.getState().clearQueue();

      const stateAfterClear = usePlayerStore.getState();

      // Assert userQueue is empty
      expect(stateAfterClear.userQueue).toEqual([]);
      expect(stateAfterClear.userQueue).toHaveLength(0);

      // Assert currentSong is completely unchanged
      expect(stateAfterClear.currentSong).toEqual(activeSong);
      expect(stateAfterClear.currentSong?.id).toBe('active_song');

      // Assert isPlaying is still true
      expect(stateAfterClear.isPlaying).toBe(true);

      // Assert audioService.pause() was NOT called
      expect(audioService.pause).not.toHaveBeenCalled();

      // Assert context queue and queueIndex are preserved
      expect(stateAfterClear.queue).toHaveLength(3);
      expect(stateAfterClear.queueIndex).toBe(0);
    });

    it('clearUserQueue() also clears userQueue without interrupting active playback', () => {
      const activeSong = createTestSong('active_song_2', 'Another Active Track');
      usePlayerStore.setState({
        currentSong: activeSong,
        isPlaying: true,
        queue: [activeSong],
        queueIndex: 0
      });

      usePlayerStore.getState().addToUserQueue(createTestSong('q_item', 'Queued Item'));
      expect(usePlayerStore.getState().userQueue).toHaveLength(1);

      usePlayerStore.getState().clearUserQueue();

      expect(usePlayerStore.getState().userQueue).toHaveLength(0);
      expect(usePlayerStore.getState().currentSong?.id).toBe('active_song_2');
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(audioService.pause).not.toHaveBeenCalled();
    });

    it('handles clearQueue() when userQueue is already empty gracefully', () => {
      const activeSong = createTestSong('active_song_3', 'Track');
      usePlayerStore.setState({
        currentSong: activeSong,
        isPlaying: true,
        userQueue: []
      });

      expect(() => usePlayerStore.getState().clearQueue()).not.toThrow();
      expect(usePlayerStore.getState().userQueue).toEqual([]);
      expect(usePlayerStore.getState().currentSong?.id).toBe('active_song_3');
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(audioService.pause).not.toHaveBeenCalled();
    });
  });

  describe('5. Queue Priority Progression and Continuation', () => {
    it('consumes userQueue before context queue on nextSong() and resumes context seamlessly', async () => {
      const activeSong = createTestSong('active_curr', 'Active Song');
      const userSong1 = createTestSong('user_q1', 'User Queue Song 1');
      const userSong2 = createTestSong('user_q2', 'User Queue Song 2');
      const contextSong1 = createTestSong('context_1', 'Context Song 1');
      const contextSong2 = createTestSong('context_2', 'Context Song 2');

      usePlayerStore.setState({
        currentSong: activeSong,
        isPlaying: true,
        queue: [contextSong1, contextSong2],
        queueIndex: 0,
        userQueue: []
      });

      usePlayerStore.getState().addToUserQueue(userSong1);
      usePlayerStore.getState().addToUserQueue(userSong2);

      // First nextSong(): plays userSong1
      usePlayerStore.getState().nextSong();

      let state = usePlayerStore.getState();
      expect(state.currentSong?.id).toBe('user_q1');
      expect(state.userQueue).toHaveLength(1);
      expect(state.userQueue[0].id).toBe('user_q2');
      expect(state.queueIndex).toBe(0); // Context queue pointer untouched!
      expect(audioService.playSong).toHaveBeenCalledWith(expect.objectContaining({ id: 'user_q1' }));

      // Wait 300ms to clear the 250ms native bridge debounce
      await new Promise((r) => setTimeout(r, 300));

      // Second nextSong(): plays userSong2
      usePlayerStore.getState().nextSong();

      state = usePlayerStore.getState();
      expect(state.currentSong?.id).toBe('user_q2');
      expect(state.userQueue).toHaveLength(0);
      expect(state.queueIndex).toBe(0); // Context queue pointer still untouched!
      expect(audioService.playSong).toHaveBeenCalledWith(expect.objectContaining({ id: 'user_q2' }));

      // Wait 300ms to clear debounce
      await new Promise((r) => setTimeout(r, 300));

      // Third nextSong(): userQueue is now empty, advances to contextSong2!
      usePlayerStore.getState().nextSong();

      state = usePlayerStore.getState();
      expect(state.currentSong?.id).toBe('context_2');
      expect(state.queueIndex).toBe(1);
      expect(audioService.playSong).toHaveBeenCalledWith(expect.objectContaining({ id: 'context_2' }));
    });

    it('repeatMode === "one" replays current track without consuming userQueue', () => {
      const activeSong = createTestSong('rep_active', 'Repeat Track');
      const userQueued = createTestSong('rep_queued', 'Queued While Repeating');

      usePlayerStore.setState({
        currentSong: activeSong,
        isPlaying: true,
        repeatMode: 'one',
        userQueue: []
      });

      usePlayerStore.getState().addToUserQueue(userQueued);
      expect(usePlayerStore.getState().userQueue).toHaveLength(1);

      usePlayerStore.getState().nextSong();

      const state = usePlayerStore.getState();
      expect(audioService.seek).toHaveBeenCalledWith(0);
      expect(audioService.resume).toHaveBeenCalled();
      expect(state.currentSong?.id).toBe('rep_active');
      expect(state.userQueue).toHaveLength(1); // User queue NOT consumed!
    });
  });
});
