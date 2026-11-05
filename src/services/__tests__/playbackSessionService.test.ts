import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  playbackSessionService,
  detectSourceProvider,
  getStableSourceIdentifier,
  sanitizeSongForPersistence,
  validateAndSanitizeSession
} from '../playbackSessionService';
import { musicDB } from '../db';
import { usePlayerStore } from '../../store/usePlayerStore';
import { audioService } from '../audioService';
import { Song, PlaybackSession } from '../../types/music';

// Mock songs
const mockSong1: Song = {
  id: 'song-1',
  title: 'Hukum - Thalaivar Alappara',
  artist: 'Anirudh Ravichander',
  album: 'Jailer',
  duration: 236,
  filePath: 'https://aac.saavncdn.com/187/jailer_320.mp4',
  path: 'https://aac.saavncdn.com/187/jailer_320.mp4',
  fileName: 'hukum.mp4',
  format: 'mp4',
  fileSize: 8000000,
  bitrate: 320,
  dateAdded: Date.now(),
  playCount: 10,
  isFavorite: true,
  isOnline: true,
  isSaavn: true
};

const mockSong2: Song = {
  id: 'song-2',
  title: 'Naa Ready',
  artist: 'Thalapathy Vijay, Anirudh',
  album: 'Leo',
  duration: 248,
  filePath: 'https://aac.saavncdn.com/415/leo_320.mp4',
  path: 'https://aac.saavncdn.com/415/leo_320.mp4',
  fileName: 'naa_ready.mp4',
  format: 'mp4',
  fileSize: 8500000,
  bitrate: 320,
  dateAdded: Date.now(),
  playCount: 5,
  isFavorite: false,
  isOnline: true,
  isSaavn: true
};

const mockLocalSong: Song = {
  id: 'local-song-99',
  title: 'Vaseegara',
  artist: 'Bombay Jayashri',
  album: 'Minnale',
  duration: 301,
  filePath: '/music/minnale/vaseegara.mp3',
  path: '/music/minnale/vaseegara.mp3',
  fileName: 'vaseegara.mp3',
  format: 'mp3',
  fileSize: 6000000,
  bitrate: 256,
  dateAdded: Date.now(),
  playCount: 20,
  isFavorite: true
};

const mockYouTubeSong: Song = {
  id: 'online_dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  artist: 'Rick Astley',
  album: 'Whenever You Need Somebody',
  duration: 212,
  filePath: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  path: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  fileName: 'rick.mp4',
  format: 'm4a',
  fileSize: 5000000,
  bitrate: 192,
  dateAdded: Date.now(),
  playCount: 1,
  isFavorite: false,
  isOnline: true,
  sourceId: 'dQw4w9WgXcQ'
};

const mockRadioSong: Song = {
  id: 'radio_suryan_fm',
  title: 'Suryan FM 93.5',
  artist: 'Live Radio',
  album: 'Chennai Live',
  duration: 0,
  filePath: 'https://stream.zeno.fm/suryanfm',
  path: 'https://stream.zeno.fm/suryanfm',
  fileName: 'stream',
  format: 'aac',
  fileSize: 0,
  dateAdded: Date.now(),
  playCount: 3,
  isFavorite: false,
  isLiveRadio: true
};

