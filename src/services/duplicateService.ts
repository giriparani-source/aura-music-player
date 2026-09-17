import { Song, DuplicateGroup } from '../types/music';

/**
 * Normalizes title string for duplicate comparison:
 * lowercase, stripped of punctuation, numbers, quality tags, and copy suffixes
 */
function normalizeForComparison(str: string): string {
  if (!str) return '';
  let s = str.toLowerCase();
  s = s.replace(/\.[a-z0-9]+$/, ''); // remove extension
  s = s.replace(/\([0-9]+\)/g, ''); // remove (1), (2)
  s = s.replace(/copy of /g, '');
  s = s.replace(/- copy/g, '');
  s = s.replace(/320kbps|128kbps|_320/g, '');
  s = s.replace(/[^a-z0-9]/g, ''); // remove all non-alphanumeric
  return s.trim();
}

/**
 * Calculates Levenshtein similarity ratio between two strings (0.0 to 1.0)
 */
function stringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1.0;

  // Simple bigram Dice coefficient for fast matching
  if (len1 < 2 || len2 < 2) return s1 === s2 ? 1.0 : 0.0;

  const s1Bigrams = new Set<string>();
  for (let i = 0; i < len1 - 1; i++) {
    s1Bigrams.add(s1.substring(i, i + 2));
  }

  let intersection = 0;
  for (let i = 0; i < len2 - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    if (s1Bigrams.has(bigram)) {
      intersection++;
    }
  }

  return (2.0 * intersection) / (len1 - 1 + len2 - 1);
}

/**
 * Analyzes library songs and identifies possible duplicate groups based on multi-factor scoring
 */
export function detectDuplicates(songs: Song[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const visited = new Set<string>();

  // Precompute normalized strings in a single O(N) pass to eliminate redundant regex executions in O(N^2) loop
  const precomputed = songs.map((song) => ({
    song,
    normTitle: normalizeForComparison(song.title || song.fileName),
    normArtist: normalizeForComparison(song.artist !== 'Not set' ? song.artist : '')
  }));

  for (let i = 0; i < precomputed.length; i++) {
    const itemA = precomputed[i];
    const songA = itemA.song;
    if (visited.has(songA.id)) continue;

    const matchedSongs: Song[] = [songA];
    const groupReasons = new Set<string>();
    let highestScore = 0;

    const normTitleA = itemA.normTitle;
    const normArtistA = itemA.normArtist;

    for (let j = i + 1; j < precomputed.length; j++) {
      const itemB = precomputed[j];
      const songB = itemB.song;
      if (visited.has(songB.id)) continue;

      const normTitleB = itemB.normTitle;
      const normArtistB = itemB.normArtist;

      let score = 0;
      const reasons: string[] = [];

      // 1. Exact or near title match
      const titleSim = stringSimilarity(normTitleA, normTitleB);
      if (normTitleA === normTitleB && normTitleA.length > 2) {
        score += 45;
        reasons.push('Identical normalized title');
      } else if (titleSim >= 0.8) {
        score += 35;
        reasons.push(`Very similar title (${Math.round(titleSim * 100)}% match)`);
      }

      // 2. Exact or near duration match
      if (songA.duration > 0 && songB.duration > 0) {
        const durationDiff = Math.abs(songA.duration - songB.duration);
        if (durationDiff === 0) {
          score += 30;
          reasons.push('Exact same duration');
        } else if (durationDiff <= 2) {
          score += 20;
          reasons.push(`Near duration (${durationDiff}s difference)`);
        }
      }

      // 3. File size proximity
      if (songA.fileSize > 0 && songB.fileSize > 0) {
        const sizeDiff = Math.abs(songA.fileSize - songB.fileSize);
        const sizeRatio = sizeDiff / Math.max(songA.fileSize, songB.fileSize);
        if (sizeRatio < 0.02) {
          score += 20;
          reasons.push('Identical or near file size');
        } else if (sizeRatio < 0.1) {
          score += 10;
          reasons.push('Close file size');
        }
      }

      // 4. Artist match
      if (normArtistA && normArtistB && normArtistA === normArtistB) {
        score += 15;
        reasons.push('Same artist');
      }

      // Threshold: 50+ points out of 110 indicates high-probability duplicate
      if (score >= 50) {
        matchedSongs.push(songB);
        visited.add(songB.id);
        reasons.forEach((r) => groupReasons.add(r));
        if (score > highestScore) highestScore = score;
      }
    }

    if (matchedSongs.length > 1) {
      visited.add(songA.id);
      groups.push({
        id: 'dup-' + songA.id,
        canonicalTitle: songA.title,
        similarityScore: Math.min(100, highestScore),
        reasons: Array.from(groupReasons),
        songs: matchedSongs
      });
    }
  }

  return groups;
}
