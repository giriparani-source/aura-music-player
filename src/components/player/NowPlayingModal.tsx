import React, { useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Volume2,
  VolumeX,
  Disc,
  Activity,
  FileText,
  Sliders,
  Mic2,
  Film,
  Download,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ListMusic,
  Speaker,
  Check,
  Infinity as InfinityIcon
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { formatTime, formatBytes } from '../../utils/formatters';
import { Artwork } from '../common/Artwork';
import { AudioVisualizer } from './AudioVisualizer';
import { EqualizerPanel } from './EqualizerPanel';
import { LyricsView } from './LyricsView';
import { SleepTimerMenu } from './SleepTimerMenu';
import { NowPlayingTab, Song } from '../../types/music';

const NowPlayingScrubber: React.FC = React.memo(() => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const seek = usePlayerStore((s) => s.seek);

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const timeRemaining = Math.max(0, duration - currentTime);

  return (
    <div className="w-full flex flex-col gap-1.5 mb-2.5">
      <div
        className="relative w-full py-2 cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          seek(pos * duration);
        }}
      >
        <div className="w-full h-1.5 bg-[#2a2931] rounded-full overflow-hidden relative">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#00f1fd] via-[#9d4edd] to-[#e0b6ff] rounded-full transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_12px_rgba(0,241,253,0.9),0_0_4px_rgba(255,255,255,1)] group-hover:scale-125 transition-transform pointer-events-none"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      <div className="w-full flex items-center justify-between text-xs font-mono text-[#998d9e]">
        <span className="text-[#00f1fd] font-medium">{formatTime(currentTime)}</span>
        <span>-{formatTime(timeRemaining)}</span>
      </div>
    </div>
  );
});
NowPlayingScrubber.displayName = 'NowPlayingScrubber';

const NowPlayingLyricsTab: React.FC<{ song: Song; onSeek: (time: number) => void }> = React.memo(({ song, onSeek }) => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  return <LyricsView song={song} currentTime={currentTime} onSeek={onSeek} />;
});
NowPlayingLyricsTab.displayName = 'NowPlayingLyricsTab';

