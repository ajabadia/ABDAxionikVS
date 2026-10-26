# NeuronVS_port

Reconstrucción compilable de la superficie VST2 de `NeuronVS.dll`: cabecera
`AEffect`, dispatcher de los 77 opcodes, 26 parámetros y los slots del core y del
editor. Sin SDK de Steinberg y sin hardware Neuron.

Incluye ya el **núcleo de datos sin JUCE** del plan N1: la tabla de los 445
parámetros (generada desde `preset_schema.csv`), el códec `.sound` y el
localizador de `NeuronDB`.

El plan de la superficie está en [PLAN.md](PLAN.md); el plan vigente del producto
(JUCE 9, WebView2, VST3, x64 y normas de ABDShared) está en
[PLAN_JUCE9.md](PLAN_JUCE9.md).

La frontera entre parámetros y motor —`FUN_10040550` traducida a C++, con la
tabla de las 456 escrituras al estado y sus dudas abiertas— está en
[docs/TRANSLATOR.md](docs/TRANSLATOR.md). La otra frontera, la del modelo:
cómo las 128 zonas de `map.script` acaban en las dos tablas de 40 B por tecla
que lee el render, está en
[../NeuronVS_dsp/ZONES.md](../NeuronVS_dsp/ZONES.md); `neuron_golden --zones`
la vuelca contra el DLL.

## Construir y verificar

```bash
# x64 (y x86 con -A Win32 en otro directorio)
cmake -S NeuronVS_port -B NeuronVS_port/build -G "Visual Studio 18 2026" -A x64
cmake --build NeuronVS_port/build --config Release

# host sin GUI: cabecera, identidad, parámetros, MIDI, editor, 77 opcodes;
# el modelo 511 renderizando muestras reales; y los 351 presets (3 tests en x64;
# en Win32 se añaden el contrato del traductor y el diferencial: 6 tests)
ctest --test-dir NeuronVS_port/build -C Release --output-on-failure

# el modelo, suelto, con el WAV del render de la curva
export NEURON_DB="$PWD/Hartmann Music/NeuronVS/NeuronDB"
./NeuronVS_port/build/Release/model_probe --wav curve_441.wav

# la tabla de 445 claves y el códec .sound, con el roundtrip de los 351
./NeuronVS_port/build/Release/core_probe

# el contrato: CSV <-> código generado
python NeuronVS_port/tools/verify_scaffold.py

# el traductor: regenerar y comparar con el pseudocódigo (7 comprobaciones)
python NeuronVS_port/tools/gen_translator.py
python NeuronVS_port/tools/verify_translator.py

# diferencial del traductor (sólo Win32): FUN_10040550 del DLL contra
# neuron::translate, dword a dword sobre los 13.948 B del estado y los 335
# dwords de `p`. Cada preset se compara dos veces: tras cargarlo y a mitad de
# nota (voces, LFO, envolventes y morph en curso). También está registrado como
# test: ctest -R translator_differential
# (lanzar el .exe directamente, no a través de ctest desde MSYS).
# El barrido 0..350 deja 18 presets con 1 ULP de diferencia a mitad de nota:
# docs/TRANSLATOR.md §8 y §9.5.
NeuronVS_port/build32/Release/neuron_golden.exe --translate --preset 000,176,285,337

# N1: tabla generada, códec y los 351 presets byte a byte
python NeuronVS_port/tools/gen_core_table.py --check
python NeuronVS_port/tools/verify_core.py

# carga el .dll y habla el ABI por ctypes, con su propia definición de AEffect
python NeuronVS_port/tools/probe_dll.py NeuronVS_port/build/Release/neuron_vst2.dll
```

## Regla del proyecto

`NeuronVS_vst2/opcodes.csv` y `parameters.csv` son la fuente de verdad. El
dispatcher y la tabla de parámetros se generan:

```bash
python NeuronVS_port/tools/gen_vst2_bindings.py            # reescribir
python NeuronVS_port/tools/gen_vst2_bindings.py --check    # falla si hay deriva
```

Editar `src/gen/*.inc` a mano se pierde en la siguiente regeneración; para
cambiar el comportamiento, se cambia el CSV (que a su vez verifica
`NeuronVS_vst2/tools/verify_vst2.py` contra el binario).

## Núcleo de datos sin JUCE (N1)

