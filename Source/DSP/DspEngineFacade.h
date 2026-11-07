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
#include "AxionikCalibrationConfig.h"
#include "State/SndDatStore.h"
#include "ParameterEngineBridge.h"
#include "NeuronBankAdapter.h"
#include "VoicePool.h"
#include "BlockRenderer.h"
#include "StickPlayer.h"
#include "Extended/AxionikExpandedSynthesizer.h"
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

    /// Reinicia la fase de la modulación global (LFO y Master Mod FX) sin tocar
    /// los buffers de audio: se invoca al arrancar el transporte del host.
    void resetModulationPhase() noexcept;

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
        if (slot >= 0 && slot < 2) {
            expandedSynths_[static_cast<size_t>(slot)].clearModel();
        }
        voicePool_.reset();
        activeVoices_ = 0;
        bool ok = bankAdapter_.loadModelBySlot(slot, modelIndex, bridge_->getEngineState());
        if (ok) {
            if (slot == 0) currentPreset_.r1ModelIndex = modelIndex;
            else if (slot == 1) currentPreset_.r2ModelIndex = modelIndex;
            blockRenderer_.reset();
            antiPopRemaining_ = antiPopTotalSamples_;
        }
        return ok;
    }

    // =========================================================================
    // Fase B (11.5.6): Modelos Extendidos (05_extended_model/axionik-expanded.json)
    // =========================================================================
    void setEngineCapabilityProfile(const extended::AxionikEngineCapabilityProfile& profile) noexcept {
        engineProfile_ = profile;
    }
    [[nodiscard]] const extended::AxionikEngineCapabilityProfile& getEngineCapabilityProfile() const noexcept {
        return engineProfile_;
    }

    /// Modo máximo permitido por el binario compilado (`AXIONIK_TARGET_MODEL`: 0=classic, 1=plus, 2=expanded).
    [[nodiscard]] static constexpr std::string_view getCompileTargetMode() noexcept {
#if AXIONIK_TARGET_MODEL == 0
        return "classic";
#elif AXIONIK_TARGET_MODEL == 1
        return "plus";
#else
        return "expanded";
#endif
    }

    /// Cambia el modo activo del motor en caliente.
    /// Solo la compilación `expanded` (`AXIONIK_TARGET_MODEL == 2`) puede conmutar hacia abajo (`plus` / `classic`).
    bool setEngineMode(std::string_view modeStr) noexcept;

    [[nodiscard]] std::string_view getEngineMode() const noexcept {
        return engineProfile_.generation;
    }

    /// Carga y valida con preflight un documento axionik-expanded.json v2.0.0 en R1 (0) o R2 (1).
    /// Si preflightExpandedModelForAxionik devuelve ok == false, bloquea la carga sin cargar parcialmente.
    bool loadExpandedModelFromJson(
        int slot,
        std::string_view jsonText,
        extended::AxionikExpandedPreflightReport* outReport = nullptr
    );

    /// Fallback v1: Carga un model.nmmodel (+ extended_map.json opcional) desde 05_extended_model/
    bool loadExpandedModelFromLegacyNmModelJson(
        int slot,
        std::string_view nmmodelJson,
        std::string_view extendedMapJson = {},
        extended::AxionikExpandedPreflightReport* outReport = nullptr
    );

    /// Carga desde carpeta Time-Capsule o 05_extended_model/ respetando aislamiento estricto de capas:
    /// - Primaria: 05_extended_model/axionik-expanded.json
    /// - Fallback: 05_extended_model/model.nmmodel (+ extended_map.json)
    /// - Jamás mezcla con 04_classic_enhanced/
    bool loadExpandedModelFolder(
        int slot,
        const std::filesystem::path& folderOrCapsulePath,
        extended::AxionikExpandedPreflightReport* outReport = nullptr
    );

    /// Carga un modelo extendido de AxionikDB por su slug en R1 (0) o R2 (1).
    bool loadExpandedModelBySlug(
        int slot,
        const std::string& slug,
        extended::AxionikExpandedPreflightReport* outReport = nullptr
    ) {
        auto folder = bankAdapter_.resolveAxionikModelFolder(slug);
        if (folder.empty()) return false;
        return loadExpandedModelFolder(slot, folder, outReport);
    }

    void setNeuronDbPath(const std::filesystem::path& path) {
        bankAdapter_.setNeuronDbPath(path);
    }

    void setAxionikDbPath(const std::filesystem::path& path) {
        bankAdapter_.setAxionikDbPath(path);
    }

    [[nodiscard]] const extended::AxionikExpandedPreflightReport& getLastExpandedPreflightReport(int slot) const noexcept {
        return lastExpandedReports_[(slot == 1) ? 1 : 0];
    }

    [[nodiscard]] bool hasExpandedModelLoaded(int slot) const noexcept {
        if (slot < 0 || slot > 1) return false;
        return expandedSynths_[static_cast<size_t>(slot)].hasLoadedModel();
    }

    [[nodiscard]] const extended::AxionikExpandedModelDoc* getExpandedModelDoc(int slot) const noexcept {
        if (slot < 0 || slot > 1 || !expandedSynths_[static_cast<size_t>(slot)].hasLoadedModel()) return nullptr;
        return &expandedSynths_[static_cast<size_t>(slot)].getLoadedModel();
    }

    /// Shapers activos del modelo expandido cargado en R1 (0) o R2 (1).
    /// Devuelve los defaults del motor si la ranura no tiene modelo expandido.
    [[nodiscard]] extended::AxionikResonatorShapers getActiveResonatorShapers(int slot) const noexcept {
        if (slot < 0 || slot > 1 || !expandedSynths_[static_cast<size_t>(slot)].hasLoadedModel()) {
            return extended::AxionikResonatorShapers{};
        }
        return expandedSynths_[static_cast<size_t>(slot)].getActiveShapers();
    }

    /// Aplica los 9 shapers al Resynator v2 activo de la ranura (0=R1, 1=R2).
    bool setActiveResonatorShapers(
        int slot,
        const extended::AxionikResonatorShapers& shapers) noexcept {
        if (slot < 0 || slot > 1 || !expandedSynths_[static_cast<size_t>(slot)].hasLoadedModel()) {
            return false;
        }
        return expandedSynths_[static_cast<size_t>(slot)].setActiveShapers(shapers);
    }

    /// Voice introspection for hosts/tests (region routing, choke state).
    [[nodiscard]] int getExpandedVoiceRegionIndex(int slot, size_t voiceIdx) const noexcept {
        if (slot < 0 || slot > 1) return -1;
        return expandedSynths_[static_cast<size_t>(slot)].getVoiceRegionIndex(voiceIdx);
    }

    [[nodiscard]] bool isExpandedVoiceReleasing(int slot, size_t voiceIdx) const noexcept {
        if (slot < 0 || slot > 1) return false;
        return expandedSynths_[static_cast<size_t>(slot)].isVoiceReleasing(voiceIdx);
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
        calibration_.oracleClipToZeroMode = enabled ? 1.0f : 0.0f;
        blockRenderer_.setOracleClipToZeroMode(enabled);
    }
    /// Control de volumen maestro (0.85f por defecto para paridad NeuronVS)
    void setMasterVolume(float vol) noexcept {
        masterVolume_ = std::clamp(vol, 0.0f, 2.0f);
        calibration_.masterVolume = masterVolume_;
    }
    [[nodiscard]] float getMasterVolume() const noexcept {
        return masterVolume_;
    }

    /// Acceso y mutación de parámetros de calibración DSP (Magic Numbers)
    [[nodiscard]] const ::axionik::dsp::AxionikCalibrationConfig& getCalibrationConfig() const noexcept {
        return calibration_;
    }
    bool setCalibrationParam(std::string_view id, float value) noexcept {
        if (!calibration_.setValue(id, value)) return false;
        syncCalibrationToSubsystems();
        return true;
    }
    bool resetCalibrationParam(std::string_view id) noexcept {
        if (!calibration_.resetParam(id)) return false;
        syncCalibrationToSubsystems();
        return true;
    }
    void resetAllCalibrationParams() noexcept {
        calibration_.resetAll();
        syncCalibrationToSubsystems();
    }

