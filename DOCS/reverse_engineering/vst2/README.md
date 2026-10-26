# NeuronVS · superficie VST2

Reconstrucción estática de la interfaz VST2 de `NeuronVS.dll` (PE32 x86, Hartmann Music, 2004) a partir del propio binario y del pseudocódigo de Ghidra. No se ejecutó el plugin: cada dato lleva su dirección de origen.

**Resultado:** 72 de 77 opcodes enrutados (0x00–0x4c), **26 parámetros** automatizables, flags `0x111`, un único camino MIDI (`effProcessEvents`) y 11 mensajes MIDI con efecto.

## Cómo se enruta un opcode

1. La exportación `main` (`0x1001b010`) construye un `C_NeuronCore` de 1008 bytes y devuelve `core+0x20`, donde vive el `AEffect` embebido (lo inicializa `C_AudioNode_ctor` en `0x10002fb0`).
2. `AEffect->dispatcher` es el stub `0x10002ed0`: lee `AEffect->object` (`core`), y llama al slot 6 de la vtable del core (`core+0x18`) con `(opcode, index, value, ptr, opt)`.
3. Ese slot es `0x10003970`, que cubre `0x19–0x4c` y delega `0x00–0x18` en `0x100030b0`. Ningún `case` implementa lógica: cada uno elige un slot de la vtable del core (`0x1004f550`) o del editor (`core+0x08`, `C_Editor`, vtable `0x1004f7a0`) y reenvía los argumentos que aparecen en el CSV.
4. Por eso el handler real de cada opcode es el puntero leído en esa vtable, no el `case`. `tools/verify_vst2.py` vuelve a recorrer los dos `switch` y comprueba slot, handler y argumentos de las 77 filas.

## Cabecera `AEffect`

| Campo | Valor | Evidencia |
|---|---|---|
| magic | 0x56737450 'VstP' | 10002fb0: [core+0x20]=0x56737450 |
| dispatcher | 0x10002ed0 | 10002fb0 instala el stub en AEffect+0x04 |
| process | 0x10002f70 -> core+0x10 (1000a040) | stub |
| setParameter | 0x10002f50 -> core+0x04 (1001ba00) | stub |
| getParameter | 0x10002f30 -> core+0x08 (1001ba30) | stub |
| numPrograms | 1 con host 'FXpansion', 0 en el resto | 1001b010 compara el vendor del host |
| numParams | 26 | 10009f60(...,0x1a) |
| numInputs | 0 | 1001b140: [core+0x3c]=0 |
| numOutputs | 2 | 1001b140: [core+0x40]=2 |
| flags | 0x111 | 0x1 editor + 0x10 canReplacing + 0x100 isSynth |
| initialDelay | 0 | 10002fb0 |
| ioRatio | 1.0 | 10002fb0: 0x3f800000 |
| object | core (AEffect = core+0x20) | 10002fb0: [core+0x60]=core |
| uniqueID | 0x4e415332 'NAS2' | 1001b140 sobreescribe el 'NoEf' del ctor base |
| version | 1 | 10002fb0 |
| processReplacing | 0x10002f90 -> core+0x14 (1000a040) | stub |
| processDoubleReplacing | 0 | 10002fb0 deja 0 |

### Flags (`AEffect->flags`, en `core+0x44`)

| Bit | Valor | Significado | Quién lo pone |
|---|---|---|---|
| 0x001 | 1 | `effFlagsHasEditor` | `FUN_10002b70`, al enganchar el editor en `core+8` |
| 0x010 | 16 | `effFlagsCanReplacing` | `FUN_10003470(1)` en `1001b140` |
| 0x100 | 256 | `effFlagsIsSynth` | `FUN_10004620(1)` en `1001b140` |

Total **0x111**. No se marca `effFlagsProgramChunks` (0x20), coherente con `effGetChunk`/`effSetChunk` devolviendo 0. Los bits 0x2 y 0x4 se limpian explícitamente (`FUN_100033f0`, `FUN_10003410`); son los antiguos `effFlagsHasVu`/`effFlagsHasClip`.

