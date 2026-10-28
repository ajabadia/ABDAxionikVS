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

### La condición del relleno (Resolución de los 106 presets vacíos)

Se ha investigado y verificado a nivel de bytes en el PE de `NeuronVS.dll` por qué 320 de los 351 presets dejan las tablas de zonas a cero en el arnés de prueba, incluyendo 106 presets que cuentan con sus dos modelos completos en el banco extraído:

1. **El disparo es incondicional**:
   El cargador del script `FUN_10013ea0` cierra cada parámetro invocando `FUN_10001170(valor, 6, 0)`. La máscara `6` lleva encendidos el bit 1 (todos los observadores hijos) y el **bit 2**, que en `FUN_10001550` **salta el test de «el valor cambió»**. Por tanto, el observador `0x10013620` se ejecuta incondicionalmente en cada carga de preset, cambie o no `R1ModellIndex` o `R2ModellIndex`. Inmediatamente antes de esto, `FUN_10046ce0` pone a cero (`memset 0`) ambas tablas de zonas.

2. **La guarda del callback (`0x100136D8`)**:
   ```c
   piVar8 = FUN_1000a7d0(iVar4);
   if (piVar8 != 0) { ... }  // je en 0x100136D8
   ```
   Si `FUN_1000a7d0` devuelve nulo (`0`), el callback omite por completo la escritura de los 6 registros de control y las 128 notas de esa capa. La capa se queda con los ceros recién escritos por `FUN_10046ce0`.

3. **Causa raíz: Búsqueda del modelo en el registro de Windows de 32 bits**:
   `NeuronVS.dll` no busca los modelos en `--db` ni en el directorio de trabajo (CWD), sino componiendo la ruta mediante `FUN_10001750` a partir del valor de registro:
   `HKLM\SOFTWARE\Wow6432Node\Hartmann Music\NeuronVS -> NeuronDB`
   En la máquina de prueba, este valor apuntaba a `C:\Program Files (x86)\Hartmann Music\NeuronVS\NeuronDB`, donde el instalador original sólo dejó instalado un único modelo: **`511.model`**.

4. **Desglose exacto de los 351 presets en la DLL original**:
   - **2 presets con 1536 dwords** (768 + 768 dwords, ambas capas rellenas): Presets 176 y 337, donde `R1 = R2 = 511`.
   - **29 presets con 768 dwords** (exactamente una capa rellena con `root 69`, la otra en 0): Presets donde sólo un resonador usa el modelo 511.
   - **320 presets con 0 dwords**: Presets cuyos modelos no están presentes en la ruta del registro HKLM del host. De estos 320:
     - **106 presets** tienen sus dos modelos completos en la biblioteca `NeuronDB` (341 modelos) y se rellenan al 100% cuando el motor lee de la biblioteca correcta.
     - **214 presets** corresponden a modelos que no venían en la instalación original o faltaban de fábrica.

En **`ABDAxionikVS`**, nuestro motor desacoplado no depende de claves de registro obsoletas de Windows de 32 bits: resuelve los modelos a través de `NeuronBankAdapter` desde el directorio canónico `NeuronDB` o embebido (`511`), rellenando de forma robusta las zonas de teclado para todos los modelos disponibles.

## 4.3 El cambio en caliente y los descriptores

Cambiar de preset o de modelo con notas sonando pasa por dos caminos distintos
y ninguno de los dos libera ni realoja un descriptor. La cadena de cada uno:

| Camino | Entrada | Lo que corre, en orden |
|---|---|---|
| preset | `FUN_100132d0` (`0x1000b7f0`, caso `0xc0`) | `FUN_10046ce0` → `FUN_10013ea0` → `FUN_10013ac0` → `FUN_10040550` |
| modelo | `callback_10013620` (observador de `R1ModellIndex`/`R2ModellIndex`) | `FUN_10046b70` → 128 × `FUN_100440d0` → `FUN_1003d780` → `FUN_10040550` |

### Lo primero que hacen las dos: el barrido de `+0x40`

