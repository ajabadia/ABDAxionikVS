#pragma once

#include <array>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string_view>

namespace axionik::dsp {

/**
 * Metadata descriptor for a single DSP Calibration / Magic Number parameter.
 * Mirrors and improves the ABDJUNiO601 CalibrationParam pattern in pure C++20.
 */
struct CalibrationParamMeta {
    const char* id;
    const char* label;
    const char* category;
    const char* unit;
    const char* description;
    float defaultValue;
    float minValue;
    float maxValue;
    float stepSize;
    bool isInteger;
};

/**
 * Centralized struct holding all DSP magic numbers for ABDAxionikVS.
 * Every default value matches the exact reverse-engineered constant from
 * NeuronVS.dll / Mac v1.56 so factory sound parity is 100% preserved.
 */
struct AxionikCalibrationConfig {
    // -------------------------------------------------------------------------
    // 1. GENERAL & ENGINE
    // -------------------------------------------------------------------------
    float masterVolume          = 0.85f;    // Pre-limiter master output gain
    float antiPopRampMs         = 2.0f;     // Mac v1.56 anti-pop crossfade ramp (ms)
    float a4ReferenceHz         = 440.0f;   // MIDI Note 69 pitch reference (Hz)
    float maxPolyphonyVoices    = 12.0f;    // Maximum simultaneous active voices (1..16)
    float oracleClipToZeroMode  = 0.0f;     // 0 = Clean Clamp [-1..+1], 1 = Legacy Zero-Clip (0x1000bc40)
    float lfoMinRateHz          = 0.05f;    // Global LFO minimum rate (Hz)
    float lfoMaxRateSpanHz      = 24.95f;   // Global LFO frequency span (Hz)

    // -------------------------------------------------------------------------
    // 2. RESYNATOR (SCAPE & SPHERE)
    // -------------------------------------------------------------------------
    float scapeCycleSamples     = 100.0f;   // Canonical samples per Scape oscillator cycle (NeuronVoice.h:60)
    float scapeMinPeakFloor     = 1500.0f;  // Dynamic peak normalization floor for .scape int16 tables
    float scapeHfEmphasis       = 2.0f;     // First-order HF emphasis differentiator gain (FUN_100317b0)
    float sphereGainMin         = 0.15f;    // Minimum formant band gain in Sphere (FUN_10031950)
    float sphereGainMax         = 1.25f;    // Maximum formant band gain in Sphere (FUN_10031950)
    float sphereBodyGainScale   = 0.50f;    // 1024-partial additive body table gain scale (FUN_1002e750)
    float scapeBodyMixRatio     = 0.10f;    // Additive Sphere body mix ratio vs Scape wave (0.10 = 90% Scape / 10% Body)
    float parsetExcitationScale = 0.65f;    // 3-layer sum headroom scale entering Parset resonator (FUN_1002e7a0)
    float layer2BaseLevel       = 0.85f;    // Resynator Layer 2 relative base level
    float layer3BaseLevel       = 0.70f;    // Resynator Layer 3 relative base level
    float modelSizeOffsetCents  = 50.0f;    // Max pitch offset induced by ModelSizeOffset (cents)
    float pitchLfoMaxCents      = 100.0f;   // Max vibrato depth from Global LFO on R1/R2 pitch (cents)

    // -------------------------------------------------------------------------
    // 3. BLENDER & SLICER
    // -------------------------------------------------------------------------
    float crossmorphIntermodGain = 0.25f;   // Crossmorph (Mode 3) harmonic intermodulation (s1*s2) gain
    float intermorphSineGain     = 0.35f;   // Intermorph (Mode 4) differential sine wavefolder gain
    float dynTranssphereEnvSens  = 0.40f;   // Dyn Transsphere (Mode 5) envelope sensitivity
    float dynCrossmorphIntermod  = 0.30f;   // Dyn Crossmorph (Mode 6) envelope-controlled intermod gain
    float ringBlendGain          = 2.20f;   // Ring Blend (Mode 9) ring modulation (s1*s2) gain
    float slicerMaxDelaySamples  = 2500.0f; // Global 3D Slicer maximum comb delay (samples, _DAT_1030b3c4)