El target `neuron_core` no incluye JUCE, Windows ni el ABI VST2: son los datos
que el plugin necesitará en N4 y que se pueden probar solos.

| archivo | qué hace |
| --- | --- |
| `include/neuron/params.hpp` + `src/params.cpp` | tabla de los 445 parámetros y la regla de valor de `FUN_10001170` |
| `include/neuron/preset.hpp` + `src/preset.cpp` | lector/escritor de `sound.script`, nombre y migraciones |
| `include/neuron/data_root.hpp` + `src/data_root.cpp` | localiza `NeuronDB` y compone las rutas `Models/` y `Sounds/` |
| `src/gen/params_table.inc`, `gen/parameter_table.json` | generados por `tools/gen_core_table.py` |
| `tests/core_probe.cpp` | aceptación: 445 claves y los 351 presets byte a byte |
| `tools/verify_core.py` | verificador independiente de lo anterior |

### Tabla de 445 claves

`NeuronVS_preset_format/preset_schema.csv` sigue siendo el contrato. El
generador emite una fila `PARAM(...)` por clave (con el hash SHA-256 del CSV en
la cabecera) y el mismo contenido en JSON para las herramientas:

```bash
python NeuronVS_port/tools/gen_core_table.py            # reescribe los dos artefactos
python NeuronVS_port/tools/gen_core_table.py --check    # falla si hay deriva
```

Son 445 filas en seis grupos (`SoundHeader` 6, `SoundName` 16, `R1` 109, `R2`
109, `Synth` 190, `SoundMFX` 15), paso 1 en todas y `min <= max`. Cada fila
guarda el valor tal cual está en el descriptor y calcula el **valor inicial**
con la regla del motor:

```
si step != 0:  value = trunc(value / step) * step
value = min(max(value, min), max)
```

`FUN_10001170` aplica esa regla al construir cada registro, así que los **19**
parámetros cuyo default (0) cae por debajo de `min` (1) arrancan en **1**, no en
0: los doce `*StickPlayback` de R1/R2, los tres `SilverL*StickPlayback` y los
cuatro `EQ_*` (bajo `min` y `max` 100).
`Parameter::initial()` devuelve ese valor de motor y `quantize()` la regla
completa; `clamp()` es sólo el recorte de `FUN_100014c0`, que es lo que usa el
escritor.

### Códec `.sound`

`SoundPreset` reproduce `FUN_10001910` / `FUN_10001af0`:

- lee líneas `clave<TAB>entero` con CRLF o LF, **el orden no importa**, la clave
desconocida se ignora (pero se conserva en `unknownKeys()`), la repetida se
queda con la última y la ausente mantiene el default del descriptor;
- `engineValue(i)` devuelve el valor ya pasado por `FUN_10001170`, que es lo que
  el motor tendría tras cargar el fichero;
- `serialize()` escribe en orden de esquema con `\r\n`, recorta a `min..max` y
trunca a entero, igual que el escritor; `serialize(false)` (por defecto) escribe
sólo las claves que tenía el fichero, y por eso los **351** presets vuelven byte
a byte;
- `serialize(true)` es el fichero canónico de 445 líneas, el que produce un
preset nuevo;
- `name()` / `setName()` usan `SoundNameC00..C15` como códigos ASCII 32..122,
rellenan con espacios y escriben `?` fuera de rango;
- no reproduce el `fgets(buffer, 0x100)` de 2004: una línea de más de 255 bytes
se lee entera (en los 351 presets la más larga mide 31 caracteres);
- `migrateMissing()` rellena las claves ausentes con su valor de motor: es la
migración de **011, 012 y 023**, los tres ficheros de **444** líneas a los que
les falta `SlicerSwitchBackup` (índice 429, default 0);
- `applyVersionMigration()` reproduce la rama de `FUN_10013ea0`: con
`SoundVersionMajor < 2`, `BlenderAmount -= 64`. Ninguno de los 351 presets la
necesita (todos declaran 2.0.0), pero queda probada con un preset sintético.

### `DataRoot`

El orden es explícito, sin `RegQueryValueExA` y sin datos incrustados:

1. ruta explícita (`--db`, constructor);
2. `NEURON_DB`;
3. `%APPDATA%\Hartmann Music\NeuronVS\NeuronDB` y `%LOCALAPPDATA%\...` (en
   Windows); `~/.config/...` y `~/.local/share/...` fuera de Windows.

