// ─────────────────────────────────────────────────────────
// ABDAxionikVS — StickLabelReader.ts
// Lectura de etiquetas mnAN de los polos N/E/S/W para los 10 Parameter Sets
// del ModelMaker del Hartmann Neuron. Extrae los 3 niveles (L1..L3) con
// cuatro polos cada uno, para dominio 'scape' o 'sphere'.
// ─────────────────────────────────────────────────────────

import type { StickLabels } from './TrajectoryStick2D.js';
import { AXIONIK_PARAMETER_SET_DEFINITIONS } from './AxionikParameterSet.js';

const STICK_DATA = new Map<number, { north: string; east: string; south: string; west: string }[]>(
  Array.from({ length: 10 }, () => [undefined, undefined, undefined, undefined]),
);

export function getParameterSetStickLabels(
  setIndex: number,
  domain: 'scape' | 'sphere',
): StickLabels[] {
  const labels = STICK_DATA.get(setIndex);
  if (!labels) {
    // Falta datos mnAN para este set: retorna un placeholder neutro por capa.
    return [
      { north: 'N', east: 'E', south: 'S', west: 'W' },
      { north: 'N', east: 'E', south: 'S', west: 'W' },
      { north: 'N', east: 'E', south: 'S', west: 'W' },
    ];
  }
  return labels;
}
