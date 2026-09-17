import { Song } from '../types/music';

interface ScoredSong {
  song: Song;
  score: number;
}

/**
 * Normalizes string for fast fuzzy search comparison
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Calculates a match score between a search query and a target string
 */
function calculateFieldScore(target: string, query: string, normQuery: string): number {
  if (!target) return 0;
  const lowerTarget = target.toLowerCase();
  const normTarget = normalizeText(target);

  // 1. Exact match
  if (lowerTarget === query || normTarget === normQuery) {
    return 100;
  }

  // 2. Starts with query
  if (lowerTarget.startsWith(query) || normTarget.startsWith(normQuery)) {
    return 80;
  }

  // 3. Word boundary match (e.g. "Badass" matches "Badass Song")
  const words = lowerTarget.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(query)) {
      return 70;
    }
  }

  // 4. Substring match
  if (lowerTarget.includes(query) || normTarget.includes(normQuery)) {
    return 50;
  }

  // 5. Fuzzy character subsequence match (e.g. "anrdh" matches "anirudh")
  let queryIdx = 0;
  for (let i = 0; i < normTarget.length && queryIdx < normQuery.length; i++) {
    if (normTarget[i] === normQuery[queryIdx]) {
      queryIdx++;
    }
  }
  if (queryIdx === normQuery.length && normQuery.length >= 3) {
    return 30;
  }

  return 0;
}

/**
 * Fast fuzzy search across songs collection with relevance ranking
 */
export function fuzzySearchSongs(songs: Song[], rawQuery: string): Song[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return songs;

  const normQuery = normalizeText(query);
  const scored: ScoredSong[] = [];

  for (const song of songs) {
    let maxScore = 0;

    // Check title (weight: 1.5x)
    const titleScore = calculateFieldScore(song.title, query, normQuery) * 1.5;
    if (titleScore > maxScore) maxScore = titleScore;

    // Check artist (weight: 1.3x)
    const artist = song.artist !== 'Not set' ? song.artist : '';
    const artistScore = calculateFieldScore(artist, query, normQuery) * 1.3;
    if (artistScore > maxScore) maxScore = artistScore;

    // Check album (weight: 1.1x)
    const album = song.album !== 'Not set' ? song.album : '';
    const albumScore = calculateFieldScore(album, query, normQuery) * 1.1;
    if (albumScore > maxScore) maxScore = albumScore;

    // Check folder name (e.g. "Anirudh Hits", "Vijay Special")
    const folder = song.folder || '';
    const folderScore = calculateFieldScore(folder, query, normQuery) * 1.2;
    if (folderScore > maxScore) maxScore = folderScore;

    // Check fileName fallback
    const fileScore = calculateFieldScore(song.fileName, query, normQuery);
    if (fileScore > maxScore) maxScore = fileScore;

    if (maxScore > 25) {
      scored.push({ song, score: maxScore });
    }
  }

  // Sort by score descending, then by dateAdded descending
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.song.dateAdded - a.song.dateAdded;
  });

  return scored.map((item) => item.song);
}
