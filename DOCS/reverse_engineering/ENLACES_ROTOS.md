# Enlaces relativos rotos — inventario y correcciones

> **Inventario:** 2026-11-08. **Correcciones aplicadas:** 2026-11-09.
> **Alcance:** los 29 documentos de `DOCS/reverse_engineering`.
> **Qué es:** cada enlace relativo que no resolvía a un fichero existente (comprobado con
> `os.path.exists` sobre la ruta resuelta, ignorando el fragmento `#…`) y la alternativa que
> existía en el árbol. El 2026-11-09 **se reescribieron los 67 enlaces con alternativa real**;
> los 155 restantes siguen tal como estaban escritos. Este documento es el registro de los dos
> estados: lo aplicado está en «Correcciones aplicadas» y lo que no llegó a tener destino, en
> «Lo que sigue roto».
> Los números de línea son los del árbol actual; los del inventario original quedaron
> desplazados al añadir la nota de cabecera en cada documento.

## Resumen

**222 enlaces rotos** en **29 documentos** (2026-11-08): **67 corregidos** el 2026-11-09 y
**155 siguen rotos**.

### Por causa

| Causa | Rotos 2026-11-08 | Siguen rotos |
|---|---:|---:|
| `imagen` | 93 | 93 |
| `prefijo` | 58 | 6 |
| `script` | 31 | 29 |
| `volcado` | 15 | 8 |
| `carpeta` | 13 | 12 |
| `fichero` | 6 | 7 |
| `basename` | 6 | 0 |
| **Total** | **222** | **155** |

La clasificación se rehizo sobre los 155 que quedan, así que la causa de un enlace no siempre
coincide con la del inventario original: se clasifica el destino tal como está escrito hoy (por
eso `prefijo` baja de 58 a 6 y `fichero` sube de 6 a 7). Lo corregido no entra en esta tabla —
está por documento, y por regla aplicada, en las dos secciones siguientes.

### Por documento

| Documento | Rotos 2026-11-08 | Corregidos | Siguen rotos |
|---|---:|---:|---:|
| [`README.md`](README.md) | 21 | 19 | 2 |
| [`bitmaps/GALERIA.md`](bitmaps/GALERIA.md) | 86 | 0 | 86 |
| [`bitmaps/README.md`](bitmaps/README.md) | 4 | 0 | 4 |
| [`classes/CLASSES.md`](classes/CLASSES.md) | 1 | 0 | 1 |
| [`classes/README.md`](classes/README.md) | 12 | 5 | 7 |
| [`dsp/CONSTANT_TYPES.md`](dsp/CONSTANT_TYPES.md) | 1 | 0 | 1 |
| [`dsp/README.md`](dsp/README.md) | 11 | 2 | 9 |
| [`dsp/STATE_SPLIT.md`](dsp/STATE_SPLIT.md) | 1 | 0 | 1 |
| [`dsp/ZONES.md`](dsp/ZONES.md) | 1 | 0 | 1 |
| [`filmstrip/README.md`](filmstrip/README.md) | 8 | 1 | 7 |
| [`layout/KNOB_PARAM_LINK.md`](layout/KNOB_PARAM_LINK.md) | 2 | 2 | 0 |
| [`layout/OBSERVER_PASSES.md`](layout/OBSERVER_PASSES.md) | 2 | 1 | 1 |
| [`layout/PAINT_PIPELINE.md`](layout/PAINT_PIPELINE.md) | 2 | 0 | 2 |
| [`layout/README.md`](layout/README.md) | 3 | 0 | 3 |
| [`neurondb/NEURON80GB_OS15_README.md`](neurondb/NEURON80GB_OS15_README.md) | 9 | 4 | 5 |
| [`neurondb/README.md`](neurondb/README.md) | 12 | 4 | 8 |
| [`neurondb/SCAPE_SPHERE.md`](neurondb/SCAPE_SPHERE.md) | 1 | 1 | 0 |
| [`neurondb/SYNTH_FRAMES.md`](neurondb/SYNTH_FRAMES.md) | 3 | 0 | 3 |
| [`observers/OBSERVER_CALLBACKS.md`](observers/OBSERVER_CALLBACKS.md) | 3 | 1 | 2 |
| [`observers/README.md`](observers/README.md) | 4 | 2 | 2 |
| [`port/PLAN.md`](port/PLAN.md) | 3 | 3 | 0 |
| [`port/PLAN_JUCE9.md`](port/PLAN_JUCE9.md) | 1 | 1 | 0 |
| [`port/README.md`](port/README.md) | 2 | 2 | 0 |
| [`port/TRANSLATOR.md`](port/TRANSLATOR.md) | 6 | 6 | 0 |
| [`preset_format/OBSERVER_CALLBACK.md`](preset_format/OBSERVER_CALLBACK.md) | 2 | 2 | 0 |
| [`preset_format/PARAM_RECORD.md`](preset_format/PARAM_RECORD.md) | 3 | 2 | 1 |
| [`preset_format/README.md`](preset_format/README.md) | 4 | 1 | 3 |
| [`resolved/README.md`](resolved/README.md) | 7 | 4 | 3 |
| [`vst2/README.md`](vst2/README.md) | 7 | 4 | 3 |
| **Total** | **222** | **67** | **155** |

