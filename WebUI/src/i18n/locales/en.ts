/**
 * ABDAxionikVS — en.ts
 * Tier-2 Synthesizer-Specific English Dictionary (Extends @abdsynths/shared SHARED_EN).
 *
 * Architectural Rule (2-Tier i18n Standard):
 * - Common UI terms (common.*, standard navbar.*, midiLearn.*, etc.) live in
 *   @abdsynths/shared (`SHARED_EN`).
 * - This file contains ONLY Hartmann Neuron / ABDAxionikVS specific terminology
 *   and overrides, merged automatically via `deepMergeLocales(SHARED_EN, axionikEn)`.
 * - Universal synth acronyms and single-letter descriptors (A, D, S, R, LFO,
 *   CUTOFF, RESO, Scape, Sphere, Blender, Slicer, MIDI, CC, NRPN, SysEx) MUST NOT be translated.
 */

import { SHARED_EN, deepMergeLocales } from '@abdsynths/shared/i18n';

export const axionikEn = {
  navbar: {
    // Axionik-specific File menu items
    configureFolder: 'Configure NeuronDB Library Folder...',
    importModelFolder: 'Import Model Folder (<NNN>.model)...',
    importModelZip: 'Import Model Package (.zip)...',

    // Axionik-specific Edit menu items
    bankBrowser: 'NeuronDB Bank Browser...',
    nukeRemote: 'NUKE Remote Control Unit...',
    matrixMod: 'Free Controllers Modulation Matrix (6x5)...',
    hardwareSysEx: 'Hardware SysEx Dumps (Current / All Sounds / All SetUps / All Models)...',
    dspCalibration: 'DSP Calibration & Magic Numbers (43 Parameters)...',
    effectsRack: 'Effects Rack (Silver & Master)...',

    // Axionik-specific Help menu items
    manual: 'Hartmann Neuron Architecture Guide...',
    about: 'About ABDAxionikVS...',

    // Axionik-specific HUD tooltips & short labels
    btnNukeTitle: 'NUKE Remote Control Unit (Ctrl+K)',
    btnMatrixTitle: 'Modulation Matrix 6x5 (Ctrl+M)',
    btnEffectsTitle: 'Effects Rack (Silver & Master) (Ctrl+F)',
    btnNeuronDbTitle: 'NeuronDB Bank Browser (Ctrl+B)',
    nuke: 'NUKE',
    neuronDb: 'NeuronDB',

    // Engine Mode Selector (Header HUD: Classic / Plus / Extended)
    engineModeLabel: 'MODE:',
    modeClassic: 'CLASSIC',
    modePlus: 'PLUS',
    modeExtended: 'EXTENDED',
    modeClassicTitle:
      'CLASSIC Mode (Active): 100% faithful Hartmann Neuron / NeuronVS engine (.scape + .sphere, 7 Parset engines, Silver Filter & FX, 10 Blender modes).',
    modePlusTitle:
      'PLUS Mode (Pending): Classic Resynator 1 & 2 (.scape/.sphere) + Independent Filter v2 & Expanded FX v2 chain. Disabled until new filters and effects are finalized.',
    modeExtendedTitle:
      'EXTENDED Mode (Pending): Proprietary Resynator v2 (Unified Spectral Surface HD, Sonic Matter Shapers, Hybrid 96kHz PCM Transient, TempoSync REX, Quad 4.0) + Filter v2 & FX v2. Disabled while testing Resynator v2.',

    // Axionik About Dialog
    aboutTitle: 'ABDAxionikVS',
    aboutSubtitle: 'Hartmann Neuron / NeuronVS Faithful Modern Virtual Synthesizer',
    aboutBuildInfo: 'Neuron DSP Core C++20 + WebAssembly + WebView2 Architecture',
  },

  settings: {
    oracleCard: 'ORACLE CLIP-TO-ZERO BEHAVIOR (DECOMPILED 0x1000bc40)',
    oracleDesc:
      'Toggles between modern smooth hyperbolic saturation (clean musical headroom) and the historical binary clip-to-zero algorithm from NeuronVS.dll (which introduces odd harmonics when driven hard).',
    oracleModeModern: 'Musical Saturation (Modern)',
    oracleModeLegacy: 'Historic Clip-to-Zero (NeuronVS.dll)',
    libraryCard: 'NEURONDB LIBRARY PATH',
    libraryDesc: 'Directory containing factory models (.model folders) and sound presets (.sound, .script).',
    configureFolderBtn: 'Configure Folder...',
    fsOptions: {
      sustain: '0: Sustain (Damper Pedal)',
      hold: '1: Hold Active Notes',
      slicer: '2: Slicer LFO On / Off',
      silver: '3: Silver Rack On / Off',
      stick: '4: Stick Playback Start / Stop',
      tapTempo: '5: Tap Tempo Sync',
    },
  },

  nuke: {
    drawerTitle: 'NUKE REMOTE CONTROL UNIT',
    voiceLimit: 'Voice Limit',
    resynator1: 'RESY 1',
    resynator2: 'RESY 2',
    silver: 'SILVER',
    stickDomainSphere: 'SPHERE',
    stickDomainScape: 'SCAPE',
    macroKnobs: 'MACRO CONTROLS',
    macro1: 'Macro 1',
    macro2: 'Macro 2',
    macro3: 'Macro 3',
    macro4: 'Macro 4',
    controllersTitle: 'PHYSICAL PERFORMANCE CONTROLLERS',
    aftertouch: 'Aftertouch',
    modulation: 'Modulation',
    breath: 'Breath',
    cc03: 'CC 03',
    foot: 'Foot',
    expression: 'Expression',
    destination: 'Dest:',
    depth: 'Depth:',
  },

  calibration: {
    resetAllTitle: 'Restore all 43 magic numbers to their original NeuronVS factory constants',
    sourceRefTitle: 'Source in C++ code / NeuronVS binary',
    catGeneral: 'GENERAL & ENGINE',
    catResynator: 'RESYNATOR (SCAPE & SPHERE)',
    catBlender: 'BLENDER & SLICER',
    catShapers: 'SHAPERS & ENVELOPES',
    catSilverFilter: 'SILVER FILTER',
    catSilverMasterFx: 'SILVER & MASTER FX',
  },

  hardwareDumps: {
    portDesc: 'Bidirectional MIDI IN/OUT connection to Hartmann Neuron Hardware (Model 0x01)',
    modeCurrentSound: 'Current Sound (0x10)',
    modeAllSounds: 'All Sounds (0x20)',
    modeAllSetUps: 'All SetUps (0x30)',
    modeAllModels: 'All Models (0x40)',
    waitingData: 'Waiting for SysEx transmission from Hartmann Neuron...',
  },

  bank: {
    drawerTitle: 'NEURONDB BROWSER',
    searchPlaceholder: 'Search presets and models...',
    categoryAll: 'All Categories',
    modelsTab: 'Models',
    presetsTab: 'Presets',
    loadModelToR1: 'Load into Resynator 1',
    loadModelToR2: 'Load into Resynator 2',
    loadPreset: 'Load Preset',
  },

  matrix: {
    drawerTitle: 'MODULATION MATRIX (6x5)',
    controllersSubtitle: 'Free Controllers to Engine Destinations',
  },

  effects: {
    drawerTitle: 'EFFECTS RACK',
    silverFxTitle: 'SILVER FX PROCESSOR',
    masterFxTitle: 'MASTER EFFECTS STAGE',
  },
};

export const en = deepMergeLocales(SHARED_EN, axionikEn);
export type Translations = typeof en;
