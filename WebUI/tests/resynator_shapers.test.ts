// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { WebBridge } from '../src/bridge/WebBridge.js';
import {
  RESYNATOR_SHAPER_CONTROLS,
  shaperNormalizedToValue,
  shaperValueToNormalized,
} from '../src/ui/resynatorShapersModel.js';
import { createDefaultResynatorShapers } from '../src/ui/PresetModel.js';
import { ResynatorShapersPanel } from '../src/ui/ResynatorShapersPanel.js';
import { ResynatorDrawer } from '../src/ui/ResynatorDrawer.js';
import {
  findExpandedModelCatalogEntry,
  normalizeParameterSet,
  resolveResynatorModelIdentity,
} from '../src/ui/ResynatorModelIdentity.js';
import { DrawerManager } from '../src/ui/Drawers.js';
import {
  deriveAxionikParameterSet,
  PARAM_SET_NAMES,
  PARAMETER_SETS,
  resolveAxionikParameterSet,
} from '../src/ui/AxionikParameterSet.js';

describe('Axionik expanded model Parameter Set fallback', () => {
  it('derives the seven AxionikDB folders from their category', () => {
    expect(deriveAxionikParameterSet('Transformed_HD_96k/01_Keyboards_Piano')).toBe(5);
    expect(deriveAxionikParameterSet('Transformed_HD_96k/02_Chromatic_Bells')).toBe(2);
    expect(deriveAxionikParameterSet('Transformed_HD_96k/03_Pads_Atmospheres')).toBe(7);
    expect(deriveAxionikParameterSet('Transformed_HD_96k/04_Bass_LowEnd')).toBe(3);
    expect(deriveAxionikParameterSet('Transformed_HD_96k/05_Leads_Winds')).toBe(6);
    expect(deriveAxionikParameterSet('Transformed_HD_96k/06_Percussion_Hits')).toBe(8);
    expect(deriveAxionikParameterSet('Transformed_HD_96k/07_Experimental_Resonators')).toBe(9);
  });

  it('prefers an explicit meta.parameterSet and ignores invalid sentinels', () => {
    const category = 'Transformed_AI_BWE_96k/01_Keyboards_Piano';
    expect(resolveAxionikParameterSet(category, 0)).toBe(0);
    expect(resolveAxionikParameterSet(category, 9)).toBe(9);
    expect(resolveAxionikParameterSet(category, -1)).toBe(5);
    expect(resolveAxionikParameterSet(category, 12)).toBe(5);
    expect(resolveAxionikParameterSet(category, 2.5)).toBe(5);
  });

  it('derives the public set labels from the canonical definition table', () => {
    expect(PARAMETER_SETS.map((set) => set.id)).toEqual([...Array(10).keys()]);
    expect(PARAM_SET_NAMES).toEqual(PARAMETER_SETS.map((set) => set.name));
  });

  it('understands human category names and falls back to Default Set', () => {
    expect(deriveAxionikParameterSet('Pads & Atmospheres')).toBe(7);
    expect(deriveAxionikParameterSet('Mallets & Chromatic Perc')).toBe(2);
    expect(deriveAxionikParameterSet('Synth & Neutral')).toBe(0);
    expect(deriveAxionikParameterSet('Unknown category')).toBe(0);
    expect(deriveAxionikParameterSet('')).toBe(0);
  });
});

describe('Resynator v2 shaper editor mapping', () => {
  it('exposes exactly the 9 canonical shapers', () => {
    expect(RESYNATOR_SHAPER_CONTROLS).toHaveLength(9);
    expect(new Set(RESYNATOR_SHAPER_CONTROLS.map((control) => control.key)).size).toBe(9);
  });

  it('maps normalized knob positions onto the DSP ranges', () => {
    const parity = RESYNATOR_SHAPER_CONTROLS.find((control) => control.key === 'parity')!;
    expect(shaperNormalizedToValue(parity, 0)).toBe(-1);
    expect(shaperNormalizedToValue(parity, 0.5)).toBe(0);
    expect(shaperNormalizedToValue(parity, 1)).toBe(1);
    expect(shaperValueToNormalized(parity, 0)).toBe(0.5);

    const rollOff = RESYNATOR_SHAPER_CONTROLS.find(
      (control) => control.key === 'hfRollOffDbPerOct',
    )!;
    expect(shaperNormalizedToValue(rollOff, 0)).toBe(-24);
    expect(shaperNormalizedToValue(rollOff, 1)).toBe(0);
    expect(shaperValueToNormalized(rollOff, -24)).toBe(0);
  });
});

