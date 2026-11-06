/**
 * ABDAxionikVS - AxionikPreset v2 Schema & Persistence Helpers
 * ============================================================
 *
 * ## Estructura del preset v2 (`AxionikPreset`)
 *
 * Un preset v2 siempre tiene `formatVersion` fijo en `2` y está compuesto por:
 * - `formatVersion`: 2 ( número entero). Indica que el payload sigue el contrato v2.
 * - `meta`: metadatos del preset (nombre, categoría, autor, fecha y comentario).
 * - `engineMode`: cadena opcional que indica el origen del preset:
 *   - `"legacy"`: snapshot de los 445 parámetros originales (`sound.script`),
 *     compatibilidad inversa.
 *   - `"extended"`: preset proveniente de un estado DSP v2 extendido
 *     (Resynator v2 / bloques modulares). Cuando falta, se asume "legacy".
 * - `models`: referencias a los modelos activos de cada Resynator:
 *   - `resynator1`: { id: number, name: string }
 *   - `resynator2`: { id: number, name: string }
 * - `parameters`: snapshot de los parámetros normalizados, guardado como
 *   `Record<number, number>` mapeado por su índice (0..444). El persistido
 *   base equivale a una secuencia plana `[v0, v1, ..., v444]`.
 * - `extendedState?`: bloque adicional opcional para futuros modos de Resynator v2
 *   y efectos modulares, por ejemplo:
 *   - `resynatorV2?: Record<string, unknown>`
 *   - `extraEffects?: Record<string, unknown>`
 *   - `[key: string]: unknown`
 *
 * ## Compatibilidad con JSON legacy
 *
 * Cualquier JSON que exponga un campo `parameters` (tamaño <= 445, es decir,
 * el snapshot original `sound.script`) es aceptado por `parsePresetFile` y se
 * normaliza automáticamente a v2:
 * - `engineMode` se fija a `"legacy"`.
 * - `formatVersion` se fija a `2`.
 * - `meta` y `models` se completan con valores por defecto si faltan.
 *
 * El soporte de dumps legacy permite cargar presets guardados por versiones
 * anteriores del engine (sound.script) sin cambios en los archivos existentes.
 *
 * ## Helpers de persistencia y bridge
 *
 * - `serializePreset(preset)`: devuelve una cadena JSON valida (indentación 2),
 *   lista para guardar o enviar al host.
 * - `parsePresetFile(content)`: recibe una cadena JSON y devuelve el `AxionikPreset`.
 *   Devuelve `null` si no es un JSON válido v2/legacy.
 * - `downloadPresetFile(preset)`: descarga el preset como archivo `.axpreset`
 *   en el navegador (sin usar almacenamiento local).
 * - `sanitizeFilename(name)`: pone un nombre de archivo seguro, reemplazando
 *   caracteres prohibidos y controlando los múltiples puntos.
 * - `serializePresetForHost(preset)`: alias de `serializePreset`, mantenido por
 *   compatibilidad con el puente al host.
 * - `savePreset(preset, engineMode?)`: envía el preset al host mediante el mensaje
 *   `PRESET_SAVE` (persistencia en el host).
 * - `requestPresetSaveFromBridge(preset)`: envía `PRESET_SAVE` al Host y devuelve
 *   `true` si el mensaje fue entregado.
 *
 * ## Ejemplo de preset v2
 *
 * ```json
 * {
 *   "formatVersion": 2,
 *   "meta": {
 *     "name": "My Preset",
 *     "category": "User",
 *     "author": "User",
 *     "date": "2026-01-01T00:00:00Z",
 *     "comment": "Example"
 *   },
 *   "engineMode": "legacy",
 *   "models": {
 *     "resynator1": {"id": 12, "name": "R1"},
 *     "resynator2": {"id": 34, "name": "R2"}
 *   },
 *   "parameters": {
 *     "0": 0.12,
 *     "10": 0.45,
 *     "444": -0.2
 *   },
 *   "extendedState": {
 *     "resynatorV2": { "gain": 1.2 },
 *     "extraEffects": {}
 *   }
 * }
 * ```
 *
 * La serialización clave preserva los índices numéricos; al deserializarse,
 * `parameters` se convierte de nuevo en `Record<number, number>`, con lo que el
 * arreglo plano original `[v0, v1, ..., v444]` se puede reconstruir.
 *
 * ## Convenciones de codificación
 *
 * - Los strings deben estar escritos en UTF-8.
 * - Los saltos de línea usados en este proyecto son LF (`\n`).
 * - No se usan métodos DOM directamente dentro de este módulo; la descarga se
 *   realiza vía `downloadPresetFile` para mantener la separación de capas.
 * - Los ids de los modelos (R1/R2) se reciben como numbers y pueden venir de
 *   `undefined`; en ese caso se usan `0` como id seguro, y el nombre por defecto
 *   es `"Unknown"`.
 * - Los valores numéricos dentro de `parameters` son estrictamente validados:
 *   se descartan todos los que no sean números finitos (`NaN`, `Infinity`),
 *   evitando que un JSON corrupto con valores no finitos llegue al pipeline
 *   DSP y desestabilice los filtros IIR o propague ruido no controlado.
 *   La conversión a escala de 16 bits y el redondeo se hace en el pipeline DSP
 *   (ver `WebUI/src/app/paramUpdate.ts`).
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
  /** 'classic' | 'plus' | 'extended' | 'legacy'. 'legacy' = snapshot de 445 params estilo sound.script, 'extended' = estado DSP v2 extendido. */
  engineMode?: 'classic' | 'plus' | 'extended' | 'legacy';
  models: {
    resynator1: AxionikPresetModelRef;
    resynator2: AxionikPresetModelRef;
  };
  /** Snapshot de los parametros normalizados mapeados por su indice (0..444). */
  parameters: Record<number, number>;
  /** Bloque extensible para Resynators v2 y futuros bloques modulares de efectos. */
  extendedState?: {
    resynatorV2?: Record<string, unknown>;
    extraEffects?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/**
 * Explicito de que la serializacion v2 cumple lo que el schema declara.
 * No suprime errores; solo refuerza el contrato de lectura/escritura.
 */
export function isAxionikPreset(value: unknown): value is AxionikPreset {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.formatVersion === 2 &&
    typeof v.meta === 'object' &&
    typeof (v.meta as Record<string, unknown>).name === 'string' &&
    Array.isArray((v.parameters as unknown)) === false &&
    (typeof (v.parameters as Record<number, number>) === 'object' || typeof (v.parameters as unknown) === 'object')
  );
}

