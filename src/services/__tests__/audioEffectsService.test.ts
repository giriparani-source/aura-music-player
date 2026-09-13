import { describe, it, expect, beforeEach } from 'vitest';
import { audioEffectsService } from '../audioEffectsService';

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = storageMock;
}

describe('audioEffectsService - Audiophile Pro DSP', () => {
  beforeEach(() => {
    localStorage.clear();
    audioEffectsService.resetToFlat();
  });

  describe('Peak Protection / Anti-Clipping Limiter', () => {
    it('is enabled by default for protection', () => {
      expect(audioEffectsService.isLimiterEnabled()).toBe(true);
    });

    it('toggles limiter state on demand', () => {
      const toggledOff = audioEffectsService.toggleLimiter();
      expect(toggledOff).toBe(false);
      expect(audioEffectsService.isLimiterEnabled()).toBe(false);

      const toggledOn = audioEffectsService.toggleLimiter();
      expect(toggledOn).toBe(true);
      expect(audioEffectsService.isLimiterEnabled()).toBe(true);
    });

    it('explicitly sets limiter active/inactive', () => {
      audioEffectsService.setLimiter(false);
      expect(audioEffectsService.isLimiterEnabled()).toBe(false);

      audioEffectsService.setLimiter(true);
      expect(audioEffectsService.isLimiterEnabled()).toBe(true);
    });
  });

  describe('Psychoacoustic Bass Exciter', () => {
    it('initializes with level off or persisted default', () => {
      audioEffectsService.setBassExciterLevel('off');
      expect(audioEffectsService.getBassExciterLevel()).toBe('off');
    });

    it('updates harmonic exciter levels across all presets', () => {
      audioEffectsService.setBassExciterLevel('light');
      expect(audioEffectsService.getBassExciterLevel()).toBe('light');

      audioEffectsService.setBassExciterLevel('medium');
      expect(audioEffectsService.getBassExciterLevel()).toBe('medium');

      audioEffectsService.setBassExciterLevel('strong');
      expect(audioEffectsService.getBassExciterLevel()).toBe('strong');

      audioEffectsService.setBassExciterLevel('off');
      expect(audioEffectsService.getBassExciterLevel()).toBe('off');
    });
  });

  describe('Subsonic Filter (18Hz High-Pass)', () => {
    it('allows toggling subsonic filter state', () => {
      audioEffectsService.setSubsonicFilter(true);
      expect(audioEffectsService.isSubsonicFilterActive()).toBe(true);

      const toggledOff = audioEffectsService.toggleSubsonicFilter();
      expect(toggledOff).toBe(false);
      expect(audioEffectsService.isSubsonicFilterActive()).toBe(false);

      const toggledOn = audioEffectsService.toggleSubsonicFilter();
      expect(toggledOn).toBe(true);
      expect(audioEffectsService.isSubsonicFilterActive()).toBe(true);
    });
  });

  describe('Equalizer Headroom & Gain Management', () => {
    it('sets band gains within -12dB to +12dB safety range', () => {
      audioEffectsService.setBandGain(0, 6.0);
      const bands = audioEffectsService.getBands();
      expect(bands[0].gain).toBe(6.0);
      expect(audioEffectsService.getPreset()).toBe('custom');
    });

    it('clamps excessive boost values to +12dB maximum', () => {
      audioEffectsService.setBandGain(0, 20.0);
      const bands = audioEffectsService.getBands();
      expect(bands[0].gain).toBe(12.0);
    });

    it('clamps excessive cut values to -12dB minimum', () => {
      audioEffectsService.setBandGain(1, -25.0);
      const bands = audioEffectsService.getBands();
      expect(bands[1].gain).toBe(-12.0);
    });

    it('resets all bands to flat 0dB', () => {
      audioEffectsService.setBandGain(0, 8.0);
      audioEffectsService.setBandGain(1, -4.0);
      audioEffectsService.resetToFlat();

      const bands = audioEffectsService.getBands();
      bands.forEach((b) => {
        expect(b.gain).toBe(0);
      });
      expect(audioEffectsService.getPreset()).toBe('flat');
    });
  });
});
