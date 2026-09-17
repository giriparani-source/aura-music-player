/**
 * src/services/auraFlowService.ts
 *
 * Aura Flow: Infinite AI Smart Autoplay Engine for Aura Music Player.
 *
 * Recommends and sequences the next track using a multi-factor scoring model
 * that balances continuity, user feedback, availability, and anti-clustering diversity.
 */

import { Song, AuraRecommendationReason } from '../types/music';
import {
  inferSongVibe,
  calculateVibeSimilarity,
  normalizeArtistName,
  extractArtistPool
} from './flowKnowledgeBase';
import { TOP_50_TRACKS } from './inbuiltPlaylistsService';
import { UserAffinityProfile, auraAffinityService } from './auraAffinityService';
import { auraSkipService } from './auraSkipService';
import { musicDB, AURA_DISCOVERY_PREFERENCE_KEY } from './db';

export type DiscoveryPreference = 'comfort' | 'balanced' | 'adventurous';

export const DISCOVERY_THRESHOLDS: Record<DiscoveryPreference, number> = {
  comfort: 5,
  balanced: 3,
  adventurous: 1
};

export type { UserAffinityProfile, AuraRecommendationReason };

export const AURA_REASON_LABELS: Record<AuraRecommendationReason, string> = {
  discovery_pick: 'Fresh Discovery',
  favorite_artist: 'Top Artist',
  artist_continuity: 'Artist Match',
  vibe_continuity: 'Vibe Match',
  affinity_match: 'Affinity Pick',
  curated_pick: 'Curated Pick'
};

export function getAuraReasonLabel(reason?: AuraRecommendationReason): string {
  if (!reason) return 'Aura Flow';
  return AURA_REASON_LABELS[reason] || 'Aura Flow';
}

/**
 * Derives a truthful recommendation explanation based on the winning candidate's actual score breakdown.
 * Follows strict deterministic priority and suppresses positive personalization claims if the track carries
 * a heavy persistent skip penalty.
 */
export function deriveAuraReason(
  breakdown: Record<string, number>,
  isDiscoveryActive: boolean = false
): AuraRecommendationReason {
  const hasStrongSkipPenalty =
    breakdown.persistentSkipPenalty !== undefined &&
    Math.abs(breakdown.persistentSkipPenalty) >= 20;

  // 1. Discovery Pick: Eligible Tier 1 track boosted during active discovery window
  if (
    (breakdown.discoveryBonus !== undefined && breakdown.discoveryBonus > 0) ||
    (isDiscoveryActive && breakdown.playCountDiscovery !== undefined && breakdown.playCountDiscovery > 0)
  ) {
    return 'discovery_pick';
  }

  if (!hasStrongSkipPenalty) {
    // 2. Favorite Artist: User's top favorite/affinity artist
    if (
      (breakdown.favoriteArtistBonus !== undefined && breakdown.favoriteArtistBonus > 0) ||
      (breakdown.longTermArtistAffinity !== undefined && breakdown.longTermArtistAffinity >= 10)
    ) {
      return 'favorite_artist';
    }

    // 3. Artist Continuity: Direct artist match or collaboration with current song's artist
    if (
      (breakdown.artistMatch !== undefined && breakdown.artistMatch >= 30) ||
      (breakdown.artistCollab !== undefined && breakdown.artistCollab >= 15)
    ) {
      return 'artist_continuity';
    }

    // 4. Vibe Continuity: Strong semantic mood/vibe alignment with current song
    if (breakdown.vibeMatch !== undefined && breakdown.vibeMatch >= 18) {
      return 'vibe_continuity';
    }

    // 5. Affinity Match: User's general vibe affinity or favorite track
    if (
      (breakdown.longTermVibeAffinity !== undefined && breakdown.longTermVibeAffinity >= 6) ||
      (breakdown.favorite !== undefined && breakdown.favorite > 0)
    ) {
      return 'affinity_match';
    }
  }

  // 6. Curated / General Pick fallback
  return 'curated_pick';
}

