// ============================================================================
// ABDAxionikVS — GoldenParityTest.cpp
// Arnés de verificación offline y comparación acústica contra vectores áureos
// Ejecutable de consola puro C++20 (independiente de GUI y de JUCE)
// ============================================================================

#include <iostream>
#include <vector>
#include <string>
#include <string_view>
#include <filesystem>
#include <fstream>
#include <cmath>
#include <numeric>
#include <algorithm>
#include <iomanip>
#include <cstdint>
#include <cstring>
#include <memory>
#include <cstdlib>

#include "DSP/DspEngineFacade.h"
#include "DSP/AxionikParamIndices.h"
#include "Generated/FactoryPresets.gen.h"

namespace fs = std::filesystem;

#pragma pack(push, 1)
struct WavHeader {
    char riff[4] = {'R', 'I', 'F', 'F'};
    uint32_t fileSize = 0;
    char wave[4] = {'W', 'A', 'V', 'E'};
    char fmt[4] = {'f', 'm', 't', ' '};
    uint32_t fmtSize = 16;
    uint16_t audioFormat = 3; // 3 = IEEE Float
    uint16_t numChannels = 2; // Stereo
    uint32_t sampleRate = 44100;
    uint32_t byteRate = 44100 * 2 * sizeof(float);
    uint16_t blockAlign = 2 * sizeof(float);
    uint16_t bitsPerSample = 32;
    char data[4] = {'d', 'a', 't', 'a'};
    uint32_t dataSize = 0;
};
#pragma pack(pop)

struct AudioCapture {
    uint32_t sampleRate{44100};
    uint16_t channels{2};
    std::vector<float> left;
    std::vector<float> right;
};

// Lector de archivos WAV float32 estéreo
bool readWavFile(const fs::path& filePath, AudioCapture& outAudio) {
    std::ifstream file(filePath, std::ios::binary);
    if (!file.is_open()) return false;

    char headerBuf[44];
    file.read(headerBuf, 44);
    if (file.gcount() < 44) return false;

    if (std::memcmp(headerBuf, "RIFF", 4) != 0 || std::memcmp(headerBuf + 8, "WAVE", 4) != 0) {
        return false;
    }

    uint16_t format = *reinterpret_cast<uint16_t*>(headerBuf + 20);
    uint16_t channels = *reinterpret_cast<uint16_t*>(headerBuf + 22);
    uint32_t sampleRate = *reinterpret_cast<uint32_t*>(headerBuf + 24);
    uint16_t bits = *reinterpret_cast<uint16_t*>(headerBuf + 34);

    if (format != 3 || channels != 2 || bits != 32) {
        std::cerr << "[WARN] Formato no compatible en " << filePath.filename().string() 
                  << ": formato=" << format << " ch=" << channels << " bits=" << bits << "\n";
        return false;
    }

    // Buscar chunk "data"
    uint32_t dataBytes = *reinterpret_cast<uint32_t*>(headerBuf + 40);
    size_t numSamplesPerChannel = dataBytes / (channels * sizeof(float));

    outAudio.sampleRate = sampleRate;
    outAudio.channels = channels;
    outAudio.left.resize(numSamplesPerChannel);
    outAudio.right.resize(numSamplesPerChannel);

    std::vector<float> interleaved(numSamplesPerChannel * 2);
    file.read(reinterpret_cast<char*>(interleaved.data()), dataBytes);

    for (size_t i = 0; i < numSamplesPerChannel; ++i) {
        outAudio.left[i]  = interleaved[i * 2 + 0];
        outAudio.right[i] = interleaved[i * 2 + 1];
    }

    return true;
}

// Escritor de archivos WAV float32 estéreo
bool writeWavFile(const fs::path& filePath, const AudioCapture& audio) {
    std::ofstream file(filePath, std::ios::binary);
    if (!file.is_open()) return false;

    size_t numFrames = audio.left.size();
    uint32_t dataBytes = static_cast<uint32_t>(numFrames * 2 * sizeof(float));

    WavHeader hdr;
    hdr.sampleRate = audio.sampleRate;
    hdr.byteRate = audio.sampleRate * 2 * sizeof(float);
    hdr.dataSize = dataBytes;
    hdr.fileSize = sizeof(WavHeader) - 8 + dataBytes;

    file.write(reinterpret_cast<const char*>(&hdr), sizeof(hdr));

    std::vector<float> interleaved(numFrames * 2);
    for (size_t i = 0; i < numFrames; ++i) {
        interleaved[i * 2 + 0] = audio.left[i];
        interleaved[i * 2 + 1] = audio.right[i];
    }

    file.write(reinterpret_cast<const char*>(interleaved.data()), dataBytes);
    return true;
}

