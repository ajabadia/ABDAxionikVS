/**
 * ABDAxionikVS — KeyboardStrip.ts
 * Franja de teclado de alto rendimiento impulsada por @abdsynths/midi-keyb
 * Ruedas de Pitch y Modulación, botones de octava con LEDs, Panic, Sustain, Hold, Retrig,
 * texturas de marfil realistas y respuesta táctil / QWERTY.
 */

import { createKeyboard } from '@abdsynths/midi-keyb';

export interface KeyboardStripHandlers {
  onNotePress: (midiNote: number, velocity?: number) => void;
  onNoteRelease: (midiNote: number) => void;
  onPitchBend?: (value: number) => void;
  onModWheel?: (value: number) => void;
  onAftertouch?: (value: number, note?: number) => void;
  onPanic?: () => void;
  onSustainChange?: (active: boolean) => void;
  onCollapseChange?: (collapsed: boolean) => void;
}

export class KeyboardStrip {
  private container: HTMLElement;
  private handlers: KeyboardStripHandlers;
  private kbdInstance: any = null;

  constructor(container: HTMLElement, handlers: KeyboardStripHandlers) {
    this.container = container;
    this.handlers = handlers;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="keyboard-lower-section">
        <!-- Pitch Bend & Mod Wheels -->
        <div class="wheels-block">
          <div id="pitch-wheel-container"></div>
          <div id="mod-wheel-container"></div>
        </div>

        <!-- Vertical Octave Controls -->
        <div class="kbd-octave-controls">
          <button id="oct-up" class="kbd-octave-btn" title="Octave Up">
            <span>OCT +</span>
            <div class="kbd-octave-led" id="led-up"></div>
          </button>
          <button id="oct-down" class="kbd-octave-btn" title="Octave Down">
            <span>OCT -</span>
            <div class="kbd-octave-led" id="led-down"></div>
          </button>
        </div>

        <!-- 4-Octave Performance Keybed -->
        <div id="piano-keyboard"></div>

        <!-- Panic / All Notes Off -->
        <div class="kbd-panic-zone" id="kbd-panic-zone"></div>
      </div>
    `;

    this.initMidiKeyboard();
  }

  private initMidiKeyboard(): void {
    if (this.kbdInstance?.destroy) {
      this.kbdInstance.destroy();
    }

    this.kbdInstance = createKeyboard({
      containerId: 'piano-keyboard',
      wheelPitchId: 'pitch-wheel-container',
      wheelModId: 'mod-wheel-container',
      octUpId: 'oct-up',
      octDownId: 'oct-down',
      ledUpId: 'led-up',
      ledDownId: 'led-down',
      panicBtnId: null,
      onNoteOn: (note: number, velocity: number) => {
        this.handlers.onNotePress(note, velocity);
      },
      onNoteOff: (note: number) => {
        this.handlers.onNoteRelease(note);
      },
      onPitchBend: (val: number) => {
        this.handlers.onPitchBend?.(val);
      },
      onModWheel: (val: number) => {
        this.handlers.onModWheel?.(val);
      },
      onAftertouch: (note: number, pressure: number) => {
        // midi-keyb pasa (note, pressure) donde note=-1 para canal o nota individual
        const normalized = pressure > 1.0 ? pressure / 127.0 : pressure;
        this.handlers.onAftertouch?.(normalized, note);
      },
      onPanic: () => {
        this.handlers.onPanic?.();
      },
      onSustainChange: (active: boolean) => {
        this.handlers.onSustainChange?.(active);
      },
      onCollapseChange: (collapsed: boolean) => {
        this.container.classList.toggle('is-collapsed', collapsed);
        this.handlers.onCollapseChange?.(collapsed);
      },
      config: {
        numOctaves: 4,
        startNote: 36, // C2
        maxOctaveShift: 3,
        velocitySource: 'yPosition',
        velocityCurve: 'normal',
        enablePanic: true,
        enableWheels: true,
        enableIvoryTexture: true,
        enableQwerty: true,
        showQwertyLabels: true,
        enableHold: true,
        enableRetrig: true,
        enableSustain: true,
        enableTouch: true,
        enableAftertouch: true,
        enableResizeObserver: true,
        enableCollapse: true,
      }
    });

    (window as any).__kbd = this.kbdInstance;
  }

  public isCollapsed(): boolean {
    return this.kbdInstance?.isCollapsed?.() ?? false;
  }

  public collapse(): void {
    this.kbdInstance?.collapse?.();
  }

  public expand(): void {
    this.kbdInstance?.expand?.();
  }

  public toggleCollapse(): void {
    this.kbdInstance?.toggleCollapse?.();
  }

  public panic(): void {
    this.kbdInstance?.panic?.();
  }

  public getInstance(): any {
    return this.kbdInstance;
  }

  public destroy(): void {
    this.kbdInstance?.destroy?.();
    this.kbdInstance = null;
  }
}
