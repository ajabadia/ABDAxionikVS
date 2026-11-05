#!/usr/bin/env node
/**
 * ABDAxionikVS — Generador Canónico del Registro de Parámetros y Contratos
 *
 * Lee:
 *   - schemas/preset_schema.csv (445 parámetros autoritativos de snddat)
 *   - schemas/vst_exposed_params.csv (26 parámetros expuestos al host)
 *   - schemas/params_observers_map.csv (335 observadores, slots en p[] y 63 destinos de modulación)
 *   - schemas/parameter_sets_mnan.json (10 Parameter Sets Scape/Sphere)
 *
 * Emite (ARTEFACTOS):
 *   1. Source/Generated/ParameterRegistry.gen.h
 *   2. Source/Generated/Conversion.gen.h
 *   3. Source/Generated/MidiMapping.gen.h
 *   4. WebUI/src/generated/parameters.gen.ts
 *   5. WebUI/src/generated/bridge-protocol.json
 *
 * Uso:
 *   node Scripts/registry_generator.js          # Regenera todos los artefactos
 *   node Scripts/registry_generator.js --check  # Modo CI: verifica sin escribir
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const ARTEFACTOS = [
  { clave: 'registry_h', rel: 'Source/Generated/ParameterRegistry.gen.h', desc: 'Registro C++ y APVTS' },
  { clave: 'conversion_h', rel: 'Source/Generated/Conversion.gen.h', desc: 'Funciones C++ de conversión 0..1 <-> raw' },
  { clave: 'midi_h', rel: 'Source/Generated/MidiMapping.gen.h', desc: 'Tablas MIDI CC / NRPN / SysEx' },
  { clave: 'presets_h', rel: 'Source/Generated/FactoryPresets.gen.h', desc: 'Presets de fábrica oficiales' },
  { clave: 'params_ts', rel: 'WebUI/src/generated/parameters.gen.ts', desc: 'Contrato TypeScript WebUI' },
  { clave: 'bridge_json', rel: 'WebUI/src/generated/bridge-protocol.json', desc: 'Esquema de mensajes del bridge' },
  { clave: 'shared_spec', rel: '../ABDShared/Contracts/hartmann_neuron_parameter_spec.json', desc: 'Diccionario Canónico ABDShared v2.0' },
];

const CHECK_ONLY = process.argv.includes('--check');

function parseCsv(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines[0].split(',').map(c => c.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(c => c.trim());
    const row = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(row);
  }
  return rows;
}

// 1. Cargar fuentes de datos
const presetSchemaRows = parseCsv(path.join(rootDir, 'schemas', 'preset_schema.csv'));
const vstExposedRows = parseCsv(path.join(rootDir, 'schemas', 'vst_exposed_params.csv'));
const observersRows = parseCsv(path.join(rootDir, 'schemas', 'params_observers_map.csv'));
const paramSets = JSON.parse(fs.readFileSync(path.join(rootDir, 'schemas', 'parameter_sets_mnan.json'), 'utf8'));

// Mapas rápidos
const vstByName = new Map();
vstExposedRows.forEach(v => vstByName.set(v.name, v));

const obsBySnddatIndex = new Map();
observersRows.forEach(o => obsBySnddatIndex.set(parseInt(o.snddat_index, 10), o));

function getSemanticRole(key) {
  if (key === 'SoundPan') return 'MasterPan';
  if (key === 'SoundNumVoices') return 'Polyphony';
  if (key === 'PitchBendRange') return 'PitchBendUp';

  if (key === 'FilterType') return 'FilterType';
  if (key === 'FilterFreq') return 'FilterCutoff';
  if (key === 'FilterReso') return 'FilterResonance';
  if (key === 'FilterKeyTrack') return 'FilterKeyTrack';
  if (key === 'FilterCutoffVelocityDepth') return 'FilterVelSensitivity';
  if (key === 'FilterEnvDepth') return 'FilterEnvDepth';
  if (key === 'FilterEnvA') return 'FilterEnvAttack';
  if (key === 'FilterEnvD') return 'FilterEnvDecay';
  if (key === 'FilterEnvS') return 'FilterEnvSustain';
  if (key === 'FilterEnvR') return 'FilterEnvRelease';

  if (key === 'R1AmpEnvA' || key === 'R2AmpEnvA') return 'AmpEnvAttack';
  if (key === 'R1AmpEnvD' || key === 'R2AmpEnvD') return 'AmpEnvDecay';
  if (key === 'R1AmpEnvS' || key === 'R2AmpEnvS') return 'AmpEnvSustain';
  if (key === 'R1AmpEnvR' || key === 'R2AmpEnvR') return 'AmpEnvRelease';
  if (key === 'R1Volume' || key === 'R2Volume') return 'ZoneGainDb';
  if (key === 'R1Semi' || key === 'R2Semi') return 'ZoneTuneSemitones';
  if (key === 'R1Cents' || key === 'R2Cents') return 'ZoneTuneCents';
  if (key === 'R1PitchKeyTrack' || key === 'R2PitchKeyTrack') return 'ZonePitchKeyTrack';

  if (key === 'LFOSwitch') return 'Lfo1Switch';
  if (key === 'LFODepth') return 'Lfo1Depth';
  if (key === 'LFORate') return 'Lfo1Rate';
  if (key === 'LFOWaveForm') return 'Lfo1Wave';

  if (key.endsWith('StickPlayback')) return 'TriggerMode';

  return undefined;
}

// Procesar los 445 parámetros
const parameters = presetSchemaRows.map(r => {
  const index = parseInt(r.index, 10);
  const key = r.key;
  const group = r.group;
  const min = parseFloat(r.min);
  const max = parseFloat(r.max);
  let def = parseFloat(r.default);
  const step = parseFloat(r.step);
  
  // Regla FUN_10001170: Si el default es 0 pero min es 1 (19 parámetros específicos), el default real es 1.0
  if (def < min && min === 1.0) {
    def = 1.0;
  }

  const vst = vstByName.get(key) || null;
  const vstIndex = vst ? parseInt(vst.index, 10) : -1;
  const vstDisplay = vst ? vst.display : '';

  const obs = obsBySnddatIndex.get(index) || null;
  const slotInP = obs ? parseInt(obs.slot_in_p, 10) : -1;
  const modDestIdx = obs ? parseInt(obs.mod_dest_idx, 10) : -1;

  // Sanitizar identificador C++
  const safeId = key.replace(/[^a-zA-Z0-9_]/g, '_');

  const isSymBipolar = (min === -64.0 && max === 63.0);
  const semanticRole = getSemanticRole(key) || '';

  return {
    index,
    key,
    safeId,
    group,
    min,
    max,
    defaultValue: def,
    default: def,
    step,
    vstIndex,
    vstDisplay,
    slotInP,
    modDestIdx,
    isModDest: modDestIdx >= 0,
    isVstExposed: vstIndex >= 0,
    isDiscrete: step === 1.0 && (max - min) < 20,
    isSymBipolar,
    semanticRole,
  };
});

// Ordenar mod dests (0..62)
const modDests = parameters.filter(p => p.isModDest).sort((a, b) => a.modDestIdx - b.modDestIdx);
const vstParams = parameters.filter(p => p.isVstExposed).sort((a, b) => a.vstIndex - b.vstIndex);

// =========================================================================
// Artefacto 1: ParameterRegistry.gen.h
// =========================================================================
function generateParameterRegistryHeader() {
  const lines = [];
  lines.push('// ============================================================================');
  lines.push('// ABDAxionikVS — ParameterRegistry.gen.h');
  lines.push('// AUTOGENERADO POR Scripts/registry_generator.js — NO EDITAR MANUALMENTE');
  lines.push('// ============================================================================');
  lines.push('');
  lines.push('#pragma once');
  lines.push('');
  lines.push('#include <cstdint>');
  lines.push('#include <cstddef>');
  lines.push('#include <string_view>');
  lines.push('#include <array>');
  lines.push('');
  lines.push('namespace abd::axionik {');
  lines.push('');
  lines.push('constexpr size_t kNumTotalParameters = 445;');
  lines.push('constexpr size_t kNumVstExposedParameters = 26;');
  lines.push('constexpr size_t kNumModulationDestinations = 63;');
  lines.push('constexpr size_t kNumEffectiveSlotsInP = 340;');
  lines.push('');
  lines.push('enum class ParamID : uint32_t {');
  for (const p of parameters) {
    lines.push(`    ${p.safeId} = ${p.index},`);
  }
  lines.push('};');
  lines.push('');
  lines.push('enum class VstParamID : uint32_t {');
  for (const v of vstParams) {
    lines.push(`    ${v.safeId} = ${v.vstIndex},`);
  }
  lines.push('};');
  lines.push('');
  lines.push('struct ParamDescriptor {');
  lines.push('    uint32_t index;');
  lines.push('    std::string_view key;');
  lines.push('    std::string_view group;');
  lines.push('    float min;');
  lines.push('    float max;');
  lines.push('    float defaultValue;');
  lines.push('    float step;');
  lines.push('    int32_t vstIndex;');
  lines.push('    int32_t slotInP;');
  lines.push('    int32_t modDestIdx;');
  lines.push('    bool isModDest;');
  lines.push('    bool isVstExposed;');
  lines.push('    bool isDiscrete;');
  lines.push('    bool isSymBipolar;');
  lines.push('    std::string_view semanticRole;');
  lines.push('};');
  lines.push('');
  lines.push('inline constexpr std::array<ParamDescriptor, kNumTotalParameters> kParameterDescriptors = {{');
  for (const p of parameters) {
    const roleStr = p.semanticRole ? `"${p.semanticRole}"` : '""';
    lines.push(`    { ${p.index}, "${p.key}", "${p.group}", ${p.min.toFixed(4)}f, ${p.max.toFixed(4)}f, ${p.defaultValue.toFixed(4)}f, ${p.step.toFixed(4)}f, ${p.vstIndex}, ${p.slotInP}, ${p.modDestIdx}, ${p.isModDest ? 'true' : 'false'}, ${p.isVstExposed ? 'true' : 'false'}, ${p.isDiscrete ? 'true' : 'false'}, ${p.isSymBipolar ? 'true' : 'false'}, ${roleStr} },`);
  }
  lines.push('}};');
  lines.push('');
  lines.push('inline constexpr std::array<uint32_t, kNumModulationDestinations> kModDestParamIndices = {{');
  for (const m of modDests) {
    lines.push(`    ${m.index}, // Dest ${m.modDestIdx}: ${m.key} (p[${m.slotInP}])`);
  }
  lines.push('}};');
  lines.push('');
  lines.push('inline constexpr std::array<uint32_t, kNumVstExposedParameters> kVstExposedParamIndices = {{');
  for (const v of vstParams) {
    lines.push(`    ${v.index}, // VST ${v.vstIndex}: ${v.key}`);
  }
  lines.push('}};');
  lines.push('');
  lines.push('constexpr const ParamDescriptor* getParamDescriptor(uint32_t index) noexcept {');
  lines.push('    if (index < kNumTotalParameters) return &kParameterDescriptors[index];');
  lines.push('    return nullptr;');
  lines.push('}');
  lines.push('');
  lines.push('constexpr const ParamDescriptor* getVstParamDescriptor(uint32_t vstIndex) noexcept {');
  lines.push('    if (vstIndex < kNumVstExposedParameters) return &kParameterDescriptors[kVstExposedParamIndices[vstIndex]];');
  lines.push('    return nullptr;');
  lines.push('}');
  lines.push('');
  lines.push('} // namespace abd::axionik');
  return lines.join('\n') + '\n';
}

// =========================================================================
// Artefacto 2: Conversion.gen.h
// =========================================================================
function generateConversionHeader() {
  const lines = [];
  lines.push('// ============================================================================');
  lines.push('// ABDAxionikVS — Conversion.gen.h');
  lines.push('// AUTOGENERADO POR Scripts/registry_generator.js — NO EDITAR MANUALMENTE');
  lines.push('// ============================================================================');
  lines.push('');
  lines.push('#pragma once');
  lines.push('');
  lines.push('#include "ParameterRegistry.gen.h"');
  lines.push('#include <cmath>');
  lines.push('#include <algorithm>');
  lines.push('');
  lines.push('namespace abd::axionik {');
  lines.push('');
  lines.push('/**');
  lines.push(' * Convierte un valor crudo a normalizado [0.0f, 1.0f]');
  lines.push(' * Para parámetros SymBipolar [-64..63]: raw 0 -> exacto 0.5f');
  lines.push(' */');
  lines.push('inline float rawToNormalized(uint32_t index, float rawValue) noexcept {');
  lines.push('    if (index >= kNumTotalParameters) return 0.0f;');
  lines.push('    const auto& desc = kParameterDescriptors[index];');
  lines.push('    if (desc.max <= desc.min) return 0.0f;');
  lines.push('    float clamped = std::clamp(rawValue, desc.min, desc.max);');
  lines.push('    if (desc.isSymBipolar) {');
  lines.push('        if (clamped == 0.0f) return 0.5f;');
  lines.push('        if (clamped > 0.0f) return 0.5f + 0.5f * (clamped / desc.max);');
  lines.push('        return 0.5f - 0.5f * (clamped / desc.min);');
  lines.push('    }');
  lines.push('    return (clamped - desc.min) / (desc.max - desc.min);');
  lines.push('}');
  lines.push('');
  lines.push('/**');
  lines.push(' * Convierte un valor normalizado [0.0f, 1.0f] a crudo cuantizado segun step y clamp');
  lines.push(' * Para parámetros SymBipolar [-64..63]: norm 0.5f -> exacto 0.0f');
  lines.push(' * Aplica la regla estricta de FUN_10001170 del binario original');
  lines.push(' */');
  lines.push('inline float normalizedToRaw(uint32_t index, float normalized) noexcept {');
  lines.push('    if (index >= kNumTotalParameters) return 0.0f;');
  lines.push('    const auto& desc = kParameterDescriptors[index];');
  lines.push('    float norm = std::clamp(normalized, 0.0f, 1.0f);');
  lines.push('    if (desc.isSymBipolar) {');
  lines.push('        if (std::abs(norm - 0.5f) < 1e-6f) return 0.0f;');
  lines.push('        float raw = (norm > 0.5f)');
  lines.push('            ? (norm - 0.5f) * 2.0f * desc.max');
  lines.push('            : (0.5f - norm) * 2.0f * desc.min;');
  lines.push('        if (desc.step > 0.0f) {');
  lines.push('            raw = std::round(raw / desc.step) * desc.step;');
  lines.push('        }');
  lines.push('        return std::clamp(raw, desc.min, desc.max);');
  lines.push('    }');
  lines.push('    float raw = desc.min + norm * (desc.max - desc.min);');
  lines.push('    if (desc.step > 0.0f) {');
  lines.push('        raw = std::round((raw - desc.min) / desc.step) * desc.step + desc.min;');
  lines.push('    }');
  lines.push('    return std::clamp(raw, desc.min, desc.max);');
  lines.push('}');
  lines.push('');
  lines.push('} // namespace abd::axionik');
  return lines.join('\n') + '\n';
}

