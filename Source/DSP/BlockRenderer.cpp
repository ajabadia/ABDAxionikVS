// ============================================================================
// ABDAxionikVS — BlockRenderer.cpp
// Implementación del bombeo y render canónico de bloques de 128 muestras
// ============================================================================

#include "BlockRenderer.h"
#include <cstring>
#include <cmath>

namespace abd::axionik {

BlockRenderer::BlockRenderer() {
    reset();
}

void BlockRenderer::prepare(double sampleRate, size_t maxBlockSize) {
    (void)maxBlockSize;
    sampleRate_ = sampleRate > 0.0 ? sampleRate : 44100.0;
    reset();
}

void BlockRenderer::reset() {
    internalLeft_.fill(0.0f);
    internalRight_.fill(0.0f);
    bufferReadPos_ = kBlockChunkSize; // Forzar cálculo de nuevo bloque al primer pedido
}

void BlockRenderer::render128Chunk(VoicePool& voicePool,
                                  float blenderAmount,
                                  float filterCutoffHz,
                                  float filterReso) {
    // 1. Limpiar buffer de bloque a cero (exactamente como FUN_100382b0 líneas 108..115)
    internalLeft_.fill(0.0f);
    internalRight_.fill(0.0f);

    // 2. Renderizar todas las voces activas en el acumulador
    voicePool.renderBlock(internalLeft_.data(), internalRight_.data(), kBlockChunkSize,
                          blenderAmount, filterCutoffHz, filterReso);
}

void BlockRenderer::process(float* leftOut, float* rightOut, size_t numSamples,
                            VoicePool& voicePool,
                            float blenderAmount,
                            float filterCutoffHz,
                            float filterReso,
                            float masterVolume) {
    if (leftOut == nullptr) return;

    size_t samplesProduced = 0;

    while (samplesProduced < numSamples) {
        // Si el buffer interno se ha consumido, renderizar el siguiente bloque de 128
        if (bufferReadPos_ >= kBlockChunkSize) {
            render128Chunk(voicePool, blenderAmount, filterCutoffHz, filterReso);
            bufferReadPos_ = 0;
        }

        size_t available = kBlockChunkSize - bufferReadPos_;
        size_t toCopy = std::min(available, numSamples - samplesProduced);

        for (size_t i = 0; i < toCopy; ++i) {
            float sL = internalLeft_[bufferReadPos_ + i] * masterVolume;
            float sR = (rightOut != nullptr) ? (internalRight_[bufferReadPos_ + i] * masterVolume) : sL;

            // Recorte canónico a cero de Neuron (0x1000bc40):
            // if (x * x > 1.0) x = 0.0
            if (sL * sL > 1.0f) sL = 0.0f;
            if (sR * sR > 1.0f) sR = 0.0f;

            leftOut[samplesProduced + i] = sL;
            if (rightOut != nullptr && rightOut != leftOut) {
                rightOut[samplesProduced + i] = sR;
            }
        }

        bufferReadPos_ += toCopy;
        samplesProduced += toCopy;
    }
}

} // namespace abd::axionik
