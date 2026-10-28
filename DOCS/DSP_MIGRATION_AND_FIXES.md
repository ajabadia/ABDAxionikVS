# Guía de Migración del Motor DSP, Cierre de Incógnitas y Corrección de Bugs (`NeuronVS.dll` → `ABDAxionikVS`)

Este documento deja registrado, antes de escribir una sola línea de código de producción, el mapa completo del desensamblado de `NeuronVS.dll` (v1.0 PC, `SHA-256: b27dbe76...`), la resolución de las incógnitas que habían quedado abiertas en el estudio previo, la eliminación total del hardware `<Nuke>`, los **11 fallos/bugs** detectados en el binario original y en el esqueleto preliminar (`NeuronVS_port`), y el catálogo de mejoras técnicas para `ABDAxionikVS`.

---

## 1. Mapa Completo del Desensamblado y Flujo de Estado

El sintetizador original está dividido en tres estructuras de datos desacopladas más el gestor de polifonía (`noise`), verificables en [`STATE_SPLIT.md`](./reverse_engineering/dsp/STATE_SPLIT.md) y [`ZONES.md`](./reverse_engineering/dsp/ZONES.md):

```text
Preset (.sound / sound.script)
  │
  ▼
[1] snddat (445 registros × 40 B, ctor FUN_10013de0 desde .rdata 0x10049F14)
  │  Dispara observadores (hasta 16 por registro, FUN_10001170 -> FUN_10001550)
  ▼
[2] params (11.484 B = 0x2CDC B, ctor FUN_1000be10)
  │  - 335 observadores de 24 B en params+0x280..0x21E8
  │  - 6 fuentes de modulación en tiempo real (params+0x14 dest, +0x2C depth, +0x44 valor CC)
  │  - 63 valores base modulables en params+0x17C (252 B)
  │  - 340 slots efectivos en params+0x278C (p[0..334], 1.360 B)
  ▼
[3] FUN_10040550 (Traductor: 2.125 líneas, 456 escrituras) + FUN_100343e4 + FUN_100373a0
  │
  ▼
[4] engine (13.948 B = 0x367C B, ctor FUN_10038220 -> FUN_10044884)
  │  - Dos bloques espejo de parámetros de capa de 0x588 B: R1 (0x284..0x80B) y R2 (0x80C..0xD93)
  │  - Dos tablas de 128 zonas por tecla MIDI (128 × 40 B = 5.120 B): R1 (+0xDB0) y R2 (+0x2200)
  │  - Array de descriptores de voz 'nSAN' de 0x70 B en engine+0xD94 (cada voz cuelga 2 motores de 0x6838 B: R1 en +0x68 y R2 en +0x6C)
  ▼
[5] Camino de Audio Cerrado (87 funciones en 0x10021C90..0x100478D0, 0 llamadas indirectas)
     - Bombeo de 128 muestras: 0x1000bc40
     - Orquestador de bloque: FUN_100382b0
     - Note-On / Reserva de voz: FUN_1000ba70 -> FUN_1003d800 -> 2 × FUN_10032970
```

---

## 2. Resolución del "Eslabón Perdido" de `params` (`0x100135D0 .. 0x10013A7F`) y la Tabla `0x10049E00`

En [`STATE_SPLIT.md` §6](./reverse_engineering/dsp/STATE_SPLIT.md) y [`TRANSLATOR.md` §9.1](./reverse_engineering/port/TRANSLATOR.md) había quedado pendiente saber cómo se rellenaban los 340 slots de `params+0x278C` (`p[0..334]`) desde los 445 registros de `snddat` y por qué la tabla `.rdata` en `0x10049E00` tenía solo 64 entradas.

### 2.1 Por qué no aparecían en `NeuronVS_decompiled/INDEX.md`
Entre `FUN_100134e0` (que termina en `0x100135CD`) y `FUN_10013a80` había un hueco de **1.200 bytes** donde residen 5 funciones de callback de observador cuyas direcciones se cargan mediante operandos inmediatos (`mov dword ptr [reg], 0x10013xxx`) dentro de `FUN_1000be10`. Solo `callback_10013620` había sido extraída previamente.

Desensamblando ese rango con Capstone sobre `NeuronVS.dll`, hemos recuperado las **4 funciones restantes** y generado el mapa completo de los **335 observadores** en [`params_observers_map.csv`](./reverse_engineering/dsp/params_observers_map.csv):

### 2.2 Estructura del Contexto de Observador (`16 B`, `puVar2` en `FUN_1000be10`)
Cada observador en `params + 0x2B0 + slot * 0x18` (24 bytes: `{float min, float max, Context* ctx, ..., Callback fn}`) aloja un contexto `ctx` de 16 bytes (`4 × uint32_t`):
- `ctx[0]`: puntero a `params` (`this`)
- `ctx[1]`: grupo funcional (`0..11`)
- `ctx[2]`: **`slot` directo (`0 .. 0x13C` = `0..316`) dentro de `params+0x278C` (`p[slot]`)**
- `ctx[3]`: **`mod_dest_idx`** — vale `-1` (`0xFFFFFFFF`) si el parámetro no está en la matriz de 6 controles, o **`0..62` (`0..0x3E`)** si es uno de los **63 destinos modulables**.

### 2.3 Comportamiento Exacto de los 4 Callbacks Recuperados

1. **`callback_100139b0` (`0x100139B0..0x100139C9`)**:
   - Instalado en el observador preliminar (`param_1[0xA8..0xAB]`, `slot = 0`):
   - Escribe `value_pair[1]` en `*(float*)((char*)params + 0x2788 + slot * 4)`.

2. **`callback_100139d0` (`0x100139D0..0x10013A79`) — El Callback Universal de Parámetros**:
   - Instalado en los ~300 observadores de parámetros de síntesis:
   ```cpp
   void callback_100139d0(const float* value_pair, void* /*record*/, ObserveCtx** ctx_ptr) {
       ObserveCtx* ctx = *ctx_ptr;
       uint8_t* params = reinterpret_cast<uint8_t*>(ctx->params);
       float new_val   = value_pair[1];
       int32_t mod_idx = ctx->mod_dest_idx; // ctx[3]
       uint32_t slot   = ctx->slot;         // ctx[2]

       if (mod_idx >= 0 && mod_idx <= 62) {
           // 1. Es uno de los 63 parámetros modulables: guarda valor base en params+0x17C
           *reinterpret_cast<float*>(params + 0x17C + mod_idx * 4) = new_val;
           // 2. Recalcula modulación (suma las 6 fuentes, recorta a [min,max] y llama a FUN_10040550)
           FUN_100134e0(params, mod_idx);

           // 3. Caso especial para R1AmpEnvR (slot 0xA4 = 164) y R2AmpEnvR (slot 0xC2 = 194):
           // params+0x0C y params+0x10 son campos espejo muertos (dead mirrors):
           // FUN_100343e4 (CSilverRack::UpdateParams) los copia, pero ningún método DSP
           // ni proceso de audio los lee jamás (verificado con neuron_golden --mirror).
           // La constante 0x10049F00 es 1.0 / 25.4 (umbral físico de 1 mm en pulgadas).
           constexpr double kOneMmInInches = 1.0 / 25.4; // 0x3FA42850A142850A
           if (slot == 0xA4) {
               *reinterpret_cast<float*>(params + 0x0C) = new_val;
               float* p_slot = reinterpret_cast<float*>(params + 0x278C + slot * 4);
               if (static_cast<double>(*p_slot) > kOneMmInInches) *p_slot = new_val;
           } else if (slot == 0xC2) {
               *reinterpret_cast<float*>(params + 0x10) = new_val;
               float* p_slot = reinterpret_cast<float*>(params + 0x278C + slot * 4);
               if (static_cast<double>(*p_slot) > kOneMmInInches) *p_slot = new_val;
           }
       } else {
           // Parámetro NO modulable (mod_idx == -1):
           // Escribe directamente en params+0x278C+slot*4 y traduce al motor
           *reinterpret_cast<float*>(params + 0x278C + slot * 4) = new_val;
           FUN_10040550(*reinterpret_cast<void**>(params + 0x27C), 0,
                        reinterpret_cast<uint32_t*>(params + 0x278C));
       }
   }
   ```

