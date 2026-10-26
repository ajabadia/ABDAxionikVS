# Motor de audio — estudio antes de portar

Este directorio responde a una sola pregunta: **qué hay que reescribir de verdad para
que un port suene**, y cuánto es. No es un plan de trabajo; es la medida del terreno.

Todo lo que sigue sale de `NeuronVS.dll` (1.024 funciones descompiladas) y se puede
reproducir con los scripts de [`tools/`](tools) y los CSV de este directorio.

| Artefacto | Contenido |
|---|---|
| [`callgraph.csv`](callgraph.csv) | las 87 funciones del render, con tamaño y llamadas |
| [`constants.csv`](constants.csv) | las 1.430 globales que usa el camino de audio, con su valor en el PE |
| [`constants_types.csv`](constants_types.csv) | el tipo de cada una de esas globales, medido por la instrucción que la carga |
| [`CONSTANT_TYPES.md`](CONSTANT_TYPES.md) | método y resultado del barrido: 402 confirman el CSV y 306 lo corrigen |
| [`STATE_SPLIT.md`](STATE_SPLIT.md) | dónde acaba `params` y empieza el motor: los seis componentes y la prueba estructural |
| [`ZONES.md`](ZONES.md) | las 128 entradas por tecla: `map.script` → registro de 48 B → tabla de 40 B, `FUN_100440d0` campo a campo, y los dos motores que cuelgan de cada voz |
| [`tools/dump_constants.py`](tools/dump_constants.py) | vuelca `constants.csv` desde el binario |
| [`tools/sweep_constant_types.py`](tools/sweep_constant_types.py) | desensambla `.text` y vuelca `constants_types.csv` |
| [`../_tools/pe_read.py`](../_tools/pe_read.py) | lector PE (VA→offset, datos, desensamblado con capstone) |
| [`../_tools/call_graph.py`](../_tools/call_graph.py) | grafo de llamadas sobre el pseudocódigo |
| [`tools/verify_dsp.py`](tools/verify_dsp.py) | recuenta todas las afirmaciones de este README y falla si el binario no cuadra |
| [`tools/verify_zones.py`](tools/verify_zones.py) | 101 comprobaciones del camino modelo → tabla y del call site de la voz (incluye bytes del asm) |

---

## 1. El tamaño real: 87 funciones

El punto de entrada del audio no es el `processReplacing` del `AEffect`, sino una
etiqueta de código que Ghidra no llegó a marcar como función:

```text
processReplacing (AEffect+0x50 = 0x10002f90)
  └─ core+0x14 (0x1000a040)              stub: llama a core+0xb0
      └─ 0x1000bc40                      "bombeo": buffers internos → salidas del host
          └─ 0x100382b0                  render de un bloque de 128 muestras del motor
              └─ 87 funciones
```

Medido sobre el pseudocódigo:

| Métrica | Valor |
|---|---|
| funciones alcanzables desde `0x100382b0` | **87** |
| bytes de código | **81.159** (27,8 % de los 292.272 de `.text`) |
| líneas de pseudocódigo | **12.665** |
| **llamadas indirectas dentro del conjunto** | **0** |
| funciones hoja (sin llamadas) | 48 |

El cero en llamadas indirectas es la mejor noticia del estudio: el conjunto es
**cerrado**. No hay dispatch virtual escondido, así que el grafo de llamadas que hay
en [`callgraph.csv`](callgraph.csv) es el camino completo, no una cota inferior.

Las cinco funciones más grandes del render:

| Función | Bytes | Líneas | Llamadas | Papel |
|---|---|---|---|---|
| `FUN_10029e34` | 13.520 | 1.518 | 4 | banda/curva de una capa |
| `FUN_1002e7a0` | 12.215 | 1.430 | 5 | ídem, sobre `CurveReader`/`BandReader` |
| `FUN_10027c8c` | 6.283 | 787 | 0 | hoja pura de cálculo |
| `FUN_100330f0` | 4.320 | 431 | 2 | — |
| `FUN_100382b0` | 3.648 | 1.781 | 30 | orquestador del bloque |

Y una parte del camino **ya está portada**: `FUN_100317b0` (`CurveReader`) y
`FUN_10031950` (`BandReader`), que `FUN_1002e7a0` llama directamente, ya existen en
[`../NeuronVS_port/include/neuron/neurondb.hpp`](../NeuronVS_port/include/neuron/neurondb.hpp)
y rinden muestras reales contra los ficheros extraídos. El port no empieza de cero ni
en la lectura de datos.

