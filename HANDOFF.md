# ABDAxionikVS — Documento de Relevo Técnico (`HANDOFF.md`)

> **Proyecto:** `ABDAxionikVS` (`D:\desarrollos\ABDSynths\ABDAxionikVS`)
> **Repositorio GitHub:** `https://github.com/ajabadia/ABDAxionikVS.git`
> **Familia:** `ABDSynths` (`D:\desarrollos\ABDSynths`)
> **Estado Actual:** **Fase A (Neuron Clásico 1:1) Completada en Nativo (Pendiente únicamente empaquetado WASM)** — Tubería completa de carga de presets y modelos operativos en DSP y WebUI, Síntesis aditiva periódica del cuerpo espectral de 1.024 parciales con offset canónico `frameOffset + frameStride - 6152` (`SphereBodyTable` en `NeuronOscillators.h` / `FUN_1002e750`), normalización dinámica de muestras `.scape` de 16 bits y soporte one-shot, compensación de tono por zona (`RootKey`/`Detune`, `FUN_10032970`), Reconstrucción 1:1 de los algoritmos Parset (`FUN_10031d30` / `FUN_10031e70`), Silver Rack completo con los 5 `FreqFX` canónicos (incluyendo `EQ de 4 bandas + Compresor` `[285..305]`, `Distortion`, `RingMod`, `Decimator`, `Sp-Warp`) y los 5 `TimeFX` (`Stereo Spread`, `L/R Delay`, `Flanger`, `Phaser`, `Chorus`), Filtro Silver por voz (`FUN_10021c90`), Reverb Maestra híbrida (`ABDEep` `SchroederReverb` + `DspFdnReverb` de 5 salas en `DspNeuronMasterFX.h`), LFO Global (`[256..260]`), Polifonía `SoundNumVoices [5]`, `SoundPan [3]`/`SoundPanKeyTrack [4]`, conmutadores `R1Switch [23]`/`R2Switch [103]`, `OracleClipToZeroMode` conmutable, Matriz de Modulación conectada 1:1 a los 63 destinos y `Free Controllers [363..410]`, verificación dinámica de zonas (`--zones` 128/128) y matriz (`--matrix` 63/63), biblioteca unificada `NeuronDB` con **398 presets** y **19 categorías oficiales**, `WebUI` completa (`ResynatorDrawer`, `BlenderDrawer`, `SilverDrawer`, `MasterFxDrawer`, `MatrixDrawer`, `SettingsDrawer`, `BankDrawer`), y tests TypeScript pasando 9/9. **Fase B en estricta pausa hasta verificación en audio real del baseline clásico.**

---

## 1. Resumen Ejecutivo del Estado Actual

