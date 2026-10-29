import { describe, it, expect } from 'vitest';
import { resolveParamIndexFromModDest } from '../WebUI/src/ui/NukeDrawer.js';
import { ALL_63_MOD_DESTINATIONS, MOD_SOURCES } from '../WebUI/src/ui/MatrixDrawer.js';
import { PARAM_DEFINITIONS } from '../WebUI/src/generated/parameters.gen.js';
import { ParamIdx } from '../WebUI/src/constants/paramIndices.js';

describe('<NUKE> Remote Control Unit Parameter Abstraction & Mappings', () => {
  it('resolves all 63 modulation destinations (0..62) to valid snddat parameter indices [0..444]', () => {
    expect(ALL_63_MOD_DESTINATIONS.length).toBe(63);
    for (let destId = 0; destId < 63; destId++) {
      const paramIdx = resolveParamIndexFromModDest(destId);
      expect(paramIdx).toBeGreaterThanOrEqual(0);
      expect(paramIdx).toBeLessThan(PARAM_DEFINITIONS.length);
      expect(PARAM_DEFINITIONS[paramIdx]).toBeDefined();
    }
  });

  it('resolves the 4 canonical <NUKE> Macro Knob default destinations accurately', () => {
    // Knob 1 Select [425] -> 61: Filter Cutoff [274]
    expect(resolveParamIndexFromModDest(61)).toBe(ParamIdx.FilterFreq);
    // Knob 2 Select [426] -> 56: Blender Mix/Amount [262]
    expect(resolveParamIndexFromModDest(56)).toBe(ParamIdx.BlenderAmount);
    // Knob 3 Select [427] -> 32: R1 AmpEnv Attack (Shaper A1 Attack) [200]
    expect(resolveParamIndexFromModDest(32)).toBe(200);
    // Knob 4 Select [428] -> 62: Filter Resonance [275]
    expect(resolveParamIndexFromModDest(62)).toBe(ParamIdx.FilterReso);
  });

  it('maps the 6 Performance Controllers to authoritative snddat pairs [413..424]', () => {
    expect(MOD_SOURCES.length).toBe(6);
    expect(MOD_SOURCES[0].destParam).toBe(ParamIdx.AftertouchSelect);
    expect(MOD_SOURCES[0].depthParam).toBe(ParamIdx.AftertouchScale);
    expect(MOD_SOURCES[5].destParam).toBe(ParamIdx.ExpressionSelect);
    expect(MOD_SOURCES[5].depthParam).toBe(ParamIdx.ExpressionScale);
  });
});

