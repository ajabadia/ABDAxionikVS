/**
 * ABDAxionikVS — Navbar.ts
 * Barra superior HUD en paridad de diseño y estilos con ABDNeuModMakr
 */

import { ICONS } from './icons.js';

export interface NavbarCallbacks {
  onToggleDrawer: (drawerId: string) => void;
  onSelectPreset?: () => void;
  onSelectModel?: (resynator: 1 | 2) => void;
}

export function createNavbar(container: HTMLElement, callbacks: NavbarCallbacks) {
  container.className = 'navbar-strip';
  container.innerHTML = `
    <div class="nav-hud-left">
      <div class="neuron-logo-mark" title="Hartmann Neuron / ABDAxionikVS">
        ${ICONS.wave}
      </div>
      <span class="panel-badge">ABDAxionikVS</span>
      <div class="hud-pill preset-slot-tag" id="nav-preset-pill" style="cursor: pointer;" title="Preset actual">
        <span class="hud-label">PRESET:</span>
        <span class="hud-value" id="hud-preset-name">000 InitSound</span>
      </div>
    </div>

    <div class="nav-hud-center">
      <div class="hud-pill model-slot-tag" id="nav-r1-model-pill" style="cursor: pointer;" title="Modelo Resynator 1">
        <span class="hud-label">R1:</span>
        <span class="hud-value" id="hud-r1-model-name">511 sinew</span>
      </div>
      <div class="hud-pill model-slot-tag" id="nav-r2-model-pill" style="cursor: pointer;" title="Modelo Resynator 2">
        <span class="hud-label">R2:</span>
        <span class="hud-value" id="hud-r2-model-name">511 sinew</span>
      </div>
    </div>

    <div class="nav-hud-right">
      <div class="hud-pill stat-num" title="Polifonía activa">
        <span class="hud-label">VOICES:</span>
        <span class="hud-value" id="hud-active-voices">0 / 12</span>
      </div>
      <div class="hud-pill stat-num" title="Uso de CPU de audio">
        <span class="hud-label">${ICONS.cpu}</span>
        <span class="hud-value" id="hud-cpu-load">0.0 %</span>
      </div>

      <button class="btn-secondary" id="btn-toggle-matrix" title="Matriz de Modulación 6x5">
        ${ICONS.matrix} <span>Matrix</span>
      </button>
      <button class="btn-secondary" id="btn-toggle-mfx" title="Master FX y Dinámica">
        ${ICONS.fx} <span>Master FX</span>
      </button>
      <button class="btn-secondary" id="btn-toggle-db" title="Base de Datos NeuronDB">
        ${ICONS.database} <span>NeuronDB</span>
      </button>
    </div>
  `;

  container.querySelector('#btn-toggle-matrix')?.addEventListener('click', () => callbacks.onToggleDrawer('matrix'));
  container.querySelector('#btn-toggle-mfx')?.addEventListener('click', () => callbacks.onToggleDrawer('mfx'));
  container.querySelector('#btn-toggle-db')?.addEventListener('click', () => callbacks.onToggleDrawer('db'));
  container.querySelector('#nav-preset-pill')?.addEventListener('click', () => callbacks.onSelectPreset?.());
  container.querySelector('#nav-r1-model-pill')?.addEventListener('click', () => callbacks.onSelectModel?.(1));
  container.querySelector('#nav-r2-model-pill')?.addEventListener('click', () => callbacks.onSelectModel?.(2));
}
