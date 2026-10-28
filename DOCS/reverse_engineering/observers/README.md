# NeuronVS.dll — los 335 enganches de observador de `params`

Los observadores son el puente entre los **445 registros de `snddat`** y los **340 slots
de `params+0x278C`** (`p[]`, los valores efectivos que el traductor `FUN_10040550` lee).
Este paquete trae el mapa completo —una fila por llamada a `FUN_100010a0` en el
constructor `FUN_1000be10`— y los **4 callbacks de observador que faltaban por
recuperar**, con su propio verificador contra el binario.

## Resumen

| Métrica | Valor |
|---|---|
| Puntos de enganche (`call FUN_100010a0` en `FUN_1000be10`) | **335** (0x1001075b … 0x10013211) |
| Observadores en `params+0x280+k*0x18` | 332 offsets distintos, `max = 0x2770` |
| Offset repetido | sólo `0x280` (lo comparten `R1ModellIndex` y `R2ModellIndex`) |
| Callbacks distintos | **5**: `0x10013620`, `0x100135d0`, `0x10013600`, `0x100139b0`, `0x100139d0` |
| De ellos, recuperados en este paquete | **4** (`0x100135d0`, `0x10013600`, `0x100139b0`, `0x100139d0`) |
| Ganchos de los 6 controles de ejecución | 12 (bucle de 6 × 2 llamadas, filas 3–4 del mapa) |
| Destinos de modulación | **63**, tabla `.rdata:0x10049E00` (+ terminador `0`) |
| Rejilla de slots | `params+0x2B0+s*0x18`, una fila por slot (las de `0x280`/`0x298` son los preliminares) |
| Comprobaciones del verificador (PE) | **40** (`K1`: 662/662 límites, `K2`: 4 blancos de `0x280`, `K3`: `400/480` en `0x298`) |
| Comprobaciones de la matriz en el port (`verify_mod_matrix.py`) | **23** (incluyendo `W6` runtime probe + `GoldenParityTest --matrix` 63/63 en `ABDAxionikVS`) |
| Comprobaciones en caliente (`--matrix` DLL) | 15, sobre 351 presets (235 líneas de arnés en el log) |
| Destinos que el write `-1` desengancha en caliente | 0 o 1 por corrida (depende del heap) |

## Contenido

- [`params_observers_map.csv`](params_observers_map.csv) — las 335 filas.
- [`OBSERVER_CALLBACKS.md`](OBSERVER_CALLBACKS.md) — los 5 callbacks: dónde se instalan,
  qué escriben y qué prueba el verificador.
- [`functions/`](functions) — volcado capstone de los 5 callbacks
  (`10013620_ModelIndexChange.asm`, `100135d0_stModDest.asm`,
  `10013600_stModDepth.asm`, `100139b0_stGPEngineCb.asm`, `100139d0_stSPEngineCb.asm`).
- [`tools/verify_observers.py`](tools/verify_observers.py) — 36 comprobaciones contra
  `NeuronVS.dll` (sólo bytes del PE + capstone, sin usar el descompilado).
- [`tools/dump_callbacks.py`](tools/dump_callbacks.py) — regenera `functions/`.
- [`matrix_runtime.log`](matrix_runtime.log) + [`tools/verify_matrix.py`](tools/verify_matrix.py)
  — la matriz movida de verdad contra el DLL (`neuron_golden --matrix`, comprobaciones
  `M1`–`M5` y `M1b`) y su verificador (`V1`–`V8`).

## Qué es un observador

Cada observador son **6 dwords (24 B)** en `params + 0x280 + k*0x18`:

| Offset | Contenido | Evidencia |
|---|---|---|
| `+0x00` | `min` (float) | `mov dword ptr [ebp+off], imm32` en el ctor |
| `+0x04` | `max` (float) | ídem (`0x42780000` = 60.0 en los controles) |
| `+0x08` | puntero al contexto de 16 B | `operator_new(0x10)` + `ctx[0..3]` |
| `+0x0C` | índice (slot o control) | `ctx[2]` copiado aquí |
| `+0x10` | `mod_dest_idx` o `-1` | `ctx[3]` |
| `+0x14` | **puntero de callback** | lo invoca `FUN_10001550` como `(**(code**)(obs+0x14))(args)` |

