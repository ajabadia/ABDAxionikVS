// ============================================================================
// ABDAxionikVS — DspTypes.h
// Tipos fundamentales del motor DSP (C++20 puro, ZERO dependencias de JUCE)
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <array>
#include <span>

namespace abd::axionik {

constexpr size_t kMaxVoices = 32;
constexpr size_t kDefaultPolyphony = 12;
constexpr double kLegacyBaseSampleRate = 44100.0;
constexpr size_t kLegacyInternalBlockSize = 128;

enum class OutputClipMode : uint8_t {
    LegacyZeroClip = 0, // |x*x| > 1.0 -> 0.0 (paridad bit-exacta con NeuronVS.dll para oraculo)
    CleanClamp     = 1, // std::clamp(x, -1.0f, +1.0f)
    SoftLimiter    = 2, // Saturador suave antialiasing / limitador musical
};

enum class EngineRunMode : uint8_t {
    StrictLegacyParity = 0, // Bloque 128 muestras fijo + clip-a-cero + srScale = 1.0
    EnhancedMode       = 1, // sampleFrames variable + reset de buffers + srScale dinámico
};

struct NoteOnEvent {
    uint8_t noteNumber{60};
    float velocity{0.8f};
    uint32_t sampleOffset{0};
};

struct NoteOffEvent {
    uint8_t noteNumber{60};
    uint32_t sampleOffset{0};
};

struct Telemetry {
    float cpuUsage{0.0f};
    uint32_t activeVoices{0};
    float peakL{0.0f};
    float peakR{0.0f};
};

} // namespace abd::axionik
