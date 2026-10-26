# NeuronVS → plugin ABD · plan vigente (JUCE 9 · WebView2 · VST3 · x64)

> Sustituye a la segunda mitad de [PLAN.md](PLAN.md), que sigue siendo válido como
> registro de la superficie VST2. Fecha: 2026-10-20.

## 1. Veredicto: la tarea del AEffect está terminada; el sintetizador no

La tarea concreta —reconstruir `AEffect` y el dispatcher VST2 en un proyecto C++
compilable a partir de la descompilación— **está hecha y verificada hoy**, no es una
estimación:

| Comprobación | Comando | Resultado |
|---|---|---|
| x64, 2 suites | `ctest --test-dir build -C Release` | 2/2, 486 + 108 checks |
| x86, 2 suites | `ctest --test-dir build32 -C Release` | 2/2, idéntico |
| contrato CSV ↔ código | `tools/verify_scaffold.py` | `77 opcodes (72 routed, 5 unrouted), generated files current` |
| ABI desde fuera del C++ | `tools/probe_dll.py build/Release/neuron_vst2.dll` | `42 checks, 0 failures` |

Están cubiertos M0 (cabecera y offsets con `static_assert`), M1 (72 opcodes con sus
guardas y las cuatro formas de retorno) y M2 (semántica de slots, 26 parámetros,
MIDI, editor declarado). De M3 hay modelo y lectores (`511.model`, 108 checks con
muestras reales).

Lo que **no** está: DSP, editor, `.sound` en C++, enlace de hardware nulo y todo el
producto JUCE. Es decir, la superficie está terminada; el sintetizador no.

## 2. La capa VST2 no se tira: se queda como banco de pruebas

La duda era si este trabajo se descarta al pasar a JUCE 9. La respuesta es que el
*producto* no la usa, pero el *proyecto* sí, para tres cosas que ningún otro
artefacto puede dar:

1. **Oráculo de audio.** `NeuronVS.dll` es x86 y expone `processReplacing`; un
   ejecutable de 32 bits que lo cargue con `LoadLibrary`, le pase un `AEffect` con
   host callback y le envíe MIDI puede **grabar el audio original**. Es la única
   forma de comparar el DSP portado contra el de 2004 sin oído y sin hardware.
   El plan de [PLAN.md](PLAN.md) ya documenta que el dispositivo "Nuke" es
   superficie de control, no el DSP; N2 lo confirma o lo desmiente **antes** de
   escribir una línea de motor.
2. **Contrato.** `NeuronVS_vst2/opcodes.csv` y `parameters.csv` son la fuente de
   verdad, y `verify_vst2.py` los revalida contra el binario. El plugin nuevo no
   necesita el dispatcher, pero sí esa tabla como referencia de qué hacía el
   original con cada mensaje.
3. **Ancla del ABI.** `vst2_abi.hpp` fija offsets que el plugin nuevo ya no usa,
   pero que documentan por qué el objeto del core cae en `core+0x20` y qué campos
   leía el host. Si algún día hay que cargar el DLL original en un host real, ese
   contrato es lo que lo hace posible.

**Regla:** al módulo VST2 solo se le añade lo que sirva al oráculo (un renderizador
CLI, no más plugin). No se porta el editor GDI, no se emula el dongle, no se
completa el VST2 "de producto".

## 3. Destino: un consumidor nuevo de ABDShared

