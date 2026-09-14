import React, { useRef } from 'react';
import { Search, FolderPlus, HardDrive } from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';

import { usePlayerStore } from '../../store/usePlayerStore';
import { Sparkles } from 'lucide-react';

export const Header: React.FC = () => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const setAiAssistantOpen = usePlayerStore((s) => s.setAiAssistantOpen);
  const {
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    stats,
    scanFromDirectoryHandle,
    scanFromFileList
  } = useLibraryStore();

  const handleSelectFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        await scanFromDirectoryHandle(dirHandle);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }
    folderInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await scanFromFileList(files);
  };

  return (
    <header className="h-16 border-b border-white/5 bg-[#0b0d13]/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0 select-none z-10">
      {/* Search Input shortcut (hidden on dedicated Search view to avoid duplicate inputs) */}
      {activeTab !== 'search' ? (
        <div className="relative w-72 max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveTab('search');
            }}
            placeholder="Search songs, artists, albums..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500/60 transition-all"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Search size={15} className="text-neutral-400" />
          <span className="text-xs font-bold text-neutral-300 tracking-wide">Search Music</span>
        </div>
      )}

      {/* Hidden Folder Picker Input */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileInputChange}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
      />

      {/* Right Header Actions */}
      <div className="flex items-center gap-2.5">
        {/* Sleek Embedded Ask AI Trigger (replaces floating screen clutter) */}
        <button
          onClick={() => setAiAssistantOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-indigo-300 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 transition-all cursor-pointer shadow-sm"
          title="Chat with Aura AI Assistant"
        >
          <Sparkles size={14} className="text-amber-400" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          title="Go to Library"
        >
          <HardDrive size={14} className="text-indigo-400" />
          <span>Local Library: {stats.totalSongs} songs</span>
        </button>

        <button
          onClick={handleSelectFolder}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] cursor-pointer"
          title="Open Music Folder Picker"
        >
          <FolderPlus size={15} />
          <span className="hidden sm:inline">Select Folder</span>
        </button>
      </div>
    </header>
  );
};
