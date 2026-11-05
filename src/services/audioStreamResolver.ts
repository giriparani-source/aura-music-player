import { Song } from '../types/music';
import { getRegisteredFile } from './scannerService';
import { resolveYoutubeAudioStream } from './youtubeAudioResolver';
import { searchJioSaavn, PRESET_SAAVN_320K_HITS } from './jiosaavnService';
import { matchYouTubeToCatalog } from './catalogMatcher';
import { radioService } from './radioService';
import { buildApiUrl } from '../utils/apiConfig';
import { Capacitor } from '@capacitor/core';

/**
 * Result of resolving a playback failure.
 */
export type FailoverResult =
  | { type: 'radio'; url: string }
  | { type: 'cloud'; videoId: string }
  | { type: 'direct'; url: string; songUpdates: Partial<Song> }
  | { type: 'failed'; message: string };

/**
 * Extracts a 11-character YouTube video ID from various song formats and URLs.
 */
export function extractYouTubeVideoId(song: Song): string | null {
  if (song.isSaavn || song.filePath?.includes('saavncdn.com')) {
    return null;
  }
  if (
    song.sourceId &&
    song.sourceId.length >= 8 &&
    song.sourceId.length <= 15 &&
    (song.id?.startsWith('online_') || song.id?.startsWith('cloud_') || song.isOnline)
  ) {
    return song.sourceId;
  }
  if (song.id && song.id.startsWith('online_')) {
    return song.id.replace('online_', '');
  }
  if (song.id && song.id.startsWith('cloud_')) {
    return song.id.replace('cloud_', '');
  }
  const pathStr = song.filePath || song.path || '';
  const match = pathStr.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i
  );
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

/**
 * Checks if a song is a short preview clip (e.g. 30s iTunes sample)
 * that should not be played as a full audio stream.
 */
export function isPreviewClip(song: Song): boolean {
  return Boolean(
    song.isPreview ||
      song.id?.startsWith('itunes_') ||
      (song.filePath &&
        (song.filePath.includes('mzstatic.com') || song.filePath.includes('itunes.apple.com')))
  );
}

/**
 * Checks if a track is a true direct audio stream
 * (JioSaavn 320k master, Live FM Radio, or direct M4A stream).
 */
export function isDirectAudioStream(song: Song): boolean {
  if (isPreviewClip(song)) return false;
  return Boolean(
    song.isSaavn ||
      song.isLiveRadio ||
      (song as any).isDirectAudioStream ||
      (song.filePath &&
        (song.filePath.includes('saavncdn.com') ||
          song.filePath.includes('googlevideo.com') ||
          song.filePath.includes('nadeko.net') ||
          song.filePath.includes('piped') ||
          song.filePath.includes('invidious') ||
          song.filePath.includes('.m4a') ||
          song.filePath.includes('listenon.in') ||
          song.filePath.includes('stream.zeno.fm') ||
          song.filePath.includes('ilovemusic.de') ||
          song.filePath.includes('dancewave.online') ||
          song.filePath.includes('bbcmedia.co.uk') ||
          song.filePath.includes('torontocast.com')))
  );
}

/**
 * Checks if a track is a locally registered or stored file.
 */
export function isLocalTrack(song: Song): boolean {
  if (getRegisteredFile(song.id)) return true;
  if (song.id?.startsWith('device_') || song.id?.startsWith('local-')) return true;
  if ((song as any).contentUri) return true;
  if (song.path?.startsWith('content://') || (song as any).filePath?.startsWith('content://')) return true;
  if (song.path?.startsWith('file://') || song.path?.startsWith('/storage/')) return true;
  const isHttp =
    (song.path && (song.path.startsWith('http://') || song.path.startsWith('https://'))) ||
    (song.filePath && (song.filePath.startsWith('http://') || song.filePath.startsWith('https://')));
  return Boolean(!song.isSaavn && !isHttp && (song.path || song.filePath));
}

/**
 * Resolves local file playback URL (Object URL or Capacitor file URI).
 */
