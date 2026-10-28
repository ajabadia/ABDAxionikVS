/**
 * ABDAxionikVS — BlenderPanel.ts
 * Dedicated 1-unit hardware panel for Blender (Resynator 1 & 2 Fusion Engine).
 * Occupies col-span-1 in the bottom row.
 * 100% tokenized with @abdsynths/shared design tokens and Knob components.
 */

import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { Knob } from '@abdsynths/shared/components';
import { BLENDER_ALGORITHMS } from './BlenderDrawer.js';

export interface BlenderPanelOptions {
  onEdit?: () => void;
}

const ALGO_SHORT_NAMES = [
  'Mix', 'Chromo', 'Trans', 'Cross', 'Inter',
  'DynTrn', 'DynCrx', 'VelCrx', 'VelChr', 'Ring'
];

export class BlenderPanel {
  private container: HTMLElement;
  private options: BlenderPanelOptions;
  private rootEl: HTMLElement | null = null;

  // Knobs
  private lfoDepthKnob: Knob | null = null;
  private adsr1DepthKnob: Knob | null = null;
  private adsr2DepthKnob: Knob | null = null;
  private fourL4TDepthKnob: Knob | null = null;

  // Elements
  private curAlgoIdx: number = 0;
  private amountSlider: HTMLInputElement | null = null;
  private amountDisplay: HTMLElement | null = null;
  private lfoValEl: HTMLElement | null = null;
  private adsr1ValEl: HTMLElement | null = null;
  private adsr2ValEl: HTMLElement | null = null;
  private fourL4TValEl: HTMLElement | null = null;

  constructor(container: HTMLElement, options: BlenderPanelOptions = {}) {
    this.container = container;
    this.options = options;
    this.render();
  }

