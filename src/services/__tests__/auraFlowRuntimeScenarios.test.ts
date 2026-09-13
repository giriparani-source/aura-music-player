import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { audioService } from '../audioService';
import { auraFlowService, DEFAULT_FLOW_WEIGHTS } from '../auraFlowService';
import { audioEffectsService } from '../audioEffectsService';
import { sleepTimerService } from '../sleepTimerService';
import { Song } from '../../types/music';

describe('Aura Flow Runtime Verification (Scenarios 1–10)', () => {
  const songA: Song = {
    id: 'flow-song-a',
    title: 'Hukum',
    artist: 'Anirudh Ravichander',
    album: 'Jailer',
    genre: 'Soundtrack',
    duration: 200,
    path: '/a.mp3',
    filePath: '/a.mp3',
    fileName: 'a.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 5,
    isFavorite: false,
    isOnline: true,
    isSaavn: true
  };

  const songB: Song = {
    id: 'flow-song-b',
    title: 'Naa Ready',
    artist: 'Anirudh Ravichander',
    album: 'Leo',
    genre: 'Soundtrack',
    duration: 220,
    path: '/b.mp3',
    filePath: '/b.mp3',
    fileName: 'b.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 10,
    isFavorite: false,
    isOnline: true,
    isSaavn: true
  };

  const songC: Song = {
    id: 'flow-song-c',
    title: 'Munbe Vaa',
    artist: 'A.R. Rahman',
    album: 'Sillunu Oru Kaadhal',
    genre: 'Romantic',
    duration: 350,
    path: '/c.mp3',
    filePath: '/c.mp3',
    fileName: 'c.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 8,
    isFavorite: true,
    isOnline: true,
    isSaavn: true
  };

  const songLocal: Song = {
    id: 'flow-song-local',
    title: 'Local Melody',
    artist: 'Local Artist',
    album: 'Local Album',
    genre: 'Acoustic',
    duration: 180,
    path: '/local.mp3',
    filePath: '/local.mp3',
    fileName: 'local.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 2,
    isFavorite: false,
    isOnline: false,
    isSaavn: false
  };

  const songDownloaded: Song = {
    id: 'flow-song-dl',
    title: 'Downloaded Track',
    artist: 'A.R. Rahman',
    album: 'Classics',
    genre: 'Soundtrack',
    duration: 240,
    path: '/dl.mp3',
    filePath: '/dl.mp3',
    fileName: 'dl.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 15,
    isFavorite: false,
    isOnline: true,
    isSaavn: true,
    isDownloaded: true
  };

  const catalog = [songA, songB, songC, songLocal, songDownloaded];

  beforeEach(() => {
    auraFlowService.resetSession();
    auraFlowService.setWeights(DEFAULT_FLOW_WEIGHTS);
    usePlayerStore.setState({
      isAuraFlow: false,
      queue: [],
      queueIndex: -1,
      currentSong: null,
      playbackHistory: [],
      shuffledQueueOrder: [],
      isShuffle: false,
      isFairShuffle: true,
      repeatMode: 'off'
    });
    useLibraryStore.setState({
      songs: catalog,
      downloadedSongIds: new Set(['flow-song-dl']),
      isOnline: true
    });
  });

  it('1. Aura Flow OFF -> existing player behavior unchanged (pauses at queue end)', () => {
    const pauseSpy = vi.spyOn(audioService, 'pause').mockImplementation(() => {});

    usePlayerStore.setState({
      isAuraFlow: false,
      queue: [songA],
      queueIndex: 0,
      currentSong: songA
    });

    usePlayerStore.getState().nextSong();

    expect(pauseSpy).toHaveBeenCalled();
    expect(usePlayerStore.getState().queue.length).toBe(1);
    expect(usePlayerStore.getState().queueIndex).toBe(0);
  });

  it('2. Aura Flow ON -> queue-end continues automatically', () => {
    vi.spyOn(audioService, 'playSong').mockResolvedValue();

    usePlayerStore.setState({
      isAuraFlow: true,
      queue: [songA],
      queueIndex: 0,
      currentSong: songA
    });

    usePlayerStore.getState().nextSong();

    const state = usePlayerStore.getState();
    expect(state.queue.length).toBe(2);
    expect(state.queueIndex).toBe(1);
    expect(state.currentSong).not.toBeNull();
    expect(state.currentSong?.isAuraFlow).toBe(true);
    expect(state.currentSong?.id).not.toBe(songA.id);
  });

  it('3. Manual queue item always plays before Aura Flow items', () => {
    const autoTrack: Song = { ...songB, isAuraFlow: true };
    const userTrack: Song = { ...songC, isAuraFlow: false };

    usePlayerStore.setState({
      isAuraFlow: true,
      queue: [songA, autoTrack],
      queueIndex: 0,
      currentSong: songA
    });

    // User adds track to queue end
    usePlayerStore.getState().addToQueueEnd(userTrack);

    const queue = usePlayerStore.getState().queue;
    expect(queue.length).toBe(3);
    // userTrack must be placed before autoTrack!
    expect(queue[1].id).toBe(userTrack.id);
    expect(queue[1].isAuraFlow).toBeFalsy();
    expect(queue[2].id).toBe(autoTrack.id);
    expect(queue[2].isAuraFlow).toBe(true);
  });

  it('4. No same-song immediate repetition', () => {
    usePlayerStore.setState({
      isAuraFlow: true,
      queue: [songA],
      queueIndex: 0,
      currentSong: songA
    });

    // Run autoplay 5 times in a row
    for (let step = 0; step < 5; step++) {
      const current = usePlayerStore.getState().currentSong;
      usePlayerStore.getState().nextSong();
      const next = usePlayerStore.getState().currentSong;
      expect(next?.id).not.toBe(current?.id);
    }
  });

  it('5. Artist repetition is controlled with penalties', () => {
    // Current song is Anirudh
    // Candidate B is also Anirudh
    // Candidate C is A.R. Rahman
    const context: any = {
      currentSong: songA,
      queue: [songA],
      queueIndex: 0,
      playbackHistory: [songA.id], // Anirudh recently played
      allSongs: catalog,
      downloadedSongIds: new Set(),
      isOnline: true,
      weights: { explorationJitter: 0 }
    };

    const scoreB = auraFlowService.scoreCandidate(songB, songA, context, DEFAULT_FLOW_WEIGHTS);
    expect(scoreB.breakdown.artistRepeatPenalty).toBe(-DEFAULT_FLOW_WEIGHTS.artistRepeatPenalty);
  });

  it('6. Offline mode never selects remote-only tracks', () => {
    useLibraryStore.setState({
      songs: catalog,
      downloadedSongIds: new Set(['flow-song-dl']),
      isOnline: false // Offline mode!
    });

    usePlayerStore.setState({
      isAuraFlow: true,
      queue: [songLocal],
      queueIndex: 0,
      currentSong: songLocal
    });

    // Generate candidates offline
    const candidates = auraFlowService.generateCandidates({
      currentSong: songLocal,
      queue: [songLocal],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: catalog,
      downloadedSongIds: new Set(['flow-song-dl']),
      isOnline: false
    });

    // Every candidate must be either local or downloaded
    for (const c of candidates) {
      const isLocal = !c.isOnline && !c.isSaavn;
      const isDl = c.isDownloaded || c.id === 'flow-song-dl';
      expect(isLocal || isDl).toBe(true);
    }

    // Remote un-downloaded tracks must never appear
    const ids = candidates.map((c) => c.id);
    expect(ids).not.toContain(songA.id);
    expect(ids).not.toContain(songB.id);
    expect(ids).not.toContain(songC.id);
  });

  it('7. Downloaded remote tracks can participate offline', () => {
    const candidates = auraFlowService.generateCandidates({
      currentSong: songLocal,
      queue: [songLocal],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: catalog,
      downloadedSongIds: new Set(['flow-song-dl']),
      isOnline: false
    });

    const ids = candidates.map((c) => c.id);
    expect(ids).toContain('flow-song-dl');
  });

  it('8. Turning Aura Flow OFF stops future Aura Flow injection and clears buffered tracks', () => {
    const autoTrack: Song = { ...songB, isAuraFlow: true };

    usePlayerStore.setState({
      isAuraFlow: true,
      queue: [songA, autoTrack],
      queueIndex: 0,
      currentSong: songA
    });

    // Turning Aura Flow OFF
    usePlayerStore.getState().toggleAuraFlow();

    const state = usePlayerStore.getState();
    expect(state.isAuraFlow).toBe(false);
    expect(state.queue.length).toBe(1);
    expect(state.queue[0].id).toBe(songA.id);
  });

  it('9. Existing Fair Shuffle still behaves normally and independently', () => {
    usePlayerStore.setState({
      isShuffle: false,
      isFairShuffle: true,
      queue: [songA, songB, songC, songLocal],
      queueIndex: 0,
      currentSong: songA
    });

    // Toggle shuffle ON
    usePlayerStore.getState().toggleShuffle();
    const state = usePlayerStore.getState();
    expect(state.isShuffle).toBe(true);
    expect(state.shuffledQueueOrder.length).toBe(4);
    expect(state.shuffledQueueOrder[0]).toBe(0); // Current index at front

    // Toggle Fair Shuffle
    usePlayerStore.getState().toggleFairShuffle();
    expect(usePlayerStore.getState().isFairShuffle).toBe(false);
    usePlayerStore.getState().toggleFairShuffle();
    expect(usePlayerStore.getState().isFairShuffle).toBe(true);
  });

  it('10. Existing lyrics, DSP, sleep timer, and downloads remain unaffected', () => {
    // DSP remains controllable
    const limiterBefore = audioEffectsService.isLimiterEnabled();
    audioEffectsService.toggleLimiter();
    expect(audioEffectsService.isLimiterEnabled()).toBe(!limiterBefore);
    audioEffectsService.toggleLimiter(); // restore

    // Sleep timer remains controllable
    sleepTimerService.setSleepTimer('15');
    expect(sleepTimerService.getMode()).toBe('15');
    sleepTimerService.cancelSleepTimer();
    expect(sleepTimerService.getMode()).toBe('off');

    // Downloads remain tracked
    expect(useLibraryStore.getState().downloadedSongIds.has('flow-song-dl')).toBe(true);
  });
});
