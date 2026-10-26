# NeuronVS — el formato de preset (`sound.script`) y su esquema

Un preset de NeuronVS (Hartmann Music, 2004) es el fichero de texto `Sounds/NNN.sound/sound.script` dentro de `NeuronDB`. El DLL no guarda binarios: **vuelca los 445 parámetros del motor** como líneas `Clave<TAB>valor` y los relee buscando cada clave por nombre. Este paquete reconstruye ese formato desde el binario, publica el **esquema declarado** de los 445 parámetros (rango, valor por defecto y paso) y trae un códec en Python que lee, valida, crea y edita presets, más un verificador que lo comprueba todo contra `NeuronVS.dll` y contra los 351 presets instalados.

El contexto de carpeta (registro, rutas, `sound.stickrec`, modelos, caché de nombres) está en el paquete hermano [`NeuronVS_neurondb`](../NeuronVS_neurondb/README.md); aquí se documenta sólo el fichero de preset y su esquema.

| Archivo | Qué contiene |
|---|---|
| [`preset_schema.csv`](preset_schema.csv) | los 445 parámetros en orden: clave, grupo, `min`, `max`, `default`, `step`, si el default cae dentro del rango, y qué se observa en los presets instalados |
| [`PARAM_RECORD.md`](PARAM_RECORD.md) | la tabla de ejecución: qué función convierte los 445 descriptores de `0x1c` en registros de `0x28` y qué hay en cada campo |
| [`OBSERVER_CALLBACK.md`](OBSERVER_CALLBACK.md) | el callback de cambio de modelo (`0x10013620`): qué registros reescribe y cómo reconstruye el motor |
| [`tools/build_schema.py`](tools/build_schema.py) | decodifica el bloque de descriptores del DLL y reescribe `preset_schema.csv` |
| [`tools/preset.py`](tools/preset.py) | códec: `show`, `roundtrip`, `new`, `set` y el gestor de slots `slots`, `clone`, `rename`, `delete`, `names`, `sync`, `journal`, `undo`; importable como `Schema`/`Preset`/`SoundLibrary`/`Journal` |
| [`tools/verify_preset.py`](tools/verify_preset.py) | verifica el esquema, el lector, el escritor, la migración, los 351 presets y el códec |

## Gramática

```
archivo   := linea*
linea     := clave '\t' entero CRLF
clave     := 1..28 caracteres ASCII imprimibles, sin TAB   (las 445 de preset_schema.csv)
entero    := ['-'] digito+
```

- **445 líneas** en los presets actuales; **444** en `011.sound`, `012.sound` y `023.sound`, a los que les falta `SlicerSwitchBackup` (índice 429).
- **CRLF** (`\r\n`) al final de cada línea, incluida la última; el `\n` sale así porque el escritor abre el fichero en modo `"w"` (texto) en Windows.
- El orden del fichero es el de la tabla de parámetros (el de `preset_schema.csv`), pero **no es significativo al leer**: el parser compara la clave con las 445 entradas y la busca, así que un fichero desordenado se carga igual.
- Tamaño típico: 8.858–8.944 bytes; la línea más larga de las 351 es de 31 caracteres y la clave más larga (`Free4Level4TimeVelocityDepth`) de 28. El lector usa `fgets(buffer, 0x100)`: una línea de más de 255 bytes se partiría en dos y se perdería.
- El `id` del sonido va de **000 a 999** (el cargador exige `-1 < id < 1000`); es la carpeta, no el contenido. El nombre visible está *dentro* del fichero.

Ejemplo (`000.sound`, *Symbiont*, primeras y últimas líneas):

```
SoundVersionMajor	2
SoundVersionMinor	0
SoundVersionBuild	0
SoundPan	0
SoundPanKeyTrack	0
SoundNumVoices	6
SoundNameC00	83
SoundNameC01	121
…
R1ModellIndex	336
R1Switch	1
R1Volume	95
…
SoundMFXRevSpeed	0
```

## El esquema declarado

Cada parámetro tiene un descriptor de **0x1c bytes** en `.rdata`, a partir de `0x10049f08`, en el mismo orden en que se escribe el fichero:

| Offset | Tipo | Campo |
|---:|---|---|
| `+0x00` | `char *` | nombre (`"SoundVersionMajor"`, `"R1Volume"`, …) |
| `+0x04` | `char *` | reservado; apunta a la cadena vacía `0x10055140` en los 445 |
| `+0x08` | `char *` | reservado; ídem |
| `+0x0c` | `float` | mínimo |
| `+0x10` | `float` | máximo |
| `+0x14` | `float` | valor por defecto |
| `+0x18` | `float` | paso (**1.0** en los 445) |

