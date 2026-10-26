// ============================================================================
// ABDAxionikVS — Oscillators.h
// Reenvío hacia la implementación canónica compartida en ABDShared::DspCore
// ============================================================================

#pragma once

#include "DspCore/NeuronVS/NeuronOscillators.h"

namespace abd::axionik {
    using DecodedScapeHeader = abd::dsp::neuron::DecodedScapeHeader;
    using DecodedSphereHeader = abd::dsp::neuron::DecodedSphereHeader;
    using CurveReader = abd::dsp::neuron::CurveReader;
    using BandReader = abd::dsp::neuron::BandReader;
    using ResynatorCore = abd::dsp::neuron::ResynatorCore;
}
