# `FUN_10040550` — el traductor, traducido y medido

`NeuronVS.dll!0x10040550` es la **frontera** entre el componente de parámetros y
el motor: recibe el bloque de valores ya recortados y escribe el estado que
suena. Esta nota documenta su traducción a C++ ([`src/translator.cpp`](../src/translator.cpp)),
la tabla de lo que escribe, y lo que **no** está resuelto. La separación de
estado (qué sonaba y qué sólo configuraba) está en
[`NeuronVS_dsp/STATE_SPLIT.md`](../../NeuronVS_dsp/STATE_SPLIT.md); aquí se
documenta sólo la función que hace el volcado.

Todo lo que sigue se regenera y se comprueba con dos scripts:

```bash
python NeuronVS_port/tools/gen_translator.py        # reescribe .cpp/.hpp/CSV
python NeuronVS_port/tools/verify_translator.py     # 7 comprobaciones
```

## 1. Tamaño y llamadores

| Dato | Valor | De dónde sale |
|---|---:|---|
| bytes | 15.226 | `NeuronVS_decompiled/functions.csv` |
| líneas de pseudocódigo | 2.125 | `10040550_FUN_10040550.c` |
| llamadas externas | 2 | `FUN_100343e4`, `FUN_100373a0` |
| llamadores | 3 | `0x100132d0`, `0x100134b0`, `0x100134e0` |

| Llamador | Cuándo |
|---|---|
| `FUN_100132d0` | cargar un sonido |
| `FUN_100134b0` | mover el pitch bend |
| `FUN_100134e0` | cambiar un parámetro (y único que escribe el bloque de valores) |

## 2. ABI real, no el que imprime Ghidra

El pseudocódigo declara `__thiscall FUN_10040550(int *param_1, undefined4 param_2, uint *param_3)`.
El desensamblado dice lo mismo pero con los registros a la vista:

```asm
1004057a  MOV ESI,[ECX]      ; estado = *(uint32_t**)ECX
1004057c  TEST ESI,ESI
1004057e  JE   0x100440bc    ; sin estado: no se hace nada
10040584  MOV EDI,[EBX+0xC]  ; p = tercer argumento (params+0x278C)
```

y los llamadores cargan `ECX` con el **objeto motor**, que cuelga de `params`
(`EBX` en `FUN_100132d0` es `params`, no el core):

```asm
10013322  MOV ECX,[EBX+0x27C]   ; params->engine
10013328  PUSH 0                ; param_2
1001332a  CALL 0x10040550
```

Por eso la traducción expone:

```cpp
void translate(uint32_t* engine, const uint32_t* p);
```

y dentro hace `uint32_t* e = *reinterpret_cast<uint32_t**>(engine);`.

## 3. Qué apunta cada cosa

| Objeto | Offset | Tamaño | Papel |
|---|---|---:|---|
| `core` | `+0x3E0` | 4 B | puntero al `engine` |
| `core` | `+0x3E8` | 4 B | puntero a `params` (11.484 B) |
| `params` | `+0x27C` | 4 B | copia del puntero al `engine` |
| `params` | `+0x278C` | 0x53C B (335 dwords) | valores efectivos **por slot** |
| `engine` | `+0x00` | 4 B | puntero al estado que se traduce (`e`) |
| `e` | — | 13.948 B (`0x367C`) | estado del motor; `e[N]` es el dword `N`, byte `N*4` |

**`p` no es la tabla de 445 parámetros.** `FUN_100134e0` copia
`params[0x17C + indice*4]` a `params[0x278C + slot*4]`, donde `slot` sale del
mapa de `0x10049E00`. Ese mapa tiene **64 entradas válidas**; el resto de slots
se llenan por otra vía que no está cerrada (ver §9.1). Consecuencia práctica:
los `p[N]` del traductor se numeran en **slots**, y no se pueden bautizar con
las claves de `preset_schema.csv`.

