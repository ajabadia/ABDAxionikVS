# NeuronVS · maqueta del editor

Reconstrucción de la composición de la interfaz a partir de los recursos gráficos del DLL y de las tablas que los controles leen al construirse. El editor es un lienzo de **800x652** (`0x1001bc55`); todo lo demás son sprites y controles colocados encima.

**Resultado:** 42 bitmaps inventariados, **26 slots de sprite** en la tabla `0x1004d050`, **33 páginas** repartidas en 10 vistas, **429 controles montados** (el reparto página→control ya está descifrado), **211 entradas de geometría** en 9 tablas de control, **174 controles enlazados a su clave del preset** (170 de las 445 claves tienen control en la interfaz) y las **44 retro-referencias resueltas**: 13 enlazan un parámetro del motor (los 9 selectores de forma de onda y de modo), 18 son selectores de páginas de una vista, 9 son grupos de exclusión y 4 apuntan a un registro que se elige en ejecución. De los 26 slots, 6 se localizan en las pieles exactamente donde dice la tabla; el resto son contenidos que el editor dibuja en tiempo de ejecución (`C_BitmapBox` los crea al abrir la página). 5 de las páginas no tienen fondo propio: son contenedores que montan otras vistas. La hoja de contactos [`pages_sheet.png`](pages_sheet.png) pinta las 33 a la vez, compuestas, al 50 %, y [`pages_sheet.html`](pages_sheet.html) la convierte en una rejilla navegable: cada recorte enlaza `viewer.html#view=V&page=P` y abre esa página en el visor.

## De dónde sale cada imagen

`LoadBitmapA` aparece **una sola vez** en todo el binario: dentro de `C_Bitmap_create` (`0x10008d60`), que recibe el id y hace `LoadBitmapA(hInstance, MAKEINTRESOURCE(id))`; después mide el bitmap con `GetObjectA` y guarda ancho y alto. Ningún control llama a GDI directamente: todos pasan por ahí, así que el mapa de recursos se reconstruye siguiendo quién llama a `C_Bitmap_create` y con qué id.

| Clase | Ctor | Id que carga | Papel |
|---|---|---|---|
| C_BitmapBox | `0x100141a0` | tabla 0x1004d050[slot].id | paginas y tiras; slot 0..25 |
| C_Knob | `0x100145b0` | 11600 / 11601 | cuerpo de 50x50 + filmstrip de 90 fotogramas |
| C_Led | `0x10016000` | 11300 | LED de 15x7 |
| C_IconButton | `0x10016a00` | tabla 0x1004e290[indice].id | indice desde 0x1004e2b8[id].bitmap |
| C_DisplayButton | `0x10017470` | 11500 / 11501 | display 66x22 + icono 7x7 |
| C_PadGrid | `0x10018bb0` | 11400 / 11401 / 11410 | marcos de mando + matriz de 960x240 |

## Slots de sprite (`0x1004d050`)

`C_BitmapBox_ctor` (`0x100141a0`) acepta un slot 0..25 y lee una entrada de 12 bytes: `{bitmapId, y, x}`. Es la tabla que decide qué imagen aparece en cada página y dónde. La última columna es la comprobación de píxeles: se busca el bitmap en las cuatro pieles y se compara el SSD mínimo con la mediana del mapa; por debajo de 0.35 la posición se considera medida.

| Slot | Bitmap | Tamaño | Tabla x,y | Encontrado x,y | Piel | SSD/mediana | Estado |
|---|---|---|---|---|---|---|---|
| 0 | 10000 | 800x652 | 0,0 | 0,0 | 10000 | 1.000 | no localizado |
| 1 | 10300 | 203x46 | 21,446 | 21,446 | 10000 | 0.083 | confirmado |
| 2 | 10301 | 203x46 | 21,446 | 21,446 | 10000 | 0.185 | confirmado |
| 3 | 10302 | 203x46 | 21,446 | 21,446 | 10000 | 0.142 | confirmado |
| 4 | 10300 | 203x46 | 460,446 | 460,446 | 10000 | 0.083 | confirmado |
| 5 | 10301 | 203x46 | 460,446 | 460,446 | 10000 | 0.185 | confirmado |
| 6 | 10302 | 203x46 | 460,446 | 460,446 | 10000 | 0.142 | confirmado |
| 7 | 10001 | 800x652 | 0,0 | 0,0 | 10000 | 1.000 | no localizado |
| 8 | 10100 | 240x138 | 26,363 | 440,449 | 10000 | 0.626 | no localizado |
| 9 | 10101 | 240x138 | 26,363 | 440,449 | 10000 | 0.625 | no localizado |
| 10 | 10102 | 240x138 | 26,363 | 440,449 | 10000 | 0.627 | no localizado |
| 11 | 10110 | 240x138 | 26,363 | 0,442 | 10003 | 0.604 | no localizado |
| 12 | 10120 | 240x138 | 26,363 | 556,63 | 10000 | 0.533 | no localizado |
| 13 | 10121 | 240x138 | 26,363 | 2,514 | 10003 | 0.566 | no localizado |
| 14 | 10130 | 240x138 | 26,363 | 546,40 | 10002 | 0.628 | no localizado |
| 15 | 10140 | 240x138 | 26,363 | 414,423 | 10000 | 0.609 | no localizado |
| 16 | 10200 | 240x138 | 536,363 | 542,41 | 10002 | 0.554 | no localizado |
| 17 | 10210 | 240x138 | 536,363 | 543,40 | 10002 | 0.620 | no localizado |
| 18 | 10220 | 240x138 | 536,363 | 556,63 | 10000 | 0.531 | no localizado |
| 19 | 10221 | 240x138 | 536,363 | 2,514 | 10003 | 0.588 | no localizado |
| 20 | 10230 | 240x138 | 536,363 | 556,63 | 10000 | 0.531 | no localizado |
| 21 | 10231 | 240x138 | 536,363 | 2,514 | 10003 | 0.588 | no localizado |
| 22 | 10240 | 240x138 | 536,363 | 556,63 | 10000 | 0.531 | no localizado |
| 23 | 10241 | 240x138 | 536,363 | 2,514 | 10003 | 0.574 | no localizado |
| 24 | 10002 | 800x652 | 0,0 | 0,0 | 10000 | 1.000 | no localizado |
| 25 | 10003 | 800x652 | 0,0 | 0,0 | 10000 | 1.000 | no localizado |

## Páginas

El editor construye cada página con `FUN_1001c320`, que recorre los streams de `0x10054f6c` (uno por vista, terminados en 0). Cada registro es un array plano de `int` con esta gramática:

```
registro := slot hijos -1 comando* fin
hijos    := int*                      ; vistas montadas dentro de esta página
comando  := cmd(0x100..0x800) id* -1  ; una lista por clase de control
id       := int | -N                  ; -N es una retro-referencia
fin      := token negativo
```

`slot` indexa la tabla de sprites (el fondo de la página) y vale `-1` cuando la página no pinta fondo propio. `hijos` son índices de vista: así se montan las tiras de pestañas dentro de una página.

**Los tokens negativos.** Dentro de una lista de ids, `-1` cierra la lista. Cualquier otro `-N` apunta `N` ints atrás: el cargador reutiliza el id anterior para alcanzar el widget que acaba de crear (`if (id < 0) id = tokens[-1]`) y le pasa el puntero a un bloque, que el widget enlaza con **los últimos N ids** (`FUN_1001e560` recorre ese bloque y añade una entrada por control existente). Por eso una retro-referencia **no monta un control nuevo**: vuelve a enlazar el último junto con su bloque, y las magnitudes no son arbitrarias (`5 6 7 9 -4` apunta a los cuatro ids anteriores). En total hay 44 retro-referencias, volcadas en `page_refs.csv`; el visor las cuenta por página y las muestra en el inspector.

### Qué enlaza cada retro-referencia

Un bloque no monta ningún control: el widget que lo recibe (el `case <id>` de su binder) le pasa el bloque a un **registro** y ahí queda la lista de widgets que ese registro gobierna. `FUN_1001e560` es el enlazador: recorre el bloque, escribe en el registro `+0xc` = índice actual, `+0x10` = último índice (`n-1`) y `+0x18` = paso, y añade una entrada por cada id que tenga widget en la tabla de su clase. Así, el destino del bloque *es* el registro. [`tools/resolve_page_refs.py`](tools/resolve_page_refs.py) lee ese `case` en el DLL y resuelve los 44 bloques en [`page_ref_links.csv`](page_ref_links.csv):

