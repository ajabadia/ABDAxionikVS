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

/// Número de slots de ejecución en params+0x278C (p[slot], 340 en VST + extensión 380..392 para MFX)
inline constexpr size_t kNumEffectiveSlots = 400;

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

    /// FUN_100012a0: remapea `value` del rango [srcLo, srcHi] al [dstLo, dstHi].
    /// Si ambos rangos cruzan cero, cada mitad se escala contra su propio límite
    /// (ej. -64..63 -> -1..1 da v/64 para v<0 y v/63 para v>=0); si no, interpolación afín.
    static float remap(float value, float srcLo, float srcHi, float dstLo, float dstHi) noexcept {
        const double v = value;
        const double slo = srcLo;
        const double shi = srcHi;
        const double dlo = dstLo;
        const double dhi = dstHi;
        constexpr double kZero = 0.0;

        if (slo == dlo && shi == dhi) return value;

        double srcScale = kZero;
        if (shi <= slo || kZero <= slo || shi <= kZero) {
            if (shi < slo && shi < kZero && kZero < slo) {
                srcScale = v < kZero ? shi : slo;
            }
        } else {
            srcScale = v < kZero ? slo : shi;
        }

        double dstScale = kZero;
        if (!(dhi <= dlo || kZero <= dlo || dhi <= kZero)) {
            dstScale = v < kZero ? dlo : dhi;
        } else if (dlo <= dhi || kZero <= dhi || dlo <= kZero) {
            dstScale = kZero;
        } else {
            dstScale = v < kZero ? dhi : dlo;
        }

        if (srcScale != kZero && dstScale != kZero) {
            return static_cast<float>(v / srcScale * dstScale);
        }
        if (slo == shi) return static_cast<float>(dlo);
        return static_cast<float>((dhi - dlo) * ((v - slo) / (shi - slo)) + dlo);
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

    /// Consultas de diagnóstico de la matriz de modulación (63 destinos, 6 controles)
    [[nodiscard]] float getBaseValue(size_t destIdx) const noexcept {
        return (destIdx < kNumModDests) ? modBaseValues_[destIdx] : 0.0f;
    }
    [[nodiscard]] int32_t getControlDestination(size_t sourceIndex) const noexcept {
        return (sourceIndex < kNumModSources) ? modSourceDests_[sourceIndex] : -1;
    }
    [[nodiscard]] float getControlDepth(size_t sourceIndex) const noexcept {
        return (sourceIndex < kNumModSources) ? modSourceDepths_[sourceIndex] : 0.0f;
    }
    [[nodiscard]] float getControlValue(size_t sourceIndex) const noexcept {
        return (sourceIndex < kNumModSources) ? modSourceValues_[sourceIndex] : 0.0f;
    }
    [[nodiscard]] int32_t getDestSlot(size_t destIdx) const noexcept {
        return (destIdx < kNumModDests) ? kModDestToSlot[destIdx] : -1;
    }

    /// Actualiza una de las 6 fuentes de modulación (CC 1/2/3/4/11, Aftertouch)
    /// FUN_10013490: escribe el valor y llama a combine(-1)
    /// @param sourceIndex 0: Aftertouch (0xD0), 1: ModWheel (CC1), 2: Breath (CC2), 3: CC03 (CC3), 4: Foot (CC4), 5: Expression (CC11)
    /// @param value       0.0 .. 1.0 (byte * 1/127)
    void setModulationSource(size_t sourceIndex, float value) {
        if (sourceIndex >= kNumModSources) return;
        modSourceValues_[sourceIndex] = value;
        recalculateModulation(-1);
    }

    /// Configura el destino de una fuente de modulación (0..62)
    /// stModDest (0x100135D0): escribe el nuevo destino y recombina el destino ANTERIOR y el nuevo
    void setModulationDestination(size_t sourceIndex, int32_t destIdx) {
        if (sourceIndex >= kNumModSources) return;
        if (destIdx < 0 || destIdx >= static_cast<int32_t>(kNumModDests)) return;
        int32_t oldDest = modSourceDests_[sourceIndex];
        modSourceDests_[sourceIndex] = destIdx;

        // stModDest recombina el destino que deja el control y el nuevo
        if (oldDest >= 0) recalculateModulation(oldDest);
        recalculateModulation(destIdx);
    }

    /// Configura la profundidad de una fuente de modulación (-1.0 .. +1.0)
    /// stModDepth (0x10013600): escribe la profundidad y llama a combine(-1)
    void setModulationDepth(size_t sourceIndex, float depth) {
        if (sourceIndex >= kNumModSources) return;
        modSourceDepths_[sourceIndex] = std::clamp(depth, -1.0f, 1.0f);
        recalculateModulation(-1);
    }

    /// Recalcula un parámetro modulable o toda la matriz si destIdx == -1
    /// Port exacto de FUN_100134e0 (combinador con acumulación en precisión doble x87)
    void recalculateModulation(int32_t targetDestIdx) {
        auto applyDest = [this](size_t destIdx) {
            if (destIdx >= kNumModDests) return;
            double acc = static_cast<double>(modBaseValues_[destIdx]);

            for (size_t s = 0; s < kNumModSources; ++s) {
                if (modSourceDests_[s] == static_cast<int32_t>(destIdx)) {
                    acc += static_cast<double>(modSourceDepths_[s]) *
                           static_cast<double>(modSourceValues_[s]);
                }
            }

            float finalVal = static_cast<float>(acc);
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

    /// Notifica un cambio de parámetro directo desde SndDatStore (FUN_10001550 -> FUN_100012a0)
    void handleParamChange(uint32_t paramId, float rawValue) {
        if (paramId >= kNumTotalParameters) return;
        const auto& desc = kParameterDescriptors[paramId];

        // 1. Claves 413..424: Routing y profundidad de los 6 controles (stModDest / stModDepth)
        if (paramId >= 413 && paramId <= 424) {
            size_t ctrlIdx = (paramId - 413) / 2;
            if (((paramId - 413) & 1) == 0) {
                // 413, 415, 417, 419, 421, 423 -> AftertouchDest .. ExpressionDest (stModDest)
                setModulationDestination(ctrlIdx, static_cast<int32_t>(rawValue));
            } else {
                // 414, 416, 418, 420, 422, 424 -> AftertouchDepth .. ExpressionDepth (stModDepth)
                float remappedDepth = remap(rawValue, desc.min, desc.max, -1.0f, 1.0f);
                setModulationDepth(ctrlIdx, remappedDepth);
            }
            return;
        }

        const auto& ctx = observerMap_[paramId];
        if (ctx.slot < 0 || ctx.slot >= static_cast<int32_t>(kNumEffectiveSlots)) return;

        // 2. FUN_10001550 aplica FUN_100012a0(raw, desc.min, desc.max, ctx.minValue, ctx.maxValue)
        float remappedVal = remap(rawValue, desc.min, desc.max, ctx.minValue, ctx.maxValue);

        if (ctx.modDestIdx >= 0 && ctx.modDestIdx < static_cast<int32_t>(kNumModDests)) {
            // stSPEngineCb (0x100139D0): guarda base[dest] = remappedVal y llama a combine(dest)
            modBaseValues_[ctx.modDestIdx] = remappedVal;
            recalculateModulation(ctx.modDestIdx);
        } else {
            // Observador directo de slot no modulable: escribe en p[slot] y traduce
            effectiveSlots_[ctx.slot] = std::clamp(remappedVal, ctx.minValue, ctx.maxValue);
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
        for (size_t c = 0; c < kNumModSources; ++c) {
            modSourceDests_[c] = static_cast<int32_t>(c); // Routing inicial del ctor: control c -> dest c
        }
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
