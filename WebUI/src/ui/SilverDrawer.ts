// ─────────────────────────────────────────────────────────
// ABDAxionikVS — SilverDrawer.ts
// Panel lateral deslizante (50vw) para el Silver Rack completo ([271..362]):
// - Nivel 1: Silver Multimode Filter ([273..278]) + Filter ADSR ([355..361])
// - Nivel 2: FreqFX ([281..326]):
//     0: 4-Band Parametric/Shelf EQ ([285..301]) + Compressor ([302..305])
//     1: Distortion ([306..309], 6 curvas)
//     2: Ring Modulator ([310..317])
//     3: Decimator ([324..326])
//     4: Spectral Warp ([318..323])
// - Nivel 3: TimeFX ([327..354]):
//     0: Stereo Spread ([331..332])
//     1: L/R Delay ([333..335])
//     2: Flanger ([336..341])
//     3: Phaser ([342..347])
//     4: Chorus ([348..354])
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';

export interface SilverDrawerProps {
  onClose: () => void;
}

export class SilverDrawer {
  public static createContent(props: SilverDrawerProps): HTMLElement {
    const silverOn = Math.round(WebBridge.getParam(271, 1)) > 0;
    const curFtype = Math.round(WebBridge.getParam(273, 0));
    const curCutoff = Math.round(WebBridge.getParam(274, 100));
    const curReso = Math.round(WebBridge.getParam(275, 20));
    const curFilterLfo = Math.round(WebBridge.getParam(276, 0));
    const curFilterKt = Math.round(WebBridge.getParam(277, 0));
    const curFilterVel = Math.round(WebBridge.getParam(278, 0));

    const curFEnvA = Math.round(WebBridge.getParam(355, 10));
    const curFEnvD = Math.round(WebBridge.getParam(356, 40));
    const curFEnvS = Math.round(WebBridge.getParam(357, 64));
    const curFEnvR = Math.round(WebBridge.getParam(358, 30));
    const curFEnvDepth = Math.round(WebBridge.getParam(360, 0));

    const curFreqEnable = Math.round(WebBridge.getParam(281, 0)) !== 0;
    const curFreqAlgo = Math.max(0, Math.min(4, Math.round(WebBridge.getParam(282, 0))));

    const curTimeEnable = Math.round(WebBridge.getParam(327, 0)) !== 0;
    const curTimeAlgo = Math.max(0, Math.min(4, Math.round(WebBridge.getParam(328, 0))));

    const el = document.createElement('div');
    el.className = 'silver-drawer-view';
    el.innerHTML = `
      <div class="drawer-header ndb-modal-header">
        <div class="drawer-title ndb-header-title">
          <span class="drawer-icon">${ICONS.sliders}</span>
          <span class="ndb-title-text">SILVER MULTIEFFECTS & FILTER RACK</span>
          <span class="panel-badge ndb-badge">[271..362]</span>
        </div>
        <div class="drawer-header-actions" style="display: flex; align-items: center; gap: var(--space-2);">
          <button type="button" class="btn btn-xs ${silverOn ? 'btn-primary active' : 'btn-outline'}" id="btn-silver-master-switch" title="SilverSwitch [271]">
            SILVER RACK: ${silverOn ? 'ON' : 'BYPASS'}
          </button>
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-silver-drawer" title="Close (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <div class="drawer-scrollable-content" style="padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); overflow-y: auto;">
        <!-- 1. Silver Level 1: Multimode Filter + Filter ADSR ([273..278, 355..361]) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">L1: MULTIMODE FILTER & ADSR ([273..278, 355..361])</span>
            <div class="ndb-chips-row" style="gap: 4px;">
              <button type="button" class="ndb-chip ${curFtype === 0 ? 'active' : ''}" data-ftype="0">0: LP 24dB</button>
              <button type="button" class="ndb-chip ${curFtype === 1 ? 'active' : ''}" data-ftype="1">1: LP 12dB</button>
              <button type="button" class="ndb-chip ${curFtype === 2 ? 'active' : ''}" data-ftype="2">2:LP 6dB</button>
              <button type="button" class="ndb-chip ${curFtype === 3 ? 'active' : ''}" data-ftype="3">3: Bandpass</button>
              <button type="button" class="ndb-chip ${curFtype === 4 ? 'active' : ''}" data-ftype="4">4: Highpass</button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">CUTOFF [274]: <strong id="silver-cut-val">${curCutoff}</strong></span>
              <input type="range" class="abd-slider" data-param="274" data-val="silver-cut-val" min="0" max="127" value="${curCutoff}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">RESO [275]: <strong id="silver-res-val">${curReso}</strong></span>
              <input type="range" class="abd-slider" data-param="275" data-val="silver-res-val" min="0" max="127" value="${curReso}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">ENV DEPTH [360]: <strong id="silver-envd-val">${curFEnvDepth}</strong></span>
              <input type="range" class="abd-slider" data-param="360" data-val="silver-envd-val" min="-64" max="63" value="${curFEnvDepth}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">LFO DEPTH [276]: <strong id="silver-lfo-val">${curFilterLfo}</strong></span>
              <input type="range" class="abd-slider" data-param="276" data-val="silver-lfo-val" min="-64" max="63" value="${curFilterLfo}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">KEYTRACK [277]: <strong id="silver-kt-val">${curFilterKt}</strong></span>
              <input type="range" class="abd-slider" data-param="277" data-val="silver-kt-val" min="-64" max="63" value="${curFilterKt}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">VEL DEPTH [278]: <strong id="silver-vel-val">${curFilterVel}</strong></span>
              <input type="range" class="abd-slider" data-param="278" data-val="silver-vel-val" min="-64" max="63" value="${curFilterVel}" style="width: 100%;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--color-panel-border-dim);">
            <div>
              <span class="hud-label">FILT A [355]: <strong id="fenv-a-val">${curFEnvA}</strong></span>
              <input type="range" class="abd-slider" data-param="355" data-val="fenv-a-val" min="0" max="127" value="${curFEnvA}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">FILT D [356]: <strong id="fenv-d-val">${curFEnvD}</strong></span>
              <input type="range" class="abd-slider" data-param="356" data-val="fenv-d-val" min="0" max="127" value="${curFEnvD}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">FILT S [357]: <strong id="fenv-s-val">${curFEnvS}</strong></span>
              <input type="range" class="abd-slider" data-param="357" data-val="fenv-s-val" min="0" max="127" value="${curFEnvS}" style="width: 100%;" />
            </div>
            <div>
              <span class="hud-label">FILT R [358]: <strong id="fenv-r-val">${curFEnvR}</strong></span>
              <input type="range" class="abd-slider" data-param="358" data-val="fenv-r-val" min="0" max="127" value="${curFEnvR}" style="width: 100%;" />
            </div>
          </div>
        </div>

        <!-- 2. Silver Level 2: FreqFX (5 Algoritmos Canónicos [281..326]) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">L2: FREQUENCY FX ([281..326])</span>
            <label style="font-size: var(--text-xs); display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="checkbox" id="check-freqfx-enable" ${curFreqEnable ? 'checked' : ''} /> ENABLE [281]
            </label>
          </div>
          <div class="ndb-chips-row" style="flex-wrap: wrap; gap: var(--space-1);">
            <button type="button" class="ndb-chip ${curFreqAlgo === 0 ? 'active' : ''}" data-freqalgo="0">0: 4-Band EQ + Comp</button>
            <button type="button" class="ndb-chip ${curFreqAlgo === 1 ? 'active' : ''}" data-freqalgo="1">1: Distortion</button>
            <button type="button" class="ndb-chip ${curFreqAlgo === 2 ? 'active' : ''}" data-freqalgo="2">2: Ring Modulator</button>
            <button type="button" class="ndb-chip ${curFreqAlgo === 3 ? 'active' : ''}" data-freqalgo="3">3: Decimator</button>
            <button type="button" class="ndb-chip ${curFreqAlgo === 4 ? 'active' : ''}" data-freqalgo="4">4: Spectral Warp</button>
          </div>
          <div id="freqfx-subpanel"></div>
        </div>

        <!-- 3. Silver Level 3: TimeFX (5 Algoritmos Canónicos [327..354]) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">L3: TIME & MODULATION FX ([327..354])</span>
            <label style="font-size: var(--text-xs); display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="checkbox" id="check-timefx-enable" ${curTimeEnable ? 'checked' : ''} /> ENABLE [327]
            </label>
          </div>
          <div class="ndb-chips-row" style="flex-wrap: wrap; gap: var(--space-1);">
            <button type="button" class="ndb-chip ${curTimeAlgo === 0 ? 'active' : ''}" data-timealgo="0">0: Stereo Spread</button>
            <button type="button" class="ndb-chip ${curTimeAlgo === 1 ? 'active' : ''}" data-timealgo="1">1: L/R Delay</button>
            <button type="button" class="ndb-chip ${curTimeAlgo === 2 ? 'active' : ''}" data-timealgo="2">2: Flanger</button>
            <button type="button" class="ndb-chip ${curTimeAlgo === 3 ? 'active' : ''}" data-timealgo="3">3: Phaser</button>
            <button type="button" class="ndb-chip ${curTimeAlgo === 4 ? 'active' : ''}" data-timealgo="4">4: Chorus</button>
          </div>
          <div id="timefx-subpanel"></div>
        </div>
      </div>
    `;

    const bindAllSlidersAndToggles = (container: ParentNode) => {
      container.querySelectorAll('input[type="range"][data-param]').forEach((input) => {
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
      container.querySelectorAll('input[type="checkbox"][data-param]').forEach((input) => {
        const chk = input as HTMLInputElement;
        const paramId = parseInt(chk.getAttribute('data-param') || '0', 10);
        chk.addEventListener('change', () => {
          WebBridge.setParam(paramId, chk.checked ? 1 : 0);
        });
      });
      container.querySelectorAll('select[data-param]').forEach((select) => {
        const sel = select as HTMLSelectElement;
        const paramId = parseInt(sel.getAttribute('data-param') || '0', 10);
        sel.addEventListener('change', () => {
          WebBridge.setParam(paramId, parseInt(sel.value, 10));
        });
      });
    };

    const renderFreqSubpanel = (algo: number) => {
      const host = el.querySelector('#freqfx-subpanel');
      if (!host) return;
      const g = (idx: number, def: number) => Math.round(WebBridge.getParam(idx, def));

      if (algo === 0) {
        // EQ 4-Band ([285..301]) + Compressor ([302..305])
        host.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label style="font-size: var(--text-xs); font-weight: 600;"><input type="checkbox" data-param="285" ${g(285, 1) ? 'checked' : ''} /> 4-BAND PARAMETRIC EQ [285]</label>
              <label style="font-size: var(--text-xs); font-weight: 600;"><input type="checkbox" data-param="302" ${g(302, 0) ? 'checked' : ''} /> COMPRESSOR [302]</label>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); background: var(--color-bg-base); padding: var(--space-2); border-radius: var(--radius-sm);">
              <!-- Low Shelf -->
              <div>
                <label style="font-size: 10px;"><input type="checkbox" data-param="286" ${g(286, 1) ? 'checked' : ''} /> LOW SHELF</label>
                <div class="hud-label">GAIN: <strong id="eq-ls-g">${g(287, 0)}</strong></div>
                <input type="range" class="abd-slider" data-param="287" data-val="eq-ls-g" min="-48" max="48" value="${g(287, 0)}" style="width:100%;" />
                <div class="hud-label">FREQ: <strong id="eq-ls-f">${g(288, 75)}</strong></div>
                <input type="range" class="abd-slider" data-param="288" data-val="eq-ls-f" min="0" max="127" value="${g(288, 75)}" style="width:100%;" />
              </div>
              <!-- Band 1 -->
              <div>
                <label style="font-size: 10px;"><input type="checkbox" data-param="290" ${g(290, 1) ? 'checked' : ''} /> BAND 1</label>
                <div class="hud-label">GAIN: <strong id="eq-b1-g">${g(291, 0)}</strong></div>
                <input type="range" class="abd-slider" data-param="291" data-val="eq-b1-g" min="-48" max="48" value="${g(291, 0)}" style="width:100%;" />
                <div class="hud-label">FREQ: <strong id="eq-b1-f">${g(292, 75)}</strong></div>
                <input type="range" class="abd-slider" data-param="292" data-val="eq-b1-f" min="0" max="127" value="${g(292, 75)}" style="width:100%;" />
              </div>
              <!-- Band 2 -->
              <div>
                <label style="font-size: 10px;"><input type="checkbox" data-param="294" ${g(294, 1) ? 'checked' : ''} /> BAND 2</label>
                <div class="hud-label">GAIN: <strong id="eq-b2-g">${g(295, 0)}</strong></div>
                <input type="range" class="abd-slider" data-param="295" data-val="eq-b2-g" min="-48" max="48" value="${g(295, 0)}" style="width:100%;" />
                <div class="hud-label">FREQ: <strong id="eq-b2-f">${g(296, 75)}</strong></div>
                <input type="range" class="abd-slider" data-param="296" data-val="eq-b2-f" min="0" max="127" value="${g(296, 75)}" style="width:100%;" />
              </div>
              <!-- High Shelf -->
              <div>
                <label style="font-size: 10px;"><input type="checkbox" data-param="298" ${g(298, 1) ? 'checked' : ''} /> HIGH SHELF</label>
                <div class="hud-label">GAIN: <strong id="eq-hs-g">${g(299, 0)}</strong></div>
                <input type="range" class="abd-slider" data-param="299" data-val="eq-hs-g" min="-48" max="48" value="${g(299, 0)}" style="width:100%;" />
                <div class="hud-label">FREQ: <strong id="eq-hs-f">${g(300, 75)}</strong></div>
                <input type="range" class="abd-slider" data-param="300" data-val="eq-hs-f" min="0" max="127" value="${g(300, 75)}" style="width:100%;" />
              </div>
            </div>
            <!-- Compressor [303..305] -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); padding-top: 4px;">
              <div>
                <span class="hud-label">COMP THRESH [303]: <strong id="cr-th-v">${g(303, -12)} dB</strong></span>
                <input type="range" class="abd-slider" data-param="303" data-val="cr-th-v" min="-48" max="0" value="${g(303, -12)}" style="width:100%;" />
              </div>
              <div>
                <span class="hud-label">COMP OUT GAIN [304]: <strong id="cr-og-v">${g(304, 20)}</strong></span>
                <input type="range" class="abd-slider" data-param="304" data-val="cr-og-v" min="0" max="120" value="${g(304, 20)}" style="width:100%;" />
              </div>
              <div>
                <span class="hud-label">RESPONSIVENESS [305]: <strong id="cr-rs-v">${g(305, 64)}</strong></span>
                <input type="range" class="abd-slider" data-param="305" data-val="cr-rs-v" min="0" max="127" value="${g(305, 64)}" style="width:100%;" />
              </div>
            </div>
          </div>
        `;
      } else if (algo === 1) {
        // Distortion [306..309]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">IN GAIN [306]: <strong id="ds-in-v">${g(306, 64)}</strong></span>
              <input type="range" class="abd-slider" data-param="306" data-val="ds-in-v" min="0" max="127" value="${g(306, 64)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">PRE-FILTER [307]: <strong id="ds-pf-v">${g(307, 64)}</strong></span>
              <input type="range" class="abd-slider" data-param="307" data-val="ds-pf-v" min="0" max="127" value="${g(307, 64)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">CURVE [308]: <strong id="ds-cv-v">${g(308, 1)}</strong></span>
              <input type="range" class="abd-slider" data-param="308" data-val="ds-cv-v" min="0" max="5" value="${g(308, 1)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">OUT GAIN [309]: <strong id="ds-out-v">${g(309, 64)}</strong></span>
              <input type="range" class="abd-slider" data-param="309" data-val="ds-out-v" min="0" max="127" value="${g(309, 64)}" style="width:100%;" />
            </div>
          </div>
        `;
      } else if (algo === 2) {
        // Ring Mod [310..317]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">MIX [310]: <strong id="rm-m-v">${g(310, 64)}</strong></span>
              <input type="range" class="abd-slider" data-param="310" data-val="rm-m-v" min="0" max="127" value="${g(310, 64)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">MOD FREQ [314]: <strong id="rm-f-v">${g(314, 40)}</strong></span>
              <input type="range" class="abd-slider" data-param="314" data-val="rm-f-v" min="0" max="127" value="${g(314, 40)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">LFO SPEED [311]: <strong id="rm-s-v">${g(311, 50)}</strong></span>
              <input type="range" class="abd-slider" data-param="311" data-val="rm-s-v" min="0" max="200" value="${g(311, 50)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">LFO DEPTH [312]: <strong id="rm-d-v">${g(312, 32)}</strong></span>
              <input type="range" class="abd-slider" data-param="312" data-val="rm-d-v" min="0" max="127" value="${g(312, 32)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">XOVER DELAY [315]: <strong id="rm-x-v">${g(315, 0)}</strong></span>
              <input type="range" class="abd-slider" data-param="315" data-val="rm-x-v" min="0" max="127" value="${g(315, 0)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">XOVER FDBK [317]: <strong id="rm-fb-v">${g(317, 0)}</strong></span>
              <input type="range" class="abd-slider" data-param="317" data-val="rm-fb-v" min="-64" max="63" value="${g(317, 0)}" style="width:100%;" />
            </div>
          </div>
        `;
      } else if (algo === 3) {
        // Decimator [324..326]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">MIX [324]: <strong id="dc-m-v">${g(324, 64)}</strong></span>
              <input type="range" class="abd-slider" data-param="324" data-val="dc-m-v" min="0" max="127" value="${g(324, 64)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">S&H FACTOR [325]: <strong id="dc-sh-v">${g(325, 16)}</strong></span>
              <input type="range" class="abd-slider" data-param="325" data-val="dc-sh-v" min="0" max="127" value="${g(325, 16)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">PRE-FILTER [326]: <strong id="dc-pf-v">${g(326, 80)}</strong></span>
              <input type="range" class="abd-slider" data-param="326" data-val="dc-pf-v" min="0" max="127" value="${g(326, 80)}" style="width:100%;" />
            </div>
          </div>
        `;
      } else {
        // Spectral Warp [318..323]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">MIX [318]: <strong id="sw-m-v">${g(318, 64)}</strong></span>
              <input type="range" class="abd-slider" data-param="318" data-val="sw-m-v" min="0" max="127" value="${g(318, 64)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">FREQUENCY [319]: <strong id="sw-f-v">${g(319, 64)}</strong></span>
              <input type="range" class="abd-slider" data-param="319" data-val="sw-f-v" min="0" max="127" value="${g(319, 64)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">TILT [320]: <strong id="sw-t-v">${g(320, 64)}</strong></span>
              <input type="range" class="abd-slider" data-param="320" data-val="sw-t-v" min="0" max="127" value="${g(320, 64)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">DAMPING [321]: <strong id="sw-dm-v">${g(321, 32)}</strong></span>
              <input type="range" class="abd-slider" data-param="321" data-val="sw-dm-v" min="0" max="127" value="${g(321, 32)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">LFO SPEED [322]: <strong id="sw-sp-v">${g(322, 40)}</strong></span>
              <input type="range" class="abd-slider" data-param="322" data-val="sw-sp-v" min="0" max="200" value="${g(322, 40)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">LFO DEPTH [323]: <strong id="sw-dp-v">${g(323, 32)}</strong></span>
              <input type="range" class="abd-slider" data-param="323" data-val="sw-dp-v" min="0" max="127" value="${g(323, 32)}" style="width:100%;" />
            </div>
          </div>
        `;
      }
      bindAllSlidersAndToggles(host);
    };

    const renderTimeSubpanel = (algo: number) => {
      const host = el.querySelector('#timefx-subpanel');
      if (!host) return;
      const g = (idx: number, def: number) => Math.round(WebBridge.getParam(idx, def));

      if (algo === 0) {
        // Stereo Spread [331..332]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
            <div>
              <span class="hud-label">CHANNEL DELAY MS [331]: <strong id="ss-d-v">${g(331, 12)}</strong></span>
              <input type="range" class="abd-slider" data-param="331" data-val="ss-d-v" min="-64" max="63" value="${g(331, 12)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">FEEDBACK [332]: <strong id="ss-fb-v">${g(332, 16)}</strong></span>
              <input type="range" class="abd-slider" data-param="332" data-val="ss-fb-v" min="-64" max="63" value="${g(332, 16)}" style="width:100%;" />
            </div>
          </div>
        `;
      } else if (algo === 1) {
        // L/R Delay [333..335]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">MIX [333]: <strong id="lrd-m-v">${g(333, 50)}</strong></span>
              <input type="range" class="abd-slider" data-param="333" data-val="lrd-m-v" min="0" max="127" value="${g(333, 50)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">DELAY TIME MS [334]: <strong id="lrd-t-v">${g(334, 350)}</strong></span>
              <input type="range" class="abd-slider" data-param="334" data-val="lrd-t-v" min="0" max="1000" value="${g(334, 350)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">FEEDBACK [335]: <strong id="lrd-fb-v">${g(335, 25)}</strong></span>
              <input type="range" class="abd-slider" data-param="335" data-val="lrd-fb-v" min="-64" max="63" value="${g(335, 25)}" style="width:100%;" />
            </div>
          </div>
        `;
      } else {
        // Flanger (2: [336..341]), Phaser (3: [342..347]), Chorus (4: [348..354])
        const base = algo === 2 ? 336 : (algo === 3 ? 342 : 348);
        const preDelayHtml = algo === 4 ? `
          <div>
            <span class="hud-label">PRE-DELAY [354]: <strong id="tfx-pd-v">${g(354, 25)}</strong></span>
            <input type="range" class="abd-slider" data-param="354" data-val="tfx-pd-v" min="0" max="127" value="${g(354, 25)}" style="width:100%;" />
          </div>
        ` : '';
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
            <div>
              <span class="hud-label">MIX [${base}]: <strong id="tfx-m-v">${g(base, 64)}</strong></span>
              <input type="range" class="abd-slider" data-param="${base}" data-val="tfx-m-v" min="0" max="127" value="${g(base, 64)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">DEPTH [${base + 1}]: <strong id="tfx-d-v">${g(base + 1, 64)}</strong></span>
              <input type="range" class="abd-slider" data-param="${base + 1}" data-val="tfx-d-v" min="0" max="127" value="${g(base + 1, 64)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">SPEED [${base + 2}]: <strong id="tfx-s-v">${g(base + 2, 40)}</strong></span>
              <input type="range" class="abd-slider" data-param="${base + 2}" data-val="tfx-s-v" min="0" max="200" value="${g(base + 2, 40)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">WAVEFORM [${base + 3}]: <strong id="tfx-w-v">${g(base + 3, 0)}</strong></span>
              <input type="range" class="abd-slider" data-param="${base + 3}" data-val="tfx-w-v" min="0" max="11" value="${g(base + 3, 0)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">FEEDBACK [${base + 4}]: <strong id="tfx-fb-v">${g(base + 4, 20)}</strong></span>
              <input type="range" class="abd-slider" data-param="${base + 4}" data-val="tfx-fb-v" min="-64" max="63" value="${g(base + 4, 20)}" style="width:100%;" />
            </div>
            <div>
              <span class="hud-label">STEREO PHASE [${base + 5}]: <strong id="tfx-ph-v">${g(base + 5, 0)}</strong></span>
              <input type="range" class="abd-slider" data-param="${base + 5}" data-val="tfx-ph-v" min="-64" max="63" value="${g(base + 5, 0)}" style="width:100%;" />
            </div>
            ${preDelayHtml}
          </div>
        `;
      }
      bindAllSlidersAndToggles(host);
    };

    bindAllSlidersAndToggles(el);
    renderFreqSubpanel(curFreqAlgo);
    renderTimeSubpanel(curTimeAlgo);

    el.querySelector('#btn-close-silver-drawer')?.addEventListener('click', () => {
      props.onClose();
    });

    const silverSwitchBtn = el.querySelector('#btn-silver-master-switch') as HTMLElement | null;
    silverSwitchBtn?.addEventListener('click', () => {
      const next = !silverSwitchBtn.classList.contains('active');
      silverSwitchBtn.classList.toggle('active', next);
      silverSwitchBtn.classList.toggle('btn-primary', next);
      silverSwitchBtn.classList.toggle('btn-outline', !next);
      silverSwitchBtn.textContent = `SILVER RACK: ${next ? 'ON' : 'BYPASS'}`;
      WebBridge.setParam(271, next ? 1 : 0);
    });

    el.querySelectorAll('[data-ftype]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        el.querySelectorAll('[data-ftype]').forEach((c) => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const ftype = parseInt(target.getAttribute('data-ftype') || '0', 10);
        WebBridge.setParam(271, 1);
        WebBridge.setParam(273, ftype);
      });
    });

    el.querySelectorAll('[data-freqalgo]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        el.querySelectorAll('[data-freqalgo]').forEach((c) => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const algo = parseInt(target.getAttribute('data-freqalgo') || '0', 10);
        WebBridge.setParam(282, algo);
        renderFreqSubpanel(algo);
      });
    });

    el.querySelectorAll('[data-timealgo]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        el.querySelectorAll('[data-timealgo]').forEach((c) => c.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const algo = parseInt(target.getAttribute('data-timealgo') || '0', 10);
        WebBridge.setParam(328, algo);
        renderTimeSubpanel(algo);
      });
    });

    const freqCheck = el.querySelector('#check-freqfx-enable') as HTMLInputElement | null;
    freqCheck?.addEventListener('change', () => {
      if (freqCheck.checked) WebBridge.setParam(271, 1);
      WebBridge.setParam(281, freqCheck.checked ? 1 : 0);
    });

    const timeCheck = el.querySelector('#check-timefx-enable') as HTMLInputElement | null;
    timeCheck?.addEventListener('change', () => {
      if (timeCheck.checked) WebBridge.setParam(271, 1);
      WebBridge.setParam(327, timeCheck.checked ? 1 : 0);
    });

    return el;
  }
}
