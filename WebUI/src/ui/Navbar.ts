/**
// ─────────────────────────────────────────────────────────
// ABDAxionikVS — Navbar Component
// Integrates with ABDShared's SynthNavBar (desktop menu bar + HUD slots)
// File / Edit / View / Help menus + Live HUD telemetry + Quick Actions
// ─────────────────────────────────────────────────────────
*/

import { createSynthNavBar, CONTROL_ICONS, SysExIcon } from '@abdsynths/shared/components';
import { ICONS } from './icons.js';

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

  constructor(container: HTMLElement, callbacks: NavbarCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.mount();
  }

  private mount(): void {
    const brand = {
      title: '',
      subtitle: '',
      logoHtml: `<div class="neuron-logo-mark" title="Hartmann Neuron / ABDAxionikVS">${ICONS.wave}</div>`,
    };

    const menus = [
      {
        name: 'File',
        items: [
          { id: 101, label: 'Configure NeuronDB Library Folder...', action: 'configureFolder' },
          { separator: true },
          { id: 102, label: 'Import Model Folder (<NNN>.model)...', action: 'importModelFolder' },
          { id: 103, label: 'Import Model Package (.zip)...', action: 'importModelZip' },
          { separator: true },
          { id: 104, label: 'Load Sound Preset...', action: 'loadPreset', shortcut: 'Ctrl+O' },
          { id: 105, label: 'Save Sound Preset As...', action: 'savePreset', shortcut: 'Ctrl+S' },
          { separator: true },
          { id: 106, label: 'Init Sound (Factory Reset)', action: 'initPreset', shortcut: 'Ctrl+N' },
        ],
      },
      {
        name: 'Edit',
        items: [
          { id: 201, label: 'NeuronDB Bank Browser...', action: 'toggleBank', shortcut: 'Ctrl+B' },
          { separator: true },
          { id: 205, label: 'NUKE Remote Control Unit...', action: 'toggleNuke', shortcut: 'Ctrl+K' },
          { id: 202, label: 'Free Controllers Modulation Matrix (6x5)...', action: 'toggleMatrix', shortcut: 'Ctrl+M' },
          { id: 206, label: 'MIDI Learn & CC Mapping Matrix...', action: 'toggleMidiLearn', shortcut: 'Ctrl+L' },
          { id: 207, label: 'Hardware SysEx Dumps (Current / All Sounds / All SetUps / All Models)...', action: 'toggleHardwareDumps', shortcut: 'Ctrl+.' },
          { id: 208, label: 'DSP Calibration & Magic Numbers (43 Parameters)...', action: 'toggleCalibration', shortcut: 'Ctrl+;' },
          { id: 203, label: 'Effects Rack (Silver & Master)...', action: 'toggleMfx', shortcut: 'Ctrl+F' },
          { separator: true },
          { id: 204, label: 'Global Synth Settings...', action: 'toggleSettings', shortcut: 'Ctrl+,' },
        ],
      },
      {
        name: 'View',
        items: [
          {
            id: 301,
            label: 'Zoom',
            submenu: [
              { id: 311, label: '100% (Normal)', action: 'zoom', value: 1.0 },
              { id: 312, label: '125% (Medium)', action: 'zoom', value: 1.25 },
              { id: 313, label: '150% (Large)', action: 'zoom', value: 1.5 },
            ],
          },
          {
            id: 302,
            label: 'Color Theme',
            submenu: [
              { id: 321, label: 'MS2000 (Default Dark Cyan)', action: 'selectTheme', value: 'ms2000' },
              { id: 322, label: 'AudioLab (Pro Dark Slate)', action: 'selectTheme', value: 'audiolab' },
              { id: 323, label: 'AudioLab Light (Laboratory)', action: 'selectTheme', value: 'audiolab-light' },
              { id: 324, label: 'Advanced (High Contrast Orange)', action: 'selectTheme', value: 'advanced' },
              { id: 325, label: 'CZ101 (Classic Teal & Red)', action: 'selectTheme', value: 'cz101' },
            ],
          },
        ],
      },
      {
        name: 'Help',
        items: [
          { id: 901, label: 'Hartmann Neuron Architecture Guide...', action: 'manual', shortcut: 'F1' },
          { separator: true },
          { id: 902, label: 'Check for Updates...', action: 'checkForUpdates' },
          { id: 903, label: 'About ABDAxionikVS...', action: 'about' },
        ],
      },
    ];

    // Center HUD Slot: Active Preset Name
    const centerSlot = document.createElement('div');
    centerSlot.className = 'nav-hud-center';
    centerSlot.innerHTML = `
      <div class="hud-pill preset-slot-tag" id="nav-preset-pill" style="cursor: pointer;" title="Active Sound Preset (Click to open Bank Browser)">
        <span class="hud-label">PRESET:</span>
        <span class="hud-value" id="hud-preset-name">000 InitSound</span>
      </div>
    `;

    // Right Slot: Telemetry, Drawers & Themes
    const rightSlot = document.createElement('div');
    rightSlot.className = 'nav-hud-right';
    rightSlot.innerHTML = `
      <div class="hud-pill stat-num" title="Active polyphonic voices">
        <span class="hud-label">VOICES:</span>
        <span class="hud-value" id="hud-active-voices">0 / 12</span>
      </div>
      <div class="hud-pill stat-num" title="Audio DSP CPU Load">
        <span class="hud-label">${ICONS.cpu}</span>
        <span class="hud-value" id="hud-cpu-load">0.0 %</span>
      </div>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-nuke" title="NUKE Remote Control Unit (Ctrl+K)">
        ${ICONS.stick} <span>NUKE</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-matrix" title="Modulation Matrix 6x5 (Ctrl+M)">
        ${ICONS.matrix} <span>Matrix</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-midi" title="MIDI Learn & CC/NRPN Mapping Matrix (Ctrl+L)">
        ${CONTROL_ICONS.midiDin} <span>MIDI</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-sysex" title="Hardware SysEx Dumps & Live Inspector (Ctrl+.)">
        ${SysExIcon} <span>SysEx</span>
        <span class="nav-badge" id="nav-sysex-badge" hidden></span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-calibration" title="DSP Calibration & Magic Numbers (Ctrl+;)">
        ${ICONS.sliders} <span>Calib</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-mfx" title="Effects Rack (Silver & Master) (Ctrl+F)">
        ${ICONS.fx} <span>Effects</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-bank" title="NeuronDB Bank Browser (Ctrl+B)">
        ${ICONS.database} <span>NeuronDB</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-settings" title="Global Synth Settings & Preferences (Ctrl+,)">
        ${ICONS.settings} <span>Settings</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-theme-toggle" id="btn-nav-theme" title="Cycle Color Theme">
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
      },
      aboutDialog: {
        appName: 'ABDAxionikVS',
        subtitle: 'Hartmann Neuron / NeuronVS Faithful Modern Virtual Synthesizer',
        version: '1.0.0',
        buildInfo: 'Neuron DSP Core C++20 + WebAssembly + WebView2 Architecture',
        author: 'ABDSynths',
        copyright: '© 2026 ABDSynths',
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
    });        rightSlot.querySelector('#btn-nav-settings')?.addEventListener('click', () => {
      this.callbacks.onToggleSettings?.();
    });
        rightSlot.querySelector('#btn-nav-theme')?.addEventListener('click', () => {
          this.callbacks.onToggleTheme();
        });

        const sysexBtnEls = rightSlot.querySelectorAll<HTMLElement>('#btn-nav-sysex');
        sysexBtnEls.forEach((btn) => {
          btn.addEventListener('click', () => {
            if (!this.navBarInstance) return;
            this.setHardwareDumpsUnread(0);
            this.callbacks.onToggleHardwareDumps?.();
          });
          btn.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              if (!this.navBarInstance) return;
              this.setHardwareDumpsUnread(0);
              this.callbacks.onToggleHardwareDumps?.();
            }
          });
        });
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
    });
  }

  public setZoom(zoom: number): void {
    this.currentZoom = zoom;
    this.updateActiveValues();
  }

  public setTheme(theme: string): void {
    this.currentTheme = theme;
    this.updateActiveValues();
  }

  public setPresetName(name: string): void {
    if (this.presetNameEl) this.presetNameEl.textContent = name;
  }

  public setModelName(resynator: 1 | 2, name: string): void {
    if (resynator === 1 && this.r1ModelNameEl) {
      this.r1ModelNameEl.textContent = name;
    } else if (resynator === 2 && this.r2ModelNameEl) {
      this.r2ModelNameEl.textContent = name;
    }
  }

  public setVoices(voices: number): void {
    if (this.activeVoicesEl) this.activeVoicesEl.textContent = `${voices} / 12`;
  }

  public setCpuLoad(percent: number): void {
    if (this.cpuLoadEl) this.cpuLoadEl.textContent = `${percent.toFixed(1)} %`;
  }

  public toggleNuke(): void {
    this.callbacks.onToggleNuke?.();
  }

  public setNukeActive(active: boolean): void {
    const btn = this.container.querySelector('#btn-nav-nuke');
    if (btn) {
      btn.classList.toggle('active', active);
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
    }
  }

  public toggleMatrix(): void {
    this.callbacks.onToggleMatrix();
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
}
