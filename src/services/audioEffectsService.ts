import { EqualizerBand, EqualizerPreset, SpatialPreset } from '../types/music';

export type BassExciterLevel = 'off' | 'light' | 'medium' | 'strong';

export const EQ_FREQUENCIES: { freq: number; label: string; type: BiquadFilterType }[] = [
  { freq: 32, label: '32Hz', type: 'lowshelf' },
  { freq: 64, label: '64Hz', type: 'peaking' },
  { freq: 125, label: '125Hz', type: 'peaking' },
  { freq: 250, label: '250Hz', type: 'peaking' },
  { freq: 500, label: '500Hz', type: 'peaking' },
  { freq: 1000, label: '1kHz', type: 'peaking' },
  { freq: 2000, label: '2kHz', type: 'peaking' },
  { freq: 4000, label: '4kHz', type: 'peaking' },
  { freq: 8000, label: '8kHz', type: 'peaking' },
  { freq: 16000, label: '16kHz', type: 'highshelf' }
];

export const EQ_PRESETS: Record<EqualizerPreset, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [7, 6, 4, 2, 0, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, 1, 2, 4, 6, 7],
  vocal: [-2, -1, 1, 3, 5, 4, 3, 1, 0, -1],
  pop: [1, 2, 4, 4, 2, 0, 1, 3, 3, 2],
  rock: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5],
  electronic: [6, 5, 2, 0, -2, 2, 1, 3, 5, 6],
  classical: [4, 3, 2, 2, -1, -1, 0, 2, 3, 4],
  custom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};

const STORAGE_KEY = 'aura_equalizer_state_v2';

interface SavedState {
  preset: EqualizerPreset;
  gains: number[];
  preamp: number;
  isBypassed: boolean;
  isKaraoke?: boolean;
  karaokeDepth?: number;
  spatialPreset?: SpatialPreset;
  spatialMix?: number;
  isLimiterActive?: boolean;
  isSubsonicActive?: boolean;
  bassExciterLevel?: BassExciterLevel;
}

class AudioEffectsService {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private preampGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isInitialized = false;

  // Subsonic Filter (18Hz High-Pass)
  private subsonicFilter: BiquadFilterNode | null = null;
  private isSubsonicActive: boolean = true;

  // Psychoacoustic Bass Exciter Nodes
  private exciterLowpass: BiquadFilterNode | null = null;
  private exciterWaveShaper: WaveShaperNode | null = null;
  private exciterHighpass: BiquadFilterNode | null = null;
  private exciterGain: GainNode | null = null;
  private bassExciterLevel: BassExciterLevel = 'off';

  // Karaoke DSP Nodes
  private dryGain: GainNode | null = null;
  private karaokeGain: GainNode | null = null;
  private isKaraoke: boolean = false;
  private karaokeDepth: number = 1.0; // 0.0 to 1.0

  // 3D Spatial Simulator & Reverb Nodes
  private spatialInputGain: GainNode | null = null;
  private spatialDryGain: GainNode | null = null;
  private spatialWetGain: GainNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private spatialPreset: SpatialPreset = 'off';
  private spatialMix: number = 0.35; // 0.0 to 1.0
  private impulseCache: Map<SpatialPreset, AudioBuffer> = new Map();

  // Smart Crossfade Gain Node
  private crossfadeGain: GainNode | null = null;

  // Final Peak Protection / Anti-Clipping Limiter Node
  private limiterNode: DynamicsCompressorNode | null = null;
  private isLimiterActive: boolean = true; // Default ON for speaker/headphone protection

