// ============================================================================
// ABDAxionikVS — DspEngineFacade.h
// Fachada desacoplada del motor DSP de ABDAxionikVS (JUCE-free, C++20)
// Integra SndDatStore, ParameterEngineBridge, NeuronBankAdapter y Translator
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <memory>
#include <filesystem>
#include "DspTypes.h"
#include "State/SndDatStore.h"
#include "ParameterEngineBridge.h"
#include "NeuronBankAdapter.h"
#include "VoicePool.h"
#include "BlockRenderer.h"
#include "StickPlayer.h"
#include <functional>

namespace abd::axionik {

class DspEngineFacade {
public:
    DspEngineFacade();
    ~DspEngineFacade();

    // No copiable ni asignable
    DspEngineFacade(const DspEngineFacade&) = delete;
    DspEngineFacade& operator=(const DspEngineFacade&) = delete;

    /// Inicialización y configuración de frecuencia de muestreo
    void prepare(double sampleRate, size_t maxBlockSize);

    /// Reinicio del estado interno y silenciamiento de voces
    void reset();

    /// Notificación de eventos MIDI
    void noteOn(uint8_t note, float velocity);
    void noteOff(uint8_t note);
    void allNotesOff();

    /// Actualización de parámetros de síntesis
    void setParam(uint32_t index, float rawValue);
    void setParamNormalized(uint32_t index, float normalizedValue);

    /// Carga de modelos para R1 (slot 0) o R2 (slot 1)
    bool loadModel(int slot, const std::filesystem::path& modelFolder);
    bool loadModelBySlot(int slot, int modelIndex) {
        if (!bridge_) return false;
        return bankAdapter_.loadModelBySlot(slot, modelIndex, bridge_->getEngineState());
    }

    /// Carga de presets completos (.sound)
    bool loadPreset(const std::filesystem::path& soundFolder);
    bool loadPresetFromScript(const std::string& scriptText);
    bool loadPresetBySlot(int slot) {
        SoundPreset preset;
        if (!bankAdapter_.loadPresetBySlot(slot, preset)) {
            return false;
        }
        return applyPreset(preset);
    }
    bool applyPreset(const SoundPreset& preset);

    /// Preset actualmente cargado
    [[nodiscard]] const SoundPreset& getCurrentPreset() const noexcept { return currentPreset_; }

    /// Procesamiento de un bloque de audio estéreo
    void process(float* leftChannel, float* rightChannel, size_t numSamples);

    /// Telemetría y diagnóstico para la WebUI / Host
    [[nodiscard]] Telemetry getTelemetry() const noexcept;

    /// Acceso al almacén de configuración de 445 parámetros
    [[nodiscard]] SndDatStore& getStore() noexcept { return store_; }
    [[nodiscard]] const SndDatStore& getStore() const noexcept { return store_; }

    /// Acceso al adaptador de banco de modelos
    [[nodiscard]] NeuronBankAdapter& getBankAdapter() noexcept { return bankAdapter_; }

    /// Configura el callback para notificar al host de cambios producidos por el StickPlayer
    void setOnStickParamChanged(std::function<void(uint32_t, float)> callback) {
        onStickParamChanged_ = std::move(callback);
    }

    [[nodiscard]] StickPlayer& getStickPlayer() noexcept { return stickPlayer_; }
    [[nodiscard]] const StickPlayer& getStickPlayer() const noexcept { return stickPlayer_; }

    /// Acceso al bloque de estado de 13.948 bytes del motor y al puente de observadores
    [[nodiscard]] uint32_t* getEngineState() noexcept {
        return bridge_ ? bridge_->getEngineState() : nullptr;
    }
    [[nodiscard]] const uint32_t* getEngineState() const noexcept {
        return bridge_ ? bridge_->getEngineState() : nullptr;
    }
    [[nodiscard]] ParameterEngineBridge* getBridge() noexcept { return bridge_.get(); }
    [[nodiscard]] const ParameterEngineBridge* getBridge() const noexcept { return bridge_.get(); }

    /// Controladores de modulación en tiempo real (0xD0 Aftertouch, CC1 ModWheel, CC2 Breath, CC3, CC4 Foot, CC11 Expression)
    void setModulationSource(int sourceIndex, float normalizedVal) noexcept {
        if (sourceIndex >= 0 && sourceIndex < 6) {
            float clamped = std::clamp(normalizedVal, 0.0f, 1.0f);
            modControllers_[sourceIndex] = clamped;
            if (bridge_) {
                bridge_->setModulationSource(static_cast<size_t>(sourceIndex), clamped);
            }
        }
    }

    /// Rueda de Pitch Bend (-1.0 .. +1.0)
    void setPitchBend(float normalizedBipolar) noexcept {
        pitchBendWheel_ = std::clamp(normalizedBipolar, -1.0f, 1.0f);
    }

    /// Conmutador de modo de limitación Clip-to-Zero (false por defecto = musical limpio; true = bug histórico 0x1000bc40)
    void setOracleClipToZeroMode(bool enabled) noexcept {
        blockRenderer_.setOracleClipToZeroMode(enabled);
    }
    [[nodiscard]] bool getOracleClipToZeroMode() const noexcept {
        return blockRenderer_.getOracleClipToZeroMode();
    }

private:
    double sampleRate_{44100.0};
    size_t maxBlockSize_{512};
    uint32_t activeVoices_{0};
    float cpuUsage_{0.0f};
    float peakL_{0.0f};
    float peakR_{0.0f};
    double globalLfoPhase_{0.0};

    std::array<float, 6> modControllers_{};
    float pitchBendWheel_{0.0f};
    size_t antiPopTotalSamples_{88};
    size_t antiPopRemaining_{0};

    SndDatStore store_;
    SoundPreset currentPreset_;
    StickPlayer stickPlayer_;
    std::function<void(uint32_t, float)> onStickParamChanged_;
    std::unique_ptr<ParameterEngineBridge> bridge_;
    NeuronBankAdapter bankAdapter_;
    VoicePool voicePool_;
    BlockRenderer blockRenderer_;
};

} // namespace abd::axionik
