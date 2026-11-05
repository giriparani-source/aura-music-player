import { Song, DuplicateGroup, DuplicateMatchKind, DuplicateConfidence } from '../types/music';

/**
 * Common version, remix, and mix keywords used to distinguish
 * alternate versions from exact duplicate copies.
 */
export const VERSION_KEYWORDS = [
  'remix',
  'mix',
  'acoustic',
  'unplugged',
  'instrumental',
  'karaoke',
  'live',
  'cover',
  'reprise',
  'slowed',
  'reverb',
  'extended',
  'lofi',
  'lo-fi',
  'club mix',
  'dj mix',
  'sped up',
  'speed up',
  'clean',
  'explicit',
  'radio edit',
  'orchestral',
  'dubstep',
  'bass boosted',
  'version'
];

/**
 * Calculates Levenshtein-bigram similarity ratio between two strings (0.0 to 1.0)
 */
export function stringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 && len2 === 0) return 1.0;
  if (len1 === 0 || len2 === 0) return 0.0;

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
 * Extracts version keywords from title or filename
 */
export function extractVersionTags(str: string): string[] {
  if (!str) return [];
  const lower = str.toLowerCase();
  const tags: string[] = [];
  for (const kw of VERSION_KEYWORDS) {
    const regex = new RegExp(`\\b${kw.replace('-', '[- ]')}\\b`, 'i');
    if (regex.test(lower)) {
      tags.push(kw);
    }
  }
  return tags;
}

/**
 * Normalizes title string for duplicate comparison:
 * Strips extensions, audio tags, website watermarks, copy numbers,
 * and extracts version tags.
 */
export function normalizeTitleForComparison(str: string): { baseTitle: string; versionTags: string[] } {
  if (!str) return { baseTitle: '', versionTags: [] };
  let s = str.toLowerCase();

  // 1. Remove file extension
  s = s.replace(/\.[a-z0-9]{2,5}$/i, '');

  // 2. Remove common website / audio watermarks in brackets or URLs
  s = s.replace(/\[[^\]]*\]/g, ' ');
  s = s.replace(/\{[^\}]*\}/g, ' ');
  s = s.replace(/www\.[a-z0-9-]+\.[a-z]{2,}/gi, ' ');
  s = s.replace(/\b(masstamilan|isaimini|starmusiq|pagalworld|sensongs|naasongs|djmaza)\b/gi, ' ');

  // 3. Extract version tags
  const versionTags = extractVersionTags(s);

  // 4. Remove copy indicators
  s = s.replace(/\([0-9]+\)/g, ' '); // (1), (2)
  s = s.replace(/\bcopy of\b/gi, ' ');
  s = s.replace(/-?\s*copy\b/gi, ' ');

  // 5. Remove audio quality tags
  s = s.replace(/\b(320kbps|256kbps|192kbps|128kbps|320k|128k|_320|_128|flac|lossless|hq|hd)\b/gi, ' ');

  // 6. Remove leading track numbering, e.g. "01 - ", "01. ", "1. "
  s = s.replace(/^\s*\d{1,3}\s*[-._)\s]\s*/, '');

  // 7. Remove version tags from base title to enable comparing original vs remix
  for (const kw of versionTags) {
    const r = new RegExp(`\\b${kw.replace('-', '[- ]')}\\b`, 'gi');
    s = s.replace(r, ' ');
  }

  // 8. Remove non-alphanumeric characters and collapse spaces
  s = s.replace(/[^a-z0-9]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  return { baseTitle: s, versionTags };
}

/**
 * Normalizes artist name for comparison.
 */
export function normalizeArtistForComparison(str: string): string {
  if (!str || str === 'Not set' || str === 'Unknown Artist' || str.includes('<unknown>')) return '';
  let s = str.toLowerCase();
  // Strip featured artists, e.g. "Anirudh feat. Jonita Gandhi" -> "anirudh"
  s = s.split(/\s*(?:•|feat\.?|ft\.?|featuring|&|\/|;|vs\.?)\s*/i)[0] || '';
  s = s.replace(/[^a-z0-9]/g, '');
  return s.trim();
}

/**
 * Checks whether two artists are compatible.
 * If both artists are known and completely different, they are NOT compatible.
 */
