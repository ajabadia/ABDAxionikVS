# ABDAxionikVS — Informe de Arquitectura y Plan de Implementación (`ROADMAP.md`)

> **Proyecto:** `ABDAxionikVS` (`D:\desarrollos\ABDSynths\ABDAxionikVS`)
> **Repositorio GitHub:** `https://github.com/ajabadia/ABDAxionikVS.git`
> **Documentación de Referencia e Ingeniería Inversa:** [`DOCS/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS), [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md) y [`DOCS/DSP_MIGRATION_AND_FIXES.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/DSP_MIGRATION_AND_FIXES.md)
> **Objetivo:** Recreación moderna, verificable bit a bit y extensible del sintetizador **Hartmann Neuron / NeuronVS**, integrada en el ecosistema **ABDSynths** (`JUCE 9` + `C++20` puro sin JUCE en DSP + `WebAssembly AudioWorklet` + `WebView2` empaquetado con Vite) y compatible al 100 % con `NeuronDB` (`.model` / `.sound`) y con `ABDNeuModMakr` (`.nmmodel` `v2.1`).

---

# ABDAxionikVS — Informe de Arquitectura y Plan de Implementación (`ROADMAP.md`)

## 🛡️ Plan de Modernización y Cumplimiento Normativo 2026 (Auditoría 2026-11)
> **Estado:** 🟢 Completado  
> **Objetivo:** Subsanar discrepancias de tiempo real, diagnóstico, telemetría y seguridad detectadas en la auditoría contra los estándares 2026 (ADR-001 a ADR-005 y SECURITY_STANDARDS).

### 📋 Fases del Plan de Adaptación

| Fase | Tarea / Subsistema | Estado | Descripción Técnica y Criterio de Aceptación |
| :--- | :--- | :---: | :--- |
| **AXVS.1** | **Blindaje Real-Time en Audio Thread (StickPlayer)** | ✅ Completado | Eliminado el bloqueo de `uiParamMutex_` y el `push_back` en `std::vector` dentro de `setOnStickParamChanged` invocado desde el hilo de audio (`processVectorSticks`). Sustituido por una cola circular SPSC lock-free de tamaño fijo (`abd::scope::SpscRingBuffer<ParamChange> stickParamQueue_{1024}`). **Criterio:** Cero locks y cero reservas en heap durante `processBlock`. |
| **AXVS.2** | **Inyector de Tono Diagnóstico 440 Hz** | ✅ Completado | Implementado `DiagnosticTonePoint` (Disabled, PostMaster, PreFilter, OscillatorDirect) en `DspEngineFacade`, permitiendo la inyección atómica de una onda senoidal de 440 Hz de referencia para aislamiento de fallos. **Criterio:** Tono audible y medible verificado en Test 20. |
| **AXVS.3** | **Infraestructura de `ScopeTap` para Osciloscopio** | ✅ Completado | Añadido derivador `abd::scope::ScopeTap` en la salida Master de `DspEngineFacade` conectado a SPSC lock-free para introspección y telemetría visual de osciloscopio sin degradar el pipeline. **Criterio:** Verificado en Test 21. |
| **AXVS.4** | **Modernización de Telemetría IPC** | ✅ Completado | Migradas las notificaciones periódicas a 30 Hz en `AxionikEditor::timerCallback`, `sendResynatorShapersState` y `sendBankCatalogSync` de `evaluateJavascript("window.WebBridge.notify(...)")` a eventos nativos tipados (`emitEventIfBrowserIsVisible("event", ...)`). **Criterio:** Eliminada la construcción de strings JS concatenados en bucle y reducida sobrecarga en Chromium. |
| **AXVS.5** | **Blindaje DoS en Carga de Archivos de Preset / Modelos** | ✅ Completado | Aplicadas comprobaciones de tamaño en disco (`std::filesystem::file_size`) antes de la lectura en `parseSoundScriptFile` y `parseStickRecFile` en `NeuronSound.h`, y en descriptores JSON `.model` / `manifest.json` en `NeuronBankAdapter.h`, rechazando archivos corruptos o > 16 MB. **Criterio:** Verificado en Test 22. |

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
5. **Hallazgos Recientes de Descompilación y Oráculo (`stSPEngineCb`, Slots 0xA4/0xC2, Warm-up de DLL, Rama Muerta `voice+0x18`)**:
   - **Campos espejo muertos (`dead mirrors`) en `stSPEngineCb` (`0x100139D0`)**: El callback del motor de parámetros de `NeuronVS.dll` actualiza los slots 164 (`0xA4`: `R1AmpEnvR`) y 194 (`0xC2`: `R2AmpEnvR`) escribiendo en `params+0x0C` y `params+0x10`. La investigación estática de referencias cruzadas y la sonda dinámica de lectura (`neuron_golden --mirror`) confirmaron que ningún método ni subrutina DSP lee jamás `params+0x0C` ni `params+0x10`. Son campos espejo inertes sin impacto alguno en el renderizado de audio ni en la síntesis.
   - **Puerta de 1 mm (`1/25.4` pulgadas)**: La condición de umbral `1/25.4 = 0.03937007874015748` encontrada en la descompilación del callback corresponde a la conversión de milímetros a pulgadas (en los registros 21 y 32 de `snddat`, las cotas físicas vienen medidas en mm y se convierten a pulgadas al guardarse en `p[164]` y `p[194]`). Solo se actualiza el parámetro si supera el umbral físico de 1 mm.
   - **Régimen de calentamiento y desplazamiento de estado en `NeuronVS.dll`**: La DLL original de 2004 altera su régimen interno acumulativo entre la 3ª y la 4ª carga de preset (las primeras 3 cargas renderizan bit-idéntico, pero a partir de la 4ª sufren un desplazamiento de ~0.267 por acumulación de estado estático en variables internas de la DLL). En los tests de paridad de audio diferencial (`GoldenParityTest`), deben descartarse siempre los primeros 4 renders de calentamiento para evaluar en régimen permanente estable.
   - **Rama muerta `voice+0x18 == 1` (`×24.0f` post-voces) en `FUN_100382b0`**: En `100382b0_FUN_100382b0.c` (L134–136 y L1691–1705), si algún descriptor de voz tiene `*(int*)(voice + 0x18) == 1`, se activa `local_108 = 1`, que al salir del bucle de voces invoca `FUN_10029530()` y multiplica los buses acumulados L/R por `24.0f` (`_DAT_1030cdc0`). Sin embargo, `FUN_1003d800` (`noteOn`, L152) escribe explícitamente `*(uint32_t*)(voice + 0x18) = 0` al arrancar cada nota y ninguna función de `NeuronVS.dll` escribe `1` en `+0x18`. Por tanto, esa rama es **código muerto inalcanzable** en la DLL original (a diferencia de la ganancia final de `×24.0f` en la etapa de salida `DspNeuronMasterOutputStage`).

---

## 2. Estructura del Repositorio (`ABDAxionikVS`)

Siguiendo estrictamente la arquitectura de `ABDNeural`, `ABDMS2000`, `ABDEep` y las guías `abd-synth-creation-guide` / `juce-audio-hybrid-plugin`:

```text
D:\desarrollos\ABDSynths\ABDAxionikVS\
├── CMakeLists.txt                   # Build raíz (JUCE 9 Standalone + VST3 + CTest)
├── DspSources.cmake                 # Lista ÚNICA anti-drift de fuentes DSP (compartida con wasm/)
├── package.json                     # Miembro del pnpm-workspace (@abdsynths/shared, @abdsynths/midi-keyb)
├── vite.config.ts                   # Empaquetado de WebUI/ -> WebUI/dist/ (base: './')
├── vitest.config.ts                 # Suite de tests JS/TS (contratos, codecs, UI, bridge)
├── build.bat                        # Pipeline integral con tee a build-last-run.log y selftest E2E
├── start.bat                        # Lanzador (bancada WebView2, navegador WASM, selftest)
├── README.md                        # Documentación general, compilación y banderas
├── CHANGELOG.md                     # Historial de cambios (Keep a Changelog)
├── HANDOFF.md                       # Estado vivo, arquitectura y puntos de entrada
├── ROADMAP.md                       # Plan de implementación por fases (este documento)
│
├── DOCS/                            # Corpus local completo de ingeniería inversa, manuales y UI
│   ├── UI_INVENTORY_AND_ADAPTATION.md # Inventario de los 445 parámetros, vistas y adaptación UX
│   ├── DSP_MIGRATION_AND_FIXES.md   # Cierre de incógnitas de params, eliminación de Nuke y 10 bugs corregidos
│   ├── manuals/                     # Manuales oficiales (NeuronVS, Hardware, Technical Hints, Nuke4All, BrainMapper)
│   ├── community_panels/            # Paneles Lemur (MYELIN, Axel), Bidule, PureData y Max for Live
│   └── reverse_engineering/         # Estudio RE completo (dsp, preset_format, neurondb, observers, layout, vst2...)
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
│   ├── PluginProcessor.h / .cpp     # AudioProcessor JUCE 9 (APVTS, MIDI, NRPN, SysEx, estado)
│   ├── PluginEditor.h / .cpp        # AudioProcessorEditor con WebView2 (sirve WebUI/dist/ + dev probe)
│   ├── WebPilotHost.cpp             # Bancada nativa ligera WebView2 para desarrollo y selftest E2E
│   │
│   ├── Generated/                   # Emitido por Scripts/registry_generator.js (PROHIBIDO editar a mano)
│   │   ├── ParameterRegistry.gen.h  # 445 parámetros, 26 alias VST, rangos, defaults y grupos
│   │   ├── Conversion.gen.h         # Normalización y conversión de dominio
│   │   └── MidiMapping.gen.h        # Tablas CC, NRPN (0..444) y SysEx IDs
│   │
│   └── DSP/                         # 100 % C++20 PURO — PROHIBIDO incluir <juce_*.h>
│       ├── DspEngineFacade.h / .cpp # Fachada limpia consumida por PluginProcessor y por WASM
│       ├── DspTypes.h               # Snapshot plano AxionikDspParams libre de JUCE
│       ├── AxionikParamIndices.h    # Enum canónico de los 445 parámetros (0..444)
│       ├── ParameterEngineBridge.h/.cpp # 445 registros snddat, 335 observadores y matriz 6x4 + 63 destinos
│       ├── Translator.h / .cpp      # FUN_10040550 + FUN_100343e4 (TranslatorHooks.cpp) + FUN_100373a0
│       ├── NeuronBankAdapter.h      # Carga/escaneo de NeuronDB (Models/000..511, Sounds/000..999)
│       ├── StickPlayer.h            # Reproductor lock-free en tiempo real de trayectorias sound.stickrec
│       ├── BlockRenderer.h          # Shim hacia ABDShared::DspCore::NeuronVS::NeuronBlockPump
│       ├── VoicePool.h              # Shim hacia ABDShared::DspCore::NeuronVS::NeuronVoicePool
│       ├── Voice.h                  # Shim hacia ABDShared::DspCore::NeuronVS::NeuronVoice
│       ├── Oscillators.h            # Shim hacia ABDShared::DspCore::NeuronVS::NeuronOscillators
│       └── NeuronModel.h            # Shim hacia ABDShared::DspCore::NeuronVS::NeuronModel
│
├── wasm/
│   ├── CMakeLists.txt               # Build Emscripten que incluye ../DspSources.cmake (EXPORT HEAPF32)
│   ├── WasmBridge.cpp               # Wrapper C ABI completo para AudioWorkletProcessor
│   └── build_wasm.bat               # Script de compilación WASM invocado desde build.bat
│
├── WebUI/
│   ├── index.html
│   └── src/
│       ├── main.ts                  # Orquestador de la rejilla de 6 unidades (3 filas), TopLcdBar y colapso por fila
│       ├── bridge/
│       │   ├── WebBridge.ts         # Cliente WebView2 + delegación automática a BridgeWasm en navegador
│       │   └── BridgeWasm.ts        # Gestor AudioContext + AudioWorkletNode + carga de abdaxionikvs_dsp.wasm
│       ├── wasm/
│       │   ├── axionikWorklet.js    # AudioWorkletProcessor RT-safe sobre WebAssembly.instantiate + HEAPF32
│       │   ├── abdaxionikvs_dsp.js  # Glue JS generado por Emscripten
│       │   └── abdaxionikvs_dsp.wasm# Binario WASM del motor DSP C++20 completo
│       ├── constants/paramIndices.ts# Índices canónicos TypeScript (0..444)
│       └── ui/                      # TopLcdBar, Paneles (Resynator, Silver, Shapers, Controllers, Filter, Blender,
│                                    # EnvelopeMaster, MasterOutput) y Drawers deslizantes (Resynator,
│                                    # Blender, Effects/Silver, Envelope, Matrix, Nuke, Bank, Calibration,
│                                    # HardwareDumps/SysEx, Settings)
│
└── Tests/
    └── GoldenParityTest.cpp         # Arnés de paridad áurea (audio, --zones 128/128, --matrix 63/63)
```

> **Nota — nombres de categoría vs. tabla canónica de Parameter Sets:**
> Los **Parameter Sets del hardware** son los 10 canónicos (0..9) del Neuron; su tabla nominal se gestiona desde `AxionikParameterSet.ts` (`PARAM_SET_NAMES` / `AXIONIK_PARAMETER_SET_DEFINITIONS`) y las etiquetas de eje de cada set viven en `schemas/parameter_sets_mnan.json` (12 etiquetas `scape` + 12 `sphere` por set, no nombres de set).
> `ParameterSets.ts` mantenía una lista paralela (`General`, `Strings`, `Percussion / Bells`, …). Se investigó su procedencia: no salía de la librería —`NeuronVS_neurondb` / `NeuronVS-db` solo aportan tablas de eje y categorías de preset— ni del manual de hardware, sino del mismo commit que introdujo la paleta de 32 categorías, y discrepaba del nombre canónico en los 10 sets. Se eliminó junto con `getParameterSetName`; el archivo queda como re-export de compatibilidad.

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
3. **SysEx (`abd::hw::SysExCodec` y Especificación Canónica Hartmann)**:
   - Documentación y análisis exhaustivo en [`DOCS/reverse_engineering/SYSEX.md`](DOCS/reverse_engineering/SYSEX.md).
   - **Cabecera Oficial Hartmann GmbH:** `F0 00 20 50 01 [DeviceID] [Opcode] ... F7` (confirmada en los 1.626 mensajes del firmware oficial `neuron_1_5_0.mid`).
   - Empaquetado 7-bit (`SysExCodec::pack8to7` / `unpack7to8`) para:
     - **Single Parameter Change SysEx**: cambio atómico de cualquiera de los 445 parámetros.
     - **Sound Patch Dump (`sound.script` + `sound.stickrec`)**: volcado y recepción completa de presets hacia/desde hardware y herramientas como SoundDiver / MidiQuest.
     - **Model Header / Zone Map Inquiry**: sincronización con ABDBankManager y ABDNeuModMakr.

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

