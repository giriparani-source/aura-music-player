export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isProtected?: boolean;
  pinHash?: string;
  createdAt: number;
}

export const DEFAULT_PROFILE: UserProfile = {
  id: 'default',
  name: 'Main Profile',
  avatar: '🎧',
  color: '#6366f1',
  createdAt: 1700000000000
};

const PROFILES_STORAGE_KEY = 'aura_user_profiles';
const ACTIVE_PROFILE_KEY = 'aura_active_profile_id';

/**
 * Creates a deterministic obfuscated hash for a 4-digit PIN.
 */
export function hashPin(pin: string): string {
  let hash = 0;
  const salted = `aura_salt_${pin.trim()}_secure`;
  for (let i = 0; i < salted.length; i++) {
    hash = (hash << 5) - hash + salted.charCodeAt(i);
    hash |= 0;
  }
  return `pin_${Math.abs(hash).toString(16)}`;
}

/**
 * Verifies a PIN against the stored hash.
 */
export function verifyPin(pin: string, expectedHash?: string): boolean {
  if (!expectedHash) return true;
  return hashPin(pin) === expectedHash;
}

class ProfileService {
  private getStorage(): Storage | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    return null;
  }

  public getProfiles(): UserProfile[] {
    const storage = this.getStorage();
    if (!storage) return [DEFAULT_PROFILE];

    try {
      const raw = storage.getItem(PROFILES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    // Initialize with default profile
    this.saveProfiles([DEFAULT_PROFILE]);
    return [DEFAULT_PROFILE];
  }

  private saveProfiles(profiles: UserProfile[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    } catch {}
  }

  public getActiveProfileId(): string {
    const storage = this.getStorage();
    if (!storage) return DEFAULT_PROFILE.id;
    try {
      const id = storage.getItem(ACTIVE_PROFILE_KEY);
      if (id) {
        const profiles = this.getProfiles();
        if (profiles.some((p) => p.id === id)) {
          return id;
        }
      }
    } catch {}
    return DEFAULT_PROFILE.id;
  }

  public getActiveProfile(): UserProfile {
    const activeId = this.getActiveProfileId();
    const profiles = this.getProfiles();
    return profiles.find((p) => p.id === activeId) || profiles[0] || DEFAULT_PROFILE;
  }

  public setActiveProfile(id: string): UserProfile {
    const profiles = this.getProfiles();
    const target = profiles.find((p) => p.id === id);
    if (!target) {
      throw new Error(`Profile with ID "${id}" not found.`);
    }

    const storage = this.getStorage();
    if (storage) {
      storage.setItem(ACTIVE_PROFILE_KEY, id);
    }
    return target;
  }

  public createProfile(
    name: string,
    avatar: string = '🎵',
    color: string = '#6366f1',
    pin?: string
  ): UserProfile {
    const profiles = this.getProfiles();
    const id = `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newProfile: UserProfile = {
      id,
      name: name.trim() || 'New Listener',
      avatar,
      color,
      isProtected: Boolean(pin && pin.trim().length >= 4),
      pinHash: pin && pin.trim().length >= 4 ? hashPin(pin.trim()) : undefined,
      createdAt: Date.now()
    };

    profiles.push(newProfile);
    this.saveProfiles(profiles);
    return newProfile;
  }

  public updateProfile(id: string, updates: Partial<Omit<UserProfile, 'id' | 'createdAt'>>): UserProfile {
    const profiles = this.getProfiles();
    const index = profiles.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Profile "${id}" not found.`);
    }

    const updated: UserProfile = {
      ...profiles[index],
      ...updates
    };

    profiles[index] = updated;
    this.saveProfiles(profiles);
    return updated;
  }

  public deleteProfile(id: string): boolean {
    if (id === DEFAULT_PROFILE.id) {
      throw new Error('Default profile cannot be deleted.');
    }

    let profiles = this.getProfiles();
    const beforeCount = profiles.length;
    profiles = profiles.filter((p) => p.id !== id);

    if (profiles.length === beforeCount) return false;

    this.saveProfiles(profiles);

    // If active profile was deleted, revert to default
    if (this.getActiveProfileId() === id) {
      this.setActiveProfile(DEFAULT_PROFILE.id);
    }

    return true;
  }

  /**
   * Scopes a storage key to the currently active profile.
   * For the default profile, returns the base key unmodified for 100% backward compatibility.
   */
  public getScopedKey(baseKey: string, profileId?: string): string {
    const active = profileId || this.getActiveProfileId();
    if (active === DEFAULT_PROFILE.id) {
      return baseKey;
    }
    return `${baseKey}_${active}`;
  }
}

export const profileService = new ProfileService();
