/**
 * ABDAxionikVS — nukeStickHelpers.ts
 * Pure stick routing tables, Silver polar labels and UI sync helpers for NukeDrawer.
 * Strict line limit: < 145 lines. 0 #hex colors.
 */

import type { PerformanceDeck } from '@abdsynths/shared/components';
import { pillSelectorHtml } from '@abdsynths/shared/components/pillSelector.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { MODEL_METADATA, getCanonicalModelName } from './NeuronCatalogMetadata.js';
import { getParameterSetStickLabels } from './stickLabels.js';
import type { StickLabels } from './TrajectoryStick2D.js';

export type NukeStickEngine = 'r1' | 'r2' | 'silver';
export type NukeStickDomain = 'sphere' | 'scape';

export const NUKE_MACRO_DEFS = [
  { selectParamIdx: ParamIdx.Knob1R1Select, defaultDestId: 61 },
  { selectParamIdx: ParamIdx.Knob2R1Select, defaultDestId: 56 },
  { selectParamIdx: ParamIdx.Knob3R1Select, defaultDestId: 32 },
  { selectParamIdx: ParamIdx.Knob4R1Select, defaultDestId: 62 },
] as const;

export const SHORT_CTRL_NAMES = ['Aftertouch', 'Modulation', 'Breath', 'CC 03', 'Foot', 'Expression'] as const;

export function formatSignedDepth(val: number): string {
  const rounded = Math.round(val);
  return `${rounded >= 0 ? '+' : '-'}${String(Math.abs(rounded)).padStart(2, '0')}`;
}

export function getSilverLabelsForLayer(layerIdx: number, getParam: (idx: number, def: number) => number): StickLabels {
  if (layerIdx === 0) return { north: '▲ RESO +', south: '▼ RESO -', west: '◀ CUT -', east: 'CUT + ▶' };
  if (layerIdx === 1) {
    const fx = Math.round(getParam(ParamIdx.CurFreqFX, 0));
    if (fx === 2) return { north: '▲ MIX +', south: '▼ MIX -', west: '◀ FREQ -', east: 'FREQ + ▶' };
    if (fx === 1) return { north: '▲ PRE +', south: '▼ PRE -', west: '◀ DRV -', east: 'DRV + ▶' };
    if (fx === 3) return { north: '▲ MIX +', south: '▼ MIX -', west: '◀ S&H -', east: 'S&H + ▶' };
    return { north: '▲ PAR 2 +', south: '▼ PAR 2 -', west: '◀ PAR 1 -', east: 'PAR 1 + ▶' };
  }
  const tfx = Math.round(getParam(ParamIdx.CurTimeFX, 0));
  if (tfx === 1) return { north: '▲ FDBK +', south: '▼ FDBK -', west: '◀ TIME -', east: 'TIME + ▶' };
  if (tfx === 4) return { north: '▲ DEP +', south: '▼ DEP -', west: '◀ MIX -', east: 'MIX + ▶' };
  return { north: '▲ PAR 2 +', south: '▼ PAR 2 -', west: '◀ PAR 1 -', east: 'PAR 1 + ▶' };
}

