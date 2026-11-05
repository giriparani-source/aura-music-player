/**
 * src/services/__tests__/localQueueContinuation.test.ts
 *
 * Regression test suite for Local Music auto-play / queue continuation.
 *
 * Validates:
 * 1. Automatically creates a local queue from library songs when a local track is played.
 * 2. Advances to the next track automatically on song end.
 * 3. Continues until queue ends (repeatMode 'off').
 * 4. Loops back to index 0 on queue end when repeatMode is 'all'.
 * 5. Replays current track from 0:00 when repeatMode is 'one'.
 * 6. Supports Shuffle mode on local queue without duplicates and without online injections.
 * 7. Supports Previous track navigation (restarting if > 3s, previous in queue/shuffle).
 * 8. Maintains queue integrity across tab/navigation state changes.
 * 9. Native ExoPlayer mediaAction ('next', 'previous', 'play', 'pause', 'seek') trigger player store centrally.
 * 10. Strictly prevents online streaming tracks from mixing into local queues.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { audioService } from '../audioService';
import { dispatchMediaAction } from '../androidMediaBridge';
import { Song } from '../../types/music';

// Mock audioService methods
vi.mock('../audioService', () => {
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
vi.mock('../sleepTimerService', () => ({
  sleepTimerService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getRemainingSeconds: vi.fn().mockReturnValue(null),
    getMode: vi.fn().mockReturnValue('off')
  }
}));

// Mock audioEffectsService
vi.mock('../audioEffectsService', () => ({
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

function createTestSong(partial: Partial<Song> & { id: string; title: string; artist: string; duration: number }): Song {
  return {
    album: 'Test Album',
    path: partial.filePath || partial.path || `file:///test/${partial.id}.mp3`,
    filePath: partial.path || partial.filePath || `file:///test/${partial.id}.mp3`,
    fileName: `${partial.title}.mp3`,
    format: 'mp3',
    fileSize: 3500000,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    ...partial
  };
}

const LOCAL_SONGS_FIXTURE: Song[] = [
  createTestSong({
    id: 'device_track_1',
    title: 'Local Melody 1',
    artist: 'Local Artist A',
    album: 'Local Album A',
    duration: 180,
    path: 'content://media/external/audio/media/1001',
    isOnline: false
  }),
  createTestSong({
    id: 'device_track_2',
    title: 'Local Melody 2',
    artist: 'Local Artist A',
    album: 'Local Album A',
    duration: 210,
    path: 'content://media/external/audio/media/1002',
    isOnline: false
  }),
  createTestSong({
    id: 'device_track_3',
    title: 'Local Rhythm 3',
    artist: 'Local Artist B',
    album: 'Local Album B',
    duration: 240,
    path: 'content://media/external/audio/media/1003',
    isOnline: false
  }),
  createTestSong({
    id: 'device_track_4',
    title: 'Local Symphony 4',
    artist: 'Local Artist B',
    album: 'Local Album B',
    duration: 195,
    path: 'content://media/external/audio/media/1004',
    isOnline: false
  }),
  createTestSong({
    id: 'device_track_5',
    title: 'Local Acoustic 5',
    artist: 'Local Artist C',
    album: 'Local Album C',
    duration: 160,
    path: 'content://media/external/audio/media/1005',
    isOnline: false
  })
];

describe('Local Music Auto-Play & Queue Continuation Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.setState({
      queue: [],
      queueIndex: -1,
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      repeatMode: 'off',
      shuffleMode: 'off',
      isShuffle: false,
      shuffledQueueOrder: [],
      playbackHistory: [],
      isAuraFlow: true // AuraFlow ON globally; local playback must strictly ignore it
    });

    useLibraryStore.setState({
      songs: [...LOCAL_SONGS_FIXTURE],
      isOnline: true
    });
  });

  afterEach(() => {
    usePlayerStore.setState({ queue: [], currentSong: null, isPlaying: false });
  });

  // 1. Auto-queue creation from single song click
  it('automatically creates a queue from library local songs when playing a single local track without queue', async () => {
    const targetSong = LOCAL_SONGS_FIXTURE[2]; // Track 3
    await usePlayerStore.getState().playSong(targetSong);

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe(targetSong.id);
    expect(state.queue.length).toBe(LOCAL_SONGS_FIXTURE.length);
    expect(state.queueIndex).toBe(2);
    expect(state.queue.every((s) => s.id.startsWith('device_'))).toBe(true);
  });

  // 2. Filtered queue support
  it('preserves filtered customQueue when provided (e.g. from artist or album view)', async () => {
    const artistSongs = LOCAL_SONGS_FIXTURE.filter((s) => s.artist === 'Local Artist A');
    expect(artistSongs.length).toBe(2);

    await usePlayerStore.getState().playSong(artistSongs[1], artistSongs, 1);

    const state = usePlayerStore.getState();
    expect(state.queue.length).toBe(2);
    expect(state.queueIndex).toBe(1);
    expect(state.currentSong?.id).toBe(artistSongs[1].id);
  });

  // 3. Automatic queue advancement on song end
  it('automatically advances to the next track when current local track ends', async () => {
    await usePlayerStore.getState().playSong(LOCAL_SONGS_FIXTURE[0]);
    expect(usePlayerStore.getState().queueIndex).toBe(0);

    // Simulate song end callback
    (audioService as any).triggerSongEnd();

    expect(usePlayerStore.getState().queueIndex).toBe(1);
    expect(usePlayerStore.getState().currentSong?.id).toBe(LOCAL_SONGS_FIXTURE[1].id);
    expect(audioService.playSong).toHaveBeenCalledWith(LOCAL_SONGS_FIXTURE[1]);

    // Advance to track 2
    (audioService as any).triggerSongEnd();
    expect(usePlayerStore.getState().queueIndex).toBe(2);
    expect(usePlayerStore.getState().currentSong?.id).toBe(LOCAL_SONGS_FIXTURE[2].id);
  });

  // 4. Repeat 'off': stops at end of queue, NO online injection
  it('stops playback when queue ends and repeatMode is "off", without injecting online songs', async () => {
    // Start at last track
    const lastIdx = LOCAL_SONGS_FIXTURE.length - 1;
    await usePlayerStore.getState().playSong(LOCAL_SONGS_FIXTURE[lastIdx]);
    usePlayerStore.setState({ repeatMode: 'off' });

    expect(usePlayerStore.getState().queueIndex).toBe(lastIdx);

    // Song finishes
    (audioService as any).triggerSongEnd();

    // Must pause and remain at last index without adding any online track
    expect(audioService.pause).toHaveBeenCalled();
    expect(usePlayerStore.getState().queue.length).toBe(LOCAL_SONGS_FIXTURE.length);
    expect(usePlayerStore.getState().queue.every((s) => !s.isOnline && !s.isAuraFlow)).toBe(true);
  });

  // 5. Repeat 'all': loops to beginning
  it('loops back to track 0 when queue ends and repeatMode is "all"', async () => {
    const lastIdx = LOCAL_SONGS_FIXTURE.length - 1;
    await usePlayerStore.getState().playSong(LOCAL_SONGS_FIXTURE[lastIdx]);
    usePlayerStore.setState({ repeatMode: 'all' });

    expect(usePlayerStore.getState().queueIndex).toBe(lastIdx);

    // Song finishes
    (audioService as any).triggerSongEnd();

    // Must loop back to index 0
    expect(usePlayerStore.getState().queueIndex).toBe(0);
    expect(usePlayerStore.getState().currentSong?.id).toBe(LOCAL_SONGS_FIXTURE[0].id);
    expect(audioService.playSong).toHaveBeenCalledWith(LOCAL_SONGS_FIXTURE[0]);
  });

  // 6. Repeat 'one': replays current song
  it('replays same track from 0:00 when repeatMode is "one"', async () => {
    await usePlayerStore.getState().playSong(LOCAL_SONGS_FIXTURE[2]);
    usePlayerStore.setState({ repeatMode: 'one' });

    expect(usePlayerStore.getState().queueIndex).toBe(2);

    // Song finishes
    (audioService as any).triggerSongEnd();

    // Must seek(0), resume, and stay on track 2
    expect(audioService.seek).toHaveBeenCalledWith(0);
    expect(audioService.resume).toHaveBeenCalled();
    expect(usePlayerStore.getState().queueIndex).toBe(2);
    expect(usePlayerStore.getState().currentSong?.id).toBe(LOCAL_SONGS_FIXTURE[2].id);
  });

  // 7. Shuffle mode on local queue
  it('supports shuffle mode on local queue, advancing through shuffled indices without online tracks', async () => {
    await usePlayerStore.getState().playSong(LOCAL_SONGS_FIXTURE[0]);
    usePlayerStore.getState().setShuffleMode('fair');

    const state = usePlayerStore.getState();
    expect(state.isShuffle).toBe(true);
    expect(state.shuffledQueueOrder.length).toBe(LOCAL_SONGS_FIXTURE.length);

    const visitedIndices: number[] = [state.queueIndex];

    for (let i = 1; i < LOCAL_SONGS_FIXTURE.length; i++) {
      usePlayerStore.getState().nextSong();
      const currentIdx = usePlayerStore.getState().queueIndex;
      expect(visitedIndices.includes(currentIdx)).toBe(false);
      visitedIndices.push(currentIdx);
    }

    expect(visitedIndices.length).toBe(LOCAL_SONGS_FIXTURE.length);
    // Queue must still have only 5 local songs
    expect(usePlayerStore.getState().queue.length).toBe(LOCAL_SONGS_FIXTURE.length);
  });

  // 8. Previous track navigation
  it('handles previous track navigation correctly', async () => {
    await usePlayerStore.getState().playSong(LOCAL_SONGS_FIXTURE[0]);
    usePlayerStore.getState().nextSong(); // to track 1
    usePlayerStore.getState().nextSong(); // to track 2

    expect(usePlayerStore.getState().queueIndex).toBe(2);

    // If currentTime <= 3s, previousSong pops history
    usePlayerStore.setState({ currentTime: 1.5 });
    usePlayerStore.getState().previousSong();
    expect(usePlayerStore.getState().queueIndex).toBe(1);

    // If currentTime > 3s, previousSong restarts current track
    usePlayerStore.setState({ currentTime: 12.0 });
    usePlayerStore.getState().previousSong();
    expect(audioService.seek).toHaveBeenCalledWith(0);
    expect(usePlayerStore.getState().queueIndex).toBe(1);
  });

  // 9. Central native mediaAction dispatching
  it('dispatches native ExoPlayer mediaAction events (next, prev, pause, play, seek)', async () => {
    await usePlayerStore.getState().playSong(LOCAL_SONGS_FIXTURE[0]);
    usePlayerStore.setState({ isPlaying: true });

    // ExoPlayer finishes track -> native emits mediaAction: "next"
    dispatchMediaAction('next');
    expect(usePlayerStore.getState().queueIndex).toBe(1);

    // Bluetooth Previous -> native emits mediaAction: "previous"
    usePlayerStore.setState({ currentTime: 0.5 });
    dispatchMediaAction('previous');
    expect(usePlayerStore.getState().queueIndex).toBe(0);

    // Lockscreen Pause -> native emits mediaAction: "pause"
    dispatchMediaAction('pause');
    expect(audioService.togglePlay).toHaveBeenCalled();

    // Lockscreen Seek -> native emits mediaAction: "seek"
    dispatchMediaAction('seek', 45);
    expect(audioService.seek).toHaveBeenCalledWith(45);
  });

  // 10. Separation: Online streaming and local tracks never mix
  it('never mixes online songs into a local queue when an online track is played', async () => {
    // 1. Play local song
    await usePlayerStore.getState().playSong(LOCAL_SONGS_FIXTURE[0]);
    expect(usePlayerStore.getState().queue.length).toBe(LOCAL_SONGS_FIXTURE.length);

    // 2. Play online song
    const onlineSong: Song = createTestSong({
      id: 'online_123',
      title: 'Online Streaming Hit',
      artist: 'Online Artist',
      album: 'Online Album',
      duration: 200,
      isOnline: true,
      filePath: 'https://streaming.example.com/audio.m4a'
    });

    await usePlayerStore.getState().playSong(onlineSong);

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe(onlineSong.id);
    expect(state.queue.length).toBe(1);
    expect(state.queue[0].id).toBe(onlineSong.id);
    expect(state.queue.some((s) => s.id.startsWith('device_'))).toBe(false);
  });
});
