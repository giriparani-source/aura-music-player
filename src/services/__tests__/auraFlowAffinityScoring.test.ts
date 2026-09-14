/**
 * src/services/__tests__/auraFlowAffinityScoring.test.ts
 *
 * Unit tests for Aura Flow Long-Term User Affinity Candidate Scoring (Phase 5.2).
 * Verifies that:
 * 1. Scoring behaves neutrally without profile (Phase 4 backward compatibility).
 * 2. High artist affinity increases score proportionally.
 * 3. High vibe affinity increases score proportionally.
 * 4. Top favorite artists receive endorsement bonuses.
 * 5. Session continuity dominates over lifetime favorite artists (no mood hijacking).
 * 6. Score breakdowns transparently report affinity factors.
 * 7. Custom weight overrides dynamically tune affinity impact.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auraFlowService, FlowContext, DEFAULT_FLOW_WEIGHTS } from '../auraFlowService';
import { UserAffinityProfile, AURA_AFFINITY_VERSION } from '../auraAffinityService';
import { Song } from '../../types/music';

const mockSong = (overrides: Partial<Song> = {}): Song => ({
  id: 'song-test',
  title: 'Test Song',
  artist: 'Test Artist',
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

const mockAffinityProfile = (overrides: Partial<UserAffinityProfile> = {}): UserAffinityProfile => ({
  version: AURA_AFFINITY_VERSION,
  updatedAt: Date.now(),
  totalMeaningfulPlays: 100,
  artistAffinity: {
    'anirudh ravichander': 100,
    'yuvan shankar raja': 60,
    'ar rahman': 40
  },
  vibeAffinity: {
    'high-energy': 100,
    romantic: 70,
    'melodic-chill': 20
  },
  favoriteArtists: ['anirudh ravichander', 'yuvan shankar raja'],
  recentArtistCounts: { 'anirudh ravichander': 10 },
  recentVibeCounts: { 'high-energy': 8 },
  ...overrides
});

describe('Phase 5.2: Aura Flow Candidate Scoring Integration', () => {
  beforeEach(() => {
    auraFlowService.resetSession();
    auraFlowService.setWeights(DEFAULT_FLOW_WEIGHTS);
  });

  it('1. Neutral baseline: Null or missing affinity profile produces 0 affinity bonus (Phase 4 parity)', () => {
    const current = mockSong({ id: 'curr', artist: 'Harris Jayaraj', genre: 'Soundtrack' });
    const candidate = mockSong({ id: 'c1', artist: 'Harris Jayaraj', genre: 'Soundtrack' });

    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, candidate],
      downloadedSongIds: new Set(),
      isOnline: true,
      weights: { explorationJitter: 0 },
      affinityProfile: null
    };

    const scored = auraFlowService.scoreCandidate(candidate, current, context, {
      ...DEFAULT_FLOW_WEIGHTS,
      explorationJitter: 0
    });

    expect(scored.breakdown.longTermArtistAffinity).toBeUndefined();
    expect(scored.breakdown.longTermVibeAffinity).toBeUndefined();
    expect(scored.breakdown.favoriteArtistBonus).toBeUndefined();
    expect(scored.totalScore).toBeGreaterThan(0);
  });

  it('2. Long-term artist affinity bonus scales proportionally to normalized score', () => {
    const current = mockSong({ id: 'curr', artist: 'Independent Artist', genre: 'Pop' });
    const candidateAnirudh = mockSong({
      id: 'c-anirudh',
      artist: 'Anirudh Ravichander',
      genre: 'Pop'
    });
    const candidateYuvan = mockSong({
      id: 'c-yuvan',
      artist: 'Yuvan Shankar Raja',
      genre: 'Pop'
    });
    const candidateUnknown = mockSong({
      id: 'c-unknown',
      artist: 'Unknown Singer',
      genre: 'Pop'
    });

    const profile = mockAffinityProfile({
      favoriteArtists: [], // Remove favorite artist bonus to test pure artist affinity
      vibeAffinity: {}     // Remove vibe affinity
    });

    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, candidateAnirudh, candidateYuvan, candidateUnknown],
      downloadedSongIds: new Set(),
      isOnline: true,
      affinityProfile: profile
    };

    const weights = { ...DEFAULT_FLOW_WEIGHTS, explorationJitter: 0 };

    const scoreAnirudh = auraFlowService.scoreCandidate(candidateAnirudh, current, context, weights);
    const scoreYuvan = auraFlowService.scoreCandidate(candidateYuvan, current, context, weights);
    const scoreUnknown = auraFlowService.scoreCandidate(candidateUnknown, current, context, weights);

    // Anirudh has 100 affinity -> Math.round(100/100 * 15) = 15
    expect(scoreAnirudh.breakdown.longTermArtistAffinity).toBe(15);
    // Yuvan has 60 affinity -> Math.round(60/100 * 15) = 9
    expect(scoreYuvan.breakdown.longTermArtistAffinity).toBe(9);
    // Unknown has 0 affinity -> undefined / 0
    expect(scoreUnknown.breakdown.longTermArtistAffinity).toBeUndefined();

    expect(scoreAnirudh.totalScore - scoreUnknown.totalScore).toBe(15);
    expect(scoreYuvan.totalScore - scoreUnknown.totalScore).toBe(9);
  });

  it('3. Long-term vibe affinity bonus scales proportionally to profile vibe scores', () => {
    const current = mockSong({ id: 'curr', artist: 'Neutral', genre: 'Rock' });
    // An energetic rock song
    const candidateEnergetic = mockSong({
      id: 'c-energetic',
      title: 'Badass Theme Fast Beat',
      artist: 'Neutral Artist',
      genre: 'Rock'
    });

    const profile = mockAffinityProfile({
      artistAffinity: {},
      favoriteArtists: [],
      vibeAffinity: { 'high-energy': 100 }
    });

    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, candidateEnergetic],
      downloadedSongIds: new Set(),
      isOnline: true,
      affinityProfile: profile
    };

    const weights = { ...DEFAULT_FLOW_WEIGHTS, explorationJitter: 0 };
    const score = auraFlowService.scoreCandidate(candidateEnergetic, current, context, weights);

    // Vibe affinity is 100 -> Math.round(100/100 * 10) = 10
    expect(score.breakdown.longTermVibeAffinity).toBe(10);
  });

  it('4. Favorite artist endorsement applies favoriteArtistBonus', () => {
    const current = mockSong({ id: 'curr', artist: 'Neutral', genre: 'Pop' });
    const candidateFav = mockSong({ id: 'c-fav', artist: 'Anirudh Ravichander', genre: 'Pop' });
    const candidateNonFav = mockSong({ id: 'c-nonfav', artist: 'A.R. Rahman', genre: 'Pop' });

    const profile = mockAffinityProfile({
      artistAffinity: { 'anirudh ravichander': 50, 'ar rahman': 50 },
      favoriteArtists: ['anirudh ravichander'], // Only Anirudh in favorite artists
      vibeAffinity: {}
    });

    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, candidateFav, candidateNonFav],
      downloadedSongIds: new Set(),
      isOnline: true,
      affinityProfile: profile
    };

    const weights = { ...DEFAULT_FLOW_WEIGHTS, explorationJitter: 0 };
    const scoreFav = auraFlowService.scoreCandidate(candidateFav, current, context, weights);
    const scoreNonFav = auraFlowService.scoreCandidate(candidateNonFav, current, context, weights);

    expect(scoreFav.breakdown.favoriteArtistBonus).toBe(5);
    expect(scoreNonFav.breakdown.favoriteArtistBonus).toBeUndefined();
    expect(scoreFav.totalScore - scoreNonFav.totalScore).toBe(5);
  });

  it('5. Session continuity dominates over lifetime affinity (No mood hijacking)', () => {
    // Current song: Acoustic, romantic ballad by Pradeep Kumar
    const current = mockSong({
      id: 'curr-acoustic',
      title: 'Aagayam Theepiditha',
      artist: 'Pradeep Kumar',
      album: 'Madras',
      genre: 'Acoustic / Romantic'
    });

    // Candidate A: Highly matching acoustic ballad by Pradeep Kumar (artist + genre match + vibe similarity)
    const matchingCandidate = mockSong({
      id: 'c-matching',
      title: 'Maya Nadhi',
      artist: 'Pradeep Kumar',
      album: 'Kabali',
      genre: 'Acoustic / Romantic',
      isDownloaded: true
    });

    // Candidate B: Fast dance track by lifetime favorite artist Anirudh Ravichander
    const favoriteArtistCandidate = mockSong({
      id: 'c-fav-artist',
      title: 'Hukum - Thalaivar Alappara Fast Dance Beat',
      artist: 'Anirudh Ravichander',
      album: 'Jailer',
      genre: 'Dance / EDM',
      isDownloaded: true
    });

    // User has high lifetime affinity for Anirudh, and none recorded yet for Pradeep Kumar
    const profile = mockAffinityProfile({
      artistAffinity: { 'anirudh ravichander': 100 },
      favoriteArtists: ['anirudh ravichander'],
      vibeAffinity: { energetic: 100, romantic: 0 }
    });

    const weights = { ...DEFAULT_FLOW_WEIGHTS, explorationJitter: 0 };
    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, matchingCandidate, favoriteArtistCandidate],
      downloadedSongIds: new Set(),
      isOnline: false,
      affinityProfile: profile,
      weights
    };

    const scoreMatching = auraFlowService.scoreCandidate(matchingCandidate, current, context, weights);
    const scoreFavArtist = auraFlowService.scoreCandidate(favoriteArtistCandidate, current, context, weights);

    // Matching candidate receives session continuity bonuses (artistMatch 30 + genreMatch 20 + high vibe match)
    expect(scoreMatching.breakdown.artistMatch).toBe(30);
    expect(scoreMatching.breakdown.genreMatch).toBe(20);

    // Favorite artist candidate receives affinity bonuses (+15 artist + 5 fav artist = +20)
    expect(scoreFavArtist.breakdown.longTermArtistAffinity).toBe(15);
    expect(scoreFavArtist.breakdown.favoriteArtistBonus).toBe(5);

    // The contextually matching candidate must strongly beat the unrelated lifetime favorite
    expect(scoreMatching.totalScore).toBeGreaterThan(scoreFavArtist.totalScore);

    // Selection chooses the matching track
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const selected = auraFlowService.getNextTrack(context);
    expect(selected?.id).toBe(matchingCandidate.id);
    randomSpy.mockRestore();
  });

  it('6. Custom weights dynamically tune long-term affinity bonuses', () => {
    const current = mockSong({ id: 'curr', artist: 'Neutral', genre: 'Soundtrack' });
    const candidate = mockSong({ id: 'c1', artist: 'Anirudh Ravichander', genre: 'Soundtrack' });

    const profile = mockAffinityProfile({
      artistAffinity: { 'anirudh ravichander': 100 },
      favoriteArtists: ['anirudh ravichander'],
      vibeAffinity: {}
    });

    const context: FlowContext = {
      currentSong: current,
      queue: [current],
      queueIndex: 0,
      playbackHistory: [],
      allSongs: [current, candidate],
      downloadedSongIds: new Set(),
      isOnline: true,
      affinityProfile: profile,
      weights: {
        longTermArtistAffinity: 30, // Custom boosted weight
        favoriteArtistBonus: 10,
        explorationJitter: 0
      }
    };

    const weights = { ...DEFAULT_FLOW_WEIGHTS, ...context.weights };
    const score = auraFlowService.scoreCandidate(candidate, current, context, weights);

    expect(score.breakdown.longTermArtistAffinity).toBe(30);
    expect(score.breakdown.favoriteArtistBonus).toBe(10);
  });
});
