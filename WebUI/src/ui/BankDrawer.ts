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
  PRESET_R2_MODELS,
  createCanonicalBank,
} from './NeuronCatalogMetadata.js';
import {
  evaluateNeuronDb,
  filterActiveModels,
  parseMName,
  parseMapScript,
  parseModelNamesCache,
  parseSoundScript,
  type NeuronDbEvaluation,
} from '@abdsynths/shared/formats/neuron';
import { createBankShell } from '@abdsynths/shared/components/bank/bankShell.js';
import { bankCardHtml, bindBankCards } from '@abdsynths/shared/components/bank/bankCard.js';
import { bankChipsHtml, bindBankChips, type BankChipItem } from '@abdsynths/shared/components/bank/bankChips.js';
import {
  type AxionikDbModelEntry,
  mapAxionikCategoryToParameterSet,
} from '@abdsynths/shared/contracts/axionikExpandedModel';
import { getPresetCategoryInfo } from './presetCategories.js';
import { t, onLocaleChange } from '../i18n/index.js';

export { getPresetCategoryInfo, type AxionikDbModelEntry };

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
  r2ModelIndex?: number;
  r1Switch?: boolean;
  r2Switch?: boolean;
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
  onSelectExpandedModel?: (entry: AxionikDbModelEntry, resynator: 1 | 2) => void;
  onSelectPreset: (slot: number, name: string) => void;
  onConfigureNeuronDbFolder?: () => void;
  onConfigureAxionikDbFolder?: () => void;
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

const STORAGE_FOLDER_KEY = 'abdsynths_axionik_neurondb_folder';
const STORAGE_BANK_KEY = 'abdsynths_axionik_neurondb_bank';
const STORAGE_AXIONIK_FOLDER_KEY = 'abdsynths_axionik_axionikdb_folder';
const STORAGE_AXIONIK_BANK_KEY = 'abdsynths_axionik_axionikdb_bank';

export class BankDrawer {
  private drawerManager: DrawerManager;
  private handlers: BankDrawerHandlers;
  private drawerElement: HTMLElement | null = null;
  private shell!: ReturnType<typeof createBankShell>;
  private cardUnbind: (() => void) | null = null;
  private chipsUnbind: (() => void) | null = null;
  private currentBank: BankSummary = { folderName: 'Default Library', models: [], presets: [] };
  private axionikFolderName: string = 'AxionikDB';
  private axionikModels: AxionikDbModelEntry[] = [];
  private engineMode: 'classic' | 'plus' | 'expanded' = 'expanded';
  private dbEvaluation: NeuronDbEvaluation | null = null;
  private activeTab: 'axionik' | 'models' | 'presets' = 'axionik';
  private preferredResynator: 1 | 2 = 1;
  private callerContext: 'r1' | 'r2' | 'global' = 'global';
  private selectedCategory: number | 'all' = 'all';
  private selectedPresetCategory: string = 'all';
  private filterQuery: string = '';
  private unsubLocale: (() => void) | null = null;

  constructor(drawerManager: DrawerManager, handlers: BankDrawerHandlers) {
    this.drawerManager = drawerManager;
    this.handlers = handlers;
    this.init();
    this.restoreFromLocalStorage();

    this.unsubLocale = onLocaleChange(() => {
      this.refreshI18n();
    });
  }

