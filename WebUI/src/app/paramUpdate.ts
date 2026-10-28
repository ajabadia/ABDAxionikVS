/**
 * ABDAxionikVS — app/paramUpdate.ts
 * Manejo de mensajes PARAM_UPDATE del bridge, con índices centralizados
 * en ParamIdx (sin literales numéricos) y estado de UI desacoplado de main.ts
 */
import { ParamIdx } from '../constants/paramIndices.js';
import { BLENDER_ALGORITHMS } from '../ui/BlenderDrawer.js';
import { TrajectoryStick2D } from '../ui/TrajectoryStick2D.js';
import { getParameterSetStickLabels } from '../ui/ParameterSets.js';
import { MODEL_METADATA, getCanonicalModelName } from '../ui/NeuronCatalogMetadata.js';

export interface ParamUpdateCtx {
  updateResySwitchButton: (resy: 1 | 2, enabled: boolean) => void;
  updateResynatorModelUI: (resynator: 1 | 2, slot: number, name?: string) => void;
  setModelName: (resynator: 1 | 2, text: string) => void;
  r1ScapeStick: TrajectoryStick2D | null;
  r1SphereStick: TrajectoryStick2D | null;
  r2ScapeStick: TrajectoryStick2D | null;
  r2SphereStick: TrajectoryStick2D | null;
  blender: {
    slider: HTMLInputElement | null;
    sliderLabel: HTMLElement | null;
    setIdx: (v: number) => void;
  };
  slicer: {
    depthSlider: HTMLInputElement | null;
    depthLabel: HTMLElement | null;
    rateSlider: HTMLInputElement | null;
    rateLabel: HTMLElement | null;
    setIdx: (v: number) => void;
  };
  filter: {
    cutSlider: HTMLInputElement | null;
    cutLabel: HTMLElement | null;
    resoSlider: HTMLInputElement | null;
    resoLabel: HTMLElement | null;
  };
  freqFx: { setIdx: (v: number) => void };
  timeFx: { setIdx: (v: number) => void };
}

const clampIdx = (v: number, max: number): number => Math.max(0, Math.min(max, Math.round(v)));
const norm127 = (v: number): number => Math.max(0, Math.min(1, v / 127));

const updateModelHeader = (
  ctx: ParamUpdateCtx,
  resynator: 1 | 2,
  slot: number,
): void => {
  const name = getCanonicalModelName(slot);
  ctx.updateResynatorModelUI(resynator, slot, name);
  ctx.setModelName(resynator, `#${String(slot).padStart(3, '0')} ${name}`);

  const meta = MODEL_METADATA[slot];
  const pSet = meta ? meta[0] : (slot % 10);
  const scape = resynator === 1 ? ctx.r1ScapeStick : ctx.r2ScapeStick;
  const sphere = resynator === 1 ? ctx.r1SphereStick : ctx.r2SphereStick;
  scape?.setAllLayerLabels(getParameterSetStickLabels(pSet, 'scape'));
  sphere?.setAllLayerLabels(getParameterSetStickLabels(pSet, 'sphere'));
};

