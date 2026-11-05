// ─────────────────────────────────────────────────────────
// ABDAxionikVS — ResynatorDrawer.ts
// Panel lateral deslizante (50vw) para controles ampliados de Resonador (R1 / R2):
// - Switch R1/R2 [23/103], Volumen [27/107], Umbral Velocity Switch [41/121]
// - Parameter Set del modelo (0..9): metadato del análisis (ModelMaker), no parámetro de motor
// - Afinación y Tamaño: Octave [33/113], Semi [34/114], Cents [35/115], ModelSizeOffset [32/112], SizeKeyTrack [31/111]
// - Modulación de tono y volumen: PitchKeyTrack [37/117], PitchLfoDepth [36/116], AmpLfoDepth [28/108]
// - Envolventes ADSR de Amplitud [200..203 / 230..233] y ResEnv [182..185 / 212..215]
// - LFO Global ([256..260]: Switch, Depth, Rate, Delay, Waveform 0..11)
// - Shaper Multinivel 4L/4T ([242..253]) mediante MultiStageShaperPad de ABDShared
// Todos los controles continuos usan el componente Knob canónico de ABDShared.
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { Knob } from '@abdsynths/shared/components';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';
import { MultiStageShaperPad } from './MultiStageShaperPad.js';
import { PARAMETER_SET_NAMES, getParameterSetName } from './ParameterSets.js';

export interface ResynatorDrawerProps {
  resynator: 1 | 2;
  modelName: string;
  /** Parameter Set (0..9) del modelo cargado; -1 si el metadato no lo declara. */
  parameterSet?: number;
  onClose: () => void;
  onSelectModel?: (resynator: 1 | 2) => void;
}

const LFO_WAVEFORM_ITEMS = [
  { id: '0', label: '0: Sine' },
  { id: '1', label: '1: Triangle' },
  { id: '2', label: '2: Saw Up' },
  { id: '3', label: '3: Saw Down' },
  { id: '4', label: '4: Square' },
  { id: '5', label: '5: Pos Tri' },
  { id: '6', label: '6: Pos Sin' },
  { id: '7', label: '7: Pos Sqr' },
  { id: '8', label: '8: Step 4' },
  { id: '9', label: '9: Step 8' },
  { id: '10', label: '10: S&H' },
  { id: '11', label: '11: Random' },
];

