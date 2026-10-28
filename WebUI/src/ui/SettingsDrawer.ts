// ─────────────────────────────────────────────────────────
// ABDAxionikVS — SettingsDrawer.ts
// Panel deslizante para configuración global del sintetizador:
// - Polifonía SoundNumVoices [5] (1..12), SoundPan [3] (-64..+63), SoundPanKeyTrack [4] (-64..+63)
// - Rango de Pitch Bend [412] (0..12 st) y Función de Footswitch [411] (0..26)
// - Conmutador OracleClipToZeroMode (Musical Clean Clamp vs Legacy 0x1000bc40 Clip-to-Zero)
// - Ubicación de NeuronDB Library, Temas de color y escala de interfaz (Zoom)
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';

export interface SettingsDrawerOptions {
  onClose: () => void;
  onConfigureFolder: () => void;
  onSelectTheme: (theme: string) => void;
  onZoom: (zoom: number) => void;
  currentTheme?: string;
  currentZoom?: number;
}

export class SettingsDrawer {
  public static createContent(options: SettingsDrawerOptions): HTMLElement {
    const root = document.createElement('div');
    root.className = 'drawer-view-content';
    root.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-4); height: 100%;';

    const curVoices = Math.max(1, Math.min(12, Math.round(WebBridge.getParam(ParamIdx.SoundNumVoices, 8))));
    const curPan = Math.round(WebBridge.getParam(ParamIdx.SoundPan, 0));
    const curPanKt = Math.round(WebBridge.getParam(ParamIdx.SoundPanKeyTrack, 0));
    const curPbRange = Math.round(WebBridge.getParam(ParamIdx.PitchBendRange, 2));
    const curFootswitchDest = Math.round(WebBridge.getParam(ParamIdx.FootSwitchDest, 0));
    const curOracleClip = WebBridge.getUIState<boolean>('oracleClipMode', false);
    const curZoom = options.currentZoom ?? 1.0;
    const curTheme = options.currentTheme ?? 'ms2000';

    const themeItems = [
      { id: 'ms2000', label: 'MS2000 (Default Dark Cyan)', theme: 'ms2000' },
      { id: 'audiolab', label: 'AudioLab (Pro Dark Slate)', theme: 'audiolab' },
      { id: 'audiolab-light', label: 'AudioLab Light (Laboratory)', theme: 'audiolab-light' },
      { id: 'advanced', label: 'Advanced (Orange Contrast)', theme: 'advanced' },
      { id: 'cz101', label: 'CZ101 (Classic Teal & Red)', theme: 'cz101' },
    ];
    const themePillsHtml = pillSelectorHtml(themeItems, curTheme, {
      id: 'settings-theme-chips',
      size: 'sm',
      attrName: 'data-theme',
    });

    const zoomItems = [
      { id: '1', label: '100% (Normal)' },
      { id: '1.25', label: '125% (Medium)' },
      { id: '1.5', label: '150% (Large)' },
    ];
    const activeZoomId = Math.abs(curZoom - 1.5) < 0.05 ? '1.5' : Math.abs(curZoom - 1.25) < 0.05 ? '1.25' : '1';
    const zoomPillsHtml = pillSelectorHtml(zoomItems, activeZoomId, {
      id: 'settings-zoom-chips',
      size: 'sm',
      attrName: 'data-zoom',
    });

    const footswitchItems = [
      { id: '0', label: '0: Sustain (Damper Pedal)' },
      { id: '1', label: '1: Hold Active Notes' },
      { id: '2', label: '2: Slicer LFO On / Off' },
      { id: '3', label: '3: Silver Rack On / Off' },
      { id: '4', label: '4: Stick Playback Start / Stop' },
      { id: '5', label: '5: Tap Tempo Sync' },
    ];
    const footswitchPillsHtml = pillSelectorHtml(footswitchItems, String(curFootswitchDest), {
      id: 'settings-footswitch-chips',
      size: 'sm',
      attrName: 'data-dest',
    });

