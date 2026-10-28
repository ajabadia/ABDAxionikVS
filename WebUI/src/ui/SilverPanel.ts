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
import { Knob } from '@abdsynths/shared/components';

export interface SilverPanelOptions {
  onEditSilver?: () => void;
  onEditSlicer?: () => void;
}

export const FREQ_ALGO_NAMES = ['EQ/Comp', 'Distortion', 'RingMod', 'Decimator', 'Sp-Warp'];
export const TIME_ALGO_NAMES = ['St.Spread', 'L/R Delay', 'Flanger', 'Phaser', 'Chorus'];

export class SilverPanel {
  private container: HTMLElement;
  private options: SilverPanelOptions;
  private rootEl: HTMLElement | null = null;
  private silverStick: TrajectoryStick2D | null = null;
  private currentSilverLevel: number = 0; // 0: Filter, 1: Freq FX, 2: Time FX

  // Slicer Hardware controls
  private depthKnob: Knob | null = null;
  private rateKnob: Knob | null = null;
  private curSlicerMode: number = 0; // 0: Off, 1: 1D, 2: 3D

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
        <!-- Columna 1: Algoritmos FREQ FX -->
        <aside class="silver-fx-column silver-freq-col">
          <span class="silver-fx-col-title">FREQ FX</span>
          <div class="silver-pills-stack" id="silver-freq-pills">
            ${freqPillsHtml}
          </div>
        </aside>

        <!-- Columna 2: Sub-caja TrajectoryStick2D Vectorial -->
        <div id="silver-stick-mount"></div>

        <!-- Columna 3: Algoritmos TIME FX -->
        <aside class="silver-fx-column silver-time-col">
          <span class="silver-fx-col-title">TIME FX</span>
          <div class="silver-pills-stack" id="silver-time-pills">
            ${timePillsHtml}
          </div>
        </aside>

        <!-- Columna 4: Hardware Slicer (LFO 1D/3D) -->
        <aside class="silver-fx-column slicer-hardware-col" id="slicer-col">
          <div class="slicer-header-line" id="slicer-header-edit" title="Open Slicer & Blender Settings">
            <span class="slicer-status-dot" id="slicer-dot"></span>
            <span class="silver-fx-col-title" style="border: none; padding: 0;">SLICER</span>
          </div>

          <!-- Selector de Modo con LEDs apilados 1D / 3D -->
          <div class="slicer-mode-section">
            <div class="slicer-leds-stack">
              <div class="slicer-led" id="slicer-led-1d" title="1D Vertical Oscillation">
                <span class="slicer-led-pip"></span>
                <span class="slicer-led-label">1D</span>
              </div>
              <div class="slicer-led" id="slicer-led-3d" title="3D Spatial Modulation">
                <span class="slicer-led-pip"></span>
                <span class="slicer-led-label">3D</span>
              </div>
            </div>
            <button type="button" class="btn btn-xs btn-outline slicer-mode-btn" id="btn-slicer-mode" title="Toggle Slicer Mode: Off -> 1D -> 3D">MODE</button>
          </div>

          <!-- Knob 1: Depth / Spread -->
          <div class="slicer-knob-wrapper">
            <div id="slicer-depth-mount" style="display: flex; justify-content: center;"></div>
            <span class="slicer-knob-sublabel" id="slicer-depth-sublabel">0</span>
          </div>

          <!-- Knob 2: Rate -->
          <div class="slicer-knob-wrapper">
            <div id="slicer-rate-mount" style="display: flex; justify-content: center;"></div>
            <span class="slicer-knob-sublabel" id="slicer-rate-sublabel">6.6 Hz</span>
          </div>
        </aside>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    // Inicializar Stick 2D de Silver y Slicer
    this.initSilverStick();
    this.initSlicer();

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

