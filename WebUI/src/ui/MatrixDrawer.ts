/**
 * ABDAxionikVS — MatrixDrawer.ts
 * Dedicated slide-out drawer (50vw) for:
 * 1. The 4 <NUKE> Hardware Macro Knobs ([425..428]) with live rotary Knobs + target dropdowns (0..62)
 * 2. The 6 Real-Time Performance Controllers ([413..424]: <NUKE> & Panel Control 1..3) with bipolar Depth Knobs + target dropdowns (0..62)
 * 3. The 6 × 4 Free Controllers Matrix ([363..410])
 */

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { PARAM_DEFINITIONS } from '../generated/parameters.gen.js';
import { Knob } from '@abdsynths/shared/components';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';
import { gestureFor } from './paramGesture.js';

export const MOD_SOURCES = [
  { id: 1, shortName: 'AFTERTOUCH', subLabel: 'Channel Pressure', name: 'Aftertouch (Channel Pressure)', destParam: 413, depthParam: 414, defaultDest: 61, defaultDepth: 40 },
  { id: 2, shortName: 'MODULATION', subLabel: 'Control 1 · CC 01', name: 'Control 1 · Modulation Wheel (MIDI CC 1)', destParam: 415, depthParam: 416, defaultDest: 59, defaultDepth: 55 },
  { id: 3, shortName: 'BREATH', subLabel: 'Control 2 · CC 02', name: 'Control 2 · Breath Controller (MIDI CC 2)', destParam: 417, depthParam: 418, defaultDest: 56, defaultDepth: 0 },
  { id: 4, shortName: 'CC 03', subLabel: 'Control 3 · CC 03', name: 'Control 3 · Continuous Controller 03 (MIDI CC 3)', destParam: 419, depthParam: 420, defaultDest: 57, defaultDepth: 0 },
  { id: 5, shortName: 'FOOT', subLabel: 'Foot Pedal · CC 04', name: 'Foot Pedal (MIDI CC 4)', destParam: 421, depthParam: 422, defaultDest: 14, defaultDepth: 0 },
  { id: 6, shortName: 'EXPRESSION', subLabel: 'Expression · CC 11', name: 'Expression Pedal (MIDI CC 11)', destParam: 423, depthParam: 424, defaultDest: 0, defaultDepth: 63 },
];