export interface FlowWeights {
  artistMatch: number;
  artistCollabMatch: number;
  genreMatch: number;
  vibeMatch: number;
  favoriteBonus: number;
  playCountBalance: number;
  offlineBonus: number;
  explorationJitter: number;
  recentTrackPenalty: number;
  artistRepeatPenalty: number;
  skipPenalty: number;
  replayBonus: number;
  // Long-Term User Affinity Dimensions (Phase 5.2)
  longTermArtistAffinity: number;
  longTermVibeAffinity: number;
  favoriteArtistBonus: number;
  // Persistent Skip Learning (Phase 5.3)
  persistentSkipPenalty: number;
  // Dynamic Discovery Pacing (Phase 5.4)
  discoveryBonus: number;
}

export const DEFAULT_FLOW_WEIGHTS: FlowWeights = {
  artistMatch: 30,
  artistCollabMatch: 15,
  genreMatch: 20,
  vibeMatch: 25,
  favoriteBonus: 15,
  playCountBalance: 10,
  offlineBonus: 10,
  explorationJitter: 8,
  recentTrackPenalty: 40,
  artistRepeatPenalty: 30,
  skipPenalty: 50,
  replayBonus: 20,
  // Long-Term User Affinity Dimensions (Phase 5.2)
  longTermArtistAffinity: 15,
  longTermVibeAffinity: 10,
  favoriteArtistBonus: 5,
  // Persistent Skip Learning (Phase 5.3)
  persistentSkipPenalty: 35,
  // Dynamic Discovery Pacing (Phase 5.4)
  discoveryBonus: 20
};

export interface FlowContext {
  currentSong: Song | null;
  queue: Song[];
  queueIndex: number;
  playbackHistory: string[]; // Recent song IDs (oldest -> newest)
  allSongs: Song[];          // Library catalog
  downloadedSongIds: Set<string>;
  isOnline: boolean;
  weights?: Partial<FlowWeights>;
  affinityProfile?: UserAffinityProfile | null; // Optional override for testing or custom context (Phase 5.2)
  isDiscoveryActive?: boolean;                  // Optional override for testing or custom context (Phase 5.4)
  songArtistMap?: Map<string, string>;           // Pre-computed songId → normalized artist lookup (Performance: BUG-01 fix)
}

export interface CandidateScore {
  song: Song;
  totalScore: number;
  breakdown: Record<string, number>;
}

class AuraFlowService {
  private weights: FlowWeights = { ...DEFAULT_FLOW_WEIGHTS };
  private sessionSkips: Map<string, number> = new Map();       // songId -> count
  private sessionReplays: Set<string> = new Set();             // songId
  private skippedArtists: Map<string, number> = new Map();     // normalized artist -> count
  private consecutiveFamiliarCount: number = 0;                // Phase 5.4 discovery pacing counter
  private discoveryPreference: DiscoveryPreference = 'balanced'; // Phase 5.5 user discovery pacing preference

  public setWeights(customWeights: Partial<FlowWeights>) {
    this.weights = { ...this.weights, ...customWeights };
  }

  public getWeights(): FlowWeights {
    return { ...this.weights };
  }

  public getConsecutiveFamiliarCount(): number {
    return this.consecutiveFamiliarCount;
  }

  public setConsecutiveFamiliarCount(count: number): void {
    this.consecutiveFamiliarCount = Math.max(0, count);
  }

  public getDiscoveryPreference(): DiscoveryPreference {
    return this.discoveryPreference;
  }

  public async setDiscoveryPreference(preference: DiscoveryPreference): Promise<void> {
    if (preference === 'comfort' || preference === 'balanced' || preference === 'adventurous') {
      this.discoveryPreference = preference;
      try {
        await musicDB.setSetting(AURA_DISCOVERY_PREFERENCE_KEY, preference);
      } catch {
        // Fallback gracefully to in-memory preference
      }
    }
  }

  public setDiscoveryPreferenceInMemory(preference: DiscoveryPreference): void {
    if (preference === 'comfort' || preference === 'balanced' || preference === 'adventurous') {
      this.discoveryPreference = preference;
    }
  }

  public async initDiscoveryPreference(): Promise<DiscoveryPreference> {
    try {
      const saved = await musicDB.getSetting<DiscoveryPreference>(AURA_DISCOVERY_PREFERENCE_KEY, 'balanced');
      if (saved === 'comfort' || saved === 'balanced' || saved === 'adventurous') {
        this.discoveryPreference = saved;
      } else {
        this.discoveryPreference = 'balanced';
      }
    } catch {
      this.discoveryPreference = 'balanced';
    }
    return this.discoveryPreference;
  }

