/**
 * ABDAxionikVS — calibrationContracts.ts
 * Canonical registry of DSP Calibration parameters ("Magic Numbers") extracted
 * from NeuronVS.dll / Mac v1.56 into Source/DSP/AxionikCalibrationConfig.h.
 * Inspired by and improved from the ABDJUNiO601 calibration system.
 *
 * Includes bilingual metadata (English default `description` + Spanish `descriptionEs`)
 * and UI dictionary (`CALIBRATION_I18N`) ready for the multi-language (i18n) system.
 */

import { WebBridge } from '../bridge/WebBridge';

export type CalibrationLocale = 'en' | 'es';

export type CalibrationCategory =
  | 'GENERAL & ENGINE'
  | 'RESYNATOR (SCAPE & SPHERE)'
  | 'BLENDER & SLICER'
  | 'SHAPERS & ENVELOPES'
  | 'SILVER FILTER'
  | 'SILVER & MASTER FX';

export const CALIBRATION_CATEGORIES: readonly CalibrationCategory[] = [
  'GENERAL & ENGINE',
  'RESYNATOR (SCAPE & SPHERE)',
  'BLENDER & SLICER',
  'SHAPERS & ENVELOPES',
  'SILVER FILTER',
  'SILVER & MASTER FX',
] as const;

export interface CalibrationParamDescriptor {
  id: string;
  label: string;
  category: CalibrationCategory;
  unit: string;
  /** Default English explanation displayed in the UI */
  description: string;
  /** Spanish explanation preserved for the upcoming i18n multi-language system */
  descriptionEs: string;
  sourceRef: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  stepSize: number;
  isInteger?: boolean;
}

export const CALIBRATION_I18N = {
  en: {
    drawerTitle: 'DSP CALIBRATION & MAGIC NUMBERS',
    searchPlaceholder: 'Search magic number by name, ID, description or C++ reference...',
    modifiedBtn: 'MODIFIED',
    modifiedBtnTitle: 'Show only parameters that have been modified from their factory default value',
    loadJsonBtn: 'LOAD JSON',
    loadJsonTitle: 'Load calibration configuration from a JSON file',
    exportJsonBtn: 'EXPORT JSON',
    exportJsonTitle: 'Export all current calibration values to a JSON file',
    resetAllBtn: 'RESET ALL',
    resetAllTitle: 'Restore all 43 magic numbers to their original NeuronVS factory constants',
    allTab: 'ALL',
    valuesUnit: 'values',
    modShort: 'mod',
    resetGroupBtn: 'Reset Group',
    resetGroupTitle: (cat: string) => `Restore all values in ${cat} to their factory defaults`,
    resetSingleTitle: (defVal: string, unit: string) => `Restore to factory default (${defVal} ${unit})`,
    sliderDblClickTitle: (defVal: string, unit: string) => `Double-click to restore to factory default (${defVal} ${unit})`,
    defaultTickTitle: (defVal: string, unit: string) => `Original factory default: ${defVal} ${unit}`,
    sourceRefTitle: 'Source in C++ code / NeuronVS binary',
    minLabel: 'Min',
    defLabel: 'Default',
    maxLabel: 'Max',
    emptyTitle: 'No calibration parameters found',
    emptySub: 'Try clearing the search filter or disabling "MODIFIED".',
    statusImportedOk: (count: number) => `JSON imported successfully: ${count} parameters applied to the DSP engine.`,
    statusImportError: (details: string) => `Error importing JSON: ${details || 'No valid parameters found.'}`,
    statusResetAllOk: 'All 43 magic numbers have been restored to their original factory values.',
    statusResetSingle: (label: string, id: string, val: string, unit: string) =>
      `Restored "${label}" (${id}) to its default value: ${val} ${unit}.`,
    statusResetGroup: (cat: string) => `Category "${cat}" restored to factory defaults.`,
    statusExportedOk: (filename: string, count: number) =>
      `Configuration exported to "${filename}" (${count} parameters).`,
  },
  es: {
    drawerTitle: 'CALIBRACIÓN DSP Y VALORES MÁGICOS',
    searchPlaceholder: 'Buscar valor mágico por nombre, ID, descripción o referencia C++...',
    modifiedBtn: 'MODIFICADOS',
    modifiedBtnTitle: 'Mostrar únicamente los parámetros que han sido modificados respecto a su valor de fábrica',
    loadJsonBtn: 'CARGAR JSON',
    loadJsonTitle: 'Cargar configuración de calibración desde un fichero JSON',
    exportJsonBtn: 'EXPORTAR JSON',
    exportJsonTitle: 'Exportar todos los valores de calibración actuales a un fichero JSON',
    resetAllBtn: 'RESETEAR TODO',
    resetAllTitle: 'Restaurar los 43 valores mágicos a sus constantes originales de NeuronVS',
    allTab: 'TODAS',
    valuesUnit: 'valores',
    modShort: 'mod',
    resetGroupBtn: 'Resetear Grupo',
    resetGroupTitle: (cat: string) => `Restaurar todos los valores de ${cat} a su valor por defecto`,
    resetSingleTitle: (defVal: string, unit: string) => `Restaurar al valor por defecto (${defVal} ${unit})`,
    sliderDblClickTitle: (defVal: string, unit: string) => `Doble clic para restaurar al valor por defecto (${defVal} ${unit})`,
    defaultTickTitle: (defVal: string, unit: string) => `Valor original por defecto: ${defVal} ${unit}`,
    sourceRefTitle: 'Origen en código C++ / binario NeuronVS',
    minLabel: 'Mín',
    defLabel: 'Defecto',
    maxLabel: 'Máx',
    emptyTitle: 'No se encontraron parámetros de calibración',
    emptySub: 'Prueba a limpiar el filtro de búsqueda o desactivar "MODIFICADOS".',
    statusImportedOk: (count: number) => `JSON importado correctamente: ${count} parámetros aplicados al motor DSP.`,
    statusImportError: (details: string) => `Error al importar JSON: ${details || 'Sin parámetros válidos.'}`,
    statusResetAllOk: 'Todos los 43 valores mágicos han sido restaurados a sus valores originales de fábrica.',
    statusResetSingle: (label: string, id: string, val: string, unit: string) =>
      `Restaurado "${label}" (${id}) a su valor original: ${val} ${unit}.`,
    statusResetGroup: (cat: string) => `Categoría "${cat}" restaurada a sus valores de fábrica.`,
    statusExportedOk: (filename: string, count: number) =>
      `Configuración exportada a "${filename}" (${count} parámetros).`,
  },
} as const;

