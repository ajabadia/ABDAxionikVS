import { describe, expect, it } from 'vitest';
import {
  consolidateNeuronDbModels,
  createSoundPresetForModel,
  evaluateNeuronDb,
  filterActiveModels,
  findNextFreeModelSlot,
  isEmptyModelName,
  parseModelNamesCache,
  parseSoundNamesCache,
  parseSoundScript,
  PINNED_SINEW_SLOT,
  remapModelInPresets,
  remapModelInSoundScript,
  serializeSoundScript,
  syncNeuronDbNamesCaches,
} from '@abdsynths/shared/formats/neuron';
import { createCanonicalBank } from '../WebUI/src/ui/NeuronCatalogMetadata';

describe('NeuronDbMapper (Transparent BrainMapper Engine)', () => {
  it('filters --<empty>-- placeholder models and evaluates canonical factory NeuronDB dependencies', () => {
    expect(isEmptyModelName('--<empty>--')).toBe(true);
    expect(isEmptyModelName('  ')).toBe(true);
    expect(isEmptyModelName('ambientpad*')).toBe(false);

    const bank = createCanonicalBank();
    // 000..339 (340 models) + 511 (sinew) = 341 active models (no --<empty>-- 340..510)
    expect(bank.models.length).toBe(341);
    expect(bank.models.some((m) => isEmptyModelName(m.name))).toBe(false);

    const evalResult = evaluateNeuronDb(bank.models, bank.presets);
    expect(evalResult.activeModelCount).toBe(341);
    expect(evalResult.inUseModelCount).toBeGreaterThan(200);
    expect(evalResult.unusedModelCount).toBeGreaterThan(50);
    expect(evalResult.inUseModelCount + evalResult.unusedModelCount).toBe(341);

    // Model #000 (ambientpad*) is used by both R1 and R2 across multiple factory sounds
    const m0 = evalResult.modelDependencies.get(0);
    expect(m0).toBeDefined();
    expect(m0?.usageStatus).toBe('in-use');
    expect(m0?.usedByPresetSlots.length).toBeGreaterThan(10);

    // Preset #000 (Symbiont) uses R1=#336 (synthbase4) and R2=#264 (Indigo^2)
    const p0 = evalResult.presetDependencies.get(0);
    expect(p0).toBeDefined();
    expect(p0?.r1ModelIndex).toBe(336);
    expect(p0?.r1ModelName).toBe('synthbase4');
    expect(p0?.r2ModelIndex).toBe(264);
    expect(p0?.r2ModelName).toBe('Indigo^2');
    expect(p0?.r1Missing).toBe(false);
    expect(p0?.r2Missing).toBe(false);

    // Factory preset #361 (Fusion) references unallocated model #438 on R1
    const p361 = evalResult.presetDependencies.get(361);
    expect(p361?.r1ModelIndex).toBe(438);
    expect(p361?.r1Missing).toBe(true);
  });

  it('classifies in-use, in-use-disabled, and unused models accurately', () => {
    const models = [
      { slot: 0, name: 'ActivePad' },
      { slot: 1, name: 'DisabledPad' },
      { slot: 2, name: 'OrphanModel' },
      { slot: 3, name: '--<empty>--' },
      { slot: 511, name: 'sinew' },
    ];
    const presets = [
      {
        slot: 0,
        name: 'SoundA',
        modelIndex: 0,
        r2ModelIndex: 1,
        r1Switch: true,
        r2Switch: false,
      },
    ];

    const evalResult = evaluateNeuronDb(models, presets);
    expect(evalResult.modelDependencies.get(0)?.usageStatus).toBe('in-use');
    expect(evalResult.modelDependencies.get(1)?.usageStatus).toBe('in-use-disabled');
    expect(evalResult.modelDependencies.get(2)?.usageStatus).toBe('unused');
    expect(evalResult.modelDependencies.get(3)?.isEmptySlot).toBe(true);
    expect(filterActiveModels(models).map((m) => m.slot)).toEqual([0, 1, 2, 511]);
  });

  it('finds a safe free model slot without overwriting #511 sinew or in-use models', () => {
    const models = [
      { slot: 0, name: 'UsedModel0' },
      { slot: 1, name: 'UnusedModel1' },
      { slot: 2, name: '--<empty>--' },
      { slot: 511, name: 'sinew' },
    ];
    const presets = [{ slot: 0, name: 'Sound0', modelIndex: 0, r2ModelIndex: 511 }];

    // Slot 0 is in-use, slot 1 has an unused model, slot 2 is --<empty>-- -> picks slot 2 first
    expect(findNextFreeModelSlot(models, presets, 0)).toBe(2);
    // Requesting pinned slot 511 automatically redirects to first free/empty slot (2)
    expect(findNextFreeModelSlot(models, presets, PINNED_SINEW_SLOT)).toBe(2);
    // Requesting unallocated slot 10 returns 10 directly
    expect(findNextFreeModelSlot(models, presets, 10)).toBe(10);
  });

  it('remaps R1 and R2 model references in presets and sound.script text', () => {
    const presets = [
      { slot: 0, name: 'S0', modelIndex: 12, r2ModelIndex: 34 },
      { slot: 1, name: 'S1', modelIndex: 5, r2ModelIndex: 12 },
    ];
    const remapped = remapModelInPresets(presets, 12, 99);
    expect(remapped.affectedPresetSlots).toEqual([0, 1]);
    expect(remapped.presets[0].modelIndex).toBe(99);
    expect(remapped.presets[0].r2ModelIndex).toBe(34);
    expect(remapped.presets[1].modelIndex).toBe(5);
    expect(remapped.presets[1].r2ModelIndex).toBe(99);

    const sound = createSoundPresetForModel({
      name: 'RemapTest',
      r1ModelIndex: 12,
      r2ModelIndex: 12,
      r2Switch: true,
    });
    const rawScript = serializeSoundScript(sound);
    const scriptRemap = remapModelInSoundScript(rawScript, 12, 77);
    expect(scriptRemap.changed).toBe(true);

    const reparsed = parseSoundScript(scriptRemap.scriptText);
    expect(reparsed.r1ModelIndex).toBe(77);
    expect(reparsed.r2ModelIndex).toBe(77);
  });

  it('consolidates fragmented models while pinning #511 sinew and syncing ModelNames/SoundNames caches', () => {
    const models = [
      { slot: 0, name: 'ModelA' },
      { slot: 1, name: '--<empty>--' },
      { slot: 5, name: 'ModelB' },
      { slot: 10, name: 'ModelC' },
      { slot: 511, name: 'sinew' },
    ];
    const presets = [
      { slot: 0, name: 'LeadB', modelIndex: 5, r2ModelIndex: 10 },
      { slot: 1, name: 'SinePad', modelIndex: 0, r2ModelIndex: 511 },
    ];

    const compacted = consolidateNeuronDbModels(models, presets, 0);
    expect(compacted.removedEmptySlots).toEqual([1]);
    expect(compacted.models.map((m) => [m.slot, m.name])).toEqual([
      [0, 'ModelA'],
      [1, 'ModelB'],
      [2, 'ModelC'],
      [511, 'sinew'],
    ]);
    expect(compacted.presets[0].modelIndex).toBe(1);
    expect(compacted.presets[0].r2ModelIndex).toBe(2);
    expect(compacted.presets[1].modelIndex).toBe(0);
    expect(compacted.presets[1].r2ModelIndex).toBe(511);

    const caches = syncNeuronDbNamesCaches(compacted.models, compacted.presets);
    const parsedModels = parseModelNamesCache(caches.modelNamesCache);
    const parsedSounds = parseSoundNamesCache(caches.soundNamesCache);

    expect(parsedModels.size).toBe(512);
    expect(parsedModels.get(0)).toBe('ModelA');
    expect(parsedModels.get(1)).toBe('ModelB');
    expect(parsedModels.get(2)).toBe('ModelC');
    expect(parsedModels.get(3)).toBe('--<empty>--');
    expect(parsedModels.get(511)).toBe('sinew');

    expect(parsedSounds.size).toBe(1000);
    expect(parsedSounds.get(0)).toBe('LeadB');
    expect(parsedSounds.get(1)).toBe('SinePad');
  });
});