| Destino | Bloques | Qué es |
|---|---:|---|
| `param` | 13 | `**(core+0x3dc) + off`: un registro de la tabla de 445 parámetros (`off = índice × 0x28`). El bloque son las **opciones del parámetro** |
| `view` | 18 | `**(editor+0x38) + 4k`: el objeto de la vista `k`. El bloque es un **selector de páginas** de esa vista |
| `group` | 9 | `FUN_100010a0(editor+0x9c / 0xb4 / 0xcc, …)`: grupo de **exclusión mutua**, sin parámetro propio |
| `core` | 3 | `core+0x398`: registro **elegido en ejecución**; nada del export escribe ese campo |
| `display` | 1 | `C_DisplayButton+0x40`: el registro que comparten los seis displays del bloque, también en ejecución |

Los 13 que enlazan un parámetro del motor son selectores de forma de onda o de modo, y el número de ids es exactamente el rango del parámetro (`max = n-1`), que es lo que el registro escribe al cargar la página:

| Vista/pág. | Widget | Ids | Parámetro |
|---|---|---:|---|
| 0/0 | `C_ControlPanel` 20 | 4 | `[33] R1Octave` (R1, 0..3) |
| 0/0 | `C_ControlPanel` 32 | 4 | `[113] R2Octave` (R2, 0..3) |
| 0/1 | `C_ControlPanel` 48 | 12 | `[260] LFOWaveForm` (Synth, 0..11) |
| 0/1 | `C_ControlPanel` 153 | 12 | `[270] SlicerWaveForm` (Synth, 0..11) |
| 3/1 | `C_ControlPanel` 77 | 6 | `[308] DS_ClipCurveType` (Synth, 0..5) |
| 5/0, 5/1 | `C_ControlPanel` 91 | 12 | `[313] RM_WaveForm` (Synth, 0..11) |
| 7/0, 7/1 | `C_ControlPanel` 111 | 12 | `[339] FL_WaveForm` (Synth, 0..11) |
| 8/0, 8/1 | `C_ControlPanel` 125 | 12 | `[345] PH_WaveForm` (Synth, 0..11) |
| 9/0, 9/1 | `C_ControlPanel` 139 | 12 | `[351] CH_WaveForm` (Synth, 0..11) |

El resto no llega al motor DSP: los 18 `view` son tiras de pestañas (el bloque tiene tantos ids como páginas tiene la vista destino), los 9 `group` son grupos de botones que se excluyen entre sí y no llevan parámetro (sus ids no están en `control_params.csv`), y los 3 `core` más el `display` apuntan a un registro que el editor elige en ejecución.

`page_tokens.csv` es esa gramática token a token, y el reparto que el visor consume: 701 filas (`slot`, `child`, `cmd`, `id`, `back-ref`, `end`) repartidas en las 33 páginas, con la clase que resuelve cada `cmd` y el orden de dibujo que ocupa cada `id`. Los **429 tokens de id** son, en ese orden, las 429 instancias de `page_controls.csv`: ninguna página puede montar un control que no esté en su lista de tokens. `verify_viewer.py` rehace ese reparto desde el DLL en vez de creerse el CSV.

Cada `cmd` selecciona la clase y llama a su constructor:

| cmd | Clase | Constructor |
|---|---|---|
| `0x100` | C_ControlPanel | `FUN_10019f20` |
| `0x200` | C_GraphEditor | `FUN_10014dd0` |
| `0x300` | C_IconButton | `FUN_10016a00` |
| `0x400` | C_PadGrid | `FUN_10018bb0` |
| `0x500` | C_Knob | `FUN_100145b0` |
| `0x600` | C_DisplayButton | `FUN_10017470` |
| `0x700` | C_ParameterPage | `FUN_10015950` |
| `0x800` | C_HitRegion | `FUN_10014030` |

El id de cada widget es la fila de la tabla de miembro de su clase, salvo en `C_ControlPanel`: su id pasa por el registro de 12 bytes de `0x1004ebf8` (`s16 x, s16 y, s16 style, s16 pad`), cuyo estilo elige la fila de 24 bytes de `0x1004eb50` (`bitmap, w, h`). Ese registro es el que lleva el `x/y` propio del panel, que en `controls.csv` estaba vacío; cuando la tabla trae `-999` el panel no está colocado y lo sitúa la retro-referencia al abrir la página. `page_controls.csv` guarda esas tres piezas ya resueltas por página y en orden de dibujo.

«Colocados» cuenta los controles con una `x/y` real en su tabla; el resto se sitúa al enlazarse (páginas de parámetro y 3 paneles con `-999`).

| Vista | Pág. | Slot | Fondo | Hijas | Comandos | Controles | Colocados | Registro | Bytes |
|---|---|---|---|---|---|---:|---:|---|---:|
| 0 | 0 | 0 | 10000 | 1 2 | 100 200 300 400 500 600 700 800 | 90 | 84 | `0x1004f9c4` | 472 |
| 0 | 1 | 7 | 10001 | 3 6 | 100 200 300 400 600 700 800 | 76 | 72 | `0x1004fc8c` | 408 |
| 0 | 2 | 24 | 10002 | — | 100 200 300 700 800 | 29 | 16 | `0x100503e4` | 176 |
| 0 | 3 | 25 | 10003 | — | 100 200 | 2 | 2 | `0x10050494` | 36 |
| 1 | 0 | 1 | 10300 | — | 300 | 4 | 4 | `0x1004fb9c` | 40 |
| 1 | 1 | 2 | 10301 | — | 300 | 4 | 4 | `0x1004fbc4` | 40 |
| 1 | 2 | 3 | 10302 | — | 300 | 4 | 4 | `0x1004fbec` | 40 |
| 2 | 0 | 4 | 10300 | — | 300 | 4 | 4 | `0x1004fc14` | 40 |
| 2 | 1 | 5 | 10301 | — | 300 | 4 | 4 | `0x1004fc3c` | 40 |
| 2 | 2 | 6 | 10302 | — | 300 | 4 | 4 | `0x1004fc64` | 40 |
| 3 | 0 | -1 | — | 4 | — | 0 | 0 | `0x1004fe24` | 16 |
| 3 | 1 | 11 | 10110 | — | 100 300 | 9 | 9 | `0x1004ff9c` | 68 |
| 3 | 2 | -1 | — | 5 | — | 0 | 0 | `0x1004ffe0` | 16 |
| 3 | 3 | 14 | 10130 | — | 300 | 3 | 3 | `0x100500c4` | 32 |
| 3 | 4 | 15 | 10140 | — | 300 | 6 | 6 | `0x100500e4` | 44 |
| 4 | 0 | 8 | 10100 | — | 100 300 | 10 | 10 | `0x1004fe34` | 72 |
| 4 | 1 | 9 | 10101 | — | 100 300 | 10 | 10 | `0x1004fe7c` | 72 |
| 4 | 2 | 9 | 10101 | — | 100 300 | 10 | 10 | `0x1004fec4` | 72 |
| 4 | 3 | 8 | 10100 | — | 100 300 | 10 | 10 | `0x1004ff0c` | 72 |
| 4 | 4 | 10 | 10102 | — | 100 300 | 10 | 10 | `0x1004ff54` | 72 |
| 5 | 0 | 12 | 10120 | — | 100 300 | 18 | 18 | `0x1004fff0` | 108 |
| 5 | 1 | 13 | 10121 | — | 100 300 | 17 | 17 | `0x1005005c` | 104 |
| 6 | 0 | 16 | 10200 | — | 300 | 2 | 2 | `0x10050110` | 28 |
| 6 | 1 | 17 | 10210 | — | 300 | 3 | 3 | `0x1005012c` | 32 |
| 6 | 2 | -1 | — | 7 | — | 0 | 0 | `0x1005014c` | 16 |
| 6 | 3 | -1 | — | 8 | — | 0 | 0 | `0x10050228` | 16 |
| 6 | 4 | -1 | — | 9 | — | 0 | 0 | `0x10050304` | 16 |
| 7 | 0 | 18 | 10220 | — | 100 300 | 18 | 18 | `0x1005015c` | 108 |
| 7 | 1 | 19 | 10221 | — | 100 300 | 15 | 15 | `0x100501c8` | 96 |
| 8 | 0 | 20 | 10230 | — | 100 300 | 18 | 18 | `0x10050238` | 108 |
| 8 | 1 | 21 | 10231 | — | 100 300 | 15 | 15 | `0x100502a4` | 96 |
| 9 | 0 | 22 | 10240 | — | 100 300 | 18 | 18 | `0x10050314` | 108 |
| 9 | 1 | 23 | 10241 | — | 100 300 | 16 | 16 | `0x10050380` | 100 |

