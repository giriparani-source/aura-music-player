import { describe, it, expect } from 'vitest';
import {
  parseLrcLyrics,
  parsePlainTextLyrics,
  findActiveLyricIndex,
  generateDemoSyncedLyrics
} from '../lyricsParser';

describe('lyricsParser', () => {
  describe('parseLrcLyrics', () => {
    it('parses standard LRC format lines correctly', () => {
      const lrc = `
        [ti: Test Song]
        [ar: Test Artist]
        [00:05.50] Intro melody begins
        [00:15.00] First verse lyrics
        [01:02.80] Chorus line
      `;
      const result = parseLrcLyrics(lrc);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ time: 5.5, text: 'Intro melody begins' });
      expect(result[1]).toEqual({ time: 15.0, text: 'First verse lyrics' });
      expect(result[2]).toEqual({ time: 62.8, text: 'Chorus line' });
    });

    it('ignores metadata header tags', () => {
      const lrc = '[ar: Anirudh]\n[al: Master]\n[by: Someone]\n[00:10.00] Line one';
      const result = parseLrcLyrics(lrc);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Line one');
    });

    it('returns an empty array for empty or non-string input', () => {
      expect(parseLrcLyrics('')).toEqual([]);
      expect(parseLrcLyrics('   ')).toEqual([]);
    });

    it('sorts lines chronologically even if out of order in LRC file', () => {
      const lrc = '[00:30.00] Second line\n[00:10.00] First line';
      const result = parseLrcLyrics(lrc);
      expect(result[0].text).toBe('First line');
      expect(result[1].text).toBe('Second line');
    });
  });

  describe('parsePlainTextLyrics', () => {
    it('splits multiline text into non-empty trimmed strings', () => {
      const plain = 'Line 1\n\n  Line 2  \nLine 3\n';
      const result = parsePlainTextLyrics(plain);
      expect(result).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('handles empty string gracefully', () => {
      expect(parsePlainTextLyrics('')).toEqual([]);
    });
  });

  describe('findActiveLyricIndex', () => {
    const mockLyrics = [
      { time: 10, text: 'Line 1' },
      { time: 20, text: 'Line 2' },
      { time: 35, text: 'Line 3' }
    ];

    it('returns -1 if currentTime is before the first lyric line', () => {
      expect(findActiveLyricIndex(mockLyrics, 5)).toBe(-1);
    });

    it('returns correct index at or after a timestamp', () => {
      expect(findActiveLyricIndex(mockLyrics, 10)).toBe(0);
      expect(findActiveLyricIndex(mockLyrics, 15)).toBe(0);
      expect(findActiveLyricIndex(mockLyrics, 20)).toBe(1);
      expect(findActiveLyricIndex(mockLyrics, 25)).toBe(1);
      expect(findActiveLyricIndex(mockLyrics, 35)).toBe(2);
      expect(findActiveLyricIndex(mockLyrics, 100)).toBe(2);
    });

    it('returns -1 for empty lyrics list', () => {
      expect(findActiveLyricIndex([], 15)).toBe(-1);
    });
  });

  describe('generateDemoSyncedLyrics', () => {
    it('generates demo lyric lines with strictly ascending timestamps', () => {
      const demo = generateDemoSyncedLyrics('Vaseegara', 'Bombay Jayashri', 240);
      expect(demo.length).toBeGreaterThan(0);

      for (let i = 1; i < demo.length; i++) {
        expect(demo[i].time).toBeGreaterThanOrEqual(demo[i - 1].time);
      }
    });
  });
});
