# El observador: `0x10001010`, el alta/baja y las dos pasadas de notificación

[`KNOB_PARAM_LINK.md`](KNOB_PARAM_LINK.md) cuenta cómo un control se enlaza a un
registro `C_Param` y cómo el valor vuelve al control. Este documento cierra la
pieza que faltaba: **qué es exactamente el bloque observador, quién lo pone a
cero (`0x10001010`), cómo entra y sale de la matriz del registro, y qué hace
cada una de las dos pasadas de `FUN_10001550`**, callback por callback.

Todo está leído del binario: desensamblado con capstone y, para los callbacks
que Ghidra sólo veía como etiquetas, descompilados con el proyecto de
`_ghidra_project`; los `.c` sueltos están en [`_obs_dump/`](../_obs_dump) y el
verificador en [`tools/verify_observers.py`](tools/verify_observers.py).

Lo que el control hace **después** de recibir la notificación —el byte de
invalidez, la aguja del knob y la celda del panel— está en
[`PAINT_PIPELINE.md`](PAINT_PIPELINE.md).

## 1. Anatomía del bloque

El observador son **0x18 bytes** incrustados en el objeto que escucha (el
widget, o el host). Vive en `+0x00` de esa estructura y la clase lo direcciona
como un desplazamiento fijo:

