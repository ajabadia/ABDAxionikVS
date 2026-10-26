/**
 * ABDAxionikVS — main.ts
 * Punto de entrada del frontend WebUI
 * Paridad estética y de diseño 1:1 con ABDNeuModMakr y el ecosistema ABDSynths
 */

import './style.css';
import { createNavbar } from './ui/Navbar.js';
import { KeyboardStrip } from './ui/KeyboardStrip.js';
import { DrawerManager } from './ui/Drawers.js';
import { WebBridge } from './bridge/WebBridge.js';
import { PARAM_DEFINITIONS, PARAM_BY_KEY } from './generated/parameters.gen.js';

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (!app) return;

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

  // 3. Franja inferior de teclado interactivo
  const keyboardSection = document.createElement('footer');
  keyboardSection.className = 'keyboard-section';
  app.appendChild(keyboardSection);

  new KeyboardStrip(keyboardSection, {
    onNotePress: (midiNote) => {
      WebBridge.noteOn(midiNote, 0.85);
    },
    onNoteRelease: (midiNote) => {
      WebBridge.noteOff(midiNote);
    },
  });

  // 4. Gestor de paneles deslizantes (Drawers)
  const drawerManager = new DrawerManager(app);

  // 5. Inicializar Navbar
  createNavbar(navContainer, {
    onToggleDrawer: (drawerId) => {
      if (drawerId === 'matrix') {
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
      } else if (drawerId === 'mfx') {
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
      } else if (drawerId === 'db') {
        drawerManager.toggle(
          'db',
          'NeuronDB Sound & Model Browser',
          `
          <div class="panel-caption">Explorador de modelos .model / .nmmodel y presets .sound</div>
          <div class="synth-panel-card" style="padding: var(--space-3); background: var(--color-panel-surface);">
            <div class="hud-pill" style="width: 100%; box-sizing: border-box; justify-content: space-between;">
              <span>000..511 NeuronDB Models</span>
              <span class="stat-num">512 Models</span>
            </div>
            <div class="hud-pill" style="width: 100%; box-sizing: border-box; justify-content: space-between; margin-top: var(--space-2);">
              <span>Neuron Factory Sounds</span>
              <span class="stat-num">351 Sounds</span>
            </div>
          </div>
          `
        );
      }
    },
    onSelectPreset: () => {
      console.log('Open preset selector');
    },
    onSelectModel: (resynator) => {
      console.log(`Open model selector for R${resynator}`);
    },
  });

  // 6. Suscribir mensajes del bridge
  WebBridge.onMessage((msg) => {
    if (msg.type === 'TELEMETRY') {
      const vEl = document.getElementById('hud-active-voices');
      const cEl = document.getElementById('hud-cpu-load');
      if (vEl && typeof msg.activeVoices === 'number') vEl.textContent = `${msg.activeVoices} / 12`;
      if (cEl && typeof msg.cpuUsage === 'number') cEl.textContent = `${msg.cpuUsage.toFixed(1)} %`;
    }
  });

  console.log(`[ABDAxionikVS] Frontend inicializado (${PARAM_DEFINITIONS.length} parámetros cargados).`);
});
