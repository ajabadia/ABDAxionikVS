// ============================================================================
// ABDAxionikVS — PluginProcessor.cpp
// Implementación del procesador de audio JUCE 9
// ============================================================================

#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "AppLogger.h"

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
    // Escuchar cambios de parámetros para reflejarlos en dspEngine_
    for (const auto& desc : kParameterDescriptors) {
        apvts_.addParameterListener(juce::String(desc.key.data(), desc.key.size()), this);
    }
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
    // Buscar el descriptor
    for (const auto& desc : kParameterDescriptors) {
        if (parameterID == juce::String(desc.key.data(), desc.key.size())) {
            dspEngine_.setParam(desc.index, newValue);
            break;
        }
    }
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

void AxionikProcessor::handleMidiEvent(const juce::MidiMessage& msg) {
    if (msg.isNoteOn()) {
        dspEngine_.noteOn(static_cast<uint8_t>(msg.getNoteNumber()), msg.getFloatVelocity());
    } else if (msg.isNoteOff()) {
        dspEngine_.noteOff(static_cast<uint8_t>(msg.getNoteNumber()));
    } else if (msg.isAllNotesOff() || msg.isAllSoundOff()) {
        dspEngine_.allNotesOff();
    } else if (msg.isController()) {
        int ccNum = msg.getControllerNumber();
        int rawVal = msg.getControllerValue();
        float ccVal = static_cast<float>(rawVal) / 127.0f;

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
        }
        // 2. Los 6 controles en tiempo real del Hartmann Neuron (params+0x44) -> Capa de Abstracción
        else if (ccNum == kMidiCCModulation) {
            setParameterNormalizedByIndex(static_cast<uint32_t>(ParamID::ModulationDepth), ccVal);
        } else if (ccNum == kMidiCCBreath) {
            setParameterNormalizedByIndex(static_cast<uint32_t>(ParamID::BreathDepth), ccVal);
        } else if (ccNum == kMidiCCCO3) {
            setParameterNormalizedByIndex(static_cast<uint32_t>(ParamID::CC03Depth), ccVal);
        } else if (ccNum == kMidiCCFoot) {
            setParameterNormalizedByIndex(static_cast<uint32_t>(ParamID::FootDepth), ccVal);
        } else if (ccNum == kMidiCCExpression) {
            setParameterNormalizedByIndex(static_cast<uint32_t>(ParamID::ExpressionDepth), ccVal);
        }
        // 3. Controladores Vectoriales Stick XY canónicos y parámetros primarios
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
        } else if (ccNum == kMidiCCBlender) {
            setParameterNormalizedByIndex(262, ccVal);
        } else if (ccNum == kMidiCCFilterReso) {
            setParameterNormalizedByIndex(275, ccVal);
        } else if (ccNum == kMidiCCFilterCutoff) {
            setParameterNormalizedByIndex(274, ccVal);
        }
    } else if (msg.isChannelPressure()) {
        float atVal = static_cast<float>(msg.getChannelPressureValue()) / 127.0f;
        setParameterNormalizedByIndex(static_cast<uint32_t>(ParamID::AftertouchDepth), atVal);
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
    currentProgram_ = std::clamp(index, 0, 99);
}

const juce::String AxionikProcessor::getProgramName(int index) {
    return "Neuron Sound " + juce::String(index);
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
