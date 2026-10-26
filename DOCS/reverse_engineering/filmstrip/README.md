# NeuronVS.dll — el filmstrip `11601` en GIF

El recurso `RT_BITMAP` **11601** (`0x2d51`) es una tira de **50×4500** px, 24 bpp, sin compresión: **90 fotogramas de 50×50** apilados en vertical. Cada fotograma es el mismo mando oscuro con una muesca grabada en la cara; a lo largo de la tira la muesca recorre la cara y vuelve al punto de partida, de modo que el último fotograma enlaza con el primero (diferencia media **2,07/255** entre el 0 y el 89, frente a **4,69/255** a mitad del recorrido) y el GIF puede repetir sin salto. Aquí está convertida en GIF, en tamaño nativo y ampliada, y con el control que la anima localizado en el código.

| Archivo | Qué es |
|---|---|
| [`11601.gif`](11601.gif) | 50×50 · 90 fotogramas · 40 ms · bucle infinito (3,6 s por ciclo) · 184 KB |
| [`11601_4x.gif`](11601_4x.gif) | el mismo GIF a 200×200 con escalado entero (nearest) · 733 KB |
| [`frames/`](frames/) | los 90 fotogramas sueltos, `000.png`…`089.png`, píxel a píxel |
| [`contactsheet.png`](contactsheet.png) | hoja de contactos 10×9 etiquetada (2×) |
| [`gif_samples.png`](gif_samples.png) | siete fotogramas del GIF (0, 15, 30, 45, 60, 75, 89) a 4× |
| [`frames.csv`](frames.csv) | índice, ruta y SHA-256 de cada fotograma |
| [`preview.html`](preview.html) | página para abrir el GIF en el navegador |
| `tools/filmstrip_gif.py` | reconstruye todo el paquete desde `NeuronVS_bitmaps/png/11601.png` |
| `tools/verify_gif.py` | comprueba el GIF contra la tira **y** las direcciones del código en el DLL |

## El control que lo anima

**`C_Knob`**, vtable `0x1004d21c`, constructor `0x100145b0` (tamaño de objeto 0x9c). El constructor hace dos `C_Bitmap_create`: `0x2d50` = **11600** (la cara del mando, 50×50) al campo `+0x8c`, y `0x2d51` = **11601** (la tira) al campo `+0x90`. También crea un rango propio en `+0x64` y fija su máximo a **89.0** (`+0x74`), con el valor inicial aleatorio (`rand() * max`).

El fotograma se elige en el **método de pintado**, ranura **1** de la vtable → **`0x10014a70`** (`C_Knob_v01_paint` en el export; `NeuronVS_classes/dtor_chain.csv` justifica el nombre, y el `RET 0x4` final prueba que recibe **un argumento de pila, el HDC**: es un blit, no un destructor). En ensamblador:

```asm
10014ac2  MOV EAX,[ESI+0x8c]   ; C_Bitmap 11600 (cara), ancho/alto en +8/+0xc
10014ad7  ...                  ; rect destino = posición del mando + tamaño de 11600
10014ae9  LEA ECX,[ESI+0x64]   ; rango propio del mando
10014aed  PUSH 0               ; param_2 = NULL -> devuelve el valor recortado a [min,max]
10014af9  IMUL EAX,EDI         ; EAX = fotograma * alto del bitmap (50)  -> origen Y
10014b0d  MOV ECX,[ESI+0x90]   ; C_Bitmap 11601 (la tira)
10014b19  CALL 0x10008f50      ; blit de la sub-tira: {0, fotograma*50}
```

`0x10008f50` → `0x10009670` hace un **blit con máscara** (tres `BitBlt` con ROP `0x00660046` SRCINVERT / `0x008800C6` SRCAND), es decir, el blanco del recurso se usa como clave de transparencia; por eso el GIF conserva el fondo blanco y se ve igual que en la aplicación.

El mismo `0x10014a70` escribe el número que aparece bajo el mando: si hay un parámetro enlazado en `+0x38`, lo recorta con `0x100014c0`, lo redondea con `ftol` (`0x100213a6`) y lo formatea con `0x10015910` (`sprintf("%02.2i")`).

### De dónde sale el valor

