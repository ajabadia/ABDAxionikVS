// ─────────────────────────────────────────────────────────
// ABDAxionikVS — applyPresetExtendedState.ts
// Restaura la parte v2 de un preset: primero carga los modelos expandidos
// referenciados (o embebidos) y después aplica los 9 shapers de cada Resynator.
// ─────────────────────────────────────────────────────────

import { WebBridge } from '../bridge/WebBridge.js';
import type { AxionikPreset } from '../ui/PresetModel.js';

/**
 * El host procesa LOAD_EXPANDED_MODEL_SLUG antes de SET_RESYNATOR_SHAPERS en
 * el mismo orden de mensajes; por eso la carga del modelo va primero.
 * Si el preset incluye modelos embebidos ('embeddedModel'), los carga directamente
 * en memoria hacia el DSP/host para máxima portabilidad ('Self-Contained').
 */
export function applyPresetExtendedState(preset: AxionikPreset): void {
  if (preset.engineMode !== 'extended' || !preset.extendedState) return;

  const { r1ModelSlug, r2ModelSlug, r1Shapers, r2Shapers, embeddedModel } = preset.extendedState;

  // 1. Cargar modelos embebidos si existen, o por slug en caso contrario
  if (embeddedModel?.r1) {
    WebBridge.loadExpandedModelJson(1, JSON.stringify(embeddedModel.r1));
  } else if (r1ModelSlug) {
    WebBridge.loadExpandedModelSlug(r1ModelSlug, 1);
  }

  if (embeddedModel?.r2) {
    WebBridge.loadExpandedModelJson(2, JSON.stringify(embeddedModel.r2));
  } else if (r2ModelSlug) {
    WebBridge.loadExpandedModelSlug(r2ModelSlug, 2);
  }

  // 2. Aplicar shapers (pasando r1ModelSlug ?? null para mantener paridad de contrato con pruebas)
  if (r1Shapers) WebBridge.setActiveResonatorShapers(1, r1Shapers, r1ModelSlug ?? null);
  if (r2Shapers) WebBridge.setActiveResonatorShapers(2, r2Shapers, r2ModelSlug ?? null);
}
