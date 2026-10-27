// ─────────────────────────────────────────────────────────
// ABDAxionikVS — Bank Drawer Component
// Browse NeuronDB models (000..511) and sound presets (.sound)
// Styled with canonical ABDShared catalog browser styles
// (.ndb-search-row, .ndb-chip, .ndb-grid, .ndb-card, .ndb-footer)
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import type { DrawerManager } from './Drawers.js';
import {
  parseMName,
  parseMapScript,
  parseModelNamesCache,
  parseSoundScript,
} from '@abdsynths/shared/formats/neuron';

export interface BankModelEntry {
  slot: number;
  name: string;
  folderName: string;
  zoneCount: number;
  parameterSet: number;
  complexity: number;
  sourceCount: number;
  modelPath?: string;
  files?: Map<string, ArrayBuffer>;
}

export interface BankPresetEntry {
  slot: number;
  name: string;
  category: string;
  modelIndex: number;
  parameterCount: number;
  soundPath?: string;
  files?: Map<string, ArrayBuffer>;
}

export interface BankSummary {
  folderName: string;
  models: BankModelEntry[];
  presets: BankPresetEntry[];
}

export interface BankDrawerHandlers {
  onSelectModel: (slot: number, resynator: 1 | 2) => void;
  onSelectPreset: (slot: number, name: string) => void;
  onConfigureNeuronDbFolder?: () => void;
  onClearModels?: () => void;
}

const PARAM_SET_NAMES = [
  'Default Set',
  'Stringed / Bowed',
  'Plucked & Bells',
  'Plucked & Picked',
  'Carpet Shop',
  'Piano etc.',
  'Woodwinds',
  'Extreme Pads',
  'Loop Factory',
  'Multipurpose'
];

export function getPresetCategoryInfo(category: string): { icon: string; catClass: string; paramId: number } {
  const cat = (category || '').toLowerCase();
  if (cat.includes('string')) return { icon: ICONS.param1, catClass: 'cat-1', paramId: 1 };
  if (cat.includes('bell')) return { icon: ICONS.param2, catClass: 'cat-2', paramId: 2 };
  if (cat.includes('bass') || cat.includes('pluck')) return { icon: ICONS.param3, catClass: 'cat-3', paramId: 3 };
  if (cat.includes('pad')) return { icon: ICONS.param4, catClass: 'cat-4', paramId: 4 };
  if (cat.includes('key') || cat.includes('piano')) return { icon: ICONS.param5, catClass: 'cat-5', paramId: 5 };
  if (cat.includes('wind') || cat.includes('vocal') || cat.includes('choir')) return { icon: ICONS.param6, catClass: 'cat-6', paramId: 6 };
  if (cat.includes('texture') || cat.includes('drone')) return { icon: ICONS.param7, catClass: 'cat-7', paramId: 7 };
  if (cat.includes('arp') || cat.includes('loop')) return { icon: ICONS.param8, catClass: 'cat-8', paramId: 8 };
  if (cat.includes('rhythm') || cat.includes('drum')) return { icon: ICONS.param9, catClass: 'cat-9', paramId: 9 };
  return { icon: ICONS.param0, catClass: 'cat-0', paramId: 0 };
}

const STORAGE_FOLDER_KEY = 'abdsynths_axionik_neurondb_folder';
const STORAGE_BANK_KEY = 'abdsynths_axionik_neurondb_bank';

export class BankDrawer {
  private drawerManager: DrawerManager;
  private handlers: BankDrawerHandlers;
  private drawerElement: HTMLElement | null = null;
  private currentBank: BankSummary = { folderName: 'Default Library', models: [], presets: [] };
  private activeTab: 'models' | 'presets' = 'models';
  private filterQuery: string = '';

  constructor(drawerManager: DrawerManager, handlers: BankDrawerHandlers) {
    this.drawerManager = drawerManager;
    this.handlers = handlers;
    this.init();
    this.restoreFromLocalStorage();
  }

