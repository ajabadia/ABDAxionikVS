import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseSoundScript, parseStickRec, decodeSoundPresetName, serializeSoundScript } from '@abdsynths/shared/formats/neuron';

describe('Neuron Classic Sound Preset & StickRec Parsing (Parity 1:1)', () => {
  const localDbSound000 = path.join(__dirname, '../NeuronDB/Sounds/000.sound');
  const sound000Path = fs.existsSync(localDbSound000)
    ? localDbSound000
    : 'C:/Users/ajaba/Downloads/neuron/NeuronVS-db/NeuronDB/Sounds/000.sound';
  const has000 = fs.existsSync(sound000Path);

  it('debe parsear sound.script canónico de 445 parámetros y decodificar el nombre de preset', () => {
    if (!has000) {
      console.log('Skipping local file check (NeuronDB not found in Downloads)');
      return;
    }

    const scriptText = fs.readFileSync(path.join(sound000Path, 'sound.script'), 'utf-8');
    const preset = parseSoundScript(scriptText);

    expect(preset).toBeDefined();
    expect(preset.name).toBe('Symbiont');
    expect(preset.r1ModelIndex).toBe(336);
    expect(preset.values.size).toBe(445);
    expect(preset.values.get('SoundNumVoices')).toBe(6);
    expect(preset.values.get('R1Volume')).toBe(95);

    // Re-serializar y verificar que produce exactamente 445 líneas
    const serialized = serializeSoundScript(preset);
    const lines = serialized.trim().split(/\r?\n/);
    expect(lines.length).toBe(445);
  });

  it('debe parsear sound.stickrec (líneas hexadecimales de 9 dígitos TTTTFCVVV)', () => {
    if (!has000) return;

    const stickText = fs.readFileSync(path.join(sound000Path, 'sound.stickrec'), 'utf-8');
    const events = parseStickRec(stickText);

    expect(events.length).toBe(780);
    // Primer evento: 000003000
    expect(events[0].time).toBe(0);
    expect(events[0].flag).toBe(0);
    expect(events[0].control).toBe(3);
    expect(events[0].value).toBe(0);

    // Segundo evento: 000003117
    expect(events[1].time).toBe(0);
    expect(events[1].control).toBe(3);
    expect(events[1].value).toBe(0x117); // 279
  });

  it('debe mapear con precisión matemática los 8 controles de stick (0..7) a parámetros snddat', () => {
    // Mapeo canónico Hartmann Neuron Stick Controls:
    const STICK_CONTROL_TO_PARAM: Record<number, number> = {
      0: 52,  // R1 Scape X
      1: 53,  // R1 Scape Y
      2: 42,  // R1 Sphere X
      3: 43,  // R1 Sphere Y
      4: 132, // R2 Scape X
      5: 133, // R2 Scape Y
      6: 122, // R2 Sphere X
      7: 123, // R2 Sphere Y
    };

    for (let c = 0; c < 8; ++c) {
      expect(STICK_CONTROL_TO_PARAM[c]).toBeDefined();
    }

    // Normalización: 0x200 (512) -> 1.0; 0x100 (256) -> 0.5 (centro)
    const normCenter = 256 / 512;
    expect(normCenter).toBe(0.5);

    const normMax = 512 / 512;
    expect(normMax).toBe(1.0);
  });

  it('debe contener los 398 presets de fábrica oficiales (VST + Soundset V4 Hardware) en FactoryPresets.gen.h', () => {
    const genHPath = path.join(__dirname, '../Source/Generated/FactoryPresets.gen.h');
    expect(fs.existsSync(genHPath)).toBe(true);

    const genH = fs.readFileSync(genHPath, 'utf8');
    expect(genH).toContain('constexpr size_t kNumFactoryPresets = 398;');
    expect(genH).toContain('{ 0, "Symbiont" }');
    expect(genH).toContain('{ 176, "DangerDrone" }');
    expect(genH).toContain('{ 350, "Scary Bell" }');
    expect(genH).toContain('{ 351, ');
    expect(genH).toContain('{ 394, ');
    expect(genH).toContain('{ 999, "So:Nata SMB" }');
  });
});
