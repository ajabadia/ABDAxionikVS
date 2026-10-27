# ABDAxionikVS — Informe de Arquitectura y Plan de Implementación (`ROADMAP.md`)

> **Proyecto:** `ABDAxionikVS` (`D:\desarrollos\ABDSynths\ABDAxionikVS`)
> **Repositorio GitHub:** `https://github.com/ajabadia/ABDAxionikVS.git`
> **Documentación de Referencia e Ingeniería Inversa:** [`DOCS/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS), [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md) y [`DOCS/DSP_MIGRATION_AND_FIXES.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/DSP_MIGRATION_AND_FIXES.md)
> **Objetivo:** Recreación moderna, verificable bit a bit y extensible del sintetizador **Hartmann Neuron / NeuronVS**, integrada en el ecosistema **ABDSynths** (`JUCE 9` + `C++20` puro sin JUCE en DSP + `WebAssembly AudioWorklet` + `WebView2` empaquetado con Vite) y compatible al 100 % con `NeuronDB` (`.model` / `.sound`) y con `ABDNeuModMakr` (`.nmmodel` `v2.1`).

---

## 1. Síntesis de Auditoría de Fuentes Locales

### 1.1 Corpus de Ingeniería Inversa (`C:/Users/ajaba/Downloads/neuron`)
1. **Partición en Tres Estados (`core+0x3dc`, `core+0x3e8`, `core+0x3e0`)**:
   - **`snddat` (`core+0x3dc`)**: Almacén autoritativo de **445 registros de parámetro** de `40 B` (`0x28 B`), inicializados desde la tabla estática de descriptores en `.rdata` (`0x10049f08`, `445 × 28 B`, todos con `step = 1.0`).
     - Layout del registro de `40 B`: `+0x00` `name`, `+0x04` `model_name`, `+0x08` `model_variant`, `+0x0c` `min`, `+0x10` `max`, `+0x14` `default`, `+0x18` `step`, `+0x1c` `value` (`float`), `+0x20` `observers[16]`, `+0x24` `capacity = 16`.
     - **Regla de cuantización y clamp (`FUN_10001170`)**: `trunc(v / step) * step` seguido de `clamp(min, max)`. Existen **19 parámetros** cuyo `default` declarado en `.rdata` (`0`) está por debajo de su `min` (`1`): los 12 `*StickPlayback` (`R1L1..L3`, `R2L1..L3` Scape/Sphere), los 3 `SilverL1..L3StickPlayback` y los 4 `EQ_*`. Al construirse, `FUN_10001170` los fija en `1.0`.
   - **`params` (`core+0x3e8`, `11.484 B` / `0x2CDC`)**: Coeficientes de ejecución intermedios:
     - `+0x14`: 6 índices de fuentes de modulación (`ModDestIndex` / fuentes).
     - `+0x44`: 6 controles de ejecución en tiempo real alimentados por MIDI (`CC 1`, `CC 2`, `CC 3`, `CC 4`, `CC 11` y `Channel Pressure`).
     - `+0x17c`: 6 valores actuales de fuentes de modulación.
     - `+0x280`: **335 observadores** de `24 B` registrados contra los 445 registros de `snddat`.
     - `+0x278c`: **340 slots de valores efectivos** (`p[0..334]`, `float` en dwords) recalculados por `FUN_100134e0` (`vtable+0x04`) en cada notificación de observador.
   - **`engine` (`core+0x3e0`, `13.948 B` / `0x367C`)**: Estado de síntesis en tiempo real. Jamás lee `snddat` directamente.

2. **Frontera Traductora (`FUN_10040550`) y Carga de Modelos (`0x10013620` / `FUN_100440d0`)**:
   - `FUN_10040550` (`15.226 B`, 2.125 líneas) es el **único puente** que escribe en los primeros `0xDA8` bytes de `engine` (`e[0x000..0x36A]`) a partir de `params+0x278c`:
     - Incluye dos bloques espejo de `0x588 B`: `0x284..0x80B` para **Resinator 1 (`R1`)** y `0x80C..0xD93` para **Resinator 2 (`R2`)**, donde `R2` lee `p[N + 70]` para 42 de los 47 campos literales.
     - Al final invoca `FUN_100343e4(e[0xD95], p)` (escritura de sub-objeto de motor) y `FUN_100373a0(e)` (validador de tablas de teclado de `R1`/`R2` que habilita el flag `e + 0xD99 = 1`).
     - Ya existe una traducción C++ generada y verificada en `NeuronVS_port/src/translator.cpp` (**351/351 presets bit-idénticos en reposo** y **333/351 a mitad de nota**, con 18 presets difiriendo en 1 ULP por redondeo intermedio de 80 bits x87 vs SSE2).
   - El observador `0x10013620` sobre `R1ModellIndex` (`[22]`) y `R2ModellIndex` (`[102]`):
     - Adquiere el `<NNN>.model` del banco (`FUN_1000b320`), extrae los bloques `mnAN` (12 etiquetas ASCII de 8 bytes) y `fdAN` (6 pares `[from, to]` de `float32`) de `%06d.scape` y `%06d.sphere` para actualizar dinámicamente los nombres de eje (`+0x04`, `+0x08`) y valores por defecto (`+0x14`) de los 12 parámetros Scape/Sphere de esa capa.
     - Llama 128 veces a `FUN_100440d0` (notas MIDI `0..127`) leyendo `map.script` (`1.027` líneas: `SplitType` + `128 × 8` claves `NoteNNNL/HSource`, `RootKey`, `Detune`, `Volume`) y poblando las **128 entradas de `40 B` por tecla** en `engine+0xDB0` (`R1`) y `engine+0x2200` (`R2`).

3. **Camino de Audio (`NeuronVS_dsp`, 87 Funciones y 1.430 Constantes)**:
   - El adaptador `0x1000bc40` procesa en **bloques fijos internos de 128 muestras** y delega en el orquestador `FUN_100382b0`.
   - El grafo alcanzable desde `FUN_100382b0` consta de **exactamente 87 funciones** (`81.159 B`, `12.665` líneas de pseudocódigo, **0 llamadas indirectas**), todas contiguas en `0x10021C90..0x100478D0`.
   - Cada voz (`0x70 B`, tag `'nSAN'`, 129 alojadas en `engine+0xD94`, polifonía máxima 32 en `engine+0xDA0`, gobernada por `SoundNumVoices` `4..12`) contiene **dos motores Resinator independientes de `0x6838 B` (`26.680 B`)** en `+0x68` (`R1`) y `+0x6C` (`R2`).
   - En `noteOn` (`FUN_1003d800`), se copia `engine+0x284` a `R1+0x638C` y `engine+0x80C` a `R2+0x638C` (`0x588 B`), y `FUN_10032970` selecciona la zona `LowSource` vs `HiSource` según `note < *(float*)(params + 0x418)` y enlaza:
     - **`.scape`**: curva `int16` en `file + 0x104` (`100` muestras/ciclo), leída por `FUN_100317b0` (`CurveReader`) con interpolación lineal en bucle y filtro de énfasis diferencial de 2 puntos `(v - prev) * 2 + v`.
     - **`.sphere`**: frames de `6.568 B` (`magic = 1234` / `0x4d2`) con tabla de **25 bandas × 4 slots `float`** (`FUN_10031950` `BandReader`, crossfade cada `1024` o `512` muestras según `decodeMode`) seguida del bloque opaco de **`6.152 B` (1.024 parciales aditivos/espectrales)** decodificado y sintetizado por `FUN_1002e750` → `FUN_1003bd10` / `FUN_1003c980` → `FUN_10034290`.
   - **Etapa de salida peculiar (`0x1000bc40`)**: aplica **clip-to-zero** (`if (x*x > 1.0f || isnan(x)) x = 0.0f`). En `ABDAxionikVS` se implementará un flag conmutable `OracleClipToZeroMode` (activo en tests de paridad áurea contra `NeuronVS.dll`; sustituido en modo musical moderno por saturación suave / limitador de seguridad sin clics).

