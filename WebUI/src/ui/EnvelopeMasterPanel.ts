/**
 * ABDAxionikVS — EnvelopeMasterPanel.ts
 * Dedicated 1-unit hardware panel for the central Envelope/Shaper section
 * of the original Hartmann Neuron synthesizer (Hardware Manual pages 105–108).
 *
 * Front panel card displays ONLY the core rotary controls:
 * - Master Free Envelope Depth: [ DEPTH ] (Param 251, 0..127)
 * - Velocity Modulation Depth: [ VELO ] (Param 252, -64..+63)
 * - Edit button: opens the comprehensive EnvelopeDrawer ([205..255])
 *   containing all detailed parameters: 4L/4T stages (L1..4, T1..4), Free ADSR 1 & 2,
 *   Layer Status (AMP / RES / FREE), Cycle (NORM / REP), and Routing Destinations.
 *
 * Occupies col-span-1 in the bottom row (between FILTER and MASTER).
 * 100% tokenized with @abdsynths/shared design tokens and Knob components.
 */

import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { Knob } from '@abdsynths/shared/components';

export interface EnvelopeMasterPanelOptions {
  onEdit?: () => void;
}

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

  constructor(container: HTMLElement, options: EnvelopeMasterPanelOptions = {}) {
    this.container = container;
    this.options = options;
    this.render();
  }

  private render(): void {
    const initDepth = Math.round(WebBridge.getParam(ParamIdx.TLFreeEnvDepth, 127));
    const initVelo = Math.round(WebBridge.getParam(ParamIdx.Free4Level4TimeVelocityDepth, 0));

    this.rootEl = document.createElement('section');
    this.rootEl.className = 'synth-panel-card env-master-card';
    this.rootEl.innerHTML = `
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="stick-label">ENV MASTER</span>
          <span class="hud-pill" style="font-size: 8px; opacity: 0.7;">SHAPER</span>
        </div>
        <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="btn btn-xs btn-outline" id="btn-edit-env-panel" title="Open Envelopes & Shapers Drawer">Edit</button>
          <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-bottom" title="Colapsar / Descolapsar fila">▾</button>
        </div>
      </div>

      <div class="panel-body env-master-body" data-collapse-body>
        <!-- Master Depth Knob (0..127) -->
        <div class="env-knob-wrapper">
          <div id="env-depth-knob-mount"></div>
          <span class="env-knob-num stat-num" id="env-depth-val">${initDepth}</span>
          <span class="env-knob-title">DEPTH</span>
        </div>

        <!-- Velocity Sensitivity Knob (-64..+63) -->
        <div class="env-knob-wrapper">
          <div id="env-velo-knob-mount"></div>
          <span class="env-knob-num stat-num" id="env-velo-val">${initVelo > 0 ? '+' + initVelo : initVelo}</span>
          <span class="env-knob-title">VELO</span>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    this.depthValEl = this.rootEl.querySelector('#env-depth-val');
    this.veloValEl = this.rootEl.querySelector('#env-velo-val');

    // Mount Knobs (Size 42px matching FilterPanel for perfect visual symmetry)
    const depthMount = this.rootEl.querySelector('#env-depth-knob-mount') as HTMLElement | null;
    if (depthMount) {
      this.depthKnob = new Knob(depthMount, {
        size: 42,
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
        size: 42,
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

    // Edit button click -> opens drawer
    this.rootEl.querySelector('#btn-edit-env-panel')?.addEventListener('click', () => {
      this.options.onEdit?.();
    });
  }

  public updateParam(idx: number, val: number): void {
    if (idx === ParamIdx.TLFreeEnvDepth) {
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
    }
  }

  public updateAll(values: number[] | Record<number, number>): void {
    const params = [
      ParamIdx.TLFreeEnvDepth,
      ParamIdx.Free4Level4TimeVelocityDepth,
    ];
    for (const idx of params) {
      const v = (values as Record<number, number>)[idx];
      if (v !== undefined) {
        this.updateParam(idx, v);
      }
    }
  }
}
