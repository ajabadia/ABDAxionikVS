/**
 * ABDAxionikVS — ControllersPanel.ts
 * Réplica fiel del bloque físico frontal «Controllers» del teclado hardware Hartmann Neuron.
 * 
 * Componentes canónicos reutilizados de ABDShared (filosofía DRY):
 * 1. Control 1 Performance Stick:
 *    - TrajectoryStick2D de @abdsynths/shared/components/trajectoryStick2D.js (1 capa, spring-return).
 *    - Eje X: Pitch Bend bipolar con retorno por muelle al centro ([-48, +48] semitonos).
 *    - Eje Y: Control 1 (Modulation Wheel CC 1 / ModulationDepth [416]).
 *    - Marcado físico: "Pitch ◀ ▶" y "▲ Control 1 ▼".
 * 2. Control 2 (Wheel original + LedLadder a su derecha):
 *    - Rueda de modulación física (Wheel de @abdsynths/shared/components) con sus dimensiones nativas de filmstrip (18x76px).
 *    - Indicador vertical de LEDs discretos (LedLadder de @abdsynths/shared/components) colocado a la derecha de la rueda.
 * 3. Knobs apilados verticalmente (Control 3 arriba, Master Vol abajo):
 *    - Knobs rotatorios canónicos de ABDShared con colores tokenizados generales.
 * 
 * Capa de abstracción:
 * Toda la comunicación viaja a través de WebBridge desacoplada del DSP.
 */

import { TrajectoryStick2D } from './TrajectoryStick2D.js';
import { Wheel } from '@abdsynths/shared/components/wheel.js';
import { LedLadder } from '@abdsynths/shared/components/ledLadder.js';
import { Knob } from '@abdsynths/shared/components/knob.js';
import { WebBridge } from '../bridge/WebBridge.js';

export class ControllersPanel {
  private container: HTMLElement;
  private rootEl: HTMLElement | null = null;
  private stick: TrajectoryStick2D | null = null;
  private ledLadder: LedLadder | null = null;
  private control2Wheel: Wheel | null = null;
  private control3Knob: Knob | null = null;
  private volumeKnob: Knob | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'synth-panel-card controllers-hardware-panel';
    this.rootEl.innerHTML = `
      <div class="panel-header controllers-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2, 6px); padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="controllers-led-badge" style="width: 7px; height: 7px; border-radius: 50%; background: var(--color-accent, #00c3ff); box-shadow: 0 0 6px var(--color-accent, #00c3ff);"></span>
          <span style="font-weight: 700; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-main, #e8f4ff);">Controllers</span>
        </div>
        <span class="panel-badge" style="font-size: 8px; opacity: 0.7;">HARDWARE PERFORMANCE</span>
      </div>

      <div class="controllers-grid" style="display: flex; align-items: center; justify-content: flex-start; gap: var(--space-5, 24px); padding: 8px 12px; flex-wrap: wrap; min-height: 170px;">
        
        <!-- 1. Control 1 Performance Stick (caja más alta con tamaño canónico de 130px) -->
        <div class="controller-stick-section" id="ctrl1-stick-mount" style="display: flex; align-items: center; justify-content: center;"></div>

        <!-- 2. Control 2 (Wheel tamaño original 18x76px + LedLadder a su derecha) -->
        <div class="controller-wheel-section" style="display: flex; flex-direction: row; align-items: center; gap: 8px;">
          <div id="ctrl2-wheel-mount"></div>
          <div id="ctrl2-led-ladder-mount" style="display: flex; align-items: center;"></div>
        </div>

        <!-- 3 & 4. Knobs apilados verticalmente (Control 3 encima, Master Vol debajo) -->
        <div class="controllers-knobs-column" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;">
          <div id="ctrl3-knob-mount"></div>
          <div id="master-vol-knob-mount"></div>
        </div>

      </div>
    `;

    this.container.appendChild(this.rootEl);