    root.innerHTML = `
      <div class="drawer-header ndb-modal-header">
        <div class="drawer-title ndb-header-title">
          <span class="drawer-icon">${ICONS.settings}</span>
          <span class="ndb-title-text">GLOBAL SETTINGS & PREFERENCES</span>
        </div>
        <div class="drawer-header-actions">
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-settings-drawer" title="Close (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <div class="drawer-scroll-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); padding-right: 4px;">
        <!-- 1. Voice Polyphony, Pan & Performance Controls ([3, 4, 5, 411, 412]) -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">POLYPHONY, STEREO PAN & PERFORMANCE ([3, 4, 5, 411, 412])</div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); align-items: center;">
            <div>
              <div style="display: flex; justify-content: space-between;">
                <span class="hud-label">NUM VOICES [5]:</span>
                <span class="hud-value stat-num" id="settings-voices-val">${curVoices}</span>
              </div>
              <input type="range" id="settings-voices-slider" class="abd-slider" min="1" max="12" value="${curVoices}" step="1" style="width: 100%;" />
            </div>

            <div>
              <div style="display: flex; justify-content: space-between;">
                <span class="hud-label">SOUND PAN [3]:</span>
                <span class="hud-value stat-num" id="settings-pan-val">${curPan}</span>
              </div>
              <input type="range" id="settings-pan-slider" class="abd-slider" min="-64" max="63" value="${curPan}" step="1" style="width: 100%;" />
            </div>

            <div>
              <div style="display: flex; justify-content: space-between;">
                <span class="hud-label">PAN KEYTRACK [4]:</span>
                <span class="hud-value stat-num" id="settings-pankt-val">${curPanKt}</span>
              </div>
              <input type="range" id="settings-pankt-slider" class="abd-slider" min="-64" max="63" value="${curPanKt}" step="1" style="width: 100%;" />
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px; padding-top: var(--space-2); border-top: 1px solid var(--color-panel-border-dim);">
            <div style="display: flex; justify-content: space-between; max-width: 320px;">
              <span class="hud-label">PITCH BEND RANGE [412]:</span>
              <span class="hud-value stat-num" id="settings-pb-val">${curPbRange} st</span>
            </div>
            <input type="range" id="settings-pb-slider" class="abd-slider" min="0" max="12" value="${curPbRange}" step="1" style="max-width: 320px;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--color-panel-border-dim);">
            <span class="hud-label">FOOTSWITCH ASSIGN [411]:</span>
            ${footswitchPillsHtml}
          </div>
        </div>

        <!-- 2. DSP Output Limiter Mode (OracleClipToZeroMode) -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; justify-content: space-between; align-items: center; gap: var(--space-3);">
          <div>
            <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">OUTPUT LIMITER MODE (0x1000bc40)</div>
            <p style="font-size: var(--text-xs); color: var(--color-text-muted); margin: 4px 0 0 0;">
              Clean Clamp [-1.0..+1.0] (Default) prevents digital zero-dropouts. Enable Oracle Clip-to-Zero only for strict legacy binary inspection.
            </p>
          </div>
          <label style="font-size: var(--text-xs); display: flex; align-items: center; gap: 6px; white-space: nowrap; cursor: pointer;">
            <input type="checkbox" id="settings-oracle-clip" ${curOracleClip ? 'checked' : ''} /> Oracle Clip-to-Zero
          </label>
        </div>

        <!-- 3. NeuronDB Library Configuration -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">NEURONDB LIBRARY STORAGE</div>
          <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin: 0;">
            Configure the local filesystem path containing the official Hartmann NeuronDB models (000..511) and presets.
          </p>
          <div style="display: flex; gap: var(--space-2);">
            <button type="button" class="btn btn-xs btn-outline" id="btn-settings-config-folder">
              ${ICONS.folder} Configure Library Folder...
            </button>
          </div>
        </div>

        <!-- 4. Appearance & Interface Scale -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">APPEARANCE & DISPLAY</div>

          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <span class="hud-label">COLOR THEME:</span>
            ${themePillsHtml}
          </div>

          <div style="display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2);">
            <span class="hud-label">UI ZOOM SCALE:</span>
            ${zoomPillsHtml}
          </div>
        </div>
      </div>
    `;

    root.querySelector('#btn-close-settings-drawer')?.addEventListener('click', () => {
      options.onClose();
    });

    const bindSlider = (id: string, paramId: number, valId: string, suffix = '') => {
      const slider = root.querySelector(`#${id}`) as HTMLInputElement | null;
      const valEl = root.querySelector(`#${valId}`);
      slider?.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        if (valEl) valEl.textContent = `${val}${suffix}`;
        WebBridge.setParam(paramId, val);
      });
    };

    bindSlider('settings-voices-slider', 5, 'settings-voices-val');
    bindSlider('settings-pan-slider', 3, 'settings-pan-val');
    bindSlider('settings-pankt-slider', 4, 'settings-pankt-val');
    bindSlider('settings-pb-slider', 412, 'settings-pb-val', ' st');

    const footContainer = root.querySelector('#settings-footswitch-chips') as HTMLElement | null;
    if (footContainer) {
      bindPillSelector(footContainer, (destStr, btn) => {
        if (destStr != null) {
          const dest = parseInt(destStr, 10);
          WebBridge.setParam(ParamIdx.FootSwitchDest, dest);
          footContainer.querySelectorAll('.abd-pill, .ndb-chip').forEach((c) => c.classList.remove('active'));
          btn.classList.add('active');
        }
      }, 'data-dest');
    }

    const clipCheck = root.querySelector('#settings-oracle-clip') as HTMLInputElement | null;
    clipCheck?.addEventListener('change', () => {
      WebBridge.setOracleClipMode(clipCheck.checked);
    });

    root.querySelector('#btn-settings-config-folder')?.addEventListener('click', () => {
      options.onConfigureFolder();
    });

    const themeContainer = root.querySelector('#settings-theme-chips') as HTMLElement | null;
    if (themeContainer) {
      bindPillSelector(themeContainer, (theme, btn) => {
        if (theme) {
          options.onSelectTheme(theme);
          themeContainer.querySelectorAll('.abd-pill, .ndb-chip').forEach((c) => c.classList.remove('active'));
          btn.classList.add('active');
        }
      }, 'data-theme');
    }

    const zoomContainer = root.querySelector('#settings-zoom-chips') as HTMLElement | null;
    if (zoomContainer) {
      bindPillSelector(zoomContainer, (zoomStr, btn) => {
        const zoom = parseFloat(zoomStr || '1.0');
        options.onZoom(zoom);
        zoomContainer.querySelectorAll('.abd-pill, .ndb-chip').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
      }, 'data-zoom');
    }

    return root;
  }
}
