// ─────────────────────────────────────────────────────────
// ABDAxionikVS — AxionikParameterSet.ts
// Fuente única de verdad para los Parameter Sets de AxionikDB.
//
// Cada definición reúne el número canónico, el nombre visible, la categoría
// corta, las carpetas de AxionikDB, los alias de categoría humana y las reglas
// de keyword. Las tablas de consulta y las etiquetas de la UI se derivan de
// esta lista; no se mantienen copias separadas.
// ─────────────────────────────────────────────────────────

export interface ParameterSetKeywordRule {
  readonly pattern: RegExp;
  readonly priority: number;
}

export interface AxionikParameterSetDefinition {
  readonly id: number;
  readonly name: string;
  readonly category: string;
  readonly folders: readonly string[];
  readonly aliases: readonly string[];
  readonly keywordRules?: readonly ParameterSetKeywordRule[];
}

/**
 * Tabla canónica. El ID es el número de Parameter Set; el orden de las
 * definiciones no importa para las etiquetas, pero `priority` fija la
 * precedencia de las reglas de keyword.
 */
export const AXIONIK_PARAMETER_SET_DEFINITIONS: readonly AxionikParameterSetDefinition[] = [
  {
    id: 2,
    name: 'Plucked & Bells',
    category: 'Plucked',
    folders: ['02_Chromatic_Bells'],
    aliases: ['mallets & chromatic perc'],
    keywordRules: [{ pattern: /(bell|mallet|chromatic|steel\s?drum)/, priority: 10 }],
  },
  {
    id: 7,
    name: 'Extreme Pads',
    category: 'Pads',
    folders: ['03_Pads_Atmospheres'],
    aliases: ['pads & atmospheres'],
    keywordRules: [{ pattern: /(pad|atmosphere)/, priority: 20 }],
  },
  {
    id: 5,
    name: 'Piano etc.',
    category: 'Keys',
    folders: ['01_Keyboards_Piano'],
    aliases: ['keyboards & acoustic pianos', 'electric pianos & tines'],
    keywordRules: [{ pattern: /(piano|keyboard|tines|organ)/, priority: 30 }],
  },
  {
    id: 8,
    name: 'Loop Factory',
    category: 'Loops',
    folders: ['06_Percussion_Hits'],
    aliases: ['drums & percussion kit', 'arpeggiated & sequences'],
    keywordRules: [
      { pattern: /(percussion|drum|rhythm|hit)/, priority: 40 },
      { pattern: /(arp|sequence|loop)/, priority: 100 },
    ],
  },
  {
    id: 1,
    name: 'Stringed / Bowed',
    category: 'Strings',
    folders: [],
    aliases: ['vocal & choir', 'orchestral & strings'],
    keywordRules: [{ pattern: /(string|orchestral|bowed|vocal|choir|voice)/, priority: 50 }],
  },
  {
    id: 6,
    name: 'Woodwinds',
    category: 'Wind',
    folders: ['05_Leads_Winds'],
    aliases: ['brass & horns', 'woodwinds & reeds'],
    keywordRules: [{ pattern: /(wind|reed|flute|brass|horn)/, priority: 60 }],
  },
  {
    id: 3,
    name: 'Plucked & Picked',
    category: 'Plucked',
    folders: ['04_Bass_LowEnd'],
    aliases: ['bass & low end', 'plucked & ethnic / world'],
    keywordRules: [
      { pattern: /(bass|low.?end)/, priority: 70 },
      { pattern: /(pluck|ethnic|world|guitar)/, priority: 80 },
    ],
  },
  {
    id: 9,
    name: 'Multipurpose',
    category: 'Multi',
    folders: ['07_Experimental_Resonators'],
    aliases: ['sfx, drones & cinematic'],
    keywordRules: [{ pattern: /(sfx|drone|cinematic|experimental|resonator|multipurpose)/, priority: 90 }],
  },
  {
    id: 0,
    name: 'Default Set',
    category: 'General',
    folders: [],
    aliases: ['synth leads & solos', 'synth & neutral'],
    keywordRules: [{ pattern: /(synth|lead|neutral|default)/, priority: 110 }],
  },
  {
    id: 4,
    name: 'Carpet Shop',
    category: 'Pads',
    folders: [],
    aliases: [],
  },
];

function normalizeCategory(category: string): string {
  return category
    .replace(/\\/g, '/')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeFolderName(folder: string): string {
  return folder.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function buildLookup(
  select: (definition: AxionikParameterSetDefinition) => readonly string[],
  normalize: (value: string) => string,
): Readonly<Record<string, number>> {
  const lookup: Record<string, number> = {};
  for (const definition of AXIONIK_PARAMETER_SET_DEFINITIONS) {
    for (const value of select(definition)) {
      lookup[normalize(value)] = definition.id;
    }
  }
  return lookup;
}

const FOLDER_PARAMETER_SETS = buildLookup(
  (definition) => definition.folders,
  normalizeFolderName,
);

const CATEGORY_PARAMETER_SETS = buildLookup(
  (definition) => definition.aliases,
  normalizeCategory,
);

const KEYWORD_RULES = AXIONIK_PARAMETER_SET_DEFINITIONS.flatMap((definition) =>
  (definition.keywordRules ?? []).map((rule) => ({
    pattern: rule.pattern,
    parameterSet: definition.id,
    priority: rule.priority,
  })),
).sort((a, b) => a.priority - b.priority);

const SORTED_DEFINITIONS = [...AXIONIK_PARAMETER_SET_DEFINITIONS].sort((a, b) => a.id - b.id);

/** Nombres de los 10 sets, ordenados por ID, para la UI y los presets clásicos. */
export const PARAM_SET_NAMES: readonly string[] = SORTED_DEFINITIONS.map(
  (definition) => definition.name,
);

/** Metadatos de los 10 sets, ordenados por ID, para las chips de la UI. */
export const PARAMETER_SETS: readonly {
  id: number;
  name: string;
  category: string;
}[] = SORTED_DEFINITIONS.map(({ id, name, category }) => ({ id, name, category }));

/**
 * Obtiene el Parameter Set a partir de una categoría humana o de una ruta
 * de carpetas de AxionikDB, p. ej.
 * `Transformed_HD_96k/01_Keyboards_Piano` → 5 (Piano etc.).
 * Devuelve 0 (Default Set) si no hay ninguna coincidencia.
 */
export function deriveAxionikParameterSet(category: string): number {
  const normalized = normalizeCategory(category);
  if (!normalized) return 0;

  const direct = CATEGORY_PARAMETER_SETS[normalized];
  if (direct !== undefined) return direct;

  const segments = normalized.split('/');
  for (let i = segments.length - 1; i >= 0; i--) {
    const folderSet = FOLDER_PARAMETER_SETS[normalizeFolderName(segments[i])];
    if (folderSet !== undefined) return folderSet;
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(normalized)) return rule.parameterSet;
  }

  return 0;
}

/**
 * Resuelve el Parameter Set efectivo de un modelo expandido.
 * Un valor explícito válido (0..9) tiene prioridad; en caso contrario
 * se deriva de la categoría, incluyendo el sentinel -1 del host nativo.
 */
export function resolveAxionikParameterSet(
  category: string,
  explicit?: number | null,
): number {
  if (
    typeof explicit === 'number' &&
    Number.isInteger(explicit) &&
    explicit >= 0 &&
    explicit <= 9
  ) {
    return explicit;
  }
  return deriveAxionikParameterSet(category);
}
