import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Radio,
  Copy,
  Check,
  Sparkles,
  LogOut,
  Wifi,
  ArrowRight,
  Headphones
} from 'lucide-react';
import { useJamStore } from '../../store/useJamStore';
import { usePlayerStore } from '../../store/usePlayerStore';

const QUICK_EMOJIS = ['🔥', '❤️', '🎉', '⚡', '🚀', '🕺', '✨', '👏'];

export const JamModal: React.FC = () => {
  const {
    isJamModalOpen,
    setJamModalOpen,
    isInRoom,
    isHost,
    roomCode,
    participants,
    reactions,
    driftMs,
    error,
    nickname,
    setNickname,
    createRoom,
    joinRoom,
    leaveRoom,
    sendReaction
  } = useJamStore();

  const { currentSong } = usePlayerStore();

  const [inputCode, setInputCode] = useState('');
  const [localName, setLocalName] = useState(nickname);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check URL query param ?jam=JAM-XXXX on first open
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const jamParam = params.get('jam');
      if (jamParam && !isInRoom) {
        setInputCode(jamParam.toUpperCase());
        setActiveTab('join');
        setJamModalOpen(true);
      }
    }
  }, [isInRoom, setJamModalOpen]);

  if (!isJamModalOpen) return null;

  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      setNickname(localName);
      await createRoom();
    } catch {
      // Handled in store
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!inputCode.trim()) return;
    setIsSubmitting(true);
    try {
      setNickname(localName);
      await joinRoom(inputCode.trim());
    } catch {
      // Handled in store
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!roomCode) return;
    const url = `${window.location.origin}/?jam=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e]/90 backdrop-blur-2xl flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-[#0e1118] border border-white/10 shadow-2xl p-6 sm:p-7 relative overflow-hidden space-y-6">
        {/* Background ambient glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Social Jam</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Listen Together
                </span>
              </h3>
              <p className="text-xs text-neutral-400">Real-time synchronized listening with friends</p>
            </div>
          </div>

          <button
            onClick={() => setJamModalOpen(false)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer border border-white/5"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        {/* ================= VIEW A: NOT IN A ROOM (Create or Join) ================= */}
        {!isInRoom ? (
          <div className="space-y-5 relative z-10">
            {/* Nickname Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 block">Your Display Name:</label>
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="e.g. Master Beats"
                className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Sub-tabs: Host vs Join */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-white/5 border border-white/10">
              <button
                onClick={() => setActiveTab('create')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'create'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Radio size={14} />
                <span>Start as Host</span>
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'join'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Headphones size={14} />
                <span>Join Friend's Room</span>
              </button>
            </div>

            {activeTab === 'create' && (
              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Broadcast Your Music</h4>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Create a private Jam Room. You control play, pause, next track, and seek. Friends will hear your music in real-time!
                  </p>
                </div>

                {currentSong && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{currentSong.title}</p>
                      <p className="text-[11px] text-neutral-400 truncate">{currentSong.artist}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCreate}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  <Sparkles size={16} className="text-amber-300" />
                  <span>{isSubmitting ? 'Creating Room...' : 'Start Jam Room Now'}</span>
                </button>
              </div>
            )}

            {activeTab === 'join' && (
              <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Join Friend's Jam Session</h4>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Enter the 6-character room code shared by your friend (e.g. JAM-8842).
                  </p>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="JAM-XXXX"
                    className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-center tracking-widest text-lg font-bold focus:outline-none focus:border-indigo-500 transition-colors uppercase"
                  />
                </div>

                <button
                  onClick={handleJoin}
                  disabled={isSubmitting || !inputCode.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  <span>{isSubmitting ? 'Connecting...' : 'Connect to Jam'}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ================= VIEW B: ACTIVE JAM ROOM ================= */
          <div className="space-y-5 relative z-10">
            {/* Room Code Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 to-purple-950/40 border border-indigo-500/30 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 block font-bold">
                  {isHost ? '👑 HOSTING JAM ROOM' : '🎧 CONNECTED AS LISTENER'}
                </span>
                <span className="text-2xl font-black font-mono tracking-wider text-white">
                  {roomCode}
                </span>
              </div>

              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/10 cursor-pointer"
                title="Copy sharable room link"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Sync & Latency Status Indicator */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-neutral-300 font-medium">
                  {isHost ? 'Broadcasting live sync' : 'Synchronized with Host'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-neutral-400 font-mono text-[11px]">
                <Wifi size={13} className="text-indigo-400" />
                <span>{isHost ? '0ms' : `${driftMs}ms drift`}</span>
              </div>
            </div>

            {/* Active Participants */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block">
                Active Listeners ({participants.length})
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 text-xs text-neutral-200 shrink-0"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center text-[10px]">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium truncate max-w-[100px]">{p.name}</span>
                    {p.isHost && <span className="text-[10px] text-amber-400">👑</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Floating Live Reaction Cannon */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block">
                Send Live Reaction
              </span>
              <div className="flex items-center justify-between gap-1 p-2 rounded-2xl bg-black/40 border border-white/5">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="w-10 h-10 rounded-xl hover:bg-white/10 active:scale-125 transition-all text-xl flex items-center justify-center cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Reactions Stream */}
            {reactions.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {reactions.slice(-6).map((rx) => (
                  <div
                    key={rx.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 shrink-0 animate-in fade-in zoom-in duration-200"
                  >
                    <span>{rx.emoji}</span>
                    <span className="text-[10px] text-neutral-400">{rx.user}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Leave Room Button */}
            <button
              onClick={leaveRoom}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/15 text-neutral-400 hover:text-rose-400 text-xs font-semibold transition-colors border border-white/5 hover:border-rose-500/20 cursor-pointer"
            >
              <LogOut size={14} />
              <span>Leave Jam Room</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
