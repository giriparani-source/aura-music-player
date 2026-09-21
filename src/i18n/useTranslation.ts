import { create } from 'zustand';
import { Language, TranslationSchema } from './types';
import { en } from './translations/en';
import { ta } from './translations/ta';
import { tanglish } from './translations/tanglish';

const TRANSLATIONS: Record<Language, TranslationSchema> = {
  en,
  ta,
  tanglish
};

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const STORAGE_KEY = 'aura_language';

const getInitialLanguage = (): Language => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved && (saved === 'en' || saved === 'ta' || saved === 'tanglish')) {
        return saved;
      }
    }
  } catch {}
  return 'en';
};

export const useI18nStore = create<I18nState>((set) => ({
  language: getInitialLanguage(),
  setLanguage: (lang: Language) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch {}
    set({ language: lang });
  }
}));

/**
 * Resolves a dot-notated translation path (e.g. "nav.home", "player.play")
 * from the dictionary, falling back to English, then to provided fallback or key.
 */
export function getTranslation(lang: Language, path: string, fallback?: string): string {
  const dictionary = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const parts = path.split('.');

  let current: any = dictionary;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      current = undefined;
      break;
    }
  }

  if (typeof current === 'string') {
    return current;
  }

  // Fallback to English if key was missing in active language
  if (lang !== 'en') {
    let fallbackCurrent: any = TRANSLATIONS.en;
    for (const part of parts) {
      if (fallbackCurrent && typeof fallbackCurrent === 'object' && part in fallbackCurrent) {
        fallbackCurrent = fallbackCurrent[part];
      } else {
        fallbackCurrent = undefined;
        break;
      }
    }
    if (typeof fallbackCurrent === 'string') {
      return fallbackCurrent;
    }
  }

  return fallback || path;
}

/**
 * Hook to access current translation function `t` and language switcher.
 */
export function useTranslation() {
  const language = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);

  const t = (key: string, fallback?: string): string => {
    return getTranslation(language, key, fallback);
  };

  return { t, language, setLanguage };
}
