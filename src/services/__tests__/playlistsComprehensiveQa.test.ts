import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { INBUILT_PLAYLISTS, inbuiltPlaylistsService } from '../inbuiltPlaylistsService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { audioService } from '../audioService';
import { Song } from '../../types/music';
import { artistPlaylistService } from '../artistPlaylistService';
import { TAMIL_ARTISTS } from '../tamilArtistsData';

// Polyfills for Node / Vitest testing environment
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  };
}

describe('All Playlists Comprehensive QA: Play, Pause, Shuffle, Auto-Play', () => {
  let playSpy: any;
  let pauseSpy: any;

  beforeEach(() => {
    // Reset player store to clean state
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      queueIndex: -1,
      isShuffle: false,
      shuffleMode: 'off',
      shuffledQueueOrder: [],
      repeatMode: 'off',
      playbackHistory: []
    });

    playSpy = vi.fn().mockImplementation(async (song: Song) => {
      // Mock successful audio start
      // @ts-ignore
      audioService.currentSong = song;
      // Trigger subscriber to update store isPlaying to true
      // @ts-ignore
      if (typeof audioService.notify === 'function') {
        // @ts-ignore
        audioService.notify();
      }
      return true;
    });

    pauseSpy = vi.fn().mockImplementation(() => {
      // @ts-ignore
      if (typeof audioService.notify === 'function') {
        // @ts-ignore
        audioService.notify();
      }
    });

    vi.spyOn(audioService, 'playSong').mockImplementation(playSpy);
    vi.spyOn(audioService, 'pause').mockImplementation(pauseSpy);
    vi.spyOn(audioService, 'togglePlay').mockImplementation(async () => {
      const isPlaying = usePlayerStore.getState().isPlaying;
      usePlayerStore.setState({ isPlaying: !isPlaying });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. PLAYLIST REGISTRY INTEGRITY
  // ---------------------------------------------------------------------------
  describe('1. Playlist Registry & Metadata Integrity', () => {
    it('verifies all 11 Inbuilt Playlists are registered with valid metadata and non-empty tracks', () => {
      expect(INBUILT_PLAYLISTS.length).toBe(11);

      INBUILT_PLAYLISTS.forEach((pl) => {
        expect(pl.id).toBeDefined();
        expect(pl.title.length).toBeGreaterThan(0);
        expect(pl.subtitle.length).toBeGreaterThan(0);
        expect(pl.coverArt).toBeDefined();
        expect(pl.tracks.length).toBeGreaterThanOrEqual(25);
        expect(pl.tracks.length).toBe(pl.songCount);

        // Every song must have required fields
        pl.tracks.forEach((track, idx) => {
          expect(track.id, `Track ${idx} in ${pl.title} missing id`).toBeTruthy();
          expect(track.title, `Track ${idx} in ${pl.title} missing title`).toBeTruthy();
          expect(track.artist, `Track ${idx} in ${pl.title} missing artist`).toBeTruthy();
          expect(track.duration, `Track ${idx} in ${pl.title} invalid duration`).toBeGreaterThan(0);
          expect(track.filePath || track.path, `Track ${idx} in ${pl.title} missing stream URL`).toBeTruthy();
          expect(track.artwork || track.coverArt, `Track ${idx} in ${pl.title} missing artwork`).toBeTruthy();
        });
      });
    });

    it('verifies getById retrieves each playlist correctly', () => {
      INBUILT_PLAYLISTS.forEach((pl) => {
        const found = inbuiltPlaylistsService.getById(pl.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(pl.id);
        expect(found?.tracks.length).toBe(pl.tracks.length);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. PLAY FUNCTIONALITY (Every Playlist)
  // ---------------------------------------------------------------------------
  describe('2. Play Functionality Across All Playlists', () => {
    INBUILT_PLAYLISTS.forEach((pl) => {
      it(`plays first song and sets queue properly for: "${pl.title}"`, async () => {
        const firstTrack = pl.tracks[0];
        
        // Trigger playSong with playlist tracks
        await usePlayerStore.getState().playSong(firstTrack, pl.tracks, 0);

        const state = usePlayerStore.getState();
        expect(state.currentSong?.id).toBe(firstTrack.id);
        expect(state.queue.length).toBe(pl.tracks.length);
        expect(state.queueIndex).toBe(0);
        expect(audioService.playSong).toHaveBeenCalledWith(firstTrack);
      });

      it(`plays arbitrary middle track (e.g. index 5) and preserves queue for: "${pl.title}"`, async () => {
        const targetIndex = Math.min(5, pl.tracks.length - 1);
        const targetTrack = pl.tracks[targetIndex];

        await usePlayerStore.getState().playSong(targetTrack, pl.tracks, targetIndex);

        const state = usePlayerStore.getState();
        expect(state.currentSong?.id).toBe(targetTrack.id);
        expect(state.queueIndex).toBe(targetIndex);
        expect(state.queue.length).toBe(pl.tracks.length);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. PAUSE & RESUME FUNCTIONALITY
  // ---------------------------------------------------------------------------
  describe('3. Pause (Pash) & Resume Across Playlists', () => {
    INBUILT_PLAYLISTS.forEach((pl) => {
      it(`pauses and resumes cleanly during playback of: "${pl.title}"`, async () => {
        const track = pl.tracks[0];
        await usePlayerStore.getState().playSong(track, pl.tracks, 0);
        usePlayerStore.setState({ isPlaying: true });

        expect(usePlayerStore.getState().isPlaying).toBe(true);

        // User taps Pause
        usePlayerStore.getState().togglePlay();
        expect(usePlayerStore.getState().isPlaying).toBe(false);
        expect(usePlayerStore.getState().currentSong?.id).toBe(track.id);

        // User taps Resume (Play)
        usePlayerStore.getState().togglePlay();
        expect(usePlayerStore.getState().isPlaying).toBe(true);
        expect(usePlayerStore.getState().currentSong?.id).toBe(track.id);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. SHUFFLE PLAY (Fair Shuffle & Smart Shuffle & Queue Reshuffle)
  // ---------------------------------------------------------------------------
  describe('4. Shuffle Play (Fair 🔀, Smart ✨, Reshuffle 🎲)', () => {
    INBUILT_PLAYLISTS.forEach((pl) => {
      it(`enables Fair Shuffle, generates complete permutation for: "${pl.title}"`, async () => {
        await usePlayerStore.getState().playSong(pl.tracks[0], pl.tracks, 0);
        
        // Turn on Fair Shuffle
        usePlayerStore.getState().setShuffleMode('fair');

        const state = usePlayerStore.getState();
        expect(state.isShuffle).toBe(true);
        expect(state.shuffleMode).toBe('fair');
        expect(state.shuffledQueueOrder.length).toBe(pl.tracks.length);

        // Every song index 0..N-1 must be present exactly once
        const sortedIndices = [...state.shuffledQueueOrder].sort((a, b) => a - b);
        const expected = Array.from({ length: pl.tracks.length }, (_, i) => i);
        expect(sortedIndices).toEqual(expected);

        // The active song (0) must stay as the current playing index
        expect(state.shuffledQueueOrder[0]).toBe(0);
      });

      it(`advances through Fair Shuffle queue without duplicates for: "${pl.title}"`, async () => {
        await usePlayerStore.getState().playSong(pl.tracks[0], pl.tracks, 0);
        usePlayerStore.getState().setShuffleMode('fair');

        const playedTrackIds = new Set<string>();
        playedTrackIds.add(usePlayerStore.getState().currentSong!.id);

        // Advance 5 times
        const steps = Math.min(5, pl.tracks.length - 1);
        for (let i = 0; i < steps; i++) {
          usePlayerStore.getState().nextSong();
          const current = usePlayerStore.getState().currentSong;
          expect(current).toBeDefined();
          expect(playedTrackIds.has(current!.id)).toBe(false);
          playedTrackIds.add(current!.id);
        }

        expect(playedTrackIds.size).toBe(steps + 1);
      });

      it(`reshuffles upcoming queue without disrupting currently playing song for: "${pl.title}"`, async () => {
        await usePlayerStore.getState().playSong(pl.tracks[2], pl.tracks, 2);
        usePlayerStore.getState().setShuffleMode('fair');

        const beforeShuffle = [...usePlayerStore.getState().shuffledQueueOrder];
        const activeSongBefore = usePlayerStore.getState().currentSong?.id;

        // User taps "Reshuffle Queue" 🎲
        usePlayerStore.getState().reshuffleQueue();

        const afterShuffle = usePlayerStore.getState().shuffledQueueOrder;
        const activeSongAfter = usePlayerStore.getState().currentSong?.id;

        // Current song must NOT change
        expect(activeSongAfter).toBe(activeSongBefore);
        expect(afterShuffle[0]).toBe(beforeShuffle[0]);

        // Total count must be preserved
        expect(afterShuffle.length).toBe(beforeShuffle.length);
      });

      it(`enables Smart Shuffle ✨ mode for: "${pl.title}"`, async () => {
        await usePlayerStore.getState().playSong(pl.tracks[0], pl.tracks, 0);
        usePlayerStore.getState().setShuffleMode('smart');

        const state = usePlayerStore.getState();
        expect(state.isShuffle).toBe(true);
        expect(state.shuffleMode).toBe('smart');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. AUTO PLAY FUNCTIONALITY (Automatic next-track progression)
  // ---------------------------------------------------------------------------
  describe('5. Auto Play (Automatic Queue Advancement on Song End)', () => {
    INBUILT_PLAYLISTS.forEach((pl) => {
      it(`automatically advances to next track when song finishes in: "${pl.title}"`, async () => {
        // Start playing first track of playlist
        await usePlayerStore.getState().playSong(pl.tracks[0], pl.tracks, 0);
        usePlayerStore.setState({ isPlaying: true });

        expect(usePlayerStore.getState().queueIndex).toBe(0);
        expect(usePlayerStore.getState().currentSong?.id).toBe(pl.tracks[0].id);

        // Simulate song ending (HTML5 Audio ended event triggers audioService.onSongEnd)
        // In usePlayerStore, audioService.setOnSongEnd(() => get().nextSong()) is registered.
        usePlayerStore.getState().nextSong();

        // Must automatically advance to index 1
        expect(usePlayerStore.getState().queueIndex).toBe(1);
        expect(usePlayerStore.getState().currentSong?.id).toBe(pl.tracks[1].id);
        expect(audioService.playSong).toHaveBeenCalledWith(pl.tracks[1]);

        // Advance once more
        usePlayerStore.getState().nextSong();
        expect(usePlayerStore.getState().queueIndex).toBe(2);
        expect(usePlayerStore.getState().currentSong?.id).toBe(pl.tracks[2].id);
      });
    });

    it('auto-loops back to start of playlist when repeatMode is "all"', async () => {
      const pl = INBUILT_PLAYLISTS[0];
      const lastIndex = pl.tracks.length - 1;

      await usePlayerStore.getState().playSong(pl.tracks[lastIndex], pl.tracks, lastIndex);
      usePlayerStore.setState({ repeatMode: 'all', isShuffle: false });

      expect(usePlayerStore.getState().queueIndex).toBe(lastIndex);

      // Track ends at the very end of the playlist
      usePlayerStore.getState().nextSong();

      // Should automatically wrap around to track 0
      expect(usePlayerStore.getState().queueIndex).toBe(0);
      expect(usePlayerStore.getState().currentSong?.id).toBe(pl.tracks[0].id);
    });

    it('replays same track when repeatMode is "one"', async () => {
      const pl = INBUILT_PLAYLISTS[0];
      await usePlayerStore.getState().playSong(pl.tracks[3], pl.tracks, 3);
      usePlayerStore.setState({ repeatMode: 'one' });

      const seekSpy = vi.spyOn(audioService, 'seek');
      const resumeSpy = vi.spyOn(audioService, 'resume');

      // Track ends
      usePlayerStore.getState().nextSong();

      // Should restart from 0:00 and keep same song
      expect(seekSpy).toHaveBeenCalledWith(0);
      expect(resumeSpy).toHaveBeenCalled();
      expect(usePlayerStore.getState().currentSong?.id).toBe(pl.tracks[3].id);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. ARTIST PLAYLIST GENERATION & PLAYBACK
  // ---------------------------------------------------------------------------
  describe('6. Curated Tamil Artists Playlists', () => {
    const sampleArtists = ['anirudh_ravichander', 'ar_rahman', 'yuvan_shankar_raja', 'harris_jayaraj'];

    sampleArtists.forEach((artistId) => {
      const artist = TAMIL_ARTISTS.find((a) => a.id === artistId);
      if (!artist) return;

      it(`generates and plays artist playlist for "${artist.name}"`, async () => {
        const playlist = await artistPlaylistService.getArtistPlaylist(artist, []);
        expect(playlist.tracks.length).toBeGreaterThan(0);

        // Play artist playlist
        await usePlayerStore.getState().playSong(playlist.tracks[0], playlist.tracks, 0);
        usePlayerStore.setState({ isPlaying: true });

        const state = usePlayerStore.getState();
        expect(state.currentSong?.id).toBe(playlist.tracks[0].id);
        expect(state.queue.length).toBe(playlist.tracks.length);

        // Pause
        usePlayerStore.getState().togglePlay();
        expect(usePlayerStore.getState().isPlaying).toBe(false);

        // Resume
        usePlayerStore.getState().togglePlay();
        expect(usePlayerStore.getState().isPlaying).toBe(true);

        // Auto-advance
        usePlayerStore.getState().nextSong();
        if (playlist.tracks.length > 1) {
          expect(state.queueIndex).toBe(0); // Before state update check
          expect(usePlayerStore.getState().queueIndex).toBe(1);
        }
      });
    });
  });
});
