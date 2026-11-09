# Enlaces relativos rotos — inventario

> **Fecha:** 2026-11-08. **Alcance:** 29 documentos de `DOCS/reverse_engineering`.
> **Qué es:** inventario de cada enlace relativo que no resuelve a un fichero existente
> (comprobado con `os.path.exists` sobre la ruta resuelta, ignorando el fragmento `#…`), con
> la alternativa concreta cuando existe en el árbol. **No se ha reescrito ningún enlace**: el
> texto original sigue igual y cada documento lleva una nota al principio que apunta aquí.

## Resumen

**222 enlaces rotos** en **29 documentos**.

| Causa | Enlaces | Significa |
|---|---:|---|
| `imagen` | 93 | captura/recurso no versionado |
| `prefijo` | 58 | ruta con prefijo inexistente |
| `script` | 31 | script de verificación no versionado |
| `volcado` | 15 | volcado de datos no versionado |
| `carpeta` | 13 | carpeta no versionada |
| `fichero` | 6 | fichero no versionado |
| `basename` | 6 | mismo fichero en otra carpeta |

### Por documento

| Documento | Rotos | Con alternativa en el árbol |
|---|---:|---:|
| [`README.md`](README.md) | 21 | 19 |
| [`bitmaps/GALERIA.md`](bitmaps/GALERIA.md) | 86 | 0 |
| [`bitmaps/README.md`](bitmaps/README.md) | 4 | 0 |
| [`classes/CLASSES.md`](classes/CLASSES.md) | 1 | 0 |
| [`classes/README.md`](classes/README.md) | 12 | 5 |
| [`dsp/CONSTANT_TYPES.md`](dsp/CONSTANT_TYPES.md) | 1 | 0 |
| [`dsp/README.md`](dsp/README.md) | 11 | 2 |
| [`dsp/STATE_SPLIT.md`](dsp/STATE_SPLIT.md) | 1 | 0 |
| [`dsp/ZONES.md`](dsp/ZONES.md) | 1 | 0 |
| [`filmstrip/README.md`](filmstrip/README.md) | 8 | 1 |
| [`layout/KNOB_PARAM_LINK.md`](layout/KNOB_PARAM_LINK.md) | 2 | 2 |
| [`layout/OBSERVER_PASSES.md`](layout/OBSERVER_PASSES.md) | 2 | 1 |
| [`layout/PAINT_PIPELINE.md`](layout/PAINT_PIPELINE.md) | 2 | 0 |
| [`layout/README.md`](layout/README.md) | 3 | 0 |
| [`neurondb/NEURON80GB_OS15_README.md`](neurondb/NEURON80GB_OS15_README.md) | 9 | 4 |
| [`neurondb/README.md`](neurondb/README.md) | 12 | 4 |
| [`neurondb/SCAPE_SPHERE.md`](neurondb/SCAPE_SPHERE.md) | 1 | 1 |
| [`neurondb/SYNTH_FRAMES.md`](neurondb/SYNTH_FRAMES.md) | 3 | 0 |
| [`observers/OBSERVER_CALLBACKS.md`](observers/OBSERVER_CALLBACKS.md) | 3 | 1 |
| [`observers/README.md`](observers/README.md) | 4 | 2 |
| [`port/PLAN.md`](port/PLAN.md) | 3 | 3 |
| [`port/PLAN_JUCE9.md`](port/PLAN_JUCE9.md) | 1 | 1 |
| [`port/README.md`](port/README.md) | 2 | 2 |
| [`port/TRANSLATOR.md`](port/TRANSLATOR.md) | 6 | 4 |
| [`preset_format/OBSERVER_CALLBACK.md`](preset_format/OBSERVER_CALLBACK.md) | 2 | 1 |
| [`preset_format/PARAM_RECORD.md`](preset_format/PARAM_RECORD.md) | 3 | 2 |
| [`preset_format/README.md`](preset_format/README.md) | 4 | 1 |
| [`resolved/README.md`](resolved/README.md) | 7 | 4 |
| [`vst2/README.md`](vst2/README.md) | 7 | 4 |

## Las alternativas, en una línea

Dos tercios de los enlaces rotos fallan por el mismo motivo: la ruta lleva un prefijo
`NeuronVS_` que no existe en este repositorio. El árbol es **plano** —`dsp/`, `classes/`,
`layout/`, `preset_format/`, `neurondb/`, `vst2/`, `port/`, `observers/`…—, así que la
alternativa es la misma ruta **sin el prefijo**. Ejemplos:

| Enlace escrito | Alternativa que existe |
|---|---|
| `NeuronVS_dsp/ZONES.md` | `dsp/ZONES.md` |
| `NeuronVS_preset_format/PARAM_RECORD.md` | `preset_format/PARAM_RECORD.md` |
| `NeuronVS_classes/README.md` | `classes/README.md` |
| `NeuronVS_neurondb/sound_schema.csv` | `neurondb/sound_schema.csv` |
| `Neuron80GB-OS15/README.md` | `neurondb/NEURON80GB_OS15_README.md` (y `models/models.csv` → `neurondb/models.csv`) |