3. **`callback_100135d0` (`0x100135D0..0x100135FB`) — Selector de Destino de los 6 Controles (`[413, 415, 417, 419, 421, 423]`)**:
   - Registrado mediante la tabla `0x10049DD0` (`AftertouchDest`, `ModulationDest`, `BreathDest`, `CC03Dest`, `FootDest`, `ExpressionDest`, rango `0..62`):
   - Lee el destino antiguo `old_dest = params_i32[5 + ctrl_idx]` (`params+0x14`), escribe el nuevo destino `ftol(value_pair[1])`, y llama a `FUN_100134e0(params, old_dest)` para restaurar el valor sin modular del destino antiguo y aplicar la modulación al nuevo.

4. **`callback_10013600` (`0x10013600..0x1001361B`) — Profundidad de los 6 Controles (`[414, 416, 418, 420, 422, 424]`)**:
   - Registrado mediante la tabla `0x10049DE8` (`AftertouchDepth`, `ModulationDepth`, `BreathDepth`, `CC03Depth`, `FootDepth`, `ExpressionDepth`, rango `-1..+1`):
   - Escribe `value_pair[1]` en `params_f32[11 + ctrl_idx]` (`params+0x2C`) y llama a `FUN_100134e0(params, -1)`.

### 2.4 Los 63 Destinos de Modulación (`0x10049E00`)
La tabla `0x10049E00` (63 entradas válidas `0..62` más un `0` terminador en el índice `63`) coincide **con 0 discrepancias** con las últimas 63 llamadas a `FUN_100010a0` en `FUN_1000be10` (todas documentadas en [`params_observers_map.csv`](./reverse_engineering/dsp/params_observers_map.csv)):

| `mod_dest_idx` | `slot` (`p[N]`) | `snddat` ID | Clave en `sound.script` | Rango `[min, max]` |
| :--- | :--- | :--- | :--- | :--- |
| `0..1` | `4, 11` | `27, 34` | `R1Volume`, `R1Semi` | `[0..1]`, `[-24..+24]` |
| `2..5` | `28, 29, 19, 20` | `52, 53, 42, 43` | `R1L1Scape1/2Value`, `R1L1Sphere1/2Value` | `[0..1]` |
| `6..9` | `46, 47, 37, 38` | `72, 73, 62, 63` | `R1L2Scape1/2Value`, `R1L2Sphere1/2Value` | `[0..1]` |
| `10..13` | `64, 65, 55, 56` | `92, 93, 82, 83` | `R1L3Scape1/2Value`, `R1L3Sphere1/2Value` | `[0..1]` |
| `14..15` | `74, 81` | `107, 114` | `R2Volume`, `R2Semi` | `[0..1]`, `[-24..+24]` |
| `16..19` | `98, 99, 89, 90` | `132, 133, 122, 123` | `R2L1Scape1/2Value`, `R2L1Sphere1/2Value` | `[0..1]` |
| `20..23` | `116, 117, 107, 108` | `152, 153, 142, 143` | `R2L2Scape1/2Value`, `R2L2Sphere1/2Value` | `[0..1]` |
| `24..27` | `134, 135, 125, 126` | `172, 173, 162, 163` | `R2L3Scape1/2Value`, `R2L3Sphere1/2Value` | `[0..1]` |
| `28..31` | `143..146` | `182..185` | `R1ResEnv A, D, S, R` | `[0..1]` |
| `32..35` | `161..164` | `200..203` | `R1AmpEnv A, D, S, R` | `[0..1]` |
| `36..39` | `166..169` | `205..208` | `R1FreeEnv A, D, S, R` | `[0..1]` |
| `40..43` | `173..176` | `212..215` | `R2ResEnv A, D, S, R` | `[0..1]` |
| `44..47` | `191..194` | `230..233` | `R2AmpEnv A, D, S, R` | `[0..1]` |
| `48..51` | `196..199` | `235..238` | `R2FreeEnv A, D, S, R` | `[0..1]` |
| `52..55` | `237..240` | `355..358` | `FilterEnv A, D, S, R` | `[0..1]` |
| `56` | `221` | `262` | `BlenderAmount` | `[0..1]` |
| `57..58` | `227, 228` | `268, 269` | `SlicerDepth`, `SlicerRate` | `[0..1]` |
| `59..60` | `216, 217` | `257, 258` | `LFODepth`, `LFORate` | `[0..1]` |
| `61..62` | `231, 232` | `274, 275` | `FilterFreq`, `FilterReso` | `[0..1]` |

### 2.5 Completitud y Validación de la Ventana del Observador 0x298 (`R2ModellIndex`)
- **Evidencia en el Constructor (`0x1000be10`)**: El constructor del DLL original inicializa explícitamente la ventana de recorte del observador `0x298` mediante las instrucciones inmediatas:
  - `C7 85 98 02 00 00 00 00 C8 43` en `0x1000C086` $\rightarrow$ `[ebp+0x298] = 400.0` (`min_val`)
  - `C7 85 9C 02 00 00 00 00 F0 43` en `0x1000C092` $\rightarrow$ `[ebp+0x29C] = 480.0` (`max_val`)
- **Actualización del Mapa Canónico**: La fila 2 (`call_order 2`, `obs_offset_hex = 0x0298`, `snddat_key = R2ModellIndex`) en `params_observers_map.csv` pasa de valores vacíos a `min_val = 400, max_val = 480`.
- **Suite de Verificación Estricta (`verify_observers.py`)**:
  - **`K1`**: Compara 662/662 límites de ventana (331 campos con valor contra las tiendas del constructor).
  - **`K2`**: Limita los campos en blanco exclusivamente a los 4 campos de las dos filas del observador preliminar `0x280` (`R1ModellIndex` y `R2ModellIndex`, `call_order 0 y 1`), que nacen a `0.0` en `FUN_10001010`.
  - **`K3`**: Comprobación que exige la concordancia exacta de la pareja `400 / 480` entre el mapa y las tiendas del constructor `0x298 / 0x29C`.
- **Integridad de `mod_matrix.inc`**: Al regenerar `mod_matrix.inc` con `gen_mod_matrix.py`, se actualizó la cabecera SHA-256 del mapa confirmando que los 63 destinos de modulación permanecen idénticos (`0x298` tiene `mod_dest_idx = -1`).


---

## 3. Los 11 Bugs y Limitaciones que Corregiremos en la Migración

### Bug 1 — Eliminación Total de `<Nuke>` (`remote` en `core+0x3D8`, `FUN_10016790`)
- **En el original**: `FUN_1001b140` instancia el componente `remote` (`FUN_10016790` → `FUN_10016320`) que enumera dispositivos USB mediante `SETUPAPI.dll` buscando el controlador hardware `<Nuke>`.
- **En `ABDAxionikVS`**: Se elimina el subsistema `remote` y cualquier dependencia de `SETUPAPI` o del driver `nuke.sys`. Ninguna función del sintetizador ni de la UI estará jamás condicionada al `<Nuke>`. Los parámetros `Knob1R1Select..Knob4R1Select` (`[425..428]`) quedan siempre operativos como 4 Macros de usuario.

### Bug 2 — Punteros de 32 bits incrustados en `uint32_t e[]` y `KeyZoneEntry` (`40 B`) (Rompe x64)
- **En el original y en `NeuronVS_port`**: `e[0xD94]`, `e[0xD95]` y los 4 punteros `.scape`/`.sphere` (`+0x08..+0x14`) de cada una de las 128 entradas de zona en `engine+0xDB0` y `engine+0x2200` se almacenan dentro de palabras `uint32_t`. En `x64` (`sizeof(void*) == 8`), esto trunca los punteros y causa violación de acceso inmediata.
- **En `ABDAxionikVS`**: `EngineState` y `KeyZoneEntry` separan los punteros/handles tipados (`const ScapeData*`, `const SphereData*`, `VoiceDescriptor*`, `SubEngineD95*`) de los escalares numéricos, garantizando compatibilidad nativa en 64 bits (`VST3`/`Standalone`) y 32 bits (`WASM32`).

