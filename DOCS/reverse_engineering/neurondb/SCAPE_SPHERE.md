# `.scape` y `.sphere` — del cargador al motor

Los dos binarios del modelo (`Models/NNN.model/NNNNNN.scape` y `.sphere`) llegaban
al motor como punteros opacos: `FUN_1000b490` lee el fichero entero y el cargador
no lo interpreta. Este documento cierra ese hueco: sigue los buffers hasta las
dos rutinas que los leen, y describe el formato que esas rutinas esperan,
contrastado con los datos reales del modelo 511.

## La cadena completa

```
NeuronDB/Models/511.model/
  map.script ──► FUN_1000a930   arma los registros por tecla (128 zonas)
                   │  guarda los índices de source de la zona en +0x0c / +0x10
                   ▼
                 FUN_1000b230    «%s/%06d.scape» y «%s/%06d.sphere»
                   ▼
                 FUN_1000b490    _open/_lseek/_read de todo el fichero
                   │            devuelve (buffer, tamaño)
                   ▼
   registro del modelo:  +0x14 puntero scape   +0x18 puntero sphere   (fuente A)
                         +0x1c puntero scape   +0x20 puntero sphere   (fuente B)
                   …
MIDI ─► effProcessEvents ─► 0x1000a070 ─► 0x1000b7f0 ─► FUN_1000ba70 (nota)
                   ▼
                 FUN_1003d800    crea la voz y sus osciladores
                   ▼
                 FUN_10032970    engancha el modelo a cada oscilador
                   ▼
                 FUN_10032d10    valida y copia las cabeceras   ◄── los dos buffers
                   ▼
   objeto de voz:  +0x6414 int16* (payload scape)   +0x63f8 (payload sphere)
                   +0x6364 largo   +0x6334/0x6338/0x633c/0x6340/0x6344/0x6348
                   +0x63fc/0x6408/0x640c/0x6410   +0x6308 id base  +0x6304 sphere*
                   ▼
   render:  FUN_100317b0  lee el scape (int16, interpolado)
            FUN_10031950  lee el sphere (frames, 25 bandas × 4 floats)
            FUN_1003bd10 / FUN_1003c980  leen el bloque de 6152 B
                          (1024 parciales) vía FUN_1002e750
```

Evidencia de cada salto (todas las llamadas son directas, salvo donde se indica):

| Salto | Prueba |
|---|---|
| `FUN_1000b230` → `FUN_1000b490` | llamadas en `0x1000b389`, `0x1000b3c3`, `0x1000b426`, `0x1000b462` (dos por modelo); cadenas `0x1005257c` / `0x1005258c` |
| `FUN_1000a930` → `FUN_1000b230` | llamada en `0x1000ac48`; `FUN_1000b230` guarda en `+0x14/+0x18/+0x1c/+0x20` |
| `FUN_1003d800` → `FUN_10032970` | llamadas en `0x1003f32d` y `0x1003f368` (una por capa: tabla R1 y tabla R2) |
| `FUN_10032970` → `FUN_10032d10` | llamada en `0x10032a72` |
| render → `FUN_100317b0` | p. ej. `0x1002f033`, `0x1002f081`, `0x1002f294` |
| render → `FUN_10031950` | p. ej. `0x1002f066`, `0x1002f0bd`, `0x10030ba3` |
| `FUN_1003b9f0` → `FUN_1002e750` (bloque) | `0x1003bbdc`, `0x1003bbf9`, `0x1003bca2` |
| `FUN_1003b9f0` → `FUN_1003c980` / `FUN_1003bd10` | `0x1003bc1a`, `0x1003bc77`, `0x1003bcc9` |

