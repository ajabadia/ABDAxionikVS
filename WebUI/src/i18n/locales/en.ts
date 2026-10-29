/**
 * ABDAxionikVS — en.ts
 * English locale dictionary (Default reference).
 *
 * Rules:
 * - Single letter descriptors and synth acronyms (A, D, S, R, LFO, CUTOFF, RESO,
 *   Scape, Sphere, Blender, Slicer, MIDI, CC, NRPN, SysEx) MUST NOT be translated.
 * - Every key defined here must exist identically in es.ts (and any future language).
 */

export const en = {
  navbar: {
    // Menu headers
    menuFile: 'File',
    menuEdit: 'Edit',
    menuView: 'View',
    menuHelp: 'Help',

    // File menu
    configureFolder: 'Configure NeuronDB Library Folder...',
    importModelFolder: 'Import Model Folder (<NNN>.model)...',
    importModelZip: 'Import Model Package (.zip)...',
    loadPreset: 'Load Sound Preset...',
    savePreset: 'Save Sound Preset As...',
    initPreset: 'Init Sound (Factory Reset)',

    // Edit menu
    bankBrowser: 'NeuronDB Bank Browser...',
    nukeRemote: 'NUKE Remote Control Unit...',
    matrixMod: 'Free Controllers Modulation Matrix (6x5)...',
    midiLearn: 'MIDI Learn & CC Mapping Matrix...',
    hardwareSysEx: 'Hardware SysEx Dumps (Current / All Sounds / All SetUps / All Models)...',
    dspCalibration: 'DSP Calibration & Magic Numbers (43 Parameters)...',
    effectsRack: 'Effects Rack (Silver & Master)...',
    globalSettings: 'Global Synth Settings...',

    // View menu
    zoom: 'Zoom',
    zoom100: '100% (Normal)',
    zoom125: '125% (Medium)',
    zoom150: '150% (Large)',
    colorTheme: 'Color Theme',
    language: 'Language',
    langEn: 'English (EN)',
    langEs: 'Español (ES)',

    // Help menu
    manual: 'Hartmann Neuron Architecture Guide...',
    checkForUpdates: 'Check for Updates...',
    about: 'About ABDAxionikVS...',

    // HUD & Badges
    presetPillTitle: 'Active Sound Preset (Click to open Bank Browser)',
    presetLabel: 'PRESET:',
    voicesTitle: 'Active polyphonic voices',
    voicesLabel: 'VOICES:',
    cpuTitle: 'Audio DSP CPU Load',
    btnNukeTitle: 'NUKE Remote Control Unit (Ctrl+K)',
    btnMatrixTitle: 'Modulation Matrix 6x5 (Ctrl+M)',
    btnMidiTitle: 'MIDI Learn & CC/NRPN Mapping Matrix (Ctrl+L)',
    btnSysExTitle: 'Hardware SysEx Dumps & Live Inspector (Ctrl+.)',
    btnCalibTitle: 'DSP Calibration & Magic Numbers (Ctrl+;)',
    btnEffectsTitle: 'Effects Rack (Silver & Master) (Ctrl+F)',
    btnNeuronDbTitle: 'NeuronDB Bank Browser (Ctrl+B)',
    btnSettingsTitle: 'Global Synth Settings & Preferences (Ctrl+,)',
    btnThemeTitle: 'Cycle Color Theme',
    btnLangTitle: 'Switch Language (EN / ES)',

    // Quick Action button labels
    nuke: 'NUKE',
    matrix: 'Matrix',
    midi: 'MIDI',
    sysex: 'SysEx',
    calib: 'Calib',
    effects: 'Effects',
    neuronDb: 'NeuronDB',
    settings: 'Settings',

    // About Dialog
    aboutTitle: 'ABDAxionikVS',
    aboutSubtitle: 'Hartmann Neuron / NeuronVS Faithful Modern Virtual Synthesizer',
    aboutBuildInfo: 'Neuron DSP Core C++20 + WebAssembly + WebView2 Architecture',
    aboutAuthor: 'ABDSynths',
    aboutCopyright: '© 2026 ABDSynths',
  },

  common: {
    close: 'Close',
    save: 'Save',
    cancel: 'Cancel',
    load: 'Load',
    export: 'Export',
    import: 'Import',
    reset: 'Reset',
    resetAll: 'Reset All',
    search: 'Search...',
    all: 'ALL',
    min: 'Min',
    max: 'Max',
    default: 'Default',
    enabled: 'Enabled',
    disabled: 'Disabled',
    status: 'Status',
    ready: 'Ready',
    active: 'Active',
    none: 'None',
    bytes: 'bytes',
  },

  settings: {
    drawerTitle: 'SYNTH SETTINGS',
    polyphonyCard: 'POLYPHONY & STEREO SPREAD',
    numVoicesLabel: 'Voices',
    soundPanLabel: 'Pan',
    panKeyTrackLabel: 'Pan KeyTrack',
    controllersCard: 'PERFORMANCE CONTROLLERS & PITCH BEND',
    pitchBendRangeLabel: 'PB Range',
    footswitchLabel: 'Footswitch Destination',
    oracleCard: 'ORACLE CLIP-TO-ZERO BEHAVIOR (DECOMPILED 0x1000bc40)',
    oracleDesc: 'Toggles between modern smooth hyperbolic saturation (clean musical headroom) and the historical binary clip-to-zero algorithm from NeuronVS.dll (which introduces odd harmonics when driven hard).',
    oracleModeModern: 'Musical Saturation (Modern)',
    oracleModeLegacy: 'Historic Clip-to-Zero (NeuronVS.dll)',
    uiThemeCard: 'USER INTERFACE & SCALE',
    themeLabel: 'Color Theme',
    zoomLabel: 'UI Zoom Level',
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
    resetGroupTitle: 'Restore all values in category to their factory defaults',
    resetSingleTitle: 'Restore to factory default',
    sliderDblClickTitle: 'Double-click to restore to factory default',
    defaultTickTitle: 'Original factory default:',
    sourceRefTitle: 'Source in C++ code / NeuronVS binary',
    minLabel: 'Min',
    maxLabel: 'Max',
    catGeneral: 'GENERAL & ENGINE',
    catResynator: 'RESYNATOR (SCAPE & SPHERE)',
    catBlender: 'BLENDER & SLICER',
    catShapers: 'SHAPERS & ENVELOPES',
    catSilverFilter: 'SILVER FILTER',
    catSilverMasterFx: 'SILVER & MASTER FX',
  },

  hardwareDumps: {
    drawerTitle: 'HARDWARE SYSEX DUMPS & LIVE INSPECTOR',
    connectionCard: 'MIDI PORT & CONNECTION STATUS',
    portStatusConnected: 'Connected',
    portStatusDisconnected: 'Disconnected',
    portDesc: 'Bidirectional MIDI IN/OUT connection to Hartmann Neuron Hardware (Model 0x01)',
    dumpTypeTitle: 'DUMP TYPE SELECTOR',
    modeCurrentSound: 'Current Sound (0x10)',
    modeAllSounds: 'All Sounds (0x20)',
    modeAllSetUps: 'All SetUps (0x30)',
    modeAllModels: 'All Models (0x40)',
    actionRequestDump: 'Request Dump from Hardware',
    actionSendDump: 'Send Current Sound to Hardware',
    actionLoadSyx: 'Load .syx File...',
    actionExportSyx: 'Export .syx File...',
    actionApplyToSynth: 'Apply Parameters to Synth Engine',
    inspectorTitle: 'LIVE SYSEX INSPECTOR',
    diffTitle: 'A/B SYSEX COMPARISON & MUTATION DIFF',
    activityLogTitle: 'ACTIVITY LOG',
    clearLogBtn: 'Clear Log',
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
  },

  matrix: {
    drawerTitle: 'MODULATION MATRIX (6x5)',
    controllersSubtitle: 'Free Controllers to Engine Destinations',
  },

  midiLearn: {
    drawerTitle: 'MIDI LEARN & CC MAPPING MATRIX',
    learnPrompt: 'Waiting for MIDI CC message from controller...',
    clearAll: 'Clear All Mappings',
  },

  effects: {
    drawerTitle: 'EFFECTS RACK',
    silverFxTitle: 'SILVER FX PROCESSOR',
    masterFxTitle: 'MASTER EFFECTS STAGE',
  },
};

export type Translations = typeof en;