El editor sólo activa el bit 0x1 cuando `C_Editor` se construye con éxito (`FUN_10002b70` escribe `core+8` y hace `flags |= 1`), así que un fallo de creación deja el plugin sin editor declarado.

## Opcodes

| Op | Nombre SDK | Destino | Handler | Args | Devuelve | Guarda | Notas |
|---|---|---|---|---|---|---|---|
| 0x00 | effOpen | core 0x1c | C_OleRef_v03 | - | 0 | - | abre; no-op |
| 0x01 | effClose | core 0x20 | C_OleRef_v03 | - | 0 | - | cierra; no-op |
| 0x02 | effSetProgram | core 0x28 | C_AudioNode_v10 | value | 0 | value < numPrograms | fija el programa solo si value < numPrograms (core+0x10) |
| 0x03 | effGetProgram | core 0x24 | C_AudioNode_v09 | - | handler | - | devuelve el indice de programa (core+0x18) |
| 0x04 | effSetProgramName | core 0x2c | C_AudioNode_v11 | ptr | 0 | - | ignora el nombre: escribe 0 en el buffer |
| 0x05 | effGetProgramName | core 0x30 | C_NeuronCore_v12 | ptr | 0 | - | copia "No Program Name" |
| 0x06 | effGetParamLabel | core 0x34 | C_NeuronCore_v13 | index, ptr | 0 | - | label de parametro: "Unit" |
| 0x07 | effGetParamDisplay | core 0x38 | C_NeuronCore_v14 | index, ptr | 0 | - | display de parametro: "---" |
| 0x08 | effGetParamName | core 0x3c | C_NeuronCore_v15 | index, ptr | 0 | - | nombre: sprintf("%24s") sobre el buffer de 8 del host |
| 0x09 | effGetVu | core 0x40 | C_AudioNode_v16 | - | int(handler) | - | Vu = 0.0; el dispatcher lo pasa a entero |
| 0x0a | effSetSampleRate | core 0x4c | C_NeuronCore_v19 | opt | 0 | - | guarda sample rate en core+0x04 |
| 0x0b | effSetBlockSize | core 0x50 | C_NeuronCore_v20 | value | 0 | - | guarda block size en core+0x1c |
| 0x0c | effMainsChanged | core 0x54 / 0x58 | C_OleRef_v03 (value=0) / C_NeuronCore_v22 (value!=0) | - | 0 | value == 0 / value != 0 | value=0 no-op; value!=0 reanuda y pide MIDI al host (audioMaster 6) |
| 0x0d | effEditGetRect | editor 0x04 | C_RefObject_v01_getRect | ptr | handler | editor != 0 | devuelve &editor->rect {0,0,652,800} y 1 |
| 0x0e | effEditOpen | editor 0x08 | C_Editor_v02_createChild | ptr | handler | editor != 0 | abre la ventana 800x652 del editor |
| 0x0f | effEditClose | editor 0x0c | C_Editor_v03 | - | 0 | editor != 0 | cierra y libera la ventana |
| 0x10 | effEditDraw | — | — | - | 0 | - | no enrutado (deprecado) |
| 0x11 | effEditMouse | — | — | - | 0 | - | no enrutado (deprecado) |
| 0x12 | effEditKey | — | — | - | 0 | - | no enrutado (deprecado) |
| 0x13 | effEditIdle | editor 0x10 | C_RefObject_v04 | - | 0 | editor != 0 | idle del editor |
| 0x14 | effEditTop | — | — | - | 0 | - | no enrutado (deprecado) |
| 0x15 | effEditSleep | — | — | - | 0 | - | no enrutado (deprecado) |
| 0x16 | effIdentify | const | const | - | 0x4e764566 ('NvEf') | - | devuelve 0x4e764566 = 'NvEf' |
| 0x17 | effGetChunk | core 0x44 | C_AudioNode_v17 | ptr, index!=0 | handler | - | chunks no soportados: 0 |
| 0x18 | effSetChunk | core 0x48 | C_AudioNode_v18 | ptr, value, index!=0 | handler | - | chunks no soportados: 0 |
| 0x19 | effProcessEvents | core 0xc8 | C_AudioModule_v50 | ptr | handler | - | procesa VstEvents; solo kVstMidiType; devuelve 1 siempre |
| 0x1a | effCanBeAutomated | core 0xd4 | C_NeuronCore_v53 | index | handler != 0 | - | todos los parametros son automatizables: 1 |
| 0x1b | effString2Parameter | core 0xd8 | C_AudioComponent_v54 | index, ptr | handler != 0 | - | string2Parameter no soportado: 0 |
| 0x1c | effGetNumProgramCategories | core 0xe0 | C_AudioComponent_v56 | - | handler | - | devuelve 1 categoria (aunque numPrograms sea 0) |
| 0x1d | effGetProgramNameIndexed | core 0xe4 | C_AudioComponent_v57 | value, index, ptr | handler != 0 | - | 0 (sin nombres por indice) |
| 0x1e | effCopyProgram | core 0xe8 | C_OleRef_v10 | index | handler != 0 | - | 0 |
| 0x1f | effConnectInput | core 0x110 | C_AudioNode_v01_setParameter | index, value!=0 | 1 | - | no-op; devuelve 1 |
| 0x20 | effConnectOutput | core 0x114 | C_AudioNode_v01_setParameter | index, value!=0 | 1 | - | no-op; devuelve 1 |
| 0x21 | effGetInputProperties | core 0x118 | C_AudioComponent_v54 | index, ptr | handler != 0 | - | 0 (el sintetizador no tiene entradas) |
| 0x22 | effGetOutputProperties | core 0x11c | C_NeuronCore_v71 | index, ptr | handler != 0 | - | VstPinProperties: "Neuron N", flags 3 (activo\|estereo) |
| 0x23 | effGetPlugCategory | core 0x120 | C_AudioComponent_v72 | - | handler | - | kPlugCategSynth (2), leido del bit isSynth de AEffect->flags |
| 0x24 | effGetCurrentPosition | core 0x138 | C_AudioComponent_v78 | - | handler | - | 0 |
| 0x25 | effGetDestinationBuffer | core 0x13c | C_AudioComponent_v78 | - | handler | - | 0 |
| 0x26 | effOfflineNotify | core 0x154 | C_AudioComponent_v57 | ptr, value, index!=0 | handler & 0xff | - | 0 |
| 0x27 | effOfflinePrepare | core 0x158 | C_AudioComponent_v54 | ptr, value | handler & 0xff | - | 0 |
| 0x28 | effOfflineRun | core 0x15c | C_AudioComponent_v54 | ptr, value | handler & 0xff | - | 0 |
| 0x29 | effProcessVarIo | core 0x1a4 | C_OleRef_v10 | ptr | handler != 0 | - | 0 |
| 0x2a | effSetSpeakerArrangement | core 0x1a8 | C_AudioComponent_v54 | value, ptr | handler != 0 | - | 0 |
| 0x2b | effSetBlockSizeAndSampleRate | core 0x1b0 | C_AudioComponent_v108 | value, opt | 1 | - | fija block size (value) y sample rate (opt) |
| 0x2c | effSetBypass | core 0x1b4 | C_OleRef_v10 | value!=0 | handler != 0 | - | 0 (no hay bypass) |
| 0x2d | effGetEffectName | core 0x1b8 | C_NeuronCore_v110 | ptr | handler != 0 | - | "NeuronVS" |
| 0x2e | effGetErrorText | core 0x1bc | C_OleRef_v10 | ptr | handler != 0 | - | 0 |
| 0x2f | effGetVendorString | core 0x1c0 | C_NeuronCore_v112 | ptr | handler != 0 | - | "Hartmann Music GmbH" |
| 0x30 | effGetProductString | core 0x1c4 | C_NeuronCore_v113 | ptr | handler != 0 | - | "Neuron VS VSt-Plugin" |
| 0x31 | effGetVendorVersion | core 0x1c8 | C_NeuronCore_v114 | - | handler | - | 900 |
| 0x32 | effVendorSpecific | core 0x1cc | C_AudioComponent_v115 | index, value, ptr, opt | handler | - | 0 (sin extensiones de fabricante) |
| 0x33 | effCanDo | core 0x1d0 | C_NeuronCore_v116 | ptr | handler | - | solo "receiveVstEvents"/"receiveVstMidiEvent": 1; resto -1 |
| 0x34 | effGetTailSize | core 0x1dc | C_AudioComponent_v78 | - | handler | - | 0 (sin cola declarada) |
| 0x35 | effIdle | core 0x1e0 | C_AudioComponent_v78 | - | handler | - | 0 |
| 0x36 | effGetIcon | core 0x1d4 | C_AudioComponent_v78 | - | handler | - | 0 |
| 0x37 | effSetViewPosition | core 0x1d8 | C_AudioComponent_v54 | index, value | handler != 0 | - | 0 |
| 0x38 | effGetParameterProperties | core 0x1e4 | C_AudioComponent_v54 | index, ptr | handler != 0 | - | 0 (sin VstParameterProperties) |
| 0x39 | effKeysRequired | core 0x1e8 | C_AudioComponent_v122 | - | !handler | - | 1: el sintetizador requiere teclado |
| 0x3a | effGetVstVersion | core 0x1ec | C_AudioComponent_v123 | - | handler | - | 2300 (VST 2.3) |
| 0x3b | effEditKeyDown | editor 0x1c | C_RefObject_v07 | &event{index,value,opt} | handler | editor != 0 | keyDown al editor; -1 si no hay ventana |
| 0x3c | effEditKeyUp | editor 0x20 | C_RefObject_v08 | &event{index,value,opt} | handler | editor != 0 | keyUp al editor; -1 si no hay ventana |
| 0x3d | effSetEditKnobMode | editor 0x24 | C_RefObject_v09 | value | handler | editor != 0 | guarda el knob mode global; 1 |
| 0x3e | effGetMidiProgramName | core 0x1f0 | C_AudioNode_v17 | index, ptr | handler | - | 0 (sin programas MIDI) |
| 0x3f | effGetCurrentMidiProgram | core 0x1f4 | C_AudioComponent_v125 | index, ptr | handler | - | -1 |
| 0x40 | effGetMidiProgramCategory | core 0x1f8 | C_AudioNode_v17 | index, ptr | handler | - | 0 |
| 0x41 | effHasMidiProgramsChanged | core 0x1fc | C_OleRef_v10 | index | handler != 0 | - | 0 |
| 0x42 | effGetMidiKeyName | core 0x200 | C_AudioComponent_v54 | index, ptr | handler != 0 | - | 0 |
| 0x43 | effBeginSetProgram | core 0x204 | C_AudioComponent_v122 | - | handler != 0 | - | 0 |
| 0x44 | effEndSetProgram | core 0x208 | C_AudioComponent_v122 | - | handler != 0 | - | 0 |
| 0x45 | effGetSpeakerArrangement | core 0x1ac | C_AudioComponent_v107 | value, ptr | handler != 0 | - | pone a 0 el tipo de las dos disposiciones; 0 |
| 0x46 | effShellGetNextPlugin | core 0x21c | C_OleRef_v09 | ptr | handler | - | 0 |
| 0x47 | effStartProcess | core 0x220 | C_AudioComponent_v78 | - | handler | - | 0 |
| 0x48 | effStopProcess | core 0x224 | C_AudioComponent_v78 | - | handler | - | 0 |
| 0x49 | effSetTotalSampleToProcess | core 0x218 | C_AudioComponent_v134 | value | handler | - | devuelve el valor recibido |
| 0x4a | effSetPanLaw | core 0x228 | C_AudioComponent_v54 | value, opt | handler != 0 | - | 0 |
| 0x4b | effBeginLoadBank | core 0x22c | C_OleRef_v09 | ptr | handler | - | 0 |
| 0x4c | effBeginLoadProgram | core 0x230 | C_OleRef_v09 | ptr | handler | - | 0 |

