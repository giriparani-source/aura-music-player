import { describe, it, expect, beforeEach } from 'vitest';
import { en } from '../translations/en';
import { ta } from '../translations/ta';
import { tanglish } from '../translations/tanglish';
import { getTranslation, useI18nStore } from '../useTranslation';

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

describe('i18n Dictionary & Parity', () => {
  function getKeys(obj: any, prefix = ''): string[] {
    let keys: string[] = [];
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys = keys.concat(getKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  const enKeys = getKeys(en);
  const taKeys = getKeys(ta);
  const tanglishKeys = getKeys(tanglish);

  it('contains complete key parity between English and Tamil', () => {
    expect(taKeys.sort()).toEqual(enKeys.sort());
  });

  it('contains complete key parity between English and Tanglish', () => {
    expect(tanglishKeys.sort()).toEqual(enKeys.sort());
  });

  it('returns valid non-empty translations for all keys in all languages', () => {
    for (const key of enKeys) {
      expect(getTranslation('en', key)).toBeTruthy();
      expect(getTranslation('ta', key)).toBeTruthy();
      expect(getTranslation('tanglish', key)).toBeTruthy();
    }
  });

  it('translates navigation keys appropriately per language', () => {
    expect(getTranslation('en', 'nav.home')).toBe('Home');
    expect(getTranslation('ta', 'nav.home')).toBe('முகப்பு');
    expect(getTranslation('tanglish', 'nav.home')).toBe('Home');

    expect(getTranslation('en', 'nav.library')).toBe('My Library');
    expect(getTranslation('ta', 'nav.library')).toBe('எனது நூலகம்');
    expect(getTranslation('tanglish', 'nav.library')).toBe('Enadhu Library');

    expect(getTranslation('en', 'nav.search')).toBe('Search');
    expect(getTranslation('ta', 'nav.search')).toBe('தேடுக');
    expect(getTranslation('tanglish', 'nav.search')).toBe('Thedu');
  });

  it('falls back to English when a key does not exist in the requested language', () => {
    const res = getTranslation('ta', 'nonexistent.key', 'Custom Fallback');
    expect(res).toBe('Custom Fallback');
  });
});

describe('useI18nStore', () => {
  beforeEach(() => {
    useI18nStore.getState().setLanguage('en');
    localStorage.clear();
  });

  it('updates language and persists to localStorage', () => {
    expect(useI18nStore.getState().language).toBe('en');

    useI18nStore.getState().setLanguage('ta');
    expect(useI18nStore.getState().language).toBe('ta');
    expect(localStorage.getItem('aura_language')).toBe('ta');

    useI18nStore.getState().setLanguage('tanglish');
    expect(useI18nStore.getState().language).toBe('tanglish');
    expect(localStorage.getItem('aura_language')).toBe('tanglish');
  });
});
