import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectPlatform,
  cleanSearchQuery,
  importUniversalPlaylist,
  saveImportedPlaylistToLibrary
} from '../universalPlaylistImporter';
import * as jiosaavnService from '../jiosaavnService';
import { musicDB } from '../db';
import { useLibraryStore } from '../../store/useLibraryStore';

describe('Universal Playlist Importer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(musicDB, 'saveSongsBatch').mockResolvedValue(undefined as any);
    vi.spyOn(musicDB, 'savePlaylist').mockResolvedValue(undefined as any);
  });

  describe('detectPlatform', () => {
    it('detects Spotify playlist links', () => {
      expect(detectPlatform('https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6')).toBe('spotify');
      expect(detectPlatform('spotify:playlist:37i9dQZF1DX4WYpdgoIcn6')).toBe('spotify');
      expect(detectPlatform('https://open.spotify.com/album/4eLPsYPBmXABThSJ821sqY')).toBe('spotify');
    });

    it('detects YouTube and YouTube Music playlist links', () => {
      expect(detectPlatform('https://www.youtube.com/playlist?list=PLDIoUOhQQPlXr63I_vwF9GD8sAKh77dWU')).toBe('youtube');
      expect(detectPlatform('https://music.youtube.com/playlist?list=RDCLAK5uy_k')).toBe('youtube');
      expect(detectPlatform('https://youtu.be/playlist?list=PL123')).toBe('youtube');
    });

    it('detects JioSaavn links and IDs', () => {
      expect(detectPlatform('https://www.jiosaavn.com/featured/tamil-india-superhits-top-50/1134651042')).toBe('jiosaavn');
      expect(detectPlatform('https://www.saavn.com/s/playlist/test/123')).toBe('jiosaavn');
    });

    it('detects raw text lists', () => {
      expect(detectPlatform('Hukum - Anirudh\nNaa Ready - Vijay\nArabic Kuthu')).toBe('text');
      expect(detectPlatform('Illuminati Sushin Shyam')).toBe('text');
    });
  });

  describe('cleanSearchQuery', () => {
    it('removes official video, lyrics, 4k, audio tags', () => {
      expect(cleanSearchQuery('Hukum - Thalaivar Alappara [Official Music Video]')).toBe('Hukum - Thalaivar Alappara');
      expect(cleanSearchQuery('Arabic Kuthu (Video Song) | Beast | Thalapathy Vijay')).toBe('Arabic Kuthu');
      expect(cleanSearchQuery('Naa Ready (Audio) ft. Anirudh')).toBe('Naa Ready');
      expect(cleanSearchQuery('Badass [4K Ultra HD]')).toBe('Badass');
    });

    it('appends artist if not already included in clean query', () => {
      expect(cleanSearchQuery('Illuminati', 'Sushin Shyam')).toBe('Illuminati Sushin Shyam');
      expect(cleanSearchQuery('Illuminati Sushin Shyam', 'Sushin Shyam')).toBe('Illuminati Sushin Shyam');
    });
  });

  describe('importUniversalPlaylist - JioSaavn direct path', () => {
    it('fetches directly using fetchJioSaavnPlaylist without localhost dependency', async () => {
      const mockSaavnResult = {
        id: '1134651042',
        name: 'Tamil Top 50',
        description: 'Superhits',
        coverArt: 'https://c.saavncdn.com/top50.jpg',
        songCount: 2,
        songs: [
          {
            id: 'saavn_1',
            title: 'Hukum',
            artist: 'Anirudh',
            album: 'Jailer',
            duration: 236,
            format: '320k AAC',
            bitrate: 320,
            fileSize: 9440000,
            dateAdded: Date.now(),
            playCount: 0,
            isFavorite: false,
            artwork: 'https://c.saavncdn.com/hukum.jpg',
            coverArt: 'https://c.saavncdn.com/hukum.jpg',
            filePath: 'https://aac.saavncdn.com/hukum_320.mp4',
            path: 'https://aac.saavncdn.com/hukum_320.mp4',
            fileName: 'Hukum_320k.m4a',
            isOnline: true,
            isSaavn: true
          }
        ]
      };

      vi.spyOn(jiosaavnService, 'fetchJioSaavnPlaylist').mockResolvedValue(mockSaavnResult);

      const progressCallback = vi.fn();
      const res = await importUniversalPlaylist('https://www.jiosaavn.com/featured/tamil/1134651042', progressCallback);

      expect(res.platform).toBe('jiosaavn');
      expect(res.title).toBe('Tamil Top 50');
      expect(res.songs.length).toBe(1);
      expect(res.matchedTracks).toBe(1);
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('importUniversalPlaylist - Text tracklist batch matching', () => {
    it('matches song names concurrently with JioSaavn 320kbps search', async () => {
      const mockSong = {
        id: 'saavn_naa_ready',
        title: 'Naa Ready',
        artist: 'Thalapathy Vijay',
        album: 'Leo',
        duration: 248,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 9920000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://c.saavncdn.com/naa_ready.jpg',
        coverArt: 'https://c.saavncdn.com/naa_ready.jpg',
        filePath: 'https://aac.saavncdn.com/naa_ready_320.mp4',
        path: 'https://aac.saavncdn.com/naa_ready_320.mp4',
        fileName: 'Naa_Ready_320k.m4a',
        isOnline: true,
        isSaavn: true
      };

      vi.spyOn(jiosaavnService, 'searchJioSaavn').mockResolvedValue([mockSong]);

      const rawText = '1. Naa Ready - Vijay\n2. Hukum - Anirudh';
      const progressUpdates: any[] = [];
      const res = await importUniversalPlaylist(rawText, (p) => progressUpdates.push(p));

      expect(res.platform).toBe('text');
      expect(res.totalTracks).toBe(2);
      expect(res.songs.length).toBe(1); // De-duplicated
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);
    });
  });

  describe('saveImportedPlaylistToLibrary', () => {
    it('persists imported playlist into Zustand store and IndexedDB', async () => {
      const mockResult = {
        platform: 'jiosaavn' as const,
        title: 'My Custom Imported Mix',
        description: '320kbps HD Audio',
        coverArt: 'https://c.saavncdn.com/art.jpg',
        totalTracks: 1,
        matchedTracks: 1,
        songs: [
          {
            id: 'saavn_hukum_test',
            title: 'Hukum',
            artist: 'Anirudh',
            album: 'Jailer',
            duration: 236,
            format: '320k AAC',
            bitrate: 320,
            fileSize: 9440000,
            dateAdded: Date.now(),
            playCount: 0,
            isFavorite: false,
            artwork: 'https://c.saavncdn.com/hukum.jpg',
            coverArt: 'https://c.saavncdn.com/hukum.jpg',
            filePath: 'https://aac.saavncdn.com/hukum_320.mp4',
            path: 'https://aac.saavncdn.com/hukum_320.mp4',
            fileName: 'Hukum_320k.m4a',
            isOnline: true,
            isSaavn: true
          }
        ]
      };

      const playlist = await saveImportedPlaylistToLibrary(mockResult);
      expect(playlist.name).toBe('My Custom Imported Mix');
      expect(playlist.songIds).toContain('saavn_hukum_test');

      const storePlaylists = useLibraryStore.getState().playlists;
      expect(storePlaylists.some((p) => p.id === playlist.id)).toBe(true);
    });
  });

  describe('importUniversalPlaylist - Single YouTube Video link', () => {
    it('preserves exact videoId, title, thumbnail, and streams directly without JioSaavn override', async () => {
      // Mock global fetch for oembed
      const mockOembed = {
        title: 'Yuvan Mixtape | Vintage Yuvan | 02 | DJ V',
        author_name: 'DJ V',
        thumbnail_url: 'https://i.ytimg.com/vi/DYS6lLKMfFQ/hqdefault.jpg'
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('youtube.com/oembed')) {
          return {
            ok: true,
            json: async () => mockOembed
          } as any;
        }
        return { ok: false, status: 404 } as any;
      });

      const saavnSpy = vi.spyOn(jiosaavnService, 'searchJioSaavn');

      const res = await importUniversalPlaylist('https://youtu.be/DYS6lLKMfFQ?si=NxWVLYGlIkvqlD9G');

      // Restore fetch
      globalThis.fetch = originalFetch;

      expect(res.platform).toBe('youtube');
      expect(res.title).toBe('Yuvan Mixtape | Vintage Yuvan | 02 | DJ V');
      expect(res.songs.length).toBe(1);
      expect(res.songs[0].id).toBe('online_DYS6lLKMfFQ');
      expect(res.songs[0].sourceId).toBe('DYS6lLKMfFQ');
      expect(res.songs[0].title).toBe('Yuvan Mixtape | Vintage Yuvan | 02 | DJ V');
      expect(res.songs[0].artist).toBe('DJ V');
      expect(res.songs[0].coverArt).toBe('https://i.ytimg.com/vi/DYS6lLKMfFQ/hqdefault.jpg');
      expect(res.songs[0].isOnline).toBe(true);

      // Verify JioSaavn search was bypassed so it did not replace the mixtape with an unrelated song
      expect(saavnSpy).not.toHaveBeenCalled();
    });
  });
});
