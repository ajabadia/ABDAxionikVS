// ============================================================================
// ABDAxionikVS — PluginProcessor.cpp
// Implementación del procesador de audio JUCE 9
// ============================================================================

#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "AppLogger.h"
#include "DSP/AxionikParamIndices.h"

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
    dspEngine_.prepare(sampleRate, static_cast<size_t>(samplesPerBlock));
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
    if (!dspEngine_.loadPresetFromScript(scriptText)) {
        return false;
    }
    syncApvtsFromDspEngine();
    return true;
}

bool AxionikProcessor::loadPresetBySlot(int slot) {
    AX_LOG(juce::String("[PRESET] loadPresetBySlot called with slot=") + juce::String(slot));
    if (!dspEngine_.loadPresetBySlot(slot)) {
        AX_LOG(juce::String("[PRESET] dspEngine_.loadPresetBySlot FAILED for slot=") + juce::String(slot));
        return false;
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
    bool ok = dspEngine_.loadModelBySlot(slot, modelIndex);
    if (ok) {
        uint32_t paramIdx = (slot == 0) ? abd::axionik::ParamIdx::R1ModellIndex : abd::axionik::ParamIdx::R2ModellIndex;
        setParameterByIndex(paramIdx, static_cast<float>(modelIndex));
    }
    return ok;
}

void AxionikProcessor::initPreset() {
    auto initPreset = NeuronSound::getEmbeddedInitPreset();
    dspEngine_.applyPreset(initPreset);
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
    } else if (ccNum == kMidiCCFoot) {
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
        nrpnMsb_ = 0; nrpnLsb_ = 0; dataEntryMsb_ = 0;
    } else if (msg.isController()) {
        int ccNum = msg.getControllerNumber();
        int rawVal = msg.getControllerValue();

        // 1. Desempacador de 14 bits NRPN (CC 99, 98, 6, 38) -> Capa de Abstracción de Parámetros
        if (ccNum == 99) {
            nrpnMsb_ = static_cast<uint8_t>(rawVal & 0x7F);
        } else if (ccNum == 98) {
            nrpnLsb_ = static_cast<uint8_t>(rawVal & 0x7F);
        } else if (ccNum == 6) {
            dataEntryMsb_ = static_cast<uint8_t>(rawVal & 0x7F);
            uint16_t paramIdx = (static_cast<uint16_t>(nrpnMsb_) << 7) | nrpnLsb_;
            if (isNrpnParameterAddress(paramIdx)) {
                setParameterNormalizedByIndex(paramIdx, static_cast<float>(dataEntryMsb_) / 127.0f);
            }
        } else if (ccNum == 38) {
            uint16_t paramIdx = (static_cast<uint16_t>(nrpnMsb_) << 7) | nrpnLsb_;
            if (isNrpnParameterAddress(paramIdx)) {
                uint16_t val14 = (static_cast<uint16_t>(dataEntryMsb_) << 7) | static_cast<uint8_t>(rawVal & 0x7F);
                setParameterNormalizedByIndex(paramIdx, static_cast<float>(val14) / 16383.0f);
            }
        } else if (ccNum == kMidiCCBankSelect) {
            midiBank_ = static_cast<uint8_t>(rawVal & 0x7F);
        } else {
            // Controladores CC estándar y Matriz de Modulación
            setMidiController(ccNum, static_cast<float>(rawVal) / 127.0f);
        }
    } else if (msg.isProgramChange()) {
        int progNum = msg.getProgramChangeNumber();
        int slot = static_cast<int>(midiBank_) * 100 + progNum;
        loadPresetBySlot(slot);
    } else if (msg.isChannelPressure()) {
        float atVal = static_cast<float>(msg.getChannelPressureValue()) / 127.0f;
        setMidiChannelPressure(atVal);
    } else if (msg.isPitchWheel()) {
        int val14 = msg.getPitchWheelValue(); // 0..16383, 8192 al centro
        float bendBipolar = static_cast<float>(val14 - 8192) / 8192.0f;
        setMidiPitchBend(bendBipolar);
    }
}

void AxionikProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages) {
    juce::ScopedNoDenormals noDenormals;

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

juce::AudioProcessorEditor* AxionikProcessor::createEditor() {
    AX_LOG("[PROCESSOR] createEditor() called, creating AxionikEditor...");
    return new AxionikEditor(*this);
}

void AxionikProcessor::setCurrentProgram(int index) {
    currentProgram_ = std::clamp(index, 0, static_cast<int>(kNumFactoryPresets) - 1);
    int slot = getSlotForProgramIndex(currentProgram_);
    loadPresetBySlot(slot);
}

const juce::String AxionikProcessor::getProgramName(int index) {
    if (index < 0 || index >= static_cast<int>(kNumFactoryPresets)) return "Init Sound";
    const auto& entry = kFactoryPresetList[static_cast<size_t>(index)];
    char buf[96];
    std::snprintf(buf, sizeof(buf), "%03d: %.*s", entry.slot, static_cast<int>(entry.name.size()), entry.name.data());
    return juce::String(buf);
}

void AxionikProcessor::changeProgramName(int index, const juce::String& newName) {
    juce::ignoreUnused(index, newName);
}

void AxionikProcessor::getStateInformation(juce::MemoryBlock& destData) {
    auto state = apvts_.copyState();
    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}

void AxionikProcessor::setStateInformation(const void* data, int sizeInBytes) {
    std::unique_ptr<juce::XmlElement> xmlState(getXmlFromBinary(data, sizeInBytes));
    if (xmlState != nullptr && xmlState->hasTagName(apvts_.state.getType())) {
        apvts_.replaceState(juce::ValueTree::fromXml(*xmlState));
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