`preset_schema.csv` es ese bloque decodificado, más las columnas observadas en los presets instalados:

| Columna | Origen |
|---|---|
| `index`, `key`, `group` | posición (0–444), nombre y grupo (`SoundHeader` 6, `SoundName` 16, `SoundMFX` 15, `R1` 109, `R2` 109, `Synth` 190) |
| `min`, `max`, `default`, `step` | los cuatro `float` del descriptor |
| `default_in_range` | `no` cuando el default está fuera de `min..max` |
| `files_present`, `distinct_values`, `observed_min`, `observed_max` | recuento y rango real sobre los 351 `sound.script` |

Coordenadas fijas: el triple de versión en 0–2, `SoundNameC00`–`SoundNameC15` en 6–21 (rango 32–122, códigos ASCII del nombre), `BlenderAmount` en 262 y `SlicerSwitchBackup` en 429.

### 19 defaults quedan por debajo del mínimo

En 19 parámetros el descriptor declara `min = 1` y `default = 0`, es decir, un **0 como "sin asignar"** que el rango no admite:

```
R1L1SphereStickPlayback … R2L3ScapeStickPlayback   (12 parámetros *StickPlayback)
SilverL1StickPlayback, SilverL2StickPlayback, SilverL3StickPlayback
EQ_LowShelfSlope, EQ_Band1Q, EQ_Band2Q, EQ_HighShelfSlope   (min 1, max 100)
```

Ningún preset guardado contiene esos ceros: al escribir, todo valor se recorta a `min..max` (siguiente apartado), así que el 0 del descriptor se convierte en 1. El códec reproduce esa regla: un preset nuevo escribe `1` en esos 19 campos.

## Cómo se lee (`FUN_10001910`)

1. `FUN_10013ea0` valida el `id`, formatea `"Sounds/%03d.sound/sound.script"` (`0x10054568`) y llama al parser con un `float[445]` recién reservado.
2. El parser **siembra el array con los defaults**: recorre la tabla de parámetros en registros de `0x28` bytes y copia el `float` de `+0x14`. Esa tabla no es el bloque de descriptores: la construye `FUN_10013de0` al arrancar y su layout está en [`PARAM_RECORD.md`](PARAM_RECORD.md):

   ```asm
   100019a4  ADD EAX,0x28                 ; siguiente registro
   100019ab  MOV ESI,[EAX+ESI-0x14]       ; default del registro (puntero ya avanzado)
   ```

   Una clave ausente del fichero se queda, por tanto, con su default: el formato **no exige** las 445 líneas.
3. Abre con `fopen(ruta, "r")` y por cada línea hace `fgets(buffer, 0x100)` + `sscanf(linea, "%s %f", clave, &valor)` (`"%s %f"` en `0x1005209c`).
4. Busca la clave por `strcmp` contra los nombres de la tabla (`ADD EBP,0x28` por registro) y escribe el valor en su índice. Consecuencias: **las claves desconocidas se ignoran en silencio** y **una clave repetida se queda con la última**.
5. Los valores son `float` en memoria aunque el fichero sólo contenga enteros: los 156.192 valores publicados no tienen parte fraccionaria, pero el tipo explica el `%f` y el recorte del escritor.

Los valores se aplican al motor después, con `FUN_10001170(valor, 0, 0)` y `FUN_10001170(valor, 6, 0)` por índice: primero un pase con destino 0 y luego otro con destino 6 (**sospecha**: R1 y R2, las dos filas de voces).

## Cómo se escribe (`FUN_10013fc0` → `FUN_10001af0`)

`FUN_10013fc0(id)` formatea `"Sounds/%03d.sound"` (`0x10054598`), crea la carpeta (`_mkdir`) y `FUN_10001af0` abre `sound.script` con `"w"`, recorre la tabla en pasos de `0x28` y escribe una línea por parámetro con `fprintf(file, "%s\t%d\n", nombre, entero)` (`0x100520a8`).

Antes de imprimir, cada valor pasa por **`FUN_100014c0`, que lo recorta a su rango**:

```asm
100014c0  FLD  [ECX+0x1c]        ; valor
100014c3  FCOMP[ECX+0x0c]        ; contra min
…         FLD  [ECX+0x0c]        ; si es menor, se toma min
100014d8  FCOMP[ECX+0x10]        ; contra max
…         FLD  [ECX+0x10]        ; si es mayor, se toma max
100014ee  FST  [ECX+0x1c]        ; se guarda el valor recortado
```

