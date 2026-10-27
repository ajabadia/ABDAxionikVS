/**
 * ABDAxionikVS — MatrixDrawer.ts
 * Dedicated slide-out drawer (50vw) for the Free Controllers Modulation Matrix (6 × 5)
 * and the 6 Real-Time Performance Controls ([411..424]).
 * 100% tokenized with @abdsynths/shared.
 */

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';

export const MOD_SOURCES = [
  { id: 1, name: 'Aftertouch (Channel Pressure)', destParam: 413, depthParam: 414, defaultDest: 61, defaultDepth: 40 },
  { id: 2, name: 'Modulation Wheel (MIDI CC 1)', destParam: 415, depthParam: 416, defaultDest: 61, defaultDepth: 55 },
  { id: 3, name: 'Breath Controller (MIDI CC 2)', destParam: 417, depthParam: 418, defaultDest: 27, defaultDepth: 0 },
  { id: 4, name: 'Continuous Controller 03 (MIDI CC 3)', destParam: 419, depthParam: 420, defaultDest: 56, defaultDepth: 0 },
  { id: 5, name: 'Foot Pedal (MIDI CC 4)', destParam: 421, depthParam: 422, defaultDest: 59, defaultDepth: 0 },
  { id: 6, name: 'Expression Pedal (MIDI CC 11)', destParam: 423, depthParam: 424, defaultDest: 27, defaultDepth: 63 },
];

export const PRIMARY_MOD_DESTINATIONS = [
  { id: 0, label: '0: Off' },
  { id: 1, label: '1: Master Pan' },
  { id: 27, label: '27: R1 Volume' },
  { id: 107, label: '107: R2 Volume' },
  { id: 56, label: '56: Blender Amount' },
  { id: 57, label: '57: Slicer Depth' },
  { id: 58, label: '58: Slicer Rate' },
  { id: 59, label: '59: LFO Depth' },
  { id: 60, label: '60: LFO Rate' },
  { id: 61, label: '61: Filter Cutoff' },
  { id: 62, label: '62: Filter Reso' },
];

export interface MatrixDrawerOptions {
  onClose: () => void;
}

export class MatrixDrawer {
  static createContent(options: MatrixDrawerOptions): HTMLElement {
    const root = document.createElement('div');
    root.className = 'drawer-view-content';
    root.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-4); height: 100%;';

    let sourcesHtml = '';
    MOD_SOURCES.forEach((src) => {
      let optionsHtml = '';
      PRIMARY_MOD_DESTINATIONS.forEach((d) => {
        const isSel = d.id === src.defaultDest ? 'selected' : '';
        optionsHtml += `<option value="${d.id}" ${isSel}>${d.label}</option>`;
      });

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
                ${optionsHtml}
              </select>
            </div>

            <div style="display: flex; align-items: center; gap: 6px; width: 190px;">
              <span class="hud-label" style="font-size: 10px;">DEPTH [-64..+63]:</span>
              <input type="range" class="abd-slider src-depth-slider" data-param="${src.depthParam}" min="-64" max="63" value="${src.defaultDepth}" step="1" style="flex: 1;" />
              <span class="hud-value stat-num src-depth-val" style="width: 32px; text-align: right;">${src.defaultDepth}</span>
            </div>
          </div>
        </div>
      `;
    });

    root.innerHTML = `
      <div class="drawer-header">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="panel-badge">MODULATION MATRIX</span>
          <span class="panel-caption">Real-Time Performance Controls & Free Controllers [363..424]</span>
        </div>
        <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-matrix-drawer" title="Close (Esc)">${ICONS.close}</button>
      </div>

      <div class="drawer-scroll-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3); padding-right: 4px;">
        <!-- Global Controllers Config (FootSwitch & PitchBend) -->
        <div class="synth-panel-card" style="padding: var(--space-2) var(--space-3); display: flex; justify-content: space-between; align-items: center; gap: var(--space-3);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="hud-label">PITCH BEND RANGE [412]:</span>
            <input type="range" id="pb-range-slider" class="abd-slider" min="0" max="12" value="2" step="1" style="width: 80px;" />
            <span class="hud-value stat-num" id="pb-range-val">2 st</span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="hud-label">FOOTSWITCH DEST [411]:</span>
            <select id="footswitch-dest-select" class="btn btn-xs btn-outline" style="height: 22px;">
              <option value="0">0: Sustain (Pedal)</option>
              <option value="1">1: Hold Notes</option>
              <option value="2">2: Slicer On/Off</option>
              <option value="3">3: Silver On/Off</option>
              <option value="4">4: Stick Play/Stop</option>
              <option value="5">5: Tap Tempo</option>
            </select>
          </div>
        </div>

        <!-- The 6 Performance Controllers -->
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          ${sourcesHtml}
        </div>
      </div>
    `;

    // Events
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

    // Pitch Bend & FootSwitch
    const pbSlider = root.querySelector('#pb-range-slider') as HTMLInputElement | null;
    pbSlider?.addEventListener('input', () => {
      const val = parseFloat(pbSlider.value);
      const disp = root.querySelector('#pb-range-val');
      if (disp) disp.textContent = `${val} st`;
      WebBridge.setParam(412, val);
    });

    const footSelect = root.querySelector('#footswitch-dest-select') as HTMLSelectElement | null;
    footSelect?.addEventListener('change', () => {
      if (footSelect) WebBridge.setParam(411, parseInt(footSelect.value, 10));
    });

    return root;
  }
}
