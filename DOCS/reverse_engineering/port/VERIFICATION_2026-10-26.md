# Verificación in situ: preset real + tabla de 445 parámetros + fuentes del modelo

## 1) Preset real inspeccionado

Ruta real:
`C:\Users\ajaba\Downloads\Neuron\NeuronVS-db\NeuronDB\Sounds\001.sound\sound.script`

Preset: **001** (nombre decodificado `Whistle` según `sound_schema.csv`/`sounds.csv`).

### Forma concreta

- Texto plano, CRLF, una línea por parámetro.
- Cabecera: `SoundVersionMajor 2`, `SoundVersionMinor 0`, `SoundVersionBuild 0`, `SoundPan 0`, `SoundPanKeyTrack 0`, `SoundNumVoices 8`.
- Nombre en `SoundNameC00..C15`: `77,121,115,116` = `Whst` y resto a 32 (16 bytes; en este archivo el visible es `Whst` + espacios).
- Orden de aparición: primera línea `SoundVersionMajor 2`, última línea `SoundMFXRevSpeed 60`.
- Completo: 445 líneas.

### Claves cabeza y cola del fichero (real)

**Cabeza**

```
SoundVersionMajor	2
SoundVersionMinor	0
SoundVersionBuild	0
SoundPan	0
SoundPanKeyTrack	0
SoundNumVoices	8
SoundNameC00	77
SoundNameC01	121
SoundNameC02	115
SoundNameC03	116
SoundNameC04	32
SoundNameC05	32
SoundNameC06	32
SoundNameC07	32
SoundNameC08	32
SoundNameC09	32
SoundNameC10	32
SoundNameC11	32
SoundNameC12	32
SoundNameC13	32
SoundNameC14	32
SoundNameC15	32
```

**Piernas / cola relevante**

