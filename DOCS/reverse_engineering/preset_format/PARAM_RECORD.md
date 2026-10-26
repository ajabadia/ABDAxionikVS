# La tabla de `C_Param`: de los descriptores de 0x1c a los registros de 0x28

`preset_schema.csv` decodifica el bloque **estático** de 445 descriptores de `0x1c` bytes en `0x10049f08`. El motor no lee ese bloque al cargar un preset: al arrancar convierte los descriptores en una tabla **de ejecución** de 445 registros de **`0x28`** bytes, y es esa tabla la que recorre el parser, la que recorta el escritor y la que apuntan los 26 parámetros VST. Este documento cierra ese eslabón: qué función la construye, qué copia de cada descriptor y qué hay en los 12 bytes que el descriptor no tiene.

La tabla vive en el objeto que el propio DLL llama `snddat` (cadena de error `snddat` en `0x1005467c`), un bloque de **12 bytes** colgado de `C_NeuronCore+0x3dc` (`param_1[0xf7]`). El paquete [`NeuronVS_classes`](../NeuronVS_classes/README.md) lo llama `SoundData`.

El lado del editor —qué control engancha qué registro, con qué helper y con qué
máscara, y cómo vuelve el valor al widget— está en
[`KNOB_PARAM_LINK.md`](../NeuronVS_layout/KNOB_PARAM_LINK.md).

## Cadena de construcción

```
C_NeuronCore_ctor  0x1001b140
├─ operator_new(0xc)                       cabecera de 12 B  (línea 80 del .c)
└─ FUN_10013de0  = SoundData_ctor          this = esos 12 B  (línea 86)
   ├─ FUN_10001870(0x1bd)                  cabecera + reserva  (0x1bd = 445)
   │  ├─ operator_new(445*0x28 + 4)
   │  └─ FUN_100213e6(registros, 0x28, 445, FUN_10001030, FUN_10001090)
   │     └─ FUN_10001030  × 445            constructor de cada registro
   └─ bucle sobre los descriptores 0x10049f14 … 0x1004cfc0, stride 0x1c
      ├─ copia +0x00, +0x0c, +0x10, +0x14, +0x18
      └─ FUN_10001170(default, 0, 0)        deja +0x1c = default ya recortado
```

El constructor del core comprueba el resultado con `FUN_10001900`, que simplemente devuelve el byte `+0x04` de la cabecera; si es distinto de cero, escribe `"*** NeuronVS Core(err): %s failed\n"` (`0x10054684`) con el argumento `"snddat"` (`0x1005467c`).

### La cabecera de 12 bytes

| Offset | Tipo | Campo | Quién lo escribe |
|---:|---|---|---|
| `+0x00` | `C_Param *` | base de la tabla (445 × 0x28) | `FUN_10001870` (`MOV [EBP],EAX`, 0x100018dc) |
| `+0x04` | `char` | **1 = la reserva falló** | `FUN_10001870` lo pone a 0 (`C6 45 04 00`); a 1 sólo si `operator_new` devuelve 0 |
| `+0x08` | `int` | cuenta = 445 | `FUN_10001870` (`MOV [EBP+8],ESI`) |

`FUN_10013de0` sólo construye si ese byte es 0 (`CMP byte [EBX+4],0`), lo que evita recorrer una tabla nula.

### La reserva (`FUN_10001870`)

```asm
10001890  MOV  byte [EBP+4],0        ; sin error
10001894  MOV  [EBP+8],ESI           ; cuenta = 445
10001899  LEA  EAX,[ESI+ESI*4]       ; 5n
1000189c  LEA  ECX,[EAX*8+4]         ; 40n + 4   = n*0x28 + 4
100018a4  CALL 0x100213a0            ; operator_new
100018c6  LEA  EDI,[EAX+4]           ; los registros empiezan tras el prefijo
100018c9  PUSH ESI                   ; 445
100018ca  PUSH 0x28                  ; tamaño de registro
100018cc  PUSH EDI                   ; destino
100018cd  MOV  [EAX],ESI             ; prefijo: la cuenta
100018cf  CALL 0x100213e6            ; construye n elementos, ctor 0x10001030, dtor 0x10001090
```

El prefijo de 4 bytes con la cuenta queda **justo antes** del primer registro, así que no forma parte del registro ni desplaza los offsets. `FUN_10001090` es un `ret` vacío: el destructor de elemento no libera nada.

### El constructor de cada registro (`FUN_10001030`)

