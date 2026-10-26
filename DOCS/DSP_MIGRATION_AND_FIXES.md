# Guía de Migración del Motor DSP, Cierre de Incógnitas y Corrección de Bugs (`NeuronVS.dll` → `ABDAxionikVS`)

Este documento deja registrado, antes de escribir una sola línea de código de producción, el mapa completo del desensamblado de `NeuronVS.dll` (v1.0 PC, `SHA-256: b27dbe76...`), la resolución de las incógnitas que habían quedado abiertas en el estudio previo, la eliminación total del hardware `<Nuke>`, los **9 fallos/bugs** detectados en el binario original y en el esqueleto preliminar (`NeuronVS_port`), y el catálogo de mejoras técnicas para `ABDAxionikVS`.

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
           if (slot == 0xA4) {
               *reinterpret_cast<float*>(params + 0x0C) = new_val;
               float* p_slot = reinterpret_cast<float*>(params + 0x278C + slot * 4);
               if (*p_slot == 0.0f) *p_slot = new_val;
           } else if (slot == 0xC2) {
               *reinterpret_cast<float*>(params + 0x10) = new_val;
               float* p_slot = reinterpret_cast<float*>(params + 0x278C + slot * 4);
               if (*p_slot == 0.0f) *p_slot = new_val;
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

---

## 3. Los 9 Bugs y Limitaciones que Corregiremos en la Migración

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

---

## 4. Catálogo de Mejoras Arquitectónicas y Sonoras para `ABDAxionikVS`

Además de corregir los 9 puntos anteriores, dejamos documentadas las mejoras que habilitaremos gracias a este desacoplamiento:

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

## 6. Las 4 Decisiones de Diseño Cerradas para la Implementación

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