  public isDiscoveryWindowActive(): boolean {
    const threshold = DISCOVERY_THRESHOLDS[this.discoveryPreference] ?? 3;
    return this.consecutiveFamiliarCount >= threshold;
  }

  public resetSession() {
    this.sessionSkips.clear();
    this.sessionReplays.clear();
    this.skippedArtists.clear();
    this.consecutiveFamiliarCount = 0;
  }

  /**
   * Resets all learned Aura intelligence:
   * - Learned artist and vibe affinities
   * - Persistent skip memory
   * - Active session learning
   * - Resets discovery preference to 'balanced'
   */
  public async resetAuraMemory(): Promise<void> {
    await auraAffinityService.clearProfile();
    await auraSkipService.clear();
    this.resetSession();
    await this.setDiscoveryPreference('balanced');
  }

  // --- Long-Term Affinity Profile (Phase 5.1) ---

  public getAffinityProfile(): UserAffinityProfile | null {
    return auraAffinityService.getProfile();
  }

  public async initAffinityProfile(allSongs?: Song[], forceRebuild = false): Promise<UserAffinityProfile> {
    return auraAffinityService.initProfile(allSongs, forceRebuild);
  }

  public async clearAffinityProfile(): Promise<void> {
    return auraAffinityService.clearProfile();
  }

  // --- Feedback Recorders ---

  public recordSkip(songId: string, artist?: string) {
    const current = this.sessionSkips.get(songId) || 0;
    this.sessionSkips.set(songId, current + 1);

    if (artist) {
      const normArtist = normalizeArtistName(artist);
      if (normArtist) {
        const aCurrent = this.skippedArtists.get(normArtist) || 0;
        this.skippedArtists.set(normArtist, aCurrent + 1);
      }
    }

    auraSkipService.recordSkip(songId, artist);
  }

  public recordReplay(songId?: string) {
    if (songId) {
      this.sessionReplays.add(songId);
      // Replay cancels skip penalty if any
      this.sessionSkips.delete(songId);
    }
  }

  public recordMeaningfulListen(songId: string) {
    // Meaningful listen softens previous skip penalty
    if (this.sessionSkips.has(songId)) {
      const count = this.sessionSkips.get(songId)!;
      if (count <= 1) {
        this.sessionSkips.delete(songId);
      } else {
        this.sessionSkips.set(songId, count - 1);
      }
    }

    auraSkipService.recordMeaningfulListen(songId);
  }

  public recordCompletedListen(songId: string) {
    this.sessionSkips.delete(songId);
    auraSkipService.recordCompletedListen(songId);
  }

  public recordFavorite(songId: string) {
    this.sessionSkips.delete(songId);
    auraSkipService.recordFavorite(songId);
  }

  /**
   * Records when an Aura Flow track ACTUALLY starts playing (Phase 5.4).
   * Updates discovery pacing counters based on song familiarity.
   * - Tier 1 (playCount === 0): resets consecutiveFamiliarCount to 0
   * - Tier 2 (playCount === 1): decrements consecutiveFamiliarCount by 1
   * - Tier 3 (playCount > 1): increments consecutiveFamiliarCount by 1
   */
  public recordAuraTrackStart(song: Song): void {
    if (!song) return;
    const playCount = song.playCount || 0;
    if (playCount === 0) {
      this.consecutiveFamiliarCount = 0;
    } else if (playCount === 1) {
      this.consecutiveFamiliarCount = Math.max(0, this.consecutiveFamiliarCount - 1);
    } else {
      this.consecutiveFamiliarCount += 1;
    }
  }

  // --- Candidate Generation & Filtering ---