## Qué regla se aplicó a cada corrección

Sólo se reescribió un enlace cuando la alternativa **existía en el árbol**; nunca se inventó
una ruta ni se cambió el texto visible del enlace, sólo el destino. Las reglas, por número de
enlaces:

| Regla | Enlaces | Ejemplo |
|---|---:|---|
| Quitar el prefijo `NeuronVS_` de cada segmento | 59 | `NeuronVS_dsp/ZONES.md` → `dsp/ZONES.md` |
| Mapear `Neuron80GB-OS15` a `neurondb` | 1 | `Neuron80GB-OS15/README.md` → `neurondb/NEURON80GB_OS15_README.md` |
| Quitar el `docs/` sobrante | 1 | `docs/TRANSLATOR.md` → `TRANSLATOR.md` |
| Quitar el `models/` sobrante | 1 | `models/models.csv` → `models.csv` |
| Nombre suelto que vive en otra carpeta | 2 | `params_observers_map.csv` → `../dsp/params_observers_map.csv` |
| Enlace al port moderno que vive en `Source/DSP/` | 2 | `../src/translator.cpp` → `../../../Source/DSP/Translator.cpp` |
| Desensamblado de la misma función cuando falta el `.c` | 1 | `../NeuronVS_decompiled/functions/…c` → `../observers/functions/10013620_ModelIndexChange.asm` |
| **Total** | **67** | |

Los fragmentos `#…` se conservaron: `../NeuronVS_vst2/README.md#midi` quedó como
`../vst2/README.md#midi` (y `vst2/README.md` tiene una sección `## MIDI`, así que el ancla
existe). Cuando la alternativa era una carpeta se escribió sin barra final
(`../NeuronVS_resolved/` → `../resolved`), que es como aparecen las demás carpetas enlazadas.

## Correcciones aplicadas (2026-11-09)

Una fila por enlace reescrito, con la línea que ocupa hoy en el documento.

### `README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 23 | `NeuronVS_classes/README.md` | `classes/README.md` |
| 24 | `NeuronVS_resolved/README.md` | `resolved/README.md` |
| 25 | `NeuronVS_dsp/README.md` | `dsp/README.md` |
| 26 | `NeuronVS_preset_format/README.md` | `preset_format/README.md` |
| 28 | `NeuronVS_layout/README.md` | `layout/README.md` |
| 29 | `NeuronVS_bitmaps/README.md` | `bitmaps/README.md` |
| 30 | `NeuronVS_filmstrip/README.md` | `filmstrip/README.md` |
| 31 | `NeuronVS_neurondb/README.md` | `neurondb/README.md` |
| 32 | `NeuronVS_vst2/README.md` | `vst2/README.md` |
| 34 | `NeuronVS_port/README.md` | `port/README.md` |
| 35 | `Neuron80GB-OS15/README.md` | `neurondb/NEURON80GB_OS15_README.md` |
| 47 | `NeuronVS_dsp/README.md` | `dsp/README.md` |
| 61 | `NeuronVS_dsp/STATE_SPLIT.md` | `dsp/STATE_SPLIT.md` |
| 62 | `NeuronVS_preset_format/PARAM_RECORD.md` | `preset_format/PARAM_RECORD.md` |
| 72 | `NeuronVS_dsp/CONSTANT_TYPES.md` | `dsp/CONSTANT_TYPES.md` |
| 81 | `NeuronVS_preset_format/README.md` | `preset_format/README.md` |
| 90 | `NeuronVS_preset_format/OBSERVER_CALLBACK.md` | `preset_format/OBSERVER_CALLBACK.md` |
| 101 | `NeuronVS_dsp/ZONES.md` | `dsp/ZONES.md` |
| 110 | `NeuronVS_vst2/README.md#midi` | `vst2/README.md#midi` |

### `classes/README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 207 | `../NeuronVS_resolved/` | `../resolved` |
| 214 | `../NeuronVS_resolved/` | `../resolved` |
| 216 | `../NeuronVS_resolved/README.md` | `../resolved/README.md` |
| 277 | `../NeuronVS_resolved/` | `../resolved` |
| 278 | `../NeuronVS_vst2/` | `../vst2` |

### `dsp/README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 142 | `../NeuronVS_neurondb/sound_schema.csv` | `../neurondb/sound_schema.csv` |
| 241 | `../NeuronVS_vst2/README.md#midi` | `../vst2/README.md#midi` |

### `filmstrip/README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 50 | `../NeuronVS_layout/streams.csv` | `../layout/streams.csv` |

### `layout/KNOB_PARAM_LINK.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 10 | `../NeuronVS_preset_format/PARAM_RECORD.md` | `../preset_format/PARAM_RECORD.md` |
| 63 | `../NeuronVS_preset_format/preset_schema.csv` | `../preset_format/preset_schema.csv` |

