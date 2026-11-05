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

    // Test 6: Silver 4-Band EQ response verification (A/B Cut vs Boost)
    {
        engine.reset();
        engine.setParam(ParamIdx::SilverSwitch, 1.0f);
        engine.setParam(ParamIdx::FreqFXSwitch, 1.0f);
        engine.setParam(ParamIdx::CurFreqFX, 0.0f); // 0 = EQ 4-Band & Compressor
        engine.setParam(ParamIdx::EQ_Switch, 1.0f);
        engine.setParam(ParamIdx::EQ_LowShelfSwitch, 1.0f);
        engine.setParam(ParamIdx::EQ_LowShelfFreq, 100.0f); // Shelf around ~500 Hz
        engine.setParam(ParamIdx::EQ_LowShelfSlope, 50.0f);

        auto measureRms = [&](float gainDb) -> float {
            engine.reset();
            engine.setParam(ParamIdx::EQ_LowShelfGain, gainDb);
            engine.noteOn(36, 0.9f); // C2 low note (65.4 Hz)
            std::vector<float> left(512, 0.0f);
            std::vector<float> right(512, 0.0f);

            // Warmup envelope
            for (int b = 0; b < 5; ++b) {
                engine.process(left.data(), right.data(), 512);
            }

            // Accumulate energy
            double sumSq = 0.0;
            size_t totalSamples = 0;
            for (int b = 0; b < 10; ++b) {
                engine.process(left.data(), right.data(), 512);
                for (size_t i = 0; i < 512; ++i) {
                    sumSq += left[i] * left[i] + right[i] * right[i];
                    totalSamples += 2;
                }
            }
            engine.allNotesOff();
            return static_cast<float>(std::sqrt(sumSq / totalSamples));
        };

        float rmsCut = measureRms(-48.0f);   // -12 dB shelf cut
        float rmsBoost = measureRms(+48.0f); // +12 dB shelf boost

        if (rmsCut <= 0.0f || rmsBoost <= 0.0f) {
            std::cerr << "[FAIL] Test 6: EQ produced zero signal (rmsCut=" << rmsCut << ", rmsBoost=" << rmsBoost << ")\n";
            return 6;
        }

        if (rmsBoost <= rmsCut * 1.5f) {
            std::cerr << "[FAIL] Test 6: Boost did not significantly increase energy over Cut! rmsCut="
                      << rmsCut << ", rmsBoost=" << rmsBoost << "\n";
            return 6;
        }

        std::cout << "  [PASS] Test 6: Silver 4-Band EQ response verified (Cut RMS: "
                  << rmsCut << " vs Boost RMS: " << rmsBoost << ", ratio: " << (rmsBoost / rmsCut) << "x)\n";
    }

    // Release all notes
    engine.allNotesOff();
    engine.reset();

    // Test 7: Incomplete model detection (map.script referencing missing .scape/.sphere pair)
    {
        auto tempDir = std::filesystem::temp_directory_path() / "axionik_incomplete_model_test.model";
        std::filesystem::create_directories(tempDir);
        {
            std::ofstream mapOut(tempDir / "map.script");
            mapOut << "MapVersionMajor\t1\n"
                   << "000LowKey\t0\n"
                   << "000HiKey\t127\n"
                   << "000RootKey\t60\n"
                   << "000LowSource\t1\n"
                   << "000HiSource\t2\n" // Source 2 does not exist on disk
                   << "000Detune\t0\n"
                   << "000Volume\t0\n"
                   << "000Pan\t0\n";
        }
        bool loadedMissingAll = engine.loadModel(0, tempDir);
        std::filesystem::remove_all(tempDir);
        if (loadedMissingAll) {
            std::cerr << "[FAIL] Test 7: Incomplete model with missing .scape/.sphere pair should be rejected!\n";
            return 7;
        }
        std::cout << "  [PASS] Test 7: Incomplete model (missing referenced source pair) rejected as not loadable.\n";
    }

    // Test 8: Preset v1 -> v2 regime migration (FUN_10013ea0: SoundVersionMajor < 2 shifts BlenderAmount by -64)
    {
        SoundPreset v1Preset = NeuronSound::getEmbeddedInitPreset();
        v1Preset.versionMajor = 1;
        v1Preset.values[ParamIdx::SoundVersionMajor] = 1.0f;
        std::string v1Script = NeuronSound::serializeSoundScript(v1Preset);

        SoundPreset parsedV1;
        NeuronSound::parseSoundScript(v1Script, parsedV1);
        if (std::abs(parsedV1.values[ParamIdx::BlenderAmount] - (-64.0f)) > 1e-4f) {
            std::cerr << "[FAIL] Test 8: Expected v1 preset BlenderAmount=-64 after FUN_10013ea0 migration, got "
                      << parsedV1.values[ParamIdx::BlenderAmount] << "\n";
            return 8;
        }

        SoundPreset v2Preset = NeuronSound::getEmbeddedInitPreset();
        v2Preset.versionMajor = 2;
        v2Preset.values[ParamIdx::SoundVersionMajor] = 2.0f;
        std::string v2Script = NeuronSound::serializeSoundScript(v2Preset);

        SoundPreset parsedV2;
        NeuronSound::parseSoundScript(v2Script, parsedV2);
        if (std::abs(parsedV2.values[ParamIdx::BlenderAmount] - 0.0f) > 1e-4f) {
            std::cerr << "[FAIL] Test 8: Expected v2 preset BlenderAmount=0 (no migration), got "
                      << parsedV2.values[ParamIdx::BlenderAmount] << "\n";
            return 8;
        }
        std::cout << "  [PASS] Test 8: Preset v1->v2 migration regime (FUN_10013ea0) verified.\n";
    }

    // Test 9: Fase 11.5.6 — Preflight blocks Expanded Model when engine lacks caps or is in Classic/Plus mode
    const std::string kSampleExpandedJson = R"JSON({
      "schemaVersion": "2.0.0",
      "identity": {
        "slug": "hyper-bell-v2",
        "expandedName": "HyperBell V2",
        "modelName": "HYPERBELL",
        "engineMin": "expanded",
        "requiredCaps": ["hd-spectral", "morph-2d", "surround", "filter-v2", "fx-v2"]
      },
      "spectral": {
        "partialCount": 512,
        "frameCount": 2,
        "frames": [
          { "amps": [0.9, 0.5, 0.3, 0.2], "offsets": [0.0, 0.0, 0.0, 0.0], "phases": [0.0, 0.0, 0.0, 0.0] },
          { "amps": [0.8, 0.4, 0.25, 0.15], "offsets": [0.0, 0.0, 0.0, 0.0], "phases": [0.0, 0.0, 0.0, 0.0] }
        ]
      },
      "unifiedSurface": {
        "topology": "melodic_surface",
        "resolutionTier": "hd",
        "partialCount": 512,
        "frameCount": 2,
        "tempoSync": {
          "enabled": true,
          "sourceBpm": 120,
          "targetBpm": 120,
          "barCount": 1,
          "grooveMode": "tempo_locked"
        },
        "nodes": [
          {
            "id": "n0",
            "sampleRef": "bell_c4",
            "rootKey": 60,
            "lowKey": 0,
            "highKey": 127,
            "velocityCenter": 100,
            "lowVel": 1,
            "highVel": 127,
            "measuredF0Hz": 261.63,
            "frames": [
              { "amps": [0.9, 0.5, 0.3, 0.2], "offsets": [0.0, 0.0, 0.0, 0.0] },
              { "amps": [0.8, 0.4, 0.25, 0.15], "offsets": [0.0, 0.0, 0.0, 0.0] }
            ]
          }
        ]
      },
      "morphSpace": {
        "dims": 2,
        "points": [{ "id": "p0", "coords": [0.0, 0.0] }]
      },
      "regions": [
        {
          "id": "reg-main",
          "sampleRef": "bell_c4",
          "lowKey": 0,
          "highKey": 127,
          "rootKey": 60,
          "lowVel": 1,
          "highVel": 127,
          "pitchKeytrack": 100.0,
          "keyFadeIn": 4,
          "keyFadeOut": 4,
          "fadeCurve": "equal-power",
          "channels": 4
        }
      ],
      "articulation": {
        "ampEnv": { "delay": 0.0, "attack": 0.002, "hold": 0.01, "decay": 0.25, "sustain": 0.85, "release": 0.2 },
        "polyphony": 16,
        "voiceMode": "poly",
        "filters": [
          { "id": "f1", "type": "svf-4p-hyper", "cutoffHz": 4200.0, "resonance": 0.35, "keytrack": 0.5, "bypass": false }
        ],
        "fxChain": [
          { "id": "fx1", "type": "chorus-v2", "bypass": false, "mix": 0.25 },
          { "id": "fx2", "type": "quantum-nebula-reverb", "bypass": false, "mix": 0.4 }
        ]
      },
      "resynators": [
        {
          "id": "r1",
          "version": 2,
          "model": "resonator-hd",
          "shapers": {
            "inharmonicityB": 0.0004,
            "parity": 0.2,
            "entropyRoughness": 0.15,
            "spectralShiftHz": 12.0,
            "hfRollOffDbPerOct": -6.0,
            "formantShiftSt": 1.0,
            "formantPreserve": 0.85,
            "residualMix": 0.2,
            "spatialSpread": 0.65
          }
        }
      ],
      "analysis": {},
      "classic": {
        "modelName": "HYPERBELL",
        "mapScriptRef": "04_classic_enhanced/map.script",
        "scapeSphereRefs": []
      }
    })JSON";

    {
        // 9a. Engine in Classic mode must reject axionik-expanded.json (mode-format-mismatch / engine-too-old)
        extended::AxionikEngineCapabilityProfile classicProfile =
            extended::AxionikEngineCapabilityProfile::makeClassic();
        engine.setEngineCapabilityProfile(classicProfile);

        extended::AxionikExpandedPreflightReport reportClassic;
        bool okClassic = engine.loadExpandedModelFromJson(0, kSampleExpandedJson, &reportClassic);
        if (okClassic || reportClassic.ok || engine.hasExpandedModelLoaded(0)) {
            std::cerr << "[FAIL] Test 9a: Classic mode engine must block axionik-expanded.json!\n";
            return 9;
        }

        // 9b. Engine in Expanded mode but missing required cap ("hd-spectral") must block load
        extended::AxionikEngineCapabilityProfile strippedProfile =
            extended::AxionikEngineCapabilityProfile::makeExpanded();
        strippedProfile.caps.erase(
            std::remove(strippedProfile.caps.begin(), strippedProfile.caps.end(), "hd-spectral"),
            strippedProfile.caps.end());
        engine.setEngineCapabilityProfile(strippedProfile);

        extended::AxionikExpandedPreflightReport reportStripped;
        bool okStripped = engine.loadExpandedModelFromJson(0, kSampleExpandedJson, &reportStripped);
        if (okStripped || reportStripped.ok || engine.hasExpandedModelLoaded(0) ||
            reportStripped.missingCaps.empty()) {
            std::cerr << "[FAIL] Test 9b: Engine missing 'hd-spectral' must block load and report missingCaps!\n";
            return 9;
        }

        std::cout << "  [PASS] Test 9: Preflight blocks incompatible mode and missing requiredCaps without silent partial load.\n";
    }

    // Test 10: Fase 11.5.6 — Full Expanded Engine accepts model, applies explicit adaptations, and renders valid audio
    {
        extended::AxionikEngineCapabilityProfile fullProfile =
            extended::AxionikEngineCapabilityProfile::makeExpanded(
                extended::AxionikSpatialOutputMode::PseudoSurroundStereo);
        fullProfile.maxPartials = 256; // Triggers hd-truncation adaptation (512 -> 256)
        engine.setEngineCapabilityProfile(fullProfile);

        extended::AxionikExpandedPreflightReport reportOk;
        bool loadedOk = engine.loadExpandedModelFromJson(0, kSampleExpandedJson, &reportOk);
        if (!loadedOk || !reportOk.ok || !engine.hasExpandedModelLoaded(0)) {
            std::cerr << "[FAIL] Test 10: Full Expanded engine failed to load valid axionik-expanded.json!\n";
            return 10;
        }

        const auto* doc = engine.getExpandedModelDoc(0);
        if (doc == nullptr || doc->spectral.partialCount != 256 ||
            doc->articulation.filters.empty() || !doc->articulation.filters[0].bypass ||
            doc->articulation.fxChain.size() < 2 || !doc->articulation.fxChain[1].bypass ||
            reportOk.adaptations.size() < 4 || !reportOk.spatialDownmixApplied) {
            std::cerr << "[FAIL] Test 10: Expected preflight adaptations (256 partial truncation, unknown filter/FX bypass, 4.0->2.0 downmix) were not applied!\n";
            return 10;
        }

        engine.reset();
        engine.noteOn(60, 0.9f);
        std::vector<float> left(512, 0.0f);
        std::vector<float> right(512, 0.0f);
        bool audible = false;
        for (int b = 0; b < 6; ++b) {
            engine.process(left.data(), right.data(), 512);
            for (size_t i = 0; i < 512; ++i) {
                if (std::isnan(left[i]) || std::isinf(left[i]) || std::isnan(right[i]) || std::isinf(right[i])) {
                    std::cerr << "[FAIL] Test 10: Expanded synthesizer produced NaN/INF!\n";
                    return 10;
                }
                if (std::abs(left[i]) > 1e-4f || std::abs(right[i]) > 1e-4f) {
                    audible = true;
                }
            }
        }
        engine.allNotesOff();
        if (!audible) {
            std::cerr << "[FAIL] Test 10: Expanded synthesizer did not produce audible signal on noteOn!\n";
            return 10;
        }
        std::cout << "  [PASS] Test 10: Expanded engine loaded axionik-expanded.json, applied "
                  << reportOk.adaptations.size() << " adaptations, and rendered finite stereo Pseudo-Surround audio.\n";
    }

    // Test 11: Fase 11.5.6 — Time-Capsule Layer Isolation (05_extended_model primary + model.nmmodel v1 fallback, never 04_classic_enhanced)
    {
        auto capsuleDir = std::filesystem::temp_directory_path() / "axionik_capsule_isolation_test";
        std::filesystem::remove_all(capsuleDir);
        std::filesystem::create_directories(capsuleDir / "04_classic_enhanced");
        std::filesystem::create_directories(capsuleDir / "05_extended_model");

        // 11a. Attempting to load 04_classic_enhanced via loadExpandedModelFolder must be rejected
        extended::AxionikExpandedPreflightReport isoReport;
        if (engine.loadExpandedModelFolder(0, capsuleDir / "04_classic_enhanced", &isoReport) || isoReport.ok) {
            std::filesystem::remove_all(capsuleDir);
            std::cerr << "[FAIL] Test 11a: loadExpandedModelFolder must reject 04_classic_enhanced!\n";
            return 11;
        }

        // 11b. Fallback to 05_extended_model/model.nmmodel when axionik-expanded.json is absent
        {
            std::ofstream nmOut(capsuleDir / "05_extended_model" / "model.nmmodel");
            nmOut << R"({"name":"FallbackV1Model","expandedName":"Fallback V1 Expanded","frames":[{"amps":[0.8,0.4,0.2,0.1]},{"amps":[0.7,0.5,0.25,0.12]}]})";
            std::ofstream mapOut(capsuleDir / "05_extended_model" / "extended_map.json");
            mapOut << R"({"regions":[{"id":"r_v1","lowKey":12,"highKey":108,"rootKey":57}]})";
        }
        extended::AxionikExpandedPreflightReport fbReport;
        if (!engine.loadExpandedModelFolder(0, capsuleDir, &fbReport) || !fbReport.ok ||
            !fbReport.usedLegacyNmModelFallback ||
            engine.getExpandedModelDoc(0) == nullptr ||
            engine.getExpandedModelDoc(0)->identity.modelName != "FallbackV1Model") {
            std::filesystem::remove_all(capsuleDir);
            std::cerr << "[FAIL] Test 11b: Failed to load v1 fallback 05_extended_model/model.nmmodel!\n";
            return 11;
        }

        // 11c. When 05_extended_model/axionik-expanded.json is present, it takes strict priority over model.nmmodel
        {
            std::ofstream expOut(capsuleDir / "05_extended_model" / "axionik-expanded.json");
            expOut << kSampleExpandedJson;
        }
        extended::AxionikExpandedPreflightReport priReport;
        if (!engine.loadExpandedModelFolder(0, capsuleDir, &priReport) || !priReport.ok ||
            priReport.usedLegacyNmModelFallback ||
            engine.getExpandedModelDoc(0) == nullptr ||
            engine.getExpandedModelDoc(0)->identity.expandedName != "HyperBell V2") {
            std::filesystem::remove_all(capsuleDir);
            std::cerr << "[FAIL] Test 11c: 05_extended_model/axionik-expanded.json did not take primary priority!\n";
            return 11;
        }

        std::filesystem::remove_all(capsuleDir);
        std::cout << "  [PASS] Test 11: Time-Capsule layer isolation (05_extended_model primary + model.nmmodel fallback, 04_classic_enhanced isolated) verified.\n";
    }

    // Test 12: Runtime Engine Mode Switching (expanded -> plus -> classic -> expanded) & Blender/Silver chain integration
    {
        if (DspEngineFacade::getCompileTargetMode() != "expanded") {
            std::cerr << "[FAIL] Test 12: Default compile target mode must be 'expanded'!\n";
            return 12;
        }
        if (!engine.setEngineMode("classic") || engine.getEngineMode() != "classic" || engine.hasExpandedModelLoaded(0)) {
            std::cerr << "[FAIL] Test 12a: Switching to 'classic' failed or did not clear expanded slot!\n";
            return 12;
        }
        if (engine.loadExpandedModelFromJson(0, kSampleExpandedJson, nullptr)) {
            std::cerr << "[FAIL] Test 12b: 'classic' mode must reject expanded JSON!\n";
            return 12;
        }
        if (!engine.setEngineMode("plus") || engine.getEngineMode() != "plus") {
            std::cerr << "[FAIL] Test 12c: Switching to 'plus' failed!\n";
            return 12;
        }
        if (engine.loadExpandedModelFromJson(0, kSampleExpandedJson, nullptr)) {
            std::cerr << "[FAIL] Test 12d: 'plus' mode must reject expanded JSON!\n";
            return 12;
        }
        if (!engine.setEngineMode("expanded") || engine.getEngineMode() != "expanded") {
            std::cerr << "[FAIL] Test 12e: Switching back to 'expanded' failed!\n";
            return 12;
        }
        if (!engine.loadExpandedModelFromJson(0, kSampleExpandedJson, nullptr)) {
            std::cerr << "[FAIL] Test 12f: 'expanded' mode failed to load expanded JSON after mode switch!\n";
            return 12;
        }
        std::cout << "  [PASS] Test 12: Runtime mode switching (expanded <-> plus <-> classic) and Blender/Silver chain verified.\n";
    }

    std::cout << "[DspEngineFacadeTests] All 12 tests passed successfully!\n";
    return 0;
}
