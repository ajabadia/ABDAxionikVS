/**
 * ABDAxionikVS — MasterFxDrawer.ts
 * Dedicated slide-out drawer (50vw) for the Master Effects Rack ([430..444]).
 * Master Stereo Delay & 5-Room Master Reverb (ABDEep SchroederReverb + 8x8 Householder FDN).
 * 100% aligned with ParameterRegistry.gen.h indices 430..444.
 */

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';

export const REVERB_ROOMS = [
  { id: 0, name: 'Hall' },
  { id: 1, name: 'Plate' },
  { id: 2, name: 'Room' },
  { id: 3, name: 'Chamber' },
  { id: 4, name: 'Ambience' },
];

export interface MasterFxDrawerOptions {
  onClose: () => void;
}

export class MasterFxDrawer {
  static createContent(options: MasterFxDrawerOptions): HTMLElement {
    const root = document.createElement('div');
    root.className = 'drawer-view-content';
    root.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-4); height: 100%;';

    // Rehidratar valores reales desde WebBridge (índices exactos 430..444)
    const curMasterOn = Math.round(WebBridge.getParam(430, 1)) > 0;
    const curDelayOn = Math.round(WebBridge.getParam(431, 1)) > 0;
    const curDelayMix = Math.round(WebBridge.getParam(432, 35));
    const curDelayL = Math.round(WebBridge.getParam(433, 250));
    const curDelayR = Math.round(WebBridge.getParam(434, 500));
    const curDelayFb = Math.round(WebBridge.getParam(435, 25));
    const curDelayDamp = Math.round(WebBridge.getParam(436, 40));

    const curRevOn = Math.round(WebBridge.getParam(437, 1)) > 0;
    const curRevMix = Math.round(WebBridge.getParam(438, 40));
    const curRevRoom = Math.round(WebBridge.getParam(439, 1));
    const curRevDecay = Math.round(WebBridge.getParam(440, 65));
    const curRevDiff = Math.round(WebBridge.getParam(441, 80));
    const curRevDamp = Math.round(WebBridge.getParam(442, 45));
    const curRevDetune = Math.round(WebBridge.getParam(443, 20));
    const curRevSpeed = Math.round(WebBridge.getParam(444, 50));

    let roomButtonsHtml = '';
    REVERB_ROOMS.forEach((r) => {
      const isAct = r.id === curRevRoom;
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
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <button type="button" class="btn btn-xs ${curMasterOn ? 'btn-primary active' : 'btn-outline'}" id="btn-mfx-master-switch" title="SoundMFXSwitch [430]">
            MASTER MFX: ${curMasterOn ? 'ON' : 'BYPASS'}
          </button>
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-mfx-drawer" title="Close (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <div class="drawer-scroll-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); padding-right: 4px;">
        <!-- Card 1: Master Stereo Delay [431..436] -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="panel-badge">STEREO DELAY</span>
              <span class="panel-caption">Master Spatial Echo [431..436]</span>
            </div>
            <button type="button" class="btn btn-xs ${curDelayOn ? 'btn-primary active' : 'btn-outline'}" id="btn-mfx-delay-bypass">
              ${curDelayOn ? 'Active' : 'Bypass'}
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">MIX [432]:</span>
              <input type="range" id="mfx-delay-mix" class="abd-slider" min="0" max="127" value="${curDelayMix}" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-delay-mix-val">${curDelayMix}</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">FEEDBACK [435]:</span>
              <input type="range" id="mfx-delay-fb" class="abd-slider" min="-64" max="63" value="${curDelayFb}" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-delay-fb-val">${curDelayFb}</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">LEFT MS [433]:</span>
              <input type="range" id="mfx-delay-ltime" class="abd-slider" min="1" max="1000" value="${curDelayL}" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-delay-ltime-val">${curDelayL}</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">RIGHT MS [434]:</span>
              <input type="range" id="mfx-delay-rtime" class="abd-slider" min="1" max="1000" value="${curDelayR}" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-delay-rtime-val">${curDelayR}</span>
            </div>
            <div class="hud-pill" style="grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">HF FEEDBACK DAMPING [436]:</span>
              <input type="range" id="mfx-delay-damp" class="abd-slider" min="0" max="127" value="${curDelayDamp}" step="1" style="flex: 1; margin: 0 12px;" />
              <span class="hud-value stat-num" id="mfx-delay-damp-val">${curDelayDamp}</span>
            </div>
          </div>
        </div>

        <!-- Card 2: Master Reverb [437..444] -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="panel-badge">MASTER REVERB</span>
              <span class="panel-caption">ABDEep Schroeder + 8x8 Householder FDN [437..444]</span>
            </div>
            <button type="button" class="btn btn-xs ${curRevOn ? 'btn-primary active' : 'btn-outline'}" id="btn-mfx-reverb-bypass">
              ${curRevOn ? 'Active' : 'Bypass'}
            </button>
          </div>

          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${roomButtonsHtml}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">MIX [438]:</span>
              <input type="range" id="mfx-rev-mix" class="abd-slider" min="0" max="127" value="${curRevMix}" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-rev-mix-val">${curRevMix}</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">DECAY [440]:</span>
              <input type="range" id="mfx-rev-decay" class="abd-slider" min="0" max="127" value="${curRevDecay}" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-rev-decay-val">${curRevDecay}</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">DIFFUSION [441]:</span>
              <input type="range" id="mfx-rev-diff" class="abd-slider" min="0" max="127" value="${curRevDiff}" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-rev-diff-val">${curRevDiff}</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">HF DAMP [442]:</span>
              <input type="range" id="mfx-rev-damp" class="abd-slider" min="0" max="127" value="${curRevDamp}" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-rev-damp-val">${curRevDamp}</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">DETUNE [443]:</span>
              <input type="range" id="mfx-rev-detune" class="abd-slider" min="0" max="127" value="${curRevDetune}" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-rev-detune-val">${curRevDetune}</span>
            </div>
            <div class="hud-pill" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-2);">
              <span class="hud-label">MOD SPEED [444]:</span>
              <input type="range" id="mfx-rev-speed" class="abd-slider" min="0" max="200" value="${curRevSpeed}" step="1" style="width: 100px;" />
              <span class="hud-value stat-num" id="mfx-rev-speed-val">${curRevSpeed}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#btn-close-mfx-drawer')?.addEventListener('click', () => {
      options.onClose();
    });