export function resolveLocalAudioSource(
  song: Song,
  audioSourceUrl?: string
): { source: string; rawNativeSource?: string; isObjectUrl: boolean } | null {
  if (audioSourceUrl) {
    return { source: audioSourceUrl, rawNativeSource: audioSourceUrl, isObjectUrl: false };
  }
  const registeredFile = getRegisteredFile(song.id);
  if (registeredFile) {
    const objectUrl = URL.createObjectURL(registeredFile);
    return { source: objectUrl, rawNativeSource: objectUrl, isObjectUrl: true };
  }
  if (
    Capacitor.isNativePlatform() ||
    (song as any).contentUri ||
    song.path?.startsWith('content://') ||
    song.path?.startsWith('/storage/')
  ) {
    const rawPath = (song as any).contentUri || song.path || song.filePath || '';
    if (rawPath) {
      const converted = typeof Capacitor?.convertFileSrc === 'function'
        ? Capacitor.convertFileSrc(rawPath)
        : rawPath;
      return {
        source: converted,
        rawNativeSource: rawPath,
        isObjectUrl: false
      };
    }
  }
  if (song.filePath && (song.filePath.startsWith('/api/') || song.filePath.startsWith('blob:'))) {
    return { source: song.filePath, rawNativeSource: song.filePath, isObjectUrl: false };
  }
  if (song.path && !song.path.startsWith('blob:')) {
    return {
      source: buildApiUrl(`/api/audio?path=${encodeURIComponent(song.path)}`),
      rawNativeSource: song.path,
      isObjectUrl: false
    };
  }
  if (song.fileName) {
    return {
      source: buildApiUrl(`/api/audio?path=${encodeURIComponent(song.fileName)}`),
      rawNativeSource: song.fileName,
      isObjectUrl: false
    };
  }
  return null;
}

/**
 * Sanitizes a song title by stripping parenthesis tags, "[video song]", etc.
 * for higher search matching accuracy against audio stream databases.
 */
