# Las 128 entradas de un modelo y `FUN_100440d0`

Esta nota aísla la pieza que une el fichero del modelo con el motor: **cómo
`map.script` (texto) se convierte en 128 entradas por tecla dentro del estado
que suena**, y qué hace exactamente `FUN_100440d0` con cada una. Todo se
comprueba con [`tools/verify_zones.py`](tools/verify_zones.py) (estático) y con
`neuron_golden --zones` (en ejecución, contra el DLL de 2004).

## 1. La cadena, en una línea

```text
R1ModellIndex / R2ModellIndex  (preset)
  └─ callback_10013620         observador del preset
      └─ FUN_1000a7d0(id)      banco del modelo: 128 punteros, uno por tecla
          └─ 128 × FUN_100440d0(holder, slot, key, root, scapeLo, scapeHi,
                                sphereLo, sphereHi, detune, volume)
              └─ engine+0xDB0 (slot 0) / engine+0x2200 (slot 1)
                  128 × 0x28 B = 5.120 B por slot
                  └─ FUN_1003d800 → FUN_10032970 ×2  crea los dos motores de una tecla
```

`FUN_100440d0` no lee el fichero ni sabe de zonas: recibe valores ya resueltos
y los deposita en la tabla del motor. La resolución texto→valores ocurre antes,
en `FUN_1000a930` (recorre `map.script`), `FUN_1000af30` (asigna cada clave a un
campo del registro) y `FUN_1000b230` (abre los `.scape`/`.sphere`).

## 2. Tres representaciones que no hay que confundir

| Capa | Dónde vive | Unidad | Tamaño | Qué es |
|---|---|---|---|---|
| `map.script` | `Models/NNN.model/map.script` | 128 bloques de 8 claves | 1.027 líneas | configuración en texto; muchas zonas vacías |
| registro de zona | banco del modelo, en heap | registro | **0x30 = 48 B** | una zona ya numérica, compartida por todas las teclas que cubre |
| entrada del motor | `engine+0xDB0` / `+0x2200` | tecla MIDI | **0x28 = 40 B** | copia plana para el render, una por tecla y slot |

El número 128 aparece en las tres capas por motivos distintos: 128 bloques en el
script, 128 punteros en el banco (uno por tecla 0…127) y 128 entradas en cada
tabla del motor. **No son 128 zonas independientes**: en el modelo 511, las 128
entradas del motor apuntan a la misma zona.

## 3. El registro de zona (0x30 B) y `map.script`

`FUN_1000af30` compara el nombre de la clave (sin el prefijo numérico) y
almacena en el registro que recibe en `param_1` (`int*`):

| Offset | Clave de `map.script` | Tipo | Nota |
|---|---|---|---|
| `+0x00` | `LowKey` | int | primera tecla que cubre la zona |
| `+0x04` | `HiKey` | int | última tecla |
| `+0x08` | `RootKey` | int | tecla en la que la muestra suena a su velocidad natural |
| `+0x0c` | `LowSource` | int | índice 1…12 en el modelo (par scape/sphere grave) |
| `+0x10` | `HiSource` | int | índice 1…12 (par agudo) |
| `+0x14` | — | puntero | buffer `.scape` de `LowSource` (lo escribe `FUN_1000b230`) |
| `+0x18` | — | puntero | buffer `.sphere` de `LowSource` |
| `+0x1c` | — | puntero | buffer `.scape` de `HiSource` |
| `+0x20` | — | puntero | buffer `.sphere` de `HiSource` |
| `+0x24` | `Detune` | int | semitonos; el consumidor lo escala |
| `+0x28` | `Volume` | float | **ya convertido** a ganancia lineal |
| `+0x2c` | `Pan` | float | **ya convertido** a −1…+1 |

Las dos conversiones están en el mismo parser y son verificables en el PE:

```c
// Volume (0x1000B122…0x1000B157)
dB = clamp(v, -32, 12);
*(float *)(rec + 0x28) = pow(10.0, dB * 0.05);      // 10^(dB/20)
// Pan (0x1000B19B…0x1000B1B4 y 0x1000B1DF)
v = clamp(v, -51, 51);
*(float *)(rec + 0x2c) = v * 0.02;                  // ±1.02; ±1.0 en los extremos
```

`Detune` y `Volume` siguen camino; `Pan` no (ver §7).

### Del script al banco: el rango es lo que importa

