import { describe, it, expect } from 'vitest';
import { PARAM_DEFINITIONS, PARAM_BY_KEY, VST_EXPOSED_INDICES, MOD_DEST_INDICES, PARAMETER_SETS } from '../WebUI/src/generated/parameters.gen.js';

describe('ABDAxionikVS Parameter Registry & Contracts', () => {
  it('debe tener exactamente 445 parámetros en el registro autoritativo', () => {
    expect(PARAM_DEFINITIONS.length).toBe(445);
  });

  it('debe exponer exactamente 26 parámetros al host VST', () => {
    expect(VST_EXPOSED_INDICES.length).toBe(26);
    expect(PARAM_BY_KEY['FilterFreq']).toBeDefined();
    expect(PARAM_BY_KEY['FilterFreq'].vstIndex).toBe(24);
    expect(PARAM_BY_KEY['FilterReso'].vstIndex).toBe(25);
  });

  it('debe tener exactamente 63 destinos de modulación válidos (0..62)', () => {
    expect(MOD_DEST_INDICES.length).toBe(63);
    const modDests = PARAM_DEFINITIONS.filter(p => p.isModDest);
    expect(modDests.length).toBe(63);
    const indices = modDests.map(m => m.modDestIdx).sort((a, b) => a - b);
    expect(indices[0]).toBe(0);
    expect(indices[62]).toBe(62);
  });

  it('debe aplicar la regla FUN_10001170 con default = 1.0 para los 19 parámetros que tienen min = 1', () => {
    const r1StickPlay = PARAM_BY_KEY['R1L1ScapeStickPlayback'];
    expect(r1StickPlay).toBeDefined();
    expect(r1StickPlay.min).toBe(1);
    expect(r1StickPlay.default).toBe(1.0);
  });

  it('debe contener los 10 Parameter Sets Scape y Sphere', () => {
    expect(Object.keys(PARAMETER_SETS.scape).length).toBe(10);
    expect(Object.keys(PARAMETER_SETS.sphere).length).toBe(10);
  });
});