/** Aplica un cambio de parámetro recibido del host a la UI. */
export function handleParamUpdate(idx: number, val: number, ctx: ParamUpdateCtx): void {
  if (idx === ParamIdx.R1Switch) {
    ctx.updateResySwitchButton(1, val > 0.5);
  } else if (idx === ParamIdx.R2Switch) {
    ctx.updateResySwitchButton(2, val > 0.5);
  } else if (idx === ParamIdx.R1ModellIndex) {
    updateModelHeader(ctx, 1, Math.round(val));
  } else if (idx === ParamIdx.R2ModellIndex) {
    updateModelHeader(ctx, 2, Math.round(val));
  } else if (idx === ParamIdx.BlenderType) {
    ctx.blender.setIdx(clampIdx(val, BLENDER_ALGORITHMS.length - 1));
  } else if (idx === ParamIdx.BlenderAmount && ctx.blender.slider) {
    ctx.blender.slider.value = String(val);
    if (ctx.blender.sliderLabel) ctx.blender.sliderLabel.textContent = String(val);
  } else if (idx === ParamIdx.SlicerSwitchType) {
    ctx.slicer.setIdx(clampIdx(val, 2)); // 0: Off, 1: 2D, 2: 3D
  } else if (idx === ParamIdx.SlicerDepth && ctx.slicer.depthSlider) {
    ctx.slicer.depthSlider.value = String(val);
    if (ctx.slicer.depthLabel) ctx.slicer.depthLabel.textContent = String(val);
  } else if (idx === ParamIdx.SlicerRate && ctx.slicer.rateSlider) {
    ctx.slicer.rateSlider.value = String(val);
    if (ctx.slicer.rateLabel) ctx.slicer.rateLabel.textContent = String(val);
  } else if (idx === ParamIdx.FilterFreq && ctx.filter.cutSlider) {
    ctx.filter.cutSlider.value = String(val);
    if (ctx.filter.cutLabel) ctx.filter.cutLabel.textContent = String(val);
  } else if (idx === ParamIdx.FilterReso && ctx.filter.resoSlider) {
    ctx.filter.resoSlider.value = String(val);
    if (ctx.filter.resoLabel) ctx.filter.resoLabel.textContent = (val / 127).toFixed(2);
  } else if (idx === ParamIdx.CurFreqFX) {
    ctx.freqFx.setIdx(clampIdx(val, 4)); // 0..4: EQ/Comp, Distortion, RingMod, Decimator, Sp-Warp
  } else if (idx === ParamIdx.CurTimeFX) {
    ctx.timeFx.setIdx(clampIdx(val, 4)); // 0..4: St.Spread, L/R Delay, Flanger, Phaser, Chorus
  } else {
    handleStickUpdate(idx, val, ctx);
  }
}

/** Actualiza la coordenada de uno de los 4 sticks 2D según el índice de capa. */
function handleStickUpdate(idx: number, val: number, ctx: ParamUpdateCtx): void {
  type Axis = 'x' | 'y';
  const layerOf = (i: number, a: number, b: number, c: number): number =>
    i === a ? 0 : (i === b ? 1 : (i === c ? 2 : -1));

  const apply = (
    stick: TrajectoryStick2D | null,
    layer: number,
    axis: Axis,
  ): boolean => {
    if (!stick || layer < 0) return false;
    const cur = stick.getCoordinates(layer);
    const norm = norm127(val);
    if (axis === 'x') stick.setPosition(layer, norm, cur.y, false);
    else stick.setPosition(layer, cur.x, norm, false);
    return true;
  };

  let layer = layerOf(idx, ParamIdx.R1L1Scape1Value, ParamIdx.R1L2Scape1Value, ParamIdx.R1L3Scape1Value);
  if (apply(ctx.r1ScapeStick, layer, 'x')) return;
  layer = layerOf(idx, ParamIdx.R1L1Scape2Value, ParamIdx.R1L2Scape2Value, ParamIdx.R1L3Scape2Value);
  if (apply(ctx.r1ScapeStick, layer, 'y')) return;
  layer = layerOf(idx, ParamIdx.R1L1Sphere1Value, ParamIdx.R1L2Sphere1Value, ParamIdx.R1L3Sphere1Value);
  if (apply(ctx.r1SphereStick, layer, 'x')) return;
  layer = layerOf(idx, ParamIdx.R1L1Sphere2Value, ParamIdx.R1L2Sphere2Value, ParamIdx.R1L3Sphere2Value);
  if (apply(ctx.r1SphereStick, layer, 'y')) return;
  layer = layerOf(idx, ParamIdx.R2L1Scape1Value, ParamIdx.R2L2Scape1Value, ParamIdx.R2L3Scape1Value);
  if (apply(ctx.r2ScapeStick, layer, 'x')) return;
  layer = layerOf(idx, ParamIdx.R2L1Scape2Value, ParamIdx.R2L2Scape2Value, ParamIdx.R2L3Scape2Value);
  if (apply(ctx.r2ScapeStick, layer, 'y')) return;
  layer = layerOf(idx, ParamIdx.R2L1Sphere1Value, ParamIdx.R2L2Sphere1Value, ParamIdx.R2L3Sphere1Value);
  if (apply(ctx.r2SphereStick, layer, 'x')) return;
  layer = layerOf(idx, ParamIdx.R2L1Sphere2Value, ParamIdx.R2L2Sphere2Value, ParamIdx.R2L3Sphere2Value);
  apply(ctx.r2SphereStick, layer, 'y');
}