Las 5 páginas sin fondo (3/0, 3/2 y 6/2–6/4) sólo montan otra vista: su contenido llega por `hijos`.

## Geometría de los controles

Cada clase lee su tabla de miembro con un stride fijo; las direcciones salen de los constructores. Las entradas están en `controls.csv`.

| Clase | Tabla | Stride | Campos | Entradas |
|---|---|---|---|---|
| C_Knob | `0x1004d208` | 8 | x, y, a, b | 2 |
| C_Led | `0x1004e170` | 4 | x, y | 18 |
| C_IconButton | `0x1004e2b8` | 12 | x, y, bitmap | 20 |
| C_DisplayButton | `0x1004e908` | 8 | x, y | 7 |
| C_PadGrid | `0x1004ea50` | 20 | x, y, pad0, pad1, pad2, pad3, pad4, pad5, pad6, pad7 | 3 |
| C_GraphEditor | `0x1004d2b8` | 18 | x, y, w, h, f1, f2, f3 | 32 |
| C_ControlPanel | `0x1004eb50` | 24 | bitmap, w, h | 64 |
| C_HitRegion | `0x1004cfc0` | 16 | x, y, w, h | 1 |
| C_ParameterPage | `0x1004dfb0` | 8 | panel, graph | 64 |

## Cada control y su parámetro

Los binders que el cargador llama por clase (`0x1001e600` paneles, `0x1001efa0` botones de icono, `0x100207a0` displays, `0x100206b0` mandos, `0x100201b0` grafos) hacen `switch` sobre el **id del widget** y enlazan un registro de la tabla de 445 parámetros:

```asm
mov  ecx,[esi+0x28]            ; core
mov  edx,[ecx+0x3dc]           ; snddat
mov  ecx,[esi+edi*4+0x364]     ; el panel creado para este id
mov  eax,[edx]                 ; primer registro de la tabla
add  eax,0x398                 ; + 23 * 0x28
push eax
call 0x1001af70                ; widget->attachParam(registro)
```

El desplazamiento es siempre `índice * 0x28`, el mismo orden que `preset_schema.csv`, así que el caso acaba con clave, rango y defecto. Tres formas:

| Papel | Quién | Qué hace |
|---|---|---|
| `param` | paneles, iconos, mandos, grafos | un registro por control |
| `selector` | `FUN_1001e560` en los paneles | enlaza un **bloque** de ids y escribe el rango `0..n-1` con paso 1: el control recorre el bloque |
| `display` | `C_DisplayButton` | cuatro registros consecutivos (A, D, S, R) por display |

`control_params.csv` guarda los 174 enlaces, y [`KNOB_PARAM_LINK.md`](KNOB_PARAM_LINK.md) sigue el resto de la cadena: qué helper de alta usa cada clase, dónde queda el observador dentro del widget y cómo el valor del registro `C_Param` llega de vuelta al control (y viceversa). Los que cuadran con los rótulos pintados en la piel son la prueba de que la lectura es la correcta: el mando de `101,133` (bajo *Volume*) es `R1Volume` (0..127, defecto 100), el panel 10 es el interruptor `R1Switch`, el panel 20 (`R1Octave`, 0..3) es un selector de bloque, el botón de icono 0 es `R1AmpLfoDepth` y el display 0 son los cuatro registros consecutivos `R1ResEnvA/D/S/R`. El único grafo con parámetro propio es el 1, que apunta a `SoundNameC00` (32..122, un carácter del nombre del sonido).

El **valor** que muestra el visor es el que el motor tiene al construir la tabla, no el `default` del descriptor: `FUN_10001170` cuantiza por `step` y recorta a `[min,max]`, así que los **19** defectos que caen por debajo de su mínimo arrancan en el mínimo (los `EQ_*` y los `*StickPlayback`). El inspector enseña los dos números cuando difieren. Ese es el valor **inicial**; el panel «Preset» del visor carga un `sound.script` y enseña, control a control, el que deja el fichero.

## Visor interactivo (`viewer.html`)

El visor acepta un fragmento `#view=V&page=P` y lo reescribe al cambiar de página, así que cada página tiene una URL propia; la hoja navegable [`pages_sheet.html`](pages_sheet.html) enlaza cada recorte con ese formato.

**La tira de miniaturas.** Bajo el lienzo hay una tira con las **33 páginas** para saltar de una a otra sin volver a la hoja de contactos: cada ficha es el recorte de [`pages_sheet.png`](pages_sheet.png) que `pages_sheet.csv` sitúa —400x326, el lienzo al 50 %—, es decir la página **ya compuesta** (fondo, pestañas, paneles y cajas de grafo), no sólo su fondo. Así dos páginas que comparten la piel de pestaña (1/0 y 2/0, 1/1 y 2/1, 1/2 y 2/2, 4/0 y 4/3, 4/1 y 4/2) se distinguen por lo que montan, y las 5 que no tienen fondo propio (3/0, 3/2 y 6/2–6/4) también muestran su contenido en vez de un hueco. La activa va marcada y la tira se desplaza hasta ella al cambiar de página (también por `#view=V&page=P`); la rueda la recorre en horizontal. El recorte se escribe como porcentaje de la hoja, de modo que el visor no pinta una segunda composición ni guarda otra imagen: `verify_viewer.py` exige que el recorte del modelo sea el de su fila de `pages_sheet.csv` y que caiga en el PNG.

[`viewer.html`](viewer.html) dibuja la página elegida tal y como la compone el editor: fondo, controles que **esa** página monta y vistas hijas, cada uno en el `x, y` de `page_controls.csv` **más el origen del slot de la página** (las páginas son ventanas; con el fondo a sangre el origen es 0,0), con el bitmap que carga su clase. No estima nada: el modelo va embebido en la página y sale de `sprites.csv`, `page_summary.csv`, `page_controls.csv` y las cabeceras de `bitmaps.csv`, más los dos pares `a`/`b` del mando leídos de `0x1004d208`. **El orden de dibujo no se adivina al pintar**: cada instancia lleva el índice de su token `id` y el visor lo fija como `z-index`, de modo que la pila es la del stream aunque una capa esté apagada o un control no tenga caja; las vistas hijas van en su propia banda (`1000+`) porque son ventanas del editor y se pintan por encima de los controles de la página que las monta.

**La página de cada vista hija no es siempre la 0.** `C_Editor_ctor` (`0x1001bad0`) no crea un control nuevo para cuatro de las vistas: guarda en el array de pestañas (`this+0x38`) punteros dentro de la tabla de los 445 registros del preset (`[core+0x3dc]`), en los desplazamientos `+0x3e8`, `+0x1068`, `+0x2c10` y `+0x3340` (registro × `0x28` bytes). Son los registros 25, 105, 282 y 328 —`R1ParamLevel`, `R2ParamLevel`, `CurFreqFX` y `CurTimeFX`—, y sus rangos (0..2, 0..2, 0..4, 0..4) cuadran exactamente con las páginas de las vistas 1, 2, 3 y 6. La página que muestra cada una es, por tanto, el valor de esa clave en el preset cargado: con `CurFreqFX = 1`, la vista 3 abre en su página 1. Las vistas 4, 5, 7, 8 y 9 sí reciben un control nuevo y abren en 0. El visor arranca las cuatro en el valor inicial del motor (0, el mismo que deja `FUN_10001170`) y las expone como selectores «Páginas de las vistas hijas»; al cargar un preset, los selectores pasan a la página que lleva el fichero (`CurTimeFX = 2` abre la vista 6 en su página 2).

**Traza del registro.** El panel «Traza del registro» recorre el registro de la página token a token, en su orden real: cada paso enciende el token (fondo, vista hija, comando, control o retro-referencia), deja pintados los anteriores, atenúa al 12 % los que aún no han llegado y marca con un marco turquesa el elemento que acaba de aparecer. La lista enseña los tokens con su índice, papel, valor y clase; al pulsar una fila se salta a ese paso y, si es un control o una retro-referencia, se abre en el inspector. `‹`/`›` (o `,`/`.`), `▶`/espacio y `⟲`/`r` mueven la traza; cambiar de página la reinicia en el primer token. Los pasos sin caja (`cmd`, `ids-end`, `end`) se leen en el panel sin dibujar nada, que es lo que hace el cargador.

