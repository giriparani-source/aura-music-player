import React, { useEffect, useState } from 'react';
import {
  Sliders,
  RotateCcw,
  Power,
  Sparkles,
  X,
  Mic2,
  Waves,
  Film,
  Disc,
  ShieldCheck,
  Music,
  ArrowRightLeft,
  Volume2
} from 'lucide-react';
import { audioEffectsService } from '../../services/audioEffectsService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { EqualizerBand, EqualizerPreset, SpatialPreset } from '../../types/music';

const PRESET_OPTIONS: { id: EqualizerPreset; label: string }[] = [
  { id: 'flat', label: 'Flat' },
  { id: 'bass', label: 'Bass Boost' },
  { id: 'treble', label: 'Treble Boost' },
  { id: 'vocal', label: 'Vocal / Acoustic' },
  { id: 'pop', label: 'Pop' },
  { id: 'rock', label: 'Rock' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'classical', label: 'Classical' }
];

const SPATIAL_ROOMS: {
  id: SpatialPreset;
  title: string;
  badge: string;
  desc: string;
  icon: React.ReactNode;
  gradient: string;
}[] = [
  {
    id: 'off',
    title: 'Studio Pure',
    badge: 'Direct Sound',
    desc: 'Uncolored natural stereo studio output with zero artificial room reverb.',
    icon: <Music size={18} className="text-neutral-400" />,
    gradient: 'from-neutral-800 to-neutral-900'
  },
  {
    id: 'theatre',
    title: 'Grand Theatre',
    badge: 'Cinema 3D',
    desc: 'Dolby & IMAX-grade acoustic reflections with enveloping cinematic wide surround.',
    icon: <Film size={18} className="text-amber-400" />,
    gradient: 'from-amber-600/20 to-rose-600/20'
  },
  {
    id: 'concert',
    title: 'Live Arena',
    badge: 'Stadium',
    desc: 'Massive open stadium dispersion with rich crowd-scale acoustic reflections.',
    icon: <Waves size={18} className="text-indigo-400" />,
    gradient: 'from-indigo-600/20 to-cyan-600/20'
  },
  {
    id: 'cathedral',
    title: 'Acoustic Cathedral',
    badge: 'Monumental',
    desc: 'Monumental stone hall architecture with high ceiling harmonic sustain.',
    icon: <Sparkles size={18} className="text-purple-400" />,
    gradient: 'from-purple-600/20 to-pink-600/20'
  },
  {
    id: 'club',
    title: 'Audiophile Club',
    badge: 'Punchy Groove',
    desc: 'Ultra-tight, high-density acoustic reflections tuned for electronic & bass music.',
    icon: <Disc size={18} className="text-emerald-400" />,
    gradient: 'from-emerald-600/20 to-teal-600/20'
  }
];

type PanelSubTab = 'eq' | 'spatial' | 'karaoke-dj';

