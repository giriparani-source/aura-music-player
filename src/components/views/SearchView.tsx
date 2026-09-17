import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  X,
  Mic2,
  Disc,
  History,
  HardDrive,
  Play,
  Pause,
  Flame,
  Loader2,
  WifiOff,
  Radio,
  Music2
} from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SongRow } from '../common/SongRow';
import { Song } from '../../types/music';
import { useDebounce } from '../../utils/useDebounce';
import { fuzzySearchSongs } from '../../utils/fuzzySearch';
import { searchJioSaavn } from '../../services/jiosaavnService';
import { LIVE_RADIO_STATIONS, getStationAsSong } from '../../services/radioService';
import { buildApiUrl } from '../../utils/apiConfig';

const SEARCH_HISTORY_KEY = 'aura_recent_searches';
const ONLINE_HISTORY_KEY = 'aura_online_recent_searches';

interface FeaturedHit {
  title: string;
  artist: string;
  query: string;
  tag: string;
  gradient: string;
  sourceId: string;
  thumbnail: string;
}

const FEATURED_HITS: FeaturedHit[] = [
  {
    title: 'Hukum - Thalaivar Alappara',
    artist: 'Anirudh Ravichander • Jailer',
    query: 'Hukum Jailer Anirudh',
    tag: 'Superstar Anthem',
    gradient: 'from-orange-600/30 to-amber-600/20',
    sourceId: '1F3hm6MfR1k',
    thumbnail: 'https://c.saavncdn.com/435/Jailer-Telugu-2023-20230810132954-500x500.jpg'
  },
  {
    title: 'Naa Ready',
    artist: 'Thalapathy Vijay, Anirudh • Leo',
    query: 'Naa Ready Leo song',
    tag: 'Dance Blast',
    gradient: 'from-red-600/30 to-purple-600/20',
    sourceId: 'szvt1vD0Uug',
    thumbnail: 'https://c.saavncdn.com/393/Leo-Tamil-2023-20231019205513-500x500.jpg'
  },
  {
    title: 'Arabic Kuthu',
    artist: 'Anirudh Ravichander, Jonita • Beast',
    query: 'Arabic Kuthu Beast song',
    tag: 'Tamil Blockbuster',
    gradient: 'from-amber-600/30 to-rose-600/20',
    sourceId: 'KUN5Uf9mObQ',
    thumbnail: 'https://c.saavncdn.com/768/Beast-Tamil-2022-20220504143439-500x500.jpg'
  },
  {
    title: 'Matta',
    artist: 'Thalapathy Vijay, Yuvan Shankar Raja • GOAT',
    query: 'Matta GOAT song',
    tag: 'Party Anthem',
    gradient: 'from-fuchsia-600/30 to-pink-600/20',
    sourceId: 'Msq_b31oZl4',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'
  },
  {
    title: 'Manasilaayo',
    artist: 'Anirudh, Malaysia Vasudevan • Vettaiyan',
    query: 'Manasilaayo Vettaiyan song',
    tag: 'Trending Kollywood',
    gradient: 'from-indigo-600/30 to-blue-600/20',
    sourceId: 'yWb9Cq7E6_k',
    thumbnail: 'https://c.saavncdn.com/284/Vettaiyan-Tamil-2024-20240916174547-500x500.jpg'
  },
  {
    title: 'Kadharalz',
    artist: 'Kamal Haasan, Anirudh • Indian 2',
    query: 'Kadharalz Indian 2 song',
    tag: 'Senapathy Energy',
    gradient: 'from-emerald-600/30 to-teal-600/20',
    sourceId: '3L3dVIHy5xc',
    thumbnail: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300'
  },
  {
    title: 'Vaseegara',
    artist: 'Bombay Jayashri, Harris Jayaraj • Minnale',
    query: 'Vaseegara Minnale song',
    tag: 'Evergreen Melody',
    gradient: 'from-pink-600/30 to-rose-600/20',
    sourceId: '7Z_mQ3l_0Yw',
    thumbnail: 'https://c.saavncdn.com/712/Minnale-Tamil-2001-20200424163013-500x500.jpg'
  },
  {
    title: 'Badass',
    artist: 'Anirudh Ravichander • Leo',
    query: 'Badass Leo Anirudh',
    tag: 'Rolex & Leo Vibe',
    gradient: 'from-rose-600/30 to-red-600/20',
    sourceId: '3mY455_4c9A',
    thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300'
  }
];

