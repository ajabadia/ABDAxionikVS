# Neuron80GB-OS15 — los modelos del disco del estudio

`Neuron80GB-OS15.tib` (2.362.286.080 B ≈ 2,2 GiB, con copia en `.zip` y `.rar`) es una imagen Acronis del disco de la máquina donde se montaban los modelos de NeuronVS. Descomprimida son **45,7 GB de disco lógico** repartidos en **302.041 bloques**, y dentro están los binarios de modelo que nunca salieron a la calle: la instalación sólo trae el modelo `511` (*sinew*), y aquí hay **1.567 parejas `.scape`/`.sphere`** — los 1.567 modelos del banco `NeuronVS-db`, más los renders antiguos del mismo id que quedaron en el disco.

Este documento describe el contenedor, las cuatro trampas que tiene el carveo y el resultado de contrastar lo extraído byte a byte contra el NeuronDB instalado.

| Fichero | Qué contiene |
|---|---|
| `models/` | 3.134 binarios: 1.567 `.scape` + 1.567 `.sphere`, 1,95 GB |
| [`models/models.csv`](models/models.csv) | una fila por binario: offset en el disco lógico, tag, id, resolución, largo, bucle, frames, paso, bandas, nombres, SHA-256 y ruta |
| [`tools/tib_models.py`](tools/tib_models.py) | extrae los modelos de la imagen (y `--self-test`, el ensayo del ensamblado) |
| [`tools/verify_tib_models.py`](tools/verify_tib_models.py) | vuelve a leer cada fichero de `models/` y comprueba cabecera, nombres, frames y SHA-256 contra el CSV |
| [`tools/compare_installed.py`](tools/compare_installed.py) | compara la extracción con un NeuronDB instalado, fichero a fichero |
| [`cmp_installed.log`](cmp_installed.log) | la salida de esa comparación contra `NeuronVS-db/NeuronDB/Models` |

El formato de los ficheros no se repite aquí: está en [`NeuronVS_neurondb/SCAPE_SPHERE.md`](../NeuronVS_neurondb/SCAPE_SPHERE.md).

## El contenedor

No hay sistema de ficheros que recorrer: la imagen es una cadena de streams zlib.

```
+0x00  12 B de cabecera Acronis
+0x0C  stream zlib  →  256 KB de disco lógico
       ...
```

Cada stream suelta 262.144 B y el siguiente empieza en los 64 B posteriores al final del anterior; entre los dos hay una cabecera de bloque que no forma parte de los datos. Concatenando las salidas se reconstruye el disco. El extractor busca los zlib por su cabecera (`0x78 0x01|0x5E|0x9C|0xDA`) y descomprime hasta `eof`, sin saber nada del formato Acronis.

Sobre ese flujo se buscan las cadenas de chunks del formato de modelo:

```
csAN/psAN  (100 B / 140 B)  cabecera
mnAN       (104 B)          12 nombres de 8 caracteres
fdAN       (56 B)           6 pares de floats
<datos>                     curva int16 (.scape) o frames (.sphere)
```

Un candidato se acepta sólo si los tamaños son exactamente 100/140, 104 y 56, los 96 B de nombres son ASCII imprimible y la cabecera cuadra: formato `0x100` y `1000 < largo < 4.000.000` en las curvas; `paso == 0x10 + bandas × floats × 4 + bloque` y offset de frames `300` en las esferas. En los 45,7 GB de disco no aparece ni una sola `csAN`/`psAN` que pase esos filtros y no sea un modelo: la cadena de cuatro letras no sale por casualidad.

## Las cuatro trampas

### 1. La página de 4 KB en el payload

El contenedor mete su propio índice dentro de los datos, a la altura de `0xC000` del payload: una tabla de entradas de 4 B —un contador `u16` que sube de uno en uno y un segundo `u16` constante— seguida de ceros hasta los 4 KB. En un `.scape` eso alarga el fichero justo 4.096 B; en un `.sphere` cae en medio de un frame.

Se reconoce por la firma (`16 02 12 01 17 02 12 01` en el instalado) y se descarta, pero **sólo si al quitarla siguen estando las muestras que declara la cabecera**: hay modelos cuyo contenido parece una página y recortarlos los dejaba 4 KB cortos. Así quedó `3f104dc8.scape` en su sitio.

### 2. El hueco de 4 KB entre tandas de frames

La serie de frames de una esfera se corta cada cierto número de frames con un hueco de 4.096 B que no es parte del fichero. El ensamblado encadena por id: si el frame siguiente no está donde toca, se prueba 4 KB más allá y se sigue. 135 esferas lo necesitan.

Buscar más lejos (hasta 1 MB) empeora el resultado: engancha frames de la copia siguiente del mismo modelo, que es un render distinto.

### 3. El mismo modelo escrito varias veces

El disco del estudio es un disco de trabajo: el mismo modelo está escrito varias veces, una por render. Mismos ids, datos distintos, uno detrás de otro. Una esfera termina **donde el id deja de encadenar**, no donde se acaba la racha de frames. 56 ids aparecen hasta cuatro veces.

El ensamblado se hace por llamadas sobre una ventana de 8 MB, así que la posición hay que guardarla en cada salida: si no, la llamada siguiente vuelve a copiar en el buffer lo ya leído y el fichero sale 30 veces más largo (45.736 MB en vez de 1.953 MB). Lo cubre `python tools/tib_models.py --self-test`, que monta 32 copias sintéticas y exige 440.356 B y 67 frames por copia.

### 4. Curvas sin bucle