export const CALIBRATION_STORAGE_KEY = 'abd.axionik.calibration.v1';

/**
 * Complete catalog of 43 magic numbers of the ABDAxionikVS DSP engine.
 */
export const CALIBRATION_REGISTRY: readonly CalibrationParamDescriptor[] = [
  // =========================================================================
  // 1. GENERAL & ENGINE
  // =========================================================================
  {
    id: 'masterVolume',
    label: 'Master Output Gain',
    category: 'GENERAL & ENGINE',
    unit: 'x',
    description:
      'Pre-limiter master output gain. Adjusts the global nominal output level to preserve headroom and NeuronVS parity.',
    descriptionEs:
      'Ganancia maestra de salida previa al limitador final del motor. Ajusta el nivel nominal de salida global para preservar el margen dinámico de paridad con NeuronVS.',
    sourceRef: 'DspEngineFacade.h:176',
    defaultValue: 0.85,
    minValue: 0.1,
    maxValue: 2.0,
    stepSize: 0.01,
  },
  {
    id: 'antiPopRampMs',
    label: 'Anti-Pop Crossfade Ramp',
    category: 'GENERAL & ENGINE',
    unit: 'ms',
    description:
      'Linear anti-click fade-in ramp duration when switching presets or neural models (Stephan Bernsee Mac v1.56 fix).',
    descriptionEs:
      'Tiempo de rampa lineal anti-clicks al cambiar de preset o modelo neuronal (corrección de la versión Mac v1.56 de Stephan Bernsee).',
    sourceRef: 'DspTypes.h:18',
    defaultValue: 2.0,
    minValue: 0.0,
    maxValue: 25.0,
    stepSize: 0.5,
  },
  {
    id: 'a4ReferenceHz',
    label: 'Master A4 Tuning Reference',
    category: 'GENERAL & ENGINE',
    unit: 'Hz',
    description:
      'Reference frequency for MIDI note 69 (A4) used when computing the phase increment across all polyphonic voices.',
    descriptionEs:
      'Frecuencia de referencia para la nota MIDI 69 (La4) en el cálculo de paso de fase de todas las voces polifónicas.',
    sourceRef: 'NeuronVoice.h:58',
    defaultValue: 440.0,
    minValue: 415.0,
    maxValue: 466.0,
    stepSize: 0.5,
  },
  {
    id: 'maxPolyphonyVoices',
    label: 'Max Active Polyphony',
    category: 'GENERAL & ENGINE',
    unit: 'voices',
    description:
      'Maximum ceiling of simultaneous active voices before applying oldest-note voice stealing.',
    descriptionEs:
      'Techo máximo de voces simultáneas activas antes de aplicar robo de voz (voice stealing) a la nota más antigua.',
    sourceRef: 'DspEngineFacade.cpp:185',
    defaultValue: 12,
    minValue: 1,
    maxValue: 16,
    stepSize: 1,
    isInteger: true,
  },
  {
    id: 'oracleClipToZeroMode',
    label: 'Oracle Clip-To-Zero Mode',
    category: 'GENERAL & ENGINE',
    unit: 'mode',
    description:
      'Output bus clipping mode: 0 = musical clean clamp [-1..+1], 1 = legacy 0x1000bc40 behavior (zeros out samples exceeding +/-1.0).',
    descriptionEs:
      'Modo de recorte del bus de salida: 0 = saturación limpia [-1..+1], 1 = comportamiento legado 0x1000bc40 (anula a 0.0 las muestras que superan el umbral).',
    sourceRef: 'NeuronBlockPump.h:103',
    defaultValue: 0,
    minValue: 0,
    maxValue: 1,
    stepSize: 1,
    isInteger: true,
  },
  {
    id: 'lfoMinRateHz',
    label: 'Global LFO Min Frequency',
    category: 'GENERAL & ENGINE',
    unit: 'Hz',
    description:
      'Minimum oscillation frequency when the Global LFO Rate control is set to minimum (0).',
    descriptionEs:
      'Frecuencia mínima de oscilación cuando el control de velocidad (Rate) del LFO global está al mínimo (0).',
    sourceRef: 'DspEngineFacade.cpp:215',
    defaultValue: 0.05,
    minValue: 0.01,
    maxValue: 1.0,
    stepSize: 0.01,
  },
  {
    id: 'lfoMaxRateSpanHz',
    label: 'Global LFO Max Frequency Span',
    category: 'GENERAL & ENGINE',
    unit: 'Hz',
    description:
      'Maximum frequency excursion range of the Global LFO when the Rate control is at maximum.',
    descriptionEs:
      'Rango máximo de excursión de frecuencia del LFO global cuando el control Rate está al máximo.',
    sourceRef: 'DspEngineFacade.cpp:215',
    defaultValue: 24.95,
    minValue: 5.0,
    maxValue: 80.0,
    stepSize: 0.05,
  },

  // =========================================================================
  // 2. RESYNATOR (SCAPE & SPHERE)
  // =========================================================================
  {
    id: 'scapeCycleSamples',
    label: 'Scape Canonical Cycle Length',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'smp',
    description:
      'Canonical number of samples per base cycle of the Scape neural oscillator when converting note frequency to phase step.',
    descriptionEs:
      'Número canónico de muestras por ciclo base del oscilador neuronal Scape al convertir frecuencia en paso de fase.',
    sourceRef: 'NeuronVoice.h:60',
    defaultValue: 100.0,
    minValue: 25.0,
    maxValue: 400.0,
    stepSize: 1.0,
  },
  {
    id: 'scapeMinPeakFloor',
    label: 'Scape Peak Normalization Floor',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'int16',
    description:
      'Minimum dynamic peak normalization floor for 16-bit .scape wavetables. Prevents +36 dB over-modulation on low-amplitude models such as #511.',
    descriptionEs:
      'Piso mínimo de normalización dinámica de pico para muestras .scape en entero de 16 bits. Evita la sobremodulación de +36 dB en modelos de baja amplitud como el #511.',
    sourceRef: 'NeuronOscillators.h:119',
    defaultValue: 1500.0,
    minValue: 200.0,
    maxValue: 16384.0,
    stepSize: 50.0,
  },
  {
    id: 'scapeHfEmphasis',
    label: 'Scape HF Differentiator Gain',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'x',
    description:
      'First-order high-frequency emphasis differentiator coefficient in the Scape oscillator ((val - prev) * gain + val).',
    descriptionEs:
      'Coeficiente del filtro diferenciador de primer orden de énfasis de altas frecuencias canónico del Scape ((val - prev) * gain + val).',
    sourceRef: 'NeuronOscillators.h:188 (FUN_100317b0)',
    defaultValue: 2.0,
    minValue: 0.0,
    maxValue: 4.0,
    stepSize: 0.05,
  },
  {
    id: 'sphereGainMin',
    label: 'Sphere Formant Min Gain',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'x',
    description:
      'Lower formant gain bound per band in the Sphere spectral processor after bilinear X/Y interpolation.',
    descriptionEs:
      'Límite inferior de ganancia formántica por banda del procesador espectral Sphere tras la interpolación bilineal X/Y.',
    sourceRef: 'NeuronOscillators.h:312 (FUN_10031950)',
    defaultValue: 0.15,
    minValue: 0.0,
    maxValue: 0.8,
    stepSize: 0.01,
  },
  {
    id: 'sphereGainMax',
    label: 'Sphere Formant Max Gain',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'x',
    description:
      'Upper formant gain bound per band in the Sphere spectral processor to prevent resonant overload.',
    descriptionEs:
      'Límite superior de ganancia formántica por banda del procesador espectral Sphere para proteger contra saturación resonante.',
    sourceRef: 'NeuronOscillators.h:312 (FUN_10031950)',
    defaultValue: 1.25,
    minValue: 0.5,
    maxValue: 3.0,
    stepSize: 0.05,
  },
  {
    id: 'sphereBodyGainScale',
    label: 'Sphere 1024-Partial Body Scale',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'x',
    description:
      'Gain scaling factor applied when synthesizing the 1024-partial additive Sphere body table.',
    descriptionEs:
      'Factor de escala de ganancia aplicado al sintetizar la tabla de cuerpo aditivo de 1024 parciales de Sphere.',
    sourceRef: 'NeuronOscillators.h:376 (FUN_1002e750)',
    defaultValue: 0.5,
    minValue: 0.0,
    maxValue: 2.0,
    stepSize: 0.05,
  },
  {
    id: 'scapeBodyMixRatio',
    label: 'Sphere Additive Body Mix Ratio',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'ratio',
    description:
      'Mix ratio between the additive Sphere body table and the Scape waveform per layer (0.10 = 90% Scape + 10% Body).',
    descriptionEs:
      'Proporción de mezcla entre la tabla de cuerpo aditivo Sphere y la onda Scape en cada capa (0.10 = 90% Scape + 10% Body).',
    sourceRef: 'NeuronOscillators.h:491',
    defaultValue: 0.1,
    minValue: 0.0,
    maxValue: 0.5,
    stepSize: 0.01,
  },
  {
    id: 'parsetExcitationScale',
    label: 'Parset 3-Layer Excitation Scale',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'x',
    description:
      'Headroom scaling factor when summing the 3 layers (L1+L2+L3) before feeding the Parset resonator engine.',
    descriptionEs:
      'Factor de headroom al sumar la excitación de las 3 capas (L1+L2+L3) antes de alimentar el motor resonador Parset.',
    sourceRef: 'NeuronOscillators.h:1015 (FUN_1002e7a0)',
    defaultValue: 0.65,
    minValue: 0.15,
    maxValue: 1.5,
    stepSize: 0.05,
  },
  {
    id: 'layer2BaseLevel',
    label: 'Resynator Layer 2 Base Level',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'x',
    description:
      'Relative base gain level for the second harmonic layer (L2) in each Resynator (R1 and R2).',
    descriptionEs:
      'Nivel de ganancia base relativo de la segunda capa armónica (L2) en cada Resynator (R1 y R2).',
    sourceRef: 'DspEngineFacade.cpp:252',
    defaultValue: 0.85,
    minValue: 0.0,
    maxValue: 1.5,
    stepSize: 0.05,
  },
  {
    id: 'layer3BaseLevel',
    label: 'Resynator Layer 3 Base Level',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'x',
    description:
      'Relative base gain level for the third harmonic layer (L3) in each Resynator (R1 and R2).',
    descriptionEs:
      'Nivel de ganancia base relativo de la tercera capa armónica (L3) en cada Resynator (R1 y R2).',
    sourceRef: 'DspEngineFacade.cpp:259',
    defaultValue: 0.7,
    minValue: 0.0,
    maxValue: 1.5,
    stepSize: 0.05,
  },
  {
    id: 'modelSizeOffsetCents',
    label: 'Model Size Pitch Offset Span',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'cents',
    description:
      'Maximum pitch shift in cents induced by the ModelSizeOffset parameter ([32] / [112]).',
    descriptionEs:
      'Desplazamiento máximo de afinación en cents inducido por el parámetro ModelSizeOffset ([32] / [112]).',
    sourceRef: 'DspEngineFacade.cpp:298',
    defaultValue: 50.0,
    minValue: 0.0,
    maxValue: 200.0,
    stepSize: 5.0,
  },
  {
    id: 'pitchLfoMaxCents',
    label: 'Pitch LFO Vibrato Max Depth',
    category: 'RESYNATOR (SCAPE & SPHERE)',
    unit: 'cents',
    description:
      'Maximum vibrato depth in cents when the Global LFO modulates R1 or R2 pitch.',
    descriptionEs:
      'Profundidad máxima de vibrato en cents cuando el LFO global modula la afinación de R1 o R2.',
    sourceRef: 'DspEngineFacade.cpp:297',
    defaultValue: 100.0,
    minValue: 10.0,
    maxValue: 600.0,
    stepSize: 5.0,
  },

  // =========================================================================
  // 3. BLENDER & SLICER
  // =========================================================================
  {
    id: 'crossmorphIntermodGain',
    label: 'Crossmorph Intermod Gain',
    category: 'BLENDER & SLICER',
    unit: 'x',
    description:
      'Non-linear harmonic intermodulation coefficient (R1 * R2) in the Blender Crossmorph algorithm (Mode 3).',
    descriptionEs:
      'Coeficiente de intermodulación armónica no lineal (R1 * R2) en el algoritmo Blender Crossmorph (Modo 3).',
    sourceRef: 'NeuronVoice.h:253',
    defaultValue: 0.25,
    minValue: 0.0,
    maxValue: 1.0,
    stepSize: 0.05,
  },
  {
    id: 'intermorphSineGain',
    label: 'Intermorph Sine Folder Gain',
    category: 'BLENDER & SLICER',
    unit: 'x',
    description:
      'Differential sine wavefolding gain sin((R1 - R2) * pi) in the Blender Intermorph algorithm (Mode 4).',
    descriptionEs:
      'Ganancia de plegado diferencial senoidal sin((R1 - R2) * pi) en el algoritmo Blender Intermorph (Modo 4).',
    sourceRef: 'NeuronVoice.h:256',
    defaultValue: 0.35,
    minValue: 0.0,
    maxValue: 1.0,
    stepSize: 0.05,
  },
  {
    id: 'dynTranssphereEnvSens',
    label: 'Dyn Transsphere Env Sensitivity',
    category: 'BLENDER & SLICER',
    unit: 'x',
    description:
      'Sensitivity of the spectral cross-synthesis balance to the instantaneous envelope level in Dyn Transsphere (Mode 5).',
    descriptionEs:
      'Sensibilidad del balance espectral al nivel instantáneo de envolvente en el modo Dyn Transsphere (Modo 5).',
    sourceRef: 'NeuronVoice.h:259',
    defaultValue: 0.4,
    minValue: 0.0,
    maxValue: 1.0,
    stepSize: 0.05,
  },
  {
    id: 'dynCrossmorphIntermod',
    label: 'Dyn Crossmorph Env Intermod',
    category: 'BLENDER & SLICER',
    unit: 'x',
    description:
      'Envelope-governed intermodulation gain in the Blender Dyn Crossmorph mode (Mode 6).',
    descriptionEs:
      'Ganancia de intermodulación gobernada por la envolvente de amplitud en el modo Dyn Crossmorph (Modo 6).',
    sourceRef: 'NeuronVoice.h:265',
    defaultValue: 0.3,
    minValue: 0.0,
    maxValue: 1.0,
    stepSize: 0.05,
  },
  {
    id: 'ringBlendGain',
    label: 'Ring Blend Modulation Gain',
    category: 'BLENDER & SLICER',
    unit: 'x',
    description:
      'Ring modulation product gain (R1 * R2) in the Blender Ring Blend mode (Mode 9).',
    descriptionEs:
      'Ganancia del producto de modulación en anillo (R1 * R2) en el modo Blender Ring Blend (Modo 9).',
    sourceRef: 'NeuronVoice.h:279',
    defaultValue: 2.2,
    minValue: 0.5,
    maxValue: 5.0,
    stepSize: 0.1,
  },
  {
    id: 'slicerMaxDelaySamples',
    label: '3D Slicer Max Comb Delay',
    category: 'BLENDER & SLICER',
    unit: 'smp',
    description:
      'Maximum stereo comb delay in samples for the Global 3D Slicer (_DAT_1030b3c4 in FUN_100295d0).',
    descriptionEs:
      'Retardo máximo en muestras de la línea de peine estéreo del Slicer 3D Global (_DAT_1030b3c4 en FUN_100295d0).',
    sourceRef: 'DspNeuronMasterFX.h:88 (FUN_100295d0)',
    defaultValue: 2500.0,
    minValue: 250.0,
    maxValue: 4000.0,
    stepSize: 50.0,
  },

  // =========================================================================
  // 4. SHAPERS & ENVELOPES
  // =========================================================================
  {
    id: 'envMaxTimeSeconds',
    label: 'ADSR Max Stage Duration',
    category: 'SHAPERS & ENVELOPES',
    unit: 's',
    description:
      'Maximum duration in seconds of an ADSR stage when its normalized parameter reaches 1.0 (882,000 samples at 44.1 kHz).',
    descriptionEs:
      'Duración máxima en segundos de una etapa ADSR cuando el parámetro normalizado alcanza 1.0 (882.000 muestras a 44.1 kHz).',
    sourceRef: 'DspNeuronEnvelope.h:69 (FUN_10040550)',
    defaultValue: 20.0,
    minValue: 2.0,
    maxValue: 60.0,
    stepSize: 1.0,
  },
  {
    id: 'envDecayExpRate',
    label: 'ADSR Decay RC Time Constant',
    category: 'SHAPERS & ENVELOPES',
    unit: 'RC',
    description:
      'Exponential RC discharge curvature constant during the Decay stage: exp(-RC / decaySamples).',
    descriptionEs:
      'Constante exponencial de descarga del circuito RC en la etapa Decay: exp(-RC / decaySamples).',
    sourceRef: 'DspNeuronEnvelope.h:182',
    defaultValue: 3.5,
    minValue: 1.0,
    maxValue: 8.0,
    stepSize: 0.1,
  },
  {
    id: 'envReleaseExpRate',
    label: 'ADSR Release RC Time Constant',
    category: 'SHAPERS & ENVELOPES',
    unit: 'RC',
    description:
      'Exponential falloff constant during the Release stage (4.6 corresponds to -60 dB attenuation at completion).',
    descriptionEs:
      'Constante exponencial de caída en la etapa Release (4.6 equivale a una atenuación de -60 dB al finalizar el tiempo).',
    sourceRef: 'DspNeuronEnvelope.h:185',
    defaultValue: 4.6,
    minValue: 1.0,
    maxValue: 10.0,
    stepSize: 0.1,
  },
  {
    id: 'envSilenceThreshold',
    label: 'Voice Silence Cutoff Floor',
    category: 'SHAPERS & ENVELOPES',
    unit: 'lvl',
    description:
      'Amplitude threshold below which the Release stage finishes and the polyphonic voice is freed to save CPU.',
    descriptionEs:
      'Umbral de amplitud por debajo del cual se da por finalizada la etapa Release y se libera la voz para ahorrar CPU.',
    sourceRef: 'DspNeuronEnvelope.h:154',
    defaultValue: 0.0005,
    minValue: 0.0001,
    maxValue: 0.01,
    stepSize: 0.0001,
  },
  {
    id: 'freeEnvCoordModScale',
    label: 'FreeEnv Scape/Sphere Depth',
    category: 'SHAPERS & ENVELOPES',
    unit: 'x',
    description:
      'Modulation scaling applied to Scape and Sphere X/Y coordinates by the free 4L/4T envelope.',
    descriptionEs:
      'Escala de modulación aplicada sobre las coordenadas X/Y de Scape y Sphere por la envolvente libre 4L/4T.',
    sourceRef: 'NeuronVoice.h:189',
    defaultValue: 0.35,
    minValue: 0.05,
    maxValue: 1.0,
    stepSize: 0.05,
  },
  {
    id: 'freeEnvPitchSemitones',
    label: 'FreeEnv Pitch Mod Span',
    category: 'SHAPERS & ENVELOPES',
    unit: 'st',
    description:
      'Maximum pitch modulation range in semitones when the free 4L/4T envelope is routed to Resynator pitch.',
    descriptionEs:
      'Rango máximo en semitonos cuando la envolvente libre 4L/4T se asigna a la afinación del Resynator.',
    sourceRef: 'NeuronVoice.h:222',
    defaultValue: 12.0,
    minValue: 1.0,
    maxValue: 36.0,
    stepSize: 1.0,
  },

  // =========================================================================
  // 5. SILVER FILTER
  // =========================================================================
  {
    id: 'filterMinCutoffHz',
    label: 'Silver Filter Min Cutoff',
    category: 'SILVER FILTER',
    unit: 'Hz',
    description:
      'Minimum base cutoff frequency of the Silver multimode filter when the Cutoff control is at zero.',
    descriptionEs:
      'Frecuencia de corte base mínima del filtro multifunción Silver cuando el control Cutoff está al mínimo.',
    sourceRef: 'DspEngineFacade.cpp:462',
    defaultValue: 20.0,
    minValue: 5.0,
    maxValue: 100.0,
    stepSize: 1.0,
  },
  {
    id: 'filterCutoffExpRatio',
    label: 'Silver Filter Sweep Ratio',
    category: 'SILVER FILTER',
    unit: 'ratio',
    description:
      'Exponential frequency sweep factor of the Silver filter (fc = minHz * ratio^norm).',
    descriptionEs:
      'Factor exponencial del barrido de frecuencia del filtro Silver (fc = minHz * ratio^norm).',
    sourceRef: 'DspNeuronSilverFilter.h:84 (FUN_10021c90)',
    defaultValue: 900.0,
    minValue: 100.0,
    maxValue: 1100.0,
    stepSize: 10.0,
  },
  {
    id: 'filterMaxResonance',
    label: 'Silver Filter Resonance Ceiling',
    category: 'SILVER FILTER',
    unit: 'Q',
    description:
      'Resonance safety ceiling of the Silver filter to prevent runaway self-oscillation at maximum Q.',
    descriptionEs:
      'Techo de seguridad de resonancia del filtro Silver para evitar auto-oscilación descontrolada a Q máximo.',
    sourceRef: 'DspEngineFacade.cpp:467',
    defaultValue: 0.95,
    minValue: 0.5,
    maxValue: 1.0,
    stepSize: 0.01,
  },
  {
    id: 'filterLp24FeedbackK',
    label: '24dB Ladder Feedback Coeff K',
    category: 'SILVER FILTER',
    unit: 'K',
    description:
      'Polynomial resonance feedback constant K of the 5-pole 24dB Low-Pass ladder (_DAT_1030a054).',
    descriptionEs:
      'Constante polinómica K de realimentación resonante de la escalera de 5 polos 24dB LP (_DAT_1030a054).',
    sourceRef: 'DspNeuronSilverFilter.h:192',
    defaultValue: 2.208,
    minValue: 1.0,
    maxValue: 3.2,
    stepSize: 0.001,
  },
  {
    id: 'filterLp24PoleGain',
    label: '24dB Ladder Cascade Gain',
    category: 'SILVER FILTER',
    unit: 'x',
    description:
      'Cascade slope multiplier for the 5-pole 24dB Low-Pass ladder filter (_DAT_1030a068).',
    descriptionEs:
      'Multiplicador de pendiente de los 5 polos en cascada del filtro 24dB LP (_DAT_1030a068).',
    sourceRef: 'DspNeuronSilverFilter.h:188',
    defaultValue: 100.0,
    minValue: 20.0,
    maxValue: 250.0,
    stepSize: 5.0,
  },
  {
    id: 'filterSvfMaxHz',
    label: '12dB Chamberlin SVF Freq Scale',
    category: 'SILVER FILTER',
    unit: 'Hz',
    description:
      'Quadratic frequency constant for the 12dB Low-Pass and Band-Pass Chamberlin SVF modes (_DAT_1030a078).',
    descriptionEs:
      'Constante cuadrática de frecuencia de los modos 12dB Low-Pass y Band-Pass Chamberlin SVF (_DAT_1030a078).',
    sourceRef: 'DspNeuronSilverFilter.h:231',
    defaultValue: 8820.0,
    minValue: 2000.0,
    maxValue: 16000.0,
    stepSize: 100.0,
  },

  // =========================================================================
  // 6. SILVER & MASTER FX
  // =========================================================================
  {
    id: 'masterInputBusScale',
    label: 'Master Bus Input Headroom Scale',
    category: 'SILVER & MASTER FX',
    unit: 'x',
    description:
      'Input scaling factor into the Master Output Stage (_DAT_1030cecc) prior to the stereo bass and air tilt.',
    descriptionEs:
      'Factor de escala de entrada a la etapa maestra (_DAT_1030cecc) previo al filtro de graves y brillo estéreo.',
    sourceRef: 'DspNeuronMasterFX.h:198 (FUN_100382b0)',
    defaultValue: 0.58,
    minValue: 0.2,
    maxValue: 1.2,
    stepSize: 0.02,
  },
  {
    id: 'masterBassTiltGain',
    label: 'Master Stereo Bass Tilt Gain',
    category: 'SILVER & MASTER FX',
    unit: 'x',
    description:
      '2-pole cross-mixed low-frequency boost gain in the Master Output Stage (_DAT_1030cdf8).',
    descriptionEs:
      'Ganancia del filtro de 2 polos de refuerzo de graves con mezcla cruzada en la salida maestra (_DAT_1030cdf8).',
    sourceRef: 'DspNeuronMasterFX.h:224',
    defaultValue: 5.0,
    minValue: 0.0,
    maxValue: 10.0,
    stepSize: 0.25,
  },
  {
    id: 'masterTrebleTiltGain',
    label: 'Master Stereo Air/HF Tilt Gain',
    category: 'SILVER & MASTER FX',
    unit: 'x',
    description:
      '2nd-order high-frequency stereo air differentiator gain in the Master Output Stage (_DAT_1030cde8).',
    descriptionEs:
      'Ganancia del diferenciador de 2º orden de apertura de agudos estéreo en la etapa maestra (_DAT_1030cde8).',
    sourceRef: 'DspNeuronMasterFX.h:224',
    defaultValue: 3.0,
    minValue: 0.0,
    maxValue: 8.0,
    stepSize: 0.25,
  },
  {
    id: 'masterSoftKneeThresh',
    label: 'Master Soft-Knee Threshold',
    category: 'SILVER & MASTER FX',
    unit: 'lvl',
    description:
      'Linear threshold above which the master soft-knee compressor/saturator engages (FUN_1003b930).',
    descriptionEs:
      'Umbral lineal a partir del cual actúa el compresor/saturador de rodilla suave maestro (FUN_1003b930).',
    sourceRef: 'DspNeuronMasterFX.h:228 (FUN_1003b930)',
    defaultValue: 0.4,
    minValue: 0.15,
    maxValue: 0.85,
    stepSize: 0.01,
  },
  {
    id: 'masterSoftKneeRatio',
    label: 'Master Soft-Knee Ratio',
    category: 'SILVER & MASTER FX',
    unit: 'ratio',
    description:
      'Compression slope above the threshold in the master soft-knee saturator (FUN_1003b930).',
    descriptionEs:
      'Pendiente de compresión por encima del umbral en el saturador de rodilla suave maestro (FUN_1003b930).',
    sourceRef: 'DspNeuronMasterFX.h:228 (FUN_1003b930)',
    defaultValue: 0.75,
    minValue: 0.1,
    maxValue: 0.95,
    stepSize: 0.01,
  },
  {
    id: 'masterReverbFdnBlend',
    label: 'Master Reverb FDN / Schroeder Mix',
    category: 'SILVER & MASTER FX',
    unit: 'ratio',
    description:
      'Internal Master Reverb balance between the dense 8x8 Householder FDN tail and Schroeder early reflections.',
    descriptionEs:
      'Balance interno de la Reverb maestra entre la cola densa ortogonal 8x8 Householder FDN y las reflexiones Schroeder.',
    sourceRef: 'DspNeuronMasterFX.h:424',
    defaultValue: 0.55,
    minValue: 0.0,
    maxValue: 1.0,
    stepSize: 0.05,
  },
];

