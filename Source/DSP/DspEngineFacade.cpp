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

    // 1. Resynator 1 & 2: Capas L1, L2, L3 (Scape y Sphere coordinates)
    // R1:
    voicePool_.updateVoiceLayerParams(0, 0,
        store_.getNormalizedValue(52), store_.getNormalizedValue(53),
        store_.getNormalizedValue(42), store_.getNormalizedValue(43), 1.0f);
    voicePool_.updateVoiceLayerParams(0, 1,
        store_.getNormalizedValue(72), store_.getNormalizedValue(73),
        store_.getNormalizedValue(62), store_.getNormalizedValue(63), 0.85f);
    voicePool_.updateVoiceLayerParams(0, 2,
        store_.getNormalizedValue(92), store_.getNormalizedValue(93),
        store_.getNormalizedValue(82), store_.getNormalizedValue(83), 0.70f);

    // R2:
    voicePool_.updateVoiceLayerParams(1, 0,
        store_.getNormalizedValue(132), store_.getNormalizedValue(133),
        store_.getNormalizedValue(122), store_.getNormalizedValue(123), 1.0f);
    voicePool_.updateVoiceLayerParams(1, 1,
        store_.getNormalizedValue(152), store_.getNormalizedValue(153),
        store_.getNormalizedValue(142), store_.getNormalizedValue(143), 0.85f);
    voicePool_.updateVoiceLayerParams(1, 2,
        store_.getNormalizedValue(172), store_.getNormalizedValue(173),
        store_.getNormalizedValue(162), store_.getNormalizedValue(163), 0.70f);

    // 2. Algoritmos Parset (FUN_10031d30)
    int r1Parset = static_cast<int>(store_.getRawValue(24));
    int r2Parset = static_cast<int>(store_.getRawValue(104));
    voicePool_.updateVoiceParset(0, r1Parset);
    voicePool_.updateVoiceParset(1, r2Parset);

    // 3. Afinación y volumen de resonadores
    int r1Oct = static_cast<int>(store_.getRawValue(33));
    int r1Semi = static_cast<int>(store_.getRawValue(34));
    float r1Cents = store_.getRawValue(35);
    voicePool_.updateVoiceTuning(0, r1Oct, r1Semi, r1Cents);
    voicePool_.updateVoiceVolume(0, store_.getNormalizedValue(27) * 1.2f);

    int r2Oct = static_cast<int>(store_.getRawValue(113));
    int r2Semi = static_cast<int>(store_.getRawValue(114));
    float r2Cents = store_.getRawValue(115);
    voicePool_.updateVoiceTuning(1, r2Oct, r2Semi, r2Cents);
    voicePool_.updateVoiceVolume(1, store_.getNormalizedValue(107) * 1.2f);

    // 4. Envolventes de amplitud y filtro
    float aMs = 5.0f + store_.getNormalizedValue(200) * 4000.0f;
    float dMs = 10.0f + store_.getNormalizedValue(201) * 8000.0f;
    float sLvl = store_.getNormalizedValue(202);
    float rMs = 10.0f + store_.getNormalizedValue(203) * 6000.0f;
    voicePool_.updateVoiceEnvelopes(aMs, dMs, sLvl, rMs);

    // 5. Blender & Slicer (Los 10 algoritmos de fusión y modulación rítmica 2D/3D)
    float blenderRaw = store_.getRawValue(262);
    float blenderNorm = std::clamp((blenderRaw + 64.0f) / 127.0f, 0.0f, 1.0f);
    int blenderType = static_cast<int>(store_.getRawValue(261));

    int slicerType = static_cast<int>(store_.getRawValue(267));
    float slicerDepthRaw = store_.getRawValue(268);
    float slicerDepth = std::clamp(slicerDepthRaw / 127.0f, 0.0f, 1.0f);
    float slicerRateRaw = store_.getRawValue(269);
    float slicerRateHz = 0.2f + (std::clamp(slicerRateRaw, 0.0f, 200.0f) / 200.0f) * 20.0f;
    int slicerWave = static_cast<int>(store_.getRawValue(270));

    // 6. Configuración del Silver Rack (Filtro, Freq FX, Time FX)
    float filterRaw = store_.getRawValue(274);
    float cutoffHz = 40.0f * std::pow(450.0f, std::clamp(filterRaw / 127.0f, 0.0f, 1.0f));
    float resoRaw = store_.getRawValue(275);
    float resonance = std::clamp(resoRaw / 135.0f, 0.0f, 0.95f);
    int filterType = static_cast<int>(store_.getRawValue(273));

    auto& silver = blockRenderer_.getSilverRack();
    silver.setFilter(static_cast<abd::dsp::neuron::SilverFilter::Mode>(std::clamp(filterType, 0, 4)),
                     cutoffHz, resonance, 0.2f);

    int freqFxAlgo = (store_.getRawValue(281) > 0.5f) ? static_cast<int>(store_.getRawValue(282)) : 0;
    silver.setFreqFX(freqFxAlgo, 0.5f, 0.5f, 0.45f);

    int timeFxAlgo = (store_.getRawValue(327) > 0.5f) ? static_cast<int>(store_.getRawValue(328)) : 0;
    silver.setTimeFX(timeFxAlgo, 0.35f, 0.30f, 0.40f);

    // 7. Master volume
    float masterVol = 0.85f;

    // 8. Renderizar bloques de 128 muestras (FUN_100382b0)
    blockRenderer_.process(leftChannel, rightChannel, numSamples,
                          voicePool_, blenderNorm, blenderType, slicerType,
                          slicerDepth, slicerRateHz, slicerWave,
                          cutoffHz, resonance, masterVol);

    // 9. Telemetría y picos
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