El contexto (`ctx`) son 4 dwords: `{params, grupo, slot, mod_dest_idx}`. `FUN_100010a0`
es el «attach»: engancha un registro de `snddat` (una por fila del mapa) al observador,
y el callback decide qué hacer cuando ese registro cambia.

## El mapa

| Columna | Significado | Cómo se comprueba |
|---|---|---|
| `call_order` | 0 … 334, orden de aparición en el ctor | índice de fila |
| `call_va` | dirección de la llamada `E8 → 0x100010a0` | byte `E8` + rel32 en esa VA exacta |
| `obs_offset_hex` | offset del observador en `params` | `lea reg,[ebp+off]` en la ventana previa |
| `slot_in_p` / `slot_hex` | índice en `p[]` (`0x278c+slot*4`) o `-1` | `F2` contra la tabla de 63 destinos |
| `snddat_index` / `snddat_key` | registro de `snddat` (×40 B) y su clave | inmediato `add/lea` ÷ `0x28`, y `sound_schema.csv` |
| `min_val` / `max_val` | ventana de recorte del observador | `K0`–`K3`: campo `+0x00`/`+0x04` de cada fila contra el ctor |
| `callback` | callback instalado en `+0x14` | `E1`/`E2` en las filas especiales; ver límites |
| `mod_dest_idx` | 0 … 62 si es uno de los 63 destinos, si no `-1` | `F2` |
| `table_10049e00_slot` | `0x10049E00[mod_dest_idx]` | `F2` |

Las tres primeras filas son el caso especial `R1ModellIndex`/`R2ModellIndex`: el ctor
escribe sus callbacks **a mano** (`0x10013620` en `params+0x294` = observador `0x280`,
`0x100139b0` en `params+0x2ac` = observador `0x298`) y el universal `0x100139d0` se
materializa una sola vez en un registro para los 317 observadores siguientes. Las filas
3 y 4 no tienen offset literal: son las dos llamadas del bucle de 6 que construye los
12 ganchos de los controles de ejecución.

## Correcciones al mapa de origen

- **Callbacks de las filas 0–2.** El mapa de origen (`ABDAxionikVS`,
  `DOCS/reverse_engineering/dsp/params_observers_map.csv`) ponía `0x100139d0` en las
  tres. El binario dice otra cosa: `C7 85 94 02 00 00 20 36 01 10` en `0x10010735`
  escribe `0x10013620` en el observador `0x280`, y `C7 85 AC 02 00 00 B0 39 01 10` en
  `0x1000C0B2` escribe `0x100139b0` en el `0x298`. Corregido aquí y comprobado por
  `verify_observers.py` (`E1`–`E3`).
- **Callbacks de las filas 3–4.** El mismo arrastre dejaba `0x100139d0` en las dos filas
  del bucle de control.  El ctor escribe `C7 44 2E 70 D0 35 01 10` en `0x100107C4`
  (`mov [reg+0x70], 0x100135d0`, `stModDest`) y `C7 84 2E 00 01 00 00 00 36 01 10` en
  `0x10010815` (`mov [reg+0x100], 0x10013600`, `stModDepth`); el mapa ya trae esos dos
  valores y `verify_observers.py` lo comprueba (`E4`).
- **Ventana del observador 0x298 (R2ModellIndex).** La fila 2 (call_order 2) pasa de min_val/max_val vacíos a 400,480. Es la ventana que el ctor sí escribe: `C7 85 98 02 00 00 00 00 C8 43` en `0x1000C086` (`[ebp+0x298] = 400.0`) y `C7 85 9C 02 00 00 00 00 F0 43` en `0x1000C092` (`[ebp+0x29C] = 480.0`).
- **Conteo.** «335 observadores» son **335 puntos de enganche** (llamadas), no 335
  objetos distintos: hay 332 offsets distintos más los 12 ganchos de control que
  comparten dos llamadas en bucle.

## Límites

- `min_val` / `max_val`: los **331 campos con valor** coinciden con el ctor (`K1`, 662/662
  contando min y max). Los únicos **4 campos en blanco** son las dos filas del observador especial
  `0x280` (`R1ModellIndex` y `R2ModellIndex`, call_order 0 y 1); se quedan en el cero de `FUN_10001010`.
  La ventana `400/480` de `0x298` queda exigida estrictamente por `K3`. Lo que no
  hace `K1` es seguir ramas: la constante se propaga linealmente por los registros, con
  ebx/esi/edi sobreviviendo a las llamadas y eax/ecx/edx no.