```
R1ModellIndex	336
R1Switch	1
R1Type	0
R1ParamLevel	0
R1SelectStickPar	0
R1Volume	51
R1AmpLfoDepth	0
R1AmpKeyTrack	54
R1VolumeVelocityDepth	63
R1ModelSizeKeyTrack	0
R1ModelSizeOffset	0
R1Octave	2
R1Semi	0
R1Cents	0
R1PitchLfoDepth	0
R1PitchKeyTrack	63
R1FreeADSR1PitchDepth	0
R1FreeADSR2PitchDepth	0
R1Free4L4TPitchDepth	0
R1ModelVelocitySwitch	64
R1L1Sphere1Value	127
R1L1Sphere2Value	67
R1L1ContourSphere	1
R1L1Sphere1KeyTrack	0
R1L1Sphere2KeyTrack	0
R1L1Sphere1LfoDepth	0
R1L1Sphere2LfoDepth	0
R1L1Sphere1VelocityDepth	0
R1L1Sphere2VelocityDepth	0
R1L1SphereStickPlayback	1
R1L1Scape1Value	0
R1L1Scape2Value	0
R1L1ContourScape	0
R1L1Scape1KeyTrack	0
R1L1Scape2KeyTrack	0
R1L1Scape1LfoDepth	0
R1L1Scape2LfoDepth	0
R1L1Scape1VelocityDepth	0
R1L1Scape2VelocityDepth	0
R1L1ScapeStickPlayback	1
R1L2Sphere1Value	0
R1L2Sphere2Value	0
R1L2ContourSphere	1
R1L2Sphere1KeyTrack	0
R1L2Sphere2KeyTrack	0
R1L2Sphere1LfoDepth	0
R1L2Sphere2LfoDepth	0
R1L2Sphere1VelocityDepth	0
R1L2Sphere2VelocityDepth	0
R1L2SphereStickPlayback	1
R1L2Scape1Value	0
R1L2Scape2Value	0
R1L2ContourScape	0
R1L2Scape1KeyTrack	0
R1L2Scape2KeyTrack	0
R1L2Scape1LfoDepth	0
R1L2Scape2LfoDepth	0
R1L2Scape1VelocityDepth	0
R1L2Scape2VelocityDepth	0
R1L2ScapeStickPlayback	1
R1L3Sphere1Value	0
R1L3Sphere2Value	0
R1L3ContourSphere	0
R1L3Sphere1KeyTrack	0
R1L3Sphere2KeyTrack	0
R1L3Sphere1LfoDepth	0
R1L3Sphere2LfoDepth	0
R1L3Sphere1VelocityDepth	0
R1L3Sphere2VelocityDepth	0
R1L3SphereStickPlayback	1
R1L3Scape1Value	0
R1L3Scape2Value	0
R1L3ContourScape	0
R1L3Scape1KeyTrack	0
R1L3Scape2KeyTrack	0
R1L3Scape1LfoDepth	0
R1L3Scape2LfoDepth	0
R1L3Scape1VelocityDepth	0
R1L3Scape2VelocityDepth	0
R1L3ScapeStickPlayback	1
R2ModellIndex	13
R2Switch	0
R2Type	0
R2ParamLevel	0
R2SelectStickPar	0
R2Volume	0
R2AmpLfoDepth	0
R2AmpKeyTrack	0
R2VolumeVelocityDepth	63
R2ModelSizeKeyTrack	0
R2ModelSizeOffset	0
R2Octave	2
R2Semi	0
R2Cents	0
R2PitchLfoDepth	0
R2PitchKeyTrack	63
R2FreeADSR1PitchDepth	0
R2FreeADSR2PitchDepth	0
R2Free4L4TPitchDepth	0
R2ModelVelocitySwitch	64
R2L1Sphere1Value	0
R2L1Sphere2Value	0
R2L1ContourSphere	0
R2L1Sphere1KeyTrack	0
R2L1Sphere2KeyTrack	0
R2L1Sphere1LfoDepth	0
R2L1Sphere2LfoDepth	0
R2L1Sphere1VelocityDepth	0
R2L1Sphere2VelocityDepth	0
R2L1SphereStickPlayback	1
R2L1Scape1Value	0
R2L1Scape2Value	0
R2L1ContourScape	0
R2L1Scape1KeyTrack	0
R2L1Scape2KeyTrack	0
R2L1Scape1LfoDepth	0
R2L1Scape2LfoDepth	0
R2L1Scape1VelocityDepth	0
R2L1Scape2VelocityDepth	0
R2L1ScapeStickPlayback	1
R2L2Sphere1Value	116
R2L2Sphere2Value	63
R2L2ContourSphere	0
R2L2Sphere1KeyTrack	0
R2L2Sphere2KeyTrack	0
R2L2Sphere1LfoDepth	0
R2L2Sphere2LfoDepth	0
R2L2Sphere1VelocityDepth	0
R2L2Sphere2VelocityDepth	0
R2L2SphereStickPlayback	1
R2L2Scape1Value	0
R2L2Scape2Value	0
R2L2ContourScape	0
R2L2Scape1KeyTrack	0
R2L2Scape2KeyTrack	0
R2L2Scape1LfoDepth	0
R2L2Scape2LfoDepth	0
R2L2Scape1VelocityDepth	0
R2L2Scape2VelocityDepth	0
R2L2ScapeStickPlayback	1
R2L3Sphere1Value	0
R2L3Sphere2Value	0
R2L3ContourSphere	0
R2L3Sphere1KeyTrack	0
R2L3Sphere2KeyTrack	0
R2L3Sphere1LfoDepth	0
R2L3Sphere2LfoDepth	0
R2L3Sphere1VelocityDepth	0
R2L3Sphere2VelocityDepth	0
R2L3SphereStickPlayback	1
R2L3Scape1Value	0
R2L3Scape2Value	0
R2L3ContourScape	0
R2L3Scape1KeyTrack	0
R2L3Scape2KeyTrack	0
R2L3Scape1LfoDepth	0
R2L3Scape2LfoDepth	0
R2L3Scape1VelocityDepth	0
R2L3Scape2VelocityDepth	0
R2L3ScapeStickPlayback	1
R1ResEnvA	74
R1ResEnvD	84
R1ResEnvS	46
R1ResEnvR	66
R1ResEnvMode	1
R1ParaEnvVelocityDepth	0
R1L1Scape1EnvDepth	0
R1L1Scape2EnvDepth	0
R1L1Sphere1EnvDepth	-3
R1L1Sphere2EnvDepth	3
R1L2Scape1EnvDepth	0
R1L2Scape2EnvDepth	0
R1L2Sphere1EnvDepth	-64
R1L2Sphere2EnvDepth	-64
R1L3Scape1EnvDepth	0
R1L3Scape2EnvDepth	0
R1L3Sphere1EnvDepth	0
R1L3Sphere2EnvDepth	0
R1AmpEnvA	0
R1AmpEnvD	0
R1AmpEnvS	127
R1AmpEnvR	55
R1AmpEnvMode	0
R1FreeEnvA	0
R1FreeEnvD	0
R1FreeEnvS	0
R1FreeEnvR	0
R1FreeEnvMode	0
R1FreeEnvDepth	0
FreeADSR1VelocityDepth	0
R2ResEnvA	0
R2ResEnvD	0
R2ResEnvS	0
R2ResEnvR	0
R2ResEnvMode	0
R2ParaEnvVelocityDepth	0
R2L1Scape1EnvDepth	0
R2L1Scape2EnvDepth	0
R2L1Sphere1EnvDepth	0
R2L1Sphere2EnvDepth	0
R2L2Scape1EnvDepth	0
R2L2Scape2EnvDepth	0
R2L2Sphere1EnvDepth	0
R2L2Sphere2EnvDepth	0
R2L3Scape1EnvDepth	0
R2L3Scape2EnvDepth	0
R2L3Sphere1EnvDepth	0
R2L3Sphere2EnvDepth	0
R2AmpEnvA	0
R2AmpEnvD	0
R2AmpEnvS	127
R2AmpEnvR	53
R2AmpEnvMode	0
R2FreeEnvA	0
R2FreeEnvD	0
R2FreeEnvS	0
R2FreeEnvR	0
R2FreeEnvMode	0
R2FreeEnvDepth	0
FreeADSR2VelocityDepth	0
FreeEnvLevel1	0
FreeEnvLevel2	0
FreeEnvLevel3	0
FreeEnvLevel4	0
FreeEnvTime1	0
FreeEnvTime2	0
FreeEnvTime3	0
FreeEnvTime4	0
TLFreeEnvMode	0
TLFreeEnvDepth	0
Free4Level4TimeVelocityDepth	0
Shaper12Status	1
FreeEnvType	0
ShaperResySelect	4
LFOSwitch	1
LFODepth	0
LFORate	160
LFODelay	0
LFOWaveForm	0
BlenderType	0
BlenderAmount	-64
BlenderLfoDepth	0
BlenderFreeADSR1Depth	0
BlenderFreeADSR2Depth	0
BlenderFree4L4TDepth	0
SlicerSwitchType	2
SlicerDepth	25
SlicerRate	17
SlicerWaveForm	0
SilverSwitch	1
SilverParamLevel	0
FilterType	0
FilterFreq	61
FilterReso	71
FilterLfoDepth	14
FilterKeyTrack	18
FilterCutoffVelocityDepth	0
SilverL1Contour	1
SilverL1StickPlayback	1
FreqFXSwitch	1
CurFreqFX	0
SilverL2Contour	0
SilverL2StickPlayback	1
EQ_Switch	0
EQ_LowShelfSwitch	0
EQ_LowShelfGain	0
EQ_LowShelfFreq	75
EQ_LowShelfSlope	10
EQ_Band1Switch	0
EQ_Band1Gain	0
EQ_Band1Freq	75
EQ_Band1Q	10
EQ_Band2Switch	0
EQ_Band2Gain	0
EQ_Band2Freq	75
EQ_Band2Q	10
EQ_HighShelfSwitch	0
EQ_HighShelfGain	0
EQ_HighShelfFreq	75
EQ_HighShelfSlope	10
CR_Switch	0
CR_Threshold	0
CR_OutGain	0
CR_Responsiveness	0
DS_InGain	127
DS_PreFilter	63
DS_ClipCurveType	0
DS_OutGain	25
RM_Mix	60
RM_Speed	11
RM_Depth	59
RM_WaveForm	1
RM_ModFreq	67
RM_XoverDelay	29
RM_XoverTime	369
RM_XoverDelayFeedback	57
SW_Mix	50
SW_Frequency	16
SW_Tilt	8
SW_Damping	21
SW_Speed	42
SW_Depth	56
DC_Mix	0
DC_SHFactor	20
DC_PreFilterCutoff	53
TimeFXSwitch	1
CurTimeFX	0
SilverL3Contour	0
SilverL3StickPlayback	1
SS_ChanDelay	3
SS_Feedback	3
LRD_Mix	49
LRD_Time	37
LRD_Feedback	19
FL_Mix	44
FL_Depth	62
FL_Speed	11
FL_WaveForm	0
FL_Feedback	44
FL_StereoPhase	18
PH_Mix	0
PH_Depth	37
PH_Speed	16
PH_WaveForm	0
PH_Feedback	10
PH_StereoPhase	6
CH_Mix	34
CH_Depth	19
CH_Speed	12
CH_WaveForm	0
CH_Feedback	0
CH_StereoPhase	3
CH_PreDelay	0
FilterEnvA	65
FilterEnvD	75
FilterEnvS	79
FilterEnvR	77
FilterEnvMode	0
FilterEnvDepth	19
FilterEnvVelocityDepth	0
Shaper3Status	1
AftertouchDest1	3007
AftertouchDest2	3062
AftertouchDest3	3000
AftertouchDest4	3000
AftertouchDestDepth1	-14
AftertouchDestDepth2	20
AftertouchDestDepth3	0
AftertouchDestDepth4	0
Controller1UpDest1	3001
Controller1UpDest2	3000
Controller1UpDest3	3000
Controller1UpDest4	3000
Controller1UpDestDepth1	63
Controller1UpDestDepth2	63
Controller1UpDestDepth3	63
Controller1UpDestDepth4	63
Controller1DnDest1	3013
Controller1DnDest2	3000
Controller1DnDest3	3000
Controller1DnDest4	3000
Controller1DnDestDepth1	45
Controller1DnDestDepth2	63
Controller1DnDestDepth3	63
Controller1DnDestDepth4	63
Controller2Dest1	3043
Controller2Dest2	3000
Controller2Dest3	3000
Controller2Dest4	3000
Controller2DestDepth1	60
Controller2DestDepth2	63
Controller2DestDepth3	63
Controller2DestDepth4	63
Controller3Dest1	3062
Controller3Dest2	3000
Controller3Dest3	3000
Controller3Dest4	3000
Controller3DestDepth1	31
Controller3DestDepth2	63
Controller3DestDepth3	63
Controller3DestDepth4	63
Controller4Dest1	3000
Controller4Dest2	3000
Controller4Dest3	3000
Controller4Dest4	3000
Controller4DestDepth1	63
Controller4DestDepth2	63
Controller4DestDepth3	63
Controller4DestDepth4	63
FootSwitchDest	0
PitchBendRange	2
AftertouchDest	61
AftertouchDepth	0
ModulationDest	59
ModulationDepth	63
BreathDest	56
BreathDepth	0
CC03Dest	57
CC03Depth	0
FootDest	14
FootDepth	0
ExpressionDest	0
ExpressionDepth	0
Knob1R1Select	61
Knob2R1Select	56
Knob3R1Select	32
Knob4R1Select	62
SlicerSwitchBackup	0
SoundMFXSwitch	0
SoundMFXDelaySwitch	0
SoundMFXDelayMix	0
SoundMFXDelayLTime	250
SoundMFXDelayRTime	500
SoundMFXDelayFeedback	8
SoundMFXDelayFdbkDamp	0
SoundMFXReverbSwitch	0
SoundMFXReverbMix	0
SoundMFXReverbRoom	2
SoundMFXRevDecayTime	32
SoundMFXRevDiffusion	101
SoundMFXRevHFDamp	15
SoundMFXRevDetune	63
SoundMFXRevSpeed	60
```