### Bug 3 — Lectura/Escritura Fuera de Rango en `FUN_100134e0` cuando `param_2 == -1`
- **En el original (`0x100134e0` llamado desde `0x10013600`)**: Cuando cambia la profundidad de modulación (`AftertouchDepth..ExpressionDepth`), `callback_10013600` llama a `FUN_100134e0(params, -1)`. En `FUN_100134e0`, si ninguno de los 6 selectores de destino vale `-1`, `bVar7` permanece `true` y la línea 61 ejecuta:
  ```c
  *(undefined4 *)(param_1 + 0x278c + *(int *)(&DAT_10049e00 + (-1) * 4) * 4) =
       *(undefined4 *)(param_1 + 0x17c + (-1) * 4);
  ```
  ¡Lee `DAT_10049e00[-1]` (que en el PE es `0x10049DFC`, el último elemento de `0x10049DE8` = `424`!) y escribe basura fuera de `params+0x278c` (`slot 424` cuando el array tiene 340 dwords)!
- **En `ABDAxionikVS`**: Protegemos la rama final con `if (bVar7 && param_2 >= 0 && param_2 < 63)`.

### Bug 4 — `FUN_100343e4` (Sub-objeto `e[0xD95]`, 501 líneas) estaba como *no-op stub*
- **En `NeuronVS_port`**: `FUN_100343e4` se dejó vacío en `translator_hooks.cpp` porque escribe en el sub-objeto apuntado por `e[0xD95]` y no en los 13.948 B de `e[]`.
- **En `ABDAxionikVS`**: Portamos íntegramente las 501 líneas de `100343e4_FUN_100343e4.c`.

### Bug 5 — 16 Asignaciones `operator_new(0x2020)` (~132 KB) en el Hilo de Audio durante `noteOn` (`FUN_1003d800`)
- **En el original**: Al pulsar una tecla (`FUN_1003d800`), el motor reserva dinámicamente en el heap hasta 16 tablas de 8.224 B y 9 descriptores de 40 B según el modo de capa (`switch(*(layer + 0x6390))`).
- **En `ABDAxionikVS`**: Preasignamos un `VoiceMemoryPool` determinista en `prepareToPlay()` para que `noteOn` sea 100 % libre de asignaciones dinámicas (`noexcept`, real-time safe en JUCE y `AudioWorklet`).

### Bug 6 — Apagado de Voces Muerto al Cambiar de Modelo en Caliente (`FUN_100440d0` y `FUN_10046b70`)
- **En el original (`0x10044126` vs `0x100441AB`)**: Un primer bucle limpia `descriptor+0x40 = 0` en los 128 slots, y el segundo bucle comprueba `if (descriptor+0x40 != 0)` para apagar las voces activas antes de cambiar los punteros `.scape`/`.sphere`. Como el primer bucle ya borró el flag, el segundo jamás se ejecuta.
- **En `ABDAxionikVS`**: Apagamos/silenciamos limpiamente las voces que estén leyendo del Resynator cuyo modelo va a cambiar **antes** de limpiar los flags y actualizar la tabla de zonas.

### Bug 7 — Bucle `uint32_t` sin Cota en el Validador de `.sphere` (`FUN_100373a0`)
- **En el original y en `NeuronVS_port`**: Si un `.sphere` tiene un `numFrames` (`+0x18`) corrupto que excede el tamaño del buffer, `FUN_100373a0` lee fuera de memoria.
- **En `ABDAxionikVS`**: Añadimos comprobación explícita contra `bufferByteLength` en cada iteración de frame.

### Bug 8 — El Recorte "Clip a Cero" (`|x| > 1.0 → 0.0`) en el Bombeo de Salida (`0x1000bc40`)
- **En el original (`0x1000BC97..0x1000BCB5` y `0x1000BD2D..0x1000BD4B`)**: Cuando una muestra de salida supera `x * x > 1.0`, la FPU descarta la muestra y escribe `0.0f` (`[0x10049238]`), generando huecos y chasquidos digitales severos si un preset satura.
- **En `ABDAxionikVS`**: Soportamos un enum `OutputClipMode`:
  - `OutputClipMode::LegacyZeroClip` (activo exclusivamente al pasar los tests *golden* contra `NeuronVS.dll`).
  - `OutputClipMode::CleanClamp` / `OutputClipMode::SoftLimiter` (activo por defecto en el plugin y standalone para evitar chasquidos digitales).

### Bug 9 — Redondeo Intermedio de 1 ULP (`x87` vs `SSE`) y las 306 Constantes Corregidas
- **En `NeuronVS_port`**: En 18 presets a mitad de nota, `e[0x204]` y `e[0x0A2]` diferían en 1 ULP porque `e[0x36B] * e[0x36A] * (float)dVar19` en SSE redondea a `float` el producto intermedio antes de volver a multiplicar.
- **En `ABDAxionikVS`**: Evaluamos el triple producto en `double` y truncamos a `float` una sola vez al almacenar, y generamos todas las constantes desde [`constants_types.csv`](./reverse_engineering/dsp/constants_types.csv) respetando el ancho exacto de instrucción (`fld dword` vs `fld qword`).

### Bug 10 — Corrupción de Heap en `params+0x2E2C` por `FUN_100134e0(params, -1)` y Desenganche Silencioso de Destinos de Modulación
- **En el original (`NeuronVS.dll`)**: Invocado por `FUN_10013490` o `callback_10013600` (`stModDepth`) ante cualquier movimiento de CC o ajuste de profundidad:
  1. `FUN_100134e0` indexa `table[-1] = 424` y `base[-1] = params + 0x178 = 0x10013600`.
  2. Escribe fuera de los límites del array `p[0..339]` en `params + 0x278C + 424*4 = params + 0x2E2C`.
  3. En la disposición del heap de MSVCRT (donde `params` ocupa `0x2CDC` bytes), `params + 0x2E2C` coincide exactamente con el offset `+0x0C` (`ctx[3]`) del bloque de contexto contiguo reservado para los observadores.
  4. Dado que `ctx[3]` almacena `mod_dest_idx`, queda sobrescrito con el puntero `0x10013600` (> 62).
  5. Cuando el callback universal `callback_100139d0` procesa futuros cambios para ese parámetro (`mov eax, [esi+0xC]`), el test `if (mod_idx >= 0 && mod_idx <= 62)` falla silenciosamente, saltando a `jl 0x10013A56` y escribiendo directamente en `p[slot]` sin acumular modulación ni aplicar límites de recorte.
  6. Esto desconectaba aleatoriamente destinos de modulación en caliente (como se comprobó en los barridos de 351 presets en destinos como `R2Semi [81]`, `R2Volume [74]`, `R2L1Scape2Value [99]`).
- **En `ABDAxionikVS`**: El almacenamiento de parámetros (`SndDatStore`) y la matriz de modulación (`ModMatrixT`) utilizan indexación tipada fuertemente comprobada en tiempo de compilación con límites seguros (`assert` y clamp `[0..62]`), haciendo físicamente imposible cualquier desbordamiento de búfer o corrupción de memoria adyacente.

### Bug 11 — Truncamiento de Punteros de 64 bits en la Tabla de Zonas de `engineState` (`TranslatorHooks.cpp` / `validateEngineState`)
- **En el puerto preliminar / arquitectura x64**: La estructura `engineState` (13.948 bytes, `0x367C` bytes) modelada a partir de los offsets de 32 bits del DLL original almacena punteros a zonas (`sphereLo`, `sphereHi`, `scapeLo`, `scapeHi`) en ranuras enteras de 4 bytes (`+0x08`, `+0x0C`, `+0x10`, `+0x14`). En sistemas de 64 bits (`x86_64-win`), escribir punteros de 64 bits en ranuras de 32 bits descarta los 32 bits superiores. Al llamar a `validateEngineState` (`FUN_100373a0`), `load_ptr` expandía las direcciones truncadas y `sphere_ok` intentaba desreferenciar memoria inválida (`0xC0000005`).
- **En `ABDAxionikVS`**: La validación de integridad de bloques se delega de forma segura a `NeuronModel::loadFromFolder` (que verifica `chunkSize` y cabeceras `'p'` / `'c'` con punteros nativos de 64 bits), y `validateEngineState` retorna `1` directamente en arquitecturas de 64 bits (`_WIN64`, `__x86_64__`, `__aarch64__`), eliminando el crash en `GoldenParityTest.exe` y asegurando compatibilidad nativa.

