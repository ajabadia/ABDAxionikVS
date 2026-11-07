// ============================================================================
// ABDAxionikVS — PluginProcessor.cpp
// Implementación del procesador de audio JUCE 9
// ============================================================================

#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "AppLogger.h"
#include "DSP/AxionikParamIndices.h"
#include <algorithm>
#include <cmath>

namespace abd::axionik {

juce::AudioProcessorValueTreeState::ParameterLayout AxionikProcessor::createParameterLayout() {
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;
    params.reserve(kNumTotalParameters);

    for (const auto& desc : kParameterDescriptors) {
        float step = desc.step > 0.0f ? desc.step : 0.001f;
        auto range = juce::NormalisableRange<float>(desc.min, desc.max, step);

        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            juce::ParameterID(juce::String(desc.key.data(), desc.key.size()), 1),
            juce::String(desc.key.data(), desc.key.size()),
            range,
            desc.defaultValue
        ));
    }

    return { params.begin(), params.end() };
}

AxionikProcessor::AxionikProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts_(*this, nullptr, "Parameters", createParameterLayout())
{
    AX_LOG("[PROCESSOR] AxionikProcessor constructor starting...");
    paramIdToIndex_.reserve(kNumTotalParameters);
    pendingUiChanges_.reserve(32);

    // Escuchar cambios de parámetros para reflejarlos en dspEngine_ y construir el mapa O(1)
    for (const auto& desc : kParameterDescriptors) {
        auto paramKey = juce::String(desc.key.data(), desc.key.size());
        paramIdToIndex_.emplace(paramKey, desc.index);
        apvts_.addParameterListener(paramKey, this);
    }

    // Conectar el despachador de StickPlayer para animar la UI en tiempo real
    dspEngine_.setOnStickParamChanged([this](uint32_t idx, float rawVal) {
        std::scoped_lock lock(uiParamMutex_);
        pendingUiChanges_.push_back({ idx, rawVal });
    });

    // Sincronizar APVTS y estado inicial (000: Init Sound) desde dspEngine_
    syncApvtsFromDspEngine();

    AX_LOG("[PROCESSOR] AxionikProcessor constructor finished successfully.");
}

AxionikProcessor::~AxionikProcessor() {
    AX_LOG("[PROCESSOR] AxionikProcessor destructor called.");
    for (const auto& desc : kParameterDescriptors) {
        apvts_.removeParameterListener(juce::String(desc.key.data(), desc.key.size()), this);
    }
}

void AxionikProcessor::prepareToPlay(double sampleRate, int samplesPerBlock) {
    AX_LOG(juce::String("[PROCESSOR] prepareToPlay() called: sr=") + juce::String(sampleRate) + " block=" + juce::String(samplesPerBlock));
    currentSampleRate_.store(sampleRate > 1000.0 ? sampleRate : 44100.0, std::memory_order_relaxed);
    dspEngine_.prepare(sampleRate, static_cast<size_t>(samplesPerBlock));
    // El motor renderiza muestra a muestra dentro del bloque: latencia cero explícita para el host.
    setLatencySamples(0);
}

void AxionikProcessor::releaseResources() {
    dspEngine_.reset();
}

bool AxionikProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo()) {
        return false;
    }
    return true;
}

void AxionikProcessor::parameterChanged(const juce::String& parameterID, float newValue) {
    if (isSyncingPreset_.load(std::memory_order_acquire)) return;

    // Búsqueda O(1) en la tabla hash de parámetros
    auto it = paramIdToIndex_.find(parameterID);
    if (it != paramIdToIndex_.end()) {
        uint32_t idx = it->second;
        dspEngine_.setParam(idx, newValue);

        // Notificar a la capa de abstracción de la WebUI (evita desincronizaciones de DAW/MIDI)
        std::scoped_lock lock(uiParamMutex_);
        pendingUiChanges_.push_back({ idx, newValue });
    }
}

std::vector<AxionikProcessor::ParamChange> AxionikProcessor::drainPendingUiParamChanges() {
    std::scoped_lock lock(uiParamMutex_);
    std::vector<ParamChange> changes;
    changes.swap(pendingUiChanges_);
    return changes;
}

