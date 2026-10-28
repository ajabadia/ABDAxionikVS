# ABDAxionikVS â€” Informe de Arquitectura y Plan de ImplementaciÃ³n (`ROADMAP.md`)

> **Proyecto:** `ABDAxionikVS` (`D:\desarrollos\ABDSynths\ABDAxionikVS`)
> **Repositorio GitHub:** `https://github.com/ajabadia/ABDAxionikVS.git`
> **DocumentaciÃ³n de Referencia e IngenierÃ­a Inversa:** [`DOCS/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS), [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md) y [`DOCS/DSP_MIGRATION_AND_FIXES.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/DSP_MIGRATION_AND_FIXES.md)
> **Objetivo:** RecreaciÃ³n moderna, verificable bit a bit y extensible del sintetizador **Hartmann Neuron / NeuronVS**, integrada en el ecosistema **ABDSynths** (`JUCE 9` + `C++20` puro sin JUCE en DSP + `WebAssembly AudioWorklet` + `WebView2` empaquetado con Vite) y compatible al 100 % con `NeuronDB` (`.model` / `.sound`) y con `ABDNeuModMakr` (`.nmmodel` `v2.1`).

---

## 1. SÃ­ntesis de AuditorÃ­a de Fuentes Locales

### 1.1 Corpus de IngenierÃ­a Inversa (`C:/Users/ajaba/Downloads/neuron`)
1. **ParticiÃ³n en Tres Estados (`core+0x3dc`, `core+0x3e8`, `core+0x3e0`)**:
   - **`snddat` (`core+0x3dc`)**: AlmacÃ©n autoritativo de **445 registros de parÃ¡metro** de `40 B` (`0x28 B`), inicializados desde la tabla estÃ¡tica de descriptores en `.rdata` (`0x10049f08`, `445 Ã— 28 B`, todos con `step = 1.0`).
     - Layout del registro de `40 B`: `+0x00` `name`, `+0x04` `model_name`, `+0x08` `model_variant`, `+0x0c` `min`, `+0x10` `max`, `+0x14` `default`, `+0x18` `step`, `+0x1c` `value` (`float`), `+0x20` `observers[16]`, `+0x24` `capacity = 16`.
     - **Regla de cuantizaciÃ³n y clamp (`FUN_10001170`)**: `trunc(v / step) * step` seguido de `clamp(min, max)`. Existen **19 parÃ¡metros** cuyo `default` declarado en `.rdata` (`0`) estÃ¡ por debajo de su `min` (`1`): los 12 `*StickPlayback` (`R1L1..L3`, `R2L1..L3` Scape/Sphere), los 3 `SilverL1..L3StickPlayback` y los 4 `EQ_*`. Al construirse, `FUN_10001170` los fija en `1.0`.
   - **`params` (`core+0x3e8`, `11.484 B` / `0x2CDC`)**: Coeficientes de ejecuciÃ³n intermedios:
     - `+0x14`: 6 Ã­ndices de fuentes de modulaciÃ³n (`ModDestIndex` / fuentes).
     - `+0x44`: 6 controles de ejecuciÃ³n en tiempo real alimentados por MIDI (`CC 1`, `CC 2`, `CC 3`, `CC 4`, `CC 11` y `Channel Pressure`).
     - `+0x17c`: 6 valores actuales de fuentes de modulaciÃ³n.
     - `+0x280`: **335 observadores** de `24 B` registrados contra los 445 registros de `snddat`.
     - `+0x278c`: **340 slots de valores efectivos** (`p[0..334]`, `float` en dwords) recalculados por `FUN_100134e0` (`vtable+0x04`) en cada notificaciÃ³n de observador.
   - **`engine` (`core+0x3e0`, `13.948 B` / `0x367C`)**: Estado de sÃ­ntesis en tiempo real. JamÃ¡s lee `snddat` directamente.

2. **Frontera Traductora (`FUN_10040550`) y Carga de Modelos (`0x10013620` / `FUN_100440d0`)**:
   - `FUN_10040550` (`15.226 B`, 2.125 lÃ­neas) es el **Ãºnico puente** que escribe en los primeros `0xDA8` bytes de `engine` (`e[0x000..0x36A]`) a partir de `params+0x278c`:
     - Incluye dos bloques espejo de `0x588 B`: `0x284..0x80B` para **Resinator 1 (`R1`)** y `0x80C..0xD93` para **Resinator 2 (`R2`)**, donde `R2` lee `p[N + 70]` para 42 de los 47 campos literales.
     - Al final invoca `FUN_100343e4(e[0xD95], p)` (escritura de sub-objeto de motor) y `FUN_100373a0(e)` (validador de tablas de teclado de `R1`/`R2` que habilita el flag `e + 0xD99 = 1`).
     - Ya existe una traducciÃ³n C++ generada y verificada en `NeuronVS_port/src/translator.cpp` (**351/351 presets bit-idÃ©nticos en reposo** y **333/351 a mitad de nota**, con 18 presets difiriendo en 1 ULP por redondeo intermedio de 80 bits x87 vs SSE2).
   - El observador `0x10013620` sobre `R1ModellIndex` (`[22]`) y `R2ModellIndex` (`[102]`):
     - Adquiere el `<NNN>.model` del banco (`FUN_1000b320`), extrae los bloques `mnAN` (12 etiquetas ASCII de 8 bytes) y `fdAN` (6 pares `[from, to]` de `float32`) de `%06d.scape` y `%06d.sphere` para actualizar dinÃ¡micamente los nombres de eje (`+0x04`, `+0x08`) y valores por defecto (`+0x14`) de los 12 parÃ¡metros Scape/Sphere de esa capa.
     - Llama 128 veces a `FUN_100440d0` (notas MIDI `0..127`) leyendo `map.script` (`1.027` lÃ­neas: `SplitType` + `128 Ã— 8` claves `NoteNNNL/HSource`, `RootKey`, `Detune`, `Volume`) y poblando las **128 entradas de `40 B` por tecla** en `engine+0xDB0` (`R1`) y `engine+0x2200` (`R2`).

3. **Camino de Audio (`NeuronVS_dsp`, 87 Funciones y 1.430 Constantes)**:
   - El adaptador `0x1000bc40` procesa en **bloques fijos internos de 128 muestras** y delega en el orquestador `FUN_100382b0`.
   - El grafo alcanzable desde `FUN_100382b0` consta de **exactamente 87 funciones** (`81.159 B`, `12.665` lÃ­neas de pseudocÃ³digo, **0 llamadas indirectas**), todas contiguas en `0x10021C90..0x100478D0`.
   - Cada voz (`0x70 B`, tag `'nSAN'`, 129 alojadas en `engine+0xD94`, polifonÃ­a mÃ¡xima 32 en `engine+0xDA0`, gobernada por `SoundNumVoices` `4..12`) contiene **dos motores Resinator independientes de `0x6838 B` (`26.680 B`)** en `+0x68` (`R1`) y `+0x6C` (`R2`).
   - En `noteOn` (`FUN_1003d800`), se copia `engine+0x284` a `R1+0x638C` y `engine+0x80C` a `R2+0x638C` (`0x588 B`), y `FUN_10032970` selecciona la zona `LowSource` vs `HiSource` segÃºn `note < *(float*)(params + 0x418)` y enlaza:
     - **`.scape`**: curva `int16` en `file + 0x104` (`100` muestras/ciclo), leÃ­da por `FUN_100317b0` (`CurveReader`) con interpolaciÃ³n lineal en bucle y filtro de Ã©nfasis diferencial de 2 puntos `(v - prev) * 2 + v`.
     - **`.sphere`**: frames de `6.568 B` (`magic = 1234` / `0x4d2`) con tabla de **25 bandas Ã— 4 slots `float`** (`FUN_10031950` `BandReader`, crossfade cada `1024` o `512` muestras segÃºn `decodeMode`) seguida del bloque opaco de **`6.152 B` (1.024 parciales aditivos/espectrales)** decodificado y sintetizado por `FUN_1002e750` â†’ `FUN_1003bd10` / `FUN_1003c980` â†’ `FUN_10034290`.
   - **Etapa de salida peculiar (`0x1000bc40`)**: aplica **clip-to-zero** (`if (x*x > 1.0f || isnan(x)) x = 0.0f`). En `ABDAxionikVS` se implementarÃ¡ un flag conmutable `OracleClipToZeroMode` (activo en tests de paridad Ã¡urea contra `NeuronVS.dll`; sustituido en modo musical moderno por saturaciÃ³n suave / limitador de seguridad sin clics).

4. **Superficie VST2, MIDI y UI Original (`NeuronVS_vst2`, `NeuronVS_layout`)**:
   - El VST2 original expone **26 parÃ¡metros al host** (12 pares Sphere/Scape de `R1L1..L3` y `R2L1..L3` + `FilterFreq` `[274]` + `FilterReso` `[275]`).
   - El MIDI original procesa Note On/Off (omni), **CC 1, 2, 3, 4 y 11** + **Channel Pressure** (los 6 controles de ejecuciÃ³n en `params+0x44`), **CC 32** (Bank Select `0..9`) + **Program Change** (`bank * 100 + prog`, `0..999`) y **Pitch Bend**.
   - La interfaz original (`800Ã—652`) se estructura en **33 pÃ¡ginas distribuidas en 10 vistas**, con **429 instancias de controles**, **174 enlaces a parÃ¡metros** (`control_params.csv`) y **44 enlaces de cambio de pÃ¡gina** (`page_ref_links.csv`), donde las vistas hijas `1, 2, 3, 6` reflejan directamente los parÃ¡metros `R1ParamLevel` `[25]`, `R2ParamLevel` `[105]`, `CurFreqFX` `[282]` y `CurTimeFX` `[328]`.

### 1.2 Compatibilidad con `ABDNeuModMakr` (`D:/desarrollos/ABDSynths/ABDNeuModMakr`)
- `ABDNeuModMakr` ya dispone de codecs verificados en TypeScript (`ModelFormat.ts`, `SoundFormat.ts`, `ZipArchive.ts`, `ScapeSphereGenerator.ts`) para:
  - Contenedores `.scape`, `.sphere`, `map.script` (1.027 lÃ­neas), `MName`, `ModelNames`, `sound.script` (445 claves), `sound.stickrec` (lÃ­neas hexadecimales de 9 dÃ­gitos `TTTTFCVVV`), `SoundNames` y paquetes ZIP `.model`/`.sound`.
  - Las tablas exactas de los **10 Parameter Sets** (`0..9`) de `NASAnalysis.dll` (`SCAPE_MNAN_NAMES_BY_SET`, `SPHERE_MNAN_NAMES_BY_SET`, `buildScapeFdPairs`, `buildSphereFdPairs`).
  - El formato extendido **`.nmmodel` (`v2.1` JSON)** con frames `Float32` de 64 parciales (`amplitudes[64]`, `frequencyOffsets[64]` en semitonos relativos a fundamental), soporte multicapa (`layers[]`) y muestras WAV embebidas (`Samples/`).

### 1.3 Hallazgos de las Versiones Mac (`NeuronVS Intel 1.55 / 1.56` de 2013) y Linux (`Neuron80GB-OS15`) + Decisiones Cerradas
1. **Tabla de SÃ­mbolos Original (`LC_SYMTAB`) de Mac `1.56` (`2013`)**:
   - Se han extraÃ­do los **3.012 sÃ­mbolos** del binario Mach-O de Mac `1.56` (compilado por Prosoniq / Stephan Bernsee en 2013) en [`mac156_symbol_xref.csv`](./DOCS/reverse_engineering/dsp/mac156_symbol_xref.csv) y correlacionado 1:1 con PC `1.0` en [`pc10_to_mac156_dsp_map.csv`](./DOCS/reverse_engineering/dsp/pc10_to_mac156_dsp_map.csv), identificando las clases C++ originales (`CParam`, `CParamDB`, `SoundParams`, `ModuleParams`, `ModelAdmin`, `ModelMem`, `ModelZone`, `ModuleEngine`, `SynthCore`, `SynthEditor`) y las 23 clases internas del motor NAS (`CNASEngine`, `CResynator` y sus 7 sub-motores `CParsetEngine0..6`, `CVoice`, `CShaper4T4L`, `CSilverRack`, `CMasterModFX`, `CMasterTimeFX`, `CDelayTapLine`).