**Entrada en la vista hija.** Al cruzar el token `child` de una vista, el paso siguiente **entra en esa vista**: cambia a la página que la vista tiene abierta (`R1ParamLevel`, `R2ParamLevel`, `CurFreqFX` o `CurTimeFX`, o la 0 si no tiene pestaña) y recorre su registro con las mismas reglas, marcando en el panel el nivel y la página. La página hija se puede anidar (la 0/1 monta la 3, que monta la 4: tres niveles), y cada registro se cierra con un **paso de retorno**, una fila `↩ retorno` al final de la lista que devuelve al padre en el token desde el que se entró y deja pintada la ventana de la que se vuelve; el paso siguiente sigue con el token posterior del padre. El contador y la barra son del recorrido completo (por ejemplo, 140 pasos para los 118 tokens de la 0/0: dos vistas, sus dos registros y sus dos retornos), no de una página; la lista y el inspector siempre hablan de la página en la que está la traza. Volver al nodo raíz no añade fila de retorno: allí termina el recorrido. Un `child` que apunte a una página ya visitada en la rama (o a más de cuatro niveles) se queda en su token y no baja, para que un registro no pueda hacer un ciclo.

**Qué dibuja**

| Capa | Elementos | Cómo |
|---|---:|---|
| fondo de página | 28 de 33 | el bitmap del slot, en la posición de `sprites.csv`; las 5 sin fondo usan la piel base |
| slots de sprite | 22 de 26 | los que no son piel completa (pestañas 203x46, páginas 240x138); sólo en la vista general, porque en modo página dibujaría los lienzos de todas las páginas a la vez |
| paneles | 243 instancias | bitmap del estilo (11000–11004) con el tamaño `w×h` del estilo |
| editores de grafo | 11 instancias | caja con la `w` y `h` de su tabla |
| botones de icono | 140 instancias | icono 11501 (7x7) en su `x, y` |
| rejillas de pads | 3 instancias | matriz 11410 (960x240) con las 8 celdas de 120 px marcadas |
| mandos | 2 instancias | filmstrip 11601 recortado a 50x50, en el fotograma `a` de la tabla |
| displays | 7 instancias | bitmap 11500 (66x22) |
| zonas de clic | 3 instancias | caja translúcida con la `w` y `h` de la tabla |
| vistas hijas | 5 páginas | fondo y controles de la vista montada, en la página que marca el preset (vistas 1/2/3/6) o en la 0 |
| opciones de selectores | 13 tarjetas / 134 opciones | tarjeta con la clave, el valor del registro y un chip por opción; aro ámbar en la activa |

**Opciones de los selectores.** Los 13 bloques `param` de `page_ref_links.csv` no son controles sueltos: son la lista de opciones que recorre el registro. Para cada uno, el visor dibuja una tarjeta junto al bloque con la clave (`⛭ R1Octave`), el valor del registro y un chip por opción, y un aro por celda: discontinuo para las candidatas y ámbar, con su índice, para la que tiene el registro. Los aros van en una capa por encima de todo (las celdas de un selector se pintan antes de la rejilla de pads que las tapa, así que un aro sobre el propio widget no se vería). La activa sale del registro `C_Param`: la línea del preset si hay un fichero cargado y, si no, el valor inicial del motor. Si el fichero trae un valor fuera del rango, el chip activo se marca en rojo y la tarjeta conserva el número leído. Son **134 opciones en 11 páginas**: `R1Octave`/`R2Octave` 0..3, `LFOWaveForm`/`SlicerWaveForm` 0..11, `DS_ClipCurveType` 0..5 y `RM_`/`FL_`/`PH_`/`CH_WaveForm` 0..11. Las tarjetas se dibujan también sobre las vistas hijas montadas, la casilla «opciones de los selectores» las apaga y el inspector del control que recibe el bloque añade cuántas opciones tiene y cuál está activa.

Al pasar el ratón por un control enlazado, el tooltip añade una línea `⛭ clave · grupo · min..max · valor` (y, si el defecto queda fuera de rango, `valor 1, defecto 0`); los selectores avisan de que el rango real pasa a `0..n-1` y los displays numeran su subcampo. En la lista lateral los controles con parámetro llevan una marca `⛭`, y el inspector abre un bloque con clave, grupo, índice, rango, defecto, valor inicial y paso (más «en el preset» en cuanto hay un fichero cargado). Los controles sin `case` en el binder (etiquetas, contenedores, zonas de clic) lo dicen en vez de inventarse una clave.

**Vista de preset.** El bloque superior del panel carga un `Sounds/NNN.sound/sound.script` del banco y sustituye el valor inicial por el del fichero en los **152 controles enlazados**. El lector (`parsePreset`) sigue las mismas reglas que `FUN_10001910` y `preset.py`: una línea `clave<TAB>entero` por parámetro, se ignora la línea en blanco, la clave **desconocida se descarta** y la repetida **gana la última**; no recorta a `[min,max]`, porque el cargador tampoco lo hace al leer. Sobre el lienzo cada control enlazado lleva una etiqueta con su valor (en turquesa cuando difiere del inicial, con los cuatro subcampos separados por `·` en los displays y el rango del selector ya resuelto); la casilla «valores en el lienzo» las apaga. Debajo, la lista de los 152 controles repite `clave  inicial → valor`, con las páginas donde se monta cada uno, y al pulsar una fila se salta a su página y se abre en el inspector. «Quitar» vuelve al inicial del motor y a la página 0 de las cuatro vistas hijas. Un fichero con una línea sin tabulador o con un valor que no es entero se rechaza con el número de línea y no deja nada a medias: el preset anterior se descarta entero antes de enseñar el error.

Medido con el banco que trae la instalación: `000.sound` tiene 445 líneas y 445 claves, y cambia **81 de los 152** controles (18 de los 54 en el lienzo de la 0/0); `011.sound`, que es de la versión 1, tiene 444 líneas, le falta `SlicerSwitchBackup` (ningún control la enlaza) y cambia 39. Los 351 ficheros del banco se leen sin una sola clave fuera de `preset_schema.csv`.

**Presets `.fxp`.** El mismo bloque acepta un preset de VST2 (`CcnK`). El plugin responde 0 a `effGetChunk`, así que lo que guarda un host es **`FxCk`**: los **26 parámetros del host** de `NeuronVS_vst2/parameters.csv`, en su orden, y nada más. El visor los mapea por nombre a su registro del preset (no adivina el orden), aplica la regla del motor (truncar al paso y recortar a `min..max`) y enciende los controles enlazados: `fixtures/176.fxp` deja `FilterFreq 127 → 8` y `FilterReso 0 → 3` en la 0/1. Ese fichero no lleva `R1ParamLevel`, `R2ParamLevel`, `CurFreqFX` ni `CurTimeFX`, así que las pestañas de las vistas hijas **conservan la que se está viendo** y sus controles leen los valores que sí vienen; el panel lo dice en lugar de fingir que el `.fxp` decide la página. Un **`FPCh`** (estado completo) sí trae el `sound.script` en el chunk, que es la forma que tendrá el estado del port: `fixtures/176-state.fxp` carga las 445 claves y mueve las pestañas a 1→2, 2→2, 3→1 y 6→1, de modo que la traza entra en la 1/2 y los controles de esa página leen el preset. Se validan `CcnK`, el tamaño declarado, la versión 1, el `fxID` `0x4e415332` (`'NAS2'`, el que `C_NeuronCore_ctor` escribe) y `numParams` = 26; un fichero de otro plugin, truncado o con un chunk que no sea texto se rechaza con el motivo y deja el preset anterior descartado. Los dos fixtures se generan de `176.sound` con `tools/make_fxp_fixtures.py`; su `--check` falla si el `.sound` cambia y no se regeneran.

**Comparar dos presets.** Debajo del preset se carga un **segundo fichero** con el mismo lector (`readPresetFile`): un `sound.script` o un `.fxp` de cualquiera de las dos formas. El primero sigue siendo el que manda —mueve las pestañas de las vistas hijas, la traza y el valor de cada control—; el segundo es sólo una referencia contra la que se compara, así que **no toca ni la página, ni las pestañas, ni la traza**. La regla es la del cargador y no una igualdad de ficheros: un control se marca cuando **alguno de sus registros** lee un número distinto en A y en B (un display tiene cuatro, y basta con que difiera uno), y un registro **sin línea en B** vale lo que el motor deja antes de aplicar el fichero, el inicial del modelo — el mismo respaldo que hace `FUN_10001910` con una clave que no viene. Los tres sitios donde se ve: un **marco rojo discontinuo** sobre el control en el lienzo, su etiqueta pasa a `A→B` en rojo (los cuatro subcampos de un display se encadenan con `·`), y la fila de la lista lateral cambia `inicial → valor` por `A → B`. El resumen dice cuántos son: `001.sound frente a A: 32 de 152 controles con otro valor · 68 de 445 claves`, y el inspector añade `en A`, `en B` y `comparación` a cada bloque de parámetro. La casilla **«resaltar diferencias»** apaga el rojo en los tres sitios pero deja los números (el resumen lo avisa); «quitar B» vuelve a la vista de un solo preset.