`core` = vtable `0x1004f550`; `editor` = objeto en `core+8`, vtable `0x1004f7a0`. Los nombres `C_*_vNN` son los del modelo de clases ([`../NeuronVS_classes/CLASSES.md`](../NeuronVS_classes/CLASSES.md)); `vNN` es el slot, no el número de virtuales de la clase.

### Opcodes no enrutados

| Op | Nombre | Motivo |
|---|---|---|
| 0x10 | effEditDraw | cae en el `default` de `0x100030b0`: devuelve 0 |
| 0x11 | effEditMouse | cae en el `default` de `0x100030b0`: devuelve 0 |
| 0x12 | effEditKey | cae en el `default` de `0x100030b0`: devuelve 0 |
| 0x14 | effEditTop | cae en el `default` de `0x100030b0`: devuelve 0 |
| 0x15 | effEditSleep | cae en el `default` de `0x100030b0`: devuelve 0 |

Son las llamadas de edición obsoletas de VST 1.0 (`effEditDraw`, `effEditMouse`, `effEditKey`, `effEditTop`, `effEditSleep`). `effEditOpen`, `effEditClose`, `effEditIdle` y `effEditGetRect` sí están implementados vía el editor.

## Parámetros

El host ve **26 parámetros**. `core+0xc0` es un array de 26 punteros que el constructor del core calcula como `snddat->tabla + índice*0x28`: apuntan a los **registros de ejecución** de `C_Param`, no a los descriptores de `.rdata`. El índice sale de la tabla estática de `0x1004f4e8`; el descriptor correspondiente está en `0x10049f08 + índice*0x1c` y el registro se construye a partir de él al arrancar (ver [`NeuronVS_preset_format/PARAM_RECORD.md`](../NeuronVS_preset_format/PARAM_RECORD.md)). Cada uno de los 26 registros recibe además un observador en `core+0x128 + i*0x18` con la máscara 7, que es lo que mantiene el valor del host sincronizado.

