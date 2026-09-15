/**
 * src/services/auraAffinityService.ts
 *
 * Aura Flow Long-Term Affinity & Profile Hydration (Phase 5.1).
 *
 * Computes a local-only user affinity profile from existing IndexedDB history,
 * play counts, and favorites. Uses bounded recency decay and normalizes scores (0-100).
 * Caches in memory and persists to the existing IndexedDB 'settings' store.
 */

import { Song } from '../types/music';
import { inferSongVibe, normalizeArtistName } from './flowKnowledgeBase';
import { musicDB, AURA_USER_AFFINITY_KEY } from './db';

export const AURA_AFFINITY_VERSION = 1;
export const STALE_PROFILE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const RECENCY_WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000;
export const RECENCY_WINDOW_30D_MS = 30 * 24 * 60 * 60 * 1000;
export const RECENCY_WINDOW_90D_MS = 90 * 24 * 60 * 60 * 1000;

export const FAVORITE_AFFINITY_WEIGHT = 3.0;
export const FAVORITE_VIBE_WEIGHT = 2.0;

export interface UserAffinityProfile {
  version: number;
  updatedAt: number;
  totalMeaningfulPlays: number;
  artistAffinity: Record<string, number>;      // normalized artist -> 0-100 score
  vibeAffinity: Record<string, number>;        // VibeCluster -> 0-100 score
  favoriteArtists: string[];                   // top favorite normalized artists
  recentArtistCounts: Record<string, number>;  // normalized artist -> recent plays count (last 30d)
  recentVibeCounts: Record<string, number>;    // VibeCluster -> recent plays count (last 30d)
}

/**
 * Computes deterministic recency decay weight based on age of playback.
 * Recent plays (<= 7 days) receive maximum weight (1.0).
 * Older plays receive progressively decayed weights down to 0.25.
 */
export function calculateRecencyDecay(timestamp: number, now: number = Date.now()): number {
  if (!timestamp || timestamp <= 0 || isNaN(timestamp)) {
    return 0.25;
  }
  const ageMs = Math.max(0, now - timestamp);

  if (ageMs <= RECENCY_WINDOW_7D_MS) {
    return 1.0;
  }
  if (ageMs <= RECENCY_WINDOW_30D_MS) {
    return 0.75;
  }
  if (ageMs <= RECENCY_WINDOW_90D_MS) {
    return 0.5;
  }
  return 0.25;
}

/**
 * Creates an empty, neutral affinity profile
 */
export function createEmptyAffinityProfile(now: number = Date.now()): UserAffinityProfile {
  return {
    version: AURA_AFFINITY_VERSION,
    updatedAt: now,
    totalMeaningfulPlays: 0,
    artistAffinity: {},
    vibeAffinity: {},
    favoriteArtists: [],
    recentArtistCounts: {},
    recentVibeCounts: {}
  };
}

/**
 * Validates whether an unknown object conforms to the UserAffinityProfile schema
 */
export function isValidAffinityProfile(data: unknown): data is UserAffinityProfile {
  if (!data) return false;
  let parsed: unknown = data;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return false;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return false;
  const p = parsed as Record<string, unknown>;

  return (
    p.version === AURA_AFFINITY_VERSION &&
    typeof p.updatedAt === 'number' &&
    p.updatedAt > 0 &&
    typeof p.totalMeaningfulPlays === 'number' &&
    typeof p.artistAffinity === 'object' &&
    p.artistAffinity !== null &&
    !Array.isArray(p.artistAffinity) &&
    typeof p.vibeAffinity === 'object' &&
    p.vibeAffinity !== null &&
    !Array.isArray(p.vibeAffinity) &&
    Array.isArray(p.favoriteArtists) &&
    typeof p.recentArtistCounts === 'object' &&
    p.recentArtistCounts !== null &&
    !Array.isArray(p.recentArtistCounts) &&
    typeof p.recentVibeCounts === 'object' &&
    p.recentVibeCounts !== null &&
    !Array.isArray(p.recentVibeCounts)
  );
}

/**
 * Checks if a profile is older than the staleness threshold or has an invalid timestamp
 */