  private init(): void {
    this.drawerElement = document.createElement('div');
    this.drawerElement.className = 'bank-drawer-panel bank-drawer-view';
    this.drawerElement.innerHTML = `
      <!-- Header -->
      <div class="drawer-header ndb-modal-header">
        <div class="drawer-title ndb-header-title">
          <span class="drawer-icon">${ICONS.database}</span>
          <span class="ndb-title-text">NEURONDB BANK BROWSER</span>
          <span class="panel-badge ndb-badge" id="bank-count-badge">0 ITEMS</span>
        </div>
        <div class="drawer-header-actions">
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-configure-folder" title="Configure NeuronDB Library Folder">${ICONS.folder}</button>
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-bank" title="Close Drawer (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <!-- Integrated Search Row (ABDMS2000 & Catalog style) -->
      <div class="ndb-search-row">
        <span class="ndb-search-icon">${ICONS.search}</span>
        <input
          type="text"
          id="bank-filter-input"
          class="ndb-search-input"
          placeholder="Search models or presets by name, slot (#000), set..."
          autocomplete="off"
          spellcheck="false"
          aria-label="Search bank"
        />
      </div>

      <!-- Category / Tab Filter Chips (ABDMS2000 style) -->
      <div class="ndb-chips-row">
        <button type="button" class="ndb-chip ${this.activeTab === 'models' ? 'active' : ''}" id="tab-models">
          <span class="ndb-chip-icon">${ICONS.database}</span>
          <span class="ndb-chip-name">MODELS (000..511)</span>
          <span class="ndb-chip-count" id="count-models">0</span>
        </button>
        <button type="button" class="ndb-chip ${this.activeTab === 'presets' ? 'active' : ''}" id="tab-presets">
          <span class="ndb-chip-icon">${ICONS.sliders}</span>
          <span class="ndb-chip-name">SOUND PRESETS</span>
          <span class="ndb-chip-count" id="count-presets">0</span>
        </button>
      </div>

      <!-- Scrollable Content Wrap -->
      <div class="ndb-content-wrap" id="bank-list-container" tabindex="0" style="flex: 1; overflow-y: auto; padding: var(--space-3);">
        <!-- Model or Preset items rendered dynamically via .ndb-grid -->
      </div>

      <!-- Selection & Status Footer (ABDMS2000 style) -->
      <div class="ndb-footer" id="bank-footer" style="padding: var(--space-2) var(--space-3); border-top: 1px solid var(--color-panel-border-dim); display: flex; justify-content: space-between; align-items: center; background: var(--color-panel-surface);">
        <div class="ndb-footer-selection">
          <span class="ndb-footer-slot" id="bank-foot-slot" style="font-weight: 700; color: var(--color-accent);">LIBRARY:</span>
          <span class="ndb-footer-details" id="bank-foot-status" style="font-size: var(--text-xs); color: var(--color-text-dim);">No folder configured</span>
        </div>
        <div class="neurondb-footer-actions">
          <button type="button" class="btn btn-xs btn-primary" id="btn-bank-folder-foot">Folder...</button>
          <button type="button" class="btn btn-xs" id="btn-bank-close-foot">Close</button>
        </div>
      </div>
    `;

    this.drawerElement.querySelector('#btn-configure-folder')?.addEventListener('click', () => {
      this.promptConfigureFolder();
    });

    this.drawerElement.querySelector('#btn-bank-folder-foot')?.addEventListener('click', () => {
      this.promptConfigureFolder();
    });

    this.drawerElement.querySelector('#btn-close-bank')?.addEventListener('click', () => {
      this.close();
    });

    this.drawerElement.querySelector('#btn-bank-close-foot')?.addEventListener('click', () => {
      this.close();
    });

    const filterInput = this.drawerElement.querySelector('#bank-filter-input') as HTMLInputElement | null;
    filterInput?.addEventListener('input', () => {
      this.filterQuery = (filterInput.value || '').trim().toLowerCase();
      if (this.activeTab === 'models') {
        this.renderModels();
      } else {
        this.renderPresets();
      }
    });

    const tabModels = this.drawerElement.querySelector('#tab-models');
    const tabPresets = this.drawerElement.querySelector('#tab-presets');

    tabModels?.addEventListener('click', () => {
      this.activeTab = 'models';
      tabModels.classList.add('active');
      tabPresets?.classList.remove('active');
      this.renderModels();
    });

    tabPresets?.addEventListener('click', () => {
      this.activeTab = 'presets';
      tabPresets?.classList.add('active');
      tabModels?.classList.remove('active');
      this.renderPresets();
    });
  }

  public setBank(bank: BankSummary): void {
    this.currentBank = bank;
    this.persistToLocalStorage();
    this.updateCounters();
    if (this.activeTab === 'models') {
      this.renderModels();
    } else {
      this.renderPresets();
    }
  }

  public getBank(): BankSummary {
    return this.currentBank;
  }