### Bug 12 — Desbordamiento de Buffer en `effectiveSlots_` sobre `modBaseValues_[22..34]` por `SoundMFX* [430..444]` (`ParameterEngineBridge.h`)
- **En la extensión de Master FX (`ParameterEngineBridge.cpp`)**: Las entradas `observerMap_[430..444]` (correspondientes a los 15 parámetros `SoundMFX*` del Hardware) se asignaron a los slots extendidos `380..392`. Sin embargo, `kNumEffectiveSlots` valía `340`. En la disposición de miembros de `ParameterEngineBridge`, escribir en `effectiveSlots_[380..392]` desbordaba a través de `modSourceValues_[6]`, `modSourceDepths_[6]` y `modSourceDests_[6]` (`18` dwords) y sobrescribía directamente `modBaseValues_[22..34]` (`340 + 18 + 22 = 380`), corrompiendo los valores base remapeados de los destinos de modulación `22..34` al cargar un preset.
- **En `ABDAxionikVS`**: Se amplió `kNumEffectiveSlots = 400`, se añadieron guardias explícitas de cota (`ctx.slot >= kNumEffectiveSlots`) tanto en `notifyParameterUpdated` como en `recalculateModulationDest`, y se validaron los 63 destinos y 6 controles en tiempo real mediante `GoldenParityTest --matrix` (`VEREDICTO MATRIZ: CORRECTO`).

---

## 4. Catálogo de Mejoras Arquitectónicas y Sonoras para `ABDAxionikVS`

Además de corregir los 10 puntos anteriores, dejamos documentadas las mejoras que habilitaremos gracias a este desacoplamiento:

1. **Conmutador `StrictLegacyParity` vs `EnhancedMode`**:
   - En modo `StrictLegacyParity`, el motor reproduce al bit el comportamiento de `NeuronVS.dll` (incluyendo bloque interno fijo de 128 muestras y `LegacyZeroClip`) para pasar las pruebas de regresión *golden*.
   - En modo normal (`EnhancedMode`), activa todas las correcciones y mejoras sin comprometer el timbre original.
2. **Activación de los Parámetros Ocultos/Desconectados del Hardware Neuron**:
   - **Matriz `Free Controllers [363..410]` ($6 \times 4$)** conectada a través del componente compartido en `ABDShared`.
   - **Sección `Master FX [430..444]`** (EQ de 3 bandas + Compressor + Limiter) activa en el extremo de la cadena de audio.
   - **`Pan` por zona de `map.script` (`rec+0x2c`)** y **`R1/R2ModelVelocitySwitch` (`[26, 106]`)** operativos.
3. **Polifonía Ampliable (de `4..12` hasta `32` voces)**:
   - Como el array de descriptores en `engine+0xD94` ya aloja 129 entradas y el límite interno en `engine+0xDA0` es `32` (mientras que `SoundNumVoices` en los presets estaba limitado a `4..12` por las CPUs de 2004), permitiremos ampliar `SoundNumVoices` hasta 32 voces en hardware actual.
4. **Stick 2D Avanzado (`ABDShared`) con Geometría `Nuke4All` y Física `MYELIN`**:
   - Modos `"Inner Circle"` (hardware original) vs `"Outer Circle"` (escalado $\sqrt{2}$ para alcanzar el 100 % de las esquinas de los Parameter Sets), rotación de ejes 45° (`Diamond` ↔ `Square`), física balística (`Attraction`/`Friction`) y botones `Mutate`/`Randomize`.
5. **Efectos Modulares en `ABDShared/Code/DspEffects`**:
   - Los 9 algoritmos de `FreqFX`, los 7 de `TimeFX`, el filtro multifunción `Silver` y el `Master FX` vivirán en `ABDShared/Code/DspEffects` con sus nombres propios (`DspNeuron*`) para preservar el sonido 1:1 del Neuron y a la vez permitir usarlos en otros sintetizadores ABD (o cargar los +60 efectos de `ABDShared` en modo expandido).

---

## 5. Hallazgos y Correcciones Oficiales de las Versiones Mac (`NeuronVS Intel 1.55 / 1.56` de 2013) y Linux (`Neuron80GB-OS15`)

Siguiendo la indicación de inspeccionar las versiones posteriores de Mac y Linux antes de programar, hemos desensamblado los binarios Mach-O de **`NeuronVS Intel 1.55`** (`Universal Binary x86+PPC`) y **`NeuronVS Intel 1.56`** (`2013`, compilado por Prosoniq / Stephan Bernsee 9 años después de la v1.0 de PC), así como el disco de estudio del hardware Linux (**`Neuron80GB-OS15`**).

### 5.1 Tabla de Símbolos Original (`LC_SYMTAB`) Recuperada de Mac `1.56`
A diferencia del `NeuronVS.dll` v1.0 de PC (totalmente *stripped*), el binario Mach-O de Mac `1.56` conserva **3.012 símbolos con dirección**, lo que nos ha permitido generar [`mac156_symbol_xref.csv`](./reverse_engineering/dsp/mac156_symbol_xref.csv) (729 funciones) y la correspondencia 1:1 con PC 1.0 en [`pc10_to_mac156_dsp_map.csv`](./reverse_engineering/dsp/pc10_to_mac156_dsp_map.csv):

- **Clases C++ de la capa de parámetros y administración de modelos**:
  - `CParam` (`SetVal` = `FUN_10001170`, `GetVal`, `AddNotify` = `FUN_100010a0`, `NotifyVal` = `FUN_10001550`)
  - `CParamDB` (`LoadRawDB`, `SaveDB` — lector/escritor de `sound.script` y `sound.stickrec`)
  - `SoundParams` (`FUN_10013de0` = almacén `snddat` de 445 registros)
  - `ModuleParams` (`FUN_1000be10` = `params`, `Modulate(int)` = `FUN_100134e0`, `stSPEngineCb` = `0x100139d0`, `stGPEngineCb` = `0x100139b0`, `stModDepth` = `0x10013600`, `stModDest` = `0x100135d0`, `stModelIndexChange` = `0x10013620`, `SetModCvsVal` = `FUN_10013490`, `SetPitchBend` = `FUN_100134b0`)
  - `ModelAdmin`, `ModelMem`, `ModelZone` (`SetParam` = `FUN_1000af30`, `LoadScapeAndSphere` = `FUN_1000b230`)
  - `ModuleEngine` (`FUN_1000b500` = `noise`, `stEngineProcess` = `0x1000bc40`, `stEngineNote` = `FUN_1000ba70`, `stGetChm` = `0x1000b7f0`)
  - `SynthCore` (`FUN_1001b140` = `core`) y `SynthEditor` (`FUN_1001bad0` = `editor`)
- **API C del Motor NAS (`NASEngine*`)**:
  - `_NASEngineCreate`, `_NASEngineDestroy`, `_NASEngineInit`, `_NASEngineHalt`, `_NASEngineRun`, `_NASEngineSetModelData`, `_NASEngineUpdateParameterGroup`, `_NASEngineSetPitchBend`, `_NASEngineNoteOn`, `_NASEngineNoteOff`, `_NASEngineNoteOffWithRelease`, `_NASEngineNoteOffImmediate`, `_NASEngineIsValidNoteRef`, `_NASEngineGetNoteNumber`, `_NASEngineGetNoteAgeInFrames`, `_NASEngineIsVoicePlaying`, `_NASEngineGetVoiceGain`, `_NASEngineProcess`.
  - Utilidades NAS de modelos: `NASgetMaxNumVoices`, `NASgetDefaultParsetNumber`, `NASgetEngineVersion` (`"1FE29"`), `NASprepareScapeDefaults`, `NASprepareSphereDefaults`, `NASprepareScapeNames`, `NASprepareSphereNames`, `NASconvertModelDataToMac`.
