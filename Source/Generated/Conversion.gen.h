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
 */
inline float rawToNormalized(uint32_t index, float rawValue) noexcept {
    if (index >= kNumTotalParameters) return 0.0f;
    const auto& desc = kParameterDescriptors[index];
    if (desc.max <= desc.min) return 0.0f;
    float clamped = std::clamp(rawValue, desc.min, desc.max);
    return (clamped - desc.min) / (desc.max - desc.min);
}

/**
 * Convierte un valor normalizado [0.0f, 1.0f] a crudo cuantizado segun step y clamp
 * Aplica la regla estricta de FUN_10001170 del binario original
 */
inline float normalizedToRaw(uint32_t index, float normalized) noexcept {
    if (index >= kNumTotalParameters) return 0.0f;
    const auto& desc = kParameterDescriptors[index];
    float norm = std::clamp(normalized, 0.0f, 1.0f);
    float raw = desc.min + norm * (desc.max - desc.min);
    if (desc.step > 0.0f) {
        raw = std::round((raw - desc.min) / desc.step) * desc.step + desc.min;
    }
    return std::clamp(raw, desc.min, desc.max);
}

} // namespace abd::axionik