  private currentPreset: EqualizerPreset = 'flat';
  private currentGains: number[] = [...EQ_PRESETS.flat];
  private preampDb: number = 0;
  private isBypassed: boolean = false;
  private currentAiProfile: string | null = null;

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadPersistedState();
  }

  private loadPersistedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('aura_equalizer_state_v1');
      if (raw) {
        const parsed: SavedState = JSON.parse(raw);
        if (parsed.gains && parsed.gains.length === EQ_FREQUENCIES.length) {
          this.currentGains = parsed.gains;
          this.currentPreset = parsed.preset || 'custom';
          this.preampDb = typeof parsed.preamp === 'number' ? parsed.preamp : 0;
          this.isBypassed = !!parsed.isBypassed;
          this.isKaraoke = !!parsed.isKaraoke;
          this.karaokeDepth = typeof parsed.karaokeDepth === 'number' ? parsed.karaokeDepth : 1.0;
          this.spatialPreset = parsed.spatialPreset || 'off';
          this.spatialMix = typeof parsed.spatialMix === 'number' ? parsed.spatialMix : 0.35;
          this.isLimiterActive = parsed.isLimiterActive !== undefined ? parsed.isLimiterActive : true;
          this.isSubsonicActive = parsed.isSubsonicActive !== undefined ? parsed.isSubsonicActive : true;
          this.bassExciterLevel = parsed.bassExciterLevel || 'off';
        }
      }
    } catch {
      // Ignore localStorage error
    }
  }

  private saveState() {
    try {
      const state: SavedState = {
        preset: this.currentPreset,
        gains: this.currentGains,
        preamp: this.preampDb,
        isBypassed: this.isBypassed,
        isKaraoke: this.isKaraoke,
        karaokeDepth: this.karaokeDepth,
        spatialPreset: this.spatialPreset,
        spatialMix: this.spatialMix,
        isLimiterActive: this.isLimiterActive,
        isSubsonicActive: this.isSubsonicActive,
        bassExciterLevel: this.bassExciterLevel
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore
    }
  }

  public init(audioElement: HTMLAudioElement) {
    if (this.isInitialized) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('Web Audio API is not supported in this browser.');
        return;
      }

      // Initialize with playback latency hint for stable glitch-free audio buffering
      try {
        this.audioCtx = new AudioCtxClass({ latencyHint: 'playback' });
      } catch {
        this.audioCtx = new AudioCtxClass();
      }

      this.sourceNode = this.audioCtx.createMediaElementSource(audioElement);

      // 0. Subsonic High-Pass Filter (18Hz DC rumble roll-off)
      this.subsonicFilter = this.audioCtx.createBiquadFilter();
      this.subsonicFilter.type = 'highpass';
      this.subsonicFilter.frequency.value = this.isSubsonicActive ? 18 : 0;
      this.subsonicFilter.Q.value = 0.707;
      this.sourceNode.connect(this.subsonicFilter);

      // 1. 10-Band Biquad Filters
      this.filters = EQ_FREQUENCIES.map((band, idx) => {
        const filter = this.audioCtx!.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.freq;
        filter.gain.value = this.isBypassed ? 0 : this.currentGains[idx];
        filter.Q.value = 1.4;
        return filter;
      });

      // Chain: Subsonic -> Filter 0 -> Filter 1 -> ... -> Filter 9 -> Preamp
      let previousNode: AudioNode = this.subsonicFilter;
      for (const filter of this.filters) {
        previousNode.connect(filter);
        previousNode = filter;
      }

      // 2. Preamp Gain Node (with automatic sensible headroom management)
      this.preampGain = this.audioCtx.createGain();
      previousNode.connect(this.preampGain);
      this.updatePreampGainNode();

      // 3. Psychoacoustic Bass Exciter Branch
      // Low-pass extraction (< 110Hz) -> Non-linear harmonic generation -> High-pass harmonics (110Hz) -> Exciter gain
      this.exciterLowpass = this.audioCtx.createBiquadFilter();
      this.exciterLowpass.type = 'lowpass';
      this.exciterLowpass.frequency.value = 110;
      this.exciterLowpass.Q.value = 0.707;
      this.preampGain.connect(this.exciterLowpass);

      this.exciterWaveShaper = this.audioCtx.createWaveShaper();
      this.exciterWaveShaper.curve = this.generateHarmonicsCurve(1024) as any;
      this.exciterWaveShaper.oversample = '2x';
      this.exciterLowpass.connect(this.exciterWaveShaper);

      this.exciterHighpass = this.audioCtx.createBiquadFilter();
      this.exciterHighpass.type = 'highpass';
      this.exciterHighpass.frequency.value = 110;
      this.exciterHighpass.Q.value = 0.707;
      this.exciterWaveShaper.connect(this.exciterHighpass);

      this.exciterGain = this.audioCtx.createGain();
      this.exciterGain.gain.value = this.getExciterGainValue(this.bassExciterLevel);
      this.exciterHighpass.connect(this.exciterGain);

      // 4. Karaoke Matrix Setup
      // Path A: Dry normal stereo path
      this.dryGain = this.audioCtx.createGain();
      this.preampGain.connect(this.dryGain);

      // Path B: Karaoke Mid-Side Vocal Cancellation
      const splitter = this.audioCtx.createChannelSplitter(2);
      const merger = this.audioCtx.createChannelMerger(2);
      this.preampGain.connect(splitter);

      // Invert right channel for L - R cancellation of center vocals
      const invRightGain = this.audioCtx.createGain();
      invRightGain.gain.value = -1;
      splitter.connect(invRightGain, 1);

      // Low-pass bass preservation filter so kick drums remain punchy & intact
      const bassKeeper = this.audioCtx.createBiquadFilter();
      bassKeeper.type = 'lowpass';
      bassKeeper.frequency.value = 180;
      this.preampGain.connect(bassKeeper);

      // Difference signal
      const diffGain = this.audioCtx.createGain();
      diffGain.gain.value = 0.7;
      splitter.connect(diffGain, 0); // L
      invRightGain.connect(diffGain); // -R => (L - R)

      // Feed difference and bass to merger
      diffGain.connect(merger, 0, 0);
      diffGain.connect(merger, 0, 1);
      bassKeeper.connect(merger, 0, 0);
      bassKeeper.connect(merger, 0, 1);

      this.karaokeGain = this.audioCtx.createGain();
      merger.connect(this.karaokeGain);

      // 5. 3D Spatial Room Simulator Subsystem
      this.spatialInputGain = this.audioCtx.createGain();
      this.dryGain.connect(this.spatialInputGain);
      this.karaokeGain.connect(this.spatialInputGain);
      this.exciterGain.connect(this.spatialInputGain); // Injected exciter harmonics

      this.spatialDryGain = this.audioCtx.createGain();
      this.spatialWetGain = this.audioCtx.createGain();
      this.convolverNode = this.audioCtx.createConvolver();

      this.spatialInputGain.connect(this.spatialDryGain);
      this.spatialInputGain.connect(this.convolverNode);
      this.convolverNode.connect(this.spatialWetGain);

      // 6. Analyser Node for Visualizer
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;

      this.spatialDryGain.connect(this.analyser);
      this.spatialWetGain.connect(this.analyser);

      // 7. Smart Crossfade Engine Gain Node
      this.crossfadeGain = this.audioCtx.createGain();
      this.crossfadeGain.gain.value = 1.0;
      this.analyser.connect(this.crossfadeGain);

      // 8. Peak Protection / Anti-Clipping Safety Stage
      this.limiterNode = this.audioCtx.createDynamicsCompressor();
      this.updateLimiterNode();
      this.crossfadeGain.connect(this.limiterNode);
      this.limiterNode.connect(this.audioCtx.destination);

      // Synchronize initial DSP states
      this.updateKaraokeGainNodes();
      this.updateSpatialAcoustics();

      this.isInitialized = true;
    } catch (err) {
      console.warn('AudioEffectsService initialization error:', err);
    }
  }

  public async resumeContext(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.warn('Could not resume audio context:', err);
      }
    }
  }

  /**
   * Generates a smooth, soft non-linear transfer curve for generating second and third harmonics.
   */
  private generateHarmonicsCurve(samples: number): Float32Array {
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft symmetrical hyperbolic tangent-style saturation
      curve[i] = (1.5 * x) / (1 + Math.abs(x) * 0.8);
    }
    return curve;
  }

  private getExciterGainValue(level: BassExciterLevel): number {
    switch (level) {
      case 'light':
        return 0.15;
      case 'medium':
        return 0.35;
      case 'strong':
        return 0.55;
      case 'off':
      default:
        return 0.0;
    }
  }

  private updateBassExciterGainNode() {
    if (!this.exciterGain || !this.audioCtx) return;
    const targetGain = this.getExciterGainValue(this.bassExciterLevel);
    this.exciterGain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.05);
  }

  private updateSubsonicFilterNode() {
    if (!this.subsonicFilter || !this.audioCtx) return;
    const targetFreq = this.isSubsonicActive ? 18 : 0;
    this.subsonicFilter.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.05);
  }

  private updateLimiterNode() {
    if (!this.limiterNode || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;

    if (this.isLimiterActive) {
      // Conservative peak-protection configuration:
      // Transparent during normal levels, acts quickly on dangerous digital spikes.
      this.limiterNode.threshold.setTargetAtTime(-0.5, now, 0.04);
      this.limiterNode.knee.setTargetAtTime(0, now, 0.04);
      this.limiterNode.ratio.setTargetAtTime(20.0, now, 0.04);
      this.limiterNode.attack.setTargetAtTime(0.001, now, 0.04);
      this.limiterNode.release.setTargetAtTime(0.05, now, 0.04);
    } else {
      // 1:1 completely linear pass-through when disabled
      this.limiterNode.threshold.setTargetAtTime(0, now, 0.04);
      this.limiterNode.ratio.setTargetAtTime(1.0, now, 0.04);
    }
  }

  private updatePreampGainNode() {
    if (!this.preampGain || !this.audioCtx) return;
    if (this.isBypassed) {
      this.preampGain.gain.setTargetAtTime(1, this.audioCtx.currentTime, 0.05);
    } else {
      // Sensible automatic headroom management:
      // When EQ bands are boosted, maintain headroom before the peak protection stage
      // so the signal is not heavily crushed.
      const maxBoostDb = Math.max(0, ...this.currentGains);
      const headroomAttenuateDb = maxBoostDb > 2 ? -((maxBoostDb - 2) * 0.35) : 0;
      const effectiveDb = this.preampDb + headroomAttenuateDb;
      const linear = Math.pow(10, effectiveDb / 20);
      this.preampGain.gain.setTargetAtTime(linear, this.audioCtx.currentTime, 0.05);
    }
  }

  private updateFilters() {
    if (!this.audioCtx || this.filters.length === 0) return;
    this.filters.forEach((filter, idx) => {
      const targetGain = this.isBypassed ? 0 : this.currentGains[idx];
      filter.gain.setTargetAtTime(targetGain, this.audioCtx!.currentTime, 0.08);
    });
    this.updatePreampGainNode();
  }

  public setBandGain(index: number, gainDb: number) {
    if (index < 0 || index >= this.currentGains.length) return;
    const clamped = Math.max(-12, Math.min(12, Math.round(gainDb * 10) / 10));
    this.currentGains[index] = clamped;
    this.currentPreset = 'custom';
    this.currentAiProfile = null;
    this.updateFilters();
    this.saveState();
    this.notifyListeners();
  }

  public setPreampGain(gainDb: number) {
    this.preampDb = Math.max(-12, Math.min(12, Math.round(gainDb * 10) / 10));
    this.updatePreampGainNode();
    this.saveState();
    this.notifyListeners();
  }

  public applyPreset(preset: EqualizerPreset) {
    if (preset === 'custom') return;
    const gains = EQ_PRESETS[preset];
    if (gains) {
      this.currentPreset = preset;
      this.currentAiProfile = null;
      this.currentGains = [...gains];
      this.updateFilters();
      this.saveState();
      this.notifyListeners();
    }
  }

  // --- Audiophile Pro Controls ---
  public setLimiter(enabled: boolean): void {
    this.isLimiterActive = enabled;
    this.updateLimiterNode();
    this.saveState();
    this.notifyListeners();
  }

  public toggleLimiter(): boolean {
    const next = !this.isLimiterActive;
    this.setLimiter(next);
    return next;
  }

  public isLimiterEnabled(): boolean {
    return this.isLimiterActive;
  }

  public setBassExciterLevel(level: BassExciterLevel): void {
    this.bassExciterLevel = level;
    this.updateBassExciterGainNode();
    this.saveState();
    this.notifyListeners();
  }

  public getBassExciterLevel(): BassExciterLevel {
    return this.bassExciterLevel;
  }

  public setSubsonicFilter(enabled: boolean): void {
    this.isSubsonicActive = enabled;
    this.updateSubsonicFilterNode();
    this.saveState();
    this.notifyListeners();
  }

  public toggleSubsonicFilter(): boolean {
    const next = !this.isSubsonicActive;
    this.setSubsonicFilter(next);
    return next;
  }

  public isSubsonicFilterActive(): boolean {
    return this.isSubsonicActive;
  }

  // AI Smart Equalizer Auto-Tune
  public autoTuneForSong(title: string, artist: string = ''): { profileName: string; description: string; gains: number[] } {
    const text = `${title} ${artist}`.toLowerCase();
    let profileName = 'AI Balanced Studio';
    let description = 'Clean balanced studio acoustic profile with natural dynamics';
    let gains = [3, 2, 1, 0, 0, 1, 2, 3, 3, 2];

    if (text.match(/kuthu|beast|badass|hukum|party|blast|dance|energy|gym|workout|thalapathy/)) {
      profileName = 'AI Heavy Bass Punch 💥';
      description = 'Supercharged 64Hz sub-bass thump for maximum dance and workout energy';
      gains = [7, 6, 4, 2, 0, 0, 1, 3, 4, 5];
    } else if (text.match(/vaseegara|melody|mazhai|love|acoustic|soft|chill|night|romance|minnale/)) {
      profileName = 'AI Crystal Melodic Vocal 🎙️';
      description = 'Warm intimate midrange and sparkling vocal breath clarity';
      gains = [2, 3, 2, 1, 3, 4, 4, 3, 2, 1];
    } else if (text.match(/ilaiyaraaja|spb|90s|vintage|classic|retro|maestro/)) {
      profileName = 'AI Maestro Vintage Vinyl 📻';
      description = 'Rich live analog instruments and golden 90s stereo warmth';
      gains = [4, 3, 2, 1, 0, 1, 2, 3, 4, 4];
    } else if (text.match(/rock|metal|guitar|anirudh|vikram/)) {
      profileName = 'AI Rock & Mass Edge 🎸';
      description = 'Distorted guitar presence and driving punchy rhythm section';
      gains = [5, 4, 3, 1, -1, 0, 2, 4, 5, 5];
    } else if (text.match(/edm|club|synth|illuminati|starboy|the weeknd/)) {
      profileName = 'AI Club Synthwave ⚡';
      description = 'Deep sub-bass rumble and ultra-crisp airy highs';
      gains = [6, 5, 2, 0, -1, 2, 2, 4, 5, 6];
    }

    this.currentGains = [...gains];
    this.currentPreset = 'custom';
    this.currentAiProfile = profileName;
    this.updateFilters();
    this.saveState();
    this.notifyListeners();

    return { profileName, description, gains };
  }

  // --- Karaoke Mode & Depth Engine ---
  private updateKaraokeGainNodes() {
    if (!this.audioCtx || !this.dryGain || !this.karaokeGain) return;
    const now = this.audioCtx.currentTime;

    if (!this.isKaraoke) {
      this.dryGain.gain.setTargetAtTime(1, now, 0.08);
      this.karaokeGain.gain.setTargetAtTime(0, now, 0.08);
    } else {
      const depth = Math.max(0, Math.min(1, this.karaokeDepth));
      this.dryGain.gain.setTargetAtTime(1 - depth, now, 0.08);
      this.karaokeGain.gain.setTargetAtTime(depth, now, 0.08);
    }
  }

  public setKaraoke(enabled: boolean): void {
    this.isKaraoke = enabled;
    if (enabled && this.karaokeDepth === 0) {
      this.karaokeDepth = 1.0;
    }
    this.updateKaraokeGainNodes();
    this.saveState();
    this.notifyListeners();
  }

  public setKaraokeDepth(depth: number): void {
    const clamped = Math.max(0, Math.min(1, Math.round(depth * 100) / 100));
    this.karaokeDepth = clamped;
    if (clamped > 0 && !this.isKaraoke) {
      this.isKaraoke = true;
    } else if (clamped === 0 && this.isKaraoke) {
      this.isKaraoke = false;
    }
    this.updateKaraokeGainNodes();
    this.saveState();
    this.notifyListeners();
  }

  public getKaraokeDepth(): number {
    return this.karaokeDepth;
  }

  public toggleKaraoke(): boolean {
    const next = !this.isKaraoke;
    this.setKaraoke(next);
    return next;
  }

  public isKaraokeEnabled(): boolean {
    return this.isKaraoke;
  }

  // --- 3D Spatial Audio & Room Acoustics Simulator ---
  private getSpatialImpulseBuffer(preset: SpatialPreset): AudioBuffer | null {
    if (preset === 'off' || !this.audioCtx) return null;
    if (this.impulseCache.has(preset)) {
      return this.impulseCache.get(preset)!;
    }

    let duration = 2.4;
    let decay = 2.0;

    switch (preset) {
      case 'theatre':
        duration = 2.5;
        decay = 2.2;
        break;
      case 'concert':
        duration = 3.6;
        decay = 1.8;
        break;
      case 'cathedral':
        duration = 4.8;
        decay = 1.35;
        break;
      case 'club':
        duration = 1.2;
        decay = 3.2;
        break;
    }

    const sampleRate = this.audioCtx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = this.audioCtx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      const envelope = Math.pow(n / length, decay);
      left[i] = (Math.random() * 2 - 1) * envelope;
      right[i] = (Math.random() * 2 - 1) * envelope;
    }

    this.impulseCache.set(preset, impulse);
    return impulse;
  }

  private updateSpatialAcoustics() {
    if (!this.audioCtx || !this.convolverNode || !this.spatialDryGain || !this.spatialWetGain) return;
    const now = this.audioCtx.currentTime;

    if (this.spatialPreset === 'off') {
      this.spatialDryGain.gain.setTargetAtTime(1, now, 0.06);
      this.spatialWetGain.gain.setTargetAtTime(0, now, 0.06);
    } else {
      const buffer = this.getSpatialImpulseBuffer(this.spatialPreset);
      if (buffer) {
        this.convolverNode.buffer = buffer;
      }
      this.spatialDryGain.gain.setTargetAtTime(1, now, 0.06);
      this.spatialWetGain.gain.setTargetAtTime(this.spatialMix, now, 0.06);
    }
  }

  public setSpatialPreset(preset: SpatialPreset) {
    this.spatialPreset = preset;
    this.updateSpatialAcoustics();
    this.saveState();
    this.notifyListeners();
  }

  public getSpatialPreset(): SpatialPreset {
    return this.spatialPreset;
  }

  public setSpatialMix(mix: number) {
    this.spatialMix = Math.max(0, Math.min(1, Math.round(mix * 100) / 100));
    if (this.spatialPreset !== 'off' && this.audioCtx && this.spatialWetGain) {
      this.spatialWetGain.gain.setTargetAtTime(this.spatialMix, this.audioCtx.currentTime, 0.06);
    }
    this.saveState();
    this.notifyListeners();
  }

  public getSpatialMix(): number {
    return this.spatialMix;
  }

  // --- Smart Crossfade DSP Volume Engine ---
  public fadeCross(targetGain: number, durationSeconds: number) {
    if (!this.audioCtx || !this.crossfadeGain) return;
    const clampedGain = Math.max(0, Math.min(1, targetGain));
    const now = this.audioCtx.currentTime;
    const timeConstant = Math.max(0.04, durationSeconds / 2.8);
    this.crossfadeGain.gain.setTargetAtTime(clampedGain, now, timeConstant);
  }

  public getAiProfileName(): string | null {
    return this.currentAiProfile;
  }

  public toggleBypass() {
    this.isBypassed = !this.isBypassed;
    this.updateFilters();
    this.updatePreampGainNode();
    this.saveState();
    this.notifyListeners();
  }

  public resetToFlat() {
    this.currentPreset = 'flat';
    this.currentAiProfile = null;
    this.currentGains = [...EQ_PRESETS.flat];
    this.preampDb = 0;
    this.updateFilters();
    this.updatePreampGainNode();
    this.saveState();
    this.notifyListeners();
  }

  // Getters
  public getBands(): EqualizerBand[] {
    return EQ_FREQUENCIES.map((band, idx) => ({
      frequency: band.freq,
      label: band.label,
      gain: this.currentGains[idx],
      type: band.type
    }));
  }

  public getPreset(): EqualizerPreset {
    return this.currentPreset;
  }

  public getPreamp(): number {
    return this.preampDb;
  }

  public isEqBypassed(): boolean {
    return this.isBypassed;
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  public getFrequencyData(array: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(array as any);
    }
  }

  public getTimeDomainData(array: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(array as any);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l());
  }
}

export const audioEffectsService = new AudioEffectsService();
