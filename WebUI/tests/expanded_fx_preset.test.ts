import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WebBridge } from '../src/bridge/WebBridge.js';
import { applyPresetExtendedState } from '../src/app/applyPresetExtendedState.js';
import {
  AXIONIK_EXPANDED_FX_DEFAULTS,
  AXIONIK_EXPANDED_PARAMETER_COUNT,
  createAxionikPresetV2,
  createDefaultResynatorShapers,
  createExtendedStateForSave,
  parsePresetFile,
  sanitizeExpandedFx,
  sanitizeExtendedState,
  serializePreset,
  type AxionikExpandedFxState,
  type AxionikPreset,
} from '../src/ui/PresetModel.js';

// jsdom bootstrap (mismo patrón que preset_save_integration.test.ts)
if (!globalThis.document) {
  const jsdom = require('jsdom');
  const { JSDOM } = jsdom;
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
}
// @ts-ignore — jsdom globals
globalThis.window = globalThis as unknown as Window;
// @ts-ignore — jsdom globals
globalThis.document = globalThis.window.document;

// ─── Helpers ────────────────────────────────────────────────────────────────

const SAMPLE_FX: AxionikExpandedFxState = {
  freqFxAlg: 5,
  freqFxMacros: [0.7, 0.5, 0.3, 0.6],
  timeFxAlg: 6,
  timeFxMacros: [0.4, 0.5, 0.6, 0.3],
  masterDelayAlg: 1,
  masterRevAlg: 1,
  masterFxMacros: [0.4, 0.6, 0.5, 0.3],
};

function makeExpandedPreset(fx: AxionikExpandedFxState = SAMPLE_FX): AxionikPreset {
  return createAxionikPresetV2({
    params: {
      0: 1, 10: 2.5, 444: -1,
      // Rack EXPANDED
      463: fx.freqFxAlg,
      464: fx.freqFxMacros[0], 465: fx.freqFxMacros[1], 466: fx.freqFxMacros[2], 467: fx.freqFxMacros[3],
      468: fx.timeFxAlg,
      469: fx.timeFxMacros[0], 470: fx.timeFxMacros[1], 471: fx.timeFxMacros[2], 472: fx.timeFxMacros[3],
      473: fx.masterDelayAlg,
      474: fx.masterRevAlg,
      475: fx.masterFxMacros[0], 476: fx.masterFxMacros[1], 477: fx.masterFxMacros[2], 478: fx.masterFxMacros[3],
    },
    r1ModelId: 12,
    r1ModelName: 'fmrhodes_AI_BWE',
    r2ModelId: 34,
    r2ModelName: 'Grand_AI_BWE',
    engineMode: 'extended',
    meta: {
      name: 'Expanded FX Test',
      category: 'Expanded v2 / FreqFX',
      author: 'Test',
      date: '2026-11-12T00:00:00Z',
    },
    extendedState: createExtendedStateForSave({
      r1ModelName: 'fmrhodes_AI_BWE',
      r2ModelName: 'Grand_AI_BWE',
      r1ModelSlug: 'fmrhodes-ai-bwe',
      r2ModelSlug: 'grand-ai-bwe',
      r1Shapers: createDefaultResynatorShapers(),
      r2Shapers: createDefaultResynatorShapers(),
      expandedFx: fx,
    }),
  });
}

// ─── AXIONIK_EXPANDED_PARAMETER_COUNT ────────────────────────────────────────

describe('AXIONIK_EXPANDED_PARAMETER_COUNT', () => {
  it('is 479 (indices 0..478)', () => {
    expect(AXIONIK_EXPANDED_PARAMETER_COUNT).toBe(479);
  });
});

// ─── AXIONIK_EXPANDED_FX_DEFAULTS ────────────────────────────────────────────

describe('AXIONIK_EXPANDED_FX_DEFAULTS', () => {
  it('has zeroed algorithms and 0.5 macros', () => {
    expect(AXIONIK_EXPANDED_FX_DEFAULTS.freqFxAlg).toBe(0);
    expect(AXIONIK_EXPANDED_FX_DEFAULTS.timeFxAlg).toBe(0);
    expect(AXIONIK_EXPANDED_FX_DEFAULTS.masterDelayAlg).toBe(0);
    expect(AXIONIK_EXPANDED_FX_DEFAULTS.masterRevAlg).toBe(0);
    expect(AXIONIK_EXPANDED_FX_DEFAULTS.freqFxMacros).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(AXIONIK_EXPANDED_FX_DEFAULTS.timeFxMacros).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(AXIONIK_EXPANDED_FX_DEFAULTS.masterFxMacros).toEqual([0.5, 0.5, 0.5, 0.5]);
  });
});