export function areArtistsCompatible(artistA: string, artistB: string): { compatible: boolean; isSame: boolean } {
  const normA = normalizeArtistForComparison(artistA);
  const normB = normalizeArtistForComparison(artistB);

  // If either artist is missing/unknown, we cannot disqualify on artist alone
  if (!normA || !normB) {
    return { compatible: true, isSame: false };
  }

  // Same artist
  if (normA === normB) {
    return { compatible: true, isSame: true };
  }

  // One contains the other (e.g. "anirudh" and "anirudhravichander")
  // Only if the shorter one is substantial (length >= 6) to avoid substring accidents
  const shorter = normA.length < normB.length ? normA : normB;
  const longer = normA.length < normB.length ? normB : normA;
  if (shorter.length >= 6 && longer.includes(shorter)) {
    return { compatible: true, isSame: true };
  }

  // Check string similarity for slight typos, requiring >= 0.90 similarity for longer names
  const sim = stringSimilarity(normA, normB);
  if (sim >= 0.90 && Math.abs(normA.length - normB.length) <= 2) {
    return { compatible: true, isSame: true };
  }

  // Both have distinct known artists
  return { compatible: false, isSame: false };
}

const GENERIC_TITLES = new Set([
  'intro', 'outro', 'theme', 'interlude', 'prelude', 'bgm',
  'track', 'track 1', 'track 2', 'track 3', 'track 4', 'track 5',
  'track 01', 'track 02', 'track 03', 'track 04', 'track 05',
  'title', 'untitled', 'song', 'song 1', 'audio', 'audio 1', 'audio 01',
  'instrumental', 'theme song', 'love theme', 'action theme', 'climax'
]);

export function isGenericSongTitle(title: string): boolean {
  if (!title) return true;
  const t = title.toLowerCase().trim();
  if (GENERIC_TITLES.has(t)) return true;
  if (/^(?:track|audio|song|title|part|chapter)\s*\d+$/i.test(t)) return true;
  if (/^\d+\s*[-_.]?\s*(?:track|audio)?$/i.test(t)) return true;
  return false;
}

export interface SongComparisonResult {
  isMatch: boolean;
  score: number;
  confidence: DuplicateConfidence;
  matchKind: DuplicateMatchKind;
  reasons: string[];
}

/**
 * Compares two songs using multi-factor analysis:
 * - Normalized title
 * - Artist compatibility
 * - Duration proximity
 * - File identity & size
 * - Version / Remix detection
 */
