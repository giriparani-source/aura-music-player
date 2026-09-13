import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sleepTimerService } from '../sleepTimerService';
import { audioService } from '../audioService';

describe('sleepTimerService', () => {
  let volumeSpy: any;
  let getVolumeSpy: any;
  let pauseSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    sleepTimerService.cancelSleepTimer(false);

    getVolumeSpy = vi.spyOn(audioService, 'getVolume').mockReturnValue(0.75);
    volumeSpy = vi.spyOn(audioService, 'setVolume').mockImplementation(() => {});
    pauseSpy = vi.spyOn(audioService, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    sleepTimerService.cancelSleepTimer(false);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts inactive with mode off', () => {
    expect(sleepTimerService.getMode()).toBe('off');
    expect(sleepTimerService.getRemainingSeconds()).toBeNull();
  });

  it('sets 15-minute sleep timer correctly', () => {
    sleepTimerService.setSleepTimer('15');
    expect(sleepTimerService.getMode()).toBe('15');
    const remaining = sleepTimerService.getRemainingSeconds();
    expect(remaining).toBeGreaterThanOrEqual(14 * 60 + 58);
    expect(remaining).toBeLessThanOrEqual(15 * 60);
  });

  it('sets 30, 45, 60 minute and custom presets', () => {
    sleepTimerService.setSleepTimer('30');
    expect(sleepTimerService.getMode()).toBe('30');

    sleepTimerService.setSleepTimer('45');
    expect(sleepTimerService.getMode()).toBe('45');

    sleepTimerService.setSleepTimer('60');
    expect(sleepTimerService.getMode()).toBe('60');

    sleepTimerService.setSleepTimer('custom', 5);
    expect(sleepTimerService.getMode()).toBe('custom');
    expect(sleepTimerService.getRemainingSeconds()).toBeLessThanOrEqual(300);
  });

  it('sets end_of_song mode without setting fixed target timestamp', () => {
    sleepTimerService.setSleepTimer('end_of_song');
    expect(sleepTimerService.getMode()).toBe('end_of_song');
    expect(sleepTimerService.getRemainingSeconds()).toBeNull();
  });

  it('cancels timer and resets mode to off', () => {
    sleepTimerService.setSleepTimer('15');
    expect(sleepTimerService.getMode()).toBe('15');

    sleepTimerService.cancelSleepTimer();
    expect(sleepTimerService.getMode()).toBe('off');
    expect(sleepTimerService.getRemainingSeconds()).toBeNull();
  });

  it('restores baseline volume if cancelled during fade', () => {
    // Start with custom 1-minute timer (60 seconds) so it enters fade immediately on tick
    sleepTimerService.setSleepTimer('custom', 1);

    // Advance 10 seconds to enter fade window
    vi.advanceTimersByTime(10000);

    // Cancel timer
    sleepTimerService.cancelSleepTimer(true);

    // Verify baseline volume (0.75) was restored
    expect(volumeSpy).toHaveBeenCalledWith(0.75);
    expect(sleepTimerService.getMode()).toBe('off');
  });

  it('pauses playback and restores baseline volume when timer expires', () => {
    // Set 1-minute timer
    sleepTimerService.setSleepTimer('custom', 1);

    // Advance past 61 seconds
    vi.advanceTimersByTime(62000);

    // Audio should be paused
    expect(pauseSpy).toHaveBeenCalled();

    // Baseline volume (0.75) should be restored
    expect(volumeSpy).toHaveBeenCalledWith(0.75);

    // Mode should reset to off
    expect(sleepTimerService.getMode()).toBe('off');
    expect(sleepTimerService.getRemainingSeconds()).toBeNull();
  });
});