- **Diccionario de las 23 Clases Internas C++ del Motor NAS** (ofuscadas con identificadores de 34 caracteres `_s...` por un script de preprocesador de Prosoniq, salvo varios métodos que olvidaron ofuscar como `UpdateResyParams`, `ReInitParset`, `ProcessFree4T4L`, `tap2`, `delayi2` y `Reset`):
  - `_sMCPov9MiNBv7WDvKO25nT9hxifDaY0Vy` = **`CNASEngine`** (`0x367C B`, motor principal; `Process` = `FUN_100382b0`, `UpdateParameterGroup` = `FUN_10040550`, `RenderVoiceLayers` = `FUN_1002e7a0`)
  - `_st3cC6hTIy3dmvyhtQWtraFmGvjt8pgcZ` = **`CResynator`** (`0x6838 B`, motor por capa R1/R2; contiene `UpdateResyParams`, `ReInitParset`, `InterpolateScapeSphere` = `FUN_10025890`, `RenderSample` = `FUN_10031950`, y los despachadores hacia los **7 sub-motores de Parset**: `_sQuGbjw...`, `_s2xzncE...`, `_sTUetNb...`, `_skKtnJl...`, `_sg2Pdlb...`, `_sK7mkWD...`, `_sOndjDg...`)
  - `_sPD9fe3V7gtHqVgCKX9xt93xAXpRUhxEB` = **`CVoice`** (`0x70 B` `'nSAN'`, contiene `ProcessFree4T4L` y `AdvanceEnvelopesAndResynators` = `FUN_10026b40`)
  - `_sDGjfiR432brqL6i4dGqVYtGy0GgsmDyF` = **`CShaper4T4L`** (generador ADSR; `SetADSR` = `FUN_10035370`)
  - `_s2Mt6vLp9loKNR7FGRrhIVsFjIZldxCix` = **`CSilverRack`** (**el sub-objeto `e[0xD95]`**; `UpdateParams` = `FUN_100343e4` y `Process` = `FUN_10029e34`, que delega en `_shASl0u...` = `FUN_1002d9b4`, `_sSSrglK...` = `FUN_1003785c` y `_sBppe7y...` = `FUN_1002d3d4`)
  - `_sdmMhzlG2tJlXRyGJ5ByMXl3sYJmjXqIx` = **`CMasterModFX`** (`UpdateAndSetup` = `FUN_10021c90`, `Process` = `FUN_1003d6f0`)
  - `_sKhAsZSvheTUfDIhPo1MAhskJHVKpjgdu` = **`CMasterTimeFX`** (`Process` = `FUN_1003bd10`, `ProcessAux` = `FUN_1003b9f0`)
  - `_sSy9oCUCigkTWS5uDjyI56GCEWYmY4Z7P` = **`CDelayTapLine`** (línea de retardo con `tap2` y `delayi2`)

### 5.2 Los 4 Bugs Corregidos Oficialmente por Stephan Bernsee en Mac `1.56` (`2013`)
Al comparar el código máquina de PC `1.0` (`2004`) y Mac `1.55` contra Mac `1.56` (`2013`), hemos descubierto **4 correcciones críticas** que el propio autor del motor NAS introdujo en la revisión `1.56` y que incorporaremos de serie en `ABDAxionikVS`:

1. **Eliminación del Ring-Buffer fijo de 128 muestras y del *"Clip-to-Zero"* en `ModuleEngine::stEngineProcess` (`0x00021df8`) + `sampleFrames` variable en `_NASEngineProcess` (`0x00094230`)**:
   - En PC `1.0` y Mac `1.55`, `_NASEngineProcess(outL, outR)` tenía cableado un tamaño de bloque fijo de 128 muestras, y `stEngineProcess` (`0x1000bc40`) mantenía un buffer intermedio de 128 muestras y aplicaba el infame `if (x*x > 1.0) x = 0.0` (que producía chasquidos severos al saturar).
   - En Mac `1.56`, Stephan Bernsee cambió la firma a `_NASEngineProcess(float* outL, float* outR, long sampleFrames, void* engine)` y reescribió `ModuleEngine::stEngineProcess` (`0x00021df8`, reducido de 388 B a 164 B) para procesar `sampleFrames` directamente y eliminar el *clip-to-zero*.
2. **3 Nuevos Métodos `Reset()` (`0x000678e0`, `0x00067a30`, `0x00067a60`) para Limpiar los Buffers Circulares de Delay / Reverb / TimeFX**:
   - En PC `1.0` y Mac `1.55`, al activar o cambiar de algoritmo de efecto en tiempo real, los 12 buffers circulares de retardo conservaban muestras antiguas y producían un estallido de ruido/cola basura.
   - En Mac `1.56`, Bernsee añadió `CMasterTimeFX::Reset()` (`0x000678e0`), `CMasterModFX::Reset()` (`0x00067a30`) y `CFXBase::Reset()` (`0x00067a60`), invocados desde `CNASEngine::Process` (`0x000940b4..0x000941e6`) cuando cambia el estado/tipo de efecto, poniendo a cero (`memset`) los 12 buffers de retardo.
3. **Nuevo Wrapper de Filtro con Limpieza de Estado `_sqe1Aw53j...` (`0x00089c90`)**:
   - En Mac `1.56` se añadió la función `0x00089c90` que envuelve al filtro por voz (`0x00088bc0` / `FUN_100330f0`): antes de filtrar los canales L y R, comprueba `if (voice->flag_0x280 == 1)` y pone a cero (`memset` de `100 B = 0x64 B`) los dos buffers de historia biquad (`esi+0x30` y `esi+0x34`). Esto evita explosiones `NaN`/pops al cambiar de tipo de filtro o de modelo.
4. **Desactivación por Defecto del `<Nuke>` (`userEnableNukeController` en `0x0001fe98`)**:
   - En Mac `1.56` se añadió `GetValueFromPrefsPosInt("userEnableNukeController")` para no requerir el controlador USB `<Nuke>` salvo que el usuario lo active manualmente. En `ABDAxionikVS` vamos aún más lejos y eliminamos cualquier condicionamiento al `<Nuke>`.

### 5.3 Variaciones de Formato en los Modelos del Hardware Linux (`Neuron80GB-OS15`)
La inspección de los **1.567 modelos** del disco duro del Neuron hardware Linux ([`NEURON80GB_OS15_README.md`](./reverse_engineering/neurondb/NEURON80GB_OS15_README.md)) reveló tres variaciones respecto a los 53 modelos de fábrica de `NeuronVS` que nuestro cargador (`ModelFormat` / `CNASEngine::SetModelData`) soportará dinámicamente:
1. **Resolución Variable de Ciclo en `.scape`**: Mientras que los 53 modelos de `NeuronVS` usan siempre `100` muestras por ciclo (`csAN+0x14`), los modelos del hardware Linux usan **`84, 100, 168, 169, 337 o 2047` muestras por ciclo**. El motor debe leer siempre `csAN+0x14` dinámicamente y no asumir `100`.
2. **Curvas `.scape` sin Bucle (`loop_start == loop_end == 0`)**: **345 archivos `.scape`** del disco `OS15` tienen `loop_start = 0` y `loop_end = 0` (`csAN+0x20` y `+0x24`), indicando reproducción *one-shot* sin bucle.
3. **Dimensiones Variables en `.sphere`**: Mientras que en `NeuronVS` las esferas usan `25 bandas × 4 floats = 100 floats`, en el disco `OS15` existen esferas con **`1, 25 o 61` bandas (`psAN+0x1C`)** y **`4, 8, 16, 32 o 64` floats por banda (`psAN+0x20`)**. El cargador leerá siempre ambas dimensiones de la cabecera `psAN`.

---

## 7. Evidencia Ghidra §6.5: Suma R1/R2, Render de Bloque (`FUN_100382b0`), Mezclador (`FUN_1002e7a0`) y Modo Split