describe('ResynatorShapersPanel', () => {
  it('mounts the nine shaper knobs when the host reports an active model', () => {
    WebBridge.notify({
      type: 'RESYNATOR_SHAPERS',
      resynator: 1,
      ok: true,
      shapers: createDefaultResynatorShapers(),
    });
    const container = document.createElement('div');
    document.body.appendChild(container);

    const panel = new ResynatorShapersPanel(container, 1);
    expect(container.querySelectorAll('[data-shaper-mount] .abd-knob')).toHaveLength(9);
    expect(container.querySelector('[data-shaper-value="parity"]')?.textContent).toBe('0.00');

    panel.destroy();
    container.remove();
  });

  it('reflects host model and preset loads while the drawer stays open', () => {
    WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 1, ok: false });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const panel = new ResynatorShapersPanel(container, 1);

    expect(container.querySelectorAll('.abd-knob')).toHaveLength(0);

    WebBridge.notify({
      type: 'RESYNATOR_SHAPERS',
      resynator: 1,
      ok: true,
      shapers: {
        ...createDefaultResynatorShapers(),
        inharmonicityB: 0.25,
        parity: -0.5,
      },
    });

    expect(container.querySelectorAll('[data-shaper-mount] .abd-knob')).toHaveLength(9);
    expect(container.querySelector('[data-shaper-value="inharmonicityB"]')?.textContent).toBe(
      '0.250',
    );
    expect(container.querySelector('[data-shaper-value="parity"]')?.textContent).toBe('-0.50');
    expect(
      container
        .querySelector('[data-shaper-mount="parity"] .abd-knob__dial')
        ?.getAttribute('aria-valuenow'),
    ).toBe('0.25');

    WebBridge.notify({
      type: 'RESYNATOR_SHAPERS',
      resynator: 1,
      ok: true,
      shapers: {
        ...createDefaultResynatorShapers(),
        parity: 0.75,
        residualMix: 0.6,
      },
    });

    expect(container.querySelector('[data-shaper-value="parity"]')?.textContent).toBe('+0.75');
    expect(container.querySelector('[data-shaper-value="residualMix"]')?.textContent).toBe('60%');
    expect(
      container
        .querySelector('[data-shaper-mount="parity"] .abd-knob__dial')
        ?.getAttribute('aria-valuenow'),
    ).toBe('0.875');

    WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 1, ok: false });
    expect(container.querySelectorAll('.abd-knob')).toHaveLength(0);
    expect(container.textContent).toContain('NO MODEL');

    panel.destroy();
    container.remove();
  });

  it('renders the current values read-only when no expanded model is active', () => {
    WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 2, ok: false });
    const container = document.createElement('div');
    document.body.appendChild(container);

    const panel = new ResynatorShapersPanel(container, 2);
    expect(container.querySelectorAll('.abd-knob')).toHaveLength(0);
    expect(container.textContent).toContain('NO MODEL');

    panel.destroy();
    container.remove();
  });
});

describe('Resynator drawer model identity sync', () => {
  it('updates the open drawer model name and Parameter Set without reopening it', () => {
    const content = ResynatorDrawer.createContent({
      resynator: 1,
      modelName: 'Old Model',
      parameterSet: 3,
      onClose: () => {},
    });
    document.body.appendChild(content);

    expect(content.querySelector('#R1-resy-model-name')?.textContent).toBe('Old Model');
    expect(content.querySelector('#R1-parset-caption')?.textContent).toContain('(3:');

    ResynatorDrawer.syncModelInfo(1, 'Host Preset Model', 7);

    expect(content.querySelector('#R1-resy-model-name')?.textContent).toBe('Host Preset Model');
    expect(content.querySelector('#R1-parset-caption')?.textContent).toContain('(7:');
    const activePills = content.querySelectorAll('#R1-parset-pills .abd-pill.active');
    expect(activePills).toHaveLength(1);
    expect(activePills[0]?.textContent).toContain('7:');

    ResynatorDrawer.destroyContent(content);
    ResynatorDrawer.syncModelInfo(1, 'Ignored After Close', 2);
    expect(content.querySelector('#R1-resy-model-name')?.textContent).toBe('Host Preset Model');

    content.remove();
  });
});

