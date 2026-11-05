import { Song, PlaybackSession, PlaybackSourceProvider, ShuffleMode, RepeatMode } from '../types/music';
import { musicDB } from './db';
import { extractYouTubeVideoId, isDirectAudioStream, isLocalTrack } from './audioStreamResolver';
import { INBUILT_PLAYLISTS } from './inbuiltPlaylistsService';

const LOCAL_STORAGE_SESSION_KEY = 'aura_playback_session_v1';
const MIN_SAVE_INTERVAL_MS = 2500; // Save every 2.5–3s during playback

export function detectSourceProvider(song: Song): PlaybackSourceProvider {
  if (song.isLiveRadio) return 'radio';
  if (
    song.id?.startsWith('t50_') ||
    song.id?.startsWith('fl_') ||
    song.id?.startsWith('n90_') ||
    song.id?.startsWith('nd_') ||
    song.id?.startsWith('bm_') ||
    song.id?.startsWith('kc_') ||
    song.id?.startsWith('kp_') ||
    song.id?.startsWith('am_') ||
    song.id?.startsWith('ar_') ||
    song.id?.startsWith('yu_') ||
    song.id?.startsWith('hj_')
  ) {
    return 'inbuilt';
  }
  if (isLocalTrack(song)) return 'local';
  if (extractYouTubeVideoId(song)) return 'youtube';
  if (song.isSaavn || song.id?.startsWith('saavn_') || song.filePath?.includes('saavncdn.com')) {
    return 'saavn';
  }
  return 'stream';
}

export function getStableSourceIdentifier(song: Song, provider: PlaybackSourceProvider): string {
  switch (provider) {
    case 'youtube':
      return extractYouTubeVideoId(song) || song.sourceId || song.id;
    case 'local':
      return song.path || song.filePath || song.id;
    case 'saavn':
      return song.sourceId || song.id;
    case 'radio':
      return song.id || song.sourceId || song.path;
    case 'inbuilt':
      return song.id;
    default:
      return song.sourceId || song.id;
  }
}

export function sanitizeSongForPersistence(song: Song): Song {
  const clean = { ...song };
  // Never persist transient blob URLs
  if (clean.path && clean.path.startsWith('blob:')) {
    clean.path = clean.fileName ? `/songs/${clean.fileName}` : '';
  }
  if (clean.filePath && clean.filePath.startsWith('blob:')) {
    clean.filePath = clean.path;
  }
  delete (clean as any).isFallingBack;
  return clean;
}

export function validateAndSanitizeSession(raw: any): PlaybackSession | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.songId || typeof raw.songId !== 'string') return null;

  // Stale session expiration (30 days)
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  if (!raw.updatedAt || typeof raw.updatedAt !== 'number' || now - raw.updatedAt > maxAge) {
    return null;
  }

  const duration = typeof raw.duration === 'number' && raw.duration > 0 ? raw.duration : 0;
  let position = typeof raw.position === 'number' && !isNaN(raw.position) ? raw.position : 0;

  // Position clamping & validation
  if (position < 0) position = 0;
  if (duration > 0 && position > duration) {
    position = Math.max(0, duration - 1);
  }

  const queueTrackIds = Array.isArray(raw.queueTrackIds) ? raw.queueTrackIds : [];
  let queueIndex = typeof raw.queueIndex === 'number' && !isNaN(raw.queueIndex) ? raw.queueIndex : 0;
  if (queueIndex < 0 || (queueTrackIds.length > 0 && queueIndex >= queueTrackIds.length)) {
    queueIndex = 0;
  }

  return {
    songId: raw.songId,
    provider: raw.provider || 'stream',
    sourceIdentifier: raw.sourceIdentifier || raw.songId,
    position,
    duration,
    queueTrackIds,
    queueTracks: Array.isArray(raw.queueTracks) ? raw.queueTracks.map(sanitizeSongForPersistence) : undefined,
    queueIndex,
    shuffleState: {
      isShuffle: Boolean(raw.shuffleState?.isShuffle),
      shuffleMode: (raw.shuffleState?.shuffleMode as ShuffleMode) || 'off',
      shuffledQueueOrder: Array.isArray(raw.shuffleState?.shuffledQueueOrder)
        ? raw.shuffleState.shuffledQueueOrder
        : undefined
    },
    repeatState: (raw.repeatState as RepeatMode) || 'off',
    updatedAt: raw.updatedAt
  };
}

export class PlaybackSessionService {
  private lastSavedAt: number = 0;
  private pendingTimer: any = null;
  private latestSession: PlaybackSession | null = null;

