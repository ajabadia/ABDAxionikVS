/**
 * ABDAxionikVS — SilverPanel.ts
 * Panel dedicado para Silver Filter & Multi-FX Rack ([271..362])
 * Estructurado con el mismo diseño estético que las cajas de Sphere/Scape:
 * - Header con badge SILVER, selector de niveles (FILT, FREQ, TIME), toggle On/Off y botón Edit Silver.
 * - Pad vectorial 2D TrajectoryStick2D interactivo con grabador de trayectorias.
 * - Footer con lecturas dinámicas de parámetros y selectores rápidos de algoritmos FREQ y TIME.
 */

import { TrajectoryStick2D, type StickCoordinate } from './TrajectoryStick2D.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';

export interface SilverPanelOptions {
  onEditSilver?: () => void;
}

export const FREQ_ALGO_NAMES = ['EQ/Comp', 'Distortion', 'RingMod', 'Decimator', 'Sp-Warp'];
export const TIME_ALGO_NAMES = ['St.Spread', 'L/R Delay', 'Flanger', 'Phaser', 'Chorus'];

export class SilverPanel {
  private container: HTMLElement;
  private options: SilverPanelOptions;
  private rootEl: HTMLElement | null = null;
  private silverStick: TrajectoryStick2D | null = null;
  private currentSilverLevel: number = 0; // 0: Filter, 1: Freq FX, 2: Time FX

  constructor(container: HTMLElement, options: SilverPanelOptions = {}) {
    this.container = container;
    this.options = options;
    this.render();
  }