  private updateCounters(): void {
    if (!this.drawerElement) return;
    const mCount = this.currentBank.models.length;
    const pCount = this.currentBank.presets.length;

    const countModelsEl = this.drawerElement.querySelector('#count-models');
    if (countModelsEl) countModelsEl.textContent = String(mCount);

    const countPresetsEl = this.drawerElement.querySelector('#count-presets');
    if (countPresetsEl) countPresetsEl.textContent = String(pCount);

    const footStatusEl = this.drawerElement.querySelector('#bank-foot-status');
    if (footStatusEl) {
      footStatusEl.textContent = `${this.currentBank.folderName} (${mCount} models, ${pCount} presets)`;
    }
  }

  private renderModels(): void {
    if (!this.drawerElement) return;
    const container = this.drawerElement.querySelector('#bank-list-container');
    if (!container) return;

    const badge = this.drawerElement.querySelector('#bank-count-badge');
    const totalModels = this.currentBank.models.length;

    if (totalModels === 0) {
      if (badge) badge.textContent = '0 MODELS';
      container.innerHTML = `
        <div class="neurondb-empty-state" style="text-align: center; padding: var(--space-6); color: var(--color-text-dim);">
          <div style="font-size: 28px; margin-bottom: var(--space-2);">${ICONS.database}</div>
          <div style="font-weight: 700; color: var(--color-text-main); margin-bottom: var(--space-1);">No models loaded in NeuronDB library</div>
          <div style="font-size: var(--text-xs); margin-bottom: var(--space-4);">Select your NeuronDB folder to scan models (000.model .. 511.model).</div>
          <button type="button" class="btn btn-sm btn-primary" id="btn-empty-configure">
            ${ICONS.folder} Configure NeuronDB Folder...
          </button>
        </div>
      `;
      container.querySelector('#btn-empty-configure')?.addEventListener('click', () => this.promptConfigureFolder());
      return;
    }

    const filtered = this.filterQuery
      ? this.currentBank.models.filter(
          (m) =>
            m.name.toLowerCase().includes(this.filterQuery) ||
            String(m.slot).includes(this.filterQuery) ||
            `#${String(m.slot).padStart(3, '0')}`.includes(this.filterQuery) ||
            (PARAM_SET_NAMES[m.parameterSet]?.toLowerCase().includes(this.filterQuery) ?? false)
        )
      : this.currentBank.models;

    if (badge) {
      badge.textContent =
        filtered.length === totalModels
          ? `${totalModels} MODELS`
          : `${filtered.length} / ${totalModels} MODELS`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="neurondb-empty-state" style="text-align: center; padding: var(--space-6); color: var(--color-text-dim);">
          <span class="empty-icon">${ICONS.database}</span>
          <span class="empty-msg">No models found matching "${this.filterQuery}"</span>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="ndb-grid">
        ${filtered
          .map((m) => {
            const setName = PARAM_SET_NAMES[m.parameterSet] || `Set ${m.parameterSet}`;
            const catClass = `cat-${m.parameterSet % 10}`;
            const iconKey = `param${m.parameterSet % 10}` as keyof typeof ICONS;
            const iconSvg = ICONS[iconKey] || ICONS.database;

            return `
              <div class="ndb-card ${catClass}" data-slot="${m.slot}">
                <div class="ndb-card-icon ${catClass}">
                  ${iconSvg}
                </div>
                <div class="ndb-card-info">
                  <div class="ndb-card-top">
                    <span class="ndb-card-slot">#${String(m.slot).padStart(3, '0')}</span>
                    <span class="ndb-card-cat ${catClass}">${setName}</span>
                  </div>
                  <div class="ndb-card-name" title="${m.name}">${m.name}</div>
                  <div class="ndb-card-meta">
                    <span class="ndb-card-badge">${m.zoneCount} Zone${m.zoneCount === 1 ? '' : 's'}</span>
                    <span class="ndb-card-badge">Lvl ${m.complexity}</span>
                  </div>
                </div>
                <div class="ndb-card-actions">
                  <button type="button" class="btn btn-xs btn-primary btn-load-r1" data-slot="${m.slot}" title="Load Model #${m.slot} into Resynator 1">
                    Set R1
                  </button>
                  <button type="button" class="btn btn-xs btn-secondary btn-load-r2" data-slot="${m.slot}" title="Load Model #${m.slot} into Resynator 2">
                    Set R2
                  </button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    container.querySelectorAll<HTMLElement>('.ndb-card').forEach((card) => {
      const slot = parseInt(card.getAttribute('data-slot') || '0', 10);
      card.addEventListener('dblclick', () => {
        this.handlers.onSelectModel(slot, 1);
      });
    });

    container.querySelectorAll('.btn-load-r1').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slot = parseInt(btn.getAttribute('data-slot') || '0', 10);
        this.handlers.onSelectModel(slot, 1);
      });
    });

    container.querySelectorAll('.btn-load-r2').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slot = parseInt(btn.getAttribute('data-slot') || '0', 10);
        this.handlers.onSelectModel(slot, 2);
      });
    });
  }

  private renderPresets(): void {
    if (!this.drawerElement) return;
    const container = this.drawerElement.querySelector('#bank-list-container');
    if (!container) return;

    const badge = this.drawerElement.querySelector('#bank-count-badge');
    const totalPresets = this.currentBank.presets.length;

    if (totalPresets === 0) {
      if (badge) badge.textContent = '0 PRESETS';
      container.innerHTML = `
        <div class="neurondb-empty-state">
          <span class="empty-icon">${ICONS.sliders}</span>
          <span class="empty-msg">No sound presets loaded</span>
          <span class="ndb-dim" style="font-size: var(--text-xs); color: var(--color-text-dim); margin-top: var(--space-1);">Presets are scanned from the Sounds/ subfolder of your NeuronDB library.</span>
          <button type="button" class="btn btn-xs btn-primary ndb-empty-action" id="btn-empty-configure-presets" style="margin-top: var(--space-3);">
            <span class="btn-icon">${ICONS.folder}</span>
            <span>Configure NeuronDB Library Folder...</span>
          </button>
        </div>
      `;
      container.querySelector('#btn-empty-configure-presets')?.addEventListener('click', () => this.promptConfigureFolder());
      return;
    }

    const filtered = this.filterQuery
      ? this.currentBank.presets.filter(
          (p) =>
            p.name.toLowerCase().includes(this.filterQuery) ||
            p.category.toLowerCase().includes(this.filterQuery) ||
            String(p.slot).includes(this.filterQuery) ||
            String(p.modelIndex).includes(this.filterQuery)
        )
      : this.currentBank.presets;

    if (badge) {
      badge.textContent =
        filtered.length === totalPresets
          ? `${totalPresets} PRESETS`
          : `${filtered.length} / ${totalPresets} PRESETS`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="neurondb-empty-state">
          <span class="empty-icon">${ICONS.sliders}</span>
          <span class="empty-msg">No presets found matching "${this.filterQuery}"</span>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="ndb-grid">
        ${filtered
          .map((p) => {
            const catInfo = getPresetCategoryInfo(p.category);
            return `
              <div class="ndb-card ${catInfo.catClass}" data-slot="${p.slot}" data-model="${p.modelIndex}">
                <div class="ndb-card-icon ${catInfo.catClass}">
                  ${catInfo.icon}
                </div>
                <div class="ndb-card-info">
                  <div class="ndb-card-top">
                    <span class="ndb-card-slot">#${String(p.slot).padStart(3, '0')}</span>
                    <span class="ndb-card-cat ${catInfo.catClass}">${p.category || 'Preset'}</span>
                  </div>
                  <div class="ndb-card-name" title="${p.name}">${p.name}</div>
                  <div class="ndb-card-meta">
                    <span class="ndb-card-badge">Uses Model #${String(p.modelIndex).padStart(3, '0')}</span>
                    <span class="ndb-card-badge">${p.parameterCount} params</span>
                  </div>
                </div>
                <div class="ndb-card-actions">
                  <button type="button" class="btn btn-xs btn-primary btn-load-preset" data-slot="${p.slot}" data-name="${p.name}" title="Load Sound Preset #${p.slot}">
                    Load Sound
                  </button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    container.querySelectorAll<HTMLElement>('.ndb-card').forEach((card) => {
      const slot = parseInt(card.getAttribute('data-slot') || '0', 10);
      const name = card.querySelector('.ndb-card-name')?.textContent || 'Preset';
      card.addEventListener('dblclick', () => {
        this.handlers.onSelectPreset(slot, name);
      });
    });

    container.querySelectorAll('.btn-load-preset').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slot = parseInt(btn.getAttribute('data-slot') || '0', 10);
        const name = btn.getAttribute('data-name') || 'Preset';
        this.handlers.onSelectPreset(slot, name);
      });
    });
  }