Expone `Models/`, `Sounds/`, `presetScript(id)` (`Sounds/%03d.sound/sound.script`,
como `0x10054568`), `hasPreset(id)`, `presetIds()` y `firstFreeSlot()`; el id es
la carpeta y va de 000 a 999. En la copia del instalador hay 351 ocupados y 649
libres, con primer libre 351.

### Verificación

`core_probe` hace **122 comprobaciones**: la tabla (445 filas, 19 defaults
recortados, búsqueda por clave, cuantización con paso 4 y negativos), el códec
(orden, desconocidas, duplicadas, errores con línea, nombre, migración v1,
recorte 999→32 y −5→1), `DataRoot` (explícita, `NEURON_DB`, slots) y el
roundtrip de los 351 ficheros con sus nombres distintos y las tres excepciones
de 444 líneas. Sin `NeuronDB` sale con 77 y CTest lo marca como *skipped*.

`tools/verify_core.py` no se fía del probe: rehace la tabla desde el CSV,
compara el `.inc` y el JSON fila a fila, recorre los 351 presets con el códec de
Python y ejecuta los dos `core_probe` construidos (x64 y x86). También se probó
al revés: cambiar una fila del `.inc` o un valor de un preset hace fallar la
verificación.

## NeuronDB: el modelo y sus dos lectores

`include/neuron/neurondb.hpp` + `src/neurondb.cpp` (target `neuron_data`) cargan
un modelo del banco de datos y lo exponen a los dos lectores del motor. El
modelo es una carpeta: `NeuronDB/Models/%03d.model` con `%06d.scape`,
`%06d.sphere` y `MName` (los tres nombres los compone `FUN_1000b230`). Para 511:
carpeta `511.model`, nombre `sinew`, ficheros `000001.scape` / `000001.sphere`.

La raíz se resuelve con `DataRoot` (ruta explícita, `NEURON_DB` o la ruta de
usuario); el port no lee el registro de Windows. Sin datos, `model_probe` y
`core_probe` salen con 77 y CTest los marca como *skipped*.

Contenedor (los tamaños incluyen su cabecera de 8 bytes, como en RIFF):

| chunk | scape 511 | sphere 511 | contenido |
| --- | --- | --- | --- |
| `csAN` / `psAN` | 100 | 140 | cabecera tipada; `+0x08` formato/versión, `+0x0c` curve id |
| `mnAN` | 104 | 104 | 12 nombres de 8 caracteres |
| `fdAN` | 56 | 56 | 6 pares de floats |
| datos | 137476-260 | 440356-300 | curva int16 / banco de frames |

Lo medido en `511.model`, que es lo que comprueba `model_probe`:

| campo | valor |
| --- | --- |
| curve id (scape y sphere) | `0xC1B5D423` (-1045048285) |
| resolución / longitud de la curva | 100 muestras por ciclo / 66940 |
| bucle | `[31472, 62843)`, span 31371 |
| muestras int16 | 68608, min -1708, max 1551 |
| frames en el fichero | 67 (`300 + 67*6568 = 440356`) |
| frames direccionables | 64 (`sphere+0x18`); el 66 del fichero está a cero |
| frame | `stride 6568`, `magic 1234`, `id = curve_id + índice` |
| bandas | 25 × 4 slots por frame, `+0x10 + banda*16` |
| bloque por frame | 6152 bytes tras las bandas, no interpretado |
| decodificación | `decode_mode 0` → 1024 muestras por frame (1 → 512) |

**`CurveReader` (`FUN_100317b0`)** avanza `posición += paso`, mete la posición en
`[loop_start, loop_end)` restando el span, interpola
`(1-frac)*s[i] + frac*s[j]` con `j = i+1` (también envuelto sobre el span) y
devuelve `(v - anterior)*2 + v` por la ganancia de `voice+0x160`. Sin bucle, al
pasar `length - 1` la voz se para (`voice+0x6835`) y devuelve 0. A 44.1 kHz y
441 Hz el paso es 1.0 (100 muestras por ciclo), así que el test compara muestra
a muestra contra el fichero.