// =========================================================================
// Artefacto 3: MidiMapping.gen.h
// =========================================================================
function generateMidiMappingHeader() {
  const lines = [];
  lines.push('// ============================================================================');
  lines.push('// ABDAxionikVS — MidiMapping.gen.h');
  lines.push('// AUTOGENERADO POR Scripts/registry_generator.js — NO EDITAR MANUALMENTE');
  lines.push('// ============================================================================');
  lines.push('');
  lines.push('#pragma once');
  lines.push('');
  lines.push('#include <cstdint>');
  lines.push('#include <array>');
  lines.push('');
  lines.push('namespace abd::axionik {');
  lines.push('');
  lines.push('// 6 Controles en tiempo real del Hartmann Neuron (params+0x44)');
  lines.push('constexpr uint8_t kMidiCCModulation = 1;     // Modulation Wheel (params+0x48)');
  lines.push('constexpr uint8_t kMidiCCBreath     = 2;     // Breath Controller (params+0x4C)');
  lines.push('constexpr uint8_t kMidiCCCO3        = 3;     // CC 03 (params+0x50)');
  lines.push('constexpr uint8_t kMidiCCFoot       = 4;     // Foot Pedal (params+0x54)');
  lines.push('constexpr uint8_t kMidiCCExpression = 11;    // Expression Pedal (params+0x58)');
  lines.push('// Channel Pressure / Aftertouch alimenta params+0x44 directamente');
  lines.push('constexpr uint8_t kMidiCCBankSelect = 32;    // Bank Select LSB (0..9)');
  lines.push('');
  lines.push('// Controladores Vectoriales 2D (Sticks XY) y Controles Principales');
  lines.push('constexpr uint8_t kMidiCCR1ScapeX     = 16;   // Resynator 1 Scape X (param 52)');
  lines.push('constexpr uint8_t kMidiCCR1ScapeY     = 17;   // Resynator 1 Scape Y (param 53)');
  lines.push('constexpr uint8_t kMidiCCR1SphereX    = 18;   // Resynator 1 Sphere X (param 42)');
  lines.push('constexpr uint8_t kMidiCCR1SphereY    = 19;   // Resynator 1 Sphere Y (param 43)');
  lines.push('constexpr uint8_t kMidiCCR2ScapeX     = 35;   // Resynator 2 Scape X (param 132)');
  lines.push('constexpr uint8_t kMidiCCR2ScapeY     = 36;   // Resynator 2 Scape Y (param 133)');
  lines.push('constexpr uint8_t kMidiCCR2SphereX    = 37;   // Resynator 2 Sphere X (param 122)');
  lines.push('constexpr uint8_t kMidiCCR2SphereY    = 39;   // Resynator 2 Sphere Y (param 123)');
  lines.push('constexpr uint8_t kMidiCCBlender      = 70;   // Blender Amount (param 262)');
  lines.push('constexpr uint8_t kMidiCCFilterReso   = 71;   // Filter Resonance (param 275)');
  lines.push('constexpr uint8_t kMidiCCFilterCutoff = 74;   // Filter Cutoff (param 274)');
  lines.push('');
  lines.push('// Direccionamiento NRPN de 14 bits: NRPN 0..444 direccionan 1:1 los 445 parametros');
  lines.push('constexpr uint16_t kNrpnBaseParameterAddress = 0;');
  lines.push('constexpr uint16_t kNrpnMaxParameterAddress = 444;');
  lines.push('');
  lines.push('constexpr bool isNrpnParameterAddress(uint16_t nrpn) noexcept {');
  lines.push('    return nrpn <= kNrpnMaxParameterAddress;');
  lines.push('}');
  lines.push('');
  lines.push('} // namespace abd::axionik');
  return lines.join('\n') + '\n';
}

