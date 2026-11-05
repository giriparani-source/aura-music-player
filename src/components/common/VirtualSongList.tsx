import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Song } from '../../types/music';
import { SongRow } from './SongRow';

interface VirtualSongListProps {
  songs: Song[];
  playlistContext?: Song[];
  isSelectMode?: boolean;
  selectedSongIds?: string[];
  onToggleSelect?: (songId: string) => void;
  showAlbum?: boolean;
  showDateAdded?: boolean;
  itemHeight?: number; // default ~56px
  overscan?: number;   // default 8 items
  className?: string;
}

/**
 * High-performance virtualized song list designed for 2GB RAM devices.
 * Only renders visible DOM rows (~20-25 items) regardless of whether
 * the playlist contains 100, 1,000, or 5,000+ songs.
 * Prevents DOM bloat, eliminates GC pauses, and maintains steady 60 FPS scrolling.
 */
export const VirtualSongList: React.FC<VirtualSongListProps> = React.memo(({
  songs,
  playlistContext,
  isSelectMode = false,
  selectedSongIds,
  onToggleSelect,
  showAlbum = true,
  showDateAdded = true,
  itemHeight = 56,
  overscan = 8,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  // Fallback for short lists (<= 40 songs): render directly without virtualization overhead
  const shouldVirtualize = songs.length > 40;

  useEffect(() => {
    if (!shouldVirtualize) return;

    // Find the nearest scrollable ancestor (normally <main className="overflow-y-auto">)
    let scrollParent: HTMLElement | Window = window;
    let node = containerRef.current?.parentElement;
    while (node) {
      const style = window.getComputedStyle(node);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollParent = node;
        break;
      }
      node = node.parentElement;
    }

    const updateDimensions = () => {
      if (scrollParent === window) {
        setViewportHeight(window.innerHeight);
      } else {
        setViewportHeight((scrollParent as HTMLElement).clientHeight);
      }
    };

    updateDimensions();

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (scrollParent === window) {
            const listTop = containerRef.current?.getBoundingClientRect().top ?? 0;
            setScrollTop(Math.max(0, -listTop));
          } else {
            const elem = scrollParent as HTMLElement;
            const listTop = containerRef.current ? (containerRef.current.getBoundingClientRect().top - elem.getBoundingClientRect().top + elem.scrollTop) : 0;
            setScrollTop(Math.max(0, elem.scrollTop - listTop));
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateDimensions, { passive: true });

    return () => {
      scrollParent.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [shouldVirtualize]);

  if (!shouldVirtualize) {
    return (
      <div className={`space-y-0.5 ${className}`}>
        {songs.map((song, idx) => (
          <SongRow
            key={song.id || idx}
            song={song}
            index={idx}
            playlistContext={playlistContext || songs}
            isSelectMode={isSelectMode}
            isSelected={selectedSongIds?.includes(song.id)}
            onToggleSelect={onToggleSelect}
            showAlbum={showAlbum}
            showDateAdded={showDateAdded}
          />
        ))}
      </div>
    );
  }

  const totalHeight = songs.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
  const endIndex = Math.min(songs.length, startIndex + visibleCount);

  const visibleSongs = songs.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ height: `${totalHeight}px` }}
    >
      <div
        className="space-y-0.5 w-full absolute top-0 left-0 will-change-transform"
        style={{ transform: `translateY(${offsetY}px)` }}
      >
        {visibleSongs.map((song, relIdx) => {
          const actualIndex = startIndex + relIdx;
          return (
            <SongRow
              key={song.id || actualIndex}
              song={song}
              index={actualIndex}
              playlistContext={playlistContext || songs}
              isSelectMode={isSelectMode}
              isSelected={selectedSongIds?.includes(song.id)}
              onToggleSelect={onToggleSelect}
              showAlbum={showAlbum}
              showDateAdded={showDateAdded}
            />
          );
        })}
      </div>
    </div>
  );
});

VirtualSongList.displayName = 'VirtualSongList';