const QUICK_TRENDING_CHIPS = [
  'Hukum',
  'Naa Ready',
  'Arabic Kuthu',
  'Matta GOAT',
  'Manasilaayo',
  'Kadharalz',
  'Vaseegara',
  'Badass Leo',
  'Spark GOAT',
  'Kaavaalaa',
  'Whistle Podu',
  'Anirudh Hits'
];

// Bounded in-memory search cache (max 50 items with LRU eviction)
const SEARCH_CACHE_MAX = 50;
const onlineSearchCache = new Map<string, Song[]>();

function getCachedOnlineSearch(key: string): Song[] | undefined {
  const norm = key.trim().toLowerCase();
  const val = onlineSearchCache.get(norm);
  if (val) {
    onlineSearchCache.delete(norm);
    onlineSearchCache.set(norm, val);
    return val;
  }
  return undefined;
}

function setCachedOnlineSearch(key: string, results: Song[]): void {
  const norm = key.trim().toLowerCase();
  if (onlineSearchCache.has(norm)) {
    onlineSearchCache.delete(norm);
  } else if (onlineSearchCache.size >= SEARCH_CACHE_MAX) {
    const oldestKey = onlineSearchCache.keys().next().value;
    if (oldestKey) onlineSearchCache.delete(oldestKey);
  }
  onlineSearchCache.set(norm, results);
}

