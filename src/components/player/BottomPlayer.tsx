import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Maximize2,
  Heart,
  Activity,
  FileText,
  Sliders,
  Mic2,
  Sparkles,
  Users
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useJamStore } from '../../store/useJamStore';
import { formatTime } from '../../utils/formatters';
import { Artwork } from '../common/Artwork';

export const BottomPlayer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    queue,
    isQueueOpen,
    togglePlay,
    nextSong,
    previousSong,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    setNowPlayingOpen,
    setQueueOpen,
    openWithTab,
    isKaraoke,
    karaokeDepth,
    spatialPreset,
    toggleKaraoke,
    setAiAssistantOpen
  } = usePlayerStore();

  const { isInRoom, roomCode, setJamModalOpen } = useJamStore();
  const { toggleFavorite } = useLibraryStore();

  if (!currentSong) {
    return null;
  }

  return (
    <div className="fixed bottom-16 md:bottom-0 left-0 right-0 h-20 bg-[#0e1118]/90 backdrop-blur-2xl border-t border-white/10 px-4 sm:px-6 flex items-center justify-between z-40 select-none shadow-2xl">
      {/* 1. Track Info (Left) */}
      <div className="flex items-center gap-3.5 w-1/4 min-w-[180px] max-w-[280px]">
        <div
          onClick={() => setNowPlayingOpen(true)}
          className="cursor-pointer transition-transform hover:scale-105 shrink-0"
        >
          <Artwork src={currentSong.coverArt || currentSong.artwork} title={currentSong.title} artist={currentSong.artist} size="md" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4
              onClick={() => setNowPlayingOpen(true)}
              className="text-sm font-semibold text-white truncate hover:underline cursor-pointer"
            >
              {currentSong.title}
            </h4>
            {currentSong.isLiveRadio && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-600 text-white shrink-0 shadow">
                <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                LIVE
              </span>
            )}
            {currentSong.isSaavn && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-400 text-black shrink-0 shadow">
                320K
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 truncate mt-0.5">{currentSong.artist}</p>
        </div>

        <button
          onClick={() => toggleFavorite(currentSong.id, currentSong)}
          className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 ${
            currentSong.isFavorite ? 'text-rose-500' : 'text-neutral-400'
          }`}
          title="Favorite"
        >
          <Heart size={16} className={currentSong.isFavorite ? 'fill-rose-500' : ''} />
        </button>
      </div>

      {/* 2. Main Playback Controls & Seekbar (Center) */}
      <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-xl">
        {/* Buttons */}
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={toggleShuffle}
            className={`p-1.5 rounded-lg transition-colors ${
              isShuffle ? 'text-indigo-400 bg-indigo-500/10' : 'text-neutral-400 hover:text-white'
            }`}
            title="Shuffle"
          >
            <Shuffle size={16} />
          </button>

          <button
            onClick={previousSong}
            className="p-1.5 rounded-lg text-neutral-300 hover:text-white transition-colors"
            title="Previous (P)"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/15 cursor-pointer"
            title="Play/Pause (Space)"
          >
            {isPlaying ? <Pause size={18} className="fill-black" /> : <Play size={18} className="fill-black ml-0.5" />}
          </button>

          <button
            onClick={nextSong}
            className="p-1.5 rounded-lg text-neutral-300 hover:text-white transition-colors"
            title="Next (N)"
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={cycleRepeat}
            className={`p-1.5 rounded-lg transition-colors ${
              repeatMode !== 'off' ? 'text-indigo-400 bg-indigo-500/10' : 'text-neutral-400 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>

        {/* Seekbar or Live Radio Broadcast Indicator */}
        {currentSong.isLiveRadio ? (
          <div className="w-full flex items-center justify-center gap-2 py-0.5 text-[11px] font-bold text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span className="tracking-wider uppercase text-rose-300 text-[10px]">24/7 Live FM Stream • Zero Buffer</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white shadow">
              ON AIR
            </span>
          </div>
        ) : (
          <div className="w-full flex items-center gap-2.5 text-[11px] font-mono text-neutral-400">
            <span className="tabular-nums w-9 text-right">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center group cursor-pointer">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="w-full h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-1.5 transition-all"
              />
            </div>
            <span className="tabular-nums w-9">{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* 3. Utility & Volume Controls (Right) */}
      <div className="hidden sm:flex items-center justify-end gap-2 w-1/4 min-w-[220px]">
        {/* Quick Launchers: Visualizer, Lyrics, Equalizer */}
        <button
          onClick={() => openWithTab('visualizer')}
          className="p-2 rounded-lg text-neutral-400 hover:text-indigo-400 hover:bg-white/5 transition-colors"
          title="Audio Visualizer"
        >
          <Activity size={17} />
        </button>

        <button
          onClick={() => openWithTab('lyrics')}
          className="p-2 rounded-lg text-neutral-400 hover:text-purple-400 hover:bg-white/5 transition-colors"
          title="Lyrics"
        >
          <FileText size={17} />
        </button>

        <button
          onClick={() => openWithTab('equalizer')}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            spatialPreset !== 'off'
              ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30 shadow-sm shadow-amber-500/20'
              : 'text-neutral-400 hover:text-emerald-400 hover:bg-white/5'
          }`}
          title={
            spatialPreset !== 'off'
              ? `Equalizer & 3D Spatial Reverb (${spatialPreset.toUpperCase()})`
              : '10-Band Equalizer & 3D Spatial Theatre'
          }
        >
          <Sliders size={17} />
        </button>

        {/* Karaoke Mode Toggle Button */}
        <button
          onClick={toggleKaraoke}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            isKaraoke
              ? 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 shadow-sm shadow-emerald-500/30'
              : 'text-neutral-400 hover:text-emerald-400 hover:bg-white/5'
          }`}
          title={
            isKaraoke
              ? `Karaoke Mode: ON (${Math.round(karaokeDepth * 100)}% Vocal Cut)`
              : 'Turn ON Karaoke Mode (Vocal Remover)'
          }
        >
          <Mic2 size={17} className={isKaraoke ? 'animate-pulse' : ''} />
        </button>

        {/* Ask Aura AI Assistant Button */}
        <button
          onClick={() => setAiAssistantOpen(true)}
          className="p-2 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-white/5 transition-colors cursor-pointer"
          title="Ask Aura AI Assistant"
        >
          <Sparkles size={17} />
        </button>

        {/* WebRTC Social Jam (Listen Together) Button */}
        <button
          onClick={() => setJamModalOpen(true)}
          className={`p-2 rounded-lg transition-all cursor-pointer relative ${
            isInRoom
              ? 'text-pink-400 bg-pink-500/20 border border-pink-500/40 shadow-sm shadow-pink-500/30'
              : 'text-neutral-400 hover:text-pink-400 hover:bg-white/5'
          }`}
          title={
            isInRoom
              ? `Social Jam Active: Room ${roomCode}`
              : 'Social Jam (Listen Together with Friends)'
          }
        >
          <Users size={17} className={isInRoom ? 'animate-pulse' : ''} />
          {isInRoom && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-pink-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setQueueOpen(!isQueueOpen)}
          className={`p-2 rounded-lg transition-colors relative ${
            isQueueOpen ? 'text-indigo-400 bg-indigo-500/15' : 'text-neutral-400 hover:text-white hover:bg-white/5'
          }`}
          title="Queue"
        >
          <ListMusic size={18} />
          {queue.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
              {queue.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setNowPlayingOpen(true)}
          className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Expand Now Playing"
        >
          <Maximize2 size={17} />
        </button>

        {/* Volume Slider */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <button
            onClick={toggleMute}
            className="text-neutral-400 hover:text-white transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};
