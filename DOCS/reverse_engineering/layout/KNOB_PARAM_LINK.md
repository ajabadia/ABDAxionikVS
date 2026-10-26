# Del knob al `C_Param`: cómo se enlaza la UI con el valor

Este documento cierra el eslabón que falta entre el layout
([`page_controls.csv`](page_controls.csv)) y la tabla de parámetros
([`PARAM_RECORD.md`](../NeuronVS_preset_format/PARAM_RECORD.md)): **qué hace el
editor, en tiempo de carga de página, para que mover un control escriba en el
registro `C_Param` correcto y para que un cambio venido del preset o del host
repinte ese control.**

No hay nombres ni búsquedas: el enlace es un puntero a `tabla + índice*0x28`, y
la notificación es una matriz de observadores dentro del propio registro. Todo lo
que sigue está leído del binario (`0x1001c320`, los *binders* de cada clase y los
helpers de alta), no inferido del layout.

## 1. Los dos extremos

```
carga de página            alta del observador                 valor
───────────────            ───────────────────                 ─────
FUN_1001c320               binder de la clase                  C_Param +0x1c
  crea el widget    ──►       elige el registro      ──►        (float)
  por id                      tabla + idx*0x28                   ▲   │
                                   │                             │   │
                                   └─ attach(observador) ──► matriz +0x20
                                                              (16 punteros)
                                                                   │
mover el knob ──► FUN_100014a0 ──► FUN_10001170 ──► FUN_10001550 ──┘
  (delta de ratón)   valor+delta*step   cuantiza/recorta   avisa a los
                                                            observadores
                                                                   │
                                             callback del widget ◄─┘
                                             (marca "sucio")
```

El valor vive **sólo** en `C_Param+0x1c`. El control guarda un puntero al
registro, no una copia: el callback de notificación no escribe ningún valor,
sólo invalida el widget (el icono es la excepción, y aun así lee el registro).

## 2. De id de control a registro

`FUN_1001c320` recorre el stream de la página ([`page_tokens.csv`](page_tokens.csv)),
crea o reutiliza el widget de cada id y llama al *binder* de su clase con
`(editor, id, tokens)`. El binder es un `switch` sobre el id; cada `case` que
tiene parámetro calcula el puntero directamente:

```asm
; forma general en cualquier binder
mov ecx, [esi + 0x28]        ; core
mov edx, [ecx + 0x3dc]       ; snddat
mov eax, [edx]               ; base de la tabla de 445 registros
add eax, 0x398               ; + 23 * 0x28  → R1Switch
push eax
call <helper de alta>        ; ECX = widget
```

El desplazamiento **siempre** es múltiplo de `0x28`, y el índice que sale de
dividirlo es la fila de
[`preset_schema.csv`](../NeuronVS_preset_format/preset_schema.csv). Ejemplos
reales del binder de paneles (`0x1001e600`):

| id | offset | índice | clave |
|---:|---:|---:|---|
| 0x0d | `0x3e8` | 25 | `R1ParamLevel` |
| 0x0e | `0x3c0` | 24 | `R1Type` |
| 0x15 | `0x410` | 26 | `R1SelectStickPar` |
| 0x19 | `0x1068` | 105 | `R2ParamLevel` |

Los dos knobs reales de la clase `C_Knob` son otra cosa: el binder
`0x100206b0` sólo trata los ids 0 y 1 y los enlaza a `0x438` (27, `R1Volume`) y
`0x10b8` (107, `R2Volume`). El resto de los mandos redondos del panel son
`C_ControlPanel` con estilo de knob: 243 instancias frente a **2** `C_Knob`
([`page_controls.csv`](page_controls.csv)). Por eso el mapa completo tiene 29
filas de panel, 112 de icono, 28 de display, 3 de grafo y 2 de knob: 174 enlaces
sobre 170 claves distintas.

## 3. El alta: cada clase tiene su helper

Ningún binder llama a `FUN_100010a0` (el alta en la matriz) directamente; cada
clase tiene un helper de una pantalla que guarda el registro en un campo fijo del
widget, prepara el bloque observador y lo engancha:

| Clase | Binder | Helper | Registro en | Observador en | `owner` | Callback | Máscara | Copia rango |
|---|---|---|---:|---:|---:|---|---:|---|
| `C_ControlPanel` | `0x1001e600` | `0x1001af70` | `+0x34` | `+0x38` | `+0x40` | `0x1001ab30` | 5 | no (copia min/max a mano) |
| `C_Knob` | `0x100206b0` | `0x10014d60` | `+0x38` | `+0x3c` | `+0x44` | `0x10014950` | 5 | sí (1) |
| `C_IconButton` | `0x1001efa0` | `0x10017420` | `+0x34` | `+0x38` | `+0x40` | `0x10016d30` | 5 | no (rango fijo) |
| `C_DisplayButton` | `0x100207a0` | `0x10018a20`/`60`/`aa0`/`ae0` | `+0x3c`/`+0x40`/`+0x44`/`+0x48` | `+0x4c` (uno solo) | `+0x54` | `0x10017880` | 5 | sí (1) |
| `C_GraphEditor` | `0x100201b0` | `0x100010a0` directo | según caso | según caso | — | `0x1001d680`, `0x1001d770` | 5 | sí |

Dos helpers, desensamblados, para que se vea que no hay magia. Panel
(`0x1001af70`): guarda el registro, copia `min`/`max` del registro al bloque,
apunta el `owner` y el callback, y engancha con máscara 5:

```asm
1001af70  mov  esi,[ecx]              ; widget
1001af77  mov  ecx,[esi+0x34]         ; registro anterior
1001af7e  lea  eax,[esi+0x38]         ; observador
1001af82  call 0x10001110             ; baja el anterior
1001af8b  mov  [esi+0x34],ecx         ; registro nuevo
1001af92  mov  edx,[ecx+0x0c]         ; min
1001af95  lea  eax,[esi+0x38]
1001af98  push 5                      ; máscara
1001af9a  push 0                      ; copiar rango: ya copiado a mano
1001af9c  mov  [eax],edx               ; observador.min
1001af9e  mov  edx,[ecx+0x10]         ; max
1001afa1  push eax
1001afa2  mov  [esi+0x3c],edx         ; observador.max
1001afa5  mov  [esi+0x40],esi         ; owner
1001afa8  mov  [esi+0x4c],0x1001ab30  ; callback
1001afaf  call 0x100010a0             ; attach
```

Knob (`0x10014d60`): el mismo patrón, pero el registro va en `+0x38`, el
observador en `+0x3c` y **sí** pide `copiar rango = 1`, así que el alta copia
`min`/`max` del registro al observador:

```asm
10014d61  mov  esi,[ecx]
10014d7d  mov  [esi+0x38],ecx         ; registro
10014d82  mov  [esi+0x44],esi         ; owner
10014d85  mov  [esi+0x50],0x10014950  ; callback
10014d8c  push 5
10014d8e  add  esi,0x3c                ; observador
10014d91  push 1                      ; copiar min/max
10014d93  push esi
10014d94  call 0x100010a0
```

`C_IconButton` es la excepción: no copia el rango del registro, escribe un rango
fijo `min = 0x4283fae1` (65.9899979) y `max = 0`. Es el único sitio donde el rango
del observador no sale del parámetro, y conviene tenerlo presente al reproducir
el comportamiento (un icono no enseña el valor 0..max, sólo su estado).

`C_DisplayButton` enlaza **cuatro** registros (A/D/S/R) con cuatro helpers, pero
los cuatro escriben en el mismo bloque observador `+0x4c`: el `min`/`max` que
queda es el del último alta. Con los cuatro ADSR en `0..127` el efecto es
inofensivo, pero es un detalle real del original, no una simplificación.

## 4. El bloque observador y la matriz

El observador son **0x18 bytes** dentro del propio widget:

| Offset | Campo | Quién lo escribe |
|---:|---|---|
| `+0x00` | `float min` | helper de alta (copia o constante) |
| `+0x04` | `float max` | ídem |
| `+0x08` | `void *owner` | helper (`[obs+8] = widget`) |
| `+0x0c` | `int tag` | libre para la clase; el grafo elige con él a qué texto escribe |
| `+0x10` | callback pasada 0 | sólo si la clase lo instala (aquí, nadie) |
| `+0x14` | callback pasada 1 | helper (todos los widgets) |