### `layout/OBSERVER_PASSES.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 18 | `tools/verify_observers.py` | `../observers/tools/verify_observers.py` |

### `neurondb/NEURON80GB_OS15_README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 17 | `models/models.csv` | `models.csv` |
| 23 | `../NeuronVS_neurondb/SCAPE_SPHERE.md` | `SCAPE_SPHERE.md` |
| 104 | `../NeuronVS_neurondb/SCAPE_SPHERE.md` | `SCAPE_SPHERE.md` |
| 104 | `../NeuronVS_neurondb/SYNTH_FRAMES.md` | `SYNTH_FRAMES.md` |

### `neurondb/README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 301 | `../NeuronVS_preset_format/preset_schema.csv` | `../preset_format/preset_schema.csv` |
| 368 | `../NeuronVS_preset_format/README.md` | `../preset_format/README.md` |
| 370 | `../NeuronVS_preset_format/README.md` | `../preset_format/README.md` |
| 373 | `../NeuronVS_preset_format/PARAM_RECORD.md` | `../preset_format/PARAM_RECORD.md` |

### `neurondb/SCAPE_SPHERE.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 66 | `../NeuronVS_dsp/ZONES.md` | `../dsp/ZONES.md` |

### `observers/OBSERVER_CALLBACKS.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 11 | `../NeuronVS_preset_format/OBSERVER_CALLBACK.md` | `../preset_format/OBSERVER_CALLBACK.md` |

### `observers/README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 36 | `params_observers_map.csv` | `../dsp/params_observers_map.csv` |
| 147 | `../NeuronVS_neurondb/sound_schema.csv` | `../neurondb/sound_schema.csv` |

### `port/PLAN.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 22 | `../NeuronVS_vst2/README.md` | `../vst2/README.md` |
| 164 | `../NeuronVS_layout` | `../layout` |
| 165 | `../NeuronVS_bitmaps` | `../bitmaps` |

### `port/PLAN_JUCE9.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 149 | `../NeuronVS_dsp/` | `../dsp` |

### `port/README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 23 | `docs/TRANSLATOR.md` | `TRANSLATOR.md` |
| 26 | `../NeuronVS_dsp/ZONES.md` | `../dsp/ZONES.md` |

### `port/TRANSLATOR.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 14 | `../../NeuronVS_dsp/STATE_SPLIT.md` | `../dsp/STATE_SPLIT.md` |
| 135 | `../../NeuronVS_dsp/CONSTANT_TYPES.md` | `../dsp/CONSTANT_TYPES.md` |
| 189 | `../../NeuronVS_dsp/ZONES.md` | `../dsp/ZONES.md` |
| 281 | `../../NeuronVS_neurondb/SCAPE_SPHERE.md` | `../neurondb/SCAPE_SPHERE.md` |
| 11 | `../src/translator.cpp` | `../../../Source/DSP/Translator.cpp` |
| 266 | `../src/translator_hooks.cpp` | `../../../Source/DSP/TranslatorHooks.cpp` |

### `preset_format/OBSERVER_CALLBACK.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 96 | `../NeuronVS_dsp/ZONES.md` | `../dsp/ZONES.md` |

### `preset_format/PARAM_RECORD.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 12 | `../NeuronVS_classes/README.md` | `../classes/README.md` |
| 16 | `../NeuronVS_layout/KNOB_PARAM_LINK.md` | `../layout/KNOB_PARAM_LINK.md` |

### `preset_format/README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 11 | `../NeuronVS_neurondb/README.md` | `../neurondb/README.md` |

### `resolved/README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 17 | `../NeuronVS_classes/` | `../classes` |
| 19 | `../NeuronVS_classes/dtor_chain.csv` | `../classes/dtor_chain.csv` |
| 20 | `../NeuronVS_vst2/` | `../vst2` |
| 165 | `../NeuronVS_classes/dtor_chain.csv` | `../classes/dtor_chain.csv` |

### `vst2/README.md`

| Línea | Antes | Ahora |
|---:|---|---|
| 137 | `../NeuronVS_classes/CLASSES.md` | `../classes/CLASSES.md` |
| 153 | `../NeuronVS_preset_format/PARAM_RECORD.md` | `../preset_format/PARAM_RECORD.md` |
| 279 | `../NeuronVS_classes/` | `../classes` |
| 282 | `../NeuronVS_dsp/` | `../dsp` |

## Lo que sigue roto

Nada de esto tiene destino en el repositorio, así que el enlace se deja escrito como estaba:
reescribirlo sería inventar una ruta. Son las capturas y recursos gráficos (`png/`, `thumbs/`,
`contactsheet.png`, `class_graph.*`, `*.gif`, `wav/`), los volcados (`matrix_runtime.log`,
`*.csv` de salida, `cmp_installed.log`), los scripts de verificación (`tools/*.py`) y las
carpetas citadas por su nombre suelto (`functions`, `tools`, `fixtures`, `_callbacks`).
La alternativa sigue siendo la misma que antes: regenerarlos con el procedimiento que describe
cada documento, o asumir que la afirmación no es comprobable desde el repositorio.