  /**
   * Builds a PlaybackSession object from current player state.
   */
  public createSession(options: {
    currentSong: Song;
    currentTime: number;
    duration: number;
    queue: Song[];
    queueIndex: number;
    isShuffle: boolean;
    shuffleMode: ShuffleMode;
    shuffledQueueOrder?: number[];
    repeatMode: RepeatMode;
  }): PlaybackSession {
    const {
      currentSong,
      currentTime,
      duration,
      queue,
      queueIndex,
      isShuffle,
      shuffleMode,
      shuffledQueueOrder,
      repeatMode
    } = options;

    const provider = detectSourceProvider(currentSong);
    const sourceIdentifier = getStableSourceIdentifier(currentSong, provider);
    const trackDuration = duration > 0 ? duration : currentSong.duration || 0;
    const clampedPos = Math.max(0, Math.min(currentTime, trackDuration > 0 ? trackDuration : currentTime));

    // Queue snapshot sanitized of temporary blob URLs
    const sanitizedQueue = queue.map(sanitizeSongForPersistence);

    return {
      songId: currentSong.id,
      provider,
      sourceIdentifier,
      position: clampedPos,
      duration: trackDuration,
      queueTrackIds: queue.map((s) => s.id),
      queueTracks: sanitizedQueue,
      queueIndex: Math.max(0, queueIndex),
      shuffleState: {
        isShuffle,
        shuffleMode,
        shuffledQueueOrder: shuffledQueueOrder ? [...shuffledQueueOrder] : undefined
      },
      repeatState: repeatMode,
      updatedAt: Date.now()
    };
  }

  /**
   * Throttled save: called on continuous timeupdate every 2.5–3 seconds.
   */
  public saveSessionThrottled(session: PlaybackSession): void {
    this.latestSession = session;
    const now = Date.now();
    if (now - this.lastSavedAt >= MIN_SAVE_INTERVAL_MS) {
      this.flushSession(session);
    } else if (!this.pendingTimer) {
      const wait = MIN_SAVE_INTERVAL_MS - (now - this.lastSavedAt);
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        if (this.latestSession) {
          this.flushSession(this.latestSession);
        }
      }, wait);
    }
  }

  /**
   * Immediate save: called on pause, seek, track change, and app backgrounding.
   */
  public async saveSessionImmediate(session: PlaybackSession): Promise<void> {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.latestSession = session;
    return this.flushSession(session);
  }

  /**
   * Persists session to IndexedDB and synchronously to localStorage for emergency recovery.
   */
  private async flushSession(session: PlaybackSession): Promise<void> {
    this.lastSavedAt = Date.now();
    const cleanSession = validateAndSanitizeSession(session);
    if (!cleanSession) return;

    // Fast synchronous backup for pagehide/beforeunload
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(cleanSession));
      }
    } catch {
      // Storage quota or privacy mode error ignored
    }

    // Primary persistent IndexedDB storage
    try {
      await musicDB.savePlaybackSession(cleanSession);
    } catch (err: any) {
      if (typeof indexedDB !== 'undefined') {
        console.warn('[PlaybackSessionService] IndexedDB session save failed:', err);
      }
    }
  }

  /**
   * Loads saved playback session from IndexedDB (or fallback localStorage).
   */
  public async loadSession(): Promise<PlaybackSession | null> {
    // 1. Try IndexedDB
    try {
      const idbSession = await musicDB.getPlaybackSession();
      const validIdb = validateAndSanitizeSession(idbSession);
      if (validIdb) return validIdb;
    } catch (err: any) {
      if (typeof indexedDB !== 'undefined') {
        console.warn('[PlaybackSessionService] IndexedDB session read notice:', err);
      }
    }

    // 2. Fallback to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const validLocal = validateAndSanitizeSession(parsed);
          if (validLocal) return validLocal;
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Clears saved playback session from both stores.
   */
  public async clearSession(): Promise<void> {
    this.latestSession = null;
    this.lastSavedAt = 0;
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
      }
    } catch {}
    try {
      await musicDB.clearPlaybackSession();
    } catch {}
  }

  /**
   * Re-resolves a saved track to confirm existence and playable stream source.
   */
  public async resolveSavedTrack(
    songId: string,
    snapshotTrack?: Song
  ): Promise<{ track: Song | null; isDeletedOrUnavailable: boolean }> {
    // 1. Check local IndexedDB library first
    try {
      const dbSong = await musicDB.getSongById(songId);
      if (dbSong) {
        return { track: dbSong, isDeletedOrUnavailable: false };
      }
    } catch {}

    // 2. Check Inbuilt Playlists registry
    for (const pl of INBUILT_PLAYLISTS) {
      const found = pl.tracks.find((t) => t.id === songId);
      if (found) {
        return { track: found, isDeletedOrUnavailable: false };
      }
    }

    // 3. If snapshot provided from session, check provider
    if (snapshotTrack && snapshotTrack.id === songId) {
      const provider = detectSourceProvider(snapshotTrack);
      // For local tracks: if not in IndexedDB, it was deleted!
      if (provider === 'local') {
        return { track: null, isDeletedOrUnavailable: true };
      }
      // Remote, JioSaavn, Inbuilt, or YouTube tracks remain restorable from snapshot
      return { track: snapshotTrack, isDeletedOrUnavailable: false };
    }

    return { track: null, isDeletedOrUnavailable: true };
  }
}

export const playbackSessionService = new PlaybackSessionService();