2. **Los 4 Bugs Corregidos Oficialmente en Mac `1.56` (`2013`)**:
   - EliminaciÃ³n del ring-buffer fijo de 128 muestras y del *clip-to-zero* (`if (x*x > 1.0) x = 0.0`) en `ModuleEngine::stEngineProcess` (`0x00021df8`) + soporte de `sampleFrames` variable en `_NASEngineProcess` (`0x00094230`).
   - 3 nuevos mÃ©todos `Reset()` (`CMasterTimeFX::Reset` `0x000678e0`, `CMasterModFX::Reset` `0x00067a30`, `CFXBase::Reset` `0x00067a60`) invocados desde `CNASEngine::Process` (`0x000940b4`) para poner a cero (`memset`) los 12 buffers circulares de Delay/Reverb al activar o cambiar de efecto.
   - Nuevo wrapper de filtro por voz `_sqe1Aw53j...` (`0x00089c90`) que comprueba `flag_0x280 == 1` y limpia los dos buffers de estado biquad de `100 B` (`esi+0x30`, `esi+0x34`) antes de ejecutar `ProcessVoiceFilter` (`0x00088bc0` / `FUN_100330f0`), evitando explosiones `NaN`/pops.
   - DesactivaciÃ³n por defecto del controlador `<Nuke>` (en `ABDAxionikVS` se elimina por completo cualquier dependencia de `<Nuke>`).
3. **Variaciones de Formato del Disco del Hardware Linux (`Neuron80GB-OS15`)**:
   - En los 1.567 modelos del disco `OS15` ([`NEURON80GB_OS15_README.md`](./DOCS/reverse_engineering/neurondb/NEURON80GB_OS15_README.md)), la resoluciÃ³n de ciclo de `.scape` (`csAN+0x14`) varÃ­a entre `84, 100, 168, 169, 337 y 2047` muestras/ciclo, 345 archivos `.scape` son *one-shot* sin bucle (`loop_start == loop_end == 0`), y los archivos `.sphere` usan `1, 25 o 61` bandas (`psAN+0x1C`) y `4, 8, 16, 32 o 64` floats por banda (`psAN+0x20`). El cargador leerÃ¡ siempre estas dimensiones de las cabeceras `csAN`/`psAN`.
4. **4 Decisiones de DiseÃ±o Aprobadas**:
   - **Matriz de ModulaciÃ³n Unificada `6 Ã— 5` en `ABDShared`**: Slot 1 = `[413..424]` (63 destinos `0x10049E00`); Slots 2..5 = `Free Controllers [363..410]`, integrada con `ABDShared/Code/MidiKeyboard`.
   - **Independencia de Frecuencia de Muestreo**: Factor `srScale = 44100.0 / sampleRate` en `EnhancedMode` (`1.0` en `StrictLegacyParity` para el orÃ¡culo *golden* a `44.1 kHz`).
   - **ResoluciÃ³n Inteligente de `NeuronDB` + Modelo `511 (sinew)` Embebido**: Modelo `511` (`sinew`) y preset `000 InitSound` compilados en `constexpr` + bÃºsqueda automÃ¡tica de `NeuronDB`.
   - **`TrajectoryStick2D` con Estela Visual (`Trail`) y Modos `Loop` / `One-Shot`**.
   - VÃ©ase el detalle completo en [`DOCS/DSP_MIGRATION_AND_FIXES.md`](./DOCS/DSP_MIGRATION_AND_FIXES.md).
5. **Hallazgos Recientes de DescompilaciÃ³n y OrÃ¡culo (`stSPEngineCb`, Slots 0xA4/0xC2, Warm-up de DLL)**:
   - **Campos espejo muertos (`dead mirrors`) en `stSPEngineCb` (`0x100139D0`)**: El callback del motor de parÃ¡metros de `NeuronVS.dll` actualiza los slots 164 (`0xA4`: `R1AmpEnvR`) y 194 (`0xC2`: `R2AmpEnvR`) escribiendo en `params+0x0C` y `params+0x10`. La investigaciÃ³n estÃ¡tica de referencias cruzadas y la sonda dinÃ¡mica de lectura (`neuron_golden --mirror`) confirmaron que ningÃºn mÃ©todo ni subrutina DSP lee jamÃ¡s `params+0x0C` ni `params+0x10`. Son campos espejo inertes sin impacto alguno en el renderizado de audio ni en la sÃ­ntesis.
   - **Puerta de 1 mm (`1/25.4` pulgadas)**: La condiciÃ³n de umbral `1/25.4 = 0.03937007874015748` encontrada en la descompilaciÃ³n del callback corresponde a la conversiÃ³n de milÃ­metros a pulgadas (en los registros 21 y 32 de `snddat`, las cotas fÃ­sicas vienen medidas en mm y se convierten a pulgadas al guardarse en `p[164]` y `p[194]`). Solo se actualiza el parÃ¡metro si supera el umbral fÃ­sico de 1 mm.
   - **RÃ©gimen de calentamiento y desplazamiento de estado en `NeuronVS.dll`**: La DLL original de 2004 altera su rÃ©gimen interno acumulativo entre la 3Âª y la 4Âª carga de preset (las primeras 3 cargas renderizan bit-idÃ©ntico, pero a partir de la 4Âª sufren un desplazamiento de ~0.267 por acumulaciÃ³n de estado estÃ¡tico en variables internas de la DLL). En los tests de paridad de audio diferencial (`GoldenParityTest`), deben descartarse siempre los primeros 4 renders de calentamiento para evaluar en rÃ©gimen permanente estable.

---

## 2. Estructura del Repositorio (`ABDAxionikVS`)

Siguiendo estrictamente la arquitectura de `ABDNeural`, `ABDMS2000`, `ABDEep` y las guÃ­as `abd-synth-creation-guide` / `juce-audio-hybrid-plugin`:

```text
D:\desarrollos\ABDSynths\ABDAxionikVS\
â”œâ”€â”€ CMakeLists.txt                   # Build raÃ­z (JUCE 9 Standalone + VST3 + CTest)
â”œâ”€â”€ DspSources.cmake                 # Lista ÃšNICA anti-drift de fuentes DSP (compartida con wasm/)
â”œâ”€â”€ package.json                     # miembro del pnpm-workspace (@abdsynths/shared, @abdsynths/midi-keyb)
â”œâ”€â”€ vite.config.js                   # Empaquetado de WebUI/ -> WebUI/dist/ (base: './')
â”œâ”€â”€ vitest.config.js                 # Suite de tests JS/TS (contratos, codecs, UI, bridge)
â”œâ”€â”€ build.bat                        # Pipeline integral con tee a build-last-run.log y selftest E2E
â”œâ”€â”€ start.bat                        # Lanzador (bancada WebView2, navegador WASM, selftest)
â”œâ”€â”€ README.md                        # DocumentaciÃ³n general, compilaciÃ³n y banderas
â”œâ”€â”€ CHANGELOG.md                     # Historial de cambios (Keep a Changelog)
â”œâ”€â”€ HANDOFF.md                       # Estado vivo, arquitectura y puntos de entrada
â”œâ”€â”€ ROADMAP.md                       # Plan de implementaciÃ³n por fases (este documento)
â”‚
â”œâ”€â”€ DOCS/                            # Corpus local completo de ingenierÃ­a inversa, manuales y UI
â”‚   â”œâ”€â”€ UI_INVENTORY_AND_ADAPTATION.md # Inventario de los 445 parÃ¡metros, vistas y adaptaciÃ³n UX
â”‚   â”œâ”€â”€ DSP_MIGRATION_AND_FIXES.md   # Cierre de incÃ³gnitas de params, eliminaciÃ³n de Nuke y 9 bugs corregidos
â”‚   â”œâ”€â”€ manuals/                     # Manuales oficiales (NeuronVS, Hardware, Technical Hints, Nuke4All, BrainMapper)
â”‚   â”œâ”€â”€ community_panels/            # Paneles Lemur (MYELIN, Axel), Bidule, PureData y Max for Live
â”‚   â””â”€â”€ reverse_engineering/         # Estudio RE completo (dsp, preset_format, neurondb, layout, vst2, port...)
â”‚
â”œâ”€â”€ schemas/                         # Fuentes declarativas canÃ³nicas (copiadas/validadas del estudio RE)
â”‚   â”œâ”€â”€ preset_schema.csv            # 445 descriptores estÃ¡ticos (index, key, group, min, max, default, step)
â”‚   â”œâ”€â”€ vst_exposed_params.csv       # 26 parÃ¡metros VST expuestos al host y su mapeo a los 445
â”‚   â”œâ”€â”€ control_params.csv           # 174 enlaces control UI <-> parÃ¡metro
â”‚   â”œâ”€â”€ page_ref_links.csv           # 44 selectores de pÃ¡gina/vista
â”‚   â”œâ”€â”€ constants_types.csv          # 1.430 constantes tipadas del motor DSP
â”‚   â””â”€â”€ parameter_sets_mnan.json     # 10 Parameter Sets (mnAN / fdAN) compartidos con ABDNeuModMakr
â”‚
â”œâ”€â”€ Scripts/
â”‚   â”œâ”€â”€ registry_generator.js        # Generador canÃ³nico Ãºnico (C++ APVTS + JS + NRPN/CC/SysEx + bridge)
â”‚   â”œâ”€â”€ build_webui.js               # Ejecuta vite build -> WebUI/dist/ y genera catÃ¡logo de assets
â”‚   â””â”€â”€ verify_golden_oracle.py      # OrÃ¡culo diferencial contra vectores Ã¡ureos de NeuronVS.dll
â”‚
â”œâ”€â”€ Source/
â”‚   â”œâ”€â”€ PluginProcessor.h / .cpp     # AudioProcessor JUCE 9 (bus Input opcional, APVTS, MIDI, estado)
â”‚   â”œâ”€â”€ PluginEditor.h / .cpp        # AudioProcessorEditor con WebView2 (sirve WebUI/dist/ + dev probe)
â”‚   â”œâ”€â”€ WebPilotHost.cpp             # Bancada nativa ligera WebView2 para desarrollo y selftest E2E
â”‚   â”‚
â”‚   â”œâ”€â”€ Generated/                   # Emitido por Scripts/registry_generator.js (PROHIBIDO editar a mano)
â”‚   â”‚   â”œâ”€â”€ ParameterRegistry.gen.h  # 445 parÃ¡metros, 26 alias VST, rangos, defaults y grupos
â”‚   â”‚   â”œâ”€â”€ MidiContract.gen.h       # Tablas CC, NRPN (0..444) y SysEx IDs
â”‚   â”‚   â””â”€â”€ BridgeContract.gen.h     # Literales versionados del protocolo WebView2
â”‚   â”‚
â”‚   â”œâ”€â”€ State/
â”‚   â”‚   â”œâ”€â”€ SndDatStore.h / .cpp     # 445 registros de 40 B, regla FUN_10001170, 16 observadores/registro
â”‚   â”‚   â”œâ”€â”€ ParamsExecution.h / .cpp # Estado intermedio params (335 observadores, 340 slots efectivos)
â”‚   â”‚   â”œâ”€â”€ StickRecorder.h / .cpp   # GrabaciÃ³n y reproducciÃ³n de trayectorias sound.stickrec (TTTTFCVVV)
â”‚   â”‚   â”œâ”€â”€ NeuronBankAdapter.h/.cpp # Carga/guardado de NeuronDB (Models/000..511, Sounds/000..999, ZIP)
â”‚   â”‚   â””â”€â”€ NmModelLoader.h / .cpp   # Lector C++ de paquetes .nmmodel v2.1 de ABDNeuModMakr
â”‚   â”‚
â”‚   â”œâ”€â”€ MIDI/
â”‚   â”‚   â”œâ”€â”€ NeuronMidiProcessor.h/.cpp # Enrutado MIDI (Note, CC 1/2/3/4/11/32, PC, AT, PB, XY CCs)
â”‚   â”‚   â”œâ”€â”€ NeuronNrpnHandler.h/.cpp # Direccionamiento NRPN de 14 bits para los 445 parÃ¡metros
â”‚   â”‚   â””â”€â”€ NeuronSysExHandler.h/.cpp# Dumps de patch/modelo/stickrec usando ABDShared::HardwareDrivers
â”‚   â”‚
â”‚   â”œâ”€â”€ WebUI/
â”‚   â”‚   â”œâ”€â”€ ParameterBridge.h / .cpp # Puente bidireccional APVTS <-> WebView2 (sondeo diff, sin ecos)
â”‚   â”‚   â””â”€â”€ BridgeAdapters.h         # Adaptadores Preset, Model, StickRec, MIDI CC y TelemetrÃ­a
â”‚   â”‚
â”‚   â””â”€â”€ DSP/                         # 100 % C++20 PURO â€” PROHIBIDO incluir <juce_*.h>
â”‚       â”œâ”€â”€ Runtime/
â”‚       â”‚   â”œâ”€â”€ DspEngineFacade.h/.cpp # Fachada limpia consumida por PluginProcessor y por WASM
â”‚       â”‚   â”œâ”€â”€ DspEvent.h           # Eventos sample-accurate (NoteOn/Off, CC, PitchBend, Aftertouch)
â”‚       â”‚   â””â”€â”€ VoiceMemoryPool.h    # Pool RT-safe preasignado en prepare() (sustituye new(0x2020))
â”‚       â”‚
â”‚       â”œâ”€â”€ ClassicNeuron/           # Fase A: Motor Hartmann Neuron 1:1 (las 87 funciones)
â”‚       â”‚   â”œâ”€â”€ Constants.gen.h      # 1.430 constantes verificadas por ancho de instrucciÃ³n
â”‚       â”‚   â”œâ”€â”€ EngineState.h        # Layout exacto de engine (0x367C B) y descriptores de voz ('nSAN')
â”‚       â”‚   â”œâ”€â”€ Translator.h / .cpp  # FUN_10040550 + FUN_100343e4 + validador FUN_100373a0
â”‚       â”‚   â”œâ”€â”€ ZoneMapper.h / .cpp  # FUN_100440d0: 128 entradas de 40 B por tecla (R1 +0xDB0, R2 +0x2200)
â”‚       â”‚   â”œâ”€â”€ CurveReader.h / .cpp # FUN_100317b0: lector .scape (int16, bucle, Ã©nfasis diferencial)
â”‚       â”‚   â”œâ”€â”€ BandReader.h / .cpp  # FUN_10031950: lector .sphere (25 bandas x 4 slots, crossfade)
â”‚       â”‚   â”œâ”€â”€ SphereDecoder.h/.cpp # FUN_1002e750 / FUN_1003bd10 / FUN_1003c980 / FUN_10034290 (6152 B)
â”‚       â”‚   â”œâ”€â”€ ResinatorVoice.h/.cpp# Motor por capa (0x6838 B): FUN_10032970, FUN_10029e34, FUN_1002e7a0
â”‚       â”‚   â”œâ”€â”€ BlenderStage.h/.cpp  # Mezcla dual R1/R2, modos de fusiÃ³n y envolvente de Blender
â”‚       â”‚   â”œâ”€â”€ SilverStage.h / .cpp # Filtros multifrecuencia (3 curvas) + FreqFX + TimeFX + Stick
â”‚       â”‚   â”œâ”€â”€ ModulationStage.h/.cpp# LFO global, 4L4T Shaper Envelopes (R1, R2, Blender, Silver), Slicer
â”‚       â”‚   â””â”€â”€ BlockOrchestrator.h/.cpp # FUN_100382b0 + adaptador de bloques de 128 muestras
â”‚       â”‚
â”‚       â””â”€â”€ Extended/                # Fase B: VersiÃ³n Extendida / Extended (capacidades ABDNeural)
â”‚           â”œâ”€â”€ SpectralShaper.h/.cpp# Inharmonicity Stretch, Parity, Entropy/Roughness, Shift, RollOff
â”‚           â”œâ”€â”€ NmModelResinator.h/.cpp # Resinator extendido Float32 multicapa para .nmmodel v2.1
â”‚           â””â”€â”€ ExtendedBlender.h/.cpp  # Cruce hÃ­brido Resinator ClÃ¡sico (.sphere) <-> Extended (.nmmodel)
â”‚
â”œâ”€â”€ wasm/
â”‚   â”œâ”€â”€ CMakeLists.txt               # Build Emscripten que incluye ../DspSources.cmake (EXPORT HEAPF32)
â”‚   â””â”€â”€ AxionikWorkletBindings.cpp   # Wrapper C ABI para AudioWorkletProcessor
â”‚
â”œâ”€â”€ WebUI/
â”‚   â”œâ”€â”€ index.html
â”‚   â”œâ”€â”€ contracts/
â”‚   â”‚   â””â”€â”€ bridge-protocol.json     # Contrato versionado del puente WebView2
â”‚   â”œâ”€â”€ generated/                   # Emitido por Scripts/registry_generator.js
â”‚   â”‚   â”œâ”€â”€ parameterRegistry.js
â”‚   â”‚   â”œâ”€â”€ midiContract.js
â”‚   â”‚   â””â”€â”€ layoutMap.js
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ app.js                   # Orquestador de vistas (Modo ClÃ¡sico 33 pÃ¡ginas / Modo Moderno)
â”‚       â”œâ”€â”€ bridge/                  # Cliente bridgeCore + AudioWorklet fallback
â”‚       â”œâ”€â”€ panels/                  # R1, R2, Blender, Silver, Shapers/Mod, Setup/BankManager
â”‚       â””â”€â”€ styles/                  # Cascada basada en @abdsynths/shared/styles/tokens.css
â”‚
â””â”€â”€ Tests/
    â”œâ”€â”€ ParameterRegistryContractTest.cpp
    â”œâ”€â”€ SndDatAndTranslatorTest.cpp  # Verifica las 445 claves, 19 clamps y 351 presets en reposo/nota
    â”œâ”€â”€ GoldenOracleDspTest.cpp      # Compara salida DSP contra los 12 vectores Ã¡ureos de NeuronVS.dll
    â”œâ”€â”€ ZeroAllocAudioThreadTest.cpp # Audita 0 asignaciones en processBlock / noteOn / noteOff
    â”œâ”€â”€ BridgeProtocolContractTest.cpp
    â””â”€â”€ webviewBridgeDirectionTest.mjs
```

