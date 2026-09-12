export interface LyricLine {
  time: number; // in seconds
  text: string;
}

/**
 * Parses standard LRC format strings:
 * e.g. "[00:15.30] Kannazhaga kaalazhaga"
 * Also supports multiple timestamps per line: "[00:10.00][00:25.00] Repeat chorus"
 */
export function parseLrcLyrics(lrcContent: string): LyricLine[] {
  if (!lrcContent || typeof lrcContent !== 'string') return [];

  const lines = lrcContent.split(/\r?\n/);
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check if line contains standard ID3/LRC metadata headers e.g. [ar: Anirudh], [ti: Song]
    if (/^\[(ti|ar|al|by|offset|length):.*\]$/i.test(line)) {
      continue;
    }

    const matches = Array.from(line.matchAll(timeRegex));
    if (matches.length > 0) {
      // Clean text by stripping all timestamps
      const text = line.replace(timeRegex, '').trim();
      for (const match of matches) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const fraction = match[3] ? parseFloat(`0.${match[3]}`) : 0;
        const totalSeconds = minutes * 60 + seconds + fraction;

        result.push({
          time: totalSeconds,
          text: text || '♪ ♪ ♪'
        });
      }
    }
  }

  // Sort chronologically
  result.sort((a, b) => a.time - b.time);
  return result;
}

/**
 * If raw text contains no timestamps, convert to readable plain text lines
 */
export function parsePlainTextLyrics(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Binary search to efficiently find the active lyric index based on current playback second
 */
export function findActiveLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  if (!lyrics || lyrics.length === 0) return -1;
  if (currentTime < lyrics[0].time) return -1;

  let low = 0;
  let high = lyrics.length - 1;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lyrics[mid].time <= currentTime) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

/**
 * Creates dynamic demo synced lyrics for any track if no LRC or USLT is available,
 * allowing instant verification and fun karaoke testing.
 */
export function generateDemoSyncedLyrics(title: string, artist: string, duration: number): LyricLine[] {
  const dur = duration > 0 ? duration : 180;
  const step = Math.max(4, Math.floor(dur / 10));

  return [
    { time: 0, text: `♪ Intro: ${title} ♪` },
    { time: Math.min(step * 1, dur - 15), text: `Artist: ${artist || 'Local Artist'}` },
    { time: Math.min(step * 2, dur - 14), text: 'Enjoy the rhythm and high-fidelity acoustics' },
    { time: Math.min(step * 3, dur - 12), text: 'Feel the bass and melody resonating...' },
    { time: Math.min(step * 4, dur - 10), text: '♪ ♪ [Instrumental Chorus] ♪ ♪' },
    { time: Math.min(step * 5, dur - 8), text: `Now vibing to ${title}` },
    { time: Math.min(step * 6, dur - 6), text: 'Aura Music Player - Studio EQ Active' },
    { time: Math.min(step * 7, dur - 4), text: 'Click any lyric line to jump to that timestamp!' },
    { time: Math.min(step * 8, dur - 2), text: '♪ ♪ [Outro & Fade] ♪ ♪' }
  ];
}
