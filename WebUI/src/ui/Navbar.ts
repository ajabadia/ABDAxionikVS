/**
 * // ─────────────────────────────────────────────────────────
 * // ABDAxionikVS — Navbar Component
 * // Integrates with ABDShared's SynthNavBar (desktop menu bar + HUD slots)
 * // File / Edit / View / Help menus + Live HUD telemetry + Quick Actions
 * // Internationalization (i18n) enabled for dynamic EN / ES switching
 * // ─────────────────────────────────────────────────────────
 */

import { createSynthNavBar, CONTROL_ICONS, SysExIcon } from '@abdsynths/shared/components';
import { ICONS } from './icons.js';
import { t, getLocale, setLocale, onLocaleChange, type Locale } from '../i18n/index.js';

export interface NavbarCallbacks {
  onConfigureFolder: () => void;
  onImportModelFolder: () => void;
  onImportModelZip: () => void;
  onLoadPreset: () => void;
  onSavePreset: () => void;
  onInitPreset: () => void;
  onToggleBank: () => void;
  onToggleNuke?: () => void;
  onToggleMatrix: () => void;
  onToggleMidiLearn?: () => void;
  onToggleHardwareDumps?: () => void;
  onToggleCalibration?: () => void;
  onToggleMfx: () => void;
  onToggleSettings?: () => void;
  onSelectPreset?: () => void;
  onSelectModel?: (resynator: 1 | 2) => void;
  onSelectEngineMode?: (mode: 'classic' | 'plus' | 'expanded') => void;
  onSelectTheme: (theme: string) => void;
  onToggleTheme: () => void;
  onZoom: (zoomLevel: number) => void;
}

export class AxionikNavbar {
  private container: HTMLElement;
  private callbacks: NavbarCallbacks;
  public navBarInstance: ReturnType<typeof createSynthNavBar> = null;
  private presetNameEl: HTMLElement | null = null;
  private r1ModelNameEl: HTMLElement | null = null;
  private r2ModelNameEl: HTMLElement | null = null;
  private activeVoicesEl: HTMLElement | null = null;
  private cpuLoadEl: HTMLElement | null = null;
  private currentTheme: string = 'ms2000';
  private currentZoom: number = 1.0;
  private currentEngineMode: 'classic' | 'plus' | 'expanded' = 'expanded';
  private compileTargetMode: 'classic' | 'plus' | 'expanded' = 'expanded';
  private unsubscribeLocale: (() => void) | null = null;

  constructor(container: HTMLElement, callbacks: NavbarCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.mount();

    // Rebuild on locale changes
    this.unsubscribeLocale = onLocaleChange(() => {
      this.rebuild();
    });
  }

