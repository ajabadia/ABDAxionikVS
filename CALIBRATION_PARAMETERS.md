# ABDAxionikVS — Parámetros de Calibración DSP y Valores Mágicos (`AxionikCalibrationConfig.h`)

Este documento cataloga todos los valores mágicos extraídos del motor de síntesis neuronal de **ABDAxionikVS** (Hartmann Neuron / NeuronVS Mac v1.56) hacia el fichero de configuración centralizado [`Source/DSP/AxionikCalibrationConfig.h`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/Source/DSP/AxionikCalibrationConfig.h) y su homólogo en la interfaz web [`WebUI/src/ui/calibrationContracts.ts`](file:///d:/desarrollos/ABDSynths/ABDAxionikVS/WebUI/src/ui/calibrationContracts.ts).

Todos los valores por defecto corresponden a las constantes exactas de ingeniería inversa de `NeuronVS.dll` (`.rdata` `0x1030a000..0x1030d000`) y a las correcciones de la versión Mac v1.56 de Stephan Bernsee.

---

## 1. GENERAL & ENGINE (Motor y Bus Global)

| ID | Nombre Legible | Defecto | Rango (Min..Max) | Unidad | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `masterVolume` | **Master Output Gain** | `0.85` | `0.10 .. 2.00` | `x` | Ganancia maestra de salida previa al limitador final del motor. |
| `antiPopRampMs` | **Anti-Pop Crossfade Ramp** | `2.0` | `0.0 .. 25.0` | `ms` | Tiempo de rampa anti-clicks al cambiar de preset o modelo (corrección Mac v1.56 de Stephan Bernsee). |
| `a4ReferenceHz` | **Master A4 Tuning Reference** | `440.0` | `415.0 .. 466.0` | `Hz` | Frecuencia de referencia para la nota MIDI 69 (La4) en el cálculo de paso de fase de voces. |
| `maxPolyphonyVoices` | **Max Active Polyphony** | `12` | `1 .. 16` | `voices` | Límite máximo de voces simultáneas activas antes de aplicar robo de voz a la más antigua. |
| `oracleClipToZeroMode` | **Oracle Clip-To-Zero Mode** | `0` | `0 .. 1` | `mode` | Modo de recorte de bus: `0` = saturación limpia `[-1..+1]`, `1` = comportamiento legado `0x1000bc40` (anula muestras fuera de rango). |
| `lfoMinRateHz` | **Global LFO Min Frequency** | `0.05` | `0.01 .. 1.00` | `Hz` | Frecuencia mínima de oscilación cuando el control de velocidad del LFO global está al mínimo. |
| `lfoMaxRateSpanHz` | **Global LFO Max Frequency Span** | `24.95` | `5.0 .. 80.0` | `Hz` | Excursión máxima de frecuencia del LFO global cuando el control Rate está al máximo (127). |

---

## 2. RESYNATOR (SCAPE & SPHERE)

| ID | Nombre Legible | Defecto | Rango (Min..Max) | Unidad | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `scapeCycleSamples` | **Scape Canonical Cycle Length** | `100.0` | `25.0 .. 400.0` | `smp` | Número canónico de muestras por ciclo base del oscilador neuronal Scape (`NeuronVoice.h`). |
| `scapeMinPeakFloor` | **Scape Peak Normalization Floor** | `1500.0` | `200.0 .. 16384.0` | `int16` | Piso mínimo de normalización dinámica de pico para tablas `.scape` (evita sobremodulación de +36 dB en el modelo 511). |
| `scapeHfEmphasis` | **Scape HF Differentiator Gain** | `2.0` | `0.0 .. 4.0` | `x` | Coeficiente del filtro diferenciador de énfasis de altas frecuencias canónico del Scape (`FUN_100317b0`). |
| `sphereGainMin` | **Sphere Formant Min Gain** | `0.15` | `0.00 .. 0.80` | `x` | Límite inferior de ganancia formántica por banda del procesador espectral Sphere (`FUN_10031950`). |
| `sphereGainMax` | **Sphere Formant Max Gain** | `1.25` | `0.50 .. 3.00` | `x` | Límite superior de ganancia formántica por banda del procesador espectral Sphere (`FUN_10031950`). |
| `sphereBodyGainScale` | **Sphere 1024-Partial Body Scale** | `0.50` | `0.00 .. 2.00` | `x` | Escala de ganancia de la tabla de síntesis aditiva de 1024 parciales de Sphere (`FUN_1002e750`). |
| `scapeBodyMixRatio` | **Sphere Additive Body Mix Ratio** | `0.10` | `0.00 .. 0.50` | `ratio` | Proporción de mezcla de la tabla de cuerpo aditivo Sphere frente a la onda Scape por capa. |
| `parsetExcitationScale` | **Parset 3-Layer Excitation Scale** | `0.65` | `0.15 .. 1.50` | `x` | Factor de headroom al sumar las 3 capas (`L1+L2+L3`) antes de entrar al resonador Parset (`FUN_1002e7a0`). |
| `layer2BaseLevel` | **Resynator Layer 2 Base Level** | `0.85` | `0.00 .. 1.50` | `x` | Nivel base relativo de la segunda capa armónica (`L2`) en cada Resynator. |
| `layer3BaseLevel` | **Resynator Layer 3 Base Level** | `0.70` | `0.00 .. 1.50` | `x` | Nivel base relativo de la tercera capa armónica (`L3`) en cada Resynator. |
| `modelSizeOffsetCents` | **Model Size Pitch Offset Span** | `50.0` | `0.0 .. 200.0` | `cents` | Desplazamiento máximo de afinación inducido por el parámetro `ModelSizeOffset` de R1/R2. |
| `pitchLfoMaxCents` | **Pitch LFO Vibrato Max Depth** | `100.0` | `10.0 .. 600.0` | `cents` | Profundidad máxima de vibrato en cents aplicada por el LFO sobre el tono de cada Resynator. |

---

## 3. BLENDER & SLICER

| ID | Nombre Legible | Defecto | Rango (Min..Max) | Unidad | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `crossmorphIntermodGain` | **Crossmorph Intermod Gain** | `0.25` | `0.00 .. 1.00` | `x` | Coeficiente de intermodulación armónica (`R1 * R2`) en el algoritmo Blender Crossmorph (Modo 3). |
| `intermorphSineGain` | **Intermorph Sine Folder Gain** | `0.35` | `0.00 .. 1.00` | `x` | Ganancia de plegado diferencial senoidal en el algoritmo Blender Intermorph (Modo 4). |
| `dynTranssphereEnvSens` | **Dyn Transsphere Env Sensitivity** | `0.40` | `0.00 .. 1.00` | `x` | Sensibilidad del cruce espectral al nivel de envolvente en Dyn Transsphere (Modo 5). |
| `dynCrossmorphIntermod` | **Dyn Crossmorph Env Intermod** | `0.30` | `0.00 .. 1.00` | `x` | Ganancia de intermodulación gobernada por envolvente en Dyn Crossmorph (Modo 6). |
| `ringBlendGain` | **Ring Blend Modulation Gain** | `2.20` | `0.50 .. 5.00` | `x` | Ganancia del producto en anillo (`R1 * R2`) en el modo Ring Blend (Modo 9). |
| `slicerMaxDelaySamples` | **3D Slicer Max Comb Delay** | `2500.0` | `250.0 .. 4000.0` | `smp` | Retardo máximo en muestras de la línea de peine del Slicer 3D Global (`FUN_100295d0`, `_DAT_1030b3c4`). |

---

## 4. SHAPERS & ENVELOPES

| ID | Nombre Legible | Defecto | Rango (Min..Max) | Unidad | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `envMaxTimeSeconds` | **ADSR Max Stage Duration** | `20.0` | `2.0 .. 60.0` | `s` | Tiempo máximo en segundos de una etapa ADSR cuando el parámetro normalizado vale 1.0 (`FUN_10040550`). |
| `envDecayExpRate` | **ADSR Decay RC Time Constant** | `3.5` | `1.0 .. 8.0` | `RC` | Constante de curvatura exponencial de descarga en la etapa Decay: `exp(-RC / decaySamples)`. |
| `envReleaseExpRate` | **ADSR Release RC Time Constant** | `4.6` | `1.0 .. 10.0` | `RC` | Constante de caída exponencial en la etapa Release (`4.6` equivale a -60 dB al completar el tiempo). |
| `envSilenceThreshold` | **Voice Silence Cutoff Floor** | `0.0005` | `0.0001 .. 0.0100` | `lvl` | Umbral de amplitud por debajo del cual se da por finalizada la etapa Release y se libera la voz. |
| `freeEnvCoordModScale` | **FreeEnv Scape/Sphere Depth** | `0.35` | `0.05 .. 1.00` | `x` | Escala de modulación de coordenadas Scape/Sphere aplicada por la envolvente libre 4L/4T. |
| `freeEnvPitchSemitones` | **FreeEnv Pitch Mod Span** | `12.0` | `1.0 .. 36.0` | `st` | Rango máximo en semitonos cuando la envolvente libre 4L/4T modula el tono del Resynator. |

---

## 5. SILVER FILTER

| ID | Nombre Legible | Defecto | Rango (Min..Max) | Unidad | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `filterMinCutoffHz` | **Silver Filter Min Cutoff** | `20.0` | `5.0 .. 100.0` | `Hz` | Frecuencia de corte base mínima del filtro Silver cuando el control Cutoff está a cero. |
| `filterCutoffExpRatio` | **Silver Filter Sweep Ratio** | `900.0` | `100.0 .. 1100.0` | `ratio` | Factor exponencial del barrido de frecuencia del filtro Silver (`f = minHz * ratio^norm`, `FUN_10021c90`). |
| `filterMaxResonance` | **Silver Filter Resonance Ceiling** | `0.95` | `0.50 .. 1.00` | `Q` | Techo de seguridad de resonancia del filtro Silver para evitar auto-oscilación inestable. |
| `filterLp24FeedbackK` | **24dB Ladder Feedback Coeff K** | `2.208` | `1.000 .. 3.200` | `K` | Constante polinómica K de realimentación resonante de la escalera de 5 polos 24dB LP (`_DAT_1030a054`). |
| `filterLp24PoleGain` | **24dB Ladder Cascade Gain** | `100.0` | `20.0 .. 250.0` | `x` | Multiplicador de pendiente de los 5 polos en cascada del filtro 24dB LP (`_DAT_1030a068`). |
| `filterSvfMaxHz` | **12dB Chamberlin SVF Freq Scale** | `8820.0` | `2000.0 .. 16000.0` | `Hz` | Constante cuadrática de frecuencia de los modos 12dB LP y Band-Pass Chamberlin SVF (`_DAT_1030a078`). |

---

## 6. SILVER & MASTER FX

| ID | Nombre Legible | Defecto | Rango (Min..Max) | Unidad | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `masterInputBusScale` | **Master Bus Input Headroom Scale** | `0.58` | `0.20 .. 1.20` | `x` | Factor de escala de entrada a la etapa maestra (`FUN_100382b0`, `_DAT_1030cecc`) previo al realce estéreo. |
| `masterBassTiltGain` | **Master Stereo Bass Tilt Gain** | `5.0` | `0.0 .. 10.0` | `x` | Ganancia del filtro de 2 polos de refuerzo de graves con mezcla cruzada en la salida maestra (`_DAT_1030cdf8`). |
| `masterTrebleTiltGain` | **Master Stereo Air/HF Tilt Gain** | `3.0` | `0.0 .. 8.0` | `x` | Ganancia del diferenciador de 2º orden de brillo estéreo en la etapa de salida maestra (`_DAT_1030cde8`). |
| `masterSoftKneeThresh` | **Master Soft-Knee Threshold** | `0.40` | `0.15 .. 0.85` | `lvl` | Umbral lineal antes de iniciar la compresión de rodilla suave maestra (`FUN_1003b930`). |
| `masterSoftKneeRatio` | **Master Soft-Knee Ratio** | `0.75` | `0.10 .. 0.95` | `ratio` | Pendiente de compresión por encima del umbral en el saturador maestro (`FUN_1003b930`). |
| `masterReverbFdnBlend` | **Master Reverb FDN / Schroeder Mix** | `0.55` | `0.00 .. 1.00` | `ratio` | Balance interno de la Reverb maestra entre la matriz densa 8x8 Householder FDN y las reflexiones Schroeder. |

