// ============================================================================
// ABDAxionikVS — NeuronModel.h
// Estructuras y parser de modelos de síntesis Hartmann Neuron (.model / .nmmodel)
// Parser C++20 de chunks binarios (csAN, psAN, mnAN, fdAN) y map.script
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <string>
#include <vector>
#include <array>
#include <memory>
#include <filesystem>
#include <fstream>
#include <cstring>
#include <cmath>
#include <algorithm>

namespace abd::axionik {

inline constexpr uint32_t kSphereFrameMagic = 0x4D2; // 1234
inline constexpr size_t kMaxModelSources = 12;        // Hasta 12 pares scape/sphere por modelo
inline constexpr size_t kMidiKeysCount = 128;         // 128 notas MIDI

/// Descriptor de un Chunk binario AN (csAN, psAN, mnAN, fdAN)
struct AnChunkHeader {
    char tag[5]{0, 0, 0, 0, 0};
    uint32_t offset{0};
    uint32_t size{0}; // Incluye cabecera de 8 bytes
};

/// Archivo binario con chunks AN en memoria
class AnChunkBuffer {
public:
    bool loadFromFile(const std::filesystem::path& path) {
        std::ifstream in(path, std::ios::binary);
        if (!in) return false;
        bytes_.assign(std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>());
        if (bytes_.empty()) return false;
        return parseChunks();
    }

    [[nodiscard]] const std::vector<uint8_t>& getBytes() const noexcept { return bytes_; }
    [[nodiscard]] const uint8_t* data() const noexcept { return bytes_.data(); }
    [[nodiscard]] size_t size() const noexcept { return bytes_.size(); }
    [[nodiscard]] const std::vector<AnChunkHeader>& getChunks() const noexcept { return chunks_; }

    [[nodiscard]] const AnChunkHeader* findChunk(const char* tag) const {
        for (const auto& c : chunks_) {
            if (std::strcmp(c.tag, tag) == 0) return &c;
        }
        return nullptr;
    }

private:
    bool parseChunks() {
        chunks_.clear();
        size_t off = 0;
        while (off + 8 <= bytes_.size()) {
            AnChunkHeader c;
            std::memcpy(c.tag, bytes_.data() + off, 4);
            c.tag[4] = '\0';
            std::memcpy(&c.size, bytes_.data() + off + 4, 4);
            c.offset = static_cast<uint32_t>(off);
            chunks_.push_back(c);
            if (c.size < 8) break;
            off += c.size;
        }
        return !chunks_.empty();
    }

    std::vector<uint8_t> bytes_;
    std::vector<AnChunkHeader> chunks_;
};

/// Registro de una zona procesada (48 bytes en memoria intermedia)
struct ModelZoneRecord {
    int32_t lowKey{0};
    int32_t hiKey{127};
    int32_t rootKey{60};
    int32_t lowSource{0};
    int32_t hiSource{0};
    const uint8_t* scapeLo{nullptr};
    const uint8_t* sphereLo{nullptr};
    const uint8_t* scapeHi{nullptr};
    const uint8_t* sphereHi{nullptr};
    int32_t detune{0};
    float volumeGain{1.0f}; // 10^(dB / 20)
    float pan{0.0f};        // -1.0 .. +1.0
};

/// Entrada de zona de 40 bytes para la tabla del motor (engine+0xDB0 / engine+0x2200)
#pragma pack(push, 1)
struct EngineZoneEntry {
    uint8_t  flag{0};       // +0x00
    uint8_t  pad0[3]{0};
    int32_t  rootKey{60};   // +0x04
    uint32_t scapeLo{0};    // +0x08: puntero crudo a buffer .scape
    uint32_t sphereLo{0};   // +0x0C: puntero crudo a buffer .sphere
    uint32_t scapeHi{0};    // +0x10: puntero crudo a buffer .scape
    uint32_t sphereHi{0};   // +0x14: puntero crudo a buffer .sphere
    uint32_t zero18{0};     // +0x18
    int32_t  detune{0};     // +0x1C
    uint32_t volumeGain{0}; // +0x20: bits IEEE 754 de float (1.0 = 0x3F800000)
    uint32_t zero24{0};     // +0x24
};
#pragma pack(pop)
static_assert(sizeof(EngineZoneEntry) == 40, "EngineZoneEntry must be exactly 40 bytes");

/// Modelo completo cargado en memoria
class NeuronModel {
public:
    NeuronModel() = default;