**`BandReader` (`FUN_10031950`)** avanza un frame cada 1024 muestras
(`decode_mode`) y mezcla `frame[i-1]*(1-w) + frame[i]*w` con
`w = (int(posición) & 1023)/1024`, es decir la parte fraccionaria de
`posición/1024` a resolución 1/1024; `i` se limita a 63 (`FUN_10031cd0`,
`FUN_10032940`) y el índice 0 lee dos veces el frame 0.

Límites que el test deja escritos, no escondidos:

- las 25 bandas de este modelo son un perfil casi plano (0.99853 … 0.99021) que
  varía en el cuarto decimal, así que el lector de bandas entrega una envolvente
  prácticamente continua; la variación audible de un `.sound` no está en estas
  25 bandas sino en el bloque de 6152 bytes, que este hito no interpreta;
- la ganancia por slot (`voice+0x48`) y la cadena de índices (`voice+0x6424`) son
  estado de ejecución que construye `FUN_100254c0`, no datos del fichero: el
  port expone los 4 slots crudos y su suma, sin inventar la cadena;
- el bind original lee las muestras en el desplazamiento fijo `0x104` y los
  frames en `+0x48`; el cargador avisa (en `Model::notes`) si un fichero no
  coincide con ese layout en lugar de leer fuera del buffer.

Resultado: `model_probe` hace 108 comprobaciones y rinde 4410 muestras de la
curva (pico 4698, rms 1096) y 65536 del barrido de bandas, idénticas bit a bit
entre dos ejecuciones; el WAV opcional permite comprobarlo fuera del C++.

## N2: oráculo dorado (x86, DLL original)

`tools/neuron_golden.cpp` es un host VST2 mínimo que **carga el `NeuronVS.dll`
original** y lo trata como lo haría un DAW: `main(&audioMaster)`, `effOpen`,
`effSetSampleRate`, `effSetBlockSize`, `effMainsChanged`, MIDI por
`effProcessEvents` y bloques por `processReplacing`. Graba cada vector en WAV
float32 estéreo y escribe `manifest.json` con el sha256 del fichero y del PCM,
para que el DSP portado se compare muestra a muestra sin depender de este
código.

El `.dll` es PE32 de 2004, así que el target **sólo existe en Win32** (el
`if(WIN32 AND CMAKE_SIZEOF_VOID_P EQUAL 4)` de `CMakeLists.txt`); no enlaza el
SDK de Steinberg, usa `include/neuron/vst2_abi.hpp`.

```bash
cmake -S NeuronVS_port -B NeuronVS_port/build32 -G "Visual Studio 18 2026" -A Win32
cmake --build NeuronVS_port/build32 --config Release --target neuron_golden

# 12 capturas a NeuronVS_port/golden (NeuronDB por defecto: ../Hartmann Music)
./NeuronVS_port/build32/Release/neuron_golden.exe

# qué preset aplica el motor y qué rinde una nota, sin escribir nada
./NeuronVS_port/build32/Release/neuron_golden.exe --probe

# un preset/vector suelto y un render corto para CTest
./NeuronVS_port/build32/Release/neuron_golden.exe --preset 337 --only chord
./NeuronVS_port/build32/Release/neuron_golden.exe --quick --out build32/golden_quick
```

### Vectores

| vector | MIDI | qué fija |
| --- | --- | --- |
| `note60` × 176/337/285 | nota 60, vel 100, 1 s | tres presets; 285 cae en un modelo ausente |
| `note60` 48 kHz / 96 kHz | la misma nota | remuestreo y coeficientes por `sampleRate` |
| `note60` bloque 64 | la misma nota | que el render no depende del tamaño de bloque |
| `chord` | 60/64/67/72 a la vez | suma de voces y ganancia |
| `noteoff` | nota 60, off a 0.25 s | release y cola |
| `steal` | 12 notas (48..59), una por bloque, off a 0.6 s | robo de voces |
| `cc` | CC1/2/3/4/11 escalonados | modulación sin cambiar de preset |
| `bend` | 0 / 4096 / 8192 / 16383 | pitch bend |
| `program` | CC32 + program change a 337 a 0.5 s | cambio de preset en caliente |

Cada captura dura un segundo exacto (44100, 48000 o 96000 frames) y se escribe
como `vector_preset_rate_block.wav`: 44 bytes de cabecera RIFF
(`format 3`, 2 canales, 32 bits) y el PCM intercalado little-endian.

### Carga del preset