export function isAffinityProfileStale(
  profile: UserAffinityProfile | null | undefined,
  now: number = Date.now(),
  maxAgeMs: number = STALE_PROFILE_MS
): boolean {
  if (!profile || typeof profile !== 'object') return true;
  if (profile.version !== AURA_AFFINITY_VERSION) return true;
  if (typeof profile.updatedAt !== 'number' || profile.updatedAt <= 0) return true;
  if (now < profile.updatedAt) return true; // Clock skew defense
  return now - profile.updatedAt > maxAgeMs;
}

/**
 * Builds a fresh UserAffinityProfile from local songs and play history.
 * Bounded, normalized (0-100), and handles missing fields gracefully.
 */
export function buildAffinityProfile(
  songs: Song[],
  history: Array<{ songId: string; timestamp: number }> = [],
  now: number = Date.now()
): UserAffinityProfile {
  if ((!songs || songs.length === 0) && (!history || history.length === 0)) {
    return createEmptyAffinityProfile(now);
  }

  const rawArtistScores: Record<string, number> = {};
  const rawVibeScores: Record<string, number> = {};
  const favArtistCounts: Record<string, number> = {};
  const recentArtistCounts: Record<string, number> = {};
  const recentVibeCounts: Record<string, number> = {};

  const songMap = new Map<string, Song>();
  for (const song of songs) {
    if (song && song.id) {
      songMap.set(song.id, song);
    }
  }

  let totalMeaningfulPlays = 0;
  const processedHistorySongIds = new Set<string>();

  // 1. Process History log (chronological meaningful plays)
  for (const item of history) {
    if (!item || !item.songId) continue;
    const song = songMap.get(item.songId);
    // Gracefully ignore deleted / ghost history items
    if (!song) continue;

    totalMeaningfulPlays++;
    processedHistorySongIds.add(song.id);

    const normArtist = normalizeArtistName(song.artist || '');
    const vibe = inferSongVibe(song.title || '', song.artist || '', song.album || '', song.genre || '');
    const decay = calculateRecencyDecay(item.timestamp, now);

    if (normArtist) {
      rawArtistScores[normArtist] = (rawArtistScores[normArtist] || 0) + decay;
      if (now - item.timestamp <= RECENCY_WINDOW_30D_MS) {
        recentArtistCounts[normArtist] = (recentArtistCounts[normArtist] || 0) + 1;
      }
    }

    if (vibe) {
      rawVibeScores[vibe] = (rawVibeScores[vibe] || 0) + decay;
      if (now - item.timestamp <= RECENCY_WINDOW_30D_MS) {
        recentVibeCounts[vibe] = (recentVibeCounts[vibe] || 0) + 1;
      }
    }
  }

  // 2. Process Songs with playCount that were not captured in the history log window
  for (const song of songs) {
    if (!song) continue;

    const normArtist = normalizeArtistName(song.artist || '');
    const vibe = inferSongVibe(song.title || '', song.artist || '', song.album || '', song.genre || '');

    if (!processedHistorySongIds.has(song.id) && (song.playCount || 0) > 0) {
      const plays = song.playCount;
      totalMeaningfulPlays += plays;
      const decay = calculateRecencyDecay(song.lastPlayedAt || song.dateAdded, now);
      const playWeight = plays * decay;

      if (normArtist) {
        rawArtistScores[normArtist] = (rawArtistScores[normArtist] || 0) + playWeight;
      }
      if (vibe) {
        rawVibeScores[vibe] = (rawVibeScores[vibe] || 0) + playWeight;
      }
    }

    // 3. Process Favorite signals (Higher weighted baseline endorsement)
    if (song.isFavorite) {
      if (normArtist) {
        rawArtistScores[normArtist] = (rawArtistScores[normArtist] || 0) + FAVORITE_AFFINITY_WEIGHT;
        favArtistCounts[normArtist] = (favArtistCounts[normArtist] || 0) + 1;
      }
      if (vibe) {
        rawVibeScores[vibe] = (rawVibeScores[vibe] || 0) + FAVORITE_VIBE_WEIGHT;
      }
    }
  }

  // 4. Extract Top Favorite Artists
  const favoriteArtists = Object.keys(favArtistCounts)
    .sort((a, b) => favArtistCounts[b] - favArtistCounts[a])
    .slice(0, 10);

  // 5. Normalize Scores between 0 and 100
  const artistAffinity: Record<string, number> = {};
  const maxArtist = Math.max(0, ...Object.values(rawArtistScores));
  if (maxArtist > 0) {
    for (const [artist, raw] of Object.entries(rawArtistScores)) {
      artistAffinity[artist] = Math.round((raw / maxArtist) * 100);
    }
  }

  const vibeAffinity: Record<string, number> = {};
  const maxVibe = Math.max(0, ...Object.values(rawVibeScores));
  if (maxVibe > 0) {
    for (const [vibe, raw] of Object.entries(rawVibeScores)) {
      vibeAffinity[vibe] = Math.round((raw / maxVibe) * 100);
    }
  }

  return {
    version: AURA_AFFINITY_VERSION,
    updatedAt: now,
    totalMeaningfulPlays,
    artistAffinity,
    vibeAffinity,
    favoriteArtists,
    recentArtistCounts,
    recentVibeCounts
  };
}

