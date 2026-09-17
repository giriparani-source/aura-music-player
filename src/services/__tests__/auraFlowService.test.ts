import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auraFlowService, FlowContext, DEFAULT_FLOW_WEIGHTS } from '../auraFlowService';
import { Song } from '../../types/music';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { audioService } from '../audioService';

const mockSongs: Song[] = [
  {
    id: 's-anirudh-1',
    title: 'Hukum - Thalaivar Alappara',
    artist: 'Anirudh Ravichander',
    album: 'Jailer',
    genre: 'Soundtrack',
    duration: 200,
    path: '/path/1',
    filePath: '/path/1',
    fileName: '1.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 10,
    isFavorite: true,
    isOnline: true,
    isSaavn: true
  },
  {
    id: 's-anirudh-2',
    title: 'Naa Ready',
    artist: 'Anirudh Ravichander, Thalapathy Vijay',
    album: 'Leo',
    genre: 'Soundtrack',
    duration: 180,
    path: '/path/2',
    filePath: '/path/2',
    fileName: '2.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 5,
    isFavorite: false,
    isOnline: true,
    isSaavn: true
  },
  {
    id: 's-arr-1',
    title: 'Munbe Vaa',
    artist: 'A.R. Rahman, Naresh Iyer, Shreya Ghoshal',
    album: 'Sillunu Oru Kaadhal',
    genre: 'Romantic',
    duration: 350,
    path: '/path/3',
    filePath: '/path/3',
    fileName: '3.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 15,
    isFavorite: true,
    isOnline: true,
    isSaavn: true
  },
  {
    id: 's-arr-2',
    title: 'New York Nagaram',
    artist: 'A.R. Rahman',
    album: 'Sillunu Oru Kaadhal',
    genre: 'Romantic',
    duration: 370,
    path: '/path/4',
    filePath: '/path/4',
    fileName: '4.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 8,
    isFavorite: false,
    isOnline: true,
    isSaavn: true
  },
  {
    id: 's-local-1',
    title: 'Local Acoustic Jam',
    artist: 'Local Artist',
    album: 'Indie Sessions',
    genre: 'Acoustic',
    duration: 210,
    path: '/local/1.mp3',
    filePath: '/local/1.mp3',
    fileName: '1.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 2,
    isFavorite: false,
    isOnline: false,
    isSaavn: false
  },
  {
    id: 's-downloaded-remote',
    title: 'Downloaded Remote Hit',
    artist: 'A.R. Rahman',
    album: 'Classics',
    genre: 'Soundtrack',
    duration: 250,
    path: '/remote/dl.mp3',
    filePath: '/remote/dl.mp3',
    fileName: 'dl.mp3',
    format: 'mp3',
    fileSize: 1000,
    dateAdded: Date.now(),
    playCount: 12,
    isFavorite: false,
    isOnline: true,
    isSaavn: true,
    isDownloaded: true
  }
];

