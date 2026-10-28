/**
 * ABDAxionikVS — RotaryLedKnob.ts
 * Rotary knob con collar circular de LEDs discretos interactivo.
 * Inspirado en los encoders rotatorios de consola de alta gama y sintetizadores hardware con LED ring.
 */

import { attachDrag } from '@abdsynths/shared/components/drag-core.js';

export interface RotaryLedKnobOptions {
  size?: number;
  value?: number;
  min?: number;
  max?: number;
  numLeds?: number;
  label?: string;
  bipolar?: boolean;
  onChange?: (val: number) => void;
  format?: (val: number) => string;
}

export class RotaryLedKnob {
  private container: HTMLElement;
  private options: Required<Omit<RotaryLedKnobOptions, 'onChange' | 'format'>> & {
    onChange?: (val: number) => void;
    format?: (val: number) => string;
  };
  private value: number;
  private rootEl: HTMLElement | null = null;
  private ledsGroup: SVGGElement | null = null;
  private pointerLine: SVGLineElement | null = null;
  private dragDetach: (() => void) | null = null;

  constructor(container: HTMLElement, options: RotaryLedKnobOptions = {}) {
    this.container = container;
    this.options = {
      size: options.size ?? 68,
      value: options.value ?? 0.85,
      min: options.min ?? 0,
      max: options.max ?? 1,
      numLeds: options.numLeds ?? 15,
      label: options.label ?? 'VOLUME',
      bipolar: options.bipolar ?? false,
      onChange: options.onChange,
      format: options.format ?? ((v) => `${Math.round(v * 100)}%`),
    };

    this.value = Math.max(0, Math.min(1, this.options.value));
    this.render();
  }

  private render(): void {
    const { size } = this.options;
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'rotary-led-knob-wrapper';
    this.rootEl.style.cssText = `
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      user-select: none;
      touch-action: none;
    `;

    const cx = size / 2;
    const cy = size / 2;
    const ledRadius = size / 2 - 5;
    const dialRadius = ledRadius - 9;

    this.rootEl.innerHTML = `
      <div class="rotary-led-control" tabindex="0" role="slider" aria-label="${this.options.label}"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(this.value * 100)}"
           style="position: relative; width: ${size}px; height: ${size}px; cursor: grab; outline: none;">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display: block; overflow: visible;">
          <defs>
            <radialGradient id="rotary-metal-grad" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stop-color="#2a3340" />
              <stop offset="60%" stop-color="#181f28" />
              <stop offset="100%" stop-color="#0e1319" />
            </radialGradient>
            <filter id="rotary-led-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <!-- Outer bezel ring -->
          <circle cx="${cx}" cy="${cy}" r="${ledRadius + 3}" fill="#0e1319" stroke="rgba(255,255,255,0.08)" stroke-width="1" />

          <!-- LED collar arc dots -->
          <g class="rotary-leds-group"></g>

          <!-- Central knob face with metallic rim -->
          <circle cx="${cx}" cy="${cy}" r="${dialRadius}" fill="url(#rotary-metal-grad)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
          <circle cx="${cx}" cy="${cy}" r="${dialRadius - 2.5}" fill="none" stroke="rgba(0,0,0,0.6)" stroke-width="1" />

          <!-- Indicator pointer line -->
          <line class="rotary-pointer-line" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - dialRadius + 4}"
                stroke="#00c3ff" stroke-width="2.5" stroke-linecap="round" filter="url(#rotary-led-glow)" />
        </svg>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    this.ledsGroup = this.rootEl.querySelector('.rotary-leds-group');
    this.pointerLine = this.rootEl.querySelector('.rotary-pointer-line');

    this.buildLeds();
    this.updateVisuals();
    this.attachEvents();
  }

  private buildLeds(): void {
    if (!this.ledsGroup) return;
    this.ledsGroup.innerHTML = '';

    const { size, numLeds } = this.options;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 5;
    const startAngle = -135;
    const sweep = 270;

    for (let i = 0; i < numLeds; i++) {
      const frac = i / (numLeds - 1);
      const angleDeg = startAngle + frac * sweep;
      const angleRad = (angleDeg - 90) * (Math.PI / 180);
      const lx = cx + r * Math.cos(angleRad);
      const ly = cy + r * Math.sin(angleRad);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', lx.toFixed(2));
      circle.setAttribute('cy', ly.toFixed(2));
      circle.setAttribute('r', '2.2');
      circle.setAttribute('class', 'led-dot');
      circle.setAttribute('data-idx', String(i));
      this.ledsGroup.appendChild(circle);
    }
  }

  private updateVisuals(): void {
    const { size, numLeds, bipolar } = this.options;
    const cx = size / 2;
    const cy = size / 2;
    const angleDeg = -135 + this.value * 270;

    if (this.pointerLine) {
      this.pointerLine.setAttribute('transform', `rotate(${angleDeg}, ${cx}, ${cy})`);
    }

    if (this.ledsGroup) {
      const dots = this.ledsGroup.querySelectorAll('.led-dot');
      dots.forEach((dot, idx) => {
        let isLit = false;
        if (bipolar) {
          const mid = (numLeds - 1) / 2;
          const target = this.value * (numLeds - 1);
          if (target >= mid) {
            isLit = idx >= mid && idx <= target;
          } else {
            isLit = idx <= mid && idx >= target;
          }
        } else {
          const activeCount = Math.round(this.value * (numLeds - 1));
          isLit = idx <= activeCount;
        }

        if (isLit) {
          dot.setAttribute('fill', '#00c3ff');
          dot.setAttribute('stroke', '#38bdf8');
          dot.setAttribute('stroke-width', '0.5');
          dot.setAttribute('filter', 'url(#rotary-led-glow)');
        } else {
          dot.setAttribute('fill', 'rgba(255, 255, 255, 0.08)');
          dot.setAttribute('stroke', 'rgba(255, 255, 255, 0.12)');
          dot.setAttribute('stroke-width', '0.5');
          dot.removeAttribute('filter');
        }
      });
    }

    const control = this.rootEl?.querySelector('.rotary-led-control');
    if (control) {
      control.setAttribute('aria-valuenow', String(Math.round(this.value * 100)));
    }
  }

  private attachEvents(): void {
    const control = this.rootEl?.querySelector('.rotary-led-control') as HTMLElement | null;
    if (!control) return;

    this.dragDetach = attachDrag(control, {
      getValue: () => this.value,
      setValue: (v: number) => {
        this.value = Math.max(0, Math.min(1, v));
        this.updateVisuals();
        this.options.onChange?.(this.value);
      },
      speed: 0.007,
    });

    // Wheel listener
    control.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.03 : -0.03;
      this.setValue(this.value + delta, true);
    }, { passive: false });

    // Keyboard listener
    control.addEventListener('keydown', (e: KeyboardEvent) => {
      let delta = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = 0.02;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -0.02;
      else if (e.key === 'PageUp') delta = 0.1;
      else if (e.key === 'PageDown') delta = -0.1;
      else if (e.key === 'Home') { this.setValue(0, true); return; }
      else if (e.key === 'End') { this.setValue(1, true); return; }

      if (delta !== 0) {
        e.preventDefault();
        this.setValue(this.value + delta, true);
      }
    });
  }

  public setValue(val: number, notify = false): void {
    this.value = Math.max(0, Math.min(1, val));
    this.updateVisuals();
    if (notify) {
      this.options.onChange?.(this.value);
    }
  }

  public getValue(): number {
    return this.value;
  }

  public destroy(): void {
    this.dragDetach?.();
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
  }
}
