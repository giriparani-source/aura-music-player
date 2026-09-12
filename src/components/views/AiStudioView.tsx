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

import { jiosaavnService } from '../../services/jiosaavnService';

// Client-side AI DJ Playlist Synthesizer for Vercel static and offline environments
const generateClientAiDjPlaylist = (query: string): AiDjPlaylist => {
  const q = query.toLowerCase().trim();

  if (q.includes('gym') || q.includes('workout') || q.includes('beast')) {
    return {
      title: 'Aura Beast Mode • High Adrenaline Workout',
      vibe: 'High Adrenaline & Heavy Drops',
      intro: 'Get ready to smash your PR nanba! Crank the volume up, heavy bass kick-in aagudhu!',
      suggested_eq: 'Bass Booster (+6dB Sub & Kick)',
      tracks: [
        { title: 'Hukum - Thalaivar Alappara', artist: 'Anirudh Ravichander • Jailer' },
        { title: 'Naa Ready', artist: 'Thalapathy Vijay, Anirudh • Leo' },
        { title: 'Illuminati', artist: 'Sushin Shyam, Dabzee • Aavesham' },
        { title: 'Badass', artist: 'Anirudh Ravichander • Leo' },
        { title: 'Arabic Kuthu', artist: 'Anirudh Ravichander • Beast' },
        { title: 'Manasilaayo', artist: 'Anirudh Ravichander • Vettaiyan' }
      ]
    };
  }

  if (q.includes('party') || q.includes('kuthu') || q.includes('dance')) {
    return {
      title: 'Aura Kollywood Kuthu Blast 2026',
      vibe: 'Unstoppable Dance & Dappankuthu',
      intro: 'Speaker full volume veinga! Dance floor-ah fire aakaporom, non-stop dance anthems ready!',
      suggested_eq: 'Electronic & Dance Club (+5dB Bass, +3dB Highs)',
      tracks: [
        { title: 'Arabic Kuthu - Halamithi Habibo', artist: 'Anirudh Ravichander • Beast' },
        { title: 'Manasilaayo', artist: 'Anirudh Ravichander, Malaysia Vasudevan • Vettaiyan' },
        { title: 'Naa Ready', artist: 'Thalapathy Vijay • Leo' },
        { title: 'Hukum', artist: 'Anirudh Ravichander • Jailer' },
        { title: 'Illuminati', artist: 'Sushin Shyam • Aavesham' },
        { title: 'Jalabulanjangu', artist: 'Anirudh Ravichander • Don' }
      ]
    };
  }

  if (q.includes('rain') || q.includes('nostalgia') || q.includes('acoustic') || q.includes('morning')) {
    return {
      title: 'Aura Monsoon Breeze & Rainy Melodies',
      vibe: 'Acoustic Peace & Warm Solitude',
      intro: 'Mazhai saaral, warm coffee, and soothing melodies... Soul-ah heal panna indha playlist!',
      suggested_eq: 'Acoustic Clarity (+3dB Mids & Vocal)',
      tracks: [
        { title: 'Vaseegara', artist: 'Bombay Jayashri, Harris Jayaraj • Minnale' },
        { title: 'Venmathi Venmathiye', artist: 'Roop Kumar Rathod, Tipu • Minnale' },
        { title: 'Poongatrile', artist: 'Unni Menon, Swarnalatha • Dil Se' },
        { title: 'Marakkuma Nenjam', artist: 'A.R. Rahman • VTK' },
        { title: 'Enna Solla Pogirai', artist: 'Shankar Mahadevan • Kandukondain' }
      ]
    };
  }

  if (q.includes('sad') || q.includes('breakup') || q.includes('heart') || q.includes('alone')) {
    return {
      title: 'Aura Midnight Melancholy & Deep Solitude',
      vibe: 'Deep Heartbreak & Emotional Healing',
      intro: 'Manasula irukura baratha korukka oru soulful escape. Feel every chord and lyric nanba.',
      suggested_eq: 'Classical Reverb & Soft Presence',
      tracks: [
        { title: 'Kanave Kanave', artist: 'Anirudh Ravichander • David' },
        { title: 'Nenjame Nenjame', artist: 'Vijay Yesudas • Meiyazhagan' },
        { title: 'Pogadha Ennai Thaandi', artist: 'Pradeep Kumar • Vikram Vedha' },
        { title: 'New York Nagaram', artist: 'A.R. Rahman • Sillunu Oru Kaadhal' },
        { title: 'Vaseegara', artist: 'Bombay Jayashri • Minnale' }
      ]
    };
  }

  if (q.includes('90s') || q.includes('ilaiyaraaja') || q.includes('spb')) {
    return {
      title: 'Aura 90s Golden Vinyl • Maestro Classics',
      vibe: 'Evergreen Ilaiyaraaja & SPB Magic',
      intro: 'Golden age-oda timeless string orchestrations and SPB vocals... Vinyl vintage quality!',
      suggested_eq: 'Warm Analog Tape & Vocal Warmth',
      tracks: [
        { title: 'Ilaya Nila Pozhigirathe', artist: 'SPB • Payanangal Mudivathillai' },
        { title: 'Mandram Vantha Thendralukku', artist: 'SPB, Ilaiyaraaja • Mouna Ragam' },
        { title: 'Raja Raja Chozhan Naan', artist: 'KJ Yesudas, Ilaiyaraaja • Rettai Vaal Kuruvi' },
        { title: 'Thendral Vanthu Theendumbothu', artist: 'Ilaiyaraaja, S. Janaki • Avatharam' },
        { title: 'Sundari Kannal Oru Sethi', artist: 'SPB, S. Janaki • Thalapathi' }
      ]
    };
  }

  // Default Late Night Drive
  return {
    title: 'Aura Late Night Drive • Neon Synth Highway',
    vibe: 'Smooth Melodic Synths & Chill Bass',
    intro: 'Empty roads, cool night breeze, and hypnotic basslines. Inaiku night drive unforgettable aaga pogudhu!',
    suggested_eq: 'Late Night Synth Chill (+3dB Bass, +2dB Highs)',
    tracks: [
      { title: 'Vaseegara', artist: 'Bombay Jayashri, Harris Jayaraj • Minnale' },
      { title: 'Hukum - Thalaivar Alappara', artist: 'Anirudh Ravichander • Jailer' },
      { title: 'Arabic Kuthu', artist: 'Anirudh Ravichander • Beast' },
      { title: 'Illuminati', artist: 'Sushin Shyam • Aavesham' },
      { title: 'Naa Ready', artist: 'Thalapathy Vijay • Leo' },
      { title: 'Manasilaayo', artist: 'Anirudh Ravichander • Vettaiyan' }
    ]
  };
};