Comprobado en ejecución: `core+0x3E0` y `params+0x27C` devuelven el mismo
puntero, y el estado que hay detrás tiene el flag de la puerta en el byte
`0xD98` y los 13.948 B accesibles.

### La puerta

```cpp
if (e != nullptr)
  if ((p != nullptr) && ((char)e[0x366] != '\0')) { ... }
```

`e[0x366]` es el byte `0xD98` del estado. `FUN_100373a0` empieza exactamente
comprobando ese byte:

```c
if (*(char *)(param_1 + 0xd98) == '\0') return 0;
```

Es decir: sin bloque de valores, o con el flag apagado, el traductor **no toca
el motor**.

## 4. Convenios de la traducción

El archivo se genera; no se edita a mano. Cada sentencia del pseudocódigo
aparece en el mismo orden, para poder auditar línea a línea. Sólo se reescribe
lo que el C de Ghidra no puede expresar:

| Ghidra | Traducción | Por qué |
|---|---|---|
| `(float)p[N]`, `(float)e[N]` | `f32_bits(p[N])` | es `FLD dword ptr`, una recarga; un cast en C sería una conversión aritmética |
| `puVar9[N] = (uint)(expr)` sobre un campo que el binario guarda con `FSTP dword ptr` (123 veces) | `e[N] = f32_raw(expr)` | no es una conversión: es una tienda float. El `(uint)` de Ghidra trunca el valor |
| idioma `double -> int` (66 veces) | `trunc_i32(dVar)` | el compilador desenrolla exponente y mantisa; el resultado es el truncamiento |
| idioma cuyo `if` compara `uVar16` pero cuya rama escribe `local_4c` | `local_4c = trunc_i32(dVar)` | el destino real es el que escribe la rama, no el exponente |
| `float fVarN` | `double fVarN` | el x87 calcula en 80 bits; el único redondeo es la tienda (`f32_raw`) o el cast explícito |
| `_DAT_1030xxxx` | `k_1030xxxx` | constante leída del PE |
| `(int)e + 0xNNN` | `(uintptr_t)e + 0xNNN` | Ghidra pierde el tipo del puntero |
| `*puVar9`, `puVar9[N]` | `*e`, `e[N]` | nombres |

Cifras del archivo generado: **1.533 líneas**, **310 constantes**, **66
truncamientos**, **191 recargas float**, **123 tiendas float** y **20 locales**.
Las tres últimas filas de la tabla salen del desensamblado, no del
pseudocódigo: `tools/gen_translator.py` recorre `0x10040550..0x100440CA` con
capstone para saber qué dwords se guardan con `FSTP` y qué variable aterriza en
cada rama del idioma de conversión.

Las constantes se emiten con el **ancho que dicta la instrucción** (`fld dword`
→ `float`, `fld qword` → `double`), no con la heurística del valor: de las 310,
**258 son `double` y 52 `float`**. El detalle está en
`NeuronVS_dsp/translator_constants.csv`; el porqué del método, en
[`CONSTANT_TYPES.md`](../../NeuronVS_dsp/CONSTANT_TYPES.md).

## 5. Las 456 escrituras al motor

El traductor escribe **456 veces** sobre **436 dwords distintos**, en el rango
`e[0x000]..e[0x36A]` (bytes `0x000`..`0xDA8`). 123 escrituras toman el valor
directamente de `p`; el resto son expresiones (productos, recortes, divisiones,
constantes). 11 son truncamientos y 18 dwords se escriben más de una vez
(una rama condicional los corrige).

La tabla agrupa por **rangos de offset** para que sea legible; no es el orden
en que el código escribe (el pseudocódigo empieza en la cabecera, salta a
`0x55` y vuelve a `0x24`). El orden real está en el CSV, fila a fila.

