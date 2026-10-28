# Los callbacks de observador: los 4 que faltaban y el universal

`params` instala callbacks con operandos inmediatos dentro de su constructor
`FUN_1000be10`. Ghidra sólo creó como función el primero (`0x10013620`, documentado en
[`../NeuronVS_preset_format/OBSERVER_CALLBACK.md`](../NeuronVS_preset_format/OBSERVER_CALLBACK.md));
entre `FUN_100134e0` (que termina en `0x100135CD`) y `FUN_10013a80` quedaba un hueco de
1.200 B con **4 rutinas más** que sólo se referencian por dirección. Este paquete las
recupera desde los bytes del PE y las verifica.

| Callback | Rango real | Nombre | Quién lo instala |
|---|---|---|---|
| `0x10013620` | `0x10013620..0x100139AC` (909 B) | `ModelIndexChange` | `params+0xA5` → observador `0x280`, `+0x14` |
| `0x100135d0` | `0x100135d0..0x100135FB` (44 B) | `stModDest` | `params+0x70+i*0x18` (bucle de 6) |
| `0x10013600` | `0x10013600..0x1001361B` (28 B) | `stModDepth` | `params+0x100+i*0x18` (bucle de 6) |
| `0x100139b0` | `0x100139b0..0x100139C9` (26 B) | `stGPEngineCb` | `params+0xAB` → observador `0x298`, `+0x14` |
| `0x100139d0` | `0x100139d0..0x10013A79` (170 B) | `stSPEngineCb` | materializado una vez y reutilizado por los 317 observadores siguientes |

Los cinco terminan en `ret` seguido de relleno (`90 90 90 90`), que es lo que fija sus
finales: `0x10013A7A`, `0x100135FC`, `0x1001361C`, `0x100139CA` y `0x100139AD`.

## La convención de llamada

`FUN_10001550` invoca `(**(code **)(observador + 0x14))(&value_pair, record, observador + 8)`.
Es decir: `arg1` = par `{valor_anterior, valor_nuevo}`, `arg2` = registro de 40 B que
cambió, `arg3` = puntero al campo `+0x08` del observador, cuyo primer dword es el
contexto de 16 B. Eso se ve en el arranque de cada callback, p. ej. `stModDest`:

```asm
100135d0  mov  eax, dword ptr [esp + 0xc]      ; arg3
100135d7  mov  esi, dword ptr [eax]            ; ctx = *arg3  -> ctx[0] = params
100135d9  mov  edi, dword ptr [eax + 4]        ; ctx[1] = índice del control (0..5)
100135dc  mov  eax, dword ptr [esp + 0x10]     ; arg2 (registro)
100135e0  mov  ebx, dword ptr [esi + edi*4 + 0x14]   ; destino antiguo
100135e4  fld  dword ptr [eax + 4]             ; value_pair[1]
100135e7  call 0x100213a6                      ; ftol
100135ef  mov  dword ptr [esi + edi*4 + 0x14], eax   ; nuevo destino
100135f3  call 0x100134e0                      ; recalcular el destino antiguo
```

## Qué hace cada uno

### `0x100139b0` — observador preliminar (`stGPEngineCb`)

```asm
100139b0  mov  eax, dword ptr [esp + 0xc]      ; arg3
100139b4  mov  eax, dword ptr [eax]            ; ctx
100139b6  mov  ecx, dword ptr [eax + 8]        ; ctx[2] = slot
100139b9  mov  edx, dword ptr [eax]            ; ctx[0] = params
100139c2  mov  dword ptr [edx + ecx*4 + 0x2788], eax   ; p_preliminar[slot] = value_pair[1]
```

Escribe en `params+0x2788`, **cuatro bytes antes** de `p[]` (`+0x278C`): es el slot
intermedio que el ctor asocia al observador `0x298` (la segunda mitad del truco de
`R1/R2ModellIndex`).

### `0x100139d0` — el callback universal de parámetros (`stSPEngineCb`)

