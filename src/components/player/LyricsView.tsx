import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FileText, Edit3, Check, X, Sparkles, Music2 } from 'lucide-react';
import { Song } from '../../types/music';
import {
  parseLrcLyrics,
  parsePlainTextLyrics,
  findActiveLyricIndex,
  generateDemoSyncedLyrics
} from '../../utils/lyricsParser';
import { musicDB } from '../../services/db';
import { useLibraryStore } from '../../store/useLibraryStore';
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
  const { loadLibrary } = useLibraryStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Parse lyrics from song.lyrics or demo
  const { syncedLines, isLrc, plainLines } = useMemo(() => {
    const raw = song.lyrics?.trim();

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
  }, [song.lyrics, song.title, song.artist, song.duration, useDemo]);

  const activeIndex = useMemo(() => {
    if (!isLrc || syncedLines.length === 0) return -1;
    return findActiveLyricIndex(syncedLines, currentTime);
  }, [isLrc, syncedLines, currentTime]);

  // Auto-scroll to active line
  useEffect(() => {
    if (isUserScrollingRef.current || activeIndex === -1 || !activeLineRef.current) {
      return;
    }

    activeLineRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, [activeIndex]);

  // Detect user scroll so auto-scroll doesn't jerk the view while reading
  const handleScroll = () => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 2800);
  };

  const handleSaveLyrics = async () => {
    try {
      const updatedSong: Song = {
        ...song,
        lyrics: editText.trim()
      };
      await musicDB.saveSong(updatedSong);
      await loadLibrary();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save lyrics:', err);
    }
  };

  const startEdit = () => {
    setEditText(song.lyrics || '');
    setIsEditing(true);
  };

  return (
    <div className="w-full h-full max-w-3xl mx-auto flex flex-col justify-between select-none relative">
      {/* Top Bar / Tools */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-indigo-400" />
          <span className="text-xs font-semibold text-neutral-300">
            {isLrc ? 'Synchronized Lyrics' : plainLines.length > 0 ? 'Plain Lyrics' : 'No Lyrics'}
          </span>
          {isLrc && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
              KARAOKE SYNC
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* AI Meaning Toggle */}
          <button
            onClick={() => setShowAiMeaning(!showAiMeaning)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs transition-colors border cursor-pointer ${
              showAiMeaning
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-white/5 text-neutral-400 border-white/5 hover:text-white'
            }`}
            title="Toggle AI Lyric Meaning & Story"
          >
            <Sparkles size={13} className={showAiMeaning ? 'text-amber-400' : ''} />
            <span>AI Meaning</span>
          </button>

          {!song.lyrics && (
            <button
              onClick={() => setUseDemo(!useDemo)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs transition-colors border ${
                useDemo
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  : 'bg-white/5 text-neutral-400 border-white/5 hover:text-white'
              }`}
              title="Toggle Karaoke Demo Synced Lyrics"
            >
              <Sparkles size={13} />
              <span>Demo Sync</span>
            </button>
          )}

          <button
            onClick={startEdit}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs transition-colors border border-white/5 cursor-pointer"
            title="Edit or Paste Custom Lyrics"
          >
            <Edit3 size={13} />
            <span>{song.lyrics ? 'Edit' : 'Add Lyrics'}</span>
          </button>
        </div>
      </div>

      {showAiMeaning ? (
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          <AiSongInsights song={song} />
        </div>
      ) : (
        /* Main Lyrics Display Area */
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-12 space-y-6 text-center scrollbar-none"
          style={{ scrollBehavior: 'smooth' }}
        >
        {isLrc && syncedLines.length > 0 ? (
          syncedLines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            return (
              <div
                key={`${line.time}-${idx}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => onSeek(line.time)}
                className={`cursor-pointer transition-all duration-300 py-1.5 px-4 rounded-2xl group ${
                  isActive
                    ? 'text-white text-xl sm:text-2xl font-extrabold scale-105 drop-shadow-[0_0_16px_rgba(99,102,241,0.5)]'
                    : isPast
                    ? 'text-neutral-500 hover:text-neutral-300 text-base sm:text-lg font-medium'
                    : 'text-neutral-400 hover:text-neutral-200 text-base sm:text-lg font-medium'
                }`}
              >
                <span className="inline-block transition-transform group-hover:scale-102">
                  {line.text}
                </span>
              </div>
            );
          })
        ) : plainLines.length > 0 ? (
          <div className="space-y-3">
            {plainLines.map((l, i) => (
              <p key={i} className="text-base sm:text-lg text-neutral-300 font-medium leading-relaxed">
                {l}
              </p>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-neutral-500 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-neutral-400">
              <Music2 size={26} />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-300">No lyrics available for this song</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Click &quot;Add Lyrics&quot; above to paste standard LRC or text lyrics, or try &quot;Demo Sync&quot; to test the karaoke experience!
              </p>
            </div>
          </div>
        )}
      </div>
    )}

      {/* Edit / Paste Lyrics Modal */}
      {isEditing && (
        <div className="absolute inset-0 z-30 bg-neutral-950/95 backdrop-blur-xl p-6 flex flex-col justify-between rounded-3xl border border-white/10 shadow-2xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 size={15} className="text-indigo-400" />
              <span>Edit Lyrics for &ldquo;{song.title}&rdquo;</span>
            </h4>
            <button
              onClick={() => setIsEditing(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="my-4 flex-1 flex flex-col">
            <p className="text-xs text-neutral-400 mb-2">
              Tip: Paste standard LRC format (e.g. <code className="text-indigo-300">[01:23.45] Song line</code>) for synchronized karaoke playback, or simply paste plain text lines.
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
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveLyrics}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg shadow-indigo-600/30"
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
