/**
 * ABDAxionikVS — app/shell.ts
 * Static DOM skeleton (navbar header, LCD bar, workspace rows, keyboard
 * footer) plus the workspace chrome wiring: R1/R2 switches, edit/model
 * buttons and row collapse. No engine state, no drawers.
 */
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import type { AppCtx } from './context.js';

export interface ShellRefs {
  navContainer: HTMLElement;
  lcdBarContainer: HTMLElement;
  keyboardSection: HTMLElement;
}

export function buildShell(app: HTMLElement): ShellRefs {
  // 1. Contenedor de Navbar
  const navContainer = document.createElement('header');
  app.appendChild(navContainer);

  // 1b. Franja fija superior de consolas LCD (Fase C: central + laterales, no colapsable, fija bajo la Navbar)
  const lcdBarContainer = document.createElement('section');
  lcdBarContainer.id = 'top-lcd-bar';
  app.appendChild(lcdBarContainer);

  // 2. Canvas principal del sintetizador (hace scroll por debajo del LCD superior fijo)
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

      <!-- 2. Fila Media: Shaper 1 (izq, span 2), Shaper 2 (centro, span 2), Shaper 3 (der, span 2) -->
      <div class="synth-row" id="row-middle" data-row-id="row-middle">
        <div id="shapers-mount" style="grid-column: 1 / -1; display: contents;"></div>
      </div>

      <!-- 3. Fila Inferior (12/12): Filter (1/12), Env Master (1/12), Blender (5/12), Controllers (4/12), Master (1/12) -->
      <div class="synth-row" id="row-bottom" data-row-id="row-bottom">
        <div id="filter-mount" class="col-span-half"></div>
        <div id="envelope-master-mount" class="col-span-half"></div>
        <div id="blender-mount" class="col-span-blender"></div>
        <div id="controllers-mount" class="col-span-2"></div>
        <div id="master-mount" class="col-span-half"></div>
      </div>
    </div>
  `;
  app.appendChild(workspace);

  // 3. Franja inferior de teclado interactivo (@abdsynths/midi-keyb)
  const keyboardSection = document.createElement('footer');
  keyboardSection.className = 'keyboard-container keyboard-section';
  app.appendChild(keyboardSection);

  return { navContainer, lcdBarContainer, keyboardSection };
}

export interface ShellDrawers {
  openR1Drawer: () => void;
  openR2Drawer: () => void;
  openSilverDrawer: () => void;
  openBlenderDrawer: () => void;
}

export function wireShellControls(ctx: AppCtx, drawers: ShellDrawers): void {
  document.getElementById('btn-toggle-r1')?.addEventListener('click', () => {
    const next = WebBridge.getParam(ParamIdx.R1Switch, 1) < 0.5;
    ctx.resynator?.updateSwitchButton(1, next);
    WebBridge.setParam(ParamIdx.R1Switch, next ? 1 : 0);
  });
  document.getElementById('btn-toggle-r2')?.addEventListener('click', () => {
    const next = WebBridge.getParam(ParamIdx.R2Switch, 1) < 0.5;
    ctx.resynator?.updateSwitchButton(2, next);
    WebBridge.setParam(ParamIdx.R2Switch, next ? 1 : 0);
  });
  document.getElementById('btn-edit-r1')?.addEventListener('click', drawers.openR1Drawer);
  document.getElementById('btn-edit-r2')?.addEventListener('click', drawers.openR2Drawer);
  document.getElementById('btn-select-model-r1')?.addEventListener('click', () => {
    ctx.state.targetResynatorForModelPick = 1;
    ctx.bankDrawer?.open('models', 'r1');
  });
  document.getElementById('btn-select-model-r2')?.addEventListener('click', () => {
    ctx.state.targetResynatorForModelPick = 2;
    ctx.bankDrawer?.open('models', 'r2');
  });
  document.getElementById('btn-edit-silver')?.addEventListener('click', drawers.openSilverDrawer);
  document.getElementById('btn-edit-blender')?.addEventListener('click', drawers.openBlenderDrawer);

  // Gestor de colapso y descolapso sincronizado por fila (Row Collapse)
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
}
