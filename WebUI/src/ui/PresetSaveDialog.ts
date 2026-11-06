/**
 * ABDAxionikVS — PresetSaveDialog.ts
 * Modal para nombrar y categorizar el preset antes de guardarlo.
 * Soporta selección entre categorías existentes (v1 y extendidas),
 * opción "- Custom -" para crear una nueva categoría, y selección interactiva
 * de color entre las 32 ranuras de color de la paleta canónica.
 */

import {
  CATEGORY_32_PALETTE,
  STANDARD_CATEGORY_NAMES,
  getCategoryColorSlot,
  setCategoryColorSlot,
} from './presetCategories.js';

/** Límite del nombre: acaba formando parte de una ruta de archivo. */
const MAX_PRESET_NAME_LENGTH = 64;

export interface PresetSaveDialogOptions {
  currentPresetName: string;
  defaultCategory?: string;
  existingCategories?: string[];
  onSave: (name: string, category: string, author: string, colorSlot?: number, embedModel?: boolean) => void;
  isExtendedMode?: boolean;
  onCancel?: () => void;
}

export class PresetSaveDialog {
  private overlay: HTMLElement | null = null;
  private options: PresetSaveDialogOptions;
  private selectedColorSlot: number = 0;

  constructor(options: PresetSaveDialogOptions) {
    this.options = options;
  }

