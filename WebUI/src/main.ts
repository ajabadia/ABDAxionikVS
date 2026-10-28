/**
// ─────────────────────────────────────────────────────────
// ABDAxionikVS — main.ts
// Frontend WebUI entry point
// Desktop HUD with SynthNavBar, BankDrawer & DrawerManager
// Exact parity with ABDNeuModMakr and ABDSynths Ecosystem
// ─────────────────────────────────────────────────────────
*/

import './style.css';
import { AxionikNavbar } from './ui/Navbar.js';
import { BankDrawer } from './ui/BankDrawer.js';
import { KeyboardStrip } from './ui/KeyboardStrip.js';
import { ControllersPanel } from './ui/ControllersPanel.js';
import { ShapersPanel } from './ui/ShapersPanel.js';
import { SilverPanel, FREQ_ALGO_NAMES, TIME_ALGO_NAMES } from './ui/SilverPanel.js';
import { MasterOutputPanel } from './ui/MasterOutputPanel.js';
import { DrawerManager } from './ui/Drawers.js';
import { TrajectoryStick2D } from './ui/TrajectoryStick2D.js';
import { ResynatorDrawer } from './ui/ResynatorDrawer.js';
import { EffectsDrawer } from './ui/EffectsDrawer.js';
import { BlenderDrawer, BLENDER_ALGORITHMS } from './ui/BlenderDrawer.js';
import { MatrixDrawer } from './ui/MatrixDrawer.js';
import { SettingsDrawer } from './ui/SettingsDrawer.js';
import { DragDropHandler } from './ui/DragDropHandler.js';
import { WebBridge } from './bridge/WebBridge.js';
import { PARAM_DEFINITIONS } from './generated/parameters.gen.js';
import { ParamIdx } from './constants/paramIndices.js';
import { getParameterSetStickLabels } from './ui/ParameterSets.js';
import {
  MODEL_METADATA,
  getCanonicalModelName,
  getCanonicalPresetInfo,
} from './ui/NeuronCatalogMetadata.js';
import { ThemeManager } from './utils/themeManager.js';
import { handleParamUpdate, type ParamUpdateCtx } from './app/paramUpdate.js';

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (!app) return;

  // Themes
  const themeManager = new ThemeManager();
  themeManager.setTheme('ms2000');

  // 1. Contenedor de Navbar
  const navContainer = document.createElement('header');
  app.appendChild(navContainer);

  // 2. Canvas principal del sintetizador
  const workspace = document.createElement('main');
  workspace.className = 'workspace-canvas';
  workspace.innerHTML = `
    <div class="workspace-layout">
      <!-- 1. Fila Superior: Resynators (R1 y R2) + Silver Rack (3 bloques de 2 unidades = 6 unidades) -->
      <div class="synth-row" id="row-top" data-row-id="row-top">
        <!-- Columna Resynator 1 (2 unidades) -->
        <section class="synth-panel-card resynator-column col-span-2" id="r1-panel">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08)); gap: 6px;">
            <div style="display: flex; align-items: center; gap: var(--space-2); min-width: 0;">
              <span class="stick-label">RESYNATOR 1</span>
              <button type="button" class="btn btn-xs btn-primary active" id="btn-toggle-r1" title="Enable / Mute Resynator 1 [23]">R1 ON</button>
              <span class="panel-caption resynator-model-caption" id="r1-model-caption" title="Loaded Model Name">511 sinew</span>
            </div>
            <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
              <button type="button" class="btn btn-xs btn-outline" id="btn-select-model-r1" title="Select / Change Model for Resynator 1">
                MODEL: <strong id="r1-model-slot">#511</strong>
              </button>
              <button type="button" class="btn btn-xs btn-outline" id="btn-edit-r1" title="Expanded Controls">Edit</button>
              <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-top" title="Colapsar / Descolapsar fila">▾</button>
            </div>
          </div>

          <div class="panel-body r1-body" data-collapse-body style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); flex: 1;">
            <div id="r1-scape-mount"></div>
            <div id="r1-sphere-mount"></div>
          </div>
        </section>

        <!-- Columna Resynator 2 (2 unidades) -->
        <section class="synth-panel-card resynator-column col-span-2" id="r2-panel">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08)); gap: 6px;">
            <div style="display: flex; align-items: center; gap: var(--space-2); min-width: 0;">
              <span class="stick-label">RESYNATOR 2</span>
              <button type="button" class="btn btn-xs btn-primary active" id="btn-toggle-r2" title="Enable / Mute Resynator 2 [103]">R2 ON</button>
              <span class="panel-caption resynator-model-caption" id="r2-model-caption" title="Loaded Model Name">511 sinew</span>
            </div>
            <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
              <button type="button" class="btn btn-xs btn-outline" id="btn-select-model-r2" title="Select / Change Model for Resynator 2">
                MODEL: <strong id="r2-model-slot">#511</strong>
              </button>
              <button type="button" class="btn btn-xs btn-outline" id="btn-edit-r2" title="Expanded Controls">Edit</button>
              <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-top" title="Colapsar / Descolapsar fila">▾</button>
            </div>
          </div>

          <div class="panel-body r2-body" data-collapse-body style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); flex: 1;">
            <div id="r2-scape-mount"></div>
            <div id="r2-sphere-mount"></div>
          </div>
        </section>

        <!-- Columna Silver (2 unidades) -->
        <div id="silver-mount" class="col-span-2"></div>
      </div>

      <!-- Barra Central Recuperada: Blender, Slicer, Filter, Silver FX -->
      <section class="synth-panel-card central-controls-bar" style="margin: 4px 0; padding: var(--space-2) var(--space-3); display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
        <!-- Blender -->
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="panel-badge">BLENDER</span>
          <button type="button" class="btn btn-xs btn-outline" id="btn-cycle-blender-algo" title="Cycle Blender Fusion Algorithm [261]">
            ALGO: <strong id="cur-blender-algo-val">Mix</strong>
          </button>
          <div class="hud-pill" style="display: flex; align-items: center; gap: 4px;">
            <span class="hud-label">AMT:</span>
            <input type="range" id="blender-slider" class="abd-slider" min="-64" max="63" value="0" step="1" style="width: 75px;" />
            <span class="hud-value stat-num" id="blender-amount-val">0</span>
          </div>
          <button type="button" class="btn btn-xs btn-outline" id="btn-edit-blender" title="Expanded Blender & Slicer [261..270]">Edit</button>
        </div>

        <!-- Slicer -->
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="panel-badge">SLICER</span>
          <button type="button" class="btn btn-xs btn-outline" id="btn-cycle-slicer-type" title="Slicer Mode (0: Off, 1: 2D, 2: 3D) [267]">
            MODE: <strong id="cur-slicer-type-val">Off</strong>
          </button>
          <div class="hud-pill" style="display: flex; align-items: center; gap: 4px;">
            <span class="hud-label">RATE:</span>
            <input type="range" id="slicer-rate-slider" class="abd-slider" min="0" max="200" value="66" step="1" style="width: 60px;" />
            <span class="hud-value stat-num" id="slicer-rate-val">66</span>
          </div>
          <div class="hud-pill" style="display: flex; align-items: center; gap: 4px;">
            <span class="hud-label">DEP:</span>
            <input type="range" id="slicer-depth-slider" class="abd-slider" min="0" max="127" value="0" step="1" style="width: 60px;" />
            <span class="hud-value stat-num" id="slicer-depth-val">0</span>
          </div>
        </div>

        <!-- Filter -->
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="panel-badge">FILTER</span>
          <div class="hud-pill" style="display: flex; align-items: center; gap: 4px;">
            <span class="hud-label">CUT:</span>
            <input type="range" id="filter-freq-slider" class="abd-slider" min="0" max="127" value="100" step="1" style="width: 65px;" />
            <span class="hud-value stat-num" id="filter-freq-val">100</span>
          </div>
          <div class="hud-pill" style="display: flex; align-items: center; gap: 4px;">
            <span class="hud-label">RESO:</span>
            <input type="range" id="filter-reso-slider" class="abd-slider" min="0" max="127" value="25" step="1" style="width: 55px;" />
            <span class="hud-value stat-num" id="filter-reso-val">0.20</span>
          </div>
        </div>

        <!-- Silver FX -->
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="panel-badge">SILVER FX</span>
          <button type="button" class="btn btn-xs btn-outline" id="btn-cycle-freqfx-bar" title="Change Frequency Effect">FREQ: <strong id="cur-freq-fx-val-bar">RingMod</strong></button>
          <button type="button" class="btn btn-xs btn-outline" id="btn-cycle-timefx-bar" title="Change Time Effect">TIME: <strong id="cur-time-fx-val-bar">Chorus</strong></button>
          <button type="button" class="btn btn-xs btn-primary" id="btn-edit-silver-bar" title="Expanded Silver & Master FX Rack">Edit Rack</button>
        </div>
      </section>

      <!-- 2. Fila Media: Shaper 1 (izq, span 2), Shaper 2 (centro, span 2), Shaper 3 (der, span 2) -->
      <div class="synth-row" id="row-middle" data-row-id="row-middle">
        <div id="shapers-mount" style="grid-column: 1 / -1; display: contents;"></div>
      </div>

      <!-- 3. Fila Inferior: Controllers (izq, span 2), Expansión Auxiliar (centro+media der, span 3), Master (der, span 1) -->
      <div class="synth-row" id="row-bottom" data-row-id="row-bottom">
        <div id="controllers-mount" class="col-span-2"></div>
        <section class="synth-panel-card col-span-3 aux-expansion-card" id="aux-panel" style="display: flex; flex-direction: column;">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08));">
            <span class="stick-label">EXPANSION</span>
            <div class="panel-actions" style="display: flex; align-items: center; gap: 4px;">
              <span class="hud-pill" style="font-size: 8.5px; opacity: 0.6;">RESERVED</span>
              <button type="button" class="btn btn-xs btn-outline btn-collapse-row" data-row="row-bottom" title="Colapsar / Descolapsar fila">▾</button>
            </div>
          </div>
          <div class="panel-body aux-body" data-collapse-body style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 120px; border: 1px dashed var(--color-panel-border-dim, rgba(255,255,255,0.12)); border-radius: var(--radius-sm, 4px); margin: 4px 0;">
            <span style="font-size: 10px; color: var(--color-text-muted); letter-spacing: 1px; text-transform: uppercase;">Módulo de Expansión Auxiliar</span>
          </div>
        </section>
        <div id="master-mount" class="col-span-1"></div>
      </div>
    </div>
  `;
  app.appendChild(workspace);

  // 3. Franja inferior de teclado interactivo (@abdsynths/midi-keyb)
  const keyboardSection = document.createElement('footer');
  keyboardSection.className = 'keyboard-container keyboard-section';
  app.appendChild(keyboardSection);

  new KeyboardStrip(keyboardSection, {
    onNotePress: (midiNote, velocity) => {
      WebBridge.noteOn(midiNote, velocity ?? 0.85);
    },
    onNoteRelease: (midiNote) => {
      WebBridge.noteOff(midiNote);
    },
    onPitchBend: (val) => {
      WebBridge.pitchBend(val);
    },
    onModWheel: (val) => {
      WebBridge.modWheel(val);
    },
    onAftertouch: (val) => {
      WebBridge.channelPressure(val);
    },
    onPanic: () => {
      WebBridge.allNotesOff();
    },
    onSustainChange: (active) => {
      WebBridge.sendMidiCC(64, active ? 127 : 0);
    },
  });

  // 4. Gestor universal de paneles deslizantes (Drawers - 50vw desde la derecha)
  const drawerManager = new DrawerManager(app);

  let targetResynatorForModelPick: 1 | 2 = 1;
  let bankDrawer: BankDrawer;
  let navbar: AxionikNavbar | null = null;
  let currentZoom = parseFloat(document.body.style.zoom) || 1.0;
  let currentR1ModelName = '511 sinew';
  let currentR2ModelName = '511 sinew';

  const applyTheme = (theme: string) => {
    themeManager.setTheme(theme);
    navbar?.setTheme(theme);
  };

  const applyZoom = (zoom: number) => {
    currentZoom = zoom;
    document.body.style.zoom = String(zoom);
    navbar?.setZoom(zoom);
  };

  const updateResynatorModelUI = (resynator: 1 | 2, slot: number, name?: string) => {
    const isR1 = resynator === 1;
    const captionEl = document.getElementById(isR1 ? 'r1-model-caption' : 'r2-model-caption');
    const slotEl = document.getElementById(isR1 ? 'r1-model-slot' : 'r2-model-slot');

    if (slotEl) {
      slotEl.textContent = `#${String(slot).padStart(3, '0')}`;
    }

    let modelName = name;
    if (!modelName && bankDrawer) {
      const found = bankDrawer.getBank().models.find((m) => m.slot === slot);
      if (found && found.name) {
        modelName = found.name;
      }
    }
    if (!modelName) {
      modelName = getCanonicalModelName(slot);
    }

    if (isR1) {
      currentR1ModelName = modelName;
    } else {
      currentR2ModelName = modelName;
    }

    if (captionEl) {
      captionEl.textContent = modelName;
      captionEl.title = `Model #${slot}: ${modelName}`;
    }
  };

  // Funciones para abrir paneles expandidos (Resynator 1/2 y Silver Rack)
  const openR1Drawer = () => {
    const content = ResynatorDrawer.createContent({
      resynator: 1,
      modelName: currentR1ModelName,
      onClose: () => drawerManager.close(),
      onSelectModel: (resynator) => {
        targetResynatorForModelPick = resynator;
        bankDrawer?.open('models', 'r1');
      },
    });
    drawerManager.openCustom('r1-expanded', content);
  };

  const openR2Drawer = () => {
    const content = ResynatorDrawer.createContent({
      resynator: 2,
      modelName: currentR2ModelName,
      onClose: () => drawerManager.close(),
      onSelectModel: (resynator) => {
        targetResynatorForModelPick = resynator;
        bankDrawer?.open('models', 'r2');
      },
    });
    drawerManager.openCustom('r2-expanded', content);
  };

  const openEffectsDrawer = (initialBlock: 'all' | 'silver' | 'master' = 'all') => {
    const content = EffectsDrawer.createContent({
      initialBlock,
      onClose: () => drawerManager.close(),
    });
    drawerManager.openCustom('effects-rack', content);
  };

  const openSilverDrawer = () => openEffectsDrawer('silver');
  const openMasterFxDrawer = () => openEffectsDrawer('master');

  const openBlenderDrawer = () => {
    const content = BlenderDrawer.createContent({
      onClose: () => drawerManager.close(),
    });
    drawerManager.openCustom('blender-expanded', content);
  };

  const openMatrixDrawer = (initialTab: 'all' | 'midi' | 'controllers' = 'all') => {
    const content = MatrixDrawer.createContent({
      initialTab,
      onClose: () => drawerManager.close(),
    });
    drawerManager.openCustom('matrix-expanded', content);
  };

  const openSettingsDrawer = () => {
    const content = SettingsDrawer.createContent({
      onClose: () => drawerManager.close(),
      onConfigureFolder: () => bankDrawer.promptConfigureFolder(),
      onSelectTheme: (theme) => {
        applyTheme(theme);
      },
      onZoom: (zoom) => {
        applyZoom(zoom);
      },
      currentTheme: themeManager.getCurrentTheme(),
      currentZoom,
    });
    drawerManager.openCustom('settings-expanded', content);
  };

  // 5. Instanciar los 4 controladores vectoriales 2D (Trajectory Sticks)
  const r1ScapeMount = document.getElementById('r1-scape-mount');
  const r1SphereMount = document.getElementById('r1-sphere-mount');
  const r2ScapeMount = document.getElementById('r2-scape-mount');
  const r2SphereMount = document.getElementById('r2-sphere-mount');

  let r1ScapeStick: TrajectoryStick2D | null = null;
  let r1SphereStick: TrajectoryStick2D | null = null;
  let r2ScapeStick: TrajectoryStick2D | null = null;
  let r2SphereStick: TrajectoryStick2D | null = null;

  if (r1ScapeMount) {
    r1ScapeStick = new TrajectoryStick2D(r1ScapeMount, {
      label: 'SCAPE 1',
      resynator: 1,
      domain: 'scape',
      labelsPerLayer: getParameterSetStickLabels(0, 'scape'),
      onPositionChange: (layerIdx, coord) => {
        const paramX = layerIdx === 0 ? ParamIdx.R1L1Scape1Value : (layerIdx === 1 ? ParamIdx.R1L2Scape1Value : ParamIdx.R1L3Scape1Value);
        const paramY = layerIdx === 0 ? ParamIdx.R1L1Scape2Value : (layerIdx === 1 ? ParamIdx.R1L2Scape2Value : ParamIdx.R1L3Scape2Value);
        WebBridge.setParam(paramX, coord.x);
        WebBridge.setParam(paramY, coord.y);
      },
    });
  }

  if (r1SphereMount) {
    r1SphereStick = new TrajectoryStick2D(r1SphereMount, {
      label: 'SPHERE 1',
      resynator: 1,
      domain: 'sphere',
      labelsPerLayer: getParameterSetStickLabels(0, 'sphere'),
      onPositionChange: (layerIdx, coord) => {
        const paramX = layerIdx === 0 ? ParamIdx.R1L1Sphere1Value : (layerIdx === 1 ? ParamIdx.R1L2Sphere1Value : ParamIdx.R1L3Sphere1Value);
        const paramY = layerIdx === 0 ? ParamIdx.R1L1Sphere2Value : (layerIdx === 1 ? ParamIdx.R1L2Sphere2Value : ParamIdx.R1L3Sphere2Value);
        WebBridge.setParam(paramX, coord.x);
        WebBridge.setParam(paramY, coord.y);
      },
    });
  }

  if (r2ScapeMount) {
    r2ScapeStick = new TrajectoryStick2D(r2ScapeMount, {
      label: 'SCAPE 2',
      resynator: 2,
      domain: 'scape',
      labelsPerLayer: getParameterSetStickLabels(0, 'scape'),
      onPositionChange: (layerIdx, coord) => {
        const paramX = layerIdx === 0 ? ParamIdx.R2L1Scape1Value : (layerIdx === 1 ? ParamIdx.R2L2Scape1Value : ParamIdx.R2L3Scape1Value);
        const paramY = layerIdx === 0 ? ParamIdx.R2L1Scape2Value : (layerIdx === 1 ? ParamIdx.R2L2Scape2Value : ParamIdx.R2L3Scape2Value);
        WebBridge.setParam(paramX, coord.x);
        WebBridge.setParam(paramY, coord.y);
      },
    });
  }

  if (r2SphereMount) {
    r2SphereStick = new TrajectoryStick2D(r2SphereMount, {
      label: 'SPHERE 2',
      resynator: 2,
      domain: 'sphere',
      labelsPerLayer: getParameterSetStickLabels(0, 'sphere'),
      onPositionChange: (layerIdx, coord) => {
        const paramX = layerIdx === 0 ? ParamIdx.R2L1Sphere1Value : (layerIdx === 1 ? ParamIdx.R2L2Sphere1Value : ParamIdx.R2L3Sphere1Value);
        const paramY = layerIdx === 0 ? ParamIdx.R2L1Sphere2Value : (layerIdx === 1 ? ParamIdx.R2L2Sphere2Value : ParamIdx.R2L3Sphere2Value);
        WebBridge.setParam(paramX, coord.x);
        WebBridge.setParam(paramY, coord.y);
      },
    });
  }

  // 6. Instanciar el bloque frontal de Controladores Hardware («Controllers»), Silver y Master Output
  let controllersPanel: ControllersPanel | null = null;
  const controllersMount = document.getElementById('controllers-mount');
  if (controllersMount) {
    controllersPanel = new ControllersPanel(controllersMount, {
      onEdit: () => openMatrixDrawer('controllers'),
    });
  }

  let silverPanel: SilverPanel | null = null;
  const silverMount = document.getElementById('silver-mount');
  if (silverMount) {
    silverPanel = new SilverPanel(silverMount, {
      onEditSilver: () => openSilverDrawer(),
    });
  }

  const masterMount = document.getElementById('master-mount');
  if (masterMount) {
    new MasterOutputPanel(masterMount);
  }

  // 7. Instanciar el bloque central de SHAPERS (1, 2 y 3)
  let shapersPanel: ShapersPanel | null = null;
  const shapersMount = document.getElementById('shapers-mount');
  if (shapersMount) {
    shapersPanel = new ShapersPanel(shapersMount, {
      onEditR1: openR1Drawer,
      onEditR2: openR2Drawer,
      onEditSilver: openSilverDrawer,
    });
  }

  // Conectar botones Edit R1, Edit R2, R1/R2 Switch, Model Selection, Edit Blender y Edit Silver Rack
  const updateResySwitchButton = (resy: 1 | 2, enabled: boolean) => {
    const btn = document.getElementById(resy === 1 ? 'btn-toggle-r1' : 'btn-toggle-r2');
    if (!btn) return;
    btn.classList.toggle('active', enabled);
    btn.classList.toggle('btn-primary', enabled);
    btn.classList.toggle('btn-outline', !enabled);
    btn.textContent = `R${resy} ${enabled ? 'ON' : 'OFF'}`;
  };

  document.getElementById('btn-toggle-r1')?.addEventListener('click', () => {
    const next = WebBridge.getParam(ParamIdx.R1Switch, 1) < 0.5;
    updateResySwitchButton(1, next);
    WebBridge.setParam(ParamIdx.R1Switch, next ? 1 : 0);
  });
  document.getElementById('btn-toggle-r2')?.addEventListener('click', () => {
    const next = WebBridge.getParam(ParamIdx.R2Switch, 1) < 0.5;
    updateResySwitchButton(2, next);
    WebBridge.setParam(ParamIdx.R2Switch, next ? 1 : 0);
  });
  document.getElementById('btn-edit-r1')?.addEventListener('click', openR1Drawer);
  document.getElementById('btn-edit-r2')?.addEventListener('click', openR2Drawer);
  document.getElementById('btn-select-model-r1')?.addEventListener('click', () => {
    targetResynatorForModelPick = 1;
    bankDrawer?.open('models', 'r1');
  });
  document.getElementById('btn-select-model-r2')?.addEventListener('click', () => {
    targetResynatorForModelPick = 2;
    bankDrawer?.open('models', 'r2');
  });
  document.getElementById('btn-edit-silver')?.addEventListener('click', openSilverDrawer);
  document.getElementById('btn-edit-blender')?.addEventListener('click', openBlenderDrawer);

  // 8. Gestor de colapso y descolapso sincronizado por fila (Row Collapse)
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.btn-collapse-row') as HTMLButtonElement | null;
    if (!btn) return;
    const rowId = btn.getAttribute('data-row');
    if (!rowId) return;
    const rowEl = document.getElementById(rowId);
    if (!rowEl) return;
    const isCollapsed = rowEl.classList.toggle('is-row-collapsed');
    const rowButtons = document.querySelectorAll<HTMLButtonElement>(`.btn-collapse-row[data-row="${rowId}"]`);
    rowButtons.forEach((b) => {
      b.textContent = isCollapsed ? '▴' : '▾';
      b.setAttribute('title', isCollapsed ? 'Descolapsar fila' : 'Colapsar fila');
    });
  });

  // 6. Controles centrales (Blender, Slicer, Filtro y Silver FX)
  let curBlenderAlgoIdx = 0;
  const btnCycleBlender = document.getElementById('btn-cycle-blender-algo');
  const curBlenderVal = document.getElementById('cur-blender-algo-val');
  btnCycleBlender?.addEventListener('click', () => {
    curBlenderAlgoIdx = (curBlenderAlgoIdx + 1) % BLENDER_ALGORITHMS.length;
    if (curBlenderVal) curBlenderVal.textContent = BLENDER_ALGORITHMS[curBlenderAlgoIdx].name;
    WebBridge.setParam(ParamIdx.BlenderType, curBlenderAlgoIdx);
  });

  const blenderSlider = document.getElementById('blender-slider') as HTMLInputElement | null;
  const blenderVal = document.getElementById('blender-amount-val');
  blenderSlider?.addEventListener('input', () => {
    const val = parseFloat(blenderSlider.value);
    if (blenderVal) blenderVal.textContent = String(val);
    WebBridge.setParam(ParamIdx.BlenderAmount, val);
  });

  const slicerTypes = ['Off', '2D', '3D'];
  let curSlicerTypeIdx = 0;
  const btnCycleSlicer = document.getElementById('btn-cycle-slicer-type');
  const curSlicerTypeVal = document.getElementById('cur-slicer-type-val');
  btnCycleSlicer?.addEventListener('click', () => {
    curSlicerTypeIdx = (curSlicerTypeIdx + 1) % slicerTypes.length;
    if (curSlicerTypeVal) curSlicerTypeVal.textContent = slicerTypes[curSlicerTypeIdx];
    WebBridge.setParam(ParamIdx.SlicerSwitchType, curSlicerTypeIdx);
  });

  const slicerRateSlider = document.getElementById('slicer-rate-slider') as HTMLInputElement | null;
  const slicerRateVal = document.getElementById('slicer-rate-val');
  slicerRateSlider?.addEventListener('input', () => {
    const val = parseFloat(slicerRateSlider.value);
    if (slicerRateVal) slicerRateVal.textContent = String(val);
    WebBridge.setParam(ParamIdx.SlicerRate, val);
  });

  const slicerDepthSlider = document.getElementById('slicer-depth-slider') as HTMLInputElement | null;
  const slicerDepthVal = document.getElementById('slicer-depth-val');
  slicerDepthSlider?.addEventListener('input', () => {
    const val = parseFloat(slicerDepthSlider.value);
    if (slicerDepthVal) slicerDepthVal.textContent = String(val);
    WebBridge.setParam(ParamIdx.SlicerDepth, val);
  });

  const filterCutSlider = document.getElementById('filter-freq-slider') as HTMLInputElement | null;
  const filterCutVal = document.getElementById('filter-freq-val');
  filterCutSlider?.addEventListener('input', () => {
    const val = parseFloat(filterCutSlider.value);
    if (filterCutVal) filterCutVal.textContent = String(val);
    WebBridge.setParam(ParamIdx.FilterFreq, val);
    silverPanel?.updateSilver(ParamIdx.FilterFreq);
  });

  const filterResoSlider = document.getElementById('filter-reso-slider') as HTMLInputElement | null;
  const filterResoVal = document.getElementById('filter-reso-val');
  filterResoSlider?.addEventListener('input', () => {
    const val = parseFloat(filterResoSlider.value);
    if (filterResoVal) filterResoVal.textContent = (val / 127).toFixed(2);
    WebBridge.setParam(ParamIdx.FilterReso, val);
    silverPanel?.updateSilver(ParamIdx.FilterReso);
  });

  document.getElementById('btn-edit-silver-bar')?.addEventListener('click', openSilverDrawer);

  const btnCycleFreqBar = document.getElementById('btn-cycle-freqfx-bar');
  const curFreqValBar = document.getElementById('cur-freq-fx-val-bar');
  btnCycleFreqBar?.addEventListener('click', () => {
    const cur = Math.round(WebBridge.getParam(ParamIdx.CurFreqFX, 2));
    const next = (cur + 1) % FREQ_ALGO_NAMES.length;
    WebBridge.setParam(ParamIdx.CurFreqFX, next);
    if (curFreqValBar) curFreqValBar.textContent = FREQ_ALGO_NAMES[next];
    silverPanel?.updateFreqAlgo(FREQ_ALGO_NAMES[next]);
  });

  const btnCycleTimeBar = document.getElementById('btn-cycle-timefx-bar');
  const curTimeValBar = document.getElementById('cur-time-fx-val-bar');
  btnCycleTimeBar?.addEventListener('click', () => {
    const cur = Math.round(WebBridge.getParam(ParamIdx.CurTimeFX, 4));
    const next = (cur + 1) % TIME_ALGO_NAMES.length;
    WebBridge.setParam(ParamIdx.CurTimeFX, next);
    if (curTimeValBar) curTimeValBar.textContent = TIME_ALGO_NAMES[next];
    silverPanel?.updateTimeAlgo(TIME_ALGO_NAMES[next]);
  });

  const applyAllParamsToUI = (values: number[]) => {
    if (!Array.isArray(values) || values.length === 0) return;

    // R1 Model & R2 Model + Switches
    const r1Slot = Math.round(values[ParamIdx.R1ModellIndex] ?? 511);
    const r2Slot = Math.round(values[ParamIdx.R2ModellIndex] ?? 511);
    updateResySwitchButton(1, (values[ParamIdx.R1Switch] ?? 1) > 0.5);
    updateResySwitchButton(2, (values[ParamIdx.R2Switch] ?? 1) > 0.5);
    const r1Name = getCanonicalModelName(r1Slot);
    const r2Name = getCanonicalModelName(r2Slot);

    updateResynatorModelUI(1, r1Slot, r1Name);
    updateResynatorModelUI(2, r2Slot, r2Name);
    navbar.setModelName(1, `#${String(r1Slot).padStart(3, '0')} ${r1Name}`);
    navbar.setModelName(2, `#${String(r2Slot).padStart(3, '0')} ${r2Name}`);

    // Update stick polar labels based on model parameter sets
    const r1Meta = MODEL_METADATA[r1Slot];
    const r1ParSet = r1Meta ? r1Meta[0] : (r1Slot % 10);
    r1ScapeStick?.setAllLayerLabels(getParameterSetStickLabels(r1ParSet, 'scape'));
    r1SphereStick?.setAllLayerLabels(getParameterSetStickLabels(r1ParSet, 'sphere'));

    const r2Meta = MODEL_METADATA[r2Slot];
    const r2ParSet = r2Meta ? r2Meta[0] : (r2Slot % 10);
    r2ScapeStick?.setAllLayerLabels(getParameterSetStickLabels(r2ParSet, 'scape'));
    r2SphereStick?.setAllLayerLabels(getParameterSetStickLabels(r2ParSet, 'sphere'));

    // Blender
    const blenderAlgo = Math.round(values[ParamIdx.BlenderType] ?? 0);
    curBlenderAlgoIdx = Math.max(0, Math.min(BLENDER_ALGORITHMS.length - 1, blenderAlgo));
    if (curBlenderVal) curBlenderVal.textContent = BLENDER_ALGORITHMS[curBlenderAlgoIdx].name;

    const blenderAmount = Math.round(values[ParamIdx.BlenderAmount] ?? 0);
    if (blenderSlider) blenderSlider.value = String(blenderAmount);
    if (blenderVal) blenderVal.textContent = String(blenderAmount);

    // Slicer
    const slicerMode = Math.round(values[ParamIdx.SlicerSwitchType] ?? 0);
    curSlicerTypeIdx = Math.max(0, Math.min(slicerTypes.length - 1, slicerMode));
    if (curSlicerTypeVal) curSlicerTypeVal.textContent = slicerTypes[curSlicerTypeIdx];

    const slicerDepth = Math.round(values[ParamIdx.SlicerDepth] ?? 0);
    if (slicerDepthSlider) slicerDepthSlider.value = String(slicerDepth);
    if (slicerDepthVal) slicerDepthVal.textContent = String(slicerDepth);

    const slicerRate = Math.round(values[ParamIdx.SlicerRate] ?? 66);
    if (slicerRateSlider) slicerRateSlider.value = String(slicerRate);
    if (slicerRateVal) slicerRateVal.textContent = String(slicerRate);

    // Filter
    const filterCut = Math.round(values[ParamIdx.FilterFreq] ?? 100);
    if (filterCutSlider) filterCutSlider.value = String(filterCut);
    if (filterCutVal) filterCutVal.textContent = String(filterCut);

    const filterReso = Math.round(values[ParamIdx.FilterReso] ?? 25);
    if (filterResoSlider) filterResoSlider.value = String(filterReso);
    if (filterResoVal) filterResoVal.textContent = (filterReso / 127).toFixed(2);

    // Silver FX (los readouts ahora viven en SilverPanel, igual que en PARAM_UPDATE)
    const freqAlgo = Math.max(0, Math.min(FREQ_ALGO_NAMES.length - 1, Math.round(values[ParamIdx.CurFreqFX] ?? 2)));
    silverPanel?.updateFreqAlgo(FREQ_ALGO_NAMES[freqAlgo]);

    const timeAlgo = Math.max(0, Math.min(TIME_ALGO_NAMES.length - 1, Math.round(values[ParamIdx.CurTimeFX] ?? 1)));
    silverPanel?.updateTimeAlgo(TIME_ALGO_NAMES[timeAlgo]);

    // Sticks 2D Positions:
    if (r1ScapeStick) {
      r1ScapeStick.setPosition(0, Math.max(0, Math.min(1, (values[ParamIdx.R1L1Scape1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R1L1Scape2Value] ?? 64) / 127)), false);
      r1ScapeStick.setPosition(1, Math.max(0, Math.min(1, (values[ParamIdx.R1L2Scape1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R1L2Scape2Value] ?? 64) / 127)), false);
      r1ScapeStick.setPosition(2, Math.max(0, Math.min(1, (values[ParamIdx.R1L3Scape1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R1L3Scape2Value] ?? 64) / 127)), false);
    }

    if (r1SphereStick) {
      r1SphereStick.setPosition(0, Math.max(0, Math.min(1, (values[ParamIdx.R1L1Sphere1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R1L1Sphere2Value] ?? 64) / 127)), false);
      r1SphereStick.setPosition(1, Math.max(0, Math.min(1, (values[ParamIdx.R1L2Sphere1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R1L2Sphere2Value] ?? 64) / 127)), false);
      r1SphereStick.setPosition(2, Math.max(0, Math.min(1, (values[ParamIdx.R1L3Sphere1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R1L3Sphere2Value] ?? 64) / 127)), false);
    }

    if (r2ScapeStick) {
      r2ScapeStick.setPosition(0, Math.max(0, Math.min(1, (values[ParamIdx.R2L1Scape1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R2L1Scape2Value] ?? 64) / 127)), false);
      r2ScapeStick.setPosition(1, Math.max(0, Math.min(1, (values[ParamIdx.R2L2Scape1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R2L2Scape2Value] ?? 64) / 127)), false);
      r2ScapeStick.setPosition(2, Math.max(0, Math.min(1, (values[ParamIdx.R2L3Scape1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R2L3Scape2Value] ?? 64) / 127)), false);
    }

    if (r2SphereStick) {
      r2SphereStick.setPosition(0, Math.max(0, Math.min(1, (values[ParamIdx.R2L1Sphere1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R2L1Sphere2Value] ?? 64) / 127)), false);
      r2SphereStick.setPosition(1, Math.max(0, Math.min(1, (values[ParamIdx.R2L2Sphere1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R2L2Sphere2Value] ?? 64) / 127)), false);
      r2SphereStick.setPosition(2, Math.max(0, Math.min(1, (values[ParamIdx.R2L3Sphere1Value] ?? 64) / 127)), Math.max(0, Math.min(1, (values[ParamIdx.R2L3Sphere2Value] ?? 64) / 127)), false);
    }
  };

  // 7. Gestor de Banco y Modelos NeuronDB (BankDrawer montado en el Drawer universal)
  bankDrawer = new BankDrawer(drawerManager, {
    onSelectModel: (slot, resynator) => {
      const targetR = resynator || targetResynatorForModelPick;
      const model = bankDrawer.getBank().models.find((m) => m.slot === slot);
      const modelName = model ? model.name : `Model #${String(slot).padStart(3, '0')}`;
      updateResynatorModelUI(targetR, slot, modelName);
      navbar.setModelName(targetR, `#${String(slot).padStart(3, '0')} ${modelName}`);

      // Actualizar dinámicamente las etiquetas mnAN de los 4 polos según el Parameter Set del modelo
      const parSet = model ? model.parameterSet : (slot % 10);
      if (targetR === 1) {
        r1ScapeStick?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'scape'));
        r1SphereStick?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'sphere'));
        WebBridge.setParam(ParamIdx.R1ModellIndex, slot);
      } else {
        r2ScapeStick?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'scape'));
        r2SphereStick?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'sphere'));
        WebBridge.setParam(ParamIdx.R2ModellIndex, slot);
      }

      WebBridge.loadModelSlot(slot, targetR);
      console.log(`[ABDAxionikVS] Assigned Model #${slot} (${modelName}, ParSet ${parSet}) to Resynator ${targetR}`);
    },
    onSelectPreset: (slot, name) => {
      const pInfo = getCanonicalPresetInfo(slot);
      const displayName = name || pInfo.name;
      navbar.setPresetName(`${String(slot).padStart(3, '0')} ${displayName}`);

      const r1Name = getCanonicalModelName(pInfo.r1Model);
      const r2Name = getCanonicalModelName(pInfo.r2Model);
      updateResynatorModelUI(1, pInfo.r1Model, r1Name);
      updateResynatorModelUI(2, pInfo.r2Model, r2Name);
      navbar.setModelName(1, `#${String(pInfo.r1Model).padStart(3, '0')} ${r1Name}`);
      navbar.setModelName(2, `#${String(pInfo.r2Model).padStart(3, '0')} ${r2Name}`);

      const r1Meta = MODEL_METADATA[pInfo.r1Model];
      const r1ParSet = r1Meta ? r1Meta[0] : (pInfo.r1Model % 10);
      r1ScapeStick?.setAllLayerLabels(getParameterSetStickLabels(r1ParSet, 'scape'));
      r1SphereStick?.setAllLayerLabels(getParameterSetStickLabels(r1ParSet, 'sphere'));

      const r2Meta = MODEL_METADATA[pInfo.r2Model];
      const r2ParSet = r2Meta ? r2Meta[0] : (pInfo.r2Model % 10);
      r2ScapeStick?.setAllLayerLabels(getParameterSetStickLabels(r2ParSet, 'scape'));
      r2SphereStick?.setAllLayerLabels(getParameterSetStickLabels(r2ParSet, 'sphere'));

      WebBridge.loadPresetSlot(slot);
      console.log(`[ABDAxionikVS] Loaded Sound Preset #${slot} "${displayName}" (R1: #${pInfo.r1Model} ${r1Name}, R2: #${pInfo.r2Model} ${r2Name})`);
    },
    onConfigureNeuronDbFolder: () => {
      bankDrawer.promptConfigureFolder();
    },
  });

  // 6. Inicializar Navbar Universal (SynthNavBar)
  navbar = new AxionikNavbar(navContainer, {
    onConfigureFolder: () => {
      bankDrawer.promptConfigureFolder();
    },
    onImportModelFolder: () => {
      bankDrawer.promptConfigureFolder();
    },
    onImportModelZip: () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.zip,.modelzip';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      fileInput.addEventListener('change', () => {
        if (fileInput.files?.[0]) {
          console.log(`[ABDAxionikVS] Model package selected: ${fileInput.files[0].name}`);
        }
        fileInput.remove();
      });
      fileInput.click();
    },
    onLoadPreset: () => {
      bankDrawer.open('presets', 'global');
    },
    onSavePreset: () => {
      console.log('[ABDAxionikVS] Save Preset: Custom preset export available via bank manager.');
    },
    onInitPreset: () => {
      WebBridge.initPreset();
      navbar?.setPresetName('000 InitSound');
      navbar?.setModelName(1, '511 sinew');
      navbar?.setModelName(2, '511 sinew');
      updateResynatorModelUI(1, 511, '511 sinew');
      updateResynatorModelUI(2, 511, '511 sinew');
      console.log('[ABDAxionikVS] Sound initialized to factory default.');
    },
    onToggleBank: () => {
      bankDrawer.toggle('models', 'global');
    },
    onToggleMatrix: () => {
      openMatrixDrawer();
    },
    onToggleMfx: () => {
      openMasterFxDrawer();
    },
    onToggleSettings: () => {
      openSettingsDrawer();
    },
    onSelectPreset: () => {
      bankDrawer.open('presets', 'global');
    },
    onSelectModel: (resynator) => {
      targetResynatorForModelPick = resynator;
      bankDrawer.open('models', resynator === 1 ? 'r1' : 'r2');
    },
    onSelectTheme: (theme) => {
      applyTheme(theme);
    },
    onToggleTheme: () => {
      const nextTheme = themeManager.cycleTheme();
      navbar?.setTheme(nextTheme);
    },
    onZoom: (zoomLevel) => {
      applyZoom(zoomLevel);
    },
  });

  // Sincronizar estado inicial de tema y zoom en la Navbar
  navbar.setTheme(themeManager.getCurrentTheme());
  navbar.setZoom(currentZoom);

  // 7. Gestor Drag & Drop para modelos, presets y paquetes zip
  new DragDropHandler({
    onDropModel: (file, targetR) => {
      const match = file.name.match(/^(\d{1,4})/);
      const slot = match ? parseInt(match[1], 10) : (targetR === 1 ? 42 : 511);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      navbar.setModelName(targetR, `#${String(slot).padStart(3, '0')} ${cleanName}`);
      updateResynatorModelUI(targetR, slot, cleanName);

      const parSet = (slot % 10);
      if (targetR === 1) {
        r1ScapeStick?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'scape'));
        r1SphereStick?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'sphere'));
        WebBridge.setParam(ParamIdx.R1ModellIndex, slot);
      } else {
        r2ScapeStick?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'scape'));
        r2SphereStick?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'sphere'));
        WebBridge.setParam(ParamIdx.R2ModellIndex, slot);
      }
      WebBridge.loadModelSlot(slot, targetR);
      console.log(`[ABDAxionikVS] DragDrop: Loaded model "${file.name}" to R${targetR} (Slot ${slot}, ParSet ${parSet})`);
    },
    onDropPreset: async (file) => {
      let presetName = file.name.replace(/\.[^/.]+$/, '');
      try {
        const text = await file.text();
        WebBridge.loadPresetScript(text);
        const lines = text.split('\n');
        for (const line of lines.slice(0, 30)) {
          const m = line.match(/(?:soundname|name|preset)\s*[:=]?\s*["']?([^"'\r\n]+)["']?/i);
          if (m && m[1].trim()) {
            presetName = m[1].trim();
            break;
          }
        }
      } catch (_err) {
        // En caso de preset binario / fxp, mantener nombre de fichero
      }
      navbar.setPresetName(presetName);
      console.log(`[ABDAxionikVS] DragDrop: Loaded preset "${presetName}"`);
    },
    onDropZip: (file) => {
      console.log(`[ABDAxionikVS] DragDrop: Model package dropped "${file.name}"`);
    },
  });

  // 8. Atajos globales de teclado
  const { setupKeyboardShortcuts } = await import('./app/keyboardShortcuts.js');
  setupKeyboardShortcuts(bankDrawer, navbar, openSettingsDrawer);

  // Contexto para el manejador PARAM_UPDATE (módulo app/paramUpdate.ts)
  const paramUpdateCtx: ParamUpdateCtx = {
    updateResySwitchButton,
    updateResynatorModelUI,
    setModelName: (r, text) => navbar?.setModelName(r, text),
    r1ScapeStick,
    r1SphereStick,
    r2ScapeStick,
    r2SphereStick,
    blender: {
      slider: blenderSlider,
      sliderLabel: blenderVal,
      setIdx: (v) => {
        curBlenderAlgoIdx = v;
        if (curBlenderVal) curBlenderVal.textContent = BLENDER_ALGORITHMS[v].name;
      },
    },
    slicer: {
      depthSlider: slicerDepthSlider,
      depthLabel: slicerDepthVal,
      rateSlider: slicerRateSlider,
      rateLabel: slicerRateVal,
      setIdx: (v) => {
        curSlicerTypeIdx = v;
        if (curSlicerTypeVal) curSlicerTypeVal.textContent = slicerTypes[v];
      },
    },
    filter: {
      cutSlider: filterCutSlider,
      cutLabel: filterCutVal,
      resoSlider: filterResoSlider,
      resoLabel: filterResoVal,
    },
    freqFx: {
      setIdx: (v) => {
        silverPanel?.updateFreqAlgo(FREQ_ALGO_NAMES[v]);
      },
    },
    timeFx: {
      setIdx: (v) => {
        silverPanel?.updateTimeAlgo(TIME_ALGO_NAMES[v]);
      },
    },
    shapersPanel,
  };

  // 8. Suscribir telemetría y actualización de parámetros del bridge nativo
  WebBridge.onMessage((msg) => {
    if (msg.type === 'BANK_CATALOG_SYNC') {
      // El payload viaja sin tipar por el bridge; se adapta a la forma que espera BankDrawer.
      bankDrawer.syncCatalogFromHost(msg as Parameters<BankDrawer['syncCatalogFromHost']>[0]);
    } else if (msg.type === 'PRESET_LOADED') {
      if (typeof msg.name === 'string' && msg.name) {
        navbar.setPresetName(msg.name);
      }
      const r1 = typeof msg.r1Model === 'number' ? msg.r1Model : 511;
      const r2 = typeof msg.r2Model === 'number' ? msg.r2Model : 511;
      const r1Name = getCanonicalModelName(r1);
      const r2Name = getCanonicalModelName(r2);
      updateResynatorModelUI(1, r1, r1Name);
      updateResynatorModelUI(2, r2, r2Name);
      navbar.setModelName(1, `#${String(r1).padStart(3, '0')} ${r1Name}`);
      navbar.setModelName(2, `#${String(r2).padStart(3, '0')} ${r2Name}`);

      if (Array.isArray(msg.values)) {
        applyAllParamsToUI(msg.values);
      }
      controllersPanel?.updateLabels();
      silverPanel?.updateSilver();
      shapersPanel?.syncAll();
    } else if (msg.type === 'TELEMETRY') {
      if (typeof msg.activeVoices === 'number') navbar.setVoices(msg.activeVoices);
      if (typeof msg.cpuUsage === 'number') navbar.setCpuLoad(msg.cpuUsage);
    } else if (msg.type === 'PARAM_UPDATE') {
      handleParamUpdate(msg.index, msg.value, paramUpdateCtx);
      if (msg.index >= 363 && msg.index <= 428) {
        controllersPanel?.updateLabels();
      }
      if ((msg.index >= 271 && msg.index <= 278) || msg.index === 281 || msg.index === 282 || msg.index === 327 || msg.index === 328) {
        silverPanel?.updateSilver(msg.index);
        if (msg.index === 271) {
          silverPanel?.updateSilverToggle(msg.value > 0.5);
        }
      }
    }
  });

  if ((import.meta as any).env?.DEV) {
    (window as any).__axionikSticks = { r1ScapeStick, r1SphereStick, r2ScapeStick, r2SphereStick };
  }

  // Notificar al host nativo que la WebUI está montada y lista para recibir telemetría
  WebBridge.send({ type: 'UI_READY' });

  // Solicitar catálogo en vivo al host nativo C++
  WebBridge.scanBank();

  console.log(`[ABDAxionikVS] Frontend inicializado (${PARAM_DEFINITIONS.length} parámetros, SynthNavBar montado).`);
});
