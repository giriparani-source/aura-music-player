import { Song, Playlist, LibraryBackup, BackupImportResult } from '../types/music';
import { musicDB } from './db';

/**
 * Exports current library metadata, custom playlists, favorites, and play counts as JSON
 */
export async function exportLibraryBackup(): Promise<void> {
  const songs = await musicDB.getAllSongs();
  const playlists = await musicDB.getAllPlaylists();

  // Create path map for fast lookup
  const songMap = new Map<string, Song>();
  for (const song of songs) {
    songMap.set(song.id, song);
  }

  // 1. Custom playlists (exclude smart playlists)
  const customPlaylists = playlists
    .filter((p) => !p.isSmart && !p.id.startsWith('smart-'))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      songPaths: p.songIds
        .map((id) => songMap.get(id)?.path || '')
        .filter((path) => Boolean(path)),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

  // 2. Favorites
  const favorites = songs
    .filter((s) => s.isFavorite)
    .map((s) => ({
      path: s.path,
      title: s.title,
      artist: s.artist,
    }));

  // 3. Play counts & history
  const playHistory = songs
    .filter((s) => (s.playCount || 0) > 0)
    .map((s) => ({
      path: s.path,
      playCount: s.playCount,
      lastPlayedAt: s.lastPlayedAt,
    }));

  const backup: LibraryBackup = {
    version: 1,
    appName: 'Aura Music Player',
    exportedAt: new Date().toISOString(),
    playlists: customPlaylists,
    favorites,
    playHistory,
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `aura-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Imports and restores library backup from a JSON file
 */
export async function importLibraryBackup(file: File): Promise<BackupImportResult> {
  const result: BackupImportResult = {
    success: false,
    playlistsImported: 0,
    favoritesUpdated: 0,
    playCountsUpdated: 0,
    errors: [],
  };

  try {
    const text = await file.text();
    let data: Partial<LibraryBackup>;
    try {
      data = JSON.parse(text);
    } catch {
      result.errors.push('The selected file is not a valid JSON document.');
      return result;
    }

    if (!data || typeof data !== 'object') {
      result.errors.push('Invalid backup structure: file does not contain a JSON object.');
      return result;
    }

    const songs = await musicDB.getAllSongs();
    const existingPlaylists = await musicDB.getAllPlaylists();

    // Index existing songs by path and by (title + artist) for resilient matching
    const songsByPath = new Map<string, Song>();
    const songsByTitleArtist = new Map<string, Song>();

    for (const song of songs) {
      if (song.path) songsByPath.set(song.path.toLowerCase().replace(/\\/g, '/'), song);
      const key = `${song.title.toLowerCase()}::${song.artist.toLowerCase()}`;
      songsByTitleArtist.set(key, song);
    }

    const findSong = (path?: string, title?: string, artist?: string): Song | undefined => {
      if (path) {
        const norm = path.toLowerCase().replace(/\\/g, '/');
        if (songsByPath.has(norm)) return songsByPath.get(norm);
      }
      if (title && artist) {
        const key = `${title.toLowerCase()}::${artist.toLowerCase()}`;
        if (songsByTitleArtist.has(key)) return songsByTitleArtist.get(key);
      }
      return undefined;
    };

    const songsToUpdate = new Map<string, Song>();

    // 1. Restore Favorites
    if (Array.isArray(data.favorites)) {
      for (const fav of data.favorites) {
        const song = findSong(fav.path, fav.title, fav.artist);
        if (song && !song.isFavorite) {
          song.isFavorite = true;
          songsToUpdate.set(song.id, song);
          result.favoritesUpdated++;
        }
      }
    }

    // 2. Restore Play Counts
    if (Array.isArray(data.playHistory)) {
      for (const ph of data.playHistory) {
        const song = findSong(ph.path);
        if (song) {
          const currentCount = song.playCount || 0;
          if (ph.playCount > currentCount) {
            song.playCount = ph.playCount;
            if (ph.lastPlayedAt && (!song.lastPlayedAt || ph.lastPlayedAt > song.lastPlayedAt)) {
              song.lastPlayedAt = ph.lastPlayedAt;
              song.lastPlayed = ph.lastPlayedAt;
            }
            songsToUpdate.set(song.id, song);
            result.playCountsUpdated++;
          }
        }
      }
    }

    // Save updated songs in bulk
    if (songsToUpdate.size > 0) {
      await musicDB.saveSongsBatch(Array.from(songsToUpdate.values()));
    }

    // 3. Restore Playlists
    if (Array.isArray(data.playlists)) {
      for (const pl of data.playlists) {
        if (!pl.name) continue;

        // Map paths to current song IDs
        const resolvedSongIds: string[] = [];
        if (Array.isArray(pl.songPaths)) {
          for (const p of pl.songPaths) {
            const song = findSong(p);
            if (song && !resolvedSongIds.includes(song.id)) {
              resolvedSongIds.push(song.id);
            }
          }
        }

        // Check if playlist with same name or id already exists
        const existingPl = existingPlaylists.find((p) => p.id === pl.id || p.name.toLowerCase() === pl.name.toLowerCase());

        if (existingPl) {
          // Merge unique songs
          const mergedIds = Array.from(new Set([...existingPl.songIds, ...resolvedSongIds]));
          const updatedPl: Playlist = {
            ...existingPl,
            songIds: mergedIds,
            updatedAt: Date.now(),
          };
          await musicDB.savePlaylist(updatedPl);
        } else {
          // Create new playlist
          const newPl: Playlist = {
            id: pl.id || `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: pl.name,
            description: pl.description || '',
            isSmart: false,
            songIds: resolvedSongIds,
            createdAt: pl.createdAt || Date.now(),
            updatedAt: pl.updatedAt || Date.now(),
          };
          await musicDB.savePlaylist(newPl);
        }
        result.playlistsImported++;
      }
    }

    result.success = true;
    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown error occurred during import.');
    return result;
  }
}