// =========================================================================
// Artefacto: FactoryPresets.gen.h
// =========================================================================
function generateFactoryPresetsHeader() {
  const soundNamesPath = path.join(rootDir, 'NeuronDB', 'SoundNames');
  const soundsDirPath = path.join(rootDir, 'NeuronDB', 'Sounds');
  let presets = [];

  if (fs.existsSync(soundsDirPath) && fs.existsSync(soundNamesPath)) {
    const soundNamesRaw = fs.readFileSync(soundNamesPath, 'utf8').split(/\r?\n/);
    const nameMap = new Map();
    soundNamesRaw.forEach(l => {
      const parts = l.split('\t');
      if (parts.length >= 2) {
        nameMap.set(parseInt(parts[0], 10), parts[1].trim());
      }
    });

    const files = fs.readdirSync(soundsDirPath).filter(f => f.endsWith('.sound'));
    presets = files.map(f => {
      const slot = parseInt(f.replace('.sound', ''), 10);
      const name = nameMap.get(slot) || (`Sound ${slot}`);
      return { slot, name };
    }).sort((a, b) => a.slot - b.slot);
  }

  const lines = [
    '// ============================================================================',
    '// ABDAxionikVS — FactoryPresets.gen.h',
    '// AUTOGENERADO POR Scripts/registry_generator.js — NO EDITAR MANUALMENTE',
    `// ${presets.length} Presets de fábrica oficiales de Hartmann Neuron / NeuronVS`,
    '// ============================================================================',
    '',
    '#pragma once',
    '',
    '#include <cstdint>',
    '#include <cstddef>',
    '#include <array>',
    '#include <string_view>',
    '',
    'namespace abd::axionik {',
    '',
    'struct FactoryPresetEntry {',
    '    int slot;',
    '    std::string_view name;',
    '};',
    '',
    `constexpr size_t kNumFactoryPresets = ${presets.length};`,
    '',
    `constexpr std::array<FactoryPresetEntry, kNumFactoryPresets> kFactoryPresetList = {{`
  ];

  for (const p of presets) {
    const safeName = p.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`    { ${p.slot}, "${safeName}" },`);
  }

  lines.push(
    '}};',
    '',
    'inline int getSlotForProgramIndex(int programIndex) noexcept {',
    '    if (programIndex < 0 || programIndex >= static_cast<int>(kNumFactoryPresets)) return 0;',
    '    return kFactoryPresetList[static_cast<size_t>(programIndex)].slot;',
    '}',
    '',
    'inline std::string_view getProgramNameForIndex(int programIndex) noexcept {',
    '    if (programIndex < 0 || programIndex >= static_cast<int>(kNumFactoryPresets)) return "Init Sound";',
    '    return kFactoryPresetList[static_cast<size_t>(programIndex)].name;',
    '}',
    '',
    'inline int getProgramIndexForSlot(int slot) noexcept {',
    '    for (size_t i = 0; i < kNumFactoryPresets; ++i) {',
    '        if (kFactoryPresetList[i].slot == slot) return static_cast<int>(i);',
    '    }',
    '    return 0;',
    '}',
    '',
    '} // namespace abd::axionik'
  );

  return lines.join('\n') + '\n';
}