Los callers salen de recorrer `.text` con capstone (`tools/verify_model_binary.py`
los vuelve a derivar del DLL). El reparto de voz a oscilador es de `FUN_1003d800`,
cuyo init fija `+0x15c` (incremento de fase) y `+0x160` (ganancia) que luego usa
`FUN_100317b0`. Las dos llamadas a `FUN_10032970` llevan los mismos argumentos de pila
y sólo cambian la tabla (R1 `+0xDB0`, R2 `+0x2200`) y el motor que recibe cada
una: son los dos motores del **mismo** voice (`descriptor+0x68` y `+0x6C`) — ver
[`../NeuronVS_dsp/ZONES.md`](../NeuronVS_dsp/ZONES.md) §6.

## Contenedor

Los dos ficheros son una cadena de chunks con el mismo esquema, y el `size`
**incluye** la cabecera de 8 bytes (como RIFF):

| Offset | Campo |
|---|---|
| `+0x00` | etiqueta de 4 bytes: 2 de tipo + `AN` |
| `+0x04` | `uint32` tamaño total del chunk |
| `+0x08` | payload |

| Chunk | Etiqueta | Tamaño | Contenido |
|---|---|---|---|
| tipo | `csAN` (scape) / `psAN` (sphere) | 100 / 140 | cabecera del fichero (abajo) |
| nombres | `mnAN` | 104 | 12 nombres de 8 caracteres ASCII |
| pares | `fdAN` | 56 | 6 pares de `float` (48 B de payload) |
| datos | — | resto | sin etiqueta; empieza justo después de `fdAN` |

`FUN_10032d10` no compara las etiquetas de 32 bits, sino **el primer byte**: el
scape debe empezar por `'c'` o `'N'` y el sphere por `'p'` o `'N'`; si no, el
modelo se descarta. De ahí que una búsqueda del inmediato `'csAN'` en el código
no encuentre nada.

Nombres del modelo 511 (12 + 6 pares):

```
scape  mnAN: Torsion HiTurbul Neutral LoTurbul Warm Planar Cold Tubular
             Influenc HiIrregl Influenc LoIrregl     (Influenc se repite)
sphere mnAN: SmallBdy Stringed LargeBdy Natural StrTuneL 2SemiDwn StrTuneH
             2SemiUp Dissolvd LoFrictn Coherent HiFrictn
scape  fdAN: (0,0) (1,1) (0,0) (1,1) (0,0) (1,1)
sphere fdAN: (0,0) (1,1) (0.609756,0.5) (0.390244,0.5) (0,0) (1,1)
```

Los 12 nombres del `mnAN` son los ejes de morfología; el cargador los copia a dos
arrays de 12×9 bytes del banco, en `+0x234` y `+0x2d0` (`strncpy(...,8)` dentro de
`FUN_1000a930`, un bucle de 12). Los 6 pares del `fdAN` se copian
tal cual al objeto de voz: `+0xd4` → `+0x6398` (scape) y `+0xfc` → `+0x63c8`
(sphere), con `FUN_10046f50` / `FUN_10046f10` (48 bytes cada uno).

## Cabecera `.scape`

| Offset | Tipo | Valor 511 | Destino en la voz | Papel |
|---|---|---|---|---|
| `+0x08` | int32 | 256 | — | formato/versión de la curva |
| `+0x0c` | int32 | `0xC1B5D423` | `+0x6308` | id de la curva; debe coincidir con el del sphere |
| `+0x10` | int32 | 100 | — | resolución (muestras por ciclo del análisis) |
| `+0x14` | int32 | 0 | — | flags |
| `+0x18` | int32 | 66940 | `+0x6364` | largo útil en muestras |
| `+0x1c` | int32 | 31472 | `+0x6340`, `+0x6334` | inicio del bucle |
| `+0x20` | int32 | 62843 | `+0x6344`, `+0x6338` | fin del bucle |
| `+0x24` | int32 | 0 | — | sólo se rellena con modelos antiguos |

`+0x1c` y `+0x20` también se materializan como floats (`+0x6334`/`+0x6338`) y su
diferencia (`+0x633c`, y como entero en `+0x6348`), que es lo que usa el lector
para cerrar el bucle.

