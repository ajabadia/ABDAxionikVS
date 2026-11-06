import { describe, expect, it } from 'vitest';
import {
  createAxionikPresetV2,
  parsePresetFile,
  serializePreset,
  sanitizeFilename,
  type AxionikPreset,
} from '../src/ui/PresetModel.js';

function makePreset(overrides: Partial<AxionikPreset> = {}): AxionikPreset {
  return createAxionikPresetV2({
    params: { 0: 1, 10: 2.5, 444: -1 },
    r1ModelId: 12,
    r1ModelName: 'R1 test',
    r2ModelId: 34,
    r2ModelName: 'R2 test',
    engineMode: 'legacy',
    meta: {
      name: 'Test Preset',
      category: 'User',
      author: 'Test User',
      date: '2026-01-01T00:00:00Z',
      comment: 'test',
    },
    ...overrides,
  });
}

describe('preset serialization', () => {
  it('creates a valid AxionikPreset v2 and serializes it', () => {
    const preset = makePreset();
    expect(preset).toBeDefined();
    expect(preset.formatVersion).toBe(2);
    expect(preset.meta.name).toBe('Test Preset');
    expect(preset.models.resynator1.name).toBe('R1 test');
    expect(preset.parameters[0]).toBe(1);
    expect(preset.parameters[444]).toBe(-1);

    const json = serializePreset(preset);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed).toMatchObject({
      formatVersion: 2,
      meta: { name: 'Test Preset' },
      models: { resynator1: { id: 12, name: 'R1 test' } },
    });
  });

  it('normalizes legacy JSON with an array of parameters into v2', () => {
    const parameterArray = new Array(445).fill(0).map((_, i) => (i % 10) / 10);
    const legacy = {
      name: 'Legacy Preset',
      category: 'Legacy',
      parameters: parameterArray,
    };

    const parsed = parsePresetFile(JSON.stringify(legacy));
    expect(parsed).not.toBeNull();
    expect(parsed!.formatVersion).toBe(2);
    expect(parsed!.meta.name).toBe('Legacy Preset');
    // The legacy JSON had 'Legacy' as category, so preserve it.
    expect(parsed!.meta.category).toBe('Legacy');
    // Legacy dump without engineMode defaults to 'legacy'.
    expect(parsed!.engineMode).toBe('legacy');
    expect(parsed!.parameters[0]).toBe(0);
    expect(parsed!.parameters[10]).toBe(0);
    expect(parsed!.parameters[444]).toBe(0.4);
  });

  it('normalizes a v2 canonical object without reformating numeric values', () => {
    const original = makePreset();
    const json = serializePreset(original);
    const parsed = parsePresetFile(json)!;
    expect(parsed.parameters).toEqual(original.parameters);
    expect(parsed.engineMode).toBe('legacy');
    expect(parsed.meta.date).toBeDefined();
  });
});

describe('filename sanitization', () => {
  it('sanitizes filenames to safe names', () => {
    const safe = sanitizeFilename('my..file');
    expect(typeof safe).toBe('string');
    expect(safe.length).toBeGreaterThan(0);
  });

  it('sanitizes whitespace', () => {
    expect(sanitizeFilename('  spaced  ')).toBe('spaced');
  });

  it('returns default name for empty input', () => {
    expect(sanitizeFilename('')).toBe('Preset');
  });
});
