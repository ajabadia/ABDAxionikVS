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
#include <HardwareDrivers/MidiLearnManager.h>
#include <Scope/Source/Core/SpscRingBuffer.h>

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
    /// Cola real del Master FX (Delay maestro + Reverb maestra, [430..444]).
    double getTailLengthSeconds() const override;

    /// Reloj del host capturado en cada bloque (`juce::AudioPlayHead`).
    double getHostBpm() const noexcept { return hostBpm_.load(std::memory_order_relaxed); }
    bool isHostPlaying() const noexcept { return hostIsPlaying_.load(std::memory_order_relaxed); }
    double getHostPpqPosition() const noexcept { return hostPpqPosition_.load(std::memory_order_relaxed); }

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

    /// Gestos de automatización para los controles con arrastre de la WebUI.
    /// Un arrastre emite cientos de PARAM_SET pero es UN gesto para el host:
    /// sin begin/end, graba un punto por paso y el undo no revierte el movimiento.
    void beginParameterGestureByIndex(uint32_t index);
    void endParameterGestureByIndex(uint32_t index);

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
    abd::hw::MidiLearnManager& getMidiLearnManager() noexcept { return midiLearnManager_; }
    const abd::hw::MidiLearnManager& getMidiLearnManager() const noexcept { return midiLearnManager_; }

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

private:
    void handleMidiEvent(const juce::MidiMessage& msg);

    DspEngineFacade dspEngine_;
    juce::AudioProcessorValueTreeState apvts_;
    int currentProgram_{0};
    std::atomic<bool> isSyncingPreset_{false};

    // Mapa de búsqueda O(1) de clave APVTS a índice de parámetro
    std::unordered_map<juce::String, uint32_t> paramIdToIndex_;

    // Gestos abiertos desde la WebUI, por índice de parámetro: JUCE empareja
    // begin/end, así que un end sin su begin se descarta aquí y no llega al host.
    std::vector<uint8_t> openGestureFlags_{};

    // Cola lock-free SPSC para cambios de parámetros desde el hilo de audio (StickPlayer)
    abd::scope::SpscRingBuffer<ParamChange> stickParamQueue_{1024};

    // Cola de sincronización bidireccional APVTS -> WebUI (hilo de mensajes / UI)
    std::mutex uiParamMutex_;
    std::vector<ParamChange> pendingUiChanges_;
    PresetEvent pendingPresetEvent_;

    // Estado del desempacador NRPN de 14 bits
    uint8_t nrpnMsb_{0};
    uint8_t nrpnLsb_{0};
    uint8_t dataEntryMsb_{0};
    int nrpnChannel_{-1};
    uint32_t lastNrpnTimestampMs_{0};
    uint8_t midiBank_{0}; // MIDI Bank Select LSB (CC 32)
    abd::hw::MidiLearnManager midiLearnManager_;

    // Reloj del host (juce::AudioPlayHead): BPM, transporte y posición en negras
    void updateHostClock();
    std::atomic<double> hostBpm_{0.0};
    std::atomic<bool> hostIsPlaying_{false};
    std::atomic<double> hostPpqPosition_{-1.0};
    std::atomic<double> currentSampleRate_{44100.0};
    bool wasHostPlaying_{false};   // solo hilo de audio
    double lastHostPpq_{-1.0};     // solo hilo de audio

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(AxionikProcessor)
};

} // namespace abd::axionik
