// ============================================================================
// ABDAxionikVS — NeuronSound.h
// Parser y serializador C++20 de presets clásicos (.sound)
// Soporta sound.script (445 parámetros), sound.stickrec (trayectorias TTTTFCVVV)
// y preset de fábrica embebido 000 InitSound.
// Exacta paridad con NeuronVS.dll, FUN_10001910, FUN_10013ea0 y SoundFormat.ts
// ============================================================================

#pragma once

#include <cstdint>
#include <cstddef>
#include <string>
#include <string_view>
#include <vector>
#include <array>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <charconv>
#include <cmath>
#include <algorithm>
#include <iomanip>
#include "Generated/ParameterRegistry.gen.h"
#include "Generated/Conversion.gen.h"

namespace abd::axionik {

/// Evento de animación vectorial de joystick (sound.stickrec)
struct StickRecEvent {
    uint16_t time{0};     ///< Marca de tiempo monotónica en ticks/ms (0x0000..0xFFFF)
    uint8_t  flag{0};     ///< Flag de transición/borde (4 bits, 0 o 1)
    uint8_t  control{0};  ///< Identificador de stick/eje (4 bits, 0..7)
    uint16_t value{0};    ///< Valor 12-bit de posición (0x000..0xFFF, 0x200 = centro 512)
};

/// Preset de sonido completo de Hartmann Neuron (sound.script + sound.stickrec)
struct SoundPreset {
    std::string name{"InitSound"};
    int versionMajor{2};
    int versionMinor{0};
    int versionBuild{0};
    int numVoices{4};
    int r1ModelIndex{511};
    int r2ModelIndex{511};
    bool r1Switch{true};
    bool r2Switch{false};

    std::array<float, kNumTotalParameters> values{};
    std::vector<StickRecEvent> stickEvents;
};

class NeuronSound {
public:
    NeuronSound() = delete;

    /// Decodifica el nombre ASCII de 16 caracteres desde SoundNameC00..SoundNameC15 (índices 6..21)
    static std::string decodeSoundName(const std::array<float, kNumTotalParameters>& values) {
        std::string name;
        name.reserve(16);
        for (size_t i = 0; i < 16; ++i) {
            uint32_t charParamIdx = 6 + static_cast<uint32_t>(i);
            int code = static_cast<int>(std::round(values[charParamIdx]));
            char c = (code >= 32 && code <= 126) ? static_cast<char>(code) : ' ';
            name.push_back(c);
        }
        // Recortar espacios finales
        while (!name.empty() && name.back() == ' ') {
            name.pop_back();
        }
        return name.empty() ? "InitSound" : name;
    }

    /// Codifica un nombre de hasta 16 caracteres en SoundNameC00..SoundNameC15
    static void encodeSoundName(std::array<float, kNumTotalParameters>& values, std::string_view name) {
        for (size_t i = 0; i < 16; ++i) {
            uint32_t charParamIdx = 6 + static_cast<uint32_t>(i);
            char c = (i < name.size()) ? name[i] : ' ';
            int code = std::clamp(static_cast<int>(c), 32, 122);
            values[charParamIdx] = static_cast<float>(code);
        }
    }

    /// Devuelve el preset inicial canónico (000 InitSound)
    static SoundPreset getEmbeddedInitPreset() {
        SoundPreset preset;
        preset.name = "InitSound";
        preset.versionMajor = 2;
        preset.versionMinor = 0;
        preset.versionBuild = 0;
        preset.numVoices = 4;
        preset.r1ModelIndex = 511;
        preset.r2ModelIndex = 511;
        preset.r1Switch = true;
        preset.r2Switch = false;

        for (size_t i = 0; i < kNumTotalParameters; ++i) {
            const auto& desc = kParameterDescriptors[i];
            // Respetar la regla de recorte FUN_10001170 para los 19 defaults que caen fuera de [min, max]
            preset.values[i] = std::clamp(desc.defaultValue, desc.min, desc.max);
        }

        encodeSoundName(preset.values, "InitSound");
        return preset;
    }