export class ResynatorDrawer {
  public static createContent(props: ResynatorDrawerProps): HTMLElement {
    const isR1 = props.resynator === 1;
    const rPrefix = isR1 ? 'R1' : 'R2';
    const g = (idx: number, def: number) => Math.round(WebBridge.getParam(idx, def));

    const pSwitch = isR1 ? ParamIdx.R1Switch : ParamIdx.R2Switch;
    const pVol = isR1 ? ParamIdx.R1Volume : ParamIdx.R2Volume;
    const pAmpLfo = isR1 ? ParamIdx.R1AmpLfoDepth : ParamIdx.R2AmpLfoDepth;
    const pSizeKt = isR1 ? ParamIdx.R1ModelSizeKeyTrack : ParamIdx.R2ModelSizeKeyTrack;
    const pSizeOff = isR1 ? ParamIdx.R1ModelSizeOffset : ParamIdx.R2ModelSizeOffset;
    const pOct = isR1 ? ParamIdx.R1Octave : ParamIdx.R2Octave;
    const pSemi = isR1 ? ParamIdx.R1Semi : ParamIdx.R2Semi;
    const pCents = isR1 ? ParamIdx.R1Cents : ParamIdx.R2Cents;
    const pPitchLfo = isR1 ? ParamIdx.R1PitchLfoDepth : ParamIdx.R2PitchLfoDepth;
    const pPitchKt = isR1 ? ParamIdx.R1PitchKeyTrack : ParamIdx.R2PitchKeyTrack;
    const pVelSw = isR1 ? ParamIdx.R1ModelVelocitySwitch : ParamIdx.R2ModelVelocitySwitch;

    const curSw = g(pSwitch, 1) > 0;
    const parSet =
      typeof props.parameterSet === 'number' && props.parameterSet >= 0 && props.parameterSet <= 9
        ? props.parameterSet
        : -1;
    const curVol = g(pVol, 100);
    const curAmpLfo = g(pAmpLfo, 0);
    const curSizeKt = g(pSizeKt, 0);
    const curSizeOff = g(pSizeOff, 0);
    const curOct = g(pOct, 2); // 0..3 -> -2..+1 oct
    const curSemi = g(pSemi, 0);
    const curCents = g(pCents, 0);
    const curPitchLfo = g(pPitchLfo, 0);
    const curPitchKt = g(pPitchKt, 63);
    const curVelSw = g(pVelSw, 64);

    const baseAdsrParam = isR1 ? ParamIdx.R1AmpEnvA : ParamIdx.R2AmpEnvA;
    const curAdsrA = g(baseAdsrParam, 10);
    const curAdsrD = g(baseAdsrParam + 1, 45);
    const curAdsrS = g(baseAdsrParam + 2, 100);
    const curAdsrR = g(baseAdsrParam + 3, 35);

    const baseResEnvParam = isR1 ? ParamIdx.R1ResEnvA : ParamIdx.R2ResEnvA;
    const curResA = g(baseResEnvParam, 15);
    const curResD = g(baseResEnvParam + 1, 50);
    const curResS = g(baseResEnvParam + 2, 90);
    const curResR = g(baseResEnvParam + 3, 40);

    // LFO Global [256..260]
    const lfoOn = g(ParamIdx.LFOSwitch, 0) > 0;
    const lfoDepth = g(ParamIdx.LFODepth, 64);
    const lfoRate = g(ParamIdx.LFORate, 150);
    const lfoDelay = g(ParamIdx.LFODelay, 0);
    const lfoWave = g(ParamIdx.LFOWaveForm, 0);

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
    const curShaperMode = g(ParamIdx.TLFreeEnvMode, 0) + 1;

    const parsetHtml = `
      <div style="display: flex; flex-wrap: wrap; gap: 4px;" role="list" aria-label="${rPrefix} Parameter Set ${parSet >= 0 ? parSet : 'desconocido'}">
        ${PARAMETER_SET_NAMES.map((name, idx) => `<span class="abd-pill${idx === parSet ? ' active' : ''}" role="listitem" style="cursor: default;" title="Parameter Set ${idx}: ${name}">${idx}: ${name}</span>`).join('')}
      </div>
    `;

    const lfoWaveHtml = pillSelectorHtml(LFO_WAVEFORM_ITEMS, String(lfoWave), {
      id: `${rPrefix}-lfo-wave-pills`,
      size: 'xs',
      attrName: 'data-lfowave',
    });

    const renderKnobCell = (mountId: string, valId: string, initialText: string | number, label: string) => `
      <div class="synth-knob-cell">
        <div id="${mountId}"></div>
        <span class="synth-knob-num stat-num" id="${valId}">${initialText}</span>
        <span class="synth-knob-title">${label}</span>
      </div>
    `;

    const octText = (octRaw: number) => {
      const oct = octRaw - 2;
      return `${oct >= 0 ? '+' : ''}${oct} Oct`;
    };

    const el = document.createElement('div');
    el.className = 'resynator-drawer-view';
    el.style.cssText = 'display: flex; flex-direction: column; height: 100%; box-sizing: border-box;';

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

      <div class="drawer-scrollable-content" style="flex: 1; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); overflow-y: auto;">
        <!-- 1. Parameter Set del modelo (0..9) — metadato fijado en el análisis, no parámetro de motor -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-2);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">PARAMETER SET DEL MODELO${parSet >= 0 ? ` (${parSet}: ${getParameterSetName(parSet)})` : ' (sin metadato)'}</div>
          <div style="font-size: 11px; color: var(--color-text-muted);">Algoritmo de resíntesis con el que Modelmaker analizó el modelo. Se fija en el análisis (10 sets) y no se edita en el motor.</div>
          ${parsetHtml}
        </div>