`FUN_100440d0`, `FUN_10046b70` y `FUN_10046ce0` empiezan igual: recorren los
128 slots (`0x70` B de paso, hasta `0x3800`) y escriben **0** en `+0x40`.
Detrás viene el bloque que apagaría las voces vivas —pone a cero el primer y
el tercer `undefined4` de `*([R1|R2]+0x150)`, enciende `+0x6835` y desata el
descriptor (`+0x44`, `+0x40` y `+0x58` a 0)—, pero su condición vuelve a mirar
`+0x40 != 0`, que el barrido acaba de borrar: **no entra nunca**. Es el mismo
apagado de voces muerto que aparece en §4 y en §7, y por eso el porte no tiene
que reproducirlo: basta con el barrido y con apagar `0xD99` mientras se
escribe la tabla.

### Lo que se mide en proceso

`neuron_golden --translate` imprime el testigo antes y después de cada cambio
(y lo comprueba: si el array o los dos motores de la voz atada cambiaran, la
pasada falla). El testigo son el puntero del array, cuántos descriptores están
atados a este motor y cuál es el primero, su byte `+0x40`, los dos motores
R1/R2 de ese descriptor con su puerta `+0x6820`, los bytes de estado y cuántos
dwords de las dos tablas de zonas no son cero. Con el preset 176 (`R1 = R2 =
511`) y la voz de la nota 60 viva, el cambio de preset a 285 da esto:

```text
  antes: e[0xD94]=01748F1C atados=1 [slot 0 +0x40=1] (en construccion 1) R1=0174C908 R2=01753A38 puertas 1/1  0xD98=1 0xD99=1 0xDA4=0.628906 0xDAC=1  zonas=1536
  despues: e[0xD94]=01748F1C atados=1 [slot 0 +0x40=0] (en construccion 0) R1=0174C908 R2=01753A38 puertas 1/1  0xD98=1 0xD99=1 0xDA4=0.5 0xDAC=1  zonas=768
  el cambio de preset no reasigna e[0xD94] ni los motores de la voz atada
```

Lo que dice el testigo, pasada por pasada:

- **`e[0xD94]` no se reasigna con el preset ni con el modelo**: el array de 129
  descriptores es el mismo objeto. Las tres funciones lo leen y ninguna lo
  escribe, y el camino del preset tampoco (chequeo estático en
  `verify_zones.py`).
- **La voz que suena conserva su descriptor y sus dos motores**: el mismo slot,
  los mismos `+0x68`/`+0x6C` y las puertas `+0x6820` = 1/1 antes y después.
  Como la tabla de 128 entradas se lee **al construir la voz** (§6.3),
  reescribirla no cambia lo que ya suena: lo oyen las notas siguientes.
- **El barrido deja el slot ocupado marcado como libre**: el slot 0 pasa de
  `+0x40 = 1` a `+0x40 = 0` mientras la voz sigue sonando. Es el precio del
  barrido; el `en construccion` del testigo cuenta cuántos slots quedan con
  `+0x40 != 0`.
- **El preset borra las dos tablas de zonas y el modelo reescribe una**: el
  cambio de preset las deja a cero (2 × 0x500 dwords) y quien las vuelve a
  llenar después es el callback del modelo, con los modelos que el motor tenga
  cargados (768 dwords por capa llena, 1536 las dos; es lo que se ve arriba al
  pasar a 285). El cambio de modelo reescribe **sólo su capa**, tecla a tecla, y
  no toca la otra.
- **El preset reinicia las globales de morph y el modelo no**: `0xDA4` vuelve a
  0.5 (el bend al centro, y eso sí lo oye la voz que suena), `0xDAC` a 1.0 y
  los ocho contadores `0x365C..0x3678` a cero; `FUN_10046b70` no escribe
  ninguna de esas direcciones (chequeo estático).
- **`0xD99` está apagado durante todo el cambio** y lo vuelve a encender
  `FUN_10040550` al final, así que ninguna nota entra a media escritura;
  `0xD98` (la puerta del motor) no se toca.

