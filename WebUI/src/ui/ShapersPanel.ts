/**
 * ABDAxionikVS — ShapersPanel.ts
 * Réplica fiel y ampliada de la sección física de Envolventes («Shapers») del hardware Hartmann Neuron.
 * 
 * Implementa 3 bloques homogéneos estructurados con las mismas clases y tokens de Scape/Sphere:
 * 1. SHAPER 1 (Resynator 1):
 *    - 4 Ruedas físicas (Wheel) + Indicadores verticales de LEDs discretos (LedLadder).
 *    - Selector de modo: [ AMP | RES | FREE ] (conmuta Shaper12Status [253]).
 *    - Modo de envolvente: [ NORM | REPEAT ] (R1AmpEnvMode / R1ResEnvMode).
 *    - Profundidad / Volume según estado.
 * 2. SHAPER 2 (Resynator 2):
 *    - Bloque homogéneo idéntico para Resynator 2.
 *    - Selector de modo: [ AMP | RES | FREE ].
 *    - Modo de envolvente: [ NORM | REPEAT ] (R2AmpEnvMode / R2ResEnvMode).
 * 3. SHAPER 3 (Silver Filter & Master EFX):
 *    - Réplica exacta del módulo físico mostrado en la consola Neuron:
 *      Ruedas con marcado dual [ A / Delay ], [ D / Reverb ], [ S / Fdbk ], [ R / Time ].
 *    - Selector de modo: [ FILTER | EFX MIX ] (Shaper3Status [362]).
 *    - En FILTER modula FilterEnv A, D, S, R ([355..358]).
 *    - En EFX MIX modula Delay Mix ([432]), Reverb Mix ([438]), Delay Feedback ([435]), Rev Decay Time ([440]).
 * 
 * Capa de abstracción:
 * Control UI -> WebBridge -> MIDI CC / NRPN -> DSP store.
 */

import { Wheel } from '@abdsynths/shared/components/wheel.js';
import { LedLadder } from '@abdsynths/shared/components/ledLadder.js';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';

export interface ShapersPanelOptions {
  onEditR1?: () => void;
  onEditR2?: () => void;
  onEditSilver?: () => void;
}

interface WheelSlot {
  wheel: Wheel;
  ladder: LedLadder;
  readoutEl: HTMLElement;
  labelPrimaryEl: HTMLElement;
  subPillEl: HTMLElement;
}

export class ShapersPanel {
  private container: HTMLElement;
  private options: ShapersPanelOptions;
  private rootEl: HTMLElement | null = null;

  // Estado de sub-modos de cada shaper
  private s1Mode: 'amp' | 'res' | 'free' = 'amp';
  private s2Mode: 'amp' | 'res' | 'free' = 'amp';
  private s3Mode: 'filter' | 'efx' = 'filter';

  // Slots de ruedas (4 por cada Shaper = 12 ruedas)
  private s1Slots: WheelSlot[] = [];
  private s2Slots: WheelSlot[] = [];
  private s3Slots: WheelSlot[] = [];

  constructor(container: HTMLElement, options: ShapersPanelOptions = {}) {
    this.container = container;
    this.options = options;
    this.render();
  }

