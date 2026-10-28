// ============================================================================
// ABDAxionikVS — PluginProcessor.h
// Procesador de Audio JUCE 9 para Standalone y VST3
// ============================================================================

#pragma once

#include <unordered_map>
#include <mutex>
#include <vector>
#include <atomic>
#include <juce_audio_processors/juce_audio_processors.h>
#include "DSP/DspEngineFacade.h"
#include "Generated/ParameterRegistry.gen.h"
#include "Generated/Conversion.gen.h"
#include "Generated/MidiMapping.gen.h"
#include "Generated/BuildVersion.gen.h"
#include "Generated/FactoryPresets.gen.h"

namespace abd::axionik {

class AxionikProcessor : public juce::AudioProcessor,
                         public juce::AudioProcessorValueTreeState::Listener {
public:
    struct ParamChange {
        uint32_t index;
        float value;
    };

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

    int getNumPrograms() override { return static_cast<int>(kNumFactoryPresets); }
    int getCurrentProgram() override { return currentProgram_; }
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramName(int index, const juce::String& newName) override;

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    void parameterChanged(const juce::String& parameterID, float newValue) override;

    /// Capa de abstracción de parámetros: punto de entrada unificado para UI, MIDI CC/NRPN/SysEx y Host
    void setParameterByIndex(uint32_t index, float rawValue);
    void setParameterNormalizedByIndex(uint32_t index, float normalizedValue);

    /// Controladores en tiempo real (Pitch Bend, Channel Pressure/Aftertouch, CCs estándar y NRPN)
    /// compartidos de forma idéntica entre MIDI físico y UI / pantalla táctil
    void setMidiPitchBend(float normalizedBipolar);            // -1.0 .. +1.0
    void setMidiChannelPressure(float normalizedVal);          //  0.0 .. 1.0
    void setMidiController(int ccNumber, float normalizedVal); //  0.0 .. 1.0

    /// Carga y sincronización de presets y modelos con APVTS y Host
    bool loadPresetFromScript(const std::string& scriptText);
    bool loadPresetBySlot(int slot);
    bool loadModelBySlot(int slot, int modelIndex);
    void initPreset();
    void syncApvtsFromDspEngine();
    juce::String getNeuronDbCatalogJson();

    struct PresetEvent {
        bool hasEvent{false};
        juce::String name;
        int r1Model{511};
        int r2Model{511};
    };

    /// Extrae de forma segura los cambios de parámetros pendientes para sincronizar la WebUI
    std::vector<ParamChange> drainPendingUiParamChanges();
    PresetEvent drainPendingPresetEvent();

    DspEngineFacade& getDspEngine() noexcept { return dspEngine_; }
    juce::AudioProcessorValueTreeState& getAPVTS() noexcept { return apvts_; }

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

private:
    void handleMidiEvent(const juce::MidiMessage& msg);

    DspEngineFacade dspEngine_;
    juce::AudioProcessorValueTreeState apvts_;
    int currentProgram_{0};
    std::atomic<bool> isSyncingPreset_{false};

    // Mapa de búsqueda O(1) de clave APVTS a índice de parámetro
    std::unordered_map<juce::String, uint32_t> paramIdToIndex_;

    // Cola de sincronización bidireccional APVTS -> WebUI
    std::mutex uiParamMutex_;
    std::vector<ParamChange> pendingUiChanges_;
    PresetEvent pendingPresetEvent_;

    // Estado del desempacador NRPN de 14 bits
    uint8_t nrpnMsb_{0};
    uint8_t nrpnLsb_{0};
    uint8_t dataEntryMsb_{0};
    uint8_t midiBank_{0}; // MIDI Bank Select LSB (CC 32)

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AxionikProcessor)
};

} // namespace abd::axionik
