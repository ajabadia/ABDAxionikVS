// ============================================================================
// ABDAxionikVS — NeuronBankAdapter.h
// Adaptador de modelos y bancos hacia las tablas del motor de audio (FUN_100440d0)
// Orquesta los dos resonadores (R1 = slot 0, R2 = slot 1) y sus 128 zonas MIDI
// ============================================================================

#pragma once

#include <cstdint>
#include <memory>
#include <filesystem>
#include "NeuronModel.h"
#include "Translator.h"

namespace abd::axionik {

class NeuronBankAdapter {
public:
    NeuronBankAdapter() = default;

    /// Carga un modelo en el resonador R1 (slot 0) o R2 (slot 1)
    bool loadModel(int slot, const std::filesystem::path& modelFolder, uint32_t* engineState) {
        if (slot < 0 || slot > 1 || engineState == nullptr) return false;

        auto model = std::make_unique<NeuronModel>();
        if (!model->loadFromFolder(modelFolder)) {
            return false;
        }

        if (slot == 0) {
            r1Model_ = std::move(model);
            applyModelToEngine(0, *r1Model_, engineState);
        } else {
            r2Model_ = std::move(model);
            applyModelToEngine(1, *r2Model_, engineState);
        }

        return true;
    }

    /// Vuelca las 128 entradas de zona de un modelo sobre la tabla del motor (FUN_100440d0)
    void applyModelToEngine(int slot, const NeuronModel& model, uint32_t* engineState) {
        if (slot < 0 || slot > 1 || engineState == nullptr) return;

        const auto& keyZones = model.getKeyZones();
        for (int key = 0; key < 128; ++key) {
            const auto& z = keyZones[key];
            writeEngineZoneEntry(
                engineState,
                slot,
                key,
                z.rootKey,
                reinterpret_cast<uintptr_t>(z.scapeLo),
                reinterpret_cast<uintptr_t>(z.scapeHi),
                reinterpret_cast<uintptr_t>(z.sphereLo),
                reinterpret_cast<uintptr_t>(z.sphereHi),
                z.detune,
                f32_raw(z.volumeGain)
            );
        }
    }

    /// Implementación directa de FUN_100440d0 (escritura de los 40 bytes de la tecla)
    /// @param engineState  Puntero al bloque de 13.948 bytes
    /// @param slot         0 (R1, tabla en +0xDB0) o 1 (R2, tabla en +0x2200)
    /// @param key          Nota MIDI (0..127)
    static void writeEngineZoneEntry(
        uint32_t* engineState,
        int slot,
        int key,
        int rootKey,
        uintptr_t scapeLo,
        uintptr_t scapeHi,
        uintptr_t sphereLo,
        uintptr_t sphereHi,
        int detune,
        uint32_t volumeGainRawBits
    ) {
        if (engineState == nullptr || slot < 0 || slot > 1 || key < 0 || key >= 128) return;

        uint8_t* stateBytes = reinterpret_cast<uint8_t*>(engineState);

        // Desactivar flag 0xD99 antes de escribir
        stateBytes[0xD99] = 0;

        // Base de la tabla: slot 0 -> 0xDB0, slot 1 -> 0x2200
        size_t baseOffset = (slot == 0) ? 0xDB0 : 0x2200;
        size_t entryOffset = baseOffset + static_cast<size_t>(key) * 0x28; // 40 bytes por tecla

        EngineZoneEntry* entry = reinterpret_cast<EngineZoneEntry*>(stateBytes + entryOffset);
        entry->flag = 0;
        entry->rootKey = rootKey;
        entry->scapeLo = static_cast<uint32_t>(scapeLo);
        entry->sphereLo = static_cast<uint32_t>(sphereLo);
        entry->scapeHi = static_cast<uint32_t>(scapeHi);
        entry->sphereHi = static_cast<uint32_t>(sphereHi);
        entry->zero18 = 0;
        entry->detune = detune;
        entry->volumeGain = volumeGainRawBits;
        entry->zero24 = 0;
    }

    [[nodiscard]] const NeuronModel* getModel(int slot) const noexcept {
        return (slot == 0) ? r1Model_.get() : r2Model_.get();
    }

private:
    std::unique_ptr<NeuronModel> r1Model_;
    std::unique_ptr<NeuronModel> r2Model_;
};

} // namespace abd::axionik
