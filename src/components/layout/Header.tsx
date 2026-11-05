import React, { useEffect } from 'react';
import { Search, HardDrive, X, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useProfileStore } from '../../store/useProfileStore';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const setAiAssistantOpen = usePlayerStore((s) => s.setAiAssistantOpen);
  const { activeProfile, setProfileModalOpen } = useProfileStore();
  const searchQuery = useLibraryStore((s) => s.searchQuery);
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery);
  const activeTab = useLibraryStore((s) => s.activeTab);
  const setActiveTab = useLibraryStore((s) => s.setActiveTab);
  const totalSongs = useLibraryStore((s) => s.stats.totalSongs);

  // Prevent browser password manager from polluting search query with user email
  useEffect(() => {
    if (searchQuery && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery.trim())) {
      setSearchQuery('');
    }
  }, [searchQuery, setSearchQuery]);

  return (
    <header
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      className="h-[calc(4rem+env(safe-area-inset-top,0px))] border-b border-white/[0.08] bg-[#14121a] px-4 sm:px-6 flex items-center justify-between shrink-0 select-none z-10"
    >
      {/* Search Input shortcut (hidden on dedicated Search view to avoid duplicate inputs) */}
      {activeTab !== 'search' ? (
        <div className="relative w-48 sm:w-72 md:w-80 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#998d9e] pointer-events-none" />
          <input
            type="search"
            name="aura_music_search"
            id="aura_header_search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                setActiveTab('search');
              }
            }}
            placeholder={activeTab === 'library' ? (t('header.librarySearchPlaceholder') || 'Search your library...') : (t('header.searchPlaceholder') || 'Search songs, artists, albums...')}
            className="w-full pl-9 pr-14 py-2 bg-[#1c1b22]/90 border border-white/[0.08] rounded-full text-xs text-[#e5e0eb] placeholder-[#998d9e] focus:outline-none focus:border-[#9d4edd]/60 focus:bg-[#201f26] transition-all shadow-inner"
          />
          {searchQuery ? (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-[#998d9e] hover:text-[#e5e0eb] rounded-full transition-colors cursor-pointer"
                title={t('header.clearSearch') || 'Clear search'}
              >
                <X size={13} />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className="hidden sm:flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#9d4edd]/20 text-[#e0b6ff] hover:bg-[#9d4edd]/30 text-[10px] font-semibold transition-colors cursor-pointer"
                title="Search online (Enter)"
              >
                <span>{t('nav.cloudBadge') || 'CLOUD'}</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Search size={16} className="text-[#00f1fd]" />
          <span className="text-xs font-bold text-[#e5e0eb] tracking-wide">{t('nav.search') || 'Explore & Search'}</span>
        </div>
      )}

      {/* Right Header Actions */}
      <div className="flex items-center gap-2.5">
        {/* Sleek Embedded Ask AI Trigger */}
        <button
          onClick={() => setAiAssistantOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#e0b6ff] bg-[#9d4edd]/15 hover:bg-[#9d4edd]/25 border border-[#9d4edd]/30 transition-all cursor-pointer shadow-sm active:scale-95"
          title={t('header.openAiDj') || 'Open AI DJ'}
        >
          <Sparkles size={14} className="text-[#00f1fd] animate-pulse" />
          <span className="hidden sm:inline">Ask AI DJ</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-[#d0c2d5] bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors cursor-pointer"
          title="Go to Library"
        >
          <HardDrive size={14} className="text-[#00f1fd]" />
          <span>{totalSongs} {t('common.songs') || 'tracks'}</span>
        </button>

        {/* Profile Avatar Quick Switcher */}
        <button
          onClick={() => setProfileModalOpen(true)}
          style={{ borderColor: activeProfile.color || '#9d4edd' }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold text-white bg-white/[0.04] border hover:bg-white/[0.08] transition-all cursor-pointer shadow-sm"
          title={`Active Profile: ${activeProfile.name} (Click to switch)`}
        >
          <span className="text-sm">{activeProfile.avatar}</span>
          <span className="hidden md:inline max-w-[80px] truncate">{activeProfile.name}</span>
        </button>
      </div>
    </header>
  );
};
