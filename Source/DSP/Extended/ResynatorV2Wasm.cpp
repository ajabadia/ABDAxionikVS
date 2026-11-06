// ============================================================================
// ABDAxionikVS — Source/DSP/Extended/ResynatorV2Wasm.cpp
// Fachada C-ABI mínima sobre `AxionikExpandedSynthesizer.h` para compilar el
// motor REAL a WebAssembly y consumirlo desde ABDNeuModMakr.
//
// Fuente de la verdad: este fichero NO contiene DSP. Envuelve la misma
// cabecera que compila el plugin; cualquier cambio de sonido se hace allí y
// llega aquí vía recompilación (ver tools/resynator-wasm/). No portar, no
// espejar, no "alinear a mano".
//
// ABI (versionada): si se añade/quita/cambia una función, subir
// RESYNATOR_V2_WASM_ABI. El loader TS (`ResynatorV2Wasm.ts`) comprueba la
// versión al cargar y falla en voz alta si no coincide (nunca audio
// equivocado en silencio).
// ============================================================================
#include "AxionikExpandedSynthesizer.h"

#include <string>
#include <string_view>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define RESYN_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define RESYN_EXPORT
#endif

#define RESYNATOR_V2_WASM_ABI 1

namespace {

abd::axionik::extended::AxionikExpandedSynthesizer gSynth;
std::vector<float> gScratchL;
std::vector<float> gScratchR;
std::vector<float> gInterleaved;
std::string gLastError;
double gSampleRate = 44100.0;
bool gReady = false;

void setError(std::string msg) { gLastError = std::move(msg); }

} // namespace

extern "C" {

/// Versión ABI de esta fachada. Debe coincidir con EXPECTED_RESYNATOR_ABI en TS.
RESYN_EXPORT int resynAbiVersion() { return RESYNATOR_V2_WASM_ABI; }

/// Inicializa el sinte a `sampleRate`. Debe llamarse antes que nada. Devuelve 1.
RESYN_EXPORT int resynCreate(double sampleRate) {
    gSampleRate = (sampleRate > 0.0) ? sampleRate : 44100.0;
    gSynth.prepare(gSampleRate, 512);
    gSynth.reset();
    gScratchL.clear();
    gScratchR.clear();
    gLastError.clear();
    gReady = true;
    return 1;
}

/// Carga un documento axionik-expanded.json v2 (texto JSON, `len` bytes).
/// Usa el perfil de capacidades "expanded" completo (previsualización fiel al
/// motor embarcado). Devuelve 1 si el modelo quedó cargado, 0 si no.
/// El motivo del rechazo se recupera con `resynLastError()`.
RESYN_EXPORT int resynLoadModel(const char* json, int len) {
    if (!gReady || json == nullptr || len <= 0) {
        setError("resynLoadModel: engine not created or empty input");
        return 0;
    }
    const std::string_view text(json, static_cast<size_t>(len));
    abd::axionik::extended::AxionikExpandedModelDoc doc;
    const abd::axionik::extended::AxionikEngineCapabilityProfile profile =
        abd::axionik::extended::AxionikEngineCapabilityProfile::makeExpanded();
    const abd::axionik::extended::AxionikExpandedPreflightReport report =
        abd::axionik::extended::preflightExpandedModelForAxionik(text, profile, &doc);
    if (!report.ok) {
        std::string why = "preflight rejected the model";
        if (!report.errors.empty()) {
            why += ": " + report.errors.front();
            if (report.errors.size() > 1) {
                why += " (+" + std::to_string(report.errors.size() - 1) + " more)";
            }
        }
        setError(why);
        return 0;
    }
    gSynth.loadModel(doc);
    if (!gSynth.hasLoadedModel()) {
        setError("loadModel: engine did not retain the model");
        return 0;
    }
    gLastError.clear();
    return 1;
}

RESYN_EXPORT int resynHasModel() { return (gReady && gSynth.hasLoadedModel()) ? 1 : 0; }

RESYN_EXPORT void resynNoteOn(int midiNote, float velocity01) {
    if (!gReady) return;
    const int clamped = midiNote < 0 ? 0 : (midiNote > 127 ? 127 : midiNote);
    const float vel = velocity01 < 0.0f ? 0.0f : (velocity01 > 1.0f ? 1.0f : velocity01);
    gSynth.noteOn(static_cast<uint8_t>(clamped), vel);
}

RESYN_EXPORT void resynNoteOff(int midiNote) {
    if (!gReady) return;
    const int clamped = midiNote < 0 ? 0 : (midiNote > 127 ? 127 : midiNote);
    gSynth.noteOff(static_cast<uint8_t>(clamped));
}

RESYN_EXPORT void resynAllNotesOff() {
    if (!gReady) return;
    gSynth.allNotesOff();
}

/// Renderiza `frames` muestras estéreo entrelazadas (L,R,L,R,...) en un buffer
/// interno y devuelve su puntero (válido hasta la próxima llamada). Devuelve
/// nullptr si el motor no está listo o `frames <= 0`. Diseñado para JS: sin
/// malloc/free exportados, el anfitrión copia con HEAPF32.slice().
/// `processStereoAdd` es aditiva: el scratch se pone a cero antes de mezclar.
RESYN_EXPORT float* resynRenderBlock(int frames) {
    if (!gReady || frames <= 0) return nullptr;
    const size_t n = static_cast<size_t>(frames);
    if (gScratchL.size() < n) {
        gScratchL.resize(n, 0.0f);
        gScratchR.resize(n, 0.0f);
        gInterleaved.resize(n * 2, 0.0f);
    }
    std::fill(gScratchL.begin(), gScratchL.begin() + n, 0.0f);
    std::fill(gScratchR.begin(), gScratchR.begin() + n, 0.0f);
    gSynth.processStereoAdd(gScratchL.data(), gScratchR.data(), n);
    for (size_t i = 0; i < n; ++i) {
        gInterleaved[2 * i] = gScratchL[i];
        gInterleaved[2 * i + 1] = gScratchR[i];
    }
    return gInterleaved.data();
}

/// Último error (texto). Puntero válido hasta la próxima llamada que lo cambie.
RESYN_EXPORT const char* resynLastError() { return gLastError.c_str(); }

} // extern "C"
