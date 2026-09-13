import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadService, OFFLINE_AUDIO_CACHE } from '../downloadService';
import { musicDB } from '../db';
import { Song } from '../../types/music';

describe('downloadService', () => {
  let mockCacheStorage: Map<string, Response>;
  let mockCache: {
    match: any;
    put: any;
    delete: any;
    keys: any;
  };
  let mockCaches: {
    open: any;
    delete: any;
  };

  const sampleSong: Song = {
    id: 'test-song-1',
    title: 'Naan Pogiren',
    artist: 'S. P. Balasubrahmanyam',
    album: 'Tamil Classics',
    duration: 240,
    filePath: 'https://example.com/audio/naan-pogiren.mp3',
    path: 'https://example.com/audio/naan-pogiren.mp3',
    fileName: 'naan-pogiren.mp3',
    format: 'mp3',
    fileSize: 1024 * 1024 * 5,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    isOnline: true,
    isSaavn: true
  };

  beforeEach(() => {
    mockCacheStorage = new Map();

    mockCache = {
      match: vi.fn(async (request: string) => {
        const res = mockCacheStorage.get(request);
        return res ? res.clone() : null;
      }),
      put: vi.fn(async (request: string, response: Response) => {
        mockCacheStorage.set(request, response);
      }),
      delete: vi.fn(async (request: string) => {
        return mockCacheStorage.delete(request);
      }),
      keys: vi.fn(async () => {
        return Array.from(mockCacheStorage.keys()).map((url) => new Request(url));
      })
    };

    mockCaches = {
      open: vi.fn(async (name: string) => {
        if (name === OFFLINE_AUDIO_CACHE) return mockCache as unknown as Cache;
        return mockCache as unknown as Cache;
      }),
      delete: vi.fn(async (name: string) => {
        if (name === OFFLINE_AUDIO_CACHE) {
          mockCacheStorage.clear();
          return true;
        }
        return false;
      })
    };

    // Attach global caches mock
    // @ts-ignore
    globalThis.caches = mockCaches;

    // Mock global URL createObjectURL and revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn((blob: Blob) => `blob:http://localhost/${Math.random()}`);
    globalThis.URL.revokeObjectURL = vi.fn();

    // Mock musicDB methods
    vi.spyOn(musicDB, 'saveSong').mockResolvedValue(undefined as any);
    vi.spyOn(musicDB, 'updateSongDownloadStatus').mockResolvedValue(undefined as any);
    vi.spyOn(musicDB, 'getDownloadedSongs').mockResolvedValue([
      { ...sampleSong, isDownloaded: true, fileSize: 1000 }
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with not-downloaded state and 0 progress', () => {
    expect(downloadService.getDownloadState('unknown-id')).toBe('not-downloaded');
    expect(downloadService.getDownloadProgress('unknown-id')).toBe(0);
  });

  it('checks if a track is downloaded via isTrackDownloaded', async () => {
    const isDownloadedBefore = await downloadService.isTrackDownloaded('test-song-1');
    expect(isDownloadedBefore).toBe(false);

    // Add entry to cache
    const key = `https://aura.local/offline-audio/test-song-1`;
    mockCacheStorage.set(key, new Response('fake-audio-content'));

    const isDownloadedAfter = await downloadService.isTrackDownloaded('test-song-1');
    expect(isDownloadedAfter).toBe(true);
  });

  it('downloads track successfully with progress reporting and cache storage', async () => {
    const chunk1 = new Uint8Array([1, 2, 3, 4]);
    const chunk2 = new Uint8Array([5, 6, 7, 8]);
    let chunkIndex = 0;

    const mockReadableStream = new ReadableStream({
      pull(controller) {
        if (chunkIndex === 0) {
          controller.enqueue(chunk1);
          chunkIndex++;
        } else if (chunkIndex === 1) {
          controller.enqueue(chunk2);
          chunkIndex++;
        } else {
          controller.close();
        }
      }
    });

    // Mock fetch response
    globalThis.fetch = vi.fn(async () => {
      return new Response(mockReadableStream, {
        status: 200,
        headers: {
          'Content-Length': '8',
          'Content-Type': 'audio/mpeg'
        }
      });
    });

    const progressReports: number[] = [];
    const success = await downloadService.downloadTrack(sampleSong, (pct) => {
      progressReports.push(pct);
    });

    expect(success).toBe(true);
    expect(progressReports.length).toBeGreaterThan(0);
    expect(progressReports[progressReports.length - 1]).toBe(100);

    // Verify cache.put was called
    expect(mockCache.put).toHaveBeenCalled();

    // Verify IndexedDB was updated with isDownloaded = true
    expect(musicDB.saveSong).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-song-1',
        isDownloaded: true
      })
    );
  });

  it('prevents duplicate concurrent downloads of the same track', async () => {
    let pullCount = 0;
    const slowStream = new ReadableStream({
      pull(controller) {
        if (pullCount === 0) {
          pullCount++;
          controller.enqueue(new Uint8Array([1, 2, 3]));
        } else {
          controller.close();
        }
      }
    });

    globalThis.fetch = vi.fn(async () => {
      return new Response(slowStream, {
        status: 200,
        headers: { 'Content-Length': '3', 'Content-Type': 'audio/mpeg' }
      });
    });

    const promise1 = downloadService.downloadTrack(sampleSong);
    const promise2 = downloadService.downloadTrack(sampleSong);

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect(res1).toBe(true);
    expect(res2).toBe(true);
    // fetch should only have been called once
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles fetch failure gracefully and returns false', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network offline or abort');
    });

    const failedSong: Song = {
      ...sampleSong,
      id: 'failed-song',
      filePath: 'https://example.com/audio/fail.mp3'
    };

    const success = await downloadService.downloadTrack(failedSong);
    expect(success).toBe(false);
    expect(downloadService.getDownloadState('failed-song')).toBe('failed');
  });

  it('retrieves cached audio as object URL and revokes properly', async () => {
    const key = `https://aura.local/offline-audio/test-song-1`;
    const fakeResponse = new Response(new Blob(['test-audio-data'], { type: 'audio/mpeg' }));
    mockCacheStorage.set(key, fakeResponse);

    const url1 = await downloadService.getCachedAudioUrl('test-song-1');
    expect(url1).toBeTruthy();
    expect(url1?.startsWith('blob:')).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Calling again returns the cached object URL without creating a duplicate
    const url2 = await downloadService.getCachedAudioUrl('test-song-1');
    expect(url2).toBe(url1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Revoking cached URL
    downloadService.revokeCachedAudioUrl('test-song-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url1);

    // Revoking non-existent track is safe
    downloadService.revokeCachedAudioUrl('test-song-1');
  });

  it('deletes downloaded track and cleans up cache and DB', async () => {
    const key = `https://aura.local/offline-audio/test-song-1`;
    mockCacheStorage.set(key, new Response('fake-audio'));

    // Create an object URL first
    await downloadService.getCachedAudioUrl('test-song-1');

    await downloadService.deleteDownloadedTrack('test-song-1');

    expect(mockCache.delete).toHaveBeenCalledWith(key);
    expect(musicDB.updateSongDownloadStatus).toHaveBeenCalledWith('test-song-1', false);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('clears all downloads and resets cache storage', async () => {
    const key1 = `https://aura.local/offline-audio/song-a`;
    const key2 = `https://aura.local/offline-audio/song-b`;
    mockCacheStorage.set(key1, new Response('audio-a'));
    mockCacheStorage.set(key2, new Response('audio-b'));

    vi.spyOn(musicDB, 'getDownloadedSongs').mockResolvedValue([
      { ...sampleSong, id: 'song-a', isDownloaded: true },
      { ...sampleSong, id: 'song-b', isDownloaded: true }
    ]);

    await downloadService.clearAllDownloads();

    expect(mockCaches.delete).toHaveBeenCalledWith(OFFLINE_AUDIO_CACHE);
    expect(musicDB.updateSongDownloadStatus).toHaveBeenCalledWith('song-a', false);
    expect(musicDB.updateSongDownloadStatus).toHaveBeenCalledWith('song-b', false);
  });

  it('calculates offline storage usage accurately', async () => {
    vi.spyOn(musicDB, 'getDownloadedSongs').mockResolvedValue([
      { ...sampleSong, id: 'song-1', isDownloaded: true, fileSize: 1024 * 1024 * 3 },
      { ...sampleSong, id: 'song-2', isDownloaded: true, fileSize: 1024 * 1024 * 4 }
    ]);

    const usage = await downloadService.getOfflineStorageUsage();
    expect(usage.songCount).toBe(2);
    expect(usage.totalBytes).toBe(1024 * 1024 * 7);
  });
});
