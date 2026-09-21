import React, { useState } from 'react';
import { Play, Heart, PlusCircle, Check, ListPlus, Download, CheckCircle2, Loader2, MoreHorizontal } from 'lucide-react';
import { Song } from '../../types/music';
import { formatTime } from '../../utils/formatters';
import { Artwork } from './Artwork';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';

interface SongRowProps {
  song: Song;
  index: number;
  playlistContext?: Song[];
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  showAlbum?: boolean;
  showDateAdded?: boolean;
}

function formatDateAdded(timestamp?: number): string {
  if (!timestamp) return 'Recently';
  const now = Date.now();
  const diffDays = Math.floor((now - timestamp) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SongRowComponent: React.FC<SongRowProps> = ({
  song,
  index,
  playlistContext,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  showAlbum = true,
  showDateAdded = true
}) => {
  const isCurrent = usePlayerStore((s) => s.currentSong?.id === song.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying && s.currentSong?.id === song.id);
  const playSong = usePlayerStore((s) => s.playSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const addToQueueNext = usePlayerStore((s) => s.addToQueueNext);

  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const downloadTrack = useLibraryStore((s) => s.downloadTrack);
  const deleteDownloadedTrack = useLibraryStore((s) => s.deleteDownloadedTrack);
  const isDownloaded = useLibraryStore((s) => s.downloadedSongIds.has(song.id) || Boolean(song.isDownloaded));
  const dlState = useLibraryStore((s) => s.downloadingStates[song.id]);
  const isDownloading = dlState?.status === 'downloading';

  const isFav = useLibraryStore((s) => {
    const libSong = s.songs.find((item) => item.id === song.id);
    return libSong ? libSong.isFavorite : Boolean(song.isFavorite);
  });

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on any outside click
  React.useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleRowClick = () => {
    if (isSelectMode && onToggleSelect) {
      onToggleSelect(song.id);
    } else {
      if (isCurrent) {
        togglePlay();
      } else {
        playSong(song, playlistContext);
      }
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelect) {
      onToggleSelect(song.id);
    }
  };

  return (
    <div
      onClick={handleRowClick}
      className={`group grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_minmax(120px,1.5fr)_auto] lg:grid-cols-[auto_1fr_minmax(140px,1.5fr)_minmax(100px,1fr)_auto] items-center gap-3 md:gap-4 px-3 sm:px-4 py-2 rounded-xl transition-all select-none cursor-pointer border ${
        isSelected
          ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
          : isCurrent
          ? 'bg-white/10 border-emerald-500/20 text-[#1ed760]'
          : 'border-transparent hover:bg-white/10 text-neutral-300'
      }`}
    >
      {/* 1. Track Number / Play Indicator */}
      <div className="w-6 text-center text-xs font-mono text-neutral-400 shrink-0 flex items-center justify-center">
        {isSelectMode ? (
          <div
            onClick={handleCheckboxClick}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-[#1ed760] border-[#1ed760] text-black shadow-sm'
                : 'border-white/20 hover:border-white/40 bg-black/20'
            }`}
          >
            {isSelected && <Check size={12} strokeWidth={3} />}
          </div>
        ) : isCurrent && isPlaying ? (
          <div className="flex items-end gap-0.5 h-3.5" title="Playing">
            <span className="w-1 bg-[#1ed760] h-full animate-pulse" />
            <span className="w-1 bg-[#1ed760] h-2/3 animate-bounce" />
            <span className="w-1 bg-[#1ed760] h-3/4 animate-pulse" />
          </div>
        ) : (
          <>
            <span className={`group-hover:hidden ${isCurrent ? 'text-[#1ed760] font-bold' : 'text-neutral-400'}`}>
              {index + 1}
            </span>
            {isCurrent && !isPlaying ? (
              <Play size={13} className="fill-[#1ed760] text-[#1ed760]" />
            ) : (
              <Play size={13} className="hidden group-hover:block fill-white text-white" />
            )}
          </>
        )}
      </div>

      {/* 2. Artwork + Title & Artist */}
      <div className="flex items-center gap-3 min-w-0">
        <Artwork src={song.coverArt || song.artwork} title={song.title} artist={song.artist} size="sm" />
        <div className="min-w-0 flex-1">
          <h4 className={`text-sm font-medium truncate ${isCurrent ? 'text-[#1ed760]' : 'text-white group-hover:text-white'}`}>
            {song.title}
          </h4>
          <p className="text-xs text-neutral-400 truncate mt-0.5 group-hover:text-neutral-300">
            {song.artist && song.artist !== 'Not set' ? song.artist : 'Unknown Artist'}
          </p>
        </div>
      </div>

      {/* 3. Album (Clean Spotify column - hidden on small screens) */}
      {showAlbum && (
        <div className="hidden md:block min-w-0 pr-2">
          <p className="text-xs text-neutral-400 truncate group-hover:text-neutral-300">
            {song.album && song.album !== 'Not set' && song.album !== 'JioSaavn Studio Master'
              ? song.album
              : 'Single'}
          </p>
        </div>
      )}

      {/* 4. Date Added (Clean Spotify column - hidden on small/medium screens) */}
      {showDateAdded && (
        <div className="hidden lg:block min-w-0 pr-2">
          <p className="text-xs text-neutral-400 font-mono truncate">
            {formatDateAdded(song.dateAdded)}
          </p>
        </div>
      )}

      {/* 5. Actions & Duration */}
      <div className="flex items-center justify-end gap-2.5 shrink-0">
        {/* Offline downloaded badge icon */}
        {isDownloaded && (
          <span title="Downloaded for offline playback" className="text-[#1ed760]">
            <CheckCircle2 size={14} />
          </span>
        )}

        {/* Favorite / Heart Button */}
        {!isSelectMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(song.id, song);
            }}
            className={`p-1 transition-colors cursor-pointer ${
              isFav ? 'text-[#1ed760] opacity-100' : 'text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-white'
            }`}
            title={isFav ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          >
            <Heart size={15} className={isFav ? 'fill-[#1ed760]' : ''} />
          </button>
        )}

        {/* Duration */}
        <span className="text-xs font-mono text-neutral-400 tabular-nums w-9 text-right">
          {formatTime(song.duration)}
        </span>

        {/* More Options / Context Actions */}
        {!isSelectMode && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="p-1 rounded-md text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="More options"
            >
              <MoreHorizontal size={16} />
            </button>

            {showDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-44 py-1.5 rounded-xl bg-neutral-900 border border-white/10 shadow-2xl backdrop-blur-xl z-50 text-xs text-neutral-300"
              >
                <button
                  onClick={() => {
                    addToQueueNext(song);
                    setShowDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                >
                  <PlusCircle size={14} />
                  <span>Play Next in Queue</span>
                </button>
                <button
                  onClick={() => {
                    setIsPlaylistModalOpen(true);
                    setShowDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                >
                  <ListPlus size={14} />
                  <span>Add to Playlist</span>
                </button>
                <button
                  onClick={() => {
                    if (isDownloaded) {
                      deleteDownloadedTrack(song.id);
                    } else {
                      downloadTrack(song);
                    }
                    setShowDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-indigo-400" />
                      <span>Downloading...</span>
                    </>
                  ) : isDownloaded ? (
                    <>
                      <CheckCircle2 size={14} className="text-[#1ed760]" />
                      <span>Remove Download</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Download Offline</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instant Add-to-Playlist Modal: only mounted when open */}
      {isPlaylistModalOpen && (
        <AddToPlaylistModal
          isOpen={true}
          onClose={() => setIsPlaylistModalOpen(false)}
          songIds={[song.id]}
        />
      )}
    </div>
  );
};

export const SongRow = React.memo(SongRowComponent);
