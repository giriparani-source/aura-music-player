import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, Library, Radio, Settings } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLibraryStore } from '../../store/useLibraryStore';
import { NavigationTab } from '../../types/music';

const TAB_ROUTES: Record<NavigationTab, string> = {
  home: '/',
  library: '/library',
  radio: '/radio',
  search: '/search',
  settings: '/settings',
  playlists: '/library',
};

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useLibraryStore();
  const { t } = useTranslation();

  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: t('nav.home') || 'Home', icon: <Home size={22} /> },
    { id: 'search', label: t('nav.search') || 'Search', icon: <Search size={22} /> },
    { id: 'library', label: t('nav.library') || 'Your Library', icon: <Library size={22} /> },
    { id: 'radio', label: t('nav.radio') || 'Radio', icon: <Radio size={22} /> },
    { id: 'settings', label: t('nav.settings') || 'Settings', icon: <Settings size={22} /> },
  ];

  return (
    <nav
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
      className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom,0px))] bg-[#0e0d14] border-t border-white/[0.08] shadow-[0_-4px_24px_rgba(0,0,0,0.7)] flex items-center justify-around px-2 z-[30] select-none transform-gpu will-change-transform"
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <Link
            key={item.id}
            to={TAB_ROUTES[item.id]}
            onClick={() => {
              if (navigator.vibrate) {
                try { navigator.vibrate(8); } catch (_) {}
              }
              setActiveTab(item.id);
            }}
            className={`flex flex-col items-center justify-center min-w-[56px] h-12 py-1 px-2 rounded-xl transition-all duration-200 active:scale-95 ${
              isActive
                ? 'text-[#e0b6ff] font-bold'
                : 'text-[#998d9e] hover:text-[#e5e0eb]'
            }`}
          >
            <div className="relative flex items-center justify-center">
              {item.icon}
              {item.id === 'radio' && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#00f1fd] animate-pulse shadow-[0_0_6px_#00f1fd]" />
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