AxionikProcessor::PresetEvent AxionikProcessor::drainPendingPresetEvent() {
    std::scoped_lock lock(uiParamMutex_);
    PresetEvent evt = pendingPresetEvent_;
    pendingPresetEvent_.hasEvent = false;
    return evt;
}

bool AxionikProcessor::loadPresetFromScript(const std::string& scriptText) {
    {
        const juce::ScopedLock sl(getCallbackLock());
        if (!dspEngine_.loadPresetFromScript(scriptText)) {
            return false;
        }
    }
    syncApvtsFromDspEngine();
    return true;
}

bool AxionikProcessor::loadPresetBySlot(int slot) {
    AX_LOG(juce::String("[PRESET] loadPresetBySlot called with slot=") + juce::String(slot));
    {
        const juce::ScopedLock sl(getCallbackLock());
        if (!dspEngine_.loadPresetBySlot(slot)) {
            AX_LOG(juce::String("[PRESET] dspEngine_.loadPresetBySlot FAILED for slot=") + juce::String(slot));
            return false;
        }
    }
    syncApvtsFromDspEngine();
    currentProgram_ = getProgramIndexForSlot(slot);
    const auto& cur = dspEngine_.getCurrentPreset();
    AX_LOG(juce::String("[PRESET] Loaded successfully: '") + juce::String(cur.name) +
           "' (R1 Model: " + juce::String(cur.r1ModelIndex) +
           ", R2 Model: " + juce::String(cur.r2ModelIndex) + ")");
    return true;
}

bool AxionikProcessor::loadModelBySlot(int slot, int modelIndex) {
    bool ok = false;
    {
        const juce::ScopedLock sl(getCallbackLock());
        ok = dspEngine_.loadModelBySlot(slot, modelIndex);
    }
    if (ok) {
        uint32_t paramIdx = (slot == 0) ? abd::axionik::ParamIdx::R1ModellIndex : abd::axionik::ParamIdx::R2ModellIndex;
        setParameterByIndex(paramIdx, static_cast<float>(modelIndex));
    }
    return ok;
}

void AxionikProcessor::initPreset() {
    {
        const juce::ScopedLock sl(getCallbackLock());
        auto initPreset = NeuronSound::getEmbeddedInitPreset();
        // Perfiles ADSR iniciales diferenciados por generador para InitSound
        initPreset.values[200] = 4.0f;  initPreset.values[201] = 28.0f; initPreset.values[202] = 127.0f; initPreset.values[203] = 50.0f; // R1 Amp
        initPreset.values[182] = 74.0f; initPreset.values[183] = 84.0f; initPreset.values[184] = 32.0f;  initPreset.values[185] = 57.0f; // R1 Res
        initPreset.values[205] = 32.0f; initPreset.values[206] = 68.0f; initPreset.values[207] = 54.0f;  initPreset.values[208] = 72.0f; // R1 Free
        initPreset.values[230] = 18.0f; initPreset.values[231] = 46.0f; initPreset.values[232] = 108.0f; initPreset.values[233] = 58.0f; // R2 Amp
        initPreset.values[212] = 52.0f; initPreset.values[213] = 76.0f; initPreset.values[214] = 44.0f;  initPreset.values[215] = 63.0f; // R2 Res
        initPreset.values[235] = 60.0f; initPreset.values[236] = 30.0f; initPreset.values[237] = 88.0f;  initPreset.values[238] = 46.0f; // R2 Free
        initPreset.values[355] = 65.0f; initPreset.values[356] = 75.0f; initPreset.values[357] = 79.0f;  initPreset.values[358] = 89.0f; // Filter Env
        dspEngine_.applyPreset(initPreset);
    }
    syncApvtsFromDspEngine();
}

void AxionikProcessor::syncApvtsFromDspEngine() {
    isSyncingPreset_.store(true, std::memory_order_release);
    const auto& store = dspEngine_.getStore();
    {
        std::scoped_lock lock(uiParamMutex_);
        pendingUiChanges_.clear();
        for (uint32_t i = 0; i < kNumTotalParameters; ++i) {
            float rawVal = store.getRawValue(i);
            float normVal = rawToNormalized(i, rawVal);
            const auto& desc = kParameterDescriptors[i];
            auto paramId = juce::String(desc.key.data(), desc.key.size());
            if (auto* p = apvts_.getParameter(paramId)) {
                p->setValueNotifyingHost(normVal);
            }
            pendingUiChanges_.push_back({ i, rawVal });
        }
        const auto& curPreset = dspEngine_.getCurrentPreset();
        pendingPresetEvent_ = { true, juce::String(curPreset.name), curPreset.r1ModelIndex, curPreset.r2ModelIndex };    }

    isSyncingPreset_.store(false, std::memory_order_release);
}