  private render(): void {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'shapers-container';

    // 1. Selector de modo Shaper 1
    const s1PillHtml = pillSelectorHtml([
      { id: 'amp', label: 'AMP', title: 'R1 Amplifier Volume Envelope' },
      { id: 'res', label: 'RES', title: 'R1 Scape/Sphere Contour Envelope' },
      { id: 'free', label: 'FREE', title: 'R1 Free Envelope / Matrix Routing' },
    ], this.s1Mode, { id: 's1-mode-pills', size: 'xs', dense: true });

    // 2. Selector de modo Shaper 2
    const s2PillHtml = pillSelectorHtml([
      { id: 'amp', label: 'AMP', title: 'R2 Amplifier Volume Envelope' },
      { id: 'res', label: 'RES', title: 'R2 Scape/Sphere Contour Envelope' },
      { id: 'free', label: 'FREE', title: 'R2 Free Envelope / Matrix Routing' },
    ], this.s2Mode, { id: 's2-mode-pills', size: 'xs', dense: true });

    // 3. Selector de modo Shaper 3
    const s3PillHtml = pillSelectorHtml([
      { id: 'filter', label: 'FILTER', title: 'Silver Filter Cutoff Envelope' },
      { id: 'efx', label: 'EFX MIX', title: 'Master Delay & Reverb Effects Mix' },
    ], this.s3Mode, { id: 's3-mode-pills', size: 'xs', dense: true });

    // Mode toggles (Norm / Repeat)
    const s1EnvModeHtml = pillSelectorHtml([
      { id: '0', label: 'NORM', title: 'Single trigger envelope' },
      { id: '1', label: 'REP', title: 'Repeating envelope cycle' },
    ], '0', { id: 's1-env-mode-pills', size: 'xs', dense: true });

    const s2EnvModeHtml = pillSelectorHtml([
      { id: '0', label: 'NORM', title: 'Single trigger envelope' },
      { id: '1', label: 'REP', title: 'Repeating envelope cycle' },
    ], '0', { id: 's2-env-mode-pills', size: 'xs', dense: true });

    const s3EnvModeHtml = pillSelectorHtml([
      { id: '0', label: 'NORM', title: 'Single trigger envelope' },
      { id: '1', label: 'REP', title: 'Repeating envelope cycle' },
    ], '0', { id: 's3-env-mode-pills', size: 'xs', dense: true });

    this.rootEl.innerHTML = `
      <!-- BLOQUE 1: SHAPER 1 (R1) -->
      <section class="synth-panel-card shaper-block-card col-span-2" id="shaper1-card">
        <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
          <span class="stick-label">SHAPER 1 <span style="font-weight: 500; font-size: 9px; color: var(--color-text-muted);">(R1)</span></span>
          <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
            ${s1PillHtml}
            <button type="button" class="btn btn-xs btn-outline" id="btn-edit-shaper1" title="Open R1 Envelope Drawer">Edit</button>
            <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-middle" title="Colapsar / Descolapsar fila">▾</button>
          </div>
        </div>

        <div class="panel-body shaper-body" data-collapse-body style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div class="shaper-wheels-row" id="s1-wheels-mount">
            <!-- 4 Wheel Slots for Shaper 1 -->
            ${this.renderWheelSlotHtml('s1', 0, 'A', 'Amp')}
            ${this.renderWheelSlotHtml('s1', 1, 'D', 'Amp')}
            ${this.renderWheelSlotHtml('s1', 2, 'S', 'Amp')}
            ${this.renderWheelSlotHtml('s1', 3, 'R', 'Amp')}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08)); gap: 4px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              ${s1EnvModeHtml}
            </div>
            <div class="hud-pill" id="s1-target-badge" style="font-size: 8.5px; padding: 2px 6px; color: var(--color-accent); font-weight: 600;">R1 Amp Env</div>
          </div>
        </div>
      </section>

      <!-- BLOQUE 2: SHAPER 2 (R2) -->
      <section class="synth-panel-card shaper-block-card col-span-2" id="shaper2-card">
        <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
          <span class="stick-label">SHAPER 2 <span style="font-weight: 500; font-size: 9px; color: var(--color-text-muted);">(R2)</span></span>
          <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
            ${s2PillHtml}
            <button type="button" class="btn btn-xs btn-outline" id="btn-edit-shaper2" title="Open R2 Envelope Drawer">Edit</button>
            <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-middle" title="Colapsar / Descolapsar fila">▾</button>
          </div>
        </div>

        <div class="panel-body shaper-body" data-collapse-body style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div class="shaper-wheels-row" id="s2-wheels-mount">
            <!-- 4 Wheel Slots for Shaper 2 -->
            ${this.renderWheelSlotHtml('s2', 0, 'A', 'Amp')}
            ${this.renderWheelSlotHtml('s2', 1, 'D', 'Amp')}
            ${this.renderWheelSlotHtml('s2', 2, 'S', 'Amp')}
            ${this.renderWheelSlotHtml('s2', 3, 'R', 'Amp')}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08)); gap: 4px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              ${s2EnvModeHtml}
            </div>
            <div class="hud-pill" id="s2-target-badge" style="font-size: 8.5px; padding: 2px 6px; color: var(--color-accent); font-weight: 600;">R2 Amp Env</div>
          </div>
        </div>
      </section>

      <!-- BLOQUE 3: SHAPER 3 (SILVER & MASTER EFX) — RÉPLICA FOTO DE LA CONSOLA -->
      <section class="synth-panel-card shaper-block-card col-span-2" id="shaper3-card">
        <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
          <span class="stick-label">SHAPER 3 <span style="font-weight: 500; font-size: 9px; color: var(--color-text-muted);">(SILVER)</span></span>
          <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
            ${s3PillHtml}
            <button type="button" class="btn btn-xs btn-outline" id="btn-edit-shaper3" title="Open Silver & Master FX Drawer">Edit</button>
            <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-middle" title="Colapsar / Descolapsar fila">▾</button>
          </div>
        </div>

        <div class="panel-body shaper-body" data-collapse-body style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div class="shaper-wheels-row" id="s3-wheels-mount">
            <!-- 4 Wheel Slots for Shaper 3 con marcado A/Delay, D/Reverb, S/Fdbk, R/Time -->
            ${this.renderWheelSlotHtml('s3', 0, 'A', 'Delay')}
            ${this.renderWheelSlotHtml('s3', 1, 'D', 'Reverb')}
            ${this.renderWheelSlotHtml('s3', 2, 'S', 'Fdbk')}
            ${this.renderWheelSlotHtml('s3', 3, 'R', 'Time')}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08)); gap: 4px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              ${s3EnvModeHtml}
            </div>
            <div class="hud-pill" id="s3-target-badge" style="font-size: 8.5px; padding: 2px 6px; color: var(--color-accent); font-weight: 600;">Filter Cutoff Env</div>
          </div>
        </div>
      </section>
    `;

    this.container.appendChild(this.rootEl);

    // Inicializar los componentes de ruedas y ladders
    this.initShaper1Wheels();
    this.initShaper2Wheels();
    this.initShaper3Wheels();

    // Enlazar selectores de píldoras
    this.bindPillSelectors();

    // Botones Edit Drawer
    this.rootEl.querySelector('#btn-edit-shaper1')?.addEventListener('click', () => this.options.onEditR1?.());
    this.rootEl.querySelector('#btn-edit-shaper2')?.addEventListener('click', () => this.options.onEditR2?.());
    this.rootEl.querySelector('#btn-edit-shaper3')?.addEventListener('click', () => this.options.onEditSilver?.());

    // Sincronizar todos los valores iniciales
    this.syncAll();
  }

