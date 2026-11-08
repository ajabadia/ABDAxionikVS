/**
 * ABDAxionikVS — FilterPanel.ts
 * Dedicated 1-unit hardware panel for the master Filter (Cutoff & Resonance).
 * Occupies col-span-1 in the bottom row.
 * 100% tokenized with @abdsynths/shared design tokens and Knob components.
 */

import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { Knob } from '@abdsynths/shared/components';
import { gestureFor } from './paramGesture.js';

export interface FilterPanelOptions {
  onEdit?: () => void;
}

export class FilterPanel {
  private container: HTMLElement;
  private options: FilterPanelOptions;
  private rootEl: HTMLElement | null = null;
  private cutKnob: Knob | null = null;
  private resoKnob: Knob | null = null;
  private cutValEl: HTMLElement | null = null;
  private resoValEl: HTMLElement | null = null;

  constructor(container: HTMLElement, options: FilterPanelOptions = {}) {
    this.container = container;
    this.options = options;
    this.render();
  }

  private render(): void {
    const initCut = Math.round(WebBridge.getParam(ParamIdx.FilterFreq, 100));
    const initReso = Math.round(WebBridge.getParam(ParamIdx.FilterReso, 25));

    this.rootEl = document.createElement('section');
    this.rootEl.className = 'synth-panel-card filter-panel-card';
    this.rootEl.innerHTML = `
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08)); gap: 2px;">
        <span class="stick-label">FILTER</span>
        <div class="panel-actions" style="display: flex; align-items: center; gap: 2px;">
          <button type="button" class="btn btn-xs btn-outline" id="btn-edit-filter-panel" title="Open Filter & Silver Rack">Edit</button>
        </div>
      </div>

      <div class="panel-body filter-panel-body" data-collapse-body>
        <div class="synth-knob-cell">
          <div id="filter-panel-cut-mount" data-param-index="${ParamIdx.FilterFreq}"></div>
          <span class="synth-knob-num stat-num" id="filter-panel-cut-val">${initCut}</span>
          <span class="synth-knob-title">CUTOFF</span>
        </div>

        <div class="synth-knob-cell">
          <div id="filter-panel-reso-mount" data-param-index="${ParamIdx.FilterReso}"></div>
          <span class="synth-knob-num stat-num" id="filter-panel-reso-val">${(initReso / 127.0).toFixed(2)}</span>
          <span class="synth-knob-title">RESO</span>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    this.cutValEl = this.rootEl.querySelector('#filter-panel-cut-val');
    this.resoValEl = this.rootEl.querySelector('#filter-panel-reso-val');

    // Mount Knobs
    const cutMount = this.rootEl.querySelector('#filter-panel-cut-mount') as HTMLElement | null;
    if (cutMount) {
      this.cutKnob = new Knob(cutMount, {
        size: 38,
        value: initCut / 127.0,
        label: 'CUT',
        ...gestureFor(ParamIdx.FilterFreq),
        onChange: (normVal: number) => {
          const val = Math.round(normVal * 127.0);
          WebBridge.setParam(ParamIdx.FilterFreq, val);
          if (this.cutValEl) this.cutValEl.textContent = String(val);
        },
      });
    }

    const resoMount = this.rootEl.querySelector('#filter-panel-reso-mount') as HTMLElement | null;
    if (resoMount) {
      this.resoKnob = new Knob(resoMount, {
        size: 38,
        value: initReso / 127.0,
        label: 'RESO',
        ...gestureFor(ParamIdx.FilterReso),
        onChange: (normVal: number) => {
          const val = Math.round(normVal * 127.0);
          WebBridge.setParam(ParamIdx.FilterReso, val);
          if (this.resoValEl) this.resoValEl.textContent = (val / 127.0).toFixed(2);
        },
      });
    }

    this.rootEl.querySelector('#btn-edit-filter-panel')?.addEventListener('click', () => {
      this.options.onEdit?.();
    });
  }

  public updateParam(idx: number, val: number): void {
    if (idx === ParamIdx.FilterFreq) {
      this.cutKnob?.setValue(val / 127.0, false);
      if (this.cutValEl) this.cutValEl.textContent = String(Math.round(val));
    } else if (idx === ParamIdx.FilterReso) {
      this.resoKnob?.setValue(val / 127.0, false);
      if (this.resoValEl) this.resoValEl.textContent = (val / 127.0).toFixed(2);
    }
  }

  public updateAll(values: number[]): void {
    if (!Array.isArray(values) || values.length === 0) return;
    this.updateParam(ParamIdx.FilterFreq, values[ParamIdx.FilterFreq] ?? 100);
    this.updateParam(ParamIdx.FilterReso, values[ParamIdx.FilterReso] ?? 25);
  }

  public destroy(): void {
    this.cutKnob?.destroy();
    this.resoKnob?.destroy();
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.rootEl = null;
  }
}
