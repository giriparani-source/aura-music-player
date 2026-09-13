import { Song, Playlist, LibraryStats, LibraryHealth } from '../types/music';
import { calculateLibraryHealth, healthToLegacyStats } from './healthService';

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
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getSongById(id: string): Promise<Song | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSong(song: Song): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      const req = store.put(song);
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
        store.put(song);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateSongFavorite(id: string, isFavorite: boolean): Promise<void> {
    const song = await this.getSongById(id);
    if (song) {
      song.isFavorite = isFavorite;
      await this.saveSong(song);
    }
  }

  async updateSongLyrics(id: string, lyrics: string): Promise<void> {
    const song = await this.getSongById(id);
    if (song) {
      song.lyrics = lyrics;
      await this.saveSong(song);
    }
  }

  async updateSongDownloadStatus(
    id: string,
    isDownloaded: boolean,
    downloadedAt?: number,
    fileSize?: number
  ): Promise<void> {
    const song = await this.getSongById(id);
    if (song) {
      song.isDownloaded = isDownloaded;
      if (downloadedAt !== undefined) song.downloadedAt = downloadedAt;
      if (fileSize !== undefined) song.fileSize = fileSize;
      await this.saveSong(song);
    }
  }

  async getDownloadedSongs(): Promise<Song[]> {
    const songs = await this.getAllSongs();
    return songs.filter((s) => Boolean(s.isDownloaded));
  }

  async incrementPlayCount(id: string): Promise<void> {
    const song = await this.getSongById(id);
    if (song) {
      const now = Date.now();
      song.playCount = (song.playCount || 0) + 1;
      song.lastPlayedAt = now;
      song.lastPlayed = now; // Compatibility
      await this.saveSong(song);

      // Record in history table
      const db = await this.getDB();
      const tx = db.transaction('history', 'readwrite');
      tx.objectStore('history').add({
        songId: id,
        timestamp: now
      });
    }
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
}

export const AURA_USER_AFFINITY_KEY = 'aura_user_affinity';
export const AURA_PERSISTENT_SKIPS_KEY = 'aura_persistent_skips';
export const musicDB = new MusicDatabase();
