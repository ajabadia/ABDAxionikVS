/**
 * ABDAxionikVS — app/resynatorUi.ts
 * Single home for every Resynator 1/2 header sync: caption + slot label,
 * navbar model name, and the four stick polar labels. All eleven call sites
 * (preset apply, bank picks, drag&drop, host messages, init) funnel through
 * syncModel so the three updates can never diverge again.
 */
import { MODEL_METADATA, getCanonicalModelName } from '../ui/NeuronCatalogMetadata.js';
import { getParameterSetStickLabels } from '../ui/ParameterSets.js';
import type { AppCtx } from './context.js';

export const padSlot = (slot: number): string => String(slot).padStart(3, '0');

export interface ResynatorUi {
  modelParameterSet(slotRaw: number): number;
  /** Updates caption + slot label, returns the resolved model name. */
  updateModelUI(resynator: 1 | 2, slot: number, name?: string): string;
  updateSwitchButton(resy: 1 | 2, enabled: boolean): void;
  /** The full triple: header + navbar + stick labels. */
  syncModel(resynator: 1 | 2, slot: number, name?: string): void;
}

export function createResynatorUi(ctx: AppCtx): ResynatorUi {
  const modelParameterSet = (slotRaw: number): number => {
    const meta = MODEL_METADATA[Math.round(slotRaw)];
    return meta && typeof meta[0] === 'number' ? meta[0] : -1;
  };

  const updateModelUI = (resynator: 1 | 2, slot: number, name?: string): string => {
    const isR1 = resynator === 1;
    const captionEl = document.getElementById(isR1 ? 'r1-model-caption' : 'r2-model-caption');
    const slotEl = document.getElementById(isR1 ? 'r1-model-slot' : 'r2-model-slot');

    if (slotEl) {
      slotEl.textContent = `#${padSlot(slot)}`;
    }

    let modelName = name;
    if (!modelName && ctx.bankDrawer) {
      const found = ctx.bankDrawer.getBank().models.find((m) => m.slot === slot);
      if (found && found.name) {
        modelName = found.name;
      }
    }
    if (!modelName) {
      modelName = getCanonicalModelName(slot);
    }

    if (isR1) {
      ctx.state.currentR1ModelName = modelName;
    } else {
      ctx.state.currentR2ModelName = modelName;
    }

    if (captionEl) {
      captionEl.textContent = modelName;
      captionEl.title = `Model #${slot}: ${modelName}`;
    }
    ctx.topLcdBar?.setModelInfo(resynator, slot, modelName);
    return modelName;
  };

  const updateSwitchButton = (resy: 1 | 2, enabled: boolean): void => {
    const btn = document.getElementById(resy === 1 ? 'btn-toggle-r1' : 'btn-toggle-r2');
    if (!btn) return;
    btn.classList.toggle('active', enabled);
    btn.classList.toggle('btn-primary', enabled);
    btn.classList.toggle('btn-outline', !enabled);
    btn.textContent = `R${resy} ${enabled ? 'ON' : 'OFF'}`;
  };

  const syncModel = (resynator: 1 | 2, slot: number, name?: string): void => {
    const modelName = updateModelUI(resynator, slot, name);
    ctx.navbar?.setModelName(resynator, `#${padSlot(slot)} ${modelName}`);

    const meta = MODEL_METADATA[slot];
    const parSet = meta ? meta[0] : slot % 10;
    const scape = resynator === 1 ? ctx.sticks.r1Scape : ctx.sticks.r2Scape;
    const sphere = resynator === 1 ? ctx.sticks.r1Sphere : ctx.sticks.r2Sphere;
    scape?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'scape'));
    sphere?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'sphere'));
  };

  return { modelParameterSet, updateModelUI, updateSwitchButton, syncModel };
}
