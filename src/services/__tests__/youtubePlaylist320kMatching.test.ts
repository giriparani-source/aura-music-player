import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanTrackMetadata,
  fuzzyMovieMatch,
  evaluateHardGates,
  matchYouTubeToCatalog
} from '../catalogMatcher';
import { extractYouTubeTracks, importUniversalPlaylist } from '../universalPlaylistImporter';
import { Song, PlaylistEntry } from '../../types/music';

describe('YouTube Playlist 320kbps Matching & Regressions (v1.2.5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Movie Name Spacing & Transliteration Normalization', () => {
    it('matches exact movie with spacing difference (e.g. DoubleX vs Double X)', () => {
      expect(fuzzyMovieMatch('Jigarthanda DoubleX', 'Jigarthanda Double X')).toBe(true);
      expect(fuzzyMovieMatch('Jigarthanda Double X', 'Jigarthanda DoubleX')).toBe(true);
    });

    it('matches South Indian movie transliteration variants (e.g. Velaiyilla Pattathari vs Velai Illa Pattadhaari)', () => {
      expect(fuzzyMovieMatch('Velaiyilla Pattathari', 'Velai Illa Pattadhaari')).toBe(true);
      expect(fuzzyMovieMatch('Guruvayoorambala Nadayil', 'Guruvayoor Ambala Nadayil')).toBe(true);
      expect(fuzzyMovieMatch('Vidaamuyarchi', 'Vidaa Muyarchi')).toBe(true);
    });

    it('rejects cross-movie mismatch for distinct movies', () => {
      expect(fuzzyMovieMatch('Jailer', 'Leo')).toBe(false);
      expect(fuzzyMovieMatch('Vikram', 'Master')).toBe(false);
      expect(fuzzyMovieMatch('Petta', 'Viswasam')).toBe(false);
    });
  });

  describe('2. Hard Gate Evaluation & Wrong-Match Prevention', () => {
    it('accepts matching track when movie has spacing difference', () => {
      const meta = cleanTrackMetadata('Maamadura (From "Jigarthanda DoubleX")', 'Santhosh Narayanan', 210);
      const candidate: Song = {
        id: 'saavn_maamadura',
        path: 'https://aac.saavncdn.com/stream.mp4',
        fileName: 'stream.mp4',
        title: 'Maamadura',
        artist: 'Santhosh Narayanan, Dhee',
        album: 'Jigarthanda Double X',
        duration: 212,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 8480000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://c.saavncdn.com/art.jpg',
        filePath: 'https://aac.saavncdn.com/stream.mp4',
        isOnline: true,
        isSaavn: true
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it('rejects candidate if original is studio track but candidate is a Remix', () => {
      const meta = cleanTrackMetadata('Arabic Kuthu', 'Anirudh Ravichander', 280);
      const candidate: Song = {
        id: 'saavn_arabic_remix',
        path: 'https://aac.saavncdn.com/remix.mp4',
        fileName: 'remix.mp4',
        title: 'Arabic Kuthu (Club Remix)',
        artist: 'DJ Remix, Anirudh Ravichander',
        album: 'Party Mix 2022',
        duration: 280,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 8000000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: '',
        filePath: 'https://aac.saavncdn.com/remix.mp4',
        isOnline: true
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Remix');
    });

    it('rejects candidate if original is studio track but candidate is Karaoke/Instrumental', () => {
      const meta = cleanTrackMetadata('Illuminati', 'Sushin Shyam', 194);
      const candidate: Song = {
        id: 'saavn_illuminati_karaoke',
        path: 'https://aac.saavncdn.com/karaoke.mp4',
        fileName: 'karaoke.mp4',
        title: 'Illuminati (Karaoke Version)',
        artist: 'Sushin Shyam',
        album: 'Aavesham Karaoke',
        duration: 194,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 7760000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: '',
        filePath: 'https://aac.saavncdn.com/karaoke.mp4',
        isOnline: true
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('karaoke');
    });

    it('rejects candidate if from a completely different movie (cross-movie protection)', () => {
      const meta = cleanTrackMetadata('Kadharalz (From "Leo")', 'Anirudh Ravichander', 220);
      const candidate: Song = {
        id: 'saavn_other_movie',
        path: 'https://aac.saavncdn.com/other.mp4',
        fileName: 'other.mp4',
        title: 'Kadharalz',
        artist: 'Anirudh Ravichander',
        album: 'Beast', // different movie
        duration: 220,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 8800000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: '',
        filePath: 'https://aac.saavncdn.com/other.mp4',
        isOnline: true
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Cross-movie mismatch');
    });

    it('GUARDED DURATION: allows duration relaxation up to 75s ONLY when movie strongly matches', () => {
      // Movie matches ("Jigarthanda Double X" vs "Jigarthanda DoubleX"), diff is 45s
      const meta = cleanTrackMetadata('Maamadura (From "Jigarthanda DoubleX")', 'Santhosh Narayanan', 255);
      const candidate: Song = {
        id: 'saavn_movie_diff',
        path: 'https://aac.saavncdn.com/maamadura.mp4',
        fileName: 'maamadura.mp4',
        title: 'Maamadura',
        artist: 'Santhosh Narayanan',
        album: 'Jigarthanda Double X',
        duration: 210, // diff = 45s
        format: '320k AAC',
        bitrate: 320,
        fileSize: 8400000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: '',
        filePath: 'https://aac.saavncdn.com/maamadura.mp4',
        isOnline: true
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(true);
    });

    it('GUARDED DURATION: REJECTS duration relaxation (>30s) when artist is ignored and movie does NOT match', () => {
      // Artist is automated topic, no movie context, diff is 40s (>30s)
      const meta = cleanTrackMetadata('Kadhale Kadhale', 'Release - Topic', 250);
      const candidate: Song = {
        id: 'saavn_generic_diff',
        path: 'https://aac.saavncdn.com/kadhale.mp4',
        fileName: 'kadhale.mp4',
        title: 'Kadhale Kadhale',
        artist: 'Govind Vasantha',
        album: '96',
        duration: 210, // diff = 40s (> 30s)
        format: '320k AAC',
        bitrate: 320,
        fileSize: 8400000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: '',
        filePath: 'https://aac.saavncdn.com/kadhale.mp4',
        isOnline: true
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Duration mismatch');
    });

    it('VERSION GATE: REJECTS Female Version candidate when original title is standard', () => {
      const meta = cleanTrackMetadata('Kadhale Kadhale (From "96")', 'Govind Vasantha', 210);
      const candidate: Song = {
        id: 'saavn_female_ver',
        path: 'https://aac.saavncdn.com/female.mp4',
        fileName: 'female.mp4',
        title: 'Kadhale Kadhale (Female Version)',
        artist: 'Chinmayi, Govind Vasantha',
        album: '96',
        duration: 210,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 8400000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: '',
        filePath: 'https://aac.saavncdn.com/female.mp4',
        isOnline: true
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Female Version');
    });

    it('VERSION GATE: REJECTS Reprise candidate when original title is standard', () => {
      const meta = cleanTrackMetadata('Maruvaarthai (From "ENPT")', 'Sid Sriram', 240);
      const candidate: Song = {
        id: 'saavn_reprise_ver',
        path: 'https://aac.saavncdn.com/reprise.mp4',
        fileName: 'reprise.mp4',
        title: 'Maruvaarthai (Reprise)',
        artist: 'Sid Sriram',
        album: 'Enai Noki Paayum Thota',
        duration: 240,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 8400000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: '',
        filePath: 'https://aac.saavncdn.com/reprise.mp4',
        isOnline: true
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Reprise');
    });

    it('VERSION GATE: REJECTS Cover/Acoustic candidate when original title is studio master', () => {
      const meta = cleanTrackMetadata('Vaseegara (From "Minnale")', 'Bombay Jayashri', 300);
      const candidate: Song = {
        id: 'saavn_cover_ver',
        path: 'https://aac.saavncdn.com/cover.mp4',
        fileName: 'cover.mp4',
        title: 'Vaseegara (Acoustic Cover)',
        artist: 'Various Artists',
        album: 'Acoustic Hits',
        duration: 300,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 8400000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: '',
        filePath: 'https://aac.saavncdn.com/cover.mp4',
        isOnline: true
      };

      const result = evaluateHardGates(meta, candidate);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Cover/Acoustic');
    });
  });

  describe('3. PRESET_SAAVN_320K_HITS Pre-Check Fast Path', () => {
    it('matches Illuminati instantly from preset catalog with 0 network calls', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const result = await matchYouTubeToCatalog('Illuminati', 'Sushin Shyam - Topic', 194, 'tOM-nWPcR4U');

      expect(result.status).toBe('MATCHED');
      if (result.status === 'MATCHED') {
        expect(result.song.bitrate).toBe(320);
        expect(result.song.isSaavn).toBe(true);
        expect(result.song.playbackMode).toBe('direct-catalog');
        expect(result.song.title).toBe('Illuminati');
      }
      // Zero network fetch calls made for pre-curated preset!
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('matches Naa Ready instantly from preset catalog', async () => {
      const result = await matchYouTubeToCatalog('Naa Ready (From "Leo")', 'Thalapathy Vijay', 248, 'szvt1vD0Uug');
      expect(result.status).toBe('MATCHED');
      if (result.status === 'MATCHED') {
        expect(result.song.album).toBe('Leo');
        expect(result.song.bitrate).toBe(320);
      }
    });

    it('does NOT match preset if user searched for a remix', async () => {
      const result = await matchYouTubeToCatalog('Illuminati Remix', 'DJ Remix', 194, 'remix_123');
      // Should not blindly accept the original preset!
      if (result.status === 'MATCHED') {
        expect(result.song.title.toLowerCase()).toContain('remix');
      } else {
        expect(result.status).toBe('UNMATCHED_FOREGROUND_ONLY');
      }
    });
  });

  describe('4. Universal Playlist Importer: Zero Dropped Tracks, All Saved As Playable Entries', () => {
    it('imports all tracks: 320k when matched, YouTube ExoPlayer stream when unmatched (zero UNAVAILABLE rows)', async () => {
      // Mock YouTube tracks: 2 matched (Illuminati, Naa Ready), 1 unmatched video
      const mockVideos = [
        {
          videoId: 'tOM-nWPcR4U',
          title: 'Illuminati',
          author: 'Sushin Shyam - Topic',
          lengthSeconds: 194,
          videoThumbnails: [{ url: 'https://thumb/1.jpg' }]
        },
        {
          videoId: 'unmatched_vid_999',
          title: 'Rare Unreleased Demo 1994 NonExistentSong',
          author: 'RandomUploader',
          lengthSeconds: 240,
          videoThumbnails: [{ url: 'https://thumb/2.jpg' }]
        },
        {
          videoId: 'szvt1vD0Uug',
          title: 'Naa Ready (From "Leo")',
          author: 'Anirudh Ravichander',
          lengthSeconds: 248,
          videoThumbnails: [{ url: 'https://thumb/3.jpg' }]
        },
        // Duplicate occurrence of Illuminati at index 3
        {
          videoId: 'tOM-nWPcR4U',
          title: 'Illuminati',
          author: 'Sushin Shyam - Topic',
          lengthSeconds: 194,
          videoThumbnails: [{ url: 'https://thumb/1.jpg' }]
        }
      ];

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('playlists')) {
          return {
            ok: true,
            json: async () => ({
              title: 'Tamil Playlist Test',
              playlistThumbnail: 'https://thumb/pl.jpg',
              videos: mockVideos
            })
          };
        }
        // Saavn search for unmatched returns empty results
        return {
          ok: true,
          json: async () => ({ data: { results: [] } })
        };
      }));

      const result = await importUniversalPlaylist('https://www.youtube.com/playlist?list=PL_TEST_320K');

      // 1. Total tracks in playlist entry list should be 4
      expect(result.totalTracks).toBe(4);
      expect(result.entries?.length).toBe(4);

      // 2. ZERO tracks dropped! ALL 4 tracks must be available and playable!
      for (const entry of result.entries || []) {
        expect(entry.status).toBe('available');
        expect(entry.songId).toBeTruthy();
      }

      // 3. Unmatched track at index 1 is saved as an ExoPlayer background-ready M4A stream!
      const unmatchedEntry = result.entries?.[1];
      expect(unmatchedEntry?.status).toBe('available');
      expect(unmatchedEntry?.songId).toBe('online_unmatched_vid_999');

      const unmatchedSong = result.songs.find((s) => s.id === 'online_unmatched_vid_999');
      expect(unmatchedSong).toBeDefined();
      expect(unmatchedSong?.format).toBe('M4A');
      expect(unmatchedSong?.bitrate).toBe(160);
      expect(unmatchedSong?.isForegroundOnly).toBe(false);
      expect(unmatchedSong?.playbackMode).toBe('direct-catalog');
      expect(unmatchedSong?.isDirectAudioStream).toBe(true);

      // 4. Duplicate occurrence (index 0 and index 3) must be preserved in exact order
      const entry0 = result.entries?.[0];
      const entry3 = result.entries?.[3];
      expect(entry0?.status).toBe('available');
      expect(entry3?.status).toBe('available');
      expect(entry0?.songId).toBe(entry3?.songId);
      expect(entry0?.entryId).not.toBe(entry3?.entryId);

      // 5. Matched count must reflect the 320k hits (indices 0, 2, 3), so matchedTracks = 3
      expect(result.matchedTracks).toBe(3);
      // Songs array contains all distinct playable songs (Illuminati, Naa Ready, unmatched M4A)
      expect(result.songs.length).toBe(3);
    });

    it('cleanly respects abort signal during import without orphaned requests', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        importUniversalPlaylist('https://www.youtube.com/playlist?list=PL_ABORT_TEST', undefined, controller.signal)
      ).rejects.toThrow();
    });
  });
});