4. **Superficie VST2, MIDI y UI Original (`NeuronVS_vst2`, `NeuronVS_layout`)**:
   - El VST2 original expone **26 parámetros al host** (12 pares Sphere/Scape de `R1L1..L3` y `R2L1..L3` + `FilterFreq` `[274]` + `FilterReso` `[275]`).
   - El MIDI original procesa Note On/Off (omni), **CC 1, 2, 3, 4 y 11** + **Channel Pressure** (los 6 controles de ejecución en `params+0x44`), **CC 32** (Bank Select `0..9`) + **Program Change** (`bank * 100 + prog`, `0..999`) y **Pitch Bend**.
   - La interfaz original (`800×652`) se estructura en **33 páginas distribuidas en 10 vistas**, con **429 instancias de controles**, **174 enlaces a parámetros** (`control_params.csv`) y **44 enlaces de cambio de página** (`page_ref_links.csv`), donde las vistas hijas `1, 2, 3, 6` reflejan directamente los parámetros `R1ParamLevel` `[25]`, `R2ParamLevel` `[105]`, `CurFreqFX` `[282]` y `CurTimeFX` `[328]`.

### 1.2 Compatibilidad con `ABDNeuModMakr` (`D:/desarrollos/ABDSynths/ABDNeuModMakr`)
- `ABDNeuModMakr` ya dispone de codecs verificados en TypeScript (`ModelFormat.ts`, `SoundFormat.ts`, `ZipArchive.ts`, `ScapeSphereGenerator.ts`) para:
  - Contenedores `.scape`, `.sphere`, `map.script` (1.027 líneas), `MName`, `ModelNames`, `sound.script` (445 claves), `sound.stickrec` (líneas hexadecimales de 9 dígitos `TTTTFCVVV`), `SoundNames` y paquetes ZIP `.model`/`.sound`.
  - Las tablas exactas de los **10 Parameter Sets** (`0..9`) de `NASAnalysis.dll` (`SCAPE_MNAN_NAMES_BY_SET`, `SPHERE_MNAN_NAMES_BY_SET`, `buildScapeFdPairs`, `buildSphereFdPairs`).
  - El formato extendido **`.nmmodel` (`v2.1` JSON)** con frames `Float32` de 64 parciales (`amplitudes[64]`, `frequencyOffsets[64]` en semitonos relativos a fundamental), soporte multicapa (`layers[]`) y muestras WAV embebidas (`Samples/`).

### 1.3 Hallazgos de las Versiones Mac (`NeuronVS Intel 1.55 / 1.56` de 2013) y Linux (`Neuron80GB-OS15`) + Decisiones Cerradas
1. **Tabla de Símbolos Original (`LC_SYMTAB`) de Mac `1.56` (`2013`)**:
   - Se han extraído los **3.012 símbolos** del binario Mach-O de Mac `1.56` (compilado por Prosoniq / Stephan Bernsee en 2013) en [`mac156_symbol_xref.csv`](./DOCS/reverse_engineering/dsp/mac156_symbol_xref.csv) y correlacionado 1:1 con PC `1.0` en [`pc10_to_mac156_dsp_map.csv`](./DOCS/reverse_engineering/dsp/pc10_to_mac156_dsp_map.csv), identificando las clases C++ originales (`CParam`, `CParamDB`, `SoundParams`, `ModuleParams`, `ModelAdmin`, `ModelMem`, `ModelZone`, `ModuleEngine`, `SynthCore`, `SynthEditor`) y las 23 clases internas del motor NAS (`CNASEngine`, `CResynator` y sus 7 sub-motores `CParsetEngine0..6`, `CVoice`, `CShaper4T4L`, `CSilverRack`, `CMasterModFX`, `CMasterTimeFX`, `CDelayTapLine`).
2. **Los 4 Bugs Corregidos Oficialmente en Mac `1.56` (`2013`)**:
   - Eliminación del ring-buffer fijo de 128 muestras y del *clip-to-zero* (`if (x*x > 1.0) x = 0.0`) en `ModuleEngine::stEngineProcess` (`0x00021df8`) + soporte de `sampleFrames` variable en `_NASEngineProcess` (`0x00094230`).
   - 3 nuevos métodos `Reset()` (`CMasterTimeFX::Reset` `0x000678e0`, `CMasterModFX::Reset` `0x00067a30`, `CFXBase::Reset` `0x00067a60`) invocados desde `CNASEngine::Process` (`0x000940b4`) para poner a cero (`memset`) los 12 buffers circulares de Delay/Reverb al activar o cambiar de efecto.
   - Nuevo wrapper de filtro por voz `_sqe1Aw53j...` (`0x00089c90`) que comprueba `flag_0x280 == 1` y limpia los dos buffers de estado biquad de `100 B` (`esi+0x30`, `esi+0x34`) antes de ejecutar `ProcessVoiceFilter` (`0x00088bc0` / `FUN_100330f0`), evitando explosiones `NaN`/pops.
   - Desactivación por defecto del controlador `<Nuke>` (en `ABDAxionikVS` se elimina por completo cualquier dependencia de `<Nuke>`).
3. **Variaciones de Formato del Disco del Hardware Linux (`Neuron80GB-OS15`)**:
   - En los 1.567 modelos del disco `OS15` ([`NEURON80GB_OS15_README.md`](./DOCS/reverse_engineering/neurondb/NEURON80GB_OS15_README.md)), la resolución de ciclo de `.scape` (`csAN+0x14`) varía entre `84, 100, 168, 169, 337 y 2047` muestras/ciclo, 345 archivos `.scape` son *one-shot* sin bucle (`loop_start == loop_end == 0`), y los archivos `.sphere` usan `1, 25 o 61` bandas (`psAN+0x1C`) y `4, 8, 16, 32 o 64` floats por banda (`psAN+0x20`). El cargador leerá siempre estas dimensiones de las cabeceras `csAN`/`psAN`.
4. **4 Decisiones de Diseño Aprobadas**:
   - **Matriz de Modulación Unificada `6 × 5` en `ABDShared`**: Slot 1 = `[413..424]` (63 destinos `0x10049E00`); Slots 2..5 = `Free Controllers [363..410]`, integrada con `ABDShared/Code/MidiKeyboard`.
   - **Independencia de Frecuencia de Muestreo**: Factor `srScale = 44100.0 / sampleRate` en `EnhancedMode` (`1.0` en `StrictLegacyParity` para el oráculo *golden* a `44.1 kHz`).
   - **Resolución Inteligente de `NeuronDB` + Modelo `511 (sinew)` Embebido**: Modelo `511` (`sinew`) y preset `000 InitSound` compilados en `constexpr` + búsqueda automática de `NeuronDB`.
   - **`TrajectoryStick2D` con Estela Visual (`Trail`) y Modos `Loop` / `One-Shot`**.
   - Véase el detalle completo en [`DOCS/DSP_MIGRATION_AND_FIXES.md`](./DOCS/DSP_MIGRATION_AND_FIXES.md).

---

## 2. Estructura del Repositorio (`ABDAxionikVS`)

Siguiendo estrictamente la arquitectura de `ABDNeural`, `ABDMS2000`, `ABDEep` y las guías `abd-synth-creation-guide` / `juce-audio-hybrid-plugin`:

```text
D:\desarrollos\ABDSynths\ABDAxionikVS\
├── CMakeLists.txt                   # Build raíz (JUCE 9 Standalone + VST3 + CTest)
├── DspSources.cmake                 # Lista ÚNICA anti-drift de fuentes DSP (compartida con wasm/)
├── package.json                     # miembro del pnpm-workspace (@abdsynths/shared, @abdsynths/midi-keyb)
├── vite.config.js                   # Empaquetado de WebUI/ -> WebUI/dist/ (base: './')
├── vitest.config.js                 # Suite de tests JS/TS (contratos, codecs, UI, bridge)
├── build.bat                        # Pipeline integral con tee a build-last-run.log y selftest E2E
├── start.bat                        # Lanzador (bancada WebView2, navegador WASM, selftest)
├── README.md                        # Documentación general, compilación y banderas
├── CHANGELOG.md                     # Historial de cambios (Keep a Changelog)
├── HANDOFF.md                       # Estado vivo, arquitectura y puntos de entrada
├── ROADMAP.md                       # Plan de implementación por fases (este documento)
│
├── DOCS/                            # Corpus local completo de ingeniería inversa, manuales y UI
│   ├── UI_INVENTORY_AND_ADAPTATION.md # Inventario de los 445 parámetros, vistas y adaptación UX
│   ├── DSP_MIGRATION_AND_FIXES.md   # Cierre de incógnitas de params, eliminación de Nuke y 9 bugs corregidos
│   ├── manuals/                     # Manuales oficiales (NeuronVS, Hardware, Technical Hints, Nuke4All, BrainMapper)
│   ├── community_panels/            # Paneles Lemur (MYELIN, Axel), Bidule, PureData y Max for Live
│   └── reverse_engineering/         # Estudio RE completo (dsp, preset_format, neurondb, layout, vst2, port...)
│
├── schemas/                         # Fuentes declarativas canónicas (copiadas/validadas del estudio RE)
│   ├── preset_schema.csv            # 445 descriptores estáticos (index, key, group, min, max, default, step)
│   ├── vst_exposed_params.csv       # 26 parámetros VST expuestos al host y su mapeo a los 445
│   ├── control_params.csv           # 174 enlaces control UI <-> parámetro
│   ├── page_ref_links.csv           # 44 selectores de página/vista
│   ├── constants_types.csv          # 1.430 constantes tipadas del motor DSP
│   └── parameter_sets_mnan.json     # 10 Parameter Sets (mnAN / fdAN) compartidos con ABDNeuModMakr
│
├── Scripts/
│   ├── registry_generator.js        # Generador canónico único (C++ APVTS + JS + NRPN/CC/SysEx + bridge)
│   ├── build_webui.js               # Ejecuta vite build -> WebUI/dist/ y genera catálogo de assets
│   └── verify_golden_oracle.py      # Oráculo diferencial contra vectores áureos de NeuronVS.dll
│
├── Source/
│   ├── PluginProcessor.h / .cpp     # AudioProcessor JUCE 9 (bus Input opcional, APVTS, MIDI, estado)
│   ├── PluginEditor.h / .cpp        # AudioProcessorEditor con WebView2 (sirve WebUI/dist/ + dev probe)
│   ├── WebPilotHost.cpp             # Bancada nativa ligera WebView2 para desarrollo y selftest E2E
│   │
│   ├── Generated/                   # Emitido por Scripts/registry_generator.js (PROHIBIDO editar a mano)
│   │   ├── ParameterRegistry.gen.h  # 445 parámetros, 26 alias VST, rangos, defaults y grupos
│   │   ├── MidiContract.gen.h       # Tablas CC, NRPN (0..444) y SysEx IDs
│   │   └── BridgeContract.gen.h     # Literales versionados del protocolo WebView2
│   │
│   ├── State/
│   │   ├── SndDatStore.h / .cpp     # 445 registros de 40 B, regla FUN_10001170, 16 observadores/registro
│   │   ├── ParamsExecution.h / .cpp # Estado intermedio params (335 observadores, 340 slots efectivos)
│   │   ├── StickRecorder.h / .cpp   # Grabación y reproducción de trayectorias sound.stickrec (TTTTFCVVV)
│   │   ├── NeuronBankAdapter.h/.cpp # Carga/guardado de NeuronDB (Models/000..511, Sounds/000..999, ZIP)
│   │   └── NmModelLoader.h / .cpp   # Lector C++ de paquetes .nmmodel v2.1 de ABDNeuModMakr
│   │
│   ├── MIDI/
│   │   ├── NeuronMidiProcessor.h/.cpp # Enrutado MIDI (Note, CC 1/2/3/4/11/32, PC, AT, PB, XY CCs)
│   │   ├── NeuronNrpnHandler.h/.cpp # Direccionamiento NRPN de 14 bits para los 445 parámetros
│   │   └── NeuronSysExHandler.h/.cpp# Dumps de patch/modelo/stickrec usando ABDShared::HardwareDrivers
│   │
│   ├── WebUI/
│   │   ├── ParameterBridge.h / .cpp # Puente bidireccional APVTS <-> WebView2 (sondeo diff, sin ecos)
│   │   └── BridgeAdapters.h         # Adaptadores Preset, Model, StickRec, MIDI CC y Telemetría
│   │
│   └── DSP/                         # 100 % C++20 PURO — PROHIBIDO incluir <juce_*.h>
│       ├── Runtime/
│       │   ├── DspEngineFacade.h/.cpp # Fachada limpia consumida por PluginProcessor y por WASM
│       │   ├── DspEvent.h           # Eventos sample-accurate (NoteOn/Off, CC, PitchBend, Aftertouch)
│       │   └── VoiceMemoryPool.h    # Pool RT-safe preasignado en prepare() (sustituye new(0x2020))
│       │
│       ├── ClassicNeuron/           # Fase A: Motor Hartmann Neuron 1:1 (las 87 funciones)
│       │   ├── Constants.gen.h      # 1.430 constantes verificadas por ancho de instrucción
│       │   ├── EngineState.h        # Layout exacto de engine (0x367C B) y descriptores de voz ('nSAN')
│       │   ├── Translator.h / .cpp  # FUN_10040550 + FUN_100343e4 + validador FUN_100373a0
│       │   ├── ZoneMapper.h / .cpp  # FUN_100440d0: 128 entradas de 40 B por tecla (R1 +0xDB0, R2 +0x2200)
│       │   ├── CurveReader.h / .cpp # FUN_100317b0: lector .scape (int16, bucle, énfasis diferencial)
│       │   ├── BandReader.h / .cpp  # FUN_10031950: lector .sphere (25 bandas x 4 slots, crossfade)
│       │   ├── SphereDecoder.h/.cpp # FUN_1002e750 / FUN_1003bd10 / FUN_1003c980 / FUN_10034290 (6152 B)
│       │   ├── ResinatorVoice.h/.cpp# Motor por capa (0x6838 B): FUN_10032970, FUN_10029e34, FUN_1002e7a0
│       │   ├── BlenderStage.h/.cpp  # Mezcla dual R1/R2, modos de fusión y envolvente de Blender
│       │   ├── SilverStage.h / .cpp # Filtros multifrecuencia (3 curvas) + FreqFX + TimeFX + Stick
│       │   ├── ModulationStage.h/.cpp# LFO global, 4L4T Shaper Envelopes (R1, R2, Blender, Silver), Slicer
│       │   └── BlockOrchestrator.h/.cpp # FUN_100382b0 + adaptador de bloques de 128 muestras
│       │
│       └── HybridNeuronik/          # Fase B: Expansión "Neuron 2.0" (capacidades ABDNeural)
│           ├── SpectralShaper.h/.cpp# Inharmonicity Stretch, Parity, Entropy/Roughness, Shift, RollOff
│           ├── NmModelResinator.h/.cpp # Resinator extendido Float32 multicapa para .nmmodel v2.1
│           └── ExtendedBlender.h/.cpp  # Cruce híbrido Resinator Clásico (.sphere) <-> NEURONiK (.nmmodel)
│
├── wasm/
│   ├── CMakeLists.txt               # Build Emscripten que incluye ../DspSources.cmake (EXPORT HEAPF32)
│   └── AxionikWorkletBindings.cpp   # Wrapper C ABI para AudioWorkletProcessor
│
├── WebUI/
│   ├── index.html
│   ├── contracts/
│   │   └── bridge-protocol.json     # Contrato versionado del puente WebView2
│   ├── generated/                   # Emitido por Scripts/registry_generator.js
│   │   ├── parameterRegistry.js
│   │   ├── midiContract.js
│   │   └── layoutMap.js
│   └── src/
│       ├── app.js                   # Orquestador de vistas (Modo Clásico 33 páginas / Modo Moderno)
│       ├── bridge/                  # Cliente bridgeCore + AudioWorklet fallback
│       ├── panels/                  # R1, R2, Blender, Silver, Shapers/Mod, Setup/BankManager
│       └── styles/                  # Cascada basada en @abdsynths/shared/styles/tokens.css
│
└── Tests/
    ├── ParameterRegistryContractTest.cpp
    ├── SndDatAndTranslatorTest.cpp  # Verifica las 445 claves, 19 clamps y 351 presets en reposo/nota
    ├── GoldenOracleDspTest.cpp      # Compara salida DSP contra los 12 vectores áureos de NeuronVS.dll
    ├── ZeroAllocAudioThreadTest.cpp # Audita 0 asignaciones en processBlock / noteOn / noteOff
    ├── BridgeProtocolContractTest.cpp
    └── webviewBridgeDirectionTest.mjs
```

---

## 3. Contrato Único Autogenerado: 445 Parámetros + 26 VST + NRPN / CC / SysEx

### 3.1 El Generador Canónico (`Scripts/registry_generator.js`)
A partir de `schemas/preset_schema.csv` (445 filas), `schemas/vst_exposed_params.csv` (26 filas), `schemas/control_params.csv` (174 enlaces) y `schemas/page_ref_links.csv` (44 enlaces), el script generará sin intervención manual:
1. `Source/Generated/ParameterRegistry.gen.h`
2. `Source/Generated/MidiContract.gen.h`
3. `Source/Generated/BridgeContract.gen.h`
4. `WebUI/generated/parameterRegistry.js` y `WebUI/generated/layoutMap.js`

