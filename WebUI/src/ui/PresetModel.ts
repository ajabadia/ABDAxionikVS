/**
 * ABDAxionikVS — PresetModel.ts
 * Schema v2 para presets de usuario AxionikVS y helpers de serialización.
 * Diseñado para extensibilidad (Resynators v2 y bloques de efectos futuros).
 */

export interface AxionikPresetMeta {
  name: string;
  category?: string;
  author?: string;
  date?: string;
  comment?: string;
}

export interface AxionikPresetModelRef {
  id: number;
  name: string;
}

export interface AxionikPreset {
  formatVersion: 2;
  meta: AxionikPresetMeta;
  engineMode?: 'legacy' | 'extended';
  models: {
    resynator1: AxionikPresetModelRef;
    resynator2: AxionikPresetModelRef;
  };
  /** Snapshot de parámetros mapeados por su índice ParamIdx (0..444) */
  parameters: Record<number, number>;
  /** Bloque extensible para Resynators v2 y futuros bloques modulares de efectos */
  extendedState?: {
    resynatorV2?: Record<string, unknown>;
    extraEffects?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/**
 * Serializa un preset a cadena JSON con formato legible (indentado 2 espacios).
 */
export function serializePreset(preset: AxionikPreset): string {
  return JSON.stringify(preset, null, 2);
}

/**
 * Parsea un archivo de texto intentando reconocer el formato AxionikPreset (JSON v2).
 * Si no es válido o no cumple con el contrato v2, devuelve null.
 */
export function parsePresetFile(content: string): AxionikPreset | null {
  try {
    const data = JSON.parse(content);
    if (!data || typeof data !== 'object') return null;
    if (data.formatVersion === 2 && data.meta && typeof data.meta.name === 'string' && data.parameters) {
      return data as AxionikPreset;
    }
  } catch {
    // No es JSON válido
  }
  return null;
}

/**
 * Dispara la descarga del preset en el navegador en formato .axpreset.
 */
export function downloadPresetFile(preset: AxionikPreset): void {
  const json = serializePreset(preset);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `${preset.meta.name.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim() || 'Preset'}.axpreset`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
