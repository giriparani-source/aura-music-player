import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Edit3,
  Check,
  X,
  Sparkles,
  Music2,
  Mic2,
  RotateCcw,
  Loader2,
  Plus,
  Minus
} from 'lucide-react';
import { Song } from '../../types/music';
import {
  parseLrcLyrics,
  parsePlainTextLyrics,
  findActiveLyricIndex,
  applySyncOffset,
  generateDemoSyncedLyrics,
  LyricLine
} from '../../utils/lyricsParser';
import { lyricsService } from '../../services/lyricsService';
import { musicDB } from '../../services/db';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { AiSongInsights } from './AiSongInsights';

interface LyricsViewProps {
  song: Song;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ song, currentTime, onSeek }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [useDemo, setUseDemo] = useState(false);
  const [showAiMeaning, setShowAiMeaning] = useState(false);
  const [isLoadingOnline, setIsLoadingOnline] = useState(false);
  const [syncOffset, setSyncOffset] = useState<number>(0); // -0.5s, 0s, +0.5s etc.
  const [fetchedLyrics, setFetchedLyrics] = useState<string | null>(song.lyrics || null);
  const [lyricsSource, setLyricsSource] = useState<string>(song.lyrics ? 'local' : 'none');

  const { loadLibrary } = useLibraryStore();
  const { isKaraoke, toggleKaraoke, karaokeDepth, setKaraokeDepth } = usePlayerStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Auto-fetch synced lyrics when opening tab or when song changes
  useEffect(() => {
    let isCancelled = false;

    setSyncOffset(0);
    setUseDemo(false);

    if (song.lyrics && song.lyrics.trim().length > 0) {
      setFetchedLyrics(song.lyrics);
      setLyricsSource('local');
      return;
    }

    // Attempt online resolution via lyricsService (LRCLIB -> JioSaavn -> Cache)
    setIsLoadingOnline(true);
    lyricsService
      .getLyricsForSong(song)
      .then((res) => {
        if (isCancelled) return;
        if (res.rawLyrics) {
          setFetchedLyrics(res.rawLyrics);
          setLyricsSource(res.source);
        } else {
          setFetchedLyrics(null);
          setLyricsSource('none');
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setFetchedLyrics(null);
          setLyricsSource('none');
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingOnline(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [song.id, song.title, song.artist, song.lyrics]);

  // Parse lyrics from fetchedLyrics or demo
  const { syncedLines, isLrc, plainLines } = useMemo(() => {
    const raw = fetchedLyrics?.trim();

    if (raw) {
      const parsedLrc = parseLrcLyrics(raw);
      if (parsedLrc.length > 0) {
        return { syncedLines: parsedLrc, isLrc: true, plainLines: [] };
      }
      return { syncedLines: [], isLrc: false, plainLines: parsePlainTextLyrics(raw) };
    }

    if (useDemo) {
      const demo = generateDemoSyncedLyrics(song.title, song.artist, song.duration);
      return { syncedLines: demo, isLrc: true, plainLines: [] };
    }

    return { syncedLines: [], isLrc: false, plainLines: [] };
  }, [fetchedLyrics, song.title, song.artist, song.duration, useDemo]);

  // Find active line index taking manual sync offset into account
  const activeIndex = useMemo(() => {
    if (!isLrc || syncedLines.length === 0) return -1;
    const effectiveTime = applySyncOffset(currentTime, syncOffset);
    return findActiveLyricIndex(syncedLines, effectiveTime);
  }, [isLrc, syncedLines, currentTime, syncOffset]);

  // Smooth centered auto-scroll
  useEffect(() => {
    if (isUserScrollingRef.current || activeIndex === -1 || !activeLineRef.current) {
      return;
    }

    activeLineRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, [activeIndex]);

  // User scroll detection prevents auto-scroll fighting
  const handleScroll = useCallback(() => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 2800);
  }, []);

  const handleSaveLyrics = async () => {
    try {
      const updatedLyrics = editText.trim();
      setFetchedLyrics(updatedLyrics || null);
      const updatedSong: Song = {
        ...song,
        lyrics: updatedLyrics || undefined
      };
      await musicDB.saveSong(updatedSong);
      lyricsService.clearCache(song.id);
      await loadLibrary();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save lyrics:', err);
    }
  };

  const startEdit = () => {
    setEditText(fetchedLyrics || '');
    setIsEditing(true);
  };

  const handleLineClick = (line: LyricLine) => {
    // Offset-adjusted seek
    const targetSecond = Math.max(0, line.time - syncOffset);
    onSeek(targetSecond);
  };

  return (
    <div className="w-full h-full max-w-4xl mx-auto flex flex-col justify-between select-none relative">
      {/* Top Toolbar (Karaoke Controls, Sync Offset, Tools) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-white/5 shrink-0 bg-white/[0.02] backdrop-blur-md rounded-2xl mx-2 mt-1">
        {/* Left: Status & Sync Badge */}
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-indigo-400" />
          <span className="text-xs font-bold text-neutral-200">
            {isLrc ? 'Synchronized Lyrics' : plainLines.length > 0 ? 'Plain Lyrics (Unsynced)' : 'Lyrics'}
          </span>

          {isLoadingOnline ? (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 animate-pulse">
              <Loader2 size={10} className="animate-spin" />
              Syncing...
            </span>
          ) : isLrc ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-bold tracking-wider">
              KARAOKE SYNC
            </span>
          ) : null}

          {lyricsSource !== 'none' && lyricsSource !== 'local' && (
            <span className="hidden sm:inline text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 font-mono">
              {lyricsSource}
            </span>
          )}
        </div>

        {/* Right: Controls (Vocal Cut, Sync Offset, Edit) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Karaoke / Vocal Cut Button (Calls Existing audioEffectsService Vocal Cut) */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10">
            <button
              onClick={toggleKaraoke}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isKaraoke
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
              title={isKaraoke ? 'Vocal Cut Active: Center vocals attenuated' : 'Enable Vocal Cut for Karaoke'}
            >
              <Mic2 size={13} className={isKaraoke ? 'animate-pulse text-emerald-400' : ''} />
              <span>Vocal Cut: {isKaraoke ? 'ON' : 'OFF'}</span>
            </button>

            {isKaraoke && (
              <div className="hidden sm:flex items-center gap-1 px-1 text-[10px] text-neutral-300 font-mono">
                <button
                  onClick={() => setKaraokeDepth(0.5)}
                  className={`px-1.5 py-0.5 rounded ${
                    karaokeDepth <= 0.6 ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                  title="50% Vocal Cut (Backing Vocals Intact)"
                >
                  50%
                </button>
                <button
                  onClick={() => setKaraokeDepth(1.0)}
                  className={`px-1.5 py-0.5 rounded ${
                    karaokeDepth > 0.8 ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                  title="100% Full Vocal Cancellation"
                >
                  100%
                </button>
              </div>
            )}
          </div>

          {/* Sync Offset Calibration (-0.5s / 0s / +0.5s) */}
          {isLrc && (
            <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              <span className="text-[10px] text-neutral-400 mr-1 hidden sm:inline">Sync:</span>
              <button
                onClick={() => setSyncOffset((prev) => Math.round((prev - 0.5) * 10) / 10)}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Delay lyrics (-0.5s)"
                aria-label="Delay lyrics"
              >
                <Minus size={11} />
              </button>
              <span className="text-[10px] font-mono px-1 text-indigo-300 min-w-[28px] text-center">
                {syncOffset > 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
              </span>
              <button
                onClick={() => setSyncOffset((prev) => Math.round((prev + 0.5) * 10) / 10)}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Advance lyrics (+0.5s)"
                aria-label="Advance lyrics"
              >
                <Plus size={11} />
              </button>
              {syncOffset !== 0 && (
                <button
                  onClick={() => setSyncOffset(0)}
                  className="p-1 rounded text-neutral-400 hover:text-amber-400 hover:bg-white/10"
                  title="Reset Sync Offset to 0s"
                >
                  <RotateCcw size={10} />
                </button>
              )}
            </div>
          )}

          {/* AI Meaning Toggle */}
          <button
            onClick={() => setShowAiMeaning(!showAiMeaning)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs transition-colors border cursor-pointer ${
              showAiMeaning
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-white/5 text-neutral-400 border-white/5 hover:text-white'
            }`}
            title="Toggle AI Lyric Meaning & Context"
          >
            <Sparkles size={12} className={showAiMeaning ? 'text-amber-400' : ''} />
            <span className="hidden sm:inline">AI Story</span>
          </button>

          {/* Edit / Paste Lyrics */}
          <button
            onClick={startEdit}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs transition-colors border border-white/5 cursor-pointer"
            title="Edit or Paste Custom Lyrics"
          >
            <Edit3 size={12} />
            <span className="hidden sm:inline">{fetchedLyrics ? 'Edit' : 'Add'}</span>
          </button>
        </div>
      </div>

      {/* Main Lyrics Stage Area */}
      {showAiMeaning ? (
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          <AiSongInsights song={song} />
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 sm:px-12 py-16 space-y-6 text-center scrollbar-none relative"
          style={{ scrollBehavior: 'smooth' }}
        >
          {isLoadingOnline ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-neutral-400 space-y-3">
              <Loader2 size={32} className="animate-spin text-indigo-400" />
              <p className="text-sm font-medium text-neutral-300">Fetching synchronized lyrics...</p>
              <p className="text-xs text-neutral-500 font-mono">Querying LRCLIB & JioSaavn databases</p>
            </div>
          ) : isLrc && syncedLines.length > 0 ? (
            syncedLines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;

              return (
                <div
                  key={`${line.time}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => handleLineClick(line)}
                  className={`cursor-pointer transition-all duration-300 py-2.5 px-6 rounded-2xl group ${
                    isActive
                      ? 'text-white text-2xl sm:text-3xl font-black scale-105 drop-shadow-[0_0_24px_rgba(99,102,241,0.6)] bg-white/[0.04] border border-indigo-500/25 ring-1 ring-indigo-500/20'
                      : isPast
                      ? 'text-neutral-500 hover:text-neutral-300 text-base sm:text-xl font-medium'
                      : 'text-neutral-400 hover:text-neutral-200 text-base sm:text-xl font-medium'
                  }`}
                >
                  <span className="inline-block transition-transform group-hover:scale-102">
                    {line.text}
                  </span>
                </div>
              );
            })
          ) : plainLines.length > 0 ? (
            <div className="space-y-4 max-w-2xl mx-auto py-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs mb-4">
                <span>Plain text lyrics (Timestamps not available for this track)</span>
              </div>
              {plainLines.map((line, i) => (
                <p key={i} className="text-base sm:text-lg text-neutral-300 font-medium leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[240px] text-neutral-500 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-neutral-400">
                <Music2 size={26} />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-300">No lyrics available for this song</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  Click &ldquo;Add&rdquo; in the top bar to paste standard LRC or text lyrics, or try &ldquo;Demo Sync&rdquo; to test the Karaoke experience!
                </p>
              </div>
              <button
                onClick={() => setUseDemo(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer"
              >
                <Sparkles size={13} />
                <span>Test with Demo Sync</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit / Paste Custom Lyrics Modal */}
      {isEditing && (
        <div className="absolute inset-0 z-30 bg-neutral-950/95 backdrop-blur-xl p-6 flex flex-col justify-between rounded-3xl border border-white/10 shadow-2xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 size={15} className="text-indigo-400" />
              <span>Edit Lyrics for &ldquo;{song.title}&rdquo;</span>
            </h4>
            <button
              onClick={() => setIsEditing(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="my-4 flex-1 flex flex-col">
            <p className="text-xs text-neutral-400 mb-2">
              Tip: Paste standard LRC format (e.g. <code className="text-indigo-300">[01:23.45] Song line</code>) for synchronized karaoke playback, or paste plain text lines.
            </p>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="[00:15.00] First line of song&#10;[00:20.50] Second line of song..."
              className="flex-1 w-full p-4 rounded-2xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveLyrics}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Check size={14} />
              <span>Save Lyrics</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
