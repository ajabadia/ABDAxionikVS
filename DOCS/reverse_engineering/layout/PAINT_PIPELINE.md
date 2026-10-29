# Del byte "sucio" a los píxeles: la cadena de pintado

Este documento sigue el camino que va del **byte de invalidez** de un widget
hasta los píxeles que dibuja el editor: quién pone ese byte, quién lo lee, cómo
se recorre el árbol de widgets y, dentro de cada clase, **qué lee del
`C_Param` y con qué blit se estampa**.

Es la tercera pieza de la cadena documentada aquí:

* [`KNOB_PARAM_LINK.md`](KNOB_PARAM_LINK.md) — quién enlaza un control con un
  registro `C_Param` y cómo el valor vuelve al control.
* [`OBSERVER_PASSES.md`](OBSERVER_PASSES.md) — cómo se notifica el cambio a los
  observadores.
* **este** — qué hace el control cuando ya sabe que hay algo nuevo que pintar.

Todo lo que sigue está leído del binario (`NeuronVS.dll`), no del decompilado:
cada afirmación tiene una dirección y un comprobador detrás
([`tools/verify_paint.py`](tools/verify_paint.py)).

```
WM_PAINT ──► ¿algo sucio? ──► slot 5 ──► slot 1 (pintado de la clase)
  0x10008810   0x100087d0    0x10007d60   0x10014a70  knob
                                               0x100161a0  led
                                               0x1001ac30  panel
                                               0x10018220  mini-display ADSR (66×22)
                                               0x10017950  compositor ADSR (458×71)
```

## 1. El byte "sucio": un byte en `+0x30` y dos slots

Todos los widgets de la familia (`C_Rect`, `C_Knob`, `C_Led`, `C_ControlPanel`,
`C_DisplayButton`, `C_PadGrid`) comparten la misma cola de vtable y los mismos
dos slots para la invalidez:

| slot | offset | función | qué hace |
|---:|---:|---|---|
| 0 | `+0x00` | `0x100147c0` (knob), `0x1001a9e0` (panel), `0x100160f0` (led), `0x100176c0` (display) | destructor |
| 1 | `+0x04` | `0x10014a70` / `0x100161a0` / `0x1001ac30` / `0x10018220` / `0x10017950` | **el pintado de la clase** |
| 4 | `+0x10` | `0x10014b30` / `0x1001acd0` | `createChild` (ratón) |
| 5 | `+0x14` | `0x10007d60` (común) | **pinta si está sucio** |
| 13 | `+0x34` | `0x10007ce0` (común) | lee el byte |
| 14 | `+0x38` | `0x10007cf0` (común) | escribe el byte |

> El nombre lo dice: `NeuronVS_classes/functions/1001ac30_C_ControlPanel_v01_paint.c` es el
> **slot 1** (el pintado), que `NeuronVS_classes/dtor_chain.csv` justifica con el cuerpo
> («slot 1 is 0x1001ac30: blits the panel background with FUN_10008ec0»). El destructor
> real es `0x1001a9e0`, el slot 0.

Los dos slots de la invalidación son triviales y compartidos:

```c
undefined1 FUN_10007ce0(int *p) { return *(undefined1 *)(p + 0x30); }   // slot 13
void     FUN_10007cf0(int *p, u8 v) { *(undefined1 *)(p + 0x30) = v; } // slot 14
```

El byte vive en `+0x30`, dentro del bloque `C_Rect` que la clase base empotra
en `+0x08` (el `C_Rect_ctor` pone a cero su `+0x28`, que es exactamente el
`+0x30` del widget). El rectángulo, en cambio, es `{izq, arr, der, aba}` en
`+0x08/+0x0c/+0x10/+0x14`: `C_Knob::paint` lee `[esi+8]` y `[esi+0xc]` como la
esquina superior izquierda de su destino, y el ancho y el alto salen del bitmap,
no del rectángulo.

Quién pone el byte a 1:

* `FUN_10016300` (`C_Led::setLit`): marca el LED como sucio.
* `FUN_1001ab30` (el callback del panel): marca el panel como sucio.
* `FUN_1001acd0` (el ratón del panel): marca el panel al pulsar y al soltar.
* `FUN_10017880` / `FUN_100178b0` (los callbacks de `C_DisplayButton`): marcan la
  mini-pantalla (`+0x38`) y el compositor padre como sucios cuando cambian `A, D, S, R`.

Quién lo pone a 0: **el propio pintado** — en el knob, tras formatear el texto
y justo antes de blitar la aguja (`call [eax+0x38]` con `0` en `0x10014abf`); en
el panel (`0x1001ac5c`), en el LED (`0x100161cc`) y en las pantallitas ADSR
(`0x10018220` y `0x10017950`), al principio — y otra vez el slot 5 al terminar.

## 2. El recorrido: de la ventana al píxel