Lo que **no** tiene alternativa son los artefactos que nunca se versionaron: las capturas
(`png/`, `thumbs/`, `contactsheet.png`, `class_graph.*`, `*.gif`, `wav/`), los volcados
(`matrix_runtime.log`, `*.csv` de salida, `cmp_installed.log`) y los scripts de verificación
(`tools/*.py`). El documento describe cómo se obtuvieron, pero el fichero no está aquí: la
alternativa es regenerarlo con el procedimiento que describe su sección, o asumir que la
afirmación no es comprobable desde el repositorio.

Hay dos carpetas citadas que no existen ni con prefijo ni sin él: `NeuronVS_decompiled/`
(1.024 funciones descompiladas) y `NeuronVS_compare_presets/`. De la primera sobrevive
`observers/functions/` con los callbacks recuperados.

En el detalle hay filas con la causa `basename`: el fichero con ese nombre existe, pero en
otra carpeta y citado con otra ruta, así que es un **candidato**, no una certeza (por ejemplo
`params_observers_map.csv`, que está en `dsp/`). Las carpetas citadas por su nombre suelto
(`functions`, `tools`, `fixtures`, `_callbacks`) no se resuelven por parecido: de todas ellas
solo existe `observers/functions/`.

---

## Detalle por documento

### `README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 15 | `NeuronVS_decompiled/README.md` | `DOCS/reverse_engineering/NeuronVS_decompiled/README.md` | — (fichero no versionado) |
| 16 | `NeuronVS_classes/README.md` | `DOCS/reverse_engineering/NeuronVS_classes/README.md` | `classes/README.md` |
| 17 | `NeuronVS_resolved/README.md` | `DOCS/reverse_engineering/NeuronVS_resolved/README.md` | `resolved/README.md` |
| 18 | `NeuronVS_dsp/README.md` | `DOCS/reverse_engineering/NeuronVS_dsp/README.md` | `dsp/README.md` |
| 19 | `NeuronVS_preset_format/README.md` | `DOCS/reverse_engineering/NeuronVS_preset_format/README.md` | `preset_format/README.md` |
| 21 | `NeuronVS_layout/README.md` | `DOCS/reverse_engineering/NeuronVS_layout/README.md` | `layout/README.md` |
| 22 | `NeuronVS_bitmaps/README.md` | `DOCS/reverse_engineering/NeuronVS_bitmaps/README.md` | `bitmaps/README.md` |
| 23 | `NeuronVS_filmstrip/README.md` | `DOCS/reverse_engineering/NeuronVS_filmstrip/README.md` | `filmstrip/README.md` |
| 24 | `NeuronVS_neurondb/README.md` | `DOCS/reverse_engineering/NeuronVS_neurondb/README.md` | `neurondb/README.md` |
| 25 | `NeuronVS_vst2/README.md` | `DOCS/reverse_engineering/NeuronVS_vst2/README.md` | `vst2/README.md` |
| 26 | `NeuronVS_compare_presets/README.md` | `DOCS/reverse_engineering/NeuronVS_compare_presets/README.md` | — (fichero no versionado) |
| 27 | `NeuronVS_port/README.md` | `DOCS/reverse_engineering/NeuronVS_port/README.md` | `port/README.md` |
| 28 | `Neuron80GB-OS15/README.md` | `DOCS/reverse_engineering/Neuron80GB-OS15/README.md` | `neurondb/NEURON80GB_OS15_README.md` |
| 40 | `NeuronVS_dsp/README.md` | `DOCS/reverse_engineering/NeuronVS_dsp/README.md` | `dsp/README.md` |
| 54 | `NeuronVS_dsp/STATE_SPLIT.md` | `DOCS/reverse_engineering/NeuronVS_dsp/STATE_SPLIT.md` | `dsp/STATE_SPLIT.md` |
| 55 | `NeuronVS_preset_format/PARAM_RECORD.md` | `DOCS/reverse_engineering/NeuronVS_preset_format/PARAM_RECORD.md` | `preset_format/PARAM_RECORD.md` |
| 65 | `NeuronVS_dsp/CONSTANT_TYPES.md` | `DOCS/reverse_engineering/NeuronVS_dsp/CONSTANT_TYPES.md` | `dsp/CONSTANT_TYPES.md` |
| 74 | `NeuronVS_preset_format/README.md` | `DOCS/reverse_engineering/NeuronVS_preset_format/README.md` | `preset_format/README.md` |
| 83 | `NeuronVS_preset_format/OBSERVER_CALLBACK.md` | `DOCS/reverse_engineering/NeuronVS_preset_format/OBSERVER_CALLBACK.md` | `preset_format/OBSERVER_CALLBACK.md` |
| 94 | `NeuronVS_dsp/ZONES.md` | `DOCS/reverse_engineering/NeuronVS_dsp/ZONES.md` | `dsp/ZONES.md` |
| 103 | `NeuronVS_vst2/README.md#midi` | `DOCS/reverse_engineering/NeuronVS_vst2/README.md` | `vst2/README.md` |