export function compareSongsForDuplicate(
  itemA: { song: Song; baseTitle: string; versionTags: string[] },
  itemB: { song: Song; baseTitle: string; versionTags: string[] }
): SongComparisonResult {
  const songA = itemA.song;
  const songB = itemB.song;

  // 1. Direct path / URI identity: 100% exact duplicate
  const uriA = songA.contentUri || songA.path;
  const uriB = songB.contentUri || songB.path;
  if (uriA && uriB && uriA === uriB) {
    return {
      isMatch: true,
      score: 100,
      confidence: 'high',
      matchKind: 'exact',
      reasons: ['Identical file storage path / MediaStore URI']
    };
  }

  // 2. Artist Compatibility Check
  // Rule: Do not treat songs with the same title but different artists as duplicates!
  const artistComp = areArtistsCompatible(songA.artist, songB.artist);
  if (!artistComp.compatible) {
    return {
      isMatch: false,
      score: 0,
      confidence: 'low',
      matchKind: 'possible',
      reasons: ['Different artists']
    };
  }

  // 3. Title Comparison
  const titleA = itemA.baseTitle;
  const titleB = itemB.baseTitle;

  if (!titleA || !titleB || titleA.length < 2 || titleB.length < 2) {
    return { isMatch: false, score: 0, confidence: 'low', matchKind: 'possible', reasons: [] };
  }

  // Prevent generic short titles (e.g. "Intro", "Theme", "Track 01") from false-matching when artists are unverified or different
  const normA = normalizeArtistForComparison(songA.artist);
  const normB = normalizeArtistForComparison(songB.artist);
  const isGenericA = isGenericSongTitle(titleA);
  const isGenericB = isGenericSongTitle(titleB);

  if (isGenericA || isGenericB || titleA.length < 4) {
    const hasExactKnownArtist = Boolean(artistComp.isSame && normA && normB && normA === normB);
    if (!hasExactKnownArtist) {
      return {
        isMatch: false,
        score: 0,
        confidence: 'low',
        matchKind: 'possible',
        reasons: ['Generic title without identical confirmed artist']
      };
    }
  }

  const titleSim = stringSimilarity(titleA, titleB);
  // Titles must be very similar (>= 0.75) to be considered
  if (titleSim < 0.75) {
    return { isMatch: false, score: 0, confidence: 'low', matchKind: 'possible', reasons: ['Titles do not match'] };
  }

  // Check for distinct chapter / part / track sequence numbers (e.g. "Theme 1" vs "Theme 2", "Part 1" vs "Part 2")
  const numA = (titleA.match(/\b(?:part|pt|vol|volume|no|track)?\s*(\d+|[ivx]+)\s*$/i) || [])[1];
  const numB = (titleB.match(/\b(?:part|pt|vol|volume|no|track)?\s*(\d+|[ivx]+)\s*$/i) || [])[1];
  if (numA && numB && numA.toLowerCase() !== numB.toLowerCase()) {
    return {
      isMatch: false,
      score: 0,
      confidence: 'low',
      matchKind: 'possible',
      reasons: [`Different sequence/part numbers: ${numA} vs ${numB}`]
    };
  }

  // 4. Duration Comparison
  let durationScore = 0;
  let durationDiff = 0;
  const hasDurations = songA.duration > 0 && songB.duration > 0;
  if (hasDurations) {
    durationDiff = Math.abs(songA.duration - songB.duration);
    if (durationDiff === 0) {
      durationScore = 30;
    } else if (durationDiff <= 2) {
      durationScore = 25;
    } else if (durationDiff <= 5) {
      durationScore = 15;
    } else if (durationDiff <= 15) {
      durationScore = 5;
    } else {
      // Large duration difference (> 15s)
      durationScore = -20;
    }
  }

  // 5. Version / Remix Detection
  const tagsA = itemA.versionTags;
  const tagsB = itemB.versionTags;
  const isVersionMismatch =
    (tagsA.length > 0 && tagsB.length === 0) ||
    (tagsB.length > 0 && tagsA.length === 0) ||
    (tagsA.length > 0 && tagsB.length > 0 && tagsA.join(',') !== tagsB.join(','));

  const isExtendedOrRemixByDuration = hasDurations && durationDiff > 25 && titleSim >= 0.85;

  const reasons: string[] = [];

  if (titleA === titleB) {
    reasons.push('Identical title');
  } else {
    reasons.push(`Similar title (${Math.round(titleSim * 100)}% match)`);
  }

  if (artistComp.isSame) {
    reasons.push('Same artist');
  }

  if (hasDurations) {
    if (durationDiff === 0) {
      reasons.push('Exact same duration');
    } else if (durationDiff <= 2) {
      reasons.push(`Near duration (${durationDiff}s difference)`);
    } else {
      reasons.push(`Duration differs by ${durationDiff}s`);
    }
  }

  // Check file size proximity
  if (songA.fileSize > 0 && songB.fileSize > 0) {
    const sizeDiff = Math.abs(songA.fileSize - songB.fileSize);
    const sizeRatio = sizeDiff / Math.max(songA.fileSize, songB.fileSize);
    if (sizeRatio < 0.02) {
      reasons.push('Identical file size');
    } else if (sizeRatio < 0.1) {
      reasons.push('Close file size');
    }
  }

  // 6. Classification
  if (isVersionMismatch || isExtendedOrRemixByDuration) {
    const versionLabel = tagsA.concat(tagsB).join(', ') || 'Alternate duration/mix';
    reasons.unshift(`Different version / remix: ${versionLabel}`);
    return {
      isMatch: true,
      score: 75,
      confidence: artistComp.isSame ? 'high' : 'medium',
      matchKind: 'version_remix',
      reasons
    };
  }

  // If duration differs significantly without version tags, not a duplicate!
  if (hasDurations && durationDiff > 12) {
    return {
      isMatch: false,
      score: 20,
      confidence: 'low',
      matchKind: 'possible',
      reasons: ['Duration differs significantly (> 12s)']
    };
  }

  // Exact duplicate: Same/near title, same artist (or unknown), near duration
  if (titleSim >= 0.9 && durationDiff <= 2) {
    return {
      isMatch: true,
      score: 95,
      confidence: 'high',
      matchKind: 'exact',
      reasons
    };
  }

  // Possible duplicate
  const overallScore = Math.round(titleSim * 50 + (artistComp.isSame ? 25 : 10) + durationScore);
  if (overallScore >= 55) {
    return {
      isMatch: true,
      score: Math.min(90, Math.max(50, overallScore)),
      confidence: overallScore >= 75 ? 'medium' : 'low',
      matchKind: 'possible',
      reasons
    };
  }

  return {
    isMatch: false,
    score: overallScore,
    confidence: 'low',
    matchKind: 'possible',
    reasons
  };
}

