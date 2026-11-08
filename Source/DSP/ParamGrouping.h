// ============================================================================
// ABDAxionikVS — ParamGrouping.h
// Agrupacion de parametros por categoria del diccionario (JUCE-free)
//
// El registro generado lleva el grupo de cada parametro en
// `ParamDescriptor::group`, derivado de la categoria de la spec del diccionario.
// El arbol de parametros del host solo muestra carpetas de automatizacion si los
// hijos de cada grupo son CONTIGUOS, y en el registro los grupos estan
// intercalados (R1, R2, R1, Synth, R2, ...). Este helper hace esa conversion sin
// depender de JUCE, para poder verificarla en los tests del motor.
// ============================================================================

#pragma once

#include "Generated/ParameterRegistry.gen.h"

#include <cstddef>
#include <string_view>
#include <vector>

namespace abd::axionik {

struct ParamGroupBucket {
    std::string_view id;                        // id del diccionario ("R1", "Synth", ...)
    std::vector<const ParamDescriptor*> params; // en el orden del registro
};

/// Devuelve un cubo por grupo, en orden de primera aparicion en el registro y con
/// los parametros de cada cubo en el orden del registro. La unica reordenacion es
/// la separacion de los grupos que estaban intercalados.
[[nodiscard]] inline std::vector<ParamGroupBucket> buildParamGroupBuckets() {
    std::vector<ParamGroupBucket> buckets;
    buckets.reserve(8);

    for (const auto& desc : kParameterDescriptors) {
        std::size_t slot = 0;
        while (slot < buckets.size() && buckets[slot].id != desc.group)
            ++slot;

        if (slot == buckets.size())
            buckets.push_back(ParamGroupBucket{desc.group, {}});

        buckets[slot].params.push_back(&desc);
    }

    return buckets;
}

} // namespace abd::axionik