```asm
10001034  MOV  EAX,0x10055140        ; cadena vacía
1000103B  PUSH 0x40
1000103D  MOV  [ESI],EAX             ; +0x00
1000103F  MOV  [ESI+8],EAX           ; +0x08
10001042  MOV  [ESI+4],EAX           ; +0x04
10001045  MOV  [ESI+0xC],EDI         ; +0x0c = 0     (min)
10001048  MOV  [ESI+0x10],EDI        ; +0x10 = 0     (max)
1000104B  MOV  [ESI+0x14],EDI        ; +0x14 = 0     (default)
1000104E  MOV  dword [ESI+0x18],0x3F800000   ; +0x18 = 1.0f (step)
10001055  MOV  [ESI+0x1C],EDI        ; +0x1c = 0     (value)
10001058  MOV  dword [ESI+0x24],0x10 ; +0x24 = 16    (capacidad)
1000105F  CALL 0x100213a0            ; operator_new(0x40) = 16 punteros
10001067  MOV  [ESI+0x20],EAX        ; +0x20 = matriz de observadores
```

### El bucle de copia (`FUN_10013de0`)

`ESI` empieza en `0x10049f14`, que es **descriptor 0 + 0x0c**, y avanza de `0x1c` en `0x1c`; `EDI` es el desplazamiento del registro dentro de la tabla y avanza de `0x28` en `0x28`. El límite `0x1004cfc0` es exactamente `0x10049f14 + 445·0x1c`.

```asm
10013DF9  PUSH 0x1BD                       ; 445
10013E02  CALL 0x10001870                  ; cabecera + reserva + constructores
10013E07  MOV  AL,byte [EBX+4]             ; ¿falló la reserva?
10013E12  TEST AL,AL
10013E14  JNE  0x10013E7F                  ; sí -> no construir
10013E18  XOR  EDI,EDI                     ; desplazamiento del registro dentro de la tabla
10013E1A  MOV  ESI,0x10049F14              ; &descriptor[0].min
10013E1F  MOV  EAX,[EBX]                   ; tabla
10013E21  MOV  ECX,[ESI-0xC]               ; descriptor +0x00 (nombre)
10013E24  PUSH 0                           ; 3.er argumento de FUN_10001170
10013E26  PUSH 0                           ; 2.º argumento
10013E28  MOV  [EDI+EAX],ECX               ; registro  +0x00
10013E2B  MOV  EDX,[EBX]                   ; (recarga de la base en cada campo)
10013E2D  MOV  EAX,[ESI]                   ; descriptor +0x0c (min)
10013E2F  MOV  [EDI+EDX+0x0C],EAX          ; registro  +0x0c
10013E33  MOV  ECX,[EBX]
10013E35  MOV  EDX,[ESI+4]                 ; descriptor +0x10 (max)
10013E38  MOV  [EDI+ECX+0x10],EDX          ; registro  +0x10
10013E3C  MOV  EAX,[EBX]
10013E3E  MOV  ECX,[ESI+8]                 ; descriptor +0x14 (default)
10013E41  MOV  [EDI+EAX+0x14],ECX          ; registro  +0x14
10013E45  MOV  EDX,[EBX]
10013E47  MOV  EAX,[ESI+0xC]               ; descriptor +0x18 (step)
10013E4A  MOV  [EDI+EDX+0x18],EAX          ; registro  +0x18
10013E4E  MOV  ECX,[ESI+8]                 ; default otra vez
10013E51  MOV  EAX,[EBX]
10013E53  PUSH ECX                         ; 1.er argumento: el default
10013E54  MOV  ECX,EDI
10013E56  ADD  ECX,EAX                     ; ECX = &registro
10013E58  CALL 0x10001170                  ; value = default, ya cuantizado y recortado
10013E5D  ADD  ESI,0x1C                     ; siguiente descriptor
10013E60  ADD  EDI,0x28                     ; siguiente registro
10013E63  CMP  ESI,0x1004CFC0              ; 0x10049f14 + 445*0x1c
10013E69  JL   0x10013E1F
```

No hay búsqueda por nombre ni tabla de índices: **el orden del bloque `.rdata` es el orden de la tabla**. El emparejamiento descriptor ↔ registro es posicional.

## Layout del registro (0x28 bytes)

