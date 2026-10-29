/**
 * ABDAxionikVS — es.ts
 * Diccionario en Español (ES).
 *
 * Reglas:
 * - Los acrónimos de síntesis y letras sueltas (A, D, S, R, LFO, CUTOFF, RESO,
 *   Scape, Sphere, Blender, Slicer, MIDI, CC, NRPN, SysEx) NO se traducen.
 * - Toda clave debe coincidir exactamente con en.ts.
 */

import type { Translations } from './en.js';

export const es: Translations = {
  navbar: {
    // Menu headers
    menuFile: 'Archivo',
    menuEdit: 'Edición',
    menuView: 'Ver',
    menuHelp: 'Ayuda',

    // File menu
    configureFolder: 'Configurar Carpeta NeuronDB...',
    importModelFolder: 'Importar Carpeta de Modelos (<NNN>.model)...',
    importModelZip: 'Importar Paquete de Modelos (.zip)...',
    loadPreset: 'Cargar Preset de Sonido...',
    savePreset: 'Guardar Preset de Sonido Como...',
    initPreset: 'Iniciar Sonido (Restablecer Fábrica)',

    // Edit menu
    bankBrowser: 'Navegador de Bancos NeuronDB...',
    nukeRemote: 'Unidad de Control Remoto NUKE...',
    matrixMod: 'Matriz de Modulación de Controladores Libres (6x5)...',
    midiLearn: 'Matriz de Mapeo MIDI Learn y CC...',
    hardwareSysEx: 'Volcados SysEx Hardware (Sonido Actual / Todos / SetUps / Modelos)...',
    dspCalibration: 'Calibración DSP y Números Mágicos (43 Parámetros)...',
    effectsRack: 'Rack de Efectos (Silver y Master)...',
    globalSettings: 'Ajustes Globales del Sintetizador...',

    // View menu
    zoom: 'Escala (Zoom)',
    zoom100: '100% (Normal)',
    zoom125: '125% (Mediano)',
    zoom150: '150% (Grande)',
    colorTheme: 'Tema de Color',
    language: 'Idioma',
    langEn: 'English (EN)',
    langEs: 'Español (ES)',

    // Help menu
    manual: 'Guía de Arquitectura Hartmann Neuron...',
    checkForUpdates: 'Buscar Actualizaciones...',
    about: 'Acerca de ABDAxionikVS...',

    // HUD & Badges
    presetPillTitle: 'Preset Activo (Clic para abrir el Navegador de Bancos)',
    presetLabel: 'PRESET:',
    voicesTitle: 'Voces polifónicas activas',
    voicesLabel: 'VOCES:',
    cpuTitle: 'Carga de CPU del DSP de Audio',
    btnNukeTitle: 'Unidad de Control Remoto NUKE (Ctrl+K)',
    btnMatrixTitle: 'Matriz de Modulación 6x5 (Ctrl+M)',
    btnMidiTitle: 'Matriz de Mapeo MIDI Learn y CC/NRPN (Ctrl+L)',
    btnSysExTitle: 'Volcados SysEx Hardware e Inspector en Vivo (Ctrl+.)',
    btnCalibTitle: 'Calibración DSP y Números Mágicos (Ctrl+;)',
    btnEffectsTitle: 'Rack de Efectos (Silver y Master) (Ctrl+F)',
    btnNeuronDbTitle: 'Navegador de Bancos NeuronDB (Ctrl+B)',
    btnSettingsTitle: 'Ajustes Globales y Preferencias (Ctrl+,)',
    btnThemeTitle: 'Alternar Tema de Color',
    btnLangTitle: 'Cambiar Idioma (EN / ES)',

    // Quick Action button labels
    nuke: 'NUKE',
    matrix: 'Matriz',
    midi: 'MIDI',
    sysex: 'SysEx',
    calib: 'Calib',
    effects: 'Efectos',
    neuronDb: 'NeuronDB',
    settings: 'Ajustes',

    // About Dialog
    aboutTitle: 'ABDAxionikVS',
    aboutSubtitle: 'Sintetizador Virtual Fiel al Hartmann Neuron / NeuronVS',
    aboutBuildInfo: 'Núcleo DSP Neuron C++20 + Arquitectura WebAssembly + WebView2',
    aboutAuthor: 'ABDSynths',
    aboutCopyright: '© 2026 ABDSynths',
  },

  common: {
    close: 'Cerrar',
    save: 'Guardar',
    cancel: 'Cancelar',
    load: 'Cargar',
    export: 'Exportar',
    import: 'Importar',
    reset: 'Restablecer',
    resetAll: 'Restablecer Todo',
    search: 'Buscar...',
    all: 'TODOS',
    min: 'Mín',
    max: 'Máx',
    default: 'Por defecto',
    enabled: 'Activado',
    disabled: 'Desactivado',
    status: 'Estado',
    ready: 'Listo',
    active: 'Activo',
    none: 'Ninguno',
    bytes: 'bytes',
  },

  settings: {
    drawerTitle: 'AJUSTES DEL SINTETIZADOR',
    polyphonyCard: 'POLIFONÍA Y APERTURA ESTÉREO',
    numVoicesLabel: 'Voces',
    soundPanLabel: 'Panorama',
    panKeyTrackLabel: 'Panorama por Teclado',
    controllersCard: 'CONTROLADORES Y RANGO DE PITCH BEND',
    pitchBendRangeLabel: 'Rango PB',
    footswitchLabel: 'Destino del Pedal Footswitch',
    oracleCard: 'COMPORTAMIENTO DE RECORTE CLIP-TO-ZERO (0x1000bc40 DESCOMPILADO)',
    oracleDesc: 'Alterna entre la saturación hiperbólica suave moderna (espacio musical limpio) y el algoritmo histórico binario de recorte a cero de NeuronVS.dll (que introduce armónicos impares al saturar).',
    oracleModeModern: 'Saturación Musical (Moderna)',
    oracleModeLegacy: 'Recorte a Cero Histórico (NeuronVS.dll)',
    uiThemeCard: 'INTERFAZ DE USUARIO Y ESCALA',
    themeLabel: 'Tema de Color',
    zoomLabel: 'Nivel de Escala (Zoom)',
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
    drawerTitle: 'CALIBRACIÓN DSP Y NÚMEROS MÁGICOS',
    searchPlaceholder: 'Buscar número mágico por nombre, ID, descripción o referencia C++...',
    modifiedBtn: 'MODIFICADOS',
    modifiedBtnTitle: 'Mostrar solo parámetros con valores diferentes al original de fábrica',
    loadJsonBtn: 'CARGAR JSON',
    loadJsonTitle: 'Cargar configuración de calibración desde un archivo JSON',
    exportJsonBtn: 'EXPORTAR JSON',
    exportJsonTitle: 'Exportar todos los valores actuales de calibración a un archivo JSON',
    resetAllBtn: 'RESTABLECER TODO',
    resetAllTitle: 'Restaurar los 43 números mágicos a sus constantes originales de NeuronVS',
    allTab: 'TODOS',
    valuesUnit: 'valores',
    modShort: 'mod',
    resetGroupBtn: 'Restablecer Grupo',
    resetGroupTitle: 'Restaurar todos los valores de la categoría a valores de fábrica',
    resetSingleTitle: 'Restaurar al valor de fábrica',
    sliderDblClickTitle: 'Doble clic para restaurar al valor de fábrica',
    defaultTickTitle: 'Valor original de fábrica:',
    sourceRefTitle: 'Referencia en código C++ / binario NeuronVS',
    minLabel: 'Mín',
    maxLabel: 'Máx',
    catGeneral: 'GENERAL Y MOTOR',
    catResynator: 'RESYNATOR (SCAPE Y SPHERE)',
    catBlender: 'BLENDER Y SLICER',
    catShapers: 'SHAPERS Y ENVOLVENTES',
    catSilverFilter: 'SILVER FILTRO',
    catSilverMasterFx: 'SILVER Y EFECTOS MASTER',
  },

  hardwareDumps: {
    drawerTitle: 'VOLCADOS SYSEX HARDWARE E INSPECTOR EN VIVO',
    connectionCard: 'PUERTO MIDI Y ESTADO DE CONEXIÓN',
    portStatusConnected: 'Conectado',
    portStatusDisconnected: 'Desconectado',
    portDesc: 'Conexión MIDI IN/OUT bidireccional con el hardware Hartmann Neuron (Modelo 0x01)',
    dumpTypeTitle: 'SELECTOR DE TIPO DE VOLCADO',
    modeCurrentSound: 'Sonido Actual (0x10)',
    modeAllSounds: 'Todos los Sonidos (0x20)',
    modeAllSetUps: 'Todos los SetUps (0x30)',
    modeAllModels: 'Todos los Modelos (0x40)',
    actionRequestDump: 'Solicitar Volcado al Hardware',
    actionSendDump: 'Enviar Sonido Actual al Hardware',
    actionLoadSyx: 'Cargar Archivo .syx...',
    actionExportSyx: 'Exportar Archivo .syx...',
    actionApplyToSynth: 'Aplicar Parámetros al Sintetizador',
    inspectorTitle: 'INSPECTOR SYSEX EN VIVO',
    diffTitle: 'COMPARACIÓN A/B SYSEX Y MUTACIONES',
    activityLogTitle: 'REGISTRO DE ACTIVIDAD',
    clearLogBtn: 'Limpiar Registro',
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

  midiLearn: {
    drawerTitle: 'MATRIZ DE MAPEO MIDI LEARN Y CC',
    learnPrompt: 'Esperando mensaje MIDI CC desde el controlador...',
    clearAll: 'Limpiar Todos los Mapeos',
  },

  effects: {
    drawerTitle: 'RACK DE EFECTOS',
    silverFxTitle: 'PROCESADOR DE EFECTOS SILVER',
    masterFxTitle: 'ETAPA DE EFECTOS MASTER',
  },
};

