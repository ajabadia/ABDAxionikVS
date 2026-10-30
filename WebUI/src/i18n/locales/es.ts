/**
 * ABDAxionikVS — es.ts
 * Diccionario Específico de Sintetizador (Tier-2) en Español (Extiende @abdsynths/shared SHARED_ES).
 *
 * Regla de Arquitectura (Estándar i18n en 2 Capas):
 * - Los términos transversales (common.*, navbar.* estándar, midiLearn.*, etc.)
 *   residen en @abdsynths/shared (`SHARED_ES`).
 * - Este archivo contiene ÚNICAMENTE la terminología propia de Hartmann Neuron / ABDAxionikVS,
 *   fusionada automáticamente mediante `deepMergeLocales(SHARED_ES, axionikEs)`.
 * - Los acrónimos universales de síntesis y letras sueltas (A, D, S, R, LFO,
 *   CUTOFF, RESO, Scape, Sphere, Blender, Slicer, MIDI, CC, NRPN, SysEx) NO se traducen.
 */

import { SHARED_ES, deepMergeLocales } from '@abdsynths/shared/i18n';
import type { Translations } from './en.js';

export const axionikEs: typeof import('./en.js').axionikEn = {
  navbar: {
    // Axionik-specific File menu items
    configureFolder: 'Configurar Carpeta NeuronDB...',
    importModelFolder: 'Importar Carpeta de Modelos (<NNN>.model)...',
    importModelZip: 'Importar Paquete de Modelos (.zip)...',

    // Axionik-specific Edit menu items
    bankBrowser: 'Navegador de Bancos NeuronDB...',
    nukeRemote: 'Unidad de Control Remoto NUKE...',
    matrixMod: 'Matriz de Modulación de Controladores Libres (6x5)...',
    hardwareSysEx: 'Volcados SysEx Hardware (Sonido Actual / Todos / SetUps / Modelos)...',
    dspCalibration: 'Calibración DSP y Números Mágicos (43 Parámetros)...',
    effectsRack: 'Rack de Efectos (Silver y Master)...',

    // Axionik-specific Help menu items
    manual: 'Guía de Arquitectura Hartmann Neuron...',
    about: 'Acerca de ABDAxionikVS...',

    // Axionik-specific HUD tooltips & short labels
    btnNukeTitle: 'Unidad de Control Remoto NUKE (Ctrl+K)',
    btnMatrixTitle: 'Matriz de Modulación 6x5 (Ctrl+M)',
    btnEffectsTitle: 'Rack de Efectos (Silver y Master) (Ctrl+F)',
    btnNeuronDbTitle: 'Navegador de Bancos NeuronDB (Ctrl+B)',
    nuke: 'NUKE',
    neuronDb: 'NeuronDB',

    // Axionik About Dialog
    aboutTitle: 'ABDAxionikVS',
    aboutSubtitle: 'Sintetizador Virtual Fiel al Hartmann Neuron / NeuronVS',
    aboutBuildInfo: 'Núcleo DSP Neuron C++20 + Arquitectura WebAssembly + WebView2',
  },

  settings: {
    oracleCard: 'COMPORTAMIENTO DE RECORTE CLIP-TO-ZERO (0x1000bc40 DESCOMPILADO)',
    oracleDesc:
      'Alterna entre la saturación hiperbólica suave moderna (espacio musical limpio) y el algoritmo histórico binario de recorte a cero de NeuronVS.dll (que introduce armónicos impares al saturar).',
    oracleModeModern: 'Saturación Musical (Moderna)',
    oracleModeLegacy: 'Recorte a Cero Histórico (NeuronVS.dll)',
    libraryCard: 'RUTA DE LA BIBLIOTECA NEURONDB',
    libraryDesc: 'Directorio con modelos de fábrica (carpetas .model) y presets de sonido (.sound, .script).',
    configureFolderBtn: 'Configurar Carpeta...',
    fsOptions: {
      sustain: '0: Sustain (Pedal apagador)',
      hold: '1: Mantener Notas Activas',
      slicer: '2: Activar / Desactivar LFO Slicer',
      silver: '3: Activar / Desactivar Rack Silver',
      stick: '4: Iniciar / Detener Reproducción Stick',
      tapTempo: '5: Sincronización Tap Tempo',
    },
  },

  nuke: {
    drawerTitle: 'UNIDAD DE CONTROL REMOTO NUKE',
    voiceLimit: 'Límite de Voces',
    resynator1: 'RESY 1',
    resynator2: 'RESY 2',
    silver: 'SILVER',
    stickDomainSphere: 'SPHERE',
    stickDomainScape: 'SCAPE',
    macroKnobs: 'CONTROLES MACRO',
    macro1: 'Macro 1',
    macro2: 'Macro 2',
    macro3: 'Macro 3',
    macro4: 'Macro 4',
    controllersTitle: 'CONTROLADORES FÍSICOS DE EXPRESIÓN',
    aftertouch: 'Aftertouch',
    modulation: 'Modulation',
    breath: 'Breath',
    cc03: 'CC 03',
    foot: 'Foot',
    expression: 'Expression',
    destination: 'Dest:',
    depth: 'Profundidad:',
  },

  calibration: {
    resetAllTitle: 'Restaurar los 43 números mágicos a sus constantes originales de NeuronVS',
    sourceRefTitle: 'Referencia en código C++ / binario NeuronVS',
    catGeneral: 'GENERAL Y MOTOR',
    catResynator: 'RESYNATOR (SCAPE Y SPHERE)',
    catBlender: 'BLENDER Y SLICER',
    catShapers: 'SHAPERS Y ENVOLVENTES',
    catSilverFilter: 'SILVER FILTRO',
    catSilverMasterFx: 'SILVER Y EFECTOS MASTER',
  },

  hardwareDumps: {
    portDesc: 'Conexión MIDI IN/OUT bidireccional con el hardware Hartmann Neuron (Modelo 0x01)',
    modeCurrentSound: 'Sonido Actual (0x10)',
    modeAllSounds: 'Todos los Sonidos (0x20)',
    modeAllSetUps: 'Todos los SetUps (0x30)',
    modeAllModels: 'Todos los Modelos (0x40)',
    waitingData: 'Esperando transmisión SysEx del Hartmann Neuron...',
  },

  bank: {
    drawerTitle: 'NAVEGADOR NEURONDB',
    searchPlaceholder: 'Buscar presets y modelos...',
    categoryAll: 'Todas las Categorías',
    modelsTab: 'Modelos',
    presetsTab: 'Presets',
    loadModelToR1: 'Cargar en Resynator 1',
    loadModelToR2: 'Cargar en Resynator 2',
  },

  matrix: {
    drawerTitle: 'MATRIZ DE MODULACIÓN (6x5)',
    controllersSubtitle: 'Controladores Libres a Destinos del Motor',
  },

  effects: {
    drawerTitle: 'RACK DE EFECTOS',
    silverFxTitle: 'PROCESADOR DE EFECTOS SILVER',
    masterFxTitle: 'ETAPA DE EFECTOS MASTER',
  },
};

export const es: Translations = deepMergeLocales(SHARED_ES, axionikEs);