Es el que reciben 317 de los 335 enganches. El volcado completo está en
[`functions/100139d0_stSPEngineCb.asm`](functions/100139d0_stSPEngineCb.asm); sus
referencias internas (verificadas) son:

- `call 0x100134e0` — «ha cambiado un parámetro modulable» (recalcula modulación y llama
  al traductor);
- `call 0x10040550` — el traductor, con `params+0x278C` como argumento;
- desplazamientos `+0x17C` (valores base de los 63 destinos), `+0x278C` (`p[]`),
  `+0x0C` y `+0x10` (los dos casos especiales de `R1AmpEnvR` / `R2AmpEnvR`).

Con esto, el camino «cambia un registro de `snddat` → cambia `p[slot]` → traduce» queda
cerrado: el slot lo escribe el callback, no `FUN_100134e0` (que sólo recalcula).

### `0x100135d0` / `0x10013600` — los 6 controles de ejecución

Se instalan desde el bucle de 6 del ctor (las filas 3 y 4 del mapa), que es el que
produce los **12** ganchos de los controles:

- `stModDest` lee `params[idx*4+0x14]`, escribe el nuevo destino y llama a
  `FUN_100134e0(params, destino_antiguo)`;
- `stModDepth` escribe `positions_pair[1]` en `params+0x2C+idx*4` y llama a
  `FUN_100134e0(params, -1)`.

### `0x10013620` — cambio de modelo

Ya documentado en `NeuronVS_preset_format`: reescribe seis registros, re-registra las
128 entradas del modelo en el motor y termina en el traductor. Aquí sólo se comprueba el
rango real (909 B, más largo que el hueco que sugiere el índice) y que sigue siendo el
callback del observador `0x280`.

## Cómo los seis controles producen los 63 destinos (`FUN_100134e0`)

Los callbacks de arriba sólo **escriben registros**; quien los combina con la matriz es
`FUN_100134e0` (`0x100134E0..0x100135CC`, 73 instrucciones, `ret 4`: `__thiscall` con un
único argumento en la pila).  Es el único sitio donde los seis controles tocan `p`.

Los tres registros de cada control viven en `params`:

| Offset | Qué es | Quién lo escribe |
|---|---|---|
| `+0x14 + c*4` | índice de destino (0..62) del control `c` | `stModDest` (`0x100135d0`) |
| `+0x2C + c*4` | profundidad con la que lo modula | `stModDepth` (`0x10013600`) |
| `+0x44 + c*4` | valor actual | `FUN_10013490` (CC 1..4, CC 11 y presión) |

Y los tres arrays de la matriz:

| Offset | Qué es | Quién lo escribe |
|---|---|---|
| `+0x17C + d*4` | valor **base** del destino `d`: 63 floats (`0x17C..0x277`) | el universal `stSPEngineCb` |
| `+0x278C + s*4` | `p[s]`, valor efectivo del slot `s`: 335 dwords (`0x278C..0x2CC7`) | `FUN_100134e0` |
| `0x10049E00 + d*4` | slot de `p` del destino `d`: 63 enteros + terminador `0` | `.rdata` |

La **ventana de recorte** de un destino es el registro de 24 B de su slot,
`params+0x2B0+slot*0x18` (`+0x00` mínimo, `+0x04` máximo) — el mismo bloque donde vive el
observador de ese slot: la rejilla de slots empieza en `0x2B0` porque las dos primeras
entradas (`0x280`, `0x298`) son los observadores preliminares del modelo.  Por eso, en el
mapa, cada fila con slot conocido cumple `obs_offset_hex = 0x2B0 + slot_in_p*0x18` (317 de
las 335 filas; las demás no declaran slot) y el destino es sólo otra columna de la fila.

El cuerpo, en el orden del desensamblado
([`functions/100134e0_FUN_100134e0.asm`](functions/100134e0_FUN_100134e0.asm)):