void AxionikProcessor::setParameterByIndex(uint32_t index, float rawValue) {
    if (index >= kNumTotalParameters) return;
    float normVal = rawToNormalized(index, rawValue);
    setParameterNormalizedByIndex(index, normVal);
}

void AxionikProcessor::setParameterNormalizedByIndex(uint32_t index, float normalizedValue) {
    if (index >= kNumTotalParameters) return;
    float clampedNorm = std::clamp(normalizedValue, 0.0f, 1.0f);
    const auto& desc = kParameterDescriptors[index];
    auto paramId = juce::String(desc.key.data(), desc.key.size());

    // La capa de abstracción APVTS centraliza el estado y notifica al Host / DAW
    if (auto* p = apvts_.getParameter(paramId)) {
        p->setValueNotifyingHost(clampedNorm);
    } else {
        dspEngine_.setParamNormalized(index, clampedNorm);
    }
}

void AxionikProcessor::setMidiPitchBend(float normalizedBipolar) {
    dspEngine_.setPitchBend(std::clamp(normalizedBipolar, -1.0f, 1.0f));
}

void AxionikProcessor::setMidiChannelPressure(float normalizedVal) {
    dspEngine_.setModulationSource(0, std::clamp(normalizedVal, 0.0f, 1.0f)); // Slot 0 = Aftertouch
}

void AxionikProcessor::setMidiController(int ccNum, float ccVal) {
    ccVal = std::clamp(ccVal, 0.0f, 1.0f);

    // 1. Los 6 controladores en tiempo real del Hartmann Neuron (params+0x44) -> Matriz de Modulación
    if (ccNum == kMidiCCModulation) {
        dspEngine_.setModulationSource(1, ccVal);
    } else if (ccNum == kMidiCCBreath) {
        dspEngine_.setModulationSource(2, ccVal);
    } else if (ccNum == kMidiCCCO3) {
        dspEngine_.setModulationSource(3, ccVal);
    } else if (ccNum == kMidiCCFoot || ccNum == 64) {
        dspEngine_.setModulationSource(4, ccVal);
    } else if (ccNum == kMidiCCExpression) {
        dspEngine_.setModulationSource(5, ccVal);
    }
    // 2. Controladores Vectoriales Stick XY canónicos y parámetros primarios
    else if (ccNum == kMidiCCR1ScapeX) {
        setParameterNormalizedByIndex(52, ccVal);
    } else if (ccNum == kMidiCCR1ScapeY) {
        setParameterNormalizedByIndex(53, ccVal);
    } else if (ccNum == kMidiCCR1SphereX) {
        setParameterNormalizedByIndex(42, ccVal);
    } else if (ccNum == kMidiCCR1SphereY) {
        setParameterNormalizedByIndex(43, ccVal);
    } else if (ccNum == kMidiCCR2ScapeX) {
        setParameterNormalizedByIndex(132, ccVal);
    } else if (ccNum == kMidiCCR2ScapeY) {
        setParameterNormalizedByIndex(133, ccVal);
    } else if (ccNum == kMidiCCR2SphereX) {
        setParameterNormalizedByIndex(122, ccVal);
    } else if (ccNum == kMidiCCR2SphereY) {
        setParameterNormalizedByIndex(123, ccVal);
    } else if (ccNum == kMidiCCBlender) {
        setParameterNormalizedByIndex(262, ccVal);
    } else if (ccNum == kMidiCCFilterReso) {
        setParameterNormalizedByIndex(275, ccVal);
    } else if (ccNum == kMidiCCFilterCutoff) {
        setParameterNormalizedByIndex(274, ccVal);
    }
}

