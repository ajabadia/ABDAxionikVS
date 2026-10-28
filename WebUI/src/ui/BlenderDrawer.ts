/**
 * ABDAxionikVS — BlenderDrawer.ts
 * Dedicated slide-out drawer (50vw) for Blender fusion algorithms & Slicer modulation.
 * 100% tokenized with @abdsynths/shared button and slider components.
 * Fully hydrated with live state and persistence from WebBridge.
 */

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';
import { Knob } from '@abdsynths/shared/components/knob.js';

export const BLENDER_ALGORITHMS = [
  { id: 0, name: 'Mix', desc: 'Linear volume crossfade between Resynator 1 and 2' },
  { id: 1, name: 'Chromophonic', desc: 'R1 pitch and harmonic structure with R2 timbral envelope' },
  { id: 2, name: 'Transsphere', desc: 'Cross-synthesis: Scape excitation of R1 with Sphere body of R2' },
  { id: 3, name: 'Crossmorph', desc: 'Continuous morphing across all model parameters with harmonic intermod' },
  { id: 4, name: 'Intermorph', desc: 'Non-linear morphing with resonant intermediate band emphasis' },
  { id: 5, name: 'Dyn Transsphere', desc: 'Transsphere governed dynamically by amplitude envelope' },
  { id: 6, name: 'Dyn Crossmorph', desc: 'Crossmorph governed dynamically by envelope follower' },
  { id: 7, name: 'Velo Crossmorph', desc: 'Morphing crossfade controlled by note strike velocity' },
  { id: 8, name: 'Velo Chrome', desc: 'Chromophonic spectral blend controlled by note velocity' },
  { id: 9, name: 'Ring Blend', desc: 'Phase/amplitude ring modulation crossfaded with linear sum' },
];

export const SLICER_WAVEFORMS = [
  'Sine', 'Triangle', 'Saw Up', 'Saw Down', 'Square', 'Pos. Sine',
  'Pos. Triangle', 'Pos. Square', 'Step 4', 'Random S&H', 'Random Smooth', 'Impulse'
];

export interface BlenderDrawerOptions {
  onClose: () => void;
}

export class BlenderDrawer {
  static createContent(options: BlenderDrawerOptions): HTMLElement {
    const root = document.createElement('div');
    root.className = 'drawer-view-content';
    root.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-4); height: 100%;';

    // 1. Rehidratar estado real de los parámetros
    const curBlenderType = Math.round(WebBridge.getParam(ParamIdx.BlenderType, 0));
    const curAmount = Math.round(WebBridge.getParam(ParamIdx.BlenderAmount, 0));
    const curLfoDepth = Math.round(WebBridge.getParam(ParamIdx.BlenderLfoDepth, 0));
    const curAdsr1 = Math.round(WebBridge.getParam(ParamIdx.BlenderFreeADSR1Depth, 0));
    const curAdsr2 = Math.round(WebBridge.getParam(ParamIdx.BlenderFreeADSR2Depth, 0));
    const cur4l4t = Math.round(WebBridge.getParam(ParamIdx.BlenderFree4L4TDepth, 0));

    const curSlicerType = Math.round(WebBridge.getParam(ParamIdx.SlicerSwitchType, 0));
    const curSlicerDepth = Math.round(WebBridge.getParam(ParamIdx.SlicerDepth, 64));
    const curSlicerRate = Math.round(WebBridge.getParam(ParamIdx.SlicerRate, 66));
    const curSlicerWave = Math.round(WebBridge.getParam(ParamIdx.SlicerWaveForm, 0));

    const algoItems = BLENDER_ALGORITHMS.map((a) => ({
      id: String(a.id),
      label: `${a.id}: ${a.name}`,
      title: a.desc,
    }));
    const algoPillsHtml = pillSelectorHtml(algoItems, String(curBlenderType), {
      id: 'blender-algo-group',
      size: 'xs',
      attrName: 'data-algo',
    });