private:
    [[nodiscard]] inline float getSlotRaw(const float* p, size_t slotIdx, uint32_t paramIdx) const noexcept {
        return p ? p[slotIdx] : store_.getRawValue(paramIdx);
    }
    [[nodiscard]] inline float getSlotNorm(const float* p, size_t slotIdx, uint32_t paramIdx) const noexcept {
        return p ? p[slotIdx] : store_.getNormalizedValue(paramIdx);
    }

    struct RenderBlockParams {
        float blenderNorm{0.5f};
        int blenderType{0};
        int slicerType{0};
        float slicerDepth{0.0f};
        float slicerRateHz{4.0f};
        int slicerWave{0};
        int filterType{0};
        float cutoffHz{2500.0f};
        float resonance{0.2f};
        float filterEnvDepth{0.0f};
        float filterKeyTrack{0.0f};
        float filterVelDepth{0.0f};
    };

    void processVectorSticks(size_t numSamples);
    float updateModulationAndPitch(const float* p, size_t numSamples);
    void updateResynatorLayers(const float* p, float globalLfoSignal);
    void updateEnvelopes(const float* p);
    RenderBlockParams updateSilverAndMasterFx(const float* p, float globalLfoSignal);
    void applyAntiPop(float* leftChannel, float* rightChannel, size_t numSamples);
    void updatePeaksAndTelemetry(const float* leftChannel, const float* rightChannel, size_t numSamples, float instantLoad);
    void syncCalibrationToSubsystems() noexcept {
        masterVolume_ = std::clamp(calibration_.masterVolume, 0.0f, 2.0f);
        blockRenderer_.setOracleClipToZeroMode(calibration_.oracleClipToZeroMode > 0.5f);
        antiPopTotalSamples_ = static_cast<size_t>(
            std::max(0.0, sampleRate_ * static_cast<double>(calibration_.antiPopRampMs) * 0.001));
    }

    ::axionik::dsp::AxionikCalibrationConfig calibration_{};
    double sampleRate_{kLegacyBaseSampleRate};
    size_t maxBlockSize_{512};
    uint32_t activeVoices_{0};
    float cpuUsage_{0.0f};
    float peakL_{0.0f};
    float peakR_{0.0f};
    double globalLfoPhase_{0.0};
    float masterVolume_{0.85f};

    std::array<float, 6> modControllers_{};
    float pitchBendWheel_{0.0f};
    size_t antiPopTotalSamples_{kDefaultAntiPopSamples};
    size_t antiPopRemaining_{0};

    SndDatStore store_;
    SoundPreset currentPreset_;
    StickPlayer stickPlayer_;
    std::function<void(uint32_t, float)> onStickParamChanged_;
    std::unique_ptr<ParameterEngineBridge> bridge_;
    NeuronBankAdapter bankAdapter_;
    VoicePool voicePool_;
    BlockRenderer blockRenderer_;

    extended::AxionikEngineCapabilityProfile engineProfile_{
        extended::AxionikEngineCapabilityProfile::makeForCompileTarget()
    };
    std::array<extended::AxionikExpandedSynthesizer, 2> expandedSynths_{};
    std::array<extended::AxionikExpandedPreflightReport, 2> lastExpandedReports_{};
};

} // namespace abd::axionik
