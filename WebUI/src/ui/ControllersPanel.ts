/**
 * ABDAxionikVS — ControllersPanel.ts
 * Réplica fiel del bloque físico frontal «Controllers» del teclado hardware Hartmann Neuron.
 * 
 * Componentes canónicos reutilizados de ABDShared (filosofía DRY):
 * 1. Control 1 Performance Stick (Izquierda):
 *    - TrajectoryStick2D de @abdsynths/shared/components/trajectoryStick2D.js (1 capa, spring-return).
 *    - Eje X: Pitch Bend bipolar con retorno por muelle al centro ([-48, +48] semitonos).
 *    - Eje Y: Control 1 (Modulation Wheel CC 1 / ModulationDepth [416]).
 *    - Marcado físico: "Pitch ◀ ▶" y "▲ Control 1 ▼".
 *    - Badge de destino dinámico: Muestra en vivo la asignación activa (ej. ▲ Cutoff).
 * 2. Control 2 (Centro):
 *    - Rueda de modulación física (Wheel de @abdsynths/shared/components, 18x76px).
 *    - Indicador vertical de LEDs discretos (LedLadder de @abdsynths/shared/components, 76px de altura).
 *    - Badge de destino dinámico: Muestra en vivo la asignación activa (ej. Blender Amount).
 * 3. Control 3 (Derecha):
 *    - Rueda de modulación física y tira de LEDs exactamente idénticas a Control 2 (DRY).
 *    - Badge de destino dinámico para Control 3 (ej. Slicer Depth).
 * 
 * Capa de abstracción:
 * Toda la comunicación viaja a través de WebBridge desacoplada del DSP.
 */

import { TrajectoryStick2D } from './TrajectoryStick2D.js';
import { Wheel } from '@abdsynths/shared/components/wheel.js';
import { LedLadder } from '@abdsynths/shared/components/ledLadder.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { getModDestinationLabel } from './MatrixDrawer.js';

export interface ControllersPanelOptions {
  onEdit?: () => void;
}

export class ControllersPanel {
  private container: HTMLElement;
  private options: ControllersPanelOptions;
  private rootEl: HTMLElement | null = null;
  private stick: TrajectoryStick2D | null = null;
  private control2Wheel: Wheel | null = null;
  private control2LedLadder: LedLadder | null = null;
  private control3Wheel: Wheel | null = null;
  private control3LedLadder: LedLadder | null = null;
  private aftertouchLedLadder: LedLadder | null = null;
  private pedalLedLadder: LedLadder | null = null;

  constructor(container: HTMLElement, options: ControllersPanelOptions = {}) {
    this.container = container;
    this.options = options;
    this.render();
  }

