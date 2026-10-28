// ============================================================================
// ABDAxionikVS — DspEngineFacadeTests.cpp
// Pruebas unitarias offline del motor DSP desacoplado DspEngineFacade
// ============================================================================

#include "DSP/DspEngineFacade.h"
#include "DSP/AxionikParamIndices.h"
#include <iostream>
#include <vector>
#include <cmath>
#include <cassert>

using namespace abd::axionik;

int main() {
    std::cout << "[DspEngineFacadeTests] Starting unit tests...\n";

    DspEngineFacade engine;
    engine.prepare(44100.0, 512);

    // Test 1: Silence at rest (no active voices)
    {
        std::vector<float> left(512, 0.0f);
        std::vector<float> right(512, 0.0f);

        engine.process(left.data(), right.data(), 512);

        float maxVal = 0.0f;
        for (size_t i = 0; i < 512; ++i) {
            maxVal = std::max(maxVal, std::abs(left[i]));
            maxVal = std::max(maxVal, std::abs(right[i]));
        }

        if (maxVal > 1e-6f) {
            std::cerr << "[FAIL] Test 1: Expected silence at rest, got maxVal=" << maxVal << "\n";
            return 1;
        }
        std::cout << "  [PASS] Test 1: Silence rendered when idle.\n";
    }

    // Test 2: NoteOn produces valid non-zero audio without NaN/INF
    {
        engine.noteOn(60, 0.8f);
        std::vector<float> left(512, 0.0f);
        std::vector<float> right(512, 0.0f);

        // Render multiple blocks so envelope rises
        bool producedSound = false;
        for (int b = 0; b < 10; ++b) {
            engine.process(left.data(), right.data(), 512);
            for (size_t i = 0; i < 512; ++i) {
                if (std::isnan(left[i]) || std::isinf(left[i]) || std::isnan(right[i]) || std::isinf(right[i])) {
                    std::cerr << "[FAIL] Test 2: NaN or INF detected in audio output!\n";
                    return 2;
                }
                if (std::abs(left[i]) > 0.001f || std::abs(right[i]) > 0.001f) {
                    producedSound = true;
                }
            }
        }

        if (!producedSound) {
            std::cerr << "[FAIL] Test 2: NoteOn did not produce expected audible signal.\n";
            return 2;
        }
        std::cout << "  [PASS] Test 2: NoteOn produces valid finite audio.\n";
    }

    // Test 3: Pitch bend clamping and resilience to extreme inputs
    {
        engine.setPitchBend(-100.0f); // Out of bounds negative
        std::vector<float> left(256, 0.0f);
        std::vector<float> right(256, 0.0f);
        engine.process(left.data(), right.data(), 256);

        engine.setPitchBend(+100.0f); // Out of bounds positive
        engine.process(left.data(), right.data(), 256);

        for (size_t i = 0; i < 256; ++i) {
            if (std::isnan(left[i]) || std::isinf(left[i])) {
                std::cerr << "[FAIL] Test 3: Pitch bend overflow resulted in NaN/INF!\n";
                return 3;
            }
        }
        std::cout << "  [PASS] Test 3: Extreme pitch bend clamped safely without overflow.\n";
    }

    // Test 4: Modulation controller boundaries
    {
        for (int src = 0; src < 6; ++src) {
            engine.setModulationSource(src, -5.0f);
            engine.setModulationSource(src, +10.0f);
        }
        std::vector<float> left(128, 0.0f);
        std::vector<float> right(128, 0.0f);
        engine.process(left.data(), right.data(), 128);

        for (size_t i = 0; i < 128; ++i) {
            if (std::isnan(left[i]) || std::isnan(right[i])) {
                std::cerr << "[FAIL] Test 4: Modulation source overflow produced NaN!\n";
                return 4;
            }
        }
        std::cout << "  [PASS] Test 4: Modulation sources safely bounded.\n";
    }

    // Test 5: Telemetry verification
    {
        auto telemetry = engine.getTelemetry();
        if (telemetry.cpuUsage < 0.0f || std::isnan(telemetry.cpuUsage)) {
            std::cerr << "[FAIL] Test 5: Invalid CPU telemetry: " << telemetry.cpuUsage << "\n";
            return 5;
        }
        std::cout << "  [PASS] Test 5: Telemetry reports valid load: " << telemetry.cpuUsage
                  << " (active voices: " << telemetry.activeVoices << ")\n";
    }

    // Release all notes
    engine.allNotesOff();
    engine.reset();

    std::cout << "[DspEngineFacadeTests] All 5 tests passed successfully!\n";
    return 0;
}
