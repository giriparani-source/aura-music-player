/**
 * src/services/__tests__/auraFlowUserControls.test.ts
 *
 * Comprehensive test suite for Aura Flow Phase 5.5:
 * User Controls & Preference Transparency UI.
 *
 * Validates:
 * - Discovery preferences (Comfort=5, Balanced=3, Adventurous=1)
 * - Dynamic threshold switching and IndexedDB settings persistence
 * - Preservation of discovery bonus (playCount === 0 only) and hard exclusion gates
 * - Full non-destructive memory reset orchestration
 * - Profile explainer formatting, top taste extraction, human-readable summary,
 *   and truthful Aura reason explanations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  auraFlowService,
  FlowContext,
  DEFAULT_FLOW_WEIGHTS,
  DiscoveryPreference,
  DISCOVERY_THRESHOLDS
} from '../auraFlowService';
import { auraSkipService } from '../auraSkipService';
import { auraAffinityService, UserAffinityProfile } from '../auraAffinityService';
import {
  musicDB,
  AURA_DISCOVERY_PREFERENCE_KEY
} from '../db';
import {
  formatArtistDisplayName,
  getVibeFriendlyLabel,
  getTopArtists,
  getTopVibes,
  generateProfileSummary,
  getAuraReasonExplanation,
  AURA_REASON_EXPLANATIONS
} from '../auraProfileExplainer';
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

describe('Phase 5.5: User Controls & Preference Transparency UI', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    auraFlowService.resetSession();
    auraFlowService.setWeights(DEFAULT_FLOW_WEIGHTS);
    auraFlowService.setDiscoveryPreferenceInMemory('balanced');
    vi.spyOn(musicDB, 'getSetting').mockResolvedValue(null);
    vi.spyOn(musicDB, 'setSetting').mockResolvedValue(undefined);
    vi.spyOn(musicDB, 'deleteSetting').mockResolvedValue(undefined);
    await auraSkipService.clear();
  });

  // =========================================================================
  // 1. DISCOVERY PREFERENCES & PACING
  // =========================================================================

  it('1. default preference is balanced', () => {
    expect(auraFlowService.getDiscoveryPreference()).toBe('balanced');
    expect(DISCOVERY_THRESHOLDS.balanced).toBe(3);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);
  });

  it('2. comfort requires 5 familiar tracks', async () => {
    await auraFlowService.setDiscoveryPreference('comfort');
    expect(auraFlowService.getDiscoveryPreference()).toBe('comfort');
    expect(DISCOVERY_THRESHOLDS.comfort).toBe(5);

    auraFlowService.setConsecutiveFamiliarCount(4);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);

    auraFlowService.setConsecutiveFamiliarCount(5);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);

    auraFlowService.setConsecutiveFamiliarCount(6);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);
  });

  it('3. balanced requires 3 familiar tracks', async () => {
    await auraFlowService.setDiscoveryPreference('balanced');
    expect(auraFlowService.getDiscoveryPreference()).toBe('balanced');
    expect(DISCOVERY_THRESHOLDS.balanced).toBe(3);

    auraFlowService.setConsecutiveFamiliarCount(2);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);

    auraFlowService.setConsecutiveFamiliarCount(3);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);

    auraFlowService.setConsecutiveFamiliarCount(4);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);
  });

  it('4. adventurous requires 1 familiar track', async () => {
    await auraFlowService.setDiscoveryPreference('adventurous');
    expect(auraFlowService.getDiscoveryPreference()).toBe('adventurous');
    expect(DISCOVERY_THRESHOLDS.adventurous).toBe(1);

    auraFlowService.setConsecutiveFamiliarCount(0);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);

    auraFlowService.setConsecutiveFamiliarCount(1);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);

    auraFlowService.setConsecutiveFamiliarCount(2);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);
  });

  it('5. switching preference dynamically changes the threshold', async () => {
    auraFlowService.setConsecutiveFamiliarCount(2);

    await auraFlowService.setDiscoveryPreference('comfort');
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(false); // 2 < 5

    await auraFlowService.setDiscoveryPreference('balanced');
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(false); // 2 < 3

    await auraFlowService.setDiscoveryPreference('adventurous');
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(true); // 2 >= 1
  });

  it('6. preference persists through the settings abstraction', async () => {
    const setSpy = vi.spyOn(musicDB, 'setSetting').mockResolvedValue(undefined);
    await auraFlowService.setDiscoveryPreference('comfort');

    expect(setSpy).toHaveBeenCalledWith(AURA_DISCOVERY_PREFERENCE_KEY, 'comfort');

    vi.spyOn(musicDB, 'getSetting').mockResolvedValueOnce('comfort');
    const loaded = await auraFlowService.initDiscoveryPreference();
    expect(loaded).toBe('comfort');
    expect(auraFlowService.getDiscoveryPreference()).toBe('comfort');
  });

  it('7. discovery bonus remains limited to playCount === 0', () => {
    const unplayedTrack = mockSong({ id: 'unplayed-1', playCount: 0 });
    const lightlyPlayedTrack = mockSong({ id: 'played-1', playCount: 1 });
    const current = mockSong({ id: 'current-1', playCount: 5 });

    const context: FlowContext = {
      currentSong: current,
      queue: [],
      queueIndex: -1,
      playbackHistory: [current.id],
      allSongs: [current, unplayedTrack, lightlyPlayedTrack],
      downloadedSongIds: new Set(),
      isOnline: true,
      isDiscoveryActive: true
    };

    const scoreUnplayed = auraFlowService.scoreCandidate(unplayedTrack, current, context, DEFAULT_FLOW_WEIGHTS);
    const scorePlayed = auraFlowService.scoreCandidate(lightlyPlayedTrack, current, context, DEFAULT_FLOW_WEIGHTS);

    expect(scoreUnplayed.breakdown.discoveryBonus).toBe(20);
    expect(scorePlayed.breakdown.discoveryBonus).toBeUndefined();
  });

  it('8. hard exclusion gates remain active for all preferences', async () => {
    for (const pref of ['comfort', 'balanced', 'adventurous'] as DiscoveryPreference[]) {
      await auraFlowService.setDiscoveryPreference(pref);

      const current = mockSong({ id: 'cur-1' });
      const inQueue = mockSong({ id: 'queue-1' });
      const inHistory = mockSong({ id: 'hist-1' });
      const offlineUndownloaded = mockSong({ id: 'online-undownloaded', isOnline: true, isDownloaded: false });
      const validLocal = mockSong({ id: 'valid-1', title: 'Valid Track', isOnline: false, path: '/local/song.mp3' });

      const context: FlowContext = {
        currentSong: current,
        queue: [inQueue],
        queueIndex: -1,
        playbackHistory: [inHistory.id],
        allSongs: [current, inQueue, inHistory, offlineUndownloaded, validLocal],
        downloadedSongIds: new Set(),
        isOnline: false // offline mode to test offline unplayable gate
      };

      const candidates = auraFlowService.generateCandidates(context);
      const candidateIds = candidates.map((c) => c.id);

      expect(candidateIds).not.toContain('cur-1'); // Gate 1: current song excluded
      expect(candidateIds).not.toContain('queue-1'); // Gate 2: upcoming queue excluded
      expect(candidateIds).not.toContain('hist-1'); // Gate 3: recent history excluded
      expect(candidateIds).not.toContain('online-undownloaded'); // Gate 4: unplayable offline excluded
      expect(candidateIds).toContain('valid-1'); // Valid local track included
    }
  });

  it('9. one-recommendation discovery consumption remains intact', async () => {
    await auraFlowService.setDiscoveryPreference('adventurous'); // threshold = 1
    auraFlowService.setConsecutiveFamiliarCount(1);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(true);

    const current = mockSong({ id: 'cur-track', playCount: 5 });
    const discoveryCandidate = mockSong({ id: 'disc-1', playCount: 0 });

    const context: FlowContext = {
      currentSong: current,
      queue: [],
      queueIndex: -1,
      playbackHistory: [current.id],
      allSongs: [current, discoveryCandidate],
      downloadedSongIds: new Set(),
      isOnline: true
    };

    const next = auraFlowService.getNextTrack(context);
    expect(next).not.toBeNull();
    // One discovery track consumed -> counter resets to 0
    expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(0);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);
  });

  // =========================================================================
  // 2. RESET AURA MEMORY ORCHESTRATION
  // =========================================================================

  it('10. reset clears affinity profile', async () => {
    const profileSpy = vi.spyOn(auraAffinityService, 'clearProfile').mockResolvedValue(undefined);
    await auraFlowService.resetAuraMemory();
    expect(profileSpy).toHaveBeenCalledTimes(1);
  });

  it('11. reset clears persistent skip map', async () => {
    const skipSpy = vi.spyOn(auraSkipService, 'clear').mockResolvedValue(undefined);
    await auraFlowService.resetAuraMemory();
    expect(skipSpy).toHaveBeenCalledTimes(1);
  });

  it('12. reset clears session Aura state', async () => {
    auraFlowService.setConsecutiveFamiliarCount(4);
    auraFlowService.recordSkip('song-x');
    await auraFlowService.resetAuraMemory();

    expect(auraFlowService.getConsecutiveFamiliarCount()).toBe(0);
    expect(auraFlowService.isDiscoveryWindowActive()).toBe(false);
  });

  it('13. reset returns discovery preference to balanced', async () => {
    await auraFlowService.setDiscoveryPreference('adventurous');
    expect(auraFlowService.getDiscoveryPreference()).toBe('adventurous');

    await auraFlowService.resetAuraMemory();
    expect(auraFlowService.getDiscoveryPreference()).toBe('balanced');
  });

  it('14. unrelated library data is not deleted', async () => {
    const deleteSongSpy = vi.spyOn(musicDB, 'deleteSong');
    const deletePlaylistSpy = vi.spyOn(musicDB, 'deletePlaylist');
    const saveSongSpy = vi.spyOn(musicDB, 'saveSong');

    await auraFlowService.resetAuraMemory();

    expect(deleteSongSpy).not.toHaveBeenCalled();
    expect(deletePlaylistSpy).not.toHaveBeenCalled();
    expect(saveSongSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // 3. PROFILE & EXPLAINER FORMATTING
  // =========================================================================

  it('15. empty profile renders/generates a valid empty state', () => {
    expect(generateProfileSummary(null)).toBe(
      'Aura is still learning your taste. Listen to more tracks to activate deep personalization.'
    );

    const emptyProfile: UserAffinityProfile = {
      version: 1,
      updatedAt: Date.now(),
      totalMeaningfulPlays: 0,
      artistAffinity: {},
      vibeAffinity: {},
      favoriteArtists: [],
      recentArtistCounts: {},
      recentVibeCounts: {}
    };

    expect(generateProfileSummary(emptyProfile)).toBe(
      'Aura is still learning your taste. Listen to more tracks to activate deep personalization.'
    );
    expect(getTopArtists(emptyProfile)).toEqual([]);
    expect(getTopVibes(emptyProfile)).toEqual([]);
  });

  it('16. real artist affinity is formatted correctly', () => {
    expect(formatArtistDisplayName('anirudh ravichander')).toBe('Anirudh Ravichander');
    expect(formatArtistDisplayName('a.r. rahman')).toBe('A.R. Rahman');
    expect(formatArtistDisplayName('yuvan shankar raja')).toBe('Yuvan Shankar Raja');
    expect(formatArtistDisplayName('harris jayaraj')).toBe('Harris Jayaraj');

    const profile: UserAffinityProfile = {
      version: 1,
      updatedAt: Date.now(),
      totalMeaningfulPlays: 10,
      artistAffinity: { 'anirudh ravichander': 90, 'a.r. rahman': 80 },
      vibeAffinity: {},
      favoriteArtists: ['anirudh ravichander'],
      recentArtistCounts: {},
      recentVibeCounts: {}
    };

    const top = getTopArtists(profile);
    expect(top).toHaveLength(2);
    expect(top[0]).toEqual({
      artist: 'anirudh ravichander',
      displayName: 'Anirudh Ravichander',
      score: 90
    });
    expect(top[1]).toEqual({
      artist: 'a.r. rahman',
      displayName: 'A.R. Rahman',
      score: 80
    });
  });

  it('17. real vibe affinity is formatted correctly', () => {
    expect(getVibeFriendlyLabel('high-energy')).toBe('High Energy');
    expect(getVibeFriendlyLabel('party')).toBe('Party & Dance');
    expect(getVibeFriendlyLabel('melodic-chill')).toBe('Melodic & Chill');
    expect(getVibeFriendlyLabel('romantic')).toBe('Romantic');
    expect(getVibeFriendlyLabel('sad-soulful')).toBe('Soulful & Nostalgic');

    const profile: UserAffinityProfile = {
      version: 1,
      updatedAt: Date.now(),
      totalMeaningfulPlays: 10,
      artistAffinity: {},
      vibeAffinity: { 'high-energy': 85, 'melodic-chill': 60 },
      favoriteArtists: [],
      recentArtistCounts: {},
      recentVibeCounts: {}
    };

    const top = getTopVibes(profile);
    expect(top).toHaveLength(2);
    expect(top[0]).toEqual({
      vibe: 'high-energy',
      displayName: 'High Energy',
      score: 85
    });
    expect(top[1]).toEqual({
      vibe: 'melodic-chill',
      displayName: 'Melodic & Chill',
      score: 60
    });
  });

  it('18. summary uses actual profile data', () => {
    const profile: UserAffinityProfile = {
      version: 1,
      updatedAt: Date.now(),
      totalMeaningfulPlays: 15,
      artistAffinity: { 'anirudh ravichander': 90 },
      vibeAffinity: { 'high-energy': 85 },
      favoriteArtists: ['anirudh ravichander'],
      recentArtistCounts: {},
      recentVibeCounts: {}
    };

    const summary = generateProfileSummary(profile);
    expect(summary).toContain('15 meaningful plays');
    expect(summary).toContain('Anirudh Ravichander');
    expect(summary).toContain('High Energy');
  });

  it('19. Aura reason explanations map correctly to the six existing reasons', () => {
    const reasons: AuraRecommendationReason[] = [
      'discovery_pick',
      'favorite_artist',
      'artist_continuity',
      'vibe_continuity',
      'affinity_match',
      'curated_pick'
    ];

    for (const r of reasons) {
      const explanation = getAuraReasonExplanation(r);
      expect(explanation).toBeTruthy();
      expect(explanation).toBe(AURA_REASON_EXPLANATIONS[r]);
    }

    expect(getAuraReasonExplanation('discovery_pick')).toBe(
      'Picked as a fresh discovery after familiar listening.'
    );
    expect(getAuraReasonExplanation('favorite_artist')).toBe(
      'Picked because this artist matches your long-term listening preferences.'
    );
    expect(getAuraReasonExplanation('artist_continuity')).toBe(
      "Picked because it connects with the artist or collaborator you're listening to."
    );
    expect(getAuraReasonExplanation('vibe_continuity')).toBe(
      'Picked because its vibe matches the current track.'
    );
    expect(getAuraReasonExplanation('affinity_match')).toBe(
      'Picked because it matches patterns Aura has learned from your listening.'
    );
    expect(getAuraReasonExplanation('curated_pick')).toBe(
      'Picked as a curated option for a smooth continuation.'
    );
    expect(getAuraReasonExplanation(undefined)).toBe(
      'Picked by Aura Flow for seamless listening.'
    );
  });
});