## 2. Bloques, canales y el "clip a cero"

`0x1000bc40` es un bombeo con buffer propio, no un proceso directo:

- tamaño de bloque interno: **128** muestras (`DAT_1030f6e8`, leído con `movsx word`);
- **2** canales de entrada y **2** de salida (`DAT_1030f6ec` y `DAT_1030f6f0`, ambos 2);
- arrastra lo que sobra entre llamadas (`[this+0x30]` = frames pendientes) y va
  sirviendo bloques de 128 al motor hasta cubrir el bloque del host.

Al copiar a las salidas del host aplica esto, muestra a muestra:

```asm
fld  dword [esi]        ; x
fld  st(0)
fmul st(1)              ; x*x
fcomp qword [1.0]       ; DAT_10049390 = 1.0
...
jne  keep              ; si x*x == 1.0 o NaN
fstp st(0)
fld  dword [0x10049238] ; 0.0
keep: fstp dword [ecx]
```

Es decir: **si `|x| > 1.0`, la muestra se sustituye por 0**, no se limita a 1.0. Es un
recorte a cero, no un limitador. Cualquier port que "mejore" esto (limitando, o
dejando pasar) se desvía del WAV de referencia en cuanto el preset satura. Puede
explicar huecos audibles en capturas del original, y conviene reproducirlo antes de
decidir si se conserva.

## 3. Voces

- **128 slots** reservados: `FUN_10037ef0()` devuelve `0x80`. Los punteros viven en
  `noise+0x3c`, los flags de ocupado en `noise+0xc0`, y el número de slots en
  `noise+0x38`.
- El preset manda: `SoundNumVoices` está entre **4 y 12** en los 351 ficheros
  (`sound_schema.csv`), y `FUN_1000ba70` compara ese valor con las voces activas antes
  de asignar. Si no hay libre, se roba la que el motor puntúa más baja
  (`FUN_100403b0`).
- **Cada nota reserva un juego de capas, y cuántas depende del modo de la capa**
  (`FUN_1003d800`, `switch(*(layer + 0x6390))`): descriptores de **40 B**
  (`operator_new(0x28)`, hasta 9 en el pseudocódigo) y tablas de **2.056 dwords =
  8.224 B** (`operator_new(0x2020)`, hasta 16), más tablas sueltas de 2.048 dwords sin
  cabecera. El caso mínimo del `switch` son 2 descriptores y 2 tablas; el más
  recargado, 9 y 16, que son **≈ 132 KB por nota** en el peor caso. Con 12 voces
  sonando, ~1,6 MB; con los 128 slots llenos, ~17 MB.
  Las seis capas (2 resynators × 3 layers, `R1L1..R1L3` / `R2L1..R2L3`) no reservan
  todas lo mismo: por eso el `switch` reparte 2/3/4 tablas según el caso.
- MIDI: omni (se descarta el nibble de canal), `deltaFrames` ignorado (todos los
  eventos se aplican al inicio del bloque), note-off libera todas las voces de esa
  nota, note-on con velocidad 0 entra por la rama de note-off.

## 4. La frontera: qué configura y qué suena

Era la duda principal. La respuesta es limpia: hay **tres** objetos, y el audio sólo
recibe datos del tercero. (El único matiz pendiente —si el render lee `params` en
caliente por el puntero que ya tiene— está en [`STATE_SPLIT.md`](STATE_SPLIT.md) §6.)

### 4.1 `snddat` — el almacén autoritativo (445 registros)

- Objeto de 12 B (`FUN_10013de0`), con `{puntero al array, flag, count}`.
- El array lo aloja `FUN_10001870(0x1bd)` = **445 registros de 40 B** (`445*0x28+4` =
  0x4588+4 bytes), construidos uno a uno (`FUN_100213e6` con ctor/dtor).
- Los **valores por defecto están en el binario**: `FUN_10013de0` copia una tabla de
  `.rdata` en `0x10049f14`, de **28 B por entrada**, hasta `0x1004cfc0`:
  `(0x1004cfc0-0x10049f14)/28 = 445`. Cada entrada se expande a los 40 B del registro.
- Es el equivalente binario de las 445 claves de `sound.script`, en el mismo orden que
  [`../NeuronVS_neurondb/sound_schema.csv`](../NeuronVS_neurondb/sound_schema.csv).

