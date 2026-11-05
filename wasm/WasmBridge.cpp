// ============================================================================
// ABDAxionikVS — WasmBridge.cpp
// Puente WebAssembly / AudioWorklet en C puro (extern "C")
// Conecta el AudioWorkletProcessor del navegador con DspEngineFacade (100% C++20)
// ============================================================================

#include "../Source/DSP/DspEngineFacade.h"
#include "../Source/DSP/AxionikParamIndices.h"
#include <algorithm>
#include <memory>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

extern "C" {

WASM_EXPORT void* axionik_create() {
    return new abd::axionik::DspEngineFacade();
}

WASM_EXPORT void axionik_destroy(void* handle) {
    delete static_cast<abd::axionik::DspEngineFacade*>(handle);
}

WASM_EXPORT void axionik_prepare(void* handle, double sampleRate, int blockSize) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->prepare(sampleRate, static_cast<size_t>(blockSize > 0 ? blockSize : 128));
    }
}

WASM_EXPORT void axionik_reset(void* handle) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->reset();
    }
}

WASM_EXPORT void axionik_process(void* handle, float* outL, float* outR, int numSamples) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        if (outL && outR && numSamples > 0) {
            engine->process(outL, outR, static_cast<size_t>(numSamples));
        }
    }
}

WASM_EXPORT void axionik_note_on(void* handle, int note, float velocity) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        float normVel = (velocity > 1.0f) ? std::clamp(velocity / 127.0f, 0.0f, 1.0f) : std::clamp(velocity, 0.0f, 1.0f);
        engine->noteOn(static_cast<uint8_t>(std::clamp(note, 0, 127)), normVel);
    }
}

WASM_EXPORT void axionik_note_off(void* handle, int note) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->noteOff(static_cast<uint8_t>(std::clamp(note, 0, 127)));
    }
}

WASM_EXPORT void axionik_all_notes_off(void* handle) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->allNotesOff();
    }
}

WASM_EXPORT void axionik_set_param(void* handle, int index, float rawValue) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        if (index >= 0 && static_cast<size_t>(index) < abd::axionik::kNumTotalParameters) {
            engine->setParam(static_cast<uint32_t>(index), rawValue);
        }
    }
}

WASM_EXPORT void axionik_set_param_norm(void* handle, int index, float normValue) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        if (index >= 0 && static_cast<size_t>(index) < abd::axionik::kNumTotalParameters) {
            engine->setParamNormalized(static_cast<uint32_t>(index), normValue);
        }
    }
}

WASM_EXPORT float axionik_get_param(void* handle, int index) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        if (index >= 0 && static_cast<size_t>(index) < abd::axionik::kNumTotalParameters) {
            return engine->getStore().getRawValue(static_cast<uint32_t>(index));
        }
    }
    return 0.0f;
}

WASM_EXPORT void axionik_pitch_bend(void* handle, float value) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->setPitchBend(value);
    }
}

WASM_EXPORT void axionik_mod_wheel(void* handle, float value) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        float norm = (value > 1.0f) ? std::clamp(value / 127.0f, 0.0f, 1.0f) : std::clamp(value, 0.0f, 1.0f);
        engine->setModulationSource(1, norm);
    }
}

WASM_EXPORT void axionik_channel_pressure(void* handle, float value) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        float norm = (value > 1.0f) ? std::clamp(value / 127.0f, 0.0f, 1.0f) : std::clamp(value, 0.0f, 1.0f);
        engine->setModulationSource(0, norm);
    }
}

WASM_EXPORT void axionik_midi_cc(void* handle, int cc, float value) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        float norm = (value > 1.0f) ? std::clamp(value / 127.0f, 0.0f, 1.0f) : std::clamp(value, 0.0f, 1.0f);
        switch (cc) {
            case 1:  engine->setModulationSource(1, norm); break;
            case 2:  engine->setModulationSource(2, norm); break;
            case 3:  engine->setModulationSource(3, norm); break;
            case 4:  engine->setModulationSource(4, norm); break;
            case 11: engine->setModulationSource(5, norm); break;
            case 71: engine->setParamNormalized(abd::axionik::ParamIdx::FilterReso, norm); break;
            case 74: engine->setParamNormalized(abd::axionik::ParamIdx::FilterFreq, norm); break;
            case 120:
            case 123:
                engine->allNotesOff();
                break;
            default:
                break;
        }
    }
}

WASM_EXPORT void axionik_set_master_volume(void* handle, float volume) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->setMasterVolume(volume);
    }
}

WASM_EXPORT void axionik_set_oracle_clip_mode(void* handle, int enabled) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->setOracleClipToZeroMode(enabled != 0);
    }
}

WASM_EXPORT void axionik_init_preset(void* handle) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->applyPreset(abd::axionik::NeuronSound::getEmbeddedInitPreset());
    }
}

WASM_EXPORT int axionik_load_preset_slot(void* handle, int slot) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        return engine->loadPresetBySlot(slot) ? 1 : 0;
    }
    return 0;
}

WASM_EXPORT int axionik_load_preset_script(void* handle, const char* scriptText) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        if (scriptText) {
            return engine->loadPresetFromScript(scriptText) ? 1 : 0;
        }
    }
    return 0;
}

WASM_EXPORT int axionik_load_model_slot(void* handle, int resynatorSlot, int modelIndex) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        return engine->loadModelBySlot(resynatorSlot, modelIndex) ? 1 : 0;
    }
    return 0;
}

WASM_EXPORT int axionik_set_engine_mode(void* handle, const char* modeStr) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        if (modeStr) {
            return engine->setEngineMode(modeStr) ? 1 : 0;
        }
    }
    return 0;
}

WASM_EXPORT int axionik_load_expanded_model_json(void* handle, int resynatorSlot, const char* jsonText) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        if (jsonText) {
            return engine->loadExpandedModelFromJson(resynatorSlot, jsonText, nullptr) ? 1 : 0;
        }
    }
    return 0;
}

WASM_EXPORT int axionik_set_calibration(void* handle, const char* id, float value) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        if (id) {
            return engine->setCalibrationParam(id, value) ? 1 : 0;
        }
    }
    return 0;
}

WASM_EXPORT int axionik_reset_calibration(void* handle, const char* id) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        if (id) {
            return engine->resetCalibrationParam(id) ? 1 : 0;
        }
    }
    return 0;
}

WASM_EXPORT void axionik_reset_all_calibration(void* handle) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->resetAllCalibrationParams();
    }
}

WASM_EXPORT void axionik_get_telemetry(void* handle, float* outPeakL, float* outPeakR, int* outActiveVoices, float* outCpuUsage) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        const auto t = engine->getTelemetry();
        if (outPeakL) *outPeakL = t.peakL;
        if (outPeakR) *outPeakR = t.peakR;
        if (outActiveVoices) *outActiveVoices = static_cast<int>(t.activeVoices);
        if (outCpuUsage) *outCpuUsage = t.cpuUsage;
    }
}

} // extern "C"