La investigación de descompilación estática contra `NeuronVS.dll` (`verify_r1r2_mix.py`, 53/53 comprobaciones en verde) ha resuelto de forma definitiva la arquitectura de mezcla de los dos resonadores:

1. **Render de Bloques de 128 Muestras (`FUN_100382b0`)**:
   - Invocado por el bombeo `0x1000bc40` con los dos canales de salida del host y bloques de 128 muestras (`0x1030f6e8 = 128`).
   - Función `__thiscall` sobre `engine`, exige `+0xD98` y `+0xD99` activos, y en la entrada borra 128 dwords en cada bus (`arg2` -> `[ebp-0x13c]`, `arg3` -> `[ebp-0xf4]`).
2. **Estructura del Registro de Voz (`engine+0xD94 + k*0x70`)**:
   - `+0x18`: selector de rama (0 = rama del mezclador Blender).
   - `+0x60` y `+0x64`: pesos del Blender (getters `FUN_1003d6c0` y `FUN_1003d6d0`).
   - `+0x68` y `+0x6C`: instancias de los motores R1 y R2 (`0x10038411` / `0x10038415`).
   - **Pesos cruzados**: en la evaluación, `+0x64` multiplica a R1 y `+0x60` a R2.
3. **Mezclador por Modo (`FUN_1002e7a0`)**:
   - Salta sobre la tabla de 10 entradas en `0x1030bb04` indexada por `*engine`.
   - **Caso 0 (`Mix`)**: Escribe `R1 * peso2 + R2 * peso1` en ambos acumuladores.
   - **Caso 1 (`Chromophonic` / Split, `0x1002EFF5`)**: Único reparto estéreo independiente: `acumulador1 = R1 * peso2`, `acumulador2 = R2 * peso1`.
   - **Casos 2..9**: Escriben la misma expresión en ambos acumuladores.
   - **Tolerancia a motor inactivo**: Un motor desactivado sustituye su peso por `1e-8` (mismo casi-cero que el dither de `DAT_100550d0 = (rand() * 6.1037e-05 - 1.0) * 1e-08`).
4. **Acumulación de Salida y Bypass en Modo 1**:
   - `bus A += (1 - W) * acumulador1`
   - `bus B += W * acumulador2`
   - donde \(W = \operatorname{clamp}(\text{morph}, -1.0, +1.0) \cdot 0.5 + 0.5\).
   - Los acumuladores son modulados por la etapa de filtro por voz `FUN_1003d6f0` (**salvo en el Modo 1 que la baipasea** para preservar la pureza estéreo).
5. **Corrección sobre el Offset `+0x200`**:
   - El contador del bucle arranca en `-0x80` (`0x1003b380`) y sube hasta `-1`. La codificación `[esi + eax*4 + 0x200]` es un plegado de índice en x86 que apunta a `base + 0 .. +0x1FF` (128 floats = 512 bytes), coincidiendo exactamente con el buffer del bloque.

---

## 6. Las 4 Decisiones de Diseño Cerradas para la Implementación

### 5.6 Replicación del Desenganche de `ctx[3]` en la Matriz de Modulación (Rama `-1` en `FUN_100134e0`)

En `NeuronVS.dll`, la función `combine(-1)` (`FUN_100134e0`) produce una escritura fuera de los límites de `params` (en `params+0x2E2C`, que corresponde a `ctx[3]` del bloque de contexto contiguo en `params+0x2E20`).
1. **Mecanismo**: Al escribir `ctx[3] = base[-1]` (`0x10013600`), ese destino supera el límite superior de 62 (`dest < 0 || dest > 62`), provocando que el callback universal `stSPEngineCb` escriba el parámetro `p[slot]` de forma cruda (sin suma de las seis fuentes de modulación ni recorte de rango).
2. **Replicación en `NeuronVS_port`**: Implementada en `include/neuron/mod_matrix.hpp` y `src/mod_matrix.cpp` con verificación completa (`gen_mod_matrix.py`, `mod_matrix_probe.cpp` 12/12, `verify_mod_matrix.py` 14/14 y CTest en `build32` 8/8 tests OK).
3. **Decisión de Diseño Determinista**: Para evitar comportamientos estocásticos dependientes del heap del sistema operativo, el destino víctima queda fijado en el slot del Destino 0 (`R1Volume`).


1. **Matriz de Modulación Unificada `6 × 5` en `ABDShared`**:
   - Se unifican las 6 fuentes de ejecución (`Aftertouch`, `Modulation CC1`, `Breath CC2`, `CC03`, `Foot CC4`, `Expression CC11`) en una única matriz **`6 × 5`** genérica en `ABDShared`:
     - **Slot 1** de cada fuente corresponde a los parámetros `[413..424]` de `sound.script` (con los **63 destinos** de `0x10049E00`, garantizando compatibilidad 100 % con los presets `.sound` originales).
     - **Slots 2..5** de cada fuente corresponden a los **`Free Controllers [363..410]`** ($6 \times 4$), permitiendo hasta 5 destinos simultáneos por fuente con profundidad bipolar (`-1..+1`), integrados directamente con `ABDShared/Code/MidiKeyboard`.
2. **Independencia de Frecuencia de Muestreo (`44.1 kHz` vs `48 / 88.2 / 96 kHz`)**:
   - En modo `StrictLegacyParity` (para el oráculo *golden* a `44.1 kHz`), el paso de acumuladores se mantiene idéntico al binario original (`srScale = 1.0`).
   - En modo normal (`EnhancedMode`), todos los acumuladores de fase de Resynators, envolventes `CShaper4T4L`, LFO, Slicer y retardos escalan por **`srScale = 44100.0 / sampleRate`**, manteniendo afinación y tiempos exactos a cualquier frecuencia de muestreo del host.
3. **Resolución Inteligente de `NeuronDB` + Modelo `511 (sinew)` Embebido en Memoria**:
   - El binario de `ABDAxionikVS` (`VST3`, `Standalone` y `WASM`) llevará embebido en memoria estática (`constexpr`) el **Modelo `511` (`sinew`, ~31 KB)** y el preset `000 InitSound`, garantizando que el sintetizador suene desde el primer milisegundo incluso sin base de datos externa configurada.
   - Además, el localizador de `NeuronDB` buscará automáticamente en: (1) ruta configurada por el usuario, (2) subcarpeta `NeuronDB/` junto al ejecutable/plugin, y (3) rutas conocidas de desarrollo (`C:\Users\ajaba\Downloads\neuron\NeuronVS-db\NeuronDB`).
4. **Grabador de Trayectorias (`sound.stickrec`) con Estela Visual (`Trail`) y Modos `Loop` / `One-Shot`**:
   - El componente compartido `TrajectoryStick2D` (`ABDSharedAssets`) renderizará en el canvas 2D la estela completa de la trayectoria grabada en `sound.stickrec` e incluirá controles de transporte (`Record`, `Play`, `Loop`, `One-Shot` y `Clear`).

---

## 8. Evidencia Ghidra §4.3: Comportamiento en Caliente del Motor de Síntesis y Ciclo de Vida de Descriptores

Verificado estáticamente (`verify_zones.py`, 121/121 comprobaciones) y dinámicamente mediante el diferencial de 5 pasadas en `neuron_golden.cpp` (1.755 comparaciones y 702 testigos):

1. **Cadenas de Ejecución en Caliente**:
   - **Cambio de Preset**: `FUN_100132d0` (disparado por MIDI Program Change o `Bank Select LSB + PC`) → `FUN_10046ce0` → `FUN_10013ea0` (cargador de script) → `FUN_10013ac0` → `FUN_10040550` (traductor).
   - **Cambio de Modelo**: `callback_10013620` (observador de `R1ModellIndex` / `R2ModellIndex`) → `FUN_10046b70` → $128 \times$ `FUN_100440d0` → `FUN_1003d780` → `FUN_10040550`.