### `bitmaps/GALERIA.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 5 | `contactsheet.png` | `DOCS/reverse_engineering/bitmaps/contactsheet.png` | — (captura/recurso no versionado) |
| 11 | `png/10000.png` | `DOCS/reverse_engineering/bitmaps/png/10000.png` | — (captura/recurso no versionado) |
| 12 | `png/10001.png` | `DOCS/reverse_engineering/bitmaps/png/10001.png` | — (captura/recurso no versionado) |
| 13 | `png/10002.png` | `DOCS/reverse_engineering/bitmaps/png/10002.png` | — (captura/recurso no versionado) |
| 14 | `png/10003.png` | `DOCS/reverse_engineering/bitmaps/png/10003.png` | — (captura/recurso no versionado) |
| 15 | `png/10100.png` | `DOCS/reverse_engineering/bitmaps/png/10100.png` | — (captura/recurso no versionado) |
| 16 | `png/10101.png` | `DOCS/reverse_engineering/bitmaps/png/10101.png` | — (captura/recurso no versionado) |
| 17 | `png/10102.png` | `DOCS/reverse_engineering/bitmaps/png/10102.png` | — (captura/recurso no versionado) |
| 18 | `png/10110.png` | `DOCS/reverse_engineering/bitmaps/png/10110.png` | — (captura/recurso no versionado) |
| 19 | `png/10120.png` | `DOCS/reverse_engineering/bitmaps/png/10120.png` | — (captura/recurso no versionado) |
| 20 | `png/10121.png` | `DOCS/reverse_engineering/bitmaps/png/10121.png` | — (captura/recurso no versionado) |
| 21 | `png/10130.png` | `DOCS/reverse_engineering/bitmaps/png/10130.png` | — (captura/recurso no versionado) |
| 22 | `png/10140.png` | `DOCS/reverse_engineering/bitmaps/png/10140.png` | — (captura/recurso no versionado) |
| 23 | `png/10200.png` | `DOCS/reverse_engineering/bitmaps/png/10200.png` | — (captura/recurso no versionado) |
| 24 | `png/10210.png` | `DOCS/reverse_engineering/bitmaps/png/10210.png` | — (captura/recurso no versionado) |
| 25 | `png/10220.png` | `DOCS/reverse_engineering/bitmaps/png/10220.png` | — (captura/recurso no versionado) |
| 26 | `png/10221.png` | `DOCS/reverse_engineering/bitmaps/png/10221.png` | — (captura/recurso no versionado) |
| 27 | `png/10230.png` | `DOCS/reverse_engineering/bitmaps/png/10230.png` | — (captura/recurso no versionado) |
| 28 | `png/10231.png` | `DOCS/reverse_engineering/bitmaps/png/10231.png` | — (captura/recurso no versionado) |
| 29 | `png/10240.png` | `DOCS/reverse_engineering/bitmaps/png/10240.png` | — (captura/recurso no versionado) |
| 30 | `png/10241.png` | `DOCS/reverse_engineering/bitmaps/png/10241.png` | — (captura/recurso no versionado) |
| 31 | `png/10300.png` | `DOCS/reverse_engineering/bitmaps/png/10300.png` | — (captura/recurso no versionado) |
| 32 | `png/10301.png` | `DOCS/reverse_engineering/bitmaps/png/10301.png` | — (captura/recurso no versionado) |
| 33 | `png/10302.png` | `DOCS/reverse_engineering/bitmaps/png/10302.png` | — (captura/recurso no versionado) |
| 34 | `png/11000.png` | `DOCS/reverse_engineering/bitmaps/png/11000.png` | — (captura/recurso no versionado) |
| 35 | `png/11001.png` | `DOCS/reverse_engineering/bitmaps/png/11001.png` | — (captura/recurso no versionado) |
| 36 | `png/11002.png` | `DOCS/reverse_engineering/bitmaps/png/11002.png` | — (captura/recurso no versionado) |
| 37 | `png/11003.png` | `DOCS/reverse_engineering/bitmaps/png/11003.png` | — (captura/recurso no versionado) |
| 38 | `png/11004.png` | `DOCS/reverse_engineering/bitmaps/png/11004.png` | — (captura/recurso no versionado) |
| 39 | `png/11100.png` | `DOCS/reverse_engineering/bitmaps/png/11100.png` | — (captura/recurso no versionado) |
| 40 | `png/11101.png` | `DOCS/reverse_engineering/bitmaps/png/11101.png` | — (captura/recurso no versionado) |
| 41 | `png/11200.png` | `DOCS/reverse_engineering/bitmaps/png/11200.png` | — (captura/recurso no versionado) |
| 42 | `png/11201.png` | `DOCS/reverse_engineering/bitmaps/png/11201.png` | — (captura/recurso no versionado) |
| 43 | `png/11202.png` | `DOCS/reverse_engineering/bitmaps/png/11202.png` | — (captura/recurso no versionado) |
| 44 | `png/11203.png` | `DOCS/reverse_engineering/bitmaps/png/11203.png` | — (captura/recurso no versionado) |
| 45 | `png/11300.png` | `DOCS/reverse_engineering/bitmaps/png/11300.png` | — (captura/recurso no versionado) |
| 46 | `png/11400.png` | `DOCS/reverse_engineering/bitmaps/png/11400.png` | — (captura/recurso no versionado) |
| 47 | `png/11401.png` | `DOCS/reverse_engineering/bitmaps/png/11401.png` | — (captura/recurso no versionado) |
| 48 | `png/11410.png` | `DOCS/reverse_engineering/bitmaps/png/11410.png` | — (captura/recurso no versionado) |
| 49 | `png/11500.png` | `DOCS/reverse_engineering/bitmaps/png/11500.png` | — (captura/recurso no versionado) |
| 50 | `png/11501.png` | `DOCS/reverse_engineering/bitmaps/png/11501.png` | — (captura/recurso no versionado) |
| 51 | `png/11600.png` | `DOCS/reverse_engineering/bitmaps/png/11600.png` | — (captura/recurso no versionado) |
| 52 | `png/11601.png` | `DOCS/reverse_engineering/bitmaps/png/11601.png` | — (captura/recurso no versionado) |
| 58 | `thumbs/10000.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10000.png` | — (captura/recurso no versionado) |
| 58 | `thumbs/10001.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10001.png` | — (captura/recurso no versionado) |
| 58 | `thumbs/10002.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10002.png` | — (captura/recurso no versionado) |
| 59 | `thumbs/10003.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10003.png` | — (captura/recurso no versionado) |
| 59 | `thumbs/10100.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10100.png` | — (captura/recurso no versionado) |
| 59 | `thumbs/10101.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10101.png` | — (captura/recurso no versionado) |
| 60 | `thumbs/10102.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10102.png` | — (captura/recurso no versionado) |
| 60 | `thumbs/10110.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10110.png` | — (captura/recurso no versionado) |
| 60 | `thumbs/10120.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10120.png` | — (captura/recurso no versionado) |
| 61 | `thumbs/10121.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10121.png` | — (captura/recurso no versionado) |
| 61 | `thumbs/10130.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10130.png` | — (captura/recurso no versionado) |
| 61 | `thumbs/10140.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10140.png` | — (captura/recurso no versionado) |
| 62 | `thumbs/10200.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10200.png` | — (captura/recurso no versionado) |
| 62 | `thumbs/10210.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10210.png` | — (captura/recurso no versionado) |
| 62 | `thumbs/10220.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10220.png` | — (captura/recurso no versionado) |
| 63 | `thumbs/10221.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10221.png` | — (captura/recurso no versionado) |
| 63 | `thumbs/10230.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10230.png` | — (captura/recurso no versionado) |
| 63 | `thumbs/10231.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10231.png` | — (captura/recurso no versionado) |
| 64 | `thumbs/10240.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10240.png` | — (captura/recurso no versionado) |
| 64 | `thumbs/10241.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10241.png` | — (captura/recurso no versionado) |
| 64 | `thumbs/10300.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10300.png` | — (captura/recurso no versionado) |
| 65 | `thumbs/10301.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10301.png` | — (captura/recurso no versionado) |
| 65 | `thumbs/10302.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10302.png` | — (captura/recurso no versionado) |
| 65 | `thumbs/11000.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11000.png` | — (captura/recurso no versionado) |
| 66 | `thumbs/11001.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11001.png` | — (captura/recurso no versionado) |
| 66 | `thumbs/11002.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11002.png` | — (captura/recurso no versionado) |
| 66 | `thumbs/11003.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11003.png` | — (captura/recurso no versionado) |
| 67 | `thumbs/11004.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11004.png` | — (captura/recurso no versionado) |
| 67 | `thumbs/11100.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11100.png` | — (captura/recurso no versionado) |
| 67 | `thumbs/11101.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11101.png` | — (captura/recurso no versionado) |
| 68 | `thumbs/11200.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11200.png` | — (captura/recurso no versionado) |
| 68 | `thumbs/11201.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11201.png` | — (captura/recurso no versionado) |
| 68 | `thumbs/11202.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11202.png` | — (captura/recurso no versionado) |
| 69 | `thumbs/11203.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11203.png` | — (captura/recurso no versionado) |
| 69 | `thumbs/11300.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11300.png` | — (captura/recurso no versionado) |
| 69 | `thumbs/11400.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11400.png` | — (captura/recurso no versionado) |
| 70 | `thumbs/11401.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11401.png` | — (captura/recurso no versionado) |
| 70 | `thumbs/11410.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11410.png` | — (captura/recurso no versionado) |
| 70 | `thumbs/11500.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11500.png` | — (captura/recurso no versionado) |
| 71 | `thumbs/11501.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11501.png` | — (captura/recurso no versionado) |
| 71 | `thumbs/11600.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11600.png` | — (captura/recurso no versionado) |
| 71 | `thumbs/11601.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11601.png` | — (captura/recurso no versionado) |
| 75 | `version_info.txt` | `DOCS/reverse_engineering/bitmaps/version_info.txt` | — (volcado de datos no versionado) |

