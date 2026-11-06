// ─────────────────────────────────────────────────────────
// ABDAxionikVS — main.ts
// Frontend WebUI entry point: thin bootstrap orchestrator. The shell,
// drawers, sticks, panels, presets, navbar, LCD bar, drag&drop and bridge
// wiring each live in their own app/ module; bootstrap only creates them
// in dependency order and connects the shared context.
// Exact parity with ABDNeuModMakr and ABDSynths Ecosystem.
// ─────────────────────────────────────────────────────────
import './style.css';
import { initI18n, onLocaleChange } from './i18n/index.js';
import { ThemeManager } from './utils/themeManager.js';
import { DrawerManager } from './ui/Drawers.js';
import { WebBridge } from './bridge/WebBridge.js';
import { PARAM_DEFINITIONS } from './generated/parameters.gen.js';
import { setupKeyboardShortcuts } from './app/keyboardShortcuts.js';
import type { ParamUpdateCtx } from './app/paramUpdate.js';
import { createInitialState, type AppCtx } from './app/context.js';
import { buildShell, wireShellControls } from './app/shell.js';
import { setupKeyboardStrip } from './app/keyboardStrip.js';
import { createResynatorUi } from './app/resynatorUi.js';
import { createDrawerOpeners } from './app/drawerOpeners.js';
import { setupMidiLearn } from './app/midiLearn.js';
import { setupAuxDrawers } from './app/auxDrawers.js';
import { mountTrajectorySticks } from './app/sticks.js';
import { mountPanels } from './app/panels.js';
import { createBankDrawer } from './app/bankSetup.js';
import { createNavbar } from './app/navbarSetup.js';
import { setupTopLcdBar } from './app/topLcdSetup.js';
import { createDragDrop } from './app/dragDrop.js';
import { subscribeBridge } from './app/bridgeSubscriptions.js';

const bootstrapAxionikApp = async () => {
  const app = document.getElementById('app');
  if (!app) return;

  // Internationalization (i18n)
  initI18n();

  // Themes
  const themeManager = new ThemeManager();
  themeManager.setTheme('ms2000');

  // Static DOM skeleton
  const shell = buildShell(app);

  // Shared mutable context: every module fills its part, reads the rest lazily.
  const ctx: AppCtx = {
    app,
    navContainer: shell.navContainer,
    lcdBarContainer: shell.lcdBarContainer,
    drawerManager: new DrawerManager(app),
    themeManager,
    state: createInitialState(),
    resynator: null,
    navbar: null,
    bankDrawer: null,
    nukeDrawer: null,
    hardwareDumpsDrawer: null,
    calibrationDrawer: null,
    topLcdBar: null,
    controllersPanel: null,
    silverPanel: null,
    blenderPanel: null,
    filterPanel: null,
    envelopeMasterPanel: null,
    shapersPanel: null,
    sticks: { r1Scape: null, r1Sphere: null, r2Scape: null, r2Sphere: null },
    midiLearnStore: null,
    dragDropHandler: null,
    paramUpdate: null,
    drawerReopen: {},
  };

  setupKeyboardStrip(ctx, shell.keyboardSection);
  ctx.resynator = createResynatorUi(ctx);
  const openers = createDrawerOpeners(ctx);
  ctx.midiLearnStore = setupMidiLearn(ctx);
  setupAuxDrawers(ctx, openers);
  mountTrajectorySticks(ctx);
  mountPanels(ctx, openers);
  wireShellControls(ctx, openers);
  createBankDrawer(ctx);
  createNavbar(ctx, openers);
  setupTopLcdBar(ctx, openers);
  ctx.dragDropHandler = createDragDrop(ctx);

  // Atajos globales de teclado
  setupKeyboardShortcuts(ctx.bankDrawer, ctx.navbar, openers.openSettingsDrawer);

  // Contexto para el manejador PARAM_UPDATE (módulo app/paramUpdate.ts)
  const paramUpdateCtx: ParamUpdateCtx = {
    updateResySwitchButton: (resy, enabled) => {
      ctx.resynator?.updateSwitchButton(resy, enabled);
    },
    updateResynatorModelUI: (resynator, slot, name) => {
      ctx.resynator?.updateModelUI(resynator, slot, name);
    },
    setModelName: (r, text) => ctx.navbar?.setModelName(r, text),
    r1ScapeStick: ctx.sticks.r1Scape,
    r1SphereStick: ctx.sticks.r1Sphere,
    r2ScapeStick: ctx.sticks.r2Scape,
    r2SphereStick: ctx.sticks.r2Sphere,
    blender: {
      slider: null,
      sliderLabel: null,
      setIdx: (v) => {
        ctx.blenderPanel?.updateAlgoUi(v);
      },
    },
    slicer: {
      depthSlider: null,
      depthLabel: null,
      rateSlider: null,
      rateLabel: null,
      setIdx: (v) => {
        ctx.silverPanel?.updateSlicerModeUi(v);
      },
    },
    filter: {
      cutSlider: null,
      cutLabel: null,
      resoSlider: null,
      resoLabel: null,
    },
    freqFx: {
      setIdx: (v) => {
        ctx.silverPanel?.updateFreqAlgoUi(v);
      },
    },
    timeFx: {
      setIdx: (v) => {
        ctx.silverPanel?.updateTimeAlgoUi(v);
      },
    },
    shapersPanel: ctx.shapersPanel,
    silverPanel: ctx.silverPanel,
    blenderPanel: ctx.blenderPanel,
    filterPanel: ctx.filterPanel,
    envelopeMasterPanel: ctx.envelopeMasterPanel,
    nukeDrawer: ctx.nukeDrawer,
  };
  ctx.paramUpdate = paramUpdateCtx;

  subscribeBridge(ctx);

  // Re-render the open drawer reactively on language change without closing it.
  onLocaleChange(() => {
    openers.reopenCurrentDrawer();
  });

  if ((import.meta as any).env?.DEV) {
    (window as any).__axionikSticks = {
      r1ScapeStick: ctx.sticks.r1Scape,
      r1SphereStick: ctx.sticks.r1Sphere,
      r2ScapeStick: ctx.sticks.r2Scape,
      r2SphereStick: ctx.sticks.r2Sphere,
    };
  }

  // Notificar al host nativo que la WebUI está montada y lista para recibir telemetría
  WebBridge.send({ type: 'UI_READY' });
  const initMlState = ctx.midiLearnStore.getState();
  if (initMlState.mappings.length > 0 || initMlState.isLearning) {
    WebBridge.send({
      type: 'MIDI_LEARN_SYNC',
      mappings: initMlState.mappings,
      learningTargetIndex: initMlState.learningTargetIndex,
      learningTargetKey: initMlState.learningTargetKey,
      learnMode: initMlState.learnMode,
    });
  }

  // Solicitar catálogo en vivo al host nativo C++
  WebBridge.scanBank();

  console.log(`[ABDAxionikVS] Frontend inicializado (${PARAM_DEFINITIONS.length} parámetros, SynthNavBar montado).`);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapAxionikApp);
} else {
  bootstrapAxionikApp();
}
