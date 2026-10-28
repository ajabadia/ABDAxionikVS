// ============================================================================
// ABDAxionikVS — MidiMapping.gen.h
// AUTOGENERADO POR Scripts/registry_generator.js — NO EDITAR MANUALMENTE
// ============================================================================

#pragma once

#include <cstdint>
#include <array>

namespace abd::axionik {

// 6 Controles en tiempo real del Hartmann Neuron (params+0x44)
constexpr uint8_t kMidiCCModulation = 1;     // Modulation Wheel (params+0x48)
constexpr uint8_t kMidiCCBreath     = 2;     // Breath Controller (params+0x4C)
constexpr uint8_t kMidiCCCO3        = 3;     // CC 03 (params+0x50)
constexpr uint8_t kMidiCCFoot       = 4;     // Foot Pedal (params+0x54)
constexpr uint8_t kMidiCCExpression = 11;    // Expression Pedal (params+0x58)
// Channel Pressure / Aftertouch alimenta params+0x44 directamente
constexpr uint8_t kMidiCCBankSelect = 32;    // Bank Select LSB (0..9)

// Controladores Vectoriales 2D (Sticks XY) y Controles Principales
constexpr uint8_t kMidiCCR1ScapeX     = 16;   // Resynator 1 Scape X (param 52)
constexpr uint8_t kMidiCCR1ScapeY     = 17;   // Resynator 1 Scape Y (param 53)
constexpr uint8_t kMidiCCR1SphereX    = 18;   // Resynator 1 Sphere X (param 42)
constexpr uint8_t kMidiCCR1SphereY    = 19;   // Resynator 1 Sphere Y (param 43)
constexpr uint8_t kMidiCCR2ScapeX     = 35;   // Resynator 2 Scape X (param 132)
constexpr uint8_t kMidiCCR2ScapeY     = 36;   // Resynator 2 Scape Y (param 133)
constexpr uint8_t kMidiCCR2SphereX    = 37;   // Resynator 2 Sphere X (param 122)
constexpr uint8_t kMidiCCR2SphereY    = 39;   // Resynator 2 Sphere Y (param 123)
constexpr uint8_t kMidiCCBlender      = 70;   // Blender Amount (param 262)
constexpr uint8_t kMidiCCFilterReso   = 71;   // Filter Resonance (param 275)
constexpr uint8_t kMidiCCFilterCutoff = 74;   // Filter Cutoff (param 274)

// Direccionamiento NRPN de 14 bits: NRPN 0..444 direccionan 1:1 los 445 parametros
constexpr uint16_t kNrpnBaseParameterAddress = 0;
constexpr uint16_t kNrpnMaxParameterAddress = 444;

constexpr bool isNrpnParameterAddress(uint16_t nrpn) noexcept {
    return nrpn <= kNrpnMaxParameterAddress;
}

} // namespace abd::axionik
