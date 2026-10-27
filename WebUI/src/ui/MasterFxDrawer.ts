/**
 * ABDAxionikVS — MasterFxDrawer.ts
 * Dedicated slide-out drawer (50vw) for the Master Effects Rack ([430..444]).
 * Master Stereo Delay & 5-Room Master Reverb.
 * 100% tokenized with @abdsynths/shared.
 */

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';

export const REVERB_ROOMS = [
  { id: 0, name: 'Small Room' },
  { id: 1, name: 'Plate Reverb' },
  { id: 2, name: 'Medium Room' },
  { id: 3, name: 'Concert Hall 1' },
  { id: 4, name: 'Cathedral Hall 2' },
];

export interface MasterFxDrawerOptions {
  onClose: () => void;
}

export class MasterFxDrawer {
  static createContent(options: MasterFxDrawerOptions): HTMLElement {
    const root = document.createElement('div');
    root.className = 'drawer-view-content';
    root.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-4); height: 100%;';

    let roomButtonsHtml = '';
    REVERB_ROOMS.forEach((r) => {
      const isAct = r.id === 1; // Default Plate
      roomButtonsHtml += `
        <button type="button" class="btn btn-xs ${isAct ? 'btn-primary active' : 'btn-outline'} btn-reverb-room" data-room="${r.id}">
          ${r.id}: ${r.name}
        </button>
      `;
    });

    root.innerHTML = `
      <div class="drawer-header">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="panel-badge">MASTER FX RACK</span>
          <span class="panel-caption">Master Stereo Delay & 5-Room Reverb [430..444]</span>
        </div>
        <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-mfx-drawer" title="Close (Esc)">${ICONS.close}</button>
      </div>

      <div class="drawer-scroll-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); padding-right: 4px;">
        <!-- Card 1: Master Stereo Delay -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="panel-badge">STEREO DELAY</span>
              <span class="panel-caption">Master Spatial Echo [430..435]</span>
            </div>
            <button type="button" class="btn btn-xs btn-primary active" id="btn-mfx-delay-bypass" data-param="430">Active</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">MIX [431]:</span>
              <input type="range" id="mfx-delay-mix" class="abd-slider" min="0" max="127" value="35" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-delay-mix-val">35</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">FEEDBACK [434]:</span>
              <input type="range" id="mfx-delay-fb" class="abd-slider" min="0" max="127" value="45" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-delay-fb-val">45</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">LEFT TIME [432]:</span>
              <input type="range" id="mfx-delay-ltime" class="abd-slider" min="0" max="127" value="64" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-delay-ltime-val">64</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">RIGHT TIME [433]:</span>
              <input type="range" id="mfx-delay-rtime" class="abd-slider" min="0" max="127" value="80" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-delay-rtime-val">80</span>
            </div>
          </div>
        </div>

        <!-- Card 2: Master Reverb -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="panel-badge">MASTER REVERB</span>
              <span class="panel-caption">Algorithmic Acoustic Spaces [436..444]</span>
            </div>
            <button type="button" class="btn btn-xs btn-primary active" id="btn-mfx-reverb-bypass" data-param="436">Active</button>
          </div>

          <!-- Room Selector -->
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${roomButtonsHtml}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">MIX [437]:</span>
              <input type="range" id="mfx-rev-mix" class="abd-slider" min="0" max="127" value="40" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-rev-mix-val">40</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">DECAY [439]:</span>
              <input type="range" id="mfx-rev-decay" class="abd-slider" min="0" max="127" value="65" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-rev-decay-val">65</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">DIFFUSION [440]:</span>
              <input type="range" id="mfx-rev-diff" class="abd-slider" min="0" max="127" value="80" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-rev-diff-val">80</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">HF DAMP [441]:</span>
              <input type="range" id="mfx-rev-damp" class="abd-slider" min="0" max="127" value="45" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-rev-damp-val">45</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Events
    root.querySelector('#btn-close-mfx-drawer')?.addEventListener('click', () => {
      options.onClose();
    });

    // Bypass buttons
    const bindBypass = (btnId: string, paramId: number) => {
      const btn = root.querySelector(`#${btnId}`) as HTMLElement | null;
      btn?.addEventListener('click', () => {
        const isAct = btn.classList.contains('active');
        const nextState = !isAct;
        btn.classList.toggle('active', nextState);
        btn.classList.toggle('btn-primary', nextState);
        btn.classList.toggle('btn-outline', !nextState);
        btn.textContent = nextState ? 'Active' : 'Bypass';
        WebBridge.setParam(paramId, nextState ? 1 : 0);
      });
    };

    bindBypass('btn-mfx-delay-bypass', 430);
    bindBypass('btn-mfx-reverb-bypass', 436);

    // Reverb room buttons
    root.querySelectorAll('.btn-reverb-room').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const room = parseInt(target.getAttribute('data-room') || '0', 10);
        WebBridge.setParam(438, room);
        root.querySelectorAll('.btn-reverb-room').forEach((b) => {
          const isAct = parseInt(b.getAttribute('data-room') || '0', 10) === room;
          b.classList.toggle('active', isAct);
          b.classList.toggle('btn-primary', isAct);
          b.classList.toggle('btn-outline', !isAct);
        });
      });
    });

    // Sliders
    const bindSlider = (id: string, paramId: number, valId: string) => {
      const slider = root.querySelector(`#${id}`) as HTMLInputElement | null;
      const valDisplay = root.querySelector(`#${valId}`);
      slider?.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        if (valDisplay) valDisplay.textContent = String(val);
        WebBridge.setParam(paramId, val);
      });
    };

    bindSlider('mfx-delay-mix', 431, 'mfx-delay-mix-val');
    bindSlider('mfx-delay-fb', 434, 'mfx-delay-fb-val');
    bindSlider('mfx-delay-ltime', 432, 'mfx-delay-ltime-val');
    bindSlider('mfx-delay-rtime', 433, 'mfx-delay-rtime-val');
    bindSlider('mfx-rev-mix', 437, 'mfx-rev-mix-val');
    bindSlider('mfx-rev-decay', 439, 'mfx-rev-decay-val');
    bindSlider('mfx-rev-diff', 440, 'mfx-rev-diff-val');
    bindSlider('mfx-rev-damp', 441, 'mfx-rev-damp-val');

    return root;
  }
}
