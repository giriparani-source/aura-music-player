import React, { useState } from 'react';
import { Plus, ListMusic, Play, Trash2, ArrowLeft } from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SongRow } from '../common/SongRow';
import { EmptyState } from '../common/EmptyState';

export const PlaylistsView: React.FC = () => {
  const { songs, playlists, activePlaylistId, setActivePlaylistId, createPlaylist, deletePlaylist } = useLibraryStore();
  const { playSong } = usePlayerStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');

  if (songs.length === 0) {
    return <EmptyState />;
  }

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const pl = await createPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim());
    setNewPlaylistName('');
    setNewPlaylistDesc('');
    setIsModalOpen(false);
    setActivePlaylistId(pl.id);
  };

  const getPlaylistSongs = (pl: any) => {
    if (pl.id === 'smart-favorites') return songs.filter((s) => s.isFavorite);
    if (pl.id === 'smart-recent') return [...songs].filter((s) => s.lastPlayed).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)).slice(0, 30);
    if (pl.id === 'smart-most-played') return [...songs].filter((s) => s.playCount > 0).sort((a, b) => b.playCount - a.playCount).slice(0, 30);
    if (pl.id === 'smart-recent-added') return [...songs].sort((a, b) => b.dateAdded - a.dateAdded).slice(0, 30);
    return songs.filter((s) => pl.songIds.includes(s.id));
  };

  const handlePlayPlaylist = (e: React.MouseEvent, pl: any) => {
    e.stopPropagation();
    const plSongs = getPlaylistSongs(pl);
    if (plSongs.length > 0) {
      playSong(plSongs[0], plSongs);
    }
  };

  // If inside a specific playlist view:
  if (activePlaylist) {
    // Resolve songs in this playlist
    const playlistSongs = getPlaylistSongs(activePlaylist);

    return (
      <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto select-none">
        {/* Back button */}
        <button
          onClick={() => setActivePlaylistId(null)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span>All Playlists</span>
        </button>

        {/* Playlist Banner */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 shrink-0">
              <ListMusic size={36} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{activePlaylist.name}</h2>
              <p className="text-xs text-neutral-400 mt-1">{activePlaylist.description || 'Personal playlist'}</p>
              <p className="text-[11px] text-neutral-500 font-mono mt-2">
                {playlistSongs.length} {playlistSongs.length === 1 ? 'song' : 'songs'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {playlistSongs.length > 0 && (
              <button
                onClick={() => playSong(playlistSongs[0], playlistSongs)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all"
              >
                <Play size={14} className="fill-white ml-0.5" />
                <span>Play All</span>
              </button>
            )}

            {!activePlaylist.isSmart && (
              <button
                onClick={() => deletePlaylist(activePlaylist.id)}
                className="p-2.5 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
                title="Delete playlist"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Songs List */}
        <div className="space-y-1">
          {playlistSongs.length === 0 ? (
            <div className="text-center py-16 text-neutral-500">
              <p className="text-sm font-semibold text-neutral-400 mb-1">No songs in this playlist yet</p>
              <p className="text-xs text-neutral-500">Go to your library and add songs to this playlist.</p>
            </div>
          ) : (
            playlistSongs.map((song, idx) => (
              <SongRow key={song.id} song={song} index={idx} playlistContext={playlistSongs} />
            ))
          )}
        </div>
      </div>
    );
  }

  // Playlists Index View
  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto select-none">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Playlists</h2>
          <p className="text-sm text-neutral-400 mt-1">Smart mixes and customized collections</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Playlists Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {playlists.map((pl) => (
          <div
            key={pl.id}
            onClick={() => setActivePlaylistId(pl.id)}
            className="glass-card p-5 rounded-2xl cursor-pointer group hover:border-indigo-500/30 transition-all flex flex-col justify-between h-44"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center mb-3">
                <ListMusic size={20} />
              </div>
              <h4 className="text-base font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                {pl.name}
              </h4>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{pl.description || 'Custom playlist'}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-neutral-400 font-medium">
              <span>{pl.isSmart ? 'Automated Smart Mix' : 'Custom Mix'}</span>
              <button
                onClick={(e) => handlePlayPlaylist(e, pl)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-indigo-600 text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-md"
                title={`Play ${pl.name}`}
              >
                <Play size={13} className="fill-current ml-0.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-white mb-4">Create New Playlist</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Playlist Name</label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="e.g. Anirudh Workout Bangerz"
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-1.5">Description (optional)</label>
                <textarea
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  placeholder="What's this mix about?"
                  rows={2}
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/25 transition-all"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