export type CalibrationChangeListener = (id: string, value: number) => void;

export interface CalibrationExportPayload {
  schema: 'abd.axionik.calibration.v1';
  synth: 'ABDAxionikVS';
  exportedAt: string;
  paramCount: number;
  values: Record<string, number>;
}

/**
 * Reactive DSP Calibration store with localStorage persistence,
 * live C++ synchronization via WebBridge, and JSON import/export.
 */
export class CalibrationStore {
  private values: Map<string, number> = new Map();
  private descriptors: Map<string, CalibrationParamDescriptor> = new Map();
  private listeners: Set<CalibrationChangeListener> = new Set();

  constructor() {
    for (const desc of CALIBRATION_REGISTRY) {
      this.descriptors.set(desc.id, desc);
      this.values.set(desc.id, desc.defaultValue);
    }
    this.loadFromStorage();
  }

  public getDescriptor(id: string): CalibrationParamDescriptor | undefined {
    return this.descriptors.get(id);
  }

  public getAllDescriptors(): readonly CalibrationParamDescriptor[] {
    return CALIBRATION_REGISTRY;
  }

  public getValue(id: string): number {
    const desc = this.descriptors.get(id);
    if (!desc) return 0;
    return this.values.has(id) ? (this.values.get(id) as number) : desc.defaultValue;
  }

