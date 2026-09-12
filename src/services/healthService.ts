import { Song, LibraryHealth, LibraryStats } from '../types/music';
import { detectDuplicates } from './duplicateService';

/**
 * Calculates real, dynamic Library Health metrics directly from the library dataset
 */
export function calculateLibraryHealth(songs: Song[]): LibraryHealth {
  const totalSongs = songs.length;
  let totalStorageBytes = 0;
  const formats: Record<string, number> = {};
  let missingArtworkCount = 0;
  let missingArtistCount = 0;
  let missingAlbumCount = 0;
  let missingDurationCount = 0;

  for (const s of songs) {
    totalStorageBytes += s.fileSize || 0;

    // Track formats
    const fmt = (s.format || 'unknown').toLowerCase();
    formats[fmt] = (formats[fmt] || 0) + 1;

    // Check artwork
    if (!s.artwork && !s.coverArt) {
      missingArtworkCount++;
    }

    // Check artist
    if (!s.artist || s.artist === 'Not set' || s.artist === 'Unknown Artist') {
      missingArtistCount++;
    }

    // Check album
    if (!s.album || s.album === 'Not set' || s.album === 'Unknown Album') {
      missingAlbumCount++;
    }

    // Check duration
    if (!s.duration || s.duration <= 0) {
      missingDurationCount++;
    }
  }

  // Detect real duplicate candidates
  const duplicates = detectDuplicates(songs);
  const possibleDuplicatesCount = duplicates.reduce((acc, g) => acc + (g.songs.length - 1), 0);

  // Calculate health score (0 - 100%)
  // Base 100%, penalties for missing metadata, artwork, and duplicates
  let healthScore = 100;
  if (totalSongs > 0) {
    const missingArtistRate = missingArtistCount / totalSongs;
    const missingAlbumRate = missingAlbumCount / totalSongs;
    const missingArtRate = missingArtworkCount / totalSongs;
    const dupeRate = possibleDuplicatesCount / totalSongs;

    healthScore -= Math.round(missingArtistRate * 20);
    healthScore -= Math.round(missingAlbumRate * 15);
    healthScore -= Math.round(missingArtRate * 10);
    healthScore -= Math.round(dupeRate * 25);
  }
  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    totalSongs,
    totalStorageBytes,
    formats,
    missingFilesCount: 0,
    possibleDuplicatesCount,
    missingArtworkCount,
    missingArtistCount,
    missingAlbumCount,
    missingDurationCount,
    healthScore
  };
}

/**
 * Converts LibraryHealth to legacy LibraryStats for backward compatibility with UI components
 */
export function healthToLegacyStats(health: LibraryHealth, totalArtists: number, totalAlbums: number, totalPlaylists: number): LibraryStats {
  return {
    totalSongs: health.totalSongs,
    totalStorageBytes: health.totalStorageBytes,
    totalArtists,
    totalAlbums,
    totalPlaylists,
    songsMissingArtwork: health.missingArtworkCount,
    songsMissingMetadata: health.missingArtistCount + health.missingAlbumCount,
    possibleDuplicates: health.possibleDuplicatesCount
  };
}