### `FUN_10013ea0`: el cargador del script

El paso intermedio del camino del preset lee `Sounds/%03d/sound.script` a un
*buffer* temporal de `count` floats (`soundData+8` = los 445 registros), lo
suelta y, en medio, escribe cada valor con el único escritor de `+0x1c`
(`FUN_10001170`): un barrido con máscara 0 —que no avisa a nadie— y otro con
máscara 6, que sí recorre los observadores del registro (el puntero de origen
es nulo, así que ninguno queda excluido) aunque el valor no cambie. No toca
descriptores ni tablas, no llama al traductor y no llama a los observadores
por su cuenta (chequeos estáticos): de eso se encargan `FUN_10046ce0` antes y
`FUN_10013ac0` + `FUN_10040550` después. Es la razón de que el porte tenga que
reproducir la cadena entera y no la función suelta.

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

### 6.5 Dónde se suman R1 y R2: `FUN_1002e7a0` y los dos buses

El render del bloque es `FUN_100382b0` («el orquestador», 3.648 B): lo llama el
bombeo `0x1000bc40` dos veces por vuelta (`0x1000bcfb` y `0x1000bd97`) con los
dos canales de salida del host y bloques de **128** muestras (`0x1030f6e8` =
128). La convención es `__thiscall` sobre el **engine**: `0x100382da` hace
`mov ecx,[ecx]` y guarda el estado en `[ebp-0x140]`; exige `engine+0xD98` y
`engine+0xD99`, y en la propia entrada **borra 128 dwords (512 B) en cada uno de
los dos buses** (`0x10038333` y `0x10038342`, dos `mov ecx,0x80; rep stosd`).
Los dos buses son los argumentos: bus A (`channels[0]`) → `[ebp-0x13c]`
(`0x1003839a`) y bus B (`channels[1]`) → `[ebp-0xf4]` (`0x10038321`).

Dentro del bucle de voces (`engine+0xDA0` es la cuenta, `engine+0xD94` el array
de descriptores de `0x70` B) el registro que decide la mezcla es la **voz**, y
sus cuatro desplazamientos útiles son estos:

| Campo | Quién lo lee | Qué es |
|---|---|---|
| `voz+0x18` | `FUN_1003d6e0` (`mov eax,[ecx+0x18]`) | selector de rama: 0 = rama del mezclador, ≠0 = rama sin mezclador |
| `voz+0x60` | `FUN_1003d6c0` (`fld [ecx+0x60]`) | peso 1 → multiplica a **R2** |
| `voz+0x64` | `FUN_1003d6d0` (`fld [ecx+0x64]`) | peso 2 → multiplica a **R1** |
| `voz+0x68` | `0x10038411` `mov esi,[eax+edx+0x68]` | motor **R1** (banco `engine+0x284`) |
| `voz+0x6C` | `0x10038415` `mov edi,[eax+edx+0x6c]` | motor **R2** (banco `engine+0x80C`) |

(el mismo bloque guarda los dos punteros en `[ebp-0x130]`/`[ebp-0x134]`, que son
los que viajan a la llamada). Otros dos campos del registro entran también en la
cuenta: `voz+0x10` es el **morph por voz** (`0x1003a21a`, se multiplica por
`engine+0x44` y se suma `engine+0x40`) y `voz+0x4C`/`voz+0x54` sólo los usan los
modos 6…9 como recorte y escala.

El par de pesos va **cruzado** respecto a los motores: el que multiplica la
salida de R1 (`+0x68`) es `+0x64`, y el que multiplica la de R2 (`+0x6C`) es
`+0x60`. No es una errata de esta nota: en el caso 0 del mezclador
(`0x1002effe`…`0x1002f026`) se ve `fld qword [ebp-0x78]` (R1) `fmul qword
[ebp-0x68]` (peso 2 = `+0x64`) y `fld qword [ebp-0x70]` (R2) `fmul qword
[ebp-0x60]` (peso 1 = `+0x60`); y en los valores por defecto de un motor muerto
el peso que cae a 1e-8 es el del motor que falla (§ más abajo).