`FUN_100087d0` pregunta si hay algo sucio: mira su propio byte (slot 13) y, si
no, recorre la lista de hijos (`[this+0x48]`, `[this+0x40]`) preguntando a cada
uno su slot 13.

`FUN_10008810` (el `WM_PAINT` de la ventana) sólo entra si `FUN_100087d0`
devuelve 1; entonces construye el widget raíz con el `HDC` de la ventana
(`FUN_10006f50`) y le llama al slot 5.

`FUN_10008760` (el pintado del contenedor) baja por los hijos:

```c
if (visible) {
    if (owner)          { owner->slot5(canvas); return; }   // delega en su dueño
    if (isDirty())      { paint(); setDirty(0); return; }   // se pinta él
    for (cada hijo)     hijo->slot5(canvas);                // y si no, sus hijos
}
```

Y el slot 5 (`FUN_10007d60`) es la puerta de la invalidez:

```c
void FUN_10007d60(int *w, int canvas) {
    if (isDirty(w)) {          // slot 13
        w->slot1(canvas);      // el pintado de la clase
        w->setDirty(0);        // slot 14
    }
}
```

El `canvas` viaja como **único argumento de pila** (`RET 4` en todos los
pintados): es el widget raíz, y es el que lleva el `HDC` (`+0x14`) y el origen
del lienzo (`+0xc`, `+0x10`). Los blits suman ese origen al rectángulo de
destino, así que las coordenadas de cada control son relativas al lienzo.

## 3. Los tres blits (`BitBlt` opaco, máscara 5-ROP y `AlphaBlend`)

Sólo hay tres primitivas de dibujo, y ninguna clase de widget llama al GDI directamente.

**Opaco** (`FUN_10008ec0`): crea un `DC` compatible, selecciona el bitmap origen
y hace **un** `BitBlt` con `rop = 0xCC0020` (`SRCCOPY`):

```c
BitBlt(canvas->hDC,                       // canvas+0x14
       canvas->x + dest[0],                // canvas+0xc
       canvas->y + dest[1],                // canvas+0x10
       dest[2] - dest[0],                  // ancho  = der - izq
       dest[3] - dest[1],                  // alto   = aba - arr
       srcDC, src[0], src[1], 0xCC0020);
```

Los rectángulos son `{izq, arr, der, aba}`; del rectángulo origen sólo se usan
las dos primeras coordenadas (el tamaño lo impone el destino).

**Con máscara** (`FUN_10008f50` → `FUN_10009670`): crea un `DC` compatible,
toma la `BITMAPINFO` con `GetObjectA`, convierte el origen con `DPtoLP` y
encadena los blits. Con bitmap de máscara (`+0x18`) son cinco:

1. `0xCC0020` copia la región del lienzo a un bitmap temporal;
2. `0x660046` (`SRCAND`) con la **fuente**;
3. `0x8800C6` (`MERGEPAINT`, OR enmascarado) con el **bitmap de máscara**;
4. `0x660046` (`SRCAND`) con la **fuente**;
5. `0xCC0020` copia el temporal al lienzo.

Sin bitmap de máscara se toma el otro camino (`0x100096d7`): se crea un bitmap
monocromo de 1×1 con `BkColor` = la clave de color (`+0x10`), se pone esa clave
en el `DC` de la fuente y se hacen tres blits sobre el lienzo (`0x660046` con
la fuente, `0x8800C6` con el bitmap de la clave, `0x660046` con la fuente), más
la copia al temporal. Es lo que permite que la aguja y los LEDs no pinten un
rectángulo opaco.

**Con canal alfa (`FUN_10008ff0` → `msimg32.dll!AlphaBlend`)**: resuelve en
runtime `DAT_100556d4 = GetProcAddress(LoadLibraryA("msimg32.dll"), "AlphaBlend")`
y empaqueta el byte de opacidad constante (`param_5`) como `BLENDFUNCTION`
(`SourceConstantAlpha = param_5`, `param_2 = (uint)param_5 << 0x10`):

```c
BLENDFUNCTION bf = { AC_SRC_OVER (0), 0, alpha_byte, 0 }; // (uint)alpha_byte << 16
AlphaBlend(dstDC, dstX, dstY, w, h, srcDC, srcX, srcY, w, h, bf);
```

Lo utilizan exclusivamente las 7 instancias de `C_DisplayButton` (`FUN_10018220`
con `alpha = 0xC0` para las 7 mini-pantallas `66×22`, y `FUN_10017950` con
`alpha = 0x28` para la sombra y `0x80` para el trazo principal de la envolvente
ADSR en el visor `458×71`).

## 4. El knob: la aguja y la etiqueta

`C_Knob` guarda dos cosas distintas y no hay que confundirlas:

