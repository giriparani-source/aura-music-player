import { create } from 'zustand';
import { Song, RepeatMode, NowPlayingTab, SpatialPreset, ShuffleMode } from '../types/music';
import { audioService } from '../services/audioService';
import { audioEffectsService, BassExciterLevel } from '../services/audioEffectsService';
import { sleepTimerService, SleepTimerPreset } from '../services/sleepTimerService';
import { musicDB } from '../services/db';
import { useLibraryStore, onFavoriteChanged, registerSongLookup } from './useLibraryStore';
import { generateFairShuffleIndices, generatePureRandomIndices, reshuffleUpcomingIndices } from '../utils/fairShuffle';
import { auraFlowService, FlowContext, DiscoveryPreference } from '../services/auraFlowService';
import { playbackSessionService } from '../services/playbackSessionService';
import { isLocalTrack } from '../services/audioStreamResolver';
import { registerMediaActionHandler } from '../services/androidMediaBridge';

interface PlayerStoreState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  shuffleMode: ShuffleMode;
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
  setShuffleMode: (mode: ShuffleMode) => void;
  toggleFairShuffle: () => void;
  reshuffleQueue: () => void;
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

  // Session Persistence Actions
  restorePlaybackSession: () => Promise<boolean>;
  persistSessionImmediate: () => void;
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

    // Throttled session persistence during active playback (saves every 2.5–3s)
    const current = get();
    if (state.isPlaying && current.currentSong) {
      const session = playbackSessionService.createSession({
        currentSong: current.currentSong,
        currentTime: state.currentTime,
        duration: state.duration || current.currentSong.duration || 0,
        queue: current.queue,
        queueIndex: current.queueIndex,
        isShuffle: current.isShuffle,
        shuffleMode: current.shuffleMode,
        shuffledQueueOrder: current.shuffledQueueOrder,
        repeatMode: current.repeatMode
      });
      playbackSessionService.saveSessionThrottled(session);
    }
  });

  const persistCurrentSessionImmediate = () => {
    const current = get();
    if (!current.currentSong) return;
    const session = playbackSessionService.createSession({
      currentSong: current.currentSong,
      currentTime: current.currentTime,
      duration: current.duration || current.currentSong.duration || 0,
      queue: current.queue,
      queueIndex: current.queueIndex,
      isShuffle: current.isShuffle,
      shuffleMode: current.shuffleMode,
      shuffledQueueOrder: current.shuffledQueueOrder,
      repeatMode: current.repeatMode
    });
    playbackSessionService.saveSessionImmediate(session).catch(() => {});
  };

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

  // Central native media action handler (ExoPlayer ended, notification buttons, Bluetooth controls, lock screen)
  registerMediaActionHandler((action, position) => {
    switch (action) {
      case 'play':
      case 'resume':
        if (!get().isPlaying) get().togglePlay();
        break;
      case 'pause':
        if (get().isPlaying) get().togglePlay();
        break;
      case 'toggle':
        get().togglePlay();
        break;
      case 'next':
        get().nextSong();
        break;
      case 'previous':
        get().previousSong();
        break;
      case 'seek':
        if (typeof position === 'number') {
          // Native player already seeked ExoPlayer; update store currentTime without re-dispatching seekNative.
          set({ currentTime: position });
          if (!audioService.isUsingNativePlayer) {
            audioService.seek(position);
          }
        }
        break;
      case 'seekbackward':
        get().seek(Math.max(0, (get().currentTime || 0) - (position || 10)));
        break;
      case 'seekforward':
        get().seek((get().currentTime || 0) + (position || 10));
        break;
      case 'save_session':
        persistCurrentSessionImmediate();
        break;
    }
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
    if (!state.isAuraFlow || !state.currentSong || state.queue.length === 0 || isLocalTrack(state.currentSong)) return;

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
    shuffleMode: 'off',
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

      const isCurrentLocal = isLocalTrack(song);

      if (isCurrentLocal) {
        // Requirement 1: When a local song is played, automatically create a playback queue from the current Local Music list.
        // Requirement 6: Do not affect online streaming or mix local and online songs.
        if (customQueue && customQueue.length > 1) {
          const localOnlyQueue = customQueue.filter(isLocalTrack);
          newQueue = localOnlyQueue.length > 0 ? localOnlyQueue : [song];
          if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < newQueue.length) {
            newIndex = targetIndex;
          } else {
            newIndex = newQueue.findIndex((s) => s.id === song.id);
            if (newIndex === -1) newIndex = 0;
          }
          queueChanged = true;
        } else {
          // Single song clicked without a queue or single-item queue:
          // Build queue automatically from all available local songs in library!
          const librarySongs = useLibraryStore.getState().songs || [];
          const allLocal = librarySongs.filter(isLocalTrack);
          if (allLocal.length > 0) {
            const foundIdx = allLocal.findIndex((s) => s.id === song.id);
            if (foundIdx !== -1) {
              newQueue = allLocal;
              newIndex = foundIdx;
            } else {
              newQueue = [song, ...allLocal];
              newIndex = 0;
            }
          } else {
            newQueue = [song];
            newIndex = 0;
          }
          queueChanged = true;
        }
      } else {
        if (customQueue && customQueue.length > 0) {
          newQueue = customQueue;
          if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < customQueue.length) {
            newIndex = targetIndex;
          } else {
            newIndex = customQueue.findIndex((s) => s.id === song.id);
            if (newIndex === -1) newIndex = 0;
          }
          queueChanged = true;
        } else if (queue.length === 0 || queue.some(isLocalTrack)) {
          // If previous queue was local songs, replace queue with single online song
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

      const isDownloaded = Boolean(
        song.isDownloaded ||
        useLibraryStore.getState().downloadedSongIds.has(song.id)
      );
      const effectiveSong = isDownloaded
        ? {
            ...song,
            isDownloaded: true,
            isForegroundOnly: false,
            playbackMode: 'direct-catalog' as const,
            isDirectAudioStream: true
          }
        : song;

      set({
        currentSong: effectiveSong,
        queue: newQueue,
        queueIndex: newIndex,
        playbackHistory: updatedHistory,
        shuffledQueueOrder: resolvedShuffleOrder
      });

      await audioService.playSong(effectiveSong);
      if (effectiveSong.isAuraFlow) {
        auraFlowService.recordAuraTrackStart(effectiveSong);
      }
      if (get().isAuraFlow && !isCurrentLocal) {
        setTimeout(() => ensureAuraFlowBuffer(), 100);
      }
      persistCurrentSessionImmediate();
    },

    playBatch: async (songs: Song[]) => {
      if (songs.length === 0) return;
      if (songs[0].isOnline) {
        useLibraryStore.getState().registerOnlineSong(songs[0]).catch(() => {});
      }
      const isDownloaded = Boolean(
        songs[0].isDownloaded ||
        useLibraryStore.getState().downloadedSongIds.has(songs[0].id)
      );
      const effectiveFirstSong = isDownloaded
        ? {
            ...songs[0],
            isDownloaded: true,
            isForegroundOnly: false,
            playbackMode: 'direct-catalog' as const,
            isDirectAudioStream: true
          }
        : songs[0];

      // Reset shuffle order so nextSong regenerates it cleanly for the new queue.
      set({
        queue: [...songs],
        queueIndex: 0,
        currentSong: effectiveFirstSong,
        playbackHistory: [],
        shuffledQueueOrder: []
      });
      await audioService.playSong(effectiveFirstSong);
      if (get().isAuraFlow) {
        setTimeout(() => ensureAuraFlowBuffer(), 100);
      }
      persistCurrentSessionImmediate();
    },

    togglePlay: () => {
      const { currentSong } = get();
      audioService.togglePlay(currentSong);
      persistCurrentSessionImmediate();
    },

    seek: (seconds: number) => {
      audioService.seek(seconds);
      persistCurrentSessionImmediate();
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

      const isCurrentLocal = currentSong ? isLocalTrack(currentSong) : queue.some(isLocalTrack);
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
        const isSmart = get().shuffleMode === 'smart';

        // Spotify-style Smart Shuffle: every 3-4 tracks, weave in a contextual discovery recommendation
        // STRICT RULE: ONLY for online streaming tracks, NEVER for local device music
        if (!isCurrentLocal && isSmart && currentPos !== -1 && currentPos > 0 && currentPos % 3 === 0) {
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
          const smartCandidate = auraFlowService.getNextTrack(context);
          if (smartCandidate && !queue.some((s) => s.id === smartCandidate.id)) {
            const smartSong: Song = {
              ...smartCandidate,
              isAuraFlow: true,
              isSmartShuffle: true,
              auraReason: smartCandidate.auraReason || 'discovery_pick'
            };
            const newQueue = [...queue, smartSong];
            const smartIndex = newQueue.length - 1;
            const newOrder = [
              ...order.slice(0, currentPos + 1),
              smartIndex,
              ...order.slice(currentPos + 1)
            ];
            const updatedHistory = (currentSong ? [...playbackHistory, currentSong.id] : playbackHistory).slice(-200);
            set({
              queue: newQueue,
              queueIndex: smartIndex,
              shuffledQueueOrder: newOrder,
              currentSong: smartSong,
              playbackHistory: updatedHistory
            });
            audioService.playSong(smartSong);
            auraFlowService.recordAuraTrackStart(smartSong);
            return;
          }
        }

        if (currentPos !== -1 && currentPos < order.length - 1) {
          nextIndex = order[currentPos + 1];
        } else if (repeatMode === 'all') {
          const freshOrder = isFairShuffle
            ? generateFairShuffleIndices(queue, 0)
            : generatePureRandomIndices(queue.length, 0);
          set({ shuffledQueueOrder: freshOrder });
          nextIndex = freshOrder[0];
        } else if (!isCurrentLocal && (isAuraFlow || isSmart)) {
          // Reached shuffle queue end with online Aura Flow or Smart Shuffle ON: generate next song
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
            const flowSong: Song = {
              ...nextTrack,
              isAuraFlow: true,
              isSmartShuffle: isSmart,
              auraReason: nextTrack.auraReason
            };
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
        } else if (!isCurrentLocal && isAuraFlow) {
          // Reached sequential queue end with online Aura Flow ON: generate next song
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
        if (!isCurrentLocal && get().isAuraFlow) {
          setTimeout(() => ensureAuraFlowBuffer(), 100);
        }
        persistCurrentSessionImmediate();
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
        persistCurrentSessionImmediate();
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
          persistCurrentSessionImmediate();
          return;
        }
      }

      // Otherwise fall back to previous index
      let prevIndex = queueIndex - 1;
      if (isShuffle && shuffledQueueOrder && shuffledQueueOrder.length === queue.length) {
        const currentPos = shuffledQueueOrder.indexOf(queueIndex);
        if (currentPos > 0) {
          prevIndex = shuffledQueueOrder[currentPos - 1];
        } else {
          prevIndex = shuffledQueueOrder[shuffledQueueOrder.length - 1];
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
        persistCurrentSessionImmediate();
      }
    },

    toggleShuffle: () => {
      const currentMode = get().shuffleMode || (get().isShuffle ? (get().isFairShuffle ? 'fair' : 'fair') : 'off');
      let nextMode: ShuffleMode;
      if (currentMode === 'off') {
        nextMode = 'fair';
      } else if (currentMode === 'fair') {
        nextMode = 'smart';
      } else {
        nextMode = 'off';
      }
      get().setShuffleMode(nextMode);
    },

    setShuffleMode: (mode: ShuffleMode) => {
      const { queue, queueIndex } = get();
      let newOrder: number[] = [];
      const isShuffle = mode !== 'off';
      const isFair = mode === 'fair' || mode === 'smart';

      if (isShuffle && queue.length > 0) {
        newOrder = isFair
          ? generateFairShuffleIndices(queue, queueIndex >= 0 ? queueIndex : 0)
          : generatePureRandomIndices(queue.length, queueIndex >= 0 ? queueIndex : 0);
      }

      set({
        shuffleMode: mode,
        isShuffle,
        isFairShuffle: isFair,
        shuffledQueueOrder: newOrder
      });
      persistCurrentSessionImmediate();
    },

    toggleFairShuffle: () => {
      const nextFair = !get().isFairShuffle;
      const { queue, queueIndex, isShuffle, shuffleMode } = get();
      let newOrder: number[] = [];
      if (isShuffle && queue.length > 0) {
        newOrder = nextFair
          ? generateFairShuffleIndices(queue, queueIndex >= 0 ? queueIndex : 0)
          : generatePureRandomIndices(queue.length, queueIndex >= 0 ? queueIndex : 0);
      }
      set({
        isFairShuffle: nextFair,
        shuffleMode: !nextFair ? 'fair' : shuffleMode === 'smart' ? 'smart' : 'fair',
        shuffledQueueOrder: newOrder
      });
      persistCurrentSessionImmediate();
    },

    reshuffleQueue: () => {
      const { queue, queueIndex, shuffledQueueOrder, shuffleMode } = get();
      if (queue.length <= 1) return;

      const order = reshuffleUpcomingIndices(
        queue,
        queueIndex >= 0 ? queueIndex : 0,
        shuffledQueueOrder
      );

      set({
        shuffledQueueOrder: order,
        isShuffle: true,
        shuffleMode: shuffleMode === 'off' ? 'fair' : shuffleMode
      });
      persistCurrentSessionImmediate();
    },

    cycleRepeat: () => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const current = get().repeatMode;
      const nextMode = modes[(modes.indexOf(current) + 1) % modes.length];
      audioService.setLoop(nextMode === 'one');
      set({ repeatMode: nextMode });
      persistCurrentSessionImmediate();
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
    },

    persistSessionImmediate: () => {
      persistCurrentSessionImmediate();
    },

    restorePlaybackSession: async (): Promise<boolean> => {
      try {
        const session = await playbackSessionService.loadSession();
        if (!session) return false;

        const snapshot = session.queueTracks?.find((s) => s.id === session.songId);
        const { track: restoredSong, isDeletedOrUnavailable } =
          await playbackSessionService.resolveSavedTrack(session.songId, snapshot);

        if (isDeletedOrUnavailable || !restoredSong) {
          // Saved track no longer exists in library/sources -> clear stale session
          await playbackSessionService.clearSession();
          return false;
        }

        // Reconstruct queue
        let queue: Song[] = [];
        if (session.queueTracks && session.queueTracks.length > 0) {
          queue = session.queueTracks;
        } else {
          queue = [restoredSong];
        }

        const foundIdx = queue.findIndex((s) => s.id === restoredSong.id);
        const targetIndex = foundIdx !== -1 ? foundIdx : Math.min(session.queueIndex, queue.length - 1);
        const trackDuration = restoredSong.duration > 0 ? restoredSong.duration : session.duration;
        const clampedPos = Math.max(0, Math.min(session.position, trackDuration > 0 ? trackDuration : session.position));

        set({
          currentSong: restoredSong,
          currentTime: clampedPos,
          duration: trackDuration,
          isPlaying: false,
          queue,
          queueIndex: Math.max(0, targetIndex),
          isShuffle: session.shuffleState.isShuffle,
          shuffleMode: session.shuffleState.shuffleMode,
          shuffledQueueOrder: session.shuffleState.shuffledQueueOrder || [],
          repeatMode: session.repeatState
        });

        // Pre-load / cue audio engine to restored position without auto-playing
        await audioService.restoreSession(restoredSong, clampedPos);
        return true;
      } catch (err) {
        console.warn('[usePlayerStore] restorePlaybackSession error:', err);
        return false;
      }
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
}if (typeof window !== 'undefined') {
  (window as any).__playerStore = usePlayerStore;
}
