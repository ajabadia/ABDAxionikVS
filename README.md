# ABDAxionikVS

> **Recreación moderna, fiel y extensible del sintetizador Hartmann Neuron / NeuronVS para el ecosistema ABDSynths.**
> **Repositorio GitHub:** [`https://github.com/ajabadia/ABDAxionikVS.git`](https://github.com/ajabadia/ABDAxionikVS.git)

---

## Descripción General

**ABDAxionikVS** es un sintetizador virtual híbrido (**JUCE 9** `VST3` + `Standalone` + `WebPilot Host`, motor DSP en **C++20 puro** libre de dependencias JUCE, **WebAssembly `AudioWorklet`** y frontend **WebView2** empaquetado con Vite) que recrea bit a bit el motor completo de resíntesis neuronal adaptativa del **Hartmann Neuron / NeuronVS** y lo integra en la suite [`ABDSynths`](file:///d:/desarrollos/ABDSynths):

- **Compatibilidad 100 % con `NeuronDB` (341 Modelos Activos y 398 Presets + Motor Transparente `NeuronDbMapper`)**: Carga directa de los modelos originales (`Models/<NNN>.model`: `MName`, `map.script` de 1.027 líneas, excitación `.scape` de 16 bits / one-shot y banco espectral/formántico `.sphere` con el cuerpo aditivo de 1.024 parciales `SphereBodyTable`) y de los **398 presets oficiales** (`354` de NeuronVS + `44` exclusivos del *Hardware Soundset V4* con las 19 categorías oficiales, ajustes `SoundMFX* [430..444]` restaurados y 103 trayectorias vectoriales `sound.stickrec`). Incluye en `@abdsynths/shared/formats/neuron` el motor relacional automático **`NeuronDbMapper`** (inspirado en *BrainMapper v1.2.0*), que evalúa en segundo plano las dependencias cruzadas `Model <-> Sound` (`R1` y `R2`), oculta ranuras vacías `--<empty>--` y protege los modelos en uso y `#511 sinew`.
- **Motor DSP y Efectos Desacoplados en `ABDShared`**:
  - [`ABDShared::DspCore`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspCore): Síntesis multicapa en `DspCore/NeuronVS/` (`NeuronBlockPump.h`, `NeuronVoicePool.h`, `NeuronVoice.h`, `NeuronOscillators.h` con los 7 algoritmos Parset `FUN_10031d30` y los 10 modos de Blender `FUN_1002e7a0`, `NeuronModel.h`) y envolvente analógica canónica [`DspNeuronEnvelope.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspCore/DspNeuronEnvelope.h) (`CShaper4T4L`).
  - [`ABDShared::DspEffects`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects): [`DspNeuronSilverFilter.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects/DspNeuronSilverFilter.h) (5 curvas con tablas LUT de 8192 entradas), [`DspNeuronSilverRack.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects/DspNeuronSilverRack.h) (12 tablas LFO, 5 `FreqFX` incluyendo EQ de 4 bandas + Compresor y 5 `TimeFX`) y [`DspNeuronMasterFX.h`](file:///d:/desarrollos/ABDSynths/ABDShared/Code/DspEffects/DspNeuronMasterFX.h) (`DspNeuronGlobalSlicer` 2D/3D, `DspNeuronMasterOutputStage` y `DspNeuronMasterTimeFX` con Stereo Delay y Reverb híbrida de 5 salas).
- **Interfaz Canónica en Rejilla de 6 Unidades + Controlador Deslizable `<NUKE>` (445 Parámetros Sin Sub-Páginas Ocultas)**:
  - **Fila 1 (`2u + 2u + 2u`)**: `Resynator 1` (`Scape 1` + `Sphere 1`), `Resynator 2` (`Scape 2` + `Sphere 2`) y `SilverPanel` (`Vector 2D`, `FreqFX`, `TimeFX` y 4ª columna de `Slicer`).
  - **Fila 2 (`2u + 2u + 2u`)**: `Shaper 1 (R1)`, `Shaper 2 (R2)` y `Shaper 3 (Silver & Master EFX)` con ruedas `Wheel`, escalas `LedLadder` y conmutación reactiva `AMP / RES / FREE`.
  - **Fila 3 (12 sub-unidades: `4/12 + 1/12 + 5/12 + 1/12 + 1/12`)**: `ControllersPanel` (`4/12`: `Control 1` stick + `Control 2/3` wheels), `FilterPanel` (`1/12`: `Cutoff / Reso` + curvas), `BlenderPanel` (`5/12`: rejilla `2×5` de 10 algoritmos de fusión + crossfade bipolar + 4 knobs de modulación), `EnvelopeMasterPanel` (`1/12`: `ENV MASTER` con 4 knobs en `2×2` conectados a `EnvelopeDrawer`) y `MasterOutputPanel` (`1/12`: `RotaryLedKnob` + VU meter).
  - **Vista Deslizable Superior `<NUKE> Remote Control Unit` (`NukeDrawer.ts`)**: Cajón superior (`90vw`) que permite tocar el teclado MIDI en todo momento, con joystick central de `212×212px` (`variant: 'nuke-orb'`), 4 Macro Knobs sobre selectores compactos (`[425..428]`), `Voice Limit [5]` y consola de 6 controladores (`[413..424]`).
  - **9 Cajones Laterales Deslizantes (`50vw`)**: `ResynatorDrawer`, `BlenderDrawer`, `EffectsDrawer` (`Silver` + `Master FX`), `EnvelopeDrawer`, `MatrixDrawer` (63 destinos + `Free Controllers 6×4`), `MidiLearnDrawer` ($N:M$), `HardwareDumpsDrawer` (`SysEx` 7-bit Hartmann `00 20 50 01` + `LiveSysExInspector`), `CalibrationDrawer` (43 Magic Numbers DSP con importación/exportación JSON) y `BankDrawer` + `SettingsDrawer`.
  - **Colapso Sincronizado por Fila**: botón chevron (`▾` / `▴`) en cabecera que pliega o despliega toda la fila simultáneamente.
- **Modo WebAssembly (`AudioWorklet`) Integrado**: El motor C++20 compila directamente a `abdaxionikvs_dsp.wasm` mediante Emscripten (`wasm/build_wasm.bat`, integrado en `build.bat`) y produce sonido en tiempo real en el navegador a través de `axionikWorklet.js` y `BridgeWasm.ts`, con generación sintética en memoria de modelos `.scape`/`.sphere` cuando no existe sistema de archivos local.
- **Arquitectura de 3 Variantes (`CLASSIC`, `PLUS`, `EXPANDED` — Patrón `ABDJUNiO601`), Resynator v2 (`AxionikExpandedSynthesizer`) y Gestor Dual de Bancos (`AxionikDB` + `NeuronDB`)**:
  - **Tres perfiles de compilación y ejecución (`AXIONIK_TARGET_MODEL` `0=CLASSIC`, `1=PLUS`, `2=EXPANDED` en `CMakeLists.txt` y `build_all_models.bat`)**: compilación por defecto en la variante superior (`EXPANDED`) con selector en vivo en la cabecera (`CLASSIC | PLUS | EXPANDED`) que permite bajar en caliente a `PLUS` o `CLASSIC` (mientras que las compilaciones `CLASSIC` y `PLUS` bloquean modos superiores y ocultan el selector).
  - **Fase B Completada (`Source/DSP/Extended/AxionikExpandedModel.h` + `AxionikExpandedSynthesizer.h`)**: consumo nativo C++20 RT-safe del contrato [`05_extended_model/axionik-expanded.json`](file:///d:/desarrollos/ABDSynths/ABDShared/Contracts/axionikExpandedModel.ts) (`axionikExpandedModel` v2.0.0) generado por [`ABDNeuModMakr`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr), incluyendo **Superficie Espectral Continua Unificada (`unifiedSurface`: `melodic_surface` y `drum_kit_surface`)**, sincronización elástica de tempo (`tempoSync`), diccionario multimuestra `spectralBySample`, empalme de transitorio híbrido PCM (`hybridTransient`), parciales con ancho de banda Loris (`bandwidths[]`), residuo estocástico DDSP en 24 bandas Bark (`residualBandsDb[]`), preservación/desplazamiento formántico 24-Bark (`formantEnvelopeDb[]`), moldeadores físicos (`AxionikResonatorShapers`) y salida espacial dual (**Quad `4.0` discreto** en hosts multicanal o **Pseudo-Surround estéreo** en buses `2.0`/WASM).
  - **Gestor de Bancos Dual (`BankDrawer.ts` + `@abdsynths/shared/components/bank`) y Compatibilidad Mixta v1/v2 en Modo `EXPANDED`**: en `CLASSIC`/`PLUS` muestra `MODELS (000-511)` (`NeuronDB`) y `SOUND PRESETS`; en `EXPANDED` habilita simultáneamente las 3 pestañas (`AXIONIKDB (V2)`, `MODELS (000-511)` y `SOUND PRESETS`) con selectores independientes de carpeta para `AxionikDB` y `NeuronDB`, permitiendo combinar libremente un modelo v2 en `R1` y un `.model` clásico v1 en `R2` (o viceversa) sin doble disparo de voz.

---

## Documentación del Proyecto

- [`ROADMAP.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/ROADMAP.md): Informe arquitectónico completo y plan de implementación por fases (`Fase 0`, `Fase A.1..A.4`, `Fase B`, `Fase C`, `Fase D`, `Fase E`, `Fase F`, `Fase G`, `Fase H`, `Fase I`, `Fase J`).
- [`HANDOFF.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/HANDOFF.md): Estado vivo del proyecto, invariantes técnicas y rutas de bancos/oráculos.
- [`CHANGELOG.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/CHANGELOG.md): Registro cronológico de hitos y cambios.
- [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md): Inventario exhaustivo de todas las pantallas, controles, campos, selectores y opciones de los 445 parámetros del Neuron / NeuronVS y su adaptación UX.
- [`DOCS/DSP_MIGRATION_AND_FIXES.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/DSP_MIGRATION_AND_FIXES.md): Cierre de incógnitas de `params`, eliminación de `<Nuke>`, catálogo de los 10 bugs corregidos y disección del cierre de bloque.
- [`DOCS/reverse_engineering/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/README.md): Corpus técnico completo de ingeniería inversa (`dsp`, `preset_format`, `neurondb`, `observers`, `layout`, `bitmaps`, `filmstrip`, `vst2`, `classes`, `resolved`, `port`).
- [`DOCS/manuals/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/manuals): Manuales oficiales completos de `NeuronVS` y de la consola hardware `Hartmann Neuron`.

---

## Scripts de Construcción, Ejecución y Verificación

- **`build.bat [nopause]`**: Pipeline integral de 6 pasos (generador de contratos `Scripts/registry_generator.js`, suite Vitest, bundle Vite `WebUI/dist/`, compilación CMake/MSVC Release de `Standalone`, `VST3`, `WebPilot Host`, `DspEngineFacadeTests` y `GoldenParityTest`, y compilación WebAssembly `wasm/build_wasm.bat` hacia `WebUI/src/wasm/` y `WebUI/dist/`).
- **`build_all_models.bat`**: Compila las 3 variantes independientes de producto (`build_classic`, `build_plus`, `build_expanded`) siguiendo el estándar de [`ABDJUNiO601`](file:///d:/desarrollos/ABDSynths/ABDJUNiO601).
- **`wasm\build_wasm.bat`**: Compila exclusivamente el módulo DSP WebAssembly (`abdaxionikvs_dsp.js` + `abdaxionikvs_dsp.wasm`) con Emscripten y lo sincroniza en `WebUI/src/wasm/` y `WebUI/dist/`.
- **`run_standalone.bat`**: Lanza el ejecutable `Standalone` (`ABDAxionikVS.exe`) con directorio de datos WebView2 aislado por proceso.
- **`run_webpilot.bat`**: Lanza la bancada ligera `ABDAxionikVS WebPilot Host.exe`.
- **`run_golden_test.bat`**: Ejecuta el arnés de certificación [`Tests/GoldenParityTest.cpp`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Tests/GoldenParityTest.cpp) (paridad de audio contra vectores áureos de `NeuronVS.dll`, `--zones` 128/128 zonas de teclado y `--matrix` 63/63 destinos de modulación).
- **`pnpm test`**: Ejecuta la suite de tests unitarios y de contratos TypeScript/UI con Vitest.