---

## 3. Contrato Ãšnico Autogenerado: 445 ParÃ¡metros + 26 VST + NRPN / CC / SysEx

### 3.1 El Generador CanÃ³nico (`Scripts/registry_generator.js`)
A partir de `schemas/preset_schema.csv` (445 filas), `schemas/vst_exposed_params.csv` (26 filas), `schemas/control_params.csv` (174 enlaces) y `schemas/page_ref_links.csv` (44 enlaces), el script generarÃ¡ sin intervenciÃ³n manual:
1. `Source/Generated/ParameterRegistry.gen.h`
2. `Source/Generated/MidiContract.gen.h`
3. `Source/Generated/BridgeContract.gen.h`
4. `WebUI/generated/parameterRegistry.js` y `WebUI/generated/layoutMap.js`

### 3.2 Estrategia de los 445 ParÃ¡metros (`snddat`) y los 26 ParÃ¡metros VST
- **Registro Interno Completo (445 parÃ¡metros, Ã­ndices `0..444`)**:
  - Cada uno de los 445 parÃ¡metros de `sound.script` existe en `SndDatStore` con su estructura exacta de `40 B`, respetando el `step = 1.0`, la cuantizaciÃ³n `FUN_10001170` y el clamp inicial de los **19 parÃ¡metros con `default = 0 < min = 1`**.
  - Al cambiar `R1ModellIndex` (`[22]`) o `R2ModellIndex` (`[102]`), el callback equivalente a `0x10013620` actualiza en vivo las etiquetas de eje (`mnAN`, 8 chars) y los defaults (`fdAN`) de los 12 parÃ¡metros Scape/Sphere de la capa correspondiente y los publica al WebUI mediante el mensaje `modelsState` del bridge.
- **ExposiciÃ³n al Host DAW (VST3 / Standalone APVTS)**:
  - **Los 26 parÃ¡metros de automatizaciÃ³n primaria** (los 12 pares Sphere/Scape de `R1L1..L3` y `R2L1..L3` + `FilterFreq` `[274]` + `FilterReso` `[275]`) mantienen en primer orden la tabla de mapeo y normalizaciÃ³n `0.0..1.0` idÃ©ntica a `NeuronVS_vst2` (`vtable+0x74`/`0x78`), garantizando importaciÃ³n directa de bancos `.fxp` (`FxCk` de 26 floats y `FPCh` de `sound.script`).
  - **ExposiciÃ³n completa APVTS**: Los 445 parÃ¡metros estÃ¡n registrados en el `AudioProcessorValueTreeState` con IDs canÃ³nicos (` SoundNameC00`..`SlicerSwitchBackup`), permitiendo sincronizaciÃ³n diferencial completa con `WebView2`, persistencia en `getStateInformation` y automatizaciÃ³n moderna en hosts VST3.

### 3.3 Contrato MIDI Completo: CC, NRPN de 14 bits y SysEx (`ABDShared::HardwareDrivers`)
1. **MIDI CC Nativo + Ampliado**:
   - **Controles de ejecuciÃ³n nativos (`params+0x44`)**: `CC 1` (Mod Wheel), `CC 2` (Breath), `CC 3`, `CC 4` (Foot), `CC 11` (Expression) y `Channel Pressure` alimentan directamente los 6 slots de ejecuciÃ³n en tiempo real como en `0x1000ca20`.
   - **SelecciÃ³n de Banco y Programa**: `CC 32` (Bank Select LSB `0..9`) + `Program Change` (`0..99`) seleccionan cualquiera de los **1.000 slots de preset** (`bank * 100 + program`).
   - **Controles Stick XY por CC (estÃ¡ndar comunidad NeuronVS + `MidiLearner`)**:
     - Por defecto se preconfiguran los pares CC documentados en `NeuronVS_vst2` para controlar los Sticks desde superficie externa: `CC 16/17` (`R1` Sphere/Scape XY), `CC 35/36` (`R2` Sphere/Scape XY) y `CC 52/53` (`Silver` XY), ademÃ¡s de `CC 74` (`FilterFreq`) y `CC 71` (`FilterReso`).
     - Toda la tabla es editable mediante MIDI Learn (`MidiCcController` del bridge) y se persiste en el estado del plugin.
2. **NRPN Sin PÃ©rdida de ResoluciÃ³n (445 ParÃ¡metros)**:
   - Utilizando `abd::hw::NRPNParser` de `ABDShared::HardwareDrivers`, cada parÃ¡metro de `sound.script` (`index 0..444`) es direccionable directamente vÃ­a **NRPN**:
     - `NRPN MSB (CC 99) = (paramIndex >> 7) & 0x7F` (`0..3`)
     - `NRPN LSB (CC 98) = paramIndex & 0x7F` (`0..127`)
     - `Data Entry MSB (CC 6)` + `LSB (CC 38)` transportan un entero de 14 bits (`0..16383`) que se mapea de forma exacta y biyectiva al rango entero `[min..max]` del descriptor (`rango mÃ¡ximo en NeuronVS: -200..+600`), eliminando la pÃ©rdida de cuantizaciÃ³n de los CCs de 7 bits.
3. **SysEx (bd::hw::SysExCodec y Especificación Canónica Hartmann)**:
   - Documentación y análisis exhaustivo en [DOCS/reverse_engineering/SYSEX.md](DOCS/reverse_engineering/SYSEX.md).
   - **Cabecera Oficial Hartmann GmbH:** F0 00 20 50 01 [DeviceID] [Opcode] ... F7 (confirmada en los 1.626 mensajes del firmware oficial 
neuron_1_5_0.mid).
   - Empaquetado 7-bit (SysExCodec::pack8to7 / unpack7to8) para:
     - **Single Parameter Change SysEx**: cambio atómico de cualquiera de los 445 parámetros.
     - **Sound Patch Dump (sound.script + sound.stickrec)**: volcado y recepción completa de presets hacia/desde hardware y herramientas como SoundDiver / MidiQuest.
     - **Model Header / Zone Map Inquiry**: sincronización con ABDBankManager y ABDNeuModMakr.

### 3.4 Capa de AbstracciÃ³n Estricta entre ParÃ¡metros (`State`) y Motor (`DSP`)
Siguiendo el patrÃ³n arquitectÃ³nico de `ABDNeural` (`DspTypes.h` + `DspEngineFacade.h`) y `ABDMS2000` (`Conversion.gen.h` + `VoiceParameters`), establecemos una **frontera de datos planos sin JUCE** entre la gestiÃ³n de parÃ¡metros y el motor DSP:
1. **Capa de Estado y ConversiÃ³n (`Source/State/`)**:
   - `APVTS` + `SndDatStore` (445 registros) + `Conversion.gen.h` (autogenerado por `Scripts/registry_generator.js`: `normalizedToDomain` / `domainToNormalized`).
   - Convierte los valores crudos/normalizados y las modulaciones de los 6 controles de ejecuciÃ³n en un **snapshot plano e inmutable por bloque (`AxionikDspParams`)** definido en `Source/DSP/DspTypes.h` (100 % libre de JUCE, con layout ABI fijo compartido con WASM).
2. **Frontera `DspEngineFacade` (`Source/DSP/Runtime/DspEngineFacade.h`)**:
   - El hilo de audio nunca consulta `APVTS`, ni strings de IDs, ni `snddat`. Solo consume el snapshot pendiente `AxionikDspParams` (entregado vÃ­a `setGlobalParams` / `setExecutionParams` con handoff lock-free RT-safe), lo pasa por el traductor `Translator::translate` (`FUN_10040550`) cuando hay cambios y renderiza el bloque.