  private renderWheelSlotHtml(prefix: string, idx: number, primary: string, secondary: string): string {
    return `
      <div class="shaper-wheel-slot" data-slot="${idx}">
        <div class="shaper-wheel-bezel">
          <div id="${prefix}-ladder-${idx}" style="display: flex; align-items: center;"></div>
          <div id="${prefix}-wheel-${idx}"></div>
        </div>
        <div class="shaper-wheel-labels">
          <span class="shaper-label-primary active-mode" id="${prefix}-lbl-pri-${idx}">${primary}</span>
          <span class="shaper-sub-pill" id="${prefix}-lbl-sub-${idx}">${secondary}</span>
        </div>
        <div class="hud-pill stat-num shaper-wheel-readout" id="${prefix}-readout-${idx}">0</div>
      </div>
    `;
  }

  private initShaper1Wheels(): void {
    this.s1Slots = [];
    const primLabels = ['A', 'D', 'S', 'R'];
    for (let i = 0; i < 4; i++) {
      const ladderEl = this.rootEl?.querySelector(`#s1-ladder-${i}`) as HTMLElement | null;
      const wheelEl = this.rootEl?.querySelector(`#s1-wheel-${i}`) as HTMLElement | null;
      const readoutEl = this.rootEl?.querySelector(`#s1-readout-${i}`) as HTMLElement;
      const labelPrimaryEl = this.rootEl?.querySelector(`#s1-lbl-pri-${i}`) as HTMLElement;
      const subPillEl = this.rootEl?.querySelector(`#s1-lbl-sub-${i}`) as HTMLElement;
      if (!ladderEl || !wheelEl) continue;

      const ladder = new LedLadder(ladderEl, {
        segments: 10,
        mode: 'bar',
        bipolar: false,
        showArrows: true,
        width: 14,
        segmentHeight: 4,
        ariaLabel: `Shaper 1 ${primLabels[i]} Level`,
      });

      const wheel = new Wheel(wheelEl, {
        type: 'mod',
        label: `S1 ${primLabels[i]}`,
        min: 0,
        max: 127,
        frameWidth: 18,
        frameHeight: 76,
        onChange: (rawVal: number) => {
          const norm = Math.max(0, Math.min(1, rawVal / 127.0));
          ladder.setValue(norm);
          readoutEl.textContent = String(Math.round(rawVal));
          const targetParam = this.getActiveParamForS1(i);
          WebBridge.setParam(targetParam, rawVal);
        },
      });

      this.s1Slots.push({ wheel, ladder, readoutEl, labelPrimaryEl, subPillEl });
    }
  }

