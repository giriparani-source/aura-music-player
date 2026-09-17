import { create } from 'zustand';
import { Song, RepeatMode, NowPlayingTab, SpatialPreset } from '../types/music';
import { audioService } from '../services/audioService';
import { audioEffectsService, BassExciterLevel } from '../services/audioEffectsService';
import { sleepTimerService, SleepTimerPreset } from '../services/sleepTimerService';
import { musicDB } from '../services/db';
import { useLibraryStore, onFavoriteChanged, registerSongLookup } from './useLibraryStore';
import { generateFairShuffleIndices, generatePureRandomIndices } from '../utils/fairShuffle';
import { auraFlowService, FlowContext, DiscoveryPreference } from '../services/auraFlowService';

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

  // Aura Flow: Continuous Smart Autoplay
  isAuraFlow: boolean;
  discoveryPreference: DiscoveryPreference;

  // Smart Sleep Timer
  sleepTimerRemaining: number | null;
  sleepTimerMode: SleepTimerPreset;

  // Audiophile Pro DSP
  isLimiterActive: boolean;
  bassExciterLevel: BassExciterLevel;
  isSubsonicActive: boolean;

  // History stack for predictable previous navigation
  playbackHistory: string[];

  // Actions
  playSong: (song: Song, customQueue?: Song[], targetIndex?: number) => Promise<void>;
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
  toggleAuraFlow: () => void;
  setAuraFlow: (enabled: boolean) => void;
  setDiscoveryPreference: (preference: DiscoveryPreference) => Promise<void>;
  resetAuraMemory: () => Promise<void>;
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

  // Sleep Timer Actions
  setSleepTimer: (preset: SleepTimerPreset, customMinutes?: number) => void;
  cancelSleepTimer: () => void;

  // Audiophile Pro Actions
  toggleLimiter: () => void;
  setBassExciterLevel: (level: BassExciterLevel) => void;
  toggleSubsonicFilter: () => void;
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
      spatialMix: audioEffectsService.getSpatialMix(),
      isLimiterActive: audioEffectsService.isLimiterEnabled(),
      bassExciterLevel: audioEffectsService.getBassExciterLevel(),
      isSubsonicActive: audioEffectsService.isSubsonicFilterActive()
    });
  });

  // Wire up sleepTimerService subscriber
  sleepTimerService.subscribe((state) => {
    set({
      sleepTimerRemaining: state.remainingSeconds,
      sleepTimerMode: state.mode
    });
  });

  // Meaningful Listen Threshold Callback
  audioService.setOnMeaningfulListen((song) => {
    musicDB.incrementPlayCount(song.id).catch((err) => {
      console.warn('Failed to increment play count:', err);
    });
    auraFlowService.recordMeaningfulListen(song.id);
  });

  // Auto-advance to next song when current track ends
  audioService.setOnSongEnd(() => {
    const current = get().currentSong;
    if (current) {
      auraFlowService.recordCompletedListen(current.id);
    }
    get().nextSong();
  });

  // Synchronize favorites between library/db and player store (currentSong & queue)
  onFavoriteChanged((songId, isFavorite) => {
    if (isFavorite) {
      auraFlowService.recordFavorite(songId);
    }
    const { currentSong, queue } = get();
    const updatedQueue = queue.map((s) => (s.id === songId ? { ...s, isFavorite } : s));
    const updatedCurrent = currentSong && currentSong.id === songId ? { ...currentSong, isFavorite } : currentSong;
    set({
      currentSong: updatedCurrent,
      queue: updatedQueue
    });
  });

  registerSongLookup((id) => {
    const { currentSong, queue } = get();
    if (currentSong && currentSong.id === id) return currentSong;
    return queue.find((s) => s.id === id);
  });

  // Aura Flow buffer helper: maintains max 1 upcoming track buffer when queue is nearing end
  const ensureAuraFlowBuffer = () => {
    const state = get();
    if (!state.isAuraFlow || !state.currentSong || state.queue.length === 0) return;

    // In shuffle mode, check position within shuffled order; in sequential mode, check queueIndex
    const currentPos =
      state.isShuffle && state.shuffledQueueOrder && state.shuffledQueueOrder.length === state.queue.length
        ? state.shuffledQueueOrder.indexOf(state.queueIndex)
        : -1;

    const upcomingCount =
      state.isShuffle && currentPos !== -1
        ? state.shuffledQueueOrder.length - 1 - currentPos
        : state.queue.length - 1 - state.queueIndex;

    if (upcomingCount <= 0) {
      const libState = useLibraryStore.getState();
      const context: FlowContext = {
        currentSong: state.currentSong,
        queue: state.queue,
        queueIndex: state.queueIndex,
        playbackHistory: state.playbackHistory,
        allSongs: libState.songs || [],
        downloadedSongIds: libState.downloadedSongIds || new Set(),
        isOnline: libState.isOnline ?? true
      };

      const nextTrack = auraFlowService.getNextTrack(context);
      if (nextTrack) {
        const flowSong: Song = {
          ...nextTrack,
          isAuraFlow: true,
          auraReason: nextTrack.auraReason
        };
        const newQueue = [...state.queue, flowSong];
        let newShuffleOrder = state.shuffledQueueOrder;
        if (state.isShuffle && newShuffleOrder && newShuffleOrder.length > 0) {
          newShuffleOrder = [...newShuffleOrder, newQueue.length - 1];
        }
        set({ queue: newQueue, shuffledQueueOrder: newShuffleOrder });
      }
    }
  };

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
    isAuraFlow: false,
    discoveryPreference: auraFlowService.getDiscoveryPreference(),
    sleepTimerRemaining: sleepTimerService.getRemainingSeconds(),
    sleepTimerMode: sleepTimerService.getMode(),
    isLimiterActive: audioEffectsService.isLimiterEnabled(),
    bassExciterLevel: audioEffectsService.getBassExciterLevel(),
    isSubsonicActive: audioEffectsService.isSubsonicFilterActive(),
    playbackHistory: [],

    playSong: async (song: Song, customQueue?: Song[], targetIndex?: number) => {
      const { queue, currentSong, playbackHistory, isShuffle, isFairShuffle } = get();

      let newQueue = queue;
      let newIndex = 0;
      let queueChanged = false;

      if (customQueue && customQueue.length > 0) {
        newQueue = customQueue;
        if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < customQueue.length) {
          newIndex = targetIndex;
        } else {
          newIndex = customQueue.findIndex((s) => s.id === song.id);
          if (newIndex === -1) newIndex = 0;
        }
        queueChanged = true;
      } else if (queue.length === 0) {
        newQueue = [song];
        newIndex = 0;
        queueChanged = true;
      } else {
        if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < queue.length) {
          newIndex = targetIndex;
        } else {
          const found = queue.findIndex((s) => s.id === song.id);
          if (found !== -1) {
            newIndex = found;
          } else {
            newQueue = [...queue, song];
            newIndex = newQueue.length - 1;
            queueChanged = true;
          }
        }
      }

      // BUG-22 fix: Cap playback history to 200 entries to prevent memory growth
      const updatedHistory = (currentSong ? [...playbackHistory, currentSong.id] : playbackHistory).slice(-200);

      if (song.isOnline) {
        useLibraryStore.getState().registerOnlineSong(song).catch(() => {});
      }

      // BUG-11 fix: Only regenerate shuffle order if the queue actually changed,
      // or if there is no valid existing shuffle order containing the target index.
      // Clicking a song inside the existing queue keeps the current shuffle sequence!
      const currentOrder = get().shuffledQueueOrder;
      const needsRegenerate =
        queueChanged ||
        !currentOrder ||
        currentOrder.length !== newQueue.length ||
        !currentOrder.includes(newIndex);

      let resolvedShuffleOrder: number[] = currentOrder || [];
      if (isShuffle && newQueue.length > 0 && needsRegenerate) {
        resolvedShuffleOrder = isFairShuffle
          ? generateFairShuffleIndices(newQueue, newIndex)
          : generatePureRandomIndices(newQueue.length, newIndex);
      }

      set({
        currentSong: song,
        queue: newQueue,
        queueIndex: newIndex,
        playbackHistory: updatedHistory,
        shuffledQueueOrder: resolvedShuffleOrder
      });

      await audioService.playSong(song);
      if (song.isAuraFlow) {
        auraFlowService.recordAuraTrackStart(song);
      }
      if (get().isAuraFlow) {
        setTimeout(() => ensureAuraFlowBuffer(), 100);
      }
    },

    playBatch: async (songs: Song[]) => {
      if (songs.length === 0) return;
      if (songs[0].isOnline) {
        useLibraryStore.getState().registerOnlineSong(songs[0]).catch(() => {});
      }
      // Reset shuffle order so nextSong regenerates it cleanly for the new queue.
      set({
        queue: [...songs],
        queueIndex: 0,
        currentSong: songs[0],
        playbackHistory: [],
        shuffledQueueOrder: []
      });
      await audioService.playSong(songs[0]);
      if (get().isAuraFlow) {
        setTimeout(() => ensureAuraFlowBuffer(), 100);
      }
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
      const {
        queue,
        queueIndex,
        isShuffle,
        isFairShuffle,
        repeatMode,
        currentSong,
        playbackHistory,
        currentTime,
        isAuraFlow
      } = get();

      if (queue.length === 0) return;

      // Feedback: Quick skip (< 15 seconds)
      if (currentSong && currentTime < 15) {
        auraFlowService.recordSkip(currentSong.id, currentSong.artist);
      }

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
        } else if (isAuraFlow) {
          // Reached shuffle queue end with Aura Flow ON: generate next song
          const libState = useLibraryStore.getState();
          const context: FlowContext = {
            currentSong,
            queue,
            queueIndex,
            playbackHistory,
            allSongs: libState.songs || [],
            downloadedSongIds: libState.downloadedSongIds || new Set(),
            isOnline: libState.isOnline ?? true
          };
          const nextTrack = auraFlowService.getNextTrack(context);
          if (nextTrack) {
            const flowSong: Song = { ...nextTrack, isAuraFlow: true, auraReason: nextTrack.auraReason };
            const newQueue = [...queue, flowSong];
            const nextIdx = newQueue.length - 1;
            const newOrder = [...order, nextIdx];
            const updatedHistory = (currentSong ? [...playbackHistory, currentSong.id] : playbackHistory).slice(-200);
            set({
              queue: newQueue,
              queueIndex: nextIdx,
              shuffledQueueOrder: newOrder,
              currentSong: flowSong,
              playbackHistory: updatedHistory
            });
            audioService.playSong(flowSong);
            auraFlowService.recordAuraTrackStart(flowSong);
            setTimeout(() => ensureAuraFlowBuffer(), 100);
            return;
          } else {
            audioService.pause();
            return;
          }
        } else {
          audioService.pause();
          return;
        }
      } else {
        if (queueIndex < queue.length - 1) {
          nextIndex = queueIndex + 1;
        } else if (repeatMode === 'all') {
          nextIndex = 0;
        } else if (isAuraFlow) {
          // Reached sequential queue end with Aura Flow ON: generate next song
          const libState = useLibraryStore.getState();
          const context: FlowContext = {
            currentSong,
            queue,
            queueIndex,
            playbackHistory,
            allSongs: libState.songs || [],
            downloadedSongIds: libState.downloadedSongIds || new Set(),
            isOnline: libState.isOnline ?? true
          };
          const nextTrack = auraFlowService.getNextTrack(context);
          if (nextTrack) {
            const flowSong: Song = { ...nextTrack, isAuraFlow: true, auraReason: nextTrack.auraReason };
            const newQueue = [...queue, flowSong];
            const nextIdx = newQueue.length - 1;
            const updatedHistory = (currentSong ? [...playbackHistory, currentSong.id] : playbackHistory).slice(-200);
            set({
              queue: newQueue,
              queueIndex: nextIdx,
              currentSong: flowSong,
              playbackHistory: updatedHistory
            });
            audioService.playSong(flowSong);
            auraFlowService.recordAuraTrackStart(flowSong);
            setTimeout(() => ensureAuraFlowBuffer(), 100);
            return;
          } else {
            audioService.pause();
            return;
          }
        } else {
          audioService.pause();
          return;
        }
      }

      const nextSongItem = queue[nextIndex];
      if (nextSongItem) {
        const updatedHistory = (currentSong ? [...playbackHistory, currentSong.id] : playbackHistory).slice(-200);
        set({
          currentSong: nextSongItem,
          queueIndex: nextIndex,
          playbackHistory: updatedHistory
        });
        audioService.playSong(nextSongItem);
        if (nextSongItem.isAuraFlow) {
          auraFlowService.recordAuraTrackStart(nextSongItem);
        }
        if (get().isAuraFlow) {
          setTimeout(() => ensureAuraFlowBuffer(), 100);
        }
      }
    },

    previousSong: () => {
      const { queue, queueIndex, playbackHistory, currentTime, isShuffle, shuffledQueueOrder, currentSong } = get();
      if (queue.length === 0) return;

      // Feedback: replay signal
      if (currentSong) {
        auraFlowService.recordReplay(currentSong.id);
      }

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

    toggleAuraFlow: () => {
      const nextAuraFlow = !get().isAuraFlow;
      if (!nextAuraFlow) {
        // Turning OFF: clean up any upcoming unplayed Aura Flow tracks
        const { queue, queueIndex, shuffledQueueOrder } = get();
        const cleanedQueue = queue.filter((song, idx) => idx <= queueIndex || !song.isAuraFlow);

        // BUG-04 fix: Rebuild shuffledQueueOrder to match the cleaned queue
        let newShuffleOrder = shuffledQueueOrder;
        if (newShuffleOrder && newShuffleOrder.length > 0) {
          // Build old-index -> new-index remap
          const indexRemap = new Map<number, number>();
          let newIdx = 0;
          for (let oldIdx = 0; oldIdx < queue.length; oldIdx++) {
            if (oldIdx <= queueIndex || !queue[oldIdx].isAuraFlow) {
              indexRemap.set(oldIdx, newIdx++);
            }
          }
          newShuffleOrder = newShuffleOrder
            .filter((i) => indexRemap.has(i))
            .map((i) => indexRemap.get(i)!);
        }

        set({ isAuraFlow: false, queue: cleanedQueue, shuffledQueueOrder: newShuffleOrder });
      } else {
        set({ isAuraFlow: true });
        ensureAuraFlowBuffer();
      }
    },

    setAuraFlow: (enabled: boolean) => {
      if (!enabled) {
        const { queue, queueIndex, shuffledQueueOrder } = get();
        const cleanedQueue = queue.filter((song, idx) => idx <= queueIndex || !song.isAuraFlow);

        // BUG-04 fix: Rebuild shuffledQueueOrder to match the cleaned queue
        let newShuffleOrder = shuffledQueueOrder;
        if (newShuffleOrder && newShuffleOrder.length > 0) {
          const indexRemap = new Map<number, number>();
          let newIdx = 0;
          for (let oldIdx = 0; oldIdx < queue.length; oldIdx++) {
            if (oldIdx <= queueIndex || !queue[oldIdx].isAuraFlow) {
              indexRemap.set(oldIdx, newIdx++);
            }
          }
          newShuffleOrder = newShuffleOrder
            .filter((i) => indexRemap.has(i))
            .map((i) => indexRemap.get(i)!);
        }

        set({ isAuraFlow: false, queue: cleanedQueue, shuffledQueueOrder: newShuffleOrder });
      } else {
        set({ isAuraFlow: true });
        ensureAuraFlowBuffer();
      }
    },

    setDiscoveryPreference: async (preference: DiscoveryPreference) => {
      set({ discoveryPreference: preference });
      await auraFlowService.setDiscoveryPreference(preference);
    },

    resetAuraMemory: async () => {
      await auraFlowService.resetAuraMemory();
      set({ discoveryPreference: 'balanced' });
    },

    addToQueueNext: (song: Song) => {
      const { queue, queueIndex, shuffledQueueOrder } = get();
      const insertAt = queueIndex + 1;
      const newQueue = [...queue];
      newQueue.splice(insertAt, 0, song);
      let newShuffleOrder = shuffledQueueOrder;
      if (newShuffleOrder && newShuffleOrder.length > 0) {
        // Shift all indices >= insertAt by 1 to account for the new song
        newShuffleOrder = newShuffleOrder.map((i) => (i >= insertAt ? i + 1 : i));
        // BUG-03 fix: Insert new index right AFTER current position in shuffle order
        // (not at the end) so it actually plays next in shuffle mode
        const currentShufflePos = newShuffleOrder.indexOf(queueIndex);
        if (currentShufflePos !== -1) {
          newShuffleOrder.splice(currentShufflePos + 1, 0, insertAt);
        } else {
          newShuffleOrder.push(insertAt);
        }
      }
      set({ queue: newQueue, shuffledQueueOrder: newShuffleOrder });
    },

    addToQueueEnd: (song: Song) => {
      set((state) => {
        // Manual queue priority: If there are upcoming aura flow tracks, insert before them
        const upcomingStart = state.queueIndex + 1;
        const firstFlowIdx = state.queue.findIndex((s, idx) => idx >= upcomingStart && s.isAuraFlow);

        let newQueue: Song[];
        let insertAt: number;

        if (firstFlowIdx !== -1) {
          insertAt = firstFlowIdx;
          newQueue = [...state.queue];
          newQueue.splice(insertAt, 0, song);
        } else {
          insertAt = state.queue.length;
          newQueue = [...state.queue, song];
        }

        let newShuffleOrder = state.shuffledQueueOrder;
        if (newShuffleOrder && newShuffleOrder.length > 0) {
          newShuffleOrder = newShuffleOrder.map((i) => (i >= insertAt ? i + 1 : i));
          newShuffleOrder.push(insertAt);
        }

        return { queue: newQueue, shuffledQueueOrder: newShuffleOrder };
      });
    },

    addMultipleToQueue: (songs: Song[]) => {
      if (songs.length === 0) return;
      set((state) => {
        const upcomingStart = state.queueIndex + 1;
        const firstFlowIdx = state.queue.findIndex((s, idx) => idx >= upcomingStart && s.isAuraFlow);

        let newQueue: Song[];
        let insertAt: number;

        if (firstFlowIdx !== -1) {
          insertAt = firstFlowIdx;
          newQueue = [...state.queue];
          newQueue.splice(insertAt, 0, ...songs);
        } else {
          insertAt = state.queue.length;
          newQueue = [...state.queue, ...songs];
        }

        let newShuffleOrder = state.shuffledQueueOrder;
        if (newShuffleOrder && newShuffleOrder.length > 0) {
          newShuffleOrder = newShuffleOrder.map((i) => (i >= insertAt ? i + songs.length : i));
          const newIndices = songs.map((_, i) => insertAt + i);
          newShuffleOrder.push(...newIndices);
        }

        return { queue: newQueue, shuffledQueueOrder: newShuffleOrder };
      });
    },

    removeFromQueue: (index: number) => {
      const state = get();
      const isCurrentSong = index === state.queueIndex;
      const wasPlaying = state.isPlaying;

      const newQueue = [...state.queue];
      newQueue.splice(index, 1);

      if (newQueue.length === 0) {
        audioService.pause();
        set({
          queue: [],
          queueIndex: -1,
          currentSong: null,
          isPlaying: false,
          shuffledQueueOrder: []
        });
        return;
      }

      let newIndex = state.queueIndex;
      if (index < state.queueIndex) {
        newIndex--;
      } else if (index === state.queueIndex && newIndex >= newQueue.length) {
        newIndex = Math.max(0, newQueue.length - 1);
      }

      let newShuffleOrder = state.shuffledQueueOrder;
      if (newShuffleOrder && newShuffleOrder.length > 0) {
        newShuffleOrder = newShuffleOrder
          .filter((i) => i !== index)
          .map((i) => (i > index ? i - 1 : i));
      }

      const nextSongToPlay = isCurrentSong ? newQueue[newIndex] : state.currentSong;

      set({
        queue: newQueue,
        queueIndex: newIndex,
        currentSong: nextSongToPlay,
        shuffledQueueOrder: newShuffleOrder
      });

      // BUG-05 fix: If the removed song was the currently playing song, advance playback or pause
      if (isCurrentSong && nextSongToPlay) {
        if (wasPlaying) {
          audioService.playSong(nextSongToPlay);
        } else {
          audioService.pause();
        }
      }
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
    },

    setSleepTimer: (preset: SleepTimerPreset, customMinutes?: number) => {
      sleepTimerService.setSleepTimer(preset, customMinutes);
    },

    cancelSleepTimer: () => {
      sleepTimerService.cancelSleepTimer();
    },

    toggleLimiter: () => {
      const next = audioEffectsService.toggleLimiter();
      set({ isLimiterActive: next });
    },

    setBassExciterLevel: (level: BassExciterLevel) => {
      audioEffectsService.setBassExciterLevel(level);
      set({ bassExciterLevel: level });
    },

    toggleSubsonicFilter: () => {
      const next = audioEffectsService.toggleSubsonicFilter();
      set({ isSubsonicActive: next });
    }
  };
});

// Asynchronously hydrate discovery preference from IndexedDB without blocking startup
if (typeof window !== 'undefined') {
  auraFlowService.initDiscoveryPreference().then((pref) => {
    usePlayerStore.setState({ discoveryPreference: pref });
  }).catch(() => {
    // Fail gracefully, keep in-memory 'balanced' default
  });
}