### 3.2 Estrategia de los 445 Parámetros (`snddat`) y los 26 Parámetros VST
- **Registro Interno Completo (445 parámetros, índices `0..444`)**:
  - Cada uno de los 445 parámetros de `sound.script` existe en `SndDatStore` con su estructura exacta de `40 B`, respetando el `step = 1.0`, la cuantización `FUN_10001170` y el clamp inicial de los **19 parámetros con `default = 0 < min = 1`**.
  - Al cambiar `R1ModellIndex` (`[22]`) o `R2ModellIndex` (`[102]`), el callback equivalente a `0x10013620` actualiza en vivo las etiquetas de eje (`mnAN`, 8 chars) y los defaults (`fdAN`) de los 12 parámetros Scape/Sphere de la capa correspondiente y los publica al WebUI mediante el mensaje `modelsState` del bridge.
- **Exposición al Host DAW (VST3 / Standalone APVTS)**:
  - **Los 26 parámetros de automatización primaria** (los 12 pares Sphere/Scape de `R1L1..L3` y `R2L1..L3` + `FilterFreq` `[274]` + `FilterReso` `[275]`) mantienen en primer orden la tabla de mapeo y normalización `0.0..1.0` idéntica a `NeuronVS_vst2` (`vtable+0x74`/`0x78`), garantizando importación directa de bancos `.fxp` (`FxCk` de 26 floats y `FPCh` de `sound.script`).
  - **Exposición completa APVTS**: Los 445 parámetros están registrados en el `AudioProcessorValueTreeState` con IDs canónicos (` SoundNameC00`..`SlicerSwitchBackup`), permitiendo sincronización diferencial completa con `WebView2`, persistencia en `getStateInformation` y automatización moderna en hosts VST3.

### 3.3 Contrato MIDI Completo: CC, NRPN de 14 bits y SysEx (`ABDShared::HardwareDrivers`)
1. **MIDI CC Nativo + Ampliado**:
   - **Controles de ejecución nativos (`params+0x44`)**: `CC 1` (Mod Wheel), `CC 2` (Breath), `CC 3`, `CC 4` (Foot), `CC 11` (Expression) y `Channel Pressure` alimentan directamente los 6 slots de ejecución en tiempo real como en `0x1000ca20`.
   - **Selección de Banco y Programa**: `CC 32` (Bank Select LSB `0..9`) + `Program Change` (`0..99`) seleccionan cualquiera de los **1.000 slots de preset** (`bank * 100 + program`).
   - **Controles Stick XY por CC (estándar comunidad NeuronVS + `MidiLearner`)**:
     - Por defecto se preconfiguran los pares CC documentados en `NeuronVS_vst2` para controlar los Sticks desde superficie externa: `CC 16/17` (`R1` Sphere/Scape XY), `CC 35/36` (`R2` Sphere/Scape XY) y `CC 52/53` (`Silver` XY), además de `CC 74` (`FilterFreq`) y `CC 71` (`FilterReso`).
     - Toda la tabla es editable mediante MIDI Learn (`MidiCcController` del bridge) y se persiste en el estado del plugin.
2. **NRPN Sin Pérdida de Resolución (445 Parámetros)**:
   - Utilizando `abd::hw::NRPNParser` de `ABDShared::HardwareDrivers`, cada parámetro de `sound.script` (`index 0..444`) es direccionable directamente vía **NRPN**:
     - `NRPN MSB (CC 99) = (paramIndex >> 7) & 0x7F` (`0..3`)
     - `NRPN LSB (CC 98) = paramIndex & 0x7F` (`0..127`)
     - `Data Entry MSB (CC 6)` + `LSB (CC 38)` transportan un entero de 14 bits (`0..16383`) que se mapea de forma exacta y biyectiva al rango entero `[min..max]` del descriptor (`rango máximo en NeuronVS: -200..+600`), eliminando la pérdida de cuantización de los CCs de 7 bits.
3. **SysEx (`abd::hw::SysExCodec`)**:
   - Empaquetado 7-bit (`SysExCodec::pack8to7` / `unpack7to8`) para:
     - **Single Parameter Change SysEx**: cambio atómico de cualquiera de los 445 parámetros o de los parámetros extendidos de Fase B.
     - **Sound Patch Dump (`sound.script` + `sound.stickrec`)**: volcado y recepción completa de un preset incluyendo las trayectorias grabadas de los Sticks.
     - **Model Header / Zone Map Inquiry**: sincronización con `ABDBankManager` y `ABDNeuModMakr`.

### 3.4 Capa de Abstracción Estricta entre Parámetros (`State`) y Motor (`DSP`)
Siguiendo el patrón arquitectónico de `ABDNeural` (`DspTypes.h` + `DspEngineFacade.h`) y `ABDMS2000` (`Conversion.gen.h` + `VoiceParameters`), establecemos una **frontera de datos planos sin JUCE** entre la gestión de parámetros y el motor DSP:
1. **Capa de Estado y Conversión (`Source/State/`)**:
   - `APVTS` + `SndDatStore` (445 registros) + `Conversion.gen.h` (autogenerado por `Scripts/registry_generator.js`: `normalizedToDomain` / `domainToNormalized`).
   - Convierte los valores crudos/normalizados y las modulaciones de los 6 controles de ejecución en un **snapshot plano e inmutable por bloque (`AxionikDspParams`)** definido en `Source/DSP/DspTypes.h` (100 % libre de JUCE, con layout ABI fijo compartido con WASM).
2. **Frontera `DspEngineFacade` (`Source/DSP/Runtime/DspEngineFacade.h`)**:
   - El hilo de audio nunca consulta `APVTS`, ni strings de IDs, ni `snddat`. Solo consume el snapshot pendiente `AxionikDspParams` (entregado vía `setGlobalParams` / `setExecutionParams` con handoff lock-free RT-safe), lo pasa por el traductor `Translator::translate` (`FUN_10040550`) cuando hay cambios y renderiza el bloque.

---

## 4. Traducción de las 87 Funciones DSP (`NeuronVS_dsp`) a C++20 Puro sin JUCE

### 4.1 Reutilización Directa de `NeuronVS_port` (Base Ya Verificada)
Incorporaremos y adaptaremos al namespace `Axionik::DSP::Classic` el trabajo ya validado en `C:/Users/ajaba/Downloads/neuron/NeuronVS_port`:
- **`ParameterTable` (`params.hpp`)**: Los 445 descriptores y la regla exacta `FUN_10001170`.
- **`SoundPreset` (`preset.hpp`)**: Parser/serializador 1:1 de `sound.script` (incluyendo la migración de `SlicerSwitchBackup` para los presets `011`, `012` y `023`, y la migración `BlenderAmount -= 64` para versión 1 de `FUN_10013ea0`).
- **`Scape`, `Sphere`, `CurveReader` (`FUN_100317b0`) y `BandReader` (`FUN_10031950`) (`neurondb.hpp`)**: Carga de chunks RIFF-like (`csAN`, `psAN`, `mnAN`, `fdAN`), lectura de curva `int16` en `+0x104` con énfasis diferencial y lectura interpolada de las 25 bandas × 4 slots.
- **`translate` (`FUN_10040550`) y `FUN_100373a0` (`translator.hpp` / `translator.cpp`)**: Volcado de los 456 writes sobre `engine[0x000..0x36A]` y validación de las tablas de zonas de teclado.
- **`loadKeyZones` (`FUN_100440d0`)**: Construcción de las `128 × 40 B` entradas por tecla en `engine+0xDB0` (`R1`) y `engine+0x2200` (`R2`).

### 4.2 Desglose de Traducción de las 87 Funciones del Camino de Audio
Las 87 funciones alcanzables desde `FUN_100382b0` (sin ninguna llamada indirecta) se agrupan en **7 módulos C++20 deterministas** apoyados en `ABDShared::DspCore` (`namespace abd::dsp`) y `schemas/constants_types.csv` (que corrige las 306 constantes `f64 -> f32` respecto a Ghidra):

