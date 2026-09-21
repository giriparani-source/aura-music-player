import React, { useState } from 'react';
import { X, Plus, Lock, Check, AlertCircle, Trash2 } from 'lucide-react';
import { useProfileStore } from '../../store/useProfileStore';
import { UserProfile } from '../../services/profileService';

const AVATAR_PRESETS = ['🎧', '🎵', '🎸', '🎹', '🎤', '🎷', '⚡', '🌙', '🔥', '👑'];
const COLOR_PRESETS = ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

export const ProfileModal: React.FC = () => {
  const {
    profiles,
    activeProfile,
    isProfileModalOpen,
    setProfileModalOpen,
    switchProfile,
    createProfile,
    deleteProfile
  } = useProfileStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('🎧');
  const [newColor, setNewColor] = useState('#6366f1');
  const [newPin, setNewPin] = useState('');
  const [enablePin, setEnablePin] = useState(false);

  // PIN prompt state when switching to protected profile
  const [pinPromptProfile, setPinPromptProfile] = useState<UserProfile | null>(null);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState('');

  if (!isProfileModalOpen) return null;

  const handleSelectProfile = (p: UserProfile) => {
    if (p.id === activeProfile.id) {
      setProfileModalOpen(false);
      return;
    }

    if (p.isProtected) {
      setPinPromptProfile(p);
      setInputPin('');
      setPinError('');
    } else {
      switchProfile(p.id);
    }
  };

  const handleVerifyPinAndSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinPromptProfile) return;

    const res = switchProfile(pinPromptProfile.id, inputPin);
    if (res.success) {
      setPinPromptProfile(null);
      setInputPin('');
      setPinError('');
    } else {
      setPinError(res.error || 'Incorrect PIN');
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    createProfile(
      newName.trim(),
      newAvatar,
      newColor,
      enablePin ? newPin.trim() : undefined
    );

    // Reset create state
    setIsCreating(false);
    setNewName('');
    setNewPin('');
    setEnablePin(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-3xl bg-[#0e1118] border border-white/10 p-6 shadow-2xl space-y-6 select-none relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>User Profiles</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/30">
                Multi-User
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Switch listener profile or create separate libraries
            </p>
          </div>
          <button
            onClick={() => {
              setProfileModalOpen(false);
              setPinPromptProfile(null);
              setIsCreating(false);
            }}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* PIN Authentication Prompt Modal Layer */}
        {pinPromptProfile ? (
          <form onSubmit={handleVerifyPinAndSwitch} className="space-y-4 py-2">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl bg-white/5 border border-white/10 shadow-lg">
                {pinPromptProfile.avatar}
              </div>
              <h4 className="text-base font-bold text-white">{pinPromptProfile.name} is Protected</h4>
              <p className="text-xs text-neutral-400">Enter 4-digit PIN to switch to this profile</p>
            </div>

            <div className="space-y-1">
              <input
                type="password"
                maxLength={6}
                autoFocus
                value={inputPin}
                onChange={(e) => {
                  setInputPin(e.target.value);
                  setPinError('');
                }}
                placeholder="Enter PIN"
                className="w-full text-center tracking-[0.4em] text-lg font-bold py-3 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-indigo-500 focus:bg-white/[0.08]"
              />
              {pinError && (
                <p className="text-xs text-rose-400 flex items-center justify-center gap-1 mt-1">
                  <AlertCircle size={13} />
                  <span>{pinError}</span>
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPinPromptProfile(null);
                  setInputPin('');
                  setPinError('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-neutral-300 hover:bg-white/10 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inputPin.length < 4}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                Unlock & Switch
              </button>
            </div>
          </form>
        ) : isCreating ? (
          /* Create Profile Form */
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Profile Name</label>
              <input
                type="text"
                required
                maxLength={24}
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. My Favorites, Kids, Party"
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Avatar picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Avatar Icon</label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PRESETS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setNewAvatar(av)}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                      newAvatar === av
                        ? 'bg-indigo-600/30 border-2 border-indigo-400 scale-105'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Theme Color</label>
              <div className="flex gap-2">
                {COLOR_PRESETS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNewColor(col)}
                    style={{ backgroundColor: col }}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                      newColor === col ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {newColor === col && <Check size={14} className="text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>

            {/* PIN Lock Toggle */}
            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-300 flex items-center gap-1.5 font-medium">
                  <Lock size={13} className="text-indigo-400" />
                  PIN Protection
                </span>
                <input
                  type="checkbox"
                  id="enable_profile_pin"
                  checked={enablePin}
                  onChange={(e) => setEnablePin(e.target.checked)}
                  className="rounded accent-indigo-500 cursor-pointer"
                />
              </div>

              {enablePin && (
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Set 4-digit PIN"
                  className="w-full px-3.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white tracking-widest text-center"
                />
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-neutral-300 hover:bg-white/10 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newName.trim() || (enablePin && newPin.length < 4)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                Save Profile
              </button>
            </div>
          </form>
        ) : (
          /* Profile List */
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {profiles.map((p) => {
              const isActive = p.id === activeProfile.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectProfile(p)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/15 border-indigo-500/50 shadow-md text-white'
                      : 'bg-white/5 border-white/10 hover:bg-white/[0.08] text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      style={{ borderColor: p.color }}
                      className="w-11 h-11 rounded-2xl text-xl flex items-center justify-center bg-white/5 border-2 shrink-0 shadow"
                    >
                      {p.avatar}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                        <span>{p.name}</span>
                        {p.isProtected && <Lock size={12} className="text-amber-400 shrink-0" />}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {isActive ? 'Currently Active' : 'Click to switch'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                        <Check size={11} />
                        Active
                      </span>
                    ) : p.id !== 'default' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete profile "${p.name}"?`)) {
                            deleteProfile(p.id);
                          }
                        }}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Delete profile"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {/* Add profile trigger button */}
            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-3 rounded-2xl border border-dashed border-white/15 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-neutral-400 hover:text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Create New Profile</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