Dos carpetas citadas no existen ni con prefijo ni sin él: `NeuronVS_decompiled/` (1.024
funciones descompuestas) y `NeuronVS_compare_presets/`; de la primera sobrevive
`observers/functions/` con los callbacks recuperados.

### `README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 22 | `NeuronVS_decompiled/README.md` | `DOCS/reverse_engineering/NeuronVS_decompiled/README.md` | ruta con prefijo `NeuronVS_`/`Neuron80GB` y sin destino tras quitarlo |
| 33 | `NeuronVS_compare_presets/README.md` | `DOCS/reverse_engineering/NeuronVS_compare_presets/README.md` | ruta con prefijo `NeuronVS_`/`Neuron80GB` y sin destino tras quitarlo |

### `bitmaps/GALERIA.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 11 | `contactsheet.png` | `DOCS/reverse_engineering/bitmaps/contactsheet.png` | captura o recurso gráfico que no se versionó |
| 17 | `png/10000.png` | `DOCS/reverse_engineering/bitmaps/png/10000.png` | captura o recurso gráfico que no se versionó |
| 18 | `png/10001.png` | `DOCS/reverse_engineering/bitmaps/png/10001.png` | captura o recurso gráfico que no se versionó |
| 19 | `png/10002.png` | `DOCS/reverse_engineering/bitmaps/png/10002.png` | captura o recurso gráfico que no se versionó |
| 20 | `png/10003.png` | `DOCS/reverse_engineering/bitmaps/png/10003.png` | captura o recurso gráfico que no se versionó |
| 21 | `png/10100.png` | `DOCS/reverse_engineering/bitmaps/png/10100.png` | captura o recurso gráfico que no se versionó |
| 22 | `png/10101.png` | `DOCS/reverse_engineering/bitmaps/png/10101.png` | captura o recurso gráfico que no se versionó |
| 23 | `png/10102.png` | `DOCS/reverse_engineering/bitmaps/png/10102.png` | captura o recurso gráfico que no se versionó |
| 24 | `png/10110.png` | `DOCS/reverse_engineering/bitmaps/png/10110.png` | captura o recurso gráfico que no se versionó |
| 25 | `png/10120.png` | `DOCS/reverse_engineering/bitmaps/png/10120.png` | captura o recurso gráfico que no se versionó |
| 26 | `png/10121.png` | `DOCS/reverse_engineering/bitmaps/png/10121.png` | captura o recurso gráfico que no se versionó |
| 27 | `png/10130.png` | `DOCS/reverse_engineering/bitmaps/png/10130.png` | captura o recurso gráfico que no se versionó |
| 28 | `png/10140.png` | `DOCS/reverse_engineering/bitmaps/png/10140.png` | captura o recurso gráfico que no se versionó |
| 29 | `png/10200.png` | `DOCS/reverse_engineering/bitmaps/png/10200.png` | captura o recurso gráfico que no se versionó |
| 30 | `png/10210.png` | `DOCS/reverse_engineering/bitmaps/png/10210.png` | captura o recurso gráfico que no se versionó |
| 31 | `png/10220.png` | `DOCS/reverse_engineering/bitmaps/png/10220.png` | captura o recurso gráfico que no se versionó |
| 32 | `png/10221.png` | `DOCS/reverse_engineering/bitmaps/png/10221.png` | captura o recurso gráfico que no se versionó |
| 33 | `png/10230.png` | `DOCS/reverse_engineering/bitmaps/png/10230.png` | captura o recurso gráfico que no se versionó |
| 34 | `png/10231.png` | `DOCS/reverse_engineering/bitmaps/png/10231.png` | captura o recurso gráfico que no se versionó |
| 35 | `png/10240.png` | `DOCS/reverse_engineering/bitmaps/png/10240.png` | captura o recurso gráfico que no se versionó |
| 36 | `png/10241.png` | `DOCS/reverse_engineering/bitmaps/png/10241.png` | captura o recurso gráfico que no se versionó |
| 37 | `png/10300.png` | `DOCS/reverse_engineering/bitmaps/png/10300.png` | captura o recurso gráfico que no se versionó |
| 38 | `png/10301.png` | `DOCS/reverse_engineering/bitmaps/png/10301.png` | captura o recurso gráfico que no se versionó |
| 39 | `png/10302.png` | `DOCS/reverse_engineering/bitmaps/png/10302.png` | captura o recurso gráfico que no se versionó |
| 40 | `png/11000.png` | `DOCS/reverse_engineering/bitmaps/png/11000.png` | captura o recurso gráfico que no se versionó |
| 41 | `png/11001.png` | `DOCS/reverse_engineering/bitmaps/png/11001.png` | captura o recurso gráfico que no se versionó |
| 42 | `png/11002.png` | `DOCS/reverse_engineering/bitmaps/png/11002.png` | captura o recurso gráfico que no se versionó |
| 43 | `png/11003.png` | `DOCS/reverse_engineering/bitmaps/png/11003.png` | captura o recurso gráfico que no se versionó |
| 44 | `png/11004.png` | `DOCS/reverse_engineering/bitmaps/png/11004.png` | captura o recurso gráfico que no se versionó |
| 45 | `png/11100.png` | `DOCS/reverse_engineering/bitmaps/png/11100.png` | captura o recurso gráfico que no se versionó |
| 46 | `png/11101.png` | `DOCS/reverse_engineering/bitmaps/png/11101.png` | captura o recurso gráfico que no se versionó |
| 47 | `png/11200.png` | `DOCS/reverse_engineering/bitmaps/png/11200.png` | captura o recurso gráfico que no se versionó |
| 48 | `png/11201.png` | `DOCS/reverse_engineering/bitmaps/png/11201.png` | captura o recurso gráfico que no se versionó |
| 49 | `png/11202.png` | `DOCS/reverse_engineering/bitmaps/png/11202.png` | captura o recurso gráfico que no se versionó |
| 50 | `png/11203.png` | `DOCS/reverse_engineering/bitmaps/png/11203.png` | captura o recurso gráfico que no se versionó |
| 51 | `png/11300.png` | `DOCS/reverse_engineering/bitmaps/png/11300.png` | captura o recurso gráfico que no se versionó |
| 52 | `png/11400.png` | `DOCS/reverse_engineering/bitmaps/png/11400.png` | captura o recurso gráfico que no se versionó |
| 53 | `png/11401.png` | `DOCS/reverse_engineering/bitmaps/png/11401.png` | captura o recurso gráfico que no se versionó |
| 54 | `png/11410.png` | `DOCS/reverse_engineering/bitmaps/png/11410.png` | captura o recurso gráfico que no se versionó |
| 55 | `png/11500.png` | `DOCS/reverse_engineering/bitmaps/png/11500.png` | captura o recurso gráfico que no se versionó |
| 56 | `png/11501.png` | `DOCS/reverse_engineering/bitmaps/png/11501.png` | captura o recurso gráfico que no se versionó |
| 57 | `png/11600.png` | `DOCS/reverse_engineering/bitmaps/png/11600.png` | captura o recurso gráfico que no se versionó |
| 58 | `png/11601.png` | `DOCS/reverse_engineering/bitmaps/png/11601.png` | captura o recurso gráfico que no se versionó |
| 64 | `thumbs/10000.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10000.png` | captura o recurso gráfico que no se versionó |
| 64 | `thumbs/10001.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10001.png` | captura o recurso gráfico que no se versionó |
| 64 | `thumbs/10002.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10002.png` | captura o recurso gráfico que no se versionó |
| 65 | `thumbs/10003.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10003.png` | captura o recurso gráfico que no se versionó |
| 65 | `thumbs/10100.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10100.png` | captura o recurso gráfico que no se versionó |
| 65 | `thumbs/10101.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10101.png` | captura o recurso gráfico que no se versionó |
| 66 | `thumbs/10102.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10102.png` | captura o recurso gráfico que no se versionó |
| 66 | `thumbs/10110.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10110.png` | captura o recurso gráfico que no se versionó |
| 66 | `thumbs/10120.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10120.png` | captura o recurso gráfico que no se versionó |
| 67 | `thumbs/10121.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10121.png` | captura o recurso gráfico que no se versionó |
| 67 | `thumbs/10130.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10130.png` | captura o recurso gráfico que no se versionó |
| 67 | `thumbs/10140.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10140.png` | captura o recurso gráfico que no se versionó |
| 68 | `thumbs/10200.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10200.png` | captura o recurso gráfico que no se versionó |
| 68 | `thumbs/10210.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10210.png` | captura o recurso gráfico que no se versionó |
| 68 | `thumbs/10220.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10220.png` | captura o recurso gráfico que no se versionó |
| 69 | `thumbs/10221.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10221.png` | captura o recurso gráfico que no se versionó |
| 69 | `thumbs/10230.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10230.png` | captura o recurso gráfico que no se versionó |
| 69 | `thumbs/10231.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10231.png` | captura o recurso gráfico que no se versionó |
| 70 | `thumbs/10240.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10240.png` | captura o recurso gráfico que no se versionó |
| 70 | `thumbs/10241.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10241.png` | captura o recurso gráfico que no se versionó |
| 70 | `thumbs/10300.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10300.png` | captura o recurso gráfico que no se versionó |
| 71 | `thumbs/10301.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10301.png` | captura o recurso gráfico que no se versionó |
| 71 | `thumbs/10302.png` | `DOCS/reverse_engineering/bitmaps/thumbs/10302.png` | captura o recurso gráfico que no se versionó |
| 71 | `thumbs/11000.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11000.png` | captura o recurso gráfico que no se versionó |
| 72 | `thumbs/11001.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11001.png` | captura o recurso gráfico que no se versionó |
| 72 | `thumbs/11002.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11002.png` | captura o recurso gráfico que no se versionó |
| 72 | `thumbs/11003.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11003.png` | captura o recurso gráfico que no se versionó |
| 73 | `thumbs/11004.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11004.png` | captura o recurso gráfico que no se versionó |
| 73 | `thumbs/11100.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11100.png` | captura o recurso gráfico que no se versionó |
| 73 | `thumbs/11101.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11101.png` | captura o recurso gráfico que no se versionó |
| 74 | `thumbs/11200.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11200.png` | captura o recurso gráfico que no se versionó |
| 74 | `thumbs/11201.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11201.png` | captura o recurso gráfico que no se versionó |
| 74 | `thumbs/11202.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11202.png` | captura o recurso gráfico que no se versionó |
| 75 | `thumbs/11203.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11203.png` | captura o recurso gráfico que no se versionó |
| 75 | `thumbs/11300.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11300.png` | captura o recurso gráfico que no se versionó |
| 75 | `thumbs/11400.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11400.png` | captura o recurso gráfico que no se versionó |
| 76 | `thumbs/11401.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11401.png` | captura o recurso gráfico que no se versionó |
| 76 | `thumbs/11410.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11410.png` | captura o recurso gráfico que no se versionó |
| 76 | `thumbs/11500.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11500.png` | captura o recurso gráfico que no se versionó |
| 77 | `thumbs/11501.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11501.png` | captura o recurso gráfico que no se versionó |
| 77 | `thumbs/11600.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11600.png` | captura o recurso gráfico que no se versionó |
| 77 | `thumbs/11601.png` | `DOCS/reverse_engineering/bitmaps/thumbs/11601.png` | captura o recurso gráfico que no se versionó |
| 81 | `version_info.txt` | `DOCS/reverse_engineering/bitmaps/version_info.txt` | volcado de datos que no se versionó |

