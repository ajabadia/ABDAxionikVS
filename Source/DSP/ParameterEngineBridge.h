// ============================================================================
// ABDAxionikVS — ParameterEngineBridge.h
// Componente 'params' (11.484 bytes = 0x2CDC) y observadores
// Traduce cambios en SndDatStore (445 parámetros) y las 6 fuentes de modulación
// a los 340 slots de p[0..334] e invoca al Traductor (translateParametersToEngine)
// ============================================================================

#pragma once

#include <cstdint>
#include <array>
#include <vector>
#include <algorithm>
#include <cmath>
#include "State/SndDatStore.h"
#include "Translator.h"

namespace abd::axionik {

/// Número de fuentes de modulación en tiempo real (CC 1, 2, 3, 4, 11 y presión)
inline constexpr size_t kNumModSources = 6;

/// Número de destinos de modulación en la matriz rápida (0x10049E00)
inline constexpr size_t kNumModDests = 63;

/// Número de slots de ejecución en params+0x278C (p[slot], 340 floats)
inline constexpr size_t kNumEffectiveSlots = 340;

/// Estructura de contexto de observador (16 bytes = 4 dwords en binario original)
struct ObserverContext {
    uint32_t group{0};           // ctx[1]
    int32_t slot{-1};            // ctx[2]: slot directo dentro de p (0..339)
    int32_t modDestIdx{-1};      // ctx[3]: -1 o índice 0..62 si es modulable
    float minValue{0.0f};
    float maxValue{1.0f};
};

class ParameterEngineBridge {
public:
    explicit ParameterEngineBridge(SndDatStore& store)
        : store_(store)
    {
        initEngineState();
        initModulationRouting();
        bindStoreObservers();
    }

    /// Acceso directo al bloque de 13.948 bytes del motor
    [[nodiscard]] uint32_t* getEngineState() noexcept {
        return engineState_.data();
    }

    [[nodiscard]] const uint32_t* getEngineState() const noexcept {
        return engineState_.data();
    }

    /// Acceso a los 340 slots de ejecución (p[slot])
    [[nodiscard]] const float* getEffectiveSlots() const noexcept {
        return effectiveSlots_.data();
    }

    /// Actualiza una de las 6 fuentes de modulación (CC 1/2/3/4/11, Aftertouch)
    /// @param sourceIndex 0: Aftertouch, 1: ModWheel, 2: Breath, 3: CC03, 4: Foot, 5: Expression
    /// @param value       0.0 .. 1.0
    void setModulationSource(size_t sourceIndex, float value) {
        if (sourceIndex >= kNumModSources) return;
        modSourceValues_[sourceIndex] = value;
        recalculateModulation(-1);
    }

    /// Configura el destino de una fuente de modulación (0..62)
    void setModulationDestination(size_t sourceIndex, int32_t destIdx) {
        if (sourceIndex >= kNumModSources) return;
        int32_t oldDest = modSourceDests_[sourceIndex];
        modSourceDests_[sourceIndex] = std::clamp(destIdx, -1, static_cast<int32_t>(kNumModDests - 1));
        
        // Recalcular destino previo y nuevo
        if (oldDest >= 0) recalculateModulation(oldDest);
        if (modSourceDests_[sourceIndex] >= 0) recalculateModulation(modSourceDests_[sourceIndex]);
    }

    /// Configura la profundidad de una fuente de modulación (-1.0 .. +1.0)
    void setModulationDepth(size_t sourceIndex, float depth) {
        if (sourceIndex >= kNumModSources) return;
        modSourceDepths_[sourceIndex] = std::clamp(depth, -1.0f, 1.0f);
        if (modSourceDests_[sourceIndex] >= 0) {
            recalculateModulation(modSourceDests_[sourceIndex]);
        }
    }

    /// Recalcula un parámetro modulable o toda la matriz si destIdx == -1
    /// Port exacto de FUN_100134e0
    void recalculateModulation(int32_t targetDestIdx) {
        // Si targetDestIdx >= 0, recalculamos ese destino específico
        // Si targetDestIdx < 0, recalculamos todos los destinos activos
        auto applyDest = [this](size_t destIdx) {
            if (destIdx >= kNumModDests) return;
            float baseVal = modBaseValues_[destIdx];
            float modulationSum = 0.0f;

            for (size_t s = 0; s < kNumModSources; ++s) {
                if (modSourceDests_[s] == static_cast<int32_t>(destIdx)) {
                    modulationSum += modSourceDepths_[s] * modSourceValues_[s];
                }
            }

            float finalVal = baseVal + modulationSum;
            int32_t slot = kModDestToSlot[destIdx];
            if (slot >= 0 && slot < static_cast<int32_t>(kNumEffectiveSlots)) {
                float minV = kModDestRanges[destIdx].min;
                float maxV = kModDestRanges[destIdx].max;
                effectiveSlots_[slot] = std::clamp(finalVal, minV, maxV);
            }
        };

        if (targetDestIdx >= 0 && targetDestIdx < static_cast<int32_t>(kNumModDests)) {
            applyDest(static_cast<size_t>(targetDestIdx));
        } else {
            for (size_t d = 0; d < kNumModDests; ++d) {
                applyDest(d);
            }
        }

        // Traducir al estado del motor (FUN_10040550)
        translateParametersToEngine(engineState_.data(), effectiveSlots_.data());
    }

    /// Notifica un cambio de parámetro directo desde SndDatStore
    void handleParamChange(uint32_t paramId, float rawValue) {
        if (paramId >= kNumTotalParameters) return;
        const auto& ctx = observerMap_[paramId];
        if (ctx.slot < 0) return;

        if (ctx.modDestIdx >= 0 && ctx.modDestIdx < static_cast<int32_t>(kNumModDests)) {
            // Parámetro modulable: guarda valor base y recalcula
            modBaseValues_[ctx.modDestIdx] = rawValue;
            recalculateModulation(ctx.modDestIdx);
        } else {
            // Parámetro no modulable: escribe directamente en p[slot] y traduce
            effectiveSlots_[ctx.slot] = std::clamp(rawValue, ctx.minValue, ctx.maxValue);
            translateParametersToEngine(engineState_.data(), effectiveSlots_.data());
        }
    }

private:
    void initEngineState() {
        engineState_.fill(0);
        // Activar la puerta del motor (byte 0xD98 = e[0x366]) para permitir traducciones
        reinterpret_cast<uint8_t*>(engineState_.data())[0xD98] = 1;
        effectiveSlots_.fill(0.0f);
        modSourceValues_.fill(0.0f);
        modSourceDepths_.fill(0.0f);
        modSourceDests_.fill(-1);
        modBaseValues_.fill(0.0f);
    }

    void initModulationRouting();
    void bindStoreObservers();

    struct Range { float min; float max; };
    static const int32_t kModDestToSlot[kNumModDests];
    static const Range kModDestRanges[kNumModDests];

    SndDatStore& store_;
    std::array<uint32_t, kEngineStateNumDwords> engineState_;
    std::array<float, kNumEffectiveSlots> effectiveSlots_;
    std::array<float, kNumModSources> modSourceValues_;
    std::array<float, kNumModSources> modSourceDepths_;
    std::array<int32_t, kNumModSources> modSourceDests_;
    std::array<float, kNumModDests> modBaseValues_;
    std::array<ObserverContext, kNumTotalParameters> observerMap_;
};

} // namespace abd::axionik