export const AiStudioView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playlist, setPlaylist] = useState<AiDjPlaylist | null>(null);
  const [isStreamingQueue, setIsStreamingQueue] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState('');

  const { playBatch } = usePlayerStore();
  const { songs: localSongs } = useLibraryStore();

  const handleGenerate = async (targetQuery: string) => {
    const q = targetQuery.trim() || 'late night drive';
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ai/dj?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data: AiDjPlaylist = await res.json();
          if (data && data.title && data.tracks) {
            setPlaylist(data);
            if (data.title) audioEffectsService.autoTuneForSong(data.title, data.vibe);
            setIsLoading(false);
            return;
          }
        }
      }
    } catch {
      // Backend not running; fallback to client AI DJ synthesis
    }

    // Client-side AI DJ fallback
    const clientPlaylist = generateClientAiDjPlaylist(q);
    setPlaylist(clientPlaylist);
    audioEffectsService.autoTuneForSong(clientPlaylist.title, clientPlaylist.vibe);
    setIsLoading(false);
  };

  const resolveSong = async (trackTitle: string, trackArtist: string): Promise<Song | null> => {
    // 1. Check local songs
    const matchedLocal = localSongs.find((s) =>
      s.title.toLowerCase().includes(trackTitle.toLowerCase())
    );
    if (matchedLocal) return matchedLocal;

    // 2. Query JioSaavn 320k HD client service
    try {
      const saavnResults = await jiosaavnService.searchJioSaavn(`${trackTitle} ${trackArtist}`);
      if (saavnResults && saavnResults.length > 0) {
        return saavnResults[0];
      }
    } catch {
      // Continue to online endpoint
    }

    // 3. Fallback to online search API if backend is running
    try {
      const searchRes = await fetch(
        `/api/online/search?q=${encodeURIComponent(`${trackTitle} ${trackArtist}`)}`
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.results && searchData.results.length > 0) {
          return searchData.results[0];
        }
      }
    } catch {
      // No backend
    }

    return null;
  };

  const handleStreamAllTracks = async () => {
    if (!playlist || playlist.tracks.length === 0) return;
    setIsStreamingQueue(true);
    setStreamingProgress('Preparing high-fidelity 320kbps AI streaming queue...');

    try {
      const resolvedSongs: Song[] = [];

      for (let i = 0; i < Math.min(6, playlist.tracks.length); i++) {
        const item = playlist.tracks[i];
        setStreamingProgress(`Resolving "${item.title}" in 320k HD...`);

        const song = await resolveSong(item.title, item.artist);
        if (song) {
          resolvedSongs.push(song);
        }
      }

      if (resolvedSongs.length > 0) {
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
    setStreamingProgress(`Streaming "${trackTitle}" in 320k HD...`);
    try {
      const song = await resolveSong(trackTitle, trackArtist);
      if (song) {
        audioEffectsService.autoTuneForSong(trackTitle, trackArtist);
        await playBatch([song]);
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