### `bitmaps/README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 25 | `gallery.html` | `DOCS/reverse_engineering/bitmaps/gallery.html` | fichero que no se versionó |
| 27 | `contactsheet.png` | `DOCS/reverse_engineering/bitmaps/contactsheet.png` | captura o recurso gráfico que no se versionó |
| 33 | `version_info.txt` | `DOCS/reverse_engineering/bitmaps/version_info.txt` | volcado de datos que no se versionó |
| 83 | `../_tools/extract_bitmaps.py` | `DOCS/reverse_engineering/_tools/extract_bitmaps.py` | script de verificación que no se versionó |

### `classes/CLASSES.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 9 | `tools/make_classes_md.py` | `DOCS/reverse_engineering/classes/tools/make_classes_md.py` | script de verificación que no se versionó |

### `classes/README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 20 | `class_graph.png` | `DOCS/reverse_engineering/classes/class_graph.png` | captura o recurso gráfico que no se versionó |
| 26 | `class_graph.png` | `DOCS/reverse_engineering/classes/class_graph.png` | captura o recurso gráfico que no se versionó |
| 27 | `class_graph.dot` | `DOCS/reverse_engineering/classes/class_graph.dot` | fichero que no se versionó |
| 27 | `class_graph.mmd` | `DOCS/reverse_engineering/classes/class_graph.mmd` | fichero que no se versionó |
| 35 | `functions` | `DOCS/reverse_engineering/classes/functions` | carpeta que no existe en el árbol |
| 38 | `tools` | `DOCS/reverse_engineering/classes/tools` | carpeta que no existe en el árbol |
| 54 | `tools/verify_classes.py` | `DOCS/reverse_engineering/classes/tools/verify_classes.py` | script de verificación que no se versionó |