---

## 4. TraducciÃ³n de las 87 Funciones DSP (`NeuronVS_dsp`) a C++20 Puro sin JUCE

### 4.1 ReutilizaciÃ³n Directa de `NeuronVS_port` (Base Ya Verificada)
Incorporaremos y adaptaremos al namespace `Axionik::DSP::Classic` el trabajo ya validado en `C:/Users/ajaba/Downloads/neuron/NeuronVS_port`:
- **`ParameterTable` (`params.hpp`)**: Los 445 descriptores y la regla exacta `FUN_10001170`.
- **`SoundPreset` (`preset.hpp`)**: Parser/serializador 1:1 de `sound.script` (incluyendo la migraciÃ³n de `SlicerSwitchBackup` para los presets `011`, `012` y `023`, y la migraciÃ³n `BlenderAmount -= 64` para versiÃ³n 1 de `FUN_10013ea0`).
- **`Scape`, `Sphere`, `CurveReader` (`FUN_100317b0`) y `BandReader` (`FUN_10031950`) (`neurondb.hpp`)**: Carga de chunks RIFF-like (`csAN`, `psAN`, `mnAN`, `fdAN`), lectura de curva `int16` en `+0x104` con Ã©nfasis diferencial y lectura interpolada de las 25 bandas Ã— 4 slots.
- **`translate` (`FUN_10040550`) y `FUN_100373a0` (`translator.hpp` / `translator.cpp`)**: Volcado de los 456 writes sobre `engine[0x000..0x36A]` y validaciÃ³n de las tablas de zonas de teclado.
- **`loadKeyZones` (`FUN_100440d0`)**: ConstrucciÃ³n de las `128 Ã— 40 B` entradas por tecla en `engine+0xDB0` (`R1`) y `engine+0x2200` (`R2`).

### 4.2 Desglose de TraducciÃ³n de las 87 Funciones del Camino de Audio
Las 87 funciones alcanzables desde `FUN_100382b0` (sin ninguna llamada indirecta) se agrupan en **7 mÃ³dulos C++20 deterministas** apoyados en `ABDShared::DspCore` (`namespace abd::dsp`) y `schemas/constants_types.csv` (que corrige las 306 constantes `f64 -> f32` respecto a Ghidra):

| MÃ³dulo en `Source/DSP/ClassicNeuron/` | Funciones Principales del Binario (`0x10021C90..0x100478D0`) | Responsabilidad TÃ©cnica |
|---|---|---|
| **`BlockOrchestrator`** | `0x1000bc40` (adaptador 128 muestras), `FUN_100382b0` (orquestador de bloque, `8.320 B`), `FUN_100343e4` (sub-objeto `e[0xD95]`) | Bucle maestro por bloque interno de 128 muestras, acarreo de resto de frames (`+0x3A4`), despacho de eventos de voz, suma polifÃ³nica y etapa de salida (con flag `OracleClipToZeroMode`). |
| **`VoiceDispatcher & ZoneMapper`** | `FUN_1003d800` (`noteOn`), `FUN_1003dda0` (`noteOff`), `FUN_1003c350` (cierre de voz), `FUN_100440d0` (zonas), `FUN_100373a0` (validador) | GestiÃ³n de los 129 descriptores `'nSAN'` (`0x70 B`), lÃ­mite de polifonÃ­a (`SoundNumVoices` `4..12`, mÃ¡x 32), copia de los bloques espejo `0x588 B` (`+0x284` / `+0x80C`) a `motor+0x638C` y selecciÃ³n `LowSource`/`HiSource` por umbral `params+0x418`. |
| **`ResinatorVoice` (Curves & Bands)** | `FUN_10032970` (init motor `0x6838 B`), `FUN_10032d10` (bind `.scape`/`.sphere`), `FUN_100317b0` (`CurveReader`), `FUN_10031950` (`BandReader`), `FUN_10032940`, `FUN_10031cd0` | Avance de fase de excitaciÃ³n `.scape` (`100` muestras/ciclo, bucle `loopStart..loopEnd`, Ã©nfasis de 2 puntos) e interpolaciÃ³n de frames de las 25 bandas formÃ¡nticas de `.sphere` (`1024`/`512` muestras por frame). |
| **`SphereDecoder` (Banco Aditivo/Espectral)** | `FUN_1002e750`, `FUN_1002e7a0` (`3.816 B`), `FUN_10029e34` (`4.294 B`), `FUN_1003b9f0` (`4.185 B`), `FUN_1003bd10` (`3.149 B`), `FUN_1003c980` (`4.539 B`), `FUN_10034290` (`2.126 B`) | DecodificaciÃ³n del bloque de `6.152 B` (1.024 parciales) de cada `SphereFrame`, deformaciÃ³n en tiempo real mediante los ejes `mnAN`/`fdAN` (Niveles 1, 2 y 3 de Sphere/Scape) y sÃ­ntesis del nÃºcleo resonador. |
| **`BlenderStage`** | Sub-rutinas de mezcla dual dentro de `FUN_100382b0` y `FUN_10035bd0` (`1.608 B`) | FusiÃ³n entre `Resinator 1` y `Resinator 2` segÃºn `BlenderType`, `BlenderAmount` y modulaciÃ³n por la envolvente dedicada de Blender. |
| **`SilverStage` (Filtros + FreqFX + TimeFX)** | `FUN_10025a30` (`2.495 B`), `FUN_100263f0` (`2.099 B`), `FUN_100277b0` (`2.264 B`), `FUN_10022ab0` (`1.347 B`), `FUN_10023250` (`1.127 B`), `FUN_10024600` (`1.279 B`), `FUN_100283c0` (`1.396 B`) | Los 3 filtros multifrecuencia en paralelo/serie (`24dB LP`, `12dB LP`, `6dB LP`, `BP`, `HP`, `Bandreject`) + bloque `FreqFX` (RingMod / Decimator / Sp-Warp / Comb / Phaser / Chorus / Flanger) + bloque `TimeFX` (Stereo Delay / Reverb / Dist) + EQ de 4 bandas, gobernados por el Stick de Silver. |
| **`ModulationStage & StickPlayback`** | `FUN_1003a280` (`1.832 B`), `FUN_100368d0` (`1.653 B`), `FUN_1003f4d0` (`1.167 B`), `FUN_1003fc20` (`1.454 B`), `FUN_10046cf0` (`1.358 B`) | LFO polivalente (10 formas de onda, sync MIDI), los 4 generadores de envolvente **4L4T Shaper** (`R1`, `R2`, `Blender`, `Silver` con modos Normal/Repeat/Longest y Free/Fixed), Slicer/Gate (`3D/2D`, Switch, Warp) y reproducciÃ³n de trayectorias `sound.stickrec`. |

### 4.3 EliminaciÃ³n de Asignaciones DinÃ¡micas en `noteOn` (`VoiceMemoryPool`)
- **Hallazgo crÃ­tico en el binario original**: `FUN_1003d800` (`noteOn`) y `FUN_10032970` ejecutan hasta 16 llamadas a `operator_new(0x2020)` (`8.224 B` cada una, ~`131 KB` por nota) en pleno hilo de audio cuando una voz arranca por primera vez, y `FUN_1003c350` las libera con `operator_delete`.
- **SoluciÃ³n RT-Safe en `ABDAxionikVS`**:
  - DiseÃ±aremos `VoiceMemoryPool` dentro de `Source/DSP/Runtime/`: en `DspEngineFacade::prepare(sampleRate, maxBlockSize)` se preasignan de forma contigua todos los bloques de trabajo (`32 voces Ã— 2 motores Ã— 16 buffers de 0x2020 B â‰ˆ 8.2 MB` o el nÃºmero mÃ¡ximo de voces configurado).
  - Durante `processBlock` / `noteOn` / `noteOff`, `ResinatorVoice` toma sus buffers del pool mediante punteros fijos pre-enlazados (**cero llamadas a `new`/`malloc`/`free`/`delete`** en el hilo de audio, verificado por `Tests/ZeroAllocAudioThreadTest.cpp` y compatible 100 % con el heap estÃ¡tico de `AudioWorklet` en WASM).

### 4.4 Hitos de Paridad Ãurea y ReconstrucciÃ³n 1:1 en Fase A
- **ReconstrucciÃ³n 1:1 del Resynator Parset (`FUN_10031d30`)**:
  - EliminaciÃ³n de aproximaciones heurÃ­sticas en `NeuronOscillators.h`.
  - Port directo de primitivas nativas de `NeuronVS.dll`: `SchroederComb` (`FUN_10023fe0`), `BiquadCell2Pole` (`FUN_10032630`), tabla senoidal canÃ³nica de 8192 muestras (`0x1030bc30`) y tabla de ruido uniforme (`DAT_102355c0`).
  - Modo 0 (`FUN_10031e70`) con modulaciÃ³n de fase, dual IIR y doble peine Schroeder con dispersiÃ³n estocÃ¡stica.
- **CalibraciÃ³n Exacta de Silver Rack FX (`FUN_10029e34` / `FUN_100295d0`)**:
  - CorrecciÃ³n de la curva 5 de distorsiÃ³n: comprobado por Ghidra que corresponde a overdrive lineal sin recorte brusco (se eliminÃ³ el falso full-wave rectifier).
  - Pre-filtro pasa bajos de 1 polo ($d_{12} = 30 \cdot preFilt$, $d_{13} = 1/(1+d_{12})$) y escalado de ganancia nativo $\times 25.0 \cdot inGain \cdot outGain$.
  - NormalizaciÃ³n canÃ³nica de parÃ¡metros Silver Rack en `DspEngineFacade.cpp` sin multiplicadores artificiales.
  - CorrecciÃ³n de ratio de delay derecho a $d_R = d_L / 2$ per `FUN_100295d0`.
- **Resultado en `GoldenParityTest`**:
  - Salto de correlaciÃ³n acÃºstica en Preset 176 (*DangerDrone*) de 0.00 a **L: +0.558473, R: +0.314746** contra el orÃ¡culo Ã¡ureo Win32 de 2004 sin desbordamientos numÃ©ricos.

---

## 5. IntegraciÃ³n con el Ecosistema `ABDShared` (Consumir vs. Aportar)