```asm
100134ea  lea edi, [ecx + 0x14]           ; ecx = params; edi recorre los 6 destinos
100134ed  mov bl, 1                       ; b_cambio = 1
100134f6  mov eax, [esi]                  ; destino[c]
100134ff  cmp edx, eax / jne / xor bl, bl ; si el que cambió es uno de los seis, bl = 0
10013505  mov edx, [ecx + eax*4 + 0x17C]  ; base[destino]
10013510  mov [esp + eax*4 + 0x14], edx   ; af[destino] = base (63 floats en la pila)
1001351e  mov edx, [eax - 0x30]           ; eax = params+0x44+c*4 -> destino[c] (0x14)
10013521  fld [eax - 0x18]                ; profundidad[c] (0x2C)
10013524  fmul [eax]                      ; * valor[c] (0x44)
1001352e  fadd [edx] / fstp [edx]         ; af[destino] += prof*valor
10013539  mov eax, [edi]                  ; destino[c]
1001353b  mov edx, [eax*4 + 0x10049E00]   ; slot = tabla[destino]
10013542  lea esi, [edx + edx*2]          ; 3*slot
10013545  fld [ecx + esi*8 + 0x2B0]       ; mínimo de la ventana (24*slot)
1001354f  fcom [esp + eax*4 + 0x14]       ; ¿af < mínimo? ... y luego ¿af > máximo?
1001357f  fstp [ecx + edx*4 + 0x278C]     ; p[slot] = recorte(af)
1001358f  test bl, bl / je 100135B0       ; ¿el que cambió es uno de los seis?
10013594  mov eax, [esp + 0x104]          ; el argumento, tal cual
1001359b  mov edx, [eax*4 + 0x10049E00]   ; tabla[param_2]
100135a2  mov eax, [ecx + eax*4 + 0x17C]  ; base[param_2]
100135a9  mov [ecx + edx*4 + 0x278C], eax ; p[slot] = base (copia cruda, SIN recortar)
100135b0  lea edx, [ecx + 0x278C] / mov ecx, [ecx + 0x27C] ; holder y p
100135bf  call 0x10040550                 ; traducir: FUN_10040550(holder, 0, p)
```

Es decir:

```text
p[tabla[d]] = recorte(base[d] + Σ_c prof[c]*valor[c], mínimo[slot], máximo[slot])
              para los seis destinos d = destino[0..5]
p[tabla[x]] = base[x]                      si el parámetro que cambió (x) no es uno de esos seis
FUN_10040550(holder, 0, p)                 una sola vez, al final
```

### El `param_2 = -1` de los controles escribe fuera de `params`

`FUN_10013490` (CC) y `stModDepth` llaman a `FUN_100134e0(params, -1)`: el camino está
pensado para «ha cambiado un parámetro que no es un destino», pero la rama de arriba **no
comprueba el índice**.  Con `-1` lee `tabla[-1]` (el dword anterior a la tabla,
`0x10049DFC` = **424**) y `base[-1]` = `params+0x178`, que es el campo `+0x14` del sexto
registro de `stModDepth` (`0xEC + 5*0x18 + 0x14`), donde el constructor escribió su propio
puntero (`0x10013600`).  La copia cae en `params+0x278C+424*4 = params+0x2E2C`, y `params`
es un `operator_new(0x2CDC)` de `FUN_1001b140`: **0x150 B más allá del final del objeto**,
en cada CC y en cada movimiento de profundidad.  El arnés lo lee de la DLL en memoria
después de mover un control (`M3` de [`matrix_runtime.log`](matrix_runtime.log)) y la
aritmética se comprueba contra el PE en `J6` de `verify_observers.py`.

#### Qué se lleva por delante ese write: el `ctx[3]` de un destino