// ─── sanitizeExpandedFx ───────────────────────────────────────────────────────

describe('sanitizeExpandedFx', () => {
  it('returns valid struct from a well-formed object', () => {
    const result = sanitizeExpandedFx({
      freqFxAlg: 5,
      freqFxMacros: [0.7, 0.5, 0.3, 0.6],
      timeFxAlg: 6,
      timeFxMacros: [0.4, 0.5, 0.6, 0.3],
      masterDelayAlg: 1,
      masterRevAlg: 1,
      masterFxMacros: [0.4, 0.6, 0.5, 0.3],
    });
    expect(result).toEqual(SAMPLE_FX);
  });

  it('returns undefined for null, array or missing alg fields', () => {
    expect(sanitizeExpandedFx(null)).toBeUndefined();
    expect(sanitizeExpandedFx([])).toBeUndefined();
    expect(sanitizeExpandedFx({ timeFxAlg: 0, masterDelayAlg: 0, masterRevAlg: 0 })).toBeUndefined();
  });

  it('clamps alg values out of range to undefined (returns undefined)', () => {
    // freqFxAlg=99 is out of [0..7]
    const result = sanitizeExpandedFx({
      freqFxAlg: 99,
      freqFxMacros: [0.5, 0.5, 0.5, 0.5],
      timeFxAlg: 0,
      timeFxMacros: [0.5, 0.5, 0.5, 0.5],
      masterDelayAlg: 0,
      masterRevAlg: 0,
      masterFxMacros: [0.5, 0.5, 0.5, 0.5],
    });
    expect(result).toBeUndefined();
  });

  it('clamps masterDelayAlg > 2 to undefined', () => {
    const result = sanitizeExpandedFx({
      freqFxAlg: 0,
      freqFxMacros: [0.5, 0.5, 0.5, 0.5],
      timeFxAlg: 0,
      timeFxMacros: [0.5, 0.5, 0.5, 0.5],
      masterDelayAlg: 5,
      masterRevAlg: 0,
      masterFxMacros: [0.5, 0.5, 0.5, 0.5],
    });
    expect(result).toBeUndefined();
  });

  it('replaces NaN macro values with 0.5', () => {
    const result = sanitizeExpandedFx({
      freqFxAlg: 7,
      freqFxMacros: [0.3, Number.NaN, 0.6, Number.POSITIVE_INFINITY],
      timeFxAlg: 5,
      timeFxMacros: [0.5, 0.5, 0.5, 0.5],
      masterDelayAlg: 2,
      masterRevAlg: 1,
      masterFxMacros: [0.5, 0.5, 0.5, 0.5],
    });
    expect(result).not.toBeUndefined();
    expect(result!.freqFxMacros).toEqual([0.3, 0.5, 0.6, 0.5]);
  });

  it('uses default macro tuple when macros array has wrong length', () => {
    const result = sanitizeExpandedFx({
      freqFxAlg: 0,
      freqFxMacros: [0.5, 0.5],  // wrong length
      timeFxAlg: 0,
      timeFxMacros: [0.5, 0.5, 0.5, 0.5],
      masterDelayAlg: 0,
      masterRevAlg: 0,
      masterFxMacros: [0.5, 0.5, 0.5, 0.5],
    });
    expect(result?.freqFxMacros).toEqual([0.5, 0.5, 0.5, 0.5]);
  });
});

// ─── sanitizeExtendedState with expandedFx ───────────────────────────────────

describe('sanitizeExtendedState with expandedFx', () => {
  it('passes expandedFx through sanitizeExtendedState', () => {
    const state = sanitizeExtendedState({
      schemaVersion: '2.0.0',
      r1ModelSlug: 'fmrhodes-ai-bwe',
      expandedFx: SAMPLE_FX,
    });
    expect(state?.expandedFx).toEqual(SAMPLE_FX);
  });

  it('omits expandedFx from state when the block is invalid', () => {
    const state = sanitizeExtendedState({
      schemaVersion: '2.0.0',
      r1ModelSlug: 'pad-warm',
      expandedFx: { freqFxAlg: 999 },  // invalid
    });
    expect(state?.expandedFx).toBeUndefined();
  });
});

// ─── createExtendedStateForSave with expandedFx ──────────────────────────────

