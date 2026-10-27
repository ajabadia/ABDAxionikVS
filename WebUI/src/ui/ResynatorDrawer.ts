// ─────────────────────────────────────────────────────────
// ABDAxionikVS — ResynatorDrawer.ts
// Panel lateral deslizante (50vw) para controles ampliados de Resonador
// Edición profunda de las 3 Capas (L1, L2, L3), 7 Parsets y Afinación
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';

export interface ResynatorDrawerProps {
  resynator: 1 | 2;
  modelName: string;
  onClose: () => void;
}

export class ResynatorDrawer {
  public static createContent(props: ResynatorDrawerProps): HTMLElement {
    const isR1 = props.resynator === 1;
    const rPrefix = isR1 ? 'R1' : 'R2';

    const el = document.createElement('div');
    el.className = 'resynator-drawer-view';
    el.innerHTML = `
      <div class="drawer-header ndb-modal-header">
        <div class="drawer-title ndb-header-title">
          <span class="drawer-icon">${ICONS.wave}</span>
          <span class="ndb-title-text">${rPrefix} EXPANDED CONTROLS</span>
          <span class="panel-badge ndb-badge">${props.modelName}</span>
        </div>
        <div class="drawer-header-actions">
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-resy-drawer" title="Close (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <div class="drawer-scrollable-content" style="padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); overflow-y: auto;">
        <!-- 1. Algoritmo Parset (0..6) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <div class="panel-caption" style="margin-bottom: var(--space-2); color: var(--color-accent); font-weight: 700;">PARSET SYNTHESIS ENGINE (FUN_10031d30)</div>
          <div class="ndb-chips-row" style="flex-wrap: wrap; gap: var(--space-2);">
            <button type="button" class="ndb-chip active" data-parset="0">0: Additive / Formant</button>
            <button type="button" class="ndb-chip" data-parset="1">1: FM Cross-Mod</button>
            <button type="button" class="ndb-chip" data-parset="2">2: Harmonic Tilt</button>
            <button type="button" class="ndb-chip" data-parset="3">3: Peak Shifter</button>
            <button type="button" class="ndb-chip" data-parset="4">4: Saturation</button>
            <button type="button" class="ndb-chip" data-parset="5">5: Ring Mod</button>
            <button type="button" class="ndb-chip" data-parset="6">6: Dispersion</button>
          </div>
        </div>

        <!-- 2. Afinación del Resonador -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <div class="panel-caption" style="margin-bottom: var(--space-2); color: var(--color-accent); font-weight: 700;">TUNING & PITCH</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">OCTAVE: <strong id="${rPrefix}-oct-val">0</strong></span>
              <input type="range" id="${rPrefix}-oct-slider" min="-3" max="3" value="0" step="1" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">SEMITONES: <strong id="${rPrefix}-semi-val">0</strong></span>
              <input type="range" id="${rPrefix}-semi-slider" min="-12" max="12" value="0" step="1" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">FINE CENTS: <strong id="${rPrefix}-cents-val">0</strong></span>
              <input type="range" id="${rPrefix}-cents-slider" min="-100" max="100" value="0" step="1" style="width: 100%;" />
            </div>
          </div>
        </div>

        <!-- 3. Las 3 Capas de Síntesis (L1, L2, L3) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <div class="panel-caption" style="margin-bottom: var(--space-2); color: var(--color-accent); font-weight: 700;">3 CANONICAL LAYERS (L1, L2, L3)</div>
          <div style="display: flex; flex-direction: column; gap: var(--space-3);">
            <!-- Capa L1 -->
            <div style="display: grid; grid-template-columns: 80px 1fr 1fr; align-items: center; gap: var(--space-3); background: rgba(0,0,0,0.25); padding: var(--space-2); border-radius: var(--radius-sm);">
              <span class="panel-badge">LAYER 1</span>
              <div>
                <span class="hud-label">LEVEL: <strong>100%</strong></span>
                <input type="range" min="0" max="100" value="100" style="width: 100%;" />
              </div>
              <div>
                <span class="hud-label">DETUNE: <strong>0.00 st</strong></span>
                <input type="range" min="-12" max="12" value="0" step="0.1" style="width: 100%;" />
              </div>
            </div>

            <!-- Capa L2 -->
            <div style="display: grid; grid-template-columns: 80px 1fr 1fr; align-items: center; gap: var(--space-3); background: rgba(0,0,0,0.25); padding: var(--space-2); border-radius: var(--radius-sm);">
              <span class="panel-badge">LAYER 2</span>
              <div>
                <span class="hud-label">LEVEL: <strong>85%</strong></span>
                <input type="range" min="0" max="100" value="85" style="width: 100%;" />
              </div>
              <div>
                <span class="hud-label">DETUNE: <strong>+0.04 st</strong></span>
                <input type="range" min="-12" max="12" value="0.04" step="0.1" style="width: 100%;" />
              </div>
            </div>

            <!-- Capa L3 -->
            <div style="display: grid; grid-template-columns: 80px 1fr 1fr; align-items: center; gap: var(--space-3); background: rgba(0,0,0,0.25); padding: var(--space-2); border-radius: var(--radius-sm);">
              <span class="panel-badge">LAYER 3</span>
              <div>
                <span class="hud-label">LEVEL: <strong>65%</strong></span>
                <input type="range" min="0" max="100" value="65" style="width: 100%;" />
              </div>
              <div>
                <span class="hud-label">DETUNE: <strong>-0.04 st</strong></span>
                <input type="range" min="-12" max="12" value="-0.04" step="0.1" style="width: 100%;" />
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Envolvente de Amplitud ADSR -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <div class="panel-caption" style="margin-bottom: var(--space-2); color: var(--color-accent); font-weight: 700;">AMPLITUDE SHAPER ADSR</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2);">
            <div>
              <span class="hud-label">ATTACK</span>
              <input type="range" min="0" max="127" value="10" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">DECAY</span>
              <input type="range" min="0" max="127" value="45" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">SUSTAIN</span>
              <input type="range" min="0" max="127" value="95" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">RELEASE</span>
              <input type="range" min="0" max="127" value="35" style="width: 100%;" />
            </div>
          </div>
        </div>
      </div>
    `;

    // Cerrar drawer
    el.querySelector('#btn-close-resy-drawer')?.addEventListener('click', () => {
      props.onClose();
    });

    // Parset chips
    el.querySelectorAll('[data-parset]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        el.querySelectorAll('[data-parset]').forEach((c) => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const parset = parseInt(target.getAttribute('data-parset') || '0', 10);
        // Param 24 para R1, 104 para R2
        WebBridge.setParam(isR1 ? 24 : 104, parset);
      });
    });

    // Tuning handlers
    const octSlider = el.querySelector(`#${rPrefix}-oct-slider`) as HTMLInputElement | null;
    const octVal = el.querySelector(`#${rPrefix}-oct-val`);
    octSlider?.addEventListener('input', () => {
      if (octVal) octVal.textContent = octSlider.value;
      WebBridge.setParam(isR1 ? 33 : 113, parseFloat(octSlider.value));
    });

    const semiSlider = el.querySelector(`#${rPrefix}-semi-slider`) as HTMLInputElement | null;
    const semiVal = el.querySelector(`#${rPrefix}-semi-val`);
    semiSlider?.addEventListener('input', () => {
      if (semiVal) semiVal.textContent = semiSlider.value;
      WebBridge.setParam(isR1 ? 34 : 114, parseFloat(semiSlider.value));
    });

    const centsSlider = el.querySelector(`#${rPrefix}-cents-slider`) as HTMLInputElement | null;
    const centsVal = el.querySelector(`#${rPrefix}-cents-val`);
    centsSlider?.addEventListener('input', () => {
      if (centsVal) centsVal.textContent = centsSlider.value;
      WebBridge.setParam(isR1 ? 35 : 115, parseFloat(centsSlider.value));
    });

    return el;
  }
}