  /**
   * Builds the candidate pool by combining library and curated tracks,
   * applying hard exclusion rules (current song, queued songs, recent songs, offline availability).
   */
  public generateCandidates(context: FlowContext): Song[] {
    const {
      currentSong,
      queue,
      queueIndex,
      playbackHistory,
      allSongs,
      downloadedSongIds,
      isOnline
    } = context;

    // Combine library with curated tracks to guarantee variety
    const combinedPool = new Map<string, Song>();
    for (const s of allSongs) {
      combinedPool.set(s.id, s);
    }
    // If online, include curated catalog
    if (isOnline) {
      for (const s of TOP_50_TRACKS) {
        if (!combinedPool.has(s.id)) {
          combinedPool.set(s.id, s);
        }
      }
    }

    // Fast Exclusion Sets
    const currentId = currentSong?.id || '';
    const upcomingQueueIds = new Set(queue.slice(queueIndex + 1).map((s) => s.id));
    const recentHistoryIds = new Set(playbackHistory.slice(-5));

    const candidates: Song[] = [];

    for (const song of combinedPool.values()) {
      // 1. Never pick the current playing song
      if (song.id === currentId) continue;

      // 2. Never pick songs already scheduled in upcoming queue slots
      if (upcomingQueueIds.has(song.id)) continue;

      // 3. Never pick songs played very recently in session
      if (recentHistoryIds.has(song.id)) continue;

      // 4. Hard Offline Gate: when offline, candidate MUST be downloaded or local
      if (!isOnline) {
        const isDownloaded = downloadedSongIds.has(song.id) || Boolean(song.isDownloaded);
        const isLocal = !song.isOnline && !song.isSaavn && !song.isLiveRadio;
        if (!isDownloaded && !isLocal) {
          continue;
        }
      }

      candidates.push(song);
    }

    return candidates;
  }

  // --- Multi-Factor Scoring ---