void AxionikProcessor::handleMidiEvent(const juce::MidiMessage& msg) {
    if (msg.isNoteOn()) {
        dspEngine_.noteOn(static_cast<uint8_t>(msg.getNoteNumber()), msg.getFloatVelocity());
    } else if (msg.isNoteOff()) {
        dspEngine_.noteOff(static_cast<uint8_t>(msg.getNoteNumber()));
    } else if (msg.isAllNotesOff() || msg.isAllSoundOff()) {
        dspEngine_.allNotesOff();
        nrpnMsb_ = 0; nrpnLsb_ = 0; dataEntryMsb_ = 0; nrpnChannel_ = -1;
    } else if (msg.isController()) {
        int ccNum = msg.getControllerNumber();
        int rawVal = msg.getControllerValue();
        int channel = msg.getChannel();

        // CC 121: Reset All Controllers
        if (ccNum == 121) {
            nrpnMsb_ = 0; nrpnLsb_ = 0; dataEntryMsb_ = 0; nrpnChannel_ = -1;
            return;
        }

        // NRPN timeout (500ms) and channel isolation check
        uint32_t nowMs = juce::Time::getMillisecondCounter();
        if (nrpnChannel_ != -1 && (nrpnChannel_ != channel || (nowMs - lastNrpnTimestampMs_ > 500))) {
            nrpnMsb_ = 0; nrpnLsb_ = 0; dataEntryMsb_ = 0;
        }

        // 1. Desempacador de 14 bits NRPN (CC 99, 98, 6, 38) -> Capa de Abstracción de Parámetros
        if (ccNum == 99) {
            nrpnMsb_ = static_cast<uint8_t>(rawVal & 0x7F);
            nrpnChannel_ = channel;
            lastNrpnTimestampMs_ = nowMs;
        } else if (ccNum == 98) {
            nrpnLsb_ = static_cast<uint8_t>(rawVal & 0x7F);
            nrpnChannel_ = channel;
            lastNrpnTimestampMs_ = nowMs;
        } else if (ccNum == 6) {
            dataEntryMsb_ = static_cast<uint8_t>(rawVal & 0x7F);
            nrpnChannel_ = channel;
            lastNrpnTimestampMs_ = nowMs;
            uint16_t paramIdx = (static_cast<uint16_t>(nrpnMsb_) << 7) | nrpnLsb_;
            float normVal = static_cast<float>(dataEntryMsb_) / 127.0f;
            bool consumed = midiLearnManager_.handleIncomingNRPN(
                channel,
                static_cast<int>(paramIdx),
                normVal,
                static_cast<int>(dataEntryMsb_) << 7,
                [this](int targetIdx, const juce::String&, float outNorm) {
                    if (targetIdx >= 0) setParameterNormalizedByIndex(static_cast<uint32_t>(targetIdx), outNorm);
                });
            if (!consumed && isNrpnParameterAddress(paramIdx)) {
                setParameterNormalizedByIndex(paramIdx, normVal);
            }
        } else if (ccNum == 38) {
            nrpnChannel_ = channel;
            lastNrpnTimestampMs_ = nowMs;
            uint16_t paramIdx = (static_cast<uint16_t>(nrpnMsb_) << 7) | nrpnLsb_;
            uint16_t val14 = (static_cast<uint16_t>(dataEntryMsb_) << 7) | static_cast<uint8_t>(rawVal & 0x7F);
            float normVal = static_cast<float>(val14) / 16383.0f;
            bool consumed = midiLearnManager_.handleIncomingNRPN(
                channel,
                static_cast<int>(paramIdx),
                normVal,
                static_cast<int>(val14),
                [this](int targetIdx, const juce::String&, float outNorm) {
                    if (targetIdx >= 0) setParameterNormalizedByIndex(static_cast<uint32_t>(targetIdx), outNorm);
                });
            if (!consumed && isNrpnParameterAddress(paramIdx)) {
                setParameterNormalizedByIndex(paramIdx, normVal);
            }
        } else if (ccNum == kMidiCCBankSelect) {
            midiBank_ = static_cast<uint8_t>(rawVal & 0x7F);
        } else {
            // 2. MIDI Learn N:M custom mappings first
            bool consumed = midiLearnManager_.handleIncomingCC(
                channel,
                ccNum,
                rawVal,
                [this](int targetIdx, const juce::String&, float outNorm) {
                    if (targetIdx >= 0) setParameterNormalizedByIndex(static_cast<uint32_t>(targetIdx), outNorm);
                });

            // 3. Controladores CC estándar y Matriz de Modulación
            float ccNorm = static_cast<float>(rawVal) / 127.0f;
            if (!consumed) {
                setMidiController(ccNum, ccNorm);
            } else if (ccNum == kMidiCCModulation || ccNum == kMidiCCBreath || ccNum == kMidiCCCO3 ||
                       ccNum == kMidiCCFoot || ccNum == 64 || ccNum == kMidiCCExpression) {
                // Keep real-time performance modulation sources alive even when also used as a MIDI Learn Macro
                setMidiController(ccNum, ccNorm);
            }
        }
    } else if (msg.isProgramChange()) {
        int progNum = msg.getProgramChangeNumber();
        int slot = std::clamp(static_cast<int>(midiBank_) * 100 + progNum, 0, static_cast<int>(kNumFactoryPresets) - 1);
        nrpnMsb_ = 0; nrpnLsb_ = 0; dataEntryMsb_ = 0; nrpnChannel_ = -1;
        loadPresetBySlot(slot);
    } else if (msg.isChannelPressure()) {
        int rawAt = msg.getChannelPressureValue();
        float atVal = static_cast<float>(rawAt) / 127.0f;
        midiLearnManager_.handleIncomingSource(
            abd::hw::MidiLearnManager::SourceType::Aftertouch,
            msg.getChannel(),
            0,
            atVal,
            rawAt,
            [this](int targetIdx, const juce::String&, float outNorm) {
                if (targetIdx >= 0) setParameterNormalizedByIndex(static_cast<uint32_t>(targetIdx), outNorm);
            });
        setMidiChannelPressure(atVal);
    } else if (msg.isPitchWheel()) {
        int val14 = msg.getPitchWheelValue(); // 0..16383, 8192 al centro
        float norm01 = static_cast<float>(val14) / 16383.0f;
        midiLearnManager_.handleIncomingSource(
            abd::hw::MidiLearnManager::SourceType::PitchBend,
            msg.getChannel(),
            0,
            norm01,
            val14,
            [this](int targetIdx, const juce::String&, float outNorm) {
                if (targetIdx >= 0) setParameterNormalizedByIndex(static_cast<uint32_t>(targetIdx), outNorm);
            });
        float bendBipolar = static_cast<float>(val14 - 8192) / 8192.0f;
        setMidiPitchBend(bendBipolar);
    }
}

void AxionikProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages) {
    juce::ScopedNoDenormals noDenormals;

    // 0. Reloj del host (BPM / isPlaying / ppqPosition)
    updateHostClock();

    // 1. Despachar eventos MIDI
    for (const auto metadata : midiMessages) {
        handleMidiEvent(metadata.getMessage());
    }
    midiMessages.clear();

    // 2. Renderizado del motor DSP
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i) {
        buffer.clear(i, 0, buffer.getNumSamples());
    }

    float* channelL = buffer.getWritePointer(0);
    float* channelR = (totalNumOutputChannels > 1) ? buffer.getWritePointer(1) : channelL;

    dspEngine_.process(channelL, channelR, static_cast<size_t>(buffer.getNumSamples()));
}

void AxionikProcessor::updateHostClock() {
    double bpm = 0.0;
    double ppq = -1.0;
    bool playing = false;

    if (auto* playHead = getPlayHead()) {
        if (const auto position = playHead->getPosition()) {
            if (const auto hostBpm = position->getBpm()) bpm = *hostBpm;
            if (const auto hostPpq = position->getPpqPosition()) ppq = *hostPpq;
            playing = position->getIsPlaying();
        }
    }

    hostBpm_.store(bpm, std::memory_order_relaxed);
    hostIsPlaying_.store(playing, std::memory_order_relaxed);
    hostPpqPosition_.store(ppq, std::memory_order_relaxed);

    // Alineación de la modulación con el transporte del DAW: en el flanco de arranque
    // (Play) o tras un salto hacia atrás (loop/seek) se reinicia la fase del LFO global
    // y del Master Mod FX. No se tocan los buffers del Slicer para no introducir clics.
    const bool transportRestarted =
        playing && (!wasHostPlaying_
                    || (ppq >= 0.0 && lastHostPpq_ >= 0.0 && ppq < lastHostPpq_ - 1.0e-6));

    if (transportRestarted) {
        dspEngine_.resetModulationPhase();
    }

    wasHostPlaying_ = playing;
    if (ppq >= 0.0) lastHostPpq_ = ppq;
}

