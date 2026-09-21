import { Song } from '../types/music';
import { extractArtistPool, inferSongVibe, calculateVibeSimilarity } from '../services/flowKnowledgeBase';

export interface FairShuffleOptions {
  favoriteWeighting?: boolean;
  vibeSmoothing?: boolean;
  frequentlySkippedIds?: Set<string>;
}

function normalizeAlbumName(album?: string): string {
  if (!album || album === 'Album' || album === 'Not set' || album === 'Unknown') return '';
  return album.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Checks whether two songs share any common artist (lead or featured)
 */
export function shareCommonArtist(songA?: Song, songB?: Song): boolean {
  if (!songA || !songB) return false;
  const poolA = extractArtistPool(songA.artist);
  const poolB = extractArtistPool(songB.artist);

  if (poolA.length === 0 || poolB.length === 0) {
    const rawA = (songA.artist || '').trim().toLowerCase();
    const rawB = (songB.artist || '').trim().toLowerCase();
    return Boolean(rawA && rawA === rawB);
  }

  return poolA.some((artistA) => poolB.includes(artistA));
}

/**
 * Checks whether two songs share the same movie/album soundtrack
 */
export function shareCommonAlbum(songA?: Song, songB?: Song): boolean {
  if (!songA || !songB) return false;
  const albumA = normalizeAlbumName(songA.album);
  const albumB = normalizeAlbumName(songB.album);
  if (!albumA || !albumB) return false;
  return albumA === albumB;
}

/**
 * True-Fair Shuffle Algorithm (Spotify-grade Intelligent Anti-Clustering)
 * Distributes tracks across the queue so that:
 * 1. Collaborating & lead artists never cluster consecutively.
 * 2. Songs from the same album / movie soundtrack are spaced out.
 * 3. User favorites and high-affinity tracks receive early placement.
 * 4. Frequently skipped tracks are deprioritized toward the queue tail.
 * 5. Adjacent track vibe / energy transitions flow harmoniously.
 */
export function generateFairShuffleIndices(
  songs: Song[],
  currentIndex: number = 0,
  options: FairShuffleOptions = { favoriteWeighting: true, vibeSmoothing: true }
): number[] {
  const total = songs.length;
  if (total <= 2) {
    return Array.from({ length: total }, (_, i) => i);
  }

  // Pre-calculate song metadata (artists, album, vibe)
  const songMeta = songs.map((s) => ({
    artists: extractArtistPool(s.artist),
    primaryArtist: (extractArtistPool(s.artist)[0] || (s.artist || 'Unknown').trim().toLowerCase()),
    album: normalizeAlbumName(s.album),
    vibe: options.vibeSmoothing ? inferSongVibe(s.title, s.artist, s.album, s.genre) : 'general',
    isFav: Boolean(options.favoriteWeighting && s.isFavorite),
    isSkipped: Boolean(options.frequentlySkippedIds && options.frequentlySkippedIds.has(s.id))
  }));

  // Group track indices by primary artist
  const artistGroups = new Map<string, number[]>();
  for (let i = 0; i < total; i++) {
    if (i === currentIndex) continue; // Keep current playing song at index 0
    const key = songMeta[i].primaryArtist;
    if (!artistGroups.has(key)) {
      artistGroups.set(key, []);
    }
    artistGroups.get(key)!.push(i);
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
      const songIdx = bucket[0];
      const meta = songMeta[songIdx];

      // Weight target slot based on favorites vs skipped
      let randomStart: number;
      if (meta.isFav) {
        // Favor early-to-mid slots
        randomStart = Math.floor(Math.random() * Math.max(1, Math.floor(remainingCount * 0.55)));
      } else if (meta.isSkipped) {
        // Favor late slots
        randomStart = Math.floor(remainingCount * 0.5) + Math.floor(Math.random() * Math.max(1, Math.floor(remainingCount * 0.5)));
      } else {
        randomStart = Math.floor(Math.random() * remainingCount);
      }

      let placed = false;
      for (let step = 0; step < remainingCount; step++) {
        const checkPos = (randomStart + step) % remainingCount;
        if (distributedSlots[checkPos] === null) {
          distributedSlots[checkPos] = songIdx;
          placed = true;
          break;
        }
      }
      if (!placed) {
        const emptyIndex = distributedSlots.indexOf(null);
        if (emptyIndex !== -1) distributedSlots[emptyIndex] = songIdx;
      }
    } else {
      // Multi-track artist: space tracks evenly with random phase offset to prevent clustering
      const interval = remainingCount / k;
      const baseOffset = Math.floor(Math.random() * interval);

      for (let idx = 0; idx < k; idx++) {
        const songIdx = bucket[idx];
        const targetPos = Math.floor(baseOffset + idx * interval) % remainingCount;

        // Find nearest empty slot to avoid collisions
        let placed = false;
        for (let step = 0; step < remainingCount; step++) {
          const checkPos = (targetPos + step) % remainingCount;
          if (distributedSlots[checkPos] === null) {
            distributedSlots[checkPos] = songIdx;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const emptyIndex = distributedSlots.indexOf(null);
          if (emptyIndex !== -1) {
            distributedSlots[emptyIndex] = songIdx;
          }
        }
      }
    }
  }

  // Filter out any potential nulls (safety guard)
  const validRemaining = distributedSlots.filter((x): x is number => x !== null);

  // Post-pass 1: Check for adjacent shared-artist and shared-album collisions and swap
  for (let i = 0; i < validRemaining.length - 1; i++) {
    const currSong = songs[validRemaining[i]];
    const nextSong = songs[validRemaining[i + 1]];

    const hasCollision = shareCommonArtist(currSong, nextSong) || shareCommonAlbum(currSong, nextSong);

    if (hasCollision) {
      // Find a non-colliding song further down to swap
      for (let j = i + 2; j < validRemaining.length; j++) {
        const candidate = songs[validRemaining[j]];
        const candidatePrev = songs[validRemaining[j - 1]];
        const candidateNext = j + 1 < validRemaining.length ? songs[validRemaining[j + 1]] : undefined;

        const candidateOkWithCurr = !shareCommonArtist(currSong, candidate) && !shareCommonAlbum(currSong, candidate);
        const nextOkWithCandidateNeighbors =
          (!candidatePrev || (!shareCommonArtist(candidatePrev, nextSong) && !shareCommonAlbum(candidatePrev, nextSong))) &&
          (!candidateNext || (!shareCommonArtist(nextSong, candidateNext) && !shareCommonAlbum(nextSong, candidateNext)));

        if (candidateOkWithCurr && nextOkWithCandidateNeighbors) {
          const temp = validRemaining[i + 1];
          validRemaining[i + 1] = validRemaining[j];
          validRemaining[j] = temp;
          break;
        }
      }
    }
  }

  // Post-pass 2: Harmonic Vibe Smoothing
  // If adjacent tracks have severe vibe clashes (e.g. acoustic next to hard-party) and swapping with next+1 enhances vibe similarity without creating artist collisions, perform a local swap
  if (options.vibeSmoothing && validRemaining.length > 3) {
    for (let i = 0; i < validRemaining.length - 2; i++) {
      const s0 = songs[validRemaining[i]];
      const s1 = songs[validRemaining[i + 1]];
      const s2 = songs[validRemaining[i + 2]];

      const v0 = songMeta[validRemaining[i]].vibe;
      const v1 = songMeta[validRemaining[i + 1]].vibe;
      const v2 = songMeta[validRemaining[i + 2]].vibe;

      const currentFlow = calculateVibeSimilarity(v0, v1);
      const swappedFlow = calculateVibeSimilarity(v0, v2);

      // If swapped song flows noticeably better (delta >= 0.4) and doesn't collide with artist/album
      if (swappedFlow - currentFlow >= 0.4) {
        const s3 = i + 3 < validRemaining.length ? songs[validRemaining[i + 3]] : undefined;
        const noCollision =
          !shareCommonArtist(s0, s2) &&
          !shareCommonAlbum(s0, s2) &&
          !shareCommonArtist(s2, s1) &&
          !shareCommonAlbum(s2, s1) &&
          (!s3 || (!shareCommonArtist(s1, s3) && !shareCommonAlbum(s1, s3)));

        if (noCollision) {
          validRemaining[i + 1] = validRemaining[i + 2];
          validRemaining[i + 2] = songs.indexOf(s1);
        }
      }
    }
  }

  // Always put currently playing song at index 0
  return [currentIndex, ...validRemaining];
}

/**
 * Reshuffles only the upcoming portion of an existing queue order,
 * leaving past played tracks and the currently playing track untouched.
 */
export function reshuffleUpcomingIndices(
  songs: Song[],
  currentQueueIndex: number,
  currentShuffledOrder: number[],
  options?: FairShuffleOptions
): number[] {
  if (!currentShuffledOrder || currentShuffledOrder.length !== songs.length) {
    return generateFairShuffleIndices(songs, currentQueueIndex, options);
  }

  const currentPos = currentShuffledOrder.indexOf(currentQueueIndex);
  if (currentPos === -1 || currentPos >= currentShuffledOrder.length - 2) {
    // Already near end or invalid, do fresh shuffle
    return generateFairShuffleIndices(songs, currentQueueIndex, options);
  }

  const pastAndCurrent = currentShuffledOrder.slice(0, currentPos + 1);
  const upcomingIndices = currentShuffledOrder.slice(currentPos + 1);

  // Map upcoming songs into a sub-array to fairly shuffle them
  const upcomingSongs = upcomingIndices.map((idx) => songs[idx]);
  const subShuffle = generateFairShuffleIndices(upcomingSongs, 0, options);

  // Map subShuffle indices back to real songs indices (subShuffle[0] corresponds to upcomingIndices[0])
  const reshuffledUpcoming = subShuffle.map((subIdx) => upcomingIndices[subIdx]);

  return [...pastAndCurrent, ...reshuffledUpcoming];
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