### 4.2 `params` — coeficientes de ejecución (11.484 B, `0x2CDC`)

No guarda los 445 valores; guarda lo que el motor necesita en caliente:

| Offset | Contenido | Quién escribe |
|---|---|---|
| `+0x14` | 6 índices de fuente de modulación | ctor |
| `+0x44` | **6 controles de ejecución** (float) | `FUN_10013490` (MIDI CC y presión) |
| `+0x17C` | 6 valores de esas fuentes | ctor / cambio |
| `+0x278` / `+0x27C` | punteros a `snddat` / a `engine` | ctor |
| `+0x280` … | **335 observadores de 24 B**, enganchados a otros tantos registros de `snddat` | ctor (`FUN_100010a0` ×335) |
| `+0x278C` | **valores efectivos por slot**, 340 dwords (1.360 B) | `FUN_100134e0` |

`FUN_100134e0` es el "ha cambiado un parámetro": toma los 6 controles, les suma la
matriz de modulación (`+0x14`/`+0x17C`), los recorta a las ventanas de
`+0x2B0+slot*0x18` —que caen en ese array de observadores a partir del tercer bloque,
porque `0x2B0 = 0x280 + 2*0x18`—, deposita el resultado en `+0x278C+slot*4` y llama al
traductor.
El mapa índice→slot está en `.rdata` en `0x10049E00` y tiene **sólo 64 entradas
válidas** (valores 0…240, casi todos en parejas L/R consecutivas).

El desglose completo, con la prueba de que la frontera es real y las tres dudas que
quedan por cerrar, está en [`STATE_SPLIT.md`](STATE_SPLIT.md).

### 4.3 `engine` — el estado que suena (13.948 B, `0x367C`)

Lo construye `FUN_10038220` → `FUN_10044884` (5.215 B), que además aloja tablas
grandes (`0x843C8` = 541.640 B y `0x562A8` = 353.960 B).

### 4.4 El traductor: `FUN_10040550`

**15.226 B, 2.125 líneas, 3 llamadas.** Es la pieza que convierte
`params+0x278C` en el estado del motor y la que hay que entender antes que ninguna
otra. Escribe tablas dentro de `engine` en `+0x2CA..+0x2E1`, `+0x306` y `+0xD94`,
y comparte camino con el pitch bend (`engine+0xDA4`/`+0xDA8`).

Se llama en tres sitios, y los tres son "ha cambiado algo", nunca "hay que sonar":

| Llamador | Cuándo |
|---|---|
| `FUN_100132d0` | cargar un sonido desde la UI |
| `FUN_100134b0` | cambiar el pitch bend |
| `FUN_100134e0` | cambiar cualquier parámetro |

**Conclusión de la frontera:** el audio **no realimenta** `params`. El flujo es
`fichero → snddat → params+0x278C → FUN_10040550 → engine → voces → salida`. Eso
significa que el port puede separar limpiamente "modelo de preset" de "motor", y que
`FUN_10040550` es el único punto de acoplamiento. Es la función que decide si el port
suena o no.

La prueba estructural: las **87** funciones del render viven todas entre
`0x10021C90` y `0x100478D0`, es decir en el módulo del motor; ninguna pertenece al
rango del cargador (`0x1000Bxxx`–`0x10013xxx`), y el grafo no tiene llamadas
indirectas. Detalle en [`STATE_SPLIT.md`](STATE_SPLIT.md) §5.

## 5. Constantes: el riesgo era menor de lo que parecía

Las funciones del render referencian **1.430 globales**. De ellas, **1.401 (98 %)
tienen valor recuperable** directamente del PE, porque viven en `.rdata` o `.data1`
(inicializadas); sólo **29** caen en BSS y son estado en tiempo de ejecución, no
constantes. Están todas en [`constants.csv`](constants.csv).

Ya identificadas, y son las que más se usan:

| Constante | Valor | Uso |
|---|---|---|
| `0x1030f6e8` | 128 | muestras por bloque interno |
| `0x1030f6ec` / `0x1030f6f0` | 2 / 2 | canales in / out |
| `0x10049390` | 1.0 (double) | umbral del clip a cero |
| `0x10049238` | 0.0 (float) | valor del clip a cero |
| `0x10049dcc` | 1/127 | escala de un CC a 0..1 |
| `0x10049dc8` | 1/16384 | escala del pitch bend crudo |
| `0x1030da00..da18` | 2.0, 2.0, 1.0, 1/12 | ley del bend: `2^((2b-1)·rango/12)` |
| `0x10049db4` | 128.0 | centro del joystick del enlace NJSE |