### `bitmaps/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 19 | `gallery.html` | `DOCS/reverse_engineering/bitmaps/gallery.html` | — (volcado de datos no versionado) |
| 21 | `contactsheet.png` | `DOCS/reverse_engineering/bitmaps/contactsheet.png` | — (captura/recurso no versionado) |
| 27 | `version_info.txt` | `DOCS/reverse_engineering/bitmaps/version_info.txt` | — (volcado de datos no versionado) |
| 77 | `../_tools/extract_bitmaps.py` | `DOCS/reverse_engineering/_tools/extract_bitmaps.py` | — (script de verificación no versionado) |

### `classes/CLASSES.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 3 | `tools/make_classes_md.py` | `DOCS/reverse_engineering/classes/tools/make_classes_md.py` | — (script de verificación no versionado) |

### `classes/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 13 | `class_graph.png` | `DOCS/reverse_engineering/classes/class_graph.png` | — (captura/recurso no versionado) |
| 19 | `class_graph.png` | `DOCS/reverse_engineering/classes/class_graph.png` | — (captura/recurso no versionado) |
| 20 | `class_graph.dot` | `DOCS/reverse_engineering/classes/class_graph.dot` | — (volcado de datos no versionado) |
| 20 | `class_graph.mmd` | `DOCS/reverse_engineering/classes/class_graph.mmd` | — (volcado de datos no versionado) |
| 28 | `functions` | `DOCS/reverse_engineering/classes/functions` | — (carpeta no versionada) |
| 31 | `tools` | `DOCS/reverse_engineering/classes/tools` | — (carpeta no versionada) |
| 47 | `tools/verify_classes.py` | `DOCS/reverse_engineering/classes/tools/verify_classes.py` | — (script de verificación no versionado) |
| 200 | `../NeuronVS_resolved/` | `DOCS/reverse_engineering/NeuronVS_resolved` | `../resolved` |
| 207 | `../NeuronVS_resolved/` | `DOCS/reverse_engineering/NeuronVS_resolved` | `../resolved` |
| 209 | `../NeuronVS_resolved/README.md` | `DOCS/reverse_engineering/NeuronVS_resolved/README.md` | `../resolved/README.md` |
| 270 | `../NeuronVS_resolved/` | `DOCS/reverse_engineering/NeuronVS_resolved` | `../resolved` |
| 271 | `../NeuronVS_vst2/` | `DOCS/reverse_engineering/NeuronVS_vst2` | `../vst2` |

