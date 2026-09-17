import React, { useState, useMemo } from 'react';
import {
  Radio,
  Search,
  Play,
  Pause,
  Flame,
  Globe,
  Disc,
  Headphones
} from 'lucide-react';
import { LIVE_RADIO_STATIONS, getStationAsSong, RadioCategory, RadioStation } from '../../services/radioService';
import { usePlayerStore } from '../../store/usePlayerStore';

const CATEGORIES: Array<{ id: RadioCategory; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'All Stations (16)', icon: <Radio size={14} /> },
  { id: 'commercial', label: '🔥 Commercial Tamil FM', icon: <Flame size={14} /> },
  { id: 'legends', label: '👑 24/7 Legends', icon: <Disc size={14} /> },
  { id: 'global', label: '🌍 Global Tamil', icon: <Globe size={14} /> },
  { id: 'chill', label: '🎧 Chill, Lo-Fi & EDM', icon: <Headphones size={14} /> }
];

export const RadioView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<RadioCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playSong = usePlayerStore((s) => s.playSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  const filteredStations = useMemo(() => {
    let list = LIVE_RADIO_STATIONS;

    if (selectedCategory !== 'all') {
      list = list.filter((s) => s.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.tagline.toLowerCase().includes(q) ||
          s.genre.toLowerCase().includes(q) ||
          (s.frequency && s.frequency.toLowerCase().includes(q)) ||
          (s.dialFrequency && s.dialFrequency.toLowerCase().includes(q))
      );
    }

    return list;
  }, [selectedCategory, searchQuery]);

  const activeStation = useMemo(() => {
    if (!currentSong?.isLiveRadio) return null;
    return LIVE_RADIO_STATIONS.find(
      (s) => s.streamUrl === currentSong.filePath || s.backupUrls?.includes(currentSong.filePath || '')
    );
  }, [currentSong]);

  const handleToggleStation = (station: RadioStation) => {
    const isCurrent = activeStation?.id === station.id;
    if (isCurrent) {
      togglePlay();
    } else {
      const stationSong = getStationAsSong(station);
      playSong(stationSong);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-7 max-w-7xl mx-auto select-none pb-28">
      {/* 1. Header & Live Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Live Radio FM</span>
              <span className="text-indigo-400">24/7</span>
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm shadow-rose-500/10">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              ON AIR
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Verified, high-bitrate digital streams from Tamil Nadu, Sri Lanka, Singapore, Europe & Global
          </p>
        </div>

        {/* Live Tuning Badge */}
        {activeStation && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-indigo-950/40 border border-rose-500/30 flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/50 shrink-0 border border-white/10 p-0.5">
              <img src={activeStation.logo} alt={activeStation.name} className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  {isPlaying ? 'Now Streaming' : 'Paused'}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white truncate">{activeStation.name}</h4>
            </div>
            <button
              onClick={() => handleToggleStation(activeStation)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer ml-auto shrink-0"
              title={isPlaying ? 'Pause' : 'Resume'}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
          </div>
        )}
      </div>

      {/* 2. Search & Category Filters */}
      <div className="space-y-3.5">
        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            name="aura_radio_station_filter"
            id="aura_radio_station_filter"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search station name, frequency (e.g. '93.5', 'Suryan', 'ARR')..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-white placeholder:text-neutral-500 text-xs focus:outline-none focus:border-indigo-500/60 transition-colors"
          />
        </div>

        {/* Category Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border border-indigo-500'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/5'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Stations Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {filteredStations.map((station) => {
          const isCurrent = activeStation?.id === station.id;
          const isThisPlaying = isCurrent && isPlaying;

          return (
            <div
              key={station.id}
              onClick={() => handleToggleStation(station)}
              className={`group p-3.5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                isCurrent
                  ? 'bg-gradient-to-b from-rose-950/40 to-[#0e1118] border-rose-500/50 shadow-xl shadow-rose-950/30'
                  : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5 hover:border-white/10 hover:shadow-xl hover:shadow-black/40'
              }`}
            >
              {/* Card Artwork & Logo */}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-3 bg-[#0a0c12] border border-white/5 flex items-center justify-center p-3 shadow-inner">
                {/* Official Brand Logo */}
                <img
                  src={station.logo}
                  alt={station.name}
                  className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Dial Frequency Badge */}
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[9px] font-black uppercase rounded-lg bg-black/75 backdrop-blur-md text-white border border-white/15 shadow">
                  {station.frequency}
                </span>

                {/* Bitrate Badge */}
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 text-[9px] font-black uppercase rounded-lg bg-indigo-950/80 backdrop-blur-md text-indigo-300 border border-indigo-500/30 shadow">
                  {station.bitrate}k
                </span>

                {/* Quick Play/Pause Action Overlay */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStation(station);
                  }}
                  className={`absolute bottom-3 right-3 w-11 h-11 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-200 cursor-pointer ${
                    isThisPlaying
                      ? 'bg-rose-600 text-white scale-100 opacity-100'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95'
                  }`}
                  title={isThisPlaying ? 'Pause' : `Play ${station.name}`}
                >
                  {isThisPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>

                {/* Animated Waveform when playing */}
                {isThisPlaying && (
                  <div className="absolute bottom-3 left-3 flex items-end gap-1 h-5 px-2 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/10">
                    <span className="w-1 bg-rose-400 rounded-full animate-[bounce_0.8s_infinite] h-3" />
                    <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1.1s_infinite] h-4" />
                    <span className="w-1 bg-rose-400 rounded-full animate-[bounce_0.6s_infinite] h-2.5" />
                    <span className="w-1 bg-rose-400 rounded-full animate-[bounce_0.9s_infinite] h-3.5" />
                  </div>
                )}
              </div>

              {/* Station Info */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                    {station.name}
                  </h3>
                </div>
                <p className="text-[11px] text-neutral-400 truncate">{station.tagline}</p>
                <div className="pt-1.5 flex items-center justify-between text-[10px] text-neutral-500">
                  <span className="truncate">{station.genre}</span>
                  {station.backupUrls && station.backupUrls.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 shrink-0 text-[8px]">
                      Auto-Failover
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredStations.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-white/[0.02] border border-white/5 space-y-2">
          <Radio size={32} className="mx-auto text-neutral-500 mb-2" />
          <h4 className="text-sm font-bold text-white">No stations matched "{searchQuery}"</h4>
          <p className="text-xs text-neutral-400">Try searching for a different frequency or keyword.</p>
        </div>
      )}
    </div>
  );
};