`params+0x2E2C` no es un hueco muerto.  Es el `+0x0C` del bloque de contexto que el
allocator deja justo detrás de `params` (`params+0x2E20`), y ese `+0x0C` es **`ctx[3]`**,
el índice de destino que el callback universal lee nada más entrar (`mov eax, [esi+0xC]`).
Cuando un bloque de contexto cae ahí —y por eso la rejilla de `params+0x2B0` y el bloque
comparten formato de 16 B— el primer `FUN_100134e0(params, -1)` (un CC, un movimiento de
profundidad o el propio cargador del preset) deposita `ctx[3] = 0x10013600` y ese
parámetro **pierde el enganche a la matriz**: en la siguiente notificación el universal
toma la rama `jl 0x10013A56` (índice > 62) y escribe `p[slot]` a pelo, sin recorte ni suma
de los seis controles.  Es un cambio de comportamiento audible y silencioso: la GUI no
cambia, la modulación de ese destino sí.

Cuál de los 63 destinos lo sufre depende de dónde caiga el bloque, así que cambia de
corrida a corrida: el barrido ve `63/63` casi siempre y `62/63` con un destino
desenganchado en algunas: `R2Volume`/slot 74, `R2Semi`/81, `R2L1Scape2Value`/99,
`R2L1Sphere2Value`/90 y `R2L2Sphere1Value`/107, siempre contextos de R2 en esas corridas
(5 de 5; con 26 de los 63 destinos en R2, es una pista del orden en que el heap entrega
los bloques, no una regla — y dentro de una corrida es siempre el mismo destino para
todos los presets, porque el bloque no se mueve).
`M1` los cuenta aparte y `M1b` comprueba el mecanismo en vez de tolerar
cualquier valor: el `ctx[3]` tiene que valer exactamente `base[-1]` y el bloque tiene que
estar en `params+0x2E20`.  Es la prueba en caliente de que el write fuera del objeto no
cae en terreno libre.

### Los 63 destinos

La tabla tiene 63 enteros (la entrada 64 es el terminador `0`) y cada uno es el slot de
`p` de un destino, en el mismo orden en que el constructor asigna `ctx[3] = d` a los
observadores.  Son:

| Índices | Destinos |
|---|---|
| 0, 14 | `R1Volume`, `R2Volume` |
| 1, 15 | `R1Semi`, `R2Semi` (única ventana `[-24, 24]`) |
| 2–13, 16–27 | las seis capas de cada motor: `R1`/`R2` × `L1`/`L2`/`L3` × `Scape1/2`, `Sphere1/2` |
| 28–31, 40–43 | `R1ResEnvA/D/S/R`, `R2ResEnvA/D/S/R` |
| 32–35, 44–47 | `R1AmpEnvA/D/S/R`, `R2AmpEnvA/D/S/R` |
| 36–39, 48–51 | `R1FreeEnvA/D/S/R`, `R2FreeEnvA/D/S/R` |
| 52–55 | `FilterEnvA/D/S/R` |
| 56–62 | `BlenderAmount`, `SlicerDepth`, `SlicerRate`, `LFODepth`, `LFORate`, `FilterFreq`, `FilterReso` |

No todos se usan: los 351 presets instalados enganchan **26 destinos distintos** (sobre
todo los volúmenes, las capas Scape/Sphere, el morph de `BlenderAmount`, el slicer, los
LFO y el filtro, más `R1AmpEnvA` y `FilterEnvA`); el resto —los demás tiempos de
envolvente— sólo se alcanzan re-rutando un control en la GUI, que es lo que escribe
`stModDest`.

## Verificación

`tools/verify_observers.py` comprueba, sin usar el descompilado:

- `H1`: los cinco rangos desensamblan **sin huecos** desde su inicio exacto hasta el
  `ret` final (242, 18, 9, 8 y 55 instrucciones);
- `H2`: las referencias internas declaradas arriba (`0x2788`, `0x14`, `0x2C`, `0x17C`,
  `0x278C`, `0x0C`, `0x10` y las llamadas a `0x100134e0` / `0x10040550`);
