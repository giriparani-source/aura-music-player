import React, { useEffect, useRef, useState } from 'react';
import { ListPlus } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';

export const QueueToast: React.FC = () => {
  const queueToast = usePlayerStore((s) => s.queueToast);
  const hideQueueToast = usePlayerStore((s) => s.hideQueueToast);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const hasPlayer = Boolean(usePlayerStore((s) => s.currentSong));

  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isBumping, setIsBumping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = Boolean(queueToast?.open);
  const toastId = queueToast?.id;
  const message = queueToast?.message || 'Added to queue';

  useEffect(() => {
    if (isOpen && toastId) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (isVisible) {
        // Consecutive addition tactile bump
        setIsBumping(true);
        if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
        bumpTimerRef.current = setTimeout(() => setIsBumping(false), 200);
      } else {
        setIsVisible(true);
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      }

      // 3.5s auto-dismissal
      timerRef.current = setTimeout(() => {
        setIsAnimating(false);
        const exitTimer = setTimeout(() => {
          setIsVisible(false);
          hideQueueToast();
        }, 300);
        return () => clearTimeout(exitTimer);
      }, 3500);
    } else {
      setIsAnimating(false);
      const exitTimer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(exitTimer);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
    };
  }, [isOpen, toastId, hideQueueToast]);

  const handleOpenQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsAnimating(false);
    setIsVisible(false);
    hideQueueToast();
    setQueueOpen(true);
  };

  if (!isVisible) return null;

  const positionClasses = hasPlayer
    ? 'bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-24'
    : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-6';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 -translate-x-1/2 z-[65] pointer-events-auto max-w-[calc(100vw-2rem)] sm:max-w-md select-none transition-all duration-300 ease-out transform-gpu will-change-transform ${positionClasses} ${
        isAnimating
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-3 scale-95 pointer-events-none'
      } ${isBumping ? 'scale-105' : ''}`}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3 rounded-full bg-[#1f1d2b]/95 border border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        <div className="w-5 h-5 rounded-full bg-[#1ed760]/20 flex items-center justify-center shrink-0">
          <ListPlus size={13} className="text-[#1ed760]" strokeWidth={2.5} />
        </div>

        <span className="text-xs sm:text-sm font-semibold text-[#e5e0eb] truncate tracking-tight">
          {message}
        </span>

        <button
          onClick={handleOpenQueue}
          className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold text-[#1ed760] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer uppercase tracking-wider shrink-0 focus:outline-none"
        >
          Open
        </button>
      </div>
    </div>
  );
};
