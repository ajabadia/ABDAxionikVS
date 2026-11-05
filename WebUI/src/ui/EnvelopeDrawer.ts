// ─────────────────────────────────────────────────────────
// ABDAxionikVS — EnvelopeDrawer.ts
// Cajón dedicado de Envolventes y Shapers ([180..266]):
// Organizado en 4 vistas enfocadas (una sola activa a la vez) y por Shaper (R1 / R2):
//   1. AMP (Volume & Velo): ADSR de Amplitud [200..204 / 230..234] + Vol, Velo, KeyTrack, LFO Depth
//   2. RES (Scape & Sphere Depths): ADSR de Resonador [182..187 / 212..217] + 12 profundidades L1..L3 [188..199 / 218..229]
//   3. FREE (Assign Destinations): ADSR Libre [205..211 / 235..241] + Destino primario [255] + Envíos a Pitch R1/R2 y Blender
//   4. 4L/4T Master Curve: Curva interactiva 4-Level / 4-Time [242..252] + Envíos dedicados 4L/4T
// Usa el componente canónico MultiStageShaperPad de ABDShared en todas las vistas.
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';
import { Knob } from '@abdsynths/shared/components';
import { MultiStageShaperPad } from './MultiStageShaperPad.js';

export type EnvelopeDrawerTab = 'amp' | 'res' | 'free' | '4l4t';

export interface EnvelopeDrawerOptions {
  onClose: () => void;
  initialShaper?: 1 | 2;
  initialTab?: EnvelopeDrawerTab | 'all' | 'adsr' | 'routing';
}

const PRIMARY_FREE_DESTINATIONS = [
  { id: 0, name: 'R1 Scape', desc: 'Modulates Resynator 1 Scape Contour' },
  { id: 1, name: 'R1 Sphere', desc: 'Modulates Resynator 1 Sphere Contour' },
  { id: 2, name: 'R2 Scape', desc: 'Modulates Resynator 2 Scape Contour' },
  { id: 3, name: 'R2 Sphere', desc: 'Modulates Resynator 2 Sphere Contour' },
  { id: 4, name: 'Blender', desc: 'Modulates R1/R2 Blender Crossfade Amount' },
  { id: 5, name: 'Silver Filter Cutoff', desc: 'Modulates Silver 24dB Filter Cutoff Frequency' },
];

export class EnvelopeDrawer {
  public static createContent(options: EnvelopeDrawerOptions): HTMLElement {
    const g = (idx: number, def: number) => Math.round(WebBridge.getParam(idx, def));

    let activeShaper: 1 | 2 = options.initialShaper ?? 1;
    let activeTab: EnvelopeDrawerTab =
      options.initialTab === 'amp' || options.initialTab === 'res' || options.initialTab === 'free' || options.initialTab === '4l4t'
        ? options.initialTab
        : '4l4t';

    const shaperSelectorHtml = pillSelectorHtml(
      [
        { id: '1', label: 'SHAPER 1 (R1)' },
        { id: '2', label: 'SHAPER 2 (R2)' },
      ],
      String(activeShaper),
      { id: 'env-drawer-shaper-pills', size: 'sm', attrName: 'data-shaper' }
    );

    const tabSelectorHtml = pillSelectorHtml(
      [
        { id: 'amp', label: '1. AMP (Volume & Velo)' },
        { id: 'res', label: '2. RES (Scape & Sphere Depths)' },
        { id: 'free', label: '3. FREE (Assign Destinations)' },
        { id: '4l4t', label: '4. 4L/4T Master Curve' },
      ],
      activeTab,
      { id: 'env-drawer-tab-pills', size: 'sm', attrName: 'data-tab' }
    );

    const renderKnobCell = (mountId: string, valId: string, initialVal: number, label: string, unit = '') => `
      <div class="synth-knob-cell">
        <div id="${mountId}"></div>
        <span class="synth-knob-num stat-num" id="${valId}">${initialVal}${unit ? ' ' + unit : ''}</span>
        <span class="synth-knob-title">${label}</span>
      </div>
    `;

    const root = document.createElement('div');
    root.className = 'envelope-drawer-view';
    root.style.cssText = 'display: flex; flex-direction: column; height: 100%; box-sizing: border-box;';

    root.innerHTML = `
      <div class="drawer-header ndb-modal-header" style="flex-wrap: wrap; gap: var(--space-2);">
        <div class="drawer-title ndb-header-title" style="flex: 1; min-width: 240px;">
          <span class="drawer-icon">${ICONS.layers}</span>
          <span class="ndb-title-text" id="env-drawer-main-title">SHAPER ${activeShaper} (R${activeShaper}) — ENVELOPE EDITOR</span>
          <span class="panel-badge ndb-badge" id="env-drawer-badge">R${activeShaper}</span>
        </div>
        <div class="drawer-header-actions" style="display: flex; align-items: center; gap: var(--space-2);">
          ${shaperSelectorHtml}
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-env-drawer" title="Close (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <!-- Focused View Selector Bar -->
      <div style="display: flex; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--color-panel-header); border-bottom: 1px solid var(--color-panel-border-dim); align-items: center; justify-content: space-between; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
          <span class="hud-label" style="font-size: 10px; margin-right: 4px;">ENVELOPE MODE:</span>
          ${tabSelectorHtml}
        </div>
      </div>

      <div class="drawer-scrollable-content" id="env-scroll-body" style="flex: 1; overflow-y: auto; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4);">
        <div id="env-focused-stage" style="display: flex; flex-direction: column; gap: var(--space-4);"></div>
      </div>
    `;

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
      onAfterChange?: (val: number) => void,
      size = 42
    ): Knob | null => {
      const mount = container.querySelector(`#${mountId}`) as HTMLElement | null;
      if (!mount) return null;
      mount.innerHTML = '';
      mount.setAttribute('data-param-index', String(paramId));
      const range = max - min;
      const normInit = range > 0 ? (initVal - min) / range : 0;
      const valEl = container.querySelector(`#${valId}`);

      return new Knob(mount, {
        size,
        label,
        value: normInit,
        bipolar: isBipolar,
        onChange: (normVal: number) => {
          const actualVal = Math.round(min + normVal * range);
          WebBridge.setParam(paramId, actualVal);
          if (valEl) {
            valEl.textContent = isBipolar && actualVal > 0 ? `+${actualVal}` : String(actualVal);
          }
          onAfterChange?.(actualVal);
        },
      });
    };

