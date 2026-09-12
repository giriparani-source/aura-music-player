import { create } from 'zustand';
import { Song, RepeatMode, NowPlayingTab, SpatialPreset } from '../types/music';
import { audioService } from '../services/audioService';
import { audioEffectsService } from '../services/audioEffectsService';
import { musicDB } from '../services/db';
import { useLibraryStore } from './useLibraryStore';
import { generateFairShuffleIndices, generatePureRandomIndices } from '../utils/fairShuffle';

interface PlayerStoreState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isFairShuffle: boolean;
  shuffledQueueOrder: number[];
  queue: Song[];
  queueIndex: number;
  isNowPlayingOpen: boolean;
  activeModalTab: NowPlayingTab;
  isQueueOpen: boolean;
  errorMessage: string | null;
  isKaraoke: boolean;
  karaokeDepth: number;
  spatialPreset: SpatialPreset;
  spatialMix: number;
  crossfadeSeconds: number;
  isAiAssistantOpen: boolean;
  aiEqStatus: string | null;

  // History stack for predictable previous navigation
  playbackHistory: string[];

  // Actions
  playSong: (song: Song, customQueue?: Song[]) => Promise<void>;
  playBatch: (songs: Song[]) => Promise<void>;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (level: number) => void;
  toggleMute: () => void;
  nextSong: () => void;
  previousSong: () => void;
  toggleShuffle: () => void;
  toggleFairShuffle: () => void;
  cycleRepeat: () => void;
  addToQueueNext: (song: Song) => void;
  addToQueueEnd: (song: Song) => void;
  addMultipleToQueue: (songs: Song[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setNowPlayingOpen: (open: boolean) => void;
  setActiveModalTab: (tab: NowPlayingTab) => void;
  openWithTab: (tab: NowPlayingTab) => void;
  setQueueOpen: (open: boolean) => void;
  clearError: () => void;
  toggleKaraoke: () => void;
  setKaraokeDepth: (depth: number) => void;
  setSpatialPreset: (preset: SpatialPreset) => void;
  setSpatialMix: (mix: number) => void;
  setCrossfadeSeconds: (seconds: number) => void;
  setAiAssistantOpen: (open: boolean) => void;
  autoTuneCurrentSong: () => void;
}

export const usePlayerStore = create<PlayerStoreState>((set, get) => {
  // Wire up audioService state subscriber
  audioService.subscribe((state) => {
    set({
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      duration: state.duration,
      volume: state.volume,
      isMuted: state.isMuted,
      errorMessage: state.error
    });
  });

  // Wire up audioEffectsService subscriber for real-time DSP state sync
  audioEffectsService.subscribe(() => {
    set({
      isKaraoke: audioEffectsService.isKaraokeEnabled(),
      karaokeDepth: audioEffectsService.getKaraokeDepth(),
      spatialPreset: audioEffectsService.getSpatialPreset(),
      spatialMix: audioEffectsService.getSpatialMix()
    });
  });

  // Meaningful Listen Threshold Callback
  audioService.setOnMeaningfulListen((song) => {
    musicDB.incrementPlayCount(song.id).catch((err) => {
      console.warn('Failed to increment play count:', err);
    });
  });

  return {
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    repeatMode: 'off',
    isShuffle: false,
    isFairShuffle: true,
    shuffledQueueOrder: [],
    queue: [],
    queueIndex: -1,
    isNowPlayingOpen: false,
    activeModalTab: 'artwork',
    isQueueOpen: false,
    errorMessage: null,
    isKaraoke: audioEffectsService.isKaraokeEnabled(),
    karaokeDepth: audioEffectsService.getKaraokeDepth(),
    spatialPreset: audioEffectsService.getSpatialPreset(),
    spatialMix: audioEffectsService.getSpatialMix(),
    crossfadeSeconds: audioService.getCrossfadeSeconds(),
    isAiAssistantOpen: false,
    aiEqStatus: null,
    playbackHistory: [],

    playSong: async (song: Song, customQueue?: Song[]) => {
      const { queue, currentSong, playbackHistory } = get();

      let newQueue = queue;
      let newIndex = 0;

      if (customQueue && customQueue.length > 0) {
        newQueue = customQueue;
        newIndex = customQueue.findIndex((s) => s.id === song.id);
        if (newIndex === -1) newIndex = 0;
      } else if (queue.length === 0) {
        newQueue = [song];
        newIndex = 0;
      } else {
        const found = queue.findIndex((s) => s.id === song.id);
        if (found !== -1) {
          newIndex = found;
        } else {
          newQueue = [...queue, song];
          newIndex = newQueue.length - 1;
        }
      }

      const updatedHistory = currentSong ? [...playbackHistory, currentSong.id] : playbackHistory;

      if (song.isOnline) {
        useLibraryStore.getState().registerOnlineSong(song).catch(() => {});
      }

      set({
        currentSong: song,
        queue: newQueue,
        queueIndex: newIndex,
        playbackHistory: updatedHistory
      });

      await audioService.playSong(song);
    },

    playBatch: async (songs: Song[]) => {
      if (songs.length === 0) return;
      if (songs[0].isOnline) {
        useLibraryStore.getState().registerOnlineSong(songs[0]).catch(() => {});
      }
      set({
        queue: [...songs],
        queueIndex: 0,
        currentSong: songs[0],
        playbackHistory: []
      });
      await audioService.playSong(songs[0]);
    },

    togglePlay: () => {
      const { currentSong } = get();
      audioService.togglePlay(currentSong);
    },

    seek: (seconds: number) => {
      audioService.seek(seconds);
    },

    setVolume: (level: number) => {
      audioService.setVolume(level);
    },

    toggleMute: () => {
      audioService.toggleMute();
    },

    nextSong: () => {
      const { queue, queueIndex, isShuffle, isFairShuffle, repeatMode, currentSong, playbackHistory } = get();
      if (queue.length === 0) return;

      if (repeatMode === 'one' && currentSong) {
        audioService.seek(0);
        audioService.resume();
        return;
      }

      let nextIndex: number;

      if (isShuffle) {
        let order = get().shuffledQueueOrder;
        if (!order || order.length !== queue.length) {
          order = isFairShuffle
            ? generateFairShuffleIndices(queue, queueIndex >= 0 ? queueIndex : 0)
            : generatePureRandomIndices(queue.length, queueIndex >= 0 ? queueIndex : 0);
          set({ shuffledQueueOrder: order });
        }
        const currentPos = order.indexOf(queueIndex);
        if (currentPos !== -1 && currentPos < order.length - 1) {
          nextIndex = order[currentPos + 1];
        } else if (repeatMode === 'all') {
          const freshOrder = isFairShuffle
            ? generateFairShuffleIndices(queue, 0)
            : generatePureRandomIndices(queue.length, 0);
          set({ shuffledQueueOrder: freshOrder });
          nextIndex = freshOrder[0];
        } else {
          audioService.pause();
          return;
        }
      } else {
        if (queueIndex < queue.length - 1) {
          nextIndex = queueIndex + 1;
        } else if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          audioService.pause();
          return;
        }
      }

      const nextSong = queue[nextIndex];
      if (nextSong) {
        const updatedHistory = currentSong ? [...playbackHistory, currentSong.id] : playbackHistory;
        set({
          currentSong: nextSong,
          queueIndex: nextIndex,
          playbackHistory: updatedHistory
        });
        audioService.playSong(nextSong);
      }
    },

    previousSong: () => {
      const { queue, queueIndex, playbackHistory, currentTime, isShuffle, shuffledQueueOrder } = get();
      if (queue.length === 0) return;

      // If playing past 3 seconds, restart current song first
      if (currentTime > 3) {
        audioService.seek(0);
        return;
      }

      // If we have playback history, pop the last played song
      if (playbackHistory.length > 0) {
        const lastSongId = playbackHistory[playbackHistory.length - 1];
        const lastIndex = queue.findIndex((s) => s.id === lastSongId);
        if (lastIndex !== -1) {
          const prevSong = queue[lastIndex];
          set({
            currentSong: prevSong,
            queueIndex: lastIndex,
            playbackHistory: playbackHistory.slice(0, -1)
          });
          audioService.playSong(prevSong);
          return;
        }
      }

      // Otherwise fall back to previous index
      let prevIndex = queueIndex - 1;
      if (isShuffle && shuffledQueueOrder && shuffledQueueOrder.length === queue.length) {
        const currentPos = shuffledQueueOrder.indexOf(queueIndex);
        if (currentPos > 0) {
          prevIndex = shuffledQueueOrder[currentPos - 1];
        }
      } else if (prevIndex < 0) {
        prevIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
      }

      const prevSong = queue[prevIndex];
      if (prevSong) {
        set({
          currentSong: prevSong,
          queueIndex: prevIndex,
          playbackHistory: playbackHistory.slice(0, -1)
        });
        audioService.playSong(prevSong);
      }
    },

    toggleShuffle: () => {
      const nextShuffle = !get().isShuffle;
      const { queue, queueIndex, isFairShuffle } = get();
      let newOrder: number[] = [];
      if (nextShuffle && queue.length > 0) {
        newOrder = isFairShuffle
          ? generateFairShuffleIndices(queue, queueIndex >= 0 ? queueIndex : 0)
          : generatePureRandomIndices(queue.length, queueIndex >= 0 ? queueIndex : 0);
      }
      set({ isShuffle: nextShuffle, shuffledQueueOrder: newOrder });
    },

    toggleFairShuffle: () => {
      const nextFair = !get().isFairShuffle;
      const { queue, queueIndex, isShuffle } = get();
      let newOrder: number[] = [];
      if (isShuffle && queue.length > 0) {
        newOrder = nextFair
          ? generateFairShuffleIndices(queue, queueIndex >= 0 ? queueIndex : 0)
          : generatePureRandomIndices(queue.length, queueIndex >= 0 ? queueIndex : 0);
      }
      set({ isFairShuffle: nextFair, shuffledQueueOrder: newOrder });
    },

    cycleRepeat: () => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const current = get().repeatMode;
      const nextMode = modes[(modes.indexOf(current) + 1) % modes.length];
      audioService.setLoop(nextMode === 'one');
      set({ repeatMode: nextMode });
    },

    addToQueueNext: (song: Song) => {
      const { queue, queueIndex } = get();
      const newQueue = [...queue];
      newQueue.splice(queueIndex + 1, 0, song);
      set({ queue: newQueue });
    },

    addToQueueEnd: (song: Song) => {
      set((state) => ({ queue: [...state.queue, song] }));
    },

    addMultipleToQueue: (songs: Song[]) => {
      if (songs.length === 0) return;
      set((state) => ({ queue: [...state.queue, ...songs] }));
    },

    removeFromQueue: (index: number) => {
      set((state) => {
        const newQueue = [...state.queue];
        newQueue.splice(index, 1);
        let newIndex = state.queueIndex;
        if (index < state.queueIndex) {
          newIndex--;
        }
        return { queue: newQueue, queueIndex: newIndex };
      });
    },

    clearQueue: () => {
      set({ queue: [], queueIndex: -1, playbackHistory: [] });
    },

    setNowPlayingOpen: (open: boolean) => {
      set({ isNowPlayingOpen: open });
    },

    setActiveModalTab: (tab: NowPlayingTab) => {
      set({ activeModalTab: tab });
    },

    openWithTab: (tab: NowPlayingTab) => {
      set({ activeModalTab: tab, isNowPlayingOpen: true });
    },

    setQueueOpen: (open: boolean) => {
      set({ isQueueOpen: open });
    },

    clearError: () => {
      set({ errorMessage: null });
    },

    toggleKaraoke: () => {
      const next = audioEffectsService.toggleKaraoke();
      set({ isKaraoke: next, karaokeDepth: audioEffectsService.getKaraokeDepth() });
    },

    setKaraokeDepth: (depth: number) => {
      audioEffectsService.setKaraokeDepth(depth);
      set({
        karaokeDepth: audioEffectsService.getKaraokeDepth(),
        isKaraoke: audioEffectsService.isKaraokeEnabled()
      });
    },

    setSpatialPreset: (preset: SpatialPreset) => {
      audioEffectsService.setSpatialPreset(preset);
      set({ spatialPreset: preset });
    },

    setSpatialMix: (mix: number) => {
      audioEffectsService.setSpatialMix(mix);
      set({ spatialMix: audioEffectsService.getSpatialMix() });
    },

    setCrossfadeSeconds: (seconds: number) => {
      audioService.setCrossfadeSeconds(seconds);
      set({ crossfadeSeconds: audioService.getCrossfadeSeconds() });
    },

    setAiAssistantOpen: (open: boolean) => {
      set({ isAiAssistantOpen: open });
    },

    autoTuneCurrentSong: () => {
      const { currentSong } = get();
      if (!currentSong) return;
      const result = audioEffectsService.autoTuneForSong(currentSong.title, currentSong.artist);
      set({ aiEqStatus: result.profileName });
    }
  };
});
