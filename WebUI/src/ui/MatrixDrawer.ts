/**
 * ABDAxionikVS — MatrixDrawer.ts
 * Dedicated slide-out drawer (50vw) for:
 * 1. The 6 Real-Time MIDI Performance Controls ([413..424]) routed to all 63 modulation destinations (0..62)
 * 2. The 4 Hardware Macro Knobs ([425..428])
 * 3. The 6 × 4 Free Controllers Matrix ([363..410])
 */

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';

export const MOD_SOURCES = [
  { id: 1, name: 'Aftertouch (Channel Pressure)', destParam: 413, depthParam: 414, defaultDest: 61, defaultDepth: 40 },
  { id: 2, name: 'Modulation Wheel (MIDI CC 1)', destParam: 415, depthParam: 416, defaultDest: 59, defaultDepth: 55 },
  { id: 3, name: 'Breath Controller (MIDI CC 2)', destParam: 417, depthParam: 418, defaultDest: 56, defaultDepth: 0 },
  { id: 4, name: 'Continuous Controller 03 (MIDI CC 3)', destParam: 419, depthParam: 420, defaultDest: 57, defaultDepth: 0 },
  { id: 5, name: 'Foot Pedal (MIDI CC 4)', destParam: 421, depthParam: 422, defaultDest: 14, defaultDepth: 0 },
  { id: 6, name: 'Expression Pedal (MIDI CC 11)', destParam: 423, depthParam: 424, defaultDest: 0, defaultDepth: 63 },
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

export const FREE_CONTROLLER_GROUPS = [
  { name: 'Aftertouch Free [363..370]', baseDest: 363, baseDepth: 367 },
  { name: 'Controller 1 Up [371..378]', baseDest: 371, baseDepth: 375 },
  { name: 'Controller 1 Down [379..386]', baseDest: 379, baseDepth: 383 },
  { name: 'Controller 2 [387..394]', baseDest: 387, baseDepth: 391 },
  { name: 'Controller 3 [395..402]', baseDest: 395, baseDepth: 399 },
  { name: 'Controller 4 [403..410]', baseDest: 403, baseDepth: 407 },
];

export interface MatrixDrawerOptions {
  onClose: () => void;
  initialTab?: 'all' | 'midi' | 'controllers';
}

export class MatrixDrawer {
  static createContent(options: MatrixDrawerOptions): HTMLElement {
    const root = document.createElement('div');
    root.className = 'drawer-view-content';
    root.style.cssText = 'display: flex; flex-direction: column; height: 100%; box-sizing: border-box;';

    const buildDestOptions = (selectedId: number) =>
      ALL_63_MOD_DESTINATIONS.map((d) => `<option value="${d.id}" ${d.id === selectedId ? 'selected' : ''}>${d.label}</option>`).join('');

    const buildFreeDestOptions = (selectedVal: number) => {
      const isOff = selectedVal === 3000 || selectedVal === 0;
      let opts = `<option value="3000" ${isOff ? 'selected' : ''}>-- Off / None --</option>`;
      ALL_63_MOD_DESTINATIONS.forEach((d) => {
        const val = 3001 + d.id;
        const isSelected = selectedVal === val || selectedVal === d.id;
        opts += `<option value="${val}" ${isSelected ? 'selected' : ''}>${d.label}</option>`;
      });
      return opts;
    };

    const viewSectionItems = [
      { id: 'all', label: 'All Matrix' },
      { id: 'midi', label: '1. MIDI & Macros' },
      { id: 'controllers', label: '2. Free Controllers' },
    ];
    const viewSectionHtml = pillSelectorHtml(viewSectionItems, options.initialTab || 'all', {
      id: 'matrix-view-section-pills',
      size: 'sm',
      attrName: 'data-view',
    });

    let sourcesHtml = '';
    MOD_SOURCES.forEach((src) => {
      const curDest = Math.round(WebBridge.getParam(src.destParam, src.defaultDest));
      const curDepth = Math.round(WebBridge.getParam(src.depthParam, src.defaultDepth));

      sourcesHtml += `
        <div class="synth-panel-card" style="padding: var(--space-2) var(--space-3); display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="panel-badge" style="font-size: 10px;">${src.name}</span>
            <span class="hud-pill stat-num" style="font-size: 9px;">Dest [${src.destParam}] / Depth [${src.depthParam}]</span>
          </div>

          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <div style="display: flex; align-items: center; gap: 6px; flex: 1;">
              <span class="hud-label" style="font-size: 10px;">DESTINATION:</span>
              <select class="btn btn-xs btn-outline src-dest-select" data-param="${src.destParam}" style="flex: 1; height: 22px;">
                ${buildDestOptions(curDest)}
              </select>
            </div>

            <div style="display: flex; align-items: center; gap: 6px; width: 190px;">
              <span class="hud-label" style="font-size: 10px;">DEPTH [-64..+63]:</span>
              <input type="range" class="abd-slider src-depth-slider" data-param="${src.depthParam}" min="-64" max="63" value="${curDepth}" step="1" style="flex: 1;" />
              <span class="hud-value stat-num src-depth-val" style="width: 32px; text-align: right;">${curDepth}</span>
            </div>
          </div>
        </div>
      `;
    });

    // 4 Macro Knobs [425..428]
    let knobsHtml = '';
    for (let k = 0; k < 4; ++k) {
      const paramId = 425 + k;
      const curTarget = Math.round(WebBridge.getParam(paramId, k === 0 ? 61 : (k === 1 ? 56 : (k === 2 ? 32 : 62))));
      knobsHtml += `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span class="hud-label" style="font-size: 10px;">MACRO KNOB ${k + 1} [${paramId}]:</span>
          <select class="btn btn-xs btn-outline src-dest-select" data-param="${paramId}" style="height: 22px;">
            ${buildDestOptions(curTarget)}
          </select>
        </div>
      `;
    }

    // 6x4 Free Controllers [363..410]
    let freeCtrlHtml = '';
    FREE_CONTROLLER_GROUPS.forEach((grp) => {
      let slotsHtml = '';
      for (let s = 0; s < 4; ++s) {
        const destIdx = grp.baseDest + s;
        const dpIdx = grp.baseDepth + s;
        const curDestVal = Math.round(WebBridge.getParam(destIdx, 3000));
        const curDp = Math.round(WebBridge.getParam(dpIdx, 0));
        slotsHtml += `
          <div class="hud-pill" style="display: flex; flex-direction: column; gap: 4px; padding: var(--space-2); background: var(--color-bg-base, rgba(0,0,0,0.3)); border-radius: var(--radius-sm, 4px);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="hud-label" style="font-size: 9px; font-weight: 700;">SLOT ${s + 1} [${destIdx}]:</span>
              <span class="hud-value stat-num src-depth-val" style="font-size: 10px;">${curDp}</span>
            </div>
            <select class="btn btn-xs btn-outline src-dest-select" data-param="${destIdx}" style="height: 22px; font-size: 9px; width: 100%;">
              ${buildFreeDestOptions(curDestVal)}
            </select>
            <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
              <span class="hud-label" style="font-size: 8px;">DEPTH:</span>
              <input type="range" class="abd-slider src-depth-slider" data-param="${dpIdx}" min="-64" max="63" value="${curDp}" step="1" style="flex: 1;" />
            </div>
          </div>
        `;
      }
      freeCtrlHtml += `
        <div class="synth-panel-card" style="padding: var(--space-2) var(--space-3); display: flex; flex-direction: column; gap: 6px;">
          <span class="panel-caption" style="font-size: 10px; color: var(--color-accent); font-weight: 700;">${grp.name}</span>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2);">
            ${slotsHtml}
          </div>
        </div>
      `;
    });

    root.innerHTML = `
      <div class="drawer-header ndb-modal-header" style="flex-wrap: wrap; gap: var(--space-2);">
        <div class="drawer-title ndb-header-title" style="flex: 1; min-width: 240px;">
          <span class="drawer-icon">${ICONS.matrix}</span>
          <span class="ndb-title-text">MODULATION MATRIX</span>
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
        <!-- Bloque 1: Live MIDI Performance Controls & Macro Knobs -->
        <section id="block-midi-controls" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700; font-size: 11px; letter-spacing: 0.5px;">
            1. LIVE MIDI PERFORMANCE CONTROLS ([413..424]) & MACROS ([425..428])
          </div>
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            ${sourcesHtml}
          </div>

          <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2);">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700; font-size: 11px;">4 HARDWARE MACRO KNOBS ASSIGNMENT ([425..428])</span>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              ${knobsHtml}
            </div>
          </div>
        </section>

        <!-- Bloque 2: Free Controllers Matrix ([363..410]) -->
        <section id="block-free-controllers" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700; font-size: 11px; letter-spacing: 0.5px;">
            2. FREE CONTROLLERS MODULATION MATRIX (6 × 4 SLOTS, [363..410])
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

    root.querySelectorAll('.src-dest-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const target = e.currentTarget as HTMLSelectElement;
        const paramId = parseInt(target.getAttribute('data-param') || '0', 10);
        const destId = parseInt(target.value, 10);
        WebBridge.setParam(paramId, destId);
      });
    });

    root.querySelectorAll('.src-depth-slider').forEach((slider) => {
      slider.addEventListener('input', (e) => {
        const target = e.currentTarget as HTMLInputElement;
        const paramId = parseInt(target.getAttribute('data-param') || '0', 10);
        const val = parseFloat(target.value);
        const parent = target.parentElement;
        const valDisplay = parent?.querySelector('.src-depth-val');
        if (valDisplay) valDisplay.textContent = String(val);
        WebBridge.setParam(paramId, val);
      });
    });

    // ── Filtro / Navegación por pestañas (View Section) ─────
    const blockMidi = root.querySelector('#block-midi-controls') as HTMLElement | null;
    const blockFree = root.querySelector('#block-free-controllers') as HTMLElement | null;
    const viewSectionContainer = root.querySelector('#matrix-view-section-pills') as HTMLElement | null;
    const scrollContainer = root.querySelector('#matrix-scroll-body') as HTMLElement | null;

    const setFilter = (mode: 'all' | 'midi' | 'controllers', doScroll = false) => {
      const viewPills = viewSectionContainer?.querySelectorAll('[data-view]');
      viewPills?.forEach((p) => p.classList.toggle('active', p.getAttribute('data-view') === mode));

      if (mode === 'all') {
        if (blockMidi) blockMidi.style.display = 'flex';
        if (blockFree) blockFree.style.display = 'flex';
      } else if (mode === 'midi') {
        if (blockMidi) blockMidi.style.display = 'flex';
        if (blockFree) blockFree.style.display = 'none';
      } else if (mode === 'controllers') {
        if (blockMidi) blockMidi.style.display = 'none';
        if (blockFree) blockFree.style.display = 'flex';
      }

      if (doScroll && scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    };

    if (viewSectionContainer) {
      bindPillSelector(viewSectionContainer, (viewId) => {
        setFilter(viewId as 'all' | 'midi' | 'controllers', viewId !== 'all');
      }, 'data-view');
    }

    if (options.initialTab) {
      setFilter(options.initialTab, true);
    }

    return root;
  }
}