## Payload `.scape`

Desde `+0x104`, `int16` little-endian; `FUN_10032d10` guarda ese puntero en
`+0x6414`. En el modelo 511: **68.608 muestras** (137.216 B), rango −1708…+1551,
`length` 66.940 y bucle `[31472, 62843)`.

Lo que hace `FUN_100317b0` en cada llamada:

1. avanza la fase: `pos += *(float*)(this + 0x15c)`;
2. si `+0x6350 == 1` (bucle) y `pos >= fin` → `pos -= (fin - inicio)`;
   si no hay bucle y `pos > largo - ε` → `pos = 0` y marca fin (`+0x6835 = 1`);
3. toma `i = (int)pos`, `frac = pos - i`, `j = i + 1`, y si `j >= fin` resta el
   largo del bucle;
4. interpola: `v = (1 - frac) * s[i] + frac * s[j]`;
5. devuelve `(2 * (v - v_prev) + v) * *(float*)(this + 0x160)` y guarda `v` en
   `+0x8`.

Es decir: tabla `int16` leída con interpolación lineal sobre una fase que avanza a
la frecuencia de la voz, con salida **diferenciada de dos puntos** (la forma
habitual de convertir una curva de fase en una onda limitada en banda) y ganancia
en `+0x160`.Datos observados: la serie es cuasiperiódica con periodo **100 muestras** (441 Hz si se reproduce a 44,1 kHz), 686 ciclos, con un *fade-in* al principio y amplitud estabilizada en ~1087 de RMS; el contenido armónico del primer ciclo cae como `1/n` (144, 65, 35, 25, 20, 16, 14, 12). Encaja con la muestra analizada del modelo, muestreada como curva de fase.

Ese `1/n` es sólo el ataque: el fundido dura **tres ciclos** (6,8 ms) y a partir del cuarto el ciclo es un **seno** con el segundo armónico 52 dB por debajo del primero. La curva, pues, aporta el tono (441 Hz, la raíz del modelo) y el cuerpo lo aporta el bloque de parciales del `.sphere`; [`SYNTH_FRAMES.md`](SYNTH_FRAMES.md) sintetiza las dos cosas y deja los WAV para oírlo.

## Cabecera `.sphere`

| Offset | Tipo | Valor 511 | Destino en la voz | Papel |
|---|---|---|---|---|
| `+0x08` | int32 | 288 | `+0x6368` | versión/estampa; si `< 0x112` se aplica la ruta antigua |
| `+0x0c` | int32 | `0xC1B5D423` | `+0x6308` | id base de los frames (ver abajo) |
| `+0x10` | int32 | 0 | — | contador heredado (sólo se copia a `scape+0x24` si versión `< 0x112`) |
| `+0x14` | int32 | 100 | `+0x634c` | resolución |
| `+0x18` | int32 | 64 | `+0x63fc` | **frames válidos** (límite del índice) |
| `+0x1c` | int32 | 1 | — | modos de stick |
| `+0x20` | int32 | 4 | `+0x6408`, `+0x44` | parciales por suma; `+0x44 = 3` (índice del anillo) |
| `+0x24` | int32 | 4 | — | floats por banda (paso) |
| `+0x28` | int32 | 25 | `+0x6410`, `+0x184` | bandas |
| `+0x2c` | int32 | 25 | — | bandas (duplicado) |
| `+0x30` | int32 | 6152 | — | tamaño del banco de parciales (ver abajo); 0 lo desactiva |
| `+0x34` | int32 | 31 | — | sin consumidor localizado |
| `+0x38` | int32 | 61 | — | sin consumidor localizado |
| `+0x3c` | int32 | 0 | `+0x630c` | 0 → 1024, 1 → 512 (máscara/denominador de fase) |
| `+0x40` | int32 | 0 | `+0x6300` | modo de stick; se rechaza si `> 1` |
| `+0x44` | int32 | 6568 | `+0x640c` | **paso de frame** |
| `+0x48` | int32 | 300 | puntero `+0x63f8` | offset del banco de frames |
| `+0x4c` | int32 | 0 | — | reservado |
| `+0x50` | 6×float | 441.43, 497.22, 16096.07, 0.5662, 16096.07, 0.5669 | `+0x636c`…`+0x6380` | constantes de modelado de la voz |

