/**
// ─────────────────────────────────────────────────────────
// ABDAxionikVS — Navbar Component
// Integrates with ABDShared's SynthNavBar (desktop menu bar + HUD slots)
// File / Edit / View / Help menus + Live HUD telemetry + Quick Actions
// ─────────────────────────────────────────────────────────
*/

import { createSynthNavBar } from '@abdsynths/shared/components';
import { ICONS } from './icons.js';

export interface NavbarCallbacks {
  onConfigureFolder: () => void;
  onImportModelFolder: () => void;
  onImportModelZip: () => void;
  onLoadPreset: () => void;
  onSavePreset: () => void;
  onInitPreset: () => void;
  onToggleBank: () => void;
  onToggleMatrix: () => void;
  onToggleMfx: () => void;
  onSelectPreset?: () => void;
  onSelectModel?: (resynator: 1 | 2) => void;
  onSelectTheme: (theme: string) => void;
  onToggleTheme: () => void;
  onZoom: (zoomLevel: number) => void;
}

export class AxionikNavbar {
  private container: HTMLElement;
  private callbacks: NavbarCallbacks;
  public navBarInstance: unknown = null;
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
          { id: 202, label: 'Free Controllers Modulation Matrix (6x5)...', action: 'toggleMatrix', shortcut: 'Ctrl+M' },
          { id: 203, label: 'Master FX & Dynamics Rack...', action: 'toggleMfx', shortcut: 'Ctrl+F' },
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

    // Center HUD Slot: Preset and Resynator Models
    const centerSlot = document.createElement('div');
    centerSlot.className = 'nav-hud-center';
    centerSlot.innerHTML = `
      <div class="hud-pill preset-slot-tag" id="nav-preset-pill" style="cursor: pointer;" title="Active Sound Preset">
        <span class="hud-label">PRESET:</span>
        <span class="hud-value" id="hud-preset-name">000 InitSound</span>
      </div>
      <div class="hud-pill model-slot-tag" id="nav-r1-model-pill" style="cursor: pointer;" title="Resynator 1 Model">
        <span class="hud-label">R1:</span>
        <span class="hud-value" id="hud-r1-model-name">511 sinew</span>
      </div>
      <div class="hud-pill model-slot-tag" id="nav-r2-model-pill" style="cursor: pointer;" title="Resynator 2 Model">
        <span class="hud-label">R2:</span>
        <span class="hud-value" id="hud-r2-model-name">511 sinew</span>
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
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-matrix" title="Modulation Matrix 6x5 (Ctrl+M)">
        ${ICONS.matrix} <span>Matrix</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-mfx" title="Master FX Rack (Ctrl+F)">
        ${ICONS.fx} <span>Master FX</span>
      </button>
      <button type="button" class="btn btn-hud-icon btn-secondary" id="btn-nav-bank" title="NeuronDB Bank Browser (Ctrl+B)">
        ${ICONS.database} <span>NeuronDB</span>
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
    this.r1ModelNameEl = centerSlot.querySelector('#hud-r1-model-name');
    this.r2ModelNameEl = centerSlot.querySelector('#hud-r2-model-name');
    this.activeVoicesEl = rightSlot.querySelector('#hud-active-voices');
    this.cpuLoadEl = rightSlot.querySelector('#hud-cpu-load');

    // Click on center HUD tags
    centerSlot.querySelector('#nav-preset-pill')?.addEventListener('click', () => {
      this.callbacks.onSelectPreset?.();
    });
    centerSlot.querySelector('#nav-r1-model-pill')?.addEventListener('click', () => {
      this.callbacks.onSelectModel?.(1);
    });
    centerSlot.querySelector('#nav-r2-model-pill')?.addEventListener('click', () => {
      this.callbacks.onSelectModel?.(2);
    });

    // Click on right HUD buttons
    rightSlot.querySelector('#btn-nav-matrix')?.addEventListener('click', () => {
      this.callbacks.onToggleMatrix();
    });
    rightSlot.querySelector('#btn-nav-mfx')?.addEventListener('click', () => {
      this.callbacks.onToggleMfx();
    });
    rightSlot.querySelector('#btn-nav-bank')?.addEventListener('click', () => {
      this.callbacks.onToggleBank();
    });
    rightSlot.querySelector('#btn-nav-theme')?.addEventListener('click', () => {
      this.callbacks.onToggleTheme();
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
      case 'toggleMatrix':
        this.callbacks.onToggleMatrix();
        break;
      case 'toggleMfx':
        this.callbacks.onToggleMfx();
        break;
      case 'zoom':
        if (typeof value === 'number') {
          this.currentZoom = value;
          this.callbacks.onZoom(value);
        }
        break;
      case 'selectTheme':
        if (typeof value === 'string') {
          this.currentTheme = value;
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
}
