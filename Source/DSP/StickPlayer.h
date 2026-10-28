// ============================================================================
// ABDAxionikVS — StickPlayer.h
// Motor de reproducción en tiempo real de grabaciones vectoriales (sound.stickrec)
// Fiel a la especificación de trayectorias TTTTFCVVV de Hartmann Neuron
// ============================================================================

#pragma once

#include <vector>
#include <array>
#include <cstdint>
#include <algorithm>
#include "State/NeuronSound.h"

namespace abd::axionik {

/// Motor de reproducción determinista de trayectorias de joystick (sound.stickrec)
class StickPlayer {
public:
    StickPlayer() = default;

    /// Inicializa la frecuencia de muestreo
    void prepare(double sampleRate) noexcept {
        sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
        reset();
    }

    /// Reinicia la posición temporal
    void reset() noexcept {
        playbackTimeMs_ = 0.0;
        currentEventIndex_ = 0;
        isPlaying_ = false;
    }

    /// Carga los eventos de un preset
    void loadEvents(const std::vector<StickRecEvent>& events) {
        events_ = events;
        reset();
    }

    /// Dispara la reproducción desde t = 0 (al pulsar nota)
    void trigger() noexcept {
        if (events_.empty()) return;
        playbackTimeMs_ = 0.0;
        currentEventIndex_ = 0;
        isPlaying_ = true;
    }

    /// Detiene la reproducción
    void stop() noexcept {
        isPlaying_ = false;
    }

    [[nodiscard]] bool isPlaying() const noexcept { return isPlaying_; }
    [[nodiscard]] bool hasEvents() const noexcept { return !events_.empty(); }
    [[nodiscard]] size_t getEventCount() const noexcept { return events_.size(); }

    /// Mapeo canónico de los 8 controles de stick (0..7) a índices de parámetro snddat
    /// Control 0: R1 Scape X (param 52)
    /// Control 1: R1 Scape Y (param 53)
    /// Control 2: R1 Sphere X (param 42)
    /// Control 3: R1 Sphere Y (param 43)
    /// Control 4: R2 Scape X (param 132)
    /// Control 5: R2 Scape Y (param 133)
    /// Control 6: R2 Sphere X (param 122)
    /// Control 7: R2 Sphere Y (param 123)
    static constexpr uint32_t getParamIndexForControl(uint8_t control) noexcept {
        switch (control) {
            case 0: return 52;  // R1L1Scape1Value (Scape X)
            case 1: return 53;  // R1L1Scape2Value (Scape Y)
            case 2: return 42;  // R1L1Sphere1Value (Sphere X)
            case 3: return 43;  // R1L1Sphere2Value (Sphere Y)
            case 4: return 132; // R2L1Scape1Value (Scape X)
            case 5: return 133; // R2L1Scape2Value (Scape Y)
            case 6: return 122; // R2L1Sphere1Value (Sphere X)
            case 7: return 123; // R2L1Sphere2Value (Sphere Y)
            default: return 52;
        }
    }

    /// Procesa un bloque de audio de numSamples muestras y despacha los cambios de stick
    template <typename Callback>
    void processBlock(size_t numSamples, Callback&& onParamUpdate) {
        if (!isPlaying_ || events_.empty()) return;

        double blockDurationMs = (static_cast<double>(numSamples) * 1000.0) / sampleRate_;
        playbackTimeMs_ += blockDurationMs;

        while (currentEventIndex_ < events_.size()) {
            const auto& evt = events_[currentEventIndex_];
            if (static_cast<double>(evt.time) <= playbackTimeMs_) {
                if (evt.control < 8) {
                    uint32_t pIdx = getParamIndexForControl(evt.control);
                    // Valor en stickrec es 0x000..0x200 (0..512). Normalizado 0.0..1.0
                    float norm = std::clamp(static_cast<float>(evt.value) / 512.0f, 0.0f, 1.0f);
                    float raw = norm * 127.0f;
                    onParamUpdate(pIdx, raw);
                }
                currentEventIndex_++;
            } else {
                break;
            }
        }

        // Si se recorrieron todos los eventos
        if (currentEventIndex_ >= events_.size()) {
            if (loopMode_) {
                playbackTimeMs_ = 0.0;
                currentEventIndex_ = 0;
            } else {
                isPlaying_ = false;
            }
        }
    }

    void setLoop(bool loop) noexcept { loopMode_ = loop; }
    [[nodiscard]] bool getLoop() const noexcept { return loopMode_; }

private:
    double sampleRate_{44100.0};
    double playbackTimeMs_{0.0};
    size_t currentEventIndex_{0};
    bool isPlaying_{false};
    bool loopMode_{false};
    std::vector<StickRecEvent> events_;
};

} // namespace abd::axionik
