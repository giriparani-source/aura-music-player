import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { buildApiUrl } from '../utils/apiConfig';

export interface YoutubeAudioStreamResult {
  videoId: string;
  audioUrl: string;
  format: string;
  mimeType: string;
  bitrate: number;
  durationSeconds: number;
  title?: string;
  artist?: string;
  artwork?: string;
}

const AUDIO_STREAM_CACHE = new Map<string, { result: YoutubeAudioStreamResult; timestamp: number }>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 Hours

const INVIDIOUS_INSTANCES = [
  'https://inv.bp.projectsegfau.lt',
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://invidious.jing.rocks'
];

const PIPED_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://piped.video',
  'https://pipedapi.kavin.rocks',
  'https://piped-api.lunar.icu'
];

/**
 * Universal fetch helper supporting Capacitor native HTTP (bypasses browser CORS) and web fetch.
 */
async function fetchJson<T = any>(url: string, timeoutMs: number = 2500): Promise<T | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({
        url,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs
      });
      if (res.status >= 200 && res.status < 300) {
        return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      }
    } catch (e) {
      console.warn(`[YoutubeResolver] Native fetch error for ${url}:`, e);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn(`[YoutubeResolver] Web fetch error for ${url}:`, e);
  } finally {
    clearTimeout(timer);
  }
  return null;
}

/**
 * Resolves a YouTube video ID to a direct M4A/WebM audio stream URL.
 * Bypasses YouTube IFrame embeds so audio plays natively in ExoPlayer / HTML5 24/7 off-screen.
 */
export async function resolveYoutubeAudioStream(videoId: string): Promise<YoutubeAudioStreamResult | null> {
  const cleanId = videoId.trim();
  if (!cleanId) return null;

  // 1. Check local cache
  const cached = AUDIO_STREAM_CACHE.get(cleanId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  // 2. Resolver Candidates: Check backend proxy and public mirrors in parallel
  const fetchBackend = async (): Promise<YoutubeAudioStreamResult | null> => {
    try {
      const backendCheckUrl = buildApiUrl(`/api/online/stream?id=${encodeURIComponent(cleanId)}&json=1`);
      const backendData = await fetchJson<any>(backendCheckUrl, 4000);
      if (backendData && (backendData.streamUrl || backendData.id)) {
        const proxyAudioUrl = buildApiUrl(`/api/online/stream?id=${encodeURIComponent(cleanId)}`);
        return {
          videoId: cleanId,
          audioUrl: proxyAudioUrl,
          format: 'M4A',
          mimeType: 'audio/mp4',
          bitrate: 160,
          durationSeconds: 240,
          artwork: `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`
        };
      }
    } catch (_) {}
    return null;
  };

  const fetchInvidiousInstance = async (instance: string): Promise<YoutubeAudioStreamResult | null> => {
    try {
      const endpoint = `${instance}/api/v1/videos/${cleanId}`;
      const data = await fetchJson<any>(endpoint, 3500);
      if (data && Array.isArray(data.adaptiveFormats)) {
        const audioFormats = data.adaptiveFormats.filter(
          (f: any) => f.type && f.type.startsWith('audio/') && f.url
        );
        if (audioFormats.length > 0) {
          audioFormats.sort((a: any, b: any) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
          const bestAudio = audioFormats[0];
          return {
            videoId: cleanId,
            audioUrl: bestAudio.url,
            format: bestAudio.type.includes('mp4') ? 'M4A' : 'WEBM',
            mimeType: bestAudio.type,
            bitrate: Math.round((parseInt(bestAudio.bitrate) || 128000) / 1000),
            durationSeconds: parseInt(data.lengthSeconds) || 240,
            title: data.title,
            artist: data.author,
            artwork: `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`
          };
        }
      }
    } catch (_) {}
    return null;
  };

  const fetchPipedInstance = async (instance: string): Promise<YoutubeAudioStreamResult | null> => {
    try {
      const endpoint = `${instance}/streams/${cleanId}`;
      const data = await fetchJson<any>(endpoint, 3500);
      if (data && Array.isArray(data.audioStreams)) {
        const audioStreams = data.audioStreams.filter((s: any) => s.url);
        if (audioStreams.length > 0) {
          audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
          const bestAudio = audioStreams[0];
          return {
            videoId: cleanId,
            audioUrl: bestAudio.url,
            format: bestAudio.mimeType?.includes('mp4') ? 'M4A' : 'WEBM',
            mimeType: bestAudio.mimeType || 'audio/mp4',
            bitrate: Math.round((bestAudio.bitrate || 128000) / 1000),
            durationSeconds: data.duration || 240,
            title: data.title,
            artist: data.uploader,
            artwork: `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`
          };
        }
      }
    } catch (_) {}
    return null;
  };

  // Launch fast priority race: backend + top Invidious + top Piped
  const priorityResolvers = [
    fetchBackend(),
    fetchInvidiousInstance('https://inv.nadeko.net'),
    fetchInvidiousInstance('https://invidious.nerdvpn.de'),
    fetchPipedInstance('https://api.piped.private.coffee'),
    fetchPipedInstance('https://pipedapi.kavin.rocks')
  ];

  try {
    const results = await Promise.allSettled(priorityResolvers);
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value && res.value.audioUrl) {
        AUDIO_STREAM_CACHE.set(cleanId, { result: res.value, timestamp: Date.now() });
        return res.value;
      }
    }
  } catch (_) {}

  // Secondary fallback if priority race didn't resolve
  const secondaryInstances = ['https://yewtu.be', 'https://invidious.jing.rocks', 'https://piped-api.lunar.icu'];
  for (const inst of secondaryInstances) {
    const fallbackRes = inst.includes('piped') ? await fetchPipedInstance(inst) : await fetchInvidiousInstance(inst);
    if (fallbackRes && fallbackRes.audioUrl) {
      AUDIO_STREAM_CACHE.set(cleanId, { result: fallbackRes, timestamp: Date.now() });
      return fallbackRes;
    }
  }

  return null;
}
