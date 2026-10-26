# NeuronVS_port · plan de reconstrucción de la superficie VST2

> **Documento histórico para M0–M3.** El plan vigente del producto (JUCE 9,
> WebView2, VST3, x64, normas de ABDShared) está en
> [PLAN_JUCE9.md](PLAN_JUCE9.md): la superficie VST2 se queda como banco de
> pruebas y oráculo de audio, no como entrega. Lo que sigue documenta cómo se
> reconstruyó y verificó esa superficie.

Objetivo: llevar `NeuronVS.dll` (PE32 x86, Hartmann Music, 2004) a un proyecto C++
compilable con la interfaz `AEffect` y el dispatcher VST2 reconstruidos, sin el
hardware Neuron conectado, y con la migración a JUCE 9 como destino.

Estado de partida, ya verificado en este repo (no es una estimación):

| Dato | Valor | Fuente |
|---|---|---|
| Exportación VST2 | `main` (`0x1001b010`), devuelve `core+0x20` | [vst2/README](../NeuronVS_vst2/README.md) |
| `AEffect` | embebido en `core+0x20`, `object` = core, `uniqueID` `'NAS2'`, `version` 1 | `C_AudioNode_ctor` `0x10002fb0`, `1001b140` |
| `numParams` / `numOutputs` / `numInputs` | 26 / 2 / 0 | `10009f60`, `1001b140` |
| `flags` | `0x111` (editor + canReplacing + isSynth) | `FUN_10002b70`, `10003470`, `10004620` |
| Opcodes | 77 filas, 72 enrutadas (0x00–0x4c), 5 obsoletas sin ruta | `10003970` + `100030b0` |
| Parámetros | 26, rango 0–127, 24 en 64, `FilterFreq` 127, `FilterReso` 0 | tabla `0x1004f4e8` |
| MIDI | solo `effProcessEvents`, solo `kVstMidiType`, `deltaFrames` ignorado | `1000a070` |
| Editor | `C_Editor` en `core+8`, rect 652×800 | vtable `0x1004f7a0` |

## El hardware "Nuke": qué hace el binario y cómo se evita

El DLL **no** contiene ninguna cadena de dongle, licencia ni clave. Lo que sí hace
es hablar con un dispositivo propio por tres vías, todas localizadas:

1. **Enumeración de interfaces de dispositivo** con la GUID
   `{7C7051A9-D808-4FBE-BACE-05AF8B164F45}` (constante en `0x10049240`):
   `SetupDiGetClassDevsA` / `SetupDiEnumDeviceInterfaces` /
   `SetupDiGetDeviceInterfaceDetailA` en `FUN_10001d20`, `FUN_10001ec0` y
   `FUN_10001c50`; el `DevicePath` resultante se abre con `CreateFileA`.
2. **Memoria compartida nombrada** `"HVNSHARED"` de `0x94f8` bytes
   (`FUN_10002040`, `CreateFileMappingA` sobre `INVALID_HANDLE_VALUE`), con un
   hilo que reparte eventos (`FUN_100021c0`) y despacha a objetos registrados en
   `DAT_100556ec` (`FUN_1000a460`: MIDI, deltas de knobs, botones).
3. **Envoltorio de dispositivo** de 0x50 bytes creado perezosamente en
   `FUN_1000a1f0`, que guarda el id de la sección (`+0x4c`) y se engancha con
   `FUN_10002500(id, callback, ctx)`.

Consecuencia para el plan, y esto es lo que permite el puerto sin hardware:

- el motor de audio **no** está detrás del dispositivo: `processReplacing` va por
  `0x1000a040` a la vtable del componente de audio y el sintetizador vive en
  proceso (`C_NeuronCore`, `Noise`, voces, filtros). El dispositivo es una
  **superficie de control / puente MIDI**, no el DSP;
- el fallo de la sección compartida **no** aborta la construcción: `FUN_10002040`
  devuelve `6` y `FUN_1000a1f0` sigue devolviendo éxito (`CONCAT31(...,1)`); el
  flag de error de `FUN_10016320` solo se activa si falla `operator_new`;
- por tanto el puerto trata el hardware como **opcional** detrás de una interfaz,
  con un backend nulo como implementación por defecto.

Diseño: `neuron::IHardwareLink` con tres operaciones (`enumerate`, `open`,
`read/write`) y dos implementaciones: `NullHardwareLink` (por defecto, sin
`SETUPAPI`, sin `CreateFileMappingA`) y `SharedMemoryLink` (fiel al original,
solo en Windows y solo si se pide explícitamente). El primer hito del motor debe
demostrar audio con el backend nulo; si el motor real dependiera de un dato que
solo llega por el enlace, se verá en ese test y no en un DAW.

Los datos que el motor sí necesita son de fichero: `NeuronDB/Models/511.model`
y `NeuronDB/Sounds/*.sound` (351 ficheros, 5,9 MB). El puerto los resuelve con un
`DataRoot` explícito (variable de entorno o ruta de configuración), sin registro
de Windows y sin `RegQueryValueExA`.

