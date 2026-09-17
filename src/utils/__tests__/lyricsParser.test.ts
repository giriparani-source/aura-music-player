import { describe, it, expect } from 'vitest';
import {
  parseLrcLyrics,
  parsePlainTextLyrics,
  findActiveLyricIndex,
  applySyncOffset,
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

    it('parses millisecond timestamps [mm:ss.xxx] accurately', () => {
      const lrc = `
        [00:12.345] Millisecond precise line
        [02:05.876] Late song segment
      `;
      const result = parseLrcLyrics(lrc);
      expect(result).toHaveLength(2);
      expect(result[0].time).toBeCloseTo(12.345, 3);
      expect(result[0].text).toBe('Millisecond precise line');
      expect(result[1].time).toBeCloseTo(125.876, 3);
    });

    it('handles multiple timestamps on the same lyric line and sorts them', () => {
      const lrc = `[00:10.00][00:25.50] Hook repeated twice`;
      const result = parseLrcLyrics(lrc);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ time: 10, text: 'Hook repeated twice' });
      expect(result[1]).toEqual({ time: 25.5, text: 'Hook repeated twice' });
    });

    it('ignores metadata header tags', () => {
      const lrc = '[ar: Anirudh]\n[al: Master]\n[by: Someone]\n[length: 03:45]\n[00:10.00] Line one';
      const result = parseLrcLyrics(lrc);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Line one');
    });

    it('handles malformed LRC lines safely without throwing', () => {
      const malformed = `
        This is not a timestamp line
        [not:timestamp] Some text
        [999:999] Out of range
        [00:04.20] Valid line
        [bad]
      `;
      expect(() => parseLrcLyrics(malformed)).not.toThrow();
      const result = parseLrcLyrics(malformed);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Valid line');
    });

    it('returns an empty array for empty or non-string input', () => {
      expect(parseLrcLyrics('')).toEqual([]);
      expect(parseLrcLyrics('   ')).toEqual([]);
    });

    it('sorts lines chronologically even if out of order in LRC file', () => {
      const lrc = '[00:30.00] Second line\n[00:10.00] First line\n[00:05.00] Intro line';
      const result = parseLrcLyrics(lrc);
      expect(result[0].text).toBe('Intro line');
      expect(result[0].time).toBe(5);
      expect(result[1].text).toBe('First line');
      expect(result[1].time).toBe(10);
      expect(result[2].text).toBe('Second line');
      expect(result[2].time).toBe(30);
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

  describe('applySyncOffset', () => {
    it('shifts timestamps forward with positive offset', () => {
      expect(applySyncOffset(10.0, 0.5)).toBe(10.5);
      expect(applySyncOffset(12.345, 0.5)).toBe(12.845);
    });

    it('shifts timestamps backward with negative offset', () => {
      expect(applySyncOffset(10.0, -0.5)).toBe(9.5);
    });

    it('clamps negative results at 0 seconds minimum', () => {
      expect(applySyncOffset(0.2, -0.5)).toBe(0);
      expect(applySyncOffset(0.0, -1.0)).toBe(0);
    });

    it('leaves time unchanged when offset is 0', () => {
      expect(applySyncOffset(45.2, 0)).toBe(45.2);
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

    it('correctly reflects active line when sync offset is incorporated', () => {
      // At 9.6s, standard lookup would be -1 (before 10s)
      expect(findActiveLyricIndex(mockLyrics, 9.6)).toBe(-1);

      // With a +0.5s offset applied, effective lookup is 10.1s -> triggers Line 1 (index 0)
      const adjustedTime = applySyncOffset(9.6, 0.5);
      expect(findActiveLyricIndex(mockLyrics, adjustedTime)).toBe(0);
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
