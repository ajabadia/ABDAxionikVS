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

void DspEngineFacade::process(float* leftChannel, float* rightChannel, size_t numSamples) {
    if (leftChannel == nullptr || numSamples == 0) return;

    // 0. Reproducción de trayectorias vectoriales (sound.stickrec)
    stickPlayer_.processBlock(numSamples, [this](uint32_t paramIdx, float rawVal) {
        store_.setRawValue(paramIdx, rawVal);
        if (onStickParamChanged_) {
            onStickParamChanged_(paramIdx, rawVal);
        }
    });

    // 1. Matriz de Modulación (6 controles -> 63 destinos -> p[slot]) & Pitch Bend
    // A. Pitch Bend Wheel (-1.0 .. +1.0) con rango en semitonos (param 412 / p[2])
    const float* p = bridge_ ? bridge_->getEffectiveSlots() : nullptr;
    float pbRange = p ? p[2] : store_.getRawValue(412);
    if (pbRange <= 0.0f) pbRange = 2.0f;
    float pbFactor = std::pow(2.0f, (pitchBendWheel_ * pbRange) / 12.0f);
    voicePool_.updatePitchBendFactor(pbFactor);

    // B. Polifonía (SoundNumVoices [5]), Paneo (SoundPan [3], SoundPanKeyTrack [4]) y Umbrales VelocitySwitch ([41], [121])
    size_t maxVoices = static_cast<size_t>(std::clamp(store_.getRawValue(5), 1.0f, 12.0f));
    voicePool_.setMaxActiveVoices(maxVoices);
    float soundPan = p ? p[0] : (store_.getRawValue(3) / 64.0f);
    float soundPanKt = p ? p[1] : (store_.getRawValue(4) / 64.0f);
    voicePool_.updateVoicePan(soundPan, soundPanKt);
    float r1VelSw = (p ? p[18] : store_.getRawValue(41)) / 127.0f;
    float r2VelSw = (p ? p[88] : store_.getRawValue(121)) / 127.0f;
    voicePool_.setVelocitySwitchThresholds(r1VelSw, r2VelSw);

    // C. R1Switch [23] (p[3]) y R2Switch [103] (p[73])
    bool r1On = (p ? p[3] : store_.getRawValue(23)) > 0.5f;
    bool r2On = (p ? p[73] : store_.getRawValue(103)) > 0.5f;
    voicePool_.updateResynatorEnabled(0, r1On);
    voicePool_.updateResynatorEnabled(1, r2On);

    // D. LFO Global ([256..260]: LFOSwitch, LFODepth p[216], LFORate p[217], LFODelay p[218], LFOWaveForm p[219])
    bool lfoOn = (p ? p[215] : store_.getRawValue(256)) > 0.5f;
    float globalLfoSignal = 0.0f;
    if (lfoOn) {
        float lfoDepth = p ? p[216] : store_.getNormalizedValue(257);
        float lfoRateNorm = p ? p[217] : (store_.getRawValue(258) / 1000.0f);
        float lfoRateHz = 0.05f + std::clamp(lfoRateNorm, 0.0f, 1.0f) * 24.95f;
        int lfoWave = static_cast<int>(p ? p[219] : store_.getRawValue(260));
        globalLfoPhase_ += static_cast<double>(lfoRateHz) * (8192.0 / sampleRate_) * static_cast<double>(numSamples);
        while (globalLfoPhase_ >= 8192.0) globalLfoPhase_ -= 8192.0;
        globalLfoSignal = abd::dsp::DspNeuronLfoTables::readInterpolated(lfoWave, globalLfoPhase_) * lfoDepth;
    }

    // 2. Resynator 1 & 2: Capas L1, L2, L3 leídas directamente de p[slot] (con los 6 controles sumados y recortados)
    // R1 (destinos 2..13 -> slots 28,29,19,20, 46,47,37,38, 64,65,55,56):
    float r1_sc1 = p ? p[28] : store_.getNormalizedValue(52);
    float r1_sc2 = p ? p[29] : store_.getNormalizedValue(53);
    float r1_sp1 = p ? p[19] : store_.getNormalizedValue(42);
    float r1_sp2 = p ? p[20] : store_.getNormalizedValue(43);
    voicePool_.updateVoiceLayerParams(0, 0, r1_sc1, r1_sc2, r1_sp1, r1_sp2, 1.0f);

    float r1_l2_sc1 = p ? p[46] : store_.getNormalizedValue(72);
    float r1_l2_sc2 = p ? p[47] : store_.getNormalizedValue(73);
    float r1_l2_sp1 = p ? p[37] : store_.getNormalizedValue(62);
    float r1_l2_sp2 = p ? p[38] : store_.getNormalizedValue(63);
    voicePool_.updateVoiceLayerParams(0, 1, r1_l2_sc1, r1_l2_sc2, r1_l2_sp1, r1_l2_sp2, 0.85f);

    float r1_l3_sc1 = p ? p[64] : store_.getNormalizedValue(92);
    float r1_l3_sc2 = p ? p[65] : store_.getNormalizedValue(93);
    float r1_l3_sp1 = p ? p[55] : store_.getNormalizedValue(82);
    float r1_l3_sp2 = p ? p[56] : store_.getNormalizedValue(83);
    voicePool_.updateVoiceLayerParams(0, 2, r1_l3_sc1, r1_l3_sc2, r1_l3_sp1, r1_l3_sp2, 0.70f);

    // R2 (destinos 16..27 -> slots 98,99,89,90, 116,117,107,108, 134,135,125,126):
    float r2_sc1 = p ? p[98] : store_.getNormalizedValue(132);
    float r2_sc2 = p ? p[99] : store_.getNormalizedValue(133);
    float r2_sp1 = p ? p[89] : store_.getNormalizedValue(122);
    float r2_sp2 = p ? p[90] : store_.getNormalizedValue(123);
    voicePool_.updateVoiceLayerParams(1, 0, r2_sc1, r2_sc2, r2_sp1, r2_sp2, 1.0f);

    float r2_l2_sc1 = p ? p[116] : store_.getNormalizedValue(152);
    float r2_l2_sc2 = p ? p[117] : store_.getNormalizedValue(153);
    float r2_l2_sp1 = p ? p[107] : store_.getNormalizedValue(142);
    float r2_l2_sp2 = p ? p[108] : store_.getNormalizedValue(143);
    voicePool_.updateVoiceLayerParams(1, 1, r2_l2_sc1, r2_l2_sc2, r2_l2_sp1, r2_l2_sp2, 0.85f);

    float r2_l3_sc1 = p ? p[134] : store_.getNormalizedValue(172);
    float r2_l3_sc2 = p ? p[135] : store_.getNormalizedValue(173);
    float r2_l3_sp1 = p ? p[125] : store_.getNormalizedValue(162);
    float r2_l3_sp2 = p ? p[126] : store_.getNormalizedValue(163);
    voicePool_.updateVoiceLayerParams(1, 2, r2_l3_sc1, r2_l3_sc2, r2_l3_sp1, r2_l3_sp2, 0.70f);

    // 3. Algoritmos Parset (FUN_10031d30)
    int r1Parset = static_cast<int>(store_.getRawValue(24));
    int r2Parset = static_cast<int>(store_.getRawValue(104));
    voicePool_.updateVoiceParset(0, r1Parset);
    voicePool_.updateVoiceParset(1, r2Parset);

    // 4. Afinación y volumen de resonadores desde p[slot] (Dest 0=p[4], Dest 1=p[11], Dest 14=p[74], Dest 15=p[81])
    int r1Oct = static_cast<int>(p ? p[10] : store_.getRawValue(33));
    int r1Semi = static_cast<int>(std::round(p ? p[11] : store_.getRawValue(34)));
    float r1PitchLfo = p ? p[13] : (store_.getRawValue(36) / 64.0f);
    float r1Cents = (p ? p[12] : store_.getRawValue(35)) + globalLfoSignal * r1PitchLfo * 100.0f;
    voicePool_.updateVoiceTuning(0, r1Oct, r1Semi, r1Cents);
    float r1AmpLfo = p ? p[5] : (store_.getRawValue(28) / 64.0f);
    float r1Vol = std::clamp((p ? p[4] : store_.getNormalizedValue(27)) * (1.0f + globalLfoSignal * r1AmpLfo * 0.5f), 0.0f, 1.5f);
    voicePool_.updateVoiceVolume(0, r1Vol);

    int r2Oct = static_cast<int>(p ? p[80] : store_.getRawValue(113));
    int r2Semi = static_cast<int>(std::round(p ? p[81] : store_.getRawValue(114)));
    float r2PitchLfo = p ? p[83] : (store_.getRawValue(116) / 64.0f);
    float r2Cents = (p ? p[82] : store_.getRawValue(115)) + globalLfoSignal * r2PitchLfo * 100.0f;
    voicePool_.updateVoiceTuning(1, r2Oct, r2Semi, r2Cents);
    float r2AmpLfo = p ? p[75] : (store_.getRawValue(108) / 64.0f);
    float r2Vol = std::clamp((p ? p[74] : store_.getNormalizedValue(107)) * (1.0f + globalLfoSignal * r2AmpLfo * 0.5f), 0.0f, 1.5f);
    voicePool_.updateVoiceVolume(1, r2Vol);

    // 5. Envolventes moduladas desde p[slot] (Destinos 28..55, regla cuadrática FUN_10040550)
    float aNorm = p ? p[161] : store_.getNormalizedValue(200);
    float dNorm = p ? p[162] : store_.getNormalizedValue(201);
    float sLvl  = p ? p[163] : store_.getNormalizedValue(202);
    float rNorm = p ? p[164] : store_.getNormalizedValue(203);
    voicePool_.updateAmpEnvelope(aNorm, dNorm, sLvl, rNorm);

    float faNorm = p ? p[237] : store_.getNormalizedValue(355);
    float fdNorm = p ? p[238] : store_.getNormalizedValue(356);
    float fsLvl  = p ? p[239] : store_.getNormalizedValue(357);
    float frNorm = p ? p[240] : store_.getNormalizedValue(358);
    voicePool_.updateFilterEnvelope(faNorm, fdNorm, fsLvl, frNorm);

    // R1 ResEnv (Dest 28..31 -> p[143..146]) y R2 ResEnv (Dest 40..43 -> p[173..176])
    float r1Ra = p ? p[143] : store_.getNormalizedValue(182);
    float r1Rd = p ? p[144] : store_.getNormalizedValue(183);
    float r1Rs = p ? p[145] : store_.getNormalizedValue(184);
    float r1Rr = p ? p[146] : store_.getNormalizedValue(185);
    voicePool_.updateResEnvelopes(0, r1Ra, r1Rd, r1Rs, r1Rr);

    float r2Ra = p ? p[173] : store_.getNormalizedValue(212);
    float r2Rd = p ? p[174] : store_.getNormalizedValue(213);
    float r2Rs = p ? p[175] : store_.getNormalizedValue(214);
    float r2Rr = p ? p[176] : store_.getNormalizedValue(215);
    voicePool_.updateResEnvelopes(1, r2Ra, r2Rd, r2Rs, r2Rr);

    // 6. Blender & Slicer desde p[slot] (Dest 56=p[221], Dest 57=p[227], Dest 58=p[228])
    float blenderLfoMod = p ? p[222] : (store_.getRawValue(263) / 64.0f);
    float blenderBase = p ? p[221] : std::clamp((store_.getRawValue(262) + 64.0f) / 127.0f, 0.0f, 1.0f);
    float blenderNorm = std::clamp(blenderBase + globalLfoSignal * blenderLfoMod * 0.5f, 0.0f, 1.0f);
    int blenderType = static_cast<int>(p ? p[220] : store_.getRawValue(261));

    int slicerType = static_cast<int>(p ? p[226] : store_.getRawValue(267));
    float slicerDepth = p ? p[227] : std::clamp(store_.getRawValue(268) / 127.0f, 0.0f, 1.0f);
    float slicerRateNorm = p ? p[228] : std::clamp(store_.getRawValue(269) / 200.0f, 0.0f, 1.0f);
    float slicerRateHz = std::clamp(std::pow(10.0f, slicerRateNorm * 4.0f - 2.0f), 0.01f, 100.0f);
    int slicerWave = static_cast<int>(p ? p[229] : store_.getRawValue(270));

    // 7. Configuración del Silver Rack desde p[slot] (SilverSwitch = param 271 / p[244], Dest 61=p[231] FilterFreq, Dest 62=p[232] FilterReso)
    float filterLfoMod = p ? p[233] : (store_.getRawValue(276) / 64.0f);
    float filterFreqBase = p ? p[231] : std::clamp(store_.getRawValue(274) / 127.0f, 0.0f, 1.0f);
    float filterFreqNorm = std::clamp(filterFreqBase + globalLfoSignal * filterLfoMod * 0.5f, 0.0f, 1.0f);
    float cutoffHz = std::clamp(20.0f * std::pow(900.0f, filterFreqNorm), 20.0f, 20000.0f);
    float filterResoNorm = p ? p[232] : std::clamp(store_.getRawValue(275) / 127.0f, 0.0f, 1.0f);
    float resonance = std::clamp(filterResoNorm * 0.95f, 0.0f, 0.95f);
    bool silverSwitchOn = (p ? p[244] : store_.getRawValue(271)) > 0.5f;
    int filterType = silverSwitchOn ? static_cast<int>(p ? p[230] : store_.getRawValue(273)) : -1;

    float filterEnvDepth = p ? p[242] : (store_.getRawValue(360) / 64.0f); // -1.0 .. +1.0
    float filterKeyTrack = (p ? p[234] : (store_.getRawValue(277) / 64.0f)) * 64.0f;
    float filterVelDepth = (p ? p[235] : (store_.getRawValue(278) / 64.0f)) * 64.0f;

    auto& silver = blockRenderer_.getSilverRack();

    // FreqFX (habilitado sólo si SilverSwitch [271] y FreqFXSwitch [281] están activos, FUN_10029e34 L158-161)
    bool freqFxOn = silverSwitchOn && ((p ? p[245] : store_.getRawValue(281)) > 0.5f);
    silver.getFreqFX().setEnabled(freqFxOn);
    int freqFxAlgo = static_cast<int>(p ? p[246] : store_.getRawValue(282));
    silver.getFreqFX().setAlgorithm(freqFxAlgo);

    if (freqFxAlgo == 0) { // EQ 4-Band ([285..301]) + Compressor ([302..305]) (FUN_1002d3d4 / FUN_1003785c)
        silver.getFreqFX().setEQParams(
            store_.getRawValue(285) > 0.5f,
            store_.getRawValue(286) > 0.5f, store_.getRawValue(287), store_.getNormalizedValue(288), store_.getNormalizedValue(289),
            store_.getRawValue(290) > 0.5f, store_.getRawValue(291), store_.getNormalizedValue(292), store_.getNormalizedValue(293),
            store_.getRawValue(294) > 0.5f, store_.getRawValue(295), store_.getNormalizedValue(296), store_.getNormalizedValue(297),
            store_.getRawValue(298) > 0.5f, store_.getRawValue(299), store_.getNormalizedValue(300), store_.getNormalizedValue(301)
        );
        silver.getFreqFX().setCompressorParams(
            store_.getRawValue(302) > 0.5f,
            store_.getRawValue(303),
            store_.getRawValue(304),
            store_.getNormalizedValue(305)
        );
    } else if (freqFxAlgo == 1) { // Distortion (FUN_10029e34 / FUN_100343e4)
        float inGain = store_.getNormalizedValue(306);   // DS_InGain: escala directa canónica de p[269]
        float preFilt = store_.getNormalizedValue(307);  // DS_PreFilter: escala directa canónica de p[270]
        int curve = static_cast<int>(store_.getRawValue(308)); // DS_ClipCurveType
        float outGain = store_.getNormalizedValue(309);  // DS_OutGain: escala directa canónica de p[272]
        silver.getFreqFX().setDistortionParams(inGain, preFilt, curve, outGain);
    } else if (freqFxAlgo == 2) { // Ring Modulator
        float mix = store_.getNormalizedValue(310);
        float speed = 0.1f + store_.getNormalizedValue(311) * 19.9f;
        float depth = store_.getNormalizedValue(312);
        int wave = static_cast<int>(store_.getRawValue(313));
        float modFreq = 20.0f + store_.getNormalizedValue(314) * 3000.0f;
        float xoDel = store_.getNormalizedValue(315) * store_.getNormalizedValue(316);
        float xoFb = store_.getRawValue(317) / 64.0f;
        silver.getFreqFX().setRingModParams(mix, speed, depth, wave, modFreq, xoDel, xoFb);
    } else if (freqFxAlgo == 3) { // Decimator (FUN_10029e34 L419: iVar18 == 3)
        float mix = store_.getNormalizedValue(324);
        int sh = 1 + static_cast<int>(store_.getNormalizedValue(325) * 31.0f);
        float cut = store_.getNormalizedValue(326);
        silver.getFreqFX().setDecimatorParams(mix, sh, cut);
    } else if (freqFxAlgo == 4) { // SpWarp (FUN_10029e34 L470: iVar18 == 4)
        float mix = store_.getNormalizedValue(318);
        float freq = store_.getNormalizedValue(319);
        float tilt = store_.getNormalizedValue(320);
        float damp = store_.getNormalizedValue(321);
        float speed = 0.1f + store_.getNormalizedValue(322) * 19.9f;
        float depth = store_.getNormalizedValue(323);
        silver.getFreqFX().setSpWarpParams(mix, freq, tilt, damp, speed, depth);
    }

    // TimeFX (habilitado sólo si SilverSwitch [271] y TimeFXSwitch [327] están activos, FUN_10029e34 L158, L483)
    bool timeFxOn = silverSwitchOn && ((p ? p[290] : store_.getRawValue(327)) > 0.5f);
    silver.getTimeFX().setEnabled(timeFxOn);
    int timeFxAlgo = static_cast<int>(p ? p[291] : store_.getRawValue(328));
    silver.getTimeFX().setAlgorithm(timeFxAlgo);

    if (timeFxAlgo == 0) { // Stereo Spread
        float delay = store_.getRawValue(331); // -64..+63 ms (con signo para L o R)
        float fdbk = store_.getRawValue(332) / 64.0f;
        silver.getTimeFX().setStereoSpreadParams(delay, fdbk);
    } else if (timeFxAlgo == 1) { // L/R Delay
        float mix = store_.getNormalizedValue(333);
        float timeMs = store_.getRawValue(334);
        float fdbk = store_.getRawValue(335) / 64.0f;
        silver.getTimeFX().setLRDelayParams(mix, timeMs, fdbk);
    } else if (timeFxAlgo == 2) { // Flanger (336..341)
        float mix = store_.getNormalizedValue(336);
        float depth = store_.getNormalizedValue(337);
        float speed = 0.1f + store_.getNormalizedValue(338) * 15.0f;
        int wave = static_cast<int>(store_.getRawValue(339));
        float fdbk = store_.getRawValue(340) / 64.0f;
        float stPhase = store_.getNormalizedValue(341);
        silver.getTimeFX().setModulationParams(mix, depth, speed, fdbk, wave, stPhase, 0.0f);
    } else if (timeFxAlgo == 3) { // Phaser (342..347)
        float mix = store_.getNormalizedValue(342);
        float depth = store_.getNormalizedValue(343);
        float speed = 0.1f + store_.getNormalizedValue(344) * 15.0f;
        int wave = static_cast<int>(store_.getRawValue(345));
        float fdbk = store_.getRawValue(346) / 64.0f;
        float stPhase = store_.getNormalizedValue(347);
        silver.getTimeFX().setModulationParams(mix, depth, speed, fdbk, wave, stPhase, 0.0f);
    } else if (timeFxAlgo == 4) { // Chorus (348..354)
        float mix = store_.getNormalizedValue(348);
        float depth = store_.getNormalizedValue(349);
        float speed = 0.1f + store_.getNormalizedValue(350) * 15.0f;
        int wave = static_cast<int>(store_.getRawValue(351));
        float fdbk = store_.getRawValue(352) / 64.0f;
        float preDel = store_.getNormalizedValue(353);
        float stPhase = store_.getNormalizedValue(354);
        silver.getTimeFX().setModulationParams(mix, depth, speed, fdbk, wave, stPhase, preDel);
    }

    // 8. Configuración de Master FX (SoundMFX [430..444])
    bool mfxMasterOn = store_.getRawValue(430) > 0.5f;
    auto& mTime = blockRenderer_.getMasterTimeFX();
    mTime.setMasterEnabled(mfxMasterOn);
    mTime.setDelayEnabled(store_.getRawValue(431) > 0.5f);
    mTime.setReverbEnabled(store_.getRawValue(437) > 0.5f);

    float dMix = store_.getNormalizedValue(432);
    float dL = store_.getRawValue(433);
    float dR = store_.getRawValue(434);
    float dFb = store_.getRawValue(435) / 64.0f;
    float dDamp = store_.getNormalizedValue(436);
    mTime.setDelayParameters(dMix, dL, dR, dFb, dDamp);

    float rMix = store_.getNormalizedValue(438);
    int rRoom = static_cast<int>(store_.getRawValue(439));
    float rDecay = store_.getNormalizedValue(440);
    float rDiff = store_.getNormalizedValue(441);
    float rDamp = store_.getNormalizedValue(442);
    mTime.setReverbParameters(rMix, rRoom, rDecay, rDiff, rDamp);

    auto& mMod = blockRenderer_.getMasterModFX();
    mMod.setEnabled(mfxMasterOn);
    mMod.setParameters(0.0f, 0.5f, 1.0f);

    // 9. Master volume
    float masterVol = 0.85f;

    // 10. Renderizar bloques de 128 muestras (FUN_100382b0)
    blockRenderer_.process(leftChannel, rightChannel, numSamples,
                          voicePool_, blenderNorm, blenderType, slicerType,
                          slicerDepth, slicerRateHz, slicerWave,
                          filterType, cutoffHz, resonance,
                          filterEnvDepth, filterKeyTrack, filterVelDepth,
                          masterVol);

    // 11. Rampa anti-pops de 2ms tras cambio de modelo o preset (Paquete 4 / Mac 1.56)
    if (antiPopRemaining_ > 0) {
        for (size_t i = 0; i < numSamples && antiPopRemaining_ > 0; ++i, --antiPopRemaining_) {
            float gain = 1.0f - (static_cast<float>(antiPopRemaining_) / static_cast<float>(antiPopTotalSamples_));
            leftChannel[i] *= gain;
            if (rightChannel != nullptr && rightChannel != leftChannel) {
                rightChannel[i] *= gain;
            }
        }
    }

    // 12. Telemetría y picos
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
    cpuUsage_ = activeVoices_ > 0 ? (0.015f * static_cast<float>(activeVoices_)) : 0.002f;
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
