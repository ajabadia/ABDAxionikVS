/**
 * ABDAxionikVS — DragDropHandler.ts
 * Ergonomic Drag & Drop management for models (.model, .nmmodel),
 * presets (.sound, .fxp), and zip archives (.zip, .modelzip).
 * Targeted drops on Resynator 1 / Resynator 2 or global canvas.
 */

export interface DragDropHandlerCallbacks {
  onDropModel: (file: File, resynator: 1 | 2) => void | Promise<void>;
  onDropPreset: (file: File) => void | Promise<void>;
  onDropZip: (file: File) => void | Promise<void>;
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
    const workspace = document.querySelector('.workspace-canvas') as HTMLElement | null;

    // Resynator 1 panel target
    if (r1Panel) {
      this.bindTargetZone(r1Panel, (files) => {
        void this.handleFilesForResynator(files, 1);
      });
    }

    // Resynator 2 panel target
    if (r2Panel) {
      this.bindTargetZone(r2Panel, (files) => {
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
    const file = files[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.model') || lowerName.endsWith('.nmmodel') || lowerName.endsWith('.scape') || lowerName.endsWith('.sphere')) {
      await this.callbacks.onDropModel(file, resynator);
      this.showToast(`[DRAG & DROP] Loaded model "${file.name}" into Resynator ${resynator}`);
    } else if (lowerName.endsWith('.sound') || lowerName.endsWith('.fxp')) {
      await this.callbacks.onDropPreset(file);
      this.showToast(`[DRAG & DROP] Loaded preset "${file.name}"`);
    } else if (lowerName.endsWith('.zip') || lowerName.endsWith('.modelzip')) {
      await this.callbacks.onDropZip(file);
      this.showToast(`[DRAG & DROP] Imported archive "${file.name}"`);
    } else {
      this.showToast(`[DRAG & DROP] Unknown file format "${file.name}"`);
    }
  }

  private async handleGlobalFiles(files: FileList): Promise<void> {
    const file = files[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.sound') || lowerName.endsWith('.fxp')) {
      await this.callbacks.onDropPreset(file);
      this.showToast(`[DRAG & DROP] Loaded preset "${file.name}"`);
    } else if (lowerName.endsWith('.model') || lowerName.endsWith('.nmmodel')) {
      // Default to Resynator 1 when dropped on neutral canvas
      await this.callbacks.onDropModel(file, 1);
      this.showToast(`[DRAG & DROP] Loaded model "${file.name}" into Resynator 1`);
    } else if (lowerName.endsWith('.zip') || lowerName.endsWith('.modelzip')) {
      await this.callbacks.onDropZip(file);
      this.showToast(`[DRAG & DROP] Imported archive "${file.name}"`);
    } else {
      this.showToast(`[DRAG & DROP] Unknown file format "${file.name}"`);
    }
  }
}