- `I1`–`I4`: que el ctor contiene el inmediato `0x10013620` una sola vez, el `0x100139b0`
  una sola vez, los dos de control una vez cada uno (se ejecutan 6 veces dentro del
  bucle) y el universal `0x100139d0` una sola vez (lo reutiliza desde un registro);
- `E4`: que los callbacks de las dos filas del bucle son los que el ctor instala de
  verdad (`mov [reg+0x70], 0x100135d0` y `mov [reg+0x100], 0x10013600`);
- `J1`–`J6`: la traza de `FUN_100134e0` contra su desensamblado (los tres registros de
  cada control, los 63 valores base, la tabla leída dos veces, la ventana
  `0x2B0+slot*0x18`, la rama del parámetro que cambió sin comprobar el índice, el
  `param_2 = -1` que escribe fuera del objeto y la llamada final al traductor).

Y en caliente, contra la DLL cargada, `neuron_golden --matrix`
([`matrix_runtime.log`](matrix_runtime.log), con su verificador
[`tools/verify_matrix.py`](tools/verify_matrix.py)):

- `M1`: los 63 destinos tienen su contexto `{params, slot, dest}` y el callback
  `0x100139d0` en el registro de su slot (63/63 en cada preset, más los desenganchados por
  el write fuera del objeto cuando el heap coloca ahí un bloque; ver arriba);
- `M1b`: `base[-1]` (`params+0x178`) es el puntero `0x10013600` que el ctor deja en el 6.o
  registro de `stModDepth`, y los destinos que `M1` cuenta como desenganchados están en
  `params+0x2E20` con `ctx[3]` = ese mismo valor;
- `M2`: al mover cada control por MIDI, los seis slots de destino quedan exactamente en
  `recorte(base + prof*valor)` y los otros 329 no se mueven;
- `M3`: `params+0x2E2C` (fuera del objeto) recibe el valor de `params+0x178`;
- `M4`: una base fuera de ventana recorta por los dos extremos;
- `M5`: `FUN_100134e0(params, d)` con un destino que no es de los seis copia la base
  **sin recortar**;
- `M6`: **desenganche y paridad de slots port vs. DLL sobre los 351 presets**:
  Carga el mismo preset en el `ModMatrix` del port (`applyVersionMigration` + `load_preset`), alimentando previamente los seis valores de control de `params+0x44` del DLL (sin ellos, el preset 176 dest 58 discrepaba por falta del sumando $\text{prof} \times \text{valor}$). Contrasta:
  1. Qué destinos están desenganchados en cada lado (`ctx[3]` fuera de `0..62`).
  2. Los 63 slots de destino de `p[]`: donde el enganche coincide en ambos lados, el valor es idéntico bit a bit (tolerancia 1 ULP).

El barrido de los 351 presets instalados deja **6237 comprobaciones de arnés, 0 fallos** (los 351 `M1b` y 351 `M6` incluidos; 21.411 slots bit a bit comparados), y el verificador del log (`tools/verify_matrix.py`) pasa **15/15 verificaciones (`V1`–`V10`)** (donde `V8` vigila la aritmética del desenganche y `V10` exige la coincidencia estricta de la pasada M6).

## Límites

- El *cuerpo* de `0x10013620` (242 instrucciones) no se ha revisado aquí línea a línea;
  su semántica está en `NeuronVS_preset_format/OBSERVER_CALLBACK.md`.