export const NowPlayingModal: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    repeatMode,
    isShuffle,
    isNowPlayingOpen,
    activeModalTab,
    togglePlay,
    nextSong,
    previousSong,
    seek,
    toggleShuffle,
    shuffleMode,
    cycleRepeat,
    setNowPlayingOpen,
    setActiveModalTab,
    isKaraoke,
    karaokeDepth,
    toggleKaraoke,
    spatialPreset,
    userQueue,
    setQueueOpen
  } = usePlayerStore();

  const {
    toggleFavorite,
    downloadedSongIds,
    downloadingStates,
    downloadTrack,
    deleteDownloadedTrack
  } = useLibraryStore();

  const isDownloaded = currentSong ? (downloadedSongIds.has(currentSong.id) || Boolean(currentSong.isDownloaded)) : false;
  const dlState = currentSong ? downloadingStates[currentSong.id] : undefined;
  const isDownloading = dlState?.status === 'downloading';

  const tabContainerRef = React.useRef<HTMLDivElement>(null);
  const activeTabRef = React.useRef<HTMLButtonElement>(null);

  // Smoothly scroll active tab into view inside horizontal container
  const scrollActiveTabIntoView = React.useCallback((smooth: boolean = true) => {
    requestAnimationFrame(() => {
      const container = tabContainerRef.current;
      const tab = activeTabRef.current;
      if (!container || !tab) return;

      const containerRect = container.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();

      if (tabRect.left < containerRect.left) {
        container.scrollTo({
          left: container.scrollLeft + (tabRect.left - containerRect.left) - 16,
          behavior: smooth ? 'smooth' : 'auto'
        });
      } else if (tabRect.right > containerRect.right) {
        container.scrollTo({
          left: container.scrollLeft + (tabRect.right - containerRect.right) + 16,
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!isNowPlayingOpen) return;
    scrollActiveTabIntoView(true);
  }, [activeModalTab, isNowPlayingOpen, scrollActiveTabIntoView]);

  useEffect(() => {
    if (!isNowPlayingOpen) return;
    scrollActiveTabIntoView(false);
    const timer = setTimeout(() => scrollActiveTabIntoView(false), 80);
    return () => clearTimeout(timer);
  }, [isNowPlayingOpen, scrollActiveTabIntoView]);

  // Note: Escape key dismissal is coordinated globally by MainLayout.tsx (lines 289-295)
  // to enforce strict modal hierarchy priority:
  // ClearQueueDialog (z-[80]) -> QueueSheet (z-[70]) -> NowPlayingModal (z-[60]).

  if (!isNowPlayingOpen || !currentSong) {
    return null;
  }

  const tabs: { id: NowPlayingTab; label: string; icon: React.ReactNode }[] = [
    { id: 'artwork', label: 'Artwork', icon: <Disc size={15} /> },
    { id: 'lyrics', label: 'Lyrics', icon: <FileText size={15} /> },
    { id: 'equalizer', label: 'Equalizer & 3D', icon: <Sliders size={15} /> },
    { id: 'visualizer', label: 'Visualizer', icon: <Activity size={15} /> }
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-[#0A0910] flex flex-col select-none overflow-hidden animate-in fade-in duration-200">
      {/* High-Performance Ambient Glow (Zero-lag single pass radial gradient) */}
      <div
        className="absolute inset-0 pointer-events-none -z-10 opacity-75"
        style={{
          background: 'radial-gradient(ellipse at 50% 15%, rgba(157, 78, 221, 0.22) 0%, rgba(0, 241, 253, 0.08) 40%, transparent 75%)'
        }}
      />

      {/* Top Navigation & Context Bar */}
      <div
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)' }}
        className="shrink-0 z-50 bg-[#14121a] border-b border-white/[0.08] px-4 sm:px-6 pb-2.5"
      >
        {/* Mobile drag handle indicator */}
        <div
          className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2 sm:hidden cursor-pointer"
          onClick={() => setNowPlayingOpen(false)}
        />
        
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-3 sm:gap-4 w-full max-w-5xl mx-auto">
          {/* Left: Minimize button & context subtitle */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setNowPlayingOpen(false)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#998d9e] hover:text-white active:scale-95 transition-all cursor-pointer bg-white/[0.04]"
              aria-label="Collapse Player"
              title="Collapse (Esc)"
            >
              <ChevronDown size={22} />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#998d9e] block">
                {currentSong.isLiveRadio ? 'Live Broadcast' : 'Playing from Stream'}
              </span>
              <p className="text-xs text-[#00f1fd] font-semibold truncate max-w-[150px] sm:max-w-xs">
                {currentSong.album || currentSong.folder || 'Aura 320k Cloud'}
              </p>
            </div>
          </div>

          {/* Center: Tabs Segmented Control */}
          <div className="w-full md:w-auto md:flex-1 min-w-0 overflow-x-auto no-scrollbar flex items-center justify-start md:justify-center order-last md:order-none">
            <div
              ref={tabContainerRef}
              className="flex items-center gap-1 p-1 rounded-full bg-[#1c1b22]/90 border border-white/[0.08] backdrop-blur-md overflow-x-auto no-scrollbar whitespace-nowrap flex-nowrap shrink-0 max-w-full touch-pan-x"
            >
              {tabs.map((tab) => {
                const isActive = activeModalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={isActive ? activeTabRef : null}
                    onClick={() => setActiveModalTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap select-none ${
                      isActive
                        ? 'bg-gradient-to-r from-[#9d4edd] to-[#8433c4] text-white shadow-[0_0_16px_rgba(157,78,221,0.4)]'
                        : 'text-[#998d9e] hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="shrink-0">{tab.icon}</span>
                    <span className="whitespace-nowrap shrink-0">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right quick tools: 3D Theatre, Karaoke, Sleep Timer */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveModalTab('equalizer')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border shrink-0 ${
                spatialPreset !== 'off'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                  : 'bg-white/[0.04] text-[#998d9e] hover:text-white border-white/[0.08]'
              }`}
              title={spatialPreset !== 'off' ? `3D Spatial Acoustics: ${spatialPreset.toUpperCase()}` : 'Open 3D Spatial Acoustics'}
            >
              <Film size={14} className={spatialPreset !== 'off' ? 'text-amber-400 animate-pulse' : ''} />
              <span className="hidden sm:inline">
                {spatialPreset !== 'off' ? `Theatre: ${spatialPreset}` : '3D'}
              </span>
            </button>

            <button
              onClick={toggleKaraoke}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border shrink-0 ${
                isKaraoke
                  ? 'bg-[#00f1fd]/20 text-[#00f1fd] border-[#00f1fd]/40 shadow-sm shadow-[#00f1fd]/30'
                  : 'bg-white/[0.04] text-[#998d9e] hover:text-white border-white/[0.08]'
              }`}
              title={isKaraoke ? `Karaoke: ${Math.round(karaokeDepth * 100)}% Vocal Cut` : 'Karaoke'}
            >
              <Mic2 size={14} className={isKaraoke ? 'animate-pulse text-[#00f1fd]' : ''} />
              <span className="hidden sm:inline">
                {isKaraoke ? `${Math.round(karaokeDepth * 100)}%` : 'Karaoke'}
              </span>
            </button>

            <SleepTimerMenu />

            <button
              onClick={() => setNowPlayingOpen(false)}
              className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 flex items-center justify-center text-white transition-all shrink-0 cursor-pointer border border-white/[0.1]"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 w-full custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full min-h-full flex flex-col items-center justify-center">
          {activeModalTab === 'artwork' && (
            <div className="flex flex-col items-center justify-center w-full max-w-md my-auto py-2">
              {/* Stitch Hero Artwork with ambient glow footprint & vinyl sheen */}
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-square rounded-[24px] p-0.5 bg-gradient-to-b from-[#e0b6ff]/30 via-transparent to-[#00f1fd]/20 shadow-[0_20px_50px_rgba(10,9,16,0.9),0_0_40px_rgba(157,78,221,0.22)] group mx-auto">
                <div className="w-full h-full rounded-[22px] overflow-hidden relative bg-[#201f26]">
                  <Artwork
                    src={currentSong.coverArt || currentSong.artwork}
                    title={currentSong.title}
                    artist={currentSong.artist}
                    size="xl"
                    className="w-full h-full object-cover transform transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  {/* Vinyl Micro Grooves Overlay Hint */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e0d14]/70 via-transparent to-white/5 pointer-events-none" />
                </div>
                {/* Tactile Vinyl Floating Edge Indicator */}
                <div className="absolute -bottom-2 right-4 px-2.5 py-1 rounded-full bg-[#201f26]/95 backdrop-blur-md shadow-md flex items-center gap-1.5 border border-white/[0.08]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00f1fd] animate-ping" />
                  <span className="text-[10px] text-[#00f1fd] tracking-wider font-extrabold uppercase">
                    {spatialPreset !== 'off' ? `ATMOS ${spatialPreset}` : 'STUDIO 320K'}
                  </span>
                </div>
              </div>

              {/* Hi-Res Audio Spec Badge */}
              <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-[#2a2931]/70 backdrop-blur-sm border border-white/[0.06]">
                <span className="w-2 h-2 rounded-full bg-[#00f1fd] shadow-[0_0_6px_#00f1fd]" />
                <span className="text-[11px] text-[#d0c2d5] font-medium tracking-wide">
                  {currentSong.isLiveRadio ? 'Direct FM Feed' : (currentSong.format || 'AAC 320kbps')}
                  <span className="text-[#998d9e] mx-1">•</span>
                  24-bit / 96 kHz
                  <span className="text-[#998d9e] mx-1">•</span>
                  <span className="text-[#00f1fd] font-bold">Hi-Res Audio</span>
                </span>
              </div>

              {/* Track Meta Information & Favorite Action */}
              <div className="w-full flex items-center justify-between mt-4 mb-2 px-2">
                <div className="flex flex-col min-w-0 pr-3">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#e5e0eb] tracking-tight truncate">
                    {currentSong.title}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm text-[#00f1fd] truncate font-medium">{currentSong.artist}</span>
                    <CheckCircle2 size={15} className="text-[#00f1fd] shrink-0" />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                      className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        isDownloaded
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isDownloading
                          ? 'bg-[#00f1fd]/20 text-[#00f1fd]'
                          : 'bg-white/[0.04] text-[#998d9e] hover:text-white border border-white/[0.06]'
                      }`}
                      title={isDownloaded ? 'Downloaded (Tap to remove)' : 'Download track for offline playback'}
                    >
                      {isDownloading ? (
                        <Loader2 size={18} className="animate-spin text-[#00f1fd]" />
                      ) : isDownloaded ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : (
                        <Download size={18} />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => toggleFavorite(currentSong.id, currentSong)}
                    className="relative w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer bg-white/[0.04] border border-white/[0.06]"
                    title={currentSong.isFavorite ? 'Remove from Favourites' : 'Add to Favourites'}
                  >
                    {currentSong.isFavorite && (
                      <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-md" />
                    )}
                    <Heart
                      size={20}
                      className={currentSong.isFavorite ? 'fill-rose-500 text-rose-500 relative z-10' : 'text-[#998d9e] relative z-10'}
                    />
                  </button>
                </div>
              </div>

              {/* Synchronized Lyrics Pill Preview Bar */}
              <div
                onClick={() => setActiveModalTab('lyrics')}
                className="w-full mt-3 p-3 rounded-2xl bg-[#201f26] hover:bg-[#2a2931] border border-white/[0.08] flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#9d4edd]/20 flex items-center justify-center text-[#e0b6ff] shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="flex flex-col min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-[#00f1fd] font-bold">
                        Synchronized Lyrics
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9d4edd] animate-pulse" />
                    </div>
                    <p className="text-xs text-[#d0c2d5] truncate italic mt-0.5">
                      Tap to open full synchronized lyrics sheet...
                    </p>
                  </div>
                </div>
                <span className="text-xs text-[#998d9e] font-semibold">View</span>
              </div>
            </div>
          )}

          {activeModalTab === 'lyrics' && (
            <div className="w-full h-80 sm:h-96 flex flex-col my-auto py-4">
              <NowPlayingLyricsTab song={currentSong} onSeek={seek} />
            </div>
          )}

          {activeModalTab === 'equalizer' && (
            <div className="w-full flex justify-center py-2 pb-6">
              <EqualizerPanel />
            </div>
          )}

          {activeModalTab === 'visualizer' && (
            <div className="w-full h-full max-w-4xl flex flex-col items-center justify-center my-auto py-4">
              <AudioVisualizer isPlaying={isPlaying} className="h-80 sm:h-96" />
              <div className="text-center mt-4">
                <h3 className="text-lg font-bold text-white">{currentSong.title}</h3>
                <p className="text-xs text-[#998d9e]">{currentSong.artist}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Master Playback Controls Area */}
      <div
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 14px)' }}
        className="shrink-0 mt-auto z-40 bg-[#14121a] w-full border-t border-white/[0.08] px-4 sm:px-6 pt-3"
      >
        <div className="w-full max-w-2xl mx-auto">
          {/* Audio Timeline Scrubber */}
          {currentSong.isLiveRadio ? (
            <div className="flex items-center justify-between px-4 py-2 rounded-full bg-rose-500/10 border border-rose-500/20 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  Live Studio Broadcast
                </span>
              </div>
              <span className="text-xs font-mono text-[#998d9e]">
                Direct Feed • 24/7
              </span>
            </div>
          ) : (
            <NowPlayingScrubber />
          )}

          {/* Primary Transport Controls */}
          <div className="w-full flex items-center justify-between mt-1 mb-2">
            {/* Shuffle Toggle */}
            <button
              onClick={toggleShuffle}
              className={`w-12 h-12 rounded-full flex flex-col items-center justify-center active:scale-90 transition-transform relative cursor-pointer ${
                shuffleMode === 'smart'
                  ? 'text-[#00f1fd]'
                  : isShuffle
                  ? 'text-[#e0b6ff]'
                  : 'text-[#998d9e] hover:text-white'
              }`}
              title={shuffleMode === 'smart' ? 'Smart Shuffle (AI active)' : isShuffle ? 'True Shuffle active' : 'Shuffle OFF'}
            >
              <Shuffle size={20} />
              {(isShuffle || shuffleMode === 'smart') && (
                <span className="w-1 h-1 bg-[#00f1fd] rounded-full mt-0.5 shadow-[0_0_6px_#00f1fd]" />
              )}
            </button>

            {/* Previous Track */}
            <button
              onClick={previousSong}
              className="w-12 h-12 rounded-full flex items-center justify-center text-[#e5e0eb] hover:text-[#e0b6ff] active:scale-90 transition-transform cursor-pointer"
              aria-label="Previous Track"
            >
              <SkipBack size={28} className="fill-[#e5e0eb]" />
            </button>

            {/* Master Kinetic Hero Trigger (72x72) */}
            <button
              onClick={togglePlay}
              className="relative group w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center p-0.5 active:scale-95 transition-all shadow-[0_8px_30px_rgba(157,78,221,0.5),0_0_24px_rgba(0,241,253,0.35)] cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#9d4edd] via-[#00f1fd] to-[#8433c4] blur-sm group-hover:blur-md transition-all" />
              <div className="relative w-full h-full rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#8433c4] flex items-center justify-center text-white">
                {isPlaying ? (
                  <Pause size={32} className="fill-white" />
                ) : (
                  <Play size={32} className="fill-white ml-1" />
                )}
              </div>
            </button>

            {/* Next Track */}
            <button
              onClick={nextSong}
              className="w-12 h-12 rounded-full flex items-center justify-center text-[#e5e0eb] hover:text-[#e0b6ff] active:scale-90 transition-transform cursor-pointer"
              aria-label="Next Track"
            >
              <SkipForward size={28} className="fill-[#e5e0eb]" />
            </button>

            {/* Repeat Mode */}
            <button
              onClick={cycleRepeat}
              className={`w-12 h-12 rounded-full flex flex-col items-center justify-center active:scale-90 transition-transform relative cursor-pointer ${
                repeatMode !== 'off' ? 'text-[#e0b6ff]' : 'text-[#998d9e] hover:text-white'
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
              {repeatMode !== 'off' && (
                <span className="w-1 h-1 bg-[#00f1fd] rounded-full mt-0.5 shadow-[0_0_6px_#00f1fd]" />
              )}
            </button>
          </div>

          {/* Bottom Secondary Audio Ecosystem Bar */}
          <div className="w-full flex items-center justify-between pt-1 text-xs">
            {/* Active Audio Target */}
            <div className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-[#1c1b22] border border-white/[0.06] text-[#e5e0eb]">
              <Speaker size={15} className="text-[#00f1fd]" />
              <span className="font-medium truncate max-w-[140px]">
                {currentSong.isDirectAudioStream ? 'Aura 320k Stream' : 'Aura Cloud Master'}
              </span>
            </div>

            {/* Up Next Queue Trigger with Live Badge */}
            <button
              onClick={() => {
                setQueueOpen(true);
              }}
              className="relative flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-[#1c1b22] hover:bg-[#201f26] border border-white/[0.06] text-[#d0c2d5] hover:text-white transition-all cursor-pointer"
              aria-label="Up Next Queue"
            >
              <ListMusic size={16} className="text-[#e0b6ff]" />
              <span className="font-semibold text-xs">Queue</span>
              {userQueue.length > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#1ed760] text-black text-[9px] font-extrabold flex items-center justify-center">
                  {userQueue.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