    const masterBtn = root.querySelector('#btn-mfx-master-switch') as HTMLElement | null;
    masterBtn?.addEventListener('click', () => {
      const next = !masterBtn.classList.contains('active');
      masterBtn.classList.toggle('active', next);
      masterBtn.classList.toggle('btn-primary', next);
      masterBtn.classList.toggle('btn-outline', !next);
      masterBtn.textContent = `MASTER MFX: ${next ? 'ON' : 'BYPASS'}`;
      WebBridge.setParam(430, next ? 1 : 0);
    });

    const bindBypass = (btnId: string, paramId: number) => {
      const btn = root.querySelector(`#${btnId}`) as HTMLElement | null;
      btn?.addEventListener('click', () => {
        const nextState = !btn.classList.contains('active');
        btn.classList.toggle('active', nextState);
        btn.classList.toggle('btn-primary', nextState);
        btn.classList.toggle('btn-outline', !nextState);
        btn.textContent = nextState ? 'Active' : 'Bypass';
        WebBridge.setParam(paramId, nextState ? 1 : 0);
        if (nextState) {
          WebBridge.setParam(430, 1);
          masterBtn?.classList.add('active', 'btn-primary');
          masterBtn?.classList.remove('btn-outline');
          if (masterBtn) masterBtn.textContent = 'MASTER MFX: ON';
        }
      });
    };

    bindBypass('btn-mfx-delay-bypass', 431);
    bindBypass('btn-mfx-reverb-bypass', 437);

    root.querySelectorAll('.btn-reverb-room').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const room = parseInt(target.getAttribute('data-room') || '0', 10);
        WebBridge.setParam(439, room);
        root.querySelectorAll('.btn-reverb-room').forEach((b) => {
          const isAct = parseInt(b.getAttribute('data-room') || '0', 10) === room;
          b.classList.toggle('active', isAct);
          b.classList.toggle('btn-primary', isAct);
          b.classList.toggle('btn-outline', !isAct);
        });
      });
    });

    const bindSlider = (id: string, paramId: number, valId: string) => {
      const slider = root.querySelector(`#${id}`) as HTMLInputElement | null;
      const valDisplay = root.querySelector(`#${valId}`);
      slider?.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        if (valDisplay) valDisplay.textContent = String(val);
        WebBridge.setParam(paramId, val);
      });
    };

    bindSlider('mfx-delay-mix', 432, 'mfx-delay-mix-val');
    bindSlider('mfx-delay-ltime', 433, 'mfx-delay-ltime-val');
    bindSlider('mfx-delay-rtime', 434, 'mfx-delay-rtime-val');
    bindSlider('mfx-delay-fb', 435, 'mfx-delay-fb-val');
    bindSlider('mfx-delay-damp', 436, 'mfx-delay-damp-val');
    bindSlider('mfx-rev-mix', 438, 'mfx-rev-mix-val');
    bindSlider('mfx-rev-decay', 440, 'mfx-rev-decay-val');
    bindSlider('mfx-rev-diff', 441, 'mfx-rev-diff-val');
    bindSlider('mfx-rev-damp', 442, 'mfx-rev-damp-val');
    bindSlider('mfx-rev-detune', 443, 'mfx-rev-detune-val');
    bindSlider('mfx-rev-speed', 444, 'mfx-rev-speed-val');

    return root;
  }
}
