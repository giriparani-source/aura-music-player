import React from 'react';
import { Home, Library, Search, ListMusic, Settings } from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { NavigationTab } from '../../types/music';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useLibraryStore();

  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'library', label: 'Library', icon: <Library size={20} /> },
    { id: 'search', label: 'Search', icon: <Search size={20} /> },
    { id: 'playlists', label: 'Playlists', icon: <ListMusic size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0e1118]/95 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around px-2 z-30 select-none">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-colors ${
              isActive ? 'text-indigo-400 font-semibold' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {item.icon}
            <span className="text-[10px]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
