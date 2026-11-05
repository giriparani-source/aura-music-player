/**
 * src/services/downloadService.ts
 * Dedicated Offline Download & Cache Management Service for Aura Music Player.
 *
 * Uses browser-standard Cache Storage API ('aura-offline-audio-v1') for storing large audio stream responses,
 * paired with AuraMusicDB (IndexedDB) for persistent metadata.
 *
 * Automatically manages object URLs via URL.createObjectURL() and URL.revokeObjectURL()
 * to prevent browser memory leaks.
 */

import { Song, DownloadState } from '../types/music';
import { musicDB } from './db';
import { searchJioSaavn } from './jiosaavnService';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { resolveYoutubeAudioStream } from './youtubeAudioResolver';
import { androidMediaBridge } from './androidMediaBridge';

export const OFFLINE_AUDIO_CACHE = 'aura-offline-audio-v1';

export interface StorageUsage {
  songCount: number;
  totalBytes: number;
}

type DownloadListener = () => void;

class DownloadService {
  private inFlightDownloads: Map<string, Promise<boolean>> = new Map();
  private activeDownloads: Map<string, AbortController> = new Map();
  private downloadingProgress: Map<string, number> = new Map();
  private failedDownloads: Set<string> = new Set();
  private activeObjectUrls: Map<string, string> = new Map();
  private listeners: Set<DownloadListener> = new Set();

  private getCacheKey(songId: string): string {
    return `https://aura.local/offline-audio/${encodeURIComponent(songId)}`;
  }

  private async getCache(): Promise<Cache | null> {
    if (typeof caches === 'undefined') return null;
    try {
      return await caches.open(OFFLINE_AUDIO_CACHE);
    } catch (err) {
      console.warn('Could not open offline audio cache:', err);
      return null;
    }
  }

  public subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getDownloadState(songId: string): DownloadState {
    if (this.activeDownloads.has(songId)) {
      return 'downloading';
    }
    if (this.failedDownloads.has(songId)) {
      return 'failed';
    }
    return 'not-downloaded';
  }

  public getDownloadProgress(songId: string): number {
    return this.downloadingProgress.get(songId) || 0;
  }

  /**
   * Checks if audio is persistently stored in Cache Storage
   */
  public async isTrackDownloaded(songId: string): Promise<boolean> {
    const cache = await this.getCache();
    if (!cache) return false;
    try {
      const match = await cache.match(this.getCacheKey(songId));
      return Boolean(match);
    } catch {
      return false;
    }
  }

  /**
   * Identifies whether a song is a YouTube track
   */
  public isYouTubeSong(song: Song): boolean {
    const isYtUrl = (u?: string) => Boolean(u && (u.includes('youtube.com') || u.includes('youtu.be')));
    return Boolean(
      song.playbackMode === 'youtube-foreground' ||
      song.isForegroundOnly ||
      (song.sourceId && song.sourceId.length === 11) ||
      (song.id && (song.id.startsWith('online_') || song.id.startsWith('yt_'))) ||
      isYtUrl(song.filePath) ||
      isYtUrl(song.path)
    );
  }