## Payload `.sphere`

En `+0x48` (300) empieza un array de frames de `+0x44` (6568) bytes:

```
struct SphereFrame {            // 6568 B
    int32  magic;               // +0x00  siempre 0x4D2 (1234)
    int32  id;                  // +0x04  id_base + índice de frame
    float  a, b, c;             // +0x08, +0x0C, +0x10
    float  bands[25][4];        // +0x10  25 "bandas" × 4 floats = 400 B
    uint8  partials[6152];      // +0x1A0 banco aditivo de 1024 parciales
}
```

- `FUN_10032940(sphere, i)` = `sphere + min(i, +0x18 - 1) * +0x44 + +0x48`.
- `FUN_10031cd0(sphere, i, banda)` = `+ 0x10 + banda * (+0x24) * 4` sobre el frame.
- `FUN_1002e750(sphere, i)` = `sphere + i·0x44 + 0x10 + (+0x24·+0x2c·4) + +0x48`;
  como `+0x48` es el inicio del banco de frames, el resultado es
  `frame_i + 0x1A0`, el bloque de `+0x30` (6152) bytes. Devuelve 0 si `+0x30`
  es 0. Con los valores del 511 el frame 0 empieza en 300 (`0x12C`) y su bloque
  en 716 (`0x2CC`), que es `300 + 0x1A0`.
- `FUN_10031950` valida `frame[0] == 0x4D2` y `frame[1] == índice + (+0x6308)`;
  si falla, marca la voz como terminada y devuelve 0.

## El bloque de 6152 B: el espectro de 1024 parciales

Lo que la cabecera llama `+0x30 = 6152` no es un relleno: es el banco de
parciales que sintetiza el cuerpo del modelo. `FUN_1003b9f0` lo enlaza en
`+0x18c`/`+0x190` con `FUN_1002e750`, y `FUN_1003c980` / `FUN_1003bd10` lo
recorren para llenar los arrays de frecuencia y amplitud del oscilador. La
aritmética cierra exacta: `8 + 3 × 1024 × 2 = 6152` y `0x1A0 + 6152 = 0x19A8`,
el paso de frame.

| Offset | Tipo | Valor 511 | Papel |
|---|---|---|---|
| `+0x000` | u16 | 1024 | capacidad; los lectores cortan en `0x400` |
| `+0x002` | u16 | 31040 / ~54130 | escala de normalización del frame; el motor la usa como factor (amplitud o frecuencia según el modo) |
| `+0x004` | u16 | 0 | sin uso |
| `+0x006` | u16 | 0 | sin uso |
| `+0x008` | 1024×u16 | 43…44100 | **frecuencia A** en Hz del parcial |
| `+0x808` | 1024×u16 | 65535…0 | **amplitud B**, descendente; el primer 0 termina la lista |
| `+0x1008` | 1024×u16 | 0…1023 | **bin C**, índice en el eje de 1024 bins / 44.1 kHz |

Pruebas en el código (desensamblado con capstone en
`tools/verify_model_binary.py`):

- `FUN_1002e750` usa `+0x18`, `+0x44`, `+0x48`, `+0x30`, `+0x24`, `+0x2c` y
  `+0x10`, y devuelve justo `frame + 0x1A0` con el 511. Está guardado por
  `+0x30 != 0`.
- `FUN_1003b9f0` llama a `FUN_1002e750`, `FUN_1003c980` y `FUN_1003bd10`, y
  exige que `+0x18c` y `+0x190` (los dos punteros al bloque) no sean nulos.