describe('AuraFlowService', () => {
  beforeEach(() => {
    auraFlowService.resetSession();
    auraFlowService.setWeights(DEFAULT_FLOW_WEIGHTS);
  });

  describe('Candidate Generation & Fast Filtering', () => {
    it('excludes current song from candidates', () => {
      const context: FlowContext = {
        currentSong: mockSongs[0],
        queue: [mockSongs[0]],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: mockSongs,
        downloadedSongIds: new Set(),
        isOnline: true
      };

      const candidates = auraFlowService.generateCandidates(context);
      const ids = candidates.map((c) => c.id);
      expect(ids).not.toContain(mockSongs[0].id);
    });

    it('excludes upcoming songs in the queue', () => {
      const context: FlowContext = {
        currentSong: mockSongs[0],
        queue: [mockSongs[0], mockSongs[1], mockSongs[2]],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: mockSongs,
        downloadedSongIds: new Set(),
        isOnline: true
      };

      const candidates = auraFlowService.generateCandidates(context);
      const ids = candidates.map((c) => c.id);
      expect(ids).not.toContain(mockSongs[1].id);
      expect(ids).not.toContain(mockSongs[2].id);
    });

    it('excludes songs played very recently in session history', () => {
      const context: FlowContext = {
        currentSong: mockSongs[0],
        queue: [mockSongs[0]],
        queueIndex: 0,
        playbackHistory: [mockSongs[3].id],
        allSongs: mockSongs,
        downloadedSongIds: new Set(),
        isOnline: true
      };

      const candidates = auraFlowService.generateCandidates(context);
      const ids = candidates.map((c) => c.id);
      expect(ids).not.toContain(mockSongs[3].id);
    });

    it('strictly enforces offline filter: only downloaded and local songs eligible when offline', () => {
      const downloadedSet = new Set(['s-downloaded-remote']);
      const context: FlowContext = {
        currentSong: mockSongs[4], // local song playing
        queue: [mockSongs[4]],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: mockSongs,
        downloadedSongIds: downloadedSet,
        isOnline: false // OFFLINE
      };

      const candidates = auraFlowService.generateCandidates(context);
      const ids = candidates.map((c) => c.id);

      // s-anirudh-1, s-anirudh-2, s-arr-1, s-arr-2 are online and NOT downloaded -> must be EXCLUDED
      expect(ids).not.toContain('s-anirudh-1');
      expect(ids).not.toContain('s-anirudh-2');
      expect(ids).not.toContain('s-arr-1');
      expect(ids).not.toContain('s-arr-2');

      // s-downloaded-remote IS downloaded -> must be INCLUDED
      expect(ids).toContain('s-downloaded-remote');
    });
  });

  describe('Multi-Factor Scoring Signals', () => {
    it('awards bonus for same artist continuity', () => {
      const context: FlowContext = {
        currentSong: mockSongs[0], // Anirudh
        queue: [mockSongs[0]],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: mockSongs,
        downloadedSongIds: new Set(),
        isOnline: true,
        weights: { explorationJitter: 0 }
      };

      // Candidate with same lead artist (mockSongs[1])
      const scoreSameArtist = auraFlowService.scoreCandidate(
        mockSongs[1],
        context.currentSong,
        context,
        DEFAULT_FLOW_WEIGHTS
      );

      // Candidate with different artist (mockSongs[3])
      const scoreDiffArtist = auraFlowService.scoreCandidate(
        mockSongs[3],
        context.currentSong,
        context,
        DEFAULT_FLOW_WEIGHTS
      );

      expect(scoreSameArtist.breakdown.artistMatch).toBe(DEFAULT_FLOW_WEIGHTS.artistMatch);
      expect(scoreDiffArtist.breakdown.artistMatch).toBeUndefined();
      expect(scoreSameArtist.totalScore).toBeGreaterThan(scoreDiffArtist.totalScore);
    });

    it('awards bonus for favorite affinity', () => {
      const context: FlowContext = {
        currentSong: null,
        queue: [],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: mockSongs,
        downloadedSongIds: new Set(),
        isOnline: true,
        weights: { explorationJitter: 0 }
      };

      const favSong = { ...mockSongs[1], isFavorite: true };
      const nonFavSong = { ...mockSongs[1], isFavorite: false };

      const deterministicWeights = { ...DEFAULT_FLOW_WEIGHTS, explorationJitter: 0 };
      const scoreFav = auraFlowService.scoreCandidate(favSong, mockSongs[0], context, deterministicWeights);
      const scoreNonFav = auraFlowService.scoreCandidate(nonFavSong, mockSongs[0], context, deterministicWeights);

      expect(scoreFav.breakdown.favorite).toBe(DEFAULT_FLOW_WEIGHTS.favoriteBonus);
      expect(scoreNonFav.breakdown.favorite).toBeUndefined();
      expect(scoreFav.totalScore - scoreNonFav.totalScore).toBe(DEFAULT_FLOW_WEIGHTS.favoriteBonus);
    });

    it('applies skip penalty and softens upon meaningful listen', () => {
      const candidate = mockSongs[1];
      const context: FlowContext = {
        currentSong: mockSongs[0],
        queue: [mockSongs[0]],
        queueIndex: 0,
        playbackHistory: [],
        allSongs: mockSongs,
        downloadedSongIds: new Set(),
        isOnline: true,
        weights: { explorationJitter: 0 }
      };

      const baselineScore = auraFlowService.scoreCandidate(candidate, context.currentSong, context, DEFAULT_FLOW_WEIGHTS);

      // User skips this track
      auraFlowService.recordSkip(candidate.id, candidate.artist);
      const skippedScore = auraFlowService.scoreCandidate(candidate, context.currentSong, context, DEFAULT_FLOW_WEIGHTS);

      expect(skippedScore.breakdown.skipPenalty).toBeDefined();
      expect(skippedScore.totalScore).toBeLessThan(baselineScore.totalScore);

      // Meaningful listen softens the skip penalty
      auraFlowService.recordMeaningfulListen(candidate.id);
      const softenedScore = auraFlowService.scoreCandidate(candidate, context.currentSong, context, DEFAULT_FLOW_WEIGHTS);
      expect(softenedScore.totalScore).toBeGreaterThan(skippedScore.totalScore);
    });

    it('applies artist repetition penalty when same artist was played repeatedly in recent history', () => {
      const candidate = mockSongs[1]; // Anirudh
      const context: FlowContext = {
        currentSong: mockSongs[0],
        queue: [mockSongs[0]],
        queueIndex: 0,
        playbackHistory: [mockSongs[0].id], // Anirudh played right before
        allSongs: mockSongs,
        downloadedSongIds: new Set(),
        isOnline: true,
        weights: { explorationJitter: 0 }
      };

      const score = auraFlowService.scoreCandidate(candidate, context.currentSong, context, DEFAULT_FLOW_WEIGHTS);
      expect(score.breakdown.artistRepeatPenalty).toBe(-DEFAULT_FLOW_WEIGHTS.artistRepeatPenalty);
    });
  });

  describe('Top-3 Weighted Selection', () => {
    it('returns single candidate directly if only one available', () => {
      const candidate = mockSongs[0];
      const selected = auraFlowService.selectNextTrack([{ song: candidate, totalScore: 100, breakdown: {} }]);
      expect(selected?.id).toBe(candidate.id);
    });

    it('returns null when candidates list is empty', () => {
      const selected = auraFlowService.selectNextTrack([]);
      expect(selected).toBeNull();
    });

    it('selects from top 3 candidates without throwing', () => {
      const scored = [
        { song: mockSongs[0], totalScore: 90, breakdown: {} },
        { song: mockSongs[1], totalScore: 80, breakdown: {} },
        { song: mockSongs[2], totalScore: 70, breakdown: {} },
        { song: mockSongs[3], totalScore: 20, breakdown: {} }
      ];

      const picks = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const picked = auraFlowService.selectNextTrack(scored);
        if (picked) picks.add(picked.id);
      }

      // Top 3 should be selected, but never 4th (rank 4)
      expect(picks.has(mockSongs[3].id)).toBe(false);
      expect(picks.has(mockSongs[0].id)).toBe(true);
    });
  });

  describe('Player Store Queue Integration', () => {
    beforeEach(() => {
      usePlayerStore.setState({
        isAuraFlow: false,
        queue: [],
        queueIndex: -1,
        currentSong: null,
        playbackHistory: [],
        shuffledQueueOrder: [],
        isShuffle: false
      });
      useLibraryStore.setState({
        songs: mockSongs,
        downloadedSongIds: new Set(),
        isOnline: true
      });
    });

    it('defaults to isAuraFlow = false and preserves existing queue-end pause', () => {
      const pauseSpy = vi.spyOn(audioService, 'pause').mockImplementation(() => {});

      usePlayerStore.setState({
        isAuraFlow: false,
        queue: [mockSongs[0]],
        queueIndex: 0,
        currentSong: mockSongs[0]
      });

      // Call nextSong when queue has no further songs
      usePlayerStore.getState().nextSong();

      // Audio must pause and queue must not be extended
      expect(pauseSpy).toHaveBeenCalled();
      expect(usePlayerStore.getState().queue.length).toBe(1);
    });

    it('when Aura Flow is ON, automatically continues playback when queue ends', () => {
      const playSpy = vi.spyOn(audioService, 'playSong').mockResolvedValue();

      usePlayerStore.setState({
        isAuraFlow: true,
        queue: [mockSongs[0]],
        queueIndex: 0,
        currentSong: mockSongs[0]
      });

      // Call nextSong when queue reaches end
      usePlayerStore.getState().nextSong();

      const state = usePlayerStore.getState();
      expect(state.queue.length).toBe(2);
      expect(state.queueIndex).toBe(1);
      expect(state.currentSong?.isAuraFlow).toBe(true);
      expect(playSpy).toHaveBeenCalled();
    });

    it('preserves strict manual queue priority over auto-generated Aura Flow tracks', () => {
      const flowSong: Song = { ...mockSongs[1], isAuraFlow: true };
      const manualSong: Song = { ...mockSongs[2], isAuraFlow: false };

      usePlayerStore.setState({
        isAuraFlow: true,
        queue: [mockSongs[0], flowSong],
        queueIndex: 0,
        currentSong: mockSongs[0]
      });

      // User adds a manual song to queue end
      usePlayerStore.getState().addToQueueEnd(manualSong);

      const queue = usePlayerStore.getState().queue;
      // manualSong must be placed BEFORE the upcoming Aura Flow track
      expect(queue[1].id).toBe(manualSong.id);
      expect(queue[2].id).toBe(flowSong.id);
    });

    it('turning Aura Flow OFF cleans up any upcoming unplayed Aura Flow tracks', () => {
      const flowSong: Song = { ...mockSongs[1], isAuraFlow: true };

      usePlayerStore.setState({
        isAuraFlow: true,
        queue: [mockSongs[0], flowSong],
        queueIndex: 0,
        currentSong: mockSongs[0]
      });

      expect(usePlayerStore.getState().queue.length).toBe(2);

      // User turns Aura Flow OFF
      usePlayerStore.getState().toggleAuraFlow();

      const state = usePlayerStore.getState();
      expect(state.isAuraFlow).toBe(false);
      // Upcoming flowSong should be stripped
      expect(state.queue.length).toBe(1);
      expect(state.queue[0].id).toBe(mockSongs[0].id);
    });
  });
});
