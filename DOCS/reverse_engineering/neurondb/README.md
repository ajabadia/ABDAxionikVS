# NeuronDB — la base de datos de NeuronVS y sus `.sound`

`NeuronDB` es la carpeta de datos que `NeuronVS.dll` (Hartmann Music, 2004) lee al arrancar: los **351 sonidos** y el **modelo 511** que vienen con el instalador. Los `.sound` **no son archivos**: son carpetas `NNN.sound/` con un `sound.script` de texto y, opcionalmente, un `sound.stickrec`. Este documento describe la carpeta, el formato de esos ficheros, cómo los localiza y los parsea el binario, y qué queda fuera del alcance de lo verificado.

| Archivo | Qué contiene |
|---|---|
| [`sounds.csv`](sounds.csv) | 351 sonidos: id, carpeta, nombre, voces, nº de claves, tamaño/SHA-256 del script y del stickrec |
| [`sound_schema.csv`](sound_schema.csv) | las 445 claves del esquema en orden, grupo, en cuántos ficheros aparecen, valores distintos, mínimo y máximo |
| [`stickrec.csv`](stickrec.csv) | los 103 `sound.stickrec` no vacíos: líneas, rango de tiempo, flags, parámetros, rango de valor y SHA-256 |
| [`models.csv`](models.csv) / [`model_files.csv`](model_files.csv) | el modelo 511 (`sinew`) y sus dos binarios `.scape`/`.sphere` |
| [`synth_frames.csv`](synth_frames.csv) | los tres renders de [`SYNTH_FRAMES.md`](SYNTH_FRAMES.md): nivel, cresta, centroide y reparto por bandas |
| `wav/` | `body_frame00.wav`, `body_frame32.wav` y `scape_curva.wav`, los tres a 44,1 kHz y el mismo RMS |
| [`model_map.csv`](model_map.csv) | las 128 zonas de `map.script` con sus 8 claves |
| [`tools/model_binary.py`](tools/model_binary.py) | lee `.scape`/`.sphere`: chunks, cabeceras, curva, frames y los 1024 parciales del bloque de 6152 B |
| [`tools/verify_model_binary.py`](tools/verify_model_binary.py) | valida ese formato y los offsets del DLL que cita `SCAPE_SPHERE.md` |
| [`tools/synth_frames.py`](tools/synth_frames.py) | sintetiza los parciales de un frame y el ciclo del `.scape`, y escribe los WAV |
| [`tools/verify_synth_frames.py`](tools/verify_synth_frames.py) | comprueba esos WAV contra el modelo (picos, periodo, bandas) y falla si se intercambian los frames |
| `tools/scan_neurondb.py` | reescribe todos los CSV leyendo la carpeta |
| `tools/verify_neurondb.py` | comprueba los CSV contra la carpeta **y** las direcciones citadas contra el DLL |
| [`tools/compare_neurondb.py`](tools/compare_neurondb.py) | compara dos NeuronDB slot a slot (contenido, nombres y caché), aplica a una copia sólo los slots cambiados con `--apply` y valida una sola instalación con `--check` |
| [`tools/verify_compare_neurondb.py`](tools/verify_compare_neurondb.py) | monta dos NeuronDB sintéticos y comprueba el informe, el JSON, el CSV, el HTML, `--apply`, `--check` y los códigos de salida |

## Dónde está y cómo la encuentra el DLL

La ruta no está en el binario: se lee de un valor de registro.

```asm
10001771  PUSH 0x10052078        ; "Software\Hartmann Music\NeuronVS"
100017ac  PUSH 0x1005206c        ; "NeuronDB"   (valor REG_SZ)
100017d0  ... 0x10052060         ; "/NeuronDB/"  (se concatena a la base)
```

`FUN_10001750` abre `HKEY_LOCAL_MACHINE`, consulta `NeuronDB` (hasta 0x1fa4 bytes) y le **añade** `/NeuronDB/`. En este equipo el valor es:

```
HKLM\SOFTWARE\WOW6432Node\Hartmann Music\NeuronVS
    NeuronDB    REG_SZ    C:\Program Files (x86)\Hartmann Music\NeuronVS
```

así que la raíz efectiva es `<base>/NeuronDB/` y cada acceso es una ruta relativa colgada de ahí (`strncat` con límite 900 en `FUN_10001910`). La copia que documenta este paquete es la del instalador extraído, `Hartmann Music/NeuronVS/NeuronDB/`, con el mismo contenido.

La base está dimensionada para **1000 sonidos** (`000`–`999`) y **512 modelos** (`000`–`511`), como delatan las etiquetas del navegador del editor (`"Sounds 000-099"` … `"Sounds 900-999"`, `"Models 000-127"` … `"Models 384-511"`, en `0x10054de0`–`0x10054eb0`). Instalados hay 351 y 1.

```
NeuronDB/
├── Sounds/
│   ├── 000.sound/
│   │   ├── sound.script      445 líneas "Clave<TAB>valor", CRLF
│   │   └── sound.stickrec    9 dígitos hex por línea (opcional)
│   └── … 350 carpetas más
├── Models/
│   └── 511.model/
│       ├── MName             "sinew" (sin salto de línea)
│       ├── map.script        1027 líneas: 3 de versión + 128 zonas × 8 claves
│       ├── 000001.scape      137.476 B, cabecera "csAN"
│       └── 000001.sphere     440.356 B, cabecera "psAN"
├── ModelNames                (lo crea el DLL la primera vez)
└── SoundNames                (lo crea el DLL la primera vez)
```

## Anatomía de un `.sound`

### `sound.script`