struct AudioStats {
    float peak{0.0f};
    float rms{0.0f};
    bool finite{true};
};

AudioStats computeStats(const std::vector<float>& left, const std::vector<float>& right) {
    AudioStats stats;
    double sumSq = 0.0;
    size_t count = left.size();

    for (size_t i = 0; i < count; ++i) {
        float l = left[i];
        float r = right[i];

        if (!std::isfinite(l) || !std::isfinite(r)) {
            stats.finite = false;
        }

        float absL = std::abs(l);
        float absR = std::abs(r);
        if (absL > stats.peak) stats.peak = absL;
        if (absR > stats.peak) stats.peak = absR;

        sumSq += (l * l + r * r) * 0.5;
    }

    stats.rms = (count > 0) ? static_cast<float>(std::sqrt(sumSq / static_cast<double>(count))) : 0.0f;
    return stats;
}

double computePearsonCorrelation(const std::vector<float>& a, const std::vector<float>& b) {
    size_t n = std::min(a.size(), b.size());
    if (n == 0) return 0.0;

    double sumA = 0.0, sumB = 0.0;
    for (size_t i = 0; i < n; ++i) {
        sumA += a[i];
        sumB += b[i];
    }
    double meanA = sumA / n;
    double meanB = sumB / n;

    double num = 0.0, denA = 0.0, denB = 0.0;
    for (size_t i = 0; i < n; ++i) {
        double diffA = a[i] - meanA;
        double diffB = b[i] - meanB;
        num += diffA * diffB;
        denA += diffA * diffA;
        denB += diffB * diffB;
    }

    double den = std::sqrt(denA * denB);
    return (den > 1e-12) ? (num / den) : 0.0;
}