  public clampAndSnap(desc: CalibrationParamDescriptor, rawValue: number): number {
    if (!Number.isFinite(rawValue)) return desc.defaultValue;
    let clamped = Math.max(desc.minValue, Math.min(desc.maxValue, rawValue));
    if (desc.isInteger) {
      clamped = Math.round(clamped);
    } else if (desc.stepSize > 0) {
      const decimals = this.getStepDecimals(desc.stepSize);
      clamped = Number(clamped.toFixed(decimals));
    }
    return clamped;
  }

  public getStepDecimals(step: number): number {
    const str = String(step);
    const dot = str.indexOf('.');
    return dot === -1 ? 0 : str.length - dot - 1;
  }

  public formatValue(id: string, val?: number): string {
    const desc = this.descriptors.get(id);
    if (!desc) return String(val ?? 0);
    const v = val !== undefined ? val : this.getValue(id);
    if (desc.isInteger) return String(Math.round(v));
    const decimals = Math.max(1, this.getStepDecimals(desc.stepSize));
    return v.toFixed(decimals);
  }

  public isModified(id: string): boolean {
    const desc = this.descriptors.get(id);
    if (!desc) return false;
    const current = this.getValue(id);
    return Math.abs(current - desc.defaultValue) > 1e-6;
  }

  public getModifiedCount(): number {
    let count = 0;
    for (const desc of CALIBRATION_REGISTRY) {
      if (this.isModified(desc.id)) count++;
    }
    return count;
  }

