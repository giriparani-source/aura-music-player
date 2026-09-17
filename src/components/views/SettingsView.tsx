import React, { useRef, useState } from 'react';
import {
  FolderPlus,
  RefreshCw,
  Trash2,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Copy,
  Activity,
  Download,
  Upload,
  Database,
  Sparkles,
  RotateCcw,
  Compass,
  Bot,
  Key,
  Check,
  Users,
  Radio,
  Eye,
  EyeOff
} from 'lucide-react';
import { useJamStore } from '../../store/useJamStore';
import { MusicSourcePickerModal } from '../library/MusicSourcePickerModal';
import { geminiAiService } from '../../services/geminiAiService';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { formatBytes } from '../../utils/formatters';
import { exportLibraryBackup, importLibraryBackup } from '../../services/backupService';
import { musicDB } from '../../services/db';
import { Song } from '../../types/music';
import { auraFlowService, DiscoveryPreference } from '../../services/auraFlowService';
import { auraSkipService } from '../../services/auraSkipService';
import { UserAffinityProfile } from '../../services/auraAffinityService';
import {
  getTopArtists,
  getTopVibes,
  generateProfileSummary
} from '../../services/auraProfileExplainer';

export const SettingsView: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const {
    songs,
    health,
    duplicates,
    scanProgress,
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

  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => geminiAiService.getApiKey());
  const [isGeminiSaved, setIsGeminiSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Social Jam State
  const { isInRoom, roomCode, setJamModalOpen, participants } = useJamStore();

  const handleSaveGeminiKey = () => {
    geminiAiService.setApiKey(geminiApiKey);
    setIsGeminiSaved(true);
    setTimeout(() => setIsGeminiSaved(false), 2500);
  };

  // Aura Flow Controls & Taste Intelligence State
  const discoveryPreference = usePlayerStore((s) => s.discoveryPreference);
  const setDiscoveryPreference = usePlayerStore((s) => s.setDiscoveryPreference);
  const resetAuraMemory = usePlayerStore((s) => s.resetAuraMemory);

  const [auraProfile, setAuraProfile] = useState<UserAffinityProfile | null>(() => auraFlowService.getAffinityProfile());
  const [skipCount, setSkipCount] = useState<number>(() => Object.keys(auraSkipService.getSkipMap()).length);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    auraFlowService.initAffinityProfile().then((p) => {
      if (isMounted) setAuraProfile(p);
    }).catch(() => {});

    auraSkipService.init().then((m) => {
      if (isMounted) setSkipCount(Object.keys(m).length);
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfirmResetAura = async () => {
    setIsResetting(true);
    try {
      await resetAuraMemory();
      setAuraProfile(auraFlowService.getAffinityProfile());
      setSkipCount(0);
      setIsResetConfirmOpen(false);
      setResetSuccessMessage('Aura memory has been safely reset.');
      setTimeout(() => setResetSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Failed to reset Aura memory:', err);
    } finally {
      setIsResetting(false);
    }
  };

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
            onClick={() => setIsSourcePickerOpen(true)}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <FolderPlus size={16} />
            <span>Select Music Folder</span>
          </button>

          <button
            onClick={() => setIsSourcePickerOpen(true)}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-neutral-300 font-medium text-xs border border-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
            <span>Scan Storage & Drive</span>
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

      {/* Section: Aura Flow & Taste Intelligence */}
      <div className="glass-panel p-6 rounded-3xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Aura Flow & Taste Intelligence
              </h3>
              <p className="text-xs text-neutral-400">
                Autonomous personalized music sequencing and listening affinity engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!auraProfile || (auraProfile.totalMeaningfulPlays ?? 0) < 3 ? (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Calibrating
              </span>
            ) : (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Active & Personalized
              </span>
            )}
          </div>
        </div>

        {/* Transient Reset Message */}
        {resetSuccessMessage && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{resetSuccessMessage}</span>
          </div>
        )}

        {/* Telemetry Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-xs text-neutral-400 font-medium">Total Meaningful Plays</p>
            <p className="text-2xl font-bold text-white mt-1">
              {auraProfile?.totalMeaningfulPlays ?? 0}
            </p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Plays lasting ≥ 30 seconds
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-xs text-neutral-400 font-medium">Persistent Skip Signals</p>
            <p className="text-2xl font-bold text-white mt-1">{skipCount}</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Softened negative memory items
            </p>
          </div>
        </div>

        {/* Taste Summary */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-500/5 via-fuchsia-500/5 to-indigo-500/5 border border-white/5 space-y-2">
          <p className="text-xs font-semibold text-neutral-300 uppercase tracking-wider text-[10px]">
            Taste Profile Summary
          </p>
          <p className="text-xs text-neutral-300 leading-relaxed">
            {generateProfileSummary(auraProfile)}
          </p>
        </div>

        {/* Top Affinities */}
        <div className="space-y-4">
          {/* Top Artists */}
          <div>
            <p className="text-xs font-semibold text-neutral-400 mb-2">Top Artist Affinities:</p>
            {getTopArtists(auraProfile, 8).length === 0 ? (
              <p className="text-xs text-neutral-500 italic">
                No artist affinity recorded yet. Listen to tracks to build your profile.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {getTopArtists(auraProfile, 8).map((item) => (
                  <span
                    key={item.artist}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-neutral-200"
                  >
                    <span className="font-medium text-white">{item.displayName}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300">
                      {item.score}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Top Vibes */}
          <div>
            <p className="text-xs font-semibold text-neutral-400 mb-2">Strongest Vibe Affinities:</p>
            {getTopVibes(auraProfile, 5).length === 0 ? (
              <p className="text-xs text-neutral-500 italic">
                No vibe affinity recorded yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {getTopVibes(auraProfile, 5).map((item) => (
                  <span
                    key={item.vibe}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-neutral-200"
                  >
                    <span className="font-medium text-white">{item.displayName}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                      {item.score}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Discovery Preference Controls */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <Compass size={16} className="text-indigo-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Discovery Preference
              </h4>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Controls how often Aura recommends fresh discoveries vs. staying with familiar favorites.
            </p>
          </div>

          {/* 3-way Segmented Control */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {[
              {
                id: 'comfort' as DiscoveryPreference,
                label: 'Comfort',
                threshold: '5 tracks',
                desc: 'Stay closer to familiar favorites.'
              },
              {
                id: 'balanced' as DiscoveryPreference,
                label: 'Balanced',
                threshold: '3 tracks',
                desc: 'A mix of familiar tracks and fresh discoveries.'
              },
              {
                id: 'adventurous' as DiscoveryPreference,
                label: 'Adventurous',
                threshold: '1 track',
                desc: 'Discover new tracks more often.'
              }
            ].map((option) => {
              const isActive = discoveryPreference === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDiscoveryPreference(option.id)}
                  className={`p-3 rounded-xl text-left transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 border-fuchsia-500/40 text-white shadow-lg shadow-fuchsia-500/10'
                      : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">{option.label}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-fuchsia-500/20 text-fuchsia-300 font-semibold' : 'bg-white/5 text-neutral-500'
                    }`}>
                      {option.threshold}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-80">{option.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reset Memory Action */}
        <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-white">Reset Aura Memory</p>
            <p className="text-[11px] text-neutral-500">
              Clear learned artist/vibe affinities and skip penalties without deleting any songs or playlists.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-500/20 transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw size={14} />
            <span>Reset Aura Memory</span>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl max-w-md w-full border border-white/10 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <AlertCircle size={22} />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Reset Aura Flow Memory?</h4>
                <p className="text-xs text-neutral-400">This action recalibrates recommendation intelligence</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-300 space-y-1">
                <p className="font-semibold">This will reset:</p>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-300 text-[11px]">
                  <li>Learned artist affinities</li>
                  <li>Learned vibe affinities</li>
                  <li>Persistent skip memory</li>
                  <li>Active Aura session learning</li>
                  <li>Discovery preference (returns to Balanced)</li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 space-y-1">
                <p className="font-semibold">This will NOT delete:</p>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-300 text-[11px]">
                  <li>Your audio files or library songs</li>
                  <li>Playlists and smart playlists</li>
                  <li>Favorite songs or play counts</li>
                  <li>Listening history & downloaded offline tracks</li>
                  <li>Lyrics and general settings</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleConfirmResetAura}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isResetting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirm Reset</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
      <div className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-3.5">
          <img
            src="/logo.png"
            alt="Aura Music"
            className="w-11 h-11 rounded-2xl object-cover shadow-lg shadow-indigo-600/30 border border-white/10"
          />
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Aura Music Player
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/30">v1.2.1 Native</span>
            </h4>
            <p className="text-[11px] text-neutral-400">Ultra-Fidelity Studio Audio Suite</p>
          </div>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Version 1.2.1 • Android Native & Web Edition. Built with React 19, TypeScript, Tailwind CSS v4, Native Android MediaSession, Foreground Service, and Web Audio API.
        </p>
      </div>

      {/* Section: Aura AI & Google Gemini Assistant */}
      <div className="glass-panel p-6 rounded-3xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <Bot size={20} className="text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Aura AI Assistant & Gemini Intelligence
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    geminiApiKey.trim()
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {geminiApiKey.trim() ? 'Gemini 2.5 Flash Connected' : 'Smart Offline Tanglish NLP'}
                </span>
              </h3>
              <p className="text-xs text-neutral-500">
                Configure Google Gemini API key for high-intelligence voice and text conversation in Tanglish
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Key size={14} className="text-amber-400" />
            <span>Google Gemini API Key</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                name="gemini_api_key_secret"
                id="gemini_api_key_secret"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Enter Google AI Studio Gemini Key (e.g. AIzaSy...)"
                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1 cursor-pointer transition-colors"
                title={showApiKey ? 'Hide Key' : 'Show Key'}
              >
                {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              onClick={handleSaveGeminiKey}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 shrink-0"
            >
              {isGeminiSaved ? <Check size={14} /> : null}
              <span>{isGeminiSaved ? 'Saved!' : 'Save Key'}</span>
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            Free tier API keys are available from Google AI Studio. Even without an API key, Aura AI Assistant can
            fully control playback, Karaoke mode, Equalizer presets, and AI DJ Studio using its built-in offline
            engine.
          </p>
        </div>
      </div>

      {/* Section: Social Jam (Listen Together) */}
      <div className="glass-panel p-6 rounded-3xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 shrink-0 mt-0.5 sm:mt-0">
              <Users size={22} className={isInRoom ? 'animate-pulse' : ''} />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Social Jam (Listen Together)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap inline-flex items-center gap-1.5 ${
                    isInRoom
                      ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 shadow-sm shadow-pink-500/20'
                      : 'bg-white/5 text-neutral-400 border-white/10'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isInRoom ? 'bg-pink-400 animate-ping' : 'bg-neutral-500'}`} />
                  {isInRoom ? `In Room ${roomCode} • ${participants.length + 1} listening` : 'Offline • Ready to Host'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Listen to music in synchronized real-time audio rooms with your friends via WebRTC P2P
              </p>
            </div>
          </div>

          <button
            onClick={() => setJamModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs transition-all cursor-pointer shadow-lg shadow-pink-600/25 flex items-center justify-center gap-2 active:scale-95 shrink-0"
          >
            <Users size={15} />
            <span>{isInRoom ? 'Open Active Room' : 'Host / Join Room'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-xs font-semibold text-white flex items-center gap-1.5 mb-1">
              <Radio size={14} className="text-pink-400" />
              <span>Real-Time Synchronized Playback</span>
            </p>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              When the host plays, pauses, or seeks, everyone in the room hears the exact same timestamp with sub-50ms latency drift compensation.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <p className="text-xs font-semibold text-white flex items-center gap-1.5 mb-1">
              <Users size={14} className="text-purple-400" />
              <span>Zero Account Needed</span>
            </p>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Share a simple 6-digit room code with your friends on Android or web browsers to jam together instantly with live reaction emojis.
            </p>
          </div>
        </div>
      </div>

      <MusicSourcePickerModal
        isOpen={isSourcePickerOpen}
        onClose={() => setIsSourcePickerOpen(false)}
      />
    </div>
  );
};