El sitio de llamada, con los ocho huecos de pila (`add esp,-0x20`) y ECX = engine:

```asm
1003b43a  fld  qword [ebp-0x110]        ; = FUN_1003d6c0(voz) = voz+0x60
1003b44c  fstp dword [esp+0x10]         ; arg5: peso 1 (R2)
1003b450  fld  qword [ebp-0x118]        ; = FUN_1003d6d0(voz) = voz+0x64
1003b462  fstp dword [esp+0x14]         ; arg6: peso 2 (R1)
1003b456  mov  eax,[ebp-0x130]          ; motor R1 (voz+0x68)
1003b46c  mov  [esp+4],eax              ; arg2
1003b45c  mov  edx,[ebp-0x134]          ; motor R2 (voz+0x6C)
1003b476  mov  [esp+8],edx              ; arg3
1003b466  mov  ecx,[ebp-0x144]          ; *engine = modo
1003b480  mov  [esp+0xc],ecx            ; arg4
1003b484  mov  ecx,[ebp-0x138]          ; la voz (descriptor)
1003b48e  mov  [esp],ecx                ; arg1
1003b491  mov  ecx,[ebp-0x140]          ; this = engine
1003b49b  call 0x1002e7a0
```

Los dos acumuladores son locales del render: `[ebp-0x1d4]` (arg7) y `[ebp-0x1d0]`
(arg8), y el modo es **`*engine`** con una sola indirección (`0x1003a296`
`mov eax,[eax]` desde el estado).

#### `FUN_1002e7a0`: un caso por modo

El mezclador es `__thiscall` sobre el engine (su primera instrucción útil prueba
`[ecx+0xD98]`, `0x1002e7ba`) y limpia **0x20 B** (`ret 0x20` en `0x1002e7d8`):
this + ocho argumentos. Los dos pesos entran como `qword` y se guardan en
`[ebp-0x60]` = arg5 (`voz+0x60`) y `[ebp-0x68]` = arg6 (`voz+0x64`); los dos
motores, en `[ebp-0x18]` (arg2 = R1) y `[ebp-0x1a0]` (arg3 = R2). El despacho es
un salto sobre la tabla de diez entradas de `0x1030bb04`, indexada por arg4:

```asm
1002e87e  mov  eax,[ebp+0x14]          ; arg4 = *engine
1002e881  cmp  eax,9
1002e884  ja   0x1002f1b7             ; fuera de 0..9: sale sin tocar los acumuladores
1002e896  mov  eax,[eax*4+0x1030bb04]
1002e8a8  jmp  eax
```

| Modo | Cuerpo | Qué escribe en los dos acumuladores |
|---|---|---|
| 0 | `0x1002e8aa` | `R1×peso2 + R2×peso1` (la suma de los dos motores, en los dos) |
| 1 | `0x1002f02b` | **reparto**: `R1×peso2` en el 1º y `R2×peso1` en el 2º |
| 2 | `0x1002f0ea` | una sola cifra (dos lecturas ponderadas y sumadas dentro de la cifra) |
| 3 | `0x1002f0f8` | suma de dos términos, uno por motor |
| 4 | `0x1002f106` | una cifra de cruce entre las dos lecturas |
| 5 | `0x1002f114` | una cifra ponderada más un segundo término |
| 6 | `0x1002f156` | una cifra, con recorte por `voz+0x4C` |
| 7 | `0x1002f161` | suma de dos términos |
| 8 | `0x1002f17b` | como 7, con `peso1 ×= voz+0x54` |
| 9 | `0x1002f192` | suma de dos términos, con el mismo `voz+0x54` |