| # | Nombre | Desc. | Min | Max | Default |
|---|---|---|---|---|---|
| 0 | `R1L1Sphere1Value` | 42 | 0 | 127 | 64 |
| 1 | `R1L1Sphere2Value` | 43 | 0 | 127 | 64 |
| 2 | `R1L2Sphere1Value` | 62 | 0 | 127 | 64 |
| 3 | `R1L2Sphere2Value` | 63 | 0 | 127 | 64 |
| 4 | `R1L3Sphere1Value` | 82 | 0 | 127 | 64 |
| 5 | `R1L3Sphere2Value` | 83 | 0 | 127 | 64 |
| 6 | `R1L1Scape1Value` | 52 | 0 | 127 | 64 |
| 7 | `R1L1Scape2Value` | 53 | 0 | 127 | 64 |
| 8 | `R1L2Scape1Value` | 72 | 0 | 127 | 64 |
| 9 | `R1L2Scape2Value` | 73 | 0 | 127 | 64 |
| 10 | `R1L3Scape1Value` | 92 | 0 | 127 | 64 |
| 11 | `R1L3Scape2Value` | 93 | 0 | 127 | 64 |
| 12 | `R2L1Sphere1Value` | 122 | 0 | 127 | 64 |
| 13 | `R2L1Sphere2Value` | 123 | 0 | 127 | 64 |
| 14 | `R2L2Sphere1Value` | 142 | 0 | 127 | 64 |
| 15 | `R2L2Sphere2Value` | 143 | 0 | 127 | 64 |
| 16 | `R2L3Sphere1Value` | 162 | 0 | 127 | 64 |
| 17 | `R2L3Sphere2Value` | 163 | 0 | 127 | 64 |
| 18 | `R2L1Scape1Value` | 132 | 0 | 127 | 64 |
| 19 | `R2L1Scape2Value` | 133 | 0 | 127 | 64 |
| 20 | `R2L2Scape1Value` | 152 | 0 | 127 | 64 |
| 21 | `R2L2Scape2Value` | 153 | 0 | 127 | 64 |
| 22 | `R2L3Scape1Value` | 172 | 0 | 127 | 64 |
| 23 | `R2L3Scape2Value` | 173 | 0 | 127 | 64 |
| 24 | `FilterFreq` | 274 | 0 | 127 | 127 |
| 25 | `FilterReso` | 275 | 0 | 127 | 0 |