    // Inicializar subcomponentes canónicos de ABDShared
    this.initPerformanceStick();
    this.initLedLadder();
    this.initControl2Wheel();
    this.initControl3Knob();
    this.initMasterVolumeKnob();
  }

  private initPerformanceStick(): void {
    const mount = this.rootEl?.querySelector('#ctrl1-stick-mount');
    if (!mount) return;

    // Caja alta: size 130px para dar gran presencia física y amplitud al pozo del joystick
    this.stick = new TrajectoryStick2D(mount as HTMLElement, {
      label: 'Control 1',
      numLayers: 1,
      showHeader: false,
      showLayers: false,
      hasRecorder: false,
      readout: false,
      springReturn: true,
      restX: 0.5,
      restY: 0.0,
      size: 130,
      className: 'borderless',
      labels: {
        north: '▲ Control 1 ▼',
        south: '◀ Pitch ▶',
        west: '',
        east: '',
      },
      onChange: (_layerIdx, coord) => {
        // Pitch bend: X va de 0.0 a 1.0 (centro 0.5) -> normalizado [-1.0, +1.0]
        const pitchNorm = (coord.x - 0.5) * 2.0;
        WebBridge.pitchBend(pitchNorm);

        // Control 1: Y va de 0.0 a 1.0 (arriba positivo) -> CC 1 [0..127]
        const ccVal = Math.round(coord.y * 127.0);
        WebBridge.sendMidiCC(1, ccVal);
      },
    });
  }

  private initLedLadder(): void {
    const mount = this.rootEl?.querySelector('#ctrl2-led-ladder-mount');
    if (!mount) return;

    // Altura sincronizada con los 76px de la rueda original
    this.ledLadder = new LedLadder(mount as HTMLElement, {
      segments: 10,
      mode: 'bar',
      bipolar: false,
      showArrows: true,
      width: 14,
      segmentHeight: 4,
      ariaLabel: 'Control 2 LED Level',
    });
    this.ledLadder.setValue(0.0);
  }

  private initControl2Wheel(): void {
    const mount = this.rootEl?.querySelector('#ctrl2-wheel-mount');
    if (!mount) return;

    // Tamaño original exacto del filmstrip de bender.png (18px ancho x 76px alto, 101 fotogramas)
    this.control2Wheel = new Wheel(mount as HTMLElement, {
      type: 'mod',
      label: 'Control 2',
      min: 0,
      max: 127,
      frameWidth: 18,
      frameHeight: 76,
      onChange: (rawVal: number) => {
        const normalized = Math.max(0, Math.min(1, rawVal / 127.0));
        // Sincronizar indicador de LEDs inmediatamente a su derecha
        this.ledLadder?.setValue(normalized);
        // Despachar a través de la capa de abstracción
        WebBridge.sendMidiCC(2, rawVal);
      },
    });
  }

  private initControl3Knob(): void {
    const mount = this.rootEl?.querySelector('#ctrl3-knob-mount');
    if (!mount) return;

    // Knob asignable Control 3 apilado arriba
    this.control3Knob = new Knob(mount as HTMLElement, {
      size: 38,
      label: 'Control 3',
      value: 0.0,
      onChange: (normVal: number) => {
        const ccVal = Math.round(normVal * 127.0);
        WebBridge.sendMidiCC(3, ccVal);
      },
    });
  }

  private initMasterVolumeKnob(): void {
    const mount = this.rootEl?.querySelector('#master-vol-knob-mount');
    if (!mount) return;

    // Knob de volumen maestro apilado abajo con colores tokenizados generales de ABDShared
    this.volumeKnob = new Knob(mount as HTMLElement, {
      size: 38,
      label: 'Master Vol',
      value: 0.85, // Paridad canónica 0.85
      onChange: (normVal: number) => {
        WebBridge.setMasterVolume(normVal);
      },
    });
  }

  public destroy(): void {
    this.stick?.destroy();
    this.ledLadder?.destroy();
    this.control2Wheel?.destroy();
    this.control3Knob?.destroy();
    this.volumeKnob?.destroy();
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.remove();
    }
  }
}
