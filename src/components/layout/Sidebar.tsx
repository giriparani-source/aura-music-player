import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Library, Search, Settings, Sparkles, Plus, Radio } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLibraryStore } from '../../store/useLibraryStore';
import { NavigationTab } from '../../types/music';
import { SidebarPwaButton } from '../common/PwaInstallBanner';

const TAB_ROUTES: Record<NavigationTab, string> = {
  home: '/',
  library: '/library',
  radio: '/radio',
  search: '/search',
  'ai-studio': '/ai-studio',
  settings: '/settings',
  playlists: '/library',
};

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { activeTab, setActiveTab, setLibrarySubTab, playlists, stats, setActivePlaylistId, createPlaylist } = useLibraryStore();

  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: t('nav.home'), icon: <Home size={19} /> },
    { id: 'library', label: t('nav.library'), icon: <Library size={19} /> },
    { id: 'radio', label: t('nav.radio'), icon: <Radio size={19} /> },
    { id: 'search', label: t('nav.search'), icon: <Search size={19} /> },
    { id: 'ai-studio', label: t('nav.aiStudio'), icon: <Sparkles size={19} className="text-amber-400" /> },
    { id: 'settings', label: t('nav.settings'), icon: <Settings size={19} /> },
  ];

  const smartPlaylists = playlists.filter((p) => p.isSmart);
  const userPlaylists = playlists.filter((p) => !p.isSmart);

  return (
    <aside className="hidden md:flex flex-col w-64 h-full bg-[#0e1118]/80 backdrop-blur-xl border-r border-white/5 select-none shrink-0 p-4">
      {/* Brand logo */}
      <div className="flex items-center gap-3 px-3 py-2 mb-6">
        <img
          src="/logo.png"
          alt="Aura Logo"
          className="w-9 h-9 rounded-xl object-cover shadow-lg shadow-indigo-600/30 border border-white/10"
        />
        <div>
          <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
            Aura <span className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/30">Music</span>
          </h1>
          <p className="text-[11px] text-neutral-400 font-medium">{t('nav.subTitle')}</p>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="space-y-1 mb-3">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <Link
              key={item.id}
              to={TAB_ROUTES[item.id]}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 text-indigo-300 border border-indigo-500/20 shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className={isActive ? 'text-indigo-400' : 'text-neutral-500'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.id === 'radio' && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  {t('nav.liveBadge')}
                </span>
              )}
              {item.id === 'search' && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {t('nav.cloudBadge')}
                </span>
              )}
              {item.id === 'ai-studio' && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 animate-pulse">
                  {t('nav.aiBadge')}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="h-px bg-white/5 my-2" />

      {/* Smart Playlists Section */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
            {t('nav.smartMixes')}
          </p>
          <div className="space-y-0.5">
            {smartPlaylists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => {
                  setActiveTab('library');
                  setLibrarySubTab('playlists');
                  setActivePlaylistId(pl.id);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 flex items-center justify-between group transition-all cursor-pointer"
              >
                <span className="truncate">{pl.name}</span>
                <span className="text-[10px] text-neutral-600 group-hover:text-neutral-400">
                  {pl.songIds.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* User Playlists */}
        <div>
          <div className="px-3 flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              My Playlists
            </p>
            <button
              onClick={() => {
                setActiveTab('library');
                setLibrarySubTab('playlists');
                const name = prompt('Enter name for your new playlist:');
                if (name && name.trim()) {
                  createPlaylist(name.trim()).then((newPl) => setActivePlaylistId(newPl.id));
                }
              }}
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Create New Playlist"
            >
              <Plus size={14} />
            </button>
          </div>
          {userPlaylists.length > 0 ? (
            <div className="space-y-0.5">
              {userPlaylists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => {
                    setActiveTab('library');
                    setLibrarySubTab('playlists');
                    setActivePlaylistId(pl.id);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white hover:bg-white/5 truncate transition-colors cursor-pointer"
                >
                  {pl.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 text-[11px] text-neutral-600 italic">No custom playlists yet</p>
          )}
        </div>
      </div>

      {/* PWA Install Button */}
      <div className="pt-2 pb-1">
        <SidebarPwaButton />
      </div>

      {/* Library Health Footer badge */}
      <div className="pt-2 mt-auto border-t border-white/5">
        <div
          onClick={() => setActiveTab('settings')}
          className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all cursor-pointer flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-neutral-300">Local Collection</p>
            <p className="text-[11px] text-neutral-500">
              {stats.totalSongs} {stats.totalSongs === 1 ? 'song' : 'songs'} indexed
            </p>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        </div>
      </div>
    </aside>
  );
};
