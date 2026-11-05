import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { androidMediaBridge } from '../androidMediaBridge';
import { audioService } from '../audioService';
import { downloadService } from '../downloadService';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Song } from '../../types/music';

// Mock Capacitor
vi.mock('@capacitor/core', () => {
  const mockAuraMedia = {
    playNativeTrack: vi.fn().mockResolvedValue(undefined),
    pauseNative: vi.fn().mockResolvedValue(undefined),
    resumeNative: vi.fn().mockResolvedValue(undefined),
    seekNative: vi.fn().mockResolvedValue(undefined),
    stopNative: vi.fn().mockResolvedValue(undefined),
    isOfflineTrackSaved: vi.fn().mockResolvedValue({ saved: false, filePath: '', uri: '' }),
    getOfflineServerPort: vi.fn().mockResolvedValue({ port: 28753 }),
    updateTrack: vi.fn().mockResolvedValue(undefined),
    updatePlaybackState: vi.fn().mockResolvedValue(undefined),
    stopService: vi.fn().mockResolvedValue(undefined),
    minimizeApp: vi.fn().mockResolvedValue(undefined),
    scanDeviceAudio: vi.fn().mockResolvedValue({ total: 0, tracks: [] }),
    addListener: vi.fn(),
  };

  return {
    Capacitor: {
      isNativePlatform: vi.fn().mockReturnValue(true),
      convertFileSrc: vi.fn((path: string) => `https://localhost/_capacitor_file_${path}`),
    },
    registerPlugin: vi.fn().mockReturnValue(mockAuraMedia),
  };
});

