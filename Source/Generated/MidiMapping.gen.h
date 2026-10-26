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

// Direccionamiento NRPN de 14 bits: NRPN 0..444 direccionan 1:1 los 445 parametros
constexpr uint16_t kNrpnBaseParameterAddress = 0;
constexpr uint16_t kNrpnMaxParameterAddress = 444;

constexpr bool isNrpnParameterAddress(uint16_t nrpn) noexcept {
    return nrpn <= kNrpnMaxParameterAddress;
}

} // namespace abd::axionik
