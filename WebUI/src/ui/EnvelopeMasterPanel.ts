/**
 * ABDAxionikVS — EnvelopeMasterPanel.ts
 * Dedicated 1-unit hardware panel for the central Envelope/Shaper section
 * of the original Hartmann Neuron synthesizer (Hardware Manual pages 105–108).
 *
 * Implements:
 * - Shaper 1/2 Status: [ AMP | RES | FREE ] (Param 253)
 * - Free Envelope Type: [ 2-ADSR | 4L/4T ] (Param 254)
 * - Free Envelope Mode: [ NORM | REP ] (Param 250)
 * - Free Envelope Master Depth: [ DEPTH ] (Param 251, 0..127)
 * - Velocity Modulation Depth: [ VELO ] (Param 252, -64..+63)
 * - Routing / Destination Select: [ R1 SCP | R1 SPH | R2 SCP | R2 SPH | BLEND | FILTER ] (Param 255)
 *
 * Occupies col-span-1 in the bottom row (between FILTER and MASTER).
 * 100% tokenized with @abdsynths/shared design tokens and Knob components.
 */

import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { Knob } from '@abdsynths/shared/components';

export interface EnvelopeMasterPanelOptions {
  onStatusChange?: (mode: 'amp' | 'res' | 'free') => void;
}

const DEST_TARGETS = [
  { id: 0, label: 'R1 SCP', title: 'Target: Resynator 1 Scape Contour' },
  { id: 1, label: 'R1 SPH', title: 'Target: Resynator 1 Sphere Contour' },
  { id: 2, label: 'R2 SCP', title: 'Target: Resynator 2 Scape Contour' },
  { id: 3, label: 'R2 SPH', title: 'Target: Resynator 2 Sphere Contour' },
  { id: 4, label: 'BLEND',  title: 'Target: Resynator Blender Amount' },
  { id: 5, label: 'FILTER', title: 'Target: Silver Filter Cutoff' },
];

export class EnvelopeMasterPanel {
  private container: HTMLElement;
  private options: EnvelopeMasterPanelOptions;
  private rootEl: HTMLElement | null = null;

  // Knobs
  private depthKnob: Knob | null = null;
  private veloKnob: Knob | null = null;

  // Readouts
  private depthValEl: HTMLElement | null = null;
  private veloValEl: HTMLElement | null = null;

  // State
  private curStatus: number = 0;   // 0: AMP, 1: RES, 2: FREE
  private curType: number = 0;     // 0: 2-ADSR, 1: 4L4T
  private curMode: number = 0;     // 0: NORM, 1: REP
  private curDest: number = 1;     // 0..5

  constructor(container: HTMLElement, options: EnvelopeMasterPanelOptions = {}) {
    this.container = container;
    this.options = options;
    this.render();
  }

