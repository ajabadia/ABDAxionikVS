import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Dependencias pesadas/bridge: se sustituyen para poder instanciar el
//    protocolo de selectFreqAlgo/selectTimeAlgo sin DOM ni host nativo.
vi.mock('../WebUI/src/bridge/WebBridge.js', () => ({
  WebBridge: {
    setParam: vi.fn(),
    getParam: vi.fn((_id: number, fallback?: number) => fallback ?? 0),
  },
}));
vi.mock('../WebUI/src/ui/TrajectoryStick2D.js', () => ({
  TrajectoryStick2D: class {},
}));
vi.mock('@abdsynths/shared/components', () => ({
  Knob: class {},
}));

import { SilverPanel, FREQ_ALGO_NAMES, TIME_ALGO_NAMES } from '../WebUI/src/ui/SilverPanel.js';
import { WebBridge } from '../WebUI/src/bridge/WebBridge.js';
import { ParamIdx } from '../WebUI/src/constants/paramIndices.js';

/**
 * Guardia anti-fork de la unificación de cyclers:
 * los cyclers/controles de FX deben delegar SIEMPRE en
 * SilverPanel.selectFreqAlgo / selectTimeAlgo, el único camino canónico
 * que fija el algoritmo, enciende Silver+FX y refresca la UI.
 * Ningún módulo externo debe redeclarar esa lógica con setParam suelto,
 * y los wrappers por nombre (updateFreqAlgo/updateTimeAlgo) no deben volver.
 */

const makePanel = (): SilverPanel => {
  const p = Object.create(SilverPanel.prototype) as SilverPanel;
  // Campos internos que el constructor real poblaría; aquí se evita el DOM.
  (p as unknown as Record<string, unknown>).rootEl = null;
  (p as unknown as Record<string, unknown>).silverStick = null;
  (p as unknown as Record<string, unknown>).currentSilverLevel = 0;
  (p as unknown as Record<string, unknown>).updateSilverToggle = vi.fn();
  (p as unknown as Record<string, unknown>).updateFreqAlgoUi = vi.fn();
  (p as unknown as Record<string, unknown>).updateTimeAlgoUi = vi.fn();
  (p as unknown as Record<string, unknown>).updateSilver = vi.fn();
  return p;
};

const setParamMock = WebBridge.setParam as ReturnType<typeof vi.fn>;
const spy = (p: SilverPanel, name: string) =>
  (p as unknown as Record<string, ReturnType<typeof vi.fn>>)[name];

describe('Delegación canónica de cyclers → selectFreqAlgo / selectTimeAlgo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('selectFreqAlgo (FX de frecuencia)', () => {
    it('fija CurFreqFX, enciende Silver + FreqFX y refresca la UI', () => {
      const p = makePanel();
      p.selectFreqAlgo(3);

      expect(setParamMock).toHaveBeenCalledWith(ParamIdx.SilverSwitch, 1);
      expect(setParamMock).toHaveBeenCalledWith(ParamIdx.FreqFXSwitch, 1);
      expect(setParamMock).toHaveBeenCalledWith(ParamIdx.CurFreqFX, 3);
      expect(spy(p, 'updateSilverToggle')).toHaveBeenCalledWith(true);
      expect(spy(p, 'updateFreqAlgoUi')).toHaveBeenCalledWith(3);
      expect(spy(p, 'updateSilver')).toHaveBeenCalled();
    });

    it('clampa el índice al rango de FREQ_ALGO_NAMES', () => {
      const p = makePanel();
      p.selectFreqAlgo(99);
      expect(setParamMock).toHaveBeenCalledWith(
        ParamIdx.CurFreqFX,
        FREQ_ALGO_NAMES.length - 1,
      );
      p.selectFreqAlgo(-5);
      expect(setParamMock).toHaveBeenCalledWith(ParamIdx.CurFreqFX, 0);
    });
  });

  describe('selectTimeAlgo (FX de tiempo)', () => {
    it('fija CurTimeFX, enciende Silver + TimeFX y refresca la UI', () => {
      const p = makePanel();
      p.selectTimeAlgo(4);

      expect(setParamMock).toHaveBeenCalledWith(ParamIdx.SilverSwitch, 1);
      expect(setParamMock).toHaveBeenCalledWith(ParamIdx.TimeFXSwitch, 1);
      expect(setParamMock).toHaveBeenCalledWith(ParamIdx.CurTimeFX, 4);
      expect(spy(p, 'updateSilverToggle')).toHaveBeenCalledWith(true);
      expect(spy(p, 'updateTimeAlgoUi')).toHaveBeenCalledWith(4);
      expect(spy(p, 'updateSilver')).toHaveBeenCalled();
    });

    it('clampa el índice al rango de TIME_ALGO_NAMES', () => {
      const p = makePanel();
      p.selectTimeAlgo(99);
      expect(setParamMock).toHaveBeenCalledWith(
        ParamIdx.CurTimeFX,
        TIME_ALGO_NAMES.length - 1,
      );
      p.selectTimeAlgo(-1);
      expect(setParamMock).toHaveBeenCalledWith(ParamIdx.CurTimeFX, 0);
    });
  });

  describe('anti-fork', () => {
    it('los wrappers por nombre updateFreqAlgo(name)/updateTimeAlgo(name) siguen eliminados', () => {
      const proto = SilverPanel.prototype as unknown as Record<string, unknown>;
      expect(proto.updateFreqAlgo).toBeUndefined();
      expect(proto.updateTimeAlgo).toBeUndefined();
    });

    it('main.ts nunca setea CurFreqFX/CurTimeFX a mano ni llama wrappers: delega siempre', () => {
      const mainSrc = fs.readFileSync(
        path.join(__dirname, '../WebUI/src/main.ts'),
        'utf-8',
      );
      // Si alguien reintroduce un cycler con setParam propio, este test falla
      // y obliga a delegar en selectFreqAlgo/selectTimeAlgo.
      expect(mainSrc).not.toMatch(/setParam\(\s*ParamIdx\.CurFreqFX/);
      expect(mainSrc).not.toMatch(/setParam\(\s*ParamIdx\.CurTimeFX/);
      expect(mainSrc).not.toMatch(/\.updateFreqAlgo\(/);
      expect(mainSrc).not.toMatch(/\.updateTimeAlgo\(/);
    });
  });
});
