/**
 * ABDAxionikVS — TopLcdBar.ts
 * Fase C: Pantalla LCD Panorámica Fija Superior y Monitor de Telemetría (12 Columnas / 2 Filas).
 *
 * - Ubicada justo debajo de la SynthNavBar, ocupando todo el ancho (100%), con el mismo
 *   fondo que la barra de navegación (`var(--navbar-bg)` + `backdrop-filter: blur(8px)`),
 *   fija (`flex-shrink: 0`), no colapsable e inmune al scroll vertical.
 * - Alineada a la rejilla de 12 columnas (`.synth-row` con 3 bloques `.col-span-2` de 4/12 columnas)
 *   para mantener paridad responsive exacta con los paneles inferiores:
 *   1. Izquierda (`col-span-2`): **Resynator 1**
 *      - Fila 1: Pantalla LCD `createLcdScreen` (`C_GraphEditor #12/#13`, `C_PadGrid #0` X/Y y `C_Knob #0 R1Volume`).
 *      - Fila 2: Las **3 mini-pantallas gráficas ADSR `66×22 px`** simultáneas de R1 (`C_DisplayButton #1 R1 AMP`, `#0 R1 RES`, `#2 R1 FREE`).
 *   2. Centro (`col-span-2`): **Resynator 2**
 *      - Fila 1: Pantalla LCD `createLcdScreen` (`C_GraphEditor #39/#40`, `C_PadGrid #1` X/Y y `C_Knob #1 R2Volume`).
 *      - Fila 2: Las **3 mini-pantallas gráficas ADSR `66×22 px`** simultáneas de R2 (`C_DisplayButton #4 R2 AMP`, `#3 R2 RES`, `#5 R2 FREE`).
 *   3. Derecha (`col-span-2`): **Consola LCD Principal (`createLcdPanel`) + Silver + Telemetría**
 *      - Fila 1: 8 botones de página + Pantalla Central Interactiva (`createLcdPanel`: `LcdScreen` + `LcdMachine` + D-pad de 6 botones) + `NavigationStick` digital de 4 vías + `ENT`.
 *      - Fila 2: **7ª mini-pantalla ADSR `66×22 px`** (`C_DisplayButton #6 FLT ENV [355..358]`) + Pantalla LCD de `Silver & Multi-FX` (`createLcdScreen`, `C_PadGrid #2`) + Telemetría NRPN/SysEx y steppers de preset.
 */

import { createLcdPanel, createLcdScreen, buildWriteCompletedNotice } from '@abdsynths/shared/components';
import { WebBridge } from '../bridge/WebBridge.js';
import { PARAM_DEFINITIONS, type ParamDefinition } from '../generated/parameters.gen.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { FREQ_ALGO_NAMES, TIME_ALGO_NAMES } from './SilverPanel.js';

export interface TopLcdBarCallbacks {
  onOpenBankPresets?: () => void;
  onOpenBankModels?: (resynator: 1 | 2) => void;
  onOpenR1Drawer?: () => void;
  onOpenR2Drawer?: () => void;
  onOpenBlenderDrawer?: () => void;
  onOpenSilverDrawer?: () => void;
  onOpenEnvelopeDrawer?: () => void;
  onOpenMatrixDrawer?: () => void;
  onSelectPresetSlot?: (slot: number) => void;
  onInitSound?: () => void;
  onSelectAdsrTarget?: (shaper: 1 | 2 | 3, mode: 'amp' | 'res' | 'free' | 'filter') => void;
}

interface LcdMenuItem {
  label: string;
  paramIdx?: number;
  type?: 'parameter' | 'action';
  actionId?: string;
  choices?: string[];
  sub?: LcdMenuItem[];
}

interface MiniAdsrRefs {
  boxEl: HTMLElement | null;
  halo: SVGPolylineElement | null;
  core: SVGPolylineElement | null;
  valText: HTMLElement | null;
  baseParamIdx: number;
  label: string;
  defaultAdsr: [number, number, number, number];
  shaper: 1 | 2 | 3;
  mode: 'amp' | 'res' | 'free' | 'filter';
}

const FILTER_CURVE_NAMES = ['24dB LP', '12dB LP', '6dB LP', 'BandPass', 'HighPass'];
const BLENDER_SHORT_NAMES = [
  'Mix', 'Chromo', 'TransSph', 'CrossMrp', 'InterMrp',
  'DynTrans', 'DynCross', 'VelCross', 'VelChrom', 'RingBlnd',
];
const SLICER_MODE_NAMES = ['OFF', '2D VERT', '3D SPAT'];
const LFO_WAVE_NAMES = [
  'Sine', 'Triangle', 'Saw Up', 'Saw Down', 'Square', 'Pos Tri',
  'Pos Sin', 'Pos Sqr', 'Step 4', 'Step 8', 'S&H', 'Random',
];

const FREQ_FX_SHORT = ['EQ/CMP', 'DIST', 'RINGMD', 'DECIM', 'SPWARP'];
const TIME_FX_SHORT = ['SPREAD', 'LR DLY', 'FLANGR', 'PHASER', 'CHORUS'];

/**
 * Formatea un valor según la regla exacta de `C_GraphEditor` (`FUN_10015910`):
 * - Rango unipolar (`min >= 0`): `"%03i"` (ej. `000`, `064`, `100`)
 * - Rango bipolar (`min < 0 < max`): `"%+02.2i"` (ej. `+00`, `-12`, `+63`)
 */
export function formatGraphEditorValue(val: number, min: number, max: number, choices?: string[]): string {
  const rounded = Math.round(val);
  if (choices && choices[rounded] !== undefined) {
    return `${String(rounded).padStart(2, '0')}:${choices[rounded]}`;
  }
  const isBipolar = min < 0 && max > 0;
  if (isBipolar) {
    const sign = rounded >= 0 ? '+' : '-';
    const absStr = String(Math.abs(rounded)).padStart(2, '0');
    return `${sign}${absStr}`;
  }
  return String(Math.max(0, rounded)).padStart(3, '0');
}

/**
 * Calcula los 5 vértices exactos de la mini-pantalla ADSR `66×22` (`FUN_10018220`):
 * - `A, D, R` escalados a `0..15 px` (`norm * 15`)
 * - `S` escalado a `0..18 px` (`norm * 18`)
 * - `P0 = (1, 21)`
 * - `P1 = (1 + A, 1)`
 * - `P2 = (2 + A + D, 20 - S)`
 * - `P3 = (13 + A + D, 20 - S)`
 * - `P4 = (14 + A + D + R, 21)`
 */
export function computeMiniAdsrPoints(
  aNorm: number,
  dNorm: number,
  sNorm: number,
  rNorm: number,
  isRepeat: boolean = false
): string {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
  const A = Math.round(clamp01(aNorm) * 15);
  const D = Math.round(clamp01(dNorm) * 15);
  const S = Math.round(clamp01(sNorm) * 18);
  const R = Math.round(clamp01(rNorm) * 15);

  const p0x = 1;
  const p0y = 21;
  const p1x = 1 + A;
  const p1y = 1;
  const p2x = 2 + A + D;
  const p2y = 20 - S;
  const p3x = 13 + A + D;
  const p3y = 20 - S;
  const p4x = 14 + A + D + R;
  const p4y = 21;

  if (isRepeat) {
    const midPeakX = Math.round((p2x + p3x) * 0.5);
    return `${p0x},${p0y} ${p1x},${p1y} ${p2x},${p2y} ${midPeakX},${p1y} ${p3x},${p3y} ${p4x},${p4y}`;
  }

  return `${p0x},${p0y} ${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}`;
}

