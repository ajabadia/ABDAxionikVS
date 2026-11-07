// ─────────────────────────────────────────────────────────
// ABDAxionikVS — StickLabelReader.ts
// Etiquetas mnAN publicadas de los 10 Parameter Sets del ModelMaker
// del Hartmann Neuron (NeuronVS). Por compatibilidad con subsistemas
// existentes que las consumen directamente, se mantienen aquí como una
// capa de re-exportación, pero la fuente de verdad canónica ahora es
// AxionikParameterSet.ts: AXIONIK_PARAMETER_SET_DEFINITIONS.
//
// Cada set devuelve 3 capas (L1, L2, L3), una StickLabels por capa,
// con los cuatro polos N/E/S/W. 'scape' y 'sphere' comparten la misma
// tabla mnAN por set, por lo que el parámetro _domain está soportado por
// compatibilidad pero no bifurca las etiquetas.
// ─────────────────────────────────────────────────────────

import type { StickLabels } from './TrajectoryStick2D.js';

const STICK_TABLE: readonly [number, readonly StickLabels[]][] = [
  [
    0,
    [
      { north: 'Body A', east: 'Small', south: 'Body B', west: 'Large' },
      { north: 'Original', east: 'Full', south: 'Even', west: 'Simple' },
      { north: 'True', east: 'Harmonic', south: 'Morph', west: 'Distort' },
    ],
  ],
  [
    1,
    [
      { north: 'Timbre A', east: 'Thick', south: 'Timbre B', west: 'Thin' },
      { north: 'Original', east: 'Rich', south: 'Sub', west: 'Simple' },
      { north: 'True', east: 'Nice', south: 'Free', west: 'Strange' },
    ],
  ],
  [
    2,
    [
      { north: 'Corpus A', east: 'Small', south: 'Corpus B', west: 'Large' },
      { north: 'Complex', east: 'Low', south: 'Simple', west: 'High' },
      { north: 'Pure', east: 'Clear', south: 'Twisted', west: 'Noisy' },
    ],
  ],
  [
    3,
    [
      { north: 'Formant A', east: 'Micky', south: 'Formant B', west: 'Monster' },
      { north: 'Original', east: 'Aaah', south: 'Clear', west: 'Oooh' },
      { north: 'Harmony', east: 'Soft', south: 'Odd', west: 'Sharp' },
    ],
  ],
  [
    4,
    [
      { north: 'String A', east: 'Tiny', south: 'String B', west: 'Jumbo' },
      { north: 'Original', east: 'Full', south: 'Pure', west: 'Light' },
      { north: 'Harmonic', east: 'Wood', south: 'Odd', west: 'Metal' },
    ],
  ],
  [
    5,
    [
      { north: 'Tube A', east: 'Short', south: 'Tube B', west: 'Long' },
      { north: 'Original', east: 'Rich', south: 'Even', west: 'Simple' },
      { north: 'Smooth', east: 'Warm', south: 'Rough', west: 'Brassy' },
    ],
  ],
  [
    6,
    [
      { north: 'Corpus A', east: 'Violin', south: 'Corpus B', west: 'Cello' },
      { north: 'Original', east: 'Full', south: 'Smooth', west: 'Hollow' },
      { north: 'Sweet', east: 'Wood', south: 'Harsh', west: 'Glass' },
    ],
  ],
  [
    7,
    [
      { north: 'Sphere A', east: 'Near', south: 'Sphere B', west: 'Far' },
      { north: 'Dense', east: 'Dark', south: 'Sparse', west: 'Light' },
      { north: 'Order', east: 'Calm', south: 'Chaos', west: 'Wild' },
    ],
  ],
  [
    8,
    [
      { north: 'Groove A', east: 'Tight', south: 'Groove B', west: 'Loose' },
      { north: 'Original', east: 'Heavy', south: 'Filtered', west: 'Light' },
      { north: 'Straight', east: 'Clean', south: 'Warped', west: 'Dirty' },
    ],
  ],
  [
    9,
    [
      { north: 'Cloud A', east: 'Narrow', south: 'Cloud B', west: 'Wide' },
      { north: 'Warm', east: 'Deep', south: 'Crystal', west: 'High' },
      { north: 'Pure', east: 'Still', south: 'Shimmer', west: 'Moving' },
    ],
  ],
];

const STICK_DATA = new Map<number, readonly StickLabels[]>(STICK_TABLE);

export function getParameterSetStickLabels(
  setIndex: number,
  _domain: 'scape' | 'sphere' = 'scape',
): StickLabels[] {
  const stored = STICK_DATA.get(setIndex);
  if (!stored) {
    return [
      { north: 'N', east: 'E', south: 'S', west: 'W' },
      { north: 'N', east: 'E', south: 'S', west: 'W' },
      { north: 'N', east: 'E', south: 'S', west: 'W' },
    ];
  }

  return [
    { ...stored[0] },
    { ...stored[1] },
    { ...stored[2] },
  ] as StickLabels[];
}