1. **Inspección Integral de Fuentes Completada**:
   - Se ha auditado al 100 % el estudio de ingeniería inversa de `NeuronVS.dll` y `NeuronDB`, el proyecto hermano [`ABDNeuModMakr`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr), los sintetizadores de referencia [`ABDNeural`](file:///d:/desarrollos/ABDSynths/ABDNeural), [`ABDMS2000`](file:///d:/desarrollos/ABDSynths/ABDMS2000) y [`ABDEep`](file:///d:/desarrollos/ABDSynths/ABDEep), y el ecosistema compartido [`ABDShared`](file:///d:/desarrollos/ABDSynths/ABDShared) (`ABDSharedCode` + `ABDSharedAssets`).
2. **Corpus Documental Centralizado en [`DOCS/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS) (+110 archivos)**:
   - [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md): Inventario completo de las 10 vistas, 33 sub-páginas, 429 controles y los **445 parámetros** del Neuron / NeuronVS (incluyendo rangos, valores por defecto, los 10 `Parameter Sets` `mnAN`/`fdAN`, los 10 modos de `Blender`, las 5 curvas de filtro, los 5 `FreqFX`, los 5 `TimeFX`, las 5 salas de `Master Reverb`, las 12 formas de onda, la tabla MIDI CC oficial de 29 CCs del hardware y la matriz `Free Controllers`), junto con el diseño de adaptación y mejora UX (`ABDEep`-style main + sliding drawers) para nuestra `WebUI`.
   - [`DOCS/DSP_MIGRATION_AND_FIXES.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/DSP_MIGRATION_AND_FIXES.md), [`DOCS/reverse_engineering/dsp/params_observers_map.csv`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/dsp/params_observers_map.csv), [`DOCS/reverse_engineering/dsp/mac156_symbol_xref.csv`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/dsp/mac156_symbol_xref.csv), [`DOCS/reverse_engineering/dsp/pc10_to_mac156_dsp_map.csv`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/dsp/pc10_to_mac156_dsp_map.csv) y [`DOCS/reverse_engineering/neurondb/NEURON80GB_OS15_README.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/neurondb/NEURON80GB_OS15_README.md): Guía completa de migración del motor DSP, resolución de los 4 callbacks `LAB_100135d0..100139d0`, mapa exacto de los 335 observadores (`snddat[0..444] -> p[0..334]`) y de los 63 destinos de modulación (`0x10049E00`), tabla de símbolos original de Mac `1.56` (`2013`) con los 4 fixes oficiales de Stephan Bernsee, variaciones de formato del disco Linux `Neuron80GB-OS15`, eliminación total de `<Nuke>`, catálogo de los **9 bugs corregidos** y las **4 decisiones de diseño cerradas**.
   - [`DOCS/manuals/NeuronVS_User_Manual.txt`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/manuals/NeuronVS_User_Manual.txt) y [`DOCS/manuals/Neuron_Hardware_Manual_E_0703.txt`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/manuals/Neuron_Hardware_Manual_E_0703.txt): Manuales oficiales completos en UTF-8 limpio (sin caracteres de control `\x0c`).
   - [`DOCS/reverse_engineering/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/README.md):
     - [`dsp/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/dsp/README.md): Las 87 funciones del camino de audio (`FUN_100382b0`, `FUN_10040550`, `FUN_100440d0`), partición de estados (`STATE_SPLIT.md`), zonas (`ZONES.md`) y las 1.430 constantes tipadas (`constants_types.csv`).
     - [`preset_format/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/preset_format/README.md): `preset_schema.csv` (445 claves), `PARAM_RECORD.md` (`40 B` por registro + regla `FUN_10001170` con 19 clamps `0 -> 1`) y `OBSERVER_CALLBACK.md` (`0x10013620`).
     - [`neurondb/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/neurondb/README.md): `SCAPE_SPHERE.md`, `SYNTH_FRAMES.md`, `map.script` (`1.027` líneas), curvas `.scape` (`int16`) y frames `.sphere` (`6.568 B` = `25 × 4` floats de bandas + bloque de `6.152 B` de 1.024 parciales).
     - [`layout/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/layout/README.md), [`bitmaps/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/bitmaps/README.md), [`filmstrip/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/filmstrip/README.md): `control_params.csv`, `page_ref_links.csv`, `page_summary.csv`, `OBSERVER_PASSES.md`, `viewer.html`.
     - [`vst2/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/vst2/README.md): Los 26 parámetros VST expuestos al host y la implementación MIDI.
     - [`port/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/port/README.md), [`classes/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/classes/README.md), [`resolved/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/resolved/README.md).
3. **Hoja de Ruta Actualizada en [`ROADMAP.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/ROADMAP.md)**:
   - Define las Fases `0`, `A.1`, `A.2`, `A.3`, `A.4` (con adaptación y mejora moderna del UI), el **Gate de Diseño A → B** (discusión obligatoria con el usuario antes de abordar la Fase B) y la **Fase B (Versión Extendida / Extended)**.

---

## 2. Invariantes Arquitectónicas No Negociables

1. **Principio DRY y Ecosistema `ABDShared`**:
   - Consumir siempre desde `../ABDShared/Code` (`ABDShared::DspCore`, `ABDShared::DspEffects`, `ABDShared::SynthCore`, `ABDShared::HardwareDrivers`, `ABDShared::WebView2Bridge`, `ABDShared::AudioComparator`, `ABDShared::BankManagerCore`) y desde `@abdsynths/shared` + `@abdsynths/midi-keyb` (`D:\desarrollos\ABDSynths\ABDShared\Code\MidiKeyboard`) vía `pnpm-workspace`.
   - **Efectos en `ABDShared/Code/DspEffects`**: Todos los motores de efectos de `Silver` (`FreqFX` y `TimeFX`) y `Master FX` (`Stereo Delay` y `Master Reverb`) se implementan en `D:\desarrollos\ABDSynths\ABDShared\Code\DspEffects` (`namespace abd::dsp`, header-only, unidades físicas, perfiles en `DspEffects/profiles/` y adaptadores en `BasicAdapters.h` + `Contracts/fx-effects.json`), siguiendo exactamente las normas de `ABDMS2000`. En `ABDAxionikVS` sólo viven los shims de producto, permitiendo usar estos efectos en otros sintes y usar el catálogo de +60 efectos de `ABDShared` en la versión expandida.
   - **Matriz `Free Controllers ([363..410])` Aséptica en `ABDShared`**: Construida sobre `ABDShared/Code/SynthCore/ModMatrix.h` (`abd::synth::ModMatrixT`, índices opacos sin vocabulario de sinte), `ABDShared/Components/modMatrix.js` y `ABDShared/Contracts/abdaxionikvs_modulation_matrix.json`, e integrada directamente con el teclado [`ABDShared/Code/MidiKeyboard`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/MidiKeyboard/src/keyboard.js).
   - **Capa de Abstracción entre Parámetros y DSP**: El motor DSP (`Source/DSP/`) jamás lee `APVTS` ni strings; la capa `Source/State/` (`Conversion.gen.h` + `SndDatStore`) empaqueta un struct plano libre de JUCE (`AxionikDspParams` en `DspTypes.h`) que cruza la frontera `DspEngineFacade` hacia el motor nativo y WASM.
   - Volcar hacia `ABDSharedAssets` los componentes nuevos reutilizables: **`TrajectoryStick2D`** (Stick XY con anillo multipolar `mnAN` y grabación/reproducción de trayectorias) y **`MultiStageShaperPad`** (envolvente gráfica bipolar `4L4T`).
2. **Motor DSP en C++20 Puro Desacoplado de JUCE + `DspSources.cmake` Único**:
   - Ningún archivo dentro de `Source/DSP/` puede incluir `<juce_*.h>`.
   - `DspSources.cmake` es la lista única de compilación compartida por `CMakeLists.txt` (nativo JUCE 9 `Standalone` + `VST3`) y `wasm/CMakeLists.txt` (Emscripten `AudioWorklet` con `HEAPF32` exportado).
   - **Cero asignaciones dinámicas en `noteOn`/`processBlock`**: sustituir los 16 `operator_new(0x2020)` por voz del binario original por un `VoiceMemoryPool` preasignado en `DspEngineFacade::prepare()`.
3. **Contrato Único Autogenerado (`Scripts/registry_generator.js`)**:
   - Única fuente de verdad para los **445 parámetros** de `snddat`, los **26 alias VST primarios**, el mapeo **MIDI CC + NRPN de 14 bits (`0..444`) + SysEx** y el protocolo `WebView2` (`bridge-protocol.json`).
4. **Empaquetado Vite Obligatorio (`WebUI/dist/`)**:
   - `WebView2` nativo sirve siempre `WebUI/dist/` en producción (con sonda al servidor Vite en Debug).
5. **Estrategia de Interfaz (`WebUI`)**:
   - No replicar el skin ni el laberinto de 33 sub-páginas de 2004; implementar la interfaz adaptada y mejorada especificada en [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md) que expone el 100 % de los 445 parámetros sin páginas ocultas.
6. **Gate de Diseño antes de la Fase B**:
   - Al concluir la Fase A (`Neuron Clásico 1:1`), **detenerse y acordar con el usuario** el diseño detallado de la Fase B (Versión Extendida + `.nmmodel v2.1`).

---

## 3. Rutas Locales de Bancos y Oráculos de Prueba

- **Código C++ preliminar del puerto (`NeuronVS_port`)**: `C:\Users\ajaba\Downloads\neuron\NeuronVS_port\include\neuronvs\` y `src\translator.cpp`.
- **Banco completo de modelos y presets (`NeuronDB`)**:
  - `C:\Users\ajaba\Downloads\neuron\NeuronVS-db\NeuronDB\Models\` (`000.model` .. `511.model`)
  - `C:\Users\ajaba\Downloads\neuron\NeuronVS-db\NeuronDB\Sounds\` y `C:\Users\ajaba\Downloads\neuron\Hartmann Music\NeuronVS\NeuronDB\Sounds\` (`351` presets de fábrica `.sound`)
- **Vectores áureos WAV y dumps de memoria de `NeuronVS.dll`**:
  - `C:\Users\ajaba\Downloads\neuron\NeuronVS_port\golden\` y `C:\Users\ajaba\Downloads\neuron\NeuronVS_vst2\golden\`

---

## 4. Estado de las Fases y Avances Recientes

1. **Fase 0 — Cimientos, Contratos y Esqueleto Dual**: **COMPLETADA AL 100%**.
   - Workspace registrado en `pnpm-workspace.yaml`, esquemas canónicos poblados en `schemas/`.
   - Generador canónico `Scripts/registry_generator.js` activo con validación `--check`.
   - Contratos generados en C++ (`ParameterRegistry.gen.h`, `Conversion.gen.h`, `MidiMapping.gen.h`) y TypeScript (`parameters.gen.ts`, `bridge-protocol.json`).
   - WebUI construida en `WebUI/` con paridad estética 1:1 con `ABDNeuModMakr`, tokenizada con `@abdsynths/shared/styles`, empaquetando con Vite a `WebUI/dist/`.
   - Suite Vitest con 5/5 tests pasando en verde.
   - Compilación nativa MSVC (`build.bat nopause`) con éxito total (`ABDAxionikVS.exe`, `ABDAxionikVS.vst3`, `ABDAxionikVS WebPilot Host.exe`).
   - Repositorio git inicializado y commit inicial registrado.

2. **Fase A.1 y A.2 — Motor DSP Canónico y Frontend Unificado**: **COMPLETADA AL 100%**.
   - **`SndDatStore` y `ParameterEngineBridge`**: Los 445 parámetros autoritativos con regla `FUN_10001170`, 335 observadores, 6 controles de ejecución en tiempo real y traducción continua a través de `Translator` (`FUN_10040550`).
   - **Síntesis Multicapa por Resonador (`NeuronOscillators.h`)**:
     - `ResynatorLayer`: excitación `CurveReader` (Scape, `FUN_100317b0`) filtrada por formantes `BandReader` (Sphere, `FUN_10031950`) con coordenadas dinámicas 2D ($X, Y$), nivel y desafinación analógica.
     - `CResynator` (`0x6838` bytes, `FUN_1002e7a0`): Orquesta las 3 capas canónicas (`L1`, `L2`, `L3`) para R1 y R2.
     - Despachador de los 7 algoritmos de síntesis Parset (`FUN_10031d30` / `FUN_10025380..FUN_10031e70`).
   - **Silver Rack y Efectos Maestros (`NeuronSilverRack.h` / `NeuronBlockPump.h`)**:
     - `SilverFilter` (`FUN_10042a30`): filtro multimodo (LP12/24, BP, HP, Notch) con saturación analógica previa (*Drive*).
     - `SilverFreqFX`: los 9 algoritmos de modulación espectral (FreqShift, RingMod, Distortion, Decimator, Formant, Comb, Resonator, Treemonster).
     - `SilverTimeFX`: los 7 algoritmos de modulación temporal (Chorus, Flanger, Phaser, Delay, Multi-Tap, Reverb) con la corrección `Reset()` de Stephan Bernsee (Mac 1.56).
     - `CMasterModFX` (apertura M/S) y `CMasterTimeFX` (reverb espacial).
     - Bombeo de bloques de 128 muestras con recorte canónico *clip-to-zero* (`0x1000bc40`).
   - **Capa de Abstracción de Parámetros y Controladores Unificada sobre el Motor DSP**:
     - Entradas de control convergentes: las entradas de control (WebUI PARAM_SET, MIDI CCs, desempacador NRPN de 14 bits, Pitch Bend, Channel Pressure / Aftertouch y automatización VST3) entran exclusivamente por la capa de abstracción de AxionikProcessor (setParameterByIndex, setParameterNormalizedByIndex, setMidiPitchBend, setMidiChannelPressure, setMidiController), notificando formalmente al Host DAW (setValueNotifyingHost).
     - El motor DSP (DspEngineFacade) opera estrictamente por debajo, aislado del transporte, la UI y el protocolo de control externo, recibiendo actualizaciones mediante listeners de estado y estructuras planas.
     - Despacho bidireccional APVTS -> WebUI a 30 Hz con mapa hash O(1) (drainPendingUiParamChanges()), asegurando sincronización fluida de automatizaciones del DAW.
   - **Enrutamiento MIDI Canónico, NRPN de 14 bits y Controladores en Tiempo Real**:
     - PluginProcessor::handleMidiEvent: Enrutador de CCs de hardware para Sticks XY (CC 16..19, 35..37, 39), Blender (CC 70), Filter Reso (CC 71), Filter Cutoff (CC 74) y los 6 controles en tiempo real del Neuron (CC 1, 2, 3, 4, 11 y Channel Pressure).
     - Desempacador NRPN de 14 bits (CC 99/98/6/38) direccionando 1:1 los 445 parámetros autoritativos de snddat a través de la capa de abstracción DspEngineFacade::setParamNormalized.
     - Matriz de modulación 6x4 conectada a nivel DSP a los 63 destinos canónicos de modulación (Cutoff, Reso, Blender, Stick XY, Slicer, Volumes) y Pitch Bend dinámico con rango parametrizable (PitchBendRange [412]).
   - **Reproducción Vectorial en Tiempo Real (sound.stickrec) y Etiquetas mnAN (10 Parameter Sets)**:
     - Implementado Source/DSP/StickPlayer.h: motor lock-free y RT-safe que reproduce los eventos de joystick de los 103 presets de fábrica (TTTTFCVVV, 74.799 eventos totales) al tocar notas (Note On), interpolando milisegundo a milisegundo los 8 ejes Scape/Sphere de R1/R2.
     - Dotado a TrajectoryStick2D de grabador y reproductor de bucle de trayectorias vectoriales (REC / PLAY / CLEAR) con estela SVG reactiva y normalización fluida [0.0..1.0].
     - Conectadas las etiquetas dinámicas de los polos cardinales a partir de los 10 Parameter Sets canónicos (schemas/parameter_sets_mnan.json vía ParameterSets.ts).
   - **Biblioteca Maestra NeuronDB Consolidada y Curada en el Proyecto**:
     - Directorio centralizado NeuronDB/ con 341 modelos completos (000.model..511.model) y 398 presets (354 de NeuronVS + 44 exclusivos del Hardware Soundset V4 en 351.sound..394.sound), clasificados con las 19 categorías oficiales de soundlist_fact_set_4.pdf y con los ajustes originales SoundMFX* ([430..444]) restaurados del Hardware, además de los 10 archivos sound.stickrec recuperados de la versión Hartmann Music.
     - Documentación completa de formatos en NeuronDB/README.md (distinción estricta entre Models y Sounds).
     - Configurado .gitignore para ignorar los 2 GB de binarios de modelos sin ensuciar el repositorio git.
   - **Topología de Mezcla R1/R2 y Bypass en Modo Split según Evidencia Ghidra (§6.5)**:
     - Render en bloques de 128 muestras (FUN_100382b0) y mezclador de 10 modos (FUN_1002e7a0).
     - Pesaje cruzado verificado en el binario: +0x64 multiplica a R1 y +0x60 a R2.
     - Plegado de índices de buffer x86: memoria real plana en base + 0 .. +0x1FF (128 floats = 512 bytes).
     - Modo 1 (Chromophonic / Split, 0x1002EFF5) con desacoplo estéreo puro y bypass de la etapa de filtro mono compartida (FUN_1003d6f0).
   - **Controles Universales en ABDShared y Envolvente 4L4T**:
     - Migrado TrajectoryStick2D a ABDShared/Components/trajectoryStick2D.js y exportado en @abdsynths/shared/components. Retirados los botones internos redundantes «Edit» de los 4 sticks en main.ts, centralizando el acceso a los controles ampliados en los botones de cabecera «Edit R1» y «Edit R2».
     - Creado y optimizado MultiStageShaperPad en ABDShared/Components/multiStageShaperPad.js (4L4T con modos Normal/Repeat, niveles bipolares, DOM inmutable durante el arrastre, monotonicidad temporal estricta y corrección de aspecto con `<ellipse>` y ResizeObserver para evitar deformación o achatamiento de círculos al estirar cajones).
     - Añadida persistencia y reactividad bidireccional en tiempo real para todos los cajones desplegables (ResynatorDrawer.ts, BlenderDrawer.ts, SilverDrawer.ts, MatrixDrawer.ts) hidratando sus controles directamente desde WebBridge.getParam.
   - **Correcciones Críticas en DSP Shared y Estabilidad**:
     - **Envolvente Canónica `DspNeuronEnvelope.h` en `ABDShared/Code/DspCore/`**: creado el componente modular reutilizable `abd::dsp::DspNeuronEnvelope` que reproduce la envolvente analógica `CShaper4T4L` del Neuron (`FUN_10035370`/`FUN_10040550`), con escala cuadrática `samples = norm^2 * (20s * sampleRate)` y descarga exponencial analógica RC en Decay/Release. Integrado de forma transparente en `NeuronVoice.h`.
     - **Integración Trapezoidal ZDF en `DspNeuronSilverFilter.h`**: corregidos los acumuladores internos de estado del filtro SVF 24dB (`s1 = 2*bp1 - s1; s2 = 2*lp1 - s2; s3 = 2*bp2 - s3; s4 = 2*lp2 - s4`), eliminando la realimentación positiva descontrolada.
     - **Cálculo de Stride en Búfer de Esferas en `NeuronOscillators.h`**: corregido el cálculo de `bandOffset` eliminando la multiplicación redundante por 4 sobre `bandStride` (que provocaba lecturas de memoria fuera de rango en bloques armónicos de parciales interpretados erróneamente como `NaN`). Añadidos saneadores `std::isfinite`.
     - **Documentación de Bug #10 (Corrupción de Heap en `NeuronVS.dll`)**: documentada en `DOCS/DSP_MIGRATION_AND_FIXES.md` y `DOCS/reverse_engineering/dsp/STATE_SPLIT.md` la corrupción en `params+0x2E2C` producida por `FUN_100134e0(params, -1)` sobre el contexto adyacente del heap, que desenganchaba destinos de modulación en caliente en la DLL original de 2004.
     - **Lanzadores CLI Autónomos**: creados `run_standalone.bat` (lanzamiento en primer plano con `start`) y `run_webpilot.bat` con directorio de usuario aislado de WebView2 (`WEBVIEW2_USER_DATA_FOLDER`) para evitar bloqueos por permisos en escritorio Windows.
     - Añadida persistencia y reactividad en tiempo real en ResynatorDrawer.ts para Parset [24/104], Tuning [33..35/113..115], ADSR de amplitud corregida [200..203/230..233] y los 6 sliders interactivos de 3 CANONICAL LAYERS (L1..L3).
     - Estandarizados los sliders con la clase .abd-slider consumiendo tokens de ABDShared/Assets/styles.
   - **Frontend WebUI & Ecosistema UI**:
     - Drawer deslizante universal (`DrawerManager`): panel lateral desde la derecha ocupando el 50% de la pantalla (`50vw`, `min-width: 460px`), unificado para Banco (`BankDrawer`), Resynator 1/2 expandidos (`ResynatorDrawer`), Silver & Master FX Rack (`SilverDrawer`), Matriz de Modulación 6x5 y Master FX.
     - Controladores vectoriales 2D (`TrajectoryStick2D`): emulación de alta precisión de los sticks físicos del Neuron/Nuke con restricción circular física, selección de capas `L1`, `L2`, `L3`, polos cardinales, lectura de coordenadas y cableado bidireccional a los 24 parámetros de capa.
      - Controles centrales expandidos: Blender con selector de los 10 algoritmos de fusión, fader de Amount [-64..+63], Slicer con modos 2D/3D, Rate y Depth, Cutoff y Resonancia del filtro de Silver Rack, y conmutación cíclica rápida de algoritmos FreqFX y TimeFX.
     - Gestor de Bancos (`BankDrawer`): estilos canónicos (`catalog-browser.css`), iconos `param0`..`param9`, selector de carpeta de librería con persistencia en `localStorage` y escaneo recursivo.
     - Teclado de interpretación (`KeyboardStrip`): integrado con `@abdsynths/midi-keyb`, ruedas activas de Pitch Bend y Modulación (`bender.png`), botones de octava con LEDs, Panic, Hold, Retrig y Sustain.
     - Barra de navegación (`AxionikNavbar`): integrado con `createSynthNavBar`, cambio de temas (`ms2000`, `audiolab`, `cz101`, etc.), zoom y lectura en vivo de telemetría.
     - **Paneles Modulares y Shapers (`ShapersPanel.ts`, `ControllersPanel.ts`, `SilverPanel.ts`, `MasterOutputPanel.ts`)**:
       - `ShapersPanel.ts`: 3 tarjetas homogéneas (`SHAPER 1`, `SHAPER 2`, `SHAPER 3`) con ruedas `Wheel` y barras `LedLadder` de `ABDShared` (`[200..207, 216..219]`, `[230..237, 246..249]`, `[355..358]` y `Shaper3Status [362]`), gobernadas mediante la capa de abstracción formal.
       - `ControllersPanel.ts`: Control 1 (Joystick 2D), Control 2 (Wheel + LedLadder), Control 3 (Wheel + LedLadder) y selector de Footswitch Assign en píldoras estándar.
       - `SilverPanel.ts`: Tarjeta dedicada con diseño armónico idéntico a las tarjetas Scape/Sphere.
       - `MasterOutputPanel.ts`: Bloque maestro a la derecha con Master Volume knob, selector de calidad de interpolación y medidor VU.
       - `pillSelector.ts`: Centralización DRY de todos los selectores de píldoras de la aplicación consumiendo tokens de `@abdsynths/shared`.
       - `EffectsDrawer.ts`: Modernizado al 100% con Rotary Knobs (`Knob` de `@abdsynths/shared/components/knob.js`) en L1 (Multimode Filter en 2 filas: Filtro 6 knobs + ADSR 4 knobs), L2 (Frequency FX con botones Active/Bypass por banda y en cabecera) y L3 (Time & Modulation FX), más Bloque 2 Master Spatial FX & Dynamics.
   - **Corrección de Paridad DSP**:
     - `DspEngineFacade.cpp`: Corregido orden invertido de argumentos `gain` y `freq` en `setEQParams` para las 4 bandas del ecualizador paramétrico.
   - **Trazas y Diagnóstico**:
     - `AppLogger.h`: registro a fichero `ABDAxionikVS.log` junto al ejecutable.

3. **Siguiente Paso Inmediato**:
   - Compilación nativa de verificación con `build.bat` (a ejecutar por el usuario).
   - Verificación de audio en tiempo real y carga de presets `.sound` / modelos `.model`.
   - Implementación visual de los pads de envolventes multinivel (`MultiStageShaperPad`) y generador de trayectorias automáticas (LFO / Record de stick).

4. **Backlog a Largo Plazo Registrado (Post-Fase B)**:
   > **Nota de Diseño Estético Canónico:** Todos los módulos inspirados en el hardware físico (displays polares, faders híbridos, 5º joystick de Silver, consola Programmer y controladores de mano izquierda) se diseñarán con la **estética moderna propia de ABDSynths** (`@abdsynths/shared`), adaptando su funcionalidad sin replicar el skeuomorfismo plástico retro del año 2002.
   - **Consola Programmer & Display VFD/LCD en Cápsula Ovalada (Fase C)**:
     - Módulo superior **Programmer**: Teclado numérico 4x3 (0..9, Up, Down), botones de comando con LED (Snapshot, Play / Compare, 10s Hold con LED ámbar, Store rojo) y selección rápida Sound 1..4.
     - **Cápsula ovalada con display VFD/LCD**: Marco metálico con matriz de puntos verde fosfórico sobre negro, flanqueado por encoder izquierdo y push-encoder rotatorio derecho (Push O.K.).
     - **Botonera de sistema inferior**: SetUp, Controllers, Copy / Paste, Load / Dump, Basic Settings, Exit / Panic (rojo).
     - Visor emulador de las 33 pantallas clásicas del hardware/NeuronVS y menús del sistema.
     - Monitor en vivo de telemetría de parámetros (nombre legible, valor físico en Hz/dB/ms, CC/NRPN 14-bit y SysEx).
     - Visualizador continuo de automatizaciones vectoriales grabadas con REC y reproducción dinámica de trayectorias en PLAY.
     - Construido sobre los componentes LcdDisplay / LcdScreen / LcdPanel / lcd.css de ABDShared.
   - **Vista Especial de Interpretación Macro («Remote / Nuke») & Soporte USB Opcional (Fase C)**:
     - Modal o vista contextual orientada a directo y performance rápida emulando la interfaz Remote del Neuron VS: chasis en diamante de aluminio, joystick vectorial central con halo naranja, 4 macro knobs (Knob1..4Select [425..428]) asignables a cualquier parámetro con displays LCD, y los 6 slots de modulación en vivo (Aftertouch, CC 1, CC 2, CC 3, CC 4, CC 11) con destino y ruedas de profundidad [-64..+63].
     - Estudio de detección Plug & Play en ABDShared::HardwareDrivers para el controlador físico USB <NUKE> original de Hartmann Music, con la regla inquebrantable de **cero dependencia** (100 % autónomo en software).
   - **[IMPLEMENTADO EN FASE A.4] 5º Joystick Vectorial Dedicado para Silver**:
     - Incorporado en SilverPanel.ts mediante TrajectoryStick2D con 3 capas (FILT, FREQ, TIME), lectura homogénea X: 0.xx | Y: 0.yy alineada con Scape y Sphere, y grabación/reproducción vectorial autónoma.
   - **Displays LCD Polares, Blender de Rueda Horizontal & 8 Faders Híbridos de Shaper (Fase C)**:
     - Recreación en cada Resynator de los 4 displays alfanuméricos verdes en los vértices del stick (North-West, North-East, South-West, South-East) mostrando valor en tiempo real `000..127` y etiqueta dinámica de parámetro de `mnAN` (`Coherent`, `OrangeWs`, `WhiteNoi`, `Smooth`, etc.).
     - Recreación del Blender central con diseño hardware: módulo metálico con rueda horizontal dentada superior, display acrílico con barra LED graduada amarilla horizontal bipolar (`< [||||||    ] >`) y botón `Type / Menu` para los 10 algoritmos de mezcla.
     - Recreación de los 8 faders de rueda con escala luminosa graduada de LEDs amarillos y selector triple `Shaper 1/2 Select`:
       - Modo `Amplifier`: Shaper 1 Amp ADSR (`A, D, S, R`) y Shaper 2 Amp ADSR (`A, D, S, R`).
       - Modo `Stick Levels`: ADSR de modulación de parámetros para la capa activa.
       - Modo `Free`: 2x ADSR libres independientes, o envolvente unificada `4L4T` (Niveles 1..4 y Tiempos 1..4 mapeados a lo largo de los 8 faders).
   - **[IMPLEMENTADO EN FASE A.4] Paneles de Interpretación, Silver y Master Output Unificados sobre el Teclado**:
     - **Reorganización Arquitectónica del Canvas**:
       - Separación de `ControllersPanel`, `SilverPanel` y `MasterOutputPanel` fuera de las columnas de los resonadores.
       - Disposición en fila dedicada (`.bottom-controllers-row`) ubicada **justo encima del teclado virtual**.
       - Resonadores 1 y 2 desacoplados y simétricos arriba (`.resynators-row`), seguidos del rack central (Blender/Slicer/Filter + Shapers 1, 2 y 3).
     - **Unificación Estética y Filosofía DRY**:
       - Eliminación de la caja/borde cuadrada que englobaba el joystick en `ControllersPanel` y `SilverPanel` mediante `className: 'borderless'`, logrando apariencia idéntica a los joysticks superiores de Scape y Sphere.
       - Estandarización de cabeceras en todas las tarjetas de la aplicación utilizando la clase `.stick-label` para títulos y `.panel-actions` para acciones, eliminando estilos ad-hoc y badges LED innecesarios.
       - Sincronización exacta de alturas entre los 3 paneles inferiores mediante grid CSS con `align-items: stretch`.
       - Eliminación definitiva del conflicto de barras de desplazamiento vertical («scrolls van a la suya») al remover `overflow-y: auto` de `.resynator-column` y consolidar un único scroll fluido en `.workspace-canvas`.
