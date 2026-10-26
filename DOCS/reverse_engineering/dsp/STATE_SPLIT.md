# Dónde acaba el componente de parámetros y empieza el motor

Esta nota responde a una pregunta concreta: **qué estado del sintetizador suena y
cuál sólo configura**, y dónde está la frontera exacta entre los dos. Todo lo que
sigue se puede comprobar con [`tools/verify_dsp.py`](tools/verify_dsp.py).

## 1. Los objetos y quién apunta a quién

`C_NeuronCore` (1.008 B, el `objectPtr` del `AEffect` vive en `core+0x20`) crea seis
componentes y guarda el puntero de cada uno en un dword fijo. Del constructor
`FUN_1001b140`:

| Slot | Byte | Componente | Tamaño | Ctor |
|---|---|---|---|---|
| `core[0xf6]` | `+0x3d8` | `remote` (enlace NJSE / "Nuke") | 4 B | `FUN_10016790` |
| `core[0xf7]` | `+0x3dc` | **`snddat`** — los 445 registros | 12 B | `FUN_10013de0` |
| `core[0xf8]` | `+0x3e0` | **`engine`** — estado que suena | 4 B → 13.948 B | `FUN_10038220` |
| `core[0xf9]` | `+0x3e4` | `noise` — gestor de voces | 196 B | `FUN_1000b500` |
| `core[0xfa]` | `+0x3e8` | **`params`** — valores de ejecución | 11.484 B | `FUN_1000be10` |
| `core[0xfb]` | `+0x3ec` | `editor` (GDI, se descarta) | 2.820 B | `FUN_1001bad0` |

`noise` recibe los dos punteros que importan y los guarda:

```c
FUN_1000b500(core, engine /*+5 → 0x14*/, params /*+6 → 0x18*/)
```

`params` también conoce a los otros dos: `FUN_1000be10` escribe
`params[0x9e] = snddat` (`+0x278`) y `params[0x9f] = engine` (`+0x27c`).

El `AEffect` sólo enseña 26 parámetros (`core+0x128 + i*0x18`), y cada descriptor
apunta a un registro de `snddat`: `descriptor = snddat->table + índice*0x28`
(`DAT_1004f4e8`, 26 índices).

## 2. `snddat` — lo que configura (445 × 40 B)

- `FUN_10013de0` copia los valores por defecto de una tabla de `.rdata`
  (`0x10049f14` … `0x1004cfc0`, **445 entradas de 28 B**) a registros de **40 B**.
- El array lo aloja `FUN_10001870(0x1bd)`: `445*0x28+4` bytes.
- El valor numérico del registro está en **`+0x1c`** (lo usa el propio oráculo en
  `NeuronVS_port/tools/neuron_golden.cpp`, `EngineView::value`).
- Es el espejo binario del `sound.script`: mismas 445 claves, mismo orden.

`snddat` es **sólo configuración**: ningún código del motor lo recorre.

## 3. `params` — lo que traduce (11.484 B, `0x2CDC`)

Mapa comprobado por los accesos de `FUN_1000be10`, `FUN_10013490` y `FUN_100134e0`:

| Offset | Qué hay | Quién escribe |
|---|---|---|
| `+0x14` | 6 `int`: índices de fuente de modulación | ctor |
| `+0x44` | **6 `float`: controles de ejecución** (CC 1/2/3/4/11 y presión) | `FUN_10013490` |
| `+0x17c` | 6 `float`: valor de cada fuente | ctor / cambios |
| `+0x278` | puntero a `snddat` | ctor |
| `+0x27c` | puntero a `engine` | ctor |
| `+0x280` … `+0x21e8` | **335 observadores de 24 B** enganchados a otros tantos registros de `snddat` | `FUN_100010a0(...,0,5)` ×335 |
| `+0x2b0` | ventanas min/max que usa `FUN_100134e0` (`0x2b0 + slot*0x18`), o sea el tercer observador | ctor |
| `+0x278c` … `+0x2cc8` | **valores efectivos por slot**, 340 dwords | `FUN_100134e0` |
| `+0x2cc0`, `+0x2cc4` | `440.0`, `440.0` (referencia de afinación; función exacta sin confirmar) | ctor |

La tabla de 24 B es la pieza que faltaba para entender el objeto: cada **slot** de
ejecución tiene un descriptor (límites, y al menos dos floats más) y un valor
efectivo en `+0x278c+slot*4`. `FUN_100134e0` recorta el valor a los límites del
descriptor antes de escribirlo.