Medido con el banco: `000.sound` frente a `001.sound` da **32 de los 152** controles y **68 de las 445** claves (12 controles en el lienzo de la 0/0, `R1Volume 95→51`, el display `R1AmpEnvA/D/S/R 0/0/127/50 → 0/0/127/55`); frente a `011.sound`, 75 y 147; y un fichero consigo mismo, ninguno. Un **FxCk** como B sólo aporta los 26 parámetros del host, así que todo lo demás se compara contra el inicial: `176.fxp` frente a `000.sound` marca 81 controles y 140 claves. Un **FPCh** trae las 445: `176-state.fxp` deja 53 y 110 sobre el mismo A. Un B con una línea sin tabulador o con un valor que no es entero se rechaza con el número de línea y **A se queda como estaba**: sólo se descarta la comparación.

**Qué se puede hacer**: cargar un `sound.script` o un `.fxp` (FxCk/FPCh) y ver el valor real de cada control enlazado (o quitarlo y volver al inicial), cargar un **segundo preset** y ver resaltados los controles que cambian respecto al primero (con la casilla para apagar el resaltado), elegir vista y página (33, agrupadas por vista, con el número de controles en la etiqueta), piel base, encender y apagar capas, alternar **sólo los controles de esta página** / las 83 geometrías de la tabla entera, incluir o no las vistas hijas, mostrar u ocultar las opciones de los selectores, elegir la página de cada vista hija cuando es una clave del preset (`R1ParamLevel`, `R2ParamLevel`, `CurFreqFX`, `CurTimeFX`), opacidad de sprites y de controles, etiquetas, contornos, atenuar lo que cae fuera, escalado nítido y el fotograma del mando; arrastrar para mover, rueda para acercar, `+`/`-`/`0`, flechas, `t` (plegar el panel), `L`/`O` (etiquetas/contornos), `P` (modo página), `PgUp`/`PgDn` (página), `,`/`.` (paso anterior/siguiente de la traza), espacio (reproducir o pausar la traza), `r` (reiniciarla), `Esc`.

El panel lista **los controles de la página agrupados por clase**, con su id y su posición (`sin x/y` en rojo cuando la tabla no la trae); al pulsar uno se selecciona, se centra y se abre en el inspector: clase, id, comando, constructor, `x, y`, tamaño, bitmap, registro del stream, `a`/`b` y avisos. Cada elemento del lienzo responde igual, y el clic elige la **caja más pequeña** bajo el puntero, porque a 26 % un LED de 15x7 mide 4x2 px y las cajas grandes lo taparían. El botón **PNG** descarga exactamente lo que se ve: lo redibuja en un canvas desde los mismos nodos y coordenadas (las etiquetas de valor quedan fuera: el PNG es la composición, no la anotación).

**Detalles que salen de mirarlo**

- La página 0/0 monta **90 controles** y la 0/2 sólo 29: el reparto ya no es una incógnita, y la lista del panel lo confirma clase a clase (por ejemplo 6 `C_ParameterPage` en la 0/0 frente a 12 en la 0/2).
- **23 de las 429 instancias no tienen caja**: las 20 `C_ParameterPage` (su tabla sólo guarda índices de panel y grafo) y 3 paneles cuyo `x/y` es `-999` porque los coloca la retro-referencia. Salen en la lista con `sin x/y` y en el inspector, pero no en el lienzo.
- **4 elementos caen fuera del lienzo** aunque tengan caja: el mando 1 (`101,664`, 12 px por debajo del borde) y las tres rejillas de pads, que miden 960 px de ancho desde `x` 139–215. Encaja con que esas tablas sean **relativas a su página** y no al editor; el visor los atenúa y lo avisa en lugar de esconderlos.
- **Cuatro vistas hijas leen su página del preset**: 1, 2, 3 y 6 apuntan a `R1ParamLevel`, `R2ParamLevel`, `CurFreqFX` y `CurTimeFX`, y sus rangos miden justo el número de páginas de cada vista. Por eso la 0/1 puede enseñar la 3/1 o la 3/4 sin tocar el layout: es el preset el que cambia de página. Las otras cinco vistas hijas (4, 5, 7, 8, 9) no tienen clave y siempre abren en 0.
- **243 paneles con sólo 5 formas**: `11001` 22x21 (136 veces), `11000` 17x12 (48), `11004` 33x22 (25), `11002` 36x23 (22) y `11003` 19x12 (12). El estilo del registro elige la forma; la identidad de cada panel viene del id, no del dibujo.
- En la página 0/0 los paneles se reparten en dos bloques (`69,360`–`69,426` y `69,686`–`69,733`) separados por el `C_PadGrid` de `215,117`: la geometría de la tabla ya viene con la separación de las dos mitades.
- El campo `bitmap` de los botones de icono es un **índice** en `0x1004e290` (14, 15, 24…), no un id de recurso: el visor dibuja el único icono que existe, 11501, y lo dice en el inspector.
- El `a`/`b` del mando (11/0 y 38/0) se usa como **fotograma inicial** del filmstrip. Es una lectura sin confirmar y el deslizador permite recorrer los 90.

**Cómo abrirlo.** La página funciona desde `file://`, pero para que el botón PNG no marque el canvas como contaminado hay que servir la carpeta:

```bash
python -m http.server 8731
# http://127.0.0.1:8731/NeuronVS_layout/viewer.html
```

`window.neuronViewer` expone `{state, draw, fit, zoomAt, centreOn, select, exportPNG, model, childPage, trace, preset, compare}` para guionizar la vista desde la consola; `preset` lleva `parse`, `parseFxp`, `apply`, `clear`, `value`, `linked` y `file`, y `compare` lleva `state`, `apply`, `clear`, `value`, `ready`, `diffs`, `count`, `keys` y `file`, que es lo que usa la comprobación en el navegador.

## Hoja de contactos (`pages_sheet.png`)

[`pages_sheet.png`](pages_sheet.png) es la vista de conjunto: las **33 páginas** compuestas a la vez, cada una en el lienzo de 800x652 al **50 %** (recortes de 400x326), en una rejilla de 4 columnas con su pie. Cada recorte se pinta con las mismas reglas que el visor en modo página, pero sin interacción: piel base `10000`, el bitmap del slot de la página en su sitio de `sprites.csv` y encima los controles que **esa** página monta, en orden de stream. La posición de cada control es el origen de su slot más el `x/y` de `page_controls.csv`, porque las páginas son ventanas: con el fondo a sangre (las cuatro pieles) el origen es `0,0` y la fila ya es absoluta, pero las 240x138 y las pestañas desplazan sus controles. El visor usa esos mismos recortes en su tira de miniaturas, así que la hoja es también el índice visual del visor.

| Qué se ve | Cuántos | Cómo se dibuja |
|---|---:|---|
| páginas con fondo propio | 28 de 33 | bitmap del slot, a su `x,y` |
| páginas sin fondo | 5 | sólo la piel base; son contenedores que montan otra vista (el pie dice cuál: `monta vista 4`) |
| paneles y displays | 232 | bitmap del estilo recortado a `w×h` (225 `C_ControlPanel` + 7 `C_DisplayButton`) |
| botones de icono | 130 | icono 11501 (mide 7x7 px, así que a 50 % son 3x3) |
| rejillas de pads | 3 | matriz 11410 con sus 8 divisiones de 120 px |
| mandos | 1 | fotograma `a` del filmstrip 11601 (50x50); el otro cae por debajo del borde |
| editores de grafo y zonas de clic | 14 | caja GDI: relleno tenue y borde discontinuo, porque el DLL los traza en ejecución |
| vistas hijas | — | no se despliegan: son páginas propias de esta misma hoja |