Rango 0–127 en las 26 entradas; 24 arrancan en 64, `FilterFreq` en 127 y `FilterReso` en 0.

Excepciones al valor por defecto: `FilterFreq`=127, `FilterReso`=0.

### Nombres, etiquetas y display

| Opcode | Qué escribe | Evidencia |
|---|---|---|
| effGetParamName | `sprintf(buf, "%24s", descriptor->name)` | `0x1001ba60`; `%24s` en `0x10054704` |
| effGetParamLabel | `"Unit"` para todos | `0x1001bab0`, string en `0x10054710` |
| effGetParamDisplay | `"---"` para todos | `0x1001ba90`, string en `0x1005470c` |

`effGetParamName` escribe hasta 24 caracteres + NUL en el buffer del host, que la especificación limita a `kVstMaxParamStrLen` = 8: es un desbordamiento real, no una licencia de redacción. Los nombres del binario miden hasta 16 caracteres (`R1L1Sphere1Value`).

`setParameter`/`getParameter` (`0x1001ba00`/`0x1001ba30`) escriben y leen la entrada `core+0x128 + índice*0x18`; el cambio dispara el callback `LAB_1001b7d0`, que notifica al motor. `effCanBeAutomated` devuelve 1 para todos; `effString2Parameter` y `effGetParameterProperties` devuelven 0, así que no hay textos ni pasos declarados al host.

