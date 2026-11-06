// ─────────────────────────────────────────────────────────
// ABDAxionikVS — ResynatorModelIdentity.ts
// Resuelve la identidad visible (nombre y Parameter Set) de un modelo de
// Resynator a partir del catálogo del banco, del metadato canónico o de un
// valor explícito reportado por el host. La usan la carga de presets y los
// reportes RESYNATOR_SHAPERS para sincronizar el drawer abierto.
// ─────────────────────────────────────────────────────────

import { MODEL_METADATA, getCanonicalModelName } from './NeuronCatalogMetadata.js';

/** Entrada mínima del catálogo de modelos clásicos (NeuronDB). */
export interface ResynatorModelCatalogEntry {
  slot: number;
  name: string;
  parameterSet: number;
}

export interface ResynatorModelIdentity {
  name: string;
  parameterSet: number;
}

/** Entrada mínima del catálogo de modelos expandidos de AxionikDB. */
export interface ExpandedModelCatalogEntry {
  slug: string;
  name: string;
}

/**
 * Busca una entrada del catálogo expandido por el slug reportado por el host.
 * Los modelos cargados desde el banco nativo usan el nombre de carpeta como
 * slug, mientras que el host reporta `identity.slug`; en ese caso se usa el
 * nombre visible como segundo criterio.
 */
export function findExpandedModelCatalogEntry<T extends ExpandedModelCatalogEntry>(
  models: ReadonlyArray<T> | undefined,
  input: { slug?: string; name?: string },
): T | undefined {
  if (!models || models.length === 0) return undefined;
  const slug = input.slug?.trim();
  const name = input.name?.trim();
  return (
    (slug ? models.find((model) => model.slug === slug) : undefined) ??
    (name ? models.find((model) => model.name === name) : undefined)
  );
}

/**
 * Normaliza un Parameter Set al rango canónico 0..9. Cualquier valor ausente,
 * no entero o fuera de rango se representa como -1 ("sin metadato").
 */
export function normalizeParameterSet(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9
    ? value
    : -1;
}

/**
 * Prioridad: valor explícito (host/preset) > entrada del catálogo > metadato
 * canónico. El nombre explícito nunca se descarta; si falta, se usa el del
 * catálogo y, en último término, el nombre canónico de la ranura.
 */
export function resolveResynatorModelIdentity(input: {
  slot: number;
  name?: string;
  parameterSet?: number;
  catalog?: ReadonlyArray<ResynatorModelCatalogEntry>;
}): ResynatorModelIdentity {
  const slot = Number.isFinite(input.slot) ? Math.round(input.slot) : -1;
  const catalogEntry = input.catalog?.find((model) => model.slot === slot);

  const explicitName = input.name?.trim();
  const name = explicitName || catalogEntry?.name || getCanonicalModelName(slot);

  const explicitSet = normalizeParameterSet(input.parameterSet);
  const catalogSet = normalizeParameterSet(catalogEntry?.parameterSet);
  const meta = MODEL_METADATA[slot];
  const metaSet = meta ? normalizeParameterSet(meta[0]) : -1;
  const parameterSet = explicitSet >= 0 ? explicitSet : catalogSet >= 0 ? catalogSet : metaSet;

  return { name, parameterSet };
}