    const slicerTypeItems = [
      { id: '0', label: '0: Off' },
      { id: '1', label: '1: 2D Vertical' },
      { id: '2', label: '2: 3D Spatial' },
    ];
    const slicerTypeHtml = pillSelectorHtml(slicerTypeItems, String(curSlicerType), {
      id: 'slicer-type-group',
      size: 'xs',
      attrName: 'data-type',
    });

    const waveItems = SLICER_WAVEFORMS.map((w, idx) => ({
      id: String(idx),
      label: w,
    }));
    const wavePillsHtml = pillSelectorHtml(waveItems, String(curSlicerWave), {
      id: 'slicer-wave-group',
      size: 'xs',
      attrName: 'data-wave',
    });

    const renderKnobCell = (mountId: string, valId: string, initialVal: number, unit = '', subLabel = '') => `
      <div class="drawer-knob-cell" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <div id="${mountId}"></div>
        <span class="hud-value stat-num" id="${valId}" style="font-size: 11px;">${initialVal}${unit ? ' ' + unit : ''}</span>
        ${subLabel ? `<span style="font-size: 8.5px; color: var(--color-text-muted); font-weight: 600; letter-spacing: 0.5px;">${subLabel}</span>` : ''}
      </div>
    `;

    root.innerHTML = `
      <div class="drawer-header">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="panel-badge">BLENDER & SLICER</span>
          <span class="panel-caption">Resynator 1 & 2 Fusion Engine [261..270]</span>
        </div>
        <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-blender-drawer" title="Close (Esc)">${ICONS.close}</button>
      </div>

      <div class="drawer-scroll-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); padding-right: 4px;">
        <!-- Card 1: Blender Fusion Engine -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="panel-badge">FUSION ALGORITHM</span>
              <span class="panel-caption" id="blender-algo-desc">${BLENDER_ALGORITHMS[curBlenderType]?.desc || ''}</span>
            </div>
            <span class="hud-pill stat-num">Param 261</span>
          </div>

          ${algoPillsHtml}

          <!-- Blender Amount & Modulations Knobs -->
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-3) 0 var(--space-1) 0; background: var(--color-panel-surface); border-radius: var(--radius-sm); border: 1px solid var(--color-panel-border-dim);">
            ${renderKnobCell('b-amount-mount', 'b-amount-val', curAmount, '', 'R1 ◀ ▶ R2')}
            ${renderKnobCell('b-lfo-depth-mount', 'b-lfo-depth-val', curLfoDepth)}
            ${renderKnobCell('b-adsr1-depth-mount', 'b-adsr1-depth-val', curAdsr1)}
            ${renderKnobCell('b-adsr2-depth-mount', 'b-adsr2-depth-val', curAdsr2)}
            ${renderKnobCell('b-4l4t-depth-mount', 'b-4l4t-depth-val', cur4l4t)}
          </div>
        </div>

        <!-- Card 2: Slicer Engine -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="panel-badge">SLICER ENGINE</span>
              <span class="panel-caption">Rhythmic Chopper & Spatial Modulator [267..270]</span>
            </div>
            ${slicerTypeHtml}
          </div>

          <!-- Slicer Knobs: Rate [269] y Depth [268] -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); justify-items: center; align-items: start; gap: var(--space-4); max-width: 280px; margin: 0 auto; padding: var(--space-3) 0 var(--space-1) 0; background: var(--color-panel-surface); border-radius: var(--radius-sm); border: 1px solid var(--color-panel-border-dim); width: 100%;">
            ${renderKnobCell('s-rate-mount', 's-rate-val', curSlicerRate)}
            ${renderKnobCell('s-depth-mount', 's-depth-val', curSlicerDepth)}
          </div>

          <div>
            <div class="hud-label" style="margin-bottom: 6px;">LFO WAVEFORM [270]:</div>
            ${wavePillsHtml}
          </div>
        </div>
      </div>
    `;

    // Events
    root.querySelector('#btn-close-blender-drawer')?.addEventListener('click', () => {
      options.onClose();
    });

