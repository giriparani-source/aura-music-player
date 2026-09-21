import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Library, Search, Settings, Radio } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLibraryStore } from '../../store/useLibraryStore';
import { NavigationTab } from '../../types/music';

const TAB_ROUTES: Record<NavigationTab, string> = {
  home: '/',
  library: '/library',
  radio: '/radio',
  search: '/search',
  'ai-studio': '/ai-studio',
  settings: '/settings',
  playlists: '/library',
};

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useLibraryStore();
  const { t } = useTranslation();

  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: t('nav.home'), icon: <Home size={19} /> },
    { id: 'radio', label: t('nav.radio'), icon: <Radio size={19} /> },
    { id: 'library', label: t('nav.library'), icon: <Library size={19} /> },
    { id: 'search', label: t('nav.search'), icon: <Search size={19} /> },
    { id: 'settings', label: t('nav.settings'), icon: <Settings size={19} /> },
  ];

  return (
    <nav
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}
      className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom,0px))] bg-[#0e1118]/95 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around px-2 z-[30] select-none"
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <Link
            key={item.id}
            to={TAB_ROUTES[item.id]}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors ${
              isActive ? 'text-indigo-400 font-semibold' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {item.icon}
            <span className="text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
