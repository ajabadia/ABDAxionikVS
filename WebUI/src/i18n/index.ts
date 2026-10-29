/**
 * ABDAxionikVS — i18n / index.ts
 * Central Reactive Internationalization (i18n) Engine.
 *
 * Capabilities:
 * - Typesafe keys based on en.ts.
 * - Reactive locale switching ('en' | 'es', extensible to any new locale).
 * - Instant DOM mutation without page reload or audio glitch.
 * - Safe fallback to English for missing keys.
 * - Variable interpolation: t('key', { name: 'value' }).
 * - Declarative DOM bindings:
 *     data-i18n="navbar.menuFile"
 *     data-i18n-title="navbar.btnNukeTitle"
 *     data-i18n-placeholder="common.search"
 * - Persistence to localStorage ('axionik.locale').
 */

import { en, type Translations } from './locales/en.js';
import { es } from './locales/es.js';

export type Locale = 'en' | 'es';
export type { Translations };

const STORAGE_KEY = 'axionik.locale';
const SUPPORTED_LOCALES: Record<Locale, Translations> = { en, es };

let currentLocale: Locale = 'en';
const subscribers = new Set<(locale: Locale) => void>();

/**
 * Initialize locale from localStorage or browser preferences.
 */
export function initI18n(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && (saved === 'en' || saved === 'es')) {
      currentLocale = saved;
      return currentLocale;
    }
  } catch {
    // ignore localStorage errors (e.g. sandboxed iframe)
  }

  // Detect browser language
  const browserLang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language.slice(0, 2).toLowerCase() : 'en';
  if (browserLang === 'es') {
    currentLocale = 'es';
  } else {
    currentLocale = 'en';
  }

  return currentLocale;
}

/**
 * Get current active locale.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Switch active locale, persist to localStorage, notify listeners and update DOM.
 */
export function setLocale(locale: Locale): void {
  if (locale !== 'en' && locale !== 'es') return;
  if (currentLocale === locale) return;

  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }

  // Update declarative DOM elements
  applyI18n();

  // Notify registered callbacks
  subscribers.forEach((cb) => {
    try {
      cb(currentLocale);
    } catch (err) {
      console.error('[i18n] Error in locale subscriber:', err);
    }
  });
}

/**
 * Subscribe to locale change events. Returns an unsubscribe function.
 */
export function onLocaleChange(callback: (locale: Locale) => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * Path-based translation lookup with optional interpolation.
 * Example: t('navbar.menuFile') or t('calibration.resetGroupTitle', { cat: 'FILTER' })
 */
export function t(path: string, params?: Record<string, string | number>): string {
  const dict = SUPPORTED_LOCALES[currentLocale] || en;
  const val = getNestedValue(dict, path) ?? getNestedValue(en, path);

  if (typeof val === 'string') {
    if (!params) return val;
    return val.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
  }

  if (typeof val === 'function') {
    try {
      return (val as any)(params);
    } catch {
      return path;
    }
  }

  return path;
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return curr;
}

/**
 * Automatically scans elements within root (or entire document) with:
 * - [data-i18n]: Sets textContent to t(attrValue)
 * - [data-i18n-title]: Sets title attribute to t(attrValue)
 * - [data-i18n-placeholder]: Sets placeholder attribute to t(attrValue)
 */
export function applyI18n(root?: ParentNode): void {
  if (typeof document === 'undefined') return;
  const target = root || document;

  // textContent
  target.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // title
  target.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.setAttribute('title', t(key));
    }
  });

  // placeholder
  target.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      el.placeholder = t(key);
    }
  });
}
