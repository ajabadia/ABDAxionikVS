# HANDOFF — qué aporta `NeuronVS_observers/` y qué cierra

De mano para quien continúe el estudio: qué da el paquete de observadores, qué
preguntas abiertas cierra y con qué prueba, y qué queda fuera de su alcance.
Todas las cifras son comprobables con los dos verificadores del directorio;
ninguna es de memoria.

## Qué aporta al estudio

1. **El mapa `snddat` → observador → slot** (`params_observers_map.csv`, 335
   filas). Una fila por cada `call FUN_100010a0` del ctor `FUN_1000be10`: orden y
   dirección del enganche, offset del observador en `params` (`0x280+k*0x18`),
   registro de `snddat` que lo dispara (índice ÷ `0x28` y clave), ventana
   `min`/`max`, callback instalado en `+0x14`, y si es uno de los 63 destinos de
   modulación y con qué slot de `p[]`. Es el índice que enlaza el `.sound`
   (445 registros) con los valores efectivos que lee el traductor `FUN_10040550`.
2. **Los callbacks del lado de `params`** — 5 distintos, **4 recuperados aquí**:
   `0x100135d0` `stModDest`, `0x10013600` `stModDepth`, `0x100139b0`
   `stGPEngineCb` y `0x100139d0` `stSPEngineCb` (el universal, en 330 de las 335
   filas). Volcado capstone en `functions/`; el verificador exige que
   desensamblan sin huecos y con sus referencias internas (H1/H2).
3. **El combinador `FUN_100134e0` trazado entero** (J1–J6): la fórmula
   `p[tabla[dest]] = clip(base[dest] + profundidad·valor)` de los seis destinos,
   la copia **sin recortar** del parámetro que cambió y la rama del índice `-1`.
4. **La matriz en caliente contra el DLL** (`matrix_runtime.log`):
   `neuron_golden --matrix` mueve los seis controles por MIDI sobre el binario
   real y `verify_matrix.py` (V1–V10) cruza esa salida con el mapa, con los bytes
   del PE y contrasta la paridad de los 63 slots sobre los 351 presets (pasada M6, 21.411 slots bit a bit).
5. **Correcciones al mapa de origen** (el de `ABDAxionikVS`): los callbacks de las
   filas 0–2 (`0x10013620` a mano en `+0x294`, `0x100139b0` en `+0x2AC`) y de las
   filas 3–4 (`stModDest`/`stModDepth` del bucle de control), el «335» que son
   enganches y no objetos distintos (332 offsets), y la ventana `400`/`480` del
   observador `0x298`, que el mapa de origen dejaba en blanco.
6. **Verificación propia**: 40 comprobaciones solo con bytes del PE + capstone
   (`verify_observers.py`, sin fiarse del descompilado) y 15 sobre el log del
   arnes (`verify_matrix.py`).

## Qué preguntas abiertas cierra

| Antes | Ahora | Prueba |
|---|---|---|
| ¿Qué callback atiende cada cambio de registro? | `+0x14` de cada fila: el universal `0x100139d0` en 330 filas, y los especiales escritos a mano en las 5 primeras (`ModelIndexChange` ×2, `stGPEngineCb`, `stModDest`, `stModDepth`) | E1–E4, H1, I1–I4 |
| ¿Con qué ventana se recorta cada valor? | `min`/`max` de cada fila = el límite que el ctor escribe en el registro: **662/662** campos; los únicos blancos permitidos son las dos filas de `0x280` (se quedan en el cero de `FUN_10001010`) y `0x298` trae `400`/`480` en mapa y ctor | K0–K3 |
| ¿Cómo cruza un valor del `.sound` hasta `p[]`? | 335 enganches: registro `snddat` → observador → callback → slot; claves 333/333 contra `sound_schema.csv`; cada slot `p[0..316]` tiene exactamente un observador | A1, B2, G1 |
| ¿Qué hacen los seis controles MIDI? | `stModDest` recombina el destino **anterior**, `stModDepth` escribe la profundidad y cierra con `combine(-1)`, `FUN_10013490` escribe el valor; en caliente los seis slots quedan en `clip(base + prof·valor)` | J2–J5, V1–V4 |
| **(«Abierto»)** ¿Qué es la tabla `0x10049E00` y qué hace `FUN_100134E0` con su «índice libre»? | **63 destinos + terminador `0`** — las 64 entradas; el único índice libre alcanzable es `-1` (lo pasan los controles), y su write cae 0x150 B más allá de `params` | F2, J6 |
| ¿Por qué un destino puede dejar de modular? | Ese write `-1` a `params+0x2E2C` pisa el `ctx[3]` del bloque de contexto que el heap deja contiguo a `params`: el observador de ese destino pasa a la rama `jl 0x10013A56` y escribe `p[slot]` a pelo. Verificado en 351 presets en pasada M6 contra el DLL (21.411 slots bit a bit) | M1b, V8, M6, V10 |
| **(«Abierto»)** ¿Quién llena `+0x278C`? | Mecanismo completo: el callback del observador escribe `base[dest]`, `combine` escribe los seis routeados y el caído escribe a pelo; el mapa da además el censo por slot | B2, F2, V1–V8 |
| ¿Los callbacks del mapa de origen eran fiables? | No: filas 0–2 y 3–4 traían `0x100139d0` y el binario dice otra cosa; corregido y sujeto a E1–E4 | E1–E4 |
| ¿Quién lee `params+0x0C` y `+0x10` (`R1/R2AmpEnvR`) y qué es `0x10049f00`? | **Nadie en audio**: `FUN_100343e4` (`CSilverRack::UpdateParams`) los copia pero ninguna rutina DSP los lee jamás (*dead mirrors* verificados con `neuron_golden --mirror`). La constante es `1/25.4` (umbral físico de 1 mm para cotas en pulgadas) | Análisis de llamadas cruzadas + sonda runtime |

## Qué queda abierto (desde este paquete) y su resolución en `ABDAxionikVS`

- **Los slots `p[317..339]`** no tienen fila de observador en el mapa: verificado en `Translator.cpp` (`FUN_10040550`) y `FUN_100343e4` (`CSilverRack::UpdateParams`) que `FUN_10040550` lee `p[0..244]` y `FUN_100343e4` lee `p[245..313]`, más `p[314..316]`; los dwords `317..339` son cola no referenciada del buffer de `params` inicializada a `0` por `memset`.
- **Los 13 `SoundMFX` sin slot (`slot_in_p = -1` en `NeuronVS.dll`)**: en el plugin VST de Windows de 2004 estaban desconectados; en `ABDAxionikVS` se han conectado a `effectiveSlots_[380..392]` (`kNumEffectiveSlots = 400`) y al motor `DspNeuronMasterFX.h`, restaurando sus valores originales desde `SoundsetV4.zip`.
- **Las dos tablas de nombres de controles** (`0x10049DD0`, `0x10049DE8`): el primer dword no es una VA válida, siguen sin prueba de que sean punteros a cadena.
- **El tipo de `+0x08`/`+0x0C`** («contexto»/«slot») viene del decompilado y de cómo los leen los callbacks, no de una prueba de tipos.
- **`K1` no sigue ramas**: la constante del límite se propaga linealmente por los registros (ebx/esi/edi sobreviven a las llamadas; eax/ecx/edx no) y eso no está comprobado más allá de las tiendas directas.

## Verificación

```bash
python NeuronVS_observers/tools/verify_observers.py     # 40, contra NeuronVS.dll
python NeuronVS_observers/tools/verify_matrix.py        # 15, sobre matrix_runtime.log
```