`FUN_1000a930` abre `Models/%03d.model/map.script`, lee cada línea con el
formato `"%d%s %d"`, y por cada zona con `LowSource` o `HiSource` distinto de
cero escribe **el mismo puntero de registro** en el banco para todas las teclas
`LowKey…HiKey`:

```c
// FUN_1000a930, tras cargar los buffers de la zona
for (i = *zona; i <= zona[1]; ++i)
    banco[1 + i] = (int)zona;      // banco+4 + tecla*4
```

Consecuencias directas:

- **Modelo 511** (`sinew`): solo la zona 0 tiene fuentes (`LowSource = HiSource = 1`);
  cubre `0…127` con `RootKey 69`. Las otras 127 zonas están a cero y se saltan.
  Las 128 entradas del banco apuntan a la zona 0.
- **Modelo 000**: 36 zonas con rangos contiguos (`0…37`, `38…49`, …), cada una con
  su `RootKey` y sus fuentes; las teclas reciben la zona que las cubre.
- Una tecla sin zona queda con puntero nulo y `FUN_100440d0` escribe una entrada
  de ceros (tecla muda por ausencia de modelo).

## 4. `FUN_100440d0`: los nueve argumentos

La convención es `__thiscall`: **ECX** lleva el *holder* del motor (4 B cuyo
primer dword es el estado de 13.948 B) y la pila lleva nueve argumentos:

| # | Argumento | Quién lo pone | Qué hace |
|---|---|---|---|
| 1 | `slot` | `strcmp(nombre, "R1ModellIndex") != 0` | 0 → tabla R1 (`+0xDB0`); 1 → R2 (`+0x2200`); fuera de `{0,1}` → retorna |
| 2 | `key` | contador 0…127 | índice de la entrada; fuera de `0…127` → retorna |
| 3 | `root` | registro `+0x08` | `RootKey` de la zona |
| 4 | `scapeLo` | registro `+0x14` | buffer `.scape` de `LowSource` |
| 5 | `scapeHi` | registro `+0x1c` | buffer `.scape` de `HiSource` |
| 6 | `sphereLo` | registro `+0x18` | buffer `.sphere` de `LowSource` |
| 7 | `sphereHi` | registro `+0x20` | buffer `.sphere` de `HiSource` |
| 8 | `detune` | registro `+0x24` | entero de `Detune` |
| 9 | `volume` | registro `+0x28` | **bits** del float de ganancia lineal (0 dB = `0x3F800000`) |

Ojo al orden: el llamante pasa `scapeLo, scapeHi, sphereLo, sphereHi` y
`FUN_100440d0` los reordena al escribir la entrada. Los argumentos 4…7 son
punteros a los buffers completos (`FUN_1000b490` hace `_open/_read` y
`operator_new`), no índices.

### Lo que hace el cuerpo

1. Comprueba `engine != 0`, `slot ∈ {0,1}` y `key ∈ [0,127]`.
2. Si `engine+0xD98` está encendido (el motor terminó de construirse), recorre
   los 128 descriptores de tecla (`engine+0xD94`, paso `0x70`) y **pone a cero
   el flag `+0x40` de todos**. Ese flag lo pone `FUN_1003d800` al elegir un
   descriptor y lo quita al terminar de construir la voz (líneas 104 y 1508),
   así que significa **"slot en construcción"**, no "tecla sonando". El primer
   bucle libera cualquier construcción a medias. Después hay un segundo bucle
   que apagaría las voces de los descriptores `nSAN` de este motor, pero exige
   ese mismo `+0x40` encendido, que el primer bucle acaba de borrar. No es una
   lectura de Ghidra: el asm lo hace igual (`0x10044126` escribe `[ecx+0x40]`,
   `0x100441AB` lo prueba), de modo que **ese apagado de voces no puede
   ejecutarse nunca**: para cuando corre, no queda ningún slot marcado.
   `FUN_10046b70` repite el mismo par de bucles, con el mismo resultado. En
   carga de preset `0xD98` ya vale 1 (motor construido), así que el bloque se
   ejecuta; `0xD99` queda a 0 en cualquier caso. Las tablas **no** se borran
   aquí: eso ocurre en `FUN_10046ce0`.
3. Escribe la entrada de 40 B en `engine + base + key*0x28`:

```c
z->flag    = 0;              // +0x00, byte
z->root    = root;           // +0x04
z->scapeLo = scapeLo;        // +0x08
z->sphereLo= sphereLo;       // +0x0c
z->scapeHi = scapeHi;        // +0x10
z->sphereHi= sphereHi;       // +0x14
z->zero18  = 0;              // +0x18
z->detune  = detune;         // +0x1c
z->volume  = volume;         // +0x20, bits de float
z->zero24  = 0;              // +0x24
```