Texto plano CRLF, una línea por parámetro, `Clave<TAB>valor`. Empieza así (`000.sound`, el preset *Symbiont*):

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
SoundMFXDelayLTime	…
```

- **445 claves** en 348 ficheros; **444** en `011`, `012` y `023`, a los que les falta `SlicerSwitchBackup` (índice 429 del esquema). El orden es fijo y coincide con el de la tabla de parámetros del DLL, así que el índice de `sound_schema.csv` **es** la posición en esa tabla.
- Los **valores son enteros** (156.192 valores comprobados, ninguno con decimales ni notación float), aunque el parser los lea como `%f`.
- Los 16 primeros caracteres del nombre se guardan como **códigos decimales** en `SoundNameC00`–`SoundNameC15` (`83 121 109 98 105 111 110 116` = `Symbiont`).
- Grupos: `SoundHeader` 6, `SoundName` 16, `SoundMFX` 15, `R1` 109, `R2` 109 y `Synth` 190 (envolventes, LFO, filtros, EQ, shaper, blender…). `R1`/`R2` son las dos "filas" de voces y agrupan `R1L1…R1L3`, `R1F`, `R1A`, `R1M`, `R1P`, `R1R` (y lo mismo en `R2`).
- `SoundNumVoices` vale 8 en 235 presets, 6 en 38, 10 en 36, 12 en 31, 4 en 10 y 5 en uno.

### Cómo se carga (`FUN_10013ea0`)

1. Comprueba `0 ≤ id < 1000`, formatea `"Sounds/%03d.sound/sound.script"` (cadena en `0x10054568`) y llama a `FUN_10001910`.
2. `FUN_10001910` obtiene la raíz con `FUN_10001750`, concatena la ruta relativa, reserva `float[count]` y **rellena los valores por defecto** leyendo el campo `+0x14` de cada registro de la tabla del sonido:

   ```asm
   100019a1  MOV ESI,[EBP]                  ; tabla de parámetros (this+0)
   100019a4  ADD EAX,0x28                   ; registros de 0x28 bytes
   100019ab  MOV ESI,[EAX+ESI-0x14]         ; valor por defecto del registro
   ```

3. Abre el fichero, lee cada línea con `fgets` y la parte con `sscanf(line, "%s %f", …)` (`0x1005209c`), busca el nombre en la tabla (`ADD EBP,0x28` por registro) y escribe el valor en el array.
4. `FUN_10013ea0` aplica el array al motor: para cada índice llama a `0x10001170(valor, 0, 0)` y después a `0x10001170(valor, 6, 0)`, con `ECX` apuntando al registro `i*0x28` (cada registro es un `C_Param` con su nombre en `+0` y su valor por defecto en `+0x14`).
5. Migración de versión: `FCOMP double [0x1004cfb8]` — un **double 2.0** (los 8 bytes `00 00 00 00 00 00 00 40`) — y, si `SoundVersionMajor` es menor que 2, `FSUB [0x1004cfb4]` (**64.0**) sobre el índice **262 = `BlenderAmount`**. Los 351 ficheros publicados declaran `SoundVersionMajor` = 2, así que la rama queda dormida; es la marca de que el esquema tuvo una versión 1 con otro desplazamiento.

### Cómo se guarda (`FUN_10013fc0` → `FUN_10001af0`)

`FUN_10013fc0(id)` formatea `"Sounds/%03d.sound"`, llama a `FUN_10001af0`, que hace `_mkdir` de la carpeta, abre `sound.script` con `"w"` y escribe **una línea por registro** con `fprintf(file, "%s\t%d\n", nombre, (int)valor_clampado)`. El `\n` se convierte en CRLF al abrir en modo texto, que es exactamente lo que hay en los ficheros. Es decir: el `.sound` es un volcado de los 445 parámetros del motor, no un formato binario.

### Caché de nombres (`SoundNames` / `ModelNames`)

El constructor del banco (`FUN_1000be10`, llamado desde `C_NeuronCore_ctor` en `0x1001b140`) prepara dos tablas de nombres:

- **512 modelos × 32 B** (máx. 11 caracteres) rellenos con `"--<empty>--"`, leídos de `NeuronDB/ModelNames`.
- **1000 sonidos × 32 B** (máx. 16 caracteres) rellenos con `"InitSound"`, leídos de `NeuronDB/SoundNames`.

El formato de esos ficheros sale de `"%%0%dd\t%%%ds"` (`0x10052608`): una línea `NNN<TAB>nombre` por entrada (`%03d\t%11s` para modelos, `%03d\t%16s` para sonidos). Si `SoundNames` no existe, el constructor **recorre los 1000 huecos**, carga cada `sound.script` que encuentre, reconstruye el nombre desde `SoundNameC00..C15` (`FUN_10013ac0`: 16 lecturas sobre los registros `0xf0 + i*0x28`, y escribe el byte en `0x10059f38 + id*0x20`) y por último escribe la caché (`FUN_10013cc0`). Por eso una instalación recién usada gana dos ficheros en la raíz de `NeuronDB/`: son índices, no datos.

Después del arranque, la caché la mantienen dos funciones: `FUN_100132d0` (cargar un sonido desde la UI) recalcula el nombre de ese slot con `FUN_10013ac0` y **reescribe los 1000** con `FUN_10013cc0`; `FUN_100133b0` (guardar) los reescribe **sin recalcular**, así que un renombrado sólo llega a la caché por la carga que lo precedió. El lector `FUN_10013b20` hace `sscanf("%d")`, salta el `"\t "` y copia el resto de la línea recortado a 16 bytes: descarta el relleno izquierdo que produce `%16s`, pero **conserva el `\n`**, de modo que cada reescritura añade una línea en blanco por entrada. El gestor de [`NeuronVS_preset_format/tools/preset.py`](../NeuronVS_preset_format/tools/preset.py) (`slots`, `clone`, `rename`, `move`, `delete`, `names`, `sync`) reconstruye ese fichero desde los presets con una línea limpia por slot y comprueba la coherencia; no reproduce el defecto del `\n` ni el byte crudo de un código de nombre fuera de rango.

### `sound.stickrec`

- Lo tienen **103 de los 351** sonidos; los otros 248 lo tienen vacío (0 B). Hay **49 contenidos distintos**: el mismo registro aparece copiado en varios presets.
- Todas las líneas miden **9 caracteres hex** (`0-9A-F`); en total 74.799 líneas, entre 23 y 1.833 por fichero.
- **El DLL no lo lee**: la cadena `stickrec` no aparece en `NeuronVS.dll` (búsqueda de bytes, 0 resultados), y el único `sound.*` que construye es `sound.script`. Es un archivo que deja el editor/hardware, no una entrada del cargador.
- Estructura observada al partir en `4-1-1-3`: los 4 primeros dígitos son un contador **monótono** (0…0x0D22, 60 de 103 ficheros sin un solo salto), el 5.º nibble es 0/1, el 6.º es el índice de control (0–7, casi siempre 3) y los 3 últimos un valor 0…0x920. Encaja con una grabación de movimientos del *stick* (el mando del hardware): tiempo, flanco, control y valor. La interpretación es **inferida de los datos**, no confirmada en el binario.

## Anatomía de un `.model`

El manual de MODELmaker (`MM_user_manual_E_0703.pdf`, 27 p.) describe el modelo como un sample analizado más un juego de parámetros: número **0–511**, nombre de **hasta 11 caracteres**, complejidad 1–10, *parameter set* 0–9, sample AIFF mono 44,1 kHz 16 bit. Eso concuerda con lo que hay en disco:

- `MName` — el nombre visible; en `511.model` es `sinew` (5 caracteres, sin salto de línea).
- `map.script` — 1027 líneas: `MapVersionMajor/Minor/Build` y **128 zonas × 8 claves** (`NNNLowKey`, `HiKey`, `RootKey`, `LowSource`, `HiSource`, `Detune`, `Volume`, `Pan`). La zona 0 cubre 0–127 con `RootKey` 69 y `LowSource`/`HiSource` = 1; las demás están a cero en este modelo. `FUN_1000a930` abre `"Models/%03d.model/map.script"` (`0x10052518`) y lo recorre con `fgets`.
- `NNNNNN.scape` / `.sphere` — un par por *source* (`%s/%06d.scape`, `%s/%06d.sphere` en `0x1005258c`/`0x1005257c`, con el índice de source de la zona). `FUN_1000b230` compone ambas rutas, y `FUN_1000b490` **lee el fichero entero** (`_open`/`_lseek`/`read`) en un buffer del heap y devuelve `(puntero, tamaño)`; el cargador no interpreta el contenido.

Cabecera de los dos binarios del modelo 511:

| Fichero | Bytes | Tag | Enteros en +4… | Nota |
|---|---:|---|---|---|
| `000001.scape` | 137.476 | `csAN` | 100, 256, … | float `-22.729` en +0x0C; después 100, 0, 66940, 31472, 62843 |
| `000001.sphere` | 440.356 | `psAN` | 140, 288, … | mismo float en +0x0C; después 0, 100, 64, 1, 4, 4, 25, 25, 6152, 31, 61 |

Los dos tags son el mismo sufijo `AN` con `cs`/`ps` delante. El contenido ya está trazado hasta el motor: [`SCAPE_SPHERE.md`](SCAPE_SPHERE.md) documenta la cadena completa (`FUN_1000b230` → `FUN_10032d10` → `FUN_100317b0` / `FUN_10031950`), el contenedor por chunks (`csAN`/`psAN` + `mnAN` + `fdAN`), y el payload real: una curva `int16` de 68.608 muestras con bucle en el scape y, en cada frame del sphere, 25×4 floats de morfología más un bloque de **6152 B con 1024 parciales** (frecuencia A en Hz, amplitud B descendente y bin C en el eje de 44,1 kHz/1024). Ese bloque es el espectro que suena; la tabla de 25×4 es constante en este modelo. `FUN_1002e750` calcula su dirección y `FUN_1003bd10`/`FUN_1003c980` lo vuelcan en el banco aditivo. [`SYNTH_FRAMES.md`](SYNTH_FRAMES.md) convierte ese bloque en sonido: el cuerpo del frame 0 y del 32 frente a la curva del `.scape`.

## Oír el modelo: el cuerpo del `.sphere` y la curva del `.scape`

[`SYNTH_FRAMES.md`](SYNTH_FRAMES.md) sintetiza los parciales de dos frames del 511 y el ciclo del `.scape` y deja tres WAV de 2 s al mismo RMS. El reparto es claro: el bloque de 6152 B del frame lleva **todo** el timbre —un formante en 861/904 Hz con peine de 43 Hz— y el `.scape` es un **seno** de 441 Hz (segundo armónico 52 dB abajo) cuyo único rasgo es un ataque de 3 ciclos con armónicos `1/n`.

```
python NeuronVS_neurondb/tools/synth_frames.py
python NeuronVS_neurondb/tools/verify_synth_frames.py    # exit 0
```

Diferencias que mide la herramienta y comprueba el verificador:

- El frame 0 (1023 parciales) y el 32 (132) tienen **el mismo formante** (bins 20, 21 y 22) y difieren en la cola: 2,8–5,5 kHz a −37,5 dB frente a −82,2 dB, es decir 45 dB.
- La suma es **periódica de 1024 muestras** porque todas las frecuencias son `C · 43,066 Hz`; la curva lo es de 100. El verificador exige esa periodicidad, así que un render hecho con `A` (que repite 880 Hz en tres bins del frame 32) no pasa.
- Cada pico del WAV coincide con `C · 43,066 Hz` y con el nivel de `B` a menos de 0,5 dB; el WAV de la curva tiene la fundamental en 441 Hz y el segundo armónico 40 dB abajo como mínimo.
- Intercambiar `body_frame00.wav` y `body_frame32.wav` hace fallar el verificador.

## Comparar dos NeuronDB (`tools/compare_neurondb.py`)

Dos copias de la base se comparan como las ve el banco, no como las ve el explorador de ficheros: el banco tiene **slots numerados** (`000`–`999` sonidos, `000`–`511` modelos) y de cada slot importan dos cosas, **el contenido y el nombre**. La herramienta recorre las dos carpetas y responde slot a slot:

| Qué compara | Cómo |
|---|---|
| contenido de un sonido | SHA-256 de cada fichero de `NNN.sound/` (`sound.script`, `sound.stickrec`, lo que haya); para el script, además, **cuántas claves cambian** y cuáles |
| nombre de un sonido | el que decodifica `SoundNameC00..C15`, que es la autoridad (`FUN_10013ac0` lo deriva de la tabla de parámetros) |
| contenido y nombre de un modelo | SHA-256 de `MName`, `map.script` y los `.scape`/`.sphere`, más el nombre de `MName` |
| caché | `SoundNames` y `ModelNames` entrada a entrada, porque una caché ausente u obsoleta cambia el navegador aunque los 351 presets sean idénticos |

```bash
python NeuronVS_neurondb/tools/compare_neurondb.py <NeuronDB viejo> <NeuronDB nuevo>
python NeuronVS_neurondb/tools/compare_neurondb.py OLD NEW --params      # claves que cambian
python NeuronVS_neurondb/tools/compare_neurondb.py OLD NEW --csv diff.csv
python NeuronVS_neurondb/tools/compare_neurondb.py OLD NEW --json > diff.json
python NeuronVS_neurondb/tools/compare_neurondb.py OLD NEW --html diff.html
python NeuronVS_neurondb/tools/compare_neurondb.py OLD NEW --apply          # simula la copia de A a B
python NeuronVS_neurondb/tools/compare_neurondb.py OLD NEW --apply --write  # la aplica
python NeuronVS_neurondb/tools/compare_neurondb.py --check OLD
```

El informe separa **sonidos**, **modelos** y **caché**, y en cada fila da las dos columnas que importan: `contenido` y `nombre`. Así se lee una copia real con un preset renombrado y otro borrado:

```
Sonidos: 2 diferencias de 351 slots
  slot  estado   A                 B       contenido                                                                 nombre
  000   cambia   Symbiont          Archon  sound.script: 8 valores [SoundNameC00 83->65, SoundNameC01 121->114, ...  Symbiont -> Archon
  003   borrado  5ResoGlideBreakz  -       2 ficheros, 8931 B

Caché de nombres: 1 diferencia
  fichero    A: SoundNames: ausente · B: SoundNames, 1000 entradas

Avisos de B (1):
  - caché: 350 entradas no coinciden con su preset (000, 001, 002, 004, ...)
```

Detalles que conviene saber antes de leerlo:

- **Una caché obsoleta dentro de una carpeta es un aviso, no una diferencia.** Si las dos copias traen la misma caché rancia, las dos carpetas son iguales; sólo cuenta lo que distingue a A de B. El aviso se agrupa en una línea (una instalación recién usada puede tener 350 entradas sin actualizar) y no aparece con `--ignore-cache`.
- **Renombrar un preset cambia también su contenido**, porque el nombre vive en `SoundNameC00..C15` dentro de `sound.script`. La fila lo enseña en las dos columnas en vez de elegir una.
- El nombre se compara **sin el relleno** de espacios (el DLL imprime con `%16s` y lee recortando), y un código fuera de rango se muestra como `?`, que es lo que haría la tabla al copiar el byte.
- Se acepta tanto la carpeta `NeuronDB/` como la de instalación que la contiene: si la ruta no tiene `Sounds/` pero sí `NeuronDB/Sounds/`, se baja un nivel.
- `--all` añade los slots que **no** cambian (`estado igual`), útil para ver el universo comparado; no cuentan como diferencias ni cambian el código de salida.

### Informe HTML (`--html`)

`--html diff.html` escribe el mismo diff como una página que se abre con doble clic: **un documento autónomo**: el CSS y el filtro van en línea y no se carga nada de la red (ni fuentes, ni imágenes, ni scripts externos), así que funciona igual desde un USB, un correo o un servidor estático. Cada diferencia es una sección con **A y B lado a lado**: a la izquierda la copia vieja, a la derecha la nueva. En cada lado se ven el nombre, la carpeta (`Sounds/000.sound`), el tamaño, la tabla de ficheros con su SHA-256 y el estado de cada uno (`igual`, `cambia`, `sólo aquí`), más los ficheros que faltan en ese lado. Debajo, para los sonidos, la tabla de claves del preset que cambian con su valor en A y en B, y el resumen textual de la fila (`sound.script: 1 valor [R1Volume 95->74]`).

```bash
python NeuronVS_neurondb/tools/compare_neurondb.py OLD NEW --html diff.html
```

![Informe HTML: A y B lado a lado, con la tabla de ficheros y las claves que cambian](diff_html_demo.png)

La cabecera resume las dos carpetas (ruta de A y de B) y las cifras del JSON: diferencias totales, slots de cada lado, nuevos, borrados, contenido nuevo, renombrados y estado de la caché. La barra lateral es un índice con una entrada por sección que enlaza a su ancla (`#slot-sound-000`); el campo de filtro deja sólo las secciones que contengan el texto buscado (slot, nombre, estado o clave, p. ej. `R1Volume`) y filtra el índice a la vez. Con `/` se salta al filtro y con `Esc` se limpia. La sección de caché y la de avisos van al final, y una comparación sin diferencias también genera la página, con el aviso de que no hay nada que recorrer.

Todos los nombres y valores se escapan (`<`, `>`, `&`), porque un preset puede llamarse `<b>&amp;` y no debe convertirse en marcado. El informe no depende del idioma del sistema y se ve igual en tema claro y oscuro (`prefers-color-scheme`); sin JavaScript sigue siendo legible, sólo se pierde el filtro.

En el modo de comparación, códigos de salida: **0** sin diferencias, **1** con diferencias, **2** si una ruta no se puede leer. `--exit-zero` fuerza 0 tras una comparación correcta, para encadenarla en un script sin que el `1` se lea como error. El CSV escribe una fila por diferencia (`kind`, `slot`, `estado`, `nombre_a`, `nombre_b`, `contenido`, `nombre`) y el JSON añade el resumen, las claves que cambian y los avisos de cada carpeta.

### Aplicar a una copia sólo lo que cambió (`--apply`)

`--apply` convierte la comparación en un plan de escritura sobre la **segunda** carpeta: A es la referencia y B la copia que se actualiza. Por defecto **no escribe nada** —enseña qué slots tocaría— y sólo con `--write` los aplica. Así la simulación es siempre el primer paso, no un flag opcional.

```bash
python NeuronVS_neurondb/tools/compare_neurondb.py OLD COPIA --apply
python NeuronVS_neurondb/tools/compare_neurondb.py OLD COPIA --apply --write
python NeuronVS_neurondb/tools/compare_neurondb.py OLD COPIA --apply --write --prune
```

Qué hace con cada slot del diff:

| Estado | Acción | Qué escribe en B |
|---|---|---|
| `cambia` (mismo juego de ficheros, distinto SHA-256) | `sustituir` | la carpeta `NNN.sound/` pasa a ser una copia byte a byte de la de A; los ficheros que sólo tenía B desaparecen con la carpeta vieja |
| `nuevo` (sólo en A) | `crear` | se crea `NNN.sound/` en B con todos los ficheros de A |
| `borrado` (sólo en B) | `omitir` | nada; el slot se queda. Con `--prune` pasa a `borrar` y su carpeta se elimina |
| `igual` | — | no se toca: ni se recopia ni cambia su `mtime` |

- **La unidad es el slot, no el fichero.** Un slot del plan se copia entero a `NNN.sound.applying` y se renombra en su sitio, así que B nunca enseña un slot a medias; al sustituir, la carpeta anterior se aparta a `NNN.sound.replacing` y vuelve si el intercambio falla. Las acciones se ejecutan en el orden del plan (primero sonidos, luego modelos, por número de slot). Cualquier `.applying`, `.replacing` o `.removing` que sobre de una ejecución anterior bloquea el plan en vez de pisarse.
- **La caché no se escribe.** `SoundNames`/`ModelNames` no son slots y no se tocan: el plan avisa de cuántas líneas quedarán sin coincidir con su preset después de la copia. Reconstruirla es trabajo del gestor de presets (`preset.py sync`).
- **Se verifica releyendo B.** Tras `--write`, la herramienta vuelve a cargar la copia y comprueba que cada slot del plan coincide con A fichero a fichero (SHA-256) y que los slots fuera del plan siguen byte a byte como estaban. Si algo no cuadra, sale con 1 y lo dice.
- **Cada slot es atómico, el plan no.** Si un slot falla (permisos, disco lleno), los anteriores quedan aplicados y el informe se detiene ahí; volver a lanzar el mismo plan recalcula lo que falta y continúa. Cada slot concreto nunca queda a medias: se copia a `.applying` y se renombra, y el anterior se aparta a `.replacing` con vuelta atrás si el intercambio falla.
- **Nada se escribe a ciegas.** Antes de renombrar, el plan comprueba que la carpeta de A existe y que los restos de trabajo no están en medio; si hay algún bloqueo, ningún slot se toca y sale con 2.
- **Códigos de salida.** Sin `--write`: **1** si hay acciones pendientes (sigue siendo una diferencia), **0** si no hay nada que hacer; `--exit-zero` lo baja a 0. Con `--write`: **0** sólo si todas las acciones se aplicaron y la verificación pasó; **1** si alguna falló o la recarga no coincide; **2** si el plan está bloqueado o una carpeta no se puede leer.
- `--json` devuelve `mode: "apply"`, `write`, `prune`, `actions` (con `source`, `target`, `files`, `dropped`, `bytes`, `detail`, `keys`, `note` y `result`), `summary` (acciones, sustituciones, creaciones, borrados, omitidas, slots intactos y bytes), `cache` (líneas obsoletas previstas o reales, `null` si el fichero no existe), `blockers` y `verified`. `--params` añade las claves del preset que cambian a cada línea del plan. `--csv`, `--html` y `--all` son del diff y con `--apply` se rechazan con código 2.
- **Dirección.** Para llevar los cambios de una copia editada a una instalación limpia, pásala como A: `compare_neurondb.py EDITADA DESTINO --apply --write`.

```
$ python …/compare_neurondb.py OLD COPIA --apply
NeuronDB A: …/NeuronDB-old (referencia)
NeuronDB B: …/NeuronDB-copia (copia)

  sustituir sonido  000  'Symbiont' -> 'Archon'                   sound.script: 8 valores [...]
  crear     sonido  900  'Bass' (nuevo en la copia)               2 ficheros, 9412 B
  omitir    sonido  007  'Myst' (sólo en la copia; --prune lo borra) 2 ficheros, 17489 B

plan     2 acciones (1 sustituir, 1 crear, 0 borrar), 1 omitida(s), 350 slots intactos
tamaño   18824 B se copiarían de A
caché    1 entrada(s) de SoundNames no coincidirán con su preset (no se toca la caché)
simulación: no se ha escrito nada; repite el comando con --write para aplicarlo
```

### Validar una sola instalación (`--check`)

`--check` mira **una** carpeta: no compara con nada, valida que la instalación sea coherente consigo misma. Sirve antes de publicar una copia, después de una sesión de edición y para revisar una base descargada.

```bash
python NeuronVS_neurondb/tools/compare_neurondb.py --check "…/NeuronDB"
python NeuronVS_neurondb/tools/compare_neurondb.py --check "…/NeuronDB" --json
python NeuronVS_neurondb/tools/compare_neurondb.py --check "…/NeuronDB" --ignore-cache
```

```
NeuronDB: …/NeuronDB
  estructura  351 sonidos, 1 modelo; libres 649 de 1000 y 511 de 512
  esquema     351 presets leídos contra 445 claves del esquema; 156192 valores revisados
  nombres     351 nombres distintos (16 códigos en 32..122)
  modelos     1 modelo revisado (MName, map.script, .scape/.sphere)
  caché      SoundNames ausente (el DLL la crea al arrancar escaneando los presets)
  caché      ModelNames ausente (el DLL la crea al arrancar)

Avisos (3):
  - 011.sound: falta 1 clave del esquema (SlicerSwitchBackup)
  - 012.sound: falta 1 clave del esquema (SlicerSwitchBackup)
  - 023.sound: falta 1 clave del esquema (SlicerSwitchBackup)

sin problemas: la instalación es válida (3 avisos)
```

| Ámbito | Qué comprueba |
|---|---|
| estructura | `Sounds/` y `Models/` existen; cada carpeta `NNN.sound` tiene `sound.script`; no hay carpetas fuera del patrón ni slots fuera de 000–999 / 000–511; no quedan `*.sound.deleting` ni `*.sound.restoring` de una operación a medias; las líneas de `sound.stickrec` son 9 dígitos hex |
| esquema | cada `sound.script` es `Clave<TAB>entero`, sin claves repetidas (el lector se queda con la última) y con los valores dentro de `min..max` de [`preset_schema.csv`](../NeuronVS_preset_format/preset_schema.csv); las claves desconocidas y las que faltan se avisan, porque el DLL ignora las primeras y rellena las segundas con el default |
| nombres | los 16 `SoundNameC00..15` existen y son códigos 32..122; el nombre no está vacío; los nombres repetidos se avisan (el DLL los permite) |
| modelos | `MName` presente y de 11 caracteres como máximo; `map.script` de 1027 líneas (3 + 128 zonas × 8) con tabulador en cada una; cada `.scape` empieza por `csAN` y cada `.sphere` por `psAN`, y cada `.scape` tiene su `.sphere` |
| caché | si `SoundNames`/`ModelNames` existen, cada slot ocupado tiene su entrada y coincide con el preset; los nombres de slots vacíos y las líneas duplicadas se reportan; si no existen, es lo normal en una copia del instalador y se dice |

- **Problema frente a aviso.** Un `problema` es algo que el DLL rechazaría o que contradice el formato (script ausente, valor fuera de rango, tag `csAN` roto, caché obsoleta); un `aviso` es tolerado (un preset v1 sin `SlicerSwitchBackup`, una caché ausente, un nombre repetido) y **no cambia el código de salida**.
- Códigos de salida: **0** sin problemas, **1** con problemas, **2** si la carpeta no se puede leer. `--exit-zero` fuerza 0. `--json` devuelve `mode: "check"`, el `summary` (sonidos, modelos, slots libres, valores revisados, problemas y avisos), la lista `ok` y los `findings`, cada uno con `level`, `scope`, `slot` y `message`.
- `--ignore-cache` deja la caché fuera: no se leen sus problemas y el informe dice que no se comprobó. `--html`, `--csv`, `--params` y `--all` son del diff y con `--check` se rechazan con código 2.
- Los rangos salen de `NeuronVS_preset_format/preset_schema.csv`; si ese paquete no está, el modo sigue validando estructura, nombres, modelos y sintaxis, y avisa de que no puede comprobar rangos.

## Mapa de funciones

| Dirección | Papel | Evidencia |
|---|---|---|
| `0x10001750` | ruta de la base desde el registro + `/NeuronDB/` | cadenas `0x10052078/6c/60` |
| `0x10001910` | parser de `sound.script` → `float[]` | `sscanf "%s %f"`, stride `0x28`, default `+0x14` |
| `0x10001af0` | escritor de `sound.script` | `_mkdir`, `fopen "w"`, `"%s\t%d\n"` |
| `0x10013ea0` | cargar sonido `id` | `"Sounds/%03d.sound/sound.script"` |
| `0x10013fc0` | guardar sonido `id` | `"Sounds/%03d.sound"` + `"sound.script"` |
| `0x10013ac0` | nombre desde `SoundNameC00..15` | tabla `0x10059f38`, 16 B por sonido |
| `0x10013b20` / `0x10013cc0` | leer / escribir la caché de nombres | `"%%0%dd\t%%%ds"` |
| `0x1000be10` | constructor del banco (nombres, caché, escaneo 0–999) | `"--<empty>--"`, `"InitSound"` |
| `0x100132d0` / `0x100133b0` | cargar / crear sonido desde la UI | llaman a `0x10013ea0` / `0x10013fc0` |
| `0x1000a930` | cargar `map.script` del modelo | `"Models/%03d.model/map.script"` |
| `0x1000b230` | cargar `.scape`/`.sphere` por source | `"%s/%06d.scape"`, `"%s/%06d.sphere"` |
| `0x1000b490` | leer un fichero entero a memoria | `_open`/`_lseek`/`_read` |
| `0x1001b140` | `C_NeuronCore_ctor` → crea el banco | llama a `0x1000be10` |

## Verificación

`python tools/verify_neurondb.py` → **exit 0**. Comprueba, contra el DLL:

- que las cadenas de registro y de ruta están en las direcciones citadas y que `0x10001750`, `0x10013ea0`, `0x10013fc0`, `0x1000a930` y `0x1000b230` las referencian;
- que el parser avanza `0x28` por registro, lee el default en `+0x14` (`MOV ESI,[EAX+ESI-0x14]`) y contiene `FCOMP [0x1004cfb8]` / `FSUB [0x1004cfb4]`;
- que el escritor usa `"%s\t%d\n"` y modo `"w"`;
- que el constructor de nombres usa `0x10059f38 + id*0x20`, `0xf0` y stride `0x28`;
- que **las 445 claves de `sound_schema.csv` coinciden, en orden, con los 445 punteros de nombre** del bloque `.rdata` en `0x10049f08` (stride `0x1c`).

Y contra la carpeta:

- 351 carpetas de sonido, hashes y tamaños de `sound.script`, 445 claves (444 en los tres antiguos), todos los valores enteros, nombres decodificados únicos y correctos;
- 103 `sound.stickrec` no vacíos, 49 hashes distintos, todas las líneas de 9 dígitos hex;
- modelo `511` = `sinew` (≤11 caracteres), `map.script` de 1027 líneas y 128 zonas, y los dos binarios con su tamaño, tag y SHA-256.

`tools/verify_compare_neurondb.py` prueba el comparador como se usa: monta dos NeuronDB en un directorio temporal con diferencias conocidas (un preset renombrado, uno retocado, uno nuevo, uno borrado, un `stickrec` distinto, un modelo renombrado con su binario cambiado, `SoundNames` con dos entradas distintas y una obsoleta, `ModelNames` sólo en A) y contrasta el informe, el JSON, el CSV y los códigos de salida. Comprueba que A contra A sale 0 y dice «sin diferencias»; que A contra B sale 1 y resume **5 sonidos** (1 nuevo, 1 borrado, 3 con contenido nuevo, 1 renombrado) y **1 modelo**; que el 002 aparece como nuevo y el 003 como borrado; que `Alpha -> Delta` se lee en la columna de nombre mientras el 001 sólo cambia `SoundR1Volume 95->100`; que el `stickrec` del 004 basta para contar como contenido; que la caché de 002 y 003 se lista pero la de 000 no (las dos dicen `Alpha`) y que la obsolescencia de B se avisa aparte; que `--ignore-cache` deja 6 diferencias de preset y ningún aviso de caché; que `--params` lista `SoundR1Volume 95 -> 100` en el 001 y las cuatro claves `SoundNameC00..C03` del 000, y no inventa detalle para el 003; que `--all` lista los 4 slots sin contarlos; que el CSV trae 9 filas y el modelo 000 con sus dos nombres; que una ruta inexistente sale con 2. Sobre el HTML comprueba que se escribe aunque haya diferencias, que es un documento completo sin ningún recurso de red, que hay una sección por diferencia con sus anclas y **dos paneles (A y B) por sección**, que el índice enlaza y filtra, que la sección del slot borrado se titula con su nombre de A, que el 000 lista `SoundNameC00` con `65` y `68`, que la caché separa el fichero de su presencia, que un preset llamado `<b>&amp;` sale escapado, que sin diferencias la página se escribe igual y lo dice, y que un `--html` en una carpeta inexistente sale con 2. Sobre `--check` comprueba que la carpeta A del fixture sale 0 sin problemas, con el resumen correcto (4 sonidos, 1 modelo, 84 valores revisados) y avisos solo por el `map.script` corto y las claves ausentes; que una copia rota a propósito —script ausente, `SoundNumVoices` a 9999, `SoundPan` repetido, código de nombre 0, `sound.stickrec` con una línea que no es hexadecimal, `.scape` con tag `XXXX`, carpeta inesperada, `*.sound.deleting`, `SoundNames` obsoleta/duplicada/con una línea inválida y `ModelNames` desfasado— sale 1 con problemas en los **cinco ámbitos** del JSON; que `--ignore-cache` no menciona `SoundNames`, que `--exit-zero` devuelve 0, que `--check` con dos rutas o con `--html` sale 2 y que el `NeuronDB` real pasa con los tres avisos de `SlicerSwitchBackup`. Contra la carpeta real comprueba que `NeuronDB` contra sí mismo da 351 sonidos y 0 diferencias con la caché ausente.

Sobre `--apply` monta un par propio (000 y 005 idénticos en las dos copias, 001 con otro contenido, 002 sólo en A y 003 sólo en B) y comprueba que la simulación sale con 1, escribe el plan esperado (`sustituir 001`, `crear 002`, `omitir 003`, 2 slots intactos), no toca **ningún** fichero ni `mtime` de la copia y prevé la línea de caché que quedará obsoleta y la ausencia de `ModelNames`; que `--params` lista las claves del preset sustituido; que `--apply --write` sale con 0, deja 001 y 002 byte a byte como A, conserva 003 sin `--prune`, no toca `SoundNames` ni los slots 000/005, no deja carpetas `.applying`/`.replacing`/`.removing` y verifica que los slots fuera del plan no se movieron; que después el plan ya no tiene acciones (sale 0); que `--prune` enseña el borrado y no lo hace sin `--write`, y que `--apply --prune --write` elimina 003 sin tocar la caché y prevé las dos líneas obsoletas resultantes; que un `001.sound.applying` huérfano bloquea el plan con código 2 sin escribir nada y que el JSON informa del bloqueo; y que `--write`/`--prune` sin `--apply`, `--apply --html` y `--apply --check` se rechazan con 2.

## Reproducir

```bash
python NeuronVS_neurondb/tools/scan_neurondb.py           # reescribe los CSV
python NeuronVS_neurondb/tools/verify_neurondb.py         # exit 0
python NeuronVS_neurondb/tools/verify_compare_neurondb.py # exit 0
python NeuronVS_neurondb/tools/compare_neurondb.py A B    # 0 iguales, 1 distintas, 2 error
python NeuronVS_neurondb/tools/compare_neurondb.py A B --html diff.html
python NeuronVS_neurondb/tools/compare_neurondb.py A B --apply         # simula la copia
python NeuronVS_neurondb/tools/compare_neurondb.py A B --apply --write # la aplica y verifica
python NeuronVS_neurondb/tools/compare_neurondb.py --check A   # 0 válida, 1 problemas, 2 error
```

El escáner busca la carpeta en `../Hartmann Music/NeuronVS/NeuronDB` respecto del paquete; el verificador necesita además `NeuronVS.dll` y el corpus `NeuronVS_decompiled/` en el directorio padre.

## Limitaciones

- **`.scape`/`.sphere`: trazados, con zonas sin consumidor.** El formato y los lectores están en [`SCAPE_SPHERE.md`](SCAPE_SPHERE.md); quedan sin explicar dos enteros de la cabecera del sphere (`31`, `61`), el uso de los 6 pares del chunk `fdAN` y los floats 1–3 de cada banda, que están a cero en el único modelo instalado. El bloque de 6152 B sí está descifrado: 8 B de cabecera + tres arrays de 1024 `u16` (A = Hz, B = amplitud ordenada, C = bin).
- **`sound.stickrec`: no lo lee el DLL.** El desglose `4-1-1-3` es una inferencia a partir de la monotonía del primer campo y de los valores constantes; podría ser otra cosa (por ejemplo un registro de eventos con otro reparto de bits).
- **`SoundNames`/`ModelNames` no existen en esta copia**, así que su formato se documenta desde el código (`"%%0%dd\t%%%ds"`, apertura `w+`) y no desde un fichero real. El gestor del paquete [`NeuronVS_preset_format`](../NeuronVS_preset_format/README.md) escribe y valida `SoundNames` a partir de los presets, pero tampoco se ha cruzado con un fichero generado por el DLL en Windows.
- **El informe HTML es estático**: no reproduce audio ni dibuja los modelos, y no incluye el `sound.stickrec` ni los `.scape` más allá de su hash y tamaño. Es un diff para leer, no un visor.
- **`--apply` copia slots, no los fusiona.** Si un slot cambió en las dos copias, gana A entero: los ficheros que sólo tenía B se van con la carpeta vieja, y no hay fusión de parámetros ni de `stickrec`. Tampoco guarda un diario ni un `undo`: la red de seguridad es la simulación, así que conviene revisar el plan antes de `--write`. La caché de nombres queda como estuviera; tras aplicar un renombrado o un borrado habrá que reconstruirla con [`preset.py sync`](../NeuronVS_preset_format/README.md).
- **`--check` valida formato y coherencia, no audio.** Un `.scape` con el tag `csAN` correcto pero el cuerpo corrupto pasa, igual que un preset con valores legales que suenan mal; `map.script` se valida por número de líneas y tabuladores, no clave a clave.
- **El comparador mira contenido, no música.** Dos `.scape` distintos se detectan por hash: no dice si el modelo suena distinto, ni compara valores de parámetros uno a uno cuando el script cambia de tamaño (`--params` lista las claves que difieren, pero no interpreta si el cambio es audible). Un `sound.script` reescrito con el mismo contenido en otro orden de líneas cuenta como cambio de contenido aunque el motor lo lea igual.
- **La tabla de `C_Param` se construye en tiempo de ejecución**: el parser la recorre con stride `0x28` (`this+0` = tabla, `this+8` = cuenta) y en `.rdata` están las 445 claves con sus descriptores a stride `0x1c`. La copia la hace `FUN_10013de0` al arrancar, en el objeto `snddat` de 12 bytes; el layout del registro y la cadena completa están en [`NeuronVS_preset_format/PARAM_RECORD.md`](../NeuronVS_preset_format/PARAM_RECORD.md).
- El valor de registro se leyó en esta máquina (32 bits, `WOW6432Node`); en otra instalación la ruta puede diferir, y el verificador no depende de él.
