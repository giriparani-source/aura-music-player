import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  X,
  Music2,
  Shuffle,
  GripVertical,
  Sparkles,
  Dices,
  Infinity as InfinityIcon
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { formatTime } from '../../utils/formatters';
import { Artwork } from '../common/Artwork';
import { getAuraReasonLabel } from '../../services/auraFlowService';
import { pushBackButtonHandler } from '../../services/androidMediaBridge';
import { Song, QueuedSong } from '../../types/music';

// ============================================================================
// 1. Live 3-Bar Equalizer Component
// ============================================================================
export interface LiveEqualizerProps {
  isPlaying: boolean;
  color?: string;
}

export const LiveEqualizer: React.FC<LiveEqualizerProps> = ({
  isPlaying,
  color = '#1ed760'
}) => {
  return (
    <div
      className="flex items-end gap-[2px] h-4 px-1 shrink-0"
      aria-label={isPlaying ? 'Track playing with live equalizer' : 'Track paused'}
      title={isPlaying ? 'Playing' : 'Paused'}
    >
      {isPlaying ? (
        <>
          <span
            className="w-1 h-full animate-pulse rounded-full"
            style={{ backgroundColor: color }}
          />
          <span
            className="w-1 h-2/3 animate-bounce rounded-full"
            style={{ backgroundColor: color }}
          />
          <span
            className="w-1 h-3/4 animate-pulse rounded-full"
            style={{ backgroundColor: color }}
          />
        </>
      ) : (
        <div className="flex items-end gap-[2px] h-4 opacity-50">
          <span
            className="w-1 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span
            className="w-1 h-3.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span
            className="w-1 h-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. Clear Queue Confirmation Dialog (Modal at z-[80])
// ============================================================================
export interface ClearQueueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ClearQueueDialog: React.FC<ClearQueueDialogProps> = ({
  isOpen,
  onClose,
  onConfirm
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      cancelBtnRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Android hardware / gesture back button: dismiss dialog only, keep QueueSheet open
    const unregisterBack = pushBackButtonHandler(() => {
      onClose();
      return true;
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    // Registered with capture phase (true) to intercept and halt event before bubble listeners (MainLayout) run
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      unregisterBack();
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-queue-dialog-title"
        aria-describedby="clear-queue-dialog-desc"
        className="bg-[#1c1b22] border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 id="clear-queue-dialog-title" className="text-base font-bold text-white">
          Clear queue?
        </h4>
        <p id="clear-queue-dialog-desc" className="text-xs text-neutral-400 leading-relaxed">
          This will remove all upcoming songs you added to your queue. The song that&apos;s currently playing won&apos;t be stopped.
        </p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer shadow-md shadow-rose-900/40"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. Section 1: Currently Playing Section
// ============================================================================
interface CurrentlyPlayingSectionProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

const CurrentlyPlayingSection: React.FC<CurrentlyPlayingSectionProps> = ({
  currentSong,
  isPlaying,
  onTogglePlay
}) => {
  if (!currentSong) {
    return (
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
          Currently playing
        </h3>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center text-xs text-neutral-500">
          No track currently playing
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5">
        Currently playing
      </h3>
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/10 shadow-lg">
        {/* Artwork */}
        <div className="w-12 h-12 rounded-xl overflow-hidden relative shadow-md bg-[#2a2931] shrink-0">
          <Artwork
            src={currentSong.coverArt || currentSong.artwork}
            title={currentSong.title}
            artist={currentSong.artist}
            size="sm"
          />
          {isPlaying && (
            <div className="absolute inset-0 bg-[#00f1fd]/10 mix-blend-screen pointer-events-none" />
          )}
        </div>

        {/* Title & Artist */}
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-sm font-bold text-white truncate">
            {currentSong.title}
          </h4>
          <p className="text-xs text-neutral-400 truncate mt-0.5">
            {currentSong.artist}
          </p>
        </div>

        {/* Live 3-Bar Equalizer */}
        <LiveEqualizer isPlaying={isPlaying} color="#1ed760" />

        {/* Inline Play/Pause Toggle Button */}
        <button
          type="button"
          onClick={onTogglePlay}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer shrink-0 shadow-sm"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={18} className="fill-white" />
          ) : (
            <Play size={18} className="fill-white ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 4. Section 2: Next in Queue Section (with Drag & Drop)
// ============================================================================
interface NextInQueueSectionProps {
  userQueue: QueuedSong[];
  onRemoveFromUserQueue: (queueItemId: string) => void;
  onClearQueueClick: () => void;
}

const NextInQueueSection: React.FC<NextInQueueSectionProps> = ({
  userQueue,
  onRemoveFromUserQueue,
  onClearQueueClick
}) => {
  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Next in queue
          </h3>
          {userQueue.length > 0 && (
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {userQueue.length}
            </span>
          )}
        </div>

        {userQueue.length > 0 && (
          <button
            type="button"
            onClick={onClearQueueClick}
            className="text-xs text-neutral-400 hover:text-rose-400 transition-colors font-medium cursor-pointer"
            title="Clear all songs you added to queue"
          >
            Clear queue
          </button>
        )}
      </div>

      {/* Drag & Drop Reorderable Track List */}
      <Droppable droppableId="user-queue">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-1.5 rounded-xl transition-all ${
              snapshot.isDraggingOver ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30 p-1 -m-1' : ''
            }`}
          >
            {userQueue.length === 0 ? (
              <div
                className={`min-h-[50px] border border-dashed rounded-xl flex items-center justify-center text-xs transition-colors p-3 ${
                  snapshot.isDraggingOver
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300 font-medium'
                    : 'border-white/10 text-neutral-500'
                }`}
              >
                <span>
                  {snapshot.isDraggingOver
                    ? 'Drop song here to play next'
                    : 'Drag songs here to play next'}
                </span>
              </div>
            ) : (
              userQueue.map((song, index) => (
                <Draggable
                  key={song.queueItemId}
                  draggableId={song.queueItemId}
                  index={index}
                >
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`group flex items-center gap-2.5 p-2 rounded-xl transition-all border ${
                        dragSnapshot.isDragging
                          ? 'bg-[#1c1b22] border-emerald-500/40 shadow-2xl scale-[1.02] z-50'
                          : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5'
                      }`}
                    >
                      {/* Drag Handle Button strictly decorated with touch-none */}
                      <button
                        type="button"
                        {...dragProvided.dragHandleProps}
                        onClick={(e) => e.stopPropagation()}
                        className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-white/10 cursor-grab active:cursor-grabbing touch-none shrink-0"
                        title="Drag to reorder"
                        aria-label={`Drag to reorder ${song.title}`}
                      >
                        <GripVertical size={16} />
                      </button>

                      {/* Artwork */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#2a2931] relative">
                        <Artwork
                          src={song.coverArt || song.artwork}
                          title={song.title}
                          artist={song.artist}
                          size="sm"
                        />
                      </div>

                      {/* Title, Badge & Artist */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h5 className="text-xs sm:text-sm font-semibold text-white truncate">
                            {song.title}
                          </h5>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#1ed760]/20 text-[#1ed760] border border-[#1ed760]/30 tracking-tight shrink-0 uppercase">
                            Queued
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {song.artist}
                        </p>
                      </div>

                      {/* Duration */}
                      <span className="text-xs font-mono text-neutral-500 tabular-nums shrink-0">
                        {formatTime(song.duration)}
                      </span>

                      {/* Individual Remove Button */}
                      <button
                        type="button"
                        onClick={() => onRemoveFromUserQueue(song.queueItemId)}
                        className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
                        aria-label="Remove from queue"
                        title="Remove from queue"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

// ============================================================================
// 5. Section 3: Context Queue Section (Next from / Shuffling from Playlist)
// ============================================================================
interface ContextQueueSectionProps {
  queue: Song[];
  queueIndex: number;
  isShuffle: boolean;
  shuffledQueueOrder: number[];
  contextName: string;
  onPlaySong: (song: Song, targetIndex: number) => void;
  onRemoveFromQueue: (targetIndex: number) => void;
}

const ContextQueueSection: React.FC<ContextQueueSectionProps> = ({
  queue,
  queueIndex,
  isShuffle,
  shuffledQueueOrder,
  contextName,
  onPlaySong,
  onRemoveFromQueue
}) => {
  // Compute upcoming tracks that follow the current active track
  const upcomingTracks = useMemo(() => {
    if (queue.length === 0) return [];

    if (isShuffle && shuffledQueueOrder && shuffledQueueOrder.length === queue.length) {
      const currentPos = shuffledQueueOrder.indexOf(queueIndex);
      if (currentPos !== -1) {
        if (currentPos < shuffledQueueOrder.length - 1) {
          return shuffledQueueOrder
            .slice(currentPos + 1)
            .map((idx) => ({
              song: queue[idx],
              contextIndex: idx
            }))
            .filter((item) => Boolean(item.song));
        }
        return [];
      }
    }

    if (queueIndex < queue.length - 1) {
      return queue.slice(queueIndex + 1).map((song, i) => ({
        song,
        contextIndex: queueIndex + 1 + i
      }));
    }

    return [];
  }, [queue, queueIndex, isShuffle, shuffledQueueOrder]);

  return (
    <div className="mb-6">
      {/* Context Header */}
      <div className="flex items-center gap-1.5 pb-2 mb-2">
        {isShuffle && <Shuffle size={13} className="text-[#00f1fd]" />}
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 truncate">
          {isShuffle ? `Shuffling from: ${contextName}` : `Next from: ${contextName}`}
        </h3>
      </div>

      {/* Tracks List */}
      <Droppable droppableId="context-queue">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-1 rounded-xl transition-all min-h-[44px] ${
              snapshot.isDraggingOver ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30 p-1 -m-1' : ''
            }`}
          >
            {upcomingTracks.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-neutral-500">
                End of playlist reached
              </div>
            ) : (
              upcomingTracks.map(({ song, contextIndex }, idx) => (
                <Draggable
                  key={`ctx-${contextIndex}-${song.id}`}
                  draggableId={`ctx-${contextIndex}-${song.id}`}
                  index={idx}
                >
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      onClick={() => onPlaySong(song, contextIndex)}
                      className={`group flex items-center gap-2.5 p-2 rounded-xl transition-all border cursor-pointer ${
                        dragSnapshot.isDragging
                          ? 'bg-[#1c1b22] border-indigo-500/40 shadow-2xl scale-[1.02] z-50'
                          : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5'
                      }`}
                    >
                      {/* Drag Handle Button strictly decorated with touch-none */}
                      <button
                        type="button"
                        {...dragProvided.dragHandleProps}
                        onClick={(e) => e.stopPropagation()}
                        className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-white/10 cursor-grab active:cursor-grabbing touch-none shrink-0"
                        title="Drag to reorder"
                        aria-label={`Drag to reorder ${song.title}`}
                      >
                        <GripVertical size={16} />
                      </button>

                      {/* Artwork with hover play overlay */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#2a2931] relative group/art">
                        <Artwork
                          src={song.coverArt || song.artwork}
                          title={song.title}
                          artist={song.artist}
                          size="sm"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded pointer-events-none">
                          <Play size={14} className="text-white fill-white" />
                        </div>
                      </div>

                      {/* Title & Artist */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h5 className="text-xs sm:text-sm font-medium text-neutral-200 group-hover:text-white truncate">
                            {song.title}
                          </h5>
                          {song.isSmartShuffle ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                              <Sparkles size={8} className="text-emerald-400" />
                              Smart Pick
                            </span>
                          ) : song.isAuraFlow ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-violet-500/20 text-fuchsia-300 border border-violet-500/30 shrink-0">
                              <Sparkles size={8} />
                              {getAuraReasonLabel(song.auraReason)}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                          {song.artist}
                        </p>
                      </div>

                      {/* Duration */}
                      <span className="text-xs font-mono text-neutral-500 tabular-nums shrink-0">
                        {formatTime(song.duration)}
                      </span>

                      {/* Individual Remove from context queue */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFromQueue(contextIndex);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-all shrink-0 cursor-pointer"
                        aria-label="Remove from queue"
                        title="Remove from queue"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

// ============================================================================
// 6. Main Responsive QueueSheet Component (z-[70])
// ============================================================================
export const QueueSheet: React.FC = () => {
  // Player Store Selectors
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const userQueue = usePlayerStore((s) => s.userQueue);
  const playSong = usePlayerStore((s) => s.playSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const removeFromUserQueue = usePlayerStore((s) => s.removeFromUserQueue);
  const clearUserQueue = usePlayerStore((s) => s.clearUserQueue);
  const moveQueueItem = usePlayerStore((s) => s.moveQueueItem);
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const isFairShuffle = usePlayerStore((s) => s.isFairShuffle);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleFairShuffle = usePlayerStore((s) => s.toggleFairShuffle);
  const reshuffleQueue = usePlayerStore((s) => s.reshuffleQueue);
  const isAuraFlow = usePlayerStore((s) => s.isAuraFlow);
  const toggleAuraFlow = usePlayerStore((s) => s.toggleAuraFlow);
  const shuffledQueueOrder = usePlayerStore((s) => s.shuffledQueueOrder);

  // Library Store Selectors for context name resolution
  const activePlaylistId = useLibraryStore((s) => s.activePlaylistId);
  const playlists = useLibraryStore((s) => s.playlists);

  // Local UI States
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Determine active context name
  const contextName = useMemo(() => {
    if (activePlaylistId) {
      const pl = playlists.find((p) => p.id === activePlaylistId);
      if (pl?.name) return pl.name;
    }
    if (currentSong?.album) return currentSong.album;
    if (currentSong?.artist) return currentSong.artist;
    return 'Aura Library';
  }, [activePlaylistId, playlists, currentSong]);

  // Handle Drag & Drop Reordering across all queue sections
  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    moveQueueItem(source, destination);
  };

  if (!isQueueOpen) return null;

  const contextUpcoming =
    isShuffle && shuffledQueueOrder && shuffledQueueOrder.length === queue.length
      ? (() => {
          const currentPos = shuffledQueueOrder.indexOf(queueIndex);
          return currentPos !== -1 ? Math.max(0, shuffledQueueOrder.length - 1 - currentPos) : 0;
        })()
      : queue.length > 0 && queueIndex >= 0 && queueIndex < queue.length - 1
      ? queue.length - 1 - queueIndex
      : 0;

  const totalUpcoming = userQueue.length + contextUpcoming;

  return (
    <>
      {/* Backdrop (z-[70]) */}
      <div
        className="fixed inset-0 z-[70] flex items-end sm:items-stretch sm:justify-end bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setQueueOpen(false);
          }
        }}
      >
        {/* Responsive Sheet / Drawer Container */}
        <div
          className="w-full max-h-[88vh] sm:max-h-full sm:h-full sm:w-[420px] lg:w-[460px] bg-[#0e1118]/95 backdrop-blur-2xl rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl border-t sm:border-t-0 sm:border-l border-white/10 flex flex-col shadow-2xl overflow-hidden select-none animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
        >
          {/* Mobile Drag Handle Bar (Swipe down gesture isolated from song list) */}
          <div
            className="sm:hidden pt-3 pb-1 flex justify-center shrink-0 cursor-pointer touch-none"
            onClick={() => setQueueOpen(false)}
            onTouchStart={(e) => {
              if (e.touches.length !== 1) return;
              touchStartY.current = e.touches[0].clientY;
              touchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (touchStartY.current !== null && touchStartX.current !== null) {
                const deltaY = e.changedTouches[0].clientY - touchStartY.current;
                const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX.current);
                if (deltaY > 50 && deltaY > deltaX * 1.2) {
                  setQueueOpen(false);
                }
              }
              touchStartY.current = null;
              touchStartX.current = null;
            }}
            onTouchCancel={() => {
              touchStartY.current = null;
              touchStartX.current = null;
            }}
            title="Swipe down or tap to close"
          >
            <div className="w-12 h-1.5 rounded-full bg-white/20 hover:bg-white/40 transition-colors" />
          </div>

          {/* Header */}
          <div className="p-4 sm:p-5 pb-3 border-b border-white/10 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>Queue</span>
                  {totalUpcoming > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono">
                      {totalUpcoming}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-neutral-500">Upcoming tracks</p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQueueOpen(false)}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  aria-label="Close Queue"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Playback Automation Bar: 3-State Shuffle, Reshuffle & Aura Flow */}
            <div className="flex flex-col gap-1.5 p-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={toggleShuffle}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    shuffleMode === 'smart'
                      ? 'bg-gradient-to-r from-emerald-600/30 to-teal-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : shuffleMode === 'fair' || isShuffle
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Click to cycle: Off -> True-Fair -> Smart Shuffle ✨"
                >
                  <Shuffle size={13} />
                  <span>
                    {shuffleMode === 'smart'
                      ? 'Smart ✨'
                      : isShuffle
                      ? 'Fair 🔀'
                      : 'Shuffle: OFF'}
                  </span>
                </button>

                {isShuffle && (
                  <div className="flex items-center gap-1">
                    {/* 1-Click Reshuffle Button */}
                    <button
                      type="button"
                      onClick={reshuffleQueue}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-all cursor-pointer active:scale-95 text-[11px]"
                      title="Reshuffle upcoming queue now"
                    >
                      <Dices size={12} className="text-amber-400" />
                      <span>Reshuffle</span>
                    </button>

                    {/* Fair vs Pure Random Switcher */}
                    <button
                      type="button"
                      onClick={toggleFairShuffle}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono uppercase font-bold transition-all border cursor-pointer ${
                        isFairShuffle
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-white/5 text-neutral-400 border-white/10'
                      }`}
                      title={
                        isFairShuffle
                          ? 'True-Fair Active: Anti-clustering ensures same-artist & album tracks are evenly spaced'
                          : 'Pure Random Shuffle: Click to enable True-Fair anti-clustering'
                      }
                    >
                      <Sparkles size={11} className={isFairShuffle ? 'text-emerald-400' : ''} />
                      <span>{isFairShuffle ? 'Fair' : 'Random'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                <button
                  type="button"
                  onClick={toggleAuraFlow}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-xs transition-all border cursor-pointer w-full justify-between ${
                    isAuraFlow
                      ? 'bg-gradient-to-r from-violet-600/25 to-fuchsia-600/25 text-fuchsia-300 border-fuchsia-500/35 shadow-sm'
                      : 'bg-white/[0.02] text-neutral-400 border-white/5 hover:text-neutral-200'
                  }`}
                  title="Aura Flow: Continuous smart autoplay when queue ends"
                >
                  <div className="flex items-center gap-1.5">
                    <InfinityIcon
                      size={13}
                      className={isAuraFlow ? 'text-fuchsia-400 animate-pulse' : ''}
                    />
                    <span>Aura Flow Autoplay</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isAuraFlow
                        ? 'bg-fuchsia-500/20 text-fuchsia-300'
                        : 'bg-white/5 text-neutral-500'
                    }`}
                  >
                    {isAuraFlow ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Content Container (Hosting Sections 1, 2, 3) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 overscroll-contain">
            {/* Section 1: Currently Playing */}
            <CurrentlyPlayingSection
              currentSong={currentSong}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
            />

            {/* Shared DragDropContext enclosing both upcoming sections */}
            <DragDropContext onDragEnd={handleDragEnd}>
              {/* Section 2: Next in Queue (User Queued with DnD) */}
              <NextInQueueSection
                userQueue={userQueue}
                onRemoveFromUserQueue={removeFromUserQueue}
                onClearQueueClick={() => setIsClearDialogOpen(true)}
              />

              {/* Section 3: Next from / Shuffling from [Context] */}
              <ContextQueueSection
                queue={queue}
                queueIndex={queueIndex}
                isShuffle={isShuffle}
                shuffledQueueOrder={shuffledQueueOrder}
                contextName={contextName}
                onPlaySong={(song, targetIdx) => playSong(song, undefined, targetIdx)}
                onRemoveFromQueue={removeFromQueue}
              />
            </DragDropContext>

            {/* Empty Queue State */}
            {userQueue.length === 0 && queue.length === 0 && !currentSong && (
              <div className="flex flex-col items-center justify-center py-16 text-neutral-500 text-center">
                <Music2 size={36} className="mb-2 opacity-40" />
                <p className="text-sm font-medium">Queue is empty</p>
                <p className="text-xs text-neutral-600 mt-1">Play any song or add to queue</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear Queue Confirmation Dialog (z-[80]) */}
      <ClearQueueDialog
        isOpen={isClearDialogOpen}
        onClose={() => setIsClearDialogOpen(false)}
        onConfirm={clearUserQueue}
      />
    </>
  );
};

export default QueueSheet;