| offset | qué es |
|---|---|
| `+0x38` | puntero al `C_Param` **enlazado** (el registro del preset) |
| `+0x64` | `C_Param` **privado**, empotrado en el widget |
| `+0x70` / `+0x74` | su mínimo (0.0f) y su máximo (**89.0f**) |
| `+0x8c` | `C_Bitmap` de la **máscara de clic** (recurso 11600, 2 colores) |
| `+0x90` | `C_Bitmap` de la **tira de la aguja** (recurso 11601) |
| `+0x94` | el objeto de texto |

El pintado (`0x10014a70`) hace dos cosas, y la primera no pinta nada:

1. **El texto.** Si existe el `C_Param` de `+0x38`, `FUN_100016e0` pregunta si
   su rango es bipolar (`min < 0 < max`, con el `0.0f` de `0x10049238`), y
   `FUN_100014c0` recorta el valor al rango `[min, max]` y lo vuelve a guardar
   en `+0x1c` del registro. El entero resultante se formatea con
   `FUN_10015910`, que elige entre `"%03i"` (rango unipolar) y `"%+02.2i"`
   (bipolar, con signo) y lo pasa a `FUN_100158d0`. O sea: **el registro
   enlazado sólo alimenta la etiqueta**.
2. **La aguja.** `FUN_100014c0` sobre el `C_Param` privado de `+0x64` devuelve
   el fotograma ya recortado a `0..89`; `ftol` lo trunca y se multiplica por el
   alto de la cara (el `+0xc` del bitmap de `+0x8c`): ese es el **origen Y** en
   la tira. El destino es el rectángulo del knob, con el tamaño de la cara
   (`+0x8`/`+0xc` del mismo bitmap), y el blit es **con máscara** (`FUN_10008f50`)
   sobre la tira de `+0x90`.

```c
frame = ftol(clamp(param_privado));          // 0..89
y     = frame * alto_cara;                    // 11600, el alto del fotograma
origen  = { 0, y };                           // en la tira 11601
destino = { knob.x, knob.y, knob.x+ancho_cara, knob.y+alto_cara };
blit_con_mascara(bmp_11601, destino, origen);
```

### El texto: del `C_Param` a los dígitos

La etiqueta no la pinta el knob: la escribe en un objeto de texto aparte
(`C_GraphEditor`, vtable `0x1004dea0`) que el propio ctor del knob crea en
`+0x94` con el **tipo de display** de su tabla de tipos
(`0x1004d20c + tipo*8`). La cadena es de tres pasos, y el primero corre dentro
del pintado del knob:

```
valor float ─► clamp[min,max] ─► ftol ─► sprintf ─► strncpy ─► glifos ─► blit
 +0x38/+0x1c    0x100014c0    0x100213a6 0x10015910  0x100158d0 0x10015280 0x100151c0
                                            │                     ▲
                     "%03i" / "%+02.2i" ────┘        atlas +0x1e8, scratch +0x1ec
```

**1. Formato** (`0x10015910`, dos argumentos, `RET 8`). Lee el flag bipolar en
`[esp+8]` (`FUN_100016e0`: rango invertido o que cruza el cero) y elige la
plantilla: `"%03i"` en `0x100545b8` para los unipolares, `"%+02.2i"` en
`0x100545c0` para los bipolares. `sprintf` sobre una pila de 32 bytes y el
resultado va a `0x100158d0`; el valor es el **entero truncado**, no el float:
un parámetro `0..1` enseña `000`/`001`.

**2. Copia y aviso** (`0x100158d0`). `strncpy(text+0x1cc, cadena, 0x12)` — 18
bytes, sitio de sobra para los tres caracteres y el terminador; sube el flag
"hay que rehacer" en `+0x1f0` y, **si el texto ya está enganchado**
(`[text+0x1b8] != 0`, el puntero al dueño que pone `0x10015810`), llama en el
acto a `0x10015280`. Si no, el rehacer se pospone y lo dispara el propio
enganche.

**3. Composición** (`0x10015280`). El texto no se dibuja letra a letra en
pantalla: se compone en un bitmap propio y el pintado del texto lo estampa de
una vez.

* Un paso único (`DAT_10061f50`) normaliza los **dos atlas de fuente**: recorre
  cada píxel y, si R, G y B caen en `0x71..0x8f` (gris casi neutro, el
  antialias), lo fija a `0x808080`. Es una pasada de prepintado sobre el atlas
  real: el widget temporal que usa para los `SetPixel` comparte el `HBITMAP`
  del atlas (`0x10007940` con flag 1 → `0x10008e70` devuelve `+0x14`).
* Para cada carácter `i` de los `+0x208` (el número de la tabla de tipos):
  `c = text[+0x1cc][i]`, si es 0 se para, `glifo = c − 0x21`,
  `origenX = +0x200 + glifo * +0x1fc`, y la celda
  `{origenX, 0, origenX + ancho, alto}` se estampa en
  `{i * avance, 0, i * avance + ancho, alto}` con el blit **con máscara**
  (`0x10008f50`) desde el atlas `+0x1e8`, donde `ancho = +0x1fc` y
  `avance = +0x204`.