y luego se convierte a entero (`%d`): **truncamiento hacia cero**. Es decir, el fichero es siempre canónico — 445 líneas, orden de la tabla, valores enteros dentro de rango — aunque lo que haya en memoria no lo sea. Un `EQ_Band1Q = 0` sale como `1`; un `SoundNumVoices = 999` sale como `32`.

## El nombre

Los 16 caracteres van en `SoundNameC00`–`SoundNameC15` como **códigos ASCII decimales** (32–122, espacio incluido). `"Symbiont"` es `83 121 109 98 105 111 110 116` rellenado con `32`. El DLL los relee con `FUN_10013ac0` (16 lecturas sobre `0xf0 + i*0x28`) y con eso rellena la caché `SoundNames` (`0x10059f38 + id*0x20`). No hay terminador: el nombre son exactamente 16 bytes.

## Migración de versión 1

En `FUN_10013ea0`, después de parsear:

```asm
10013f1d  FCOMP qword [0x1004cfb8]   ; double 2.0
10013f2e  FLD  dword [EBX+0x418]     ; BlenderAmount (índice 262 × 4)
10013f34  FSUB dword [0x1004cfb4]    ; - 64.0
10013f3a  FSTP dword [EBX+0x418]
```

Si `SoundVersionMajor < 2`, `BlenderAmount` se desplaza −64: el rango actual es −64…63 y el antiguo era 0…127, así que la rama sólo reetiqueta un desplazamiento. Los 351 presets publicados declaran **2.0.0** y la rama no se ejecuta nunca con ellos; queda como la prueba de que el esquema tuvo una versión 1 con el *blender* descentrado.

Ojo: **`SlicerSwitchBackup` no está ligado a la versión**. Los tres ficheros de 444 líneas también dicen 2.0.0, así que su ausencia no es un marcador de versión: el parámetro se añadió al esquema después y el lector les deja el default (0) sin quejarse.

## Uso del códec

```bash
python NeuronVS_preset_format/tools/preset.py show "…/Sounds/000.sound"
python NeuronVS_preset_format/tools/preset.py show "…/Sounds/000.sound" --json
python NeuronVS_preset_format/tools/preset.py roundtrip "…/NeuronDB/Sounds"
python NeuronVS_preset_format/tools/preset.py new --name "My Sound" --voices 8 --out /tmp/500.sound/sound.script
python NeuronVS_preset_format/tools/preset.py set "…/Sounds/000.sound" SoundNumVoices 8 --out /tmp/000.sound/sound.script
python NeuronVS_preset_format/tools/preset.py slots "…/NeuronDB"
python NeuronVS_preset_format/tools/preset.py clone "…/NeuronDB" 000 --name "Symbiont 2"
python NeuronVS_preset_format/tools/preset.py rename "…/NeuronDB" 000 "Archon"
python NeuronVS_preset_format/tools/preset.py move   "…/NeuronDB" 000 500
python NeuronVS_preset_format/tools/preset.py delete "…/NeuronDB" 003 --dry-run
python NeuronVS_preset_format/tools/preset.py journal "…/NeuronDB"
python NeuronVS_preset_format/tools/preset.py undo "…/NeuronDB"
python NeuronVS_preset_format/tools/preset.py names "…/NeuronDB" --check
```

```
$ python tools/preset.py show "…/Sounds/000.sound"
id       0
name     'Symbiont'
version  2.0.0
voices   6
records  445/445
groups   R1=109, R2=109, SoundHeader=6, SoundMFX=15, SoundName=16, Synth=190
```

```python
from preset import Schema, Preset

schema = Schema.load()                       # 445 Field(index, key, group, min, max, default, step)
preset = Preset.parse(path.read_bytes())     # claves presentes + claves desconocidas aparte
preset.name                                  # "Symbiont"
preset.get("BlenderAmount")                  # valor del fichero, o el default si falta
preset.set_name("Bass"); preset.set("SoundNumVoices", 8)
preset.validate()                            # faltantes, fuera de rango y claves desconocidas
preset.serialize(include_missing=True)       # 445 líneas CRLF, recortadas a min..max
```

`Preset.parse` no exige las 445 claves (`strict_missing=False` en `validate()` acepta un preset incompleto, como hace el DLL), ignora las claves desconocidas y se queda con la última repetición. `serialize` escribe en orden de esquema y aplica el mismo recorte que `FUN_100014c0`, de modo que `parse` → `serialize` es **byte a byte idéntico** para los 351 presets instalados.

## Slots y la caché `SoundNames`

