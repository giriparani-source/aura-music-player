import React, { useState, useRef, useEffect } from 'react';
import { Moon, Check, X, Clock } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SleepTimerPreset } from '../../services/sleepTimerService';

interface SleepTimerMenuProps {
  compact?: boolean;
}

export const SleepTimerMenu: React.FC<SleepTimerMenuProps> = ({ compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    sleepTimerRemaining,
    sleepTimerMode,
    setSleepTimer,
    cancelSleepTimer
  } = usePlayerStore();

  const isTimerActive = sleepTimerMode !== 'off';

  // Format remaining seconds into MM:SS or H:MM:SS
  const formatCountdown = (totalSec: number | null): string => {
    if (totalSec === null || totalSec <= 0) return '';
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const presets: { id: SleepTimerPreset; label: string; sub?: string }[] = [
    { id: '15', label: '15 Minutes' },
    { id: '30', label: '30 Minutes' },
    { id: '45', label: '45 Minutes' },
    { id: '60', label: '60 Minutes' },
    { id: 'end_of_song', label: 'End of this track', sub: 'Fades down gently before track ends' }
  ];

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border select-none ${
          isTimerActive
            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20'
            : 'bg-white/5 text-neutral-400 hover:text-white border-white/10 hover:bg-white/10'
        }`}
        title={
          isTimerActive
            ? `Sleep Timer Active (${sleepTimerMode === 'end_of_song' ? 'End of Song' : formatCountdown(sleepTimerRemaining)})`
            : 'Set Sleep Timer'
        }
        aria-label="Set Sleep Timer"
      >
        <Moon size={14} className={isTimerActive ? 'text-purple-400 fill-purple-400/40 animate-pulse' : ''} />
        {!compact && (
          <span>
            {isTimerActive
              ? sleepTimerMode === 'end_of_song'
                ? 'End of Track'
                : formatCountdown(sleepTimerRemaining)
              : 'Sleep Timer'}
          </span>
        )}
        {compact && isTimerActive && (
          <span className="text-[10px] font-mono font-bold text-purple-300">
            {sleepTimerMode === 'end_of_song' ? 'End' : formatCountdown(sleepTimerRemaining)}
          </span>
        )}
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 w-56 p-2 rounded-2xl bg-[#0e111a]/95 backdrop-blur-2xl border border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5 mb-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Clock size={13} className="text-purple-400" />
              <span>Smart Sleep Timer</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-neutral-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>

          <div className="space-y-0.5">
            {presets.map((p) => {
              const isSelected = sleepTimerMode === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSleepTimer(p.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/30 font-semibold'
                      : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex flex-col">
                    <span>{p.label}</span>
                    {p.sub && <span className="text-[9px] text-neutral-400">{p.sub}</span>}
                  </div>
                  {isSelected && <Check size={13} className="text-purple-400 shrink-0 ml-2" />}
                </button>
              );
            })}

            {isTimerActive && (
              <div className="pt-1 mt-1 border-t border-white/5">
                <button
                  onClick={() => {
                    cancelSleepTimer();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <X size={12} />
                  <span>Turn Off Timer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
