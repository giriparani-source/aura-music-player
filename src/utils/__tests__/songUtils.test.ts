import { describe, it, expect } from 'vitest';
import { normalizeSong, getSongPath, getSongArtwork, getSongLastPlayed } from '../songUtils';
import { Song } from '../../types/music';

describe('Song Model Normalization & Canonical Accessors', () => {
  it('synchronizes path to filePath when only path is provided', () => {
    const raw: Partial<Song> = {
      id: 'test_1',
      title: 'Song A',
      path: '/music/song_a.mp3'
    };
    const normalized = normalizeSong(raw);
    expect(normalized.path).toBe('/music/song_a.mp3');
    expect(normalized.filePath).toBe('/music/song_a.mp3');
    expect(getSongPath(normalized)).toBe('/music/song_a.mp3');
  });

  it('synchronizes filePath to path when only filePath is provided', () => {
    const raw: Partial<Song> = {
      id: 'test_2',
      title: 'Song B',
      filePath: 'https://example.com/audio.m4a'
    };
    const normalized = normalizeSong(raw);
    expect(normalized.path).toBe('https://example.com/audio.m4a');
    expect(normalized.filePath).toBe('https://example.com/audio.m4a');
    expect(getSongPath(normalized)).toBe('https://example.com/audio.m4a');
  });

  it('synchronizes artwork and coverArt bidirectionally', () => {
    const withArtwork = normalizeSong({
      id: 'test_3',
      artwork: 'https://images.example.com/cover.jpg'
    });
    expect(withArtwork.artwork).toBe('https://images.example.com/cover.jpg');
    expect(withArtwork.coverArt).toBe('https://images.example.com/cover.jpg');
    expect(getSongArtwork(withArtwork)).toBe('https://images.example.com/cover.jpg');

    const withCoverArt = normalizeSong({
      id: 'test_4',
      coverArt: 'https://images.example.com/cover2.jpg'
    });
    expect(withCoverArt.artwork).toBe('https://images.example.com/cover2.jpg');
    expect(withCoverArt.coverArt).toBe('https://images.example.com/cover2.jpg');
    expect(getSongArtwork(withCoverArt)).toBe('https://images.example.com/cover2.jpg');
  });

  it('synchronizes lastPlayed and lastPlayedAt bidirectionally', () => {
    const timestamp = 1710000000000;
    const withLastPlayed = normalizeSong({
      id: 'test_5',
      lastPlayed: timestamp
    });
    expect(withLastPlayed.lastPlayed).toBe(timestamp);
    expect(withLastPlayed.lastPlayedAt).toBe(timestamp);
    expect(getSongLastPlayed(withLastPlayed)).toBe(timestamp);

    const withLastPlayedAt = normalizeSong({
      id: 'test_6',
      lastPlayedAt: timestamp + 500
    });
    expect(withLastPlayedAt.lastPlayed).toBe(timestamp + 500);
    expect(withLastPlayedAt.lastPlayedAt).toBe(timestamp + 500);
    expect(getSongLastPlayed(withLastPlayedAt)).toBe(timestamp + 500);
  });

  it('provides safe defaults for undefined or missing fields', () => {
    const minimal = normalizeSong({});
    expect(minimal.id).toBeTruthy();
    expect(minimal.title).toBe('Unknown Title');
    expect(minimal.artist).toBe('Unknown Artist');
    expect(minimal.album).toBe('Unknown Album');
    expect(minimal.duration).toBe(0);
    expect(minimal.playCount).toBe(0);
    expect(minimal.isFavorite).toBe(false);
    expect(minimal.format).toBe('mp3');
    expect(minimal.fileSize).toBe(0);
    expect(minimal.dateAdded).toBeGreaterThan(0);
  });
});