## 2) Frente a la tabla de 445 parámetros

### 2.1 Recuento y orden

- `preset_schema.csv` → 445 filas (índice 0..444).
- `sound_schema.csv` → 445 filas (índice 0..444).
- Preset real `001.sound/sound.script` → 445 líneas.
- Orden del fichero coincide con el de las tablas: versión, nombre, R1, R2, Synth, SoundMFX.

### 2.2 Primeros índices versus tabla

| índice | clave tabla | clave preset 001 |
|---|---|---|
| 0 | SoundVersionMajor | SoundVersionMajor |
| 1 | SoundVersionMinor | SoundVersionMinor |
| 2 | SoundVersionBuild | SoundVersionBuild |
| 3 | SoundPan | SoundPan |
| 4 | SoundPanKeyTrack | SoundPanKeyTrack |
| 5 | SoundNumVoices | SoundNumVoices |
| 6 | SoundNameC00 | SoundNameC00 |
| 7 | SoundNameC01 | SoundNameC01 |
| 8 | SoundNameC02 | SoundNameC02 |
| 9 | SoundNameC03 | SoundNameC03 |

Coincidencia exacta de clave + posición para los primeros 10.

### 2.3 Últimos índices versus tabla

| índice | clave tabla | clave preset 001 |
|---|---|---|
| 442 | SoundMFXRevHFDamp | SoundMFXRevHFDamp |
| 443 | SoundMFXRevDetune | SoundMFXRevDetune |
| 444 | SoundMFXRevSpeed | SoundMFXRevSpeed |

