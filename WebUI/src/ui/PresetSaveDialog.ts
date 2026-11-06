/**
 * ABDAxionikVS — PresetSaveDialog.ts
 * Modal simple, accesible y autocontenido para nombrar y categorizar el preset antes de guardarlo.
 */

export interface PresetSaveDialogOptions {
  currentPresetName: string;
  onSave: (name: string, category: string, author: string) => void;
  onCancel?: () => void;
}

export class PresetSaveDialog {
  private overlay: HTMLElement | null = null;
  private options: PresetSaveDialogOptions;

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

    this.overlay = document.createElement('div');
    this.overlay.className = 'preset-save-modal-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(3px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
    `;

    this.overlay.innerHTML = `
      <div class="preset-save-modal-card" style="
        background: var(--color-bg-card, #121820);
        border: 1px solid var(--color-accent, #00c3ff);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 195, 255, 0.2);
        border-radius: 6px;
        width: 380px;
        max-width: 90vw;
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
          <button type="button" class="btn btn-xs btn-outline btn-close-modal" style="cursor: pointer;">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 11px; opacity: 0.85;">Preset Name</label>
          <input type="text" id="preset-name-input" maxlength="64" value="${defaultName.replace(/"/g, '&quot;')}" style="
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
          " />
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 11px; opacity: 0.85;">Category</label>
          <input type="text" id="preset-category-input" value="User" placeholder="e.g. Lead, Pad, Bass..." style="
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
          " />
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
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

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
          <button type="button" class="btn btn-sm btn-outline btn-cancel-modal" style="cursor: pointer;">Cancel</button>
          <button type="button" class="btn btn-sm btn-primary btn-confirm-save" style="cursor: pointer; background: var(--color-accent, #00c3ff); color: #000; font-weight: 600; border: none; padding: 6px 16px; border-radius: 4px;">Save & Export</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    const nameInput = this.overlay.querySelector('#preset-name-input') as HTMLInputElement | null;
    const catInput = this.overlay.querySelector('#preset-category-input') as HTMLInputElement | null;
    const authorInput = this.overlay.querySelector('#preset-author-input') as HTMLInputElement | null;

    nameInput?.focus();
    nameInput?.select();

    const doClose = () => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;
      this.options.onCancel?.();
    };

    const doConfirm = () => {
      const name = nameInput?.value.trim() || 'Untitled';
      const category = catInput?.value.trim() || 'User';
      const author = authorInput?.value.trim() || 'User';

      // Validacion de robustez: límite de longitud para el nombre del preset.
      // MAX_PATH en Windows es 260, y considerando extension, prefijo y separadores,
      // el nombre maxima recomendable es 64 caracteres.
      if (name.length > 64) {
        nameInput?.setCustomValidity('Name must be 64 characters or fewer.');
        nameInput?.reportValidity();
        return;
      }
      nameInput?.setCustomValidity('');
      if (!name) {
        nameInput?.reportValidity();
        return;
      }

      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      this.overlay = null;

      this.options.onSave(name, category, author);
    };

    this.overlay.querySelector('.btn-close-modal')?.addEventListener('click', doClose);
    this.overlay.querySelector('.btn-cancel-modal')?.addEventListener('click', doClose);
    this.overlay.querySelector('.btn-confirm-save')?.addEventListener('click', doConfirm);

    this.overlay.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        doClose();
      } else if (e.key === 'Enter') {
        doConfirm();
      }
    });
  }
}
