// ============================================================================
// ABDAxionikVS — NeuronBankAdapter.h
// Adaptador de modelos y bancos hacia las tablas del motor de audio (FUN_100440d0)
// Orquesta los dos resonadores (R1 = slot 0, R2 = slot 1) y sus 128 zonas MIDI
// ============================================================================

#pragma once

#include <cstdint>
#include <memory>
#include <vector>
#include <filesystem>
#include <iostream>
#include <unordered_map>
#include <sstream>
#include <algorithm>
#include "NeuronModel.h"
#include "State/NeuronSound.h"
#include "State/SndDatStore.h"
#include "Translator.h"

namespace abd::axionik {

class NeuronBankAdapter {
public:
    NeuronBankAdapter() {
        discoverNeuronDbPath();
    }

    /// Busca automáticamente la carpeta NeuronDB en rutas estándar y locales
    std::filesystem::path discoverNeuronDbPath() {
        if (!cachedNeuronDbPath_.empty() && std::filesystem::exists(cachedNeuronDbPath_)) {
            return cachedNeuronDbPath_;
        }

        const std::vector<std::filesystem::path> searchCandidates = {
            R"(D:\desarrollos\ABDSynths\ABDAxionikVS\NeuronDB)",
            R"(C:\Users\ajaba\Downloads\neuron\NeuronVS-db\NeuronDB)",
            "./NeuronDB",
            "../NeuronDB",
            "../../NeuronDB",
            "../../../NeuronDB",
            "../../../../NeuronDB",
            R"(C:\Users\ajaba\Downloads\neuron\Hartmann Music\NeuronVS\NeuronDB)"
        };

        for (const auto& path : searchCandidates) {
            if (std::filesystem::exists(path) &&
                std::filesystem::is_directory(path / "Models") &&
                std::filesystem::is_directory(path / "Sounds") &&
                std::filesystem::exists(path / "Models" / "000.model")) {
                cachedNeuronDbPath_ = path;
                return cachedNeuronDbPath_;
            }
        }

        return {};
    }

    /// Permite asignar o sobrescribir la ruta de la librería NeuronDB
    void setNeuronDbPath(const std::filesystem::path& path) {
        if (std::filesystem::exists(path) && std::filesystem::is_directory(path / "Models")) {
            cachedNeuronDbPath_ = path;
        }
    }

    [[nodiscard]] const std::filesystem::path& getNeuronDbPath() const noexcept {
        return cachedNeuronDbPath_;
    }

    static std::string escapeJson(const std::string& in) {
        std::string out;
        out.reserve(in.size() + 4);
        for (char c : in) {
            if (c == '"') out += "\\\"";
            else if (c == '\\') out += "\\\\";
            else if (c == '\r' || c == '\n' || c == '\t') out += ' ';
            else out += c;
        }
        return out;
    }

    /// Escanea los directorios Models/ y Sounds/ de NeuronDB y devuelve un JSON para WebUI
    std::string scanCatalogJson() {
        if (cachedNeuronDbPath_.empty()) {
            discoverNeuronDbPath();
        }
        if (cachedNeuronDbPath_.empty()) {
            return R"({"type":"BANK_CATALOG_SYNC","folderName":"No NeuronDB Found","models":[],"presets":[]})";
        }

        std::ostringstream ss;
        ss << R"({"type":"BANK_CATALOG_SYNC","folderName":")";
        for (char c : cachedNeuronDbPath_.string()) {
            if (c == '\\') ss << "\\\\";
            else if (c == '"') ss << "\\\"";
            else ss << c;
        }
        ss << R"(","models":[)";

        // 1. ModelNames cache
        std::unordered_map<int, std::string> modelNamesCache;
        auto mnFile = cachedNeuronDbPath_ / "ModelNames";
        if (std::filesystem::exists(mnFile)) {
            std::ifstream in(mnFile);
            std::string line;
            while (std::getline(in, line)) {
                if (line.empty()) continue;
                std::istringstream iss(line);
                int slot = -1;
                std::string name;
                if (iss >> slot) {
                    std::getline(iss, name);
                    while (!name.empty() && (name.front() == '\t' || name.front() == ' ')) name.erase(name.begin());
                    while (!name.empty() && (name.back() == '\r' || name.back() == ' ')) name.pop_back();
                    if (!name.empty()) {
                        modelNamesCache[slot] = name;
                    }
                }
            }
        }

