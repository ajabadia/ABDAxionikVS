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
          <div class="panel-actions">
            <span class="hud-pill stat-num">Model: <strong id="r1-model-label">511 sinew</strong></span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); flex: 1;">
          <!-- Stick 2D Scape R1 -->
          <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--color-panel-surface);">
            <span class="panel-caption" style="margin-bottom: var(--space-2);">SCAPE 1/2</span>
            <div id="r1-scape-stick" style="width: 140px; height: 140px; border-radius: 50%; border: 2px solid var(--color-accent); position: relative; background: radial-gradient(circle, var(--color-panel-bg) 0%, rgba(0,0,0,0.5) 100%); cursor: crosshair;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--color-accent); position: absolute; top: calc(50% - 6px); left: calc(50% - 6px); box-shadow: 0 0 8px var(--color-accent);"></div>
            </div>
            <span class="hud-pill stat-num" style="margin-top: var(--space-2); font-size: var(--text-xs);">X: 0.50 | Y: 0.50</span>
          </div>

          <!-- Stick 2D Sphere R1 -->
          <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--color-panel-surface);">
            <span class="panel-caption" style="margin-bottom: var(--space-2);">SPHERE 1/2</span>
            <div id="r1-sphere-stick" style="width: 140px; height: 140px; border-radius: 50%; border: 2px solid var(--color-accent); position: relative; background: radial-gradient(circle, var(--color-panel-bg) 0%, rgba(0,0,0,0.5) 100%); cursor: crosshair;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--color-accent); position: absolute; top: calc(50% - 6px); left: calc(50% - 6px); box-shadow: 0 0 8px var(--color-accent);"></div>
            </div>
            <span class="hud-pill stat-num" style="margin-top: var(--space-2); font-size: var(--text-xs);">X: 0.50 | Y: 0.50</span>
          </div>
        </div>
      </section>

      <!-- Columna Resynator 2 -->
      <section class="synth-panel-card resynator-column" id="r2-panel">
        <div class="panel-header">
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <span class="panel-badge">RESYNATOR 2</span>
            <span class="panel-caption">Sphere & Scape Synthesis</span>
          </div>
          <div class="panel-actions">
            <span class="hud-pill stat-num">Model: <strong id="r2-model-label">511 sinew</strong></span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); flex: 1;">
          <!-- Stick 2D Scape R2 -->
          <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--color-panel-surface);">
            <span class="panel-caption" style="margin-bottom: var(--space-2);">SCAPE 1/2</span>
            <div id="r2-scape-stick" style="width: 140px; height: 140px; border-radius: 50%; border: 2px solid var(--color-accent); position: relative; background: radial-gradient(circle, var(--color-panel-bg) 0%, rgba(0,0,0,0.5) 100%); cursor: crosshair;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--color-accent); position: absolute; top: calc(50% - 6px); left: calc(50% - 6px); box-shadow: 0 0 8px var(--color-accent);"></div>
            </div>
            <span class="hud-pill stat-num" style="margin-top: var(--space-2); font-size: var(--text-xs);">X: 0.50 | Y: 0.50</span>
          </div>

          <!-- Stick 2D Sphere R2 -->
          <div class="synth-panel-card" style="padding: var(--space-3); display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--color-panel-surface);">
            <span class="panel-caption" style="margin-bottom: var(--space-2);">SPHERE 1/2</span>
            <div id="r2-sphere-stick" style="width: 140px; height: 140px; border-radius: 50%; border: 2px solid var(--color-accent); position: relative; background: radial-gradient(circle, var(--color-panel-bg) 0%, rgba(0,0,0,0.5) 100%); cursor: crosshair;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--color-accent); position: absolute; top: calc(50% - 6px); left: calc(50% - 6px); box-shadow: 0 0 8px var(--color-accent);"></div>
            </div>
            <span class="hud-pill stat-num" style="margin-top: var(--space-2); font-size: var(--text-xs);">X: 0.50 | Y: 0.50</span>
          </div>
        </div>
      </section>

      <!-- Zona Central: Blender, Filter, Silver FX -->
      <section class="synth-panel-card" style="grid-column: 1 / -1; padding: var(--space-3); display: flex; justify-content: space-between; align-items: center; gap: var(--space-4);">
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <span class="panel-badge">BLENDER</span>
          <div class="hud-pill">
            <span class="hud-label">MODE:</span>
            <span class="hud-value" id="blender-mode-val">Crossfade</span>
          </div>
          <div class="hud-pill">
            <span class="hud-label">AMOUNT:</span>
            <span class="hud-value" id="blender-amount-val">0.50</span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <span class="panel-badge">FILTER</span>
          <div class="hud-pill">
            <span class="hud-label">CUTOFF:</span>
            <span class="hud-value" id="filter-freq-val">1000 Hz</span>
          </div>
          <div class="hud-pill">
            <span class="hud-label">RESO:</span>
            <span class="hud-value" id="filter-reso-val">0.20</span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <span class="panel-badge">SILVER FX</span>
          <div class="hud-pill">
            <span class="hud-label">FREQ FX:</span>
            <span class="hud-value" id="cur-freq-fx-val">RingMod</span>
          </div>
          <div class="hud-pill">
            <span class="hud-label">TIME FX:</span>
            <span class="hud-value" id="cur-time-fx-val">Chorus</span>
          </div>
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

  // 5. Gestor de Banco y Modelos NeuronDB (BankDrawer montado en el Drawer universal)
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

  // 8. Suscribir telemetría del bridge nativo
  WebBridge.onMessage((msg) => {
    if (msg.type === 'TELEMETRY') {
      if (typeof msg.activeVoices === 'number') navbar.setVoices(msg.activeVoices);
      if (typeof msg.cpuUsage === 'number') navbar.setCpuLoad(msg.cpuUsage);
    }
  });

  console.log(`[ABDAxionikVS] Frontend inicializado (${PARAM_DEFINITIONS.length} parámetros, SynthNavBar montado).`);
});