  private initShaper2Wheels(): void {
    this.s2Slots = [];
    const primLabels = ['A', 'D', 'S', 'R'];
    for (let i = 0; i < 4; i++) {
      const ladderEl = this.rootEl?.querySelector(`#s2-ladder-${i}`) as HTMLElement | null;
      const wheelEl = this.rootEl?.querySelector(`#s2-wheel-${i}`) as HTMLElement | null;
      const readoutEl = this.rootEl?.querySelector(`#s2-readout-${i}`) as HTMLElement;
      const labelPrimaryEl = this.rootEl?.querySelector(`#s2-lbl-pri-${i}`) as HTMLElement;
      const subPillEl = this.rootEl?.querySelector(`#s2-lbl-sub-${i}`) as HTMLElement;
      if (!ladderEl || !wheelEl) continue;

      const ladder = new LedLadder(ladderEl, {
        segments: 10,
        mode: 'bar',
        bipolar: false,
        showArrows: true,
        width: 14,
        segmentHeight: 4,
        ariaLabel: `Shaper 2 ${primLabels[i]} Level`,
      });

      const wheel = new Wheel(wheelEl, {
        type: 'mod',
        label: `S2 ${primLabels[i]}`,
        min: 0,
        max: 127,
        frameWidth: 18,
        frameHeight: 76,
        onChange: (rawVal: number) => {
          const norm = Math.max(0, Math.min(1, rawVal / 127.0));
          ladder.setValue(norm);
          readoutEl.textContent = String(Math.round(rawVal));
          const targetParam = this.getActiveParamForS2(i);
          WebBridge.setParam(targetParam, rawVal);
        },
      });

      this.s2Slots.push({ wheel, ladder, readoutEl, labelPrimaryEl, subPillEl });
    }
  }

