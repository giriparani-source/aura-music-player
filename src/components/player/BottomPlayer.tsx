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
  Users,
  Download,
  CheckCircle2,
  Loader2,
  Infinity as InfinityIcon
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useJamStore } from '../../store/useJamStore';
import { useTranslation } from '../../i18n';
import { formatTime } from '../../utils/formatters';
import { Artwork } from '../common/Artwork';
import { SleepTimerMenu } from './SleepTimerMenu';

const BottomPlayerProgress: React.FC = React.memo(() => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const seek = usePlayerStore((s) => s.seek);

  return (
    <div className="w-full flex items-center gap-2.5 text-[11px] font-mono text-[#998d9e]">
      <span className="tabular-nums w-9 text-right text-[#00f1fd] font-medium">{formatTime(currentTime)}</span>
      <div className="relative flex-1 flex items-center group cursor-pointer py-1">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek track position"
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#9d4edd] hover:h-1.5 transition-all"
        />
      </div>
      <span className="tabular-nums w-9">{formatTime(duration)}</span>
    </div>
  );
});
BottomPlayerProgress.displayName = 'BottomPlayerProgress';

const MobileBottomProgressBar: React.FC = React.memo(() => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  return (
    <div className="w-full h-[3px] bg-[#2a2931]/60 overflow-hidden shrink-0">
      <div
        className="h-full bg-gradient-to-r from-[#00f1fd] via-[#9d4edd] to-[#e0b6ff] transition-all duration-300"
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );
});
MobileBottomProgressBar.displayName = 'MobileBottomProgressBar';

