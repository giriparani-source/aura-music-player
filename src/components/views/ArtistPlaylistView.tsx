import React, { useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  ListPlus,
  ArrowLeft,
  Clock,
  Music2,
  WifiOff,
  Check,
  CheckCircle2,
  HardDrive,
  Disc3
} from 'lucide-react';
import { TamilArtist, ARTIST_CATEGORY_LABELS } from '../../services/tamilArtistsData';
import { artistPlaylistService, ArtistPlaylist } from '../../services/artistPlaylistService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { SongRow } from '../common/SongRow';


interface ArtistPlaylistViewProps {
  artist: TamilArtist;
  onBack: () => void;
}

export const ArtistPlaylistView: React.FC<ArtistPlaylistViewProps> = ({
  artist,
  onBack
}) => {
  const { songs: localSongs } = useLibraryStore();
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const playSong = usePlayerStore((s) => s.playSong);
  const playBatch = usePlayerStore((s) => s.playBatch);
  const addMultipleToQueue = usePlayerStore((s) => s.addMultipleToQueue);

  const [playlist, setPlaylist] = useState<ArtistPlaylist | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasImageError, setHasImageError] = useState<boolean>(false);
  const [addedQueueNotice, setAddedQueueNotice] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Synchronize browser history and hardware back button
  useEffect(() => {
    window.history.pushState({ view: `artist_${artist.id}` }, '');

    const handlePopState = () => {
      onBack();
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [artist.id, onBack]);

  // Load real artist playlist on demand
  useEffect(() => {
    let isMounted = true;

    artistPlaylistService
      .getArtistPlaylist(artist, localSongs)
      .then((data) => {
        if (isMounted) {
          setPlaylist(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error(`[ArtistPlaylistView] Failed to load playlist for ${artist.name}:`, err);
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [artist, localSongs]);

  const tracks = useMemo(() => playlist?.tracks || [], [playlist]);

  const isCurrentPlaylistPlaying = Boolean(
    currentSong &&
      isPlaying &&
      tracks.some((t) => t.id === currentSong.id)
  );

  // Accurate duration metrics
  const totalMinutes = useMemo(() => {
    const totalSeconds = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
    return Math.round(totalSeconds / 60);
  }, [tracks]);

  // Quality badge: only claim 320kbps when actual track data verifies it
  const qualityBadge = useMemo(() => {
    if (tracks.length === 0) return null;
    const highQualityCount = tracks.filter(
      (t) => (t.bitrate && t.bitrate >= 320) || t.isSaavn
    ).length;

    if (highQualityCount === tracks.length) {
      return { text: '320kbps Studio Master', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' };
    }
    if (highQualityCount > 0) {
      return { text: 'Studio Master & HD Stream', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' };
    }
    return { text: 'Standard Audio', color: 'bg-white/5 text-neutral-400 border-white/10' };
  }, [tracks]);

  // Play All action
  const handlePlayAll = async () => {
    if (tracks.length === 0) return;
    if (isCurrentPlaylistPlaying) {
      togglePlay();
      return;
    }
    await playBatch(tracks);
  };

  // Shuffle action
  const handleShufflePlay = async () => {
    if (tracks.length === 0) return;
    if (!isShuffle) {
      toggleShuffle();
    }
    const randomIndex = Math.floor(Math.random() * tracks.length);
    const startSong = tracks[randomIndex];
    await playSong(startSong, tracks);
  };

  // Add to Queue action
  const handleAddToQueue = () => {
    if (tracks.length === 0) return;
    addMultipleToQueue(tracks);
    setAddedQueueNotice(true);
    setTimeout(() => setAddedQueueNotice(false), 2000);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto select-none pb-28 animate-fade-in">
      {/* Top Sticky Navigation Bar */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/5">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
          title="Back to Top Tamil Music Directors & Legends"
        >
          <ArrowLeft size={16} />
          <span>Back to Artists</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-neutral-400 border border-white/10">
            {ARTIST_CATEGORY_LABELS[artist.category] || 'Tamil Artist'}
          </span>
          {!isOnline && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <WifiOff size={11} />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Hero Artist Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-6 sm:p-8 shadow-2xl">
        {/* Ambient Glow Backdrop */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-8">
          {/* Artist Portrait */}
          <div className="relative w-36 h-36 sm:w-48 sm:h-48 rounded-full overflow-hidden shadow-2xl ring-4 ring-white/10 shrink-0 bg-neutral-900 group">
            {hasImageError ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white p-4">
                <span className="text-3xl font-black text-indigo-300 tracking-wider">
                  {artist.name
                    .split(' ')
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </span>
                <span className="text-[10px] text-neutral-400 mt-1 uppercase tracking-widest">
                  {artist.category}
                </span>
              </div>
            ) : (
              <img
                src={artist.image}
                alt={artist.name}
                onError={() => setHasImageError(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}
          </div>

          {/* Artist Details */}
          <div className="flex-1 text-center md:text-left space-y-2.5 min-w-0">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="flex items-center gap-1 text-[11px] font-bold text-sky-400 tracking-wider uppercase">
                <CheckCircle2 size={13} className="fill-sky-400 text-black" />
                Aura Verified Artist
              </span>
              {qualityBadge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${qualityBadge.color}`}>
                  {qualityBadge.text}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight truncate drop-shadow-md">
              {artist.name}
            </h1>

            <p className="text-sm sm:text-base text-neutral-300 font-medium">
              {artist.subtitle}
            </p>

            {/* Metadata Stats */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs font-mono text-neutral-400 pt-1">
              <span className="text-white font-bold">
                {isLoading ? 'Finding tracks...' : `${tracks.length} Songs`}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={13} />
                {totalMinutes} mins
              </span>
              {playlist && (playlist.sourceBreakdown.local > 0 || playlist.sourceBreakdown.curated > 0) && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-neutral-300">
                    {playlist.sourceBreakdown.local > 0 && (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <HardDrive size={12} />
                        {playlist.sourceBreakdown.local} Local
                      </span>
                    )}
                    {playlist.sourceBreakdown.local > 0 && playlist.sourceBreakdown.curated > 0 && ' • '}
                    {playlist.sourceBreakdown.curated > 0 && (
                      <span className="text-indigo-300">
                        {playlist.sourceBreakdown.curated} Studio Curated
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Controls Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white/[0.02] border border-white/5 rounded-2xl p-3 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Play All Button */}
          <button
            onClick={handlePlayAll}
            disabled={isLoading || tracks.length === 0}
            className={`px-6 py-3 rounded-full font-extrabold text-xs sm:text-sm shadow-xl transition-all flex items-center gap-2 cursor-pointer ${
              isCurrentPlaylistPlaying
                ? 'bg-white text-black hover:scale-105'
                : 'bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 text-black shadow-[#1ed760]/20'
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            {isCurrentPlaylistPlaying ? (
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

          {/* Shuffle Button */}
          <button
            onClick={handleShufflePlay}
            disabled={isLoading || tracks.length === 0}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            title="Shuffle Play"
          >
            <Shuffle size={18} />
          </button>

          {/* Add to Queue Button */}
          <button
            onClick={handleAddToQueue}
            disabled={isLoading || tracks.length === 0}
            className="px-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            title="Add Entire Artist Collection to Queue"
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

        {/* Live Status Pill */}
        <div className="text-xs text-neutral-400 flex items-center gap-2">
          <Disc3 size={15} className={`text-indigo-400 ${isPlaying ? 'animate-spin' : ''}`} />
          <span>Aura Audio Pipeline Active</span>
        </div>
      </div>

      {/* Tracklist Container */}
      <div className="space-y-2">
        {isLoading ? (
          /* Loading Skeleton */
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3 text-neutral-400 text-xs font-mono">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span>Building {artist.name} playlist from local & studio master libraries...</span>
            </div>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-white/[0.02] border border-white/5 animate-pulse flex items-center px-4 gap-4"
              >
                <div className="w-6 h-4 bg-white/10 rounded" />
                <div className="w-10 h-10 bg-white/10 rounded-lg" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-white/10 rounded w-1/3" />
                  <div className="h-2.5 bg-white/5 rounded w-1/4" />
                </div>
                <div className="w-16 h-3 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : tracks.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-4 bg-white/[0.01] border border-white/5 rounded-3xl space-y-3">
            <Music2 size={40} className="mx-auto text-neutral-600" />
            <h3 className="text-base font-bold text-neutral-300">
              No playable songs found for this artist
            </h3>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">
              {!isOnline
                ? 'You are offline. Connect to the internet or add local songs for this artist to your music library.'
                : 'No matching songs were returned by the streaming and local library sources.'}
            </p>
            <button
              onClick={onBack}
              className="mt-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Back to Artists
            </button>
          </div>
        ) : (
          /* Real Usable Tracklist */
          <div className="space-y-1">
            {tracks.map((song, index) => (
              <SongRow
                key={song.id}
                song={song}
                index={index}
                playlistContext={tracks}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
