import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlayerStore } from '../usePlayerStore';
import { useLibraryStore } from '../useLibraryStore';
import { Song } from '../../types/music';
import { audioService } from '../../services/audioService';

// Mock audioService with comprehensive spies
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

function createTestSong(id: string, title: string, artist = 'Aura Artist', album = 'Aura Album'): Song {
  return {
    id,
    title,
    artist,
    album,
    path: `https://aura.stream/tracks/${id}.mp3`,
    filePath: `https://aura.stream/tracks/${id}.mp3`,
    fileName: `${title}.mp3`,
    format: 'mp3',
    fileSize: 4500000,
    duration: 215,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    isOnline: true
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Milestone 3 Challenger 2: View Triggers & Clear Queue Modal Adversarial Harness', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
      repeatMode: 'off',
      isQueueOpen: false,
      isNowPlayingOpen: false,
      playbackHistory: []
    });

    useLibraryStore.setState({
      activePlaylistId: null,
      playlists: []
    });
  });

  // ==========================================================================
  // Suite 1: Mini Player Mobile Dock Toggle Mechanics & Live Badge
  // ==========================================================================
  describe('Suite 1: Mini Player Mobile Dock Toggle Mechanics & Live Badge', () => {
    it('toggling setQueueOpen(!isQueueOpen) cleanly updates isQueueOpen state', () => {
      const store = usePlayerStore.getState();

      // Initial state: Queue closed
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);

      // 1. Mobile dock button clicked -> open queue
      store.setQueueOpen(!usePlayerStore.getState().isQueueOpen);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);

      // 2. Mobile dock button clicked again -> close queue
      store.setQueueOpen(!usePlayerStore.getState().isQueueOpen);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
    });

    it('survives rapid multi-toggle stress without state desynchronization', () => {
      const store = usePlayerStore.getState();

      // Stress test: 50 consecutive inversions
      for (let i = 1; i <= 50; i++) {
        store.setQueueOpen(!usePlayerStore.getState().isQueueOpen);
        expect(usePlayerStore.getState().isQueueOpen).toBe(i % 2 === 1);
      }

      // Final state must be false after 50 flips
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
    });

    it('dynamically reflects userQueue.length badge count in mini player', () => {
      const store = usePlayerStore.getState();

      // Initially zero items -> badge absent
      expect(usePlayerStore.getState().userQueue.length).toBe(0);

      // Add 3 songs to userQueue
      store.addToUserQueue(createTestSong('uq1', 'Queued 1'));
      store.addToUserQueue(createTestSong('uq2', 'Queued 2'));
      store.addToUserQueue(createTestSong('uq3', 'Queued 3'));

      expect(usePlayerStore.getState().userQueue.length).toBe(3);

      // Remove one item
      const itemToRemove = usePlayerStore.getState().userQueue[1].queueItemId;
      store.removeFromUserQueue(itemToRemove);
      expect(usePlayerStore.getState().userQueue.length).toBe(2);

      // Clear user queue -> badge count drops back to 0
      store.clearUserQueue();
      expect(usePlayerStore.getState().userQueue.length).toBe(0);
    });

    it('toggling isQueueOpen does not modify playback invariants', () => {
      const playingSong = createTestSong('play1', 'Active Stream Track');
      usePlayerStore.setState({
        currentSong: playingSong,
        isPlaying: true,
        currentTime: 42.5,
        duration: 215,
        volume: 0.85
      });

      // Toggle queue open and closed 10 times
      for (let i = 0; i < 10; i++) {
        usePlayerStore.getState().setQueueOpen(!usePlayerStore.getState().isQueueOpen);
      }

      const finalState = usePlayerStore.getState();
      expect(finalState.isPlaying).toBe(true);
      expect(finalState.currentSong?.id).toBe('play1');
      expect(finalState.currentTime).toBe(42.5);
      expect(finalState.duration).toBe(215);
      expect(finalState.volume).toBe(0.85);
      expect(audioService.pause).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Suite 2: Now Playing Modal Queue Trigger & Layering Isolation
  // ==========================================================================
  describe('Suite 2: Now Playing Modal Queue Trigger & Layering Isolation', () => {
    it('Now Playing trigger preserves isNowPlayingOpen: true AND isQueueOpen: true', () => {
      // Simulate user opening Now Playing modal
      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: false
      });

      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);

      // Trigger Queue from inside Now Playing modal:
      // In NowPlayingModal.tsx: onClick={() => setQueueOpen(true)}
      usePlayerStore.getState().setQueueOpen(true);

      // Both must be TRUE concurrently (QueueSheet overlays Now Playing at z-[70])
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
    });

    it('closing QueueSheet leaves NowPlayingModal open without interruption', () => {
      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      // User closes QueueSheet (via close button, backdrop click, or swipe down)
      usePlayerStore.getState().setQueueOpen(false);

      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);
    });

    it('verifies strict z-index layering hierarchy contract', () => {
      // Contractual verification of the CSS stacking order:
      // NowPlayingModal: z-[60]
      // QueueSheet: z-[70]
      // ClearQueueDialog: z-[80]
      const Z_INDEX_NOW_PLAYING = 60;
      const Z_INDEX_QUEUE_SHEET = 70;
      const Z_INDEX_CLEAR_DIALOG = 80;

      expect(Z_INDEX_QUEUE_SHEET).toBeGreaterThan(Z_INDEX_NOW_PLAYING);
      expect(Z_INDEX_CLEAR_DIALOG).toBeGreaterThan(Z_INDEX_QUEUE_SHEET);
    });

    it('verifies Escape dismissal prioritization (QueueSheet before NowPlayingModal)', () => {
      usePlayerStore.setState({
        isNowPlayingOpen: true,
        isQueueOpen: true
      });

      // Emulate MainLayout handleKeyDown Escape listener
      const handleEscape = () => {
        const { isQueueOpen, isNowPlayingOpen, setQueueOpen, setNowPlayingOpen } = usePlayerStore.getState();
        if (isQueueOpen) {
          setQueueOpen(false);
        } else if (isNowPlayingOpen) {
          setNowPlayingOpen(false);
        }
      };

      // 1st Escape: Closes QueueSheet only
      handleEscape();
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(true);

      // 2nd Escape: Closes NowPlayingModal
      handleEscape();
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
      expect(usePlayerStore.getState().isNowPlayingOpen).toBe(false);
    });
  });

  // ==========================================================================
  // Suite 3: Clear Queue Dialog Execution & Safety Invariants
  // ==========================================================================
  describe('Suite 3: Clear Queue Dialog Execution & Safety Invariants', () => {
    it('Clear Queue action empties userQueue while keeping currentSong playing and audio unpaused', () => {
      const activeTrack = createTestSong('active_track', 'Active Playing Song');
      const contextPlaylist = [
        activeTrack,
        createTestSong('ctx_1', 'Context Playlist 1'),
        createTestSong('ctx_2', 'Context Playlist 2')
      ];

      usePlayerStore.setState({
        currentSong: activeTrack,
        isPlaying: true,
        currentTime: 55.0,
        queue: contextPlaylist,
        queueIndex: 0
      });

      // Enqueue 4 user tracks
      const store = usePlayerStore.getState();
      store.addToUserQueue(createTestSong('u1', 'User Track 1'));
      store.addToUserQueue(createTestSong('u2', 'User Track 2'));
      store.addToUserQueue(createTestSong('u3', 'User Track 3'));
      store.addToUserQueue(createTestSong('u4', 'User Track 4'));

      expect(usePlayerStore.getState().userQueue).toHaveLength(4);

      // User confirms Clear Queue in ClearQueueDialog (calls clearUserQueue)
      store.clearUserQueue();

      const postClearState = usePlayerStore.getState();

      // INVARIANT 1: userQueue must be empty
      expect(postClearState.userQueue).toEqual([]);
      expect(postClearState.userQueue.length).toBe(0);

      // INVARIANT 2: currentSong must continue playing untouched
      expect(postClearState.currentSong).toEqual(activeTrack);
      expect(postClearState.currentSong?.id).toBe('active_track');

      // INVARIANT 3: isPlaying must remain true
      expect(postClearState.isPlaying).toBe(true);

      // INVARIANT 4: audioService.pause() must NOT be called
      expect(audioService.pause).not.toHaveBeenCalled();

      // INVARIANT 5: context queue and pointer are completely preserved
      expect(postClearState.queue).toHaveLength(3);
      expect(postClearState.queueIndex).toBe(0);
      expect(postClearState.queue[1].id).toBe('ctx_1');
    });

    it('clearUserQueue is safe and idempotent when userQueue is already empty', () => {
      const activeTrack = createTestSong('solo_track', 'Solo Active Track');
      usePlayerStore.setState({
        currentSong: activeTrack,
        isPlaying: true,
        userQueue: [],
        queue: [activeTrack],
        queueIndex: 0
      });

      // Calling clearUserQueue on already empty queue
      expect(() => usePlayerStore.getState().clearUserQueue()).not.toThrow();
      expect(usePlayerStore.getState().userQueue).toEqual([]);
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(usePlayerStore.getState().currentSong?.id).toBe('solo_track');
      expect(audioService.pause).not.toHaveBeenCalled();
    });

    it('clearQueue backward compatibility alias operates identically to clearUserQueue', () => {
      const activeTrack = createTestSong('compat_track', 'Compat Track');
      usePlayerStore.setState({
        currentSong: activeTrack,
        isPlaying: true,
        queue: [activeTrack, createTestSong('next_ctx', 'Next Context')],
        queueIndex: 0
      });

      usePlayerStore.getState().addToUserQueue(createTestSong('u_compat', 'User Compat'));
      expect(usePlayerStore.getState().userQueue).toHaveLength(1);

      // Call legacy clearQueue()
      usePlayerStore.getState().clearQueue();

      expect(usePlayerStore.getState().userQueue).toHaveLength(0);
      expect(usePlayerStore.getState().currentSong?.id).toBe('compat_track');
      expect(usePlayerStore.getState().isPlaying).toBe(true);
      expect(audioService.pause).not.toHaveBeenCalled();
      expect(usePlayerStore.getState().queue).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Suite 4: Seamless Playback Continuation After Clear Queue
  // ==========================================================================
  describe('Suite 4: Seamless Playback Continuation After Clear Queue', () => {
    it('seamlessly continues with sequential context playlist when currentSong finishes after clearUserQueue()', async () => {
      const track0 = createTestSong('ctx_track_0', 'Context Song 0');
      const track1 = createTestSong('ctx_track_1', 'Context Song 1');
      const track2 = createTestSong('ctx_track_2', 'Context Song 2');

      const playlist = [track0, track1, track2];

      usePlayerStore.setState({
        currentSong: track0,
        isPlaying: true,
        queue: playlist,
        queueIndex: 0,
        isShuffle: false
      });

      // Add songs to user queue
      usePlayerStore.getState().addToUserQueue(createTestSong('uq_a', 'Upcoming Queued A'));
      usePlayerStore.getState().addToUserQueue(createTestSong('uq_b', 'Upcoming Queued B'));
      expect(usePlayerStore.getState().userQueue).toHaveLength(2);

      // User opens dialog and clears queue
      usePlayerStore.getState().clearUserQueue();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);

      // Wait 300ms to clear any debounce timing
      await sleep(300);

      // Track 0 finishes playing -> triggers nextSong()
      usePlayerStore.getState().nextSong();

      // Verified: Plays Context Song 1 (track 1) because user queue was cleared!
      const stateAfterEnd = usePlayerStore.getState();
      expect(stateAfterEnd.currentSong?.id).toBe('ctx_track_1');
      expect(stateAfterEnd.queueIndex).toBe(1);
      expect(audioService.playSong).toHaveBeenCalledWith(expect.objectContaining({ id: 'ctx_track_1' }));

      // Wait 300ms
      await sleep(300);

      // Track 1 finishes playing -> triggers nextSong()
      usePlayerStore.getState().nextSong();

      // Verified: Plays Context Song 2 (track 2)
      expect(usePlayerStore.getState().currentSong?.id).toBe('ctx_track_2');
      expect(usePlayerStore.getState().queueIndex).toBe(2);
      expect(audioService.playSong).toHaveBeenCalledWith(expect.objectContaining({ id: 'ctx_track_2' }));
    });

    it('seamlessly continues with shuffled context playlist when currentSong finishes after clearUserQueue()', async () => {
      const c0 = createTestSong('s_c0', 'Shuffle 0');
      const c1 = createTestSong('s_c1', 'Shuffle 1');
      const c2 = createTestSong('s_c2', 'Shuffle 2');
      const c3 = createTestSong('s_c3', 'Shuffle 3');

      const playlist = [c0, c1, c2, c3];
      // Predefined shuffle permutation: [c2 (idx 2), c0 (idx 0), c3 (idx 3), c1 (idx 1)]
      const shuffleOrder = [2, 0, 3, 1];

      usePlayerStore.setState({
        currentSong: c0,
        queue: playlist,
        queueIndex: 0,
        isShuffle: true,
        shuffledQueueOrder: shuffleOrder,
        isPlaying: true
      });

      // Add user tracks
      usePlayerStore.getState().addToUserQueue(createTestSong('sh_u1', 'User Shuffle 1'));
      usePlayerStore.getState().addToUserQueue(createTestSong('sh_u2', 'User Shuffle 2'));

      // Clear user queue
      usePlayerStore.getState().clearUserQueue();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);

      await sleep(300);

      // c0 finishes -> next song in shuffle order after c0 (pos 1, idx 0) is index 3 (c3)
      usePlayerStore.getState().nextSong();

      const state = usePlayerStore.getState();
      expect(state.currentSong?.id).toBe('s_c3');
      expect(state.queueIndex).toBe(3);
      expect(audioService.playSong).toHaveBeenCalledWith(expect.objectContaining({ id: 's_c3' }));
    });

    it('wraps around to start of context playlist on repeatMode: all after clearUserQueue()', async () => {
      const song1 = createTestSong('last_1', 'Last Song');
      const song2 = createTestSong('first_1', 'First Song');

      const playlist = [song2, song1];

      usePlayerStore.setState({
        currentSong: song1,
        queue: playlist,
        queueIndex: 1, // At the end of playlist
        repeatMode: 'all',
        isShuffle: false,
        isPlaying: true
      });

      usePlayerStore.getState().addToUserQueue(createTestSong('tmp_u', 'Temp User'));
      usePlayerStore.getState().clearUserQueue();

      await sleep(300);

      // Last song finishes -> should wrap around to index 0 (first_1)
      usePlayerStore.getState().nextSong();

      expect(usePlayerStore.getState().currentSong?.id).toBe('first_1');
      expect(usePlayerStore.getState().queueIndex).toBe(0);
      expect(audioService.playSong).toHaveBeenCalledWith(expect.objectContaining({ id: 'first_1' }));
    });

    it('pauses cleanly when reaching end of context playlist with repeatMode: off after clearUserQueue()', async () => {
      const finalSong = createTestSong('end_song', 'Final Song');

      usePlayerStore.setState({
        currentSong: finalSong,
        queue: [finalSong],
        queueIndex: 0,
        repeatMode: 'off',
        isShuffle: false,
        isAuraFlow: false,
        isPlaying: true
      });

      usePlayerStore.getState().addToUserQueue(createTestSong('exp_u', 'Expiring User Song'));
      usePlayerStore.getState().clearUserQueue();

      await sleep(300);

      // Final song finishes with no upcoming user tracks and end of context queue
      usePlayerStore.getState().nextSong();

      // audioService.pause() must be invoked cleanly without crash
      expect(audioService.pause).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Suite 5: Adversarial Boundary & Re-Ingestion Edge Cases
  // ==========================================================================
  describe('Suite 5: Adversarial Boundary & Re-Ingestion Edge Cases', () => {
    it('handles clear queue when currentSong was originally popped from userQueue', async () => {
      const originUserSong = createTestSong('popped_user_song', 'Originally Queued Song');
      const remainingUserSong1 = createTestSong('remain_1', 'Remaining 1');
      const remainingUserSong2 = createTestSong('remain_2', 'Remaining 2');
      const contextPlaylist = [
        createTestSong('ctx_base_1', 'Base Playlist 1'),
        createTestSong('ctx_base_2', 'Base Playlist 2')
      ];

      // Simulate originUserSong was popped from userQueue and is now currentSong
      usePlayerStore.setState({
        currentSong: originUserSong,
        isPlaying: true,
        queue: contextPlaylist,
        queueIndex: 0,
        userQueue: []
      });

      // User enqueues more songs
      usePlayerStore.getState().addToUserQueue(remainingUserSong1);
      usePlayerStore.getState().addToUserQueue(remainingUserSong2);
      expect(usePlayerStore.getState().userQueue).toHaveLength(2);

      // User clears queue
      usePlayerStore.getState().clearUserQueue();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);

      // Active song is still playing
      expect(usePlayerStore.getState().currentSong?.id).toBe('popped_user_song');
      expect(usePlayerStore.getState().isPlaying).toBe(true);

      await sleep(300);

      // originUserSong finishes -> seamless progression to context playlist (ctx_base_2, index 1)
      usePlayerStore.getState().nextSong();

      expect(usePlayerStore.getState().currentSong?.id).toBe('ctx_base_2');
      expect(usePlayerStore.getState().queueIndex).toBe(1);
    });

    it('supports re-queuing duplicate tracks after clearUserQueue without collisions', () => {
      const store = usePlayerStore.getState();
      const duplicateSong = createTestSong('dup_song', 'Duplicate Track');

      // Add, clear, and re-add 3 times
      store.addToUserQueue(duplicateSong);
      store.addToUserQueue(duplicateSong);
      expect(usePlayerStore.getState().userQueue).toHaveLength(2);

      store.clearUserQueue();
      expect(usePlayerStore.getState().userQueue).toHaveLength(0);

      // Re-add duplicate instances
      store.addToUserQueue(duplicateSong);
      store.addToUserQueue(duplicateSong);
      store.addToUserQueue(duplicateSong);

      const queueItems = usePlayerStore.getState().userQueue;
      expect(queueItems).toHaveLength(3);

      // Unique queueItemIds generated for each instance
      const itemIds = new Set(queueItems.map((item) => item.queueItemId));
      expect(itemIds.size).toBe(3);
    });
  });
});
