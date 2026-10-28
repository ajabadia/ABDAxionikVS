# NeuronVS — estudio de ingeniería inversa

Estudio del sintetizador **Hartmann Neuron / NeuronVS** (VST2 de 32 bits) para saber
qué habría que reescribir para tener un equivalente en C++ moderno, y cuánto es. No es
un port: es la medida del terreno, con cada afirmación comprobable contra
`NeuronVS.dll`.

Todo se verifica con scripts; no hay conclusiones «de memoria». Cada directorio tiene
su README y su `tools/verify_*.py`.

## Mapa

| Directorio | Qué contiene | Verificación |
|---|---|---|
| [`NeuronVS_decompiled/`](NeuronVS_decompiled/README.md) | 1.024 funciones descompiladas, una por fichero | — |
| [`NeuronVS_classes/`](NeuronVS_classes/README.md) | 29 clases, vtables, constructores y destructores | `tools/verify_classes.py` |
| [`NeuronVS_resolved/`](NeuronVS_resolved/README.md) | llamadas por vtable resueltas a función concreta | `tools/verify_resolved.py` |
| [`NeuronVS_dsp/`](NeuronVS_dsp/README.md) | el camino de audio: 87 funciones, constantes, frontera con `params`, tablas de tecla, la suma R1/R2 del render | `tools/verify_dsp.py`, `tools/verify_zones.py`, `tools/verify_r1r2_mix.py` |
| [`NeuronVS_preset_format/`](NeuronVS_preset_format/README.md) | `.sound`: 445 claves, el registro de 40 B y sus observadores | `tools/verify_preset.py` |
| [`NeuronVS_observers/`](observers/README.md) | los 335 enganches de observador de `params`, los 4 callbacks recuperados y la matriz con su defecto | `tools/verify_observers.py`, `tools/verify_matrix.py` |
| [`NeuronVS_layout/`](NeuronVS_layout/README.md) | el editor GDI: 33 páginas, sprites, enlace knob↔parámetro | `tools/verify_layout.py`, `verify_viewer.py` |
| [`NeuronVS_bitmaps/`](NeuronVS_bitmaps/README.md) | recursos gráficos y su decodificación | — |
| [`NeuronVS_filmstrip/`](NeuronVS_filmstrip/README.md) | filmstrips de los knobs (GIF) | `tools/verify_gif.py` |
| [`NeuronVS_neurondb/`](NeuronVS_neurondb/README.md) | `.model`, slots, reordenado sin romper sonidos | `tools/verify_neurondb.py` |
| [`NeuronVS_vst2/`](NeuronVS_vst2/README.md) | ABI del plugin, opcodes, MIDI | `tools/scan_midi_bridges.py` |
| [`NeuronVS_compare_presets/`](NeuronVS_compare_presets/README.md) | comparación de presets del host contra el fichero | — |
| [`NeuronVS_port/`](NeuronVS_port/README.md) | esqueleto C++ del port (sin JUCE todavía) y oráculo golden | `tools/verify_scaffold.py`, `verify_golden.py` |
| [`Neuron80GB-OS15/`](Neuron80GB-OS15/README.md) | la base instalada de 80 GB: modelos, nombres, slots | `tools/verify_tib_models.py` |
| [`SYSEX.md`](SYSEX.md) | Protocolo SysEx oficial Hartmann (`0x00 0x20 0x50`), presets y layout `CSilverRack` `e[0xD95]` | — |

## Lo que está establecido

### El motor son 87 funciones

`FUN_100382b0` (3.648 B, 1.781 líneas) orquesta el bloque. Alcanza **87 funciones**,
**81.159 B** de código, **12.665 líneas** de pseudocódigo, **27,8 %** de `.text`, con
**0 llamadas indirectas** en el conjunto y 48 hojas. Todas viven entre `0x10021C90` y
`0x100478D0`: es un módulo contiguo, no un grafo disperso.

Detalle: [`NeuronVS_dsp/README.md`](NeuronVS_dsp/README.md) §1.

### Tres estados, y sólo uno suena

