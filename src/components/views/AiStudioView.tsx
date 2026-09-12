import React, { useState } from 'react';
import {
  Sparkles,
  Radio,
  Play,
  Flame,
  Loader2,
  Sliders,
  Disc,
  Music2,
  Volume2,
  ArrowRight,
  Headphones,
  Moon,
  Dumbbell,
  CloudRain,
  HeartCrack,
  PartyPopper,
  BookOpen,
  Coffee
} from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { AiDjPlaylist, Song } from '../../types/music';
import { audioEffectsService } from '../../services/audioEffectsService';

interface QuickMood {
  label: string;
  query: string;
  icon: React.ReactNode;
  badge: string;
  color: string;
}

const QUICK_MOODS: QuickMood[] = [
  {
    label: 'Late Night Drive',
    query: 'late night drive',
    icon: <Moon size={16} />,
    badge: 'Chill Synths',
    color: 'from-blue-600/30 to-indigo-600/20 border-indigo-500/30 hover:border-indigo-400'
  },
  {
    label: 'Gym Beast Mode',
    query: 'gym workout',
    icon: <Dumbbell size={16} />,
    badge: 'High Energy',
    color: 'from-orange-600/30 to-red-600/20 border-orange-500/30 hover:border-orange-400'
  },
  {
    label: 'Full Kuthu Party',
    query: 'party kuthu',
    icon: <PartyPopper size={16} />,
    badge: 'Bass Drops',
    color: 'from-amber-600/30 to-yellow-600/20 border-amber-500/30 hover:border-amber-400'
  },
  {
    label: 'Rainy Nostalgia',
    query: 'rainy melodies',
    icon: <CloudRain size={16} />,
    badge: 'Acoustic Peace',
    color: 'from-teal-600/30 to-cyan-600/20 border-teal-500/30 hover:border-teal-400'
  },
  {
    label: 'Soulful Heartbreak',
    query: 'breakup sad melodies',
    icon: <HeartCrack size={16} />,
    badge: 'Healing Deep',
    color: 'from-rose-600/30 to-pink-600/20 border-rose-500/30 hover:border-rose-400'
  },
  {
    label: '90s SPB Nostalgia',
    query: '90s ilaiyaraaja spb',
    icon: <Radio size={16} />,
    badge: 'Evergreen Vinyl',
    color: 'from-purple-600/30 to-violet-600/20 border-purple-500/30 hover:border-purple-400'
  },
  {
    label: 'Deep Study & Focus',
    query: 'study lofi focus',
    icon: <BookOpen size={16} />,
    badge: 'Zero Distraction',
    color: 'from-emerald-600/30 to-teal-600/20 border-emerald-500/30 hover:border-emerald-400'
  },
  {
    label: 'Morning Acoustic',
    query: 'morning acoustic calm',
    icon: <Coffee size={16} />,
    badge: 'Fresh Breeze',
    color: 'from-yellow-600/30 to-amber-600/20 border-yellow-500/30 hover:border-yellow-400'
  }
];