| rango | escrituras | origen `p` | copy / expr / trunc |
|---|---:|---|---|
| `0x0000-0x0007` | 9 | `0xDC..0xF4` | 4 / 3 / 2 |
| `0x0008-0x0023` | 24 | `0xAC..0xF3` | 7 / 14 / 3 |
| `0x0024-0x002F` | 12 | — | 0 / 12 / 0 |
| `0x0048-0x0054` | 0 | — | 0 / 0 / 0 |
| `0x0055-0x0072` | 30 | — | 0 / 30 / 0 |
| `0x0092-0x00A5` | 24 | `0xE6..0xEB` | 4 / 19 / 1 |
| `0x00A6-0x00A7` | 2 | `0x0B..0x0C` | 2 / 0 / 0 |
| `0x00AC-0x00C3` | 24 | — | 0 / 24 / 0 |
| `0x00ED-0x0104` | 24 | — | 0 / 24 / 0 |
| `0x0167-0x0167` | 1 | `0xAB` | 1 / 0 / 0 |
| `0x0168-0x017F` | 24 | — | 0 / 24 / 0 |
| `0x01A5-0x01A6` | 2 | — | 0 / 2 / 0 |
| `0x01A7-0x01BD` | 23 | `0x0D..0xDB` | 5 / 15 / 3 |
| `0x01BE-0x01E4` | 39 | `0x0F..0x47` | 39 / 0 / 0 |
| `0x01E5-0x01FC` | 24 | — | 0 / 24 / 0 |
| `0x01FD-0x0205` | 16 | `0x4A` | 1 / 15 / 0 |
| `0x0206-0x0209` | 4 | `0x51..0x52` | 2 / 2 / 0 |
| `0x020E-0x0225` | 24 | — | 0 / 24 / 0 |
| `0x024F-0x02C9` | 25 | `0xC9` | 1 / 24 / 0 |
| `0x02CA-0x02E1` | 24 | — | 0 / 24 / 0 |
| `0x0307-0x031E` | 24 | `0x4B..0xDB` | 8 / 14 / 2 |
| `0x031F-0x031F` | 1 | — | 0 / 1 / 0 |
| `0x0321-0x0346` | 39 | `0x56..0x8D` | 38 / 1 / 0 |
| `0x0347-0x036A` | 37 | — | 0 / 37 / 0 |

Los bloques de 24 escrituras sin origen en `p` no son copias: son cálculos
sobre el propio estado (contadores, incrementos, coeficientes) que el motor
reutiliza. El bloque de `0x01BE-0x01E4` es el único tramo largo de copia
directa (`p[0x0F..0x47]`), y `0x0321-0x0346` repite el patrón con
`p[0x56..0x8D]`.

Visto en bytes, el mapa son **dos bloques espejo de 0x588 B** — `0x284-0x80B`
(R1) y `0x80C-0xD93` (R2), dwords `0xA1-0x202` y `0x203-0x364`. El traductor
hace 181 escrituras en cada uno; 173 de los 174 offsets del primero reaparecen
exactamente `+0x588`, y el índice `p[N]` del segundo suele ser el del primero
**+ 70** (el corte grave/agudo: `p[0x12]` en R1, `p[0x58]` en R2). No son dos
estados: son los parámetros de los **dos motores** de cada voz, que el note-on
copia por separado a `motor+0x638C` — ver
[`../../NeuronVS_dsp/ZONES.md`](../../NeuronVS_dsp/ZONES.md) §6.1.

### El registro fila a fila

`NeuronVS_dsp/translator_writes.csv` tiene una fila por escritura, en orden de
ejecución:

| columna | contenido |
|---|---|
| `order` | 1…456 |
| `engine_off` | byte (`0040`) |
| `engine_idx` | dword (`0x10`) |
| `kind` | `copy` (bits de `p`), `expr` (fórmula), `trunc` (float→int) |
| `param_idx` | índice de `p` cuando el valor viene de ahí |
| `expr` | texto de la expresión, cuando no es copia |
| `guard` | condiciones que la rodean |

Ejemplo de las tres clases:

```text
3    0024  0x9   copy   0xAC                 e[9] = p[0xAC]
7    0034  0xd   trunc  0xD3                 e[0xD] = trunc_i32(f32_bits(p[0xD3]))
14   0010  0x4   expr   (uint)(1.0f - fVar1) e[4] = (uint)(1.0f - fVar1)
```

