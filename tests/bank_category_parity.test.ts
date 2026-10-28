import { describe, it, expect } from 'vitest';
import { getPresetCategoryInfo } from '../WebUI/src/ui/presetCategories.js';
import { classifyBankCategory } from '@abdsynths/shared/components/bank/bankCategories.js';

/**
 * Guardia anti-fork: la clasificación de categorías de presets del synth debe
 * ser idéntica a la del clasificador canónico de ABDShared. Si este test falla,
 * alguien ha vuelto a duplicar la tabla en vez de usar la fuente única.
 */
describe('Paridad de categorías de presets con ABDShared', () => {
  const battery = [
    'Strings', 'Solo', 'Chords',           // cat-1
    'Bells', 'Percussion', 'World',        // cat-2
    'Bass', 'Plucked', 'Plugged',          // cat-3
    'Pads', 'Showcase',                    // cat-4
    'Keys', 'Piano', 'Organ',              // cat-5
    'Wind', 'Reed', 'Brass', 'Vocals', 'Voice', 'Choir', // cat-6
    'Textures', 'Drone', 'FX',             // cat-7
    'Arps', 'Loops', 'Sequenced',          // cat-8
    'Rhythm', 'Drums',                     // cat-9
    '', 'Unknown Category', 'STRINGS',     // neutro / case-insensitive
    'Drum Loop', 'Keyboard Bass',          // precedencia: primera regla que casa gana
  ];

  for (const category of battery) {
    it(`"${category}" → misma clase que ABDShared`, () => {
      const expected = classifyBankCategory(category);
      const actual = getPresetCategoryInfo(category);
      expect({ catClass: actual.catClass, paramId: actual.paramId }).toEqual(expected);
      expect(typeof actual.icon).toBe('string');
      expect(actual.icon.length).toBeGreaterThan(0);
    });
  }
});
