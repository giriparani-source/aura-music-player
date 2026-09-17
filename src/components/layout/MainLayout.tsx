import React, { useEffect, Suspense, lazy } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { BottomPlayer } from '../player/BottomPlayer';
import { PwaInstallBanner } from '../common/PwaInstallBanner';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
  androidMediaBridge,
  registerMediaActionHandler,
  registerBackButtonHandler
} from '../../services/androidMediaBridge';

// Code-split heavy views and modals with React.lazy() for fast initial load
const HomeView = lazy(() => import('../views/HomeView').then((m) => ({ default: m.HomeView })));
const LibraryView = lazy(() => import('../views/LibraryView').then((m) => ({ default: m.LibraryView })));
const SearchView = lazy(() => import('../views/SearchView').then((m) => ({ default: m.SearchView })));
const SettingsView = lazy(() => import('../views/SettingsView').then((m) => ({ default: m.SettingsView })));
const AiStudioView = lazy(() => import('../views/AiStudioView').then((m) => ({ default: m.AiStudioView })));
const RadioView = lazy(() => import('../views/RadioView').then((m) => ({ default: m.RadioView })));

const NowPlayingModal = lazy(() => import('../player/NowPlayingModal').then((m) => ({ default: m.NowPlayingModal })));
const QueueDrawer = lazy(() => import('../player/QueueDrawer').then((m) => ({ default: m.QueueDrawer })));
const AuraChatDrawer = lazy(() => import('../ai/AuraChatDrawer').then((m) => ({ default: m.AuraChatDrawer })));
const JamModal = lazy(() => import('../jam/JamModal').then((m) => ({ default: m.JamModal })));

const ViewSkeleton: React.FC = () => (
  <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto animate-pulse select-none">
    <div className="flex items-center justify-between">
      <div className="h-8 w-48 bg-white/10 rounded-2xl" />
      <div className="h-8 w-24 bg-white/10 rounded-full" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="aspect-square rounded-2xl bg-white/5 border border-white/5" />
      ))}
    </div>
    <div className="h-28 w-full bg-white/5 rounded-3xl border border-white/5" />
  </div>
);

export const MainLayout: React.FC = () => {
  const { activeTab, loadLibrary, isLoading, toggleFavorite } = useLibraryStore();
  const currentSong = usePlayerStore((s) => s.currentSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextSong = usePlayerStore((s) => s.nextSong);
  const previousSong = usePlayerStore((s) => s.previousSong);
  const seek = usePlayerStore((s) => s.seek);
  const isNowPlayingOpen = usePlayerStore((s) => s.isNowPlayingOpen);
  const setNowPlayingOpen = usePlayerStore((s) => s.setNowPlayingOpen);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);

  // Load library and initialize native media bridge on startup
  useEffect(() => {
    registerMediaActionHandler((action, position) => {
      const store = usePlayerStore.getState();
      switch (action) {
        case 'play':
        case 'resume':
          if (!store.isPlaying) store.togglePlay();
          break;
        case 'pause':
          if (store.isPlaying) store.togglePlay();
          break;
        case 'toggle':
          store.togglePlay();
          break;
        case 'next':
          store.nextSong();
          break;
        case 'previous':
          store.previousSong();
          break;
        case 'seek':
          if (typeof position === 'number') store.seek(position);
          break;
        case 'seekbackward':
          store.seek(Math.max(0, (store.currentTime || 0) - (position || 10)));
          break;
        case 'seekforward':
          store.seek((store.currentTime || 0) + (position || 10));
          break;
      }
    });

    registerBackButtonHandler(() => {
      const player = usePlayerStore.getState();
      const library = useLibraryStore.getState();
      if (player.isNowPlayingOpen) {
        player.setNowPlayingOpen(false);
        return true;
      }
      if (player.isQueueOpen) {
        player.setQueueOpen(false);
        return true;
      }
      if (player.isAiAssistantOpen) {
        player.setAiAssistantOpen(false);
        return true;
      }
      if (library.activeTab !== 'home') {
        library.setActiveTab('home');
        return true;
      }
      return false; // let bridge minimize app
    });

    loadLibrary();
    androidMediaBridge.init();

    // This app-boundary subscription avoids circular dependencies while syncing native media.
    // Only sync track metadata on actual track change or play/pause state change.
    // High-frequency currentTime updates (4x/sec) are excluded to prevent flooding
    // Android IPC and foreground service intents during screen-off deep sleep.
    const unsubscribe = usePlayerStore.subscribe((state, previousState) => {
      if (
        state.currentSong !== previousState.currentSong ||
        state.isPlaying !== previousState.isPlaying
      ) {
        androidMediaBridge.syncTrackMetadata(
          state.currentSong,
          state.isPlaying,
          state.currentTime,
          state.duration
        );
      }
    });

    return unsubscribe;
  }, [loadLibrary]);

  // Global Keyboard Navigation
  // Notice: Reads currentTime directly from usePlayerStore.getState() on keydown
  // to avoid re-rendering MainLayout 4 times per second on every audio timeupdate!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      const curTime = usePlayerStore.getState().currentTime || 0;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(curTime + 5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, curTime - 5));
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
            toggleFavorite(currentSong.id, currentSong);
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
  }, [togglePlay, nextSong, previousSong, seek, currentSong, isNowPlayingOpen, isQueueOpen, toggleFavorite, setNowPlayingOpen, setQueueOpen]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'home':
        return <HomeView />;
      case 'library':
        return <LibraryView />;
      case 'search':
        return <SearchView />;
      case 'playlists':
        return <LibraryView />;
      case 'radio':
        return <RadioView />;
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

        {/* Scrollable View Content with Suspense Skeleton */}
        <main className="flex-1 overflow-y-auto pb-[calc(9.5rem+env(safe-area-inset-bottom,0px))] md:pb-24">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-3" />
              <p className="text-xs font-medium">Loading library...</p>
            </div>
          ) : (
            <Suspense fallback={<ViewSkeleton />}>
              {renderActiveView()}
            </Suspense>
          )}
        </main>

        {/* Persistent Bottom Player Bar */}
        <BottomPlayer />

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />

        {/* Code-split Modals in Suspense */}
        <Suspense fallback={null}>
          {isNowPlayingOpen && <NowPlayingModal />}
          {isQueueOpen && <QueueDrawer />}
          <AuraChatDrawer />
          <JamModal />
        </Suspense>

        {/* PWA Install Notification Prompt */}
        <PwaInstallBanner />
      </div>
    </div>
  );
};