  public getCategoryModifiedCount(category: CalibrationCategory): number {
    let count = 0;
    for (const desc of CALIBRATION_REGISTRY) {
      if (desc.category === category && this.isModified(desc.id)) count++;
    }
    return count;
  }

  public setValue(id: string, rawValue: number, notifyBridge: boolean = true): number {
    const desc = this.descriptors.get(id);
    if (!desc) return 0;
    const next = this.clampAndSnap(desc, rawValue);
    this.values.set(id, next);
    this.saveToStorage();

    if (notifyBridge) {
      WebBridge.send({ type: 'CALIBRATION_SET', id, value: next });
      if (id === 'masterVolume') {
        WebBridge.setMasterVolume(next);
      } else if (id === 'oracleClipToZeroMode') {
        WebBridge.setOracleClipMode(next > 0.5);
      }
    }

    this.emit(id, next);
    return next;
  }

  public resetParam(id: string): number {
    const desc = this.descriptors.get(id);
    if (!desc) return 0;
    this.values.set(id, desc.defaultValue);
    this.saveToStorage();

    WebBridge.send({ type: 'CALIBRATION_RESET', id, value: desc.defaultValue });
    if (id === 'masterVolume') {
      WebBridge.setMasterVolume(desc.defaultValue);
    } else if (id === 'oracleClipToZeroMode') {
      WebBridge.setOracleClipMode(desc.defaultValue > 0.5);
    }

    this.emit(id, desc.defaultValue);
    return desc.defaultValue;
  }