| Offset | Tamaño | Tipo | Campo | Origen | Consumidores |
|---:|---:|---|---|---|---|
| `+0x00` | 4 | `char *` | `name` | descriptor `+0x00` | `effGetParamName` (`0x1001ba60`) |
| `+0x04` | 4 | `char *` | **nombre del modelo** (vacío hasta elegir uno) | constructor; `callback_10013620` | `callback_10013620` |
| `+0x08` | 4 | `char *` | **nombre de la variante** (o `""`) | constructor; `callback_10013620` | `callback_10013620` |
| `+0x0c` | 4 | `float` | `min` | descriptor `+0x0c` | `0x100014c0` (recorte), `0x10001170`, `0x100012a0` |
| `+0x10` | 4 | `float` | `max` | descriptor `+0x10` | ídem |
| `+0x14` | 4 | `float` | `default` | descriptor `+0x14`; `callback_10013620` | `0x10001910` (siembra del parser) |
| `+0x18` | 4 | `float` | `step` | descriptor `+0x18` | `0x10001170` (cuantización) |
| `+0x1c` | 4 | `float` | `value` | `0x10001170` al construir; después cada setter | `0x100014c0`, `0x10001550`, `0x100010a0`, `effGetParameter` (`0x1001ba30`) |
| `+0x20` | 4 | `void **` | matriz de 16 punteros a observadores | constructor (`operator_new(0x40)`, 16 ceros) | `0x100010a0`, `0x10001110`, `0x10001550` |
| `+0x24` | 4 | `int` | capacidad de la matriz = **16** | constructor | ídem |

`0x20 + 4 + 4 = 0x28`: los 12 bytes que el descriptor no tiene son el puntero de
valor y la pareja matriz/capacidad de observadores.

### Dword a dword

1. **`+0x00` — `const char* name`.** El nombre de la clave (`"SoundPan"`…). Lo copia el bucle desde el descriptor; es el único de los tres punteros iniciales que se copia. Lo leen `effGetParamName` (`[registro]` → `"%24s"`) y el `strcmp` del parser (`FUN_10001910`) y del escritor (`FUN_10001af0`). Los 445 nombres del `.rdata` son **únicos**, no vacíos y miden entre 6 y 28 caracteres; el más largo es `Free4Level4TimeVelocityDepth` (28). ¹
2. **`+0x04` — `const char* model_name`.** Nace como la cadena vacía y **cambia en ejecución**: el callback de modelo (`0x10013620`) escribe aquí `0x10055f38 + índice*0x20`, el nombre del modelo en la caché de 512 entradas. No se copia del descriptor porque el `.rdata` no lo trae.
3. **`+0x08` — `const char* model_variant`.** Segunda cadena del modelo (9 B por capa); el mismo callback la deja en `""` cuando coincide con `+0x04`.
4. **`+0x0c` — `float min`.** Copiado del descriptor. Lo usan `FUN_10001170` (recorte), `FUN_100014c0` (recorte + reescalado) y `FUN_10001550` (origen del reescalado hacia el observador).
5. **`+0x10` — `float max`.** Ídem.
6. **`+0x14` — `float default`.** Copiado del descriptor. **Sólo lo lee el parser** (`FUN_10001910`, `[EAX+ESI-0x14]`) para sembrar la tabla antes de leer el fichero; el motor nunca lo ve. Con `step = 1` en los 445, es exactamente el valor inicial de `+0x1c` salvo por el recorte: **19** descriptores lo declaran por debajo de `min` y arrancan en `min`.
7. **`+0x18` — `float step`.** Copiado del descriptor. Lo usa `FUN_10001170` para cuantizar: `trunc(value/step)*step` si `step != 0`. En este corpus vale **1.0 en los 445**, así que en la práctica el paso se reduce a truncar hacia cero.
8. **`+0x1c` — `float value`.** El único campo que cambia en ejecución. Lo escribe `FUN_10001170` (con cuantización y recorte) y `FUN_100014c0` (sólo recorte); es lo que se notifica a los observadores y lo que devuelve `effGetParameter`. Aunque el fichero guarde enteros (`SoundPan=-64`), aquí es un `float`: el parser entra por `FUN_10001170(float)`, no por una ruta entera.
9. **`+0x20` — `void** observers`.** Matriz de 16 punteros, `operator_new(0x40)` en el constructor y ceros hasta la capacidad. `FUN_100010a0` busca el primer hueco, `FUN_10001110` compacta y `FUN_10001550` recorre.
10. **`+0x24` — `int capacity`.** Constante **16**: ningún camino la escribe fuera del constructor.

