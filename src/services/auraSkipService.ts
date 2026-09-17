/**
 * src/services/auraSkipService.ts
 *
 * Aura Flow Persistent Skip Learning & Negative Signal Calibration (Phase 5.3).
 *
 * Upgrades Aura Flow's session-only skip feedback into a persistent, bounded,
 * decaying negative-learning system that remembers repeated skips across sessions
 * without permanently banishing songs.
 */

import { musicDB, AURA_PERSISTENT_SKIPS_KEY } from './db';
import { normalizeArtistName } from './flowKnowledgeBase';

export const MAX_PERSISTENT_SKIPS = 300;
export const MAX_SKIP_COUNT = 5;

export const SKIP_DECAY_7D_MS = 7 * 24 * 60 * 60 * 1000;
export const SKIP_DECAY_30D_MS = 30 * 24 * 60 * 60 * 1000;
export const SKIP_DECAY_90D_MS = 90 * 24 * 60 * 60 * 1000;

export interface PersistentSkipEntry {
  count: number;
  lastSkippedAt: number;
  artist?: string;
}

export type PersistentSkipMap = Record<string, PersistentSkipEntry>;

/**
 * Computes deterministic time-based recency decay for a persistent skip.
 * Recent skips retain full negative weight; older skips soften significantly.
 */
export function calculateSkipDecay(timestamp: number, now: number = Date.now()): number {
  if (!timestamp || timestamp <= 0 || isNaN(timestamp)) {
    return 0.1;
  }
  const ageMs = Math.max(0, now - timestamp);
  if (ageMs <= SKIP_DECAY_7D_MS) {
    return 1.0;
  }
  if (ageMs <= SKIP_DECAY_30D_MS) {
    return 0.6;
  }
  if (ageMs <= SKIP_DECAY_90D_MS) {
    return 0.3;
  }
  return 0.1;
}

/**
 * Computes graduated multiplier based on persistent skip count.
 * A single skip is treated as mild hesitation (0.4x),
 * while repeated skips represent strong negative sentiment (up to 1.0x).
 */
export function calculateSkipPenaltyMultiplier(count: number): number {
  if (!count || count <= 0) return 0;
  if (count === 1) return 0.4;
  if (count === 2) return 0.7;
  return 1.0;
}

export class AuraSkipService {
  private skipMap: PersistentSkipMap = {};
  private isHydrated = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  public getSkipMap(): PersistentSkipMap {
    return { ...this.skipMap };
  }

  public setSkipMap(map: PersistentSkipMap): void {
    this.skipMap = { ...map };
  }

  /**
   * Initializes and hydrates persistent skips from IndexedDB 'settings'.
   * Gracefully falls back to empty object on error or missing/malformed data.
   */
  public async init(): Promise<PersistentSkipMap> {
    try {
      const data = await musicDB.getSetting<unknown>(AURA_PERSISTENT_SKIPS_KEY, null);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const validatedMap: PersistentSkipMap = {};
        for (const [id, entry] of Object.entries(data as Record<string, unknown>)) {
          if (
            entry &&
            typeof entry === 'object' &&
            typeof (entry as Record<string, unknown>).count === 'number' &&
            typeof (entry as Record<string, unknown>).lastSkippedAt === 'number'
          ) {
            const e = entry as PersistentSkipEntry;
            validatedMap[id] = {
              count: Math.min(MAX_SKIP_COUNT, Math.max(1, e.count)),
              lastSkippedAt: e.lastSkippedAt,
              artist: typeof e.artist === 'string' ? e.artist : undefined
            };
          }
        }
        this.skipMap = validatedMap;
      } else {
        this.skipMap = {};
      }
    } catch {
      this.skipMap = {};
    }
    this.isHydrated = true;
    return this.skipMap;
  }

  /**
   * Records a user skip for a specific song.
   * Increments count (capped at 5) and updates lastSkippedAt.
   * Enforces 300-song LRU cap and triggers debounced persistence.
   */
  public recordSkip(songId: string, artist?: string, now: number = Date.now()): void {
    if (!songId) return;

    const existing = this.skipMap[songId];
    const newCount = existing ? Math.min(MAX_SKIP_COUNT, existing.count + 1) : 1;
    const normalizedArtist = artist ? normalizeArtistName(artist) : (existing?.artist || undefined);

    this.skipMap[songId] = {
      count: newCount,
      lastSkippedAt: now,
      artist: normalizedArtist
    };

    this.enforceLruCap();
    this.scheduleSave();
  }

  /**
   * Softens persistent skip upon meaningful listen.
   * Decrements count by 1; removes record if count reaches 0 or <= 1.
   */
  public recordMeaningfulListen(songId: string): void {
    if (!songId || !this.skipMap[songId]) return;

    const entry = this.skipMap[songId];
    if (entry.count > 1) {
      entry.count -= 1;
    } else {
      delete this.skipMap[songId];
    }
    this.scheduleSave();
  }

  /**
   * Forgives and completely clears persistent skip when user finishes listening to song.
   */
  public recordCompletedListen(songId: string): void {
    if (!songId || !this.skipMap[songId]) return;
    delete this.skipMap[songId];
    this.scheduleSave();
  }

  /**
   * Forgives and completely clears persistent skip when user marks song as favorite.
   */
  public recordFavorite(songId: string): void {
    if (!songId || !this.skipMap[songId]) return;
    delete this.skipMap[songId];
    this.scheduleSave();
  }

  /**
   * Synchronously computes the persistent skip penalty for a candidate song.
   * Formula: Math.round(baseWeight * multiplier(count) * decay(lastSkippedAt))
   */
  public getPenalty(songId: string, baseWeight: number, now: number = Date.now()): number {
    if (!songId || baseWeight <= 0) return 0;
    const entry = this.skipMap[songId];
    if (!entry || entry.count <= 0) return 0;

    const multiplier = calculateSkipPenaltyMultiplier(entry.count);
    const decay = calculateSkipDecay(entry.lastSkippedAt, now);

    return Math.round(baseWeight * multiplier * decay);
  }

  /**
   * Clears in-memory skip map and deletes persisted setting from IndexedDB.
   */
  public async clear(): Promise<void> {
    this.skipMap = {};
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    try {
      await musicDB.deleteSetting(AURA_PERSISTENT_SKIPS_KEY);
    } catch {
      // Graceful ignore
    }
  }

  /**
   * Flushes in-memory skip map immediately to IndexedDB (for test determinism).
   */
  public async flush(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    try {
      await musicDB.setSetting(AURA_PERSISTENT_SKIPS_KEY, this.skipMap);
    } catch {
      // Graceful ignore
    }
  }

  private enforceLruCap(): void {
    const keys = Object.keys(this.skipMap);
    if (keys.length <= MAX_PERSISTENT_SKIPS) return;

    // Sort ascending by lastSkippedAt (oldest first)
    const sorted = keys.sort((a, b) => this.skipMap[a].lastSkippedAt - this.skipMap[b].lastSkippedAt);
    const excess = sorted.length - MAX_PERSISTENT_SKIPS;
    for (let i = 0; i < excess; i++) {
      delete this.skipMap[sorted[i]];
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      musicDB.setSetting(AURA_PERSISTENT_SKIPS_KEY, this.skipMap).catch(() => {
        // Non-blocking, fails gracefully
      });
    }, 200);
  }
}

export const auraSkipService = new AuraSkipService();
