import { describe, it, expect } from 'vitest';
import { formatTime, formatBytes, getGreeting } from '../formatters';

describe('formatters', () => {
  describe('formatTime', () => {
    it('formats seconds into m:ss correctly', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(9)).toBe('0:09');
      expect(formatTime(45)).toBe('0:45');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(75)).toBe('1:15');
      expect(formatTime(301)).toBe('5:01');
    });

    it('handles negative, NaN, and falsy values safely', () => {
      expect(formatTime(-10)).toBe('0:00');
      expect(formatTime(NaN)).toBe('0:00');
      expect(formatTime(0)).toBe('0:00');
    });
  });

  describe('formatBytes', () => {
    it('formats 0 bytes as 0 MB', () => {
      expect(formatBytes(0)).toBe('0 MB');
    });

    it('formats kilobytes correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('formats megabytes correctly', () => {
      expect(formatBytes(1024 * 1024 * 5)).toBe('5 MB');
    });
  });

  describe('getGreeting', () => {
    it('returns a valid title and subtitle string', () => {
      const greeting = getGreeting();
      expect(greeting).toHaveProperty('title');
      expect(greeting).toHaveProperty('subtitle');
      expect(typeof greeting.title).toBe('string');
      expect(typeof greeting.subtitle).toBe('string');
      expect(greeting.title.length).toBeGreaterThan(0);
      expect(greeting.subtitle.length).toBeGreaterThan(0);
    });
  });
});