### `dsp/CONSTANT_TYPES.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 34 | `tools/sweep_constant_types.py` | `DOCS/reverse_engineering/dsp/tools/sweep_constant_types.py` | script de verificación que no se versionó |

### `dsp/README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 14 | `tools` | `DOCS/reverse_engineering/dsp/tools` | carpeta que no existe en el árbol |
| 24 | `tools/dump_constants.py` | `DOCS/reverse_engineering/dsp/tools/dump_constants.py` | script de verificación que no se versionó |
| 25 | `tools/sweep_constant_types.py` | `DOCS/reverse_engineering/dsp/tools/sweep_constant_types.py` | script de verificación que no se versionó |
| 26 | `../_tools/pe_read.py` | `DOCS/reverse_engineering/_tools/pe_read.py` | script de verificación que no se versionó |
| 27 | `../_tools/call_graph.py` | `DOCS/reverse_engineering/_tools/call_graph.py` | script de verificación que no se versionó |
| 28 | `tools/verify_dsp.py` | `DOCS/reverse_engineering/dsp/tools/verify_dsp.py` | script de verificación que no se versionó |
| 29 | `tools/verify_zones.py` | `DOCS/reverse_engineering/dsp/tools/verify_zones.py` | script de verificación que no se versionó |
| 72 | `../NeuronVS_port/include/neuron/neurondb.hpp` | `DOCS/reverse_engineering/NeuronVS_port/include/neuron/neurondb.hpp` | ruta con prefijo `NeuronVS_`/`Neuron80GB` y sin destino tras quitarlo |
| 269 | `../NeuronVS_port/golden/` | `DOCS/reverse_engineering/NeuronVS_port/golden` | ruta con prefijo `NeuronVS_`/`Neuron80GB` y sin destino tras quitarlo |