    /// Parsea un texto de sound.script completo (445 líneas clave-valor)
    static bool parseSoundScript(std::string_view text, SoundPreset& outPreset) {
        // Inicializar con valores por defecto
        outPreset = getEmbeddedInitPreset();

        std::string_view remaining = text;
        while (!remaining.empty()) {
            size_t lineEnd = remaining.find('\n');
            std::string_view line = (lineEnd == std::string_view::npos) ? remaining : remaining.substr(0, lineEnd);
            remaining = (lineEnd == std::string_view::npos) ? std::string_view{} : remaining.substr(lineEnd + 1);

            // Quitar \r final si existe
            if (!line.empty() && line.back() == '\r') {
                line.remove_suffix(1);
            }
            if (line.empty() || line[0] == '#') continue;

            // Separar clave y valor por espacio o tabulador
            size_t sepPos = line.find_first_of(" \t");
            if (sepPos == std::string_view::npos) continue;

            std::string_view key = line.substr(0, sepPos);
            std::string_view valStr = line.substr(sepPos + 1);
            // Quitar espacios/tabuladores iniciales del valor
            while (!valStr.empty() && (valStr.front() == ' ' || valStr.front() == '\t')) {
                valStr.remove_prefix(1);
            }

            float val = 0.0f;
            auto [ptr, ec] = std::from_chars(valStr.data(), valStr.data() + valStr.size(), val);
            if (ec != std::errc()) continue;

            // Búsqueda del parámetro en el descriptor
            for (size_t i = 0; i < kNumTotalParameters; ++i) {
                const auto& desc = kParameterDescriptors[i];
                if (desc.key == key) {
                    outPreset.values[i] = std::clamp(val, desc.min, desc.max);
                    break;
                }
            }
        }

        // Migración de versión 1 (FUN_10013ea0: si SoundVersionMajor < 2, BlenderAmount -= 64)
        int verMajor = static_cast<int>(outPreset.values[0]); // SoundVersionMajor
        if (verMajor < 2) {
            outPreset.values[262] -= 64.0f; // BlenderAmount [262]
        }

        outPreset.versionMajor = static_cast<int>(outPreset.values[0]);
        outPreset.versionMinor = static_cast<int>(outPreset.values[1]);
        outPreset.versionBuild = static_cast<int>(outPreset.values[2]);
        outPreset.numVoices = std::clamp(static_cast<int>(outPreset.values[5]), 1, 32);
        outPreset.r1ModelIndex = static_cast<int>(outPreset.values[22]);
        outPreset.r1Switch = (outPreset.values[23] > 0.5f);
        outPreset.r2ModelIndex = static_cast<int>(outPreset.values[102]);
        outPreset.r2Switch = (outPreset.values[103] > 0.5f);
        outPreset.name = decodeSoundName(outPreset.values);

        return true;
    }

    /// Carga y parsea sound.script desde archivo
    static bool parseSoundScriptFile(const std::filesystem::path& path, SoundPreset& outPreset) {
        std::ifstream in(path, std::ios::binary);
        if (!in) return false;
        std::string content((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
        return parseSoundScript(content, outPreset);
    }

    /// Serializa el preset al formato estándar de 445 líneas de sound.script (CRLF)
    static std::string serializeSoundScript(const SoundPreset& preset) {
        std::ostringstream ss;
        for (size_t i = 0; i < kNumTotalParameters; ++i) {
            const auto& desc = kParameterDescriptors[i];
            float val = std::clamp(preset.values[i], desc.min, desc.max);
            int intVal = static_cast<int>(std::round(val));
            ss << desc.key << "\t" << intVal << "\r\n";
        }
        return ss.str();
    }

    /// Parsea un archivo o buffer de sound.stickrec (líneas hexadecimales de 9 dígitos TTTTFCVVV)
    static bool parseStickRec(std::string_view text, std::vector<StickRecEvent>& outEvents) {
        outEvents.clear();
        std::string_view remaining = text;
        while (!remaining.empty()) {
            size_t lineEnd = remaining.find('\n');
            std::string_view line = (lineEnd == std::string_view::npos) ? remaining : remaining.substr(0, lineEnd);
            remaining = (lineEnd == std::string_view::npos) ? std::string_view{} : remaining.substr(lineEnd + 1);

            while (!line.empty() && (line.back() == '\r' || line.back() == ' ')) {
                line.remove_suffix(1);
            }
            while (!line.empty() && line.front() == ' ') {
                line.remove_prefix(1);
            }

            if (line.size() != 9) continue;

            StickRecEvent ev;
            auto [p1, ec1] = std::from_chars(line.data(), line.data() + 4, ev.time, 16);
            auto [p2, ec2] = std::from_chars(line.data() + 4, line.data() + 5, ev.flag, 16);
            auto [p3, ec3] = std::from_chars(line.data() + 5, line.data() + 6, ev.control, 16);
            auto [p4, ec4] = std::from_chars(line.data() + 6, line.data() + 9, ev.value, 16);

            if (ec1 == std::errc() && ec2 == std::errc() && ec3 == std::errc() && ec4 == std::errc()) {
                outEvents.push_back(ev);
            }
        }
        return !outEvents.empty();
    }

    /// Carga y parsea sound.stickrec desde archivo
    static bool parseStickRecFile(const std::filesystem::path& path, std::vector<StickRecEvent>& outEvents) {
        std::ifstream in(path, std::ios::binary);
        if (!in) return false;
        std::string content((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
        return parseStickRec(content, outEvents);
    }

    /// Serializa eventos de stick a formato sound.stickrec (CRLF)
    static std::string serializeStickRec(const std::vector<StickRecEvent>& events) {
        std::ostringstream ss;
        ss << std::uppercase << std::hex << std::setfill('0');
        for (const auto& ev : events) {
            ss << std::setw(4) << (ev.time & 0xFFFF)
               << std::setw(1) << (ev.flag & 0xF)
               << std::setw(1) << (ev.control & 0xF)
               << std::setw(3) << (ev.value & 0xFFF)
               << "\r\n";
        }
        return ss.str();
    }

    /// Carga un preset completo (.sound) desde su carpeta contenedora (sound.script + sound.stickrec)
    static bool loadSoundFolder(const std::filesystem::path& folderPath, SoundPreset& outPreset) {
        auto scriptFile = folderPath / "sound.script";
        if (!std::filesystem::exists(scriptFile)) {
            return false;
        }

        if (!parseSoundScriptFile(scriptFile, outPreset)) {
            return false;
        }

        auto stickFile = folderPath / "sound.stickrec";
        if (std::filesystem::exists(stickFile)) {
            parseStickRecFile(stickFile, outPreset.stickEvents);
        }

        return true;
    }
};

} // namespace abd::axionik