Las 11 truncaciones caen en `e[0x0]`, `e[0x1]`, `e[0xD..0xF]`, `e[0x9F]`,
`e[0x1BB..0x1BD]` y `e[0x31D..0x31E]`: son los campos que el motor guarda como
enteros y el preset entrega como float.

## 6. Lo que se lee

| lectura | referencias | índices distintos | rango |
|---|---:|---:|---|
| `p[N]` | 252 | 243 | `0x1..0xF4`, falta `0x55` |
| `e[N]` | — | 69 | hasta `0xD95` |

De esos 69 dwords de estado que se leen, **14 no los escribe el traductor**:
`0x54`, `0x91`, `0x99`, `0xE8`, `0x129`, `0x1A4`, `0x24A`, `0x28B`, `0x306`,
`0x366`, `0x369`, `0x36B`, `0xD94` y `0xD95`. Los últimos son los más
elocuentes: `0x366` es la puerta (byte `0xD98`), `0x369`/`0x36B` entran en la
afinación, `0xD94` es un **puntero** que se desreferencia y `0xD95` es el
**`this` del sub-objeto** con el que se llama a `FUN_100343e4`.

Dos consecuencias:

* **`p` se lee casi entero** (`0x1..0xF4` menos un hueco). No es una selección
  de parámetros: es el volcado de los slots del motor.
* **El traductor depende de estado previo que no inicializa**: punteros de
  buffers, tablas y contadores que vienen de otras funciones del motor. La
  frontera no es «toda la información entra por `p`»; es «`p` aporta los valores
  y el motor aporta el contexto».

## 7. Las dos llamadas del final

Ghidra imprime las dos llamadas sin argumentos. El desensamblado del propio
traductor los conserva:

```asm
10043C33  MOV ECX,[ESI+0x3654]   ; this = estado[0xD95]
10043C39  PUSH EDI               ; argumento = p
10043C3A  CALL 0x100343E4
10043C3F  MOV ECX,ESI            ; this = estado
10043C41  CALL 0x100373A0
```

La traducción ya usa la ABI real:

```cpp
FUN_100343e4((void*)(uintptr_t)e[0xd95], p);
char cVar13 = FUN_100373a0(e);
if (cVar13 != '\0')
    *(undefined1 *)((uintptr_t)e + 0xD99) = 1;
```

| función | firma real | qué se sabe |
|---|---|---|
| `FUN_100343e4` | `void __thiscall(void* self /* = e[0xD95] */, const uint32_t* p)` | 501 líneas; escribe en el sub-objeto, no en `e`. Su cuerpo no está portado |
| `FUN_100373a0` | `char __fastcall(const uint32_t* state /* = e */)` | 969 B (195 líneas); **portada** en [`src/translator_hooks.cpp`](../src/translator_hooks.cpp); valida las dos tablas de 128 entradas |

`FUN_100373a0` es el **validador**: con el byte `0xD98` apagado devuelve 0 sin
mirar nada. Con el flag encendido recorre las 128 teclas de las dos capas
(`state+0xDB0` y `state+0x2200`, paso `0x28`) y comprueba, en cada entrada, los
ocho punteros de modelo (cuatro `.sphere` y cuatro `.scape`):

| buffer | comprobación |
|---|---|
| `.sphere` (`+0x0C`, `+0x14` de la entrada) | primer byte `'p'` o `'N'`; si `+0x18` (nº de frames) no es 0, cada frame `i` debe llevar tag `0x4D2` y id `primero + i`, con paso `+0x44` y banco `+0x48` |
| `.scape` (`+0x08`, `+0x10`) | primer byte `'c'` o `'N'` |