Coincidencia exacta al final. La línea final del preset es `SoundMFXRevSpeed\t60`.

### 2.4 Valores concretos del preset frente a rango de la tabla

Parámetros de interés (índice / clave / valor en 001 / min/max de tabla):

| índice | clave | valor 001 | min | max |
|---|---|---|---|---|
| 5 | SoundNumVoices | 8 | 1 | 32 |
| 22 | R1ModellIndex | 336 | 0 | 511 |
| 102 | R2ModellIndex | 13 | 0 | 511 |
| 27 | R1Volume | 51 | 0 | 127 |
| 262 | BlenderAmount | -64 | -64 | 63 |
| 268 | SlicerDepth | 25 | 0 | 127 |
| 269 | SlicerRate | 17 | 0 | 200 |
| 429 | SlicerSwitchBackup | 0 | 0 | 2 |
| 433 | SoundMFXDelayLTime | 250 | 0 | 1000 |
| 434 | SoundMFXDelayRTime | 500 | 0 | 1000 |
| 444 | SoundMFXRevSpeed | 60 | 0 | 200 |

Todos dentro de rango.

### 2.5 Coherencia de grupos

- `SoundHeader`: índices 0..5 (6 parámetros).
- `SoundName`: índices 6..21 (16 parámetros).
- `R1`: índice 22..210 (R1 + R2 -> 109+109).
- `R2`: índice 102..240.
- `Synth`: 190 parámetros (incluye SlicerSwitchBackup en 429).
- `SoundMFX`: 15 parámetros (430..444).