De las **429 instancias**, la hoja compone **380** de las 406 con caja: 23 no tienen posición (las 20 `C_ParameterPage` y 3 paneles con `-999` que coloca una retro-referencia) y **26 quedan enteras fuera del lienzo**: 15 paneles, 10 botones de icono y 1 mando, todos con `y` entre 664 y 736 en las páginas 0/0, 0/1 y 0/2, o sea por debajo de los 652 px de la piel — esas tres páginas se dibujan en una ventana más alta que la maqueta, y de ahí que su recorte parezca más vacío que su lista de controles. El pie de cada recorte da los números de esa página: `90 controles · 84 colocados · 10 fuera del lienzo · 6 sin posición`.

Lo que **sí** cabe, aunque sea a medias, no se descarta: las tres rejillas de pads (960 px de ancho) y otros 7 controles que desbordan (5 paneles y 2 botones) se pintan recortados contra el lienzo, que es lo que haría la ventana del editor. Por eso el visor avisa de **4** elementos fuera del lienzo (las tres rejillas y el mando del borde, los que desbordan por la derecha o por abajo) y la hoja de **26**: son reglas distintas —el visor señala lo que se sale de la caja, la hoja descarta lo que no toca el lienzo— y las dos son ciertas para lo que cada una mide.

[`pages_sheet.csv`](pages_sheet.csv) es el acta de la hoja: por recorte, la página, su registro, slot, fondo, vistas hijas, los cinco recuentos, el rectángulo `tile_x/y/w/h` en la hoja y la escala. Sirve para auditar la imagen sin abrirla (y es lo que lee el verificador).

```bash
python NeuronVS_layout/tools/build_pages_sheet.py          # pages_sheet.png + pages_sheet.csv
python NeuronVS_layout/tools/build_pages_sheet.py --check   # compara con lo que generarían las tablas
```

## Verificación

- 42/42 bitmaps referenciados existen en el PE con el tamaño que declara `bitmaps.csv`.
- Las 26 entradas de la tabla de sprites se releen del DLL y coinciden con `sprites.csv`.
- Las dos filas de pestañas (6 slots: 10300/10301/10302 en `21,446` y en `460,446`) se localizan en las pieles exactamente en la posición que declara la tabla, con SSD/mediana entre 0.08 y 0.19.
- `tools/decode_streams.py` relee las 10 tablas de stream, comprueba que los registros **encajan sin huecos** en `.rdata` (cada uno acaba donde empieza otro del bloque) y contrasta cada campo que resuelve con `controls.csv`; sale con 0 sólo si todo cuadra.
- `tools/verify_layout.py` rehace las comprobaciones del volcado anterior (sprites, geometría y los 29 streams de `pages.csv`) de forma independiente.
- `tools/verify_viewer.py` regenera la página y la compara byte a byte, contrasta el modelo embebido con `sprites.csv`, `controls.csv`, `page_summary.csv` y `page_controls.csv` fila a fila (las 33 páginas y las 429 instancias, incluido el orden de dibujo, las que no tienen caja y la posición —`x, y` de la tabla más el origen de la ventana, releído de `sprites.csv`—), los `a`/`b` con `0x1004d208`, los 42 PNG con su cabecera y que no haya URLs remotas; fija cuántos elementos caen fuera del lienzo (4) y **relee del DLL la longitud y la lista de comandos de cada registro**. Una prueba negativa —mover un mando un píxel en el HTML— hace fallar tres comprobaciones.
- `tools/verify_viewer.py` comprueba además el **enlace con el preset**: rehace `control_params.csv` desde los binders (174 filas, campo a campo), exige que cada desplazamiento sea múltiplo de `0x28` y aparezca como inmediato en el código del binder, contrasta las 445 claves del modelo con `preset_schema.csv` (clave, grupo, rango, defecto y valor inicial), cuenta los 19 defectos fuera de rango, fija las 170 claves con control y las 162 instancias enlazadas, y comprueba seis anclas contra los rótulos de la piel (`R1Volume`, `R2Volume`, `R1Switch`, `R1Octave`, `R1AmpLfoDepth` y `R1ResEnvA..R`). Cambiar a mano el parámetro de un mando hace fallar cinco comprobaciones.
- `tools/verify_viewer.py` comprueba además la **vista de preset**: exige el panel (entrada de fichero, «quitar», casilla, lista y resumen), el gancho `window.neuronViewer.preset`, y que el lector y la etiqueta del lienzo estén en la página; recorre los **351 `sound.script`** del banco (156.192 líneas) con las dos reglas del lector —tabulador e entero decimal— y exige que ninguna clave quede fuera de `preset_schema.csv` y que los nombres sean únicos, porque la búsqueda es por nombre. En el navegador, cargando `000.sound` por el propio `<input type=file>`, los 54 controles del lienzo de la 0/0 pasan a enseñar su valor (18 distintos del inicial; 81 de los 152 en total): `R1Type` pasa de 1 a 0, `CurTimeFX` de 0 a 2 y abre la vista 6 en su página 2, y `DC_PreFilterCutoff` enseña 41 donde el modelo dice 0. Un fichero con una línea sin tabulador deja el panel en «error» con la línea señalada, sin valores ni etiquetas; «quitar» devuelve los 54 al inicial y la vista 6 a la página 0.
- `tools/verify_viewer.py` comprueba además el **`.fxp`**: contrasta los 26 parámetros del host del modelo con `parameters.csv` (índice, clave, registro del preset, rango y defecto), el `uniqueID` `0x4e415332` y `numParams` = 26, que el HTML lleve el lector (`parseFxp`, `FxCk`, `FPCh`), y **rehace los dos fixtures desde `176.sound`** byte a byte (`make_fxp_fixtures.py --check` falla si se quedan atrás). En el navegador: `176.fxp` carga 26 claves y deja `FilterFreq 127 → 8` y `FilterReso 0 → 3`; `176-state.fxp` carga 445 y mueve las pestañas 1→2, 2→2, 3→1, 6→1, con la traza entrando en la 1/2; un `fxID` ajeno (`0x12345678`) y un fichero truncado se rechazan con el motivo y dejan el panel en «error», sin preset anterior.
- `tools/verify_viewer.py` comprueba además la **comparación**: exige el segundo campo de fichero, su «quitar B», la casilla y el resumen, los ganchos `window.neuronViewer.compare` (incluido `showDiff`), que el segundo lector sea el mismo `readPresetFile` que el primero, que `compareValue` caiga en el valor inicial del modelo cuando B no trae la clave, y que `applyCompare` **no** escriba en `state.childPages`, ni en la traza, ni llame a `applyPreset` (B es una referencia, no un preset cargado). Además **rehace la comparación desde las tablas**: lee `000.sound`, `001.sound` y `011.sound` del banco, aplica la regla del cargador (última línea gana, clave ausente = inicial, control marcado si difiere cualquiera de sus registros) y fija 32/152 controles y 68/445 claves para 000-001, 75/147 para 000-011 y 0 para un fichero consigo mismo. En el navegador, cargando `000.sound` y luego `001.sound` por los dos `<input type=file>`: 12 controles con marco rojo en la 0/0, 12 etiquetas `A→B`, 32 filas en rojo y el resumen con los dos recuentos, sin que B mueva la página, las pestañas ni la traza; apagar «resaltar diferencias» deja el lienzo sin marcos ni etiquetas rojas y las filas sin color, y volver a encenderla los recupera; un B roto deja el panel en `· error` con la línea señalada y A intacto; `176.fxp` y `176-state.fxp` como B dan 81/140 y 53/110 claves frente a ese A.
- `tools/verify_viewer.py` comprueba además el **reparto de tokens**: para cada página relee su registro del DLL token a token, exige índices contiguos en `page_tokens.csv`, que `slot`/`child`/`cmd`/`back-ref` coincidan con el resumen, que cada `-N` apunte al id anterior y que los tokens `id`, en orden, sean exactamente las instancias que esa página dibuja. Así el visor no puede enseñar un control de otra página ni alterar el orden sin que la verificación falle.
- `tools/verify_viewer.py` comprueba además la **página de las vistas hijas**: desensambla `C_Editor_ctor`, sigue los `lea [edi+off]` y sus stores en el array `[this+0x38]`, y exige los cuatro desplazamientos `+0x3e8`, `+0x1068`, `+0x2c10` y `+0x3340`; contrasta los registros 25/105/282/328 con `preset_schema.csv` (clave y rango `0..n-1`, con `n` las páginas de la vista) y que las demás vistas hijas no tengan página de preset. Cambiar un desplazamiento o el rango de `CurFreqFX` hace fallar la comprobación.
- `tools/verify_viewer.py` comprueba además la **traza**: exige que el modelo lleve, por página, exactamente las filas de `page_tokens.csv` (índice, valor, papel, clase, destino y orden), que cada página empiece en su `slot` y acabe en el token de cierre, y que los 429 tokens de id sigan siendo las instancias en su orden de dibujo; en el HTML exige los nueve controles del panel, `state.trace`, los estilos del elemento actual y de los pendientes, y el plan que baja a la vista hija (`tracePlan`, `enterPage` y el paso `kind: 'return'`), con cada vista montada apuntando a una página que tenga registro que recorrer. Quitar un token, cambiar dos de orden, borrar el panel o quitar el paso de retorno hace fallar la comprobación (probado en el navegador: la traza recorre los 118 tokens de la 0/0, entra en las vistas 1 y 2, recorre sus registros y vuelve a la 0/0 con los dos retornos, y se reinicia al cambiar de página; en la 0/1 baja dos niveles, 0/1 → 3/0 → 4/0, y remonta con los retornos 22 y 25).
- `tools/verify_viewer.py` comprueba además las **retro-referencias**: rehace `page_ref_links.csv` desde los binders (44 filas, campo a campo) y luego contrasta cada destino por su cuenta —que el desplazamiento del parámetro sea un inmediato del binder, que su rango sea el tamaño del bloque, que el control figure en `control_params.csv` como selector, y que un bloque `view` tenga tantos ids como páginas la vista destino—. Cambiar a mano el rango de `R1Octave` o el destino de un bloque `view` hace fallar el verificador (probado).
- `tools/verify_viewer.py` comprueba además las **opciones de los selectores**: exige los **13 bloques** y sus **134 opciones**, que cada opción sea un control montado por esa misma página con el mismo `order`/`x,y` de `page_controls.csv`, que el recuento sea el rango del registro (`min..max`, paso 1), que el último id sea el control que recibe el bloque (`owner`), que el valor inicial del motor caiga dentro, y que el HTML lleve la tarjeta, los aros de opción, el interruptor y el gancho `window.neuronViewer.selectors`. Cambiar el número de ids de un bloque, su `owner` o el paso del registro hace fallar la comprobación.
- `tools/verify_pages_sheet.py` audita la **hoja de contactos** sin usar su generador: rehace la rejilla desde el tamaño del PNG (4 columnas, escala y tamaño de recorte), exige que `pages_sheet.csv` liste las 33 páginas de `page_summary.csv` en orden y que cada recorte caiga en su celda, contrasta los cinco recuentos de cada fila con `page_summary.csv` y las filas reales de `page_controls.csv` (`dibujados + fuera == colocados`, `colocados + sin posición == controles`, y los totales: 380 de 406 de 429), y **recompone cada página por su cuenta** con otro código para comparar el recorte como rejilla de luminancia 32x26: la correlación mínima medida es **0.997**, y en cada control con bitmap comprueba que su zona del recorte difiere del mismo fondo sin él (366 de 366 zonas visibles, pico mínimo 44.5 sobre 255). Cierra con los pies: tinta en los 33, ninguno invade el hueco hacia su vecino ni la fila de abajo, y la cabecera deja separación entre subtítulo y nota de fuentes. Cambiar un `tile_x`, el orden de dos páginas o pegar dos veces la misma página hace fallar la comprobación.
- `tools/verify_viewer.py` comprueba además la **tira de páginas**: que el modelo lleve el tamaño real de `pages_sheet.png` y, por página, el recorte que `pages_sheet.csv` le da; que los recortes caigan dentro del PNG, midan el lienzo al 50 % y declaren el mismo slot, fondo y recuento de controles que `page_summary.csv` (una hoja regenerada desde otras tablas deja la miniatura sobre otra página y falla); que las 33 páginas tengan exactamente una fila, en orden; y que el HTML construya la tira (`buildPageStrip`, `markStrip`, `data-page`) desde `MODEL.sheet.path` y el recorte de cada página. Cambiar un `tile_x` en el CSV, mover una miniatura a otra página o quitar la tira hace fallar la comprobación.