export class TopLcdBar {
  private container: HTMLElement;
  private callbacks: TopLcdBarCallbacks;

  // 4 pantallas LCD de @abdsynths/shared/components:
  // 1) Resynator 1 (izquierda)
  // 2) Resynator 2 (centro)
  // 3) Consola Principal Interactiva createLcdPanel (derecha fila 1)
  // 4) Silver & Multi-FX (derecha fila 2)
  private r1Screen: ReturnType<typeof createLcdScreen> | null = null;
  private r2Screen: ReturnType<typeof createLcdScreen> | null = null;
  private centerPanel: ReturnType<typeof createLcdPanel> | null = null;
  private silverScreen: ReturnType<typeof createLcdScreen> | null = null;

  // Las 7 mini-pantallas ADSR 66×22 de NeuronVS.dll (C_DisplayButton #0..#6, FUN_10018220)
  private miniAdsrDisplays: MiniAdsrRefs[] = [];

  private nrpnBadgeEl: HTMLElement | null = null;
  private stickRecBadgeEl: HTMLElement | null = null;
  private pageButtons: Map<string, HTMLButtonElement> = new Map();

  // Estado vivo
  private currentPresetSlot: number = 0;
  private currentPresetName: string = '000 InitSound';
  private r1ModelSlot: number = 511;
  private r1ModelName: string = 'sinew';
  private r2ModelSlot: number = 511;
  private r2ModelName: string = 'sinew';
  private activeVoices: number = 0;
  private lastTouchedParamIdx: number = ParamIdx.FilterFreq;

  private paramMap: Map<number, ParamDefinition> = new Map();
  private menuTree: LcdMenuItem[] = [];

  constructor(container: HTMLElement, callbacks: TopLcdBarCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    for (const def of PARAM_DEFINITIONS) {
      this.paramMap.set(def.index, def);
    }
    this.menuTree = this.buildMenuTree();
    this.mount();
  }

  private buildMenuTree(): LcdMenuItem[] {
    return [
      {
        label: 'SOUND & GLOBAL',
        sub: [
          { label: 'VOICE LIMIT', paramIdx: ParamIdx.SoundNumVoices },
          { label: 'MASTER PAN', paramIdx: ParamIdx.SoundPan },
          { label: 'PAN KEYTRK', paramIdx: ParamIdx.SoundPanKeyTrack },
          { label: 'PITCHBEND RNG', paramIdx: ParamIdx.PitchBendRange },
          { label: 'BROWSE PRESETS', type: 'action', actionId: 'BROWSE_PRESETS' },
          { label: 'INIT SOUND', type: 'action', actionId: 'INIT_SOUND' },
        ],
      },
      {
        label: 'RESYNATOR 1',
        sub: [
          { label: 'R1 SWITCH', paramIdx: ParamIdx.R1Switch, choices: ['OFF', 'ON'] },
          { label: 'R1 MODEL SLOT', paramIdx: ParamIdx.R1ModellIndex },
          { label: 'R1 DOMAIN', paramIdx: ParamIdx.R1Type, choices: ['SPHERE', 'SCAPE'] },
          { label: 'R1 PARAM LVL', paramIdx: ParamIdx.R1ParamLevel, choices: ['L1', 'L2', 'L3'] },
          { label: 'R1 VOLUME', paramIdx: ParamIdx.R1Volume },
          { label: 'R1 OCTAVE', paramIdx: ParamIdx.R1Octave },
          { label: 'R1 SEMI', paramIdx: ParamIdx.R1Semi },
          { label: 'R1 CENTS', paramIdx: ParamIdx.R1Cents },
          { label: 'R1 L1 SPH X', paramIdx: ParamIdx.R1L1Sphere1Value },
          { label: 'R1 L1 SPH Y', paramIdx: ParamIdx.R1L1Sphere2Value },
          { label: 'R1 L1 SCP X', paramIdx: ParamIdx.R1L1Scape1Value },
          { label: 'R1 L1 SCP Y', paramIdx: ParamIdx.R1L1Scape2Value },
        ],
      },
      {
        label: 'BLENDER & SLICER',
        sub: [
          { label: 'BLENDER ALGO', paramIdx: ParamIdx.BlenderType, choices: BLENDER_SHORT_NAMES },
          { label: 'BLENDER AMT', paramIdx: ParamIdx.BlenderAmount },
          { label: 'BLD LFO DEPTH', paramIdx: ParamIdx.BlenderLfoDepth },
          { label: 'SLICER MODE', paramIdx: ParamIdx.SlicerSwitchType, choices: SLICER_MODE_NAMES },
          { label: 'SLICER RATE', paramIdx: ParamIdx.SlicerRate },
          { label: 'SLICER DEPTH', paramIdx: ParamIdx.SlicerDepth },
          { label: 'SLICER WAVE', paramIdx: ParamIdx.SlicerWaveForm, choices: LFO_WAVE_NAMES },
        ],
      },
      {
        label: 'RESYNATOR 2',
        sub: [
          { label: 'R2 SWITCH', paramIdx: ParamIdx.R2Switch, choices: ['OFF', 'ON'] },
          { label: 'R2 MODEL SLOT', paramIdx: ParamIdx.R2ModellIndex },
          { label: 'R2 DOMAIN', paramIdx: ParamIdx.R2Type, choices: ['SPHERE', 'SCAPE'] },
          { label: 'R2 PARAM LVL', paramIdx: ParamIdx.R2ParamLevel, choices: ['L1', 'L2', 'L3'] },
          { label: 'R2 VOLUME', paramIdx: ParamIdx.R2Volume },
          { label: 'R2 OCTAVE', paramIdx: ParamIdx.R2Octave },
          { label: 'R2 SEMI', paramIdx: ParamIdx.R2Semi },
          { label: 'R2 CENTS', paramIdx: ParamIdx.R2Cents },
          { label: 'R2 L1 SPH X', paramIdx: ParamIdx.R2L1Sphere1Value },
          { label: 'R2 L1 SPH Y', paramIdx: ParamIdx.R2L1Sphere2Value },
          { label: 'R2 L1 SCP X', paramIdx: ParamIdx.R2L1Scape1Value },
          { label: 'R2 L1 SCP Y', paramIdx: ParamIdx.R2L1Scape2Value },
        ],
      },
      {
        label: 'SILVER & FILTER',
        sub: [
          { label: 'SILVER SWITCH', paramIdx: ParamIdx.SilverSwitch, choices: ['OFF', 'ON'] },
          { label: 'FILTER TYPE', paramIdx: ParamIdx.FilterType, choices: FILTER_CURVE_NAMES },
          { label: 'FILTER CUTOFF', paramIdx: ParamIdx.FilterFreq },
          { label: 'FILTER RESO', paramIdx: ParamIdx.FilterReso },
          { label: 'FILT ENV DPTH', paramIdx: ParamIdx.FilterEnvDepth },
          { label: 'FREQ FX ON', paramIdx: ParamIdx.FreqFXSwitch, choices: ['OFF', 'ON'] },
          { label: 'FREQ FX ALGO', paramIdx: ParamIdx.CurFreqFX, choices: FREQ_ALGO_NAMES },
          { label: 'TIME FX ON', paramIdx: ParamIdx.TimeFXSwitch, choices: ['OFF', 'ON'] },
          { label: 'TIME FX ALGO', paramIdx: ParamIdx.CurTimeFX, choices: TIME_ALGO_NAMES },
        ],
      },
      {
        label: 'SHAPERS & LFO',
        sub: [
          { label: 'R1 AMP ATTACK', paramIdx: ParamIdx.R1AmpEnvA },
          { label: 'R1 AMP DECAY', paramIdx: ParamIdx.R1AmpEnvD },
          { label: 'R1 AMP SUSTN', paramIdx: ParamIdx.R1AmpEnvS },
          { label: 'R1 AMP RELEAS', paramIdx: ParamIdx.R1AmpEnvR },
          { label: 'R2 AMP ATTACK', paramIdx: ParamIdx.R2AmpEnvA },
          { label: 'R2 AMP DECAY', paramIdx: ParamIdx.R2AmpEnvD },
          { label: 'R2 AMP SUSTN', paramIdx: ParamIdx.R2AmpEnvS },
          { label: 'R2 AMP RELEAS', paramIdx: ParamIdx.R2AmpEnvR },
          { label: 'FILT ATTACK', paramIdx: ParamIdx.FilterEnvA },
          { label: 'FILT DECAY', paramIdx: ParamIdx.FilterEnvD },
          { label: 'FILT SUSTAIN', paramIdx: ParamIdx.FilterEnvS },
          { label: 'FILT RELEASE', paramIdx: ParamIdx.FilterEnvR },
          { label: 'LFO SWITCH', paramIdx: ParamIdx.LFOSwitch, choices: ['OFF', 'ON'] },
          { label: 'LFO WAVEFORM', paramIdx: ParamIdx.LFOWaveForm, choices: LFO_WAVE_NAMES },
          { label: 'LFO RATE', paramIdx: ParamIdx.LFORate },
          { label: 'LFO DEPTH', paramIdx: ParamIdx.LFODepth },
        ],
      },
      {
        label: 'MOD & NUKE',
        sub: [
          { label: 'NUKE KNOB 1', paramIdx: ParamIdx.Knob1R1Select },
          { label: 'NUKE KNOB 2', paramIdx: ParamIdx.Knob2R1Select },
          { label: 'NUKE KNOB 3', paramIdx: ParamIdx.Knob3R1Select },
          { label: 'NUKE KNOB 4', paramIdx: ParamIdx.Knob4R1Select },
          { label: 'MODWHL DEPTH', paramIdx: ParamIdx.ModulationScale },
          { label: 'AFTERT DEPTH', paramIdx: ParamIdx.AftertouchScale },
          { label: 'BREATH DEPTH', paramIdx: ParamIdx.BreathScale },
          { label: 'EXPRES DEPTH', paramIdx: ParamIdx.ExpressionScale },
          { label: 'OPEN MATRIX', type: 'action', actionId: 'OPEN_MATRIX' },
        ],
      },
      {
        label: 'MASTER FX',
        sub: [
          { label: 'MASTER FX ON', paramIdx: ParamIdx.SoundMFXSwitch, choices: ['OFF', 'ON'] },
          { label: 'DELAY ON', paramIdx: ParamIdx.SoundMFXDelaySwitch, choices: ['OFF', 'ON'] },
          { label: 'DELAY MIX', paramIdx: ParamIdx.SoundMFXDelayMix },
          { label: 'DELAY L TIME', paramIdx: ParamIdx.SoundMFXDelayLTime },
          { label: 'DELAY R TIME', paramIdx: ParamIdx.SoundMFXDelayRTime },
          { label: 'REVERB ON', paramIdx: ParamIdx.SoundMFXReverbSwitch, choices: ['OFF', 'ON'] },
          { label: 'REVERB MIX', paramIdx: ParamIdx.SoundMFXReverbMix },
          { label: 'REVERB DECAY', paramIdx: ParamIdx.SoundMFXRevDecayTime },
        ],
      },
    ];
  }

