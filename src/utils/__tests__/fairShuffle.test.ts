import { describe, it, expect } from 'vitest';
import { generateFairShuffleIndices, generatePureRandomIndices, reshuffleUpcomingIndices } from '../fairShuffle';
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

    it('anti-clusters collaborating artists sharing a common name (e.g. "Anirudh, Jonita")', () => {
      const songs = [
        makeSong('1', 'Arabic Kuthu', 'Anirudh Ravichander, Jonita Gandhi'),
        makeSong('2', 'Naa Ready', 'Anirudh Ravichander, Thalapathy Vijay'),
        makeSong('3', 'Hukum', 'Anirudh Ravichander'),
        makeSong('4', 'Munbe Vaa', 'A.R. Rahman, Shreya Ghoshal'),
        makeSong('5', 'Vaseegara', 'Harris Jayaraj, Bombay Jayashri'),
        makeSong('6', 'Oru Naalil', 'Yuvan Shankar Raja')
      ];

      const result = generateFairShuffleIndices(songs, 0);
      expect(result).toHaveLength(6);

      // Verify that Arab Kuthu and Naa Ready and Hukum are not all clustered consecutively
      let consecutiveAnirudhCollabs = 0;
      for (let i = 0; i < result.length - 1; i++) {
        const a1 = songs[result[i]].artist.toLowerCase();
        const a2 = songs[result[i + 1]].artist.toLowerCase();
        if (a1.includes('anirudh') && a2.includes('anirudh')) {
          consecutiveAnirudhCollabs++;
        }
      }
      expect(consecutiveAnirudhCollabs).toBeLessThanOrEqual(1);
    });

    it('anti-clusters tracks from the same album/soundtrack', () => {
      const songs: Song[] = [
        { ...makeSong('1', 'Leo Track 1', 'Anirudh'), album: 'Leo' },
        { ...makeSong('2', 'Leo Track 2', 'Vijay'), album: 'Leo' },
        { ...makeSong('3', 'Leo Track 3', 'Asal Kolaar'), album: 'Leo' },
        { ...makeSong('4', 'Jailer Track 1', 'Anirudh'), album: 'Jailer' },
        { ...makeSong('5', 'Vikram Track 1', 'Anirudh'), album: 'Vikram' },
        { ...makeSong('6', 'Master Track 1', 'Anirudh'), album: 'Master' }
      ];

      const result = generateFairShuffleIndices(songs, 0);
      let adjacentLeoCount = 0;
      for (let i = 0; i < result.length - 1; i++) {
        if (songs[result[i]].album === 'Leo' && songs[result[i + 1]].album === 'Leo') {
          adjacentLeoCount++;
        }
      }
      expect(adjacentLeoCount).toBeLessThanOrEqual(1);
    });
  });

  describe('reshuffleUpcomingIndices', () => {
    it('preserves history and current playing track position while shuffling upcoming tracks', () => {
      const songs = Array.from({ length: 8 }, (_, i) => makeSong(`${i}`, `Track ${i}`, `Artist ${i}`));
      // Initial shuffle order: [0, 1, 2, 3, 4, 5, 6, 7]
      const currentOrder = [0, 1, 2, 3, 4, 5, 6, 7];
      const currentQueueIndex = 2; // User is at index 2 (position 2)

      const reshuffled = reshuffleUpcomingIndices(songs, currentQueueIndex, currentOrder);

      // Positions 0, 1, 2 must remain identical!
      expect(reshuffled[0]).toBe(0);
      expect(reshuffled[1]).toBe(1);
      expect(reshuffled[2]).toBe(2);

      // Length must be preserved and all elements must be unique
      expect(reshuffled).toHaveLength(8);
      expect(new Set(reshuffled).size).toBe(8);
    });
  });
});
