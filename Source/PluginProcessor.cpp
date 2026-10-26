// ============================================================================
// ABDAxionikVS — PluginProcessor.cpp
// Implementación del procesador de audio JUCE 9
// ============================================================================

#include "PluginProcessor.h"
#include "PluginEditor.h"

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
    // Escuchar cambios de parámetros para reflejarlos en dspEngine_
    for (const auto& desc : kParameterDescriptors) {
        apvts_.addParameterListener(juce::String(desc.key.data(), desc.key.size()), this);
    }
}

AxionikProcessor::~AxionikProcessor() {
    for (const auto& desc : kParameterDescriptors) {
        apvts_.removeParameterListener(juce::String(desc.key.data(), desc.key.size()), this);
    }
}

void AxionikProcessor::prepareToPlay(double sampleRate, int samplesPerBlock) {
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

void AxionikProcessor::handleMidiEvent(const juce::MidiMessage& msg) {
    if (msg.isNoteOn()) {
        dspEngine_.noteOn(static_cast<uint8_t>(msg.getNoteNumber()), msg.getFloatVelocity());
    } else if (msg.isNoteOff()) {
        dspEngine_.noteOff(static_cast<uint8_t>(msg.getNoteNumber()));
    } else if (msg.isAllNotesOff() || msg.isAllSoundOff()) {
        dspEngine_.allNotesOff();
    } else if (msg.isController()) {
        // Enlazar los 6 controles MIDI del Hartmann Neuron
        int ccNum = msg.getControllerNumber();
        float ccVal = static_cast<float>(msg.getControllerValue()) / 127.0f;
        if (ccNum == kMidiCCModulation) {
            dspEngine_.setParamNormalized(static_cast<uint32_t>(ParamID::ModulationDepth), ccVal);
        } else if (ccNum == kMidiCCBreath) {
            dspEngine_.setParamNormalized(static_cast<uint32_t>(ParamID::BreathDepth), ccVal);
        } else if (ccNum == kMidiCCCO3) {
            dspEngine_.setParamNormalized(static_cast<uint32_t>(ParamID::CC03Depth), ccVal);
        } else if (ccNum == kMidiCCFoot) {
            dspEngine_.setParamNormalized(static_cast<uint32_t>(ParamID::FootDepth), ccVal);
        } else if (ccNum == kMidiCCExpression) {
            dspEngine_.setParamNormalized(static_cast<uint32_t>(ParamID::ExpressionDepth), ccVal);
        }
    } else if (msg.isChannelPressure()) {
        float atVal = static_cast<float>(msg.getChannelPressureValue()) / 127.0f;
        dspEngine_.setParamNormalized(static_cast<uint32_t>(ParamID::AftertouchDepth), atVal);
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

// Factoria JUCE
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() {
    return new abd::axionik::AxionikProcessor();
}