El `as` de `constants.csv` es una conjetura **del valor**, no del uso: propone
`f64`/`f32`/`u32` eligiendo la interpretación que parece razonable, y un mismo par de
bytes puede leerse como un `double` o como dos `float`. Ese barrido ya está hecho y
eso cambia el número: [`CONSTANT_TYPES.md`](CONSTANT_TYPES.md) desensambla `.text` y
deduce el tipo del **ancho y la familia de la instrucción** que toca cada global.

| | Constantes |
|---|---:|
| Medibles por instrucción | **708** (50 %) |
| — confirman el CSV | 402 |
| — lo corrigen | **306** |
| No medibles (puntero pasado a un helper) | 722 |

Las correcciones son de ancho, no de valor: **151** `f64` que en realidad son
`f32`, **117** `u32` que son `f32` y **31** `u32` que son `f64`. Por ejemplo
`0x1030A050` vale `3.6640000343322754` leído como `double`, pero el código hace
`fld dword`: es un `float`. Para traducir hay que usar
[`constants_types.csv`](constants_types.csv), no la columna `as` de `constants.csv`.

## 6. Control por MIDI

El detalle nativo está en
[`../NeuronVS_vst2/README.md`](../NeuronVS_vst2/README.md#midi). Resumen de lo que
importa para el port:

- **Lo que el binario entiende**: nota on/off (omni, velocidad), CC 1, 2, 3, 4 y 11
  (→ los 6 controles de ejecución de `params+0x44`), CC 32 (banco), program change,
  channel pressure (→ control 0) y pitch bend (±rango en semitonos). Ningún otro CC.
- **Lo que el host puede automatizar**: sólo **26 parámetros** con nombre, no las 445
  claves: los 24 `R<n>L<n>{Sphere,Scape}{1,2}Value` y `FilterFreq`/`FilterReso`.
- **Lo que se hacía fuera**: los proyectos del usuario son puentes para suplir esa
  carencia. `Neuron_CC_Map` (Max for Live) mapea 26/32 CC a parámetros del plugin a
  través del host; `neuroncontrol4.pd` tiene 26 `ctlout` con etiquetas
  `R1L1Sphere2Value…`; `Neuron VS.pd` usa los pares 16/17, 35/36 y 52/53 para las
  almohadillas XY; `MYELIN MIDI CC v3a.jzml` barre CC 16–27, 33–63 y 85–91. Ninguno
  de esos números aparece en el `switch` de `callback_1000b7f0`: **el plugin no los
  entiende**, pasan por la automatización del DAW.

Es decir: el "control por MIDI estándar" del original es más pobre de lo que su
ecosistema sugiere, y un port puede mejorar ahí sin miedo a romper compatibilidad.

## 7. Qué queda por delante

Números, sin planificar:

1. **12.665 líneas** de pseudocódigo a traducir (87 funciones), con x87 `float10`
   repartido por las rutas que acumulan. Es el 27,8 % de `.text`, no el 90 %.
2. **`FUN_10040550`** (2.125 líneas) es el acoplamiento único entre preset y motor;
   traducirlo mal hace que todo lo demás dé igual.
3. **Fidelidad de bloque**: 128 muestras, resto arrastrado, clip a cero. Sin eso, el
   oráculo de [`../NeuronVS_port/golden/`](../NeuronVS_port/golden/) no cierra.
4. **Voces**: 128 slots y 49 KB por nota (6 × 2.056 floats). En un port moderno eso
   puede ser asignación perezosa, pero el orden de asignación y robo **sí** hay que
   reproducirlo: el oráculo ya midió que el estado global cambia el resultado
   (`--only steal` da pico 0,6005 frente a 0,7792 dentro de la secuencia completa).
5. **Bend**: el rango sale de `engine+8` (por defecto 2 semitonos) y la ley es
   exponencial con `1/12`; no hay tabla, así que la única duda es el redondeo de `pow`.

Lo que **no** es un problema, con la evidencia de este directorio: el tamaño del
motor, el grafo de llamadas (cerrado, sin indirectas), las constantes (98 %
recuperables), la lectura de curvas y bandas (ya portada) y el modelo de parámetros
(445 registros de 40 B con sus valores por defecto en el binario).
