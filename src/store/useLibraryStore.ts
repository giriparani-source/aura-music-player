import { create } from 'zustand';
import {
  Song,
  Album,
  Artist,
  Playlist,
  PlaylistEntry,
  LibraryStats,
  LibraryHealth,
  DuplicateGroup,
  NavigationTab,
  LibrarySubTab,
  SortOption,
  ViewMode,
  ScanProgress,
  ScanResult,
  DownloadState
} from '../types/music';
import { musicDB } from '../services/db';
import { calculateLibraryHealth, healthToLegacyStats } from '../services/healthService';
import { detectDuplicates } from '../services/duplicateService';
import { buildApiUrl } from '../utils/apiConfig';
import {
  collectFilesFromDirectoryHandle,
  collectFilesFromFileList,
  runDifferentialScan
} from '../services/scannerService';
import { downloadService } from '../services/downloadService';
import { audioService } from '../services/audioService';
import { auraAffinityService } from '../services/auraAffinityService';
import { auraSkipService } from '../services/auraSkipService';
import { extractIndividualArtists } from '../utils/artistImageHelper';
import { isLocalDeviceSong, isStreamingPreset } from '../utils/songUtils';

interface LibraryStoreState {
  songs: Song[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  stats: LibraryStats;
  health: LibraryHealth;
  duplicates: DuplicateGroup[];
  activeTab: NavigationTab;
  librarySubTab: LibrarySubTab;
  searchQuery: string;
  sortOption: SortOption;
  sortAscending: boolean;
  viewMode: ViewMode;
  isLoading: boolean;
  scanProgress: ScanProgress;
  activePlaylistId: string | null;

  // Filter criteria
  folderFilter: string | null;
  formatFilter: string | null;
  highBitrateOnly: boolean;
  favoritesOnly: boolean;

  // Offline Download State
  downloadedSongIds: Set<string>;
  favoriteSongIds: Set<string>;
  downloadingStates: Record<string, { progress: number; status: DownloadState }>;
  offlineStorage: { songCount: number; totalBytes: number };
  isOnline: boolean;

  // Actions
  loadLibrary: () => Promise<void>;
  setActiveTab: (tab: NavigationTab) => void;
  setLibrarySubTab: (subTab: LibrarySubTab) => void;
  setSearchQuery: (query: string) => void;
  setSortOption: (option: SortOption) => void;
  toggleSortDirection: () => void;
  setViewMode: (mode: ViewMode) => void;
  setActivePlaylistId: (id: string | null) => void;
  setFolderFilter: (folder: string | null) => void;
  setFormatFilter: (format: string | null) => void;
  setHighBitrateOnly: (val: boolean) => void;
  setFavoritesOnly: (val: boolean) => void;
  clearFilters: () => void;

  toggleFavorite: (songId: string, fallbackSong?: Song) => Promise<void>;
  batchToggleFavorite: (songIds: string[], targetFavorite: boolean) => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  createPlaylistWithSongs: (name: string, description?: string, songs?: Song[], coverArt?: string, entries?: PlaylistEntry[]) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  batchAddToPlaylist: (playlistId: string, songIds: string[]) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string, entryId?: string) => Promise<void>;
  removeEntryFromPlaylist: (playlistId: string, entryId: string) => Promise<void>;
  registerOnlineSong: (song: Song) => Promise<void>;
  downloadTrack: (song: Song) => Promise<boolean>;
  deleteDownloadedTrack: (songId: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  refreshDownloads: () => Promise<void>;
  scanFromDirectoryHandle: (dirHandle: FileSystemDirectoryHandle) => Promise<ScanResult>;
  scanFromFileList: (files: FileList) => Promise<ScanResult>;
  clearLibrary: () => Promise<void>;
  syncCloudCatalog: () => Promise<number>;
}

type FavoriteListener = (songId: string, isFavorite: boolean) => void;
const favoriteListeners = new Set<FavoriteListener>();

export const onFavoriteChanged = (listener: FavoriteListener) => {
  favoriteListeners.add(listener);
  return () => favoriteListeners.delete(listener);
};

let songLookupFallback: ((id: string) => Song | undefined) | null = null;
export const registerSongLookup = (fn: (id: string) => Song | undefined) => {
  songLookupFallback = fn;
};

// In-memory registry for online streaming tracks (kept separate from local IndexedDB)
export const onlineSongRegistry = new Map<string, Song>();
export const getOnlineSong = (id: string): Song | undefined => onlineSongRegistry.get(id);

export const useLibraryStore = create<LibraryStoreState>((set, get) => ({
  songs: [],
  albums: [],
  artists: [],
  playlists: [],
  stats: {
    totalSongs: 0,
    totalStorageBytes: 0,
    totalArtists: 0,
    totalAlbums: 0,
    totalPlaylists: 0,
    songsMissingArtwork: 0,
    songsMissingMetadata: 0,
    possibleDuplicates: 0
  },
  health: {
    totalSongs: 0,
    totalStorageBytes: 0,
    formats: {},
    missingFilesCount: 0,
    possibleDuplicatesCount: 0,
    missingArtworkCount: 0,
    missingArtistCount: 0,
    missingAlbumCount: 0,
    missingDurationCount: 0,
    healthScore: 100
  },
  duplicates: [],
  activeTab: 'home',
  librarySubTab: 'songs',
  searchQuery: '',
  sortOption: 'recent',
  sortAscending: false,
  viewMode: 'list',
  isLoading: true,
  scanProgress: {
    status: 'idle',
    currentFile: '',
    processedCount: 0,
    totalCount: 0
  },
  activePlaylistId: null,

  folderFilter: null,
  formatFilter: null,
  highBitrateOnly: false,
  favoritesOnly: false,

  downloadedSongIds: new Set(),
  favoriteSongIds: new Set(),
  downloadingStates: {},
  offlineStorage: { songCount: 0, totalBytes: 0 },
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  loadLibrary: async () => {
    set({ isLoading: true });
    try {
      let songs = await musicDB.getAllSongs();

      let playlists = await musicDB.getAllPlaylists();

      // Safe, Reversible Migration Strategy:
      // Clean up stale un-downloaded, un-favorited, zero-play, non-playlist streaming presets
      // that were mistakenly auto-saved into local IndexedDB in older versions, while strictly preserving:
      // 1. Any track marked as favorite
      // 2. Any track with play count > 0 or lastPlayed timestamps
      // 3. Any track referenced in any user playlist
      // 4. Any track downloaded or stored on the local device
      const playlistSongIdSet = new Set<string>();
      playlists.forEach((pl) => pl.songIds?.forEach((id) => playlistSongIdSet.add(id)));

      const staleStreamingPresets = songs.filter((s) => {
        if (s.isDownloaded) return false;
        if (s.isFavorite) return false;
        if ((s.playCount || 0) > 0 || s.lastPlayedAt || s.lastPlayed) return false;
        if (playlistSongIdSet.has(s.id)) return false;
        if (isLocalDeviceSong(s)) return false;
        return isStreamingPreset(s) || (s.path && (s.path.startsWith('http://') || s.path.startsWith('https://')));
      });

      if (staleStreamingPresets.length > 0) {
        try {
          await musicDB.saveSetting('migration_backup_unseeded_presets', {
            timestamp: Date.now(),
            backedUpSongs: staleStreamingPresets
          });
          await musicDB.deleteSongsBatch(staleStreamingPresets.map((s) => s.id));
          songs = await musicDB.getAllSongs();
        } catch (migErr) {
          console.warn('Migration cleanup error:', migErr);
        }
      }

      // Ensure Core Smart Playlists exist
      const defaultPlaylists: Array<{ id: string; name: string; description: string }> = [
        { id: 'smart-favorites', name: '❤️ Favourites', description: 'Your most loved songs' },
        { id: 'smart-recent', name: '🕘 Recently Played', description: 'Tracks you listened to recently' },
        { id: 'smart-most-played', name: '🔥 Most Played', description: 'Your all-time top bangers' },
        { id: 'smart-recent-added', name: '🆕 Recently Added', description: 'Latest additions to your library' },
      ];

      for (const dp of defaultPlaylists) {
        if (!playlists.find((p) => p.id === dp.id)) {
          const smartP: Playlist = {
            id: dp.id,
            name: dp.name,
            description: dp.description,
            isSmart: true,
            songIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await musicDB.savePlaylist(smartP);
          playlists.push(smartP);
        }
      }

      // Group Albums & Artists
      const albumMap = new Map<string, Album>();
      const artistMap = new Map<string, { songCount: number; albumSet: Set<string>; coverArt?: string }>();

      for (const s of songs) {
        const rawArtist = s.artist && s.artist !== 'Not set' ? s.artist : 'Streaming Artist';
        const albumName = s.album && s.album !== 'Not set' ? s.album : 'Streaming Collection';
        const primaryArtist = rawArtist.includes('•') ? rawArtist.split('•')[0].trim() : rawArtist;

        const albumKey = `${albumName} - ${primaryArtist}`;
        if (!albumMap.has(albumKey)) {
          albumMap.set(albumKey, {
            id: albumKey,
            title: albumName,
            artist: primaryArtist,
            year: s.year,
            songCount: 1,
            coverArt: s.artwork || s.coverArt,
            songs: [s]
          });
        } else {
          const alb = albumMap.get(albumKey)!;
          alb.songCount++;
          alb.songs.push(s);
          if (!alb.coverArt && (s.artwork || s.coverArt)) {
            alb.coverArt = s.artwork || s.coverArt;
          }
        }

        // Spotify-style Individual Artist extraction (1-to-1 exact portraits)
        const individuals = extractIndividualArtists(rawArtist);
        for (const ind of individuals) {
          const artName = ind.name;
          if (!artistMap.has(artName)) {
            artistMap.set(artName, {
              songCount: 1,
              albumSet: new Set([albumName]),
              coverArt: ind.image || s.artwork || s.coverArt
            });
          } else {
            const existing = artistMap.get(artName)!;
            existing.songCount++;
            existing.albumSet.add(albumName);
            if (!existing.coverArt && (ind.image || s.artwork || s.coverArt)) {
              existing.coverArt = ind.image || s.artwork || s.coverArt;
            }
          }
        }
      }

      const albums = Array.from(albumMap.values());
      const artists: Artist[] = Array.from(artistMap.entries())
        .map(([name, data]) => ({
          id: name,
          name,
          songCount: data.songCount,
          albumCount: data.albumSet.size,
          coverArt: data.coverArt
        }))
        .sort((a, b) => b.songCount - a.songCount);

      // Calculate duplicates once and pass to health to prevent double computation
      const duplicates = detectDuplicates(songs);
      const health = calculateLibraryHealth(songs, duplicates);
      const stats = healthToLegacyStats(health, artists.length, albums.length, playlists.length);

      // Fast O(1) Favorite Song IDs Set
      const favoriteSet = new Set<string>();
      for (const s of songs) {
        if (s.isFavorite) favoriteSet.add(s.id);
      }

      // Refresh downloads
      let downloadedSet = new Set<string>();
      let offlineStorage = { songCount: 0, totalBytes: 0 };
      try {
        const downloaded = await downloadService.getDownloadedTracks();
        downloadedSet = new Set(downloaded.map((s) => s.id));
        offlineStorage = await downloadService.getOfflineStorageUsage();
      } catch (dlErr) {
        console.warn('Could not load offline downloads:', dlErr);
      }

      set({
        songs,
        albums,
        artists,
        playlists,
        stats,
        health,
        duplicates,
        downloadedSongIds: downloadedSet,
        favoriteSongIds: favoriteSet,
        offlineStorage,
        isLoading: false
      });

      // Non-blocking background hydration of Aura Flow User Affinity Profile (Phase 5.1)
      auraAffinityService.initProfile(songs).catch((affErr) => {
        console.warn('Non-blocking affinity profile hydration failed:', affErr);
      });

      // Non-blocking background hydration of Persistent Skip Learning (Phase 5.3)
      auraSkipService.init().catch((skipErr) => {
        console.warn('Non-blocking skip profile hydration failed:', skipErr);
      });
    } catch (err) {
      console.error('Failed to load library:', err);
      set({ isLoading: false });
    }
  },

  setActiveTab: (tab: NavigationTab) => set({ activeTab: tab, activePlaylistId: null }),
  setLibrarySubTab: (subTab: LibrarySubTab) => set({ librarySubTab: subTab }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSortOption: (option: SortOption) => set({ sortOption: option }),
  toggleSortDirection: () => set((state) => ({ sortAscending: !state.sortAscending })),
  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  setActivePlaylistId: (id: string | null) => set({ activePlaylistId: id }),

  setFolderFilter: (folder: string | null) => set({ folderFilter: folder }),
  setFormatFilter: (format: string | null) => set({ formatFilter: format }),
  setHighBitrateOnly: (val: boolean) => set({ highBitrateOnly: val }),
  setFavoritesOnly: (val: boolean) => set({ favoritesOnly: val }),
  clearFilters: () =>
    set({
      folderFilter: null,
      formatFilter: null,
      highBitrateOnly: false,
      favoritesOnly: false,
      searchQuery: ''
    }),

  toggleFavorite: async (songId: string, fallbackSong?: Song) => {
    const { songs } = get();
    let song = songs.find((s) => s.id === songId);
    if (!song) {
      song = await musicDB.getSongById(songId);
    }
    if (!song && fallbackSong && fallbackSong.id === songId) {
      song = fallbackSong;
    }
    if (!song && songLookupFallback) {
      song = songLookupFallback(songId);
    }
    if (!song) {
      song = onlineSongRegistry.get(songId);
    }
    if (song) {
      const newFav = !song.isFavorite;
      const existsInDb = await musicDB.getSongById(songId);
      if (existsInDb) {
        await musicDB.updateSongFavorite(songId, newFav);
      } else {
        await musicDB.saveSong({ ...song, isFavorite: newFav });
      }

      const { favoriteSongIds } = get();
      const nextFavSet = new Set(favoriteSongIds);
      if (newFav) {
        nextFavSet.add(songId);
      } else {
        nextFavSet.delete(songId);
      }

      if (songs.some((s) => s.id === songId)) {
        set({
          songs: songs.map((s) => (s.id === songId ? { ...s, isFavorite: newFav } : s)),
          favoriteSongIds: nextFavSet
        });
      } else {
        set({
          songs: [{ ...song, isFavorite: newFav }, ...songs],
          favoriteSongIds: nextFavSet
        });
      }

      favoriteListeners.forEach((fn) => {
        try {
          fn(songId, newFav);
        } catch (e) {
          console.warn('Favorite listener error:', e);
        }
      });
    }
  },

  batchToggleFavorite: async (songIds: string[], targetFavorite: boolean) => {
    const { songs } = get();
    const idSet = new Set(songIds);
    const updatedSongs: Song[] = [];

    for (const s of songs) {
      if (idSet.has(s.id) && s.isFavorite !== targetFavorite) {
        const updated = { ...s, isFavorite: targetFavorite };
        updatedSongs.push(updated);
      }
    }

    if (updatedSongs.length > 0) {
      await musicDB.saveSongsBatch(updatedSongs);
      const { favoriteSongIds } = get();
      const nextFavSet = new Set(favoriteSongIds);
      for (const s of updatedSongs) {
        if (targetFavorite) nextFavSet.add(s.id);
        else nextFavSet.delete(s.id);
      }
      set({
        songs: songs.map((s) => (idSet.has(s.id) ? { ...s, isFavorite: targetFavorite } : s)),
        favoriteSongIds: nextFavSet
      });

      // BUG-10 fix: Notify favorite listeners so usePlayerStore updates currentSong & queue!
      updatedSongs.forEach((s) => {
        favoriteListeners.forEach((fn) => {
          try {
            fn(s.id, targetFavorite);
          } catch (e) {
            console.warn('Favorite listener error in batch:', e);
          }
        });
      });
    }
  },

  createPlaylist: async (name: string, description?: string) => {
    const newPlaylist: Playlist = {
      id: 'pl-' + Date.now(),
      name,
      description,
      isSmart: false,
      songIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await musicDB.savePlaylist(newPlaylist);
    set((state) => ({ playlists: [...state.playlists, newPlaylist] }));
    return newPlaylist;
  },

  createPlaylistWithSongs: async (
    name: string,
    description?: string,
    songs: Song[] = [],
    coverArt?: string,
    entries?: PlaylistEntry[]
  ) => {
    // 1. Save all songs into IndexedDB batch if any
    if (songs.length > 0) {
      await musicDB.saveSongsBatch(songs);
    }

    const songIds = entries && entries.length > 0
      ? entries.filter((e) => e.songId).map((e) => e.songId!)
      : songs.map((s) => s.id);
    const resolvedCover = coverArt || (songs.length > 0 ? (songs[0].artwork || songs[0].coverArt) : undefined);

    const newPlaylist: Playlist = {
      id: 'pl-' + Date.now(),
      name,
      description,
      isSmart: false,
      coverArt: resolvedCover,
      songIds,
      entries: entries && entries.length > 0 ? entries : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 2. Persist playlist into IndexedDB
    await musicDB.savePlaylist(newPlaylist);

    // 3. Update store state (merge songs into library so player can look them up immediately)
    const currentSongs = get().songs;
    const existingSongIdSet = new Set(currentSongs.map((s) => s.id));
    const songsToAdd = songs.filter((s) => !existingSongIdSet.has(s.id));

    set((state) => ({
      playlists: [...state.playlists, newPlaylist],
      songs: songsToAdd.length > 0 ? [...state.songs, ...songsToAdd] : state.songs
    }));

    return newPlaylist;
  },

  deletePlaylist: async (id: string) => {
    await musicDB.deletePlaylist(id);
    set((state) => ({
      playlists: state.playlists.filter((p) => p.id !== id),
      activePlaylistId: state.activePlaylistId === id ? null : state.activePlaylistId
    }));
  },

  addSongToPlaylist: async (playlistId: string, songId: string) => {
    const { playlists, songs } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl) {
      let newEntries = pl.entries;
      if (newEntries && newEntries.length > 0) {
        const songObj = songs.find((s) => s.id === songId);
        const newEntry: PlaylistEntry = {
          entryId: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          position: newEntries.length,
          status: 'available',
          songId: songId,
          title: songObj?.title || 'Unknown Title',
          artist: songObj?.artist || 'Unknown Artist',
          duration: songObj?.duration,
          coverArt: songObj?.coverArt || songObj?.artwork,
          addedAt: Date.now()
        };
        newEntries = [...newEntries, newEntry];
      }
      const updated: Playlist = {
        ...pl,
        songIds: pl.songIds.includes(songId) ? pl.songIds : [...pl.songIds, songId],
        entries: newEntries,
        updatedAt: Date.now()
      };
      await musicDB.savePlaylist(updated);
      set({
        playlists: playlists.map((p) => (p.id === playlistId ? updated : p))
      });
    }
  },

  batchAddToPlaylist: async (playlistId: string, songIds: string[]) => {
    const { playlists, songs } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl) {
      const mergedIds = Array.from(new Set([...pl.songIds, ...songIds]));
      let newEntries = pl.entries;
      if (newEntries && newEntries.length > 0) {
        const songMap = new Map(songs.map((s) => [s.id, s]));
        const addedEntries: PlaylistEntry[] = songIds.map((sid, idx) => {
          const s = songMap.get(sid);
          return {
            entryId: `entry-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
            position: (newEntries?.length || 0) + idx,
            status: 'available' as const,
            songId: sid,
            title: s?.title || 'Unknown Title',
            artist: s?.artist || 'Unknown Artist',
            duration: s?.duration,
            coverArt: s?.coverArt || s?.artwork,
            addedAt: Date.now()
          };
        });
        newEntries = [...newEntries, ...addedEntries];
      }
      const updated: Playlist = {
        ...pl,
        songIds: mergedIds,
        entries: newEntries,
        updatedAt: Date.now()
      };
      await musicDB.savePlaylist(updated);
      set({
        playlists: playlists.map((p) => (p.id === playlistId ? updated : p))
      });
    }
  },

  removeSongFromPlaylist: async (playlistId: string, songId: string, entryId?: string) => {
    const { playlists } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl) {
      let newEntries = pl.entries;
      let newSongIds: string[];

      if (newEntries && newEntries.length > 0) {
        if (entryId) {
          newEntries = newEntries.filter((e) => e.entryId !== entryId);
        } else {
          const idx = newEntries.findIndex((e) => e.songId === songId);
          if (idx !== -1) {
            newEntries = newEntries.filter((_, i) => i !== idx);
          }
        }
        newEntries = newEntries.map((e, index) => ({
          ...e,
          position: index
        }));
        // Derive newSongIds directly from remaining entries to ensure 100% duplicate and order alignment
        newSongIds = newEntries.filter((e) => e.songId !== null).map((e) => e.songId!);
      } else {
        // Legacy playlist without pl.entries (preserves duplicates & exact occurrence index if entryId supplied)
        newSongIds = [...pl.songIds];
        if (entryId && entryId.startsWith(`${playlistId}_`)) {
          const parts = entryId.split('_');
          const legacyIdx = parseInt(parts[1], 10);
          if (!isNaN(legacyIdx) && legacyIdx >= 0 && legacyIdx < newSongIds.length && newSongIds[legacyIdx] === songId) {
            newSongIds.splice(legacyIdx, 1);
          } else {
            const sIdx = newSongIds.indexOf(songId);
            if (sIdx !== -1) newSongIds.splice(sIdx, 1);
          }
        } else {
          const sIdx = newSongIds.indexOf(songId);
          if (sIdx !== -1) newSongIds.splice(sIdx, 1);
        }
      }

      const updated: Playlist = {
        ...pl,
        songIds: newSongIds,
        entries: newEntries,
        updatedAt: Date.now()
      };
      await musicDB.savePlaylist(updated);
      set({
        playlists: playlists.map((p) => (p.id === playlistId ? updated : p))
      });
    }
  },

  removeEntryFromPlaylist: async (playlistId: string, entryId: string) => {
    const { playlists } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl && pl.entries) {
      const newEntries = pl.entries
        .filter((e) => e.entryId !== entryId)
        .map((e, index) => ({ ...e, position: index }));

      const newSongIds = newEntries.filter((e) => e.songId !== null).map((e) => e.songId!);

      const updated: Playlist = {
        ...pl,
        songIds: newSongIds,
        entries: newEntries,
        updatedAt: Date.now()
      };
      await musicDB.savePlaylist(updated);
      set({
        playlists: playlists.map((p) => (p.id === playlistId ? updated : p))
      });
    }
  },

  registerOnlineSong: async (song: Song) => {
    if (song && song.id) {
      onlineSongRegistry.set(song.id, song);
    }
  },

  downloadTrack: async (song: Song): Promise<boolean> => {
    set((state) => ({
      downloadingStates: {
        ...state.downloadingStates,
        [song.id]: { progress: 0, status: 'downloading' }
      }
    }));

    const success = await downloadService.downloadTrack(song, (pct) => {
      set((state) => ({
        downloadingStates: {
          ...state.downloadingStates,
          [song.id]: { progress: pct, status: 'downloading' }
        }
      }));
    });

    if (success) {
      await get().refreshDownloads();

      // If the downloaded track is currently playing or loaded in playerStore:
      const { usePlayerStore } = await import('./usePlayerStore');
      const playerStore = usePlayerStore.getState();
      if (playerStore.currentSong?.id === song.id) {
        const updatedSong: Song = {
          ...playerStore.currentSong,
          isDownloaded: true,
          isForegroundOnly: false,
          playbackMode: 'direct-catalog',
          isDirectAudioStream: true
        };
        usePlayerStore.setState({ currentSong: updatedSong });

        // If audioService is currently using YouTube iframe, seamlessly hot-swap to cached audio NOW!
        if (audioService.isUsingCloudPlayer) {
          const cachedUrl = await downloadService.getCachedAudioUrl(song.id);
          if (cachedUrl) {
            const currentTime = audioService.getCurrentTime() || 0;
            await audioService.hotSwapToCachedAudio(updatedSong, cachedUrl, currentTime);
          }
        }
      }
    } else {
      set((state) => ({
        downloadingStates: {
          ...state.downloadingStates,
          [song.id]: { progress: 0, status: 'failed' }
        }
      }));
    }
    return success;
  },

  deleteDownloadedTrack: async (songId: string) => {
    await downloadService.deleteDownloadedTrack(songId);
    await get().refreshDownloads();
  },

  clearAllDownloads: async () => {
    await downloadService.clearAllDownloads();
    await get().refreshDownloads();
  },

  refreshDownloads: async () => {
    const downloaded = await downloadService.getDownloadedTracks();
    const downloadedSet = new Set(downloaded.map((s) => s.id));
    const offlineStorage = await downloadService.getOfflineStorageUsage();

    set((state) => {
      const nextDownloading = { ...state.downloadingStates };
      downloadedSet.forEach((id) => {
        delete nextDownloading[id];
      });

      const currentSongMap = new Map(state.songs.map((s) => [s.id, s]));
      // Update existing songs
      downloaded.forEach((dlSong) => {
        currentSongMap.set(dlSong.id, { ...dlSong, isDownloaded: true });
      });

      const updatedSongs = Array.from(currentSongMap.values()).map((s) => ({
        ...s,
        isDownloaded: downloadedSet.has(s.id)
      }));

      return {
        downloadedSongIds: downloadedSet,
        downloadingStates: nextDownloading,
        offlineStorage,
        songs: updatedSongs
      };
    });
  },

  scanFromDirectoryHandle: async (dirHandle: FileSystemDirectoryHandle): Promise<ScanResult> => {
    set({
      scanProgress: {
        status: 'scanning',
        currentFile: 'Collecting audio files...',
        processedCount: 0,
        totalCount: 0
      }
    });

    const entries = await collectFilesFromDirectoryHandle(dirHandle);

    const { result } = await runDifferentialScan(entries, (progress) => {
      set({ scanProgress: progress });
    });

    set({
      scanProgress: {
        status: 'complete',
        currentFile: '',
        processedCount: result.totalScanned,
        totalCount: result.totalScanned,
        result
      }
    });

    await get().loadLibrary();
    return result;
  },

  scanFromFileList: async (files: FileList): Promise<ScanResult> => {
    set({
      scanProgress: {
        status: 'scanning',
        currentFile: 'Collecting audio files...',
        processedCount: 0,
        totalCount: files.length
      }
    });

    const entries = collectFilesFromFileList(files);

    const { result } = await runDifferentialScan(entries, (progress) => {
      set({ scanProgress: progress });
    });

    set({
      scanProgress: {
        status: 'complete',
        currentFile: '',
        processedCount: result.totalScanned,
        totalCount: result.totalScanned,
        result
      }
    });

    await get().loadLibrary();
    return result;
  },

  clearLibrary: async () => {
    await musicDB.clearAllSongs();
    await get().loadLibrary();
  },

  syncCloudCatalog: async () => {
    return 0;
  }
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useLibraryStore.setState({ isOnline: true });
  });
  window.addEventListener('offline', () => {
    useLibraryStore.setState({ isOnline: false });
  });

  // Listen for background download updates
  downloadService.subscribe(() => {
    useLibraryStore.getState().refreshDownloads();
  });

  (window as any).__libraryStore = useLibraryStore;
}

