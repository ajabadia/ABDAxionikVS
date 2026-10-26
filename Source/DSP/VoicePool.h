// ============================================================================
// ABDAxionikVS — VoicePool.h
// Reenvío hacia la implementación canónica compartida en ABDShared::DspCore
// ============================================================================

#pragma once

#include "DspCore/NeuronVS/NeuronVoicePool.h"

namespace abd::axionik {
    using VoicePool = abd::dsp::neuron::NeuronVoicePool;
}
