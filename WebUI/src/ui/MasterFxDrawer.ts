// ─────────────────────────────────────────────────────────
// ABDAxionikVS — MasterFxDrawer.ts
// Re-exporta y delega en EffectsDrawer (Bloque 2: Master) para unificación DRY de efectos.
// ─────────────────────────────────────────────────────────

import { EffectsDrawer, REVERB_ROOMS } from './EffectsDrawer.js';

export { REVERB_ROOMS };

export interface MasterFxDrawerOptions {
  onClose: () => void;
}

export class MasterFxDrawer {
  public static createContent(options: MasterFxDrawerOptions): HTMLElement {
    return EffectsDrawer.createContent({
      onClose: options.onClose,
      initialBlock: 'master',
    });
  }
}
