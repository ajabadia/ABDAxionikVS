// ─────────────────────────────────────────────────────────
// ABDAxionikVS — ParameterSets.ts
// Catálogo de etiquetas mnAN de los 10 Parameter Sets del Hartmann Neuron
// Cada set define las etiquetas de los 4 polos cardinales (North, East, South, West)
// para las 3 capas canónicas (L1, L2, L3) de Scape y Sphere
// ─────────────────────────────────────────────────────────

import type { StickLabels } from './TrajectoryStick2D.js';

import mnanJson from '../../../schemas/parameter_sets_mnan.json';

/**
 * Nombres canónicos de los 10 Parameter Sets del ModelMaker del Hartmann Neuron.
 * El Parameter Set es el algoritmo de resíntesis con el que se analizó el modelo:
 * se elige en el análisis (ModelMaker) y queda fijado en el modelo, no es un
 * parámetro del .sound ni existe como control en tiempo real del motor.
 */
export const PARAMETER_SET_NAMES: readonly string[] = [
  'Default Set',
  'Stringed / Bowed',
  'Plucked & Bells',
  'Plucked & Picked',
  'Carpet Shop',
  'Piano etc.',
  'Woodwinds',
  'Extreme Pads',
  'Loop Factory',
  'Multipurpose',
];

export function getParameterSetName(setIndex: number): string {
  return PARAMETER_SET_NAMES[setIndex] ?? `Set ${setIndex}`;
}

export interface ParameterSetData {
  scape: string[][];
  sphere: string[][];
}

const data = mnanJson as ParameterSetData;

/**
 * Retorna las etiquetas de los 4 polos para cada una de las 3 capas (L1, L2, L3)
 * para un Parameter Set (0..9) y dominio ('scape' | 'sphere')
 */
export function getParameterSetStickLabels(setIndex: number, domain: 'scape' | 'sphere'): StickLabels[] {
  const safeIdx = Math.max(0, Math.min(9, setIndex));
  const rawList = domain === 'scape' ? data.scape[safeIdx] : data.sphere[safeIdx];
  if (!rawList || rawList.length < 12) {
    return [
      { north: 'N', south: 'S', west: 'W', east: 'E' },
      { north: 'N', south: 'S', west: 'W', east: 'E' },
      { north: 'N', south: 'S', west: 'W', east: 'E' },
    ];
  }

  // 12 strings: L1 (0..3), L2 (4..7), L3 (8..11)
  // Orden canónico: [North, East, South, West]
  return [
    { north: rawList[0].trim(), east: rawList[1].trim(), south: rawList[2].trim(), west: rawList[3].trim() },
    { north: rawList[4].trim(), east: rawList[5].trim(), south: rawList[6].trim(), west: rawList[7].trim() },
    { north: rawList[8].trim(), east: rawList[9].trim(), south: rawList[10].trim(), west: rawList[11].trim() },
  ];
}