### `dsp/STATE_SPLIT.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 11 | `tools/verify_dsp.py` | `DOCS/reverse_engineering/dsp/tools/verify_dsp.py` | script de verificación que no se versionó |

### `dsp/ZONES.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 12 | `tools/verify_zones.py` | `DOCS/reverse_engineering/dsp/tools/verify_zones.py` | script de verificación que no se versionó |

### `filmstrip/README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 14 | `11601.gif` | `DOCS/reverse_engineering/filmstrip/11601.gif` | captura o recurso gráfico que no se versionó |
| 15 | `11601_4x.gif` | `DOCS/reverse_engineering/filmstrip/11601_4x.gif` | captura o recurso gráfico que no se versionó |
| 16 | `frames/` | `DOCS/reverse_engineering/filmstrip/frames` | carpeta que no existe en el árbol |
| 17 | `contactsheet.png` | `DOCS/reverse_engineering/filmstrip/contactsheet.png` | captura o recurso gráfico que no se versionó |
| 18 | `gif_samples.png` | `DOCS/reverse_engineering/filmstrip/gif_samples.png` | captura o recurso gráfico que no se versionó |
| 20 | `preview.html` | `DOCS/reverse_engineering/filmstrip/preview.html` | fichero que no se versionó |
| 49 | `hdc` | `DOCS/reverse_engineering/filmstrip/hdc` | carpeta que no existe en el árbol |

### `layout/OBSERVER_PASSES.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 17 | `../_obs_dump` | `DOCS/reverse_engineering/_obs_dump` | carpeta que no existe en el árbol |

### `layout/PAINT_PIPELINE.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 24 | `tools/verify_paint.py` | `DOCS/reverse_engineering/layout/tools/verify_paint.py` | script de verificación que no se versionó |
| 533 | `tools/verify_paint.py` | `DOCS/reverse_engineering/layout/tools/verify_paint.py` | script de verificación que no se versionó |

### `layout/README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 77 | `tools/resolve_page_refs.py` | `DOCS/reverse_engineering/layout/tools/resolve_page_refs.py` | script de verificación que no se versionó |
| 342 | `fixtures` | `DOCS/reverse_engineering/layout/fixtures` | carpeta que no existe en el árbol |
| 346 | `tools` | `DOCS/reverse_engineering/layout/tools` | carpeta que no existe en el árbol |

### `neurondb/NEURON80GB_OS15_README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 18 | `tools/tib_models.py` | `DOCS/reverse_engineering/neurondb/tools/tib_models.py` | script de verificación que no se versionó |
| 19 | `tools/verify_tib_models.py` | `DOCS/reverse_engineering/neurondb/tools/verify_tib_models.py` | script de verificación que no se versionó |
| 20 | `tools/compare_installed.py` | `DOCS/reverse_engineering/neurondb/tools/compare_installed.py` | script de verificación que no se versionó |
| 21 | `cmp_installed.log` | `DOCS/reverse_engineering/neurondb/cmp_installed.log` | volcado de datos que no se versionó |
| 149 | `tools/brain_mapper_names.py` | `DOCS/reverse_engineering/neurondb/tools/brain_mapper_names.py` | script de verificación que no se versionó |

### `neurondb/README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 21 | `tools/model_binary.py` | `DOCS/reverse_engineering/neurondb/tools/model_binary.py` | script de verificación que no se versionó |
| 22 | `tools/verify_model_binary.py` | `DOCS/reverse_engineering/neurondb/tools/verify_model_binary.py` | script de verificación que no se versionó |
| 23 | `tools/synth_frames.py` | `DOCS/reverse_engineering/neurondb/tools/synth_frames.py` | script de verificación que no se versionó |
| 24 | `tools/verify_synth_frames.py` | `DOCS/reverse_engineering/neurondb/tools/verify_synth_frames.py` | script de verificación que no se versionó |
| 27 | `tools/compare_neurondb.py` | `DOCS/reverse_engineering/neurondb/tools/compare_neurondb.py` | script de verificación que no se versionó |
| 28 | `tools/verify_compare_neurondb.py` | `DOCS/reverse_engineering/neurondb/tools/verify_compare_neurondb.py` | script de verificación que no se versionó |
| 125 | `../NeuronVS_preset_format/tools/preset.py` | `DOCS/reverse_engineering/NeuronVS_preset_format/tools/preset.py` | ruta con prefijo `NeuronVS_`/`Neuron80GB` y sin destino tras quitarlo |
| 220 | `diff_html_demo.png` | `DOCS/reverse_engineering/neurondb/diff_html_demo.png` | captura o recurso gráfico que no se versionó |

### `neurondb/SYNTH_FRAMES.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 23 | `wav/body_frame00.wav` | `DOCS/reverse_engineering/neurondb/wav/body_frame00.wav` | fichero que no se versionó |
| 24 | `wav/body_frame32.wav` | `DOCS/reverse_engineering/neurondb/wav/body_frame32.wav` | fichero que no se versionó |
| 25 | `wav/scape_curva.wav` | `DOCS/reverse_engineering/neurondb/wav/scape_curva.wav` | fichero que no se versionó |