¹ `"%24s"` recorta a 24 caracteres. Sólo **dos** de los 445 nombres pasan de 24
(`Free4Level4TimeVelocityDepth`, 28, y `FilterCutoffVelocityDepth`, 25), y **ninguno
de los 26 parámetros expuestos al host** está entre ellos: hoy no se trunca nada. Es
un límite latente del original, no un problema del corpus.

### Los dos campos que **no** se copian (pero sí se usan)

El registro reutiliza los tres primeros dwords del descriptor, pero el bucle sólo copia el primero. `+0x04` y `+0x08` se quedan como los dejó el constructor: apuntan a la cadena vacía `0x10055140`, **igual que en el descriptor**. En los 445 descriptores de `0x10049f08`, esos dos dwords son el mismo valor en las 445 entradas (`0x10055140`): el `.rdata` no transporta nada ahí, y copiarlos no aportaría nada.

Pero **el registro sí los usa**: el callback de cambio de modelo (`0x10013620`, véase
[`OBSERVER_CALLBACK.md`](OBSERVER_CALLBACK.md)) los rellena con dos punteros a cadenas
del modelo y reescribe también `+0x14`. Es decir, eran campos «vacíos por defecto»,
no campos muertos: lo que estaba muerto era el valor de origen, no el destino.

### El valor inicial no es el `default` del descriptor

El bucle no escribe `+0x1c` directamente: llama a `FUN_10001170(default, 0, 0)`, que

1. cuantiza a múltiplos de `+0x18` truncando hacia cero (`FLD value; FDIV step; CALL __ftol; FILD; FMUL step`), sólo si `step != 0.0` (`0x10049238` es el 0.0 que usa de centinela);
2. recorta a `[+0x0c, +0x10]`;
3. escribe `+0x1c`.

Por eso los **19 parámetros cuyo default está por debajo del mínimo** (los `*StickPlayback` y los cuatro `EQ_*`) arrancan en el motor con `1`, aunque su descriptor siga diciendo `0`. Es la misma regla que aplica el escritor del fichero, pero aquí ocurre en memoria nada más construir la tabla.

### Observadores: los 12 bytes extra

Cada registro mantiene hasta **16** observadores en una matriz fija (`+0x20`, `+0x24`). No crece: `0x100010a0` busca el primer hueco nulo y devuelve 0 si no hay; `0x10001110` compacta al quitar uno. Ninguna función cambia la capacidad.

- **`0x100010a0` — alta:** `attach(observador, copiarRango, máscara)`. Guarda el puntero en el primer hueco; si `copiarRango != 0`, copia `min`/`max` del parámetro a los dos primeros `float` del observador; después lo notifica con el valor actual y `máscara | 4`.
- **`0x10001110` — baja:** localiza el puntero, desplaza el resto una posición a la izquierda y pone a cero el último hueco.
- **`0x10001550` — notificación:** recorre la matriz y, para cada observador, reescala el valor de `[min,max]` del parámetro al `[min,max]` del observador con `0x100012a0` (lineal a trozos, con el cruce por cero tratado aparte) y llama a su callback `+0x10` (pasada 0) o `+0x14` (pasada 1). Las máscaras de `FUN_10001170` deciden qué observadores se enteran: el cargador de presets usa `0` (silencio) y luego `6` (todos, forzando el aviso aunque el valor no cambie).

### Los 26 parámetros del host

El constructor del core rellena `core+0xc0` con **punteros a estos registros**, no a los descriptores del `.rdata`:

```asm
1001B4A5  MOV  EBX,0x1004F4E8        ; 26 índices de descriptor
1001B4DC  MOV  EAX,[EBX]             ; índice
1001B4DE  MOV  EDX,[ESI+0x3DC]       ; snddat
1001B4E8  LEA  ECX,[EAX+EAX*4]       ; índice*5
1001B4EB  MOV  EAX,[EDX]             ; base de la tabla
1001B4F2  LEA  ECX,[EAX+ECX*8]       ; tabla + índice*0x28
1001B4F5  MOV  [EDX_out],ECX         ; core+0xc0[i]
1001B4F7  CALL 0x100010A0            ; registro->attach(observador, 0, 7)
```

El observador es un bloque de `0x18` bytes en `core+0x128 + i*0x18` (rango `0..1`, `this`, índice y callback `0x1001b7d0`), y el `7` hace que el parámetro lo notifique con las dos pasadas y aunque el valor no cambie. Es decir: un parámetro VST no es un objeto aparte, es **un registro de la tabla + un observador** de ese registro.

Los 26 índices de `0x1004f4e8` no son una selección arbitraria: son doce pares de
valores por capa más el filtro.

