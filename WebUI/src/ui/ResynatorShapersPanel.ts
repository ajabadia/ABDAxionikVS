/**
 * ABDAxionikVS — ResynatorShapersPanel.ts
 * Editor de los 9 moldeadores fisicos/espectrales de un Resynator v2.
 *
 * El estado autoritativo vive en el modelo expandido cargado en el host. Cada
 * gesto actualiza la cache del WebBridge (para que el preset lo capture) y se
 * envia al motor mediante SET_RESYNATOR_SHAPERS, con un throttle corto para no
 * saturar el hilo de mensajes durante un arrastre.
 *
 * El panel escucha RESYNATOR_SHAPERS para reflejar en vivo las cargas de modelo
 * o preset que ocurran mientras el drawer sigue abierto.
 */

import { Knob } from '@abdsynths/shared/components';
import { WebBridge, type BridgeMessage } from '../bridge/WebBridge.js';
import {
  createDefaultResynatorShapers,
  type AxionikResynatorShapersState,
} from './PresetModel.js';
import {
  RESYNATOR_SHAPER_CONTROLS,
  shaperNormalizedToValue,
  shaperValueToNormalized,
} from './resynatorShapersModel.js';

const FLUSH_INTERVAL_MS = 33;

export class ResynatorShapersPanel {
  private readonly root: HTMLElement;
  private readonly resynator: 1 | 2;
  private readonly knobs = new Map<keyof AxionikResynatorShapersState, Knob>();
  private values: AxionikResynatorShapersState;
  private editable: boolean;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private dragging = false;
  private deferredHostState: AxionikResynatorShapersState | null = null;
  private hasDeferredHostState = false;
  private unsubscribe: (() => void) | null = null;
  private destroyed = false;

  constructor(container: HTMLElement, resynator: 1 | 2) {
    this.resynator = resynator;
    const active = WebBridge.getActiveResonatorShapers(resynator);
    this.editable = active !== undefined;
    this.values = active ?? createDefaultResynatorShapers();

    this.root = document.createElement('div');
    this.root.className = 'resynator-shapers-panel';
    container.appendChild(this.root);
    this.render();
    if (this.editable) {
      this.mountKnobs();
    }

    this.unsubscribe = WebBridge.onMessage((msg) => this.handleHostMessage(msg));
  }

  private render(): void {
    this.root.innerHTML = this.renderHtml();
  }

  private renderHtml(): string {
    const cells = RESYNATOR_SHAPER_CONTROLS.map(
      (control) => `
        <div class="synth-knob-cell" title="${control.description}">
          <div data-shaper-mount="${control.key}"></div>
          <span class="synth-knob-num stat-num" data-shaper-value="${control.key}">${control.format(
            this.values[control.key],
          )}</span>
          <span class="synth-knob-title">${control.label}</span>
        </div>
      `,
    ).join('');

    return `
      <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-3);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2);">
          <span class="panel-caption" style="color: var(--color-accent); font-weight: 700;">SONIC MATTER SHAPERS (RESYNATOR V2)</span>
          <span class="hud-pill" style="font-size: 8.5px; padding: 2px 6px; color: var(--color-accent); font-weight: 600;">${this.editable ? 'LIVE' : 'NO MODEL'}</span>
        </div>
        <div style="font-size: 11px; color: var(--color-text-muted);">
          Moldeadores fisicos y espectrales del modelo expandido. Se aplican al motor y se guardan en <strong>extendedState</strong>.
        </div>
        ${
          this.editable
            ? ''
            : '<div style="font-size: 11px; color: var(--color-warning, #ffb347);">Carga un modelo expandido en este Resynator para editar sus shapers.</div>'
        }
        <div data-shaper-grid style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); justify-items: center; ${
          this.editable ? '' : 'opacity: 0.55;'
        }">
          ${cells}
        </div>
      </div>
    `;
  }

  private mountKnobs(): void {
    this.destroyKnobs();
    for (const control of RESYNATOR_SHAPER_CONTROLS) {
      const mount = this.root.querySelector(
        `[data-shaper-mount="${control.key}"]`,
      ) as HTMLElement | null;
      const valueEl = this.root.querySelector(
        `[data-shaper-value="${control.key}"]`,
      ) as HTMLElement | null;
      if (!mount) continue;

      const knob = new Knob(mount, {
        size: 40,
        label: control.knobLabel,
        value: shaperValueToNormalized(control, this.values[control.key]),
        bipolar: control.bipolar === true,
        step: 0.005,
        format: (normalized: number) =>
          control.format(shaperNormalizedToValue(control, normalized)),
        onChange: (normalized: number) => {
          this.hasDeferredHostState = false;
          this.deferredHostState = null;
          const value = shaperNormalizedToValue(control, normalized);
          this.values = { ...this.values, [control.key]: value };
          if (valueEl) valueEl.textContent = control.format(value);
          this.scheduleFlush();
        },
        onDragStart: () => {
          this.dragging = true;
        },
        onDragEnd: () => {
          this.dragging = false;
          if (this.flushTimer === null && this.hasDeferredHostState) {
            const pending = this.deferredHostState;
            this.hasDeferredHostState = false;
            this.deferredHostState = null;
            this.applyHostState(pending);
          }
        },
      });
      this.knobs.set(control.key, knob);
    }
  }

  private destroyKnobs(): void {
    for (const knob of this.knobs.values()) {
      knob.destroy();
    }
    this.knobs.clear();
  }

  private handleHostMessage(msg: BridgeMessage): void {
    if (msg.type !== 'RESYNATOR_SHAPERS' || msg.resynator !== this.resynator) return;

    // El drawer pudo cerrarse sin pasar por destroy(): corta la suscripcion.
    if (!this.root.isConnected) {
      this.destroy();
      return;
    }

    const state = WebBridge.getActiveResonatorShapers(this.resynator);

    if (this.dragging) {
      // No mover el knob bajo el dedo. Si no hay una edicion pendiente, se
      // aplica al soltar; si el usuario ya edito, su valor tiene prioridad.
      if (this.flushTimer === null) {
        this.deferredHostState = state ?? null;
        this.hasDeferredHostState = true;
      }
      return;
    }

    // Un SET propio esta a punto de salir: su eco traera el estado canonico.
    if (this.flushTimer !== null) return;

    this.applyHostState(state ?? null);
  }

  private applyHostState(state: AxionikResynatorShapersState | null): void {
    if (state === null) {
      if (!this.editable) return;
      this.destroyKnobs();
      this.editable = false;
      this.values = createDefaultResynatorShapers();
      this.render();
      return;
    }

    this.values = { ...state };
    if (!this.editable) {
      this.destroyKnobs();
      this.editable = true;
      this.render();
      this.mountKnobs();
      return;
    }

    for (const control of RESYNATOR_SHAPER_CONTROLS) {
      const value = state[control.key];
      this.knobs.get(control.key)?.setValue(shaperValueToNormalized(control, value));
      const valueEl = this.root.querySelector(
        `[data-shaper-value="${control.key}"]`,
      ) as HTMLElement | null;
      if (valueEl) valueEl.textContent = control.format(value);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      WebBridge.setActiveResonatorShapers(this.resynator, this.values);
    }, FLUSH_INTERVAL_MS);
  }

  /** Cancela el throttle y aplica el ultimo valor pendiente. */
  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.unsubscribe?.();
    this.unsubscribe = null;

    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
      WebBridge.setActiveResonatorShapers(this.resynator, this.values);
    }

    this.dragging = false;
    this.hasDeferredHostState = false;
    this.deferredHostState = null;
    this.destroyKnobs();
    this.root.remove();
  }
}
