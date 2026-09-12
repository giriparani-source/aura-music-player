import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { BottomPlayer } from '../player/BottomPlayer';
import { NowPlayingModal } from '../player/NowPlayingModal';
import { QueueDrawer } from '../player/QueueDrawer';
import { HomeView } from '../views/HomeView';
import { LibraryView } from '../views/LibraryView';
import { SearchView } from '../views/SearchView';
import { PlaylistsView } from '../views/PlaylistsView';
import { SettingsView } from '../views/SettingsView';
import { AiStudioView } from '../views/AiStudioView';
import { AuraChatDrawer } from '../ai/AuraChatDrawer';
import { PwaInstallBanner } from '../common/PwaInstallBanner';
import { JamModal } from '../jam/JamModal';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';

export const MainLayout: React.FC = () => {
  const { activeTab, loadLibrary, isLoading, toggleFavorite } = useLibraryStore();
  const {
    currentSong,
    togglePlay,
    nextSong,
    previousSong,
    seek,
    currentTime,
    isNowPlayingOpen,
    setNowPlayingOpen,
    isQueueOpen,
    setQueueOpen
  } = usePlayerStore();

  // Load library on startup
  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(currentTime + 5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, currentTime - 5));
          break;
        case 'KeyN':
          e.preventDefault();
          nextSong();
          break;
        case 'KeyP':
          e.preventDefault();
          previousSong();
          break;
        case 'KeyF':
          if (currentSong) {
            e.preventDefault();
            toggleFavorite(currentSong.id);
          }
          break;
        case 'Escape':
          if (isNowPlayingOpen) setNowPlayingOpen(false);
          if (isQueueOpen) setQueueOpen(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, nextSong, previousSong, seek, currentTime, currentSong, isNowPlayingOpen, isQueueOpen, toggleFavorite, setNowPlayingOpen, setQueueOpen]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'home':
        return <HomeView />;
      case 'library':
        return <LibraryView />;
      case 'search':
        return <SearchView />;
      case 'playlists':
        return <PlaylistsView />;
      case 'ai-studio':
        return <AiStudioView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#090b10] text-[#e2e8f0] overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <Header />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto pb-28 md:pb-24">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-3" />
              <p className="text-xs font-medium">Loading library...</p>
            </div>
          ) : (
            renderActiveView()
          )}
        </main>

        {/* Persistent Bottom Player Bar */}
        <BottomPlayer />

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />

        {/* Fullscreen / Expanded Now Playing Modal */}
        <NowPlayingModal />

        {/* Queue Drawer */}
        <QueueDrawer />

        {/* Floating Aura AI Music Assistant */}
        <AuraChatDrawer />

        {/* PWA Install Notification Prompt */}
        <PwaInstallBanner />

        {/* WebRTC Social Jam Modal */}
        <JamModal />
      </div>
    </div>
  );
};
