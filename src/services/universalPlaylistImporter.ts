import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Song, Playlist } from '../types/music';
import { searchJioSaavn, fetchJioSaavnPlaylist, searchJioSaavnPlaylists } from './jiosaavnService';
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
}

/**
 * Clean track titles extracted from YouTube or web (removes "Official Video", "(Audio)", etc.)
 */
export function cleanSearchQuery(title: string, artist?: string): string {
  let clean = title
    .replace(/\[\s*(official|music|video|audio|lyrics|hd|4k|remastered).*?\]/gi, '')
    .replace(/\(\s*(official|music|video|audio|lyrics|hd|4k|remastered|visualizer|video\s+song).*?\)/gi, '')
    .replace(/\|.*$/gi, '')
    .replace(/\b(ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .trim();

  if (artist && !clean.toLowerCase().includes(artist.toLowerCase())) {
    clean = `${clean} ${artist}`;
  }
  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Helper to fetch text natively on Android (bypasses browser CORS) or standard fetch on Web.
 */
async function universalFetchText(url: string, timeoutMs: number = 8000): Promise<string> {
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
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Helper to fetch JSON natively on Android or standard fetch on Web.
 */
async function universalFetchJson<T = any>(url: string, timeoutMs: number = 8000): Promise<T> {
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
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: controller.signal
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
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
async function extractSpotifyTracks(url: string): Promise<ExtractedPlaylist> {
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
    const oembed = await universalFetchJson(oembedUrl, 5000);
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
        const html = await universalFetchText(embedUrl, 7000);
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
            const serverRes = await fetch(endpoint, { headers: { Accept: 'application/json' } });
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
    if (tracks.length === 0) {
      try {
        const jinaUrl = `https://r.jina.ai/https://open.spotify.com/${type}/${id}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const jinaRes = await fetch(jinaUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: controller.signal
        });
        clearTimeout(timer);

        if (jinaRes.ok) {
          const markdown = await jinaRes.text();
          const regex = /\[([^\]]+)\]\(https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+\)/g;
          let m;
          const seen = new Set<string>();
          while ((m = regex.exec(markdown)) !== null) {
            const trackName = m[1].trim();
            if (trackName && !seen.has(trackName.toLowerCase())) {
              seen.add(trackName.toLowerCase());
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
async function extractSingleYouTubeVideo(videoId: string): Promise<ExtractedPlaylist> {
  const tracks: ExtractedTrack[] = [];
  const defaultThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedData = await universalFetchJson<any>(oembedUrl, 5000);

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
async function extractYouTubeTracks(url: string): Promise<ExtractedPlaylist> {
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
      return await extractSingleYouTubeVideo(singleVideoId);
    }
    throw new Error('Could not find YouTube video or playlist ID in link. Please verify the URL.');
  }

  const invidiousInstances = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.jing.rocks'
  ];

  for (const instance of invidiousInstances) {
    try {
      const endpoint = `${instance}/api/v1/playlists/${playlistId}`;
      const data = await universalFetchJson(endpoint, 6000);
      if (data && Array.isArray(data.videos)) {
        title = data.title || title;
        if (data.playlistThumbnail) coverArt = data.playlistThumbnail;

        for (const v of data.videos) {
          if (v.title && v.title !== '[Deleted video]' && v.title !== '[Private video]') {
            tracks.push({
              title: v.title,
              artist: v.author,
              duration: v.lengthSeconds,
              artwork: v.videoThumbnails?.[0]?.url,
              videoId: v.videoId
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
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportedPlaylistResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Please enter a playlist link or track list.');
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
    extracted = await extractSpotifyTracks(trimmed);
  } else if (platform === 'youtube') {
    extracted = await extractYouTubeTracks(trimmed);
  } else if (platform === 'text') {
    extracted = extractRawTextTracks(trimmed);
  } else {
    // If unknown URL, attempt JioSaavn search or raw text
    extracted = extractRawTextTracks(trimmed);
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

  // 3. Super Fast Batch Matching (8 parallel requests per batch)
  const BATCH_SIZE = 8;
  const matchedSongs: Song[] = [];
  let processedCount = 0;

  for (let i = 0; i < extracted.tracks.length; i += BATCH_SIZE) {
    const chunk = extracted.tracks.slice(i, i + BATCH_SIZE);

    const batchPromises = chunk.map(async (track) => {
      // 0. Direct Single YouTube Video: Keep exact title, thumbnail, and stream original YouTube audio!
      if (track.isDirectVideo && track.videoId) {
        const songDuration = track.duration || 240;
        return {
          id: `online_${track.videoId}`,
          sourceId: track.videoId,
          title: track.title,
          artist: track.artist || 'YouTube',
          album: 'YouTube Video',
          duration: songDuration,
          format: 'STREAM',
          bitrate: 192,
          fileSize: songDuration * 24000,
          dateAdded: Date.now(),
          playCount: 0,
          isFavorite: false,
          artwork: track.artwork || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`,
          coverArt: track.artwork || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`,
          filePath: `https://www.youtube.com/watch?v=${track.videoId}`,
          path: `https://www.youtube.com/watch?v=${track.videoId}`,
          fileName: `${track.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
          isOnline: true
        } as Song;
      }

      const q = cleanSearchQuery(track.title, track.artist);
      try {
        // 1. Search JioSaavn for full 320kbps master track
        const results = await searchJioSaavn(q, 1, 1);
        let candidate = results && results.length > 0 ? results[0] : null;

        // If not found with artist, try title only
        if ((!candidate || candidate.isPreview || candidate.id.startsWith('itunes_')) && track.artist) {
          const titleOnly = cleanSearchQuery(track.title);
          const fallback = await searchJioSaavn(titleOnly, 1, 1);
          if (fallback && fallback.length > 0 && !fallback[0].isPreview && !fallback[0].id.startsWith('itunes_')) {
            candidate = fallback[0];
          }
        }

        // If JioSaavn has full audio (not 30-sec preview), return it directly
        if (candidate && !candidate.isPreview && !candidate.id.startsWith('itunes_')) {
          return candidate;
        }

        // 2. High-Reliability Fallback: Query YouTube Music / Cloud Stream for Full Song
        try {
          if (track.videoId) {
            const songDuration = track.duration || (candidate?.duration || 240);
            return {
              id: `online_${track.videoId}`,
              sourceId: track.videoId,
              title: track.title,
              artist: track.artist || 'YouTube',
              album: candidate?.album || 'YouTube Music',
              duration: songDuration,
              format: 'STREAM',
              bitrate: 192,
              fileSize: songDuration * 24000,
              dateAdded: Date.now(),
              playCount: 0,
              isFavorite: false,
              artwork: track.artwork || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`,
              coverArt: track.artwork || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`,
              filePath: `https://www.youtube.com/watch?v=${track.videoId}`,
              path: `https://www.youtube.com/watch?v=${track.videoId}`,
              fileName: `${track.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
              isOnline: true
            } as Song;
          }

          const ytSearchQuery = `${track.title} ${track.artist || ''} song`.trim();
          const ytUrl = buildApiUrl(`/api/online/search?q=${encodeURIComponent(ytSearchQuery)}`);
          const ytRes = await universalFetchJson<any>(ytUrl, 6000);
          if (Array.isArray(ytRes?.results) && ytRes.results.length > 0) {
            const ytTrack = ytRes.results[0];
            const songDuration = track.duration || ytTrack.duration || (candidate?.duration || 240);
            return {
              id: ytTrack.id || `yt_${ytTrack.sourceId}`,
              sourceId: ytTrack.sourceId,
              title: track.title,
              artist: track.artist || ytTrack.artist || 'Artist',
              album: candidate?.album || ytTrack.album || 'Online Release',
              duration: songDuration,
              format: 'STREAM',
              bitrate: 192,
              fileSize: songDuration * 24000,
              dateAdded: Date.now(),
              playCount: 0,
              isFavorite: false,
              artwork: ytTrack.artwork || ytTrack.coverArt || candidate?.artwork || track.artwork || '',
              coverArt: ytTrack.coverArt || ytTrack.artwork || candidate?.coverArt || track.artwork || '',
              filePath: ytTrack.filePath || `https://www.youtube.com/watch?v=${ytTrack.sourceId}`,
              path: ytTrack.path || `https://www.youtube.com/watch?v=${ytTrack.sourceId}`,
              fileName: `${track.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
              isOnline: true
            } as Song;
          }
        } catch (ytErr) {
          console.warn(`[Importer] YouTube fallback error for "${track.title}":`, ytErr);
        }

        // If YouTube was unavailable, return candidate if existing
        if (candidate) {
          return candidate;
        }
      } catch (e) {
        console.warn(`[Importer] Error matching song "${q}":`, e);
      }
      return null;
    });

    const results = await Promise.allSettled(batchPromises);
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        // Prevent duplicate IDs inside the imported playlist
        if (!matchedSongs.some((s) => s.id === res.value!.id)) {
          matchedSongs.push(res.value);
        }
      }
    }

    processedCount += chunk.length;
    const percent = Math.min(95, 20 + Math.round((processedCount / total) * 75));
    onProgress?.({
      current: processedCount,
      total,
      percent,
      status: `Importing ${processedCount} of ${total} songs (${matchedSongs.length} matched)...`
    });

    // Short 30ms yield to keep UI silky smooth and avoid browser throttling
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  onProgress?.({
    current: total,
    total,
    percent: 100,
    status: `Finished! Matched ${matchedSongs.length} of ${total} songs in 320kbps HD Audio.`
  });

  const finalCoverArt = extracted.coverArt || (matchedSongs.length > 0 ? (matchedSongs[0].artwork || matchedSongs[0].coverArt || '') : '');

  return {
    platform,
    title: extracted.title,
    description: extracted.description || `Imported ${platform} playlist with ${matchedSongs.length} songs`,
    coverArt: finalCoverArt,
    totalTracks: total,
    matchedTracks: matchedSongs.length,
    songs: matchedSongs
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
    result.coverArt
  );
  return playlist;
}