double AxionikProcessor::getTailLengthSeconds() const {
    // `kParameterDescriptors` está indexado por índice de parámetro (verificado por
    // Scripts/registry_generator.js --check), así que ParamIdx sirve como posición.
    auto rawOf = [this](size_t index) -> float {
        const auto& desc = kParameterDescriptors[index];
        const auto key = juce::String(desc.key.data(), desc.key.size());
        if (auto* value = apvts_.getRawParameterValue(key)) return value->load();
        return desc.defaultValue;
    };
    auto normOf = [&rawOf](size_t index) -> float {
        const auto& desc = kParameterDescriptors[index];
        const float span = desc.max - desc.min;
        if (span <= 0.0f) return 0.0f;
        return juce::jlimit(0.0f, 1.0f, (rawOf(index) - desc.min) / span);
    };

    if (rawOf(ParamIdx::SoundMFXSwitch) <= 0.5f) return 0.0;

    constexpr double kMinus60Db = 0.001; // umbral de cola audible
    const double sr = std::max(8000.0, currentSampleRate_.load(std::memory_order_relaxed));
    double tail = 0.0;

    // Delay maestro: N repeticiones hasta -60 dB a partir del tiempo mayor y del feedback real.
    if (rawOf(ParamIdx::SoundMFXDelaySwitch) > 0.5f) {
        const float mix = normOf(ParamIdx::SoundMFXDelayMix);
        if (mix > 0.001f) {
            const float timeMs = std::max(rawOf(ParamIdx::SoundMFXDelayLTime),
                                          rawOf(ParamIdx::SoundMFXDelayRTime));
            // DspNeuronMasterTimeFX recibe raw/64 y lo recorta a ±0.85.
            const float feedback = juce::jlimit(0.0f, 0.85f,
                                                std::abs(rawOf(ParamIdx::SoundMFXDelayFeedback)) / 64.0f);
            const double repeats = feedback > 0.001f
                ? std::clamp(std::ceil(std::log(kMinus60Db) / std::log(static_cast<double>(feedback))), 1.0, 64.0)
                : 1.0;
            tail = std::max(tail, static_cast<double>(timeMs) * 0.001 * repeats * mix);
        }
    }

    // Reverb maestra: RT60 del FDN 8x8 a partir de su tiempo de bucle medio y el
    // feedback real (decayNorm * 0.85), escalado por la mezcla wet.
    if (rawOf(ParamIdx::SoundMFXReverbSwitch) > 0.5f) {
        const float mix = normOf(ParamIdx::SoundMFXReverbMix);
        if (mix > 0.001f) {
            constexpr double kMeanLoopSamples = 2988.0; // media de baseLens (1433..4877) a 44.1 kHz
            constexpr double kRoomSizeScale = 0.65;     // 0.3 + 0.7 * roomSize(0.5) en DspFdnReverb
            const double loopSeconds = kMeanLoopSamples * kRoomSizeScale / sr;
            const double feedback = juce::jlimit(0.05, 0.85,
                                                 static_cast<double>(normOf(ParamIdx::SoundMFXRevDecayTime)) * 0.85);
            const double rt60 = -3.0 * loopSeconds / std::log10(feedback);
            tail = std::max(tail, rt60 * mix);
        }
    }

    return tail;
}

juce::AudioProcessorEditor* AxionikProcessor::createEditor() {
    AX_LOG("[PROCESSOR] createEditor() called, creating AxionikEditor...");
    return new AxionikEditor(*this);
}

void AxionikProcessor::setCurrentProgram(int index) {
    int clampedIndex = std::clamp(index, 0, static_cast<int>(kNumFactoryPresets) - 1);
    int slot = getSlotForProgramIndex(clampedIndex);
    if (loadPresetBySlot(slot)) {
        currentProgram_ = clampedIndex;
    }
}

const juce::String AxionikProcessor::getProgramName(int index) {
    if (index < 0 || index >= static_cast<int>(kNumFactoryPresets)) return "Init Sound";
    const auto& entry = kFactoryPresetList[static_cast<size_t>(index)];
    char buf[96];
    std::snprintf(buf, sizeof(buf), "%03d: %.*s", entry.slot, static_cast<int>(entry.name.size()), entry.name.data());
    return juce::String(buf);
}

