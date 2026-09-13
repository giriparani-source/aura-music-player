import React from 'react';
import { X, Trash2, Music2, Shuffle, Sparkles } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { formatTime } from '../../utils/formatters';
import { Artwork } from '../common/Artwork';

export const QueueDrawer: React.FC = () => {
  const {
    queue,
    queueIndex,
    isQueueOpen,
    setQueueOpen,
    playSong,
    togglePlay,
    removeFromQueue,
    clearQueue,
    isShuffle,
    isFairShuffle,
    toggleShuffle,
    toggleFairShuffle
  } = usePlayerStore();

  if (!isQueueOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-[#0e1118]/95 backdrop-blur-2xl border-l border-white/10 z-[55] p-5 flex flex-col shadow-2xl select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-white/10 mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Play Queue</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono">
                {queue.length}
              </span>
            </h3>
            <p className="text-xs text-neutral-500">Upcoming songs</p>
          </div>

          <div className="flex items-center gap-1">
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="Clear Queue"
              >
                <Trash2 size={16} />
              </button>
            )}

            <button
              onClick={() => setQueueOpen(false)}
              className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Shuffle Mode Bar */}
        <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
          <button
            onClick={toggleShuffle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              isShuffle ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
            title="Toggle Queue Shuffle"
          >
            <Shuffle size={13} />
            <span>Shuffle: {isShuffle ? 'ON' : 'OFF'}</span>
          </button>

          {isShuffle && (
            <button
              onClick={toggleFairShuffle}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono uppercase font-bold transition-all border cursor-pointer ${
                isFairShuffle
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/5 text-neutral-400 border-white/10'
              }`}
              title={
                isFairShuffle
                  ? 'True-Fair Active: Anti-clustering ensures same-artist songs are evenly spaced'
                  : 'Pure Random Shuffle: Click to enable True-Fair anti-clustering'
              }
            >
              <Sparkles size={11} className={isFairShuffle ? 'text-emerald-400' : ''} />
              <span>{isFairShuffle ? 'True-Fair' : 'Pure Random'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Queue items */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-neutral-500 text-center">
            <Music2 size={32} className="mb-2 opacity-40" />
            <p className="text-sm font-medium">Queue is empty</p>
            <p className="text-xs text-neutral-600 mt-1">Play any song or add to queue</p>
          </div>
        ) : (
          queue.map((song, idx) => {
            const isCurrent = idx === queueIndex;
            return (
              <div
                key={song.id + '-' + idx}
                onClick={() => {
                  if (isCurrent) {
                    togglePlay();
                  } else {
                    playSong(song, undefined, idx);
                  }
                }}
                className={`group flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer ${
                  isCurrent ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'hover:bg-white/5 text-neutral-300'
                }`}
              >
                <Artwork src={song.coverArt || song.artwork} title={song.title} artist={song.artist} size="sm" />

                <div className="flex-1 min-w-0">
                  <h5 className={`text-xs font-semibold truncate ${isCurrent ? 'text-indigo-300' : 'text-neutral-200'}`}>
                    {song.title}
                  </h5>
                  <p className="text-[11px] text-neutral-500 truncate mt-0.5">{song.artist}</p>
                </div>

                <span className="text-[10px] font-mono text-neutral-500 tabular-nums">
                  {formatTime(song.duration)}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromQueue(idx);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-rose-400 rounded transition-all"
                  title="Remove from queue"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
