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
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.jing.rocks',
  'https://invidious.drgns.space'
];

const PIPED_INSTANCES = [
  'https://api.piped.video',
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee'
];

/**
 * Universal fetch helper supporting Capacitor native HTTP (bypasses browser CORS) and web fetch.
 */
async function fetchJson<T = any>(url: string, timeoutMs: number = 6000): Promise<T | null> {
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
 * Bypasses YouTube IFrame embeds so audio plays natively in HTML5 <audio> tag 24/7 off-screen.
 */
export async function resolveYoutubeAudioStream(videoId: string): Promise<YoutubeAudioStreamResult | null> {
  const cleanId = videoId.trim();
  if (!cleanId) return null;

  // 1. Check local cache
  const cached = AUDIO_STREAM_CACHE.get(cleanId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  // 2. PRIORITY 1: Check Aura Backend Streaming Service (/api/online/stream)
  // Supported both locally via yt-dlp and in cloud via Vercel serverless
  try {
    const backendCheckUrl = buildApiUrl(`/api/online/stream?id=${encodeURIComponent(cleanId)}&json=1`);
    const backendData = await fetchJson<any>(backendCheckUrl, 7000);
    if (backendData && (backendData.streamUrl || backendData.id)) {
      const proxyAudioUrl = buildApiUrl(`/api/online/stream?id=${encodeURIComponent(cleanId)}`);
      const result: YoutubeAudioStreamResult = {
        videoId: cleanId,
        audioUrl: proxyAudioUrl,
        format: 'M4A',
        mimeType: 'audio/mp4',
        bitrate: 160,
        durationSeconds: 240,
        artwork: `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`
      };
      AUDIO_STREAM_CACHE.set(cleanId, { result, timestamp: Date.now() });
      return result;
    }
  } catch (backendErr) {
    console.warn(`[YoutubeResolver] Backend stream check failed for ${cleanId}:`, backendErr);
  }

  // 2. Try Invidious API instances
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const endpoint = `${instance}/api/v1/videos/${cleanId}`;
      const data = await fetchJson<any>(endpoint, 5000);

      if (data && Array.isArray(data.adaptiveFormats)) {
        // Filter for audio-only streams (e.g. audio/mp4, audio/webm)
        const audioFormats = data.adaptiveFormats.filter(
          (f: any) => f.type && f.type.startsWith('audio/') && f.url
        );

        if (audioFormats.length > 0) {
          // Sort by bitrate descending to pick best audio quality
          audioFormats.sort((a: any, b: any) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
          const bestAudio = audioFormats[0];

          const result: YoutubeAudioStreamResult = {
            videoId: cleanId,
            audioUrl: bestAudio.url,
            format: bestAudio.type.includes('mp4') ? 'M4A' : 'WEBM',
            mimeType: bestAudio.type,
            bitrate: Math.round((parseInt(bestAudio.bitrate) || 128000) / 1000),
            durationSeconds: parseInt(data.lengthSeconds) || 240,
            title: data.title,
            artist: data.author,
            artwork: data.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`
          };

          AUDIO_STREAM_CACHE.set(cleanId, { result, timestamp: Date.now() });
          return result;
        }
      }
    } catch (e) {
      console.warn(`[YoutubeResolver] Invidious instance ${instance} failed:`, e);
    }
  }

  // 3. Try Piped API instances fallback
  for (const instance of PIPED_INSTANCES) {
    try {
      const endpoint = `${instance}/streams/${cleanId}`;
      const data = await fetchJson<any>(endpoint, 5000);

      if (data && Array.isArray(data.audioStreams)) {
        const audioStreams = data.audioStreams.filter((s: any) => s.url);
        if (audioStreams.length > 0) {
          audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
          const bestAudio = audioStreams[0];

          const result: YoutubeAudioStreamResult = {
            videoId: cleanId,
            audioUrl: bestAudio.url,
            format: bestAudio.mimeType?.includes('mp4') ? 'M4A' : 'WEBM',
            mimeType: bestAudio.mimeType || 'audio/mp4',
            bitrate: Math.round((bestAudio.bitrate || 128000) / 1000),
            durationSeconds: data.duration || 240,
            title: data.title,
            artist: data.uploader,
            artwork: data.thumbnailUrl || `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`
          };

          AUDIO_STREAM_CACHE.set(cleanId, { result, timestamp: Date.now() });
          return result;
        }
      }
    } catch (e) {
      console.warn(`[YoutubeResolver] Piped instance ${instance} failed:`, e);
    }
  }

  return null;
}
