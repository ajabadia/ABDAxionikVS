/**
 * ABDAxionikVS — app/engineMode.ts
 * Engine-mode vocabulary lives here: user selection fan-out plus the two
 * normalizers (preset files accept 'legacy'/'expanded', the host also sends
 * 'classic-enhanced' and a separate compile target).
 */
import { WebBridge } from '../bridge/WebBridge.js';
import type { AppCtx } from './context.js';

export type EngineMode = 'classic' | 'plus' | 'expanded';

/** User-driven switch: engine + bank follow, UI toasts. */
export function selectEngineMode(ctx: AppCtx, mode: EngineMode): void {
  WebBridge.setEngineMode(mode);
  ctx.bankDrawer?.setEngineMode(mode);
  ctx.dragDropHandler?.showToast(`[ENGINE MODE] ${mode.toUpperCase()}`);
}

/** Preset-file vocabulary: 'expanded' stays distinct, anything else falls back to 'legacy'. */
export function normalizePresetEngineMode(raw: unknown): 'classic' | 'plus' | 'extended' | 'legacy' {
  if (raw === 'expanded') return 'extended';
  if (raw === 'classic' || raw === 'plus' || raw === 'extended' || raw === 'legacy') return raw;
  return 'legacy';
}

/** Host compile-target vocabulary: strict trio, unknown means expanded. */
export function normalizeHostCompileTarget(raw: unknown): EngineMode {
  switch (String(raw || 'expanded')) {
    case 'classic':
      return 'classic';
    case 'plus':
      return 'plus';
    default:
      return 'expanded';
  }
}

/**
 * File 'legacy' has no UI counterpart: it runs as classic. The cast preserves
 * the historical quirk verbatim ('expanded' file mode reaches the engine as
 * the 'extended' string); WebBridge/host already tolerate it.
 */
export function toUiEngineMode(norm: 'classic' | 'plus' | 'extended' | 'legacy'): 'classic' | 'plus' | 'expanded' {
  return (norm === 'legacy' ? 'classic' : norm) as 'classic' | 'plus' | 'expanded';
}

/** Host-message vocabulary: 'classic-enhanced' means plus, unknown means expanded. */
export function normalizeHostEngineMode(raw: unknown): EngineMode {
  switch (String(raw || 'expanded')) {
    case 'classic':
      return 'classic';
    case 'plus':
    case 'classic-enhanced':
      return 'plus';
    default:
      return 'expanded';
  }
}