  public promptConfigureFolder(): void {
    const win = window as Window & {
      showDirectoryPicker?: (opts?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>;
    };

    if (typeof win.showDirectoryPicker === 'function') {
      void (async () => {
        try {
          const dirHandle = await win.showDirectoryPicker!({ mode: 'read' });
          await this.scanDirectoryHandle(dirHandle);
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          console.warn('[BankDrawer] Directory selection aborted or error:', err);
        }
      })();
      return;
    }

    // Fallback file input with webkitdirectory
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    (fileInput as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true;
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', async () => {
      const fileList = fileInput.files;
      if (fileList && fileList.length > 0) {
        await this.scanFileList(fileList);
      }
      fileInput.remove();
    });
    fileInput.click();
  }

  private async scanDirectoryHandle(rootHandle: FileSystemDirectoryHandle): Promise<void> {
    type IterDir = FileSystemDirectoryHandle & {
      values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
    };

    const models: BankModelEntry[] = [];
    const presets: BankPresetEntry[] = [];

    const directFiles: FileSystemFileHandle[] = [];
    const subDirs = new Map<string, FileSystemDirectoryHandle>();

    for await (const entry of (rootHandle as IterDir).values()) {
      if (entry.name.startsWith('.') || entry.name.startsWith('._') || entry.name === '__MACOSX') continue;
      if (entry.kind === 'file') {
        directFiles.push(entry as FileSystemFileHandle);
      } else if (entry.kind === 'directory') {
        subDirs.set(entry.name, entry as FileSystemDirectoryHandle);
      }
    }

    // Check for ModelNames cache
    let cachedModelNames = new Map<number, string>();
    const mnHandle = directFiles.find((f) => f.name.toLowerCase() === 'modelnames');
    if (mnHandle) {
      try {
        const f = await mnHandle.getFile();
        const text = await f.text();
        cachedModelNames = parseModelNamesCache(text);
      } catch {
        // ignore
      }
    }

    // Scan Models subfolders or direct <NNN>.model folders
    let modelsContainer: FileSystemDirectoryHandle | null = null;
    const modelSubDirs = new Map<number, FileSystemDirectoryHandle>();

    for (const [name, dir] of subDirs.entries()) {
      const m = /^(\d{3})\.model$/i.exec(name);
      if (m) {
        modelSubDirs.set(parseInt(m[1], 10), dir);
      } else if (name.toLowerCase() === 'models') {
        modelsContainer = dir;
      }
    }

    if (modelSubDirs.size === 0 && modelsContainer) {
      for await (const entry of (modelsContainer as IterDir).values()) {
        if (entry.kind === 'directory') {
          const m = /^(\d{3})\.model$/i.exec(entry.name);
          if (m) {
            modelSubDirs.set(parseInt(m[1], 10), entry as FileSystemDirectoryHandle);
          }
        }
      }
    }

    for (const [slot, dir] of modelSubDirs.entries()) {
      let modelName = cachedModelNames.get(slot) || dir.name.replace(/\.model$/i, '');
      let zoneCount = 1;
      let paramSet = 0;
      let complexity = 5;

      try {
        for await (const fileEntry of (dir as IterDir).values()) {
          if (fileEntry.kind === 'file') {
            if (fileEntry.name.toLowerCase() === 'mname') {
              const file = await (fileEntry as FileSystemFileHandle).getFile();
              const text = await file.text();
              const parsedName = parseMName(text);
              if (parsedName) modelName = parsedName;
            } else if (fileEntry.name.toLowerCase() === 'map.script') {
              const file = await (fileEntry as FileSystemFileHandle).getFile();
              const text = await file.text();
              const mapScript = parseMapScript(text);
              zoneCount = mapScript.activeZones.length || 1;
            }
          }
        }
      } catch {
        // ignore individual read errors
      }

      models.push({
        slot,
        name: modelName,
        folderName: dir.name,
        zoneCount,
        parameterSet: paramSet,
        complexity,
        sourceCount: zoneCount,
        modelPath: dir.name
      });
    }

    // Check for Sounds subfolder
    const soundsDir = subDirs.get('Sounds') || subDirs.get('sounds');
    if (soundsDir) {
      for await (const entry of (soundsDir as IterDir).values()) {
        if (entry.kind === 'directory') {
          const m = /^(\d{3})\.sound$/i.exec(entry.name);
          const slot = m ? parseInt(m[1], 10) : presets.length;
          let soundName = entry.name.replace(/\.sound$/i, '');
          let cat = 'Sound';
          let modelIdx = slot;

          try {
            for await (const sf of (entry as IterDir).values()) {
              if (sf.kind === 'file' && sf.name.toLowerCase() === 'sound.script') {
                const f = await (sf as FileSystemFileHandle).getFile();
                const text = await f.text();
                const parsed = parseSoundScript(text);
                if (parsed.name) soundName = parsed.name;
                if (parsed.r1ModelIndex !== undefined) modelIdx = parsed.r1ModelIndex;
              }
            }
          } catch {
            // ignore
          }

          presets.push({
            slot,
            name: soundName,
            category: cat,
            modelIndex: modelIdx,
            parameterCount: 445
          });
        }
      }
    }

    models.sort((a, b) => a.slot - b.slot);
    presets.sort((a, b) => a.slot - b.slot);

    this.setBank({
      folderName: rootHandle.name,
      models,
      presets
    });
    this.open();
  }

