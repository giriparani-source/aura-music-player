import React from 'react';
import { Music } from 'lucide-react';

interface ArtworkProps {
  src?: string;
  title: string;
  artist?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Artwork: React.FC<ArtworkProps> = ({
  src,
  title,
  artist,
  size = 'md',
  className = ''
}) => {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  const sizeClasses = {
    sm: 'w-10 h-10 rounded-md text-xs',
    md: 'w-12 h-12 rounded-lg text-sm',
    lg: 'w-36 h-36 rounded-xl text-base',
    xl: 'w-64 h-64 rounded-2xl text-xl shadow-2xl'
  };

  // Generate deterministic gradient based on title string
  const getGradient = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'from-indigo-600 to-purple-800',
      'from-rose-600 to-amber-700',
      'from-emerald-600 to-teal-800',
      'from-blue-600 to-cyan-800',
      'from-fuchsia-600 to-pink-800',
      'from-violet-600 to-indigo-950',
      'from-amber-600 to-orange-800'
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  if (src && !hasError) {
    return (
      <div className={`relative overflow-hidden shrink-0 bg-neutral-900/80 ${sizeClasses[size]} ${className}`}>
        <img
          src={src}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden flex flex-col items-center justify-center font-bold text-white/90 bg-gradient-to-br ${getGradient(title || 'Music')} shadow-inner ${sizeClasses[size]} ${className}`}
    >
      <Music className="opacity-40 mb-0.5" size={size === 'xl' ? 48 : size === 'lg' ? 28 : 16} />
      {size === 'xl' || size === 'lg' ? (
        <span className="text-center px-2 truncate max-w-full opacity-80 text-xs font-medium">
          {title}
        </span>
      ) : null}
    </div>
  );
};