    // -------------------------------------------------------------------------
    // 4. SHAPERS & ENVELOPES
    // -------------------------------------------------------------------------
    float envMaxTimeSeconds       = 20.0f;   // Maximum ADSR stage duration at norm=1.0 (FUN_10040550)
    float envDecayExpRate         = 3.5f;    // RC exponential decay rate constant exp(-rate / samples)
    float envReleaseExpRate       = 4.6f;    // RC exponential release rate constant (-60dB floor)
    float envSilenceThreshold     = 0.0005f; // Voice release/decay cutoff threshold
    float freeEnvCoordModScale    = 0.35f;   // Free 4L/4T Envelope modulation depth on Scape/Sphere X/Y
    float freeEnvPitchSemitones   = 12.0f;   // Free 4L/4T Envelope max pitch modulation range (semitones)

    // -------------------------------------------------------------------------
    // 5. SILVER FILTER
    // -------------------------------------------------------------------------
    float filterMinCutoffHz       = 20.0f;   // Silver Filter minimum cutoff frequency (Hz)
    float filterCutoffExpRatio    = 900.0f;  // Silver Filter exponential sweep ratio (20 * ratio^norm)
    float filterMaxResonance      = 0.95f;   // Silver Filter resonance safety ceiling before runaway
    float filterLp24FeedbackK     = 2.208f;  // 5-pole 24dB Ladder resonance feedback polynomial K (_DAT_1030a054)
    float filterLp24PoleGain      = 100.0f;  // 5-pole 24dB Ladder cascade slope multiplier (_DAT_1030a068)
    float filterSvfMaxHz          = 8820.0f; // 12dB Chamberlin SVF quadratic frequency constant (_DAT_1030a078)

    // -------------------------------------------------------------------------
    // 6. SILVER & MASTER FX
    // -------------------------------------------------------------------------
    float masterInputBusScale     = 0.58f;   // Master Output Stage input headroom scale (_DAT_1030cecc)
    float masterBassTiltGain      = 5.0f;    // Master Output Stage 2-pole stereo bass boost (_DAT_1030cdf8)
    float masterTrebleTiltGain    = 3.0f;    // Master Output Stage 2nd-order HF air boost (_DAT_1030cde8)
    float masterSoftKneeThresh    = 0.40f;   // Master Output soft-knee saturator threshold (FUN_1003b930)
    float masterSoftKneeRatio     = 0.75f;   // Master Output soft-knee compression ratio (FUN_1003b930)
    float masterReverbFdnBlend    = 0.55f;   // Master Reverb balance between 8x8 FDN tail and Schroeder early reflections

    static constexpr size_t kParamCount = 43;