/**
 * Evaluates a duplicate group and determines the optimal track to keep,
 * generating a clear rationale for the user.
 */
export function determineRecommendedKeepSong(songs: Song[], matchKind: DuplicateMatchKind): { keepSongId: string; reason: string } {
  if (!songs || songs.length === 0) {
    return { keepSongId: '', reason: 'No tracks available' };
  }
  if (songs.length === 1) {
    return { keepSongId: songs[0].id, reason: 'Only track in group' };
  }

  // Quality scoring helper
  const scoreSong = (s: Song): number => {
    let score = 0;

    // 1. Format score
    const fmt = (s.format || s.fileName?.split('.').pop() || '').toLowerCase();
    if (fmt === 'flac' || fmt === 'wav' || fmt === 'alac') score += 50;
    else if (fmt === 'm4a' || fmt === 'aac') score += 35;
    else if (fmt === 'opus') score += 30;
    else if (fmt === 'mp3') score += 20;

    // 2. Audio density / file size relative to duration (avoids trusting nominal default bitrates)
    if (s.duration > 0 && s.fileSize > 0) {
      const bytesPerSec = s.fileSize / s.duration;
      // High audio density (> 35KB/s ~ 280+ kbps MP3 or lossless): +35
      if (bytesPerSec > 35000) score += 35;
      else if (bytesPerSec > 22000) score += 20;
      else if (bytesPerSec > 14000) score += 10;
    } else {
      const bitrate = s.bitrate || 0;
      if (bitrate >= 320) score += 25;
      else if (bitrate >= 256) score += 20;
      else if (bitrate >= 192) score += 15;
      else if (bitrate >= 128) score += 10;
    }

    // 3. User engagement (preserve favorites & listen history)
    if (s.isFavorite) score += 45;
    if (s.playCount && s.playCount > 0) score += Math.min(25, s.playCount * 5);

    // 4. Valid Android content:// URI accessibility
    if (s.contentUri?.startsWith('content://') || s.path?.startsWith('content://')) score += 15;

    return score;
  };

  const scored = songs.map((song) => ({
    song,
    score: scoreSong(song)
  }));

  // Deterministic sorting with stable tie-breakers
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-breaker 1: content:// URI preferred over local file path
    const aIsContent = Boolean(a.song.contentUri?.startsWith('content://') || a.song.path?.startsWith('content://'));
    const bIsContent = Boolean(b.song.contentUri?.startsWith('content://') || b.song.path?.startsWith('content://'));
    if (aIsContent !== bIsContent) return bIsContent ? 1 : -1;
    // Tie-breaker 2: older dateAdded (original index)
    if (a.song.dateAdded !== b.song.dateAdded) return (a.song.dateAdded || 0) - (b.song.dateAdded || 0);
    // Tie-breaker 3: deterministic ID order
    return a.song.id.localeCompare(b.song.id);
  });

  const best = scored[0].song;
  const runnerUp = scored[1].song;

  // Format helpers
  const formatSize = (bytes: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  // Generate explanation
  if (matchKind === 'version_remix') {
    return {
      keepSongId: best.id,
      reason: `Different version or remix detected. Retaining "${best.title}" as primary copy — review copies before removing.`
    };
  }

  // Quality difference explanation
  const fmtBest = (best.format || best.fileName?.split('.').pop() || '').toUpperCase();
  const fmtRunner = (runnerUp.format || runnerUp.fileName?.split('.').pop() || '').toUpperCase();

  if (fmtBest === 'FLAC' && fmtRunner !== 'FLAC') {
    return {
      keepSongId: best.id,
      reason: `Keep Lossless Studio Master FLAC audio (${formatSize(best.fileSize)}) over compressed ${fmtRunner} copy.`
    };
  }

  if (best.isFavorite && !runnerUp.isFavorite) {
    return {
      keepSongId: best.id,
      reason: `Keep favorited song with higher user engagement (${best.playCount} plays).`
    };
  }

  if (best.bitrate && runnerUp.bitrate && best.bitrate > runnerUp.bitrate) {
    return {
      keepSongId: best.id,
      reason: `Keep higher quality ${best.bitrate} kbps copy (${formatSize(best.fileSize)}) over ${runnerUp.bitrate} kbps copy (${formatSize(runnerUp.fileSize)}).`
    };
  }

  if (best.fileSize > runnerUp.fileSize * 1.25 && runnerUp.fileSize > 0) {
    const bitrateNote = best.bitrate ? ` (${best.bitrate} kbps)` : '';
    return {
      keepSongId: best.id,
      reason: `Keep higher bitrate${bitrateNote} file (${formatSize(best.fileSize)}) over compressed copy (${formatSize(runnerUp.fileSize)}).`
    };
  }

  return {
    keepSongId: best.id,
    reason: `Identical audio quality — primary original file recommended to keep.`
  };
}