  private initShaper3Wheels(): void {
    this.s3Slots = [];
    const primLabels = ['A', 'D', 'S', 'R'];
    for (let i = 0; i < 4; i++) {
      const ladderEl = this.rootEl?.querySelector(`#s3-ladder-${i}`) as HTMLElement | null;
      const wheelEl = this.rootEl?.querySelector(`#s3-wheel-${i}`) as HTMLElement | null;
      const readoutEl = this.rootEl?.querySelector(`#s3-readout-${i}`) as HTMLElement;
      const labelPrimaryEl = this.rootEl?.querySelector(`#s3-lbl-pri-${i}`) as HTMLElement;
      const subPillEl = this.rootEl?.querySelector(`#s3-lbl-sub-${i}`) as HTMLElement;
      if (!ladderEl || !wheelEl) continue;

      const ladder = new LedLadder(ladderEl, {
        segments: 10,
        mode: 'bar',
        bipolar: false,
        showArrows: true,
        width: 14,
        segmentHeight: 4,
        ariaLabel: `Shaper 3 ${primLabels[i]} Level`,
      });

      const wheel = new Wheel(wheelEl, {
        type: 'mod',
        label: `S3 ${primLabels[i]}`,
        min: 0,
        max: 127,
        frameWidth: 18,
        frameHeight: 76,
        onChange: (rawVal: number) => {
          const maxVal = this.s3Mode === 'efx' && (i === 0 || i === 1 || i === 2) ? 100 : 127;
          const norm = Math.max(0, Math.min(1, rawVal / maxVal));
          ladder.setValue(norm);
          readoutEl.textContent = String(Math.round(rawVal));
          const targetParam = this.getActiveParamForS3(i);
          WebBridge.setParam(targetParam, rawVal);
        },
      });

      this.s3Slots.push({ wheel, ladder, readoutEl, labelPrimaryEl, subPillEl });
    }
  }

  private bindPillSelectors(): void {
    if (!this.rootEl) return;

    // Shaper 1 Mode
    const s1ModeEl = this.rootEl.querySelector<HTMLElement>('#s1-mode-pills');
    if (s1ModeEl) {
      bindPillSelector(s1ModeEl, (id) => {
        this.s1Mode = id as 'amp' | 'res' | 'free';
        const statusIdx = this.s1Mode === 'res' ? 0 : (this.s1Mode === 'amp' ? 1 : 2);
        WebBridge.setParam(ParamIdx.Shaper12Status, statusIdx);
        this.updateS1LabelsAndSync();
      });
    }

    // Shaper 2 Mode
    const s2ModeEl = this.rootEl.querySelector<HTMLElement>('#s2-mode-pills');
    if (s2ModeEl) {
      bindPillSelector(s2ModeEl, (id) => {
        this.s2Mode = id as 'amp' | 'res' | 'free';
        const statusIdx = this.s2Mode === 'res' ? 0 : (this.s2Mode === 'amp' ? 1 : 2);
        WebBridge.setParam(ParamIdx.Shaper12Status, statusIdx);
        this.updateS2LabelsAndSync();
      });
    }

    // Shaper 3 Mode (Silver Filter vs Efx Mix)
    const s3ModeEl = this.rootEl.querySelector<HTMLElement>('#s3-mode-pills');
    if (s3ModeEl) {
      bindPillSelector(s3ModeEl, (id) => {
        this.s3Mode = id as 'filter' | 'efx';
        WebBridge.setParam(ParamIdx.Shaper3Status, this.s3Mode === 'filter' ? 1 : 0);
        this.updateS3LabelsAndSync();
      });
    }

    // Shaper 1 Env Mode (Norm / Repeat)
    const s1EnvModeEl = this.rootEl.querySelector<HTMLElement>('#s1-env-mode-pills');
    if (s1EnvModeEl) {
      bindPillSelector(s1EnvModeEl, (id) => {
        const modeVal = Number(id);
        const targetParam = this.s1Mode === 'res' ? ParamIdx.R1ResEnvMode : ParamIdx.R1AmpEnvMode;
        WebBridge.setParam(targetParam, modeVal);
      });
    }

    // Shaper 2 Env Mode (Norm / Repeat)
    const s2EnvModeEl = this.rootEl.querySelector<HTMLElement>('#s2-env-mode-pills');
    if (s2EnvModeEl) {
      bindPillSelector(s2EnvModeEl, (id) => {
        const modeVal = Number(id);
        const targetParam = this.s2Mode === 'res' ? ParamIdx.R2ResEnvMode : ParamIdx.R2AmpEnvMode;
        WebBridge.setParam(targetParam, modeVal);
      });
    }

    // Shaper 3 Env Mode (Norm / Repeat)
    const s3EnvModeEl = this.rootEl.querySelector<HTMLElement>('#s3-env-mode-pills');
    if (s3EnvModeEl) {
      bindPillSelector(s3EnvModeEl, (id) => {
        WebBridge.setParam(ParamIdx.FilterEnvMode, Number(id));
      });
    }
  }

