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

    /// Procesamiento de un bloque de audio estéreo
    void process(float* leftChannel, float* rightChannel, size_t numSamples);

    /// Telemetría y diagnóstico para la WebUI / Host
    [[nodiscard]] Telemetry getTelemetry() const noexcept;

    /// Acceso al almacén de configuración de 445 parámetros
    [[nodiscard]] SndDatStore& getStore() noexcept { return store_; }
    [[nodiscard]] const SndDatStore& getStore() const noexcept { return store_; }

    /// Acceso al adaptador de banco de modelos
    [[nodiscard]] NeuronBankAdapter& getBankAdapter() noexcept { return bankAdapter_; }

private:
    double sampleRate_{44100.0};
    size_t maxBlockSize_{512};
    uint32_t activeVoices_{0};
    float cpuUsage_{0.0f};

    SndDatStore store_;
    std::unique_ptr<ParameterEngineBridge> bridge_;
    NeuronBankAdapter bankAdapter_;
    VoicePool voicePool_;
    BlockRenderer blockRenderer_;
};

} // namespace abd::axionik
