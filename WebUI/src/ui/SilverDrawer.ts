// ─────────────────────────────────────────────────────────
// ABDAxionikVS — SilverDrawer.ts
// Re-exporta y delega en EffectsDrawer (Bloque 1: Silver) para unificación DRY de efectos.
// ─────────────────────────────────────────────────────────

import { EffectsDrawer } from './EffectsDrawer.js';

export interface SilverDrawerProps {
  onClose: () => void;
}

export class SilverDrawer {
  public static createContent(props: SilverDrawerProps): HTMLElement {
    return EffectsDrawer.createContent({
      onClose: props.onClose,
      initialBlock: 'silver',
    });
  }
}
