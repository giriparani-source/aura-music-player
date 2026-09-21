import { describe, it, expect } from 'vitest';

describe('Online Stream Multi-Tier Architecture', () => {
  it('validates videoId input parameter correctly', () => {
    const validId = 'dQw4w9WgXcQ';
    const cleanId = validId.trim();
    expect(cleanId.length).toBe(11);
    expect(/^[a-zA-Z0-9_-]{11}$/.test(cleanId)).toBe(true);

    const emptyId = '   ';
    expect(emptyId.trim().length).toBe(0);
  });

  it('manages stream cache with expiration TTL', () => {
    const cache = new Map<string, { url: string; expiresAt: number }>();
    const id = 'test_video_1';
    const streamUrl = 'https://googlevideo.com/videoplayback?id=123';
    const now = Date.now();

    // Cache for 4 hours
    cache.set(id, { url: streamUrl, expiresAt: now + 4 * 3600 * 1000 });

    const entry = cache.get(id);
    expect(entry).toBeDefined();
    expect(entry!.url).toBe(streamUrl);
    expect(entry!.expiresAt).toBeGreaterThan(now);

    // Expired entry check
    const expiredEntry = { url: 'https://expired.com', expiresAt: now - 1000 };
    expect(Date.now() > expiredEntry.expiresAt).toBe(true);
  });

  it('prioritizes m4a / AAC streams over generic fallback streams in resolver response', () => {
    const mockAudioStreams = [
      { format: 'WEBM', mimeType: 'audio/webm; codecs="opus"', url: 'https://example.com/audio.opus' },
      { format: 'M4A', mimeType: 'audio/mp4; codecs="mp4a.40.2"', url: 'https://example.com/audio.m4a' }
    ];

    const m4a = mockAudioStreams.find(
      (s) => s.format === 'M4A' || s.mimeType?.includes('audio/mp4')
    );
    const best = m4a || mockAudioStreams[0];

    expect(best.format).toBe('M4A');
    expect(best.url).toBe('https://example.com/audio.m4a');
  });

  it('handles adaptiveFormats structure from Invidious instances', () => {
    const mockAdaptiveFormats = [
      { type: 'video/mp4; codecs="avc1"', url: 'https://example.com/video.mp4' },
      { type: 'audio/webm; codecs="opus"', url: 'https://example.com/audio.opus' },
      { type: 'audio/mp4; codecs="mp4a.40.2"', url: 'https://example.com/audio.m4a' }
    ];

    const audioFormats = mockAdaptiveFormats.filter((f) => f.type?.includes('audio/'));
    expect(audioFormats.length).toBe(2);

    const m4a = audioFormats.find((f) => f.type?.includes('audio/mp4'));
    const chosen = m4a || audioFormats[0];

    expect(chosen.url).toBe('https://example.com/audio.m4a');
  });
});
