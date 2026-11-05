import { Song } from '../types/music';
import { searchJioSaavn, PRESET_SAAVN_320K_HITS } from './jiosaavnService';

export interface CleanedTrackMetadata {
  rawTitle: string;
  cleanTitle: string;
  artist: string;
  movie?: string;
  isAutomatedOrLabelArtist?: boolean;
  channelName?: string;
  duration?: number;
  thumbnail?: string;
  videoId?: string;
  isMixtape: boolean;
  isRemix: boolean;
  isLive: boolean;
  isSlowed: boolean;
  isCover: boolean;
}

export type CatalogMatchResult =
  | {
      status: 'MATCHED';
      confidence: number;
      streamUrl: string;
      song: Song;
      reason: string;
    }
  | {
      status: 'UNMATCHED_FOREGROUND_ONLY';
      reason: string;
      confidence: number;
      song: Song;
    };

/**
 * Normalizes and matches movie names across spacing and common South Indian transliteration variations.
 * e.g., "Jigarthanda DoubleX" === "Jigarthanda Double X"
 *       "Velaiyilla Pattathari" === "Velai Illa Pattadhaari"
 *       "Guruvayoorambala Nadayil" === "Guruvayoor Ambala Nadayil"
 */
export function fuzzyMovieMatch(movie1: string, movie2: string): boolean {
  const c1 = (movie1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const c2 = (movie2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;

  // Substring matching requires at least 4 characters and significant length ratio
  if (c1.length >= 4 && c2.length >= 4) {
    if (c1.includes(c2) && c2.length / c1.length >= 0.6) return true;
    if (c2.includes(c1) && c1.length / c2.length >= 0.6) return true;
  }

  // Normalize common transliteration variants in Indian cinema titles:
  // e.g., 'dh' <-> 't', 'th' <-> 't', 'd' <-> 't', 'aa' <-> 'a', 'ee' <-> 'i', 'oo' <-> 'u', 'y' <-> 'i'
  const norm = (s: string) =>
    s
      .replace(/dh/g, 't')
      .replace(/th/g, 't')
      .replace(/d/g, 't')
      .replace(/aa/g, 'a')
      .replace(/ee/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/y/g, 'i')
      .replace(/z/g, 's')
      .replace(/sh/g, 's');

  const n1 = norm(c1);
  const n2 = norm(c2);
  if (n1 === n2) return true;
  if (n1.length >= 4 && n2.length >= 4) {
    if (n1.includes(n2) && n2.length / n1.length >= 0.6) return true;
    if (n2.includes(n1) && n1.length / n2.length >= 0.6) return true;
  }

  return calculateDiceSimilarity(c1, c2) >= 0.70;
}

/**
 * Aggressively cleans YouTube video titles by stripping noise tags, brackets, and movie credits.
 * Extracts movie/album name if formatted as (From "...") or [From '...'].
 */
export function cleanTrackMetadata(rawTitle: string, rawArtist?: string, duration?: number): CleanedTrackMetadata {
  const lower = rawTitle.toLowerCase();

  // Detect track version / compilation type
  const isMixtape = Boolean(
    lower.includes('mixtape') ||
      lower.includes('dj mix') ||
      lower.includes('mashup') ||
      lower.includes('jukebox') ||
      lower.includes('non stop') ||
      lower.includes('non-stop') ||
      (duration && duration > 600) // Videos > 10 mins are compilation/mixtapes
  );

  const isRemix = Boolean(lower.includes('remix') || lower.includes('edm') || lower.includes('club mix'));
  const isLive = Boolean(lower.includes('live') || lower.includes('concert') || lower.includes('unplugged'));
  const isSlowed = Boolean(lower.includes('slowed') || lower.includes('reverb') || lower.includes('lofi') || lower.includes('lo-fi'));
  const isCover = Boolean(lower.includes('cover') || lower.includes('tribute') || lower.includes('karaoke'));

  // 1. Extract Movie / Album context from patterns like:
  // (From "Jigarthanda DoubleX"), (From 'Leo'), [From "Jailer"], From "Vikram"
  let movie = '';
  const moviePattern = /(?:[\(\[]\s*from\s+(?:the\s+movie\s+)?["'“]?([^"'”\)\]]+)["'”]?\s*[\)\]]|\bfrom\s+(?:the\s+movie\s+)?["'“]([^"'”]+)["'”])/i;
  const movieMatch = rawTitle.match(moviePattern);
  if (movieMatch) {
    movie = (movieMatch[1] || movieMatch[2] || '').trim();
    movie = movie.replace(/^["'“]+|["'”]+$/g, '').trim();
  }

  // 2. Clean title by removing movie clause, bracket tags, and common video tags
  let clean = rawTitle
    .replace(/(?:[\(\[]\s*from\s+(?:the\s+movie\s+)?["'“]?[^"'”\)\]]+["'”]?\s*[\)\]]|\bfrom\s+(?:the\s+movie\s+)?["'“][^"'”]+["'”])/gi, '')
    // Remove brackets with common video tags
    .replace(/\[\s*(official|music|video|audio|lyrics?|hd|4k|8k|remastered|visualizer|full\s+video).*?\]/gi, '')
    .replace(/\(\s*(official|music|video|audio|lyrics?|hd|4k|8k|remastered|visualizer|video\s+song|full\s+video|lyrical|audio\s+song).*?\)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    // Remove credits after separator pipe or bullet
    .replace(/[|•].*$/gi, '')
    // Remove unbracketed noise tags
    .replace(/\b(video\s+song|lyric\s+video|official\s+video|full\s+video\s+song|full\s+video|music\s+video|lyrical\s+video|audio\s+song|4k\s+video|4k|8k|uhd|full\s+hd|remastered|visualizer|promo|teaser|trailer)\b/gi, '')
    // Remove trailing descriptors
    .replace(/\s*-\s*(video|audio|lyrics?|song|4k).*$/gi, '')
    .replace(/\b(ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—|•]+\s*$/g, '')
    .trim();

  // Strip leading track index numbers (e.g. "01 - Melliname" or "1. Snehithane")
  clean = clean.replace(/^\d+[\.\-\s]+\s*/, '').trim();

  // Strip trailing track order numbers (e.g. "Inji Idupazhaga1" -> "Inji Idupazhaga")
  // while preserving genuine sequel/version identifiers
  clean = clean.replace(/([a-zA-Z]{3,})\d+$/g, '$1').trim();

  // 3. Clean artist & detect distributor / automated topic / record label channels
  const rawArtTrim = (rawArtist || '').trim();
  let artist = rawArtTrim;

  // Strip automated "- Topic", "• Topic", "| Topic", "- Release", "Official", "VEVO" suffix or prefix
  artist = artist.replace(/\s*[-•|–—]\s*(Topic|Release|Official|VEVO)\b/gi, '').trim();
  artist = artist.replace(/\b(Topic|Release)\s*[-•|–—]\s*/gi, '').trim();

  // Detect automated / distributor / record label uploaders
  const isAutomatedOrLabelArtist = Boolean(
    /^release\s*[-•|–—]?\s*topic$/i.test(rawArtTrim) ||
    /^release$/i.test(rawArtTrim) ||
    /^various\s+artists/i.test(rawArtTrim) ||
    /^(sony\s*music|think\s*music|saregama|lahari|divo|tips\s*tamil|tips\s*official|sun\s*tv|aditya\s*music|zeemusic|speed\s*audio|mankatha|ayngaran)/i.test(rawArtTrim) ||
    artist.toLowerCase() === 'youtube' ||
    artist.toLowerCase() === 'various artists' ||
    artist.toLowerCase() === 'release' ||
    artist.toLowerCase() === 'topic'
  );

  if (isAutomatedOrLabelArtist) {
    artist = '';
  }

  return {
    rawTitle,
    cleanTitle: clean,
    artist,
    movie: movie || undefined,
    isAutomatedOrLabelArtist,
    channelName: rawArtist,
    duration,
    isMixtape,
    isRemix,
    isLive,
    isSlowed,
    isCover
  };
}

/**
 * Calculates string similarity between two strings using Bigram/Dice coefficient (0 to 1).
 */
export function calculateDiceSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const s2 = str2.toLowerCase().replace(/[^\w\s]/g, '').trim();

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return s1.includes(s2) || s2.includes(s1) ? 0.7 : 0.0;

  const getBigrams = (s: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };

  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;

  b1.forEach((bg) => {
    if (b2.has(bg)) intersection++;
  });

  return (2.0 * intersection) / (b1.size + b2.size);
}

/**
 * Cleans catalog candidate titles by stripping (From "..."), [From '...'],
 * OST tags, and audio/video qualifiers so clean titles can be accurately matched.
 */
export function cleanCandidateTitle(rawTitle: string): string {
  return rawTitle
    .replace(/(?:[\(\[]\s*from\s+(?:the\s+movie\s+)?["'“]?[^"'”\)\]]+["'”]?\s*[\)\]]|\bfrom\s+(?:the\s+movie\s+)?["'“][^"'”]+["'”])/gi, '')
    .replace(/\s*[\(\[]\s*(?:original\s+motion\s+picture\s+soundtrack|ost|soundtrack|audio\s+song|lyrical|video\s+song|hd|4k|official\s+audio|full\s+video).*?[\]\)]/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[|•].*$/gi, '')
    .replace(/\s*-\s*(video|audio|lyrics?|song|4k).*$/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—|•]+\s*$/g, '')
    .trim();
}

/**
 * Validates hard gates:
 * 1. Mixtapes/Compilations: NEVER substitute a 10m+ mixtape with a 3m song.
 * 2. Version/Type: If original is remix/live/slowed, candidate must match.
 * 3. Duration: Candidate duration must be within ±25% or ±50s for standard songs.
 * 4. Title similarity: Strict candidate cleaning + NO blind startsWith() (Rule 1).
 * 5. Cross-movie protection: Match movie if present, else require artist or duration <= 3s (Rule 2).
 */
export function evaluateHardGates(
  meta: CleanedTrackMetadata,
  candidate: Song
): { passed: boolean; confidence: number; reason: string } {
  const candTitleLower = (candidate.title || '').toLowerCase();
  const candArtistLower = (candidate.artist || '').toLowerCase();
  const candAlbumLower = (candidate.album || '').toLowerCase();
  const candDuration = candidate.duration || 0;
  const diff = (meta.duration && candDuration) ? Math.abs(meta.duration - candDuration) : 0;

  // HARD GATE 1: Mixtapes & DJ Sets (>10 min or marked Mixtape)
  // NEVER substitute with a short standard song!
  if (meta.isMixtape) {
    if (!meta.duration || meta.duration > 600) {
      if (candDuration < 600) {
        return {
          passed: false,
          confidence: 0,
          reason: `Rejected: Original is a ${Math.round((meta.duration || 0) / 60)}-min mixtape/compilation, cannot substitute with ${Math.round(candDuration / 60)}-min song`
        };
      }
    }
    if (!candTitleLower.includes('mixtape') && !candTitleLower.includes('mashup')) {
      return {
        passed: false,
        confidence: 0,
        reason: 'Rejected: Original is a mixtape/mashup; catalog candidate is not a compilation'
      };
    }
  }

  // HARD GATE 2: Version Compatibility
  if (meta.isRemix && !candTitleLower.includes('remix') && !candTitleLower.includes('edm') && !candTitleLower.includes('mix')) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Original is a Remix; catalog candidate is the original studio track'
    };
  }

  if (meta.isLive && !candTitleLower.includes('live') && !candTitleLower.includes('concert')) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Original is a Live performance; catalog candidate is a studio track'
    };
  }

  if (meta.isSlowed && !candTitleLower.includes('slowed') && !candTitleLower.includes('lofi') && !candTitleLower.includes('lo-fi')) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Original is Slowed/Reverb; catalog candidate is normal tempo'
    };
  }

  const isMovieMatched = Boolean(
    meta.movie && (
      fuzzyMovieMatch(meta.movie, candidate.album || '') ||
      fuzzyMovieMatch(meta.movie, candidate.title || '')
    )
  );

  // Artist Similarity Evaluation
  let isArtistMatched = false;
  let artistBonus = 0;

  if (meta.artist && candidate.artist) {
    const metaArt = meta.artist.toLowerCase();
    if (candArtistLower.includes(metaArt) || metaArt.includes(candArtistLower)) {
      isArtistMatched = true;
      artistBonus = 0.15;
    } else {
      // Token-based matching (e.g. "Velmurugan" in "Velmurugan, Anirudh")
      // Filter out generic noise tokens like "artist", "music", "unknown", "records"
      const GENERIC_TOKENS = new Set(['artist', 'artists', 'music', 'official', 'topic', 'feat', 'various', 'unknown', 'channel', 'records', 'audio', 'sound']);
      const metaTokens = metaArt.split(/[\s,–—-]+/).map((t) => t.trim()).filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t));
      const candTokens = candArtistLower.split(/[\s,–—-]+/).map((t) => t.trim()).filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t));
      const hasTokenMatch = metaTokens.length > 0 && metaTokens.some((mt) => candTokens.some((ct) => ct.includes(mt) || mt.includes(ct)));
      if (hasTokenMatch) {
        isArtistMatched = true;
        artistBonus = 0.15;
      }
    }
  } else if (meta.isAutomatedOrLabelArtist || !meta.artist) {
    // Distributor / Record Label Hard-Gate Bypass:
    // If the original artist was a YouTube Topic/Distributor/Record Label (e.g. Release - Topic, Think Music),
    // bypass the artist mismatch and treat as matched!
    artistBonus = 0.15;
  }

  // HARD GATE 3: Duration Proximity (for standard songs < 10 mins)
  if (meta.duration && meta.duration > 0 && candDuration > 0) {
    const ratio = diff / meta.duration;

    // Standard song tolerance:
    // User Requirement 1: Guarded Duration Relaxation
    // Do NOT blindly relax duration to 75s when artist is ignored.
    // Only relax duration tolerance (>30s) IF the movie/album name strongly matches.
    // Otherwise, keep duration tolerance strictly <= 30s to prevent false matches on covers, reprisals, and female versions.
    if (meta.duration <= 600) {
      const maxAllowedDiff = isMovieMatched ? 75 : (meta.isAutomatedOrLabelArtist && !isArtistMatched ? 15 : 30);
      const maxAllowedRatio = isMovieMatched ? 0.35 : 0.18;

      if (diff > maxAllowedDiff || ratio > maxAllowedRatio) {
        return {
          passed: false,
          confidence: 0,
          reason: `Rejected: Duration mismatch (YouTube: ${meta.duration}s vs Catalog: ${candDuration}s, diff: ${diff}s, maxAllowed: ${maxAllowedDiff}s, movieMatched: ${isMovieMatched})`
        };
      }
    } else {
      // Long video tolerance
      if (diff > 120) {
        return {
          passed: false,
          confidence: 0,
          reason: `Rejected: Long track duration mismatch (YouTube: ${meta.duration}s vs Catalog: ${candDuration}s)`
        };
      }
    }
  }

  // HARD GATE 4: Clean Title Matching & Rule 1: NO BLIND startsWith()
  const candCleanTitle = cleanCandidateTitle(candidate.title || '');
  const normMetaTitle = meta.cleanTitle.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const normCandTitle = candCleanTitle.toLowerCase().replace(/[^\w\s]/g, '').trim();

  let titleSim = 0;
  if (normMetaTitle === normCandTitle && normMetaTitle.length > 0) {
    // Exact match of clean titles
    titleSim = 1.0;
  } else if (
    (normCandTitle.startsWith(normMetaTitle) || normMetaTitle.startsWith(normCandTitle)) &&
    meta.duration && candDuration && diff <= 2
  ) {
    // STRICT RULE 1: startsWith() is ONLY allowed if candidate duration difference is strictly <= 2 seconds!
    titleSim = 0.95;
  } else {
    // Otherwise standard Bigram/Dice similarity on the cleaned titles
    titleSim = calculateDiceSimilarity(meta.cleanTitle, candCleanTitle);
  }

  if (titleSim < 0.65) {
    return {
      passed: false,
      confidence: Math.round(titleSim * 100),
      reason: `Rejected: Title similarity too low (${Math.round(titleSim * 100)}% < 65% for "${meta.cleanTitle}" vs "${candCleanTitle}")`
    };
  }

  // Version, Cover, Reprisal, and Gendered Protections (User Requirement 1)
  const origRawLower = meta.rawTitle.toLowerCase();

  // Female version protection
  const isFemaleCand = /\b(female|lady|woman|female\s*version)\b/i.test(candTitleLower);
  const isFemaleOrig = /\b(female|lady|woman|female\s*version)\b/i.test(origRawLower);
  if (isFemaleCand && !isFemaleOrig) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Candidate is a Female Version; original title did not specify Female Version'
    };
  }
  if (isFemaleOrig && !isFemaleCand) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Original is a Female Version; candidate title does not specify Female Version'
    };
  }

  // Male version protection
  const isMaleCand = /\bmale\s*version\b/i.test(candTitleLower);
  const isMaleOrig = /\bmale\s*version\b/i.test(origRawLower);
  if (isMaleCand && !isMaleOrig) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Candidate is a Male Version; original is standard version'
    };
  }
  if (isMaleOrig && !isMaleCand) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Original is a Male Version; candidate is standard version'
    };
  }

  // Reprisal / Reprise protection
  const isRepriseCand = /\b(reprise|reprised|reprisal)\b/i.test(candTitleLower);
  const isRepriseOrig = /\b(reprise|reprised|reprisal)\b/i.test(origRawLower);
  if (isRepriseCand && !isRepriseOrig) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Candidate is a Reprise; original is standard version'
    };
  }
  if (isRepriseOrig && !isRepriseCand) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Original is a Reprise; candidate is standard version'
    };
  }

  // Cover / Acoustic / Unplugged / Tribute protection
  const isCoverCand = /\b(cover|acoustic|unplugged|tribute)\b/i.test(candTitleLower);
  if (isCoverCand && !meta.isCover) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Candidate is a Cover/Acoustic; original is studio master'
    };
  }

  // Sad / Pathos version protection
  const isSadCand = /\b(sad\s*version|pathos)\b/i.test(candTitleLower);
  const isSadOrig = /\b(sad\s*version|pathos)\b/i.test(origRawLower);
  if (isSadCand && !isSadOrig) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Candidate is a Sad/Pathos version; original is standard version'
    };
  }
  if (isSadOrig && !isSadCand) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Original is a Sad/Pathos version; candidate is standard version'
    };
  }

  // Version & Type Protections (Prevent wrong remix, karaoke, live, or instrumental matches)
  if (!meta.isRemix && (candTitleLower.includes('remix') || candTitleLower.includes('club mix') || candTitleLower.includes('edm mix'))) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Original is studio master, candidate is a Remix'
    };
  }

  if (!meta.isCover && (candTitleLower.includes('karaoke') || candTitleLower.includes('instrumental') || candTitleLower.includes('tribute'))) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Original is studio master, candidate is karaoke/instrumental'
    };
  }

  if (!meta.isLive && (candTitleLower.includes('live at') || candTitleLower.includes('live concert') || candTitleLower.includes('live performance') || candTitleLower.includes('unplugged'))) {
    return {
      passed: false,
      confidence: 0,
      reason: 'Rejected: Original is studio master, candidate is a live recording'
    };
  }

  // STRICT RULE 2: Same song name across different movies protection
  if (meta.movie) {
    const movieMatches =
      fuzzyMovieMatch(meta.movie, candidate.album || '') ||
      fuzzyMovieMatch(meta.movie, candidate.title || '');

    if (movieMatches) {
      // 100% Lock: Album/Movie explicitly matches the extracted movie context (accounting for spacing & transliteration)
      artistBonus = Math.max(artistBonus, 0.20);
    } else {
      // Original track specifies a movie (e.g. "Jigarthanda DoubleX"),
      // but candidate is from a completely different movie! Reject cross-movie mismatch!
      return {
        passed: false,
        confidence: 0,
        reason: `Rejected: Cross-movie mismatch (YouTube Movie: "${meta.movie}" vs Catalog Album: "${candidate.album || candidate.title}")`
      };
    }
  } else {
    // Movie name not in title -> Must have artist match OR duration difference strictly <= 3 seconds!
    if (!isArtistMatched && !meta.isAutomatedOrLabelArtist && diff > 3) {
      return {
        passed: false,
        confidence: Math.round(titleSim * 100),
        reason: `Rejected: Cross-movie protection: generic song without movie context has no artist match and duration diff (${diff}s) exceeds ±3s`
      };
    }
  }

  // Strict duration bonus for Pass 3 / Clean title alone
  let durationBonus = 0;
  if (meta.duration && meta.duration > 0 && candDuration > 0 && diff <= 3) {
    durationBonus = 0.10; // Strict duration match bonus (±3 seconds)
  }

  const finalConfidence = Math.min(1.0, titleSim + artistBonus + durationBonus);

  if (finalConfidence < 0.75) {
    return {
      passed: false,
      confidence: Math.round(finalConfidence * 100),
      reason: `Rejected: Overall confidence ${Math.round(finalConfidence * 100)}% below 75% threshold`
    };
  }

  return {
    passed: true,
    confidence: Math.round(finalConfidence * 100),
    reason: `Passed all hard gates with ${Math.round(finalConfidence * 100)}% confidence`
  };
}

