import { describe, it, expect } from 'vitest';
import { generateFairShuffleIndices, generatePureRandomIndices } from '../fairShuffle';
import { Song } from '../../types/music';

function makeSong(id: string, title: string, artist: string): Song {
  return {
    id,
    title,
    artist,
    album: 'Album',
    fileName: `${title}.mp3`,
    path: `/songs/${title}.mp3`,
    filePath: `/songs/${title}.mp3`,
    duration: 200,
    fileSize: 4000000,
    format: 'mp3',
    playCount: 0,
    dateAdded: Date.now(),
    isFavorite: false
  };
}

describe('fairShuffle', () => {
  describe('generatePureRandomIndices', () => {
    it('always preserves currentIndex at the first position', () => {
      const result = generatePureRandomIndices(10, 4);
      expect(result[0]).toBe(4);
    });

    it('contains every index exactly once', () => {
      const length = 20;
      const result = generatePureRandomIndices(length, 0);
      expect(result).toHaveLength(length);
      const sorted = [...result].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length }, (_, i) => i));
    });
  });

  describe('generateFairShuffleIndices', () => {
    it('returns standard indices for array with <= 2 songs', () => {
      const oneSong = [makeSong('1', 'Song 1', 'Artist A')];
      expect(generateFairShuffleIndices(oneSong, 0)).toEqual([0]);

      const twoSongs = [
        makeSong('1', 'Song 1', 'Artist A'),
        makeSong('2', 'Song 2', 'Artist B')
      ];
      expect(generateFairShuffleIndices(twoSongs, 0)).toEqual([0, 1]);
    });

    it('always keeps the currentIndex at index 0', () => {
      const songs = [
        makeSong('1', 'Track 1', 'Anirudh'),
        makeSong('2', 'Track 2', 'Rahman'),
        makeSong('3', 'Track 3', 'Harris'),
        makeSong('4', 'Track 4', 'Yuvan'),
        makeSong('5', 'Track 5', 'Ilaiyaraaja')
      ];

      const result = generateFairShuffleIndices(songs, 2);
      expect(result[0]).toBe(2);
      expect(result).toHaveLength(5);
    });

    it('contains all original track indices without duplicates or omissions', () => {
      const songs = [
        makeSong('1', 'A1', 'Anirudh'),
        makeSong('2', 'A2', 'Anirudh'),
        makeSong('3', 'A3', 'Anirudh'),
        makeSong('4', 'R1', 'Rahman'),
        makeSong('5', 'R2', 'Rahman'),
        makeSong('6', 'H1', 'Harris'),
        makeSong('7', 'Y1', 'Yuvan')
      ];

      const result = generateFairShuffleIndices(songs, 0);
      expect(result).toHaveLength(songs.length);

      const uniqueIndices = new Set(result);
      expect(uniqueIndices.size).toBe(songs.length);
    });

    it('anti-clusters: separates tracks from dominant artist across the queue', () => {
      // 5 Anirudh songs and 5 other artists
      const songs = [
        makeSong('1', 'A1', 'Anirudh'),
        makeSong('2', 'A2', 'Anirudh'),
        makeSong('3', 'A3', 'Anirudh'),
        makeSong('4', 'A4', 'Anirudh'),
        makeSong('5', 'A5', 'Anirudh'),
        makeSong('6', 'R1', 'Rahman'),
        makeSong('7', 'H1', 'Harris'),
        makeSong('8', 'Y1', 'Yuvan'),
        makeSong('9', 'I1', 'Ilaiyaraaja'),
        makeSong('10', 'S1', 'Santhosh')
      ];

      const result = generateFairShuffleIndices(songs, 0);

      // Check how many adjacent same-artist pairs exist in the shuffle
      let adjacentSameArtistCount = 0;
      for (let i = 1; i < result.length - 1; i++) {
        if (songs[result[i]].artist === songs[result[i + 1]].artist) {
          adjacentSameArtistCount++;
        }
      }

      // In a fair shuffle of 5 dominant / 5 other, adjacent same-artist should be heavily minimized (at most 1-2)
      expect(adjacentSameArtistCount).toBeLessThanOrEqual(2);
    });
  });
});