* Al final `+0x1f0 = 0` y `setDirty(1)` en el texto.

**4. Estampado** (`0x100151c0`, slot 1 del texto). `setDirty(0)` y, si no está
en estado "borrado" (`+0x1f1`), un **único blit opaco** del scratch `+0x1ec`
en `(+0x20c + x, +0x210 + y)` con el tamaño del propio scratch. La rama
contraria (`+0x1f1 != 0`) restituye un parche de fondo con `0x10004de0`.

Los campos del objeto de texto, todos puestos por su ctor `0x10014dd0` a partir
del registro de 18 bytes por **tipo de display** (`0x1004d2b8 + tipo*0x12`):

| offset | campo | origen |
|---:|---|---|
| `+0x1cc` | la cadena (18 bytes) | `0x100158d0` |
| `+0x1e8` | atlas de fuente (`C_Bitmap`) | tabla de fuentes `0x1004d2a0` |
| `+0x1ec` | scratch de los dígitos (`C_Bitmap`) | `0x10008de0`, tamaño calculado |
| `+0x1f0` | "rehacer los glifos" | `0x100158d0` |
| `+0x1f1` | estado borrado | el propio texto |
| `+0x1fc` | ancho de celda (16 px) | tabla de fuentes |
| `+0x200` | x del primer glifo en el atlas | tabla de fuentes |
| `+0x204` | avance entre glifos | tabla de fuentes |
| `+0x208` | nº de caracteres | registro de tipo, byte +8 |
| `+0x20c` / `+0x210` | desplazamiento x / y | registro de tipo, +0xc / +0xe |
| `+0x1b8` | ¿enganchado? | `0x10015810` |

Las dos fuentes de la tabla `0x1004d2a0` (12 bytes por registro) son el recurso
**11100** (celda 16, primer glifo en x=3, avance 8) y el **11101** (celda 16,
x=5, avance 5); ambos PNG miden 1568 de ancho = **98 glifos**, o sea los
caracteres `0x21..0x82`. El ancho del scratch sale de la propia tabla:
`(n−1)·avance − primerGlifo + celda − 1`. Para el tipo de display **11** (el de
los dos knobs reales: `C_Knob` tipo 0 → knob en (101,133), display en (77,92),
3 caracteres, fuente 0, desplazamiento (4,2)) da `2·8 − 3 + 16 − 1 = 28` px de
ancho por 16 de alto: las tres cifras caben en 28 px porque cada celda de 16
se solapa 8 con la siguiente.

La **cara tampoco la pinta nadie**: el 11600 no es un dibujo. Son 50×50 y
**dos colores** (negro fuera, blanco dentro), y su único uso es el **hit test
del ratón** en `0x10014b30`: copia la máscara a un widget temporal del tamaño
de la cara (`FUN_10007b00`), traslada la posición del cursor al espacio del
knob y lee el píxel con `GetPixel` (`FUN_10007490`); si el color es
`DAT_100556c0` (0, el negro del borde) el clic no es del mando y el arrastre
ni empieza. Todo el dibujo del mando —cuerpo, marcas y aguja— está ya
pre-renderizado en el fotograma de la tira 11601, y el knob sólo elige uno.

## 5. El panel: la celda y los LEDs

`C_ControlPanel` es un display de una celda del atlas, con un grupo de LEDs
encima. Sus campos:

| offset | qué es |
|---|---|
| `+0x64` | `C_Bitmap` del **atlas** de la piel |
| `+0x68` | `C_Bitmap` de **trabajo** (`ancho_celda × n_columnas` × `2 × alto_celda`) |
| `+0x6c` | `columnas − 1` (el índice se recorta a `+0x6c − 1`) |
| `+0x70` / `+0x74` | el tamaño de la celda (17×12, 22×21, 36×23, 33×22, 19×12…) |
| `+0x78` | byte de "pulsado" |
| `+0x7c` | la cadena con los rótulos de los valores |
| `+0x80` | cuántos rótulos hay (el índice se recorta a n−1) |
| `+0x84` | el **dígito cacheado** (columna del atlas) |
| `+0x88` / `+0x8c` | el modo (1 = discreto, 2 = comparación) y el umbral |
| `+0x90` | la tabla de LEDs del tipo de panel |
| `+0x94` / `+0x98` | el array de LEDs y su número |

**En la construcción** (`0x10019f20`) el panel busca su tipo en dos tablas: la
de índices `0x1004ebfc` (12 bytes por tipo) da el número de registro, y el
registro vive en `0x1004eb50` (entradas de 24 bytes: `{recurso, ancho, alto,
…}`). Los siete registros son 11000 17×12, 11001 22×21, 36×23 (tres
veces), 11004 33×22 y 11003 19×12. Con él:

* crea el bitmap del atlas (los recursos 11000, 11001, 11002…);
* calcula `+0x6c` = `ancho_atlas / ancho_celda − 1`;
* crea el bitmap de trabajo con `ancho_celda × +0x6c` de ancho y
  `2 × alto_celda` de alto, y lo rellena con **dos blits opacos** desde el
  atlas: la fila de celdas normal y la de celdas resaltada.