export const EqualizerPanel: React.FC = () => {
  const {
    setNowPlayingOpen,
    currentSong,
    spatialPreset,
    setSpatialPreset,
    spatialMix,
    setSpatialMix,
    isKaraoke,
    toggleKaraoke,
    karaokeDepth,
    setKaraokeDepth,
    crossfadeSeconds,
    setCrossfadeSeconds
  } = usePlayerStore();

  const [activeTab, setActiveTab] = useState<PanelSubTab>('eq');
  const [bands, setBands] = useState<EqualizerBand[]>(audioEffectsService.getBands());
  const [preset, setPreset] = useState<EqualizerPreset>(audioEffectsService.getPreset());
  const [preamp, setPreamp] = useState<number>(audioEffectsService.getPreamp());
  const [isBypassed, setIsBypassed] = useState<boolean>(audioEffectsService.isEqBypassed());
  const [aiProfile, setAiProfile] = useState<string | null>(audioEffectsService.getAiProfileName());

  useEffect(() => {
    const unsubscribe = audioEffectsService.subscribe(() => {
      setBands(audioEffectsService.getBands());
      setPreset(audioEffectsService.getPreset());
      setPreamp(audioEffectsService.getPreamp());
      setIsBypassed(audioEffectsService.isEqBypassed());
      setAiProfile(audioEffectsService.getAiProfileName());
    });
    return unsubscribe;
  }, []);

  const handleGainChange = (idx: number, val: number) => {
    audioEffectsService.setBandGain(idx, val);
  };

  const handlePreampChange = (val: number) => {
    audioEffectsService.setPreampGain(val);
  };

  const handlePresetSelect = (p: EqualizerPreset) => {
    audioEffectsService.applyPreset(p);
  };

  const handleToggleBypass = () => {
    audioEffectsService.toggleBypass();
  };

  const handleReset = () => {
    audioEffectsService.resetToFlat();
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-7 rounded-3xl bg-[#0a0c13]/90 border border-white/10 backdrop-blur-2xl shadow-2xl space-y-5 select-none animate-in fade-in duration-200">
      {/* Top Header: Title, Sub-tabs & Close */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
            {activeTab === 'eq' && <Sliders size={20} />}
            {activeTab === 'spatial' && <Film size={20} className="text-amber-400" />}
            {activeTab === 'karaoke-dj' && <Mic2 size={20} className="text-emerald-400" />}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>
                {activeTab === 'eq' && 'Graphic Equalizer'}
                {activeTab === 'spatial' && '3D Spatial Room Simulator'}
                {activeTab === 'karaoke-dj' && 'Karaoke & DJ Crossfade Studio'}
              </span>
              {activeTab === 'eq' && (
                <span
                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                    isBypassed
                      ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {isBypassed ? 'Bypassed' : 'Active'}
                </span>
              )}
              {activeTab === 'spatial' && spatialPreset !== 'off' && (
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                  Theatre Mode Active
                </span>
              )}
            </h3>
            <p className="text-xs text-neutral-400">
              {activeTab === 'eq' && '10-band parametric studio tone & acoustic curves'}
              {activeTab === 'spatial' && 'Procedural impulse-response reverb & binaural surround acoustics'}
              {activeTab === 'karaoke-dj' && 'Real-time vocal attenuation slider & seamless DJ gapless crossfading'}
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md overflow-x-auto no-scrollbar max-w-full shrink-0">
          <button
            onClick={() => setActiveTab('eq')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'eq'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders size={13} className="shrink-0" />
            <span>10-Band EQ</span>
          </button>

          <button
            onClick={() => setActiveTab('spatial')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'spatial'
                ? 'bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-md shadow-amber-600/30'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Film size={13} className="shrink-0" />
            <span>3D Spatial (Theatre)</span>
          </button>

          <button
            onClick={() => setActiveTab('karaoke-dj')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'karaoke-dj'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mic2 size={13} className="shrink-0" />
            <span>Karaoke & Crossfade</span>
          </button>

          <button
            onClick={() => setNowPlayingOpen(false)}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-colors cursor-pointer border border-white/5 ml-1 shrink-0"
            title="Close Panel"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ================= TAB 1: 10-BAND GRAPHIC EQUALIZER ================= */}
      {activeTab === 'eq' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Controls Bar: AI Auto-tune, Reset, Bypass */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                <Sparkles size={12} className="text-indigo-400" />
                <span>Acoustic Profiles</span>
              </span>
              {aiProfile ? (
                <span className="text-[11px] font-mono text-emerald-300 font-bold bg-emerald-500/15 px-2.5 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1.5 animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {aiProfile}
                </span>
              ) : preset === 'custom' ? (
                <span className="text-[11px] font-mono text-amber-400 font-medium">● Custom Tweaked</span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (currentSong) {
                    audioEffectsService.autoTuneForSong(currentSong.title, currentSong.artist);
                  }
                }}
                disabled={!currentSong}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
                title="Auto-tune 10 bands using AI acoustic analysis for current song"
              >
                <Sparkles size={13} className="text-amber-300" />
                <span>AI Auto-Tune</span>
              </button>

              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-medium transition-colors border border-white/5 cursor-pointer"
                title="Reset all bands to 0 dB"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>

              <button
                onClick={handleToggleBypass}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  !isBypassed
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                }`}
              >
                <Power size={13} />
                <span>{isBypassed ? 'Turn ON' : 'Bypass'}</span>
              </button>
            </div>
          </div>

          {/* Preset Selector Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {PRESET_OPTIONS.map((opt) => {
              const isSelected = preset === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handlePresetSelect(opt.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200 shadow-md'
                      : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* 10 Faders & Preamp Master Section */}
          <div className="grid grid-cols-11 gap-2 sm:gap-4 p-4 rounded-2xl bg-black/40 border border-white/5 items-end">
            {/* Preamp Column */}
            <div className="flex flex-col items-center gap-2.5 border-r border-white/10 pr-2">
              <span className="text-[10px] font-mono font-bold text-indigo-400">
                {preamp > 0 ? `+${preamp}` : preamp}dB
              </span>
              <div className="h-36 sm:h-44 flex items-center justify-center py-2">
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={preamp}
                  disabled={isBypassed}
                  onChange={(e) => handlePreampChange(parseFloat(e.target.value))}
                  className="accent-indigo-400 cursor-pointer h-28 sm:h-36 -rotate-90 origin-center"
                  style={{ width: '130px' }}
                />
              </div>
              <div className="text-center">
                <span className="text-[11px] font-bold text-white block">Preamp</span>
                <span className="text-[9px] text-neutral-500 font-mono">GAIN</span>
              </div>
            </div>

            {/* 10 Band Faders */}
            {bands.map((band, idx) => (
              <div key={band.label} className="flex flex-col items-center gap-2.5">
                <span
                  className={`text-[10px] font-mono font-semibold transition-colors ${
                    band.gain !== 0 ? 'text-indigo-300' : 'text-neutral-500'
                  }`}
                >
                  {band.gain > 0 ? `+${band.gain}` : band.gain}
                </span>

                <div className="h-36 sm:h-44 flex items-center justify-center py-2">
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={band.gain}
                    disabled={isBypassed}
                    onChange={(e) => handleGainChange(idx, parseFloat(e.target.value))}
                    className="accent-indigo-500 cursor-pointer h-28 sm:h-36 -rotate-90 origin-center"
                    style={{ width: '130px' }}
                  />
                </div>

                <div className="text-center">
                  <span className="text-[11px] font-semibold text-neutral-200 block truncate">
                    {band.label}
                  </span>
                  <span className="text-[9px] text-neutral-500 font-mono uppercase">
                    {band.type === 'lowshelf' ? 'LOW' : band.type === 'highshelf' ? 'HIGH' : 'MID'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 2: 3D SPATIAL ROOM SIMULATOR ================= */}
      {activeTab === 'spatial' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Preset Cards Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SPATIAL_ROOMS.map((room) => {
              const isSelected = spatialPreset === room.id;
              return (
                <button
                  key={room.id}
                  onClick={() => setSpatialPreset(room.id)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group ${
                    isSelected
                      ? 'bg-gradient-to-br border-amber-500/60 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/40 ' +
                        room.gradient
                      : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5 text-neutral-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/40'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        {room.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                          {room.title}
                        </h4>
                        <span className="text-[10px] font-mono text-neutral-400 block uppercase">
                          {room.badge}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-lg shadow-amber-400/80 animate-ping" />
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                    {room.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Spatial Room Mix & Theatre Stage Visualizer */}
          <div className="p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Acoustic Wet / Dry Mix
                </span>
                <span className="text-[11px] text-neutral-400">
                  Controls the depth of spatial reflections and theatre room dimension
                </span>
              </div>
              <span className="text-sm font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/30">
                {spatialPreset === 'off' ? 'Bypassed (0%)' : `${Math.round(spatialMix * 100)}% Wet Reverb`}
              </span>
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={spatialPreset === 'off' ? 0 : spatialMix}
                disabled={spatialPreset === 'off'}
                onChange={(e) => setSpatialMix(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-30"
              />
              <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                <span>0% (Direct Studio)</span>
                <span>35% (Theatre Standard)</span>
                <span>70% (Deep Hall)</span>
                <span>100% (Full Immersion)</span>
              </div>
            </div>

            {/* Quick Mix Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/5 flex-wrap">
              <span className="text-[11px] text-neutral-400 font-medium mr-1">Quick Mix:</span>
              {[
                { label: 'Subtle (20%)', val: 0.2 },
                { label: 'Theatre (35%)', val: 0.35 },
                { label: 'Concert Hall (55%)', val: 0.55 },
                { label: 'Cinematic Dream (80%)', val: 0.8 }
              ].map((qm) => (
                <button
                  key={qm.label}
                  disabled={spatialPreset === 'off'}
                  onClick={() => setSpatialMix(qm.val)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-[11px] font-mono text-neutral-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
                >
                  {qm.label}
                </button>
              ))}
            </div>

            {/* Live Theatre Acoustic Stage Visual */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-b from-neutral-900/60 to-black/80 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400/80 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Binaural Soundstage & Spatial Acoustic Waves</span>
              </div>

              <div className="flex items-center justify-center gap-12 sm:gap-20 py-4 relative w-full">
                {/* Virtual Left Speaker */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                      spatialPreset !== 'off'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-lg shadow-amber-500/20 scale-105'
                        : 'bg-white/5 border-white/10 text-neutral-500'
                    }`}
                  >
                    <Volume2 size={18} />
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">Speaker L</span>
                </div>

                {/* Center Listener (Headphones) */}
                <div className="flex flex-col items-center gap-1 relative z-10">
                  <div className="relative">
                    {spatialPreset !== 'off' && (
                      <div className="absolute -inset-3 rounded-full bg-amber-500/20 animate-ping" />
                    )}
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/30 relative z-10">
                      <Film size={22} />
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-white mt-1">Theatre Center</span>
                  <span className="text-[9px] font-mono text-neutral-400">Sweet Spot</span>
                </div>

                {/* Virtual Right Speaker */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                      spatialPreset !== 'off'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-lg shadow-amber-500/20 scale-105'
                        : 'bg-white/5 border-white/10 text-neutral-500'
                    }`}
                  >
                    <Volume2 size={18} className="scale-x-[-1]" />
                  </div>
                  <span className="text-[10px] font-mono text-neutral-400">Speaker R</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: KARAOKE & DJ CROSSFADE ================= */}
      {activeTab === 'karaoke-dj' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Feature 1: Advanced Karaoke Vocal Cut Slider */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-black/60 border border-emerald-500/20 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Mic2 size={20} className={isKaraoke ? 'animate-pulse' : ''} />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>Advanced Karaoke Vocal Attenuation</span>
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                        isKaraoke
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      }`}
                    >
                      {isKaraoke ? 'Active' : 'Disabled'}
                    </span>
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Fine-tune vocal suppression depth from subtle sing-along backings to complete vocal elimination
                  </p>
                </div>
              </div>

              <button
                onClick={toggleKaraoke}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isKaraoke
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-white/5 border-white/10 text-neutral-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {isKaraoke ? 'Turn OFF' : 'Enable Karaoke'}
              </button>
            </div>

            {/* Vocal Depth Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">Vocal Suppression Depth:</span>
                <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                  {Math.round(karaokeDepth * 100)}% Depth
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={karaokeDepth}
                onChange={(e) => setKaraokeDepth(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                <span>0% (Original)</span>
                <span>50% (Duet / Backings)</span>
                <span>80% (Sing-Along)</span>
                <span>100% (Full Vocal Cut)</span>
              </div>
            </div>

            {/* Quick Presets & Bass Keeper Badge */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-neutral-400 mr-1">Presets:</span>
                {[
                  { label: '0% Dry', val: 0 },
                  { label: '50% Duet', val: 0.5 },
                  { label: '80% Sing-Along', val: 0.8 },
                  { label: '100% Full Cut', val: 1.0 }
                ].map((kp) => (
                  <button
                    key={kp.label}
                    onClick={() => setKaraokeDepth(kp.val)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono text-neutral-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
                  >
                    {kp.label}
                  </button>
                ))}
              </div>

              {/* Bass Retention Protection Feature Pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-mono">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Bass Guard Active (&lt;180Hz Protected)</span>
              </div>
            </div>
          </div>

          {/* Feature 2: Smart DJ Crossfade & Gapless Engine */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-black/60 border border-indigo-500/20 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>Smart Crossfade & DJ Gapless Engine</span>
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                        crossfadeSeconds > 0
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      }`}
                    >
                      {crossfadeSeconds > 0 ? `${crossfadeSeconds}s Transition` : 'Instant Cut'}
                    </span>
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Seamlessly blends song endings into the next track for non-stop club & theatre playback
                  </p>
                </div>
              </div>
            </div>

            {/* Crossfade Duration Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300">Crossfade Duration:</span>
                <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20">
                  {crossfadeSeconds === 0 ? '0s (Disabled)' : `${crossfadeSeconds} Seconds Blend`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={crossfadeSeconds}
                onChange={(e) => setCrossfadeSeconds(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                <span>0s (Cut)</span>
                <span>3s (Standard DJ)</span>
                <span>6s (Radio Mix)</span>
                <span>12s (Ambient Club)</span>
              </div>
            </div>

            {/* Quick Duration Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/5 flex-wrap">
              <span className="text-[11px] text-neutral-400 font-medium mr-1">Quick Blend:</span>
              {[
                { label: 'Off (0s)', val: 0 },
                { label: '2s Quick', val: 2 },
                { label: '3s Studio', val: 3 },
                { label: '5s Club DJ', val: 5 },
                { label: '8s Extended', val: 8 },
                { label: '12s Cinematic', val: 12 }
              ].map((cd) => (
                <button
                  key={cd.label}
                  onClick={() => setCrossfadeSeconds(cd.val)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors border cursor-pointer ${
                    crossfadeSeconds === cd.val
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border-white/5'
                  }`}
                >
                  {cd.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