/**
 * Extrae un objeto `parameters: Record<number, number>` de fuentes distintas.
 * - Si `payload.parameters` es un array [v0..v444] => mapea por indice (legacy serializado).
 * - Si es un objeto { 0: v, 1: v, ... } => se usa tal cual.
 * - Cualquier otro objeto se somete a un filtrado seguro por clave numerica.
 */
function normalizeParameters(payload: unknown): Record<number, number> {
  const params = payload as Record<string, unknown> | undefined;
  const raw = params?.parameters ?? payload;

  if (raw === undefined || raw === null) return {};

  if (Array.isArray(raw)) {
    const out: Record<number, number> = {};
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      // Solo aceptan números finitos: NaN e Infinity son descartados explícitamente
      // para que un JSON corrupto no llegue al pipeline DSP.
      if (typeof v === 'number' && Number.isFinite(v)) out[i] = v;
      // NaN/Infinity ya son rechazados por Number.isFinite; cualquier otro tipo se descarta.
    }
    return out;
  }

  if (typeof raw === 'object') {
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      const idx = Number(k);
      if (Number.isInteger(idx) && Number.isFinite(v as number)) {
        out[idx] = v as number;
      }
      // NaN/Infinity ya son descartados por Number.isFinite; cualquier otro tipo se ignora.
      // NaN/Infinity ya son rechazados por Number.isFinite; cualquier otro tipo se descarta.
    }
    return out;
  }

  return {};
}

/**
 * Construye un completo AxionikPreset v2 a partir de la informacion que la UI tiene disponible.
 *
 * - `params`: snapshot de parametros (Record<number, number>).
 * - `r1ModelId/r1ModelName`, `r2ModelId/r2ModelName`: referencias de los modelos cargados.
 * - `engineMode`: 'legacy' por defecto, 'extended' si la UI indica que el preset proviene de
 *   un estado extendido/Resynator v2.
 */
export function createAxionikPresetV2({
  params,
  r1ModelId,
  r1ModelName,
  r2ModelId,
  r2ModelName,
  engineMode = 'legacy',
  meta,
  extendedState,
}: {
  params: Record<number, number>;
  r1ModelId: number;
  r1ModelName: string;
  r2ModelId: number;
  r2ModelName: string;
  engineMode?: 'classic' | 'plus' | 'extended' | 'legacy';
  meta?: Partial<AxionikPresetMeta>;
  extendedState?: AxionikPreset['extendedState'];
}): AxionikPreset {
  return {
    formatVersion: 2,
    meta: {
      name: (meta?.name ?? 'Untitled').toString(),
      category: meta?.category ?? 'User',
      author: meta?.author ?? 'User',
      date: meta?.date ?? new Date().toISOString(),
      comment: meta?.comment,
    },
    engineMode,
    models: {
      resynator1: { id: Math.trunc(Number(r1ModelId) || 0), name: r1ModelName },
      resynator2: { id: Math.trunc(Number(r2ModelId) || 0), name: r2ModelName },
    },
    parameters: params,
    extendedState,
  };
}

/**
 * Serializa un preset v2 a JSON legible (indentado 2 espacios).
 */
export function serializePreset(preset: AxionikPreset): string {
  return JSON.stringify(preset, null, 2);
}

/**
 * Parsea una cadena de texto y devuelve el preset v2 si es valido, o null.
 *
 * Se acepta:
 *  - JSON v2 canonical (formatVersion 2 con meta.name y parameters).
 *  - JSON no canonical que contenga `parameters` (por compatibilidad con dumps
 *    de otras partes del sistema); se normaliza a v2 en el momento de carga,
 *    conservando los metadatos y referencias del JSON si los encuentra.
 */
