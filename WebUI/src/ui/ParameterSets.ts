// ─────────────────────────────────────────────────────────
// ABDAxionikVS — ParameterSets.ts
// Capa de compatibilidad para imports heredados de Parameter Sets.
//
// La fuente de verdad canónica es AxionikParameterSet.ts
// (AXIONIK_PARAMETER_SET_DEFINITIONS / PARAM_SET_NAMES) y las etiquetas de eje
// por set viven en stickLabels.ts. Aquí no se mantiene ninguna tabla propia:
// solo se re-exporta para no romper rutas antiguas.
// ─────────────────────────────────────────────────────────

export { getParameterSetStickLabels } from './stickLabels.js';
export { PARAM_SET_NAMES } from './AxionikParameterSet.js';