El preset 001 tiene las 15 líneas finales dentro de `SoundMFX` y en orden coherente con la tabla.

### 2.6 Ítems especiales observados

- **SlicerSwitchBackup** (índice 429) está presente en el preset 001.
- `SoundNameC00..C15` en 001: `77,121,115,116,32,32,...` = `Whst` + espacios; dentro del rango de tabla 32..122.
- `R1ModellIndex=336`, `R2ModellIndex=13`: índices de modelo dentro de rango 0..511.
- `BlenderAmount=-64`: valor en el mínimo del rango de tabla.
- `SlicerDepth=25`, `SlicerRate=17`, `SlicerWaveForm=0`: coherente con tipo 2 (`SlicerSwitchType=2`).
- Grupo `Synth` incluye `SlicerSwitchBackup`; el preset lo incluye correctamente.

## 3) Fuentes `NeutrinoObjects`

### 3.1 Imagen actual de la búsqueda local

- No existe carpeta `NeutrinoObjects` ni fichero con ese nombre en los árboles revisados.
- Búsquedas recursivas en:
  - `C:\Users\ajaba\Downloads\Neuron`
  - `C:\Users\ajaba\Downloads\Neuron\NeuronVS_preset_format`
  - `C:\Users\ajaba\Downloads\Neuron\NeuronVS_neurondb`
  - `C:\Users\ajaba\Downloads\Neuron\NeuronVS-classes` (si existiera como carpeta de fuentes de modelo)
  - `C:\Users\ajaba\Downloads\Neuron\NeuronVS_decompiled`
  - `C:\Users\ajaba\Downloads\Neuron\Hartmann Music`
- Resultado: **0 hit** para `NeutrinoObject` en nombre o camino.

### 3.2 Qué existe en su lugar

- Carpetas de sonido: `Sounds/NNN.sound/` con `sound.script` + opcionalmente `sound.stickrec`.
- Modelo único instalado: `Models/511.model/` con `MName`, `map.script`, `000001.scape`, `000001.sphere`.
- Esquema documentado en `NeuronVS_preset_format/preset_schema.csv` (445 parámetros).
- Documentación del formato (`.scape`/`.sphere`) en `NeuronVS_neurondb/SCAPE_SPHERE.md`.
- No se encontró fuente de "objetos neutrón" como carpeta con esos nombres; la fuente real de sonido/modelo es la estructura de `NeuronDB`.

### 3.3 Conclusión sobre la "entrada no abstracta"

- La entrada real no es una carpeta `NeutrinoObjects`; está constituida por:
  - `sound.script` de preset (texto, 445 líneas, CRLF, `Clave\tvalor`).
  - modelo 511 con `map.script` y sus dos binarios `.scape`/`.sphere`.
- Para lo que toca el preset, la forma "no abstracta" es directamente `sound.script`.

## 4) Notas de verificación

- Preset 001 existe físicamente en la ruta indicada.
- 445 líneas en fichero, 445 en tabla: coinciden.
- Orden de clave en fichero coincide con tabla en cabeza, centro (R1/R2) y cola (SoundMFX).
- Valores revisados del preset dentro de rangos tabla.
- Diferencia observada: `SoundNumVoices=8` es un valor típico (8 en 235 presets), pero no es el mínimo ni el máximo.
- `SlicerSwitchBackup` presente en 001 aunque faltara en el esquema en 3 presets (011, 012, 023); en 001 sí aparece.

## 5) Pendientes documentados

- Confirmar si existe documento externo que mencione `NeutrinoObjects` fuera de la copia local; hasta ahora no está en disco aquí.
- Si se quiere otra preset como muestra, elegir un id y revisar su `sound.script` en igualdad de condiciones.
