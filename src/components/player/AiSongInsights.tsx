import React, { useState, useEffect } from 'react';
import { Sparkles, BookOpen, Music2, Sliders, Check, Loader2, Quote, Lightbulb } from 'lucide-react';
import { Song, SongAiInsights } from '../../types/music';
import { audioEffectsService } from '../../services/audioEffectsService';

interface AiSongInsightsProps {
  song: Song;
}

export const AiSongInsights: React.FC<AiSongInsightsProps> = ({ song }) => {
  const [insights, setInsights] = useState<SongAiInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [appliedEq, setAppliedEq] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setAppliedEq(false);

    const fetchInsights = async () => {
      try {
        const res = await fetch(
          `/api/ai/insights?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(
            song.artist || ''
          )}`
        );
        const data: SongAiInsights = await res.json();
        if (isMounted) {
          setInsights(data);
        }
      } catch (err) {
        console.error('Failed to load song insights:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchInsights();
    return () => {
      isMounted = false;
    };
  }, [song.title, song.artist]);

  const handleApplyEq = () => {
    audioEffectsService.autoTuneForSong(song.title, song.artist);
    setAppliedEq(true);
    setTimeout(() => setAppliedEq(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="h-full min-h-[350px] flex flex-col items-center justify-center gap-3 glass-card rounded-2xl p-8 border border-white/5">
        <Loader2 size={32} className="text-indigo-400 animate-spin" />
        <p className="text-sm font-semibold text-neutral-300">
          Aura AI is analyzing song lyrics, theme & story...
        </p>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-8 text-neutral-500">
        <p className="text-sm">No insights available for this song.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-6 select-none scrollbar-thin">
      {/* Theme & Emotion Summary Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600/15 via-purple-600/10 to-pink-600/10 border border-indigo-500/20 shadow-lg space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Sparkles size={16} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Aura AI Musical Analysis
            </span>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {insights.emotion}
          </span>
        </div>

        <p className="text-sm font-medium text-white leading-relaxed">{insights.theme}</p>
      </div>

      {/* Story & Background Box */}
      <div className="p-5 rounded-2xl glass-card border border-white/10 space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
          <BookOpen size={14} className="text-amber-400" />
          <span>The Story Behind The Song</span>
        </h4>
        <p className="text-xs text-neutral-300 leading-relaxed">{insights.story}</p>
      </div>

      {/* Key Lyric Lines & Meaning Breakdown */}
      {insights.lines && insights.lines.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Quote size={14} className="text-emerald-400" />
            <span>Key Lyrics & Meaning</span>
          </h4>

          <div className="space-y-2.5">
            {insights.lines.map((line, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1 hover:border-emerald-500/30 transition-colors"
              >
                <p className="text-xs font-bold text-emerald-300">"{line.tamil}"</p>
                <p className="text-xs text-neutral-300 leading-normal">{line.meaning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Composer & Production Notes + Recommended EQ */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-300">
            <Lightbulb size={14} className="text-amber-400" />
            <span>Recommended Equalizer:</span>
          </div>
          <p className="text-xs text-neutral-400">{insights.recommended_eq}</p>
        </div>

        <button
          onClick={handleApplyEq}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto shrink-0 ${
            appliedEq
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
          }`}
        >
          {appliedEq ? <Check size={14} /> : <Sliders size={14} />}
          <span>{appliedEq ? 'EQ Tuned by AI!' : 'Auto-Tune Equalizer'}</span>
        </button>
      </div>
    </div>
  );
};
