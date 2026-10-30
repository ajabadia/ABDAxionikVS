/**
 * ABDAxionikVS — i18n / index.ts
 * Instancia del motor universal reactivo de internacionalización (i18n) de `@abdsynths/shared/i18n`.
 *
 * Arquitectura en 2 Capas:
 * - Capa 1 (Core): Diccionario común transversal de la suite (`SHARED_EN` / `SHARED_ES`).
 * - Capa 2 (Synth): Extensión específica de Hartmann Neuron / ABDAxionikVS (`axionikEn` / `axionikEs`).
 */

import { createSynthI18n, collectLocaleKeys } from '@abdsynths/shared/i18n';
import { axionikEn, en, type Translations } from './locales/en.js';
import { axionikEs, es } from './locales/es.js';

export type Locale = 'en' | 'es';
export type { Translations };
export { en, es, axionikEn, axionikEs, collectLocaleKeys };

const i18n = createSynthI18n<Locale, Translations>({
  locales: {
    en: axionikEn,
    es: axionikEs,
  },
  defaultLocale: 'en',
  storageKey: 'abdsynths.locale',
  legacyStorageKeys: ['axionik.locale'],
});

export const initI18n = i18n.initI18n;
export const getLocale = i18n.getLocale;
export const setLocale = i18n.setLocale;
export const onLocaleChange = i18n.onLocaleChange;
export const t = i18n.t;
export const applyI18n = i18n.applyI18n;
export const getSupportedLocales = i18n.getSupportedLocales;
export const getDictionary = i18n.getDictionary;
export const extendLocale = i18n.extendLocale;
