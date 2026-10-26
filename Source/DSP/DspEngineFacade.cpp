// ============================================================================
// ABDAxionikVS — DspEngineFacade.cpp
// Implementación de la fachada del motor DSP
// ============================================================================

#include "DspEngineFacade.h"
#include <algorithm>
#include <cmath>

namespace abd::axionik {

DspEngineFacade::DspEngineFacade() noexcept {
    // Inicializar parámetros con sus valores por defecto de la tabla autoritativa
    for (size_t i = 0; i < kNumTotalParameters; ++i) {
        rawParams_[i] = kParameterDescriptors[i].defaultValue;
    }
}

void DspEngineFacade::prepare(double sampleRate, size_t maxBlockSize) noexcept {
    sampleRate_ = (sampleRate > 8000.0) ? sampleRate : 44100.0;
    maxBlockSize_ = maxBlockSize;
    srScale_ = 44100.0 / sampleRate_;
    reset();
}

void DspEngineFacade::reset() noexcept {
    activeVoiceCount_.store(0, std::memory_order_relaxed);
    peakL_.store(0.0f, std::memory_order_relaxed);
    peakR_.store(0.0f, std::memory_order_relaxed);
}

void DspEngineFacade::noteOn(uint8_t note, float velocity) noexcept {
    // Esqueleto Fase 0: incrementa contador de voces y prepara para Fase A
    activeVoiceCount_.fetch_add(1, std::memory_order_relaxed);
}

void DspEngineFacade::noteOff(uint8_t note) noexcept {
    uint32_t current = activeVoiceCount_.load(std::memory_order_relaxed);
    if (current > 0) {
        activeVoiceCount_.fetch_sub(1, std::memory_order_relaxed);
    }
}

void DspEngineFacade::allNotesOff() noexcept {
    activeVoiceCount_.store(0, std::memory_order_relaxed);
}

void DspEngineFacade::setParam(uint32_t index, float rawValue) noexcept {
    if (index >= kNumTotalParameters) return;
    const auto& desc = kParameterDescriptors[index];
    rawParams_[index] = std::clamp(rawValue, desc.min, desc.max);
}

void DspEngineFacade::setParamNormalized(uint32_t index, float normValue) noexcept {
    if (index >= kNumTotalParameters) return;
    rawParams_[index] = normalizedToRaw(index, normValue);
}

float DspEngineFacade::getParam(uint32_t index) const noexcept {
    if (index >= kNumTotalParameters) return 0.0f;
    return rawParams_[index];
}

void DspEngineFacade::process(float* outL, float* outR, size_t numSamples) noexcept {
    if (!outL || !outR || numSamples == 0) return;

    // En Fase 0 (esqueleto funcional compilable), silenciar buffers de salida de forma determinista
    std::fill_n(outL, numSamples, 0.0f);
    std::fill_n(outR, numSamples, 0.0f);

    peakL_.store(0.0f, std::memory_order_relaxed);
    peakR_.store(0.0f, std::memory_order_relaxed);
}

Telemetry DspEngineFacade::getTelemetry() const noexcept {
    Telemetry t;
    t.cpuUsage = 0.0f;
    t.activeVoices = activeVoiceCount_.load(std::memory_order_relaxed);
    t.peakL = peakL_.load(std::memory_order_relaxed);
    t.peakR = peakR_.load(std::memory_order_relaxed);
    return t;
}

} // namespace abd::axionik
