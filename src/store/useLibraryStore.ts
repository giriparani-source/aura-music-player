import { create } from 'zustand';
import {
  Song,
  Album,
  Artist,
  Playlist,
  LibraryStats,
  LibraryHealth,
  DuplicateGroup,
  NavigationTab,
  LibrarySubTab,
  SortOption,
  ViewMode,
  ScanProgress,
  ScanResult
} from '../types/music';
import { musicDB } from '../services/db';
import { calculateLibraryHealth, healthToLegacyStats } from '../services/healthService';
import { detectDuplicates } from '../services/duplicateService';
import {
  collectFilesFromDirectoryHandle,
  collectFilesFromFileList,
  runDifferentialScan
} from '../services/scannerService';

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

  toggleFavorite: (songId: string) => Promise<void>;
  batchToggleFavorite: (songIds: string[], targetFavorite: boolean) => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  batchAddToPlaylist: (playlistId: string, songIds: string[]) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  registerOnlineSong: (song: Song) => Promise<void>;
  scanFromDirectoryHandle: (dirHandle: FileSystemDirectoryHandle) => Promise<ScanResult>;
  scanFromFileList: (files: FileList) => Promise<ScanResult>;
  clearLibrary: () => Promise<void>;
}

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

  loadLibrary: async () => {
    set({ isLoading: true });
    try {
      const songs = await musicDB.getAllSongs();
      let playlists = await musicDB.getAllPlaylists();

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
        const artistName = s.artist && s.artist !== 'Not set' ? s.artist : 'Local Artist';
        const albumName = s.album && s.album !== 'Not set' ? s.album : 'Local Collection';

        const albumKey = `${albumName} - ${artistName}`;
        if (!albumMap.has(albumKey)) {
          albumMap.set(albumKey, {
            id: albumKey,
            title: albumName,
            artist: artistName,
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

        if (!artistMap.has(artistName)) {
          artistMap.set(artistName, {
            songCount: 1,
            albumSet: new Set([albumName]),
            coverArt: s.artwork || s.coverArt
          });
        } else {
          const art = artistMap.get(artistName)!;
          art.songCount++;
          art.albumSet.add(albumName);
          if (!art.coverArt && (s.artwork || s.coverArt)) {
            art.coverArt = s.artwork || s.coverArt;
          }
        }
      }

      const albums = Array.from(albumMap.values());
      const artists: Artist[] = Array.from(artistMap.entries()).map(([name, data]) => ({
        id: name,
        name,
        songCount: data.songCount,
        albumCount: data.albumSet.size,
        coverArt: data.coverArt
      }));

      // Calculate health & duplicates
      const health = calculateLibraryHealth(songs);
      const stats = healthToLegacyStats(health, artists.length, albums.length, playlists.length);
      const duplicates = detectDuplicates(songs);

      set({
        songs,
        albums,
        artists,
        playlists,
        stats,
        health,
        duplicates,
        isLoading: false
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

  toggleFavorite: async (songId: string) => {
    const { songs } = get();
    let song = songs.find((s) => s.id === songId);
    if (!song) {
      song = await musicDB.getSongById(songId);
    }
    if (song) {
      const newFav = !song.isFavorite;
      await musicDB.updateSongFavorite(songId, newFav);
      if (songs.some((s) => s.id === songId)) {
        set({
          songs: songs.map((s) => (s.id === songId ? { ...s, isFavorite: newFav } : s))
        });
      } else {
        set({
          songs: [{ ...song, isFavorite: newFav }, ...songs]
        });
      }
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
      set({
        songs: songs.map((s) => (idSet.has(s.id) ? { ...s, isFavorite: targetFavorite } : s))
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

  deletePlaylist: async (id: string) => {
    await musicDB.deletePlaylist(id);
    set((state) => ({
      playlists: state.playlists.filter((p) => p.id !== id),
      activePlaylistId: state.activePlaylistId === id ? null : state.activePlaylistId
    }));
  },

  addSongToPlaylist: async (playlistId: string, songId: string) => {
    const { playlists } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl && !pl.songIds.includes(songId)) {
      const updated: Playlist = {
        ...pl,
        songIds: [...pl.songIds, songId],
        updatedAt: Date.now()
      };
      await musicDB.savePlaylist(updated);
      set({
        playlists: playlists.map((p) => (p.id === playlistId ? updated : p))
      });
    }
  },

  batchAddToPlaylist: async (playlistId: string, songIds: string[]) => {
    const { playlists } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl) {
      const mergedIds = Array.from(new Set([...pl.songIds, ...songIds]));
      const updated: Playlist = {
        ...pl,
        songIds: mergedIds,
        updatedAt: Date.now()
      };
      await musicDB.savePlaylist(updated);
      set({
        playlists: playlists.map((p) => (p.id === playlistId ? updated : p))
      });
    }
  },

  removeSongFromPlaylist: async (playlistId: string, songId: string) => {
    const { playlists } = get();
    const pl = playlists.find((p) => p.id === playlistId);
    if (pl) {
      const updated: Playlist = {
        ...pl,
        songIds: pl.songIds.filter((id) => id !== songId),
        updatedAt: Date.now()
      };
      await musicDB.savePlaylist(updated);
      set({
        playlists: playlists.map((p) => (p.id === playlistId ? updated : p))
      });
    }
  },

  registerOnlineSong: async (song: Song) => {
    const { songs } = get();
    if (!songs.some((s) => s.id === song.id)) {
      await musicDB.saveSong(song);
      set({
        songs: [song, ...songs]
      });
    }
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
  }
}));