Se usa el camino del binario, no una llamada interna: CC32 fija el banco y el
program change envía `banco*100 + programa` al motor (caso `0xc0` de
`0x1000b7f0`), que compone `Sounds/%03d.sound/sound.script` y llama a
`FUN_10013ea0`. `--probe` lo deja escrito: al abrir, **110** de los 445
parámetros difieren de `176.sound`; tras el program change difieren **0**. Si
un motor no los aplicara, el oráculo recurre a `FUN_10013ea0`
(`SoundData::load`) y lo marca como `direct_load`; con este DLL no hace falta:
las 12 capturas dicen `program_change` y `param_mismatch: 0`.

### Manifiesto y verificación

```json
{
  "format": "neuron-golden/1",
  "dll": "…/NeuronVS.dll", "dll_sha256": "b27dbe76…f7800",
  "db": "…/NeuronDB",
  "captures": [{
    "vector": "note60", "preset": 176, "sound": "DangerDrone",
    "model": 511, "model2": 511, "missing_models": [],
    "sample_rate": 44100, "block_size": 512, "frames": 44100, "channels": 2,
    "wav": "note60_176_44100_512.wav",
    "wav_sha256": "060eeae6…2c0", "pcm_sha256": "592dee13…514",
    "peak": 0.550476849, "rms": 0.126313322,
    "finite": true, "silent": false,
    "load": "program_change", "param_mismatch": 0
  }]
}
```

`wav_sha256` cubre la cabecera y el PCM; `pcm_sha256` sólo las muestras, que es
lo que un port puede igualar aunque escriba otra cabecera.

```bash
# relee los WAV, rehace los sha256, pico/rms y cobertura; --other compara dos tiradas
python NeuronVS_port/tools/verify_golden.py
python NeuronVS_port/tools/verify_golden.py --other /ruta/de/otra_tirada

# puntúa el render de un port contra el manifiesto
python NeuronVS_port/tools/compare_golden.py --candidate /ruta/del/port
python NeuronVS_port/tools/compare_golden.py --candidate /ruta/del/port --exact
```

`verify_golden.py` hace **232 comprobaciones** (235 con `--other`): RIFF/WAVE
float32 estéreo, sha256 de fichero y PCM recalculados con `hashlib` (no se fía
del manifiesto),
pico/rms, `finite`, que no haya WAV fuera del manifiesto, y la cobertura de N2
(tres presets, modelo 511, 44.1/48/96 kHz, bloques 512 y 64). Dos tiradas
seguidas dan **12/12 idénticas** y un `manifest.json` **byte a byte igual**.

`compare_golden.py` compara el audio, no los hashes: por defecto exige
`|diff| <= 1e-6` (-120 dBFS) en cada muestra y falla con el peor caso y su
captura; `--exact` exige el mismo `pcm_sha256`, que es lo que cumplen las dos
tiradas del oráculo. También comprueba que el WAV dorado no se haya editado a
mano. Probado al revés: sumar `1e-3` a una sola muestra de `chord` da
`1 failure` con `worst |diff| 1.00e-03 at chord/176/44100/512`.

En CTest, `golden_oracle` ejecuta `--quick` (una captura, 44100/512) y tarda
~9 s; sin el DLL o sin `NeuronDB` sale con 77 y CTest lo marca *skipped*.

### Límites que quedan escritos

- **Un proceso para las 12 capturas.** El motor guarda estado global (el `rand`
  de la asignación de voces, la frecuencia de muestreo), así que `--only steal`
  suelto no da el mismo WAV que `steal` dentro de la secuencia: 0.6005 de pico
  frente a 0.7792. La referencia es la tirada completa (o `--quick`, que es su
  primera captura); `--only` sirve para depurar, no como caso aislado.
- **285 sale en silencio y es correcto.** Su R1 está apagado y su R2 usa el
  modelo 338, que no está en la copia instalada de `NeuronDB`; el manifiesto lo
  dice (`missing_models: [338]`) y el oráculo lo avisa como `WARN` en vez de
  fallar. El umbral de silencio es 1e-6 (-120 dBFS): por debajo, el render es el
  ruido del motor (8.9e-8 en este caso).
- Sólo hay un modelo instalado (511), y por eso 176 y 337 son los presets
  audibles del set; añadir un preset con otro modelo exige tener sus ficheros.
- Los WAV dorados pesan **4.7 MB** en total; son artefactos de referencia, no
  fuente del port.