### 5.1 Componentes que Consumiremos y Ampliaremos en `ABDShared` (Cero DuplicaciÃ³n)
1. **Desde `ABDSharedCode` (`CMake` `add_subdirectory(../ABDShared/Code ...)`)**:
   - **`ABDShared::DspCore` (`namespace abd::dsp`)**: `AudioBuffer`, `MidiBuffer`, `MidiMessage`, `SmoothedValue`, `ScopedNoDenormals`, `Random` (siempre con semilla determinista explÃ­cita `1234567`), `DspMath.h` (transcendentales deterministas para paridad WASM â†” nativo, sin `libm` divergente).
   - **`ABDShared::DspEffects` (`namespace abd::dsp`) â€” Todos los Efectos de `Silver` y `Master FX` viven en `ABDShared`**:
     - Siguiendo las normas estrictas de `ABDShared/Code/DspEffects` (como en `ABDMS2000`: `DspMS2000ChorusFlanger.h`, `CascadeShelfEq.h`, `profiles/MS2000EqProfile.h`, `FxRegistry.h` y `adapters/BasicAdapters.h`):
       - **El motor habla unidades fÃ­sicas (Hz, ms, dB, muestras)**, es header-only en C++20 puro libre de JUCE y sin mÃ©todos virtuales en el lazo de audio.
       - Los motores de efectos de `Silver` (**Filtro Multimodo 5 curvas**, **EQ 4 Bandas + Compresor**, **Distortion 6 curvas**, **Ring Modulator + Xover Delay**, **Sp-Warp**, **Decimator**, **Stereo Spread**, **L/R Delay**, **Flanger**, **Phaser**, **Chorus**) y de `Master FX` (**Stereo Delay con Damping** y **Master Reverb de 5 Salas**) se implementarÃ¡n en `D:\desarrollos\ABDSynths\ABDShared\Code\DspEffects\` (con sus perfiles en `DspEffects/profiles/NeuronSilverProfile.h` y sus adaptadores en `BasicAdapters.h` + `Contracts/fx-effects.json`).
       - En `ABDAxionikVS`, `SilverStage` y `MasterFxStage` serÃ¡n **shims ligeros de producto** (idÃ©nticos en filosofÃ­a a `ABDMS2000/Source/DSP/Effects/Equalizer.h` y `ModFX.h`) que traducen las unidades del Neuron al motor compartido.
       - Esto garantiza que todos los efectos del Neuron puedan usarse en otros proyectos actuales y futuros de `ABDSynths`, y que en la versiÃ³n expandida de `ABDAxionikVS` podamos montar cualquiera de los **+60 efectos** del catÃ¡logo `ABDShared::DspEffects`.
   - **`ABDShared::SynthCore` (`namespace abd::synth`) â€” Matriz AsÃ©ptica `ModMatrix.h`**:
      - `AudioThreadSnapshot`, `VoiceAllocator` y **`ModMatrixT<kNumSlots, kZeroIdInert>`** (`ModRoute`, `ModDestinationDescriptor`).
      - La matriz **`Free Controllers` (`[363..410]`, 6 fuentes Ã— 4 destinos = 24 rutas) + Macros de EjecuciÃ³n (`[413..424]`, 6 rutas)** se integrarÃ¡ sobre `ABDShared::SynthCore::ModMatrixT` y `ABDShared/Components/modMatrix.js` + `ABDShared/Contracts/abdaxionikvs_modulation_matrix.json`, manteniendo la regla de oro de `ABDShared`: **el motor y la vista son 100 % asÃ©pticos (Ã­ndices opacos sin vocabulario de producto)** y la tabla declarativa aporta los nombres, rangos y categorÃ­as.
    - **`ABDShared::HardwareDrivers` (`namespace abd::hw`)**: `SysExCodec` y `NRPNParser` para el motor MIDI/NRPN/SysEx.
    - **`ABDShared::WebView2Bridge`**: `JuceWebView2Component` y `WebView2ResourceProvider` para servir `WebUI/dist/` embebido y la sonda al servidor Vite en Debug.
    - **`ABDShared::AudioComparator`**: Motor de comparaciÃ³n acÃºstica A/B para las pruebas de certificaciÃ³n contra los WAV Ã¡ureos de `NeuronVS.dll`.
    - **`ABDShared::BankManagerCore` (`ABDBankManager`)**: GestiÃ³n de librerÃ­as, bancos y presets integrada en el plugin.
    - **`ABDShared::NeuronFormats` (`@abdsynths/shared/formats/neuron`)**: Codecs universales 1:1 para contenedores `.model` (`.scape`, `.sphere`, `map.script`, `MName`, `ModelNames`), `.sound` (`sound.script`, `sound.stickrec`, `SoundNames`), decodificador puro RIFF/WAVE y FORM/AIFF (`WavAiffDecoder.ts`) y empaquetador ZIP (`ZipArchive.ts`). Consumidos directamente en Fase A.1.
    - **`ABDShared::DspCore::NeuronAnalysis` (`@abdsynths/shared/dsp/neuron-analysis`)**: Motor de anÃ¡lisis espectral de alta resoluciÃ³n (Radix-2 FFT 8192 pts con 4-term Blackman-Harris, HPS con escala de octavas, ajuste de rejilla armÃ³nica LS, clustering multicapa de 1..3 capas y generador paramÃ©trico Scape/Sphere). Consumido en Fase B.
    - **`ABDShared::Visualizers` (`@abdsynths/shared/visualizers/SpectralCanvasVisualizer.js`)**: Visualizador grÃ¡fico Canvas 2D multimodo de alta fidelidad: espectrograma con estela temporal, barras de 64 parciales armÃ³nicos superpuestas a curva FFT en tiempo real y comparador diferencial de formas de onda A/B.
    - **`ABDShared::Scope` (`SpectrogramRenderer.js`)**: Renderizador cascada / waterfall enriquecido con superposiciÃ³n de trazas armÃ³nicas (`frame.partialTracks`), permitiendo monitorear las trayectorias de parciales simultÃ¡neamente con la densidad espectral global.
2. **Desde `ABDShared/Code/MidiKeyboard` (`@abdsynths/midi-keyb`) y `ABDSharedAssets` (`@abdsynths/shared`)**:
   - **Teclado Unificado (`D:\desarrollos\ABDSynths\ABDShared\Code\MidiKeyboard`)**: integrado directamente con los 6 controles de ejecuciÃ³n (`params+0x44`: `Aftertouch`, `ModWheel Up/Down`, `Breath CC2`, `CC3`, `Foot CC4`, `Expression CC11`), `PitchBend` (`engine+0xDA4`) y `FootSwitch` (`[411]`), alimentando en tiempo real la matriz `Free Controllers` (`[363..410]`). Registrado con altura 98px para hosts multicapa.
   - Tokens y cascada CSS (`@abdsynths/shared/styles/tokens.css`), fondo canÃ³nico neutral (`ABDShared/Assets/assets/backgrounds/bg_neutral.webp`), `SynthNavBar`, `AboutDialog`, `Knob`, `SilverFilmstripKnob`, `Slider`, `FilmstripFader`, `Segmented`, `Select`, `Toggle`, `Switch`, `XYPad`, `EnvelopePad`, `ModMatrix`, `SevenSegmentDisplay`, `VuMeter`, `SpectrumPlotter`, `LiveSysExInspector`.

### 5.2 Componentes Nuevos Desacoplados Aportados a `ABDShared`
Siguiendo la directriz de volcado transversal hacia `ABDShared`:
1. **IconografÃ­a CanÃ³nica Hartmann en `ABDShared/Assets/icons/`**:
   - 10 iconos SVG de los `Parameter Sets` (`param0.svg` .. `param9.svg`): Neutral, Strings, Woodwinds, Brass, Keyboards, Percussive, Complex Acoustic, Synthetic, Scapes, Extravaganza.
   - 4 iconos SVG de utilidad de ediciÃ³n y modelado: `undo.svg`, `redo.svg`, `repair.svg` y `palette.svg`.
2. **`TrajectoryStick2D` (`@abdsynths/shared/components/trajectoryStick2D.js` + CSS)**:
   - EvoluciÃ³n o extensiÃ³n limpia de `XYPad` que aÃ±ade:
     - **Anillo multipolar de nombres de eje dinÃ¡micos (`mnAN`)**: muestra hasta 4/6 etiquetas dinÃ¡micas en el perÃ­metro segÃºn el nivel activo (`Level 1, 2, 3`) e ilumina la distribuciÃ³n de pesos.
     - **GrabaciÃ³n y reproducciÃ³n de trayectorias vectoriales (`Stick Recording`)**: visualizaciÃ³n de la estela temporal en `<canvas>`/`<svg>`, estados `Idle / Armed / Recording / Playing / Loop`, y serializaciÃ³n agnÃ³stica de puntos `(tick, axis, value)`. Reutilizable en sintes vectoriales futuros (Korg Wavestation, Prophet VS, Yamaha SY22/TG33).
3. **`MultiStageShaperPad` (`@abdsynths/shared/components/multiStageShaperPad.js`)**:
   - ExtensiÃ³n de `EnvelopePad` para envolventes **4L4T (4 Levels / 4 Times)** con modos `Normal / Repeat / Longest` y pendiente `Free / Fixed`, reutilizable en sintetizadores digitales/FM/aditivos de la familia ABD (`ABDCZ101`, `ABDOmega`, etc.).
4. **`NeuronCodec` / Adaptador de Bancos `.sound` y `.model` para `ABDBankManager`**:
   - Adaptador en `ABDBankManager` apoyado en `@abdsynths/shared/formats/neuron` para inspeccionar, catalogar, importar y exportar carpetas `NeuronDB` (`Models/000..511.model`, `Sounds/000..999.sound`) y archivos empaquetados `.model`, `.sound` y `.nmmodel`.

---

## 6. Plan de ImplementaciÃ³n por Fases (`ROADMAP`)

### Fase 0 â€” Cimientos, Contratos Autogenerados y Esqueleto Dual (Nativo + WASM) [COMPLETADA]
- **Objetivos Cumplidos**:
  1. Registrado `ABDAxionikVS` en `D:\desarrollos\ABDSynths\pnpm-workspace.yaml`.
  2. Creado `schemas/` con `preset_schema.csv` (445 params), `vst_exposed_params.csv` (26 VST), `params_observers_map.csv` (335 obs y 63 mod dests), `constants_types.csv` (1.430 constantes), `control_params.csv`, `page_ref_links.csv` y `parameter_sets_mnan.json` (10 sets Scape/Sphere).
  3. Implementado `Scripts/registry_generator.js` con `--check`, emitiendo `ParameterRegistry.gen.h`, `Conversion.gen.h`, `MidiMapping.gen.h`, `parameters.gen.ts` y `bridge-protocol.json`.
  4. Configurados `DspSources.cmake` (anti-drift), `CMakeLists.txt` raÃ­z (JUCE 9 `Standalone` + `VST3` + `WebPilotHost` con `NEEDS_WEBVIEW2 TRUE` y `JUCE_VST3_CAN_REPLACE_VST2=0`) y `wasm/CMakeLists.txt` con `WasmBridge.cpp`.
  5. Implementado frontend WebUI inicial en `WebUI/` con **paridad visual y estÃ©tica idÃ©ntica a `ABDNeuModMakr`** (tokenizado 100% con `@abdsynths/shared/styles`, Navbar HUD con logo, presets, modelos, telemetrÃ­a CPU/voces, racks de sÃ­ntesis R1/R2 con sticks 2D circulares, Blender, Filter, Silver FX, Drawers deslizantes y `KeyboardStrip` interactivo con `@abdsynths/midi-keyb`).
  6. Empaquetado Vite verificado (`Scripts/build_webui.js` -> `WebUI/dist/`), suite de pruebas Vitest pasando 5/5 tests, y scripts `build.bat` y `start.bat`.
- **VerificaciÃ³n (DoD) Alcanzada**:
  - `build.bat nopause` compila sin errores los 3 targets nativos con MSVC:
    - `build\ABDAxionikVS_artefacts\Release\Standalone\ABDAxionikVS.exe`
    - `build\ABDAxionikVS_artefacts\Release\VST3\ABDAxionikVS.vst3`
    - `build\ABDAxionikVS_WebPilot_artefacts\Release\ABDAxionikVS WebPilot Host.exe`
  - Smoke test E2E ejecutado: `ABDAxionikVS WebPilot Host.exe --auto-quit` monta el WebView2 con `WebUI/dist/` y sale limpiamente con cÃ³digo 0.
  - Repositorio Git inicializado con remote `origin https://github.com/ajabadia/ABDAxionikVS.git` y commit inicial de Fase 0 creado.

### Fase A.1 â€” Estado de ParÃ¡metros (`snddat` / `params`), Traductor (`FUN_10040550`) y Carga de `NeuronDB` [COMPLETADA]
- **Objetivos Cumplidos**:
  1. Integrados en `Source/State/` y `Source/Dsp/` la tabla de 445 parÃ¡metros (`SndDatStore`), la regla `FUN_10001170` (con los 19 defaults ajustados a `1.0`), los 335 observadores de `params` y el cÃ¡lculo continuo de los 340 valores efectivos (`ParameterEngineBridge`).
  2. Integrado `Translator.cpp` (`FUN_10040550` + `FUN_100373a0` + `FUN_100343e4` en `TranslatorHooks.cpp` para `e[0xD95]`).
  3. Implementado `NeuronBankAdapter` y `ZoneMapper` (`FUN_100440d0`): lectura de `Models/000..511.model` (`MName`, `map.script`, `.scape`, `.sphere`), carga de zonas y relleno de las `128 Ã— 40 B` entradas por tecla en `engine+0xDB0` (`R1`) y `engine+0x2200` (`R2`).
  4. Lector de bancos y presets con compatibilidad para paquetes `.model` y `.sound` de NeuronDB / ABDNeuModMakr.

### Fase A.2 â€” Motor de Voz ClÃ¡sico: `Resinator 1`, `Resinator 2`, `.scape`, `.sphere` y `Blender` [COMPLETADA]
- **Objetivos Cumplidos**:
  1. `NeuronVoicePool` y `NeuronVoice`: ciclo de vida de voz polifÃ³nica con robo determinista de voz mÃ¡s antigua (`FUN_100403b0`), soporte de 12 voces simultÃ¡neas y asignaciÃ³n preasignada RT-safe.
  2. SÃ­ntesis multicapa en `NeuronOscillators.h`: `ResynatorLayer` acoplando `CurveReader` (Scape, `FUN_100317b0`) y `BandReader` (Sphere, `FUN_10031950`) con coordenadas dinÃ¡micas 2D, nivel y desafinaciÃ³n analÃ³gica.
  3. `CResynator` (`0x6838` bytes, `FUN_1002e7a0`): orquesta las 3 capas canÃ³nicas (`L1`, `L2`, `L3`) para `R1` y `R2` y despacha los **7 algoritmos de sÃ­ntesis Parset** (`FUN_10031d30`):
     - Parset 0: Mezcla aditiva ponderada y formantes (`CParsetEngine0` / `FUN_10025380`).
     - Parset 1: ModulaciÃ³n cruzada de fase FM (`CParsetEngine1` / `FUN_10023990`).
     - Parset 2: InclinaciÃ³n espectral armÃ³nica *Harmonic Tilt* (`CParsetEngine2` / `FUN_10032660`).
     - Parset 3: Desplazamiento de picos resonantes (`CParsetEngine3` / `FUN_10023df0`).
     - Parset 4: SaturaciÃ³n no-lineal multibanda (`CParsetEngine4` / `FUN_10032260`).
     - Parset 5: ModulaciÃ³n en anillo *Double Sideband* (`CParsetEngine5` / `FUN_10024530`).
     - Parset 6: DispersiÃ³n espacial y entrelazado espectral (`CParsetEngine6` / `FUN_10031e70`).
  4. `BlenderStage`: crossfade lineal canÃ³nico continuo entre `R1` y `R2` gobernado por `BlenderAmount` (`[262]`).

