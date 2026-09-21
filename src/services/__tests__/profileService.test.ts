import { describe, it, expect, beforeEach } from 'vitest';
import {
  profileService,
  DEFAULT_PROFILE,
  hashPin,
  verifyPin
} from '../profileService';

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = storageMock;
}

describe('ProfileService & Multi-User Authentication', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with DEFAULT_PROFILE', () => {
    const profiles = profileService.getProfiles();
    expect(profiles.length).toBe(1);
    expect(profiles[0].id).toBe(DEFAULT_PROFILE.id);
    expect(profileService.getActiveProfileId()).toBe(DEFAULT_PROFILE.id);
  });

  it('creates and retrieves a new profile', () => {
    const created = profileService.createProfile('Anirudh Fan', '⚡', '#ec4899');
    expect(created.name).toBe('Anirudh Fan');
    expect(created.avatar).toBe('⚡');
    expect(created.color).toBe('#ec4899');
    expect(created.isProtected).toBe(false);

    const profiles = profileService.getProfiles();
    expect(profiles.length).toBe(2);
    expect(profiles.some((p) => p.id === created.id)).toBe(true);
  });

  it('correctly hashes and verifies 4-digit PIN for protected profiles', () => {
    const pin = '1234';
    const hash = hashPin(pin);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(pin);
    expect(verifyPin(pin, hash)).toBe(true);
    expect(verifyPin('9999', hash)).toBe(false);

    const protectedProfile = profileService.createProfile('Private Work', '🔒', '#10b981', '4321');
    expect(protectedProfile.isProtected).toBe(true);
    expect(verifyPin('4321', protectedProfile.pinHash)).toBe(true);
    expect(verifyPin('0000', protectedProfile.pinHash)).toBe(false);
  });

  it('switches active profile and retrieves active profile metadata', () => {
    const newProf = profileService.createProfile('Night Beats', '🌙', '#6366f1');
    profileService.setActiveProfile(newProf.id);

    expect(profileService.getActiveProfileId()).toBe(newProf.id);
    expect(profileService.getActiveProfile().name).toBe('Night Beats');
  });

  it('updates an existing profile', () => {
    const prof = profileService.createProfile('Temporary', '🎵');
    const updated = profileService.updateProfile(prof.id, { name: 'Renamed Party', avatar: '🔥' });

    expect(updated.name).toBe('Renamed Party');
    expect(updated.avatar).toBe('🔥');
  });

  it('prevents deleting DEFAULT_PROFILE and allows deleting custom profile', () => {
    expect(() => profileService.deleteProfile(DEFAULT_PROFILE.id)).toThrow();

    const custom = profileService.createProfile('To Delete', '🗑️');
    expect(profileService.getProfiles().length).toBe(2);

    const res = profileService.deleteProfile(custom.id);
    expect(res).toBe(true);
    expect(profileService.getProfiles().length).toBe(1);
  });

  it('correctly generates profile-scoped keys for data isolation', () => {
    // Default profile uses clean base key for 100% backward compatibility
    expect(profileService.getScopedKey('user_favorites', DEFAULT_PROFILE.id)).toBe('user_favorites');

    // Custom profile isolates storage key
    expect(profileService.getScopedKey('user_favorites', 'profile_abc123')).toBe('user_favorites_profile_abc123');
  });
});