| Offset | Campo | Uso |
|---:|---|---|
| `+0x00` | `float min` | rango en el que este observador quiere el valor |
| `+0x04` | `float max` | ídem |
| `+0x08` | `void *owner` | normalmente el widget; el objeto `Params` (`0x1000be10`) guarda aquí un contexto de 0x10 bytes |
| `+0x0c` | `int tag` | libre para la clase: el grafo lo usa para elegir a qué texto escribe ([§6](#6-censo-de-callbacks)) |
| `+0x10` | `cb0` | callback de la **pasada 0** |
| `+0x14` | `cb1` | callback de la **pasada 1** |

El registro, en cambio, sólo conoce el array `+0x20` (punteros) y la capacidad
`+0x24` (16). No hay lista enlazada ni orden: el alta busca el primer hueco y la
baja compacta.

## 2. `0x10001010`: poner el observador a cero

```asm
10001010  xor  eax,eax
10001012  mov  [ecx+0x00],eax
10001014  mov  [ecx+0x04],eax
10001017  mov  [ecx+0x08],eax
1000101a  mov  [ecx+0x0c],eax
1000101d  mov  [ecx+0x10],eax     ; cb0
10001020  mov  [ecx+0x14],eax     ; cb1
10001023  ret
```

Seis dwords, ni uno más: es un `clear()` del bloque, no un constructor. Lo llama
`FUN_10001000`, que es exactamente `{ FUN_10001010(); return this; }` y aparece
en los constructores de las clases que llevan observadores (el del knob lo llama
una vez, el objeto `Params` doce). Los *binders* también lo llaman
antes de rellenar: el del grafo (`0x100201b0`, casos 1/0xd/0x28) hace
`0x10001010` → escribe `owner` y `cb1` → `FUN_100010a0(observador, 1, 5)`.

Consecuencia útil: **antes del alta, `cb0` y `cb1` son nulos**. Si un widget se
queda sin registro enlazado (por ejemplo porque el binder no tiene `case` para
su id), no hay callback viejo que se dispare: el hueco está limpio. Y como el
alta con `copiar rango = 1` sobrescribe `min`/`max` con los del registro, un
observador recién limpiado no arrastra el rango del enlace anterior.

No confundir con `FUN_100016e0`, que parece un predicado del rango pero es otra
cosa: devuelve 1 sólo cuando el intervalo **cambia de signo** (`min < 0 < max`).
Los callbacks lo usan para elegir el formato del número ([§6](#6-censo-de-callbacks)).

## 3. Alta y baja

**Alta — `FUN_100010a0(observador, copiarRango, máscara)`**

```c
for (i = 0; i < rec->capacidad && rec->array[i]; i++);
if (i >= rec->capacidad) return 0;          // matriz llena: se ignora
rec->array[i] = observador;
if (copiarRango) { observador->min = rec->min; observador->max = rec->max; }
notificar(rec, pasada 1, {valor, valor}, máscara | 4, observador);
return 1;
```

Detalles que importan al reproducirlo:

- la matriz **no crece**: con 16 huecos llenos el alta devuelve 0 y el control
  se queda sin enlace;
- el aviso final va sólo a ese observador (se pasa como origen) y con el bit `4`
  forzado, así que el widget se sincroniza aunque el valor no haya cambiado;
- si el rango del registro y el del observador coinciden, `0x100012a0`
  devuelve el valor sin tocarlo: el widget recibe el número crudo.

**Baja — `FUN_10001110(observador)`**

```asm
1000111b  mov  esi,[ecx+0x20]      ; array
10001122  cmp  [esi],edi           ; ¿es éste?
10001124  je   0x1000112e
10001126  inc  eax
10001127  add  esi,4
...
1000113a  mov  esi,[edx+eax*4]     ; compacta hacia la izquierda
1000113d  mov  [edx+eax*4-4],esi
10001144  cmp  dword ptr [edx+eax*4],0
10001148  je   0x10001152          ; hasta el terminador
10001152  mov  eax,[ecx+0x24]
10001155  mov  ecx,[ecx+0x20]
10001158  mov  [ecx+eax*4-4],0     ; y limpia el último hueco
```

Busca lineal, desplaza el resto una posición y pone a 0 el último hueco. Si el
observador no está, no hace nada. Lo llaman los helpers de alta *antes* de
sobrescribir el campo del registro: reenlazar un panel o un icono (los callbacks
de matriz de [§6](#6-censo-de-callbacks)) es `baja` + `alta`, nunca un puntero
suelto.

## 4. Las dos pasadas: `FUN_10001550`

Firma real (deducida del desensamblado, no del pseudocódigo):

```c
char FUN_10001550(C_Param *rec /*ecx*/, int pasada, float par[2],
                  unsigned mascara, void *origen);
```

`par[0]` es el valor viejo y `par[1]` el nuevo, **ya cuantizados y recortados**.
Por cada hueco no nulo del array:

| Paso | Qué hace |
|---|---|
| selección | si `observador == origen` usa `mascara & 1`; si no, `mascara & 2`; si sale 0, lo salta |
| cambio | compara `par[0]` con `par[1]`; si son iguales y la máscara no lleva `4`, lo salta |
| reescalado | pasa `par[0]` y `par[1]` de `[rec.min, rec.max]` a `[obs.min, obs.max]` con `0x100012a0` (mapa por tramos que además trata los rangos que cruzan cero) |
| llamada | `cb(par, rec, &obs->owner)` — el tercer argumento es la **dirección** del campo `owner`, y el callback lo desreferencia |
| pasada 0 | sólo si `obs+0x10 != 0`; si el callback devuelve 0, se apaga el flag de "cambió" |
| pasada 1 | sólo si `obs+0x14 != 0`; el valor de retorno se ignora |

Con `mascara == 0` el bucle ni entra (`test bx,bx; je final`) y devuelve 1: el
valor se escribe pero nadie se entera. Es el modo que usa el cargador de presets
y el espejo del grafo.

El "flag de cambió" no es cosmético: es el valor que devuelve la función y lo
que `FUN_10001170` usa para decir si el valor final difiere del inicial.

## 5. Quién escribe: `FUN_10001170`

El único escritor de `+0x1c` ordena las dos pasadas así:

```asm
10001193  ...                        ; si hay origen, reescala de su rango al del registro
100011cb  fld  [esp+0x18]            ; cuantiza por step (si step != 0)
100011d2  call ftol
100011db  fild
100011df  fmul [esi+0x18]
...
100011f1  test bl,8                  ; ¿envolver?
10001214  ...                        ; si no, recorta a [min,max]; si sí, envuelve
10001237  mov  ecx,[esi+0x1c]        ; par[0] = valor actual
10001251  call 0x10001550            ; PASADA 0
10001256  test al,al
10001258  je   0x10001263            ; devolvió 0 -> se descarta el valor nuevo
1000125e  mov  [esi+0x1c],ecx        ; si no, se guarda
10001275  call 0x10001550            ; PASADA 1 (con el par definitivo)
1000127a  fld  [esp+0xc]             ; devuelve 1 si el par cambió
1000127e  fcomp [esp+0x10]
```

Es decir:

1. **pasada 0**, con el par `{viejo, nuevo}` y el valor **todavía sin escribir**:
   es el único punto donde un callback puede **vetar** el cambio;
2. escritura de `+0x1c` (o descarte, si la pasada 0 devolvió 0; en ese caso el
   par que ve la pasada 1 lleva el valor viejo en las dos posiciones);
3. **pasada 1**, con el par definitivo: es la notificación de verdad.

En este binario **nadie instala un callback de pasada 0** ([§7](#7-la-pasada-0-está-vacía)),
así que el veto nunca se ejerce: la pasada 0 recorre la matriz y no llama a
nada. La separación sigue siendo la correcta para reproducir el
comportamiento, pero en la práctica es "antes de escribir / después de
escribir" con sólo la segunda mitad activa.

## 6. Censo de callbacks

Barrido de las funciones exportadas: **377 llamadas a `FUN_100010a0`**, de las
que **29 observadores distintos (39 altas, porque varias se enganchan dos
o tres veces)** tienen un callback escrito en la misma función; el resto
pertenece al objeto `Params` o a altas sin notificación. Las que importan para
el editor:

| Dónde se engancha | Observador | Copia rango | Callback | Qué hace |
|---|---|---:|---|---|
| panel `0x1001e600` / helper `0x1001af70` | `+0x38` | no | `0x1001ab30` | elige un carácter de una tabla por el valor, marca sucio y enciende el segmento que toca |
| knob `0x100206b0` / `0x10014d60` | `+0x3c` | sí | `0x10014950` | sólo marca sucio (`vfunc+0x38(1)`) |
| icono `0x1001efa0` / `0x10017420` | `+0x38` | no | `0x10016d30` | formatea el valor entero en un texto y lo guarda en `+0x78` |
| display `0x100207a0` / `0x10018a2x` | `+0x4c` (uno para A/D/S/R) | sí | `0x10017880` | marca sucio el display y su hijo `+0x38` |
| display alterno `0x10018b20` | `+0x64` | sí | `0x100178b0` | estado on/off de un hijo según dos umbrales |
| grafo `0x100201b0` | `+0x44` | sí | `0x1001d680` | espeja el valor en su `C_Param` privado (`+0x5c`, máscara 0) y rehace el nombre de 16 caracteres |
| grafo `0x100201b0` | `+0x174` / `+0x18c` | sí | `0x1001d770` | escribe el número en uno de dos pares de textos, según el `tag` del observador |
| panel, matriz `0x1001e600` | `+0x84` (máscara 0) | no | `0x1001d720` | convierte a índice, avisa a la tabla y **republica** el valor con máscara 3 |
| panel, matriz `0x1001e600` | `+0x9c`, `+0xb4`, `+0xcc` | sí | `0x1001d7e0`, `0x1001d8c0`, `0x1001d9a0` | reenganchan paneles a otros registros (crosspoints) |
| icono, matriz `0x1001efa0` | `+0x12c`, `+0x144` | no | `0x1001dde0`, `0x1001e060` | reenganchan iconos a otros registros |
| display, matriz `0x100207a0` | `+0x15c` | sí | `0x1001e2e0` | reengancha iconos según una tabla de 30 índices |
| página de filtro `0x100203a0` | `+0xe4`, `+0xfc`, `+0x114` | sí | `0x1001da30`, `0x1001db30`, `0x1001dc30` | reenganchan los dos observadores de la página (`+0x94`/`+0xac`) a un par de registros |
| carga de página `0x1001c320` | — | — | `0x1001e4b0` | no trazado en detalle: llama a `0x1001ceb0` cuando dos flags están activos |
| editor `0x1001bad0` | `+0x23c` | sí | `0x1001d4d0` | reparte el valor entre dos registros con dos bytes de guarda |
| core `0x1001b140` | `+0x3c0` | sí | `0x1001b780` | no trazado en detalle |

Tres altas más (`0x10016840` en `+0x50`/`+0x98` y `0x10016900` en `+0xe0`) no
llevan callback en la misma función: escuchan sin reaccionar, o su callback se
instala en otro sitio.

### El alta duplicada

Varios binders enganchan **el mismo observador más de una vez**: la página de
filtro hace `FUN_100010a0(param_1+0xe4,1,5)` dos veces (tres para `+0x114`), el
binder de paneles repite la de `+0x9c` y el de iconos engancha tres veces el
mismo bloque. `FUN_100010a0` no comprueba si ya está: mete un puntero más en el
siguiente hueco. Como la baja quita sólo la **primera** aparición, un reenganche
posterior (`0x10001110` + alta) deja las demás: el callback se ejecuta dos o
tres veces por notificación. Es inocuo para los callbacks de este binario
(marcar sucio o escribir un texto es idempotente) pero cuenta para el límite de
16 huecos y hay que tenerlo en cuenta al reproducir el número de llamadas.

### Las que cierran el círculo con el layout

- **Panel (`0x1001ab30`)** — el panel es el mando redondo mayoritario (243
  instancias): no dibuja una aguja, enciende **segmentos**. El callback toma el
  valor nuevo (`par[1]`) como índice, lo acota por el número de posiciones de su
  tabla de caracteres, guarda el carácter resultante en `+0x84`, marca sucio y
  recorre la tabla de segmentos (`+0x90`, contador en `+0x98`) llamando a
  `FUN_10016300` con "encendido/apagado". Por eso el panel necesita el valor
  entero, no el float.
- **Icono (`0x10016d30`)** — lee el valor ya recortado del registro
  (`0x100014c0`), lo trunca y lo formatea con `FUN_10015910`, que elige entre
  `"%02.2i"` y un formato sin relleno según `FUN_100016e0` (rango que cruza
  cero). El texto va a un *holder* en `+0x80`, el entero se guarda en `+0x78` y
  el widget se marca sucio.
- **Display (`0x10017880`)** — no mira el valor: invalida el display y su widget
  hijo `+0x38`. El repintado lee los cuatro registros A/D/S/R por su cuenta.
- **Display alterno (`0x100178b0`)** — compara el viejo y el nuevo con un umbral
  del propio widget, llama a `vfunc(+0x84)` / `vfunc(+0x80)` del hijo de `+0x34`
  y enciende o apaga un byte en el segundo hijo (`+0x38`). Es el único que
  distingue entrar y salir del valor.
- **Grafo (`0x1001d680`)** — el valor se copia a un `C_Param` **propio** en
  `+0x5c` con máscara 0: escribir con silencio evita que la notificación vuelva
  a entrar en el mismo callback. Después rehace el nombre concatenando los 16
  registros consecutivos que empiezan en `tabla + 0xf0` (índice 6).
- **Grafo (`0x1001d770`)** — usa el campo `tag` (`+0x0c`) que el binder escribe
  (0 para el id 0xd, 1 para el 0x28) para decidir si actualiza el par de textos
  `+0x628`/`+0x62c` o el `+0x694`/`+0x698`.

### La familia de matriz

Una decena de callbacks no pinta nada: **reenganchan** otros observadores. Son
la implementación de las matrices de modulación del editor:

```asm
1001d851  lea  ecx,[edi+0x3c0]   ; R1Type      (fila)
1001d85f  call 0x100014c0
1001d86b  lea  ecx,[edi+0x3e8]   ; R1ParamLevel (columna)
1001d873  call 0x100014c0
1001d87d  lea  eax,[eax+esi*2]   ; índice = 3*fila + columna
1001d880  add  esi,eax
1001d885  mov  eax,[esp+esi*4+0xc]   ; tabla de 12 índices de registro
1001d88f  mov  ecx,[ebx+0x3a4]       ; un panel
1001d896  call 0x1001af70            ; baja el anterior y engancha el nuevo
```

Es decir: mover el selector de fila o de columna **cambia a qué registro está
suscrito el panel del crosspoint**, con el mismo helper de alta que usa el
binder. Por eso estos callbacks existen en la misma clase que los demás: el
mecanismo de reenganche es `FUN_10001110` + `FUN_100010a0`, sin ningún camino
especial.

## 7. La pasada 0 está vacía

`0x10001010` deja `+0x10` a 0 y el barrido de las funciones exportadas no
encuentra **ninguna** escritura de un puntero a código en `observador+0x10`:

- 37 desplazamientos distintos reciben un puntero a `.text` en todo el binario;
- de ellos, 28 son exactamente `base+0x14` de un observador cuyo alta se puede
  resolver (los callbacks de la tabla, más los del objeto `Params`);
- ninguno cae en `base+0x10`.

El único candidato que salía en el barrido era un falso positivo del cargador de
páginas (`0x1001c320`), donde el observador se pasa en un registro calculado y
el análisis no puede resolver el desplazamiento.

Consecuencia para la reproducción: **la pasada 0 es código muerto en este
binario**. Se puede implementar el par de callbacks y no romper nada; lo que sí
hay que conservar es el orden (pasada 0 antes de escribir, pasada 1 después) y
la semántica de la máscara, porque el host y el cargador de presets dependen de
ella.

## 8. Verificación

```bash
python NeuronVS_layout/tools/verify_observers.py    # exit 0
```

Comprueba, desensamblando el DLL:

- `0x10001010` escribe seis dwords a 0 en `+0x00..+0x14`;
- `0x10001110` compacta el array (`[edx+eax*4-4] = [edx+eax*4]`) y pone a 0 el
  último hueco;
- `0x10001550` tiene las dos ranuras (`call [reg+0x10]` y `call [reg+0x14]`),
  los bits de máscara 1/2/4 y pasa `&obs->owner` (un `lea reg,[reg+8]`) como
  tercer argumento;
- `0x10001170` llama a la pasada 0 **antes** de escribir `+0x1c` y a la pasada 1
  después, y descarta el valor cuando la pasada 0 devuelve 0;
- ningún alta resuelta escribe un callback en `observador+0x10`;
- los callbacks del censo siguen haciendo lo que dice la tabla (knob marca
  sucio, display invalida a su hijo, icono formatea y guarda en `+0x78`, grafo
  espeja con máscara 0).

## 9. Límites

- **El censo no cubre todo el binario**: el objeto `Params` (`0x1000be10`)
  engancha cientos de observadores cuyos desplazamientos salen de cálculos que
  el análisis estático no resuelve; sus cinco callbacks propios (`0x100135d0`,
  `0x10013600`, `0x10013620`, `0x100139b0`, `0x100139d0`) quedan sin describir.
- **`0x10019550` / `0x100195e0`** (los dos observadores de la clase
  `0x10019e40`) escriben textos con el valor, pero leen campos `+0x04`/`+0x08`
  del registro que en la tabla de 445 son punteros a la cadena vacía: o el
  registro que usan no es un `C_Param`, o hay un camino que no he trazado. Se
  listan, no se explican.
- **La ausencia de pasada 0 es un resultado negativo** sobre las funciones
  exportadas; un callback instalado desde código no listado como función no
  aparecería en el barrido.
- **`0x10001110` compacta hasta el primer hueco nulo**, no hasta el final: si
  el observador era el último, no hay nada que mover y sólo se limpia
  `array[capacidad-1]`. Con 16 huecos y pocos suscriptores por registro el caso
  no aparece, pero una matriz llena y sin terminador se comportaría distinto.