// =========================================================================
// Artefacto 4: parameters.gen.ts
// =========================================================================
function generateParametersTs() {
  const lines = [];
  lines.push('/**');
  lines.push(' * ABDAxionikVS — parameters.gen.ts');
  lines.push(' * AUTOGENERADO POR Scripts/registry_generator.js — NO EDITAR MANUALMENTE');
  lines.push(' */');
  lines.push('');
  lines.push('export interface ParamDefinition {');
  for (const field of Object.keys(parameters[0])) {
    const value = parameters[0][field];
    const type = value === null ? 'unknown' : typeof value;
    lines.push(`  ${field}: ${type === 'object' ? 'unknown' : type};`);
  }
  lines.push('}');
  lines.push('');
  lines.push(`export const PARAM_DEFINITIONS: ParamDefinition[] = ${JSON.stringify(parameters, null, 2)};`);
  lines.push('');
  lines.push('export const PARAM_BY_KEY: Record<string, ParamDefinition> = {};');
  lines.push('export const PARAM_BY_INDEX: Record<number, ParamDefinition> = {};');
  lines.push('PARAM_DEFINITIONS.forEach(p => {');
  lines.push('  PARAM_BY_KEY[p.key] = p;');
  lines.push('  PARAM_BY_INDEX[p.index] = p;');
  lines.push('});');
  lines.push('');
  lines.push(`export const PARAMETER_SETS = ${JSON.stringify(paramSets, null, 2)} as const;`);
  lines.push('');
  lines.push('export const VST_EXPOSED_INDICES: number[] = ' + JSON.stringify(vstParams.map(v => v.index)) + ';');
  lines.push('export const MOD_DEST_INDICES: number[] = ' + JSON.stringify(modDests.map(m => m.index)) + ';');
  lines.push('');
  return lines.join('\n') + '\n';
}