En los diez, las **dos asignaciones finales son la misma expresión** salvo en el
modo 1: el mezclador sólo distingue los dos acumuladores en el reparto. (Ese par
es la *entrada* de la etapa por voz: el render lo sustituye por el retorno de
`FUN_1003d6f0` salvo en el modo 1, ver más abajo.) Lo que
cambia de un modo a otro es el juego de lecturas por motor — `FUN_100317b0`
(el `CurveReader`: fase en `motor+4`, incremento en `+0x15C`, tabla en `+0x6414`)
una o dos veces, `FUN_10031950` (el `BandReader`) y el contador `motor+0x16C` —
siempre contra el par de pesos `+0x60`/`+0x64`. La contribución de cada motor es
`lector(curva) × volumen del motor` (`[motor+0x150]+0x20`, leído al entrar).

Los dos pesos no son fijos: si a un motor le falta `+0x6834` (par `.scape`/
`.sphere` compatible) o `+0x6836`, el par se sustituye por los valores por
defecto de `0x1030bb2c` (1.0) y `0x1030bb30` (**1e-8**) — y **cada motor apaga el
suyo**, no el del otro: R1 muerto deja `peso1 = 1.0` y `peso2 = 1e-8`; R2 muerto,
al revés. Ese 1e-8 es el mismo «casi-cero» con el que el render inicializa los
acumuladores (`DAT_100550d0 = (rand() × 6.1037e-05 − 1.0) × 1e-08`, calculado en
la entrada del render con `0x10021518` = thunk de `rand`): silencio con dither,
no un cero.

#### La suma que acaba en los buses

Vuelto de la llamada, el render hace la cuenta que de verdad llega a la salida:

```asm
1003b4a0  fld  dword [ebp-0x1d0]        ; acumulador 2
1003b4a6  fadd dword [ebp-0x1d4]        ; + acumulador 1
1003b4ac  fmul dword [0x1030cef4]       ; × 0.5 = la media
1003b4cc  call 0x1003d6f0               ; FUN_1003d6f0(voz, engine, media)
1003b4d4  mov  eax,[ebp-0x144]          ; modo
1003b4da  cmp  eax,1
1003b4dd  je   0x1003b4eb              ; modo 1: se conserva el reparto
1003b4df  fst  dword [ebp-0x1d0]        ; si no: los dos = retorno de la etapa
1003b4e5  fst  dword [ebp-0x1d4]
1003b4ed  fld  qword [ebp-0x120]        ; W
1003b4f3  fmul dword [ebp-0x1d0]
1003b4f9  fld  qword [ebp-0x128]        ; 1 − W
1003b4ff  fmul dword [ebp-0x1d4]
1003b507  fstp dword [ebp-0x1d0]        ; = W × acumulador 2
1003b50d  fst  dword [ebp-0x1d4]        ; = (1-W) × acumulador 1
1003b519  fadd dword [eax + esi*4 + 0x200]   ; bus A += (1-W) × acumulador 1
1003b52d  fld  dword [edi + esi*4 + 0x200]
1003b534  fadd dword [ebp-0x1d0]             ; bus B += W × acumulador 2
```

`FUN_1003d6f0` es la etapa por voz colgada de `engine+0x27C` (usa el buffer de
`0x19` dwords en `voz+0x30` y se salta si `[engine+4] < 0x1030d9f8`); sólo el
**modo 1** descarta su retorno. Así que, en cifras:

- modo 1: **bus A += (1−W)·R1·peso2** y **bus B += W·R2·peso1**;
- modos 0 y 2…9: los dos acumuladores se sustituyen por el retorno de la etapa
  (que recibe la media como argumento), así que los dos buses reciben el
  **mismo** valor: ×(1−W) en A y ×W en B.

Los dos pesos globales salen del morph: `W = clamp(engine+0x44·voz+0x10 +
engine+0x40, −1, +1)·0.5 + 0.5`, acotado a 1.0, y `1−W` calculado contra 1.0
(`0x1030cec0`/`0x1030cec4` = ±1.0, `0x1030cec8`/`0x1030cecc` = 0.5,
`0x1030ced0` = 1.0, `0x1030ced4`/`0x1030ced8` = 1.0, `0x1030cedc`/`0x1030cee0` =
1.0). Con `W` y `1−W` complementarios, morphear de un extremo al otro cruza **R1
(canal A) → R2 (canal B)** en el modo 1, y en los demás modula la misma señal en
los dos canales.