  private render(): void {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'synth-panel-card controllers-hardware-panel';
    this.rootEl.innerHTML = `
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
        <span class="stick-label">CONTROLLERS</span>
        <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="btn btn-xs btn-outline" id="btn-edit-controllers" title="Edit Controllers Assignment & Modulation Matrix (Ctrl+M)">Edit</button>
          <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-bottom" title="Colapsar / Descolapsar fila">▾</button>
        </div>
      </div>

      <div class="panel-body controllers-body" data-collapse-body style="flex: 1; display: flex; flex-direction: column;">
        <div class="controllers-grid" style="display: flex; align-items: center; justify-content: space-around; gap: 8px; padding: 4px; flex: 1;">
          
          <!-- 1. Control 1 Performance Stick (Pitch X / Mod Y) -->
          <div class="controller-stick-section" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
            <div id="ctrl1-stick-mount" style="display: flex; align-items: center; justify-content: center;"></div>
            <div class="hud-pill ctrl-dest-tag" id="ctrl1-dest-label" style="font-size: 8.5px; padding: 2px 6px; text-align: center; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-accent); font-weight: 600; border-radius: 3px;" title="Control 1 Assignment">▲ Cutoff</div>
          </div>

          <!-- 2. Control 2 (Wheel + LedLadder a su derecha) -->
          <div class="controller-wheel-section" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
            <div class="shaper-wheel-bezel" style="display: flex; flex-direction: row; align-items: center; gap: 6px;">
              <div id="ctrl2-wheel-mount"></div>
              <div id="ctrl2-led-ladder-mount" style="display: flex; align-items: center;"></div>
            </div>
            <div class="hud-pill ctrl-dest-tag" id="ctrl2-dest-label" style="font-size: 8.5px; padding: 2px 6px; text-align: center; max-width: 82px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-accent); font-weight: 600; border-radius: 3px;" title="Control 2 Assignment">LFO Depth</div>
          </div>

          <!-- 3. Control 3 (Wheel + LedLadder exactamente idéntico a Control 2) -->
          <div class="controller-wheel-section" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
            <div class="shaper-wheel-bezel" style="display: flex; flex-direction: row; align-items: center; gap: 6px;">
              <div id="ctrl3-wheel-mount"></div>
              <div id="ctrl3-led-ladder-mount" style="display: flex; align-items: center;"></div>
            </div>
            <div class="hud-pill ctrl-dest-tag" id="ctrl3-dest-label" style="font-size: 8.5px; padding: 2px 6px; text-align: center; max-width: 82px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-accent); font-weight: 600; border-radius: 3px;" title="Control 3 Assignment">Control 3</div>
          </div>

          <!-- 4. Aftertouch (Tira de LEDs indicadora independiente LedLadder de ABDShared) -->
          <div class="controller-wheel-section" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
            <div class="shaper-wheel-bezel" id="at-led-bezel" style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; user-select: none;" title="Aftertouch Level Indicator (Channel Pressure)">
              <div class="abd-wheel-label">AT</div>
              <div id="at-led-ladder-mount" style="display: flex; align-items: center;"></div>
            </div>
            <div class="hud-pill ctrl-dest-tag" id="at-dest-label" style="font-size: 8.5px; padding: 2px 6px; text-align: center; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-accent); font-weight: 600; border-radius: 3px;" title="Aftertouch Assignment">Filter Cutoff</div>
          </div>

          <!-- 5. Pedal / Foot CC 04 (Tira de LEDs independiente LedLadder de ABDShared) -->
          <div class="controller-wheel-section" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
            <div class="shaper-wheel-bezel" id="pedal-led-bezel" style="display: flex; flex-direction: column; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;" title="Pedal Level (Foot CC 04 / Sustain) — Click & drag vertically to test">
              <div class="abd-wheel-label">PEDAL</div>
              <div id="pedal-led-ladder-mount" style="display: flex; align-items: center;"></div>
            </div>
            <div class="hud-pill ctrl-dest-tag" id="pedal-dest-label" style="font-size: 8.5px; padding: 2px 6px; text-align: center; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-accent); font-weight: 600; border-radius: 3px;" title="Pedal / Foot Assignment">R2 Volume</div>
          </div>

        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    // Inicializar subcomponentes
    this.initPerformanceStick();
    this.initControl2Wheel();
    this.initControl2LedLadder();
    this.initControl3Wheel();
    this.initControl3LedLadder();
    this.initAftertouchLedLadder();
    this.initPedalLedLadder();

    // Evento Edit Matrix
    this.rootEl.querySelector('#btn-edit-controllers')?.addEventListener('click', () => {
      this.options.onEdit?.();
    });

    this.updateLabels();
  }

  private initPerformanceStick(): void {
    const mount = this.rootEl?.querySelector('#ctrl1-stick-mount');
    if (!mount) return;

    this.stick = new TrajectoryStick2D(mount as HTMLElement, {
      label: 'CONTROL 1',
      resynator: 1,
      domain: 'scape',
      showHeader: false,
      showLayers: false,
      readout: false,
      hasRecorder: false,
      springReturn: true,
      restX: 0.5,
      restY: 0.5,
      size: 110,
      className: 'borderless',
      labels: {
        north: '▲ Control 1',
        south: '▼',
        west: '◀ Pitch',
        east: 'Pitch ▶',
      },
      onPositionChange: (_layerIdx, coord) => {
        // Eje X: Pitch Bend (0..1 donde 0.5 es centro) -> -8192..+8191
        const pbNormalized = (coord.x - 0.5) * 2.0;
        const pbRaw = Math.round(pbNormalized * 8192);
        WebBridge.pitchBend(pbRaw);

        // Eje Y: Control 1 (Modulation Wheel CC 1 / ModulationDepth [416])
        const modWheelRaw = Math.round(coord.y * 127);
        WebBridge.modWheel(modWheelRaw);
      },
    });
  }

  private initControl2LedLadder(): void {
    const mount = this.rootEl?.querySelector('#ctrl2-led-ladder-mount');
    if (!mount) return;

    this.control2LedLadder = new LedLadder(mount as HTMLElement, {
      segments: 10,
      mode: 'bar',
      bipolar: false,
      showArrows: true,
      width: 14,
      segmentHeight: 4,
      ariaLabel: 'Control 2 LED Level',
    });
    this.control2LedLadder.setValue(0.0);
  }

  private initControl2Wheel(): void {
    const mount = this.rootEl?.querySelector('#ctrl2-wheel-mount');
    if (!mount) return;

    this.control2Wheel = new Wheel(mount as HTMLElement, {
      type: 'mod',
      label: 'Control 2',
      min: 0,
      max: 127,
      frameWidth: 18,
      frameHeight: 76,
      onChange: (rawVal: number) => {
        const normalized = Math.max(0, Math.min(1, rawVal / 127.0));
        this.control2LedLadder?.setValue(normalized);
        WebBridge.sendMidiCC(2, rawVal);
      },
    });
  }

  private initControl3LedLadder(): void {
    const mount = this.rootEl?.querySelector('#ctrl3-led-ladder-mount');
    if (!mount) return;

    this.control3LedLadder = new LedLadder(mount as HTMLElement, {
      segments: 10,
      mode: 'bar',
      bipolar: false,
      showArrows: true,
      width: 14,
      segmentHeight: 4,
      ariaLabel: 'Control 3 LED Level',
    });
    this.control3LedLadder.setValue(0.0);
  }

  private initControl3Wheel(): void {
    const mount = this.rootEl?.querySelector('#ctrl3-wheel-mount');
    if (!mount) return;

    this.control3Wheel = new Wheel(mount as HTMLElement, {
      type: 'mod',
      label: 'Control 3',
      min: 0,
      max: 127,
      frameWidth: 18,
      frameHeight: 76,
      onChange: (rawVal: number) => {
        const normalized = Math.max(0, Math.min(1, rawVal / 127.0));
        this.control3LedLadder?.setValue(normalized);
        WebBridge.sendMidiCC(3, rawVal);
      },
    });
  }

  private initAftertouchLedLadder(): void {
    const mount = this.rootEl?.querySelector('#at-led-ladder-mount');
    if (!mount) return;

    this.aftertouchLedLadder = new LedLadder(mount as HTMLElement, {
      segments: 10,
      mode: 'bar',
      bipolar: false,
      showArrows: true,
      width: 14,
      segmentHeight: 4,
      ariaLabel: 'Aftertouch LED Level',
    });
    this.aftertouchLedLadder.setValue(0.0);
  }

  private initPedalLedLadder(): void {
    const mount = this.rootEl?.querySelector('#pedal-led-ladder-mount');
    const bezel = this.rootEl?.querySelector('#pedal-led-bezel') as HTMLElement | null;
    if (!mount) return;

    this.pedalLedLadder = new LedLadder(mount as HTMLElement, {
      segments: 10,
      mode: 'bar',
      bipolar: false,
      showArrows: true,
      width: 14,
      segmentHeight: 4,
      ariaLabel: 'Pedal LED Level',
    });
    this.pedalLedLadder.setValue(0.0);

    if (bezel) {
      this.bindVerticalLadderDrag(bezel, (norm) => {
        this.pedalLedLadder?.setValue(norm);
        WebBridge.sendMidiCC(4, Math.round(norm * 127));
      });
    }
  }

  private bindVerticalLadderDrag(bezel: HTMLElement, onChange: (normVal: number) => void): void {
    const applyFromClientY = (clientY: number) => {
      const rect = bezel.getBoundingClientRect();
      if (rect.height <= 0) return;
      const norm = Math.max(0, Math.min(1, 1.0 - (clientY - rect.top) / rect.height));
      onChange(norm);
    };

    bezel.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      // No aferrar el foco del DOM al iniciar el arrastre: el teclado QWERTY
      // sigue llegando a window (listener de atajos y teclado de melodía) mientras
      // el control se mueve con el ratón.
      // (La captura de puntero ya mantiene el flujo de eventos pointer sin que el
      // elemento siga siendo el activo del documento.)
      bezel.setPointerCapture(e.pointerId);
      applyFromClientY(e.clientY);

      const onMove = (ev: PointerEvent) => applyFromClientY(ev.clientY);
      const onUp = (ev: PointerEvent) => {
        if (bezel.hasPointerCapture(ev.pointerId)) {
          bezel.releasePointerCapture(ev.pointerId);
        }
        bezel.removeEventListener('pointermove', onMove);
        bezel.removeEventListener('pointerup', onUp);
        bezel.removeEventListener('pointercancel', onUp);
      };
      bezel.addEventListener('pointermove', onMove);
      bezel.addEventListener('pointerup', onUp);
      bezel.addEventListener('pointercancel', onUp);
    });
  }

  public setAftertouchLevel(normVal: number): void {
    this.aftertouchLedLadder?.setValue(Math.max(0, Math.min(1, normVal)));
  }

  public setPedalLevel(normVal: number): void {
    this.pedalLedLadder?.setValue(Math.max(0, Math.min(1, normVal)));
  }

  public updateLabels(): void {
    // Control 1 (Stick Vertical = Mod Wheel CC 01 -> [415] ModulationDest, o Free Controller 1 Up Slot 1 [371] si > 3000)
    const c1UpDest = Math.round(WebBridge.getParam(371, 3000));
    const modWheelDest = Math.round(WebBridge.getParam(415, 59));
    const c1Label = this.rootEl?.querySelector('#ctrl1-dest-label');
    if (c1Label) {
      const activeDest = c1UpDest > 3000 ? c1UpDest : modWheelDest;
      c1Label.textContent = `▲ ${getModDestinationLabel(activeDest)}`;
    }

    // Control 2 (Wheel 1 = Breath CC 02 -> [417] BreathDest, o Free Controller 2 Slot 1 [387] si > 3000)
    const c2Dest = Math.round(WebBridge.getParam(387, 3000));
    const breathDest = Math.round(WebBridge.getParam(417, 56));
    const c2Label = this.rootEl?.querySelector('#ctrl2-dest-label');
    if (c2Label) {
      const activeDest = c2Dest > 3000 ? c2Dest : breathDest;
      c2Label.textContent = getModDestinationLabel(activeDest);
    }

    // Control 3 (Wheel 2 = Controller CC 03 -> [419] CC03Dest, o Free Controller 3 Slot 1 [395] si > 3000)
    const c3Dest = Math.round(WebBridge.getParam(395, 3000));
    const cc3Dest = Math.round(WebBridge.getParam(419, 57));
    const c3Label = this.rootEl?.querySelector('#ctrl3-dest-label');
    if (c3Label) {
      const activeDest = c3Dest > 3000 ? c3Dest : cc3Dest;
      c3Label.textContent = getModDestinationLabel(activeDest);
    }

    // Aftertouch (Channel Pressure -> [413] AftertouchDest, o Free Aftertouch Slot 1 [363] si > 3000)
    const atFreeDest = Math.round(WebBridge.getParam(363, 3000));
    const atDest = Math.round(WebBridge.getParam(413, 61));
    const atLabel = this.rootEl?.querySelector('#at-dest-label');
    if (atLabel) {
      const activeDest = atFreeDest > 3000 ? atFreeDest : atDest;
      atLabel.textContent = getModDestinationLabel(activeDest);
    }

    // Pedal (Foot CC 04 -> [421] FootDest, o Free Controller 4 Slot 1 [403] si > 3000)
    const pedalFreeDest = Math.round(WebBridge.getParam(403, 3000));
    const footDest = Math.round(WebBridge.getParam(421, 14));
    const pedalLabel = this.rootEl?.querySelector('#pedal-dest-label');
    if (pedalLabel) {
      const activeDest = pedalFreeDest > 3000 ? pedalFreeDest : footDest;
      pedalLabel.textContent = getModDestinationLabel(activeDest);
    }
  }

  public destroy(): void {
    this.stick?.destroy();
    this.control2Wheel?.destroy();
    this.control2LedLadder?.destroy();
    this.control3Wheel?.destroy();
    this.control3LedLadder?.destroy();
    this.aftertouchLedLadder?.destroy();
    this.pedalLedLadder?.destroy();
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.rootEl = null;
  }
}