    static const std::array<CalibrationParamMeta, kParamCount>& getRegistry() noexcept {
        static constexpr std::array<CalibrationParamMeta, kParamCount> kRegistry = {{
            // 1. GENERAL & ENGINE
            { "masterVolume", "Master Output Gain", "GENERAL & ENGINE", "x",
              "Ganancia maestra de salida previa al limitador final del motor.",
              0.85f, 0.10f, 2.00f, 0.01f, false },
            { "antiPopRampMs", "Anti-Pop Crossfade Ramp", "GENERAL & ENGINE", "ms",
              "Tiempo de rampa anti-clicks al cambiar de preset o modelo (corrección Mac v1.56 de Stephan Bernsee).",
              2.0f, 0.0f, 25.0f, 0.5f, false },
            { "a4ReferenceHz", "Master A4 Tuning Reference", "GENERAL & ENGINE", "Hz",
              "Frecuencia de referencia para la nota MIDI 69 (La4) en el cálculo de paso de fase de voces.",
              440.0f, 415.0f, 466.0f, 0.5f, false },
            { "maxPolyphonyVoices", "Max Active Polyphony", "GENERAL & ENGINE", "voices",
              "Límite máximo de voces simultáneas activas antes de aplicar robo de voz a la más antigua.",
              12.0f, 1.0f, 16.0f, 1.0f, true },
            { "oracleClipToZeroMode", "Oracle Clip-To-Zero Mode", "GENERAL & ENGINE", "mode",
              "Modo de recorte de bus: 0 = saturación limpia [-1..+1], 1 = comportamiento legado 0x1000bc40 (anula muestras fuera de rango).",
              0.0f, 0.0f, 1.0f, 1.0f, true },
            { "lfoMinRateHz", "Global LFO Min Frequency", "GENERAL & ENGINE", "Hz",
              "Frecuencia mínima de oscilación cuando el control de velocidad del LFO global está al mínimo.",
              0.05f, 0.01f, 1.00f, 0.01f, false },
            { "lfoMaxRateSpanHz", "Global LFO Max Frequency Span", "GENERAL & ENGINE", "Hz",
              "Excursión máxima de frecuencia del LFO global cuando el control Rate está al máximo (127).",
              24.95f, 5.0f, 80.0f, 0.05f, false },

            // 2. RESYNATOR (SCAPE & SPHERE)
            { "scapeCycleSamples", "Scape Canonical Cycle Length", "RESYNATOR (SCAPE & SPHERE)", "smp",
              "Número canónico de muestras por ciclo base del oscilador neuronal Scape (NeuronVoice.h).",
              100.0f, 25.0f, 400.0f, 1.0f, false },
            { "scapeMinPeakFloor", "Scape Peak Normalization Floor", "RESYNATOR (SCAPE & SPHERE)", "int16",
              "Piso mínimo de normalización dinámica de pico para tablas .scape (evita sobremodulación de +36 dB en el modelo 511).",
              1500.0f, 200.0f, 16384.0f, 50.0f, false },
            { "scapeHfEmphasis", "Scape HF Differentiator Gain", "RESYNATOR (SCAPE & SPHERE)", "x",
              "Coeficiente del filtro diferenciador de énfasis de altas frecuencias canónico del Scape (FUN_100317b0).",
              2.0f, 0.0f, 4.0f, 0.05f, false },
            { "sphereGainMin", "Sphere Formant Min Gain", "RESYNATOR (SCAPE & SPHERE)", "x",
              "Límite inferior de ganancia formántica por banda del procesador espectral Sphere (FUN_10031950).",
              0.15f, 0.0f, 0.80f, 0.01f, false },
            { "sphereGainMax", "Sphere Formant Max Gain", "RESYNATOR (SCAPE & SPHERE)", "x",
              "Límite superior de ganancia formántica por banda del procesador espectral Sphere (FUN_10031950).",
              1.25f, 0.50f, 3.00f, 0.05f, false },
            { "sphereBodyGainScale", "Sphere 1024-Partial Body Scale", "RESYNATOR (SCAPE & SPHERE)", "x",
              "Escala de ganancia de la tabla de síntesis aditiva de 1024 parciales de Sphere (FUN_1002e750).",
              0.50f, 0.0f, 2.00f, 0.05f, false },
            { "scapeBodyMixRatio", "Sphere Additive Body Mix Ratio", "RESYNATOR (SCAPE & SPHERE)", "ratio",
              "Proporción de mezcla de la tabla de cuerpo aditivo Sphere frente a la onda Scape por capa.",
              0.10f, 0.0f, 0.50f, 0.01f, false },
            { "parsetExcitationScale", "Parset 3-Layer Excitation Scale", "RESYNATOR (SCAPE & SPHERE)", "x",
              "Factor de headroom al sumar las 3 capas (L1+L2+L3) antes de entrar al resonador Parset (FUN_1002e7a0).",
              0.65f, 0.15f, 1.50f, 0.05f, false },
            { "layer2BaseLevel", "Resynator Layer 2 Base Level", "RESYNATOR (SCAPE & SPHERE)", "x",
              "Nivel base relativo de la segunda capa armónica (L2) en cada Resynator.",
              0.85f, 0.0f, 1.50f, 0.05f, false },
            { "layer3BaseLevel", "Resynator Layer 3 Base Level", "RESYNATOR (SCAPE & SPHERE)", "x",
              "Nivel base relativo de la tercera capa armónica (L3) en cada Resynator.",
              0.70f, 0.0f, 1.50f, 0.05f, false },
            { "modelSizeOffsetCents", "Model Size Pitch Offset Span", "RESYNATOR (SCAPE & SPHERE)", "cents",
              "Desplazamiento máximo de afinación inducido por el parámetro ModelSizeOffset de R1/R2.",
              50.0f, 0.0f, 200.0f, 5.0f, false },
            { "pitchLfoMaxCents", "Pitch LFO Vibrato Max Depth", "RESYNATOR (SCAPE & SPHERE)", "cents",
              "Profundidad máxima de vibrato en cents aplicada por el LFO sobre el tono de cada Resynator.",
              100.0f, 10.0f, 600.0f, 5.0f, false },

            // 3. BLENDER & SLICER
            { "crossmorphIntermodGain", "Crossmorph Intermod Gain", "BLENDER & SLICER", "x",
              "Coeficiente de intermodulación armónica (R1 * R2) en el algoritmo Blender Crossmorph (Modo 3).",
              0.25f, 0.0f, 1.00f, 0.05f, false },
            { "intermorphSineGain", "Intermorph Sine Folder Gain", "BLENDER & SLICER", "x",
              "Ganancia de plegado diferencial senoidal en el algoritmo Blender Intermorph (Modo 4).",
              0.35f, 0.0f, 1.00f, 0.05f, false },
            { "dynTranssphereEnvSens", "Dyn Transsphere Env Sensitivity", "BLENDER & SLICER", "x",
              "Sensibilidad del cruce espectral al nivel de envolvente en Dyn Transsphere (Modo 5).",
              0.40f, 0.0f, 1.00f, 0.05f, false },
            { "dynCrossmorphIntermod", "Dyn Crossmorph Env Intermod", "BLENDER & SLICER", "x",
              "Ganancia de intermodulación gobernada por envolvente en Dyn Crossmorph (Modo 6).",
              0.30f, 0.0f, 1.00f, 0.05f, false },
            { "ringBlendGain", "Ring Blend Modulation Gain", "BLENDER & SLICER", "x",
              "Ganancia del producto en anillo (R1 * R2) en el modo Ring Blend (Modo 9).",
              2.20f, 0.50f, 5.00f, 0.10f, false },
            { "slicerMaxDelaySamples", "3D Slicer Max Comb Delay", "BLENDER & SLICER", "smp",
              "Retardo máximo en muestras de la línea de peine del Slicer 3D Global (FUN_100295d0, _DAT_1030b3c4).",
              2500.0f, 250.0f, 4000.0f, 50.0f, false },

            // 4. SHAPERS & ENVELOPES
            { "envMaxTimeSeconds", "ADSR Max Stage Duration", "SHAPERS & ENVELOPES", "s",
              "Tiempo máximo en segundos de una etapa ADSR cuando el parámetro normalizado vale 1.0 (FUN_10040550).",
              20.0f, 2.0f, 60.0f, 1.0f, false },
            { "envDecayExpRate", "ADSR Decay RC Time Constant", "SHAPERS & ENVELOPES", "RC",
              "Constante de curvatura exponencial de descarga en la etapa Decay: exp(-RC / decaySamples).",
              3.5f, 1.0f, 8.0f, 0.1f, false },
            { "envReleaseExpRate", "ADSR Release RC Time Constant", "SHAPERS & ENVELOPES", "RC",
              "Constante de caída exponencial en la etapa Release (4.6 equivale a -60 dB al completar el tiempo).",
              4.6f, 1.0f, 10.0f, 0.1f, false },
            { "envSilenceThreshold", "Voice Silence Cutoff Floor", "SHAPERS & ENVELOPES", "lvl",
              "Umbral de amplitud por debajo del cual se da por finalizada la etapa Release y se libera la voz.",
              0.0005f, 0.0001f, 0.0100f, 0.0001f, false },
            { "freeEnvCoordModScale", "FreeEnv Scape/Sphere Depth", "SHAPERS & ENVELOPES", "x",
              "Escala de modulación de coordenadas Scape/Sphere aplicada por la envolvente libre 4L/4T.",
              0.35f, 0.05f, 1.00f, 0.05f, false },
            { "freeEnvPitchSemitones", "FreeEnv Pitch Mod Span", "SHAPERS & ENVELOPES", "st",
              "Rango máximo en semitonos cuando la envolvente libre 4L/4T modula el tono del Resynator.",
              12.0f, 1.0f, 36.0f, 1.0f, false },

            // 5. SILVER FILTER
            { "filterMinCutoffHz", "Silver Filter Min Cutoff", "SILVER FILTER", "Hz",
              "Frecuencia de corte base mínima del filtro Silver cuando el control Cutoff está a cero.",
              20.0f, 5.0f, 100.0f, 1.0f, false },
            { "filterCutoffExpRatio", "Silver Filter Sweep Ratio", "SILVER FILTER", "ratio",
              "Factor exponencial del barrido de frecuencia del filtro Silver (f = minHz * ratio^norm, FUN_10021c90).",
              900.0f, 100.0f, 1100.0f, 10.0f, false },
            { "filterMaxResonance", "Silver Filter Resonance Ceiling", "SILVER FILTER", "Q",
              "Techo de seguridad de resonancia del filtro Silver para evitar auto-oscilación inestable.",
              0.95f, 0.50f, 1.00f, 0.01f, false },
            { "filterLp24FeedbackK", "24dB Ladder Feedback Coeff K", "SILVER FILTER", "K",
              "Constante polinómica K de realimentación resonante de la escalera de 5 polos 24dB LP (_DAT_1030a054).",
              2.208f, 1.000f, 3.200f, 0.001f, false },
            { "filterLp24PoleGain", "24dB Ladder Cascade Gain", "SILVER FILTER", "x",
              "Multiplicador de pendiente de los 5 polos en cascada del filtro 24dB LP (_DAT_1030a068).",
              100.0f, 20.0f, 250.0f, 5.0f, false },
            { "filterSvfMaxHz", "12dB Chamberlin SVF Freq Scale", "SILVER FILTER", "Hz",
              "Constante cuadrática de frecuencia de los modos 12dB LP y Band-Pass Chamberlin SVF (_DAT_1030a078).",
              8820.0f, 2000.0f, 16000.0f, 100.0f, false },

            // 6. SILVER & MASTER FX
            { "masterInputBusScale", "Master Bus Input Headroom Scale", "SILVER & MASTER FX", "x",
              "Factor de escala de entrada a la etapa maestra (FUN_100382b0, _DAT_1030cecc) previo al realce estéreo.",
              0.58f, 0.20f, 1.20f, 0.02f, false },
            { "masterBassTiltGain", "Master Stereo Bass Tilt Gain", "SILVER & MASTER FX", "x",
              "Ganancia del filtro de 2 polos de refuerzo de graves con mezcla cruzada en la salida maestra (_DAT_1030cdf8).",
              5.0f, 0.0f, 10.0f, 0.25f, false },
            { "masterTrebleTiltGain", "Master Stereo Air/HF Tilt Gain", "SILVER & MASTER FX", "x",
              "Ganancia del diferenciador de 2º orden de brillo estéreo en la etapa de salida maestra (_DAT_1030cde8).",
              3.0f, 0.0f, 8.0f, 0.25f, false },
            { "masterSoftKneeThresh", "Master Soft-Knee Threshold", "SILVER & MASTER FX", "lvl",
              "Umbral lineal antes de iniciar la compresión de rodilla suave maestra (FUN_1003b930).",
              0.40f, 0.15f, 0.85f, 0.01f, false },
            { "masterSoftKneeRatio", "Master Soft-Knee Ratio", "SILVER & MASTER FX", "ratio",
              "Pendiente de compresión por encima del umbral en el saturador maestro (FUN_1003b930).",
              0.75f, 0.10f, 0.95f, 0.01f, false },
            { "masterReverbFdnBlend", "Master Reverb FDN / Schroeder Mix", "SILVER & MASTER FX", "ratio",
              "Balance interno de la Reverb maestra entre la matriz densa 8x8 Householder FDN y las reflexiones Schroeder.",
              0.55f, 0.0f, 1.00f, 0.05f, false }
        }};
        return kRegistry;
    }