export const ALL_63_MOD_DESTINATIONS = [
  { id: 0, label: '0: R1 Volume [27]' },
  { id: 1, label: '1: R1 Semitones [34]' },
  { id: 2, label: '2: R1 L1 Scape X [52]' },
  { id: 3, label: '3: R1 L1 Scape Y [53]' },
  { id: 4, label: '4: R1 L1 Sphere X [42]' },
  { id: 5, label: '5: R1 L1 Sphere Y [43]' },
  { id: 6, label: '6: R1 L2 Scape X [72]' },
  { id: 7, label: '7: R1 L2 Scape Y [73]' },
  { id: 8, label: '8: R1 L2 Sphere X [62]' },
  { id: 9, label: '9: R1 L2 Sphere Y [63]' },
  { id: 10, label: '10: R1 L3 Scape X [92]' },
  { id: 11, label: '11: R1 L3 Scape Y [93]' },
  { id: 12, label: '12: R1 L3 Sphere X [82]' },
  { id: 13, label: '13: R1 L3 Sphere Y [83]' },
  { id: 14, label: '14: R2 Volume [107]' },
  { id: 15, label: '15: R2 Semitones [114]' },
  { id: 16, label: '16: R2 L1 Scape X [132]' },
  { id: 17, label: '17: R2 L1 Scape Y [133]' },
  { id: 18, label: '18: R2 L1 Sphere X [122]' },
  { id: 19, label: '19: R2 L1 Sphere Y [123]' },
  { id: 20, label: '20: R2 L2 Scape X [152]' },
  { id: 21, label: '21: R2 L2 Scape Y [153]' },
  { id: 22, label: '22: R2 L2 Sphere X [142]' },
  { id: 23, label: '23: R2 L2 Sphere Y [143]' },
  { id: 24, label: '24: R2 L3 Scape X [172]' },
  { id: 25, label: '25: R2 L3 Scape Y [173]' },
  { id: 26, label: '26: R2 L3 Sphere X [162]' },
  { id: 27, label: '27: R2 L3 Sphere Y [163]' },
  { id: 28, label: '28: R1 ResEnv Attack [182]' },
  { id: 29, label: '29: R1 ResEnv Decay [183]' },
  { id: 30, label: '30: R1 ResEnv Sustain [184]' },
  { id: 31, label: '31: R1 ResEnv Release [185]' },
  { id: 32, label: '32: R1 AmpEnv Attack [200]' },
  { id: 33, label: '33: R1 AmpEnv Decay [201]' },
  { id: 34, label: '34: R1 AmpEnv Sustain [202]' },
  { id: 35, label: '35: R1 AmpEnv Release [203]' },
  { id: 36, label: '36: R1 FreeEnv Attack [205]' },
  { id: 37, label: '37: R1 FreeEnv Decay [206]' },
  { id: 38, label: '38: R1 FreeEnv Sustain [207]' },
  { id: 39, label: '39: R1 FreeEnv Release [208]' },
  { id: 40, label: '40: R2 ResEnv Attack [212]' },
  { id: 41, label: '41: R2 ResEnv Decay [213]' },
  { id: 42, label: '42: R2 ResEnv Sustain [214]' },
  { id: 43, label: '43: R2 ResEnv Release [215]' },
  { id: 44, label: '44: R2 AmpEnv Attack [230]' },
  { id: 45, label: '45: R2 AmpEnv Decay [231]' },
  { id: 46, label: '46: R2 AmpEnv Sustain [232]' },
  { id: 47, label: '47: R2 AmpEnv Release [233]' },
  { id: 48, label: '48: R2 FreeEnv Attack [235]' },
  { id: 49, label: '49: R2 FreeEnv Decay [236]' },
  { id: 50, label: '50: R2 FreeEnv Sustain [237]' },
  { id: 51, label: '51: R2 FreeEnv Release [238]' },
  { id: 52, label: '52: FilterEnv Attack [355]' },
  { id: 53, label: '53: FilterEnv Decay [356]' },
  { id: 54, label: '54: FilterEnv Sustain [357]' },
  { id: 55, label: '55: FilterEnv Release [358]' },
  { id: 56, label: '56: Blender Amount [262]' },
  { id: 57, label: '57: Slicer Depth [268]' },
  { id: 58, label: '58: Slicer Rate [269]' },
  { id: 59, label: '59: LFO Depth [257]' },
  { id: 60, label: '60: LFO Rate [258]' },
  { id: 61, label: '61: Filter Cutoff [274]' },
  { id: 62, label: '62: Filter Resonance [275]' },
];

export function getModDestinationLabel(destId: number): string {
  if (destId === 3000 || destId === undefined || destId === null) return 'Off';
  const normId = destId >= 3001 ? destId - 3001 : destId;
  const found = ALL_63_MOD_DESTINATIONS.find((d) => d.id === normId);
  if (!found) return 'Off';
  return found.label.replace(/^\d+:\s*/, '').replace(/\s*\[\d+\]$/, '');
}

/**
 * Extracts the authoritative snddat parameter index [0..444] from a 0..62 modulation destination ID.
 */
export function resolveParamIndexFromModDest(destId: number): number {
  const safeDest = Math.max(0, Math.min(62, Math.round(destId)));
  const entry = ALL_63_MOD_DESTINATIONS.find((d) => d.id === safeDest);
  if (entry) {
    const m = entry.label.match(/\[(\d+)\]$/);
    if (m) {
      return parseInt(m[1], 10);
    }
  }
  const fromDef = PARAM_DEFINITIONS.find((d) => d.modDestIdx === safeDest);
  return fromDef ? fromDef.index : ParamIdx.FilterFreq;
}

