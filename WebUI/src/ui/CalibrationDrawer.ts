/**
 * ABDAxionikVS — CalibrationDrawer.ts
 * Grouped DSP Calibration & Magic Numbers Inspector/Editor view.
 * Inspired by and improved from the ABDJUNiO601 calibration modal.
 *
 * Uses CALIBRATION_I18N (defaulting to 'en' while preserving 'es' for the
 * upcoming multi-language i18n feature).
 */

import { ICONS } from './icons';
import { DrawerManager } from './Drawers';
import {
  CALIBRATION_CATEGORIES,
  CALIBRATION_I18N,
  CALIBRATION_REGISTRY,
  type CalibrationCategory,
  type CalibrationLocale,
  type CalibrationParamDescriptor,
  calibrationStore,
} from './calibrationContracts';

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class CalibrationDrawer {
  private drawerManager: DrawerManager;
  private mainPanel: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;
  private locale: CalibrationLocale = 'en';
  private selectedCategory: CalibrationCategory | 'ALL' = 'ALL';
  private searchQuery: string = '';
  private showModifiedOnly: boolean = false;
  private statusMessage: { text: string; type: 'info' | 'ok' | 'warn' } | null = null;
  private unsubStore: (() => void) | null = null;

  constructor(app: HTMLElement, drawerManager?: DrawerManager, locale: CalibrationLocale = 'en') {
    this.drawerManager = drawerManager ?? new DrawerManager(app);
    this.locale = locale;
    this.initDrawer();
    if (calibrationStore.getModifiedCount() > 0) {
      calibrationStore.syncAllToBridge();
    }
  }

  public setLocale(locale: CalibrationLocale): void {
    this.locale = locale;
    this.render();
  }

  public getLocale(): CalibrationLocale {
    return this.locale;
  }

  private t() {
    return CALIBRATION_I18N[this.locale];
  }

  private getDescText(desc: CalibrationParamDescriptor): string {
    return this.locale === 'es' ? desc.descriptionEs : desc.description;
  }

  private initDrawer(): void {
    const i18n = this.t();
    this.mainPanel = document.createElement('div');
    this.mainPanel.className = 'ax-calib-drawer-panel';
    this.mainPanel.style.cssText =
      'display: flex; flex-direction: column; height: 100%; width: 100%; min-height: 0; overflow: hidden;';

    this.mainPanel.innerHTML = `
      <div class="drawer-header" style="flex-shrink: 0;">
        <div class="panel-caption" style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="panel-badge">${ICONS.sliders} CALIBRATION</span>
          <span id="ax-calib-header-title">${escapeHtml(i18n.drawerTitle)}</span>
          <span id="ax-calib-header-badge" class="ax-calib-header-badge">43 PARAMS</span>
        </div>
        <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-calib-drawer-close" title="Close (Esc)">
          ${ICONS.close}
        </button>
      </div>
      <div class="drawer-body" id="ax-calib-drawer-body" style="flex: 1 1 0%; min-height: 0; overflow: hidden; display: flex; flex-direction: column; padding: var(--space-3);"></div>
    `;

    this.mainPanel.querySelector('#btn-calib-drawer-close')?.addEventListener('click', () => {
      this.close();
    });

    this.bodyEl = this.mainPanel.querySelector('#ax-calib-drawer-body') as HTMLElement | null;

    this.injectStyles();
    this.render();

    this.unsubStore = calibrationStore.onChange((id) => {
      this.updateSingleParamUI(id);
      this.updateSummaryBadges();
    });
  }

  public isOpen(): boolean {
    return this.drawerManager.getCurrentDrawerId() === 'calibration';
  }

  public open(): void {
    if (!this.mainPanel) return;
    this.render();
    this.drawerManager.openCustom('calibration', this.mainPanel);
  }

  public close(): void {
    if (this.isOpen()) {
      this.drawerManager.close();
    }
  }

  public toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  public destroy(): void {
    if (this.unsubStore) {
      this.unsubStore();
      this.unsubStore = null;
    }
  }

  private setStatus(text: string, type: 'info' | 'ok' | 'warn' = 'info'): void {
    this.statusMessage = { text, type };
    const banner = this.bodyEl?.querySelector('#ax-calib-status-banner') as HTMLElement | null;
    if (banner) {
      banner.textContent = text;
      banner.className = `ax-calib-status-banner is-${type}`;
      banner.style.display = 'flex';
    }
  }

  private getFilteredParams(): CalibrationParamDescriptor[] {
    const q = this.searchQuery.trim().toLowerCase();
    return CALIBRATION_REGISTRY.filter((desc) => {
      if (this.selectedCategory !== 'ALL' && desc.category !== this.selectedCategory) {
        return false;
      }
      if (this.showModifiedOnly && !calibrationStore.isModified(desc.id)) {
        return false;
      }
      if (q.length > 0) {
        const hay = `${desc.label} ${desc.id} ${desc.category} ${desc.description} ${desc.descriptionEs} ${desc.sourceRef} ${desc.unit}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  public render(): void {
    if (!this.bodyEl) return;

    const i18n = this.t();
    const totalCount = CALIBRATION_REGISTRY.length;
    const modCount = calibrationStore.getModifiedCount();

    const headerTitle = this.mainPanel?.querySelector('#ax-calib-header-title');
    if (headerTitle) {
      headerTitle.textContent = i18n.drawerTitle;
    }

    this.bodyEl.innerHTML = `
      <div class="ax-calib-root">
        <!-- Top Toolbar -->
        <div class="ax-calib-toolbar">
          <div class="ax-calib-search-wrap">
            <span class="ax-calib-search-icon">${ICONS.search}</span>
            <input
              type="text"
              id="ax-calib-search-input"
              class="ax-calib-search-input"
              placeholder="${escapeHtml(i18n.searchPlaceholder)}"
              value="${escapeHtml(this.searchQuery)}"
              autocomplete="off"
            />
          </div>

          <button
            type="button"
            id="ax-calib-btn-mod-only"
            class="ax-calib-btn ax-calib-btn-toggle ${this.showModifiedOnly ? 'is-active' : ''}"
            title="${escapeHtml(i18n.modifiedBtnTitle)}"
          >
            <span>${escapeHtml(i18n.modifiedBtn)}</span>
            <span id="ax-calib-mod-count-pill" class="ax-calib-pill-count">${modCount} / ${totalCount}</span>
          </button>

          <div class="ax-calib-actions">
            <button
              type="button"
              id="ax-calib-btn-import"
              class="ax-calib-btn"
              title="${escapeHtml(i18n.loadJsonTitle)}"
            >
              ${ICONS.folder}
              <span>${escapeHtml(i18n.loadJsonBtn)}</span>
            </button>
            <input
              type="file"
              id="ax-calib-file-input"
              accept=".json,application/json"
              style="display:none"
            />

            <button
              type="button"
              id="ax-calib-btn-export"
              class="ax-calib-btn"
              title="${escapeHtml(i18n.exportJsonTitle)}"
            >
              ${ICONS.database}
              <span>${escapeHtml(i18n.exportJsonBtn)}</span>
            </button>

            <button
              type="button"
              id="ax-calib-btn-reset-all"
              class="ax-calib-btn ax-calib-btn-danger"
              title="${escapeHtml(i18n.resetAllTitle)}"
            >
              ${ICONS.refresh}
              <span>${escapeHtml(i18n.resetAllBtn)}</span>
            </button>
          </div>
        </div>

        <!-- Status Banner -->
        <div
          id="ax-calib-status-banner"
          class="ax-calib-status-banner ${this.statusMessage ? `is-${this.statusMessage.type}` : ''}"
          style="display: ${this.statusMessage ? 'flex' : 'none'}"
        >${this.statusMessage ? escapeHtml(this.statusMessage.text) : ''}</div>

        <!-- Category Filter Pills -->
        <div class="ax-calib-cat-tabs" id="ax-calib-cat-tabs">
          ${this.renderCategoryTabsHtml()}
        </div>

        <!-- Scrollable Groups & Cards Container -->
        <div class="ax-calib-content" id="ax-calib-content">
          ${this.renderGroupsHtml()}
        </div>
      </div>
    `;

    this.bindToolbarEvents();
    this.bindContentEvents();
    this.updateSummaryBadges();
  }

  private renderCategoryTabsHtml(): string {
    const i18n = this.t();
    const totalMod = calibrationStore.getModifiedCount();
    const allActive = this.selectedCategory === 'ALL' ? 'is-active' : '';

    let html = `
      <button type="button" class="ax-calib-cat-tab ${allActive}" data-cat="ALL">
        <span>${escapeHtml(i18n.allTab)} (${CALIBRATION_REGISTRY.length})</span>
        ${totalMod > 0 ? `<span class="ax-calib-cat-mod-dot" title="${totalMod} ${escapeHtml(i18n.modShort)}">${totalMod}</span>` : ''}
      </button>
    `;

    for (const cat of CALIBRATION_CATEGORIES) {
      const catParams = CALIBRATION_REGISTRY.filter((p) => p.category === cat);
      const catMod = calibrationStore.getCategoryModifiedCount(cat);
      const isActive = this.selectedCategory === cat ? 'is-active' : '';
      html += `
        <button type="button" class="ax-calib-cat-tab ${isActive}" data-cat="${escapeHtml(cat)}">
          <span>${escapeHtml(cat)} (${catParams.length})</span>
          ${catMod > 0 ? `<span class="ax-calib-cat-mod-dot" title="${catMod} ${escapeHtml(i18n.modShort)}">${catMod}</span>` : ''}
        </button>
      `;
    }

    return html;
  }

  private renderGroupsHtml(): string {
    const i18n = this.t();
    const filtered = this.getFilteredParams();
    if (filtered.length === 0) {
      return `
        <div class="ax-calib-empty">
          <div class="ax-calib-empty-title">${escapeHtml(i18n.emptyTitle)}</div>
          <div class="ax-calib-empty-sub">${escapeHtml(i18n.emptySub)}</div>
        </div>
      `;
    }

    const categoriesToRender =
      this.selectedCategory === 'ALL'
        ? CALIBRATION_CATEGORIES
        : [this.selectedCategory];

    let html = '';
    for (const cat of categoriesToRender) {
      const items = filtered.filter((d) => d.category === cat);
      if (items.length === 0) continue;

      const catMod = calibrationStore.getCategoryModifiedCount(cat);
      html += `
        <section class="ax-calib-group" data-group-cat="${escapeHtml(cat)}">
          <header class="ax-calib-group-header">
            <div class="ax-calib-group-title-wrap">
              <span class="ax-calib-group-icon">${ICONS.cpu}</span>
              <h3 class="ax-calib-group-title">${escapeHtml(cat)}</h3>
              <span class="ax-calib-group-count">${items.length} ${escapeHtml(i18n.valuesUnit)}</span>
              ${catMod > 0 ? `<span class="ax-calib-group-mod-badge">${catMod} ${escapeHtml(i18n.modShort)}</span>` : ''}
            </div>
            <button
              type="button"
              class="ax-calib-btn ax-calib-btn-sm ax-calib-btn-reset-cat"
              data-reset-cat="${escapeHtml(cat)}"
              title="${escapeHtml(i18n.resetGroupTitle(cat))}"
            >
              ${ICONS.refresh}
              <span>${escapeHtml(i18n.resetGroupBtn)}</span>
            </button>
          </header>

          <div class="ax-calib-grid">
            ${items.map((desc) => this.renderParamCardHtml(desc)).join('')}
          </div>
        </section>
      `;
    }

    return html;
  }

  private renderParamCardHtml(desc: CalibrationParamDescriptor): string {
    const i18n = this.t();
    const val = calibrationStore.getValue(desc.id);
    const isMod = calibrationStore.isModified(desc.id);
    const fmtVal = calibrationStore.formatValue(desc.id, val);
    const fmtDef = calibrationStore.formatValue(desc.id, desc.defaultValue);
    const fmtMin = calibrationStore.formatValue(desc.id, desc.minValue);
    const fmtMax = calibrationStore.formatValue(desc.id, desc.maxValue);
    const descText = this.getDescText(desc);

    const span = desc.maxValue - desc.minValue;
    const pct = span > 0 ? Math.max(0, Math.min(100, ((val - desc.minValue) / span) * 100)) : 0;
    const defPct =
      span > 0 ? Math.max(0, Math.min(100, ((desc.defaultValue - desc.minValue) / span) * 100)) : 0;

    return `
      <article
        class="ax-calib-card ${isMod ? 'is-modified' : ''}"
        data-param-card="${escapeHtml(desc.id)}"
      >
        <div class="ax-calib-card-top">
          <div class="ax-calib-card-titles">
            <div class="ax-calib-card-label-row">
              <span class="ax-calib-param-label">${escapeHtml(desc.label)}</span>
              <code class="ax-calib-param-id">${escapeHtml(desc.id)}</code>
              <span class="ax-calib-param-ref" title="${escapeHtml(i18n.sourceRefTitle)}">${escapeHtml(desc.sourceRef)}</span>
              <span class="ax-calib-mod-tag" data-mod-tag="${escapeHtml(desc.id)}" style="display:${isMod ? 'inline-flex' : 'none'}">MOD</span>
            </div>
            <p class="ax-calib-param-desc">${escapeHtml(descText)}</p>
          </div>

          <div class="ax-calib-card-readout">
            <div class="ax-calib-num-wrap">
              <input
                type="number"
                class="ax-calib-num-input"
                data-param-num="${escapeHtml(desc.id)}"
                min="${desc.minValue}"
                max="${desc.maxValue}"
                step="${desc.stepSize}"
                value="${fmtVal}"
                aria-label="${escapeHtml(desc.label)}"
              />
              <span class="ax-calib-unit">${escapeHtml(desc.unit)}</span>
            </div>

            <button
              type="button"
              class="ax-calib-btn-reset-single ${isMod ? 'is-active' : ''}"
              data-reset-param="${escapeHtml(desc.id)}"
              title="${escapeHtml(i18n.resetSingleTitle(fmtDef, desc.unit))}"
            >
              ${ICONS.refresh}
            </button>
          </div>
        </div>

        <div class="ax-calib-slider-area">
          <div class="ax-calib-slider-track-wrap">
            <div
              class="ax-calib-default-tick"
              style="left: ${defPct.toFixed(2)}%"
              title="${escapeHtml(i18n.defaultTickTitle(fmtDef, desc.unit))}"
            ></div>
            <input
              type="range"
              class="ax-calib-slider"
              data-param-slider="${escapeHtml(desc.id)}"
              min="${desc.minValue}"
              max="${desc.maxValue}"
              step="${desc.stepSize}"
              value="${val}"
              style="--calib-fill: ${pct.toFixed(2)}%"
              title="${escapeHtml(i18n.sliderDblClickTitle(fmtDef, desc.unit))}"
            />
          </div>

          <div class="ax-calib-meta-row">
            <span class="ax-calib-meta-bound">${escapeHtml(i18n.minLabel)}: <strong>${fmtMin}</strong> ${escapeHtml(desc.unit)}</span>
            <span class="ax-calib-meta-def">${escapeHtml(i18n.defLabel)}: <strong>${fmtDef}</strong> ${escapeHtml(desc.unit)}</span>
            <span class="ax-calib-meta-bound">${escapeHtml(i18n.maxLabel)}: <strong>${fmtMax}</strong> ${escapeHtml(desc.unit)}</span>
          </div>
        </div>
      </article>
    `;
  }

  private bindToolbarEvents(): void {
    if (!this.bodyEl) return;

    const searchInput = this.bodyEl.querySelector('#ax-calib-search-input') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value;
        this.refreshContentOnly();
      });
    }

    const modOnlyBtn = this.bodyEl.querySelector('#ax-calib-btn-mod-only') as HTMLButtonElement | null;
    if (modOnlyBtn) {
      modOnlyBtn.addEventListener('click', () => {
        this.showModifiedOnly = !this.showModifiedOnly;
        modOnlyBtn.classList.toggle('is-active', this.showModifiedOnly);
        this.refreshContentOnly();
      });
    }

    const catTabs = this.bodyEl.querySelector('#ax-calib-cat-tabs');
    if (catTabs) {
      catTabs.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('[data-cat]') as HTMLElement | null;
        if (!btn) return;
        const cat = btn.getAttribute('data-cat') as CalibrationCategory | 'ALL';
        if (!cat) return;
        this.selectedCategory = cat;
        catTabs.innerHTML = this.renderCategoryTabsHtml();
        this.refreshContentOnly();
      });
    }

    const exportBtn = this.bodyEl.querySelector('#ax-calib-btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.handleExportJson();
      });
    }

    const importBtn = this.bodyEl.querySelector('#ax-calib-btn-import');
    const fileInput = this.bodyEl.querySelector('#ax-calib-file-input') as HTMLInputElement | null;
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
      });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const i18n = this.t();
          const text = String(reader.result ?? '');
          const res = calibrationStore.importFromJson(text);
          if (res.applied > 0) {
            this.setStatus(
              i18n.statusImportedOk(res.applied),
              res.errors.length > 0 ? 'warn' : 'ok'
            );
            this.refreshTabsAndContent();
          } else {
            this.setStatus(
              i18n.statusImportError(res.errors.join(' ')),
              'warn'
            );
          }
        };
        reader.readAsText(file);
      });
    }

    const resetAllBtn = this.bodyEl.querySelector('#ax-calib-btn-reset-all');
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => {
        const i18n = this.t();
        calibrationStore.resetAll();
        this.setStatus(i18n.statusResetAllOk, 'ok');
        this.refreshTabsAndContent();
      });
    }
  }

  private bindContentEvents(): void {
    const content = this.bodyEl?.querySelector('#ax-calib-content');
    if (!content) return;

    content.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const sliderId = target.getAttribute('data-param-slider');
      if (sliderId) {
        const val = parseFloat(target.value);
        if (Number.isFinite(val)) {
          calibrationStore.setValue(sliderId, val);
        }
      }
    });

    content.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      const sliderId = target.getAttribute('data-param-slider');
      if (sliderId) {
        calibrationStore.resetParam(sliderId);
      }
    });

    content.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const numId = target.getAttribute('data-param-num');
      if (numId) {
        const val = parseFloat(target.value);
        if (Number.isFinite(val)) {
          calibrationStore.setValue(numId, val);
        } else {
          target.value = calibrationStore.formatValue(numId);
        }
      }
    });

    content.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const i18n = this.t();

      const singleResetBtn = target.closest('[data-reset-param]') as HTMLElement | null;
      if (singleResetBtn) {
        const id = singleResetBtn.getAttribute('data-reset-param');
        if (id) {
          calibrationStore.resetParam(id);
          const desc = calibrationStore.getDescriptor(id);
          if (desc) {
            this.setStatus(
              i18n.statusResetSingle(
                desc.label,
                desc.id,
                calibrationStore.formatValue(id),
                desc.unit
              ),
              'info'
            );
          }
          if (this.showModifiedOnly) {
            this.refreshTabsAndContent();
          }
        }
        return;
      }

      const catResetBtn = target.closest('[data-reset-cat]') as HTMLElement | null;
      if (catResetBtn) {
        const cat = catResetBtn.getAttribute('data-reset-cat') as CalibrationCategory | null;
        if (cat) {
          calibrationStore.resetCategory(cat);
          this.setStatus(i18n.statusResetGroup(cat), 'ok');
          this.refreshTabsAndContent();
        }
      }
    });
  }

  private refreshContentOnly(): void {
    const content = this.bodyEl?.querySelector('#ax-calib-content');
    if (content) {
      content.innerHTML = this.renderGroupsHtml();
    }
    this.updateSummaryBadges();
  }

  private refreshTabsAndContent(): void {
    const catTabs = this.bodyEl?.querySelector('#ax-calib-cat-tabs');
    if (catTabs) {
      catTabs.innerHTML = this.renderCategoryTabsHtml();
    }
    this.refreshContentOnly();
  }

  private updateSingleParamUI(id: string): void {
    if (!this.bodyEl) return;
    const desc = calibrationStore.getDescriptor(id);
    if (!desc) return;

    const val = calibrationStore.getValue(id);
    const isMod = calibrationStore.isModified(id);
    const fmtVal = calibrationStore.formatValue(id, val);
    const span = desc.maxValue - desc.minValue;
    const pct = span > 0 ? Math.max(0, Math.min(100, ((val - desc.minValue) / span) * 100)) : 0;

    const card = this.bodyEl.querySelector(`[data-param-card="${id}"]`) as HTMLElement | null;
    if (card) {
      card.classList.toggle('is-modified', isMod);
    }

    const modTag = this.bodyEl.querySelector(`[data-mod-tag="${id}"]`) as HTMLElement | null;
    if (modTag) {
      modTag.style.display = isMod ? 'inline-flex' : 'none';
    }

    const slider = this.bodyEl.querySelector(`[data-param-slider="${id}"]`) as HTMLInputElement | null;
    if (slider) {
      slider.value = String(val);
      slider.style.setProperty('--calib-fill', `${pct.toFixed(2)}%`);
    }

    const numInput = this.bodyEl.querySelector(`[data-param-num="${id}"]`) as HTMLInputElement | null;
    if (numInput && document.activeElement !== numInput) {
      numInput.value = fmtVal;
    }

    const resetBtn = this.bodyEl.querySelector(`[data-reset-param="${id}"]`) as HTMLElement | null;
    if (resetBtn) {
      resetBtn.classList.toggle('is-active', isMod);
    }
  }

  private updateSummaryBadges(): void {
    const total = CALIBRATION_REGISTRY.length;
    const mod = calibrationStore.getModifiedCount();

    const pill = this.bodyEl?.querySelector('#ax-calib-mod-count-pill');
    if (pill) {
      pill.textContent = `${mod} / ${total}`;
    }

    const headerBadge =
      this.mainPanel?.querySelector('#ax-calib-header-badge') ??
      document.getElementById('ax-calib-header-badge');
    if (headerBadge) {
      headerBadge.textContent = mod > 0 ? `${total} PARAMS · ${mod} MOD` : `${total} PARAMS`;
      headerBadge.classList.toggle('has-mod', mod > 0);
    }

    const navBtn = document.getElementById('btn-nav-calibration');
    if (navBtn) {
      navBtn.classList.toggle('has-calibration-mods', mod > 0);
    }
  }

  private handleExportJson(): void {
    const i18n = this.t();
    const jsonText = calibrationStore.exportToJson();
    const datePart = new Date().toISOString().slice(0, 10);
    const filename = `ABDAxionikVS_Calibration_${datePart}.json`;

    if (typeof document !== 'undefined') {
      const blob = new Blob([jsonText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    this.setStatus(i18n.statusExportedOk(filename, CALIBRATION_REGISTRY.length), 'ok');
  }

  private injectStyles(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById('ax-calib-drawer-styles')) return;

    const style = document.createElement('style');
    style.id = 'ax-calib-drawer-styles';
    style.textContent = `
      .ax-calib-root {
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
        flex: 1 1 0%;
        min-height: 0;
        height: 100%;
        overflow: hidden;
        color: var(--color-text-primary, #e2e8f0);
        font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
      }

      .ax-calib-header-badge {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        letter-spacing: 0.06em;
        padding: 3px 8px;
        border-radius: var(--radius-sm, 4px);
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.2));
        color: var(--color-text-secondary, #94a3b8);
      }

      .ax-calib-header-badge.has-mod {
        color: var(--color-accent-primary, #38bdf8);
        border-color: var(--color-accent-primary, #38bdf8);
        background: rgba(56, 189, 248, 0.12);
      }

      .ax-calib-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        flex-shrink: 0;
        gap: var(--space-2, 8px);
        padding: var(--space-2, 10px) var(--space-3, 12px);
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.16));
        border-radius: var(--radius-md, 6px);
      }

      .ax-calib-search-wrap {
        position: relative;
        flex: 1 1 240px;
        display: flex;
        align-items: center;
      }

      .ax-calib-search-icon {
        position: absolute;
        left: 10px;
        color: var(--color-text-muted, #64748b);
        display: inline-flex;
        pointer-events: none;
      }

      .ax-calib-search-input {
        width: 100%;
        padding: 6px 10px 6px 32px;
        background: rgba(2, 6, 23, 0.75);
        border: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.22));
        border-radius: var(--radius-sm, 4px);
        color: var(--color-text-primary, #f1f5f9);
        font-size: 12px;
        outline: none;
      }

      .ax-calib-search-input:focus {
        border-color: var(--color-accent-primary, #38bdf8);
      }

      .ax-calib-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
      }

      .ax-calib-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 11px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        border-radius: var(--radius-sm, 4px);
        border: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.25));
        background: rgba(30, 41, 59, 0.75);
        color: var(--color-text-primary, #e2e8f0);
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
      }

      .ax-calib-btn:hover {
        border-color: var(--color-accent-primary, #38bdf8);
        color: #ffffff;
        background: rgba(56, 189, 248, 0.14);
      }

      .ax-calib-btn-sm {
        padding: 4px 9px;
        font-size: 10px;
      }

      .ax-calib-btn-toggle.is-active {
        border-color: var(--color-accent-primary, #38bdf8);
        background: rgba(56, 189, 248, 0.18);
        color: var(--color-accent-primary, #38bdf8);
      }

      .ax-calib-btn-danger:hover {
        border-color: var(--color-status-danger, #f43f5e);
        background: rgba(244, 63, 94, 0.16);
        color: #fda4af;
      }

      .ax-calib-pill-count {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 999px;
        background: rgba(2, 6, 23, 0.65);
        color: var(--color-accent-primary, #38bdf8);
      }

      .ax-calib-status-banner {
        flex-shrink: 0;
        align-items: center;
        padding: 7px 12px;
        border-radius: var(--radius-sm, 4px);
        font-size: 11.5px;
        border: 1px solid rgba(56, 189, 248, 0.3);
        background: rgba(56, 189, 248, 0.1);
        color: var(--color-text-primary, #e2e8f0);
      }

      .ax-calib-status-banner.is-ok {
        border-color: rgba(16, 185, 129, 0.4);
        background: rgba(16, 185, 129, 0.12);
      }

      .ax-calib-status-banner.is-warn {
        border-color: rgba(245, 158, 11, 0.45);
        background: rgba(245, 158, 11, 0.14);
      }

      .ax-calib-cat-tabs {
        display: flex;
        flex-wrap: wrap;
        flex-shrink: 0;
        gap: 6px;
      }

      .ax-calib-cat-tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: 0.04em;
        border-radius: var(--radius-sm, 4px);
        border: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.2));
        background: rgba(15, 23, 42, 0.6);
        color: var(--color-text-secondary, #94a3b8);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .ax-calib-cat-tab:hover {
        color: var(--color-text-primary, #f1f5f9);
        border-color: rgba(56, 189, 248, 0.4);
      }

      .ax-calib-cat-tab.is-active {
        background: rgba(56, 189, 248, 0.16);
        border-color: var(--color-accent-primary, #38bdf8);
        color: var(--color-accent-primary, #38bdf8);
      }

      .ax-calib-cat-mod-dot {
        font-family: var(--font-mono, monospace);
        font-size: 9.5px;
        padding: 1px 5px;
        border-radius: 999px;
        background: var(--color-accent-primary, #38bdf8);
        color: #020617;
        font-weight: 700;
      }

      .ax-calib-content {
        flex: 1 1 0%;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
        padding-right: 4px;
        padding-bottom: 16px;
      }

      .ax-calib-group {
        flex-shrink: 0;
        background: rgba(15, 23, 42, 0.45);
        border: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.16));
        border-radius: var(--radius-md, 6px);
      }

      .ax-calib-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 14px;
        background: rgba(2, 6, 23, 0.55);
        border-bottom: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.15));
        border-radius: var(--radius-md, 6px) var(--radius-md, 6px) 0 0;
      }

      .ax-calib-group-title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .ax-calib-group-icon {
        color: var(--color-accent-primary, #38bdf8);
        display: inline-flex;
      }

      .ax-calib-group-title {
        margin: 0;
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: var(--color-accent-primary, #38bdf8);
      }

      .ax-calib-group-count {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-muted, #64748b);
      }

      .ax-calib-group-mod-badge {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        padding: 1px 6px;
        border-radius: var(--radius-sm, 4px);
        background: rgba(56, 189, 248, 0.15);
        color: var(--color-accent-primary, #38bdf8);
        border: 1px solid rgba(56, 189, 248, 0.35);
      }

      .ax-calib-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        gap: 10px;
        padding: 12px;
      }

      .ax-calib-card {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 10px;
        padding: 11px 13px;
        background: rgba(2, 6, 23, 0.65);
        border: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.14));
        border-radius: var(--radius-sm, 5px);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
        box-sizing: border-box;
      }

      .ax-calib-card.is-modified {
        border-color: rgba(56, 189, 248, 0.55);
        box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.15);
      }

      .ax-calib-card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      .ax-calib-card-titles {
        flex: 1 1 auto;
        min-width: 0;
      }

      .ax-calib-card-label-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }

      .ax-calib-param-label {
        font-size: 12px;
        font-weight: 700;
        color: var(--color-text-primary, #f8fafc);
      }

      .ax-calib-param-id {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 3px;
        background: rgba(30, 41, 59, 0.85);
        color: var(--color-accent-primary, #38bdf8);
      }

      .ax-calib-param-ref {
        font-family: var(--font-mono, monospace);
        font-size: 9.5px;
        color: var(--color-text-muted, #64748b);
      }

      .ax-calib-mod-tag {
        font-family: var(--font-mono, monospace);
        font-size: 9px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 3px;
        background: rgba(56, 189, 248, 0.2);
        color: var(--color-accent-primary, #38bdf8);
        border: 1px solid rgba(56, 189, 248, 0.45);
      }

      .ax-calib-param-desc {
        margin: 0;
        font-size: 11px;
        line-height: 1.42;
        color: var(--color-text-secondary, #94a3b8);
      }

      .ax-calib-card-readout {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .ax-calib-num-wrap {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.25));
        border-radius: 4px;
        padding: 2px 6px;
      }

      .ax-calib-num-input {
        width: 66px;
        background: transparent;
        border: none;
        color: var(--color-accent-primary, #38bdf8);
        font-family: var(--font-mono, monospace);
        font-size: 11.5px;
        font-weight: 700;
        text-align: right;
        outline: none;
      }

      .ax-calib-unit {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-muted, #64748b);
      }

      .ax-calib-btn-reset-single {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 4px;
        border: 1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.2));
        background: rgba(30, 41, 59, 0.65);
        color: var(--color-text-muted, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .ax-calib-btn-reset-single.is-active,
      .ax-calib-btn-reset-single:hover {
        color: var(--color-accent-primary, #38bdf8);
        border-color: var(--color-accent-primary, #38bdf8);
        background: rgba(56, 189, 248, 0.15);
      }

      .ax-calib-slider-area {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .ax-calib-slider-track-wrap {
        position: relative;
        display: flex;
        align-items: center;
        height: 18px;
      }

      .ax-calib-default-tick {
        position: absolute;
        top: 2px;
        bottom: 2px;
        width: 2px;
        background: rgba(248, 250, 252, 0.45);
        pointer-events: none;
        z-index: 1;
        transform: translateX(-1px);
      }

      .ax-calib-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: linear-gradient(
          90deg,
          var(--color-accent-primary, #38bdf8) 0%,
          var(--color-accent-primary, #38bdf8) var(--calib-fill, 50%),
          rgba(30, 41, 59, 0.95) var(--calib-fill, 50%),
          rgba(30, 41, 59, 0.95) 100%
        );
        outline: none;
        cursor: pointer;
        margin: 0;
      }

      .ax-calib-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #f8fafc;
        border: 2px solid var(--color-accent-primary, #38bdf8);
        box-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
        cursor: ew-resize;
        position: relative;
        z-index: 2;
      }

      .ax-calib-meta-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: var(--font-mono, monospace);
        font-size: 9.5px;
        color: var(--color-text-muted, #64748b);
      }

      .ax-calib-meta-def strong {
        color: var(--color-text-secondary, #cbd5e1);
      }

      .ax-calib-empty {
        flex-shrink: 0;
        padding: 36px 20px;
        text-align: center;
        background: rgba(15, 23, 42, 0.4);
        border: 1px dashed var(--color-border-subtle, rgba(148, 163, 184, 0.25));
        border-radius: var(--radius-md, 6px);
      }

      .ax-calib-empty-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-text-primary, #e2e8f0);
        margin-bottom: 4px;
      }

      .ax-calib-empty-sub {
        font-size: 11.5px;
        color: var(--color-text-secondary, #94a3b8);
      }
    `;
    document.head.appendChild(style);
  }
}