Cada uno de los cuatro punteros se escribe como 0 si el llamante pasa 0 (tecla
sin zona); el resto se copia tal cual.

### Los flags que rodean la tabla

Además de la entrada, `FUN_100440d0` toca dos bytes del motor que gobiernan si
el teclado responde:

| Símbolo | Tipo | Quién lo pone | Para qué |
|---|---|---|---|
| `engine+0xD94` | puntero | `FUN_10044884` (al construir) | array de descriptores de `0x70` B (129 alojados; 32 voces) |
| `engine+0xD98` | byte | `FUN_10044884` al terminar (`= 1`) | motor listo; `FUN_1003d800` no crea voces si es 0 |
| `engine+0xD99` | byte | `FUN_10040550` (`= 1` al final) | teclado habilitado; `FUN_1003d800` tampoco crea voces si es 0 |
| `descriptor+0x40` | byte | `FUN_1003d800` lo pone a 1 al elegir y a 0 al terminar | slot en construcción; 0 = libre |

`FUN_100440d0` pone `0xD99 = 0` **siempre**, justo antes de escribir la entrada
(no sólo en la rama de `0xD98`). Como el traductor lo vuelve a encender al
final, la secuencia completa del callback —`FUN_10046b70`, 128 escrituras,
`FUN_1003d780` (`0xD99 = 0`), `FUN_10040550`— deja el teclado apagado durante
todo el cambio de modelo. Es la razón de que cambiar de modelo con notas
sonando no dispare voces a medio construir.

## 4.2 Quién llena la tabla y cuándo

La tabla no se llena una vez: se reescribe entera cada vez que cambia
`R1ModellIndex` o `R2ModellIndex`. `callback_10013620` es el observador de esas
dos claves del preset y hace, en este orden:

```c
iVar3 = *param_3;                   // core
FUN_100014c0(0);
iVar4 = ftol();                     // id de modelo, redondeado a int
FUN_10046b70();                     // mismo barrido de flags que 100440d0
FUN_1000a7c0();                     // devuelve la tabla global DAT_10055738
/* strcmp(nombre, "R1ModellIndex") -> iVar6 = 0 (R1) o != 0 (R2) */
FUN_1000a810(ftol());               // fija el banco del modelo
piVar8 = FUN_1000a7d0(iVar4);       // 128 punteros a zona
for (key = 0; key < 128; ++key)     // 128 llamadas
    FUN_100440d0(iVar6 != 0, key, root, scapeLo, scapeHi, sphereLo,
                 sphereHi, detune, volume);
FUN_1003d780();                     // 0xD99 = 0
FUN_10040550(0, iVar3 + 0x278c);    // retraduce el preset; 0xD99 = 1
```

Consecuencia práctica para el porte: **la tabla es estado derivado**. No hay
que inventariar las 128 entradas de un `.model`, basta con reproducir el
banco (zona por tecla) y escribir las 128 copias cuando cambie el modelo.

## 5. La entrada de 40 B, campo a campo

Volcado real de `neuron_golden --zones` con el preset 176 (`R1 = R2 = 511`),
teclas 0, 1, 60 y 127 —las cuatro son idénticas porque la zona 0 cubre todo el
teclado. Los punteros cambian en cada ejecución (ASLR); lo que importa es que
se repiten y que el par grave y el agudo son el mismo buffer:

```text
R1 key   0  flag 0  root  69  lo 0314c180/0316da90  hi 0314c180/0316da90  r18 0  det   0  vol 3f800000 (1.000000)  r24 0
    pair 0: 0314c180 tag csAN id c1b5d423 len 66940
    pair 1: 0316da90 tag psAN id c1b5d423 len 64
    pair 2: 0314c180 tag csAN id c1b5d423 len 66940
    pair 3: 0316da90 tag psAN id c1b5d423 len 64
```

| Offset | Nombre | Valor 511 | Quién lo lee |
|---|---|---|---|
| `+0x00` | flag | 0 | nadie en el render; se fuerza a 0 al escribir |
| `+0x04` | root key | 69 | `FUN_10032970`: `pow(2, (60−root)/12)` y `key−root` |
| `+0x08` | scape grave | ptr `csAN` | `FUN_10032970` → `FUN_10032d10` |
| `+0x0c` | sphere grave | ptr `psAN` | ídem; debe compartir el id de curva (`0xC1B5D423`) |
| `+0x10` | scape agudo | ptr `csAN` | par alternativo, elegido por la nota |
| `+0x14` | sphere agudo | ptr `psAN` | ídem |
| `+0x18` | 0 | 0 | `FUN_10032970` lo usa como segundo factor de afinación; al ser 0 no aporta |
| `+0x1c` | detune | 0 | `FUN_10032970`: factor de afinación |
| `+0x20` | volume | `0x3F800000` = 1.0 | `FUN_10032970`: se copia a `voz+0x6320` |
| `+0x24` | 0 | 0 | nadie |