| # host | Qué | Índices de parámetro |
|---|---|---|
| 0–23 | 12 pares: 2 resynators × 3 capas × {`Sphere`, `Scape`}, cada uno con sus dos valores | 42/43, 62/63, 82/83, 52/53, 72/73, 92/93, 122/123, 142/143, 162/163, 132/133, 152/153, 172/173 |
| 24–25 | `FilterFreq`, `FilterReso` | 274, 275 |

Es decir: el host expone **los dos modelos de cada una de las seis capas** (2 resynators
× 3 capas) y el filtro. No hay parámetros de mezcla, de envolventes ni del `Sound*`
por el camino VST; esos sólo se tocan por el editor o por el fichero.

Los dos handlers del host cierran el círculo sobre los campos del registro:

```asm
; effGetParamName  0x1001ba60
1001BA64  MOV  ECX,[ECX+EAX*4+0xC0]   ; registro del parámetro
1001BA6F  MOV  EDX,[ECX]               ; registro +0x00 = nombre
1001BA72  PUSH 0x10054704              ; "%24s"

; effGetParameter  0x1001ba30
1001BA36  MOV  ECX,[EAX+EDX*4+0xC0]   ; registro del parámetro
1001BA44  LEA  EAX,[EAX+EDX*8+0x128]  ; observador i (dirección = índice*3*8)
1001BA4B  PUSH EAX
1001BA4C  CALL 0x100014c0             ; recorta +0x1c y lo reescala al rango del observador
```

`0x100014c0` es la misma función que usa el escritor: recorta `+0x1c` a `[+0x0c, +0x10]`, lo guarda y, si recibe una pareja de rango (aquí el observador, `0..1`), devuelve el valor reescalado con `0x100012a0`.

## Cómo lo lee el motor: no lo lee

La pregunta natural después del layout es quién consume esos 40 bytes. La respuesta
corta es que **el render no toca ningún registro**:

- ninguna de las 87 funciones del render indexa con stride `0x28` (cero apariciones);
- ninguna lee `params+0x278`, el puntero a `snddat` donde vive la tabla (la única aparición de ese desplazamiento en el conjunto es `engine+0x278`, un `float` de `FUN_1002d3d4`, que no tiene nada que ver);
- el motor recibe `params+0x278c`, el array de valores efectivos, no los registros.

Los consumidores reales son cinco, y ninguno está en el camino del audio:

| Consumidor | Campo | Para qué |
|---|---|---|
| `FUN_10001170` / `FUN_100014c0` | `+0x0c`, `+0x10`, `+0x18`, `+0x1c` | escribir el valor: cuantizar, recortar, notificar |
| `FUN_10001910` (parser) | `+0x00`, `+0x14`, `+0x1c` | sembrar defaults y aplicar el fichero |
| `FUN_10001af0` (escritor) | `+0x00`, `+0x0c`, `+0x10`, `+0x1c` | recortar y volcar `"%s\t%d\n"` |
| `effGetParamName` / `effGetParameter` | `+0x00`, `+0x1c` | los 26 parámetros del host |
| `FUN_10001550` (notificación) | `+0x0c`, `+0x10`, `+0x1c`, `+0x20`, `+0x24` | avisar a los observadores |

### El puente hacia el motor

El registro no alimenta al motor directamente: **publica**. `FUN_10001550` recorre la
matriz de `+0x20`, reescala `+0x1c` del rango `[+0x0c, +0x10]` al rango propio de cada
observador (`[obs+0x00, obs+0x04]`) y llama a su callback:

```asm
10001634  FF 50 14              CALL dword ptr [EAX+0x14]   ; pasada 1
1000169E  FF 50 10              CALL dword ptr [EAX+0x10]   ; pasada 0
```

con `(&par_viejo_nuevo, registro, observador+8)`. Cada observador es un bloque de
`0x18` bytes; `+0x08` apunta a su dueño. El constructor de `params` (`FUN_1000be10`)
llama **335 veces** a `FUN_100010a0` para enganchar sus propios observadores a otros
tantos registros, con `copyRange = 0` y máscara `5`. Ese es el único puente: el valor
sale del registro como `float` notificado, no como lectura de memoria.

Del otro lado, el camino es el ya conocido:

```text
registro+0x1c --notificación--> params (+0x44 controles, +0x17c fuentes)
              --FUN_100134e0--> params+0x278c --FUN_10040550--> engine
```