El id **es la carpeta**: el cargador exige `-1 < id < 1000` y abre `Sounds/%03d.sound/sound.script`, así que un slot está ocupado exactamente cuando ese fichero existe. El nombre visible no se lee de la carpeta sino de `SoundNameC00..15`, y el navegador del editor lo toma de una **caché aparte**, `NeuronDB/SoundNames`, que el DLL escribe con `"%03d\t%16s\n"` (`0x10052608`, `fopen "w+"` en `0x10052618`, 1000 entradas, `FUN_10013cc0`) y cuya entrada por defecto es `"InitSound"` (`0x100525bc`).

```bash
python …/preset.py slots  "…/NeuronDB"                      # 351 ocupados, libres 351-999
python …/preset.py clone  "…/NeuronDB" 000                  # -> 351, el libre más bajo
python …/preset.py clone  "…/NeuronDB" 000 --name "Symbiont 2"
python …/preset.py rename "…/NeuronDB" 000 "Archon"         # renombra en su slot, sin duplicar
python …/preset.py move   "…/NeuronDB" 000 500              # cambia el preset de slot, sin copiarlo
python …/preset.py delete "…/NeuronDB" 003                  # borra el preset y libera el slot
python …/preset.py names  "…/NeuronDB" --check              # exit 1 si la caché no concuerda
python …/preset.py sync   "…/NeuronDB" --prune              # reescribe y borra nombres huérfanos
```

Lo que garantiza `clone`:

- el destino debe estar libre (`sound.script` ausente) salvo `--overwrite`, y el origen nunca se modifica;
- la copia son **los bytes del origen tal cual** (un preset v1 de 444 líneas sigue teniendo 444); con `--name` se reescribe en orden de esquema, como hace el escritor del DLL;
- `SoundNames` se reconstruye a partir de **todos** los presets, no se parchea sólo la línea del destino: 1000 líneas `NNN<TAB>nombre de 16 caracteres`, que es lo que produce `FUN_10013cc0`. Si la caché falta, se crea (el mismo fichero que escribiría el constructor `FUN_1000be10` tras su escaneo);
- los nombres cacheados de slots **sin** preset se conservan, porque el DLL también los conserva; sólo `sync --prune` los tira;
- `--dry-run` no escribe nada; `--stickrec` copia además `sound.stickrec` (que el DLL no lee).

### Renombrar, mover y borrar un preset

`clone` **copia** un preset a otro slot; `rename`, `move` y `delete` trabajan sobre el slot que ya existe y no tocan los demás:

| Operación | Qué cambia | Qué no cambia |
|---|---|---|
| `rename <db> <slot> <nombre>` | las líneas `SoundNameC00..C15` de ese `sound.script` cuyo código cambia (16 como máximo: los espacios compartidos no se reescriben) y **una** línea de `SoundNames` | la carpeta, el slot, las otras 429 claves del preset y los otros 999 slots |
| `move <db> <slot> <destino>` | la carpeta `NNN.sound/` pasa a llamarse `MMM.sound/` (es la misma carpeta renombrada) y **dos** líneas de `SoundNames`: la de origen vuelve a `InitSound` y la de destino toma el nombre del preset | el nombre y el contenido del preset, y las otras 998 líneas de la caché |
| `delete <db> <slot>` | desaparece `NNN.sound/` entero (script, `sound.stickrec` y lo que hubiera) y su línea de la caché vuelve a `InitSound` | todo lo demás; el slot queda libre y se puede reutilizar |

- **El renombrado es una edición quirúrgica, no un `serialize()`.** Se sustituyen sólo las líneas del nombre y después se vuelve a parsear el resultado: si algo fuera de `SoundNameC*` se hubiera movido, la operación lanza en vez de escribir. Por eso un preset v1 de 444 líneas sigue teniendo 444 y una clave desconocida no se pierde.
- **La caché se parchea línea a línea.** `sync` reconstruye las 1000 líneas (es lo que hace `FUN_10013cc0` y lo correcto para reparar la caché entera), pero un renombrado sólo posee un slot: se reescribe **su** línea y se copian las demás tal cual, con su relleno y sus finales de línea (un `SoundNames` CRLF sigue siendo CRLF). El informe dice cuántas líneas quedaron intactas.
- **Si no hay `SoundNames`, no se crea.** El DLL lo reconstruye al arrancar escaneando los presets; inventar un fichero con las 1000 entradas a `InitSound` escondería los nombres que debe tener. Las tres lo dicen y `sync` lo escribe cuando se quiera.
- **Nombrar como otro slot no es un error**: dos presets pueden llamarse igual (el DLL lo permite) y el informe lo anota; `names` lo cuenta como *nota*, no como problema.
- `delete` renombra la carpeta a `NNN.sound.deleting`, escribe la caché y sólo entonces borra los ficheros; si la caché no se puede escribir, la carpeta vuelve a su sitio. Un `NNN.sound.deleting` que quede de un fallo anterior detiene la operación en vez de borrar a ciegas.
- **`move` no copia ni reescribe el preset**: renombra la carpeta, así que `sound.script`, `sound.stickrec` y cualquier otro fichero del slot llegan byte a byte. No toca las líneas `SoundNameC*`: el preset se llama igual en su nuevo slot.
- **Las dos líneas de la caché se escriben en un solo `write`**: la de origen vuelve a `InitSound`, de modo que la caché nunca nombra el mismo preset en dos slots; si al destino le faltaba la línea, se inserta en orden. Un fallo al escribir devuelve la carpeta a su slot de origen y descarta el asiento.
- **`move --overwrite`** sólo sustituye la carpeta del destino: se aparta a `MMM.sound.replaced`, se escribe la caché y sólo entonces se borra; el diario guarda una copia por si hay que deshacer. Sin el flag, un destino ocupado falla. Se rechazan origen = destino, origen vacío y slots fuera de 000–999, antes de escribir nada.
- Las tres aceptan `--dry-run` (no escriben nada) y `--json`.

