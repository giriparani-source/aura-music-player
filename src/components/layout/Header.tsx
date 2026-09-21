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
  const {
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    stats
  } = useLibraryStore();

  // Prevent browser password manager from polluting search query with user email
  useEffect(() => {
    if (searchQuery && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery.trim())) {
      setSearchQuery('');
    }
  }, [searchQuery, setSearchQuery]);

  return (
    <header
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      className="h-[calc(4rem+env(safe-area-inset-top,0px))] border-b border-white/5 bg-[#0b0d13]/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 select-none z-10"
    >
      {/* Search Input shortcut (hidden on dedicated Search view to avoid duplicate inputs) */}
      {activeTab !== 'search' ? (
        <div className="relative w-48 sm:w-72 md:w-80 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
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
            placeholder={activeTab === 'library' ? t('header.librarySearchPlaceholder') : t('header.searchPlaceholder')}
            className="w-full pl-9 pr-14 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/60 focus:bg-white/[0.07] transition-all"
          />
          {searchQuery ? (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-neutral-400 hover:text-white rounded-md transition-colors cursor-pointer"
                title={t('header.clearSearch')}
              >
                <X size={13} />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-[10px] font-medium transition-colors cursor-pointer"
                title="Search online (Enter)"
              >
                <span>{t('nav.cloudBadge')}</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Search size={15} className="text-neutral-400" />
          <span className="text-xs font-bold text-neutral-300 tracking-wide">{t('nav.search')}</span>
        </div>
      )}

      {/* Right Header Actions */}
      <div className="flex items-center gap-2.5">
        {/* Sleek Embedded Ask AI Trigger (replaces floating screen clutter) */}
        <button
          onClick={() => setAiAssistantOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-indigo-300 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 transition-all cursor-pointer shadow-sm"
          title={t('header.openAiDj')}
        >
          <Sparkles size={14} className="text-amber-400" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          title="Go to Library"
        >
          <HardDrive size={14} className="text-indigo-400" />
          <span>{t('nav.library')}: {stats.totalSongs} {t('common.songs')}</span>
        </button>

        {/* Profile Avatar Quick Switcher */}
        <button
          onClick={() => setProfileModalOpen(true)}
          style={{ borderColor: activeProfile.color || '#6366f1' }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-white/5 border hover:bg-white/10 transition-all cursor-pointer shadow-sm"
          title={`Active Profile: ${activeProfile.name} (Click to switch)`}
        >
          <span className="text-sm">{activeProfile.avatar}</span>
          <span className="hidden md:inline max-w-[80px] truncate">{activeProfile.name}</span>
        </button>
      </div>
    </header>
  );
};