    bool loadFromFolder(const std::filesystem::path& folderPath) {
        modelPath_ = folderPath;
        name_ = folderPath.stem().string();

        // 1. Cargar MName si existe
        auto mnameFile = folderPath / "MName";
        if (std::filesystem::exists(mnameFile)) {
            std::ifstream in(mnameFile);
            std::string line;
            if (std::getline(in, line)) {
                name_ = line.substr(0, 11);
            }
        }

        // 2. Cargar fuentes .scape y .sphere
        sources_.clear();
        for (int i = 1; i <= static_cast<int>(kMaxModelSources); ++i) {
            char scapeName[32], sphereName[32];
            std::snprintf(scapeName, sizeof(scapeName), "%06d.scape", i);
            std::snprintf(sphereName, sizeof(sphereName), "%06d.sphere", i);

            auto scapePath = folderPath / scapeName;
            auto spherePath = folderPath / sphereName;

            if (std::filesystem::exists(scapePath) && std::filesystem::exists(spherePath)) {
                auto scapeBuf = std::make_unique<AnChunkBuffer>();
                auto sphereBuf = std::make_unique<AnChunkBuffer>();

                if (scapeBuf->loadFromFile(scapePath) && sphereBuf->loadFromFile(spherePath)) {
                    SourcePair pair;
                    pair.index = i;
                    pair.scape = std::move(scapeBuf);
                    pair.sphere = std::move(sphereBuf);
                    sources_.push_back(std::move(pair));
                }
            }
        }

        // 3. Parsear map.script y mapear las 128 teclas MIDI
        return parseMapScript(folderPath / "map.script");
    }

    [[nodiscard]] const std::string& getName() const noexcept { return name_; }
    [[nodiscard]] const std::array<ModelZoneRecord, kMidiKeysCount>& getKeyZones() const noexcept { return keyZones_; }

private:
    struct SourcePair {
        int index{0};
        std::unique_ptr<AnChunkBuffer> scape;
        std::unique_ptr<AnChunkBuffer> sphere;
    };

    const SourcePair* findSource(int index) const {
        for (const auto& s : sources_) {
            if (s.index == index) return &s;
        }
        return nullptr;
    }

    bool parseMapScript(const std::filesystem::path& mapPath) {
        // Inicializar las 128 teclas con zona vacía
        for (auto& z : keyZones_) {
            z = ModelZoneRecord{};
        }

        std::ifstream in(mapPath);
        if (!in) {
            // Si no hay map.script pero hay fuente 1 (ej. sinew 511), cubrir todas las teclas
            if (!sources_.empty()) {
                const auto* src = findSource(1);
                if (src) {
                    for (size_t k = 0; k < kMidiKeysCount; ++k) {
                        keyZones_[k].lowKey = 0;
                        keyZones_[k].hiKey = 127;
                        keyZones_[k].rootKey = 69;
                        keyZones_[k].lowSource = 1;
                        keyZones_[k].hiSource = 1;
                        keyZones_[k].scapeLo = src->scape->data();
                        keyZones_[k].sphereLo = src->sphere->data();
                        keyZones_[k].scapeHi = src->scape->data();
                        keyZones_[k].sphereHi = src->sphere->data();
                        keyZones_[k].volumeGain = 1.0f;
                    }
                    return true;
                }
            }
            return false;
        }

        std::string line;
        std::vector<ModelZoneRecord> scriptZones(128);

        while (std::getline(in, line)) {
            if (line.empty()) continue;
            // Parsear formato 'NNNKey\tValue'
            if (line.size() < 4 || !std::isdigit(line[0])) continue;

            int zoneIdx = std::stoi(line.substr(0, 3));
            if (zoneIdx < 0 || zoneIdx >= 128) continue;

            size_t tab = line.find('\t');
            if (tab == std::string::npos) tab = line.find(' ');
            if (tab == std::string::npos) continue;

            std::string key = line.substr(3, tab - 3);
            std::string valStr = line.substr(tab + 1);
            int valInt = 0;
            float valFloat = 0.0f;
            try {
                valInt = std::stoi(valStr);
                valFloat = std::stof(valStr);
            } catch (...) { continue; }

            auto& rec = scriptZones[zoneIdx];
            if (key == "LowKey") rec.lowKey = valInt;
            else if (key == "HiKey") rec.hiKey = valInt;
            else if (key == "RootKey") rec.rootKey = valInt;
            else if (key == "LowSource") rec.lowSource = valInt;
            else if (key == "HiSource") rec.hiSource = valInt;
            else if (key == "Detune") rec.detune = valInt;
            else if (key == "Volume") {
                // dB = clamp(v, -32, 12); 10^(dB * 0.05)
                float db = std::clamp(valFloat, -32.0f, 12.0f);
                rec.volumeGain = std::pow(10.0f, db * 0.05f);
            } else if (key == "Pan") {
                rec.pan = std::clamp(valFloat, -51.0f, 51.0f) * 0.02f;
            }
        }

        // Asignar buffers a las zonas parseadas y mapear a keyZones_
        for (auto& z : scriptZones) {
            if (z.lowSource <= 0 && z.hiSource <= 0) continue;

            if (auto* sLo = findSource(z.lowSource)) {
                z.scapeLo = sLo->scape->data();
                z.sphereLo = sLo->sphere->data();
            }
            if (auto* sHi = findSource(z.hiSource)) {
                z.scapeHi = sHi->scape->data();
                z.sphereHi = sHi->sphere->data();
            }

            int lo = std::clamp(z.lowKey, 0, 127);
            int hi = std::clamp(z.hiKey, 0, 127);
            for (int k = lo; k <= hi; ++k) {
                keyZones_[k] = z;
            }
        }

        return true;
    }

    std::filesystem::path modelPath_;
    std::string name_;
    std::vector<SourcePair> sources_;
    std::array<ModelZoneRecord, kMidiKeysCount> keyZones_;
};

} // namespace abd::axionik
