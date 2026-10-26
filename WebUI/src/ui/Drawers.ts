/**
 * ABDAxionikVS — Drawers.ts
 * Gestor de paneles deslizantes (Drawers) siguiendo el patrón de ABDEep
 */

import { ICONS } from './icons.js';

export class DrawerManager {
  private backdrop: HTMLElement;
  private container: HTMLElement;
  private currentDrawerId: string | null = null;

  constructor(parent: HTMLElement) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'drawer-backdrop';

    this.container = document.createElement('div');
    this.container.className = 'drawer-container';

    parent.appendChild(this.backdrop);
    parent.appendChild(this.container);

    this.backdrop.addEventListener('click', () => this.close());
  }

  public open(drawerId: string, title: string, contentHtml: string, onMount?: (el: HTMLElement) => void): void {
    this.currentDrawerId = drawerId;
    this.container.innerHTML = `
      <div class="drawer-header">
        <div class="panel-caption" style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="panel-badge">${drawerId.toUpperCase()}</span>
          <span>${title}</span>
        </div>
        <button type="button" class="btn-secondary" id="btn-drawer-close" title="Cerrar panel">
          ${ICONS.close}
        </button>
      </div>
      <div class="drawer-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3);">
        ${contentHtml}
      </div>
    `;

    this.container.querySelector('#btn-drawer-close')?.addEventListener('click', () => this.close());

    if (onMount) {
      onMount(this.container.querySelector('.drawer-body') as HTMLElement);
    }

    this.backdrop.classList.add('is-open');
    this.container.classList.add('is-open');
  }

  public close(): void {
    this.currentDrawerId = null;
    this.backdrop.classList.remove('is-open');
    this.container.classList.remove('is-open');
  }

  public toggle(drawerId: string, title: string, contentHtml: string, onMount?: (el: HTMLElement) => void): void {
    if (this.currentDrawerId === drawerId) {
      this.close();
    } else {
      this.open(drawerId, title, contentHtml, onMount);
    }
  }

  public isOpen(): boolean {
    return this.currentDrawerId !== null;
  }
}