## MIDI

El único camino de entrada es `effProcessEvents` (0x19): `0x10003970` → slot `core+0xc8` (`0x1000a070`) → callback instalado por el componente Noise (`0x1000b7f0`). `processReplacing` no consume eventos.

`0x1000a070` recorre `VstEvents->numEvents`, ignora todo lo que no sea `type == 1` (`kVstMidiType`) y pasa el puntero a `midiData` (evento+0x18). **No** usa `deltaFrames`, `flags`, `noteLength` ni `noteOffVelocity`: todos los eventos se aplican al inicio del bloque.

| Status | Evento | Datos | Acción | Evidencia |
|---|---|---|---|---|
| 0x8n | Note Off | nota, velocidad | libera todas las voces de esa nota (velocidad se ignora) | case 0x80 -> FUN_1000ba70(..., nota, 0) |
| 0x9n | Note On | nota, velocidad | velocidad 0 = Note Off; si no, asigna/roba voz | case 0x90 -> FUN_1000ba70(..., nota, velocidad) |
| 0xBn | Control Change 1 | valor | control 1 = valor/127 | case 0xb0 / case 1 |
| 0xBn | Control Change 2 | valor | control 2 = valor/127 | case 0xb0 / case 2 |
| 0xBn | Control Change 3 | valor | control 3 = valor/127 | case 0xb0 / case 3 |
| 0xBn | Control Change 4 | valor | control 4 = valor/127 | case 0xb0 / case 4 |
| 0xBn | Control Change 11 | valor | control 5 (expression) = valor/127 | case 0xb0 / case 0xb |
| 0xBn | Control Change 32 | valor | banco MIDI (usado por Program Change) | case 0xb0 / case 0x20 |
| 0xCn | Program Change | programa | pasa banco*100+programa al callback del motor | case 0xc0 |
| 0xDn | Channel Pressure | presion | control 0 = presion/127 | case 0xd0 |
| 0xEn | Pitch Bend | LSB, MSB | (MSB*128+LSB)/16384, rango 0..1 | case 0xe0 |
| 0xAn | Poly Aftertouch | - | ignorado | sin case 0xa0 |
| 0xF0 | SysEx | - | ignorado (tampoco se acepta kVstSysExType) | sin case 0xf0 |