// =========================================================================
// Artefacto 5: bridge-protocol.json
// =========================================================================
function generateBridgeProtocolJson() {
  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "ABDAxionikVSBridgeProtocol",
    version: "1.0.0",
    description: "Protocolo versionado bidireccional Host C++/WASM <-> WebView2 WebUI",
    messages: {
      toHost: [
        { type: "PARAM_SET", properties: { index: { type: "integer", minimum: 0, maximum: 444 }, value: { type: "number" } } },
        { type: "PARAM_BATCH_SET", properties: { params: { type: "array", items: { type: "object", properties: { index: { type: "integer" }, value: { type: "number" } } } } } },
        { type: "NOTE_ON", properties: { note: { type: "integer", minimum: 0, maximum: 127 }, velocity: { type: "number", minimum: 0, maximum: 1 } } },
        { type: "NOTE_OFF", properties: { note: { type: "integer", minimum: 0, maximum: 127 } } },
        { type: "STICK_MOVE", properties: { layer: { type: "string", enum: ["R1", "R2", "Silver"] }, kind: { type: "string", enum: ["Scape", "Sphere"] }, x: { type: "number" }, y: { type: "number" } } },
        { type: "LOAD_PRESET", properties: { presetIndex: { type: "integer", minimum: 0, maximum: 999 } } },
        { type: "LOAD_MODEL", properties: { resynator: { type: "integer", enum: [1, 2] }, modelIndex: { type: "integer", minimum: 0, maximum: 511 } } },
        { type: "REQUEST_SYNC", properties: {} }
      ],
      fromHost: [
        { type: "PARAM_UPDATE", properties: { index: { type: "integer" }, value: { type: "number" } } },
        { type: "PARAM_BATCH_UPDATE", properties: { params: { type: "array" } } },
        { type: "TELEMETRY", properties: { cpuUsage: { type: "number" }, activeVoices: { type: "integer" }, peakL: { type: "number" }, peakR: { type: "number" } } },
        { type: "MODEL_LOADED", properties: { resynator: { type: "integer" }, modelIndex: { type: "integer" }, modelName: { type: "string" }, scapeNames: { type: "array" }, sphereNames: { type: "array" } } },
        { type: "HEARTBEAT", properties: { timestamp: { type: "number" } } }
      ]
    }
  };
  return JSON.stringify(schema, null, 2) + '\n';
}