describe('Native ExoPlayer Background Audio Architecture', () => {
  const mockSong: Song = {
    id: 'offline_song_44min',
    title: 'Aura Masterpiece 44min',
    artist: 'Aura Symphony',
    album: 'Ultimate Collection',
    duration: 2640, // 44 minutes
    filePath: 'https://example.com/audio/44min.m4a',
    isDownloaded: true,
  } as unknown as Song;

  beforeEach(() => {
    vi.clearAllMocks();
    (Capacitor.isNativePlatform as any).mockReturnValue(true);
    androidMediaBridge.init();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Verifies androidMediaBridge routes playNativeTrack with full track metadata to AuraMedia', async () => {
    const auraMedia = (registerPlugin as any)();
    await androidMediaBridge.playNativeTrack(mockSong, 'file:///data/user/0/offline_audio/offline_song_44min.audio', 120);

    expect(auraMedia.playNativeTrack).toHaveBeenCalledWith({
      id: 'offline_song_44min',
      title: 'Aura Masterpiece 44min',
      artist: 'Aura Symphony',
      album: 'Ultimate Collection',
      artwork: '',
      uri: 'file:///data/user/0/offline_audio/offline_song_44min.audio',
      duration: 2640,
      position: 120,
    });
  });

  it('2. Verifies pauseNative, resumeNative, seekNative, and stopNative invoke native plugin', async () => {
    const auraMedia = (registerPlugin as any)();

    await androidMediaBridge.pauseNative();
    expect(auraMedia.pauseNative).toHaveBeenCalled();

    await androidMediaBridge.resumeNative();
    expect(auraMedia.resumeNative).toHaveBeenCalled();

    await androidMediaBridge.seekNative(300);
    expect(auraMedia.seekNative).toHaveBeenCalledWith({ position: 300 });

    await androidMediaBridge.stopNative();
    expect(auraMedia.stopNative).toHaveBeenCalled();
  });

  it('3. Verifies ensureNativeOfflineAudio returns existing URI if already saved on flash storage', async () => {
    const auraMedia = (registerPlugin as any)();
    auraMedia.isOfflineTrackSaved.mockResolvedValueOnce({
      saved: true,
      filePath: '/data/user/0/offline_audio/offline_song_44min.audio',
      uri: 'file:///data/user/0/offline_audio/offline_song_44min.audio',
    });

    const uri = await androidMediaBridge.ensureNativeOfflineAudio(mockSong);
    expect(uri).toBe('file:///data/user/0/offline_audio/offline_song_44min.audio');
    expect(auraMedia.isOfflineTrackSaved).toHaveBeenCalledWith({ id: 'offline_song_44min' });
  });

  it('4. Verifies audioService routes downloaded tracks to native ExoPlayer when running on Android', async () => {
    vi.spyOn(downloadService, 'isTrackDownloaded').mockResolvedValue(true);
    vi.spyOn(androidMediaBridge, 'ensureNativeOfflineAudio').mockResolvedValue(
      'file:///data/user/0/offline_audio/offline_song_44min.audio'
    );
    const playNativeSpy = vi.spyOn(androidMediaBridge, 'playNativeTrack').mockResolvedValue(undefined);

    await audioService.playSong(mockSong);

    expect(audioService.isUsingNativePlayer).toBe(true);
    expect(playNativeSpy).toHaveBeenCalledWith(
      mockSong,
      'file:///data/user/0/offline_audio/offline_song_44min.audio',
      0
    );
  });

  it('5. Verifies transport controls (pause/resume/seek) dispatch to native engine when isUsingNativePlayer is active', async () => {
    audioService.isUsingNativePlayer = true;
    const pauseSpy = vi.spyOn(androidMediaBridge, 'pauseNative').mockResolvedValue(undefined);
    const resumeSpy = vi.spyOn(androidMediaBridge, 'resumeNative').mockResolvedValue(undefined);
    const seekSpy = vi.spyOn(androidMediaBridge, 'seekNative').mockResolvedValue(undefined);

    audioService.pause();
    expect(pauseSpy).toHaveBeenCalled();

    await audioService.resume();
    expect(resumeSpy).toHaveBeenCalled();

    audioService.seek(600);
    expect(seekSpy).toHaveBeenCalledWith(600);
    expect(audioService.getCurrentTime()).toBe(600);
  });

  it('6. Verifies web playback path remains intact and unaffected when not on native platform', async () => {
    (Capacitor.isNativePlatform as any).mockReturnValue(false);
    audioService.isUsingNativePlayer = false;

    const webSong: Song = {
      id: 'web_track_1',
      title: 'Web Stream Song',
      filePath: 'https://example.com/stream.mp3',
    } as unknown as Song;

    vi.spyOn(downloadService, 'isTrackDownloaded').mockResolvedValue(false);
    vi.spyOn(downloadService, 'getCachedAudioUrl').mockResolvedValue(null);

    // Audio element play should be attempted, not native
    const playNativeSpy = vi.spyOn(androidMediaBridge, 'playNativeTrack');
    await audioService.playSong(webSong);

    expect(audioService.isUsingNativePlayer).toBe(false);
    expect(playNativeSpy).not.toHaveBeenCalled();
  });

  it('7. Verifies scanned device local audio routes raw contentUri to ExoPlayer without Capacitor.convertFileSrc wrapper', async () => {
    (Capacitor.isNativePlatform as any).mockReturnValue(true);
    const deviceSong: Song = {
      id: 'device_999',
      title: 'Scanned Phone Song',
      artist: 'Local Artist',
      album: 'Internal Storage',
      duration: 180,
      path: 'content://media/external/audio/media/999',
      contentUri: 'content://media/external/audio/media/999',
    } as unknown as Song;

    const playNativeSpy = vi.spyOn(androidMediaBridge, 'playNativeTrack').mockResolvedValue(undefined);
    await audioService.playSong(deviceSong);

    expect(audioService.isUsingNativePlayer).toBe(true);
    expect(playNativeSpy).toHaveBeenCalledWith(
      deviceSong,
      'content://media/external/audio/media/999',
      0
    );
  });

  it('8. Verifies direct HTTP/HTTPS online streams (e.g. JioSaavn 320k) route to native ExoPlayer when running on Android', async () => {
    (Capacitor.isNativePlatform as any).mockReturnValue(true);
    const saavnSong: Song = {
      id: 'saavn_direct_99',
      title: 'Pudhu Vellai Mazhai',
      artist: 'Unni Menon, Sujatha Mohan',
      album: 'Roja',
      duration: 316,
      filePath: 'https://aac.saavncdn.com/999/roja_pudhu_vellai_mazhai_320.mp4',
      isSaavn: true,
      playbackMode: 'direct-catalog',
    } as unknown as Song;

    vi.spyOn(downloadService, 'isTrackDownloaded').mockResolvedValue(false);
    const playNativeSpy = vi.spyOn(androidMediaBridge, 'playNativeTrack').mockResolvedValue(undefined);

    await audioService.playSong(saavnSong);

    expect(audioService.isUsingNativePlayer).toBe(true);
    expect(playNativeSpy).toHaveBeenCalledWith(
      saavnSong,
      'https://aac.saavncdn.com/999/roja_pudhu_vellai_mazhai_320.mp4',
      0
    );
  });

  it('9. Verifies request ID cancellation: a stale asynchronous track resolution cannot override a newer playing song', async () => {
    (Capacitor.isNativePlatform as any).mockReturnValue(true);
    const songA: Song = {
      id: 'song_stale_A',
      title: 'Slow Loading Song A',
      filePath: 'https://aac.saavncdn.com/slow_A.mp4',
      isSaavn: true,
    } as unknown as Song;

    const songB: Song = {
      id: 'song_fast_B',
      title: 'Fast Loading Song B',
      filePath: 'https://aac.saavncdn.com/fast_B.mp4',
      isSaavn: true,
    } as unknown as Song;

    vi.spyOn(downloadService, 'isTrackDownloaded').mockResolvedValue(false);
    vi.spyOn(androidMediaBridge, 'playNativeTrack').mockImplementation(async (song) => {
      if (song.id === 'song_stale_A') {
        await new Promise((r) => setTimeout(r, 60));
      }
    });

    // Start Song A, then immediately start Song B
    const promiseA = audioService.playSong(songA);
    const promiseB = audioService.playSong(songB);

    await Promise.all([promiseA, promiseB]);

    // Current active song must be Song B, not the older Song A
    expect((audioService as any).currentSong?.id).toBe('song_fast_B');
    expect(audioService.isUsingNativePlayer).toBe(true);
  });
});