  public resetCategory(category: CalibrationCategory): void {
    for (const desc of CALIBRATION_REGISTRY) {
      if (desc.category === category) {
        this.resetParam(desc.id);
      }
    }
  }

  public resetAll(): void {
    for (const desc of CALIBRATION_REGISTRY) {
      this.values.set(desc.id, desc.defaultValue);
    }
    this.saveToStorage();
    WebBridge.send({ type: 'CALIBRATION_RESET_ALL' });
    WebBridge.setMasterVolume(0.85);
    WebBridge.setOracleClipMode(false);
    for (const desc of CALIBRATION_REGISTRY) {
      this.emit(desc.id, desc.defaultValue);
    }
  }

  public syncAllToBridge(): void {
    const payload: Record<string, number> = {};
    for (const desc of CALIBRATION_REGISTRY) {
      payload[desc.id] = this.getValue(desc.id);
    }
    WebBridge.send({ type: 'CALIBRATION_SYNC', values: payload });
  }

  public exportToJson(): string {
    const valuesObj: Record<string, number> = {};
    for (const desc of CALIBRATION_REGISTRY) {
      valuesObj[desc.id] = this.getValue(desc.id);
    }
    const payload: CalibrationExportPayload = {
      schema: 'abd.axionik.calibration.v1',
      synth: 'ABDAxionikVS',
      exportedAt: new Date().toISOString(),
      paramCount: CALIBRATION_REGISTRY.length,
      values: valuesObj,
    };
    return JSON.stringify(payload, null, 2);
  }

