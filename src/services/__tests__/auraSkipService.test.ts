/**
 * src/services/__tests__/auraSkipService.test.ts
 *
 * Unit tests for Aura Flow Persistent Skip Learning (Phase 5.3).
 * Verifies:
 * 1. Single skip creates mild penalty.
 * 2. Repeated skips progressively increase penalty.
 * 3. Skip count is capped at 5.
 * 4. Recency decay makes recent skips stronger than old skips.
 * 5. Meaningful listen decrements skip count.
 * 6. Meaningful listen removes the record when count reaches zero.
 * 7. Completed listen completely removes the record.
 * 8. Favorite completely removes the record.
 * 9. LRU cap keeps only 300 records.
 * 10. Persistence round-trip save → hydrate works.
 * 11. Missing/malformed IndexedDB data falls back safely.
 * 12. Candidate scoring exposes breakdown.persistentSkipPenalty.
 * 13. Song-level skip learning does NOT penalize unrelated songs by the same artist.
 * 14. Old skips are softened by decay rather than permanently banning the song.
 * 15. Redemption works after a song was previously skipped repeatedly.
 * 16. Coexistence of Phase 5.2 affinity and Phase 5.3 skip penalty.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  auraSkipService,
  calculateSkipDecay,
  calculateSkipPenaltyMultiplier,
  PersistentSkipMap,
  MAX_PERSISTENT_SKIPS
} from '../auraSkipService';
import { auraFlowService, FlowContext, DEFAULT_FLOW_WEIGHTS } from '../auraFlowService';
import { musicDB, AURA_PERSISTENT_SKIPS_KEY } from '../db';
import { Song } from '../../types/music';
import { UserAffinityProfile, AURA_AFFINITY_VERSION } from '../auraAffinityService';

const mockSong = (overrides: Partial<Song> = {}): Song => ({
  id: 'song-test-1',
  title: 'Test Song',
  artist: 'Anirudh Ravichander',
  album: 'Test Album',
  genre: 'Soundtrack',
  duration: 200,
  path: '/path/test.mp3',
  filePath: '/path/test.mp3',
  fileName: 'test.mp3',
  format: 'mp3',
  fileSize: 1000,
  dateAdded: Date.now(),
  playCount: 5,
  isFavorite: false,
  isOnline: true,
  ...overrides
});

describe('Phase 5.3: Aura Flow Persistent Skip Learning', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    auraSkipService.setSkipMap({});
    auraFlowService.resetSession();
    auraFlowService.setWeights(DEFAULT_FLOW_WEIGHTS);
  });

  // 1. Single skip creates mild penalty
  it('1. Single skip creates mild penalty (0.4x multiplier)', () => {
    const now = Date.now();
    auraSkipService.recordSkip('song-1', 'Artist A', now);

    expect(calculateSkipPenaltyMultiplier(1)).toBe(0.4);
    // 35 base * 0.4 * 1.0 decay = 14
    const penalty = auraSkipService.getPenalty('song-1', 35, now);
    expect(penalty).toBe(14);
  });

  // 2. Repeated skips progressively increase penalty
  it('2. Repeated skips progressively increase penalty (1 -> 0.4x, 2 -> 0.7x, 3+ -> 1.0x)', () => {
    const now = Date.now();
    auraSkipService.recordSkip('song-1', 'Artist A', now);
    expect(auraSkipService.getPenalty('song-1', 35, now)).toBe(14); // 35 * 0.4 = 14

    auraSkipService.recordSkip('song-1', 'Artist A', now);
    expect(auraSkipService.getPenalty('song-1', 35, now)).toBe(25); // 35 * 0.7 = 24.5 -> 25

    auraSkipService.recordSkip('song-1', 'Artist A', now);
    expect(auraSkipService.getPenalty('song-1', 35, now)).toBe(35); // 35 * 1.0 = 35
  });

  // 3. Skip count is capped at 5
  it('3. Skip count is strictly capped at 5', () => {
    for (let i = 0; i < 10; i++) {
      auraSkipService.recordSkip('song-1', 'Artist A');
    }
    const map = auraSkipService.getSkipMap();
    expect(map['song-1'].count).toBe(5);
  });

  // 4. Recency decay makes recent skips stronger than old skips
  it('4. Recency decay makes recent skips stronger than older skips', () => {
    const now = Date.now();
    expect(calculateSkipDecay(now - 1000, now)).toBe(1.0); // <= 7d
    expect(calculateSkipDecay(now - 15 * 24 * 3600 * 1000, now)).toBe(0.6); // 8-30d
    expect(calculateSkipDecay(now - 45 * 24 * 3600 * 1000, now)).toBe(0.3); // 31-90d
    expect(calculateSkipDecay(now - 120 * 24 * 3600 * 1000, now)).toBe(0.1); // > 90d

    // 3 skips, base 35
    auraSkipService.setSkipMap({
      'recent-song': { count: 3, lastSkippedAt: now - 1000 },
      'mid-song': { count: 3, lastSkippedAt: now - 15 * 24 * 3600 * 1000 },
      'old-song': { count: 3, lastSkippedAt: now - 45 * 24 * 3600 * 1000 },
      'ancient-song': { count: 3, lastSkippedAt: now - 120 * 24 * 3600 * 1000 }
    });

    expect(auraSkipService.getPenalty('recent-song', 35, now)).toBe(35);
    expect(auraSkipService.getPenalty('mid-song', 35, now)).toBe(21); // 35 * 0.6 = 21
    expect(auraSkipService.getPenalty('old-song', 35, now)).toBe(11); // 35 * 0.3 = 10.5 -> 11
    expect(auraSkipService.getPenalty('ancient-song', 35, now)).toBe(4);  // 35 * 0.1 = 3.5 -> 4
  });

  // 5. Meaningful listen decrements skip count
  it('5. Meaningful listen decrements skip count when count > 1', () => {
    auraSkipService.setSkipMap({
      'song-1': { count: 3, lastSkippedAt: Date.now() }
    });

    auraSkipService.recordMeaningfulListen('song-1');
    expect(auraSkipService.getSkipMap()['song-1'].count).toBe(2);

    auraSkipService.recordMeaningfulListen('song-1');
    expect(auraSkipService.getSkipMap()['song-1'].count).toBe(1);
  });

  // 6. Meaningful listen removes the record when count reaches zero / <= 1
  it('6. Meaningful listen removes the record when count reaches 1 or 0', () => {
    auraSkipService.setSkipMap({
      'song-1': { count: 1, lastSkippedAt: Date.now() }
    });

    auraSkipService.recordMeaningfulListen('song-1');
    expect(auraSkipService.getSkipMap()['song-1']).toBeUndefined();
    expect(auraSkipService.getPenalty('song-1', 35)).toBe(0);
  });

  // 7. Completed listen completely removes the record
  it('7. Completed listen completely removes the persistent skip record', () => {
    auraSkipService.setSkipMap({
      'song-1': { count: 5, lastSkippedAt: Date.now() }
    });

    auraSkipService.recordCompletedListen('song-1');
    expect(auraSkipService.getSkipMap()['song-1']).toBeUndefined();
    expect(auraSkipService.getPenalty('song-1', 35)).toBe(0);
  });

  // 8. Favorite completely removes the record
  it('8. Favorite completely removes the persistent skip record', () => {
    auraSkipService.setSkipMap({
      'song-1': { count: 5, lastSkippedAt: Date.now() }
    });

    auraSkipService.recordFavorite('song-1');
    expect(auraSkipService.getSkipMap()['song-1']).toBeUndefined();
    expect(auraSkipService.getPenalty('song-1', 35)).toBe(0);
  });

  // 9. LRU cap keeps only 300 records
  it('9. LRU cap keeps only 300 newest records, purging oldest', () => {
    const map: PersistentSkipMap = {};
    const baseTime = 1000000;

    // Fill 300 entries
    for (let i = 1; i <= MAX_PERSISTENT_SKIPS; i++) {
      map[`song-${i}`] = { count: 1, lastSkippedAt: baseTime + i };
    }
    auraSkipService.setSkipMap(map);

    // Add 10 newer entries
    for (let i = MAX_PERSISTENT_SKIPS + 1; i <= MAX_PERSISTENT_SKIPS + 10; i++) {
      auraSkipService.recordSkip(`song-${i}`, 'Artist', baseTime + i);
    }

    const currentMap = auraSkipService.getSkipMap();
    expect(Object.keys(currentMap).length).toBe(MAX_PERSISTENT_SKIPS);

    // First 10 oldest should have been purged
    for (let i = 1; i <= 10; i++) {
      expect(currentMap[`song-${i}`]).toBeUndefined();
    }
    // Newest entries must exist
    expect(currentMap[`song-${MAX_PERSISTENT_SKIPS + 10}`]).toBeDefined();
  });

  // 10. Persistence round-trip save -> hydrate works
  it('10. Persistence round-trip save -> hydrate works', async () => {
    let persisted: any = null;
    vi.spyOn(musicDB, 'setSetting').mockImplementation(async (key, val) => {
      if (key === AURA_PERSISTENT_SKIPS_KEY) persisted = val;
    });
    vi.spyOn(musicDB, 'getSetting').mockImplementation(async (key, def) => {
      if (key === AURA_PERSISTENT_SKIPS_KEY) return persisted || def;
      return def;
    });

    auraSkipService.recordSkip('song-p1', 'Artist P');
    await auraSkipService.flush();

    expect(persisted).not.toBeNull();
    expect(persisted['song-p1'].count).toBe(1);

    // Reset memory and re-hydrate
    auraSkipService.setSkipMap({});
    expect(auraSkipService.getPenalty('song-p1', 35)).toBe(0);

    await auraSkipService.init();
    expect(auraSkipService.getPenalty('song-p1', 35)).toBeGreaterThan(0);
  });

  // 11. Missing/malformed IndexedDB data falls back safely
  it('11. Missing/malformed IndexedDB data falls back safely to empty map', async () => {
    vi.spyOn(musicDB, 'getSetting').mockResolvedValue('corrupted-non-object-data');
    const result = await auraSkipService.init();
    expect(result).toEqual({});
    expect(auraSkipService.getSkipMap()).toEqual({});
  });

  // 12. Candidate scoring exposes breakdown.persistentSkipPenalty
  it('12. Candidate scoring exposes breakdown.persistentSkipPenalty', () => {
    const current = mockSong({ id: 'curr', artist: 'Neutral', genre: 'Pop' });
    const candidateSkipped = mockSong({ id: 'c-skipped', artist: 'Neutral', genre: 'Pop' });
    const candidateClean = mockSong({ id: 'c-clean', artist: 'Neutral', genre: 'Pop' });

    auraSkipService.setSkipMap({
      'c-skipped': { count: 3, lastSkippedAt: Date.now() } // full penalty = 35
    });

    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, candidateSkipped, candidateClean],
      downloadedSongIds: new Set(),
      isOnline: true
    };

    const weights = { ...DEFAULT_FLOW_WEIGHTS, explorationJitter: 0 };
    const scoreSkipped = auraFlowService.scoreCandidate(candidateSkipped, current, context, weights);
    const scoreClean = auraFlowService.scoreCandidate(candidateClean, current, context, weights);

    expect(scoreSkipped.breakdown.persistentSkipPenalty).toBe(-35);
    expect(scoreClean.breakdown.persistentSkipPenalty).toBe(0);
    expect(scoreClean.totalScore - scoreSkipped.totalScore).toBe(35);
  });

  // 13. Song-level skip learning does NOT penalize unrelated songs by the same artist
  it('13. Song-level skip learning does NOT penalize unrelated songs by the same artist', () => {
    const current = mockSong({ id: 'curr', artist: 'Neutral', genre: 'Soundtrack' });
    const skippedSong = mockSong({ id: 's-hated', title: 'Hated Song', artist: 'Anirudh Ravichander' });
    const likedSong = mockSong({ id: 's-loved', title: 'Beloved Song', artist: 'Anirudh Ravichander' });

    auraSkipService.setSkipMap({
      's-hated': { count: 3, lastSkippedAt: Date.now(), artist: 'anirudh ravichander' }
    });

    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, skippedSong, likedSong],
      downloadedSongIds: new Set(),
      isOnline: true
    };

    const weights = { ...DEFAULT_FLOW_WEIGHTS, explorationJitter: 0 };
    const scoreHated = auraFlowService.scoreCandidate(skippedSong, current, context, weights);
    const scoreLoved = auraFlowService.scoreCandidate(likedSong, current, context, weights);

    expect(scoreHated.breakdown.persistentSkipPenalty).toBe(-35);
    expect(scoreLoved.breakdown.persistentSkipPenalty).toBe(0);
  });

  // 14. Old skips are softened by decay rather than permanently banning the song
  it('14. Old skips are softened by decay rather than permanently banning the song', () => {
    const now = Date.now();
    const current = mockSong({ id: 'curr', artist: 'Anirudh', genre: 'Soundtrack' });
    const oldSkipped = mockSong({ id: 's-old-skip', artist: 'Anirudh', genre: 'Soundtrack' });

    // Skipped 3 times 120 days ago -> decay is 0.1 -> penalty is 4
    auraSkipService.setSkipMap({
      's-old-skip': { count: 3, lastSkippedAt: now - 120 * 24 * 3600 * 1000 }
    });

    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, oldSkipped],
      downloadedSongIds: new Set(),
      isOnline: true
    };

    const weights = { ...DEFAULT_FLOW_WEIGHTS, explorationJitter: 0 };
    const score = auraFlowService.scoreCandidate(oldSkipped, current, context, weights);

    expect(score.breakdown.persistentSkipPenalty).toBe(-4);
    // Artist match (+30) easily overcomes decayed skip penalty (-4)
    expect(score.totalScore).toBeGreaterThan(50);
  });

  // 15. Redemption works after a song was previously skipped repeatedly
  it('15. Redemption restores a previously skipped song after user listens to completion', () => {
    const songId = 'redemption-song';
    // User repeatedly skipped it
    auraFlowService.recordSkip(songId, 'Artist');
    auraFlowService.recordSkip(songId, 'Artist');
    auraFlowService.recordSkip(songId, 'Artist');
    expect(auraSkipService.getPenalty(songId, 35)).toBe(35);

    // Later, user listens to completion
    auraFlowService.recordCompletedListen(songId);
    expect(auraSkipService.getPenalty(songId, 35)).toBe(0);
  });

  // 16. Coexistence of Phase 5.2 affinity and Phase 5.3 skip penalty
  it('16. Phase 5.2 affinity and Phase 5.3 skip penalty coexist additively without collision', () => {
    const current = mockSong({ id: 'curr', artist: 'Neutral', genre: 'Soundtrack' });
    const candidate = mockSong({ id: 'c-mixed', artist: 'Anirudh Ravichander', genre: 'Soundtrack' });

    // User has strong positive affinity for Anirudh (+15 artist, +5 favorite artist)
    const profile: UserAffinityProfile = {
      version: AURA_AFFINITY_VERSION,
      updatedAt: Date.now(),
      totalMeaningfulPlays: 100,
      artistAffinity: { 'anirudh ravichander': 100 },
      vibeAffinity: {},
      favoriteArtists: ['anirudh ravichander'],
      recentArtistCounts: {},
      recentVibeCounts: {}
    };

    // But this specific track was skipped twice (penalty: 35 * 0.7 = 25)
    auraSkipService.setSkipMap({
      'c-mixed': { count: 2, lastSkippedAt: Date.now() }
    });

    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, candidate],
      downloadedSongIds: new Set(),
      isOnline: true,
      affinityProfile: profile
    };

    const weights = { ...DEFAULT_FLOW_WEIGHTS, explorationJitter: 0 };
    const score = auraFlowService.scoreCandidate(candidate, current, context, weights);

    // Both signals are cleanly and additively present
    expect(score.breakdown.longTermArtistAffinity).toBe(15);
    expect(score.breakdown.favoriteArtistBonus).toBe(5);
    expect(score.breakdown.persistentSkipPenalty).toBe(-25);

    // Baseline 50 + genre 20 + vibe 10 + playCount 10 + affinity 20 - skip penalty 25 = 85
    // Neither signal overwrote or masked the other
    expect(score.totalScore).toBe(85);
  });
});
