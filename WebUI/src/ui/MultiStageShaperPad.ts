// ─────────────────────────────────────────────────────────
// ABDAxionikVS — MultiStageShaperPad.ts
// Re-exporta el componente canónico universal de ABDShared
// Proporciona tipado estricto para envolventes 4L4T
// ─────────────────────────────────────────────────────────

import { MultiStageShaperPad as SharedShaper } from '@abdsynths/shared/components';

export interface MultiStageShaperValue {
  times: number[];
  levels: number[];
  mode: number;
}

export interface MultiStageShaperOptions {
  label?: string;
  bipolar?: boolean;
  editable?: boolean;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  times?: number[];
  levels?: number[];
  mode?: number;
  onChange?: (val: MultiStageShaperValue) => void;
}

export class MultiStageShaperPad extends SharedShaper {
  constructor(container: HTMLElement, options: MultiStageShaperOptions) {
    super(container, options);
  }

  public setValue(val: Partial<MultiStageShaperValue>, notify = false): void {
    super.setValue(val, notify);
  }

  public getValue(): MultiStageShaperValue {
    return super.getValue();
  }

  public setMode(mode: number): void {
    super.setMode(mode);
  }
}
