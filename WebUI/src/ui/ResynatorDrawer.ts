// ─────────────────────────────────────────────────────────
// ABDAxionikVS — ResynatorDrawer.ts
// Panel lateral deslizante (50vw) para controles ampliados de Resonador:
// - Switch R1/R2 [23/103], Volumen [27/107], Umbral Velocity Switch [41/121]
// - Algoritmo Parset [24/104] (0..6)
// - Afinación: Octave [33/113] (0..3 -> -2..+1 oct), Semi [34/114] (-24..+24), Cents [35/115] (-99..+99)
// - Modulación de tono y volumen: PitchKeyTrack [37/117], PitchLfoDepth [36/116], AmpLfoDepth [28/108]
// - Envolventes ADSR de Amplitud [200..203 / 230..233] y ResEnv [182..185 / 212..215]
// - LFO Global ([256..260]: Switch, Depth, Rate, Delay, Waveform 0..11)
// - Shaper Multinivel 4L4T ([242..253])
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { MultiStageShaperPad } from './MultiStageShaperPad.js';

export interface ResynatorDrawerProps {
  resynator: 1 | 2;
  modelName: string;
  onClose: () => void;
  onSelectModel?: (resynator: 1 | 2) => void;
}

export class ResynatorDrawer {
  public static createContent(props: ResynatorDrawerProps): HTMLElement {
    const isR1 = props.resynator === 1;
    const rPrefix = isR1 ? 'R1' : 'R2';
    const g = (idx: number, def: number) => Math.round(WebBridge.getParam(idx, def));

    const curSw = g(isR1 ? 23 : 103, 1) > 0;
    const curParset = g(isR1 ? 24 : 104, 0);
    const curVol = g(isR1 ? 27 : 107, 100);
    const curAmpLfo = g(isR1 ? 28 : 108, 0);
    const curVelSw = g(isR1 ? 41 : 121, 64);

    const curOct = g(isR1 ? 33 : 113, 2); // 0..3 -> -2..+1 oct
    const curSemi = g(isR1 ? 34 : 114, 0);
    const curCents = g(isR1 ? 35 : 115, 0);
    const curPitchLfo = g(isR1 ? 36 : 116, 0);
    const curPitchKt = g(isR1 ? 37 : 117, 63);

    const baseAdsrParam = isR1 ? 200 : 230;
    const curAdsrA = g(baseAdsrParam, 10);
    const curAdsrD = g(baseAdsrParam + 1, 45);
    const curAdsrS = g(baseAdsrParam + 2, 100);
    const curAdsrR = g(baseAdsrParam + 3, 35);

    const baseResEnvParam = isR1 ? 182 : 212;
    const curResA = g(baseResEnvParam, 15);
    const curResD = g(baseResEnvParam + 1, 50);
    const curResS = g(baseResEnvParam + 2, 90);
    const curResR = g(baseResEnvParam + 3, 40);

    // LFO Global [256..260]
    const lfoOn = g(256, 0) > 0;
    const lfoDepth = g(257, 64);
    const lfoRate = g(258, 150);
    const lfoDelay = g(259, 0);
    const lfoWave = g(260, 0);

    // Shaper 4L4T [242..253]
    const curShaperTimes = [
      WebBridge.getParam(ParamIdx.FreeEnvTime1, 25) / 127 || 0.2,
      WebBridge.getParam(ParamIdx.FreeEnvTime2, 51) / 127 || 0.4,
      WebBridge.getParam(ParamIdx.FreeEnvTime3, 38) / 127 || 0.3,
      WebBridge.getParam(ParamIdx.FreeEnvTime4, 64) / 127 || 0.5,
    ];
    const curShaperLevels = [
      WebBridge.getParam(ParamIdx.FreeEnvLevel1, 50) / 63 || 0.8,
      WebBridge.getParam(ParamIdx.FreeEnvLevel2, -25) / 63 || -0.4,
      WebBridge.getParam(ParamIdx.FreeEnvLevel3, 32) / 63 || 0.5,
      WebBridge.getParam(ParamIdx.FreeEnvLevel4, 0) / 63 || 0.0,
    ];
    const curShaperMode = g(253, 1);

    const el = document.createElement('div');
    el.className = 'resynator-drawer-view';
    el.innerHTML = `
      <div class="drawer-header ndb-modal-header">
        <div class="drawer-title ndb-header-title">
          <span class="drawer-icon">${ICONS.wave}</span>
          <span class="ndb-title-text">${rPrefix} EXPANDED CONTROLS</span>
          <button type="button" class="btn btn-xs btn-outline ndb-badge" id="btn-drawer-select-model" title="Select / Change Model for ${rPrefix}">
            Model: <strong>${props.modelName}</strong>
          </button>
        </div>
        <div class="drawer-header-actions" style="display: flex; align-items: center; gap: var(--space-2);">
          <button type="button" class="btn btn-xs ${curSw ? 'btn-primary active' : 'btn-outline'}" id="btn-resy-switch">
            ${rPrefix}: ${curSw ? 'ON' : 'MUTED'}
          </button>
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-resy-drawer" title="Close (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <div class="drawer-scrollable-content" style="padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); overflow-y: auto;">
        <!-- 1. Algoritmo Parset (0..6) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <div class="panel-caption" style="margin-bottom: var(--space-2); color: var(--color-accent); font-weight: 700;">PARSET SYNTHESIS ENGINE ([${isR1 ? 24 : 104}], FUN_10031d30)</div>
          <div class="ndb-chips-row" style="flex-wrap: wrap; gap: var(--space-2);">
            <button type="button" class="ndb-chip ${curParset === 0 ? 'active' : ''}" data-parset="0">0: Additive / Formant</button>
            <button type="button" class="ndb-chip ${curParset === 1 ? 'active' : ''}" data-parset="1">1: FM Cross-Mod</button>
            <button type="button" class="ndb-chip ${curParset === 2 ? 'active' : ''}" data-parset="2">2: Harmonic Tilt</button>
            <button type="button" class="ndb-chip ${curParset === 3 ? 'active' : ''}" data-parset="3">3: Peak Shifter</button>
            <button type="button" class="ndb-chip ${curParset === 4 ? 'active' : ''}" data-parset="4">4: Saturation</button>
            <button type="button" class="ndb-chip ${curParset === 5 ? 'active' : ''}" data-parset="5">5: Ring Mod</button>
            <button type="button" class="ndb-chip ${curParset === 6 ? 'active' : ''}" data-parset="6">6: Dispersion</button>
          </div>
        </div>

        <!-- 2. Afinación, Volumen & Modulación del Resonador -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <div class="panel-caption" style="margin-bottom: var(--space-2); color: var(--color-accent); font-weight: 700;">TUNING, LEVEL & VELOCITY ZONE SWITCH</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">OCTAVE [${isR1 ? 33 : 113}]: <strong id="${rPrefix}-oct-val">${curOct - 2 >= 0 ? '+' : ''}${curOct - 2}</strong></span>
              <input type="range" class="abd-slider" id="${rPrefix}-oct-slider" min="0" max="3" value="${curOct}" step="1" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">SEMITONES [${isR1 ? 34 : 114}]: <strong id="${rPrefix}-semi-val">${curSemi}</strong></span>
              <input type="range" class="abd-slider" data-param="${isR1 ? 34 : 114}" data-val="${rPrefix}-semi-val" min="-24" max="24" value="${curSemi}" step="1" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">FINE CENTS [${isR1 ? 35 : 115}]: <strong id="${rPrefix}-cents-val">${curCents}</strong></span>
              <input type="range" class="abd-slider" data-param="${isR1 ? 35 : 115}" data-val="${rPrefix}-cents-val" min="-99" max="99" value="${curCents}" step="1" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">VOLUME [${isR1 ? 27 : 107}]: <strong id="${rPrefix}-vol-val">${curVol}</strong></span>
              <input type="range" class="abd-slider" data-param="${isR1 ? 27 : 107}" data-val="${rPrefix}-vol-val" min="0" max="127" value="${curVol}" step="1" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">PITCH LFO [${isR1 ? 36 : 116}]: <strong id="${rPrefix}-plfo-val">${curPitchLfo}</strong></span>
              <input type="range" class="abd-slider" data-param="${isR1 ? 36 : 116}" data-val="${rPrefix}-plfo-val" min="-64" max="63" value="${curPitchLfo}" step="1" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">VEL SWITCH [${isR1 ? 41 : 121}]: <strong id="${rPrefix}-vsw-val">${curVelSw}</strong></span>
              <input type="range" class="abd-slider" data-param="${isR1 ? 41 : 121}" data-val="${rPrefix}-vsw-val" min="1" max="127" value="${curVelSw}" step="1" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">AMP LFO [${isR1 ? 28 : 108}]: <strong id="${rPrefix}-alfo-val">${curAmpLfo}</strong></span>
              <input type="range" class="abd-slider" data-param="${isR1 ? 28 : 108}" data-val="${rPrefix}-alfo-val" min="-64" max="63" value="${curAmpLfo}" step="1" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">PITCH KEYTRACK [${isR1 ? 37 : 117}]: <strong id="${rPrefix}-pkt-val">${curPitchKt}</strong></span>
              <input type="range" class="abd-slider" data-param="${isR1 ? 37 : 117}" data-val="${rPrefix}-pkt-val" min="-64" max="63" value="${curPitchKt}" step="1" style="width: 100%;" />
            </div>
          </div>
        </div>

        <!-- 3. Envolventes ADSR de Amplitud y Resonador (ResEnv) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">AMPLITUDE ADSR ([${baseAdsrParam}..${baseAdsrParam + 3}]) & RESONATOR ADSR ([${baseResEnvParam}..${baseResEnvParam + 3}])</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2);">
            <div>
              <span class="hud-label">AMP A: <strong id="${rPrefix}-adsr-a-val">${curAdsrA}</strong></span>
              <input type="range" class="abd-slider" data-param="${baseAdsrParam}" data-val="${rPrefix}-adsr-a-val" min="0" max="127" value="${curAdsrA}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">AMP D: <strong id="${rPrefix}-adsr-d-val">${curAdsrD}</strong></span>
              <input type="range" class="abd-slider" data-param="${baseAdsrParam + 1}" data-val="${rPrefix}-adsr-d-val" min="0" max="127" value="${curAdsrD}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">AMP S: <strong id="${rPrefix}-adsr-s-val">${curAdsrS}</strong></span>
              <input type="range" class="abd-slider" data-param="${baseAdsrParam + 2}" data-val="${rPrefix}-adsr-s-val" min="0" max="127" value="${curAdsrS}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">AMP R: <strong id="${rPrefix}-adsr-r-val">${curAdsrR}</strong></span>
              <input type="range" class="abd-slider" data-param="${baseAdsrParam + 3}" data-val="${rPrefix}-adsr-r-val" min="0" max="127" value="${curAdsrR}" style="width: 100%;" />
            </div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--color-panel-border-dim);">
            <div>
              <span class="hud-label">RES A: <strong id="${rPrefix}-res-a-val">${curResA}</strong></span>
              <input type="range" class="abd-slider" data-param="${baseResEnvParam}" data-val="${rPrefix}-res-a-val" min="0" max="127" value="${curResA}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">RES D: <strong id="${rPrefix}-res-d-val">${curResD}</strong></span>
              <input type="range" class="abd-slider" data-param="${baseResEnvParam + 1}" data-val="${rPrefix}-res-d-val" min="0" max="127" value="${curResD}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">RES S: <strong id="${rPrefix}-res-s-val">${curResS}</strong></span>
              <input type="range" class="abd-slider" data-param="${baseResEnvParam + 2}" data-val="${rPrefix}-res-s-val" min="0" max="127" value="${curResS}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">RES R: <strong id="${rPrefix}-res-r-val">${curResR}</strong></span>
              <input type="range" class="abd-slider" data-param="${baseResEnvParam + 3}" data-val="${rPrefix}-res-r-val" min="0" max="127" value="${curResR}" style="width: 100%;" />
            </div>
          </div>
        </div>

        <!-- 4. LFO Global ([256..260]) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">GLOBAL MODULATION LFO ([256..260])</span>
            <label style="font-size: var(--text-xs); cursor: pointer;">
              <input type="checkbox" id="chk-global-lfo" ${lfoOn ? 'checked' : ''} /> ENABLE LFO [256]
            </label>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2);">
            <div>
              <span class="hud-label">DEPTH [257]: <strong id="glfo-d-val">${lfoDepth}</strong></span>
              <input type="range" class="abd-slider" data-param="257" data-val="glfo-d-val" min="0" max="127" value="${lfoDepth}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">RATE [258]: <strong id="glfo-r-val">${lfoRate}</strong></span>
              <input type="range" class="abd-slider" data-param="258" data-val="glfo-r-val" min="0" max="1000" value="${lfoRate}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">DELAY [259]: <strong id="glfo-dl-val">${lfoDelay}</strong></span>
              <input type="range" class="abd-slider" data-param="259" data-val="glfo-dl-val" min="-64" max="63" value="${lfoDelay}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">WAVE [260]: <strong id="glfo-w-val">${lfoWave}</strong></span>
              <input type="range" class="abd-slider" data-param="260" data-val="glfo-w-val" min="0" max="11" value="${lfoWave}" style="width: 100%;" />
            </div>
          </div>
        </div>

        <!-- 5. Pad de Envolvente Multinivel 4L4T (@abdsynths/shared) -->
        <div id="${rPrefix}-shaper-mount"></div>
      </div>
    `;

    el.querySelector('#btn-close-resy-drawer')?.addEventListener('click', () => {
      props.onClose();
    });

    el.querySelector('#btn-drawer-select-model')?.addEventListener('click', () => {
      props.onSelectModel?.(props.resynator);
    });

    const swBtn = el.querySelector('#btn-resy-switch') as HTMLElement | null;
    swBtn?.addEventListener('click', () => {
      const next = !swBtn.classList.contains('active');
      swBtn.classList.toggle('active', next);
      swBtn.classList.toggle('btn-primary', next);
      swBtn.classList.toggle('btn-outline', !next);
      swBtn.textContent = `${rPrefix}: ${next ? 'ON' : 'MUTED'}`;
      WebBridge.setParam(isR1 ? 23 : 103, next ? 1 : 0);
    });

    const lfoChk = el.querySelector('#chk-global-lfo') as HTMLInputElement | null;
    lfoChk?.addEventListener('change', () => {
      WebBridge.setParam(ParamIdx.LFOSwitch, lfoChk.checked ? 1 : 0);
    });

    // Octave slider [33 / 113] (0..3 -> displayed -2..+1)
    const octSlider = el.querySelector(`#${rPrefix}-oct-slider`) as HTMLInputElement | null;
    const octVal = el.querySelector(`#${rPrefix}-oct-val`);
    octSlider?.addEventListener('input', () => {
      const v = parseInt(octSlider.value, 10);
      const disp = v - 2;
      if (octVal) octVal.textContent = `${disp >= 0 ? '+' : ''}${disp}`;
      WebBridge.setParam(isR1 ? 33 : 113, v);
    });

    // Generic data-param sliders
    el.querySelectorAll('input[type="range"][data-param]').forEach((input) => {
      const slider = input as HTMLInputElement;
      const paramId = parseInt(slider.getAttribute('data-param') || '0', 10);
      const valId = slider.getAttribute('data-val') || '';
      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        const valEl = valId ? el.querySelector(`#${valId}`) : null;
        if (valEl) valEl.textContent = String(val);
        WebBridge.setParam(paramId, val);
      });
    });

    // Parset chips
    el.querySelectorAll('[data-parset]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        el.querySelectorAll('[data-parset]').forEach((c) => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const parset = parseInt(target.getAttribute('data-parset') || '0', 10);
        WebBridge.setParam(isR1 ? 24 : 104, parset);
      });
    });

    // Montar MultiStageShaperPad canónico de ABDShared
    const shaperMount = el.querySelector(`#${rPrefix}-shaper-mount`) as HTMLElement | null;
    if (shaperMount) {
      new MultiStageShaperPad(shaperMount, {
        label: `${rPrefix} 4L4T SHAPER CONTOUR ([242..253])`,
        bipolar: true,
        editable: true,
        times: curShaperTimes,
        levels: curShaperLevels,
        mode: curShaperMode,
        onChange: (val) => {
          val.levels.forEach((lvl, idx) => {
            WebBridge.setParam(ParamIdx.FreeEnvLevel1 + idx, Math.round(lvl * 63));
          });
          val.times.forEach((t, idx) => {
            WebBridge.setParam(ParamIdx.FreeEnvTime1 + idx, Math.round(t * 127));
          });
          WebBridge.setParam(ParamIdx.Shaper12Status, val.mode);
        },
      });
    }

    return el;
  }
}