// =========================================================================
// Artefacto 7: hartmann_neuron_parameter_spec.json (ABDShared v2.0)
// =========================================================================
function generateHartmannNeuronParameterSpec() {
  const ccByParamIndex = new Map([
    [52, 16],  // R1L1Scape1Value -> CC 16
    [53, 17],  // R1L1Scape2Value -> CC 17
    [42, 18],  // R1L1Sphere1Value -> CC 18
    [43, 19],  // R1L1Sphere2Value -> CC 19
    [132, 35], // R2L1Scape1Value -> CC 35
    [133, 36], // R2L1Scape2Value -> CC 36
    [122, 37], // R2L1Sphere1Value -> CC 37
    [123, 39], // R2L1Sphere2Value -> CC 39
    [262, 70], // BlenderAmount -> CC 70
    [275, 71], // FilterReso -> CC 71
    [274, 74], // FilterFreq -> CC 74
  ]);

  function getSemanticRole(key) {
    if (key === 'SoundPan') return 'MasterPan';
    if (key === 'SoundNumVoices') return 'Polyphony';
    if (key === 'PitchBendRange') return 'PitchBendUp';

    if (key === 'FilterType') return 'FilterType';
    if (key === 'FilterFreq') return 'FilterCutoff';
    if (key === 'FilterReso') return 'FilterResonance';
    if (key === 'FilterKeyTrack') return 'FilterKeyTrack';
    if (key === 'FilterCutoffVelocityDepth') return 'FilterVelSensitivity';
    if (key === 'FilterEnvDepth') return 'FilterEnvDepth';
    if (key === 'FilterEnvA') return 'FilterEnvAttack';
    if (key === 'FilterEnvD') return 'FilterEnvDecay';
    if (key === 'FilterEnvS') return 'FilterEnvSustain';
    if (key === 'FilterEnvR') return 'FilterEnvRelease';

    if (key === 'R1AmpEnvA' || key === 'R2AmpEnvA') return 'AmpEnvAttack';
    if (key === 'R1AmpEnvD' || key === 'R2AmpEnvD') return 'AmpEnvDecay';
    if (key === 'R1AmpEnvS' || key === 'R2AmpEnvS') return 'AmpEnvSustain';
    if (key === 'R1AmpEnvR' || key === 'R2AmpEnvR') return 'AmpEnvRelease';
    if (key === 'R1Volume' || key === 'R2Volume') return 'ZoneGainDb';
    if (key === 'R1Semi' || key === 'R2Semi') return 'ZoneTuneSemitones';
    if (key === 'R1Cents' || key === 'R2Cents') return 'ZoneTuneCents';
    if (key === 'R1PitchKeyTrack' || key === 'R2PitchKeyTrack') return 'ZonePitchKeyTrack';

    if (key === 'LFOSwitch') return 'Lfo1Switch';
    if (key === 'LFODepth') return 'Lfo1Depth';
    if (key === 'LFORate') return 'Lfo1Rate';
    if (key === 'LFOWaveForm') return 'Lfo1Wave';

    if (key.endsWith('StickPlayback')) return 'TriggerMode';

    return undefined;
  }

  const parts = [
    { id: 'r1', name: 'Resynator 1', scope: 'part', cardinality: 1, idPrefix: 'R1' },
    { id: 'r2', name: 'Resynator 2', scope: 'part', cardinality: 1, idPrefix: 'R2' },
    { id: 'blender', name: 'Blender Stage', scope: 'part', cardinality: 1, idPrefix: 'Blender' },
    { id: 'silver', name: 'Silver Rack', scope: 'part', cardinality: 1, idPrefix: 'Silver' },
    { id: 'shapers', name: 'Shapers & Envelopes', scope: 'part', cardinality: 1, idPrefix: 'Shaper' },
    { id: 'controllers', name: 'Free Controllers & MIDI', scope: 'part', cardinality: 1, idPrefix: '' },
    { id: 'master_fx', name: 'Master Spatial FX', scope: 'part', cardinality: 1, idPrefix: 'SoundMFX' }
  ];

  const specParams = [];

  for (const p of parameters) {
    const idx = p.index;
    const key = p.key;
    const grp = p.group;
    const min = p.min;
    const max = p.max;
    const def = p.default;
    const step = p.step;

    let type = 'continuous';
    let curve = 'Linear';
    let wireZeroCenter = undefined;
    let wireCodec = 'Value';

    if (min === 0 && max === 1 && step === 1) {
      type = 'boolean';
    } else if (min < 0 && max > 0) {
      type = 'bipolar';
      wireCodec = 'Bipolar';
      if (min === -64 && max === 63) {
        curve = 'SymBipolar';
        wireZeroCenter = 0;
      }
    } else if (step === 1 && (max - min) <= 12 && min >= 0) {
      type = 'choice';
      wireCodec = 'Enum';
    } else if (step === 1) {
      type = 'integer';
    }

    let unit = undefined;
    if (key.includes('Semi')) unit = 'st';
    else if (key.includes('Cents')) unit = 'cents';
    else if (key === 'SoundPan') unit = 'pan';
    else if (key.endsWith('Time') && (max >= 500)) unit = 'ms';
    else if (key.includes('Depth') || key.includes('KeyTrack') || key.includes('Slope')) unit = '%';
    else if (key.includes('Gain') || key === 'CR_Threshold') unit = 'dB';
    else if (key === 'PitchBendRange') unit = 'st';
    else if (key === 'LFORate' || key.includes('Freq')) unit = 'Hz';
    else if (key.includes('VelocitySwitch')) unit = 'velocity';
    else if (type === 'choice') unit = 'enum';
    else if (min === 0 && max === 127) unit = 'normalized';

    let scope = 'global';
    if (grp === 'R1' || grp === 'R2') scope = 'part';

    const entry = {
      id: key,
      name: key,
      group: grp,
      scope,
      type,
      min,
      max,
      default: def,
      curve,
      wire: 'Nrpn',
      wireCodec,
      nrpnMsb: idx >> 7,
      nrpnLsb: idx & 0x7F,
      sysex: true,
    };

    if (unit) entry.unit = unit;
    if (wireZeroCenter !== undefined) entry.wireZeroCenter = wireZeroCenter;

    if (ccByParamIndex.has(idx)) {
      entry.cc = ccByParamIndex.get(idx);
    }

    if (p.isModDest && p.modDestIdx >= 0) {
      entry.modDestId = p.modDestIdx;
    }

    const role = getSemanticRole(key);
    if (role) {
      entry.semanticRole = role;
    }

    if (p.isVstExposed && p.vstIndex >= 0) {
      entry.binaryPacking = {
        byteOffset: p.vstIndex * 4,
        bitMask: 255,
        bitShift: 0,
        byteSize: 4,
        encoding: 'Unsigned'
      };
    }

    specParams.push(entry);
  }

  const doc = {
    $schema: './parameter_dictionary.schema.json',
    schemaVersion: '2.0.0',
    id: 'hartmann_neuron',
    displayName: 'Hartmann Neuron / NeuronVS',
    topology: 'multi_part',
    totalParameters: 445,
    parts,
    parameters: specParams
  };

  return JSON.stringify(doc, null, 2) + '\n';
}

