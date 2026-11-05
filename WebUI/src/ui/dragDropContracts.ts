/**
 * ABDAxionikVS — dragDropContracts.ts
 * Shared contract for drag & drop handlers (models, presets, zip packages).
 * Kept as its own module so the callback interface does not sit inside the
 * class implementation file and create circular import aliases.
 */

export interface DragDropHandlerCallbacks {
  onDropModel: (file: File, resynator: 1 | 2) => void | Promise<void>;
  onDropPreset: (file: File) => void | Promise<void>;
  onDropZip: (file: File) => void | Promise<void>;
}
