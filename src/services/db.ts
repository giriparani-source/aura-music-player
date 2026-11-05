import { Song, Playlist, LibraryStats, LibraryHealth, PlaybackSession } from '../types/music';
import { calculateLibraryHealth, healthToLegacyStats } from './healthService';
import { normalizeSong, isLocalDeviceSong } from '../utils/songUtils';

export interface DeviceScanSummary {
  added: number;
  updated: number;
  removed: number;
  total: number;
}

const DB_NAME = 'AuraMusicDB';
const DB_VERSION = 2; // Incremented for upgraded indexes & directory handle store

class MusicDatabase {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Songs Store
        if (!db.objectStoreNames.contains('songs')) {
          const songsStore = db.createObjectStore('songs', { keyPath: 'id' });
          songsStore.createIndex('title', 'title', { unique: false });
          songsStore.createIndex('artist', 'artist', { unique: false });
          songsStore.createIndex('album', 'album', { unique: false });
          songsStore.createIndex('folder', 'folder', { unique: false });
          songsStore.createIndex('path', 'path', { unique: false });
          songsStore.createIndex('dateAdded', 'dateAdded', { unique: false });
          songsStore.createIndex('isFavorite', 'isFavorite', { unique: false });
          songsStore.createIndex('playCount', 'playCount', { unique: false });
        } else {
          // Add path index if not present
          const tx = (event.target as IDBOpenDBRequest).transaction;
          if (tx) {
            const songsStore = tx.objectStore('songs');
            if (!songsStore.indexNames.contains('path')) {
              songsStore.createIndex('path', 'path', { unique: false });
            }
          }
        }

        // 2. Playlists Store
        if (!db.objectStoreNames.contains('playlists')) {
          const playlistsStore = db.createObjectStore('playlists', { keyPath: 'id' });
          playlistsStore.createIndex('name', 'name', { unique: false });
        }

        // 3. Playback History Store
        if (!db.objectStoreNames.contains('history')) {
          const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
          historyStore.createIndex('songId', 'songId', { unique: false });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 4. Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.initPromise;
  }

