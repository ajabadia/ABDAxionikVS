/**
 * ABDAxionikVS — SilverPanel.ts
 * Panel dedicado para Silver Filter & Multi-FX Rack ([271..362])
 * Estructurado con el mismo diseño estético que las cajas vecinas (Resynator 1 y 2):
 * - Header exterior idéntico a Resynator 1 y 2 (badge SILVER, botón ON/OFF, botón Edit, chevron colapso).
 * - Tres columnas en el interior del cuerpo:
 *   - Izquierda: Columna vertical de pills seleccionables con los 5 algoritmos FREQ FX.
 *   - Centro: Sub-caja TrajectoryStick2D idéntica a Scape/Sphere con selector [FILT | FREQ | TIME] en su header y grabador.
 *   - Derecha: Columna vertical de pills seleccionables con los 5 algoritmos TIME FX.
 */

import { TrajectoryStick2D, type StickCoordinate, type StickLabels } from './TrajectoryStick2D.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';

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
    const curFreqIdx = Math.max(0, Math.min(FREQ_ALGO_NAMES.length - 1, Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 2))));
    const curTimeIdx = Math.max(0, Math.min(TIME_ALGO_NAMES.length - 1, Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 4))));

    const freqPillsHtml = FREQ_ALGO_NAMES.map((name, idx) => {
      const isCur = idx === curFreqIdx;
      return `<button type="button" class="btn btn-xs ${isCur ? 'btn-primary active' : 'btn-outline'}" data-freq-idx="${idx}" title="Select Frequency FX: ${name}">${name}</button>`;
    }).join('');

    const timePillsHtml = TIME_ALGO_NAMES.map((name, idx) => {
      const isCur = idx === curTimeIdx;
      return `<button type="button" class="btn btn-xs ${isCur ? 'btn-primary active' : 'btn-outline'}" data-time-idx="${idx}" title="Select Time FX: ${name}">${name}</button>`;
    }).join('');

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'synth-panel-card silver-hardware-panel';
    this.rootEl.innerHTML = `
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08)); gap: 6px;">
        <div style="display: flex; align-items: center; gap: var(--space-2); min-width: 0;">
          <span class="stick-label">SILVER</span>
          <button type="button" class="btn btn-xs btn-primary active" id="btn-toggle-silver" title="Silver Filter & FX On / Off [271]">ON</button>
        </div>
        <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="btn btn-xs btn-outline" id="btn-edit-silver" title="Silver & Multi-FX Rack (Ctrl+F)">Edit</button>
          <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-top" title="Colapsar / Descolapsar fila">▾</button>
        </div>
      </div>

      <div class="panel-body silver-body" data-collapse-body>
        <!-- Columna Izquierda: Algoritmos FREQ FX -->
        <aside class="silver-fx-column silver-freq-col">
          <span class="silver-fx-col-title">FREQ FX</span>
          <div class="silver-pills-stack" id="silver-freq-pills">
            ${freqPillsHtml}
          </div>
        </aside>

        <!-- Centro: Sub-caja TrajectoryStick2D Vectorial -->
        <div id="silver-stick-mount"></div>

        <!-- Columna Derecha: Algoritmos TIME FX -->
        <aside class="silver-fx-column silver-time-col">
          <span class="silver-fx-col-title">TIME FX</span>
          <div class="silver-pills-stack" id="silver-time-pills">
            ${timePillsHtml}
          </div>
        </aside>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    // Inicializar Stick 2D de Silver
    this.initSilverStick();

    // Eventos del Header
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

    // Eventos de selección de pills en columnas laterales
    this.rootEl.querySelectorAll('#silver-freq-pills button[data-freq-idx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const idx = parseInt(target.getAttribute('data-freq-idx') || '0', 10);
        this.selectFreqAlgo(idx);
      });
    });

    this.rootEl.querySelectorAll('#silver-time-pills button[data-time-idx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const idx = parseInt(target.getAttribute('data-time-idx') || '0', 10);
        this.selectTimeAlgo(idx);
      });
    });
  }

  private initSilverStick(): void {
    const mount = this.rootEl?.querySelector('#silver-stick-mount');
    if (!mount) return;

    this.silverStick = new TrajectoryStick2D(mount as HTMLElement, {
      label: 'VECTOR 2D',
      numLayers: 3,
      layerNames: ['FILT', 'FREQ', 'TIME'],
      initialLayer: (this.currentSilverLevel as 0 | 1 | 2),
      showHeader: true,
      showLayers: true,
      readout: true,
      hasRecorder: true,
      springReturn: false,
      labelsPerLayer: [
        { north: '▲ RESO +', south: '▼ RESO -', west: '◀ CUT -', east: 'CUT + ▶' },
        this.getFreqStickLabels(),
        this.getTimeStickLabels(),
      ],
      onLayerChange: (layerIdx) => {
        this.setSilverLevel(layerIdx);
      },
      onPositionChange: (layerIdx, coord) => {
        this.dispatchSilverStick(coord, layerIdx);
      },
    });

    this.updateSilver();
  }

  private getFreqStickLabels(): StickLabels {
    const curFreqFx = Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 0));
    if (curFreqFx === 2) {
      // RingMod: ModFreq X, Mix Y
      return { north: '▲ MIX +', south: '▼ MIX -', west: '◀ FREQ -', east: 'FREQ + ▶' };
    } else if (curFreqFx === 1) {
      // Distortion: InGain X, PreFilter Y
      return { north: '▲ PRE +', south: '▼ PRE -', west: '◀ DRV -', east: 'DRV + ▶' };
    } else if (curFreqFx === 3) {
      // Decimator: SHFactor X, Mix Y
      return { north: '▲ MIX +', south: '▼ MIX -', west: '◀ S&H -', east: 'S&H + ▶' };
    }
    return { north: '▲ PAR 2 +', south: '▼ PAR 2 -', west: '◀ PAR 1 -', east: 'PAR 1 + ▶' };
  }

  private getTimeStickLabels(): StickLabels {
    const curTimeFx = Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 0));
    if (curTimeFx === 1) {
      // LR Delay: Mix X, Feedback Y
      return { north: '▲ FDBK +', south: '▼ FDBK -', west: '◀ TIME -', east: 'TIME + ▶' };
    } else if (curTimeFx === 4) {
      // Chorus: Mix X, Depth Y
      return { north: '▲ DEP +', south: '▼ DEP -', west: '◀ MIX -', east: 'MIX + ▶' };
    }
    return { north: '▲ PAR 2 +', south: '▼ PAR 2 -', west: '◀ PAR 1 -', east: 'PAR 1 + ▶' };
  }

  private updateStickLabelsForCurrentLevel(): void {
    if (!this.silverStick) return;
    if (this.currentSilverLevel === 0) {
      this.silverStick.setLabels({
        north: '▲ RESO +',
        south: '▼ RESO -',
        west: '◀ CUT -',
        east: 'CUT + ▶',
      });
    } else if (this.currentSilverLevel === 1) {
      this.silverStick.setLabels(this.getFreqStickLabels());
    } else if (this.currentSilverLevel === 2) {
      this.silverStick.setLabels(this.getTimeStickLabels());
    }
  }

  public selectFreqAlgo(idx: number): void {
    const safeIdx = Math.max(0, Math.min(FREQ_ALGO_NAMES.length - 1, idx));
    WebBridge.setParam(ParamIdx.SilverSwitch, 1);
    WebBridge.setParam(ParamIdx.FreqFXSwitch, 1);
    WebBridge.setParam(ParamIdx.CurFreqFX, safeIdx);
    this.updateSilverToggle(true);
    this.updateFreqAlgoUi(safeIdx);
    if (this.silverStick) {
      this.silverStick.setLayerLabels(1, this.getFreqStickLabels());
      if (this.currentSilverLevel === 1) {
        this.silverStick.setLabels(this.getFreqStickLabels());
      }
    }
    this.updateSilver();
  }

  public selectTimeAlgo(idx: number): void {
    const safeIdx = Math.max(0, Math.min(TIME_ALGO_NAMES.length - 1, idx));
    WebBridge.setParam(ParamIdx.SilverSwitch, 1);
    WebBridge.setParam(ParamIdx.TimeFXSwitch, 1);
    WebBridge.setParam(ParamIdx.CurTimeFX, safeIdx);
    this.updateSilverToggle(true);
    this.updateTimeAlgoUi(safeIdx);
    if (this.silverStick) {
      this.silverStick.setLayerLabels(2, this.getTimeStickLabels());
      if (this.currentSilverLevel === 2) {
        this.silverStick.setLabels(this.getTimeStickLabels());
      }
    }
    this.updateSilver();
  }

  public updateFreqAlgoUi(idx: number): void {
    this.rootEl?.querySelectorAll('#silver-freq-pills button').forEach((btn) => {
      const btnIdx = parseInt(btn.getAttribute('data-freq-idx') || '-1', 10);
      const isCur = btnIdx === idx;
      btn.classList.toggle('active', isCur);
      btn.classList.toggle('btn-primary', isCur);
      btn.classList.toggle('btn-outline', !isCur);
    });
  }

  public updateTimeAlgoUi(idx: number): void {
    this.rootEl?.querySelectorAll('#silver-time-pills button').forEach((btn) => {
      const btnIdx = parseInt(btn.getAttribute('data-time-idx') || '-1', 10);
      const isCur = btnIdx === idx;
      btn.classList.toggle('active', isCur);
      btn.classList.toggle('btn-primary', isCur);
      btn.classList.toggle('btn-outline', !isCur);
    });
  }

  public updateFreqAlgo(name: string): void {
    const idx = FREQ_ALGO_NAMES.indexOf(name);
    if (idx !== -1) {
      this.updateFreqAlgoUi(idx);
    }
  }

  public updateTimeAlgo(name: string): void {
    const idx = TIME_ALGO_NAMES.indexOf(name);
    if (idx !== -1) {
      this.updateTimeAlgoUi(idx);
    }
  }

  private dispatchSilverStick(coord: StickCoordinate, layerIdx: number): void {
    if (layerIdx === 0) {
      // Filter Cutoff [274] & Resonance [275]
      const cut = Math.round(coord.x * 127.0);
      const res = Math.round(coord.y * 127.0);
      WebBridge.setParam(ParamIdx.FilterFreq, cut);
      WebBridge.setParam(ParamIdx.FilterReso, res);
      this.silverStick?.setReadout(`CUT: ${cut} | RES: ${(res / 127.0).toFixed(2)}`);
    } else if (layerIdx === 1) {
      // Frequency FX mode
      const curFreqFx = Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 0));
      if (curFreqFx === 2) {
        // RingMod: RM_ModFreq [314], RM_Mix [310]
        const modFreq = Math.round(coord.x * 127.0);
        const mix = Math.round(coord.y * 127.0);
        WebBridge.setParam(314, modFreq);
        WebBridge.setParam(310, mix);
        this.silverStick?.setReadout(`FREQ: ${modFreq} | MIX: ${mix}`);
      } else if (curFreqFx === 1) {
        // Distortion: DS_InGain [306], DS_PreFilter [307]
        const inGain = Math.round(coord.x * 127.0);
        const preCut = Math.round(coord.y * 127.0);
        WebBridge.setParam(306, inGain);
        WebBridge.setParam(307, preCut);
        this.silverStick?.setReadout(`DRV: ${inGain} | PRE: ${preCut}`);
      } else if (curFreqFx === 3) {
        // Decimator: DC_SHFactor [325], DC_Mix [324]
        const sh = Math.round(coord.x * 127.0);
        const mix = Math.round(coord.y * 127.0);
        WebBridge.setParam(325, sh);
        WebBridge.setParam(324, mix);
        this.silverStick?.setReadout(`S&H: ${sh} | MIX: ${mix}`);
      } else {
        const valX = Math.round(coord.x * 127.0);
        const valY = Math.round(coord.y * 127.0);
        this.silverStick?.setReadout(`X: ${valX} | Y: ${valY}`);
      }
    } else if (layerIdx === 2) {
      // Time FX mode
      const curTimeFx = Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 0));
      if (curTimeFx === 1) {
        // LR Delay: DL_Mix [333], DL_Feedback [336]
        const mix = Math.round(coord.x * 127.0);
        const fb = Math.round(coord.y * 127.0);
        WebBridge.setParam(333, mix);
        WebBridge.setParam(336, fb);
        this.silverStick?.setReadout(`TIME: ${mix} | FDBK: ${fb}`);
      } else if (curTimeFx === 4) {
        // Chorus: CH_Mix [352], CH_Depth [353]
        const mix = Math.round(coord.x * 127.0);
        const depth = Math.round(coord.y * 127.0);
        WebBridge.setParam(352, mix);
        WebBridge.setParam(353, depth);
        this.silverStick?.setReadout(`MIX: ${mix} | DEP: ${depth}`);
      } else {
        const valX = Math.round(coord.x * 127.0);
        const valY = Math.round(coord.y * 127.0);
        this.silverStick?.setReadout(`X: ${valX} | Y: ${valY}`);
      }
    }
  }

  public setSilverLevel(level: number): void {
    if (this.currentSilverLevel === level && this.silverStick?.activeLayer === level) {
      return;
    }
    this.currentSilverLevel = level;
    if (this.silverStick && this.silverStick.activeLayer !== level) {
      this.silverStick.selectLayer(level);
    }
    this.updateStickLabelsForCurrentLevel();
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

  public updateSilver(_paramId?: number): void {
    const isSilverOn = Math.round(WebBridge.getParam(ParamIdx.SilverSwitch, 1)) === 1;
    this.updateSilverToggle(isSilverOn);

    const curFreqIdx = Math.max(0, Math.min(FREQ_ALGO_NAMES.length - 1, Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 2))));
    const curTimeIdx = Math.max(0, Math.min(TIME_ALGO_NAMES.length - 1, Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 4))));
    this.updateFreqAlgoUi(curFreqIdx);
    this.updateTimeAlgoUi(curTimeIdx);

    if (this.currentSilverLevel === 0) {
      const cut = Math.round(WebBridge.getParam(ParamIdx.FilterFreq, 100));
      const res = Math.round(WebBridge.getParam(ParamIdx.FilterReso, 25));
      this.silverStick?.setReadout(`CUT: ${cut} | RES: ${(res / 127.0).toFixed(2)}`);
      if (this.silverStick && !this.silverStick.isRecording) {
        this.silverStick.setPosition(0, cut / 127.0, res / 127.0, false);
      }
    } else if (this.currentSilverLevel === 1) {
      let lblX = 'PAR1';
      let lblY = 'PAR2';
      let valX = 64;
      let valY = 64;

      if (curFreqIdx === 2) {
        lblX = 'FREQ';
        lblY = 'MIX';
        valX = Math.round(WebBridge.getParam(314, 64));
        valY = Math.round(WebBridge.getParam(310, 64));
      } else if (curFreqIdx === 1) {
        lblX = 'DRV';
        lblY = 'PRE';
        valX = Math.round(WebBridge.getParam(306, 64));
        valY = Math.round(WebBridge.getParam(307, 64));
      } else if (curFreqIdx === 3) {
        lblX = 'S&H';
        lblY = 'MIX';
        valX = Math.round(WebBridge.getParam(325, 16));
        valY = Math.round(WebBridge.getParam(324, 64));
      }

      this.silverStick?.setReadout(`${lblX}: ${valX} | ${lblY}: ${valY}`);
      if (this.silverStick && !this.silverStick.isRecording) {
        this.silverStick.setPosition(1, valX / 127.0, valY / 127.0, false);
      }
    } else if (this.currentSilverLevel === 2) {
      let lblX = 'PAR1';
      let lblY = 'PAR2';
      let valX = 64;
      let valY = 64;

      if (curTimeIdx === 1) {
        lblX = 'TIME';
        lblY = 'FDBK';
        valX = Math.round(WebBridge.getParam(333, 50));
        valY = Math.round(WebBridge.getParam(336, 40));
      } else if (curTimeIdx === 4) {
        lblX = 'MIX';
        lblY = 'DEP';
        valX = Math.round(WebBridge.getParam(352, 64));
        valY = Math.round(WebBridge.getParam(353, 64));
      }

      this.silverStick?.setReadout(`${lblX}: ${valX} | ${lblY}: ${valY}`);
      if (this.silverStick && !this.silverStick.isRecording) {
        this.silverStick.setPosition(2, valX / 127.0, valY / 127.0, false);
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