// =========================================================================
// Ejecución Principal & Manifiesto
// =========================================================================
const contentByClave = {
  registry_h: generateParameterRegistryHeader(),
  conversion_h: generateConversionHeader(),
  midi_h: generateMidiMappingHeader(),
  presets_h: generateFactoryPresetsHeader(),
  params_ts: generateParametersTs(),
  bridge_json: generateBridgeProtocolJson(),
  shared_spec: generateHartmannNeuronParameterSpec(),
};

let hasErrors = false;

for (const art of ARTEFACTOS) {
  const targetPath = path.join(rootDir, art.rel);
  const newContent = contentByClave[art.clave];

  if (CHECK_ONLY) {
    if (!fs.existsSync(targetPath)) {
      console.error(`[ERROR] Falta artefacto: ${art.rel}`);
      hasErrors = true;
    } else {
      const existing = fs.readFileSync(targetPath, 'utf8');
      if (existing !== newContent) {
        console.error(`[ERROR] Desincronizado: ${art.rel}`);
        hasErrors = true;
      } else {
        console.log(`[OK] Al dia: ${art.rel}`);
      }
    }
  } else {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, newContent, 'utf8');
    console.log(`[GENERADO] ${art.rel} (${art.desc})`);
  }
}

// =========================================================================
// Verificación complementaria: Source/DSP/AxionikParamIndices.h (ParamIdx)
// Debe cubrir exactamente los 445 índices del enum ParamID (sin faltantes,
// sin sobrantes, sin valores discrepantes ni duplicados).
// =========================================================================
function verifyParamIdxHeader() {
  const errors = [];
  const headerPath = path.join(rootDir, 'Source', 'DSP', 'AxionikParamIndices.h');
  if (!fs.existsSync(headerPath)) {
    errors.push('Falta Source/DSP/AxionikParamIndices.h');
    return errors;
  }

  const reg = fs.readFileSync(path.join(rootDir, 'Source', 'Generated', 'ParameterRegistry.gen.h'), 'utf8');
  const enumBlock = (reg.match(/enum class ParamID[\s\S]*?\n};/) || [''])[0];
  const params = [...enumBlock.matchAll(/([A-Za-z0-9_]+) = (\d+)/g)].map(m => ({ name: m[1], val: +m[2] }));

  const hdr = fs.readFileSync(headerPath, 'utf8');
  const entries = [...hdr.matchAll(/uint32_t\s+([A-Za-z0-9_]+)\s*=\s*(\d+)\s*;/g)].map(m => ({ name: m[1], val: +m[2] }));
  const byName = new Map(entries.map(e => [e.name, e.val]));

  for (const p of params) {
    if (!byName.has(p.name)) errors.push(`ParamIdx: falta ${p.name} (= ${p.val})`);
    else if (byName.get(p.name) !== p.val) errors.push(`ParamIdx: ${p.name} discrepante (header=${byName.get(p.name)}, registry=${p.val})`);
  }
  const registryNames = new Set(params.map(p => p.name));
  for (const e of entries) {
    if (!registryNames.has(e.name)) errors.push(`ParamIdx: sobra ${e.name} (= ${e.val})`);
  }
  const seenVal = new Map();
  for (const e of entries) {
    if (seenVal.has(e.val)) errors.push(`ParamIdx: valor ${e.val} duplicado (${seenVal.get(e.val)} y ${e.name})`);
    else seenVal.set(e.val, e.name);
  }
  return errors;
}