    const adsrToShaperState = (a: number, d: number, s: number, r: number) => ({
      times: [
        Math.max(0.04, a / 127),
        Math.max(0.04, d / 127),
        0.25,
        Math.max(0.04, r / 127),
      ],
      levels: [1.0, s / 127, s / 127, 0.0],
    });

    const stageHost = root.querySelector('#env-focused-stage') as HTMLElement;
    const titleEl = root.querySelector('#env-drawer-main-title') as HTMLElement;
    const badgeEl = root.querySelector('#env-drawer-badge') as HTMLElement;

    const renderFocusedView = () => {
      if (!stageHost) return;
      const isR1 = activeShaper === 1;
      const rLabel = isR1 ? 'R1' : 'R2';

      if (titleEl) {
        if (activeTab === '4l4t') {
          titleEl.textContent = 'ENVELOPES & SHAPERS MASTER — 4L/4T CONTOUR';
        } else {
          const modeLabel = activeTab === 'amp' ? 'AMP ENVELOPE' : activeTab === 'res' ? 'RES CONTOUR ENVELOPE' : 'FREE MODULATION ENVELOPE';
          titleEl.textContent = `SHAPER ${activeShaper} (${rLabel}) — ${modeLabel}`;
        }
      }
      if (badgeEl) {
        badgeEl.textContent = activeTab === '4l4t' ? '4L/4T [242..252]' : `${rLabel} ${activeTab.toUpperCase()}`;
      }

      // ─────────────────────────────────────────────────────────
      // TAB 1: AMP (Volume Envelope & Dynamics)
      // ─────────────────────────────────────────────────────────
      if (activeTab === 'amp') {
        const pA = isR1 ? ParamIdx.R1AmpEnvA : ParamIdx.R2AmpEnvA;
        const pD = isR1 ? ParamIdx.R1AmpEnvD : ParamIdx.R2AmpEnvD;
        const pS = isR1 ? ParamIdx.R1AmpEnvS : ParamIdx.R2AmpEnvS;
        const pR = isR1 ? ParamIdx.R1AmpEnvR : ParamIdx.R2AmpEnvR;
        const pMode = isR1 ? ParamIdx.R1AmpEnvMode : ParamIdx.R2AmpEnvMode;
        const pVelo = isR1 ? ParamIdx.R1VolumeVelocityDepth : ParamIdx.R2VolumeVelocityDepth;
        const pKeyT = isR1 ? ParamIdx.R1AmpKeyTrack : ParamIdx.R2AmpKeyTrack;
        const pVol = isR1 ? ParamIdx.R1Volume : ParamIdx.R2Volume;
        const pLfo = isR1 ? ParamIdx.R1AmpLfoDepth : ParamIdx.R2AmpLfoDepth;

        let vA = g(pA, 10);
        let vD = g(pD, 45);
        let vS = g(pS, 100);
        let vR = g(pR, 35);
        const curMode = g(pMode, 0);
        const modeHtml = pillSelectorHtml(
          [
            { id: '0', label: 'Normal (One-Shot)' },
            { id: '1', label: 'Repeat (Loop)' },
          ],
          String(curMode),
          { id: 'amp-mode-pills', size: 'xs', attrName: 'data-mode' }
        );

        stageHost.innerHTML = `
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2);">
              <div>
                <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">${rLabel} AMPLIFIER ADSR ENVELOPE ([${pA}..${pMode}])</div>
                <div style="font-size: 11px; color: var(--color-text-muted);">Shapes the output volume contour of Resynator ${activeShaper} on every note trigger.</div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="hud-label" style="font-size: 9px;">CYCLE:</span>
                ${modeHtml}
              </div>
            </div>

            <div id="amp-adsr-curve-mount"></div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); justify-items: center; padding: var(--space-2) 0;">
              ${renderKnobCell('amp-a-m', 'amp-a-v', vA, 'ATTACK')}
              ${renderKnobCell('amp-d-m', 'amp-d-v', vD, 'DECAY')}
              ${renderKnobCell('amp-s-m', 'amp-s-v', vS, 'SUSTAIN')}
              ${renderKnobCell('amp-r-m', 'amp-r-v', vR, 'RELEASE')}
            </div>
          </div>

          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div>
              <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">${rLabel} AMPLIFIER LEVEL & VELOCITY DYNAMICS</div>
              <div style="font-size: 11px; color: var(--color-text-muted);">Controls how keyboard velocity, note pitch (keytrack), and the global LFO modulate ${rLabel} volume.</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); justify-items: center; padding: var(--space-2) 0;">
              ${renderKnobCell('amp-vol-m', 'amp-vol-v', g(pVol, 100), `MASTER VOL [${pVol}]`)}
              ${renderKnobCell('amp-vel-m', 'amp-vel-v', g(pVelo, 0), `VELOCITY SENS [${pVelo}]`)}
              ${renderKnobCell('amp-kt-m', 'amp-kt-v', g(pKeyT, 0), `AMP KEYTRACK [${pKeyT}]`)}
              ${renderKnobCell('amp-lfo-m', 'amp-lfo-v', g(pLfo, 0), `AMP LFO DEPTH [${pLfo}]`)}
            </div>
          </div>
        `;

        const curveMount = stageHost.querySelector('#amp-adsr-curve-mount') as HTMLElement | null;
        let adsrPad: MultiStageShaperPad | null = null;
        if (curveMount) {
          adsrPad = new MultiStageShaperPad(curveMount, {
            bipolar: false,
            bare: true,
            editable: false,
            viewBoxHeight: 96,
            stageLabels: ['START', 'ATTACK', 'DECAY', 'SUSTAIN', 'RELEASE'],
            ...adsrToShaperState(vA, vD, vS, vR),
          });
        }
        const syncAdsrCurve = () => adsrPad?.setValue(adsrToShaperState(vA, vD, vS, vR), false);

        initKnob(stageHost, 'amp-a-m', 'ATTACK', vA, 0, 127, pA, 'amp-a-v', false, (v) => { vA = v; syncAdsrCurve(); }, 46);
        initKnob(stageHost, 'amp-d-m', 'DECAY', vD, 0, 127, pD, 'amp-d-v', false, (v) => { vD = v; syncAdsrCurve(); }, 46);
        initKnob(stageHost, 'amp-s-m', 'SUSTAIN', vS, 0, 127, pS, 'amp-s-v', false, (v) => { vS = v; syncAdsrCurve(); }, 46);
        initKnob(stageHost, 'amp-r-m', 'RELEASE', vR, 0, 127, pR, 'amp-r-v', false, (v) => { vR = v; syncAdsrCurve(); }, 46);

        initKnob(stageHost, 'amp-vol-m', 'VOLUME', g(pVol, 100), 0, 127, pVol, 'amp-vol-v', false, undefined, 42);
        initKnob(stageHost, 'amp-vel-m', 'VELOCITY', g(pVelo, 0), -64, 63, pVelo, 'amp-vel-v', true, undefined, 42);
        initKnob(stageHost, 'amp-kt-m', 'KEYTRACK', g(pKeyT, 0), -64, 63, pKeyT, 'amp-kt-v', true, undefined, 42);
        initKnob(stageHost, 'amp-lfo-m', 'LFO DEPTH', g(pLfo, 0), -64, 63, pLfo, 'amp-lfo-v', true, undefined, 42);

        const modeEl = stageHost.querySelector('#amp-mode-pills') as HTMLElement | null;
        if (modeEl) {
          bindPillSelector(modeEl, (id, btn) => {
            modeEl.querySelectorAll('.abd-pill').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            WebBridge.setParam(pMode, parseInt(id || '0', 10));
          }, 'data-mode');
        }
        return;
      }

      // ─────────────────────────────────────────────────────────
      // TAB 2: RES (Resynator Contour ADSR + 12 Scape/Sphere Env Depths)
      // ─────────────────────────────────────────────────────────
      if (activeTab === 'res') {
        const pA = isR1 ? ParamIdx.R1ResEnvA : ParamIdx.R2ResEnvA;
        const pD = isR1 ? ParamIdx.R1ResEnvD : ParamIdx.R2ResEnvD;
        const pS = isR1 ? ParamIdx.R1ResEnvS : ParamIdx.R2ResEnvS;
        const pR = isR1 ? ParamIdx.R1ResEnvR : ParamIdx.R2ResEnvR;
        const pMode = isR1 ? ParamIdx.R1ResEnvMode : ParamIdx.R2ResEnvMode;
        const pVelo = isR1 ? ParamIdx.R1ParaEnvVelocityDepth : ParamIdx.R2ParaEnvVelocityDepth;
        const baseDepth = isR1 ? ParamIdx.R1L1Sphere1EnvDepth : ParamIdx.R2L1Sphere1EnvDepth; // [188..199] or [218..229]

        let vA = g(pA, 20);
        let vD = g(pD, 50);
        let vS = g(pS, 64);
        let vR = g(pR, 40);
        const curMode = g(pMode, 0);
        const modeHtml = pillSelectorHtml(
          [
            { id: '0', label: 'Normal (One-Shot)' },
            { id: '1', label: 'Repeat (Loop)' },
          ],
          String(curMode),
          { id: 'res-mode-pills', size: 'xs', attrName: 'data-mode' }
        );

        stageHost.innerHTML = `
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2);">
              <div>
                <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">${rLabel} RESYNATOR CONTOUR ADSR ([${pA}..${pVelo}])</div>
                <div style="font-size: 11px; color: var(--color-text-muted);">Dedicated envelope that animates ${rLabel} Scape & Sphere X/Y axes over time.</div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="hud-label" style="font-size: 9px;">CYCLE:</span>
                ${modeHtml}
              </div>
            </div>

            <div id="res-adsr-curve-mount"></div>

            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-2); justify-items: center; padding: var(--space-2) 0;">
              ${renderKnobCell('res-a-m', 'res-a-v', vA, 'ATTACK')}
              ${renderKnobCell('res-d-m', 'res-d-v', vD, 'DECAY')}
              ${renderKnobCell('res-s-m', 'res-s-v', vS, 'SUSTAIN')}
              ${renderKnobCell('res-r-m', 'res-r-v', vR, 'RELEASE')}
              ${renderKnobCell('res-vel-m', 'res-vel-v', g(pVelo, 0), 'VELOCITY SENS')}
            </div>
          </div>

          <!-- 12 Scape & Sphere Envelope Modulation Depths (L1, L2, L3) -->
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div>
              <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">${rLabel} SCAPE & SPHERE ENVELOPE DEPTHS ([${baseDepth}..${baseDepth + 11}])</div>
              <div style="font-size: 11px; color: var(--color-text-muted);">Sets how much the ${rLabel} RES Envelope sweeps each X/Y axis of Sphere and Scape across Levels 1, 2, and 3.</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3);">
              ${[1, 2, 3].map((lvl) => {
                const off = baseDepth + (lvl - 1) * 4;
                return `
                  <div style="background: rgba(0,0,0,0.22); border: 1px solid var(--color-panel-border-dim); border-radius: var(--radius-sm); padding: var(--space-2); display: flex; flex-direction: column; gap: var(--space-2);">
                    <div class="hud-label" style="color: var(--color-accent); font-weight: 700; text-align: center; border-bottom: 1px solid var(--color-panel-border-dim); padding-bottom: 4px;">LEVEL ${lvl} (L${lvl})</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); justify-items: center;">
                      ${renderKnobCell(`res-l${lvl}-sph1-m`, `res-l${lvl}-sph1-v`, g(off, 0), `SPHERE X [${off}]`)}
                      ${renderKnobCell(`res-l${lvl}-sph2-m`, `res-l${lvl}-sph2-v`, g(off + 1, 0), `SPHERE Y [${off + 1}]`)}
                      ${renderKnobCell(`res-l${lvl}-scp1-m`, `res-l${lvl}-scp1-v`, g(off + 2, 0), `SCAPE X [${off + 2}]`)}
                      ${renderKnobCell(`res-l${lvl}-scp2-m`, `res-l${lvl}-scp2-v`, g(off + 3, 0), `SCAPE Y [${off + 3}]`)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;

        const curveMount = stageHost.querySelector('#res-adsr-curve-mount') as HTMLElement | null;
        let adsrPad: MultiStageShaperPad | null = null;
        if (curveMount) {
          adsrPad = new MultiStageShaperPad(curveMount, {
            bipolar: false,
            bare: true,
            editable: false,
            viewBoxHeight: 96,
            stageLabels: ['START', 'ATTACK', 'DECAY', 'SUSTAIN', 'RELEASE'],
            ...adsrToShaperState(vA, vD, vS, vR),
          });
        }
        const syncAdsrCurve = () => adsrPad?.setValue(adsrToShaperState(vA, vD, vS, vR), false);

        initKnob(stageHost, 'res-a-m', 'ATTACK', vA, 0, 127, pA, 'res-a-v', false, (v) => { vA = v; syncAdsrCurve(); }, 44);
        initKnob(stageHost, 'res-d-m', 'DECAY', vD, 0, 127, pD, 'res-d-v', false, (v) => { vD = v; syncAdsrCurve(); }, 44);
        initKnob(stageHost, 'res-s-m', 'SUSTAIN', vS, 0, 127, pS, 'res-s-v', false, (v) => { vS = v; syncAdsrCurve(); }, 44);
        initKnob(stageHost, 'res-r-m', 'RELEASE', vR, 0, 127, pR, 'res-r-v', false, (v) => { vR = v; syncAdsrCurve(); }, 44);
        initKnob(stageHost, 'res-vel-m', 'VELOCITY', g(pVelo, 0), 0, 127, pVelo, 'res-vel-v', false, undefined, 44);

        for (let lvl = 1; lvl <= 3; lvl++) {
          const off = baseDepth + (lvl - 1) * 4;
          initKnob(stageHost, `res-l${lvl}-sph1-m`, `L${lvl} SPH X`, g(off, 0), -64, 63, off, `res-l${lvl}-sph1-v`, true, undefined, 36);
          initKnob(stageHost, `res-l${lvl}-sph2-m`, `L${lvl} SPH Y`, g(off + 1, 0), -64, 63, off + 1, `res-l${lvl}-sph2-v`, true, undefined, 36);
          initKnob(stageHost, `res-l${lvl}-scp1-m`, `L${lvl} SCP X`, g(off + 2, 0), -64, 63, off + 2, `res-l${lvl}-scp1-v`, true, undefined, 36);
          initKnob(stageHost, `res-l${lvl}-scp2-m`, `L${lvl} SCP Y`, g(off + 3, 0), -64, 63, off + 3, `res-l${lvl}-scp2-v`, true, undefined, 36);
        }

        const modeEl = stageHost.querySelector('#res-mode-pills') as HTMLElement | null;
        if (modeEl) {
          bindPillSelector(modeEl, (id, btn) => {
            modeEl.querySelectorAll('.abd-pill').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            WebBridge.setParam(pMode, parseInt(id || '0', 10));
          }, 'data-mode');
        }
        return;
      }

      // ─────────────────────────────────────────────────────────
      // TAB 3: FREE (Free ADSR + Easy Destination Assignment)
      // ─────────────────────────────────────────────────────────
      if (activeTab === 'free') {
        const pA = isR1 ? ParamIdx.R1FreeEnvA : ParamIdx.R2FreeEnvA;
        const pD = isR1 ? ParamIdx.R1FreeEnvD : ParamIdx.R2FreeEnvD;
        const pS = isR1 ? ParamIdx.R1FreeEnvS : ParamIdx.R2FreeEnvS;
        const pR = isR1 ? ParamIdx.R1FreeEnvR : ParamIdx.R2FreeEnvR;
        const pMode = isR1 ? ParamIdx.R1FreeEnvMode : ParamIdx.R2FreeEnvMode;
        const pDepth = isR1 ? ParamIdx.R1FreeEnvDepth : ParamIdx.R2FreeEnvDepth;
        const pVel = isR1 ? ParamIdx.FreeADSR1VelocityDepth : ParamIdx.FreeADSR2VelocityDepth;

        const pR1Pitch = isR1 ? ParamIdx.R1FreeADSR1PitchDepth : ParamIdx.R1FreeADSR2PitchDepth;
        const pR2Pitch = isR1 ? ParamIdx.R2FreeADSR1PitchDepth : ParamIdx.R2FreeADSR2PitchDepth;
        const pBlender = isR1 ? ParamIdx.BlenderFreeADSR1Depth : ParamIdx.BlenderFreeADSR2Depth;

        let vA = g(pA, 32);
        let vD = g(pD, 68);
        let vS = g(pS, 54);
        let vR = g(pR, 72);
        const curMode = g(pMode, 0);
        const curDest = Math.max(0, Math.min(5, g(ParamIdx.ShaperResySelect, 0)));

        const modeHtml = pillSelectorHtml(
          [
            { id: '0', label: 'Normal (One-Shot)' },
            { id: '1', label: 'Repeat (Loop)' },
          ],
          String(curMode),
          { id: 'free-mode-pills', size: 'xs', attrName: 'data-mode' }
        );

        stageHost.innerHTML = `
          <!-- Step 1: Free ADSR Curve -->
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2);">
              <div>
                <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">1. SHAPER ${activeShaper} FREE ADSR CURVE ([${pA}..${pVel}])</div>
                <div style="font-size: 11px; color: var(--color-text-muted);">Assignable auxiliary envelope controlled when SHAPER ${activeShaper} is in FREE mode.</div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="hud-label" style="font-size: 9px;">CYCLE:</span>
                ${modeHtml}
              </div>
            </div>

            <div id="free-adsr-curve-mount"></div>

            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--space-2); justify-items: center; padding: var(--space-2) 0;">
              ${renderKnobCell('free-a-m', 'free-a-v', vA, 'ATTACK')}
              ${renderKnobCell('free-d-m', 'free-d-v', vD, 'DECAY')}
              ${renderKnobCell('free-s-m', 'free-s-v', vS, 'SUSTAIN')}
              ${renderKnobCell('free-r-m', 'free-r-v', vR, 'RELEASE')}
              ${renderKnobCell('free-dep-m', 'free-dep-v', g(pDepth, 64), `MASTER DEPTH [${pDepth}]`)}
              ${renderKnobCell('free-vel-m', 'free-vel-v', g(pVel, 0), `VELOCITY [${pVel}]`)}
            </div>
          </div>

          <!-- Step 2: Primary Target Assignment -->
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div>
              <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">2. PRIMARY TARGET DESTINATION ([255])</div>
              <div style="font-size: 11px; color: var(--color-text-muted);">Choose which synth section receives modulation from MASTER DEPTH [${pDepth}]:</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2);" id="free-dest-grid">
              ${PRIMARY_FREE_DESTINATIONS.map((d) => `
                <button type="button" class="btn ${curDest === d.id ? 'btn-primary active' : 'btn-outline'}" data-free-dest="${d.id}" style="display: flex; flex-direction: column; align-items: flex-start; padding: 8px 10px; height: auto; text-align: left; gap: 3px;">
                  <span style="font-weight: 700; font-size: 11px;">${d.id + 1}. ${d.name}</span>
                  <span style="font-size: 9.5px; opacity: 0.78; white-space: normal; line-height: 1.2;">${d.desc}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Step 3: Direct Send Depths for this Shaper's Free Envelope -->
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
            <div>
              <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">3. DIRECT PITCH & BLENDER SENDS (SHAPER ${activeShaper} FREE ENV)</div>
              <div style="font-size: 11px; color: var(--color-text-muted);">Independent bipolar modulation sends from Shaper ${activeShaper} Free ADSR to Pitch and Blender (active simultaneously with Primary Target):</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); justify-items: center; padding: var(--space-2) 0;">
              ${renderKnobCell('free-r1p-m', 'free-r1p-v', g(pR1Pitch, 0), `R1 PITCH DEPTH [${pR1Pitch}]`)}
              ${renderKnobCell('free-r2p-m', 'free-r2p-v', g(pR2Pitch, 0), `R2 PITCH DEPTH [${pR2Pitch}]`)}
              ${renderKnobCell('free-bld-m', 'free-bld-v', g(pBlender, 0), `BLENDER DEPTH [${pBlender}]`)}
            </div>
          </div>
        `;

        const curveMount = stageHost.querySelector('#free-adsr-curve-mount') as HTMLElement | null;
        let adsrPad: MultiStageShaperPad | null = null;
        if (curveMount) {
          adsrPad = new MultiStageShaperPad(curveMount, {
            bipolar: false,
            bare: true,
            editable: false,
            viewBoxHeight: 96,
            stageLabels: ['START', 'ATTACK', 'DECAY', 'SUSTAIN', 'RELEASE'],
            ...adsrToShaperState(vA, vD, vS, vR),
          });
        }
        const syncAdsrCurve = () => adsrPad?.setValue(adsrToShaperState(vA, vD, vS, vR), false);

        initKnob(stageHost, 'free-a-m', 'ATTACK', vA, 0, 127, pA, 'free-a-v', false, (v) => { vA = v; syncAdsrCurve(); }, 42);
        initKnob(stageHost, 'free-d-m', 'DECAY', vD, 0, 127, pD, 'free-d-v', false, (v) => { vD = v; syncAdsrCurve(); }, 42);
        initKnob(stageHost, 'free-s-m', 'SUSTAIN', vS, 0, 127, pS, 'free-s-v', false, (v) => { vS = v; syncAdsrCurve(); }, 42);
        initKnob(stageHost, 'free-r-m', 'RELEASE', vR, 0, 127, pR, 'free-r-v', false, (v) => { vR = v; syncAdsrCurve(); }, 42);
        initKnob(stageHost, 'free-dep-m', 'DEPTH', g(pDepth, 64), -64, 63, pDepth, 'free-dep-v', true, undefined, 42);
        initKnob(stageHost, 'free-vel-m', 'VELOCITY', g(pVel, 0), 0, 127, pVel, 'free-vel-v', false, undefined, 42);

        initKnob(stageHost, 'free-r1p-m', 'R1 PITCH', g(pR1Pitch, 0), -64, 63, pR1Pitch, 'free-r1p-v', true, undefined, 42);
        initKnob(stageHost, 'free-r2p-m', 'R2 PITCH', g(pR2Pitch, 0), -64, 63, pR2Pitch, 'free-r2p-v', true, undefined, 42);
        initKnob(stageHost, 'free-bld-m', 'BLENDER', g(pBlender, 0), -64, 63, pBlender, 'free-bld-v', true, undefined, 42);

        const modeEl = stageHost.querySelector('#free-mode-pills') as HTMLElement | null;
        if (modeEl) {
          bindPillSelector(modeEl, (id, btn) => {
            modeEl.querySelectorAll('.abd-pill').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            WebBridge.setParam(pMode, parseInt(id || '0', 10));
          }, 'data-mode');
        }

        stageHost.querySelectorAll('button[data-free-dest]').forEach((btnEl) => {
          const btn = btnEl as HTMLButtonElement;
          btn.addEventListener('click', () => {
            const destId = parseInt(btn.getAttribute('data-free-dest') || '0', 10);
            WebBridge.setParam(ParamIdx.ShaperResySelect, destId);
            stageHost.querySelectorAll('button[data-free-dest]').forEach((b) => {
              const active = b === btn;
              b.classList.toggle('btn-primary', active);
              b.classList.toggle('active', active);
              b.classList.toggle('btn-outline', !active);
            });
          });
        });
        return;
      }

      // ─────────────────────────────────────────────────────────
      // TAB 4: 4L/4T Master Multi-Segment Envelope ([242..252])
      // ─────────────────────────────────────────────────────────
      let l1 = g(ParamIdx.FreeEnvLevel1, 63);
      let t1 = g(ParamIdx.FreeEnvTime1, 20);
      let l2 = g(ParamIdx.FreeEnvLevel2, 30);
      let t2 = g(ParamIdx.FreeEnvTime2, 40);
      let l3 = g(ParamIdx.FreeEnvLevel3, 10);
      let t3 = g(ParamIdx.FreeEnvTime3, 60);
      let l4 = g(ParamIdx.FreeEnvLevel4, 0);
      let t4 = g(ParamIdx.FreeEnvTime4, 80);

      const curType = g(ParamIdx.FreeEnvType, 0);
      const curMode = g(ParamIdx.TLFreeEnvMode, 0);

      const typeHtml = pillSelectorHtml(
        [
          { id: '0', label: '2× Free ADSR' },
          { id: '1', label: 'Combined 4L/4T' },
        ],
        String(curType),
        { id: 'env4l4t-type-pills', size: 'xs', attrName: 'data-type' }
      );

      const modeHtml = pillSelectorHtml(
        [
          { id: '0', label: 'Normal' },
          { id: '1', label: 'Repeat' },
        ],
        String(curMode),
        { id: 'env4l4t-mode-pills', size: 'xs', attrName: 'data-mode' }
      );

      stageHost.innerHTML = `
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-2);">
            <div>
              <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">4-LEVEL / 4-TIME (4L/4T) BIPOLAR ENVELOPE</div>
              <div style="font-size: 11px; color: var(--color-text-muted);">Multi-segment bipolar contour ([242..252]) controlled from the ENV MST panel. Drag nodes or turn knobs.</div>
            </div>
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              ${typeHtml}
              ${modeHtml}
            </div>
          </div>