### Fase A.3 â€” Etapa `Silver`, Efectos Maestros y Orquestador de Bloques [COMPLETADA]
- **Objetivos Cumplidos**:
  1. [COMPLETADO] Etapa `Silver` en `DspNeuronSilverRack.h` (`CSilverRack::Process`, `FUN_10029e34`):
     - `DspNeuronSilverFilter` (`FUN_10021c90`): filtro multimodo (5 curvas: 24dB/12dB/6dB LP, BP, HP) con tablas LUT de 8192 entradas y limpieza anti-pops Mac 1.56.
     - `DspNeuronSilverFreqFX`: los 5 algoritmos canÃ³nicos de modulaciÃ³n en frecuencia (`0: EQ 4-Bandas + Compresor` `FUN_1002d3d4`/`FUN_1003785c`, `1: Distortion` 6 curvas, `2: RingMod` con Xover Delay, `3: Decimator`, `4: Sp-Warp`).
     - `DspNeuronSilverTimeFX`: los 5 algoritmos canÃ³nicos de modulaciÃ³n temporal (`0: Stereo Spread`, `1: L/R Delay`, `2: Flanger`, `3: Phaser`, `4: Chorus`) con la correcciÃ³n `Reset()` de Stephan Bernsee (Mac 1.56).
  2. [COMPLETADO] Efectos maestros en `DspNeuronMasterFX.h`:
     - `DspNeuronGlobalSlicer` (`FUN_100295d0` Vertical 2D y Spatial 3D).
     - `DspNeuronMasterModFX` (apertura estÃ©reo M/S) y `DspNeuronMasterTimeFX` (`Stereo Delay [431..436]` + `Master Reverb [437..444]` de 5 salas hÃ­brida `ABDEep` `SchroederReverb` + `DspFdnReverb` 8x8 Householder).
     - `DspNeuronMasterOutputStage` (`FUN_100382b0` L1720-1775 + saturador soft-knee `FUN_1003b930`).
  3. [COMPLETADO] `NeuronBlockPump.h` (`0x1000bc40` / `FUN_100382b0`): bombeo de bloques de 128 muestras con limitaciÃ³n musical limpia por defecto (`[-1.0, +1.0]`) y conmutador `OracleClipToZeroMode`.
  4. [COMPLETADO] CorrecciÃ³n de offset de cuerpo espectral `SphereBodyTable` (`frameOffset + frameStride - 6152`, `FUN_1002e750`), normalizaciÃ³n dinÃ¡mica de `.scape` (`16-bit` completos y one-shots), compensaciÃ³n `RootKey`/`Detune` por zona (`zonePitchFactor_`, `FUN_10032970`), `R1Switch [23]`/`R2Switch [103]`, `ModelVelocitySwitch [41/121]`, `SoundNumVoices [5]`, `SoundPan [3]`/`SoundPanKeyTrack [4]` y `LFO Global [256..260]`.
  5. [COMPLETADO] CertificaciÃ³n offline de paridad sonora, zonas (`--zones` 128/128) y matriz (`--matrix` 63/63) con `GoldenParityTest`, y biblioteca unificada de **398 presets** (`NeuronVS` + `Hardware Soundset V4`).

### Fase A.4 â€” Interfaz `WebUI` Adaptada y Mejorada (100 % de los 445 ParÃ¡metros) y Volcado a `ABDShared` [COMPLETADA EXCEPTO BUILD WASM]
> **Referencia de diseÃ±o obligatoria:** [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md)
> No replicaremos el aspecto estÃ¡tico ni el laberinto de 33 sub-pÃ¡ginas de 2004 del `NeuronVS` original. En su lugar, adaptaremos y mejoraremos todos sus controles, pantallas, selectores y opciones dentro del sistema de diseÃ±o de `ABDSynths` (`@abdsynths/shared`), exponiendo por primera vez los **445 parÃ¡metros completos** (incluyendo el rack `Master FX` `[430..444]`, la matriz `Free Controllers` `[363..410]`, `ModelVelocitySwitch` y las 24 profundidades `ResEnv` que el plugin de 2004 ocultaba o fragmentaba).

- **Objetivos**:
  1. Desarrollar y aportar a `ABDSharedAssets` los componentes genÃ©ricos **`TrajectoryStick2D`** (con anillo multipolar de etiquetas dinÃ¡micas `mnAN` de los 10 `Parameter Sets` y grabaciÃ³n/reproducciÃ³n de trayectorias `sound.stickrec`) y **`MultiStageShaperPad`** (envolvente grÃ¡fica bipolar `4L4T`), con sus tests Vitest.
  2. Construir la `WebUI` de `ABDAxionikVS` empaquetada con Vite (`WebUI/dist/`):
     - **Cabecera Global Siempre Visible**: `SynthNavBar`, selector de bancos/presets integrado con `ABDBankManager`, nombre editable de 16 caracteres (`SoundNameC00..C15`), polifonÃ­a (`SoundNumVoices` `1..32` + voces activas), `SoundPan` / `SoundPanKeyTrack`, `PitchBendRange`, 4 Macro Knobs (`Knob1..4R1Select`), botÃ³n conmutador `<NUKE>` (abre el drawer/modal del controlador remoto NUKE), conmutador `OracleClipToZeroMode`, VU meter y osciloscopio `ABDShared::Scope` con visualizaciÃ³n waterfall y trazas armÃ³nicas (`frame.partialTracks`).
     - **Cubierta Principal de SÃ­ntesis (`Resynator 1` + `Blender & Slicer` + `Resynator 2`)**:
       - En cada Resynator: selector de modelo `000..511` con buscador, display `MName` (11 chars), badge del `Parameter Set` (`0..9`), visor del mapa de teclado de 128 notas (`LowSource`/`HiSource` + `ModelVelocitySwitch`), afinaciÃ³n (`Octave`, `Semi`, `Cents`, `PitchKeyTrack`, `PitchLfoDepth`, `FreeADSR1/2`, `4L4T`), tamaÃ±o (`ModelSizeOffset`, `ModelSizeKeyTrack`), `TrajectoryStick2D`, conmutadores rÃ¡pidos `Sphere / Scape` y `Level 1 / 2 / 3`, y las dos columnas de modulaciÃ³n de eje (`Eje 1/3` y `Eje 2/4`: `KeyTrack`, `LfoDepth`, `VelocityDepth`, `ResEnvDepth`, `Contour` y `StickPlayback`) visibles simultÃ¡neamente sin el conmutador ciego `SelectStickPar`.
       - En el centro: **Blender** con los 10 algoritmos de fusiÃ³n (`Mix`, `Chromophonic`, `Transsphere`, `Crossmorph`, `Intermorph`, `Dyn Transsphere`, `Dyn Crossmorph`, `Velo Crossmorph`, `Velo Chrome`, `Ring Blend`), fader bipolar `-64..+63` y sus 4 moduladores + **Slicer** (`Off`, `Vertical`, `3D`, `Rate`, `Depth`, 12 formas de onda).
     - **Rack Inferior sin Sub-Laberintos (3 PestaÃ±as Amplias y Paneles Modulares)**:
       - **PestaÃ±a 1 â€” `SHAPERS & LFO`**:
         - `ShapersPanel.ts`: 3 tarjetas homogÃ©neas (`SHAPER 1`, `SHAPER 2`, `SHAPER 3`) con ruedas de modulaciÃ³n (`Wheel`) y tiras LED verticales (`LedLadder`) de `ABDShared`:
           - `Shaper 1`: Amp ADSR (`[200..203]`), ResEnv ADSR (`[204..207]`) y Free ADSR 1 (`[216..219]`).
           - `Shaper 2`: Amp ADSR (`[230..233]`), ResEnv ADSR (`[234..237]`) y Free ADSR 2 (`[246..249]`).
           - `Shaper 3`: Filt/EFX ADSR (`[355..358]`), Free ADSR 3 (`[355..358]`) y selector de estado `Shaper3Status [362]`.
         - Envolvente grÃ¡fica combinada **`4L4T`** (`MultiStageShaperPad`) y **LFO Global** (12 formas de onda, `Rate 0..20 Hz`, `Delay` bipolar Fade-Out / Fade-In).
       - **PestaÃ±a 2 â€” `SILVER & MASTER FX`**:
         - `SilverPanel.ts`: Tarjeta dedicada con diseÃ±o armÃ³nico idÃ©ntico a las tarjetas Scape/Sphere.
         - `EffectsDrawer.ts` Modernizado al 100 % con **Rotary Knobs** (`Knob` de `@abdsynths/shared/components/knob.js`):
           - **L1: Multimode Filter & ADSR ([273..278, 355..361])**: Estructurado en 2 filas independientes:
             - *Fila 1 (Filtro)*: 6 rotary knobs centrados (`CUTOFF [274]`, `RESO [275]`, `ENV DEPTH [360]`, `LFO DEPTH [276]`, `KEYTRACK [277]`, `VEL DEPTH [278]`).
             - *Fila 2 (Envolvente de Filtro ADSR)*: 4 rotary knobs dedicados (`FILT A [355]`, `FILT D [356]`, `FILT S [357]`, `FILT R [358]`).
           - **L2: Frequency FX ([281..326])**: BotÃ³n conmutable `Active / Bypass` en cabecera y conversiÃ³n de todos sus algoritmos a knobs:
             - *0: 4-Band EQ + Comp*: 4 tarjetas con botones `Active / Bypass` individuales por banda (`LOW SHELF`, `BAND 1`, `BAND 2`, `HIGH SHELF`) con knobs de `GAIN` y `FREQ`, mÃ¡s secciÃ³n inferior con botÃ³n `Active` de compresor y 3 knobs (`THRESH`, `OUT GAIN`, `RESPONSIVENESS`).
             - *1: Distortion*: 4 knobs (`IN GAIN [306]`, `PRE-FILTER [307]`, `CURVE [308]`, `OUT GAIN [309]`).
             - *2: Ring Modulator*: 6 knobs (`MIX [310]`, `MOD FREQ [314]`, `LFO SPEED [311]`, `LFO DEPTH [312]`, `XOVER DELAY [315]`, `XOVER FDBK [317]`).
             - *3: Decimator*: 3 knobs (`MIX [324]`, `S&H FACTOR [325]`, `PRE-FILTER [326]`).
             - *4: Spectral Warp*: 6 knobs (`MIX [318]`, `FREQUENCY [319]`, `TILT [320]`, `DAMPING [321]`, `LFO SPEED [322]`, `LFO DEPTH [323]`).
           - **L3: Time & Modulation FX ([327..354])**: BotÃ³n `Active / Bypass` en cabecera y conversiÃ³n completa de sus 5 algoritmos a knobs:
             - *0: Stereo Spread*: 2 knobs (`DELAY [331]`, `FEEDBACK [332]`).
             - *1: L/R Delay*: 3 knobs (`MIX [333]`, `DELAY TIME [334]`, `FEEDBACK [335]`).
             - *2: Flanger*: 6 knobs (`MIX [336]`, `DEPTH [337]`, `SPEED [338]`, `WAVEFORM [339]`, `FEEDBACK [340]`, `STEREO PHASE [341]`).
             - *3: Phaser*: 6 knobs (`MIX [342]`, `DEPTH [343]`, `SPEED [344]`, `WAVEFORM [345]`, `FEEDBACK [346]`, `STEREO PHASE [347]`).
             - *4: Chorus*: 7 knobs (`MIX [348]`, `DEPTH [349]`, `SPEED [350]`, `WAVEFORM [351]`, `FEEDBACK [352]`, `STEREO PHASE [353]`, `PRE-DELAY [354]`).
           - **Bloque 2 â€” Master Spatial FX & Dynamics ([430..444])**: Botones `Active / Bypass` y knobs para `Stereo Delay [431..436]` (5 knobs) y `Master Reverb [437..444]` (selector de sala y 6 knobs).
       - **PestaÃ±a 3 â€” `MOD MATRIX & ZONES`**: Matriz completa de `Free Controllers` (`6 fuentes Ã— 4 destinos`, `[363..410]`), los 6 controles MIDI de ejecuciÃ³n en vivo (`Aftertouch`, `CC 1`, `CC 2`, `CC 3`, `CC 4`, `CC 11` `[413..424]`), `FootSwitchDest` (`[411]`), MIDI Learn y visor detallado de las 128 zonas de teclado (`map.script`) de `R1` y `R2`.
     - **Paneles de InterpretaciÃ³n y Salida Desacoplados y Unificados (Fila Inferior sobre el Teclado)**:
       - ReorganizaciÃ³n arquitectÃ³nica del canvas en 3 filas fluidas y desacopladas:
         1. *Fila Superior (Resonadores)*: `R1` (`Scape 1` + `Sphere 1`) y `R2` (`Scape 2` + `Sphere 2`), simÃ©tricos y sin scrollbars anidados.
         2. *Fila Central*: Rack de procesado (`Blender`, `Slicer`, `Filter`) y mÃ³dulo fÃ­sico de `Shapers` (1, 2 y 3).
         3. *Fila Inferior (justo encima del teclado)*: Fila dedicada y armÃ³nica con `ControllersPanel` (izquierda), `SilverPanel` (centro) y `MasterOutputPanel` (derecha).
       - **UnificaciÃ³n EstÃ©tica y FilosofÃ­a DRY**:
         - Cabeceras estandarizadas en todas las tarjetas con `.panel-header` y `.stick-label` (mismo color cyan, tipografÃ­a bold y espaciados), eliminando badges LED y estilos dispersos.
         - EliminaciÃ³n del marco/caja contenedora redundante en los joysticks (`borderless` en `TrajectoryStick2D` tanto en Control 1 como en Silver), alineÃ¡ndolos exactamente con los joysticks superiores de Scape y Sphere.
         - SincronizaciÃ³n de alturas en `bottom-controllers-row` mediante grid con `align-items: stretch` y tokens compartidos de `ABDShared`.
         - ResoluciÃ³n definitiva del conflicto de scrollbars verticales (Â«scrolls van a la suyaÂ»): eliminaciÃ³n de `overflow-y: auto` de `.resynator-column` y unificaciÃ³n en un Ãºnico scroll suave y coherente en `.workspace-canvas`.
     - **Vista / Drawer Colapsable Â«NUKE Remote ControllerÂ» (Emulador de la Superficie de Control Hardware)**:
       - Acceso inmediato vÃ­a botÃ³n `<NUKE>` en la cabecera global o atajo de teclado:
         - **3D Illuminated Stick**: EmulaciÃ³n tÃ¡ctil/ratÃ³n del joystick central del Hartmann NUKE con anillo de retroiluminaciÃ³n LED dinÃ¡mica y selector de destino rÃ¡pido (`Resynator 1`, `Resynator 2`, `Silver`, `Master FX`).
         - **4 Macro Encoders Continuos** (`Knob1..4R1Select` `[425..428]`): Cuatro diales giratorios con displays alfanumÃ©ricos contextuales asignables a cualquier parÃ¡metro o macro.
         - **Consola de Transporte de Stick**: Botones de hardware `REC`, `PLAY`, `LOOP`, `STOP` para la grabaciÃ³n/reproducciÃ³n directa de vectores de trayectoria (`sound.stickrec`).
         - **Selectores de Nivel y Superficie**: Botones fÃ­sicos `Level 1 / 2 / 3`, `Sphere / Scape` y `Freeze`.
     - **Pie de PÃ¡gina y Controles de InterpretaciÃ³n**:
       - Teclado MIDI compartido (`@abdsynths/midi-keyb`) con botÃ³n nativo de colapso/descolapso vertical (`enableCollapse: true`) para maximizar el espacio de la cubierta de sÃ­ntesis, y barra de transporte/grabaciÃ³n global de `StickRec`.
       - **Bloque de InterpretaciÃ³n Izquierdo (Conmutable Ruedas vs. Control 1 Stick)**:
         - Selector de modo entre ruedas estÃ¡ndar (`Pitch Bend` + `Modulation Wheel`) y el **Control 1 / Performance Stick** del sintetizador hardware original Hartmann Neuron (joystick 2D analÃ³gico: Eje X = Pitch Bend bipolar `[-48..+48]`, Eje Y+ hacia arriba = `ModWheel` CC 1 / `ModWheelDepth` `[414]`, Eje Y- hacia abajo = `Breath` CC 2 / `BreathDepth` `[416]`).
  3. Conectar `ParameterBridge` (telemetrÃ­a espectral/envolventes/sticks a ~15-30 Hz con diffing, carga de modelos y presets, aprendizaje MIDI CC) y validar el selftest E2E en Standalone y Bancada WebView2.
  4. **CorrecciÃ³n de Paridad DSP en `DspEngineFacade.cpp` (`setEQParams`)**: Corregida la inversiÃ³n preexistente de argumentos de frecuencia y ganancia en las 4 bandas del ecualizador paramÃ©trico, garantizando la respuesta de frecuencia exacta del hardware/plugin original.
   5. **Verificación M6 / V10 de la Modulation Matrix (351 Presets Bit a Bit)**:
      - Comparación completa del desenganche y valores efectivos `p[]` entre el port y el DLL original.
      - Identificado y corregido el desajuste en el preset 176 (destino 58, control 1 prof 0.920635) mediante la alimentación previa de los valores de control de `params+0x44` al port.
      - **351/351 presets en verde**, 6.237 comprobaciones de arnés, 21.411 slots bit a bit (61/63 por preset × 351).
      - Verificador `verify_matrix.py` actualizado a `V10` (15/15 comprobaciones superadas).
   6. **Ciclo de Vida y Parametrización de los Tres Objetos del Cierre en `engine+0x3650/0x3654/0x3658`**:
      - Creados en el constructor `FUN_10044884` sobre `operator_new(0x367C)` y destruidos por `FUN_100461c4`:
        - `+0x3650` (`e[0xD94]`): Coro / Slicer (352.936 B) parametrizado por `FUN_10040550` desde los slots 226..229 (`p[0xE2..0xE5]`).
        - `+0x3654` (`e[0xD95]`): Delay largo / CSilverRack (541.640 B) parametrizado por `FUN_100343e4(this, p)` con 64 campos (`st+0x0C..st+0x110`, 54 literales de `p[249..316]` + 10 calculados).
        - `+0x3658` (`e[0xD96]`): Reloj del banco aditivo (120 B) con avance de 1024 muestras por bloque vía `FUN_10029530`.
   7. **Especificación Canónica SysEx y Presets de Fábrica**:
      - Confirmada la ausencia de SysEx en el DLL VST2 (filtra estrictamente `kVstMidiType`).
      - Decodificada la cabecera canónica del hardware Hartmann desde el volcado de firmware `neuron_1_5_0.mid`: `F0 00 20 50 01 7F 70 00` (Manufacturer ID oficial MMA: `0x00 0x20 0x50`).
      - Tabla canónica de 445 descriptores embebida en `.rdata:0x10049F08`, nombres de 1.000 sonidos inicializados con `InitSound` (`0x100525BC`).
