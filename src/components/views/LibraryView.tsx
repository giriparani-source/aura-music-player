import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ArrowUpDown,
  LayoutGrid,
  LayoutList,
  CheckSquare,
  Square,
  Sparkles,
  Heart,
  Filter,
  X,
  Folder,
  Play,
  Download,
  Trash2,
  HardDrive,
  AlertTriangle,
  Clock,
  ListMusic,
  Plus,
  UploadCloud
} from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { LibrarySubTab, SortOption } from '../../types/music';
import { useDebounce } from '../../utils/useDebounce';
import { formatTime, formatBytes } from '../../utils/formatters';
import { SongRow } from '../common/SongRow';
import { Artwork } from '../common/Artwork';
import { BatchActionBar } from '../common/BatchActionBar';
import { AddToPlaylistModal } from '../common/AddToPlaylistModal';
import { ImportPlaylistModal } from '../common/ImportPlaylistModal';
import { PlaylistsView } from './PlaylistsView';
import { resolveArtistImage } from '../../utils/artistImageHelper';

export const LibraryView: React.FC = () => {
  const {
    songs,
    albums,
    artists,
    playlists,
    librarySubTab,
    setLibrarySubTab,
    sortOption,
    setSortOption,
    sortAscending,
    toggleSortDirection,
    viewMode,
    setViewMode,
    activePlaylistId,
    setActivePlaylistId,
    createPlaylist,
    toggleFavorite,
    folderFilter,
    setFolderFilter,
    formatFilter,
    setFormatFilter,
    highBitrateOnly,
    setHighBitrateOnly,
    favoritesOnly,
    setFavoritesOnly,
    clearFilters,
    downloadedSongIds,
    offlineStorage,
    clearAllDownloads,
    searchQuery,
    setSearchQuery
  } = useLibraryStore();

  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playSong = usePlayerStore((s) => s.playSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  const [localSearch, setLocalSearch] = useState(searchQuery || '');
  const debouncedLocalSearch = useDebounce(localSearch, 150);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [downloadSearch, setDownloadSearch] = useState('');

  // Bidirectional sync between top Header search bar and Library in-page search
  useEffect(() => {
    if (searchQuery !== localSearch) {
      setLocalSearch(searchQuery);
    }
  }, [searchQuery]);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    setSearchQuery(val);
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    setSearchQuery('');
  };

  const getPlaylistSongs = (pl: any) => {
    if (pl.id === 'smart-favorites') return songs.filter((s) => s.isFavorite);
    if (pl.id === 'smart-recent') return [...songs].filter((s) => s.lastPlayed).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)).slice(0, 30);
    if (pl.id === 'smart-most-played') return [...songs].filter((s) => s.playCount > 0).sort((a, b) => b.playCount - a.playCount).slice(0, 30);
    if (pl.id === 'smart-recent-added') return [...songs].sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 30);
    return songs.filter((s) => pl.songIds.includes(s.id));
  };

  // Available Folders and Formats
  const uniqueFolders = useMemo(() => {
    const set = new Set<string>();
    songs.forEach((s) => {
      if (s.folder) set.add(s.folder);
    });
    return Array.from(set).sort();
  }, [songs]);

  const uniqueFormats = useMemo(() => {
    const set = new Set<string>();
    songs.forEach((s) => {
      if (s.format) set.add(s.format.toLowerCase());
    });
    return Array.from(set).sort();
  }, [songs]);

  // Filter songs by all active criteria (BUG-09 fix: use debounced search to avoid UI freeze)
  const filteredSongs = useMemo(() => {
    return songs.filter((s) => {
      // 1. Local Search text
      if (debouncedLocalSearch) {
        const q = debouncedLocalSearch.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesArtist = s.artist.toLowerCase().includes(q);
        const matchesAlbum = s.album.toLowerCase().includes(q);
        const matchesFolder = s.folder?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesArtist && !matchesAlbum && !matchesFolder) {
          return false;
        }
      }

      // 2. Favorites only
      if (favoritesOnly && !s.isFavorite) {
        return false;
      }

      // 3. High Bitrate only (320kbps+)
      if (highBitrateOnly && (!s.bitrate || s.bitrate < 320)) {
        return false;
      }

      // 4. Folder filter
      if (folderFilter && s.folder !== folderFilter) {
        return false;
      }

      // 5. Format filter
      if (formatFilter && s.format.toLowerCase() !== formatFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [songs, debouncedLocalSearch, favoritesOnly, highBitrateOnly, folderFilter, formatFilter]);

  // Sort filtered songs
  const sortedSongs = useMemo(() => {
    const list = [...filteredSongs];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortOption) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'artist':
          cmp = a.artist.localeCompare(b.artist);
          break;
        case 'album':
          cmp = a.album.localeCompare(b.album);
          break;
        case 'duration':
          cmp = a.duration - b.duration;
          break;
        case 'mostPlayed':
          cmp = (a.playCount || 0) - (b.playCount || 0);
          break;
        case 'bitrate':
          cmp = (a.bitrate || 0) - (b.bitrate || 0);
          break;
        case 'fileSize':
          cmp = a.fileSize - b.fileSize;
          break;
        case 'recent':
        default:
          cmp = a.dateAdded - b.dateAdded;
          break;
      }
      return sortAscending ? cmp : -cmp;
    });
    return list;
  }, [filteredSongs, sortOption, sortAscending]);

  const downloadedSongs = useMemo(() => {
    return songs.filter((s) => downloadedSongIds.has(s.id));
  }, [songs, downloadedSongIds]);

  const filteredDownloadedSongs = useMemo(() => {
    if (!downloadSearch) return downloadedSongs;
    const q = downloadSearch.toLowerCase();
    return downloadedSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
    );
  }, [downloadedSongs, downloadSearch]);

  // Filter artists in real-time (Spotify-grade in-library search)
  const filteredArtists = useMemo(() => {
    if (!debouncedLocalSearch.trim()) return artists;
    const q = debouncedLocalSearch.toLowerCase().trim();
    return artists.filter((art) => art.name.toLowerCase().includes(q));
  }, [artists, debouncedLocalSearch]);

  // Filter albums in real-time
  const filteredAlbums = useMemo(() => {
    if (!debouncedLocalSearch.trim()) return albums;
    const q = debouncedLocalSearch.toLowerCase().trim();
    return albums.filter(
      (alb) =>
        alb.title.toLowerCase().includes(q) ||
        (alb.artist && alb.artist.toLowerCase().includes(q))
    );
  }, [albums, debouncedLocalSearch]);

  // Filter playlists in real-time
  const filteredPlaylists = useMemo(() => {
    if (!debouncedLocalSearch.trim()) return playlists;
    const q = debouncedLocalSearch.toLowerCase().trim();
    return playlists.filter(
      (pl) =>
        pl.name.toLowerCase().includes(q) ||
        (pl.description && pl.description.toLowerCase().includes(q))
    );
  }, [playlists, debouncedLocalSearch]);


  const subTabs: Array<{ id: LibrarySubTab; label: string; count: number }> = [
    { id: 'playlists', label: 'Playlists', count: debouncedLocalSearch ? filteredPlaylists.length : playlists.length },
    { id: 'songs', label: 'Songs', count: debouncedLocalSearch ? filteredSongs.length : songs.length },
    { id: 'artists', label: 'Artists', count: debouncedLocalSearch ? filteredArtists.length : artists.length },
    { id: 'albums', label: 'Albums', count: debouncedLocalSearch ? filteredAlbums.length : albums.length },
    { id: 'downloads', label: 'Downloaded', count: downloadedSongIds.size },
    { id: 'folders', label: 'Folders', count: uniqueFolders.length },
  ];

  const hasActiveFilters = Boolean(
    localSearch || favoritesOnly || highBitrateOnly || folderFilter || formatFilter
  );

  // Multi-select handlers
  const toggleSelectSong = (id: string) => {
    setSelectedSongIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedSongIds.length === sortedSongs.length) {
      setSelectedSongIds([]);
    } else {
      setSelectedSongIds(sortedSongs.map((s) => s.id));
    }
  };

  // Render Spotify-grade playlist detail view directly inside My Library
  if (librarySubTab === 'playlists' && activePlaylistId) {
    return <PlaylistsView />;
  }

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto select-none pb-32">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Your Music Library</h2>
          <p className="text-sm text-neutral-400 mt-1">
            {songs.length} audio tracks indexed • {uniqueFolders.length} curated categories
          </p>
        </div>

        {/* Multi-selection toggle */}
        {librarySubTab === 'songs' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isSelectMode) {
                  setIsSelectMode(false);
                  setSelectedSongIds([]);
                } else {
                  setIsSelectMode(true);
                }
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isSelectMode
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                  : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {isSelectMode ? <CheckSquare size={14} /> : <Square size={14} />}
              <span>{isSelectMode ? 'Exit Selection' : 'Batch Select'}</span>
            </button>

            {isSelectMode && (
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                {selectedSongIds.length === sortedSongs.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sub Tabs Navigation (Spotify Rounded Pill Style) */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-4 overflow-x-auto">
        {subTabs.map((tab) => {
          const isActive = librarySubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setLibrarySubTab(tab.id);
                setIsSelectMode(false);
                setSelectedSongIds([]);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'bg-white/10 text-neutral-300 hover:text-white hover:bg-white/15'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-black/15 text-black' : 'bg-white/10 text-neutral-400'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Toolbar */}
      {['songs', 'artists', 'albums', 'playlists'].includes(librarySubTab) && (
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Filter Input */}
            <div className="relative w-full md:w-80">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              <input
                type="search"
                name="aura_library_filter"
                id="aura_library_filter"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={
                  librarySubTab === 'artists'
                    ? `Filter ${artists.length} artists (e.g. Sid Sriram, Anirudh)...`
                    : librarySubTab === 'albums'
                    ? `Filter ${albums.length} albums...`
                    : librarySubTab === 'playlists'
                    ? `Filter ${playlists.length} playlists...`
                    : 'Search songs, artists, folders...'
                }
                className="w-full pl-9 pr-8 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-all"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-0.5 cursor-pointer"
                  title="Clear filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort & Grid/List Controls (Only for songs subtab) */}
            {librarySubTab === 'songs' && (
              <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
                {/* Sort Selector */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-xs">
                  <button
                    onClick={toggleSortDirection}
                    className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
                    aria-label={sortAscending ? 'Sort Ascending (Click to invert)' : 'Sort Descending (Click to invert)'}
                    title={sortAscending ? 'Sort Ascending (Click to invert)' : 'Sort Descending (Click to invert)'}
                  >
                    <ArrowUpDown size={13} className={sortAscending ? 'text-indigo-400 rotate-180 transition-transform' : 'transition-transform'} />
                  </button>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="bg-transparent text-neutral-300 focus:outline-none cursor-pointer pr-1 text-xs"
                  >
                    <option value="recent" className="bg-[#12141a]">Date Added</option>
                    <option value="title" className="bg-[#12141a]">Title</option>
                    <option value="artist" className="bg-[#12141a]">Artist</option>
                    <option value="album" className="bg-[#12141a]">Album</option>
                    <option value="duration" className="bg-[#12141a]">Duration</option>
                    <option value="bitrate" className="bg-[#12141a]">Bitrate</option>
                    <option value="fileSize" className="bg-[#12141a]">File Size</option>
                    <option value="mostPlayed" className="bg-[#12141a]">Most Played</option>
                  </select>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                    title="List View"
                  >
                    <LayoutList size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Quick Filter Info when on artists/albums/playlists */}
            {librarySubTab === 'artists' && (
              <span className="text-[11px] text-neutral-500 whitespace-nowrap md:ml-auto">
                Showing {filteredArtists.length} of {artists.length} artists
              </span>
            )}
            {librarySubTab === 'albums' && (
              <span className="text-[11px] text-neutral-500 whitespace-nowrap md:ml-auto">
                Showing {filteredAlbums.length} of {albums.length} albums
              </span>
            )}
            {librarySubTab === 'playlists' && (
              <span className="text-[11px] text-neutral-500 whitespace-nowrap md:ml-auto">
                Showing {filteredPlaylists.length} of {playlists.length} playlists
              </span>
            )}
          </div>

          {/* Quick Filter Pills Bar (Only on songs tab) */}
          {librarySubTab === 'songs' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {/* Favorites Toggle Pill */}
              <button
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className={`px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  favoritesOnly
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20'
                    : 'bg-white/5 text-neutral-400 border-white/5 hover:text-white hover:bg-white/10'
                }`}
              >
                <Heart size={12} className={favoritesOnly ? 'fill-rose-400 text-rose-400' : ''} />
                <span>Favorites Only</span>
              </button>

              {/* High Bitrate Toggle Pill */}
              <button
                onClick={() => setHighBitrateOnly(!highBitrateOnly)}
                className={`px-3 py-1 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  highBitrateOnly
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                    : 'bg-white/5 text-neutral-400 border-white/5 hover:text-white hover:bg-white/10'
                }`}
              >
                <Sparkles size={12} />
                <span>HQ (320kbps+)</span>
              </button>

              {/* Folder Filter Dropdown */}
              <div className="relative">
                <select
                  value={folderFilter || ''}
                  onChange={(e) => setFolderFilter(e.target.value ? e.target.value : null)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium border appearance-none pr-7 cursor-pointer transition-all ${
                    folderFilter
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-white/5 text-neutral-400 border-white/5 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <option value="" className="bg-[#12141a]">All Folders</option>
                  {uniqueFolders.map((folder) => (
                    <option key={folder} value={folder} className="bg-[#12141a]">
                      📁 {folder}
                    </option>
                  ))}
                </select>
                <Filter size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
              </div>

              {/* Format Filter Dropdown */}
              {uniqueFormats.length > 1 && (
                <div className="relative">
                  <select
                    value={formatFilter || ''}
                    onChange={(e) => setFormatFilter(e.target.value ? e.target.value : null)}
                    className={`px-3 py-1 rounded-xl text-xs font-medium border appearance-none pr-7 cursor-pointer uppercase transition-all ${
                      formatFilter
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-white/5 text-neutral-400 border-white/5 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <option value="" className="bg-[#12141a]">All Formats</option>
                    {uniqueFormats.map((fmt) => (
                      <option key={fmt} value={fmt} className="bg-[#12141a]">
                        .{fmt}
                      </option>
                    ))}
                  </select>
                  <Filter size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
                </div>
              )}

              {/* Clear All Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-2.5 py-1 rounded-xl text-neutral-400 hover:text-rose-400 bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="Reset all active filters"
                >
                  <X size={12} />
                  <span>Reset</span>
                </button>
              )}

              {/* Active Count */}
              <span className="text-[11px] text-neutral-500 ml-auto whitespace-nowrap pl-2">
                Showing {sortedSongs.length} of {songs.length}
              </span>
            </div>
          )}
        </div>
      )}

      {/* SUB TAB 1: SONGS */}
      {librarySubTab === 'songs' && (
        <>
          {sortedSongs.length === 0 ? (
            <div className="py-16 text-center text-neutral-500">
              <p className="text-sm font-semibold text-neutral-400">No tracks match your current filter</p>
              <button
                onClick={clearFilters}
                className="mt-3 px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : viewMode === 'list' ? (
            <div>
              <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_minmax(120px,1.5fr)_auto] lg:grid-cols-[auto_1fr_minmax(140px,1.5fr)_minmax(100px,1fr)_auto] items-center gap-3 md:gap-4 px-3 sm:px-4 py-2 border-b border-white/10 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                <div className="w-6 text-center">#</div>
                <div>Title</div>
                <div className="hidden md:block">Album</div>
                <div className="hidden lg:block">Date added</div>
                <div className="w-9 text-right flex justify-end">
                  <Clock size={14} />
                </div>
              </div>
              <div className="space-y-0.5">
                {sortedSongs.map((song, idx) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    index={idx}
                    playlistContext={sortedSongs}
                    isSelectMode={isSelectMode}
                    isSelected={selectedSongIds.includes(song.id)}
                    onToggleSelect={toggleSelectSong}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {sortedSongs.map((song) => {
                const isCurrent = currentSong?.id === song.id;
                return (
                  <div
                    key={song.id}
                    onClick={() => {
                      if (isSelectMode) {
                        toggleSelectSong(song.id);
                      } else {
                        if (isCurrent) {
                          togglePlay();
                        } else {
                          playSong(song, sortedSongs);
                        }
                      }
                    }}
                    className={`group glass-card p-3 rounded-2xl relative transition-all cursor-pointer border flex flex-col justify-between ${
                      selectedSongIds.includes(song.id)
                        ? 'border-indigo-500/60 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                        : isCurrent
                        ? 'border-indigo-500/30 bg-indigo-500/5'
                        : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Checkbox for multi-select */}
                    {isSelectMode && (
                      <div className="absolute top-4 right-4 z-20">
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                            selectedSongIds.includes(song.id)
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-black/70 border-white/30 text-transparent'
                          }`}
                        >
                          <CheckSquare size={14} />
                        </div>
                      </div>
                    )}

                    {/* Cover artwork container with hover play overlay */}
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-neutral-900 group">
                      <Artwork
                        src={song.coverArt || song.artwork}
                        title={song.title}
                        artist={song.artist}
                        size="xl"
                        className="w-full h-full object-cover"
                      />

                      {/* Favorite heart on top-left of artwork */}
                      {!isSelectMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(song.id);
                          }}
                          className={`absolute top-2 left-2 p-1.5 rounded-full backdrop-blur-md transition-all z-10 ${
                            song.isFavorite
                              ? 'bg-black/50 text-rose-500 opacity-100'
                              : 'bg-black/40 text-white/70 opacity-0 group-hover:opacity-100 hover:text-white hover:scale-110'
                          }`}
                          title={song.isFavorite ? 'Favorited' : 'Favorite'}
                        >
                          <Heart size={14} className={song.isFavorite ? 'fill-rose-500' : ''} />
                        </button>
                      )}

                      {/* Floating Play button on hover or if currently playing */}
                      <div
                        className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center transition-opacity z-10 ${
                          isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-600/50 hover:scale-110 active:scale-95 transition-transform">
                          {isCurrent && isPlaying ? (
                            <div className="flex items-end gap-0.5 h-4">
                              <span className="w-1 bg-white h-full animate-pulse" />
                              <span className="w-1 bg-white h-2/3 animate-bounce" />
                              <span className="w-1 bg-white h-3/4 animate-pulse" />
                            </div>
                          ) : (
                            <Play size={20} className="fill-white ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Song info */}
                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-indigo-300' : 'text-white group-hover:text-indigo-300'} transition-colors`}>
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {song.artist && song.artist !== 'Not set' ? song.artist : 'Local Artist'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono mt-1.5 pt-1 border-t border-white/5">
                        <span>{formatTime(song.duration)}</span>
                        <span>{song.album && song.album !== 'Not set' ? song.album : 'Single'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* SUB TAB 2: ALBUMS */}
      {librarySubTab === 'albums' && (
        filteredAlbums.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-neutral-300">No albums found matching "{localSearch}"</p>
            <p className="text-xs text-neutral-500 mt-1">Try searching another album name or artist</p>
            <button
              type="button"
              onClick={handleClearSearch}
              className="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredAlbums.map((alb) => {
              const albumSongs = songs.filter((s) => s.album === alb.title);
              return (
                <div
                  key={alb.id}
                  onClick={() => {
                    setLocalSearch(alb.title);
                    setLibrarySubTab('songs');
                  }}
                  className="group glass-card p-4 rounded-2xl space-y-3 hover:scale-[1.02] transition-all cursor-pointer relative"
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden">
                    <Artwork src={alb.coverArt} title={alb.title} artist={alb.artist} size="lg" className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (albumSongs.length > 0) playSong(albumSongs[0], albumSongs);
                      }}
                      className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110 active:scale-95 z-10 cursor-pointer"
                      title={`Play ${alb.title}`}
                    >
                      <Play size={16} className="fill-white ml-0.5" />
                    </button>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                      {alb.title}
                    </h4>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">{alb.artist}</p>
                    <p className="text-[11px] text-neutral-500 mt-1">{alb.songCount} songs</p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* SUB TAB 3: ARTISTS */}
      {librarySubTab === 'artists' && (
        filteredArtists.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-neutral-300">No artists found matching "{localSearch}"</p>
            <p className="text-xs text-neutral-500 mt-1">Try searching for another artist name (e.g., Sid Sriram, Ilaiyaraaja, Anirudh)</p>
            <button
              type="button"
              onClick={handleClearSearch}
              className="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredArtists.map((art) => {
              const normArt = art.name.toLowerCase().replace(/[.\s_\-,]+/g, '');
              const artistSongs = songs.filter((s) => {
                const normSong = s.artist.toLowerCase().replace(/[.\s_\-,]+/g, '');
                return normSong.includes(normArt);
              });
              const artistImg = resolveArtistImage(
                art.name,
                art.coverArt || artistSongs[0]?.artwork || artistSongs[0]?.coverArt
              );

              return (
                <div
                  key={art.id}
                  onClick={() => {
                    setLocalSearch(art.name);
                    setLibrarySubTab('songs');
                  }}
                  className="group glass-card p-4 rounded-2xl flex flex-col items-center text-center space-y-3 hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden w-full min-w-0"
                >
                  <div className="relative shrink-0">
                    {artistImg ? (
                      <img
                        src={artistImg}
                        alt={art.name}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover shadow-xl group-hover:scale-105 transition-transform duration-300 border border-white/10 bg-neutral-800"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                          const parent = (e.target as HTMLElement).parentElement;
                          if (parent) {
                            const fallback = parent.querySelector('.artist-fallback');
                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}

                    <div
                      className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 group-hover:scale-105 transition-transform font-bold text-lg artist-fallback ${
                        artistImg ? 'hidden' : 'flex'
                      }`}
                    >
                      {art.name.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Floating Spotify Play Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (artistSongs.length > 0) playSong(artistSongs[0], artistSongs);
                      }}
                      className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#1ed760] text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110 active:scale-95 z-10 cursor-pointer"
                      title={`Play tracks by ${art.name}`}
                    >
                      <Play size={15} className="fill-black ml-0.5" />
                    </button>
                  </div>

                  {/* Name & Stats Container - Guaranteed NO OVERLAP */}
                  <div className="w-full min-w-0 px-1 text-center">
                    <h4
                      className="text-sm font-bold text-white group-hover:text-[#1ed760] transition-colors truncate block w-full"
                      title={art.name}
                    >
                      {art.name}
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1 truncate block w-full font-medium">
                      {art.songCount} {art.songCount === 1 ? 'track' : 'tracks'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* SUB TAB 4: PLAYLISTS */}
      {librarySubTab === 'playlists' && (
        filteredPlaylists.length === 0 && localSearch && !('liked songs'.includes(localSearch.toLowerCase())) ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-neutral-300">No playlists found matching "{localSearch}"</p>
            <button
              type="button"
              onClick={handleClearSearch}
              className="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Playlists Actions: Import & Create Buttons */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-neutral-400 font-medium">
                {filteredPlaylists.length + 1} playlists in library
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                  title="Import from Spotify / YouTube"
                >
                  <UploadCloud size={14} className="text-[#1ed760]" />
                  <span>Import Playlist</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const name = prompt('Enter name for your new playlist:');
                    if (name && name.trim()) {
                      createPlaylist(name.trim()).then((newPl) => setActivePlaylistId(newPl.id));
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1ed760] hover:bg-[#1fdf64] text-black text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  title="Create New Playlist"
                >
                  <Plus size={14} />
                  <span>New Playlist</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {/* Spotify-style Liked Songs Special Card */}
              {(!localSearch || 'liked songs'.includes(localSearch.toLowerCase())) && (
                <div
                  onClick={() => {
                    setActivePlaylistId('smart-favorites');
                  }}
                  className="group p-4 rounded-2xl bg-gradient-to-br from-[#450af5] to-[#8e8ee5] text-white flex flex-col justify-between aspect-square cursor-pointer shadow-xl hover:scale-[1.02] transition-all relative overflow-hidden"
                >
                  <div className="pt-2">
                    <Heart size={32} className="fill-white text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white">Liked Songs</h4>
                    <p className="text-xs text-white/80 font-medium mt-1">
                      {songs.filter((s) => s.isFavorite).length} liked songs
                    </p>
                  </div>
                </div>
              )}

              {/* Regular & Imported Playlists */}
              {filteredPlaylists.map((pl) => {
              const plSongs = getPlaylistSongs(pl);
              return (
                <div
                  key={pl.id}
                  onClick={() => {
                    setActivePlaylistId(pl.id);
                  }}
                  className="group glass-card p-3.5 rounded-2xl space-y-3 hover:bg-white/10 transition-all cursor-pointer relative"
                >
                <div className="relative w-full aspect-square rounded-xl bg-neutral-900 overflow-hidden shadow-md">
                  {pl.coverArt ? (
                    <img
                      src={pl.coverArt}
                      alt={pl.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-700 via-purple-800 to-pink-700 flex items-center justify-center text-white">
                      <ListMusic size={32} />
                    </div>
                  )}

                  {/* Floating Play Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (plSongs.length > 0) playSong(plSongs[0], plSongs);
                    }}
                    className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl active:scale-95 z-10 cursor-pointer"
                    title={`Play ${pl.name}`}
                  >
                    <Play size={16} className="fill-black text-black ml-0.5" />
                  </button>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-[#1ed760] transition-colors truncate">
                    {pl.name}
                  </h4>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">{pl.description || (pl.isSmart ? 'Smart Mix' : 'Playlist')}</p>
                  <p className="text-[11px] text-neutral-500 mt-1 font-mono">{plSongs.length} songs</p>
                </div>
              </div>
            );
          })}
          </div>
        </div>
        )
      )}

      {/* SUB TAB 5: FOLDERS */}
      {librarySubTab === 'folders' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {uniqueFolders.map((folderName) => {
            const folderSongs = songs.filter((s) => s.folder === folderName);
            return (
              <div
                key={folderName}
                onClick={() => {
                  setFolderFilter(folderName);
                  setLibrarySubTab('songs');
                }}
                className="group glass-card p-4 rounded-2xl flex items-center justify-between gap-3.5 hover:scale-[1.02] transition-all cursor-pointer border border-transparent hover:border-indigo-500/30"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                    <Folder size={24} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                      {folderName}
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {folderSongs.length} track{folderSongs.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (folderSongs.length > 0) playSong(folderSongs[0], folderSongs);
                  }}
                  className="w-9 h-9 rounded-full bg-indigo-600/90 hover:bg-indigo-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md shrink-0 cursor-pointer active:scale-95"
                  title={`Play all in ${folderName}`}
                >
                  <Play size={14} className="fill-white ml-0.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB TAB 6: DOWNLOADS (OFFLINE CACHE) */}
      {librarySubTab === 'downloads' && (
        <div className="space-y-6">
          {/* Offline Storage Dashboard Card */}
          <div className="glass-card p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/10 relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-4 min-w-0 z-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/10">
                <HardDrive size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white">Offline Downloads</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Cache Storage
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
                  {downloadedSongs.length} track{downloadedSongs.length !== 1 ? 's' : ''} available offline • {formatBytes(offlineStorage.totalBytes)} used
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end z-10">
              {downloadedSongs.length > 0 && (
                <button
                  onClick={() => setIsClearConfirmOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Remove all downloaded audio files from cache"
                >
                  <Trash2 size={14} />
                  <span>Clear All Downloads</span>
                </button>
              )}
            </div>
          </div>

          {/* Search within downloads if there are multiple songs */}
          {downloadedSongs.length > 3 && (
            <div className="relative max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search downloaded tracks..."
                value={downloadSearch}
                onChange={(e) => setDownloadSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {downloadSearch && (
                <button
                  onClick={() => setDownloadSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Downloaded Songs List */}
          {downloadedSongs.length === 0 ? (
            <div className="glass-card p-8 sm:p-12 rounded-3xl border border-white/5 text-center flex flex-col items-center justify-center max-w-lg mx-auto my-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 mb-4">
                <Download size={28} />
              </div>
              <h4 className="text-lg font-bold text-white mb-1.5">No Downloaded Songs Yet</h4>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-sm leading-relaxed mb-6">
                Download online tracks and JioSaavn songs by clicking the download icon next to any song. Downloaded tracks can be played even when you are offline without an internet connection.
              </p>
              <button
                onClick={() => setLibrarySubTab('songs')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                Browse Library
              </button>
            </div>
          ) : filteredDownloadedSongs.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 text-xs">
              No downloaded tracks match "{downloadSearch}"
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-1">
              {filteredDownloadedSongs.map((song, idx) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={idx}
                  playlistContext={filteredDownloadedSongs}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredDownloadedSongs.map((song) => {
                const isCurrent = currentSong?.id === song.id;
                return (
                  <div
                    key={song.id}
                    onClick={() => {
                      if (isCurrent) {
                        togglePlay();
                      } else {
                        playSong(song, filteredDownloadedSongs);
                      }
                    }}
                    className={`group glass-card p-3 rounded-2xl relative transition-all cursor-pointer border flex flex-col justify-between ${
                      isCurrent
                        ? 'border-emerald-500/40 bg-emerald-500/5 shadow-lg shadow-emerald-500/10'
                        : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3">
                      <Artwork
                        src={song.coverArt || song.artwork}
                        title={song.title}
                        artist={song.artist}
                        size="md"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrent) {
                            togglePlay();
                          } else {
                            playSong(song, filteredDownloadedSongs);
                          }
                        }}
                        className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110 active:scale-95 z-10 cursor-pointer"
                        title={isCurrent && isPlaying ? 'Pause' : 'Play'}
                      >
                        <Play size={14} className="fill-white ml-0.5" />
                      </button>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Clear All Downloads Confirmation Modal */}
          {isClearConfirmOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#141721] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Clear All Offline Downloads?</h3>
                    <p className="text-xs text-neutral-400">Free up local offline storage</p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  This will remove all downloaded audio streams ({formatBytes(offlineStorage.totalBytes)}) from your device cache. Song metadata, playlists, and favorites will remain in your library, but you will need an active internet connection to stream them.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setIsClearConfirmOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await clearAllDownloads();
                      setIsClearConfirmOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-colors cursor-pointer"
                  >
                    Clear All ({downloadedSongs.length})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Batch Action Bar */}
      <BatchActionBar
        selectedSongIds={selectedSongIds}
        songs={sortedSongs}
        onClearSelection={() => setSelectedSongIds([])}
        onOpenPlaylistModal={() => setIsPlaylistModalOpen(true)}
      />

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        songIds={selectedSongIds}
        onSuccess={() => {
          setSelectedSongIds([]);
          setIsSelectMode(false);
        }}
      />

      {/* Universal Import Playlist Modal (Spotify/YouTube/JioSaavn) */}
      <ImportPlaylistModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(newId) => {
          setActivePlaylistId(newId);
        }}
      />
    </div>
  );
};
