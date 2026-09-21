import { Song } from '../types/music';
import { getRegisteredFile } from './scannerService';
import { resolveYoutubeAudioStream } from './youtubeAudioResolver';
import { searchJioSaavn, PRESET_SAAVN_320K_HITS } from './jiosaavnService';
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
  const registeredFile = getRegisteredFile(song.id);
  return Boolean(
    registeredFile ||
      (!song.isOnline &&
        !song.isSaavn &&
        song.path &&
        !song.path.startsWith('http://') &&
        !song.path.startsWith('https://'))
  );
}

/**
 * Resolves local file playback URL (Object URL or Capacitor file URI).
 */
export function resolveLocalAudioSource(
  song: Song,
  audioSourceUrl?: string
): { source: string; isObjectUrl: boolean } | null {
  if (audioSourceUrl) {
    return { source: audioSourceUrl, isObjectUrl: false };
  }
  const registeredFile = getRegisteredFile(song.id);
  if (registeredFile) {
    const objectUrl = URL.createObjectURL(registeredFile);
    return { source: objectUrl, isObjectUrl: true };
  }
  if (
    Capacitor.isNativePlatform() ||
    (song as any).contentUri ||
    song.path?.startsWith('content://') ||
    song.path?.startsWith('/storage/')
  ) {
    const rawPath = (song as any).contentUri || song.path || song.filePath || '';
    if (rawPath) {
      return { source: Capacitor.convertFileSrc(rawPath), isObjectUrl: false };
    }
  }
  if (song.filePath && (song.filePath.startsWith('/api/') || song.filePath.startsWith('blob:'))) {
    return { source: song.filePath, isObjectUrl: false };
  }
  if (song.path && !song.path.startsWith('blob:')) {
    return { source: buildApiUrl(`/api/audio?path=${encodeURIComponent(song.path)}`), isObjectUrl: false };
  }
  if (song.fileName) {
    return { source: buildApiUrl(`/api/audio?path=${encodeURIComponent(song.fileName)}`), isObjectUrl: false };
  }
  return null;
}

/**
 * Sanitizes a song title by stripping parenthesis tags, "[video song]", etc.
 * for higher search matching accuracy against audio stream databases.
 */
export function cleanSongTitle(title: string): string {
  return title
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/video song/gi, '')
    .replace(/lyric video/gi, '')
    .replace(/audio/gi, '')
    .trim();
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
 * Tier 2: YouTube track recovery (ensures long DJ mixes aren't matched against 3-min pop songs).
 * Tier 3: Preset Saavn 320k exact title match.
 * Tier 4: Dynamic JioSaavn live search for 320k studio master audio.
 * Tier 5: Fallback to YouTube Online search API.
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

  // Tier 2: YouTube Mixtape / Online video protection:
  // Never match a 1-hour YouTube DJ mix to a 3-minute movie track on JioSaavn.
  const ytVid = extractYouTubeVideoId(song) || song.sourceId;
  if (
    ytVid ||
    song.id?.startsWith('online_') ||
    song.album === 'YouTube Video' ||
    song.album === 'YouTube Audio'
  ) {
    const cleanVid = ytVid || (song.id?.startsWith('online_') ? song.id.replace('online_', '') : null);
    if (cleanVid) {
      console.log(`[AudioStreamResolver] YouTube track recovery: playing original video "${song.title}" (${cleanVid})`);
      return { type: 'cloud', videoId: cleanVid };
    }
  }

  const cleanTitle = cleanSongTitle(song.title);
  const lower = cleanTitle.toLowerCase();

  // Tier 3: Preset Saavn 320k match
  const preset = PRESET_SAAVN_320K_HITS.find((p) => {
    const pLower = p.title.toLowerCase().trim();
    return pLower === lower || (lower.length >= 4 && pLower.includes(lower));
  });

  let fallbackUrl = preset?.filePath && preset.filePath !== song.filePath ? preset.filePath : '';
  let updatedArtwork = '';

  // Tier 4: Dynamic JioSaavn search
  if (!fallbackUrl) {
    try {
      const results = await searchJioSaavn(cleanTitle);
      const validFullSaavn = results?.find(
        (r) => r.filePath && r.filePath !== song.filePath && !r.isPreview && !r.id.startsWith('itunes_')
      );
      if (validFullSaavn && validFullSaavn.filePath) {
        fallbackUrl = validFullSaavn.filePath;
        if (validFullSaavn.artwork && !song.coverArt) {
          updatedArtwork = validFullSaavn.artwork;
        }
      }
    } catch (saavnErr) {
      console.warn('[AudioStreamResolver] JioSaavn fallback search error:', saavnErr);
    }
  }

  if (fallbackUrl) {
    console.log('⚡ Switched to Ultra-HD 320k Studio Master audio:', song.title, '->', fallbackUrl);
    const updates: Partial<Song> = {
      isSaavn: true,
      isPreview: false,
      format: '320k AAC',
      bitrate: 320,
      filePath: fallbackUrl,
      path: fallbackUrl
    };
    if (updatedArtwork) {
      updates.coverArt = updatedArtwork;
      updates.artwork = updatedArtwork;
    }
    return { type: 'direct', url: fallbackUrl, songUpdates: updates };
  }

  // Tier 5: YouTube online search fallback
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