### 4.4 Hitos de Paridad Áurea y Reconstrucción 1:1 en Fase A
- **Reconstrucción 1:1 del Resynator Parset (`FUN_10031d30`)**:
  - Eliminación de aproximaciones heurísticas en `NeuronOscillators.h`.
  - Port directo de primitivas nativas de `NeuronVS.dll`: `SchroederComb` (`FUN_10023fe0`), `BiquadCell2Pole` (`FUN_10032630`), tabla senoidal canónica de 8192 muestras (`0x1030bc30`) y tabla de ruido uniforme (`DAT_102355c0`).
  - Modo 0 (`FUN_10031e70`) con modulación de fase, dual IIR y doble peine Schroeder con dispersión estocástica.
- **Calibración Exacta de Silver Rack FX (`FUN_10029e34` / `FUN_100295d0`)**:
  - Corrección de la curva 5 de distorsión: comprobado por Ghidra que corresponde a overdrive lineal sin recorte brusco (se eliminó el falso full-wave rectifier).
  - Pre-filtro pasa bajos de 1 polo ($d_{12} = 30 \cdot preFilt$, $d_{13} = 1/(1+d_{12})$) y escalado de ganancia nativo $\times 25.0 \cdot inGain \cdot outGain$.
  - Normalización canónica de parámetros Silver Rack en `DspEngineFacade.cpp` sin multiplicadores artificiales.
  - Corrección de ratio de delay derecho a $d_R = d_L / 2$ per `FUN_100295d0`.
- **Resultado en `GoldenParityTest`**:
  - Salto de correlación acústica en Preset 176 (*DangerDrone*) de 0.00 a **L: +0.558473, R: +0.314746** contra el oráculo áureo Win32 de 2004 sin desbordamientos numéricos.

---

## 5. Integración con el Ecosistema `ABDShared` (Consumir vs. Aportar)