  private render(): void {
    this.curAlgoIdx = Math.max(0, Math.min(BLENDER_ALGORITHMS.length - 1, Math.round(WebBridge.getParam(ParamIdx.BlenderType, 0))));
    const initAmount = Math.round(WebBridge.getParam(ParamIdx.BlenderAmount, 0));
    const initLfo = Math.round(WebBridge.getParam(ParamIdx.BlenderLfoDepth, 0));
    const initAdsr1 = Math.round(WebBridge.getParam(ParamIdx.BlenderFreeADSR1Depth, 0));
    const initAdsr2 = Math.round(WebBridge.getParam(ParamIdx.BlenderFreeADSR2Depth, 0));
    const init4L4T = Math.round(WebBridge.getParam(ParamIdx.BlenderFree4L4TDepth, 0));

    // Columna 1 de algoritmos (0..4)
    const col1Html = BLENDER_ALGORITHMS.slice(0, 5).map((algo) => {
      const isCur = algo.id === this.curAlgoIdx;
      const shortName = ALGO_SHORT_NAMES[algo.id] || algo.name;
      return `<button type="button" class="btn btn-xs blender-algo-pill ${isCur ? 'btn-primary active' : 'btn-outline'}" data-algo-id="${algo.id}" title="${algo.name}: ${algo.desc}">${shortName}</button>`;
    }).join('');

    // Columna 2 de algoritmos (5..9)
    const col2Html = BLENDER_ALGORITHMS.slice(5, 10).map((algo) => {
      const isCur = algo.id === this.curAlgoIdx;
      const shortName = ALGO_SHORT_NAMES[algo.id] || algo.name;
      return `<button type="button" class="btn btn-xs blender-algo-pill ${isCur ? 'btn-primary active' : 'btn-outline'}" data-algo-id="${algo.id}" title="${algo.name}: ${algo.desc}">${shortName}</button>`;
    }).join('');

    this.rootEl = document.createElement('section');
    this.rootEl.className = 'synth-panel-card blender-panel-card';
    this.rootEl.innerHTML = `
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="stick-label">BLENDER</span>
          <span class="hud-pill" style="font-size: 8px; opacity: 0.7;">FUSION</span>
        </div>
        <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="btn btn-xs btn-outline" id="btn-edit-blender-panel" title="Open Expanded Blender & Slicer [261..270]">Edit</button>
          <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-bottom" title="Colapsar / Descolapsar fila">▾</button>
        </div>
      </div>

      <div class="panel-body blender-panel-body" data-collapse-body>
        <!-- Columnas verticales de selección de algoritmos (sin literales superiores) -->
        <div class="blender-columns-wrapper">
          <div class="blender-pills-col">
            ${col1Html}
          </div>
          <div class="blender-pills-col">
            ${col2Html}
          </div>
        </div>

        <!-- Panel lateral derecho: Crossfade R1/R2 y 4 Knobs de modulación -->
        <div class="blender-right-controls">
          <!-- Bipolar Crossfade R1 ◄► R2 -->
          <div class="blender-crossfade-box">
            <span class="blender-xfade-label">R1</span>
            <div class="blender-slider-wrapper">
              <input type="range" id="blender-crossfade-slider" class="abd-slider blender-crossfade-slider" min="-64" max="63" value="${initAmount}" step="1" title="Blender Amount: R1 (-64) to R2 (+63) [262]" />
            </div>
            <span class="blender-xfade-label">R2</span>
            <span class="hud-value stat-num blender-amount-num" id="blender-amount-display">${initAmount}</span>
          </div>

          <!-- 4 Knobs de modulación (2x2 grid) -->
          <div class="blender-knobs-2x2">
            <div class="blender-knob-cell">
              <div id="blender-knob-lfo"></div>
              <span class="blender-knob-val stat-num" id="blender-val-lfo">${initLfo}</span>
              <span class="blender-knob-lbl">LFO</span>
            </div>
            <div class="blender-knob-cell">
              <div id="blender-knob-adsr1"></div>
              <span class="blender-knob-val stat-num" id="blender-val-adsr1">${initAdsr1}</span>
              <span class="blender-knob-lbl">ADSR1</span>
            </div>
            <div class="blender-knob-cell">
              <div id="blender-knob-adsr2"></div>
              <span class="blender-knob-val stat-num" id="blender-val-adsr2">${initAdsr2}</span>
              <span class="blender-knob-lbl">ADSR2</span>
            </div>
            <div class="blender-knob-cell">
              <div id="blender-knob-4l4t"></div>
              <span class="blender-knob-val stat-num" id="blender-val-4l4t">${init4L4T}</span>
              <span class="blender-knob-lbl">4L4T</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    // Cache elements
    this.amountSlider = this.rootEl.querySelector('#blender-crossfade-slider');
    this.amountDisplay = this.rootEl.querySelector('#blender-amount-display');
    this.lfoValEl = this.rootEl.querySelector('#blender-val-lfo');
    this.adsr1ValEl = this.rootEl.querySelector('#blender-val-adsr1');
    this.adsr2ValEl = this.rootEl.querySelector('#blender-val-adsr2');
    this.fourL4TValEl = this.rootEl.querySelector('#blender-val-4l4t');

    // Attach listeners
    this.rootEl.querySelector('#btn-edit-blender-panel')?.addEventListener('click', () => {
      this.options.onEdit?.();
    });

    // Algoritmos buttons
    this.rootEl.querySelectorAll('button[data-algo-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const id = parseInt(target.getAttribute('data-algo-id') || '0', 10);
        this.selectAlgo(id);
      });
    });

    // Crossfade amount slider
    this.amountSlider?.addEventListener('input', () => {
      if (!this.amountSlider) return;
      const val = parseInt(this.amountSlider.value, 10);
      WebBridge.setParam(ParamIdx.BlenderAmount, val);
      if (this.amountDisplay) this.amountDisplay.textContent = String(val);
    });

    // Init Knobs
    this.initKnobs(initLfo, initAdsr1, initAdsr2, init4L4T);
  }

  private initKnobs(initLfo: number, initAdsr1: number, initAdsr2: number, init4L4T: number): void {
    // 1. LFO Depth
    const lfoMount = this.rootEl?.querySelector('#blender-knob-lfo') as HTMLElement | null;
    if (lfoMount) {
      this.lfoDepthKnob = new Knob(lfoMount, {
        size: 26,
        value: initLfo / 127.0,
        label: 'LFO',
        onChange: (normVal: number) => {
          const val = Math.round(normVal * 127.0);
          WebBridge.setParam(ParamIdx.BlenderLfoDepth, val);
          if (this.lfoValEl) this.lfoValEl.textContent = String(val);
        },
      });
    }

    // 2. ADSR 1 Depth
    const adsr1Mount = this.rootEl?.querySelector('#blender-knob-adsr1') as HTMLElement | null;
    if (adsr1Mount) {
      this.adsr1DepthKnob = new Knob(adsr1Mount, {
        size: 26,
        value: initAdsr1 / 127.0,
        label: 'ADSR1',
        onChange: (normVal: number) => {
          const val = Math.round(normVal * 127.0);
          WebBridge.setParam(ParamIdx.BlenderFreeADSR1Depth, val);
          if (this.adsr1ValEl) this.adsr1ValEl.textContent = String(val);
        },
      });
    }

    // 3. ADSR 2 Depth
    const adsr2Mount = this.rootEl?.querySelector('#blender-knob-adsr2') as HTMLElement | null;
    if (adsr2Mount) {
      this.adsr2DepthKnob = new Knob(adsr2Mount, {
        size: 26,
        value: initAdsr2 / 127.0,
        label: 'ADSR2',
        onChange: (normVal: number) => {
          const val = Math.round(normVal * 127.0);
          WebBridge.setParam(ParamIdx.BlenderFreeADSR2Depth, val);
          if (this.adsr2ValEl) this.adsr2ValEl.textContent = String(val);
        },
      });
    }

    // 4. 4L4T Depth
    const fourL4TMount = this.rootEl?.querySelector('#blender-knob-4l4t') as HTMLElement | null;
    if (fourL4TMount) {
      this.fourL4TDepthKnob = new Knob(fourL4TMount, {
        size: 26,
        value: init4L4T / 127.0,
        label: '4L4T',
        onChange: (normVal: number) => {
          const val = Math.round(normVal * 127.0);
          WebBridge.setParam(ParamIdx.BlenderFree4L4TDepth, val);
          if (this.fourL4TValEl) this.fourL4TValEl.textContent = String(val);
        },
      });
    }
  }

  public selectAlgo(id: number): void {
    this.curAlgoIdx = Math.max(0, Math.min(BLENDER_ALGORITHMS.length - 1, id));
    WebBridge.setParam(ParamIdx.BlenderType, this.curAlgoIdx);
    this.updateAlgoUi(this.curAlgoIdx);
  }

  public updateAlgoUi(id: number): void {
    this.curAlgoIdx = Math.max(0, Math.min(BLENDER_ALGORITHMS.length - 1, id));
    this.rootEl?.querySelectorAll('button[data-algo-id]').forEach((btn) => {
      const btnId = parseInt(btn.getAttribute('data-algo-id') || '0', 10);
      const isCur = btnId === this.curAlgoIdx;
      btn.classList.toggle('active', isCur);
      btn.classList.toggle('btn-primary', isCur);
      btn.classList.toggle('btn-outline', !isCur);
    });
  }

  public updateParam(idx: number, val: number): void {
    if (idx === ParamIdx.BlenderType) {
      this.updateAlgoUi(Math.round(val));
      return;
    }
    if (idx === ParamIdx.BlenderAmount) {
      const rounded = Math.round(val);
      if (this.amountSlider) this.amountSlider.value = String(rounded);
      if (this.amountDisplay) this.amountDisplay.textContent = String(rounded);
      return;
    }
    if (idx === ParamIdx.BlenderLfoDepth) {
      this.lfoDepthKnob?.setValue(val / 127.0, false);
      if (this.lfoValEl) this.lfoValEl.textContent = String(Math.round(val));
      return;
    }
    if (idx === ParamIdx.BlenderFreeADSR1Depth) {
      this.adsr1DepthKnob?.setValue(val / 127.0, false);
      if (this.adsr1ValEl) this.adsr1ValEl.textContent = String(Math.round(val));
      return;
    }
    if (idx === ParamIdx.BlenderFreeADSR2Depth) {
      this.adsr2DepthKnob?.setValue(val / 127.0, false);
      if (this.adsr2ValEl) this.adsr2ValEl.textContent = String(Math.round(val));
      return;
    }
    if (idx === ParamIdx.BlenderFree4L4TDepth) {
      this.fourL4TDepthKnob?.setValue(val / 127.0, false);
      if (this.fourL4TValEl) this.fourL4TValEl.textContent = String(Math.round(val));
      return;
    }
  }

  public updateAll(values: number[]): void {
    if (!Array.isArray(values) || values.length === 0) return;
    this.updateParam(ParamIdx.BlenderType, values[ParamIdx.BlenderType] ?? 0);
    this.updateParam(ParamIdx.BlenderAmount, values[ParamIdx.BlenderAmount] ?? 0);
    this.updateParam(ParamIdx.BlenderLfoDepth, values[ParamIdx.BlenderLfoDepth] ?? 0);
    this.updateParam(ParamIdx.BlenderFreeADSR1Depth, values[ParamIdx.BlenderFreeADSR1Depth] ?? 0);
    this.updateParam(ParamIdx.BlenderFreeADSR2Depth, values[ParamIdx.BlenderFreeADSR2Depth] ?? 0);
    this.updateParam(ParamIdx.BlenderFree4L4TDepth, values[ParamIdx.BlenderFree4L4TDepth] ?? 0);
  }

  public destroy(): void {
    this.lfoDepthKnob?.destroy();
    this.adsr1DepthKnob?.destroy();
    this.adsr2DepthKnob?.destroy();
    this.fourL4TDepthKnob?.destroy();
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.rootEl = null;
  }
}
