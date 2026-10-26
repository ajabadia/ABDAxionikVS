// ============================================================================
// ABDAxionikVS — Translator.h
// Cabecera del traductor de parámetros al estado del motor (13.948 bytes)
// Frontera original entre 'params' y 'engine' (NeuronVS.dll!0x10040550)
// ============================================================================

#pragma once

#include <cstdint>
#include <cstring>
#include <cstddef>

namespace abd::axionik {

/// Tamaño del bloque de estado del motor de audio (0x367C bytes = 13.948 bytes)
inline constexpr size_t kEngineStateSizeBytes = 0x367C;
inline constexpr size_t kEngineStateNumDwords = kEngineStateSizeBytes / sizeof(uint32_t); // 3487 dwords

/// Conversión float -> entero truncado hacia cero (MSVC crudo de 32 bits)
inline uint32_t trunc_i32(double x) {
    if (x != x) return 0; // NaN
    if (x <= -2147483648.0 || x >= 2147483648.0)
        return static_cast<uint32_t>(static_cast<int64_t>(x) & 0xffffffffLL);
    return static_cast<uint32_t>(static_cast<int32_t>(x));
}

/// Almacena un float como bits crudos IEEE 754 en un uint32_t
inline uint32_t f32_raw(float v) {
    uint32_t bits;
    std::memcpy(&bits, &v, sizeof bits);
    return bits;
}

/// Lee bits crudos uint32_t y los reinterpreta como float
inline float f32_bits(uint32_t bits) {
    float v;
    std::memcpy(&v, &bits, sizeof v);
    return v;
}

/// Validación de tablas de modelos colgadas del estado antes de permitir la síntesis
/// (Port de FUN_100373a0)
char validateEngineState(const uint32_t* state);

/// Hook para el sub-objeto en estado[0xD95] (Port de FUN_100343e4, 501 líneas)
void translateSubObject(void* self, const uint32_t* p);

/// Función principal de traducción (FUN_10040550)
/// @param engineState  Puntero al bloque de 13.948 bytes (e[3487])
/// @param p            Valores efectivos por slot (340 dwords)
void translateParametersToEngine(uint32_t* engineState, const float* p);

} // namespace abd::axionik
