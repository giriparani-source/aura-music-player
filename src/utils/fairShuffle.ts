import { Song } from '../types/music';

/**
 * True-Fair Shuffle Algorithm (Spotify-style Anti-Clustering)
 * Distributes tracks across the queue so that tracks from the same artist
 * or album are evenly spaced, avoiding consecutive repetitions.
 */
export function generateFairShuffleIndices(songs: Song[], currentIndex: number = 0): number[] {
  const total = songs.length;
  if (total <= 2) {
    return Array.from({ length: total }, (_, i) => i);
  }

  // Group track indices by artist (normalized)
  const artistGroups = new Map<string, number[]>();
  for (let i = 0; i < total; i++) {
    if (i === currentIndex) continue; // Keep current playing song at index 0
    const artistKey = (songs[i].artist || 'Unknown').trim().toLowerCase();
    if (!artistGroups.has(artistKey)) {
      artistGroups.set(artistKey, []);
    }
    artistGroups.get(artistKey)!.push(i);
  }

  // Shuffle individual tracks within each artist group first (Fisher-Yates)
  for (const list of artistGroups.values()) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }

  // Shuffle artist buckets beforehand so same-sized buckets do not retain original playlist order
  const allBuckets = Array.from(artistGroups.values());
  for (let i = allBuckets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allBuckets[i], allBuckets[j]] = [allBuckets[j], allBuckets[i]];
  }

  // Sort artist buckets by size descending (largest artist pool placed first with anti-clustering)
  const sortedBuckets = allBuckets.sort((a, b) => b.length - a.length);

  // Distribute tracks into an interleaved array with anti-clustering spacing
  const remainingCount = total - 1;
  const distributedSlots: (number | null)[] = new Array(remainingCount).fill(null);

  for (const bucket of sortedBuckets) {
    const k = bucket.length;
    if (k === 1) {
      // Single-track artist: distribute randomly across available slots
      const randomStart = Math.floor(Math.random() * remainingCount);
      let placed = false;
      for (let step = 0; step < remainingCount; step++) {
        const checkPos = (randomStart + step) % remainingCount;
        if (distributedSlots[checkPos] === null) {
          distributedSlots[checkPos] = bucket[0];
          placed = true;
          break;
        }
      }
      if (!placed) {
        const emptyIndex = distributedSlots.indexOf(null);
        if (emptyIndex !== -1) distributedSlots[emptyIndex] = bucket[0];
      }
    } else {
      // Multi-track artist: space tracks evenly with random phase offset to prevent clustering
      const interval = remainingCount / k;
      const baseOffset = Math.floor(Math.random() * interval);

      for (let idx = 0; idx < k; idx++) {
        const targetPos = Math.floor(baseOffset + idx * interval) % remainingCount;

        // Find nearest empty slot to avoid collisions
        let placed = false;
        for (let step = 0; step < remainingCount; step++) {
          const checkPos = (targetPos + step) % remainingCount;
          if (distributedSlots[checkPos] === null) {
            distributedSlots[checkPos] = bucket[idx];
            placed = true;
            break;
          }
        }
        if (!placed) {
          const emptyIndex = distributedSlots.indexOf(null);
          if (emptyIndex !== -1) {
            distributedSlots[emptyIndex] = bucket[idx];
          }
        }
      }
    }
  }

  // Filter out any potential nulls (safety guard)
  const validRemaining = distributedSlots.filter((x): x is number => x !== null);

  // Post-pass: check for adjacent same-artist songs and swap if possible
  for (let i = 0; i < validRemaining.length - 1; i++) {
    const currArtist = (songs[validRemaining[i]].artist || '').trim().toLowerCase();
    const nextArtist = (songs[validRemaining[i + 1]].artist || '').trim().toLowerCase();

    if (currArtist && currArtist === nextArtist) {
      // Find a non-matching song further down to swap
      for (let j = i + 2; j < validRemaining.length; j++) {
        const candidateArtist = (songs[validRemaining[j]].artist || '').trim().toLowerCase();
        if (candidateArtist !== currArtist) {
          const temp = validRemaining[i + 1];
          validRemaining[i + 1] = validRemaining[j];
          validRemaining[j] = temp;
          break;
        }
      }
    }
  }

  // Always put currently playing song at the beginning
  return [currentIndex, ...validRemaining];
}

/**
 * Standard pure random Fisher-Yates shuffle
 */
export function generatePureRandomIndices(length: number, currentIndex: number = 0): number[] {
  const indices = Array.from({ length }, (_, i) => i).filter((i) => i !== currentIndex);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return [currentIndex, ...indices];
}