345 de los 1.567 `.scape` llevan el bucle a cero (`loop_start == loop_end == 0`). Exigir `inicio < fin` los descartaba; el banco instalado los tiene, así que se aceptan.

## Lo que sale

```
3134 binarios   1567 .scape (380,8 MB) + 1567 .sphere (1.572,6 MB)
1506 ids        56 repetidos (hasta 4 copias del mismo modelo)
20 juegos       de 12 ejes de nombre, todos ASCII
173.302 frames  de los 178.486 que declaran las cabeceras (97,1 %)
```

Los `.scape` son curvas `int16` con resolución 84, 169, 168, 337, 2047… (la resolución es el número de muestras por ciclo, no una potencia de dos). Los `.sphere` guardan 25 bandas en 1.388 esferas, 61 en 113 y 1 en 66, con 8 floats por banda en 754, 64 en 327, 16 en 324, 32 en 129 y 4 en 33, más el bloque de 1.024 parciales de 6.152 B.

## Verificación

`tools/verify_tib_models.py` relee los 3.134 ficheros desde cero y no encuentra problemas: la cadena de chunks, los nombres, la cabecera, el paso de frame, la longitud exacta (el fichero acaba en el último frame) y el SHA-256 del CSV cuadran; los 1.506 ids tienen su pareja.

Contra el banco instalado (`NeuronVS-db/NeuronDB/Models`, 3.134 ficheros), `tools/compare_installed.py`:

| Veredicto | `.scape` | `.sphere` |
|---|---|---|
| idénticos byte a byte | 1.390 | 1.425 |
| idénticos salvo la página del contenedor | — | 68 |
| idénticos tras quitar la página | 175 | 6 |
| distintos | 2 | 68 |

El modelo `511` del instalador de Hartmann (`Hartmann Music/NeuronVS/NeuronDB/Models/511.model`) sale idéntico en los dos ficheros, `.scape` y `.sphere`.

La página del contenedor se guarda en el `.sphere` tal como está en la imagen, pero su contenido es el índice del contenedor y cambia de una imagen a otra: en 68 esferas el resto del fichero coincide byte a byte y sólo difieren esos 4 KB.

## Límites

Los 70 ficheros que no cuadran son esferas cortas (y 2 curvas): la imagen es una foto de un disco en uso y hay regiones tapadas por ficheros posteriores, así que sus frames se acaban antes de lo que declara la cabecera. El extractor devuelve lo que hay y `models.csv` lo dice (`frames_stored` frente a `frames_valid`); no se rellena con ceros ni se inventan frames.

Tampoco se interpreta el contenido: qué significan las bandas, los 1.024 parciales y los 12 ejes está en [`NeuronVS_neurondb/SCAPE_SPHERE.md`](../NeuronVS_neurondb/SCAPE_SPHERE.md) y [`NeuronVS_neurondb/SYNTH_FRAMES.md`](../NeuronVS_neurondb/SYNTH_FRAMES.md).

## BrainMapper

`BrainMapper` es un utilitario de edición de base de datos **para sistemas libres
de Mac OS X**, diseñado para resolver el problema de que <Neuron>/<NeuronVS> referencien
los Modelos por *número de slot* en lugar de por nombre. El mismo disco puede contener
varias copias del mismo modelo (un render distinto por copia), y cada copia termina
donde el id deja de encadenar. Con estos ficheros extraídos se puede usar BrainMapper
de este modo:

1. Genera los ficheros de nombres con `brain_mapper_names.py` (ver más abajo).
2. Con `soundnames` y `modelnames` listos, BrainMapper permite:
   * **Mover Modelos a otros slots** sin que se rompan los Sounds que los usan.
   * **Identificar y eliminar Modelos sin usar**, liberando hueco para los nuevos.
   * **Ver qué Sound usa qué Modelo** sin cargar cada Sound por separado.
   * **Reemplazar un Modelo en todos los Sounds** por otro diferente.
   * **Escribir los ficheros `soundnames`/`modelnames`** que el plugin de Neuron VS
     usa para mostrar los nombres correctos en los menús.

### Generar los ficheros de nombres

```
python tools/brain_mapper_names.py --models-csv models/models.csv --out tools/names
```

Esto escribe:

* `tools/names/modelnames` — 512 líneas, una por slot:
  `slot<TAB>nombre-del-modelo`
* `tools/names/soundnames` — 512 líneas, una por slot de Sound:
  `slot<TAB>` (las entradas están vacías hasta que se conocen los Sound reales).

La asignación por defecto es `slot = id % 512`, con lo que todos los 1.567 ids
caben en el banco de 512. Para cambiar la asignación de slots se puede pasar un
fichero JSON de mapeo:

```
--slot-map mapping.json
```

### Ficheros generados

| Fichero | Contenido |
|---|---|
| [`tools/brain_mapper_names.py`](tools/brain_mapper_names.py) | herramienta que genera `soundnames` y `modelnames` a partir de `models/models.csv` |

### Nota sobre el estado actual

El extractor (`tib_models.py`) devuelve **1.567 modelos** con su id en hex y su
`names` (los 12 ejes que los definen). El fichero `models.csv` es la única fuente
auténtica de los nombres; `models/nameMap.json` y `NeuronVS_neurondb/Models/nameMap.json`
son su versión indexada. El fichero `soundnames` de este script sale con entradas
vacías porque los ficheros Sound reales no están en el repositorio; una vez que se
tienen, se puede rellenar `soundnames` con el nombre de los dos Modelos que carga
cada Sound, y BrainMapper hará el resto (reordenar, eliminar, reemplazar, salvar).
