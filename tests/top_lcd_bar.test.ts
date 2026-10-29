import { describe, it, expect } from 'vitest';
import {
  formatGraphEditorValue,
  computeMiniAdsrPoints,
} from '../WebUI/src/ui/TopLcdBar.js';
import { WebBridge } from '../WebUI/src/bridge/WebBridge.js';

describe('TopLcdBar Hardware Display Verification (PAINT_PIPELINE §18 & §19)', () => {
  it('seeds 7 distinct non-fake ADSR profiles across all 7 C_DisplayButton generators', () => {
    WebBridge.clearCache();
    const bases = [200, 182, 205, 230, 212, 235, 355];
    const initialCurves = bases.map((b) =>
      computeMiniAdsrPoints(
        WebBridge.getParam(b, 0) / 127,
        WebBridge.getParam(b + 1, 0) / 127,
        WebBridge.getParam(b + 2, 0) / 127,
        WebBridge.getParam(b + 3, 0) / 127
      )
    );
    expect(new Set(initialCurves).size).toBe(7);

    WebBridge.seedPresetSlotEnvelopes(8);
    const slot8Curves = bases.map((b) =>
      computeMiniAdsrPoints(
        WebBridge.getParam(b, 0) / 127,
        WebBridge.getParam(b + 1, 0) / 127,
        WebBridge.getParam(b + 2, 0) / 127,
        WebBridge.getParam(b + 3, 0) / 127
      )
    );
    expect(new Set(slot8Curves).size).toBe(7);
    expect(slot8Curves).not.toEqual(initialCurves);
  });
  it('formats C_GraphEditor unipolar parameters with "%03i" (FUN_10015910)', () => {
    expect(formatGraphEditorValue(0, 0, 511)).toBe('000');
    expect(formatGraphEditorValue(7, 0, 511)).toBe('007');
    expect(formatGraphEditorValue(127, 0, 511)).toBe('127');
    expect(formatGraphEditorValue(50, 0, 100)).toBe('050');
    expect(formatGraphEditorValue(100, 0, 100)).toBe('100');
  });

  it('formats C_GraphEditor bipolar parameters with "%+02.2i" (FUN_10015910)', () => {
    expect(formatGraphEditorValue(0, -64, 63)).toBe('+00');
    expect(formatGraphEditorValue(5, -64, 63)).toBe('+05');
    expect(formatGraphEditorValue(-7, -64, 63)).toBe('-07');
    expect(formatGraphEditorValue(-64, -64, 63)).toBe('-64');
  });

  it('formats C_GraphEditor choice parameters with index and label', () => {
    const curves = ['24dB LP', '12dB LP', '6dB LP'];
    expect(formatGraphEditorValue(0, 0, 2, curves)).toBe('00:24dB LP');
    expect(formatGraphEditorValue(2, 0, 2, curves)).toBe('02:6dB LP');
  });

  it('computes the exact 5-vertex 66x22 ADSR polyline from FUN_10018220 (C_DisplayButton)', () => {
    // At A=0, D=0, S=1 (18px), R=0:
    // P0 = (1, 21)
    // P1 = (1 + 0, 1) = (1, 1)
    // P2 = (2 + 0 + 0, 20 - 18) = (2, 2)
    // P3 = (13 + 0 + 0, 20 - 18) = (13, 2)
    // P4 = (14 + 0 + 0 + 0, 21) = (14, 21)
    expect(computeMiniAdsrPoints(0, 0, 1, 0)).toBe('1,21 1,1 2,2 13,2 14,21');

    // At A=1 (15px), D=1 (15px), S=0.5 (9px), R=1 (15px):
    // P0 = (1, 21)
    // P1 = (1 + 15, 1) = (16, 1)
    // P2 = (2 + 15 + 15, 20 - 9) = (32, 11)
    // P3 = (13 + 15 + 15, 20 - 9) = (43, 11)
    // P4 = (14 + 15 + 15 + 15, 21) = (59, 21)
    expect(computeMiniAdsrPoints(1, 1, 0.5, 1)).toBe('1,21 16,1 32,11 43,11 59,21');
  });
});
