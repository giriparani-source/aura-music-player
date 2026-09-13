import React, { useState } from 'react';
import { Play, Heart, PlusCircle, Check, ListPlus } from 'lucide-react';
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
}

export const SongRow: React.FC<SongRowProps> = ({
  song,
  index,
  playlistContext,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect
}) => {
  const { currentSong, isPlaying, playSong, togglePlay, addToQueueNext } = usePlayerStore();
  const { songs: librarySongs, toggleFavorite } = useLibraryStore();
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);

  const isCurrent = currentSong?.id === song.id;
  const libSong = librarySongs.find((s) => s.id === song.id);
  const isFav = libSong ? libSong.isFavorite : (isCurrent ? currentSong.isFavorite : song.isFavorite);

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
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all select-none cursor-pointer border ${
        isSelected
          ? 'bg-indigo-600/15 border-indigo-500/40 text-white'
          : isCurrent
          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
          : 'border-transparent hover:bg-white/5 text-neutral-300'
      }`}
    >
      {/* Selection checkbox or Index/Play indicator */}
      <div className="w-7 text-center text-xs font-mono text-neutral-500 shrink-0 flex items-center justify-center">
        {isSelectMode ? (
          <div
            onClick={handleCheckboxClick}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/50'
                : 'border-white/20 hover:border-white/40 bg-black/20'
            }`}
          >
            {isSelected && <Check size={12} strokeWidth={3} />}
          </div>
        ) : isCurrent && isPlaying ? (
          <div className="flex items-end gap-0.5 h-3.5">
            <span className="w-1 bg-indigo-400 h-full animate-pulse" />
            <span className="w-1 bg-indigo-400 h-2/3 animate-bounce" />
            <span className="w-1 bg-indigo-400 h-3/4 animate-pulse" />
          </div>
        ) : (
          <>
            <span className="group-hover:hidden">{index + 1}</span>
            <Play size={14} className="hidden group-hover:block fill-current" />
          </>
        )}
      </div>

      {/* Artwork */}
      <Artwork src={song.coverArt || song.artwork} title={song.title} artist={song.artist} size="sm" />

      {/* Song details */}
      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : isCurrent ? 'text-indigo-300' : 'text-neutral-200'}`}>
          {song.title}
        </h4>
        <p className="text-xs text-neutral-400 truncate mt-0.5">
          {song.artist && song.artist !== 'Not set' ? song.artist : 'Local Artist'}{' '}
          {song.album && song.album !== 'Not set' ? `• ${song.album}` : ''}
        </p>
      </div>

      {/* Folder tag, JioSaavn badge, or Live Radio badge (hidden on mobile) */}
      {song.isLiveRadio ? (
        <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          Live FM
        </span>
      ) : song.isSaavn ? (
        <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          JioSaavn 320k
        </span>
      ) : song.isOnline ? (
        <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Cloud Stream
        </span>
      ) : song.folder ? (
        <span className="hidden md:inline-block px-2 py-0.5 text-[11px] font-medium rounded-full bg-white/5 text-neutral-400 border border-white/5 max-w-[130px] truncate">
          {song.folder}
        </span>
      ) : null}

      {/* Audio Bitrate / Format badge */}
      <div className="hidden sm:flex items-center gap-1.5">
        {song.bitrate && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              song.bitrate >= 320
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold'
                : 'bg-white/5 text-neutral-400'
            }`}
          >
            {song.bitrate}k
          </span>
        )}
        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">
          {song.format || 'MP3'}
        </span>
      </div>

      {/* Duration or LIVE indicator */}
      {song.isLiveRadio ? (
        <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20">
          LIVE
        </span>
      ) : (
        <span className="text-xs font-mono text-neutral-400 tabular-nums">
          {formatTime(song.duration)}
        </span>
      )}

      {/* Action buttons (only in non-selection mode) */}
      {!isSelectMode && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(song.id, song);
            }}
            className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
              isFav ? 'text-rose-500 opacity-100' : 'text-neutral-400'
            }`}
            title={isFav ? 'Remove from Favourites' : 'Add to Favourites'}
          >
            <Heart size={15} className={isFav ? 'fill-rose-500' : ''} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              addToQueueNext(song);
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Play Next"
          >
            <PlusCircle size={15} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsPlaylistModalOpen(true);
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Add to Playlist"
          >
            <ListPlus size={15} />
          </button>
        </div>
      )}

      {/* Instant Add-to-Playlist Modal */}
      <AddToPlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        songIds={[song.id]}
      />
    </div>
  );
};