  private renderMiniAdsrCardHtml(
    idPrefix: string,
    label: string,
    title: string,
    defaultAdsr: [number, number, number, number]
  ): string {
    const [a, d, s, r] = defaultAdsr;
    const pts = computeMiniAdsrPoints(a / 127, d / 127, s / 127, r / 127);
    const valStr = `${formatGraphEditorValue(a, 0, 127)}·${formatGraphEditorValue(d, 0, 127)}·${formatGraphEditorValue(s, 0, 127)}·${formatGraphEditorValue(r, 0, 127)}`;
    return `
      <div class="top-lcd-adsr-box" id="${idPrefix}-box" title="${title}">
        <div class="top-lcd-adsr-box__meta">
          <span class="top-lcd-adsr-box__label">${label}</span>
          <span class="top-lcd-adsr-box__vals" id="${idPrefix}-vals">${valStr}</span>
        </div>
        <svg class="top-lcd-adsr-svg" viewBox="0 0 66 22" width="66" height="22" aria-hidden="true">
          <polyline class="top-lcd-adsr-halo" id="${idPrefix}-halo" points="${pts}" />
          <polyline class="top-lcd-adsr-core" id="${idPrefix}-core" points="${pts}" />
        </svg>
      </div>
    `;
  }

  private mount(): void {
    this.container.className = 'top-lcd-bar';
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', 'Hartmann Neuron Top LCD Console & Telemetry');

    this.container.innerHTML = `
      <div class="synth-row top-lcd-bar__grid">
        <!-- 1. ZONA IZQUIERDA (4/12 cols): RESYNATOR 1 (LCD + 3 Pantallitas ADSR 66×22: AMP, RES, FREE) -->
        <div class="col-span-2 top-lcd-zone top-lcd-zone--r1">
          <!-- Fila 1: LCD Resynator 1 (C_GraphEditor #12/#13 + C_PadGrid #0 + C_Knob #0) -->
          <div class="top-lcd-zone__row1">
            <div class="top-lcd-zone__side">
              <span class="top-lcd-zone__badge">RESYNATOR 1</span>
              <button type="button" class="top-lcd-mini-btn" id="lcd-btn-r1-model" title="Seleccionar Modelo para Resynator 1">MODEL ▾</button>
              <button type="button" class="top-lcd-mini-btn" id="lcd-btn-r1-edit" title="Abrir Drawer de Resynator 1">EDIT</button>
            </div>
            <div class="top-lcd-mini-screen-mount" id="lcd-r1-screen-mount" title="Resynator 1 Display (C_GraphEditor #12/#13, C_PadGrid [0] & R1Volume)"></div>
          </div>
          <!-- Fila 2: Las 3 pantallitas ADSR 66×22 de Resynator 1 (C_DisplayButton #1, #0, #2) -->
          <div class="top-lcd-zone__row2">
            ${this.renderMiniAdsrCardHtml('lcd-r1-amp', 'R1 AMP', 'C_DisplayButton #1 (66×22, FUN_10018220) — R1 AmpEnv [200..203]', [4, 28, 127, 50])}
            ${this.renderMiniAdsrCardHtml('lcd-r1-res', 'R1 RES', 'C_DisplayButton #0 (66×22, FUN_10018220) — R1 ResEnv [182..185]', [74, 84, 32, 57])}
            ${this.renderMiniAdsrCardHtml('lcd-r1-free', 'R1 FREE', 'C_DisplayButton #2 (66×22, FUN_10018220) — R1 FreeEnv [205..208]', [32, 68, 54, 72])}
          </div>
        </div>

        <!-- 2. ZONA CENTRAL (4/12 cols): RESYNATOR 2 (LCD + 3 Pantallitas ADSR 66×22: AMP, RES, FREE) -->
        <div class="col-span-2 top-lcd-zone top-lcd-zone--r2">
          <!-- Fila 1: LCD Resynator 2 (C_GraphEditor #39/#40 + C_PadGrid #1 + C_Knob #1) -->
          <div class="top-lcd-zone__row1">
            <div class="top-lcd-zone__side">
              <span class="top-lcd-zone__badge">RESYNATOR 2</span>
              <button type="button" class="top-lcd-mini-btn" id="lcd-btn-r2-model" title="Seleccionar Modelo para Resynator 2">MODEL ▾</button>
              <button type="button" class="top-lcd-mini-btn" id="lcd-btn-r2-edit" title="Abrir Drawer de Resynator 2">EDIT</button>
            </div>
            <div class="top-lcd-mini-screen-mount" id="lcd-r2-screen-mount" title="Resynator 2 Display (C_GraphEditor #39/#40, C_PadGrid [1] & R2Volume)"></div>
          </div>
          <!-- Fila 2: Las 3 pantallitas ADSR 66×22 de Resynator 2 (C_DisplayButton #4, #3, #5) -->
          <div class="top-lcd-zone__row2">
            ${this.renderMiniAdsrCardHtml('lcd-r2-amp', 'R2 AMP', 'C_DisplayButton #4 (66×22, FUN_10018220) — R2 AmpEnv [230..233]', [18, 46, 108, 58])}
            ${this.renderMiniAdsrCardHtml('lcd-r2-res', 'R2 RES', 'C_DisplayButton #3 (66×22, FUN_10018220) — R2 ResEnv [212..215]', [52, 76, 44, 63])}
            ${this.renderMiniAdsrCardHtml('lcd-r2-free', 'R2 FREE', 'C_DisplayButton #5 (66×22, FUN_10018220) — R2 FreeEnv [235..238]', [60, 30, 88, 46])}
          </div>
        </div>

        <!-- 3. ZONA DERECHA (4/12 cols): CONSOLA CENTRAL + SILVER LCD + 7ª Pantallita ADSR (FLT ENV) + NAV STICK -->
        <div class="col-span-2 top-lcd-zone top-lcd-zone--central">
          <!-- Fila 1: Botonera Rápida + Consola Interactiva Principal (createLcdPanel) + Navigation Stick 4-Vías -->
          <div class="top-lcd-zone__row1 top-lcd-zone__row1--console">
            <div class="top-lcd-pages" role="group" aria-label="LCD Quick Page Select">
              <button type="button" class="lcd-nav-btn top-lcd-page-btn" data-branch="0" title="Sound & Global Settings">SND</button>
              <button type="button" class="lcd-nav-btn top-lcd-page-btn" data-branch="1" title="Resynator 1 Parameters (Doble clic abre Drawer)">R1</button>
              <button type="button" class="lcd-nav-btn top-lcd-page-btn" data-branch="2" title="Blender & Slicer Parameters (Doble clic abre Drawer)">BLD</button>
              <button type="button" class="lcd-nav-btn top-lcd-page-btn" data-branch="3" title="Resynator 2 Parameters (Doble clic abre Drawer)">R2</button>
              <button type="button" class="lcd-nav-btn top-lcd-page-btn" data-branch="4" title="Silver Filter & Multi-FX (Doble clic abre Drawer)">SLV</button>
              <button type="button" class="lcd-nav-btn top-lcd-page-btn" data-branch="5" title="Shapers ADSR & LFO (Doble clic abre Drawer)">SHP</button>
              <button type="button" class="lcd-nav-btn top-lcd-page-btn" data-branch="6" title="Modulation & NUKE Macros (Doble clic abre Matrix)">MOD</button>
              <button type="button" class="lcd-nav-btn top-lcd-page-btn" data-branch="7" title="Master Delay & Reverb FX">MFX</button>
            </div>
            <div class="top-lcd-panel-host" id="lcd-center-panel-mount"></div>
            <div class="top-lcd-navstick-wrap" title="Hartmann Hardware 4-Way Navigation Stick + Center Enter (Flechas de teclado o clic)">
              <div class="top-lcd-navstick" id="lcd-nav-stick" tabindex="0" role="group" aria-label="Hardware 4-Way Navigation Stick">
                <button type="button" class="top-lcd-navstick__dir top-lcd-navstick__dir--up" data-nav-dir="up" title="Stick Up (+5 / Coarse Up)" aria-label="Stick Up">▲</button>
                <button type="button" class="top-lcd-navstick__dir top-lcd-navstick__dir--left" data-nav-dir="left" title="Stick Left (Previous / -1)" aria-label="Stick Left">◀</button>
                <button type="button" class="top-lcd-navstick__center" id="lcd-nav-stick-enter" title="Stick Push / Enter (OK)" aria-label="Enter">ENT</button>
                <button type="button" class="top-lcd-navstick__dir top-lcd-navstick__dir--right" data-nav-dir="right" title="Stick Right (Next / +1)" aria-label="Stick Right">▶</button>
                <button type="button" class="top-lcd-navstick__dir top-lcd-navstick__dir--down" data-nav-dir="down" title="Stick Down (-5 / Coarse Down)" aria-label="Stick Down">▼</button>
              </div>
            </div>
          </div>

          <!-- Fila 2: 7ª Pantallita ADSR 66×22 (FLT ENV) + Pantalla LCD de Silver & Multi-FX + Telemetría NRPN/Preset -->
          <div class="top-lcd-zone__row2 top-lcd-zone__row2--console">
            ${this.renderMiniAdsrCardHtml('lcd-filt-adsr', 'FLT ENV', 'C_DisplayButton #6 (66×22, FUN_10018220) — Silver Filter ADSR [355..358]', [65, 75, 79, 89])}
            <div class="top-lcd-mini-screen-mount top-lcd-mini-screen-mount--silver" id="lcd-silver-screen-mount" title="Silver Filter, FreqFX, TimeFX & Slicer Display (C_PadGrid [2])"></div>
            <div class="top-lcd-console-meta">
              <div class="top-lcd-preset-steppers">
                <button type="button" class="top-lcd-mini-btn" id="lcd-preset-prev" title="Preset Anterior">◀</button>
                <button type="button" class="top-lcd-mini-btn" id="lcd-preset-browse" title="Abrir Navegador de Presets">PRESET</button>
                <button type="button" class="top-lcd-mini-btn" id="lcd-preset-next" title="Preset Siguiente">▶</button>
              </div>
              <div class="top-lcd-badges">
                <span class="top-lcd-badge" id="lcd-stick-rec-badge" title="Estado del Grabador Vectorial de Sticks">STK: IDLE</span>
                <span class="top-lcd-badge top-lcd-badge--nrpn" id="lcd-nrpn-badge" title="NRPN de 14 bits (CC 99/98) y Cabecera SysEx Hartmann (F0 00 20 50)">NRPN 02:18</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Registrar las 7 mini-pantallas ADSR 66×22 (C_DisplayButton #0..#6) con sus perfiles iniciales diferenciados
    const adsrConfigs: Array<{
      idPrefix: string;
      baseParamIdx: number;
      label: string;
      defaultAdsr: [number, number, number, number];
      shaper: 1 | 2 | 3;
      mode: 'amp' | 'res' | 'free' | 'filter';
    }> = [
      { idPrefix: 'lcd-r1-amp', baseParamIdx: ParamIdx.R1AmpEnvA, label: 'R1 AMP', defaultAdsr: [4, 28, 127, 50], shaper: 1, mode: 'amp' },
      { idPrefix: 'lcd-r1-res', baseParamIdx: ParamIdx.R1ResEnvA, label: 'R1 RES', defaultAdsr: [74, 84, 32, 57], shaper: 1, mode: 'res' },
      { idPrefix: 'lcd-r1-free', baseParamIdx: ParamIdx.R1FreeEnvA, label: 'R1 FREE', defaultAdsr: [32, 68, 54, 72], shaper: 1, mode: 'free' },
      { idPrefix: 'lcd-r2-amp', baseParamIdx: ParamIdx.R2AmpEnvA, label: 'R2 AMP', defaultAdsr: [18, 46, 108, 58], shaper: 2, mode: 'amp' },
      { idPrefix: 'lcd-r2-res', baseParamIdx: ParamIdx.R2ResEnvA, label: 'R2 RES', defaultAdsr: [52, 76, 44, 63], shaper: 2, mode: 'res' },
      { idPrefix: 'lcd-r2-free', baseParamIdx: ParamIdx.R2FreeEnvA, label: 'R2 FREE', defaultAdsr: [60, 30, 88, 46], shaper: 2, mode: 'free' },
      { idPrefix: 'lcd-filt-adsr', baseParamIdx: ParamIdx.FilterEnvA, label: 'FLT ENV', defaultAdsr: [65, 75, 79, 89], shaper: 3, mode: 'filter' },
    ];

    this.miniAdsrDisplays = adsrConfigs.map((cfg) => ({
      boxEl: this.container.querySelector(`#${cfg.idPrefix}-box`),
      halo: this.container.querySelector(`#${cfg.idPrefix}-halo`),
      core: this.container.querySelector(`#${cfg.idPrefix}-core`),
      valText: this.container.querySelector(`#${cfg.idPrefix}-vals`),
      baseParamIdx: cfg.baseParamIdx,
      label: cfg.label,
      defaultAdsr: cfg.defaultAdsr,
      shaper: cfg.shaper,
      mode: cfg.mode,
    }));

    this.nrpnBadgeEl = this.container.querySelector('#lcd-nrpn-badge');
    this.stickRecBadgeEl = this.container.querySelector('#lcd-stick-rec-badge');

    // 1. Instanciar LCD Resynator 1 (izquierda) con createLcdScreen (@abdsynths/shared/components)
    const r1Mount = this.container.querySelector('#lcd-r1-screen-mount') as HTMLElement | null;
    if (r1Mount) {
      this.r1Screen = createLcdScreen(r1Mount, {
        lines: 2,
        widthChars: 30,
        measure: () => 30,
      });
    }

    // 2. Instanciar LCD Resynator 2 (centro) con createLcdScreen (@abdsynths/shared/components)
    const r2Mount = this.container.querySelector('#lcd-r2-screen-mount') as HTMLElement | null;
    if (r2Mount) {
      this.r2Screen = createLcdScreen(r2Mount, {
        lines: 2,
        widthChars: 30,
        measure: () => 30,
      });
    }

    // 3. Instanciar Consola Central Interactiva (derecha fila 1) con createLcdPanel (@abdsynths/shared/components)
    const centerMount = this.container.querySelector('#lcd-center-panel-mount') as HTMLElement | null;
    if (centerMount) {
      this.centerPanel = createLcdPanel(centerMount, {
        menu: this.menuTree.map((branch) => ({
          label: branch.label,
          sub: (branch.sub ?? []).map((leaf) => ({
            label: leaf.label,
            paramId: leaf.paramIdx !== undefined ? String(leaf.paramIdx) : leaf.actionId,
            type: leaf.type ?? 'parameter',
            choices: leaf.choices,
          })),
        })),
        lines: 2,
        widthChars: 34,
        screen: {
          measure: () => 34,
          previewMs: 2400,
        },
        idle: () => this.composeCenterIdleLines(),
        editValue: (item: any) => this.formatEditingItem(item),
        hooks: {
          onEdit: (paramId: string, delta: number) => {
            const idx = Number(paramId);
            if (!Number.isFinite(idx)) return;
            this.nudgeParameter(idx, delta);
          },
          onAction: (item: any) => {
            if (item?.paramId === 'BROWSE_PRESETS') {
              this.callbacks.onOpenBankPresets?.();
            } else if (item?.paramId === 'INIT_SOUND') {
              this.callbacks.onInitSound?.();
            } else if (item?.paramId === 'OPEN_MATRIX') {
              this.callbacks.onOpenMatrixDrawer?.();
            }
          },
          onIdle: () => {
            this.updateActiveBranchButtons();
          },
        },
      });
    }

    // 4. Instanciar LCD Silver & Multi-FX (derecha fila 2) con createLcdScreen (@abdsynths/shared/components)
    const silverMount = this.container.querySelector('#lcd-silver-screen-mount') as HTMLElement | null;
    if (silverMount) {
      this.silverScreen = createLcdScreen(silverMount, {
        lines: 2,
        widthChars: 28,
        measure: () => 28,
      });
    }

    this.bindEvents();
    this.refreshAll();
  }

  private bindEvents(): void {
    // Botones de acceso directo a las 8 ramas del menú
    const branchBtns = this.container.querySelectorAll<HTMLButtonElement>('.top-lcd-page-btn');
    branchBtns.forEach((btn) => {
      const branchIdx = Number(btn.getAttribute('data-branch') ?? '0');
      this.pageButtons.set(String(branchIdx), btn);

      btn.addEventListener('click', () => {
        this.jumpToMenuBranch(branchIdx);
      });

      btn.addEventListener('dblclick', () => {
        if (branchIdx === 0) this.callbacks.onOpenBankPresets?.();
        else if (branchIdx === 1) this.callbacks.onOpenR1Drawer?.();
        else if (branchIdx === 2) this.callbacks.onOpenBlenderDrawer?.();
        else if (branchIdx === 3) this.callbacks.onOpenR2Drawer?.();
        else if (branchIdx === 4) this.callbacks.onOpenSilverDrawer?.();
        else if (branchIdx === 5) this.callbacks.onOpenEnvelopeDrawer?.();
        else if (branchIdx === 6) this.callbacks.onOpenMatrixDrawer?.();
        else if (branchIdx === 7) this.callbacks.onOpenSilverDrawer?.();
      });
    });

    // Sincronizar resaltado de botón de rama al pulsar botones del D-pad de createLcdPanel
    this.container.querySelector('.abd-lcd-panel__pad')?.addEventListener('click', () => {
      this.updateActiveBranchButtons();
    });

    // Joystick Digital de Navegación 4-Vías + Enter (NavigationStick)
    const stickDirs = this.container.querySelectorAll<HTMLButtonElement>('[data-nav-dir]');
    stickDirs.forEach((btn) => {
      const dir = btn.getAttribute('data-nav-dir') as 'up' | 'down' | 'left' | 'right';
      btn.addEventListener('click', () => {
        if (!this.centerPanel) return;
        if (this.centerPanel.machine.state === 'idle') {
          this.centerPanel.machine.onMenuPress();
        } else {
          this.centerPanel.machine.onArrow(dir);
        }
        this.centerPanel.repaint();
        this.updateActiveBranchButtons();
      });
    });

    this.container.querySelector('#lcd-nav-stick-enter')?.addEventListener('click', () => {
      if (!this.centerPanel) return;
      if (this.centerPanel.machine.state === 'idle') {
        this.centerPanel.machine.onMenuPress();
      } else {
        this.centerPanel.machine.onOkPress();
      }
      this.centerPanel.repaint();
      this.updateActiveBranchButtons();
    });

    // Soporte de flechas de teclado cuando el Navigation Stick tiene el foco
    const navStickEl = this.container.querySelector('#lcd-nav-stick') as HTMLElement | null;
    navStickEl?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.centerPanel) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.centerPanel.machine.onArrow('left');
        this.centerPanel.repaint();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.centerPanel.machine.onArrow('right');
        this.centerPanel.repaint();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.centerPanel.machine.onArrow('up');
        this.centerPanel.repaint();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.centerPanel.machine.onArrow('down');
        this.centerPanel.repaint();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (this.centerPanel.machine.state === 'idle') {
          this.centerPanel.machine.onMenuPress();
        } else {
          this.centerPanel.machine.onOkPress();
        }
        this.centerPanel.repaint();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.centerPanel.machine.onMenuPress();
        this.centerPanel.repaint();
      }
      this.updateActiveBranchButtons();
    });

    // Botones de selección de modelo y edición de Resynator 1 y 2
    this.container.querySelector('#lcd-btn-r1-model')?.addEventListener('click', () => {
      this.callbacks.onOpenBankModels?.(1);
    });
    this.container.querySelector('#lcd-btn-r1-edit')?.addEventListener('click', () => {
      this.callbacks.onOpenR1Drawer?.();
    });
    this.container.querySelector('#lcd-btn-r2-model')?.addEventListener('click', () => {
      this.callbacks.onOpenBankModels?.(2);
    });
    this.container.querySelector('#lcd-btn-r2-edit')?.addEventListener('click', () => {
      this.callbacks.onOpenR2Drawer?.();
    });

    // Steppers de Preset en la consola derecha
    this.container.querySelector('#lcd-preset-prev')?.addEventListener('click', () => {
      const nextSlot = (this.currentPresetSlot - 1 + 398) % 398;
      this.callbacks.onSelectPresetSlot?.(nextSlot);
    });
    this.container.querySelector('#lcd-preset-next')?.addEventListener('click', () => {
      const nextSlot = (this.currentPresetSlot + 1) % 398;
      this.callbacks.onSelectPresetSlot?.(nextSlot);
    });
    this.container.querySelector('#lcd-preset-browse')?.addEventListener('click', () => {
      this.callbacks.onOpenBankPresets?.();
    });

    // Al hacer clic en cualquiera de las 7 pantallitas ADSR 66×22, mostrar su telemetría en la consola central,
    // conmutar el Shaper correspondiente a esa envolvente y con doble clic abrir el EnvelopeDrawer
    const adsrBoxes = this.container.querySelectorAll<HTMLElement>('.top-lcd-adsr-box');
    adsrBoxes.forEach((box, idx) => {
      box.addEventListener('click', () => {
        const ref = this.miniAdsrDisplays[idx];
        if (!ref || !this.centerPanel) return;
        adsrBoxes.forEach((b) => b.classList.toggle('is-active', b === box));
        this.callbacks.onSelectAdsrTarget?.(ref.shaper, ref.mode);
        const [defA, defD, defS, defR] = ref.defaultAdsr;
        const a = formatGraphEditorValue(WebBridge.getParam(ref.baseParamIdx, defA), 0, 127);
        const d = formatGraphEditorValue(WebBridge.getParam(ref.baseParamIdx + 1, defD), 0, 127);
        const s = formatGraphEditorValue(WebBridge.getParam(ref.baseParamIdx + 2, defS), 0, 127);
        const r = formatGraphEditorValue(WebBridge.getParam(ref.baseParamIdx + 3, defR), 0, 127);
        this.centerPanel.screen.preview(0, `${ref.label} ADSR [#${ref.baseParamIdx}..${ref.baseParamIdx + 3}]`, {
          durationMs: 2200,
        });
        this.centerPanel.screen.preview(1, `A:${a} D:${d} S:${s} R:${r}`, { durationMs: 2200 });
      });
      box.addEventListener('dblclick', () => {
        this.callbacks.onOpenEnvelopeDrawer?.();
      });
    });
  }

  private jumpToMenuBranch(branchIdx: number): void {
    if (!this.centerPanel) return;
    const machine = this.centerPanel.machine as any;
    while (machine.state !== 'idle') {
      machine.onMenuPress();
    }
    machine.onMenuPress();
    const snap = machine.snapshot();
    const currentIdx = snap.index ?? 0;
    const delta = branchIdx - currentIdx;
    if (delta !== 0) {
      machine.onEncoderRotate(delta);
    }
    machine.onOkPress();
    this.centerPanel.repaint();
    this.updateActiveBranchButtons();
  }

  private updateActiveBranchButtons(): void {
    if (!this.centerPanel) return;
    const snap = this.centerPanel.machine.snapshot();
    const activeRootLabel = snap.breadcrumb?.[0] ?? '';
    this.menuTree.forEach((branch, idx) => {
      const btn = this.pageButtons.get(String(idx));
      if (btn) {
        btn.classList.toggle('active', snap.state !== 'idle' && branch.label === activeRootLabel);
      }
    });
  }

  private nudgeParameter(paramIdx: number, delta: number): void {
    const def = this.paramMap.get(paramIdx);
    if (!def) return;
    const cur = WebBridge.getParam(paramIdx, def.defaultValue);
    const step = def.step || 1;
    const next = Math.max(def.min, Math.min(def.max, Math.round(cur + delta * step)));
    if (next !== cur) {
      WebBridge.setParam(paramIdx, next);
      this.onParamUpdated(paramIdx, next, true);
    }
  }

  private formatEditingItem(item: any): string {
    if (!item || !item.paramId) return '';
    const idx = Number(item.paramId);
    if (!Number.isFinite(idx)) return item.label ?? '';
    const def = this.paramMap.get(idx);
    if (!def) return '';
    const val = WebBridge.getParam(idx, def.defaultValue);
    const formatted = formatGraphEditorValue(val, def.min, def.max, item.choices);
    const nrpnMsb = (idx >> 7) & 0x7f;
    const nrpnLsb = idx & 0x7f;
    return `${formatted} [N:${String(nrpnMsb).padStart(2, '0')}:${String(nrpnLsb).padStart(3, '0')}]`;
  }

  private composeCenterIdleLines(): [string, string] {
    const bldType = Math.max(
      0,
      Math.min(BLENDER_SHORT_NAMES.length - 1, Math.round(WebBridge.getParam(ParamIdx.BlenderType, 0)))
    );
    const bldAmt = Math.round(WebBridge.getParam(ParamIdx.BlenderAmount, 0));
    const bldAmtStr = formatGraphEditorValue(bldAmt, -64, 63);
    const line0 = `${this.currentPresetName.slice(0, 14).padEnd(14, ' ')} BLD:${BLENDER_SHORT_NAMES[bldType].slice(0, 5)} ${bldAmtStr}`;

    const def = this.paramMap.get(this.lastTouchedParamIdx);
    if (!def) {
      const maxVoices = Math.round(WebBridge.getParam(ParamIdx.SoundNumVoices, 12));
      return [line0, `NEURON VS · VOX ${String(this.activeVoices).padStart(2, '0')}/${String(maxVoices).padStart(2, '0')}`];
    }
    const val = WebBridge.getParam(this.lastTouchedParamIdx, def.defaultValue);
    const valStr = formatGraphEditorValue(val, def.min, def.max);
    const maxVoices = Math.round(WebBridge.getParam(ParamIdx.SoundNumVoices, 12));
    const line1 = `${def.key.slice(0, 14).padEnd(14, ' ')} ${valStr} VX:${String(this.activeVoices).padStart(2, '0')}/${String(maxVoices).padStart(2, '0')}`;
    return [line0, line1];
  }

  /**
   * Actualiza la pantalla LCD de Resynator 1 (Zona 1 Izquierda)
   */
  public refreshR1Screen(): void {
    if (!this.r1Screen) return;
    const r1On = WebBridge.getParam(ParamIdx.R1Switch, 1) >= 0.5;
    const r1Type = Math.round(WebBridge.getParam(ParamIdx.R1Type, 0)) === 0 ? 'SPH' : 'SCP';
    const r1Lvl = Math.max(0, Math.min(2, Math.round(WebBridge.getParam(ParamIdx.R1ParamLevel, 0))));

    const xIdx =
      r1Type === 'SPH'
        ? r1Lvl === 0
          ? ParamIdx.R1L1Sphere1Value
          : r1Lvl === 1
            ? ParamIdx.R1L2Sphere1Value
            : ParamIdx.R1L3Sphere1Value
        : r1Lvl === 0
          ? ParamIdx.R1L1Scape1Value
          : r1Lvl === 1
            ? ParamIdx.R1L2Scape1Value
            : ParamIdx.R1L3Scape1Value;
    const yIdx = xIdx + 1;

    const xVal = formatGraphEditorValue(WebBridge.getParam(xIdx, 64), 0, 127);
    const yVal = formatGraphEditorValue(WebBridge.getParam(yIdx, 64), 0, 127);
    const volVal = formatGraphEditorValue(WebBridge.getParam(ParamIdx.R1Volume, 100), 0, 127);
    const semiVal = formatGraphEditorValue(WebBridge.getParam(ParamIdx.R1Semi, 0), -24, 24);

    const slotStr = `#${String(this.r1ModelSlot).padStart(3, '0')}`;
    const cleanName = this.r1ModelName.replace(/^#\d+\s*/, '').slice(0, 11);
    const l0 = r1On
      ? `R1 ${slotStr} ${cleanName.padEnd(11, ' ')} ${r1Type} L${r1Lvl + 1}`
      : `R1 [OFF] ${slotStr} ${cleanName.padEnd(9, ' ')}`;
    const l1 = `X:${xVal} Y:${yVal} VOL:${volVal} S:${semiVal}`;

    this.r1Screen.setLine(0, l0);
    this.r1Screen.setLine(1, l1);
  }

  /**
   * Actualiza la pantalla LCD de Resynator 2 (Zona 2 Central)
   */
  public refreshR2Screen(): void {
    if (!this.r2Screen) return;
    const r2On = WebBridge.getParam(ParamIdx.R2Switch, 1) >= 0.5;
    const r2Type = Math.round(WebBridge.getParam(ParamIdx.R2Type, 0)) === 0 ? 'SPH' : 'SCP';
    const r2Lvl = Math.max(0, Math.min(2, Math.round(WebBridge.getParam(ParamIdx.R2ParamLevel, 0))));

    const xIdx =
      r2Type === 'SPH'
        ? r2Lvl === 0
          ? ParamIdx.R2L1Sphere1Value
          : r2Lvl === 1
            ? ParamIdx.R2L2Sphere1Value
            : ParamIdx.R2L3Sphere1Value
        : r2Lvl === 0
          ? ParamIdx.R2L1Scape1Value
          : r2Lvl === 1
            ? ParamIdx.R2L2Scape1Value
            : ParamIdx.R2L3Scape1Value;
    const yIdx = xIdx + 1;

    const xVal = formatGraphEditorValue(WebBridge.getParam(xIdx, 64), 0, 127);
    const yVal = formatGraphEditorValue(WebBridge.getParam(yIdx, 64), 0, 127);
    const volVal = formatGraphEditorValue(WebBridge.getParam(ParamIdx.R2Volume, 100), 0, 127);
    const semiVal = formatGraphEditorValue(WebBridge.getParam(ParamIdx.R2Semi, 0), -24, 24);

    const slotStr = `#${String(this.r2ModelSlot).padStart(3, '0')}`;
    const cleanName = this.r2ModelName.replace(/^#\d+\s*/, '').slice(0, 11);
    const l0 = r2On
      ? `R2 ${slotStr} ${cleanName.padEnd(11, ' ')} ${r2Type} L${r2Lvl + 1}`
      : `R2 [OFF] ${slotStr} ${cleanName.padEnd(9, ' ')}`;
    const l1 = `X:${xVal} Y:${yVal} VOL:${volVal} S:${semiVal}`;

    this.r2Screen.setLine(0, l0);
    this.r2Screen.setLine(1, l1);
  }

  /**
   * Actualiza la pantalla LCD auxiliar de Silver & Multi-FX (Zona 3 Derecha Fila 2)
   */
  public refreshSilverScreen(): void {
    if (!this.silverScreen) return;
    const fCurveIdx = Math.max(0, Math.min(4, Math.round(WebBridge.getParam(ParamIdx.FilterType, 0))));
    const fCurve = ['24LP', '12LP', '06LP', 'BP  ', 'HP  '][fCurveIdx] ?? '24LP';
    const cut = formatGraphEditorValue(WebBridge.getParam(ParamIdx.FilterFreq, 127), 0, 127);
    const res = formatGraphEditorValue(WebBridge.getParam(ParamIdx.FilterReso, 0), 0, 127);
    const l0 = `FLT:${fCurve} C:${cut} R:${res}`;

    const ffxOn = WebBridge.getParam(ParamIdx.FreqFXSwitch, 0) >= 0.5;
    const tfxOn = WebBridge.getParam(ParamIdx.TimeFXSwitch, 0) >= 0.5;
    const ffxIdx = Math.max(0, Math.min(4, Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 0))));
    const tfxIdx = Math.max(0, Math.min(4, Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 0))));
    const ffxLabel = ffxOn ? FREQ_FX_SHORT[ffxIdx] : 'OFF';
    const tfxLabel = tfxOn ? TIME_FX_SHORT[tfxIdx] : 'OFF';
    const l1 = `F:${ffxLabel.padEnd(6, ' ')} T:${tfxLabel.padEnd(6, ' ')}`;

    this.silverScreen.setLine(0, l0);
    this.silverScreen.setLine(1, l1);
  }

  /**
   * Actualiza las 7 mini-pantallas ADSR 66×22 (`C_DisplayButton #0..#6` `FUN_10018220`)
   */
  public refreshMiniAdsrDisplays(): void {
    for (const ref of this.miniAdsrDisplays) {
      const [defA, defD, defS, defR] = ref.defaultAdsr;
      const aRaw = WebBridge.getParam(ref.baseParamIdx, defA);
      const dRaw = WebBridge.getParam(ref.baseParamIdx + 1, defD);
      const sRaw = WebBridge.getParam(ref.baseParamIdx + 2, defS);
      const rRaw = WebBridge.getParam(ref.baseParamIdx + 3, defR);
      const isRepeat = WebBridge.getParam(ref.baseParamIdx + 4, 0) >= 0.5;

      const pts = computeMiniAdsrPoints(aRaw / 127, dRaw / 127, sRaw / 127, rRaw / 127, isRepeat);
      ref.halo?.setAttribute('points', pts);
      ref.core?.setAttribute('points', pts);

      const labelEl = ref.boxEl?.querySelector<HTMLElement>('.top-lcd-adsr-box__label');
      if (labelEl) {
        labelEl.textContent = isRepeat ? `${ref.label} ↻` : ref.label;
      }

      if (ref.valText) {
        const aStr = formatGraphEditorValue(aRaw, 0, 127);
        const dStr = formatGraphEditorValue(dRaw, 0, 127);
        const sStr = formatGraphEditorValue(sRaw, 0, 127);
        const rStr = formatGraphEditorValue(rRaw, 0, 127);
        ref.valText.textContent = `${aStr}·${dStr}·${sStr}·${rStr}`;
      }
    }
  }

  /**
   * Notifica un cambio de parámetro (por interacción del usuario o desde el host)
   * y dispara el preview transitorio en el LCD central (`C_ParameterPage::v01_updateStatus` `0x10015ed0`).
   */
  public onParamUpdated(index: number, value: number, showTransientPreview: boolean = true): void {
    this.lastTouchedParamIdx = index;
    const def = this.paramMap.get(index);

    const nrpnMsb = (index >> 7) & 0x7f;
    const nrpnLsb = index & 0x7f;
    if (this.nrpnBadgeEl) {
      this.nrpnBadgeEl.textContent = `NRPN ${String(nrpnMsb).padStart(2, '0')}:${String(nrpnLsb).padStart(3, '0')}`;
    }

    if (showTransientPreview && def && this.centerPanel && this.centerPanel.machine.state !== 'edit') {
      const valStr = formatGraphEditorValue(value, def.min, def.max);
      const normPct =
        def.max > def.min ? Math.round(((value - def.min) / (def.max - def.min)) * 100) : 0;
      this.centerPanel.screen.preview(
        0,
        `${def.group.toUpperCase()} · ${def.key} [#${String(index).padStart(3, '0')}]`,
        { durationMs: 2200 }
      );
      this.centerPanel.screen.preview(
        1,
        `VAL:${valStr} (${normPct}%) N:${String(nrpnMsb).padStart(2, '0')}:${String(nrpnLsb).padStart(3, '0')}`,
        { durationMs: 2200 }
      );
    } else {
      this.centerPanel?.repaint();
    }

    this.refreshR1Screen();
    this.refreshR2Screen();
    this.refreshSilverScreen();
    this.refreshMiniAdsrDisplays();
  }


  /**
   * Muestra el aviso estandar de guardado completado segun el contrato de LCD_GUIDE.md (§5 y §5.7).
   */
  public flashWriteCompleted(programId?: string, programName?: string, durationMs: number = 2200): void {
    const { line1, line2 } = buildWriteCompletedNotice({ programId, programName });
    if (this.centerPanel) {
      this.centerPanel.screen.preview(0, line1, { durationMs });
      this.centerPanel.screen.preview(1, line2, { durationMs });
    }
  }

  public setPresetInfo(slot: number, name: string): void {
    this.currentPresetSlot = slot;
    this.currentPresetName = name;
    this.centerPanel?.repaint();
  }

  public setModelInfo(resynator: 1 | 2, slot: number, name: string): void {
    if (resynator === 1) {
      this.r1ModelSlot = slot;
      this.r1ModelName = name;
      this.refreshR1Screen();
    } else {
      this.r2ModelSlot = slot;
      this.r2ModelName = name;
      this.refreshR2Screen();
    }
  }

  public setVoices(activeVoices: number): void {
    this.activeVoices = activeVoices;
    if (this.centerPanel?.machine.state === 'idle') {
      this.centerPanel.repaint();
    }
  }

  public setStickRecorderStatus(status: 'IDLE' | 'REC' | 'PLAY', coord?: { x: number; y: number }): void {
    if (this.stickRecBadgeEl) {
      if (coord) {
        const xStr = formatGraphEditorValue(Math.round(coord.x * 127), 0, 127);
        const yStr = formatGraphEditorValue(Math.round(coord.y * 127), 0, 127);
        this.stickRecBadgeEl.textContent = `STK:${status} ${xStr}/${yStr}`;
      } else {
        this.stickRecBadgeEl.textContent = `STK: ${status}`;
      }
      this.stickRecBadgeEl.classList.toggle('is-rec', status === 'REC');
      this.stickRecBadgeEl.classList.toggle('is-play', status === 'PLAY');
    }
  }

  public refreshAll(): void {
    this.refreshR1Screen();
    this.refreshR2Screen();
    this.refreshSilverScreen();
    this.refreshMiniAdsrDisplays();
    this.centerPanel?.repaint();
  }
}
