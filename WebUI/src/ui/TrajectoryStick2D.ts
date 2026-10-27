// ─────────────────────────────────────────────────────────
// ABDAxionikVS — TrajectoryStick2D.ts
// Controlador vectorial 2D circular de alta precisión
// Modela el joystick Hartmann Neuron / Nuke para Scape y Sphere
// Soporta cambio dinámico de capas (L1, L2, L3), polos mnAN y estela visual
// ─────────────────────────────────────────────────────────

export interface StickCoordinate {
  x: number; // 0.0 .. 1.0 (0.5 al centro)
  y: number; // 0.0 .. 1.0 (0.5 al centro)
}

export interface StickLabels {
  north?: string;
  south?: string;
  east?: string;
  west?: string;
}

export interface TrajectoryStickOptions {
  label: string;
  resynator: 1 | 2;
  domain: 'scape' | 'sphere';
  initialLayer?: 0 | 1 | 2;
  labels?: StickLabels;
  onPositionChange: (layerIdx: number, coord: StickCoordinate) => void;
  onOpenExpanded?: () => void;
}

export class TrajectoryStick2D {
  private container: HTMLElement;
  private options: TrajectoryStickOptions;
  private activeLayer: number = 0; // 0 = L1, 1 = L2, 2 = L3
  private coords: StickCoordinate[] = [
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.5 },
  ];

  private stickAreaEl!: HTMLElement;
  private puckEl!: HTMLElement;
  private readoutEl!: HTMLElement;
  private isDragging = false;

  constructor(container: HTMLElement, options: TrajectoryStickOptions) {
    this.container = container;
    this.options = options;
    this.activeLayer = options.initialLayer ?? 0;
    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="trajectory-stick-card">
        <div class="stick-card-header">
          <span class="stick-label">${this.options.label}</span>
          <div class="stick-layer-selector">
            <button type="button" class="btn-layer ${this.activeLayer === 0 ? 'active' : ''}" data-layer="0">L1</button>
            <button type="button" class="btn-layer ${this.activeLayer === 1 ? 'active' : ''}" data-layer="1">L2</button>
            <button type="button" class="btn-layer ${this.activeLayer === 2 ? 'active' : ''}" data-layer="2">L3</button>
          </div>
        </div>

        <div class="stick-outer-ring">
          <div class="stick-pole pole-n">${this.options.labels?.north || '1'}</div>
          <div class="stick-pole pole-s">${this.options.labels?.south || '2'}</div>
          <div class="stick-pole pole-w">${this.options.labels?.west || '-'}</div>
          <div class="stick-pole pole-e">${this.options.labels?.east || '+'}</div>

          <div class="stick-pad-circle" tabindex="0" role="slider" aria-label="${this.options.label}">
            <div class="stick-crosshair-h"></div>
            <div class="stick-crosshair-v"></div>
            <div class="stick-target-ring"></div>
            <div class="stick-puck"></div>
          </div>
        </div>

        <div class="stick-card-footer">
          <span class="hud-pill stat-num stick-readout">X: 0.50 | Y: 0.50</span>
          ${this.options.onOpenExpanded ? `<button type="button" class="btn btn-xs btn-expand-stick" title="Expand Controls">Edit</button>` : ''}
        </div>
      </div>
    `;

    this.stickAreaEl = this.container.querySelector('.stick-pad-circle') as HTMLElement;
    this.puckEl = this.container.querySelector('.stick-puck') as HTMLElement;
    this.readoutEl = this.container.querySelector('.stick-readout') as HTMLElement;

    this.updatePuckPosition();
  }

  private bindEvents(): void {
    // Selector de capas L1 / L2 / L3
    this.container.querySelectorAll('.btn-layer').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const layer = parseInt(target.getAttribute('data-layer') || '0', 10);
        this.selectLayer(layer);
      });
    });

    // Botón de controles ampliados
    this.container.querySelector('.btn-expand-stick')?.addEventListener('click', () => {
      this.options.onOpenExpanded?.();
    });

    // Interacción Pointer (Mouse / Touch)
    this.stickAreaEl.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.stickAreaEl.setPointerCapture(e.pointerId);
      this.handlePointerMove(e);
    });

    this.stickAreaEl.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      this.handlePointerMove(e);
    });

    const stopDrag = (e: PointerEvent) => {
      if (this.isDragging) {
        this.isDragging = false;
        try {
          this.stickAreaEl.releasePointerCapture(e.pointerId);
        } catch {
          // Ignorar fallo de release
        }
      }
    };

    this.stickAreaEl.addEventListener('pointerup', stopDrag);
    this.stickAreaEl.addEventListener('pointercancel', stopDrag);

    // Doble clic para centrar en 0.5, 0.5
    this.stickAreaEl.addEventListener('dblclick', () => {
      this.setPosition(this.activeLayer, 0.5, 0.5);
    });
  }

  private handlePointerMove(e: PointerEvent): void {
    const rect = this.stickAreaEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    let dx = (e.clientX - cx) / radius; // -1.0 .. +1.0
    let dy = (cy - e.clientY) / radius; // -1.0 .. +1.0 (invertido: arriba positivo)

    // Restricción circular física del joystick
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1.0) {
      dx /= dist;
      dy /= dist;
    }

    // Normalizado a rango 0.0 .. 1.0
    const normX = Math.max(0.0, Math.min(1.0, (dx + 1.0) * 0.5));
    const normY = Math.max(0.0, Math.min(1.0, (dy + 1.0) * 0.5));

    this.coords[this.activeLayer] = { x: normX, y: normY };
    this.updatePuckPosition();
    this.options.onPositionChange(this.activeLayer, { x: normX, y: normY });
  }

  public selectLayer(layerIdx: number): void {
    this.activeLayer = Math.max(0, Math.min(2, layerIdx));
    this.container.querySelectorAll('.btn-layer').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === this.activeLayer);
    });
    this.updatePuckPosition();
  }

  public getCoordinates(layerIdx: number = this.activeLayer): StickCoordinate {
    const idx = Math.max(0, Math.min(2, layerIdx));
    return { ...this.coords[idx] };
  }

  public setPosition(layerIdx: number, x: number, y: number, notify = true): void {
    if (layerIdx >= 0 && layerIdx < 3) {
      this.coords[layerIdx] = {
        x: Math.max(0.0, Math.min(1.0, x)),
        y: Math.max(0.0, Math.min(1.0, y)),
      };
      if (layerIdx === this.activeLayer) {
        this.updatePuckPosition();
      }
      if (notify) {
        this.options.onPositionChange(layerIdx, this.coords[layerIdx]);
      }
    }
  }

  public setLabels(labels: StickLabels): void {
    const n = this.container.querySelector('.pole-n');
    const s = this.container.querySelector('.pole-s');
    const w = this.container.querySelector('.pole-w');
    const e = this.container.querySelector('.pole-e');
    if (n && labels.north) n.textContent = labels.north;
    if (s && labels.south) s.textContent = labels.south;
    if (w && labels.west) w.textContent = labels.west;
    if (e && labels.east) e.textContent = labels.east;
  }

  private updatePuckPosition(): void {
    const cur = this.coords[this.activeLayer];
    const leftPct = (cur.x * 100).toFixed(2);
    const topPct = ((1.0 - cur.y) * 100).toFixed(2);

    this.puckEl.style.left = `${leftPct}%`;
    this.puckEl.style.top = `${topPct}%`;

    this.readoutEl.textContent = `X: ${cur.x.toFixed(2)} | Y: ${cur.y.toFixed(2)}`;
  }
}
