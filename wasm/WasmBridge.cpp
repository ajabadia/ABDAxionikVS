// ============================================================================
// ABDAxionikVS — WasmBridge.cpp
// Puente WebAssembly / AudioWorklet en C puro (extern "C")
// ============================================================================

#include "../Source/DSP/DspEngineFacade.h"
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
        engine->prepare(sampleRate, static_cast<size_t>(blockSize));
    }
}

WASM_EXPORT void axionik_reset(void* handle) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->reset();
    }
}

WASM_EXPORT void axionik_process(void* handle, float* outL, float* outR, int numSamples) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->process(outL, outR, static_cast<size_t>(numSamples));
    }
}

WASM_EXPORT void axionik_note_on(void* handle, int note, float velocity) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->noteOn(static_cast<uint8_t>(note), velocity);
    }
}

WASM_EXPORT void axionik_note_off(void* handle, int note) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->noteOff(static_cast<uint8_t>(note));
    }
}

WASM_EXPORT void axionik_set_param(void* handle, int index, float rawValue) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->setParam(static_cast<uint32_t>(index), rawValue);
    }
}

WASM_EXPORT void axionik_set_param_norm(void* handle, int index, float normValue) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        engine->setParamNormalized(static_cast<uint32_t>(index), normValue);
    }
}

WASM_EXPORT float axionik_get_param(void* handle, int index) {
    if (auto* engine = static_cast<abd::axionik::DspEngineFacade*>(handle)) {
        return engine->getParam(static_cast<uint32_t>(index));
    }
    return 0.0f;
}

} // extern "C"
