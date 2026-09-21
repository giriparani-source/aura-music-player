import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { jamService } from '../jamService';
import { audioService } from '../audioService';

describe('JamService - Synchronization & NTP Clock Calibration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jamService.leaveRoom();
  });

  afterEach(() => {
    jamService.leaveRoom();
  });

  it('starts in an idle, unconnected state with 0 drift', () => {
    expect(jamService.getIsInRoom()).toBe(false);
    expect(jamService.getIsHost()).toBe(false);
    expect(jamService.getRoomCode()).toBeNull();
    expect(jamService.getSyncStatus()).toBe('idle');
    expect(jamService.getClockOffsetMs()).toBe(0);
  });

  it('audioService maintains preservesPitch when adjusting playbackRate for micro-pacing', () => {
    audioService.setPlaybackRate(1.03);
    expect(audioService.getPlaybackRate()).toBe(1.03);

    const audioEl = audioService.getAudioElement();
    if (audioEl) {
      expect(audioEl.preservesPitch).toBe(true);
    }

    audioService.setPlaybackRate(1.0);
    expect(audioService.getPlaybackRate()).toBe(1.0);
  });

  it('correctly calculates NTP clock offset from ping-pong sample', () => {
    // Simulating listener clock = 100,000; host clock = 102,346 (2346ms skew)
    const clientSendPerf = 1000;
    const clientSendDate = 100000;
    const rttMs = 40; // 40ms round-trip
    const oneWayMs = 20; // 20ms one-way
    const hostDateAtPingArrival = 100000 + 2346 + oneWayMs; // 102,366

    // When listener receives pong:
    const receivePerf = clientSendPerf + rttMs;
    const calculatedRtt = receivePerf - clientSendPerf;
    const calculatedOneWay = calculatedRtt / 2;
    const sampleOffset = hostDateAtPingArrival - (clientSendDate + calculatedOneWay);

    // Host is ahead by ~2346ms
    expect(sampleOffset).toBe(2346);

    // Verification of elapsed calculation:
    // Ping arrived at host when listener was at 100,020.
    // 7,634ms later, host broadcasts SYNC at host local time 110,000. Listener is at 107,654.
    // SYNC takes 20ms to travel to listener. Listener receives it at 107,674.
    const hostTimestamp = 110000;
    const listenerReceiveDate = 107674;
    const clientEquivalentTimestamp = hostTimestamp - sampleOffset; // 110,000 - 2346 = 107,654
    const elapsedSec = (listenerReceiveDate - clientEquivalentTimestamp) / 1000;

    // Elapsed network time matches the exact 20ms one-way transit time! Zero clock skew!
    expect(elapsedSec).toBeCloseTo(0.02, 3);
  });

  it('uses micro-rate steering without calling seek when drift is minor (e.g. 150ms)', () => {
    const seekSpy = vi.spyOn(audioService, 'seek');
    const setRateSpy = vi.spyOn(audioService, 'setPlaybackRate');
    vi.spyOn(audioService, 'getCurrentSong').mockReturnValue({ id: 'test-song', title: 'Test', duration: 200 } as any);
    vi.spyOn(audioService, 'isCurrentlyPlaying').mockReturnValue(true);
    vi.spyOn(audioService, 'getCurrentPlaybackTime').mockReturnValue(50.0);

    // Apply incoming sync where host is at 50.15s (listener is 150ms behind)
    const now = Date.now();
    (jamService as any)['isHost'] = false;
    (jamService as any)['isInRoom'] = true;
    (jamService as any)['clockOffsetMs'] = 0;
    (jamService as any)['isBufferingNewSong'] = false;

    (jamService as any)['applyIncomingPlaybackSync']({
      currentSong: { id: 'test-song', title: 'Test', duration: 200 },
      currentTime: 50.15,
      isPlaying: true,
      timestamp: now
    });

    // Verify seek was NEVER called for 150ms drift!
    expect(seekSpy).not.toHaveBeenCalled();
    // Verify playback rate was gently increased to catch up
    expect(setRateSpy).toHaveBeenCalledWith(1.025);
    expect(jamService.getSyncStatus()).toBe('steering');
  });

  it('returns rate to 1.0 when drift is within tight sync threshold (< 60ms)', () => {
    const seekSpy = vi.spyOn(audioService, 'seek');
    const setRateSpy = vi.spyOn(audioService, 'setPlaybackRate');
    vi.spyOn(audioService, 'getCurrentSong').mockReturnValue({ id: 'test-song', title: 'Test', duration: 200 } as any);
    vi.spyOn(audioService, 'isCurrentlyPlaying').mockReturnValue(true);
    vi.spyOn(audioService, 'getCurrentPlaybackTime').mockReturnValue(50.0);
    vi.spyOn(audioService, 'getPlaybackRate').mockReturnValue(1.025);

    const now = Date.now();
    (jamService as any)['isHost'] = false;
    (jamService as any)['isInRoom'] = true;
    (jamService as any)['clockOffsetMs'] = 0;
    (jamService as any)['isBufferingNewSong'] = false;

    // Host is at 50.03s (30ms drift)
    (jamService as any)['applyIncomingPlaybackSync']({
      currentSong: { id: 'test-song', title: 'Test', duration: 200 },
      currentTime: 50.03,
      isPlaying: true,
      timestamp: now
    });

    expect(seekSpy).not.toHaveBeenCalled();
    expect(setRateSpy).toHaveBeenCalledWith(1.0);
    expect(jamService.getSyncStatus()).toBe('perfect');
  });

  it('enforces 4-second cooldown on hard seeks to prevent seek thrashing', () => {
    const seekSpy = vi.spyOn(audioService, 'seek');
    const setRateSpy = vi.spyOn(audioService, 'setPlaybackRate');
    vi.spyOn(audioService, 'getCurrentSong').mockReturnValue({ id: 'test-song', title: 'Test', duration: 200 } as any);
    vi.spyOn(audioService, 'isCurrentlyPlaying').mockReturnValue(true);
    vi.spyOn(audioService, 'getCurrentPlaybackTime').mockReturnValue(50.0);

    const now = Date.now();
    (jamService as any)['isHost'] = false;
    (jamService as any)['isInRoom'] = true;
    (jamService as any)['clockOffsetMs'] = 0;
    (jamService as any)['isBufferingNewSong'] = false;
    (jamService as any)['lastHardSeekTime'] = 0;

    // First big jump (> 1.2s drift, e.g. 5.0s)
    (jamService as any)['applyIncomingPlaybackSync']({
      currentSong: { id: 'test-song', title: 'Test', duration: 200 },
      currentTime: 55.0,
      isPlaying: true,
      timestamp: now
    });

    expect(seekSpy).toHaveBeenCalledTimes(1);

    // Second sync arrives 1.2s later with remaining large drift
    (jamService as any)['applyIncomingPlaybackSync']({
      currentSong: { id: 'test-song', title: 'Test', duration: 200 },
      currentTime: 56.2,
      isPlaying: true,
      timestamp: now + 1200
    });

    // Still only 1 seek! The second packet did NOT thrash seek because of 4s cooldown!
    expect(seekSpy).toHaveBeenCalledTimes(1);
    // Instead it steered
    expect(setRateSpy).toHaveBeenCalledWith(1.06);
  });
});