describe('createExtendedStateForSave with expandedFx', () => {
  it('persists expandedFx in the saved state', () => {
    const state = createExtendedStateForSave({
      r1ModelName: 'Test R1',
      r1ModelSlug: 'test-r1',
      expandedFx: SAMPLE_FX,
    });
    expect(state.expandedFx).toEqual(SAMPLE_FX);
  });

  it('uses defaults when expandedFx is omitted', () => {
    const state = createExtendedStateForSave({
      r1ModelName: 'Test R1',
      r1ModelSlug: 'test-r1',
    });
    expect(state.expandedFx?.freqFxAlg).toBe(0);
    expect(state.expandedFx?.freqFxMacros).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('uses defaults when expandedFx is null', () => {
    const state = createExtendedStateForSave({
      r1ModelName: 'Test R1',
      expandedFx: null,
    });
    expect(state.expandedFx?.timeFxAlg).toBe(0);
  });
});

// ─── Preset parameters [445..478] accepted in extended presets ────────────────

describe('Extended preset parameters [445..478]', () => {
  it('normalizeParameters accepts indices up to 478 for extended presets', () => {
    const preset = makeExpandedPreset();
    expect(preset.parameters[463]).toBe(SAMPLE_FX.freqFxAlg);
    expect(preset.parameters[464]).toBe(SAMPLE_FX.freqFxMacros[0]);
    expect(preset.parameters[473]).toBe(SAMPLE_FX.masterDelayAlg);
    expect(preset.parameters[478]).toBe(SAMPLE_FX.masterFxMacros[3]);
  });

  it('round-trips extended parameters through parsePresetFile', () => {
    const preset = makeExpandedPreset();
    const parsed = parsePresetFile(serializePreset(preset))!;
    expect(parsed.engineMode).toBe('extended');
    expect(parsed.parameters[463]).toBe(SAMPLE_FX.freqFxAlg);
    expect(parsed.parameters[478]).toBe(SAMPLE_FX.masterFxMacros[3]);
    expect(parsed.extendedState?.expandedFx).toEqual(SAMPLE_FX);
  });
});

// ─── applyPresetExtendedState: expandedFx → WebBridge.setParam ───────────────

describe('applyPresetExtendedState → expandedFx params', () => {
  beforeEach(() => {
    WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 1, ok: false });
    WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 2, ok: false });
  });

  it('calls setParam for all 16 FX rack indices [463..478]', () => {
    const preset = makeExpandedPreset();
    const setParamSpy = vi.spyOn(WebBridge, 'setParam');
    try {
      applyPresetExtendedState(preset);

      const calls = setParamSpy.mock.calls;
      // Must have 16 calls: freqFxAlg[463] + 4 macros + timeFxAlg[468] + 4 macros
      //                     + masterDelayAlg[473] + masterRevAlg[474] + 4 masterFxMacros
      expect(calls.length).toBe(16);

      // Check specific calls
      expect(calls.find(([idx]) => idx === 463)?.[1]).toBe(SAMPLE_FX.freqFxAlg);
      expect(calls.find(([idx]) => idx === 464)?.[1]).toBe(SAMPLE_FX.freqFxMacros[0]);
      expect(calls.find(([idx]) => idx === 467)?.[1]).toBe(SAMPLE_FX.freqFxMacros[3]);
      expect(calls.find(([idx]) => idx === 468)?.[1]).toBe(SAMPLE_FX.timeFxAlg);
      expect(calls.find(([idx]) => idx === 472)?.[1]).toBe(SAMPLE_FX.timeFxMacros[3]);
      expect(calls.find(([idx]) => idx === 473)?.[1]).toBe(SAMPLE_FX.masterDelayAlg);
      expect(calls.find(([idx]) => idx === 474)?.[1]).toBe(SAMPLE_FX.masterRevAlg);
      expect(calls.find(([idx]) => idx === 478)?.[1]).toBe(SAMPLE_FX.masterFxMacros[3]);
    } finally {
      setParamSpy.mockRestore();
      WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 1, ok: false });
      WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 2, ok: false });
    }
  });

  it('does not call setParam when expandedFx is absent in extendedState', () => {
    const preset = createAxionikPresetV2({
      params: { 0: 1 },
      r1ModelId: 12,
      r1ModelName: 'Test',
      r2ModelId: 34,
      r2ModelName: 'Test',
      engineMode: 'extended',
      meta: { name: 'No FX', category: 'Test', author: 'Test', date: '2026-01-01T00:00:00Z' },
      extendedState: {
        schemaVersion: '2.0.0',
        r1Shapers: createDefaultResynatorShapers(),
        // no expandedFx
      },
    });

    const setParamSpy = vi.spyOn(WebBridge, 'setParam');
    try {
      applyPresetExtendedState(preset);
      expect(setParamSpy).not.toHaveBeenCalled();
    } finally {
      setParamSpy.mockRestore();
    }
  });

  it('calls setParam AFTER setActiveResonatorShapers (correct ordering)', () => {
    WebBridge.notify({
      type: 'RESYNATOR_SHAPERS',
      resynator: 1,
      ok: true,
      modelName: 'fmrhodes',
      slug: 'fmrhodes-ai-bwe',
      shapers: createDefaultResynatorShapers(),
    });

    const preset = makeExpandedPreset();
    const callOrder: string[] = [];
    const setParamSpy = vi.spyOn(WebBridge, 'setParam').mockImplementation(() => { callOrder.push('setParam'); });
    const shapersSpy = vi.spyOn(WebBridge, 'setActiveResonatorShapers').mockImplementation(() => { callOrder.push('setActiveResonatorShapers'); return true; });
    const loadSpy = vi.spyOn(WebBridge, 'loadExpandedModelSlug').mockImplementation(() => {});

    try {
      applyPresetExtendedState(preset);
      // Verify shapers come before setParam calls
      const firstParam = callOrder.indexOf('setParam');
      const lastShaper = callOrder.lastIndexOf('setActiveResonatorShapers');
      expect(lastShaper).toBeLessThan(firstParam);
    } finally {
      setParamSpy.mockRestore();
      shapersSpy.mockRestore();
      loadSpy.mockRestore();
      WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 1, ok: false });
    }
  });
});

