// ─────────────────────────────────────────────────────────
// ABDAxionikVS — ParameterSets.ts
// Etiquetas mnAN publicadas de los 10 Parameter Sets del ModelMaker
// del Hartmann Neuron. Por compatibilidad con subsistemas existentes que las
// consumen directamente, se mantienen aquí como una capa de re-exportación,
// pero la fuente de verdad canónica ahora es AxionikParameterSet.ts:
// AXIONIK_PARAMETER_SET_DEFINITIONS.
// ─────────────────────────────────────────────────────────

import { getParameterSetStickLabels } from './stickLabels.js';
import { PARAM_SET_NAMES } from './AxionikParameterSet.js';

export const PARAMETER_SET_NAMES: readonly string[] = [
  'General',
  'Strings',
  'Percussion / Bells',
  'Plucked / Acoustic',
  'Pads / Bowed',
  'Keys / Electric',
  'Wind / Reed',
  'Textures / FX',
  'Loops / Granular',
  'Multi / Hybrid',
];

export { getParameterSetStickLabels, PARAM_SET_NAMES };

export function getParameterSetName(setIndex: number): string {
  return PARAM_SET_NAMES[setIndex] ?? `Set ${setIndex}`;
}