2. **Inmutabilidad y No Reasignación de Voces Vivas (`e[0xD94]`)**:
   - Ninguno de los dos caminos reasigna ni libera descriptores: el array de 129 slots (`engine+0xD94`) y los dos bloques de trabajo de `0x6838 B` de cada voz son persistentes y conservan su posición en memoria.
   - Las tres funciones (`FUN_100440d0`, `FUN_10046b70`, `FUN_10046ce0`) ejecutan un barrido inicial que escribe `+0x40 = 0` en los 128 slots. El bloque posterior que teóricamente apagaría voces queda inerte al comprobar `+0x40 != 0` (que ya está a cero). Por tanto, **las voces activas que están sonando continúan reproduciéndose** con sus motores y puertas `1/1` intactos.

3. **Gestión de Tablas de Zonas de Teclado**:
   - El cambio de preset borra completamente las dos tablas de zonas ($2 \times \text{0x500 dwords}$); a continuación, el callback de modelo repuebla las capas cargadas (768 dwords por capa activa).
   - El cambio de modelo reescribe exclusivamente su propia capa, tecla a tecla.
   - **Efecto en la nota**: Dado que las zonas se leen únicamente al construir la voz en `noteOn` (§6.3), la nota viva continúa sonando con sus buffers originales sin alteración de zona. Las notas subsecuentes utilizarán las nuevas entradas de la tabla.

4. **Reseteo Global en Cambio de Preset**:
   - El cambio de preset recentra el Pitch Bend en `0xDA4 = 0.5f`, restablece `0xDAC = 1.0f` y reinicia a cero los ocho contadores de morph `0x365C..0x3678` (estos cambios sí modulan en tiempo real la voz que está sonando). El cambio de modelo no toca estos registros.

5. **Protección de Concurrencia con Flag `0xD99`**:
   - `0xD99` (flag de teclado habilitado) se apaga (`0`) al iniciar cualquier cambio de preset o modelo, evitando que entren nuevas notas con tablas de parámetros incompletas. `FUN_10040550` reenciende `0xD99 = 1` al finalizar la traducción.

6. **Cargador de Scripts `FUN_10013ea0`**:
   - Lee `sound.script` en un buffer temporal, asigna los 445 registros mediante `FUN_10001170` (primera pasada con máscara 0 sin observadores, segunda con máscara 6 para notificar observadores) y libera el buffer. No manipula descriptores ni tablas por sí mismo.

---

## 9. Disección del Cierre del Bloque de Render (Post-Procesamiento Estéreo)

Investigación y desensamblado canónico de la fase final de `renderBlock` (`FUN_1003a3b8` .. final de bloque), documentado en `ZONES.md §6.5` y verificado en `verify_r1r2_mix.py` (19 comprobaciones):

### 9.1 Cadena de Procesamiento y Flag de Voz Activa `[ebp-0xF8]`
1. **Detección de Voces Activas**: El recorrido de voces asigna `[ebp-0xF8] = 1` tan pronto como encuentra al menos una voz con `voz+0x18 == 1` (`0x10038431 → je 0x1003b8d0`: `mov al, 1` + `mov [ebp-0xF8], al`).
2. **Ejecución Condicional vs Incondicional**:
   - Sobre la bandera `[ebp-0xF8] == 1` (`0x1003a3b8 cmp al, 1 / jne 0x1003a462`), se ejecutan **`FUN_10029530`** y el escalado de ganancia **$\times 24.0$**.
   - **`FUN_100295d0`** (Chorus/Comb) y **`FUN_10029e34`** (Delay CSilverRack) se ejecutan **siempre** (incondicionales).
3. **Instancias y Trabajo in situ**:
   - Los tres módulos residen en descriptores dedicados dentro de `engine`: `+0x3650`, `+0x3654`, `+0x3658` (destruidos en `FUN_100461c4`).
   - Todos operan *in situ* leyendo y sobreescribiendo directamente los punteros `busA` (izquierdo) y `busB` (derecho).

### 9.2 Función `FUN_10029530`: Reloj y Sumador del Banco Aditivo
- Si `*st == 0`, retorna inmediatamente sin procesar muestras.
- Por cada muestra, incrementa el contador de fase `st+8`. Al sobrepasar `0x400` (1024 muestras), invoca `FUN_100330f0(st)` (reparto por voz a 1024 muestras) y resetea el acumulador a cero.
- Si `**(st+0x10) != 0`, despacha a `FUN_100279a0`, sumando al bus estéreo:
  $$\text{busA}[i] += \sin[\dots], \quad \text{busB}[i] += \cos[\dots]$$
  provenientes de un banco de parciales aditivos (anillos dobles de $N$ muestras, fase con `fmod(x, 2π)`, reescalado con factor $(2/N) \cdot \text{amp} \cdot N_2$).
- **Propiedad fundamental**: Es puramente aditivo; nunca atenúa la señal previa, o no interviene o suma energía.

### 9.3 Función `FUN_100295d0`: Coro / Filtro Comb por Bus
- `st+4` indica el modo de operación (`0.0 = bypass`, `2.0 = inyección directa` de la señal en la rama húmeda).
- El parámetro $x = \text{st}+0xC$ gobierna paramétricamente la temporización y la mezcla:
  $$\text{wet} = 2x - x^2, \quad \text{dry} = 1 - \text{wet}$$
- Tiempos de retardo:
  - $\text{Retardo A} = \text{clamp}(2500 \cdot x, 1, 44100)$ muestras.
  - El buffer de anillo es de 2500 floats con modulación LFO de 12 formas de onda (`FUN_10026a20`).

### 9.4 Función `FUN_10029e34`: Delay CSilverRack
- Implementa una línea de retardo larga por canal estéreo con buffer de anillo de 44.100 floats (1 segundo completo a 44.1 kHz).

### 9.5 Origen y Justificación del Escalar $\times 24.0$ (+27.6 dB)
- La escala $\times 24.0$ corresponde a una constante flotante de doble precisión en `.text` (`0x1030CDC0` / `0x1030CDC8`).
- No existe ningún divisor inverso $1/24.0$ en la sección.
- Se trata de una compensación deliberada de ganancia de headroom para recuperar el nivel sonoro global frente al rango dinámico requerido por la síntesis neuronal y el banco de parciales aditivos.

### 9.6 Desmitificación del Supuesto «Desplazamiento de 1 Muestra en Bus B»
- La hipótesis inicial de un retardo intencional de 1 muestra entre `busA` y `busB` fue refutada mediante el análisis del grafo de instrucciones x87.
- Dicho desfase era un simple **artefacto de rotación de bucle del compilador MSVC x87** (`fstp` colocado al inicio del bloque de la siguiente iteración con el offset relativo `+0x1FC` plegado).
- En el dominio físico/muestral, ambos buses procesan las muestras temporalmente alineadas sin desfase intrínseco.

### 9.7 Acondicionamiento Final y Etapa de Salida
1. **Dither Estéreo**: Inyección de ruido de baja amplitud para reducción de distorsión de cuantificación.
2. **Inclinación Estéreo (Stereo Tilt)**: Filtro suavizador IIR con constante de tiempo:
   $$y[n] = \frac{350 \cdot y[n-1] + x[n]}{351}$$
3. **Saturador Blando**: Invocación a `FUN_1003b930(x, 0.4, 0.75)` para comprimir crestas armónicamente.
4. **Hard Clamping**: Recorte final estricto al rango $[-1.0, +0.999]$.
5. **Manejo de NaN (`0x1000bd31`)**: Si $x^2 > 1.0$, pone la muestra a cero. No obstante, las comparaciones con `NaN` en FPU evalúan como condición desordenada (*unordered*), lo cual permitía que valores NaN escaparan si no eran sanitizados previamente. En el port C++ moderno de ABDAxionikVS se reemplaza por `std::isfinite()` y `juce::jlimit(-1.0f, 0.999f)`.

---

## 10. Reconstrucción 1:1 de Algoritmos Parset (`FUN_10031d30` / `FUN_10031e70` / `FUN_10025380`)

Al contrastar la simulación preliminar contra el vector áureo del DLL original en `GoldenParityTest` (`note60_176_44100_512.wav`), se descubrió que `CResynator` en `NeuronOscillators.h` utilizaba mezclas algebraicas aproximadas en lugar del despachador de síntesis nativo:

### 10.1 Cadena de Procesamiento del Resonador en `FUN_1002e7a0`
El flujo real de una voz en `NeuronVS.dll` es:
1. `FUN_100317b0`: Lector de ondas Scape (`CurveReader`).
2. `FUN_10031d30`: Despachador de síntesis Parset (aplica el modo 0..9 sobre la muestra de excitación).
3. `FUN_10031950`: Lector de bandas de formantes Sphere (`BandReader`).
4. `FUN_1002e7a0`: Mezclador Blender entre R1 y R2.

### 10.2 Primitivas Clave de Síntesis Modal Portadas
1. **`SchroederComb` (`FUN_10023fe0`)**:
   Línea de retardo fraccional circular de 2048 muestras (`0x800`) con interpolación lineal y lazo de retorno configurable.
2. **`BiquadCell2Pole` (`FUN_10032630`)**:
   Celda diferencial IIR de 2 polos:
   $$y[n] = b_0 x[n] - a_1 y[n-1] - a_2 y[n-2], \quad \text{out} = y[n] - y[n-2]$$
3. **Tablas Estáticas Originales extraídas de `NeuronVS.dll`**:
   - `sineTable8192`: 8192 muestras senoidales calculadas con el paso canónico $\Delta\theta = 0.0007669903939428206$ (`_DAT_1030bc30`).
   - `noiseTable4096`: 4096 muestras de ruido estocástico uniforme (`DAT_102355c0`) para dispersión de formantes.
4. **Modo 0 (`FUN_10031e70`, Preset 176 *DangerDrone*)**:
   - Modulación de fase en wavetable senoidal de 8192 muestras.
   - Célula 1 (`DAT_10055018`: $\{0.0288293, -1.9310267, 0.9423414\}$) $\times 14.0$.
   - Modulación estocástica por tabla de ruido.
   - Peine Schroeder doble con retardos de 256 y 512 muestras.
   - Célula 2 (`DAT_10055004`: $\{0.0168008, -1.9632061, 0.9663985\}$).
   - Suavizador de 1 polo con $\alpha = \frac{1}{52}$ y realimentación del 90%.
5. **Modos 6..9 (`FUN_10025380`)**:
   Banco de 3 biquads resonantes paralelos (resonador de formantes).

---

## 11. Auditoría y Corrección de Efectos Silver Rack (`FUN_10029e34` / `FUN_100295d0`)

Se auditó línea a línea `10029e34_FUN_10029e34.c` (1.517 líneas) y `100295d0_FUN_100295d0.c` (186 líneas), detectando y corrigiendo las siguientes desviaciones:

### 11.1 Corrección de la Curva 5 de Distorsión
- **Error Previo**: Se había asumido erróneamente que la curva 5 (`DS_ClipCurveType = 5`) era un rectificador de onda completa (`abs(x)*2 - 1`), provocando distorsión agresiva y armónicos agudos estridentes en presets que la usaban (como *DangerDrone* #176).
- **Comportamiento Real del DLL (`FUN_10029e34` L181-234)**:
  La curva 5 carece de rama condicional de saturación en el desensamblado; es un **overdrive lineal transparente** con pre-filtro y control de ganancia.
- **Curvas de saturación analógica canónicas**:
  - Curva 0: Recorte duro (`clamp(-1, 1)`).
  - Curva 1: Saturación racional de diodo: $x \cdot \frac{4}{|x|\cdot 3 + 1}$.
  - Curva 2: Válvula asimétrica basada en ley de potencia.
  - Curva 3: Asimétrica polinomial.
  - Curva 4: Wavefolder / plegado de onda senoidal.
  - Curva 5: Lineal (sin saturación no lineal).

### 11.2 Pre-filtro y Escalas 1:1
- Pre-filtro pasa-bajos canónico:
  $$d_{12} = 30.0 \cdot preFilter, \quad d_{13} = \frac{1}{1 + d_{12}}$$
  $$\text{state} = (\text{state} \cdot d_{12} + \text{in}) \cdot d_{13}$$
- Escala de ganancia fija: $\times 25.0 \cdot inGain \cdot outGain$.
- Eliminados multiplicadores y desplazamientos artificiales en `DspEngineFacade.cpp`.

### 11.3 Retardo Estéreo L/R
- En `FUN_100295d0`, el retardo del canal derecho es exactamente la mitad del izquierdo ($d_R = d_L / 2$, `uVar12 >> 1`), corrigiendo la relación previa de $3/4$.

### 11.4 Impacto en la Paridad Áurea y Verificación Completa (`--zones` + `--matrix`)
Tras la aplicación de estas correcciones junto con la alineación 1:1 del Filtro Silver por voz (`FUN_10021c90`, escalera Moog de 5 polos + SVF + RBJ con LUTs de 8192 entradas), las 12 formas de onda LFO canónicas (`FUN_10044884` / `neuron-lfos.pdf`), la ley de panoramización central `0.5f` (`FUN_100382b0`), la Reverb Maestra híbrida (`ABDEep` `SchroederReverb` + `DspFdnReverb`) y la conexión de la Matriz de Modulación con remapeo de observadores (`FUN_100012a0`), los resultados en `GoldenParityTest` para el Preset 176 (*DangerDrone*) son:
- **Correlación Canal Izquierdo**: **$+0.596889$** (frente a $-0.002$ inicial).
- **Correlación Canal Derecho**: **$+0.474330$** (frente a $+0.005$ inicial).
- **Diferencia media**: reducida a **$0.222480$**.
- **Verificación de Zonas (`--zones`)**: **`VEREDICTO ZONAS: CORRECTO`** (`128/128` teclas validadas para R1 y R2).
- **Verificación de Matriz (`--matrix`)**: **`VEREDICTO MATRIZ: CORRECTO`** (`63/63` destinos remapeados + `6` controles MIDI en tiempo real validados).

### 11.5 Régimen de Calentamiento de la DLL Original (`NeuronVS.dll`) en Tests de Paridad
- **Comportamiento Detectado en Oráculo**: Al ejecutar pruebas de paridad automatizadas consecutivas contra `NeuronVS.dll`, la instancia de la DLL original altera su régimen interno acumulativo entre la 3ª y la 4ª carga de preset. Las primeras 3 cargas renderizan bit-idéntico; a partir de la 4ª carga, el motor sufre un desplazamiento medio de audio de $\sim 0.267$ debido a residuos en variables estáticas internas del binario original de 2004.
- **Protocolo de Evaluación Áurea**: En cualquier pipeline de prueba diferencial automatizada (`GoldenParityTest`), **deben descartarse siempre los primeros 4 renders de calentamiento (warm-up)** para comparar contra el régimen permanente y estable de la DLL.

### 11.6 Corrección de Inversión de Argumentos Freq/Gain en EQ 4-Bandas (`DspEngineFacade.cpp`)
- **Desviación Detectada**: En `Source/DSP/DspEngineFacade.cpp` (`setEQParams`), los argumentos pasados a la etapa de ecualización de 4 bandas (`silverRack_.setEQParams`) estaban en orden inverso (`freq` en la posición de `gain` y `gain` en la posición de `freq`) para las 4 bandas (`Low Shelf [287/288]`, `Band 1 [291/292]`, `Band 2 [295/296]` y `High Shelf [299/300]`).
- **Corrección**: Se corrigió el orden de paso de argumentos en `DspEngineFacade.cpp` para ajustarse exactamente a la firma canónica de `ABDShared::DspEffects::ParametricEQ4Band`:
  ```cpp
  silverRack_.setEQParams(
      eqLowShelfGain_, eqLowShelfFreq_,
      eqBand1Gain_, eqBand1Freq_,
      eqBand2Gain_, eqBand2Freq_,
      eqHighShelfGain_, eqHighShelfFreq_
  );
  ```
- **Integración de `Shaper3Status` (`[362]`)**: Incorporado al catálogo de constantes `ParamIdx.Shaper3Status = 362` en `paramIndices.ts` para gobernar el conmutador de activación del Shaper 3 (Filtro / EFX Env) tanto en la WebUI (`ShapersPanel.ts`) como en el puente DSP.
