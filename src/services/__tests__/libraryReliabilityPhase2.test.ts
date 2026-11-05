import { describe, it, expect, beforeEach } from 'vitest';
import { Song, Playlist } from '../../types/music';
import { musicDB, DeviceScanSummary } from '../db';
import { useLibraryStore, onlineSongRegistry, getOnlineSong } from '../../store/useLibraryStore';
import { isLocalDeviceSong, isStreamingPreset } from '../../utils/songUtils';
import { detectDuplicates } from '../duplicateService';

// Lightweight in-memory IDB simulation for Node test environment
class MockObjectStore {
  records = new Map<string, any>();

  getAll() {
    const req: any = { result: Array.from(this.records.values()), onsuccess: null, onerror: null };
    queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
    return req;
  }

  get(id: string) {
    const req: any = { result: this.records.get(id), onsuccess: null, onerror: null };
    queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
    return req;
  }

  put(item: any) {
    const key = item.id || item.key;
    this.records.set(key, item);
    const req: any = { result: key, onsuccess: null, onerror: null };
    queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
    return req;
  }

  delete(id: string) {
    this.records.delete(id);
    const req: any = { result: undefined, onsuccess: null, onerror: null };
    queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
    return req;
  }

  clear() {
    this.records.clear();
  }
}

describe('Phase 2: Local Music & Library Reliability Suite', () => {
  let songsStore: MockObjectStore;
  let playlistsStore: MockObjectStore;
  let settingsStore: MockObjectStore;
  let mockDbInstance: any;

  beforeEach(() => {
    songsStore = new MockObjectStore();
    playlistsStore = new MockObjectStore();
    settingsStore = new MockObjectStore();

    mockDbInstance = {
      objectStoreNames: { contains: () => true },
      transaction: (storeNames: string | string[], mode: string) => {
        const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
        let oncompleteHandler: (() => void) | null = null;
        const tx: any = {
          objectStore: (name: string) => {
            if (name === 'songs') return songsStore;
            if (name === 'playlists') return playlistsStore;
            if (name === 'settings') return settingsStore;
            return songsStore;
          },
          get oncomplete() {
            return oncompleteHandler;
          },
          set oncomplete(cb: any) {
            oncompleteHandler = cb;
            if (cb) {
              setTimeout(() => {
                if (oncompleteHandler) oncompleteHandler();
              }, 5);
            }
          },
          onerror: null,
        };
        return tx;
      }
    };

    (musicDB as any).db = mockDbInstance;
    (musicDB as any).initPromise = Promise.resolve(mockDbInstance);
    onlineSongRegistry.clear();
  });

  const makeSong = (overrides: Partial<Song>): Song => {
    const id = overrides.id || `song_${Math.random().toString(36).slice(2)}`;
    return {
      id,
      title: overrides.title || 'Sample Title',
      artist: overrides.artist || 'Sample Artist',
      album: overrides.album || 'Sample Album',
      fileName: overrides.fileName || `${overrides.title || 'Sample'}.mp3`,
      path: overrides.path || `/songs/${id}.mp3`,
      filePath: overrides.filePath || overrides.path || `/songs/${id}.mp3`,
      contentUri: overrides.contentUri || overrides.path || `content://media/external/audio/media/${id}`,
      duration: overrides.duration ?? 210,
      fileSize: overrides.fileSize ?? 5000000,
      format: overrides.format || 'mp3',
      bitrate: overrides.bitrate || 320,
      playCount: overrides.playCount || 0,
      dateAdded: overrides.dateAdded || Date.now(),
      isFavorite: overrides.isFavorite || false,
      ...overrides
    };
  };

  const createScannedSong = (id: number, title: string, duration: number = 200, fileSize: number = 5000000): Song =>
    makeSong({
      id: `device_${id}`,
      title,
      artist: 'Anirudh',
      album: 'Album A',
      duration,
      path: `content://media/external/audio/media/${id}`,
      filePath: `content://media/external/audio/media/${id}`,
      contentUri: `content://media/external/audio/media/${id}`,
      folder: 'Phone Storage',
      fileName: `${title}.mp3`,
      format: 'mp3',
      bitrate: 320,
      fileSize,
      dateAdded: 1700000000000 + id,
      lastModified: 1700000000000 + id,
      playCount: 0,
      isFavorite: false,
      isOnline: false
    });

  /* -------------------------------------------------------------------------- */
  /* Requirement 1 & 7: Online Song Persistence & Isolation                      */
  /* -------------------------------------------------------------------------- */
  describe('1. Online song persistence & library isolation', () => {
    it('registerOnlineSong registers in-memory only and never persists into musicDB', async () => {
      const streamingSong: Song = makeSong({
        id: 'saavn_online_123',
        title: 'Streaming Hit',
        artist: 'Online Artist',
        album: 'Online Album',
        duration: 215,
        path: 'https://aac.saavncdn.com/123/stream.mp4',
        isOnline: true,
        playCount: 0,
        isFavorite: false,
        dateAdded: Date.now()
      });

      const libraryStore = useLibraryStore.getState();
      libraryStore.registerOnlineSong(streamingSong);

      // In-memory lookup succeeds for player / queue lookups
      const retrieved = getOnlineSong('saavn_online_123');
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Streaming Hit');

      // Database remains 100% clean
      const dbSongs = await musicDB.getAllSongs();
      expect(dbSongs.length).toBe(0);
      expect(dbSongs.find((s) => s.id === 'saavn_online_123')).toBeUndefined();
    });

    it('songUtils distinguishes local device songs from online streaming tracks', () => {
      const localDeviceSong = createScannedSong(1, 'Local Song');
      const downloadedOnlineSong: Song = makeSong({
        id: 'saavn_dl_1',
        title: 'Downloaded Hit',
        artist: 'Artist',
        path: '/storage/emulated/0/Download/Aura/hit.mp3',
        filePath: '/storage/emulated/0/Download/Aura/hit.mp3',
        isDownloaded: true,
        isOnline: false,
        duration: 180,
        dateAdded: Date.now()
      });
      const streamingSong: Song = makeSong({
        id: 'saavn_stream_1',
        title: 'Live Stream',
        artist: 'Artist',
        path: 'https://example.com/audio.mp3',
        isDownloaded: false,
        isOnline: true,
        duration: 200,
        dateAdded: Date.now()
      });

      expect(isLocalDeviceSong(localDeviceSong)).toBe(true);
      expect(isLocalDeviceSong(downloadedOnlineSong)).toBe(true);
      expect(isLocalDeviceSong(streamingSong)).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Requirement 2 & 4: Safe Reversible Legacy Migration                         */
  /* -------------------------------------------------------------------------- */
  describe('2. Safe legacy-data classification & reversible migration', () => {
    it('migration cleans unseeded presets but strictly preserves user favorites, playlists, and play counts', async () => {
      // 1. Unseeded preset with 0 plays, no favorites, not in any playlist
      const unseededPreset: Song = makeSong({
        id: 'saavn_preset_hukum',
        title: 'Hukum',
        artist: 'Anirudh',
        path: 'https://saavn.com/hukum.mp3',
        isOnline: true,
        playCount: 0,
        isFavorite: false,
        dateAdded: Date.now()
      });

      // 2. Preset that the user favorited
      const favoritedPreset: Song = makeSong({
        id: 'saavn_preset_favorite',
        title: 'Favorited Preset Song',
        artist: 'Anirudh',
        path: 'https://saavn.com/fav.mp3',
        isOnline: true,
        playCount: 0,
        isFavorite: true,
        dateAdded: Date.now()
      });

      // 3. Preset that the user played
      const playedPreset: Song = makeSong({
        id: 'saavn_preset_played',
        title: 'Played Preset Song',
        artist: 'Anirudh',
        path: 'https://saavn.com/play.mp3',
        isOnline: true,
        playCount: 3,
        isFavorite: false,
        dateAdded: Date.now()
      });

      // 4. Preset in a user playlist
      const playlistPreset: Song = makeSong({
        id: 'saavn_preset_in_playlist',
        title: 'Playlist Track',
        artist: 'Anirudh',
        path: 'https://saavn.com/playlist.mp3',
        isOnline: true,
        playCount: 0,
        isFavorite: false,
        dateAdded: Date.now()
      });

      // 5. Genuine local device song
      const localSong = createScannedSong(1, 'Actual Device Song');

      // Populate mock DB
      await musicDB.saveSong(unseededPreset);
      await musicDB.saveSong(favoritedPreset);
      await musicDB.saveSong(playedPreset);
      await musicDB.saveSong(playlistPreset);
      await musicDB.saveSong(localSong);

      // Create playlist containing playlistPreset
      const testPlaylist: Playlist = {
        id: 'pl_favorites',
        name: 'My Custom Playlist',
        songIds: ['saavn_preset_in_playlist'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await musicDB.savePlaylist(testPlaylist);

      // Run loadLibrary which executes safe migration
      const libraryStore = useLibraryStore.getState();
      await libraryStore.loadLibrary();

      const remainingSongs = await musicDB.getAllSongs();

      // Unseeded preset must be removed from DB
      expect(remainingSongs.find((s) => s.id === 'saavn_preset_hukum')).toBeUndefined();

      // SAFETY: User-engaged tracks MUST be preserved!
      expect(remainingSongs.find((s) => s.id === 'saavn_preset_favorite')).toBeDefined();
      expect(remainingSongs.find((s) => s.id === 'saavn_preset_played')).toBeDefined();
      expect(remainingSongs.find((s) => s.id === 'saavn_preset_in_playlist')).toBeDefined();
      expect(remainingSongs.find((s) => s.id === 'device_1')).toBeDefined();

      // Check migration backup snapshot in settings
      const backupSetting = await musicDB.getSetting<{ timestamp: number; backedUpSongs: Song[] } | null>(
        'migration_backup_unseeded_presets',
        null
      );
      expect(backupSetting).toBeDefined();
      expect(backupSetting && Array.isArray(backupSetting.backedUpSongs)).toBe(true);
      expect(backupSetting?.backedUpSongs.some((s: any) => s.id === 'saavn_preset_hukum')).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Requirement 3: Stable Device-Song Matching & Intra-Batch Deduplication      */
  /* -------------------------------------------------------------------------- */
  describe('3. Stable device-song matching & intra-batch deduplication', () => {
    it('deduplicates duplicate scanner outputs in a single batch safely', async () => {
      const song1 = createScannedSong(1, 'Song 1');
      // Duplicate scanner emitted item with same contentUri in same batch
      const song1Dup = { ...song1, id: 'temp_batch_id_1' };
      const song2 = createScannedSong(2, 'Song 2');

      const summary = await musicDB.syncDeviceSongs([song1, song1Dup, song2]);
      expect(summary.added).toBe(2);
      expect(summary.total).toBe(2);

      const all = await musicDB.getAllSongs();
      expect(all.length).toBe(2);
    });

    it('NEVER merges two distinct files based solely on title, artist, and rounded duration', async () => {
      // Two distinct takes or separate files with same title and artist and same duration
      const take1: Song = {
        ...createScannedSong(10, 'Same Song Title', 180),
        contentUri: 'content://media/external/audio/media/10',
        path: 'content://media/external/audio/media/10'
      };
      const take2: Song = {
        ...createScannedSong(20, 'Same Song Title', 180),
        contentUri: 'content://media/external/audio/media/20',
        path: 'content://media/external/audio/media/20'
      };

      await musicDB.syncDeviceSongs([take1, take2]);

      const stored = await musicDB.getAllSongs();
      expect(stored.length).toBe(2);
      expect(stored.some(s => s.contentUri === 'content://media/external/audio/media/10')).toBe(true);
      expect(stored.some(s => s.contentUri === 'content://media/external/audio/media/20')).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Requirement 4 & 8: Scan Statistics, Idempotency & Failure Safety           */
  /* -------------------------------------------------------------------------- */
  describe('4. Scan statistics, idempotency & failure safety', () => {
    it('rescan on unchanged library produces added:0, updated:0, removed:0', async () => {
      const songs: Song[] = [
        createScannedSong(1, 'Track 1'),
        createScannedSong(2, 'Track 2'),
        createScannedSong(3, 'Track 3')
      ];

      const initial = await musicDB.syncDeviceSongs(songs);
      expect(initial.added).toBe(3);
      expect(initial.updated).toBe(0);

      // Rescan identical tracks
      const rescan = await musicDB.syncDeviceSongs(songs);
      expect(rescan.added).toBe(0);
      expect(rescan.updated).toBe(0);
      expect(rescan.removed).toBe(0);
      expect(rescan.total).toBe(3);
    });

    it('zero-scan safety guard: empty scan (permission denied / error) preserves library and does not delete songs', async () => {
      const songs: Song[] = [
        createScannedSong(1, 'Track 1'),
        createScannedSong(2, 'Track 2')
      ];
      await musicDB.syncDeviceSongs(songs);

      // Scanner fails or user denied permission returning empty array
      const emptyResult = await musicDB.syncDeviceSongs([]);
      expect(emptyResult.added).toBe(0);
      expect(emptyResult.updated).toBe(0);
      expect(emptyResult.removed).toBe(0);
      expect(emptyResult.total).toBe(2);

      // Library is still completely intact!
      const stored = await musicDB.getAllSongs();
      expect(stored.length).toBe(2);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Requirement 5 & 6: Duplicate Detection & Manual Review Flow                 */
  /* -------------------------------------------------------------------------- */
  describe('5. Duplicate detection & audio quality scoring', () => {
    it('does not flag generic titles like "Intro" or "Track 01" as duplicates if artists differ or are generic', () => {
      const songs: Song[] = [
        {
          ...createScannedSong(1, 'Intro', 60),
          artist: 'Artist A'
        },
        {
          ...createScannedSong(2, 'Intro', 60),
          artist: 'Artist B'
        },
        {
          ...createScannedSong(3, 'Track 01', 120),
          artist: 'Unknown Artist'
        },
        {
          ...createScannedSong(4, 'Track 01', 120),
          artist: 'Unknown'
        }
      ];

      const duplicates = detectDuplicates(songs);
      expect(duplicates.length).toBe(0);
    });

    it('recommends keeping higher audio density file over nominal bitrate tag alone', () => {
      // Nominal 320k tag but small fileSize (1 MB for 3 min = 45 kbps)
      const fake320k: Song = {
        ...createScannedSong(1, 'Master Song', 180, 1000000),
        bitrate: 320,
        format: 'mp3'
      };
      // Genuine 256k file (6 MB for 3 min = 266 kbps)
      const real256k: Song = {
        ...createScannedSong(2, 'Master Song', 180, 6000000),
        bitrate: 256,
        format: 'm4a'
      };

      const duplicates = detectDuplicates([fake320k, real256k]);
      expect(duplicates.length).toBe(1);
      expect(duplicates[0].recommendedKeepSongId).toBe(real256k.id);
    });

    it('deterministic tie breaking selects longest duration then lowest ID', () => {
      const s1 = createScannedSong(10, 'Identical Song', 200, 5000000);
      const s2 = createScannedSong(20, 'Identical Song', 200, 5000000);

      const duplicates = detectDuplicates([s1, s2]);
      expect(duplicates.length).toBe(1);
      // Both equal quality, engagement, and duration -> picks lower ID 'device_10'
      expect(duplicates[0].recommendedKeepSongId).toBe('device_10');
    });
  });
});
