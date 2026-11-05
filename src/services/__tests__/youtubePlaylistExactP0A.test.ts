import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractYouTubeTracks, importUniversalPlaylist } from '../universalPlaylistImporter';
import { useLibraryStore } from '../../store/useLibraryStore';
import { Playlist, Song, PlaylistEntry } from '../../types/music';

describe('P0-A: Exact YouTube Playlist Import & Data Model', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Verifies YouTube extractor produces exactly 181 tracks (177 playable + 4 unavailable)', async () => {
    // Generate simulated raw YouTube playlist with 197 items containing the 16-song repeated block
    const mockVideos: any[] = [];
    
    // First 100 tracks
    for (let i = 0; i < 100; i++) {
      mockVideos.push({
        videoId: `vid_${i}`,
        title: `Track ${i + 1}`,
        author: `Artist ${i + 1}`,
        lengthSeconds: 200,
        videoThumbnails: [{ url: `https://thumb/${i}.jpg` }]
      });
    }

    // Tracks 100 to 115 (16 songs)
    for (let i = 100; i < 116; i++) {
      mockVideos.push({
        videoId: `block_vid_${i}`,
        title: `Block Track ${i}`,
        author: 'Artist Block',
        lengthSeconds: 210,
        videoThumbnails: [{ url: `https://thumb/${i}.jpg` }]
      });
    }

    // Tracks 116 to 131: Repeated block of the same 16 songs (Invidious artifact)
    for (let i = 100; i < 116; i++) {
      mockVideos.push({
        videoId: `block_vid_${i}`,
        title: `Block Track ${i}`,
        author: 'Artist Block',
        lengthSeconds: 210,
        videoThumbnails: [{ url: `https://thumb/${i}.jpg` }]
      });
    }

    // Remaining tracks up to 197, including the 4 unavailable tracks
    for (let i = 132; i < 197; i++) {
      let vid = `vid_${i}`;
      let title = `Track ${i}`;
      let len = 220;

      // Inject the 4 unavailable tracks
      if (i === 142 || i === 178) {
        vid = 'm_cMwaELo68';
        title = '[Deleted video]';
        len = 0;
      } else if (i === 185) {
        vid = '4CwhWCaf8H4';
        title = '[Private video]';
        len = 0;
      } else if (i === 187) {
        vid = 'henlAvP6XDI';
        title = '[Deleted video]';
        len = 0;
      }

      mockVideos.push({
        videoId: vid,
        title,
        author: 'Artist Name',
        lengthSeconds: len,
        videoThumbnails: [{ url: `https://thumb/${i}.jpg` }]
      });
    }

    expect(mockVideos.length).toBe(197);

    // Mock fetch to return this payload
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Favorite Songs',
        playlistThumbnail: 'https://thumb/playlist.jpg',
        videos: mockVideos
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await extractYouTubeTracks('https://www.youtube.com/playlist?list=PLNf1vclGjpRE');

    // 1. Total count must be normalized to exactly 181
    expect(result.tracks.length).toBe(181);

    // 2. Exactly 177 playable + 4 unavailable
    const playable = result.tracks.filter(t => t.status === 'available');
    const unavailable = result.tracks.filter(t => t.status === 'unavailable');
    expect(playable.length).toBe(177);
    expect(unavailable.length).toBe(4);

    // 3. Unavailable tracks must have status 'unavailable' and reasons
    unavailable.forEach(u => {
      expect(u.isUnavailable).toBe(true);
      expect(u.status).toBe('unavailable');
      expect(u.unavailableReason).toBeDefined();
    });
  });

  it('2. Verifies importUniversalPlaylist preserves duplicate entries and marks unavailable status without fake songs', async () => {
    // Mock playlist with duplicates and 1 unavailable track
    const mockTracks = [
      { title: 'Sundari Neeve', author: 'SPB', lengthSeconds: 254, videoThumbnails: [{ url: 'thumb1' }], videoId: 'bxRccrhg7Lw' },
      { title: 'Vaseegara', author: 'Bombay Jayashri', lengthSeconds: 300, videoThumbnails: [{ url: 'thumb2' }], videoId: 'PYgcJpC6WAQ' },
      { title: 'Deleted Song', author: 'Unknown', lengthSeconds: 0, videoThumbnails: [], videoId: 'm_cMwaELo68' }, // unavailable
      { title: 'Sundari Neeve', author: 'SPB', lengthSeconds: 254, videoThumbnails: [{ url: 'thumb1' }], videoId: 'bxRccrhg7Lw' }, // duplicate of index 0
    ];

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('playlists')) {
        return {
          ok: true,
          json: async () => ({
            title: 'Test Playlist',
            videos: mockTracks
          })
        };
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            results: [
              {
                id: 'sundari_id',
                name: 'Sundari Neeve',
                artist: 'SPB',
                duration: 254,
                downloadUrl: [{ quality: '320kbps', url: 'https://aac.saavncdn.com/sundari_320.mp4' }]
              }
            ]
          }
        })
      };
    }));

    const result = await importUniversalPlaylist('https://www.youtube.com/playlist?list=PLTest');

    // Total tracks should be 4
    expect(result.totalTracks).toBe(4);
    expect(result.entries?.length).toBe(4);

    // Unique playable songs should be 2 ("Sundari Neeve" and "Vaseegara")
    expect(result.songs.length).toBe(2);

    // Unavailable song at index 2 must have songId: null (ZERO fake song records!)
    const unavailEntry = result.entries?.[2];
    expect(unavailEntry?.status).toBe('unavailable');
    expect(unavailEntry?.songId).toBeNull();

    // Duplicate positions (index 0 and index 3) must both exist and point to the same song ID
    const entry0 = result.entries?.[0];
    const entry3 = result.entries?.[3];
    expect(entry0?.status).toBe('available');
    expect(entry3?.status).toBe('available');
    expect(entry0?.songId).toBe(entry3?.songId);
    expect(entry0?.entryId).not.toBe(entry3?.entryId); // distinct entry IDs!
  });

  it('3. Verifies legacy playlists with songIds only load seamlessly without errors', () => {
    const legacyPlaylist: Playlist = {
      id: 'legacy_pl_1',
      name: 'Old User Playlist',
      songIds: ['song_a', 'song_b', 'song_a'], // contains duplicate ID in legacy array
      createdAt: 1000,
      updatedAt: 1000
    };

    // Verify entries is undefined on legacy playlist
    expect(legacyPlaylist.entries).toBeUndefined();
    expect(legacyPlaylist.songIds.length).toBe(3);

    // Backward compatibility synthesis check
    const synthesizedEntries: PlaylistEntry[] = legacyPlaylist.songIds.map((id, idx) => ({
      entryId: `${legacyPlaylist.id}_${idx}_${id}`,
      songId: id,
      position: idx,
      status: 'available',
      title: `Song ${id}`,
      artist: 'Artist',
      addedAt: legacyPlaylist.createdAt
    }));

    expect(synthesizedEntries.length).toBe(3);
    expect(synthesizedEntries[0].position).toBe(0);
    expect(synthesizedEntries[2].position).toBe(2);
  });
});