  /**
   * Scores a single candidate against the current context
   */
  public scoreCandidate(
    candidate: Song,
    currentSong: Song | null,
    context: FlowContext,
    weights: FlowWeights
  ): CandidateScore {
    const breakdown: Record<string, number> = {};
    let totalScore = 50; // Neutral baseline

    if (!currentSong) {
      return { song: candidate, totalScore, breakdown: { base: totalScore } };
    }

    // 1. Artist Continuity & Collaboration
    const currentLeadArtist = normalizeArtistName(currentSong.artist || '');
    const candidateLeadArtist = normalizeArtistName(candidate.artist || '');
    const currentArtists = extractArtistPool(currentSong.artist || '');
    const candidateArtists = extractArtistPool(candidate.artist || '');

    if (currentLeadArtist && candidateLeadArtist && currentLeadArtist === candidateLeadArtist) {
      breakdown.artistMatch = weights.artistMatch;
      totalScore += weights.artistMatch;
    } else {
      // Check for overlapping featured/collaborating artists
      const hasCollab = currentArtists.some((a) => candidateArtists.includes(a));
      if (hasCollab) {
        breakdown.artistCollab = weights.artistCollabMatch;
        totalScore += weights.artistCollabMatch;
      }
    }

    // 2. Genre / Style Match
    if (candidate.genre && currentSong.genre && candidate.genre.toLowerCase() === currentSong.genre.toLowerCase()) {
      breakdown.genreMatch = weights.genreMatch;
      totalScore += weights.genreMatch;
    }

    // 3. Mood / Vibe Similarity
    const currentVibe = inferSongVibe(
      currentSong.title,
      currentSong.artist,
      currentSong.album,
      currentSong.genre
    );
    const candidateVibe = inferSongVibe(
      candidate.title,
      candidate.artist,
      candidate.album,
      candidate.genre
    );
    const vibeSimilarity = calculateVibeSimilarity(currentVibe, candidateVibe);
    const vibePoints = Math.round(vibeSimilarity * weights.vibeMatch);
    breakdown.vibeMatch = vibePoints;
    totalScore += vibePoints;

    // 4. Favorite Affinity
    if (candidate.isFavorite) {
      breakdown.favorite = weights.favoriteBonus;
      totalScore += weights.favoriteBonus;
    }

    // 5. Play Count Balancing (Familiar vs Discoveries)
    const playCount = candidate.playCount || 0;
    if (playCount >= 2 && playCount <= 20) {
      // Sweet spot of comfortable familiarity
      breakdown.playCountBalance = weights.playCountBalance;
      totalScore += weights.playCountBalance;
    } else if (playCount > 50) {
      // Fatigue penalty for overplayed tracks
      breakdown.playCountFatigue = -weights.playCountBalance;
      totalScore -= weights.playCountBalance;
    } else if (playCount === 0) {
      // Fresh discovery boost
      breakdown.playCountDiscovery = Math.round(weights.playCountBalance * 0.5);
      totalScore += breakdown.playCountDiscovery;
    }

    // 6. Offline / Local Instant Availability Bonus
    if (context.isOnline) {
      const isInstant =
        context.downloadedSongIds.has(candidate.id) ||
        Boolean(candidate.isDownloaded) ||
        (!candidate.isOnline && !candidate.isSaavn);
      if (isInstant) {
        breakdown.instantPlayback = weights.offlineBonus;
        totalScore += weights.offlineBonus;
      }
    }

    // 7. Recently Played Recency Penalty
    const recentHistory = context.playbackHistory.slice(-12);
    if (recentHistory.includes(candidate.id)) {
      breakdown.recentHistoryPenalty = -weights.recentTrackPenalty;
      totalScore -= weights.recentTrackPenalty;
    }

    // 8. Artist Repetition Penalty (Anti-Monopoly)
    // Use pre-computed songArtistMap for O(1) lookups instead of O(N) find() per history entry (BUG-01 fix)
    const artistMap = context.songArtistMap;
    const recentArtists = artistMap
      ? recentHistory
          .map((id) => artistMap.get(id) || '')
          .filter(Boolean)
          .slice(-3)
      : recentHistory
          .map((id) => {
            const s = context.allSongs.find((x) => x.id === id);
            return s ? normalizeArtistName(s.artist) : '';
          })
          .filter(Boolean)
          .slice(-3);

    if (candidateLeadArtist && recentArtists.includes(candidateLeadArtist)) {
      breakdown.artistRepeatPenalty = -weights.artistRepeatPenalty;
      totalScore -= weights.artistRepeatPenalty;
    }

    // 9. User Skip Penalty
    const skipCount = this.sessionSkips.get(candidate.id) || 0;
    if (skipCount > 0) {
      const penalty = Math.min(weights.skipPenalty * skipCount, weights.skipPenalty * 1.5);
      breakdown.skipPenalty = -penalty;
      totalScore -= penalty;
    }

    // 10. User Replay Boost
    if (this.sessionReplays.has(candidate.id)) {
      breakdown.replayBonus = weights.replayBonus;
      totalScore += weights.replayBonus;
    }

    // 11. Long-Term User Affinity Signals (Phase 5.2)
    const affinityProfile =
      context.affinityProfile !== undefined
        ? context.affinityProfile
        : this.getAffinityProfile();

    if (affinityProfile) {
      // 11a. Long-Term Artist Affinity Bonus (Proportional to 0-100 normalized score)
      if (candidateLeadArtist && affinityProfile.artistAffinity?.[candidateLeadArtist]) {
        const rawAffinity = affinityProfile.artistAffinity[candidateLeadArtist];
        if (rawAffinity > 0) {
          const artistBonus = Math.round((rawAffinity / 100) * weights.longTermArtistAffinity);
          if (artistBonus > 0) {
            breakdown.longTermArtistAffinity = artistBonus;
            totalScore += artistBonus;
          }
        }
      }

      // 11b. Long-Term Vibe Affinity Bonus (Proportional to 0-100 normalized score)
      if (candidateVibe && affinityProfile.vibeAffinity?.[candidateVibe]) {
        const rawVibe = affinityProfile.vibeAffinity[candidateVibe];
        if (rawVibe > 0) {
          const vibeBonus = Math.round((rawVibe / 100) * weights.longTermVibeAffinity);
          if (vibeBonus > 0) {
            breakdown.longTermVibeAffinity = vibeBonus;
            totalScore += vibeBonus;
          }
        }
      }

      // 11c. Favorite Artist Endorsement
      if (
        candidateLeadArtist &&
        Array.isArray(affinityProfile.favoriteArtists) &&
        affinityProfile.favoriteArtists.includes(candidateLeadArtist)
      ) {
        breakdown.favoriteArtistBonus = weights.favoriteArtistBonus;
        totalScore += weights.favoriteArtistBonus;
      }
    }

    // 12. Persistent Skip Penalty (Phase 5.3)
    const persistentPenalty = auraSkipService.getPenalty(
      candidate.id,
      weights.persistentSkipPenalty
    );
    if (persistentPenalty > 0) {
      breakdown.persistentSkipPenalty = -persistentPenalty;
      totalScore -= persistentPenalty;
    } else {
      breakdown.persistentSkipPenalty = 0;
    }

    // 13. Dynamic Discovery Bonus (Phase 5.4)
    const isDiscoveryActive =
      context.isDiscoveryActive !== undefined
        ? context.isDiscoveryActive
        : this.isDiscoveryWindowActive();

    if (isDiscoveryActive && playCount === 0) {
      breakdown.discoveryBonus = weights.discoveryBonus;
      totalScore += weights.discoveryBonus;
    }

    // 14. Exploration Jitter (Prevents deterministic loops)
    if (weights.explorationJitter > 0) {
      const jitter = Math.round(Math.random() * weights.explorationJitter);
      breakdown.jitter = jitter;
      totalScore += jitter;
    }

    return { song: candidate, totalScore, breakdown };
  }

