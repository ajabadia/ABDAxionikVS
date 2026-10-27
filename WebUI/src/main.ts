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
import { DrawerManager } from './ui/Drawers.js';
import { TrajectoryStick2D } from './ui/TrajectoryStick2D.js';
import { ResynatorDrawer } from './ui/ResynatorDrawer.js';
import { SilverDrawer } from './ui/SilverDrawer.js';
import { WebBridge } from './bridge/WebBridge.js';
import { PARAM_DEFINITIONS } from './generated/parameters.gen.js';

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (!app) return;

  // Themes
  const themes = ['ms2000', 'audiolab', 'audiolab-light', 'advanced', 'cz101'];
  let currentThemeIndex = 0;

  const applyTheme = (theme: string) => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.body.className = `theme-${theme} skin-${theme}`;
  };
  applyTheme('ms2000');

  // 1. Contenedor de Navbar
  const navContainer = document.createElement('header');
  app.appendChild(navContainer);

  // 2. Canvas principal del sintetizador
  const workspace = document.createElement('main');
  workspace.className = 'workspace-canvas';
  workspace.innerHTML = `
    <div class="synth-grid">
      <!-- Columna Resynator 1 -->
      <section class="synth-panel-card resynator-column" id="r1-panel">
        <div class="panel-header">
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <span class="panel-badge">RESYNATOR 1</span>
            <span class="panel-caption">Sphere & Scape Synthesis</span>
          </div>
          <div class="panel-actions" style="display: flex; align-items: center; gap: var(--space-2);">
            <span class="hud-pill stat-num">Model: <strong id="r1-model-label">511 sinew</strong></span>
            <button type="button" class="btn btn-xs" id="btn-edit-r1" title="Expanded Controls">Edit R1</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); flex: 1;">
          <div id="r1-scape-mount"></div>
          <div id="r1-sphere-mount"></div>
        </div>
      </section>

      <!-- Columna Resynator 2 -->
      <section class="synth-panel-card resynator-column" id="r2-panel">
        <div class="panel-header">
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <span class="panel-badge">RESYNATOR 2</span>
            <span class="panel-caption">Sphere & Scape Synthesis</span>
          </div>
          <div class="panel-actions" style="display: flex; align-items: center; gap: var(--space-2);">
            <span class="hud-pill stat-num">Model: <strong id="r2-model-label">511 sinew</strong></span>
            <button type="button" class="btn btn-xs" id="btn-edit-r2" title="Expanded Controls">Edit R2</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); flex: 1;">
          <div id="r2-scape-mount"></div>
          <div id="r2-sphere-mount"></div>
        </div>
      </section>

      <!-- Zona Central: Blender, Filter, Silver FX -->
      <section class="synth-panel-card" style="grid-column: 1 / -1; padding: var(--space-3); display: flex; justify-content: space-between; align-items: center; gap: var(--space-4);">
        <!-- Blender -->
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <span class="panel-badge">BLENDER</span>
          <div class="hud-pill" style="display: flex; align-items: center; gap: 6px;">
            <span class="hud-label">AMOUNT:</span>
            <input type="range" id="blender-slider" min="-64" max="63" value="0" step="1" style="width: 100px;" />
            <span class="hud-value stat-num" id="blender-amount-val">0.50</span>
          </div>
        </div>

        <!-- Filter -->
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <span class="panel-badge">FILTER</span>
          <div class="hud-pill" style="display: flex; align-items: center; gap: 6px;">
            <span class="hud-label">CUT:</span>
            <input type="range" id="filter-freq-slider" min="0" max="127" value="100" step="1" style="width: 80px;" />
            <span class="hud-value stat-num" id="filter-freq-val">100</span>
          </div>
          <div class="hud-pill" style="display: flex; align-items: center; gap: 6px;">
            <span class="hud-label">RESO:</span>
            <input type="range" id="filter-reso-slider" min="0" max="127" value="25" step="1" style="width: 70px;" />
            <span class="hud-value stat-num" id="filter-reso-val">0.20</span>
          </div>
        </div>

        <!-- Silver FX -->
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <span class="panel-badge">SILVER FX</span>
          <button type="button" class="btn btn-xs" id="btn-cycle-freqfx" title="Change Frequency Effect">FREQ: <strong id="cur-freq-fx-val">RingMod</strong></button>
          <button type="button" class="btn btn-xs" id="btn-cycle-timefx" title="Change Time Effect">TIME: <strong id="cur-time-fx-val">Chorus</strong></button>
          <button type="button" class="btn btn-xs btn-primary" id="btn-edit-silver" title="Expanded Silver & Master FX Rack">Edit Rack</button>
        </div>
      </section>
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
    onPanic: () => {
      WebBridge.allNotesOff();
    },
    onSustainChange: (active) => {
      WebBridge.sendMidiCC(64, active ? 127 : 0);
    },
  });

  // 4. Gestor universal de paneles deslizantes (Drawers - 50vw desde la derecha)
  const drawerManager = new DrawerManager(app);

  // Funciones para abrir paneles expandidos (Resynator 1/2 y Silver Rack)
  const openR1Drawer = () => {
    const modelText = document.getElementById('r1-model-label')?.textContent || '511 sinew';
    const content = ResynatorDrawer.createContent({
      resynator: 1,
      modelName: modelText,
      onClose: () => drawerManager.close(),
    });
    drawerManager.openCustom('r1-expanded', content);
  };

  const openR2Drawer = () => {
    const modelText = document.getElementById('r2-model-label')?.textContent || '511 sinew';
    const content = ResynatorDrawer.createContent({
      resynator: 2,
      modelName: modelText,
      onClose: () => drawerManager.close(),
    });
    drawerManager.openCustom('r2-expanded', content);
  };

  const openSilverDrawer = () => {
    const content = SilverDrawer.createContent({
      onClose: () => drawerManager.close(),
    });
    drawerManager.openCustom('silver-expanded', content);
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
      labels: { north: 'N', south: 'S', west: 'W', east: 'E' },
      onPositionChange: (layerIdx, coord) => {
        const paramX = layerIdx === 0 ? 52 : (layerIdx === 1 ? 72 : 92);
        const paramY = layerIdx === 0 ? 53 : (layerIdx === 1 ? 73 : 93);
        WebBridge.setParam(paramX, coord.x);
        WebBridge.setParam(paramY, coord.y);
      },
      onOpenExpanded: openR1Drawer,
    });
  }

  if (r1SphereMount) {
    r1SphereStick = new TrajectoryStick2D(r1SphereMount, {
      label: 'SPHERE 1',
      resynator: 1,
      domain: 'sphere',
      labels: { north: 'N', south: 'S', west: 'W', east: 'E' },
      onPositionChange: (layerIdx, coord) => {
        const paramX = layerIdx === 0 ? 42 : (layerIdx === 1 ? 62 : 82);
        const paramY = layerIdx === 0 ? 43 : (layerIdx === 1 ? 63 : 83);
        WebBridge.setParam(paramX, coord.x);
        WebBridge.setParam(paramY, coord.y);
      },
      onOpenExpanded: openR1Drawer,
    });
  }

  if (r2ScapeMount) {
    r2ScapeStick = new TrajectoryStick2D(r2ScapeMount, {
      label: 'SCAPE 2',
      resynator: 2,
      domain: 'scape',
      labels: { north: 'N', south: 'S', west: 'W', east: 'E' },
      onPositionChange: (layerIdx, coord) => {
        const paramX = layerIdx === 0 ? 132 : (layerIdx === 1 ? 152 : 172);
        const paramY = layerIdx === 0 ? 133 : (layerIdx === 1 ? 153 : 173);
        WebBridge.setParam(paramX, coord.x);
        WebBridge.setParam(paramY, coord.y);
      },
      onOpenExpanded: openR2Drawer,
    });
  }

  if (r2SphereMount) {
    r2SphereStick = new TrajectoryStick2D(r2SphereMount, {
      label: 'SPHERE 2',
      resynator: 2,
      domain: 'sphere',
      labels: { north: 'N', south: 'S', west: 'W', east: 'E' },
      onPositionChange: (layerIdx, coord) => {
        const paramX = layerIdx === 0 ? 122 : (layerIdx === 1 ? 142 : 162);
        const paramY = layerIdx === 0 ? 123 : (layerIdx === 1 ? 143 : 163);
        WebBridge.setParam(paramX, coord.x);
        WebBridge.setParam(paramY, coord.y);
      },
      onOpenExpanded: openR2Drawer,
    });
  }

  // Conectar botones Edit R1, Edit R2 y Edit Silver Rack
  document.getElementById('btn-edit-r1')?.addEventListener('click', openR1Drawer);
  document.getElementById('btn-edit-r2')?.addEventListener('click', openR2Drawer);
  document.getElementById('btn-edit-silver')?.addEventListener('click', openSilverDrawer);

  // 6. Controles centrales (Blender, Filtro y Silver FX)
  const blenderSlider = document.getElementById('blender-slider') as HTMLInputElement | null;
  const blenderVal = document.getElementById('blender-amount-val');
  blenderSlider?.addEventListener('input', () => {
    const val = parseFloat(blenderSlider.value);
    const norm = ((val + 64) / 127).toFixed(2);
    if (blenderVal) blenderVal.textContent = norm;
    WebBridge.setParam(262, val);
  });

  const filterCutSlider = document.getElementById('filter-freq-slider') as HTMLInputElement | null;
  const filterCutVal = document.getElementById('filter-freq-val');
  filterCutSlider?.addEventListener('input', () => {
    const val = parseFloat(filterCutSlider.value);
    if (filterCutVal) filterCutVal.textContent = String(val);
    WebBridge.setParam(274, val);
  });

  const filterResoSlider = document.getElementById('filter-reso-slider') as HTMLInputElement | null;
  const filterResoVal = document.getElementById('filter-reso-val');
  filterResoSlider?.addEventListener('input', () => {
    const val = parseFloat(filterResoSlider.value);
    if (filterResoVal) filterResoVal.textContent = (val / 127).toFixed(2);
    WebBridge.setParam(275, val);
  });

  const freqAlgoNames = ['Off', 'FreqShift', 'RingMod', 'Distortion', 'Decimator', 'Formant', 'Comb', 'Resonator', 'Treemonster'];
  let curFreqAlgoIdx = 2; // RingMod
  const btnCycleFreq = document.getElementById('btn-cycle-freqfx');
  const curFreqVal = document.getElementById('cur-freq-fx-val');
  btnCycleFreq?.addEventListener('click', () => {
    curFreqAlgoIdx = (curFreqAlgoIdx + 1) % freqAlgoNames.length;
    if (curFreqVal) curFreqVal.textContent = freqAlgoNames[curFreqAlgoIdx];
    WebBridge.setParam(281, curFreqAlgoIdx > 0 ? 1 : 0);
    WebBridge.setParam(282, curFreqAlgoIdx);
  });

  const timeAlgoNames = ['Off', 'Chorus', 'Flanger', 'Phaser', 'Delay', 'MultiTap', 'Reverb'];
  let curTimeAlgoIdx = 1; // Chorus
  const btnCycleTime = document.getElementById('btn-cycle-timefx');
  const curTimeVal = document.getElementById('cur-time-fx-val');
  btnCycleTime?.addEventListener('click', () => {
    curTimeAlgoIdx = (curTimeAlgoIdx + 1) % timeAlgoNames.length;
    if (curTimeVal) curTimeVal.textContent = timeAlgoNames[curTimeAlgoIdx];
    WebBridge.setParam(327, curTimeAlgoIdx > 0 ? 1 : 0);
    WebBridge.setParam(328, curTimeAlgoIdx);
  });

  // 7. Gestor de Banco y Modelos NeuronDB (BankDrawer montado en el Drawer universal)
  let targetResynatorForModelPick: 1 | 2 = 1;

  const bankDrawer = new BankDrawer(drawerManager, {
    onSelectModel: (slot, resynator) => {
      const targetR = resynator || targetResynatorForModelPick;
      const model = bankDrawer.getBank().models.find((m) => m.slot === slot);
      const modelName = model ? model.name : `Model #${String(slot).padStart(3, '0')}`;
      navbar.setModelName(targetR, `#${String(slot).padStart(3, '0')} ${modelName}`);

      const labelEl = document.getElementById(targetR === 1 ? 'r1-model-label' : 'r2-model-label');
      if (labelEl) labelEl.textContent = `${slot} ${modelName}`;

      console.log(`[ABDAxionikVS] Assigned Model #${slot} (${modelName}) to Resynator ${targetR}`);
    },
    onSelectPreset: (slot, name) => {
      navbar.setPresetName(`${String(slot).padStart(3, '0')} ${name}`);
      console.log(`[ABDAxionikVS] Loaded Sound Preset #${slot} "${name}"`);
    },
    onConfigureNeuronDbFolder: () => {
      bankDrawer.promptConfigureFolder();
    },
  });

  // 6. Inicializar Navbar Universal (SynthNavBar)
  const navbar = new AxionikNavbar(navContainer, {
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
      bankDrawer.open();
    },
    onSavePreset: () => {
      alert('Save Preset: Not implemented in preview.');
    },
    onInitPreset: () => {
      navbar.setPresetName('000 InitSound');
      navbar.setModelName(1, '511 sinew');
      navbar.setModelName(2, '511 sinew');
      const r1Lbl = document.getElementById('r1-model-label');
      const r2Lbl = document.getElementById('r2-model-label');
      if (r1Lbl) r1Lbl.textContent = '511 sinew';
      if (r2Lbl) r2Lbl.textContent = '511 sinew';
      console.log('[ABDAxionikVS] Sound initialized to factory default.');
    },
    onToggleBank: () => {
      bankDrawer.toggle();
    },
    onToggleMatrix: () => {
      drawerManager.toggle(
        'matrix',
        'Free Controllers Modulation Matrix (6 × 5)',
        `
        <div class="panel-caption">Unifica los 6 controles de ejecución ([413..424] + Free Controllers [363..410]) hacia los 63 destinos de modulación.</div>
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
          <p style="margin: 0; color: var(--color-text-muted); font-size: var(--text-sm);">1. Aftertouch (Channel Pressure)</p>
          <p style="margin: 0; color: var(--color-text-muted); font-size: var(--text-sm);">2. Modulation Wheel (CC 1)</p>
          <p style="margin: 0; color: var(--color-text-muted); font-size: var(--text-sm);">3. Breath Controller (CC 2)</p>
          <p style="margin: 0; color: var(--color-text-muted); font-size: var(--text-sm);">4. Continuous Controller 03 (CC 3)</p>
          <p style="margin: 0; color: var(--color-text-muted); font-size: var(--text-sm);">5. Foot Pedal (CC 4)</p>
          <p style="margin: 0; color: var(--color-text-muted); font-size: var(--text-sm);">6. Expression Pedal (CC 11)</p>
        </div>
        `
      );
    },
    onToggleMfx: () => {
      drawerManager.toggle(
        'mfx',
        'Master FX Rack [430..444]',
        `
        <div class="panel-caption">Procesamiento de dinámica y masterización final.</div>
        <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface); display: flex; flex-direction: column; gap: var(--space-2);">
          <span class="hud-label">EQ 3-Bandas ([430..433])</span>
          <span class="hud-label">Compresor Estéreo ([434..438])</span>
          <span class="hud-label">Stereo Spread ([439])</span>
          <span class="hud-label">Master Reverb Room ([440..444])</span>
        </div>
        `
      );
    },
    onSelectPreset: () => {
      bankDrawer.open();
    },
    onSelectModel: (resynator) => {
      targetResynatorForModelPick = resynator;
      bankDrawer.open();
    },
    onSelectTheme: (theme) => {
      const idx = themes.indexOf(theme);
      if (idx >= 0) {
        currentThemeIndex = idx;
        applyTheme(theme);
      }
    },
    onToggleTheme: () => {
      currentThemeIndex = (currentThemeIndex + 1) % themes.length;
      applyTheme(themes[currentThemeIndex]);
    },
    onZoom: (zoomLevel) => {
      document.body.style.zoom = String(zoomLevel);
    },
  });

  // 7. Atajos globales de teclado
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      bankDrawer.toggle();
    } else if (isCtrl && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      navbar['callbacks'].onToggleMatrix();
    } else if (isCtrl && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      navbar['callbacks'].onToggleMfx();
    }
  });

  // 8. Suscribir telemetría y actualización de parámetros del bridge nativo
  WebBridge.onMessage((msg) => {
    if (msg.type === 'TELEMETRY') {
      if (typeof msg.activeVoices === 'number') navbar.setVoices(msg.activeVoices);
      if (typeof msg.cpuUsage === 'number') navbar.setCpuLoad(msg.cpuUsage);
    } else if (msg.type === 'PARAM_UPDATE') {
      const idx = msg.index;
      const val = msg.value;
      if (idx === 262 && blenderSlider) {
        blenderSlider.value = String(val);
        if (blenderVal) blenderVal.textContent = ((val + 64) / 127).toFixed(2);
      } else if (idx === 274 && filterCutSlider) {
        filterCutSlider.value = String(val);
        if (filterCutVal) filterCutVal.textContent = String(val);
      } else if (idx === 275 && filterResoSlider) {
        filterResoSlider.value = String(val);
        if (filterResoVal) filterResoVal.textContent = (val / 127).toFixed(2);
      } else if (r1ScapeStick && (idx === 52 || idx === 72 || idx === 92)) {
        const layer = idx === 52 ? 0 : (idx === 72 ? 1 : 2);
        r1ScapeStick.setPosition(layer, val, r1ScapeStick.getCoordinates(layer).y, false);
      } else if (r1ScapeStick && (idx === 53 || idx === 73 || idx === 93)) {
        const layer = idx === 53 ? 0 : (idx === 73 ? 1 : 2);
        r1ScapeStick.setPosition(layer, r1ScapeStick.getCoordinates(layer).x, val, false);
      } else if (r1SphereStick && (idx === 42 || idx === 62 || idx === 82)) {
        const layer = idx === 42 ? 0 : (idx === 62 ? 1 : 2);
        r1SphereStick.setPosition(layer, val, r1SphereStick.getCoordinates(layer).y, false);
      } else if (r1SphereStick && (idx === 43 || idx === 63 || idx === 83)) {
        const layer = idx === 43 ? 0 : (idx === 63 ? 1 : 2);
        r1SphereStick.setPosition(layer, r1SphereStick.getCoordinates(layer).x, val, false);
      } else if (r2ScapeStick && (idx === 132 || idx === 152 || idx === 172)) {
        const layer = idx === 132 ? 0 : (idx === 152 ? 1 : 2);
        r2ScapeStick.setPosition(layer, val, r2ScapeStick.getCoordinates(layer).y, false);
      } else if (r2ScapeStick && (idx === 133 || idx === 153 || idx === 173)) {
        const layer = idx === 133 ? 0 : (idx === 153 ? 1 : 2);
        r2ScapeStick.setPosition(layer, r2ScapeStick.getCoordinates(layer).x, val, false);
      } else if (r2SphereStick && (idx === 122 || idx === 142 || idx === 162)) {
        const layer = idx === 122 ? 0 : (idx === 142 ? 1 : 2);
        r2SphereStick.setPosition(layer, val, r2SphereStick.getCoordinates(layer).y, false);
      } else if (r2SphereStick && (idx === 123 || idx === 143 || idx === 163)) {
        const layer = idx === 123 ? 0 : (idx === 143 ? 1 : 2);
        r2SphereStick.setPosition(layer, r2SphereStick.getCoordinates(layer).x, val, false);
      }
    }
  });

  (window as any).__axionikSticks = { r1ScapeStick, r1SphereStick, r2ScapeStick, r2SphereStick };

  console.log(`[ABDAxionikVS] Frontend inicializado (${PARAM_DEFINITIONS.length} parámetros, SynthNavBar montado).`);
});
