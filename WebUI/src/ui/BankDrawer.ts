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
import type { AxionikDbModelEntry } from '@abdsynths/shared/contracts/axionikExpandedModel';
import {
  PARAM_SET_NAMES,
  PARAMETER_SETS,
  resolveAxionikParameterSet,
} from './AxionikParameterSet.js';
import { getPresetCategoryInfo } from './presetCategories.js';
import { t, onLocaleChange } from '../i18n/index.js';
import { parsePresetFile, type AxionikPreset } from './PresetModel.js';

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
  onSelectAxionikPreset?: (preset: AxionikPreset) => void;
  onConfigureNeuronDbFolder?: () => void;
  onConfigureAxionikDbFolder?: () => void;
  onClearModels?: () => void;
}

export { PARAM_SET_NAMES, PARAMETER_SETS };

const STICK_TABLE = [4, 8, 8, 12, 16, 20, 32, 32, 48, 64];

export function stickModesToComplexity(modes: number): number {
  const idx = STICK_TABLE.indexOf(modes);
  return idx >= 0 ? idx + 1 : Math.max(1, Math.min(10, Math.round(modes / 6.4)));
}

const STORAGE_FOLDER_KEY = 'abdsynths_axionik_neurondb_folder';
const STORAGE_BANK_KEY = 'abdsynths_axionik_neurondb_bank';
const STORAGE_AXIONIK_FOLDER_KEY = 'abdsynths_axionik_axionikdb_folder';
const STORAGE_AXIONIK_BANK_KEY = 'abdsynths_axionik_axionikdb_bank';
const STORAGE_USER_PRESETS_KEY = 'abdsynths_axionik_user_presets';

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
  private activeTab: 'axionik' | 'models' | 'presets' | 'user-presets' = 'axionik';
  private userPresets: AxionikPreset[] = [];
  private userPresetsDirHandle: FileSystemDirectoryHandle | null = null;
  private preferredResynator: 1 | 2 = 1;
  private callerContext: 'r1' | 'r2' | 'global' = 'global';
  private selectedCategory: number | 'all' = 'all';
  private selectedAxionikCategory: string = 'all';
  private selectedPresetCategory: string = 'all';
  private selectedUserPresetCategory: string = 'all';
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
        { id: 'models', label: t('bank.modelsTab'), iconHtml: ICONS.database },
        { id: 'axionik', label: 'AXIONIKDB (V2)', iconHtml: ICONS.database },
        { id: 'presets', label: t('bank.presetsTab'), iconHtml: ICONS.sliders },
        { id: 'user-presets', label: 'PRESETS (V2 .AXPRESET)', iconHtml: ICONS.sliders },
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
        this.setTab(tab as 'axionik' | 'models' | 'presets' | 'user-presets');
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
    } else if (this.activeTab === 'user-presets') {
      this.renderUserPresets();
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
        parameterSet: resolveAxionikParameterSet(m.category || '', m.parameterSet),
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
    // Ocultar barra de selección de Resynator 1 / Resynator 2 en las dos pestañas de presets
    if (this.activeTab === 'presets' || this.activeTab === 'user-presets') {
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

    if (this.activeTab === 'user-presets') {
      const catCounts: Record<string, number> = {};
      for (const p of this.userPresets) {
        const c = p.meta.category || 'User';
        catCounts[c] = (catCounts[c] || 0) + 1;
      }
      const items: BankChipItem[] = [
        { id: 'all', label: 'All', count: this.userPresets.length },
        ...Object.keys(catCounts)
          .sort()
          .map((cat) => ({
            id: cat,
            label: cat,
            count: catCounts[cat],
            catClass: getPresetCategoryInfo(cat).catClass,
          })),
      ];
      container.innerHTML = bankChipsHtml(items, this.selectedUserPresetCategory);
      this.chipsUnbind = bindBankChips(container, (id) => {
        this.selectedUserPresetCategory = id;
        this.renderCategoryChips();
        this.renderUserPresets();
      });
      return;
    }

    if (this.activeTab === 'axionik') {
      // Agrupar modelos v2 dinámicamente por Grupo/Sublibrería (carpetas: Transformed_AI_BWE_96k, Transformed_HD_96k, etc.)
      const groupCounts: Record<string, number> = {};
      for (const m of this.axionikModels) {
        const grp = m.sublibrary || m.category || 'Default';
        groupCounts[grp] = (groupCounts[grp] || 0) + 1;
      }
      const items: BankChipItem[] = [
        { id: 'all', label: 'All', count: this.axionikModels.length },
        ...Object.keys(groupCounts)
          .sort()
          .map((grp) => {
            const catInfo = getPresetCategoryInfo(grp);
            return {
              id: grp,
              label: grp,
              count: groupCounts[grp],
              catClass: catInfo.catClass,
            };
          }),
      ];
      container.innerHTML = bankChipsHtml(items, this.selectedAxionikCategory);
      this.chipsUnbind = bindBankChips(container, (id) => {
        this.selectedAxionikCategory = id;
        this.renderCategoryChips();
        this.renderAxionikModels();
      });
      return;
    }

    // Compute live counts per parameterSet (0..9) for classic models tab
    const activeModelList = this.currentBank.models;
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
    if (this.selectedAxionikCategory !== 'all') {
      filtered = filtered.filter((m) => (m.sublibrary || m.category || 'Default') === this.selectedAxionikCategory);
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

    // Recorrido recursivo completo para encontrar axionik-expanded.json sin importar
    // la profundidad ni la jerarquía de carpetas (SubLibrary -> Category -> Model).
    const walkDirectory = async (dir: FileSystemDirectoryHandle, currentSublib: string) => {
      let expandedJsonText = '';
      let hasCover = false;
      const subdirs: FileSystemDirectoryHandle[] = [];

      for await (const entry of (dir as IterDir).values()) {
        if (entry.kind === 'file') {
          const lower = entry.name.toLowerCase();
          if (lower === 'axionik-expanded.json') {
            try {
              const f = await (entry as FileSystemFileHandle).getFile();
              expandedJsonText = await f.text();
            } catch (err) {
              console.warn('[BankDrawer] Error reading axionik-expanded.json in', dir.name, err);
            }
          } else if (lower === 'cover.webp') {
            hasCover = true;
          }
        } else if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
          subdirs.push(entry as FileSystemDirectoryHandle);
        }
      }

      if (expandedJsonText) {
        try {
          const parsed: any = JSON.parse(expandedJsonText);
          const identity = parsed.identity || {};
          const meta = parsed.remaster || parsed.meta || {};

          foundModels.push({
            slug: identity.slug || dir.name,
            name: identity.expandedName || identity.modelName || dir.name,
            category: identity.category || meta.category || 'Synth & Neutral',
            parameterSet: resolveAxionikParameterSet(
              identity.category || meta.category || 'Synth & Neutral',
              meta.parameterSet,
            ),
            zoneCount: Array.isArray(parsed.regions) ? parsed.regions.length : 1,
            complexity: meta.complexity ?? 8,
            hasCover,
            folderPath: dir.name,
            sublibrary: currentSublib || 'Default',
            sublibraryOrdinal: ord++,
            hasExpandedV2: true,
            expandedJson: expandedJsonText,
          });
        } catch (err) {
          console.warn('[BankDrawer] Error parsing JSON for model in', dir.name, err);
        }
      }

      for (const subdir of subdirs) {
        let nextSublib = currentSublib;
        const dirLower = dir.name.toLowerCase();
        if (!currentSublib || currentSublib === 'Default' || dirLower === 'models' || dirLower === 'banks' || dirLower === 'axionikdb') {
          if (dirLower !== 'models' && dirLower !== 'banks' && dirLower !== 'axionikdb') {
            nextSublib = dir.name;
          }
        }
        await walkDirectory(subdir, nextSublib);
      }
    };

    await walkDirectory(rootHandle, rootHandle.name.toLowerCase() === 'axionikdb' ? '' : rootHandle.name);

    this.setAxionikBank(rootHandle.name, foundModels);
    this.open();
  }

  private async scanAxionikFileList(fileList: FileList): Promise<void> {
    const capsuleMap = new Map<string, { slug: string; sublib: string; expandedJson?: string; hasV2?: boolean; hasCover?: boolean }>();

    // New on-disk layout: <SubLibrary>/<Category>/<Model_Name>/axionik-expanded.json.
    // The JSON file itself is the model container, so we index by the folder that
    // directly contains it (no 05_extended_model required).
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split(/[/\\]/);
      const fileName = parts[parts.length - 1].toLowerCase();

      if (fileName === 'axionik-expanded.json' && parts.length >= 2) {
        const folder = parts[parts.length - 2];
        const rec = capsuleMap.get(folder) ?? { slug: folder, sublib: 'Default' };
        try {
          rec.expandedJson = await file.text();
          rec.hasV2 = true;
        } catch {
          // ignore
        }
        capsuleMap.set(folder, rec);
      } else if (fileName === 'cover.webp' && parts.length >= 2) {
        const folder = parts[parts.length - 2];
        const rec = capsuleMap.get(folder) ?? { slug: folder, sublib: 'Default' };
        rec.hasCover = true;
        capsuleMap.set(folder, rec);
      }
    }

    let ord = 1;
    const foundModels: AxionikDbModelEntry[] = [];
    for (const rec of capsuleMap.values()) {
      const parsed: any = rec.expandedJson ? JSON.parse(rec.expandedJson) : null;
      const identity = parsed?.identity || {};
      const meta = parsed?.remaster || parsed?.meta || {};

      foundModels.push({
        slug: identity.slug || rec.slug,
        name: identity.expandedName || identity.modelName || rec.slug,
        category: identity.category || meta.category || 'Synth & Neutral',
        parameterSet: resolveAxionikParameterSet(
          identity.category || meta.category || 'Synth & Neutral',
          meta.parameterSet,
        ),
        zoneCount: Array.isArray(parsed?.regions) ? parsed.regions.length : 1,
        complexity: meta.complexity ?? 8,
        hasCover: Boolean(rec.hasCover),
        folderPath: rec.slug,
        sublibrary: rec.sublib,
        sublibraryOrdinal: ord++,
        hasExpandedV2: Boolean(rec.hasV2),
        expandedJson: rec.expandedJson,
      });
    }

    const folderName = fileList[0]?.webkitRelativePath?.split(/[/\\]/)[0] || 'AxionikDB';
    this.setAxionikBank(folderName, foundModels);
    this.open();
  }


  public exportPresetBundle(preset: AxionikPreset): void {
    const bundle: AxionikPreset = JSON.parse(JSON.stringify(preset));

    if (bundle.engineMode === 'extended' && bundle.extendedState) {
      const r1Slug = bundle.extendedState.r1ModelSlug;
      const r2Slug = bundle.extendedState.r2ModelSlug;

      const r1Entry = this.axionikModels.find((m) => m.slug === r1Slug || m.name === bundle.extendedState?.r1ModelName);
      const r2Entry = this.axionikModels.find((m) => m.slug === r2Slug || m.name === bundle.extendedState?.r2ModelName);

      let r1JsonObj: Record<string, unknown> | null = null;
      let r2JsonObj: Record<string, unknown> | null = null;

      if (r1Entry?.expandedJson) {
        try { r1JsonObj = JSON.parse(r1Entry.expandedJson); } catch {}
      }
      if (r2Entry?.expandedJson) {
        try { r2JsonObj = JSON.parse(r2Entry.expandedJson); } catch {}
      }

      bundle.extendedState.embeddedModel = {
        r1: r1JsonObj,
        r2: r2JsonObj,
      };
    }

    const jsonStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (preset.meta.name || 'Preset').replace(/[^a-zA-Z0-9_\- ]/g, '_').trim();
    a.href = url;
    a.download = `${safeName}.bundle.axpreset`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    this.shell.flashStatus(`Exported "${preset.meta.name}" as self-contained bundle`, 'ok');
  }

  public async deleteUserPreset(presetName: string): Promise<boolean> {
    const norm = presetName.toLowerCase().trim();
    const idx = this.userPresets.findIndex((p) => p.meta.name.toLowerCase().trim() === norm);
    if (idx < 0) return false;

    this.userPresets.splice(idx, 1);
    this.persistToLocalStorage();
    this.updateCounters();

    // Eliminar también en el Host C++ o sistema de archivos si hay handle
    WebBridge.deletePreset(presetName);
    if (this.userPresetsDirHandle) {
      try {
        const legalBase = presetName.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim() || 'Preset';
        await (this.userPresetsDirHandle as any).removeEntry(`${legalBase}.axpreset`);
      } catch (err) {
        console.warn('[BankDrawer] removeEntry error or not supported:', err);
      }
    }

    this.shell.flashStatus(`Preset "${presetName}" deleted`, 'ok');
    this.renderCategoryChips();
    this.renderUserPresets();
    return true;
  }

  public registerUserPreset(preset: AxionikPreset): void {
    const existingIdx = this.userPresets.findIndex(
      (p) => p.meta.name.toLowerCase() === preset.meta.name.toLowerCase()
    );
    if (existingIdx >= 0) {
      this.userPresets[existingIdx] = preset;
    } else {
      this.userPresets.unshift(preset);
    }
    this.persistToLocalStorage();
    this.updateCounters();
    if (this.activeTab === 'user-presets') {
      this.renderActiveTab();
    }
  }

  public async savePresetToDiskFolder(preset: AxionikPreset): Promise<boolean> {
    this.registerUserPreset(preset);
    if (!this.userPresetsDirHandle) {
      return false;
    }
    try {
      const fileName = `${preset.meta.name.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim() || 'Preset'}.axpreset`;
      const fileHandle = await this.userPresetsDirHandle.getFileHandle(fileName, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(JSON.stringify(preset, null, 2));
      await writable.close();
      this.shell.flashStatus(`Saved to folder: ${fileName}`, 'ok');
      return true;
    } catch (err) {
      console.warn('[BankDrawer] Failed saving preset to user folder:', err);
      return false;
    }
  }

  public async loadPresetFromFile(file: File): Promise<AxionikPreset | null> {
    try {
      const text = await file.text();
      const preset = parsePresetFile(text);
      if (!preset) return null;
      this.registerUserPreset(preset);
      this.shell.flashStatus(`Loaded preset: ${preset.meta.name}`, 'ok');
      return preset;
    } catch (err) {
      console.error('[BankDrawer] Failed to load preset file:', err);
      this.shell.flashStatus(`Failed to load: ${file.name}`, 'error');
      return null;
    }
  }

  private renderUserPresets(): void {
    if (!this.drawerElement) return;
    const container = this.shell.contentEl;
    const totalPresets = this.userPresets.length;

    if (totalPresets === 0) {
      this.shell.setBadge('0 USER PRESETS');
      container.innerHTML = `
        <div class="neurondb-empty-state">
          <span class="empty-icon">${ICONS.sliders}</span>
          <span class="empty-msg">No custom .axpreset files saved yet</span>
          <span class="ndb-dim" style="font-size: var(--text-xs); color: var(--color-text-dim); margin-top: var(--space-1);">Save your current sound using File → Save Preset (Ctrl+S) or select your Presets/ folder.</span>
          <button type="button" class="btn btn-xs btn-primary ndb-empty-action" id="btn-configure-user-presets" style="margin-top: var(--space-3);">
            <span class="btn-icon">${ICONS.folder}</span>
            <span>Configure Presets Folder...</span>
          </button>
        </div>
      `;
      container.querySelector('#btn-configure-user-presets')?.addEventListener('click', () => this.promptConfigureUserPresetsFolder());
      return;
    }

    let filtered = this.userPresets;
    if (this.selectedUserPresetCategory !== 'all') {
      filtered = filtered.filter((p) => (p.meta.category || 'User') === this.selectedUserPresetCategory);
    }
    if (this.filterQuery) {
      const q = this.filterQuery.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        return (
          p.meta.name.toLowerCase().includes(q) ||
          (p.meta.category && p.meta.category.toLowerCase().includes(q)) ||
          (p.meta.author && p.meta.author.toLowerCase().includes(q)) ||
          p.models?.resynator1?.name.toLowerCase().includes(q) ||
          p.models?.resynator2?.name.toLowerCase().includes(q)
        );
      });
    }

    this.shell.setBadge(
      filtered.length === totalPresets
        ? `${totalPresets} USER PRESETS`
        : `${filtered.length} / ${totalPresets} USER PRESETS`
    );

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="neurondb-empty-state">
          <span class="empty-icon">${ICONS.sliders}</span>
          <span class="empty-msg">No user presets found matching "${this.filterQuery}"</span>
        </div>
      `;
      return;
    }

    const cardsHtml = filtered
      .map((p, idx) => {
        const catInfo = getPresetCategoryInfo(p.meta.category || 'User');
        const r1Str = p.models?.resynator1 ? `R1: ${p.models.resynator1.name}` : 'R1: None';
        const r2Str = p.models?.resynator2 ? `R2: ${p.models.resynator2.name}` : 'R2: None';
        return bankCardHtml({
          slot: idx,
          catClass: catInfo.catClass,
          catLabel: p.meta.category || 'User Preset',
          name: p.meta.name,
          iconHtml: catInfo.icon,
          badges: [r1Str, r2Str, 'User Preset'],
          actions: [
            { id: 'load-user-preset', label: t('bank.loadPreset'), title: `${t('bank.loadPreset')} ${p.meta.name}` },
            { id: 'export-bundle', label: '📦', title: `Exportar / Compartir "${p.meta.name}" (Self-Contained Bundle para ABDNeuModMkr)` },
            { id: 'delete-preset', label: '🗑', title: `Delete preset "${p.meta.name}"` },
          ]
        });
      })
      .join('');

    container.innerHTML = `<div class="ndb-grid ndb-preset-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-3);">${cardsHtml}</div>`;

    const grid = container.querySelector('.ndb-grid') as HTMLElement | null;
    if (grid) {
      this.cardUnbind?.();
      this.cardUnbind = bindBankCards(grid, {
        onCardDblClick: (idx) => {
          const targetPreset = filtered[idx];
          if (targetPreset) {
            this.handlers.onSelectAxionikPreset?.(targetPreset);
            this.close();
          }
        },
        onAction: ({ slot: idx, action }) => {
          const targetPreset = filtered[idx];
          if (!targetPreset) return;
          if (action === 'export-bundle') {
            this.exportPresetBundle(targetPreset);
            return;
          }
          if (action === 'delete-preset') {
            const confirmed = window.confirm(`¿Eliminar el preset "${targetPreset.meta.name}" de forma definitiva?`);
            if (confirmed) {
              this.deleteUserPreset(targetPreset.meta.name);
            }
            return;
          }
          this.handlers.onSelectAxionikPreset?.(targetPreset);
          this.close();
        },
      });
    }
  }

  public async promptConfigureUserPresetsFolder(): Promise<void> {
    const win = window as Window & {
      showDirectoryPicker?: (opts?: { mode?: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    };
    if (typeof win.showDirectoryPicker === 'function') {
      try {
        const dirHandle = await win.showDirectoryPicker({ mode: 'readwrite' });
        this.userPresetsDirHandle = dirHandle;
        await this.scanUserPresetsDirectory(dirHandle);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn('[BankDrawer] User presets folder selection aborted or error:', err);
      }
    }
  }

  public async scanUserPresetsDirectory(dirHandle: FileSystemDirectoryHandle): Promise<void> {
    type IterDir = FileSystemDirectoryHandle & {
      values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
    };
    const loaded: AxionikPreset[] = [];

    // Recorrido recursivo para encontrar presets en subcarpetas/grupos
    const walkPresets = async (dir: FileSystemDirectoryHandle, parentGroup: string) => {
      const subdirs: FileSystemDirectoryHandle[] = [];
      for await (const entry of (dir as IterDir).values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.axpreset') || entry.name.endsWith('.json'))) {
          try {
            const file = await (entry as FileSystemFileHandle).getFile();
            const text = await file.text();
            const parsed = parsePresetFile(text);
            if (parsed) {
              // Si el preset no tiene categoría explícita o es User, usar el nombre de la carpeta/grupo
              if ((!parsed.meta.category || parsed.meta.category === 'User') && parentGroup) {
                parsed.meta.category = parentGroup;
              }
              loaded.push(parsed);
            }
          } catch {
            // ignore corrupted files
          }
        } else if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
          subdirs.push(entry as FileSystemDirectoryHandle);
        }
      }

      for (const sub of subdirs) {
        await walkPresets(sub, sub.name);
      }
    };

    await walkPresets(dirHandle, '');

    if (loaded.length > 0) {
      for (const p of loaded) {
        this.registerUserPreset(p);
      }
      this.shell.flashStatus(`Loaded ${loaded.length} presets from folder`, 'ok');
      this.renderCategoryChips();
      this.renderActiveTab();
    }
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

    // Check for Presets or UserPresets subfolder
    const presetsDir = subDirs.get('Presets') || subDirs.get('presets') || subDirs.get('UserPresets');
    if (presetsDir) {
      this.userPresetsDirHandle = presetsDir;
      await this.scanUserPresetsDirectory(presetsDir);
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
      localStorage.setItem(STORAGE_USER_PRESETS_KEY, JSON.stringify(this.userPresets.slice(0, 100)));
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
      const rawUserPresets = localStorage.getItem(STORAGE_USER_PRESETS_KEY);
      if (rawUserPresets) {
        try {
          const parsedU = JSON.parse(rawUserPresets);
          if (Array.isArray(parsedU)) {
            this.userPresets = parsedU;
          }
        } catch {}
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

  public getExistingUserCategories(): string[] {
    const set = new Set<string>();
    this.userPresets.forEach((p) => {
      if (p.meta.category) set.add(p.meta.category);
    });
    this.axionikModels.forEach((m) => {
      const g = m.sublibrary || m.category;
      if (g) set.add(g);
    });
    this.currentBank.presets.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
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

  public setTab(tab: 'axionik' | 'models' | 'presets' | 'user-presets'): void {
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

  public toggle(tab?: 'axionik' | 'models' | 'presets' | 'user-presets', context?: 'r1' | 'r2' | 'global' | 1 | 2): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open(tab, context);
    }
  }

  public open(tab?: 'axionik' | 'models' | 'presets' | 'user-presets', context?: 'r1' | 'r2' | 'global' | 1 | 2): void {
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