describe('PlaybackSessionService & Spotify-style Persistence', () => {
  let mockStorage: Map<string, any>;

  beforeEach(() => {
    mockStorage = new Map();

    vi.spyOn(musicDB, 'savePlaybackSession').mockImplementation(async (session: PlaybackSession) => {
      mockStorage.set('aura_playback_session', JSON.parse(JSON.stringify(session)));
    });

    vi.spyOn(musicDB, 'getPlaybackSession').mockImplementation(async () => {
      const stored = mockStorage.get('aura_playback_session');
      return stored ? JSON.parse(JSON.stringify(stored)) : null;
    });

    vi.spyOn(musicDB, 'clearPlaybackSession').mockImplementation(async () => {
      mockStorage.delete('aura_playback_session');
    });

    vi.spyOn(musicDB, 'getSongById').mockImplementation(async (id: string) => {
      if (id === mockLocalSong.id) return { ...mockLocalSong };
      if (id === mockSong1.id) return { ...mockSong1 };
      if (id === mockSong2.id) return { ...mockSong2 };
      return undefined;
    });

    // Reset player store
    usePlayerStore.setState({
      currentSong: null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      queue: [],
      queueIndex: -1,
      isShuffle: false,
      shuffleMode: 'off',
      shuffledQueueOrder: [],
      repeatMode: 'off'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. SAVE & RESTORE PLAYBACK SESSION
  // ---------------------------------------------------------------------------
  it('saves and restores playback session with exact position, queue, and state', async () => {
    const queue = [mockSong1, mockSong2];
    const session = playbackSessionService.createSession({
      currentSong: mockSong1,
      currentTime: 84.5,
      duration: 236,
      queue,
      queueIndex: 0,
      isShuffle: true,
      shuffleMode: 'fair',
      shuffledQueueOrder: [0, 1],
      repeatMode: 'all'
    });

    await playbackSessionService.saveSessionImmediate(session);

    const loaded = await playbackSessionService.loadSession();
    expect(loaded).toBeDefined();
    expect(loaded?.songId).toBe(mockSong1.id);
    expect(loaded?.position).toBe(84.5);
    expect(loaded?.duration).toBe(236);
    expect(loaded?.queueTrackIds).toEqual(['song-1', 'song-2']);
    expect(loaded?.queueIndex).toBe(0);
    expect(loaded?.shuffleState.isShuffle).toBe(true);
    expect(loaded?.shuffleState.shuffleMode).toBe('fair');
    expect(loaded?.repeatState).toBe('all');
  });

  // ---------------------------------------------------------------------------
  // 2. POSITION PERSISTENCE & CLAMPING
  // ---------------------------------------------------------------------------
  describe('Position Persistence & Clamping', () => {
    it('restores exact position when within valid bounds', async () => {
      const session = playbackSessionService.createSession({
        currentSong: mockSong1,
        currentTime: 142,
        duration: 236,
        queue: [mockSong1],
        queueIndex: 0,
        isShuffle: false,
        shuffleMode: 'off',
        repeatMode: 'off'
      });
      await playbackSessionService.saveSessionImmediate(session);

      const loaded = await playbackSessionService.loadSession();
      expect(loaded?.position).toBe(142);
    });

    it('clamps position to duration - 1 if saved position exceeds track duration', () => {
      const sanitized = validateAndSanitizeSession({
        songId: 'song-1',
        position: 500, // Exceeds duration
        duration: 200,
        queueTrackIds: ['song-1'],
        updatedAt: Date.now()
      });
      expect(sanitized?.position).toBe(199);
    });

    it('resets negative or NaN position to 0', () => {
      const neg = validateAndSanitizeSession({
        songId: 'song-1',
        position: -40,
        duration: 200,
        queueTrackIds: ['song-1'],
        updatedAt: Date.now()
      });
      expect(neg?.position).toBe(0);

      const nanPos = validateAndSanitizeSession({
        songId: 'song-1',
        position: NaN,
        duration: 200,
        queueTrackIds: ['song-1'],
        updatedAt: Date.now()
      });
      expect(nanPos?.position).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. QUEUE PERSISTENCE & SANITIZATION
  // ---------------------------------------------------------------------------
  describe('Queue Persistence & Blob URL Sanitization', () => {
    it('persists multi-track queue and strips temporary blob URLs', async () => {
      const transientSong: Song = {
        ...mockLocalSong,
        path: 'blob:http://localhost:3000/12345-temporary-blob',
        filePath: 'blob:http://localhost:3000/12345-temporary-blob'
      };

      const session = playbackSessionService.createSession({
        currentSong: transientSong,
        currentTime: 30,
        duration: 301,
        queue: [transientSong, mockSong1],
        queueIndex: 0,
        isShuffle: false,
        shuffleMode: 'off',
        repeatMode: 'off'
      });

      await playbackSessionService.saveSessionImmediate(session);
      const loaded = await playbackSessionService.loadSession();

      // Ensure no blob: URL was stored
      expect(loaded?.queueTracks?.[0].path.startsWith('blob:')).toBe(false);
      expect(loaded?.queueTracks?.[0].filePath.startsWith('blob:')).toBe(false);
      expect(loaded?.queueTrackIds).toEqual(['local-song-99', 'song-1']);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. APP REOPEN SIMULATION (Spotify-style restoration without auto-play)
  // ---------------------------------------------------------------------------
  describe('App Reopen Simulation', () => {
    it('restores player state on reopen, cues audio element, and DOES NOT auto-play', async () => {
      const queue = [mockSong1, mockSong2];
      const session = playbackSessionService.createSession({
        currentSong: mockSong2,
        currentTime: 95,
        duration: 248,
        queue,
        queueIndex: 1,
        isShuffle: true,
        shuffleMode: 'smart',
        repeatMode: 'one'
      });
      await playbackSessionService.saveSessionImmediate(session);

      // Simulate App Close: wipe in-memory Zustand player state
      usePlayerStore.setState({
        currentSong: null,
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        queue: [],
        queueIndex: -1,
        isShuffle: false,
        shuffleMode: 'off',
        repeatMode: 'off'
      });

      // Spy on audioService
      const restoreSpy = vi.spyOn(audioService, 'restoreSession').mockResolvedValue(undefined);
      const playSpy = vi.spyOn(audioService, 'playSong');

      // Simulate App Startup restoration
      const restored = await usePlayerStore.getState().restorePlaybackSession();
      expect(restored).toBe(true);

      const state = usePlayerStore.getState();
      // UI / Mini-player state is restored
      expect(state.currentSong?.id).toBe(mockSong2.id);
      expect(state.currentSong?.title).toBe(mockSong2.title);
      expect(state.currentTime).toBe(95);
      expect(state.duration).toBe(248);
      expect(state.queue.length).toBe(2);
      expect(state.queueIndex).toBe(1);
      expect(state.isShuffle).toBe(true);
      expect(state.shuffleMode).toBe('smart');
      expect(state.repeatMode).toBe('one');

      // CRITICAL: Must NOT auto-play!
      expect(state.isPlaying).toBe(false);
      expect(restoreSpy).toHaveBeenCalledWith(expect.objectContaining({ id: mockSong2.id }), 95);
      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. DELETED SONG HANDLING
  // ---------------------------------------------------------------------------
  describe('Deleted Song Handling', () => {
    it('gracefully skips and clears session if saved local song was deleted from library', async () => {
      // Create session with a deleted track
      const deletedTrackId = 'deleted-song-123';
      const session: PlaybackSession = {
        songId: deletedTrackId,
        provider: 'local',
        sourceIdentifier: '/music/deleted.mp3',
        position: 50,
        duration: 200,
        queueTrackIds: [deletedTrackId],
        queueTracks: [
          {
            ...mockLocalSong,
            id: deletedTrackId,
            title: 'Deleted Song'
          }
        ],
        queueIndex: 0,
        shuffleState: { isShuffle: false, shuffleMode: 'off' },
        repeatState: 'off',
        updatedAt: Date.now()
      };
      await playbackSessionService.saveSessionImmediate(session);

      // musicDB.getSongById will return undefined for deleted track
      const restored = await usePlayerStore.getState().restorePlaybackSession();
      expect(restored).toBe(false);

      // Session should be cleared
      const remaining = await playbackSessionService.loadSession();
      expect(remaining).toBeNull();
      expect(usePlayerStore.getState().currentSong).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. INVALID / STALE SESSION HANDLING
  // ---------------------------------------------------------------------------
  describe('Invalid or Stale Session Handling', () => {
    it('rejects stale sessions older than 30 days', () => {
      const thirtyFiveDaysAgo = Date.now() - 35 * 24 * 60 * 60 * 1000;
      const stale = validateAndSanitizeSession({
        songId: 'song-1',
        position: 10,
        duration: 200,
        queueTrackIds: ['song-1'],
        updatedAt: thirtyFiveDaysAgo
      });
      expect(stale).toBeNull();
    });

    it('rejects corrupted or non-object session data', () => {
      expect(validateAndSanitizeSession(null)).toBeNull();
      expect(validateAndSanitizeSession('invalid-string')).toBeNull();
      expect(validateAndSanitizeSession({})).toBeNull(); // Missing songId
      expect(validateAndSanitizeSession({ songId: '' })).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 7. SOURCE RE-RESOLUTION ACROSS PROVIDERS
  // ---------------------------------------------------------------------------
  describe('Source Provider Detection & Stable Identifier', () => {
    it('accurately identifies provider and stable identifier for all music types', () => {
      // Local
      expect(detectSourceProvider(mockLocalSong)).toBe('local');
      expect(getStableSourceIdentifier(mockLocalSong, 'local')).toBe(mockLocalSong.path);

      // JioSaavn
      expect(detectSourceProvider(mockSong1)).toBe('saavn');
      expect(getStableSourceIdentifier(mockSong1, 'saavn')).toBe(mockSong1.id);

      // YouTube
      expect(detectSourceProvider(mockYouTubeSong)).toBe('youtube');
      expect(getStableSourceIdentifier(mockYouTubeSong, 'youtube')).toBe('dQw4w9WgXcQ');

      // Live Radio
      expect(detectSourceProvider(mockRadioSong)).toBe('radio');
      expect(getStableSourceIdentifier(mockRadioSong, 'radio')).toBe(mockRadioSong.id);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. THROTTLED VS IMMEDIATE SAVE TIMING
  // ---------------------------------------------------------------------------
  describe('Save Scheduling Timing', () => {
    it('throttles rapid progress updates and saves immediate calls instantly', async () => {
      const saveSpy = vi.spyOn(musicDB, 'savePlaybackSession');

      const session = playbackSessionService.createSession({
        currentSong: mockSong1,
        currentTime: 10,
        duration: 236,
        queue: [mockSong1],
        queueIndex: 0,
        isShuffle: false,
        shuffleMode: 'off',
        repeatMode: 'off'
      });

      // Immediate save
      await playbackSessionService.saveSessionImmediate(session);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      // Rapid throttled calls within 500ms should not trigger immediate DB writes
      playbackSessionService.saveSessionThrottled({ ...session, position: 11 });
      playbackSessionService.saveSessionThrottled({ ...session, position: 12 });
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });
});
