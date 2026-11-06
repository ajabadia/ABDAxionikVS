/**
 * ABDAxionikVS — resynatorShapersModel.ts
 * Contrato de UI de los 9 moldeadores fisicos/espectrales del Resynator v2.
 *
 * Este modulo no toca el DOM: expone los rangos que el motor usa realmente en
 * `AxionikExpandedSynthesizer` y la conversion entre la posicion normalizada del
 * knob (0..1) y el valor DSP.
 */

import type { AxionikResynatorShapersState } from './PresetModel.js';

export interface ResynatorShaperControl {
  key: keyof AxionikResynatorShapersState;
  label: string;
  knobLabel: string;
  description: string;
  min: number;
  max: number;
  step: number;
  bipolar?: boolean;
  format: (value: number) => string;
}

const asPercent = (value: number): string => `${Math.round(value * 100)}%`;
const asSigned = (value: number, decimals = 2): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(decimals)}`;

export const RESYNATOR_SHAPER_CONTROLS: readonly ResynatorShaperControl[] = [
  {
    key: 'inharmonicityB',
    label: 'INHARMONICITY',
    knobLabel: 'INHARM B',
    description: 'Stiff-string inharmonicity coefficient B (0 = perfectly harmonic).',
    min: 0,
    max: 1,
    step: 0.001,
    format: (value) => value.toFixed(3),
  },
  {
    key: 'parity',
    label: 'PARITY',
    knobLabel: 'PARITY',
    description: 'Even/odd harmonic balance (-1 = even, +1 = odd).',
    min: -1,
    max: 1,
    step: 0.01,
    bipolar: true,
    format: (value) => asSigned(value),
  },
  {
    key: 'entropyRoughness',
    label: 'ENTROPY / ROUGH',
    knobLabel: 'ENTROPY',
    description: 'Loris bandwidth-driven stochastic roughness.',
    min: 0,
    max: 1,
    step: 0.01,
    format: asPercent,
  },
  {
    key: 'spectralShiftHz',
    label: 'SPECTRAL SHIFT',
    knobLabel: 'SHIFT',
    description: 'Global partial frequency offset in Hz.',
    min: -4000,
    max: 4000,
    step: 1,
    bipolar: true,
    format: (value) => `${Math.round(value)} Hz`,
  },
  {
    key: 'hfRollOffDbPerOct',
    label: 'HF ROLL-OFF',
    knobLabel: 'ROLL-OFF',
    description: 'High-frequency roll-off per octave above the fundamental.',
    min: -24,
    max: 0,
    step: 0.1,
    format: (value) => `${value.toFixed(1)} dB/oct`,
  },
  {
    key: 'formantShiftSt',
    label: 'FORMANT SHIFT',
    knobLabel: 'FORMANT',
    description: 'Formant envelope transposition in semitones.',
    min: -24,
    max: 24,
    step: 0.1,
    bipolar: true,
    format: (value) => `${asSigned(value, 1)} st`,
  },
  {
    key: 'formantPreserve',
    label: 'FORMANT PRESERVE',
    knobLabel: 'PRESERVE',
    description: '0 = raw partials, 1 = fully formant-preserved spectrum.',
    min: 0,
    max: 1,
    step: 0.01,
    format: asPercent,
  },
  {
    key: 'residualMix',
    label: 'RESIDUAL MIX',
    knobLabel: 'RESIDUAL',
    description: 'DDSP stochastic residual blended with the harmonic body.',
    min: 0,
    max: 1,
    step: 0.01,
    format: asPercent,
  },
  {
    key: 'spatialSpread',
    label: 'SPATIAL SPREAD',
    knobLabel: 'SPREAD',
    description: 'Quad 4.0 rear-channel radiation spread.',
    min: 0,
    max: 1,
    step: 0.01,
    format: asPercent,
  },
];

/** Convierte una posicion normalizada del knob al valor DSP, con clamp y snap. */
export function shaperNormalizedToValue(
  control: Pick<ResynatorShaperControl, 'min' | 'max' | 'step'>,
  normalized: number,
): number {
  const n = Number.isFinite(normalized) ? Math.min(1, Math.max(0, normalized)) : 0;
  const raw = control.min + n * (control.max - control.min);
  if (!Number.isFinite(raw)) return control.min;
  if (control.step > 0) {
    const snapped = Math.round(raw / control.step) * control.step;
    return Number(Math.min(control.max, Math.max(control.min, snapped)).toFixed(6));
  }
  return raw;
}

/** Convierte un valor DSP a la posicion normalizada 0..1 del knob. */
export function shaperValueToNormalized(
  control: Pick<ResynatorShaperControl, 'min' | 'max'>,
  value: number,
): number {
  const span = control.max - control.min;
  if (!(span > 0) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - control.min) / span));
}