**En runtime** el único que lee el registro es el callback `FUN_1001ab30`
(la notificación del observador; el valor llega como `float`):

```c
switch (modo) {                       // +0x88
  case 1:  indice = ftol(valor); if (indice >= max) indice = max - 1; break;  // +0x6c
  case 2:  indice = (valor == umbral) ? 1 : 0; break;                        // +0x8c
  default: indice = 0;
}
if (indice >= n_rotulos) indice = n_rotulos - 1;   // +0x80
digito = cadena[+0x7c][indice] - '0';              // +0x84
setDirty(1);                                      // el panel se repinta
```

Ojo con `+0x6c`: vale `columnas − 1`, así que el índice usable va de 0 a
`columnas − 2` — la última celda del atlas no se usa nunca, ni en el recorte
ni en el bitmap de trabajo (que también es una celda más estrecho).

Y a continuación enciende los LEDs. La tabla de `+0x90` es una lista de
**grupos** de `short`: `[nº_de_leds, tipo, tipo, …]`, terminada por un grupo con
`nº = 0`; el "tipo" de cada entrada es el índice del tipo de LED (0..38, 39
tipos) dentro de la tabla de posiciones `0x1004e170`/`0x1004e172`, y es el
constructor del LED (`0x10016250`) quien lo recibe para colocar la caja. El
bucle:

```c
for (cada grupo de la tabla +0x90) {
    for (k = 0; k < grupo.nº; k++) {
        if (grupo.tipo[k] >= 0)                   // -1 = hueco
            led[+0x94][i]->setLit(k == ftol(valor));   // 0x10016300
    }
}
```

El pintado del panel (`0x1001ac30`) es **un solo blit opaco**:

```c
setDirty(0);
origen  = { digito(+0x84) * ancho_celda,  (pulsado(+0x78) ? alto_celda : 0) };
destino = { panel.x, panel.y, panel.x+ancho_celda, panel.y+alto_celda };
blit_opaco(bmp_trabajo(+0x68), destino, origen);
```

O sea: la columna del atlas elige el dígito y la fila elige la variante normal
o resaltada. El byte `+0x78` lo pone el ratón (`0x1001acd0`), que además
escribe el valor al registro (`FUN_10001170` en el modo 2, `FUN_100014a0` para
los pasos) y fuerza el repintado.

### El LED

El `C_Led` es un objeto de 15×7 (recurso **11300**) cuya posición sale de una
tabla de 39 tipos: el primer `short` de cada entrada (`0x1004e170`) es la **y**
y el segundo (`0x1004e172`) la **x**; con ellas el rectángulo queda en
`{x-2, y-2, x+13, y+5}`, para que el halo de la máscara quepa. El tipo se
recorta a 0..38 en el constructor. Al pintarse:

* **encendido** (`+0x58` a 1): blit **con máscara** del 11300 sobre su rectángulo;
* **apagado**: blit **opaco** del parche de fondo que toma del dueño (`+0x28` →
  `+0x3c`) con origen `(x, y)`, es decir, restituye el fondo.

`C_Led::setLit` (`0x10016300`) escribe el byte `+0x58` y marca el LED como
sucio, así que el cambio de un LED dispara su propio repintado.

> **Pero en esta build los LEDs no llegan a píxeles.** El panel los crea
> (`0x10016250` → el `C_Led` de `0x10016000`) y los guarda en el array de
> `+0x94`, pero **nadie los engarza**: en todo el `.text` no hay ni una llamada
> al slot 25 (el `setParent` de `0x10005120`) ni una escritura al `+0x28` de un
> widget, así que el "dueño" del LED queda a 0 y la rama de "apagado" leería un
> puntero nulo. Además los LEDs **no están en el árbol de widgets**, así que el
> recorrido del §2 nunca llega a ellos: `setLit` sólo cambia un byte y marca un
> dirty que nadie consume. La capa de LEDs está cableada a medias; los píxeles
> del panel salen sólo de la celda del atlas.

## 6. Las 7 «pantallitas» ADSR (`C_DisplayButton`) y el compositor de envolvente (`458×71`)

Las 7 instancias de `C_DisplayButton` en la página 0 de `page_controls.csv`
(3 envolventes de `Resynator 1`: `R1Amp`, `R1Res`, `R1Free`; 3 de `Resynator 2`:
`R2Amp`, `R2Res`, `R2Free`; y 1 de `Silver Filter`: `FilterEnv`) combinan en un
solo objeto (`0xA8` bytes, constructor `FUN_10017470`) **dos superficies de
dibujo con sus propias vtables**:

* **El padre (`this+0x00`, vtable `0x1004e9c0`, slot 1 = `FUN_10017950`)**: el
  editor/compositor grande de envolvente ADSR de **`458×71` px** (`0x1CA × 0x47`),
  con dos bitmaps scratch de `458×71` en `+0x90` y `+0x94` y el icono de nodo
  arrastrable de **`7×7` px** (recurso **`11501` / `0x2CED`**) en `+0x98`.
* **La «pantallita» hija empotrada (`this+0x38`, vtable `0x1004e940`, slot 1 = `FUN_10018220`)**:
  el mini-display selector de **`66×22` px** (`0x42 × 0x16`), con el bitmap
  recurso **`11500` (`0x2CEC`)** en `child+0x6c` (`parent+0xa4`) y un scratch de
  `66×22` en `child+0x68` (`parent+0xa0`).

Ambos leen los mismos **4 punteros `C_Param*`** enlazados en `parent+0x3c..+0x48`
(`param_1[0xf..0x12]` = `Attack`, `Decay`, `Sustain`, `Release`, enlazados por
el helper `FUN_10017820` con el callback `0x10017880`):

| offset (padre) | offset (hijo `+0x38`) | significado |
|---:|---:|---|
| `+0x3c` (`[0x0f]`) | `+0x04` (`[1]`) | `C_Param*` Attack (`A`) |
| `+0x40` (`[0x10]`) | `+0x08` (`[2]`) | `C_Param*` Decay (`D`) |
| `+0x44` (`[0x11]`) | `+0x0c` (`[3]`) | `C_Param*` Sustain (`S`) |
| `+0x48` (`[0x12]`) | `+0x10` (`[4]`) | `C_Param*` Release (`R`) |
| `+0x90` / `+0x94` | — | 2 bitmaps scratch `458×71` (`0x1ca × 0x47`) |
| `+0x98` | — | bitmap `11501` (`7×7` handle de nodo ADSR) |
| `+0x9c` | `+0x64` (`[0x19]`) | flag `isSelected` (`0` = normal, `1` = activo) |
| `+0xa0` | `+0x68` (`[0x1a]`) | bitmap scratch `66×22` (`0x42 × 0x16`) |
| `+0xa4` | `+0x6c` (`[0x1b]`) | bitmap `11500` (`66×22`, 2 filas: normal `y=0`, activo `y=22`) |

### 6.1 Pintado de la mini-pantalla `66×22` (`FUN_10018220`)

1. Limpia su byte sucio (`slot 14`) y copia el fondo `66×22` desde el recurso
   `11500` (`child+0x6c`): si la pantallita está activa (`child+0x64 != 0`)
   toma la segunda fila (`srcY = 22`), si no la primera (`srcY = 0`), y además
   copia el parche de fondo del panel padre a su scratch `child+0x68`.
2. Escala los 4 parámetros `A, D, S, R` (normalizados con `FUN_100014c0` sobre
   su rango `max - min`) a coordenadas enteras de la cajita `66×22`:
   * `A`, `D`, `R` se escalan por `0.15f` (`15` px máximos cada uno en X);
   * `S` se escala por `0.18f` (`18` px máximos en Y, invertido desde `y = 20`).
3. Construye la polilínea de **5 vértices** (`aiStack_38`, 10 `int`s):
   * `P0 = (1, 21)` (`0x01, 0x15` — pie de ataque)
   * `P1 = (1 + A, 1)` (pico de ataque)
   * `P2 = (2 + A + D, 20 - S)` (`0x14 - S` — inicio de sustain)
   * `P3 = (13 + A + D, 20 - S)` (`0x0d + A + D` — meseta de sustain de 11 px)
   * `P4 = (14 + A + D + R, 21)` (`0x0e + A + D + R, 0x15` — fin de release)
4. Dibuja dos pasadas con `Polyline` (`FUN_100071b0` → `GDI32!Polyline` en
   `0x1004901c` y `CreatePenIndirect` en `0x10049020`) sobre el scratch `66×22`:
   * **Halo exterior**: grosor `3 px`, color gris claro `0xB0B0B0`;
   * **Núcleo interior**: grosor `1 px`, color blanco cálido `0xE1E1E1`.
5. Estampa el scratch sobre el lienzo con **`FUN_10008ff0` (`AlphaBlend`,
   `alpha = 0xC0 = 192`)**.

### 6.2 Pintado del compositor ADSR `458×71` (`FUN_10017950`)

1. Limpia el byte sucio y copia el parche de fondo de `458×71` (`0x1CA × 0x47`)
   desde el bitmap de la página (`owner+0x3c`) hacia los dos scratch `+0x90` y
   `+0x94`.
2. Escala `A, D, R` horizontalmente (`_DAT_1004ea40`) y `S` verticalmente
   (`_DAT_1004ea44`) y calcula los **5 vértices** en `local_90`:
   * `P0 = (6, 70)` (`0x06, 0x46`)
   * `P1 = (14 + A, 4)` (`0x0e + A, 0x04`)
   * `P2 = (22 + A + D, 66 - S)` (`0x16 + A + D, 0x42 - S`)
   * `P3 = (71 + A + D, 66 - S)` (`0x47 + A + D, 0x42 - S` — meseta de sustain de 49 px)
   * `P4 = (79 + A + D + R, 66)` (`0x4f + A + D + R, 0x42`)
