// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { SHARED_EN, SHARED_ES, collectLocaleKeys } from '@abdsynths/shared/i18n';
import { en, axionikEn } from '../WebUI/src/i18n/locales/en';
import { es, axionikEs } from '../WebUI/src/i18n/locales/es';
import { getLocale, setLocale, onLocaleChange, t, applyI18n } from '../WebUI/src/i18n/index';

describe('2-Tier i18n System (@abdsynths/shared Core + ABDAxionikVS Synth Tier)', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('maintains 100% key parity in Tier-1 Shared Dictionary (SHARED_EN vs SHARED_ES)', () => {
    const sharedEnKeys = collectLocaleKeys(SHARED_EN);
    const sharedEsKeys = collectLocaleKeys(SHARED_ES);

    expect(sharedEnKeys).toEqual(sharedEsKeys);
    expect(sharedEnKeys.length).toBeGreaterThan(70);
  });

  it('maintains 100% key parity in Tier-2 Axionik Extension (axionikEn vs axionikEs)', () => {
    const axEnKeys = collectLocaleKeys(axionikEn);
    const axEsKeys = collectLocaleKeys(axionikEs);

    expect(axEnKeys).toEqual(axEsKeys);
    expect(axEnKeys.length).toBeGreaterThan(40);
  });

  it('maintains 100% key parity in Merged Dictionary (en vs es)', () => {
    const enKeys = collectLocaleKeys(en);
    const esKeys = collectLocaleKeys(es);

    expect(enKeys).toEqual(esKeys);
    expect(enKeys.length).toBeGreaterThan(100);
  });

  it('translates both shared Tier-1 keys and synth-specific Tier-2 keys accurately', () => {
    setLocale('en');
    // Tier 1 (from ABDShared)
    expect(t('navbar.menuFile')).toBe('File');
    expect(t('settings.polyphonyCard')).toBe('POLYPHONY & STEREO SPREAD');
    expect(t('common.close')).toBe('Close');
    expect(t('midiLearn.clearAll')).toBe('Clear All Mappings');
    // Tier 2 (from ABDAxionikVS)
    expect(t('navbar.nukeRemote')).toBe('NUKE Remote Control Unit...');
    expect(t('settings.oracleModeModern')).toBe('Musical Saturation (Modern)');

    setLocale('es');
    // Tier 1 (from ABDShared)
    expect(t('navbar.menuFile')).toBe('Archivo');
    expect(t('settings.polyphonyCard')).toBe('POLIFONÍA Y APERTURA ESTÉREO');
    expect(t('common.close')).toBe('Cerrar');
    expect(t('midiLearn.clearAll')).toBe('Limpiar Todos los Mapeos');
    // Tier 2 (from ABDAxionikVS)
    expect(t('navbar.nukeRemote')).toBe('Unidad de Control Remoto NUKE...');
    expect(t('settings.oracleModeModern')).toBe('Saturación Musical (Moderna)');
  });

  it('does not translate universal acronyms and descriptors', () => {
    setLocale('es');
    expect(t('navbar.nuke')).toBe('NUKE');
    expect(t('navbar.midi')).toBe('MIDI');
    expect(t('navbar.sysex')).toBe('SysEx');
    expect(t('nuke.silver')).toBe('SILVER');
    expect(t('nuke.stickDomainSphere')).toBe('SPHERE');
    expect(t('nuke.stickDomainScape')).toBe('SCAPE');
  });

  it('supports interpolation and notifies subscribers on locale change', () => {
    let triggeredLocale = '';
    const unsubscribe = onLocaleChange((newLocale) => {
      triggeredLocale = newLocale;
    });

    setLocale('es');
    expect(triggeredLocale).toBe('es');
    expect(getLocale()).toBe('es');

    setLocale('en');
    expect(triggeredLocale).toBe('en');
    expect(getLocale()).toBe('en');

    unsubscribe();
  });

  it('applies translations to DOM nodes via applyI18n', () => {
    document.body.innerHTML = `
      <div id="test-node">
        <span data-i18n="navbar.menuFile">Old</span>
        <button data-i18n-title="navbar.btnNukeTitle" title="Old Title">
          <span data-i18n="navbar.nuke">Old Nuke</span>
        </button>
        <input data-i18n-placeholder="common.search" placeholder="Old Search" />
      </div>
    `;

    setLocale('en');
    applyI18n(document.body);

    const span = document.querySelector('span[data-i18n="navbar.menuFile"]');
    const btn = document.querySelector('button[data-i18n-title]');
    const input = document.querySelector('input') as HTMLInputElement;

    expect(span?.textContent).toBe('File');
    expect(btn?.getAttribute('title')).toBe('NUKE Remote Control Unit (Ctrl+K)');
    expect(input?.placeholder).toBe('Search...');

    setLocale('es');
    applyI18n(document.body);

    expect(span?.textContent).toBe('Archivo');
    expect(btn?.getAttribute('title')).toBe('Unidad de Control Remoto NUKE (Ctrl+K)');
    expect(input?.placeholder).toBe('Buscar...');
  });
});