- **Arrastre**: ranura **4** de la vtable → **`0x10014b30`** (`C_Knob_v04_createChild`). Interpreta el evento de ratón y llama a `0x10014970`, un bucle que mide el desplazamiento vertical y mueve el parámetro con `0x100014a0(delta, 3, 0)`; luego marca el mando sucio con la ranura 14 (`0x10007cf0`, escribe el byte `+0x30`).
- Aviso de cambio: al enlazar el parámetro, `0x10014d60` registra en `param+0x50` el callback **`0x10014950`**, que vuelve a marcar el mando sucio. No hay temporizador: el fotograma es función del valor y se recalcula **en cada repintado**.
- **Texto/estado**: ranura **6** → `0x10014c90` convierte una cadena en valor del parámetro (`sscanf` + `0x10001170`).
- **Quién pinta**: el bucle de pintado de contenedores (`0x10008250`) recorre los hijos y llama a `hijo[1](hdc)`; para un `C_Knob` eso es `0x10014a70`.
- **Quién lo crea**: el intérprete de streams de página **`0x1001c320`**, comando **`0x500`** → `FUN_10014ce0(estilo)` (fábrica `operator_new(0x9c)` + `C_Knob_ctor`, estilo recortado a 0..1), seguido de `0x100206b0` que engancha los parámetros en `+0x438` / `+0x10b8`. En los 29 streams volcados en [`../NeuronVS_layout/streams.csv`](../NeuronVS_layout/streams.csv) el comando `0x500` aparece una vez (vista 0, stream 0, estilos 0 y 1).

## Verificación

`python tools/verify_gif.py` → **exit 0**. Relee `NeuronVS.dll` y comprueba, byte a byte:

- cabecera DIB de `11601`: 50×4500, 24 bpp, `BI_RGB`;
- `vtable[1] = 0x10014a70`, `vtable[4] = 0x10014b30`, `vtable[6] = 0x10014c90`;
- el constructor empuja los ids `0x2d50` y `0x2d51`;
- `0x10014af9` es `IMUL EAX,EDI`, `0x10014b0d` es `MOV ECX,[ESI+0x90]` y hay **una** llamada a `0x10008f50` dentro del pintado;
- el intérprete contiene el inmediato `0x500` y una llamada a la fábrica `0x10014ce0`.

Y relee la imagen, la vuelve a trocear y compara **fotograma a fotograma**:

- `11601.gif`: 90 fotogramas de 50×50, `duration` 40 ms, `loop` 0, ningún fotograma repetido; peor error medio tras la cuantización a 256 colores **0,10/255**.
- `11601_4x.gif`: 90 fotogramas de 200×200, mismo error.
- `frames/`: los 90 PNG coinciden **exactamente** con los recortes de la tira (error 0).
- `frames.csv`: 90 filas, hash y ruta válidos; `contactsheet.png`: 1120×1260; `gif_samples.png`: 1400×200.
- cierre del bucle: la diferencia entre el primer y el último fotograma es menos de la mitad que la del primero con el de en medio, así que la repetición no da un salto visible.

## Reproducir

```bash
python NeuronVS_filmstrip/tools/filmstrip_gif.py   # escribe GIF, frames/, CSV y hoja de contactos
python NeuronVS_filmstrip/tools/verify_gif.py      # exit 0
```

Requiere Pillow y numpy, y el `NeuronVS.dll` original más `NeuronVS_bitmaps/png/11601.png` en el directorio padre.

## Limitaciones

- El GIF es una **previsualización**: la aplicación no reproduce la tira por tiempo, elige el fotograma por el valor del parámetro. El GIF la recorre a 25 fps para que se vea el recorrido completo.
- El fotograma sale del rango interno del mando (`+0x64`, máximo 89) y el texto del parámetro enlazado (`+0x38`); **no he trazado** el punto exacto en que el arrastre copia el valor del parámetro a ese rango interno (el callback `0x10014950` sólo marca el mando como sucio).
- La ranura 1 lleva su nombre semántico en el export (`C_Knob_v01_paint`), decidido en `NeuronVS_classes/tools/slot1_names.py` por el `RET 0x4` y el cuerpo de blit.
- La captura del `preview.html` no compone frames en este entorno; el GIF se ha validado decodificándolo con Pillow, no mirando la ventana.