3. **Sombra proyectada (`+6 px` en X, `+5 px` en Y, en `aiStack_40` sobre `+0x90`)**:
   * Polilínea de `3 px` en gris oscuro `0x404040`;
   * Polilínea de `1 px` en negro `0x000000` + 4 líneas guía verticales de
     altura completa (`y = 0..71` con `MoveToEx`/`LineTo`, `FUN_100070e0`) en
     `P1.x + 6`, `P2.x + 6`, `P3.x + 6`, `P4.x + 6`;
   * Mezcla la sombra sobre `+0x94` con **`AlphaBlend` (`FUN_10008ff0`,
     `alpha = 0x28 = 40`)**.
4. **Curva principal y guías verticales (sobre `+0x90`)**:
   * Polilínea de `3 px` en gris plata `0xC8C8C8`;
   * Polilínea de `1 px` en blanco puro `0xFFFFFF` + 4 líneas guía verticales
     (`y = 0..71`) en `P1.x`, `P2.x`, `P3.x`, `P4.x`;
   * Mezcla la curva sobre `+0x94` con **`AlphaBlend` (`FUN_10008ff0`,
     `alpha = 0x80 = 128`)**.
5. **Nodos arrastrables (`11501`, `7×7` px)**: estampa con máscara (`FUN_10008f50`)
   el icono `+0x98` centrado (`[x-3, y-3, x+4, y+4]`) sobre los 4 vértices
   activos `P1..P4`, y finalmente vuelca `+0x94` al lienzo con `BitBlt` opaco
   (`FUN_10008ec0`).

## 7. `C_PadGrid` (`0x10018bb0`) y las tablas `DAT_1004ea50..54`

Los 3 controles `C_PadGrid` (`0x10018bb0`, `vtable 0x1004eb00`, `param_2 = 0, 1, 2`
para `Resynator 1`, `Resynator 2` y `Silver`) gobiernan los **Stick Pads 2D** y
sus etiquetas perimetrales:

* La geometría base del pad se lee de las tablas indexadas por `param_2` (`0..2`):
  * `DAT_1004ea50 + param_2 * 20` (`x`) y `DAT_1004ea52 + param_2 * 20` (`y`)
    fijan la esquina superior izquierda de cada `C_PadGrid` (de `111×111` px,
    `+0x57` desde el centro).
  * `DAT_1004ea54 + param_2 * 20` contiene **8 `short`s consecutivos** con los
    tipos de display (`0x1004d2b8`) para los **8 objetos `C_GraphEditor`** que
    el constructor instancia en `this+0x68..+0x84` (`local_bc + 0x1a`, bucle de
    8 iteraciones llamando a `FUN_10015760` → `FUN_10014dd0`):
    * **4 displays de nombre de parámetro (`8 caracteres`, fuente `11101`)**:
      muestran las etiquetas dinámicas de los 4 polos (`mnAN` en `R1`/`R2` según
      el `ParamSet` y `Level 1..3`, o los 4 efectos en `Silver`).
    * **4 displays numéricos (`3 caracteres`, fuente `11100`)**: muestran los
      valores `000..100` / `-50..+50` de los 4 polos alrededor del Stick.

## 8. Resumen de offsets

| clase | offset | significado | valor |
|---|---|---|---|
| todas | `+0x30` | byte de invalidez | 0/1 |
| todas | `+0x08`, `+0x0c` | esquina del rectángulo | izq, arr |
| `C_Knob` | `+0x38` | `C_Param` enlazado | sólo el texto |
| `C_Knob` | `+0x64` | `C_Param` privado | fotograma 0..89 |
| `C_Knob` | `+0x8c` / `+0x90` | máscara de clic 11600 / tira 11601 | |
| `C_Knob` | `+0x94` | objeto de texto del display | tipo de `0x1004d20c` |
| texto (`C_GraphEditor`) | `+0x1cc` / `+0x1f0` | cadena / rehacer | 18 bytes / 0-1 |
| texto (`C_GraphEditor`) | `+0x1e8` / `+0x1ec` | atlas de fuente / scratch | 11100 o 11101 |
| texto (`C_GraphEditor`) | `+0x1fc`..`+0x210` | celda, primer glifo, avance, nº, x, y | tabla `0x1004d2a0` y registro de tipo |
| `C_ControlPanel` | `+0x64` / `+0x68` | atlas / bitmap de trabajo | 2 filas |
| `C_ControlPanel` | `+0x6c` / `+0x70` / `+0x74` | columnas − 1 / ancho / alto de celda | |
| `C_ControlPanel` | `+0x7c` / `+0x80` | rótulos / cuántos hay | |
| `C_ControlPanel` | `+0x84` | dígito cacheado | columna del atlas |
| `C_ControlPanel` | `+0x88` / `+0x8c` | modo / umbral | 1 discreto, 2 comparación |
| `C_ControlPanel` | `+0x90` / `+0x94` / `+0x98` | tabla de LEDs / array / nº | |
| `C_Led` | `+0x54` / `+0x58` | bitmap 11300 / byte encendido | |
| `C_Led` | `+0x28` | el dueño (nunca se asigna) | 0 |
| `C_DisplayButton` | `+0x38` | sub-widget mini-display `66×22` | vtable `0x1004e940` |
| `C_DisplayButton` | `+0x3c`..`+0x48` | 4 punteros `C_Param*` (`A, D, S, R`) | leídos por `0x10018220` y `0x10017950` |
| `C_DisplayButton` | `+0x90`, `+0x94`, `+0x98` | 2 scratch `458×71` + nodo `7×7` (`11501`) | compositor `0x10017950` |
| `C_DisplayButton` | `+0xa0`, `+0xa4` | scratch `66×22` + fondo `11500` | mini-display `0x10018220` |
| `C_PadGrid` | `+0x68`..`+0x84` | 8 punteros `C_GraphEditor*` | tipos en `DAT_1004ea54 + idx*20` |