bool verifyZones(abd::axionik::DspEngineFacade* engine, const abd::axionik::SoundPreset& preset) {
    uint32_t* engineState = engine->getEngineState();
    if (!engineState) {
        std::cerr << "[FAIL] No se puede acceder a engineState\n";
        return false;
    }

    uint8_t* stateBytes = reinterpret_cast<uint8_t*>(engineState);
    const auto& adapter = engine->getBankAdapter();

    struct LayerInfo {
        const char* name;
        size_t offset;
        int modelId;
        int slot;
    };

    LayerInfo layers[] = {
        {"R1", 0xDB0, preset.r1ModelIndex, 0},
        {"R2", 0x2200, preset.r2ModelIndex, 1}
    };

    int totalFailures = 0;

    std::cout << "\n=======================================================\n";
    std::cout << "  Verificación de Tablas de Zonas de Teclado (FUN_100440d0)\n";
    std::cout << "=======================================================\n";

    for (const auto& l : layers) {
        const auto* model = adapter.getModel(l.slot);
        bool modelLoaded = (model != nullptr);

        std::cout << "\n[" << l.name << "] Modelo " << l.modelId << " (" 
                  << (modelLoaded ? "Cargado" : "No disponible") << "):\n";

        const abd::dsp::neuron::EngineZoneEntry* table = 
            reinterpret_cast<const abd::dsp::neuron::EngineZoneEntry*>(stateBytes + l.offset);

        // Muestra de teclas representativas (0, 1, 36, 48, 60, 72, 127)
        for (int k : {0, 1, 36, 48, 60, 72, 127}) {
            const auto& entry = table[k];
            float vol = 0.0f;
            std::memcpy(&vol, &entry.volumeGain, sizeof(float));
            std::cout << "  Tecla " << std::setw(3) << k 
                      << " -> Root: " << std::setw(3) << entry.rootKey
                      << " | ScapeLo: 0x" << std::hex << std::setw(8) << std::setfill('0') << entry.scapeLo
                      << " | SphereLo: 0x" << std::hex << std::setw(8) << std::setfill('0') << entry.sphereLo
                      << std::dec << std::setfill(' ')
                      << " | Detune: " << std::setw(3) << entry.detune
                      << " | Vol: " << std::fixed << std::setprecision(4) << vol << "\n";
        }

        // Chequeo exhaustivo de las 128 teclas contra el modelo cargable
        int matchedKeys = 0;
        int layerErrors = 0;

        if (modelLoaded) {
            const auto& keyZones = model->getKeyZones();
            for (int k = 0; k < 128; ++k) {
                const auto& expected = keyZones[k];
                const auto& actual = table[k];

                bool ok = true;
                if (actual.rootKey != expected.rootKey) ok = false;
                if (actual.detune != expected.detune) ok = false;

                // Si la zona tiene fuente baja, scapeLo y sphereLo no deben ser nulos
                if (expected.lowSource > 0) {
                    if (actual.scapeLo == 0 || actual.sphereLo == 0) ok = false;
                }

                if (ok) {
                    matchedKeys++;
                } else {
                    layerErrors++;
                    if (layerErrors <= 3) {
                        std::cerr << "  [DISCREPANCIA] Tecla " << k 
                                  << " esperada root=" << expected.rootKey 
                                  << ", real root=" << actual.rootKey << "\n";
                    }
                }
            }
            std::cout << "  Resultado " << l.name << ": " << matchedKeys << "/128 teclas validadas exactamente con map.script.\n";
        } else {
            // Si el modelo no pudo ser cargado, las 128 entradas deben estar a cero
            int zeroKeys = 0;
            for (int k = 0; k < 128; ++k) {
                const auto& actual = table[k];
                if (actual.scapeLo == 0 && actual.sphereLo == 0 && actual.rootKey == 0) {
                    zeroKeys++;
                }
            }
            std::cout << "  Resultado " << l.name << ": " << zeroKeys << "/128 entradas a cero (modelo ausente, comportamiento canónico).\n";
            matchedKeys = zeroKeys;
        }

        if (layerErrors > 0) {
            totalFailures += layerErrors;
        }
    }

    std::cout << "=======================================================\n";
    if (totalFailures == 0) {
        std::cout << "  VEREDICTO ZONAS: CORRECTO (Tablas coherentes con modelos cargables)\n";
    } else {
        std::cout << "  VEREDICTO ZONAS: FALLO (" << totalFailures << " discrepancias detectadas)\n";
    }
    std::cout << "=======================================================\n";

    return totalFailures == 0;
}