`Pan` no aparece: no es un argumento de `FUN_100440d0` y el registro `+0x2c`
no se lee en este camino. La tabla de 128 entradas, por tanto, **no lleva pan**;
si el motor lo aplica, lo hace por otra ruta (no localizada todavía).

## 6. Quién consume las 128 entradas: una voz, dos motores

`FUN_1003d800` es el **note-on**. Lo llama `FUN_1000ba70` (el gestor `noise`)
con `(nota, velocity)` cuando la velocity es > 0: elige un descriptor libre de
`engine+0xD94`, lo marca en construcción (`+0x40 = 1`), construye **los dos
motores** de la nota y devuelve el descriptor, que `noise` guarda en su array
`+0x3c`. La convención es `__thiscall` sobre el **holder** del motor
(`params+0x27C`), no sobre el estado: `[ecx]` es el estado de 0x367C, y en él
viven las dos tablas, los dos bloques de parámetros y el array de voces.

La tecla es la nota truncada, acotada a 0…127:

```c
key = clamp((int)(DAT_100622a0 + note), 0, 0x7F);
```

`DAT_100622a0` (sesgo global) está siempre a 0: vive en el BSS de `.data` y las
tres únicas escrituras del PE lo ponen a 0 (`FUN_10037830`, `FUN_10044884`,
`FUN_10046ce0`).

Las dos llamadas a `FUN_10032970`, con el asm del call site
(`0x1003F2ED`…`0x1003F368`):

```asm
1003F2ED  lea  edi,[esi+esi*4]           ; edi = 5*tecla
1003F2F0  mov  eax,[ebp-0x44]            ; eax = estado (*holder)
1003F309  lea  ecx,[ecx+edi*4+0xDB0]     ; + 0x28*tecla → tabla R1
1003F313  add  ecx,eax
1003F315  mov  eax,[ebp-0x50]            ; ← ECX de la 1ª llamada
1003F31F  mov  ecx,eax
1003F32D  call 0x10032970                ; motor R1

1003F338  lea  eax,[eax+edi*4+0x2200]    ; + 0x28*tecla → tabla R2
1003F342  add  eax,edx
1003F359  mov  ecx,[ebp-0x54]            ; ← ECX de la 2ª llamada
1003F368  call 0x10032970                ; motor R2
```

Y los dos locales salen del **mismo descriptor de voz** (`ebx = engine+0xD94`,
`eax = índice*0x70`):

```asm
1003DA1A  mov edx,[ebx+eax+0x68]   ; descriptor+0x68
1003DA24  mov [ebp-0x50],edx       ; → ECX llamada 1
1003DA27  mov eax,[ebx+eax+0x6C]   ; descriptor+0x6C
1003DA2B  mov [ebp-0x54],eax       ; → ECX llamada 2
```

O sea: **ECX no es la voz, es un motor**. Uno de los dos objetos de 0x6838 B
(26.680) que cuelgan del descriptor de 0x70 B.

### 6.1 Un voice, dos engines

El descriptor lo construye `FUN_10023074` (tag `'nSAN'` = `0x4E41536E`) y reserva
**dos motores distintos**, cada uno con su propio `new`:

```asm
1002327B  mov [esp],0x6838 ; call 0x100213a0   ; malloc
10023293  mov [esp],0                              ; rol 0
1002329A  call 0x10023334
100232A1  mov [ebx+0x68],eax                       ; motor R1
100232AB  mov [esp],0x6838 ; call 0x100213a0   ; malloc
100232C3  mov [esp],1                              ; rol 1
100232CA  call 0x10023334
100232D1  mov [ebx+0x6C],eax                       ; motor R2
```

Nunca son el mismo puntero: dos alojamientos independientes de 26.680 B.
`FUN_10023334(motor, rol)` los deja idénticos (0x1a0e dwords a cero, `+0x638C` =
`new 0x588`, `+0x6820 = 1` al final) y sólo anota el **rol** en `+0x6824`
(0 = R1, 1 = R2). Ese desplazamiento no se lee en ninguna instrucción del PE
(una sola escritura, la del constructor): es una etiqueta, no una rama.