  private render(): void {
    const curLevel = this.currentSilverLevel;
    const silverLevelHtml = pillSelectorHtml([
      { id: '0', label: 'FILT', title: 'Stick controls Filter (Cutoff X / Reso Y)' },
      { id: '1', label: 'FREQ', title: 'Stick controls Frequency FX' },
      { id: '2', label: 'TIME', title: 'Stick controls Time FX' },
    ], String(curLevel), { id: 'silver-level-pills', size: 'xs', dense: true, attrName: 'data-level' });

    const curFreqIdx = Math.max(0, Math.min(FREQ_ALGO_NAMES.length - 1, Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 2))));
    const curTimeIdx = Math.max(0, Math.min(TIME_ALGO_NAMES.length - 1, Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 4))));

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'synth-panel-card silver-hardware-panel';
    this.rootEl.innerHTML = `
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08)); gap: 6px;">
        <span class="stick-label">SILVER</span>
        <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
          ${silverLevelHtml}
          <button type="button" class="btn btn-xs btn-primary active" id="btn-toggle-silver" title="Silver Filter & FX On / Off [271]">ON</button>
          <button type="button" class="btn btn-xs btn-outline" id="btn-edit-silver" title="Silver & Multi-FX Rack (Ctrl+F)">Edit</button>
          <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-top" title="Colapsar / Descolapsar fila">▾</button>
        </div>
      </div>

      <div class="panel-body silver-body" data-collapse-body style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
        <!-- Stick Mount Centrado (idéntico a Scape/Sphere) -->
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 120px;">
          <div id="silver-stick-mount" style="display: flex; align-items: center; justify-content: center;"></div>
        </div>

        <!-- Footer / Readouts & Quick Algo Cyclers -->
        <div style="display: flex; flex-direction: column; gap: 4px; padding-top: 4px; border-top: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 4px;">
            <div class="hud-pill stat-num" id="silver-readout-x" style="font-size: 8.5px; padding: 1px 4px; flex: 1; text-align: center;" title="Horizontal Parameter">CUT: 100</div>
            <div class="hud-pill stat-num" id="silver-readout-y" style="font-size: 8.5px; padding: 1px 4px; flex: 1; text-align: center;" title="Vertical Parameter">RES: 0.20</div>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 4px;">
            <button type="button" class="btn btn-xs btn-outline" id="btn-cycle-freqfx" style="font-size: 8px; padding: 1px 4px; flex: 1;" title="Cycle Frequency FX Algorithm">
              F: <strong id="cur-freq-fx-val">${FREQ_ALGO_NAMES[curFreqIdx]}</strong>
            </button>
            <button type="button" class="btn btn-xs btn-outline" id="btn-cycle-timefx" style="font-size: 8px; padding: 1px 4px; flex: 1;" title="Cycle Time FX Algorithm">
              T: <strong id="cur-time-fx-val">${TIME_ALGO_NAMES[curTimeIdx]}</strong>
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    // Inicializar Stick 2D de Silver
    this.initSilverStick();

    // Eventos
    this.rootEl.querySelector('#btn-edit-silver')?.addEventListener('click', () => {
      this.options.onEditSilver?.();
    });

    const silverBtn = this.rootEl.querySelector('#btn-toggle-silver');
    silverBtn?.addEventListener('click', () => {
      const isCurrentlyOn = silverBtn.classList.contains('active');
      const nextState = !isCurrentlyOn;
      WebBridge.setParam(ParamIdx.SilverSwitch, nextState ? 1 : 0);
      this.updateSilverToggle(nextState);
    });

    // Píldoras de nivel FILT, FREQ, TIME
    const levelContainer = this.rootEl.querySelector('#silver-level-pills') as HTMLElement | null;
    if (levelContainer) {
      bindPillSelector(levelContainer, (lvlStr) => {
        const lvl = parseInt(lvlStr || '0', 10);
        this.setSilverLevel(lvl);
      }, 'data-level');
    }

    // Ciclar algoritmos rápidos
    this.rootEl.querySelector('#btn-cycle-freqfx')?.addEventListener('click', () => {
      const cur = Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 2));
      const next = (cur + 1) % FREQ_ALGO_NAMES.length;
      WebBridge.setParam(ParamIdx.SilverSwitch, 1);
      WebBridge.setParam(ParamIdx.FreqFXSwitch, 1);
      WebBridge.setParam(ParamIdx.CurFreqFX, next);
      this.updateFreqAlgo(FREQ_ALGO_NAMES[next]);
      this.updateSilver();
    });

    this.rootEl.querySelector('#btn-cycle-timefx')?.addEventListener('click', () => {
      const cur = Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 4));
      const next = (cur + 1) % TIME_ALGO_NAMES.length;
      WebBridge.setParam(ParamIdx.SilverSwitch, 1);
      WebBridge.setParam(ParamIdx.TimeFXSwitch, 1);
      WebBridge.setParam(ParamIdx.CurTimeFX, next);
      this.updateTimeAlgo(TIME_ALGO_NAMES[next]);
      this.updateSilver();
    });
  }

  private initSilverStick(): void {
    const mount = this.rootEl?.querySelector('#silver-stick-mount');
    if (!mount) return;

    this.silverStick = new TrajectoryStick2D(mount as HTMLElement, {
      label: 'SILVER',
      resynator: 1,
      domain: 'scape',
      showHeader: false,
      showLayers: false,
      readout: false,
      hasRecorder: true,
      springReturn: false,
      size: 110,
      className: 'borderless',
      labels: {
        north: '▲ RESO +',
        south: '▼ RESO -',
        west: '◀ CUT -',
        east: 'CUT + ▶',
      },
      onPositionChange: (_layerIdx, coord) => {
        this.dispatchSilverStick(coord);
      },
    });

    this.updateSilver();
  }

  private dispatchSilverStick(coord: StickCoordinate): void {
    const level = this.currentSilverLevel;
    const readoutX = this.rootEl?.querySelector('#silver-readout-x');
    const readoutY = this.rootEl?.querySelector('#silver-readout-y');

    if (level === 0) {
      // Filter Cutoff [274] & Resonance [275]
      const cut = Math.round(coord.x * 127.0);
      const res = Math.round(coord.y * 127.0);
      WebBridge.setParam(ParamIdx.FilterFreq, cut);
      WebBridge.setParam(ParamIdx.FilterReso, res);
      if (readoutX) readoutX.textContent = `CUT: ${cut}`;
      if (readoutY) readoutY.textContent = `RES: ${(res / 127.0).toFixed(2)}`;
    } else if (level === 1) {
      // Frequency FX mode
      const curFreqFx = Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 0));
      if (curFreqFx === 2) {
        // RingMod: RM_ModFreq [314], RM_Mix [310]
        const modFreq = Math.round(coord.x * 127.0);
        const mix = Math.round(coord.y * 127.0);
        WebBridge.setParam(314, modFreq);
        WebBridge.setParam(310, mix);
        if (readoutX) readoutX.textContent = `FREQ: ${modFreq}`;
        if (readoutY) readoutY.textContent = `MIX: ${mix}`;
      } else if (curFreqFx === 1) {
        // Distortion: DS_InGain [306], DS_PreFilter [307]
        const inGain = Math.round(coord.x * 127.0);
        const preCut = Math.round(coord.y * 127.0);
        WebBridge.setParam(306, inGain);
        WebBridge.setParam(307, preCut);
        if (readoutX) readoutX.textContent = `DRV: ${inGain}`;
        if (readoutY) readoutY.textContent = `PRE: ${preCut}`;
      } else if (curFreqFx === 3) {
        // Decimator: DC_SHFactor [325], DC_Mix [324]
        const sh = Math.round(coord.x * 127.0);
        const mix = Math.round(coord.y * 127.0);
        WebBridge.setParam(325, sh);
        WebBridge.setParam(324, mix);
        if (readoutX) readoutX.textContent = `S&H: ${sh}`;
        if (readoutY) readoutY.textContent = `MIX: ${mix}`;
      } else {
        const valX = Math.round(coord.x * 127.0);
        const valY = Math.round(coord.y * 127.0);
        if (readoutX) readoutX.textContent = `X: ${valX}`;
        if (readoutY) readoutY.textContent = `Y: ${valY}`;
      }
    } else if (level === 2) {
      // Time FX mode
      const curTimeFx = Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 0));
      if (curTimeFx === 1) {
        // LR Delay: DL_Mix [333], DL_Feedback [336]
        const mix = Math.round(coord.x * 127.0);
        const fb = Math.round(coord.y * 127.0);
        WebBridge.setParam(333, mix);
        WebBridge.setParam(336, fb);
        if (readoutX) readoutX.textContent = `MIX: ${mix}`;
        if (readoutY) readoutY.textContent = `FDBK: ${fb}`;
      } else if (curTimeFx === 4) {
        // Chorus: CH_Mix [352], CH_Depth [353]
        const mix = Math.round(coord.x * 127.0);
        const depth = Math.round(coord.y * 127.0);
        WebBridge.setParam(352, mix);
        WebBridge.setParam(353, depth);
        if (readoutX) readoutX.textContent = `MIX: ${mix}`;
        if (readoutY) readoutY.textContent = `DEP: ${depth}`;
      } else {
        const valX = Math.round(coord.x * 127.0);
        const valY = Math.round(coord.y * 127.0);
        if (readoutX) readoutX.textContent = `X: ${valX}`;
        if (readoutY) readoutY.textContent = `Y: ${valY}`;
      }
    }
  }

  public setSilverLevel(level: number): void {
    this.currentSilverLevel = level;

    // Actualizar píldoras de nivel
    this.rootEl?.querySelectorAll('#silver-level-pills .abd-pill, #silver-level-pills .ndb-chip').forEach((btn) => {
      const btnLvl = parseInt(btn.getAttribute('data-level') || '0', 10);
      btn.classList.toggle('active', btnLvl === level);
    });

    // Actualizar etiquetas cardinales del stick
    if (this.silverStick) {
      if (level === 0) {
        this.silverStick.setLabels({
          north: '▲ RESO +',
          south: '▼ RESO -',
          west: '◀ CUT -',
          east: 'CUT + ▶',
        });
      } else if (level === 1) {
        this.silverStick.setLabels({
          north: '▲ PAR 2 +',
          south: '▼ PAR 2 -',
          west: '◀ PAR 1 -',
          east: 'PAR 1 + ▶',
        });
      } else {
        this.silverStick.setLabels({
          north: '▲ PAR 2 +',
          south: '▼ PAR 2 -',
          west: '◀ PAR 1 -',
          east: 'PAR 1 + ▶',
        });
      }
    }

    this.updateSilver();
  }

  public updateSilverToggle(isOn: boolean): void {
    const btn = this.rootEl?.querySelector('#btn-toggle-silver');
    if (btn) {
      btn.classList.toggle('active', isOn);
      btn.classList.toggle('btn-primary', isOn);
      btn.classList.toggle('btn-outline', !isOn);
      btn.textContent = isOn ? 'ON' : 'OFF';
    }
  }

  public updateFreqAlgo(name: string): void {
    const el = this.rootEl?.querySelector('#cur-freq-fx-val');
    if (el) el.textContent = name;
  }

  public updateTimeAlgo(name: string): void {
    const el = this.rootEl?.querySelector('#cur-time-fx-val');
    if (el) el.textContent = name;
  }

  public updateSilver(_paramId?: number): void {
    const readoutX = this.rootEl?.querySelector('#silver-readout-x');
    const readoutY = this.rootEl?.querySelector('#silver-readout-y');

    if (this.currentSilverLevel === 0) {
      const cut = Math.round(WebBridge.getParam(ParamIdx.FilterFreq, 100));
      const res = Math.round(WebBridge.getParam(ParamIdx.FilterReso, 25));
      if (readoutX) readoutX.textContent = `CUT: ${cut}`;
      if (readoutY) readoutY.textContent = `RES: ${(res / 127.0).toFixed(2)}`;
      if (this.silverStick && !this.silverStick.isRecording) {
        this.silverStick.setPosition(0, cut / 127.0, res / 127.0, false);
      }
    } else if (this.currentSilverLevel === 1) {
      const curFreqFx = Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 0));
      let lblX = 'PAR1';
      let lblY = 'PAR2';
      let valX = 64;
      let valY = 64;

      if (curFreqFx === 2) {
        lblX = 'FREQ';
        lblY = 'MIX';
        valX = Math.round(WebBridge.getParam(314, 64));
        valY = Math.round(WebBridge.getParam(310, 64));
      } else if (curFreqFx === 1) {
        lblX = 'DRV';
        lblY = 'PRE';
        valX = Math.round(WebBridge.getParam(306, 64));
        valY = Math.round(WebBridge.getParam(307, 64));
      } else if (curFreqFx === 3) {
        lblX = 'S&H';
        lblY = 'MIX';
        valX = Math.round(WebBridge.getParam(325, 16));
        valY = Math.round(WebBridge.getParam(324, 64));
      }

      if (readoutX) readoutX.textContent = `${lblX}: ${valX}`;
      if (readoutY) readoutY.textContent = `${lblY}: ${valY}`;
      if (this.silverStick && !this.silverStick.isRecording) {
        this.silverStick.setPosition(0, valX / 127.0, valY / 127.0, false);
      }
    } else if (this.currentSilverLevel === 2) {
      const curTimeFx = Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 0));
      let lblX = 'PAR1';
      let lblY = 'PAR2';
      let valX = 64;
      let valY = 64;

      if (curTimeFx === 1) {
        lblX = 'TIME';
        lblY = 'FDBK';
        valX = Math.round(WebBridge.getParam(333, 50));
        valY = Math.round(WebBridge.getParam(336, 40));
      } else if (curTimeFx === 4) {
        lblX = 'MIX';
        lblY = 'DEP';
        valX = Math.round(WebBridge.getParam(352, 64));
        valY = Math.round(WebBridge.getParam(353, 64));
      }

      if (readoutX) readoutX.textContent = `${lblX}: ${valX}`;
      if (readoutY) readoutY.textContent = `${lblY}: ${valY}`;
      if (this.silverStick && !this.silverStick.isRecording) {
        this.silverStick.setPosition(0, valX / 127.0, valY / 127.0, false);
      }
    }
  }

  public destroy(): void {
    this.silverStick?.destroy();
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.rootEl = null;
  }
}