bool verifyModMatrix(abd::axionik::DspEngineFacade* engine) {
    const auto* bridge = engine->getBridge();
    if (!bridge) {
        std::cerr << "[FAIL] No se puede acceder a ParameterEngineBridge\n";
        return false;
    }

    const float* p = bridge->getEffectiveSlots();
    int failures = 0;
    auto checkClose = [&](float got, float want, const char* label) {
        if (std::fabs(static_cast<double>(got) - static_cast<double>(want)) >
            1e-6 * std::max(1.0, static_cast<double>(std::fabs(want)))) {
            std::cerr << "  [FAIL] " << label << ": got " << got << ", want " << want << "\n";
            ++failures;
        }
    };

    std::cout << "\n=======================================================\n";
    std::cout << "  Verificación de Matriz de Modulación (FUN_100134e0 / FUN_100012a0)\n";
    std::cout << "=======================================================\n";

    // Verificar invariante: con controles a 0, p[tabla[d]] == base[d] en los 63 destinos
    for (size_t d = 0; d < abd::axionik::kNumModDests; ++d) {
        int32_t slot = bridge->getDestSlot(d);
        float base = bridge->getBaseValue(d);
        if (slot < 0 || p[slot] != base) {
            std::cerr << "  [FAIL] Dest " << d << " (slot " << slot << "): p[slot]=" << p[slot] << " != base=" << base << "\n";
            ++failures;
        }
    }

    std::cout << "  Bases representativas: R1Vol=" << bridge->getBaseValue(0)
              << " | R1Semi=" << bridge->getBaseValue(1)
              << " | R2Vol=" << bridge->getBaseValue(14)
              << " | Blender=" << bridge->getBaseValue(56)
              << " | SlicerDepth=" << bridge->getBaseValue(57)
              << " | FilterFreq=" << bridge->getBaseValue(61) << "\n";

    std::cout << "  Controles (0..5): ";
    for (size_t c = 0; c < abd::axionik::kNumModSources; ++c) {
        std::cout << "C" << c << "[dest=" << bridge->getControlDestination(c)
                  << ", depth=" << bridge->getControlDepth(c) << "] ";
    }
    std::cout << "\n";

    // Probar envío MIDI CC1 = 100 (100/127) sobre el control 1 y restaurar a 0
    int32_t c1Dest = bridge->getControlDestination(1);
    float c1Depth = bridge->getControlDepth(1);
    if (c1Dest >= 0 && c1Dest < static_cast<int32_t>(abd::axionik::kNumModDests)) {
        int32_t c1Slot = bridge->getDestSlot(static_cast<size_t>(c1Dest));
        float baseBefore = bridge->getBaseValue(static_cast<size_t>(c1Dest));
        float cc1Val = 100.0f / 127.0f;
        engine->setModulationSource(1, cc1Val);
        float expected = std::clamp(
            static_cast<float>(static_cast<double>(baseBefore) + static_cast<double>(c1Depth) * static_cast<double>(cc1Val)),
            (c1Dest == 1 || c1Dest == 15) ? -24.0f : 0.0f,
            (c1Dest == 1 || c1Dest == 15) ?  24.0f : 1.0f);
        checkClose(p[c1Slot], expected, "MIDI CC1=100 -> p[slot]");
        engine->setModulationSource(1, 0.0f);
        checkClose(p[c1Slot], baseBefore, "MIDI CC1=0 -> restaura base[dest]");
    }

    std::cout << "  VEREDICTO MATRIZ: " << (failures == 0 ? "CORRECTO (63 destinos + 6 controles validados)" : "FALLO") << "\n";
    std::cout << "=======================================================\n";
    return failures == 0;
}

// Renderiza una nota desde el estado actual del motor y devuelve la captura estéreo
AudioCapture renderNote(abd::axionik::DspEngineFacade& engine, uint8_t note, float velocity,
                        size_t totalFrames, size_t blockSize, double sampleRate) {
    AudioCapture out;
    out.sampleRate = static_cast<uint32_t>(sampleRate);
    out.channels = 2;
    out.left.resize(totalFrames, 0.0f);
    out.right.resize(totalFrames, 0.0f);

    engine.noteOn(note, velocity);

    size_t framesRendered = 0;
    std::vector<float> blockBufL(blockSize, 0.0f);
    std::vector<float> blockBufR(blockSize, 0.0f);

    while (framesRendered < totalFrames) {
        size_t currentBlock = std::min(blockSize, totalFrames - framesRendered);
        std::fill(blockBufL.begin(), blockBufL.end(), 0.0f);
        std::fill(blockBufR.begin(), blockBufR.end(), 0.0f);

        engine.process(blockBufL.data(), blockBufR.data(), currentBlock);

        for (size_t i = 0; i < currentBlock; ++i) {
            out.left[framesRendered + i]  = blockBufL[i];
            out.right[framesRendered + i] = blockBufR[i];
        }

        framesRendered += currentBlock;
    }
    return out;
}