export function resolveStickXYParams(
  engine: NukeStickEngine, domain: NukeStickDomain, layerIdx: number,
  getParam: (idx: number, def: number) => number,
): [number, number] {
  if (engine === 'r1') {
    const sc = domain === 'scape';
    if (layerIdx === 0) return sc ? [ParamIdx.R1L1Scape1Value, ParamIdx.R1L1Scape2Value] : [ParamIdx.R1L1Sphere1Value, ParamIdx.R1L1Sphere2Value];
    if (layerIdx === 1) return sc ? [ParamIdx.R1L2Scape1Value, ParamIdx.R1L2Scape2Value] : [ParamIdx.R1L2Sphere1Value, ParamIdx.R1L2Sphere2Value];
    return sc ? [ParamIdx.R1L3Scape1Value, ParamIdx.R1L3Scape2Value] : [ParamIdx.R1L3Sphere1Value, ParamIdx.R1L3Sphere2Value];
  }
  if (engine === 'r2') {
    const sc = domain === 'scape';
    if (layerIdx === 0) return sc ? [ParamIdx.R2L1Scape1Value, ParamIdx.R2L1Scape2Value] : [ParamIdx.R2L1Sphere1Value, ParamIdx.R2L1Sphere2Value];
    if (layerIdx === 1) return sc ? [ParamIdx.R2L2Scape1Value, ParamIdx.R2L2Scape2Value] : [ParamIdx.R2L2Sphere1Value, ParamIdx.R2L2Sphere2Value];
    return sc ? [ParamIdx.R2L3Scape1Value, ParamIdx.R2L3Scape2Value] : [ParamIdx.R2L3Sphere1Value, ParamIdx.R2L3Sphere2Value];
  }
  if (layerIdx === 0) return [ParamIdx.FilterFreq, ParamIdx.FilterReso];
  if (layerIdx === 1) {
    const fx = Math.round(getParam(ParamIdx.CurFreqFX, 0));
    return fx === 2 ? [314, 310] : fx === 1 ? [306, 307] : fx === 3 ? [325, 324] : [ParamIdx.FilterFreq, ParamIdx.FilterReso];
  }
  const tfx = Math.round(getParam(ParamIdx.CurTimeFX, 0));
  return tfx === 1 ? [333, 336] : tfx === 4 ? [352, 353] : [331, 332];
}

export function buildNukeStickToolbarHtml(engine: NukeStickEngine, domain: NukeStickDomain): string {
  const enginePills = pillSelectorHtml(
    [{ id: 'r1', label: 'Resys 1' }, { id: 'r2', label: 'Resys 2' }, { id: 'silver', label: 'Silver' }],
    engine, { id: 'nuke-engine-pills', size: 'xs', attrName: 'data-engine' },
  );
  const domainPills = pillSelectorHtml(
    [{ id: 'sphere', label: 'Sphere' }, { id: 'scape', label: 'Scape' }],
    domain, { id: 'nuke-domain-pills', size: 'xs', attrName: 'data-domain' },
  );
  return `
    <div class="nuke-hub-toolbar">
      <div class="nuke-hub-selector-group"><span class="hud-label">TARGET:</span>${enginePills}</div>
      <div class="nuke-hub-selector-group" id="nuke-domain-group"><span class="hud-label">MODE:</span>${domainPills}</div>
      <span class="hud-pill stat-num" id="nuke-active-target-badge">Init</span>
    </div>`;
}

export function syncNukeStickState(
  deck: PerformanceDeck, engine: NukeStickEngine, domain: NukeStickDomain,
  level: number, getParam: (idx: number, def: number) => number,
): void {
  const stick = deck.centralStick;
  if (!stick) return;
  const badgeEl = deck.el.querySelector('#nuke-active-target-badge');
  if (engine === 'r1' || engine === 'r2') {
    const isR1 = engine === 'r1';
    const slot = Math.round(getParam(isR1 ? ParamIdx.R1ModellIndex : ParamIdx.R2ModellIndex, 511));
    const meta = MODEL_METADATA[slot];
    if (badgeEl) badgeEl.textContent = `${isR1 ? 'R1' : 'R2'} • ${domain.toUpperCase()} • #${String(slot).padStart(3, '0')} ${getCanonicalModelName(slot)}`;
    stick.setAllLayerLabels(getParameterSetStickLabels(meta ? meta[0] : (slot % 10), domain));
  } else {
    if (badgeEl) badgeEl.textContent = `SILVER • ${level === 0 ? 'FILTER' : (level === 1 ? 'FREQ FX' : 'TIME FX')}`;
    stick.setAllLayerLabels([getSilverLabelsForLayer(0, getParam), getSilverLabelsForLayer(1, getParam), getSilverLabelsForLayer(2, getParam)]);
  }
  const mount = deck.el.querySelector('[data-slot="stick-mount"]');
  const [ax, ay] = resolveStickXYParams(engine, domain, level, getParam);
  mount?.setAttribute('data-param-x', String(ax)); mount?.setAttribute('data-param-y', String(ay));
  if (!(stick as any).isDragging) {
    for (let l = 0; l < 3; ++l) {
      const [px, py] = resolveStickXYParams(engine, domain, l, getParam);
      stick.setPosition(l, Math.max(0, Math.min(1, getParam(px, 64) / 127)), Math.max(0, Math.min(1, getParam(py, 64) / 127)), false);
    }
  }
}