  public importFromJson(jsonText: string): { applied: number; errors: string[] } {
    const errors: string[] = [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      return { applied: 0, errors: [`Invalid JSON syntax: ${(err as Error).message}`] };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { applied: 0, errors: ['JSON root must be an object.'] };
    }

    const root = parsed as Record<string, unknown>;
    const sourceMap =
      root.values && typeof root.values === 'object' && !Array.isArray(root.values)
        ? (root.values as Record<string, unknown>)
        : root;

    let applied = 0;
    for (const [key, rawVal] of Object.entries(sourceMap)) {
      const desc = this.descriptors.get(key);
      if (!desc) {
        if (key !== 'schema' && key !== 'synth' && key !== 'exportedAt' && key !== 'paramCount') {
          errors.push(`Unknown calibration parameter "${key}" ignored.`);
        }
        continue;
      }
      const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
      if (!Number.isFinite(numVal)) {
        errors.push(`Non-numeric value for "${key}" ignored.`);
        continue;
      }
      this.setValue(key, numVal, false);
      applied++;
    }

    if (applied > 0) {
      this.syncAllToBridge();
    }

    return { applied, errors };
  }

  public onChange(listener: CalibrationChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(id: string, value: number): void {
    for (const listener of this.listeners) {
      try {
        listener(id, value);
      } catch (err) {
        console.error('[CalibrationStore Listener Error]', err);
      }
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const map = parsed?.values && typeof parsed.values === 'object' ? parsed.values : parsed;
      if (!map || typeof map !== 'object') return;
      for (const desc of CALIBRATION_REGISTRY) {
        if (Object.prototype.hasOwnProperty.call(map, desc.id)) {
          const v = Number(map[desc.id]);
          if (Number.isFinite(v)) {
            this.values.set(desc.id, this.clampAndSnap(desc, v));
          }
        }
      }
    } catch {
      // Ignore corrupt storage
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const valuesObj: Record<string, number> = {};
      for (const desc of CALIBRATION_REGISTRY) {
        valuesObj[desc.id] = this.getValue(desc.id);
      }
      window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify({ values: valuesObj }));
    } catch {
      // Ignore quota errors
    }
  }
}

export const calibrationStore = new CalibrationStore();