  private async scanFileList(fileList: FileList): Promise<void> {
    const modelsMap = new Map<number, BankModelEntry>();
    const presetsMap = new Map<number, BankPresetEntry>();

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split(/[/\\]/);

      // Model folder match: .../NNN.model/file
      for (let p = 0; p < parts.length - 1; p++) {
        const m = /^(\d{3})\.model$/i.exec(parts[p]);
        if (m) {
          const slot = parseInt(m[1], 10);
          if (!modelsMap.has(slot)) {
            modelsMap.set(slot, {
              slot,
              name: `Model #${String(slot).padStart(3, '0')}`,
              folderName: parts[p],
              zoneCount: 1,
              parameterSet: 0,
              complexity: 5,
              sourceCount: 1
            });
          }
          const entry = modelsMap.get(slot)!;
          const fileName = parts[parts.length - 1].toLowerCase();
          if (fileName === 'mname') {
            try {
              const text = await file.text();
              const parsed = parseMName(text);
              if (parsed) entry.name = parsed;
            } catch {
              // ignore
            }
          } else if (fileName === 'map.script') {
            try {
              const text = await file.text();
              const mapScript = parseMapScript(text);
              entry.zoneCount = mapScript.activeZones.length || 1;
            } catch {
              // ignore
            }
          }
        }
      }
    }

