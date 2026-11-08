// ─────────────────────────────────────────────────────────
// ABDAxionikVS — SettingsDrawer.ts
// Panel deslizante para configuración global del sintetizador:
// - Polifonía SoundNumVoices [5] (1..12), SoundPan [3] (-64..+63), SoundPanKeyTrack [4] (-64..+63)
// - Rango de Pitch Bend [412] (0..12 st) y Función de Footswitch [411] (0..26)
// - Conmutador OracleClipToZeroMode (Musical Clean Clamp vs Legacy 0x1000bc40 Clip-to-Zero)
// - Ubicación de NeuronDB Library, Temas de color y escala de interfaz (Zoom)
// - Idioma de la interfaz (i18n EN / ES)
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { Knob } from '@abdsynths/shared/components';
import { gestureFor } from './paramGesture.js';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';
import { t, getLocale, setLocale, type Locale } from '../i18n/index.js';

export interface SettingsDrawerOptions {
  onClose: () => void;
  onConfigureFolder: (bank?: 'neuron' | 'axionik') => void;
  onSelectEngineMode?: (mode: 'classic' | 'plus' | 'expanded') => void;
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
    const curLocale = getLocale();

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
      { id: '1', label: t('navbar.zoom100') },
      { id: '1.25', label: t('navbar.zoom125') },
      { id: '1.5', label: t('navbar.zoom150') },
    ];
    const activeZoomId = Math.abs(curZoom - 1.5) < 0.05 ? '1.5' : Math.abs(curZoom - 1.25) < 0.05 ? '1.25' : '1';
    const zoomPillsHtml = pillSelectorHtml(zoomItems, activeZoomId, {
      id: 'settings-zoom-chips',
      size: 'sm',
      attrName: 'data-zoom',
    });

    const langItems = [
      { id: 'en', label: t('navbar.langEn') },
      { id: 'es', label: t('navbar.langEs') },
    ];
    const langPillsHtml = pillSelectorHtml(langItems, curLocale, {
      id: 'settings-lang-chips',
      size: 'sm',
      attrName: 'data-lang',
    });

    const footswitchItems = [
      { id: '0', label: t('settings.fsOptions.sustain') },
      { id: '1', label: t('settings.fsOptions.hold') },
      { id: '2', label: t('settings.fsOptions.slicer') },
      { id: '3', label: t('settings.fsOptions.silver') },
      { id: '4', label: t('settings.fsOptions.stick') },
      { id: '5', label: t('settings.fsOptions.tapTempo') },
    ];
    const footswitchPillsHtml = pillSelectorHtml(footswitchItems, String(curFootswitchDest), {
      id: 'settings-footswitch-chips',
      size: 'sm',
      attrName: 'data-dest',
    });

    const renderKnobCell = (mountId: string, valId: string, initialText: string | number, label: string) => `
      <div class="synth-knob-cell">
        <div id="${mountId}"></div>
        <span class="synth-knob-num stat-num" id="${valId}">${initialText}</span>
        <span class="synth-knob-title">${label}</span>
      </div>
    `;

    root.innerHTML = `
      <div class="drawer-header ndb-modal-header">
        <div class="drawer-title ndb-header-title">
          <span class="drawer-icon">${ICONS.settings}</span>
          <span class="ndb-title-text">${t('settings.drawerTitle')}</span>
        </div>
        <div class="drawer-header-actions">
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-settings-drawer" title="${t('common.close')} (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <div class="drawer-scroll-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); padding-right: 4px;">
        <!-- 1. Voice Polyphony, Pan & Performance Controls ([3, 4, 5, 411, 412]) -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">${t('settings.polyphonyCard')} ([3, 4, 5, 411, 412])</div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); justify-items: center; padding: var(--space-2) 0;">
            ${renderKnobCell('settings-voices-m', 'settings-voices-val', curVoices, `${t('settings.numVoicesLabel')} [5]`)}
            ${renderKnobCell('settings-pan-m', 'settings-pan-val', curPan, `${t('settings.soundPanLabel')} [3]`)}
            ${renderKnobCell('settings-pankt-m', 'settings-pankt-val', curPanKt, `${t('settings.panKeyTrackLabel')} [4]`)}
            ${renderKnobCell('settings-pb-m', 'settings-pb-val', `${curPbRange} st`, `${t('settings.pitchBendRangeLabel')} [412]`)}
          </div>

          <div style="display: flex; flex-direction: column; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--color-panel-border-dim);">
            <span class="hud-label">${t('settings.footswitchLabel')} [411]:</span>
            ${footswitchPillsHtml}
          </div>
        </div>

        <!-- 2. DSP Output Limiter Mode (OracleClipToZeroMode) -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; justify-content: space-between; align-items: center; gap: var(--space-3);">
          <div>
            <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">${t('settings.oracleCard')}</div>
            <p style="font-size: var(--text-xs); color: var(--color-text-muted); margin: 4px 0 0 0;">
              ${t('settings.oracleDesc')}
            </p>
          </div>
          <button type="button" class="btn btn-xs ${curOracleClip ? 'btn-primary active' : 'btn-outline'}" id="btn-settings-oracle-clip">
            ${curOracleClip ? t('settings.oracleModeLegacy') : t('settings.oracleModeModern')}
          </button>
        </div>

        <!-- 3. Language & Internationalization -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">${t('navbar.language').toUpperCase()} (i18n)</div>
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            ${langPillsHtml}
          </div>
        </div>

        <!-- 4. Appearance & Interface Scale -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">${t('settings.uiThemeCard')}</div>

          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <span class="hud-label">${t('settings.themeLabel').toUpperCase()}:</span>
            ${themePillsHtml}
          </div>

          <div style="display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2);">
            <span class="hud-label">${t('settings.zoomLabel').toUpperCase()}:</span>
            ${zoomPillsHtml}
          </div>
        </div>

        <!-- 5. NeuronDB & AxionikDB Library Configuration -->
        <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700;">${t('settings.libraryCard')} (NEURONDB V1 & AXIONIKDB V2)</div>
          <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin: 0;">
            ${t('settings.libraryDesc')}
          </p>
          <div style="display: flex; flex-wrap: wrap; gap: var(--space-2);">
            <button type="button" class="btn btn-xs btn-outline" id="btn-settings-config-folder">
              ${ICONS.folder} NeuronDB (Classic / Plus)
            </button>
            <button type="button" class="btn btn-xs btn-outline" id="btn-settings-config-axionik-folder">
              ${ICONS.folder} AxionikDB (Expanded v2)
            </button>
          </div>
        </div>
      </div>
    `;

    root.querySelector('#btn-close-settings-drawer')?.addEventListener('click', () => {
      options.onClose();
    });

    root.querySelector('#btn-settings-config-folder')?.addEventListener('click', () => {
      options.onConfigureFolder('neuron');
    });

    root.querySelector('#btn-settings-config-axionik-folder')?.addEventListener('click', () => {
      options.onConfigureFolder('axionik');
    });

    const oracleBtn = root.querySelector('#btn-settings-oracle-clip') as HTMLButtonElement | null;
    oracleBtn?.addEventListener('click', () => {
      const current = WebBridge.getUIState<boolean>('oracleClipMode', false);
      const next = !current;
      WebBridge.setOracleClipMode(next);
      if (oracleBtn) {
        oracleBtn.textContent = next ? t('settings.oracleModeLegacy') : t('settings.oracleModeModern');
        oracleBtn.classList.toggle('btn-primary', next);
        oracleBtn.classList.toggle('active', next);
        oracleBtn.classList.toggle('btn-outline', !next);
      }
    });

    const langContainer = root.querySelector('#settings-lang-chips') as HTMLElement | null;
    if (langContainer) {
      bindPillSelector(langContainer, (val) => {
        if (val === 'en' || val === 'es') {
          setLocale(val as Locale);
        }
      }, 'data-lang');
    }

    const themeContainer = root.querySelector('#settings-theme-chips') as HTMLElement | null;
    if (themeContainer) {
      bindPillSelector(themeContainer, (val) => {
        options.onSelectTheme(val);
      }, 'data-theme');
    }

    const zoomContainer = root.querySelector('#settings-zoom-chips') as HTMLElement | null;
    if (zoomContainer) {
      bindPillSelector(zoomContainer, (val) => {
        const zoomVal = parseFloat(val);
        if (!isNaN(zoomVal)) {
          options.onZoom(zoomVal);
        }
      }, 'data-zoom');
    }

    const footswitchContainer = root.querySelector('#settings-footswitch-chips') as HTMLElement | null;
    if (footswitchContainer) {
      bindPillSelector(footswitchContainer, (val) => {
        const dest = parseInt(val, 10);
        if (!isNaN(dest)) {
          WebBridge.setParam(ParamIdx.FootSwitchDest, dest);
        }
      }, 'data-dest');
    }

    setTimeout(() => {
      const voicesMount = root.querySelector('#settings-voices-m') as HTMLElement | null;
      const voicesVal = root.querySelector('#settings-voices-val') as HTMLElement | null;
      if (voicesMount) {
        voicesMount.setAttribute('data-param-index', String(ParamIdx.SoundNumVoices));
        const normInit = (curVoices - 1) / (12 - 1);
        new Knob(voicesMount, {
          size: 40,
          value: normInit,
          label: 'VOICES',
          ...gestureFor(ParamIdx.SoundNumVoices),
          onChange: (normVal: number) => {
            const v = Math.round(1 + normVal * (12 - 1));
            if (voicesVal) voicesVal.textContent = String(v);
            WebBridge.setParam(ParamIdx.SoundNumVoices, v);
          },
        });
      }

      const panMount = root.querySelector('#settings-pan-m') as HTMLElement | null;
      const panVal = root.querySelector('#settings-pan-val') as HTMLElement | null;
      if (panMount) {
        panMount.setAttribute('data-param-index', String(ParamIdx.SoundPan));
        const normInit = (curPan + 64) / 127.0;
        new Knob(panMount, {
          size: 40,
          value: normInit,
          bipolar: true,
          label: 'PAN',
          ...gestureFor(ParamIdx.SoundPan),
          onChange: (normVal: number) => {
            const v = Math.round(-64 + normVal * 127.0);
            if (panVal) panVal.textContent = (v > 0 ? `+${v}` : String(v));
            WebBridge.setParam(ParamIdx.SoundPan, v);
          },
        });
      }

      const panKtMount = root.querySelector('#settings-pankt-m') as HTMLElement | null;
      const panKtVal = root.querySelector('#settings-pankt-val') as HTMLElement | null;
      if (panKtMount) {
        panKtMount.setAttribute('data-param-index', String(ParamIdx.SoundPanKeyTrack));
        const normInit = (curPanKt + 64) / 127.0;
        new Knob(panKtMount, {
          size: 40,
          value: normInit,
          bipolar: true,
          label: 'KEYTRACK',
          ...gestureFor(ParamIdx.SoundPanKeyTrack),
          onChange: (normVal: number) => {
            const v = Math.round(-64 + normVal * 127.0);
            if (panKtVal) panKtVal.textContent = (v > 0 ? `+${v}` : String(v));
            WebBridge.setParam(ParamIdx.SoundPanKeyTrack, v);
          },
        });
      }

      const pbMount = root.querySelector('#settings-pb-m') as HTMLElement | null;
      const pbVal = root.querySelector('#settings-pb-val') as HTMLElement | null;
      if (pbMount) {
        pbMount.setAttribute('data-param-index', String(ParamIdx.PitchBendRange));
        const normInit = curPbRange / 12.0;
        new Knob(pbMount, {
          size: 40,
          value: normInit,
          label: 'PITCH BEND',
          ...gestureFor(ParamIdx.PitchBendRange),
          onChange: (normVal: number) => {
            const v = Math.round(normVal * 12.0);
            if (pbVal) pbVal.textContent = `${v} st`;
            WebBridge.setParam(ParamIdx.PitchBendRange, v);
          },
        });
      }
    }, 0);

    return root;
  }
}