  private buildMenuDefinition() {
    return [
      {
        name: t('navbar.menuFile'),
        items: [
          { id: 101, label: t('navbar.configureFolder'), action: 'configureFolder' },
          { separator: true },
          { id: 102, label: t('navbar.importModelFolder'), action: 'importModelFolder' },
          { id: 103, label: t('navbar.importModelZip'), action: 'importModelZip' },
          { separator: true },
          { id: 104, label: t('navbar.loadPreset'), action: 'loadPreset', shortcut: 'Ctrl+O' },
          { id: 105, label: t('navbar.savePreset'), action: 'savePreset', shortcut: 'Ctrl+S' },
          { separator: true },
          { id: 106, label: t('navbar.initPreset'), action: 'initPreset', shortcut: 'Ctrl+N' },
        ],
      },
      {
        name: t('navbar.menuEdit'),
        items: [
          { id: 201, label: t('navbar.bankBrowser'), action: 'toggleBank', shortcut: 'Ctrl+B' },
          { separator: true },
          { id: 205, label: t('navbar.nukeRemote'), action: 'toggleNuke', shortcut: 'Ctrl+K' },
          { id: 202, label: t('navbar.matrixMod'), action: 'toggleMatrix', shortcut: 'Ctrl+M' },
          { id: 206, label: t('navbar.midiLearn'), action: 'toggleMidiLearn', shortcut: 'Ctrl+L' },
          { id: 207, label: t('navbar.hardwareSysEx'), action: 'toggleHardwareDumps', shortcut: 'Ctrl+.' },
          { id: 208, label: t('navbar.dspCalibration'), action: 'toggleCalibration', shortcut: 'Ctrl+;' },
          { id: 203, label: t('navbar.effectsRack'), action: 'toggleMfx', shortcut: 'Ctrl+F' },
          { separator: true },
          { id: 204, label: t('navbar.globalSettings'), action: 'toggleSettings', shortcut: 'Ctrl+,' },
        ],
      },
      {
        name: t('navbar.menuView'),
        items: [
          {
            id: 301,
            label: t('navbar.zoom'),
            submenu: [
              { id: 311, label: t('navbar.zoom100'), action: 'zoom', value: 1.0 },
              { id: 312, label: t('navbar.zoom125'), action: 'zoom', value: 1.25 },
              { id: 313, label: t('navbar.zoom150'), action: 'zoom', value: 1.5 },
            ],
          },
          {
            id: 302,
            label: t('navbar.colorTheme'),
            submenu: [
              { id: 321, label: 'MS2000 (Default Dark Cyan)', action: 'selectTheme', value: 'ms2000' },
              { id: 322, label: 'AudioLab (Pro Dark Slate)', action: 'selectTheme', value: 'audiolab' },
              { id: 323, label: 'AudioLab Light (Laboratory)', action: 'selectTheme', value: 'audiolab-light' },
              { id: 324, label: 'Advanced (High Contrast Orange)', action: 'selectTheme', value: 'advanced' },
              { id: 325, label: 'CZ101 (Classic Teal & Red)', action: 'selectTheme', value: 'cz101' },
            ],
          },
          {
            id: 303,
            label: t('navbar.language'),
            submenu: [
              { id: 331, label: t('navbar.langEn'), action: 'switchLocale', value: 'en' },
              { id: 332, label: t('navbar.langEs'), action: 'switchLocale', value: 'es' },
            ],
          },
        ],
      },
      {
        name: t('navbar.menuHelp'),
        items: [
          { id: 901, label: t('navbar.manual'), action: 'manual', shortcut: 'F1' },
          { separator: true },
          { id: 902, label: t('navbar.checkForUpdates'), action: 'checkForUpdates' },
          { id: 903, label: t('navbar.about'), action: 'about' },
        ],
      },
    ];
  }

