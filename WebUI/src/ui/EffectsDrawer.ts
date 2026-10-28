// ─────────────────────────────────────────────────────────
// ABDAxionikVS — EffectsDrawer.ts
// Cajón unificado de efectos (50vw) que consolida:
//   - Bloque 1: Silver Multi-Effects & Filter Rack ([271..362])
//       L1: Multimode Filter & ADSR ([273..278, 355..361])
//       L2: FreqFX 5 Algoritmos ([281..326])
//       L3: TimeFX 5 Algoritmos ([327..354])
//   - Bloque 2: Master FX & Spatial Rack ([430..444])
//       Master Stereo Delay [431..436]
//       Master Reverb (ABDeep Schroeder + 8x8 Householder FDN) [437..444]
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';
import { Knob } from '@abdsynths/shared/components/knob.js';

export const REVERB_ROOMS = [
  { id: 0, name: 'Hall' },
  { id: 1, name: 'Plate' },
  { id: 2, name: 'Room' },
  { id: 3, name: 'Chamber' },
  { id: 4, name: 'Ambience' },
];

export interface EffectsDrawerOptions {
  onClose: () => void;
  initialBlock?: 'all' | 'silver' | 'master';
}

export class EffectsDrawer {
  public static createContent(options: EffectsDrawerOptions): HTMLElement {
    // ── Estado Silver ([271..362]) ───────────────────────────
    const silverOn = Math.round(WebBridge.getParam(ParamIdx.SilverSwitch, 1)) > 0;
    const curFtype = Math.round(WebBridge.getParam(ParamIdx.FilterType, 0));
    const curCutoff = Math.round(WebBridge.getParam(ParamIdx.FilterFreq, 100));
    const curReso = Math.round(WebBridge.getParam(ParamIdx.FilterReso, 20));
    const curFilterLfo = Math.round(WebBridge.getParam(ParamIdx.FilterLfoDepth, 0));
    const curFilterKt = Math.round(WebBridge.getParam(ParamIdx.FilterKeyTrack, 0));
    const curFilterVel = Math.round(WebBridge.getParam(ParamIdx.FilterCutoffVelocityDepth, 0));

    const curFEnvA = Math.round(WebBridge.getParam(ParamIdx.FilterEnvA, 10));
    const curFEnvD = Math.round(WebBridge.getParam(ParamIdx.FilterEnvD, 40));
    const curFEnvS = Math.round(WebBridge.getParam(ParamIdx.FilterEnvS, 64));
    const curFEnvR = Math.round(WebBridge.getParam(ParamIdx.FilterEnvR, 30));
    const curFEnvDepth = Math.round(WebBridge.getParam(ParamIdx.FilterEnvDepth, 0));

    const curFreqEnable = Math.round(WebBridge.getParam(ParamIdx.FreqFXSwitch, 0)) !== 0;
    const curFreqAlgo = Math.max(0, Math.min(4, Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 0))));

    const curTimeEnable = Math.round(WebBridge.getParam(ParamIdx.TimeFXSwitch, 0)) !== 0;
    const curTimeAlgo = Math.max(0, Math.min(4, Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 0))));

    // ── Estado Master FX ([430..444]) ─────────────────────────
    const curMasterOn = Math.round(WebBridge.getParam(ParamIdx.SoundMFXSwitch, 1)) > 0;
    const curDelayOn = Math.round(WebBridge.getParam(ParamIdx.SoundMFXDelaySwitch, 1)) > 0;
    const curDelayMix = Math.round(WebBridge.getParam(ParamIdx.SoundMFXDelayMix, 35));
    const curDelayL = Math.round(WebBridge.getParam(ParamIdx.SoundMFXDelayLTime, 250));
    const curDelayR = Math.round(WebBridge.getParam(ParamIdx.SoundMFXDelayRTime, 500));
    const curDelayFb = Math.round(WebBridge.getParam(ParamIdx.SoundMFXDelayFeedback, 25));
    const curDelayDamp = Math.round(WebBridge.getParam(ParamIdx.SoundMFXDelayFdbkDamp, 40));

    const curRevOn = Math.round(WebBridge.getParam(ParamIdx.SoundMFXReverbSwitch, 1)) > 0;
    const curRevMix = Math.round(WebBridge.getParam(ParamIdx.SoundMFXReverbMix, 40));
    const curRevRoom = Math.round(WebBridge.getParam(ParamIdx.SoundMFXReverbRoom, 1));
    const curRevDecay = Math.round(WebBridge.getParam(ParamIdx.SoundMFXRevDecayTime, 65));
    const curRevDiff = Math.round(WebBridge.getParam(ParamIdx.SoundMFXRevDiffusion, 80));
    const curRevDamp = Math.round(WebBridge.getParam(ParamIdx.SoundMFXRevHFDamp, 45));
    const curRevDetune = Math.round(WebBridge.getParam(ParamIdx.SoundMFXRevDetune, 20));
    const curRevSpeed = Math.round(WebBridge.getParam(ParamIdx.SoundMFXRevSpeed, 50));

    const reverbRoomItems = REVERB_ROOMS.map((r) => ({
      id: String(r.id),
      label: `${r.id}: ${r.name}`,
    }));
    const reverbRoomsHtml = pillSelectorHtml(reverbRoomItems, String(curRevRoom), {
      id: 'mfx-reverb-rooms-group',
      size: 'xs',
      attrName: 'data-room',
    });

    const viewSectionItems = [
      { id: 'all', label: 'All Effects' },
      { id: 'silver', label: '1. Silver Multi-FX & Filter' },
      { id: 'master', label: '2. Master Spatial FX' },
    ];
    const viewSectionHtml = pillSelectorHtml(viewSectionItems, options.initialBlock || 'all', {
      id: 'effects-view-section-pills',
      size: 'sm',
      attrName: 'data-view',
    });

    const filterTypeItems = [
      { id: '0', label: '0: LP 24dB' },
      { id: '1', label: '1: LP 12dB' },
      { id: '2', label: '2: LP 6dB' },
      { id: '3', label: '3: Bandpass' },
      { id: '4', label: '4: Highpass' },
    ];
    const filterTypeHtml = pillSelectorHtml(filterTypeItems, String(curFtype), {
      id: 'silver-ftype-group',
      size: 'xs',
      attrName: 'data-ftype',
    });

    const freqAlgoItems = [
      { id: '0', label: '0: 4-Band EQ + Comp' },
      { id: '1', label: '1: Distortion' },
      { id: '2', label: '2: Ring Modulator' },
      { id: '3', label: '3: Decimator' },
      { id: '4', label: '4: Spectral Warp' },
    ];
    const freqAlgoHtml = pillSelectorHtml(freqAlgoItems, String(curFreqAlgo), {
      id: 'silver-freqalgo-group',
      size: 'xs',
      attrName: 'data-freqalgo',
    });

    const timeAlgoItems = [
      { id: '0', label: '0: Stereo Spread' },
      { id: '1', label: '1: L/R Delay' },
      { id: '2', label: '2: Flanger' },
      { id: '3', label: '3: Phaser' },
      { id: '4', label: '4: Chorus' },
    ];
    const timeAlgoHtml = pillSelectorHtml(timeAlgoItems, String(curTimeAlgo), {
      id: 'silver-timealgo-group',
      size: 'xs',
      attrName: 'data-timealgo',
    });

    const renderKnobCell = (mountId: string, valId: string, initialVal: number, unit = '') => `
      <div class="mfx-knob-cell" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <div id="${mountId}"></div>
        <span class="hud-value stat-num" id="${valId}" style="font-size: 11px;">${initialVal}${unit ? ' ' + unit : ''}</span>
      </div>
    `;

    const root = document.createElement('div');
    root.className = 'effects-drawer-view';
    root.style.cssText = 'display: flex; flex-direction: column; height: 100%; box-sizing: border-box;';

    root.innerHTML = `
      <div class="drawer-header ndb-modal-header" style="flex-wrap: wrap; gap: var(--space-2);">
        <div class="drawer-title ndb-header-title" style="flex: 1; min-width: 240px;">
          <span class="drawer-icon">${ICONS.fx}</span>
          <span class="ndb-title-text">EFFECTS RACK (SILVER & MASTER)</span>
          <span class="panel-badge ndb-badge">[271..444]</span>
        </div>
        <div class="drawer-header-actions" style="display: flex; align-items: center; gap: var(--space-2);">
          <button type="button" class="btn btn-xs ${silverOn ? 'btn-primary active' : 'btn-outline'}" id="btn-silver-master-switch" title="Silver Rack Switch [271]">
            SILVER: ${silverOn ? 'ON' : 'BYPASS'}
          </button>
          <button type="button" class="btn btn-xs ${curMasterOn ? 'btn-primary active' : 'btn-outline'}" id="btn-mfx-master-switch" title="SoundMFXSwitch [430]">
            MASTER: ${curMasterOn ? 'ON' : 'BYPASS'}
          </button>
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-effects-drawer" title="Close (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <!-- Quick Section Anchor Bar -->
      <div style="display: flex; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--color-panel-header); border-bottom: 1px solid var(--color-panel-border-dim); align-items: center;">
        <span class="hud-label" style="font-size: 10px; margin-right: 4px;">VIEW SECTION:</span>
        ${viewSectionHtml}
      </div>

      <div class="drawer-scrollable-content" id="effects-scroll-body" style="flex: 1; overflow-y: auto; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4);">
        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- BLOQUE 1: SILVER MULTIEFFECTS & FILTER RACK [271..362]  -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <div id="block-silver-fx" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-accent-dim); padding-bottom: var(--space-1);">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="panel-badge" style="background: var(--color-accent); color: var(--color-bg-base);">BLOQUE 1</span>
              <span class="panel-caption" style="font-weight: 700; color: var(--color-accent); font-size: var(--text-sm);">SILVER MULTIEFFECTS & FILTER RACK ([271..362])</span>
            </div>
            <span class="hud-label" style="font-size: 11px;">INSERT FX CHAIN</span>
          </div>

          <!-- L1: Multimode Filter & ADSR ([273..278, 355..361]) -->
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2);">
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <span class="panel-badge">MULTIMODE FILTER</span>
                <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">L1: MULTIMODE FILTER & ADSR ([273..278, 355..361])</span>
              </div>
              ${filterTypeHtml}
            </div>

            <!-- Fila 1: Controles de Filtro (6 Knobs) -->
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
              ${renderKnobCell('silver-cut-mount', 'silver-cut-val', curCutoff)}
              ${renderKnobCell('silver-res-mount', 'silver-res-val', curReso)}
              ${renderKnobCell('silver-envd-mount', 'silver-envd-val', curFEnvDepth)}
              ${renderKnobCell('silver-lfo-mount', 'silver-lfo-val', curFilterLfo)}
              ${renderKnobCell('silver-kt-mount', 'silver-kt-val', curFilterKt)}
              ${renderKnobCell('silver-vel-mount', 'silver-vel-val', curFilterVel)}
            </div>

            <!-- Fila 2: Envolvente de Filtro ADSR (4 Knobs) -->
            <div style="display: flex; flex-direction: column; gap: var(--space-1); padding-top: var(--space-2); border-top: 1px solid var(--color-panel-border-dim);">
              <span class="hud-label" style="font-size: 10px; font-weight: 700; color: var(--color-accent); letter-spacing: 0.5px;">FILTER ENVELOPE (ADSR)</span>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
                ${renderKnobCell('fenv-a-mount', 'fenv-a-val', curFEnvA)}
                ${renderKnobCell('fenv-d-mount', 'fenv-d-val', curFEnvD)}
                ${renderKnobCell('fenv-s-mount', 'fenv-s-val', curFEnvS)}
                ${renderKnobCell('fenv-r-mount', 'fenv-r-val', curFEnvR)}
              </div>
            </div>
          </div>

          <!-- L2: Frequency FX ([281..326]) -->
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <span class="panel-badge">FREQUENCY FX</span>
                <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">L2: FREQUENCY FX ([281..326])</span>
              </div>
              <button type="button" class="btn btn-xs ${curFreqEnable ? 'btn-primary active' : 'btn-outline'}" id="btn-freqfx-bypass">
                ${curFreqEnable ? 'Active' : 'Bypass'}
              </button>
            </div>
            ${freqAlgoHtml}
            <div id="freqfx-subpanel"></div>
          </div>

          <!-- L3: Time & Modulation FX ([327..354]) -->
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <span class="panel-badge">TIME & MOD</span>
                <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">L3: TIME & MODULATION FX ([327..354])</span>
              </div>
              <button type="button" class="btn btn-xs ${curTimeEnable ? 'btn-primary active' : 'btn-outline'}" id="btn-timefx-bypass">
                ${curTimeEnable ? 'Active' : 'Bypass'}
              </button>
            </div>
            ${timeAlgoHtml}
            <div id="timefx-subpanel"></div>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- BLOQUE 2: MASTER FX & SPATIAL RACK [430..444]           -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <div id="block-master-fx" style="display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-2);">
          <div style="display: align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-accent-dim); padding-bottom: var(--space-1); display: flex;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="panel-badge" style="background: var(--color-accent); color: var(--color-bg-base);">BLOQUE 2</span>
              <span class="panel-caption" style="font-weight: 700; color: var(--color-accent); font-size: var(--text-sm);">MASTER SPATIAL FX & DYNAMICS ([430..444])</span>
            </div>
            <span class="hud-label" style="font-size: 11px;">SEND / RETURN BUS</span>
          </div>

          <!-- Card: Master Stereo Delay [431..436] -->
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <span class="panel-badge">STEREO DELAY</span>
                <span class="panel-caption">Master Spatial Echo [431..436]</span>
              </div>
              <button type="button" class="btn btn-xs ${curDelayOn ? 'btn-primary active' : 'btn-outline'}" id="btn-mfx-delay-bypass">
                ${curDelayOn ? 'Active' : 'Bypass'}
              </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(5, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
              ${renderKnobCell('mfx-delay-mix-mount', 'mfx-delay-mix-val', curDelayMix)}
              ${renderKnobCell('mfx-delay-fb-mount', 'mfx-delay-fb-val', curDelayFb)}
              ${renderKnobCell('mfx-delay-ltime-mount', 'mfx-delay-ltime-val', curDelayL, 'ms')}
              ${renderKnobCell('mfx-delay-rtime-mount', 'mfx-delay-rtime-val', curDelayR, 'ms')}
              ${renderKnobCell('mfx-delay-damp-mount', 'mfx-delay-damp-val', curDelayDamp)}
            </div>
          </div>

          <!-- Card: Master Reverb [437..444] -->
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <span class="panel-badge">MASTER REVERB</span>
                <span class="panel-caption">ABDeep Schroeder + 8x8 Householder FDN [437..444]</span>
              </div>
              <button type="button" class="btn btn-xs ${curRevOn ? 'btn-primary active' : 'btn-outline'}" id="btn-mfx-reverb-bypass">
                ${curRevOn ? 'Active' : 'Bypass'}
              </button>
            </div>

            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              ${reverbRoomsHtml}
            </div>

            <div style="display: grid; grid-template-columns: repeat(6, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
              ${renderKnobCell('mfx-rev-mix-mount', 'mfx-rev-mix-val', curRevMix)}
              ${renderKnobCell('mfx-rev-decay-mount', 'mfx-rev-decay-val', curRevDecay)}
              ${renderKnobCell('mfx-rev-diff-mount', 'mfx-rev-diff-val', curRevDiff)}
              ${renderKnobCell('mfx-rev-damp-mount', 'mfx-rev-damp-val', curRevDamp)}
              ${renderKnobCell('mfx-rev-detune-mount', 'mfx-rev-detune-val', curRevDetune)}
              ${renderKnobCell('mfx-rev-speed-mount', 'mfx-rev-speed-val', curRevSpeed)}
            </div>
          </div>
        </div>
      </div>
    `;

    // ── Helper para instanciación de Knobs ──────────────────
    const initKnob = (
      container: ParentNode,
      mountId: string,
      label: string,
      initVal: number,
      min: number,
      max: number,
      paramId: number,
      valId: string,
      isBipolar = false,
      unit = ''
    ) => {
      const mount = container.querySelector(`#${mountId}`);
      if (!mount) return;
      const range = max - min;
      const normInit = range > 0 ? (initVal - min) / range : 0;
      const valEl = container.querySelector(`#${valId}`);

      new Knob(mount as HTMLElement, {
        size: 40,
        label,
        value: normInit,
        bipolar: isBipolar,
        onChange: (normVal: number) => {
          const actualVal = Math.round(min + normVal * range);
          WebBridge.setParam(paramId, actualVal);
          if (valEl) valEl.textContent = `${actualVal}${unit ? ' ' + unit : ''}`;
        },
      });
    };

    const initMfxKnob = (
      mountId: string,
      label: string,
      initVal: number,
      min: number,
      max: number,
      paramId: number,
      valId: string,
      isBipolar = false,
      unit = ''
    ) => initKnob(root, mountId, label, initVal, min, max, paramId, valId, isBipolar, unit);

    const bindParamToggleButtons = (container: ParentNode) => {
      container.querySelectorAll('button[data-param-toggle]').forEach((btnEl) => {
        const btn = btnEl as HTMLButtonElement;
        const paramId = parseInt(btn.getAttribute('data-param-toggle') || '0', 10);
        btn.addEventListener('click', () => {
          const nextState = !btn.classList.contains('active');
          btn.classList.toggle('active', nextState);
          btn.classList.toggle('btn-primary', nextState);
          btn.classList.toggle('btn-outline', !nextState);
          btn.textContent = nextState ? 'Active' : 'Bypass';
          WebBridge.setParam(paramId, nextState ? 1 : 0);
        });
      });
    };

    // ── Enlaces y listeners comunes ─────────────────────────
    const bindAllSlidersAndToggles = (container: ParentNode) => {
      container.querySelectorAll('input[type="range"][data-param]').forEach((input) => {
        const slider = input as HTMLInputElement;
        const paramId = parseInt(slider.getAttribute('data-param') || '0', 10);
        const valId = slider.getAttribute('data-val') || '';
        slider.addEventListener('input', () => {
          const val = parseFloat(slider.value);
          const valEl = valId ? root.querySelector(`#${valId}`) : null;
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
      bindParamToggleButtons(container);
    };

    // ── Subpaneles dinámicos de Silver FreqFX y TimeFX ───────
    const renderFreqSubpanel = (algo: number) => {
      const host = root.querySelector('#freqfx-subpanel');
      if (!host) return;
      const g = (idx: number, def: number) => Math.round(WebBridge.getParam(idx, def));

      if (algo === 0) {
        // EQ 4-Band ([285..301]) + Compressor ([302..305])
        const eqOn = g(285, 1) > 0;
        const compOn = g(302, 0) > 0;
        const lsOn = g(286, 1) > 0;
        const b1On = g(290, 1) > 0;
        const b2On = g(294, 1) > 0;
        const hsOn = g(298, 1) > 0;

        host.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: var(--space-3);">
            <!-- EQ Section Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-panel-border-dim); padding-bottom: 4px;">
              <span class="panel-caption" style="font-weight: 600; font-size: var(--text-xs); color: var(--color-text-main);">4-BAND PARAMETRIC EQ [285]</span>
              <button type="button" class="btn btn-xs ${eqOn ? 'btn-primary active' : 'btn-outline'}" data-param-toggle="285">
                ${eqOn ? 'Active' : 'Bypass'}
              </button>
            </div>

            <!-- 4 Bands Grid -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); background: var(--color-bg-base); padding: var(--space-2); border-radius: var(--radius-sm);">
              <!-- Low Shelf -->
              <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; background: var(--color-panel-surface); padding: var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--color-panel-border-dim);">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span class="hud-label" style="font-size: 10px; font-weight: 700; color: var(--color-accent);">LOW SHELF</span>
                  <button type="button" class="btn btn-xs ${lsOn ? 'btn-primary active' : 'btn-outline'}" data-param-toggle="286">${lsOn ? 'Active' : 'Bypass'}</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; justify-items: center; width: 100%;">
                  ${renderKnobCell('eq-ls-g-mount', 'eq-ls-g-val', g(287, 0), 'dB')}
                  ${renderKnobCell('eq-ls-f-mount', 'eq-ls-f-val', g(288, 75))}
                </div>
              </div>

              <!-- Band 1 -->
              <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; background: var(--color-panel-surface); padding: var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--color-panel-border-dim);">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span class="hud-label" style="font-size: 10px; font-weight: 700; color: var(--color-accent);">BAND 1</span>
                  <button type="button" class="btn btn-xs ${b1On ? 'btn-primary active' : 'btn-outline'}" data-param-toggle="290">${b1On ? 'Active' : 'Bypass'}</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; justify-items: center; width: 100%;">
                  ${renderKnobCell('eq-b1-g-mount', 'eq-b1-g-val', g(291, 0), 'dB')}
                  ${renderKnobCell('eq-b1-f-mount', 'eq-b1-f-val', g(292, 75))}
                </div>
              </div>

              <!-- Band 2 -->
              <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; background: var(--color-panel-surface); padding: var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--color-panel-border-dim);">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span class="hud-label" style="font-size: 10px; font-weight: 700; color: var(--color-accent);">BAND 2</span>
                  <button type="button" class="btn btn-xs ${b2On ? 'btn-primary active' : 'btn-outline'}" data-param-toggle="294">${b2On ? 'Active' : 'Bypass'}</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; justify-items: center; width: 100%;">
                  ${renderKnobCell('eq-b2-g-mount', 'eq-b2-g-val', g(295, 0), 'dB')}
                  ${renderKnobCell('eq-b2-f-mount', 'eq-b2-f-val', g(296, 75))}
                </div>
              </div>

              <!-- High Shelf -->
              <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; background: var(--color-panel-surface); padding: var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--color-panel-border-dim);">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span class="hud-label" style="font-size: 10px; font-weight: 700; color: var(--color-accent);">HIGH SHELF</span>
                  <button type="button" class="btn btn-xs ${hsOn ? 'btn-primary active' : 'btn-outline'}" data-param-toggle="298">${hsOn ? 'Active' : 'Bypass'}</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; justify-items: center; width: 100%;">
                  ${renderKnobCell('eq-hs-g-mount', 'eq-hs-g-val', g(299, 0), 'dB')}
                  ${renderKnobCell('eq-hs-f-mount', 'eq-hs-f-val', g(300, 75))}
                </div>
              </div>
            </div>

            <!-- Compressor Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-panel-border-dim); padding-bottom: 4px; margin-top: 4px;">
              <span class="panel-caption" style="font-weight: 600; font-size: var(--text-xs); color: var(--color-text-main);">COMPRESSOR [302]</span>
              <button type="button" class="btn btn-xs ${compOn ? 'btn-primary active' : 'btn-outline'}" data-param-toggle="302">
                ${compOn ? 'Active' : 'Bypass'}
              </button>
            </div>

            <!-- Compressor Knobs -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-1) 0;">
              ${renderKnobCell('cr-th-mount', 'cr-th-val', g(303, -12), 'dB')}
              ${renderKnobCell('cr-og-mount', 'cr-og-val', g(304, 20))}
              ${renderKnobCell('cr-rs-mount', 'cr-rs-val', g(305, 64))}
            </div>
          </div>
        `;

        initKnob(host, 'eq-ls-g-mount', 'GAIN [287]', g(287, 0), -48, 48, 287, 'eq-ls-g-val', true, 'dB');
        initKnob(host, 'eq-ls-f-mount', 'FREQ [288]', g(288, 75), 0, 127, 288, 'eq-ls-f-val');
        initKnob(host, 'eq-b1-g-mount', 'GAIN [291]', g(291, 0), -48, 48, 291, 'eq-b1-g-val', true, 'dB');
        initKnob(host, 'eq-b1-f-mount', 'FREQ [292]', g(292, 75), 0, 127, 292, 'eq-b1-f-val');
        initKnob(host, 'eq-b2-g-mount', 'GAIN [295]', g(295, 0), -48, 48, 295, 'eq-b2-g-val', true, 'dB');
        initKnob(host, 'eq-b2-f-mount', 'FREQ [296]', g(296, 75), 0, 127, 296, 'eq-b2-f-val');
        initKnob(host, 'eq-hs-g-mount', 'GAIN [299]', g(299, 0), -48, 48, 299, 'eq-hs-g-val', true, 'dB');
        initKnob(host, 'eq-hs-f-mount', 'FREQ [300]', g(300, 75), 0, 127, 300, 'eq-hs-f-val');

        initKnob(host, 'cr-th-mount', 'THRESH [303]', g(303, -12), -48, 0, 303, 'cr-th-val', false, 'dB');
        initKnob(host, 'cr-og-mount', 'OUT GAIN [304]', g(304, 20), 0, 120, 304, 'cr-og-val');
        initKnob(host, 'cr-rs-mount', 'RESPONSIVENESS [305]', g(305, 64), 0, 127, 305, 'cr-rs-val');
      } else if (algo === 1) {
        // Distortion [306..309]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
            ${renderKnobCell('ds-in-mount', 'ds-in-val', g(306, 64))}
            ${renderKnobCell('ds-pf-mount', 'ds-pf-val', g(307, 64))}
            ${renderKnobCell('ds-cv-mount', 'ds-cv-val', g(308, 1))}
            ${renderKnobCell('ds-out-mount', 'ds-out-val', g(309, 64))}
          </div>
        `;
        initKnob(host, 'ds-in-mount', 'IN GAIN [306]', g(306, 64), 0, 127, 306, 'ds-in-val');
        initKnob(host, 'ds-pf-mount', 'PRE-FILTER [307]', g(307, 64), 0, 127, 307, 'ds-pf-val');
        initKnob(host, 'ds-cv-mount', 'CURVE [308]', g(308, 1), 0, 5, 308, 'ds-cv-val');
        initKnob(host, 'ds-out-mount', 'OUT GAIN [309]', g(309, 64), 0, 127, 309, 'ds-out-val');
      } else if (algo === 2) {
        // Ring Mod [310..317]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(6, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
            ${renderKnobCell('rm-m-mount', 'rm-m-val', g(310, 64))}
            ${renderKnobCell('rm-f-mount', 'rm-f-val', g(314, 40))}
            ${renderKnobCell('rm-s-mount', 'rm-s-val', g(311, 50))}
            ${renderKnobCell('rm-d-mount', 'rm-d-val', g(312, 32))}
            ${renderKnobCell('rm-x-mount', 'rm-x-val', g(315, 0))}
            ${renderKnobCell('rm-fb-mount', 'rm-fb-val', g(317, 0))}
          </div>
        `;
        initKnob(host, 'rm-m-mount', 'MIX [310]', g(310, 64), 0, 127, 310, 'rm-m-val');
        initKnob(host, 'rm-f-mount', 'MOD FREQ [314]', g(314, 40), 0, 127, 314, 'rm-f-val');
        initKnob(host, 'rm-s-mount', 'LFO SPEED [311]', g(311, 50), 0, 200, 311, 'rm-s-val');
        initKnob(host, 'rm-d-mount', 'LFO DEPTH [312]', g(312, 32), 0, 127, 312, 'rm-d-val');
        initKnob(host, 'rm-x-mount', 'XOVER DELAY [315]', g(315, 0), 0, 127, 315, 'rm-x-val');
        initKnob(host, 'rm-fb-mount', 'XOVER FDBK [317]', g(317, 0), -64, 63, 317, 'rm-fb-val', true);
      } else if (algo === 3) {
        // Decimator [324..326]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
            ${renderKnobCell('dc-m-mount', 'dc-m-val', g(324, 64))}
            ${renderKnobCell('dc-sh-mount', 'dc-sh-val', g(325, 16))}
            ${renderKnobCell('dc-pf-mount', 'dc-pf-val', g(326, 80))}
          </div>
        `;
        initKnob(host, 'dc-m-mount', 'MIX [324]', g(324, 64), 0, 127, 324, 'dc-m-val');
        initKnob(host, 'dc-sh-mount', 'S&H FACTOR [325]', g(325, 16), 0, 127, 325, 'dc-sh-val');
        initKnob(host, 'dc-pf-mount', 'PRE-FILTER [326]', g(326, 80), 0, 127, 326, 'dc-pf-val');
      } else {
        // Spectral Warp [318..323]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(6, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
            ${renderKnobCell('sw-m-mount', 'sw-m-val', g(318, 64))}
            ${renderKnobCell('sw-f-mount', 'sw-f-val', g(319, 64))}
            ${renderKnobCell('sw-t-mount', 'sw-t-val', g(320, 64))}
            ${renderKnobCell('sw-dm-mount', 'sw-dm-val', g(321, 32))}
            ${renderKnobCell('sw-sp-mount', 'sw-sp-val', g(322, 40))}
            ${renderKnobCell('sw-dp-mount', 'sw-dp-val', g(323, 32))}
          </div>
        `;
        initKnob(host, 'sw-m-mount', 'MIX [318]', g(318, 64), 0, 127, 318, 'sw-m-val');
        initKnob(host, 'sw-f-mount', 'FREQUENCY [319]', g(319, 64), 0, 127, 319, 'sw-f-val');
        initKnob(host, 'sw-t-mount', 'TILT [320]', g(320, 64), 0, 127, 320, 'sw-t-val');
        initKnob(host, 'sw-dm-mount', 'DAMPING [321]', g(321, 32), 0, 127, 321, 'sw-dm-val');
        initKnob(host, 'sw-sp-mount', 'LFO SPEED [322]', g(322, 40), 0, 200, 322, 'sw-sp-val');
        initKnob(host, 'sw-dp-mount', 'LFO DEPTH [323]', g(323, 32), 0, 127, 323, 'sw-dp-val');
      }
      bindAllSlidersAndToggles(host);
    };

    const renderTimeSubpanel = (algo: number) => {
      const host = root.querySelector('#timefx-subpanel');
      if (!host) return;
      const g = (idx: number, def: number) => Math.round(WebBridge.getParam(idx, def));

      if (algo === 0) {
        // Stereo Spread [331..332]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
            ${renderKnobCell('ss-d-mount', 'ss-d-val', g(331, 12), 'ms')}
            ${renderKnobCell('ss-fb-mount', 'ss-fb-val', g(332, 16))}
          </div>
        `;
        initKnob(host, 'ss-d-mount', 'DELAY [331]', g(331, 12), -64, 63, 331, 'ss-d-val', true, 'ms');
        initKnob(host, 'ss-fb-mount', 'FEEDBACK [332]', g(332, 16), -64, 63, 332, 'ss-fb-val', true);
      } else if (algo === 1) {
        // L/R Delay [333..335]
        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
            ${renderKnobCell('lrd-m-mount', 'lrd-m-val', g(333, 50))}
            ${renderKnobCell('lrd-t-mount', 'lrd-t-val', g(334, 350), 'ms')}
            ${renderKnobCell('lrd-fb-mount', 'lrd-fb-val', g(335, 25))}
          </div>
        `;
        initKnob(host, 'lrd-m-mount', 'MIX [333]', g(333, 50), 0, 127, 333, 'lrd-m-val');
        initKnob(host, 'lrd-t-mount', 'DELAY TIME [334]', g(334, 350), 0, 1000, 334, 'lrd-t-val', false, 'ms');
        initKnob(host, 'lrd-fb-mount', 'FEEDBACK [335]', g(335, 25), -64, 63, 335, 'lrd-fb-val', true);
      } else {
        // Flanger (2: [336..341]), Phaser (3: [342..347]), Chorus (4: [348..354])
        const base = algo === 2 ? 336 : (algo === 3 ? 342 : 348);
        const isChorus = algo === 4;
        const cols = isChorus ? 7 : 6;
        const preDelayCell = isChorus ? renderKnobCell('tfx-pd-mount', 'tfx-pd-val', g(354, 25)) : '';

        host.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); justify-items: center; align-items: start; gap: var(--space-2); padding: var(--space-2) 0;">
            ${renderKnobCell('tfx-m-mount', 'tfx-m-val', g(base, 64))}
            ${renderKnobCell('tfx-d-mount', 'tfx-d-val', g(base + 1, 64))}
            ${renderKnobCell('tfx-s-mount', 'tfx-s-val', g(base + 2, 40))}
            ${renderKnobCell('tfx-w-mount', 'tfx-w-val', g(base + 3, 0))}
            ${renderKnobCell('tfx-fb-mount', 'tfx-fb-val', g(base + 4, 20))}
            ${renderKnobCell('tfx-ph-mount', 'tfx-ph-val', g(base + 5, 0))}
            ${preDelayCell}
          </div>
        `;

        initKnob(host, 'tfx-m-mount', `MIX [${base}]`, g(base, 64), 0, 127, base, 'tfx-m-val');
        initKnob(host, 'tfx-d-mount', `DEPTH [${base + 1}]`, g(base + 1, 64), 0, 127, base + 1, 'tfx-d-val');
        initKnob(host, 'tfx-s-mount', `SPEED [${base + 2}]`, g(base + 2, 40), 0, 200, base + 2, 'tfx-s-val');
        initKnob(host, 'tfx-w-mount', `WAVEFORM [${base + 3}]`, g(base + 3, 0), 0, 11, base + 3, 'tfx-w-val');
        initKnob(host, 'tfx-fb-mount', `FEEDBACK [${base + 4}]`, g(base + 4, 20), -64, 63, base + 4, 'tfx-fb-val', true);
        initKnob(host, 'tfx-ph-mount', `STEREO PHASE [${base + 5}]`, g(base + 5, 0), -64, 63, base + 5, 'tfx-ph-val', true);
        if (isChorus) {
          initKnob(host, 'tfx-pd-mount', 'PRE-DELAY [354]', g(354, 25), 0, 127, 354, 'tfx-pd-val');
        }
      }
      bindAllSlidersAndToggles(host);
    };

    // Montar subpaneles iniciales
    bindAllSlidersAndToggles(root);
    renderFreqSubpanel(curFreqAlgo);
    renderTimeSubpanel(curTimeAlgo);

    // Cerrar
    root.querySelector('#btn-close-effects-drawer')?.addEventListener('click', () => {
      options.onClose();
    });

    // ── Switches Principales ────────────────────────────────
    const silverSwitchBtn = root.querySelector('#btn-silver-master-switch') as HTMLElement | null;
    silverSwitchBtn?.addEventListener('click', () => {
      const next = !silverSwitchBtn.classList.contains('active');
      silverSwitchBtn.classList.toggle('active', next);
      silverSwitchBtn.classList.toggle('btn-primary', next);
      silverSwitchBtn.classList.toggle('btn-outline', !next);
      silverSwitchBtn.textContent = `SILVER: ${next ? 'ON' : 'BYPASS'}`;
      WebBridge.setParam(ParamIdx.SilverSwitch, next ? 1 : 0);
    });

    const masterBtn = root.querySelector('#btn-mfx-master-switch') as HTMLElement | null;
    masterBtn?.addEventListener('click', () => {
      const next = !masterBtn.classList.contains('active');
      masterBtn.classList.toggle('active', next);
      masterBtn.classList.toggle('btn-primary', next);
      masterBtn.classList.toggle('btn-outline', !next);
      masterBtn.textContent = `MASTER: ${next ? 'ON' : 'BYPASS'}`;
      WebBridge.setParam(ParamIdx.SoundMFXSwitch, next ? 1 : 0);
    });

    // ── Eventos Bloque 1 (Silver) ───────────────────────────
    const ftypeContainer = root.querySelector('#silver-ftype-group') as HTMLElement | null;
    if (ftypeContainer) {
      bindPillSelector(ftypeContainer, (ftypeStr, btn) => {
        ftypeContainer.querySelectorAll('.abd-pill, .ndb-chip').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        const ftype = parseInt(ftypeStr || '0', 10);
        WebBridge.setParam(ParamIdx.SilverSwitch, 1);
        WebBridge.setParam(ParamIdx.FilterType, ftype);
      }, 'data-ftype');
    }

    const freqAlgoContainer = root.querySelector('#silver-freqalgo-group') as HTMLElement | null;
    if (freqAlgoContainer) {
      bindPillSelector(freqAlgoContainer, (algoStr, btn) => {
        freqAlgoContainer.querySelectorAll('.abd-pill, .ndb-chip').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        const algo = parseInt(algoStr || '0', 10);
        WebBridge.setParam(ParamIdx.CurFreqFX, algo);
        renderFreqSubpanel(algo);
      }, 'data-freqalgo');
    }

    const timeAlgoContainer = root.querySelector('#silver-timealgo-group') as HTMLElement | null;
    if (timeAlgoContainer) {
      bindPillSelector(timeAlgoContainer, (algoStr, btn) => {
        timeAlgoContainer.querySelectorAll('.abd-pill, .ndb-chip').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        const algo = parseInt(algoStr || '0', 10);
        WebBridge.setParam(ParamIdx.CurTimeFX, algo);
        renderTimeSubpanel(algo);
      }, 'data-timealgo');
    }

    // ── Bypass Toggles para Silver L2 y L3 ──────────────────
    const bindSilverBypass = (btnId: string, paramId: number) => {
      const btn = root.querySelector(`#${btnId}`) as HTMLElement | null;
      btn?.addEventListener('click', () => {
        const nextState = !btn.classList.contains('active');
        btn.classList.toggle('active', nextState);
        btn.classList.toggle('btn-primary', nextState);
        btn.classList.toggle('btn-outline', !nextState);
        btn.textContent = nextState ? 'Active' : 'Bypass';
        WebBridge.setParam(paramId, nextState ? 1 : 0);
        if (nextState) {
          WebBridge.setParam(ParamIdx.SilverSwitch, 1);
          silverSwitchBtn?.classList.add('active', 'btn-primary');
          silverSwitchBtn?.classList.remove('btn-outline');
          if (silverSwitchBtn) silverSwitchBtn.textContent = 'SILVER: ON';
        }
      });
    };

    bindSilverBypass('btn-freqfx-bypass', ParamIdx.FreqFXSwitch);
    bindSilverBypass('btn-timefx-bypass', ParamIdx.TimeFXSwitch);

    // ── L1: Multimode Filter & ADSR Knobs ───────────────────
    // Fila 1: Multimode Filter
    initMfxKnob('silver-cut-mount', 'CUTOFF [274]', curCutoff, 0, 127, ParamIdx.FilterFreq, 'silver-cut-val');
    initMfxKnob('silver-res-mount', 'RESO [275]', curReso, 0, 127, ParamIdx.FilterReso, 'silver-res-val');
    initMfxKnob('silver-envd-mount', 'ENV DEPTH [360]', curFEnvDepth, -64, 63, ParamIdx.FilterEnvDepth, 'silver-envd-val', true);
    initMfxKnob('silver-lfo-mount', 'LFO DEPTH [276]', curFilterLfo, -64, 63, ParamIdx.FilterLfoDepth, 'silver-lfo-val', true);
    initMfxKnob('silver-kt-mount', 'KEYTRACK [277]', curFilterKt, -64, 63, ParamIdx.FilterKeyTrack, 'silver-kt-val', true);
    initMfxKnob('silver-vel-mount', 'VEL DEPTH [278]', curFilterVel, -64, 63, ParamIdx.FilterCutoffVelocityDepth, 'silver-vel-val', true);

    // Fila 2: Filter ADSR
    initMfxKnob('fenv-a-mount', 'FILT A [355]', curFEnvA, 0, 127, ParamIdx.FilterEnvA, 'fenv-a-val');
    initMfxKnob('fenv-d-mount', 'FILT D [356]', curFEnvD, 0, 127, ParamIdx.FilterEnvD, 'fenv-d-val');
    initMfxKnob('fenv-s-mount', 'FILT S [357]', curFEnvS, 0, 127, ParamIdx.FilterEnvS, 'fenv-s-val');
    initMfxKnob('fenv-r-mount', 'FILT R [358]', curFEnvR, 0, 127, ParamIdx.FilterEnvR, 'fenv-r-val');

    // ── Eventos Bloque 2 (Master FX) ────────────────────────
    const bindBypass = (btnId: string, paramId: number) => {
      const btn = root.querySelector(`#${btnId}`) as HTMLElement | null;
      btn?.addEventListener('click', () => {
        const nextState = !btn.classList.contains('active');
        btn.classList.toggle('active', nextState);
        btn.classList.toggle('btn-primary', nextState);
        btn.classList.toggle('btn-outline', !nextState);
        btn.textContent = nextState ? 'Active' : 'Bypass';
        WebBridge.setParam(paramId, nextState ? 1 : 0);
        if (nextState) {
          WebBridge.setParam(ParamIdx.SoundMFXSwitch, 1);
          masterBtn?.classList.add('active', 'btn-primary');
          masterBtn?.classList.remove('btn-outline');
          if (masterBtn) masterBtn.textContent = 'MASTER: ON';
        }
      });
    };

    bindBypass('btn-mfx-delay-bypass', ParamIdx.SoundMFXDelaySwitch);
    bindBypass('btn-mfx-reverb-bypass', ParamIdx.SoundMFXReverbSwitch);

    const reverbRoomsContainer = root.querySelector('#mfx-reverb-rooms-group') as HTMLElement | null;
    if (reverbRoomsContainer) {
      bindPillSelector(reverbRoomsContainer, (roomStr, btn) => {
        const room = parseInt(roomStr || '0', 10);
        WebBridge.setParam(ParamIdx.SoundMFXReverbRoom, room);
        reverbRoomsContainer.querySelectorAll('.abd-pill, .ndb-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      }, 'data-room');
    }

    // Stereo Delay Knobs [431..436]
    initMfxKnob('mfx-delay-mix-mount', 'MIX [432]', curDelayMix, 0, 127, ParamIdx.SoundMFXDelayMix, 'mfx-delay-mix-val');
    initMfxKnob('mfx-delay-fb-mount', 'FEEDBACK [435]', curDelayFb, -64, 63, ParamIdx.SoundMFXDelayFeedback, 'mfx-delay-fb-val', true);
    initMfxKnob('mfx-delay-ltime-mount', 'LEFT [433]', curDelayL, 1, 1000, ParamIdx.SoundMFXDelayLTime, 'mfx-delay-ltime-val', false, 'ms');
    initMfxKnob('mfx-delay-rtime-mount', 'RIGHT [434]', curDelayR, 1, 1000, ParamIdx.SoundMFXDelayRTime, 'mfx-delay-rtime-val', false, 'ms');
    initMfxKnob('mfx-delay-damp-mount', 'HF DAMP [436]', curDelayDamp, 0, 127, ParamIdx.SoundMFXDelayFdbkDamp, 'mfx-delay-damp-val');

    // Master Reverb Knobs [437..444]
    initMfxKnob('mfx-rev-mix-mount', 'MIX [438]', curRevMix, 0, 127, ParamIdx.SoundMFXReverbMix, 'mfx-rev-mix-val');
    initMfxKnob('mfx-rev-decay-mount', 'DECAY [440]', curRevDecay, 0, 127, ParamIdx.SoundMFXRevDecayTime, 'mfx-rev-decay-val');
    initMfxKnob('mfx-rev-diff-mount', 'DIFFUSION [441]', curRevDiff, 0, 127, ParamIdx.SoundMFXRevDiffusion, 'mfx-rev-diff-val');
    initMfxKnob('mfx-rev-damp-mount', 'HF DAMP [442]', curRevDamp, 0, 127, ParamIdx.SoundMFXRevHFDamp, 'mfx-rev-damp-val');
    initMfxKnob('mfx-rev-detune-mount', 'DETUNE [443]', curRevDetune, 0, 127, ParamIdx.SoundMFXRevDetune, 'mfx-rev-detune-val');
    initMfxKnob('mfx-rev-speed-mount', 'MOD SPEED [444]', curRevSpeed, 0, 200, ParamIdx.SoundMFXRevSpeed, 'mfx-rev-speed-val');


    // ── Filtro / Navegación rápida entre bloques ────────────
    const blockSilver = root.querySelector('#block-silver-fx') as HTMLElement | null;
    const blockMaster = root.querySelector('#block-master-fx') as HTMLElement | null;
    const viewSectionContainer = root.querySelector('#effects-view-section-pills') as HTMLElement | null;
    const scrollContainer = root.querySelector('#effects-scroll-body') as HTMLElement | null;

    const setFilter = (mode: 'all' | 'silver' | 'master', doScroll = false) => {
      const viewPills = viewSectionContainer?.querySelectorAll('[data-view]');
      viewPills?.forEach((p) => p.classList.toggle('active', p.getAttribute('data-view') === mode));

      if (mode === 'all') {
        if (blockSilver) blockSilver.style.display = 'flex';
        if (blockMaster) blockMaster.style.display = 'flex';
      } else if (mode === 'silver') {
        if (blockSilver) blockSilver.style.display = 'flex';
        if (blockMaster) blockMaster.style.display = 'none';
      } else if (mode === 'master') {
        if (blockSilver) blockSilver.style.display = 'none';
        if (blockMaster) blockMaster.style.display = 'flex';
      }

      if (doScroll && scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    };

    if (viewSectionContainer) {
      bindPillSelector(viewSectionContainer, (viewId) => {
        setFilter(viewId as 'all' | 'silver' | 'master', viewId !== 'all');
      }, 'data-view');
    }

    // Si se especifica bloque inicial, activar chip y vista correspondiente
    if (options.initialBlock) {
      setFilter(options.initialBlock, true);
    }

    return root;
  }
}
