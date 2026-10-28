# Auditoría y Plan Exhaustivo de Mitigación — ABDAxionikVS

> **Documento Vivo de Seguimiento de Calidad y Refactorización**  
> **Ámbito:** Revisión en profundidad de arquitectura C++/JUCE, WebUI TypeScript/Vite, Build System, Tests y Paridad DSP con NeuronVS.  
> **Regla de oro sobre ABDShared:** Los componentes compartidos de `ABDShared` (`VoicePool`, `BlockRenderer`, `NeuronVoice`, `NeuronModel`, etc.) se mantienen centralizados por diseño de ecosistema. El objetivo es corregir el uso local, la integración y las interfaces, nunca duplicar ni prescindir de la librería compartida.  
> **Estado global:** EN PROGRESO — Seguimiento granular de tareas realizadas, discrepancias técnicas justificadas y pendientes sin sobrecargar `ROADMAP.md`.

---

## 📊 Panel de Control y Progreso

| Área | Total Puntos | Resueltos (`[x]`) | Discrepantes (`[D]`) | Parciales (`[~]`) | Pendientes (`[ ]`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Arquitectura General & Estructura** | 3 | 2 | 1 | 0 | 0 |
| **2. Motor DSP (`DspEngineFacade`)** | 11 | 11 | 0 | 0 | 0 |
| **3. Procesador del Plugin (`PluginProcessor`)** | 9 | 8 | 1 | 0 | 0 |
| **4. WebPilot Host & Herramientas Auxiliares** | 5 | 5 | 0 | 0 | 0 |
| **5. Frontend WebUI (`main.ts` & Componentes)** | 11 | 6 | 1 | 4 | 0 |
| **6. Puente de Comunicación (`WebBridge.ts`)** | 7 | 5 | 1 | 1 | 0 |
| **7. Sistema de Compilación & Dependencias** | 3 | 2 | 0 | 1 | 0 |
| **8. Suite de Pruebas & Paridad Bit-Exacta** | 4 | 4 | 0 | 0 | 0 |
| **9. Calidad de Código, Estilo & RE Hygiene** | 3 | 3 | 0 | 0 | 0 |
| **TOTAL** | **56** | **46** | **4** | **6** | **0** |

---

## 1. Arquitectura General y Estructura del Proyecto

- [x] **1.1. Gestión de dependencias externas y build reproducible:**
  - *Problema:* Dependencias externas a JUCE (`C:/JUCE`, `../ABDEep/JUCE`) y `ABDShared/Code` en rutas fijas fuera del repo sin variables configurables.
  - *Acción realizada:* `CMakeLists.txt` actualizado con soporte para variables de CMake y de entorno `JUCE_PATH`, `ABDSHARED_CODE_DIR` y `WEBVIEW2_PACKAGE_DIR`, con mensajes de diagnóstico y `FATAL_ERROR` descriptivos.
- [D] **1.2. Fronteras y contratos en la arquitectura híbrida:**
  - *Problema reportado:* Coexisten 4 entornos de compilación/ejecución (Plugin VST3/Standalone JUCE, WebPilot host E2E, WASM AudioWorklet y WebUI Vite).
  - *Justificación de Discrepancia:* La separación es intencional y fundamental por diseño. WASM y VST3 tienen runtimes y modelos de threading radicalmente distintos. La frontera se blinda al 100% mediante `DspSources.cmake` como single-source estricto y la regla de oro: Cero cabeceras de JUCE en `Source/DSP/`. El flujo de datos entre capas (DSP $\leftrightarrow$ Host $\leftrightarrow$ WebBridge $\leftrightarrow$ WebUI) está completamente desacoplado y protegido contra drift.
- [x] **1.3. Limpieza de directorios legacy o vacíos:**
  - *Acción realizada:* Eliminado el directorio `dsp/` residual de la raíz del repositorio.

---

## 2. Motor DSP (`Source/DSP/DspEngineFacade`)

- [x] **2.1. Volumen maestro hardcodeado (`masterVol = 0.85f`):**
  - *Acción realizada:* Reemplazado el hardcode local por el miembro `masterVolume_{0.85f}`, configurable mediante `setMasterVolume(float)` y consultable con `getMasterVolume() const noexcept`. Preserva la paridad de 0.85f por defecto.
- [x] **2.2. Telemetría sintética de CPU:**
  - *Acción realizada:* Sustituido el cálculo sintético (`0.015 * voces`) por medición temporal real con `std::chrono::steady_clock` entre inicio y fin de bloque, normalizada contra la duración teórica del bloque y suavizada mediante filtro IIR monopolo de 1er orden con cero asignaciones dinámicas.
- [x] **2.3. Ruta dual de parámetros (`bridge_->getEffectiveSlots()` vs `store_.getRawValue()`):**
  - *Acción realizada:* Encapsulada con los helpers privados `getSlotRaw` y `getSlotNorm` en `DspEngineFacade.h`, garantizando precedencia sistemática e invariable (bridge slots > store) y eliminando ternarios duplicados.
- [x] **2.4. Centralización de índices mágicos de parámetros:**
  - *Acción realizada:* Creado `Source/DSP/AxionikParamIndices.h` (`namespace abd::axionik::ParamIdx`) con todas las constantes simbólicas agrupadas por secciones (incluyendo la totalidad de los parámetros de Silver FreqFX, TimeFX y MasterFX) y migrado `DspEngineFacade.cpp`.
- [x] **2.5. Corrección de micro-rampa anti-pop (Sample-Accurate):**
  - *Acción realizada:* Implementado `applyAntiPop()` con cálculo sub-bloque exacto `fadeSamples = std::min(numSamples, antiPopRemaining_)`, decremento muestra a muestra y atenuación segura por canal independiente de punteros.
- [x] **2.6. Tabla de LFO global con tamaño desacoplado:**
  - *Acción realizada:* Sustituido el literal crudo `8192.0` por la constante simbólica `constexpr double kNeuronLfoTableSize = 8192.0;`.
- [x] **2.7. Protección contra desbordamiento en modulación de Pitch Bend:**
  - *Acción realizada:* Aplicado `std::clamp` estricto en semitonos `[-48.0f, +48.0f]` antes de la exponenciación `std::pow(2.0f, semitones / 12.0f)`.
- [x] **2.8. Normalización de sliders y respeto a la regla de los 3 dominios:**
  - *Acción realizada:* Validada la correspondencia canónica con `Conversion.gen.h` y creadas pruebas unitarias automáticas en TypeScript que comprueban round-trips de los 445 parámetros.
- [x] **2.9. Descomposición de la función monolítica `process()`:**
  - *Acción realizada:* Monolito descompuesto en 7 métodos especializados:
    1. `processVectorSticks(numSamples)`
    2. `updateModulationAndPitch(p, numSamples)`
    3. `updateResynatorLayers(p, globalLfoSignal)`
    4. `updateEnvelopes(p)`
    5. `updateSilverAndMasterFx(p, globalLfoSignal)`
    6. `applyAntiPop(leftChannel, rightChannel, numSamples)`
    7. `updatePeaksAndTelemetry(leftChannel, rightChannel, numSamples, instantLoad)`
    Reduciendo `process()` a 30 líneas de alta cohesión.
- [x] **2.10. Higiene de código de ingeniería inversa (RE Hygiene):**
  - *Acción realizada:* Identificadores internos crudos de desensamblado sustituidos por descripciones técnicas canónicas en inglés técnico.
- [x] **2.11. Inclusión explícita de `<algorithm>`:**
  - *Acción realizada:* Verificada e incluida la cabecera estándar `<algorithm>`.

---

## 3. Procesador del Plugin (`Source/PluginProcessor`)

- [x] **3.1. Máquina de estados MIDI NRPN completa y aislamiento:**
  - *Acción realizada:* Implementado soporte de reseteo formal ante `CC#121` (*Reset All Controllers*), aislamiento de canal MIDI para evitar que mensajes intercalados de distintos canales corrompan el desempacador, timeout de 500 ms ante secuencias truncadas y reseteo en `allNotesOff()`, `allSoundOff()` y `ProgramChange`.
- [x] **3.2. Sincronización masiva de parámetros y prevención de reentrancia (`syncApvtsFromDspEngine`):**
  - *Acción realizada:* `isSyncingPreset_` gobierna la supresión de reentrancia en `parameterChanged()`, drenado atómico bajo `uiParamMutex_` y carga íntegra de parámetros sin provocar tormentas de eventos.
- [x] **3.3. Atomicidad y memory ordering en flags de sincronización:**
  - *Acción realizada:* Convertido `isSyncingPreset_` a `std::atomic<bool>` con operaciones `memory_order_release` y `memory_order_acquire`.
- [x] **3.4. Sanitización defensiva en `setStateInformation`:**
  - *Acción realizada:* Añadida guarda `if (data == nullptr || sizeInBytes < 16) return;` con logging de diagnóstico ante estados vacíos o truncados.
- [x] **3.5. Validación y clamping en selección de bancos y programas:**
  - *Acción realizada:* Aplicado `std::clamp(slot, 0, kNumFactoryPresets - 1)` evitando accesos fuera de rango.
- [x] **3.6. Consistencia de `currentProgram_`:**
  - *Acción realizada:* `currentProgram_` se actualiza exclusivamente tras la confirmación exitosa de `loadPresetBySlot(slot)`.
- [D] **3.7. Método `changeProgramName()`:**
  - *Problema reportado:* Método no-op con `juce::ignoreUnused`.
  - *Justificación de Discrepancia:* En la arquitectura de Neuron / NeuronVS y ABDAxionikVS, los presets de fábrica (000..511) provienen de la base de datos inmutable de modelos y sonidos (`FactoryPresets.gen.h` / `NeuronDB`). Permitir la sobreescritura de sus nombres en la memoria de la factoría rompería la integridad referencial del catálogo. Los presets de usuario se guardan y cargan como scripts `.sound` independientes. El comportamiento no-op es intencional y canónico.
- [x] **3.8. Auditoría de logging en rutas de audio:**
  - *Acción realizada:* Verificado que `AX_LOG` no se invoca en el bucle crítico de audio (`processBlock`).
- [x] **3.9. Filtro de excepciones en Windows:**
  - *Acción realizada:* Verificado `SetUnhandledExceptionFilter(AxionikCrashFilter)` con volcado a log.

---

## 4. WebPilot Host y Herramientas Auxiliares

- [x] **4.1. Tiempo de auto-quit configurable en WebPilotHost:**
  - *Acción realizada:* Añadido soporte para `--auto-quit`, `--auto-quit=<ms>` y `--timeout=<ms>` en la línea de comandos de `WebPilotHost.cpp`.
- [x] **4.2. Manejo de fallos de inicialización de WebView2:**
  - *Acción realizada:* Bloque `try/catch` defensivo al instanciar `JuceWebView2Component` en `PluginEditor.cpp` y renderizado de texto informativo en `paint()` si el runtime no está instalado en la máquina.
- [x] **4.3. Silenciamiento de excepciones en `AppLogger`:**
  - *Acción realizada:* Añadida salida de error a `std::cerr` ante fallo de apertura de fichero o excepciones al escribir en `AppLogger.h`.
- [x] **4.4. Thread safety de `std::localtime` en `AppLogger`:**
  - *Acción realizada:* Protegido dentro de la sección crítica gobernada por el mutex estático del logger.
- [x] **4.5. Verificación de helpers en `Translator.h`:**
  - *Acción realizada:* Verificado C++20 standard y tamaño `kEngineStateSizeBytes = 0x367C`.

---

## 5. Frontend WebUI (`WebUI/src/main.ts` y Componentes)

- [~] **5.1. Modularización del monolito `main.ts`:**
  - *Estado:* Descompuesto en controladores de componentes dedicados (`Navbar`, `DrawerManager`, `BankDrawer`, `ResynatorDrawer`, `SilverDrawer`, `MasterFxDrawer`, `MatrixDrawer`, `SettingsDrawer`, `DragDropHandler`). Pendiente: extraer `AppBootstrap.ts` y `EventWiring.ts`.
- [~] **5.2. Encapsulación del estado global mutable:**
  - *Estado:* Parámetros y modelos centralizados en `WebBridge` y variables reactivas de sesión.
- [x] **5.3. Eliminación del acceso por corchetes a miembros privados:**
  - *Acción realizada:* Añadidos métodos públicos formales `toggleMatrix()`, `toggleMfx()` y `toggleBank()` en `AxionikNavbar` y llamados directamente sin corchetes.
- [x] **5.4. Eliminación de variables de depuración globales en producción:**
  - *Acción realizada:* `(window as any).__axionikSticks` condicionado bajo `if ((import.meta as any).env?.DEV)`.
- [x] **5.5. Centralización de índices mágicos en WebUI:**
  - *Acción realizada:* Creado `WebUI/src/constants/paramIndices.ts` (`PARAM_IDX as const`) y barrel `index.ts`.
- [~] **5.6. Eliminación de casts abusivos a `any` y tipado estricto:**
  - *Estado:* Tipado estricto introducido en `WebBridge.ts` con Discriminated Unions y en utilidades de conversión.
- [D] **5.7. Ciclo de vida y cleanup de `addEventListener` en `window`:**
  - *Problema reportado:* Listeners en `window` sin `removeEventListener`.
  - *Justificación de Discrepancia:* ABDAxionikVS WebUI se ejecuta como una vista integrada embebida en WebView2 (en VST3 o Standalone). Su ciclo de vida es idéntico al de la ventana del plugin: la página se carga una sola vez al abrir el editor y el proceso del motor WebView2 se destruye íntegramente al cerrar la ventana. No es una Single Page Application con navegación de rutas donde los componentes se monten y desmonten en el mismo DOM. Implementar desregistro masivo de listeners para el evento `unload` es redundante y no aporta beneficio de memoria.
- [x] **5.8. Eliminación de stubs engañosos de usuario:**
  - *Acción realizada:* Sustituido el `alert('Save Preset: Not implemented in preview.')` por logging no intrusivo en consola informando de la disponibilidad a través del gestor de librerías.
- [x] **5.9. Eliminación de scraping del DOM (`textContent` / `innerText`):**
  - *Acción realizada:* Incorporadas variables de estado estructurado `currentR1ModelName` y `currentR2ModelName` en `main.ts` utilizadas directamente al abrir los paneles de Resynator 1 y 2 sin consultar el DOM.
- [~] **5.10. Unificación de estilos CSS dinámicos:**
  - *Estado:* Estilos encapsulados en `style.css` y clases utilitarias.
- [x] **5.11. Limpieza de logs de depuración (`console.log`):**
  - *Acción realizada:* Logs de depuración del puente canalizados bajo `import.meta.env.DEV`.

---

## 6. Puente de Comunicación (`WebUI/src/bridge/WebBridge.ts`)

- [~] **6.1. Detección de pérdida de conexión y reconexión:**
  - *Estado:* Enlace bidireccional estable mediante `__JUCE__.backend` y `chrome.webview`.
- [x] **6.2. Estrategia de invalidación y actualización de `paramCache`:**
  - *Acción realizada:* Añadido método público `clearCache()` e invalidación ante eventos de recarga.
- [D] **6.3. Sincronización del mapa `uiState` con C++:**
  - *Problema reportado:* `uiState Map` es puramente local y no se sincroniza ni persiste con el host C++.
  - *Justificación de Discrepancia:* `uiState` está diseñado expresamente para estado visual transitorio y efímero (pestañas activas, acordeones abiertos, foco visual, zoom de la UI). El estado que debe persistir en el DAW o en los presets del sintetizador viaja única y exclusivamente por los 445 parámetros gobernados por APVTS / `SndDatStore`. Guardar el estado efímero de la UI en el host contaminaría el árbol de estado del preset.
- [x] **6.4. Política de actualización optimista vs confirmada en `setParam`:**
  - *Acción realizada:* `paramCache` se actualiza inmediatamente para fluidez de la UI y los eventos `PARAM_UPDATE` del backend confirman y corrigen cualquier clamping del host.
- [x] **6.5. Visibilidad en modo desarrollo sin backend:**
  - *Acción realizada:* Añadida traza `[WebBridge Dev OUT]` condicionada a `import.meta.env.DEV`.
- [x] **6.6. Tipado estricto con Discriminated Unions para mensajes del Bridge:**
  - *Acción realizada:* Definidas las uniones discriminadas `OutgoingBridgeMessage` e `IncomingBridgeMessage` tipando todas las acciones del protocolo.
- [x] **6.7. Comprobación de existencia de fichero puente redundante:**
  - *Acción realizada:* Verificado que sólo existe `WebBridge.ts`.

---

## 7. Sistema de Compilación y Configuración

- [x] **7.1. Flexibilidad en rutas de NuGet / WebView2 en CMake:**
  - *Acción realizada:* Añadida la variable `WEBVIEW2_PACKAGE_DIR` en CMakeLists.txt con fallbacks a variables de entorno.
- [~] **7.2. Clarificación de dependencias de workspace en `package.json`:**
  - *Estado:* Requisito de monorepo documentado.
- [x] **7.3. Protección anti-deriva con `DspSources.cmake`:**
  - *Acción realizada:* Regla estricta de cero cabeceras JUCE en `Source/DSP/` cumplida al 100%.

---

## 8. Suite de Pruebas y Paridad Bit-Exacta

- [x] **8.1. Eliminación de rutas externas a `Downloads` en `sound_format.test.ts`:**
  - *Acción realizada:* Modificado para resolver contra fixtures locales en el repositorio (`NeuronDB/Sounds/` o `tests/fixtures/`) sin saltarse aserciones.
- [x] **8.2. Portabilidad de `GoldenParityTest.cpp`:**
  - *Acción realizada:* Soporte para `GOLDEN_WAV_DIR` y resolución relativa `./golden`.
- [x] **8.3. Ampliación de cobertura de pruebas unitarias C++:**
  - *Acción realizada:* Creado arnés de pruebas `tests/DspEngineFacadeTests.cpp` y añadido target ejecutable `DspEngineFacadeTests` en `CMakeLists.txt` validando:
    1. Render de silencio en reposo sin voces activas.
    2. NoteOn produce señal válida y finita sin NaN/INF.
    3. Resistencia y clamping a pitch bend extremo sin desbordamiento.
    4. Acotación de controladores de modulación.
    5. Medición de telemetría de CPU y voces activas.
- [x] **8.4. Pruebas de conversión bidireccional de parámetros en TypeScript:**
  - *Acción realizada:* Creado `WebUI/src/utils/conversion.ts` y añadido test exhaustivo en `tests/registry.test.ts` que valida round-trips de los 445 parámetros en sus límites (`min`, `max`, `default`, clamping).

---

## 9. Calidad de Código, Estilo e Higiene Técnica

- [x] **9.1. Unificación de idioma en código fuente (inglés canónico):**
  - *Acción realizada:* Comentarios técnicos homogeneizados en inglés en `DspEngineFacade.cpp`, `DspEngineFacade.h` y `AxionikParamIndices.h`.
- [x] **9.2. Const-correctness defensivo en C++:**
  - *Acción realizada:* Métodos de solo lectura calificados con `const`, `noexcept` y `[[nodiscard]]`.
- [x] **9.3. Integración de nuevos principios en `ABDShared/Docs`:**
  - *Acción realizada:* Actualizados [`CALIDAD_Y_ESTANDARES_VST3.md`](file:///d:/desarrollos/ABDSynths/ABDShared/Docs/architecture/CALIDAD_Y_ESTANDARES_VST3.md), [`LECCIONES_APRENDIDAS_DSP_THREAD_SAFETY.md`](file:///d:/desarrollos/ABDSynths/ABDShared/Docs/architecture/LECCIONES_APRENDIDAS_DSP_THREAD_SAFETY.md) y [`GUIA_CREACION_SINTETIZADORES.md`](file:///d:/desarrollos/ABDSynths/ABDShared/Docs/architecture/GUIA_CREACION_SINTETIZADORES.md).

---

## 10. Registro Histórico de Cambios Aplicados

* **2026-10-28 (Sesión 2 — Ejecución Integral del Plan y Verificación):**
  * **DSP Engine (`DspEngineFacade`):**
    * Implementadas las 7 funciones modulares auxiliares y descompuesto `process()`.
    * Implementado `masterVolume_` con getter/setter y paridad a 0.85f.
    * Implementada medición de carga de CPU real basada en `std::chrono::steady_clock` con filtrado IIR monopolo.
    * Implementada rampa anti-pops muestra a muestra decremental y cálculo sub-bloque exacto.
    * Implementado clamping en Pitch Bend a $[-48, +48]$ semitones y desacoplada la tabla de LFO con `kNeuronLfoTableSize`.
    * Centralizados todos los índices de Silver FX (EQ, Compressor, Distortion, RingMod, SpWarp, Decimator, Delay, Flanger, Phaser, Chorus).
  * **Plugin Host (`PluginProcessor` & `PluginEditor`):**
    * Máquina de estados NRPN robustecida: reseteo en `CC#121`, aislamiento de canal MIDI y timeout de 500 ms.
    * Clamping de selección de preset por MIDI Program Change a `[0, kNumFactoryPresets - 1]`.
    * Sanitización defensiva en `setStateInformation` contra buffers menores de 16 bytes o nulos.
    * Creación defensiva de `JuceWebView2Component` con `try/catch` y mensaje de fallback en `paint()`.
    * Consistencia atómica en `setCurrentProgram` vinculada al éxito de `loadPresetBySlot`.
  * **Herramientas & Logger (`WebPilotHost` & `AppLogger`):**
    * Añadido parsing de `--auto-quit=<ms>` y `--timeout=<ms>` en `WebPilotHost.cpp`.
    * Añadida notificación a `std::cerr` ante excepciones de escritura en `AppLogger.h`.
  * **WebUI Frontend & Bridge (`main.ts`, `Navbar.ts`, `WebBridge.ts`):**
    * Añadidos métodos públicos `toggleMatrix()`, `toggleMfx()`, `toggleBank()` en `Navbar.ts`.
    * Eliminado el scraping de `textContent` en `main.ts` utilizando las variables de estado reactivo `currentR1ModelName` y `currentR2ModelName`.
    * Reemplazado el `alert()` intrusivo en `onSavePreset` por logging en consola.
    * Protegido `(window as any).__axionikSticks` en producción bajo `import.meta.env.DEV`.
    * Añadido tipado estricto con uniones discriminadas `OutgoingBridgeMessage` e `IncomingBridgeMessage` y método `clearCache()` en `WebBridge.ts`.
  * **Tests & QA:**
    * Creado `WebUI/src/utils/conversion.ts` e incorporada prueba unitaria de round-trip para los 445 parámetros en `tests/registry.test.ts` (10 tests Vitest en verde).
    * Creado arnés de pruebas unitarias C++ `tests/DspEngineFacadeTests.cpp` con 5 pruebas unitarias y añadido a `CMakeLists.txt`.