#### Los buffers: la ranura es la base, no `+0x200`

La instrucción dice `[eax+esi*4+0x200]` y `[edi+esi*4+0x200]`, pero el contador
del bloque arranca en **−0x80** (`0x1003b380` `mov esi,0xffffff80`, `inc esi` /
`jne` en `0x1003b546`) y va subiendo hasta −1: el `+0x200` de la codificación
es un plegado del compilador y la ranura real es `(esi+0x80)`, es decir
**base + 0…+0x1FF** del objeto — exactamente el bloque de 128 dwords que la
entrada borra y el que el bombeo lee después para pasarlo a las salidas del host
(con el saneado de NaN/inf de `0x1000bd31`). No hay un segundo buffer a
`+0x200`: el «buffer +0x200» que aparecía antes en las notas es esta cuenta.

Con las voces ya sumadas, el cierre del bloque no toca la suma: si alguna voz
tiene `voz+0x18 == 1` llama a `FUN_10029530(engine+0x3658, 0x80, busA, busB)`
(`0x1003a3e4`), luego escala **los dos** buses por el doble **24.0**
(`0x1030cdc0`/`0x1030cdc8`, con un desplazamiento de una muestra en el bus B) y
pasa el par por `FUN_100295d0` y `FUN_10029e34` (0x80 muestras cada una,
`0x1003a48e` y `0x1003a4bf`). Esa cadena y el lazo de estado `engine+0x3658`…
`engine+0x3678` que viene después ya son la etapa de salida, no el mezclador.

#### Lo que esto corrige de lo anterior

1. **Los buffers no están a `+0x200`** (§ arriba): índice de −0x80 a −1.
2. **Una muestra por motor y por ranura**, no cinco submuestras: el mezclador
   llama a `FUN_100317b0` una o dos veces por motor y por llamada, y las 128
   ranuras del bloque son las 128 muestras de salida que verá el host.
3. **El par `+0x60`/`+0x64` va cruzado** con `+0x68`/`+0x6C`.
4. El «render por capa» del rango `0x10039xxx` (`FUN_10039100` y compañía) no es
   el que mezcla: el que mezcla es **`FUN_100382b0`** con `FUN_1002e7a0` dentro.
   Aquellas funciones recorren el mismo array pero no llaman al mezclador.

## 7. Lo que queda abierto

- **Pan**: se parsea y se guarda en el registro (`+0x2c`), pero no entra en la
  tabla de 128 entradas. Falta encontrar el camino que lo aplica.
- **`+0x18`**: el consumidor lo usa, pero `FUN_100440d0` siempre lo pone a 0.
  Si en el diseño original existía un "fine tune" por zona, este camino no lo
  rellena.
- **Quién escribe el modo `*engine`.** El mezclador baraja diez casos con el
  primer dword del estado (§6.5), pero no se ha trazado qué camino del preset o
  de la UI lo deja en 0…9, ni qué escena corresponde a cada caso (el 1 es el
  único que reparte R1/R2 entre los dos canales; los otros nueve escriben la
  misma cifra en los dos acumuladores).
- **Quién escribe `voz+0x60`/`+0x64`.** Se leen con `FUN_1003d6c0`/`FUN_1003d6d0`
  y son los pesos por motor del mezclador, pero no se ha encontrado el escritor:
  no están en el bloque de 0x588 B ni en la tabla de 128 entradas.
- **El modo 1 llama igual a `FUN_1003d6f0`** (la etapa por voz de
  `engine+0x27C`) y luego descarta su retorno (`0x1003b4dd`). No se sabe si la
  etapa se usa como calentamiento a propósito o es un resto del diseño.
- **`FUN_10029530` / `FUN_100295d0` / `FUN_10029e34`.** Son el cierre del bloque
  (0x80 muestras sobre los dos buses) y quedan sin desmenuzar, igual que la
  escala de 24.0 y el desplazamiento de una muestra del bus B.
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
  §4.3 cuenta qué implica con notas sonando y cómo se mide.

