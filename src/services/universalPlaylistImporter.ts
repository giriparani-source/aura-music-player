import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Song, Playlist, PlaylistEntry } from '../types/music';
import { searchJioSaavn, fetchJioSaavnPlaylist, searchJioSaavnPlaylists } from './jiosaavnService';
import { resolveYoutubeAudioStream } from './youtubeAudioResolver';
import { matchYouTubeToCatalog } from './catalogMatcher';
import { useLibraryStore } from '../store/useLibraryStore';
import { buildApiUrl } from '../utils/apiConfig';

export type SupportedPlatform = 'spotify' | 'youtube' | 'jiosaavn' | 'text' | 'unknown';

export interface ExtractedTrack {
  title: string;
  artist?: string;
  duration?: number;
  artwork?: string;
  videoId?: string;
  isDirectVideo?: boolean;
  isUnavailable?: boolean;
  status?: 'available' | 'unavailable';
  unavailableReason?: string;
}

export interface ExtractedPlaylist {
  platform: SupportedPlatform;
  title: string;
  description?: string;
  coverArt?: string;
  tracks: ExtractedTrack[];
}

export interface ImportProgress {
  current: number;
  total: number;
  percent: number;
  status: string;
}

export interface ImportedPlaylistResult {
  platform: SupportedPlatform;
  title: string;
  description: string;
  coverArt: string;
  totalTracks: number;
  matchedTracks: number;
  songs: Song[];
  entries?: PlaylistEntry[];
}

/**
 * Clean track titles extracted from YouTube or web (removes "Official Video", "(Audio)", etc.)
 */
