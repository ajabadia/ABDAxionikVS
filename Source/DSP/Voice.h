// ============================================================================
// ABDAxionikVS — Voice.h
// Reenvío hacia la implementación canónica compartida en ABDShared::DspCore
// ============================================================================

#pragma once

#include "DspCore/NeuronVS/NeuronVoice.h"

namespace abd::axionik {
    using SimpleEnvelope = abd::dsp::neuron::NeuronEnvelope;
    using StateVariableFilter = abd::dsp::neuron::NeuronFilter;
    using SynthVoice = abd::dsp::neuron::NeuronVoice;
}