describe('Resynator drawer close lifecycle', () => {
  it('stops the shaper panel from reacting after the drawer closes', () => {
    WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 1, ok: false });

    const originalOnMessage = WebBridge.onMessage.bind(WebBridge);
    const unsubscribers: Array<ReturnType<typeof vi.fn>> = [];
    const onMessageSpy = vi.spyOn(WebBridge, 'onMessage').mockImplementation((handler) => {
      const unsubscribe = originalOnMessage(handler);
      const wrapped = vi.fn(unsubscribe);
      unsubscribers.push(wrapped);
      return wrapped;
    });

    let parent: HTMLElement | null = null;
    try {
      parent = document.createElement('div');
      document.body.appendChild(parent);
      const manager = new DrawerManager(parent);
      const content = ResynatorDrawer.createContent({
        resynator: 1,
        modelName: 'Before Load',
        parameterSet: 2,
        onClose: () => manager.close(),
      });
      manager.openCustom('r1-expanded', content, () => ResynatorDrawer.destroyContent(content));

      const panelUnsubscribe = unsubscribers[unsubscribers.length - 1];
      if (!panelUnsubscribe) throw new Error('ResynatorShapersPanel did not subscribe');

      WebBridge.notify({
        type: 'RESYNATOR_SHAPERS',
        resynator: 1,
        ok: true,
        modelName: 'Loaded Model',
        slug: 'loaded-model',
        shapers: createDefaultResynatorShapers(),
      });
      expect(content.querySelectorAll('[data-shaper-mount] .abd-knob')).toHaveLength(9);

      content.querySelector<HTMLButtonElement>('#btn-close-resy-drawer')?.click();
      expect(manager.isOpen()).toBe(false);
      expect(panelUnsubscribe).toHaveBeenCalledTimes(1);
      expect(content.querySelector('.resynator-shapers-panel')).toBeNull();

      WebBridge.notify({
        type: 'RESYNATOR_SHAPERS',
        resynator: 1,
        ok: true,
        modelName: 'After Close',
        slug: 'after-close',
        shapers: { ...createDefaultResynatorShapers(), parity: -0.8 },
      });
      expect(WebBridge.getActiveResonatorShapers(1)?.parity).toBe(-0.8);
      expect(content.querySelector('.resynator-shapers-panel')).toBeNull();
      expect(content.querySelectorAll('[data-shaper-mount] .abd-knob')).toHaveLength(0);
    } finally {
      onMessageSpy.mockRestore();
      parent?.remove();
      WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 1, ok: false });
    }
  });
});