- **VerificaciÃ³n (DoD)**:
  - Cierre de la **Fase A (Hartmann Neuron ClÃ¡sico 1:1)**: `build.bat nopause` 100 % en verde (CTest + Vitest 43/43 + Selftest E2E en las dos superficies + paridad WASM `AudioWorklet`).

---

### Hito de DiseÃ±o Intermedio (Gate A â†’ B) â€” SesiÃ³n de DefiniciÃ³n de la Fase B
> [!IMPORTANT]
> **Compromiso Estricto de Hoja de Ruta:**
> La **Fase B (VersiÃ³n Extendida / Extended) queda congelada y NO se diseÃ±arÃ¡ ni implementarÃ¡** hasta comprobar exhaustivamente y certificar en audio real que la versiÃ³n clÃ¡sica (Fase A) funciona de forma 100% correcta y estable.
> 
> Todas las ideas preliminares quedan registradas como sugerencias de anÃ¡lisis futuro:
> 1. CÃ³mo conviven o se conmutan los modelos clÃ¡sicos `.model` (`NeuronDB`) y los modelos extendidos `.nmmodel v2.1` (`ABDNeuModMakr`) en cada Resynator (conmutaciÃ³n por Resynator o global).
> 2. QuÃ© moldeadores espectrales de `ABDNeural` (*Inharmonicity Stretch*, *Parity*, *Entropy/Roughness*, *Shift*, *RollOff*) se incorporan, con quÃ© rangos y cÃ³mo se mapean (pestaÃ±a dedicada o asignables a los Sticks 2D).
> 3. Si se mantiene la topologÃ­a dual `R1 + R2 + Blender` o se amplÃ­a a morphing de 4 esquinas (`A/B/C/D`) con un tercer Resynator.
> 4. Soporte de Drag & Drop directo de archivos `.model`, `.sound` y `.nmmodel` sobre la interfaz (adelantado a la UI clÃ¡sica por ser una mejora de ergonomÃ­a general).

### Fase B â€” VersiÃ³n Extendida / Extended (Soporte HÃ­brido `.nmmodel v2.1` de `ABDNeuModMakr`) *(Sujeta a Gate de DiseÃ±o A â†’ B)*
- **Objetivos Preliminares (a refinar en el Gate A â†’ B)**:
  1. **Soporte Nativo de `.nmmodel` (`v2.1`)**:
     - Implementar `NmModelLoader` y `NmModelResinator` en `Source/DSP/Extended/` para cargar directamente paquetes `.nmmodel` generados por `ABDNeuModMakr` (precisiÃ³n `Float32`, 64 parciales inarmÃ³nicos con `frequencyOffsets` en semitonos, mÃºltiples capas de velocidad/nota y muestras WAV embebidas), integrando los mÃ³dulos de anÃ¡lisis y modelado espectral `@abdsynths/shared/dsp/neuron-analysis` (`FftEngine`, `SpectralAnalyzer`, `LayerClustering`, `ScapeSphereGenerator`).
  2. **Moldeadores de Materia SÃ³nica de `ABDNeural` (`SpectralShaper`)**:
     - Integrar en cada Resinator (o en el modo extendido) los operadores espectrales de `ABDNeural/Source/DSP/CoreModules/Resonator.cpp`:
       - *Inharmonicity Stretch*: $f_n = f_0 \cdot (n + \Delta_n) \cdot \sqrt{1 + B \cdot n^2}$
       - *Parity (Par/Impar)* y *Spectral Shift*
       - *Entropy / Roughness* (micro-modulaciÃ³n determinista por parcial) y *HF RollOff*
  3. **Modo HÃ­brido Dual / `Resinator 3` (Morphing 4-Way A/B/C/D)**:
     - Permitir que `R1` y `R2` operen indistintamente con modelos clÃ¡sicos `.model` (`NeuronDB`) o con modelos `.nmmodel` (`ABDNeuModMakr`), e incorporar el modo de morphing bilineal de 4 esquinas (`Slots A..D`) de `ABDNeural`.
  4. **Puente Directo `ABDNeuModMakr` â†” `ABDAxionikVS`**:
     - Carga en caliente (Drag & Drop o vigilancia de directorio) de archivos `.model` y `.nmmodel` reciÃ©n sintetizados desde `ABDNeuModMakr`.
- **VerificaciÃ³n (DoD)**:
  - Suite de pruebas del motor extendido verificando paridad matemÃ¡tica con `ABDNeural::DSP::CoreModules::Resonator`, carga sin artefactos de `.nmmodel v2.1` multicapa y paridad bit-exacta entre el build nativo (`VST3`/`Standalone`) y el `AudioWorklet` WASM.


---

### Fase C / ExpansiÃ³n Futura â€” Pantalla LCD Superior Fija y Monitor de TelemetrÃ­a (Post-Fase B)
> [!NOTE]
> **PlanificaciÃ³n a largo plazo:** Este hito se abordarÃ¡ al concluir la Fase B. ImplementarÃ¡ una pantalla LCD panorÃ¡mica fija superior, inspirada en la arquitectura de `ABDMS2000` (`Sticky Top Hero Bar`), estrecha pero larga, reutilizando los componentes LCD de `ABDShared` (`ABDShared/Components/LcdDisplay`, `lcdMachine.js`, `lcdPanel.js`, `lcdScreen.js` y `lcd.css`).