export const BottomPlayer: React.FC = () => {
  const { t } = useTranslation();
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const userQueue = usePlayerStore((s) => s.userQueue);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextSong = usePlayerStore((s) => s.nextSong);
  const previousSong = usePlayerStore((s) => s.previousSong);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const setNowPlayingOpen = usePlayerStore((s) => s.setNowPlayingOpen);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const openWithTab = usePlayerStore((s) => s.openWithTab);
  const isKaraoke = usePlayerStore((s) => s.isKaraoke);
  const karaokeDepth = usePlayerStore((s) => s.karaokeDepth);
  const spatialPreset = usePlayerStore((s) => s.spatialPreset);
  const toggleKaraoke = usePlayerStore((s) => s.toggleKaraoke);
  const isAuraFlow = usePlayerStore((s) => s.isAuraFlow);
  const toggleAuraFlow = usePlayerStore((s) => s.toggleAuraFlow);

  const isInRoom = useJamStore((s) => s.isInRoom);
  const roomCode = useJamStore((s) => s.roomCode);
  const setJamModalOpen = useJamStore((s) => s.setJamModalOpen);

  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const downloadTrack = useLibraryStore((s) => s.downloadTrack);
  const deleteDownloadedTrack = useLibraryStore((s) => s.deleteDownloadedTrack);
  const isDownloaded = useLibraryStore((s) => currentSong ? (s.downloadedSongIds.has(currentSong.id) || Boolean(currentSong.isDownloaded)) : false);
  const dlState = useLibraryStore((s) => currentSong ? s.downloadingStates[currentSong.id] : undefined);
  const isDownloading = dlState?.status === 'downloading';

  if (!currentSong) {
    return null;
  }

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. MOBILE FLOATING MINI PLAYER (< sm) — Stitch Frosted Dock (GPU Optimized)*/}
      {/* ========================================================================= */}
      <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] left-2.5 right-2.5 sm:hidden h-16 rounded-2xl bg-[#1a1726] border border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex flex-col justify-between overflow-hidden z-40 select-none transform-gpu will-change-transform">
        <div className="flex items-center justify-between w-full h-full px-2.5 gap-2.5">
          {/* Track Artwork & Info (Tapping smoothly opens Now Playing Modal) */}
          <div
            onClick={() => setNowPlayingOpen(true)}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-md relative bg-[#2a2931]">
              <Artwork src={currentSong.coverArt || currentSong.artwork} title={currentSong.title} artist={currentSong.artist} size="sm" />
              <div className="absolute inset-0 bg-[#9d4edd]/10 mix-blend-screen pointer-events-none" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-[#e5e0eb] truncate">
                  {currentSong.title}
                </h4>
                {currentSong.isLiveRadio && (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[7px] font-black bg-rose-600 text-white shrink-0 shadow">
                    <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                    LIVE
                  </span>
                )}
                {!currentSong.isLiveRadio && (
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-[#00f1fd]/15 text-[#00f1fd] tracking-tight shrink-0">
                    320k
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#998d9e] truncate mt-0.5">{currentSong.artist}</p>
            </div>
          </div>

          {/* Action Controls: Favorite, Kinetic Play/Pause, Next */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => toggleFavorite(currentSong.id, currentSong)}
              className={`p-2 rounded-full transition-colors active:scale-90 cursor-pointer ${
                currentSong.isFavorite ? 'text-rose-500' : 'text-[#998d9e] hover:text-white'
              }`}
              aria-label="Favorite"
              title="Favorite"
            >
              <Heart size={18} className={currentSong.isFavorite ? 'fill-rose-500' : ''} />
            </button>

            <button
              onClick={() => setQueueOpen(!isQueueOpen)}
              className={`p-2 rounded-full transition-colors active:scale-90 cursor-pointer relative ${
                isQueueOpen ? 'text-[#1ed760] bg-[#1ed760]/15' : 'text-[#998d9e] hover:text-white'
              }`}
              aria-label="Queue"
              title={t('player.queue') || 'Queue'}
            >
              <ListMusic size={18} />
              {userQueue.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-3.5 px-1 bg-[#1ed760] text-black rounded-full text-[8px] font-extrabold flex items-center justify-center shadow-sm">
                  {userQueue.length}
                </span>
              )}
            </button>

            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] text-white flex items-center justify-center active:scale-90 transition-transform shadow-[0_0_16px_rgba(157,78,221,0.5)] cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title="Play/Pause"
            >
              {isPlaying ? <Pause size={18} className="fill-white" /> : <Play size={18} className="fill-white ml-0.5" />}
            </button>

            <button
              onClick={nextSong}
              className="p-2 rounded-full text-[#998d9e] hover:text-white active:scale-90 transition-colors cursor-pointer"
              aria-label="Next Track"
              title="Next Track"
            >
              <SkipForward size={20} />
            </button>
          </div>
        </div>

        {/* 2.5dp Bottom Progress Line */}
        <MobileBottomProgressBar />
      </div>

      {/* ========================================================================= */}
      {/* 2. DESKTOP / TABLET PLAYER (>= sm) — Full Studio Suite with Stitch Tokens */}
      {/* ========================================================================= */}
      <div className="hidden sm:flex fixed bottom-0 left-0 right-0 h-20 bg-[#14121a] border-t border-white/[0.08] px-4 sm:px-6 items-center justify-between z-40 select-none shadow-[0_-8px_32px_rgba(0,0,0,0.6)]">
        {/* 1. Track Info (Left) */}
        <div className="flex items-center gap-3 w-1/4 min-w-[200px] max-w-[320px]">
          <div
            onClick={() => setNowPlayingOpen(true)}
            className="cursor-pointer transition-transform hover:scale-105 shrink-0 rounded-xl overflow-hidden relative shadow-md bg-[#2a2931]"
          >
            <Artwork src={currentSong.coverArt || currentSong.artwork} title={currentSong.title} artist={currentSong.artist} size="md" />
            <div className="absolute inset-0 bg-[#9d4edd]/10 mix-blend-screen pointer-events-none" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4
                onClick={() => setNowPlayingOpen(true)}
                className="text-sm font-semibold text-[#e5e0eb] truncate hover:text-[#e0b6ff] hover:underline cursor-pointer transition-colors"
              >
                {currentSong.title}
              </h4>
              {currentSong.isLiveRadio && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-600 text-white shrink-0 shadow">
                  <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                  LIVE
                </span>
              )}
              {currentSong.isAuraFlow && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#9d4edd]/20 text-[#e0b6ff] border border-[#9d4edd]/30 shrink-0">
                  <Sparkles size={8} />
                  FLOW
                </span>
              )}
              {currentSong.isForegroundOnly && !isDownloaded && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-600/30 text-amber-300 border border-amber-500/40 shrink-0" title="YouTube Video: Tap download icon to play with screen off">
                  YT • TAP 📥 FOR BG
                </span>
              )}
              {isDownloaded && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shrink-0" title="Offline Audio: Screen-off & background ready">
                  OFFLINE
                </span>
              )}
            </div>
            <p className="text-xs text-[#998d9e] truncate mt-0.5">{currentSong.artist}</p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {!currentSong.isLiveRadio && (
              <button
                onClick={() => {
                  if (isDownloading) return;
                  if (isDownloaded) {
                    deleteDownloadedTrack(currentSong.id);
                  } else {
                    downloadTrack(currentSong);
                  }
                }}
                disabled={isDownloading}
                className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer ${
                  isDownloaded
                    ? 'text-emerald-400'
                    : isDownloading
                    ? 'text-[#00f1fd]'
                    : 'text-[#998d9e] hover:text-white'
                }`}
                title={
                  isDownloaded
                    ? 'Downloaded for offline playback (Click to remove)'
                    : isDownloading
                    ? `Downloading... ${dlState?.progress || 0}%`
                    : 'Download for offline playback'
                }
              >
                {isDownloading ? (
                  <Loader2 size={16} className="animate-spin text-[#00f1fd]" />
                ) : isDownloaded ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <Download size={16} />
                )}
              </button>
            )}

            <button
              onClick={() => toggleFavorite(currentSong.id, currentSong)}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer ${
                currentSong.isFavorite ? 'text-rose-500' : 'text-[#998d9e] hover:text-white'
              }`}
              title="Favorite"
            >
              <Heart size={16} className={currentSong.isFavorite ? 'fill-rose-500' : ''} />
            </button>
          </div>
        </div>

        {/* 2. Main Playback Controls & Seekbar (Center) */}
        <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-xl">
          {/* Buttons */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={toggleShuffle}
              className={`relative p-1.5 rounded-lg transition-all cursor-pointer ${
                shuffleMode === 'smart'
                  ? 'text-[#00f1fd] bg-[#00f1fd]/15 shadow-sm shadow-[#00f1fd]/20 ring-1 ring-[#00f1fd]/30'
                  : isShuffle
                  ? 'text-[#e0b6ff] bg-[#9d4edd]/20'
                  : 'text-[#998d9e] hover:text-white'
              }`}
              title={
                shuffleMode === 'smart'
                  ? 'Smart Shuffle Active ✨ (AI Discovery recommendations active)'
                  : isShuffle
                  ? 'True-Fair Shuffle Active 🔀 (Even artist & album spacing)'
                  : 'Shuffle: OFF (Click to enable)'
              }
            >
              <Shuffle size={16} />
              {shuffleMode === 'smart' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00f1fd] animate-pulse ring-2 ring-black" />
              )}
            </button>

            <button
              onClick={previousSong}
              className="p-1.5 rounded-lg text-[#d0c2d5] hover:text-white transition-colors cursor-pointer"
              title={t('player.previous') || 'Previous Track'}
            >
              <SkipBack size={18} />
            </button>

            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_16px_rgba(157,78,221,0.5)] cursor-pointer"
              title={isPlaying ? (t('player.pause') || 'Pause') : (t('player.play') || 'Play')}
            >
              {isPlaying ? <Pause size={18} className="fill-white" /> : <Play size={18} className="fill-white ml-0.5" />}
            </button>

            <button
              onClick={nextSong}
              className="p-1.5 rounded-lg text-[#d0c2d5] hover:text-white transition-colors cursor-pointer"
              title={t('player.next') || 'Next Track'}
            >
              <SkipForward size={18} />
            </button>

            <button
              onClick={cycleRepeat}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                repeatMode !== 'off' ? 'text-[#e0b6ff] bg-[#9d4edd]/20' : 'text-[#998d9e] hover:text-white'
              }`}
              title={`${t('player.repeat') || 'Repeat'}: ${repeatMode}`}
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
            <BottomPlayerProgress />
          )}
        </div>

        {/* 3. Utility & Volume Controls (Right) */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 w-1/4 min-w-[220px]">
          {/* Quick Launchers: Visualizer, Lyrics, Equalizer */}
          <button
            onClick={() => openWithTab('visualizer')}
            className="p-2 rounded-lg text-[#998d9e] hover:text-[#00f1fd] hover:bg-white/5 transition-colors cursor-pointer"
            title="Audio Visualizer"
          >
            <Activity size={17} />
          </button>

          <button
            onClick={() => openWithTab('lyrics')}
            className="p-2 rounded-lg text-[#998d9e] hover:text-[#e0b6ff] hover:bg-white/5 transition-colors cursor-pointer"
            title={t('player.lyrics') || 'Lyrics'}
          >
            <FileText size={17} />
          </button>

          <button
            onClick={() => openWithTab('equalizer')}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              spatialPreset !== 'off'
                ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30 shadow-sm shadow-amber-500/20'
                : 'text-[#998d9e] hover:text-[#00f1fd] hover:bg-white/5'
            }`}
            title={
              spatialPreset !== 'off'
                ? `${t('player.equalizer') || 'Equalizer'} (${spatialPreset.toUpperCase()})`
                : (t('player.equalizer') || 'Equalizer')
            }
          >
            <Sliders size={17} />
          </button>

          {/* Karaoke Mode Toggle Button */}
          <button
            onClick={toggleKaraoke}
            className={`p-2 rounded-lg transition-all cursor-pointer ${
              isKaraoke
                ? 'text-[#00f1fd] bg-[#00f1fd]/20 border border-[#00f1fd]/40 shadow-sm shadow-[#00f1fd]/30'
                : 'text-[#998d9e] hover:text-[#00f1fd] hover:bg-white/5'
            }`}
            title={
              isKaraoke
                ? `${t('player.karaoke') || 'Karaoke'}: ON (${Math.round(karaokeDepth * 100)}%)`
                : (t('player.karaoke') || 'Karaoke')
            }
          >
            <Mic2 size={17} className={isKaraoke ? 'animate-pulse' : ''} />
          </button>

          {/* WebRTC Social Jam Button */}
          <button
            onClick={() => setJamModalOpen(true)}
            className={`p-2 rounded-lg transition-all cursor-pointer relative ${
              isInRoom
                ? 'text-pink-400 bg-pink-500/20 border border-pink-500/40 shadow-sm shadow-pink-500/30'
                : 'text-[#998d9e] hover:text-pink-400 hover:bg-white/5'
            }`}
            title={
              isInRoom
                ? `${t('player.socialJam') || 'Jam'}: Room ${roomCode}`
                : (t('player.socialJam') || 'Jam')
            }
          >
            <Users size={17} className={isInRoom ? 'animate-pulse' : ''} />
            {isInRoom && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-pink-500 animate-ping" />
            )}
          </button>

          {/* Smart Sleep Timer Control */}
          <SleepTimerMenu compact={true} />

          {/* Aura Flow Smart Autoplay Toggle */}
          <button
            onClick={toggleAuraFlow}
            className={`p-2 rounded-lg transition-all cursor-pointer relative ${
              isAuraFlow
                ? 'text-[#e0b6ff] bg-[#9d4edd]/20 border border-[#9d4edd]/40 shadow-sm shadow-[#9d4edd]/30'
                : 'text-[#998d9e] hover:text-[#e0b6ff] hover:bg-white/5'
            }`}
            title={
              isAuraFlow
                ? `${t('player.auraFlow') || 'Aura Flow'}: ON`
                : (t('player.auraFlow') || 'Aura Flow')
            }
          >
            <InfinityIcon size={17} className={isAuraFlow ? 'animate-pulse text-[#e0b6ff]' : ''} />
          </button>

          <button
            onClick={() => setQueueOpen(!isQueueOpen)}
            className={`p-2 rounded-lg transition-colors relative cursor-pointer ${
              isQueueOpen ? 'text-[#00f1fd] bg-[#00f1fd]/15' : 'text-[#998d9e] hover:text-white hover:bg-white/5'
            }`}
            title={t('player.queue') || 'Queue'}
          >
            <ListMusic size={18} />
            {userQueue.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#1ed760] text-black rounded-full text-[9px] font-extrabold flex items-center justify-center">
                {userQueue.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setNowPlayingOpen(true)}
            className="p-2 rounded-lg text-[#998d9e] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title={t('player.expand') || 'Expand'}
          >
            <Maximize2 size={17} />
          </button>

          {/* Volume Slider */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <button
              onClick={toggleMute}
              className="text-[#998d9e] hover:text-white transition-colors cursor-pointer"
              title={isMuted ? (t('player.unmute') || 'Unmute') : (t('player.mute') || 'Mute')}
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
              aria-label="Volume level"
              className="w-20 h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-[#9d4edd] hover:h-1.5 transition-all"
            />
          </div>
        </div>
      </div>
    </>
  );
};