`FUN_10001010` es el `clear()` del bloque: pone los seis dwords a cero (`min`,
`max`, `owner`, `tag` y los dos callbacks). Lo hacen los constructores y, cuando
toca rellenarlo desde cero, el binder (el del grafo lo llama justo antes de
escribir `owner` y el callback). Sin él, un widget que pierde su registro podría
quedarse con el rango y el callback del enlace anterior.

El registro guarda hasta **16** punteros a observadores en `+0x20`, con la
capacidad en `+0x24`. `FUN_100010a0` busca el primer hueco, guarda el puntero y,
si `copiarRango != 0`, copia `min`/`max`; después notifica **sólo a ese
observador** con máscara `5`. Con 174 enlaces sobre 170 claves, el máximo real es
**2 controles por registro** (los cuatro ADSR), muy lejos de 16; sumando el
observador del host en los 26 parámetros VST, el máximo es 3.

## 5. El valor: quién escribe y a quién avisa

`FUN_10001170(this=registro, valor, máscara, observadorOrigen)` es el único
escritor de `+0x1c`:

1. si recibe un observador de origen, reescala el valor de entrada de
   `[origen.min, origen.max]` al `[registro.min, registro.max]` (`0x100012a0`);
2. cuantiza por `+0x18` (step) y recorta a `[+0x0c, +0x10]`, salvo que la máscara
   lleve `8`, que envuelve;
3. llama dos veces a `FUN_10001550`: pasada 0 (callbacks `+0x10`) y pasada 1
   (`+0x14`), y en medio escribe el valor nuevo en `+0x1c`; si la pasada 0
   devuelve 0, el valor no se escribe y la pasada 1 ve el viejo.

`FUN_10001550` recorre la matriz y decide a quién avisa con la máscara:

| Bit | Significado |
|---:|---|
| `0x1` | avisa al observador de origen (el que se pasó como rango) |
| `0x2` | avisa a los demás |
| `0x4` | avisa aunque el valor no haya cambiado |
| `0x8` | envuelve en vez de recortar (no es notificación) |

Por eso el `attach` usa `5` (origen + forzar: sincroniza el widget recién
enganchado), el host usa `6` en `setParameter` (los demás + forzar: `0x1001ba00`),
y el arrastre usa `3` o `0xb` (todos, con o sin envolver). El cargador de presets
usa `0` (silencio) y luego `6`.

Las máscaras de la UI son `5` en el alta y `3`/`0xb` al mover. Como el callback
de pasada 1 es el único instalado, la notificación útil ocurre en la segunda
pasada.

## 6. De la UI al valor

Tres caminos, todos terminan en `FUN_10001170` sobre el registro enlazado:

- **Arrastrar** (`FUN_10014970`, bucle del knob): calcula el delta del ratón y
  llama a `FUN_100014a0(delta, 3, 0)` sobre el registro enlazado; esa función
  hace `nuevo = valor + delta * step` (lee `+0x1c` y `+0x18`) y llama a
  `FUN_10001170` sin observador de origen (máscara 3 → avisa a todos, UI y host).
  En la misma vuelta, si el byte de edición de texto (`+0x98`) está a 0, repite
  el delta sobre un **`C_Param` privado del propio knob**, en `+0x64`, con
  máscara `0xb` (todos + envolver). Ese segundo registro no lo enlaza ningún
  binder; ver §6.1.
- **Reset** (`C_Knob_v04_createChild`, rama `0x11`): lee `[registro+0x14]`
  (default) y llama a `FUN_10001170(default, 3, 0)`.
- **Entrada de texto** (`C_Knob_v06`): `sscanf`, luego
  `FUN_10001170(valor, 3, 0)`.

Ninguno escribe `+0x1c` a mano: todos pasan por el mismo escritor, así que la
cuantización, el recorte y el aviso son idénticos venga el cambio de donde venga.

### 6.1 El `C_Param` privado del knob (`+0x64`)