  private mount(): void {
    const brand = {
      title: '',
      subtitle: '',
      logoHtml: `<div class="neuron-logo-mark" title="Hartmann Neuron / ABDAxionikVS">${ICONS.wave}</div>`,
    };

    const menus = this.buildMenuDefinition();

    // Center HUD Slot: Engine Mode Selector (CLASSIC | PLUS | EXPANDED) + Active Preset Name
    // Solo la versión más alta (compileTargetMode === 'expanded') muestra el selector en pantalla
    // permitiendo bajar a plus o classic; las versiones classic/plus ocultan el selector.
    const showModeSelector = this.compileTargetMode === 'expanded';
    const isClassic = this.currentEngineMode === 'classic';
    const isPlus = this.currentEngineMode === 'plus';
    const isExpanded = this.currentEngineMode === 'expanded';

    const centerSlot = document.createElement('div');
    centerSlot.className = 'nav-hud-center';
    centerSlot.innerHTML = `
      <div class="hud-pill hud-mode-selector" id="nav-engine-mode-group" role="group" aria-label="${t('navbar.engineModeLabel')}" style="${showModeSelector ? '' : 'display: none;'}">
        <span class="hud-label">${t('navbar.engineModeLabel')}</span>
        <button type="button" class="hud-mode-btn ${isClassic ? 'active' : ''}" id="btn-mode-classic" data-engine-mode="classic" aria-pressed="${isClassic}" title="${t('navbar.modeClassicTitle')}">
          ${t('navbar.modeClassic')}
        </button>
        <button type="button" class="hud-mode-btn ${isPlus ? 'active' : ''}" id="btn-mode-plus" data-engine-mode="plus" aria-pressed="${isPlus}" title="${t('navbar.modePlusTitle')}">
          ${t('navbar.modePlus')}
        </button>
        <button type="button" class="hud-mode-btn ${isExpanded ? 'active' : ''}" id="btn-mode-extended" data-engine-mode="expanded" aria-pressed="${isExpanded}" title="${t('navbar.modeExtendedTitle')}">
          ${t('navbar.modeExtended')}
        </button>
      </div>
      <div class="hud-pill preset-slot-tag" id="nav-preset-pill" style="cursor: pointer;" title="${t('navbar.presetPillTitle')}">
        <span class="hud-label">${t('navbar.presetLabel')}</span>
        <span class="hud-value" id="hud-preset-name">000 InitSound</span>
      </div>
    `;

    // Right Slot: Telemetry, Drawers & Themes
    const rightSlot = document.createElement('div');
    rightSlot.className = 'nav-hud-right';
    const curLocale = getLocale().toUpperCase();
    rightSlot.innerHTML = `
      <div class="hud-pill stat-num" title="${t('navbar.voicesTitle')}">
        <span class="hud-label">${t('navbar.voicesLabel')}</span>
        <span class="hud-value" id="hud-active-voices">0 / 12</span>
      </div>
      <div class="hud-pill stat-num" title="${t('navbar.cpuTitle')}">
        <span class="hud-label">${ICONS.cpu}</span>
        <span class="hud-value" id="hud-cpu-load">0.0 %</span>
      </div>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-nuke" title="${t('navbar.btnNukeTitle')}">
        ${ICONS.stick} <span>${t('navbar.nuke')}</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-matrix" title="${t('navbar.btnMatrixTitle')}">
        ${ICONS.matrix} <span>${t('navbar.matrix')}</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-midi" title="${t('navbar.btnMidiTitle')}">
        ${CONTROL_ICONS.midiDin} <span>${t('navbar.midi')}</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-sysex" title="${t('navbar.btnSysExTitle')}">
        ${SysExIcon} <span>${t('navbar.sysex')}</span>
        <span class="nav-badge" id="nav-sysex-badge" hidden></span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-calibration" title="${t('navbar.btnCalibTitle')}">
        ${ICONS.sliders} <span>${t('navbar.calib')}</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-mfx" title="${t('navbar.btnEffectsTitle')}">
        ${ICONS.fx} <span>${t('navbar.effects')}</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-bank" title="${t('navbar.btnNeuronDbTitle')}">
        ${ICONS.database} <span>${t('navbar.neuronDb')}</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-settings" title="${t('navbar.btnSettingsTitle')}">
        ${ICONS.settings} <span>${t('navbar.settings')}</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-lang-toggle" id="btn-nav-lang" title="${t('navbar.btnLangTitle')}">
        <span style="font-weight: 700; font-size: 11px;">${curLocale}</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-theme-toggle" id="btn-nav-theme" title="${t('navbar.btnThemeTitle')}">
        <span class="theme-icon">${ICONS.palette}</span>
      </button>
    `;

    this.navBarInstance = createSynthNavBar({
      container: this.container,
      brand,
      menus,
      centerSlot,
      rightSlot,
      enableGlobalShortcuts: false,
      activeValues: {
        zoom: this.currentZoom,
        selectTheme: this.currentTheme,
        switchLocale: getLocale(),
      },
      aboutDialog: {
        appName: t('navbar.aboutTitle'),
        subtitle: t('navbar.aboutSubtitle'),
        version: '1.0.0',
        buildInfo: t('navbar.aboutBuildInfo'),
        author: t('navbar.aboutAuthor'),
        copyright: t('navbar.aboutCopyright'),
      },
      onAction: (action: string, value?: unknown) => {
        this.dispatchAction(action, value);
      },
    });

    this.presetNameEl = centerSlot.querySelector('#hud-preset-name');
    this.r1ModelNameEl = null;
    this.r2ModelNameEl = null;
    this.activeVoicesEl = rightSlot.querySelector('#hud-active-voices');
    this.cpuLoadEl = rightSlot.querySelector('#hud-cpu-load');

    // Click on center HUD tags
    centerSlot.querySelector('#nav-preset-pill')?.addEventListener('click', () => {
      this.callbacks.onSelectPreset?.();
    });

    const bindModeBtn = (btnId: string, mode: 'classic' | 'plus' | 'expanded') => {
      centerSlot.querySelector(`#${btnId}`)?.addEventListener('click', () => {
        if (this.compileTargetMode !== 'expanded') return;
        this.setEngineMode(mode);
        this.callbacks.onSelectEngineMode?.(mode);
      });
    };
    bindModeBtn('btn-mode-classic', 'classic');
    bindModeBtn('btn-mode-plus', 'plus');
    bindModeBtn('btn-mode-extended', 'expanded');

    // Click on right HUD buttons
    rightSlot.querySelector('#btn-nav-nuke')?.addEventListener('click', () => {
      this.callbacks.onToggleNuke?.();
    });
    rightSlot.querySelector('#btn-nav-matrix')?.addEventListener('click', () => {
      this.callbacks.onToggleMatrix();
    });
    rightSlot.querySelector('#btn-nav-midi')?.addEventListener('click', () => {
      this.callbacks.onToggleMidiLearn?.();
    });
    const sysexBtn = rightSlot.querySelector('#btn-nav-sysex') as HTMLElement | null;
    sysexBtn?.addEventListener('click', () => {
      this.setHardwareDumpsUnread(0);
      this.callbacks.onToggleHardwareDumps?.();
    });
    sysexBtn?.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.setHardwareDumpsUnread(0);
        this.callbacks.onToggleHardwareDumps?.();
      }
    });
    rightSlot.querySelector('#btn-nav-calibration')?.addEventListener('click', () => {
      this.callbacks.onToggleCalibration?.();
    });
    rightSlot.querySelector('#btn-nav-mfx')?.addEventListener('click', () => {
      this.callbacks.onToggleMfx();
    });
    rightSlot.querySelector('#btn-nav-bank')?.addEventListener('click', () => {
      this.callbacks.onToggleBank();
    });
    rightSlot.querySelector('#btn-nav-settings')?.addEventListener('click', () => {
      this.callbacks.onToggleSettings?.();
    });
    rightSlot.querySelector('#btn-nav-lang')?.addEventListener('click', () => {
      const nextLocale: Locale = getLocale() === 'en' ? 'es' : 'en';
      setLocale(nextLocale);
    });
    rightSlot.querySelector('#btn-nav-theme')?.addEventListener('click', () => {
      this.callbacks.onToggleTheme();
    });
  }

  private rebuild(): void {
    if (this.navBarInstance) {
      this.navBarInstance.destroy?.();
      this.navBarInstance = null;
    }
    this.container.innerHTML = '';
    this.mount();
  }

  private dispatchAction(action: string, value?: unknown): void {
    switch (action) {
      case 'configureFolder':
        this.callbacks.onConfigureFolder();
        break;
      case 'importModelFolder':
        this.callbacks.onImportModelFolder();
        break;
      case 'importModelZip':
        this.callbacks.onImportModelZip();
        break;
      case 'loadPreset':
        this.callbacks.onLoadPreset();
        break;
      case 'savePreset':
        this.callbacks.onSavePreset();
        break;
      case 'initPreset':
        this.callbacks.onInitPreset();
        break;
      case 'toggleBank':
        this.callbacks.onToggleBank();
        break;
      case 'toggleNuke':
        this.callbacks.onToggleNuke?.();
        break;
      case 'toggleMatrix':
        this.callbacks.onToggleMatrix();
        break;
      case 'toggleMidiLearn':
        this.callbacks.onToggleMidiLearn?.();
        break;
      case 'toggleHardwareDumps':
        this.callbacks.onToggleHardwareDumps?.();
        break;
      case 'toggleCalibration':
        this.callbacks.onToggleCalibration?.();
        break;
      case 'toggleMfx':
        this.callbacks.onToggleMfx();
        break;
      case 'toggleSettings':
        this.callbacks.onToggleSettings?.();
        break;
      case 'zoom':
        if (typeof value === 'number') {
          this.currentZoom = value;
          this.updateActiveValues();
          this.callbacks.onZoom(value);
        }
        break;
      case 'selectTheme':
        if (typeof value === 'string') {
          this.currentTheme = value;
          this.updateActiveValues();
          this.callbacks.onSelectTheme(value);
        }
        break;
      case 'switchLocale':
        if (value === 'en' || value === 'es') {
          setLocale(value);
        }
        break;
      case 'manual':
        window.open('https://github.com/ajabadia/ABDAxionikVS/wiki', '_blank');
        break;
      case 'checkForUpdates':
        alert('ABDAxionikVS v1.0.0 is up to date.');
        break;
      default:
        console.log(`[AxionikNavbar] Action: ${action}`, value);
        break;
    }
  }

  private updateActiveValues(): void {
    this.navBarInstance?.setActiveValues({
      zoom: this.currentZoom,
      selectTheme: this.currentTheme,
      switchLocale: getLocale(),
    });
  }

  public setPresetName(name: string): void {
    if (this.presetNameEl) {
      this.presetNameEl.textContent = name;
    }
  }

  public getPresetName(): string {
    return this.presetNameEl?.textContent?.trim() || '000 InitSound';
  }

  public setModelNames(r1Name: string, r2Name: string): void {
    if (this.r1ModelNameEl) {
      this.r1ModelNameEl.textContent = r1Name;
    }
    if (this.r2ModelNameEl) {
      this.r2ModelNameEl.textContent = r2Name;
    }
  }

  public setVoiceCount(active: number, max: number): void {
    if (this.activeVoicesEl) {
      this.activeVoicesEl.textContent = `${active} / ${max}`;
    }
  }

  public setCpuLoad(percent: number): void {
    if (this.cpuLoadEl) {
      this.cpuLoadEl.textContent = `${percent.toFixed(1)} %`;
    }
  }

  public setTheme(theme: string): void {
    this.currentTheme = theme;
    this.updateActiveValues();
  }

  public setZoom(zoom: number): void {
    this.currentZoom = zoom;
    this.updateActiveValues();
  }

  public setEngineMode(
    mode: 'classic' | 'plus' | 'expanded',
    compileTarget?: 'classic' | 'plus' | 'expanded'
  ): void {
    if (compileTarget) {
      this.compileTargetMode = compileTarget;
    }
    this.currentEngineMode = mode;

    const group = this.container.querySelector('#nav-engine-mode-group') as HTMLElement | null;
    if (group) {
      group.style.display = this.compileTargetMode === 'expanded' ? '' : 'none';
    }
    const updateBtn = (btnId: string, active: boolean) => {
      const btn = this.container.querySelector(`#${btnId}`) as HTMLElement | null;
      if (btn) {
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    };
    updateBtn('btn-mode-classic', mode === 'classic');
    updateBtn('btn-mode-plus', mode === 'plus');
    updateBtn('btn-mode-extended', mode === 'expanded');
  }

  public getEngineMode(): 'classic' | 'plus' | 'expanded' {
    return this.currentEngineMode;
  }

  public setButtonActive(btnId: string, active: boolean): void {
    const btn = this.container.querySelector(`#${btnId}`) as HTMLElement | null;
    if (btn) {
      btn.classList.toggle('active', active);
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
    }
  }

  public toggleMatrix(): void {
    this.callbacks.onToggleMatrix();
  }

  public setModelName(resynator: 1 | 2, name: string): void {
    if (resynator === 1 && this.r1ModelNameEl) {
      this.r1ModelNameEl.textContent = name;
    } else if (resynator === 2 && this.r2ModelNameEl) {
      this.r2ModelNameEl.textContent = name;
    }
  }

  public setVoices(voices: number): void {
    if (this.activeVoicesEl) {
      this.activeVoicesEl.textContent = `${voices} / 12`;
    }
  }

  public toggleNuke(): void {
    this.callbacks.onToggleNuke?.();
  }

  public setNukeActive(active: boolean): void {
    this.setButtonActive('btn-nav-nuke', active);
  }

  public toggleMidiLearn(): void {
    this.callbacks.onToggleMidiLearn?.();
  }

  public setHardwareDumpsUnread(count: number): void {
    const badge = this.container.querySelector('#nav-sysex-badge') as HTMLElement | null;
    if (!badge) return;
    if (count > 0) {
      badge.hidden = false;
      badge.textContent = count > 99 ? '99+' : String(count);
    } else {
      badge.hidden = true;
      badge.textContent = '';
    }
  }

  public toggleHardwareDumps(): void {
    this.callbacks.onToggleHardwareDumps?.();
  }

  public toggleCalibration(): void {
    this.callbacks.onToggleCalibration?.();
  }

  public setMidiLearnState(isLearning: boolean, mappingCount: number, remainingSeconds: number = 0): void {
    const btn = this.container.querySelector('#btn-nav-midi') as HTMLElement | null;
    if (btn) {
      btn.classList.toggle('is-learning', isLearning);
      btn.classList.toggle('has-mappings', mappingCount > 0);
      btn.classList.toggle('btn-primary', isLearning);
      btn.classList.toggle('btn-secondary', !isLearning);
      if (isLearning && remainingSeconds > 0) {
        btn.innerHTML = `${CONTROL_ICONS.clock || CONTROL_ICONS.midiDin} <span>MIDI (${remainingSeconds}s)</span>`;
      } else {
        btn.innerHTML = `${CONTROL_ICONS.midiDin} <span>MIDI</span>`;
      }
      btn.title = isLearning && remainingSeconds > 0
        ? `Waiting for MIDI controller (${remainingSeconds}s remaining) — Click to open or press Esc to cancel`
        : mappingCount > 0
          ? `MIDI Learn & CC/NRPN Mapping Matrix (${mappingCount} active) (Ctrl+L)`
          : 'MIDI Learn & CC/NRPN Mapping Matrix (Ctrl+L)';
    }
  }

  public toggleMfx(): void {
    this.callbacks.onToggleMfx();
  }

  public toggleBank(): void {
    this.callbacks.onToggleBank();
  }

  public destroy(): void {
    if (this.unsubscribeLocale) {
      this.unsubscribeLocale();
      this.unsubscribeLocale = null;
    }
    if (this.navBarInstance) {
      this.navBarInstance.destroy?.();
      this.navBarInstance = null;
    }
  }
}
