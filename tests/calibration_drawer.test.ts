// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CALIBRATION_CATEGORIES,
  CALIBRATION_REGISTRY,
  CalibrationStore,
  calibrationStore,
} from '../WebUI/src/ui/calibrationContracts';
import { CalibrationDrawer } from '../WebUI/src/ui/CalibrationDrawer';

describe('DSP Calibration & Magic Numbers System (AxionikCalibrationConfig)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    calibrationStore.resetAll();
  });

  it('registers all 43 DSP magic numbers across 6 categories with valid bounds and explanations', () => {
    expect(CALIBRATION_REGISTRY.length).toBe(43);
    expect(CALIBRATION_CATEGORIES.length).toBe(6);

    const seenIds = new Set<string>();
    for (const desc of CALIBRATION_REGISTRY) {
      expect(seenIds.has(desc.id)).toBe(false);
      seenIds.add(desc.id);

      expect(desc.label.length).toBeGreaterThan(3);
      expect(desc.description.length).toBeGreaterThan(15);
      expect(desc.sourceRef.length).toBeGreaterThan(3);
      expect(desc.unit.length).toBeGreaterThan(0);
      expect(CALIBRATION_CATEGORIES).toContain(desc.category);

      expect(desc.minValue).toBeLessThan(desc.maxValue);
      expect(desc.defaultValue).toBeGreaterThanOrEqual(desc.minValue);
      expect(desc.defaultValue).toBeLessThanOrEqual(desc.maxValue);
      expect(desc.stepSize).toBeGreaterThan(0);
    }
  });

  it('modifies, clamps, and resets individual parameters, categories, and all parameters', () => {
    const store = new CalibrationStore();
    expect(store.getModifiedCount()).toBe(0);

    // Modify masterVolume within range
    store.setValue('masterVolume', 1.25);
    expect(store.getValue('masterVolume')).toBeCloseTo(1.25, 3);
    expect(store.isModified('masterVolume')).toBe(true);
    expect(store.getModifiedCount()).toBe(1);

    // Clamp above max and below min
    store.setValue('masterVolume', 99.0);
    expect(store.getValue('masterVolume')).toBeCloseTo(2.0, 3);
    store.setValue('masterVolume', -5.0);
    expect(store.getValue('masterVolume')).toBeCloseTo(0.1, 3);

    // Integer snapping for maxPolyphonyVoices
    store.setValue('maxPolyphonyVoices', 8.6);
    expect(store.getValue('maxPolyphonyVoices')).toBe(9);

    // Individual reset
    store.resetParam('masterVolume');
    expect(store.isModified('masterVolume')).toBe(false);
    expect(store.getValue('masterVolume')).toBeCloseTo(0.85, 3);

    // Category reset
    store.setValue('filterMinCutoffHz', 45.0);
    store.setValue('filterMaxResonance', 0.8);
    expect(store.getCategoryModifiedCount('SILVER FILTER')).toBe(2);
    store.resetCategory('SILVER FILTER');
    expect(store.getCategoryModifiedCount('SILVER FILTER')).toBe(0);

    // Reset all
    store.setValue('ringBlendGain', 3.5);
    expect(store.getModifiedCount()).toBeGreaterThan(0);
    store.resetAll();
    expect(store.getModifiedCount()).toBe(0);
  });

  it('exports and imports JSON configurations accurately with validation', () => {
    const store = new CalibrationStore();
    store.setValue('scapeMinPeakFloor', 2400);
    store.setValue('envDecayExpRate', 4.2);
    store.setValue('masterBassTiltGain', 6.5);

    const exportedJson = store.exportToJson();
    expect(exportedJson).toContain('"schema": "abd.axionik.calibration.v1"');
    expect(exportedJson).toContain('"scapeMinPeakFloor": 2400');

    // Reset and re-import
    store.resetAll();
    expect(store.getValue('scapeMinPeakFloor')).toBe(1500);

    const result = store.importFromJson(exportedJson);
    expect(result.applied).toBe(43);
    expect(result.errors.length).toBe(0);
    expect(store.getValue('scapeMinPeakFloor')).toBe(2400);
    expect(store.getValue('envDecayExpRate')).toBeCloseTo(4.2, 2);
    expect(store.getValue('masterBassTiltGain')).toBeCloseTo(6.5, 2);
  });

  it('renders CalibrationDrawer UI, updates sliders, filters by category/search, and resets', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const app = document.getElementById('app')!;
    const drawer = new CalibrationDrawer(app);

    drawer.open();
    expect(drawer.isOpen()).toBe(true);

    const cards = app.querySelectorAll('[data-param-card]');
    expect(cards.length).toBe(43);

    // Change slider value in DOM
    const slider = app.querySelector('[data-param-slider="scapeHfEmphasis"]') as HTMLInputElement;
    expect(slider).not.toBeNull();
    slider.value = '3.25';
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    expect(calibrationStore.getValue('scapeHfEmphasis')).toBeCloseTo(3.25, 2);
    const card = app.querySelector('[data-param-card="scapeHfEmphasis"]') as HTMLElement;
    expect(card.classList.contains('is-modified')).toBe(true);

    // Click individual reset button
    const resetBtn = app.querySelector('[data-reset-param="scapeHfEmphasis"]') as HTMLButtonElement;
    resetBtn.click();
    expect(calibrationStore.getValue('scapeHfEmphasis')).toBeCloseTo(2.0, 2);
    expect(card.classList.contains('is-modified')).toBe(false);

    // Filter by category tab
    const filterTab = app.querySelector('[data-cat="SILVER FILTER"]') as HTMLButtonElement;
    filterTab.click();
    const visibleCardsAfterTab = app.querySelectorAll('[data-param-card]');
    expect(visibleCardsAfterTab.length).toBe(6);

    drawer.close();
    expect(drawer.isOpen()).toBe(false);
    drawer.destroy();
  });
});

