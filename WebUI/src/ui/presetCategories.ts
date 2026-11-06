// ─────────────────────────────────────────────────────────
// ABDAxionikVS — Category Palette & Color Table (32 Canonical Slots)
//
// Tabla de 32 colores y equivalencias canónicas inspirada en el orden v1 (cat-0..9)
// y extendida armónicamente (cat-10..31) con tonos audibles y perceptibles en dark mode.
// Incluye persistencia de mapeos de categorías custom en localStorage ('axionik.category_colors').
//
// Regla de paridad con ABDShared:
// Si una categoría no tiene asignación explícita (en 'axionik.category_colors'),
// primero consulta a classifyBankCategory(category) de ABDShared (0..9).
// Si la categoría tiene color custom explícito, se usa dicho slot (0..31).
// Para grupos o categorías no mapeadas en v1 con fallback general, se puede
// asignar o consultar un slot extendido con getExtendedCategoryColorSlot.
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import { classifyBankCategory } from '@abdsynths/shared/components/bank/bankCategories.js';

export interface CategoryColorSlot {
  slot: number;
  catClass: string;
  name: string;
  hex: string;
  darkHex: string;
}

/**
 * 32 ranuras de colores canónicas:
 * - 0..9: Correspondencia exacta 1:1 con v1 y --color-cat-0..9 de ABDShared
 * - 10..31: Paleta extendida de alta diferenciación espectral
 */
export const CATEGORY_32_PALETTE: readonly CategoryColorSlot[] = [
  // 0..9: V1 Standard Catalog
  { slot: 0, catClass: 'cat-0', name: 'General / Neutral', hex: '#868e96', darkHex: '#adb5bd' },
  { slot: 1, catClass: 'cat-1', name: 'Strings / Solo', hex: '#20c997', darkHex: '#0ca678' },
  { slot: 2, catClass: 'cat-2', name: 'Bells / World', hex: '#6bcb77', darkHex: '#2f9e44' },
  { slot: 3, catClass: 'cat-3', name: 'Bass / Pluck', hex: '#ff922b', darkHex: '#d9480f' },
  { slot: 4, catClass: 'cat-4', name: 'Pads / Showcase', hex: '#4d96ff', darkHex: '#1971c2' },
  { slot: 5, catClass: 'cat-5', name: 'Keys / Organ', hex: '#ffd93d', darkHex: '#e67700' },
  { slot: 6, catClass: 'cat-6', name: 'Winds / Vocal', hex: '#cc5de8', darkHex: '#9c36b5' },
  { slot: 7, catClass: 'cat-7', name: 'Textures / FX', hex: '#00c3ff', darkHex: '#0090bd' },
  { slot: 8, catClass: 'cat-8', name: 'Arp / Loops', hex: '#748ffc', darkHex: '#4263eb' },
  { slot: 9, catClass: 'cat-9', name: 'Rhythm / Drums', hex: '#ff6b9d', darkHex: '#d6336c' },

  // 10..19: Subgrupos acústicos / electroacústicos
  { slot: 10, catClass: 'cat-10', name: 'Cyber Cyan', hex: '#00f2fe', darkHex: '#00acc1' },
  { slot: 11, catClass: 'cat-11', name: 'Electric Emerald', hex: '#10b981', darkHex: '#059669' },
  { slot: 12, catClass: 'cat-12', name: 'Solar Amber', hex: '#f59e0b', darkHex: '#d97706' },
  { slot: 13, catClass: 'cat-13', name: 'Crimson Flame', hex: '#ef4444', darkHex: '#dc2626' },
  { slot: 14, catClass: 'cat-14', name: 'Ultra Violet', hex: '#8b5cf6', darkHex: '#7c3aed' },
  { slot: 15, catClass: 'cat-15', name: 'Fuchsia Beam', hex: '#ec4899', darkHex: '#db2777' },
  { slot: 16, catClass: 'cat-16', name: 'Lime Acid', hex: '#84cc16', darkHex: '#65a30d' },
  { slot: 17, catClass: 'cat-17', name: 'Deep Indigo', hex: '#6366f1', darkHex: '#4f46e5' },
  { slot: 18, catClass: 'cat-18', name: 'Teal Frost', hex: '#14b8a6', darkHex: '#0d9488' },
  { slot: 19, catClass: 'cat-19', name: 'Hot Coral', hex: '#fb7185', darkHex: '#e11d48' },

  // 20..31: Texturas neuronales y experimentales v2
  { slot: 20, catClass: 'cat-20', name: 'Rose Quartz', hex: '#f43f5e', darkHex: '#be123c' },
  { slot: 21, catClass: 'cat-21', name: 'Aquamarine', hex: '#06b6d4', darkHex: '#0891b2' },
  { slot: 22, catClass: 'cat-22', name: 'Golden Glow', hex: '#eab308', darkHex: '#ca8a04' },
  { slot: 23, catClass: 'cat-23', name: 'Purple Mist', hex: '#a855f7', darkHex: '#9333ea' },
  { slot: 24, catClass: 'cat-24', name: 'Mint Shimmer', hex: '#34d399', darkHex: '#059669' },
  { slot: 25, catClass: 'cat-25', name: 'Sky Ether', hex: '#38bdf8', darkHex: '#0284c7' },
  { slot: 26, catClass: 'cat-26', name: 'Blood Orange', hex: '#f97316', darkHex: '#c2410c' },
  { slot: 27, catClass: 'cat-27', name: 'Cobalt Night', hex: '#3b82f6', darkHex: '#1d4ed8' },
  { slot: 28, catClass: 'cat-28', name: 'Orchid Pulse', hex: '#d946ef', darkHex: '#c026d3' },
  { slot: 29, catClass: 'cat-29', name: 'Warm Taupe', hex: '#a1a1aa', darkHex: '#71717a' },
  { slot: 30, catClass: 'cat-30', name: 'Sage Leaf', hex: '#a3e635', darkHex: '#4d7c0f' },
  { slot: 31, catClass: 'cat-31', name: 'Neon Plasma', hex: '#f472b6', darkHex: '#db2777' },
];

