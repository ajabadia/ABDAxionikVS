/**
 * ABDAxionikVS — NukeDrawer.ts
 * Adapter mounting the shared aseptic PerformanceDeck ('overlay' mode) for Neuron <NUKE>.
 * Strict line limit: < 190 lines. 0 #hex colors.
 */

import '@abdsynths/shared/components/PerformanceDeck/performanceDeck.css';
import { PerformanceDeck } from '@abdsynths/shared/components';
import { bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { PARAM_DEFINITIONS } from '../generated/parameters.gen.js';
import { onLocaleChange } from '../i18n/index.js';
import { MOD_SOURCES, getModDestinationLabel, resolveParamIndexFromModDest } from './MatrixDrawer.js';
import { gestureForGroup, type ParamGestureHandlers } from './paramGesture.js';
import { getParameterSetStickLabels } from './stickLabels.js';
import {
  NUKE_MACRO_DEFS, SHORT_CTRL_NAMES, buildNukeStickToolbarHtml, formatSignedDepth,
  resolveStickXYParams, syncNukeStickState, type NukeStickDomain, type NukeStickEngine,
} from './nukeStickHelpers.js';

export { resolveParamIndexFromModDest };
export type { NukeStickEngine, NukeStickDomain };

export interface NukeDrawerOptions {
  onToggleOpen?: (isOpen: boolean) => void;
  onLocalParamChange?: (index: number, value: number) => void;
  onEdit?: () => void;
}

export class NukeDrawer {
  private readonly deck: PerformanceDeck;
  private readonly options: NukeDrawerOptions;
  private openState = false;
  private syncing = false;
  private stickEngine: NukeStickEngine = 'r1';
  private stickDomain: NukeStickDomain = 'sphere';
  private stickLevel: 0 | 1 | 2 = 0;
  private stickGesture: ParamGestureHandlers | null = null;
  private slotGestureParams = new Map<number, number>();

  constructor(parent: HTMLElement, options: NukeDrawerOptions = {}) {
    this.options = options;
    const getP = (i: number, d: number) => WebBridge.getParam(i, d);
    this.deck = new PerformanceDeck(parent, {
      layout: 'overlay', domPrefix: 'nuke', badge: '<NUKE>', title: 'REMOTE CONTROL UNIT',
      caption: 'Interactive Vector Stick, 4 Macro Encoders & 6 Performance Controllers',
      inlineEdit: false, hasVoiceLimit: true, maxVoices: 32,
      voiceLimit: Math.max(1, Math.min(32, Math.round(getP(ParamIdx.SoundNumVoices, 6)))),
      hasStickToolbar: true, secondaryBadge: 'CONTROLLERS',
      secondaryCaption: 'Real-Time Performance Modulation Routing & Bipolar Depth [413..424]', showSecondaryEdit: true,
      macros: NUKE_MACRO_DEFS.map((b, i) => ({
        id: i + 1, name: `KNOB ${i + 1}`,
        label: getModDestinationLabel(Math.round(getP(b.selectParamIdx, b.defaultDestId))),
        value: 0.5, fmt: (v) => String(Math.round(v)),
      })),
      controllers: MOD_SOURCES.map((s, idx) => ({
        id: idx, name: s.name, shortName: (SHORT_CTRL_NAMES[idx] || s.name).toUpperCase(),
        destLabel: getModDestinationLabel(Math.round(getP(s.destParam, s.defaultDest))),
        depth: ((Math.max(-64, Math.min(63, Math.round(getP(s.depthParam, s.defaultDepth)))) + 64) / 127) * 2 - 1,
      })),
      stickLabelsPerLayer: getParameterSetStickLabels(0, 'sphere'),
      stickOptions: {
        label: 'NUKE ORB', variant: 'nuke-orb', numLayers: 3, layerNames: ['L1', 'L2', 'L3'],
        initialLayer: 0, showHeader: true, showLayers: true, readout: true, hasRecorder: true, springReturn: false,
      },
      onEdit: () => this.options.onEdit?.(),
      onClose: () => { if (this.openState) { this.openState = false; this.options.onToggleOpen?.(false); } },
      onVoiceLimitChange: (v) => { if (!this.syncing) this.dispatchParam(ParamIdx.SoundNumVoices, Math.max(1, Math.min(32, Math.round(v)))); },
      onSlotDragStart: (idx) => { const p = idx < 4 ? this.resolveMacroParamIdx(idx) : MOD_SOURCES[idx - 4]?.depthParam; if (p !== undefined) { this.slotGestureParams.set(idx, p); WebBridge.beginGesture(p); } },
      onSlotDragEnd: (idx) => { const p = this.slotGestureParams.get(idx); if (p !== undefined) { this.slotGestureParams.delete(idx); WebBridge.endGesture(p); } },
      onMacroChange: (id, normVal) => {
        const k = id - 1, p = this.resolveMacroParamIdx(k), def = PARAM_DEFINITIONS[p];
        const raw = Math.round((def?.min ?? 0) + normVal * ((def?.max ?? 127) - (def?.min ?? 0)));
        this.dispatchParam(p, raw);
        const el = this.deck.el.querySelector(`[data-val-slot="${k}"]`); if (el) el.textContent = String(raw);
      },
      onControllerDepthChange: (ctrlId, depth) => {
        const src = MOD_SOURCES[ctrlId]; if (!src) return;
        const raw = Math.max(-64, Math.min(63, Math.round(((depth + 1) * 0.5) * 127 - 64)));
        this.dispatchParam(src.depthParam, raw);
        const el = this.deck.el.querySelector(`[data-val-slot="${4 + ctrlId}"]`); if (el) el.textContent = formatSignedDepth(raw);
      },
      onStickLayerChange: (layer) => {
        this.stickLevel = (layer as 0 | 1 | 2);
        this.dispatchParam(this.stickEngine === 'r1' ? ParamIdx.R1ParamLevel : (this.stickEngine === 'r2' ? ParamIdx.R2ParamLevel : ParamIdx.SilverParamLevel), layer);
        this.syncStick();
      },
      onStickDragStart: () => {
        const l = (this.deck.centralStick?.activeLayer ?? this.stickLevel) as 0 | 1 | 2;
        this.stickGesture = gestureForGroup(resolveStickXYParams(this.stickEngine, this.stickDomain, l, getP));
        this.stickGesture.onDragStart();
      },
      onStickDragEnd: () => { this.stickGesture?.onDragEnd(); this.stickGesture = null; },
      onStickChange: (layer, coord) => {
        const [px, py] = resolveStickXYParams(this.stickEngine, this.stickDomain, layer, getP);
        this.dispatchParam(px, Math.round(coord.x * 127)); this.dispatchParam(py, Math.round(coord.y * 127));
      },
    });
    this.mountStickToolbar();
    this.syncAll();
    onLocaleChange(() => { if (this.openState) this.syncAll(); });
  }

  private mountStickToolbar(): void {
    const slot = this.deck.getStickToolbarSlot();
    slot.innerHTML = buildNukeStickToolbarHtml(this.stickEngine, this.stickDomain);
    const eng = slot.querySelector('#nuke-engine-pills') as HTMLElement | null;
    if (eng) bindPillSelector(eng, (id) => this.setStickTarget(id as NukeStickEngine, this.stickDomain), 'data-engine');
    const dom = slot.querySelector('#nuke-domain-pills') as HTMLElement | null;
    if (dom) bindPillSelector(dom, (id) => {
      const nextDom = id as NukeStickDomain;
      if (this.stickEngine === 'r1') this.dispatchParam(ParamIdx.R1Type, nextDom === 'scape' ? 1 : 0);
      else if (this.stickEngine === 'r2') this.dispatchParam(ParamIdx.R2Type, nextDom === 'scape' ? 1 : 0);
      this.setStickTarget(this.stickEngine, nextDom);
    }, 'data-domain');
  }

  private resolveMacroParamIdx(k: number): number {
    const b = NUKE_MACRO_DEFS[k];
    return resolveParamIndexFromModDest(Math.round(WebBridge.getParam(b.selectParamIdx, b.defaultDestId)));
  }

  private dispatchParam(index: number, value: number): void { WebBridge.setParam(index, value); this.options.onLocalParamChange?.(index, value); }
  private syncStick(): void { syncNukeStickState(this.deck, this.stickEngine, this.stickDomain, this.stickLevel, (i, d) => WebBridge.getParam(i, d)); }

  public isOpen(): boolean { return this.openState; }
  public open(): void { if (this.openState) return; this.openState = true; this.syncAll(); this.deck.open(); this.options.onToggleOpen?.(true); }
  public close(): void { if (this.openState) this.deck.close(); }
  public toggle(): void { if (this.openState) this.close(); else this.open(); }

  private setStickTarget(engine: NukeStickEngine, domain: NukeStickDomain): void {
    this.stickEngine = engine; this.stickDomain = domain;
    const slot = this.deck.getStickToolbarSlot();
    slot.querySelectorAll('#nuke-engine-pills [data-engine]').forEach((b) => { const c = b.getAttribute('data-engine') === engine; b.classList.toggle('active', c); b.setAttribute('aria-pressed', String(c)); });
    slot.querySelectorAll('#nuke-domain-pills [data-domain]').forEach((b) => { const c = b.getAttribute('data-domain') === domain; b.classList.toggle('active', c); b.setAttribute('aria-pressed', String(c)); });
    const dg = slot.querySelector('#nuke-domain-group') as HTMLElement | null;
    if (dg) { dg.style.opacity = engine === 'silver' ? '0.35' : '1'; dg.style.pointerEvents = engine === 'silver' ? 'none' : 'auto'; }
    this.syncStick();
  }

  private syncMacroKnob(k: number): void {
    const b = NUKE_MACRO_DEFS[k];
    const destId = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(b.selectParamIdx, b.defaultDestId))));
    const name = getModDestinationLabel(destId);
    const sub = this.deck.el.querySelector(`[data-sub-slot="${k}"]`) as HTMLElement | null;
    if (sub) { sub.textContent = name; sub.title = `Knob ${k + 1} Target Assignment [${b.selectParamIdx}]: ${name}`; }
    const pIdx = resolveParamIndexFromModDest(destId);
    this.deck.el.querySelector(`[data-knob-slot="${k}"]`)?.setAttribute('data-param-index', String(pIdx));
    const def = PARAM_DEFINITIONS[pIdx];
    const min = def?.min ?? 0, max = def?.max ?? 127, val = Math.round(WebBridge.getParam(pIdx, def?.defaultValue ?? 64));
    this.deck.setSlotValue(k, max > min ? Math.max(0, Math.min(1, (val - min) / (max - min))) : 0.5, String(val));
  }

  private syncControllerSlot(idx: number): void {
    const src = MOD_SOURCES[idx];
    const dest = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(src.destParam, src.defaultDest))));
    const depth = Math.max(-64, Math.min(63, Math.round(WebBridge.getParam(src.depthParam, src.defaultDepth))));
    const sub = this.deck.el.querySelector(`[data-sub-slot="${4 + idx}"]`) as HTMLElement | null;
    if (sub) sub.textContent = getModDestinationLabel(dest);
    this.deck.el.querySelector(`[data-knob-slot="${4 + idx}"]`)?.setAttribute('data-param-index', String(src.depthParam));
    this.deck.setSlotValue(4 + idx, (depth + 64) / 127, formatSignedDepth(depth));
  }

  public syncAll(): void {
    this.syncing = true;
    try {
      const vEl = this.deck.el.querySelector('[data-el="v-val"]');
      if (vEl) vEl.textContent = String(Math.max(1, Math.min(32, Math.round(WebBridge.getParam(ParamIdx.SoundNumVoices, 6))))).padStart(3, '0');
      this.syncStick();
      for (let k = 0; k < 4; ++k) this.syncMacroKnob(k);
      for (let i = 0; i < MOD_SOURCES.length; ++i) this.syncControllerSlot(i);
    } finally { this.syncing = false; }
  }

  public updateParam(idx: number, val: number): void {
    this.syncing = true;
    try {
      if (idx === ParamIdx.SoundNumVoices) {
        const vEl = this.deck.el.querySelector('[data-el="v-val"]');
        if (vEl) vEl.textContent = String(Math.max(1, Math.min(32, Math.round(val)))).padStart(3, '0');
      }
      for (let k = 0; k < 4; ++k) if (idx === NUKE_MACRO_DEFS[k].selectParamIdx || idx === this.resolveMacroParamIdx(k)) this.syncMacroKnob(k);
      if (idx >= ParamIdx.AftertouchDest && idx <= ParamIdx.ExpressionDepth) {
        MOD_SOURCES.forEach((s, i) => { if (idx === s.destParam || idx === s.depthParam) this.syncControllerSlot(i); });
      }
      this.syncStick();
    } finally { this.syncing = false; }
  }

  public destroy(): void { this.deck.destroy(); }
}
