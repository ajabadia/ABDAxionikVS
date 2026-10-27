// ─────────────────────────────────────────────────────────
// ABDAxionikVS — SilverDrawer.ts
// Panel lateral deslizante (50vw) para controles ampliados de Silver Rack y Master FX
// Filtro multimodo, 9 Freq FX, 7 Time FX y Master Reverb
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';

export interface SilverDrawerProps {
  onClose: () => void;
}

export class SilverDrawer {
  public static createContent(props: SilverDrawerProps): HTMLElement {
    const el = document.createElement('div');
    el.className = 'silver-drawer-view';
    el.innerHTML = `
      <div class="drawer-header ndb-modal-header">
        <div class="drawer-title ndb-header-title">
          <span class="drawer-icon">${ICONS.sliders}</span>
          <span class="ndb-title-text">SILVER & MASTER FX RACK</span>
          <span class="panel-badge ndb-badge">FUN_10029e34</span>
        </div>
        <div class="drawer-header-actions">
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-silver-drawer" title="Close (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <div class="drawer-scrollable-content" style="padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); overflow-y: auto;">
        <!-- 1. Silver Multimode Filter -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <div class="panel-caption" style="margin-bottom: var(--space-2); color: var(--color-accent); font-weight: 700;">SILVER MULTIMODE FILTER ([273..278])</div>
          <div class="ndb-chips-row" style="margin-bottom: var(--space-3);">
            <button type="button" class="ndb-chip active" data-ftype="1">LP 24dB</button>
            <button type="button" class="ndb-chip" data-ftype="0">LP 12dB</button>
            <button type="button" class="ndb-chip" data-ftype="2">Bandpass</button>
            <button type="button" class="ndb-chip" data-ftype="3">Highpass</button>
            <button type="button" class="ndb-chip" data-ftype="4">Notch</button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">CUTOFF (Hz): <strong id="silver-cut-val">2500</strong></span>
              <input type="range" class="abd-slider" id="silver-cut-slider" min="0" max="127" value="85" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">RESONANCE: <strong id="silver-res-val">0.25</strong></span>
              <input type="range" class="abd-slider" id="silver-res-slider" min="0" max="127" value="30" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">ANALOG DRIVE: <strong id="silver-drv-val">0.20</strong></span>
              <input type="range" class="abd-slider" id="silver-drv-slider" min="0" max="100" value="20" style="width: 100%;" />
            </div>
          </div>
        </div>

        <!-- 2. Silver FreqFX (9 Algoritmos) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">FREQUENCY MODULATION FX ([281..295])</span>
            <label style="font-size: var(--text-xs); display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="checkbox" id="check-freqfx-enable" checked /> ENABLE
            </label>
          </div>
          <div class="ndb-chips-row" style="flex-wrap: wrap; gap: var(--space-1); margin-bottom: var(--space-3);">
            <button type="button" class="ndb-chip active" data-freqalgo="2">RingMod</button>
            <button type="button" class="ndb-chip" data-freqalgo="1">FreqShift</button>
            <button type="button" class="ndb-chip" data-freqalgo="3">Distortion</button>
            <button type="button" class="ndb-chip" data-freqalgo="4">Decimator</button>
            <button type="button" class="ndb-chip" data-freqalgo="5">Formant</button>
            <button type="button" class="ndb-chip" data-freqalgo="6">Comb</button>
            <button type="button" class="ndb-chip" data-freqalgo="7">Resonator</button>
            <button type="button" class="ndb-chip" data-freqalgo="8">Treemonster</button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">PARAM 1: <strong>50%</strong></span>
              <input type="range" min="0" max="100" value="50" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">PARAM 2: <strong>50%</strong></span>
              <input type="range" min="0" max="100" value="50" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">WET / DRY MIX: <strong>45%</strong></span>
              <input type="range" min="0" max="100" value="45" style="width: 100%;" />
            </div>
          </div>
        </div>

        <!-- 3. Silver TimeFX (7 Algoritmos) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">TIME & DELAY MODULATION FX ([327..335])</span>
            <label style="font-size: var(--text-xs); display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="checkbox" id="check-timefx-enable" checked /> ENABLE
            </label>
          </div>
          <div class="ndb-chips-row" style="flex-wrap: wrap; gap: var(--space-1); margin-bottom: var(--space-3);">
            <button type="button" class="ndb-chip active" data-timealgo="1">Stereo Chorus</button>
            <button type="button" class="ndb-chip" data-timealgo="2">Flanger</button>
            <button type="button" class="ndb-chip" data-timealgo="3">4-Stage Phaser</button>
            <button type="button" class="ndb-chip" data-timealgo="4">Stereo Delay</button>
            <button type="button" class="ndb-chip" data-timealgo="5">Multi-Tap Echo</button>
            <button type="button" class="ndb-chip" data-timealgo="6">Reverb Plate</button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">TIME / RATE: <strong>35%</strong></span>
              <input type="range" min="0" max="100" value="35" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">FEEDBACK: <strong>30%</strong></span>
              <input type="range" min="0" max="95" value="30" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">WET / DRY MIX: <strong>40%</strong></span>
              <input type="range" min="0" max="100" value="40" style="width: 100%;" />
            </div>
          </div>
        </div>

        <!-- 4. Master FX Rack -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <div class="panel-caption" style="margin-bottom: var(--space-2); color: var(--color-accent); font-weight: 700;">MASTER STEREO WIDTH & SPACE ([430..444])</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
            <div>
              <span class="hud-label">STEREO WIDTH: <strong>100%</strong></span>
              <input type="range" min="0" max="200" value="100" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">MASTER REVERB ROOM: <strong>Medium Plate</strong></span>
              <input type="range" min="0" max="100" value="25" style="width: 100%;" />
            </div>
          </div>
        </div>
      </div>
    `;

    // Cerrar drawer
    el.querySelector('#btn-close-silver-drawer')?.addEventListener('click', () => {
      props.onClose();
    });

    // Filter Type chips
    el.querySelectorAll('[data-ftype]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        el.querySelectorAll('[data-ftype]').forEach((c) => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const ftype = parseInt(target.getAttribute('data-ftype') || '1', 10);
        WebBridge.setParam(273, ftype);
      });
    });

    // FreqFX Algo chips
    el.querySelectorAll('[data-freqalgo]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        el.querySelectorAll('[data-freqalgo]').forEach((c) => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const algo = parseInt(target.getAttribute('data-freqalgo') || '2', 10);
        WebBridge.setParam(282, algo);
      });
    });

    // TimeFX Algo chips
    el.querySelectorAll('[data-timealgo]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        el.querySelectorAll('[data-timealgo]').forEach((c) => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const algo = parseInt(target.getAttribute('data-timealgo') || '1', 10);
        WebBridge.setParam(328, algo);
      });
    });

    // Cutoff and Reso handlers
    const cutSlider = el.querySelector('#silver-cut-slider') as HTMLInputElement | null;
    const cutVal = el.querySelector('#silver-cut-val');
    cutSlider?.addEventListener('input', () => {
      if (cutVal) cutVal.textContent = cutSlider.value;
      WebBridge.setParam(274, parseFloat(cutSlider.value));
    });

    const resSlider = el.querySelector('#silver-res-slider') as HTMLInputElement | null;
    const resVal = el.querySelector('#silver-res-val');
    resSlider?.addEventListener('input', () => {
      if (resVal) resVal.textContent = (parseFloat(resSlider.value) / 127).toFixed(2);
      WebBridge.setParam(275, parseFloat(resSlider.value));
    });

    return el;
  }
}