El nibble de canal se descarta (`status & 0xF0`): el plugin es omni. `Note On` con velocidad 0 entra por la rama de note-off (`0 < velocidad` es falso). La polifonía sale de `noise+0x38`; si no hay voz libre se roba la que el motor puntúa más baja (`FUN_100403b0`). `Control Change 32` fija el banco y `Program Change` pasa `banco*100 + programa` al callback del motor.

Los cinco CC de ejecución y la presión acaban en el mismo sitio: `FUN_10013490(control, valor)` escribe `params+0x44+control*4` (los 6 controles de instrumento del objeto de parámetros) y dispara `FUN_100134e0(0xffffffff)`, que recalcula el snapshot derivado. El bend no toca esa tabla: `FUN_100134b0` → `FUN_1003d7a0` guarda el valor en `engine+0xDA4` y el factor en `engine+0xDA8` con la ley `2^((2b-1)·rango/12)`, donde el rango sale de `engine+8` (2 semitonos por defecto) y `1/12` es `_DAT_1030da18`.

`effCanDo` sólo acepta `receiveVstEvents` y `receiveVstMidiEvent`; cualquier otra cadena devuelve -1. `effGetVstVersion` devuelve 2300 y `effKeysRequired` devuelve 1.

### Control de la comunidad: lo que hubo que construir fuera

Los proyectos que acompañan al sintetizador enseñan qué faltaba. Todos son puentes hacia los **26 parámetros** del plugin, no hacia las 445 claves:

| Fichero | Qué es | Qué controla |
|---|---|---|
| `Neuron_CC_Map` (`.amxd`, Max for Live) | 26 `live.numbox` + 26 bpatchers `OneMap.maxpat`; `midiparse` → `route` → numbox | los 26 parámetros VST, un CC configurable por cada uno |
| `Neuron_CC_Map-1.amxd` | 32 numbox, misma idea | ídem, 32 |
| `neuroncontrol4.pd` | patch Pure Data, **26 `ctlout`** | etiquetas `R1L1Sphere2Value…`, el mismo juego de 26 |
| `Neuron VS.pd` | almohadillas XY | CC **16/17** (Resynator 1), **35/36** (R2), **52/53** (`Silver`) |
| `MYELIN MIDI CC v3a.jzml` | plantilla Lemur | barrido de CC 14–27, 33–63 y 85–91 |

Los números salen de [`midi_bridges.csv`](midi_bridges.csv), que genera
[`tools/scan_midi_bridges.py`](tools/scan_midi_bridges.py) leyendo los `.zip` y el
`.jzml` originales (26 y 32 numbox en los dos aparatos Max, 26 `ctlout` en el patch de
Pure Data). Ninguno de esos números aparece en el `switch` de `0x1000b7f0`: **el
plugin no los entiende**. Son convenciones de usuario que viajan por la automatización del host (Ableton MIDI map, Bidule, Lemur) y que por eso necesitan parámetros con nombre. Para un port, la consecuencia es doble: el MIDI nativo del original es sólo nota + 5 CC de ejecución + banco/programa + presión + bend, y cualquier mapeo CC→parámetro es añadido y por tanto se puede mejorar sin romper compatibilidad.

