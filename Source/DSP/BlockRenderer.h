// ============================================================================
// ABDAxionikVS — BlockRenderer.h
// Bombeo de buffers y render de bloques de 128 muestras (0x1000bc40 -> FUN_100382b0)
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <array>
#include <vector>
#include <algorithm>
#include "VoicePool.h"

namespace abd::axionik {

inline constexpr size_t kBlockChunkSize = 128; // Tamaño de bloque interno canónico de Neuron

class BlockRenderer {
public:
    BlockRenderer();
    ~BlockRenderer() = default;

    void prepare(double sampleRate, size_t maxBlockSize);
    void reset();

    /// Procesa una petición de audio de longitud arbitraria bombeando en bloques de 128
    void process(float* leftOut, float* rightOut, size_t numSamples,
                 VoicePool& voicePool,
                 float blenderAmount = 0.5f,
                 float filterCutoffHz = 2500.0f,
                 float filterReso = 0.2f,
                 float masterVolume = 0.85f);

private:
    /// Renderiza exactamente un bloque de 128 muestras (FUN_100382b0)
    void render128Chunk(VoicePool& voicePool,
                        float blenderAmount,
                        float filterCutoffHz,
                        float filterReso);

    double sampleRate_{44100.0};

    // Buffers internos de 128 muestras
    std::array<float, kBlockChunkSize> internalLeft_{};
    std::array<float, kBlockChunkSize> internalRight_{};

    // FIFO / remanente entre bloques del host
    size_t bufferReadPos_{kBlockChunkSize}; // Inicia vacío para forzar render inmediato
};

} // namespace abd::axionik
