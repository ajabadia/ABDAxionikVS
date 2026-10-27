/**
 * ABDAxionikVS — Drawers.ts
 * Gestor unificado de paneles deslizantes (Drawers) siguiendo el patrón de ABDEep / ABDMS2000.
 * Ocupa 1/2 de la pantalla disponible (50vw) deslizándose desde la derecha.
 * Centraliza las vistas modales/desplegables: Bank Browser, Modulation Matrix, Master FX,
 * y futuros controles ampliados de secciones (Resynator 1/2, Blender, Filter, etc.).
 */

import { ICONS } from './icons.js';

export class DrawerManager {
  private backdrop: HTMLElement;
  private container: HTMLElement;
  private currentDrawerId: string | null = null;
  private onCloseCallback: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'drawer-backdrop';

    this.container = document.createElement('div');
    this.container.className = 'drawer-container';

    parent.appendChild(this.backdrop);
    parent.appendChild(this.container);

    this.backdrop.addEventListener('click', () => this.close());

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  /**
   * Abre un panel estándar con header (badge + título + botón cerrar) y cuerpo scrollable.
   * Utilizado por Matrix, Master FX y paneles de controles ampliados.
   */
  public open(drawerId: string, title: string, contentHtml: string, onMount?: (el: HTMLElement) => void): void {
    if (this.onCloseCallback) {
      this.onCloseCallback();
      this.onCloseCallback = null;
    }

    this.currentDrawerId = drawerId;
    this.container.innerHTML = `
      <div class="drawer-header">
        <div class="panel-caption" style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="panel-badge">${drawerId.toUpperCase()}</span>
          <span>${title}</span>
        </div>
        <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-drawer-close" title="Close">
          ${ICONS.close}
        </button>
      </div>
      <div class="drawer-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3);">
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

  /**
   * Abre un elemento DOM personalizado como contenido completo del cajón 50vw.
   * Utilizado por NeuronDB Bank Browser (BankDrawer) y vistas avanzadas dedicadas.
   */
  public openCustom(drawerId: string, element: HTMLElement, onClose?: () => void): void {
    if (this.onCloseCallback && this.onCloseCallback !== onClose) {
      this.onCloseCallback();
    }

    this.currentDrawerId = drawerId;
    this.onCloseCallback = onClose || null;

    this.container.replaceChildren(element);

    this.backdrop.classList.add('is-open');
    this.container.classList.add('is-open');
  }

  /**
   * Cierra el cajón actualmente visible.
   */
  public close(): void {
    if (!this.isOpen()) return;

    const cb = this.onCloseCallback;
    this.onCloseCallback = null;
    this.currentDrawerId = null;

    this.backdrop.classList.remove('is-open');
    this.container.classList.remove('is-open');

    if (cb) {
      cb();
    }
  }

  public toggle(drawerId: string, title: string, contentHtml: string, onMount?: (el: HTMLElement) => void): void {
    if (this.currentDrawerId === drawerId) {
      this.close();
    } else {
      this.open(drawerId, title, contentHtml, onMount);
    }
  }

  public toggleCustom(drawerId: string, element: HTMLElement, onClose?: () => void): void {
    if (this.currentDrawerId === drawerId) {
      this.close();
    } else {
      this.openCustom(drawerId, element, onClose);
    }
  }

  public getCurrentDrawerId(): string | null {
    return this.currentDrawerId;
  }

  public isOpen(): boolean {
    return this.currentDrawerId !== null;
  }
}