- **Objetivos de la Pantalla LCD Superior**:
  1. **EmulaciÃ³n y Visor de Pantallas del Hardware Original**:
     - Visualizar la informaciÃ³n de contexto de todas las pantallas y sub-pÃ¡ginas clÃ¡sicas del `NeuronVS` original (las 33 vistas de 2004) y los menÃºs del sintetizador hardware Hartmann Neuron (`Setup`, `Bank`, `Model`, `Resynator`, `Blender`, `Silver`, `Modulation`, `Zones`).
  2. **TelemetrÃ­a y MonitorizaciÃ³n de ParÃ¡metros en Tiempo Real**:
     - Al interactuar el usuario con cualquier potenciÃ³metro, fader, selector o stick, el LCD mostrarÃ¡ instantÃ¡neamente en cabecera:
       - Nombre formal y legible del parÃ¡metro activo.
       - Valor actual normalizado y valor en su dominio fÃ­sico real (Hz, dB, %, ms, semitonos).
       - Identificador de mapeo MIDI: CÃ³digo CC correspondiente (si estÃ¡ asignado), cÃ³digo NRPN de 14 bits (`CC 99/98/6/38`, `0..444`) y trama de comando SysEx asociada.
  3. **Monitor Visual de Automatizaciones y ReproducciÃ³n de Trayectorias**:
     - Mostrar en vivo el estado del grabador vectorial de trayectorias (`REC / PLAY / IDLE`).
     - Renderizar la evoluciÃ³n temporal de las automatizaciones grabadas en los Sticks cuando se pulse `PLAY`, mostrando coordenadas $X, Y$, estela en miniatura y barra de progreso temporal en tiempo real sobre el display LCD.
  4. **AlineaciÃ³n con el Ecosistema `ABDShared`**:
     - Consumir el subsistema LCD de `ABDShared` (`LcdMachine`, `LcdPanel`, `LcdScreen`) con tipografÃ­a retro segmentada/matriz de puntos, contraste adaptable segÃºn el tema activo y formateador de menÃºs similar a `LCDMenuFormatter.h` de `ABDMS2000`.
  5. **Joystick Digital de NavegaciÃ³n del Hardware (`Navigation Stick` 4 VÃ­as + Enter)**:
     - En el hardware fÃ­sico original Hartmann Neuron, situado a la derecha de la pantalla LCD, existÃ­a un joystick digital de navegaciÃ³n de 4 posiciones (`stick.up`, `stick.down`, `stick.left`, `stick.right`) y un botÃ³n central de confirmaciÃ³n (`Enter`) para navegar por menÃºs de sistema, bancos, modelos y cambiar parÃ¡metros numÃ©ricos sin necesidad de ratÃ³n.
     - Integrar junto al display LCD panorÃ¡mico el widget interactivo **`NavigationStick`** (con respuesta tÃ¡ctil/ratÃ³n, atajos de flechas de teclado y mapeo MIDI CC/SysEx configurable), permitiendo una experiencia de navegaciÃ³n tÃ¡ctil y operativa 100% idÃ©ntica a la consola del sintetizador de teclado original.

---

### Fase D / ExpansiÃ³n Futura â€” Inspector & Calibrador Integral de ParÃ¡metros (`paramIndices.ts` & `AxionikParamIndices.h`), Magic Numbers y GestiÃ³n JSON (Estilo `ABDJUNiO601`)
> [!NOTE]
> **PlanificaciÃ³n a largo plazo (casi al final de los desarrollos):** ImplementaciÃ³n de una vista / panel avanzado de auditorÃ­a, calibraciÃ³n y ediciÃ³n exhaustiva de los parÃ¡metros de [`paramIndices.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/constants/paramIndices.ts) y [`AxionikParamIndices.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/ClassicNeuron/AxionikParamIndices.h), adaptando el patrÃ³n de banco de pruebas e inspecciÃ³n paramÃ©trica ya establecido en `ABDJUNiO601`.

- **Objetivos de la Fase D**:
  1. **Inspector Tabular & JerÃ¡rquico de ParÃ¡metros Completos**:
     - VisualizaciÃ³n exhaustiva de los 445 parÃ¡metros autoritativos de `snddat` mÃ¡s los coeficientes del motor DSP:
       - **IdentificaciÃ³n:** Ãndice numÃ©rico formal (`0..444`), identificador canÃ³nico (`enum ParamIdx`), clave en `sound.script` y nombre legible.
       - **Metadatos de Rango y CuantizaciÃ³n:** Valor mÃ­nimo (`min`), valor mÃ¡ximo (`max`), paso/resoluciÃ³n (`step`), y valor por defecto autoritativo actual (`default`).
       - **DocumentaciÃ³n y ExplicaciÃ³n TÃ©cnica:** DescripciÃ³n contextual de la funciÃ³n exacta del parÃ¡metro en la arquitectura del sintetizador y unidades fÃ­sicas reales (Hz, dB, %, ms, semitonos, ratio, etc.).
       - **Control Interactivo en Vivo:** Entradas numÃ©ricas y sliders de precisiÃ³n para ajuste en caliente con propagaciÃ³n bidireccional inmediata al motor DSP (`WebBridge.setParam`) y sincronizaciÃ³n sin ecos hacia el resto de vistas.
  2. **AgrupaciÃ³n y OrganizaciÃ³n Modular por Subsistemas**:
     - Filtros y pestaÃ±as de agrupaciÃ³n lÃ³gica para navegaciÃ³n inmediata:
       - **Global, Performance & Voice:** `[0..21, 411..412]` (PolifonÃ­a, Pan, PanKeyTrack, PitchBendRange, Footswitch, etc.).
       - **Resynator 1 & Resynator 2:** `[22..101]` y `[102..181]` (Modelos, AfinaciÃ³n, TamaÃ±o, Niveles Scape/Sphere 1..3, Envolventes, Modulaciones de eje).
       - **Blender & Slicer:** `[261..270]` (Algoritmos de fusiÃ³n, cantidad de mezcla bipolar, modulaciÃ³n, Slicer Type, Depth, Rate).
       - **Silver Multimode Filter & ADSR:** `[271..280, 355..362]` (Curvas de filtro 24/12/6 dB, Cutoff, Reso, Keytrack, Velocity, envolvente ADSR de filtro).
       - **Silver FreqFX:** `[281..326]` (EQ paramÃ©trico de 4 bandas + Compresor, DistorsiÃ³n 6 curvas, Ring Modulator, Decimator, Spectral Warp).
       - **Silver TimeFX:** `[327..354]` (Stereo Spread, L/R Delay, Flanger, Phaser, Chorus).
       - **Free Modulation Matrix & Hardware Controls:** `[363..429]` (6 fuentes Ã— 4 destinos, Macro Encoders 1..4, Controles CC 1..11, Aftertouch).
       - **Master Spatial FX Rack:** `[430..444]` (Master Delay estÃ©reo y Master Reverb de 5 salas).
  3. **AuditorÃ­a e InclusiÃ³n Exhaustiva de "Magic Numbers" y Constantes Internas**:
     - RevisiÃ³n completa para documentar y parametrizar las constantes empÃ­ricas y nÃºmeros mÃ¡gicos identificados durante la descompilaciÃ³n de `NeuronVS.dll` y el orÃ¡culo Ã¡ureo:
       - **Umbral FÃ­sico de 1 mm (`1/25.4` pulgadas = `0.03937`):** Constante de puerta en el callback `stSPEngineCb` (`0x100139D0`) para actualizaciÃ³n de cotas fÃ­sicas en mm convertidas a pulgadas en slots 164 y 194.
       - **ParÃ¡metros con Default Menor que Min (19 parÃ¡metros):** Registro de los 19 casos donde el descriptor en `.rdata` declara `default = 0` con `min = 1` (`*StickPlayback` y `EQ_*`), forzados a `1.0` por `FUN_10001170`.
       - **Dimensiones de Frames y Bloques FDN:** Dimensiones de frame de `.sphere` (`6.568 B`, `magic = 1234` / `0x4d2`), crossfade de 25 bandas cada 1024 o 512 muestras segÃºn `decodeMode`, y bloque opaco de 6.152 B (1.024 parciales espectrales).
       - **Filtro de Ã‰nfasis Diferencial de Curvas `.scape`:** Coeficientes `(v - prev) * 2 + v` y longitudes de ciclo variables (`84, 100, 168, 169, 337, 2047` muestras).
       - **LÃ­mites de Seguridad y SaturaciÃ³n:** Modos conmutables de salida (`OracleClipToZeroMode` legacy `if (x*x > 1.0) x = 0.0` vs. Soft-Saturation musical moderna).
  4. **GestiÃ³n de SerializaciÃ³n JSON (Import / Export / Reset)**:
     - **Exportar a JSON:** Volcado estructurado de la totalidad de parÃ¡metros, metadatos, agrupaciones y calibraciones a archivo `.json` formateado y versionado.
     - **Importar desde JSON:** Carga, validaciÃ³n de esquema, comprobaciÃ³n de rangos `[min, max]` e inyecciÃ³n masiva en caliente hacia `snddat` y el motor DSP.
     - **Perfiles de CalibraciÃ³n:** Soporte para guardar perfiles ("Default Factory", "Paridad Estricta DLL 2004", "Enhanced Musical Mode", "CalibraciÃ³n Custom").
     - **BotÃ³n Reset:** RestauraciÃ³n instantÃ¡nea de todos los parÃ¡metros a sus valores por defecto canÃ³nicos.

---

### Fase E â€” DistribuciÃ³n de Pantalla en Rejilla CanÃ³nica de 6 Unidades y Colapso Sincronizado de Filas
- **Rejilla Unificada de 6 Unidades (
epeat(6, 1fr)) en 3 Filas SimÃ©tricas**:
  1. **Fila 1 (Superior â€” Resynators & Silver)**:
     - Izquierda (col-span-2): Resynator 1 (Scape 1 + Sphere 1 joysticks).
     - Centro (col-span-2): Resynator 2 (Scape 2 + Sphere 2 joysticks).
     - Derecha (col-span-2): Silver Filter & Multi-FX Rack (SilverPanel).
     - Las tres cajas comparten idÃ©ntico ancho (1/3 de pantalla = 2 unidades), estilos y tokens visuales.
  2. **Fila 2 (Media â€” Shapers Hardware)**:
     - Izquierda (col-span-2): Shaper 1 (R1).
     - Centro (col-span-2): Shaper 2 (R2).
     - Derecha (col-span-2): Shaper 3 (Silver & Master EFX).
     - IdÃ©ntico ancho y alineaciÃ³n vertical con las 3 cajas de la fila superior.
  3. **Fila 3 (Inferior â€” Controllers, ExpansiÃ³n & Master)**:
     - Izquierda (col-span-2): Hardware Controllers (Control 1 stick, Control 2 wheel + ladder, Control 3 wheel + ladder).
     - Centro + Media Derecha (col-span-3): BahÃ­a de ExpansiÃ³n Auxiliar (#aux-panel / "MÃ³dulo de ExpansiÃ³n Auxiliar").
     - Extremo Derecho (col-span-1): Master Output (MasterOutputPanel) con encoder rotatorio de LEDs discretos (RotaryLedKnob).
- **Sistema de Colapso Sincronizado por Fila (Row-Level Collapse)**:
  - Todas las cajas incorporan un botÃ³n chevron (â–¾ / â–´) a la derecha del botÃ³n Edit.
  - Al pulsar el chevron de cualquier caja de una fila, **la fila entera se colapsa o expande simultÃ¡neamente**, ocultando el cuerpo de los paneles ([data-collapse-body]) y dejando visible exclusivamente la primera lÃ­nea de cabecera (.panel-header) con los tÃ­tulos legibles (RESYNATOR 1, RESYNATOR 2, SILVER, SHAPER 1 (R1), SHAPER 2 (R2), SHAPER 3 (SILVER), CONTROLLERS, EXPANSION, MASTER).
  - Totalmente adaptativo en responsive (@media max-width: 1100px y 768px).
- **Modernización de BlenderDrawer con Knobs de ABDShared**:
  - Sustitución de la totalidad de sliders HTML por componentes vectoriales interactivos Knob (size: 40, skin estándar con arrastre y rueda).
  - Bloque 1 (Fusion Engine): 5 knobs alineados (AMOUNT [262] bipolar -64..+63 con sub-etiqueta R1 ◀ ▶ R2, LFO DEP [263], ADSR 1 [264], ADSR 2 [265], 4L4T [266]).
  - Bloque 2 (Slicer Engine): 2 knobs (RATE [269] 0..200 y DEPTH [268] 0..127) + selector de ondas con píldoras estándar.