  private getActiveParamForS1(slotIdx: number): number {
    if (this.s1Mode === 'amp') {
      const params = [ParamIdx.R1AmpEnvA, ParamIdx.R1AmpEnvD, ParamIdx.R1AmpEnvS, ParamIdx.R1AmpEnvR];
      return params[slotIdx];
    } else if (this.s1Mode === 'res') {
      const params = [ParamIdx.R1ResEnvA, ParamIdx.R1ResEnvD, ParamIdx.R1ResEnvS, ParamIdx.R1ResEnvR];
      return params[slotIdx];
    } else {
      // Free ADSR 1
      const params = [205, 206, 207, 208];
      return params[slotIdx];
    }
  }

  private getActiveParamForS2(slotIdx: number): number {
    if (this.s2Mode === 'amp') {
      const params = [ParamIdx.R2AmpEnvA, ParamIdx.R2AmpEnvD, ParamIdx.R2AmpEnvS, ParamIdx.R2AmpEnvR];
      return params[slotIdx];
    } else if (this.s2Mode === 'res') {
      const params = [ParamIdx.R2ResEnvA, ParamIdx.R2ResEnvD, ParamIdx.R2ResEnvS, ParamIdx.R2ResEnvR];
      return params[slotIdx];
    } else {
      // Free ADSR 2
      const params = [235, 236, 237, 238];
      return params[slotIdx];
    }
  }

  private getActiveParamForS3(slotIdx: number): number {
    if (this.s3Mode === 'filter') {
      const params = [ParamIdx.FilterEnvA, ParamIdx.FilterEnvD, ParamIdx.FilterEnvS, ParamIdx.FilterEnvR];
      return params[slotIdx];
    } else {
      // Efx Mix: Delay Mix, Reverb Mix, Delay Feedback, Rev Decay Time
      const params = [ParamIdx.SoundMFXDelayMix, ParamIdx.SoundMFXReverbMix, ParamIdx.SoundMFXDelayFeedback, ParamIdx.SoundMFXRevDecayTime];
      return params[slotIdx];
    }
  }