    // Blender algorithm buttons
    const blenderAlgoContainer = root.querySelector('#blender-algo-group') as HTMLElement | null;
    if (blenderAlgoContainer) {
      bindPillSelector(blenderAlgoContainer, (algoStr, btn) => {
        const algo = parseInt(algoStr || '0', 10);
        WebBridge.setParam(ParamIdx.BlenderType, algo);
        blenderAlgoContainer.querySelectorAll('.abd-pill, .ndb-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const descEl = root.querySelector('#blender-algo-desc');
        if (descEl) descEl.textContent = BLENDER_ALGORITHMS[algo]?.desc || '';
      }, 'data-algo');
    }

    // Slicer mode buttons
    const slicerTypeContainer = root.querySelector('#slicer-type-group') as HTMLElement | null;
    if (slicerTypeContainer) {
      bindPillSelector(slicerTypeContainer, (typeStr, btn) => {
        const type = parseInt(typeStr || '0', 10);
        WebBridge.setParam(ParamIdx.SlicerSwitchType, type);
        slicerTypeContainer.querySelectorAll('.abd-pill, .ndb-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      }, 'data-type');
    }

    // Slicer wave buttons
    const slicerWaveContainer = root.querySelector('#slicer-wave-group') as HTMLElement | null;
    if (slicerWaveContainer) {
      bindPillSelector(slicerWaveContainer, (waveStr, btn) => {
        const wave = parseInt(waveStr || '0', 10);
        WebBridge.setParam(ParamIdx.SlicerWaveForm, wave);
        slicerWaveContainer.querySelectorAll('.abd-pill, .ndb-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      }, 'data-wave');
    }

    // Helper para inicialización de Knobs
    const initKnob = (
      mountId: string,
      label: string,
      initVal: number,
      min: number,
      max: number,
      paramId: number,
      valId: string,
      isBipolar = false,
      unit = ''
    ) => {
      const mount = root.querySelector(`#${mountId}`);
      if (!mount) return;
      const range = max - min;
      const normInit = range > 0 ? (initVal - min) / range : 0;
      const valEl = root.querySelector(`#${valId}`);

      new Knob(mount as HTMLElement, {
        size: 40,
        label,
        value: normInit,
        bipolar: isBipolar,
        onChange: (normVal: number) => {
          const actualVal = Math.round(min + normVal * range);
          WebBridge.setParam(paramId, actualVal);
          if (valEl) valEl.textContent = `${actualVal}${unit ? ' ' + unit : ''}`;
        },
      });
    };

    // Card 1 Knobs: Blender Fusion
    initKnob('b-amount-mount', 'AMOUNT [262]', curAmount, -64, 63, ParamIdx.BlenderAmount, 'b-amount-val', true);
    initKnob('b-lfo-depth-mount', 'LFO DEP [263]', curLfoDepth, -64, 63, ParamIdx.BlenderLfoDepth, 'b-lfo-depth-val', true);
    initKnob('b-adsr1-depth-mount', 'ADSR 1 [264]', curAdsr1, -64, 63, ParamIdx.BlenderFreeADSR1Depth, 'b-adsr1-depth-val', true);
    initKnob('b-adsr2-depth-mount', 'ADSR 2 [265]', curAdsr2, -64, 63, ParamIdx.BlenderFreeADSR2Depth, 'b-adsr2-depth-val', true);
    initKnob('b-4l4t-depth-mount', '4L4T [266]', cur4l4t, 0, 127, ParamIdx.BlenderFree4L4TDepth, 'b-4l4t-depth-val', false);

    // Card 2 Knobs: Slicer Engine
    initKnob('s-rate-mount', 'RATE [269]', curSlicerRate, 0, 200, ParamIdx.SlicerRate, 's-rate-val', false);
    initKnob('s-depth-mount', 'DEPTH [268]', curSlicerDepth, 0, 127, ParamIdx.SlicerDepth, 's-depth-val', false);

    return root;
  }
}
