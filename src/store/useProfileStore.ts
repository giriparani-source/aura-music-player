import { create } from 'zustand';
import { profileService, UserProfile, verifyPin } from '../services/profileService';

interface ProfileState {
  profiles: UserProfile[];
  activeProfile: UserProfile;
  isProfileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
  refreshProfiles: () => void;
  switchProfile: (id: string, pin?: string) => { success: boolean; error?: string };
  createProfile: (name: string, avatar?: string, color?: string, pin?: string) => UserProfile;
  updateProfile: (id: string, updates: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => void;
  deleteProfile: (id: string) => boolean;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: profileService.getProfiles(),
  activeProfile: profileService.getActiveProfile(),
  isProfileModalOpen: false,

  setProfileModalOpen: (open: boolean) => {
    set({ isProfileModalOpen: open });
  },

  refreshProfiles: () => {
    set({
      profiles: profileService.getProfiles(),
      activeProfile: profileService.getActiveProfile()
    });
  },

  switchProfile: (id: string, pin?: string) => {
    const target = get().profiles.find((p) => p.id === id);
    if (!target) {
      return { success: false, error: 'Profile not found' };
    }

    if (target.isProtected && target.pinHash) {
      if (!pin || !verifyPin(pin, target.pinHash)) {
        return { success: false, error: 'Incorrect PIN' };
      }
    }

    try {
      const active = profileService.setActiveProfile(id);
      set({ activeProfile: active, isProfileModalOpen: false });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  createProfile: (name: string, avatar = '🎵', color = '#6366f1', pin?: string) => {
    const created = profileService.createProfile(name, avatar, color, pin);
    get().refreshProfiles();
    return created;
  },

  updateProfile: (id: string, updates) => {
    profileService.updateProfile(id, updates);
    get().refreshProfiles();
  },

  deleteProfile: (id: string) => {
    const deleted = profileService.deleteProfile(id);
    if (deleted) {
      get().refreshProfiles();
    }
    return deleted;
  }
}));
