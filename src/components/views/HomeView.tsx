import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Sparkles,
  Radio,
  Heart,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  UploadCloud,
  Clock,
  ListMusic,
  Plus,
  Compass,
  Headphones
} from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { musicDB } from '../../services/db';
import { Song, Playlist } from '../../types/music';
import { LIVE_RADIO_STATIONS, getStationAsSong } from '../../services/radioService';
import {
  INBUILT_PLAYLISTS,
  InbuiltPlaylist
} from '../../services/inbuiltPlaylistsService';
import { getPlaylistArtwork } from '../../services/playlistArtworkConfig';
import {
  TAMIL_ARTISTS,
  TamilArtist,
  ArtistCategory,
  ARTIST_CATEGORY_LABELS
} from '../../services/tamilArtistsData';
import { InbuiltPlaylistModal } from '../common/InbuiltPlaylistModal';
import { ImportPlaylistModal } from '../common/ImportPlaylistModal';
import { ArtistPlaylistView } from './ArtistPlaylistView';
import { artistPlaylistService } from '../../services/artistPlaylistService';

export const HomeView: React.FC = () => {
  const {
    songs: localSongs,
    playlists,
    setActiveTab,
    setLibrarySubTab,
    setActivePlaylistId,
    createPlaylist
  } = useLibraryStore();
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playSong = usePlayerStore((s) => s.playSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const playBatch = usePlayerStore((s) => s.playBatch);
  const setAiAssistantOpen = usePlayerStore((s) => s.setAiAssistantOpen);
  const isAuraFlow = usePlayerStore((s) => s.isAuraFlow);
  const toggleAuraFlow = usePlayerStore((s) => s.toggleAuraFlow);

  const [activeFilter, setActiveFilter] = useState<'all' | 'playlists' | 'radio' | 'ai'>('all');
  const [selectedInbuiltPlaylist, setSelectedInbuiltPlaylist] = useState<InbuiltPlaylist | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<TamilArtist | null>(null);
  const [artistCategoryFilter, setArtistCategoryFilter] = useState<ArtistCategory>('all');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const artistScrollRef = useRef<HTMLDivElement>(null);
  const playlistScrollRef = useRef<HTMLDivElement>(null);
  const userPlaylistScrollRef = useRef<HTMLDivElement>(null);
  const recentsScrollRef = useRef<HTMLDivElement>(null);

  const scrollPlaylists = (direction: 'left' | 'right') => {
    if (playlistScrollRef.current) {
      const scrollAmount = direction === 'left' ? -420 : 420;
      playlistScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollUserPlaylists = (direction: 'left' | 'right') => {
    if (userPlaylistScrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      userPlaylistScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollRecents = (direction: 'left' | 'right') => {
    if (recentsScrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      recentsScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollArtists = (direction: 'left' | 'right') => {
    if (artistScrollRef.current) {
      const scrollAmount = direction === 'left' ? -420 : 420;
      artistScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // 1. YOUR PLAYLISTS (User created & imported playlists only, pure cloud)
  const userPlaylists = useMemo(() => {
    return (playlists || []).filter((p) => !p.isSmart && !p.id.startsWith('smart-'));
  }, [playlists]);

  const getPlaylistThumbnail = (pl: Playlist): string | null => {
    if (pl.coverArt) return pl.coverArt;
    if (pl.songIds && pl.songIds.length > 0) {
      const firstSong = localSongs.find((s) => pl.songIds.includes(s.id));
      if (firstSong) return firstSong.artwork || firstSong.coverArt || null;
    }
    return null;
  };

  const handleUserPlaylistClick = (pl: Playlist) => {
    setActivePlaylistId(pl.id);
    setActiveTab('library');
    setLibrarySubTab('playlists');
  };

  const handleUserPlaylistPlay = (e: React.MouseEvent, pl: Playlist) => {
    e.stopPropagation();
    const playlistTracks = localSongs.filter((s) => pl.songIds.includes(s.id));
    if (playlistTracks.length > 0) {
      const isCurrentPlaying = currentSong && playlistTracks.some((s) => s.id === currentSong.id) && isPlaying;
      if (isCurrentPlaying) {
        togglePlay();
      } else {
        playBatch(playlistTracks);
      }
    } else {
      handleUserPlaylistClick(pl);
    }
  };

  const handleCreatePlaylist = async () => {
    const name = prompt('Enter a name for your new playlist:');
    if (name && name.trim()) {
      const newPl = await createPlaylist(name.trim());
      setActivePlaylistId(newPl.id);
      setActiveTab('library');
      setLibrarySubTab('playlists');
    }
  };

  const handleShowAllPlaylists = () => {
    setActivePlaylistId(null);
    setActiveTab('library');
    setLibrarySubTab('playlists');
  };

  // 2. RECENTS (Recently played tracks)
  const [historySongs, setHistorySongs] = useState<Song[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadRecents = async () => {
      try {
        const historyEntries = await musicDB.getRecentHistory(50);
        const songMap = new Map<string, Song>();
        localSongs.forEach((s) => songMap.set(s.id, s));

        const seenIds = new Set<string>();
        const ordered: Song[] = [];

        // 1. Place currentSong first if available
        if (currentSong && !seenIds.has(currentSong.id)) {
          seenIds.add(currentSong.id);
          ordered.push(currentSong);
        }

        // 2. Add songs recorded in IndexedDB history
        for (const entry of historyEntries) {
          if (!seenIds.has(entry.songId)) {
            const song = songMap.get(entry.songId) || (currentSong?.id === entry.songId ? currentSong : null);
            if (song) {
              seenIds.add(song.id);
              ordered.push(song);
            }
          }
        }

        // 3. Add any library songs with lastPlayedAt
        const timestamped = localSongs
          .filter((s) => (s.lastPlayedAt || s.lastPlayed) && !seenIds.has(s.id))
          .sort((a, b) => ((b.lastPlayedAt || b.lastPlayed || 0) - (a.lastPlayedAt || a.lastPlayed || 0)));

        for (const s of timestamped) {
          if (!seenIds.has(s.id)) {
            seenIds.add(s.id);
            ordered.push(s);
          }
        }

        if (isMounted) {
          setHistorySongs(ordered.slice(0, 20));
        }
      } catch {
        const fallback = localSongs
          .filter((s) => s.lastPlayedAt || s.lastPlayed)
          .sort((a, b) => ((b.lastPlayedAt || b.lastPlayed || 0) - (a.lastPlayedAt || a.lastPlayed || 0)))
          .slice(0, 20);
        if (isMounted) {
          setHistorySongs(fallback);
        }
      }
    };

    loadRecents();
    return () => {
      isMounted = false;
    };
  }, [localSongs, currentSong]);

  const handleShowAllRecents = () => {
    setActivePlaylistId('smart-recent');
    setActiveTab('library');
    setLibrarySubTab('playlists');
  };

  // Dynamic Contextual Time Greeting
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour((prev) => {
        const next = new Date().getHours();
        return prev !== next ? next : prev;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    const hour = currentHour;
    if (hour >= 4 && hour < 12) {
      return { text: 'Good morning', icon: <Sunrise size={20} className="text-[#00f1fd]" /> };
    } else if (hour >= 12 && hour < 17) {
      return { text: 'Good afternoon', icon: <Sun size={20} className="text-[#e0b6ff]" /> };
    } else if (hour >= 17 && hour < 21) {
      return { text: 'Good evening', icon: <Sunset size={20} className="text-[#9d4edd]" /> };
    } else {
      return { text: 'Sanctuary Night', icon: <Moon size={20} className="text-[#00f1fd]" /> };
    }
  }, [currentHour]);

  // Fast lookup map for all inbuilt playlists
  const playlistMap = useMemo(() => {
    const map: Record<string, InbuiltPlaylist> = {};
    INBUILT_PLAYLISTS.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, []);

  // Stitch 6-Pack Quick Access Sessions Grid
  const quickAccessItems = useMemo(() => {
    const favoriteTracks = localSongs.filter((s) => s.isFavorite);

    return [
      {
        id: 'liked_songs',
        title: 'Liked Songs',
        subtitle: `${favoriteTracks.length || 0} tracks`,
        coverArt: getPlaylistArtwork('liked_songs'),
        isLikedIcon: true,
        playlist: {
          id: 'liked_songs',
          title: 'Liked Songs',
          subtitle: `${favoriteTracks.length || 0} tracks`,
          description: 'Your loved & favorite cloud tracks',
          coverArt: getPlaylistArtwork('liked_songs'),
          gradient: 'from-[#9d4edd] to-[#8433c4]',
          accentColor: '#9d4edd',
          songCount: favoriteTracks.length,
          tracks: favoriteTracks
        } as InbuiltPlaylist,
        onClick: () => {
          if (favoriteTracks.length > 0) {
            playBatch(favoriteTracks);
          } else if (playlistMap['mudhal_kaadhal']) {
            setSelectedInbuiltPlaylist(playlistMap['mudhal_kaadhal']);
          }
        }
      },
      {
        id: 'mudhal_kaadhal',
        title: 'Mudhal Kaadhal',
        subtitle: '40 Songs • First Love Hits',
        coverArt: playlistMap['mudhal_kaadhal']?.coverArt || getPlaylistArtwork('mudhal_kaadhal'),
        playlist: playlistMap['mudhal_kaadhal']
      },
      {
        id: '90s_vibe',
        title: '90s Vibe',
        subtitle: '35 Songs • Ilaiyaraaja & Rahman',
        coverArt: playlistMap['90s_vibe']?.coverArt || getPlaylistArtwork('90s_vibe'),
        playlist: playlistMap['90s_vibe']
      },
      {
        id: 'top_50_tamil',
        title: 'Top 50 – Tamil Hits',
        subtitle: '50 Blockbusters • Trending',
        coverArt: playlistMap['top_50_tamil']?.coverArt || getPlaylistArtwork('top_50_tamil'),
        playlist: playlistMap['top_50_tamil']
      },
      {
        id: 'night_drive',
        title: 'Night Drive',
        subtitle: '30 Songs • Midnight Mood',
        coverArt: playlistMap['night_drive']?.coverArt || getPlaylistArtwork('night_drive'),
        playlist: playlistMap['night_drive']
      },
      {
        id: 'beast_mode_workout',
        title: 'Beast Workout',
        subtitle: '30 Songs • High BPM Gym Hype',
        coverArt: playlistMap['beast_mode_workout']?.coverArt || getPlaylistArtwork('beast_mode_workout'),
        playlist: playlistMap['beast_mode_workout']
      }
    ];
  }, [localSongs, playBatch, playlistMap]);

  // Curated Tamil Artists List with Category Filtering
  const filteredArtists = useMemo(() => {
    if (artistCategoryFilter === 'all') return TAMIL_ARTISTS;
    return TAMIL_ARTISTS.filter((a) => a.category === artistCategoryFilter);
  }, [artistCategoryFilter]);

  const handleArtistClick = (artist: TamilArtist) => {
    setSelectedArtist(artist);
  };

  const handleArtistPlay = async (artist: TamilArtist) => {
    const isCurrent = Boolean(
      currentSong &&
        (
          (artist.playlistId && playlistMap[artist.playlistId]?.tracks.some((t) => t.id === currentSong.id)) ||
          (currentSong.artist && artistPlaylistService.matchTrackToArtist(currentSong, artist))
        )
    );

    if (isCurrent) {
      togglePlay();
      return;
    }

    try {
      const artistPlaylist = await artistPlaylistService.getArtistPlaylist(artist, localSongs);
      if (artistPlaylist.tracks.length > 0) {
        playBatch(artistPlaylist.tracks);
      }
    } catch (err) {
      console.error('Failed to play artist playlist:', err);
    }
  };

  if (selectedArtist) {
    return (
      <ArtistPlaylistView
        artist={selectedArtist}
        onBack={() => setSelectedArtist(null)}
      />
    );
  }

  return (
    <div className="relative p-4 sm:p-8 space-y-8 max-w-7xl mx-auto select-none pb-28">
      {/* Dynamic Ambient Stage Glows (Nocturne Audio Experience) */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#9d4edd]/20 rounded-full blur-[110px] pointer-events-none -z-10" />
      <div className="absolute top-48 right-4 w-64 h-64 bg-[#00f1fd]/15 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* ========================================================================= */}
      {/* ZONE 1: Contextual Time Greeting & Stitch Filter Chips                     */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#1c1b22] border border-white/[0.08] shadow-inner flex items-center justify-center">
              {greeting.icon}
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#e5e0eb] tracking-tight">
                {greeting.text}, Nanba
              </h2>
              <p className="text-xs text-[#998d9e] font-medium mt-0.5">
                Welcome to your pure cloud high-fidelity music sanctuary
              </p>
            </div>
          </div>

          {/* Cloud Sanctuary Mode Status Badge */}
          <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-full bg-[#1c1b22]/90 border border-white/[0.08] text-xs text-[#d0c2d5] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#00f1fd] animate-pulse shadow-[0_0_8px_#00f1fd]" />
            <span className="font-semibold">Pure Cloud 320k Stream</span>
          </div>
        </div>

        {/* Stitch Horizontal Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 -mx-1 px-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border shrink-0 ${
              activeFilter === 'all'
                ? 'bg-[#9d4edd] text-white border-[#9d4edd] shadow-[0_2px_14px_rgba(157,78,221,0.4)]'
                : 'bg-[#1c1b22] text-[#d0c2d5] border-white/[0.08] hover:bg-[#2a2931] hover:text-white'
            }`}
          >
            All Music
          </button>

          <button
            onClick={() => setActiveFilter('playlists')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 ${
              activeFilter === 'playlists'
                ? 'bg-[#9d4edd] text-white border-[#9d4edd] shadow-[0_2px_14px_rgba(157,78,221,0.4)]'
                : 'bg-[#1c1b22] text-[#d0c2d5] border-white/[0.08] hover:bg-[#2a2931] hover:text-white'
            }`}
          >
            <Sparkles size={13} className="text-[#00f1fd]" />
            <span>Curated Playlists</span>
          </button>

          <button
            onClick={() => setActiveTab('radio')}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 bg-[#1c1b22] text-[#d0c2d5] border-white/[0.08] hover:bg-rose-600/20 hover:text-rose-300 hover:border-rose-500/30"
          >
            <Radio size={13} className="text-rose-400" />
            <span>24/7 Live Radio FM</span>
          </button>

          <button
            onClick={() => setActiveTab('ai-studio')}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 bg-[#1c1b22] text-[#d0c2d5] border-white/[0.08] hover:bg-[#9d4edd]/20 hover:text-[#e0b6ff]"
          >
            <Headphones size={13} className="text-[#e0b6ff]" />
            <span>AI DJ Studio</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 bg-gradient-to-r from-[#00f1fd]/15 to-[#9d4edd]/15 text-[#00f1fd] border-[#00f1fd]/30 hover:text-white"
          >
            <UploadCloud size={13} className="text-[#00f1fd]" />
            <span>Import Playlist</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ZONE 2: Stitch 6-Pack Quick Access Sessions Grid                          */}
      {/* 2 columns on mobile, 3 on desktop with left gradient indicator & play bar */}
      {/* ========================================================================= */}
      {activeFilter === 'all' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickAccessItems.map((item) => {
            const isCurrent = Boolean(
              currentSong && item.playlist && item.playlist.tracks.some((t) => t.id === currentSong.id)
            );
            const isItemPlaying = isCurrent && isPlaying;

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (item.playlist) {
                    setSelectedInbuiltPlaylist(item.playlist);
                  } else if (item.onClick) {
                    item.onClick();
                  }
                }}
                className={`group relative flex items-center gap-3 p-2 pr-4 rounded-2xl transition-all cursor-pointer overflow-hidden border shadow-sm ${
                  isCurrent
                    ? 'bg-[#242036] border-[#9d4edd]/50 shadow-[0_0_20px_rgba(157,78,221,0.2)]'
                    : 'bg-[#1c1b22]/90 hover:bg-[#242036] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {/* Left Active Playing Gradient Bar Indicator */}
                {isItemPlaying && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#00f1fd] via-[#9d4edd] to-[#8433c4] shadow-[0_0_8px_#00f1fd]" />
                )}

                {/* Cover Art / Icon */}
                <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md shrink-0 relative bg-[#14121a]">
                  {item.isLikedIcon ? (
                    <div className="w-full h-full bg-gradient-to-br from-[#9d4edd] to-[#8433c4] flex items-center justify-center">
                      <Heart size={22} className="fill-white text-white" />
                    </div>
                  ) : (
                    <img
                      src={item.coverArt}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  {isItemPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="flex items-end gap-0.5 h-3.5">
                        <span className="w-1 bg-[#00f1fd] h-full animate-pulse" />
                        <span className="w-1 bg-[#00f1fd] h-2/3 animate-bounce" />
                        <span className="w-1 bg-[#00f1fd] h-3/4 animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Text Info */}
                <div className="flex-1 min-w-0">
                  <h4
                    className={`text-sm font-bold truncate transition-colors ${
                      isCurrent ? 'text-[#00f1fd]' : 'text-[#e5e0eb] group-hover:text-white'
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="text-xs text-[#998d9e] truncate mt-0.5">{item.subtitle}</p>
                </div>

                {/* Tactile Play Button (Stitch Kinetic Disc) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.playlist) {
                      if (isCurrent) {
                        togglePlay();
                      } else {
                        playBatch(item.playlist.tracks);
                      }
                    } else if (item.onClick) {
                      item.onClick();
                    }
                  }}
                  className={`w-10 h-10 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] text-white shadow-xl flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer ${
                    isItemPlaying
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95'
                  }`}
                  aria-label={isItemPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
                  title={isItemPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
                >
                  {isItemPlaying ? (
                    <Pause size={16} className="fill-white" />
                  ) : (
                    <Play size={16} className="fill-white ml-0.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZONE 2.5: Aura AI DJ Spotlight Banner ("Nova Focus Flow")                 */}
      {/* ========================================================================= */}
      <div className="relative w-full rounded-2xl overflow-hidden p-5 sm:p-6 bg-gradient-to-r from-[#1c1b22] via-[#242036] to-[#1a1726] border border-[#9d4edd]/30 shadow-xl group">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-[#9d4edd]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -top-12 w-48 h-48 bg-[#00f1fd]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] p-0.5 shadow-[0_0_20px_rgba(157,78,221,0.4)] shrink-0 flex items-center justify-center">
              <div className="w-full h-full bg-[#14121a] rounded-[14px] flex items-center justify-center">
                <Sparkles size={22} className="text-[#00f1fd] animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-[#9d4edd]/25 text-[#e0b6ff] border border-[#9d4edd]/40">
                  Nova Focus Flow
                </span>
                <span className="text-xs text-[#00f1fd] font-bold">AI DJ Spotlight</span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white mt-1">
                Adaptive Tamil Cloud Flow
              </h3>
              <p className="text-xs text-[#998d9e] mt-0.5 max-w-xl">
                Continuous intelligent music selection based on your listening habits with lossless 320kbps cloud transitions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                toggleAuraFlow();
                if (!isPlaying && quickAccessItems[1]?.playlist) {
                  playBatch(quickAccessItems[1].playlist.tracks);
                }
              }}
              className={`px-4 py-2.5 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center gap-2 shadow-md active:scale-95 ${
                isAuraFlow
                  ? 'bg-gradient-to-r from-[#00f1fd] to-[#00dce6] text-black shadow-[0_0_16px_rgba(0,241,253,0.5)]'
                  : 'bg-gradient-to-r from-[#9d4edd] to-[#8433c4] text-white shadow-[0_4px_16px_rgba(157,78,221,0.4)] hover:brightness-110'
              }`}
            >
              <Sparkles size={14} />
              <span>{isAuraFlow ? 'Flow Active' : 'Start Session'}</span>
            </button>

            <button
              onClick={() => setAiAssistantOpen(true)}
              className="px-4 py-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[#e5e0eb] font-semibold text-xs transition-colors cursor-pointer"
            >
              Ask AI DJ
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ZONE 3: Recently Played (Recents)                                         */}
      {/* ========================================================================= */}
      {activeFilter === 'all' && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-[#e5e0eb] tracking-tight flex items-center gap-2">
                <Clock size={22} className="text-[#00f1fd]" />
                <span>Recently Played</span>
              </h3>
              <p className="text-xs text-[#998d9e] mt-0.5">
                Jump back into your recent music and cloud tracks
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={handleShowAllRecents}
                className="flex items-center gap-1.5 text-xs font-bold text-[#e0b6ff] hover:text-white transition-colors group cursor-pointer"
              >
                <span>Show all</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>

              {historySongs.length > 0 && (
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    onClick={() => scrollRecents('left')}
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-[#998d9e] hover:text-white transition-all active:scale-95 cursor-pointer"
                    title="Previous Recent Tracks"
                    aria-label="Previous Recent Tracks"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => scrollRecents('right')}
                    className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-[#998d9e] hover:text-white transition-all active:scale-95 cursor-pointer"
                    title="Next Recent Tracks"
                    aria-label="Next Recent Tracks"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {historySongs.length > 0 ? (
            <div
              ref={recentsScrollRef}
              className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-3 pt-1 -mx-1 px-1 touch-pan-x"
            >
              {historySongs.map((song) => {
                const isCurrent = currentSong?.id === song.id;
                const isSongPlaying = isCurrent && isPlaying;
                const coverArt = song.artwork || song.coverArt;

                return (
                  <div
                    key={`recent-${song.id}`}
                    onClick={() => {
                      if (isCurrent) {
                        togglePlay();
                      } else {
                        playSong(song, historySongs);
                      }
                    }}
                    className={`group w-36 sm:w-44 shrink-0 snap-start p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-[#242036] border-[#9d4edd]/50 shadow-[0_0_16px_rgba(157,78,221,0.2)]'
                        : 'bg-[#1c1b22]/90 hover:bg-[#201f26] border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-lg mb-2.5 bg-[#14121a]">
                      {coverArt ? (
                        <img
                          src={coverArt}
                          alt={song.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#1c1b22] to-[#2a2931] flex items-center justify-center text-white/40">
                          <Clock size={28} />
                        </div>
                      )}

                      {/* Hi-Res Pill Badge */}
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-black/60 backdrop-blur-md text-[#00f1fd] border border-white/10">
                        320k
                      </span>

                      {/* Play / Pause Overlay Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrent) {
                            togglePlay();
                          } else {
                            playSong(song, historySongs);
                          }
                        }}
                        className={`absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] text-white shadow-xl shadow-black/80 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                          isSongPlaying
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95'
                        }`}
                        title={isSongPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                      >
                        {isSongPlaying ? (
                          <Pause size={15} className="fill-white" />
                        ) : (
                          <Play size={15} className="fill-white ml-0.5" />
                        )}
                      </button>
                    </div>

                    <div>
                      <h4
                        className={`text-xs sm:text-sm font-bold truncate ${
                          isCurrent ? 'text-[#00f1fd]' : 'text-[#e5e0eb] group-hover:text-white'
                        }`}
                        title={song.title}
                      >
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-[#998d9e] truncate mt-0.5" title={song.artist}>
                        {song.artist || 'Unknown Artist'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-[#1c1b22] border border-white/[0.06] flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#2a2931] flex items-center justify-center text-[#998d9e] shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">No recent plays yet</h4>
                <p className="text-xs text-[#998d9e] mt-0.5">
                  Play any Tamil hit or FM station to build your personal cloud listening history.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* ZONE 4: Made For You • Curated Tamil Playlists                            */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'playlists') && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-[#e5e0eb] tracking-tight flex items-center gap-2">
                <span>Top Tamil Playlists • Curated Blockbusters</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[#9d4edd]/25 text-[#e0b6ff] border border-[#9d4edd]/30">
                  Kollywood
                </span>
              </h3>
              <p className="text-xs text-[#998d9e] mt-0.5">
                Official Tamil blockbusters, Anirudh mass anthems, and evergreen Rahman melodies in verified 320kbps audio.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-[#00f1fd]/15 to-[#9d4edd]/15 text-[#00f1fd] border border-[#00f1fd]/30 font-semibold text-xs shadow-md transition-all cursor-pointer"
              >
                <UploadCloud size={14} />
                <span>Import Playlist</span>
              </button>

              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => scrollPlaylists('left')}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-[#998d9e] hover:text-white transition-all active:scale-95 cursor-pointer"
                  title="Previous Playlists"
                  aria-label="Previous Playlists"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => scrollPlaylists('right')}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-[#998d9e] hover:text-white transition-all active:scale-95 cursor-pointer"
                  title="Next Playlists"
                  aria-label="Next Playlists"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={playlistScrollRef}
            className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-3 pt-1 -mx-1 px-1 touch-pan-x"
          >
            {INBUILT_PLAYLISTS.map((playlist) => {
              const isCurrent = Boolean(
                currentSong && playlist.tracks.some((t) => t.id === currentSong.id)
              );
              const isPlaylistPlaying = isCurrent && isPlaying;

              return (
                <div
                  key={playlist.id}
                  onClick={() => setSelectedInbuiltPlaylist(playlist)}
                  className={`group w-40 sm:w-48 lg:w-52 shrink-0 snap-start p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-[#242036] border-[#9d4edd]/50 shadow-[0_0_16px_rgba(157,78,221,0.2)]'
                      : 'bg-[#1c1b22]/90 hover:bg-[#201f26] border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  {/* 1:1 Square Cover Art */}
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-lg mb-3 bg-[#14121a]">
                    <img
                      src={playlist.coverArt}
                      alt={playlist.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {isPlaylistPlaying && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00f1fd] animate-pulse" />
                        <span className="text-[10px] font-bold text-[#00f1fd]">PLAYING</span>
                      </div>
                    )}

                    <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-black/60 backdrop-blur-md text-[#e0b6ff]">
                      320k HD
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCurrent) {
                          togglePlay();
                        } else {
                          playBatch(playlist.tracks);
                        }
                      }}
                      className={`absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] text-white shadow-xl shadow-black/80 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        isPlaylistPlaying
                          ? 'opacity-100 scale-100'
                          : 'opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95'
                      }`}
                      title={isPlaylistPlaying ? `Pause ${playlist.title}` : `Play ${playlist.title}`}
                    >
                      {isPlaylistPlaying ? (
                        <Pause size={16} className="fill-white" />
                      ) : (
                        <Play size={16} className="fill-white ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div>
                    <h4
                      className={`text-xs sm:text-sm font-bold truncate transition-colors ${
                        isCurrent ? 'text-[#00f1fd]' : 'text-[#e5e0eb] group-hover:text-white'
                      }`}
                    >
                      {playlist.title}
                    </h4>
                    <p className="text-[11px] text-[#998d9e] truncate mt-0.5">
                      {playlist.songCount} songs • Curated
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ZONE 5: Heavy Rotation Top Tamil Artists (Maestros & Legends)              */}
      {/* ========================================================================= */}
      {activeFilter === 'all' && (
        <section className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-[#e5e0eb] tracking-tight">
                Top Tamil Music Directors & Legends
              </h3>
              <p className="text-xs text-[#998d9e] mt-0.5">
                {filteredArtists.length} iconic maestros, living legends & contemporary voices
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1 p-1 bg-[#1c1b22] border border-white/[0.06] rounded-full">
                {(['all', 'composer', 'legend', 'contemporary'] as ArtistCategory[]).map((cat) => {
                  const count =
                    cat === 'all'
                      ? TAMIL_ARTISTS.length
                      : TAMIL_ARTISTS.filter((a) => a.category === cat).length;
                  const isSelected = artistCategoryFilter === cat;

                  return (
                    <button
                      key={cat}
                      onClick={() => setArtistCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#9d4edd] text-white shadow-md'
                          : 'text-[#998d9e] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {ARTIST_CATEGORY_LABELS[cat]} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => scrollArtists('left')}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-[#998d9e] hover:text-white transition-all active:scale-95 cursor-pointer"
                  title="Previous Artists"
                  aria-label="Previous Artists"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => scrollArtists('right')}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-[#998d9e] hover:text-white transition-all active:scale-95 cursor-pointer"
                  title="Next Artists"
                  aria-label="Next Artists"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={artistScrollRef}
            className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-3 pt-1 -mx-1 px-1 touch-pan-x"
          >
            {filteredArtists.map((artist) => {
              const isCurrent = Boolean(
                currentSong &&
                  (
                    (artist.playlistId && playlistMap[artist.playlistId]?.tracks.some((t) => t.id === currentSong.id)) ||
                    (currentSong.artist && artistPlaylistService.matchTrackToArtist(currentSong, artist))
                  )
              );
              const isArtistPlaying = isCurrent && isPlaying;
              const hasImageError = Boolean(failedImages[artist.id]);

              return (
                <div
                  key={artist.id}
                  onClick={() => handleArtistClick(artist)}
                  className={`flex-none w-36 sm:w-40 p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center group select-none ${
                    isCurrent
                      ? 'bg-[#242036] border-[#9d4edd]/50 shadow-[0_0_16px_rgba(157,78,221,0.2)]'
                      : 'bg-[#1c1b22]/70 hover:bg-[#201f26] border-transparent hover:border-white/[0.08]'
                  }`}
                >
                  {/* Circular Portrait with Gradient Glowing Ring */}
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden shadow-xl mb-3 bg-[#14121a] p-0.5 bg-gradient-to-tr from-[#9d4edd]/40 to-[#00f1fd]/40 group-hover:from-[#9d4edd] group-hover:to-[#00f1fd] transition-all">
                    <div className="w-full h-full rounded-full overflow-hidden">
                      {hasImageError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1c1b22] to-[#2a2931] text-white p-2">
                          <span className="text-xl font-black tracking-wider text-[#e0b6ff]">
                            {artist.name
                              .split(' ')
                              .map((part) => part[0])
                              .filter(Boolean)
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </span>
                        </div>
                      ) : (
                        <img
                          src={artist.image}
                          alt={artist.name}
                          onError={() => setFailedImages((prev) => ({ ...prev, [artist.id]: true }))}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      )}
                    </div>

                    {/* Hover Play Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArtistPlay(artist);
                      }}
                      className={`absolute bottom-1 right-1 w-9 h-9 rounded-full bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] text-white shadow-xl shadow-black/80 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                        isArtistPlaying
                          ? 'opacity-100 scale-100'
                          : 'opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95'
                      }`}
                      title={isArtistPlaying ? `Pause ${artist.name}` : `Play ${artist.name}`}
                      aria-label={isArtistPlaying ? `Pause ${artist.name}` : `Play ${artist.name}`}
                    >
                      {isArtistPlaying ? (
                        <Pause size={14} className="fill-white" />
                      ) : (
                        <Play size={14} className="fill-white ml-0.5" />
                      )}
                    </button>
                  </div>

                  <h4
                    className={`text-xs sm:text-sm font-bold truncate max-w-full transition-colors ${
                      isCurrent ? 'text-[#00f1fd]' : 'text-[#e5e0eb] group-hover:text-white'
                    }`}
                    title={artist.name}
                  >
                    {artist.name}
                  </h4>
                  <p
                    className="text-[10px] text-[#998d9e] truncate max-w-full mt-0.5"
                    title={artist.subtitle}
                  >
                    {artist.subtitle}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ZONE 6: 24/7 Live Radio FM Carousel                                       */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'radio') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-[#e5e0eb] tracking-tight flex items-center gap-2">
                <span>24/7 Live Radio FM Stations</span>
                <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  LIVE
                </span>
              </h3>
              <p className="text-xs text-[#998d9e] mt-0.5">
                Top live broadcasts • High-bitrate stereo with zero buffering.
              </p>
            </div>

            <button
              onClick={() => setActiveTab('radio')}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors group cursor-pointer"
            >
              <span>See All ({LIVE_RADIO_STATIONS.length})</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="flex gap-3.5 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-2 pt-1">
            {LIVE_RADIO_STATIONS.slice(0, 5).map((station) => {
              const stationSong = getStationAsSong(station);
              const isCurrent = currentSong?.filePath === station.streamUrl;

              return (
                <div
                  key={station.id}
                  onClick={() => playSong(stationSong)}
                  className={`w-40 sm:w-44 shrink-0 snap-start group p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-rose-500/15 border-rose-500/40 shadow-lg shadow-rose-500/10'
                      : 'bg-[#1c1b22]/90 hover:bg-[#201f26] border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-md mb-2.5 bg-[#14121a]">
                    <img
                      src={station.logo}
                      alt={station.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    <span className="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10">
                      {station.frequency}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playSong(stationSong);
                      }}
                      className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
                      title={`Tune into ${station.name}`}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause size={14} className="fill-current" />
                      ) : (
                        <Play size={14} className="fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[#e5e0eb] truncate group-hover:text-rose-300 transition-colors">
                      {station.name}
                    </h4>
                    <p className="text-[10px] text-[#998d9e] truncate mt-0.5">{station.genre}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Inbuilt Playlist Detail Modal */}
      <InbuiltPlaylistModal
        playlist={selectedInbuiltPlaylist}
        onClose={() => setSelectedInbuiltPlaylist(null)}
      />

      {/* Universal Playlist Importer Modal */}
      <ImportPlaylistModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};
