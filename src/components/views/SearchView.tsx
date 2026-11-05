import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  X,
  History,
  Play,
  Pause,
  Flame,
  Loader2,
  WifiOff,
  Radio,
  Music2,
  Sparkles,
  ChevronRight,
  Headphones
} from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SongRow } from '../common/SongRow';
import { VirtualSongList } from '../common/VirtualSongList';
import { Song } from '../../types/music';
import { useDebounce } from '../../utils/useDebounce';
import { searchJioSaavn } from '../../services/jiosaavnService';
import { LIVE_RADIO_STATIONS, getStationAsSong } from '../../services/radioService';
import { buildApiUrl } from '../../utils/apiConfig';

const ONLINE_HISTORY_KEY = 'aura_online_recent_searches';

interface BrowseVibe {
  id: string;
  badge: string;
  title: string;
  query: string;
  gradient: string;
  badgeColor: string;
  image: string;
}

const BROWSE_VIBES: BrowseVibe[] = [
  {
    id: 'synthwave',
    badge: 'Retro Kinetic',
    title: 'Synthwave & Cyber',
    query: 'Synthwave Tamil 80s',
    gradient: 'from-[#9d4edd] via-[#242036] to-[#00373a]',
    badgeColor: 'text-[#00f1fd]',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300'
  },
  {
    id: 'kollywood-mass',
    badge: 'Kuthu Blast',
    title: 'Kollywood Mass & Kuthu',
    query: 'Anirudh mass kuthu songs',
    gradient: 'from-[#e11d48] via-[#242036] to-[#14121a]',
    badgeColor: 'text-rose-300',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'
  },
  {
    id: 'deep-focus',
    badge: 'Mind Flow',
    title: 'Deep Focus & Lo-Fi',
    query: 'Tamil Lofi Chill Beats',
    gradient: 'from-[#1c1b22] via-[#201f26] to-[#062423]',
    badgeColor: 'text-[#dcfdff]',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300'
  },
  {
    id: '90s-nostalgia',
    badge: 'Golden Era',
    title: '90s Rahman & Raja Hits',
    query: '90s Tamil Hits Rahman Ilaiyaraaja',
    gradient: 'from-[#d97706] via-[#242036] to-[#14121a]',
    badgeColor: 'text-amber-300',
    image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300'
  },
  {
    id: 'chill-melodies',
    badge: 'Drift & Soul',
    title: 'Chill & Tamil Melodies',
    query: 'Harris Jayaraj Melody Hits',
    gradient: 'from-[#800080] via-[#201f26] to-[#14121a]',
    badgeColor: 'text-[#e0b6ff]',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300'
  },
  {
    id: 'night-drive',
    badge: 'Midnight Mood',
    title: 'Night Drive Tamil Anthems',
    query: 'Tamil Night Drive Songs',
    gradient: 'from-[#1e1b4b] via-[#242036] to-[#14121a]',
    badgeColor: 'text-[#6ff6ff]',
    image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300'
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
  'Kaavaalaa',
  'Anirudh Hits',
  'AR Rahman 90s',
  'Yuvan Drugs'
];

// Bounded in-memory search cache
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
  const searchQuery = useLibraryStore((s) => s.searchQuery);
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery);
  const playBatch = usePlayerStore((s) => s.playBatch);
  const playSong = usePlayerStore((s) => s.playSong);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const abortControllerRef = useRef<AbortController | null>(null);
  const latestQueryRef = useRef<string>('');
  const lastExecutedQueryRef = useRef<string>('');

  const [searchMode, setSearchMode] = useState<'all' | 'streaming' | 'radio'>('all');
  const [onlineQuery, setOnlineQuery] = useState(searchQuery || '');
  const debouncedOnlineQuery = useDebounce(onlineQuery, 350);

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
      return saved ? JSON.parse(saved) : ['Hukum', 'Naa Ready', 'Arabic Kuthu', 'Yuvan Hits'];
    } catch {
      return ['Hukum', 'Naa Ready', 'Arabic Kuthu', 'Yuvan Hits'];
    }
  });

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

  const removeHistoryItem = (term: string) => {
    setOnlineHistory((prev) => {
      const updated = prev.filter((item) => item.toLowerCase() !== term.toLowerCase());
      try {
        localStorage.setItem(ONLINE_HISTORY_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearHistory = () => {
    setOnlineHistory([]);
    try {
      localStorage.removeItem(ONLINE_HISTORY_KEY);
    } catch {}
  };

  const performOnlineSearch = useCallback(async (query: string, saveToHistory: boolean = false) => {
    const q = query.trim();
    latestQueryRef.current = q;
    lastExecutedQueryRef.current = q;

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

      // 1. Direct JioSaavn Studio Master 320kbps HD Audio Search
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

      // 2. Query YouTube Music search endpoint if empty
      if (results.length === 0) {
        try {
          const res = await fetch(buildApiUrl(`/api/online/search?q=${encodeURIComponent(q)}`), {
            signal: controller.signal
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              results = data.results;
              setHasMoreOnline(false);
            }
          }
        } catch (backendErr: any) {
          if (backendErr.name === 'AbortError') return;
        }
      }

      if (controller.signal.aborted || latestQueryRef.current !== q) return;

      setCachedOnlineSearch(q, results);
      setOnlineResults(results);

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
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMoreOnline, isOnlineLoading, isLoadingMore, loadMoreOnlineSongs]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    const trimmed = debouncedOnlineQuery.trim();
    if (trimmed.length >= 2) {
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
  }, [debouncedOnlineQuery, performOnlineSearch]);

  const handleTriggerOnlineChip = (term: string) => {
    setOnlineQuery(term);
    setSearchQuery(term);
    performOnlineSearch(term, true);
  };

  return (
    <div className="relative p-4 sm:p-8 space-y-6 max-w-7xl mx-auto select-none pb-28">
      {/* Interactive Ambient Glow Underlay */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-gradient-to-tr from-[#9d4edd]/20 to-[#00f1fd]/15 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Stitch Elevated Pill Search Input */}
      <div className="relative w-full pt-1">
        <div className="relative flex items-center w-full h-14 bg-[#242036] rounded-full px-4 border border-white/[0.08] shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all duration-300 focus-within:shadow-[0_0_24px_rgba(0,241,253,0.25)] focus-within:bg-[#2a2931] focus-within:border-[#00f1fd]/50">
          <Search size={22} className="text-[#998d9e] shrink-0 mr-3 transition-colors group-focus-within:text-[#00f1fd]" />
          
          <input
            type="search"
            name="aura_search_main"
            id="aura-search-input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={onlineQuery}
            onChange={(e) => {
              setOnlineQuery(e.target.value);
              setSearchQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                performOnlineSearch(onlineQuery, true);
              }
            }}
            placeholder="Search Tamil songs, artists, movies, or 24/7 radio..."
            className="w-full bg-transparent border-0 outline-none text-[#e5e0eb] placeholder-[#998d9e] text-sm py-2 tracking-normal focus:ring-0"
            autoFocus
          />

          {onlineQuery && (
            <button
              onClick={() => {
                setOnlineQuery('');
                setSearchQuery('');
                setOnlineResults([]);
              }}
              className="w-10 h-10 flex items-center justify-center text-[#998d9e] hover:text-white active:scale-90 transition-all shrink-0 cursor-pointer"
              title="Clear"
            >
              <X size={18} />
            </button>
          )}

          <button
            onClick={() => performOnlineSearch(onlineQuery, true)}
            disabled={isOnlineLoading || !onlineQuery.trim()}
            className="px-4 py-2 bg-gradient-to-r from-[#9d4edd] to-[#00f1fd] disabled:opacity-40 text-white rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
          >
            {isOnlineLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} className="fill-white" />
            )}
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </div>

      {/* Stitch Filter Pills (Scrollable Row - Pure Cloud) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
        <button
          onClick={() => setSearchMode('all')}
          className={`shrink-0 px-4 h-9 rounded-full text-xs font-bold transition-all cursor-pointer ${
            searchMode === 'all'
              ? 'bg-[#9d4edd] text-white shadow-[0_2px_12px_rgba(157,78,221,0.35)]'
              : 'bg-[#201f26] text-[#d0c2d5] hover:text-white'
          }`}
        >
          All
        </button>

        <button
          onClick={() => setSearchMode('streaming')}
          className={`shrink-0 px-4 h-9 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            searchMode === 'streaming'
              ? 'bg-[#9d4edd] text-white shadow-[0_2px_12px_rgba(157,78,221,0.35)]'
              : 'bg-[#201f26] text-[#d0c2d5] hover:text-white'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#00f1fd]" />
          <span>Streaming (JioSaavn 320k)</span>
        </button>

        <button
          onClick={() => setSearchMode('radio')}
          className={`shrink-0 px-4 h-9 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            searchMode === 'radio'
              ? 'bg-[#9d4edd] text-white shadow-[0_2px_12px_rgba(157,78,221,0.35)]'
              : 'bg-[#201f26] text-[#d0c2d5] hover:text-white'
          }`}
        >
          <Radio size={14} className="text-rose-400" />
          <span>24/7 Live Radio FM</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* Search Results Display Area                                               */}
      {/* ========================================================================= */}
      {isOnlineLoading && (
        <div className="py-12 flex flex-col items-center justify-center gap-3 bg-[#1c1b22] rounded-2xl border border-white/[0.06] shadow-inner">
          <div className="relative">
            <Loader2 size={36} className="text-[#00f1fd] animate-spin" />
            <Music2
              size={16}
              className="text-[#e0b6ff] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse"
            />
          </div>
          <p className="text-sm font-semibold text-[#e5e0eb]">
            Searching JioSaavn Studio Master 320k catalog...
          </p>
          <p className="text-xs text-[#998d9e]">
            High-fidelity direct cloud stream with verified lossless matching
          </p>
        </div>
      )}

      {onlineError && !isOnlineLoading && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <WifiOff size={20} className="text-rose-400 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-rose-300">Stream Search Error</h4>
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

      {!isOnlineLoading && onlineResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#998d9e]">
                320kbps Cloud Tracks ({onlineResults.length})
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#00f1fd]/15 text-[#00f1fd] font-semibold border border-[#00f1fd]/30">
                Live Stream Ready
              </span>
            </div>

            <button
              onClick={() => playBatch(onlineResults)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#9d4edd] to-[#00f1fd] text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Play size={13} className="fill-white" />
              <span>Play All</span>
            </button>
          </div>

          <div className="space-y-1">
            <VirtualSongList
              songs={onlineResults}
              playlistContext={onlineResults}
              itemHeight={56}
            />
          </div>

          <div ref={sentinelRef} className="pt-4 pb-4 flex flex-col items-center justify-center gap-2">
            {isLoadingMore && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-[#00f1fd] animate-pulse">
                <Loader2 size={14} className="animate-spin" />
                <span>Loading more 320k tracks (Page {onlinePage + 1})...</span>
              </div>
            )}

            {!isLoadingMore && hasMoreOnline && (
              <button
                onClick={loadMoreOnlineSongs}
                className="px-5 py-2.5 rounded-full bg-[#201f26] hover:bg-[#2a2931] border border-white/[0.08] text-[#d0c2d5] hover:text-white text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                Load More Songs (Page {onlinePage + 1})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State: Recent Searches + Live Stations Carousel + Bento Browse Grid */}
      {!onlineQuery && !isOnlineLoading && (
        <div className="space-y-8 pt-2">
          {/* Recent Searches Flow */}
          {onlineHistory.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-[#998d9e]" />
                  <h2 className="text-base font-bold text-[#e5e0eb]">Recent Searches</h2>
                </div>
                <button
                  onClick={handleClearHistory}
                  className="text-xs font-medium text-[#e0b6ff] hover:text-white transition-colors cursor-pointer px-2 py-1"
                >
                  Clear All
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {onlineHistory.map((term) => (
                  <div
                    key={term}
                    onClick={() => handleTriggerOnlineChip(term)}
                    className="group flex items-center gap-2 pl-3.5 pr-2 py-1.5 rounded-full bg-[#242036] hover:bg-[#2a2931] border border-white/[0.06] transition-colors cursor-pointer"
                  >
                    <span className="text-xs text-[#e5e0eb]">{term}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeHistoryItem(term);
                      }}
                      className="w-5 h-5 flex items-center justify-center text-[#998d9e] hover:text-rose-400 rounded-full cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick Trending Kollywood Hits Chips */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00f1fd]">
              <Flame size={15} className="text-amber-400" />
              <span>Trending Hits</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_TRENDING_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleTriggerOnlineChip(chip)}
                  className="px-3.5 py-1.5 rounded-full border border-white/[0.06] bg-[#1c1b22] hover:bg-[#242036] text-xs font-medium text-[#d0c2d5] hover:text-white transition-all cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </section>

          {/* Live Internet Radio Carousel (Explore Live Stations) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f1fd] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00f1fd]" />
                </span>
                <h2 className="text-base font-bold text-[#e5e0eb]">Explore Live Stations</h2>
              </div>
              <span className="text-xs text-[#998d9e] flex items-center gap-0.5">
                Worldwide FM
                <ChevronRight size={14} />
              </span>
            </div>

            <div className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2 pt-1 -mx-1 px-1">
              {LIVE_RADIO_STATIONS.slice(0, 4).map((station) => {
                const stationSong = getStationAsSong(station);
                const isCurrent = currentSong?.filePath === station.streamUrl;

                return (
                  <div
                    key={station.id}
                    onClick={() => playSong(stationSong)}
                    className="w-64 shrink-0 snap-start rounded-2xl bg-[#201f26] border border-white/[0.06] p-4 relative overflow-hidden flex flex-col justify-between shadow-lg active:scale-98 transition-all cursor-pointer group"
                  >
                    <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-[#9d4edd]/20 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-start justify-between relative z-10">
                      <span className="px-2 py-0.5 rounded-full bg-[#9d4edd]/30 text-[#e0b6ff] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        LIVE
                      </span>
                      <span className="text-xs text-[#00f1fd] font-semibold">{station.frequency}</span>
                    </div>

                    <div className="mt-8 relative z-10 flex items-end justify-between">
                      <div className="min-w-0 pr-2">
                        <h3 className="text-sm font-bold text-[#e5e0eb] truncate">{station.name}</h3>
                        <p className="text-xs text-[#998d9e] truncate">{station.genre}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playSong(stationSong);
                        }}
                        className="w-10 h-10 rounded-full bg-[#00f1fd] text-black flex items-center justify-center shadow-[0_0_16px_rgba(0,241,253,0.4)] active:scale-95 shrink-0 transition-transform cursor-pointer"
                        title={`Tune into ${station.name}`}
                      >
                        {isCurrent && isPlaying ? (
                          <Pause size={16} className="fill-black" />
                        ) : (
                          <Play size={16} className="fill-black ml-0.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Stitch Bento-Style 2-Column "Browse by Vibe & Genre" Grid */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#e5e0eb]">Browse by Vibe & Genre</h2>
              <span className="text-xs text-[#998d9e]">Curated Spaces</span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {BROWSE_VIBES.map((vibe) => (
                <div
                  key={vibe.id}
                  onClick={() => handleTriggerOnlineChip(vibe.query)}
                  className={`group relative h-36 rounded-2xl overflow-hidden p-4 flex flex-col justify-between cursor-pointer active:scale-98 transition-all shadow-md bg-gradient-to-br ${vibe.gradient} border border-white/[0.08]`}
                >
                  <div className="relative z-10">
                    <span className={`px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider inline-block mb-1.5 ${vibe.badgeColor}`}>
                      {vibe.badge}
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                      {vibe.title}
                    </h3>
                  </div>

                  {/* Corner Rotated Album Art Peek */}
                  <div className="absolute -right-3 -bottom-3 w-20 h-20 rotate-12 rounded-xl overflow-hidden shadow-2xl transition-transform group-hover:rotate-6 group-hover:scale-105 border border-white/10">
                    <img
                      src={vibe.image}
                      alt={vibe.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
