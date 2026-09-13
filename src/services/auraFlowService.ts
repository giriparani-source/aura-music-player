/**
 * src/services/auraFlowService.ts
 *
 * Aura Flow: Infinite AI Smart Autoplay Engine for Aura Music Player.
 *
 * Recommends and sequences the next track using a multi-factor scoring model
 * that balances continuity, user feedback, availability, and anti-clustering diversity.
 */

import { Song } from '../types/music';
import {
  inferSongVibe,
  calculateVibeSimilarity,
  normalizeArtistName,
  extractArtistPool
} from './flowKnowledgeBase';
import { TOP_50_TRACKS } from './inbuiltPlaylistsService';
import { UserAffinityProfile, auraAffinityService } from './auraAffinityService';

export type { UserAffinityProfile };

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
  favoriteArtistBonus: 5
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

  public setWeights(customWeights: Partial<FlowWeights>) {
    this.weights = { ...this.weights, ...customWeights };
  }

  public getWeights(): FlowWeights {
    return { ...this.weights };
  }

  public resetSession() {
    this.sessionSkips.clear();
    this.sessionReplays.clear();
    this.skippedArtists.clear();
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
  }

  public recordCompletedListen(songId: string) {
    this.sessionSkips.delete(songId);
  }

  public recordFavorite(songId: string) {
    this.sessionSkips.delete(songId);
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
    const recentArtists = recentHistory
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

    // 12. Exploration Jitter (Prevents deterministic loops)
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
   */
  public selectNextTrack(scoredCandidates: CandidateScore[]): Song | null {
    if (scoredCandidates.length === 0) return null;
    if (scoredCandidates.length === 1) return scoredCandidates[0].song;

    // Take up to top 3
    const topCandidates = scoredCandidates.slice(0, 3);

    if (topCandidates.length === 2) {
      const rand = Math.random();
      return rand < 0.75 ? topCandidates[0].song : topCandidates[1].song;
    }

    // 3 candidates: 65% for #1, 25% for #2, 10% for #3
    const rand = Math.random();
    if (rand < 0.65) {
      return topCandidates[0].song;
    } else if (rand < 0.9) {
      return topCandidates[1].song;
    } else {
      return topCandidates[2].song;
    }
  }

  // --- Main Entry Point ---

  /**
   * Generates, scores, and selects the next intelligent track for Aura Flow.
   */
  public getNextTrack(context: FlowContext): Song | null {
    const candidates = this.generateCandidates(context);
    if (candidates.length === 0) return null;

    const weights = { ...this.weights, ...(context.weights || {}) };

    const scored: CandidateScore[] = candidates.map((candidate) =>
      this.scoreCandidate(candidate, context.currentSong, context, weights)
    );

    // Sort descending by total score
    scored.sort((a, b) => b.totalScore - a.totalScore);

    return this.selectNextTrack(scored);
  }
}

export const auraFlowService = new AuraFlowService();