        <!-- 2. Afinación, Volumen, Model Size & Modulación del Resonador -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">TUNING, MODEL SIZE, LEVEL & VELOCITY ZONE SWITCH</div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); justify-items: center;">
            ${renderKnobCell(`${rPrefix}-oct-m`, `${rPrefix}-oct-v`, octText(curOct), `OCTAVE [${pOct}]`)}
            ${renderKnobCell(`${rPrefix}-semi-m`, `${rPrefix}-semi-v`, curSemi, `SEMITONES [${pSemi}]`)}
            ${renderKnobCell(`${rPrefix}-cents-m`, `${rPrefix}-cents-v`, curCents, `FINE CENTS [${pCents}]`)}
            ${renderKnobCell(`${rPrefix}-vol-m`, `${rPrefix}-vol-v`, curVol, `VOLUME [${pVol}]`)}
            ${renderKnobCell(`${rPrefix}-vsw-m`, `${rPrefix}-vsw-v`, curVelSw, `VEL SWITCH [${pVelSw}]`)}
          </div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); justify-items: center; padding-top: var(--space-2); border-top: 1px solid var(--color-panel-border-dim);">
            ${renderKnobCell(`${rPrefix}-pkt-m`, `${rPrefix}-pkt-v`, curPitchKt, `PITCH KEYTRK [${pPitchKt}]`)}
            ${renderKnobCell(`${rPrefix}-plfo-m`, `${rPrefix}-plfo-v`, curPitchLfo, `PITCH LFO [${pPitchLfo}]`)}
            ${renderKnobCell(`${rPrefix}-alfo-m`, `${rPrefix}-alfo-v`, curAmpLfo, `AMP LFO [${pAmpLfo}]`)}
            ${renderKnobCell(`${rPrefix}-szoff-m`, `${rPrefix}-szoff-v`, curSizeOff, `SIZE OFFSET [${pSizeOff}]`)}
            ${renderKnobCell(`${rPrefix}-szkt-m`, `${rPrefix}-szkt-v`, curSizeKt, `SIZE KEYTRK [${pSizeKt}]`)}
          </div>
        </div>

        <!-- 3. Envolventes ADSR de Amplitud y Resonador (ResEnv) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">AMPLITUDE ADSR ([${baseAdsrParam}..${baseAdsrParam + 3}]) & RESONATOR ADSR ([${baseResEnvParam}..${baseResEnvParam + 3}])</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); justify-items: center;">
            ${renderKnobCell(`${rPrefix}-amp-a-m`, `${rPrefix}-amp-a-v`, curAdsrA, `AMP A [${baseAdsrParam}]`)}
            ${renderKnobCell(`${rPrefix}-amp-d-m`, `${rPrefix}-amp-d-v`, curAdsrD, `AMP D [${baseAdsrParam + 1}]`)}
            ${renderKnobCell(`${rPrefix}-amp-s-m`, `${rPrefix}-amp-s-v`, curAdsrS, `AMP S [${baseAdsrParam + 2}]`)}
            ${renderKnobCell(`${rPrefix}-amp-r-m`, `${rPrefix}-amp-r-v`, curAdsrR, `AMP R [${baseAdsrParam + 3}]`)}
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); justify-items: center; padding-top: var(--space-2); border-top: 1px solid var(--color-panel-border-dim);">
            ${renderKnobCell(`${rPrefix}-res-a-m`, `${rPrefix}-res-a-v`, curResA, `RES A [${baseResEnvParam}]`)}
            ${renderKnobCell(`${rPrefix}-res-d-m`, `${rPrefix}-res-d-v`, curResD, `RES D [${baseResEnvParam + 1}]`)}
            ${renderKnobCell(`${rPrefix}-res-s-m`, `${rPrefix}-res-s-v`, curResS, `RES S [${baseResEnvParam + 2}]`)}
            ${renderKnobCell(`${rPrefix}-res-r-m`, `${rPrefix}-res-r-v`, curResR, `RES R [${baseResEnvParam + 3}]`)}
          </div>
        </div>

        <!-- 4. LFO Global ([256..260]) -->
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">GLOBAL MODULATION LFO ([256..260])</span>
            <button type="button" class="btn btn-xs ${lfoOn ? 'btn-primary active' : 'btn-outline'}" id="btn-global-lfo-toggle">
              LFO: ${lfoOn ? 'ACTIVE' : 'BYPASS'}
            </button>
          </div>
          ${lfoWaveHtml}
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); justify-items: center; padding-top: var(--space-1);">
            ${renderKnobCell('glfo-d-m', 'glfo-d-v', lfoDepth, 'DEPTH [257]')}
            ${renderKnobCell('glfo-r-m', 'glfo-r-v', lfoRate, 'RATE [258]')}
            ${renderKnobCell('glfo-dl-m', 'glfo-dl-v', lfoDelay, 'DELAY [259]')}
          </div>
        </div>

        <!-- 5. Pad de Envolvente Multinivel 4L/4T (@abdsynths/shared) -->
        <div id="${rPrefix}-shaper-mount"></div>
      </div>
    `;

    const initKnob = (
      mountId: string,
      label: string,
      initVal: number,
      min: number,
      max: number,
      paramId: number,
      valId: string,
      isBipolar = false,
      formatter?: (v: number) => string
    ) => {
      const mount = el.querySelector(`#${mountId}`) as HTMLElement | null;
      if (!mount) return;
      mount.setAttribute('data-param-index', String(paramId));
      const range = max - min;
      const normInit = range > 0 ? (initVal - min) / range : 0;
      const valEl = el.querySelector(`#${valId}`);

      new Knob(mount, {
        size: 38,
        label,
        value: normInit,
        bipolar: isBipolar,
        onChange: (normVal: number) => {
          const actualVal = Math.round(min + normVal * range);
          WebBridge.setParam(paramId, actualVal);
          if (valEl) {
            valEl.textContent = formatter ? formatter(actualVal) : String(actualVal);
          }
        },
      });
    };

    // Knobs: Tuning, Size, Level & Modulation
    initKnob(`${rPrefix}-oct-m`, 'OCTAVE', curOct, 0, 3, pOct, `${rPrefix}-oct-v`, false, octText);
    initKnob(`${rPrefix}-semi-m`, 'SEMITONES', curSemi, -24, 24, pSemi, `${rPrefix}-semi-v`, true);
    initKnob(`${rPrefix}-cents-m`, 'FINE CENTS', curCents, -99, 99, pCents, `${rPrefix}-cents-v`, true);
    initKnob(`${rPrefix}-vol-m`, 'VOLUME', curVol, 0, 127, pVol, `${rPrefix}-vol-v`, false);
    initKnob(`${rPrefix}-vsw-m`, 'VEL SWITCH', curVelSw, 1, 127, pVelSw, `${rPrefix}-vsw-v`, false);

    initKnob(`${rPrefix}-pkt-m`, 'PITCH KEYTRK', curPitchKt, -64, 63, pPitchKt, `${rPrefix}-pkt-v`, true);
    initKnob(`${rPrefix}-plfo-m`, 'PITCH LFO', curPitchLfo, -64, 63, pPitchLfo, `${rPrefix}-plfo-v`, true);
    initKnob(`${rPrefix}-alfo-m`, 'AMP LFO', curAmpLfo, -64, 63, pAmpLfo, `${rPrefix}-alfo-v`, true);
    initKnob(`${rPrefix}-szoff-m`, 'SIZE OFFSET', curSizeOff, -64, 63, pSizeOff, `${rPrefix}-szoff-v`, true);
    initKnob(`${rPrefix}-szkt-m`, 'SIZE KEYTRK', curSizeKt, -64, 63, pSizeKt, `${rPrefix}-szkt-v`, true);

    // Knobs: Amplitude ADSR & Resonator ADSR
    initKnob(`${rPrefix}-amp-a-m`, 'AMP A', curAdsrA, 0, 127, baseAdsrParam, `${rPrefix}-amp-a-v`, false);
    initKnob(`${rPrefix}-amp-d-m`, 'AMP D', curAdsrD, 0, 127, baseAdsrParam + 1, `${rPrefix}-amp-d-v`, false);
    initKnob(`${rPrefix}-amp-s-m`, 'AMP S', curAdsrS, 0, 127, baseAdsrParam + 2, `${rPrefix}-amp-s-v`, false);
    initKnob(`${rPrefix}-amp-r-m`, 'AMP R', curAdsrR, 0, 127, baseAdsrParam + 3, `${rPrefix}-amp-r-v`, false);

    initKnob(`${rPrefix}-res-a-m`, 'RES A', curResA, 0, 127, baseResEnvParam, `${rPrefix}-res-a-v`, false);
    initKnob(`${rPrefix}-res-d-m`, 'RES D', curResD, 0, 127, baseResEnvParam + 1, `${rPrefix}-res-d-v`, false);
    initKnob(`${rPrefix}-res-s-m`, 'RES S', curResS, 0, 127, baseResEnvParam + 2, `${rPrefix}-res-s-v`, false);
    initKnob(`${rPrefix}-res-r-m`, 'RES R', curResR, 0, 127, baseResEnvParam + 3, `${rPrefix}-res-r-v`, false);

    // Knobs: Global LFO
    initKnob('glfo-d-m', 'DEPTH', lfoDepth, 0, 127, ParamIdx.LFODepth, 'glfo-d-v', false);
    initKnob('glfo-r-m', 'RATE', lfoRate, 0, 1000, ParamIdx.LFORate, 'glfo-r-v', false);
    initKnob('glfo-dl-m', 'DELAY', lfoDelay, -64, 63, ParamIdx.LFODelay, 'glfo-dl-v', true);

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
      WebBridge.setParam(pSwitch, next ? 1 : 0);
    });

    const lfoToggleBtn = el.querySelector('#btn-global-lfo-toggle') as HTMLElement | null;
    lfoToggleBtn?.addEventListener('click', () => {
      const next = !lfoToggleBtn.classList.contains('active');
      lfoToggleBtn.classList.toggle('active', next);
      lfoToggleBtn.classList.toggle('btn-primary', next);
      lfoToggleBtn.classList.toggle('btn-outline', !next);
      lfoToggleBtn.textContent = `LFO: ${next ? 'ACTIVE' : 'BYPASS'}`;
      WebBridge.setParam(ParamIdx.LFOSwitch, next ? 1 : 0);
    });

    const lfoWaveContainer = el.querySelector(`#${rPrefix}-lfo-wave-pills`) as HTMLElement | null;
    if (lfoWaveContainer) {
      bindPillSelector(lfoWaveContainer, (id, btn) => {
        lfoWaveContainer.querySelectorAll('.abd-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        WebBridge.setParam(ParamIdx.LFOWaveForm, parseInt(id || '0', 10));
      }, 'data-lfowave');
    }

    // Montar MultiStageShaperPad canónico de ABDShared
    const shaperMount = el.querySelector(`#${rPrefix}-shaper-mount`) as HTMLElement | null;
    if (shaperMount) {
      new MultiStageShaperPad(shaperMount, {
        label: `${rPrefix} 4L/4T SHAPER CONTOUR ([242..253])`,
        caption: '4-Level / 4-Time Dynamic Contour',
        bipolar: true,
        editable: true,
        times: curShaperTimes,
        levels: curShaperLevels,
        mode: curShaperMode,
        onChange: (st) => {
          WebBridge.setParam(ParamIdx.FreeEnvTime1, Math.round(st.times[0] * 127));
          WebBridge.setParam(ParamIdx.FreeEnvTime2, Math.round(st.times[1] * 127));
          WebBridge.setParam(ParamIdx.FreeEnvTime3, Math.round(st.times[2] * 127));
          WebBridge.setParam(ParamIdx.FreeEnvTime4, Math.round(st.times[3] * 127));

          WebBridge.setParam(ParamIdx.FreeEnvLevel1, Math.round(st.levels[0] * 63));
          WebBridge.setParam(ParamIdx.FreeEnvLevel2, Math.round(st.levels[1] * 63));
          WebBridge.setParam(ParamIdx.FreeEnvLevel3, Math.round(st.levels[2] * 63));
          WebBridge.setParam(ParamIdx.FreeEnvLevel4, Math.round(st.levels[3] * 63));

          WebBridge.setParam(ParamIdx.TLFreeEnvMode, Math.max(0, st.mode - 1));
        },
      });
    }

    return el;
  }
}