          <div id="env-4l4t-pad-mount"></div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); background: rgba(0,0,0,0.18); padding: var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--color-panel-border-dim);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; border-right: 1px solid var(--color-panel-border-dim);">
              <span class="hud-label" style="color: var(--color-accent); font-weight: 700;">STAGE 1</span>
              <div style="display: flex; gap: var(--space-2);">
                ${renderKnobCell('m-l1', 'v-l1', l1, 'LEVEL 1')}
                ${renderKnobCell('m-t1', 'v-t1', t1, 'TIME 1')}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; border-right: 1px solid var(--color-panel-border-dim);">
              <span class="hud-label" style="color: var(--color-accent); font-weight: 700;">STAGE 2</span>
              <div style="display: flex; gap: var(--space-2);">
                ${renderKnobCell('m-l2', 'v-l2', l2, 'LEVEL 2')}
                ${renderKnobCell('m-t2', 'v-t2', t2, 'TIME 2')}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; border-right: 1px solid var(--color-panel-border-dim);">
              <span class="hud-label" style="color: var(--color-accent); font-weight: 700;">STAGE 3</span>
              <div style="display: flex; gap: var(--space-2);">
                ${renderKnobCell('m-l3', 'v-l3', l3, 'LEVEL 3')}
                ${renderKnobCell('m-t3', 'v-t3', t3, 'TIME 3')}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
              <span class="hud-label" style="color: var(--color-accent); font-weight: 700;">STAGE 4 (REL)</span>
              <div style="display: flex; gap: var(--space-2);">
                ${renderKnobCell('m-l4', 'v-l4', l4, 'LEVEL 4')}
                ${renderKnobCell('m-t4', 'v-t4', t4, 'TIME 4')}
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-2); justify-items: center; padding-top: var(--space-2); border-top: 1px solid var(--color-panel-border-dim);">
            ${renderKnobCell('m-4l-dep', 'v-4l-dep', g(ParamIdx.TLFreeEnvDepth, 127), 'MASTER DEPTH [251]')}
            ${renderKnobCell('m-4l-vel', 'v-4l-vel', g(ParamIdx.Free4Level4TimeVelocityDepth, 0), 'VELOCITY [252]')}
            ${renderKnobCell('m-4l-r1p', 'v-4l-r1p', g(ParamIdx.R1Free4L4TPitchDepth, 0), 'R1 PITCH [40]')}
            ${renderKnobCell('m-4l-r2p', 'v-4l-r2p', g(ParamIdx.R2Free4L4TPitchDepth, 0), 'R2 PITCH [120]')}
            ${renderKnobCell('m-4l-bld', 'v-4l-bld', g(ParamIdx.BlenderFree4L4TDepth, 0), 'BLENDER [266]')}
          </div>
        </div>
      `;

      let shaperPad: MultiStageShaperPad | null = null;
      const syncPadFromKnobs = () => {
        shaperPad?.setValue({
          times: [t1 / 127, t2 / 127, t3 / 127, t4 / 127],
          levels: [l1 / 64, l2 / 64, l3 / 64, l4 / 64],
        }, false);
      };

      const kL1 = initKnob(stageHost, 'm-l1', 'LEVEL 1', l1, -64, 63, ParamIdx.FreeEnvLevel1, 'v-l1', true, (v) => { l1 = v; syncPadFromKnobs(); }, 38);
      const kT1 = initKnob(stageHost, 'm-t1', 'TIME 1', t1, 0, 127, ParamIdx.FreeEnvTime1, 'v-t1', false, (v) => { t1 = v; syncPadFromKnobs(); }, 38);
      const kL2 = initKnob(stageHost, 'm-l2', 'LEVEL 2', l2, -64, 63, ParamIdx.FreeEnvLevel2, 'v-l2', true, (v) => { l2 = v; syncPadFromKnobs(); }, 38);
      const kT2 = initKnob(stageHost, 'm-t2', 'TIME 2', t2, 0, 127, ParamIdx.FreeEnvTime2, 'v-t2', false, (v) => { t2 = v; syncPadFromKnobs(); }, 38);
      const kL3 = initKnob(stageHost, 'm-l3', 'LEVEL 3', l3, -64, 63, ParamIdx.FreeEnvLevel3, 'v-l3', true, (v) => { l3 = v; syncPadFromKnobs(); }, 38);
      const kT3 = initKnob(stageHost, 'm-t3', 'TIME 3', t3, 0, 127, ParamIdx.FreeEnvTime3, 'v-t3', false, (v) => { t3 = v; syncPadFromKnobs(); }, 38);
      const kL4 = initKnob(stageHost, 'm-l4', 'LEVEL 4', l4, -64, 63, ParamIdx.FreeEnvLevel4, 'v-l4', true, (v) => { l4 = v; syncPadFromKnobs(); }, 38);
      const kT4 = initKnob(stageHost, 'm-t4', 'TIME 4', t4, 0, 127, ParamIdx.FreeEnvTime4, 'v-t4', false, (v) => { t4 = v; syncPadFromKnobs(); }, 38);

      const padMount = stageHost.querySelector('#env-4l4t-pad-mount') as HTMLElement | null;
      if (padMount) {
        shaperPad = new MultiStageShaperPad(padMount, {
          bipolar: true,
          bare: true,
          editable: true,
          viewBoxHeight: 130,
          times: [t1 / 127, t2 / 127, t3 / 127, t4 / 127],
          levels: [l1 / 64, l2 / 64, l3 / 64, l4 / 64],
          mode: curMode + 1,
          onChange: (st) => {
            const nextT = st.times.map((t) => Math.round(Math.max(0, Math.min(1, t)) * 127));
            const nextL = st.levels.map((l) => Math.round(Math.max(-64, Math.min(63, l * 63))));
            [t1, t2, t3, t4] = nextT;
            [l1, l2, l3, l4] = nextL;

            WebBridge.setParam(ParamIdx.FreeEnvTime1, t1);
            WebBridge.setParam(ParamIdx.FreeEnvTime2, t2);
            WebBridge.setParam(ParamIdx.FreeEnvTime3, t3);
            WebBridge.setParam(ParamIdx.FreeEnvTime4, t4);
            WebBridge.setParam(ParamIdx.FreeEnvLevel1, l1);
            WebBridge.setParam(ParamIdx.FreeEnvLevel2, l2);
            WebBridge.setParam(ParamIdx.FreeEnvLevel3, l3);
            WebBridge.setParam(ParamIdx.FreeEnvLevel4, l4);

            kT1?.setValue(t1 / 127);
            kT2?.setValue(t2 / 127);
            kT3?.setValue(t3 / 127);
            kT4?.setValue(t4 / 127);
            kL1?.setValue((l1 + 64) / 127);
            kL2?.setValue((l2 + 64) / 127);
            kL3?.setValue((l3 + 64) / 127);
            kL4?.setValue((l4 + 64) / 127);

            const setTxt = (id: string, val: number, bip = false) => {
              const el = stageHost.querySelector(`#${id}`);
              if (el) el.textContent = bip && val > 0 ? `+${val}` : String(val);
            };
            setTxt('v-t1', t1); setTxt('v-t2', t2); setTxt('v-t3', t3); setTxt('v-t4', t4);
            setTxt('v-l1', l1, true); setTxt('v-l2', l2, true); setTxt('v-l3', l3, true); setTxt('v-l4', l4, true);
          },
        });
      }

      initKnob(stageHost, 'm-4l-dep', 'DEPTH', g(ParamIdx.TLFreeEnvDepth, 127), -64, 63, ParamIdx.TLFreeEnvDepth, 'v-4l-dep', true, undefined, 40);
      initKnob(stageHost, 'm-4l-vel', 'VELOCITY', g(ParamIdx.Free4Level4TimeVelocityDepth, 0), 0, 127, ParamIdx.Free4Level4TimeVelocityDepth, 'v-4l-vel', false, undefined, 40);
      initKnob(stageHost, 'm-4l-r1p', 'R1 PITCH', g(ParamIdx.R1Free4L4TPitchDepth, 0), -64, 63, ParamIdx.R1Free4L4TPitchDepth, 'v-4l-r1p', true, undefined, 40);
      initKnob(stageHost, 'm-4l-r2p', 'R2 PITCH', g(ParamIdx.R2Free4L4TPitchDepth, 0), -64, 63, ParamIdx.R2Free4L4TPitchDepth, 'v-4l-r2p', true, undefined, 40);
      initKnob(stageHost, 'm-4l-bld', 'BLENDER', g(ParamIdx.BlenderFree4L4TDepth, 0), -64, 63, ParamIdx.BlenderFree4L4TDepth, 'v-4l-bld', true, undefined, 40);

      const typeEl = stageHost.querySelector('#env4l4t-type-pills') as HTMLElement | null;
      if (typeEl) {
        bindPillSelector(typeEl, (id, btn) => {
          typeEl.querySelectorAll('.abd-pill').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          WebBridge.setParam(ParamIdx.FreeEnvType, parseInt(id || '0', 10));
        }, 'data-type');
      }

      const modeEl = stageHost.querySelector('#env4l4t-mode-pills') as HTMLElement | null;
      if (modeEl) {
        bindPillSelector(modeEl, (id, btn) => {
          modeEl.querySelectorAll('.abd-pill').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          WebBridge.setParam(ParamIdx.TLFreeEnvMode, parseInt(id || '0', 10));
        }, 'data-mode');
      }
    };

    // Bind Header Shaper Switcher (R1 / R2)
    const shaperPills = root.querySelector('#env-drawer-shaper-pills') as HTMLElement | null;
    if (shaperPills) {
      bindPillSelector(shaperPills, (shaperStr, btn) => {
        shaperPills.querySelectorAll('.abd-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeShaper = parseInt(shaperStr || '1', 10) === 2 ? 2 : 1;
        renderFocusedView();
      }, 'data-shaper');
    }

    // Bind Tab Switcher (AMP / RES / FREE / 4L4T)
    const tabPills = root.querySelector('#env-drawer-tab-pills') as HTMLElement | null;
    if (tabPills) {
      bindPillSelector(tabPills, (tabId, btn) => {
        tabPills.querySelectorAll('.abd-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = (tabId as EnvelopeDrawerTab) || 'amp';
        renderFocusedView();
      }, 'data-tab');
    }

    root.querySelector('#btn-close-env-drawer')?.addEventListener('click', () => options.onClose());

    renderFocusedView();

    return root;
  }
}
