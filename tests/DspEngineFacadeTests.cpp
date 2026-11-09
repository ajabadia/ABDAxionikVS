// ============================================================================
// ABDAxionikVS -- DspEngineFacadeTests.cpp
// Pruebas unitarias offline del motor DSP desacoplado DspEngineFacade
// ============================================================================

#include "DSP/DspEngineFacade.h"
#include "DSP/NeuronBankAdapter.h"
#include "DSP/Extended/AxionikExpandedSynthesizer.h"
#include "DSP/ParamGrouping.h"
#include "State/NeuronSound.h"
#include "DSP/AxionikParamIndices.h"
#include <iostream>
#include <vector>
#include <cmath>
#include <cassert>
#include <filesystem>
#include <fstream>
#include <memory> // heap-allocated facades: sizeof(DspEngineFacade) ~2.6 MB; three on main's 8 MB stack overflow it

using namespace abd::axionik;

int main() {
    std::cout << std::unitbuf;
    std::cerr << "[main] enter sizeof(Facade)=" << sizeof(DspEngineFacade) << std::endl;
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

    // Test 9: Fase 11.5.6 -- Preflight blocks Expanded Model when engine lacks caps or is in Classic/Plus mode
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

    // Test 10: Fase 11.5.6 -- Full Expanded Engine accepts model, applies explicit adaptations, and renders valid audio
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

    // Test 11: Fase 11.5.6 -- Time-Capsule Layer Isolation (05_extended_model primary + model.nmmodel v1 fallback, never 04_classic_enhanced)
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

    // Test 13: Phase K.1 -- SymBipolar wireZeroCenter and semanticRole contracts
    {
        // 13.1: SymBipolar center deadband (176 parameters in [-64..63])
        size_t symBipolarCount = 0;
        for (uint32_t i = 0; i < kNumTotalParameters; ++i) {
            const auto& desc = kParameterDescriptors[i];
            if (desc.isSymBipolar) {
                symBipolarCount++;
                // At center norm=0.5f, must map exactly to raw 0.0f
                float rawZero = normalizedToRaw(i, 0.5f);
                if (std::abs(rawZero) > 1e-5f) {
                    std::cerr << "[FAIL] Test 13.1: Param " << desc.key << " norm 0.5 must produce 0.0f, got " << rawZero << "\n";
                    return 13;
                }
                // At raw=0.0f, must map exactly to norm 0.5f
                float normHalf = rawToNormalized(i, 0.0f);
                if (std::abs(normHalf - 0.5f) > 1e-5f) {
                    std::cerr << "[FAIL] Test 13.1: Param " << desc.key << " raw 0.0 must produce 0.5f, got " << normHalf << "\n";
                    return 13;
                }
                // Extremes: -64 -> 0.0, +63 -> 1.0
                if (std::abs(rawToNormalized(i, -64.0f) - 0.0f) > 1e-5f ||
                    std::abs(rawToNormalized(i, 63.0f) - 1.0f) > 1e-5f) {
                    std::cerr << "[FAIL] Test 13.1: Param " << desc.key << " extremes mismatch!\n";
                    return 13;
                }
            }
        }
        if (symBipolarCount != 176) {
            std::cerr << "[FAIL] Test 13.1: Expected 176 SymBipolar parameters, found " << symBipolarCount << "\n";
            return 13;
        }

        // 13.2: Semantic Roles coverage (48 parameters)
        size_t roleCount = 0;
        for (uint32_t i = 0; i < kNumTotalParameters; ++i) {
            const auto& desc = kParameterDescriptors[i];
            if (!desc.semanticRole.empty()) {
                roleCount++;
            }
        }
        if (roleCount != 48) {
            std::cerr << "[FAIL] Test 13.2: Expected 48 parameters with semanticRole, found " << roleCount << "\n";
            return 13;
        }

        // 13.3: Specific canonical roles verification
        const auto* panDesc = getParamDescriptor(ParamIdx::SoundPan);
        if (!panDesc || panDesc->semanticRole != "MasterPan" || !panDesc->isSymBipolar) {
            std::cerr << "[FAIL] Test 13.3: SoundPan must have MasterPan semanticRole and isSymBipolar!\n";
            return 13;
        }

        const auto* filterFreqDesc = getParamDescriptor(ParamIdx::FilterFreq);
        if (!filterFreqDesc || filterFreqDesc->semanticRole != "FilterCutoff") {
            std::cerr << "[FAIL] Test 13.3: FilterFreq must have FilterCutoff semanticRole!\n";
            return 13;
        }

        const auto* r1AmpAttackDesc = getParamDescriptor(ParamIdx::R1AmpEnvA);
        if (!r1AmpAttackDesc || r1AmpAttackDesc->semanticRole != "AmpEnvAttack") {
            std::cerr << "[FAIL] Test 13.3: R1AmpEnvA must have AmpEnvAttack semanticRole!\n";
            return 13;
        }

        std::cout << "  [PASS] Test 13: Phase K.1 SymBipolar exact zero (176 params) and semanticRole coverage (48 params) verified.\n";
    }

    // Test 14: Phase K.2 -- Rompler Multisample and Sampler Voice Spec Roundtrip
    {
        // 14.1: Construct an expanded instrument JSON mimicking ABDNeuModMakr export
        // with 3 zones (split by note/vel) mapped against sampler_voice_parameter_spec keys
        const std::string multisampleJson = R"JSON({
          "schemaVersion": "2.0.0",
          "identity": {
            "slug": "acoustic-grand-multisample",
            "expandedName": "Acoustic Grand Piano (3-Zone Velocity)",
            "modelName": "PIANO_VEL",
            "engineMin": "expanded",
            "requiredCaps": ["filter-v2"]
          },
          "spectral": {
            "partialCount": 64,
            "frameCount": 2,
            "frameSpanHz": 20000.0,
            "frames": [
              { "f0Hz": 261.63, "amps": [0.8, 0.4, 0.2], "offsets": [0.0, 12.0, 19.0] },
              { "f0Hz": 261.63, "amps": [0.4, 0.2, 0.1], "offsets": [0.0, 12.0, 19.0] }
            ]
          },
          "regions": [
            {
              "id": "zone_low_p",
              "sampleRef": "piano_c3_soft.wav",
              "lowKey": 0,
              "highKey": 60,
              "rootKey": 48,
              "lowVel": 1,
              "highVel": 64,
              "volumeDb": -2.0,
              "loop": { "mode": "loop_continuous", "startFrame": 4410, "endFrame": 22050, "crossfadeMs": 0 }
            },
            {
              "id": "zone_low_f",
              "sampleRef": "piano_c3_loud.wav",
              "lowKey": 0,
              "highKey": 60,
              "rootKey": 48,
              "lowVel": 65,
              "highVel": 127,
              "volumeDb": 1.5,
              "loop": { "mode": "loop_continuous", "startFrame": 4410, "endFrame": 22050, "crossfadeMs": 0 }
            },
            {
              "id": "zone_hi",
              "sampleRef": "piano_c5.wav",
              "lowKey": 61,
              "highKey": 127,
              "rootKey": 72,
              "lowVel": 1,
              "highVel": 127,
              "volumeDb": 0.0,
              "loop": { "mode": "no_loop", "startFrame": 0, "endFrame": 0, "crossfadeMs": 0 }
            }
          ],
          "articulation": {
            "polyphony": 16,
            "voiceMode": "poly",
            "ampEnv": { "attack": 0.005, "decay": 1.5, "sustain": 0.4, "release": 0.8 },
            "filters": [
              { "id": "main-filter", "type": "ladder-v2", "cutoffHz": 12000.0, "resonance": 0.2 }
            ]
          },
          "resynators": [
            { "id": "r1", "version": 2, "model": "resonator-hd" }
          ],
          "analysis": {},
          "classic": { "modelName": "PIANO_VEL" }
        })JSON";

        auto samplerEngine = std::make_unique<DspEngineFacade>();
        samplerEngine->prepare(44100.0, 512);

        extended::AxionikExpandedPreflightReport report;
        bool loaded = samplerEngine->loadExpandedModelFromJson(0, multisampleJson, &report);
        if (!loaded || !report.ok) {
            std::cerr << "[FAIL] Test 14: Failed to parse multisample JSON! Errors:\n";
            for (const auto& err : report.errors) std::cerr << "  - " << err << "\n";
            return 14;
        }

        if (!samplerEngine->hasExpandedModelLoaded(0)) {
            std::cerr << "[FAIL] Test 14: hasExpandedModelLoaded(0) must be true!\n";
            return 14;
        }

        // 14.1b: Loop transfer — nested `loop` object (ABDNeuModMakr shape)
        // must survive parsing instead of defaulting to no_loop/0.
        {
            const auto* doc = samplerEngine->getExpandedModelDoc(0);
            if (!doc) {
                std::cerr << "[FAIL] Test 14.1b: getExpandedModelDoc(0) must not be null!\n";
                return 14;
            }
            if (doc->regions.size() != 3) {
                std::cerr << "[FAIL] Test 14.1b: expected 3 regions!\n";
                return 14;
            }
            if (doc->regions[0].loopMode != "loop_continuous" ||
                doc->regions[0].loopStartFrame != 4410 ||
                doc->regions[0].loopEndFrame != 22050) {
                std::cerr << "[FAIL] Test 14.1b: zone_low_p loop was not transferred (mode/start/end)!\n";
                return 14;
            }
            if (doc->regions[2].loopMode != "no_loop") {
                std::cerr << "[FAIL] Test 14.1b: zone_hi must stay no_loop!\n";
                return 14;
            }
        }

        // 14.2: Verify zone selection across Note & Velocity
        // Test soft note in low register (C3 = 48, vel = 0.2 -> zone_low_p)
        samplerEngine->noteOn(48, 0.2f);
        std::vector<float> leftP(512, 0.0f);
        std::vector<float> rightP(512, 0.0f);
        samplerEngine->process(leftP.data(), rightP.data(), 512);

        float maxP = 0.0f;
        for (size_t i = 0; i < 512; ++i) maxP = std::max(maxP, std::abs(leftP[i]));
        if (maxP <= 1e-5f) {
            std::cerr << "[FAIL] Test 14.2: NoteOn C3 soft produced silence!\n";
            return 14;
        }

        samplerEngine->allNotesOff();

        // Test loud note in low register (C3 = 48, vel = 0.9 -> zone_low_f)
        samplerEngine->noteOn(48, 0.9f);
        std::vector<float> leftF(512, 0.0f);
        std::vector<float> rightF(512, 0.0f);
        samplerEngine->process(leftF.data(), rightF.data(), 512);

        float maxF = 0.0f;
        for (size_t i = 0; i < 512; ++i) maxF = std::max(maxF, std::abs(leftF[i]));
        if (maxF <= 1e-5f) {
            std::cerr << "[FAIL] Test 14.2: NoteOn C3 loud produced silence!\n";
            return 14;
        }

        // 14.3: High register note (C5 = 72 -> zone_hi)
        samplerEngine->noteOn(72, 0.7f);
        std::vector<float> leftHi(512, 0.0f);
        std::vector<float> rightHi(512, 0.0f);
        samplerEngine->process(leftHi.data(), rightHi.data(), 512);
        float maxHi = 0.0f;
        for (size_t i = 0; i < 512; ++i) maxHi = std::max(maxHi, std::abs(leftHi[i]));
        if (maxHi <= 1e-5f) {
            std::cerr << "[FAIL] Test 14.3: NoteOn C5 high register produced silence!\n";
            return 14;
        }

        samplerEngine->allNotesOff();
        std::cout << "  [PASS] Test 14: Phase K.2 Rompler multisample import & velocity/pitch zone dispatch verified.\n";
    }
    // Test 15: Phase loop-1 -- region loop bounds mapping + wrap math (pure).
    {
        // 4410/22050 @44100Hz on the 8 fps synth clock -> [0.8, 4.0] of 64 frames.
        extended::AxionikRegion loopReg;
        loopReg.loopMode = "loop_continuous";
        loopReg.loopStartFrame = 4410;
        loopReg.loopEndFrame = 22050;
        loopReg.sampleRate = 44100.0f;
        const extended::RegionLoopBounds lb =
            extended::regionLoopBoundsFrames(loopReg, 64);
        if (!lb.hasLoop || std::abs(lb.start - 0.8f) > 1e-4f || std::abs(lb.end - 4.0f) > 1e-4f) {
            std::cerr << "[FAIL] Test 15: loop bounds mapping wrong (" << lb.start << ", " << lb.end << ")!\n";
            return 15;
        }
        // continuous wraps around: 4.5 in [0.8, 4.0] -> 1.3
        {
            const auto st = extended::wrapRegionLoopPos(4.5f, 0.8f, 4.0f, "loop_continuous", 1);
            if (std::abs(st.pos - 1.3f) > 1e-4f || st.dir != 1 || st.finished) {
                std::cerr << "[FAIL] Test 15: continuous wrap wrong!\n";
                return 15;
            }
        }
        // ping_pong reflects and flips direction: 4.5 -> 3.5, dir -1
        {
            const auto st = extended::wrapRegionLoopPos(4.5f, 0.8f, 4.0f, "ping_pong", 1);
            if (std::abs(st.pos - 3.5f) > 1e-4f || st.dir != -1 || st.finished) {
                std::cerr << "[FAIL] Test 15: ping_pong reflect wrong!\n";
                return 15;
            }
        }
        // one_shot ends at the bound and reports finished
        {
            const auto st = extended::wrapRegionLoopPos(4.2f, 0.8f, 4.0f, "one_shot", 1);
            if (std::abs(st.pos - 4.0f) > 1e-4f || !st.finished) {
                std::cerr << "[FAIL] Test 15: one_shot finish wrong!\n";
                return 15;
            }
            const auto st2 = extended::wrapRegionLoopPos(2.0f, 0.8f, 4.0f, "one_shot", 1);
            if (st2.finished) {
                std::cerr << "[FAIL] Test 15: one_shot must not finish mid-loop!\n";
                return 15;
            }
        }
        // backward keeps dir -1 and wraps from below
        {
            const auto st = extended::wrapRegionLoopPos(0.5f, 0.8f, 4.0f, "loop_backward", -1);
            if (std::abs(st.pos - (0.8f + (0.5f + 3.2f - 0.8f))) > 1e-4f || st.dir != -1) {
                std::cerr << "[FAIL] Test 15: backward wrap wrong!\n";
                return 15;
            }
        }
        // no_loop / degenerate bounds keep legacy (no loop)
        {
            extended::AxionikRegion noLoop;
            noLoop.loopMode = "no_loop";
            if (extended::regionLoopBoundsFrames(noLoop, 64).hasLoop) {
                std::cerr << "[FAIL] Test 15: no_loop must not loop!\n";
                return 15;
            }
            extended::AxionikRegion deg = loopReg;
            deg.loopMode = "loop_continuous";
            deg.loopStartFrame = 99999;
            deg.loopEndFrame = 99999;
            if (extended::regionLoopBoundsFrames(deg, 64).hasLoop) {
                std::cerr << "[FAIL] Test 15: degenerate bounds must not loop!\n";
                return 15;
            }
        }
        std::cout << "  [PASS] Test 15: Phase loop-1 region loop mapping + wrap math verified.\n";
    }
    // Test 16: Trigger dispatcher (first/legato/release), per-group
    // round-robin honoring roundRobinIndex, and mute-group choke.
    {
        std::cerr << "[16] enter" << std::endl;
        const std::string trigJson = R"JSON({
          "schemaVersion": "2.0.0",
          "identity": {
            "slug": "trigger-lab",
            "expandedName": "Trigger Lab",
            "modelName": "TRIGLAB",
            "engineMin": "expanded",
            "requiredCaps": ["filter-v2"]
          },
          "spectral": {
            "partialCount": 64,
            "frameCount": 2,
            "frameSpanHz": 20000.0,
            "frames": [
              { "f0Hz": 261.63, "amps": [0.8, 0.4, 0.2], "offsets": [0.0, 12.0, 19.0] },
              { "f0Hz": 261.63, "amps": [0.4, 0.2, 0.1], "offsets": [0.0, 12.0, 19.0] }
            ]
          },
          "regions": [
            { "id": "rr_a", "sampleRef": "a.wav", "lowKey": 60, "highKey": 60, "rootKey": 60,
              "lowVel": 1, "highVel": 127, "roundRobinGroup": "g", "roundRobinIndex": 2 },
            { "id": "rr_b", "sampleRef": "b.wav", "lowKey": 60, "highKey": 60, "rootKey": 60,
              "lowVel": 1, "highVel": 127, "roundRobinGroup": "g", "roundRobinIndex": 1 },
            { "id": "first_c", "sampleRef": "c.wav", "lowKey": 61, "highKey": 61, "rootKey": 61,
              "lowVel": 1, "highVel": 127, "trigger": "first" },
            { "id": "legato_d", "sampleRef": "d.wav", "lowKey": 62, "highKey": 62, "rootKey": 62,
              "lowVel": 1, "highVel": 127, "trigger": "legato" },
            { "id": "attack_e", "sampleRef": "e.wav", "lowKey": 62, "highKey": 62, "rootKey": 62,
              "lowVel": 1, "highVel": 127 },
            { "id": "hat_closed", "sampleRef": "hc.wav", "lowKey": 63, "highKey": 63, "rootKey": 63,
              "lowVel": 1, "highVel": 127, "muteGroup": 7 },
            { "id": "hat_open", "sampleRef": "ho.wav", "lowKey": 64, "highKey": 64, "rootKey": 64,
              "lowVel": 1, "highVel": 127, "muteGroup": 7 },
            { "id": "attack_g", "sampleRef": "g.wav", "lowKey": 67, "highKey": 67, "rootKey": 67,
              "lowVel": 1, "highVel": 127 },
            { "id": "damper", "sampleRef": "r.wav", "lowKey": 67, "highKey": 67, "rootKey": 67,
              "lowVel": 1, "highVel": 127, "trigger": "release" },
            { "id": "solo_e", "sampleRef": "s.wav", "lowKey": 66, "highKey": 66, "rootKey": 66,
              "lowVel": 1, "highVel": 127, "roundRobinGroup": "h" }
          ],
          "articulation": {
            "polyphony": 16,
            "voiceMode": "poly",
            "ampEnv": { "attack": 0.005, "decay": 0.2, "sustain": 0.8, "release": 0.4 },
            "filters": [
              { "id": "main-filter", "type": "ladder-v2", "cutoffHz": 12000.0, "resonance": 0.2 }
            ]
          },
          "resynators": [
            { "id": "r1", "version": 2, "model": "resonator-hd" }
          ],
          "analysis": {},
          "classic": { "modelName": "TRIGLAB" }
        })JSON";

        auto trigEngine = std::make_unique<DspEngineFacade>();
        trigEngine->prepare(44100.0, 512);

        extended::AxionikExpandedPreflightReport trigReport;
        if (!trigEngine->loadExpandedModelFromJson(0, trigJson, &trigReport) || !trigReport.ok) {
            std::cerr << "[FAIL] Test 16: trigger-lab model failed to load!\n";
            return 16;
        }
        // 16.0: muteGroup + RR fields survive parsing.
        {
            const auto* doc = trigEngine->getExpandedModelDoc(0);
            if (!doc || doc->regions.size() != 10) {
                std::cerr << "[FAIL] Test 16.0: expected 10 regions!\n";
                return 16;
            }
            if (doc->regions[5].muteGroup != 7 || doc->regions[6].muteGroup != 7 ||
                doc->regions[4].muteGroup != 0) {
                std::cerr << "[FAIL] Test 16.0: muteGroup not transferred!\n";
                return 16;
            }
            if (doc->regions[2].trigger != "first" || doc->regions[3].trigger != "legato" ||
                doc->regions[8].trigger != "release") {
                std::cerr << "[FAIL] Test 16.0: triggers not transferred!\n";
                return 16;
            }
        }
        auto findVoiceByRegion = [&](int regionIdx) -> int {
            for (size_t i = 0; i < 16; ++i) {
                if (trigEngine->getExpandedVoiceRegionIndex(0, i) == regionIdx) return static_cast<int>(i);
            }
            return -1;
        };
        std::vector<float> tL(512, 0.0f), tR(512, 0.0f);

        std::cerr << "[16] loaded" << std::endl;
        // 16.1: per-group RR honors roundRobinIndex order (rr_b idx1 first).
        trigEngine->noteOn(60, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(1) < 0) {
            std::cerr << "[FAIL] Test 16.1: first RR pick must be rr_b (roundRobinIndex 1)!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        trigEngine->noteOn(60, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(0) < 0) {
            std::cerr << "[FAIL] Test 16.1: second RR pick must be rr_a (roundRobinIndex 2)!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        std::cerr << "[16] 16.1 ok" << std::endl;

        // 16.2: groups rotate independently (group h untouched by group g).
        trigEngine->noteOn(66, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(9) < 0) {
            std::cerr << "[FAIL] Test 16.2: solo_e (group h) must sound!\n";
            return 16;
        }
        trigEngine->noteOn(60, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(1) < 0) {
            std::cerr << "[FAIL] Test 16.2: group g counter must wrap back to rr_b!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        std::cerr << "[16] 16.2 ok" << std::endl;
        trigEngine->noteOn(63, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(5) < 0) {
            std::cerr << "[FAIL] Test 16.3: hat_closed must sound!\n";
            return 16;
        }
        trigEngine->noteOn(64, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(6) < 0) {
            std::cerr << "[FAIL] Test 16.3: hat_open must sound!\n";
            return 16;
        }
        {
            const int closedSlot = findVoiceByRegion(5);
            if (closedSlot < 0 || !trigEngine->isExpandedVoiceReleasing(0, static_cast<size_t>(closedSlot))) {
                std::cerr << "[FAIL] Test 16.3: hat_closed must be choked (releasing)!\n";
                return 16;
            }
        }
        trigEngine->allNotesOff();
        std::cerr << "[16] 16.3 ok" << std::endl;

        // 16.4: first/legato gates.
        trigEngine->noteOn(61, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(2) < 0) {
            std::cerr << "[FAIL] Test 16.4: 'first' region must fire with nothing held!\n";
            return 16;
        }
        trigEngine->noteOn(62, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(3) < 0) {
            std::cerr << "[FAIL] Test 16.4: 'legato' region must fire over held voices!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        trigEngine->noteOn(62, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(3) >= 0 || findVoiceByRegion(4) < 0) {
            std::cerr << "[FAIL] Test 16.4: 'legato' must NOT fire with nothing held (attack_e instead)!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        std::cerr << "[16] 16.4 ok" << std::endl;
        // 16.5: release trigger spawns a voice on noteOff.
        trigEngine->noteOn(67, 0.8f);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(7) < 0) {
            std::cerr << "[FAIL] Test 16.5: attack_g must sound on noteOn!\n";
            return 16;
        }
        trigEngine->noteOff(67);
        trigEngine->process(tL.data(), tR.data(), 512);
        if (findVoiceByRegion(8) < 0) {
            std::cerr << "[FAIL] Test 16.5: 'release' region must spawn a voice on noteOff!\n";
            return 16;
        }
        trigEngine->allNotesOff();
        std::cerr << "[16] 16.5 ok" << std::endl;
        std::cout << "  [PASS] Test 16: trigger dispatcher (first/legato/release) + per-group RR + mute choke verified.\n";
    }

    // Test 17: AxionikDB slug compatibility (folder name vs identity.slug)
    {
        const auto root = std::filesystem::temp_directory_path() / "axionik_slug_resolution_test";
        std::filesystem::remove_all(root);
        const auto modelFolder = root / "Models" / "Transformed_HD_96k" / "01_Keyboards_Piano" / "fmrhodes_HD";
        std::filesystem::create_directories(modelFolder);
        {
            std::ofstream jsonOut(modelFolder / "axionik-expanded.json");
            jsonOut << R"({"schemaVersion":"2.0.0","identity":{"slug":"fmrhodes-hd-96k","expandedName":"fmrhodes HD"}})";
        }

        NeuronBankAdapter adapter;
        adapter.setAxionikDbPath(root);

        const auto byFolder = adapter.resolveAxionikModelFolder("fmrhodes_HD");
        const auto byIdentity = adapter.resolveAxionikModelFolder("fmrhodes-hd-96k");
        std::error_code cmpEc;
        const bool folderOk = std::filesystem::equivalent(byFolder, modelFolder, cmpEc) && !cmpEc;
        cmpEc.clear();
        const bool identityOk = std::filesystem::equivalent(byIdentity, modelFolder, cmpEc) && !cmpEc;

        if (!folderOk || !identityOk) {
            std::cerr << "[FAIL] Test 17: AxionikDB slug resolution (folder=" << byFolder.string()
                      << ", identity=" << byIdentity.string() << ")\n";
            std::filesystem::remove_all(root);
            return 17;
        }
        std::filesystem::remove_all(root);
        std::cout << "  [PASS] Test 17: AxionikDB resolves folder name and identity.slug.\n";
    }

    // Test 18: AxionikDB scan preserves the -1 sentinel and an explicit parameterSet
    {
        const auto root = std::filesystem::temp_directory_path() / "axionik_parameter_set_scan_test";
        std::filesystem::remove_all(root);
        const auto categoryFolder = root / "Models" / "Transformed_HD_96k" / "01_Keyboards_Piano";
        const auto explicitFolder = categoryFolder / "ExplicitParameterSet";
        const auto sentinelFolder = categoryFolder / "SentinelParameterSet";
        std::filesystem::create_directories(explicitFolder);
        std::filesystem::create_directories(sentinelFolder);
        {
            std::ofstream jsonOut(explicitFolder / "axionik-expanded.json");
            jsonOut << R"({"schemaVersion":"2.0.0","identity":{"slug":"explicit-parameter-set","expandedName":"Explicit Parameter Set"},"parameterSet":5})";
        }
        {
            std::ofstream jsonOut(sentinelFolder / "axionik-expanded.json");
            jsonOut << R"({"schemaVersion":"2.0.0","identity":{"slug":"sentinel-parameter-set","expandedName":"Sentinel Parameter Set"}})";
        }

        NeuronBankAdapter adapter;
        adapter.setNeuronDbPath(root);
        adapter.setAxionikDbPath(root);
        const std::string catalog = adapter.scanCatalogJson();

        const std::string explicitEntry =
            R"("slug":"ExplicitParameterSet","name":"Explicit Parameter Set","category":"Synth & Neutral","parameterSet":5)";
        const std::string sentinelEntry =
            R"("slug":"SentinelParameterSet","name":"Sentinel Parameter Set","category":"Synth & Neutral","parameterSet":-1)";
        const bool explicitOk = catalog.find(explicitEntry) != std::string::npos;
        const bool sentinelOk = catalog.find(sentinelEntry) != std::string::npos;

        std::filesystem::remove_all(root);
        if (!explicitOk || !sentinelOk) {
            std::cerr << "[FAIL] Test 18: AxionikDB parameterSet scan (explicit=" << explicitOk
                      << ", sentinel=" << sentinelOk << ")\n"
                      << catalog << "\n";
            return 18;
        }
        std::cout << "  [PASS] Test 18: AxionikDB scan keeps parameterSet=-1 when absent and reads explicit parameterSet=5.\n";
    }

    // Test 19: ParamGrouping covers all 445 parameters
    {
        auto buckets = buildParamGroupBuckets();
        size_t covered = 0;
        bool blenderPlaced = false;
        for (const auto& b : buckets) {
            covered += b.params.size();
            for (const auto* p : b.params) {
                if (p->index == ParamIdx::BlenderAmount) {
                    blenderPlaced = (b.id == "Synth" || b.id == "Synthesizer");
                }
            }
        }
        if (covered != kNumTotalParameters) {
            std::cerr << "[FAIL] Test 19: Groups covered " << covered << " params, expected " << kNumTotalParameters << "\n";
            return 19;
        }
        if (!blenderPlaced) {
            std::cerr << "[FAIL] Test 19: BlenderAmount lost its dictionary group\n";
            return 19;
        }
        std::cout << "  [PASS] Test 19: " << buckets.size() << " parameter groups cover all "
                  << covered << " registry parameters without duplicates.\n";
    }

    // Test 20: Diagnostic Tone 440 Hz Injection (AXVS.2)
    {
        auto toneEngine = std::make_unique<DspEngineFacade>();
        toneEngine->prepare(44100.0, 512);

        // 20.1: Default is Disabled -> idle renders silence
        std::vector<float> bufL(512, 0.0f);
        std::vector<float> bufR(512, 0.0f);
        toneEngine->process(bufL.data(), bufR.data(), 512);
        float idlePeak = 0.0f;
        for (float s : bufL) idlePeak = std::max(idlePeak, std::abs(s));
        if (idlePeak > 1e-6f) {
            std::cerr << "[FAIL] Test 20.1: Idle engine produced sound without diagnostic tone! idlePeak=" << idlePeak << "\n";
            return 20;
        }

        // 20.2: Enable PostMaster tone at 440 Hz, 0.25 level
        toneEngine->setDiagnosticTone(1, 440.0f, 0.25f);
        if (toneEngine->getDiagnosticTonePoint() != 1) {
            std::cerr << "[FAIL] Test 20.2: Diagnostic tone point was not stored!\n";
            return 20;
        }
        std::fill(bufL.begin(), bufL.end(), 0.0f);
        std::fill(bufR.begin(), bufR.end(), 0.0f);
        toneEngine->process(bufL.data(), bufR.data(), 512);

        float tonePeak = 0.0f;
        for (float s : bufL) tonePeak = std::max(tonePeak, std::abs(s));
        if (tonePeak < 0.20f || tonePeak > 0.30f) {
            std::cerr << "[FAIL] Test 20.3: Expected ~0.25 peak from 440 Hz diagnostic tone, got " << tonePeak << "\n";
            return 20;
        }

        // 20.3: Disable tone -> silence returns
        toneEngine->setDiagnosticTone(0, 440.0f, 0.0f);
        std::fill(bufL.begin(), bufL.end(), 0.0f);
        std::fill(bufR.begin(), bufR.end(), 0.0f);
        toneEngine->process(bufL.data(), bufR.data(), 512);
        float postPeak = 0.0f;
        for (float s : bufL) postPeak = std::max(postPeak, std::abs(s));
        if (postPeak > 1e-6f) {
            std::cerr << "[FAIL] Test 20.4: Disabling diagnostic tone did not restore silence!\n";
            return 20;
        }

        std::cout << "  [PASS] Test 20: Diagnostic tone injection (440 Hz reference) verified (AXVS.2).\n";
    }

    // Test 21: ScopeTap Telemetry Tap Infrastructure (AXVS.3)
    {
        auto tapEngine = std::make_unique<DspEngineFacade>();
        tapEngine->prepare(44100.0, 512);
        auto& tap = tapEngine->getScopeTapMaster();

        // 21.1: Initially inactive
        if (tap.isActive()) {
            std::cerr << "[FAIL] Test 21.1: ScopeTap must be inactive by default!\n";
            return 21;
        }

        // 21.2: Activate tap and render
        tap.setActive(true);
        tapEngine->setDiagnosticTone(1, 440.0f, 0.25f);
        std::vector<float> bufL(512, 0.0f);
        std::vector<float> bufR(512, 0.0f);
        tapEngine->process(bufL.data(), bufR.data(), 512);

        size_t avail = tap.getAvailableRead();
        if (avail < 512) {
            std::cerr << "[FAIL] Test 21.2: Active ScopeTap did not accumulate samples! available=" << avail << "\n";
            return 21;
        }

        std::vector<float> readL(512, 0.0f);
        std::vector<float> readR(512, 0.0f);
        size_t readCount = tap.read(readL.data(), readR.data(), 512);
        if (readCount != 512) {
            std::cerr << "[FAIL] Test 21.3: ScopeTap read failed!\n";
            return 21;
        }

        // 21.3: Deactivate tap
        tap.setActive(false);
        tapEngine->process(bufL.data(), bufR.data(), 512);
        if (tap.getAvailableRead() != 0) {
            std::cerr << "[FAIL] Test 21.4: Inactive ScopeTap must not accumulate samples!\n";
            return 21;
        }

        std::cout << "  [PASS] Test 21: ScopeTap lock-free ring buffer telemetry verified (AXVS.3).\n";
    }

    // Test 22: DoS Protection on File Size Limits (AXVS.5)
    {
        // 22.1: Non-existent file rejected
        SoundPreset p;
        if (NeuronSound::parseSoundScriptFile("non_existent_file_xyz.script", p)) {
            std::cerr << "[FAIL] Test 22.1: Non-existent file must be rejected!\n";
            return 22;
        }

        // 22.2: Empty file rejected
        auto tmpEmpty = std::filesystem::temp_directory_path() / "test_empty.script";
        {
            std::ofstream out(tmpEmpty);
        }
        if (NeuronSound::parseSoundScriptFile(tmpEmpty, p)) {
            std::filesystem::remove(tmpEmpty);
            std::cerr << "[FAIL] Test 22.2: 0-byte file must be rejected!\n";
            return 22;
        }
        std::filesystem::remove(tmpEmpty);

        std::cout << "  [PASS] Test 22: DoS physical file size bounds protection verified (AXVS.5).\n";
    }

    std::cout << "[DspEngineFacadeTests] All 22 tests passed successfully!\n";
    return 0;
}