  // --- SONGS OPERATIONS ---
  async getAllSongs(): Promise<Song[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []).map(normalizeSong));
      req.onerror = () => reject(req.error);
    });
  }

  async getSongById(id: string): Promise<Song | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ? normalizeSong(req.result) : undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSong(song: Song): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const req = store.put(normalizeSong(song));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async saveSongsBatch(songs: Song[]): Promise<void> {
    if (songs.length === 0) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      for (const song of songs) {
        store.put(normalizeSong(song));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Idempotent incremental sync for device songs.
   * Compares newly discovered device tracks against existing IndexedDB records:
   * - Inserts genuinely new songs.
   * - Updates changed metadata without creating duplicate records.
   * - Preserves user-customized fields (isFavorite, playCount, lastPlayedAt, lyrics).
   * - Removes stale device records for audio files no longer present on device.
   * - NEVER touches or deletes physical audio files.
   */
  async syncDeviceSongs(scannedSongs: Song[]): Promise<DeviceScanSummary> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const getAllReq = store.getAll();

      getAllReq.onerror = () => reject(getAllReq.error);
      getAllReq.onsuccess = () => {
        const allSongs: Song[] = (getAllReq.result || []).map(normalizeSong);

        // Identify existing device tracks using strict local device song classifier
        const existingDeviceSongs = allSongs.filter(isLocalDeviceSong);

        // Safety Guard (Requirement 8):
        // If scan returned 0 songs, do not purge the existing device library.
        // It could be due to revoked permissions or empty/cancelled scan.
        if (!scannedSongs || scannedSongs.length === 0) {
          resolve({
            added: 0,
            updated: 0,
            removed: 0,
            total: existingDeviceSongs.length
          });
          return;
        }

        // Build multi-key lookup maps for existing device tracks:
        // 1. By ID
        // 2. By canonical MediaStore content URI
        // 3. By raw physical file system path (exact file identity)
        // 4. By canonical filePath
        const existingById = new Map<string, Song>();
        const existingByUri = new Map<string, Song>();
        const existingByRawPath = new Map<string, Song>();
        const existingByFilePath = new Map<string, Song>();

        for (const s of existingDeviceSongs) {
          existingById.set(s.id, s);
          const uri = s.contentUri || (s.path && s.path.startsWith('content://') ? s.path : null);
          if (uri) existingByUri.set(uri, s);
          const raw = (s as any).rawFileSystemPath;
          if (raw && typeof raw === 'string' && raw.length > 0) {
            existingByRawPath.set(raw, s);
          }
          if (s.filePath && typeof s.filePath === 'string' && s.filePath.length > 0 && !s.filePath.startsWith('content://')) {
            existingByFilePath.set(s.filePath, s);
          }
        }

        const scannedProcessedIds = new Set<string>();
        let addedCount = 0;
        let updatedCount = 0;

        for (const scanned of scannedSongs) {
          const canonicalUri = scanned.contentUri || (scanned.path && scanned.path.startsWith('content://') ? scanned.path : null);
          const rawPath = (scanned as any).rawFileSystemPath;
          const filePath = scanned.filePath && !scanned.filePath.startsWith('content://') ? scanned.filePath : null;

          // Stable identifier resolution (Rule 3: NEVER merge based only on title/artist/duration)
          const existing =
            existingById.get(scanned.id) ||
            (canonicalUri ? existingByUri.get(canonicalUri) : undefined) ||
            (rawPath ? existingByRawPath.get(rawPath) : undefined) ||
            (filePath ? existingByFilePath.get(filePath) : undefined);

          if (!existing) {
            // Genuinely NEW song: insert into database
            const newSong = normalizeSong({
              ...scanned,
              isOnline: false,
              playCount: 0,
              isFavorite: false,
              dateAdded: scanned.dateAdded || Date.now()
            });
            store.put(newSong);
            scannedProcessedIds.add(newSong.id);
            addedCount++;

            // Intra-batch deduplication: register immediately so duplicate rows in the same scan batch are merged
            existingById.set(newSong.id, newSong);
            if (canonicalUri) existingByUri.set(canonicalUri, newSong);
            if (rawPath) existingByRawPath.set(rawPath, newSong);
            if (filePath) existingByFilePath.set(filePath, newSong);
          } else {
            // Check if already processed in this current scan batch (intra-batch duplicate)
            if (scannedProcessedIds.has(existing.id) || (existing.id !== scanned.id && scannedProcessedIds.has(scanned.id))) {
              continue;
            }

            // EXISTING song: evaluate whether metadata actually changed
            const normStr = (val?: string) => (val || '').trim();
            const isTitleDiff = normStr(existing.title) !== normStr(scanned.title);
            const isArtistDiff = normStr(existing.artist) !== normStr(scanned.artist);
            const isAlbumDiff = normStr(existing.album) !== normStr(scanned.album);
            const isDurDiff = Math.abs((existing.duration || 0) - (scanned.duration || 0)) > 1.5;
            const isFolderDiff = normStr(existing.folder) !== normStr(scanned.folder);
            const isArtworkNew = Boolean(scanned.artwork && !existing.artwork);
            const isDateModDiff = Boolean(
              scanned.lastModified &&
              existing.lastModified &&
              Math.abs(scanned.lastModified - existing.lastModified) > 1000
            );

            const isModified =
              isTitleDiff ||
              isArtistDiff ||
              isAlbumDiff ||
              isDurDiff ||
              isFolderDiff ||
              isArtworkNew ||
              isDateModDiff;

            const targetId = scanned.id || existing.id;
            const merged: Song = normalizeSong({
              ...existing,
              id: targetId,
              title: scanned.title || existing.title,
              artist: scanned.artist || existing.artist,
              album: scanned.album || existing.album,
              duration: scanned.duration > 0 ? scanned.duration : existing.duration,
              path: scanned.path || existing.path,
              filePath: scanned.filePath || existing.filePath,
              contentUri: scanned.contentUri || existing.contentUri || scanned.path,
              rawFileSystemPath: rawPath || (existing as any).rawFileSystemPath || '',
              folder: scanned.folder || existing.folder,
              fileSize: scanned.fileSize > 0 ? scanned.fileSize : existing.fileSize,
              format: scanned.format || existing.format,
              bitrate: scanned.bitrate || existing.bitrate,
              artwork: scanned.artwork || existing.artwork,
              coverArt: scanned.artwork || existing.artwork,
              lastModified: scanned.lastModified || existing.lastModified,
              isOnline: false,
              // Strictly preserve user preferences & engagement
              isFavorite: existing.isFavorite,
              playCount: existing.playCount,
              lastPlayedAt: existing.lastPlayedAt,
              lastPlayed: existing.lastPlayed,
              dateAdded: existing.dateAdded || scanned.dateAdded || Date.now(),
              lyrics: existing.lyrics || scanned.lyrics
            });

            if (isModified || existing.id !== merged.id) {
              store.put(merged);
              if (isModified) {
                updatedCount++;
              }
            }

            scannedProcessedIds.add(merged.id);

            // If the old record had a different ID, delete the redundant old record to prevent duplicates
            if (existing.id !== merged.id) {
              store.delete(existing.id);
            }

            // Update lookup maps for subsequent items in the batch
            existingById.set(merged.id, merged);
            if (canonicalUri) existingByUri.set(canonicalUri, merged);
            if (rawPath) existingByRawPath.set(rawPath, merged);
            if (filePath) existingByFilePath.set(filePath, merged);
          }
        }

        // Detect stale device records that no longer exist on device
        let removedCount = 0;
        for (const existing of existingDeviceSongs) {
          const canonicalUri = existing.contentUri || (existing.path && existing.path.startsWith('content://') ? existing.path : null);
          const raw = (existing as any).rawFileSystemPath;
          const stillInScan =
            scannedProcessedIds.has(existing.id) ||
            (canonicalUri && scannedSongs.some((s) => (s.contentUri || s.path) === canonicalUri)) ||
            (raw && scannedSongs.some((s) => (s as any).rawFileSystemPath === raw));

          if (!stillInScan) {
            store.delete(existing.id);
            removedCount++;
          }
        }

        tx.oncomplete = () => {
          const survivingTotal = Math.max(0, existingDeviceSongs.length + addedCount - removedCount);
          resolve({
            added: addedCount,
            updated: updatedCount,
            removed: removedCount,
            total: survivingTotal
          });
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  async updateSongFavorite(id: string, isFavorite: boolean): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const song = getReq.result;
        if (song) {
          song.isFavorite = isFavorite;
          store.put(song);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateSongLyrics(id: string, lyrics: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const song = getReq.result;
        if (song) {
          song.lyrics = lyrics;
          store.put(song);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateSongDownloadStatus(
    id: string,
    isDownloaded: boolean,
    downloadedAt?: number,
    fileSize?: number
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const song = getReq.result;
        if (song) {
          song.isDownloaded = isDownloaded;
          if (downloadedAt !== undefined) song.downloadedAt = downloadedAt;
          if (fileSize !== undefined) song.fileSize = fileSize;
          store.put(song);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getDownloadedSongs(): Promise<Song[]> {
    const songs = await this.getAllSongs();
    return songs.filter((s) => Boolean(s.isDownloaded));
  }

  // BUG-21 fix: Atomic transaction over songs and history stores to prevent race condition
  async incrementPlayCount(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(['songs', 'history'], 'readwrite');
        const songStore = tx.objectStore('songs');
        const historyStore = tx.objectStore('history');

        const getReq = songStore.get(id);
        getReq.onsuccess = () => {
          const song = getReq.result;
          if (song) {
            const now = Date.now();
            song.playCount = (song.playCount || 0) + 1;
            song.lastPlayedAt = now;
            song.lastPlayed = now; // Compatibility
            songStore.put(song);
            historyStore.add({
              songId: id,
              timestamp: now
            });
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (err) {
        console.warn('Play count increment notice:', err);
        resolve();
      }
    });
  }

  async getRecentHistory(limit = 50): Promise<Array<{ songId: string; timestamp: number }>> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('history', 'readonly');
      const store = tx.objectStore('history');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as Array<{ songId: string; timestamp: number }>;
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list.slice(0, limit));
      };
      req.onerror = () => resolve([]);
    });
  }

  async deleteSong(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteSongsBatch(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllSongs(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['songs', 'history'], 'readwrite');
      tx.objectStore('songs').clear();
      tx.objectStore('history').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- PLAYLISTS OPERATIONS ---
  async getAllPlaylists(): Promise<Playlist[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readonly');
      const store = tx.objectStore('playlists');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async savePlaylist(playlist: Playlist): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      const req = store.put(playlist);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deletePlaylist(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- STATS & HEALTH ---
  async getDetailedHealth(): Promise<LibraryHealth> {
    const songs = await this.getAllSongs();
    return calculateLibraryHealth(songs);
  }

  async getLibraryStats(): Promise<LibraryStats> {
    const songs = await this.getAllSongs();
    const playlists = await this.getAllPlaylists();
    const health = calculateLibraryHealth(songs);

    const artists = new Set<string>();
    const albums = new Set<string>();
    for (const s of songs) {
      if (s.artist && s.artist !== 'Not set' && s.artist !== 'Unknown Artist') artists.add(s.artist);
      if (s.album && s.album !== 'Not set' && s.album !== 'Unknown Album') albums.add(s.album);
    }

    return healthToLegacyStats(health, artists.size, albums.size, playlists.length);
  }

  // --- SETTINGS OPERATIONS ---
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && 'value' in req.result) {
          resolve(req.result.value as T);
        } else {
          resolve(defaultValue);
        }
      };
      req.onerror = () => resolve(defaultValue);
    });
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async saveSetting<T>(key: string, value: T): Promise<void> {
    return this.setSetting<T>(key, value);
  }

  async deleteSetting(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- PLAYBACK SESSION PERSISTENCE ---
  async savePlaybackSession(session: PlaybackSession): Promise<void> {
    return this.setSetting<PlaybackSession>(AURA_PLAYBACK_SESSION_KEY, session);
  }

  async getPlaybackSession(): Promise<PlaybackSession | null> {
    return this.getSetting<PlaybackSession | null>(AURA_PLAYBACK_SESSION_KEY, null);
  }

  async clearPlaybackSession(): Promise<void> {
    return this.deleteSetting(AURA_PLAYBACK_SESSION_KEY);
  }
}

export const AURA_PLAYBACK_SESSION_KEY = 'aura_playback_session';
export const AURA_USER_AFFINITY_KEY = 'aura_user_affinity';
export const AURA_PERSISTENT_SKIPS_KEY = 'aura_persistent_skips';
export const AURA_DISCOVERY_PREFERENCE_KEY = 'aura_discovery_preference';
export const musicDB = new MusicDatabase();