### `dsp/CONSTANT_TYPES.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 28 | `tools/sweep_constant_types.py` | `DOCS/reverse_engineering/dsp/tools/sweep_constant_types.py` | — (script de verificación no versionado) |

### `dsp/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 7 | `tools` | `DOCS/reverse_engineering/dsp/tools` | — (carpeta no versionada) |
| 17 | `tools/dump_constants.py` | `DOCS/reverse_engineering/dsp/tools/dump_constants.py` | — (script de verificación no versionado) |
| 18 | `tools/sweep_constant_types.py` | `DOCS/reverse_engineering/dsp/tools/sweep_constant_types.py` | — (script de verificación no versionado) |
| 19 | `../_tools/pe_read.py` | `DOCS/reverse_engineering/_tools/pe_read.py` | — (script de verificación no versionado) |
| 20 | `../_tools/call_graph.py` | `DOCS/reverse_engineering/_tools/call_graph.py` | — (script de verificación no versionado) |
| 21 | `tools/verify_dsp.py` | `DOCS/reverse_engineering/dsp/tools/verify_dsp.py` | — (script de verificación no versionado) |
| 22 | `tools/verify_zones.py` | `DOCS/reverse_engineering/dsp/tools/verify_zones.py` | — (script de verificación no versionado) |
| 65 | `../NeuronVS_port/include/neuron/neurondb.hpp` | `DOCS/reverse_engineering/NeuronVS_port/include/neuron/neurondb.hpp` | — (fichero no versionado) |
| 135 | `../NeuronVS_neurondb/sound_schema.csv` | `DOCS/reverse_engineering/NeuronVS_neurondb/sound_schema.csv` | `../neurondb/sound_schema.csv` |
| 234 | `../NeuronVS_vst2/README.md#midi` | `DOCS/reverse_engineering/NeuronVS_vst2/README.md` | `../vst2/README.md` |
| 262 | `../NeuronVS_port/golden/` | `DOCS/reverse_engineering/NeuronVS_port/golden` | — (carpeta no versionada) |

### `dsp/STATE_SPLIT.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 5 | `tools/verify_dsp.py` | `DOCS/reverse_engineering/dsp/tools/verify_dsp.py` | — (script de verificación no versionado) |

### `dsp/ZONES.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 6 | `tools/verify_zones.py` | `DOCS/reverse_engineering/dsp/tools/verify_zones.py` | — (script de verificación no versionado) |