export const AiStudioView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playlist, setPlaylist] = useState<AiDjPlaylist | null>(null);
  const [isStreamingQueue, setIsStreamingQueue] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState('');

  const { playBatch, openWithTab } = usePlayerStore();
  const { songs: localSongs } = useLibraryStore();

  const handleGenerate = async (targetQuery: string) => {
    const q = targetQuery.trim() || 'late night drive';
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ai/dj?q=${encodeURIComponent(q)}`);
      const data: AiDjPlaylist = await res.json();
      setPlaylist(data);

      // Auto apply suggested EQ
      if (data.title) {
        audioEffectsService.autoTuneForSong(data.title, data.vibe);
      }
    } catch (err) {
      console.error('AI DJ generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamAllTracks = async () => {
    if (!playlist || playlist.tracks.length === 0) return;
    setIsStreamingQueue(true);
    setStreamingProgress('Searching & preparing cloud streaming queue...');

    try {
      const resolvedSongs: Song[] = [];

      // For the first 5 tracks, fetch search stream URLs
      for (let i = 0; i < Math.min(6, playlist.tracks.length); i++) {
        const item = playlist.tracks[i];
        setStreamingProgress(`Resolving "${item.title}"...`);

        // Check if exists in local library first
        const matchedLocal = localSongs.find(
          (s) => s.title.toLowerCase().includes(item.title.toLowerCase())
        );

        if (matchedLocal) {
          resolvedSongs.push(matchedLocal);
        } else {
          // Fetch from online stream API
          try {
            const searchRes = await fetch(
              `/api/online/search?q=${encodeURIComponent(`${item.title} ${item.artist}`)}`
            );
            const searchData = await searchRes.json();
            if (searchData.results && searchData.results.length > 0) {
              resolvedSongs.push(searchData.results[0]);
            }
          } catch (fetchErr) {
            console.warn(`Could not resolve online stream for ${item.title}:`, fetchErr);
          }
        }
      }

      if (resolvedSongs.length > 0) {
        // Auto tune EQ to the playlist vibe
        audioEffectsService.autoTuneForSong(playlist.title, playlist.vibe);
        await playBatch(resolvedSongs);
      }
    } catch (err) {
      console.error('Failed to stream AI mix:', err);
    } finally {
      setIsStreamingQueue(false);
      setStreamingProgress('');
    }
  };

  const handlePlaySingleTrack = async (trackTitle: string, trackArtist: string) => {
    setIsStreamingQueue(true);
    setStreamingProgress(`Streaming "${trackTitle}"...`);
    try {
      const searchRes = await fetch(
        `/api/online/search?q=${encodeURIComponent(`${trackTitle} ${trackArtist}`)}`
      );
      const searchData = await searchRes.json();
      if (searchData.results && searchData.results.length > 0) {
        audioEffectsService.autoTuneForSong(trackTitle, trackArtist);
        await playBatch([searchData.results[0]]);
      }
    } catch (err) {
      console.error('Play single track error:', err);
    } finally {
      setIsStreamingQueue(false);
      setStreamingProgress('');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto select-none pb-28">
      {/* Header Banner */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-pink-900/20 border border-indigo-500/20 overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-3">
            <Sparkles size={14} className="text-amber-400" />
            <span>Aura AI Music Studio</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            AI DJ & Smart Mood Studio
          </h2>
          <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
            Tell your AI DJ how you feel or describe any occasion. Aura will understand your mood,
            generate a tailored tracklist, automatically tune the 10-band equalizer, and stream the songs!
          </p>
        </div>
      </div>

      {/* Interactive Prompt Input */}
      <div className="space-y-4">
        <div className="relative max-w-3xl">
          <Sparkles size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerate(prompt);
            }}
            placeholder="Describe your vibe (e.g. 'Late night drive Harris Jayaraj melodies', 'Gym PR beast mode')..."
            className="w-full pl-12 pr-32 py-4 bg-white/5 border border-indigo-500/30 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xl transition-all"
          />
          <button
            onClick={() => handleGenerate(prompt)}
            disabled={isLoading || !prompt.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Radio size={14} />
            )}
            <span>Generate Mix</span>
          </button>
        </div>

        {/* Quick Mood Pills */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
            <Flame size={14} className="text-orange-400" />
            <span>Popular Vibe Presets</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {QUICK_MOODS.map((mood) => (
              <button
                key={mood.label}
                onClick={() => {
                  setPrompt(mood.query);
                  handleGenerate(mood.query);
                }}
                className={`p-3 rounded-2xl border bg-gradient-to-br ${mood.color} text-left transition-all hover:scale-[1.02] cursor-pointer flex flex-col justify-between gap-2 shadow-sm group`}
              >
                <div className="flex items-center justify-between">
                  <span className="p-1.5 rounded-lg bg-white/10 text-white group-hover:scale-110 transition-transform">
                    {mood.icon}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                    {mood.badge}
                  </span>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white group-hover:text-indigo-200 transition-colors">
                    {mood.label}
                  </h5>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Streaming Queue Progress Banner */}
      {isStreamingQueue && (
        <div className="p-4 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center gap-3 animate-pulse">
          <Loader2 size={18} className="text-indigo-400 animate-spin" />
          <span className="text-xs font-bold text-indigo-200">{streamingProgress}</span>
        </div>
      )}

      {/* Generated AI DJ Mix Display */}
      {playlist && (
        <div className="space-y-6 pt-2 animate-fade-in">
          {/* DJ Speech & Vibe Overview Card */}
          <div className="p-6 rounded-3xl glass-card border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-black/40 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {playlist.vibe}
                  </span>
                  <span className="text-xs font-mono text-neutral-400 flex items-center gap-1">
                    <Sliders size={12} className="text-indigo-400" />
                    EQ: {playlist.suggested_eq}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white">{playlist.title}</h3>
              </div>

              {/* Action: Stream All */}
              <button
                onClick={handleStreamAllTracks}
                disabled={isStreamingQueue}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
              >
                <Play size={14} className="fill-white" />
                <span>Stream This Playlist with AI DJ</span>
              </button>
            </div>

            {/* DJ Speech Commentary Box */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                🎧
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Aura AI DJ Voice Note
                </h5>
                <p className="text-xs text-neutral-300 italic mt-0.5 leading-relaxed">
                  "{playlist.intro}"
                </p>
              </div>
            </div>
          </div>

          {/* Curated Tracklist */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Disc size={14} className="text-purple-400" />
              <span>Curated Tracks ({playlist.tracks.length})</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {playlist.tracks.map((track, idx) => (
                <div
                  key={idx}
                  onClick={() => handlePlaySingleTrack(track.title, track.artist)}
                  className="p-3.5 rounded-2xl glass-card border border-white/5 hover:border-indigo-500/40 transition-all flex items-center justify-between gap-3 cursor-pointer group hover:bg-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 text-center text-xs font-mono text-neutral-500 group-hover:text-indigo-400 font-bold">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h5 className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                        {track.title}
                      </h5>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">{track.artist}</p>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 group-hover:bg-indigo-600 text-indigo-300 group-hover:text-white flex items-center justify-center shrink-0 transition-all shadow-sm">
                    <Play size={13} className="fill-current ml-0.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