| Módulo en `Source/DSP/ClassicNeuron/` | Funciones Principales del Binario (`0x10021C90..0x100478D0`) | Responsabilidad Técnica |
|---|---|---|
| **`BlockOrchestrator`** | `0x1000bc40` (adaptador 128 muestras), `FUN_100382b0` (orquestador de bloque, `8.320 B`), `FUN_100343e4` (sub-objeto `e[0xD95]`) | Bucle maestro por bloque interno de 128 muestras, acarreo de resto de frames (`+0x3A4`), despacho de eventos de voz, suma polifónica y etapa de salida (con flag `OracleClipToZeroMode`). |
| **`VoiceDispatcher & ZoneMapper`** | `FUN_1003d800` (`noteOn`), `FUN_1003dda0` (`noteOff`), `FUN_1003c350` (cierre de voz), `FUN_100440d0` (zonas), `FUN_100373a0` (validador) | Gestión de los 129 descriptores `'nSAN'` (`0x70 B`), límite de polifonía (`SoundNumVoices` `4..12`, máx 32), copia de los bloques espejo `0x588 B` (`+0x284` / `+0x80C`) a `motor+0x638C` y selección `LowSource`/`HiSource` por umbral `params+0x418`. |
| **`ResinatorVoice` (Curves & Bands)** | `FUN_10032970` (init motor `0x6838 B`), `FUN_10032d10` (bind `.scape`/`.sphere`), `FUN_100317b0` (`CurveReader`), `FUN_10031950` (`BandReader`), `FUN_10032940`, `FUN_10031cd0` | Avance de fase de excitación `.scape` (`100` muestras/ciclo, bucle `loopStart..loopEnd`, énfasis de 2 puntos) e interpolación de frames de las 25 bandas formánticas de `.sphere` (`1024`/`512` muestras por frame). |
| **`SphereDecoder` (Banco Aditivo/Espectral)** | `FUN_1002e750`, `FUN_1002e7a0` (`3.816 B`), `FUN_10029e34` (`4.294 B`), `FUN_1003b9f0` (`4.185 B`), `FUN_1003bd10` (`3.149 B`), `FUN_1003c980` (`4.539 B`), `FUN_10034290` (`2.126 B`) | Decodificación del bloque de `6.152 B` (1.024 parciales) de cada `SphereFrame`, deformación en tiempo real mediante los ejes `mnAN`/`fdAN` (Niveles 1, 2 y 3 de Sphere/Scape) y síntesis del núcleo resonador. |
| **`BlenderStage`** | Sub-rutinas de mezcla dual dentro de `FUN_100382b0` y `FUN_10035bd0` (`1.608 B`) | Fusión entre `Resinator 1` y `Resinator 2` según `BlenderType`, `BlenderAmount` y modulación por la envolvente dedicada de Blender. |
| **`SilverStage` (Filtros + FreqFX + TimeFX)** | `FUN_10025a30` (`2.495 B`), `FUN_100263f0` (`2.099 B`), `FUN_100277b0` (`2.264 B`), `FUN_10022ab0` (`1.347 B`), `FUN_10023250` (`1.127 B`), `FUN_10024600` (`1.279 B`), `FUN_100283c0` (`1.396 B`) | Los 3 filtros multifrecuencia en paralelo/serie (`24dB LP`, `12dB LP`, `6dB LP`, `BP`, `HP`, `Bandreject`) + bloque `FreqFX` (RingMod / Decimator / Sp-Warp / Comb / Phaser / Chorus / Flanger) + bloque `TimeFX` (Stereo Delay / Reverb / Dist) + EQ de 4 bandas, gobernados por el Stick de Silver. |
| **`ModulationStage & StickPlayback`** | `FUN_1003a280` (`1.832 B`), `FUN_100368d0` (`1.653 B`), `FUN_1003f4d0` (`1.167 B`), `FUN_1003fc20` (`1.454 B`), `FUN_10046cf0` (`1.358 B`) | LFO polivalente (10 formas de onda, sync MIDI), los 4 generadores de envolvente **4L4T Shaper** (`R1`, `R2`, `Blender`, `Silver` con modos Normal/Repeat/Longest y Free/Fixed), Slicer/Gate (`3D/2D`, Switch, Warp) y reproducción de trayectorias `sound.stickrec`. |

### 4.3 Eliminación de Asignaciones Dinámicas en `noteOn` (`VoiceMemoryPool`)
- **Hallazgo crítico en el binario original**: `FUN_1003d800` (`noteOn`) y `FUN_10032970` ejecutan hasta 16 llamadas a `operator_new(0x2020)` (`8.224 B` cada una, ~`131 KB` por nota) en pleno hilo de audio cuando una voz arranca por primera vez, y `FUN_1003c350` las libera con `operator_delete`.
- **Solución RT-Safe en `ABDAxionikVS`**:
  - Diseñaremos `VoiceMemoryPool` dentro de `Source/DSP/Runtime/`: en `DspEngineFacade::prepare(sampleRate, maxBlockSize)` se preasignan de forma contigua todos los bloques de trabajo (`32 voces × 2 motores × 16 buffers de 0x2020 B ≈ 8.2 MB` o el número máximo de voces configurado).
  - Durante `processBlock` / `noteOn` / `noteOff`, `ResinatorVoice` toma sus buffers del pool mediante punteros fijos pre-enlazados (**cero llamadas a `new`/`malloc`/`free`/`delete`** en el hilo de audio, verificado por `Tests/ZeroAllocAudioThreadTest.cpp` y compatible 100 % con el heap estático de `AudioWorklet` en WASM).

---

## 5. Integración con el Ecosistema `ABDShared` (Consumir vs. Aportar)