  // --- Top-3 Weighted Selection ---

  /**
   * Selects a candidate using simple weighted-random selection among the top 3 candidates.
   * This ensures high contextual relevance while avoiding deterministic loops.
   * Attaches the truthful auraReason explanation to the winning track.
   */
  public selectNextTrack(
    scoredCandidates: CandidateScore[],
    isDiscoveryActiveOverride?: boolean
  ): Song | null {
    if (scoredCandidates.length === 0) return null;

    let winnerScore: CandidateScore;

    if (scoredCandidates.length === 1) {
      winnerScore = scoredCandidates[0];
    } else {
      const topCandidates = scoredCandidates.slice(0, 3);
      if (topCandidates.length === 2) {
        const rand = Math.random();
        winnerScore = rand < 0.75 ? topCandidates[0] : topCandidates[1];
      } else {
        const rand = Math.random();
        if (rand < 0.65) {
          winnerScore = topCandidates[0];
        } else if (rand < 0.9) {
          winnerScore = topCandidates[1];
        } else {
          winnerScore = topCandidates[2];
        }
      }
    }

    const isDiscoveryActive =
      isDiscoveryActiveOverride !== undefined
        ? isDiscoveryActiveOverride
        : this.isDiscoveryWindowActive();
    const reason = deriveAuraReason(winnerScore.breakdown, isDiscoveryActive);

    return {
      ...winnerScore.song,
      auraReason: reason
    };
  }

  // --- Main Entry Point ---

  /**
   * Generates, scores, and selects the next intelligent track for Aura Flow.
   * Consumes the discovery window for this single recommendation cycle.
   */
  public getNextTrack(context: FlowContext): Song | null {
    const candidates = this.generateCandidates(context);
    if (candidates.length === 0) return null;

    const weights = { ...this.weights, ...(context.weights || {}) };

    // Check if discovery window is active for this recommendation
    const isDiscoveryActive =
      context.isDiscoveryActive !== undefined
        ? context.isDiscoveryActive
        : this.isDiscoveryWindowActive();

    // Consume the discovery window immediately so only this recommendation receives the opportunity
    if (context.isDiscoveryActive === undefined && this.isDiscoveryWindowActive()) {
      this.consecutiveFamiliarCount = 0;
    }

    // Pre-compute songId → normalized artist lookup Map to avoid O(N) find() inside scoreCandidate (BUG-01 fix)
    const songArtistMap = new Map<string, string>();
    for (const s of context.allSongs) {
      if (s.artist) {
        songArtistMap.set(s.id, normalizeArtistName(s.artist));
      }
    }

    const scoringContext = { ...context, isDiscoveryActive, songArtistMap };
    const scored: CandidateScore[] = candidates.map((candidate) =>
      this.scoreCandidate(candidate, context.currentSong, scoringContext, weights)
    );

    // Sort descending by total score
    scored.sort((a, b) => b.totalScore - a.totalScore);

    return this.selectNextTrack(scored, isDiscoveryActive);
  }
}

export const auraFlowService = new AuraFlowService();