Hay un segundo camino, que no viene de MIDI sino de un modelo: el callback
`0x10013620` reescribe el `default` (`+0x14`) de los seis registros de una capa y
termina llamando también a `FUN_10040550`. Detalle en
[`OBSERVER_CALLBACK.md`](OBSERVER_CALLBACK.md).

`FUN_10013490` (el handler de CC) lo enseña de forma inequívoca: escribe
`params[0x44+i*4]`, con `i` validado a `0..5`, y llama a `FUN_100134e0(-1)` en la
misma función. Y `FUN_100134e0` es el único que escribe `params+0x278c`, que es el
único argumento que ve el traductor. Es decir: **tres de los diez dwords cruzan al
audio** (`+0x0c` y `+0x10` como ventanas de recorte, `+0x1c` como valor); los otros
siete se quedan en el lado de la configuración.

## Verificación

```bash
python NeuronVS_preset_format/tools/verify_preset.py     # exit 0
```

La sección `param record` comprueba contra el DLL:

- la reserva: `n*0x28+4`, el prefijo con la cuenta, el constructor y el destructor de elemento;
- los valores iniciales del constructor (`+0x00/+0x04/+0x08` = cadena vacía, `+0x0c/+0x10/+0x14/+0x1c` = 0, `+0x18` = 1.0f, `+0x24` = 16, `operator_new(0x40)` en `+0x20`);
- el bucle de copia: `push 0x1bd`, stride `0x1c`/`0x28`, límite `0x1004cfc0`, los cinco almacenes con sus desplazamientos y la llamada a `0x10001170`;
- el alta/baja de observadores y la notificación con `máscara|4`;
- el relleno de `core+0xc0` con `tabla + índice*0x28` y la llamada a `attach(...,0,7)`;
- los dos consumidores del host: `effGetParamName` lee `[registro]` con `"%24s"` y `effGetParameter` llama a `0x100014c0` con el registro y su observador;
- la aritmética del registro (`0x24+4 = 0x28`, 445·0x28 frente a 445·0x1c) y que los 19 defaults fuera de rango cambian al construirse;
- los 445 nombres únicos y no vacíos, y que `+0x04`/`+0x08` son la misma cadena vacía en los 445 descriptores;
- las dos llamadas indirectas de la notificación (`[EAX+0x14]` en `0x10001634`, `[EAX+0x10]` en `0x1000169E`);
- `FUN_10013490`: el rango `0..5`, el almacén en `+0x44`, `push -1` y la llamada a `FUN_100134e0`.

La parte del motor está en [`../NeuronVS_dsp/tools/verify_dsp.py`](../NeuronVS_dsp/tools/verify_dsp.py):
cero funciones del render con stride `0x28` y cero accesos a `params+0x278`.

## Limitaciones

- **`+0x04` y `+0x08` no están muertos**: los escribe el callback de modelo. Lo que
  está vacío es su valor inicial y el de los 445 descriptores. La historia completa,
  con la descompilación anotada, está en [`OBSERVER_CALLBACK.md`](OBSERVER_CALLBACK.md).
- **Los 335 observadores de `params` no están identificados uno a uno.** Se sabe que existen (335 llamadas en `FUN_1000be10`), dónde viven (`0x280 + i*0x18`) y que el primero usa `0x10013620` como callback; el resto de callbacks se asignan en el mismo constructor pero no se han recorrido.
- **El callback `0x10013620` ya está descompilado** (antes era un hueco): es el de `R1ModellIndex`/`R2ModellIndex`, y no es un observador cualquiera. Escribe `+0x04`, `+0x08` y `+0x14` de los seis registros de una capa y reconstruye el motor entero. Detalle en [`OBSERVER_CALLBACK.md`](OBSERVER_CALLBACK.md).
- **El nombre del host se trunca a 24 caracteres** (`"%24s"`). En los 445 actuales el máximo es 28, así que algunos nombres de la lista VST salen recortados; es comportamiento del original.
- **Los callbacks del observador no tienen nombre.** Sólo está identificado `+0x14` (`0x1001b7d0`) por el relleno de los 26 parámetros VST; el `+0x10` lo instala `0x10001010`, que no he decompilado.
- **`C_Param` es un nombre de convención**, no una clase con RTTI ni vtable: el registro es un POD de 0x28 bytes y su "destructor" es un `ret`.
- **La cuantización sólo se ve con `step != 1`.** Los 445 descriptores declaran `step = 1.0`, así que en este corpus el paso se reduce a truncar hacia cero; la fórmula (`trunc(value/step)*step`) sale del ensamblador, no de un caso observado.