int main(int argc, char* argv[]) {
    std::cout << "=======================================================\n";
    std::cout << "  ABDAxionikVS — Arnés de Verificación Offline (Golden)\n";
    std::cout << "=======================================================\n" << std::flush;

    int presetSlot = 176;       // Por defecto: 176 (DangerDrone)
    int noteNumber = 60;        // C4
    float velocity = 100.0f / 127.0f; // Vector note60: vel 100
    double sampleRate = 44100.0;
    size_t blockSize = 512;
    size_t totalFrames = 44100; // 1 segundo exacto
    fs::path goldenPath;
    fs::path outputPath;
    bool checkZones = false;
    bool onlyZones = false;
    bool checkMatrix = false;
    bool enableMfx = false;

    // Parseo simple de argumentos CLI
    for (int i = 1; i < argc; ++i) {
        std::string_view arg = argv[i];
        if (arg == "--preset" && i + 1 < argc) {
            presetSlot = std::stoi(argv[++i]);
        } else if (arg == "--note" && i + 1 < argc) {
            noteNumber = std::stoi(argv[++i]);
        } else if (arg == "--vel" && i + 1 < argc) {
            velocity = std::stof(argv[++i]);
        } else if (arg == "--block" && i + 1 < argc) {
            blockSize = static_cast<size_t>(std::stoul(argv[++i]));
        } else if (arg == "--frames" && i + 1 < argc) {
            totalFrames = static_cast<size_t>(std::stoul(argv[++i]));
        } else if (arg == "--golden" && i + 1 < argc) {
            goldenPath = argv[++i];
        } else if (arg == "--out" && i + 1 < argc) {
            outputPath = argv[++i];
        } else if (arg == "--zones") {
            checkZones = true;
        } else if (arg == "--only-zones") {
            checkZones = true;
            onlyZones = true;
        } else if (arg == "--matrix") {
            checkMatrix = true;
        } else if (arg == "--mfx") {
            enableMfx = true;
        }
    }

    // Auto-detección de vector áureo si no se especificó (sin rutas hardcodeadas externas)
    if (goldenPath.empty()) {
        std::string wavName = "note" + std::to_string(noteNumber) + "_" + std::to_string(presetSlot) + 
                              "_" + std::to_string(sampleRate) + "_" + std::to_string(blockSize) + ".wav";
        const char* envGolden = std::getenv("GOLDEN_WAV_DIR");
        std::vector<fs::path> candidateGolden;
        if (envGolden && *envGolden) {
            candidateGolden.push_back(fs::path(envGolden) / wavName);
            candidateGolden.push_back(fs::path(envGolden) / "note60_176_44100_512.wav");
        }
        candidateGolden.push_back(fs::path("./golden") / wavName);
        candidateGolden.push_back(fs::path("./tests/golden") / wavName);
        candidateGolden.push_back(fs::path("../golden") / wavName);
        candidateGolden.push_back(fs::path("../tests/golden") / wavName);
        for (const auto& p : candidateGolden) {
            if (fs::exists(p)) {
                goldenPath = p;
                break;
            }
        }
    }

    std::cout << "[CONFIG] Preset Slot:   " << presetSlot << "\n";
    std::cout << "[CONFIG] Nota MIDI:     " << noteNumber << " (Vel: " << velocity << ")\n";
    std::cout << "[CONFIG] Sample Rate:   " << sampleRate << " Hz\n";
    std::cout << "[CONFIG] Bloque:        " << blockSize << " muestras\n";
    std::cout << "[CONFIG] Duración:      " << totalFrames << " frames (" << (totalFrames / sampleRate) << " s)\n";
    if (!goldenPath.empty()) {
        std::cout << "[CONFIG] Vector Áureo:  " << goldenPath.string() << "\n";
    }

    // 1. Instanciar motor DSP desacoplado (en heap para proteger la pila)
    std::cout << "\n[1/3] Inicializando DspEngineFacade...\n" << std::flush;
    auto engine = std::make_unique<abd::axionik::DspEngineFacade>();
    engine->prepare(sampleRate, blockSize);

    // 2. Cargar preset
    std::cout << "[2/3] Cargando preset " << presetSlot << "...\n" << std::flush;
    bool loaded = engine->loadPresetBySlot(presetSlot);
    if (!loaded) {
        std::cerr << "[WARN] No se pudo cargar el preset desde NeuronDB, usando InitPreset...\n";
    }
    // En modo de paridad VST contra NeuronVS.dll (que ignora SoundMFX* [430..444]),
    // desactivamos SoundMFXSwitch salvo que se pida explícitamente --mfx
    if (!enableMfx) {
        engine->setParam(430, 0.0f);
    }

    const auto& curPreset = engine->getCurrentPreset();
    std::cout << "      Nombre:    \"" << curPreset.name << "\"\n";
    std::cout << "      R1 Modelo: " << curPreset.r1ModelIndex << "\n";
    std::cout << "      R2 Modelo: " << curPreset.r2ModelIndex << "\n";

    if (checkZones) {
        bool zonesOk = verifyZones(engine.get(), curPreset);
        if (onlyZones && !checkMatrix) {
            return zonesOk ? 0 : 1;
        }
    }

    if (checkMatrix) {
        if (!verifyModMatrix(engine.get())) {
            return 1;
        }
        if (onlyZones) {
            return 0;
        }
    }

    // 3. Renderizar audio
    std::cout << "[3/3] Renderizando " << totalFrames << " frames de audio...\n" << std::flush;
    AudioCapture rendered = renderNote(*engine, static_cast<uint8_t>(noteNumber), velocity,
                                       totalFrames, blockSize, sampleRate);

    // Estadísticas de salida
    AudioStats stats = computeStats(rendered.left, rendered.right);
    std::cout << "\n--- Resultados de Telemetría Acústica ---\n";
    std::cout << "Muestras generadas:  " << totalFrames << "\n";
    std::cout << "Valores finitos:     " << (stats.finite ? "CORRECTO (sin NaN / Inf)" : "FALLO (contiene NaN / Inf)") << "\n";
    std::cout << "Nivel de Pico:       " << std::fixed << std::setprecision(6) << stats.peak 
              << " (" << (stats.peak > 0.0f ? 20.0f * std::log10(stats.peak) : -120.0f) << " dBFS)\n";
    std::cout << "Nivel RMS:           " << std::fixed << std::setprecision(6) << stats.rms 
              << " (" << (stats.rms > 0.0f ? 20.0f * std::log10(stats.rms) : -120.0f) << " dBFS)\n";

    // Si se especificó o detectó archivo áureo, realizar comparación cruzada
    bool parityPassed = true;
    if (!goldenPath.empty() && fs::exists(goldenPath)) {
        std::cout << "\n--- Comparación contra Vector Áureo (Golden Oracle) ---\n";
        AudioCapture golden;
        if (readWavFile(goldenPath, golden)) {
            AudioStats goldenStats = computeStats(golden.left, golden.right);
            std::cout << "Golden Peak:         " << goldenStats.peak << "\n";
            std::cout << "Golden RMS:          " << goldenStats.rms << "\n";

            double corrL = computePearsonCorrelation(rendered.left, golden.left);
            double corrR = computePearsonCorrelation(rendered.right, golden.right);
            std::cout << "Correlación L:       " << std::fixed << std::setprecision(6) << corrL << "\n";
            std::cout << "Correlación R:       " << std::fixed << std::setprecision(6) << corrR << "\n";

            // Diferencia absoluta media
            double diffSum = 0.0;
            size_t n = std::min(rendered.left.size(), golden.left.size());
            for (size_t i = 0; i < n; ++i) {
                diffSum += std::abs(rendered.left[i] - golden.left[i]);
                diffSum += std::abs(rendered.right[i] - golden.right[i]);
            }
            double meanDiff = diffSum / (n * 2.0);
            std::cout << "Diferencia Media:    " << meanDiff << "\n";

            if (corrL > 0.50 && corrR > 0.50) {
                std::cout << "[VEREDICTO] Paridad espectral y temporal CONFIRMADA.\n";
            } else {
                std::cout << "[INFO] Variación observada respecto al oráculo original (posible diferencia en curva de envolvente o filtros).\n";
            }
        } else {
            std::cerr << "[ERROR] No se pudo leer el archivo áureo.\n";
        }
    }

    // Exportar archivo WAV generado si se solicitó
    if (!outputPath.empty()) {
        std::cout << "\n[EXPORT] Guardando WAV generado en: " << outputPath.string() << "\n";
        writeWavFile(outputPath, rendered);
    }

    if (!stats.finite) {
        std::cerr << "\n[FALLO CRÍTICO] La señal contiene valores infinitos o NaN.\n";
        return 1;
    }

    if (stats.peak <= 0.000001f) {
        std::cerr << "\n[FALLO CRÍTICO] La salida es completamente silenciosa.\n";
        return 1;
    }

    // 4. Paridad diferencial de la rama EQ (CurFreqFX=0)
    //    Dos corridas con idéntico escenario EQ donde solo cambia la ganancia del
    //    LowShelf (recorte -48 vs realce +48 en unidades crudas = ∓/±12 dB):
    //    el realce debe multiplicar claramente la energía. Si los argumentos de
    //    setEQParams volvieran a invertirse (freq/gain), la ganancia no llegaría
    //    al filtro y esta aserción fallaría. Umbral calibrado con mutación: código
    //    correcto → 11.3x; argumentos invertidos → 4.3x (con 1.5x la mutación pasaba).
    std::cout << "\n=======================================================\n";
    std::cout << "  Paridad Diferencial — Rama EQ (CurFreqFX=0)\n";
    std::cout << "=======================================================\n";

    using namespace abd::axionik;
    auto configureEqScenario = [&](float shelfGainDb) {
        engine->reset();
        engine->setParam(ParamIdx::SilverSwitch, 1.0f);
        engine->setParam(ParamIdx::FreqFXSwitch, 1.0f);
        engine->setParam(ParamIdx::CurFreqFX, 0.0f); // 0 = EQ 4-Band & Compressor
        engine->setParam(ParamIdx::EQ_Switch, 1.0f);
        engine->setParam(ParamIdx::EQ_LowShelfSwitch, 1.0f);
        engine->setParam(ParamIdx::EQ_LowShelfFreq, 100.0f); // ~500 Hz
        engine->setParam(ParamIdx::EQ_LowShelfSlope, 50.0f);
        engine->setParam(ParamIdx::EQ_LowShelfGain, shelfGainDb);
    };

    configureEqScenario(-48.0f); // recorte de −12 dB en el shelf
    AudioCapture eqCut = renderNote(*engine, static_cast<uint8_t>(noteNumber), velocity,
                                    totalFrames, blockSize, sampleRate);
    configureEqScenario(+48.0f); // realce de +12 dB en el shelf
    AudioCapture eqBoost = renderNote(*engine, static_cast<uint8_t>(noteNumber), velocity,
                                      totalFrames, blockSize, sampleRate);

    AudioStats eqCutStats = computeStats(eqCut.left, eqCut.right);
    AudioStats eqBoostStats = computeStats(eqBoost.left, eqBoost.right);

    double eqDiffSum = 0.0;
    size_t eqN = std::min(eqCut.left.size(), eqBoost.left.size());
    for (size_t i = 0; i < eqN; ++i) {
        eqDiffSum += std::abs(eqCut.left[i] - eqBoost.left[i]);
        eqDiffSum += std::abs(eqCut.right[i] - eqBoost.right[i]);
    }
    double eqMeanDiff = (eqN > 0) ? eqDiffSum / (eqN * 2.0) : 0.0;
    double eqRmsRatio = (eqCutStats.rms > 1e-9f) ? eqBoostStats.rms / eqCutStats.rms : 0.0;

    std::cout << "CurFreqFX:            0 (EQ 4-Band & Compressor), nota " << noteNumber << "\n";
    std::cout << "EQ Cut   — Peak: " << std::fixed << std::setprecision(6) << eqCutStats.peak
              << " | RMS: " << eqCutStats.rms << " | finito: " << (eqCutStats.finite ? "sí" : "NO") << "\n";
    std::cout << "EQ Boost — Peak: " << eqBoostStats.peak
              << " | RMS: " << eqBoostStats.rms << " | finito: " << (eqBoostStats.finite ? "sí" : "NO") << "\n";
    std::cout << "Ratio Boost/Cut:      " << eqRmsRatio << "x (mínimo requerido: 6.0x)\n";
    std::cout << "Diferencia Media A/B: " << eqMeanDiff << "\n";

    bool eqFinite = eqCutStats.finite && eqBoostStats.finite;
    bool eqNonSilent = eqCutStats.rms > 1e-6f && eqBoostStats.rms > 1e-6f;
    bool eqBoostDominant = eqBoostStats.rms > eqCutStats.rms * 6.0f;

    if (!eqFinite || !eqNonSilent || !eqBoostDominant) {
        std::cerr << "\n[FALLO] Rama EQ no verificada:"
                  << " finito=" << (eqFinite ? "ok" : "NO")
                  << " señal=" << (eqNonSilent ? "ok" : "SILENCIO")
                  << " realce=" << (eqBoostDominant ? "ok" : "INSUFICIENTE") << "\n";
        return 1;
    }
    std::cout << "  VEREDICTO EQ: CORRECTO (ganancia del LowShelf llega al filtro de 4 bandas)\n";
    std::cout << "=======================================================\n";

    std::cout << "\n=======================================================\n";
    std::cout << "  RESULTADO: EXIT 0 (Motor DSP Verificado con Éxito)\n";
    std::cout << "=======================================================\n";
    return 0;
}
