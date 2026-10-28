/**
 * ABDAxionikVS — MasterOutputPanel.ts
 * Panel dedicado de salida maestra (Master Output) ubicado a la derecha del sintetizador.
 * Integra el encoder rotatorio interactivo con collar de LEDs discretos (RotaryLedKnob).
 */

import { RotaryLedKnob } from './RotaryLedKnob.js';
import { WebBridge } from '../bridge/WebBridge.js';

export class MasterOutputPanel {
  private container: HTMLElement;
  private rootEl: HTMLElement | null = null;
  private volumeKnob: RotaryLedKnob | null = null;
  private isMuted: boolean = false;
  private prevVolume: number = 0.85;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'synth-panel-card master-output-panel';
    this.rootEl.innerHTML = `
      <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
        <span class="stick-label">MASTER</span>
        <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="btn btn-xs btn-outline" id="btn-master-mute" title="Mute Master Output">MUTE</button>
          <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-bottom" title="Colapsar / Descolapsar fila">▾</button>
        </div>
      </div>

      <div class="panel-body master-body" data-collapse-body style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 4px 0;">
          <div id="master-vol-knob-mount" style="display: flex; align-items: center; justify-content: center;"></div>
          <span class="hud-value stat-num" id="master-vol-readout" style="font-size: 11px; font-weight: 700; color: var(--color-accent, #00c3ff);">85%</span>
        </div>

        <div style="display: flex; justify-content: center; align-items: center; padding-top: 4px; border-top: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
          <span class="hud-pill" style="font-size: 8px; color: var(--color-text-muted); font-weight: 600; padding: 1px 6px;">0.0 dB HEADROOM</span>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    const mount = this.rootEl.querySelector('#master-vol-knob-mount');
    if (mount) {
      this.volumeKnob = new RotaryLedKnob(mount as HTMLElement, {
        size: 64,
        label: 'VOLUME',
        value: 0.85,
        numLeds: 15,
        onChange: (normVal: number) => {
          this.isMuted = false;
          this.updateMuteButton();
          const readout = this.rootEl?.querySelector('#master-vol-readout');
          if (readout) readout.textContent = `${Math.round(normVal * 100)}%`;
          WebBridge.setMasterVolume(normVal);
        },
      });
    }

    const muteBtn = this.rootEl.querySelector('#btn-master-mute');
    muteBtn?.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      this.updateMuteButton();
      if (this.isMuted) {
        this.prevVolume = this.volumeKnob?.getValue() ?? 0.85;
        this.volumeKnob?.setValue(0);
        WebBridge.setMasterVolume(0);
        const readout = this.rootEl?.querySelector('#master-vol-readout');
        if (readout) readout.textContent = 'MUTED';
      } else {
        const restoreVal = this.prevVolume > 0.01 ? this.prevVolume : 0.85;
        this.volumeKnob?.setValue(restoreVal);
        WebBridge.setMasterVolume(restoreVal);
        const readout = this.rootEl?.querySelector('#master-vol-readout');
        if (readout) readout.textContent = `${Math.round(restoreVal * 100)}%`;
      }
    });
  }

  private updateMuteButton(): void {
    const btn = this.rootEl?.querySelector('#btn-master-mute');
    if (!btn) return;
    btn.classList.toggle('active', this.isMuted);
    btn.classList.toggle('btn-danger-solid', this.isMuted);
    btn.classList.toggle('btn-outline', !this.isMuted);
  }

  public setVolume(v: number): void {
    this.volumeKnob?.setValue(v);
    const readout = this.rootEl?.querySelector('#master-vol-readout');
    if (readout) readout.textContent = `${Math.round(v * 100)}%`;
  }

  public destroy(): void {
    this.volumeKnob?.destroy();
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
  }
}