Un puntero nulo se salta (el original no lo considera error). El resultado es
un AND de las 2.048 comprobaciones (128 teclas × 2 capas × 8 punteros); sólo si
es 1 el traductor escribe `0xD99 = 1`, que es lo que habilita el teclado. El detalle del formato está en
[`NeuronVS_neurondb/SCAPE_SPHERE.md`](../../NeuronVS_neurondb/SCAPE_SPHERE.md).

`FUN_100343e4` sigue sin portar: recibe `this = e[0xD95]` (un sub-objeto del
motor, no los 13.948 B del estado) y `p`; su cuerpo de 501 líneas no está
traducido. El hook es un no-op documentado, no un olvido: lo que escriba en su
sub-objeto no aparece en la comparación dword a dword del estado.

## 8. Cómo se comprueba

`tools/verify_translator.py` compara la traducción con el pseudocódigo sin
ejecutar nada:

```text
ok     escrituras al estado en orden
ok     lecturas de p en orden
ok     lecturas de e en orden
ok     ABI recuperada de las dos llamadas
ok     constantes iguales al PE
       310 constantes usadas (double, float)
ok     sin artefactos de Ghidra
ok     translator_writes.csv en orden
       456 escrituras, 436 dwords distintos, max e[0x36a] (byte 0xda8);
       243 indices de p; 69 de e leidos, 14 de ellos sin escribir

traduccion fiel al pseudocodigo
```

Qué cubre y qué no:

* **Cubre** que no falta ni se intercambia ninguna sentencia (secuencias de
  lecturas y escrituras idénticas), que cada constante es el valor y el ancho
  del PE, y que el CSV de escrituras sigue al `.c`.

La prueba fuerte es la **diferencial** (`neuron_golden --translate`): carga el
DLL, deja que se cargue el preset, y sobre dos copias del mismo estado llama a
`0x10040550` y a `neuron::translate`, comparando los 13.948 B dword a dword.

```bash
# Win32; lanzarlo directamente, no a través de ctest desde MSYS
NeuronVS_port/build32/Release/neuron_golden.exe --translate --preset 000,176,285,337

# o como test registrado (sale 77 si falta el DLL o NeuronDB)
ctest --test-dir NeuronVS_port/build32 -C Release -R translator_differential
```

El objetivo `neuron_golden` sólo existe en Win32 de 32 bits: el DLL es x86 y el
estado guarda punteros de 32 bits. En una configuración x64 el target y sus dos
tests (`translator_differential`, `golden_oracle`) no se generan.

Cada preset se compara **dos veces**:

1. **tras cargar** — el estado quieto que deja la carga del preset.
2. **mitad de nota** — el motor con una nota sonando. Se manda `note on 60`,
   se deja sonar 8 bloques de 512, se mueve un mando del host
   (`setParameter(0, 0.5)`), se mandan CC 1 = 64, CC 2 = 90, presión 64 y un
   bend de 0x2840 (LSB 0x40, MSB 0x50): 10304/16384 = 0,62890625, que con la
   ley `2^((2b−1)·rango/12)` y rango 2 da **+0,515625 semitonos**. Se dejan
   pasar 32 bloques más (372 ms). Para entonces hay voces vivas, envolventes y
   LFO a medio camino y el morph del scape ya recorrido; `FUN_10013490` ha
   dejado los seis controles de instrumento en `params+0x44` y `FUN_100134e0`
   ha recalculado `p` (base más las seis filas de morph de `params+0x2C`,
   recortado a `params+0x2B0`) y ha vuelto a llamar al traductor. Es el estado
   en el que el host llama al traductor cuando el usuario gira un mando con la
   nota sonando.

La segunda pasada sólo cuenta si el motor se ha movido: el arnés toma como
línea base la foto que deja la primera pasada (ya con la puerta y el validador
escritos, para no contarse a sí mismo) y falla si la nota no cambia nada. Con
los 351 sonidos instalados cambian entre **10 y 17 dwords del motor y 0..2 de
`p`**, casi siempre los mismos: `e[0x0A0..0x0A2]`, `e[0x1F0..0x1F3]`,
`e[0x204]`, los pares de capa `e[0x353]/0x355` y `e[0x369]/0x36A` (salidas del
traductor para la `p` nueva) y los bytes de estado `e[0xD97]` en adelante. Los
índices se imprimen en una línea `e: 0x0A0 0x0A2 0x1F0 … | p: 0x013 0x0E4`
(los ocho primeros de cada lista, con `...` si hay más) para que la foto sea
auditable.