  private updateS1LabelsAndSync(): void {
    // Sincronizar estado visual de píldoras de modo S1
    const s1Pills = this.rootEl?.querySelectorAll<HTMLButtonElement>('#s1-mode-pills [data-pill]');
    s1Pills?.forEach((btn) => {
      const isActive = btn.getAttribute('data-pill') === this.s1Mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const targetBadge = this.rootEl?.querySelector('#s1-target-badge');
    const subLabels = this.s1Mode === 'amp' ? ['Amp', 'Amp', 'Amp', 'Amp']
                    : (this.s1Mode === 'res' ? ['Res', 'Res', 'Res', 'Res'] : ['Free', 'Free', 'Free', 'Free']);
    
    if (targetBadge) {
      targetBadge.textContent = this.s1Mode === 'amp' ? 'R1 Amp Env'
                              : (this.s1Mode === 'res' ? 'R1 ResEnv Contour' : 'Free ADSR 1 Matrix');
    }

    for (let i = 0; i < 4; i++) {
      const slot = this.s1Slots[i];
      if (!slot) continue;
      slot.subPillEl.textContent = subLabels[i];
      const paramId = this.getActiveParamForS1(i);
      const val = WebBridge.getParam(paramId, i === 2 ? 127 : 0);
      const norm = Math.max(0, Math.min(1, val / 127.0));
      slot.wheel.setValue(val, false);
      slot.ladder.setValue(norm);
      slot.readoutEl.textContent = String(Math.round(val));
    }

    // Sincronizar píldoras de Env Mode (Norm / Rep)
    const envModeParam = this.s1Mode === 'res' ? ParamIdx.R1ResEnvMode : ParamIdx.R1AmpEnvMode;
    const envVal = String(Math.round(WebBridge.getParam(envModeParam, 0)));
    const envPills = this.rootEl?.querySelectorAll<HTMLButtonElement>('#s1-env-mode-pills [data-pill]');
    envPills?.forEach((btn) => {
      const isActive = btn.getAttribute('data-pill') === envVal;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  private updateS2LabelsAndSync(): void {
    // Sincronizar estado visual de píldoras de modo S2
    const s2Pills = this.rootEl?.querySelectorAll<HTMLButtonElement>('#s2-mode-pills [data-pill]');
    s2Pills?.forEach((btn) => {
      const isActive = btn.getAttribute('data-pill') === this.s2Mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const targetBadge = this.rootEl?.querySelector('#s2-target-badge');
    const subLabels = this.s2Mode === 'amp' ? ['Amp', 'Amp', 'Amp', 'Amp']
                    : (this.s2Mode === 'res' ? ['Res', 'Res', 'Res', 'Res'] : ['Free', 'Free', 'Free', 'Free']);
    
    if (targetBadge) {
      targetBadge.textContent = this.s2Mode === 'amp' ? 'R2 Amp Env'
                              : (this.s2Mode === 'res' ? 'R2 ResEnv Contour' : 'Free ADSR 2 Matrix');
    }

    for (let i = 0; i < 4; i++) {
      const slot = this.s2Slots[i];
      if (!slot) continue;
      slot.subPillEl.textContent = subLabels[i];
      const paramId = this.getActiveParamForS2(i);
      const val = WebBridge.getParam(paramId, i === 2 ? 127 : 0);
      const norm = Math.max(0, Math.min(1, val / 127.0));
      slot.wheel.setValue(val, false);
      slot.ladder.setValue(norm);
      slot.readoutEl.textContent = String(Math.round(val));
    }

    // Sincronizar píldoras de Env Mode (Norm / Rep)
    const envModeParam = this.s2Mode === 'res' ? ParamIdx.R2ResEnvMode : ParamIdx.R2AmpEnvMode;
    const envVal = String(Math.round(WebBridge.getParam(envModeParam, 0)));
    const envPills = this.rootEl?.querySelectorAll<HTMLButtonElement>('#s2-env-mode-pills [data-pill]');
    envPills?.forEach((btn) => {
      const isActive = btn.getAttribute('data-pill') === envVal;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  private updateS3LabelsAndSync(): void {
    // Sincronizar estado visual de píldoras de modo S3
    const s3Pills = this.rootEl?.querySelectorAll<HTMLButtonElement>('#s3-mode-pills [data-pill]');
    s3Pills?.forEach((btn) => {
      const isActive = btn.getAttribute('data-pill') === this.s3Mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const targetBadge = this.rootEl?.querySelector('#s3-target-badge');
    const isFilter = this.s3Mode === 'filter';
    
    if (targetBadge) {
      targetBadge.textContent = isFilter ? 'Filter Cutoff Env' : 'Master Delay & Reverb';
    }

    for (let i = 0; i < 4; i++) {
      const slot = this.s3Slots[i];
      if (!slot) continue;

      // Resaltado visual fiel a la consola
      slot.labelPrimaryEl.classList.toggle('active-mode', isFilter);
      slot.subPillEl.classList.toggle('active-mode', !isFilter);

      const paramId = this.getActiveParamForS3(i);
      const defaultVal = isFilter ? (i === 2 ? 127 : 0) : (i < 2 ? 20 : 50);
      const maxVal = !isFilter && (i === 0 || i === 1 || i === 2) ? 100 : 127;
      const val = WebBridge.getParam(paramId, defaultVal);
      const norm = Math.max(0, Math.min(1, val / maxVal));

      slot.wheel.setValue(val, false);
      slot.ladder.setValue(norm);
      slot.readoutEl.textContent = String(Math.round(val));
    }

    // Sincronizar píldoras de Env Mode (Norm / Rep)
    const envVal = String(Math.round(WebBridge.getParam(ParamIdx.FilterEnvMode, 0)));
    const envPills = this.rootEl?.querySelectorAll<HTMLButtonElement>('#s3-env-mode-pills [data-pill]');
    envPills?.forEach((btn) => {
      const isActive = btn.getAttribute('data-pill') === envVal;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  public syncAll(): void {
    // Sincronizar modos desde parámetros del motor si están presentes
    const s12Status = Math.round(WebBridge.getParam(ParamIdx.Shaper12Status, 1));
    const s12Mode = s12Status === 0 ? 'res' : (s12Status === 1 ? 'amp' : 'free');
    this.s1Mode = s12Mode;
    this.s2Mode = s12Mode;

    const s3Status = Math.round(WebBridge.getParam(ParamIdx.Shaper3Status, 1));
    this.s3Mode = s3Status === 0 ? 'efx' : 'filter';

    this.updateS1LabelsAndSync();
    this.updateS2LabelsAndSync();
    this.updateS3LabelsAndSync();
  }

  /**
   * Actualiza en tiempo real cualquier parámetro afectado si coincide con alguno de los activos.
   */
  public updateParam(idx: number, val: number): void {
    if (idx === ParamIdx.Shaper12Status) {
      const s12Mode = val === 0 ? 'res' : (val === 1 ? 'amp' : 'free');
      this.s1Mode = s12Mode;
      this.s2Mode = s12Mode;
      this.updateS1LabelsAndSync();
      this.updateS2LabelsAndSync();
      return;
    }
    if (idx === ParamIdx.Shaper3Status) {
      this.s3Mode = val === 0 ? 'efx' : 'filter';
      this.updateS3LabelsAndSync();
      return;
    }
    if (idx === ParamIdx.R1AmpEnvMode || idx === ParamIdx.R1ResEnvMode) {
      this.updateS1LabelsAndSync();
      return;
    }
    if (idx === ParamIdx.R2AmpEnvMode || idx === ParamIdx.R2ResEnvMode) {
      this.updateS2LabelsAndSync();
      return;
    }
    if (idx === ParamIdx.FilterEnvMode) {
      this.updateS3LabelsAndSync();
      return;
    }

    // Shaper 1
    for (let i = 0; i < 4; i++) {
      if (this.getActiveParamForS1(i) === idx) {
        const slot = this.s1Slots[i];
        if (slot) {
          const norm = Math.max(0, Math.min(1, val / 127.0));
          slot.wheel.setValue(val, false);
          slot.ladder.setValue(norm);
          slot.readoutEl.textContent = String(Math.round(val));
        }
        return;
      }
    }

    // Shaper 2
    for (let i = 0; i < 4; i++) {
      if (this.getActiveParamForS2(i) === idx) {
        const slot = this.s2Slots[i];
        if (slot) {
          const norm = Math.max(0, Math.min(1, val / 127.0));
          slot.wheel.setValue(val, false);
          slot.ladder.setValue(norm);
          slot.readoutEl.textContent = String(Math.round(val));
        }
        return;
      }
    }

    // Shaper 3
    for (let i = 0; i < 4; i++) {
      if (this.getActiveParamForS3(i) === idx) {
        const slot = this.s3Slots[i];
        if (slot) {
          const maxVal = this.s3Mode === 'efx' && (i === 0 || i === 1 || i === 2) ? 100 : 127;
          const norm = Math.max(0, Math.min(1, val / maxVal));
          slot.wheel.setValue(val, false);
          slot.ladder.setValue(norm);
          slot.readoutEl.textContent = String(Math.round(val));
        }
        return;
      }
    }
  }

  public destroy(): void {
    [...this.s1Slots, ...this.s2Slots, ...this.s3Slots].forEach((s) => {
      s.wheel.destroy();
      s.ladder.destroy();
    });
    if (this.rootEl?.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.rootEl = null;
  }
}