/**
 * Searches the authorized direct music catalog (JioSaavn 320k) and matches with hard gates using a 4-Step Strategy:
 * - Step 0: Check Pre-Curated Verified 320k Hits (Instant 0ms, Zero Network, Strict Gates)
 * - Pass 1: Clean Title + Extracted Movie Name (High priority for Tamil / Cinema tracks)
 * - Pass 2: Clean Title + Clean Artist
 * - Pass 3: Clean Title alone with strict duration matching (±4 seconds)
 * Returns either MATCHED with direct 320k stream, or UNMATCHED_FOREGROUND_ONLY.
 */
export async function matchYouTubeToCatalog(
  rawTitle: string,
  rawArtist?: string,
  duration?: number,
  videoId?: string,
  thumbnail?: string
): Promise<CatalogMatchResult> {
  const meta = cleanTrackMetadata(rawTitle, rawArtist, duration);
  const normalizedThumb = videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : (thumbnail || '');

  const fallbackSong: Song = {
    id: videoId ? `online_${videoId}` : `yt_${Date.now()}`,
    title: rawTitle,
    artist: meta.artist || rawArtist || 'YouTube',
    album: 'YouTube Video',
    duration: duration || 0,
    coverArt: normalizedThumb,
    artwork: normalizedThumb,
    sourceId: videoId,
    format: 'M4A',
    bitrate: 160,
    fileSize: duration ? Math.round(duration * 160 * 125) : 0,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    path: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
    filePath: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
    fileName: `${rawTitle.replace(/[^a-zA-Z0-9]/g, '_')}.m4a`,
    isOnline: true,
    isSaavn: false,
    isForegroundOnly: true,
    playbackMode: 'youtube-foreground',
    isDirectAudioStream: false
  };

  // Immediate Gate: If it's a 10m+ mixtape / DJ mix, do NOT search 3-min pop songs!
  if (meta.isMixtape && (!duration || duration > 600)) {
    return {
      status: 'UNMATCHED_FOREGROUND_ONLY',
      confidence: 0,
      reason: 'Track is a long DJ Mixtape/Compilation (>10m); reserved for YouTube Foreground Mode',
      song: fallbackSong
    };
  }

  // STEP 0: Check Pre-Curated Verified 320k Catalog before network calls
  if (Array.isArray(PRESET_SAAVN_320K_HITS) && PRESET_SAAVN_320K_HITS.length > 0) {
    for (const preset of PRESET_SAAVN_320K_HITS) {
      const evalResult = evaluateHardGates(meta, preset);
      if (evalResult.passed && evalResult.confidence >= 80) {
        return {
          status: 'MATCHED',
          confidence: 99,
          streamUrl: preset.filePath,
          song: {
            ...preset,
            isSaavn: true,
            isDirectAudioStream: true,
            isForegroundOnly: false,
            playbackMode: 'direct-catalog',
            format: '320k AAC',
            bitrate: 320,
            sourceId: videoId || preset.sourceId,
            coverArt: preset.coverArt || preset.artwork || normalizedThumb,
            artwork: preset.artwork || preset.coverArt || normalizedThumb
          },
          reason: `Verified Preset 320k Match: "${preset.title}" (${evalResult.reason})`
        };
      }
    }
  }

  // Candidate evaluation helper
  const testCandidates = (candidates: Song[]): Song | null => {
    if (!candidates || candidates.length === 0) return null;
    for (const candidate of candidates) {
      if (candidate.isPreview || candidate.id.startsWith('itunes_') || !candidate.filePath) {
        continue;
      }
      const evaluation = evaluateHardGates(meta, candidate);
      if (evaluation.passed) {
        return {
          ...candidate,
          isSaavn: true,
          isDirectAudioStream: true,
          isForegroundOnly: false,
          playbackMode: 'direct-catalog',
          format: '320k AAC',
          bitrate: 320,
          sourceId: videoId || candidate.sourceId,
          coverArt: candidate.coverArt || candidate.artwork || normalizedThumb,
          artwork: candidate.artwork || candidate.coverArt || normalizedThumb
        };
      }
    }
    return null;
  };

  // PASS 1: Clean Title + Extracted Movie Name (High priority for Tamil / Indian Cinema tracks)
  if (meta.movie && meta.cleanTitle.length >= 2) {
    try {
      const pass1Query = `${meta.cleanTitle} ${meta.movie}`.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const candidates = await searchJioSaavn(pass1Query, 4, 1);
      const matched = testCandidates(candidates);
      if (matched) {
        return {
          status: 'MATCHED',
          confidence: 95,
          streamUrl: matched.filePath,
          song: matched,
          reason: `Pass 1 Matched: Movie "${meta.movie}" + Title "${meta.cleanTitle}"`
        };
      }
    } catch (err) {
      console.warn('[CatalogMatcher] Pass 1 search notice:', err);
    }
  }

  // PASS 2: Clean Title + Clean Artist
  if (meta.artist && meta.cleanTitle.length >= 2) {
    try {
      const pass2Query = `${meta.cleanTitle} ${meta.artist}`.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const candidates = await searchJioSaavn(pass2Query, 4, 1);
      const matched = testCandidates(candidates);
      if (matched) {
        return {
          status: 'MATCHED',
          confidence: 90,
          streamUrl: matched.filePath,
          song: matched,
          reason: `Pass 2 Matched: Title "${meta.cleanTitle}" + Artist "${meta.artist}"`
        };
      }
    } catch (err) {
      console.warn('[CatalogMatcher] Pass 2 search notice:', err);
    }
  }

  // PASS 3: Clean Title alone
  if (meta.cleanTitle.length >= 2) {
    try {
      const pass3Query = meta.cleanTitle.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const candidates = await searchJioSaavn(pass3Query, 5, 1);
      const matched = testCandidates(candidates);
      if (matched) {
        return {
          status: 'MATCHED',
          confidence: 85,
          streamUrl: matched.filePath,
          song: matched,
          reason: `Pass 3 Matched: Title "${meta.cleanTitle}" with guarded duration gate`
        };
      }
    } catch (err) {
      console.warn('[CatalogMatcher] Pass 3 search notice:', err);
    }
  }

  // PASS 4: Transliteration & Phonetic Variations (e.g. Usalampatti -> Usilampatti, Poovoma -> Povoma, Melliname -> Mellinamae)
  if (meta.cleanTitle.length >= 3) {
    const translitTitle = meta.cleanTitle
      .replace(/\busala/gi, 'usila')
      .replace(/\bpoovo/gi, 'povo')
      .replace(/\bmelliname\b/gi, 'mellinamae')
      .replace(/\banbae\b/gi, 'anbe');

    if (translitTitle.toLowerCase() !== meta.cleanTitle.toLowerCase()) {
      try {
        const pass4Query = translitTitle.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const candidates = await searchJioSaavn(pass4Query, 5, 1);
        const matched = testCandidates(candidates);
        if (matched) {
          return {
            status: 'MATCHED',
            confidence: 85,
            streamUrl: matched.filePath,
            song: matched,
            reason: `Pass 4 Matched: Transliteration "${translitTitle}"`
          };
        }
      } catch (err) {
        console.warn('[CatalogMatcher] Pass 4 search notice:', err);
      }
    }
  }

  return {
    status: 'UNMATCHED_FOREGROUND_ONLY',
    confidence: 0,
    reason: 'No high-confidence authorized catalog match found; retaining YouTube Foreground Mode',
    song: fallbackSong
  };
}