### `filmstrip/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 7 | `11601.gif` | `DOCS/reverse_engineering/filmstrip/11601.gif` | — (captura/recurso no versionado) |
| 8 | `11601_4x.gif` | `DOCS/reverse_engineering/filmstrip/11601_4x.gif` | — (captura/recurso no versionado) |
| 9 | `frames/` | `DOCS/reverse_engineering/filmstrip/frames` | — (carpeta no versionada) |
| 10 | `contactsheet.png` | `DOCS/reverse_engineering/filmstrip/contactsheet.png` | — (captura/recurso no versionado) |
| 11 | `gif_samples.png` | `DOCS/reverse_engineering/filmstrip/gif_samples.png` | — (captura/recurso no versionado) |
| 13 | `preview.html` | `DOCS/reverse_engineering/filmstrip/preview.html` | — (volcado de datos no versionado) |
| 42 | `hdc` | `DOCS/reverse_engineering/filmstrip/hdc` | — (carpeta no versionada) |
| 43 | `../NeuronVS_layout/streams.csv` | `DOCS/reverse_engineering/NeuronVS_layout/streams.csv` | `../layout/streams.csv` |

### `layout/KNOB_PARAM_LINK.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 5 | `../NeuronVS_preset_format/PARAM_RECORD.md` | `DOCS/reverse_engineering/NeuronVS_preset_format/PARAM_RECORD.md` | `../preset_format/PARAM_RECORD.md` |
| 58 | `../NeuronVS_preset_format/preset_schema.csv` | `DOCS/reverse_engineering/NeuronVS_preset_format/preset_schema.csv` | `../preset_format/preset_schema.csv` |

### `layout/OBSERVER_PASSES.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 11 | `../_obs_dump` | `DOCS/reverse_engineering/_obs_dump` | — (carpeta no versionada) |
| 12 | `tools/verify_observers.py` | `DOCS/reverse_engineering/layout/tools/verify_observers.py` | `../observers/tools/verify_observers.py` |

### `layout/PAINT_PIPELINE.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 18 | `tools/verify_paint.py` | `DOCS/reverse_engineering/layout/tools/verify_paint.py` | — (script de verificación no versionado) |
| 527 | `tools/verify_paint.py` | `DOCS/reverse_engineering/layout/tools/verify_paint.py` | — (script de verificación no versionado) |

### `layout/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 71 | `tools/resolve_page_refs.py` | `DOCS/reverse_engineering/layout/tools/resolve_page_refs.py` | — (script de verificación no versionado) |
| 336 | `fixtures` | `DOCS/reverse_engineering/layout/fixtures` | — (carpeta no versionada) |
| 340 | `tools` | `DOCS/reverse_engineering/layout/tools` | — (carpeta no versionada) |

### `neurondb/NEURON80GB_OS15_README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 10 | `models/models.csv` | `DOCS/reverse_engineering/neurondb/models/models.csv` | `models.csv` |
| 11 | `tools/tib_models.py` | `DOCS/reverse_engineering/neurondb/tools/tib_models.py` | — (script de verificación no versionado) |
| 12 | `tools/verify_tib_models.py` | `DOCS/reverse_engineering/neurondb/tools/verify_tib_models.py` | — (script de verificación no versionado) |
| 13 | `tools/compare_installed.py` | `DOCS/reverse_engineering/neurondb/tools/compare_installed.py` | — (script de verificación no versionado) |
| 14 | `cmp_installed.log` | `DOCS/reverse_engineering/neurondb/cmp_installed.log` | — (volcado de datos no versionado) |
| 16 | `../NeuronVS_neurondb/SCAPE_SPHERE.md` | `DOCS/reverse_engineering/NeuronVS_neurondb/SCAPE_SPHERE.md` | `SCAPE_SPHERE.md` |
| 97 | `../NeuronVS_neurondb/SCAPE_SPHERE.md` | `DOCS/reverse_engineering/NeuronVS_neurondb/SCAPE_SPHERE.md` | `SCAPE_SPHERE.md` |
| 97 | `../NeuronVS_neurondb/SYNTH_FRAMES.md` | `DOCS/reverse_engineering/NeuronVS_neurondb/SYNTH_FRAMES.md` | `SYNTH_FRAMES.md` |
| 142 | `tools/brain_mapper_names.py` | `DOCS/reverse_engineering/neurondb/tools/brain_mapper_names.py` | — (script de verificación no versionado) |