export class AuraAffinityService {
  private profile: UserAffinityProfile | null = null;
  private isHydrating = false;

  public getProfile(): UserAffinityProfile | null {
    return this.profile;
  }

  public setProfile(profile: UserAffinityProfile | null): void {
    this.profile = profile;
  }

  /**
   * Initializes and hydrates the affinity profile.
   * 1. Checks in-memory profile.
   * 2. Tries to load valid, non-stale cached profile from IndexedDB 'settings' store.
   * 3. If missing, invalid, stale, or forceRebuild is requested, builds from songs + history.
   * 4. Graceful error handling: falls back to neutral profile on any error without throwing.
   */
  public async initProfile(allSongs?: Song[], forceRebuild = false): Promise<UserAffinityProfile> {
    if (this.profile && !forceRebuild && !isAffinityProfileStale(this.profile)) {
      return this.profile;
    }

    if (this.isHydrating) {
      // Return current profile or fallback if already hydrating concurrently
      return this.profile || createEmptyAffinityProfile();
    }

    this.isHydrating = true;

    try {
      if (!forceRebuild) {
        let cached: unknown = null;
        try {
          cached = await musicDB.getSetting<unknown>(AURA_USER_AFFINITY_KEY, null);
        } catch {
          cached = null;
        }

        if (isValidAffinityProfile(cached) && !isAffinityProfileStale(cached)) {
          this.profile = cached;
          this.isHydrating = false;
          return cached;
        }
      }

      // Rebuild profile from existing persisted local data
      let songs = allSongs;
      if (!songs) {
        try {
          songs = await musicDB.getAllSongs();
        } catch {
          songs = [];
        }
      }

      let history: Array<{ songId: string; timestamp: number }> = [];
      try {
        history = await musicDB.getRecentHistory(200);
      } catch {
        history = [];
      }

      const freshProfile = buildAffinityProfile(songs || [], history);
      this.profile = freshProfile;

      // Persist to IndexedDB 'settings' store asynchronously (non-blocking)
      try {
        musicDB.setSetting(AURA_USER_AFFINITY_KEY, freshProfile).catch(() => {
          // Graceful ignore if IndexedDB is unavailable
        });
      } catch {
        // Graceful ignore
      }

      this.isHydrating = false;
      return freshProfile;
    } catch {
      const fallback = createEmptyAffinityProfile();
      this.profile = fallback;
      this.isHydrating = false;
      return fallback;
    }
  }

  /**
   * Clears in-memory profile and deletes the setting from IndexedDB
   */
  public async clearProfile(): Promise<void> {
    this.profile = null;
    try {
      await musicDB.deleteSetting(AURA_USER_AFFINITY_KEY);
    } catch (err) {
      console.warn('Failed to delete affinity profile setting:', err);
    }
  }
}

export const auraAffinityService = new AuraAffinityService();