const STORAGE_CAT_COLORS_KEY = 'axionik.category_colors';

// Mapeos en memoria restaurados de localStorage
let customCategoryColors: Record<string, number> = {};

function initCustomColors(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_CAT_COLORS_KEY);
    if (raw) {
      customCategoryColors = JSON.parse(raw) || {};
    }
  } catch {
    customCategoryColors = {};
  }
}
initCustomColors();

/**
 * Guarda la asignación de color para una categoría (en memoria y localStorage).
 */
export function setCategoryColorSlot(categoryName: string, slot: number): void {
  const norm = (categoryName || '').trim().toLowerCase();
  if (!norm) return;
  const clamped = Math.max(0, Math.min(31, Math.round(slot)));
  customCategoryColors[norm] = clamped;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_CAT_COLORS_KEY, JSON.stringify(customCategoryColors));
    } catch {}
  }
}

/**
 * Obtiene el slot de color asignado o inferido para una categoría.
 * - Si tiene color custom explícito guardado por el usuario, lo usa.
 * - En caso contrario, preserva 100% la paridad canónica con classifyBankCategory (0..9).
 */
export function getCategoryColorSlot(categoryName: string): number {
  const norm = (categoryName || '').trim().toLowerCase();
  if (!norm) return 0;

  // 1. Asignación explícita previa guardada por el usuario
  if (typeof customCategoryColors[norm] === 'number') {
    return customCategoryColors[norm];
  }

  // 2. Paridad estricta con ABDShared (0..9)
  const canonical = classifyBankCategory(categoryName);
  return canonical ? canonical.paramId : 0;
}

/**
 * Calcula un color extendido para grupos o carpetas cuando se desea
 * que grupos sin clasificación estándar tengan colores distintos y estables (10..31).
 */
export function getExtendedGroupColorSlot(groupName: string): number {
  const norm = (groupName || '').trim().toLowerCase();
  if (!norm) return 0;

  if (typeof customCategoryColors[norm] === 'number') {
    return customCategoryColors[norm];
  }

  const canonical = classifyBankCategory(groupName);
  if (canonical && canonical.paramId > 0) {
    return canonical.paramId;
  }

  // Hash determinista en 10..31 para grupos desconocidos
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  return 10 + (Math.abs(hash) % 22);
}

/**
 * Información completa de categoría e icono con resolución estricta
 * conforme al contrato canónico de ABDShared.
 */
export function getPresetCategoryInfo(category: string): { icon: string; catClass: string; paramId: number; slot: number; hex: string } {
  const norm = (category || '').trim().toLowerCase();
  const hasCustom = typeof customCategoryColors[norm] === 'number';

  if (hasCustom) {
    const slot = customCategoryColors[norm];
    const colorDef = CATEGORY_32_PALETTE[slot] || CATEGORY_32_PALETTE[0];
    const v1ParamId = slot < 10 ? slot : (slot % 10);
    const iconKey = `param${v1ParamId}` as keyof typeof ICONS;
    return {
      icon: ICONS[iconKey] || ICONS.param0,
      catClass: colorDef.catClass,
      paramId: v1ParamId,
      slot,
      hex: colorDef.hex,
    };
  }

  // Sin custom explícito: paridad idéntica con classifyBankCategory
  const canonical = classifyBankCategory(category);
  const paramId = canonical ? canonical.paramId : 0;
  const colorDef = CATEGORY_32_PALETTE[paramId] || CATEGORY_32_PALETTE[0];
  const iconKey = `param${paramId}` as keyof typeof ICONS;

  return {
    icon: ICONS[iconKey] || ICONS.param0,
    catClass: canonical ? canonical.catClass : 'cat-0',
    paramId,
    slot: paramId,
    hex: colorDef.hex,
  };
}

/**
 * Lista de nombres estándar de categorías para selectores y diálogos de guardado.
 */
export const STANDARD_CATEGORY_NAMES: readonly string[] = [
  'General',
  'Strings / Solo',
  'Bells / World',
  'Bass / Pluck',
  'Pads / Showcase',
  'Keys / Organ',
  'Winds / Vocal',
  'Textures / FX',
  'Arp / Loops',
  'Rhythm / Drums',
  'Leads / Synth',
  'Drones / Ambient',
  'Sequences / Riffs',
  'Experimental v2',
  'Acoustic Re-Synth',
  'Granular Scapes',
];