  private render(): void {
    this.curStatus = Math.max(0, Math.min(2, Math.round(WebBridge.getParam(ParamIdx.Shaper12Status, 1))));
    this.curType = Math.max(0, Math.min(1, Math.round(WebBridge.getParam(ParamIdx.FreeEnvType, 0))));
    this.curMode = Math.max(0, Math.min(1, Math.round(WebBridge.getParam(ParamIdx.TLFreeEnvMode, 0))));
    this.curDest = Math.max(0, Math.min(5, Math.round(WebBridge.getParam(ParamIdx.ShaperResySelect, 1))));

    const initDepth = Math.round(WebBridge.getParam(ParamIdx.TLFreeEnvDepth, 127));
    const initVelo = Math.round(WebBridge.getParam(ParamIdx.Free4Level4TimeVelocityDepth, 0));

    // Status Pills HTML
    const statusPillsHtml = [
      { id: 0, label: 'AMP', code: 'amp' },
      { id: 1, label: 'RES', code: 'res' },
      { id: 2, label: 'FREE', code: 'free' },
    ].map((item) => {
      const active = this.curStatus === item.id ? 'active' : '';
      return `<button type="button" class="btn btn-xs env-status-pill ${active}" data-status-id="${item.id}" data-status-code="${item.code}">${item.label}</button>`;
    }).join('');

    // Type & Mode Pills HTML
    const typePillsHtml = `
      <div class="env-type-group" style="display: flex; gap: 2px;">
        <button type="button" class="btn btn-xs env-type-pill ${this.curType === 0 ? 'active' : ''}" data-type-id="0" title="Two independent ADSR envelopes (Shaper 1 & 2)">2-ADSR</button>
        <button type="button" class="btn btn-xs env-type-pill ${this.curType === 1 ? 'active' : ''}" data-type-id="1" title="Combined 4 Levels / 4 Times curve">4L/4T</button>
      </div>
    `;

    const modePillsHtml = `
      <div class="env-mode-group" style="display: flex; gap: 2px;">
        <button type="button" class="btn btn-xs env-mode-pill ${this.curMode === 0 ? 'active' : ''}" data-mode-id="0" title="One-shot envelope">NORM</button>
        <button type="button" class="btn btn-xs env-mode-pill ${this.curMode === 1 ? 'active' : ''}" data-mode-id="1" title="Looping repeat cycle (LFO effect)">REP</button>
      </div>
    `;

    // Destination 2x3 Grid HTML
    const destPillsHtml = DEST_TARGETS.map((t) => {
      const active = this.curDest === t.id ? 'active' : '';
      return `<button type="button" class="btn btn-xs env-dest-pill ${active}" data-dest-id="${t.id}" title="${t.title}">${t.label}</button>`;
    }).join('');

    this.rootEl = document.createElement('section');
    this.rootEl.className = 'synth-panel-card env-master-card';
    this.rootEl.innerHTML = `
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="stick-label">ENV MASTER</span>
          <span class="hud-pill" style="font-size: 8px; opacity: 0.7;">SHAPER</span>
        </div>
        <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-bottom" title="Colapsar / Descolapsar fila">▾</button>
        </div>
      </div>

      <div class="panel-body env-master-body" data-collapse-body>
        <!-- 1. Shaper Status Layer (AMP | RES | FREE) -->
        <div class="env-section-box">
          <div class="env-mini-header">
            <span class="env-mini-label">LAYER STATUS</span>
          </div>
          <div class="env-pills-row env-status-row">
            ${statusPillsHtml}
          </div>
        </div>

        <!-- 2. Type (2-ADSR / 4L4T) & Mode (NORM / REP) -->
        <div class="env-section-box env-type-mode-row">
          <div class="env-col-box">
            <span class="env-mini-label">FREE TYPE</span>
            ${typePillsHtml}
          </div>
          <div class="env-col-box">
            <span class="env-mini-label">CYCLE</span>
            ${modePillsHtml}
          </div>
        </div>

        <!-- 3. Master Knobs: DEPTH (0..127) & VELO (-64..+63) -->
        <div class="env-knobs-row">
          <div class="env-knob-wrapper">
            <div id="env-depth-knob-mount"></div>
            <span class="env-knob-num stat-num" id="env-depth-val">${initDepth}</span>
            <span class="env-knob-title">DEPTH</span>
          </div>
          <div class="env-knob-wrapper">
            <div id="env-velo-knob-mount"></div>
            <span class="env-knob-num stat-num" id="env-velo-val">${initVelo > 0 ? '+' + initVelo : initVelo}</span>
            <span class="env-knob-title">VELO</span>
          </div>
        </div>

        <!-- 4. Destination Targets (2x3 grid) -->
        <div class="env-section-box">
          <div class="env-mini-header">
            <span class="env-mini-label">FREE DESTINATION</span>
          </div>
          <div class="env-dest-grid">
            ${destPillsHtml}
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    this.depthValEl = this.rootEl.querySelector('#env-depth-val');
    this.veloValEl = this.rootEl.querySelector('#env-velo-val');

    // Mount Knobs
    const depthMount = this.rootEl.querySelector('#env-depth-knob-mount') as HTMLElement | null;
    if (depthMount) {
      this.depthKnob = new Knob(depthMount, {
        size: 30,
        value: initDepth / 127.0,
        label: 'DEPTH',
        onChange: (normVal: number) => {
          const val = Math.round(normVal * 127.0);
          WebBridge.setParam(ParamIdx.TLFreeEnvDepth, val);
          if (this.depthValEl) this.depthValEl.textContent = String(val);
        },
      });
    }

    const veloMount = this.rootEl.querySelector('#env-velo-knob-mount') as HTMLElement | null;
    if (veloMount) {
      // Bipolar (-64..+63) mapped to 0..1
      const normVelo = (initVelo + 64) / 127.0;
      this.veloKnob = new Knob(veloMount, {
        size: 30,
        value: Math.max(0, Math.min(1, normVelo)),
        label: 'VELO',
        onChange: (normVal: number) => {
          const val = Math.round(normVal * 127.0) - 64;
          WebBridge.setParam(ParamIdx.Free4Level4TimeVelocityDepth, val);
          if (this.veloValEl) {
            this.veloValEl.textContent = val > 0 ? `+${val}` : String(val);
          }
        },
      });
    }

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.rootEl) return;

    // Status pills click
    this.rootEl.querySelectorAll<HTMLButtonElement>('.env-status-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.statusId);
        const code = btn.dataset.statusCode as 'amp' | 'res' | 'free';
        this.curStatus = id;
        WebBridge.setParam(ParamIdx.Shaper12Status, id);
        this.updateStatusPills();
        this.options.onStatusChange?.(code);
      });
    });

    // Type pills click
    this.rootEl.querySelectorAll<HTMLButtonElement>('.env-type-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.typeId);
        this.curType = id;
        WebBridge.setParam(ParamIdx.FreeEnvType, id);
        this.updateTypePills();
      });
    });

    // Mode pills click
    this.rootEl.querySelectorAll<HTMLButtonElement>('.env-mode-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.modeId);
        this.curMode = id;
        WebBridge.setParam(ParamIdx.TLFreeEnvMode, id);
        this.updateModePills();
      });
    });

    // Destination pills click
    this.rootEl.querySelectorAll<HTMLButtonElement>('.env-dest-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.destId);
        this.curDest = id;
        WebBridge.setParam(ParamIdx.ShaperResySelect, id);
        this.updateDestPills();
      });
    });
  }

  private updateStatusPills(): void {
    this.rootEl?.querySelectorAll<HTMLButtonElement>('.env-status-pill').forEach((btn) => {
      const active = Number(btn.dataset.statusId) === this.curStatus;
      btn.classList.toggle('active', active);
    });
  }

  private updateTypePills(): void {
    this.rootEl?.querySelectorAll<HTMLButtonElement>('.env-type-pill').forEach((btn) => {
      const active = Number(btn.dataset.typeId) === this.curType;
      btn.classList.toggle('active', active);
    });
  }

  private updateModePills(): void {
    this.rootEl?.querySelectorAll<HTMLButtonElement>('.env-mode-pill').forEach((btn) => {
      const active = Number(btn.dataset.modeId) === this.curMode;
      btn.classList.toggle('active', active);
    });
  }

  private updateDestPills(): void {
    this.rootEl?.querySelectorAll<HTMLButtonElement>('.env-dest-pill').forEach((btn) => {
      const active = Number(btn.dataset.destId) === this.curDest;
      btn.classList.toggle('active', active);
    });
  }

  public updateParam(idx: number, val: number): void {
    if (idx === ParamIdx.Shaper12Status) {
      this.curStatus = Math.max(0, Math.min(2, Math.round(val)));
      this.updateStatusPills();
    } else if (idx === ParamIdx.FreeEnvType) {
      this.curType = Math.max(0, Math.min(1, Math.round(val)));
      this.updateTypePills();
    } else if (idx === ParamIdx.TLFreeEnvMode) {
      this.curMode = Math.max(0, Math.min(1, Math.round(val)));
      this.updateModePills();
    } else if (idx === ParamIdx.TLFreeEnvDepth) {
      const rounded = Math.round(val);
      this.depthKnob?.setValue(rounded / 127.0, false);
      if (this.depthValEl) this.depthValEl.textContent = String(rounded);
    } else if (idx === ParamIdx.Free4Level4TimeVelocityDepth) {
      const rounded = Math.round(val);
      const norm = (rounded + 64) / 127.0;
      this.veloKnob?.setValue(Math.max(0, Math.min(1, norm)), false);
      if (this.veloValEl) {
        this.veloValEl.textContent = rounded > 0 ? `+${rounded}` : String(rounded);
      }
    } else if (idx === ParamIdx.ShaperResySelect) {
      this.curDest = Math.max(0, Math.min(5, Math.round(val)));
      this.updateDestPills();
    }
  }

  public updateAll(values: Record<number, number>): void {
    const params = [
      ParamIdx.Shaper12Status,
      ParamIdx.FreeEnvType,
      ParamIdx.TLFreeEnvMode,
      ParamIdx.TLFreeEnvDepth,
      ParamIdx.Free4Level4TimeVelocityDepth,
      ParamIdx.ShaperResySelect,
    ];
    for (const idx of params) {
      if (values[idx] !== undefined) {
        this.updateParam(idx, values[idx]);
      }
    }
  }
}