Barrido completo (`0..350`, los 351 sonidos instalados); sale 1 por los 18 de
§9.5, cada uno con su ULP:

```bash
LIST=$(seq -f "%03g" 0 350 | paste -sd,)
NeuronVS_port/build32/Release/neuron_golden.exe --translate --preset "$LIST"
```

```text
preset 176 tras cargar (program_change): 0 / 3487 dwords del motor y 0 / 335 de p difieren
preset 176 mitad de nota: 16 / 3487 dwords del motor y 2 / 335 de p cambiaron desde el reposo
  e: 0x0A0 0x0A2 0x1F0 0x1F1 0x1F3 0x204 0x369 0x36A ... | p: 0x013 0x0E4
preset 176 mitad de nota: 0 / 3487 dwords del motor y 0 / 335 de p difieren
```

- **en reposo: 351/351 idénticos**, 3.487 dwords cada uno; el validador devuelve
  1 en las dos implementaciones (`dll=1 port=1`) y el byte `0xD99` queda
  encendido en ambos;
- **a mitad de nota: 333/351 idénticos**. Los 18 restantes difieren en **1 ULP**
  y sólo ahí: 17 en un dword y el preset 140 en dos, siempre `e[0x204]` (byte
  `0x810`, en 11 presets) o `e[0x0A2]` (byte `0x288`, en 7), p. ej.
  `dll=3E9404C8 port=3E9404C7` en el preset 003. Las dos escrituras son el mismo
  producto `e[0x36B] * e[0x36A] * (float)dVar19`; la diferencia es el redondeo
  de x87 frente al de SSE (§9.5). Es reproducible: dos pasadas seguidas dan los
  mismos 18 presets y los mismos valores.
  Nótese que la `p` que llega aquí viene del propio DLL: `setParameter` y los CC
  disparan `FUN_100134e0`, que la recalcula y vuelve a traducir antes de que el
  arnés tome la foto.

Los 18 son 003, 025, 046, 053, 055, 075, 079, 101, 103, 116, 140, 171, 179,
180, 186, 207, 252 y 301. El test registrado usa `000,176,285,337`, que están
entre los idénticos; el barrido completo sale 1 por esos 18.

La prueba de contrato, `tests/translator_probe.cpp` (Win32; en x64 no se compila
porque el estado guarda punteros de 32 bits), fija el resto del contrato:

```text
ok     e[0x10] copia p[0]
ok     e[0x11] copia p[1]
ok     e[9] copia p[0xAC]
ok     e[0] trunca p[0xDC]
ok     0xD98 encendido: el traductor enciende 0xD99 (validador OK)
ok     validador: 0xD98 apagado -> 0
ok     validador: sin buffers -> 1
ok     validador: solo sphere -> 1
ok     validador: solo scape -> 1
ok     validador: sphere+scape validos -> 1
ok     validador: id de frame roto -> 0
ok     validador: reparado -> 1
ok     validador: scape sin 'c' -> 0
ok     validador: R2 tecla 1 -> 1
ok     no escribe fuera del estado
ok     puerta cerrada: estado intacto
ok     sin p: estado intacto
ok     determinista con el mismo estado inicial

traductor OK
```

Los casos `sin buffers` / `solo sphere` / `solo scape` devuelven 1 porque el
original **salta** los punteros nulos: el validador comprueba lo que hay, no
exige que haya algo. El canario de 64 B detrás de los 13.948 B confirma que
ninguna de las 456 escrituras se sale del estado.