- `FUN_1003bd10` (modos 6, 7, 8 y por defecto) recorre 0…0x3FF, lee
  `bloque+2`, `bloque+8+2i` (A), `bloque+0x808+2i` (B) y
  `bloque+0x1008+2i` (C), y escribe pares frecuencia/amplitud en `+0x194` /
  `+0x1194`. En la ruta por defecto la frecuencia sale de C (`C · fVar4`) y
  la amplitud de B; los modos 6 y 8 usan A como Hz.
- `FUN_1003c980` hace lo mismo en su rama por defecto, recorre el bloque
  hacia atrás (`i = -0x400…-2`) y escribe 1024 pares; `FUN_1003b9f0` la llama
  cada vez que cambia el frame. Su modo 8 toma `A[0]` (`+8`) como referencia
  de frecuencia, y `FUN_1003bd10` (modo 7) vuelca el bloque en el banco de
  1024 osciladores.
- `FUN_10034290(frecuencia, amplitud)` acumula cada parcial en una tabla de
  1024 posiciones con `índice = frecuencia · (+0x4c) + c`; es el sumador
  aditivo que consume estos pares.

### Qué contienen los datos del 511

Los 64 frames que el motor puede alcanzar (`+0x18 = 64`):

| Comprobación | Resultado |
|---|---|
| capacidad `+0x000` | 1024 en los 67 frames almacenados |
| amplitud B descendente | sí en los 64 frames |
| primer 0 de B | 1023 parciales en el frame 0; 121–361 en los frames 1–63 |
| A frente a C | `A ≈ C · 44100/1024` (±2 bins como máximo); en el frame 0 el error medio es 1,9 Hz y el máximo 82 Hz |
| C | los 1023 parciales del frame 0 ocupan 2…1023 (el 1023 se repite), casi un parcial por bin; en los demás frames es dispersa |
| tabla 25×4 de `+0x10` | **idéntica en los 64 frames** (solo cambian los últimos bits del float); carriles 1–3 a cero |
| rango de A | 43…44100 Hz en los parciales activos; C 0…1023 |

Es decir: el frame 0 es un espectro completo (casi un parcial por bin, 43,07 Hz
de resolución), y los frames 1–63 son listas de picos de 121–361 parciales con la
misma envolvente (centroide ≈ 910 Hz, suma de amplitudes ≈ 131.000). En los 63
frames los tres picos más fuertes son los mismos bins 20, 21 y 22 (≈ 880 Hz), y
los dos primeros valen 65.535 y ≈ 56.880: lo que cambia de un frame a otro es
la cola de parciales débiles (cuántos hay y en qué bins caen), no la resonancia
principal. Encaja con 64 realizaciones del mismo cuerpo (un banco estocástico),
no con 64 timbres distintos.

La tabla de 25×4 floats no cambia entre frames: 25 valores de 0,9985 a 0,9902
(un 1 % de caída) y los otros tres carriles a cero. Es una ventana/ganancia de
morfología de 25 pasos, no el timbre; con un solo modelo no se puede saber si
en otros modelos varía.

El bloque B está normalizado: `B[0] = 65535` en todos los frames y la suma de
B se mantiene ≈ 131.000; `+0x002` (31040 en el frame 0, ≈54130 en el resto)
es la escala que acompaña a B para igualar la sonoridad. Los
frames 64–66 quedan fuera del límite `+0x18 = 64`: el 64 y el 65 llevan datos y
el 66 tiene la tabla de bandas a cero.

```bash
python NeuronVS_neurondb/tools/model_binary.py --partials 16 \
    "Hartmann Music/NeuronVS/NeuronDB/Models/511.model/000001.sphere"
python NeuronVS_neurondb/tools/model_binary.py --frame 32 --partials 8 ...
```

