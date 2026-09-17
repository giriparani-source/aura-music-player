import React, { useState, useMemo, useRef } from 'react';
import {
  Smartphone,
  Cloud,
  X,
  Music,
  Folder,
  FolderCheck,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Search,
  HardDrive
} from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { musicDB } from '../../services/db';
import { androidMediaBridge } from '../../services/androidMediaBridge';
import { GOOGLE_DRIVE_MANIFEST } from '../../data/cloudManifestData';
import { Song } from '../../types/music';

interface MusicSourcePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MusicSourcePickerModal: React.FC<MusicSourcePickerModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'internal' | 'gdrive'>('internal');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanningDevice, setIsScanningDevice] = useState(false);
  const [deviceScanResult, setDeviceScanResult] = useState<string | null>(null);
  const [importingFolder, setImportingFolder] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { songs, loadLibrary, scanFromFileList } = useLibraryStore();

  // Map existing songs to quick lookups
  const existingSongPaths = useMemo(() => {
    return new Set(songs.map((s) => s.path || s.fileName || s.title));
  }, [songs]);

  // Group Google Drive Manifest by Folder
  const driveFolders = useMemo(() => {
    const map = new Map<string, Song[]>();
    for (const song of GOOGLE_DRIVE_MANIFEST) {
      const folderName = song.folder || 'Google Drive Root';
      if (!map.has(folderName)) {
        map.set(folderName, []);
      }
      map.get(folderName)!.push(song);
    }
    return Array.from(map.entries()).map(([name, tracks]) => ({
      name,
      tracks,
      count: tracks.length,
      isFullyImported: tracks.every((t) => existingSongPaths.has(t.path || t.fileName || t.title))
    }));
  }, [existingSongPaths]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return driveFolders;
    const q = searchQuery.toLowerCase();
    return driveFolders.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.tracks.some((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    );
  }, [driveFolders, searchQuery]);

  if (!isOpen) return null;

  // 1. Android Native MediaStore Scanner
  const handleScanDeviceStorage = async () => {
    setIsScanningDevice(true);
    setDeviceScanResult(null);

    try {
      const res = await androidMediaBridge.scanDeviceAudio();
      if (res && res.tracks && res.tracks.length > 0) {
        const formattedSongs: Song[] = res.tracks.map((t: any) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          path: t.contentUri || t.path,
          filePath: t.path,
          fileName: t.title,
          format: 'audio',
          bitrate: 320,
          fileSize: t.fileSize || 0,
          dateAdded: t.dateAdded || Date.now(),
          playCount: 0,
          isFavorite: false,
          isOnline: false
        }));

        await musicDB.saveSongsBatch(formattedSongs);
        await loadLibrary();
        setDeviceScanResult(`Successfully scanned and added ${formattedSongs.length} songs from phone storage!`);
      } else {
        // Not native Android or no songs found via MediaStore; trigger standard file picker
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      console.warn('Device scan fallback to file input:', err);
      fileInputRef.current?.click();
    } finally {
      setIsScanningDevice(false);
    }
  };

  // 2. Standard Audio File Picker Handler
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsScanningDevice(true);
      await scanFromFileList(files);
      setDeviceScanResult(`Imported ${files.length} audio file(s) into your library!`);
    } catch (err: any) {
      setDeviceScanResult(`Scan error: ${err.message}`);
    } finally {
      setIsScanningDevice(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 3. Import Specific Google Drive Folder
  const handleImportFolder = async (folderName: string, tracks: Song[]) => {
    setImportingFolder(folderName);
    try {
      await musicDB.saveSongsBatch(tracks);
      await loadLibrary();
      setImportSuccessMessage(`Imported ${tracks.length} tracks from "${folderName}"!`);
      setTimeout(() => setImportSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to import folder:', err);
    } finally {
      setImportingFolder(null);
    }
  };

  // 4. Import All Google Drive Folders
  const handleImportAllDriveFolders = async () => {
    setImportingFolder('ALL');
    try {
      await musicDB.saveSongsBatch(GOOGLE_DRIVE_MANIFEST);
      await loadLibrary();
      setImportSuccessMessage(`All ${GOOGLE_DRIVE_MANIFEST.length} Google Drive songs imported successfully!`);
      setTimeout(() => setImportSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to import all drive folders:', err);
    } finally {
      setImportingFolder(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      {/* Hidden File Picker: Audio only, no webkitdirectory breaking Android */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        accept="audio/*,.mp3,.m4a,.wav,.flac,.opus,.aac,.ogg"
        multiple
        className="hidden"
      />

      <div className="w-full max-w-2xl bg-[#0e1118] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <HardDrive size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Music Library Scanner</h3>
              <p className="text-xs text-neutral-400">Scan phone internal storage or import Google Drive folders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10 px-6 pt-3 gap-6 bg-black/20">
          <button
            onClick={() => setActiveTab('internal')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'internal'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Smartphone size={16} />
            <span>Device Storage (Internal)</span>
          </button>
          <button
            onClick={() => setActiveTab('gdrive')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'gdrive'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Cloud size={16} />
            <span>Google Drive Folders</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
              {GOOGLE_DRIVE_MANIFEST.length}
            </span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {importSuccessMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-fade-in">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{importSuccessMessage}</span>
            </div>
          )}

          {/* TAB 1: INTERNAL DEVICE STORAGE */}
          {activeTab === 'internal' && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                <div className="flex items-center gap-2.5 text-white font-semibold text-sm">
                  <Smartphone size={18} className="text-indigo-400" />
                  <span>Phone Internal Storage & SD Card</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Scan all offline MP3, M4A, FLAC, and WAV audio tracks stored in your device's Music, Downloads,
                  WhatsApp Audio, or internal storage folders.
                </p>

                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    onClick={handleScanDeviceStorage}
                    disabled={isScanningDevice}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
                  >
                    <RefreshCw size={15} className={isScanningDevice ? 'animate-spin' : ''} />
                    <span>{isScanningDevice ? 'Scanning Phone Storage...' : 'Auto-Scan All Device Songs'}</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanningDevice}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-neutral-300 font-medium text-xs border border-white/10 transition-colors cursor-pointer"
                  >
                    <Folder size={15} />
                    <span>Browse Audio Files</span>
                  </button>
                </div>
              </div>

              {deviceScanResult && (
                <div className="p-4 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{deviceScanResult}</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-1">
                  <span className="font-semibold block text-amber-300">Android Storage Note</span>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">
                    If prompted on Android, allow Audio / Media permissions so Aura can scan and index your local music
                    library.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE DRIVE FOLDERS */}
          {activeTab === 'gdrive' && (
            <div className="space-y-5">
              {/* Top Banner with Bulk Import */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-black border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Cloud size={18} className="text-indigo-400" />
                    <span>Google Drive Music Folders</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {GOOGLE_DRIVE_MANIFEST.length} master tracks organized across {driveFolders.length} curated folders
                  </p>
                </div>

                <button
                  onClick={handleImportAllDriveFolders}
                  disabled={importingFolder !== null}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
                >
                  <UploadCloud size={15} className={importingFolder === 'ALL' ? 'animate-bounce' : ''} />
                  <span>{importingFolder === 'ALL' ? 'Importing All...' : 'Import All (435 Songs)'}</span>
                </button>
              </div>

              {/* Folder Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search Google Drive folders or artists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-neutral-500 text-xs focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              {/* Folders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredFolders.map((folder) => {
                  const isImportingThis = importingFolder === folder.name;
                  return (
                    <div
                      key={folder.name}
                      className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 transition-all flex flex-col justify-between gap-3 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                            <Folder size={15} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">{folder.name}</h4>
                            <p className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
                              <Music size={11} />
                              <span>{folder.count} tracks</span>
                            </p>
                          </div>
                        </div>

                        {folder.isFullyImported ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 shrink-0">
                            <FolderCheck size={12} />
                            <span>Imported</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleImportFolder(folder.name, folder.tracks)}
                            disabled={importingFolder !== null}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-indigo-600 text-white font-medium text-[11px] transition-all cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            <UploadCloud size={12} className={isImportingThis ? 'animate-bounce' : ''} />
                            <span>{isImportingThis ? 'Importing...' : 'Import'}</span>
                          </button>
                        )}
                      </div>

                      {/* Sample Song previews */}
                      <div className="text-[10px] text-neutral-500 truncate">
                        e.g. {folder.tracks.slice(0, 2).map((t) => t.title).join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.01] flex items-center justify-between">
          <p className="text-[11px] text-neutral-500">
            Total Library Songs: <span className="text-white font-semibold">{songs.length}</span>
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