export const SearchView: React.FC = () => {
  const { songs, artists, albums, searchQuery } = useLibraryStore();
  const playBatch = usePlayerStore((s) => s.playBatch);
  const playSong = usePlayerStore((s) => s.playSong);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const abortControllerRef = useRef<AbortController | null>(null);
  const latestQueryRef = useRef<string>('');
  const lastExecutedQueryRef = useRef<string>('');

  // Primary streaming source defaults to YouTube Music ('online')
  const [searchMode, setSearchMode] = useState<'online' | 'radio' | 'local'>('online');

  // Radio Filter State
  const [radioQuery, setRadioQuery] = useState('');
  const [selectedRadioGenre, setSelectedRadioGenre] = useState<string>('all');

  // Online Search State
  const [onlineQuery, setOnlineQuery] = useState(searchQuery || '');
  const debouncedOnlineQuery = useDebounce(onlineQuery, 400);

  // Sync onlineQuery if navigated from Header with a new searchQuery
  useEffect(() => {
    if (searchQuery && searchQuery.trim() && searchQuery !== onlineQuery) {
      setOnlineQuery(searchQuery);
    }
  }, [searchQuery]);
  const [onlineResults, setOnlineResults] = useState<Song[]>([]);
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);
  const [onlinePage, setOnlinePage] = useState(1);
  const [hasMoreOnline, setHasMoreOnline] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlineHistory, setOnlineHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(ONLINE_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Local Search State
  const [localQuery, setLocalQuery] = useState('');
  const debouncedLocalQuery = useDebounce(localQuery, 160);
  const [localFilterType, setLocalFilterType] = useState<'all' | 'songs' | 'artists' | 'albums'>('all');
  const [localHistory, setLocalHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // BUG-08 fix: Commit search history only upon explicit user submission (Enter, Click, or Chip Selection)
  // to avoid polluting history with intermediate keystroke typing fragments.
  const commitLocalSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (trimmed.length >= 2) {
      setLocalHistory((prev) => {
        const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
        const updated = [trimmed, ...filtered].slice(0, 8);
        try {
          localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  }, []);

  const commitOnlineSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (trimmed.length >= 2) {
      setOnlineHistory((prev) => {
        const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
        const updated = [trimmed, ...filtered].slice(0, 8);
        try {
          localStorage.setItem(ONLINE_HISTORY_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  }, []);

  // Execute online search API with AbortController, stale-result guard, and bounded cache
  const performOnlineSearch = useCallback(async (query: string, saveToHistory: boolean = false) => {
    const q = query.trim();
    latestQueryRef.current = q;
    lastExecutedQueryRef.current = q;

    // Abort pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!q || q.length < 2) {
      setOnlineResults([]);
      setIsOnlineLoading(false);
      setOnlineError(null);
      setHasSearched(false);
      setOnlinePage(1);
      setHasMoreOnline(false);
      return;
    }

    setOnlinePage(1);
    setHasMoreOnline(true);

    // Check bounded memory cache first
    const cached = getCachedOnlineSearch(q);
    if (cached) {
      setOnlineResults(cached);
      setIsOnlineLoading(false);
      setOnlineError(null);
      setHasSearched(true);
      setHasMoreOnline(cached.length >= 20);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsOnlineLoading(true);
    setOnlineError(null);
    setHasSearched(true);

    try {
      let results: Song[] = [];

      // 1. Direct JioSaavn Studio Master 320kbps HD Audio Search (Zero Localhost Server)
      try {
        const saavnHits = await searchJioSaavn(q, 20, 1);
        if (saavnHits && saavnHits.length > 0) {
          results = saavnHits;
          if (saavnHits.length < 20) {
            setHasMoreOnline(false);
          }
        }
      } catch (e) {
        console.warn('JioSaavn search notice:', e);
      }

      if (controller.signal.aborted || latestQueryRef.current !== q) return;

      // 2. Query YouTube Music search endpoint (Vercel Serverless Function & Local Dev) if empty
      if (results.length === 0) {
        try {
          const res = await fetch(buildApiUrl(`/api/online/search?q=${encodeURIComponent(q)}`), {
            signal: controller.signal
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              const queryWords = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
              if (queryWords.length > 0) {
                const relevant = data.results.filter((song: Song) => {
                  const combined = `${song.title} ${song.artist} ${song.album || ''}`.toLowerCase();
                  return queryWords.some((w) => combined.includes(w));
                });
                results = relevant;
              } else {
                results = data.results;
              }
              setHasMoreOnline(false);
            }
          }
        } catch (backendErr: any) {
          if (backendErr.name === 'AbortError') return;
        }
      }

      if (controller.signal.aborted || latestQueryRef.current !== q) return;

      // 3. If still empty, check if query matches any curated featured blockbusters
      if (results.length === 0) {
        const lower = q.toLowerCase();
        const matches = FEATURED_HITS.filter(
          (h) => h.title.toLowerCase().includes(lower) || h.artist.toLowerCase().includes(lower) || h.query.toLowerCase().includes(lower)
        );

        if (matches.length > 0) {
          results = matches.map((hit) => ({
            id: `cloud_${hit.sourceId}`,
            sourceId: hit.sourceId,
            title: hit.title,
            artist: hit.artist,
            album: 'Curated Stream',
            duration: 240,
            format: 'AAC',
            path: `https://www.youtube.com/watch?v=${hit.sourceId}`,
            filePath: `https://www.youtube.com/watch?v=${hit.sourceId}`,
            fileName: `${hit.title}.mp3`,
            fileSize: 0,
            dateAdded: Date.now(),
            playCount: 0,
            isFavorite: false,
            artwork: hit.thumbnail,
            coverArt: hit.thumbnail,
            isOnline: true
          }));
          setHasMoreOnline(false);
        }
      }

      if (controller.signal.aborted || latestQueryRef.current !== q) return;

      // Store in bounded LRU cache
      setCachedOnlineSearch(q, results);
      setOnlineResults(results);

      // Add to online search history ONLY when explicitly requested (BUG-08 fix)
      if (saveToHistory) {
        commitOnlineSearch(q);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('Online search note:', err);
    } finally {
      if (latestQueryRef.current === q) {
        setIsOnlineLoading(false);
      }
    }
  }, [commitOnlineSearch]);

  // Infinite Scroll Pagination: Load More Online Songs
  const loadMoreOnlineSongs = useCallback(async () => {
    const q = lastExecutedQueryRef.current.trim();
    if (!q || isOnlineLoading || isLoadingMore || !hasMoreOnline) return;

    const nextPage = onlinePage + 1;
    setIsLoadingMore(true);

    try {
      const moreSongs = await searchJioSaavn(q, 20, nextPage);
      if (moreSongs && moreSongs.length > 0) {
        setOnlineResults((prev) => {
          const existing = new Set(prev.map((s) => s.id));
          const unique = moreSongs.filter((s) => !existing.has(s.id));
          return [...prev, ...unique];
        });
        setOnlinePage(nextPage);
        if (moreSongs.length < 20) {
          setHasMoreOnline(false);
        }
      } else {
        setHasMoreOnline(false);
      }
    } catch (err) {
      console.warn('Load more online songs error:', err);
      setHasMoreOnline(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isOnlineLoading, isLoadingMore, hasMoreOnline, onlinePage]);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    if (!hasMoreOnline || isOnlineLoading || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreOnlineSongs();
        }
      },
      { threshold: 0.1 }
    );

    const el = sentinelRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMoreOnline, isOnlineLoading, isLoadingMore, loadMoreOnlineSongs]);

  // Cleanup pending search on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Trigger online search on debounced query changes (BUG-16 & BUG-24 fix: skip duplicate execution)
  useEffect(() => {
    const trimmed = debouncedOnlineQuery.trim();
    if (searchMode === 'online' && trimmed.length >= 2) {
      if (trimmed.toLowerCase() !== lastExecutedQueryRef.current.toLowerCase()) {
        performOnlineSearch(debouncedOnlineQuery);
      }
    } else if (!trimmed) {
      lastExecutedQueryRef.current = '';
      setOnlineResults([]);
      setIsOnlineLoading(false);
      setOnlineError(null);
      setHasSearched(false);
    }
  }, [debouncedOnlineQuery, searchMode, performOnlineSearch]);

  // Filter Live Radio Stations
  const filteredRadioStations = useMemo(() => {
    let list = LIVE_RADIO_STATIONS;
    if (selectedRadioGenre !== 'all') {
      list = list.filter((s) => s.genre.toLowerCase().includes(selectedRadioGenre.toLowerCase()));
    }
    if (radioQuery.trim()) {
      const q = radioQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.genre.toLowerCase().includes(q) ||
          (s.description || s.tagline || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [radioQuery, selectedRadioGenre]);

  // Local Search Fuzzy Matching
  const matchedSongs = useMemo(() => {
    if (!debouncedLocalQuery.trim()) return [];
    return fuzzySearchSongs(songs, debouncedLocalQuery);
  }, [songs, debouncedLocalQuery]);

  const matchedArtists = useMemo(() => {
    if (!debouncedLocalQuery.trim()) return [];
    const q = debouncedLocalQuery.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, debouncedLocalQuery]);

  const matchedAlbums = useMemo(() => {
    if (!debouncedLocalQuery.trim()) return [];
    const q = debouncedLocalQuery.toLowerCase();
    return albums.filter((a) => a.title.toLowerCase().includes(q));
  }, [albums, debouncedLocalQuery]);

  const handleClearHistory = (type: 'online' | 'local') => {
    if (type === 'online') {
      setOnlineHistory([]);
      try {
        localStorage.removeItem(ONLINE_HISTORY_KEY);
      } catch {}
    } else {
      setLocalHistory([]);
      try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
      } catch {}
    }
  };

  const handleTriggerOnlineChip = (term: string) => {
    setOnlineQuery(term);
    performOnlineSearch(term, true);
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto select-none pb-28">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h2 className="text-3xl font-extrabold tracking-tight text-white">Search Music</h2>
            {searchMode === 'online' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm animate-fade-in">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                Online Music • Cloud Streaming
              </span>
            ) : searchMode === 'radio' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm animate-fade-in">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                24/7 Live FM Broadcast • ON AIR
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <HardDrive size={13} />
                Local Offline Library
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-400">
            {searchMode === 'online'
              ? 'Primary Cloud Engine: Stream millions of Tamil & Kollywood songs online with high-fidelity audio'
              : searchMode === 'radio'
              ? 'Listen to non-stop 24/7 live web radio stations with zero buffer and live on-air badge'
              : 'Fast fuzzy search across your local drive songs, albums, artists and folders'}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center p-1 bg-white/5 border border-white/10 rounded-2xl shrink-0 overflow-x-auto scrollbar-none gap-1">
          <button
            onClick={() => setSearchMode('online')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              searchMode === 'online'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500/50'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Music2 size={15} className={searchMode === 'online' ? 'text-white' : 'text-indigo-400'} />
            <span>Online Music</span>
          </button>

          <button
            onClick={() => setSearchMode('radio')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              searchMode === 'radio'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-500/50'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio size={15} className={searchMode === 'radio' ? 'text-white' : 'text-rose-400'} />
            <span>24/7 Live Radio</span>
          </button>

          <button
            onClick={() => setSearchMode('local')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              searchMode === 'local'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500/50'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <HardDrive size={15} />
            <span>Local Files</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 0.5 24/7 LIVE RADIO FM STATIONS MODE */}
      {/* ========================================================================= */}
      {searchMode === 'radio' && (
        <div className="space-y-6">
          {/* Radio Filter Box */}
          <div className="relative max-w-2xl">
            <Radio size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400" />
            <input
              type="search"
              name="aura_radio_search"
              id="aura_radio_search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              value={radioQuery}
              onChange={(e) => setRadioQuery(e.target.value)}
              placeholder="Search live radio stations by title, genre, language (Tamil, Hindi, Lo-Fi, EDM)..."
              className="w-full pl-12 pr-10 py-3.5 bg-white/5 border border-rose-500/25 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 shadow-xl transition-all"
              autoFocus
            />
            {radioQuery && (
              <button
                onClick={() => setRadioQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Genre Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {['all', 'Tamil', 'Hindi', 'Lo-Fi', 'EDM', 'News', 'Lounge'].map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedRadioGenre(genre)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedRadioGenre === genre
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {genre === 'all' ? 'All Stations' : genre}
              </button>
            ))}
          </div>

          {/* Radio Stations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRadioStations.map((station) => {
              const radioSong = getStationAsSong(station);
              const isThisPlaying = currentSong?.id === station.id && isPlaying;

              return (
                <div
                  key={station.id}
                  onClick={() => playSong(radioSong, [radioSong])}
                  className={`p-4 rounded-2xl bg-gradient-to-r ${station.accentColor} border cursor-pointer group transition-all hover:scale-[1.02] shadow-xl flex items-center justify-between gap-3 relative overflow-hidden ${
                    isThisPlaying
                      ? 'border-rose-500/60 shadow-rose-900/40 ring-1 ring-rose-500/50'
                      : 'border-white/10 hover:border-rose-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-md bg-neutral-900">
                      <img
                        src={station.artwork}
                        alt={station.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-600 text-white shadow">
                        LIVE
                      </span>
                    </div>

                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-rose-200">
                          {station.genre}
                        </span>
                        <span className="text-[10px] text-neutral-400">{station.frequency}</span>
                      </div>
                      <h4 className="text-sm font-extrabold text-white truncate group-hover:text-rose-200 transition-colors">
                        {station.name}
                      </h4>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">{station.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSong(radioSong, [radioSong]);
                    }}
                    className={`w-11 h-11 rounded-full text-white flex items-center justify-center shadow-xl transition-all shrink-0 cursor-pointer ${
                      isThisPlaying
                        ? 'bg-rose-600 scale-105'
                        : 'bg-white/15 hover:bg-rose-600 group-hover:scale-105'
                    }`}
                    title={isThisPlaying ? 'Pause Live Radio' : 'Tune in to Live Radio'}
                  >
                    {isThisPlaying ? (
                      <Pause size={18} className="fill-white" />
                    ) : (
                      <Play size={18} className="fill-white ml-0.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SPOTIFY CLOUD STREAMING MODE */}
      {/* ========================================================================= */}
      {searchMode === 'online' && (
        <div className="space-y-6">
          {/* Search Input Box */}
          <div className="relative max-w-3xl">
            <Search
              size={20}
              className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                onlineQuery ? 'text-emerald-400' : 'text-neutral-400'
              }`}
            />
            <input
              type="search"
              name="aura_online_search"
              id="aura_online_search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              value={onlineQuery}
              onChange={(e) => setOnlineQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  performOnlineSearch(onlineQuery, true);
                }
              }}
              placeholder="Search any song, artist, movie (e.g., Arabic Kuthu, Hukum, Illuminati, Ed Sheeran)..."
              className="w-full pl-12 pr-28 py-3.5 bg-white/5 border border-emerald-500/20 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 shadow-xl transition-all"
              autoFocus
            />

            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {onlineQuery && (
                <button
                  onClick={() => {
                    setOnlineQuery('');
                    setOnlineResults([]);
                  }}
                  className="text-neutral-500 hover:text-white p-1 cursor-pointer transition-colors"
                  title="Clear"
                >
                  <X size={16} />
                </button>
              )}

              <button
                onClick={() => performOnlineSearch(onlineQuery, true)}
                disabled={isOnlineLoading || !onlineQuery.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                {isOnlineLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Play size={13} className="fill-white" />
                )}
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Quick Trending Tamil & Global Hits Chips */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Flame size={14} className="text-amber-400" />
              <span>Trending Cloud Hits</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TRENDING_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleTriggerOnlineChip(chip)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    onlineQuery.toLowerCase() === chip.toLowerCase()
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                      : 'bg-white/5 hover:bg-emerald-500/10 border-white/5 hover:border-emerald-500/20 text-neutral-300 hover:text-white'
                  }`}
                >
                  <span>{chip}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Loading Indicator */}
          {isOnlineLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 glass-card rounded-2xl border border-emerald-500/20">
              <div className="relative">
                <Loader2 size={36} className="text-emerald-400 animate-spin" />
                <Music2
                  size={16}
                  className="text-emerald-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse"
                />
              </div>
              <p className="text-sm font-semibold text-neutral-300">
                Searching Spotify & Cloud Streaming Library...
              </p>
              <p className="text-xs text-neutral-500">
                Direct high-quality audio streaming with zero local download
              </p>
            </div>
          )}

          {/* Error Banner */}
          {onlineError && !isOnlineLoading && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <WifiOff size={20} className="text-rose-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-rose-300">Cloud Stream Error</h4>
                  <p className="text-xs text-rose-200/80">{onlineError}</p>
                </div>
              </div>
              <button
                onClick={() => performOnlineSearch(onlineQuery)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold cursor-pointer transition-all shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Online Search Results */}
          {!isOnlineLoading && onlineResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
                    Cloud Tracks ({onlineResults.length})
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                    Live Stream Ready
                  </span>
                </div>

                <button
                  onClick={() => playBatch(onlineResults)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Play size={13} className="fill-white" />
                  <span>Play All Tracks</span>
                </button>
              </div>

              <div className="space-y-1">
                {onlineResults.map((song, idx) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    index={idx}
                    playlistContext={onlineResults}
                  />
                ))}
              </div>

              {/* Infinite Scroll Sentinel & Load More UI */}
              <div ref={sentinelRef} className="pt-4 pb-4 flex flex-col items-center justify-center gap-2">
                {isLoadingMore && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-emerald-400 animate-pulse">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Loading more 320kbps HD songs (Page {onlinePage + 1})...</span>
                  </div>
                )}

                {!isLoadingMore && hasMoreOnline && (
                  <button
                    onClick={loadMoreOnlineSongs}
                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 text-neutral-300 hover:text-emerald-300 text-xs font-bold transition-all cursor-pointer shadow-md"
                  >
                    Load More Songs (Page {onlinePage + 1})
                  </button>
                )}

                {!hasMoreOnline && onlineResults.length >= 20 && (
                  <p className="text-xs text-neutral-500 font-medium">
                    ✓ All available songs loaded ({onlineResults.length} tracks)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* No Results for Query */}
          {!isOnlineLoading && hasSearched && onlineQuery.trim().length >= 2 && onlineResults.length === 0 && !onlineError && (
            <div className="py-16 text-center text-neutral-500 glass-card rounded-2xl border border-white/5">
              <p className="text-base font-semibold text-neutral-300 mb-1">
                No streaming songs found for "{onlineQuery}"
              </p>
              <p className="text-xs text-neutral-500">
                Try searching with movie name, artist or song title (e.g. "Anirudh hits", "Vikram song")
              </p>
            </div>
          )}

          {/* Empty Query State: Show Recent Online Searches if any */}
          {!onlineQuery && !isOnlineLoading && onlineHistory.length > 0 && (
            <div className="space-y-8 pt-2">
              {/* Online Recent Searches */}
              {onlineHistory.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <History size={14} className="text-neutral-500" />
                      <span>Recent Online Searches</span>
                    </h4>
                    <button
                      onClick={() => handleClearHistory('online')}
                      className="text-[11px] text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onlineHistory.map((term) => (
                      <button
                        key={term}
                        onClick={() => handleTriggerOnlineChip(term)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-neutral-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LOCAL OFFLINE FILES LIBRARY MODE */}
      {/* ========================================================================= */}
      {searchMode === 'local' && (
        <div className="space-y-6">
          {/* Local Search Input */}
          <div className="relative max-w-2xl">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              name="aura_local_search"
              id="aura_local_search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitLocalSearch(localQuery);
                }
              }}
              placeholder="Search local titles, artists, albums, or folder names..."
              className="w-full pl-12 pr-10 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 shadow-xl transition-all"
              autoFocus
            />
            {localQuery && (
              <button
                onClick={() => setLocalQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Local Filter Chips & Result Count */}
          {debouncedLocalQuery && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {(['all', 'songs', 'artists', 'albums'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setLocalFilterType(type)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                      localFilterType === type
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                        : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <span className="text-xs text-neutral-400 font-mono">
                {matchedSongs.length} local song match{matchedSongs.length !== 1 ? 'es' : ''}
              </span>
            </div>
          )}

          {/* Empty Local Search State */}
          {!debouncedLocalQuery ? (
            <div className="space-y-8 pt-4">
              {/* Recent Local Searches */}
              {localHistory.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <History size={14} className="text-neutral-500" />
                      <span>Recent Local Searches</span>
                    </h4>
                    <button
                      onClick={() => handleClearHistory('local')}
                      className="text-[11px] text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {localHistory.map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setLocalQuery(term);
                          commitLocalSearch(term);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-neutral-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : matchedSongs.length === 0 && matchedArtists.length === 0 && matchedAlbums.length === 0 ? (
            <div className="py-16 text-center text-neutral-500 glass-card rounded-2xl border border-white/5">
              <p className="text-base font-semibold text-neutral-400 mb-1">
                No local matches found for "{debouncedLocalQuery}"
              </p>
              <p className="text-xs text-neutral-500">
                Want to play this song without downloading? Switch to{' '}
                <button
                  onClick={() => {
                    setSearchMode('online');
                    setOnlineQuery(debouncedLocalQuery);
                    performOnlineSearch(debouncedLocalQuery);
                  }}
                  className="text-emerald-400 font-semibold underline hover:text-emerald-300 cursor-pointer ml-1"
                >
                  Spotify Cloud Stream
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Matched Songs */}
              {(localFilterType === 'all' || localFilterType === 'songs') && matchedSongs.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-3">
                    Songs ({matchedSongs.length})
                  </h3>
                  <div className="space-y-1">
                    {matchedSongs.slice(0, 50).map((song, idx) => (
                      <SongRow
                        key={song.id}
                        song={song}
                        index={idx}
                        playlistContext={matchedSongs}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Artists */}
              {(localFilterType === 'all' || localFilterType === 'artists') && matchedArtists.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-3">
                    Artists ({matchedArtists.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {matchedArtists.map((art) => (
                      <div
                        key={art.id}
                        onClick={() => setLocalQuery(art.name)}
                        className="glass-card p-3.5 rounded-xl flex items-center gap-3 cursor-pointer hover:border-indigo-500/30 transition-all"
                      >
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          <Mic2 size={16} />
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{art.name}</h5>
                          <p className="text-[11px] text-neutral-500">{art.songCount} songs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Albums */}
              {(localFilterType === 'all' || localFilterType === 'albums') && matchedAlbums.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-3">
                    Albums ({matchedAlbums.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {matchedAlbums.map((alb) => (
                      <div
                        key={alb.id}
                        onClick={() => setLocalQuery(alb.title)}
                        className="glass-card p-3.5 rounded-xl flex items-center gap-3 cursor-pointer hover:border-indigo-500/30 transition-all"
                      >
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
                          <Disc size={16} />
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{alb.title}</h5>
                          <p className="text-[11px] text-neutral-500 truncate">{alb.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
