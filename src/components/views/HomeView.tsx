import React, { useState, useMemo } from 'react';
import {
  Play,
  Pause,
  Sparkles,
  Radio,
  Music2,
  Heart,
  Disc,
  Clock,
  Flame,
  Coffee,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  CheckCircle2,
  ListMusic
} from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { Song } from '../../types/music';
import { LIVE_RADIO_STATIONS, getStationAsSong, RadioStation } from '../../services/radioService';
import { PRESET_SAAVN_320K_HITS } from '../../services/jiosaavnService';
import {
  INBUILT_PLAYLISTS,
  InbuiltPlaylist,
  inbuiltPlaylistsService
} from '../../services/inbuiltPlaylistsService';
import { InbuiltPlaylistModal } from '../common/InbuiltPlaylistModal';
import { Artwork } from '../common/Artwork';

export const HomeView: React.FC = () => {
  const { songs: localSongs, playlists, stats, setActiveTab } = useLibraryStore();
  const { currentSong, isPlaying, playSong, togglePlay, playBatch } = usePlayerStore();

  const [activeFilter, setActiveFilter] = useState<'all' | 'playlists' | 'radio'>('all');
  const [selectedInbuiltPlaylist, setSelectedInbuiltPlaylist] = useState<InbuiltPlaylist | null>(null);

  // Dynamic Contextual Time Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) {
      return { text: 'Good morning', icon: <Sunrise size={20} className="text-amber-400" /> };
    } else if (hour >= 12 && hour < 17) {
      return { text: 'Good afternoon', icon: <Sun size={20} className="text-orange-400" /> };
    } else if (hour >= 17 && hour < 21) {
      return { text: 'Good evening', icon: <Sunset size={20} className="text-rose-400" /> };
    } else {
      return { text: 'Late night vibes', icon: <Moon size={20} className="text-indigo-400" /> };
    }
  }, []);

  // Quick 6-Pack Grid Data (100% Inbuilt Playlists, Zero Search Redirects!)
  const quickAccessItems = useMemo(() => {
    return [
      {
        id: 'liked_songs',
        title: 'Liked Songs',
        subtitle: `${localSongs.filter((s) => s.isFavorite).length || 0} tracks`,
        coverArt: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300',
        gradient: 'from-violet-700 to-indigo-900',
        icon: <Heart size={20} className="fill-white text-white" />,
        onClick: () => {
          const favorites = localSongs.filter((s) => s.isFavorite);
          if (favorites.length > 0) {
            playBatch(favorites);
          } else {
            // Open Top 50 if no local favorites yet
            if (INBUILT_PLAYLISTS[0]) {
              setSelectedInbuiltPlaylist(INBUILT_PLAYLISTS[0]);
            }
          }
        }
      },
      {
        id: 'top_50_tamil',
        title: 'Top 50 – Tamil Hits',
        subtitle: '50 Blockbusters • Trending',
        coverArt: INBUILT_PLAYLISTS[0]?.coverArt || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
        gradient: 'from-amber-600 to-orange-900',
        playlist: INBUILT_PLAYLISTS[0] // Top 50 Tamil Blockbusters with 50 tracks!
      },
      {
        id: 'daily_mix_1',
        title: 'Anirudh Mass & Kuthu',
        subtitle: 'Hukum, Naa Ready & Beast',
        coverArt: INBUILT_PLAYLISTS[1]?.coverArt || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
        gradient: 'from-indigo-600 to-blue-900',
        playlist: INBUILT_PLAYLISTS[1] // Anirudh Mass Anthems
      },
      {
        id: 'midnight_chill',
        title: 'Midnight Chill',
        subtitle: 'Lo-Fi, Calm & Rain',
        coverArt: INBUILT_PLAYLISTS[5]?.coverArt || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300',
        gradient: 'from-emerald-700 to-slate-950',
        playlist: INBUILT_PLAYLISTS[5] // Midnight Chill with 10 songs
      },
      {
        id: 'beast_workout',
        title: 'Beast Workout',
        subtitle: 'High BPM Gym Hype',
        coverArt: INBUILT_PLAYLISTS[6]?.coverArt || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300',
        gradient: 'from-rose-600 to-red-950',
        playlist: INBUILT_PLAYLISTS[6] // Beast Workout with 10 songs
      },
      {
        id: 'ai_dj_studio',
        title: 'AI DJ & Mood Studio',
        subtitle: 'Prompt-driven Playlists',
        coverArt: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300',
        gradient: 'from-purple-600 to-pink-950',
        icon: <Sparkles size={20} className="text-amber-400" />,
        onClick: () => {
          setActiveTab('ai-studio');
        }
      }
    ];
  }, [localSongs, playBatch, setActiveTab]);

  // Top Artists Curated List
  const topArtists = useMemo(() => {
    return [
      {
        name: 'Anirudh Ravichander',
        role: 'Rockstar • Kollywood',
        image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300',
        query: 'Anirudh Ravichander',
        seedSong: PRESET_SAAVN_320K_HITS[0] // Hukum
      },
      {
        name: 'A.R. Rahman',
        role: 'Isai Puyal • Maestro',
        image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
        query: 'A.R. Rahman',
        seedSong: PRESET_SAAVN_320K_HITS[5] // Vaseegara / Rahman classics
      },
      {
        name: 'Yuvan Shankar Raja',
        role: 'U1 • Drug BGM Specialist',
        image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
        query: 'Yuvan Shankar Raja',
        seedSong: PRESET_SAAVN_320K_HITS[1]
      },
      {
        name: 'Harris Jayaraj',
        role: 'Melody King • Minnale',
        image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300',
        query: 'Harris Jayaraj',
        seedSong: PRESET_SAAVN_320K_HITS[5] // Vaseegara
      },
      {
        name: 'Ilaiyaraaja',
        role: 'Isaignani • Living Legend',
        image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300',
        query: 'Ilaiyaraaja',
        seedSong: INBUILT_PLAYLISTS[4]?.tracks[0] || PRESET_SAAVN_320K_HITS[0] // Ilaya Nila
      },
      {
        name: 'S.P. Balasubrahmanyam',
        role: 'Padma Vibhushan • Voice of Soul',
        image: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300',
        query: 'S.P. Balasubrahmanyam',
        seedSong: INBUILT_PLAYLISTS[4]?.tracks[1] || PRESET_SAAVN_320K_HITS[5] // Mandram Vantha
      }
    ];
  }, []);

  return (
    <div className="p-4 sm:p-8 space-y-9 max-w-7xl mx-auto select-none pb-28">
      {/* ========================================================================= */}
      {/* ZONE 1: Contextual Time Greeting & Micro-Mood Filter Pills               */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
              {greeting.icon}
            </span>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {greeting.text}, Nanba
              </h2>
              <p className="text-xs text-neutral-400 font-medium mt-0.5">
                What do you feel like listening to today?
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-xs text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{INBUILT_PLAYLISTS.length} Inbuilt Playlists • 9 Live FM Stations Active</span>
          </div>
        </div>

        {/* 4 Clean Filter Pills (Hick's Law: Reduced from 8 noisy pills to 4) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border shrink-0 ${
              activeFilter === 'all'
                ? 'bg-white text-black border-white shadow-md'
                : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            Tamil Hits (All)
          </button>

          <button
            onClick={() => setActiveFilter('playlists')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 ${
              activeFilter === 'playlists'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Sparkles size={13} className="text-amber-400" />
            <span>Curated Playlists</span>
          </button>

          <button
            onClick={() => setActiveFilter('radio')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border shrink-0 flex items-center gap-1.5 ${
              activeFilter === 'radio'
                ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Radio size={13} />
            <span>24/7 Live Radio FM</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ZONE 2: The Iconic 6-Pack Quick Access Grid                              */}
      {/* Mobile Touch Ergonomics: Tap card opens detail view; hover shows green play */}
      {/* ========================================================================= */}
      {activeFilter === 'all' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickAccessItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.playlist) {
                  setSelectedInbuiltPlaylist(item.playlist);
                } else if (item.onClick) {
                  item.onClick();
                }
              }}
              className="group relative flex items-center gap-3.5 p-2 pr-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 transition-all cursor-pointer overflow-hidden shadow-sm"
            >
              {/* Cover Art */}
              <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md shrink-0 relative bg-black/40">
                <img
                  src={item.coverArt}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate group-hover:text-indigo-200 transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-neutral-400 truncate mt-0.5">{item.subtitle}</p>
              </div>

              {/* Desktop Hover Quick Play Button (Fitts's Law) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.playlist) {
                    playBatch(item.playlist.tracks);
                  } else if (item.onClick) {
                    item.onClick();
                  }
                }}
                className="w-10 h-10 rounded-full bg-[#1ed760] text-black shadow-xl shadow-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 shrink-0 cursor-pointer"
                title={`Play ${item.title}`}
              >
                <Play size={16} className="fill-current ml-0.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZONE 3 - SHELF 1: Made For You • Inbuilt Playlists                       */}
      {/* 100% Functional, Curated, High-Fidelity Playlists                        */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'playlists') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Top Tamil Playlists • Curated Blockbusters</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Kollywood
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Official Tamil blockbusters, Anirudh mass anthems, and evergreen Rahman melodies in verified 320kbps audio.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
            {INBUILT_PLAYLISTS.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => setSelectedInbuiltPlaylist(playlist)}
                className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-all cursor-pointer flex flex-col justify-between"
              >
                {/* 1:1 Square Cover Art */}
                <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-lg mb-3 bg-black/40">
                  <img
                    src={playlist.coverArt}
                    alt={playlist.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Desktop Hover Floating Green Play Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playBatch(playlist.tracks);
                    }}
                    className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-[#1ed760] text-black shadow-xl shadow-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
                    title={`Play ${playlist.title}`}
                  >
                    <Play size={16} className="fill-current ml-0.5" />
                  </button>
                </div>

                {/* Playlist Meta */}
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-indigo-200 transition-colors">
                    {playlist.title}
                  </h4>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {playlist.songCount} songs • 320k HD
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ZONE 3 - SHELF 2: 24/7 Live Radio FM Stations                            */}
      {/* 100% Verified, Rock-Solid, Zero Buffering Live Streams                    */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'radio') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>24/7 Live Radio FM Stations</span>
                <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  ON AIR
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Continuous live web broadcasts streaming in high-bitrate digital stereo without interruptions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {LIVE_RADIO_STATIONS.map((station) => {
              const stationSong = getStationAsSong(station);
              const isCurrent = currentSong?.filePath === station.streamUrl;

              return (
                <div
                  key={station.id}
                  onClick={() => playSong(stationSong)}
                  className={`group p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-red-500/15 border-red-500/40 shadow-lg shadow-red-500/10'
                      : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-md mb-2.5 bg-black/40">
                    <img
                      src={station.logo}
                      alt={station.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    <span className="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-black uppercase rounded-md bg-black/60 backdrop-blur-md text-white border border-white/10">
                      {station.frequency}
                    </span>

                    {/* Quick Play Trigger */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playSong(stationSong);
                      }}
                      className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
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
                    <h4 className="text-xs font-bold text-white truncate group-hover:text-red-300 transition-colors">
                      {station.name}
                    </h4>
                    <p className="text-[10px] text-neutral-400 truncate mt-0.5">{station.genre}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ZONE 3 - SHELF 3: Trending Tamil Hits • Kollywood Chartbusters            */}
      {/* Direct Blockbusters with High-Bitrate Audio                               */}
      {/* ========================================================================= */}
      {activeFilter === 'all' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Trending Tamil Hits</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Kollywood
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Most popular Tamil movie hits, energetic dance anthems, and viral chartbusters.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {PRESET_SAAVN_320K_HITS.map((song) => {
              const isCurrent = currentSong?.id === song.id;

              return (
                <div
                  key={song.id}
                  onClick={() => playSong(song, PRESET_SAAVN_320K_HITS)}
                  className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-lg mb-2.5 bg-black/40">
                    <img
                      src={song.coverArt}
                      alt={song.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-black rounded bg-indigo-600/80 backdrop-blur-md text-white shadow-sm">
                      TOP HIT
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playSong(song, PRESET_SAAVN_320K_HITS);
                      }}
                      className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-[#1ed760] text-black shadow-xl shadow-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
                      title={`Play ${song.title}`}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause size={15} className="fill-current" />
                      ) : (
                        <Play size={15} className="fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div>
                    <h4
                      className={`text-xs sm:text-sm font-bold truncate ${
                        isCurrent ? 'text-[#1ed760]' : 'text-white group-hover:text-indigo-200'
                      }`}
                    >
                      {song.title}
                    </h4>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">{song.artist}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ZONE 3 - SHELF 4: Top Artists                                            */}
      {/* Jakob's Law: Distinct Circular Avatars                                   */}
      {/* ========================================================================= */}
      {activeFilter === 'all' && (
        <section className="space-y-4 pt-2">
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Top Tamil Music Directors & Legends
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {topArtists.map((artist) => (
              <div
                key={artist.name}
                onClick={() => playSong(artist.seedSong)}
                className="group p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/5 transition-all cursor-pointer flex flex-col items-center text-center"
              >
                {/* Circular Portrait */}
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden shadow-xl mb-3 bg-black/40">
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />

                  {/* Hover Green Play Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSong(artist.seedSong);
                    }}
                    className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-[#1ed760] text-black shadow-xl shadow-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
                    title={`Play ${artist.name}`}
                  >
                    <Play size={14} className="fill-current ml-0.5" />
                  </button>
                </div>

                <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-full group-hover:text-indigo-200 transition-colors">
                  {artist.name}
                </h4>
                <p className="text-[10px] text-neutral-400 truncate max-w-full mt-0.5">
                  {artist.role}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* Spotify-Grade Inbuilt Playlist Detail Modal                              */}
      {/* Handles Back-Button popstate, Play All vs Add to Queue, and Offline mode */}
      {/* ========================================================================= */}
      <InbuiltPlaylistModal
        playlist={selectedInbuiltPlaylist}
        onClose={() => setSelectedInbuiltPlaylist(null)}
      />
    </div>
  );
};