export function cleanSongTitle(title: string, artist?: string): string {
  let clean = title
    // Strip bracketed descriptors like [Official Video], [4K], (Lyric Video), etc.
    .replace(/\[\s*(official|music|video|audio|lyrics?|hd|4k|8k|remastered|visualizer).*?\]/gi, '')
    .replace(/\(\s*(official|music|video|audio|lyrics?|hd|4k|8k|remastered|visualizer|video\s+song|full\s+video|lyrical).*?\)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    // Strip trailing movie/crew credits after pipe or bullet
    .replace(/[|•].*$/gi, '')
    // Strip common YouTube unbracketed tags
    .replace(/\b(video\s+song|lyric\s+video|official\s+video|full\s+video\s+song|full\s+video|music\s+video|lyrical\s+video|audio\s+song|4k\s+video|4k|8k|uhd|full\s+hd|remastered|visualizer)\b/gi, '')
    // Strip trailing dashes with descriptors
    .replace(/\s*-\s*(video|audio|lyrics?|song|4k).*$/gi, '')
    .replace(/\b(ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (artist && artist !== 'YouTube' && !clean.toLowerCase().includes(artist.toLowerCase())) {
    clean = `${clean} ${artist}`;
  }
  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Fast-path YouTube stream resolver: directly resolves M4A stream from YouTube
 * without embedding an iframe, enabling seamless 24/7 background audio playback.
 */
export async function tryResolveFastPathYoutubeStream(
  ytVideoId: string
): Promise<{ audioUrl: string; format: string; bitrate?: number } | null> {
  try {
    const streamResult = await resolveYoutubeAudioStream(ytVideoId);
    if (streamResult && streamResult.audioUrl) {
      return streamResult;
    }
  } catch (err) {
    console.warn(`[AudioStreamResolver] Direct M4A stream resolution notice for ${ytVideoId}:`, err);
  }
  return null;
}

/**
 * Multi-tier failover and recovery engine when a stream fails to load or play.
 * Tier 1: Live radio station auto-failover to mirror backup URLs.
 * Tier 2: YouTube Mixtape protection (>10m DJ mixes stay on YouTube).
 * Tier 3: Preset Saavn 320k exact title match.
 * Tier 4: Dynamic JioSaavn live search for 320k studio master audio.
 * Tier 5: Fallback to YouTube Cloud / Online search API.
 */
export async function resolvePlaybackFailover(song: Song): Promise<FailoverResult> {
  // Tier 1: Live Radio Auto-Failover
  if (song.isLiveRadio) {
    const station = radioService.getStationByUrl(song.filePath || song.path);
    if (station && station.backupUrls && station.backupUrls.length > 0) {
      const nextUrl = station.backupUrls.find((u) => u !== song.filePath);
      if (nextUrl) {
        console.log(`⚡ Live Radio Auto-Failover: "${station.name}" switching to mirror stream:`, nextUrl);
        return { type: 'radio', url: nextUrl };
      }
    }
    return {
      type: 'failed',
      message: `Live radio stream for "${song.title}" is currently offline. Retrying shortly.`
    };
  }

  // Tier 2: YouTube Mixtape / Long Video Protection (>10 min)
  // Only long DJ mixes / podcasts are locked to YouTube to prevent matching to short pop songs
  const ytVid = extractYouTubeVideoId(song) || song.sourceId;
  const isYoutubeTrack = Boolean(
    ytVid ||
    song.id?.startsWith('online_') ||
    song.album === 'YouTube Video' ||
    song.album === 'YouTube Audio'
  );
  const isLongMix = Boolean(song.duration && song.duration > 600);

  if (isYoutubeTrack && isLongMix) {
    const cleanVid = ytVid || (song.id?.startsWith('online_') ? song.id.replace('online_', '') : null);
    if (cleanVid) {
      console.log(`[AudioStreamResolver] Long YouTube track (>10m) recovery: playing original video "${song.title}" (${cleanVid})`);
      return { type: 'cloud', videoId: cleanVid };
    }
  }

  const cleanTitle = cleanSongTitle(song.title, song.artist);
  const lower = cleanTitle.toLowerCase();

  // Tier 3: Preset Saavn 320k match
  const preset = PRESET_SAAVN_320K_HITS.find((p) => {
    const pLower = p.title.toLowerCase().trim();
    return pLower === lower || (lower.length >= 4 && pLower.includes(lower));
  });

  let fallbackUrl = preset?.filePath && preset.filePath !== song.filePath ? preset.filePath : '';
  let updatedArtwork = '';

  // Tier 4: Dynamic Authorized Catalog Matching with Hard Gates (artist, duration, version)
  const matchResult = await matchYouTubeToCatalog(
    song.title,
    song.artist !== 'YouTube' ? song.artist : undefined,
    song.duration,
    ytVid || undefined,
    song.coverArt || song.artwork
  );

  if (matchResult.status === 'MATCHED') {
    console.log('⚡ Switched to Ultra-HD 320k Studio Master audio:', song.title, '->', matchResult.streamUrl);
    const updates: Partial<Song> = {
      isSaavn: true,
      isPreview: false,
      isDirectAudioStream: true,
      isForegroundOnly: false,
      playbackMode: 'direct-catalog',
      format: '320k AAC',
      bitrate: 320,
      filePath: matchResult.streamUrl,
      path: matchResult.streamUrl
    };
    if (matchResult.song.artwork) {
      updates.coverArt = matchResult.song.artwork;
      updates.artwork = matchResult.song.artwork;
    }
    return { type: 'direct', url: matchResult.streamUrl, songUpdates: updates };
  }

  // Tier 5: JIT Fast-Path Direct Audio Stream Resolution (ExoPlayer background ready)
  if (isYoutubeTrack) {
    const cleanVid = ytVid || (song.id?.startsWith('online_') ? song.id.replace('online_', '') : null);
    if (cleanVid) {
      try {
        const streamResult = await tryResolveFastPathYoutubeStream(cleanVid);
        if (streamResult && streamResult.audioUrl) {
          console.log(`[AudioStreamResolver] JIT M4A Stream resolved for "${song.title}": ${streamResult.audioUrl}`);
          const updates: Partial<Song> = {
            isSaavn: false,
            isPreview: false,
            isDirectAudioStream: true,
            isForegroundOnly: false,
            playbackMode: 'direct-catalog',
            format: streamResult.format || 'M4A',
            bitrate: streamResult.bitrate || 160,
            filePath: streamResult.audioUrl,
            path: streamResult.audioUrl
          };
          return { type: 'direct', url: streamResult.audioUrl, songUpdates: updates };
        }
      } catch (streamErr) {
        console.warn(`[AudioStreamResolver] JIT stream error for ${cleanVid}:`, streamErr);
      }
    }
  }

  // Tier 6: Fallback to YouTube Cloud Player (Foreground-Only IFrame as last resort)
  if (isYoutubeTrack) {
    const cleanVid = ytVid || (song.id?.startsWith('online_') ? song.id.replace('online_', '') : null);
    if (cleanVid) {
      console.log(`[AudioStreamResolver] Falling back to YouTube Foreground-Only Player for "${song.title}" (${cleanVid})`);
      return { type: 'cloud', videoId: cleanVid };
    }
  }

  // Tier 6: YouTube online search fallback
  try {
    const query = cleanTitle + ' ' + (song.artist || 'Tamil');
    const ytRes = await fetch(buildApiUrl(`/api/online/search?q=${encodeURIComponent(query)}`));
    if (ytRes.ok) {
      const ytData = await ytRes.json();
      const firstYt = ytData.results?.[0];
      if (firstYt?.sourceId) {
        console.log('⚡ Switched to YouTube Cloud Player stream:', song.title, '->', firstYt.sourceId);
        return { type: 'cloud', videoId: firstYt.sourceId };
      }
    }
  } catch (ytErr) {
    console.warn('[AudioStreamResolver] YouTube fallback search error:', ytErr);
  }

  console.warn('Audio stream unavailable for:', song.title);
  return { type: 'failed', message: 'Audio stream unavailable for this track.' };
}
