// Tiny i18n: the English text is the key; other languages map English → translation.
// Shared by the editor renderer and the main process (templates, validation, export errors).
import { TH } from './i18n-th';

export type Lang = 'en' | 'th';

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'th', label: 'ไทย (Thai)' },
];

const DICTS: Record<Lang, Record<string, string>> = { en: {}, th: TH };

let current: Lang = 'en';

export function setLanguage(lang: Lang | string | undefined) {
  current = lang === 'th' ? 'th' : 'en';
}

export function getLanguage(): Lang {
  return current;
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'th';
}

/** Translate `key` (English text) and fill {placeholders}. */
export function t(key: string, vars?: Record<string, string | number | null | undefined>): string {
  let s = DICTS[current][key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? '') : m));
  return s;
}

export function hasTranslation(lang: Lang, key: string): boolean {
  return lang === 'en' || key in DICTS[lang];
}