- `tools/verify_paint.py` relee el DLL y comprueba la **cadena de pintado** documentada en [`PAINT_PIPELINE.md`](PAINT_PIPELINE.md): que el byte de invalidez esté en `+0x30` y lo usen los slots 5/13/14 de las cuatro clases; que la ventana sólo entre a pintar si `0x100087d0` ve algo sucio y que el recorrido baje por los hijos con el slot 5; que el knob saqué el fotograma de su `C_Param` **privado** (`+0x64`, recortado y multiplicado por el alto de la cara 11600) y lo blitee con máscara desde la tira 11601, dejando el registro enlazado (`+0x38`) sólo para el texto; que el panel cachee el dígito en `+0x84` y copie una sola celda del bitmap de `+0x68`; que el LED encendido use el 11300 con máscara y el apagado el parche de fondo del padre; y que **los LEDs no tengan padre**, con lo que esa capa no llega a píxeles.
- `tools/verify_paint.py` comprueba además la **geometría**: que la celda del panel salga de la tabla de `0x1004eb50` y que el bitmap de trabajo sea `celda × columnas` de ancho y `2 × celda` de alto (dos blits opacos desde el atlas), y que cada LED tome su caja de 15×7 del par `(y, x)` de la tabla de tipos `0x1004e170`/`0x1004e172`.
- `tools/verify_paint.py` comprueba además los **recursos y las tablas de tipo**: que el knob cargue 11600 en `+0x8c` (máscara de clic: 50×50 de dos colores que el ratón consulta con `GetPixel`) y 11601 en `+0x90` (tira de 90 fotogramas de 50×50) con su `C_Param` privado de 0.0f a 89.0f, y que el LED cargue 11300 en `+0x54`; que el tipo del panel salga de la tabla de índices `0x1004ebfc` (12 bytes por tipo) hacia el registro de 24 bytes de `0x1004eb50` (`{recurso, ancho, alto}`) y que las columnas se calculen como `atlas / celda − 1`; que los tipos de LED sean los 39 pares `(y, x)` de `0x1004e170` y que el constructor los recorte a 0..38; y que el blit con máscara encadena sus cinco ROP en el orden correcto (`SRCCOPY`, `SRCAND` con la fuente, `MERGEPAINT` con la máscara, `SRCAND` con la fuente, `SRCCOPY`).
- `tools/verify_paint.py` comprueba además la **etiqueta de estado**, el otro consumidor del valor: que el pintado del knob formatee el registro con `0x10015910` eligiendo entre `"%03i"` (`0x100545b8`) y `"%+02.2i"` (`0x100545c0`) según el flag bipolar, que `0x100158d0` copie 18 bytes a `+0x1cc` y suba el flag `+0x1f0` (rehaciendo en el acto si el texto ya está enganchado, `+0x1b8`), que `0x10015280` componga los glifos `char − 0x21` del atlas `+0x1e8` en celdas de `+0x1fc` px cada `+0x204` y los estampe con el blit con máscara en el scratch `+0x1ec`, y que el pintado del texto (`0x100151c0`) lo copie opaco en `(+0x20c, +0x210)`. Además contrasta con los bytes del DLL la tabla de tipos de display `0x1004d2b8` (18 bytes por tipo: el tipo 11, el de los knobs reales, es una caja de 33×18 en `(77,92)` con 3 caracteres y fuente 0), la tabla de fuentes `0x1004d2a0` (11100 con celda 16 y avance 8; 11101 con celda 16 y avance 5) y los dos tipos de knob de `0x1004d20c` (→ display 11 y 38).

## Artefactos

