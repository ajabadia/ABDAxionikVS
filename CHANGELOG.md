# Changelog — ABDAxionikVS

Todos los cambios relevantes de este proyecto se documentan en este archivo siguiendo el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [Unreleased]

### Added
- **Capa de Abstracción de Parámetros Unificada sobre el Motor DSP**:
  - Centralizado en [`AxionikProcessor::setParameterByIndex`](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/Source/PluginProcessor.cpp) y [`AxionikProcessor::setParameterNormalizedByIndex`](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/Source/PluginProcessor.cpp) el punto único de entrada para todas las fuentes de control (WebUI, MIDI CCs, desempacador NRPN de 14 bits y host DAW).
  - Las modificaciones de parámetros notifican formalmente al Host (`p->setValueNotifyingHost`) para soporte completo de grabación y automatización en DAWs VST3.
  - El motor DSP ([`DspEngineFacade`](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/Source/Dsp/DspEngineFacade.h)) permanece estrictamente desacoplado como receptor inferior de tiempo real, sincronizado mediante los listeners de APVTS y sin acoplamiento a WebView2 o controladores externos.
- **Grabador de Trayectorias Vectoriales y Etiquetas Dinámicas mnAN de los 10 Parameter Sets**:
  - Incorporado en `TrajectoryStick2D` el grabador de movimiento vectorial (`REC`, `PLAY`, `CLEAR`) con estela visual SVG interactiva y bucle de reproducción a tiempo real hacia el motor DSP.
  - Implementado [`ParameterSets.ts`](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/ParameterSets.ts) mapeando los 10 Parameter Sets oficiales del Hartmann Neuron (`0: Neutral` .. `9: Extravaganza`) a los 4 polos cardinales (North, East, South, West) para las 3 capas L1, L2, L3 en Scape y Sphere.
  - Conectada la asignación y selección de modelos en `BankDrawer` y `main.ts` para refrescar instantáneamente las etiquetas físicas del joystick al conmutar de modelo o de capa.