### 5.1 Componentes que Consumiremos y Ampliaremos en `ABDShared` (Cero Duplicación)
1. **Desde `ABDSharedCode` (`CMake` `add_subdirectory(../ABDShared/Code ...)`)**:
   - **`ABDShared::DspCore` (`namespace abd::dsp`)**: `AudioBuffer`, `MidiBuffer`, `MidiMessage`, `SmoothedValue`, `ScopedNoDenormals`, `Random` (siempre con semilla determinista explícita `1234567`), `DspMath.h` (transcendentales deterministas para paridad WASM ↔ nativo, sin `libm` divergente).
   - **`ABDShared::DspEffects` (`namespace abd::dsp`) — Todos los Efectos de `Silver` y `Master FX` viven en `ABDShared`**:
     - Siguiendo las normas estrictas de `ABDShared/Code/DspEffects` (como en `ABDMS2000`: `DspMS2000ChorusFlanger.h`, `CascadeShelfEq.h`, `profiles/MS2000EqProfile.h`, `FxRegistry.h` y `adapters/BasicAdapters.h`):
       - **El motor habla unidades físicas (Hz, ms, dB, muestras)**, es header-only en C++20 puro libre de JUCE y sin métodos virtuales en el lazo de audio.
       - Los motores de efectos de `Silver` (**Filtro Multimodo 5 curvas**, **EQ 4 Bandas + Compresor**, **Distortion 6 curvas**, **Ring Modulator + Xover Delay**, **Sp-Warp**, **Decimator**, **Stereo Spread**, **L/R Delay**, **Flanger**, **Phaser**, **Chorus**) y de `Master FX` (**Stereo Delay con Damping** y **Master Reverb de 5 Salas**) se implementarán en `D:\desarrollos\ABDSynths\ABDShared\Code\DspEffects\` (con sus perfiles en `DspEffects/profiles/NeuronSilverProfile.h` y sus adaptadores en `BasicAdapters.h` + `Contracts/fx-effects.json`).
       - En `ABDAxionikVS`, `SilverStage` y `MasterFxStage` serán **shims ligeros de producto** (idénticos en filosofía a `ABDMS2000/Source/DSP/Effects/Equalizer.h` y `ModFX.h`) que traducen las unidades del Neuron al motor compartido.
       - Esto garantiza que todos los efectos del Neuron puedan usarse en otros proyectos actuales y futuros de `ABDSynths`, y que en la versión expandida de `ABDAxionikVS` podamos montar cualquiera de los **+60 efectos** del catálogo `ABDShared::DspEffects`.
   - **`ABDShared::SynthCore` (`namespace abd::synth`) — Matriz Aséptica `ModMatrix.h`**:
      - `AudioThreadSnapshot`, `VoiceAllocator` y **`ModMatrixT<kNumSlots, kZeroIdInert>`** (`ModRoute`, `ModDestinationDescriptor`).
      - La matriz **`Free Controllers` (`[363..410]`, 6 fuentes × 4 destinos = 24 rutas) + Macros de Ejecución (`[413..424]`, 6 rutas)** se integrará sobre `ABDShared::SynthCore::ModMatrixT` y `ABDShared/Components/modMatrix.js` + `ABDShared/Contracts/abdaxionikvs_modulation_matrix.json`, manteniendo la regla de oro de `ABDShared`: **el motor y la vista son 100 % asépticos (índices opacos sin vocabulario de producto)** y la tabla declarativa aporta los nombres, rangos y categorías.
    - **`ABDShared::HardwareDrivers` (`namespace abd::hw`)**: `SysExCodec` y `NRPNParser` para el motor MIDI/NRPN/SysEx.
    - **`ABDShared::WebView2Bridge`**: `JuceWebView2Component` y `WebView2ResourceProvider` para servir `WebUI/dist/` embebido y la sonda al servidor Vite en Debug.
    - **`ABDShared::AudioComparator`**: Motor de comparación acústica A/B para las pruebas de certificación contra los WAV áureos de `NeuronVS.dll`.
    - **`ABDShared::BankManagerCore` (`ABDBankManager`)**: Gestión de librerías, bancos y presets integrada en el plugin.
    - **`ABDShared::NeuronFormats` (`@abdsynths/shared/formats/neuron`)**: Codecs universales 1:1 para contenedores `.model` (`.scape`, `.sphere`, `map.script`, `MName`, `ModelNames`), `.sound` (`sound.script`, `sound.stickrec`, `SoundNames`), decodificador puro RIFF/WAVE y FORM/AIFF (`WavAiffDecoder.ts`) y empaquetador ZIP (`ZipArchive.ts`). Consumidos directamente en Fase A.1.
    - **`ABDShared::DspCore::NeuronAnalysis` (`@abdsynths/shared/dsp/neuron-analysis`)**: Motor de análisis espectral de alta resolución (Radix-2 FFT 8192 pts con 4-term Blackman-Harris, HPS con escala de octavas, ajuste de rejilla armónica LS, clustering multicapa de 1..3 capas y generador paramétrico Scape/Sphere). Consumido en Fase B.
    - **`ABDShared::Visualizers` (`@abdsynths/shared/visualizers/SpectralCanvasVisualizer.js`)**: Visualizador gráfico Canvas 2D multimodo de alta fidelidad: espectrograma con estela temporal, barras de 64 parciales armónicos superpuestas a curva FFT en tiempo real y comparador diferencial de formas de onda A/B.
    - **`ABDShared::Scope` (`SpectrogramRenderer.js`)**: Renderizador cascada / waterfall enriquecido con superposición de trazas armónicas (`frame.partialTracks`), permitiendo monitorear las trayectorias de parciales simultáneamente con la densidad espectral global.
2. **Desde `ABDShared/Code/MidiKeyboard` (`@abdsynths/midi-keyb`) y `ABDSharedAssets` (`@abdsynths/shared`)**:
   - **Teclado Unificado (`D:\desarrollos\ABDSynths\ABDShared\Code\MidiKeyboard`)**: integrado directamente con los 6 controles de ejecución (`params+0x44`: `Aftertouch`, `ModWheel Up/Down`, `Breath CC2`, `CC3`, `Foot CC4`, `Expression CC11`), `PitchBend` (`engine+0xDA4`) y `FootSwitch` (`[411]`), alimentando en tiempo real la matriz `Free Controllers` (`[363..410]`). Registrado con altura 98px para hosts multicapa.
   - Tokens y cascada CSS (`@abdsynths/shared/styles/tokens.css`), fondo canónico neutral (`ABDShared/Assets/assets/backgrounds/bg_neutral.webp`), `SynthNavBar`, `AboutDialog`, `Knob`, `SilverFilmstripKnob`, `Slider`, `FilmstripFader`, `Segmented`, `Select`, `Toggle`, `Switch`, `XYPad`, `EnvelopePad`, `ModMatrix`, `SevenSegmentDisplay`, `VuMeter`, `SpectrumPlotter`, `LiveSysExInspector`.

### 5.2 Componentes Nuevos Desacoplados Aportados a `ABDShared`
Siguiendo la directriz de volcado transversal hacia `ABDShared`:
1. **Iconografía Canónica Hartmann en `ABDShared/Assets/icons/`**:
   - 10 iconos SVG de los `Parameter Sets` (`param0.svg` .. `param9.svg`): Neutral, Strings, Woodwinds, Brass, Keyboards, Percussive, Complex Acoustic, Synthetic, Scapes, Extravaganza.
   - 4 iconos SVG de utilidad de edición y modelado: `undo.svg`, `redo.svg`, `repair.svg` y `palette.svg`.
2. **`TrajectoryStick2D` (`@abdsynths/shared/components/trajectoryStick2D.js` + CSS)**:
   - Evolución o extensión limpia de `XYPad` que añade:
     - **Anillo multipolar de nombres de eje dinámicos (`mnAN`)**: muestra hasta 4/6 etiquetas dinámicas en el perímetro según el nivel activo (`Level 1, 2, 3`) e ilumina la distribución de pesos.
     - **Grabación y reproducción de trayectorias vectoriales (`Stick Recording`)**: visualización de la estela temporal en `<canvas>`/`<svg>`, estados `Idle / Armed / Recording / Playing / Loop`, y serialización agnóstica de puntos `(tick, axis, value)`. Reutilizable en sintes vectoriales futuros (Korg Wavestation, Prophet VS, Yamaha SY22/TG33).
3. **`MultiStageShaperPad` (`@abdsynths/shared/components/multiStageShaperPad.js`)**:
   - Extensión de `EnvelopePad` para envolventes **4L4T (4 Levels / 4 Times)** con modos `Normal / Repeat / Longest` y pendiente `Free / Fixed`, reutilizable en sintetizadores digitales/FM/aditivos de la familia ABD (`ABDCZ101`, `ABDOmega`, etc.).
4. **`NeuronCodec` / Adaptador de Bancos `.sound` y `.model` para `ABDBankManager`**:
   - Adaptador en `ABDBankManager` apoyado en `@abdsynths/shared/formats/neuron` para inspeccionar, catalogar, importar y exportar carpetas `NeuronDB` (`Models/000..511.model`, `Sounds/000..999.sound`) y archivos empaquetados `.model`, `.sound` y `.nmmodel`.

---

## 6. Plan de Implementación por Fases (`ROADMAP`)

### Fase 0 — Cimientos, Contratos Autogenerados y Esqueleto Dual (Nativo + WASM) [COMPLETADA]
- **Objetivos Cumplidos**:
  1. Registrado `ABDAxionikVS` en `D:\desarrollos\ABDSynths\pnpm-workspace.yaml`.
  2. Creado `schemas/` con `preset_schema.csv` (445 params), `vst_exposed_params.csv` (26 VST), `params_observers_map.csv` (335 obs y 63 mod dests), `constants_types.csv` (1.430 constantes), `control_params.csv`, `page_ref_links.csv` y `parameter_sets_mnan.json` (10 sets Scape/Sphere).
  3. Implementado `Scripts/registry_generator.js` con `--check`, emitiendo `ParameterRegistry.gen.h`, `Conversion.gen.h`, `MidiMapping.gen.h`, `parameters.gen.ts` y `bridge-protocol.json`.
  4. Configurados `DspSources.cmake` (anti-drift), `CMakeLists.txt` raíz (JUCE 9 `Standalone` + `VST3` + `WebPilotHost` con `NEEDS_WEBVIEW2 TRUE` y `JUCE_VST3_CAN_REPLACE_VST2=0`) y `wasm/CMakeLists.txt` con `WasmBridge.cpp`.
  5. Implementado frontend WebUI inicial en `WebUI/` con **paridad visual y estética idéntica a `ABDNeuModMakr`** (tokenizado 100% con `@abdsynths/shared/styles`, Navbar HUD con logo, presets, modelos, telemetría CPU/voces, racks de síntesis R1/R2 con sticks 2D circulares, Blender, Filter, Silver FX, Drawers deslizantes y `KeyboardStrip` interactivo con `@abdsynths/midi-keyb`).
  6. Empaquetado Vite verificado (`Scripts/build_webui.js` -> `WebUI/dist/`), suite de pruebas Vitest pasando 5/5 tests, y scripts `build.bat` y `start.bat`.
- **Verificación (DoD) Alcanzada**:
  - `build.bat nopause` compila sin errores los 3 targets nativos con MSVC:
    - `build\ABDAxionikVS_artefacts\Release\Standalone\ABDAxionikVS.exe`
    - `build\ABDAxionikVS_artefacts\Release\VST3\ABDAxionikVS.vst3`
    - `build\ABDAxionikVS_WebPilot_artefacts\Release\ABDAxionikVS WebPilot Host.exe`
  - Smoke test E2E ejecutado: `ABDAxionikVS WebPilot Host.exe --auto-quit` monta el WebView2 con `WebUI/dist/` y sale limpiamente con código 0.
  - Repositorio Git inicializado con remote `origin https://github.com/ajabadia/ABDAxionikVS.git` y commit inicial de Fase 0 creado.

