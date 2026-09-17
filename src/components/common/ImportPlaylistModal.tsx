import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  UploadCloud,
  Check,
  Clipboard,
  Sparkles,
  Music2,
  AlertCircle,
  Play,
  Library,
  ListMusic
} from 'lucide-react';
import {
  detectPlatform,
  importUniversalPlaylist,
  saveImportedPlaylistToLibrary,
  ImportedPlaylistResult,
  ImportProgress
} from '../../services/universalPlaylistImporter';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';

interface ImportPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (playlistId: string) => void;
}

export const ImportPlaylistModal: React.FC<ImportPlaylistModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess
}) => {
  const [inputText, setInputText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportedPlaylistResult | null>(null);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const { playSong } = usePlayerStore();
  const { setActivePlaylistId, setActiveTab, setLibrarySubTab } = useLibraryStore();

  const detectedPlatform = useMemo(() => {
    return inputText.trim() ? detectPlatform(inputText) : 'unknown';
  }, [inputText]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputText('');
      setIsImporting(false);
      setProgress(null);
      setResult(null);
      setError(null);
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text.trim());
      }
    } catch (e) {
      console.warn('Clipboard read permission denied or not supported', e);
    }
  };

  const handleStartImport = async () => {
    if (!inputText.trim()) {
      setError('Please enter a Spotify, YouTube, JioSaavn link or paste a song list.');
      return;
    }

    setError(null);
    setIsImporting(true);
    setProgress({
      current: 0,
      total: 100,
      percent: 5,
      status: 'Analyzing link and connecting to 320kbps streams...'
    });

    try {
      const res = await importUniversalPlaylist(inputText, (prog) => {
        setProgress(prog);
      });

      setResult(res);
      setPlaylistTitle(res.title);
      setIsImporting(false);
    } catch (err: any) {
      console.error('Import failed:', err);
      setError(err?.message || 'Failed to import playlist. Please check your link or paste song names.');
      setIsImporting(false);
      setProgress(null);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!result) return;
    try {
      const customResult = { ...result, title: playlistTitle.trim() || result.title };
      const savedPlaylist = await saveImportedPlaylistToLibrary(customResult);
      setIsSaved(true);

      if (onImportSuccess) {
        onImportSuccess(savedPlaylist.id);
      }

      setTimeout(() => {
        setActivePlaylistId(savedPlaylist.id);
        setActiveTab('library');
        setLibrarySubTab('playlists');
        onClose();
      }, 700);
    } catch (err: any) {
      setError('Failed to save to library: ' + err.message);
    }
  };

  const handlePlayNow = async () => {
    if (!result || result.songs.length === 0) return;
    try {
      const customResult = { ...result, title: playlistTitle.trim() || result.title };
      const savedPlaylist = await saveImportedPlaylistToLibrary(customResult);
      playSong(result.songs[0], result.songs);
      setActivePlaylistId(savedPlaylist.id);
      setActiveTab('library');
      setLibrarySubTab('playlists');
      onClose();
    } catch (err: any) {
      console.error('Play now error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#11131a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center text-cyan-400">
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Universal Playlist Importer
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                  320kbps HD
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                Import from Spotify, YouTube, JioSaavn or text
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {/* Platform Badges */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-neutral-400 text-[11px] font-medium mr-1">Supported:</span>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                detectedPlatform === 'spotify'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold scale-105 shadow-sm shadow-emerald-500/20'
                  : 'bg-neutral-900 border-white/10 text-neutral-400'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-[#1DB954]" />
              Spotify
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                detectedPlatform === 'youtube'
                  ? 'bg-red-500/20 border-red-500/50 text-red-300 font-semibold scale-105 shadow-sm shadow-red-500/20'
                  : 'bg-neutral-900 border-white/10 text-neutral-400'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-[#FF0000]" />
              YouTube
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                detectedPlatform === 'jiosaavn'
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-semibold scale-105 shadow-sm shadow-cyan-500/20'
                  : 'bg-neutral-900 border-white/10 text-neutral-400'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-[#00D2C4]" />
              JioSaavn
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                detectedPlatform === 'text'
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-semibold scale-105 shadow-sm shadow-indigo-500/20'
                  : 'bg-neutral-900 border-white/10 text-neutral-400'
              }`}
            >
              <ListMusic size={12} className="text-indigo-400" />
              Song Names
            </div>
          </div>

          {!result ? (
            <>
              {/* Input Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-300">
                    Paste Playlist Link or Song Titles
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    disabled={isImporting}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors py-0.5 px-2 rounded-md hover:bg-cyan-500/10"
                  >
                    <Clipboard size={13} />
                    Paste Clipboard
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isImporting}
                    placeholder={`e.g.\n• https://open.spotify.com/playlist/...\n• https://www.youtube.com/playlist?list=...\n• https://www.jiosaavn.com/featured/...\n• Or paste songs: "Hukum - Anirudh", "Naa Ready"...`}
                    className="w-full px-3.5 py-3 rounded-xl bg-neutral-900/90 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono resize-none"
                  />
                </div>
              </div>

              {/* Live Import Progress */}
              {isImporting && progress && (
                <div className="p-4 rounded-xl bg-neutral-900/90 border border-cyan-500/30 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-cyan-400 flex items-center gap-2">
                      <Sparkles size={14} className="animate-spin text-cyan-400" />
                      {progress.status}
                    </span>
                    <span className="text-neutral-400 font-mono text-[11px]">{progress.percent}%</span>
                  </div>

                  {/* Glowing Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-neutral-400 text-center">
                    Auto-converting to verified 320kbps CD-Quality Audio Streams • Zero Local Server
                  </p>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1">
                    <p className="font-medium">{error}</p>
                    <p className="text-[11px] text-rose-300/80 mt-1">
                      Tip: If URL extraction is blocked by copyright, you can copy and paste the track names directly!
                    </p>
                  </div>
                </div>
              )}

              {/* Preset quick links / Suggestions */}
              {!isImporting && (
                <div className="pt-2">
                  <p className="text-[11px] text-neutral-400 mb-2 font-medium">Try Popular Playlists:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        setInputText('https://www.jiosaavn.com/featured/tamil-india-superhits-top-50/1134651042')
                      }
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5 transition-colors flex items-center gap-1.5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      Top 50 Tamil
                    </button>
                    <button
                      onClick={() =>
                        setInputText('https://www.jiosaavn.com/featured/tamil-1990s/1170578779')
                      }
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5 transition-colors flex items-center gap-1.5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Tamil 90s Hits
                    </button>
                    <button
                      onClick={() =>
                        setInputText('https://www.jiosaavn.com/featured/tamil-bgm/1074590003')
                      }
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5 transition-colors flex items-center gap-1.5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      Tamil BGM Masterpieces
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Result Preview Screen */
            <div className="space-y-4 animate-in fade-in">
              {/* Playlist Summary Card */}
              <div className="p-4 rounded-xl bg-neutral-900/90 border border-white/10 flex items-center gap-4">
                {result.coverArt ? (
                  <img
                    src={result.coverArt}
                    alt={result.title}
                    className="w-18 h-18 rounded-xl object-cover shadow-md shrink-0 border border-white/10"
                  />
                ) : (
                  <div className="w-18 h-18 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0">
                    <Music2 size={24} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                    Ready to Save
                  </span>
                  <input
                    type="text"
                    value={playlistTitle}
                    onChange={(e) => setPlaylistTitle(e.target.value)}
                    className="w-full bg-transparent text-white font-bold text-base border-b border-transparent hover:border-white/20 focus:border-cyan-400 focus:outline-none py-0.5 truncate"
                  />
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {result.matchedTracks} of {result.totalTracks} tracks ready • {result.songs[0]?.id?.startsWith('online_') ? 'YouTube Audio' : '320kbps HD'}
                  </p>
                </div>
              </div>

              {/* Song List Preview */}
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                <div className="text-[11px] text-neutral-400 font-medium px-2 py-1 flex items-center justify-between">
                  <span>TRACK PREVIEW</span>
                  <span>SOURCE</span>
                </div>
                {result.songs.map((song, idx) => (
                  <div
                    key={song.id || idx}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-900/50 hover:bg-neutral-800/60 border border-white/5 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-neutral-500 text-[11px] w-4 text-right">{idx + 1}</span>
                      <img
                        src={song.artwork || song.coverArt}
                        alt={song.title}
                        className="w-8 h-8 rounded-md object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium truncate text-xs">{song.title}</p>
                        <p className="text-neutral-400 truncate text-[11px]">{song.artist}</p>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0 ml-2">
                      {song.id?.startsWith('online_') ? 'YouTube' : '320k'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/40 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {!result ? (
            <button
              onClick={handleStartImport}
              disabled={isImporting || !inputText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <Sparkles size={14} />
              {isImporting ? 'Importing...' : 'Fetch & Convert Playlist'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePlayNow}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-neutral-200 bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
              >
                <Play size={14} fill="currentColor" />
                Play Now
              </button>
              <button
                onClick={handleSaveToLibrary}
                disabled={isSaved}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all disabled:opacity-75"
              >
                {isSaved ? (
                  <>
                    <Check size={14} />
                    Saved!
                  </>
                ) : (
                  <>
                    <Library size={14} />
                    Save to My Library
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