Por eso el recelo original no se cumple. `FUN_10032970` reinicia su motor al entrar
(pone a cero `+0x194` y `+0x1194`, dos buffers de 4 KB, y los campos de
afinación), pero cada llamada reinicia **un objeto distinto**: la segunda no
borra la primera.

Lo que sí es asimétrico es la **fuente de parámetros**. Cada motor se lleva su
propia copia de 0x588 B, y no del mismo sitio:

| Motor | Copia desde | A | Cómo |
|---|---|---|---|
| R1 | `engine+0x284` | `motor+0x638C` | `rep movsd`, 0x162 dwords — `0x1003DA40` |
| R2 | `engine+0x80C` | `motor+0x638C` | `rep movsd` dentro de `FUN_10026b40`, llamada en `0x1003F284` |

Los dos bloques son **espejo**: `0x80C − 0x284 = 0x588`, y el traductor escribe
el mismo juego de campos dos veces (181 escrituras por bloque en
[`translator_writes.csv`](translator_writes.csv); 173 de los 174 offsets de R1
reaparecen exactamente en `+0x588`). En los 47 campos que llevan un `p[N]`
literal en las dos capas, el índice de R2 es el de R1 **+ 70** en 42 casos: el
corte grave/agudo, por ejemplo, es `p[0x12]` para R1 y `p[0x58]` para R2. La
tabla de valores efectivos está partida en dos bancos por capa, separados 70
slots.

### 6.2 Ficha del motor (0x6838 B) y del descriptor de voz (0x70 B)

Motor, que es el `this` de `FUN_10032970`:

| Offset | Qué |
|---|---|
| `+0x150`, `+0x154`, `+0x158` | tres sub-objetos de 0x28 B (cada uno con otro de 0xF4 B) |
| `+0x194`, `+0x1194` | dos buffers de 4 KB que el note-on pone a cero |
| `+0x6320` | ganancia (`entry+0x20`) |
| `+0x6328` | `nota − root` |
| `+0x6358` | factor de frecuencia `2^((60−root)/12)` |
| `+0x6360` | `root` como float |
| `+0x6384` | nota como float |
| `+0x6388` | segundo float de la nota (el mismo valor que queda en `descriptor+0x54`) |
| `+0x638C` | bloque de parámetros de la capa (0x588 B) |
| `+0x6418` | factor de detune `2^(((entry+0x1C) + global) / 1200)` (cents) |
| `+0x641C` | factor de detune `2^((entry+0x18) / 12)` (semitonos) |
| `+0x6820` | byte de puerta: 0 = motor sin construir, la función retorna al entrar |
| `+0x6824` | rol (0 = R1, 1 = R2); nadie lo lee |
| `+0x6834` | byte "válido": 1 sólo si `params[0] != 0` y `FUN_10032d10` aceptó el par |
| `+0x6835` | se pone a 1 al entrar y a 0 al terminar (reinicio en curso) |
| `+0x6836` | resultado de `FUN_10032d10` (par `.scape`/`.sphere` compatible) |

Descriptor de voz (0x70 B, tag `'nSAN'`):

| Offset | Qué |
|---|---|
| `+0x00` | `'nSAN'` |
| `+0x24`, `+0x28`, `+0x2C` | tres sub-objetos de 0x28 B (cada uno con otro de 0xF4 B) |
| `+0x30` | sub-objeto de 0x64 B |
| `+0x40` | byte "en construcción" (1 = ocupado) |
| `+0x58` | puntero al estado del motor |
| `+0x68` | **motor R1** (0x6838 B) |
| `+0x6C` | **motor R2** (0x6838 B) |

El array se aloja de una vez en `FUN_10044884`: `0x3874` B = cabecera de 4 B
(`0x81` = 129) + 129 descriptores de 0x70 B; `engine+0xD94` apunta al primero y
el barrido se limita a `engine+0xDA0`, que el constructor pone a **32**
(polifonía).

### 6.3 La convención real de `FUN_10032970`

Ghidra le pone tres argumentos de pila; el asm dice **ocho** (`ret 0x20` en
`0x10032AA5`, `0x10032CCD`, `0x10032CE9`, `0x10032CFA` y `0x10032D0B`). El
llamante reserva exactamente 0x20 B (`add esp,-0x20`) y escribe cinco:

| # | Dónde | Qué | Se lee |
|---|---|---|---|
| this | `ECX` | motor (0x6838 B) | sí |
| 1 | `[ebp+8]` | entrada de 0x28 B de la tabla R1/R2 | sí |
| 2 | `[ebp+0xC]` | tecla 0…127 | sí (`nota − root`) |
| 3 | `[ebp+0x10]` | nota como `float` | sí (corte grave/agudo) |
| 4 | `[ebp+0x14]` | 0 | **no** |
| 5 | `[ebp+0x18]` | `&descriptor+0x18` | sí: se reenvía a `FUN_10033050` |
| 6…8 | `[ebp+0x1C]`… | basura del llamante | **no** |

Que la función limpie 0x20 y el llamante haya reservado 0x20 es lo que mantiene
la pila cuadrada; los tres últimos huecos quedan sin inicializar a propósito.
Esa es la razón de que la descompilación muestre siete argumentos.

De la entrada lee:

- `entry+0` → si vale **1**, la tecla se salta;
- `entry+4` → `motor+0x6360 = root` y `motor+0x6328 = nota − root`;
- el par **grave** `entry+8/+0xC` o el **agudo** `entry+0x10/+0x14` según
  `nota < *(float *)(params + 0x418)`;
- `entry+0x18` (semitonos) y `entry+0x1C` (cents) → factores de detune;
- `entry+0x20` → `motor+0x6320` (ganancia).

El umbral `+0x418` no es de la entrada: es el desplazamiento dentro del bloque
de parámetros que el note-on acaba de copiar. Para R1, `0x284 + 0x418 = 0x69C`;
para R2, `0x80C + 0x418 = 0xC24`. Esos dwords los escribe `FUN_10040550` desde
`p[0x12]` y `p[0x58]` respectivamente. En el preset 176 valen **64.0**, así que
las notas 0…63 usan `LowSource` y 64…127 `HiSource`. En el modelo 511 ambas
fuentes son la misma; en el 337, la zona 0 declara `LowSource 1` / `HiSource 2`
y el corte sí cambia de par.

### 6.4 La puerta que mira `FUN_1003d800` es sólo la de R1

`0x1003DA2E` prueba `[R1+0x6820]` y, si está a 0, salta el bloque de modulación
(`0x1003DA3C`…`0x1003F252`). Pero las dos llamadas se hacen igual, y cada motor
vuelve a comprobar **su propia** puerta al entrar (`0x10032983`), además de
`params[0] != 0`. Consecuencia: si R1 está apagado y R2 encendido, la nota suena
sólo por R2 y sin el bloque de modulación; apagar R1 no silencia a R2.

## 7. Lo que queda abierto

- **Pan**: se parsea y se guarda en el registro (`+0x2c`), pero no entra en la
  tabla de 128 entradas. Falta encontrar el camino que lo aplica.
- **`+0x18`**: el consumidor lo usa, pero `FUN_100440d0` siempre lo pone a 0.
  Si en el diseño original existía un "fine tune" por zona, este camino no lo
  rellena.
- **¿Dónde se suman R1 y R2?** Ya está claro que son dos motores del mismo
  voice y que cada uno se inicializa con su tabla y su bloque de parámetros
  (§6.1), pero no se ha trazado todavía la mezcla: el render por capa parece
  estar en las funciones del rango `0x10039xxx` (`FUN_10039100`,
  `FUN_10039320`, `FUN_10039540`, `FUN_100396f0`) que recorren el mismo array
  con `engine+0xDA0` como cuenta. Falta ver dónde acaban las dos salidas.
- **Los 5 campos que no siguen la regla +70.** En 42 de los 47 campos con `p[N]`
  literal en las dos capas, R2 usa `p[N+70]`; en 4 la diferencia es +30 y en 1
  es 0. No se ha identificado el criterio de esas excepciones.
- **Quién pone `entry+0` a 1.** `FUN_10032970` salta la tecla si ese byte vale 1
  (`0x10032A3D`), pero `FUN_100440d0` siempre lo escribe a 0 y no se ha
  encontrado ningún otro escritor.
- **El rol `+0x6824`.** Se escribe (0/1) en el constructor del motor y no hay
  ninguna lectura con ese desplazamiento en el PE. Si el original distingue
  R1/R2 en tiempo de ejecución, no lo hace por ahí.