// ─── Factory preset JSON validation ──────────────────────────────────────────

describe('Factory EXPANDED preset JSON files', () => {
  const factoryPresets = [
    {
      name: '01_Vocoder_Cyborg',
      freqFxAlg: 5,
      timeFxAlg: 0,
      masterDelayAlg: 0,
      masterRevAlg: 1,
    },
    {
      name: '02_Resonator_GlassChimes',
      freqFxAlg: 6,
      timeFxAlg: 0,
      masterDelayAlg: 1,
      masterRevAlg: 1,
    },
    {
      name: '03_Mood_AcidMoog',
      freqFxAlg: 7,
      timeFxAlg: 6,
      masterDelayAlg: 0,
      masterRevAlg: 0,
    },
    {
      name: '04_Solina_StringEnsemble',
      freqFxAlg: 0,
      timeFxAlg: 5,
      masterDelayAlg: 0,
      masterRevAlg: 1,
    },
    {
      name: '05_Rotary_LeslieOrgan',
      freqFxAlg: 0,
      timeFxAlg: 6,
      masterDelayAlg: 1,
      masterRevAlg: 0,
    },
    {
      name: '06_Nimbus_CloudShimmer',
      freqFxAlg: 5,
      timeFxAlg: 7,
      masterDelayAlg: 1,
      masterRevAlg: 1,
    },
    {
      name: '07_SpaceTape_MultiHead',
      freqFxAlg: 6,
      timeFxAlg: 5,
      masterDelayAlg: 2,
      masterRevAlg: 1,
    },
    {
      name: '08_Zita_CathedralReverb',
      freqFxAlg: 0,
      timeFxAlg: 7,
      masterDelayAlg: 0,
      masterRevAlg: 1,
    },
  ];

  for (const p of factoryPresets) {
    it(`${p.name}: valid schema, engineMode=extended, correct FX algorithms`, async () => {
      // Load factory preset JSON from disk
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const json = readFileSync(
        resolve(__dirname, `../../AxionikDB/Presets/Expanded_v2/${p.name}.axpreset`),
        'utf-8',
      );
      const preset = parsePresetFile(json);

      expect(preset).not.toBeNull();
      expect(preset!.formatVersion).toBe(2);
      expect(preset!.engineMode).toBe('extended');
      expect(preset!.extendedState).toBeDefined();
      expect(preset!.extendedState!.expandedFx).toBeDefined();
      expect(preset!.extendedState!.expandedFx!.freqFxAlg).toBe(p.freqFxAlg);
      expect(preset!.extendedState!.expandedFx!.timeFxAlg).toBe(p.timeFxAlg);
      expect(preset!.extendedState!.expandedFx!.masterDelayAlg).toBe(p.masterDelayAlg);
      expect(preset!.extendedState!.expandedFx!.masterRevAlg).toBe(p.masterRevAlg);

      // parameters [463..478] must be present and finite
      for (let idx = 463; idx <= 478; idx++) {
        expect(Number.isFinite(preset!.parameters[idx])).toBe(true);
      }
    });
  }
});
