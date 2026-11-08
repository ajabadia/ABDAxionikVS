/**
 * ABDAxionikVS — NukeDrawer.ts
 * Top slide-down performance & macro control deck inspired by the Hartmann <NUKE> Remote Control Unit.
 *
 * Architectural & UX Principles:
 * - Slides down from below the top navbar (occupying ~90% width and leaving the bottom MIDI keyboard
 *   100% uncovered and playable at all times).
 * - 100% tokenized with @abdsynths/shared design tokens and components (TrajectoryStick2D, Knob,
 *   pillSelectorHtml, .synth-panel-card, .hud-pill, .abd-select__field). Zero hardcoded colors.
 * - Full bidirectional abstraction layer via WebBridge (snddat [0..444]):
 *   1. Voice Limit ([5] SoundNumVoices, 1..32).
 *   2. Central Multiplexed Vector Stick (TrajectoryStick2D) switchable across:
 *      - Engine: RESY 1 | RESY 2 | SILVER
 *      - Domain (for R1/R2): SPHERE | SCAPE (synced with R1Type [24] / R2Type [104])
 *      - Level: L1 | L2 | L3 (or FILT | FREQ | TIME in Silver, synced with [25], [105], [272])
 *   3. 4 Assignable Macro Knobs (Knob 1..4 Select [425..428]) with live rotary Knobs that directly
 *      control the selected destination parameter in real time.
 *   4. Bottom Console of 6 Physical Performance Controllers ([413..424]: Aftertouch, Modulation,
 *      Breath, CC 03, Foot, Expression) with destination selector (0..62) and bipolar Depth Knob (-64..+63).
 */

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { PARAM_DEFINITIONS } from '../generated/parameters.gen.js';
import { TrajectoryStick2D, type StickCoordinate, type StickLabels } from './TrajectoryStick2D.js';
import { MOD_SOURCES, getModDestinationLabel, resolveParamIndexFromModDest } from './MatrixDrawer.js';
import { getParameterSetStickLabels } from './stickLabels.js';

export { resolveParamIndexFromModDest };
import { MODEL_METADATA, getCanonicalModelName } from './NeuronCatalogMetadata.js';
import { Knob } from '@abdsynths/shared/components';
import { gestureFor, gestureForGroup, type ParamGestureHandlers } from './paramGesture.js';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';
import { onLocaleChange } from '../i18n/index.js';

export type NukeStickEngine = 'r1' | 'r2' | 'silver';
export type NukeStickDomain = 'sphere' | 'scape';

export interface NukeDrawerOptions {
  onToggleOpen?: (isOpen: boolean) => void;
  onLocalParamChange?: (index: number, value: number) => void;
  onEdit?: () => void;
}

interface MacroKnobBinding {
  selectParamIdx: number;
  defaultDestId: number;
  knobInstance: Knob | null;
  targetLabelEl: HTMLElement | null;
  valEl: HTMLElement | null;
}

interface ControllerSlotBinding {
  destParamIdx: number;
  depthParamIdx: number;
  defaultDestId: number;
  defaultDepth: number;
  targetLabelEl: HTMLElement | null;
  depthKnob: Knob | null;
  depthValEl: HTMLElement | null;
}

const SHORT_CTRL_NAMES = [
  'Aftertouch',
  'Modulation',
  'Breath',
  'CC 03',
  'Foot',
  'Expression',
];

export class NukeDrawer {
  private parent: HTMLElement;
  private options: NukeDrawerOptions;
  private panelEl: HTMLElement;
  private openState: boolean = false;

  // Stick target state
  private stickEngine: NukeStickEngine = 'r1';
  private stickDomain: NukeStickDomain = 'sphere';
  private stickLevel: 0 | 1 | 2 = 0;
  private centralStick: TrajectoryStick2D | null = null;
  /** Gesto abierto por el arrastre en curso del stick central (X e Y). */
  private stickGesture: ParamGestureHandlers | null = null;

  // Voice limit readout
  private voiceLimitValEl: HTMLElement | null = null;

