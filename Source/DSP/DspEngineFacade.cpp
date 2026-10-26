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
    voicePool_.setSampleRate(sampleRate_);
    blockRenderer_.prepare(sampleRate_, maxBlockSize_);
}

void DspEngineFacade::reset() {
    voicePool_.reset();
    blockRenderer_.reset();
    activeVoices_ = 0;
}

void DspEngineFacade::noteOn(uint8_t note, float velocity) {
    const auto& r1Zone = bankAdapter_.getZone(0, note);
    const auto& r2Zone = bankAdapter_.getZone(1, note);
    voicePool_.noteOn(note, velocity, r1Zone, r2Zone, 1.0f);
    activeVoices_ = voicePool_.getActiveVoiceCount();
}

void DspEngineFacade::noteOff(uint8_t note) {
    voicePool_.noteOff(note);
    activeVoices_ = voicePool_.getActiveVoiceCount();
}

void DspEngineFacade::allNotesOff() {
    voicePool_.allNotesOff();
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
    if (leftChannel == nullptr || numSamples == 0) return;

    // 1. Obtener parámetros del store
    // BlenderAmount (p[262]): rango -64..63 -> normalizado 0..1
    float blenderRaw = store_.getRawValue(262);
    float blenderNorm = std::clamp((blenderRaw + 64.0f) / 127.0f, 0.0f, 1.0f);

    // FilterFreq (p[274]): rango 0..127 -> mapeo exponencial de corte (40 Hz .. 18 kHz)
    float filterRaw = store_.getRawValue(274);
    float cutoffHz = 40.0f * std::pow(450.0f, std::clamp(filterRaw / 127.0f, 0.0f, 1.0f));

    // FilterReso (p[275]): rango 0..127 -> 0..0.95
    float resoRaw = store_.getRawValue(275);
    float resonance = std::clamp(resoRaw / 135.0f, 0.0f, 0.95f);

    // 2. Renderizar a través del orquestador de bloques de 128 muestras (FUN_100382b0)
    blockRenderer_.process(leftChannel, rightChannel, numSamples,
                          voicePool_, blenderNorm, cutoffHz, resonance, 0.80f);

    // 3. Telemetría
    activeVoices_ = voicePool_.getActiveVoiceCount();
    cpuUsage_ = activeVoices_ > 0 ? (0.015f * static_cast<float>(activeVoices_)) : 0.002f;
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
