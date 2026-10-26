// ============================================================================
// ABDAxionikVS — PluginProcessor.h
// Procesador de Audio JUCE 9 para Standalone y VST3
// ============================================================================

#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include "DSP/DspEngineFacade.h"
#include "Generated/ParameterRegistry.gen.h"
#include "Generated/Conversion.gen.h"
#include "Generated/MidiMapping.gen.h"
#include "Generated/BuildVersion.gen.h"

namespace abd::axionik {

class AxionikProcessor : public juce::AudioProcessor,
                         public juce::AudioProcessorValueTreeState::Listener {
public:
    AxionikProcessor();
    ~AxionikProcessor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return kProductName; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 100; }
    int getCurrentProgram() override { return currentProgram_; }
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramName(int index, const juce::String& newName) override;

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    void parameterChanged(const juce::String& parameterID, float newValue) override;

    DspEngineFacade& getDspEngine() noexcept { return dspEngine_; }
    juce::AudioProcessorValueTreeState& getAPVTS() noexcept { return apvts_; }

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

private:
    void handleMidiEvent(const juce::MidiMessage& msg);

    DspEngineFacade dspEngine_;
    juce::AudioProcessorValueTreeState apvts_;
    int currentProgram_{0};

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AxionikProcessor)
};

} // namespace abd::axionik