    const models = Array.from(modelsMap.values()).sort((a, b) => a.slot - b.slot);
    const presets = Array.from(presetsMap.values()).sort((a, b) => a.slot - b.slot);

    const folderName = fileList[0]?.webkitRelativePath?.split(/[/\\]/)[0] || 'Selected Folder';

    this.setBank({
      folderName,
      models,
      presets
    });
    this.open();
  }

  private persistToLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_FOLDER_KEY, this.currentBank.folderName);
      const lightBank = {
        folderName: this.currentBank.folderName,
        models: this.currentBank.models.map((m) => ({
          slot: m.slot,
          name: m.name,
          folderName: m.folderName,
          zoneCount: m.zoneCount,
          parameterSet: m.parameterSet,
          complexity: m.complexity,
          sourceCount: m.sourceCount
        })),
        presets: this.currentBank.presets.map((p) => ({
          slot: p.slot,
          name: p.name,
          category: p.category,
          modelIndex: p.modelIndex,
          parameterCount: p.parameterCount
        }))
      };
      localStorage.setItem(STORAGE_BANK_KEY, JSON.stringify(lightBank));
    } catch {
      // ignore storage quota errors
    }
  }

  private restoreFromLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const rawBank = localStorage.getItem(STORAGE_BANK_KEY);
      if (rawBank) {
        const parsed = JSON.parse(rawBank);
        if (parsed && Array.isArray(parsed.models)) {
          this.currentBank = {
            folderName: parsed.folderName || 'Persisted Library',
            models: parsed.models,
            presets: Array.isArray(parsed.presets) ? parsed.presets : []
          };
          this.updateCounters();
        }
      }
    } catch {
      // ignore
    }
  }

  public isOpen(): boolean {
    return this.drawerManager.getCurrentDrawerId() === 'bank';
  }

  public toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    if (!this.drawerElement) return;
    this.drawerManager.openCustom('bank', this.drawerElement);
    const filterInput = this.drawerElement.querySelector('#bank-filter-input') as HTMLInputElement | null;
    if (filterInput) {
      setTimeout(() => filterInput.focus(), 80);
    }
  }

  public close(): void {
    if (this.isOpen()) {
      this.drawerManager.close();
    }
  }

  public destroy(): void {
    if (this.drawerManager.getCurrentDrawerId() === 'bank') {
      this.drawerManager.close();
    }
    this.drawerElement = null;
  }
}
