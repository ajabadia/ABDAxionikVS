// ============================================================================
// ABDAxionikVS — NeuronModel.h
// Reenvío hacia la implementación canónica compartida en ABDShared::DspCore
// ============================================================================

#pragma once

#include "DspCore/NeuronVS/NeuronModel.h"

namespace abd::axionik {
    using NeuronModel = abd::dsp::neuron::NeuronModel;
    using ModelZoneRecord = abd::dsp::neuron::ModelZoneRecord;
    using EngineZoneEntry = abd::dsp::neuron::EngineZoneEntry;
    using AnChunkBuffer = abd::dsp::neuron::AnChunkBuffer;
    using AnChunkHeader = abd::dsp::neuron::AnChunkHeader;
}