## Arquitectura del proyecto

```
NeuronVS_port/
  CMakeLists.txt                  # surface estática + probe + módulo VST2
  include/neuron/vst2_abi.hpp     # AEffect/VstEvents/ERect propios (sin SDK)
  include/neuron/core.hpp         # ICore / IEditor / Plugin
  include/neuron/neurondb.hpp     # modelo (.scape/.sphere) + CurveReader/BandReader
  include/neuron/opcodes.h        # generado: enum de los 77 opcodes
  src/dispatcher.cpp              # cabecera + dispatcher (0x10002ed0/0x10003970)
  src/core_stub.cpp               # slots del core y del editor
  src/neurondb.cpp                # carga 511.model y los lectores 100317b0/10031950
  src/module.cpp                  # exports main / VSTPluginMain
  src/gen/dispatcher_cases.inc    # generado desde opcodes.csv
  src/gen/expect.inc              # generado: retornos constantes
  src/gen/parameters.inc          # generado desde parameters.csv
  tests/host_probe.cpp            # host sin GUI: 486 comprobaciones
  tests/model_probe.cpp           # 511.model + 108 comprobaciones con muestras reales
  tools/gen_vst2_bindings.py      # CSV -> C++ (con --check)
  tools/verify_scaffold.py        # contrato CSV <-> dispatcher
  tools/probe_dll.py              # carga el .dll y habla el ABI por ctypes
```

La regla que sostiene el resto: **el CSV es el contrato y el generador es el
único que escribe la tabla**. Un `case` del dispatcher no se toca a mano; se
regenera. `verify_scaffold.py` falla si el CSV y el código se separan.

El ABI no se copia del SDK de Steinberg (descatalogado y no redistribuible):
`vst2_abi.hpp` declara las estructuras y las ancla con `static_assert` a los
offsets recuperados; en x86 `sizeof(AEffect) == 0x90` y `object` cae en `+0x40`,
que es exactamente `core+0x60` en el original.

## Estado actual (ya construido y medido)

```
cmake -S NeuronVS_port -B NeuronVS_port/build  -G "Visual Studio 18 2026" -A x64
cmake -S NeuronVS_port -B NeuronVS_port/build32 -G "Visual Studio 18 2026" -A Win32
cmake --build NeuronVS_port/build   --config Release
cmake --build NeuronVS_port/build32 --config Release
ctest --test-dir NeuronVS_port/build  -C Release     # 2 tests, 486 + 108 checks, 0 fallos
ctest --test-dir NeuronVS_port/build32 -C Release    # 2 tests, 486 + 108 checks, 0 fallos
python NeuronVS_port/tools/verify_scaffold.py        # 77 opcodes, 72 enrutados
python NeuronVS_port/tools/probe_dll.py NeuronVS_port/build/Release/neuron_vst2.dll
```

- `host_probe` recorre la secuencia de un host real: cabecera, identidad,
  capacidades, sample rate/block size, resume, MIDI, 26 parámetros, editor,
  barrido de los 77 opcodes y `processReplacing`.
- `probe_dll.py` carga el `.dll` construido y lee `AEffect` con **su propia**
  definición de estructura (42 comprobaciones): verifica exports `main` /
  `VSTPluginMain` y el layout desde fuera del C++.
- `model_probe` abre `NeuronDB/Models/511.model` (scape + sphere + `MName`) y
  rinde muestras reales por los dos lectores: 4410 de la curva int16 y 65536 del
  barrido de 25 bandas, deterministas, comprobadas contra los bytes del fichero.
- El módulo exporta `main`, `VSTPluginMain` y `NeuronVSTEntry` (el último existe
  porque MSVC reserva `main`; CMake lo publica con `/EXPORT:main`).

Lo que **no** hay todavía: DSP (el `process` escribe silencio), editor gráfico,
`.sound` y enlace de hardware. Son los hitos M3–M6.

## Hitos

**M0 · ABI y cabecera** — hecho. `static_assert` de offsets, cabecera poblada
como `10002fb0`/`1001b140`, `main` exportado en x86 y x64.

**M1 · Dispatcher completo** — hecho. 72 opcodes enrutados con sus guardas
(`value < numPrograms`, `editor != 0`, rama `value == 0 / != 0`) y las cuatro
formas de retorno (`handler`, `!= 0`, `!handler`, `& 0xff`), más `effIdentify`.

**M2 · Semántica de slots** — hecho para la superficie: nombres, etiquetas,
`display`, program name, categoría, `canDo`, `VstPinProperties`, `numPrograms`
dependiente de `"FXpansion"`, chunks a 0, `tailSize` 0, `keysRequired` con la
inversión del dispatcher. Criterio: cada fila del CSV con retorno constante la
comprueba el probe; las de retorno `handler` se comprueban a mano en el test.