void AxionikProcessor::changeProgramName(int index, const juce::String& newName) {
    // Intencionalmente no-op: la lista de factory presets se gestiona desde el generado
    // (FactoryPresets.gen.h). Los nombres provienen de NeuronDB/catalogo, no son editables desde aquí.
    juce::ignoreUnused(index, newName);
}

void AxionikProcessor::getStateInformation(juce::MemoryBlock& destData) {
    auto state = apvts_.copyState();
    auto existingMl = state.getChildWithName("MidiLearn");
    if (existingMl.isValid()) {
        state.removeChild(existingMl, nullptr);
    }
    state.addChild(midiLearnManager_.saveState(), -1, nullptr);
    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}

void AxionikProcessor::setStateInformation(const void* data, int sizeInBytes) {
    if (data == nullptr || sizeInBytes < 16) {
        AX_LOG("[PROCESSOR] setStateInformation: invalid or truncated state data received");
        return;
    }

    // En modo Standalone, conservar el arranque limpio en 000: Init Sound (evita que JUCE Standalone
    // restaure silenciosamente un estado previo incompleto o mudo desde ABDAxionikVS.settings).
    if (wrapperType == wrapperType_Standalone) {
        AX_LOG("[PROCESSOR] setStateInformation ignored in Standalone mode (preserving 000: Init Sound).");
        return;
    }

    std::unique_ptr<juce::XmlElement> xmlState(getXmlFromBinary(data, sizeInBytes));
    if (xmlState != nullptr && xmlState->hasTagName(apvts_.state.getType())) {
        {
            const juce::ScopedLock sl(getCallbackLock());
            isSyncingPreset_.store(true, std::memory_order_release);
            auto loadedTree = juce::ValueTree::fromXml(*xmlState);
            auto mlChild = loadedTree.getChildWithName("MidiLearn");
            if (mlChild.isValid()) {
                midiLearnManager_.loadState(mlChild);
            }
            apvts_.replaceState(loadedTree);

            auto& store = dspEngine_.getStore();
            for (uint32_t i = 0; i < kNumTotalParameters; ++i) {
                const auto& desc = kParameterDescriptors[i];
                auto paramId = juce::String(desc.key.data(), desc.key.size());
                if (auto* rawPtr = apvts_.getRawParameterValue(paramId)) {
                    store.setRawValue(i, rawPtr->load(), false);
                }
            }
            store.notifyAll();

            int r1Model = static_cast<int>(std::round(store.getRawValue(abd::axionik::ParamIdx::R1ModellIndex)));
            int r2Model = static_cast<int>(std::round(store.getRawValue(abd::axionik::ParamIdx::R2ModellIndex)));
            dspEngine_.loadModelBySlot(0, std::clamp(r1Model, 0, 511));
            dspEngine_.loadModelBySlot(1, std::clamp(r2Model, 0, 511));
            isSyncingPreset_.store(false, std::memory_order_release);
        }
        syncApvtsFromDspEngine();
    }
}

juce::String AxionikProcessor::getNeuronDbCatalogJson() {
    return juce::String(dspEngine_.getBankAdapter().scanCatalogJson());
}

} // namespace abd::axionik

#ifdef _WIN32
#include <windows.h>
static LONG WINAPI AxionikCrashFilter(EXCEPTION_POINTERS* ep) {
    if (ep && ep->ExceptionRecord) {
        char buf[256];
        std::snprintf(buf, sizeof(buf), "[CRASH] Unhandled Exception 0x%08X at address 0x%p",
                      ep->ExceptionRecord->ExceptionCode, ep->ExceptionRecord->ExceptionAddress);
        AX_LOG(buf);
    } else {
        AX_LOG("[CRASH] Unknown unhandled exception occurred.");
    }
    return EXCEPTION_CONTINUE_SEARCH;
}
#endif

// Factoria JUCE
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
#ifdef _WIN32
    SetUnhandledExceptionFilter(AxionikCrashFilter);
#endif
    AX_LOG("[FACTORY] createPluginFilter() called.");
    return new abd::axionik::AxionikProcessor();
}