| Objeto | Tamaño | Papel |
|---|---:|---|
| `snddat` (`core+0x3dc`) | 445 × 40 B | lo que **configura** (espejo del `sound.script`) |
| `params` (`core+0x3e8`) | 11.484 B | lo que **traduce** (6 controles, 335 observadores, `+0x278c`) |
| `engine` (`core+0x3e0`) | 13.948 B | lo que **suena** |

La frontera es `FUN_10040550` (15.226 B, 2.125 líneas), con tres llamadores y ninguno
en el render. El registro de 40 B **no lo lee el motor**: publica su valor a los
observadores; de sus diez dwords sólo tres cruzan (`+0x0c`, `+0x10`, `+0x1c`).

Detalle: [`NeuronVS_dsp/STATE_SPLIT.md`](NeuronVS_dsp/STATE_SPLIT.md) y
[`NeuronVS_preset_format/PARAM_RECORD.md`](NeuronVS_preset_format/PARAM_RECORD.md).

### Las constantes, medidas

De las **1.430** globales del camino de audio, **708** se pueden tipar por la
instrucción que las carga: **402** confirman la propuesta del CSV de valores y
**306** la corrigen (151 `f64` que son `f32`, 117 `u32` que son `f32`, 31 `u32` que
son `f64`). Las otras 722 se pasan por dirección a un helper, así que su ancho no se
puede leer en el sitio de la referencia.

Detalle: [`NeuronVS_dsp/CONSTANT_TYPES.md`](NeuronVS_dsp/CONSTANT_TYPES.md).

### El `.sound` es texto, y el registro es binario

445 claves `clave<TAB>entero`, CRLF, en orden de esquema; 351 presets instalados;
claves desconocidas ignoradas y la última repetida gana. En memoria, cada una se
expande a un registro de **40 B** con `name`, `min`, `max`, `default`, `step`,
`value` (float) y una matriz de **16** observadores.

Detalle: [`NeuronVS_preset_format/README.md`](NeuronVS_preset_format/README.md).

### Cambiar de modelo no es asignar un parámetro

El callback `0x10013620` (el del `R1ModellIndex`/`R2ModellIndex`) no se limita a
anotar un número: adquiere el modelo de la banca de `0x10055738`, reescribe los seis
registros `Sphere`/`Scape` de esa capa (`name`, variante y default), registra las 128
entradas del modelo en el motor y termina llamando al traductor con todo `params`. Es
la operación más cara del plugin. Detalle en
[`NeuronVS_preset_format/OBSERVER_CALLBACK.md`](NeuronVS_preset_format/OBSERVER_CALLBACK.md).

### Las 128 entradas por tecla

Un modelo no entrega buffers al motor: entrega **128 entradas de 40 B** (una por tecla
y capa) que el render copia en `engine+0xDB0` (R1) y `+0x2200` (R2). La cadena es
`map.script` (1.027 líneas) → registro de zona de 48 B → entrada de 40 B, y la
escritura la hace `FUN_100440d0` con nueve argumentos. El motor lee `root`, dos pares
`scape`/`sphere` (grave y agudo), `detune` y `volume`; los otros dos dwords van a cero.
Las 128 entradas son **estado derivado**: se reescriben enteras en cada cambio de
modelo, así que el port no necesita inventariarlas, sólo reproducir el banco
zona→tecla. Detalle en [`NeuronVS_dsp/ZONES.md`](NeuronVS_dsp/ZONES.md).

### MIDI

Lo que el binario entiende: nota on/off, CC 1, 2, 3, 4 y 11 (los seis controles de
ejecución), CC 32 (banco), program change, channel pressure y pitch bend. El host sólo
expone **26 parámetros**, que son **13 pares**: 12 de `Sphere`/`Scape` por capa y
`FilterFreq`/`FilterReso`.