Tres detalles del lector `FUN_10013b20` que conviene tener presentes:

- **sólo el id pierde dígitos iniciales.** El `strspn` sobre `"0123456789"` consume el número de slot, no el nombre: `003.sound` se llama *5ResoGlideBreakz* y en la caché también empieza por `5`. Un lector que recorte los dígitos del nombre corrompe 13 de los 351 presets (`5th Pad`, `08/15`, `70s Lead`…);
- **recorta el relleno izquierdo.** `%16s` alinea a la derecha, así que el fichero guarda `351\t       InitSound` y el lector devuelve `InitSound`; los nombres que salen de un preset ya miden 16 caracteres (con espacios finales) y vuelven intactos;
- **el DLL conserva el `\n`** al copiar el resto de la línea, de modo que sus propias reescrituras añaden una línea en blanco por entrada. Aquí la caché se escribe limpia, una línea por slot, sin reproducir ese defecto.

Un código de nombre fuera de 32..122 se escribe como `?`: el DLL copiaría el byte crudo y podría meter un NUL en mitad del fichero.

### Diario y deshacer (`journal`, `undo`)

`rename`, `move` y `delete` apuntan lo que hacen en `NeuronDB/.preset-journal/`: un `journal.jsonl` (una línea JSON por asiento, en orden) y una carpeta de instantáneas por entrada.

| Operación | Instantánea que guarda | Qué restaura `undo` |
|---|---|---|
| `rename` | el `sound.script` anterior completo | el fichero tal cual estaba: las 16 líneas del nombre y todo lo demás |
| `move` | la carpeta del destino que `--overwrite` sustituye (el preset movido sigue existiendo en el destino, así que no hay que copiarlo) | renombra `MMM.sound/` a `NNN.sound/` y, con `--overwrite`, devuelve la carpeta sustituida a su sitio |
| `delete` | la carpeta `NNN.sound/` entera (script, `sound.stickrec`, lo que hubiera) | el preset completo, con sus ficheros |
| las tres | `SoundNames` completo, si existía | la misma caché que había, no una reconstruida |

```bash
python …/preset.py journal "…/NeuronDB"          # últimos 20 asientos
python …/preset.py journal "…/NeuronDB" --json
python …/preset.py undo    "…/NeuronDB"          # deshace el último rename/move/delete
python …/preset.py undo    "…/NeuronDB" --force  # aunque el slot o la caché hayan cambiado
```

```
$ python tools/preset.py journal "…/NeuronDB"
journal  …/NeuronDB/.preset-journal/journal.jsonl
ops      2 operaciones (rename/delete/move), 1 undo, 1 undone
  0001  rename  000 'Symbiont' -> 'Archon' [undone]
  0002  undo    rename of 0001
  0003  delete  007 'Myst' (2 files, 17489 bytes)
undo     last is 0003; run: python preset.py undo <NeuronDB>

$ python tools/preset.py undo "…/NeuronDB"
undone   0003 delete 007 'Myst'
folder   …/NeuronDB/Sounds/007.sound (restored from the journal)
cache    …/NeuronDB/SoundNames (restored)
slot     007 is occupied again
```

