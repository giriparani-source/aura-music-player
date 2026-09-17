/**
 * src/services/__tests__/auraFlowDiscoveryPacing.test.ts
 *
 * Comprehensive test suite for Aura Flow Phase 5.4:
 * Dynamic Discovery Pacing + Explainable Aura Reasons.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  auraFlowService,
  FlowContext,
  DEFAULT_FLOW_WEIGHTS,
  deriveAuraReason,
  getAuraReasonLabel
} from '../auraFlowService';
import { auraSkipService } from '../auraSkipService';
import { Song, AuraRecommendationReason } from '../../types/music';

const mockSong = (overrides: Partial<Song> = {}): Song => ({
  id: 'song-test-1',
  title: 'Test Song',
  artist: 'Test Artist',
  album: 'Test Album',
  genre: 'Soundtrack',
  duration: 240,
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

describe('Phase 5.4: Dynamic Discovery Pacing & Explainable Aura', () => {
  beforeEach(async () => {
    auraFlowService.resetSession();
    auraFlowService.setWeights(DEFAULT_FLOW_WEIGHTS);
    await auraSkipService.clear();
  });

  describe('1. Discovery Counter Lifecycle & State', () => {
    it('initializes at 0 and isDiscoveryWindowActive returns false', () => {
      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(0);
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);
    });

    it('increments counter when a familiar Aura track (playCount > 1) starts playing', () => {
      const familiarTrack = mockSong({ id: 'familiar-1', playCount: 5, isAuraFlow: true });
      auraFlowService.recordAuraTrackStart(familiarTrack);
      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(1);

      auraFlowService.recordAuraTrackStart(mockSong({ id: 'familiar-2', playCount: 3, isAuraFlow: true }));
      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(2);
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);
    });

    it('activates discovery window after exactly 3 consecutive familiar Aura tracks', () => {
      auraFlowService.recordAuraTrackStart(mockSong({ id: 'f-1', playCount: 2, isAuraFlow: true }));
      auraFlowService.recordAuraTrackStart(mockSong({ id: 'f-2', playCount: 10, isAuraFlow: true }));
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);

      auraFlowService.recordAuraTrackStart(mockSong({ id: 'f-3', playCount: 4, isAuraFlow: true }));
      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(3);
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);
    });

    it('resets counter to 0 when a Tier 1 discovery track (playCount === 0) actually starts', () => {
      auraFlowService.setConsecutiveFamiliarCount(4);
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);

      const discoveryTrack = mockSong({ id: 'discovery-1', playCount: 0, isAuraFlow: true });
      auraFlowService.recordAuraTrackStart(discoveryTrack);

      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(0);
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);
    });

    it('decrements counter when a Tier 2 lightly explored track (playCount === 1) starts', () => {
      auraFlowService.setConsecutiveFamiliarCount(3);
      const lightlyExplored = mockSong({ id: 'light-1', playCount: 1, isAuraFlow: true });
      auraFlowService.recordAuraTrackStart(lightlyExplored);

      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(2);
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);
    });

    it('resets counter on resetSession()', () => {
      auraFlowService.setConsecutiveFamiliarCount(5);
      auraFlowService.resetSession();
      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(0);
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);
    });
  });

  describe('2. Discovery Mode Candidate Scoring', () => {
    it('awards discoveryBonus to Tier 1 candidate (playCount === 0) when discovery window is active', () => {
      const current = mockSong({ id: 'current', title: 'Song Current', genre: 'Pop' });
      const tier1Candidate = mockSong({ id: 'tier-1', title: 'Unheard Song', genre: 'Pop', playCount: 0 });
      const context: FlowContext = {
        currentSong: current,
        queue: [current],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: [current, tier1Candidate],
        downloadedSongIds: new Set(),
        isOnline: true,
        isDiscoveryActive: true,
        weights: { explorationJitter: 0 }
      };

      const score = auraFlowService.scoreCandidate(tier1Candidate, current, context, DEFAULT_FLOW_WEIGHTS);
      expect(score.breakdown.discoveryBonus).toBe(DEFAULT_FLOW_WEIGHTS.discoveryBonus);
      expect(score.breakdown.discoveryBonus).toBe(20);
      // playCountDiscovery is also present (5 points)
      expect(score.breakdown.playCountDiscovery).toBe(5);
    });

    it('does NOT award discoveryBonus when discovery window is inactive', () => {
      const current = mockSong({ id: 'current', title: 'Song Current', genre: 'Pop' });
      const tier1Candidate = mockSong({ id: 'tier-1', title: 'Unheard Song', genre: 'Pop', playCount: 0 });
      const context: FlowContext = {
        currentSong: current,
        queue: [current],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: [current, tier1Candidate],
        downloadedSongIds: new Set(),
        isOnline: true,
        isDiscoveryActive: false,
        weights: { explorationJitter: 0 }
      };

      const score = auraFlowService.scoreCandidate(tier1Candidate, current, context, DEFAULT_FLOW_WEIGHTS);
      expect(score.breakdown.discoveryBonus).toBeUndefined();
      expect(score.breakdown.playCountDiscovery).toBe(5);
    });

    it('does NOT award discoveryBonus to familiar candidates (playCount > 0) even if discovery window is active', () => {
      const current = mockSong({ id: 'current', title: 'Song Current' });
      const familiarCandidate = mockSong({ id: 'familiar', playCount: 5 });
      const context: FlowContext = {
        currentSong: current,
        queue: [current],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: [current, familiarCandidate],
        downloadedSongIds: new Set(),
        isOnline: true,
        isDiscoveryActive: true,
        weights: { explorationJitter: 0 }
      };

      const score = auraFlowService.scoreCandidate(familiarCandidate, current, context, DEFAULT_FLOW_WEIGHTS);
      expect(score.breakdown.discoveryBonus).toBeUndefined();
    });
  });

  describe('3. Safety Gates & Skip Penalties during Discovery', () => {
    it('enforces hard exclusion gates even when discovery window is active', () => {
      const current = mockSong({ id: 'current', title: 'Current' });
      const queuedSong = mockSong({ id: 'queued', playCount: 0 });
      const recentSong = mockSong({ id: 'recent', playCount: 0 });
      const offlineUnplayable = mockSong({ id: 'offline-cloud', playCount: 0, isOnline: true, isDownloaded: false });

      const context: FlowContext = {
        currentSong: current,
        queue: [current, queuedSong],
        queueIndex: 0,
        playbackHistory: [recentSong.id],
        allSongs: [current, queuedSong, recentSong, offlineUnplayable],
        downloadedSongIds: new Set(),
        isOnline: false, // Offline mode
        isDiscoveryActive: true
      };

      const candidates = auraFlowService.generateCandidates(context);
      const ids = candidates.map((c) => c.id);

      expect(ids.includes(current.id)).toBe(false);
      expect(ids.includes(queuedSong.id)).toBe(false);
      expect(ids.includes(recentSong.id)).toBe(false);
      expect(ids.includes(offlineUnplayable.id)).toBe(false);
    });

    it('discovery bonus does NOT bypass or overpower persistent skip penalty (Phase 5.3)', () => {
      const current = mockSong({ id: 'current', title: 'Current', genre: 'Pop' });
      const skippedDiscoverySong = mockSong({ id: 'skipped-disc', genre: 'Pop', playCount: 0 });

      // Record 3 skips -> max multiplier (1.0)
      auraSkipService.recordSkip(skippedDiscoverySong.id, skippedDiscoverySong.artist);
      auraSkipService.recordSkip(skippedDiscoverySong.id, skippedDiscoverySong.artist);
      auraSkipService.recordSkip(skippedDiscoverySong.id, skippedDiscoverySong.artist);

      const context: FlowContext = {
        currentSong: current,
        queue: [current],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: [current, skippedDiscoverySong],
        downloadedSongIds: new Set(),
        isOnline: true,
        isDiscoveryActive: true,
        weights: { explorationJitter: 0 }
      };

      const score = auraFlowService.scoreCandidate(skippedDiscoverySong, current, context, DEFAULT_FLOW_WEIGHTS);

      // Discovery bonus (+20) is added
      expect(score.breakdown.discoveryBonus).toBe(20);
      // Persistent skip penalty (-35) is also strictly deducted!
      expect(score.breakdown.persistentSkipPenalty).toBe(-35);

      // Net impact of discovery + persistent skip is negative (-15)
      expect(score.breakdown.discoveryBonus + score.breakdown.persistentSkipPenalty).toBe(-15);
    });
  });

  describe('4. Truthful Recommendation Reason Derivation', () => {
    it('derives discovery_pick when discovery bonus contributed', () => {
      const breakdown = {
        base: 50,
        genreMatch: 20,
        discoveryBonus: 20,
        playCountDiscovery: 5
      };
      const reason = deriveAuraReason(breakdown, true);
      expect(reason).toBe('discovery_pick');
      expect(getAuraReasonLabel(reason)).toBe('Fresh Discovery');
    });

    it('derives favorite_artist when favorite artist bonus is present', () => {
      const breakdown = {
        base: 50,
        favoriteArtistBonus: 5,
        longTermArtistAffinity: 12
      };
      const reason = deriveAuraReason(breakdown, false);
      expect(reason).toBe('favorite_artist');
      expect(getAuraReasonLabel(reason)).toBe('Top Artist');
    });

    it('derives artist_continuity when artist match is >= 30', () => {
      const breakdown = {
        base: 50,
        artistMatch: 30,
        genreMatch: 20
      };
      const reason = deriveAuraReason(breakdown, false);
      expect(reason).toBe('artist_continuity');
      expect(getAuraReasonLabel(reason)).toBe('Artist Match');
    });

    it('derives vibe_continuity when vibe match is >= 18', () => {
      const breakdown = {
        base: 50,
        vibeMatch: 25,
        genreMatch: 20
      };
      const reason = deriveAuraReason(breakdown, false);
      expect(reason).toBe('vibe_continuity');
      expect(getAuraReasonLabel(reason)).toBe('Vibe Match');
    });

    it('derives affinity_match when longTermVibeAffinity or favorite is present', () => {
      const breakdown = {
        base: 50,
        longTermVibeAffinity: 8,
        instantPlayback: 10
      };
      const reason = deriveAuraReason(breakdown, false);
      expect(reason).toBe('affinity_match');
      expect(getAuraReasonLabel(reason)).toBe('Affinity Pick');
    });

    it('falls back to curated_pick when no strong primary reason dominated', () => {
      const breakdown = {
        base: 50,
        instantPlayback: 10
      };
      const reason = deriveAuraReason(breakdown, false);
      expect(reason).toBe('curated_pick');
      expect(getAuraReasonLabel(reason)).toBe('Curated Pick');
    });

    it('suppresses positive claims if candidate carries heavy persistent skip penalty', () => {
      const breakdown = {
        base: 50,
        artistMatch: 30,
        favoriteArtistBonus: 5,
        persistentSkipPenalty: -35
      };
      // Because penalty is >= 20, positive endorsements are suppressed
      const reason = deriveAuraReason(breakdown, false);
      expect(reason).toBe('curated_pick');
    });

    it('getAuraReasonLabel returns Aura Flow fallback for undefined or invalid input', () => {
      expect(getAuraReasonLabel(undefined)).toBe('Aura Flow');
      expect(getAuraReasonLabel('unknown_reason' as unknown as AuraRecommendationReason)).toBe('Aura Flow');
    });
  });

  describe('5. End-to-End getNextTrack Integration', () => {
    it('attaches truthful auraReason to the selected next track', () => {
      const current = mockSong({
        id: 'c1',
        title: 'Current Hit',
        artist: 'UniqueArtistX',
        genre: 'Dance',
        isOnline: false
      });
      const sameArtistCandidate = mockSong({
        id: 'c2',
        title: 'Next Hit',
        artist: 'UniqueArtistX',
        genre: 'Dance',
        playCount: 10,
        isOnline: false
      });

      const context: FlowContext = {
        currentSong: current,
        queue: [current],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: [current, sameArtistCandidate],
        downloadedSongIds: new Set(['c1', 'c2']),
        isOnline: false,
        weights: { explorationJitter: 0 }
      };

      const nextTrack = auraFlowService.getNextTrack(context);
      expect(nextTrack).not.toBeNull();
      expect(nextTrack?.id).toBe(sameArtistCandidate.id);
      expect(nextTrack?.auraReason).toBe('artist_continuity');
    });

    it('selects discovery track and assigns discovery_pick when discovery window is active', () => {
      auraFlowService.setConsecutiveFamiliarCount(3);
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);

      const current = mockSong({ id: 'c1', title: 'Current Song', artist: 'Artist A', genre: 'Rock', isOnline: false });
      // Unheard candidate from same genre
      const discoveryCandidate = mockSong({
        id: 'disc-1',
        title: 'New Gem',
        artist: 'Unknown Artist',
        genre: 'Rock',
        playCount: 0,
        isOnline: false
      });

      const context: FlowContext = {
        currentSong: current,
        queue: [current],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: [current, discoveryCandidate],
        downloadedSongIds: new Set(['c1', 'disc-1']),
        isOnline: false,
        weights: { explorationJitter: 0 }
      };

      const nextTrack = auraFlowService.getNextTrack(context);
      expect(nextTrack).not.toBeNull();
      expect(nextTrack?.id).toBe(discoveryCandidate.id);
      expect(nextTrack?.auraReason).toBe('discovery_pick');

      // Crucial: The discovery window was CONSUMED!
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);
      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(0);
    });

    it('consumes discovery window in a single recommendation cycle even if familiar track wins', () => {
      auraFlowService.setConsecutiveFamiliarCount(3);
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);

      const current = mockSong({ id: 'c1', title: 'Current Song', artist: 'Artist A', genre: 'Rock', isOnline: false });
      const familiarCandidate = mockSong({
        id: 'fam-1',
        title: 'Familiar Gem',
        artist: 'Artist A',
        genre: 'Rock',
        playCount: 10,
        isOnline: false
      });

      const context: FlowContext = {
        currentSong: current,
        queue: [current],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: [current, familiarCandidate],
        downloadedSongIds: new Set(['c1', 'fam-1']),
        isOnline: false,
        weights: { explorationJitter: 0 }
      };

      // Even though familiar won, the discovery opportunity was consumed for this cycle
      const nextTrack = auraFlowService.getNextTrack(context);
      expect(nextTrack).not.toBeNull();
      expect(nextTrack?.id).toBe(familiarCandidate.id);

      // Window is consumed
      expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);
      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(0);
    });

    it('queued tracks do NOT increment familiar counter until recordAuraTrackStart is called', () => {
      // Pacing counter is 0
      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(0);

      // Generating candidates / recommending next track does NOT increment the counter
      const current = mockSong({ id: 'c1', title: 'Current Song', isOnline: false });
      const candidate = mockSong({ id: 'c2', playCount: 5, isOnline: false });
      const context: FlowContext = {
        currentSong: current,
        queue: [current],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: [current, candidate],
        downloadedSongIds: new Set(['c1', 'c2']),
        isOnline: false
      };

      const track = auraFlowService.getNextTrack(context);
      expect(track).not.toBeNull();
      // Counter is STILL 0 because track was only selected/queued, NOT played
      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(0);

      // Only when track actually begins playing in player:
      auraFlowService.recordAuraTrackStart(track!);
      expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(1);
    });
  });
});
