import { describe, it, expect } from 'vitest';
import { detectDuplicates } from '../duplicateService';
import { Song } from '../../types/music';

function makeSong(overrides: Partial<Song>): Song {
  return {
    id: overrides.id || `song_${Math.random().toString(36).slice(2)}`,
    title: overrides.title || 'Sample Title',
    artist: overrides.artist || 'Sample Artist',
    album: overrides.album || 'Sample Album',
    fileName: overrides.fileName || 'Sample.mp3',
    path: overrides.path || '/songs/Sample.mp3',
    filePath: overrides.filePath || '/songs/Sample.mp3',
    duration: overrides.duration ?? 210,
    fileSize: overrides.fileSize ?? 5000000,
    format: 'mp3',
    playCount: 0,
    dateAdded: Date.now(),
    isFavorite: false
  };
}

describe('duplicateService', () => {
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

    it('identifies exact duplicate tracks with matching title, artist, and duration', () => {
      const songsWithDupes: Song[] = [
        makeSong({
          id: 'orig_1',
          title: 'Arabic Kuthu',
          artist: 'Anirudh',
          duration: 280,
          fileSize: 9000000,
          fileName: 'Arabic Kuthu.mp3'
        }),
        makeSong({
          id: 'dupe_1',
          title: 'Arabic Kuthu',
          artist: 'Anirudh',
          duration: 280,
          fileSize: 9000000,
          fileName: 'Arabic Kuthu (1).mp3'
        })
      ];

      const duplicates = detectDuplicates(songsWithDupes);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].songs).toHaveLength(2);
      expect(duplicates[0].canonicalTitle).toBe('Arabic Kuthu');
      expect(duplicates[0].similarityScore).toBeGreaterThanOrEqual(50);
      expect(duplicates[0].reasons.length).toBeGreaterThan(0);
    });

    it('identifies copies with copy suffixes, bitrate tags, or numbering', () => {
      const songs: Song[] = [
        makeSong({
          id: '1',
          title: 'Illuminati',
          artist: 'Sushin Shyam',
          duration: 194,
          fileSize: 7700000
        }),
        makeSong({
          id: '2',
          title: 'Illuminati 320kbps - copy',
          artist: 'Sushin Shyam',
          duration: 194,
          fileSize: 7710000
        })
      ];

      const duplicates = detectDuplicates(songs);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].songs).toHaveLength(2);
    });

    it('handles empty song list safely', () => {
      expect(detectDuplicates([])).toEqual([]);
    });
  });
});