  // 4 Macro Knobs [425..428]
  private macroBindings: MacroKnobBinding[] = [
    { selectParamIdx: ParamIdx.Knob1R1Select, defaultDestId: 61, knobInstance: null, targetLabelEl: null, valEl: null }, // Knob 1: Filter Cutoff [274]
    { selectParamIdx: ParamIdx.Knob2R1Select, defaultDestId: 56, knobInstance: null, targetLabelEl: null, valEl: null }, // Knob 2: Blender Mix [262]
    { selectParamIdx: ParamIdx.Knob3R1Select, defaultDestId: 32, knobInstance: null, targetLabelEl: null, valEl: null }, // Knob 3: Shaper A1 Attack [200]
    { selectParamIdx: ParamIdx.Knob4R1Select, defaultDestId: 62, knobInstance: null, targetLabelEl: null, valEl: null }, // Knob 4: Filter Resonance [275]
  ];

  // 6 Performance Controllers [413..424]
  private controllerBindings: ControllerSlotBinding[] = [];

  constructor(parent: HTMLElement, options: NukeDrawerOptions = {}) {
    this.parent = parent;
    this.options = options;

    this.panelEl = document.createElement('section');
    this.panelEl.className = 'nuke-top-drawer-panel synth-panel-card';
    this.panelEl.setAttribute('aria-label', 'NUKE Remote Control Unit');

    this.parent.appendChild(this.panelEl);

    this.render();

    onLocaleChange(() => {
      if (this.openState) {
        this.render();
      }
    });
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(): void {
    if (this.openState) return;
    this.openState = true;
    this.syncAll();
    this.panelEl.classList.add('is-open');
    this.options.onToggleOpen?.(true);
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.panelEl.classList.remove('is-open');
    this.options.onToggleOpen?.(false);
  }

  public toggle(): void {
    if (this.openState) {
      this.close();
    } else {
      this.open();
    }
  }

  private dispatchParam(index: number, value: number): void {
    WebBridge.setParam(index, value);
    this.options.onLocalParamChange?.(index, value);
  }

  private formatSignedDepth(val: number): string {
    const rounded = Math.round(val);
    const absStr = String(Math.abs(rounded)).padStart(2, '0');
    return rounded >= 0 ? `+${absStr}` : `-${absStr}`;
  }

  private render(): void {
    const enginePillsHtml = pillSelectorHtml(
      [
        { id: 'r1', label: 'Resys 1' },
        { id: 'r2', label: 'Resys 2' },
        { id: 'silver', label: 'Silver' },
      ],
      this.stickEngine,
      { id: 'nuke-engine-pills', size: 'xs', attrName: 'data-engine' }
    );

    const domainPillsHtml = pillSelectorHtml(
      [
        { id: 'sphere', label: 'Sphere' },
        { id: 'scape', label: 'Scape' },
      ],
      this.stickDomain,
      { id: 'nuke-domain-pills', size: 'xs', attrName: 'data-domain' }
    );

    const renderMacroCard = (knobNumber: 1 | 2 | 3 | 4, side: 'left' | 'right') => {
      const idx = knobNumber - 1;
      const binding = this.macroBindings[idx];
      const curDest = Math.round(WebBridge.getParam(binding.selectParamIdx, binding.defaultDestId));
      const targetName = getModDestinationLabel(curDest);

      return `
        <div class="synth-panel-card nuke-macro-card" data-macro-card="${knobNumber}">
          <div class="nuke-macro-card-body ${side === 'right' ? 'is-right' : 'is-left'}">
            <div class="synth-knob-cell">
              <div class="nuke-macro-knob-wrap" id="nuke-macro-knob-mount-${knobNumber}"></div>
              <span class="synth-knob-num stat-num" id="nuke-macro-val-${knobNumber}">0</span>
              <span class="synth-knob-title">KNOB ${knobNumber}</span>
            </div>
            <div class="nuke-macro-select-wrap">
              <span class="hud-pill nuke-target-label" id="nuke-macro-label-${knobNumber}" title="Knob ${knobNumber} Target Assignment [${binding.selectParamIdx}]: ${targetName}">${targetName}</span>
            </div>
          </div>
        </div>
      `;
    };

    // Build 6 Performance Controllers HTML ([413..424])
    this.controllerBindings = MOD_SOURCES.map((src, idx) => ({
      destParamIdx: src.destParam,
      depthParamIdx: src.depthParam,
      defaultDestId: src.defaultDest,
      defaultDepth: src.defaultDepth,
      targetLabelEl: null,
      depthKnob: null,
      depthValEl: null,
      shortName: SHORT_CTRL_NAMES[idx] || src.name,
    }));

    const controllersHtml = MOD_SOURCES.map((src, idx) => {
      const shortName = SHORT_CTRL_NAMES[idx] || src.name;
      const curDest = Math.round(WebBridge.getParam(src.destParam, src.defaultDest));
      const curDepth = Math.round(WebBridge.getParam(src.depthParam, src.defaultDepth));
      const targetName = getModDestinationLabel(curDest);

      return `
        <div class="synth-panel-card nuke-ctrl-card" data-ctrl-slot="${idx}">
          <div class="nuke-ctrl-header">
            <span class="stick-label" style="font-size: 10px;">${shortName.toUpperCase()}</span>
          </div>
          <div class="synth-knob-cell">
            <div id="nuke-ctrl-knob-mount-${idx}"></div>
            <span class="synth-knob-num stat-num" id="nuke-ctrl-depth-val-${idx}">${this.formatSignedDepth(curDepth)}</span>
            <span class="synth-knob-title">DEPTH</span>
          </div>
          <span class="hud-pill nuke-target-label" id="nuke-ctrl-label-${idx}" title="${src.name} Destination [${src.destParam}]: ${targetName}">${targetName}</span>
        </div>
      `;
    }).join('');

    const curVoices = Math.max(1, Math.min(32, Math.round(WebBridge.getParam(ParamIdx.SoundNumVoices, 6))));

    this.panelEl.innerHTML = `
      <div class="drawer-header nuke-drawer-header">
        <div style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
          <span class="panel-badge">&lt;NUKE&gt;</span>
          <span class="stick-label">REMOTE CONTROL UNIT</span>
          <span class="panel-caption">Interactive Vector Stick, 4 Macro Encoders &amp; 6 Performance Controllers</span>
        </div>

        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <!-- Voice Limit Control (Top-Left in original Remote view) -->
          <div class="hud-pill nuke-voice-limit-pill" title="Polyphony Voice Limit (SoundNumVoices [5])">
            <span class="hud-label">VOICE LIMIT:</span>
            <button type="button" class="btn btn-xs btn-outline" id="btn-nuke-voices-dec" title="Decrease Voice Limit">−</button>
            <span class="hud-value stat-num" id="nuke-voice-limit-val">${String(curVoices).padStart(3, '0')}</span>
            <button type="button" class="btn btn-xs btn-outline" id="btn-nuke-voices-inc" title="Increase Voice Limit">+</button>
          </div>

          <button type="button" class="btn btn-xs btn-outline" id="btn-edit-nuke-macros" title="Edit <NUKE> Macro Knobs &amp; Performance Controllers Routing">
            Edit
          </button>

          <button type="button" class="btn btn-xs btn-outline btn-close-drawer ndb-close-btn" id="btn-close-nuke-drawer" title="Close NUKE Remote">
            ${ICONS.close} Close
          </button>
        </div>
      </div>

      <div class="nuke-drawer-body">
        <!-- Upper Section: 4 Macro Knobs + Central Multiplexed <NUKE> Vector Stick -->
        <div class="nuke-main-deck">
          <!-- Left Wing: Knob 2 (top) & Knob 1 (bottom) -->
          <div class="nuke-wing-col">
            ${renderMacroCard(2, 'left')}
            ${renderMacroCard(1, 'left')}
          </div>

          <!-- Center Diamond/Hub: Central <NUKE> Stick & Target Switcher -->
          <div class="synth-panel-card nuke-center-hub">
            <div class="nuke-hub-toolbar">
              <div class="nuke-hub-selector-group">
                <span class="hud-label" style="font-size: 9px;">TARGET:</span>
                ${enginePillsHtml}
              </div>
              <div class="nuke-hub-selector-group" id="nuke-domain-group">
                <span class="hud-label" style="font-size: 9px;">MODE:</span>
                ${domainPillsHtml}
              </div>
              <span class="hud-pill stat-num" id="nuke-active-target-badge" style="font-size: 9.5px;">#511 sinew</span>
            </div>

            <div class="nuke-central-stick-mount" id="nuke-central-stick-mount"></div>
          </div>

          <!-- Right Wing: Knob 3 (top) & Knob 4 (bottom) -->
          <div class="nuke-wing-col">
            ${renderMacroCard(3, 'right')}
            ${renderMacroCard(4, 'right')}
          </div>
        </div>

        <!-- Lower Section: 6 Performance Controllers Strip ([413..424]) -->
        <div class="nuke-controllers-section">
          <div class="nuke-controllers-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="panel-badge" style="font-size: 10px;">CONTROLLERS</span>
              <span class="panel-caption" style="font-size: 10px;">Real-Time Performance Modulation Routing &amp; Bipolar Depth [413..424]</span>
            </div>
            <button type="button" class="btn btn-xs btn-outline" id="btn-edit-nuke-controllers" title="Edit Performance Controllers Routing">
              Edit
            </button>
          </div>
          <div class="nuke-controllers-grid">
            ${controllersHtml}
          </div>
        </div>
      </div>
    `;

    this.voiceLimitValEl = this.panelEl.querySelector('#nuke-voice-limit-val');

    // Edit buttons (open slide-out drawer focused on <NUKE> Macro Knobs & Performance Controllers)
    this.panelEl.querySelector('#btn-edit-nuke-macros')?.addEventListener('click', () => {
      this.options.onEdit?.();
    });
    this.panelEl.querySelector('#btn-edit-nuke-controllers')?.addEventListener('click', () => {
      this.options.onEdit?.();
    });

    // Close button
    this.panelEl.querySelector('#btn-close-nuke-drawer')?.addEventListener('click', () => this.close());

    // Voice limit stepper buttons
    this.panelEl.querySelector('#btn-nuke-voices-dec')?.addEventListener('click', () => {
      const cur = Math.round(WebBridge.getParam(ParamIdx.SoundNumVoices, 6));
      const next = Math.max(1, cur - 1);
      this.dispatchParam(ParamIdx.SoundNumVoices, next);
      this.updateVoiceLimitUI(next);
    });
    this.panelEl.querySelector('#btn-nuke-voices-inc')?.addEventListener('click', () => {
      const cur = Math.round(WebBridge.getParam(ParamIdx.SoundNumVoices, 6));
      const next = Math.min(32, cur + 1);
      this.dispatchParam(ParamIdx.SoundNumVoices, next);
      this.updateVoiceLimitUI(next);
    });

    // Engine & Domain pill selectors for the central stick
    const engineGroup = this.panelEl.querySelector('#nuke-engine-pills') as HTMLElement | null;
    if (engineGroup) {
      bindPillSelector(
        engineGroup,
        (engineId) => {
          this.setStickTarget(engineId as NukeStickEngine, this.stickDomain);
        },
        'data-engine'
      );
    }

    const domainGroup = this.panelEl.querySelector('#nuke-domain-pills') as HTMLElement | null;
    if (domainGroup) {
      bindPillSelector(
        domainGroup,
        (domainId) => {
          const dom = domainId as NukeStickDomain;
          if (this.stickEngine === 'r1') {
            this.dispatchParam(ParamIdx.R1Type, dom === 'scape' ? 1 : 0);
          } else if (this.stickEngine === 'r2') {
            this.dispatchParam(ParamIdx.R2Type, dom === 'scape' ? 1 : 0);
          }
          this.setStickTarget(this.stickEngine, dom);
        },
        'data-domain'
      );
    }

    // Mount Central Stick, 4 Macro Knobs, and 6 Controller Knobs
    this.initCentralStick();
    this.initMacroKnobs();
    this.initControllerSlots();
    this.syncAll();
  }

  private initCentralStick(): void {
    const mount = this.panelEl.querySelector('#nuke-central-stick-mount') as HTMLElement | null;
    if (!mount) return;

    this.centralStick = new TrajectoryStick2D(mount, {
      label: 'NUKE ORB',
      variant: 'nuke-orb',
      numLayers: 3,
      layerNames: ['L1', 'L2', 'L3'],
      initialLayer: 0,
      showHeader: true,
      showLayers: true,
      readout: true,
      hasRecorder: true,
      springReturn: false,
      labelsPerLayer: getParameterSetStickLabels(0, 'sphere'),
      onLayerChange: (layerIdx) => {
        this.stickLevel = (layerIdx as 0 | 1 | 2);
        if (this.stickEngine === 'r1') {
          this.dispatchParam(ParamIdx.R1ParamLevel, layerIdx);
        } else if (this.stickEngine === 'r2') {
          this.dispatchParam(ParamIdx.R2ParamLevel, layerIdx);
        } else {
          this.dispatchParam(ParamIdx.SilverParamLevel, layerIdx);
        }
        this.syncCentralStickLabelsAndPositions();
      },
      onPositionChange: (layerIdx, coord) => {
        this.handleCentralStickMove(layerIdx as 0 | 1 | 2, coord);
      },
      // Un arrastre del orbe mueve dos parámetros a la vez: se abre un gesto
      // por eje sobre la capa activa y se cierra todo al soltar.
      onDragStart: () => {
        const layer = (this.centralStick?.activeLayer ?? this.stickLevel) as 0 | 1 | 2;
        this.stickGesture = gestureForGroup(
          this.resolveStickXYParams(this.stickEngine, this.stickDomain, layer),
        );
        this.stickGesture.onDragStart();
      },
      onDragEnd: () => {
        this.stickGesture?.onDragEnd();
        this.stickGesture = null;
      },
    });
  }

  private setStickTarget(engine: NukeStickEngine, domain: NukeStickDomain): void {
    this.stickEngine = engine;
    this.stickDomain = domain;

    // Update pill visual active states
    this.panelEl.querySelectorAll('#nuke-engine-pills [data-engine]').forEach((btn) => {
      const isCur = btn.getAttribute('data-engine') === engine;
      btn.classList.toggle('active', isCur);
      btn.setAttribute('aria-pressed', String(isCur));
    });
    this.panelEl.querySelectorAll('#nuke-domain-pills [data-domain]').forEach((btn) => {
      const isCur = btn.getAttribute('data-domain') === domain;
      btn.classList.toggle('active', isCur);
      btn.setAttribute('aria-pressed', String(isCur));
    });

    const domainGroupWrap = this.panelEl.querySelector('#nuke-domain-group') as HTMLElement | null;
    if (domainGroupWrap) {
      domainGroupWrap.style.opacity = engine === 'silver' ? '0.35' : '1';
      domainGroupWrap.style.pointerEvents = engine === 'silver' ? 'none' : 'auto';
    }

    this.syncCentralStickLabelsAndPositions();
  }

  private getSilverLabelsForLayer(layerIdx: number): StickLabels {
    if (layerIdx === 0) {
      return { north: '▲ RESO +', south: '▼ RESO -', west: '◀ CUT -', east: 'CUT + ▶' };
    }
    if (layerIdx === 1) {
      const curFreqFx = Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 0));
      if (curFreqFx === 2) return { north: '▲ MIX +', south: '▼ MIX -', west: '◀ FREQ -', east: 'FREQ + ▶' };
      if (curFreqFx === 1) return { north: '▲ PRE +', south: '▼ PRE -', west: '◀ DRV -', east: 'DRV + ▶' };
      if (curFreqFx === 3) return { north: '▲ MIX +', south: '▼ MIX -', west: '◀ S&H -', east: 'S&H + ▶' };
      return { north: '▲ PAR 2 +', south: '▼ PAR 2 -', west: '◀ PAR 1 -', east: 'PAR 1 + ▶' };
    }
    const curTimeFx = Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 0));
    if (curTimeFx === 1) return { north: '▲ FDBK +', south: '▼ FDBK -', west: '◀ TIME -', east: 'TIME + ▶' };
    if (curTimeFx === 4) return { north: '▲ DEP +', south: '▼ DEP -', west: '◀ MIX -', east: 'MIX + ▶' };
    return { north: '▲ PAR 2 +', south: '▼ PAR 2 -', west: '◀ PAR 1 -', east: 'PAR 1 + ▶' };
  }

  private resolveStickXYParams(engine: NukeStickEngine, domain: NukeStickDomain, layerIdx: number): [number, number] {
    if (engine === 'r1') {
      if (domain === 'scape') {
        if (layerIdx === 0) return [ParamIdx.R1L1Scape1Value, ParamIdx.R1L1Scape2Value];
        if (layerIdx === 1) return [ParamIdx.R1L2Scape1Value, ParamIdx.R1L2Scape2Value];
        return [ParamIdx.R1L3Scape1Value, ParamIdx.R1L3Scape2Value];
      } else {
        if (layerIdx === 0) return [ParamIdx.R1L1Sphere1Value, ParamIdx.R1L1Sphere2Value];
        if (layerIdx === 1) return [ParamIdx.R1L2Sphere1Value, ParamIdx.R1L2Sphere2Value];
        return [ParamIdx.R1L3Sphere1Value, ParamIdx.R1L3Sphere2Value];
      }
    }
    if (engine === 'r2') {
      if (domain === 'scape') {
        if (layerIdx === 0) return [ParamIdx.R2L1Scape1Value, ParamIdx.R2L1Scape2Value];
        if (layerIdx === 1) return [ParamIdx.R2L2Scape1Value, ParamIdx.R2L2Scape2Value];
        return [ParamIdx.R2L3Scape1Value, ParamIdx.R2L3Scape2Value];
      } else {
        if (layerIdx === 0) return [ParamIdx.R2L1Sphere1Value, ParamIdx.R2L1Sphere2Value];
        if (layerIdx === 1) return [ParamIdx.R2L2Sphere1Value, ParamIdx.R2L2Sphere2Value];
        return [ParamIdx.R2L3Sphere1Value, ParamIdx.R2L3Sphere2Value];
      }
    }
    // Silver
    if (layerIdx === 0) {
      return [ParamIdx.FilterFreq, ParamIdx.FilterReso];
    }
    if (layerIdx === 1) {
      const curFreqFx = Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 0));
      if (curFreqFx === 2) return [314, 310];
      if (curFreqFx === 1) return [306, 307];
      if (curFreqFx === 3) return [325, 324];
      return [ParamIdx.FilterFreq, ParamIdx.FilterReso];
    }
    const curTimeFx = Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 0));
    if (curTimeFx === 1) return [333, 336];
    if (curTimeFx === 4) return [352, 353];
    return [331, 332];
  }

  private handleCentralStickMove(layerIdx: 0 | 1 | 2, coord: StickCoordinate): void {
    const [paramX, paramY] = this.resolveStickXYParams(this.stickEngine, this.stickDomain, layerIdx);
    const rawX = Math.round(coord.x * 127.0);
    const rawY = Math.round(coord.y * 127.0);
    this.dispatchParam(paramX, rawX);
    this.dispatchParam(paramY, rawY);
  }

  private syncCentralStickLabelsAndPositions(): void {
    if (!this.centralStick) return;

    const badgeEl = this.panelEl.querySelector('#nuke-active-target-badge');
    if (this.stickEngine === 'r1' || this.stickEngine === 'r2') {
      const isR1 = this.stickEngine === 'r1';
      const slot = Math.round(WebBridge.getParam(isR1 ? ParamIdx.R1ModellIndex : ParamIdx.R2ModellIndex, 511));
      const modelName = getCanonicalModelName(slot);
      const meta = MODEL_METADATA[slot];
      const parSet = meta ? meta[0] : (slot % 10);

      if (badgeEl) {
        badgeEl.textContent = `${isR1 ? 'R1' : 'R2'} • ${this.stickDomain.toUpperCase()} • #${String(slot).padStart(3, '0')} ${modelName}`;
      }

      const labels = getParameterSetStickLabels(parSet, this.stickDomain);
      this.centralStick.setAllLayerLabels(labels);
    } else {
      if (badgeEl) {
        badgeEl.textContent = `SILVER • ${this.stickLevel === 0 ? 'FILTER' : (this.stickLevel === 1 ? 'FREQ FX' : 'TIME FX')}`;
      }
      this.centralStick.setAllLayerLabels([
        this.getSilverLabelsForLayer(0),
        this.getSilverLabelsForLayer(1),
        this.getSilverLabelsForLayer(2),
      ]);
    }

    // Update 3 layers positions from current parameter values
    const stickMount = this.panelEl.querySelector('#nuke-central-stick-mount') as HTMLElement | null;
    if (stickMount) {
      const [activeX, activeY] = this.resolveStickXYParams(this.stickEngine, this.stickDomain, this.stickLevel);
      stickMount.setAttribute('data-param-x', String(activeX));
      stickMount.setAttribute('data-param-y', String(activeY));
    }
    if (!(this.centralStick as any).isDragging) {
      for (let l = 0; l < 3; ++l) {
        const [px, py] = this.resolveStickXYParams(this.stickEngine, this.stickDomain, l);
        const vx = Math.max(0, Math.min(1, WebBridge.getParam(px, 64) / 127.0));
        const vy = Math.max(0, Math.min(1, WebBridge.getParam(py, 64) / 127.0));
        this.centralStick.setPosition(l, vx, vy, false);
      }
    }
  }

  private initMacroKnobs(): void {
    for (let k = 0; k < 4; ++k) {
      const knobNum = k + 1;
      const binding = this.macroBindings[k];
      binding.targetLabelEl = this.panelEl.querySelector(`#nuke-macro-label-${knobNum}`) as HTMLElement | null;
      binding.valEl = this.panelEl.querySelector(`#nuke-macro-val-${knobNum}`) as HTMLElement | null;
      const mountEl = this.panelEl.querySelector(`#nuke-macro-knob-mount-${knobNum}`) as HTMLElement | null;

      if (mountEl) {
        let gestureParam = -1;
        binding.knobInstance = new Knob(mountEl, {
          size: 38,
          value: 0.5,
          label: `KNOB ${knobNum}`,
          // El destino lo elige el selector de al lado: el gesto se abre sobre el
          // parámetro que gobierna el mando en el momento de agarrarlo.
          onDragStart: () => {
            const destId = Math.round(WebBridge.getParam(binding.selectParamIdx, binding.defaultDestId));
            // Se cierra el parametro agarrado, aunque el selector cambie a mitad.
            gestureParam = resolveParamIndexFromModDest(destId);
            WebBridge.beginGesture(gestureParam);
          },
          onDragEnd: () => {
            if (gestureParam >= 0) WebBridge.endGesture(gestureParam);
          },
          onChange: (normVal: number) => {
            const curDestId = Math.round(WebBridge.getParam(binding.selectParamIdx, binding.defaultDestId));
            const targetParamIdx = resolveParamIndexFromModDest(curDestId);
            const def = PARAM_DEFINITIONS[targetParamIdx];
            const min = def ? def.min : 0;
            const max = def ? def.max : 127;
            const rawVal = Math.round(min + normVal * (max - min));
            this.dispatchParam(targetParamIdx, rawVal);
            if (binding.valEl) {
              binding.valEl.textContent = String(rawVal);
            }
          },
        });
      }
    }
  }

  private syncSingleMacroKnob(k: number): void {
    const binding = this.macroBindings[k];
    if (!binding) return;
    const curDestId = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(binding.selectParamIdx, binding.defaultDestId))));
    const targetName = getModDestinationLabel(curDestId);
    if (binding.targetLabelEl) {
      binding.targetLabelEl.textContent = targetName;
      binding.targetLabelEl.title = `Knob ${k + 1} Target Assignment [${binding.selectParamIdx}]: ${targetName}`;
    }

    const targetParamIdx = resolveParamIndexFromModDest(curDestId);
    const mountEl = this.panelEl.querySelector(`#nuke-macro-knob-mount-${k + 1}`) as HTMLElement | null;
    mountEl?.setAttribute('data-param-index', String(targetParamIdx));
    const def = PARAM_DEFINITIONS[targetParamIdx];
    const min = def ? def.min : 0;
    const max = def ? def.max : 127;
    const defVal = def ? def.defaultValue : 64;
    const curVal = Math.round(WebBridge.getParam(targetParamIdx, defVal));
    const norm = max > min ? Math.max(0, Math.min(1, (curVal - min) / (max - min))) : 0.5;

    binding.knobInstance?.setValue(norm, false);
    if (binding.valEl) {
      binding.valEl.textContent = String(curVal);
    }
  }

  private initControllerSlots(): void {
    this.controllerBindings.forEach((slot, idx) => {
      slot.targetLabelEl = this.panelEl.querySelector(`#nuke-ctrl-label-${idx}`) as HTMLElement | null;
      slot.depthValEl = this.panelEl.querySelector(`#nuke-ctrl-depth-val-${idx}`) as HTMLElement | null;
      const mountEl = this.panelEl.querySelector(`#nuke-ctrl-knob-mount-${idx}`) as HTMLElement | null;

      if (mountEl) {
        mountEl.setAttribute('data-param-index', String(slot.depthParamIdx));
        const initDepth = Math.round(WebBridge.getParam(slot.depthParamIdx, slot.defaultDepth));
        const initNorm = Math.max(0, Math.min(1, (initDepth + 64) / 127.0));
        slot.depthKnob = new Knob(mountEl, {
          size: 38,
          value: initNorm,
          bipolar: true,
          ...gestureFor(slot.depthParamIdx),
          onChange: (normVal: number) => {
            const rawDepth = Math.max(-64, Math.min(63, Math.round(normVal * 127.0 - 64.0)));
            this.dispatchParam(slot.depthParamIdx, rawDepth);
            if (slot.depthValEl) {
              slot.depthValEl.textContent = this.formatSignedDepth(rawDepth);
            }
          },
        });
      }
    });
  }

  private updateVoiceLimitUI(voices: number): void {
    const safe = Math.max(1, Math.min(32, Math.round(voices)));
    if (this.voiceLimitValEl) {
      this.voiceLimitValEl.textContent = String(safe).padStart(3, '0');
    }
  }

  public syncAll(): void {
    this.updateVoiceLimitUI(WebBridge.getParam(ParamIdx.SoundNumVoices, 6));
    this.syncCentralStickLabelsAndPositions();

    for (let k = 0; k < 4; ++k) {
      this.syncSingleMacroKnob(k);
    }

    this.controllerBindings.forEach((slot) => {
      const curDest = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(slot.destParamIdx, slot.defaultDestId))));
      const curDepth = Math.max(-64, Math.min(63, Math.round(WebBridge.getParam(slot.depthParamIdx, slot.defaultDepth))));
      if (slot.targetLabelEl) {
        slot.targetLabelEl.textContent = getModDestinationLabel(curDest);
      }
      slot.depthKnob?.setValue((curDepth + 64) / 127.0, false);
      if (slot.depthValEl) {
        slot.depthValEl.textContent = this.formatSignedDepth(curDepth);
      }
    });
  }

  public updateParam(idx: number, val: number): void {
    if (idx === ParamIdx.SoundNumVoices) {
      this.updateVoiceLimitUI(val);
    }

    // Update Macro Knobs if either the selector [425..428] or its mapped target parameter changed
    for (let k = 0; k < 4; ++k) {
      const binding = this.macroBindings[k];
      const curDestId = Math.round(WebBridge.getParam(binding.selectParamIdx, binding.defaultDestId));
      const targetParamIdx = resolveParamIndexFromModDest(curDestId);
      if (idx === binding.selectParamIdx || idx === targetParamIdx) {
        this.syncSingleMacroKnob(k);
      }
    }

    // Update 6 Performance Controllers [413..424]
    if (idx >= ParamIdx.AftertouchDest && idx <= ParamIdx.ExpressionDepth) {
      this.controllerBindings.forEach((slot) => {
        if (idx === slot.destParamIdx && slot.targetLabelEl) {
          slot.targetLabelEl.textContent = getModDestinationLabel(Math.round(val));
        } else if (idx === slot.depthParamIdx) {
          const clamped = Math.max(-64, Math.min(63, Math.round(val)));
          slot.depthKnob?.setValue((clamped + 64) / 127.0, false);
          if (slot.depthValEl) {
            slot.depthValEl.textContent = this.formatSignedDepth(clamped);
          }
        }
      });
    }

    // Update central stick if model, type, level, or active XY parameter changed
    this.syncCentralStickLabelsAndPositions();
  }
}
