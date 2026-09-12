import React from 'react';
import { Home, Library, Search, ListMusic, Settings, Sparkles, Plus, Users } from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useJamStore } from '../../store/useJamStore';
import { NavigationTab } from '../../types/music';
import { SidebarPwaButton } from '../common/PwaInstallBanner';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, playlists, stats, setActivePlaylistId, createPlaylist } = useLibraryStore();
  const { isInRoom, roomCode, setJamModalOpen } = useJamStore();

  const navItems: Array<{ id: NavigationTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Home', icon: <Home size={19} /> },
    { id: 'library', label: 'My Library', icon: <Library size={19} /> },
    { id: 'search', label: 'Search', icon: <Search size={19} /> },
    { id: 'ai-studio', label: 'AI DJ Studio', icon: <Sparkles size={19} className="text-amber-400" /> },
    { id: 'playlists', label: 'Playlists', icon: <ListMusic size={19} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={19} /> },
  ];

  const smartPlaylists = playlists.filter((p) => p.isSmart);
  const userPlaylists = playlists.filter((p) => !p.isSmart);

  return (
    <aside className="hidden md:flex flex-col w-64 h-full bg-[#0e1118]/80 backdrop-blur-xl border-r border-white/5 select-none shrink-0 p-4">
      {/* Brand logo */}
      <div className="flex items-center gap-3 px-3 py-2 mb-6">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
          <Sparkles size={18} />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
            Aura <span className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/30">Music</span>
          </h1>
          <p className="text-[11px] text-neutral-400 font-medium">Personal Audio Library</p>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="space-y-1 mb-3">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
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
              {item.id === 'search' && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Cloud
                </span>
              )}
              {item.id === 'ai-studio' && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 animate-pulse">
                  AI DJ
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Social Jam Listen Together button */}
      <div className="mb-4">
        <button
          onClick={() => setJamModalOpen(true)}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
            isInRoom
              ? 'bg-gradient-to-r from-purple-600/25 to-pink-600/20 border-purple-500/40 text-purple-200 shadow-md shadow-purple-600/20'
              : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/5 text-neutral-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Users size={16} className={isInRoom ? 'text-pink-400 animate-pulse' : 'text-indigo-400'} />
            <span>Social Jam</span>
          </div>
          <span
            className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider border ${
              isInRoom
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
            }`}
          >
            {isInRoom ? roomCode : 'Live'}
          </span>
        </button>
      </div>

      <div className="h-px bg-white/5 my-2" />

      {/* Smart Playlists Section */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
            Smart Mixes
          </p>
          <div className="space-y-0.5">
            {smartPlaylists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => {
                  setActiveTab('playlists');
                  setActivePlaylistId(pl.id);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 flex items-center justify-between group transition-all"
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
                setActiveTab('playlists');
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
                    setActiveTab('playlists');
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