## Llamadas del plugin al host

Además de `audioMasterVersion` (opcode 1) y `audioMasterGetVendorString` (0x20, comparado con `"FXpansion"` para decidir `numPrograms`), el plugin usa `audioMasterWantMidi` (6) al reanudar: `effMainsChanged` con valor != 0 → `core+0xbc` (`0x10004040`) → `audioMaster(AEffect*, 6, 0, 1, 0, 0)`.

`C_AudioComponent` expone además envoltorios para los opcodes 1–0x2d (`0x100032c0`–`0x100047c0`), pero no hay llamadas directas en el pseudocódigo: sólo se usan a través de la vtable.

## Rarezas que conviene conocer

- `numPrograms` vale 0 salvo que el host se identifique como `"FXpansion"`; en ese caso vale 1 y `effSetProgram` acepta el índice 0. `effGetNumProgramCategories` devuelve 1 igualmente.
- `effGetChunk`/`effSetChunk` devuelven 0 y no hay `effFlagsProgramChunks`: el host no puede guardar presets; el estado viaja por los ficheros propios.
- `effGetTailSize` devuelve 0, aunque la especificación recomienda 1 para "sin cola".
- `effProcessEvents` devuelve 1 incluso con `numEvents == 0`.
- `effGetVu` devuelve 0.0 y el dispatcher lo convierte con `ftol`.
- `effSetProgramName` escribe 0 en el primer byte del buffer: no conserva nombre.
- `effGetOutputProperties` usa `VstPinProperties`: label `"Neuron N"`, `flags = 3` (activo + estéreo), `shortLabel` vacío.
- `uniqueID` es `0x4e415332` (`'NAS2'`), no el `'fEoN'` que instala el constructor base: el constructor del core lo sobreescribe en `1001b140`.

## Artefactos

| Archivo | Contenido |
|---|---|
| [`opcodes.csv`](opcodes.csv) | 77 opcodes: destino, slot, handler, argumentos, retorno y guarda |
| [`parameters.csv`](parameters.csv) | 26 parámetros con nombre, rango, default y descriptor |
| [`midi.csv`](midi.csv) | Mensajes MIDI reconocidos y su efecto |
| [`aeffect.csv`](aeffect.csv) | Cabecera `AEffect` reconstruida |
| [`_callbacks/`](_callbacks) | Callbacks que sólo se referencian por puntero: MIDI, editor, cambio de parámetro |
| [`tools/`](tools) | Generador y verificador |

`tools/verify_vst2.py` reconstruye todo desde `NeuronVS.dll` y falla si un CSV o este README se desvían del binario.

## Límites

- El análisis es estático: no se ejecutó el plugin dentro de un host, así que el comportamiento descrito es el del código, no el observado en un DAW.
- Los nombres de clase y de método provienen del modelo de clases ([`../NeuronVS_classes/`](../NeuronVS_classes/)), no de RTTI/PDB.
- El objeto editor (`C_Editor`) se identifica por el puntero que el propio plugin guarda en `core+8`; su vtable se lee de `0x1004f7a0`. Los slots `+0x04`/`+0x1c`/`+0x20`/`+0x24` llevan nombres de la convención MSVC (`C_RefObject_*`) que no describen su papel VST; el CSV usa el papel real.
- `deltaFrames` ignorado se deduce de `0x1000a070`; si el motor aplicara latencia por otra vía, no aparece en este camino.
- Los ficheros de la comunidad (`Neuron_CC_Map`, `neuroncontrol4.pd`, `Neuron VS.pd`, `MYELIN MIDI CC v3a.jzml`) se leyeron para comprobar si existía un mapeo CC documentado que el binario no enseñara: no lo hay, y la conclusión está arriba. El estudio del motor, con el detalle de dónde acaban esos controles, está en [`../NeuronVS_dsp/`](../NeuronVS_dsp/).