## 8. Cómo se comprueba

Estático (no necesita el DLL):

```text
python NeuronVS_dsp/tools/verify_zones.py
121/121 comprobaciones OK

python NeuronVS_dsp/tools/verify_r1r2_mix.py
53/53 comprobaciones OK
```

El primero cubre el camino modelo → tabla → call site de la voz; el segundo, la
suma R1/R2 de §6.5 (entrada del render, registro de voz, mezclador, buses). Con
`-v` los dos listan cada comprobación. Las que sostienen §6.5:

```text
ok  FUN_100382b0: [ebp-0x140] = [ecx]  (this = engine)
ok  arg3 (bus B) -> [ebp-0xf4] / arg2 (bus A) -> [ebp-0x13c]
ok  la entrada borra 128 dwords (512 B) en cada bus
ok  un solo call a FUN_1002e7a0, en FUN_100382b0 (0x1003b49b)
ok  arg1 = descriptor y this = ECX = engine
ok  arg2 = [ebp-0x130] (motor R1) y arg3 = [ebp-0x134] (motor R2)
ok  voz+0x68 y voz+0x6C (los dos motores) salen del registro a esos locales
ok  arg5 = voz+0x60 y arg6 = voz+0x64 (los dos pesos)
ok  FUN_1003d6c0 = fld [ecx+0x60] / FUN_1003d6d0 = fld [ecx+0x64]
ok  si voz+0x18 == 0 va a la rama del mezclador (0x1003b380)
ok  switch sobre arg4 = *engine, 10 casos via 0x1030bb04
ok  la tabla apunta a los diez cuerpos de caso
ok  los valores por defecto de un motor muerto son (1.0, 1e-8) y (1e-8, 1.0)
ok  caso 0: R1 x peso2 (+0x64) y R2 x peso1 (+0x60), sumados en los dos
ok  caso 1: R1 x peso2 en un acumulador y R2 x peso1 en el otro
ok  cada motor aporta su lectura de curva (FUN_100317b0)
ok  solo en el modo 1 se conservan los dos valores
ok  bus A += (1-W)*acumulador1 y bus B += W*acumulador2
ok  el indice del bloque va de -0x80 a -1: el +0x200 es un plegado
ok  W = morph*0.5 + 0.5 y 1-W = 1.0 - W, con las constantes del PE
ok  el cierre: 0x10029530, la escala 24.0 y 0x100295d0 / 0x10029e34
ok  DAT_100550d0 = (rand * 6.1037e-05 - 1.0) * 1e-08 (dither de silencio)
ok  el tamano de bloque es 128 y el proceso sanea NaN/inf tras el render
```

Las que sostienen §4.3 (el cambio en caliente):

```text
ok  el cambio de preset encadena 46ce0 -> 13ea0 -> 13ac0 -> 40550
ok  el cargador lee el script a un buffer temporal y lo suelta
ok  el cargador no llama a los observadores: lo hacen los setters de cada valor
ok  FUN_10046ce0 borra las dos tablas de zonas (0x500 dwords cada una)
ok  y resetea 0xDAC = 1.0f / y 0xDA4 = 0.5f (el bend vuelve al centro)
ok  y los ocho contadores de morph 0x365C..0x3678 / y apaga 0xD99
ok  FUN_10046b70 no borra las tablas ni toca las globales: eso es solo del preset
ok  FUN_100440d0, FUN_10046b70 y FUN_10046ce0: el borrado de +0x40 va antes del test
ok  ninguna de las tres escribe e[0xD94]: el array de descriptores no se reasigna
ok  ni lo reasigna el camino del preset
ok  el callback del modelo termina en 0x1003d780 y 0x10040550
ok  la tabla se reescribe entera con una llamada por tecla a FUN_100440d0
```

Y las que sostienen §6 (modelo → registro → tabla → call site de la voz):

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
