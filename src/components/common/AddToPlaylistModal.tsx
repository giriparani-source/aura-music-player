import React, { useState } from 'react';
import { X, Plus, ListMusic, Check } from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  songIds: string[];
  onSuccess?: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  songIds,
  onSuccess
}) => {
  const { playlists, batchAddToPlaylist, createPlaylist } = useLibraryStore();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter out smart playlists for manual addition
  const customPlaylists = playlists.filter((p) => !p.isSmart && !p.id.startsWith('smart-'));

  const handleSelectPlaylist = async (playlistId: string, playlistName: string) => {
    await batchAddToPlaylist(playlistId, songIds);
    setSuccessMessage(`Added ${songIds.length} song${songIds.length > 1 ? 's' : ''} to "${playlistName}"`);
    setTimeout(() => {
      setSuccessMessage(null);
      if (onSuccess) onSuccess();
      onClose();
    }, 900);
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    const newPl = await createPlaylist(newPlaylistName.trim());
    await batchAddToPlaylist(newPl.id, songIds);
    setNewPlaylistName('');
    setIsCreating(false);
    setSuccessMessage(`Created "${newPl.name}" and added ${songIds.length} track${songIds.length > 1 ? 's' : ''}`);
    setTimeout(() => {
      setSuccessMessage(null);
      if (onSuccess) onSuccess();
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#12141a]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ListMusic size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add to Playlist</h3>
              <p className="text-xs text-neutral-400">
                {songIds.length} song{songIds.length > 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Banner */}
        {successMessage ? (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-emerald-300 text-xs font-semibold animate-in zoom-in-95">
            <Check size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : (
          <>
            {/* Create New Playlist Button / Inline Form */}
            {!isCreating ? (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 transition-colors text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus size={15} />
                <span>Create New Playlist</span>
              </button>
            ) : (
              <form onSubmit={handleCreateAndAdd} className="space-y-2.5 bg-white/5 p-3 rounded-xl border border-white/10">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Playlist title (e.g. Chill Tamil Vibes)..."
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setNewPlaylistName('');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newPlaylistName.trim()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                  >
                    Create & Add
                  </button>
                </div>
              </form>
            )}

            {/* Existing Playlists List */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {customPlaylists.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-500">
                  No custom playlists yet. Create your first playlist above!
                </div>
              ) : (
                customPlaylists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleSelectPlaylist(pl.id, pl.name)}
                    className="w-full p-2.5 rounded-xl hover:bg-white/5 flex items-center justify-between text-left transition-colors group cursor-pointer border border-transparent hover:border-white/5"
                  >
                    <div className="min-w-0 pr-2">
                      <h4 className="text-xs font-semibold text-neutral-200 group-hover:text-indigo-300 truncate">
                        {pl.name}
                      </h4>
                      <p className="text-[11px] text-neutral-500">
                        {pl.songIds.length} track{pl.songIds.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Plus size={14} className="text-neutral-500 group-hover:text-white shrink-0" />
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
