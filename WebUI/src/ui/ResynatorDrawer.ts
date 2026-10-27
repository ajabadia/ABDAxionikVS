// ─────────────────────────────────────────────────────────
// ABDAxionikVS — ResynatorDrawer.ts
// Panel lateral deslizante (50vw) para controles ampliados de Resonador
// Edición profunda de las 3 Capas (L1, L2, L3), 7 Parsets y Afinación
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { MultiStageShaperPad } from './MultiStageShaperPad.js';

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
              <span class="hud-label">ATTACK: <strong id="${rPrefix}-adsr-a-val">10</strong></span>
              <input type="range" class="abd-slider" id="${rPrefix}-adsr-a" min="0" max="127" value="10" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">DECAY: <strong id="${rPrefix}-adsr-d-val">45</strong></span>
              <input type="range" class="abd-slider" id="${rPrefix}-adsr-d" min="0" max="127" value="45" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">SUSTAIN: <strong id="${rPrefix}-adsr-s-val">95</strong></span>
              <input type="range" class="abd-slider" id="${rPrefix}-adsr-s" min="0" max="127" value="95" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">RELEASE: <strong id="${rPrefix}-adsr-r-val">35</strong></span>
              <input type="range" class="abd-slider" id="${rPrefix}-adsr-r" min="0" max="127" value="35" style="width: 100%;" />
            </div>
          </div>
        </div>

        <!-- 5. Pad de Envolvente Multinivel 4L4T (@abdsynths/shared) -->
        <div id="${rPrefix}-shaper-mount"></div>
      </div>
    `;

    // Cerrar drawer
    el.querySelector('#btn-close-resy-drawer')?.addEventListener('click', () => {
      props.onClose();
    });

    // Montar MultiStageShaperPad canónico de ABDShared
    const shaperMount = el.querySelector(`#${rPrefix}-shaper-mount`) as HTMLElement | null;
    if (shaperMount) {
      new MultiStageShaperPad(shaperMount, {
        label: `${rPrefix} 4L4T SHAPER CONTOUR`,
        bipolar: true,
        editable: true,
        times: [0.2, 0.4, 0.3, 0.5],
        levels: [0.8, -0.4, 0.5, 0.0],
        mode: 1,
        onChange: (val) => {
          // Parámetros FreeEnvLevel1..4 (242..245): escala -64..63
          val.levels.forEach((lvl, idx) => {
            WebBridge.setParam(242 + idx, Math.round(lvl * 63));
          });
          // Parámetros FreeEnvTime1..4 (246..249): escala 0..127
          val.times.forEach((t, idx) => {
            WebBridge.setParam(246 + idx, Math.round(t * 127));
          });
          // Shaper Status/Mode (253)
          WebBridge.setParam(253, val.mode);
        },
      });
    }

    // ADSR Handlers
    const baseAdsrParam = isR1 ? 200 : 215;
    const aSlider = el.querySelector(`#${rPrefix}-adsr-a`) as HTMLInputElement | null;
    const aVal = el.querySelector(`#${rPrefix}-adsr-a-val`);
    aSlider?.addEventListener('input', () => {
      if (aVal) aVal.textContent = aSlider.value;
      WebBridge.setParam(baseAdsrParam, parseFloat(aSlider.value));
    });

    const dSlider = el.querySelector(`#${rPrefix}-adsr-d`) as HTMLInputElement | null;
    const dVal = el.querySelector(`#${rPrefix}-adsr-d-val`);
    dSlider?.addEventListener('input', () => {
      if (dVal) dVal.textContent = dSlider.value;
      WebBridge.setParam(baseAdsrParam + 1, parseFloat(dSlider.value));
    });

    const sSlider = el.querySelector(`#${rPrefix}-adsr-s`) as HTMLInputElement | null;
    const sVal = el.querySelector(`#${rPrefix}-adsr-s-val`);
    sSlider?.addEventListener('input', () => {
      if (sVal) sVal.textContent = sSlider.value;
      WebBridge.setParam(baseAdsrParam + 2, parseFloat(sSlider.value));
    });

    const rSlider = el.querySelector(`#${rPrefix}-adsr-r`) as HTMLInputElement | null;
    const rVal = el.querySelector(`#${rPrefix}-adsr-r-val`);
    rSlider?.addEventListener('input', () => {
      if (rVal) rVal.textContent = rSlider.value;
      WebBridge.setParam(baseAdsrParam + 3, parseFloat(rSlider.value));
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