Lo que la diferencial **no** cubre todavía: el cambio de modelo o de preset con
notas sonando (`FUN_100440d0`/`FUN_10013ea0` en caliente) y lo que `FUN_100343e4`
escribe en su sub-objeto.

## 9. Dudas abiertas

1. **El mapa slot → parámetro.** `p[N]` es un slot, no un parámetro. El mapa de
   `0x10049E00` tiene 64 entradas; para el resto no hay nombre. Cerrarlo pide
   seguir a quién llena `params+0x278C` (candidato: `FUN_10013ea0`, el cargador).
2. **El cuerpo de `FUN_100343e4`.** La ABI ya está recuperada (§7), pero sus 501
   líneas siguen sin portar: no se sabe qué escribe en el sub-objeto `e[0xD95]`
   ni si eso afecta a la siguiente nota.
3. **Los límites de `FUN_100373a0`.** La comprobación de frames se reproduce
   con contadores *unsigned*, como el original: un `.sphere` con `+0x18`
   corrupto (p. ej. `0xFFFFFFFF`) hace que el binario recorra miles de millones
   de frames y lea fuera del buffer. El port no añade cotas, para no cambiar el
   veredicto; si se quiere endurecer, hay que decidir qué hacer con datos
   corruptos **antes** de tocar el validador.
4. **`trunc_i32` en los extremos.** El idioma original es el de MSVC: NaN y
   desbordamientos producen `0x80000000`; la traducción devuelve 0 para NaN y
   trunca por `int64`. Con valores recortados del preset no se llega ahí, pero
   no es idéntico.
5. **x87 de 80 bits frente a `double`.** Los `fVar` son `double` (53 bits de
   mantisa) y el original calcula en x87 (64 bits) antes de redondear al
   guardar. En el estado que deja la carga del preset los 351 coinciden bit a
   bit, pero la pasada de mitad de nota (§8) destapa el caso: **18 presets
   difieren en 1 ULP** en `e[0x204]`/`e[0x0A2]`, que guardan
   `e[0x36B] * e[0x36A] * (float)dVar19`. Tres factores `float` multiplicados
   en x87 redondean una sola vez al guardar (`fstp dword`); el port, compilado
   con SSE, redondea el producto intermedio y vuelve a redondear al guardar.
   Cerrarlo pide calcular el producto en `double` antes de truncarlo a `float`
   (una sola redondez) o volver a x87, que MSVC ya no garantiza.
6. **18 dwords se escriben dos veces** (`e[0x3]`, `e[0x9A..0x9B]`,
   `e[0x1FD..0x203]`, `e[0x321]`, `e[0x35F..0x364]`). Se conserva el orden, que
   es lo que hace el original; el porqué de cada corrección no está estudiado.
7. **Los campos con nombre pendiente.** El estado se escribe por offsets; no hay
   todavía un mapa `e[N] → nombre/tipo` verificado. La tabla de §5 dice *dónde*
   y *de qué*, no *qué es*.
8. **Estados intermedios.** La pasada de mitad de nota (§8) ya cubre voces
   vivas, envolventes, LFO y morph en curso —y es la que destapó la diferencia
   de 1 ULP de §9.5—. Sigue sin cubrirse el cambio de modelo o de preset con
   notas sonando (`FUN_100440d0`/`FUN_10013ea0` en caliente), donde el motor
   libera y realoja descriptores, ni el estado que deja `FUN_100343e4`.
9. **`p[0x55]` no se lee.** Un hueco en medio de un volcado casi completo; puede
   ser un slot reservado o un parámetro que el motor ignora.

## 10. Regenerar

```bash
python NeuronVS_port/tools/gen_translator.py
python NeuronVS_port/tools/verify_translator.py
cmake --build NeuronVS_port/build --config Release --target neuron_core
```

El generador escribe tres artefactos: `src/translator.cpp`,
`include/neuron/translator.hpp` y `NeuronVS_dsp/translator_constants.csv`. Si el
`.c` descompilado cambia (otra versión de Ghidra), el verificador falla antes de
que el cambio llegue al motor.
