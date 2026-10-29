// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { en } from '../WebUI/src/i18n/locales/en';
import { es } from '../WebUI/src/i18n/locales/es';
import { initI18n, getLocale, setLocale, onLocaleChange, t, applyI18n } from '../WebUI/src/i18n/index';

function collectKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys = keys.concat(collectKeys(v, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

describe('i18n System (EN/ES parity & reactivity)', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('maintains 100% key parity between English (en.ts) and Spanish (es.ts)', () => {
    const enKeys = collectKeys(en).sort();
    const esKeys = collectKeys(es).sort();

    expect(enKeys).toEqual(esKeys);
    expect(enKeys.length).toBeGreaterThan(50);
  });

  it('translates nested keys accurately based on current locale', () => {
    setLocale('en');
    expect(t('navbar.menuFile')).toBe('File');
    expect(t('settings.polyphonyCard')).toBe('POLYPHONY & STEREO SPREAD');
    expect(t('common.close')).toBe('Close');

    setLocale('es');
    expect(t('navbar.menuFile')).toBe('Archivo');
    expect(t('settings.polyphonyCard')).toBe('POLIFONÍA Y APERTURA ESTÉREO');
    expect(t('common.close')).toBe('Cerrar');
  });

  it('does not translate universal acronyms and descriptors', () => {
    setLocale('es');
    // Acronyms should be preserved in Spanish
    expect(t('navbar.nuke')).toBe('NUKE');
    expect(t('navbar.midi')).toBe('MIDI');
    expect(t('navbar.sysex')).toBe('SysEx');
    expect(t('nuke.silver')).toBe('SILVER');
    expect(t('nuke.stickDomainSphere')).toBe('SPHERE');
    expect(t('nuke.stickDomainScape')).toBe('SCAPE');
  });

  it('supports interpolation in strings', () => {
    setLocale('en');
    expect(t('navbar.aboutSubtitle')).toContain('Hartmann Neuron');
  });

  it('notifies subscribers on locale change', () => {
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