Además del registro que le enlaza el binder, `C_Knob` guarda uno **propio**,
embebido en el objeto en `+0x64`. Son 0x28 bytes, justo hasta el puntero de
bitmap `+0x8c`, y lo construye el propio ctor con
`FUN_10001030` —el constructor de `C_Param`, el mismo que usa el bucle de la
tabla de 445—, que lo deja con `min = 0`, `max = 0`, `default = 0`, `step = 1.0`
y `value = 0`. Acto seguido el ctor sube el máximo y escribe un valor aleatorio:

| Campo | Offset en el widget | Valor |
|---|---:|---|
| `min` | `+0x70` | 0 (del constructor) |
| `max` | `+0x74` | `0x42b20000` = 89.0 |
| `default` | `+0x78` | 0 (del constructor) |
| `step` | `+0x7c` | 1.0 (del constructor) |
| `value` | `+0x80` | `rand() * (1/32768) * 89`, con máscara 0 |

```asm
100145e9  lea  ecx,[esi+0x64]
100145f8  call 0x10001030                 ; C_Param::C_Param
1001476b  mov  dword ptr [esi+0x74],0x42b20000   ; max = 89.0
10014772  call 0x10021518                 ; rand()
10014783  lea  ecx,[esi+0x64]
10014798  call 0x10001170                 ; valor aleatorio, máscara 0 (silencio)
```

Y el arrastre, en cada vuelta del bucle (`FUN_10014970`):

```asm
10014a14  mov  ecx,[ebx+0x38]   ; registro enlazado
10014a17  test ecx,ecx
10014a19  je   0x10014a25
10014a1d  push 3                ; máscara: todos
10014a20  call 0x100014a0
10014a25  mov  al,[ebx+0x98]    ; ¿edición de texto?
10014a2d  jne  0x10014a3c
10014a31  push 0xb              ; máscara: todos + envolver
10014a34  lea  ecx,[ebx+0x64]    ; el registro privado
10014a37  call 0x100014a0
```

Ningún helper de alta lo toca y nadie llama a `FUN_100010a0` sobre él: su matriz
de observadores queda vacía, así que sus notificaciones no llegan a nadie. Sólo
lo escriben el ctor (una vez, en silencio) y el arrastre (cada vuelta, con `0xb`
para que envuelva en `0..89`).

Su lector es el **pintado de la clase** (`0x10014a70`), no un enlace: el
`FUN_100014c0(0)` que el pintado hace con `ECX = widget+0x64` devuelve el valor
recortado y es el **fotograma de la aguja** — `ftol` y luego `fotograma × alto`
como origen Y de la tira 11601. Es decir, el registro privado es el contador de
posición de la aguja y el registro enlazado sólo alimenta la etiqueta
([`PAINT_PIPELINE.md`](PAINT_PIPELINE.md) §4). Consecuencia real, no teórica: la
aguja no se mueve con el valor sino con el **recorrido del ratón** (el arrastre
le suma el mismo delta de píxeles, con paso 1.0 y vuelta en 0..89), arranca en
una posición aleatoria del ctor y **nadie la resincroniza** al cargar un preset
ni al recibir automatización, así que puede señalar un ángulo que no
corresponde al valor. Al reproducir el comportamiento hay que conservar tanto el
registro enlazado (valor + etiqueta) como este contador (aguja), y el doble
escritura del arrastre cuando no se está editando el texto.

## 7. De vuelta: qué hace el callback

El callback no copia el valor. Knob (`0x10014950`):

```asm
10014950  mov  eax,[esp+0xc]     ; tercer argumento = observador+8
10014954  mov  ecx,[eax]         ; owner
10014958  test ecx,ecx
1001495a  mov  edx,[ecx]         ; vtable
1001495c  push 1
1001495e  call [edx+0x38]        ; owner->vfunc(+0x38)(1)
10014961  ret
```

`vfunc(+0x38)` es `0x10007cf0`: `byte [this+0x30] = 1`, es decir, marca el widget
como sucio. El valor se lee del registro al pintar; el widget ya guarda su
puntero. El display (`0x10017880`) hace lo mismo con su widget hijo en `+0x38`, y
el panel (`0x1001ab30`) usa además el valor para elegir un carácter de su tabla
y decidir qué segmentos enciende. El icono (`0x10016d30`) es el único que
formatea el número: lo trunca, lo escribe en el texto de `+0x80` (con `%02.2i`
o sin relleno, según si el rango cruza cero) y guarda el entero en `+0x78`.