        // 2. Scan Models
        auto modelsDir = cachedNeuronDbPath_ / "Models";
        bool firstM = true;
        if (std::filesystem::exists(modelsDir) && std::filesystem::is_directory(modelsDir)) {
            std::vector<std::pair<int, std::filesystem::path>> foundModels;
            for (const auto& entry : std::filesystem::directory_iterator(modelsDir)) {
                if (!entry.is_directory()) continue;
                auto filename = entry.path().filename().string();
                if (filename.size() >= 7 && filename.ends_with(".model")) {
                    try {
                        int slot = std::stoi(filename.substr(0, filename.size() - 6));
                        foundModels.push_back({slot, entry.path()});
                    } catch (...) {}
                }
            }
            std::sort(foundModels.begin(), foundModels.end(), [](const auto& a, const auto& b) {
                return a.first < b.first;
            });

            for (const auto& item : foundModels) {
                int slot = item.first;
                const auto& path = item.second;
                std::string name;
                auto mnameFile = path / "mname";
                if (std::filesystem::exists(mnameFile)) {
                    std::ifstream in(mnameFile);
                    std::getline(in, name);
                    while (!name.empty() && (name.back() == '\r' || name.back() == ' ')) name.pop_back();
                }
                if (name.empty()) {
                    auto it = modelNamesCache.find(slot);
                    if (it != modelNamesCache.end()) {
                        name = it->second;
                    } else {
                        char buf[32];
                        std::snprintf(buf, sizeof(buf), "Model #%03d", slot);
                        name = buf;
                    }
                }

                int pSet = slot % 10;
                int complexity = 5;

                if (!firstM) ss << ",";
                firstM = false;
                ss << R"({"slot":)" << slot
                   << R"(,"name":")" << escapeJson(name)
                   << R"(","folderName":")" << path.filename().string()
                   << R"(","zoneCount":1,"parameterSet":)" << pSet
                   << R"(,"complexity":)" << complexity
                   << R"(,"sourceCount":1})";
            }
        }
        ss << R"(],"presets":[)";

        // 3. Scan Sounds
        auto soundsDir = cachedNeuronDbPath_ / "Sounds";
        bool firstP = true;
        if (std::filesystem::exists(soundsDir) && std::filesystem::is_directory(soundsDir)) {
            std::vector<std::pair<int, std::filesystem::path>> foundSounds;
            for (const auto& entry : std::filesystem::directory_iterator(soundsDir)) {
                if (!entry.is_directory()) continue;
                auto filename = entry.path().filename().string();
                if (filename.size() >= 7 && filename.ends_with(".sound")) {
                    try {
                        int slot = std::stoi(filename.substr(0, filename.size() - 6));
                        foundSounds.push_back({slot, entry.path()});
                    } catch (...) {}
                }
            }
            std::sort(foundSounds.begin(), foundSounds.end(), [](const auto& a, const auto& b) {
                return a.first < b.first;
            });

            for (const auto& item : foundSounds) {
                int slot = item.first;
                const auto& path = item.second;
                SoundPreset sp;
                std::string presetName;
                int r1 = 511, r2 = 511;
                if (NeuronSound::loadSoundFolder(path, sp)) {
                    presetName = sp.name;
                    r1 = sp.r1ModelIndex;
                    r2 = sp.r2ModelIndex;
                } else {
                    char buf[32];
                    std::snprintf(buf, sizeof(buf), "Sound #%03d", slot);
                    presetName = buf;
                }

                if (!firstP) ss << ",";
                firstP = false;
                ss << R"({"slot":)" << slot
                   << R"(,"name":")" << escapeJson(presetName)
                   << R"(","category":"General","modelIndex":)" << r1
                   << R"(,"r2Model":)" << r2
                   << R"(,"parameterCount":445})";
            }
        }
        ss << R"(]})";
        return ss.str();
    }

    /// Carga un modelo por número de slot (000..511) buscando en la librería NeuronDB
    bool loadModelBySlot(int resynatorSlot, int modelSlotNumber, uint32_t* engineState) {
        if (cachedNeuronDbPath_.empty()) {
            discoverNeuronDbPath();
        }
        if (cachedNeuronDbPath_.empty()) return false;

        char folderName[32];
        std::snprintf(folderName, sizeof(folderName), "%03d.model", modelSlotNumber);
        auto modelPath = cachedNeuronDbPath_ / "Models" / folderName;

        return loadModel(resynatorSlot, modelPath, engineState);
    }

    /// Carga un preset de sonido (.sound) por número de slot (000..999)
    bool loadPresetBySlot(int presetSlotNumber, SoundPreset& outPreset) {
        if (cachedNeuronDbPath_.empty()) {
            discoverNeuronDbPath();
        }
        if (cachedNeuronDbPath_.empty()) {
            outPreset = NeuronSound::getEmbeddedInitPreset();
            return false;
        }

        char folderName[32];
        std::snprintf(folderName, sizeof(folderName), "%03d.sound", presetSlotNumber);
        auto soundPath = cachedNeuronDbPath_ / "Sounds" / folderName;

        if (std::filesystem::exists(soundPath)) {
            return NeuronSound::loadSoundFolder(soundPath, outPreset);
        }

        outPreset = NeuronSound::getEmbeddedInitPreset();
        return false;
    }

    /// Inicializa el estado del motor con el preset 000 InitSound y el modelo 511 (sinew)
    void initDefaultModelsAndPresets(uint32_t* engineState, SndDatStore& store) {
        // 1. Cargar preset 000 o inicial embebido
        SoundPreset preset;
        if (!loadPresetBySlot(0, preset)) {
            preset = NeuronSound::getEmbeddedInitPreset();
        }

        for (size_t i = 0; i < kNumTotalParameters; ++i) {
            store.setRawValue(static_cast<uint32_t>(i), preset.values[i], false);
        }

        // 2. Cargar modelo 511 en R1 y R2
        loadModelBySlot(0, preset.r1ModelIndex > 0 ? preset.r1ModelIndex : 511, engineState);
        loadModelBySlot(1, preset.r2ModelIndex > 0 ? preset.r2ModelIndex : 511, engineState);
    }

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

    [[nodiscard]] const ModelZoneRecord& getZone(int slot, uint8_t key) const noexcept {
        static const ModelZoneRecord kDefaultZone{
            0, 127, 60, 0, 0, nullptr, 0, nullptr, 0, nullptr, 0, nullptr, 0, 0, 1.0f, 0.0f
        };
        const auto* m = getModel(slot);
        if (m && key < 128) {
            return m->getKeyZones()[key];
        }
        return kDefaultZone;
    }

private:
    std::filesystem::path cachedNeuronDbPath_;
    std::unique_ptr<NeuronModel> r1Model_;
    std::unique_ptr<NeuronModel> r2Model_;
};

} // namespace abd::axionik