- **Se deshace lo último que sigue sin deshacer.** `undo` toma el asiento más reciente de `rename`/`move`/`delete` que no tenga ya un `undo` apuntándolo y añade un asiento `undo`; llamarlo otra vez deshace la operación anterior. El diario es sólo de adición: nunca reescribe ni borra asientos.
- **Antes de tocar nada comprueba que el estado sigue siendo el que dejó la operación**: hash del script (rename y move), hash de `SoundNames` y carpeta ausente (delete). Si algo cambió después —otro agente, un `set`, un `sync`— se niega y pide `--force`; con `--force` restaura igualmente. Hay una excepción sin `--force`: un `delete` cuyo slot volvió a ocuparse, o un `move` cuyo slot de origen ya está ocupado por otro preset. Ahí no se borra ni se mueve un preset nuevo sin preguntar. Una negativa no deja el slot a medias porque las comprobaciones van antes de escribir.
- **`clone`, `set` y `sync` no se apuntan**, y un `--dry-run` no escribe ni diario ni instantánea. Tras un renombrado que falla al parchear la caché, el script se devuelve a su estado anterior y la instantánea se descarta: no queda un asiento huérfano.
- **Vive en la raíz de `NeuronDB`, no en `Sounds/`**: el escaneo de `NNN.sound` del DLL y `lib.ids()` no lo ven. Borrar `.preset-journal/` es seguro, sólo se pierde la posibilidad de deshacer.
- Un asiento guarda `seq`, `op`, `slot`, `to` (move), `before`/`after` (rename) o `files`/`bytes` (delete), la hora, y los hashes `script_sha256`, `script_after_sha256`, `cache.sha256` y `cache.after_sha256` que usan las comprobaciones. `undo` incluye `target` (el asiento deshecho) y `op_undone`.

`SoundLibrary` también es importable:

```python
from preset import SoundLibrary

lib = SoundLibrary("…/NeuronDB")      # también acepta …/NeuronDB/Sounds
lib.ids()                             # 0..350 en la copia del instalador
lib.first_free()                      # 351
lib.name_of(0)                        # 'Symbiont        ', exactamente 16
lib.clone(0, name="Bass")             # -> CloneResult(source, target, name, …)
lib.rename(0, "Archon")               # -> RenameResult(before, after, cache, duplicates, journal, …)
lib.move(0, 500)                      # -> MoveResult(source, target, files, cache, overwritten, journal, …)
lib.delete(3)                         # -> DeleteResult(files, bytes, cache, journal, …)
lib.journal().undo()                  # -> UndoResult: Journal(root) en lib.journal()
lib.patch_cache(11, "Bass")           # -> CachePatch: reescribe una línea y deja el resto
lib.check_cache()                     # (problems, notes)
lib.sync(prune=True)                  # reescribe SoundNames entera
```

## Verificación

```bash
python NeuronVS_preset_format/tools/verify_preset.py    # exit 0
```

Contra el DLL:

- los 445 descriptores de `0x10049f08` (stride `0x1c`): nombre legible en `+0`, punteros reservados a la cadena vacía, `step == 1.0`, `min ≤ max`, y `min/max/default` idénticos a `preset_schema.csv` fila por fila;
- exactamente 19 defaults fuera de rango, todos con valor 0;
- el lector `0x10001910`: `fopen "r"` (`0x100520a4`), `fgets` con `0x100`, `sscanf "%s %f"` (`0x1005209c`), `ADD EAX,0x28`, `MOV ESI,[EAX+ESI-0x14]` y `ADD EBP,0x28`;
- el escritor `0x10001af0`: `fopen "w"` (`0x100520b0`), `"%s\t%d\n"` (`0x100520a8`), `ADD ESI,0x28` y una llamada a `0x100014c0`;
- el recorte `0x100014c0`: `FLD/FCOMP/FST [ECX+0x1c]` contra `[ECX+0xc]` y `[ECX+0x10]`;
- la migración: `FCOMP qword [0x1004cfb8]` = double 2.0, `FLD/FSUB/FSTP [EBX+0x418]` con `[0x1004cfb4]` = 64.0, y `262 · 4 = 0x418`;
- las rutas `Sounds/%03d.sound/sound.script` y `Sounds/%03d.sound` + `sound.script`;
- el orden del esquema (versión 0–2, nombres 6–21, `SoundMFXRevSpeed` al final);
- la tabla de ejecución `C_Param` ([`PARAM_RECORD.md`](PARAM_RECORD.md)): reserva `445*0x28+4`, constructor del registro (`+0x00/+0x04/+0x08` a la cadena vacía, ceros, `step` 1.0f, capacidad 16, matriz de 0x40), bucle de copia desde `0x10049f14` hasta `0x1004cfc0` con sus cinco campos, alta/baja de observadores con notificación `máscara|4` y el relleno de `core+0xc0` con `tabla + índice*0x28`;