    static const CalibrationParamMeta* findMeta(std::string_view id) noexcept {
        for (const auto& m : getRegistry()) {
            if (id == m.id) return &m;
        }
        return nullptr;
    }

    float* getFieldPtr(std::string_view id) noexcept {
        if (id == "masterVolume")          return &masterVolume;
        if (id == "antiPopRampMs")         return &antiPopRampMs;
        if (id == "a4ReferenceHz")         return &a4ReferenceHz;
        if (id == "maxPolyphonyVoices")    return &maxPolyphonyVoices;
        if (id == "oracleClipToZeroMode")  return &oracleClipToZeroMode;
        if (id == "lfoMinRateHz")          return &lfoMinRateHz;
        if (id == "lfoMaxRateSpanHz")      return &lfoMaxRateSpanHz;

        if (id == "scapeCycleSamples")     return &scapeCycleSamples;
        if (id == "scapeMinPeakFloor")     return &scapeMinPeakFloor;
        if (id == "scapeHfEmphasis")       return &scapeHfEmphasis;
        if (id == "sphereGainMin")         return &sphereGainMin;
        if (id == "sphereGainMax")         return &sphereGainMax;
        if (id == "sphereBodyGainScale")   return &sphereBodyGainScale;
        if (id == "scapeBodyMixRatio")     return &scapeBodyMixRatio;
        if (id == "parsetExcitationScale") return &parsetExcitationScale;
        if (id == "layer2BaseLevel")       return &layer2BaseLevel;
        if (id == "layer3BaseLevel")       return &layer3BaseLevel;
        if (id == "modelSizeOffsetCents")  return &modelSizeOffsetCents;
        if (id == "pitchLfoMaxCents")      return &pitchLfoMaxCents;

        if (id == "crossmorphIntermodGain") return &crossmorphIntermodGain;
        if (id == "intermorphSineGain")     return &intermorphSineGain;
        if (id == "dynTranssphereEnvSens")  return &dynTranssphereEnvSens;
        if (id == "dynCrossmorphIntermod")  return &dynCrossmorphIntermod;
        if (id == "ringBlendGain")          return &ringBlendGain;
        if (id == "slicerMaxDelaySamples")  return &slicerMaxDelaySamples;

        if (id == "envMaxTimeSeconds")     return &envMaxTimeSeconds;
        if (id == "envDecayExpRate")       return &envDecayExpRate;
        if (id == "envReleaseExpRate")     return &envReleaseExpRate;
        if (id == "envSilenceThreshold")   return &envSilenceThreshold;
        if (id == "freeEnvCoordModScale")  return &freeEnvCoordModScale;
        if (id == "freeEnvPitchSemitones") return &freeEnvPitchSemitones;

        if (id == "filterMinCutoffHz")     return &filterMinCutoffHz;
        if (id == "filterCutoffExpRatio")  return &filterCutoffExpRatio;
        if (id == "filterMaxResonance")    return &filterMaxResonance;
        if (id == "filterLp24FeedbackK")   return &filterLp24FeedbackK;
        if (id == "filterLp24PoleGain")    return &filterLp24PoleGain;
        if (id == "filterSvfMaxHz")        return &filterSvfMaxHz;

        if (id == "masterInputBusScale")   return &masterInputBusScale;
        if (id == "masterBassTiltGain")    return &masterBassTiltGain;
        if (id == "masterTrebleTiltGain")  return &masterTrebleTiltGain;
        if (id == "masterSoftKneeThresh")  return &masterSoftKneeThresh;
        if (id == "masterSoftKneeRatio")   return &masterSoftKneeRatio;
        if (id == "masterReverbFdnBlend")  return &masterReverbFdnBlend;

        return nullptr;
    }

    const float* getFieldPtr(std::string_view id) const noexcept {
        return const_cast<AxionikCalibrationConfig*>(this)->getFieldPtr(id);
    }

    float getValue(std::string_view id) const noexcept {
        if (const float* ptr = getFieldPtr(id)) return *ptr;
        return 0.0f;
    }

    bool setValue(std::string_view id, float value) noexcept {
        const auto* meta = findMeta(id);
        float* ptr = getFieldPtr(id);
        if (!meta || !ptr) return false;
        float clamped = std::clamp(value, meta->minValue, meta->maxValue);
        if (meta->isInteger) {
            clamped = std::round(clamped);
        }
        *ptr = clamped;
        return true;
    }

    bool resetParam(std::string_view id) noexcept {
        const auto* meta = findMeta(id);
        float* ptr = getFieldPtr(id);
        if (!meta || !ptr) return false;
        *ptr = meta->defaultValue;
        return true;
    }

    void resetAll() noexcept {
        *this = AxionikCalibrationConfig{};
    }
};

} // namespace axionik::dsp
