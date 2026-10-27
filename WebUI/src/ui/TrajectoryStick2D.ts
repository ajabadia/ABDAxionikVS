// ─────────────────────────────────────────────────────────
// ABDAxionikVS — TrajectoryStick2D.ts
// Re-exporta el componente canónico universal de ABDShared
// Manteniendo contratos de tipos exactos para el frontend
// ─────────────────────────────────────────────────────────

import { TrajectoryStick2D as SharedStick } from '@abdsynths/shared/components';

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
  resynator?: 1 | 2;
  domain?: 'scape' | 'sphere';
  numLayers?: number;
  initialLayer?: 0 | 1 | 2;
  labels?: StickLabels;
  onPositionChange?: (layerIdx: number, coord: StickCoordinate) => void;
  onChange?: (layerIdx: number, coord: StickCoordinate) => void;
  onOpenExpanded?: () => void;
}

export class TrajectoryStick2D extends SharedStick {
  constructor(container: HTMLElement, options: TrajectoryStickOptions) {
    super(container, options);
  }

  public selectLayer(layerIdx: number): void {
    super.selectLayer(layerIdx);
  }

  public getCoordinates(layerIdx?: number): StickCoordinate {
    return super.getCoordinates(layerIdx);
  }

  public setPosition(layerIdx: number, x: number, y: number, notify = true): void {
    super.setPosition(layerIdx, x, y, notify);
  }

  public setLabels(labels: StickLabels): void {
    super.setLabels(labels);
  }

  public setLayerLabels(layerIndex: number, labels: StickLabels): void {
    super.setLayerLabels(layerIndex, labels);
  }

  public setAllLayerLabels(layersArray: StickLabels[]): void {
    super.setAllLayerLabels(layersArray);
  }

  public toggleRecording(): void {
    super.toggleRecording();
  }

  public togglePlayback(): void {
    super.togglePlayback();
  }

  public clearTrajectory(): void {
    super.clearTrajectory();
  }
}

