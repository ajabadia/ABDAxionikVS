/**
 * ABDAxionikVS — BlenderDrawer.ts
 * Dedicated slide-out drawer (50vw) for Blender fusion algorithms & Slicer modulation.
 * 100% tokenized with @abdsynths/shared button and slider components.
 */

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';

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

    const curBlenderType = 0;
    const curSlicerType = 0;
    const curSlicerWave = 0;

    let algoButtonsHtml = '';
    BLENDER_ALGORITHMS.forEach((a) => {
      const isAct = a.id === curBlenderType;
      algoButtonsHtml += `
        <button type="button" class="btn btn-xs ${isAct ? 'btn-primary active' : 'btn-outline'} btn-blender-algo" data-algo="${a.id}" title="${a.desc}">
          ${a.id}: ${a.name}
        </button>
      `;
    });

    let waveButtonsHtml = '';
    SLICER_WAVEFORMS.forEach((w, idx) => {
      const isAct = idx === curSlicerWave;
      waveButtonsHtml += `
        <button type="button" class="btn btn-xs ${isAct ? 'btn-primary active' : 'btn-outline'} btn-slicer-wave" data-wave="${idx}">
          ${w}
        </button>
      `;
    });

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
              <span class="panel-caption" id="blender-algo-desc">${BLENDER_ALGORITHMS[0].desc}</span>
            </div>
            <span class="hud-pill stat-num">Param 261</span>
          </div>

          <div class="blender-algo-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 4px;">
            ${algoButtonsHtml}
          </div>

          <!-- Blender Amount Fader -->
          <div style="display: flex; align-items: center; gap: var(--space-3); background: var(--color-panel-surface); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--color-panel-border);">
            <span class="hud-label" style="min-width: 90px;">AMOUNT [-64..+63]:</span>
            <span style="font-size: 10px; color: var(--color-text-muted);">R1</span>
            <input type="range" id="b-drawer-amount" class="abd-slider" min="-64" max="63" value="0" step="1" style="flex: 1;" />
            <span style="font-size: 10px; color: var(--color-text-muted);">R2</span>
            <span class="hud-value stat-num" id="b-drawer-amount-val" style="min-width: 44px; text-align: right;">0</span>
          </div>

          <!-- Blender Modulations -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">LFO DEPTH [263]:</span>
              <input type="range" id="b-drawer-lfo-depth" class="abd-slider" min="-64" max="63" value="0" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="b-drawer-lfo-depth-val">0</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">FREE ADSR 1 [264]:</span>
              <input type="range" id="b-drawer-adsr1-depth" class="abd-slider" min="-64" max="63" value="0" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="b-drawer-adsr1-depth-val">0</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">FREE ADSR 2 [265]:</span>
              <input type="range" id="b-drawer-adsr2-depth" class="abd-slider" min="-64" max="63" value="0" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="b-drawer-adsr2-depth-val">0</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">FREE 4L4T [266]:</span>
              <input type="range" id="b-drawer-4l4t-depth" class="abd-slider" min="0" max="127" value="0" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="b-drawer-4l4t-depth-val">0</span>
            </div>
          </div>
        </div>

        <!-- Card 2: Slicer Engine -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="panel-badge">SLICER ENGINE</span>
              <span class="panel-caption">Rhythmic Chopper & Spatial Modulator [267..270]</span>
            </div>
            <div class="slicer-mode-bar" style="display: flex; gap: 4px;">
              <button type="button" class="btn btn-xs btn-primary active btn-slicer-type" data-type="0">0: Off</button>
              <button type="button" class="btn btn-xs btn-outline btn-slicer-type" data-type="1">1: 2D Vertical</button>
              <button type="button" class="btn btn-xs btn-outline btn-slicer-type" data-type="2">2: 3D Spatial</button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">RATE [269]:</span>
              <input type="range" id="s-drawer-rate" class="abd-slider" min="0" max="200" value="66" step="1" style="width: 120px;" />
              <span class="hud-value stat-num" id="s-drawer-rate-val">66</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">DEPTH [268]:</span>
              <input type="range" id="s-drawer-depth" class="abd-slider" min="0" max="127" value="64" step="1" style="width: 120px;" />
              <span class="hud-value stat-num" id="s-drawer-depth-val">64</span>
            </div>
          </div>

          <div>
            <div class="hud-label" style="margin-bottom: 6px;">LFO WAVEFORM [270]:</div>
            <div class="slicer-wave-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)); gap: 4px;">
              ${waveButtonsHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    // Events
    root.querySelector('#btn-close-blender-drawer')?.addEventListener('click', () => {
      options.onClose();
    });

    // Blender algorithm buttons
    root.querySelectorAll('.btn-blender-algo').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const algo = parseInt(target.getAttribute('data-algo') || '0', 10);
        WebBridge.setParam(261, algo);
        root.querySelectorAll('.btn-blender-algo').forEach((b) => {
          const isAct = parseInt(b.getAttribute('data-algo') || '0', 10) === algo;
          b.classList.toggle('active', isAct);
          b.classList.toggle('btn-primary', isAct);
          b.classList.toggle('btn-outline', !isAct);
        });
        const descEl = root.querySelector('#blender-algo-desc');
        if (descEl) descEl.textContent = BLENDER_ALGORITHMS[algo]?.desc || '';
      });
    });

    // Slicer mode buttons
    root.querySelectorAll('.btn-slicer-type').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const type = parseInt(target.getAttribute('data-type') || '0', 10);
        WebBridge.setParam(267, type);
        root.querySelectorAll('.btn-slicer-type').forEach((b) => {
          const isAct = parseInt(b.getAttribute('data-type') || '0', 10) === type;
          b.classList.toggle('active', isAct);
          b.classList.toggle('btn-primary', isAct);
          b.classList.toggle('btn-outline', !isAct);
        });
      });
    });

    // Slicer wave buttons
    root.querySelectorAll('.btn-slicer-wave').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const wave = parseInt(target.getAttribute('data-wave') || '0', 10);
        WebBridge.setParam(270, wave);
        root.querySelectorAll('.btn-slicer-wave').forEach((b) => {
          const isAct = parseInt(b.getAttribute('data-wave') || '0', 10) === wave;
          b.classList.toggle('active', isAct);
          b.classList.toggle('btn-primary', isAct);
          b.classList.toggle('btn-outline', !isAct);
        });
      });
    });

    // Sliders
    const bindSlider = (id: string, paramId: number, valId: string) => {
      const slider = root.querySelector(`#${id}`) as HTMLInputElement | null;
      const valDisplay = root.querySelector(`#${valId}`);
      slider?.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        if (valDisplay) valDisplay.textContent = String(val);
        WebBridge.setParam(paramId, val);
      });
    };

    bindSlider('b-drawer-amount', 262, 'b-drawer-amount-val');
    bindSlider('b-drawer-lfo-depth', 263, 'b-drawer-lfo-depth-val');
    bindSlider('b-drawer-adsr1-depth', 264, 'b-drawer-adsr1-depth-val');
    bindSlider('b-drawer-adsr2-depth', 265, 'b-drawer-adsr2-depth-val');
    bindSlider('b-drawer-4l4t-depth', 266, 'b-drawer-4l4t-depth-val');
    bindSlider('s-drawer-rate', 269, 's-drawer-rate-val');
    bindSlider('s-drawer-depth', 268, 's-drawer-depth-val');

    return root;
  }
}