  private init(): void {
    this.shell = createBankShell({
      title: t('bank.drawerTitle'),
      badge: t('bank.itemsCount', { count: 0 }),
      tabs: [
        { id: 'axionik', label: 'AXIONIKDB (V2)', iconHtml: ICONS.database },
        { id: 'models', label: t('bank.modelsTab'), iconHtml: ICONS.database },
        { id: 'presets', label: t('bank.presetsTab'), iconHtml: ICONS.sliders },
      ],
      activeTab: this.activeTab,
      searchPlaceholder: t('bank.searchPlaceholder'),
      headerActions: [
        { id: 'refresh', label: t('bank.refreshBtn'), title: t('bank.refreshTitle'), iconHtml: ICONS.refresh },
        { id: 'folder', label: t('bank.folderBtn'), title: t('bank.folderTitle'), iconHtml: ICONS.folder },
        { id: 'close', label: t('bank.closeBtn'), title: t('bank.closeTitle'), iconHtml: ICONS.close },
      ],
      // No footer actions: the header already serves Refresh/Folder/Close.
      // The footer keeps the slot + status line (folder summary, refresh
      // record, selection) with no duplicated buttons.
      onTabChange: (tab) => {
        this.setTab(tab as 'axionik' | 'models' | 'presets');
      },
      onSearch: (query) => {
        this.filterQuery = query;
        this.renderActiveTab();
      },
      onHeaderAction: (action) => {
        if (action === 'refresh') {
          this.refreshBank();
        } else if (action === 'folder') {
          this.promptConfigureFolder();
        }
      },
      onFooterAction: (action) => {
        if (action === 'refresh') {
          this.refreshBank();
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
    // Keep the historical footer id and inline layout (the shell owns the
    // skeleton: slot + status + declarative actions).
    this.shell.footerEl.id = 'bank-footer';
    this.shell.footerEl.setAttribute(
      'style',
      'padding: var(--space-2) var(--space-3); border-top: 1px solid var(--color-panel-border-dim); display: flex; justify-content: space-between; align-items: center; background: var(--color-panel-surface);'
    );
    // Historical status text metrics (shared class is larger).
    this.shell.footerEl
      .querySelector('[data-shell-foot-status]')
      ?.setAttribute('style', 'font-size: var(--text-xs); color: var(--color-text-dim);');
    this.shell.setFootSlot('LIBRARY:');
    this.shell.setFooterStatus('No folder configured');
    this.shell.setTabVisible('axionik', this.engineMode === 'expanded');
    this.renderToolbar();
  }

  private renderActiveTab(): void {
    if (this.activeTab === 'axionik') {
      this.renderAxionikModels();
    } else if (this.activeTab === 'models') {
      this.renderModels();
    } else {
      this.renderPresets();
    }
  }

  private renderToolbar(): void {
    if (!this.drawerElement) return;
    this.shell.toolbarEl.innerHTML = `
      <!-- Category Filter Chips Row (Parity with ABDNeuModMakr) -->
      <div class="ndb-chips-row ndb-cat-chips-row" id="ndb-cat-chips-row" style="display: flex; flex-wrap: wrap; gap: 4px; padding: 4px var(--space-3); background: var(--color-panel-surface); border-bottom: 1px solid var(--color-panel-border-dim);">
        <!-- Category chips dynamically injected via renderCategoryChips -->
      </div>

      <!-- Target Resynator Selector (visible on Models / AxionikDB tabs) -->
      <div id="ndb-target-resynator-row" style="display: ${this.activeTab !== 'presets' ? 'flex' : 'none'}; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background: var(--color-panel-surface); border-bottom: 1px solid var(--color-panel-border-dim);">
        <span class="hud-label" id="ndb-target-label" style="font-size: 10px; font-weight: 700; color: var(--color-text-muted);">ASSIGN TARGET:</span>
        <div class="abd-pill-group" id="ndb-target-chips" style="gap: var(--space-2); margin: 0; padding: 0;">
          <button type="button" class="abd-pill abd-pill--sm ${this.preferredResynator === 1 ? 'active' : ''}" id="btn-target-r1">
            Resynator 1 (R1)
          </button>
          <button type="button" class="abd-pill abd-pill--sm ${this.preferredResynator === 2 ? 'active' : ''}" id="btn-target-r2">
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

  private evaluateCurrentBank(): void {
    this.currentBank.models = filterActiveModels(this.currentBank.models).map((m) => {
      const meta = MODEL_METADATA[m.slot];
      return {
        ...m,
        parameterSet: meta ? meta[0] : (m.parameterSet ?? (m.slot % 10)),
        complexity: meta ? meta[1] : (m.complexity ?? 5),
      };
    });

    this.currentBank.presets = this.currentBank.presets.map((p) => {
      const pMeta = PRESET_METADATA[p.slot];
      const mIdx = p.modelIndex ?? (pMeta ? pMeta[0] : p.slot);
      const r2Idx = p.r2ModelIndex ?? PRESET_R2_MODELS[p.slot] ?? 511;
      const rawCat =
        p.category && p.category !== 'General' && p.category !== 'Sound'
          ? p.category
          : pMeta
            ? pMeta[1]
            : (PARAM_SET_NAMES[mIdx % 10] || 'General');
      return {
        ...p,
        modelIndex: mIdx,
        r2ModelIndex: r2Idx,
        category: rawCat,
      };
    });

    this.dbEvaluation = evaluateNeuronDb(this.currentBank.models, this.currentBank.presets);
  }

  public setBank(bank: BankSummary): void {
    this.currentBank = bank;
    this.evaluateCurrentBank();
    this.persistToLocalStorage();
    this.updateCounters();
    this.renderCategoryChips();
    this.renderActiveTab();
  }

  public syncCatalogFromHost(data: {
    folderName?: string;
    models?: BankModelEntry[];
    presets?: BankPresetEntry[];
    axionikFolderName?: string;
    axionikModels?: AxionikDbModelEntry[];
  }): void {
    if (!data) return;

    if (Array.isArray(data.axionikModels)) {
      this.axionikFolderName = data.axionikFolderName || 'AxionikDB';
      this.axionikModels = data.axionikModels.map((m) => ({
        ...m,
        parameterSet: m.parameterSet ?? mapAxionikCategoryToParameterSet(m.category || ''),
      }));
    }

    if (Array.isArray(data.models) && Array.isArray(data.presets) && (data.models.length > 0 || data.presets.length > 0)) {
      this.currentBank = {
        folderName: data.folderName || 'NeuronDB (Disk Sync)',
        models: data.models,
        presets: data.presets,
      };
      this.evaluateCurrentBank();
    }

    this.persistToLocalStorage();
    this.updateCounters();
    this.renderCategoryChips();
    this.renderActiveTab();
  }

  public setEngineMode(mode: 'classic' | 'plus' | 'expanded'): void {
    this.engineMode = mode;
    if (!this.drawerElement) return;
    const isExpanded = mode === 'expanded';
    this.shell.setTabVisible('axionik', isExpanded);
    if (!isExpanded && this.activeTab === 'axionik') {
      this.activeTab = 'models';
      this.shell.setTab('models');
    } else if (isExpanded && this.activeTab === 'models' && this.axionikModels.length > 0) {
      this.activeTab = 'axionik';
      this.shell.setTab('axionik');
    }
    this.updateCounters();
    this.updateTargetRowUI();
    this.renderCategoryChips();
    this.renderActiveTab();
  }

  public getEngineMode(): 'classic' | 'plus' | 'expanded' {
    return this.engineMode;
  }

  public getAxionikModels(): AxionikDbModelEntry[] {
    return this.axionikModels;
  }

  public setAxionikBank(folderName: string, models: AxionikDbModelEntry[]): void {
    this.axionikFolderName = folderName;
    this.axionikModels = models;
    this.persistToLocalStorage();
    this.updateCounters();
    this.renderCategoryChips();
    this.renderActiveTab();
  }

  public getBank(): BankSummary {
    return this.currentBank;
  }

  /**
   * User-facing refresh: guarantees visible feedback on every click.
   * Shows a working state first, then the timestamped confirmation from
   * refreshLibrary(), or an error message if anything throws — so a
   * silent no-op is impossible unless the click never reaches the drawer.
   */
  public refreshBank(): void {
    this.shell.setFooterStatus('Refreshing library…');
    this.shell.flashStatus('Refreshing library…', 'working');
    this.shell.setBusy('refresh', true);
    // Let the working state paint before the synchronous reindex runs.
    window.setTimeout(() => {
      try {
        WebBridge.scanBank();
        this.refreshLibrary();
        // refreshLibrary() leaves the timestamped confirmation in the
        // footer; the flash is the unmissable counterpart for fast runs.
        const mCount = this.currentBank.models.length;
        const pCount = this.currentBank.presets.length;
        this.shell.flashStatus(`Library refreshed · ${mCount} models, ${pCount} presets`, 'ok');
      } catch (err) {
        console.error('[BankDrawer] Refresh failed:', err);
        const message = `Refresh failed: ${err instanceof Error ? err.message : String(err)}`;
        this.shell.setFooterStatus(message);
        this.shell.flashStatus(message, 'error');
      } finally {
        this.shell.setBusy('refresh', false);
      }
    }, 60);
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
      const r2Idx = p.r2ModelIndex ?? PRESET_R2_MODELS[p.slot] ?? 511;
      const rawCat = pMeta
        ? pMeta[1]
        : (p.category && p.category !== 'Sound' && p.category !== 'General'
            ? p.category
            : (PARAM_SET_NAMES[mIdx % 10] || 'General'));
      return {
        ...p,
        modelIndex: mIdx,
        r2ModelIndex: r2Idx,
        category: rawCat,
      };
    });

    this.currentBank.models = models;
    this.currentBank.presets = presets;
    this.evaluateCurrentBank();
    this.persistToLocalStorage();
    this.updateCounters();
    this.renderCategoryChips();
    this.renderActiveTab();

    // Persistent confirmation with timestamp: refreshing with identical data
    // changes no counters, so the time proves the click did something.
    // The message stays until the next bank update restores the summary.
    const time = new Date().toLocaleTimeString();
    const inUse = this.dbEvaluation?.inUseModelCount ?? this.currentBank.models.length;
    this.shell.setFooterStatus(
      `Library refreshed & re-indexed (${this.currentBank.models.length} models · ${inUse} in use, ${this.currentBank.presets.length} presets) · ${time}`
    );
  }

  private updateCounters(): void {
    if (!this.drawerElement) return;
    const axCount = this.axionikModels.length;
    const mCount = this.currentBank.models.length;
    const pCount = this.currentBank.presets.length;
    const inUse = this.dbEvaluation?.inUseModelCount;

    this.shell.setTabCount('axionik', axCount);
    this.shell.setTabCount('models', mCount);
    this.shell.setTabCount('presets', pCount);

    if (this.activeTab === 'axionik') {
      this.shell.setFootSlot('AXIONIKDB:');
      this.shell.setFooterStatus(`${this.axionikFolderName} (${axCount} Expanded v2 models · ${mCount} Classic v1 models, ${pCount} presets)`);
    } else {
      this.shell.setFootSlot('NEURONDB:');
      const inUseSummary = typeof inUse === 'number' ? ` · ${inUse} in use` : '';
      this.shell.setFooterStatus(`${this.currentBank.folderName} (${mCount} Classic v1 models${inUseSummary}, ${pCount} presets)`);
    }
  }

  private updateTargetRowUI(): void {
    if (!this.drawerElement) return;
    const targetRow = this.drawerElement.querySelector('#ndb-target-resynator-row') as HTMLElement | null;
    const label = this.drawerElement.querySelector('#ndb-target-label');
    const btnR1 = this.drawerElement.querySelector('#btn-target-r1');
    const btnR2 = this.drawerElement.querySelector('#btn-target-r2');

    if (!targetRow) return;
    if (this.activeTab === 'presets') {
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

    // The row only serves the pick; filtering stays host logic (same as cards).
    this.chipsUnbind?.();
    this.chipsUnbind = null;

    if (this.activeTab === 'presets') {
      const catCounts: Record<string, number> = {};
      for (const p of this.currentBank.presets) {
        const c = p.category || 'General';
        catCounts[c] = (catCounts[c] || 0) + 1;
      }
      const items: BankChipItem[] = [
        { id: 'all', label: 'All', count: this.currentBank.presets.length },
        ...Object.keys(catCounts)
          .sort()
          .map((cat) => ({
            id: cat,
            label: cat,
            count: catCounts[cat],
            catClass: getPresetCategoryInfo(cat).catClass,
          })),
      ];
      container.innerHTML = bankChipsHtml(items, this.selectedPresetCategory);
      this.chipsUnbind = bindBankChips(container, (id) => {
        this.selectedPresetCategory = id;
        this.renderCategoryChips();
        this.renderPresets();
      });
      return;
    }

    // Compute live counts per parameterSet (0..9) for whichever model tab is active
    const activeModelList = this.activeTab === 'axionik' ? this.axionikModels : this.currentBank.models;
    const counts: Record<number, number> = {};
    for (const m of activeModelList) {
      counts[m.parameterSet] = (counts[m.parameterSet] || 0) + 1;
    }

    const items: BankChipItem[] = [{ id: 'all', label: 'All', count: activeModelList.length }];
    // All ten sets always: same pill row whatever the folder contains.
    for (let i = 0; i <= 9; i++) {
      const count = counts[i] || 0;
      const ps = PARAMETER_SETS[i];
      const catName = ps ? ps.name : `Set ${i}`;
      items.push({
        id: String(i),
        label: ps ? ps.category : catName,
        count,
        catClass: `cat-${i}`,
        title: catName,
        prefixHtml: `<span class="cat-${i}" style="font-weight: 700;">${i}:</span> `,
      });
    }

    const activeId = this.selectedCategory === 'all' ? 'all' : String(this.selectedCategory);
    container.innerHTML = bankChipsHtml(items, activeId);
    this.chipsUnbind = bindBankChips(container, (id) => {
      this.selectedCategory = id === 'all' ? 'all' : parseInt(id || '0', 10);
      this.renderCategoryChips();
      this.renderActiveTab();
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
        <div class="ndb-choice-modal-desc">${t('bank.loadModelR1')} / ${t('bank.loadModelR2')}:</div>
        <div class="ndb-choice-modal-actions">
          <button type="button" class="btn btn-sm btn-primary" id="btn-modal-choose-r1">
            → ${t('bank.loadModelR1')}
          </button>
          <button type="button" class="btn btn-sm btn-secondary" id="btn-modal-choose-r2">
            → ${t('bank.loadModelR2')}
          </button>
        </div>
        <div class="ndb-choice-modal-footer">
          <button type="button" class="btn btn-xs btn-outline" id="btn-modal-choose-cancel">${t('common.cancel')}</button>
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

  private handleExpandedModelLoadRequest(entry: AxionikDbModelEntry): void {
    if (this.callerContext === 'r1') {
      this.handlers.onSelectExpandedModel?.(entry, 1);
      this.close();
      return;
    }
    if (this.callerContext === 'r2') {
      this.handlers.onSelectExpandedModel?.(entry, 2);
      this.close();
      return;
    }
    this.handlers.onSelectExpandedModel?.(entry, this.preferredResynator);
    this.close();
  }

  private renderAxionikModels(): void {
    if (!this.drawerElement) return;
    const container = this.shell.contentEl;
    const totalModels = this.axionikModels.length;

    if (totalModels === 0) {
      this.shell.setBadge('0 IN AXIONIKDB');
      container.innerHTML = `
        <div class="neurondb-empty-state" style="text-align: center; padding: var(--space-6); color: var(--color-text-dim);">
          <div style="font-size: 28px; margin-bottom: var(--space-2);">${ICONS.database}</div>
          <div style="font-weight: 700; color: var(--color-text-main); margin-bottom: var(--space-1);">No models loaded in AxionikDB (Resynator v2)</div>
          <div style="font-size: var(--text-xs); margin-bottom: var(--space-4);">Select your AxionikDB folder (or export models from ABDNeuModMakr into AxionikDB/) to browse Expanded v2 models.</div>
          <button type="button" class="btn btn-sm btn-primary" id="btn-empty-configure-axionik">
            ${ICONS.folder} Configure AxionikDB Folder...
          </button>
        </div>
      `;
      container.querySelector('#btn-empty-configure-axionik')?.addEventListener('click', () => this.promptConfigureFolder('axionik'));
      return;
    }

    let filtered = this.axionikModels;
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter((m) => m.parameterSet === this.selectedCategory);
    }
    if (this.filterQuery) {
      const q = this.filterQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(q) ||
          (m.slug || '').toLowerCase().includes(q) ||
          (m.category || '').toLowerCase().includes(q) ||
          (m.sublibrary || '').toLowerCase().includes(q)
      );
    }

    this.shell.setBadge(
      filtered.length === totalModels
        ? `${totalModels} IN AXIONIKDB`
        : `${filtered.length} / ${totalModels} IN AXIONIKDB`
    );

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="neurondb-empty-state" style="text-align: center; padding: var(--space-6); color: var(--color-text-dim);">
          <span class="empty-icon">${ICONS.database}</span>
          <span class="empty-msg">No AxionikDB v2 models matching filter</span>
        </div>
      `;
      return;
    }

    const btnLabel =
      this.callerContext === 'r1'
        ? t('bank.loadModelR1')
        : this.callerContext === 'r2'
        ? t('bank.loadModelR2')
        : t('common.load');

    const grid = document.createElement('div');
    grid.className = 'ndb-grid';
    grid.innerHTML = filtered
      .map((m, idx) => {
        const catClass = `cat-${(m.parameterSet ?? 0) % 10}`;
        const iconKey = `param${(m.parameterSet ?? 0) % 10}` as keyof typeof ICONS;
        const subLabel = m.sublibrary || 'Default';
        return bankCardHtml({
          slot: idx,
          catClass,
          catLabel: m.category || 'Expanded v2',
          name: m.name,
          iconHtml: ICONS[iconKey] || ICONS.database,
          badges: [
            subLabel,
            `${m.zoneCount || 1} Zones`,
            m.hasExpandedV2 !== false ? 'RESYNATOR V2' : 'NMMODEL V1',
          ],
          actions: [{ id: 'load', label: btnLabel }],
        });
      })
      .join('');
    container.innerHTML = '';
    container.appendChild(grid);

    this.cardUnbind?.();
    this.cardUnbind = bindBankCards(grid, {
      onCardClick: (idx) => {
        const entry = filtered[idx];
        if (entry) this.handleExpandedModelLoadRequest(entry);
      },
      onAction: ({ slot: idx }) => {
        const entry = filtered[idx];
        if (entry) this.handleExpandedModelLoadRequest(entry);
      },
    });
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
      container.querySelector('#btn-empty-configure')?.addEventListener('click', () => this.promptConfigureFolder('neuron'));
      return;
    }

    let filtered = this.currentBank.models;
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter((m) => m.parameterSet === this.selectedCategory);
    }
    if (this.filterQuery) {
      const q = this.filterQuery.toLowerCase().trim();
      filtered = filtered.filter((m) => {
        const dep = this.dbEvaluation?.modelDependencies.get(m.slot);
        const usageTag = dep ? dep.usageStatus : '';
        return (
          m.name.toLowerCase().includes(q) ||
          String(m.slot).includes(q) ||
          `#${String(m.slot).padStart(3, '0')}`.includes(q) ||
          (PARAM_SET_NAMES[m.parameterSet]?.toLowerCase().includes(q) ?? false) ||
          (q === 'unused' && usageTag === 'unused') ||
          ((q === 'in-use' || q === 'used') && usageTag !== 'unused')
        );
      });
    }

    this.shell.setBadge(
      filtered.length === totalModels
        ? `${totalModels} MODELS`
        : `${filtered.length} / ${totalModels} MODELS`
    );

    if (filtered.length === 0) {
      const emptyMsg = this.filterQuery
        ? `No models found matching "${this.filterQuery}"`
        : 'No models in this category yet';
      container.innerHTML = `
        <div class="neurondb-empty-state" style="text-align: center; padding: var(--space-6); color: var(--color-text-dim);">
          <span class="empty-icon">${ICONS.database}</span>
          <span class="empty-msg">${emptyMsg}</span>
        </div>
      `;
      return;
    }

    const btnLabel =
      this.callerContext === 'r1'
        ? t('bank.loadModelR1')
        : this.callerContext === 'r2'
        ? t('bank.loadModelR2')
        : t('common.load');

    const grid = document.createElement('div');
    grid.className = 'ndb-grid';
    grid.innerHTML = filtered
      .map((m) => {
        const setName = PARAM_SET_NAMES[m.parameterSet] || `Set ${m.parameterSet}`;
        const catClass = `cat-${m.parameterSet % 10}`;
        const iconKey = `param${m.parameterSet % 10}` as keyof typeof ICONS;
        const dep = this.dbEvaluation?.modelDependencies.get(m.slot);
        const usedCount = dep ? dep.usedByPresetSlots.length : 0;
        const usageBadge =
          usedCount > 0
            ? `${usedCount} Sound${usedCount === 1 ? '' : 's'}`
            : 'Unused';
        return bankCardHtml({
          slot: m.slot,
          catClass,
          catLabel: setName,
          name: m.name,
          iconHtml: ICONS[iconKey] || ICONS.database,
          badges: [
            `${m.zoneCount} Zone${m.zoneCount === 1 ? '' : 's'}`,
            `Lvl ${m.complexity}`,
            usageBadge,
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
      ? catFiltered.filter((p) => {
          const q = this.filterQuery.toLowerCase().trim();
          const dep = this.dbEvaluation?.presetDependencies.get(p.slot);
          const r2Slot = p.r2ModelIndex ?? PRESET_R2_MODELS[p.slot] ?? 511;
          return (
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            String(p.slot).includes(q) ||
            `#${String(p.slot).padStart(3, '0')}`.includes(q) ||
            String(p.modelIndex).includes(q) ||
            `#${String(p.modelIndex).padStart(3, '0')}`.includes(q) ||
            String(r2Slot).includes(q) ||
            `#${String(r2Slot).padStart(3, '0')}`.includes(q) ||
            (dep?.r1ModelName.toLowerCase().includes(q) ?? false) ||
            (dep?.r2ModelName.toLowerCase().includes(q) ?? false)
          );
        })
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
        const dep = this.dbEvaluation?.presetDependencies.get(p.slot);
        const r1SlotStr = `#${String(p.modelIndex).padStart(3, '0')}`;
        const r2Slot = p.r2ModelIndex ?? PRESET_R2_MODELS[p.slot] ?? 511;
        const r2SlotStr = `#${String(r2Slot).padStart(3, '0')}`;
        const r1Label = dep ? `R1: ${r1SlotStr} ${dep.r1ModelName}` : `R1: ${r1SlotStr}`;
        const r2Label = dep ? `R2: ${r2SlotStr} ${dep.r2ModelName}` : `R2: ${r2SlotStr}`;
        return bankCardHtml({
          slot: p.slot,
          catClass: catInfo.catClass,
          catLabel: p.category || 'Preset',
          name: p.name,
          iconHtml: catInfo.icon,
          badges: [r1Label, r2Label],
          actions: [
            { id: 'load-preset', label: t('bank.loadPreset'), title: `${t('bank.loadPreset')} #${p.slot}` },
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

  public promptConfigureFolder(targetBank?: 'neuron' | 'axionik'): void {
    const bankKind = targetBank ?? (this.activeTab === 'axionik' ? 'axionik' : 'neuron');
    const win = window as Window & {
      showDirectoryPicker?: (opts?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle>;
    };

    if (typeof win.showDirectoryPicker === 'function') {
      void (async () => {
        try {
          const dirHandle = await win.showDirectoryPicker!({ mode: 'read' });
          if (bankKind === 'axionik') {
            await this.scanAxionikDirectoryHandle(dirHandle);
          } else {
            await this.scanDirectoryHandle(dirHandle);
          }
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
        if (bankKind === 'axionik') {
          await this.scanAxionikFileList(fileList);
        } else {
          await this.scanFileList(fileList);
        }
      }
      fileInput.remove();
    });
    fileInput.click();
  }

  private async scanAxionikDirectoryHandle(rootHandle: FileSystemDirectoryHandle): Promise<void> {
    type IterDir = FileSystemDirectoryHandle & {
      values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
    };

    const foundModels: AxionikDbModelEntry[] = [];
    let ord = 1;

    const inspectCapsuleDir = async (dir: FileSystemDirectoryHandle, sublib: string) => {
      let manifestObj: any = null;
      let expandedJsonText = '';
      let hasV2 = false;
      let hasCover = false;

      for await (const entry of (dir as IterDir).values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase() === 'manifest.json') {
          try {
            const f = await (entry as FileSystemFileHandle).getFile();
            manifestObj = JSON.parse(await f.text());
          } catch {
            // ignore
          }
        } else if (entry.kind === 'directory' && entry.name.toLowerCase() === '05_extended_model') {
          for await (const extEntry of (entry as IterDir).values()) {
            if (extEntry.kind === 'file') {
              const lower = extEntry.name.toLowerCase();
              if (lower === 'axionik-expanded.json') {
                const f = await (extEntry as FileSystemFileHandle).getFile();
                expandedJsonText = await f.text();
                hasV2 = true;
              } else if (lower === 'model.nmmodel' && !expandedJsonText) {
                const f = await (extEntry as FileSystemFileHandle).getFile();
                expandedJsonText = await f.text();
              } else if (lower === 'cover.webp') {
                hasCover = true;
              }
            }
          }
        }
      }

      if (!manifestObj && !expandedJsonText) return;
      const cfg = manifestObj?.processConfig ?? {};
      const cat = cfg.category || manifestObj?.category || 'Synth & Neutral';
      const pSet = typeof cfg.parameterSet === 'number' ? cfg.parameterSet : mapAxionikCategoryToParameterSet(cat);
      foundModels.push({
        slug: dir.name,
        name: manifestObj?.modelName || cfg.modelName || dir.name,
        category: cat,
        parameterSet: pSet,
        zoneCount: Array.isArray(manifestObj?.zones) ? manifestObj.zones.length : 1,
        complexity: cfg.complexity ?? 8,
        hasCover,
        folderPath: dir.name,
        sublibrary: cfg.sublibrary || sublib,
        sublibraryOrdinal: cfg.sublibraryOrdinal ?? ord++,
        hasExpandedV2: hasV2,
        expandedJson: expandedJsonText || undefined,
      });
    };

    for await (const entry of (rootHandle as IterDir).values()) {
      if (entry.kind !== 'directory' || entry.name.startsWith('.')) continue;
      const dir = entry as FileSystemDirectoryHandle;
      if (dir.name.toLowerCase() === 'models') {
        for await (const sub of (dir as IterDir).values()) {
          if (sub.kind === 'directory') await inspectCapsuleDir(sub as FileSystemDirectoryHandle, 'Default');
        }
      } else if (dir.name.toLowerCase() === 'banks') {
        for await (const bankSub of (dir as IterDir).values()) {
          if (bankSub.kind !== 'directory') continue;
          for await (const mDir of (bankSub as IterDir).values()) {
            if (mDir.kind === 'directory') await inspectCapsuleDir(mDir as FileSystemDirectoryHandle, bankSub.name);
          }
        }
      } else {
        await inspectCapsuleDir(dir, 'Default');
      }
    }

    this.setAxionikBank(rootHandle.name, foundModels);
    this.open();
  }

  private async scanAxionikFileList(fileList: FileList): Promise<void> {
    const capsuleMap = new Map<string, { slug: string; sublib: string; manifest?: any; expandedJson?: string; hasV2?: boolean; hasCover?: boolean }>();

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split(/[/\\]/);
      const fileName = parts[parts.length - 1].toLowerCase();

      if (fileName === 'manifest.json' && parts.length >= 2) {
        const slug = parts[parts.length - 2];
        const rec = capsuleMap.get(slug) ?? { slug, sublib: 'Default' };
        try {
          rec.manifest = JSON.parse(await file.text());
        } catch {
          // ignore
        }
        capsuleMap.set(slug, rec);
      } else if ((fileName === 'axionik-expanded.json' || fileName === 'model.nmmodel') && parts.length >= 3 && parts[parts.length - 2].toLowerCase() === '05_extended_model') {
        const slug = parts[parts.length - 3];
        const rec = capsuleMap.get(slug) ?? { slug, sublib: 'Default' };
        if (fileName === 'axionik-expanded.json' || !rec.expandedJson) {
          rec.expandedJson = await file.text();
          if (fileName === 'axionik-expanded.json') rec.hasV2 = true;
        }
        capsuleMap.set(slug, rec);
      } else if (fileName === 'cover.webp' && parts.length >= 3 && parts[parts.length - 2].toLowerCase() === '05_extended_model') {
        const slug = parts[parts.length - 3];
        const rec = capsuleMap.get(slug) ?? { slug, sublib: 'Default' };
        rec.hasCover = true;
        capsuleMap.set(slug, rec);
      }
    }

    let ord = 1;
    const foundModels: AxionikDbModelEntry[] = [];
    for (const rec of capsuleMap.values()) {
      const cfg = rec.manifest?.processConfig ?? {};
      const cat = cfg.category || rec.manifest?.category || 'Synth & Neutral';
      const pSet = typeof cfg.parameterSet === 'number' ? cfg.parameterSet : mapAxionikCategoryToParameterSet(cat);
      foundModels.push({
        slug: rec.slug,
        name: rec.manifest?.modelName || cfg.modelName || rec.slug,
        category: cat,
        parameterSet: pSet,
        zoneCount: Array.isArray(rec.manifest?.zones) ? rec.manifest.zones.length : 1,
        complexity: cfg.complexity ?? 8,
        hasCover: Boolean(rec.hasCover),
        folderPath: rec.slug,
        sublibrary: cfg.sublibrary || rec.sublib,
        sublibraryOrdinal: cfg.sublibraryOrdinal ?? ord++,
        hasExpandedV2: Boolean(rec.hasV2),
        expandedJson: rec.expandedJson,
      });
    }

    const folderName = fileList[0]?.webkitRelativePath?.split(/[/\\]/)[0] || 'AxionikDB';
    this.setAxionikBank(folderName, foundModels);
    this.open();
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
          let r2ModelIdx = PRESET_R2_MODELS[slot] ?? 511;
          let r1Switch = true;
          let r2Switch = true;

          try {
            for await (const sf of (entry as IterDir).values()) {
              if (sf.kind === 'file' && sf.name.toLowerCase() === 'sound.script') {
                const f = await (sf as FileSystemFileHandle).getFile();
                const text = await f.text();
                const parsed = parseSoundScript(text);
                if (parsed.name) soundName = parsed.name;
                if (parsed.r1ModelIndex !== undefined) modelIdx = parsed.r1ModelIndex;
                if (parsed.r2ModelIndex !== undefined) r2ModelIdx = parsed.r2ModelIndex;
                r1Switch = parsed.r1Switch;
                r2Switch = parsed.r2Switch;
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
            r2ModelIndex: r2ModelIdx,
            r1Switch,
            r2Switch,
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
                if (typeof parsed.r2ModelIndex === 'number') entry.r2ModelIndex = parsed.r2ModelIndex;
                entry.r1Switch = parsed.r1Switch;
                entry.r2Switch = parsed.r2Switch;
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
          r2ModelIndex: p.r2ModelIndex,
          parameterCount: p.parameterCount
        }))
      };
      localStorage.setItem(STORAGE_BANK_KEY, JSON.stringify(lightBank));
      localStorage.setItem(STORAGE_AXIONIK_FOLDER_KEY, this.axionikFolderName);
      localStorage.setItem(
        STORAGE_AXIONIK_BANK_KEY,
        JSON.stringify({
          folderName: this.axionikFolderName,
          models: this.axionikModels,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }

  private restoreFromLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const rawAxionik = localStorage.getItem(STORAGE_AXIONIK_BANK_KEY);
      if (rawAxionik) {
        const parsedAx = JSON.parse(rawAxionik);
        if (parsedAx && Array.isArray(parsedAx.models)) {
          this.axionikFolderName = parsedAx.folderName || 'AxionikDB';
          this.axionikModels = parsedAx.models;
        }
      }
      const rawBank = localStorage.getItem(STORAGE_BANK_KEY);
      if (rawBank) {
        const parsed = JSON.parse(rawBank);
        if (parsed && Array.isArray(parsed.models)) {
          this.currentBank = {
            folderName: parsed.folderName || 'Persisted Library',
            models: parsed.models,
            presets: Array.isArray(parsed.presets) ? parsed.presets : [],
          };
          this.evaluateCurrentBank();
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
      this.evaluateCurrentBank();
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
      if (this.activeTab !== 'presets') {
        this.renderActiveTab();
      }
    }
  }

  public setTab(tab: 'axionik' | 'models' | 'presets'): void {
    if (!this.drawerElement) return;
    if (tab === 'axionik' && this.engineMode !== 'expanded') {
      tab = 'models';
    }
    this.activeTab = tab;
    // Silent tab paint: the shell only notifies on user clicks (onTabChange),
    // so this cannot loop back into setTab.
    this.shell.setTab(tab);
    this.updateCounters();
    this.updateTargetRowUI();
    this.renderCategoryChips();
    this.renderActiveTab();
  }

  public toggle(tab?: 'axionik' | 'models' | 'presets', context?: 'r1' | 'r2' | 'global' | 1 | 2): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open(tab, context);
    }
  }

  public open(tab?: 'axionik' | 'models' | 'presets', context?: 'r1' | 'r2' | 'global' | 1 | 2): void {
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
      // In expanded mode, if a caller asks to open 'models' (generic model picker) and the user was on 'axionik', keep 'axionik'
      const effectiveTab =
        tab === 'models' && this.engineMode === 'expanded' && this.activeTab === 'axionik'
          ? 'axionik'
          : tab;
      this.setTab(effectiveTab);
    } else {
      this.renderActiveTab();
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
    if (this.unsubLocale) {
      this.unsubLocale();
      this.unsubLocale = null;
    }
    if (this.drawerManager.getCurrentDrawerId() === 'bank') {
      this.drawerManager.close();
    }
    this.cardUnbind?.();
    this.cardUnbind = null;
    this.shell.destroy();
    this.drawerElement = null;
  }

  public refreshI18n(): void {
    if (!this.drawerElement) return;

    this.shell.setTitle(t('bank.drawerTitle'));
    this.shell.setSearchPlaceholder(t('bank.searchPlaceholder'));
    this.shell.setTabLabels({
      axionik: 'AXIONIKDB (V2)',
      models: t('bank.modelsTab'),
      presets: t('bank.presetsTab'),
    });
    this.shell.setHeaderActionTitle('refresh', t('bank.refreshTitle'));
    this.shell.setHeaderActionTitle('folder', t('bank.folderTitle'));
    this.shell.setHeaderActionTitle('close', t('bank.closeTitle'));

    this.renderCategoryChips();
    this.updateTargetRowUI();
    this.renderActiveTab();
  }
}
