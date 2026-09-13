/**
 * src/services/sleepTimerService.ts
 * Smart Sleep Timer with gentle 60-second exponential volume fade-out.
 *
 * Supports presets: 15m, 30m, 45m, 60m, and "End of this track".
 * Preserves the user's baseline volume: gently fades down, pauses playback,
 * and seamlessly restores normal volume for the next listening session.
 */

import { audioService } from './audioService';

export type SleepTimerPreset = 'off' | '15' | '30' | '45' | '60' | 'end_of_song' | 'custom';

export interface SleepTimerState {
  isActive: boolean;
  mode: SleepTimerPreset;
  remainingSeconds: number | null;
  isFading: boolean;
}

type SleepTimerListener = (state: SleepTimerState) => void;

class SleepTimerService {
  private mode: SleepTimerPreset = 'off';
  private targetTimestamp: number | null = null;
  private timerInterval: any = null;
  private listeners: Set<SleepTimerListener> = new Set();

  // Volume restoration memory
  private baselineVolume: number = 0.8;
  private isFading: boolean = false;
  private fadeDurationSeconds: number = 60;

  constructor() {
    // Listen for song end when mode is 'end_of_song'
    audioService.subscribe((audioState) => {
      if (this.mode === 'end_of_song' && audioState.isPlaying && audioState.duration > 0) {
        const remaining = Math.max(0, Math.round(audioState.duration - audioState.currentTime));
        this.handleEndOfSongTick(remaining);
      }
    });
  }

  private getState(): SleepTimerState {
    let remaining: number | null = null;
    if (this.mode !== 'off' && this.targetTimestamp) {
      remaining = Math.max(0, Math.round((this.targetTimestamp - Date.now()) / 1000));
    }

    return {
      isActive: this.mode !== 'off',
      mode: this.mode,
      remainingSeconds: remaining,
      isFading: this.isFading
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  public subscribe(listener: SleepTimerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  /**
   * Starts or updates sleep timer with given preset
   */
  public setSleepTimer(preset: SleepTimerPreset, customMinutes?: number): void {
    this.cancelSleepTimer(false);

    if (preset === 'off') {
      this.notify();
      return;
    }

    // Capture baseline volume before any fade operations
    this.baselineVolume = audioService.getVolume();
    this.isFading = false;
    this.mode = preset;

    if (preset === 'end_of_song') {
      // Handled via audioService listener
      this.notify();
      return;
    }

    let minutes = 15;
    if (preset === '30') minutes = 30;
    else if (preset === '45') minutes = 45;
    else if (preset === '60') minutes = 60;
    else if (preset === 'custom' && customMinutes) minutes = customMinutes;

    const durationMs = minutes * 60 * 1000;
    this.targetTimestamp = Date.now() + durationMs;

    // Start 1-second interval with drift-proof timestamp calculations
    this.timerInterval = setInterval(() => {
      this.tick();
    }, 1000);

    this.notify();
  }

  /**
   * Internal clock tick
   */
  private tick() {
    if (!this.targetTimestamp || this.mode === 'off' || this.mode === 'end_of_song') return;

    const remainingMs = this.targetTimestamp - Date.now();
    const remainingSec = Math.max(0, Math.round(remainingMs / 1000));

    if (remainingSec <= 0) {
      this.triggerCompletion();
      return;
    }

    // Final 60-second gentle fade-out
    if (remainingSec <= this.fadeDurationSeconds) {
      if (!this.isFading) {
        this.isFading = true;
        this.baselineVolume = audioService.getVolume();
      }
      // Linear/exponential volume ramp down
      const fadeFactor = remainingSec / this.fadeDurationSeconds;
      const targetVol = Math.max(0, this.baselineVolume * fadeFactor);
      audioService.setVolume(targetVol);
    }

    this.notify();
  }

  /**
   * Handles End Of Song countdown and smooth fade
   */
  private handleEndOfSongTick(remainingSec: number) {
    if (this.mode !== 'end_of_song') return;

    if (remainingSec <= 1) {
      this.triggerCompletion();
      return;
    }

    const fadeWindow = Math.min(30, this.fadeDurationSeconds);
    if (remainingSec <= fadeWindow) {
      if (!this.isFading) {
        this.isFading = true;
        this.baselineVolume = audioService.getVolume();
      }
      const fadeFactor = remainingSec / fadeWindow;
      const targetVol = Math.max(0, this.baselineVolume * fadeFactor);
      audioService.setVolume(targetVol);
    }

    this.notify();
  }

  /**
   * Completes the timer: pauses music, restores baseline volume, clears timer
   */
  private triggerCompletion() {
    this.clearTimerInterval();

    // 1. Pause playback
    audioService.pause();

    // 2. Restore user's baseline volume so next session starts normal
    audioService.setVolume(this.baselineVolume > 0.05 ? this.baselineVolume : 0.8);

    // 3. Reset state
    this.mode = 'off';
    this.targetTimestamp = null;
    this.isFading = false;

    this.notify();
  }

  /**
   * Cancels sleep timer and immediately restores baseline volume if during a fade
   */
  public cancelSleepTimer(restoreVolume: boolean = true): void {
    this.clearTimerInterval();

    if (this.isFading && restoreVolume) {
      audioService.setVolume(this.baselineVolume);
    }

    this.mode = 'off';
    this.targetTimestamp = null;
    this.isFading = false;

    this.notify();
  }

  private clearTimerInterval() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public getRemainingSeconds(): number | null {
    if (this.mode === 'off' || !this.targetTimestamp) return null;
    return Math.max(0, Math.round((this.targetTimestamp - Date.now()) / 1000));
  }

  public getMode(): SleepTimerPreset {
    return this.mode;
  }
}

export const sleepTimerService = new SleepTimerService();