- **Resolución de los dos casos especiales de `stSPEngineCb` (`ctx[2] == 0xA4` y `0xC2`, slots 164 y 194 = `R1AmpEnvR` y `R2AmpEnvR`)**:
  - **Lectores de `params+0x0C` y `params+0x10`**: Se ha completado el análisis estático de referencias cruzadas y la sonda dinámica en caliente (`neuron_golden --mirror`). Aunque `FUN_100343e4` (`CSilverRack::UpdateParams`) copia esos dos offsets hacia el sub-objeto de Silver, **ninguna rutina DSP ni proceso de audio los lee jamás**. Son campos espejo inertes (*dead mirrors*), sin influencia alguna en el renderizado de audio.
  - **Constante `0x10049f00` (`0x3FA42850A142850A`)**: Se ha aclarado su origen físico: es exactamente `1.0 / 25.4` ($\approx 0.03937007874$), que representa 1 milímetro expresado en pulgadas. En los registros 21 y 32 de `snddat`, las cotas de relajación de envolvente se miden en milímetros y se convierten a pulgadas al guardarse en `p[164]` y `p[194]`. La condición verifica si el valor actual supera el umbral físico de 1 mm.
  - **Régimen de calentamiento de `NeuronVS.dll`**: La DLL original altera su régimen interno entre la 3ª y la 4ª carga de preset (las primeras 3 cargas renderizan bit-idéntico, pero a partir de la 4ª sufren un desplazamiento de $\sim 0.267$ por acumulación de estado estático). En cualquier test de audio diferencial automatizado, deben descartarse los primeros 4 renders como calentamiento (*warm-up*).
- `ctx[2]` como «slot» y `ctx[3]` como «mod_dest_idx» ya no es sólo una lectura que
  encaje: el arnés lo comprueba en la rejilla cargada (63/63 contextos con su slot, su
  destino y su callback), pero sigue sin ser una prueba de tipos del compilador.  Además,
  `ctx[3]` no es inmutable en marcha: el write de la rama `-1` lo pisa cuando el bloque
  cae en `params+0x2E20`, así que una lectura tardía de ese campo no prueba que el ctor
  lo escribiera.

## Replicación y Verificación en el Port C++ (`NeuronVS_port`)

El mecanismo de desenganche de `ctx[3]` ha sido replicado fielmente y verificado en el port (`include/neuron/mod_matrix.hpp` y `src/mod_matrix.cpp`):
1. **Imagen canónica contigua**: Portada sobre la misma geometría de memoria que el binario original: los `0x2CDC` bytes de `params` con `base[63]` en `+0x17C`, `p[335]` en `+0x278C`, ventanas en `+0x2B0 + slot*0x18` y los 63 bloques de contexto de 16 B contiguos en `+0x2E20`.
2. **Escritura fuera de objeto en la rama -1**: `combine(-1)` lee `tabla[-1]` (424, en `.rdata:0x10049DFC`) y `base[-1]` (`params+0x178`, campo callback del 6.º registro de `stModDepth`) y escribe en `params+0x2E2C` (`ctx[3]` del bloque).
3. **Pérdida de enganche a la matriz**: Ese observador toma la rama `dest < 0 || dest > 62` y escribe `p[slot]` en modo crudo: sin base, sin la suma de los seis moduladores y sin recorte. `set_control_depth()` y `set_control_value()` lo disparan como `stModDepth`/`FUN_10013490`, mientras que `set_control_destination()` recombina el destino anterior como `stModDest` sin dispararlo.
4. **Decisión de diseño determinista**: El port desacoplado no depende del heap de Windows, por lo que fija la víctima siempre en el bloque del destino 0 (`R1Volume`), a diferencia del DLL que la sortea en cada ejecución según la asignación del heap.
5. **Verificación automatizada (100% verde)**:
   - `gen_mod_matrix.py --check`: Regenera `mod_matrix.inc` cruzando contra el PE sin derivas.
   - `mod_matrix_probe.cpp`: 12 comprobaciones de geometría (`0x2CDC`/`0x2E20`/`0x2E2C`/`0x150`), tabla y ventanas, recorte con observador enganchado, y comprobación del caído escribiendo crudo (0.25 y 3.0 con ventana [0,1]) mientras los otros 62 modulan normalmente.
   - `verify_mod_matrix.py`: 14 comprobaciones independientes (cruces con `.rdata:0x10049E00`, mapa de observadores, push `0x2CDC` en `FUN_1001b140` e instalación de callbacks por `FUN_1000be10`). CTest en build32 pasa 8/8 tests con 0 fallos.
