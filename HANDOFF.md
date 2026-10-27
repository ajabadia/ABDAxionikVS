# ABDAxionikVS — Documento de Relevo Técnico (`HANDOFF.md`)

> **Proyecto:** `ABDAxionikVS` (`D:\desarrollos\ABDSynths\ABDAxionikVS`)
> **Repositorio GitHub:** `https://github.com/ajabadia/ABDAxionikVS.git`
> **Familia:** `ABDSynths` (`D:\desarrollos\ABDSynths`)
> **Estado Actual:** **Fase 0 (Cimientos, Contratos y Esqueleto Dual) Completada al 100%** — Los binarios nativos (`Standalone`, `VST3`, `WebPilotHost`) compilan sin errores, la suite de tests de contratos pasa 5/5, la WebUI empaquetada con Vite tiene paridad estética con `ABDNeuModMakr`, y estamos listos para arrancar la **Fase A.1** (`snddat`/`params`, traductor `FUN_10040550` y carga de modelos/presets de `NeuronDB`).

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
   - Define las Fases `0`, `A.1`, `A.2`, `A.3`, `A.4` (con adaptación y mejora moderna del UI), el **Gate de Diseño A → B** (discusión obligatoria con el usuario antes de abordar la Fase B) y la **Fase B (`NEURONiK`)**.

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
   - Al concluir la Fase A (`Neuron Clásico 1:1`), **detenerse y acordar con el usuario** el diseño detallado de la Fase B (`NEURONiK` + `.nmmodel v2.1`).

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
   - **Capa de Abstracción de Parámetros Unificada sobre el Motor DSP**:
     - Las entradas de control (WebUI PARAM_SET, MIDI CCs, desempacador NRPN de 14 bits y automatización VST3) entran exclusivamente por la capa de abstracción AxionikProcessor::setParameterByIndex / setParameterNormalizedByIndex (APVTS), notificando formalmente al Host DAW (setValueNotifyingHost).
     - El motor DSP (DspEngineFacade) opera estrictamente por debajo, aislado del transporte, la UI y el protocolo de control externo, recibiendo actualizaciones mediante listeners de estado y estructuras planas.
   - **Enrutamiento MIDI Canónico y NRPN de 14 bits**:
     - PluginProcessor::handleMidiEvent: Enrutador de CCs de hardware para Sticks XY (CC 16..19, 35..37), Blender (CC 70), Filter Reso (CC 71), Filter Cutoff (CC 74) y los 6 controles en tiempo real del Neuron (CC 1, 2, 3, 4, 11 y Channel Pressure).
     - Desempacador NRPN de 14 bits (CC 99/98/6/38) direccionando 1:1 los 445 parámetros autoritativos de snddat a través de la capa de abstracción DspEngineFacade::setParamNormalized.
   - **Grabador de Trayectorias Vectoriales y Etiquetas mnAN (10 Parameter Sets)**:
     - Dotado a TrajectoryStick2D de grabador y reproductor de bucle de trayectorias vectoriales (REC / PLAY / CLEAR) con estela SVG reactiva.
     - Conectadas las etiquetas dinámicas de los polos cardinales a partir de los 10 Parameter Sets canónicos (schemas/parameter_sets_mnan.json vía ParameterSets.ts).
   - **Controles Universales en ABDShared y Envolvente 4L4T**:
     - Migrado TrajectoryStick2D a ABDShared/Components/trajectoryStick2D.js y exportado en @abdsynths/shared/components.
     - Creado MultiStageShaperPad en ABDShared/Components/multiStageShaperPad.js (4L4T con modos Normal/Repeat y niveles bipolares) e integrado en ResynatorDrawer.ts para los shapers [242..253].
     - Estandarizados los sliders con la clase .abd-slider consumiendo tokens de ABDShared/Assets/styles.
   - **Frontend WebUI & Ecosistema UI**:
     - Drawer deslizante universal (`DrawerManager`): panel lateral desde la derecha ocupando el 50% de la pantalla (`50vw`, `min-width: 460px`), unificado para Banco (`BankDrawer`), Resynator 1/2 expandidos (`ResynatorDrawer`), Silver & Master FX Rack (`SilverDrawer`), Matriz de Modulación 6x5 y Master FX.
     - Controladores vectoriales 2D (`TrajectoryStick2D`): emulación de alta precisión de los sticks físicos del Neuron/Nuke con restricción circular física, selección de capas `L1`, `L2`, `L3`, polos cardinales, lectura de coordenadas y cableado bidireccional a los 24 parámetros de capa.
     - Controles centrales: Blender lineal R1/R2, Cutoff y Resonancia del filtro de Silver Rack, y conmutación cíclica rápida de algoritmos FreqFX y TimeFX.
     - Gestor de Bancos (`BankDrawer`): estilos canónicos (`catalog-browser.css`), iconos `param0`..`param9`, selector de carpeta de librería con persistencia en `localStorage` y escaneo recursivo.
     - Teclado de interpretación (`KeyboardStrip`): integrado con `@abdsynths/midi-keyb`, ruedas activas de Pitch Bend y Modulación (`bender.png`), botones de octava con LEDs, Panic, Hold, Retrig y Sustain.
     - Barra de navegación (`AxionikNavbar`): integrado con `createSynthNavBar`, cambio de temas (`ms2000`, `audiolab`, `cz101`, etc.), zoom y lectura en vivo de telemetría.
   - **Trazas y Diagnóstico**:
     - `AppLogger.h`: registro a fichero `ABDAxionikVS.log` junto al ejecutable.

3. **Siguiente Paso Inmediato**:
   - Compilación nativa de verificación con `build.bat` (a ejecutar por el usuario).
   - Verificación de audio en tiempo real y carga de presets `.sound` / modelos `.model`.
   - Implementación visual de los pads de envolventes multinivel (`MultiStageShaperPad`) y generador de trayectorias automáticas (LFO / Record de stick).

4. **Backlog a Largo Plazo Registrado (Post-Fase B)**:
   - **Pantalla LCD Superior Fija y Monitor de Telemetría (Fase C)**:
     - Pantalla panorámica horizontal fija en la cabecera (patrón `Sticky Top Hero Bar` de `ABDMS2000`).
     - Visor emulador de las 33 sub-páginas/pantallas del hardware original y menús del sistema.
     - Monitor en vivo de interacción del usuario: nombre legible del parámetro activo, valores en dominio físico (Hz, dB, ms, etc.), código CC asignado, número NRPN de 14 bits (`0..444`) y trama SysEx.
     - Visualizador continuo de automatizaciones vectoriales grabadas con `REC` y reproducción dinámica de trayectorias en `PLAY`.
     - Construido sobre los componentes `LcdDisplay` / `LcdScreen` / `LcdPanel` / `lcd.css` de `ABDShared`.
