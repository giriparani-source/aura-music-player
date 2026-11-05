import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Library, Search, Settings, Sparkles, Plus, Radio } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLibraryStore } from '../../store/useLibraryStore';
import { NavigationTab } from '../../types/music';
import { SidebarPwaButton } from '../common/PwaInstallBanner';

const TAB_ROUTES: Record<NavigationTab, string> = {
  home: '/',
  local: '/library',
  library: '/library',
  radio: '/radio',
  search: '/search',
  'ai-studio': '/ai-studio',
  settings: '/settings',
  playlists: '/library',
};

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { activeTab, setActiveTab, setLibrarySubTab, playlists, setActivePlaylistId, createPlaylist } = useLibraryStore();

  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: t('nav.home') || 'Home', icon: <Home size={19} /> },
    { id: 'library', label: t('nav.library') || 'Your Library', icon: <Library size={19} /> },
    { id: 'radio', label: t('nav.radio') || 'Radio', icon: <Radio size={19} /> },
    { id: 'search', label: t('nav.search') || 'Search', icon: <Search size={19} /> },
    { id: 'ai-studio', label: t('nav.aiStudio') || 'AI Studio', icon: <Sparkles size={19} className="text-[#00f1fd]" /> },
    { id: 'settings', label: t('nav.settings') || 'Settings', icon: <Settings size={19} /> },
  ];

  const smartPlaylists = playlists.filter((p) => p.isSmart);
  const userPlaylists = playlists.filter((p) => !p.isSmart);

  return (
    <aside className="hidden md:flex flex-col w-64 h-full bg-[#12101b]/95 backdrop-blur-2xl border-r border-white/[0.06] select-none shrink-0 p-4 shadow-2xl">
      {/* Brand logo & Nocturne Emblem */}
      <div className="flex items-center gap-3 px-3 py-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9d4edd] to-[#00f1fd] p-0.5 shadow-[0_0_20px_rgba(157,78,221,0.35)] shrink-0">
          <img
            src="/logo.png"
            alt="Aura Logo"
            className="w-full h-full rounded-[10px] object-cover bg-[#14121a]"
          />
        </div>
        <div>
          <h1 className="font-extrabold text-base tracking-tight text-[#e5e0eb] flex items-center gap-1.5">
            Aura <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#9d4edd]/25 text-[#e0b6ff] font-bold border border-[#9d4edd]/30">320k</span>
          </h1>
          <p className="text-[11px] text-[#998d9e] font-medium">{t('nav.subTitle') || 'Studio Master Stream'}</p>
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
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#9d4edd]/25 via-[#9d4edd]/15 to-transparent text-[#e0b6ff] border border-[#9d4edd]/30 shadow-[0_0_16px_rgba(157,78,221,0.2)] font-bold'
                  : 'text-[#998d9e] hover:text-[#e5e0eb] hover:bg-white/[0.04]'
              }`}
            >
              <span className={isActive ? 'text-[#e0b6ff]' : 'text-[#998d9e]'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.id === 'radio' && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#00f1fd]/15 text-[#00f1fd] border border-[#00f1fd]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00f1fd] animate-pulse" />
                  {t('nav.liveBadge') || 'LIVE'}
                </span>
              )}
              {item.id === 'search' && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#9d4edd]/20 text-[#e0b6ff] border border-[#9d4edd]/30">
                  {t('nav.cloudBadge') || 'CLOUD'}
                </span>
              )}
              {item.id === 'ai-studio' && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#9d4edd]/30 to-[#00f1fd]/20 text-[#00f1fd] border border-[#00f1fd]/30">
                  {t('nav.aiBadge') || 'AI'}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="h-px bg-white/[0.06] my-2" />

      {/* Smart Playlists Section */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#998d9e] mb-2">
            {t('nav.smartMixes') || 'Curated Mixes'}
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
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-[#d0c2d5] hover:text-white hover:bg-white/[0.05] flex items-center justify-between group transition-all cursor-pointer"
              >
                <span className="truncate">{pl.name}</span>
                <span className="text-[10px] text-[#998d9e] group-hover:text-[#e0b6ff]">
                  {pl.songIds.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* User Playlists */}
        <div>
          <div className="px-3 flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#998d9e]">
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
              className="p-1 rounded-full text-[#998d9e] hover:text-[#e0b6ff] hover:bg-[#9d4edd]/15 transition-colors cursor-pointer"
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
                  className="w-full text-left px-3 py-1.5 rounded-xl text-xs text-[#d0c2d5] hover:text-white hover:bg-white/[0.05] truncate transition-colors cursor-pointer"
                >
                  {pl.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 text-[11px] text-[#998d9e] italic">No cloud playlists yet</p>
          )}
        </div>
      </div>

      {/* PWA Install Button */}
      <div className="pt-2 pb-1">
        <SidebarPwaButton />
      </div>

      {/* Library Health Footer badge */}
      <div className="pt-2 mt-auto border-t border-white/[0.06]">
        <div
          onClick={() => setActiveTab('settings')}
          className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#9d4edd]/30 hover:bg-[#9d4edd]/10 transition-all cursor-pointer flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-bold text-[#e5e0eb]">Pure Cloud Streaming</p>
            <p className="text-[11px] text-[#998d9e]">
              JioSaavn 320k & YouTube HD
            </p>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#00f1fd] shadow-[0_0_10px_#00f1fd]" />
        </div>
      </div>
    </aside>
  );
};
