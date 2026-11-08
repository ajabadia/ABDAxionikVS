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
#include <fstream>
#include <iterator>
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
        discoverAxionikDbPath();
    }

    /// Busca automáticamente la carpeta AxionikDB (modelos Resynator v2 / Time-Capsules)
    std::filesystem::path discoverAxionikDbPath() {
#ifdef __EMSCRIPTEN__
        return {};
#else
        if (!cachedAxionikDbPath_.empty() && std::filesystem::exists(cachedAxionikDbPath_)) {
            return cachedAxionikDbPath_;
        }

        const std::vector<std::filesystem::path> searchCandidates = {
            R"(D:\desarrollos\ABDSynths\ABDAxionikVS\AxionikDB)",
            R"(D:\desarrollos\ABDSynths\AxionikDB)",
            R"(D:\desarrollos\ABDSynths\ABDNeuModMakr\AxionikDB)",
            "./AxionikDB",
            "../AxionikDB",
            "../../AxionikDB",
            "../../../AxionikDB",
            "../../../../AxionikDB"
        };

        for (const auto& path : searchCandidates) {
            if (std::filesystem::exists(path) && std::filesystem::is_directory(path)) {
                cachedAxionikDbPath_ = path;
                axionikCanonicalIndex_.clear();
                axionikCanonicalIndexBuilt_ = false;
                return cachedAxionikDbPath_;
            }
        }

        return {};
#endif
    }

    void setAxionikDbPath(const std::filesystem::path& path) {
        if (std::filesystem::exists(path) && std::filesystem::is_directory(path)) {
            cachedAxionikDbPath_ = path;
            axionikCanonicalIndex_.clear();
            axionikCanonicalIndexBuilt_ = false;
        }
    }

    [[nodiscard]] const std::filesystem::path& getAxionikDbPath() const noexcept {
        return cachedAxionikDbPath_;
    }

    /// Resuelve la carpeta de un modelo de AxionikDB por su slug (búsqueda directa y recursiva)
    [[nodiscard]] std::filesystem::path resolveAxionikModelFolder(const std::string& slug) {
#ifdef __EMSCRIPTEN__
        (void)slug;
        return {};
#else
        if (slug.empty()) return {};
        if (cachedAxionikDbPath_.empty()) {
            discoverAxionikDbPath();
        }
        if (cachedAxionikDbPath_.empty()) return {};

        // 1. Coincidencia directa por nombre de carpeta
        auto directModels = cachedAxionikDbPath_ / "Models" / slug;
        if (std::filesystem::exists(directModels) && std::filesystem::is_directory(directModels)) {
            return directModels;
        }
        auto directRoot = cachedAxionikDbPath_ / slug;
        if (std::filesystem::exists(directRoot) && std::filesystem::is_directory(directRoot)) {
            return directRoot;
        }

        // 2. Búsqueda recursiva por nombre de carpeta
        std::error_code ec;
        for (const auto& entry : std::filesystem::recursive_directory_iterator(cachedAxionikDbPath_, std::filesystem::directory_options::skip_permission_denied, ec)) {
            if (ec) break;
            if (!entry.is_directory()) continue;
            if (entry.path().filename().string() == slug) {
                if (std::filesystem::exists(entry.path() / "axionik-expanded.json") ||
                    std::filesystem::exists(entry.path() / "05_extended_model" / "axionik-expanded.json") ||
                    std::filesystem::exists(entry.path() / "manifest.json")) {
                    return entry.path();
                }
            }
        }

        // 3. Compatibilidad con presets: el host guarda `identity.slug` del JSON,
        //    que puede diferir del nombre de carpeta (fmrhodes-hd-96k vs fmrhodes_HD).
        if (!axionikCanonicalIndexBuilt_) {
            axionikCanonicalIndexBuilt_ = true;
            std::error_code slugEc;
            for (const auto& entry : std::filesystem::recursive_directory_iterator(cachedAxionikDbPath_, std::filesystem::directory_options::skip_permission_denied, slugEc)) {
                if (slugEc) break;
                if (!entry.is_directory()) continue;
                auto folder = entry.path();
                if (folder.filename().string() == "05_extended_model") continue;

                auto jsonFile = folder / "axionik-expanded.json";
                if (!std::filesystem::exists(jsonFile)) {
                    jsonFile = folder / "05_extended_model" / "axionik-expanded.json";
                }
                if (!std::filesystem::exists(jsonFile)) {
                    jsonFile = folder / "manifest.json";
                }
                if (!std::filesystem::exists(jsonFile)) continue;

                std::error_code ec;
                const auto sz = std::filesystem::file_size(jsonFile, ec);
                if (ec || sz == 0 || sz > 16 * 1024 * 1024) continue;

                std::ifstream in(jsonFile);
                if (!in.is_open()) continue;
                const std::string text((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
                const auto identitySlug = extractSimpleJsonField(text, "slug");
                if (!identitySlug.empty()) {
                    axionikCanonicalIndex_.emplace(identitySlug, folder);
                }
            }
        }

        const auto canonical = axionikCanonicalIndex_.find(slug);
        return canonical == axionikCanonicalIndex_.end() ? std::filesystem::path{} : canonical->second;;
#endif
    }

    /// Busca automáticamente la carpeta NeuronDB en rutas estándar y locales
    std::filesystem::path discoverNeuronDbPath() {
#ifdef __EMSCRIPTEN__
        return {};
#else
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
#endif
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
        ss << R"(],"axionikFolderName":")" << escapeJson(cachedAxionikDbPath_.empty() ? "AxionikDB" : cachedAxionikDbPath_.string())
           << R"(","axionikModels":[)";
        appendAxionikModelsJson(ss);
        ss << R"(]})";
        return ss.str();
    }

    /// Carga un modelo por número de slot (000..511) buscando en la librería NeuronDB (con fallback sintético en WASM/sin disco)
    bool loadModelBySlot(int resynatorSlot, int modelSlotNumber, uint32_t* engineState) {
        if (cachedNeuronDbPath_.empty()) {
            discoverNeuronDbPath();
        }
        if (!cachedNeuronDbPath_.empty()) {
            char folderName[32];
            std::snprintf(folderName, sizeof(folderName), "%03d.model", modelSlotNumber);
            auto modelPath = cachedNeuronDbPath_ / "Models" / folderName;
            if (loadModel(resynatorSlot, modelPath, engineState)) {
                return true;
            }
        }

        return loadEmbeddedSyntheticModel(resynatorSlot, modelSlotNumber, engineState);
    }

    /// Genera e instala un modelo neuronal sintético en memoria (usado en WASM o cuando no existe NeuronDB en disco)
    bool loadEmbeddedSyntheticModel(int slot, int modelSlotNumber, uint32_t* engineState) {
        if (slot < 0 || slot > 1 || engineState == nullptr) return false;

        auto model = std::make_unique<NeuronModel>();
        if (!model->loadEmbeddedSyntheticModel(modelSlotNumber)) {
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

    /// Carga un preset de sonido (.sound) por número de slot (000..999)
    bool loadPresetBySlot(int presetSlotNumber, SoundPreset& outPreset) {
        if (cachedNeuronDbPath_.empty()) {
            discoverNeuronDbPath();
        }
        if (!cachedNeuronDbPath_.empty()) {
            char folderName[32];
            std::snprintf(folderName, sizeof(folderName), "%03d.sound", presetSlotNumber);
            auto soundPath = cachedNeuronDbPath_ / "Sounds" / folderName;

            if (std::filesystem::exists(soundPath)) {
                return NeuronSound::loadSoundFolder(soundPath, outPreset);
            }
        }

        // Fallback para WASM / entorno web sin sistema de archivos local:
        // Carga un preset sintético determinista con nombres y modelos reales
        return loadEmbeddedSyntheticPreset(presetSlotNumber, outPreset);
    }

    /// Genera un preset sintético con datos diferenciados para WASM / sin disco
    bool loadEmbeddedSyntheticPreset(int presetSlotNumber, SoundPreset& outPreset) {
        outPreset = NeuronSound::getEmbeddedInitPreset();

        // Variaciones paramétricas musicales diferenciadas por slot
        // 1. Asignar modelos R1 y R2 según catálogo histórico
        // Si presetSlotNumber < 340, los modelos están distribuidos musicalmente
        int r1Idx = (presetSlotNumber == 0) ? 511 : (presetSlotNumber % 340);
        int r2Idx = (presetSlotNumber == 0) ? 511 : ((presetSlotNumber * 7 + 13) % 340);
        outPreset.r1ModelIndex = r1Idx;
        outPreset.r2ModelIndex = r2Idx;
        outPreset.r1Switch = true;
        outPreset.r2Switch = (presetSlotNumber % 2 == 1);

        outPreset.values[22] = static_cast<float>(r1Idx); // R1ModellIndex
        outPreset.values[23] = outPreset.r1Switch ? 1.0f : 0.0f; // R1Switch
        outPreset.values[102] = static_cast<float>(r2Idx); // R2ModellIndex
        outPreset.values[103] = outPreset.r2Switch ? 1.0f : 0.0f; // R2Switch

        // 2. Modificaciones sonoras tangibles: Filtro, Envolvente y Blender
        // Filtro Silver Cutoff [274] y Reso [275]
        uint32_t seed = static_cast<uint32_t>(presetSlotNumber * 1103515245 + 12345);
        float cutoff = 30.0f + static_cast<float>((seed >> 4) % 95); // 30..124
        float reso = 10.0f + static_cast<float>((seed >> 8) % 85);   // 10..94
        outPreset.values[274] = cutoff;
        outPreset.values[275] = reso;

        // ADSR Envolvente Amplitud R1 [200..203]
        outPreset.values[200] = static_cast<float>((seed >> 2) % 80);        // Attack
        outPreset.values[201] = 20.0f + static_cast<float>((seed >> 6) % 90); // Decay
        outPreset.values[202] = 30.0f + static_cast<float>((seed >> 10) % 95); // Sustain
        outPreset.values[203] = 15.0f + static_cast<float>((seed >> 14) % 85); // Release

        // Blender Mix [262]
        outPreset.values[262] = static_cast<float>(-50 + static_cast<int>((seed >> 12) % 101));

        char nameBuf[32];
        std::snprintf(nameBuf, sizeof(nameBuf), "Sound #%03d", presetSlotNumber);
        outPreset.name = nameBuf;
        NeuronSound::encodeSoundName(outPreset.values, outPreset.name);
        return true;
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

        // 2. Cargar modelo en R1 y R2 (fallback 511 si no está definido)
        loadModelBySlot(0, preset.r1ModelIndex >= 0 ? preset.r1ModelIndex : 511, engineState);
        loadModelBySlot(1, preset.r2ModelIndex >= 0 ? preset.r2ModelIndex : 511, engineState);
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
    static std::string extractSimpleJsonField(const std::string& json, const std::string& key) {
        std::string needle = "\"" + key + "\"";
        auto pos = json.find(needle);
        if (pos == std::string::npos) return {};
        auto colon = json.find(':', pos + needle.size());
        if (colon == std::string::npos) return {};
        auto q1 = json.find('"', colon + 1);
        if (q1 == std::string::npos) return {};
        auto q2 = json.find('"', q1 + 1);
        if (q2 == std::string::npos) return {};
        return json.substr(q1 + 1, q2 - q1 - 1);
    }

    /// Lee un campo numérico simple. Devuelve `fallback` si falta o no es entero.
    static int extractSimpleJsonIntField(const std::string& json, const std::string& key, int fallback) {
        std::string needle = "\"" + key + "\"";
        auto pos = json.find(needle);
        if (pos == std::string::npos) return fallback;
        auto colon = json.find(':', pos + needle.size());
        if (colon == std::string::npos) return fallback;
        auto valueStart = json.find_first_not_of(" \t\r\n", colon + 1);
        if (valueStart == std::string::npos) return fallback;
        try {
            size_t parsed = 0;
            const int value = std::stoi(json.substr(valueStart), &parsed);
            return parsed > 0 ? value : fallback;
        } catch (...) {
            return fallback;
        }
    }

    void appendAxionikModelsJson(std::ostringstream& ss) {
#ifndef __EMSCRIPTEN__
        if (cachedAxionikDbPath_.empty()) {
            discoverAxionikDbPath();
        }
        if (cachedAxionikDbPath_.empty() || !std::filesystem::exists(cachedAxionikDbPath_)) return;

        bool firstAx = true;
        int ordCounter = 1;

        // Escaneo recursivo de modelos v2: busca cualquier axionik-expanded.json (con o sin 05_extended_model)
        // o manifest.json, determinando automáticamente el sublibrary/grupo según la jerarquía de carpetas.
        std::error_code ec;
        for (const auto& entry : std::filesystem::recursive_directory_iterator(cachedAxionikDbPath_, std::filesystem::directory_options::skip_permission_denied, ec)) {
            if (ec) break;
            if (!entry.is_regular_file()) continue;
            const auto filename = entry.path().filename().string();
            if (filename != "axionik-expanded.json" && filename != "manifest.json") continue;

            auto modelFolder = entry.path().parent_path();
            if (modelFolder.filename().string() == "05_extended_model") {
                modelFolder = modelFolder.parent_path();
            }

            // Evitar duplicados si una carpeta tiene tanto manifest.json como axionik-expanded.json
            auto v2File = modelFolder / "axionik-expanded.json";
            if (!std::filesystem::exists(v2File)) {
                v2File = modelFolder / "05_extended_model" / "axionik-expanded.json";
            }
            if (filename == "manifest.json" && std::filesystem::exists(v2File)) {
                continue; // Ya se procesará (o se ha procesado) por axionik-expanded.json
            }

            std::string slug = modelFolder.filename().string();
            std::string name = slug;
            std::string category = "Synth & Neutral";
            std::string sublib = "Default";

            // Derivar sublibrary / grupo relativo a AxionikDB / Models
            try {
                auto rel = std::filesystem::relative(modelFolder, cachedAxionikDbPath_);
                auto it = rel.begin();
                if (it != rel.end()) {
                    auto firstComp = it->string();
                    if (firstComp == "Models" || firstComp == "Banks") {
                        ++it;
                    }
                    if (it != rel.end() && it != --rel.end()) {
                        sublib = it->string(); // Carpeta de grupo (ej: Transformed_AI_BWE_96k)
                    }
                }
            } catch (...) {}

            // Extraer metadatos
            auto manifestPath = modelFolder / "manifest.json";
            int parameterSet = -1;
            std::error_code ec;
            if (std::filesystem::exists(v2File, ec) && !ec) {
                const auto sz = std::filesystem::file_size(v2File, ec);
                if (ec || sz == 0 || sz > 16 * 1024 * 1024) continue;
                std::ifstream vf(v2File);
                std::string vfText((std::istreambuf_iterator<char>(vf)), std::istreambuf_iterator<char>());
                auto eName = extractSimpleJsonField(vfText, "expandedName");
                if (eName.empty()) eName = extractSimpleJsonField(vfText, "modelName");
                if (!eName.empty()) name = eName;
                auto cat = extractSimpleJsonField(vfText, "category");
                if (!cat.empty()) category = cat;
                parameterSet = extractSimpleJsonIntField(vfText, "parameterSet", -1);
            } else if (std::filesystem::exists(manifestPath, ec) && !ec) {
                const auto sz = std::filesystem::file_size(manifestPath, ec);
                if (ec || sz == 0 || sz > 16 * 1024 * 1024) continue;
                std::ifstream mf(manifestPath);
                std::string mfText((std::istreambuf_iterator<char>(mf)), std::istreambuf_iterator<char>());
                auto mName = extractSimpleJsonField(mfText, "modelName");
                if (!mName.empty()) name = mName;
                auto cat = extractSimpleJsonField(mfText, "category");
                if (!cat.empty()) category = cat;
                parameterSet = extractSimpleJsonIntField(mfText, "parameterSet", -1);
            }

            bool hasCover = std::filesystem::exists(modelFolder / "cover.webp") ||
                            std::filesystem::exists(modelFolder / "05_extended_model" / "cover.webp");

            if (!firstAx) ss << ",";
            firstAx = false;
            ss << R"({"slug":")" << escapeJson(slug)
               << R"(","name":")" << escapeJson(name)
               << R"(","category":")" << escapeJson(category)
               << R"(","parameterSet":)" << parameterSet
               << R"(,"zoneCount":1,"complexity":8,"hasCover":)" << (hasCover ? "true" : "false")
               << R"(,"hasExpandedV2":true)"
               << R"(,"sublibrary":")" << escapeJson(sublib)
               << R"(","sublibraryOrdinal":)" << ordCounter++
               << R"(,"folderPath":")" << escapeJson(modelFolder.string()) << R"("})";
        }
#else
        (void)ss;
#endif
    }

    std::filesystem::path cachedNeuronDbPath_;
    std::filesystem::path cachedAxionikDbPath_;
    std::unordered_map<std::string, std::filesystem::path> axionikCanonicalIndex_;
    bool axionikCanonicalIndexBuilt_{false};
    std::unique_ptr<NeuronModel> r1Model_;
    std::unique_ptr<NeuronModel> r2Model_;
};

} // namespace abd::axionik
