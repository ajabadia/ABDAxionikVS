/**
 * ABDAxionikVS — RotaryLedKnob.ts
 * Re-exporta el componente canónico RotaryLedKnob de ABDShared
 * Manteniendo tipado exacto para el frontend de ABDAxionikVS.
 */

import { RotaryLedKnob as SharedRotaryLedKnob } from '@abdsynths/shared/components';

export interface RotaryLedKnobOptions {
  size?: number;
  value?: number;
  min?: number;
  max?: number;
  numLeds?: number;
  label?: string;
  ariaLabel?: string;
  bipolar?: boolean;
  step?: number;
  showValue?: boolean;
  onChange?: (val: number) => void;
  onSettled?: (val: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  format?: (val: number) => string;
}

export class RotaryLedKnob extends SharedRotaryLedKnob {
  constructor(container: HTMLElement, options: RotaryLedKnobOptions = {}) {
    super(container, options);
  }

  public setValue(val: number, notify = false): void {
    super.setValue(val, notify);
  }

  public getValue(): number {
    return super.getValue();
  }

  public destroy(): void {
    super.destroy();
  }
}