| Archivo | Contenido |
|---|---|
| [`sprites.csv`](sprites.csv) | los 26 slots: bitmap, posición de tabla y posición medida |
| [`controls.csv`](controls.csv) | 211 entradas de geometría de 9 clases |
| [`page_summary.csv`](page_summary.csv) | las 33 páginas: fondo, vistas hijas, comandos, controles, retro-referencias y bytes |
| [`page_controls.csv`](page_controls.csv) | las 429 instancias montadas: orden, clase, id, comando, constructor, `x/y/w/h`, bitmap y `a`/`b` |
| [`page_refs.csv`](page_refs.csv) | las 44 retro-referencias: clase, longitud y bloque de ids que re-enlazan |
| [`page_ref_links.csv`](page_ref_links.csv) | qué enlaza cada uno de los 44 bloques: destino, parámetro (índice, clave, grupo y rango), vista o registro, con el `case` del binder que lo demuestra |
| [`control_params.csv`](control_params.csv) | los 174 enlaces control→parámetro: clase, id, índice, clave, grupo, rango, defecto, valor inicial, papel y binder/origen |
| [`KNOB_PARAM_LINK.md`](KNOB_PARAM_LINK.md) | el enlace completo: binder → registro → observador → callback → valor, con los helpers de cada clase y las máscaras |
| [`OBSERVER_PASSES.md`](OBSERVER_PASSES.md) | el observador por dentro: `0x10001010`, alta/baja en la matriz, las dos pasadas de notificación y el censo de callbacks (con los que reenganchan paneles en las matrices) |
| [`PAINT_PIPELINE.md`](PAINT_PIPELINE.md) | la cadena de pintado: el byte de invalidez en `+0x30`, el recorrido del árbol, los dos blits, la aguja del knob (registro enlazado vs. `C_Param` privado) y la celda y los LEDs del panel, con los recursos y las tablas de tipo que los alimentan |
| [`page_tokens.csv`](page_tokens.csv) | los **701 tokens de las 33 páginas**, uno por fila con su papel (`slot`, `child`, `cmd`, `id`, `back-ref`, `end`), la clase y, en los `id`, el orden de dibujo |
| [`pages.csv`](pages.csv) | volcado anterior (29 páginas, 8 vistas); se conserva como referencia |
| [`streams.csv`](streams.csv) | volcado anterior de 693 tokens en crudo (8 vistas); la versión completa y clasificada es `page_tokens.csv` |
| [`layout.json`](layout.json) | volcado anterior (8 vistas) en JSON |
| [`mockup.png`](mockup.png) | las cuatro pieles con los sprites confirmados |
| [`pages.png`](pages.png) | las 29 páginas del volcado anterior con su fondo y su slot |
| [`viewer.html`](viewer.html) | visor interactivo: página a página (con la página de preset de las vistas hijas), **tira de 33 miniaturas** (recortes de la hoja) para saltar entre páginas, capas, traza token a token que entra en la vista hija y vuelve con un paso de retorno, inspección (con el destino de cada retro-referencia), vista de preset (valor de cada control enlazado leído de un `sound.script` o de un `.fxp`), comparación de dos presets con los controles que difieren resaltados, y export PNG |
| [`fixtures/`](fixtures) | dos presets de VST2 derivados de `176.sound`: `176.fxp` (`FxCk`, 26 parámetros del host) y `176-state.fxp` (`FPCh`, el `sound.script` completo) |
| [`compare_shot.png`](compare_shot.png) | captura del visor con `000.sound` en A y `001.sound` en B: los 12 controles de la 0/0 que difieren, con su etiqueta `A→B` |
| [`pages_sheet.png`](pages_sheet.png) | hoja de contactos de las 33 páginas compuestas (fondo + controles montados) al 50 %, 1708x3544 |
| [`pages_sheet.csv`](pages_sheet.csv) | acta de la hoja: rectángulo de cada recorte, página, slot, fondo y los cinco recuentos |
| [`tools/`](tools) | decodificador de streams, resolución de retro-referencias, generador de la maqueta, generador del visor, generador de fixtures `.fxp`, plantilla y verificadores |

## Límites

- Las **posiciones medidas** sólo existen para los sprites que la piel trae pintados (las pestañas). Los demás los dibuja el editor al vuelo, así que su sitio es el de la tabla, no el de un píxel comprobado.
- Los 44 bloques ya están resueltos en [`page_ref_links.csv`](page_ref_links.csv), pero **cuatro de ellos no se pueden nombrar desde el binario**: los 3 que van a `core+0x398` y el del display (`+0x40`) apuntan a un registro que el editor elige en ejecución, y nada del export escribe esos dos campos. Se anotan con su destino, no con un parámetro inventado. Los 9 `group` tampoco enlazan parámetro: son grupos de exclusión mutua.
- Los **3 paneles con `-999`** sí se colocan en ejecución, pero el visor no sabe en qué `x/y` los deja la retro-referencia: se listan sin caja.
- El reparto de comandos no es uniforme: **`C_Led` no aparece nunca en un stream** (sus 18 entradas vienen de la tabla), así que ninguna página monta LEDs y el visor no los inventa; si el editor los crea en otro sitio, este mapa no lo recoge.
- Las tablas de geometría se indexan por **estilo** en los paneles (el estilo recorta el índice) y por **id de widget** en el resto; la asignación parámetro→control se hace al enlazar el objeto de parámetro, fuera del alcance de este mapa.
- Las pieles no contienen los controles: son el fondo. Un mockup que pinte los mandos exigiría ejecutar el editor, no sólo leer las tablas.
- El visor dibuja **una página y sus vistas hijas directas**, no la recursión completa: las vistas hijas son páginas con su propia navegación y desplegarlas hacia abajo metería el contenido de otra pestaña en ésta. La página de cada hija ya no se asume: sale del preset para 1/2/3/6, y con un fichero cargado el visor los sigue; sin él usa el inicial del motor (0).
- No existe una captura del editor en ejecución contra la que comparar: la composición es la que dicen las tablas, no una copia de píxeles de la aplicación arrancada.
- Las posiciones del visor son las de la **tabla** más el origen de la ventana de la página; de los 26 slots, sólo las 6 pestañas están confirmadas por píxeles, y el inspector lo marca slot a slot.
- Sólo **170 de las 445 claves** tienen control directo en el editor. El resto se edita en las páginas de parámetro que monta cada `selector` en tiempo de ejecución, o no tiene control propio; el visor lo marca como `sin parámetro` en lugar de adivinar.
- El valor que el modelo lleva **embebido** es el inicial del motor (descriptor cuantizado y recortado). El preset se abre a mano desde el panel y no se guarda en la página: el visor no lee ningún fichero al cargar ni escribe presets, así que recargar vuelve a los iniciales. Tampoco recorta a `[min,max]`: enseña el entero de la línea, que es lo que el cargador escribe.
- Los cuatro subcampos de un display se numeran por **orden de enlace**; el bitmap 11500 es único, así que el visor no puede comprobar a qué dígito corresponde cada uno en pantalla.
- Las páginas **0/0 y 0/1 colocan controles hasta `y = 736`**, por debajo de los 652 px de la piel: la ventana del editor es más alta que el lienzo de la maqueta, así que la hoja y el visor recortan 26 y 4 elementos respectivamente. No es un error de lectura, sino que la maqueta fija 800x652 y las tablas no.
- En un `selector`, el rango real `0..n-1` lo fija el bloque de ids al abrir la página: el visor lo muestra ya resuelto (`max = n-1`) para los 13 bloques que enlazan un parámetro, y avisa cuando el parámetro es un selector sin bloque en el mapa.
- Las **opciones de un selector no tienen rótulo** en el binario: el visor las numera en el orden del bloque (`0..n-1`) y marca como activa la que dice el registro; no inventa nombres de forma de onda ni de modo.
- El aro de una opción no prueba que la celda se vea en el editor: varias de esas celdas caen debajo de la rejilla de pads de su página y el visor las rodea igual, porque el anillo es una anotación y no un cambio de orden de dibujo.

## Reproducir

Requiere Pillow y numpy (la comprobación de posición es una correlación de imágenes) y capstone (desensamblar el binder para comprobar cada desplazamiento).

```bash
python NeuronVS_layout/tools/decode_control_params.py # control_params.csv
python NeuronVS_layout/tools/decode_streams.py       # page_summary / page_controls / page_tokens / page_refs
python NeuronVS_layout/tools/resolve_page_refs.py    # page_ref_links.csv
python _tools/build_layout.py                        # maqueta y CSV
python NeuronVS_layout/tools/build_viewer.py         # viewer.html
python NeuronVS_layout/tools/build_pages_sheet.py    # pages_sheet.png
python NeuronVS_layout/tools/verify_layout.py        # exit 0
python NeuronVS_layout/tools/verify_param_link.py    # enlace knob <-> C_Param, exit 0
python NeuronVS_layout/tools/verify_observers.py     # observador, pasadas y callbacks, exit 0
python NeuronVS_layout/tools/verify_paint.py        # byte sucio -> pixeles, exit 0
python NeuronVS_layout/tools/verify_viewer.py        # exit 0
python NeuronVS_layout/tools/verify_pages_sheet.py   # exit 0
```

`build_viewer.py --check` compara la página con lo que generarían las tablas sin escribir nada, y es lo primero que hace el verificador.