### `observers/OBSERVER_CALLBACKS.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 171 | `matrix_runtime.log` | `DOCS/reverse_engineering/observers/matrix_runtime.log` | volcado de datos que no se versionó |
| 241 | `matrix_runtime.log` | `DOCS/reverse_engineering/observers/matrix_runtime.log` | volcado de datos que no se versionó |

### `observers/README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 45 | `matrix_runtime.log` | `DOCS/reverse_engineering/observers/matrix_runtime.log` | volcado de datos que no se versionó |
| 126 | `matrix_runtime.log` | `DOCS/reverse_engineering/observers/matrix_runtime.log` | volcado de datos que no se versionó |

### `port/TRANSLATOR.md`

> **Obsoleto desde 2026-11-09.** La tabla decía «fichero que no se versionó», y era falso: los dos
> son el port que vive en `Source/DSP/`. Ya están reescritos y figuran en «Correcciones
> aplicadas»; no queda ninguno roto en este documento.

| Línea (2026-11-08) | Enlace | Se creyó que resolvía a | Por qué se creyó roto |
|---:|---|---|---|
| 11 | `../src/translator.cpp` | `DOCS/reverse_engineering/src/translator.cpp` | fichero que no se versionó |
| 266 | `../src/translator_hooks.cpp` | `DOCS/reverse_engineering/src/translator_hooks.cpp` | fichero que no se versionó |

### `preset_format/OBSERVER_CALLBACK.md`

> **Obsoleto desde 2026-11-09.** El `.c` descompilado no está en el repositorio, pero el
> desensamblado del mismo callback sí (`observers/functions/10013620_ModelIndexChange.asm`), así
> que el enlace apunta ahí; figura en «Correcciones aplicadas».

| Línea (2026-11-08) | Enlace | Resuelve a | Por qué se creyó roto |
|---:|---|---|---|
| 13 | `../NeuronVS_decompiled/functions/10013620_callback_10013620.c` | `DOCS/reverse_engineering/NeuronVS_decompiled/functions/10013620_callback_10013620.c` | ruta con prefijo `NeuronVS_`/`Neuron80GB` y sin destino tras quitarlo |

### `preset_format/PARAM_RECORD.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 307 | `../NeuronVS_dsp/tools/verify_dsp.py` | `DOCS/reverse_engineering/NeuronVS_dsp/tools/verify_dsp.py` | ruta con prefijo `NeuronVS_`/`Neuron80GB` y sin destino tras quitarlo |

### `preset_format/README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 18 | `tools/build_schema.py` | `DOCS/reverse_engineering/preset_format/tools/build_schema.py` | script de verificación que no se versionó |
| 19 | `tools/preset.py` | `DOCS/reverse_engineering/preset_format/tools/preset.py` | script de verificación que no se versionó |
| 20 | `tools/verify_preset.py` | `DOCS/reverse_engineering/preset_format/tools/verify_preset.py` | script de verificación que no se versionó |

### `resolved/README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 159 | `functions` | `DOCS/reverse_engineering/resolved/functions` | carpeta que no existe en el árbol |
| 168 | `summary.txt` | `DOCS/reverse_engineering/resolved/summary.txt` | volcado de datos que no se versionó |
| 169 | `tools` | `DOCS/reverse_engineering/resolved/tools` | carpeta que no existe en el árbol |

### `vst2/README.md`

| Línea | Enlace | Resuelve a | Por qué sigue roto |
|---:|---|---|---|
| 241 | `tools/scan_midi_bridges.py` | `DOCS/reverse_engineering/vst2/tools/scan_midi_bridges.py` | script de verificación que no se versionó |
| 271 | `_callbacks` | `DOCS/reverse_engineering/vst2/_callbacks` | carpeta que no existe en el árbol |
| 272 | `tools` | `DOCS/reverse_engineering/vst2/tools` | carpeta que no existe en el árbol |

---

## Cómo se comprobó / cómo se regenera

Un enlace es «roto» si su ruta, resuelta contra la carpeta del documento e ignorando el
fragmento `#…`, no existe en disco. La alternativa se buscó en este orden: quitar el prefijo
`NeuronVS_` de cada segmento; mapear `Neuron80GB-OS15` a `neurondb`; el mismo nombre de fichero
en la carpeta del documento; y, si el nombre es único en el árbol, la ruta que lo encuentra.

La corrección se aplicó sustituyendo el destino dentro de `](…)`, comprobando antes que la ruta
alternativa existiera y después que ningún enlace reescrito siguiera roto ni que quedara
ninguno de los 155 con una alternativa disponible en el árbol. El recuento original (222)
cuenta citas, salvo en `bitmaps/GALERIA.md`, donde la misma imagen aparece dos veces en la
galería y se contó una sola: 86 en vez de 128. Se mantiene ese criterio, de ahí 222 − 67 = 155.

El escaneo es mecánico y se puede repetir: cualquier enlace que se arregle en el futuro
desaparece de este inventario, y cualquier enlace nuevo roto aparece con su línea.
