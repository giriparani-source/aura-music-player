import { Song } from '../types/music';

/**
 * Normalizes a Song object, ensuring full bidirectional synchronization between
 * canonical fields and legacy alias fields. This eliminates inconsistencies between
 * `path` vs `filePath`, `artwork` vs `coverArt`, and `lastPlayedAt` vs `lastPlayed`.
 */
export function normalizeSong(raw: Partial<Song>): Song {
  const path = raw.path || raw.filePath || '';
  const filePath = raw.filePath || raw.path || '';

  const artwork = raw.artwork || raw.coverArt || undefined;
  const coverArt = raw.coverArt || raw.artwork || undefined;

  const lastPlayedAt = raw.lastPlayedAt !== undefined ? raw.lastPlayedAt : raw.lastPlayed;
  const lastPlayed = raw.lastPlayed !== undefined ? raw.lastPlayed : raw.lastPlayedAt;

  const id = raw.id || `track_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const title = raw.title || raw.fileName || 'Unknown Title';
  const artist = raw.artist || 'Unknown Artist';
  const album = raw.album || 'Unknown Album';
  const fileName = raw.fileName || `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`;
  const duration = typeof raw.duration === 'number' && !isNaN(raw.duration) ? raw.duration : 0;
  const format = raw.format || 'mp3';
  const fileSize = typeof raw.fileSize === 'number' && !isNaN(raw.fileSize) ? raw.fileSize : 0;
  const playCount = typeof raw.playCount === 'number' && !isNaN(raw.playCount) ? raw.playCount : 0;
  const isFavorite = Boolean(raw.isFavorite);
  const dateAdded = typeof raw.dateAdded === 'number' ? raw.dateAdded : Date.now();

  return {
    ...raw,
    id,
    path,
    filePath,
    fileName,
    title,
    artist,
    album,
    duration,
    format,
    fileSize,
    playCount,
    isFavorite,
    dateAdded,
    artwork,
    coverArt,
    lastPlayedAt,
    lastPlayed
  } as Song;
}

/**
 * Returns the canonical audio playback URI/path for a song.
 */
export function getSongPath(song: Pick<Song, 'path' | 'filePath'>): string {
  return song.path || song.filePath || '';
}

/**
 * Returns the canonical cover art / artwork URI for a song.
 */
export function getSongArtwork(song: Pick<Song, 'artwork' | 'coverArt'>): string | undefined {
  return song.artwork || song.coverArt || undefined;
}

/**
 * Returns the canonical last played timestamp for a song.
 */
export function getSongLastPlayed(song: Pick<Song, 'lastPlayedAt' | 'lastPlayed'>): number | undefined {
  return song.lastPlayedAt !== undefined ? song.lastPlayedAt : song.lastPlayed;
}
