// ─────────────────────────────────────────────────────────
// ABDAxionikVS — applyPresetExtendedState.ts
// Restaura la parte v2 de un preset: primero carga los modelos expandidos
// referenciados (o embebidos), después aplica los 9 shapers de cada Resynator
// y finalmente envía los parámetros del rack EXPANDED [463..478] al WebBridge.
// ─────────────────────────────────────────────────────────

import { WebBridge } from '../bridge/WebBridge.js';
import type { AxionikPreset } from '../ui/PresetModel.js';

// Mapa de índices APVTS del rack EXPANDED (ver paramIndices.ts)
const EXP_IDX = {
  freqFxAlg:      463,
  freqFxMacro1:   464,
  freqFxMacro2:   465,
  freqFxMacro3:   466,
  freqFxMacro4:   467,
  timeFxAlg:      468,
  timeFxMacro1:   469,
  timeFxMacro2:   470,
  timeFxMacro3:   471,
  timeFxMacro4:   472,
  masterDelayAlg: 473,
  masterRevAlg:   474,
  masterFxMacro1: 475,
  masterFxMacro2: 476,
  masterFxMacro3: 477,
  masterFxMacro4: 478,
} as const;

/**
 * El host procesa LOAD_EXPANDED_MODEL_SLUG antes de SET_RESYNATOR_SHAPERS en
 * el mismo orden de mensajes; por eso la carga del modelo va primero.
 * Si el preset incluye modelos embebidos ('embeddedModel'), los carga directamente
 * en memoria hacia el DSP/host para máxima portabilidad ('Self-Contained').
 * Los parámetros del rack EXPANDED [463..478] se envían al final, después de
 * los shapers, para que el motor ya tenga el modo correcto activo.
 */
export function applyPresetExtendedState(preset: AxionikPreset): void {
  if (preset.engineMode !== 'extended' || !preset.extendedState) return;

  const { r1ModelSlug, r2ModelSlug, r1Shapers, r2Shapers, embeddedModel, expandedFx } = preset.extendedState;

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

  // 3. Restaurar estado del rack EXPANDED [463..478]
  if (expandedFx) {
    WebBridge.setParam(EXP_IDX.freqFxAlg, expandedFx.freqFxAlg);
    WebBridge.setParam(EXP_IDX.freqFxMacro1, expandedFx.freqFxMacros[0]);
    WebBridge.setParam(EXP_IDX.freqFxMacro2, expandedFx.freqFxMacros[1]);
    WebBridge.setParam(EXP_IDX.freqFxMacro3, expandedFx.freqFxMacros[2]);
    WebBridge.setParam(EXP_IDX.freqFxMacro4, expandedFx.freqFxMacros[3]);
    WebBridge.setParam(EXP_IDX.timeFxAlg, expandedFx.timeFxAlg);
    WebBridge.setParam(EXP_IDX.timeFxMacro1, expandedFx.timeFxMacros[0]);
    WebBridge.setParam(EXP_IDX.timeFxMacro2, expandedFx.timeFxMacros[1]);
    WebBridge.setParam(EXP_IDX.timeFxMacro3, expandedFx.timeFxMacros[2]);
    WebBridge.setParam(EXP_IDX.timeFxMacro4, expandedFx.timeFxMacros[3]);
    WebBridge.setParam(EXP_IDX.masterDelayAlg, expandedFx.masterDelayAlg);
    WebBridge.setParam(EXP_IDX.masterRevAlg, expandedFx.masterRevAlg);
    WebBridge.setParam(EXP_IDX.masterFxMacro1, expandedFx.masterFxMacros[0]);
    WebBridge.setParam(EXP_IDX.masterFxMacro2, expandedFx.masterFxMacros[1]);
    WebBridge.setParam(EXP_IDX.masterFxMacro3, expandedFx.masterFxMacros[2]);
    WebBridge.setParam(EXP_IDX.masterFxMacro4, expandedFx.masterFxMacros[3]);
  }
}
