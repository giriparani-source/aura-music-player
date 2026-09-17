import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  ListPlus,
  X,
  Clock,
  WifiOff,
  Check,
  Heart
} from 'lucide-react';
import { InbuiltPlaylist, inbuiltPlaylistsService } from '../../services/inbuiltPlaylistsService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { formatTime } from '../../utils/formatters';
import { Artwork } from './Artwork';

interface InbuiltPlaylistModalProps {
  playlist: InbuiltPlaylist | null;
  onClose: () => void;
}

export const InbuiltPlaylistModal: React.FC<InbuiltPlaylistModalProps> = ({
  playlist,
  onClose
}) => {
  const { currentSong, isPlaying, isShuffle, togglePlay, toggleShuffle, playSong, playBatch, addMultipleToQueue } = usePlayerStore();
  const { songs: localSongs, toggleFavorite } = useLibraryStore();

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [addedQueueNotice, setAddedQueueNotice] = useState<boolean>(false);

  // Synchronize browser history for mobile hardware Back-Button handling (Gap 2)
  useEffect(() => {
    if (!playlist) return;

    window.history.pushState({ modal: `playlist_${playlist.id}` }, '');

    const handlePopState = () => {
      onClose();
    };

    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    // Escape key listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [playlist, onClose]);

  if (!playlist) return null;

  // Match local songs if available for offline resilience
  const resolvedTracks = inbuiltPlaylistsService.matchLocalSongs(playlist, localSongs);
  const totalSeconds = resolvedTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  const isPlaylistActive =
    currentSong && resolvedTracks.some((t) => t.id === currentSong.id);

  // Play All: Clears queue, plays Track #1, enqueues remaining tracks
  const handlePlayAll = async () => {
    if (resolvedTracks.length === 0) return;
    if (isPlaylistActive && isPlaying) {
      togglePlay();
      return;
    }
    await playBatch(resolvedTracks);
  };

  // Shuffle Play: Enable shuffle mode in the store and start from a random song
  const handleShufflePlay = async () => {
    if (resolvedTracks.length === 0) return;
    // Step 1: Ensure shuffle mode is ON BEFORE calling playSong so the store
    //         immediately builds the shuffledQueueOrder from the random start index.
    if (!isShuffle) {
      toggleShuffle();
    }
    // Step 2: Pick a random starting song and call playSong with the full playlist
    //         as the customQueue. The updated store logic will generate shuffledQueueOrder
    //         since isShuffle is now true, enabling correct Next/Prev navigation.
    const randomStart = Math.floor(Math.random() * resolvedTracks.length);
    const startSong = resolvedTracks[randomStart];
    await playSong(startSong, resolvedTracks);
  };

  // Add to Queue: Appends all tracks to current queue without interrupting playback
  const handleAddToQueue = () => {
    addMultipleToQueue(resolvedTracks);
    setAddedQueueNotice(true);
    setTimeout(() => setAddedQueueNotice(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0e1118]/95 border border-white/10 shadow-2xl overflow-hidden">
        {/* Ambient Glow Backdrop */}
        <div
          className={`absolute top-0 inset-x-0 h-64 bg-gradient-to-b ${playlist.gradient} opacity-50 blur-3xl pointer-events-none`}
        />

        {/* Header / Banner Area */}
        <div className="relative p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-end gap-6 border-b border-white/10 shrink-0 bg-white/[0.02]">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-400 hover:text-white transition-all cursor-pointer z-10"
            title="Close (Esc / Back)"
          >
            <X size={20} />
          </button>

          {/* Large 1:1 Cover Art */}
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 shrink-0 border border-white/10 group relative">
            <img
              src={playlist.coverArt}
              alt={playlist.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
          </div>

          {/* Playlist Info */}
          <div className="flex-1 min-w-0 text-center md:text-left space-y-2">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-white/90 border border-white/15">
                Curated Inbuilt Playlist
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                HD Audio
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight truncate">
              {playlist.title}
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 line-clamp-2 max-w-xl">
              {playlist.description}
            </p>

            <div className="flex items-center justify-center md:justify-start gap-3 text-xs font-mono text-neutral-400 pt-1">
              <span>{playlist.songCount} songs</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {totalMinutes} mins
              </span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">100% Streamable</span>
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="p-4 sm:px-8 border-b border-white/5 bg-white/[0.01] flex items-center justify-between gap-4 shrink-0 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Big Emerald Green Play Button */}
            <button
              onClick={handlePlayAll}
              className="px-6 py-3 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 text-black font-extrabold text-xs sm:text-sm shadow-xl shadow-[#1ed760]/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isPlaylistActive && isPlaying ? (
                <>
                  <Pause size={18} className="fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play size={18} className="fill-current ml-0.5" />
                  <span>Play All</span>
                </>
              )}
            </button>

            {/* Shuffle Play */}
            <button
              onClick={handleShufflePlay}
              className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 hover:scale-105 transition-all cursor-pointer"
              title="Shuffle Play"
            >
              <Shuffle size={18} />
            </button>

            {/* Add to Queue */}
            <button
              onClick={handleAddToQueue}
              className="px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Append to Current Queue"
            >
              {addedQueueNotice ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400">Added to Queue!</span>
                </>
              ) : (
                <>
                  <ListPlus size={15} />
                  <span>Add to Queue</span>
                </>
              )}
            </button>
          </div>

          {/* Network Resilience Status Indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold">
              <WifiOff size={13} />
              <span>Offline Mode: Playing cached or local audio</span>
            </div>
          )}
        </div>

        {/* Tracklist Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-1.5 scrollbar-thin">
          {/* Spotify-style Column Headers */}
          <div className="hidden sm:flex items-center justify-between gap-3 px-3.5 pb-2 text-[11px] font-mono text-neutral-500 uppercase tracking-wider border-b border-white/5 mb-2">
            <div className="w-8 text-center">#</div>
            <div className="flex-1">Title</div>
            <div className="hidden md:block w-48">Album</div>
            <div className="hidden sm:block w-12 text-center">Format</div>
            <div className="flex items-center justify-end gap-3 w-20 pr-1">
              <Clock size={13} />
            </div>
          </div>

          {resolvedTracks.map((song, idx) => {
            const isCurrentTrack = currentSong?.id === song.id;

            return (
              <div
                key={song.id || idx}
                onClick={() => {
                  if (currentSong?.id === song.id) {
                    togglePlay();
                  } else {
                    playSong(song, resolvedTracks);
                  }
                }}
                className={`group flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl transition-all cursor-pointer border select-none ${
                  isCurrentTrack
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                    : 'bg-white/[0.02] hover:bg-white/[0.06] border-transparent hover:border-white/5 text-neutral-300'
                }`}
              >
                {/* Index & Play Icon */}
                <div className="w-8 text-center text-xs font-mono text-neutral-500 shrink-0 flex items-center justify-center">
                  {isCurrentTrack && isPlaying ? (
                    <div className="flex items-end gap-0.5 h-3.5">
                      <span className="w-1 bg-[#1ed760] h-full animate-pulse" />
                      <span className="w-1 bg-[#1ed760] h-2/3 animate-bounce" />
                      <span className="w-1 bg-[#1ed760] h-3/4 animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <span className="group-hover:hidden font-bold">{idx + 1}</span>
                      <Play size={14} className="hidden group-hover:block fill-current text-white" />
                    </>
                  )}
                </div>

                {/* Cover Art */}
                <Artwork
                  src={song.coverArt || song.artwork}
                  title={song.title}
                  artist={song.artist}
                  size="sm"
                />

                {/* Title & Artist */}
                <div className="flex-1 min-w-0 pr-2">
                  <h4
                    className={`text-sm font-bold truncate ${
                      isCurrentTrack ? 'text-[#1ed760]' : 'text-white group-hover:text-indigo-200'
                    }`}
                  >
                    {song.title}
                  </h4>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">
                    {song.artist}
                  </p>
                </div>

                {/* Album Name (hidden on small screens) */}
                <div className="hidden md:block w-48 text-xs text-neutral-400 truncate">
                  {song.album || 'Single'}
                </div>

                {/* Bitrate Badge */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    320k
                  </span>
                </div>

                {/* Duration & Favorite */}
                <div className="flex items-center justify-end gap-3 w-20 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(song.id, song);
                    }}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                      song.isFavorite ? 'text-rose-500' : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    <Heart size={15} className={song.isFavorite ? 'fill-current' : ''} />
                  </button>

                  <span className="text-xs font-mono text-neutral-400 tabular-nums">
                    {formatTime(song.duration)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
