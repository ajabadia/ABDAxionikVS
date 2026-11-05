// ============================================================================
// ABDAxionikVS — Conversion.gen.h
// AUTOGENERADO POR Scripts/registry_generator.js — NO EDITAR MANUALMENTE
// ============================================================================

#pragma once

#include "ParameterRegistry.gen.h"
#include <cmath>
#include <algorithm>

namespace abd::axionik {

/**
 * Convierte un valor crudo a normalizado [0.0f, 1.0f]
 * Para parámetros SymBipolar [-64..63]: raw 0 -> exacto 0.5f
 */
inline float rawToNormalized(uint32_t index, float rawValue) noexcept {
    if (index >= kNumTotalParameters) return 0.0f;
    const auto& desc = kParameterDescriptors[index];
    if (desc.max <= desc.min) return 0.0f;
    float clamped = std::clamp(rawValue, desc.min, desc.max);
    if (desc.isSymBipolar) {
        if (clamped == 0.0f) return 0.5f;
        if (clamped > 0.0f) return 0.5f + 0.5f * (clamped / desc.max);
        return 0.5f - 0.5f * (clamped / desc.min);
    }
    return (clamped - desc.min) / (desc.max - desc.min);
}

/**
 * Convierte un valor normalizado [0.0f, 1.0f] a crudo cuantizado segun step y clamp
 * Para parámetros SymBipolar [-64..63]: norm 0.5f -> exacto 0.0f
 * Aplica la regla estricta de FUN_10001170 del binario original
 */
inline float normalizedToRaw(uint32_t index, float normalized) noexcept {
    if (index >= kNumTotalParameters) return 0.0f;
    const auto& desc = kParameterDescriptors[index];
    float norm = std::clamp(normalized, 0.0f, 1.0f);
    if (desc.isSymBipolar) {
        if (std::abs(norm - 0.5f) < 1e-6f) return 0.0f;
        float raw = (norm > 0.5f)
            ? (norm - 0.5f) * 2.0f * desc.max
            : (0.5f - norm) * 2.0f * desc.min;
        if (desc.step > 0.0f) {
            raw = std::round(raw / desc.step) * desc.step;
        }
        return std::clamp(raw, desc.min, desc.max);
    }
    float raw = desc.min + norm * (desc.max - desc.min);
    if (desc.step > 0.0f) {
        raw = std::round((raw - desc.min) / desc.step) * desc.step + desc.min;
    }
    return std::clamp(raw, desc.min, desc.max);
}

} // namespace abd::axionik