// Verificación de SlotIdx: cobertura exacta del mapa slot<->param de
// DOCS/reverse_engineering/dsp/params_observers_map.csv (columna slot_in_p),
// mas ausencia de literales numéricos de slot en el código DSP escrito a mano.
function verifySlotIdxHeader() {
  const errors = [];
  const headerPath = path.join(rootDir, 'Source', 'DSP', 'AxionikParamIndices.h');
  if (!fs.existsSync(headerPath)) {
    errors.push('Falta Source/DSP/AxionikParamIndices.h');
    return errors;
  }

  // Mapa canónico slot -> key desde el CSV
  const csvPath = path.join(rootDir, 'DOCS', 'reverse_engineering', 'dsp', 'params_observers_map.csv');
  const csvLines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const hdrCols = csvLines[0].split(',');
  const iSlot = hdrCols.indexOf('slot_in_p');
  const iKey = hdrCols.indexOf('snddat_key');
  const slotToKey = new Map();
  for (const line of csvLines.slice(1)) {
    const c = line.split(',');
    const s = +c[iSlot];
    if (s >= 0) slotToKey.set(s, c[iKey]);
  }

  const hdr = fs.readFileSync(headerPath, 'utf8');
  const block = (hdr.match(/namespace SlotIdx \{[\s\S]*?\} \/\/ namespace SlotIdx/) || [''])[0];
  const entries = [...block.matchAll(/inline constexpr size_t\s+([A-Za-z0-9_]+)\s*=\s*(\d+)\s*;/g)]
    .map(m => ({ name: m[1], val: +m[2] }));
  const bySlot = new Map(entries.map(e => [e.val, e.name]));
  const byName = new Map(entries.map(e => [e.name, e.val]));

  for (const [s, k] of slotToKey) {
    if (!bySlot.has(s)) errors.push(`SlotIdx: falta el slot ${s} (${k})`);
    else if (bySlot.get(s) !== k) errors.push(`SlotIdx: slot ${s} discrepante (header=${bySlot.get(s)}, csv=${k})`);
  }
  for (const e of entries) {
    const canon = slotToKey.get(e.val);
    if (canon === undefined) errors.push(`SlotIdx: sobra ${e.name} (slot ${e.val} sin clave en el CSV)`);
    else if (canon !== e.name) errors.push(`SlotIdx: ${e.name} = ${e.val} pero el CSV dice ${canon}`);
    if (!byName.has(e.name)) errors.push(`SlotIdx: clave interna inválida ${e.name}`);
  }

  // Lint: ningun literal numerico de slot en el código DSP escrito a mano
  const dspDir = path.join(rootDir, 'Source', 'DSP');
  for (const f of fs.readdirSync(dspDir)) {
    if (!/\.(h|cpp)$/.test(f)) continue;
    const lines = fs.readFileSync(path.join(dspDir, f), 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, ''); // ignora comentarios de linea
      if (/getSlot(?:Raw|Norm)\(\s*p\s*,\s*(?:0x[0-9a-fA-F]+|\d)/.test(code)) {
        errors.push(`${f}:${i + 1}: literal de slot en getSlot (usa SlotIdx::)`);
      }
      if (/\bp\s*\[\s*(?:0x[0-9a-fA-F]+|\d+)\s*\]/.test(code)) {
        errors.push(`${f}:${i + 1}: literal p[N] crudo, decimal o hex (usa SlotIdx::)`);
      }
    });
  }
  return errors;
}

const paramIdxErrors = verifyParamIdxHeader();
if (paramIdxErrors.length) {
  for (const e of paramIdxErrors) console.error(`[ERROR] ${e}`);
  hasErrors = true;
} else {
  console.log('[OK] Al dia: Source/DSP/AxionikParamIndices.h (445/445 ParamIdx)');
}

const slotIdxErrors = verifySlotIdxHeader();
if (slotIdxErrors.length) {
  for (const e of slotIdxErrors) console.error(`[ERROR] ${e}`);
  hasErrors = true;
} else {
  console.log('[OK] Al dia: Source/DSP/AxionikParamIndices.h SlotIdx (317 slots, sin literales crudos)');
}

if (CHECK_ONLY && hasErrors) {
  process.exit(1);
}

console.log(`\nGeneración completada: ${ARTEFACTOS.length} artefactos emitidos con éxito.`);
