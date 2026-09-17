import { describe, it, expect } from 'vitest';
import { fuzzySearchSongs } from '../fuzzySearch';
import { Song } from '../../types/music';

function makeSong(overrides: Partial<Song>): Song {
  return {
    id: overrides.id || `song_${Math.random().toString(36).slice(2)}`,
    title: overrides.title || 'Untitled',
    artist: overrides.artist || 'Unknown',
    album: overrides.album || 'Unknown',
    fileName: overrides.fileName || `${overrides.title || 'song'}.mp3`,
    path: overrides.path || '/songs/test.mp3',
    filePath: overrides.filePath || '/songs/test.mp3',
    duration: overrides.duration ?? 200,
    fileSize: overrides.fileSize ?? 5000000,
    format: 'mp3',
    playCount: 0,
    dateAdded: overrides.dateAdded ?? 1000,
    isFavorite: false,
    folder: overrides.folder || 'Music'
  };
}

describe('fuzzySearch', () => {
  const library: Song[] = [
    makeSong({ id: '1', title: 'Vaseegara', artist: 'Bombay Jayashri', album: 'Minnale' }),
    makeSong({ id: '2', title: 'Hukum - Thalaivar Alappara', artist: 'Anirudh Ravichander', album: 'Jailer' }),
    makeSong({ id: '3', title: 'Badass', artist: 'Anirudh Ravichander', album: 'Leo' }),
    makeSong({ id: '4', title: 'Arabic Kuthu', artist: 'Anirudh Ravichander', album: 'Beast' }),
    makeSong({ id: '5', title: 'Interstellar Theme', artist: 'Hans Zimmer', album: 'Interstellar' })
  ];

  it('returns all songs when query is empty or whitespace', () => {
    expect(fuzzySearchSongs(library, '')).toHaveLength(library.length);
    expect(fuzzySearchSongs(library, '   ')).toHaveLength(library.length);
  });

  it('finds songs by exact title match', () => {
    const results = fuzzySearchSongs(library, 'Vaseegara');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Vaseegara');
  });

  it('finds songs by artist name', () => {
    const results = fuzzySearchSongs(library, 'Anirudh');
    expect(results.length).toBe(3);
    expect(results.every((s) => s.artist.includes('Anirudh'))).toBe(true);
  });

  it('performs fuzzy character subsequence matching (e.g. anrdh -> Anirudh)', () => {
    const results = fuzzySearchSongs(library, 'anrdh');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((s) => s.artist.includes('Anirudh'))).toBe(true);
  });

  it('returns empty array when no song matches the query', () => {
    const results = fuzzySearchSongs(library, 'xyz123randomnonexistentquery');
    expect(results).toHaveLength(0);
  });

  it('prioritizes exact title match over partial matches', () => {
    const results = fuzzySearchSongs(library, 'badass');
    expect(results[0].title).toBe('Badass');
  });
});