Este callback es siempre el de la **pasada 1**; la pasada 0 (ranura `+0x10`) no
tiene ningún suscriptor en el binario. El alta, la baja, las dos pasadas y el
censo completo de callbacks —incluidos los que reenganchan paneles e iconos en
las matrices— están en [`OBSERVER_PASSES.md`](OBSERVER_PASSES.md).

Y lo que el knob hace con ese valor cuando ya sabe que hay algo nuevo que
pintar —la aguja, que sale de su `C_Param` **privado** y no del registro
enlazado— está en [`PAINT_PIPELINE.md`](PAINT_PIPELINE.md).

## 8. El host es un observador más

Los 26 parámetros VST no son objetos aparte: `core+0xc0[i]` apunta al registro
`tabla + índice*0x28`, y `core+0x128 + i*0x18` es un observador de 0x18 bytes
enganchado con máscara **7** (origen + demás + forzar). `setParameter`
(`0x1001ba00`) llama a `FUN_10001170(valor, 6, observadorHost)`: cambia el valor
y avisa a todos menos a sí mismo. `getParameter` (`0x1001ba30`) usa
`FUN_100014c0` con ese observador, que recorta y reescala a `0..1`. Es el mismo
mecanismo de la UI, con otra máscara.

Consecuencia práctica: un `C_Param` puede tener a la vez un knob, un panel, el
host y una vista hija escuchando; no hay copias ni sincronización aparte. Y como
`R1ParamLevel` (25) es a la vez parámetro de UI y selector de página de la vista
hija 1, mover ese panel cambia qué página enseña la vista.

## 9. Verificación

```bash
python NeuronVS_layout/tools/verify_param_link.py       # helpers, máscaras, host y knobs
python NeuronVS_layout/tools/decode_control_params.py   # 174 enlaces, offsets múltiplos de 0x28
python NeuronVS_layout/tools/verify_viewer.py           # 174 enlaces releídos del DLL
python NeuronVS_layout/tools/verify_observers.py        # 0x10001010, dos pasadas, callbacks
python NeuronVS_preset_format/tools/verify_preset.py    # alta/baja, matriz de 16, máscaras
```

`verify_param_link.py` desensambla los siete helpers y comprueba el registro, el
observador, el `owner`, el callback, su offset, la máscara 5 y si copia el rango;
además exige el `setParameter` con máscara 6, el alta del host con 7 y paso
`0x18`, la tabla de 26 índices, los registros 27/107 de los dos knobs y el doble
arrastre con `3` sobre `+0x38` y `0xb` sobre `+0x64`. Falla si se cambia
cualquiera de esos números.

`decode_control_params.py` comprueba además que cada offset aparece como inmediato
en el binder desensamblado, así que un `case` con un `0x28` inventado falla.

## 10. Límites

- **Los callbacks no tienen nombre ni símbolo**: `0x1001ab30`, `0x10014950`,
  `0x10016d30` y `0x10017880` son etiquetas del desensamblador; su papel se deduce
  de quién los instala y qué hacen con el tercer argumento.
- **El pintado no se traza aquí**: está comprobado que el callback sólo marca
  sucio (`0x10007cf0`) y que el widget guarda el registro; qué hace exactamente
  la rutina de dibujo con `+0x1c` queda fuera de este documento.
- **`C_DisplayButton` comparte un observador entre cuatro registros**: es lo que
  dice el código, pero no hay una prueba en ejecución de que el rango del último
  alta sea el que se usa al pintar los cuatro valores.
- **El `C_Param` privado del knob (`+0x64`) sólo lo lee el pintado**: es el
  fotograma de la aguja (§6.1). Nadie lo notifica ni lo resincroniza, así que
  aguja y valor pueden discrepar; no hay ninguna otra ruta que lo lea.
- **El rango fijo del icono** (`0x4283fae1`, `max = 0`) es un valor del binario sin
  explicación localizada; se documenta tal cual.