### Fase A.1 — Estado de Parámetros (`snddat` / `params`), Traductor (`FUN_10040550`) y Carga de `NeuronDB` [COMPLETADA]
- **Objetivos Cumplidos**:
  1. Integrados en `Source/State/` y `Source/Dsp/` la tabla de 445 parámetros (`SndDatStore`), la regla `FUN_10001170` (con los 19 defaults ajustados a `1.0`), los 335 observadores de `params` y el cálculo continuo de los 340 valores efectivos (`ParameterEngineBridge`).
  2. Integrado `Translator.cpp` (`FUN_10040550` + `FUN_100373a0` + `FUN_100343e4` en `TranslatorHooks.cpp` para `e[0xD95]`).
  3. Implementado `NeuronBankAdapter` y `ZoneMapper` (`FUN_100440d0`): lectura de `Models/000..511.model` (`MName`, `map.script`, `.scape`, `.sphere`), carga de zonas y relleno de las `128 × 40 B` entradas por tecla en `engine+0xDB0` (`R1`) y `engine+0x2200` (`R2`).
  4. Lector de bancos y presets con compatibilidad para paquetes `.model` y `.sound` de NeuronDB / ABDNeuModMakr.

### Fase A.2 — Motor de Voz Clásico: `Resinator 1`, `Resinator 2`, `.scape`, `.sphere` y `Blender` [COMPLETADA]
- **Objetivos Cumplidos**:
  1. `NeuronVoicePool` y `NeuronVoice`: ciclo de vida de voz polifónica con robo determinista de voz más antigua (`FUN_100403b0`), soporte de 12 voces simultáneas y asignación preasignada RT-safe.
  2. Síntesis multicapa en `NeuronOscillators.h`: `ResynatorLayer` acoplando `CurveReader` (Scape, `FUN_100317b0`) y `BandReader` (Sphere, `FUN_10031950`) con coordenadas dinámicas 2D, nivel y desafinación analógica.
  3. `CResynator` (`0x6838` bytes, `FUN_1002e7a0`): orquesta las 3 capas canónicas (`L1`, `L2`, `L3`) para `R1` y `R2` y despacha los **7 algoritmos de síntesis Parset** (`FUN_10031d30`):
     - Parset 0: Mezcla aditiva ponderada y formantes (`CParsetEngine0` / `FUN_10025380`).
     - Parset 1: Modulación cruzada de fase FM (`CParsetEngine1` / `FUN_10023990`).
     - Parset 2: Inclinación espectral armónica *Harmonic Tilt* (`CParsetEngine2` / `FUN_10032660`).
     - Parset 3: Desplazamiento de picos resonantes (`CParsetEngine3` / `FUN_10023df0`).
     - Parset 4: Saturación no-lineal multibanda (`CParsetEngine4` / `FUN_10032260`).
     - Parset 5: Modulación en anillo *Double Sideband* (`CParsetEngine5` / `FUN_10024530`).
     - Parset 6: Dispersión espacial y entrelazado espectral (`CParsetEngine6` / `FUN_10031e70`).
  4. `BlenderStage`: crossfade lineal canónico continuo entre `R1` y `R2` gobernado por `BlenderAmount` (`[262]`).

### Fase A.3 — Etapa `Silver`, Efectos Maestros y Orquestador de Bloques [EN PROGRESO / DSP INTEGRADO]
- **Objetivos**:
  1. [COMPLETADO] Etapa `Silver` en `NeuronSilverRack.h` (`CSilverRack::Process`, `FUN_10029e34`):
     - `SilverFilter` (`FUN_10042a30`): filtro multimodo (LP12/24, BP, HP, Notch) con saturación analógica previa (*Drive*).
     - `SilverFreqFX`: los 9 algoritmos de modulación espectral (FreqShift, RingMod, Distortion, Decimator, Formant, Comb, Resonator, Treemonster).
     - `SilverTimeFX`: los 7 algoritmos de modulación temporal (Chorus, Flanger, Phaser, Delay, Multi-Tap, Reverb) con la corrección `Reset()` de Stephan Bernsee (Mac 1.56).
  2. [COMPLETADO] Efectos maestros en `NeuronSilverRack.h`:
     - `CMasterModFX` (apertura estéreo M/S, `FUN_1003d6f0`).
     - `CMasterTimeFX` (reverberación espacial y delay maestro, `FUN_1003bd10`).
  3. [COMPLETADO] `NeuronBlockPump.h` (`0x1000bc40` / `FUN_100382b0`): bombeo de bloques fijos de 128 muestras con recorte a cero canónico (*clip-to-zero*).
  4. [COMPLETADO] Cableado en `DspEngineFacade.cpp`: conexión de los 24 parámetros de oscilador VST, Parsets, tunings, envolventes ADSR, blender y filtros al bucle de audio.
  5. [PENDIENTE] Certificación offline de paridad sonora y vectores de prueba con oráculo áureo.

### Fase A.4 — Interfaz `WebUI` Adaptada y Mejorada (100 % de los 445 Parámetros) y Volcado a `ABDShared`
> **Referencia de diseño obligatoria:** [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md)
> No replicaremos el aspecto estático ni el laberinto de 33 sub-páginas de 2004 del `NeuronVS` original. En su lugar, adaptaremos y mejoraremos todos sus controles, pantallas, selectores y opciones dentro del sistema de diseño de `ABDSynths` (`@abdsynths/shared`), exponiendo por primera vez los **445 parámetros completos** (incluyendo el rack `Master FX` `[430..444]`, la matriz `Free Controllers` `[363..410]`, `ModelVelocitySwitch` y las 24 profundidades `ResEnv` que el plugin de 2004 ocultaba o fragmentaba).

- **Objetivos**:
  1. Desarrollar y aportar a `ABDSharedAssets` los componentes genéricos **`TrajectoryStick2D`** (con anillo multipolar de etiquetas dinámicas `mnAN` de los 10 `Parameter Sets` y grabación/reproducción de trayectorias `sound.stickrec`) y **`MultiStageShaperPad`** (envolvente gráfica bipolar `4L4T`), con sus tests Vitest.
  2. Construir la `WebUI` de `ABDAxionikVS` empaquetada con Vite (`WebUI/dist/`):
     - **Cabecera Global Siempre Visible**: `SynthNavBar`, selector de bancos/presets integrado con `ABDBankManager`, nombre editable de 16 caracteres (`SoundNameC00..C15`), polifonía (`SoundNumVoices` `1..32` + voces activas), `SoundPan` / `SoundPanKeyTrack`, `PitchBendRange`, 4 Macro Knobs (`Knob1..4R1Select`), conmutador `OracleClipToZeroMode`, VU meter y osciloscopio `ABDShared::Scope` con visualización waterfall y trazas armónicas (`frame.partialTracks`).
     - **Cubierta Principal de Síntesis (`Resynator 1` + `Blender & Slicer` + `Resynator 2`)**:
       - En cada Resynator: selector de modelo `000..511` con buscador, display `MName` (11 chars), badge del `Parameter Set` (`0..9`), visor del mapa de teclado de 128 notas (`LowSource`/`HiSource` + `ModelVelocitySwitch`), afinación (`Octave`, `Semi`, `Cents`, `PitchKeyTrack`, `PitchLfoDepth`, `FreeADSR1/2`, `4L4T`), tamaño (`ModelSizeOffset`, `ModelSizeKeyTrack`), `TrajectoryStick2D`, conmutadores rápidos `Sphere / Scape` y `Level 1 / 2 / 3`, y las dos columnas de modulación de eje (`Eje 1/3` y `Eje 2/4`: `KeyTrack`, `LfoDepth`, `VelocityDepth`, `ResEnvDepth`, `Contour` y `StickPlayback`) visibles simultáneamente sin el conmutador ciego `SelectStickPar`.
       - En el centro: **Blender** con los 10 algoritmos de fusión (`Mix`, `Chromophonic`, `Transsphere`, `Crossmorph`, `Intermorph`, `Dyn Transsphere`, `Dyn Crossmorph`, `Velo Crossmorph`, `Velo Chrome`, `Ring Blend`), fader bipolar `-64..+63` y sus 4 moduladores + **Slicer** (`Off`, `Vertical`, `3D`, `Rate`, `Depth`, 12 formas de onda).
     - **Rack Inferior sin Sub-Laberintos (3 Pestañas Amplias)**:
       - **Pestaña 1 — `SHAPERS & LFO`**: `Shaper 1` (`R1 Amp ADSR`, `R1 ResEnv ADSR` + matriz de 12 profundidades, `Free ADSR 1`), `Shaper 2` (`R2 Amp ADSR`, `R2 ResEnv ADSR` + 12 profundidades, `Free ADSR 2`), envolvente gráfica combinada **`4L4T`** (`MultiStageShaperPad`) y **LFO Global** (12 formas de onda, `Rate 0..20 Hz`, `Delay` bipolar Fade-Out / Fade-In).
       - **Pestaña 2 — `SILVER & MASTER FX`**: Stick 2D de Silver (`L1 Filter`, `L2 FreqFX`, `L3 TimeFX`) + `Shaper 3` (`EFX Mix` / `Filter Env`), Filtro Multimodo (5 curvas: `24dB/12dB/6dB LP`, `6dB HP`, `BP`), tarjeta completa de `FreqFX` (con las 4 bandas de **EQ + Compresor** unificadas en una sola vista con curva interactiva, más `Distortion` 6 curvas, `Ring Modulator` con Xover Delay, `Sp-Warp` y `Decimator`), tarjeta completa de `TimeFX` (`Stereo Spread`, `L/R Delay`, `Flanger`, `Phaser`, `Chorus` sin paginación interna) y rack **`Master FX`** (`Stereo Delay` con Tap Tempo + `Master Reverb` con 5 tipos de sala).
       - **Pestaña 3 — `MOD MATRIX & ZONES`**: Matriz completa de `Free Controllers` (`6 fuentes × 4 destinos`, `[363..410]`), los 6 controles MIDI de ejecución en vivo (`Aftertouch`, `CC 1`, `CC 2`, `CC 3`, `CC 4`, `CC 11` `[413..424]`), `FootSwitchDest` (`[411]`), MIDI Learn y visor detallado de las 128 zonas de teclado (`map.script`) de `R1` y `R2`.
     - **Pie de Página**: Teclado MIDI compartido (`@abdsynths/midi-keyb`) y barra de transporte/grabación global de `StickRec`.
  3. Conectar `ParameterBridge` (telemetría espectral/envolventes/sticks a ~15-30 Hz con diffing, carga de modelos y presets, aprendizaje MIDI CC) y validar el selftest E2E en Standalone y Bancada WebView2.