  public open(): void {
    if (this.overlay) return;

    // Sugerir nombre limpio: si ya tiene "000 Name", quitar los números iniciales si procede
    let defaultName = this.options.currentPresetName.trim();
    if (/^\d{3}\s+/.test(defaultName)) {
      defaultName = defaultName.replace(/^\d{3}\s+/, '');
    }
    if (!defaultName.toLowerCase().endsWith('copy')) {
      defaultName = `${defaultName} Copy`;
    }
    defaultName = defaultName.slice(0, MAX_PRESET_NAME_LENGTH);

    // Unir categorías estándar v1 con las encontradas en la librería
    const catSet = new Set<string>();
    STANDARD_CATEGORY_NAMES.forEach((c) => catSet.add(c));
    if (this.options.existingCategories) {
      this.options.existingCategories.forEach((c) => {
        if (c && c !== 'all' && c !== 'All') catSet.add(c);
      });
    }

    const categoriesList = Array.from(catSet);
    const initialCategory = this.options.defaultCategory || 'General';
    this.selectedColorSlot = getCategoryColorSlot(initialCategory);

    this.overlay = document.createElement('div');
    this.overlay.className = 'preset-save-modal-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
    `;

    // Paleta de 32 colores HTML
    const colorSwatchesHtml = CATEGORY_32_PALETTE.map((slotDef) => {
      const isSel = slotDef.slot === this.selectedColorSlot;
      return `
        <button type="button" class="preset-color-swatch ${isSel ? 'is-active' : ''}" data-color-slot="${slotDef.slot}" title="${slotDef.slot}: ${slotDef.name}" style="
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: ${isSel ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)'};
          background: ${slotDef.hex};
          cursor: pointer;
          padding: 0;
          box-shadow: ${isSel ? '0 0 6px rgba(255,255,255,0.8)' : 'none'};
          transform: ${isSel ? 'scale(1.15)' : 'scale(1)'};
          transition: transform 0.15s ease, border-color 0.15s ease;
        "></button>
      `;
    }).join('');

    // Opciones del select de categorías
    const categoryOptionsHtml = [
      ...categoriesList.map(
        (cat) => `<option value="${cat}" ${cat === initialCategory ? 'selected' : ''}>${cat}</option>`
      ),
      `<option value="__custom__">- Custom (Nueva Categoría) -</option>`,
    ].join('');

    this.overlay.innerHTML = `
      <div class="preset-save-modal-card" style="
        background: var(--color-bg-card, #121820);
        border: 1px solid var(--color-accent, #00c3ff);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 195, 255, 0.2);
        border-radius: 6px;
        width: 420px;
        max-width: 92vw;
        padding: 16px 20px;
        color: var(--color-text-main, #e8f4ff);
        display: flex;
        flex-direction: column;
        gap: 12px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 8px;">
          <span style="font-weight: 700; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-accent, #00c3ff);">
            Save Preset (.axpreset)
          </span>
          <button type="button" class="btn btn-xs btn-outline btn-close-modal" style="cursor: pointer; background: transparent; border: none; color: var(--color-text-dim, #888); font-size: 14px;">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="font-size: 11px; opacity: 0.85;">Preset Name</label>
          <input type="text" id="preset-name-input" maxlength="${MAX_PRESET_NAME_LENGTH}" value="${defaultName.replace(/"/g, '&quot;')}" style="
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
          " />
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="font-size: 11px; opacity: 0.85;">Category</label>
          <select id="preset-category-select" style="
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
            cursor: pointer;
          ">
            ${categoryOptionsHtml}
          </select>
          <input type="text" id="preset-category-custom-input" placeholder="Nombre de nueva categoría..." style="
            display: none;
            margin-top: 4px;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid var(--color-accent, #00c3ff);
            color: #fff;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
          " />
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px; opacity: 0.85;">Category Color (32 slots)</label>
            <span id="preset-color-label" style="font-size: 10px; color: ${CATEGORY_32_PALETTE[this.selectedColorSlot]?.hex || '#00c3ff'}; font-weight: 700;">
              ${CATEGORY_32_PALETTE[this.selectedColorSlot]?.name || ''}
            </span>
          </div>
          <div id="preset-color-palette" style="display: grid; grid-template-columns: repeat(16, 1fr); gap: 4px; padding: 6px; background: rgba(0,0,0,0.3); border-radius: 4px; border: 1px solid rgba(255,255,255,0.08);">
            ${colorSwatchesHtml}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="font-size: 11px; opacity: 0.85;">Author</label>
          <input type="text" id="preset-author-input" value="User" style="
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
          " />
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
          <input type="checkbox" id="preset-embed-models" style="cursor: pointer; accent-color: var(--color-accent, #00c3ff);" />
          <label for="preset-embed-models" style="font-size: 11px; cursor: pointer; user-select: none; color: var(--color-text-main, #e8f4ff);">
            Embeber modelos v2 (Preset autosuficiente para compartir / ABDNeuModMkr)
          </label>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
          <button type="button" class="btn btn-sm btn-outline btn-cancel-modal" style="cursor: pointer; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 6px 12px; border-radius: 4px;">Cancel</button>
          <button type="button" class="btn btn-sm btn-primary btn-confirm-save" style="cursor: pointer; background: var(--color-accent, #00c3ff); color: #000; font-weight: 600; border: none; padding: 6px 16px; border-radius: 4px;">Save & Export</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    const nameInput = this.overlay.querySelector('#preset-name-input') as HTMLInputElement | null;
    const catSelect = this.overlay.querySelector('#preset-category-select') as HTMLSelectElement | null;
    const catCustomInput = this.overlay.querySelector('#preset-category-custom-input') as HTMLInputElement | null;
    const authorInput = this.overlay.querySelector('#preset-author-input') as HTMLInputElement | null;
    const colorLabel = this.overlay.querySelector('#preset-color-label') as HTMLElement | null;
    const colorPalette = this.overlay.querySelector('#preset-color-palette') as HTMLElement | null;

    const updateColorSelection = (slot: number) => {
      this.selectedColorSlot = slot;
      const def = CATEGORY_32_PALETTE[slot];
      if (colorLabel && def) {
        colorLabel.textContent = `${slot}: ${def.name}`;
        colorLabel.style.color = def.hex;
      }
      colorPalette?.querySelectorAll<HTMLElement>('.preset-color-swatch').forEach((btn) => {
        const btnSlot = parseInt(btn.getAttribute('data-color-slot') || '-1', 10);
        const isActive = btnSlot === slot;
        btn.style.border = isActive ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)';
        btn.style.boxShadow = isActive ? '0 0 6px rgba(255,255,255,0.8)' : 'none';
        btn.style.transform = isActive ? 'scale(1.15)' : 'scale(1)';
      });
    };

    // Manejar cambio en select de categorías
    catSelect?.addEventListener('change', () => {
      const val = catSelect.value;
      if (val === '__custom__') {
        if (catCustomInput) {
          catCustomInput.style.display = 'block';
          catCustomInput.focus();
        }
      } else {
        if (catCustomInput) {
          catCustomInput.style.display = 'none';
        }
        const slot = getCategoryColorSlot(val);
        updateColorSelection(slot);
      }
    });

    catCustomInput?.addEventListener('input', () => {
      const customVal = catCustomInput.value.trim();
      if (customVal) {
        const slot = getCategoryColorSlot(customVal);
        updateColorSelection(slot);
      }
    });

    // Manejar clicks en los swatches de color
    colorPalette?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement)?.closest<HTMLElement>('.preset-color-swatch');
      if (!target) return;
      const slot = parseInt(target.getAttribute('data-color-slot') || '0', 10);
      updateColorSelection(slot);
    });

    const handleSave = () => {
      const name = nameInput?.value.trim() || 'Untitled Preset';
      let category = catSelect?.value || 'General';
      if (category === '__custom__') {
        category = catCustomInput?.value.trim() || 'Custom';
      }
      const author = authorInput?.value.trim() || 'User';

      const embedCheckbox = this.overlay?.querySelector('#preset-embed-models') as HTMLInputElement | null;
      const embedModel = embedCheckbox?.checked ?? false;

      // Persistir la asociación de color para esta categoría
      setCategoryColorSlot(category, this.selectedColorSlot);

      this.options.onSave(name, category, author, this.selectedColorSlot, embedModel);
      this.close();
    };

    this.overlay.querySelector('.btn-confirm-save')?.addEventListener('click', handleSave);
    this.overlay.querySelector('.btn-close-modal')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('.btn-cancel-modal')?.addEventListener('click', () => this.close());

    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      } else if (e.key === 'Enter' && e.target !== catCustomInput) {
        e.preventDefault();
        handleSave();
      }
    });

    setTimeout(() => {
      nameInput?.focus();
      nameInput?.select();
    }, 50);
  }

  public close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.options.onCancel?.();
    }
  }
}
