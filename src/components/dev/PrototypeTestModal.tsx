import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Smartphone,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Lock,
  Headphones,
  RotateCcw,
  Zap,
  Terminal
} from 'lucide-react';
import {
  prototypePipeline,
  PROTOTYPE_BENCHMARK_TRACKS,
  PrototypeTrack,
  PrototypeMetrics
} from '../../services/prototypePlaybackPipeline';

interface PrototypeTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrototypeTestModal: React.FC<PrototypeTestModalProps> = ({ isOpen, onClose }) => {
  const [tracks, setTracks] = useState<PrototypeTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [metrics, setMetrics] = useState<PrototypeMetrics>({
    totalProcessed: 0,
    saavnMatchedCount: 0,
    ytdlpResolvedCount: 0,
    iframeFallbackCount: 0,
    resolverSuccessRate: 0,
    activePlayer: 'NONE',
    isPlaying: false,
    screenOffDurationSec: 0,
    isScreenLocked: false,
    mediaActionCount: 0
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [serverUrl, setServerUrl] = useState<string>('http://10.135.246.125:3000');
  const [customInput, setCustomInput] = useState<string>('');
  const [showLogs, setShowLogs] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = prototypePipeline.subscribe((newTracks, newIdx, newMetrics, newLogs) => {
      setTracks([...newTracks]);
      setCurrentIndex(newIdx);
      setMetrics({ ...newMetrics });
      setLogs([...newLogs]);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyServerUrl = () => {
    prototypePipeline.setServerBaseUrl(serverUrl);
  };

  const handleStartBenchmark = async () => {
    handleApplyServerUrl();
    prototypePipeline.loadTracks(PROTOTYPE_BENCHMARK_TRACKS);
    await prototypePipeline.playTrackAtIndex(0);
  };

  const handleReset = () => {
    prototypePipeline.reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0f1118]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide flex items-center gap-2">
                YouTube Background-Playback Prototype
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  DEV TEST HARNESS
                </span>
              </h2>
              <p className="text-xs text-white/50">
                Spotify/YT Playlist → Saavn Match → yt-dlp Resolver → Native ExoPlayer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Server Config & Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-purple-400" />
                Backend yt-dlp Resolver Host (for real Android device Wi-Fi/ADB)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="e.g. http://10.135.246.125:3000 or http://localhost:3000"
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-black/40 border border-white/10 focus:border-purple-500 focus:outline-none"
                />
                <button
                  onClick={handleApplyServerUrl}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors"
                >
                  Set Host
                </button>
              </div>
              <p className="text-[11px] text-white/40">
                Over USB debugging run <code className="text-purple-300">adb reverse tcp:3000 tcp:3000</code> or use your PC Wi-Fi IP.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <button
                onClick={handleStartBenchmark}
                className="w-full py-2.5 px-4 text-xs font-bold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                Run Benchmark Matrix
              </button>
              <button
                onClick={handleReset}
                className="w-full py-2 px-4 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Pipeline
              </button>
            </div>
          </div>

          {/* Metrics Telemetry Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <span className="text-[11px] text-white/50 block font-medium">Saavn Matches (Tier 1)</span>
              <div className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {metrics.saavnMatchedCount}
              </div>
              <span className="text-[10px] text-white/40">Direct 320k Saavn CDN</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <span className="text-[11px] text-white/50 block font-medium">yt-dlp Resolved (Tier 2)</span>
              <div className="text-xl font-bold text-blue-400 flex items-center gap-2">
                <Radio className="w-4 h-4" />
                {metrics.ytdlpResolvedCount}
              </div>
              <span className="text-[10px] text-white/40">Direct M4A Stream</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <span className="text-[11px] text-white/50 block font-medium">IFrame Fallback (Tier 3)</span>
              <div className="text-xl font-bold text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {metrics.iframeFallbackCount}
              </div>
              <span className="text-[10px] text-white/40">Foreground-only</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
              <span className="text-[11px] text-white/50 block font-medium">Native ExoPlayer Rate</span>
              <div className="text-xl font-bold text-purple-400 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                {metrics.resolverSuccessRate}%
              </div>
              <span className="text-[10px] text-white/40">Background Playable</span>
            </div>
          </div>

          {/* Screen-Off & Bluetooth Controls Live Monitor */}
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${metrics.isScreenLocked ? 'bg-amber-500/20 text-amber-400' : 'bg-purple-500/20 text-purple-400'}`}>
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold block">
                  Screen-Off Continuity: {metrics.isScreenLocked ? 'Screen Locked 🔒' : 'Screen Active 📱'}
                </span>
                <span className="text-[11px] text-white/50">
                  Continuous screen-off duration: <strong className="text-purple-300 font-mono">{metrics.screenOffDurationSec}s</strong> (Target: 30-60s)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold block">
                  Bluetooth / AVRCP Controls: {metrics.lastMediaAction || 'Waiting for click'}
                </span>
                <span className="text-[11px] text-white/50">
                  Total action events captured: <strong className="text-blue-300 font-mono">{metrics.mediaActionCount}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs">
              <Activity className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span>Active Engine: <strong>{metrics.activePlayer}</strong></span>
            </div>
          </div>

          {/* Track Queue */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
              Prototype Queue ({tracks.length} Tracks)
            </h3>
            {tracks.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-white/5 text-white/40 text-xs">
                No tracks loaded. Click <strong>"Run Benchmark Matrix"</strong> above to test all 3 architectural tiers.
              </div>
            ) : (
              <div className="space-y-1.5">
                {tracks.map((t, idx) => {
                  const isCurrent = idx === currentIndex;
                  return (
                    <div
                      key={t.id}
                      onClick={() => prototypePipeline.playTrackAtIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-purple-600/20 border-purple-500/50 shadow-md shadow-purple-600/10'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-white/40 w-5">{idx + 1}</span>
                        {t.coverArt ? (
                          <img src={t.coverArt} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-xs">
                            🎵
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-purple-300' : 'text-white'}`}>
                            {t.title}
                          </p>
                          <p className="text-[11px] text-white/50 truncate">{t.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {t.resolutionTier === 'SAAVN_NATIVE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Saavn 320k (ExoPlayer)
                          </span>
                        )}
                        {t.resolutionTier === 'YTDLP_NATIVE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            yt-dlp M4A (ExoPlayer)
                          </span>
                        )}
                        {t.resolutionTier === 'IFRAME_FALLBACK' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            IFrame Foreground
                          </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          t.status === 'PLAYING' ? 'bg-purple-500 text-white font-bold animate-pulse' : 'bg-white/5 text-white/50'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Player Controls */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => prototypePipeline.previous()}
                className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title="Previous Track (Bluetooth Simulation)"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={() => (metrics.isPlaying ? prototypePipeline.pause() : prototypePipeline.resume())}
                className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 transition-all"
                title="Play / Pause"
              >
                {metrics.isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              </button>
              <button
                onClick={() => prototypePipeline.next()}
                className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title="Next Track (Bluetooth Simulation)"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => prototypePipeline.seek(30)}
                className="px-2.5 py-1 text-[11px] rounded bg-white/5 hover:bg-white/10 border border-white/10 text-white/70"
              >
                Seek 30s
              </button>
              <button
                onClick={() => prototypePipeline.seek(120)}
                className="px-2.5 py-1 text-[11px] rounded bg-white/5 hover:bg-white/10 border border-white/10 text-white/70"
              >
                Seek 2m
              </button>
            </div>
          </div>

          {/* Diagnostic Console Logs */}
          <div className="rounded-xl border border-white/10 bg-black/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2 text-xs font-mono text-white/60">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span>Live Pipeline Diagnostics ({logs.length} events)</span>
              </div>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-[11px] text-purple-400 hover:underline"
              >
                {showLogs ? 'Hide Logs' : 'Show Logs'}
              </button>
            </div>
            {showLogs && (
              <div className="p-3 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1 text-white/70">
                {logs.length === 0 ? (
                  <p className="text-white/30 italic">No events logged yet. Start playback to view live diagnostics.</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="leading-relaxed">
                      {log.includes('EXOPLAYER') || log.includes('MATCH FOUND') || log.includes('DIRECT STREAM') ? (
                        <span className="text-emerald-400 font-semibold">{log}</span>
                      ) : log.includes('Fallback') || log.includes('Screen-Off') ? (
                        <span className="text-amber-400">{log}</span>
                      ) : log.includes('Error') || log.includes('FAILED') ? (
                        <span className="text-rose-400">{log}</span>
                      ) : (
                        <span>{log}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
