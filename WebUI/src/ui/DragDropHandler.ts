/**
 * ABDAxionikVS — DragDropHandler.ts
 * Ergonomic Drag & Drop management for models (.model, .nmmodel), presets (.sound, .fxp),
 * and zip archives (.zip, .modelzip). Targeted drops on Resynator 1 / Resynator 2 or the
 * global canvas (including the expanded R1/R2 drawers opened as #r1-expanded / #r2-expanded).
 *
 * Supported drop payloads:
 *  - a single `axionik-expanded.json` file          -> load it on the target Resynator
 *  - a folder containing `axionik-expanded.json`    -> load the JSON found inside
 *  - any other `.model`/`.nmmodel`/`.json`/`.scape`/`.sphere` file -> normal flow
 */
import type { DragDropHandlerCallbacks } from './dragDropContracts.js';

export interface DroppedItem {
  kind: 'file' | 'directory';
  file?: File;
}

export class DragDropHandler {
  private toastEl: HTMLElement;
  private toastTimer: number | null = null;

  constructor(private callbacks: DragDropHandlerCallbacks) {
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'hud-toast';
    document.body.appendChild(this.toastEl);

    this.bindEvents();
  }

  public showToast(message: string, durationMs = 2800): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('show');
      this.toastTimer = null;
    }, durationMs);
  }

  private bindEvents(): void {
    // Prevent browser default file open behavior
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    const r1Panel = document.getElementById('r1-panel');
    const r2Panel = document.getElementById('r2-panel');
    const r1Expanded = document.getElementById('r1-expanded');
    const r2Expanded = document.getElementById('r2-expanded');
    const workspace = document.querySelector('.workspace-canvas') as HTMLElement | null;

    // Resynator 1 panel target (also when the expanded R1 drawer is open)
    if (r1Panel) {
      this.bindTargetZone(r1Panel, (files) => {
        void this.handleFilesForResynator(files, 1);
      });
    }

    // Resynator 2 panel target (also when the expanded R2 drawer is open)
    if (r2Panel) {
      this.bindTargetZone(r2Panel, (files) => {
        void this.handleFilesForResynator(files, 2);
      });
    }

    // Expanded R1 drawer panel
    if (r1Expanded) {
      this.bindTargetZone(r1Expanded, (files) => {
        void this.handleFilesForResynator(files, 1);
      });
    }

    // Expanded R2 drawer panel
    if (r2Expanded) {
      this.bindTargetZone(r2Expanded, (files) => {
        void this.handleFilesForResynator(files, 2);
      });
    }

    // Global canvas target
    if (workspace) {
      workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      workspace.addEventListener('drop', (e) => {
        // If dropped inside r1 or r2, they handle it through their own listener
        if (r1Panel?.contains(e.target as Node) || r2Panel?.contains(e.target as Node)) {
          return;
        }
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          void this.handleGlobalFiles(files);
        }
      });
    }
  }

  private bindTargetZone(element: HTMLElement, onDrop: (files: FileList) => void): void {
    let enterCounter = 0;

    element.addEventListener('dragenter', (e) => {
      e.preventDefault();
      enterCounter++;
      element.classList.add('drag-hover-zone');
    });

    element.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    element.addEventListener('dragleave', () => {
      enterCounter--;
      if (enterCounter <= 0) {
        enterCounter = 0;
        element.classList.remove('drag-hover-zone');
      }
    });

    element.addEventListener('drop', (e) => {
      e.preventDefault();
      enterCounter = 0;
      element.classList.remove('drag-hover-zone');
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        onDrop(e.dataTransfer.files);
      }
    });
  }

  private async handleFilesForResynator(files: FileList, resynator: 1 | 2): Promise<void> {
    const payload = this.resolveDroppedFileList(files);

    const target = this.determinePrimaryTarget([payload], resynator);
    if (!target) return;

    if (target.kind === 'file') {
      this.tryDropModelFile(target.file!, resynator);
      return;
    }

    // Folder: load the axionik-expanded.json found inside (JSON only, since the
    // Resynator v2 engine consumes the JSON document).
    const inside = await this.findAxionikExpandedJsonInDirectory(payload, target.file!);
    if (inside) {
      await this.callbacks.onDropModel(inside, resynator);
    } else {
      this.showToast(`[DRAG & DROP] No axionik-expanded.json found in "${target.file!.name}"`);
    }
  }

  private async handleGlobalFiles(files: FileList): Promise<void> {
    const payload = this.resolveDroppedFileList(files);

    const target = this.determinePrimaryTarget([payload], 1);
    if (!target) return;

    if (target.kind === 'file') {
      // Neutral canvas: drop the model directly on R1 (legacy behaviour).
      this.tryDropModelFile(target.file!, 1);
    } else {
      const inside = await this.findAxionikExpandedJsonInDirectory(payload, target.file!);
      if (inside) {
        await this.callbacks.onDropModel(inside, 1);
      } else {
        this.showToast(`[DRAG & DROP] No axionik-expanded.json found in "${target.file!.name}"`);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  /**
   * Normalise a `FileList` into a single `{ kind, file }` drop item.
   * Chromium may deliver folders through the non-standard DataTransferItemList API
   * (webkitGetAsEntry / getAsFile); fall back to the plain FileList when that API is
   * unavailable, so folder drops always degrade to the first file.
   */
  private resolveDroppedFileList(files: FileList): DroppedItem {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItems = (files as any).items;
    if (rawItems && rawItems.length > 0) {
      for (let i = 0; i < rawItems.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = rawItems[i] as DataTransferItem & { webkitGetAsEntry?: () => any };
        if (typeof item.webkitGetAsEntry === 'function') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            return { kind: entry.isDirectory ? 'directory' : 'file' } as DroppedItem;
          }
        }
      }
    }

    // Fall back to the standard FileList (always filled for file drops).
    return { kind: 'file', file: files[0] } as DroppedItem;
  }

  /**
   * Pick the first entry relevant for a model drop on `resynator`.
   * The callback `onDropModel` receives a single File, so we hand it the
   * axionik-expanded.json (or the folder itself when nothing matches).
   */
  private determinePrimaryTarget(payload: DroppedItem[], _resynator: 1 | 2): DroppedItem | null {
    for (const item of payload) {
      if (item.kind === 'file' && item.file) {
        const name = item.file.name.toLowerCase();
        if (name === 'axionik-expanded.json' || name === 'model.nmmodel' || name.endsWith('.json')) {
          return item;
        }
      } else if (item.kind === 'directory') {
        // A directory is always a usable target for a model drop; the file path
        // inside it will be resolved by the caller so it can fetch the JSON.
        return item;
      }
    }
    return null;
  }

  /**
   * Search a directory (recursively, depth-first) for `axionik-expanded.json`
   * and return it as a File. When nothing is found inside, fall back to the
   * directory root's own file so folder drops never get stuck.
   */
  private async findAxionikExpandedJsonInDirectory(
    root: DroppedItem,
    fallback: File,
  ): Promise<File> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchDir = async (dir: DroppedItem, path: string): Promise<File | null> => {
      if (dir.kind !== 'file' || !dir.file) return null;

      const name = dir.file.name.toLowerCase();
      if (name === 'axionik-expanded.json') return dir.file;

      // Only directories can contain entries; files are leaves.
      const entry = dir as any;
      if (entry.kind !== 'directory' || !entry.createReader) return null;

      const reader = entry.createReader();
      return new Promise((resolve) => {
        reader.readEntries((subEntries) => {
          for (let i = 0; i < subEntries.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sub = subEntries[i] as any;
            if (sub.kind === 'file') {
              const file = sub.file ? sub.file() : null;
              if (file && file.name.toLowerCase() === 'axionik-expanded.json') {
                resolve(file);
                return;
              }
            } else if (sub.kind === 'directory') {
              const candidate = searchDir({ kind: 'file', file: null }, path + '/' + sub.name);
              if (candidate) {
                resolve(candidate);
                return;
              }
            }
          }
          resolve(null);
        }, () => resolve(null));
      });
    };

    return searchDir(root, '').then((found) => found ?? fallback) as unknown as File;
  }

  private async tryDropModelFile(file: File, _resynator: 1 | 2): Promise<void> {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.json') || lowerName.endsWith('.model') || lowerName.endsWith('.nmmodel')) {
      this.callbacks.onDropModel(file, _resynator);
    } else if (lowerName.endsWith('.scape') || lowerName.endsWith('.sphere')) {
      this.callbacks.onDropModel(file, _resynator);
    } else if (lowerName.endsWith('.sound') || lowerName.endsWith('.fxp')) {
      this.callbacks.onDropPreset(file);
      this.showToast(`[DRAG & DROP] Loaded preset "${file.name}"`);
    } else if (lowerName.endsWith('.zip') || lowerName.endsWith('.modelzip') || lowerName.endsWith('.nmpack')) {
      this.callbacks.onDropZip(file);
      this.showToast(`[DRAG & DROP] Imported archive "${file.name}"`);
    } else {
      this.showToast(`[DRAG & DROP] Unknown file format "${file.name}"`);
    }
  }
}