### 5.1 Componentes Consumidos y Desacoplados en `ABDShared` (Cero Duplicación) [COMPLETADO]
1. **Desde `ABDSharedCode` (`CMake` `add_subdirectory(../ABDShared/Code ...)`)**:
   - **`ABDShared::DspCore` (`namespace abd::dsp`)**: `AudioBuffer`, `MidiBuffer`, `MidiMessage`, `SmoothedValue`, `ScopedNoDenormals`, `Random` (semilla determinista explícita `1234567`), `DspMath.h` (transcendentales deterministas para paridad WASM ↔ nativo, sin `libm` divergente), [`DspNeuronEnvelope.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspCore/DspNeuronEnvelope.h) (envolvente analógica canónica `CShaper4T4L`) y el núcleo de síntesis en [`DspCore/NeuronVS/`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspCore/NeuronVS) (`NeuronBlockPump.h`, `NeuronVoicePool.h`, `NeuronVoice.h`, `NeuronOscillators.h`, `NeuronModel.h`, `NeuronSilverRack.h`).
   - **`ABDShared::DspEffects` (`namespace abd::dsp`) — Desacoplo Completo de todos los Efectos de `Silver` y `Master FX` en `ABDShared` [COMPLETADO]**:
     - Todos los motores de efectos residen canónicamente en [`ABDShared/Code/DspEffects/`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects) como cabeceras C++20 puras, header-only, libres de JUCE y 100 % RT-safe:
       - [`DspNeuronSilverFilter.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects/DspNeuronSilverFilter.h): Filtro multimodo de voz (`FUN_10021c90` / `FUN_1003d6f0`, 5 curvas: `24dB LP` Moog 5-pole ladder, `12dB LP` SVF, `6dB LP`, `HP`, `BP` con tablas LUT de 8192 entradas y limpieza anti-pops Mac 1.56).
       - [`DspNeuronSilverRack.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects/DspNeuronSilverRack.h): Tablas LFO canónicas de 12 formas de onda (`DspNeuronLfoTables`, `FUN_10044884`), `DspNeuronSilverFreqFX` (los 5 algoritmos: `0: 4-Band EQ + Comp`, `1: Distortion` 6 curvas, `2: Ring Modulator + Xover Delay`, `3: Sp-Warp`, `4: Decimator`) y `DspNeuronSilverTimeFX` (los 5 algoritmos: `0: Stereo Spread`, `1: L/R Delay`, `2: Flanger`, `3: Phaser`, `4: Chorus` con `Reset()` Mac 1.56).
       - [`DspNeuronMasterFX.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects/DspNeuronMasterFX.h): `DspNeuronGlobalSlicer` (`FUN_100295d0` 2D/3D), `DspNeuronMasterOutputStage` (`FUN_100382b0` + saturador `FUN_1003b930`), `DspNeuronMasterModFX` y `DspNeuronMasterTimeFX` (`Stereo Delay [431..436]` + `Master Reverb [437..444]` de 5 salas integrando `DspSchroederReverb.h`, `profiles/ReverbProfile.h` y `DspFdnReverb.h` 8x8 Householder).
     - En `ABDAxionikVS`, los cabeceros de [`Source/DSP/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP) (`BlockRenderer.h`, `VoicePool.h`, `Voice.h`, `Oscillators.h`, `NeuronModel.h`) son **shims ligeros de producto** que delegan directamente en los motores compartidos de `ABDShared`, garantizando su reutilización transversal en otros proyectos actuales y futuros de `ABDSynths`.
   - **`ABDShared::SynthCore` (`namespace abd::synth`) — Matriz Aséptica `ModMatrix.h`**:
      - `AudioThreadSnapshot`, `VoiceAllocator` y **`ModMatrixT<kNumSlots, kZeroIdInert>`** (`ModRoute`, `ModDestinationDescriptor`).
      - La matriz **`Free Controllers` (`[363..410]`, 6 fuentes × 4 destinos = 24 rutas) + Macros de Ejecución (`[413..424]`, 6 rutas)** se integrará sobre `ABDShared::SynthCore::ModMatrixT` y `ABDShared/Components/modMatrix.js` + `ABDShared/Contracts/abdaxionikvs_modulation_matrix.json`, manteniendo la regla de oro de `ABDShared`: **el motor y la vista son 100 % asépticos (índices opacos sin vocabulario de producto)** y la tabla declarativa aporta los nombres, rangos y categorías.
    - **`ABDShared::HardwareDrivers` (`namespace abd::hw`)**: `SysExCodec` y `NRPNParser` para el motor MIDI/NRPN/SysEx.
    - **`ABDShared::WebView2Bridge`**: `JuceWebView2Component` y `WebView2ResourceProvider` para servir `WebUI/dist/` embebido y la sonda al servidor Vite en Debug.
    - **`ABDShared::AudioComparator`**: Motor de comparación acústica A/B para las pruebas de certificación contra los WAV áureos de `NeuronVS.dll`.
    - **`ABDShared::BankManagerCore` (`ABDBankManager`)**: Gestión de librerías, bancos y presets integrada en el plugin.
    - **`ABDShared::NeuronFormats` (`@abdsynths/shared/formats/neuron`)**: Codecs universales 1:1 para contenedores `.model` (`.scape`, `.sphere`, `map.script`, `MName`, `ModelNames`), `.sound` (`sound.script`, `sound.stickrec`, `SoundNames`), motor relacional transparente **`NeuronDbMapper.ts`** (inspirado en `<Neuron> BrainMapper v1.2.0`: evaluación automática de dependencias bidireccionales `Model <-> Sound` para `R1` y `R2`, filtrado de ranuras vacías `--<empty>--`, asignación segura de ranura libre sin sobrescribir modelos en uso ni `#511 sinew`, remapeo automático de referencias en presets/scripts, compactación de modelos y sincronización de cachés `ModelNames`/`SoundNames`), decodificador puro RIFF/WAVE y FORM/AIFF (`WavAiffDecoder.ts`) y empaquetador ZIP (`ZipArchive.ts`). Consumidos directamente en `ABDAxionikVS` y `ABDNeuModMakr`.
    - **`ABDShared::DspCore::NeuronAnalysis` (`@abdsynths/shared/dsp/neuron-analysis`)**: Motor de análisis espectral de alta resolución (Radix-2 FFT 8192 pts con 4-term Blackman-Harris, HPS con escala de octavas, ajuste de rejilla armónica LS, clustering multicapa de 1..3 capas y generador paramétrico Scape/Sphere). Consumido en Fase B.
    - **`ABDShared::Visualizers` (`@abdsynths/shared/visualizers/SpectralCanvasVisualizer.js`)**: Visualizador gráfico Canvas 2D multimodo de alta fidelidad: espectrograma con estela temporal, barras de 64 parciales armónicos superpuestas a curva FFT en tiempo real y comparador diferencial de formas de onda A/B.
    - **`ABDShared::Scope` (`SpectrogramRenderer.js`)**: Renderizador cascada / waterfall enriquecido con superposición de trazas armónicas (`frame.partialTracks`), permitiendo monitorear las trayectorias de parciales simultáneamente con la densidad espectral global.
2. **Desde `ABDShared/Code/MidiKeyboard` (`@abdsynths/midi-keyb`) y `ABDSharedAssets` (`@abdsynths/shared`)**:
   - **Teclado Unificado (`D:\desarrollos\ABDSynths\ABDShared\Code\MidiKeyboard`)**: integrado directamente con los 6 controles de ejecución (`params+0x44`: `Aftertouch`, `ModWheel Up/Down`, `Breath CC2`, `CC3`, `Foot CC4`, `Expression CC11`), `PitchBend` (`engine+0xDA4`) y `FootSwitch` (`[411]`), alimentando en tiempo real la matriz `Free Controllers` (`[363..410]`). Registrado con altura 98px para hosts multicapa.
   - Tokens y cascada CSS (`@abdsynths/shared/styles/tokens.css`), fondo canónico neutral (`ABDShared/Assets/assets/backgrounds/bg_neutral.webp`), `SynthNavBar`, `AboutDialog`, `Knob`, `SilverFilmstripKnob`, `Slider`, `FilmstripFader`, `Segmented`, `Select`, `Toggle`, `Switch`, `XYPad`, `EnvelopePad`, `ModMatrix`, `SevenSegmentDisplay`, `VuMeter`, `SpectrumPlotter`, `LiveSysExInspector`, `createLcdPanel`, `createLcdScreen` y `createLcdMachine`.

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

> **Nota — tabla de nombres de Parameter Sets:**
> Los 10 Parameter Sets del hardware son canónicos y su tabla nominal está en `AxionikParameterSet.ts` (`PARAM_SET_NAMES`) y en `schemas/parameter_sets_mnan.json`. La lista paralela que tenía `ParameterSets.ts` no procedía de la librería ni del manual y contradecía al canónico en los 10 valores, así que se eliminó junto con `getParameterSetName`; `ParameterSets.ts` queda solo como capa de re-exportación.

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

### Fase A.3 — Etapa `Silver`, Efectos Maestros y Orquestador de Bloques [COMPLETADA]
- **Objetivos Cumplidos**:
  1. [COMPLETADO] Etapa `Silver` en `DspNeuronSilverRack.h` (`CSilverRack::Process`, `FUN_10029e34`):
     - `DspNeuronSilverFilter` (`FUN_10021c90`): filtro multimodo (5 curvas: 24dB/12dB/6dB LP, BP, HP) con tablas LUT de 8192 entradas y limpieza anti-pops Mac 1.56.
     - `DspNeuronSilverFreqFX`: los 5 algoritmos canónicos de modulación en frecuencia (`0: EQ 4-Bandas + Compresor` `FUN_1002d3d4`/`FUN_1003785c`, `1: Distortion` 6 curvas, `2: RingMod` con Xover Delay, `3: Decimator`, `4: Sp-Warp`).
     - `DspNeuronSilverTimeFX`: los 5 algoritmos canónicos de modulación temporal (`0: Stereo Spread`, `1: L/R Delay`, `2: Flanger`, `3: Phaser`, `4: Chorus`) con la corrección `Reset()` de Stephan Bernsee (Mac 1.56).
  2. [COMPLETADO] Efectos maestros en `DspNeuronMasterFX.h`:
     - `DspNeuronGlobalSlicer` (`FUN_100295d0` Vertical 2D y Spatial 3D).
     - `DspNeuronMasterModFX` (apertura estéreo M/S) y `DspNeuronMasterTimeFX` (`Stereo Delay [431..436]` + `Master Reverb [437..444]` de 5 salas híbrida `ABDEep` `SchroederReverb` + `DspFdnReverb` 8x8 Householder).
     - `DspNeuronMasterOutputStage` (`FUN_100382b0` L1720-1775 + saturador soft-knee `FUN_1003b930`).
  3. [COMPLETADO] `NeuronBlockPump.h` (`0x1000bc40` / `FUN_100382b0`): bombeo de bloques de 128 muestras con limitación musical limpia por defecto (`[-1.0, +1.0]`) y conmutador `OracleClipToZeroMode`.
  4. [COMPLETADO] Corrección de offset de cuerpo espectral `SphereBodyTable` (`frameOffset + frameStride - 6152`, `FUN_1002e750`), normalización dinámica de `.scape` (`16-bit` completos y one-shots), compensación `RootKey`/`Detune` por zona (`zonePitchFactor_`, `FUN_10032970`), `R1Switch [23]`/`R2Switch [103]`, `ModelVelocitySwitch [41/121]`, `SoundNumVoices [5]`, `SoundPan [3]`/`SoundPanKeyTrack [4]` y `LFO Global [256..260]`.
  5. [COMPLETADO] Certificación offline de paridad sonora, zonas (`--zones` 128/128) y matriz (`--matrix` 63/63) con `GoldenParityTest`, y biblioteca unificada de **398 presets** (`NeuronVS` + `Hardware Soundset V4`).

### Fase A.4 — Interfaz `WebUI` Adaptada y Mejorada (100 % de los 445 Parámetros), WebAssembly `AudioWorklet` y Volcado a `ABDShared` [COMPLETADA]
> **Referencia de diseño obligatoria:** [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md)
> No replicaremos el aspecto estático ni el laberinto de 33 sub-páginas de 2004 del `NeuronVS` original. En su lugar, adaptaremos y mejoraremos todos sus controles, pantallas, selectores y opciones dentro del sistema de diseño de `ABDSynths` (`@abdsynths/shared`), exponiendo por primera vez los **445 parámetros completos** (incluyendo el rack `Master FX` `[430..444]`, la matriz `Free Controllers` `[363..410]`, `ModelVelocitySwitch` y las 24 profundidades `ResEnv` que el plugin de 2004 ocultaba o fragmentaba).

- **Objetivos**:
  1. Desarrollar y aportar a `ABDSharedAssets` los componentes genéricos **`TrajectoryStick2D`** (con anillo multipolar de etiquetas dinámicas `mnAN` de los 10 `Parameter Sets` y grabación/reproducción de trayectorias `sound.stickrec`) y **`MultiStageShaperPad`** (envolvente gráfica bipolar `4L4T`), con sus tests Vitest.
  2. Construir la `WebUI` de `ABDAxionikVS` empaquetada con Vite (`WebUI/dist/`):
     - **Cabecera Global Siempre Visible**: `SynthNavBar`, selector de bancos/presets integrado con `ABDBankManager`, nombre editable de 16 caracteres (`SoundNameC00..C15`), polifonía (`SoundNumVoices` `1..32` + voces activas), `SoundPan` / `SoundPanKeyTrack`, `PitchBendRange`, 4 Macro Knobs (`Knob1..4R1Select`), botón conmutador `<NUKE>` (abre el drawer/modal del controlador remoto NUKE), conmutador `OracleClipToZeroMode`, VU meter y osciloscopio `ABDShared::Scope` con visualización waterfall y trazas armónicas (`frame.partialTracks`).
     - **Cubierta Principal de Síntesis (`Resynator 1` + `Blender & Slicer` + `Resynator 2`)**:
       - En cada Resynator: selector de modelo `000..511` con buscador, display `MName` (11 chars), badge del `Parameter Set` (`0..9`), visor del mapa de teclado de 128 notas (`LowSource`/`HiSource` + `ModelVelocitySwitch`), afinación (`Octave`, `Semi`, `Cents`, `PitchKeyTrack`, `PitchLfoDepth`, `FreeADSR1/2`, `4L4T`), tamaño (`ModelSizeOffset`, `ModelSizeKeyTrack`), `TrajectoryStick2D`, conmutadores rápidos `Sphere / Scape` y `Level 1 / 2 / 3`, y las dos columnas de modulación de eje (`Eje 1/3` y `Eje 2/4`: `KeyTrack`, `LfoDepth`, `VelocityDepth`, `ResEnvDepth`, `Contour` y `StickPlayback`) visibles simultáneamente sin el conmutador ciego `SelectStickPar`.
       - En el centro: **Blender** con los 10 algoritmos de fusión (`Mix`, `Chromophonic`, `Transsphere`, `Crossmorph`, `Intermorph`, `Dyn Transsphere`, `Dyn Crossmorph`, `Velo Crossmorph`, `Velo Chrome`, `Ring Blend`), fader bipolar `-64..+63` y sus 4 moduladores + **Slicer** (`Off`, `Vertical`, `3D`, `Rate`, `Depth`, 12 formas de onda).
     - **Rack Inferior sin Sub-Laberintos (3 Pestañas Amplias y Paneles Modulares)**:
       - **Pestaña 1 — `SHAPERS & LFO`**:
         - `ShapersPanel.ts`: 3 tarjetas homogéneas (`SHAPER 1`, `SHAPER 2`, `SHAPER 3`) con ruedas de modulación (`Wheel`) y tiras LED verticales (`LedLadder`) de `ABDShared`:
           - `Shaper 1`: Amp ADSR (`[200..203]`), ResEnv ADSR (`[204..207]`) y Free ADSR 1 (`[216..219]`).
           - `Shaper 2`: Amp ADSR (`[230..233]`), ResEnv ADSR (`[234..237]`) y Free ADSR 2 (`[246..249]`).
           - `Shaper 3`: Filt/EFX ADSR (`[355..358]`), Free ADSR 3 (`[355..358]`) y selector de estado `Shaper3Status [362]`.
         - Envolvente gráfica combinada **`4L4T`** (`MultiStageShaperPad`) y **LFO Global** (12 formas de onda, `Rate 0..20 Hz`, `Delay` bipolar Fade-Out / Fade-In).
       - **Pestaña 2 — `SILVER & MASTER FX`**:
         - `SilverPanel.ts`: Tarjeta dedicada con diseño armónico idéntico a las tarjetas Scape/Sphere.
         - `EffectsDrawer.ts` Modernizado al 100 % con **Rotary Knobs** (`Knob` de `@abdsynths/shared/components/knob.js`):
           - **L1: Multimode Filter & ADSR ([273..278, 355..361])**: Estructurado en 2 filas independientes:
             - *Fila 1 (Filtro)*: 6 rotary knobs centrados (`CUTOFF [274]`, `RESO [275]`, `ENV DEPTH [360]`, `LFO DEPTH [276]`, `KEYTRACK [277]`, `VEL DEPTH [278]`).
             - *Fila 2 (Envolvente de Filtro ADSR)*: 4 rotary knobs dedicados (`FILT A [355]`, `FILT D [356]`, `FILT S [357]`, `FILT R [358]`).
           - **L2: Frequency FX ([281..326])**: Botón conmutable `Active / Bypass` en cabecera y conversión de todos sus algoritmos a knobs:
             - *0: 4-Band EQ + Comp*: 4 tarjetas con botones `Active / Bypass` individuales por banda (`LOW SHELF`, `BAND 1`, `BAND 2`, `HIGH SHELF`) con knobs de `GAIN` y `FREQ`, más sección inferior con botón `Active` de compresor y 3 knobs (`THRESH`, `OUT GAIN`, `RESPONSIVENESS`).
             - *1: Distortion*: 4 knobs (`IN GAIN [306]`, `PRE-FILTER [307]`, `CURVE [308]`, `OUT GAIN [309]`).
             - *2: Ring Modulator*: 6 knobs (`MIX [310]`, `MOD FREQ [314]`, `LFO SPEED [311]`, `LFO DEPTH [312]`, `XOVER DELAY [315]`, `XOVER FDBK [317]`).
             - *3: Decimator*: 3 knobs (`MIX [324]`, `S&H FACTOR [325]`, `PRE-FILTER [326]`).
             - *4: Spectral Warp*: 6 knobs (`MIX [318]`, `FREQUENCY [319]`, `TILT [320]`, `DAMPING [321]`, `LFO SPEED [322]`, `LFO DEPTH [323]`).
           - **L3: Time & Modulation FX ([327..354])**: Botón `Active / Bypass` en cabecera y conversión completa de sus 5 algoritmos a knobs:
             - *0: Stereo Spread*: 2 knobs (`DELAY [331]`, `FEEDBACK [332]`).
             - *1: L/R Delay*: 3 knobs (`MIX [333]`, `DELAY TIME [334]`, `FEEDBACK [335]`).
             - *2: Flanger*: 6 knobs (`MIX [336]`, `DEPTH [337]`, `SPEED [338]`, `WAVEFORM [339]`, `FEEDBACK [340]`, `STEREO PHASE [341]`).
             - *3: Phaser*: 6 knobs (`MIX [342]`, `DEPTH [343]`, `SPEED [344]`, `WAVEFORM [345]`, `FEEDBACK [346]`, `STEREO PHASE [347]`).
             - *4: Chorus*: 7 knobs (`MIX [348]`, `DEPTH [349]`, `SPEED [350]`, `WAVEFORM [351]`, `FEEDBACK [352]`, `STEREO PHASE [353]`, `PRE-DELAY [354]`).
           - **Bloque 2 — Master Spatial FX & Dynamics ([430..444])**: Botones `Active / Bypass` y knobs para `Stereo Delay [431..436]` (5 knobs) y `Master Reverb [437..444]` (selector de sala y 6 knobs).
       - **Pestaña 3 — `MOD MATRIX & ZONES`**: Matriz completa de `Free Controllers` (`6 fuentes × 4 destinos`, `[363..410]`), los 6 controles MIDI de ejecución en vivo (`Aftertouch`, `CC 1`, `CC 2`, `CC 3`, `CC 4`, `CC 11` `[413..424]`), `FootSwitchDest` (`[411]`), MIDI Learn y visor detallado de las 128 zonas de teclado (`map.script`) de `R1` y `R2`.
     - **Paneles de Interpretación y Salida Desacoplados y Unificados (Fila Inferior sobre el Teclado)**:
       - Reorganización arquitectónica del canvas en 3 filas fluidas y desacopladas:
         1. *Fila Superior (Resonadores)*: `R1` (`Scape 1` + `Sphere 1`) y `R2` (`Scape 2` + `Sphere 2`), simétricos y sin scrollbars anidados.
         2. *Fila Central*: Rack de procesado (`Blender`, `Slicer`, `Filter`) y módulo físico de `Shapers` (1, 2 y 3).
         3. *Fila Inferior (justo encima del teclado)*: Fila dedicada y armónica con `ControllersPanel` (izquierda), `SilverPanel` (centro) y `MasterOutputPanel` (derecha).
       - **Unificación Estética y Filosofía DRY**:
         - Cabeceras estandarizadas en todas las tarjetas con `.panel-header` y `.stick-label` (mismo color cyan, tipografía bold y espaciados), eliminando badges LED y estilos dispersos.
         - Eliminación del marco/caja contenedora redundante en los joysticks (`borderless` en `TrajectoryStick2D` tanto en Control 1 como en Silver), alineándolos exactamente con los joysticks superiores de Scape y Sphere.
         - Sincronización de alturas en `bottom-controllers-row` mediante grid con `align-items: stretch` y tokens compartidos de `ABDShared`.
         - Resolución definitiva del conflicto de scrollbars verticales («scrolls van a la suya»): eliminación de `overflow-y: auto` de `.resynator-column` y unificación en un único scroll suave y coherente en `.workspace-canvas`.
     - **Vista Deslizable Superior «`<NUKE>` Remote Control Unit» ([`NukeDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/NukeDrawer.ts)) — [x] COMPLETADO**:
       - Accesible desde el botón **`NUKE`** en la esquina superior derecha de la barra de navegación (a la izquierda de `Matrix`, o vía menú/atajo `Ctrl+K`), se desliza desde arriba ocupando el 90% del ancho (`min(90vw, 1180px)`) y deteniéndose sobre el teclado inferior para dejar visibles los laterales del sintetizador y permitir tocar el teclado MIDI en todo momento sin cerrarse (solo se cierra mediante su botón `✕ Close` o el botón `NUKE` de la barra superior).
       - Construida íntegramente con el sistema de diseño y componentes de `@abdsynths/shared` (`TrajectoryStick2D` con la variante decorada `variant: 'nuke-orb'`, `Knob`, `pillSelectorHtml`, `.synth-panel-card`, `.hud-pill`, `.abd-select__field`, tokens CSS `var(--color-...)` sin colores hardcodeados) y la capa de abstracción `WebBridge` / `ParamIdx`:
         - **Voice Limit (`SoundNumVoices [5]`, `1..32`)** en cabecera con stepper interactivo (`006`).
         - **Stick Vectorial Central Multiplexado (`TrajectoryStick2D`, `212px × 212px`, `variant: 'nuke-orb'`)** con bisel fresado, anillos concéntricos de telemetría, esfera translúcida con retícula interna, conmutador rápido de motor (`Resys 1 | Resys 2 | Silver`), modo (`Sphere | Scape` sincronizado con `R1Type [24]` / `R2Type [104]`), capas (`L1 | L2 | L3` sincronizadas con `[25]`, `[105]`, `[272]`), etiquetas polares dinámicas `mnAN` según el `ParameterSet` del modelo cargado y grabador de trayectorias (`REC / PLAY / ✕`).
         - **4 Diales Macro Asignables (`Knob 1..4 Select [425..428]`)**: `Knob`s rotatorios situados encima de selectores compactos (`132px`) de los 63 destinos de modulación (`0..62`), leyendo y modificando en tiempo real el parámetro objetivo en `snddat` (`resolveParamIndexFromModDest`).
         - **Consola Inferior de 6 Controladores de Interpretación (`Controllers [413..424]`)**: `Aftertouch`, `Modulation`, `Breath`, `CC 03`, `Foot`, `Expression` con selector de destino (`0..62`) y `Knob` bipolar de profundidad (`Depth -64..+63`, formato tabular `+00`, `+29`).
     - **Pie de Página y Controles de Interpretación**:
       - Teclado MIDI compartido (`@abdsynths/midi-keyb`) con botón nativo de colapso/descolapso vertical (`enableCollapse: true`) para maximizar el espacio de la cubierta de síntesis, y barra de transporte/grabación global de `StickRec`.
       - **Bloque de Interpretación Izquierdo (Conmutable Ruedas vs. Control 1 Stick)**:
         - Selector de modo entre ruedas estándar (`Pitch Bend` + `Modulation Wheel`) y el **Control 1 / Performance Stick** del sintetizador hardware original Hartmann Neuron (joystick 2D analógico: Eje X = Pitch Bend bipolar `[-48..+48]`, Eje Y+ hacia arriba = `ModWheel` CC 1 / `ModWheelDepth` `[414]`, Eje Y- hacia abajo = `Breath` CC 2 / `BreathDepth` `[416]`).
  3. Conectar `ParameterBridge` (telemetría espectral/envolventes/sticks a ~15-30 Hz con diffing, carga de modelos y presets, aprendizaje MIDI CC) y validar el selftest E2E en Standalone y Bancada WebView2.
  4. **Corrección de Paridad DSP en `DspEngineFacade.cpp` (`setEQParams`)**: Corregida la inversión preexistente de argumentos de frecuencia y ganancia en las 4 bandas del ecualizador paramétrico, garantizando la respuesta de frecuencia exacta del hardware/plugin original.
   5. **Verificación M6 / V10 de la Modulation Matrix (351 Presets Bit a Bit)**:
      - Comparación completa del desenganche y valores efectivos `p[]` entre el port y el DLL original.
      - Identificado y corregido el desajuste en el preset 176 (destino 58, control 1 prof 0.920635) mediante la alimentación previa de los valores de control de `params+0x44` al port.
      - **351/351 presets en verde**, 6.237 comprobaciones de arnés, 21.411 slots bit a bit (61/63 por preset × 351).
      - Verificador `verify_matrix.py` actualizado a `V10` (15/15 comprobaciones superadas).
   6. **Ciclo de Vida, Parametrización y Alineación 1:1 de los Tres Objetos del Cierre en `engine+0x3650/0x3654/0x3658` + Suite `CTest`**:
      - Creados en el constructor `FUN_10044884` sobre `operator_new(0x367C)` y destruidos por `FUN_100461c4`:
        - `+0x3650` (`e[0xD94]`): Coro / Slicer (`DspNeuronGlobalSlicer` en [`DspNeuronMasterFX.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects/DspNeuronMasterFX.h)) parametrizado por `FUN_10040550` desde los slots 226..229 (`p[0xE2..0xE5]`), alineado 1:1 con `100295d0_FUN_100295d0.c` (`wet = 2x - x²`, `dry = 1 - wet`, retardo acoplado `2500*x` en L y mitad en R con suavizado `(10000*y + target)/10001` y snap `< 1e-3`, desfase estéreo LFO de `4096` muestras en las 12 tablas de 8192 floats, y Modo 2 con inyección directa `(in + del) * mod * wet + in * dry`).
        - `+0x3654` (`e[0xD95]`): Delay largo / CSilverRack (`DspNeuronSilverRack` en [`DspNeuronSilverRack.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects/DspNeuronSilverRack.h)) parametrizado por `FUN_100343e4(this, p)` con 64 campos (`st+0x0C..st+0x110`, 54 literales de `p[249..316]` + 10 calculados), anillos de 44.100 floats y clamp de feedback `0.99`.
        - `+0x3658` (`e[0xD96]`): Reloj del banco aditivo (120 B) con avance de 1024 muestras por bloque vía `FUN_10029530` (rama inactiva en el binario original al nacer `voz+0x18 = 0`).
        - Etapa final de salida (`DspNeuronMasterOutputStage` en [`DspNeuronMasterFX.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects/DspNeuronMasterFX.h)): filtro de inclinación estéreo `(350*y + x)/351` + diferenciador de 2º orden + saturador soft-knee `FUN_1003b930(x, 0.4, 0.75)` + clamp `[-1.0, 0.99899995]`.
      - Auditados y descartados los stubs inconexos de `NeuronVS_port/src/dsp_effects.cpp` (documentado en [`DOCS/DSP_MIGRATION_AND_FIXES.md` §11.8](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/DSP_MIGRATION_AND_FIXES.md)), verificado por qué el barrido de 351 presets con `--zones` en `NeuronVS.dll` daba 320 presets vacíos (instalador original con solo `511.model` en `Program Files (x86)`) mientras que `ABDAxionikVS` carga los 341 modelos de `NeuronVS-db/NeuronDB` + fallback estático `#511 sinew`, y registrada la suite `CTest` en [`CMakeLists.txt`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/CMakeLists.txt) (`DspEngineFacadeTests`, `GoldenParityTest_Zones`, `GoldenParityTest_Matrix`: 3/3 suites y 8/8 tests unitarios en verde).
   8. **Cumplimiento Estricto del Principio Headless (`sampleRate_` vs `kLegacyBaseSampleRate`), Validación de Modelos Incompletos y Migración `v1 → v2` (`FUN_10013ea0`)**:
      - Documentado en [`DOCS/DSP_MIGRATION_AND_FIXES.md` §§11.9–11.12](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/DSP_MIGRATION_AND_FIXES.md):
        - Sustitución de todos los literales `44100.0`, `88` y `8192.0` en [`DspTypes.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/DspTypes.h), [`DspEngineFacade.h/.cpp`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/DspEngineFacade.h) y [`StickPlayer.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/StickPlayer.h) por `kLegacyBaseSampleRate`, `kDefaultAntiPopSamples`, `kAntiPopRampSeconds` y `DspNeuronLfoTables::kTableSize`, manteniendo el motor DSP 100 % libre de JUCE.
        - Validación estricta en [`NeuronModel::parseMapScript()`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspCore/NeuronVS/NeuronModel.h) para rechazar cualquier `.model` cuyas zonas activas referencien fuentes `LowSource`/`HiSource` (base 1) sin par completo `.scape` + `.sphere` en disco (verificado en `DspEngineFacadeTests` Test 7).
        - Confinamiento por tipos de `modBaseValues_` (`params+0x0C`) y `effectiveSlots_` (`params+0x10`) al contexto de `stSPEngineCb` (`0x100139D0`) en [`ParameterEngineBridge.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/ParameterEngineBridge.h).
        - Soporte sin recorte (`SndDatStore::setRawValueUnclamped`) para la migración de formato `SoundVersionMajor < 2` (`FUN_10013ea0`: `BlenderAmount -= 64.0f` sin clamp posterior, verificado en `DspEngineFacadeTests` Test 8).
   7. **Especificación Canónica SysEx y Presets de Fábrica**:
      - Confirmada la ausencia de SysEx en el DLL VST2 (filtra estrictamente `kVstMidiType`).
      - Decodificada la cabecera canónica del hardware Hartmann desde el volcado de firmware `neuron_1_5_0.mid`: `F0 00 20 50 01 7F 70 00` (Manufacturer ID oficial MMA: `0x00 0x20 0x50`).
      - Tabla canónica de 445 descriptores embebida en `.rdata:0x10049F08`, nombres de 1.000 sonidos inicializados con `InitSound` (`0x100525BC`).
   9. **Compilación WebAssembly (`abdaxionikvs_dsp.wasm`) e Integración `AudioWorklet` en Navegador ([`wasm/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/wasm), [`BridgeWasm.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/bridge/BridgeWasm.ts), [`axionikWorklet.js`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/wasm/axionikWorklet.js), [`build.bat`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/build.bat))**:
      - El motor DSP de `ABDAxionikVS` (`DspEngineFacade`, `Translator`, `ParameterEngineBridge`, `ABDShared::DspCore::NeuronVS`, `ABDShared::DspEffects` y `ABDShared::SynthCore`) está escrito en **C++20 puro 100 % libre de dependencias JUCE**, por lo que compila directamente a WebAssembly con Emscripten sin necesidad de incluir módulos de JUCE.
      - Síntesis en memoria para modelos en entorno navegador (`NeuronModel::loadEmbeddedSyntheticModel` en [`NeuronModel.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspCore/NeuronVS/NeuronModel.h) y [`NeuronBankAdapter.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/NeuronBankAdapter.h)): cuando no hay acceso a sistema de archivos local (`__EMSCRIPTEN__`), el motor genera en memoria los contenedores `.scape` y `.sphere` canónicos tanto para el modelo `#511 sinew` como perfiles multi-armónicos diferenciados para los slots `000..510`, mapeando las 128 zonas MIDI para que el sintetizador suene de inmediato en el navegador.
      - `WasmBridge.cpp` y `axionikWorklet.js` (`AxionikWorkletProcessor`): exponen el C ABI completo (`axionik_create`, `axionik_render`, `axionik_note_on/off`, `axionik_set_param`, `axionik_pitch_bend`, `axionik_mod_wheel`, `axionik_channel_pressure`, `axionik_midi_cc`, `axionik_load_preset_script`, `axionik_load_model_slot`, `axionik_set_calibration`, `axionik_get_telemetry`) y procesan bloques estéreo en tiempo real sobre `HEAPF32`.
      - Integrado [`wasm/build_wasm.bat`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/wasm/build_wasm.bat) como paso `[6/6]` de [`build.bat`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/build.bat) inmediatamente después de la compilación nativa CMake/MSVC, copiando automáticamente `abdaxionikvs_dsp.js`, `abdaxionikvs_dsp.wasm` y `axionikWorklet.js` a `WebUI/src/wasm/` y `WebUI/dist/`.
- **Verificación (DoD)**:
  - Cierre 100 % completado de la **Fase A (Hartmann Neuron Clásico 1:1)**: `build.bat nopause` 100 % en verde (CTest + Vitest + Selftest E2E en las dos superficies + compilación y reproducción WASM `AudioWorklet`).

---

### Hito de Diseño Intermedio (Gate A → B) — Sesión de Definición de la Fase B [DESCONGELADO Y CERRADO 2026-11-04]
> [!NOTE]
> **Gate A → B completado el 2026-11-04:**
> Certificada la Fase A (100 % paridad clásica) y cerradas las Fases 10, 11 y 39 de [`ABDNeuModMakr`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr/roadmap.md), la Fase B ha quedado implementada e integrada en [`Source/DSP/Extended/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/Extended), [`DspEngineFacade`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/DspEngineFacade.cpp) y [`BankDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/BankDrawer.ts).

#### Estado de Referencia en `ABDNeuModMakr` (fuente de verdad: [`NEXTGEN_ARCHITECTURE_AND_SPEC.md`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr/DOCS/NEXTGEN_ARCHITECTURE_AND_SPEC.md))
El borrador original de esta fase solo contemplaba un `.nmmodel v2.1` plano de 64 parciales. `ABDNeuModMakr` ya ha ido bastante más lejos:
1. **Contenedor Multiformato de 5 Capas — «Cápsula del Tiempo» (`.nmpack` / `.zip`)** ([`timeCapsule.ts`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr/src/core/timeCapsule.ts)): `manifest.json` (`NEURONMM_TIMECAPSULE`) + `provenance.json` (linaje anti-efecto fotocopia) + capas `01_raw_source/`, `02_legacy_original/`, `03_enhanced_audio/` (Master Wave `24-bit / 96 kHz`, Mono / Estéreo `2.0` / Quad `4.0`), `04_classic_enhanced/` y `05_extended_model/` (`model.nmmodel` + `extended_map.json` + `cover.webp`).
2. **Mapa 2D Libre «Lego» (`ExtendedRegion`)** ([`types.ts`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr/src/core/types.ts), [`extendedAdapter.ts`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr/src/core/extendedAdapter.ts)): $N$ capas de velocidad, rangos asimétricos `Key × Velocity`, crossfades (`linear`, `equal-power`, `spectral-morph`), `pitchKeytrack` `0..100 %`, `trigger` (`attack`, `release`, `first`, `legato`), *Round-Robin* y Zona Común + overrides por región.
3. **Loops de 6 Modos** ([`LoopEditorTools.ts`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr/src/core/dsp/LoopEditorTools.ts)): `no_loop`, `loop_continuous`, `loop_sustain`, `ping_pong`, `loop_backward`, `one_shot` con `loopCrossfadeMs`.
4. **Articulación DAHDSR (6 etapas), Filtro y LFO** con mapeo seguro a `sound.script` (`mapArticulationToSoundOverrides`, profundidades a `Scape`/`Sphere`/`Blender` forzadas a `0`), importadores `.sf2` / `.sfz`, clasificador acústico (`cat-0..cat-9` + `Parameter Set 0..9`) y portada `cover.webp` `512×512`.
5. **Contrato versionado del modelo expanded (`axionikExpandedModel` v2.0.0, SSOT en `ABDShared`)** ([`Contracts/axionikExpandedModel.ts`](file:///d:/desarrollos/ABDSynths/ABDShared/Contracts/axionikExpandedModel.ts)): tipos + JSON Schema espejo (`axionik_expanded_model.schema.json`) con guarda `isAxionikExpandedModel`, descubrimiento por capacidades (`identity.requiredCaps` + `meetsEngineCaps`), validación estricta de formato por modo (`validateModelFormatForMode`) y los 3 perfiles canónicos de modo/variante CMake (`AXIONIK_CLASSIC_ENGINE_PROFILE` = `classic`, `AXIONIK_PLUS_ENGINE_PROFILE` = `plus`, `AXIONIK_EXPANDED_ENGINE_PROFILE` = `expanded`). Fija lo que el v1 no podía portar y añade soporte de vanguardia para los Resynators 100 % propios de `ABDAxionikVS`:
   - **Materia Sónica del Resynator (`ABDAxionikVS` modo `expanded`)**: `partialCount`/`frameCount` parametrizados (espectral HD), diccionario multimuestra `spectralBySample` (indexado por `region.sampleRef` sin embudo clásico), parciales con ancho de banda Loris (`bandwidths[]`), residuo estocástico DDSP en 24 bandas Bark (`residualBandsDb[]`), curva real de envolvente formántica 24-Bark (`formantEnvelopeDb[]`), fase e instante temporal por trama (`phases[]` + `timeSec`), vector espacial 4D `spatialQuad` (`[FL, FR, RL, RR]`), ventana de empalme del transitorio híbrido por región (`hybridTransient`: `durationMs`, `crossfadeMs`, `spliceFrameIndex`), `morphSpace` + `latentRef`, y moldeadores físicos/espectrales tipados (`shapers: AxionikResonatorShapers`). *(Nota futura: estos nuevos Resynators podrán aprovecharse más adelante en `ABDNeural`, fuera del alcance actual.)*
   - **Frontera con el Sinte (patrón `ABDJUNiO601`)**: los filtros (`filters[]`), cadena de efectos (`fxChain[]`) y reglas expresivas del dispatcher de voces (`trigger`, `roundRobin`, crossfades `keyFade/velFade`, envolventes DAHDSR) pertenecen a la cadena de audio independiente del Sinte y no al núcleo del Resynator.
   - **IA y Proveniencia**: capacidades `audiosr`, `htdemucs`, `bigvgan`, `outpaint-loop`, `denoise-ai` (condicionado por `X-Noise-Profile`), `ddsp-harmonic-residual` y `vae-latent-encode`.
   - `ABDNeuModMakr` ya lo escribe y pre-vuela (Fase 11.5: `src/core/expandedModelWriter.ts` + `tests/phase11_expanded_model.test.ts`); la Fase B lo consumirá con adaptación explícita (`spatial-downmix` para Pseudo-Surround en buses `2.0`/WASM, truncado HD o bypass de bloques desconocidos) o bloqueo con aviso si faltan `requiredCaps` o si el formato del modelo no coincide con el modo activo (`classic`, `plus`, `expanded`).

#### Puente Inmediato con el Modo Clásico (permitido antes de descongelar la Fase B)
- La capa `04_classic_enhanced/` (y las rutas `Models/<NNN>.model/` + `Sounds/<NNN>.sound/` del ZIP) ya es 100 % compatible con el motor clásico actual: regiones 2D proyectadas a columnas `0..127`, compensación de ganancia entre velocidades sobre `.scape`/`.sphere` (`10^(ΔdB/20)`), análisis `Enhanced DSP` (HPSS) y `sound.script` limpio.
- **Único ajuste puente previsto**: que el importador de `ABDAxionikVS` reconozca paquetes `.nmpack` / `.zip` de *Time Capsule* y seleccione `04_classic_enhanced/` (o `02_legacy_original/` como respaldo) sin mezclarlos jamás en un mismo parseo, replicando `extractTimeCapsuleFromFiles` de [`timeCapsule.ts`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr/src/core/timeCapsule.ts).

#### Decisiones de Diseño Cerradas en el Gate A → B
1. Conmutación de modelos por modo en `ABDAxionikVS`: **`classic`**, **`plus`** y **`expanded`** (sin `ABD` ni `Neuron`). [IMPLEMENTADO 2026-11-04, patrón `ABDJUNiO601`: un solo código compilado por defecto en la variante superior `AXIONIK_TARGET_MODEL=2` (`EXPANDED`), más script `build_all_models.bat` para generar los 3 binarios (`build_classic`, `build_plus`, `build_expanded`). La compilación `EXPANDED` muestra el selector `CLASSIC | PLUS | EXPANDED` en la cabecera para bajar en caliente a `PLUS` o `CLASSIC`; las compilaciones `CLASSIC` y `PLUS` bloquean modos superiores y ocultan el selector.]
2. Moldeadores físicos y espectrales del Resynator v2 de `ABDAxionikVS` (modo `expanded`: *Inharmonicity Stretch*, *Parity*, *Entropy/Roughness*, *Shift*, *RollOff*, *Formant Shift/Preserve*, *Residual Mix*, *Spatial Spread*): [IMPLEMENTADO 2026-11-04 en `AxionikExpandedSynthesizer.h` consumiendo `AxionikResonatorShapers`.]
3. Topología: mantener `R1 + R2 + Blender` [DECIDIDO 2026-11-02: Fase B sobre `R1 + R2 + Blender`.]
4. Compatibilidad de modelos y Gestor de Bancos Dual (`AxionikDB` v2 + `NeuronDB` v1): [IMPLEMENTADO 2026-11-04: los modos `classic` y `plus` admiten exclusivamente modelos `.model` v1 (rechazando v2 con aviso explícito); el modo `expanded` admite tanto modelos v2 (`AxionikDB` / `axionik-expanded.json` / `.nmmodel`) como modelos clásicos `.model` v1 por Resynator (`R1` / `R2`), mostrando en `BankDrawer.ts` las 3 pestañas simultáneamente (`AXIONIKDB (V2)`, `MODELS (000-511)` y `SOUND PRESETS`) con selectores independientes de carpeta para `AxionikDB` y `NeuronDB`.]
5. Bus de salida espacial: Quad `4.0` / `5.1` discreto en hosts JUCE 9 vs. reducción Pseudo-Surround estéreo (WASM y hosts `2.0`). [IMPLEMENTADO 2026-11-04: `renderBlockQuad` para buses discretos 4.0 y `downmixQuadToStereoPseudoSurround` mono-compatible para buses 2.0 y WASM.]

### Fase B — Versión Extendida / Extended (Consumo de la «Cápsula del Tiempo» de `ABDNeuModMakr` — Fase 11.5.6) [COMPLETADA 2026-11-04]
> [!NOTE]
> Implementada en C++20 puro libre de JUCE en [`Source/DSP/Extended/AxionikExpandedModel.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/Extended/AxionikExpandedModel.h) y [`Source/DSP/Extended/AxionikExpandedSynthesizer.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/Extended/AxionikExpandedSynthesizer.h), integrada en [`DspEngineFacade`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/DspEngineFacade.h), gobernada en compilación por `AXIONIK_TARGET_MODEL` (`0=classic`, `1=plus`, `2=expanded`) en [`CMakeLists.txt`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/CMakeLists.txt) y conectada al gestor de bancos dual en [`WebUI/src/ui/BankDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/BankDrawer.ts). Verificada mediante CTest en [`Tests/DspEngineFacadeTests.cpp`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Tests/DspEngineFacadeTests.cpp) (**12/12 PASS**) sin regresión en `GoldenParityTest` (`--zones`, `--matrix`).
- **Objetivos Preliminares (a refinar en el Gate A → B)**:
  1. **Promoción del Esquema de Cápsula a `ABDShared` (`@abdsynths/shared/formats/neuron`)**:
     - Subir `TimeCapsuleManifest`, `ModelProvenance`, `ExtendedRegion`, `SynthArticulationConfig`, `CommonPlaybackDefaults` y `extractTimeCapsuleFromFiles` junto a los codecs ya compartidos (`ModelFormat.ts`, `SoundFormat.ts`, `ZipArchive.ts`, `NeuronDbMapper.ts`).
     - El `BankManager` compartido mostrará las cápsulas en ambas aplicaciones con su categoría `cat-0..cat-9`, insignias `EXTENDED / 96kHz / QUAD` y miniatura `cover.webp`.
  2. **`model.nmmodel` Indexado por Fuente / `ExtendedRegion` (requisito hacia `ABDNeuModMakr` Fase 11)**:
     - **Fuente primaria ya fijada por el contrato v2**: el documento `05_extended_model/axionik-expanded.json` (`isAxionikExpandedModel` + `preflightExpandedModelForAxionik`). `model.nmmodel` queda como respaldo espectral para cápsulas sin v2; ninguna de las dos rutas se mezcla con `04_classic_enhanced/`. El motor anuncia sus capacidades y, si no cubre los `requiredCaps`, adapta o bloquea con aviso (nunca en silencio).
     - Hoy [`PipelineRunner.ts`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr/src/core/dsp/PipelineRunner.ts) agrupa el `.nmmodel` sobre las columnas clásicas proyectadas. Se acordará que `05_extended_model/model.nmmodel` indexe el análisis de alta resolución por `sampleName` (de `03_enhanced_audio/`), de modo que las $N$ regiones de `extended_map.json` lo referencien sin pasar por el embudo clásico de 2 velocidades.
  3. **`ExtendedRegionDispatcher` y Motor de Muestras/Articulación en `Source/DSP/Extended/` (C++20 puro sin JUCE, idéntico en `VST3`, `Standalone` y `WASM AudioWorklet`)**:
     - Selección 2D `Key × Velocity` con disparo/interpolación en crossfades (`keyFadeIn/Out`, `velFadeIn/Out`, incluido `spectral-morph`), `trigger` (`attack`, `release`, `first`, `legato`), estado *Round-Robin* y `pitchKeytrack` continuo.
     - Los 6 modos de loop con crossfade de costura (`loopCrossfadeMs`) y envolvente DAHDSR de 6 etapas cuando la región traiga `hasArticulationOverride` o articulación global extendida.
     - Preasignación RT-safe (cero `new`/`malloc` en el hilo de audio) coherente con `VoiceMemoryPool` (§4.3).
  4. **Síntesis Híbrida: Transitorio PCM `24-bit / 96 kHz` + Resynator Espectral/Latente**:
     - Disparo del micro-ataque real desde `03_enhanced_audio/` fundido en fase con el cuerpo resintetizado.
     - Separación envolvente de formantes / $f_0$ para *Formant Shifting* real y transposición sin «efecto ardilla».
     - Moldeadores de materia sónica del Resynator v2 de `ABDAxionikVS` (`AxionikResonatorShapers`):
       - *Inharmonicity Stretch*: $f_n = f_0 \cdot (n + \Delta_n) \cdot \sqrt{1 + B \cdot n^2}$
       - *Parity (Par/Impar)*, *Spectral Shift*, *Entropy / Roughness* y *HF RollOff*.
     - Integración del análisis `@abdsynths/shared/dsp/neuron-analysis` (`FftEngine`, `SpectralAnalyzer`, `LayerClustering`, `ScapeSphereGenerator`).
  5. **Topología Espacial por Voz (Mono / Estéreo `2.0` / Quad `4.0` + Pseudo-Surround)**:
     - Bus interno de voz extendida de 4 canales (`FL, FR, RL, RR`) acorde con `MasterChannelLayout` de `ABDNeuModMakr`: excitación/transitorio (`Scape`) al frente y cuerpo/capas (`Sphere`, `Layers 0..3`) al campo envolvente.
     - Salida discreta multicanal si el host abre un bus Quad/5.1; reducción Pseudo-Surround decorrelacionada y mono-compatible en hosts `2.0` y en navegador (WASM).
  6. **Modo Híbrido por Resynator, Puente en Caliente y UI**:
     - Cada modo/Resynator (`classic`, `plus`, `expanded`) solo admite su propio formato de modelo compatible y rechaza (con aviso explícito) el resto (`validateModelFormatForMode`); morphing de 4 esquinas (`A..D`) diferido a estudio futuro.
     - Carga en caliente (Drag & Drop o vigilancia de directorio) de cápsulas recién exportadas desde `ABDNeuModMakr`.
     - Portada `cover.webp` en la tarjeta del Resynator y del banco; textos vía `@abdsynths/shared/i18n` (Fase H).
- **Verificación (DoD)**:
  - Carga sin artefactos de cápsulas multicapa con $N$ velocidades, crossfades y los 6 modos de loop.
  - Verificación matemática de los moldeadores `AxionikResonatorShapers` en el Resynator v2 de `ABDAxionikVS`.
  - Paridad bit-exacta entre build nativo (`VST3` / `Standalone`) y `AudioWorklet` WASM, incluida la reducción Pseudo-Surround.
  - Regresión cero en la Fase A: `GoldenParityTest` (`--zones 128/128`, `--matrix 63/63`) sigue en verde con modelos clásicos.


---

### Fase C — Pantalla LCD Panorámica Fija Superior y Monitor de Telemetría ([`TopLcdBar.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/TopLcdBar.ts)) [COMPLETADA]
> [!NOTE]
> Implementada en [`WebUI/src/ui/TopLcdBar.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/TopLcdBar.ts) y montada en [`WebUI/src/main.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/main.ts) justo debajo de la `SynthNavBar` (`<header>`) y por encima de `<main class="workspace-canvas">`. Comparte el mismo fondo que la barra de navegación (`var(--navbar-bg)` + `backdrop-filter: blur(8px)`), ocupa todo el ancho (`100%`), se alinea a las **12 columnas** del sintetizador (`.synth-row` con 3 zonas `.col-span-2` de `4/12` columnas cada una en el orden **`Resynator 1` → `Resynator 2` → `Consola Central + Silver`**) y despliega en **2 filas** las **4 pantallas LCD de caracteres** y las **7 mini-pantallas gráficas ADSR de `66×22 px`** simultáneamente, sin ocultar ninguna.

- **Arquitectura Implementada en [`TopLcdBar.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/TopLcdBar.ts)**:
  1. **Zona 1 — Izquierda (`col-span-2`, Columnas 1–4): `RESYNATOR 1` (2 Filas)**:
     - **Fila 1**: Pantalla `createLcdScreen` (`26×2` caracteres) con lectura en vivo de `Resynator 1` (`C_GraphEditor #12/#13`: modelo `#511 sinew`, `SPH`/`SCP`, `L1..L3`; `C_PadGrid #0`: coordenadas `X/Y` en `"%03i"`; `C_Knob #0`: `VOL` y `Semi` en `"%+02.2i"`), acompañada de botones `MODEL ▾` y `EDIT`.
     - **Fila 2**: Las **3 mini-pantallas gráficas ADSR `66×22 px` de `Resynator 1`** visibles simultáneamente (`C_DisplayButton #1 R1 AMP [200..203]`, `#0 R1 RES [182..185]` y `#2 R1 FREE [205..208]`), cada una con su lectura numérica `A·D·S·R` y la polilínea exacta de 5 vértices (`FUN_10018220`: `(1,21) → (1+A,1) → (2+A+D,20-S) → (13+A+D,20-S) → (14+A+D+R,21)` con doble trazo halo `3px` + núcleo `1px`).
  2. **Zona 2 — Centro (`col-span-2`, Columnas 5–8): `RESYNATOR 2` (2 Filas)**:
     - **Fila 1**: Pantalla `createLcdScreen` (`26×2` caracteres) con lectura en vivo de `Resynator 2` (`C_GraphEditor #39/#40`, `C_PadGrid #1` `X/Y`, `C_Knob #1 R2Volume` y `R2Semi`), acompañada de botones `MODEL ▾` y `EDIT`.
     - **Fila 2**: Las **3 mini-pantallas gráficas ADSR `66×22 px` de `Resynator 2`** visibles simultáneamente (`C_DisplayButton #4 R2 AMP [230..233]`, `#3 R2 RES [212..215]` y `#5 R2 FREE [235..238]`).
  3. **Zona 3 — Derecha (`col-span-2`, Columnas 9–12): `CONSOLA CENTRAL + SILVER & TELEMETRÍA` (2 Filas)**:
     - **Fila 1 (Consola Principal Interactiva)**:
       - **8 Botones de Salto Rápido de Subsistema** (`SND`, `R1`, `BLD`, `R2`, `SLV`, `SHP`, `MOD`, `MFX`).
       - **Pantalla Central (`28×2` caracteres) + D-Pad de 6 Botones (`MENU`, `OK`, `‹`, `›`, `^`, `v` con hold-repeat `400ms / 120ms`)**: construida con `createLcdPanel` de `@abdsynths/shared/components`, mostrando en reposo `C_GraphEditor #0/#1` (`Sound #000 InitSound` + `Blender` + `Voices`), árbol completo de menús de los 445 parámetros y previsualización instantánea `C_ParameterPage` (`Grupo · Nombre [#idx]`, valor `"%03i"` / `"%+02.2i"`, `NRPN MSB:LSB`) al tocar cualquier control.
       - **Joystick Digital Hardware de 4 Vías + `ENT` (`#lcd-nav-stick`)** con soporte de ratón y teclado.
     - **Fila 2 (7ª Pantallita ADSR `66×22` + 4ª Pantalla LCD de `Silver` + Telemetría)**:
       - **7ª mini-pantalla ADSR `66×22 px`** (`C_DisplayButton #6 FLT ENV [355..358]`).
       - **4ª Pantalla LCD (`createLcdScreen`, `20×2` caracteres)** dedicada a `Silver & Multi-FX` (`C_PadGrid #2`: curva de filtro `24LP/12LP/06LP/BP/HP`, `CUT [274]`, `RES [275]`, `FreqFX [282]` y `TimeFX [328]`).
       - Steppers de preset (`◀ / PRESET / ▶`), estado `STK: IDLE/REC/PLAY` y badge `NRPN MSB:LSB`.
  4. **Especificación Exacta de las «Pantallitas» y Displays de `NeuronVS.dll` (Ingeniería Inversa de `C_GraphEditor`, `C_DisplayButton` y `C_PadGrid`)**:
     - Documentado en detalle en [`DOCS/reverse_engineering/layout/PAINT_PIPELINE.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/layout/PAINT_PIPELINE.md) (§18 y §19) y verificado con tests unitarios en [`tests/top_lcd_bar.test.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/tests/top_lcd_bar.test.ts):
       - **Motor de texto y estado (`C_GraphEditor`, `FUN_10014dd0` / `FUN_10015280` / `FUN_10015910`)**: formatea valores unipolares como `"%03i"` (`0x100545b8`) y bipolares como `"%+02.2i"` (`0x100545c0`).
       - **Los 8 displays perimetrales de cada Stick (`C_PadGrid`, `FUN_10018bb0` + `DAT_1004ea50..54`)**: 4 etiquetas dinámicas de 8 caracteres (`mnAN`) y 4 lecturas numéricas de 3 dígitos.
       - **Las 7 mini-pantallas ADSR (`66×22 px`, `FUN_10018220`) y el compositor de envolvente (`458×71 px`, `FUN_10017950`) de `C_DisplayButton` (`FUN_10017470`)**:
         - Conectadas en tiempo real a los 28 parámetros individuales de envolvente (`R1 AMP [200..203]`, `R1 RES [182..185]`, `R1 FREE [205..208]`, `R2 AMP [230..233]`, `R2 RES [212..215]`, `R2 FREE [235..238]` y `FLT ENV [355..358]`) tanto desde C++ (`PluginEditor.cpp` / `PluginProcessor.cpp` al cargar presets) como en modo standalone (`WebBridge.ts`, con valores iniciales diferenciados por envolvente según el preset de fábrica `000 InitSound`) y desde los paneles interactivos (`ShapersPanel.ts`, `EnvelopeMasterPanel.ts`, `EnvelopeDrawer.ts`).
         - **Diseño Responsive sin Solapamientos (`SynthNavBar` y Zona 3 Central)**: Eliminado el posicionamiento absoluto de `.abd-top-menu` en `SynthNavBar` para evitar que `File / Edit / View / Help` se solapen con el selector de preset, y reestructurada la fila 1 de la consola central (`.top-lcd-console-strip`) con CSS Grid (`auto minmax(140px, 1fr) auto auto`) para escalar limpiamente en cualquier ancho de ventana.

---

### Fase D — Inspector & Calibrador Integral de Parámetros DSP, Magic Numbers y Gestión JSON (`ABDJUNiO601` Pattern Enhanced) [COMPLETADA]
> [!NOTE]
> **Implementación completada:** Extracción centralizada de los **43 valores mágicos del motor DSP** a [`AxionikCalibrationConfig.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/AxionikCalibrationConfig.h), registro tipado bilingüe en [`calibrationContracts.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/calibrationContracts.ts), documentación técnica en [`CALIBRATION_PARAMETERS.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/CALIBRATION_PARAMETERS.md) y cajón interactivo [`CalibrationDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/CalibrationDrawer.ts) accesible desde la cabecera (`Calib`, `Ctrl+;` y `Edit -> DSP Calibration & Magic Numbers...`).

- **Hitos Completados en la Fase D**:
  1. **Extracción Exhaustiva de los 43 Magic Numbers a Configuración Centralizada C++ ([`AxionikCalibrationConfig.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/AxionikCalibrationConfig.h))**:
     - Agrupados en 6 subsistemas lógicos con `id`, `label`, `category`, `defaultValue`, `minValue`, `maxValue`, `stepSize`, `unit`, `codeReference` y `description`:
       - **1. GENERAL & ENGINE (7):** `masterVolume`, `antiPopRampMs`, `voicePanWidth`, `pitchBendMaxSt`, `glideBaseTimeMs`, `glideSpanTimeMs`, `mmToInchesGate`.
       - **2. RESYNATOR (SCAPE & SPHERE) (12):** `scapeCycleSamples`, `scapeMinPeakFloor`, `scapeEmphasisCoeff`, `scapeYModRange`, `scapeSizeExponent`, `sphereConvolveGain`, `spherePeakFloor`, `sphereBand0Boost`, `sphereSubOctaveGain`, `sphereExciterGain`, `sphereSvfBaseCutoffHz`, `sphereSvfModOctaves`.
       - **3. BLENDER & SLICER (6):** `crossmorphIntermodGain`, `intermorphSineGain`, `slicerBaseRateHz`, `slicerMaxRateSpanHz`, `slicer3dPanDepth`, `slicer3dQuadratureGain`.
       - **4. SHAPERS & ENVELOPES (6):** `envMaxTimeSeconds`, `envDecayExpRate`, `envReleaseExpRate`, `shaperVelCurveRange`, `lfoBaseRateHz`, `lfoMaxRateSpanHz`.
       - **5. SILVER FILTER (6):** `filterMinCutoffHz`, `filterSweepMaxRatio`, `filterKeyTrackSpanHz`, `filterEnvModOctaves`, `filterLp24FeedbackK`, `filterSvfMaxResQ`.
       - **6. SILVER & MASTER FX (6):** `fxDistMaxDriveGain`, `fxRingModMaxCarrierHz`, `fxChorusBaseDelayMs`, `fxChorusModDepthMs`, `masterDelayMaxWetMix`, `masterReverbMaxWetGain`.
  2. **Puente Bidireccional en Tiempo Real (`DspEngineFacade` & `PluginEditor` & `WebBridge`)**:
     - Comandos `CALIBRATION_SET`, `CALIBRATION_RESET`, `CALIBRATION_RESET_ALL` y evento `CALIBRATION_SYNC` conectados con [`DspEngineFacade.cpp`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/DspEngineFacade.cpp) y [`PluginEditor.cpp`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/PluginEditor.cpp).
  3. **Cajón Interactivo `CalibrationDrawer.ts` (Superando el Modal de `ABDJUNiO601`)**:
     - Buscador instantáneo por nombre, ID, descripción o archivo fuente (`DspEngineFacade.h`, `NeuronVoice.h`, `NeuronOscillators.h`, `SilverFilter.h`, etc.).
     - Filtro rápido **`MODIFIED (N / 43)`**, pestañas por categoría con contador en vivo, slider horizontal con marcador visual de valor por defecto, input numérico de precisión, reset individual (`↺`), **`Reset Group`** por sección y **`RESET ALL`**.
     - **Importar / Exportar JSON (`LOAD JSON` / `EXPORT JSON`)** con validación de rangos y cuantización automática, más persistencia automática en `localStorage`.
     - **Preparado para Multi-idioma (`i18n`)**: Textos activos en inglés (`en`) por defecto para homogeneidad con el resto de la UI, conservando íntegramente todas las traducciones y descripciones técnicas en castellano (`es` / `descriptionEs`) en [`calibrationContracts.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/calibrationContracts.ts).

---

### Fase E — Distribución de Pantalla en Rejilla Canónica de 6 Unidades y Colapso Sincronizado de Filas [COMPLETADA]
- **Rejilla Unificada de 6 Unidades (`repeat(6, 1fr)`) en 3 Filas Simétricas**:
  1. **Fila 1 (Superior — Resynators & Silver + Slicer)**:
     - Izquierda (`col-span-2`): **Resynator 1** (`Scape 1` + `Sphere 1` joysticks).
     - Centro (`col-span-2`): **Resynator 2** (`Scape 2` + `Sphere 2` joysticks).
     - Derecha (`col-span-2`): **Silver Filter, Multi-FX & Slicer Rack** ([`SilverPanel.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/SilverPanel.ts)) con 4 columnas: joystick `Vector 2D` (`FILT / FREQ / TIME`), selectores cíclicos de `FreqFX` y `TimeFX`, y 4ª columna dedicada al **Slicer** (`OFF / 2D / 3D`, `Rate`, `Depth`, forma de onda).
     - Las tres cajas comparten idéntico ancho (`1/3` de pantalla = 2 unidades), estilos y tokens visuales.
  2. **Fila 2 (Media — Shapers Hardware)**:
     - Izquierda (`col-span-2`): **Shaper 1 (`R1`)** ([`ShapersPanel.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/ShapersPanel.ts)).
     - Centro (`col-span-2`): **Shaper 2 (`R2`)**.
     - Derecha (`col-span-2`): **Shaper 3 (`Silver & Master EFX`)**.
     - Idéntico ancho y alineación vertical con las 3 cajas de la fila superior.
  3. **Fila 3 (Inferior — Rejilla de 12 Sub-Unidades `1/12 + 1/12 + 5/12 + 4/12 + 1/12`: `Filter | Env Master | Blender | Controllers | Master`)**:
     - Sub-unidad 1 (`1/12`, `.col-span-half`): **Filter** ([`FilterPanel.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/FilterPanel.ts): knobs `Cutoff [274]` y `Reso [275]` apilados verticalmente y botón `Edit` con acceso directo a [`EffectsDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/EffectsDrawer.ts)).
     - Sub-unidad 2 (`1/12`, `.col-span-half`): **Envelope Master (`ENV MST`)** ([`EnvelopeMasterPanel.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/EnvelopeMasterPanel.ts), según manual Hartmann Neuron págs. 105–108): knobs `DEPTH [251]` y `VELO [252]` apilados verticalmente y botón `Edit` que despliega [`EnvelopeDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/EnvelopeDrawer.ts)).
     - Centro Expandido (`5/12`, `.col-span-blender`): **Blender** ([`BlenderPanel.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/BlenderPanel.ts): a la izquierda, barra horizontal bipolar `R1 ◀ Amount [262] ▶ R2` y fila limpia `1×4` de knobs de modulación `LFO DEPTH / ADSR 1 / ADSR 2 / 4L/4T` sin caja de fondo; a la derecha, matriz `2×5` `FUSION MODE` reutilizando exactamente las mismas clases CSS de `SilverPanel` (`.silver-fx-column`, `.silver-fx-col-title`, `.silver-pills-stack`), más botón `Edit` hacia [`BlenderDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/BlenderDrawer.ts)).
     - Derecha Media (`4/12`, `.col-span-2`): **Hardware Controllers** ([`ControllersPanel.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/ControllersPanel.ts): `Control 1` stick = `Modulation CC 01 [415/416]`, `Control 2` wheel + ladder = `Breath CC 02 [417/418]`, `Control 3` wheel + ladder = `Controller CC 03 [419/420]`, y botón `Edit` que abre [`MatrixDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/MatrixDrawer.ts) directamente en la pestaña `1. Controllers & MIDI [413..424]`, separada de `2. Macro Knobs (NUKE) [425..428]` y `3. Free Matrix 6×4 [363..410]`).
     - Extremo Derecho (`1/12`, `.col-span-half`): **Master Output** ([`MasterOutputPanel.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/MasterOutputPanel.ts)) con encoder rotatorio de LEDs discretos (`RotaryLedKnob`).
- **Sistema de Colapso Sincronizado por Fila (Row-Level Collapse)**:
  - Todas las cajas incorporan un botón chevron (`▾` / `▴`) a la derecha del botón `Edit`.
  - Al pulsar el chevron de cualquier caja de una fila, **la fila entera se colapsa o expande simultáneamente**, ocultando el cuerpo de los paneles (`[data-collapse-body]`) y dejando visible exclusivamente la primera línea de cabecera (`.panel-header`) con los títulos legibles (`RESYNATOR 1`, `RESYNATOR 2`, `SILVER`, `SHAPER 1 (R1)`, `SHAPER 2 (R2)`, `SHAPER 3 (SILVER)`, `CONTROLLERS`, `FILTER`, `BLENDER`, `ENV MST`, `MASTER`).
  - Totalmente adaptativo en responsive (`@media max-width: 1150px` y `768px`).
- **Unificación DRY de todos los Knobs de la Interfaz (excepto Master)**:
  - Todos los paneles y drawers (`FilterPanel`, `EnvelopeMasterPanel`, `BlenderPanel`, `SilverPanel`, `BlenderDrawer`, `EnvelopeDrawer`, `EffectsDrawer` y `NukeDrawer`) utilizan el mismo componente [`Knob`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/knob.js) de `@abdsynths/shared/components`, el mismo tamaño (`size: 38`) y el mismo bloque canónico de clases CSS en [`style.css`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/style.css) (`.synth-knob-cell`, `.synth-knob-num`, `.synth-knob-title`), sin duplicar estilos.

---

### Fase F / Expansión Final — Sistema Canónico de MIDI Learn & CC/NRPN Mapping Matrix ($N:M$) [COMPLETADA]
> [!NOTE]
> **Implementación canónica y DRY en `@abdsynths/shared` (`ABDShared`) + integración completa en `ABDAxionikVS`.**

- **Arquitectura Canónica en `ABDShared` (Reutilizable en toda la suite ABDSynths)**:
  1. **Motor C++ (`abd::hw::MidiLearnManager`)**:
     - Implementado en [`MidiLearnManager.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/HardwareDrivers/MidiLearnManager.h) con enrutamiento **Many-to-Many ($N:M$)** libre de asignaciones en el hilo de audio:
       - **1-a-$N$ (Macro Hardware)**: un mismo controlador (`CC`, `NRPN`, `Channel Aftertouch` o `Pitch Bend`) puede gobernar múltiples parámetros simultáneamente, cada uno con su propio rango (`minNorm..maxNorm`), polaridad (`invert`) y curva de respuesta (`Linear`, `Exponential`, `Logarithmic`).
       - **$N$-a-1 (Multi-Controlador)**: varios controladores físicos distintos pueden actuar sobre el mismo parámetro del sintetizador.
     - Serialización bidireccional en JSON (`toJson()` / `loadFromVar()`) para el puente WebView2 y en `juce::ValueTree` (`saveState()` / `loadState()`) para persistencia en proyectos del DAW.
  2. **Store Reactivo, Menú Contextual, Indicadores y Drawer en `@abdsynths/shared/components/midi-learn`**:
     - [`midiLearnStore.js`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/MidiLearn/midiLearnStore.js): store reactivo $N:M$ con persistencia en `localStorage`, sincronización con el host C++ (`MIDI_LEARN_SYNC`, `MIDI_LEARN_START`, `MIDI_LEARN_CANCEL`) e importación/exportación de mapas `.json`.
     - [`midiLearnContextMenu.js`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/MidiLearn/midiLearnContextMenu.js): delegación universal de eventos para controles 1D (`[data-param-index]`, incluidos elementos `<input>`/`<select>` mediante `indicatorHost`) y controles 2D (`[data-param-x]` + `[data-param-y]` en `TrajectoryStick2D`), inyección automática del punto luminoso `.abd-midi-learn-indicator` en la esquina superior derecha, tooltip flotante al pasar el ratón y menú contextual con clic derecho (`Learn MIDI (Replace)`, `Add Another Controller (N:1)...`, borrado individual y apertura del drawer).
     - [`midiLearnDrawer.js`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/MidiLearn/midiLearnDrawer.js): vista en tabla deslizable con monitor MIDI en vivo, filtro de búsqueda, edición en línea de canal/CC/NRPN, rango `Min % .. Max %`, curva, inversión, botón `+ Target` (1:$N$), conmutador de etiquetas sobre el panel (*Panel Badges*) e importación/exportación JSON.
     - [`midi-learn.css`](file:///d:/desarrollos/ABDSynths/ABDShared/Assets/styles/components/midi-learn.css) e iconos SVG monocromos en [`icons.js`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/icons.js): 100 % basados en tokens CSS de tema (`--color-*`, `--space-*`, `--radius-*`), sin emojis.
- **Integración Completa en `ABDAxionikVS`**:
  - **Backend C++**: integrado en [`PluginProcessor.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/PluginProcessor.h), [`PluginProcessor.cpp`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/PluginProcessor.cpp) (`handleMidiEvent`, `getStateInformation`, `setStateInformation`) y [`PluginEditor.cpp`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/PluginEditor.cpp) (`MIDI_LEARN_STATE`, `MIDI_ACTIVITY`).
  - **Cabecera, Menú y Atajo**: botón **`MIDI`** (`#btn-nav-midi`) en la cabecera de [`Navbar.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/Navbar.ts), entrada `Edit -> MIDI Learn & CC Mapping Matrix...` y atajo `Ctrl+L` en [`keyboardShortcuts.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/app/keyboardShortcuts.ts) que despliegan el drawer lateral en [`main.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/main.ts).
  - **Cobertura Total de Controles (`[0..444]`)**: todos los knobs, sliders, ruedas y sticks 2D de los paneles principales y de los 6 drawers etiquetados con `data-param-index` o `data-param-x`/`data-param-y`.

---

### Fase G — Hardware SysEx Dumps & Live SysEx Inspector (`MMA 00 20 50 01`) [COMPLETADA]
- **Codificador/Decodificador Hartmann Neuron 7-Bit Packed SysEx ([`hardwareDumpsContracts.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/hardwareDumpsContracts.ts))**:
  - Cabecera oficial Hartmann GmbH (`F0 00 20 50 01 <devId> <cmd>`), empaquetado 7-bit MSB-index (7 bytes crudos $\rightarrow$ 8 bytes MIDI 7-bit) y checksum XOR7 sobre los 4 Modos de Dump del manual (págs. 131–132): `Current Sound (0x10)`, `All Sounds (0x20)`, `All SetUps (0x30)` y `All Models (0x40)` con generación perezosa (*lazy*) bajo demanda para no penalizar el arranque.
  - **Nota de Ingeniería Inversa (`SYSEX.md`)**: El volcado de firmware oficial `neuron_1_5_0.mid` utiliza el opcode `0x70` con paquetes fijos de 235 bytes (`F0 00 20 50 01 7F 70 00 <227B> F7`, 1.626 tramas 7-bit limpias sin checksum verificable), mientras que el archivo de imagen de disco de 80 GB (`NUX`) utiliza cabeceras de 224 bytes (`csAN`/`psAN`) con compresión `zlib` (`wbits=-15`) y resumen SHA-256 truncado a 16 bytes. Si en el futuro se captura un volcado `.syx` desde una unidad física Neuron con `Dump Current`, se contrastará directamente contra los opcodes `0x10..0x40` de `hardwareDumpsContracts.ts`.
- **Cajón Interactivo y `LiveSysExInspector` ([`HardwareDumpsDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/HardwareDumpsDrawer.ts))**:
  - Integración del componente compartido `LiveSysExInspector` (`@abdsynths/shared/components`) con resaltado en vivo byte a byte cuando se mueve cualquier parámetro del Edit Buffer (`[0..444]`), Diff A/B, importación/exportación de archivos `.syx` y puente C++ en [`PluginEditor.cpp`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/PluginEditor.cpp).
  - Botón **`SysEx`** en [`Navbar.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/Navbar.ts), entrada en menú `File` y atajo `Ctrl+D`.

---

### Fase H — Sistema Multi-idioma Integral (`i18n` EN / ES en 2 Capas: `ABDShared` + `ABDAxionikVS`) [COMPLETADA]
> [!IMPORTANT]
> **Internacionalización completa (`i18n`) implementada bajo el estándar arquitectónico de 2 Capas en [`@abdsynths/shared/i18n`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/I18n/index.js) + extensión específica en `ABDAxionikVS`.**

- **Arquitectura Canónica en 2 Capas ([`I18N_MULTI_LANGUAGE_STANDARD.md`](file:///d:/desarrollos/ABDSynths/ABDShared/Docs/architecture/I18N_MULTI_LANGUAGE_STANDARD.md))**:
  1. **Capa 1 — Motor y Diccionario Base Transversal en `ABDShared` (`@abdsynths/shared/i18n`)**:
     - Motor reactivo universal [`ABDShared/Components/I18n/index.js`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/I18n/index.js) (`createSynthI18n`, `deepMergeLocales`, `collectLocaleKeys`).
     - Diccionarios base comunes [`SHARED_EN`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/I18n/locales/en.js) y [`SHARED_ES`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/I18n/locales/es.js) con los términos transversales a toda la suite (`common`, `navbar` estándar, `settings` base, `calibration` UI, `hardwareDumps` UI, `midiLearn` UI).
     - Persistencia compartida de suite en `localStorage` (`abdsynths.locale`) con retrocompatibilidad automática (`axionik.locale`).
  2. **Capa 2 — Extensión Específica del Sintetizador (`WebUI/src/i18n/`)**:
     - [`WebUI/src/i18n/locales/en.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/i18n/locales/en.ts) (`axionikEn`) y [`WebUI/src/i18n/locales/es.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/i18n/locales/es.ts) (`axionikEs`) contienen exclusivamente la terminología propia de Hartmann Neuron (`nuke`, `silver`, `neuronDb`, `oracleCard`, etc.), fusionada automáticamente sobre `SHARED_EN` / `SHARED_ES`.
     - **Regla Estricta de Acrónimos de Síntesis**: Acrónimos universales y letras sueltas (`A`, `D`, `S`, `R`, `LFO`, `CUTOFF`, `RESO`, `Scape`, `Sphere`, `Blender`, `Slicer`, `MIDI`, `CC`, `NRPN`, `SysEx`) **no se traducen** jamás.
  3. **Selectores de Idioma en la Interfaz de Usuario**:
     - Botón de acceso rápido conmutador en la barra superior HUD de [`Navbar.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/Navbar.ts) (`EN` / `ES`).
     - Submenú desplegable en la barra de menú superior: `View -> Language -> English (EN) / Español (ES)`.
     - Selector por fichas (Pill Selector) en el cajón de configuración global [`SettingsDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/SettingsDrawer.ts).
     - Cambio instantáneo en caliente de toda la interfaz sin recarga de página ni corte de audio.
  4. **Suscripción Reactiva en Cajones y Componentes Especializados (Live Re-render sin cerrar pestañas)**:
     - Sincronización dinámica instantánea de [`CalibrationDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/CalibrationDrawer.ts), [`HardwareDumpsDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/HardwareDumpsDrawer.ts) y [`SettingsDrawer.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/SettingsDrawer.ts) vía `onLocaleChange`, manteniendo los cajones abiertos y preservando estado visual/knobs canónicos.
     - Métodos de mutación dinámica de etiquetas en caliente en [`ABDShared/Components/bank/bankShell.js`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/bank/bankShell.js) (`setTitle`, `setSearchPlaceholder`, `setTabLabels`, `setHeaderActionTitle`) para internacionalizar el gestor de bancos compartido.
  5. **Verificación y Pruebas Automatizadas**:
     - Test unitario en `ABDShared` ([`I18n.test.js`](file:///d:/desarrollos/ABDSynths/ABDShared/Components/I18n/I18n.test.js)) y en `ABDAxionikVS` ([`tests/i18n.test.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/tests/i18n.test.ts)) verificando paridad 100 % en Capa 1 (`SHARED_EN` vs `SHARED_ES`), Capa 2 (`axionikEn` vs `axionikEs`) y diccionario fusionado (`en` vs `es`).

---

### Fase I — Motor WebAssembly: Carga de Presets DSP y Pipeline de Build Automatizado [COMPLETADA]
> [!IMPORTANT]
> **Carga reactiva de presets en el motor WebAssembly (Worklet C++ DSP) y pipeline de empaquetado continuo.**

- **Carga de Presets en WASM ([`WasmBridge.cpp`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/wasm/WasmBridge.cpp) & [`axionikWorklet.js`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/wasm/axionikWorklet.js))**:
  - Función C++ exportada `axionik_load_preset_slot(int slotIndex)` compilada con Emscripten (`_axionik_load_preset_slot` en [`wasm/CMakeLists.txt`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/wasm/CMakeLists.txt)).
  - Gestión del comando `LOAD_PRESET_SLOT` en el AudioWorklet: mapeo instantáneo del slot al motor DSP en el hilo de audio en tiempo real.
  - Generación de presets sintéticos alternativos en [`Source/DSP/NeuronBankAdapter.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/NeuronBankAdapter.h) (`loadEmbeddedSyntheticPreset`) para asegurar variaciones tímbricas diferenciadas en navegador Web cuando no hay acceso al sistema de archivos nativo o a bases de datos neuronDB binarias en disco.
  - Verificación mediante tests automatizados en [`tests/wasm_dsp.test.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/tests/wasm_dsp.test.ts) comprobando que cada preset cargado produce espectros de señal y formas de onda distintas.

- **Pipeline de Compilación Reordenado ([`build.bat`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/build.bat))**:
  - Reordenamiento del ciclo de compilación: la fase `[2/6] WASM` se ejecuta antes del bundling de la WebUI (`[4/6]`).
  - Copia sincronizada y automática de binarios generados (`axionik.wasm`, `axionik.js`) a `WebUI/dist/` en cada ejecución, garantizando que el entorno web y los tests de navegador siempre ejecuten la última versión compilada del DSP C++.

---

### Fase J — Exportación Canónica al Diccionario de Datos Común (`ABDShared` v2.0) e Integración Rompler/Sampler [COMPLETADA]
> **Especificación y Guía de Integración Canónica en `ABDShared`:**
> - [`ABDShared/Docs/specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md`](file:///d:/desarrollos/ABDSynths/ABDShared/Docs/specs/COMMON_DATA_DICTIONARY_AND_INTEGRATION.md)
> - [`ABDShared/Contracts/parameter_dictionary.schema.json`](file:///d:/desarrollos/ABDSynths/ABDShared/Contracts/parameter_dictionary.schema.json)
> - [`ABDShared/Contracts/sampler_voice_parameter_spec.json`](file:///d:/desarrollos/ABDSynths/ABDShared/Contracts/sampler_voice_parameter_spec.json)

- **Objetivos Cumplidos**:
  - [x] **J.1 — Publicar `ABDShared/Contracts/hartmann_neuron_parameter_spec.json` (`v2.0.0`)**:
    - `Scripts/registry_generator.js` ampliado con el 7º artefacto canónico `shared_spec`, emitiendo los **445 parámetros** hacia `ABDShared/Contracts/hartmann_neuron_parameter_spec.json` validado al 100 % contra `parameter_dictionary.schema.json` v2.0.
    - Soporte completo de `"topology": "multi_part"` (7 partes: `r1`, `r2`, `blender`, `silver`, `shapers`, `controllers`, `master_fx`), `"curve": "SymBipolar"` con `"wireZeroCenter": 0` para los 176 parámetros `[-64..+63]`, direccionamiento NRPN (`nrpnMsb = index >> 7`, `nrpnLsb = index & 0x7F`), 63 `"modDestId"` (`0..62`), 11 direct MIDI CC, 26 VST `binaryPacking` y 48 parámetros con `"semanticRole"` transversal.
  - [x] **J.2 — Consumo del Diccionario Canónico de Sampler (`sampler_voice_parameter_spec.json`) en Modo Rompler / Importación Multisample**:
    - Conexión de `AxionikExpandedModel.h` y `AxionikExpandedSynthesizer.h` con el esquema canónico de zonas/multisamples de `ABDShared` (`zone.key.root`, `zone.key.low`, `zone.key.high`, `zone.vel.low`, `zone.vel.high`, `loop.mode`, `loop.startFrame`, `loop.endFrame`, `env.amp.*`, `filter.*`), verificado mediante pruebas unitarias en `ABDShared/tests/axionikExpandedModel.test.js`.

---

### Fase K — Mapeo de Controladores Semánticos, Automatización VST3 y Roundtrip Rompler E2E [COMPLETADA]
> [!NOTE]
> **Hitos Completados y Verificados:**
> Consumo de metadatos canónicos de `ABDShared/Contracts/hartmann_neuron_parameter_spec.json` y `sampler_voice_parameter_spec.json` v2.0 en el host C++ (`ABDAxionikVS`) y su puente WebUI.

#### K.1 — Mapeo de Controladores y Automatización en el Plugin C++ mediante `semanticRole` [x]
- **Objetivos Cumplidos**:
  1. **Generación / Exposición de Parámetros con Metadatos Semánticos y SymBipolar**:
     - `Scripts/registry_generator.js` actualizado con el flag `isSymBipolar` (176 parámetros `[-64..+63]`) y campo `semanticRole` (48 parámetros canónicos).
     - Generados `Conversion.gen.h` y `ParameterRegistry.gen.h` con matemática `SymBipolar` de centro muerto exacto en DAW (`raw 0.0f <-> norm 0.5f`) y `std::string_view semanticRole`.
  2. **Enlace Semántico en `MidiLearnManager` (`ABDShared`)**:
     - Añadido campo `juce::String semanticRole` a la estructura `Mapping` y al método `startLearning(...)` en `MidiLearnManager.h`.
     - Persistencia completa en JSON y `juce::ValueTree` (`saveState()` / `loadState()`), permitiendo asignaciones de controladores transversales a través de toda la suite ABDSynths.
  3. **Verificación de Curva `SymBipolar` y Roles Semánticos**:
     - Implementado **Test 13** en `tests/DspEngineFacadeTests.cpp`: verificación matemática de los 176 parámetros bipolares (`rawToNormalized` y `normalizedToRaw` exactos en `0.0f`, `-64.0f`, `+63.0f`) y cobertura completa de 48 roles semánticos.

#### K.2 — Pruebas de Roundtrip Rompler E2E: Importación de Multisamples y Banco Cruzado [x]
- **Objetivos Cumplidos**:
  1. **Test E2E de Carga Multisample en Motor C++**:
     - Implementado **Test 14** en `tests/DspEngineFacadeTests.cpp` con un modelo JSON expandido multicapa de 3 zonas acústicas/velocidad (`zone_low_p`, `zone_low_f`, `zone_hi`) estructurado conforme a `sampler_voice_parameter_spec.json` v2.0.
     - Carga exitosa mediante `loadExpandedModelFromJson` validando el preflight completo del motor (`report.ok == true`).
  2. **Verificación de Modulación Cruzada y Reproducción en Tiempo Real**:
     - Disparos NoteOn/NoteOff con matriz de notas y velocidades diferenciadas (baja velocidad en registro bajo -> `zone_low_p`, alta velocidad en registro bajo -> `zone_low_f`, registro agudo -> `zone_hi`), verificando generación de audio estéreo finito no nulo en cada zona y aislamiento sin fugas de notas.
     - Suite CTest en Release verificada al 100% (3/3 suites PASS: `DspEngineFacadeTests` [14/14 tests], `GoldenParityTest_Zones`, `GoldenParityTest_Matrix`).

---
## 7. Plan de Corrección de Calidad de `ABDShared` (Revisión 2026-11-09)

> **Origen:** revisión de calidad de [`ABDShared`](file:///d:/desarrollos/ABDSynths/ABDShared) (~200k líneas: 43,9k JS, 74,3k C++, 148 ficheros TS) hecha con scans sobre todo el árbol, compilación con `/W4` y lectura dirigida de los puntos calientes.
> **Ámbito:** todo lo listado abajo vive en el repositorio hermano `ABDShared`; `ABDAxionikVS` solo aparece como consumidor. Las rutas son relativas a `../ABDShared`.
> **Regla de oro:** la Fase Q0 va primero. Sin red de seguridad, los bugs de Q1 vuelven a entrar sin que nadie lo note.

### 7.1 Panel de progreso

| Fase | Contenido | Hallazgos | Estado | Esfuerzo |
| :--- | :--- | :---: | :---: | :---: |
| **Q0** | Red de seguridad (CI, `/W4`, linter) | 4 | `[x]` | S–M |
| **Q1** | Bloqueantes: portabilidad y bugs DSP | 4 | `[~]` (Q1.1 hecho) | S–M |
| **Q2** | Duplicación de la familia de controles | 1 | `[ ]` | L |
| **Q3** | Tipos y escapes de comprobación | 2 | `[ ]` | M |
| **Q4** | Robustez: errores tragados | 3 | `[ ]` | M |
| **Q5** | Mantenibilidad e higiene | 4 | `[ ]` | M |
| **TOTAL** | | **18** | | |

**Estado de partida medido:** 624 tests pasan (1 skipped, 42 ficheros, 15 s) · 13 avisos `/W4` en C++ propio · 28 imports con case roto · 4.033 líneas duplicadas en 20 pares · cero linter y cero `tsconfig` · la suite raíz no se ejecuta en CI.

### 7.2 Fase Q0 — Red de seguridad (bloqueante de todo lo demás)

- [x] **Q0.1 — CI que ejecute la suite raíz.**
  Hoy solo existen `.github/workflows/bridge-guard.yml` (un `node --test` del puente WebView2) y `publish-packages.yml` (cuatro `npm test` por paquete, con filtros de ruta): los 624 tests de la raíz no corren en ningún PR.
  *Cambio:* workflow `tests.yml` con `npm ci` + `npx vitest run` en `push` y `pull_request`, cacheando `node_modules`, más el `node --test` del puente.
  *Aceptación:* un PR con un test roto se marca en rojo.

- [x] **Q0.2 — `/W4` en todos los módulos C++.**
  Solo `Code/Scope/CMakeLists.txt:9-11` activa `/W4` (MSVC) y `-Wall -Wextra -Wpedantic -Wconversion -Wshadow` (GCC/Clang). `DspCore`, `SynthCore`, `DspEffects` y `BankManager` no tienen nada.
  *Cambio:* factorizar el bloque en el `CMakeLists.txt` raíz y aplicarlo como `INTERFACE` a las librerías. **Sin `/WX`** todavía: los 13 avisos actuales lo romperían.
  *Aceptación:* compilar `ABDShared_DspEffects_Tests` reproduce los 13 avisos sin pasar flags a mano.

- [x] **Q0.3 — Compilar los tres targets de test en CI.**
  Las opciones `ABDSHARED_BUILD_*_TESTS` están a `OFF` por defecto (`Code/CMakeLists.txt:34,77,99,128,507`) y ningún workflow las activa.
  *Cambio:* job MSVC en `windows-latest` con `-DABDSHARED_BUILD_DSPCORE_TESTS=ON -DABDSHARED_BUILD_SYNTHCORE_TESTS=ON -DABDSHARED_BUILD_DSPEFFECTS_TESTS=ON`, ejecutando los tres binarios.
  *Aceptación:* los 1.798 checks de `DspEffects` y los de `DspCore`/`SynthCore` corren en cada PR.

- [x] **Q0.4 — Linter y formato mínimos.**
  43,9k líneas de JS sin `eslint`, sin `prettier` y sin `.editorconfig`; el único script de `package.json` es `"test": "vitest run"`.
  *Cambio aplicado:* ESLint 10 con `eslint.config.js` plano y reglas de correctitud (`no-undef`, `no-redeclare`, `no-dupe-*`, `no-unreachable`, `no-const-assign`, `no-cond-assign`, `use-isnan`, `valid-typeof`, `no-compare-neg-zero`…), con `eqeqeq`, `no-empty`, `no-unused-vars`, `no-prototype-builtins` y `no-useless-escape` como aviso. **No** se usó `import/no-unresolved`: obliga a `eslint-plugin-import` y en NTFS el specifier mal capitalizado resuelve igual, así que la cubre `tests/importsCase.test.js`, que sí distingue mayúsculas. Prettier queda pendiente, en commit aparte.
  *Aceptación:* `eslint .` con 0 errores y ejecutándose en CI (job `lint`). Medido: **0 errores y 46 avisos en 213 ficheros**, los avisos concentrados en `catch` vacíos y variables sin usar de los ficheros duplicados que Q2 va a eliminar.

**Resultado tras Q0 + Q1.1 (verificado en local, 2026-11-09):** suite JS 43 ficheros / 625 pasan / 1 skipped · ESLint 0 errores / 46 avisos · C++ 4.443 + 2.299 + 1.798 comprobaciones, 0 fallos · los 13 avisos se reproducen sin pasar flags a mano · 28 specifiers corregidos y guard nuevo en `tests/importsCase.test.js`, probado también en negativo (falla si se introduce un caso roto). Toda esa red corre en CI (jobs `web`, `lint` y `dsp`).

**Hallazgos nuevos que ha destapado Q0:**

- **`package.json` no se puede instalar fuera del monorepo.** Declara `@abdsynths/i18n` y `@abdsynths/scope` como `workspace:*`, protocolo que npm rechaza en un checkout suelto (`EUNSUPPORTEDPROTOCOL`). Por eso el workflow instala vitest y jsdom en un prefijo temporal; arreglarlo de raíz (cambiar a referencias locales o publicar los paquetes) es una decisión aparte.
- **`jsdom` no estaba declarado** aunque `vitest.config.js` lo exige; la suite funcionaba solo porque el workspace padre lo hoisteaba. Declararlo toca el `pnpm-lock` del workspace padre, así que queda pendiente de decidir.
- **Cuatro defectos reales que solo cazó el linter** (ninguno afectaba a la suite, que seguía verde):
  - `Code/Scope/WebUI/src/theme.js` era **sintácticamente inválido**: todo el contenido en una sola línea y con `\n` literales en vez de saltos. Nadie lo importaba, así que ni los tests ni el build se quejaban; reconstruido a partir de su propio contenido escapado.
  - `Code/StudioTopology/resources/topology.js` leía `STORAGE_KEY` fuera de su ámbito: estaba declarada dentro de `renderStudio()` y se usaba en el arrastre de `renderNode()`. El `catch` vacío se tragaba el `ReferenceError`, con lo que **la disposición de nodos nunca se guardaba**. Elevada a ámbito de módulo.
  - `Components/trajectoryStick2D.js` declaraba `setLabels` dos veces; la segunda pisaba a la primera, que era la que comprobaba `this.container`. Unificado en una sola versión (con guarda, `trim()` y posibilidad de vaciar etiquetas).
  - `Contracts/lutTables.test.js` tenía un literal marcado por `no-loss-of-precision`; reescrito como `68124 * 48000 / 2 ** 24`, que es la fórmula que el propio comentario documenta y da el mismo double.
- **`eslint` tampoco es dependencia del manifiesto** (mismo bloqueo `workspace:*`). Lo instala el job `lint` en un prefijo temporal, y el README explica cómo hacerlo en local.
- **El test de ataque de `ADSREnvelope` estaba obsoleto.** `SynthCoreTests.cpp` esperaba un nivel de ~0,18 a 0,1 s, valor que correspondía al factor `* 6.0f` que el ataque llevaba antes de alinearse con la ley documentada (cruzar 1,0 justo en el tiempo de ataque). Nunca se vio porque `ABDSHARED_BUILD_SYNTHCORE_TESTS` está a `OFF` y no había CI. El test ahora fija el valor analítico (0,0313) y añade la invariante de que el ataque dura exactamente lo pedido.

### 7.3 Fase Q1 — Bloqueantes (bugs y portabilidad)

- [x] **Q1.1 — Los 28 imports con capitalización incorrecta.**
  En NTFS no se nota; en Linux/macOS/CI es `ERR_MODULE_NOT_FOUND`.
  *Evidencia:* `Components/Controls/index.js` tiene **16** specifiers que no coinciden con el nombre real del fichero (`./knob.js` → `Knob.js`, `./xypad.js` → `XYPad.js`, `./numberbox.js` → `NumberBox.js`, `./continuousNotices.js` → `ContinuousNotices.js`…); dentro de `Components/Controls`, nueve ficheros (`Wheel.js`, `XYPad.js`, `Knob.js`, `Slider.js`, `Segmented.js`, `Switch.js`, `Toggle.js`, `ContinuousNotices.js`) importan `continuousNotices.js`/`transitionNotices.js` en minúscula; y en `Components/Envelopes`, `EnvelopeGestures.js` y `EnvelopePad.js` importan `./envelopeCurve.js` cuando el fichero es `EnvelopeCurve.js` (y `EnvelopePad.js` además `./envelopeGestures.js`).
  *Cambio:* reescribir cada specifier al nombre exacto + test de guardia `tests/imports-case.test.js` que compare `readdirSync` contra los specifiers (funciona en Windows porque compara cadenas) + `import/no-unresolved` en Q0.4.
  *Aceptación:* el test de guardia pasa y no queda ninguna discrepancia.
  *Riesgo:* no mezclar con Q2 en el mismo PR, o el diff se vuelve ilegible.

- [ ] **Q1.2 — `OscReference.h`: variable posiblemente sin inicializar (C4701).**
  `Code/SynthCore/OscReference.h:198`: `out` se declara sin valor y el `switch` sobre `currentWaveform` no tiene `default`, así que un valor fuera de los tres enumeradores devuelve basura. UB silencioso en un oscilador.
  *Cambio:* inicializar `out = 0.0` y añadir `default:` que devuelva 0.0 (o `std::optional` si se prefiere propagar el error). Test forzando `static_cast<OscWaveform>(99)` y comprobando salida finita y nula.

- [ ] **Q1.3 — `DspAutoPan`: el desfase estéreo documentado no existe (C4189).**
  La cabecera de `Code/DspEffects/DspAutoPan.h` promete «Desfase estéreo entre canales: 0° a 180°», pero `lfoR` (`:125`) se calcula y nunca se usa, `panPos` (`:143`) sale siempre de `lfoL`, y el bloque `:113-121` (offset de fase y modulación de velocidad por canal) no influye en la salida.
  *Decisión de producto, dos salidas:*
  - **A (implementar):** aplicar `lfoR` al canal derecho con ley equal-power por canal, con test que mida el desfase real y que `phase_ = 0` dé L == R.
  - **B (recortar):** borrar `lfoPhaseR_`, `lfoR` y el offset de fase del código y del doc, dejando el pan mono que hace hoy.
  *Aceptación:* no queda ninguna variable calculada sin usar y la cabecera describe lo que el código hace.

- [ ] **Q1.4 — Parámetros muertos (C4100).**
  `DspFairComp.h:76` (`sampleRate` sin usar) y `S950PatchFields.h:452-453` (`fine`/`transpose`, **intencional**: la función empaqueta byte alto y bajo y no necesita leer los `PatchField`).
  *Cambio:* `[[maybe_unused]]` + comentario en `S950PatchFields`; decidir si `DspFairComp` debería usar `sampleRate` (¿coeficientes dependientes de frecuencia?) o quitarlo de la firma y actualizar llamadores.
  *Aceptación:* C4100 a cero sin `#pragma warning(disable)`.

### 7.4 Fase Q2 — Duplicación de la familia de controles

El hallazgo estructural más caro: hay **dos verdades** para los mismos componentes y ya han divergido.

*Evidencia medida:* 20 pares `Components/*.js` ↔ `Components/Controls/*.js`, **13 idénticos byte a byte** (4.033 líneas duplicadas). De los 7 divergentes, la copia de `Controls/` es la **obsoleta**: `paramIndex` aparece 8 veces en la raíz y **0** en `Controls/`; `wheel.js` tiene 308 líneas frente a 272 y a `Controls/Wheel.js` le falta entero el puente de gestos del host (`_openDrag`/`_closeDrag`, `beginChangeGesture` idempotente); `knob.js` 233 vs 231 (falta el `dataset.paramIndex`). El drag core existe **tres veces** con el mismo SHA-1 (`d09846fa`): `Components/drag-core.js`, `Components/Controls/drag-core.js` y `Components/Controls/DragCore.js`. Y nadie consume la copia nueva: el plugin importa **0** rutas `components/controls/`, el barril `Components/Controls/index.js` no lo importa nadie y `package.json` solo publica de ahí `stepMatrix.js`.

- [ ] **Q2.1 — Decisión de producto:** ¿`Components/Controls` es la familia canónica del futuro (PascalCase + subcarpetas) o un fork abandonado?
- [ ] **Q2.2a — Si es un fork abandonado (recomendado):** mover lo único vivo (`stepMatrix.js`, `stepMatrix.test.js`, `Controls.test.js` y su CSS) a la raíz con el nombre canónico, actualizar `package.json` e imports, y borrar el resto en un commit propio.
- [ ] **Q2.2b — Si es la canónica:** portar a `Controls/` lo que falta (`paramIndex`, gestos en `Wheel`, `Knob`), borrar la raíz y actualizar los consumidores de `ABDAxionikVS` (hoy apuntan a `components/wheel.js`).
- [ ] **Q2.3 — Unificar el drag core** en una sola copia y reexportar.
- [ ] **Q2.4 — Test de guardia** que falle si vuelve a aparecer un basename repetido (case-insensitive) en dos rutas de `Components/`.

*Aceptación:* `Components` no tiene ningún basename repetido y el plugin sigue compilando. *Riesgo:* alto; hacerlo en un PR de puros renombres, sin cambios de contenido.

### 7.5 Fase Q3 — Tipos y escapes de comprobación

- [ ] **Q3.1 — `tsconfig.json` con `checkJs` laxo**, por subcarpeta y empezando por `Contracts/` (que ya es TS). Hoy hay 148 ficheros TS y 43,9k líneas JS sin ningún typecheck.
- [ ] **Q3.2 — Quitar los 9 `as any` de `Code/SamplerFormats/*.ts`:** `format: 'akai_disk' as any` en `AkaiDiskFormat.ts:1232,1378`, `EmuDiskFormat.ts:685,815,961`, `EnsoniqDiskFormat.ts:271`, `RolandDiskFormat.ts:457`, `YamahaDiskFormat.ts:198`. El campo `format` debe ser una unión con todos los literales; el `as any` anula justo la comprobación que impide un `format` inválido.

*Aceptación:* `tsc --noEmit` sin errores en `Contracts/` y `SamplerFormats/`, y cero `as any` en esos directorios.

### 7.6 Fase Q4 — Robustez y errores tragados

- [ ] **Q4.1 — Los 10 `catch (_) {}` vacíos:** `Code/StudioTopology/resources/topology.js:118,362,371`, `Components/LiveSysExInspector/LiveSysExInspector.js:540,577`, `Components/multiStageShaperPad.js:313`, `Components/studioTopology.js:195,474,485`, `Components/trajectoryStick2D.js:243`. O se registra con un logger inyectable (no `console`), o se justifica en un comentario por qué es seguro ignorarlo. **Prioridad:** los dos de `LiveSysExInspector`, que parsean datos de un dispositivo MIDI real y hoy no dejan rastro.
- [ ] **Q4.2 — `localStorage` sin protección (38 usos).** En modo privado o con la cuota llena `setItem` lanza y tumba la UI: envolver en un helper con `try/catch` y fallback en memoria.
- [ ] **Q4.3 — `JSON.parse` sin `try` (8 usos de producción):** `topology.js:117,368`, `midiLearnStore.js:254,593`, `studioTopology.js:190,479`, `Contracts/index.js:43`, `Utils/cruceAira.js:56`. Un JSON corrupto deja la UI en blanco.

*Aceptación:* linter con `no-empty` activo y tests de storage y JSON corruptos que devuelven estado por defecto en vez de lanzar.

### 7.7 Fase Q5 — Mantenibilidad e higiene

- [ ] **Q5.1 — Ruido de jsdom.** Cada ejecución imprime decenas de `Not implemented: HTMLCanvasElement.prototype.getContext`. No es un bug (el código comprueba `ctx` después), pero entierra fallos reales: stub de canvas en `vitest.config.js` y `environment` por fichero donde no haga falta jsdom.
- [ ] **Q5.2 — Test que no dependa del árbol del desarrollador.** `Code/MidiKeyboard/tests/host-strip-height.test.js` recorre el workspace con `readdirSync` recursivo: es el que cae por timeout bajo carga (30 s frente a 3 s en solitario) y el que obliga a `describe.skipIf(SIN_WORKSPACE)`. Sustituir por un registro de hosts versionado (JSON) e inyectar el `workspaceRoot`.
- [ ] **Q5.3 — Monolitos, por rentabilidad:** `DspEffectsTests.cpp` 6.650 líneas con 1.798 checks (partir por familia de efecto: es el que más duele al añadir un test) y `LiveSysExInspector.js` 1.268 (separar parseo de render). **No** tocar todavía `MidiKeyboard/src/keyboard.js` (1.803): es el fichero con más consumidores y sin red de seguridad no compensa.
- [ ] **Q5.4 — `Assets.zip` (59 MB) versionado en la raíz** cuando `*.zip` ya está en `.gitignore`. Confirmar que ningún build lo usa y sacarlo del historial solo si el tamaño molesta (requiere reescritura: no sin acuerdo).

*Aceptación:* `npx vitest run` sin stderr inesperado y el test de hosts determinista.

### 7.8 Orden de ejecución

```text
Q0.1 CI tests ─┬─> Q1.1 imports case ──> Q0.4 eslint (import/no-unresolved)
               ├─> Q1.2 OscReference
               ├─> Q1.3 DspAutoPan
               └─> Q1.4 params muertos
Q0.2 /W4 ──────> Q0.3 CI C++ ──> (deja el listón para no reintroducir Q1.2/Q1.4)
Q2.1 decisión Controls ──> Q2.2/Q2.3 mover o borrar ──> Q3.x tipos
Q4.x robustez (independiente, se puede intercalar)
Q5.x higiene (al final; Q5.2 antes de Q5.3)
```

Q0 + Q1 caben en un día de trabajo concentrado y eliminan los dos bugs y la rotura en Linux. Q2 es la única que necesita una decisión de producto antes de tocar código.

### 7.9 Fuera de alcance de esta revisión

- Revisión línea a línea de las 200k líneas: el plan se apoya en scans automáticos y lectura dirigida.
- Análisis estático adicional (`clang-tidy`, `cppcheck`): no se ha comprobado que estén instalados; si se añaden, van con Q0.2.
- Verificación en Linux real: la conclusión de los 28 imports se basa en el listado de ficheros frente a los specifiers; el test de guardia de Q1.1 la convierte en comprobación automática.

---