Contra los datos:

- 351 presets, 445 líneas (444 en exactamente `011`, `012`, `023`), CRLF, `Clave<TAB>entero`, claves conocidas y **en orden de esquema**, valores dentro de `min..max`, nombre decodificado con caracteres 32–122 y 351 nombres distintos;
- las columnas `files_present`, `distinct_values`, `observed_min` y `observed_max` de las 445 filas del CSV coinciden con el recuento real.

Contra el códec:

- 351/351 presets byte a byte tras `parse` → `serialize`;
- un preset `new` sale con 445 líneas válidas, versión 2.0.0 y los 19 defaults recortados a 1;
- `set` recorta igual que el DLL (999 → 32, −5 → 1);
- leer en orden inverso y con una clave desconocida produce el mismo fichero.

Contra el gestor de slots (sobre copias desechables del `NeuronDB`):

- la caché del DLL: `"%%0%dd\t%%%ds"` con ancho 16, `"w+"`, `"InitSound"`, `"SoundNames"`, el `sscanf "%d"` y el `strspn "\t "` del lector, y que `FUN_100132d0`/`FUN_100133b0` la reescriben con 1000 × 16 y `FUN_1000be10` la lee y la reescribe;
- 351 ocupados y 649 libres en la copia del instalador, primer libre 351, y una caché ausente produce 351 problemas (uno por preset);
- `clone` de 000 a 001 byte a byte idéntico, la caché creada con 1000 líneas `NNN<TAB>16` en orden 000–999 y la línea exacta de 000, 001 y de un slot vacío;
- `clone --name` renombra la **copia** y actualiza la caché; se rechazan origen vacío, origen = destino, destino ocupado, slot 1000 y nombre de 17 caracteres; `--overwrite` sustituye y `--dry-run` no toca nada; `--stickrec` copia el stickrec sólo cuando se pide;
- un nombre cacheado para un slot vacío sobrevive a un `clone` y `sync --prune` lo elimina; una línea obsoleta, una malformada y un id fuera de 000–999 se reportan y `sync` los repara;
- `rename` deja el preset en su slot y cambia **sólo** las líneas del nombre (11 de las 16 en el caso probado, porque los espacios compartidos no se mueven) y **una** línea de la caché: se comprueba que el resto de los slots quedan byte a byte idénticos y que el preset sigue pasando `parse` → `serialize`; renombrar al mismo nombre no escribe nada, un nombre compartido se anota, un `--dry-run` no toca ni un byte y se rechazan slot vacío, slot 1000 y nombre de 17 caracteres;
- `move` cambia el preset de slot renombrando la carpeta: se comprueba que llegan byte a byte el `sound.script` y el `sound.stickrec`, que sólo cambian **dos** líneas de `SoundNames` (origen `InitSound`, destino con el nombre) y que la caché sigue coherente; `--overwrite` sustituye el slot de destino, sin el flag un destino ocupado falla, y se rechazan origen = destino, origen vacío y destino 1000; `undo` devuelve la carpeta y las dos líneas de la caché (y el slot sustituido), y se niega (ni `--force` la salta) si el slot de origen volvió a ocuparse; un `--dry-run` no escribe ni un byte;
- `delete` borra la carpeta del slot y devuelve la caché a `InitSound`: se comprueba que desaparece exactamente ese `sound.script` y que el único fichero modificado del resto de la base es `SoundNames`, que el slot vuelve a la lista de libres y que se puede reutilizar con un `clone`; un `--dry-run` no escribe, un `NNN.sound.deleting` previo detiene el borrado y se rechazan slot vacío y slot 1000;
- parchear una caché con finales CRLF no introduce LFs sueltos y deja las otras 999 líneas byte a byte iguales; si a la caché le falta la línea del slot, se **inserta en orden** (no se añade al final) y las 1000 quedan ordenadas;
- los 13 presets cuyo nombre empieza por dígito (*5ResoGlideBreakz*, *70s Lead*, *08/15*…) lo conservan al pasar por la caché, además de los separadores de espacios (`"  7  Myst"`) y códigos de nombre fuera de rango (se escriben `?`, nunca NUL);
- con los 1000 slots ocupados, `first_free()`/`clone` lanzan `RuntimeError` y `sync` sigue siendo coherente;
- el diario: empieza vacío, `clone` no escribe en él, un `rename` deja **un** asiento con `before`/`after` y la instantánea del script anterior, y `undo` devuelve el `sound.script` y `SoundNames` **byte a byte** a como estaban, deja el nombre viejo y la caché coherente, y apunta el `undo` en el diario; dos renombrados seguidos se deshacen en orden (`Step 2` → `Step 1` → nombre anterior) con un asiento `undo` por cada uno; un `move` deja un asiento con `slot`, `to` y el nombre, y `journal` cuenta las operaciones aparte de los `undo`;
- `undo` de un `delete` reconstruye la carpeta entera —comprobado fichero a fichero, `sound.stickrec` incluido— y la línea exacta de `SoundNames`, y el slot vuelve a estar ocupado;
- las guardas: si el script o la caché cambiaron después de la operación, `undo` lanza y no escribe; `--force` restaura igualmente (se comprueban los dos casos); `--dry-run` de `rename`/`move`/`delete` no añade asientos.

