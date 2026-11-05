import { describe, it, expect } from 'vitest';
import {
  detectDuplicates,
  normalizeTitleForComparison,
  areArtistsCompatible,
  extractVersionTags
} from '../duplicateService';
import { Song } from '../../types/music';

function makeSong(overrides: Partial<Song>): Song {
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
    isFavorite: overrides.isFavorite || false
  };
}

describe('duplicateService - Intelligent Duplicate Identification & Recommendations', () => {
  describe('detectDuplicates', () => {
    it('returns empty array when no duplicate tracks exist', () => {
      const distinctSongs: Song[] = [
        makeSong({ id: '1', title: 'Hukum', artist: 'Anirudh', duration: 236, fileSize: 8000000 }),
        makeSong({ id: '2', title: 'Vaseegara', artist: 'Bombay Jayashri', duration: 301, fileSize: 10000000 }),
        makeSong({ id: '3', title: 'Badass', artist: 'Anirudh', duration: 195, fileSize: 6500000 })
      ];

      const duplicates = detectDuplicates(distinctSongs);
      expect(duplicates).toHaveLength(0);
    });

    it('Scenario 1: Same song with different filenames and website watermarks', () => {
      const songs: Song[] = [
        makeSong({
          id: '1',
          title: 'Hukum - Thalaivar Alappara',
          artist: 'Anirudh Ravichander',
          fileName: '[Masstamilan] Hukum.mp3',
          duration: 236,
          fileSize: 8500000
        }),
        makeSong({
          id: '2',
          title: '01 - Hukum (Thalaivar Alappara) [320kbps]',
          artist: 'Anirudh Ravichander',
          fileName: 'Hukum_320k (1).mp3',
          duration: 236,
          fileSize: 8500000
        })
      ];

      const duplicates = detectDuplicates(songs);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].matchKind).toBe('exact');
      expect(duplicates[0].confidence).toBe('high');
      expect(duplicates[0].songs).toHaveLength(2);
    });

    it('Scenario 2: Same song with different file extensions (MP3 vs FLAC)', () => {
      const songs: Song[] = [
        makeSong({
          id: 'mp3_song',
          title: 'Illuminati',
          artist: 'Sushin Shyam',
          fileName: 'Illuminati.mp3',
          format: 'mp3',
          bitrate: 320,
          duration: 194,
          fileSize: 7700000
        }),
        makeSong({
          id: 'flac_song',
          title: 'Illuminati',
          artist: 'Sushin Shyam',
          fileName: 'Illuminati.flac',
          format: 'flac',
          duration: 194,
          fileSize: 26000000
        })
      ];

      const duplicates = detectDuplicates(songs);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].matchKind).toBe('exact');
      // Recommends keeping FLAC over MP3
      expect(duplicates[0].recommendedKeepSongId).toBe('flac_song');
      expect(duplicates[0].recommendationReason).toContain('FLAC');
    });

    it('Scenario 3: Same title but different artists must NEVER be treated as duplicates', () => {
      const songs: Song[] = [
        makeSong({
          id: 'anirudh_hukum',
          title: 'Hukum',
          artist: 'Anirudh Ravichander',
          duration: 236
        }),
        makeSong({
          id: 'dsp_hukum',
          title: 'Hukum',
          artist: 'Devi Sri Prasad',
          duration: 236
        }),
        makeSong({
          id: 'intro_artist_1',
          title: 'Intro',
          artist: 'A. R. Rahman',
          duration: 90
        }),
        makeSong({
          id: 'intro_artist_2',
          title: 'Intro',
          artist: 'Yuvan Shankar Raja',
          duration: 90
        })
      ];

      const duplicates = detectDuplicates(songs);
      // Zero duplicates because artists are completely different!
      expect(duplicates).toHaveLength(0);
    });

    it('Scenario 4: Remix versus original classified as version_remix with explanation', () => {
      const songs: Song[] = [
        makeSong({
          id: 'orig',
          title: 'Why This Kolaveri Di',
          artist: 'Anirudh Ravichander, Dhanush',
          duration: 250,
          fileSize: 9000000
        }),
        makeSong({
          id: 'remix',
          title: 'Why This Kolaveri Di (Club Remix)',
          artist: 'Anirudh Ravichander',
          duration: 250,
          fileSize: 9000000
        })
      ];

      const duplicates = detectDuplicates(songs);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].matchKind).toBe('version_remix');
      expect(duplicates[0].confidence).toBe('high');
      expect(duplicates[0].recommendationReason).toContain('remix');
    });

    it('Scenario 5: Audio quality difference recommends keeping higher bitrate copy', () => {
      const songs: Song[] = [
        makeSong({
          id: 'low_q',
          title: 'Master The Blaster',
          artist: 'Anirudh',
          bitrate: 128,
          duration: 180,
          fileSize: 2800000
        }),
        makeSong({
          id: 'high_q',
          title: 'Master The Blaster',
          artist: 'Anirudh',
          bitrate: 320,
          duration: 180,
          fileSize: 7200000
        })
      ];

      const duplicates = detectDuplicates(songs);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].recommendedKeepSongId).toBe('high_q');
      expect(duplicates[0].recommendationReason).toContain('320 kbps');
    });

    it('Scenario 6: Similar titles that are not duplicates are rejected', () => {
      const songs: Song[] = [
        makeSong({
          id: '1',
          title: 'Kadharulz',
          artist: 'Harris Jayaraj',
          duration: 210
        }),
        makeSong({
          id: '2',
          title: 'Kadhale Kadhale',
          artist: 'Govind Vasantha',
          duration: 215
        }),
        makeSong({
          id: '3',
          title: 'Theme Song 1',
          artist: 'Anirudh',
          duration: 120
        }),
        makeSong({
          id: '4',
          title: 'Theme Song 2',
          artist: 'Anirudh',
          duration: 120
        })
      ];

      const duplicates = detectDuplicates(songs);
      expect(duplicates).toHaveLength(0);
    });

    it('Scenario 7: Prefers user favorite and frequently played track when qualities are equal', () => {
      const songs: Song[] = [
        makeSong({
          id: 'unplayed_copy',
          title: 'Arabic Kuthu',
          artist: 'Anirudh',
          duration: 280,
          fileSize: 9000000,
          playCount: 0,
          isFavorite: false
        }),
        makeSong({
          id: 'favorite_copy',
          title: 'Arabic Kuthu (1)',
          artist: 'Anirudh',
          duration: 280,
          fileSize: 9000000,
          playCount: 15,
          isFavorite: true
        })
      ];

      const duplicates = detectDuplicates(songs);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].recommendedKeepSongId).toBe('favorite_copy');
      expect(duplicates[0].recommendationReason).toContain('favorite');
    });

    it('handles empty song list safely', () => {
      expect(detectDuplicates([])).toEqual([]);
    });
  });

  describe('Feature Helpers', () => {
    it('extractVersionTags detects remix, acoustic, live keywords', () => {
      expect(extractVersionTags('Kolaveri (Club Remix)')).toContain('remix');
      expect(extractVersionTags('Vaseegara Unplugged Live')).toEqual(expect.arrayContaining(['unplugged', 'live']));
      expect(extractVersionTags('Plain Song')).toHaveLength(0);
    });

    it('normalizeTitleForComparison strips watermarks, copy numbers, quality tags', () => {
      const { baseTitle } = normalizeTitleForComparison('[Masstamilan.com] 01 - Hukum (320kbps) - Copy.mp3');
      expect(baseTitle).toBe('hukum');
    });

    it('areArtistsCompatible distinguishes different artists correctly', () => {
      expect(areArtistsCompatible('Anirudh', 'Anirudh Ravichander').compatible).toBe(true);
      expect(areArtistsCompatible('A. R. Rahman', 'Yuvan Shankar Raja').compatible).toBe(false);
      expect(areArtistsCompatible('Unknown Artist', 'Anirudh').compatible).toBe(true);
    });
  });
});
