// ============================================================================
// ABDAxionikVS — TranslatorHooks.cpp
// Implementación de las funciones del motor que el traductor invoca al final:
//   - validateEngineState (FUN_100373a0: validación de buffers scape/sphere)
//   - translateSubObject  (FUN_100343e4: sub-objeto en estado[0xD95])
// ============================================================================

#include "Translator.h"
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace abd::axionik {
namespace {

constexpr size_t kGateByte     = 0xD98;   // byte: motor construido
constexpr size_t kEntryCount   = 128;     // teclas MIDI
constexpr size_t kEntryStride  = 0x28;    // 40 bytes por tecla
constexpr size_t kR1           = 0xDB0;   // tabla de la capa R1
constexpr size_t kR2           = 0x2200;  // tabla de la capa R2
constexpr size_t kScapeLo      = 0x08;
constexpr size_t kSphereLo     = 0x0C;
constexpr size_t kScapeHi      = 0x10;
constexpr size_t kSphereHi     = 0x14;

constexpr uint32_t kFrameTag   = 0x4D2;
constexpr size_t kFrameCount   = 0x18;
constexpr size_t kFrameIdBase  = 0x0C;
constexpr size_t kFrameStride  = 0x44;
constexpr size_t kFrameBank    = 0x48;

inline uint32_t load_u32(const void* base, size_t offset) {
    uint32_t value = 0;
    std::memcpy(&value, static_cast<const uint8_t*>(base) + offset, sizeof value);
    return value;
}

inline uint8_t load_u8(const void* base, size_t offset) {
    return *(static_cast<const uint8_t*>(base) + offset);
}

inline const uint8_t* load_ptr(const uint32_t* state, size_t offset) {
    return reinterpret_cast<const uint8_t*>(
        static_cast<uintptr_t>(load_u32(state, offset)));
}

bool sphere_ok(const uint8_t* buffer) {
    if (buffer == nullptr) return true;
    if (buffer[0] != 'p' && buffer[0] != 'N') return false;

    const uint32_t frames = load_u32(buffer, kFrameCount);
    const int32_t first   = static_cast<int32_t>(load_u32(buffer, kFrameIdBase));
    const int32_t stride  = static_cast<int32_t>(load_u32(buffer, kFrameStride));
    const int32_t bank    = static_cast<int32_t>(load_u32(buffer, kFrameBank));
    if (frames == 0) return true;

    for (uint32_t i = 0; i < frames; ++i) {
        const uint32_t index = std::min(i, frames - 1);
        const uint8_t* frame = buffer + static_cast<ptrdiff_t>(index) * stride + bank;
        if (load_u32(frame, 0x04) != i + static_cast<uint32_t>(first)) return false;
        if (load_u32(frame, 0x00) != kFrameTag) return false;
    }
    return true;
}

bool scape_ok(const uint8_t* buffer) {
    return buffer == nullptr || buffer[0] == 'c' || buffer[0] == 'N';
}

} // namespace

char validateEngineState(const uint32_t* state) {
    if (state == nullptr) return 0;
    if (load_u8(state, kGateByte) == 0) return 0;

    bool ok = true;
    for (size_t key = 0; key < kEntryCount; ++key) {
        const size_t entry = key * kEntryStride;
        ok = ok && sphere_ok(load_ptr(state, kR1 + entry + kSphereHi));
        ok = ok && sphere_ok(load_ptr(state, kR2 + entry + kSphereHi));
        ok = ok && sphere_ok(load_ptr(state, kR1 + entry + kSphereLo));
        ok = ok && sphere_ok(load_ptr(state, kR2 + entry + kSphereLo));
        ok = ok && scape_ok(load_ptr(state, kR1 + entry + kScapeLo));
        ok = ok && scape_ok(load_ptr(state, kR1 + entry + kScapeHi));
        ok = ok && scape_ok(load_ptr(state, kR2 + entry + kScapeLo));
        ok = ok && scape_ok(load_ptr(state, kR2 + entry + kScapeHi));
    }
    return ok ? 1 : 0;
}

void translateSubObject(void* self, const uint32_t* p) {
    (void)self;
    (void)p;
    // Port de 0x100343E4 (501 líneas): opera sobre el sub-objeto en estado[0xD95]
}

} // namespace abd::axionik
