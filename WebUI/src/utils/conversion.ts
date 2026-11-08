/**
 * ABDAxionikVS — conversion.ts
 * Utilidades canónicas de conversión de parámetros de 3 dominios
 * Refleja exactamente la lógica de Conversion.gen.h y FUN_10001170
 */

import type { ParamDefinition } from '../generated/parameters.gen.js';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convierte un valor crudo a normalizado [0.0, 1.0].
 * Para parámetros SymBipolar [-64..63]: raw 0 -> exacto 0.5
 * (§4.3 del diccionario común, `curve: "SymBipolar"`).
 */
export function rawToNormalized(def: ParamDefinition, rawValue: number): number {
  if (def.max <= def.min) return 0;
  const clamped = clamp(rawValue, def.min, def.max);
  if (def.isSymBipolar) {
    if (clamped === 0) return 0.5;
    if (clamped > 0) return 0.5 + 0.5 * (clamped / def.max);
    return 0.5 - 0.5 * (clamped / def.min);
  }
  return (clamped - def.min) / (def.max - def.min);
}

/**
 * Convierte un valor normalizado [0.0, 1.0] a crudo cuantizado según step y clamp.
 * Para parámetros SymBipolar [-64..63]: norm 0.5 -> exacto 0.
 * Aplica la regla estricta de FUN_10001170 del binario original.
 */
export function normalizedToRaw(def: ParamDefinition, normalized: number): number {
  const norm = clamp(normalized, 0, 1);
  if (def.max <= def.min) return def.min;
  if (def.isSymBipolar) {
    if (Math.abs(norm - 0.5) < 1e-6) return 0;
    let raw = norm > 0.5
      ? (norm - 0.5) * 2 * def.max
      : (0.5 - norm) * 2 * def.min;
    if (def.step > 0) {
      raw = Math.round(raw / def.step) * def.step;
    }
    return clamp(raw, def.min, def.max);
  }
  let raw = def.min + norm * (def.max - def.min);
  if (def.step > 0) {
    raw = Math.round((raw - def.min) / def.step) * def.step + def.min;
  }
  return clamp(raw, def.min, def.max);
}
