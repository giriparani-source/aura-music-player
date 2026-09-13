/**
 * src/services/lyricsService.ts
 * Synchronized Karaoke Lyrics Service.
 * Fetches real millisecond-accurate synced (.lrc) lyrics from LRCLIB and JioSaavn,
 * caches them in the existing IndexedDB database, and provides offline resilience.
 *
 * Strictly avoids fake timestamps: If only plain lyrics exist, marks them as unsynced.
 */

import { Song } from '../types/music';
import { musicDB } from './db';
import { parseLrcLyrics, LyricLine } from '../utils/lyricsParser';

export interface FetchLyricsResult {
  source: 'lrclib' | 'saavn' | 'cache' | 'embedded' | 'none';
  isSynced: boolean;
  rawLyrics: string | null;
  syncedLines: LyricLine[];
  plainLines: string[];
  error?: string;
}

const REQUEST_TIMEOUT_MS = 3800;

class LyricsService {
  // In-memory runtime cache to avoid repeated network calls in the same session
  private memoryCache: Map<string, FetchLyricsResult> = new Map();

  /**
   * Cleans artist and title strings for optimal search on lyrics providers.
   * Strips movie tags, "feat.", brackets, etc.
   */
  private cleanQueryString(text: string): string {
    return text
      .replace(/\([^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/video song/gi, '')
      .replace(/lyric video/gi, '')
      .replace(/official video/gi, '')
      .replace(/ft\..*$/gi, '')
      .replace(/feat\..*$/gi, '')
      .replace(/•.*$/g, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Primary entry point: Resolves lyrics for a song following the strict fallback chain:
   * 1. Check in-memory session cache
   * 2. Check song object or IndexedDB cache
   * 3. Fetch synced lyrics from LRCLIB API
   * 4. Fetch lyrics from JioSaavn API
   * 5. Plain unsynced lyrics fallback
   * 6. None
   */
  public async getLyricsForSong(song: Song): Promise<FetchLyricsResult> {
    const cacheKey = song.id || `${song.title}_${song.artist}`;

    // 1. Session Memory Cache
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }

    // 2. Check if song already has embedded/cached lyrics in IndexedDB
    if (song.lyrics && song.lyrics.trim().length > 0) {
      const parsedLrc = parseLrcLyrics(song.lyrics);
      if (parsedLrc.length > 0) {
        const result: FetchLyricsResult = {
          source: 'cache',
          isSynced: true,
          rawLyrics: song.lyrics,
          syncedLines: parsedLrc,
          plainLines: []
        };
        this.memoryCache.set(cacheKey, result);
        return result;
      }
    }

    // Check IndexedDB persisted copy if song.lyrics wasn't on the object
    try {
      const dbSong = await musicDB.getSongById(song.id);
      if (dbSong?.lyrics && dbSong.lyrics.trim().length > 0) {
        const parsedLrc = parseLrcLyrics(dbSong.lyrics);
        if (parsedLrc.length > 0) {
          const result: FetchLyricsResult = {
            source: 'cache',
            isSynced: true,
            rawLyrics: dbSong.lyrics,
            syncedLines: parsedLrc,
            plainLines: []
          };
          this.memoryCache.set(cacheKey, result);
          return result;
        }
      }
    } catch {
      // IndexedDB lookup error, continue to network fetch
    }

    // 3. Online Fetch: Try LRCLIB for real millisecond-accurate synced lyrics
    const cleanTitle = this.cleanQueryString(song.title);
    const cleanArtist = song.artist && song.artist !== 'Not set' ? this.cleanQueryString(song.artist) : '';

    let lrcResult: FetchLyricsResult | null = null;
    if (cleanTitle) {
      lrcResult = await this.fetchFromLrcLib(cleanTitle, cleanArtist, song.duration);
    }

    if (lrcResult && lrcResult.isSynced && lrcResult.syncedLines.length > 0) {
      // Persist to existing IndexedDB so it works offline subsequently
      this.persistToIndexedDB(song.id, lrcResult.rawLyrics || '');
      this.memoryCache.set(cacheKey, lrcResult);
      return lrcResult;
    }

    // 4. Online Fetch: Try JioSaavn lyrics API if available
    if (song.isSaavn || song.sourceId) {
      const saavnResult = await this.fetchFromJioSaavn(song);
      if (saavnResult) {
        this.persistToIndexedDB(song.id, saavnResult.rawLyrics || '');
        this.memoryCache.set(cacheKey, saavnResult);
        return saavnResult;
      }
    }

    // 5. If LRCLIB returned plain (unsynced) lyrics
    if (lrcResult && lrcResult.rawLyrics) {
      this.persistToIndexedDB(song.id, lrcResult.rawLyrics);
      this.memoryCache.set(cacheKey, lrcResult);
      return lrcResult;
    }

    // 6. If existing song had plain text lyrics
    if (song.lyrics && song.lyrics.trim().length > 0) {
      const plainLines = song.lyrics
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const result: FetchLyricsResult = {
        source: 'embedded',
        isSynced: false,
        rawLyrics: song.lyrics,
        syncedLines: [],
        plainLines
      };
      this.memoryCache.set(cacheKey, result);
      return result;
    }

    // 7. No lyrics found
    const emptyResult: FetchLyricsResult = {
      source: 'none',
      isSynced: false,
      rawLyrics: null,
      syncedLines: [],
      plainLines: []
    };
    this.memoryCache.set(cacheKey, emptyResult);
    return emptyResult;
  }

  /**
   * Fetches lyrics from LRCLIB open API
   */
  private async fetchFromLrcLib(
    trackName: string,
    artistName: string,
    duration?: number
  ): Promise<FetchLyricsResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const params = new URLSearchParams({
        track_name: trackName
      });
      if (artistName) params.append('artist_name', artistName);
      if (duration && duration > 0) params.append('duration', Math.round(duration).toString());

      const url = `https://lrclib.net/api/get?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AuraMusicPlayer/1.0 (https://github.com)'
        },
        signal: controller.signal
      });

      if (!res.ok) {
        // If exact match failed, try search endpoint
        return await this.searchLrcLib(trackName, artistName);
      }

      const data = await res.json();

      if (data.syncedLyrics && typeof data.syncedLyrics === 'string') {
        const parsed = parseLrcLyrics(data.syncedLyrics);
        if (parsed.length > 0) {
          return {
            source: 'lrclib',
            isSynced: true,
            rawLyrics: data.syncedLyrics,
            syncedLines: parsed,
            plainLines: []
          };
        }
      }

      if (data.plainLyrics && typeof data.plainLyrics === 'string') {
        return {
          source: 'lrclib',
          isSynced: false,
          rawLyrics: data.plainLyrics,
          syncedLines: [],
          plainLines: data.plainLyrics
            .split(/\r?\n/)
            .map((l: string) => l.trim())
            .filter(Boolean)
        };
      }

      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fallback search on LRCLIB if direct GET doesn't match exact duration
   */
  private async searchLrcLib(trackName: string, artistName: string): Promise<FetchLyricsResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const query = artistName ? `${trackName} ${artistName}` : trackName;
      const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AuraMusicPlayer/1.0 (https://github.com)'
        },
        signal: controller.signal
      });

      if (!res.ok) return null;

      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) return null;

      // Find item with synced lyrics
      const syncedItem = items.find((it: any) => it.syncedLyrics && it.syncedLyrics.trim().length > 0);
      if (syncedItem) {
        const parsed = parseLrcLyrics(syncedItem.syncedLyrics);
        if (parsed.length > 0) {
          return {
            source: 'lrclib',
            isSynced: true,
            rawLyrics: syncedItem.syncedLyrics,
            syncedLines: parsed,
            plainLines: []
          };
        }
      }

      // Or fallback to plain lyrics item
      const plainItem = items.find((it: any) => it.plainLyrics && it.plainLyrics.trim().length > 0);
      if (plainItem) {
        return {
          source: 'lrclib',
          isSynced: false,
          rawLyrics: plainItem.plainLyrics,
          syncedLines: [],
          plainLines: plainItem.plainLyrics
            .split(/\r?\n/)
            .map((l: string) => l.trim())
            .filter(Boolean)
        };
      }

      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetches lyrics from JioSaavn if the song has an ID or lyrics endpoint
   */
  private async fetchFromJioSaavn(song: Song): Promise<FetchLyricsResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const songId = song.sourceId || (song.id.startsWith('saavn_') ? song.id.replace('saavn_', '') : null);
      if (!songId) return null;

      const url = `https://saavn.dev/api/songs/${songId}/lyrics`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;

      const json = await res.json();
      const lyricsText = json?.data?.lyrics || json?.lyrics;

      if (lyricsText && typeof lyricsText === 'string') {
        const parsed = parseLrcLyrics(lyricsText);
        if (parsed.length > 0) {
          return {
            source: 'saavn',
            isSynced: true,
            rawLyrics: lyricsText,
            syncedLines: parsed,
            plainLines: []
          };
        }

        // Clean HTML tags often present in Saavn lyrics like <br>
        const cleanPlain = lyricsText
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .split(/\r?\n/)
          .map((l: string) => l.trim())
          .filter(Boolean);

        return {
          source: 'saavn',
          isSynced: false,
          rawLyrics: cleanPlain.join('\n'),
          syncedLines: [],
          plainLines: cleanPlain
        };
      }

      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Persists fetched lyrics into the existing IndexedDB layer
   */
  private persistToIndexedDB(songId: string, lyrics: string): void {
    if (!songId || !lyrics) return;
    musicDB
      .updateSongLyrics(songId, lyrics)
      .catch(() => {
        // Silently ignore storage quota/persistence issues
      });
  }

  /**
   * Manually clears the runtime memory cache (e.g. on user edits)
   */
  public clearCache(songId?: string): void {
    if (songId) {
      this.memoryCache.delete(songId);
    } else {
      this.memoryCache.clear();
    }
  }
}

export const lyricsService = new LyricsService();