describe('Resynator model identity resolution', () => {
  it('prefers the bank catalog over the static metadata when a preset loads', () => {
    const identity = resolveResynatorModelIdentity({
      slot: 42,
      catalog: [{ slot: 42, name: 'User Preset Model', parameterSet: 7 }],
    });

    expect(identity).toEqual({ name: 'User Preset Model', parameterSet: 7 });
  });

  it('keeps an explicit host name and Parameter Set over catalog and metadata', () => {
    const identity = resolveResynatorModelIdentity({
      slot: 511,
      name: '[EXP] Host Preset',
      parameterSet: 4,
      catalog: [{ slot: 511, name: 'sinew', parameterSet: 0 }],
    });

    expect(identity).toEqual({ name: '[EXP] Host Preset', parameterSet: 4 });
  });

  it('falls back to canonical metadata and marks unknown Parameter Sets', () => {
    expect(resolveResynatorModelIdentity({ slot: 511 })).toEqual({
      name: 'sinew',
      parameterSet: 0,
    });
    expect(resolveResynatorModelIdentity({ slot: 900 })).toEqual({
      name: 'Model #900',
      parameterSet: -1,
    });
  });

  it('normalizes out-of-range Parameter Sets to -1', () => {
    expect(normalizeParameterSet(9)).toBe(9);
    expect(normalizeParameterSet(-1)).toBe(-1);
    expect(normalizeParameterSet(10)).toBe(-1);
    expect(normalizeParameterSet(2.5)).toBe(-1);
    expect(normalizeParameterSet(undefined)).toBe(-1);
  });

  it('applies a host model report with its Parameter Set to the open drawer', () => {
    const content = ResynatorDrawer.createContent({
      resynator: 2,
      modelName: 'Before Preset',
      parameterSet: 2,
      onClose: () => {},
    });
    document.body.appendChild(content);

    const identity = resolveResynatorModelIdentity({
      slot: 902,
      name: '[EXP] Preset Model',
      catalog: [{ slot: 902, name: 'Catalog Model', parameterSet: 5 }],
    });
    ResynatorDrawer.syncModelInfo(2, identity.name, identity.parameterSet);

    expect(content.querySelector('#R2-resy-model-name')?.textContent).toBe('[EXP] Preset Model');
    expect(content.querySelector('#R2-parset-caption')?.textContent).toContain('(5:');
    expect(content.querySelectorAll('#R2-parset-pills .abd-pill.active')).toHaveLength(1);

    ResynatorDrawer.destroyContent(content);
    content.remove();
  });

  it('resolves an expanded catalog entry by name when the host reports the JSON slug', () => {
    const models = [
      {
        slug: 'fmrhodes_HD',
        name: 'fmrhodes HD (96kHz / 24-bit Remaster)',
        parameterSet: 0,
      },
    ];

    expect(
      findExpandedModelCatalogEntry(models, {
        slug: 'fmrhodes-hd-96k',
        name: 'fmrhodes HD (96kHz / 24-bit Remaster)',
      })?.slug,
    ).toBe('fmrhodes_HD');
    expect(
      findExpandedModelCatalogEntry(models, { slug: 'fmrhodes_HD', name: 'Other' })?.name,
    ).toBe('fmrhodes HD (96kHz / 24-bit Remaster)');
    expect(findExpandedModelCatalogEntry(models, { slug: 'missing' })).toBeUndefined();
  });
});

describe('SET_RESYNATOR_SHAPERS bridge path', () => {
  it('updates the persisted cache immediately from an edit', () => {
    WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 1, ok: false });

    expect(
      WebBridge.setActiveResonatorShapers(
        1,
        { inharmonicityB: 0.4, residualMix: 0.7 },
        'pad-warm',
      ),
    ).toBe(true);

    expect(WebBridge.getActiveResonatorShapers(1)).toMatchObject({
      inharmonicityB: 0.4,
      residualMix: 0.7,
      spatialSpread: createDefaultResynatorShapers().spatialSpread,
    });
    expect(WebBridge.getActiveExpandedModelSlug(1)).toBe('pad-warm');
  });

  it('clears a previous slug when the host reports an untitled model', () => {
    WebBridge.notify({
      type: 'RESYNATOR_SHAPERS',
      resynator: 1,
      ok: true,
      modelName: 'Pad Warm',
      slug: 'pad-warm',
      shapers: createDefaultResynatorShapers(),
    });
    WebBridge.notify({
      type: 'RESYNATOR_SHAPERS',
      resynator: 1,
      ok: true,
      modelName: 'Untitled',
      shapers: createDefaultResynatorShapers(),
    });

    expect(WebBridge.getActiveExpandedModelSlug(1)).toBeUndefined();
  });

  it('drops non-finite edits and rejects an empty payload', () => {
    WebBridge.notify({ type: 'RESYNATOR_SHAPERS', resynator: 2, ok: false });

    expect(
      WebBridge.setActiveResonatorShapers(2, {
        parity: Number.NaN,
        formantShiftSt: 12,
      }),
    ).toBe(true);
    expect(WebBridge.getActiveResonatorShapers(2)).toMatchObject({
      parity: 0,
      formantShiftSt: 12,
    });
    expect(WebBridge.setActiveResonatorShapers(2, {})).toBe(false);
  });
});