- **Por qué hay un apagado de voces muerto**. El hecho está comprobado en el
  asm (borrado en `0x10044126`, test en `0x100441AB`, mismo patrón en
  `FUN_10046b70`). La explicación más económica: el bloque nació para abortar
  voces a medio construir, pero como el flag `+0x40` se limpia antes de
  mirarlo, quedó inerte. No hace falta reproducirlo: el porte sólo necesita
  liberar los slots al cambiar de modelo y apagar `0xD99` mientras escribe.

## 8. Cómo se comprueba

Estático (no necesita el DLL):

```text
python NeuronVS_dsp/tools/verify_zones.py
101/101 comprobaciones OK
```

Con `-v` lista las 101. Las que sostienen esta nota:

```text
ok  las 7 claves aparecen en FUN_1000af30 / el parser las prueba en orden
ok  arg param_4 .. param_10 -> entrada +0x04 .. +0x20 (los 10 campos)
ok  flag +0x00 = 0 (byte), reservados +0x18 y +0x24 = 0
ok  el slot 0 usa +0xdb0 y el 1 +0x2200
ok  el primer bucle escribe el flag +0x40 (= 0)
ok  el test de +0x40 viene despues del borrado: el apagado de voces no entra
ok  el descriptor se reconoce por el dword 'nSAN'
ok  0xD99 = 0 se ejecuta siempre, antes de escribir la entrada
ok  FUN_1003d800 exige 0xD98 y 0xD99 encendidos y un +0x40 libre
ok  FUN_10032970 lee +0x04, +0x08, +0x0c, +0x10, +0x14, +0x18, +0x1c, +0x20
ok  0x1003f32d y 0x1003f368 son llamadas a FUN_10032970
ok  ECX de la 1ª llamada sale de [ebp-0x50] / de la 2ª de [ebp-0x54]
ok  [ebp-0x50] = descriptor+0x68 y [ebp-0x54] = descriptor+0x6c
ok  1ª entrada: engine+0xDB0+0x28*tecla / 2ª: engine+0x2200+0x28*tecla
ok  FUN_10032970 limpia 0x20 B: ocho huecos de pila
ok  el note-on copia a R1 desde engine+0x284 y a R2 desde engine+0x80C
ok  FUN_10026b40 hace el rep movsd de 0x162 dwords a +0x638C
ok  el descriptor de voz reserva dos bloques de 0x6838 (+0x68 y +0x6C)
ok  el primero con rol 0, el segundo con rol 1
ok  el rol +0x6824 no se lee en FUN_10032970
ok  el traductor escribe los dos bloques de 0x588 B (174/173 offsets)
ok  el de R2 es el espejo exacto (+0x588) (173/174)
ok  R2 lee p[N+70] donde R1 lee p[N] (42/47)
ok  el corte grave/agudo esta en las dos capas (0x69C / 0xC24)
ok  modelo 511: 128 zonas, la 0 = 0..127 root 69 fuentes 1/1
```

En ejecución (Win32, DLL original):

```text
neuron_golden --zones --dll NeuronVS.dll --db NeuronVS-db/NeuronDB
sound 176 (DangerDrone, load program_change, 0 values differ)  engine …  params …
R1 model 511, R2 model 511  split engine+0x69C = 64.000  p[0x12] = 64.000
…
zones OK
```

`--zones` comprueba: `engine+0x69C == p[0x12]`, flag 0, root 69 en las dos
tablas, cuatro buffers no nulos, `csAN`/`psAN` en el par grave, reservados a 0,
detune 0 y volumen 0 dB = 1.0.

---

## 10. Cadena Completa de Renderizado de Voz y Suma R1 + R2 (`FUN_10039D70` / `FUN_1002E7A0`)

Evidencia extraída del volcado de Ghidra (`_voice_dump/`) sobre la topología de mezcla por voz:

### 10.1 Estructura del Registro de Voz (`0x70 B`)
1. **Poseedor de los motores**: `engine+0xD94` apunta a un array de 129 registros de `0x70 B` (asignados en `FUN_10044884`, `0x10044960`: `operator_new(0x3874) = 4 + 129 × 0x70`, cabecera `0x81`, ctor `FUN_10023074` por registro). La cuenta de voces activas reside en `engine+0xDA0`.
2. **Filtro de voz en el render**: `rec = [engine+0xD94] + [ebp-0xEC]` con `[ebp-0xEC] += 0x70` por voz. Filtra por `rec+0x34 != 0`, `rec+0x44 >= 1`, `rec+0x40 == 1` y la firma de cuatro bytes `'nSAN'`.
3. **Instancias de Resonador**:
   - `rec+0x68`: Instancia de motor Resynator 1 (`[ebp-0x130]`).
   - `rec+0x6C`: Instancia de motor Resynator 2 (`[ebp-0x134]`).
   - Ambos motores pertenecen al *mismo registro de voz* (`rec`).
