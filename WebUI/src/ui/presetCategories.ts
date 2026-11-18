// ─────────────────────────────────────────────────────────
// ABDAxionikVS — Category Palette & Color Table (Delegated to ABDShared)
// ─────────────────────────────────────────────────────────

import { ICONS } from './icons.js';
import {
  CATEGORY_32_PALETTE,
  getCategoryColorSlot as sharedGetColorSlot,
  setCategoryColorSlot as sharedSetColorSlot,
  getExtendedGroupColorSlot as sharedGetExtendedSlot,
  classifyBankCategory,
  STANDARD_CATEGORY_NAMES,
} from '@abdsynths/shared/components/bank/index.js';

export interface CategoryColorSlot {
  slot: number;
  catClass: string;
  name: string;
  hex: string;
  darkHex: string;
}

export { CATEGORY_32_PALETTE, STANDARD_CATEGORY_NAMES };

export function setCategoryColorSlot(categoryName: string, slot: number): void {
  sharedSetColorSlot(categoryName, slot);
}

export function getCategoryColorSlot(categoryName: string): number {
  return sharedGetColorSlot(categoryName);
}

export function getExtendedGroupColorSlot(groupName: string): number {
  return sharedGetExtendedSlot(groupName);
}

export function getPresetCategoryInfo(category: string): {
  icon: string;
  catClass: string;
  paramId: number;
  slot: number;
  hex: string;
} {
  const slot = sharedGetColorSlot(category);
  const colorDef = CATEGORY_32_PALETTE[slot] || CATEGORY_32_PALETTE[0];
  const canonical = classifyBankCategory(category);
  const v1ParamId = slot < 10 ? slot : (canonical ? canonical.paramId : (slot % 10));
  const iconKey = `param${v1ParamId}` as keyof typeof ICONS;

  return {
    icon: ICONS[iconKey] || ICONS.param0,
    catClass: colorDef.catClass,
    paramId: v1ParamId,
    slot,
    hex: colorDef.hex,
  };
}