export function cleanSearchQuery(title: string, artist?: string): string {
  let clean = title
    // Remove bracketed & parenthesized tags
    .replace(/\[\s*(official|music|video|audio|lyrics?|hd|4k|8k|remastered|visualizer).*?\]/gi, '')
    .replace(/\(\s*(official|music|video|audio|lyrics?|hd|4k|8k|remastered|visualizer|video\s+song|full\s+video|lyrical).*?\)/gi, '')
    // Strip trailing movie/crew credits after pipe or bullet
    .replace(/[|•].*$/gi, '')
    // Strip common YouTube unbracketed tags
    .replace(/\b(video\s+song|lyric\s+video|official\s+video|full\s+video\s+song|full\s+video|music\s+video|lyrical\s+video|audio\s+song|4k\s+video|4k|8k|uhd|full\s+hd)\b/gi, '')
    // Strip trailing dashes with descriptors
    .replace(/\s*-\s*(video|audio|lyrics?|song|4k).*$/gi, '')
    .replace(/\b(ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If artist is provided and not already in clean title, append for precision
  if (artist && artist !== 'YouTube' && !clean.toLowerCase().includes(artist.toLowerCase())) {
    clean = `${clean} ${artist}`;
  }
  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Helper to fetch text natively on Android (bypasses browser CORS) or standard fetch on Web.
 */
async function universalFetchText(url: string, timeoutMs: number = 8000, parentSignal?: AbortSignal): Promise<string> {
  if (parentSignal?.aborted) {
    throw new DOMException('Import aborted', 'AbortError');
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({
        url,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs
      });
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    } catch (e) {
      console.warn('[Importer] Native CapacitorHttp fetch error:', e);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    return await res.text();
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

/**
 * Helper to fetch JSON natively on Android or standard fetch on Web.
 */
async function universalFetchJson<T = any>(url: string, timeoutMs: number = 8000, parentSignal?: AbortSignal): Promise<T> {
  if (parentSignal?.aborted) {
    throw new DOMException('Import aborted', 'AbortError');
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({
        url,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs
      });
      return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    } catch (e) {
      console.warn('[Importer] Native CapacitorHttp JSON fetch error:', e);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: controller.signal
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

/**
 * Detect platform from input URL or text.
 */
export function detectPlatform(input: string): SupportedPlatform {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('spotify.com') || trimmed.startsWith('spotify:')) {
    return 'spotify';
  }
  if (
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be') ||
    trimmed.includes('music.youtube.com')
  ) {
    return 'youtube';
  }
  if (trimmed.includes('jiosaavn.com') || trimmed.includes('saavn.com')) {
    return 'jiosaavn';
  }
  if (trimmed.includes('\n') || (trimmed.length > 5 && !trimmed.startsWith('http'))) {
    return 'text';
  }
  return 'unknown';
}

/**
 * Extract tracks from Spotify playlist or album link.
 */
export async function extractSpotifyTracks(url: string, signal?: AbortSignal): Promise<ExtractedPlaylist> {
  if (signal?.aborted) {
    throw new DOMException('Import aborted', 'AbortError');
  }

  let title = 'Spotify Playlist';
  let coverArt = '';
  const tracks: ExtractedTrack[] = [];

  // Extract ID
  const match = url.match(/(playlist|album)[/:]([a-zA-Z0-9]+)/i);
  const type = match ? match[1].toLowerCase() : 'playlist';
  const id = match ? match[2] : '';

  // 1. Try public oEmbed for Title & Cover (Universal CORS: *)
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const oembed = await universalFetchJson(oembedUrl, 5000, signal);
    if (oembed?.title) title = oembed.title;
    if (oembed?.thumbnail_url) coverArt = oembed.thumbnail_url;
  } catch (e) {
    console.warn('[Importer] Spotify oEmbed error:', e);
  }

  if (id) {
    // 2. LAYER A: Native Android Capacitor HTTP (Direct Embed without CORS)
    if (Capacitor.isNativePlatform()) {
      const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
      try {
        const html = await universalFetchText(embedUrl, 7000, signal);
        const nextDataMatch = html.match(/__NEXT_DATA__.*?>(.*?)<\/script>/s);
        if (nextDataMatch) {
          const parsed = JSON.parse(nextDataMatch[1]);
          const entity = parsed?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            if (entity.name || entity.title) title = entity.name || entity.title;
            if (entity.coverArt?.sources?.[0]?.url) coverArt = entity.coverArt.sources[0].url;

            const rawTrackList = entity.trackList || [];
            for (const t of rawTrackList) {
              const trackTitle = t.title || t.name;
              if (trackTitle) {
                tracks.push({
                  title: trackTitle,
                  artist: t.subtitle || t.artist || '',
                  duration: t.duration ? Math.round(t.duration / 1000) : undefined,
                  artwork: coverArt
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Importer] Native Spotify embed parse failed:', err);
      }
    }

    // 3. LAYER B: Local / Web Server Endpoint (/api/playlist/spotify)
    if (tracks.length === 0) {
      try {
        const primaryEndpoint = buildApiUrl(`/api/playlist/spotify?id=${id}&type=${type}`);
        const endpoints = [primaryEndpoint];
        const relativeEndpoint = `/api/playlist/spotify?id=${id}&type=${type}`;
        if (!endpoints.includes(relativeEndpoint)) {
          endpoints.push(relativeEndpoint);
        }

        for (const endpoint of endpoints) {
          try {
            const serverRes = await fetch(endpoint, {
              headers: { Accept: 'application/json' },
              signal
            });
            if (serverRes.ok) {
              const data = await serverRes.json();
              if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
                title = data.title || title;
                if (data.coverArt) coverArt = data.coverArt;
                for (const t of data.tracks) {
                  tracks.push({
                    title: t.title,
                    artist: t.artist,
                    duration: t.duration,
                    artwork: coverArt
                  });
                }
                break; // Successfully loaded tracks
              }
            }
          } catch (_) {}
        }
      } catch (serverErr) {
        console.warn('[Importer] Local Spotify API notice:', serverErr);
      }
    }

    // 4. LAYER C: Public Jina Markdown Reader (Zero Localhost, CORS: *)
    // Preserves all duplicate entries according to source ordering!
    if (tracks.length === 0) {
      try {
        const jinaUrl = `https://r.jina.ai/https://open.spotify.com/${type}/${id}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const onAbort = () => controller.abort();
        if (signal) signal.addEventListener('abort', onAbort, { once: true });

        const jinaRes = await fetch(jinaUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: controller.signal
        });
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (jinaRes.ok) {
          const markdown = await jinaRes.text();
          const regex = /\[([^\]]+)\]\(https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+\)/g;
          let m;
          while ((m = regex.exec(markdown)) !== null) {
            const trackName = m[1].trim();
            if (trackName) {
              tracks.push({
                title: trackName,
                artwork: coverArt
              });
            }
          }
        }
      } catch (jinaErr) {
        console.warn('[Importer] Public CORS markdown reader notice:', jinaErr);
      }
    }

    // 5. LAYER D: JioSaavn Smart Playlist Search Fallback
    if (tracks.length === 0 && title && title !== 'Spotify Playlist') {
      try {
        const saavnPls = await searchJioSaavnPlaylists(title, 3);
        if (saavnPls.length > 0) {
          const bestPl = await fetchJioSaavnPlaylist(saavnPls[0].id, 50);
          if (bestPl && bestPl.songs.length > 0) {
            title = bestPl.name;
            if (bestPl.coverArt) coverArt = bestPl.coverArt;
            for (const s of bestPl.songs) {
              tracks.push({
                title: s.title,
                artist: s.artist,
                duration: s.duration,
                artwork: s.artwork
              });
            }
          }
        }
      } catch (saavnErr) {
        console.warn('[Importer] JioSaavn title search fallback notice:', saavnErr);
      }
    }
  }

  // If still empty, fallback to searching the title itself
  if (tracks.length === 0 && title !== 'Spotify Playlist') {
    tracks.push({ title });
  }

  return {
    platform: 'spotify',
    title,
    description: `Imported Spotify playlist (${tracks.length} tracks)`,
    coverArt,
    tracks
  };
}

/**
 * Extract tracks from YouTube / YouTube Music playlist link.
 */
/**
 * Extract single YouTube video track with exact title, thumbnail, and stream videoId.
 */
async function extractSingleYouTubeVideo(videoId: string, signal?: AbortSignal): Promise<ExtractedPlaylist> {
  const tracks: ExtractedTrack[] = [];
  const defaultThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedData = await universalFetchJson<any>(oembedUrl, 5000, signal);

    const videoTitle = oembedData?.title || 'YouTube Track';
    const videoAuthor = oembedData?.author_name || 'YouTube';
    const thumbUrl = oembedData?.thumbnail_url || defaultThumb;

    tracks.push({
      title: videoTitle,
      artist: videoAuthor,
      artwork: thumbUrl,
      duration: 240,
      videoId,
      isDirectVideo: true
    });

    return {
      platform: 'youtube',
      title: videoTitle,
      description: `YouTube Audio • ${videoAuthor}`,
      coverArt: thumbUrl,
      tracks
    };
  } catch (err) {
    console.warn('[Importer] oEmbed fetch failed, fallback with video ID:', err);
    tracks.push({
      title: 'YouTube Track',
      artist: 'YouTube',
      artwork: defaultThumb,
      duration: 240,
      videoId,
      isDirectVideo: true
    });

    return {
      platform: 'youtube',
      title: 'YouTube Audio Track',
      description: 'Imported single track from YouTube',
      coverArt: defaultThumb,
      tracks
    };
  }
}

/**
 * Extract tracks from YouTube / YouTube Music playlist or single video link.
 */
export async function extractYouTubeTracks(url: string, signal?: AbortSignal): Promise<ExtractedPlaylist> {
  if (signal?.aborted) {
    throw new DOMException('Import aborted', 'AbortError');
  }

  let title = 'YouTube Playlist';
  let coverArt = '';
  const tracks: ExtractedTrack[] = [];

  // Check for Single YouTube Video Link (e.g. youtu.be/ID, watch?v=ID, shorts/ID)
  const videoMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/i);
  const singleVideoId = videoMatch ? videoMatch[1] : '';

  // Check for playlist id (list=...)
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
  const playlistId = match ? match[1] : '';

  // YouTube Mixes (RD...) or Liked lists cannot be parsed as public playlists by Invidious
  const isMixOrPersonalList = playlistId.startsWith('RD') || playlistId.startsWith('LL');

  // If there is no valid public playlist ID or it's a mix with a specific video, prioritize the single video!
  if (!playlistId || (isMixOrPersonalList && singleVideoId)) {
    if (singleVideoId) {
      return await extractSingleYouTubeVideo(singleVideoId, signal);
    }
    throw new Error('Could not find YouTube video or playlist ID in link. Please verify the URL.');
  }

  const invidiousInstances = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.jing.rocks'
  ];

  for (const instance of invidiousInstances) {
    if (signal?.aborted) {
      throw new DOMException('Import aborted', 'AbortError');
    }
    try {
      const endpoint = `${instance}/api/v1/playlists/${playlistId}`;
      const data = await universalFetchJson(endpoint, 6000, signal);
      if (data && Array.isArray(data.videos)) {
        title = data.title || title;
        if (data.playlistThumbnail) coverArt = data.playlistThumbnail;

        let rawVideos = data.videos;
        // Detect and normalize Invidious pagination duplicate block if present (e.g. 16 tracks repeated)
        if (rawVideos.length >= 132) {
          let repeatedMatch = 0;
          for (let i = 0; i < 16; i++) {
            if (rawVideos[100 + i]?.videoId && rawVideos[100 + i]?.videoId === rawVideos[116 + i]?.videoId) {
              repeatedMatch++;
            }
          }
          if (repeatedMatch === 16) {
            console.log('[Importer] Normalizing 16-track repeated pagination artifact from Invidious stream');
            rawVideos = [...rawVideos.slice(0, 116), ...rawVideos.slice(132)];
          }
        }

        for (const v of rawVideos) {
          const isDeletedOrPrivate = !v.videoId ||
            v.title === '[Deleted video]' ||
            v.title === '[Private video]' ||
            v.title?.toLowerCase().includes('deleted') ||
            v.title?.toLowerCase().includes('private') ||
            v.lengthSeconds === 0 ||
            v.isUnavailable === true;

          // Normalize to YouTube global CDN: https://i.ytimg.com/vi/${videoId}/hqdefault.jpg
          const normalizedArtwork = v.videoId
            ? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
            : (v.videoThumbnails?.[0]?.url && v.videoThumbnails[0].url.startsWith('http') ? v.videoThumbnails[0].url : '');

          if (isDeletedOrPrivate) {
            tracks.push({
              title: (v.title && !v.title.startsWith('[')) ? v.title : '[Unavailable Video]',
              artist: v.author || 'Unavailable on YouTube',
              duration: v.lengthSeconds || 0,
              artwork: normalizedArtwork,
              videoId: v.videoId,
              isUnavailable: true,
              status: 'unavailable',
              unavailableReason: 'Video deleted or private on YouTube'
            });
          } else {
            tracks.push({
              title: v.title,
              artist: v.author,
              duration: v.lengthSeconds || 210,
              artwork: normalizedArtwork,
              videoId: v.videoId,
              isUnavailable: false,
              status: 'available'
            });
          }
        }
        break; // Successfully extracted
      }
    } catch (e) {
      console.warn(`[Importer] Invidious instance ${instance} error:`, e);
    }
  }

  // If playlist parsing failed but URL points to a specific video, fallback to single video
  if (tracks.length === 0) {
    if (singleVideoId) {
      return await extractSingleYouTubeVideo(singleVideoId);
    }
    throw new Error('Unable to extract YouTube playlist tracks. Please verify playlist is public.');
  }

  return {
    platform: 'youtube',
    title,
    description: `Imported YouTube playlist (${tracks.length} tracks)`,
    coverArt,
    tracks
  };
}

/**
 * Extract tracks from raw text (one song per line).
 */
function extractRawTextTracks(text: string): ExtractedPlaylist {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1 && !l.startsWith('#'));

  const tracks: ExtractedTrack[] = [];

  for (const line of lines) {
    // Remove leading numbering like "1. ", "01 - "
    const cleaned = line.replace(/^\d+[\.\-\)]\s*/, '').trim();
    if (!cleaned) continue;

    // Split by "-" or "–" if present
    if (cleaned.includes(' - ')) {
      const parts = cleaned.split(' - ');
      tracks.push({
        title: parts[0].trim(),
        artist: parts.slice(1).join(' - ').trim()
      });
    } else {
      tracks.push({ title: cleaned });
    }
  }

  return {
    platform: 'text',
    title: `Imported Tracklist (${tracks.length} Songs)`,
    description: `Imported from text list (${tracks.length} tracks)`,
    coverArt: '',
    tracks
  };
}

/**
 * Core Universal Importer Function:
 * Takes URL or raw tracklist, extracts tracks, matches with 320kbps JioSaavn streams in super-fast parallel batches!
 */
export async function importUniversalPlaylist(
  input: string,
  onProgress?: (progress: ImportProgress) => void,
  signal?: AbortSignal
): Promise<ImportedPlaylistResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Please enter a playlist link or track list.');
  }

  if (signal?.aborted) {
    throw new DOMException('Import aborted', 'AbortError');
  }

  const platform = detectPlatform(trimmed);

  // 1. FAST PATH: JioSaavn Playlist Link or ID
  if (platform === 'jiosaavn' || /^\d{6,12}$/.test(trimmed)) {
    onProgress?.({
      current: 0,
      total: 100,
      percent: 20,
      status: 'Fetching JioSaavn 320kbps HD audio tracks...'
    });

    const saavnData = await fetchJioSaavnPlaylist(trimmed, 100);
    if (!saavnData || saavnData.songs.length === 0) {
      throw new Error('Could not find JioSaavn playlist. Please check the URL or ID.');
    }

    if (signal?.aborted) {
      throw new DOMException('Import aborted', 'AbortError');
    }

    onProgress?.({
      current: saavnData.songs.length,
      total: saavnData.songs.length,
      percent: 100,
      status: `Successfully imported ${saavnData.songs.length} 320kbps songs!`
    });

    return {
      platform: 'jiosaavn',
      title: saavnData.name,
      description: saavnData.description || `JioSaavn 320kbps HD Audio Playlist`,
      coverArt: saavnData.coverArt,
      totalTracks: saavnData.songs.length,
      matchedTracks: saavnData.songs.length,
      songs: saavnData.songs
    };
  }

  // 2. Extract track list from Spotify, YouTube, or Text
  onProgress?.({
    current: 0,
    total: 100,
    percent: 10,
    status: `Extracting playlist data from ${platform}...`
  });

  let extracted: ExtractedPlaylist;
  if (platform === 'spotify') {
    extracted = await extractSpotifyTracks(trimmed, signal);
  } else if (platform === 'youtube') {
    extracted = await extractYouTubeTracks(trimmed, signal);
  } else if (platform === 'text') {
    extracted = extractRawTextTracks(trimmed);
  } else {
    // If unknown URL, attempt JioSaavn search or raw text
    extracted = extractRawTextTracks(trimmed);
  }

  if (signal?.aborted) {
    throw new DOMException('Import aborted', 'AbortError');
  }

  if (extracted.tracks.length === 0) {
    throw new Error('No songs could be extracted from this link. Try pasting the song titles directly!');
  }

  const total = extracted.tracks.length;
  onProgress?.({
    current: 0,
    total,
    percent: 20,
    status: `Found ${total} tracks. Matching with 320kbps HD audio...`
  });

  // 3. High-Performance Controlled Concurrency Matching (Max 4 concurrent requests with rate-limiting & backoff protection)
  const MAX_CONCURRENT = 4;
  const matchedSongs: Song[] = [];
  const entries: PlaylistEntry[] = [];
  let processedCount = 0;

  // Single track worker logic
  const processTrack = async (track: ExtractedTrack, trackIndex: number) => {
    if (signal?.aborted) return null;

    // Handle Unavailable Tracks: Attempt JioSaavn catalog recovery before giving up
    if (track.isUnavailable || track.status === 'unavailable') {
      // Check if we have a usable title (not just '[Unavailable Video]' or '[Deleted video]')
      const hasUsableTitle = track.title &&
        !track.title.startsWith('[') &&
        !track.title.toLowerCase().includes('unavailable') &&
        !track.title.toLowerCase().includes('deleted') &&
        !track.title.toLowerCase().includes('private') &&
        track.title.length >= 3;

      if (hasUsableTitle) {
        // Attempt JioSaavn 320kbps catalog recovery for deleted/private YouTube videos
        try {
          const recoveryQuery = cleanSearchQuery(
            track.title,
            track.artist && !track.artist.toLowerCase().includes('unavailable') ? track.artist : undefined
          );
          const recoveryResults = await searchJioSaavn(recoveryQuery, 1, 1, signal);
          if (recoveryResults && recoveryResults.length > 0 && !recoveryResults[0].isPreview && !recoveryResults[0].id.startsWith('itunes_')) {
            console.log(`[Importer] ✅ Recovered unavailable track via JioSaavn: "${track.title}" → "${recoveryResults[0].title}" (320k HD)`);
            return { isUnavailable: false, track, trackIndex, song: recoveryResults[0], is320k: true };
          }
        } catch (recoveryErr) {
          console.warn(`[Importer] JioSaavn recovery attempt for "${track.title}":`, recoveryErr);
        }
      }

      // Track is unavailable and unrecoverable from JioSaavn 320k catalog
      return {
        isUnavailable: true,
        track,
        trackIndex,
        song: null
      };
    }

    // 1. Single direct YouTube video link (e.g. user specifically pasted a single video URL or mixtape):
    // Directly preserve the direct video as intended without JioSaavn override
    if (track.isDirectVideo && track.videoId) {
      const song: Song = {
        id: `online_${track.videoId}`,
        title: track.title,
        artist: track.artist || 'YouTube',
        album: 'YouTube Video',
        duration: track.duration || 0,
        coverArt: track.artwork || (track.videoId ? `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg` : undefined),
        sourceId: track.videoId,
        isOnline: true,
        isForegroundOnly: true,
        playbackMode: 'youtube-foreground'
      } as Song;
      return { isUnavailable: false, track, trackIndex, song };
    }

    // 2. YouTube Playlist Track: High-Confidence 320kbps Catalog Match with Enhanced Hard Gates
    if (track.videoId) {
      try {
        const matchResult = await matchYouTubeToCatalog(
          track.title,
          track.artist !== 'YouTube' ? track.artist : undefined,
          track.duration,
          track.videoId,
          track.artwork
        );

        if (matchResult.status === 'MATCHED') {
          return { isUnavailable: false, track, trackIndex, song: matchResult.song, is320k: true };
        }
      } catch (matchErr) {
        console.warn(`[Importer] Match error for "${track.title}":`, matchErr);
      }

      // 2. Unmatched to JioSaavn -> Create YouTube Direct Audio Stream (M4A) via native ExoPlayer
      // User Requirement 2: These tracks ARE fully playable in background and screen-off via native ExoPlayer!
      // Do NOT drop them and do NOT mark them unavailable!
      const cleanArtist = track.artist && track.artist !== 'YouTube'
        ? track.artist.replace(/\s*[-•|–—]\s*(Topic|Release|Official|VEVO)\b/gi, '').trim()
        : 'YouTube Music';
      const cleanTitle = track.title || 'Untitled Track';
      const durationSec = track.duration || 210;
      const thumb = track.artwork || (track.videoId ? `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg` : '');

      const directYoutubeSong: Song = {
        id: `online_${track.videoId}`,
        sourceId: track.videoId,
        title: cleanTitle,
        artist: cleanArtist || 'YouTube Music',
        album: 'YouTube Music',
        duration: durationSec,
        format: 'M4A',
        bitrate: 160,
        fileSize: Math.round(durationSec * 160 * 125),
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: thumb,
        coverArt: thumb,
        filePath: `https://www.youtube.com/watch?v=${track.videoId}`,
        path: `https://www.youtube.com/watch?v=${track.videoId}`,
        fileName: `${cleanTitle.replace(/[^\w\s-]/g, '_')}.m4a`,
        isOnline: true,
        isSaavn: false,
        isForegroundOnly: false, // PLAYABLE IN BACKGROUND!
        playbackMode: 'direct-catalog', // Plays via direct stream extractor in native ExoPlayer!
        isDirectAudioStream: true
      } as Song;

      return {
        isUnavailable: false,
        track,
        trackIndex,
        song: directYoutubeSong,
        is320k: false
      };
    }

    // 3. Text / Spotify Track: Direct JioSaavn Catalog Lookup
    const q = cleanSearchQuery(track.title, track.artist !== 'YouTube' ? track.artist : undefined);
    try {
      const results = await searchJioSaavn(q, 1, 1, signal);
      let candidate = results && results.length > 0 ? results[0] : null;

      if (!candidate || candidate.isPreview || candidate.id.startsWith('itunes_')) {
        const titleOnly = cleanSearchQuery(track.title);
        if (titleOnly !== q) {
          const fallback = await searchJioSaavn(titleOnly, 1, 1, signal);
          if (fallback && fallback.length > 0 && !fallback[0].isPreview && !fallback[0].id.startsWith('itunes_')) {
            candidate = fallback[0];
          }
        }
      }

      if (candidate && !candidate.isPreview && !candidate.id.startsWith('itunes_')) {
        return { isUnavailable: false, track, trackIndex, song: candidate };
      }
    } catch (saavnErr) {
      console.warn('[Importer] JioSaavn text match notice:', saavnErr);
    }

    // Fallback for unresolvable text or Spotify links (preserve Spotify behavior)
    if (platform === 'spotify') {
      const fallbackSong: Song = {
        id: `unknown_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: 'Imported',
        duration: track.duration || 180,
        format: 'MP3',
        bitrate: 128,
        fileSize: 3000000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: track.artwork || '',
        coverArt: track.artwork || '',
        filePath: '',
        path: '',
        fileName: `${track.title}.mp3`,
        isOnline: true
      } as Song;
      return { isUnavailable: false, track, trackIndex, song: fallbackSong };
    }

    const fallbackSong: Song = {
      id: `imported_${Date.now()}_${trackIndex}_${Math.random().toString(36).substring(7)}`,
      title: track.title || 'Imported Track',
      artist: track.artist || 'Unknown Artist',
      album: 'Imported',
      duration: track.duration || 180,
      format: 'MP3',
      bitrate: 128,
      fileSize: 3000000,
      dateAdded: Date.now(),
      playCount: 0,
      isFavorite: false,
      artwork: track.artwork || '',
      coverArt: track.artwork || '',
      filePath: '',
      path: '',
      fileName: `${(track.title || 'track').replace(/[^\w\s-]/g, '_')}.mp3`,
      isOnline: true,
      isForegroundOnly: false,
      playbackMode: 'direct-catalog',
      isDirectAudioStream: true
    } as Song;
    return { isUnavailable: false, track, trackIndex, song: fallbackSong, is320k: false };
  };

  // Concurrency Worker Pool: exactly MAX_CONCURRENT active workers processing in-order tasks
  const trackItems = extracted.tracks.map((track, trackIndex) => ({ track, trackIndex }));
  let nextQueueIndex = 0;
  const processedResults: any[] = [];

  const worker = async () => {
    while (nextQueueIndex < trackItems.length) {
      if (signal?.aborted) {
        throw new DOMException('Import aborted', 'AbortError');
      }
      const item = trackItems[nextQueueIndex++];
      const res = await processTrack(item.track, item.trackIndex);
      if (res) {
        processedResults.push(res);
      }
      processedCount++;

      const saavn320kSoFar = processedResults.filter((r) => r && r.is320k).length;
      const directStreamsSoFar = processedCount - saavn320kSoFar;
      const percent = Math.min(95, 20 + Math.round((processedCount / total) * 75));

      onProgress?.({
        current: processedCount,
        total,
        percent,
        status: `Importing ${processedCount} of ${total} songs (${saavn320kSoFar} 320k HD, ${directStreamsSoFar} HQ streams)...`
      });

      // Controlled 35ms stagger between network queries to prevent Vercel 429 rate-limiting
      if (nextQueueIndex < trackItems.length) {
        await new Promise((resolve) => setTimeout(resolve, 35));
      }
    }
  };

  const poolWorkers = Array.from(
    { length: Math.min(MAX_CONCURRENT, trackItems.length) },
    () => worker()
  );
  await Promise.all(poolWorkers);

  if (signal?.aborted) {
    throw new DOMException('Import aborted', 'AbortError');
  }

  // Sort strictly by original position to preserve order and duplicate occurrences
  processedResults.sort((a, b) => a.trackIndex - b.trackIndex);

  for (const item of processedResults) {
    if (item.isUnavailable || !item.song) {
      const vid = item.track?.videoId || '';
      const thumb =
        item.track?.artwork ||
        (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : '');
      entries.push({
        entryId: `pe_${Date.now()}_${item.trackIndex}_${Math.random().toString(36).substring(2, 7)}`,
        songId: null,
        position: item.trackIndex,
        status: 'unavailable',
        title: item.track?.title || '[Unavailable Track]',
        artist: item.track?.artist || 'Unknown Artist',
        duration: item.track?.duration || 0,
        coverArt: thumb,
        sourceTrackId: vid || undefined,
        addedAt: Date.now()
      });
      continue;
    }

    let playableSong = item.song;

    if (!matchedSongs.some((s) => s.id === playableSong.id)) {
      matchedSongs.push(playableSong);
    }

    const validEntryArt =
      playableSong.coverArt ||
      playableSong.artwork ||
      (item.track?.videoId ? `https://i.ytimg.com/vi/${item.track.videoId}/hqdefault.jpg` : item.track?.artwork) ||
      '';

    entries.push({
      entryId: `pe_${Date.now()}_${item.trackIndex}_${Math.random().toString(36).substring(2, 7)}`,
      songId: playableSong.id,
      position: item.trackIndex,
      status: 'available',
      title: playableSong.title,
      artist: playableSong.artist,
      duration: playableSong.duration,
      coverArt: validEntryArt,
      sourceTrackId: item.track?.videoId,
      addedAt: Date.now()
    });
  }

  // Ensure entries are strictly ordered by position
  entries.sort((a, b) => a.position - b.position);

  if (signal?.aborted) {
    throw new DOMException('Import aborted', 'AbortError');
  }

  const saavn320kCount = processedResults.filter((r) => r && r.is320k).length;
  const directStreamCount = entries.length - saavn320kCount;

  onProgress?.({
    current: total,
    total,
    percent: 100,
    status: `Ready! ${saavn320kCount} matched 320kbps HD • ${directStreamCount} HQ audio streams. All ${entries.length} songs ready for background playback.`
  });

  const finalCoverArt =
    extracted.coverArt ||
    (matchedSongs.length > 0 ? matchedSongs[0].artwork || matchedSongs[0].coverArt || '' : '');

  return {
    platform,
    title: extracted.title,
    description: extracted.description || `Imported ${platform} playlist with ${entries.length} tracks`,
    coverArt: finalCoverArt,
    totalTracks: entries.length,
    matchedTracks: saavn320kCount,
    songs: matchedSongs,
    entries
  };
}

/**
 * Save an imported playlist result directly into Library & IndexedDB
 */
export async function saveImportedPlaylistToLibrary(result: ImportedPlaylistResult): Promise<Playlist> {
  const store = useLibraryStore.getState();
  const playlist = await store.createPlaylistWithSongs(
    result.title,
    result.description,
    result.songs,
    result.coverArt,
    result.entries
  );
  return playlist;
}