## 9. Cómo se comprueba

[`tools/verify_paint.py`](tools/verify_paint.py) relee el DLL y exige, punto por
punto, lo que afirma este documento:

1. que `C_Knob` y `C_ControlPanel` ponen la misma función en los slots 1, 5, 13
   y 14, y que el byte de invalidez es uno solo y está en `+0x30`;
2. que la ventana sólo entra a pintar si `0x100087d0` dice que hay algo sucio,
   y que `0x10008760` baja por los hijos con el slot 5;
3. que el knob toma el fotograma del `C_Param` **privado** (recorte, truncado y
   `fotograma × alto`) y hace el blit con máscara de la tira 11601, mientras que
   el registro enlazado sólo alimenta el texto;
4. que el panel cachea el dígito en `+0x84`, enciende los LEDs de `+0x90`/`+0x94`
   y sólo copia la celda `w×h` del bitmap de `+0x68`;
5. que el LED encendido se estampa con máscara (11300) y el apagado restituye el
   parche de fondo del padre;
6. que los LEDs no tienen padre y por tanto esa capa no llega a píxeles;
7. que la celda del panel sale de la tabla de `0x1004eb50` y que el bitmap de
   trabajo tiene `celda × columnas` de ancho y `2 × celda` de alto, con dos blits
   opacos desde el atlas;
8. que cada LED toma su caja de 15×7 del par `(y, x)` de la tabla de tipos y
   carga el recurso 11300;
9. que el knob carga 11600 en `+0x8c` y 11601 en `+0x90`, que su `C_Param`
   privado va de 0.0f a 89.0f, que el 11600 se usa como máscara de clic (blit a
   un widget temporal + `GetPixel` en `0x10014b30`, y el Ctrl+clic `0x11`
   repone el defecto del registro), y que el LED carga 11300 en `+0x54`;
10. que el tipo del panel pasa por la tabla de índices `0x1004ebfc` (12 bytes
    por tipo) al registro de 24 bytes de `0x1004eb50`, y que las columnas
    salen de `atlas / celda − 1`;
11. que los tipos de LED son 39 pares `(y, x)` en `0x1004e170` y que el
    constructor los recorta a 0..38;
12. que el blit con máscara encadena los cinco ROP en el orden correcto
    (`SRCCOPY`, `SRCAND` con la fuente, `MERGEPAINT` con la máscara,
    `SRCAND` con la fuente, `SRCCOPY`);
13. que la etiqueta de estado va del registro a los píxeles por
    `"%03i"`/`"%+02.2i"` (`0x10015910`) → 18 bytes en `+0x1cc` (`0x100158d0`)
    → glifos `char − 0x21` del atlas `+0x1e8` al scratch `+0x1ec`
    (`0x10015280`) → blit opaco en `(+0x20c, +0x210)` (`0x100151c0`), y que la
    tabla de tipos de display (`0x1004d2b8`, 18 bytes) y las dos fuentes
    (`0x1004d2a0`: 11100 16/3/8 y 11101 16/5/5) son las que dicen los bytes;
14. que las 7 pantallitas `C_DisplayButton` (`0x10017470`) enlazan los 4 registros
    `A, D, S, R` en `+0x3c..+0x48`, pintan la polilínea de 5 vértices en la
    mini-pantalla `66×22` (`0x10018220`, `alpha = 0xC0`) y en el compositor
    `458×71` (`0x10017950`, sombra `alpha = 0x28` + curva `alpha = 0x80` +
    4 nodos `11501` de `7×7`) mediante `FUN_10008ff0` (`msimg32.dll!AlphaBlend`).