4. **Pesos de mezcla del Blender**:
   - `rec+0x60`: Ganancia/peso de Resynator 1 (`p6` / `gainA`).
   - `rec+0x64`: Ganancia/peso de Resynator 2 (`p7` / `gainB`).
   - Getters canónicos: `FUN_1003d6c0` (`fld [ecx+0x60]`) y `FUN_1003d6d0` (`fld [ecx+0x64]`), invocados con `ECX = rec`.

### 10.2 Fusión y Suma Ponderada (`FUN_1002E7A0`)
No existe una función «suma R1+R2» externa o independiente. La suma ponderada ocurre **muestra a muestra** dentro de `FUN_1002E7A0`, llamada desde `FUN_10039D70` en `0x1003B49B`:

```c
FUN_1002e7a0(engine, rec, rec+0x68, rec+0x6C, modo /* rec+0x18 */,
             rec->[0x60], rec->[0x64],
             &tmpA /* [ebp-0x1d4] */, &tmpB /* [ebp-0x1d0] */);
```

Dentro de `FUN_1002E7A0`, las muestras individuales $v_A$ y $v_B$ se obtienen mediante:
`*(float*)(*(int*)(rec+0x68|0x6C + 0x150) + 0x20)` (publicados por `FUN_1003b920`, leídos previamente con `FUN_1003b900` en `+0x14`).

La combinación según el modo de Blender (`rec+0x18`):
- **Modo 0 (`Mix`, 0x1002EFF5)**:
  `*p8 = v_B · p7 + v_A · p6` (salida `*p9` idéntica).
- **Modo 1 (`Chromophonic` / Split)**:
  `*p8 = v_A · p7; *p9 = v_B · p6` — cada motor se enruta a su propio canal estéreo/salida sin sumarse.
- **Modo 2 (`Transsphere`)**:
  `f = v_B · p6 + v_A · p7` — fusión a un único bus monoaural.
- **Modo 3 (`Crossmorph`, 0x1002FDAF)**:
  `*p8 = *p9 = v_B · gainA · p7 + v_A · gainB · p6`.
- **Motores desactivados**: Si un motor está apagado (`+0x6836` o `+0x6834 == 0`), los pesos se fuerzan a `(1.0, 1e-9)` o `(1e-9, 1.0)` (`_DAT_1030bb2c/30/34/38`).

### 10.3 Acumulación y Reparto en Buses de 128 Muestras (`0x1003B4A0`–`0x1003B53A`)
1. **Cálculo de ponderación de morphing complementaria**:
   $$w = \operatorname{clamp}(\text{engine}[0x44] \cdot \text{rec}[0x10 + idx] + \text{engine}[0x40]) \cdot 0.5 + 0.5$$
   y su par complementario $(1 - w)$ (`_DAT_1030ced0 = 1.0`).
2. **Acumulación en buffers**:
   ```c
   buf1[0x200 + 4*i] += tmp  * (1 - w);  // Objeto en [ebp-0x13C]
   buf2[0x200 + 4*i] += tmp' * w;        // Objeto en [ebp-0xF4]
   ```
   Ambos buffers de 128 floats (512 bytes) en el offset `+0x200` se reciben como argumentos implícitos del render (a través de la tabla `.data:0x10058D70`).
3. **Cierre de bloque**: Al completar las 128 muestras, se recombinan mediante `FUN_100295d0` / `FUN_10029e34(..., 0x80)`, se limitan rígidamente a $[-1.0, +1.0]$ (`0x3F7FBE77 / 0xBF800000`) y se avanza el contador de muestras `_DAT_10062298`.

### 10.4 Conclusiones para la Arquitectura de `ABDAxionikVS`
- Los pesos de mezcla (`rec+0x60`, `rec+0x64`) residen en el array dinámico de voces del heap (`engine+0xD94`), **no en los 13.948 bytes de la tabla de estado estático**. Por ello, el arnés de verificación diferencial del traductor (`FUN_10040550`) no los compara; lo que sí reside en el estado son las coordenadas de morphing (`engine+0x40`, `engine+0x44`) y `rec+0x10`.
- En nuestro motor C++20 (`NeuronVoice.h`), los 10 modos de Blender implementan exactamente esta misma evaluación por muestra y bloque, pero sustituyendo los `operator_new` dinámicos por el `VoiceMemoryPool` preasignado en tiempo real.