Proyecto nuevo en el monorepo, hermano de `ABDNeural` (`D:\desarrollos\ABDSynths\`),
nombre provisional **`ABDNeuronVS`**. Consume `ABDShared` y no vive dentro de este
repo de descompilación: aquí quedan los CSV, los verificadores y el banco de pruebas.

```
ABDNeuronVS/
  CMakeLists.txt              # C++20, CMake 3.22+, JUCE 9 (JUCE_PATH), VST3+Standalone x64
  Source/
    Core/                     # sin JUCE, sin Windows: parámetros, preset, DataRoot
      ParameterTable.h/.cpp   # 445 claves, generadas desde preset_schema.csv
      SoundPreset.h/.cpp      # .sound (texto, CRLF, 445 líneas) leer/escribir
      DataRoot.h/.cpp         # localiza NeuronDB; nunca lo incrusta
    DSP/                      # sin JUCE: el motor portado, lista única DspSources.cmake
    Plugin/                   # AudioProcessor, APVTS, estado, MIDI
    WebUI/                    # ParameterBridge, host WebView2, assets
  WebUI/                      # Vite + @abdsynths/shared (vanilla JS)
    contracts/bridge-protocol.json
    generated/                # contrato de parámetros generado, nunca a mano
  Tests/                      # ctest: preset, DSP, contrato
  tools/                      # generadores y selftest E2E
```

Flujo: `WebUI ⇄ bridge versionado ⇄ AudioProcessor ⇄ ParameterTable/APVTS ⇄ DSP`,
y `estado del plugin = .sound (445 líneas) + id de modelo`, que es exactamente lo
que guarda el original; así un preset de 2004 se abre sin traducción.

## 4. Normas de ABDShared que el proyecto hereda

No se inventan convenciones: se copian las que ya cumplen los consumidores.

- **C++20 y CMake 3.22+**; alias canónicos `ABDShared::DspCore`, `::SynthCore`,
  `::DspEffects`, `::WebView2Bridge`, `::HardwareDrivers`, `::ScopeCore`,
  `::AutoUpdater`, `::AudioComparator`, `::HardwareMidiDetect`.
  `add_subdirectory(../ABDShared/Code ...)` una sola vez, sin rutas duplicadas.
- **WebView2** con `ABDShared::WebView2Bridge`: `JuceWebView2Component` (backend
  WebView2, listener `pageLoaded`, tema `data-theme`, bounds) y
  `WebView2ResourceProvider` (catálogo `juce_add_binary_data` + fallback a
  `ABDSharedAssets`). No se escribe otro host de WebView2.
- **Contratos**: todo lo que cruza el puente se declara en
  `ABDShared/Contracts` (JSON Schema + tipos) y se genera; el lado C++ es la
  fuente (`Source/WebUI/ParameterBridge.h`) y el JSON de protocolo lleva
  `version` y `sourceOfTruth`, como en `ABDNeural/WebUI/contracts`.
- **Componentes**: `FitStage` en el contenedor, `SynthNavBar` con menús nativos,
  `AboutDialog` conectado al actualizador, `LiveSysExInspector` en `Ctrl+I`,
  controles y temas de `@abdsynths/shared` (`workspace:*`, cero copias).
- **Pruebas**: `ctest` para C++ y `vitest` para la WebUI; el puente tiene selftest
  E2E de las cuatro direcciones (parámetros, presets, teclado/ruedas, snapshot).
- **Build**: `build.bat` con log espejo y modo `tests`, `DspSources.cmake` como
  lista única de fuentes del DSP (la lección de ABDMS2000), y el resumen final
  dice qué superficie falló.
- **Calidad**: el checklist de `ABDShared/Docs/integration/INTEGRATION_GUIDE.md §6`
  se firma antes de dar el sintetizador por integrado.

## 5. Hitos

### N0 · Superficie VST2 — hecho
Ver §1. No se toca salvo lo que pida N2.

### N1 · Núcleo de datos y preset (sin JUCE) — hecho en `NeuronVS_port`
> Implementado como target `neuron_core` de este repo (params, preset y
> DataRoot, sin JUCE); ABDNeuronVS lo consume tal cual en N4. `core_probe`:
> 122 checks en x64 y x86, 351/351 presets byte a byte, 19 defaults en 1.
> El `DataRoot` con `juce::File` queda para la capa del plugin.

- `ParameterTable`: 445 entradas (clave, grupo, min, max, default, step),
  **generada** desde `NeuronVS_preset_format/preset_schema.csv`; el generador
  vive en este repo y escribe un `.inc`/JSON versionado.
- `SoundPreset`: lector/escritor del `.sound` (texto, CRLF, claves por nombre,
  orden irrelevante), más la migración de los 3 presets a los que les falta
  `SlicerSwitchBackup`.
- `DataRoot`: resuelve `NeuronDB` (variable de entorno, ruta de usuario,
  `juce::File`), sin registro de Windows y sin incrustar datos.
- **Aceptación:** los 351 presets hacen roundtrip byte a byte; los 19 defaults
  fuera de rango se recortan como `FUN_10001170`; `ctest` en x64 y x86.

### N2 · Oráculo dorado (x86, DLL original)
- CLI `neuron_golden` que carga `NeuronVS.dll`, monta un `AEffect` con host
  callback, fija sample rate/block, envía vectores MIDI y escribe float32 WAV +
  manifiesto `sha256`.
- Vectores: nota 60 a velocity 100 durante 1 s; acorde de 4 notas; note-off y
  robo de voz; CC1/2/3/4/11; pitch bend; program change con banco. Sample rates
  44100/48000/96000, bloque 512 y 64.
- **Aceptación:** dos ejecuciones dan el mismo `sha256`; la señal no es silencio;
  se graban al menos 3 presets y el modelo 511. Si algo suena a silencio, el
  diagnóstico es del enlace de datos/registro, no del DSP, y se anota.
- **Riesgo que este hito resuelve:** si el motor dependiera de `HVNSHARED`, aquí
  se ve, antes de invertir en el port.

### N3 · Motor portado (sin JUCE)
- **Ya medido:** [`NeuronVS_dsp/`](../NeuronVS_dsp/) — 87 funciones, 81.159 B
  (27,8 % de `.text`), 12.665 líneas, **cero llamadas indirectas**; bloque interno
  de 128 muestras con clip a cero, 128 slots de voz, y un único acoplamiento
  preset→motor (`FUN_10040550`, 2.125 líneas). Dos hojas del grafo
  (`CurveReader`/`BandReader`) ya están en `neuron_data`.
- Grafo de `C_NeuronCore`: voces, `Noise`, filtro, `ModMatrix` si aplica; MIDI de
  `0x1000a070` con su semántica (omni, velocity 0 = note-off, banco/programa).
- Regla ABDShared: lo que ya exista en `SynthCore`/`DspCore` se consume, no se
  duplica; lo específico de Neuron se escribe aquí. `DspSources.cmake` único.
- **Aceptación:** cada vector de N2 reproducido por el motor portado, determinista
  entre ejecuciones, con error máximo por muestra declarado y medido (el umbral se
  fija tras la primera comparación, no antes); sin NaN/denormals en 10 minutos de
  audio; nota 60 ⇒ señal no nula y sin clipping.

### N4 · Host JUCE 9
- `juce_add_plugin(ABDNeuronVS ... FORMATS VST3 Standalone)`, x64, C++20,
  `createPluginFilter()`, sin VST2 SDK.
- Parámetros: 445 `AudioParameterInt` generados (IDs = claves), con la tabla como
  fuente; el mapa legado de los 26 índices del VST2 se guarda como dato para
  documentación y para el oráculo, no como API del plugin.
- Estado: chunk = `.sound` + id de modelo + versión; cargar un `.sound` de 2004
  debe sonar igual que en el original.
- MIDI: por defecto **al inicio del bloque**, como el original (`deltaFrames`
  ignorado), con bandera para sample-accurate; documentado, porque cambiar esto
  cambia el sonido.
- **Aceptación:** VST3 y Standalone arrancan, guardan/restauran estado, 44.1/48/96
  kHz, y el bloque repetido es determinista; `pluginval` si está disponible en la
  máquina, si no el selftest del host.

### N5 · WebUI + WebView2
- Layout **generado** desde `NeuronVS_layout` (`page_controls.csv`, `sprites.csv`,
  `page_summary.csv`) y bitmaps convertidos a WebP; nada de posiciones a mano.
  Las páginas y los selectores de vistas hijas ya resueltos en el visor se
  reutilizan como modelo de navegación.
- Controles de `@abdsynths/shared`, `FitStage`, `SynthNavBar`, `AboutDialog`,
  `LiveSysExInspector`, tema claro/oscuro con `data-theme`.
- Puente v1 según §4, con la convención de `ABDNeural`: `value` normalizado
  0..1, `real` en unidades del parámetro (0..127, entero), `text` formateado y
  gestos `begin/change/end`; más `vitest` y selftest E2E de las cuatro
  direcciones.
- **Aceptación:** los 445 parámetros son alcanzables desde la UI; arrastrar un
  knob abre y cierra gesto del host; cargar preset actualiza toda la UI; las
  páginas del editor original se navegan igual; sin errores de consola.

### N6 · Hardware opcional (nunca requisito)
- `IHardwareLink` con `NullHardwareLink` por defecto; `SharedMemoryLink`
  (`HVNSHARED`, 0x94f8 bytes, `SETUPAPI`) detrás de `ABDNEURON_HW_LINK` y solo
  Windows. Sin dongle, sin licencia, sin claves.
- **Aceptación:** el binario por defecto no importa `SETUPAPI` ni `CreateFileMappingA`;
  el build opcional pasa un test con un buffer sintético.

### N7 · Entrega
- Localizador de datos en primer arranque (con aviso claro si falta `NeuronDB`).
- Instalador, versión, About/updater; firma del checklist ABDShared §6.
- Nota de licencia: código derivado de una descompilación de 2004 y datos de
  fábrica que **no** se redistribuyen.

## 6. Decisiones que te tocan (recomendación marcada)

| Decisión | Recomendación | Por qué |
|---|---|---|
| Nombre y repo | `ABDNeuronVS` en `ABDSynths` | Hermano de `ABDNeural`; el repo `neuron` queda como evidencia |
| Parámetros al host | los 445 | Un preset de 2004 se edita entero; el límite de 26 era del VST2 |
| MIDI | bloque, con bandera | Fidelidad primero; sample-accurate cambia el sonido |
| `NeuronDB` | ruta externa, nunca incrustado | 5,9 MB de contenido de fábrica con copyright |
| VST2 | solo oráculo | El producto es VST3; el SDK sigue fuera de JUCE |

## 7. Riesgos

- **El motor puede no estar entero en el binario.** N2 lo mide; si alguna rama
  depende del enlace, el plan cambia y hay que portar también el protocolo.
- **Tamaño del port:** 1023 funciones descompiladas; el motor es `C_NeuronCore`
  (1008 bytes) con sus seis componentes y las voces. El conjunto que suena son 87
  funciones y 12.665 líneas, no las 1.023; N3 sigue siendo el hito grande, por eso
  va después del oráculo y no antes.
- **Fidelidad de bloque:** el original renderiza en tramas de 128 muestras y anula
  la muestra cuando `|x| > 1` en vez de limitarla. Reproducirlo o no es una decisión
  explícita: cambiarlo desvía el WAV de N2 en cuanto el preset satura.
- **Precisión:** el original usa x87/SSE de 2004; el port en x64 puede no ser bit a
  bit. Se fija tolerancia medida y se documenta; "suena igual" no es un criterio.
- **445 parámetros** en APVTS: coste de construcción y de listeners; se crean por
  tabla y se sincronizan por lotes, y la UI no escucha uno a uno.
- **WebView2** exige Evergreen Runtime y es solo Windows; el Standalone debe
  arrancar sin WebView2 (fallback nativo mínimo) para no bloquear el build.
- **JUCE 9:** `Drawable` ya no es `Component`, `createEditorAndMakeActive()`,
  `Font::getStringWidth*` fuera; afecta solo a un editor nativo, que aquí no se
  escribe.
- **Licencia:** ver N7. El plan técnico no decide la distribución.

## 8. Lo que no se hace

- Portar el editor GDI (`C_Editor`, 2820 bytes, 33 páginas de bitmaps): la UI se
  reconstruye, no se emula.
- Completar el VST2 como producto ni enlazar el SDK de Steinberg.
- Emular el dongle o el dispositivo "Nuke".
- Construir en 32 bits para el producto.
- Reescribir la descompilación: los CSV siguen siendo la fuente y los
  verificadores el juez.
