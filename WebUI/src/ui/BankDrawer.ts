// ─────────────────────────────────────────────────────────
// ABDAxionikVS — Bank Drawer Component
// Browse NeuronDB models (000..511) and sound presets (.sound)
// Styled with canonical ABDShared catalog browser styles
// (.ndb-search-row, .ndb-chip, .ndb-grid, .ndb-card, .ndb-footer)
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import type { DrawerManager } from './Drawers.js';
import { WebBridge } from '../bridge/WebBridge.js';
import {
  MODEL_METADATA,
  PRESET_METADATA,
  createCanonicalBank,
  getCanonicalModelName,
  getCanonicalPresetName,
} from './NeuronCatalogMetadata.js';
import {
  parseMName,
  parseMapScript,
  parseModelNamesCache,
  parseSoundScript,
} from '@abdsynths/shared/formats/neuron';
import { createBankShell } from '@abdsynths/shared/components/bank/bankShell.js';
import { bankCardHtml, bindBankCards } from '@abdsynths/shared/components/bank/bankCard.js';

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

export const PARAM_SET_NAMES = [
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

export const PARAMETER_SETS = [
  { id: 0, name: 'Default Set', category: 'General' },
  { id: 1, name: 'Stringed / Bowed', category: 'Strings' },
  { id: 2, name: 'Plucked & Bells', category: 'Plucked' },
  { id: 3, name: 'Plucked & Picked', category: 'Plucked' },
  { id: 4, name: 'Carpet Shop', category: 'Pads' },
  { id: 5, name: 'Piano etc.', category: 'Keys' },
  { id: 6, name: 'Woodwinds', category: 'Wind' },
  { id: 7, name: 'Extreme Pads', category: 'Pads' },
  { id: 8, name: 'Loop Factory', category: 'Loops' },
  { id: 9, name: 'Multipurpose', category: 'Multi' }
];

const STICK_TABLE = [4, 8, 8, 12, 16, 20, 32, 32, 48, 64];

export function stickModesToComplexity(modes: number): number {
  const idx = STICK_TABLE.indexOf(modes);
  return idx >= 0 ? idx + 1 : Math.max(1, Math.min(10, Math.round(modes / 6.4)));
}

export function getPresetCategoryInfo(category: string): { icon: string; catClass: string; paramId: number } {
  const cat = (category || '').toLowerCase();
  if (cat.includes('string') || cat.includes('solo') || cat.includes('chord')) return { icon: ICONS.param1, catClass: 'cat-1', paramId: 1 };
  if (cat.includes('bell') || cat.includes('percussion') || cat.includes('world')) return { icon: ICONS.param2, catClass: 'cat-2', paramId: 2 };
  if (cat.includes('bass') || cat.includes('pluck') || cat.includes('plugged')) return { icon: ICONS.param3, catClass: 'cat-3', paramId: 3 };
  if (cat.includes('pad') || cat.includes('showcase')) return { icon: ICONS.param4, catClass: 'cat-4', paramId: 4 };
  if (cat.includes('key') || cat.includes('piano') || cat.includes('organ')) return { icon: ICONS.param5, catClass: 'cat-5', paramId: 5 };
  if (cat.includes('wind') || cat.includes('reed') || cat.includes('brass') || cat.includes('vocal') || cat.includes('voice') || cat.includes('choir')) return { icon: ICONS.param6, catClass: 'cat-6', paramId: 6 };
  if (cat.includes('texture') || cat.includes('drone') || cat.includes('fx')) return { icon: ICONS.param7, catClass: 'cat-7', paramId: 7 };
  if (cat.includes('arp') || cat.includes('loop') || cat.includes('sequenced')) return { icon: ICONS.param8, catClass: 'cat-8', paramId: 8 };
  if (cat.includes('rhythm') || cat.includes('drum')) return { icon: ICONS.param9, catClass: 'cat-9', paramId: 9 };
  return { icon: ICONS.param0, catClass: 'cat-0', paramId: 0 };
}

const STORAGE_FOLDER_KEY = 'abdsynths_axionik_neurondb_folder';
const STORAGE_BANK_KEY = 'abdsynths_axionik_neurondb_bank';

export class BankDrawer {
  private drawerManager: DrawerManager;
  private handlers: BankDrawerHandlers;
  private drawerElement: HTMLElement | null = null;
  private shell!: ReturnType<typeof createBankShell>;
  private cardUnbind: (() => void) | null = null;
  private currentBank: BankSummary = { folderName: 'Default Library', models: [], presets: [] };
  private activeTab: 'models' | 'presets' = 'models';
  private preferredResynator: 1 | 2 = 1;
  private callerContext: 'r1' | 'r2' | 'global' = 'global';
  private selectedCategory: number | 'all' = 'all';
  private selectedPresetCategory: string = 'all';
  private filterQuery: string = '';

  constructor(drawerManager: DrawerManager, handlers: BankDrawerHandlers) {
    this.drawerManager = drawerManager;
    this.handlers = handlers;
    this.init();
    this.restoreFromLocalStorage();
  }

  private init(): void {
    this.shell = createBankShell({
      title: 'NEURONDB BANK BROWSER',
      badge: '0 ITEMS',
      tabs: [
        { id: 'models', label: 'MODELS (000..511)', iconHtml: ICONS.database },
        { id: 'presets', label: 'SOUND PRESETS', iconHtml: ICONS.sliders },
      ],
      activeTab: this.activeTab,
      searchPlaceholder: 'Search models or presets by name, slot (#000), set...',
      headerActions: [
        { id: 'refresh', label: 'Refresh', title: 'Refresh & Re-index Library Metadata', iconHtml: ICONS.refresh },
        { id: 'folder', label: 'Folder', title: 'Configure NeuronDB Library Folder', iconHtml: ICONS.folder },
        { id: 'close', label: 'Close', title: 'Close Drawer (Esc)', iconHtml: ICONS.close },
      ],
      onTabChange: (tab) => {
        this.setTab(tab as 'models' | 'presets');
      },
      onSearch: (query) => {
        this.filterQuery = query;
        if (this.activeTab === 'models') {
          this.renderModels();
        } else {
          this.renderPresets();
        }
      },
      onHeaderAction: (action) => {
        if (action === 'refresh') {
          WebBridge.scanBank();
          this.refreshLibrary();
        } else if (action === 'folder') {
          this.promptConfigureFolder();
        }
      },
      onFooterAction: (action) => {
        if (action === 'refresh') {
          WebBridge.scanBank();
          this.refreshLibrary();
        } else if (action === 'folder') {
          this.promptConfigureFolder();
        } else if (action === 'close') {
          this.close();
        }
      },
      onClose: () => {
        this.close();
      },
    });
    this.drawerElement = this.shell.element;
    this.drawerElement.classList.add('bank-drawer-view');
    // The shared shell leaves icon slots empty; the host owns its icons.
    const shellIcon = this.drawerElement.querySelector('[data-shell-icon]');
    if (shellIcon) shellIcon.innerHTML = ICONS.database;
    const shellSearchIcon = this.drawerElement.querySelector('[data-shell-search-icon]');
    if (shellSearchIcon) shellSearchIcon.innerHTML = ICONS.search;
    // Keep the historical content id and inline layout so host CSS applies unchanged.
    this.shell.contentEl.id = 'bank-list-container';
    this.shell.contentEl.setAttribute('style', 'flex: 1; overflow-y: auto; padding: var(--space-3);');
    // Keep the historical footer id and inline layout.
    this.shell.footerEl.id = 'bank-footer';
    this.shell.footerEl.setAttribute(
      'style',
      'padding: var(--space-2) var(--space-3); border-top: 1px solid var(--color-panel-border-dim); display: flex; justify-content: space-between; align-items: center; background: var(--color-panel-surface);'
    );
    this.renderToolbar();
    this.renderFooter();
  }

  private renderToolbar(): void {
    if (!this.drawerElement) return;
    this.shell.toolbarEl.innerHTML = `
      <!-- Category Filter Chips Row (Parity with ABDNeuModMakr) -->
      <div class="ndb-chips-row ndb-cat-chips-row" id="ndb-cat-chips-row" style="display: flex; flex-wrap: wrap; gap: 4px; padding: 4px var(--space-3); background: var(--color-panel-surface); border-bottom: 1px solid var(--color-panel-border-dim);">
        <!-- Category chips dynamically injected via renderCategoryChips -->
      </div>

      <!-- Target Resynator Selector (visible on Models tab) -->
      <div id="ndb-target-resynator-row" style="display: ${this.activeTab === 'models' ? 'flex' : 'none'}; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background: var(--color-panel-surface); border-bottom: 1px solid var(--color-panel-border-dim);">
        <span class="hud-label" id="ndb-target-label" style="font-size: 10px; font-weight: 700; color: var(--color-text-muted);">ASSIGN TARGET:</span>
        <div class="ndb-chips-row" id="ndb-target-chips" style="gap: var(--space-2); margin: 0; padding: 0;">
          <button type="button" class="ndb-chip ${this.preferredResynator === 1 ? 'active' : ''}" id="btn-target-r1" style="padding: 2px 10px; font-size: 10px;">
            Resynator 1 (R1)
          </button>
          <button type="button" class="ndb-chip ${this.preferredResynator === 2 ? 'active' : ''}" id="btn-target-r2" style="padding: 2px 10px; font-size: 10px;">
            Resynator 2 (R2)
          </button>
        </div>
      </div>
    `;

    this.drawerElement.querySelector('#btn-target-r1')?.addEventListener('click', () => {
      this.callerContext = 'r1';
      this.setPreferredResynator(1);
    });

    this.drawerElement.querySelector('#btn-target-r2')?.addEventListener('click', () => {
      this.callerContext = 'r2';
      this.setPreferredResynator(2);
    });
  }

  private renderFooter(): void {
    if (!this.drawerElement) return;
    this.shell.footerEl.innerHTML = `
      <div class="ndb-footer-selection">
        <span class="ndb-footer-slot" id="bank-foot-slot" style="font-weight: 700; color: var(--color-accent);">LIBRARY:</span>
        <span class="ndb-footer-details" id="bank-foot-status" style="font-size: var(--text-xs); color: var(--color-text-dim);">No folder configured</span>
      </div>
      <div class="neurondb-footer-actions">
        <button type="button" class="btn btn-xs btn-outline" data-footer-action="refresh" title="Refresh & re-index library metadata">Refresh</button>
        <button type="button" class="btn btn-xs btn-primary" data-footer-action="folder">Folder...</button>
        <button type="button" class="btn btn-xs" data-footer-action="close">Close</button>
      </div>
    `;
  }

  public setBank(bank: BankSummary): void {
    this.currentBank = bank;
    this.persistToLocalStorage();
    this.updateCounters();
    this.renderCategoryChips();
    if (this.activeTab === 'models') {
      this.renderModels();
    } else {
      this.renderPresets();
    }
  }

  public syncCatalogFromHost(data: {
    folderName?: string;
    models?: BankModelEntry[];
    presets?: BankPresetEntry[];
  }): void {
    if (!data || !Array.isArray(data.models) || !Array.isArray(data.presets)) return;
    if (data.models.length === 0 && data.presets.length === 0) return;

    const presets: BankPresetEntry[] = data.presets.map((p) => {
      const pMeta = PRESET_METADATA[p.slot];
      const mIdx = p.modelIndex ?? (pMeta ? pMeta[0] : p.slot);
      const rawCat = (p.category && p.category !== 'General' && p.category !== 'Sound')
        ? p.category
        : (pMeta ? pMeta[1] : (PARAM_SET_NAMES[mIdx % 10] || 'General'));
      return {
        ...p,
        modelIndex: mIdx,
        category: rawCat,
      };
    });

    const models: BankModelEntry[] = data.models.map((m) => {
      const meta = MODEL_METADATA[m.slot];
      return {
        ...m,
        parameterSet: meta ? meta[0] : (m.parameterSet ?? (m.slot % 10)),
        complexity: meta ? meta[1] : (m.complexity ?? 5),
      };
    });

    this.currentBank = {
      folderName: data.folderName || 'NeuronDB (Disk Sync)',
      models,
      presets,
    };

    this.persistToLocalStorage();
    this.updateCounters();
    this.renderCategoryChips();

    if (this.activeTab === 'models') {
      this.renderModels();
    } else {
      this.renderPresets();
    }

    const statusEl = this.drawerElement?.querySelector('#bank-foot-status');
    if (statusEl) {
      statusEl.textContent = `${this.currentBank.folderName} (${models.length} models, ${presets.length} presets)`;
    }
    console.log(`[BankDrawer] Synced ${models.length} models and ${presets.length} presets from native host.`);
  }

  public getBank(): BankSummary {
    return this.currentBank;
  }

  public refreshLibrary(): void {
    if (this.currentBank.models.length === 0) {
      const canonical = createCanonicalBank();
      this.currentBank = {
        folderName: canonical.folderName,
        models: canonical.models,
        presets: canonical.presets,
      };
    }

    const models = this.currentBank.models.map((m) => {
      const meta = MODEL_METADATA[m.slot];
      return {
        ...m,
        parameterSet: meta ? meta[0] : (m.parameterSet ?? 0),
        complexity: meta ? meta[1] : (m.complexity ?? 5),
      };
    });

    const presets = this.currentBank.presets.map((p) => {
      const pMeta = PRESET_METADATA[p.slot];
      const mIdx = pMeta ? pMeta[0] : (p.modelIndex ?? p.slot);
      const rawCat = pMeta
        ? pMeta[1]
        : (p.category && p.category !== 'Sound' && p.category !== 'General'
            ? p.category
            : (PARAM_SET_NAMES[mIdx % 10] || 'General'));
      return {
        ...p,
        modelIndex: mIdx,
        category: rawCat,
      };
    });

    this.currentBank.models = models;
    this.currentBank.presets = presets;
    this.persistToLocalStorage();
    this.updateCounters();
    this.renderCategoryChips();

    if (this.activeTab === 'models') {
      this.renderModels();
    } else {
      this.renderPresets();
    }

    // Persistent confirmation with timestamp: refreshing with identical data
    // changes no counters, so the time proves the click did something.
    // The message stays until the next bank update restores the summary.
    const statusEl = this.shell.footerEl.querySelector('#bank-foot-status');
    if (statusEl) {
      const time = new Date().toLocaleTimeString();
      statusEl.textContent = `Library refreshed & re-indexed (${models.length} models, ${presets.length} presets) · ${time}`;
    }
  }

  private updateCounters(): void {
    if (!this.drawerElement) return;
    const mCount = this.currentBank.models.length;
    const pCount = this.currentBank.presets.length;

    this.shell.setTabCount('models', mCount);
    this.shell.setTabCount('presets', pCount);

    const footStatusEl = this.shell.footerEl.querySelector('#bank-foot-status');
    if (footStatusEl) {
      footStatusEl.textContent = `${this.currentBank.folderName} (${mCount} models, ${pCount} presets)`;
    }
  }

  private updateTargetRowUI(): void {
    if (!this.drawerElement) return;
    const targetRow = this.drawerElement.querySelector('#ndb-target-resynator-row') as HTMLElement | null;
    const label = this.drawerElement.querySelector('#ndb-target-label');
    const btnR1 = this.drawerElement.querySelector('#btn-target-r1');
    const btnR2 = this.drawerElement.querySelector('#btn-target-r2');

    if (!targetRow) return;
    if (this.activeTab !== 'models') {
      targetRow.style.display = 'none';
      return;
    }
    targetRow.style.display = 'flex';

    if (this.callerContext === 'r1') {
      if (label) label.textContent = 'TARGET: RESYNATOR 1 (R1)';
      btnR1?.classList.add('active');
      btnR2?.classList.remove('active');
    } else if (this.callerContext === 'r2') {
      if (label) label.textContent = 'TARGET: RESYNATOR 2 (R2)';
      btnR2?.classList.add('active');
      btnR1?.classList.remove('active');
    } else {
      if (label) label.textContent = 'ASSIGN TARGET:';
      if (this.preferredResynator === 1) {
        btnR1?.classList.add('active');
        btnR2?.classList.remove('active');
      } else {
        btnR2?.classList.add('active');
        btnR1?.classList.remove('active');
      }
    }
  }

  private renderCategoryChips(): void {
    if (!this.drawerElement) return;
    const container = this.drawerElement.querySelector('#ndb-cat-chips-row') as HTMLElement | null;
    if (!container) return;

    container.style.display = 'flex';

    if (this.activeTab === 'presets') {
      const catCounts: Record<string, number> = {};
      for (const p of this.currentBank.presets) {
        const c = p.category || 'General';
        catCounts[c] = (catCounts[c] || 0) + 1;
      }
      const allActive = this.selectedPresetCategory === 'all';
      let html = `
        <button type="button" class="ndb-chip ${allActive ? 'active' : ''}" data-pcat="all" style="padding: 2px 8px; font-size: 10px;">
          All (${this.currentBank.presets.length})
        </button>
      `;
      const orderedCats = Object.keys(catCounts).sort();
      for (const cat of orderedCats) {
        const isAct = this.selectedPresetCategory === cat;
        const info = getPresetCategoryInfo(cat);
        html += `
          <button type="button" class="ndb-chip ${info.catClass} ${isAct ? 'active' : ''}" data-pcat="${cat}" style="padding: 2px 8px; font-size: 10px;">
            ${cat} (${catCounts[cat]})
          </button>
        `;
      }
      container.innerHTML = html;
      container.querySelectorAll<HTMLButtonElement>('.ndb-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectedPresetCategory = btn.getAttribute('data-pcat') || 'all';
          this.renderCategoryChips();
          this.renderPresets();
        });
      });
      return;
    }

    // Compute live counts per parameterSet (0..9)
    const counts: Record<number, number> = {};
    for (const m of this.currentBank.models) {
      counts[m.parameterSet] = (counts[m.parameterSet] || 0) + 1;
    }

    const allActive = this.selectedCategory === 'all';
    let html = `
      <button type="button" class="ndb-chip ${allActive ? 'active' : ''}" data-cat="all" style="padding: 2px 8px; font-size: 10px;">
        All (${this.currentBank.models.length})
      </button>
    `;

    for (let i = 0; i <= 9; i++) {
      const count = counts[i] || 0;
      if (count === 0 && this.currentBank.models.length > 0) continue;
      const isAct = this.selectedCategory === i;
      const ps = PARAMETER_SETS[i];
      const catName = ps ? ps.name : `Set ${i}`;
      html += `
        <button type="button" class="ndb-chip cat-${i} ${isAct ? 'active' : ''}" data-cat="${i}" style="padding: 2px 8px; font-size: 10px;" title="${catName}">
          <span class="cat-${i}" style="font-weight: 700;">${i}:</span> ${ps ? ps.category : catName} (${count})
        </button>
      `;
    }

    container.innerHTML = html;

    container.querySelectorAll<HTMLButtonElement>('.ndb-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat');
        this.selectedCategory = cat === 'all' ? 'all' : parseInt(cat || '0', 10);
        this.renderCategoryChips();
        this.renderModels();
      });
    });
  }

  private showTargetChoiceModal(slot: number, modelName: string): void {
    if (!this.drawerElement) return;
    this.drawerElement.querySelector('.ndb-choice-modal-overlay')?.remove();

    const modal = document.createElement('div');
    modal.className = 'ndb-choice-modal-overlay';
    modal.innerHTML = `
      <div class="ndb-choice-modal-card">
        <div class="ndb-choice-modal-header">
          <span class="ndb-choice-modal-icon">${ICONS.database}</span>
          <span class="ndb-choice-modal-title">ASSIGN MODEL #${String(slot).padStart(3, '0')}</span>
        </div>
        <div class="ndb-choice-modal-name">${modelName}</div>
        <div class="ndb-choice-modal-desc">Choose which Resynator to load this model into:</div>
        <div class="ndb-choice-modal-actions">
          <button type="button" class="btn btn-sm btn-primary" id="btn-modal-choose-r1">
            → Load to Resynator 1 (R1)
          </button>
          <button type="button" class="btn btn-sm btn-secondary" id="btn-modal-choose-r2">
            → Load to Resynator 2 (R2)
          </button>
        </div>
        <div class="ndb-choice-modal-footer">
          <button type="button" class="btn btn-xs btn-outline" id="btn-modal-choose-cancel">Cancel</button>
        </div>
      </div>
    `;

    this.drawerElement.appendChild(modal);

    modal.querySelector('#btn-modal-choose-r1')?.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.remove();
      this.handlers.onSelectModel(slot, 1);
      this.close();
    });

    modal.querySelector('#btn-modal-choose-r2')?.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.remove();
      this.handlers.onSelectModel(slot, 2);
      this.close();
    });

    modal.querySelector('#btn-modal-choose-cancel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  private handleModelLoadRequest(slot: number, modelName: string): void {
    if (this.callerContext === 'r1') {
      this.handlers.onSelectModel(slot, 1);
      this.close();
      return;
    }
    if (this.callerContext === 'r2') {
      this.handlers.onSelectModel(slot, 2);
      this.close();
      return;
    }

    // Global caller context: show clean modal dialog
    this.showTargetChoiceModal(slot, modelName);
  }

  private renderModels(): void {
    if (!this.drawerElement) return;
    const container = this.shell.contentEl;

    const totalModels = this.currentBank.models.length;

    if (totalModels === 0) {
      this.shell.setBadge('0 MODELS');
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

    let filtered = this.currentBank.models;
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter((m) => m.parameterSet === this.selectedCategory);
    }
    if (this.filterQuery) {
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(this.filterQuery) ||
          String(m.slot).includes(this.filterQuery) ||
          `#${String(m.slot).padStart(3, '0')}`.includes(this.filterQuery) ||
          (PARAM_SET_NAMES[m.parameterSet]?.toLowerCase().includes(this.filterQuery) ?? false)
      );
    }

    this.shell.setBadge(
      filtered.length === totalModels
        ? `${totalModels} MODELS`
        : `${filtered.length} / ${totalModels} MODELS`
    );

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="neurondb-empty-state" style="text-align: center; padding: var(--space-6); color: var(--color-text-dim);">
          <span class="empty-icon">${ICONS.database}</span>
          <span class="empty-msg">No models found matching "${this.filterQuery}"</span>
        </div>
      `;
      return;
    }

    const btnLabel =
      this.callerContext === 'r1'
        ? 'Load to R1'
        : this.callerContext === 'r2'
        ? 'Load to R2'
        : 'Load';

    const grid = document.createElement('div');
    grid.className = 'ndb-grid';
    grid.innerHTML = filtered
      .map((m) => {
        const setName = PARAM_SET_NAMES[m.parameterSet] || `Set ${m.parameterSet}`;
        const catClass = `cat-${m.parameterSet % 10}`;
        const iconKey = `param${m.parameterSet % 10}` as keyof typeof ICONS;
        return bankCardHtml({
          slot: m.slot,
          catClass,
          catLabel: setName,
          name: m.name,
          iconHtml: ICONS[iconKey] || ICONS.database,
          badges: [
            `${m.zoneCount} Zone${m.zoneCount === 1 ? '' : 's'}`,
            `Lvl ${m.complexity}`,
          ],
          actions: [{ id: 'load', label: btnLabel }],
        });
      })
      .join('');
    container.innerHTML = '';
    container.appendChild(grid);

    this.cardUnbind?.();
    this.cardUnbind = bindBankCards(grid, {
      onCardClick: (slot) => {
        const name = this.currentBank.models.find((m) => m.slot === slot)?.name || `Model #${slot}`;
        this.handleModelLoadRequest(slot, name);
      },
      onAction: ({ slot }) => {
        const name = this.currentBank.models.find((m) => m.slot === slot)?.name || `Model #${slot}`;
        this.handleModelLoadRequest(slot, name);
      },
    });
  }

  private renderPresets(): void {
    if (!this.drawerElement) return;
    const container = this.shell.contentEl;

    const totalPresets = this.currentBank.presets.length;

    if (totalPresets === 0) {
      this.shell.setBadge('0 PRESETS');
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

    const catFiltered = this.selectedPresetCategory === 'all'
      ? this.currentBank.presets
      : this.currentBank.presets.filter((p) => p.category === this.selectedPresetCategory);

    const filtered = this.filterQuery
      ? catFiltered.filter(
          (p) =>
            p.name.toLowerCase().includes(this.filterQuery) ||
            p.category.toLowerCase().includes(this.filterQuery) ||
            String(p.slot).includes(this.filterQuery) ||
            String(p.modelIndex).includes(this.filterQuery)
        )
      : catFiltered;

    this.shell.setBadge(
      filtered.length === totalPresets
        ? `${totalPresets} PRESETS`
        : `${filtered.length} / ${totalPresets} PRESETS`
    );

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="neurondb-empty-state">
          <span class="empty-icon">${ICONS.sliders}</span>
          <span class="empty-msg">No presets found matching "${this.filterQuery}"</span>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'ndb-grid';
    grid.innerHTML = filtered
      .map((p) => {
        const catInfo = getPresetCategoryInfo(p.category);
        return bankCardHtml({
          slot: p.slot,
          catClass: catInfo.catClass,
          catLabel: p.category || 'Preset',
          name: p.name,
          iconHtml: catInfo.icon,
          badges: [
            `Uses Model #${String(p.modelIndex).padStart(3, '0')}`,
            `${p.parameterCount} params`,
          ],
          actions: [
            { id: 'load-preset', label: 'Load Sound', title: `Load Sound Preset #${p.slot}` },
          ],
        });
      })
      .join('');
    container.innerHTML = '';
    container.appendChild(grid);

    this.cardUnbind?.();
    this.cardUnbind = bindBankCards(grid, {
      onCardDblClick: (slot) => {
        const name = this.currentBank.presets.find((p) => p.slot === slot)?.name || 'Preset';
        this.handlers.onSelectPreset(slot, name);
        this.close();
      },
      onAction: ({ slot }) => {
        const name = this.currentBank.presets.find((p) => p.slot === slot)?.name || 'Preset';
        this.handlers.onSelectPreset(slot, name);
        this.close();
      },
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
            } else if (fileEntry.name.toLowerCase().endsWith('.sphere')) {
              try {
                const file = await (fileEntry as FileSystemFileHandle).getFile();
                if (file.size >= 0x20) {
                  const buf = await file.slice(0, 32).arrayBuffer();
                  const view = new DataView(buf);
                  const tag = String.fromCharCode(
                    view.getUint8(0),
                    view.getUint8(1),
                    view.getUint8(2),
                    view.getUint8(3)
                  );
                  if (tag === 'psAN') {
                    const pSet = view.getInt32(0x10, true);
                    const stickModes = view.getInt32(0x1c, true);
                    if (pSet >= 0 && pSet <= 9) paramSet = pSet;
                    if (stickModes >= 1 && stickModes <= 64) {
                      complexity = stickModesToComplexity(stickModes);
                    }
                  }
                }
              } catch {
                // ignore individual corrupt sphere header
              }
            }
          }
        }
      } catch {
        // ignore individual read errors
      }

      if (paramSet === 0 && MODEL_METADATA[slot]) {
        paramSet = MODEL_METADATA[slot][0];
        complexity = MODEL_METADATA[slot][1];
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
          let cat = 'General';
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

          if (PRESET_METADATA[slot]) {
            modelIdx = PRESET_METADATA[slot][0];
            cat = PRESET_METADATA[slot][1];
          } else {
            const pSet = MODEL_METADATA[modelIdx] ? MODEL_METADATA[modelIdx][0] : (modelIdx % 10);
            cat = PARAM_SET_NAMES[pSet] || 'General';
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
          } else if (fileName.endsWith('.sphere')) {
            try {
              if (file.size >= 0x20) {
                const buf = await file.slice(0, 32).arrayBuffer();
                const view = new DataView(buf);
                const tag = String.fromCharCode(
                  view.getUint8(0),
                  view.getUint8(1),
                  view.getUint8(2),
                  view.getUint8(3)
                );
                if (tag === 'psAN') {
                  const pSet = view.getInt32(0x10, true);
                  const stickModes = view.getInt32(0x1c, true);
                  if (pSet >= 0 && pSet <= 9) entry.parameterSet = pSet;
                  if (stickModes >= 1 && stickModes <= 64) {
                    entry.complexity = stickModesToComplexity(stickModes);
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }

      // Sound preset folder match: .../NNN.sound/file
      for (let p = 0; p < parts.length - 1; p++) {
        const sm = /^(\d{3})\.sound$/i.exec(parts[p]);
        if (sm) {
          const slot = parseInt(sm[1], 10);
          if (!presetsMap.has(slot)) {
            presetsMap.set(slot, {
              slot,
              name: `Preset #${String(slot).padStart(3, '0')}`,
              category: 'General',
              modelIndex: 511,
              parameterCount: 445
            });
          }
          const entry = presetsMap.get(slot)!;
          const fileName = parts[parts.length - 1].toLowerCase();
          if (fileName === 'sound.script') {
            try {
              const text = await file.text();
              const parsed = parseSoundScript(text);
              if (parsed) {
                if (parsed.name) entry.name = parsed.name;
                if (typeof parsed.r1ModelIndex === 'number') entry.modelIndex = parsed.r1ModelIndex;
              }
            } catch {
              // ignore
            }
          }
        }
      }
    }

    const models = Array.from(modelsMap.values()).map((m) => {
      if ((m.parameterSet === 0 || m.parameterSet === undefined) && MODEL_METADATA[m.slot]) {
        m.parameterSet = MODEL_METADATA[m.slot][0];
        m.complexity = MODEL_METADATA[m.slot][1];
      }
      return m;
    }).sort((a, b) => a.slot - b.slot);

    const presets = Array.from(presetsMap.values()).map((p) => {
      if (PRESET_METADATA[p.slot]) {
        p.modelIndex = PRESET_METADATA[p.slot][0];
        p.category = PRESET_METADATA[p.slot][1];
      } else {
        const pSet = MODEL_METADATA[p.modelIndex] ? MODEL_METADATA[p.modelIndex][0] : (p.modelIndex % 10);
        p.category = PARAM_SET_NAMES[pSet] || 'General';
      }
      return p;
    }).sort((a, b) => a.slot - b.slot);

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
          const models: BankModelEntry[] = parsed.models.map((m: any) => {
            const meta = MODEL_METADATA[m.slot];
            const pSet = meta ? meta[0] : (m.parameterSet ?? 0);
            const comp = meta ? meta[1] : (m.complexity ?? 5);
            return {
              ...m,
              parameterSet: pSet,
              complexity: comp,
            };
          });

          const presets: BankPresetEntry[] = (Array.isArray(parsed.presets) ? parsed.presets : []).map((p: any) => {
            const pMeta = PRESET_METADATA[p.slot];
            const mIdx = pMeta ? pMeta[0] : (p.modelIndex ?? p.slot);
            const rawCat = pMeta
              ? pMeta[1]
              : (p.category && p.category !== 'Sound' && p.category !== 'General'
                  ? p.category
                  : (PARAM_SET_NAMES[mIdx % 10] || 'General'));
            return {
              ...p,
              modelIndex: mIdx,
              category: rawCat,
            };
          });

          this.currentBank = {
            folderName: parsed.folderName || 'Persisted Library',
            models,
            presets
          };
          this.persistToLocalStorage();
          this.updateCounters();
        }
      }
    } catch {
      // ignore
    }

    if (this.currentBank.models.length === 0) {
      const canonical = createCanonicalBank();
      this.currentBank = {
        folderName: canonical.folderName,
        models: canonical.models,
        presets: canonical.presets,
      };
      this.persistToLocalStorage();
      this.updateCounters();
      this.renderCategoryChips();
    }
  }

  public isOpen(): boolean {
    return this.drawerManager.getCurrentDrawerId() === 'bank';
  }

  public setPreferredResynator(r: 1 | 2): void {
    this.preferredResynator = r;
    if (this.drawerElement) {
      const btnTargetR1 = this.drawerElement.querySelector('#btn-target-r1');
      const btnTargetR2 = this.drawerElement.querySelector('#btn-target-r2');
      if (r === 1) {
        btnTargetR1?.classList.add('active');
        btnTargetR2?.classList.remove('active');
      } else {
        btnTargetR2?.classList.add('active');
        btnTargetR1?.classList.remove('active');
      }
      if (this.activeTab === 'models') {
        this.renderModels();
      }
    }
  }

  public setTab(tab: 'models' | 'presets'): void {
    if (!this.drawerElement) return;
    this.activeTab = tab;
    // Silent tab paint: the shell only notifies on user clicks (onTabChange),
    // so this cannot loop back into setTab.
    this.shell.setTab(tab);
    this.updateTargetRowUI();
    this.renderCategoryChips();
    if (tab === 'models') {
      this.renderModels();
    } else {
      this.renderPresets();
    }
  }

  public toggle(tab?: 'models' | 'presets', context?: 'r1' | 'r2' | 'global' | 1 | 2): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open(tab, context);
    }
  }

  public open(tab?: 'models' | 'presets', context?: 'r1' | 'r2' | 'global' | 1 | 2): void {
    if (!this.drawerElement) return;

    // Trigger async sync of live disk catalog from native host
    WebBridge.scanBank();

    if (context === 1 || context === 'r1') {
      this.callerContext = 'r1';
      this.preferredResynator = 1;
    } else if (context === 2 || context === 'r2') {
      this.callerContext = 'r2';
      this.preferredResynator = 2;
    } else {
      this.callerContext = 'global';
    }

    this.updateTargetRowUI();
    this.renderCategoryChips();

    if (tab) {
      this.setTab(tab);
    } else {
      if (this.activeTab === 'models') {
        this.renderModels();
      } else {
        this.renderPresets();
      }
    }

    this.drawerManager.openCustom('bank', this.drawerElement);
    this.shell.focusSearch();
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
    this.cardUnbind?.();
    this.cardUnbind = null;
    this.shell.destroy();
    this.drawerElement = null;
  }
}