En el modelo 511 el fichero trae **67 frames** (440.056 B = 67 × 6568), todos con
`magic` e id contiguo, y `+0x18 = 64` limita el índice a `0…63`
(`FUN_10032940` hace `min(i, +0x18 - 1)`): los frames 64 y 65 existen y llevan
datos, pero el lector nunca los alcanza, y el 66 tiene la tabla de bandas a cero
(aunque su bloque de parciales no lo está). Los ids arrancan en `+0x0c`, lo que
confirma que ese campo es la **base de la numeración**, no un simple *checksum*.

Contenido del frame: `a` varía por frame (0.47773 → 0.47723), `b` = 100.0 fijo,
`c` = 0.99853 fijo; las 25 bandas llevan una ventana que cae de 0.99853 a 0.99021
y los otros tres floats de cada banda están a cero en este modelo. El lector
de `FUN_10031950` interpola **dos frames** con los pesos `+0x178`/`+0x17c`,
recorre `+0x6408` (4) parciales y suma `(banda_prev * w0 + banda_actual * w1) *
ganancia` en el anillo `+0x48` de la voz. Eso es solo la excitación de 4
parciales; el cuerpo de 1024 parciales del bloque `+0x1A0` lo consume el banco
aditivo de `FUN_1003bd10`/`FUN_1003c980`.

## Herramientas

```bash
python NeuronVS_neurondb/tools/model_binary.py "Hartmann Music/NeuronVS/NeuronDB/Models/511.model"
python NeuronVS_neurondb/tools/model_binary.py --json .../000001.sphere
python NeuronVS_neurondb/tools/verify_model_binary.py     # exit 0
python NeuronVS_neurondb/tools/synth_frames.py            # los WAV de SYNTH_FRAMES.md
python NeuronVS_neurondb/tools/verify_synth_frames.py     # exit 0
```

`model_binary.py` expone `load(path) -> Scape | Sphere` con `chunks`, `names`,
`fd_pairs`, `header`, `samples`, `frames`; cada `SphereFrame` trae `partials`
(índice, amplitud, Hz, bin) y `block_gain`.

`verify_model_binary.py` comprueba la estructura de los dos ficheros (cadena de
chunks, nombres ASCII, `magic` e ids de los frames, paso, cola silenciosa, el
bloque de 6152 B: capacidad, amplitudes ordenadas, A frente a C, tabla de 25×4
constante) y, contra el DLL, los offsets y llamadas citados (desensamblados con
capstone sobre `FUN_10032d10`, `FUN_10032940`, `FUN_10031cd0`, `FUN_100317b0`,
`FUN_10031950`, `FUN_1002e750`, `FUN_1003bd10`, `FUN_1003c980` y
`FUN_1003b9f0`).

## Límites

- El significado de `+0x34` (31) y `+0x38` (61) sigue sin localizar; no los lee
  ninguna de las rutinas analizadas.
- Los 6 pares del `fdAN` se copian al objeto de voz (`+0x6398`, `+0x63c8`) pero no
  he encontrado la lectura con esos desplazamientos; su papel (¿ventanas de
  fades?) queda sin confirmar.
- Los floats 1–3 de cada banda están a cero en el único modelo instalado, así que
  su uso no se puede deducir de los datos. La tabla completa es constante entre
  frames en el 511; con un solo modelo no se puede saber si en otros modelos
  varía y codifica la morfología del cuerpo.
- El papel exacto de A frente a C depende del modo del oscilador (`+0x6390`):
  A es la frecuencia en Hz y C el bin; el motor elige una u otra según la ruta.
  En el modo 7 los dos arrays se intercambian en los destinos, un detalle de
  implementación que no cambia el contenido del fichero.
- `FUN_100317b0` devuelve una señal diferenciada; que la curva sea la muestra
  analizada o una tabla de fase es **inferencia** a partir de la forma de los
  datos (periodo 100, armónicos 1/n, fade-in), no una lectura del código.
- Todo el análisis es estático: no se ha ejecutado el plugin contra estos datos.
