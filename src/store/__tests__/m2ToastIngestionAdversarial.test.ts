import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePlayerStore } from '../usePlayerStore';
import { Song } from '../../types/music';

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
    setOnMeaningfulListen: vi.fn()
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

function createTestSong(id: string, title: string, artist = 'Aura Artist'): Song {
  return {
    id,
    title,
    artist,
    album: 'Aura Album',
    path: `https://test.stream/${id}.mp3`,
    filePath: `https://test.stream/${id}.mp3`,
    fileName: `${title}.mp3`,
    format: 'mp3',
    fileSize: 3200000,
    duration: 210,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    isOnline: true
  };
}

describe('Adversarial Stress Test: Milestone 2 Queue Toast & Ingestion', () => {
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
      queueToast: null,
      isQueueOpen: false,
      isNowPlayingOpen: false
    });
  });

  afterEach(() => {
    usePlayerStore.setState({
      queue: [],
      userQueue: [],
      currentSong: null,
      isPlaying: false,
      queueToast: null,
      isQueueOpen: false
    });
  });

  describe('1. Baseline Store Ingestion Contracts', () => {
    it('calling addToUserQueue(song) automatically populates queueToast with expected payload', () => {
      const song = createTestSong('track_toast_1', 'Midnight City', 'M83');
      
      expect(usePlayerStore.getState().queueToast).toBeNull();
      const beforeTime = Date.now();

      usePlayerStore.getState().addToUserQueue(song);

      const afterTime = Date.now();
      const { queueToast, userQueue } = usePlayerStore.getState();

      expect(queueToast).not.toBeNull();
      expect(queueToast?.open).toBe(true);
      expect(queueToast?.message).toBe('Added to queue');
      expect(queueToast?.songTitle).toBe('Midnight City');
      expect(typeof queueToast?.id).toBe('number');
      expect(queueToast!.id).toBeGreaterThanOrEqual(beforeTime);
      expect(queueToast!.id).toBeLessThanOrEqual(afterTime);

      expect(userQueue).toHaveLength(1);
      expect(userQueue[0].id).toBe('track_toast_1');
      expect(userQueue[0].isUserQueued).toBe(true);
    });

    it('calling addToQueueNext(song) automatically populates queueToast with expected payload', () => {
      const song = createTestSong('track_toast_next', 'Starboy', 'The Weeknd');
      
      expect(usePlayerStore.getState().queueToast).toBeNull();

      usePlayerStore.getState().addToQueueNext(song);

      const { queueToast, userQueue } = usePlayerStore.getState();

      expect(queueToast).not.toBeNull();
      expect(queueToast?.open).toBe(true);
      expect(queueToast?.message).toBe('Added to queue');
      expect(queueToast?.songTitle).toBe('Starboy');
      expect(typeof queueToast?.id).toBe('number');

      expect(userQueue).toHaveLength(1);
      expect(userQueue[0].id).toBe('track_toast_next');
      expect(userQueue[0].isUserQueued).toBe(true);
    });

    it('handles special characters, unicode, and empty title without crashing or corrupting toast', () => {
      const weirdSongs = [
        createTestSong('unicode_1', '🎵 Vibez & Bass 🔥'),
        createTestSong('special_char_2', 'Track <script>alert(1)</script> & "quotes"'),
        createTestSong('empty_title_3', '')
      ];

      for (const s of weirdSongs) {
        usePlayerStore.getState().addToUserQueue(s);
        const { queueToast } = usePlayerStore.getState();
        expect(queueToast?.open).toBe(true);
        expect(queueToast?.message).toBe('Added to queue');
        expect(queueToast?.songTitle).toBe(s.title);
      }

      expect(usePlayerStore.getState().userQueue).toHaveLength(3);
    });
  });

  describe('2. Rapid Queue Additions & Timer Reset Verification', () => {
    it('calling addToUserQueue 5 times in rapid succession updates queueToast.id monotonically and maintains store consistency', async () => {
      const songs = [
        createTestSong('rapid_1', 'Track 1'),
        createTestSong('rapid_2', 'Track 2'),
        createTestSong('rapid_3', 'Track 3'),
        createTestSong('rapid_4', 'Track 4'),
        createTestSong('rapid_5', 'Track 5')
      ];

      const toastIds: number[] = [];

      for (const song of songs) {
        // Small delay to simulate rapid user touches/gestures (ensuring discrete timestamps)
        await new Promise((r) => setTimeout(r, 4));
        usePlayerStore.getState().addToUserQueue(song);
        const currentToast = usePlayerStore.getState().queueToast;
        expect(currentToast?.open).toBe(true);
        expect(currentToast?.songTitle).toBe(song.title);
        toastIds.push(currentToast!.id);
      }

      expect(toastIds).toHaveLength(5);
      // Verify strictly monotonic increase of toastId (which triggers useEffect reset in QueueToast)
      for (let i = 1; i < toastIds.length; i++) {
        expect(toastIds[i]).toBeGreaterThan(toastIds[i - 1]);
      }

      // Verify store userQueue integrity
      const { userQueue, queueToast } = usePlayerStore.getState();
      expect(userQueue).toHaveLength(5);
      expect(queueToast?.open).toBe(true);
      expect(queueToast?.songTitle).toBe('Track 5');

      // Verify each queue item has a unique queueItemId
      const queueItemIds = new Set(userQueue.map((item) => item.queueItemId));
      expect(queueItemIds.size).toBe(5);
    });

    it('calling addToUserQueue 5 times synchronously within the same event tick preserves store integrity and unique item IDs', () => {
      const song = createTestSong('sync_rapid', 'Synchronous Track');

      for (let i = 0; i < 5; i++) {
        usePlayerStore.getState().addToUserQueue(song);
      }

      const { userQueue, queueToast } = usePlayerStore.getState();
      expect(userQueue).toHaveLength(5);
      expect(queueToast?.open).toBe(true);
      expect(queueToast?.songTitle).toBe('Synchronous Track');

      // Unique queueItemIds despite same-tick addition
      const queueItemIds = new Set(userQueue.map((item) => item.queueItemId));
      expect(queueItemIds.size).toBe(5);
    });
  });

  describe('3. Queue Open and Sheet Control', () => {
    it('toggling setQueueOpen correctly updates isQueueOpen', () => {
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);

      usePlayerStore.getState().setQueueOpen(true);
      expect(usePlayerStore.getState().isQueueOpen).toBe(true);

      usePlayerStore.getState().setQueueOpen(false);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);
    });

    it('calling setQueueOpen(true) repeatedly is idempotent and safe', () => {
      usePlayerStore.getState().setQueueOpen(true);
      usePlayerStore.getState().setQueueOpen(true);
      usePlayerStore.getState().setQueueOpen(true);

      expect(usePlayerStore.getState().isQueueOpen).toBe(true);
    });
  });

  describe('4. Hide Queue Toast Semantics', () => {
    it('calling hideQueueToast() sets queueToast.open to false while preserving previous metadata', () => {
      const song = createTestSong('dismiss_test', 'Blinding Lights', 'The Weeknd');
      usePlayerStore.getState().addToUserQueue(song);

      const beforeHide = usePlayerStore.getState().queueToast;
      expect(beforeHide?.open).toBe(true);
      const originalId = beforeHide?.id;

      usePlayerStore.getState().hideQueueToast();

      const afterHide = usePlayerStore.getState().queueToast;
      expect(afterHide).not.toBeNull();
      expect(afterHide?.open).toBe(false);
      expect(afterHide?.id).toBe(originalId);
      expect(afterHide?.message).toBe('Added to queue');
      expect(afterHide?.songTitle).toBe('Blinding Lights');
    });

    it('calling hideQueueToast() when queueToast is null does not throw and leaves state as null', () => {
      expect(usePlayerStore.getState().queueToast).toBeNull();

      expect(() => {
        usePlayerStore.getState().hideQueueToast();
      }).not.toThrow();

      expect(usePlayerStore.getState().queueToast).toBeNull();
    });

    it('calling hideQueueToast() multiple times is safe and maintains open: false', () => {
      const song = createTestSong('idempotent_hide', 'Levitating');
      usePlayerStore.getState().addToUserQueue(song);

      usePlayerStore.getState().hideQueueToast();
      usePlayerStore.getState().hideQueueToast();
      usePlayerStore.getState().hideQueueToast();

      expect(usePlayerStore.getState().queueToast?.open).toBe(false);
    });
  });

  describe('5. Interleaved Ingestion and Toast Lifecycle', () => {
    it('re-opens queueToast with updated ID when a new song is queued after dismissal', async () => {
      const song1 = createTestSong('seq_1', 'Song One');
      const song2 = createTestSong('seq_2', 'Song Two');

      usePlayerStore.getState().addToUserQueue(song1);
      const toast1 = usePlayerStore.getState().queueToast;
      expect(toast1?.open).toBe(true);
      expect(toast1?.songTitle).toBe('Song One');

      usePlayerStore.getState().hideQueueToast();
      expect(usePlayerStore.getState().queueToast?.open).toBe(false);

      await new Promise((r) => setTimeout(r, 5));

      usePlayerStore.getState().addToQueueNext(song2);
      const toast2 = usePlayerStore.getState().queueToast;
      expect(toast2?.open).toBe(true);
      expect(toast2?.songTitle).toBe('Song Two');
      expect(toast2!.id).toBeGreaterThan(toast1!.id);
    });

    it('simulates the user tapping [Open] on QueueToast: closes toast and opens queue sheet', () => {
      const song = createTestSong('open_action', 'Save Your Tears');
      usePlayerStore.getState().addToUserQueue(song);

      expect(usePlayerStore.getState().queueToast?.open).toBe(true);
      expect(usePlayerStore.getState().isQueueOpen).toBe(false);

      // Simulation of QueueToast.tsx handleOpenQueue
      usePlayerStore.getState().hideQueueToast();
      usePlayerStore.getState().setQueueOpen(true);

      const state = usePlayerStore.getState();
      expect(state.queueToast?.open).toBe(false);
      expect(state.isQueueOpen).toBe(true);
    });
  });

  describe('6. Direct showQueueToast API Invariants', () => {
    it('sets custom message and song title', () => {
      usePlayerStore.getState().showQueueToast('Playing next', 'Custom Track');

      const toast = usePlayerStore.getState().queueToast;
      expect(toast?.open).toBe(true);
      expect(toast?.message).toBe('Playing next');
      expect(toast?.songTitle).toBe('Custom Track');
      expect(typeof toast?.id).toBe('number');
    });

    it('applies default message when called without parameters', () => {
      usePlayerStore.getState().showQueueToast();

      const toast = usePlayerStore.getState().queueToast;
      expect(toast?.open).toBe(true);
      expect(toast?.message).toBe('Added to queue');
      expect(toast?.songTitle).toBeUndefined();
    });
  });

  describe('7. High-Volume Adversarial Ingestion (50 Items)', () => {
    it('ingests 50 songs alternating addToUserQueue and addToQueueNext without corruption', () => {
      for (let i = 0; i < 50; i++) {
        const song = createTestSong(`bulk_${i}`, `Bulk Song ${i}`);
        if (i % 2 === 0) {
          usePlayerStore.getState().addToUserQueue(song);
        } else {
          usePlayerStore.getState().addToQueueNext(song);
        }
      }

      const { userQueue, queueToast } = usePlayerStore.getState();
      expect(userQueue).toHaveLength(50);
      expect(queueToast?.open).toBe(true);

      // Verify all 50 queueItemIds are completely unique
      const ids = new Set(userQueue.map((item) => item.queueItemId));
      expect(ids.size).toBe(50);

      // Verify clearQueue removes all userQueue items while preserving queueToast
      usePlayerStore.getState().clearQueue();
      const stateAfterClear = usePlayerStore.getState();
      expect(stateAfterClear.userQueue).toHaveLength(0);
      expect(stateAfterClear.queueToast?.open).toBe(true);
    });
  });
});