- **Verificación (DoD)**:
  - Cierre de la **Fase A (Hartmann Neuron Clásico 1:1)**: `build.bat nopause` 100 % en verde (CTest + Vitest + Selftest E2E en las dos superficies + paridad WASM `AudioWorklet`).

---

### Hito de Diseño Intermedio (Gate A → B) — Sesión de Definición de la Fase B
> [!IMPORTANT]
> **Compromiso de Hoja de Ruta:**
> La **Fase B (`NEURONiK` / "Neuron 2.0") NO se iniciará automáticamente** al terminar la Fase A. Una vez certificado el sintetizador clásico 1:1, abriremos una **sesión de diseño dedicada con el usuario** para discutir, prototipar y acordar en detalle:
> 1. Cómo conviven o se conmutan los modelos clásicos `.model` (`NeuronDB`) y los modelos extendidos `.nmmodel v2.1` (`ABDNeuModMakr`) en cada Resynator.
> 2. Qué moldeadores espectrales de `ABDNeural` (*Inharmonicity Stretch*, *Parity*, *Entropy/Roughness*, *Shift*, *RollOff*) se incorporan, con qué rangos y cómo se mapean a los Sticks o a nuevos controles en la interfaz.
> 3. Si añadimos un tercer Resynator / morphing de 4 esquinas (`A/B/C/D`) o si ampliamos la arquitectura dual `R1 + R2 + Blender`.

### Fase B — Expansión "Neuron 2.0" Híbrida (`NEURONiK` + `.nmmodel v2.1` de `ABDNeuModMakr`) *(Sujeta a Gate de Diseño A → B)*
- **Objetivos Preliminares (a refinar en el Gate A → B)**:
  1. **Soporte Nativo de `.nmmodel` (`v2.1`)**:
     - Implementar `NmModelLoader` y `NmModelResinator` en `Source/DSP/HybridNeuronik/` para cargar directamente paquetes `.nmmodel` generados por `ABDNeuModMakr` (precisión `Float32`, 64 parciales inarmónicos con `frequencyOffsets` en semitonos, múltiples capas de velocidad/nota y muestras WAV embebidas), integrando los módulos de análisis y modelado espectral `@abdsynths/shared/dsp/neuron-analysis` (`FftEngine`, `SpectralAnalyzer`, `LayerClustering`, `ScapeSphereGenerator`).
  2. **Moldeadores de Materia Sónica de `ABDNeural` (`SpectralShaper`)**:
     - Integrar en cada Resinator (o en el modo extendido `NEURONiK`) los operadores espectrales de `ABDNeural/Source/DSP/CoreModules/Resonator.cpp`:
       - *Inharmonicity Stretch*: $f_n = f_0 \cdot (n + \Delta_n) \cdot \sqrt{1 + B \cdot n^2}$
       - *Parity (Par/Impar)* y *Spectral Shift*
       - *Entropy / Roughness* (micro-modulación determinista por parcial) y *HF RollOff*
  3. **Modo Híbrido Dual / `Resinator 3` (Morphing 4-Way A/B/C/D)**:
     - Permitir que `R1` y `R2` operen indistintamente con modelos clásicos `.model` (`NeuronDB`) o con modelos `.nmmodel` (`ABDNeuModMakr`), e incorporar el modo de morphing bilineal de 4 esquinas (`Slots A..D`) de `ABDNeural`.
  4. **Puente Directo `ABDNeuModMakr` ↔ `ABDAxionikVS`**:
     - Carga en caliente (Drag & Drop o vigilancia de directorio) de archivos `.model` y `.nmmodel` recién sintetizados desde `ABDNeuModMakr`.
- **Verificación (DoD)**:
  - Suite de pruebas de `HybridNeuronik` verificando paridad matemática con `ABDNeural::DSP::CoreModules::Resonator`, carga sin artefactos de `.nmmodel v2.1` multicapa y paridad bit-exacta entre el build nativo (`VST3`/`Standalone`) y el `AudioWorklet` WASM.


---

### Fase C / Expansión Futura — Pantalla LCD Superior Fija y Monitor de Telemetría (Post-Fase B)
> [!NOTE]
> **Planificación a largo plazo:** Este hito se abordará al concluir la Fase B. Implementará una pantalla LCD panorámica fija superior, inspirada en la arquitectura de `ABDMS2000` (`Sticky Top Hero Bar`), estrecha pero larga, reutilizando los componentes LCD de `ABDShared` (`ABDShared/Components/LcdDisplay`, `lcdMachine.js`, `lcdPanel.js`, `lcdScreen.js` y `lcd.css`).

- **Objetivos de la Pantalla LCD Superior**:
  1. **Emulación y Visor de Pantallas del Hardware Original**:
     - Visualizar la información de contexto de todas las pantallas y sub-páginas clásicas del `NeuronVS` original (las 33 vistas de 2004) y los menús del sintetizador hardware Hartmann Neuron (`Setup`, `Bank`, `Model`, `Resynator`, `Blender`, `Silver`, `Modulation`, `Zones`).
  2. **Telemetría y Monitorización de Parámetros en Tiempo Real**:
     - Al interactuar el usuario con cualquier potenciómetro, fader, selector o stick, el LCD mostrará instantáneamente en cabecera:
       - Nombre formal y legible del parámetro activo.
       - Valor actual normalizado y valor en su dominio físico real (Hz, dB, %, ms, semitonos).
       - Identificador de mapeo MIDI: Código CC correspondiente (si está asignado), código NRPN de 14 bits (`CC 99/98/6/38`, `0..444`) y trama de comando SysEx asociada.
  3. **Monitor Visual de Automatizaciones y Reproducción de Trayectorias**:
     - Mostrar en vivo el estado del grabador vectorial de trayectorias (`REC / PLAY / IDLE`).
     - Renderizar la evolución temporal de las automatizaciones grabadas en los Sticks cuando se pulse `PLAY`, mostrando coordenadas $X, Y$, estela en miniatura y barra de progreso temporal en tiempo real sobre el display LCD.
  4. **Alineación con el Ecosistema `ABDShared`**:
     - Consumir el subsistema LCD de `ABDShared` (`LcdMachine`, `LcdPanel`, `LcdScreen`) con tipografía retro segmentada/matriz de puntos, contraste adaptable según el tema activo y formateador de menús similar a `LCDMenuFormatter.h` de `ABDMS2000`.
