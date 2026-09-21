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
  Sparkles,
  Mic2,
  Film,
  Download,
  CheckCircle2,
  Loader2,
  Infinity as InfinityIcon
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { formatTime, formatBytes } from '../../utils/formatters';
import { Artwork } from '../common/Artwork';
import { AudioVisualizer } from './AudioVisualizer';
import { EqualizerPanel } from './EqualizerPanel';
import { LyricsView } from './LyricsView';
import { AiSongInsights } from './AiSongInsights';
import { SleepTimerMenu } from './SleepTimerMenu';
import { NowPlayingTab } from '../../types/music';
import { getAuraReasonLabel } from '../../services/auraFlowService';
import { getAuraReasonExplanation } from '../../services/auraProfileExplainer';

export const NowPlayingModal: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffle,
    isNowPlayingOpen,
    activeModalTab,
    togglePlay,
    nextSong,
    previousSong,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    shuffleMode,
    cycleRepeat,
    setNowPlayingOpen,
    setActiveModalTab,
    isKaraoke,
    karaokeDepth,
    toggleKaraoke,
    spatialPreset,
    isAuraFlow,
    toggleAuraFlow
  } = usePlayerStore();

  const {
    toggleFavorite,
    downloadedSongIds,
    downloadingStates,
    downloadTrack,
    deleteDownloadedTrack,
    isOnline
  } = useLibraryStore();

  const isDownloaded = currentSong ? (downloadedSongIds.has(currentSong.id) || Boolean(currentSong.isDownloaded)) : false;
  const dlState = currentSong ? downloadingStates[currentSong.id] : undefined;
  const isDownloading = dlState?.status === 'downloading';
  const [showAuraReasonDetail, setShowAuraReasonDetail] = React.useState(false);

  const tabContainerRef = React.useRef<HTMLDivElement>(null);
  const activeTabRef = React.useRef<HTMLButtonElement>(null);

  // Smoothly scroll active tab into view inside the horizontal tab container
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

  // Auto-scroll on tab switch
  useEffect(() => {
    if (!isNowPlayingOpen) return;
    scrollActiveTabIntoView(true);
  }, [activeModalTab, isNowPlayingOpen, scrollActiveTabIntoView]);

  // Initial scroll into view on modal mount/open after layout completes
  useEffect(() => {
    if (!isNowPlayingOpen) return;
    scrollActiveTabIntoView(false);
    const timer = setTimeout(() => {
      scrollActiveTabIntoView(false);
    }, 60);
    const timer2 = setTimeout(() => {
      scrollActiveTabIntoView(false);
    }, 180);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [isNowPlayingOpen, scrollActiveTabIntoView]);

  // Auto-scroll on window resize to ensure active tab remains visible
  useEffect(() => {
    if (!isNowPlayingOpen) return;
    const handleResize = () => {
      scrollActiveTabIntoView(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isNowPlayingOpen, scrollActiveTabIntoView]);

  // Support horizontal mouse wheel and trackpad scrolling over tab row
  useEffect(() => {
    const el = tabContainerRef.current;
    if (!el || !isNowPlayingOpen) return;

    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0 && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += delta;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isNowPlayingOpen]);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isNowPlayingOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNowPlayingOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNowPlayingOpen, setNowPlayingOpen]);

  if (!isNowPlayingOpen || !currentSong) {
    return null;
  }

  const tabs: { id: NowPlayingTab; label: string; icon: React.ReactNode }[] = [
    { id: 'artwork', label: 'Artwork', icon: <Disc size={15} /> },
    { id: 'visualizer', label: 'Visualizer', icon: <Activity size={15} /> },
    { id: 'lyrics', label: 'Lyrics', icon: <FileText size={15} /> },
    { id: 'equalizer', label: 'Equalizer & 3D', icon: <Sliders size={15} /> },
    { id: 'ai-insights', label: 'AI Insights', icon: <Sparkles size={15} /> }
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-[#07090e]/95 backdrop-blur-3xl flex flex-col select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Header (shrink-0) */}
      <div
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
        className="shrink-0 z-50 bg-[#07090e]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 pb-3"
      >
        {/* Mobile drag handle indicator */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2 sm:hidden cursor-pointer" onClick={() => setNowPlayingOpen(false)} />
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-3 sm:gap-4 w-full max-w-5xl mx-auto">
          <div className="min-w-0 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
              Now Playing
            </span>
            <p className="text-xs text-neutral-400 truncate mt-0.5 max-w-[150px] sm:max-w-xs">
              {currentSong.folder || 'Personal Library'}
            </p>
          </div>

          {/* Tab Segmented Control (Horizontally scrollable, single row, no wrapping, labels fully visible) */}
          <div className="w-full md:w-auto md:flex-1 min-w-0 overflow-x-auto no-scrollbar flex items-center justify-start md:justify-center order-last md:order-none">
            <div
              ref={tabContainerRef}
              className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md overflow-x-auto no-scrollbar whitespace-nowrap flex-nowrap shrink-0 max-w-full touch-pan-x"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {tabs.map((tab) => {
                const isActive = activeModalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={isActive ? activeTabRef : null}
                    onClick={() => setActiveModalTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap select-none ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="shrink-0">{tab.icon}</span>
                    <span className="whitespace-nowrap shrink-0">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 3D Spatial Theatre Quick Indicator / Switch */}
            <button
              onClick={() => setActiveModalTab('equalizer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border shrink-0 ${
                spatialPreset !== 'off'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                  : 'bg-white/5 text-neutral-400 hover:text-white border-white/10'
              }`}
              title={spatialPreset !== 'off' ? `3D Spatial Acoustics: ${spatialPreset.toUpperCase()}` : 'Open 3D Spatial Acoustics'}
            >
              <Film size={14} className={spatialPreset !== 'off' ? 'text-amber-400 animate-pulse' : ''} />
              <span className="hidden sm:inline">
                {spatialPreset !== 'off' ? `Theatre: ${spatialPreset}` : '3D Spatial'}
              </span>
            </button>

            {/* Karaoke Quick Switch with Depth % */}
            <button
              onClick={toggleKaraoke}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border shrink-0 ${
                isKaraoke
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/30'
                  : 'bg-white/5 text-neutral-400 hover:text-white border-white/10'
              }`}
              title={isKaraoke ? `Karaoke Active: ${Math.round(karaokeDepth * 100)}% Vocal Cut` : 'Enable Karaoke Mode'}
            >
              <Mic2 size={14} className={isKaraoke ? 'animate-pulse text-emerald-400' : ''} />
              <span className="hidden sm:inline">
                Karaoke: {isKaraoke ? `${Math.round(karaokeDepth * 100)}%` : 'OFF'}
              </span>
            </button>

            {/* Smart Sleep Timer Control */}
            <SleepTimerMenu />

            {/* Top Close (Cancel) Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNowPlayingOpen(false);
              }}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all shrink-0 cursor-pointer relative z-50 border border-white/15 shadow-xl hover:border-white/30"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal content / Equalizer body (flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 w-full custom-scrollbar">
        <div className="max-w-5xl mx-auto w-full min-h-full flex flex-col items-center justify-center">
          {activeModalTab === 'artwork' && (
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 w-full max-w-4xl my-auto py-4">
              {/* Big Artwork */}
              <div className="relative group shrink-0">
                <Artwork
                  src={currentSong.coverArt || currentSong.artwork}
                  title={currentSong.title}
                  artist={currentSong.artist}
                  size="xl"
                  className="w-64 h-64 sm:w-80 sm:h-80 shadow-2xl rounded-3xl"
                />
              </div>

              {/* Track Info & Technical Details */}
              <div className="flex-1 w-full max-w-md flex flex-col justify-center">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
                      {currentSong.title}
                    </h2>
                    <p className="text-base text-neutral-300 font-medium">{currentSong.artist}</p>
                    {currentSong.album && (
                      <p className="text-xs text-neutral-500 mt-1">Album: {currentSong.album}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
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
                      className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                        isDownloaded
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isDownloading
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/5'
                      }`}
                      title={
                        isDownloaded
                          ? 'Downloaded for offline playback (Click to remove)'
                          : isDownloading
                          ? `Downloading... ${dlState?.progress || 0}%`
                          : 'Download track for offline playback'
                      }
                    >
                      {isDownloading ? (
                        <Loader2 size={20} className="animate-spin text-indigo-400" />
                      ) : isDownloaded ? (
                        <CheckCircle2 size={20} className="text-emerald-400" />
                      ) : (
                        <Download size={20} />
                      )}
                    </button>

                    <button
                      onClick={() => toggleFavorite(currentSong.id, currentSong)}
                      className={`p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer ${
                        currentSong.isFavorite ? 'text-rose-500' : 'text-neutral-400'
                      }`}
                      title={currentSong.isFavorite ? 'Remove from Favourites' : 'Add to Favourites'}
                    >
                      <Heart size={20} className={currentSong.isFavorite ? 'fill-rose-500' : ''} />
                    </button>
                  </div>
                </div>

                {/* Technical Metadata pill */}
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {isDownloaded && (
                    <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm shadow-emerald-500/20">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      <span>Playing downloaded copy</span>
                    </span>
                  )}
                  {!isOnline && (
                    <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>Offline</span>
                    </span>
                  )}
                  {currentSong.isLiveRadio ? (
                    <>
                      <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        LIVE • ON AIR
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/5 text-amber-300 border border-amber-500/20">
                        {currentSong.bitrate || 128} kbps HD Stream
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/5 text-neutral-400 border border-white/5">
                        24/7 Digital FM
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-white/5 text-neutral-400 border border-white/5">
                        {currentSong.format || 'MP3'}
                      </span>

                      {currentSong.isAuraFlow && (
                        <div className="relative inline-block">
                          <button
                            type="button"
                            onClick={() => setShowAuraReasonDetail((prev) => !prev)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 hover:border-fuchsia-400/60 transition-colors cursor-pointer"
                            title={`Aura Flow: ${getAuraReasonLabel(currentSong.auraReason)} (Click for details)`}
                            aria-label="Aura Flow Recommendation Reason"
                          >
                            <Sparkles size={10} />
                            <span>{getAuraReasonLabel(currentSong.auraReason)}</span>
                          </button>

                          {showAuraReasonDetail && (
                            <div
                              className="absolute bottom-full left-0 mb-2 z-50 w-64 p-3 rounded-2xl bg-neutral-900/95 border border-fuchsia-500/30 shadow-2xl backdrop-blur-xl animate-fade-in text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
                                <div className="flex items-center gap-1.5 text-fuchsia-300 text-xs font-bold">
                                  <Sparkles size={12} />
                                  <span>{getAuraReasonLabel(currentSong.auraReason)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowAuraReasonDetail(false)}
                                  className="text-[10px] text-neutral-400 hover:text-white px-1 cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                              <p className="text-[11px] text-neutral-200 leading-relaxed">
                                {getAuraReasonExplanation(currentSong.auraReason)}
                              </p>
                              <p className="text-[9px] text-neutral-500 mt-1.5">
                                Aura Flow continuous smart autoplay
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      {currentSong.bitrate && (
                        <span className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                          currentSong.bitrate >= 320
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold'
                            : 'bg-white/5 text-neutral-400 border-white/5'
                        }`}>
                          {currentSong.bitrate} kbps
                        </span>
                      )}
                      {currentSong.fileSize > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/5 text-neutral-400 border border-white/5">
                          {formatBytes(currentSong.fileSize)}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Quick Feature Launchers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    onClick={() => setActiveModalTab('visualizer')}
                    className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 flex flex-col items-center gap-1.5 transition-all text-neutral-300 hover:text-white cursor-pointer"
                  >
                    <Activity size={18} className="text-indigo-400" />
                    <span className="text-[11px] font-semibold">Visualizer</span>
                  </button>

                  <button
                    onClick={() => setActiveModalTab('lyrics')}
                    className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 flex flex-col items-center gap-1.5 transition-all text-neutral-300 hover:text-white cursor-pointer"
                  >
                    <FileText size={18} className="text-purple-400" />
                    <span className="text-[11px] font-semibold">Lyrics</span>
                  </button>

                  <button
                    onClick={() => setActiveModalTab('equalizer')}
                    className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 flex flex-col items-center gap-1.5 transition-all text-neutral-300 hover:text-white cursor-pointer"
                  >
                    <Sliders size={18} className="text-emerald-400" />
                    <span className="text-[11px] font-semibold">Equalizer</span>
                  </button>

                  <button
                    onClick={() => setActiveModalTab('ai-insights')}
                    className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 flex flex-col items-center gap-1.5 transition-all text-neutral-300 hover:text-white cursor-pointer"
                  >
                    <Sparkles size={18} className="text-amber-400" />
                    <span className="text-[11px] font-semibold">AI Insights</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeModalTab === 'visualizer' && (
            <div className="w-full h-full max-w-4xl flex flex-col items-center justify-center my-auto py-4">
              <AudioVisualizer isPlaying={isPlaying} className="h-80 sm:h-96" />
              <div className="text-center mt-4">
                <h3 className="text-lg font-bold text-white">{currentSong.title}</h3>
                <p className="text-xs text-neutral-400">{currentSong.artist}</p>
              </div>
            </div>
          )}

          {activeModalTab === 'lyrics' && (
            <div className="w-full h-80 sm:h-96 flex flex-col my-auto py-4">
              <LyricsView song={currentSong} currentTime={currentTime} onSeek={seek} />
            </div>
          )}

          {activeModalTab === 'equalizer' && (
            <div className="w-full flex justify-center py-2 pb-6">
              <EqualizerPanel />
            </div>
          )}

          {activeModalTab === 'ai-insights' && (
            <div className="w-full h-80 sm:h-96 flex flex-col max-w-2xl mx-auto my-auto py-4">
              <AiSongInsights song={currentSong} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Area (shrink-0 mt-auto, pinned cleanly without overlapping) */}
      <div
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 14px)' }}
        className="shrink-0 mt-auto z-40 bg-[#07090e]/95 backdrop-blur-xl w-full border-t border-white/10 px-4 sm:px-6 pt-3"
      >
        <div className="w-full max-w-2xl mx-auto">
          {/* Progress Slider or Live Radio Status */}
          {currentSong.isLiveRadio ? (
            <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-red-500/10 border border-red-500/20 mb-3 sm:mb-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                  Live Studio Broadcast
                </span>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                Direct Feed • {currentSong.bitrate || 128} kbps
              </span>
            </div>
          ) : (
            <div className="space-y-1 mb-3 sm:mb-4">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Seek track position"
                className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-xs font-mono text-neutral-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Playback & Volume Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={toggleShuffle}
                className={`relative p-2 rounded-full transition-all cursor-pointer ${
                  shuffleMode === 'smart'
                    ? 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 shadow-sm shadow-emerald-500/30'
                    : isShuffle
                    ? 'text-indigo-400 bg-indigo-500/15'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title={
                  shuffleMode === 'smart'
                    ? 'Smart Shuffle Active ✨ (AI Discovery recommendations active)'
                    : isShuffle
                    ? 'True-Fair Shuffle Active 🔀 (Even artist & album spacing)'
                    : 'Shuffle: OFF (Click to cycle)'
                }
              >
                <Shuffle size={18} />
                {shuffleMode === 'smart' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-black" />
                )}
              </button>

              <button
                onClick={toggleAuraFlow}
                className={`p-2 rounded-full transition-all cursor-pointer ${
                  isAuraFlow
                    ? 'text-fuchsia-400 bg-fuchsia-500/20 border border-fuchsia-500/40 shadow-sm shadow-fuchsia-500/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title={`Aura Flow: ${isAuraFlow ? 'ON (Smart continuous autoplay)' : 'OFF'}`}
              >
                <InfinityIcon size={18} className={isAuraFlow ? 'animate-pulse text-fuchsia-400' : ''} />
              </button>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={previousSong}
                className="p-2 sm:p-2.5 rounded-full text-neutral-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Previous Track"
                title="Previous"
              >
                <SkipBack size={22} />
              </button>

              <button
                onClick={togglePlay}
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/20 cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title="Play / Pause"
              >
                {isPlaying ? <Pause size={24} className="fill-black" /> : <Play size={24} className="fill-black ml-0.5" />}
              </button>

              <button
                onClick={nextSong}
                className="p-2 sm:p-2.5 rounded-full text-neutral-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Next Track"
                title="Next"
              >
                <SkipForward size={22} />
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={cycleRepeat}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  repeatMode !== 'off' ? 'text-indigo-400 bg-indigo-500/15' : 'text-neutral-400 hover:text-white'
                }`}
                title={`Repeat: ${repeatMode}`}
              >
                {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
              </button>

              <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-white/10">
                <button
                  onClick={toggleMute}
                  className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume level"
                  className="w-16 h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
