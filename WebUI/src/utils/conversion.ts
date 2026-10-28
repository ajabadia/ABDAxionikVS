/**
 * ABDAxionikVS — conversion.ts
 * Utilidades canónicas de conversión de parámetros de 3 dominios
 * Refleja exactamente la lógica de Conversion.gen.h y FUN_10001170
 */

import type { ParamDefinition } from '../generated/parameters.gen.js';

export function rawToNormalized(def: ParamDefinition, rawValue: number): number {
  if (def.max <= def.min) return 0;
  const clamped = Math.max(def.min, Math.min(def.max, rawValue));
  return (clamped - def.min) / (def.max - def.min);
}

export function normalizedToRaw(def: ParamDefinition, normalized: number): number {
  const norm = Math.max(0, Math.min(1, normalized));
  let raw = def.min + norm * (def.max - def.min);
  if (def.step > 0) {
    raw = Math.round((raw - def.min) / def.step) * def.step + def.min;
  }
  return Math.max(def.min, Math.min(def.max, raw));
}