Detalle: [`NeuronVS_vst2/README.md`](NeuronVS_vst2/README.md#midi).

### Los observadores, y la matriz que mueven

[`observers/`](observers/README.md) es el índice que enlaza el
`.sound` con los valores efectivos: **335 enganches** del ctor `FUN_1000be10` (una
fila por `call FUN_100010a0`), cada uno con su registro `snddat`, su offset en
`params` (`0x280+k*0x18`), su ventana `min`/`max` —**662/662** campos iguales a los
que escribe el ctor, con los únicos blancos de `0x280` y la pareja `400`/`480` de
`0x298`— y su callback (5 distintos, **4** recuperados aquí: `stModDest`,
`stModDepth`, `stGPEngineCb` y el universal `stSPEngineCb`). Cada slot `p[0..316]`
tiene exactamente un observador; las 5 filas especiales y 13 `SoundMFX` se quedan
sin slot en el DLL original (y en `ABDAxionikVS` se extienden a los slots `380..392`).

De ahí sale la matriz de modulación y su defecto: `FUN_100134e0` copia
`clip(base + profundidad·valor)` en `p[tabla[dest]]`, y su rama del índice `-1`
—la que cierran los seis controles MIDI— escribe 0x150 B más allá del objeto
`params`, en el `ctx[3]` del bloque de contexto que el heap deja contiguo: ese
destino queda **desenganchado** y pasa a escribir `p[slot]` sin recorte ni
modulación (0 o 1 por corrida, según el heap; 13 presets con el evento en el log
del arnés). Esto cierra de «Abierto» la entrada del mapa `0x10049E00` (63 destinos
+ terminador `0`; el único índice libre alcanzable es `-1`) y el mecanismo de «quién
llena `+0x278C`».

Saldo completo de preguntas cerradas y abiertas: [`observers/HANDOFF.md`](observers/HANDOFF.md).

## Abierto

- **¿El render lee `params` en caliente?** **Resuelto**: el render lee exclusivamente los valores efectivos en `p[]` (`+0x278C`). La sonda en caliente (`neuron_golden --mirror`) y la auditoría de referencias cruzadas confirmaron que los campos espejo `params+0x0C` y `params+0x10` (escritos por `stSPEngineCb` en los slots 164 y 194) nunca son leídos por ninguna función de síntesis ni proceso de audio (*dead mirrors*). La constante `0x10049f00` que compara `p[slot]` es `1.0 / 25.4` (umbral físico de 1 mm para cotas de envolvente en pulgadas).
- **Quién llena los slots sin enganche**: el mecanismo ya está resuelto (el
  callback del observador escribe `base[dest]`, `FUN_100134E0` los seis routeados y
  el destino caído escribe `p[slot]` a pelo), pero de los 340 dwords de `+0x278C`
  los de `0..316` tienen su observador en el mapa
  ([`observers/`](observers/README.md)) y los **317..339** son cola sin fila (`FUN_10040550` lee `p[0..244]` y `FUN_100343e4` lee `p[245..313]`).
- **722 constantes sin ancho medible** (se pasan por dirección).
- **Las cuatro funciones grandes del render** (`FUN_100382b0`, `FUN_10040550`,
  `FUN_10029e34`, `FUN_1002e7a0`) — ya portadas en `ABDAxionikVS`.

## Verificar todo

```bash
python NeuronVS_dsp/tools/verify_dsp.py             # 73 comprobaciones
python NeuronVS_dsp/tools/verify_zones.py           # 101 comprobaciones
python NeuronVS_preset_format/tools/verify_preset.py
python NeuronVS_classes/tools/verify_classes.py
python NeuronVS_resolved/tools/verify_resolved.py
python NeuronVS_layout/tools/verify_layout.py
python NeuronVS_port/tools/verify_scaffold.py
python NeuronVS_neurondb/tools/verify_neurondb.py

# sólo Win32: el traductor contra el DLL, primero tras cargar el preset y luego
# con una nota sonando (18 de los 351 presets dan 1 ULP en la segunda pasada;
# ver NeuronVS_port/docs/TRANSLATOR.md §8)
NeuronVS_port/build32/Release/neuron_golden.exe --translate --preset 000,176,285,337
python Neuron80GB-OS15/tools/verify_tib_models.py
```

Los ocho primeros pasan en este checkout. El último necesita la base de 80 GB
instalada: si no está, encuentra 0 modelos y reporta 3.135 «problemas» que son
ficheros ausentes, no inconsistencias del código.

## Lo que no se hace

- Portar el editor GDI: la UI se reescribe, no se emula.
- Completar el VST2 como producto ni enlazar el SDK de Steinberg.
- Emular el dongle o el dispositivo «Nuke».
- Convertir nada a MIDI.