export const FREE_CONTROLLER_GROUPS = [
  { name: 'Aftertouch (Channel Pressure) — 4 Free Slots [363..370]', shortGroup: 'AFTERTOUCH', baseDest: 363, baseDepth: 367 },
  { name: 'Control 1 Stick Up (+Y / CC 01) — 4 Free Slots [371..378]', shortGroup: 'CTRL 1 UP', baseDest: 371, baseDepth: 375 },
  { name: 'Control 1 Stick Down (−Y) — 4 Free Slots [379..386]', shortGroup: 'CTRL 1 DOWN', baseDest: 379, baseDepth: 383 },
  { name: 'Control 2 Wheel (CC 02) — 4 Free Slots [387..394]', shortGroup: 'CTRL 2 WHEEL', baseDest: 387, baseDepth: 391 },
  { name: 'Control 3 Wheel (CC 03) — 4 Free Slots [395..402]', shortGroup: 'CTRL 3 WHEEL', baseDest: 395, baseDepth: 399 },
  { name: 'Controller 4 / Foot & Aux (CC 04) — 4 Free Slots [403..410]', shortGroup: 'CTRL 4 AUX', baseDest: 403, baseDepth: 407 },
];

export type MatrixTabId = 'all' | 'macros' | 'controllers' | 'free';

export interface MatrixDrawerOptions {
  onClose: () => void;
  initialTab?: MatrixTabId;
}

const MACRO_DEFAULTS = [61, 56, 32, 62]; // Knob 1..4 default destinations

function formatSignedDepth(val: number): string {
  const rounded = Math.round(val);
  const absStr = String(Math.abs(rounded)).padStart(2, '0');
  return rounded >= 0 ? `+${absStr}` : `-${absStr}`;
}