- Las dos tablas de nombres de los controles (`0x10049DD0`, `0x10049DE8`) **no** se han
  podido confirmar como tablas de punteros a cadena: el primer dword no es una VA
  válida, así que la atribución de nombres sigue sin prueba propia en este paquete.
- Que `+0x08` sea «contexto» y `+0x0C` «slot» viene de `FUN_1000be10` (decompilado) y de
  cómo los leen los callbacks, no de una prueba de tipos.

## Verificación

```bash
python NeuronVS_observers/tools/verify_observers.py     # 40 comprobaciones (bytes del PE)
python NeuronVS_observers/tools/verify_matrix.py        # 15 mas, sobre el log del arnes
```

La segunda lee [`matrix_runtime.log`](matrix_runtime.log), la salida de
`NeuronVS_port/build32/Release/neuron_golden.exe --matrix` (Win32): mueve los seis
controles por MIDI y comprueba en caliente la fórmula de `FUN_100134e0`, la escritura
fuera del objeto del índice `-1` y la copia sin recortar, cruzando la tabla, los destinos
y las ventanas con `params_observers_map.csv` y con los bytes del PE.

De ahí salió el hallazgo que `M1b` vigila: el write de la rama `-1` cae en
`params+0x2E2C`, que es el `+0x0C` del bloque de contexto que el allocator deja detrás de
`params` (`params+0x2E20`) — o sea el `ctx[3]` de un observador, su índice de destino.
Cuando un bloque cae ahí, ese destino queda **desenganchado** (su callback toma la rama
`jl 0x10013A56` y escribe `p[slot]` sin matriz) y `M1` lo cuenta aparte: `63/63` o
`62/63` según dónde ponga el heap el bloque, que cambia de corrida a corrida (vistos
`R2Volume`/74, `R2Semi`/81, `R2L1Scape2Value`/99, `R2L1Sphere2Value`/90 y
`R2L2Sphere1Value`/107; dentro de una corrida es siempre el mismo destino).

Cubre, contra los bytes del PE: que `FUN_1000be10` tiene exactamente 335 llamadas a
`FUN_100010a0` y que su conjunto es idéntico a `call_va`; que cada fila tiene su
`lea [ebp+obs_off]` en la rejilla `0x280+k*0x18`; que el registro de `snddat` es el
inmediato ÷ `0x28`; que cada observador recibe tienda en `+0x14`; los dos callbacks
especiales **y los dos del bucle de control** (`0x100135d0` en `[reg+0x70]` y
`0x10013600` en `[reg+0x100]`); los 63 destinos contra `.rdata:0x10049E00`; las claves
contra [`../NeuronVS_neurondb/sound_schema.csv`](../NeuronVS_neurondb/sound_schema.csv);
que los 5 callbacks desensamblan sin huecos con sus referencias internas; la traza
completa de `FUN_100134e0` (`J1`–`J6`, incluido el `param_2 = -1` que escribe 0x150 B más
allá del objeto `params`); y `min_val`/`max_val` de cada fila contra el límite que el ctor
escribe en el registro (`K0`–`K3`): 662/662 campos con valor (331 filas con tienda y los 4
campos en blanco exclusivos de `0x280`), resolviendo las dos formas de tienda
—`c7 85` con el inmediato y `89 85` con la constante cargada antes en un registro— y el
caso sin tienda, que se queda con el cero de `FUN_10001010`, exigiendo en `K3` la ventana
exacta `400/480` para `0x298` (`R2ModellIndex`).

```text
[OK ] A1 llamadas a FUN_100010a0 en FUN_1000be10: 335 llamadas, 335 filas del mapa
[OK ] B2 rejilla 0x280+k*0x18 y limite < 0x278C: 332 offsets distintos, max 0x2770
[OK ] F2 mod_dest_idx -> slot_in_p == tabla: 63/63
[OK ] G1 snddat_key == sound_schema.csv[index]: 333/333
RESULTADO: todas las comprobaciones pasan contra NeuronVS.dll
```
