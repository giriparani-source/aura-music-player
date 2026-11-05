import React from 'react';
import { Music, Disc3 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface ArtworkProps {
  src?: string;
  title: string;
  artist?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const ArtworkComponent: React.FC<ArtworkProps> = ({
  src,
  title,
  artist,
  size = 'md',
  className = ''
}) => {
  const [currentSrc, setCurrentSrc] = React.useState<string | null>(null);
  const [hasError, setHasError] = React.useState(false);
  const [fallbackStep, setFallbackStep] = React.useState(0);

  // Helper to extract YouTube video ID from any URL format
  const extractVideoId = React.useCallback((url?: string | null): string | null => {
    if (!url) return null;
    const match = url.match(/(?:\/vi\/|vi_webp\/|v=|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    return match ? match[1] : null;
  }, []);

  // Compute initial resolved source with immediate YouTube CDN normalization
  const computeInitialSrc = React.useCallback((inputSrc?: string): string | null => {
    if (!inputSrc || inputSrc.trim() === '') return null;
    if (inputSrc.startsWith('content://media/external/audio/albumart')) return null;

    // Normalize Invidious/relative YouTube paths to Google's official CDN
    if (inputSrc.startsWith('/vi/')) {
      return `https://i.ytimg.com${inputSrc}`;
    }
    const ytId = extractVideoId(inputSrc);
    if (ytId && (inputSrc.includes('invidious') || inputSrc.includes('nadeko.net') || inputSrc.includes('piped'))) {
      return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    }

    if (
      Capacitor.isNativePlatform() &&
      typeof Capacitor.convertFileSrc === 'function' &&
      (inputSrc.startsWith('content://') || inputSrc.startsWith('file://') || inputSrc.startsWith('/storage/') || inputSrc.startsWith('/data/'))
    ) {
      try {
        return Capacitor.convertFileSrc(inputSrc);
      } catch {
        return inputSrc;
      }
    }
    return inputSrc;
  }, [extractVideoId]);

  React.useEffect(() => {
    setCurrentSrc(computeInitialSrc(src));
    setHasError(false);
    setFallbackStep(0);
  }, [src, computeInitialSrc]);

  // Dynamic Image Fallback Ladder:
  // Step 0: Try normalized original src
  // Step 1: If failed and video ID exists, try https://i.ytimg.com/vi/${id}/hqdefault.jpg
  // Step 2: If hqdefault fails, try https://i.ytimg.com/vi/${id}/mqdefault.jpg
  // Step 3: Switch to vinyl gradient card
  const handleImageError = () => {
    const videoId = extractVideoId(currentSrc) || extractVideoId(src);
    if (videoId && fallbackStep === 0) {
      setFallbackStep(1);
      setCurrentSrc(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    } else if (videoId && fallbackStep === 1) {
      setFallbackStep(2);
      setCurrentSrc(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`);
    } else {
      setHasError(true);
    }
  };

  const sizeClasses = {
    sm: 'w-10 h-10 rounded-md text-xs',
    md: 'w-12 h-12 rounded-lg text-sm',
    lg: 'w-36 h-36 rounded-xl text-base',
    xl: 'w-full h-full aspect-square rounded-2xl text-xl shadow-2xl'
  };

  // Generate deterministic gradient based on title + artist string
  const getGradient = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      'from-purple-900 via-indigo-900 to-black',
      'from-rose-950 via-purple-900 to-black',
      'from-emerald-950 via-teal-900 to-black',
      'from-blue-950 via-indigo-900 to-black',
      'from-amber-950 via-orange-900 to-black',
      'from-fuchsia-950 via-pink-900 to-black',
      'from-cyan-950 via-blue-900 to-black'
    ];
    return gradients[Math.abs(hash) % gradients.length];
  };

  if (currentSrc && !hasError) {
    return (
      <div className={`relative overflow-hidden shrink-0 bg-neutral-900/80 ${sizeClasses[size]} ${className}`}>
        <img
          src={currentSrc}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          onError={handleImageError}
        />
      </div>
    );
  }

  // Premium Vinyl / Gradient Card Fallback for Local Songs without embedded artwork
  const fallbackGradient = getGradient(`${title}_${artist || ''}`);
  const isLarge = size === 'xl' || size === 'lg';

  return (
    <div
      className={`relative shrink-0 overflow-hidden flex flex-col items-center justify-center font-bold text-white bg-gradient-to-br ${fallbackGradient} border border-white/10 shadow-inner select-none ${sizeClasses[size]} ${className}`}
    >
      {/* Vinyl record concentric grooves aesthetic */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent pointer-events-none" />
      
      {isLarge ? (
        <div className="flex flex-col items-center justify-center p-3 text-center space-y-2 z-10 w-full">
          <div className="p-3 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm shadow-lg shadow-black/40">
            <Disc3 className="w-8 h-8 text-white/80 animate-spin-slow" />
          </div>
          <div className="w-full px-2">
            <p className="truncate text-xs font-bold text-white/90">{title}</p>
            <p className="truncate text-[10px] font-medium text-white/60">{artist || 'Local Track'}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center z-10">
          <Music className="opacity-70 text-white/80" size={size === 'md' ? 18 : 14} />
        </div>
      )}
    </div>
  );
};

export const Artwork = React.memo(ArtworkComponent);
