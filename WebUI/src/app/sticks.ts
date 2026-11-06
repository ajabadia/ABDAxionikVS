/**
 * ABDAxionikVS — app/sticks.ts
 * The four vector controllers (R1/R2 x Scape/Sphere) are one table, not four
 * copy-pasted blocks: layer param triples select per-layer X/Y indices and
 * every motion event funnels through the bridge.
 */
import { TrajectoryStick2D } from '../ui/TrajectoryStick2D.js';
import { getParameterSetStickLabels } from '../ui/ParameterSets.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import type { AppCtx } from './context.js';

interface StickConfig {
  mountId: string;
  key: 'r1Scape' | 'r1Sphere' | 'r2Scape' | 'r2Sphere';
  label: string;
  resynator: 1 | 2;
  domain: 'scape' | 'sphere';
  paramsX: [number, number, number];
  paramsY: [number, number, number];
}

const STICK_CONFIGS: StickConfig[] = [
  {
    mountId: 'r1-scape-mount',
    key: 'r1Scape',
    label: 'SCAPE 1',
    resynator: 1,
    domain: 'scape',
    paramsX: [ParamIdx.R1L1Scape1Value, ParamIdx.R1L2Scape1Value, ParamIdx.R1L3Scape1Value],
    paramsY: [ParamIdx.R1L1Scape2Value, ParamIdx.R1L2Scape2Value, ParamIdx.R1L3Scape2Value],
  },
  {
    mountId: 'r1-sphere-mount',
    key: 'r1Sphere',
    label: 'SPHERE 1',
    resynator: 1,
    domain: 'sphere',
    paramsX: [ParamIdx.R1L1Sphere1Value, ParamIdx.R1L2Sphere1Value, ParamIdx.R1L3Sphere1Value],
    paramsY: [ParamIdx.R1L1Sphere2Value, ParamIdx.R1L2Sphere2Value, ParamIdx.R1L3Sphere2Value],
  },
  {
    mountId: 'r2-scape-mount',
    key: 'r2Scape',
    label: 'SCAPE 2',
    resynator: 2,
    domain: 'scape',
    paramsX: [ParamIdx.R2L1Scape1Value, ParamIdx.R2L2Scape1Value, ParamIdx.R2L3Scape1Value],
    paramsY: [ParamIdx.R2L1Scape2Value, ParamIdx.R2L2Scape2Value, ParamIdx.R2L3Scape2Value],
  },
  {
    mountId: 'r2-sphere-mount',
    key: 'r2Sphere',
    label: 'SPHERE 2',
    resynator: 2,
    domain: 'sphere',
    paramsX: [ParamIdx.R2L1Sphere1Value, ParamIdx.R2L2Sphere1Value, ParamIdx.R2L3Sphere1Value],
    paramsY: [ParamIdx.R2L1Sphere2Value, ParamIdx.R2L2Sphere2Value, ParamIdx.R2L3Sphere2Value],
  },
];

const pickLayer = (triple: [number, number, number], layerIdx: number): number =>
  layerIdx === 0 ? triple[0] : layerIdx === 1 ? triple[1] : triple[2];

export function mountTrajectorySticks(ctx: AppCtx): void {
  for (const cfg of STICK_CONFIGS) {
    const mount = document.getElementById(cfg.mountId);
    if (!mount) continue;
    mount.setAttribute('data-param-x', String(cfg.paramsX[0]));
    mount.setAttribute('data-param-y', String(cfg.paramsY[0]));
    ctx.sticks[cfg.key] = new TrajectoryStick2D(mount, {
      label: cfg.label,
      resynator: cfg.resynator,
      domain: cfg.domain,
      labelsPerLayer: getParameterSetStickLabels(0, cfg.domain),
      onLayerChange: (layerIdx) => {
        const paramX = pickLayer(cfg.paramsX, layerIdx);
        const paramY = pickLayer(cfg.paramsY, layerIdx);
        mount.setAttribute('data-param-x', String(paramX));
        mount.setAttribute('data-param-y', String(paramY));
      },
      onPositionChange: (layerIdx, coord) => {
        const paramX = pickLayer(cfg.paramsX, layerIdx);
        const paramY = pickLayer(cfg.paramsY, layerIdx);
        WebBridge.setParam(paramX, Math.round(coord.x * 127));
        WebBridge.setParam(paramY, Math.round(coord.y * 127));
      },
    });
  }
}