### `neurondb/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 14 | `tools/model_binary.py` | `DOCS/reverse_engineering/neurondb/tools/model_binary.py` | — (script de verificación no versionado) |
| 15 | `tools/verify_model_binary.py` | `DOCS/reverse_engineering/neurondb/tools/verify_model_binary.py` | — (script de verificación no versionado) |
| 16 | `tools/synth_frames.py` | `DOCS/reverse_engineering/neurondb/tools/synth_frames.py` | — (script de verificación no versionado) |
| 17 | `tools/verify_synth_frames.py` | `DOCS/reverse_engineering/neurondb/tools/verify_synth_frames.py` | — (script de verificación no versionado) |
| 20 | `tools/compare_neurondb.py` | `DOCS/reverse_engineering/neurondb/tools/compare_neurondb.py` | — (script de verificación no versionado) |
| 21 | `tools/verify_compare_neurondb.py` | `DOCS/reverse_engineering/neurondb/tools/verify_compare_neurondb.py` | — (script de verificación no versionado) |
| 118 | `../NeuronVS_preset_format/tools/preset.py` | `DOCS/reverse_engineering/NeuronVS_preset_format/tools/preset.py` | — (script de verificación no versionado) |
| 213 | `diff_html_demo.png` | `DOCS/reverse_engineering/neurondb/diff_html_demo.png` | — (captura/recurso no versionado) |
| 294 | `../NeuronVS_preset_format/preset_schema.csv` | `DOCS/reverse_engineering/NeuronVS_preset_format/preset_schema.csv` | `../preset_format/preset_schema.csv` |
| 361 | `../NeuronVS_preset_format/README.md` | `DOCS/reverse_engineering/NeuronVS_preset_format/README.md` | `../preset_format/README.md` |
| 363 | `../NeuronVS_preset_format/README.md` | `DOCS/reverse_engineering/NeuronVS_preset_format/README.md` | `../preset_format/README.md` |
| 366 | `../NeuronVS_preset_format/PARAM_RECORD.md` | `DOCS/reverse_engineering/NeuronVS_preset_format/PARAM_RECORD.md` | `../preset_format/PARAM_RECORD.md` |

### `neurondb/SCAPE_SPHERE.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 61 | `../NeuronVS_dsp/ZONES.md` | `DOCS/reverse_engineering/NeuronVS_dsp/ZONES.md` | `../dsp/ZONES.md` |

### `neurondb/SYNTH_FRAMES.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 17 | `wav/body_frame00.wav` | `DOCS/reverse_engineering/neurondb/wav/body_frame00.wav` | — (volcado de datos no versionado) |
| 18 | `wav/body_frame32.wav` | `DOCS/reverse_engineering/neurondb/wav/body_frame32.wav` | — (volcado de datos no versionado) |
| 19 | `wav/scape_curva.wav` | `DOCS/reverse_engineering/neurondb/wav/scape_curva.wav` | — (volcado de datos no versionado) |

### `observers/OBSERVER_CALLBACKS.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 5 | `../NeuronVS_preset_format/OBSERVER_CALLBACK.md` | `DOCS/reverse_engineering/NeuronVS_preset_format/OBSERVER_CALLBACK.md` | `../preset_format/OBSERVER_CALLBACK.md` |
| 165 | `matrix_runtime.log` | `DOCS/reverse_engineering/observers/matrix_runtime.log` | — (volcado de datos no versionado) |
| 235 | `matrix_runtime.log` | `DOCS/reverse_engineering/observers/matrix_runtime.log` | — (volcado de datos no versionado) |

### `observers/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 29 | `params_observers_map.csv` | `DOCS/reverse_engineering/observers/params_observers_map.csv` | `../dsp/params_observers_map.csv` |
| 38 | `matrix_runtime.log` | `DOCS/reverse_engineering/observers/matrix_runtime.log` | — (volcado de datos no versionado) |
| 119 | `matrix_runtime.log` | `DOCS/reverse_engineering/observers/matrix_runtime.log` | — (volcado de datos no versionado) |
| 140 | `../NeuronVS_neurondb/sound_schema.csv` | `DOCS/reverse_engineering/NeuronVS_neurondb/sound_schema.csv` | `../neurondb/sound_schema.csv` |

### `port/PLAN.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 17 | `../NeuronVS_vst2/README.md` | `DOCS/reverse_engineering/NeuronVS_vst2/README.md` | `../vst2/README.md` |
| 159 | `../NeuronVS_layout` | `DOCS/reverse_engineering/NeuronVS_layout` | `../layout` |
| 160 | `../NeuronVS_bitmaps` | `DOCS/reverse_engineering/NeuronVS_bitmaps` | `../bitmaps` |

### `port/PLAN_JUCE9.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 144 | `../NeuronVS_dsp/` | `DOCS/reverse_engineering/NeuronVS_dsp` | `../dsp` |

### `port/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 17 | `docs/TRANSLATOR.md` | `DOCS/reverse_engineering/port/docs/TRANSLATOR.md` | `TRANSLATOR.md` |
| 20 | `../NeuronVS_dsp/ZONES.md` | `DOCS/reverse_engineering/NeuronVS_dsp/ZONES.md` | `../dsp/ZONES.md` |

### `port/TRANSLATOR.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 5 | `../src/translator.cpp` | `DOCS/reverse_engineering/src/translator.cpp` | — (fichero no versionado) |
| 8 | `../../NeuronVS_dsp/STATE_SPLIT.md` | `DOCS/NeuronVS_dsp/STATE_SPLIT.md` | `../dsp/STATE_SPLIT.md` |
| 129 | `../../NeuronVS_dsp/CONSTANT_TYPES.md` | `DOCS/NeuronVS_dsp/CONSTANT_TYPES.md` | `../dsp/CONSTANT_TYPES.md` |
| 183 | `../../NeuronVS_dsp/ZONES.md` | `DOCS/NeuronVS_dsp/ZONES.md` | `../dsp/ZONES.md` |
| 260 | `../src/translator_hooks.cpp` | `DOCS/reverse_engineering/src/translator_hooks.cpp` | — (fichero no versionado) |
| 275 | `../../NeuronVS_neurondb/SCAPE_SPHERE.md` | `DOCS/NeuronVS_neurondb/SCAPE_SPHERE.md` | `../neurondb/SCAPE_SPHERE.md` |