**M3 · Enlace de hardware nulo + `NeuronDB`** — en curso. Hecho: `DataRoot`
(`NEURON_DB`, sin registro), carga de `511.model` (scape, sphere, `MName`) y los
dos lectores del motor, `CurveReader` (`100317b0`) y `BandReader` (`10031950`),
con `model_probe` rindiendo muestras reales (108 comprobaciones, x64 y x86).
Falta: `IHardwareLink` nulo, la carga de un `.sound` y enchufar modelo y voz a
`host_probe`. Aceptación pendiente: `host_probe` abre el modelo y una voz con el
backend nulo, sin `SETUPAPI` ni memoria compartida en el binario.

**M4 · Motor de audio** — pendiente. Portar el grafo (`C_NeuronCore`, `Noise`,
voces, filtro) respetando la ruta MIDI de `1000a070` (omni, velocidad 0 = note
off, `deltaFrames` ignorado, robo de voz). Aceptación: nota 60 durante 1 s contra
`processReplacing` da señal no nula, sin clipping, y el mismo bloque repetido es
determinista byte a byte.

**M5 · Editor y datos de layout** — pendiente de decisión (ver abajo). El editor
GDI no se porta: la UI se reconstruye con los datos de
[NeuronVS_layout](../NeuronVS_layout) (26 páginas, 431 controles) y los bitmaps
de [NeuronVS_bitmaps](../NeuronVS_bitmaps).

**M6 · JUCE 9** — pendiente, y fuera de este documento: ver
[PLAN_JUCE9.md](PLAN_JUCE9.md), que sustituye a la sección «Migración a JUCE 9»
de abajo con el proyecto consumidor de ABDShared.

## Migración a JUCE 9

Hechos comprobados de la versión actual (9.0.x):

- JUCE 9 **no** trae CLAP en la API de CMake; `FORMATS` admite `VST3` y `AU/AAX`
  y `VST` solo si antes se llama a `juce_set_vst2_sdk_path` (el SDK de VST2 sigue
  fuera del repo desde JUCE 5.4).
- Requisitos: C++17 y CMake 3.22+. La versión de Windows que se documenta es
  Visual Studio 2019; aquí hay MSVC 19.51.
- Cambios que afectan a un editor portado: `Drawable` ya no deriva de
  `Component` (usar `DrawableComponent`), `Drawable::createFromSVG(XmlElement)`
  desaparece (`createFromSVGFile`/`String`), `Font::getStringWidth*` se retira
  (medir con `TextLayout`/`GlyphArrangement`), el multi-touch de Windows se
  desactiva por defecto y `createEditor()` pasa a `createEditorAndMakeActive()`.

Mapeo directo del puerto:

| Original | Puerto actual | JUCE 9 |
|---|---|---|
| `main` / `AEffect` | `neuron_vst2.dll` | `juce::AudioProcessor` + `createPluginFilter()` |
| 26 parámetros 0–127 | `parameters.inc` | `AudioProcessorValueTreeState` (26 `AudioParameterFloat`, rango 0–127) |
| `effProcessEvents` | `SurfaceCore::invoke(0xc8)` | `processBlock` + `MidiBuffer` (misma semántica omni) |
| `processReplacing` | `processSilence` | `processBlock` del motor portado |
| editor 652×800 | `SurfaceEditor` | `AudioProcessorEditor` 800×652 con `LookAndFeel` propio |
| `effEditKeyDown` | slot `0x1c` | eventos de teclado del `Component` |
| `setParameter`/`getParameter` | `SurfaceCore` | `APVTS` + `AudioProcessor::setValueNotifyingHost` |
| `AEffect->dispatcher` | tabla generada | no existe: el wrapper de JUCE hace de host |

Estrategia recomendada: **mantener las dos capas**. El dispatcher reconstruido
sigue siendo el banco de pruebas (compara 1:1 contra el CSV y contra el DLL
original); el plugin JUCE envuelve el mismo `ICore`, sin duplicar lógica. Para el
formato distribuible, VST3 (y CLAP cuando JUCE lo publique); VST2 solo desde el
puerto, que ya no necesita el SDK.

## Riesgos y límites conocidos

- **El motor no está en el binario del todo**: falta verificar si alguna rama de
  síntesis depende de datos que solo llegan por `HVNSHARED`. Se resuelve en M3
  con el backend nulo y el test de audio; si aparece, el plan cambia y hay que
  portar también el protocolo del dispositivo.
- **32 bits**: el original es PE32; aunque el puerto compila en ambas anchuras,
  sólo x86 permite comparación diferencial cargando el DLL original.
- **Verificación diferencial**: la prueba fuerte pendiente es un host x86 que
  cargue `NeuronVS.dll` y `neuron_vst2.dll` y compare los 72 opcodes y 26
  parámetros uno a uno. `probe_dll.py` ya tiene la forma para hacerlo.
- **Nombres de parámetros de 24 bytes** contra `kVstMaxParamStrLen = 8`: el
  original desborda el buffer del host. El puerto recorta; el desbordamiento no
  se reproduce a propósito.
- **Licencia**: el código se deriva de una descompilación de un producto de 2004.
  El plan técnico no decide sobre su distribución.