El verificador se probó también al revés: cambiar un `min` en el CSV o un valor fuera de rango en un preset hace que falle con el mensaje concreto y `exit 1`; sustituir la derivación del nombre del gestor por un `InitSound` fijo hace fallar 17 comprobaciones.

## Reproducir

```bash
python NeuronVS_preset_format/tools/build_schema.py     # reescribe preset_schema.csv desde el DLL
python NeuronVS_preset_format/tools/verify_preset.py    # exit 0

python NeuronVS_preset_format/tools/preset.py journal "…/NeuronDB"   # diario de rename/delete
python NeuronVS_preset_format/tools/preset.py undo    "…/NeuronDB"   # deshace el último
```

Ambos scripts esperan `NeuronVS.dll` y `Hartmann Music/NeuronVS/NeuronDB/` en el directorio padre del paquete. `build_schema.py` falla si un descriptor no aparece en ningún preset, que es la señal de que el bloque `.rdata` se ha leído mal.

## Limitaciones

- **El esquema es el del DLL, no el del panel.** `min/max/step` son los del descriptor; los widgets (`C_Knob`, `C_ControlPanel`) aplican sus propias curvas y no se han cruzado con estos rangos.
- **Semántica de cada parámetro: no documentada.** Se conoce el nombre, el rango y el grupo, y que `R1`/`R2` son dos filas de voces, pero no qué hace cada valor en el motor.
- **La tabla de `C_Param` está localizada, y eso explica la referencia ausente**: `FUN_10013de0` la construye arrancando en `0x10049f14` (descriptor 0 `+0x0c`) y terminando en `0x1004cfc0`, así que el único acceso al bloque `.rdata` es un `LEA ESI,[0x10049f14]` que no apunta a su inicio. El layout completo de los 0x28 bytes, con el valor y la matriz de 16 observadores, está en [`PARAM_RECORD.md`](PARAM_RECORD.md); el emparejamiento descriptor ↔ registro es posicional.
- **`float` en memoria, entero en disco.** El lector acepta `%f`, pero no he encontrado ningún preset con decimales; el códec trabaja con enteros y el escritor trunca, que es lo que hace `%d`.
- **Sin `sound.stickrec`**: no forma parte del preset ni lo lee el cargador (ver el paquete `NeuronVS_neurondb`). `clone --stickrec` lo copia como fichero opaco, sin interpretarlo, y `delete` se lo lleva con la carpeta.
- **`rename`/`delete` no reparan el resto de la caché.** Parchean su línea y dejan las demás como estén: si `SoundNames` ya tenía entradas obsoletas en otros slots, siguen ahí y `names --check` las sigue contando. Para arreglarlas está `sync`.
- **`SoundNames` no se ha leído de una instalación real**: la copia del instalador no trae el fichero (lo crea el DLL al arrancar). El formato sale del código y el gestor se verificó contra cachés que él mismo escribe y contra líneas manipuladas, no contra un fichero generado por el DLL en Windows.
- **El gestor no toca `ModelNames`** ni el modelo: sólo `Sounds/` y `SoundNames`.
- **El diario no se compacta ni caduca.** Cada `delete` guarda una copia de la carpeta antes de borrarla y cada `rename` una copia del script (más `SoundNames` si existe), así que `.preset-journal/` crece con las operaciones y conserva presets borrados hasta que se borre la carpeta a mano. No hay límite de tamaño ni `journal --prune`.
- **`undo` sólo cubre `rename` y `delete`.** `clone`, `set` y `sync` no se apuntan, y deshacer una operación antigua puede toparse con la guarda de la caché si hubo cambios posteriores; en ese caso hay que decidir a mano (`--force` restaura la caché de entonces y descarta esos cambios).
- **El nombre no se valida**: 16 códigos cualesquiera se escriben tal cual; el rango 32–122 es el que usan los 351 presets, no una comprobación del binario.
