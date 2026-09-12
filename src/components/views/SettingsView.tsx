import React, { useRef, useState } from 'react';
import {
  FolderPlus,
  RefreshCw,
  Trash2,
  HardDrive,
  Info,
  CheckCircle2,
  AlertCircle,
  Copy,
  Activity,
  Download,
  Upload,
  Database
} from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { formatBytes } from '../../utils/formatters';
import { exportLibraryBackup, importLibraryBackup } from '../../services/backupService';
import { musicDB } from '../../services/db';
import { Song } from '../../types/music';

export const SettingsView: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const {
    songs,
    health,
    duplicates,
    scanProgress,
    scanFromDirectoryHandle,
    scanFromFileList,
    clearLibrary,
    loadLibrary
  } = useLibraryStore();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleRemoveDuplicateSong = async (songId: string, title: string) => {
    if (window.confirm(`Remove duplicate "${title}" from library index? (Original audio file will not be deleted)`)) {
      await musicDB.deleteSong(songId);
      await loadLibrary();
    }
  };

  const handleAutoCleanGroup = async (dupSongs: Song[]) => {
    if (dupSongs.length <= 1) return;
    const toRemove = dupSongs.slice(1);
    if (window.confirm(`Keep 1st track and remove ${toRemove.length} duplicate copy records from the library?`)) {
      for (const s of toRemove) {
        await musicDB.deleteSong(s.id);
      }
      await loadLibrary();
    }
  };

  const handleNativePicker = async () => {
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
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await scanFromFileList(files);
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      await exportLibraryBackup();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      const res = await importLibraryBackup(file);
      if (res.success) {
        await loadLibrary();
        setImportStatus({
          type: 'success',
          message: `Backup restored successfully! Restored ${res.playlistsImported} playlists, ${res.favoritesUpdated} favorites, and ${res.playCountsUpdated} play records.`
        });
      } else {
        setImportStatus({
          type: 'error',
          message: res.errors.join(' ') || 'Failed to restore backup.'
        });
      }
    } catch (err) {
      setImportStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Import failed.'
      });
    } finally {
      setIsImporting(false);
      if (backupInputRef.current) {
        backupInputRef.current.value = '';
      }
    }
  };

  const isScanning = scanProgress.status === 'scanning';
  const result = scanProgress.result;

  return (
    <div className="p-6 sm:p-8 space-y-10 max-w-4xl mx-auto select-none pb-24">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">Settings & Diagnostics</h2>
        <p className="text-sm text-neutral-400 mt-1">
          Manage local library scanning, JSON backups, health metrics, and audio diagnostics
        </p>
      </div>

      {/* Hidden Folder Picker */}
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

      {/* Hidden Backup File Picker */}
      <input
        type="file"
        ref={backupInputRef}
        onChange={handleBackupFileSelected}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Section 1: Music Folder Scanner */}
      <div className="glass-panel p-6 rounded-3xl space-y-5">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <HardDrive size={20} className="text-indigo-400" />
          <div>
            <h3 className="text-base font-bold text-white">Music Folder Scanner</h3>
            <p className="text-xs text-neutral-500">Scan audio files (MP3, OPUS, WAV, M4A, FLAC) from local storage</p>
          </div>
        </div>

        {/* Scan Status Display */}
        {isScanning && (
          <div className="p-4 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw size={15} className="animate-spin text-indigo-400" />
                <span className="font-semibold">Differential scan in progress...</span>
              </div>
              <span className="font-mono tabular-nums">
                {scanProgress.processedCount} / {scanProgress.totalCount}
              </span>
            </div>
            <p className="text-[11px] text-indigo-300/70 truncate">{scanProgress.currentFile}</p>
          </div>
        )}

        {scanProgress.status === 'complete' && result && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 size={18} />
              <span>Scan Complete ({result.durationMs}ms)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-neutral-300">
              <div className="p-2 rounded-lg bg-black/20 text-center">
                <span className="text-emerald-400 font-bold block">{result.added}</span>
                <span className="text-[10px] text-neutral-400">Added</span>
              </div>
              <div className="p-2 rounded-lg bg-black/20 text-center">
                <span className="text-indigo-400 font-bold block">{result.updated}</span>
                <span className="text-[10px] text-neutral-400">Updated</span>
              </div>
              <div className="p-2 rounded-lg bg-black/20 text-center">
                <span className="text-neutral-300 font-bold block">{result.unchanged}</span>
                <span className="text-[10px] text-neutral-400">Unchanged</span>
              </div>
              <div className="p-2 rounded-lg bg-black/20 text-center">
                <span className="text-amber-400 font-bold block">{result.missing}</span>
                <span className="text-[10px] text-neutral-400">Missing</span>
              </div>
              <div className="p-2 rounded-lg bg-black/20 text-center">
                <span className="text-rose-400 font-bold block">{result.failed}</span>
                <span className="text-[10px] text-neutral-400">Failed</span>
              </div>
            </div>
          </div>
        )}

        {scanProgress.status === 'error' && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle size={16} />
            <span>{scanProgress.errorMessage || 'Scan failed.'}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleNativePicker}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <FolderPlus size={16} />
            <span>Select Music Folder</span>
          </button>

          <button
            onClick={handleNativePicker}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-neutral-300 font-medium text-xs border border-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
            <span>Rescan Library</span>
          </button>

          <button
            onClick={clearLibrary}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium text-xs border border-rose-500/20 transition-colors ml-auto cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Clear Library</span>
          </button>
        </div>
      </div>

      {/* Section 2: Data Management & Backup (Phase 3) */}
      <div className="glass-panel p-6 rounded-3xl space-y-5">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <Database size={20} className="text-indigo-400" />
          <div>
            <h3 className="text-base font-bold text-white">Library Backups & Data Management</h3>
            <p className="text-xs text-neutral-500">
              Export and restore custom playlists, favorites, play history, and settings as JSON
            </p>
          </div>
        </div>

        {/* Status alert */}
        {importStatus && (
          <div
            className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
              importStatus.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {importStatus.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">{importStatus.message}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Export Card */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-xs">
              <Download size={15} className="text-indigo-400" />
              <span>Export Library Backup</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Creates a portable JSON file of your custom playlists, favorites, and play statistics. Audio files are never modified.
            </p>
            <button
              onClick={handleExportBackup}
              disabled={isExporting || songs.length === 0}
              className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>{isExporting ? 'Exporting...' : 'Download JSON Backup'}</span>
            </button>
          </div>

          {/* Import Card */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-xs">
              <Upload size={15} className="text-emerald-400" />
              <span>Restore from Backup</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Restore playlists and listening stats from a previous Aura backup JSON file. Matches tracks automatically by path or title.
            </p>
            <button
              onClick={() => backupInputRef.current?.click()}
              disabled={isImporting}
              className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Upload size={14} />
              <span>{isImporting ? 'Restoring Data...' : 'Choose Backup JSON'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Real Library Health Diagnostics */}
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-white">Library Health Diagnostics</h3>
              <p className="text-xs text-neutral-500">Real dynamic metrics computed from your collection</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-400">Score:</span>
            <span
              className={`text-sm font-bold font-mono px-2 py-0.5 rounded-md ${
                health.healthScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {health.healthScore}%
            </span>
          </div>
        </div>

        {/* Health Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <p className="text-xs text-neutral-500">Total Tracks</p>
            <p className="text-xl font-bold text-white mt-1">{health.totalSongs}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <p className="text-xs text-neutral-500">Storage Used</p>
            <p className="text-xl font-bold text-white mt-1">{formatBytes(health.totalStorageBytes)}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <p className="text-xs text-neutral-500">Missing Artwork</p>
            <p className="text-xl font-bold text-amber-400 mt-1">{health.missingArtworkCount}</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <p className="text-xs text-neutral-500">Missing Metadata</p>
            <p className="text-xl font-bold text-amber-400 mt-1">
              {health.missingArtistCount + health.missingAlbumCount}
            </p>
          </div>
        </div>

        {/* Supported Formats Breakdown */}
        <div className="pt-2">
          <p className="text-xs font-semibold text-neutral-400 mb-2">Detected Audio Formats:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(health.formats).map(([fmt, count]) => (
              <span key={fmt} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-neutral-300">
                <span className="uppercase text-indigo-400 font-bold">{fmt}</span>: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Section 4: Duplicate Detection & Resolution */}
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <Copy size={20} className="text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white">Duplicate Detection & Resolution</h3>
              <p className="text-xs text-neutral-500">Scored by title similarity, duration, and file size</p>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {duplicates.length} potential groups
          </span>
        </div>

        {duplicates.length === 0 ? (
          <p className="text-xs text-neutral-500 py-3">
            ✓ No duplicate files detected in library. Your collection is clean!
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {duplicates.slice(0, 15).map((dup) => (
              <div key={dup.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white truncate">{dup.canonicalTitle}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {dup.similarityScore}% match
                    </span>
                    {dup.songs.length > 1 && (
                      <button
                        onClick={() => handleAutoCleanGroup(dup.songs)}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 transition-colors cursor-pointer"
                        title="Keep first copy and remove all duplicate records"
                      >
                        Keep 1st Only
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-neutral-500 flex flex-wrap gap-1">
                  {dup.reasons.map((r, idx) => (
                    <span key={idx} className="px-1.5 py-0.2 rounded bg-white/5 text-neutral-400">
                      {r}
                    </span>
                  ))}
                </div>
                <div className="space-y-1.5 pt-1">
                  {dup.songs.map((s, idx) => (
                    <div key={s.id} className="text-[11px] p-2 rounded-xl bg-white/[0.03] border border-white/5 text-neutral-300 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-white/5 text-neutral-400">
                            #{idx + 1}
                          </span>
                          <span className="truncate font-medium text-white">{s.title || s.fileName}</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                          📁 {s.folder || 'Root'} • {formatBytes(s.fileSize)} • {s.format?.toUpperCase() || 'MP3'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveDuplicateSong(s.id, s.title || s.fileName)}
                        className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                        title="Remove this duplicate entry"
                      >
                        <Trash2 size={12} />
                        <span>Remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 5: About Application */}
      <div className="glass-panel p-6 rounded-3xl space-y-3">
        <div className="flex items-center gap-3">
          <Info size={18} className="text-indigo-400" />
          <h4 className="text-sm font-bold text-white">About Aura Music Player</h4>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Version 1.2.0 • Phase 3 Library UX & Filtering. Built with React 19, TypeScript, Tailwind CSS v4, Native IndexedDB, and Web Audio API. 
          Engine features differential file scanning, debounced fuzzy search, batch multi-actions, JSON backup/restore, and deterministic song indexing.
        </p>
      </div>
    </div>
  );
};