El mapa índice→slot está en `.rdata` en **`0x10049e00`**, pero es **más corto de lo
que parecía**: exactamente **64 entradas** válidas (valores 0…240, todos distintos);
a partir de la 65 hay floats y punteros, no enteros. `FUN_100134e0` lo usa con
índices 0…5 (los seis controles) y con `param_2` libre en la última rama; con un
índice >63 eso leería fuera de la tabla. Queda anotado como **duda abierta**, no como
conclusión: ver §6.

Los 64 valores van casi todos en **parejas de slots consecutivos** —
`28,29 · 19,20 · 46,47 · 37,38 · 64,65 · 55,56` —, lo que encaja con un par
izquierda/derecha por capa. Es una hipótesis, no un hecho: la lista no es monótona y
el final (`221,227,228,216,217,231,232,0`) se rompe.

## 4. `engine` — lo que suena (13.948 B)

`FUN_10044884` (5.215 B) construye el motor y aloja además dos tablas grandes
(541.640 B y 353.960 B). Lo que está identificado:

- `+0xda4` / `+0xda8`: bend normalizado y **factor de frecuencia** (`2^((2b−1)·rango/12)`,
  `FUN_1003d7a0`);
- `+0x2ca` … `+0x2e1`: tablas de coeficientes escritas por el traductor;
- `+0x306`: flag por capa; `+0xd94`: base del array de descriptores de nota de
  `0x70` B cada uno — se alojan **129** (0x3874 B en total) y el barrido se
  limita a `+0xda0`, que vale 32; cada descriptor lleva **dos motores** de
  `0x6838` B en `+0x68`/`+0x6C` (ver [`ZONES.md`](ZONES.md) §6.1); `+0x8`: rango
  de bend en semitonos (2 por defecto).

Los descriptores no se alojan en `noise`: están en el estado del motor (`+0xd94`)
y `noise` sólo guarda punteros a los que suenan (`+0x3c` array, `+0xc0` flags,
`+0x38` nº de slots = 128). Cada nota así reservada tiene sus dos motores, y cada
motor sus propias tablas de capa.

## 5. El traductor y la frontera

**`FUN_10040550` (15.226 B, 2.125 líneas) es la frontera.** Recibe el **holder**
del motor por `ECX` (`0x1004057A`: `mov esi,[ecx]`; `esi` es el estado de
0x367C) y `params+0x278c`, y deja el motor listo para sonar. Sólo se llama desde:

| Llamador | Cuándo |
|---|---|
| `FUN_100132d0` | cargar un sonido |
| `FUN_100134b0` | mover el pitch bend |
| `FUN_100134e0` | cambiar un parámetro |

Y sólo `FUN_100134e0` escribe el array de valores efectivos. Es decir:

```text
.sound ─→ snddat (445×40) ─→ params[+0x278c] ─→ FUN_10040550 ─→ engine ─→ voces ─→ salida
             configura                   traduce                suena
```

**Prueba estructural de que la frontera es real:** las 87 funciones del render
(las de `callgraph.csv`) están **todas** en el rango `0x1002xxxx`–`0x1004xxxx`, que
es el módulo del motor. Ni una sola pertenece al módulo de `params`
(`0x1000bxxx`–`0x10013xxx`). Y el grafo es cerrado (0 llamadas indirectas), así que
no hay un salto escondido por puntero a código del cargador.

Lo que esta prueba **no** descarta: que alguna función del motor lea un campo de
`params` al que ya tiene puntero (no hace falta llamar a su código para eso). Para
cerrarlo hace falta la prueba dinámica de §6.

## 6. Lo que falta por cerrar (y cómo)

1. **¿El render lee `params` en caliente?** Diseño de la prueba: dos ejecuciones
   idénticas en procesos separados, una de ellas con el array `+0x278c` y los seis
   controles de `+0x44` sobreescritos con un centinela justo después de cargar el
   preset; si el WAV sale idéntico, el motor no los lee. Necesita una herramienta
   x86 que exponga los punteros (`core+0x3e0`/`+0x3e8`) y reutilice el arnés del
   oráculo. No hay Python de 32 bits en la máquina, así que es una herramienta C++
   pequeña, no un script.
2. **El mapa `0x10049e00`.** Con 64 entradas válidas y `param_2` libre en una rama,
   hay dos lecturas: (a) la tabla real es de 64 y el índice siempre está en rango
   por construcción; (b) el original lee fuera de la tabla en esa rama. Se resuelve
   mirando los llamadores de `FUN_100134e0` (el callback `LAB_1001b7d0`) y con qué
   índice llegan.
3. **Quién llena el resto de `+0x278c`.** `FUN_100134e0` sólo escribe el slot del
   parámetro que cambia; el resto (hasta 340 slots) tiene que venir del cargador
   `.sound` o del arranque. Candidato: `FUN_10013ea0` (`SoundData::load`).
