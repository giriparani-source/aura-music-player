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
import { Song, LibrarySubTab, SortOption } from '../../types/music';
import { useDebounce } from '../../utils/useDebounce';
import { formatTime, formatBytes } from '../../utils/formatters';
import { VirtualSongList } from '../common/VirtualSongList';
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

  const sourceSongs = songs;

  const getPlaylistSongs = (pl: any) => {
    if (pl.id === 'smart-favorites') return songs.filter((s) => s.isFavorite);
    if (pl.id === 'smart-recent')
      return [...songs].filter((s) => s.lastPlayedAt || s.lastPlayed).sort((a, b) => (b.lastPlayedAt || b.lastPlayed || 0) - (a.lastPlayedAt || a.lastPlayed || 0)).slice(0, 50);
    if (pl.id === 'smart-most-played')
      return [...songs].filter((s) => s.playCount > 0).sort((a, b) => b.playCount - a.playCount).slice(0, 50);
    if (pl.id === 'smart-recent-added')
      return [...songs].sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 50);
    return songs.filter((s) => pl.songIds?.includes(s.id));
  };

  const filteredSongs = useMemo(() => {
    return sourceSongs.filter((s) => {
      if (debouncedLocalSearch) {
        const q = debouncedLocalSearch.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesArtist = s.artist.toLowerCase().includes(q);
        const matchesAlbum = s.album.toLowerCase().includes(q);
        if (!matchesTitle && !matchesArtist && !matchesAlbum) {
          return false;
        }
      }

      if (favoritesOnly && !s.isFavorite) {
        return false;
      }

      if (highBitrateOnly && (!s.bitrate || s.bitrate < 320)) {
        return false;
      }

      return true;
    });
  }, [sourceSongs, debouncedLocalSearch, favoritesOnly, highBitrateOnly]);

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
    return songs.filter((s) => downloadedSongIds.has(s.id) || s.isDownloaded);
  }, [songs, downloadedSongIds]);

  const filteredDownloadedSongs = useMemo(() => {
    if (!debouncedLocalSearch) return downloadedSongs;
    const q = debouncedLocalSearch.toLowerCase();
    return downloadedSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
    );
  }, [downloadedSongs, debouncedLocalSearch]);

  const filteredArtists = useMemo(() => {
    if (!debouncedLocalSearch.trim()) return artists;
    const q = debouncedLocalSearch.toLowerCase().trim();
    return artists.filter((art) => art.name.toLowerCase().includes(q));
  }, [artists, debouncedLocalSearch]);

  const filteredAlbums = useMemo(() => {
    if (!debouncedLocalSearch.trim()) return albums;
    const q = debouncedLocalSearch.toLowerCase().trim();
    return albums.filter(
      (alb) =>
        alb.title.toLowerCase().includes(q) ||
        (alb.artist && alb.artist.toLowerCase().includes(q))
    );
  }, [albums, debouncedLocalSearch]);

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
    { id: 'songs', label: 'Songs', count: debouncedLocalSearch ? filteredSongs.length : sourceSongs.length },
    { id: 'artists', label: 'Artists', count: debouncedLocalSearch ? filteredArtists.length : artists.length },
    { id: 'albums', label: 'Albums', count: debouncedLocalSearch ? filteredAlbums.length : albums.length },
    { id: 'downloads', label: 'Downloaded', count: downloadedSongIds.size },
  ];

  const hasActiveFilters = Boolean(
    localSearch || favoritesOnly || highBitrateOnly
  );

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

  if (librarySubTab === 'playlists' && activePlaylistId) {
    return <PlaylistsView />;
  }

  const likedCount = sourceSongs.filter((s: Song) => s.isFavorite).length;

  return (
    <div className="relative p-4 sm:p-8 space-y-6 max-w-7xl mx-auto select-none pb-32">
      {/* Dynamic Atmospheric Glow Backdrops (Stitch Nocturne) */}
      <div className="absolute -top-12 -left-10 w-64 h-64 rounded-full bg-[#9d4edd]/20 blur-3xl pointer-events-none -z-10" />
      <div className="absolute -top-6 -right-10 w-64 h-64 rounded-full bg-[#00f1fd]/15 blur-3xl pointer-events-none -z-10" />

      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#e5e0eb]">Your Cloud Library</h2>
          <p className="text-xs sm:text-sm text-[#998d9e] mt-1">
            {sourceSongs.length} high-fidelity streaming tracks saved in your personal collection
          </p>
        </div>

        {librarySubTab === 'songs' && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                if (isSelectMode) {
                  setIsSelectMode(false);
                  setSelectedSongIds([]);
                } else {
                  setIsSelectMode(true);
                }
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isSelectMode
                  ? 'bg-[#9d4edd] text-white border-[#9d4edd] shadow-md shadow-[#9d4edd]/30'
                  : 'bg-[#1c1b22] border-white/[0.08] text-[#d0c2d5] hover:bg-[#201f26] hover:text-white'
              }`}
            >
              {isSelectMode ? <CheckSquare size={14} /> : <Square size={14} />}
              <span>{isSelectMode ? 'Exit Selection' : 'Batch Select'}</span>
            </button>

            {isSelectMode && (
              <button
                onClick={handleSelectAll}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#201f26] hover:bg-[#2a2931] border border-white/[0.08] text-[#d0c2d5] hover:text-white transition-colors cursor-pointer"
              >
                {selectedSongIds.length === sortedSongs.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stitch Horizontal Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
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
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
                isActive
                  ? 'bg-[#9d4edd] text-white border-[#9d4edd] shadow-[0_2px_12px_rgba(157,78,221,0.35)] font-bold'
                  : 'bg-[#1c1b22] text-[#d0c2d5] border-white/[0.06] hover:bg-[#201f26] hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-black/25 text-white' : 'bg-white/10 text-[#998d9e]'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stitch Pinned & Featured Collections Hub */}
      {librarySubTab === 'playlists' && !localSearch && (
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#e5e0eb] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f1fd]" />
              <span>Pinned Hub</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Liked Songs Tile */}
            <div
              onClick={() => setActivePlaylistId('smart-favorites')}
              className="p-4 rounded-2xl bg-gradient-to-br from-[#9d4edd] via-[#8433c4] to-[#242036] text-white flex flex-col justify-between shadow-xl cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden group border border-white/10"
            >
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-md">
                  <Heart size={24} className="fill-white text-white" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-black/40 text-[#00f1fd] text-[9px] font-bold">
                  FAVORITES
                </span>
              </div>
              <div className="relative z-10">
                <h4 className="text-base font-extrabold text-white">Liked Songs</h4>
                <p className="text-xs text-white/80 mt-0.5">
                  {likedCount} tracks • Auto-sync
                </p>
              </div>
            </div>

            {/* Offline Cache Sanctuary Tile */}
            <div
              onClick={() => setLibrarySubTab('downloads')}
              className="p-4 rounded-2xl bg-[#1c1b22] hover:bg-[#201f26] border border-white/[0.08] text-white flex flex-col justify-between shadow-lg cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden group"
            >
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#2a2931] flex items-center justify-center text-[#00f1fd] shadow-md">
                  <Download size={24} />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#00f1fd]/15 text-[#00f1fd] text-[9px] font-bold">
                  OFFLINE
                </span>
              </div>
              <div className="relative z-10">
                <h4 className="text-base font-extrabold text-[#e5e0eb]">Downloaded Cache</h4>
                <p className="text-xs text-[#998d9e] mt-0.5">
                  {downloadedSongIds.size} tracks • Screen-off ready
                </p>
              </div>
            </div>

            {/* Smart Mix: Recently Played Tile */}
            <div
              onClick={() => setActivePlaylistId('smart-recent')}
              className="p-4 rounded-2xl bg-[#1c1b22] hover:bg-[#201f26] border border-white/[0.08] text-white flex flex-col justify-between shadow-lg cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden group"
            >
              <div className="flex items-start justify-between relative z-10 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#2a2931] flex items-center justify-center text-[#e0b6ff] shadow-md">
                  <Sparkles size={24} className="text-[#e0b6ff] animate-pulse" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#9d4edd]/20 text-[#e0b6ff] text-[9px] font-bold">
                  SMART MIX
                </span>
              </div>
              <div className="relative z-10">
                <h4 className="text-base font-extrabold text-[#e5e0eb]">Recently Played</h4>
                <p className="text-xs text-[#998d9e] mt-0.5">
                  Continuous session history
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Search & Filter Toolbar */}
      {['songs', 'artists', 'albums', 'playlists'].includes(librarySubTab) && (
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Filter Input */}
            <div className="relative w-full md:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#998d9e] pointer-events-none" />
              <input
                type="search"
                name="aura_library_filter"
                id="aura_library_filter"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={
                  librarySubTab === 'artists'
                    ? `Filter ${artists.length} artists...`
                    : librarySubTab === 'albums'
                    ? `Filter ${albums.length} albums...`
                    : librarySubTab === 'playlists'
                    ? `Filter ${playlists.length} playlists...`
                    : 'Search tracks, artists, albums...'
                }
                className="w-full pl-9 pr-8 py-2 bg-[#1c1b22] border border-white/[0.08] rounded-full text-xs text-[#e5e0eb] placeholder-[#998d9e] focus:outline-none focus:border-[#9d4edd]/60 transition-all"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#998d9e] hover:text-white p-0.5 cursor-pointer"
                  title="Clear filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort & Grid/List Controls */}
            {librarySubTab === 'songs' && (
              <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
                <div className="flex items-center gap-1 bg-[#1c1b22] border border-white/[0.08] rounded-full px-3 py-1.5 text-xs text-[#d0c2d5]">
                  <button
                    onClick={toggleSortDirection}
                    className="p-1 text-[#998d9e] hover:text-white rounded transition-colors cursor-pointer"
                    title={sortAscending ? 'Sort Ascending' : 'Sort Descending'}
                  >
                    <ArrowUpDown size={13} className={sortAscending ? 'text-[#00f1fd] rotate-180 transition-transform' : 'transition-transform'} />
                  </button>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="bg-transparent text-[#d0c2d5] focus:outline-none cursor-pointer pr-1 text-xs"
                  >
                    <option value="recent" className="bg-[#1c1b22]">Date Added</option>
                    <option value="title" className="bg-[#1c1b22]">Title</option>
                    <option value="artist" className="bg-[#1c1b22]">Artist</option>
                    <option value="album" className="bg-[#1c1b22]">Album</option>
                    <option value="duration" className="bg-[#1c1b22]">Duration</option>
                    <option value="bitrate" className="bg-[#1c1b22]">Bitrate</option>
                    <option value="mostPlayed" className="bg-[#1c1b22]">Most Played</option>
                  </select>
                </div>

                <div className="flex items-center bg-[#1c1b22] border border-white/[0.08] rounded-full p-0.5">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      viewMode === 'list' ? 'bg-[#9d4edd] text-white' : 'text-[#998d9e] hover:text-white'
                    }`}
                    title="List View"
                  >
                    <LayoutList size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      viewMode === 'grid' ? 'bg-[#9d4edd] text-white' : 'text-[#998d9e] hover:text-white'
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Filter Pills Bar */}
          {librarySubTab === 'songs' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  favoritesOnly
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                    : 'bg-[#1c1b22] text-[#998d9e] border-white/[0.06] hover:text-white'
                }`}
              >
                <Heart size={12} className={favoritesOnly ? 'fill-rose-400 text-rose-400' : ''} />
                <span>Favorites Only</span>
              </button>

              <button
                onClick={() => setHighBitrateOnly(!highBitrateOnly)}
                className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap ${
                  highBitrateOnly
                    ? 'bg-[#00f1fd]/20 text-[#00f1fd] border-[#00f1fd]/40 shadow-sm'
                    : 'bg-[#1c1b22] text-[#998d9e] border-white/[0.06] hover:text-white'
                }`}
              >
                <Sparkles size={12} />
                <span>320k Studio Master</span>
              </button>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1 rounded-full text-[#998d9e] hover:text-rose-400 bg-[#1c1b22] transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="Reset all active filters"
                >
                  <X size={12} />
                  <span>Reset</span>
                </button>
              )}

              <span className="text-[11px] text-[#998d9e] ml-auto whitespace-nowrap pl-2">
                Showing {sortedSongs.length} of {sourceSongs.length}
              </span>
            </div>
          )}
        </div>
      )}

      {/* SUB TAB 1: SONGS */}
      {librarySubTab === 'songs' && (
        <>
          {sortedSongs.length === 0 ? (
            <div className="py-16 text-center text-[#998d9e]">
              <p className="text-sm font-semibold text-[#e5e0eb]">No cloud tracks match your current filter</p>
              <button
                onClick={clearFilters}
                className="mt-3 px-4 py-2 rounded-full bg-[#9d4edd] text-white text-xs font-semibold cursor-pointer shadow-md"
              >
                Clear all filters
              </button>
            </div>
          ) : viewMode === 'list' ? (
            <div>
              <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_minmax(120px,1.5fr)_auto] lg:grid-cols-[auto_1fr_minmax(140px,1.5fr)_minmax(100px,1fr)_auto] items-center gap-3 md:gap-4 px-3 sm:px-4 py-2 border-b border-white/[0.06] text-xs font-semibold text-[#998d9e] uppercase tracking-wider mb-2">
                <div className="w-6 text-center">#</div>
                <div>Title</div>
                <div className="hidden md:block">Album</div>
                <div className="hidden lg:block">Date added</div>
                <div className="w-9 text-right flex justify-end">
                  <Clock size={14} />
                </div>
              </div>
              <VirtualSongList
                songs={sortedSongs}
                playlistContext={sortedSongs}
                isSelectMode={isSelectMode}
                selectedSongIds={selectedSongIds}
                onToggleSelect={toggleSelectSong}
                itemHeight={56}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
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
                    className={`group p-3 rounded-2xl relative transition-all cursor-pointer border flex flex-col justify-between ${
                      selectedSongIds.includes(song.id)
                        ? 'border-[#9d4edd] bg-[#9d4edd]/15 shadow-lg'
                        : isCurrent
                        ? 'border-[#9d4edd]/50 bg-[#242036]'
                        : 'bg-[#1c1b22] border-white/[0.06] hover:border-[#9d4edd]/30 hover:bg-[#201f26]'
                    }`}
                  >
                    {isSelectMode && (
                      <div className="absolute top-4 right-4 z-20">
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                            selectedSongIds.includes(song.id)
                              ? 'bg-[#9d4edd] border-[#9d4edd] text-white'
                              : 'bg-black/70 border-white/30 text-transparent'
                          }`}
                        >
                          <CheckSquare size={14} />
                        </div>
                      </div>
                    )}

                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-[#14121a] group">
                      <Artwork
                        src={song.coverArt || song.artwork}
                        title={song.title}
                        artist={song.artist}
                        size="xl"
                        className="w-full h-full object-cover"
                      />

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

                      <div
                        className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center transition-opacity z-10 ${
                          isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] text-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform">
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

                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold truncate ${isCurrent ? 'text-[#00f1fd]' : 'text-[#e5e0eb] group-hover:text-white'} transition-colors`}>
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-[#998d9e] truncate mt-0.5">
                        {song.artist && song.artist !== 'Not set' ? song.artist : 'Cloud Artist'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-[#998d9e] font-mono mt-1.5 pt-1 border-t border-white/[0.06]">
                        <span>{formatTime(song.duration)}</span>
                        <span>{song.bitrate || 320}k</span>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {filteredAlbums.map((alb) => {
            const albumSongs = sourceSongs.filter((s: Song) => s.album === alb.title);
            return (
              <div
                key={alb.id}
                onClick={() => {
                  setLocalSearch(alb.title);
                  setLibrarySubTab('songs');
                }}
                className="group p-3.5 rounded-2xl bg-[#1c1b22] hover:bg-[#201f26] border border-white/[0.06] hover:border-[#9d4edd]/30 transition-all cursor-pointer relative"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5">
                  <Artwork src={alb.coverArt} title={alb.title} artist={alb.artist} size="lg" className="w-full h-full object-cover" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (albumSongs.length > 0) playSong(albumSongs[0], albumSongs);
                    }}
                    className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110 active:scale-95 z-10 cursor-pointer"
                    title={`Play ${alb.title}`}
                  >
                    <Play size={16} className="fill-white ml-0.5" />
                  </button>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#e5e0eb] group-hover:text-[#00f1fd] transition-colors truncate">
                    {alb.title}
                  </h4>
                  <p className="text-xs text-[#998d9e] truncate mt-0.5">{alb.artist}</p>
                  <p className="text-[11px] text-[#998d9e] mt-1">{alb.songCount} songs</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB TAB 3: ARTISTS */}
      {librarySubTab === 'artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {filteredArtists.map((art) => {
            const normArt = art.name.toLowerCase().replace(/[.\s_\-,]+/g, '');
            const artistSongs = sourceSongs.filter((s: Song) => {
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
                className="group p-4 rounded-2xl bg-[#1c1b22] hover:bg-[#201f26] border border-white/[0.06] hover:border-[#9d4edd]/30 flex flex-col items-center text-center transition-all cursor-pointer relative"
              >
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden shadow-xl mb-3 p-0.5 bg-gradient-to-tr from-[#9d4edd]/30 to-[#00f1fd]/30 group-hover:from-[#9d4edd] group-hover:to-[#00f1fd] transition-all">
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#14121a]">
                    {artistImg ? (
                      <img
                        src={artistImg}
                        alt={art.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-[#e0b6ff]">
                        {art.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (artistSongs.length > 0) playSong(artistSongs[0], artistSongs);
                    }}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110 active:scale-95 z-10 cursor-pointer"
                    title={`Play ${art.name}`}
                  >
                    <Play size={14} className="fill-white ml-0.5" />
                  </button>
                </div>

                <h4 className="text-sm font-bold text-[#e5e0eb] group-hover:text-[#00f1fd] transition-colors truncate w-full">
                  {art.name}
                </h4>
                <p className="text-xs text-[#998d9e] mt-0.5 truncate w-full">
                  {art.songCount} {art.songCount === 1 ? 'track' : 'tracks'}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB TAB 4: PLAYLISTS */}
      {librarySubTab === 'playlists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-[#998d9e] font-medium">
              {filteredPlaylists.length + 1} cloud playlists in library
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1c1b22] hover:bg-[#201f26] text-[#00f1fd] border border-[#00f1fd]/30 text-xs font-semibold transition-all cursor-pointer"
                title="Import from Spotify / YouTube"
              >
                <UploadCloud size={14} />
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
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#9d4edd] to-[#00f1fd] text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                title="Create New Playlist"
              >
                <Plus size={14} />
                <span>New Playlist</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {/* Liked Songs Special Card */}
            {(!localSearch || 'liked songs'.includes(localSearch.toLowerCase())) && (
              <div
                onClick={() => setActivePlaylistId('smart-favorites')}
                className="p-4 rounded-2xl bg-gradient-to-br from-[#9d4edd] via-[#8433c4] to-[#242036] text-white flex flex-col justify-between aspect-square cursor-pointer shadow-xl hover:scale-[1.02] transition-all relative overflow-hidden group border border-white/10"
              >
                <div className="pt-2">
                  <Heart size={32} className="fill-white text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white">Liked Songs</h4>
                  <p className="text-xs text-white/80 font-medium mt-1">
                    {likedCount} liked cloud tracks
                  </p>
                </div>
              </div>
            )}

            {filteredPlaylists.map((pl) => {
              const plSongs = getPlaylistSongs(pl);
              return (
                <div
                  key={pl.id}
                  onClick={() => setActivePlaylistId(pl.id)}
                  className="group p-3.5 rounded-2xl bg-[#1c1b22] hover:bg-[#201f26] border border-white/[0.06] hover:border-[#9d4edd]/30 transition-all cursor-pointer relative"
                >
                  <div className="relative w-full aspect-square rounded-xl bg-[#14121a] overflow-hidden shadow-md mb-2.5">
                    {pl.coverArt ? (
                      <img
                        src={pl.coverArt}
                        alt={pl.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#9d4edd] via-[#8433c4] to-[#14121a] flex items-center justify-center text-white">
                        <ListMusic size={32} />
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (plSongs.length > 0) playSong(plSongs[0], plSongs);
                      }}
                      className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110 active:scale-95 z-10 cursor-pointer"
                      title={`Play ${pl.name}`}
                    >
                      <Play size={16} className="fill-white ml-0.5" />
                    </button>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#e5e0eb] group-hover:text-[#00f1fd] transition-colors truncate">
                      {pl.name}
                    </h4>
                    <p className="text-xs text-[#998d9e] truncate mt-0.5">{pl.description || 'Cloud Playlist'}</p>
                    <p className="text-[11px] text-[#998d9e] mt-1 font-mono">{plSongs.length} songs</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB TAB 5: DOWNLOADS (OFFLINE CACHE) */}
      {librarySubTab === 'downloads' && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#1c1b22] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-36 h-36 bg-[#00f1fd]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-4 min-w-0 z-10">
              <div className="w-12 h-12 rounded-2xl bg-[#00f1fd]/15 border border-[#00f1fd]/30 flex items-center justify-center text-[#00f1fd] shrink-0 shadow-lg">
                <HardDrive size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-[#e5e0eb]">Downloaded Cache Sanctuary</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00f1fd]/15 text-[#00f1fd] border border-[#00f1fd]/30">
                    Offline Ready
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#998d9e] mt-0.5">
                  {downloadedSongs.length} tracks cached • {formatBytes(offlineStorage.totalBytes)} used
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end z-10">
              {downloadedSongs.length > 0 && (
                <button
                  onClick={() => setIsClearConfirmOpen(true)}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Trash2 size={14} />
                  <span>Clear Downloads</span>
                </button>
              )}
            </div>
          </div>

          {downloadedSongs.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-[#1c1b22] border border-white/[0.06] text-center flex flex-col items-center justify-center max-w-lg mx-auto my-8">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#998d9e] mb-4">
                <Download size={28} />
              </div>
              <h4 className="text-lg font-bold text-white mb-1.5">No Downloaded Songs Yet</h4>
              <p className="text-xs sm:text-sm text-[#998d9e] max-w-sm leading-relaxed mb-6">
                Tap the download icon on any streaming song to cache it for screen-off and offline listening.
              </p>
              <button
                onClick={() => setLibrarySubTab('songs')}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#9d4edd] to-[#00f1fd] text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Browse Cloud Library
              </button>
            </div>
          ) : viewMode === 'list' ? (
            <VirtualSongList
              songs={filteredDownloadedSongs}
              playlistContext={filteredDownloadedSongs}
              itemHeight={56}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
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
                    className={`group p-3 rounded-2xl relative transition-all cursor-pointer border flex flex-col justify-between ${
                      isCurrent
                        ? 'border-[#00f1fd]/50 bg-[#242036]'
                        : 'bg-[#1c1b22] border-white/[0.06] hover:border-[#00f1fd]/30'
                    }`}
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5">
                      <Artwork
                        src={song.coverArt || song.artwork}
                        title={song.title}
                        artist={song.artist}
                        size="md"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#e5e0eb] truncate group-hover:text-[#00f1fd] transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-[#998d9e] truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isClearConfirmOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#1c1b22] border border-white/[0.08] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Clear All Offline Downloads?</h3>
                    <p className="text-xs text-[#998d9e]">Free up cached device storage</p>
                  </div>
                </div>

                <p className="text-xs text-[#d0c2d5] leading-relaxed">
                  This will remove all downloaded audio files ({formatBytes(offlineStorage.totalBytes)}) from your device cache. Songs will remain in your cloud library.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setIsClearConfirmOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await clearAllDownloads();
                      setIsClearConfirmOpen(false);
                    }}
                    className="px-4 py-2 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg cursor-pointer"
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

      {/* Universal Import Playlist Modal */}
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
