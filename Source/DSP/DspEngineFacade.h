// ============================================================================
// ABDAxionikVS — DspEngineFacade.h
// Fachada desacoplada del motor DSP (C++20 puro, ZERO dependencias de JUCE)
// Compartida 1:1 entre el plugin nativo y WebAssembly
// ============================================================================

#pragma once

#include "DspTypes.h"
#include "../Generated/ParameterRegistry.gen.h"
#include "../Generated/Conversion.gen.h"
#include <array>
#include <atomic>

namespace abd::axionik {

class DspEngineFacade {
public:
    DspEngineFacade() noexcept;
    ~DspEngineFacade() noexcept = default;

    // Prohibir copias
    DspEngineFacade(const DspEngineFacade&) = delete;
    DspEngineFacade& operator=(const DspEngineFacade&) = delete;

    void prepare(double sampleRate, size_t maxBlockSize) noexcept;
    void reset() noexcept;

    // Procesamiento en tiempo real (seguridad estricta: cero allocs, cero locks)
    void process(float* outL, float* outR, size_t numSamples) noexcept;

    void noteOn(uint8_t note, float velocity) noexcept;
    void noteOff(uint8_t note) noexcept;
    void allNotesOff() noexcept;

    void setParam(uint32_t index, float rawValue) noexcept;
    void setParamNormalized(uint32_t index, float normValue) noexcept;
    float getParam(uint32_t index) const noexcept;

    void setRunMode(EngineRunMode mode) noexcept { runMode_ = mode; }
    EngineRunMode getRunMode() const noexcept { return runMode_; }

    void setClipMode(OutputClipMode mode) noexcept { clipMode_ = mode; }
    OutputClipMode getClipMode() const noexcept { return clipMode_; }

    Telemetry getTelemetry() const noexcept;

private:
    double sampleRate_{44100.0};
    double srScale_{1.0};
    size_t maxBlockSize_{512};
    EngineRunMode runMode_{EngineRunMode::EnhancedMode};
    OutputClipMode clipMode_{OutputClipMode::CleanClamp};

    // Almacen plano de los 445 parametros crudos (snddat)
    std::array<float, kNumTotalParameters> rawParams_{};

    // Telemetria atomica para UI
    std::atomic<uint32_t> activeVoiceCount_{0};
    std::atomic<float> peakL_{0.0f};
    std::atomic<float> peakR_{0.0f};
};

} // namespace abd::axionik