- **Extracción de Controles Transversales a `ABDShared` y Nuevo `MultiStageShaperPad` (4L4T)**:
  - Migrado el controlador joystick circular 2D `TrajectoryStick2D` a [`ABDShared/Components/trajectoryStick2D.js`](file:///D:/desarrollos/ABDSynths/ABDShared/Components/trajectoryStick2D.js) y exportado en `@abdsynths/shared/components` para su uso transversal en toda la suite (sintetizadores vectoriales, wavestation, Prophet VS).
  - Implementado en `ABDShared` el componente [`MultiStageShaperPad`](file:///D:/desarrollos/ABDSynths/ABDShared/Components/multiStageShaperPad.js): modelador interactivo de envolventes multinivel 4L4T (4 Niveles / 4 Tiempos, modos Normal/Repeat, soporte bipolar $-1.0..+1.0$) exportado en `@abdsynths/shared/components`.
  - Integrado `MultiStageShaperPad` en [`ResynatorDrawer.ts`](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/ResynatorDrawer.ts) para el control en tiempo real de los shapers 4L4T del Hartmann Neuron (`FreeEnvLevel1..4 [242..245]`, `FreeEnvTime1..4 [246..249]` y `Shaper12Status [253]`).
  - Unificados los sliders con la clase `.abd-slider` y tokens de `@abdsynths/shared/styles/tokens.css`.
- **Enrutamiento MIDI Canónico: Sticks CCs y Desempacador NRPN de 14 bits**:
  - Ampliado [`MidiMapping.gen.h`](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/Source/Generated/MidiMapping.gen.h) en [`Scripts/registry_generator.js`](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/Scripts/registry_generator.js) con las constantes canónicas de hardware de Sticks (`CC 16..19, 35..37`), Blender (`CC 70`), Filter Reso (`CC 71`) y Filter Cutoff (`CC 74`).
  - Implementado en [`PluginProcessor::handleMidiEvent`](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/Source/PluginProcessor.cpp) el enrutador de CCs de Sticks hacia los 24 parámetros de capa del DSP.
  - Implementado el parser de **NRPN de 14 bits** (`CC 99 MSB`, `CC 98 LSB`, `CC 6 Data MSB`, `CC 38 Data LSB`) direccionando de forma biyectiva los 445 parámetros autoritativos de `snddat` (`0..444`) directamente a `DspEngineFacade::setParamNormalized`.
- **Controladores Vectoriales 2D y Paneles Deslizantes Expandidos en WebUI**:
  - Implementado `TrajectoryStick2D` ([TrajectoryStick2D.ts](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/TrajectoryStick2D.ts)): joystick circular 2D de alta precisión con restricción de radio físico, selector interactivo de capas `L1 | L2 | L3`, polos cardinales dinámicos, captura de puntero, doble-clic para centrar y lectura numérica $X, Y$.
  - Montados los 4 controladores vectoriales principales (`Scape 1`, `Sphere 1`, `Scape 2`, `Sphere 2`) en el canvas del sintetizador con enlace directo a los 24 parámetros VST correspondientes vía `WebBridge.setParam`.
  - Implementado `ResynatorDrawer` ([ResynatorDrawer.ts](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/ResynatorDrawer.ts)): panel deslizante 50vw para edición en profundidad de Resynator 1 y 2 (selector de los 7 algoritmos Parset `FUN_10031d30`, afinación de octava/semitonos/cents, capas de excitación L1..L3 y envolvente ADSR).
  - Implementado `SilverDrawer` ([SilverDrawer.ts](file:///D:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/SilverDrawer.ts)): panel deslizante 50vw para la edición completa del Silver Rack (filtro multimodo LP24/LP12/BP/HP/Notch con Drive analógico, 9 algoritmos de FreqFX y 7 de TimeFX con conmutadores individuales de activación).
  - Cableados en la interfaz central los controles del Blender, Cutoff y Resonancia del filtro, botones cíclicos de FreqFX/TimeFX y sincronización bidireccional de parámetros por telemetría `PARAM_UPDATE`.
- **Síntesis Multicapa por Resonador (3 Capas: L1, L2, L3) y Parsets en DSP Core**:
  - Implementado `ResynatorLayer` en `NeuronOscillators.h` combinando `CurveReader` (Scape, `FUN_100317b0`) y `BandReader` (Sphere, `FUN_10031950`) con coordenadas dinámicas 2D, nivel y desafinación analógica.
  - Implementado `CResynator` (`0x6838` bytes, `FUN_1002e7a0`) orquestando las 3 capas canónicas (`L1`, `L2`, `L3`) para R1 y R2.
  - Implementado el despachador de los 7 algoritmos de síntesis Parset (`FUN_10031d30`):
    - Parset 0: Mezcla aditiva ponderada y formantes (`CParsetEngine0` / `FUN_10025380`).
    - Parset 1: Modulación cruzada de fase FM (`CParsetEngine1` / `FUN_10023990`).
    - Parset 2: Inclinación espectral armónica *Harmonic Tilt* (`CParsetEngine2` / `FUN_10032660`).
    - Parset 3: Desplazamiento de picos resonantes (`CParsetEngine3` / `FUN_10023df0`).
    - Parset 4: Saturación no-lineal multibanda (`CParsetEngine4` / `FUN_10032260`).
    - Parset 5: Modulación en anillo *Double Sideband* (`CParsetEngine5` / `FUN_10024530`).
    - Parset 6: Dispersión espacial y entrelazado espectral (`CParsetEngine6` / `FUN_10031e70`).
- **Silver Rack y Efectos Maestros (`NeuronSilverRack.h`)**:
  - Implementado `SilverFilter` (`FUN_10042a30` / `FUN_100330f0`): filtro de estado variable multimodo (LP12/24, BP, HP, Notch) con saturación analógica previa (*Drive*).
  - Implementado `SilverFreqFX`: los 9 algoritmos de modulación espectral (FreqShift, RingMod, Distortion, Decimator, Formant, Comb, Resonator, Treemonster).
  - Implementado `SilverTimeFX`: los 7 algoritmos de modulación temporal (Chorus, Flanger, Phaser, Delay, Multi-Tap, Reverb) con la corrección `Reset()` de Stephan Bernsee (Mac 1.56) para evitar estallidos de ruido.
  - Implementados `CMasterModFX` (apertura estéreo M/S, `FUN_1003d6f0`) y `CMasterTimeFX` (reverberación espacial, `FUN_1003bd10`) integrados en el bombeo de 128 muestras (`NeuronBlockPump.h`).
- **Cableado Completo de Parámetros en `DspEngineFacade.cpp`**:
  - Conectados los 24 parámetros de oscilador VST (`R1L1..R1L3`, `R2L1..R2L3`), algoritmos Parset, afinación y volúmenes a las voces activas.
  - Conectadas las envolventes ADSR de amplitud y filtro, el crossfade Blender y los controles del Silver Rack.
- **Drawer Deslizante Universal (`DrawerManager`) y Gestor de Bancos (`BankDrawer`)**:
  - Panel deslizante lateral desde la derecha ocupando el 50% de la pantalla (`50vw`, `min-width: 460px`), unificado para Banco, Matriz de Modulación 6x5 y Master FX.
  - Estilos canónicos integrados con `catalog-browser.css`, badges, chips de categorías y los iconos `param0`..`param9`.
  - Selector de carpeta de librería NeuronDB con persistencia en `localStorage` y escaneo recursivo de `<NNN>.model`, `sound.script` y `SoundNames`.
- **Teclado Canónico de Interpretación (`KeyboardStrip`)**:
  - Integrado `@abdsynths/midi-keyb` (`createKeyboard`) con ruedas activas de Pitch Bend y Modulación (`bender.png`).
  - Botones de octava con LEDs, Panic / All Notes Off, Hold, Retrig y Sustain operativos.
- **Trazas y Diagnóstico de Ejecución (`AppLogger.h`)**:
  - Logger nativo a fichero local `ABDAxionikVS.log` junto al ejecutable para diagnóstico de arranque y carga de WebView2.
- **Auditoría e Ingeniería Inversa Centralizada (`DOCS/`)**:
  - Copiado y organizado en [`DOCS/reverse_engineering/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/README.md) todo el estudio verificable de `NeuronVS.dll` (`dsp`, `preset_format`, `neurondb`, `layout`, `bitmaps`, `filmstrip`, `vst2`, `classes`, `resolved`, `port`) y en [`DOCS/manuals/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/manuals) los manuales oficiales de `NeuronVS` y `Hartmann Neuron Hardware` en UTF-8 limpio (`92` archivos en total).
  - Creado [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md) con el catálogo módulo a módulo de los **445 parámetros**, las 10 vistas / 33 sub-páginas originales, los 10 `Parameter Sets` (`mnAN`/`fdAN`), las tablas de algoritmos (`Blender`, `Silver Filter`, `FreqFX`, `TimeFX`, `Master FX`, `Free Controllers`) y la propuesta de adaptación y mejora UX.
- **Documentación Raíz del Proyecto**:
  - Creados [`ROADMAP.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/ROADMAP.md), [`HANDOFF.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/HANDOFF.md), [`README.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/README.md) y [`CHANGELOG.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/CHANGELOG.md), fijando el repositorio `https://github.com/ajabadia/ABDAxionikVS.git` y el **Gate de Diseño A → B** antes de la Fase B.
