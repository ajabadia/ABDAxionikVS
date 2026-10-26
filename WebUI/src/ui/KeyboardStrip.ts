/**
 * ABDAxionikVS — KeyboardStrip.ts
 * Franja de teclado interactivo inferior con paridad visual ABDNeuModMakr
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

export interface KeyboardStripHandlers {
  onNotePress: (midiNote: number) => void;
  onNoteRelease: (midiNote: number) => void;
}

export class KeyboardStrip {
  private container: HTMLElement;
  private handlers: KeyboardStripHandlers;
  private baseOctave: number = 2; // C2 (36) a C7 (96) por defecto
  private pressedNotes: Set<number> = new Set();

  constructor(container: HTMLElement, handlers: KeyboardStripHandlers) {
    this.container = container;
    this.handlers = handlers;
    this.render();
  }

  public setBaseOctave(oct: number): void {
    this.baseOctave = Math.max(0, Math.min(6, oct));
    this.render();
  }

  private render(): void {
    const startNote = this.baseOctave * 12;
    const keyCount = 61; // 5 octavas + C superior

    this.container.innerHTML = `
      <div class="keyboard-strip-container">
        <div class="panel-header" style="margin-bottom: var(--space-2); padding-bottom: var(--space-1);">
          <div class="panel-caption">
            <span class="hud-label">KEYBED RANGE:</span>
            <span class="hud-value">${midiToNoteName(startNote)} (${startNote}) — ${midiToNoteName(startNote + keyCount - 1)} (${startNote + keyCount - 1})</span>
          </div>
          <div class="panel-actions">
            <button type="button" class="btn-secondary" id="btn-oct-down" ${this.baseOctave <= 0 ? 'disabled' : ''}>OCT −</button>
            <span class="hud-pill stat-num">OCT ${this.baseOctave}</span>
            <button type="button" class="btn-secondary" id="btn-oct-up" ${this.baseOctave >= 6 ? 'disabled' : ''}>OCT +</button>
          </div>
        </div>

        <div class="piano-keys-bed" id="piano-keys-bed">
          ${this.renderKeys(startNote, keyCount)}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderKeys(startNote: number, count: number): string {
    const keysHtml: string[] = [];

    for (let i = 0; i < count; i++) {
      const midi = startNote + i;
      const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);
      const noteName = midiToNoteName(midi);

      keysHtml.push(`
        <div 
          class="piano-key ${isBlack ? 'black-key' : 'white-key'}" 
          data-midi="${midi}"
          data-note="${noteName}"
          title="${noteName} (MIDI ${midi})"
        >
          <span class="key-label">${(midi % 12 === 0) ? noteName : ''}</span>
        </div>
      `);
    }

    return keysHtml.join('');
  }

  private bindEvents(): void {
    this.container.querySelector('#btn-oct-down')?.addEventListener('click', () => {
      this.setBaseOctave(this.baseOctave - 1);
    });

    this.container.querySelector('#btn-oct-up')?.addEventListener('click', () => {
      this.setBaseOctave(this.baseOctave + 1);
    });

    const keys = this.container.querySelectorAll<HTMLElement>('.piano-key');
    keys.forEach((el) => {
      const midi = parseInt(el.getAttribute('data-midi') || '-1', 10);
      if (midi < 0) return;

      const press = () => {
        el.classList.add('is-pressed');
        this.pressedNotes.add(midi);
        this.handlers.onNotePress(midi);
      };

      const release = () => {
        el.classList.remove('is-pressed');
        this.pressedNotes.delete(midi);
        this.handlers.onNoteRelease(midi);
      };

      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        press();
      });

      el.addEventListener('mouseenter', (e: MouseEvent) => {
        if (e.buttons === 1) {
          press();
        }
      });

      el.addEventListener('mouseup', release);
      el.addEventListener('mouseleave', release);
    });
  }
}
