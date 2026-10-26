# verify_model_map_000.md

## fuente real inspeccionada
- ruta: `C:\Users\ajaba\Downloads\neuron\NeuronVS-db\NeuronDB\Models\000.model\map.script`
- contenido extraído esta sesión: txt in situ, no descompilado ni invertido
- herramienta usada: read_files del archivo real

## forma observada de 000.model/map.script
- encabezado:
  - MapVersionMajor 0
  - MapVersionMinor 9
  - MapVersionBuild 2
- patrón por tono:
  - NNNLowKey
  - NNNHiKey
  - NNNRootKey
  - NNNLowSource
  - NNNHiSource
  - NNNDetune
  - NNNVolume
  - NNNPan
- tono 000:
  - LowKey 0, HiKey 37, RootKey 36
  - LowSource 1, HiSource 1
  - Detune 0, Volume 0, Pan 0
- tono 001:
  - LowKey 38, HiKey 49, RootKey 48
  - LowSource 2, HiSource 2
  - Detune 0, Volume 0, Pan 0
- tono 002:
  - LowKey 50, HiKey 61, RootKey 60
  - LowSource 3, HiSource 3
  - Detune 0, Volume 0, Pan 0
- tono 003:
  - LowKey 62, HiKey 73, RootKey 72
  - LowSource 4, HiSource 4
- tono 004:
  - LowKey 74, HiKey 85, RootKey 84
  - LowSource 5, HiSource 5
- tono 005:
  - LowKey 86, HiKey 127, RootKey 96
  - LowSource 6, HiSource 6
- tonos 006..127:
  - todos LowKey 0, HiKey 0, RootKey 0, LowSource 0, HiSource 0, Detune 0, Volume 0, Pan 0

## lectura clave
- el “map” de modelo NO es un synth preset de 445 parámetros; es una capa de asignación de tono a fuente Mu
- parámetros: 8 por tono × 128 tonos = 1024 secuencias de clave/valor
- el modelo 000 usa 6 fuentes reales: Fuente 1..Fuente 6, una por tono activo
- tono 000 usa Fuente 1, tono 005 usa Fuente 6
- fuentes fuera de rango o sin asignar se marcan con fuente 0

## relaciones con la cuestión de entrada
- este archivo ya tiene sentido interno: define que modelo carga qué Mu por rango de tono
- lo que falta para que una entrada nueva sea usable:
  - una o varias fuentes Mu en el banco real de neuron
  - su propio 00000X.scape y 00000X.sphere cuando el modelo lo requiera
  - o el camino del host para generar ese par de archivos desde un audio de entrada
- por eso la inspección del map confirma que “todo modelo” no es sinónimo de “toda entrada usable”; el map solo enlaza
