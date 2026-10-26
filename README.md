# ABDAxionikVS

> **Recreación moderna, fiel y extensible del sintetizador Hartmann Neuron / NeuronVS para el ecosistema ABDSynths.**
> **Repositorio GitHub:** [`https://github.com/ajabadia/ABDAxionikVS.git`](https://github.com/ajabadia/ABDAxionikVS.git)

---

## Descripción General

**ABDAxionikVS** es un sintetizador virtual híbrido (**JUCE 9** `VST3` + `Standalone`, motor DSP en **C++20 puro** libre de dependencias JUCE, **WebAssembly `AudioWorklet`** con paridad bit-exacta y frontend **WebView2** empaquetado con Vite) que recrea el motor completo de resíntesis neuronal adaptativa del **Hartmann Neuron / NeuronVS** y lo integra en la suite [`ABDSynths`](file:///d:/desarrollos/ABDSynths):

- **Compatibilidad 100 % con `NeuronDB`**: Carga directa de los 512 modelos originales (`Models/<NNN>.model`: `MName`, `map.script` de 1.027 líneas, excitación `.scape` y banco espectral/formántico `.sphere`) y de los presets originales (`Sounds/<NNN>.sound`: `sound.script` de **445 parámetros** + trayectorias `sound.stickrec`).
- **Interfaz Adaptada y Mejorada**: Expone por primera vez de forma clara y simultánea **los 445 parámetros completos del motor** (incluyendo el bloque `Master FX` de Delay/Reverb, la matriz de 24 rutas `Free Controllers`, las 24 profundidades de envolvente `ResEnv` y el mapa de zonas de teclado de 128 notas), eliminando el laberinto de 33 sub-páginas de 2004.
- **Integración con [`ABDNeuModMakr`](file:///d:/desarrollos/ABDSynths/ABDNeuModMakr)** y evolución hacia **Fase B (`NEURONiK`)** con soporte para modelos `.nmmodel v2.1`.

---

## Documentación del Proyecto

- [`ROADMAP.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/ROADMAP.md): Informe arquitectónico completo y plan de implementación por fases (`Fase 0`, `Fase A.1..A.4`, `Gate A→B`, `Fase B`).
- [`HANDOFF.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/HANDOFF.md): Estado vivo del proyecto, invariantes técnicas y rutas de bancos/oráculos.
- [`CHANGELOG.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/CHANGELOG.md): Registro cronológico de hitos y cambios.
- [`DOCS/UI_INVENTORY_AND_ADAPTATION.md`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/UI_INVENTORY_AND_ADAPTATION.md): Inventario exhaustivo de todas las pantallas, controles, campos, selectores y opciones de los 445 parámetros del Neuron / NeuronVS y su adaptación UX.
- [`DOCS/reverse_engineering/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/reverse_engineering/README.md): Corpus técnico completo de ingeniería inversa (`dsp`, `preset_format`, `neurondb`, `layout`, `bitmaps`, `filmstrip`, `vst2`, `classes`, `resolved`, `port`).
- [`DOCS/manuals/`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/DOCS/manuals): Manuales oficiales completos de `NeuronVS` y de la consola hardware `Hartmann Neuron`.

---

## Scripts de Construcción y Ejecución (Próximamente en Fase 0)

- **`build.bat [nopause] [tests] [nowasm] [noselftest]`**: Pipeline integral con volcado automático a `build-last-run.log`.
- **`start.bat [webui|browser|selftest]`**: Lanzador de bancada WebView2, modo navegador `AudioWorklet` y selftest E2E.
