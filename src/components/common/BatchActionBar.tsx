import React from 'react';
import { Play, ListPlus, FolderPlus, Heart, X, CheckSquare } from 'lucide-react';
import { Song } from '../../types/music';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';

interface BatchActionBarProps {
  selectedSongIds: string[];
  songs: Song[];
  onClearSelection: () => void;
  onOpenPlaylistModal: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedSongIds,
  songs,
  onClearSelection,
  onOpenPlaylistModal
}) => {
  const { playBatch, addMultipleToQueue } = usePlayerStore();
  const { batchToggleFavorite } = useLibraryStore();

  if (selectedSongIds.length === 0) return null;

  const selectedSongs = songs.filter((s) => selectedSongIds.includes(s.id));
  const allFavorited = selectedSongs.every((s) => s.isFavorite);

  const handlePlaySelected = () => {
    if (selectedSongs.length > 0) {
      playBatch(selectedSongs);
    }
  };

  const handleQueueSelected = () => {
    if (selectedSongs.length > 0) {
      addMultipleToQueue(selectedSongs);
      onClearSelection();
    }
  };

  const handleToggleFavorite = async () => {
    await batchToggleFavorite(selectedSongIds, !allFavorited);
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-2 bg-[#161922]/95 border border-indigo-500/30 backdrop-blur-xl px-4 py-2.5 rounded-2xl shadow-2xl shadow-black/80">
        {/* Selection Count */}
        <div className="flex items-center gap-2 pr-2 border-r border-white/10 text-xs font-semibold text-white">
          <CheckSquare size={16} className="text-indigo-400" />
          <span>
            {selectedSongIds.length} <span className="hidden sm:inline">selected</span>
          </span>
        </div>

        {/* Play Batch */}
        <button
          onClick={handlePlaySelected}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
          title="Play all selected songs"
        >
          <Play size={13} className="fill-current" />
          <span className="hidden sm:inline">Play</span>
        </button>

        {/* Add to Queue */}
        <button
          onClick={handleQueueSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          title="Add all to queue"
        >
          <ListPlus size={14} />
          <span className="hidden sm:inline">Queue</span>
        </button>

        {/* Add to Playlist */}
        <button
          onClick={onOpenPlaylistModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          title="Add to playlist"
        >
          <FolderPlus size={14} />
          <span className="hidden sm:inline">Playlist</span>
        </button>

        {/* Favorite / Unfavorite */}
        <button
          onClick={handleToggleFavorite}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            allFavorited
              ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
              : 'bg-white/5 text-neutral-200 hover:text-white hover:bg-white/10'
          }`}
          title={allFavorited ? 'Remove all from favorites' : 'Add all to favorites'}
        >
          <Heart size={14} className={allFavorited ? 'fill-rose-400 text-rose-400' : ''} />
          <span className="hidden md:inline">{allFavorited ? 'Favorited' : 'Favorite'}</span>
        </button>

        {/* Clear Selection */}
        <button
          onClick={onClearSelection}
          className="p-1.5 ml-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title="Clear selection"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
