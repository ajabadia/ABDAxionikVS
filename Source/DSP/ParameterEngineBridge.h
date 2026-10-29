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

/// Número de grupos de Free Controllers (Aftertouch, Ctrl 1 Up, Ctrl 1 Down, Ctrl 2, Ctrl 3, Ctrl 4) y slots por grupo ([363..410])
inline constexpr size_t kNumFreeGroups = 6;
inline constexpr size_t kNumFreeSlotsPerGroup = 4;

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

    /// Emulación diagnóstica opcional del desenganche de un destino (0..62) por el write fuera
    /// de rango de combine(-1) en params+0x2E2C del DLL original (jl 0x10013A56 en stSPEngineCb).
    /// Por defecto es -1 (todos los 63 destinos enganchados y operativos sin corrupción de heap).
    void setUnhookedDestination(int32_t destIdx) noexcept {
        unhookedDestIdx_ = (destIdx >= 0 && destIdx < static_cast<int32_t>(kNumModDests)) ? destIdx : -1;
    }
    [[nodiscard]] int32_t getUnhookedDestination() const noexcept {
        return unhookedDestIdx_;
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
    /// Port exacto de FUN_100134e0 (combinador con acumulación en precisión doble x87) + extensión 6×4 Free Controllers [363..410]
    void recalculateModulation(int32_t targetDestIdx) {
        auto getFreeGroupSourceValue = [this](size_t group) noexcept -> float {
            switch (group) {
                case 0: return modSourceValues_[0]; // Aftertouch Free [363..370]
                case 1: return std::max(0.0f, modSourceValues_[1]); // Controller 1 Up [371..378]
                case 2: return modSourceValues_[1] < 0.0f ? -modSourceValues_[1] : modSourceValues_[1]; // Controller 1 Down [379..386]
                case 3: return modSourceValues_[2]; // Controller 2 [387..394]
                case 4: return modSourceValues_[3]; // Controller 3 [395..402]
                case 5: return modSourceValues_[4]; // Controller 4 / Foot [403..410]
                default: return 0.0f;
            }
        };

        auto applyDest = [this, &getFreeGroupSourceValue](size_t destIdx) {
            if (destIdx >= kNumModDests) return;
            double acc = static_cast<double>(modBaseValues_[destIdx]);

            for (size_t s = 0; s < kNumModSources; ++s) {
                if (modSourceDests_[s] == static_cast<int32_t>(destIdx)) {
                    acc += static_cast<double>(modSourceDepths_[s]) *
                           static_cast<double>(modSourceValues_[s]);
                }
            }

            // 6 × 4 Free Controllers Matrix ([363..410])
            for (size_t g = 0; g < kNumFreeGroups; ++g) {
                const double srcVal = static_cast<double>(getFreeGroupSourceValue(g));
                for (size_t slot = 0; slot < kNumFreeSlotsPerGroup; ++slot) {
                    if (freeSlotDests_[g][slot] == static_cast<int32_t>(destIdx)) {
                        acc += static_cast<double>(freeSlotDepths_[g][slot]) * srcVal;
                    }
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

        // 1b. Claves 363..410: Matriz 6 × 4 de Free Controllers (4 destinos [3000=Off, 3001..3063=0..62] + 4 profundidades [-64..+63] por grupo)
        if (paramId >= 363 && paramId <= 410) {
            size_t rel = paramId - 363;
            size_t group = rel / 8;
            size_t offset = rel % 8;
            if (group < kNumFreeGroups) {
                if (offset < kNumFreeSlotsPerGroup) {
                    int32_t rawInt = static_cast<int32_t>(std::lround(rawValue));
                    int32_t newDest = -1;
                    if (rawInt >= 3001 && rawInt < 3001 + static_cast<int32_t>(kNumModDests)) {
                        newDest = rawInt - 3001;
                    } else if (rawInt >= 0 && rawInt < static_cast<int32_t>(kNumModDests)) {
                        newDest = rawInt;
                    }
                    int32_t oldDest = freeSlotDests_[group][offset];
                    freeSlotDests_[group][offset] = newDest;
                    if (oldDest >= 0) recalculateModulation(oldDest);
                    if (newDest >= 0) recalculateModulation(newDest);
                } else {
                    size_t slot = offset - kNumFreeSlotsPerGroup;
                    float remappedDepth = remap(rawValue, desc.min, desc.max, -1.0f, 1.0f);
                    freeSlotDepths_[group][slot] = std::clamp(remappedDepth, -1.0f, 1.0f);
                    recalculateModulation(-1);
                }
            }
            return;
        }

        const auto& ctx = observerMap_[paramId];
        if (ctx.slot < 0 || ctx.slot >= static_cast<int32_t>(kNumEffectiveSlots)) return;

        // 2. FUN_10001550 aplica FUN_100012a0(raw, desc.min, desc.max, ctx.minValue, ctx.maxValue)
        float remappedVal = remap(rawValue, desc.min, desc.max, ctx.minValue, ctx.maxValue);

        if (ctx.modDestIdx >= 0 && ctx.modDestIdx < static_cast<int32_t>(kNumModDests)) {
            if (ctx.modDestIdx == unhookedDestIdx_) {
                // Rama jl 0x10013A56 del DLL original cuando ctx[3] fue pisado en params+0x2E2C:
                // escribe p[slot] directamente sin actualizar base[dest] ni recortar/modular
                effectiveSlots_[ctx.slot] = remappedVal;
                translateParametersToEngine(engineState_.data(), effectiveSlots_.data());
            } else {
                // stSPEngineCb (0x100139D0): guarda base[dest] = remappedVal y llama a combine(dest)
                modBaseValues_[ctx.modDestIdx] = remappedVal;
                recalculateModulation(ctx.modDestIdx);
            }
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
        for (size_t g = 0; g < kNumFreeGroups; ++g) {
            for (size_t s = 0; s < kNumFreeSlotsPerGroup; ++s) {
                freeSlotDests_[g][s] = -1;
                freeSlotDepths_[g][s] = 0.0f;
            }
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
    std::array<std::array<int32_t, kNumFreeSlotsPerGroup>, kNumFreeGroups> freeSlotDests_;
    std::array<std::array<float, kNumFreeSlotsPerGroup>, kNumFreeGroups> freeSlotDepths_;
    std::array<float, kNumModDests> modBaseValues_;
    std::array<ObserverContext, kNumTotalParameters> observerMap_;
    int32_t unhookedDestIdx_{-1};
};

} // namespace abd::axionik
