// ─────────────────────────────────────────────────────────
// ABDAxionikVS — Preset category info (thin adapter over ABDShared)
//
// Fuente única de la clasificación:
//   ABDShared/Components/bank/bankCategories.js
// Este módulo solo añade el icono propio del synth; catClass y paramId
// vienen del clasificador canónico. Sin efectos de módulo (importable
// en tests node sin arrastrar WebBridge ni DOM).
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { classifyBankCategory } from '@abdsynths/shared/components/bank/bankCategories.js';

export function getPresetCategoryInfo(category: string): { icon: string; catClass: string; paramId: number } {
  const { catClass, paramId } = classifyBankCategory(category);
  return { icon: ICONS[`param${paramId}` as keyof typeof ICONS] || ICONS.param0, catClass, paramId };
}
