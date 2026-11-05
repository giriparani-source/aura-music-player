import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Song, DuplicateGroup } from '../../types/music';
import { musicDB, DeviceScanSummary } from '../db';
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
    this.records.set(item.id, item);
    const req: any = { result: item.id, onsuccess: null, onerror: null };
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

describe('Incremental Local Music Scan & MediaStore Sync Suite', () => {
  let mockStore: MockObjectStore;
  let mockDbInstance: any;

  beforeEach(() => {
    mockStore = new MockObjectStore();

    mockDbInstance = {
      objectStoreNames: { contains: () => true },
      transaction: (storeNames: string | string[], mode: string) => {
        let oncompleteHandler: (() => void) | null = null;
        const tx: any = {
          objectStore: () => mockStore,
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
  });

  const createScannedSong = (id: number, title: string, duration: number = 210, fileSize: number = 5000000): Song => ({
    id: `device_${id}`,
    title,
    artist: 'Dev Artist',
    album: 'Dev Album',
    duration,
    path: `content://media/external/audio/media/${id}`,
    filePath: `content://media/external/audio/media/${id}`,
    contentUri: `content://media/external/audio/media/${id}`,
    folder: 'Phone Audio',
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

  it('1. Fresh installation starts with 0 songs in DB (no demo/cloud songs seeded)', async () => {
    const songs = await musicDB.getAllSongs();
    expect(songs.length).toBe(0);
    expect(songs.some((s) => s.id.startsWith('cloud_track_'))).toBe(false);
    expect(songs.some((s) => s.id.startsWith('saavn_'))).toBe(false);
  });

  it('2. Initial scan of 435 device tracks inserts all 435 with valid content:// URIs', async () => {
    const scanned435: Song[] = [];
    for (let i = 1; i <= 435; i++) {
      scanned435.push(createScannedSong(i, `Device Track ${i}`));
    }

    const summary: DeviceScanSummary = await musicDB.syncDeviceSongs(scanned435);

    expect(summary.added).toBe(435);
    expect(summary.updated).toBe(0);
    expect(summary.removed).toBe(0);
    expect(summary.total).toBe(435);

    // Verify actual database contents
    const storedSongs = await musicDB.getAllSongs();
    expect(storedSongs.length).toBe(435);
    expect(storedSongs[0].contentUri).toBe('content://media/external/audio/media/1');
    expect(storedSongs[0].path.startsWith('content://')).toBe(true);
    expect(storedSongs[434].contentUri).toBe('content://media/external/audio/media/435');
  });

  it('3. Repeated scans on unchanged library are 100% idempotent (0 added, 0 removed)', async () => {
    const scanned435: Song[] = [];
    for (let i = 1; i <= 435; i++) {
      scanned435.push(createScannedSong(i, `Device Track ${i}`));
    }

    // First scan
    await musicDB.syncDeviceSongs(scanned435);

    // Second scan (exact same items)
    const repeatSummary = await musicDB.syncDeviceSongs(scanned435);
    expect(repeatSummary.added).toBe(0);
    expect(repeatSummary.updated).toBe(0);
    expect(repeatSummary.removed).toBe(0);
    expect(repeatSummary.total).toBe(435);

    // Third scan (still unchanged)
    const thirdSummary = await musicDB.syncDeviceSongs(scanned435);
    expect(thirdSummary.added).toBe(0);
    expect(thirdSummary.total).toBe(435);

    // Verify database count never doubled to 870 or 902
    const totalStored = await musicDB.getAllSongs();
    expect(totalStored.length).toBe(435);
  });

  it('4. Incremental download adds ONLY genuinely new songs (435 + 4 = 439)', async () => {
    const initialList: Song[] = [];
    for (let i = 1; i <= 435; i++) {
      initialList.push(createScannedSong(i, `Device Track ${i}`));
    }
    await musicDB.syncDeviceSongs(initialList);

    // User downloads 4 new songs
    const updatedList = [...initialList];
    for (let i = 436; i <= 439; i++) {
      updatedList.push(createScannedSong(i, `New Download Track ${i}`));
    }

    const nextSummary = await musicDB.syncDeviceSongs(updatedList);
    expect(nextSummary.added).toBe(4);
    expect(nextSummary.updated).toBe(0);
    expect(nextSummary.removed).toBe(0);
    expect(nextSummary.total).toBe(439);

    const stored = await musicDB.getAllSongs();
    expect(stored.length).toBe(439);
  });

  it('5. Stale file deletion outside app removes entry from index without deleting other songs', async () => {
    const initialList: Song[] = [];
    for (let i = 1; i <= 435; i++) {
      initialList.push(createScannedSong(i, `Track ${i}`));
    }
    await musicDB.syncDeviceSongs(initialList);

    // User deleted Track 10 and Track 20 from their phone storage
    const listAfterDeletion = initialList.filter((s) => s.id !== 'device_10' && s.id !== 'device_20');

    const summaryAfterDelete = await musicDB.syncDeviceSongs(listAfterDeletion);
    expect(summaryAfterDelete.added).toBe(0);
    expect(summaryAfterDelete.removed).toBe(2);
    expect(summaryAfterDelete.total).toBe(433);

    const stored = await musicDB.getAllSongs();
    expect(stored.length).toBe(433);
    expect(stored.find((s) => s.id === 'device_10')).toBeUndefined();
    expect(stored.find((s) => s.id === 'device_20')).toBeUndefined();
    expect(stored.find((s) => s.id === 'device_1')).toBeDefined();
  });

  it('6. Metadata update updates record while strictly preserving user favorites and play counts', async () => {
    const song = createScannedSong(1, 'Original Title', 200);
    await musicDB.syncDeviceSongs([song]);

    // User marked song as favorite and played it 5 times
    await musicDB.updateSongFavorite(song.id, true);
    const existing = await musicDB.getSongById(song.id);
    if (existing) {
      existing.playCount = 5;
      await musicDB.saveSong(existing);
    }

    // MediaStore scan discovers updated album title & duration
    const scannedUpdate = createScannedSong(1, 'Updated Title (Remastered)', 205);
    scannedUpdate.lastModified = 1799999999999;

    const summary = await musicDB.syncDeviceSongs([scannedUpdate]);
    expect(summary.added).toBe(0);
    expect(summary.updated).toBe(1);

    const updatedSong = await musicDB.getSongById(song.id);
    expect(updatedSong).toBeDefined();
    expect(updatedSong?.title).toBe('Updated Title (Remastered)');
    expect(updatedSong?.duration).toBe(205);
    // User preferences MUST be preserved!
    expect(updatedSong?.isFavorite).toBe(true);
    expect(updatedSong?.playCount).toBe(5);
  });

  it('7. Duplicate detection identifies duplicates and batch removal deletes only confirmed copies', async () => {
    const song1 = createScannedSong(101, 'Vaathi Coming', 230, 8000000);
    // Exact duplicate copy with slightly different filename suffix
    const song2 = createScannedSong(102, 'Vaathi Coming (1)', 230, 8000000);
    // Distinct third song
    const song3 = createScannedSong(103, 'Master The Blaster', 180, 6000000);

    await musicDB.syncDeviceSongs([song1, song2, song3]);

    const allSongs = await musicDB.getAllSongs();
    const duplicateGroups: DuplicateGroup[] = detectDuplicates(allSongs);

    expect(duplicateGroups.length).toBe(1);
    expect(duplicateGroups[0].songs.length).toBe(2);
    expect(duplicateGroups[0].canonicalTitle).toBe('Vaathi Coming');

    // User reviews group and selects song2 (the copy) to delete
    const idsToDelete = [song2.id];
    await musicDB.deleteSongsBatch(idsToDelete);

    const remaining = await musicDB.getAllSongs();
    expect(remaining.length).toBe(2);
    expect(remaining.some((s) => s.id === song1.id)).toBe(true);
    expect(remaining.some((s) => s.id === song2.id)).toBe(false);
    expect(remaining.some((s) => s.id === song3.id)).toBe(true);
  });

  it('8. Playback URI integrity check: Android content:// URIs are preserved without WebView conversion', async () => {
    const song = createScannedSong(999, 'Hukum Content Track');
    await musicDB.syncDeviceSongs([song]);

    const retrieved = await musicDB.getSongById(song.id);
    expect(retrieved?.path).toBe('content://media/external/audio/media/999');
    expect(retrieved?.contentUri).toBe('content://media/external/audio/media/999');
    expect(retrieved?.path.startsWith('https://localhost/_capacitor_file_')).toBe(false);
  });
});
