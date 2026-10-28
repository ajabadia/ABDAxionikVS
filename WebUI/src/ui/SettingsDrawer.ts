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

    const curVoices = Math.max(1, Math.min(12, Math.round(WebBridge.getParam(5, 8))));
    const curPan = Math.round(WebBridge.getParam(3, 0));
    const curPanKt = Math.round(WebBridge.getParam(4, 0));
    const curPbRange = Math.round(WebBridge.getParam(412, 2));
    const curFootswitchDest = Math.round(WebBridge.getParam(411, 0));
    const curOracleClip = WebBridge.getUIState<boolean>('oracleClipMode', false);

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

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); align-items: center; padding-top: var(--space-2); border-top: 1px solid var(--color-panel-border-dim);">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between;">
                <span class="hud-label">PITCH BEND RANGE [412]:</span>
                <span class="hud-value stat-num" id="settings-pb-val">${curPbRange} st</span>
              </div>
              <input type="range" id="settings-pb-slider" class="abd-slider" min="0" max="12" value="${curPbRange}" step="1" style="width: 100%;" />
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span class="hud-label">FOOTSWITCH ASSIGN [411]:</span>
              <select id="settings-foot-select" class="abd-select__field" style="width: 100%; height: 28px;">
                <option value="0" ${curFootswitchDest === 0 ? 'selected' : ''}>0: Sustain (Damper Pedal)</option>
                <option value="1" ${curFootswitchDest === 1 ? 'selected' : ''}>1: Hold Active Notes</option>
                <option value="2" ${curFootswitchDest === 2 ? 'selected' : ''}>2: Slicer LFO On / Off</option>
                <option value="3" ${curFootswitchDest === 3 ? 'selected' : ''}>3: Silver Rack On / Off</option>
                <option value="4" ${curFootswitchDest === 4 ? 'selected' : ''}>4: Stick Playback Start / Stop</option>
                <option value="5" ${curFootswitchDest === 5 ? 'selected' : ''}>5: Tap Tempo Sync</option>
              </select>
            </div>
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
            <div class="ndb-chips-row" style="flex-wrap: wrap; gap: var(--space-2);" id="settings-theme-chips">
              <button type="button" class="ndb-chip" data-theme="ms2000">MS2000 (Default Dark Cyan)</button>
              <button type="button" class="ndb-chip" data-theme="audiolab">AudioLab (Pro Dark Slate)</button>
              <button type="button" class="ndb-chip" data-theme="audiolab-light">AudioLab Light (Laboratory)</button>
              <button type="button" class="ndb-chip" data-theme="advanced">Advanced (Orange Contrast)</button>
              <button type="button" class="ndb-chip" data-theme="cz101">CZ101 (Classic Teal & Red)</button>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2);">
            <span class="hud-label">UI ZOOM SCALE:</span>
            <div class="ndb-chips-row" style="gap: var(--space-2);" id="settings-zoom-chips">
              <button type="button" class="ndb-chip" data-zoom="1.0">100% (Normal)</button>
              <button type="button" class="ndb-chip" data-zoom="1.25">125% (Medium)</button>
              <button type="button" class="ndb-chip" data-zoom="1.5">150% (Large)</button>
            </div>
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

    const footSelect = root.querySelector('#settings-foot-select') as HTMLSelectElement | null;
    footSelect?.addEventListener('change', () => {
      WebBridge.setParam(411, parseInt(footSelect.value, 10));
    });

    const clipCheck = root.querySelector('#settings-oracle-clip') as HTMLInputElement | null;
    clipCheck?.addEventListener('change', () => {
      WebBridge.setOracleClipMode(clipCheck.checked);
    });

    root.querySelector('#btn-settings-config-folder')?.addEventListener('click', () => {
      options.onConfigureFolder();
    });

    root.querySelectorAll('#settings-theme-chips [data-theme]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const theme = target.getAttribute('data-theme');
        if (theme) {
          options.onSelectTheme(theme);
          root.querySelectorAll('#settings-theme-chips [data-theme]').forEach((c) => c.classList.remove('active'));
          target.classList.add('active');
        }
      });
    });

    root.querySelectorAll('#settings-zoom-chips [data-zoom]').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const zoom = parseFloat(target.getAttribute('data-zoom') || '1.0');
        options.onZoom(zoom);
        root.querySelectorAll('#settings-zoom-chips [data-zoom]').forEach((c) => c.classList.remove('active'));
        target.classList.add('active');
      });
    });

    return root;
  }
}
