/**
 * src/services/__tests__/auraAffinityService.test.ts
 *
 * Unit tests for Aura Flow Long-Term Affinity: Phase 5.1
 * - Profile building from existing persisted data
 * - Recency decay weighting
 * - Favorite signal weighting
 * - Stale and malformed profile handling
 * - Ghost/deleted history track handling
 * - Startup hydration and non-blocking safety
 * - Fallback resilience and Aura Flow continuity
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  auraAffinityService,
  buildAffinityProfile,
  calculateRecencyDecay,
  UserAffinityProfile,
  AURA_AFFINITY_VERSION,
  RECENCY_WINDOW_7D_MS,
  RECENCY_WINDOW_30D_MS,
  RECENCY_WINDOW_90D_MS
} from '../auraAffinityService';
import { auraFlowService, FlowContext } from '../auraFlowService';
import { musicDB, AURA_USER_AFFINITY_KEY } from '../db';
import { Song } from '../../types/music';

const mockSong = (overrides: Partial<Song> = {}): Song => ({
  id: 'test-song-1',
  title: 'Arabic Kuthu',
  artist: 'Anirudh Ravichander',
  album: 'Beast',
  genre: 'Soundtrack',
  duration: 280,
  path: '/path/song1.mp3',
  filePath: '/path/song1.mp3',
  fileName: 'song1.mp3',
  format: 'mp3',
  fileSize: 5000,
  dateAdded: Date.now() - 10000,
  playCount: 0,
  isFavorite: false,
  ...overrides
});

describe('Phase 5.1: Aura Flow Long-Term Affinity Profile', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    auraAffinityService.setProfile(null);
  });

  // 1. Empty library → neutral empty profile
  it('1. Empty library produces a neutral empty profile', () => {
    const profile = buildAffinityProfile([], []);
    expect(profile.version).toBe(AURA_AFFINITY_VERSION);
    expect(profile.totalMeaningfulPlays).toBe(0);
    expect(Object.keys(profile.artistAffinity).length).toBe(0);
    expect(Object.keys(profile.vibeAffinity).length).toBe(0);
    expect(profile.favoriteArtists).toEqual([]);
    expect(Object.keys(profile.recentArtistCounts).length).toBe(0);
    expect(Object.keys(profile.recentVibeCounts).length).toBe(0);
  });

  // 2. Zero history → no affinity bias
  it('2. Zero history and unplayed songs produce no affinity bias', () => {
    const song1 = mockSong({ id: 's1', artist: 'A.R. Rahman', playCount: 0, isFavorite: false });
    const song2 = mockSong({ id: 's2', artist: 'Harris Jayaraj', playCount: 0, isFavorite: false });

    const profile = buildAffinityProfile([song1, song2], []);
    expect(profile.totalMeaningfulPlays).toBe(0);
    expect(Object.keys(profile.artistAffinity).length).toBe(0);
    expect(Object.keys(profile.vibeAffinity).length).toBe(0);
    expect(profile.favoriteArtists).toEqual([]);
  });

  // 3. Favorite artist → stronger artist affinity
  it('3. Favorite artist signal contributes more strongly than ordinary play', () => {
    const now = Date.now();
    // Artist A has 0 plays but is favorite (weight 3.0)
    const favSong = mockSong({
      id: 's-fav',
      artist: 'Yuvan Shankar Raja',
      playCount: 0,
      isFavorite: true
    });
    // Artist B has 1 normal play (weight ~1.0) and is not favorite
    const normalSong = mockSong({
      id: 's-norm',
      artist: 'D. Imman',
      playCount: 1,
      lastPlayedAt: now - 1000,
      isFavorite: false
    });

    const profile = buildAffinityProfile([favSong, normalSong], [], now);

    // Yuvan (favorite) score normalized should be 100
    // Imman (1 play, decay 1.0 = 1.0) normalized relative to 3.0 = round(1.0/3.0 * 100) = 33
    expect(profile.artistAffinity['yuvan shankar raja']).toBe(100);
    expect(profile.artistAffinity['d imman']).toBeLessThan(100);
    expect(profile.favoriteArtists).toContain('yuvan shankar raja');
  });

  // 4. Meaningful play → artist/vibe affinity increases
  it('4. Meaningful play increases artist and vibe affinity', () => {
    const now = Date.now();
    const song = mockSong({
      id: 's1',
      artist: 'Anirudh Ravichander',
      genre: 'Soundtrack',
      playCount: 5,
      isFavorite: false
    });
    const history = [
      { songId: 's1', timestamp: now - 3600 * 1000 },
      { songId: 's1', timestamp: now - 7200 * 1000 }
    ];

    const profile = buildAffinityProfile([song], history, now);

    expect(profile.totalMeaningfulPlays).toBe(2);
    expect(profile.artistAffinity['anirudh ravichander']).toBeGreaterThan(0);
    expect(Object.keys(profile.vibeAffinity).length).toBeGreaterThan(0);
    expect(profile.recentArtistCounts['anirudh ravichander']).toBe(2);
  });

  // 5. Recency decay → recent activity weighs more than old activity
  it('5. Recency decay correctly weighs recent activity more than older activity', () => {
    const now = Date.now();

    // Unit checks for decay tiers
    expect(calculateRecencyDecay(now - 1000, now)).toBe(1.0); // <= 7d
    expect(calculateRecencyDecay(now - (RECENCY_WINDOW_7D_MS + 1000), now)).toBe(0.75); // 8-30d
    expect(calculateRecencyDecay(now - (RECENCY_WINDOW_30D_MS + 1000), now)).toBe(0.5); // 31-90d
    expect(calculateRecencyDecay(now - (RECENCY_WINDOW_90D_MS + 1000), now)).toBe(0.25); // > 90d

    // Relative profile test: Artist Recent vs Artist Old
    const songRecent = mockSong({ id: 's-rec', artist: 'Recent Artist', playCount: 0 });
    const songOld = mockSong({ id: 's-old', artist: 'Old Artist', playCount: 0 });

    const history = [
      { songId: 's-rec', timestamp: now - 1 * 24 * 3600 * 1000 }, // 1 day ago (decay 1.0)
      { songId: 's-old', timestamp: now - 120 * 24 * 3600 * 1000 } // 120 days ago (decay 0.25)
    ];

    const profile = buildAffinityProfile([songRecent, songOld], history, now);

    expect(profile.artistAffinity['recent artist']).toBe(100);
    expect(profile.artistAffinity['old artist']).toBe(25); // 0.25 / 1.0 * 100 = 25
  });

  // 6. Missing artist/genre → no crash
  it('6. Missing artist and genre do not crash profile generation', () => {
    const brokenSong1 = mockSong({ id: 'b1', artist: '', genre: undefined, playCount: 2 });
    const brokenSong2 = mockSong({ id: 'b2', artist: undefined as unknown as string, genre: '', isFavorite: true });

    expect(() => {
      const profile = buildAffinityProfile([brokenSong1, brokenSong2], []);
      expect(profile.version).toBe(AURA_AFFINITY_VERSION);
    }).not.toThrow();
  });

  // 7. Malformed cached profile → safe rebuild
  it('7. Malformed cached profile is discarded and safely rebuilt', async () => {
    const songs = [mockSong({ id: 's1', artist: 'Anirudh Ravichander', playCount: 2 })];

    // Mock IndexedDB getSetting returning corrupted profile
    vi.spyOn(musicDB, 'getSetting').mockResolvedValue({
      version: 999, // Unknown version
      corrupted: true
    });
    const setSettingSpy = vi.spyOn(musicDB, 'setSetting').mockResolvedValue(undefined);
    vi.spyOn(musicDB, 'getRecentHistory').mockResolvedValue([]);

    const profile = await auraAffinityService.initProfile(songs);

    expect(profile.version).toBe(AURA_AFFINITY_VERSION);
    expect(profile.artistAffinity['anirudh ravichander']).toBe(100);
    expect(setSettingSpy).toHaveBeenCalledWith(AURA_USER_AFFINITY_KEY, expect.anything());
  });

  // 8. Valid cached profile → hydration works
  it('8. Valid cached profile hydrates in-memory without rebuilding', async () => {
    const validProfile: UserAffinityProfile = {
      version: AURA_AFFINITY_VERSION,
      updatedAt: Date.now() - 60000,
      totalMeaningfulPlays: 42,
      artistAffinity: { 'anirudh ravichander': 100 },
      vibeAffinity: { energetic: 80 },
      favoriteArtists: ['anirudh ravichander'],
      recentArtistCounts: { 'anirudh ravichander': 5 },
      recentVibeCounts: { energetic: 5 }
    };

    vi.spyOn(musicDB, 'getSetting').mockResolvedValue(validProfile);
    const getHistorySpy = vi.spyOn(musicDB, 'getRecentHistory');

    const profile = await auraAffinityService.initProfile();

    expect(profile).toEqual(validProfile);
    expect(auraAffinityService.getProfile()).toEqual(validProfile);
    // Did not need to query history because cache was valid and fresh
    expect(getHistorySpy).not.toHaveBeenCalled();
  });

  // 9. Stale profile → rebuild
  it('9. Stale cached profile triggers rebuild', async () => {
    const now = Date.now();
    const staleProfile: UserAffinityProfile = {
      version: AURA_AFFINITY_VERSION,
      updatedAt: now - 48 * 60 * 60 * 1000, // 48h old (threshold 24h)
      totalMeaningfulPlays: 1,
      artistAffinity: { 'old artist': 100 },
      vibeAffinity: {},
      favoriteArtists: [],
      recentArtistCounts: {},
      recentVibeCounts: {}
    };

    const currentSongs = [mockSong({ id: 's1', artist: 'Fresh Artist', isFavorite: true })];

    vi.spyOn(musicDB, 'getSetting').mockResolvedValue(staleProfile);
    vi.spyOn(musicDB, 'getRecentHistory').mockResolvedValue([]);
    vi.spyOn(musicDB, 'setSetting').mockResolvedValue(undefined);

    const profile = await auraAffinityService.initProfile(currentSongs);

    expect(profile.artistAffinity['fresh artist']).toBe(100);
    expect(profile.artistAffinity['old artist']).toBeUndefined();
  });

  // 10. Profile persistence → save/load round trip works
  it('10. Profile persistence save and load round trip works', async () => {
    let storedValue: UserAffinityProfile | null = null;
    vi.spyOn(musicDB, 'setSetting').mockImplementation(async (key, val) => {
      if (key === AURA_USER_AFFINITY_KEY) storedValue = val as UserAffinityProfile;
    });
    vi.spyOn(musicDB, 'getSetting').mockImplementation(async (key, defaultVal) => {
      if (key === AURA_USER_AFFINITY_KEY) return storedValue || defaultVal;
      return defaultVal;
    });
    vi.spyOn(musicDB, 'deleteSetting').mockImplementation(async (key) => {
      if (key === AURA_USER_AFFINITY_KEY) storedValue = null;
    });

    const song = mockSong({ id: 's1', artist: 'Santhosh Narayanan', playCount: 3 });
    const profile = await auraAffinityService.initProfile([song]);

    expect(storedValue).not.toBeNull();
    expect(storedValue!.version).toBe(AURA_AFFINITY_VERSION);
    expect(storedValue!.artistAffinity['santhosh narayanan']).toBe(100);

    // Clear and re-hydrate from simulated DB storage
    auraAffinityService.setProfile(null);
    const reloaded = await auraAffinityService.initProfile();
    expect(reloaded.artistAffinity['santhosh narayanan']).toBe(100);

    // Clear profile deletes setting
    await auraAffinityService.clearProfile();
    expect(storedValue).toBeNull();
    expect(auraAffinityService.getProfile()).toBeNull();
  });

  // 11. Deleted/ghost history song → ignored safely
  it('11. Ghost history songs not present in library are ignored safely', () => {
    const existingSong = mockSong({ id: 'exist-1', artist: 'Ghibran', playCount: 1 });
    const history = [
      { songId: 'exist-1', timestamp: Date.now() },
      { songId: 'ghost-song-999', timestamp: Date.now() } // Deleted from library
    ];

    const profile = buildAffinityProfile([existingSong], history);

    expect(profile.totalMeaningfulPlays).toBe(1);
    expect(profile.artistAffinity['ghibran']).toBe(100);
    expect(profile.artistAffinity['ghost']).toBeUndefined();
  });

  // 12. Existing Aura Flow behavior remains available if affinity initialization fails
  it('12. Existing Aura Flow behavior remains available if affinity initialization fails', async () => {
    // Force musicDB to reject with an unhandled exception
    vi.spyOn(musicDB, 'getSetting').mockRejectedValue(new Error('IndexedDB QuotaExceeded or corruption'));
    vi.spyOn(musicDB, 'getAllSongs').mockRejectedValue(new Error('IndexedDB failure'));
    vi.spyOn(musicDB, 'getRecentHistory').mockRejectedValue(new Error('IndexedDB failure'));

    // Should not throw, but fall back to neutral profile
    const profile = await auraFlowService.initAffinityProfile();
    expect(profile.version).toBe(AURA_AFFINITY_VERSION);
    expect(profile.totalMeaningfulPlays).toBe(0);

    // Verify Aura Flow candidate recommendation continues working normally
    const candidateA = mockSong({ id: 'c1', title: 'Song 1', artist: 'Anirudh', genre: 'Soundtrack' });
    const candidateB = mockSong({ id: 'c2', title: 'Song 2', artist: 'ARR', genre: 'Soundtrack' });
    const current = mockSong({ id: 'curr', title: 'Curr', artist: 'Anirudh', genre: 'Soundtrack' });

    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, candidateA, candidateB],
      downloadedSongIds: new Set(),
      isOnline: true
    };

    const next = auraFlowService.getNextTrack(context);
    expect(next).not.toBeNull();
    expect(next?.id).toBeDefined();
    expect(next?.id).not.toBe('curr');
  });
});
