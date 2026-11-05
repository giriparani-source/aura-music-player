import { Song } from '../types/music';

/**
 * Normalizes a Song object, ensuring full bidirectional synchronization between
 * canonical fields and legacy alias fields. This eliminates inconsistencies between
 * `path` vs `filePath`, `artwork` vs `coverArt`, and `lastPlayedAt` vs `lastPlayed`.
 */
export function normalizeSong(raw: Partial<Song>): Song {
  const path = raw.path || raw.filePath || '';
  const filePath = raw.filePath || raw.path || '';
  const contentUri = raw.contentUri || (path.startsWith('content://') ? path : undefined);

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
    contentUri,
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

/**
 * Determines whether a song is stored on the local device:
 * 1. Physical Android MediaStore content URI (`content://`)
 * 2. Local device storage file (`file://` or `/storage/` or absolute/relative device path)
 * 3. Offline downloaded track (`isDownloaded === true`)
 * 4. Local non-online track whose path is not a remote HTTP/HTTPS stream
 */
export function isLocalDeviceSong(song: Partial<Song>): boolean {
  if (!song) return false;
  if (song.isDownloaded) return true;

  const path = song.path || song.filePath || '';
  const uri = song.contentUri || '';

  if (uri.startsWith('content://') || path.startsWith('content://')) return true;
  if (path.startsWith('file://') || path.startsWith('/storage/') || path.startsWith('/data/')) return true;

  // If path is a remote network stream, it is NOT local unless downloaded
  if (path.startsWith('http://') || path.startsWith('https://')) return false;

  // Android device scan IDs
  if (song.id?.startsWith('device_')) return true;

  // Local filesystem or relative audio path from folder picker
  if (song.isOnline === false && path.length > 0) return true;

  return false;
}

/**
 * Checks if a song is an inbuilt streaming preset (e.g. from TOP_50, MUDHAL, VIBE, etc.)
 */
export function isStreamingPreset(song: Partial<Song>): boolean {
  if (!song || !song.id) return false;
  const id = song.id;
  const path = song.path || song.filePath || '';
  const isRemote = path.startsWith('http://') || path.startsWith('https://');
  if (!isRemote && !song.isOnline) return false;

  return (
    id.startsWith('cloud_track_') ||
    id.startsWith('t50_') ||
    id.startsWith('mudhal_') ||
    id.startsWith('vibe_') ||
    id.startsWith('night_') ||
    id.startsWith('workout_') ||
    id.startsWith('dev_') ||
    id.startsWith('drive_') ||
    id.startsWith('saavn_') ||
    Boolean(song.isSaavn)
  );
}
