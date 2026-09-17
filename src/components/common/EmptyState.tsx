import React, { useRef, useState } from 'react';
import { FolderPlus, Music2, Sparkles, HardDrive, RefreshCw } from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { MusicSourcePickerModal } from '../library/MusicSourcePickerModal';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No music yet',
  description = 'Select your music folder to build your personal local library.'
}) => {
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { scanProgress, scanFromFileList } = useLibraryStore();

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await scanFromFileList(files);
  };

  const isScanning = scanProgress.status === 'scanning';

  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center max-w-lg mx-auto my-12 glass-card rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6 shadow-inner">
        {isScanning ? (
          <RefreshCw size={36} className="animate-spin text-indigo-400" />
        ) : (
          <Music2 size={38} className="stroke-[1.5]" />
        )}
      </div>

      <h3 className="text-2xl font-bold tracking-tight text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 mb-8 leading-relaxed max-w-sm">
        {description}
      </p>

      {/* Hidden file input supporting directory selection */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
      />

      {isScanning ? (
        <div className="w-full space-y-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-300">Scanning collection...</span>
            <span className="font-mono text-neutral-400 tabular-nums">
              {scanProgress.processedCount} / {scanProgress.totalCount}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-150"
              style={{
                width: `${scanProgress.totalCount > 0 ? (scanProgress.processedCount / scanProgress.totalCount) * 100 : 0}%`
              }}
            />
          </div>
          <p className="text-[11px] text-neutral-400 truncate">{scanProgress.currentFile}</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsSourcePickerOpen(true)}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            <FolderPlus size={18} />
            <span>Select Music Folder</span>
          </button>

          <button
            onClick={() => setIsSourcePickerOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white/5 hover:bg-white/10 text-neutral-300 font-medium text-sm rounded-xl border border-white/10 transition-all cursor-pointer"
          >
            <HardDrive size={16} />
            <span>Browse Music Sources</span>
          </button>
        </div>
      )}

      <div className="mt-8 flex items-center gap-2 text-xs text-neutral-500">
        <Sparkles size={14} className="text-indigo-400" />
        <span>Supports Device Storage & Google Drive Folders</span>
      </div>

      <MusicSourcePickerModal
        isOpen={isSourcePickerOpen}
        onClose={() => setIsSourcePickerOpen(false)}
      />
    </div>
  );
};
