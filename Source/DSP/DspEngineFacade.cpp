// ============================================================================
// ABDAxionikVS — DspEngineFacade.cpp
// Implementación de la fachada desacoplada del motor DSP de ABDAxionikVS
// ============================================================================

#include "DspEngineFacade.h"
#include <cmath>
#include <algorithm>

namespace abd::axionik {

DspEngineFacade::DspEngineFacade() {
    bridge_ = std::make_unique<ParameterEngineBridge>(store_);
    // Aplicar valores por defecto y traducir inicialmente al motor
    store_.notifyAll();
}

DspEngineFacade::~DspEngineFacade() = default;

void DspEngineFacade::prepare(double sampleRate, size_t maxBlockSize) {
    sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
    maxBlockSize_ = maxBlockSize > 0 ? maxBlockSize : 512;
}

void DspEngineFacade::reset() {
    activeVoices_ = 0;
}

void DspEngineFacade::noteOn(uint8_t note, float velocity) {
    (void)note;
    (void)velocity;
    activeVoices_ = std::min(activeVoices_ + 1, 12u);
}

void DspEngineFacade::noteOff(uint8_t note) {
    (void)note;
    if (activeVoices_ > 0) --activeVoices_;
}

void DspEngineFacade::allNotesOff() {
    activeVoices_ = 0;
}

void DspEngineFacade::setParam(uint32_t index, float rawValue) {
    store_.setRawValue(index, rawValue);
}

void DspEngineFacade::setParamNormalized(uint32_t index, float normalizedValue) {
    store_.setNormalizedValue(index, normalizedValue);
}

bool DspEngineFacade::loadModel(int slot, const std::filesystem::path& modelFolder) {
    if (!bridge_) return false;
    return bankAdapter_.loadModel(slot, modelFolder, bridge_->getEngineState());
}

void DspEngineFacade::process(float* leftChannel, float* rightChannel, size_t numSamples) {
    if (leftChannel == nullptr) return;

    // Silencio mientras se integran las 87 funciones del render
    std::fill_n(leftChannel, numSamples, 0.0f);
    if (rightChannel != nullptr && rightChannel != leftChannel) {
        std::fill_n(rightChannel, numSamples, 0.0f);
    }

    cpuUsage_ = 0.005f;
}

Telemetry DspEngineFacade::getTelemetry() const noexcept {
    Telemetry t;
    t.cpuUsage = cpuUsage_;
    t.activeVoices = activeVoices_;
    t.peakL = 0.0f;
    t.peakR = 0.0f;
    return t;
}

} // namespace abd::axionik