export function parsePresetFile(content: string): AxionikPreset | null {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }

  if (typeof data !== 'object' || data === null) return null;

  const v = data as Record<string, unknown>;

  // JSON v2: campos obligatorios del contrato.
  if (
    v.formatVersion === 2 &&
    typeof v.meta === 'object' &&
    typeof (v.meta as Record<string, unknown>).name === 'string' &&
    typeof v.models === 'object'
  ) {
    return sanitizeAxionikPreset(v as Record<string, unknown>);
  }

  // Legacy/other dumps: solo aceptar si expone parametros.
  if (typeof v.parameters === 'object' && v.parameters !== null) {
    const params = normalizeParameters(v);
    if (Object.keys(params).length > 0) {
      return createAxionikPresetV2({
        params,
        r1ModelId: 511,
        r1ModelName: 'Unknown',
        r2ModelId: 511,
        r2ModelName: 'Unknown',
        engineMode: 'legacy',
        meta: {
          name: typeof v.name === 'string' ? v.name : 'Legacy Preset',
          category: typeof v.category === 'string' ? v.category : 'User',
          author: typeof v.author === 'string' ? v.author : 'User',
          date: typeof v.date === 'string' ? v.date : new Date().toISOString(),
        },
      });
    }
  }

  return null;
}

/**
 * Normaliza un objeto ya parseado a AxionikPreset, sin reformatear datos numericos.
 * Solo asegura que el objeto cumple el contrato getTypeScript para esto.
 */
function sanitizeAxionikPreset(v: Record<string, unknown>): AxionikPreset {
  const params = normalizeParameters(v);
  const metaVal = v.meta as Record<string, unknown> | undefined;
  const meta: AxionikPresetMeta = {
    name: typeof metaVal?.name === 'string' ? metaVal.name : 'Untitled',
    category: typeof metaVal?.category === 'string' ? metaVal.category : undefined,
    author: typeof metaVal?.author === 'string' ? metaVal.author : undefined,
    date: typeof metaVal?.date === 'string' ? metaVal.date : undefined,
    comment: typeof metaVal?.comment === 'string' ? metaVal.comment : undefined,
  };

  const models = v.models as Record<string, unknown> | undefined;
  const res1 = models?.resynator1 as Record<string, unknown> | undefined;
  const res2 = models?.resynator2 as Record<string, unknown> | undefined;

  if (!res1 || typeof res1.id !== 'number' || !res2 || typeof res2.id !== 'number') {
    // Fallback seguro si la UI no ha poblado los modelos: dejar un objeto valido.
    // La UI que carga el preset deberia obtener los IDs de su estado actual.
    return createAxionikPresetV2({
      params,
      r1ModelId: 511,
      r1ModelName: 'Unknown',
      r2ModelId: 511,
      r2ModelName: 'Unknown',
      engineMode: 'extended',
      meta,
      extendedState: v.extendedState as AxionikPreset['extendedState'],
    });
  }

  return createAxionikPresetV2({
    params,
    r1ModelId: res1.id,
    r1ModelName: typeof res1.name === 'string' ? res1.name : 'Unknown',
    r2ModelId: res2.id,
    r2ModelName: typeof res2.name === 'string' ? res2.name : 'Unknown',
    engineMode: v.engineMode === 'expanded' ? 'extended' : (v.engineMode === 'classic' || v.engineMode === 'plus' || v.engineMode === 'extended' || v.engineMode === 'legacy' ? v.engineMode : 'legacy'),
    meta,
    extendedState: v.extendedState as AxionikPreset['extendedState'],
  });
}

/**
 * Dispara la descarga del preset en el navegador en formato .axpreset.
 */
export function downloadPresetFile(preset: AxionikPreset): void {
  const json = serializePreset(preset);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `${sanitizeFilename(preset.meta.name)}.axpreset`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Nombre seguro para archivos: solo caracteres alfanumericos, guiones y espacios.
 */
export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[<>:"/\|?*]/g, '_')
      .replace(/[^A-Za-z0-9 _.-]/g, '_')
      .replace(/\.+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^_/, '')
      .replace(/_$/, '') || 'Preset'
  );
}

/**
 * Exporta un preset a un string listo para enviar al Host/C++ v2 WebBridge.
 */
export function serializePresetForHost(preset: AxionikPreset): string {
  return serializePreset(preset);
}

/**
 * Envio un evento PRESET_SAVE al Host via puente y devuelve true si la idea
 * fue enviada (no solo intentada). El Host decide persistir en su carpeta.
 */
export function requestPresetSaveFromBridge(
  preset: AxionikPreset,
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const msg: Record<string, unknown> = {
      type: 'PRESET_SAVE',
      payload: serializePresetForHost(preset),
    };
    (window as any).WebBridge?.send(msg as any);
    return true;
  } catch {
    return false;
  }
}
