/**
 * ABDAxionikVS — app/presetApply.ts
 * Everything that pushes a full parameter/model snapshot into the UI:
 * host dumps (applyAllParamsToUI), preset objects (applyLoadedPreset, shared
 * by bank picks and .axpreset file loads) and factory init (initSound,
 * shared by navbar and LCD bar). The resynator header/navbar/stick triple
 * funnels through resynator.syncModel; the EXPANDED-model label is the only
 * exception (deliberately unprefixed `[EXP]` display name) and stays manual
 * at its two call sites.
 */
import { getCanonicalModelName } from '../ui/NeuronCatalogMetadata.js';
import { FREQ_ALGO_NAMES, TIME_ALGO_NAMES } from '../ui/SilverPanel.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import type { AxionikPreset } from '../ui/PresetModel.js';
import type { TrajectoryStick2D } from '../ui/TrajectoryStick2D.js';
import type { AppCtx } from './context.js';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Pushes a raw host parameter dump into every panel. */
export function applyAllParamsToUI(ctx: AppCtx, values: number[]): void {
  if (!Array.isArray(values) || values.length === 0) return;

  // R1 Model & R2 Model + Switches
  const r1Slot = Math.round(values[ParamIdx.R1ModellIndex] ?? 511);
  const r2Slot = Math.round(values[ParamIdx.R2ModellIndex] ?? 511);
  ctx.resynator?.updateSwitchButton(1, (values[ParamIdx.R1Switch] ?? 1) > 0.5);
  ctx.resynator?.updateSwitchButton(2, (values[ParamIdx.R2Switch] ?? 1) > 0.5);
  ctx.resynator?.syncModel(1, r1Slot, getCanonicalModelName(r1Slot));
  ctx.resynator?.syncModel(2, r2Slot, getCanonicalModelName(r2Slot));

  // Blender, Filter y EnvMaster panels
  ctx.blenderPanel?.updateAll(values);
  ctx.filterPanel?.updateAll(values);
  ctx.envelopeMasterPanel?.updateAll(values);

  // Slicer & Silver FX en SilverPanel
  const slicerMode = Math.round(values[ParamIdx.SlicerSwitchType] ?? 0);
  const slicerDepth = Math.round(values[ParamIdx.SlicerDepth] ?? 0);
  const slicerRate = Math.round(values[ParamIdx.SlicerRate] ?? 66);
  ctx.silverPanel?.updateParam(ParamIdx.SlicerSwitchType, slicerMode);
  ctx.silverPanel?.updateParam(ParamIdx.SlicerDepth, slicerDepth);
  ctx.silverPanel?.updateParam(ParamIdx.SlicerRate, slicerRate);
  ctx.silverPanel?.updateParam(ParamIdx.SilverSwitch, values[ParamIdx.SilverSwitch] ?? 1);
  ctx.silverPanel?.updateSilver();

  // Silver FX (los readouts viven en SilverPanel)
  const freqAlgo = Math.max(0, Math.min(FREQ_ALGO_NAMES.length - 1, Math.round(values[ParamIdx.CurFreqFX] ?? 2)));
  ctx.silverPanel?.updateFreqAlgoUi(freqAlgo);

  const timeAlgo = Math.max(0, Math.min(TIME_ALGO_NAMES.length - 1, Math.round(values[ParamIdx.CurTimeFX] ?? 1)));
  ctx.silverPanel?.updateTimeAlgoUi(timeAlgo);

  // Sticks 2D Positions (3 layers x 4 sticks, param triples per axis)
  const stickSync: Array<{
    stick: TrajectoryStick2D | null;
    xs: [number, number, number];
    ys: [number, number, number];
  }> = [
    {
      stick: ctx.sticks.r1Scape,
      xs: [ParamIdx.R1L1Scape1Value, ParamIdx.R1L2Scape1Value, ParamIdx.R1L3Scape1Value],
      ys: [ParamIdx.R1L1Scape2Value, ParamIdx.R1L2Scape2Value, ParamIdx.R1L3Scape2Value],
    },
    {
      stick: ctx.sticks.r1Sphere,
      xs: [ParamIdx.R1L1Sphere1Value, ParamIdx.R1L2Sphere1Value, ParamIdx.R1L3Sphere1Value],
      ys: [ParamIdx.R1L1Sphere2Value, ParamIdx.R1L2Sphere2Value, ParamIdx.R1L3Sphere2Value],
    },
    {
      stick: ctx.sticks.r2Scape,
      xs: [ParamIdx.R2L1Scape1Value, ParamIdx.R2L2Scape1Value, ParamIdx.R2L3Scape1Value],
      ys: [ParamIdx.R2L1Scape2Value, ParamIdx.R2L2Scape2Value, ParamIdx.R2L3Scape2Value],
    },
    {
      stick: ctx.sticks.r2Sphere,
      xs: [ParamIdx.R2L1Sphere1Value, ParamIdx.R2L2Sphere1Value, ParamIdx.R2L3Sphere1Value],
      ys: [ParamIdx.R2L1Sphere2Value, ParamIdx.R2L2Sphere2Value, ParamIdx.R2L3Sphere2Value],
    },
  ];
  for (const { stick, xs, ys } of stickSync) {
    if (!stick) continue;
    for (let layer = 0; layer < 3; layer++) {
      stick.setPosition(layer, clamp01((values[xs[layer]] ?? 64) / 127), clamp01((values[ys[layer]] ?? 64) / 127), false);
    }
  }

  ctx.nukeDrawer?.syncAll();
  ctx.topLcdBar?.refreshAll();
}

/** Applies a preset object: models, engine snapshot, names and panel syncs. */
export function applyLoadedPreset(ctx: AppCtx, preset: AxionikPreset, sourceLabel = ''): void {
  const r1Id = preset.models?.resynator1?.id ?? 511;
  const r2Id = preset.models?.resynator2?.id ?? 511;
  const r1Name = preset.models?.resynator1?.name || getCanonicalModelName(r1Id);
  const r2Name = preset.models?.resynator2?.name || getCanonicalModelName(r2Id);

  ctx.resynator?.syncModel(1, r1Id, r1Name);
  ctx.resynator?.syncModel(2, r2Id, r2Name);

  for (const [idxStr, val] of Object.entries(preset.parameters || {})) {
    const idx = parseInt(idxStr, 10);
    if (!isNaN(idx)) {
      WebBridge.setParam(idx, val);
    }
  }

  ctx.navbar?.setPresetName(preset.meta.name);
  ctx.topLcdBar?.setPresetInfo(0, preset.meta.name);
  ctx.shapersPanel?.syncAll();
  ctx.nukeDrawer?.syncAll();
  ctx.topLcdBar?.refreshAll();
  console.log(`[ABDAxionikVS] Preset "${preset.meta.name}" cargado con éxito${sourceLabel}`);
}

/** Factory init sound: engine reset plus the plain '511 sinew' labels. */
export function initSound(ctx: AppCtx): void {
  WebBridge.clearCache();
  WebBridge.initPreset();
  ctx.navbar?.setPresetName('000 InitSound');
  ctx.resynator?.updateModelUI(1, 511, '511 sinew');
  ctx.resynator?.updateModelUI(2, 511, '511 sinew');
  ctx.navbar?.setModelName(1, '511 sinew');
  ctx.navbar?.setModelName(2, '511 sinew');
  ctx.topLcdBar?.setPresetInfo(0, '000 InitSound');
  ctx.shapersPanel?.syncAll();
  ctx.nukeDrawer?.syncAll();
  ctx.topLcdBar?.refreshAll();
  console.log('[ABDAxionikVS] Sound initialized to factory default.');
}