  private dispatchSilverStick(coord: StickCoordinate, layerIdx: number): void {
    if (layerIdx === 0) {
      // Filter Cutoff [274] & Resonance [275]
      const cut = Math.round(coord.x * 127.0);
      const res = Math.round(coord.y * 127.0);
      WebBridge.setParam(ParamIdx.FilterFreq, cut);
      WebBridge.setParam(ParamIdx.FilterReso, res);
    } else if (layerIdx === 1) {
      // Frequency FX mode
      const curFreqFx = Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 0));
      if (curFreqFx === 2) {
        // RingMod: RM_ModFreq [314], RM_Mix [310]
        const modFreq = Math.round(coord.x * 127.0);
        const mix = Math.round(coord.y * 127.0);
        WebBridge.setParam(314, modFreq);
        WebBridge.setParam(310, mix);
      } else if (curFreqFx === 1) {
        // Distortion: DS_InGain [306], DS_PreFilter [307]
        const inGain = Math.round(coord.x * 127.0);
        const preCut = Math.round(coord.y * 127.0);
        WebBridge.setParam(306, inGain);
        WebBridge.setParam(307, preCut);
      } else if (curFreqFx === 3) {
        // Decimator: DC_SHFactor [325], DC_Mix [324]
        const sh = Math.round(coord.x * 127.0);
        const mix = Math.round(coord.y * 127.0);
        WebBridge.setParam(325, sh);
        WebBridge.setParam(324, mix);
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
      } else if (curTimeFx === 4) {
        // Chorus: CH_Mix [352], CH_Depth [353]
        const mix = Math.round(coord.x * 127.0);
        const depth = Math.round(coord.y * 127.0);
        WebBridge.setParam(352, mix);
        WebBridge.setParam(353, depth);
      }
    }

    // Formato canónico uniforme con Scape y Sphere: X: 0.xx | Y: 0.yy
    this.silverStick?.setReadout(`X: ${coord.x.toFixed(2)} | Y: ${coord.y.toFixed(2)}`);
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
      const normX = cut / 127.0;
      const normY = res / 127.0;
      this.silverStick?.setReadout(`X: ${normX.toFixed(2)} | Y: ${normY.toFixed(2)}`);
      if (this.silverStick && !this.silverStick.isRecording) {
        this.silverStick.setPosition(0, normX, normY, false);
      }
    } else if (this.currentSilverLevel === 1) {
      let valX = 64;
      let valY = 64;

      if (curFreqIdx === 2) {
        valX = Math.round(WebBridge.getParam(314, 64));
        valY = Math.round(WebBridge.getParam(310, 64));
      } else if (curFreqIdx === 1) {
        valX = Math.round(WebBridge.getParam(306, 64));
        valY = Math.round(WebBridge.getParam(307, 64));
      } else if (curFreqIdx === 3) {
        valX = Math.round(WebBridge.getParam(325, 16));
        valY = Math.round(WebBridge.getParam(324, 64));
      }

      const normX = valX / 127.0;
      const normY = valY / 127.0;
      this.silverStick?.setReadout(`X: ${normX.toFixed(2)} | Y: ${normY.toFixed(2)}`);
      if (this.silverStick && !this.silverStick.isRecording) {
        this.silverStick.setPosition(1, normX, normY, false);
      }
    } else if (this.currentSilverLevel === 2) {
      let valX = 64;
      let valY = 64;

      if (curTimeIdx === 1) {
        valX = Math.round(WebBridge.getParam(333, 50));
        valY = Math.round(WebBridge.getParam(336, 40));
      } else if (curTimeIdx === 4) {
        valX = Math.round(WebBridge.getParam(352, 64));
        valY = Math.round(WebBridge.getParam(353, 64));
      }

      const normX = valX / 127.0;
      const normY = valY / 127.0;
      this.silverStick?.setReadout(`X: ${normX.toFixed(2)} | Y: ${normY.toFixed(2)}`);
      if (this.silverStick && !this.silverStick.isRecording) {
        this.silverStick.setPosition(2, normX, normY, false);
      }
    }
  }

  private initSlicer(): void {
    const modeBtn = this.rootEl?.querySelector('#btn-slicer-mode');
    modeBtn?.addEventListener('click', () => {
      const nextMode = (this.curSlicerMode + 1) % 3;
      WebBridge.setParam(ParamIdx.SlicerSwitchType, nextMode);
      this.updateSlicerModeUi(nextMode);
    });

    const headerEdit = this.rootEl?.querySelector('#slicer-header-edit');
    headerEdit?.addEventListener('click', () => {
      this.options.onEditSlicer?.();
    });

    // Depth knob
    const depthMount = this.rootEl?.querySelector('#slicer-depth-mount') as HTMLElement | null;
    const depthSub = this.rootEl?.querySelector('#slicer-depth-sublabel');
    const initDepth = Math.round(WebBridge.getParam(ParamIdx.SlicerDepth, 0));
    if (depthMount) {
      this.depthKnob = new Knob(depthMount, {
        size: 34,
        value: initDepth / 127.0,
        label: this.curSlicerMode === 2 ? 'SPREAD' : 'DEPTH',
        onChange: (normVal: number) => {
          const val = Math.round(normVal * 127.0);
          WebBridge.setParam(ParamIdx.SlicerDepth, val);
          if (depthSub) depthSub.textContent = String(val);
        },
      });
      if (depthSub) depthSub.textContent = String(initDepth);
    }

    // Rate knob
    const rateMount = this.rootEl?.querySelector('#slicer-rate-mount') as HTMLElement | null;
    const rateSub = this.rootEl?.querySelector('#slicer-rate-sublabel');
    const initRate = Math.round(WebBridge.getParam(ParamIdx.SlicerRate, 66));
    if (rateMount) {
      this.rateKnob = new Knob(rateMount, {
        size: 34,
        value: initRate / 200.0,
        label: 'RATE',
        onChange: (normVal: number) => {
          const val = Math.round(normVal * 200.0);
          WebBridge.setParam(ParamIdx.SlicerRate, val);
          if (rateSub) rateSub.textContent = `${(val / 10).toFixed(1)} Hz`;
        },
      });
      if (rateSub) rateSub.textContent = `${(initRate / 10).toFixed(1)} Hz`;
    }

    // Sincronizar estado inicial
    const initMode = Math.round(WebBridge.getParam(ParamIdx.SlicerSwitchType, 0));
    this.updateSlicerModeUi(initMode);
  }

  public updateSlicerModeUi(mode: number): void {
    this.curSlicerMode = Math.max(0, Math.min(2, mode));
    const dot = this.rootEl?.querySelector('#slicer-dot');
    const led1d = this.rootEl?.querySelector('#slicer-led-1d');
    const led3d = this.rootEl?.querySelector('#slicer-led-3d');
    const modeBtn = this.rootEl?.querySelector('#btn-slicer-mode');

    if (dot) dot.classList.toggle('active', this.curSlicerMode > 0);
    if (led1d) led1d.classList.toggle('active-1d', this.curSlicerMode === 1);
    if (led3d) led3d.classList.toggle('active-3d', this.curSlicerMode === 2);

    if (modeBtn) {
      modeBtn.textContent = this.curSlicerMode === 0 ? 'OFF' : (this.curSlicerMode === 1 ? '1D' : '3D');
      modeBtn.classList.toggle('btn-primary', this.curSlicerMode > 0);
      modeBtn.classList.toggle('active', this.curSlicerMode > 0);
      modeBtn.classList.toggle('btn-outline', this.curSlicerMode === 0);
    }
  }

  public updateParam(idx: number, val: number): void {
    if (idx === ParamIdx.SlicerSwitchType) {
      this.updateSlicerModeUi(Math.round(val));
      return;
    }
    if (idx === ParamIdx.SlicerDepth) {
      this.depthKnob?.setValue(val / 127.0, false);
      const sub = this.rootEl?.querySelector('#slicer-depth-sublabel');
      if (sub) sub.textContent = String(Math.round(val));
      return;
    }
    if (idx === ParamIdx.SlicerRate) {
      this.rateKnob?.setValue(val / 200.0, false);
      const sub = this.rootEl?.querySelector('#slicer-rate-sublabel');
      if (sub) sub.textContent = `${(val / 10).toFixed(1)} Hz`;
      return;
    }
    if (idx === ParamIdx.SilverSwitch) {
      this.updateSilverToggle(val > 0.5);
      return;
    }
    if (idx === ParamIdx.CurFreqFX) {
      this.updateFreqAlgoUi(Math.round(val));
      return;
    }
    if (idx === ParamIdx.CurTimeFX) {
      this.updateTimeAlgoUi(Math.round(val));
      return;
    }
  }

  public destroy(): void {
    this.silverStick?.destroy();
    this.depthKnob?.destroy();
    this.rateKnob?.destroy();
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.rootEl = null;
  }
}
