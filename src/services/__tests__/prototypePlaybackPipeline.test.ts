import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prototypePipeline, PROTOTYPE_BENCHMARK_TRACKS, PrototypeTrack } from '../prototypePlaybackPipeline';
import * as jiosaavnService from '../jiosaavnService';
import { androidMediaBridge } from '../androidMediaBridge';
import { cloudPlayerService } from '../cloudPlayerService';

describe('Prototype Playback Architecture Pipeline', () => {
  beforeEach(() => {
    prototypePipeline.reset();
    vi.restoreAllMocks();
  });

  it('1. correctly identifies and cleans track titles and artists', () => {
    const rawTrack: PrototypeTrack = {
      id: 'test_1',
      title: 'Kesariya (Official Video) [Remastered 4K] | Arijit Singh',
      artist: 'Arijit Singh - Topic',
      duration: 268,
      status: 'PENDING'
    };

    const cleaned = prototypePipeline.identifyTrack(rawTrack);
    expect(cleaned.cleanTitle).toBe('Kesariya');
    expect(cleaned.cleanArtist).toBe('Arijit Singh');
  });

  it('2. routes Saavn-matched songs to Native ExoPlayer with 320kbps AAC stream', async () => {
    const track = { ...PROTOTYPE_BENCHMARK_TRACKS[0] };

    // Mock Saavn search returning a match
    vi.spyOn(jiosaavnService, 'searchJioSaavn').mockResolvedValue([
      {
        id: 'saavn_kesariya_1',
        title: 'Kesariya',
        artist: 'Arijit Singh',
        album: 'Brahmastra',
        duration: 268,
        format: '320k AAC',
        bitrate: 320,
        fileSize: 10000000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        artwork: 'https://c.saavncdn.com/kesariya.jpg',
        filePath: 'https://aac.saavncdn.com/kesariya_320.mp4',
        isOnline: true,
        isSaavn: true
      } as any
    ]);

    const playNativeSpy = vi.spyOn(androidMediaBridge, 'playNativeTrack').mockResolvedValue(undefined);

    prototypePipeline.loadTracks([track]);
    await prototypePipeline.playTrackAtIndex(0);

    let currentMetrics: any = null;
    let currentTracks: PrototypeTrack[] = [];
    prototypePipeline.subscribe((tracks, idx, metrics) => {
      currentTracks = tracks;
      currentMetrics = metrics;
    });

    expect(currentTracks[0].resolutionTier).toBe('SAAVN_NATIVE');
    expect(currentTracks[0].streamUrl).toBe('https://aac.saavncdn.com/kesariya_320.mp4');
    expect(currentMetrics.saavnMatchedCount).toBe(1);
    expect(currentMetrics.activePlayer).toBe('EXOPLAYER_NATIVE');
  });

  it('3. routes unmatched YouTube songs to server-side yt-dlp resolver and then Native ExoPlayer', async () => {
    const track: PrototypeTrack = {
      id: 'test_yt_unmatched',
      title: 'Rare Underground Synthwave Remix',
      artist: 'Retro Synth Boy',
      duration: 240,
      videoId: 'dQw4w9WgXcQ',
      status: 'PENDING'
    };

    // Saavn match fails
    vi.spyOn(jiosaavnService, 'searchJioSaavn').mockResolvedValue([]);

    // Mock global fetch for yt-dlp resolver endpoint
    const mockResolvedUrl = 'https://rr6---sn-gwpa-h55e7.googlevideo.com/videoplayback?itag=140';
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/online/stream')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'dQw4w9WgXcQ', streamUrl: mockResolvedUrl })
        } as any);
      }
      return Promise.reject(new Error('Unknown url'));
    });

    prototypePipeline.loadTracks([track]);
    await prototypePipeline.playTrackAtIndex(0);

    let currentMetrics: any = null;
    let currentTracks: PrototypeTrack[] = [];
    prototypePipeline.subscribe((tracks, idx, metrics) => {
      currentTracks = tracks;
      currentMetrics = metrics;
    });

    expect(currentTracks[0].resolutionTier).toBe('YTDLP_NATIVE');
    expect(currentTracks[0].streamUrl).toBe(mockResolvedUrl);
    expect(currentMetrics.ytdlpResolvedCount).toBe(1);
    expect(currentMetrics.activePlayer).toBe('EXOPLAYER_NATIVE');
  });

  it('4. cleanly falls back to YouTube IFrame foreground player when both Saavn & yt-dlp fail', async () => {
    const track = { ...PROTOTYPE_BENCHMARK_TRACKS[3] }; // Invalid ID

    // Saavn match fails
    vi.spyOn(jiosaavnService, 'searchJioSaavn').mockResolvedValue([]);

    // yt-dlp server fails
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('502 Bad Gateway'))
      } as any);
    });

    const loadVideoSpy = vi.spyOn(cloudPlayerService, 'loadVideo').mockImplementation(() => {});

    prototypePipeline.loadTracks([track]);
    await prototypePipeline.playTrackAtIndex(0);

    let currentMetrics: any = null;
    let currentTracks: PrototypeTrack[] = [];
    prototypePipeline.subscribe((tracks, idx, metrics) => {
      currentTracks = tracks;
      currentMetrics = metrics;
    });

    expect(currentTracks[0].resolutionTier).toBe('IFRAME_FALLBACK');
    expect(currentMetrics.iframeFallbackCount).toBe(1);
    expect(currentMetrics.activePlayer).toBe('YOUTUBE_IFRAME');
    expect(loadVideoSpy).toHaveBeenCalledWith('INVALID_VIDEO_ID_99999', 0);
  });

  it('5. handles lock-screen & Bluetooth mediaAction events for next, previous, pause, play, seek', async () => {
    const tracks = [
      { ...PROTOTYPE_BENCHMARK_TRACKS[0] },
      { ...PROTOTYPE_BENCHMARK_TRACKS[1] }
    ];

    vi.spyOn(jiosaavnService, 'searchJioSaavn').mockResolvedValue([]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ streamUrl: 'https://example.com/audio.m4a' })
    } as any);

    prototypePipeline.loadTracks(tracks);
    await prototypePipeline.playTrackAtIndex(0);

    // Simulate Bluetooth "next" button click
    const playTrackSpy = vi.spyOn(prototypePipeline, 'playTrackAtIndex');
    prototypePipeline.handleMediaAction('next');
    expect(playTrackSpy).toHaveBeenCalledWith(1);

    // Simulate Bluetooth "previous" button click
    prototypePipeline.handleMediaAction('previous');
    expect(playTrackSpy).toHaveBeenCalledWith(0);

    // Simulate Bluetooth "pause"
    prototypePipeline.handleMediaAction('pause');
    let metrics: any;
    prototypePipeline.subscribe((t, idx, m) => { metrics = m; });
    expect(metrics.isPlaying).toBe(false);

    // Simulate Bluetooth "play"
    prototypePipeline.handleMediaAction('play');
    expect(metrics.isPlaying).toBe(true);
  });
});
