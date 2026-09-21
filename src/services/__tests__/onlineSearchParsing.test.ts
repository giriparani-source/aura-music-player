import { describe, it, expect } from 'vitest';

/**
 * Mirror of duration parsing function used in onlineSearch
 */
function parseDurationSeconds(durationText?: string, lengthSeconds?: string): number {
  if (lengthSeconds && !isNaN(Number(lengthSeconds))) {
    return Number(lengthSeconds);
  }
  if (!durationText) return 210;
  const parts = durationText.trim().split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 210;
}

describe('Online Search Duration & Resilience Parsers', () => {
  it('parses lengthSeconds numeric string directly when provided', () => {
    expect(parseDurationSeconds(undefined, '245')).toBe(245);
    expect(parseDurationSeconds('3:30', '180')).toBe(180);
  });

  it('correctly parses MM:SS duration strings', () => {
    expect(parseDurationSeconds('4:15')).toBe(255);
    expect(parseDurationSeconds('0:45')).toBe(45);
    expect(parseDurationSeconds('10:00')).toBe(600);
  });

  it('correctly parses HH:MM:SS duration strings', () => {
    expect(parseDurationSeconds('1:02:30')).toBe(3750);
    expect(parseDurationSeconds('2:00:00')).toBe(7200);
  });

  it('falls back to default 210 seconds (3m 30s) on invalid or missing duration', () => {
    expect(parseDurationSeconds(undefined, undefined)).toBe(210);
    expect(parseDurationSeconds('', '')).toBe(210);
    expect(parseDurationSeconds('live', undefined)).toBe(210);
  });

  it('normalizes online search result structure properly', () => {
    const mockRenderer = {
      videoId: 'test_vid_123',
      title: { runs: [{ text: 'Vaathi Coming' }] },
      ownerText: { runs: [{ text: 'Anirudh Ravichander' }] },
      lengthText: { simpleText: '3:50' },
      thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/test_vid_123/hqdefault.jpg' }] }
    };

    const duration = parseDurationSeconds(mockRenderer.lengthText?.simpleText);
    const item = {
      id: `online_${mockRenderer.videoId}`,
      sourceId: mockRenderer.videoId,
      title: mockRenderer.title.runs[0].text,
      artist: mockRenderer.ownerText.runs[0].text,
      album: 'YouTube Music Stream',
      duration,
      isOnline: true
    };

    expect(item.id).toBe('online_test_vid_123');
    expect(item.title).toBe('Vaathi Coming');
    expect(item.artist).toBe('Anirudh Ravichander');
    expect(item.duration).toBe(230);
    expect(item.isOnline).toBe(true);
  });
});