/**
 * Analyzes library songs and identifies duplicate groups based on multi-factor intelligence.
 * Optimized with candidate indexing to eliminate O(N^2) explosion on large libraries.
 */
export function detectDuplicates(songs: Song[]): DuplicateGroup[] {
  if (!songs || songs.length === 0) return [];

  const groups: DuplicateGroup[] = [];
  const visited = new Set<string>();

  // Precompute normalized features in a single O(N) pass
  const precomputed = songs.map((song) => {
    const { baseTitle, versionTags } = normalizeTitleForComparison(song.title || song.fileName);
    return {
      song,
      baseTitle,
      versionTags,
      normArtist: normalizeArtistForComparison(song.artist)
    };
  });

  // Candidate indexing for fast lookup
  const durationMap = new Map<number, number[]>(); // rounded duration -> indices
  const prefixMap = new Map<string, number[]>();   // 3-char prefix -> indices

  for (let i = 0; i < precomputed.length; i++) {
    const { song, baseTitle } = precomputed[i];
    if (song.duration > 0) {
      const roundedDur = Math.round(song.duration);
      for (let d = roundedDur - 3; d <= roundedDur + 3; d++) {
        let list = durationMap.get(d);
        if (!list) {
          list = [];
          durationMap.set(d, list);
        }
        list.push(i);
      }
    }
    if (baseTitle.length >= 3) {
      const prefix = baseTitle.substring(0, 3);
      let list = prefixMap.get(prefix);
      if (!list) {
        list = [];
        prefixMap.set(prefix, list);
      }
      list.push(i);
    }
  }

  for (let i = 0; i < precomputed.length; i++) {
    const itemA = precomputed[i];
    const songA = itemA.song;
    if (visited.has(songA.id)) continue;

    const matchedSongs: Song[] = [songA];
    const groupReasons = new Set<string>();
    let highestScore = 0;
    let groupMatchKind: DuplicateMatchKind = 'exact';
    let groupConfidence: DuplicateConfidence = 'high';

    // Candidate selection: intersection of duration matches or prefix matches
    const candidateIndices = new Set<number>();
    if (itemA.baseTitle.length >= 3) {
      const prefixMatches = prefixMap.get(itemA.baseTitle.substring(0, 3));
      if (prefixMatches) {
        for (const idx of prefixMatches) {
          if (idx > i) candidateIndices.add(idx);
        }
      }
    }

    if (songA.duration > 0) {
      const durMatches = durationMap.get(Math.round(songA.duration));
      if (durMatches) {
        for (const idx of durMatches) {
          if (idx > i) candidateIndices.add(idx);
        }
      }
    }

    for (const j of candidateIndices) {
      const itemB = precomputed[j];
      const songB = itemB.song;
      if (visited.has(songB.id)) continue;

      const comp = compareSongsForDuplicate(itemA, itemB);
      if (comp.isMatch) {
        matchedSongs.push(songB);
        visited.add(songB.id);
        comp.reasons.forEach((r) => groupReasons.add(r));

        if (comp.score > highestScore) highestScore = comp.score;

        // If any match is version_remix, classify group accordingly
        if (comp.matchKind === 'version_remix') {
          groupMatchKind = 'version_remix';
        } else if (comp.matchKind === 'possible' && groupMatchKind !== 'version_remix') {
          groupMatchKind = 'possible';
        }

        if (comp.confidence === 'low') {
          groupConfidence = 'low';
        } else if (comp.confidence === 'medium' && groupConfidence !== 'low') {
          groupConfidence = 'medium';
        }
      }
    }

    if (matchedSongs.length > 1) {
      visited.add(songA.id);

      // Determine intelligent recommendation
      const { keepSongId, reason } = determineRecommendedKeepSong(matchedSongs, groupMatchKind);

      groups.push({
        id: 'dup-' + songA.id,
        canonicalTitle: songA.title,
        similarityScore: Math.min(100, highestScore || 85),
        confidence: groupConfidence,
        matchKind: groupMatchKind,
        recommendedKeepSongId: keepSongId,
        recommendationReason: reason,
        reasons: Array.from(groupReasons),
        songs: matchedSongs
      });
    }
  }

  return groups;
}