export class MatrixDrawer {
  static createContent(options: MatrixDrawerOptions): HTMLElement {
    const root = document.createElement('div');
    root.className = 'drawer-view-content';
    root.style.cssText = 'display: flex; flex-direction: column; height: 100%; box-sizing: border-box;';

    const buildCleanDestOptions = (selectedId: number) =>
      ALL_63_MOD_DESTINATIONS.map((d) => {
        const cleanLabel = d.label.replace(/^\d+:\s*/, '').replace(/\s*\[\d+\]$/, '');
        return `<option value="${d.id}" title="${d.label}" ${d.id === selectedId ? 'selected' : ''}>${cleanLabel}</option>`;
      }).join('');

    const buildFreeDestOptions = (selectedVal: number) => {
      const isOff = selectedVal === 3000 || selectedVal === 0;
      let opts = `<option value="3000" ${isOff ? 'selected' : ''}>-- Off / None --</option>`;
      ALL_63_MOD_DESTINATIONS.forEach((d) => {
        const val = 3001 + d.id;
        const isSelected = selectedVal === val || selectedVal === d.id;
        const cleanLabel = d.label.replace(/^\d+:\s*/, '').replace(/\s*\[\d+\]$/, '');
        opts += `<option value="${val}" title="${d.label}" ${isSelected ? 'selected' : ''}>${cleanLabel}</option>`;
      });
      return opts;
    };

    const viewSectionItems = [
      { id: 'all', label: 'All Matrix' },
      { id: 'macros', label: '1. <NUKE> Macros & Controllers' },
      { id: 'controllers', label: '2. Controllers & Free Matrix' },
      { id: 'free', label: '3. Free Matrix 6×4' },
    ];
    const viewSectionHtml = pillSelectorHtml(viewSectionItems, options.initialTab || 'all', {
      id: 'matrix-view-section-pills',
      size: 'sm',
      attrName: 'data-view',
    });

    // 1. 4 <NUKE> Assignable Macro Knobs [425..428] (Knob + Value above <select>)
    let knobsHtml = '';
    for (let k = 0; k < 4; ++k) {
      const knobNum = k + 1;
      const selectParamId = 425 + k;
      const curTargetDest = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(selectParamId, MACRO_DEFAULTS[k]))));
      const targetParamIdx = resolveParamIndexFromModDest(curTargetDest);
      const def = PARAM_DEFINITIONS[targetParamIdx];
      const defVal = def ? def.defaultValue : 64;
      const curVal = Math.round(WebBridge.getParam(targetParamIdx, defVal));

      knobsHtml += `
        <div class="synth-panel-card nuke-ctrl-card" data-matrix-macro="${k}" style="padding: var(--space-2); display: flex; flex-direction: column; align-items: center; gap: 6px;">
          <div class="nuke-ctrl-header" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
            <span class="stick-label" style="font-size: 10px;">MACRO KNOB ${knobNum}</span>
            <span class="hud-pill stat-num" style="font-size: 8.5px;">[${selectParamId}]</span>
          </div>
          <div class="synth-knob-cell">
            <div id="matrix-macro-knob-mount-${k}"></div>
            <span class="synth-knob-num stat-num" id="matrix-macro-val-${k}">${curVal}</span>
            <span class="synth-knob-title">KNOB ${knobNum}</span>
          </div>
          <select class="btn btn-xs btn-outline abd-select__field matrix-macro-select" id="matrix-macro-select-${k}" data-macro-idx="${k}" data-param="${selectParamId}" style="width: 100%; height: 22px;" title="Macro Knob ${knobNum} Target Parameter [${selectParamId}]">
            ${buildCleanDestOptions(curTargetDest)}
          </select>
        </div>
      `;
    }

    // 2. 6 Real-Time Performance Controllers ([413..424]: <NUKE> bottom strip & Panel Control 1..3)
    let sourcesHtml = '';
    MOD_SOURCES.forEach((src, idx) => {
      const curDest = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(src.destParam, src.defaultDest))));
      const curDepth = Math.max(-64, Math.min(63, Math.round(WebBridge.getParam(src.depthParam, src.defaultDepth))));

      sourcesHtml += `
        <div class="synth-panel-card nuke-ctrl-card" data-matrix-ctrl="${idx}" style="padding: var(--space-2); display: flex; flex-direction: column; align-items: center; gap: 6px;">
          <div class="nuke-ctrl-header" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
            <span class="stick-label" style="font-size: 10px;" title="${src.name}">${src.shortName}</span>
            <span class="hud-pill stat-num" style="font-size: 8.5px;" title="${src.subLabel}">${src.subLabel}</span>
          </div>
          <div class="synth-knob-cell">
            <div id="matrix-ctrl-knob-mount-${idx}"></div>
            <span class="synth-knob-num stat-num" id="matrix-ctrl-depth-val-${idx}">${formatSignedDepth(curDepth)}</span>
            <span class="synth-knob-title">DEPTH</span>
          </div>
          <select class="btn btn-xs btn-outline abd-select__field src-dest-select" id="matrix-ctrl-dest-${idx}" data-ctrl-idx="${idx}" data-param="${src.destParam}" style="width: 100%; height: 22px;" title="${src.name} Destination [${src.destParam}]">
            ${buildCleanDestOptions(curDest)}
          </select>
        </div>
      `;
    });

    // 3. 6x4 Free Controllers [363..410] (Same card + bipolar Knob + <select> aesthetic)
    let freeCtrlHtml = '';
    FREE_CONTROLLER_GROUPS.forEach((grp, gIdx) => {
      let slotsHtml = '';
      for (let s = 0; s < 4; ++s) {
        const destIdx = grp.baseDest + s;
        const dpIdx = grp.baseDepth + s;
        const curDestVal = Math.round(WebBridge.getParam(destIdx, 3000));
        const curDp = Math.max(-64, Math.min(63, Math.round(WebBridge.getParam(dpIdx, 0))));
        slotsHtml += `
          <div class="synth-panel-card nuke-ctrl-card" data-free-slot="${gIdx}-${s}" style="padding: var(--space-2); display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <div class="nuke-ctrl-header" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
              <span class="stick-label" style="font-size: 10px;">SLOT ${s + 1}</span>
              <span class="hud-pill stat-num" style="font-size: 8.5px;">[${destIdx}/${dpIdx}]</span>
            </div>
            <div class="synth-knob-cell">
              <div id="matrix-free-knob-mount-${gIdx}-${s}"></div>
              <span class="synth-knob-num stat-num" id="matrix-free-depth-val-${gIdx}-${s}">${formatSignedDepth(curDp)}</span>
              <span class="synth-knob-title">DEPTH</span>
            </div>
            <select class="btn btn-xs btn-outline abd-select__field src-dest-select" data-param="${destIdx}" style="width: 100%; height: 22px;" title="${grp.name} · Slot ${s + 1} Destination [${destIdx}]">
              ${buildFreeDestOptions(curDestVal)}
            </select>
          </div>
        `;
      }
      freeCtrlHtml += `
        <div class="synth-panel-card" style="padding: var(--space-2) var(--space-3); display: flex; flex-direction: column; gap: 6px;">
          <span class="panel-caption" style="font-size: 10px; color: var(--color-accent); font-weight: 700;">${grp.name}</span>
          <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2);">
            ${slotsHtml}
          </div>
        </div>
      `;
    });

    root.innerHTML = `
      <div class="drawer-header ndb-modal-header" style="flex-wrap: wrap; gap: var(--space-2);">
        <div class="drawer-title ndb-header-title" style="flex: 1; min-width: 240px;">
          <span class="drawer-icon">${ICONS.matrix}</span>
          <span class="ndb-title-text">&lt;NUKE&gt; MACROS, CONTROLLERS &amp; MODULATION MATRIX</span>
          <span class="panel-badge ndb-badge">[363..428]</span>
        </div>
        <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-matrix-drawer" title="Close (Esc)">${ICONS.close}</button>
      </div>

      <!-- Barra de navegación por pestañas (View Section) -->
      <div style="padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--color-panel-border-dim); background: var(--color-panel-surface); display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="hud-label" style="font-size: 11px;">VIEW SECTION:</span>
          ${viewSectionHtml}
        </div>
        <span class="hud-pill" style="font-size: 9px; opacity: 0.7;">63 MOD DESTINATIONS</span>
      </div>

      <div class="drawer-scroll-body" id="matrix-scroll-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3) var(--space-4);">
        <!-- Bloque 1: 4 <NUKE> Assignable Macro Knobs ([425..428]) -->
        <section id="block-macro-knobs" style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700; font-size: 11px; letter-spacing: 0.5px;">
              1. &lt;NUKE&gt; REMOTE — 4 ASSIGNABLE MACRO KNOBS ([425..428])
            </span>
            <span class="hud-label" style="font-size: 9.5px; opacity: 0.85;">
              Direct rotary control &amp; target parameter assignment (KNOB 1..4 in &lt;NUKE&gt;)
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2);">
            ${knobsHtml}
          </div>
        </section>

        <!-- Bloque 2: 6 Real-Time Performance Controllers (<NUKE> Bottom Console & Panel Control 1..3 [413..424]) -->
        <section id="block-midi-controls" style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700; font-size: 11px; letter-spacing: 0.5px;">
              2. REAL-TIME PERFORMANCE CONTROLLERS — &lt;NUKE&gt; &amp; PANEL CONTROL 1..3 ([413..424])
            </span>
            <span class="hud-label" style="font-size: 9.5px; opacity: 0.85;">
              Bipolar modulation depth (-64..+63) &amp; target destination (0..62)
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2);">
            ${sourcesHtml}
          </div>
        </section>

        <!-- Bloque 3: Free Controllers Matrix ([363..410]) -->
        <section id="block-free-controllers" style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700; font-size: 11px; letter-spacing: 0.5px;">
            3. FREE CONTROLLERS MODULATION MATRIX (6 × 4 SLOTS, [363..410])
          </div>
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            ${freeCtrlHtml}
          </div>
        </section>
      </div>
    `;

    root.querySelector('#btn-close-matrix-drawer')?.addEventListener('click', () => {
      options.onClose();
    });

    // Mount the 4 Macro Knobs (KNOB 1..4) and wire their <select> dropdowns
    const macroKnobs: (Knob | null)[] = [null, null, null, null];
    const syncMacroKnobCard = (k: number) => {
      const selectParamId = 425 + k;
      const curDestId = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(selectParamId, MACRO_DEFAULTS[k]))));
      const targetParamIdx = resolveParamIndexFromModDest(curDestId);
      const mountEl = root.querySelector(`#matrix-macro-knob-mount-${k}`) as HTMLElement | null;
      mountEl?.setAttribute('data-param-index', String(targetParamIdx));
      const def = PARAM_DEFINITIONS[targetParamIdx];
      const min = def ? def.min : 0;
      const max = def ? def.max : 127;
      const defVal = def ? def.defaultValue : 64;
      const curVal = Math.round(WebBridge.getParam(targetParamIdx, defVal));
      const norm = max > min ? Math.max(0, Math.min(1, (curVal - min) / (max - min))) : 0.5;
      macroKnobs[k]?.setValue(norm, false);
      const valEl = root.querySelector(`#matrix-macro-val-${k}`);
      if (valEl) valEl.textContent = String(curVal);
    };

    for (let k = 0; k < 4; ++k) {
      const knobNum = k + 1;
      const selectParamId = 425 + k;
      const mountEl = root.querySelector(`#matrix-macro-knob-mount-${k}`) as HTMLElement | null;
      const selectEl = root.querySelector(`#matrix-macro-select-${k}`) as HTMLSelectElement | null;

      if (mountEl) {
        let gestureParam = -1;
        macroKnobs[k] = new Knob(mountEl, {
          size: 38,
          value: 0.5,
          label: `KNOB ${knobNum}`,
          // El destino lo decide el selector de al lado: el gesto se abre sobre el
          // parámetro que el mando gobierna cuando se agarra.
          onDragStart: () => {
            const destId = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(selectParamId, MACRO_DEFAULTS[k]))));
            // Se cierra el parametro agarrado, aunque el selector cambie a mitad.
            gestureParam = resolveParamIndexFromModDest(destId);
            WebBridge.beginGesture(gestureParam);
          },
          onDragEnd: () => {
            if (gestureParam >= 0) WebBridge.endGesture(gestureParam);
          },
          onChange: (normVal: number) => {
            const curDestId = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(selectParamId, MACRO_DEFAULTS[k]))));
            const targetParamIdx = resolveParamIndexFromModDest(curDestId);
            const def = PARAM_DEFINITIONS[targetParamIdx];
            const min = def ? def.min : 0;
            const max = def ? def.max : 127;
            const rawVal = Math.round(min + normVal * (max - min));
            const valEl = root.querySelector(`#matrix-macro-val-${k}`);
            if (valEl) valEl.textContent = String(rawVal);
            WebBridge.setParam(targetParamIdx, rawVal);
          },
        });
        syncMacroKnobCard(k);
      }

      if (selectEl) {
        selectEl.addEventListener('change', () => {
          const newDestId = parseInt(selectEl.value || '0', 10);
          WebBridge.setParam(selectParamId, newDestId);
          syncMacroKnobCard(k);
        });
      }
    }

    // Mount the 6 Performance Controller Bipolar Depth Knobs ([414, 416, 418, 420, 422, 424])
    MOD_SOURCES.forEach((src, idx) => {
      const mountEl = root.querySelector(`#matrix-ctrl-knob-mount-${idx}`) as HTMLElement | null;
      const valEl = root.querySelector(`#matrix-ctrl-depth-val-${idx}`) as HTMLElement | null;
      if (mountEl) {
        mountEl.setAttribute('data-param-index', String(src.depthParam));
        const initDepth = Math.max(-64, Math.min(63, Math.round(WebBridge.getParam(src.depthParam, src.defaultDepth))));
        const initNorm = Math.max(0, Math.min(1, (initDepth + 64) / 127.0));
        new Knob(mountEl, {
          size: 38,
          value: initNorm,
          bipolar: true,
          ...gestureFor(src.depthParam),
          onChange: (normVal: number) => {
            const rawDepth = Math.max(-64, Math.min(63, Math.round(normVal * 127.0 - 64.0)));
            if (valEl) valEl.textContent = formatSignedDepth(rawDepth);
            WebBridge.setParam(src.depthParam, rawDepth);
          },
        });
      }
    });

    // Mount the 24 (6x4) Free Controller Bipolar Depth Knobs ([367..370, 375..378, 383..386, 391..394, 399..402, 407..410])
    FREE_CONTROLLER_GROUPS.forEach((grp, gIdx) => {
      for (let s = 0; s < 4; ++s) {
        const dpIdx = grp.baseDepth + s;
        const mountEl = root.querySelector(`#matrix-free-knob-mount-${gIdx}-${s}`) as HTMLElement | null;
        const valEl = root.querySelector(`#matrix-free-depth-val-${gIdx}-${s}`) as HTMLElement | null;
        if (mountEl) {
          mountEl.setAttribute('data-param-index', String(dpIdx));
          const initDepth = Math.max(-64, Math.min(63, Math.round(WebBridge.getParam(dpIdx, 0))));
          const initNorm = Math.max(0, Math.min(1, (initDepth + 64) / 127.0));
          new Knob(mountEl, {
            size: 38,
            value: initNorm,
            bipolar: true,
            ...gestureFor(dpIdx),
            onChange: (normVal: number) => {
              const rawDepth = Math.max(-64, Math.min(63, Math.round(normVal * 127.0 - 64.0)));
              if (valEl) valEl.textContent = formatSignedDepth(rawDepth);
              WebBridge.setParam(dpIdx, rawDepth);
            },
          });
        }
      }
    });

    // Destination selects for 6 Performance Controllers & 6x4 Free Matrix
    root.querySelectorAll('.src-dest-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const target = e.currentTarget as HTMLSelectElement;
        const paramId = parseInt(target.getAttribute('data-param') || '0', 10);
        const destId = parseInt(target.value, 10);
        WebBridge.setParam(paramId, destId);
      });
    });

    // ── Filtro / Navegación por pestañas (View Section) ─────
    const blockMidi = root.querySelector('#block-midi-controls') as HTMLElement | null;
    const blockMacros = root.querySelector('#block-macro-knobs') as HTMLElement | null;
    const blockFree = root.querySelector('#block-free-controllers') as HTMLElement | null;
    const viewSectionContainer = root.querySelector('#matrix-view-section-pills') as HTMLElement | null;
    const scrollContainer = root.querySelector('#matrix-scroll-body') as HTMLElement | null;

    const setFilter = (mode: MatrixTabId, doScroll = false) => {
      const viewPills = viewSectionContainer?.querySelectorAll('[data-view]');
      viewPills?.forEach((p) => p.classList.toggle('active', p.getAttribute('data-view') === mode));

      if (mode === 'all') {
        if (blockMacros) blockMacros.style.display = 'flex';
        if (blockMidi) blockMidi.style.display = 'flex';
        if (blockFree) blockFree.style.display = 'flex';
      } else if (mode === 'macros') {
        // Dedicated <NUKE> tab: shows BOTH the 4 <NUKE> Macro Knobs AND the 6 <NUKE> Performance Controllers!
        if (blockMacros) blockMacros.style.display = 'flex';
        if (blockMidi) blockMidi.style.display = 'flex';
        if (blockFree) blockFree.style.display = 'none';
      } else if (mode === 'controllers') {
        // Front-panel CONTROLLERS box is governed by both the 6 Performance Controllers ([413..424]) and the 6×4 Free Matrix ([363..410])
        if (blockMacros) blockMacros.style.display = 'none';
        if (blockMidi) blockMidi.style.display = 'flex';
        if (blockFree) blockFree.style.display = 'flex';
      } else if (mode === 'free') {
        if (blockMacros) blockMacros.style.display = 'none';
        if (blockMidi) blockMidi.style.display = 'none';
        if (blockFree) blockFree.style.display = 'flex';
      }

      if (doScroll && scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    };

    if (viewSectionContainer) {
      bindPillSelector(viewSectionContainer, (viewId) => {
        setFilter(viewId as MatrixTabId, viewId !== 'all');
      }, 'data-view');
    }

    if (options.initialTab) {
      setFilter(options.initialTab, true);
    }

    return root;
  }
}