### `preset_format/OBSERVER_CALLBACK.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 7 | `../NeuronVS_decompiled/functions/10013620_callback_10013620.c` | `DOCS/reverse_engineering/NeuronVS_decompiled/functions/10013620_callback_10013620.c` | — (fichero no versionado) |
| 90 | `../NeuronVS_dsp/ZONES.md` | `DOCS/reverse_engineering/NeuronVS_dsp/ZONES.md` | `../dsp/ZONES.md` |

### `preset_format/PARAM_RECORD.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 5 | `../NeuronVS_classes/README.md` | `DOCS/reverse_engineering/NeuronVS_classes/README.md` | `../classes/README.md` |
| 9 | `../NeuronVS_layout/KNOB_PARAM_LINK.md` | `DOCS/reverse_engineering/NeuronVS_layout/KNOB_PARAM_LINK.md` | `../layout/KNOB_PARAM_LINK.md` |
| 300 | `../NeuronVS_dsp/tools/verify_dsp.py` | `DOCS/reverse_engineering/NeuronVS_dsp/tools/verify_dsp.py` | — (script de verificación no versionado) |

### `preset_format/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 5 | `../NeuronVS_neurondb/README.md` | `DOCS/reverse_engineering/NeuronVS_neurondb/README.md` | `../neurondb/README.md` |
| 12 | `tools/build_schema.py` | `DOCS/reverse_engineering/preset_format/tools/build_schema.py` | — (script de verificación no versionado) |
| 13 | `tools/preset.py` | `DOCS/reverse_engineering/preset_format/tools/preset.py` | — (script de verificación no versionado) |
| 14 | `tools/verify_preset.py` | `DOCS/reverse_engineering/preset_format/tools/verify_preset.py` | — (script de verificación no versionado) |

### `resolved/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 10 | `../NeuronVS_classes/` | `DOCS/reverse_engineering/NeuronVS_classes` | `../classes` |
| 12 | `../NeuronVS_classes/dtor_chain.csv` | `DOCS/reverse_engineering/NeuronVS_classes/dtor_chain.csv` | `../classes/dtor_chain.csv` |
| 13 | `../NeuronVS_vst2/` | `DOCS/reverse_engineering/NeuronVS_vst2` | `../vst2` |
| 152 | `functions` | `DOCS/reverse_engineering/resolved/functions` | — (carpeta no versionada) |
| 158 | `../NeuronVS_classes/dtor_chain.csv` | `DOCS/reverse_engineering/NeuronVS_classes/dtor_chain.csv` | `../classes/dtor_chain.csv` |
| 161 | `summary.txt` | `DOCS/reverse_engineering/resolved/summary.txt` | — (volcado de datos no versionado) |
| 162 | `tools` | `DOCS/reverse_engineering/resolved/tools` | — (carpeta no versionada) |

### `vst2/README.md`

| Línea | Enlace | Resuelve a | Alternativa |
|---:|---|---|---|
| 130 | `../NeuronVS_classes/CLASSES.md` | `DOCS/reverse_engineering/NeuronVS_classes/CLASSES.md` | `../classes/CLASSES.md` |
| 146 | `../NeuronVS_preset_format/PARAM_RECORD.md` | `DOCS/reverse_engineering/NeuronVS_preset_format/PARAM_RECORD.md` | `../preset_format/PARAM_RECORD.md` |
| 234 | `tools/scan_midi_bridges.py` | `DOCS/reverse_engineering/vst2/tools/scan_midi_bridges.py` | — (script de verificación no versionado) |
| 264 | `_callbacks` | `DOCS/reverse_engineering/vst2/_callbacks` | — (carpeta no versionada) |
| 265 | `tools` | `DOCS/reverse_engineering/vst2/tools` | — (carpeta no versionada) |
| 272 | `../NeuronVS_classes/` | `DOCS/reverse_engineering/NeuronVS_classes` | `../classes` |
| 275 | `../NeuronVS_dsp/` | `DOCS/reverse_engineering/NeuronVS_dsp` | `../dsp` |

---

## Cómo se comprobó / cómo se regenera

Un enlace es «roto» si su ruta, resuelta contra la carpeta del documento e ignorando el
fragmento `#…`, no existe en disco. La alternativa se busca en este orden: quitar el prefijo
`NeuronVS_` de cada segmento; mapear `Neuron80GB-OS15` a `neurondb`; el mismo nombre de fichero
en la carpeta del documento; y, si el nombre es único en el árbol, la ruta que lo encuentra.

El escaneo es mecánico y se puede repetir: cualquier enlace que se arregle en el futuro
desaparece de este inventario, y cualquier enlace nuevo roto aparece con su línea.
