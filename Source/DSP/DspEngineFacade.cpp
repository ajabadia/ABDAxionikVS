// ============================================================================
// ABDAxionikVS — DspEngineFacade.cpp
// Implementación de la fachada desacoplada del motor DSP de ABDAxionikVS
// ============================================================================

#include "DspEngineFacade.h"
#include "AxionikParamIndices.h"
#include <cmath>
#include <algorithm>
#include <chrono>

namespace abd::axionik {

DspEngineFacade::DspEngineFacade() {
    bridge_ = std::make_unique<ParameterEngineBridge>(store_);
    // Inicializar con preset embebido 000 InitSound y modelo 511 (sinew)
    bankAdapter_.initDefaultModelsAndPresets(bridge_->getEngineState(), store_);
    store_.notifyAll();
}

DspEngineFacade::~DspEngineFacade() = default;

void DspEngineFacade::prepare(double sampleRate, size_t maxBlockSize) {
    sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
    maxBlockSize_ = maxBlockSize > 0 ? maxBlockSize : 512;
    antiPopTotalSamples_ = std::max(size_t(1), static_cast<size_t>(sampleRate_ * 0.002)); // 2ms rampa anti-pops
    voicePool_.setSampleRate(sampleRate_);
    blockRenderer_.prepare(sampleRate_, maxBlockSize_);
    stickPlayer_.prepare(sampleRate_);
}

void DspEngineFacade::reset() {
    voicePool_.reset();
    blockRenderer_.reset();
    stickPlayer_.reset();
    activeVoices_ = 0;
}

void DspEngineFacade::noteOn(uint8_t note, float velocity) {
    const auto& r1Zone = bankAdapter_.getZone(0, note);
    const auto& r2Zone = bankAdapter_.getZone(1, note);
    voicePool_.noteOn(note, velocity, r1Zone, r2Zone, 1.0f);
    activeVoices_ = voicePool_.getActiveVoiceCount();

    if (stickPlayer_.hasEvents() && (!stickPlayer_.isPlaying() || activeVoices_ <= 1)) {
        stickPlayer_.trigger();
    }
}

void DspEngineFacade::noteOff(uint8_t note) {
    voicePool_.noteOff(note);
    activeVoices_ = voicePool_.getActiveVoiceCount();
}

void DspEngineFacade::allNotesOff() {
    voicePool_.allNotesOff();
    stickPlayer_.stop();
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
    bool ok = bankAdapter_.loadModel(slot, modelFolder, bridge_->getEngineState());
    if (ok) {
        // Corrección Mac 1.56 (Stephan Bernsee): limpieza de estados y rampa anti-pops de 2ms
        blockRenderer_.reset();
        antiPopRemaining_ = antiPopTotalSamples_;
    }
    return ok;
}

bool DspEngineFacade::loadPreset(const std::filesystem::path& soundFolder) {
    SoundPreset preset;
    if (!NeuronSound::loadSoundFolder(soundFolder, preset)) {
        return false;
    }
    return applyPreset(preset);
}

bool DspEngineFacade::loadPresetFromScript(const std::string& scriptText) {
    SoundPreset preset;
    if (!NeuronSound::parseSoundScript(scriptText, preset)) {
        return false;
    }
    return applyPreset(preset);
}

bool DspEngineFacade::applyPreset(const SoundPreset& preset) {
    currentPreset_ = preset;
    // 1. Cargar los 445 parámetros en el almacén de configuración
    for (size_t i = 0; i < kNumTotalParameters; ++i) {
        store_.setRawValue(static_cast<uint32_t>(i), preset.values[i], false);
    }
    // 2. Disparar observadores y actualizar el motor
    store_.notifyAll();

    // 3. Cargar trayectorias vectoriales de joysticks si existen en el preset
    stickPlayer_.loadEvents(preset.stickEvents);

    // 4. Cargar los modelos vinculados en R1 y R2 si existen en la librería
    if (bridge_) {
        if (preset.r1ModelIndex >= 0) {
            bankAdapter_.loadModelBySlot(0, preset.r1ModelIndex, bridge_->getEngineState());
        }
        if (preset.r2ModelIndex >= 0) {
            bankAdapter_.loadModelBySlot(1, preset.r2ModelIndex, bridge_->getEngineState());
        }
    }

    // 5. Recentrar Pitch Bend, limpiar colas circulares (Mac 1.56) y activar rampa anti-pops de 2ms
    pitchBendWheel_ = 0.0f;
    voicePool_.updatePitchBendFactor(1.0f);
    blockRenderer_.reset();
    antiPopRemaining_ = antiPopTotalSamples_;
    return true;
}

void DspEngineFacade::processVectorSticks(size_t numSamples) {
    stickPlayer_.processBlock(numSamples, [this](uint32_t paramIdx, float rawVal) {
        store_.setRawValue(paramIdx, rawVal);
        if (onStickParamChanged_) {
            onStickParamChanged_(paramIdx, rawVal);
        }
    });
}

float DspEngineFacade::updateModulationAndPitch(const float* p, size_t numSamples) {
    using namespace abd::axionik::ParamIdx;

    // Pitch Bend: clamp semitones to [-48, +48] to avoid exponential overflow
    float pbRange = getSlotRaw(p, 2, PitchBendRange);
    if (pbRange <= 0.0f) pbRange = 2.0f;
    float semitones = std::clamp(pitchBendWheel_ * pbRange, -48.0f, 48.0f);
    float pbFactor = std::pow(2.0f, semitones / 12.0f);
    voicePool_.updatePitchBendFactor(pbFactor);

    // Voice allocation and master sound routing
    size_t maxVoices = static_cast<size_t>(std::clamp(store_.getRawValue(SoundNumVoices), 1.0f, 12.0f));
    voicePool_.setMaxActiveVoices(maxVoices);

    float soundPan = getSlotRaw(p, 0, SoundPan) / 64.0f;
    float soundPanKt = getSlotRaw(p, 1, SoundPanKeyTrack) / 64.0f;
    voicePool_.updateVoicePan(soundPan, soundPanKt);

    float r1VelSw = getSlotRaw(p, 18, R1ModelVelocitySwitch) / 127.0f;
    float r2VelSw = getSlotRaw(p, 88, R2ModelVelocitySwitch) / 127.0f;
    voicePool_.setVelocitySwitchThresholds(r1VelSw, r2VelSw);

    // Resynator enables
    bool r1On = getSlotRaw(p, 3, R1Switch) > 0.5f;
    bool r2On = getSlotRaw(p, 73, R2Switch) > 0.5f;
    voicePool_.updateResynatorEnabled(0, r1On);
    voicePool_.updateResynatorEnabled(1, r2On);

    // Global LFO calculation with symbolic table size
    constexpr double kNeuronLfoTableSize = 8192.0;
    bool lfoOn = getSlotRaw(p, 215, LFOSwitch) > 0.5f;
    float globalLfoSignal = 0.0f;
    if (lfoOn) {
        float lfoDepth = getSlotNorm(p, 216, LFODepth);
        float lfoRateNorm = getSlotRaw(p, 217, LFORate) / 1000.0f;
        float lfoRateHz = 0.05f + std::clamp(lfoRateNorm, 0.0f, 1.0f) * 24.95f;
        int lfoWave = static_cast<int>(getSlotRaw(p, 219, LFOWaveForm));
        globalLfoPhase_ += static_cast<double>(lfoRateHz) * (kNeuronLfoTableSize / sampleRate_) * static_cast<double>(numSamples);
        while (globalLfoPhase_ >= kNeuronLfoTableSize) {
            globalLfoPhase_ -= kNeuronLfoTableSize;
        }
        globalLfoSignal = abd::dsp::DspNeuronLfoTables::readInterpolated(lfoWave, globalLfoPhase_) * lfoDepth;
    }
    return globalLfoSignal;
}

void DspEngineFacade::updateResynatorLayers(const float* p, float globalLfoSignal) {
    using namespace abd::axionik::ParamIdx;

    // Resynator 1: Layers L1, L2, L3
    float r1_sc1 = getSlotNorm(p, 28, R1L1Scape1Value);
    float r1_sc2 = getSlotNorm(p, 29, R1L1Scape2Value);
    float r1_sp1 = getSlotNorm(p, 19, R1L1Sphere1Value);
    float r1_sp2 = getSlotNorm(p, 20, R1L1Sphere2Value);
    voicePool_.updateVoiceLayerParams(0, 0, r1_sc1, r1_sc2, r1_sp1, r1_sp2, 1.0f);

    float r1_l2_sc1 = getSlotNorm(p, 46, R1L2Scape1Value);
    float r1_l2_sc2 = getSlotNorm(p, 47, R1L2Scape2Value);
    float r1_l2_sp1 = getSlotNorm(p, 37, R1L2Sphere1Value);
    float r1_l2_sp2 = getSlotNorm(p, 38, R1L2Sphere2Value);
    voicePool_.updateVoiceLayerParams(0, 1, r1_l2_sc1, r1_l2_sc2, r1_l2_sp1, r1_l2_sp2, 0.85f);

    float r1_l3_sc1 = getSlotNorm(p, 64, R1L3Scape1Value);
    float r1_l3_sc2 = getSlotNorm(p, 65, R1L3Scape2Value);
    float r1_l3_sp1 = getSlotNorm(p, 55, R1L3Sphere1Value);
    float r1_l3_sp2 = getSlotNorm(p, 56, R1L3Sphere2Value);
    voicePool_.updateVoiceLayerParams(0, 2, r1_l3_sc1, r1_l3_sc2, r1_l3_sp1, r1_l3_sp2, 0.70f);

    // Resynator 2: Layers L1, L2, L3
    float r2_sc1 = getSlotNorm(p, 98, R2L1Scape1Value);
    float r2_sc2 = getSlotNorm(p, 99, R2L1Scape2Value);
    float r2_sp1 = getSlotNorm(p, 89, R2L1Sphere1Value);
    float r2_sp2 = getSlotNorm(p, 90, R2L1Sphere2Value);
    voicePool_.updateVoiceLayerParams(1, 0, r2_sc1, r2_sc2, r2_sp1, r2_sp2, 1.0f);

    float r2_l2_sc1 = getSlotNorm(p, 116, R2L2Scape1Value);
    float r2_l2_sc2 = getSlotNorm(p, 117, R2L2Scape2Value);
    float r2_l2_sp1 = getSlotNorm(p, 107, R2L2Sphere1Value);
    float r2_l2_sp2 = getSlotNorm(p, 108, R2L2Sphere2Value);
    voicePool_.updateVoiceLayerParams(1, 1, r2_l2_sc1, r2_l2_sc2, r2_l2_sp1, r2_l2_sp2, 0.85f);

    float r2_l3_sc1 = getSlotNorm(p, 134, R2L3Scape1Value);
    float r2_l3_sc2 = getSlotNorm(p, 135, R2L3Scape2Value);
    float r2_l3_sp1 = getSlotNorm(p, 125, R2L3Sphere1Value);
    float r2_l3_sp2 = getSlotNorm(p, 126, R2L3Sphere2Value);
    voicePool_.updateVoiceLayerParams(1, 2, r2_l3_sc1, r2_l3_sc2, r2_l3_sp1, r2_l3_sp2, 0.70f);

    // Parset algorithms
    int r1Parset = static_cast<int>(store_.getRawValue(R1Type));
    int r2Parset = static_cast<int>(store_.getRawValue(R2Type));
    voicePool_.updateVoiceParset(0, r1Parset);
    voicePool_.updateVoiceParset(1, r2Parset);

    // Tuning and volume
    int r1Oct = static_cast<int>(getSlotRaw(p, 10, R1Octave));
    int r1Semi = static_cast<int>(std::round(getSlotRaw(p, 11, R1Semi)));
    float r1PitchLfo = p ? p[13] : (store_.getRawValue(R1PitchLfoDepth) / 64.0f);
    float r1Cents = getSlotRaw(p, 12, R1Cents) + globalLfoSignal * r1PitchLfo * 100.0f;
    voicePool_.updateVoiceTuning(0, r1Oct, r1Semi, r1Cents);

    float r1AmpLfo = p ? p[5] : (store_.getRawValue(R1AmpLfoDepth) / 64.0f);
    float r1Vol = std::clamp(getSlotNorm(p, 4, R1Volume) * (1.0f + globalLfoSignal * r1AmpLfo * 0.5f), 0.0f, 1.5f);
    voicePool_.updateVoiceVolume(0, r1Vol);

    int r2Oct = static_cast<int>(getSlotRaw(p, 80, R2Octave));
    int r2Semi = static_cast<int>(std::round(getSlotRaw(p, 81, R2Semi)));
    float r2PitchLfo = p ? p[83] : (store_.getRawValue(R2PitchLfoDepth) / 64.0f);
    float r2Cents = getSlotRaw(p, 82, R2Cents) + globalLfoSignal * r2PitchLfo * 100.0f;
    voicePool_.updateVoiceTuning(1, r2Oct, r2Semi, r2Cents);

    float r2AmpLfo = p ? p[75] : (store_.getRawValue(R2AmpLfoDepth) / 64.0f);
    float r2Vol = std::clamp(getSlotNorm(p, 74, R2Volume) * (1.0f + globalLfoSignal * r2AmpLfo * 0.5f), 0.0f, 1.5f);
    voicePool_.updateVoiceVolume(1, r2Vol);
}

void DspEngineFacade::updateEnvelopes(const float* p) {
    using namespace abd::axionik::ParamIdx;

    float aNorm = getSlotNorm(p, 161, R1AmpEnvA);
    float dNorm = getSlotNorm(p, 162, R1AmpEnvD);
    float sLvl  = getSlotNorm(p, 163, R1AmpEnvS);
    float rNorm = getSlotNorm(p, 164, R1AmpEnvR);
    voicePool_.updateAmpEnvelope(aNorm, dNorm, sLvl, rNorm);

    float faNorm = getSlotNorm(p, 237, FilterEnvA);
    float fdNorm = getSlotNorm(p, 238, FilterEnvD);
    float fsLvl  = getSlotNorm(p, 239, FilterEnvS);
    float frNorm = getSlotNorm(p, 240, FilterEnvR);
    voicePool_.updateFilterEnvelope(faNorm, fdNorm, fsLvl, frNorm);

    // R1 ResEnv / R2 ResEnv
    float r1Ra = getSlotNorm(p, 143, R1ResEnvA);
    float r1Rd = getSlotNorm(p, 144, R1ResEnvD);
    float r1Rs = getSlotNorm(p, 145, R1ResEnvS);
    float r1Rr = getSlotNorm(p, 146, R1ResEnvR);
    voicePool_.updateResEnvelopes(0, r1Ra, r1Rd, r1Rs, r1Rr);

    float r2Ra = getSlotNorm(p, 173, R2ResEnvA);
    float r2Rd = getSlotNorm(p, 174, R2ResEnvD);
    float r2Rs = getSlotNorm(p, 175, R2ResEnvS);
    float r2Rr = getSlotNorm(p, 176, R2ResEnvR);
    voicePool_.updateResEnvelopes(1, r2Ra, r2Rd, r2Rs, r2Rr);
}

DspEngineFacade::RenderBlockParams DspEngineFacade::updateSilverAndMasterFx(const float* p, float globalLfoSignal) {
    using namespace abd::axionik::ParamIdx;
    RenderBlockParams params;

    // Blender & Slicer routing
    float blenderLfoMod = p ? p[222] : (store_.getRawValue(BlenderLfoDepth) / 64.0f);
    float blenderBase = p ? p[221] : std::clamp((store_.getRawValue(BlenderAmount) + 64.0f) / 127.0f, 0.0f, 1.0f);
    params.blenderNorm = std::clamp(blenderBase + globalLfoSignal * blenderLfoMod * 0.5f, 0.0f, 1.0f);
    params.blenderType = static_cast<int>(getSlotRaw(p, 220, BlenderType));

    params.slicerType = static_cast<int>(getSlotRaw(p, 226, SlicerSwitchType));
    params.slicerDepth = p ? p[227] : std::clamp(store_.getRawValue(SlicerDepth) / 127.0f, 0.0f, 1.0f);
    float slicerRateNorm = p ? p[228] : std::clamp(store_.getRawValue(SlicerRate) / 200.0f, 0.0f, 1.0f);
    params.slicerRateHz = std::clamp(std::pow(10.0f, slicerRateNorm * 4.0f - 2.0f), 0.01f, 100.0f);
    params.slicerWave = static_cast<int>(getSlotRaw(p, 229, SlicerWaveForm));

    // Silver Rack: Filter section
    float filterLfoMod = p ? p[233] : (store_.getRawValue(FilterLfoDepth) / 64.0f);
    float filterFreqBase = p ? p[231] : std::clamp(store_.getRawValue(FilterFreq) / 127.0f, 0.0f, 1.0f);
    float filterFreqNorm = std::clamp(filterFreqBase + globalLfoSignal * filterLfoMod * 0.5f, 0.0f, 1.0f);
    params.cutoffHz = std::clamp(20.0f * std::pow(900.0f, filterFreqNorm), 20.0f, 20000.0f);

    float filterResoNorm = p ? p[232] : std::clamp(store_.getRawValue(FilterReso) / 127.0f, 0.0f, 1.0f);
    params.resonance = std::clamp(filterResoNorm * 0.95f, 0.0f, 0.95f);

    bool silverSwitchOn = getSlotRaw(p, 244, SilverSwitch) > 0.5f;
    params.filterType = silverSwitchOn ? static_cast<int>(getSlotRaw(p, 230, FilterType)) : -1;

    params.filterEnvDepth = p ? p[242] : (store_.getRawValue(FilterEnvDepth) / 64.0f);
    params.filterKeyTrack = (p ? p[234] : (store_.getRawValue(FilterKeyTrack) / 64.0f)) * 64.0f;
    params.filterVelDepth = (p ? p[235] : (store_.getRawValue(FilterCutoffVelocityDepth) / 64.0f)) * 64.0f;

    auto& silver = blockRenderer_.getSilverRack();

    // FreqFX
    bool freqFxOn = silverSwitchOn && (getSlotRaw(p, 245, FreqFXSwitch) > 0.5f);
    silver.getFreqFX().setEnabled(freqFxOn);
    int freqFxAlgo = static_cast<int>(getSlotRaw(p, 246, CurFreqFX));
    silver.getFreqFX().setAlgorithm(freqFxAlgo);

    if (freqFxAlgo == 0) { // EQ 4-Band & Compressor
        silver.getFreqFX().setEQParams(
            store_.getRawValue(EQ_Switch) > 0.5f,
            store_.getRawValue(EQ_LowShelfSwitch) > 0.5f, store_.getRawValue(EQ_LowShelfFreq), store_.getNormalizedValue(EQ_LowShelfGain), store_.getNormalizedValue(EQ_LowShelfSlope),
            store_.getRawValue(EQ_Mid1Switch) > 0.5f, store_.getRawValue(EQ_Mid1Freq), store_.getNormalizedValue(EQ_Mid1Gain), store_.getNormalizedValue(EQ_Mid1Q),
            store_.getRawValue(EQ_Mid2Switch) > 0.5f, store_.getRawValue(EQ_Mid2Freq), store_.getNormalizedValue(EQ_Mid2Gain), store_.getNormalizedValue(EQ_Mid2Q),
            store_.getRawValue(EQ_HighShelfSwitch) > 0.5f, store_.getRawValue(EQ_HighShelfFreq), store_.getNormalizedValue(EQ_HighShelfGain), store_.getNormalizedValue(EQ_HighShelfSlope)
        );
        silver.getFreqFX().setCompressorParams(
            store_.getRawValue(CR_Switch) > 0.5f,
            store_.getRawValue(CR_Threshold),
            store_.getRawValue(CR_OutGain),
            store_.getNormalizedValue(CR_Responsiveness)
        );
    } else if (freqFxAlgo == 1) { // Distortion
        float inGain = store_.getNormalizedValue(DS_InGain);
        float preFilt = store_.getNormalizedValue(DS_PreFilter);
        int curve = static_cast<int>(store_.getRawValue(DS_ClipCurveType));
        float outGain = store_.getNormalizedValue(DS_OutGain);
        silver.getFreqFX().setDistortionParams(inGain, preFilt, curve, outGain);
    } else if (freqFxAlgo == 2) { // Ring Modulator
        float mix = store_.getNormalizedValue(RM_Mix);
        float speed = 0.1f + store_.getNormalizedValue(RM_Speed) * 19.9f;
        float depth = store_.getNormalizedValue(RM_Depth);
        int wave = static_cast<int>(store_.getRawValue(RM_WaveForm));
        float modFreq = 20.0f + store_.getNormalizedValue(RM_ModFreq) * 3000.0f;
        float xoDel = store_.getNormalizedValue(RM_XoverDelay) * store_.getNormalizedValue(RM_XoverTime);
        float xoFb = store_.getRawValue(RM_XoverDelayFeedback) / 64.0f;
        silver.getFreqFX().setRingModParams(mix, speed, depth, wave, modFreq, xoDel, xoFb);
    } else if (freqFxAlgo == 3) { // Decimator
        float mix = store_.getNormalizedValue(DC_Mix);
        int sh = 1 + static_cast<int>(store_.getNormalizedValue(DC_SHFactor) * 31.0f);
        float cut = store_.getNormalizedValue(DC_PreFilterCutoff);
        silver.getFreqFX().setDecimatorParams(mix, sh, cut);
    } else if (freqFxAlgo == 4) { // Spectral Warp
        float mix = store_.getNormalizedValue(SW_Mix);
        float freq = store_.getNormalizedValue(SW_Frequency);
        float tilt = store_.getNormalizedValue(SW_Tilt);
        float damp = store_.getNormalizedValue(SW_Damping);
        float speed = 0.1f + store_.getNormalizedValue(SW_Speed) * 19.9f;
        float depth = store_.getNormalizedValue(SW_Depth);
        silver.getFreqFX().setSpWarpParams(mix, freq, tilt, damp, speed, depth);
    }

    // TimeFX
    bool timeFxOn = silverSwitchOn && (getSlotRaw(p, 290, TimeFXSwitch) > 0.5f);
    silver.getTimeFX().setEnabled(timeFxOn);
    int timeFxAlgo = static_cast<int>(getSlotRaw(p, 291, CurTimeFX));
    silver.getTimeFX().setAlgorithm(timeFxAlgo);

    if (timeFxAlgo == 0) { // Stereo Spread
        float delay = store_.getRawValue(SS_ChanDelay);
        float fdbk = store_.getRawValue(SS_Feedback) / 64.0f;
        silver.getTimeFX().setStereoSpreadParams(delay, fdbk);
    } else if (timeFxAlgo == 1) { // L/R Delay
        float mix = store_.getNormalizedValue(LRD_Mix);
        float timeMs = store_.getRawValue(LRD_Time);
        float fdbk = store_.getRawValue(LRD_Feedback) / 64.0f;
        silver.getTimeFX().setLRDelayParams(mix, timeMs, fdbk);
    } else if (timeFxAlgo == 2) { // Flanger
        float mix = store_.getNormalizedValue(FL_Mix);
        float depth = store_.getNormalizedValue(FL_Depth);
        float speed = 0.1f + store_.getNormalizedValue(FL_Speed) * 15.0f;
        int wave = static_cast<int>(store_.getRawValue(FL_WaveForm));
        float fdbk = store_.getRawValue(FL_Feedback) / 64.0f;
        float stPhase = store_.getNormalizedValue(FL_StereoPhase);
        silver.getTimeFX().setModulationParams(mix, depth, speed, fdbk, wave, stPhase, 0.0f);
    } else if (timeFxAlgo == 3) { // Phaser
        float mix = store_.getNormalizedValue(PH_Mix);
        float depth = store_.getNormalizedValue(PH_Depth);
        float speed = 0.1f + store_.getNormalizedValue(PH_Speed) * 15.0f;
        int wave = static_cast<int>(store_.getRawValue(PH_WaveForm));
        float fdbk = store_.getRawValue(PH_Feedback) / 64.0f;
        float stPhase = store_.getNormalizedValue(PH_StereoPhase);
        silver.getTimeFX().setModulationParams(mix, depth, speed, fdbk, wave, stPhase, 0.0f);
    } else if (timeFxAlgo == 4) { // Chorus
        float mix = store_.getNormalizedValue(CH_Mix);
        float depth = store_.getNormalizedValue(CH_Depth);
        float speed = 0.1f + store_.getNormalizedValue(CH_Speed) * 15.0f;
        int wave = static_cast<int>(store_.getRawValue(CH_WaveForm));
        float fdbk = store_.getRawValue(CH_Feedback) / 64.0f;
        float preDel = store_.getNormalizedValue(CH_PreDelay);
        float stPhase = store_.getNormalizedValue(CH_StereoPhase);
        silver.getTimeFX().setModulationParams(mix, depth, speed, fdbk, wave, stPhase, preDel);
    }

    // Master FX
    bool mfxMasterOn = store_.getRawValue(SoundMFXSwitch) > 0.5f;
    auto& mTime = blockRenderer_.getMasterTimeFX();
    mTime.setMasterEnabled(mfxMasterOn);
    mTime.setDelayEnabled(store_.getRawValue(SoundMFXDelaySwitch) > 0.5f);
    mTime.setReverbEnabled(store_.getRawValue(SoundMFXReverbSwitch) > 0.5f);

    float dMix = store_.getNormalizedValue(SoundMFXDelayMix);
    float dL = store_.getRawValue(SoundMFXDelayLTime);
    float dR = store_.getRawValue(SoundMFXDelayRTime);
    float dFb = store_.getRawValue(SoundMFXDelayFeedback) / 64.0f;
    float dDamp = store_.getNormalizedValue(SoundMFXDelayFdbkDamp);
    mTime.setDelayParameters(dMix, dL, dR, dFb, dDamp);

    float rMix = store_.getNormalizedValue(SoundMFXReverbMix);
    int rRoom = static_cast<int>(store_.getRawValue(SoundMFXReverbRoom));
    float rDecay = store_.getNormalizedValue(SoundMFXRevDecayTime);
    float rDiff = store_.getNormalizedValue(SoundMFXRevDiffusion);
    float rDamp = store_.getNormalizedValue(SoundMFXRevHFDamp);
    mTime.setReverbParameters(rMix, rRoom, rDecay, rDiff, rDamp);

    auto& mMod = blockRenderer_.getMasterModFX();
    mMod.setEnabled(mfxMasterOn);
    mMod.setParameters(0.0f, 0.5f, 1.0f);

    return params;
}

void DspEngineFacade::applyAntiPop(float* leftChannel, float* rightChannel, size_t numSamples) {
    if (antiPopRemaining_ == 0 || leftChannel == nullptr) return;

    size_t fadeSamples = std::min(numSamples, antiPopRemaining_);
    for (size_t i = 0; i < fadeSamples; ++i) {
        float gain = 1.0f - (static_cast<float>(antiPopRemaining_) / static_cast<float>(antiPopTotalSamples_));
        leftChannel[i] *= gain;
        if (rightChannel != nullptr && rightChannel != leftChannel) {
            rightChannel[i] *= gain;
        }
        --antiPopRemaining_;
    }
}

void DspEngineFacade::updatePeaksAndTelemetry(const float* leftChannel, const float* rightChannel, size_t numSamples, float instantLoad) {
    float maxL = 0.0f;
    float maxR = 0.0f;
    for (size_t i = 0; i < numSamples; ++i) {
        float al = std::abs(leftChannel[i]);
        if (al > maxL) maxL = al;
        if (rightChannel != nullptr) {
            float ar = std::abs(rightChannel[i]);
            if (ar > maxR) maxR = ar;
        }
    }
    peakL_ = maxL;
    peakR_ = (rightChannel != nullptr) ? maxR : maxL;
    activeVoices_ = voicePool_.getActiveVoiceCount();

    // Real measured CPU load smoothed with 1-pole IIR filter
    cpuUsage_ = cpuUsage_ * 0.9f + instantLoad * 0.1f;
}

void DspEngineFacade::process(float* leftChannel, float* rightChannel, size_t numSamples) {
    if (leftChannel == nullptr || numSamples == 0) return;

    auto startTime = std::chrono::steady_clock::now();

    // 1. Process recorded vector stick automation
    processVectorSticks(numSamples);

    // 2. Fetch parameters (dual-path precedence: bridge effective slots > store)
    const float* p = bridge_ ? bridge_->getEffectiveSlots() : nullptr;

    // 3. Modulation & Pitch
    float globalLfoSignal = updateModulationAndPitch(p, numSamples);

    // 4. Resynator Layers & Envelopes
    updateResynatorLayers(p, globalLfoSignal);
    updateEnvelopes(p);

    // 5. Silver Rack & Master FX routing
    auto renderParams = updateSilverAndMasterFx(p, globalLfoSignal);

    // 6. Block render
    blockRenderer_.process(leftChannel, rightChannel, numSamples,
                           voicePool_,
                           renderParams.blenderNorm, renderParams.blenderType,
                           renderParams.slicerType, renderParams.slicerDepth,
                           renderParams.slicerRateHz, renderParams.slicerWave,
                           renderParams.filterType, renderParams.cutoffHz,
                           renderParams.resonance, renderParams.filterEnvDepth,
                           renderParams.filterKeyTrack, renderParams.filterVelDepth,
                           masterVolume_);

    // 7. Sample-accurate anti-pop fade
    applyAntiPop(leftChannel, rightChannel, numSamples);

    // 8. Performance telemetry
    auto endTime = std::chrono::steady_clock::now();
    float elapsedSec = std::chrono::duration<float>(endTime - startTime).count();
    float blockSec = static_cast<float>(numSamples) / static_cast<float>(sampleRate_);
    float instantLoad = (blockSec > 0.0f) ? (elapsedSec / blockSec) : 0.0f;

    updatePeaksAndTelemetry(leftChannel, rightChannel, numSamples, instantLoad);
}

Telemetry DspEngineFacade::getTelemetry() const noexcept {
    Telemetry t;
    t.cpuUsage = cpuUsage_;
    t.activeVoices = activeVoices_;
    t.peakL = peakL_;
    t.peakR = peakR_;
    return t;
}

} // namespace abd::axionik
