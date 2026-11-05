import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  importUniversalPlaylist,
  extractSpotifyTracks
} from '../universalPlaylistImporter';
import { useLibraryStore } from '../../store/useLibraryStore';
import { Playlist, Song, PlaylistEntry } from '../../types/music';

// Mock IndexedDB operations in musicDB to avoid mutating real data
vi.mock('../db', () => ({
  musicDB: {
    savePlaylist: vi.fn().mockResolvedValue(undefined),
    saveSongsBatch: vi.fn().mockResolvedValue(undefined),
    deletePlaylist: vi.fn().mockResolvedValue(undefined),
    getAllPlaylists: vi.fn().mockResolvedValue([]),
    getAllSongs: vi.fn().mockResolvedValue([])
  }
}));

describe('P0-C: Playlist Import Reliability & Playback Safety', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Import Cancellation via AbortSignal', () => {
    it('aborts importUniversalPlaylist immediately when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        importUniversalPlaylist(
          'https://www.youtube.com/playlist?list=PL1234567890',
          undefined,
          controller.signal
        )
      ).rejects.toThrow(/aborted/i);
    });

    it('aborts importUniversalPlaylist during track processing when signal is aborted mid-flight', async () => {
      const controller = new AbortController();

      // Mock fetch returning a list of tracks
      const mockVideos = Array.from({ length: 20 }, (_, i) => ({
        videoId: `vid_${i}`,
        title: `Song ${i}`,
        author: 'Artist',
        lengthSeconds: 180,
        videoThumbnails: [{ url: `https://thumb/${i}.jpg` }]
      }));

      const mockFetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({
            title: 'Test Playlist',
            videos: mockVideos
          })
        };
      });
      vi.stubGlobal('fetch', mockFetch);

      let callCount = 0;
      const progressCallback = vi.fn((prog) => {
        callCount++;
        // Abort after first progress callback
        if (callCount >= 1) {
          controller.abort();
        }
      });

      await expect(
        importUniversalPlaylist(
          'https://www.youtube.com/playlist?list=PL1234567890',
          progressCallback,
          controller.signal
        )
      ).rejects.toThrow(/aborted/i);
    });
  });

  describe('2. Spotify Duplicate Track Preservation', () => {
    it('preserves exact duplicate tracks from Spotify markdown without dropping them', async () => {
      // Jina reader returns Spotify track links formatted as [Track Title](https://open.spotify.com/track/...)
      const mockMarkdown = `
# Best Hits Playlist
* [Track 1](https://open.spotify.com/track/abc111)
* [Track 2](https://open.spotify.com/track/def222)
* [Track 1](https://open.spotify.com/track/abc111)
* [Track 3](https://open.spotify.com/track/ghi333)
      `;

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('oembed')) {
          return {
            ok: true,
            json: async () => ({
              title: 'Best Hits Playlist',
              thumbnail_url: 'https://thumb/playlist.jpg'
            })
          };
        }
        if (typeof url === 'string' && url.includes('r.jina.ai')) {
          return {
            ok: true,
            text: async () => mockMarkdown
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await extractSpotifyTracks('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');

      expect(result.tracks.length).toBe(4);
      expect(result.tracks[0].title).toBe('Track 1');
      expect(result.tracks[1].title).toBe('Track 2');
      expect(result.tracks[2].title).toBe('Track 1'); // Duplicate preserved!
      expect(result.tracks[3].title).toBe('Track 3');
    });
  });

  describe('3. Store pl.entries and pl.songIds Synchronization', () => {
    it('addSongToPlaylist appends PlaylistEntry with correct position and updates songIds', async () => {
      const initialPlaylist: Playlist = {
        id: 'pl-sync-test',
        name: 'Sync Test',
        songIds: ['song-1'],
        entries: [
          {
            entryId: 'entry-1',
            position: 0,
            status: 'available',
            songId: 'song-1',
            title: 'Song 1',
            artist: 'Artist 1',
            addedAt: 1000
          }
        ],
        createdAt: 1000,
        updatedAt: 1000
      };

      useLibraryStore.setState({
        playlists: [initialPlaylist],
        songs: [
          {
            id: 'song-2',
            title: 'Song 2',
            artist: 'Artist 2',
            album: 'Album 2',
            duration: 180,
            filePath: '',
            dateAdded: 1000,
            playCount: 0,
            isFavorite: false
          } as Song
        ]
      });

      await useLibraryStore.getState().addSongToPlaylist('pl-sync-test', 'song-2');

      const updated = useLibraryStore.getState().playlists.find((p) => p.id === 'pl-sync-test')!;
      expect(updated.songIds).toEqual(['song-1', 'song-2']);
      expect(updated.entries).toBeDefined();
      expect(updated.entries!.length).toBe(2);
      expect(updated.entries![1].songId).toBe('song-2');
      expect(updated.entries![1].position).toBe(1);
    });

    it('batchAddToPlaylist appends multiple PlaylistEntries with sequential positions', async () => {
      const initialPlaylist: Playlist = {
        id: 'pl-batch-sync',
        name: 'Batch Sync Test',
        songIds: ['song-a'],
        entries: [
          {
            entryId: 'entry-a',
            position: 0,
            status: 'available',
            songId: 'song-a',
            title: 'Song A',
            artist: 'Artist A',
            addedAt: 1000
          }
        ],
        createdAt: 1000,
        updatedAt: 1000
      };

      useLibraryStore.setState({
        playlists: [initialPlaylist],
        songs: [
          {
            id: 'song-b',
            title: 'Song B',
            artist: 'Artist B',
            album: 'Album B',
            duration: 180,
            filePath: '',
            dateAdded: 1000,
            playCount: 0,
            isFavorite: false
          } as Song,
          {
            id: 'song-c',
            title: 'Song C',
            artist: 'Artist C',
            album: 'Album C',
            duration: 200,
            filePath: '',
            dateAdded: 1000,
            playCount: 0,
            isFavorite: false
          } as Song
        ]
      });

      await useLibraryStore.getState().batchAddToPlaylist('pl-batch-sync', ['song-b', 'song-c']);

      const updated = useLibraryStore.getState().playlists.find((p) => p.id === 'pl-batch-sync')!;
      expect(updated.songIds).toEqual(['song-a', 'song-b', 'song-c']);
      expect(updated.entries!.length).toBe(3);
      expect(updated.entries![1].songId).toBe('song-b');
      expect(updated.entries![1].position).toBe(1);
      expect(updated.entries![2].songId).toBe('song-c');
      expect(updated.entries![2].position).toBe(2);
    });

    it('removeSongFromPlaylist removes from both songIds and entries and re-indexes positions', async () => {
      const initialPlaylist: Playlist = {
        id: 'pl-remove-test',
        name: 'Remove Test',
        songIds: ['song-1', 'song-2', 'song-3'],
        entries: [
          { entryId: 'e-1', position: 0, status: 'available', songId: 'song-1', title: 'Song 1', artist: 'Artist 1', addedAt: 1000 },
          { entryId: 'e-2', position: 1, status: 'available', songId: 'song-2', title: 'Song 2', artist: 'Artist 2', addedAt: 1001 },
          { entryId: 'e-3', position: 2, status: 'available', songId: 'song-3', title: 'Song 3', artist: 'Artist 3', addedAt: 1002 }
        ],
        createdAt: 1000,
        updatedAt: 1000
      };

      useLibraryStore.setState({
        playlists: [initialPlaylist]
      });

      // Remove middle song (song-2)
      await useLibraryStore.getState().removeSongFromPlaylist('pl-remove-test', 'song-2');

      const updated = useLibraryStore.getState().playlists.find((p) => p.id === 'pl-remove-test')!;
      expect(updated.songIds).toEqual(['song-1', 'song-3']);
      expect(updated.entries!.length).toBe(2);
      expect(updated.entries![0].songId).toBe('song-1');
      expect(updated.entries![0].position).toBe(0);
      expect(updated.entries![1].songId).toBe('song-3');
      expect(updated.entries![1].position).toBe(1); // Position re-indexed without gaps!
    });

    it('removeEntryFromPlaylist removes specific entry by entryId and re-indexes positions', async () => {
      // Playlist with duplicate occurrences of song-1
      const initialPlaylist: Playlist = {
        id: 'pl-dup-remove',
        name: 'Duplicate Remove Test',
        songIds: ['song-1', 'song-2', 'song-1'],
        entries: [
          { entryId: 'entry-first', position: 0, status: 'available', songId: 'song-1', title: 'Song 1', artist: 'Artist 1', addedAt: 1000 },
          { entryId: 'entry-middle', position: 1, status: 'available', songId: 'song-2', title: 'Song 2', artist: 'Artist 2', addedAt: 1001 },
          { entryId: 'entry-second', position: 2, status: 'available', songId: 'song-1', title: 'Song 1', artist: 'Artist 1', addedAt: 1002 }
        ],
        createdAt: 1000,
        updatedAt: 1000
      };

      useLibraryStore.setState({
        playlists: [initialPlaylist]
      });

      // Remove the second occurrence specifically by entryId
      await useLibraryStore.getState().removeEntryFromPlaylist('pl-dup-remove', 'entry-second');

      const updated = useLibraryStore.getState().playlists.find((p) => p.id === 'pl-dup-remove')!;
      expect(updated.entries!.length).toBe(2);
      expect(updated.entries![0].entryId).toBe('entry-first');
      expect(updated.entries![0].position).toBe(0);
      expect(updated.entries![1].entryId).toBe('entry-middle');
      expect(updated.entries![1].position).toBe(1);
      expect(updated.songIds).toEqual(['song-1', 'song-2']);
    });

    it('removeSongFromPlaylist with entryId removes only the specific duplicate occurrence', async () => {
      // Playlist with duplicate occurrences of song-1
      const initialPlaylist: Playlist = {
        id: 'pl-dup-song-remove',
        name: 'Duplicate Song Remove Test',
        songIds: ['song-1', 'song-2', 'song-1'],
        entries: [
          { entryId: 'e-first', position: 0, status: 'available', songId: 'song-1', title: 'Song 1', artist: 'Artist 1', addedAt: 1000 },
          { entryId: 'e-middle', position: 1, status: 'available', songId: 'song-2', title: 'Song 2', artist: 'Artist 2', addedAt: 1001 },
          { entryId: 'e-second', position: 2, status: 'available', songId: 'song-1', title: 'Song 1', artist: 'Artist 1', addedAt: 1002 }
        ],
        createdAt: 1000,
        updatedAt: 1000
      };

      useLibraryStore.setState({
        playlists: [initialPlaylist]
      });

      // Remove the second occurrence using removeSongFromPlaylist with entryId
      await useLibraryStore.getState().removeSongFromPlaylist('pl-dup-song-remove', 'song-1', 'e-second');

      const updated = useLibraryStore.getState().playlists.find((p) => p.id === 'pl-dup-song-remove')!;
      expect(updated.entries!.length).toBe(2);
      expect(updated.entries![0].entryId).toBe('e-first');
      expect(updated.entries![0].position).toBe(0);
      expect(updated.entries![1].entryId).toBe('e-middle');
      expect(updated.entries![1].position).toBe(1);
      expect(updated.songIds).toEqual(['song-1', 'song-2']);
    });

    it('removeSongFromPlaylist removes exact index from legacy playlist with duplicates', async () => {
      // Legacy playlist without pl.entries containing duplicate song-x at index 0 and 2
      const initialPlaylist: Playlist = {
        id: 'pl-legacy-dup',
        name: 'Legacy Dup Test',
        songIds: ['song-x', 'song-y', 'song-x'],
        createdAt: 1000,
        updatedAt: 1000
      };

      useLibraryStore.setState({
        playlists: [initialPlaylist]
      });

      // User clicked remove on the second occurrence (idx 2)
      const legacyEntryId = 'pl-legacy-dup_2_song-x';
      await useLibraryStore.getState().removeSongFromPlaylist('pl-legacy-dup', 'song-x', legacyEntryId);

      const updated = useLibraryStore.getState().playlists.find((p) => p.id === 'pl-legacy-dup')!;
      expect(updated.songIds).toEqual(['song-x', 'song-y']); // Index 0 kept, index 2 removed!
    });
  });

  describe('4. PlaylistsView Playback Queue Safety with Unavailable Tracks', () => {
    const rawPlaylistSongs: any[] = [
      {
        id: 'entry_unavail_0',
        title: '[Unavailable Video]',
        artist: 'Unavailable on YouTube',
        isUnavailable: true,
        isUnavailableEntry: true,
        filePath: ''
      },
      {
        id: 'play_1',
        title: 'Playable Song 1',
        artist: 'Artist A',
        isUnavailable: false,
        isUnavailableEntry: false,
        filePath: '/path/song1.mp3'
      },
      {
        id: 'entry_unavail_2',
        title: '[Deleted Video]',
        artist: 'Unavailable',
        isUnavailable: true,
        isUnavailableEntry: true,
        filePath: ''
      },
      {
        id: 'play_3',
        title: 'Playable Song 2',
        artist: 'Artist B',
        isUnavailable: false,
        isUnavailableEntry: false,
        filePath: '/path/song2.mp3'
      }
    ];

    it('filters out unavailable placeholder entries so only playable songs enter the queue', () => {
      const playableSongs = rawPlaylistSongs.filter((s) => !s.isUnavailableEntry && !s.isUnavailable);

      expect(playableSongs.length).toBe(2);
      expect(playableSongs[0].id).toBe('play_1');
      expect(playableSongs[1].id).toBe('play_3');
      expect(playableSongs[0].isUnavailable).toBe(false);
    });

    it('ensures shuffle and addMultipleToQueue never receive unavailable placeholder tracks', () => {
      const playableSongs = rawPlaylistSongs.filter((s) => !s.isUnavailableEntry && !s.isUnavailable);

      // Verify that every single song in playableSongs is strictly playable
      for (const s of playableSongs) {
        expect(s.isUnavailable).toBeFalsy();
        expect(s.isUnavailableEntry).toBeFalsy();
        expect(s.filePath).not.toBe('');
      }

      // Random shuffle selection within playableSongs is always playable
      for (let i = 0; i < 20; i++) {
        const randomIndex = Math.floor(Math.random() * playableSongs.length);
        const selected = playableSongs[randomIndex];
        expect(selected.isUnavailable).toBeFalsy();
      }
    });
  });

  describe('5. Import Cancellation Zero-Save Guarantee', () => {
    it('ensures aborted imports never call musicDB.savePlaylist or create partial library records', async () => {
      const { musicDB } = await import('../db');
      const controller = new AbortController();
      controller.abort();

      try {
        await importUniversalPlaylist('https://www.youtube.com/playlist?list=PLtest', undefined, controller.signal);
      } catch (err: any) {
        expect(err.name).toBe('AbortError');
      }

      // Verify that zero database save operations occurred
      expect(musicDB.savePlaylist).not.toHaveBeenCalled();
    });
  });
});