  /**
   * Extracts the 11-char YouTube video ID from a song
   */
  public extractYouTubeVideoId(song: Song): string | null {
    if (song.sourceId && /^[a-zA-Z0-9_-]{11}$/.test(song.sourceId)) {
      return song.sourceId;
    }
    if (song.id && song.id.startsWith('online_')) {
      const vid = song.id.replace('online_', '').trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(vid)) {
        return vid;
      }
    }
    const combined = `${song.filePath || ''} ${song.path || ''}`;
    const match = combined.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    return null;
  }

  /**
   * Resolves the download stream URL for a given track
   */
  private async resolveDownloadUrl(song: Song): Promise<string | null> {
    const isYtUrl = (u?: string) => Boolean(u && (u.includes('youtube.com') || u.includes('youtu.be')));

    // 1. YouTube Track: Resolve direct M4A / WebM stream URL
    if (this.isYouTubeSong(song)) {
      const videoId = this.extractYouTubeVideoId(song);
      if (videoId) {
        try {
          const stream = await resolveYoutubeAudioStream(videoId);
          if (stream?.audioUrl) {
            return stream.audioUrl;
          }
        } catch (ytErr) {
          console.warn(`[DownloadService] Failed to resolve direct YouTube stream for "${song.title}":`, ytErr);
        }
      }
    }

    // 2. Direct HTTP Audio URL (ignoring YouTube watch URLs which are web pages)
    if (song.filePath && (song.filePath.startsWith('http://') || song.filePath.startsWith('https://') || song.filePath.startsWith('/api/')) && !isYtUrl(song.filePath)) {
      return song.filePath;
    }
    if (song.path && (song.path.startsWith('http://') || song.path.startsWith('https://') || song.path.startsWith('/api/')) && !isYtUrl(song.path)) {
      return song.path;
    }

    // 3. Try dynamic search resolution for online track
    if (song.title) {
      try {
        const results = await searchJioSaavn(song.title);
        if (results.length > 0 && results[0].filePath) {
          song.filePath = results[0].filePath;
          song.isSaavn = true;
          return results[0].filePath;
        }
      } catch (err) {
        console.warn('Could not resolve stream URL for download:', err);
      }
    }

    return null;
  }

  /**
   * Downloads an online song into Cache Storage and records metadata in IndexedDB.
   * Prevents duplicate simultaneous downloads.
   */
  public async downloadTrack(
    song: Song,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    const existing = this.inFlightDownloads.get(song.id);
    if (existing) {
      return existing;
    }

    const downloadPromise = this.performDownload(song, onProgress);
    this.inFlightDownloads.set(song.id, downloadPromise);
    try {
      return await downloadPromise;
    } finally {
      this.inFlightDownloads.delete(song.id);
    }
  }

  private async performDownload(
    song: Song,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    // Check if already downloaded
    const alreadyDownloaded = await this.isTrackDownloaded(song.id);
    if (alreadyDownloaded) {
      await musicDB.updateSongDownloadStatus(song.id, true);
      this.notify();
      return true;
    }

    const downloadUrl = await this.resolveDownloadUrl(song);
    if (!downloadUrl) {
      this.failedDownloads.add(song.id);
      this.notify();
      return false;
    }

    const abortController = new AbortController();
    this.activeDownloads.set(song.id, abortController);
    this.failedDownloads.delete(song.id);
    this.downloadingProgress.set(song.id, 0);
    this.notify();

    try {
      let blob: Blob;

      try {
        const response = await fetch(downloadUrl, {
          signal: abortController.signal,
          headers: {
            Accept: 'audio/*,*/*'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        const contentLengthHeader = response.headers.get('content-length');
        const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

        if (response.body && totalBytes > 0 && typeof ReadableStream !== 'undefined') {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let receivedBytes = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              receivedBytes += value.length;
              const pct = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
              this.downloadingProgress.set(song.id, pct);
              if (onProgress) onProgress(pct);
              this.notify();
            }
          }

          const mimeType = response.headers.get('content-type') || 'audio/mp4';
          blob = new Blob(chunks as any, { type: mimeType });
        } else {
          // Fallback for browsers or proxies without streaming headers
          blob = await response.blob();
          this.downloadingProgress.set(song.id, 100);
          if (onProgress) onProgress(100);
          this.notify();
        }
      } catch (fetchErr: any) {
        // Fallback for native Capacitor if fetch blocked by CORS or network
        if (Capacitor.isNativePlatform() && !abortController.signal.aborted) {
          console.log(`[DownloadService] Falling back to CapacitorHttp for track "${song.title}"`);
          const nativeRes = await CapacitorHttp.get({
            url: downloadUrl,
            responseType: 'blob'
          });
          if (nativeRes.status >= 200 && nativeRes.status < 300 && nativeRes.data) {
            blob = typeof nativeRes.data === 'string'
              ? new Blob([nativeRes.data], { type: 'audio/mp4' })
              : (nativeRes.data as Blob);
            this.downloadingProgress.set(song.id, 100);
            if (onProgress) onProgress(100);
            this.notify();
          } else {
            throw fetchErr;
          }
        } else {
          throw fetchErr;
        }
      }

      if (blob.size === 0) {
        throw new Error('Downloaded audio blob is empty');
      }

      // Store in Cache Storage
      const cache = await this.getCache();
      if (!cache) {
        throw new Error('Cache Storage is not supported or accessible');
      }

      const cacheKey = this.getCacheKey(song.id);
      const cacheResponse = new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': blob.type || 'audio/mp4',
          'Content-Length': blob.size.toString(),
          'X-Aura-Downloaded-At': Date.now().toString(),
          'X-Aura-Track-Id': song.id
        }
      });

      await cache.put(cacheKey, cacheResponse);

      // Persist metadata into IndexedDB - remove foreground-only restriction now that audio is cached locally!
      const updatedSong: Song = {
        ...song,
        isDownloaded: true,
        downloadedAt: Date.now(),
        fileSize: blob.size > 0 ? blob.size : song.fileSize,
        isForegroundOnly: false,
        playbackMode: 'direct-catalog',
        isDirectAudioStream: true
      };
      await musicDB.saveSong(updatedSong);

      if (Capacitor.isNativePlatform()) {
        androidMediaBridge.ensureNativeOfflineAudio(updatedSong).catch(() => {});
      }

      this.activeDownloads.delete(song.id);
      this.downloadingProgress.delete(song.id);
      this.failedDownloads.delete(song.id);
      this.notify();
      return true;
    } catch (err: any) {
      console.warn(`Download failed for track "${song.title}":`, err);

      // Clean up partial cache data if any
      const cache = await this.getCache();
      if (cache) {
        try {
          await cache.delete(this.getCacheKey(song.id));
        } catch {
          // Ignore delete error
        }
      }

      this.activeDownloads.delete(song.id);
      this.downloadingProgress.delete(song.id);
      if (err.name !== 'AbortError') {
        this.failedDownloads.add(song.id);
      }
      this.notify();
      return false;
    }
  }

  /**
   * Retrieves the cached audio as a blob object URL for HTML5 Audio playback.
   * Tracks and revokes previous object URLs to prevent browser memory leaks.
   */
  public async getCachedAudioUrl(songId: string): Promise<string | null> {
    if (this.activeObjectUrls.has(songId)) {
      return this.activeObjectUrls.get(songId)!;
    }

    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const match = await cache.match(this.getCacheKey(songId));
      if (!match) return null;

      const blob = await match.blob();
      if (!blob || blob.size === 0) return null;

      const objectUrl = URL.createObjectURL(blob);
      this.activeObjectUrls.set(songId, objectUrl);

      // BUG-06 fix: Cap active Object URLs to prevent unbounded memory growth
      const MAX_ACTIVE_URLS = 3;
      if (this.activeObjectUrls.size > MAX_ACTIVE_URLS) {
        const oldest = this.activeObjectUrls.keys().next().value;
        if (oldest && oldest !== songId) {
          const oldUrl = this.activeObjectUrls.get(oldest);
          if (oldUrl) {
            try { URL.revokeObjectURL(oldUrl); } catch {}
          }
          this.activeObjectUrls.delete(oldest);
        }
      }

      return objectUrl;
    } catch (err) {
      console.warn('Error reading cached audio response:', err);
      return null;
    }
  }

  /**
   * Explicitly revokes active object URL(s) to free up memory
   */
  public revokeCachedAudioUrl(songId?: string): void {
    if (songId) {
      const existing = this.activeObjectUrls.get(songId);
      if (existing) {
        try {
          URL.revokeObjectURL(existing);
        } catch {}
        this.activeObjectUrls.delete(songId);
      }
    } else {
      this.activeObjectUrls.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      this.activeObjectUrls.clear();
    }
  }

  /**
   * Deletes a downloaded song from Cache Storage and updates metadata in IndexedDB
   */
  public async deleteDownloadedTrack(songId: string): Promise<void> {
    // 1. Cancel in-flight download if any
    if (this.activeDownloads.has(songId)) {
      const controller = this.activeDownloads.get(songId);
      controller?.abort();
      this.activeDownloads.delete(songId);
      this.downloadingProgress.delete(songId);
    }

    // 2. Revoke any active object URL
    this.revokeCachedAudioUrl(songId);

    // 3. Remove from Cache Storage
    const cache = await this.getCache();
    if (cache) {
      try {
        await cache.delete(this.getCacheKey(songId));
      } catch (err) {
        console.warn('Error deleting cached response:', err);
      }
    }

    // 4. Update IndexedDB metadata
    await musicDB.updateSongDownloadStatus(songId, false);

    this.failedDownloads.delete(songId);
    this.notify();
  }

  /**
   * Gets all downloaded songs currently saved in the library
   */
  public async getDownloadedTracks(): Promise<Song[]> {
    return await musicDB.getDownloadedSongs();
  }

  /**
   * Calculates total offline storage used by downloaded music
   */
  public async getOfflineStorageUsage(): Promise<StorageUsage> {
    const downloadedSongs = await this.getDownloadedTracks();
    const totalBytes = downloadedSongs.reduce((sum, s) => sum + (s.fileSize || 0), 0);

    return {
      songCount: downloadedSongs.length,
      totalBytes
    };
  }

  /**
   * Wipes all downloaded audio from Cache Storage and updates all song metadata
   */
  public async clearAllDownloads(): Promise<void> {
    // 1. Abort any running downloads
    this.activeDownloads.forEach((controller) => controller.abort());
    this.activeDownloads.clear();
    this.downloadingProgress.clear();
    this.failedDownloads.clear();

    // 2. Revoke all active object URLs
    this.revokeCachedAudioUrl();

    // 3. Delete entire offline audio cache
    if (typeof caches !== 'undefined') {
      try {
        await caches.delete(OFFLINE_AUDIO_CACHE);
      } catch (err) {
        console.warn('Error clearing offline audio cache:', err);
      }
    }

    // 4. Update all downloaded songs in IndexedDB
    const downloaded = await musicDB.getDownloadedSongs();
    for (const song of downloaded) {
      await musicDB.updateSongDownloadStatus(song.id, false);
    }

    this.notify();
  }
}

export const downloadService = new DownloadService();
